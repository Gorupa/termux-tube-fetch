/* ═══════════════════════════════════════════════════════════════
   MediaFetch — Termux Edge Node (server.js)
   Zero-storage YouTube media extractor backend.
   Run inside Termux: node server.js
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const cors    = require('cors');
const { exec } = require('child_process');

const app  = express();
const PORT = 3000;

/** yt-dlp subprocess kill timeout in ms (55 seconds) */
const YTDLP_TIMEOUT_MS = 55_000;

app.use(cors());
app.use(express.json());

/* ─── URL Validation ─────────────────────────────────────────── */
/**
 * Accept only recognized YouTube hostnames.
 * Prevents arbitrary shell injection surface and ensures
 * yt-dlp only receives YouTube content.
 */
function isValidYouTubeUrl(url) {
    if (typeof url !== 'string' || url.length > 2048) return false;
    try {
        const u = new URL(url.trim());
        // Only allow HTTPS
        if (u.protocol !== 'https:') return false;
        const validHosts = [
            'www.youtube.com',
            'youtube.com',
            'm.youtube.com',
            'youtu.be',
        ];
        if (!validHosts.includes(u.hostname)) return false;
        // Must have a video ID
        if (u.hostname === 'youtu.be') return u.pathname.length > 1;
        return u.searchParams.has('v') || u.pathname.startsWith('/shorts/');
    } catch {
        return false;
    }
}

/* ─── Format Pickers ─────────────────────────────────────────── */
/**
 * From yt-dlp's formats array, find the best combined stream
 * (has BOTH video and audio tracks in one container).
 * Sorted descending by resolution height.
 */
function pickBestVideoFormat(formats) {
    return formats
        .filter(f =>
            f.url &&
            f.vcodec && f.vcodec !== 'none' &&
            f.acodec && f.acodec !== 'none'
        )
        .sort((a, b) => (b.height || 0) - (a.height || 0))[0] || null;
}

/**
 * From yt-dlp's formats array, find the best audio-only stream.
 * Sorted descending by audio bitrate.
 */
function pickBestAudioFormat(formats) {
    return formats
        .filter(f =>
            f.url &&
            (f.vcodec === 'none' || !f.vcodec) &&
            f.acodec && f.acodec !== 'none'
        )
        .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0] || null;
}

/* ─── Error Classifier ───────────────────────────────────────── */
/**
 * Inspect yt-dlp stderr to return a human-friendly error message
 * and an appropriate HTTP status code.
 */
function classifyYtdlpError(error, stderr = '') {
    const s = stderr.toLowerCase();

    if (error.killed || error.signal === 'SIGTERM') {
        return { status: 504, message: 'Extraction timed out. YouTube may be throttling — please try again in a moment.' };
    }
    if (s.includes('video unavailable') || s.includes('private video')) {
        return { status: 404, message: 'Video unavailable. It may be private, age-restricted, or deleted.' };
    }
    if (s.includes('sign in to confirm') || s.includes('confirm you\'re not a bot')) {
        return { status: 403, message: 'YouTube is requesting bot verification. The yt-dlp cookies may need updating.' };
    }
    if (s.includes('this video is not available') || s.includes('no video formats')) {
        return { status: 404, message: 'No downloadable formats found for this video.' };
    }
    if (s.includes('http error 429') || s.includes('too many requests')) {
        return { status: 429, message: 'YouTube is rate-limiting this IP. Please wait a few minutes and try again.' };
    }
    if (s.includes('network') || s.includes('connection')) {
        return { status: 503, message: 'Network error while contacting YouTube. Check Termux internet connectivity.' };
    }

    return { status: 500, message: 'Failed to extract media. Please try again.' };
}

/* ─── Routes ─────────────────────────────────────────────────── */

/**
 * POST /extract
 * Body: { url: string }
 * Returns: { success, title, duration, thumbnail, videoLink, videoQuality, audioLink, audioExt }
 */
app.post('/extract', (req, res) => {
    const videoUrl = (req.body.url || '').trim();

    if (!videoUrl) {
        return res.status(400).json({ success: false, error: 'A YouTube URL is required.' });
    }

    if (!isValidYouTubeUrl(videoUrl)) {
        return res.status(400).json({ success: false, error: 'Only YouTube URLs (youtube.com / youtu.be) are supported.' });
    }

    console.log(`[MediaFetch] ▶ Extracting: ${videoUrl}`);

    /**
     * Flags used:
     *  -J              — dump full JSON metadata to stdout, do not download
     *  --no-playlist   — ignore playlist, process single video only
     *  --no-warnings   — keep stderr clean; only real errors come through
     */
    const command = `yt-dlp -J --no-playlist --no-warnings "${videoUrl}"`;

    const execOptions = {
        maxBuffer: 1024 * 1024 * 20,  // 20 MB — enough for any metadata blob
        timeout:   YTDLP_TIMEOUT_MS,
    };

    exec(command, execOptions, (error, stdout, stderr) => {
        if (error) {
            const { status, message } = classifyYtdlpError(error, stderr);
            console.error(`[MediaFetch] ✗ Error (${status}):`, stderr || error.message);
            return res.status(status).json({ success: false, error: message });
        }

        try {
            const data    = JSON.parse(stdout);
            const formats = data.formats || [];

            const videoFmt = pickBestVideoFormat(formats);
            const audioFmt = pickBestAudioFormat(formats);

            if (!videoFmt && !audioFmt) {
                return res.status(404).json({
                    success: false,
                    error: 'No streamable formats found. The video may be restricted.',
                });
            }

            console.log(`[MediaFetch] ✓ OK | "${data.title}" | video=${videoFmt?.height || 'n/a'}p | audio=${audioFmt?.abr || 'n/a'}kbps`);

            res.json({
                success: true,

                // Media info
                title:        data.title        || 'Unknown Title',
                duration:     data.duration     || null,
                thumbnail:    data.thumbnail    || null,

                // Video (combined stream: best res with audio)
                videoLink:    videoFmt?.url     || null,
                videoQuality: videoFmt ? `${videoFmt.height}p` : null,
                videoExt:     videoFmt?.ext     || null,

                // Audio-only (highest bitrate)
                audioLink:    audioFmt?.url     || null,
                audioExt:     audioFmt?.ext     || 'm4a',
                audioBitrate: audioFmt?.abr     || null,
            });

        } catch (parseError) {
            console.error('[MediaFetch] ✗ JSON parse error:', parseError.message);
            res.status(500).json({ success: false, error: 'Failed to parse metadata from yt-dlp. Please try again.' });
        }
    });
});

/**
 * GET /health
 * Lightweight liveness check for monitoring or tunnel verification.
 */
app.get('/health', (_req, res) => {
    res.json({ status: 'alive', node: 'MediaFetch Termux Edge', timestamp: new Date().toISOString() });
});

/* ─── Start ──────────────────────────────────────────────────── */
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   🎬  MediaFetch — Termux Edge Node          ║
║   ✅  Listening on http://localhost:${PORT}       ║
║   📡  Waiting for Cloudflare Tunnel...        ║
╚══════════════════════════════════════════════╝
    `);
});
