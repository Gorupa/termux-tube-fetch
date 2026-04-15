/* ═══════════════════════════════════════════════════════════════
   MediaFetch — Frontend Logic
   Robust fetch, error handling, UI state management.
   ═══════════════════════════════════════════════════════════════ */

/**
 * ─── CONFIGURATION ───────────────────────────────────────────
 * Update this URL each time you start a new Cloudflare Tunnel.
 * Your tunnel URL looks like: https://xxxxx.trycloudflare.com
 */
const TERMUX_API_URL = 'https://prospect-grid-proceeds-plc.trycloudflare.com/extract';

/** Request timeout in milliseconds (30 seconds) */
const REQUEST_TIMEOUT_MS = 30_000;

/* ─── DOM References ─── */
const urlInput       = document.getElementById('youtubeUrl');
const extractBtn     = document.getElementById('extractBtn');
const pasteBtn       = document.getElementById('pasteBtn');
const resultContainer= document.getElementById('resultContainer');
const toast          = document.getElementById('toast');

let toastTimer = null;

/* ═══════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Validate that the given string is a recognizable YouTube URL.
 * Handles youtube.com/watch, youtu.be/, and Shorts.
 */
function isYouTubeUrl(url) {
    try {
        const u = new URL(url.trim());
        const validHosts = ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'];
        if (!validHosts.includes(u.hostname)) return false;
        // Must have either v= param, be a youtu.be/ID, or be a /shorts/ path
        if (u.hostname === 'youtu.be') return u.pathname.length > 1;
        return u.searchParams.has('v') || u.pathname.startsWith('/shorts/');
    } catch {
        return false;
    }
}

/**
 * Extract YouTube video ID from URL for thumbnail preview.
 * Returns null if not parseable.
 */
function extractVideoId(url) {
    try {
        const u = new URL(url.trim());
        if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
        if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1].split('?')[0];
        return u.searchParams.get('v');
    } catch {
        return null;
    }
}

/**
 * Format seconds into M:SS or H:MM:SS string.
 */
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return null;
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Truncate a title to a max character count, adding ellipsis.
 */
function truncateTitle(title, maxLen = 70) {
    if (!title) return 'Unknown Title';
    return title.length > maxLen ? title.substring(0, maxLen).trimEnd() + '…' : title;
}

/**
 * Show a brief toast notification at the bottom of the screen.
 */
function showToast(message, duration = 3000) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), duration);
}

/* ═══════════════════════════════════════════════════════════════
   UI STATE MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

/** Set the extract button into a loading / idle state. */
function setButtonLoading(isLoading) {
    extractBtn.disabled = isLoading;
    extractBtn.classList.toggle('is-loading', isLoading);
    extractBtn.setAttribute('aria-busy', isLoading);
}

/** Show the result container with a given HTML payload and animate it in. */
function showResult(html) {
    resultContainer.classList.remove('is-visible');
    resultContainer.innerHTML = html;
    // Force reflow so the animation re-triggers
    void resultContainer.offsetHeight;
    resultContainer.style.display = 'block';
    resultContainer.classList.add('is-visible');
}

/** Show a loading skeleton while waiting for the API. */
function showLoadingState() {
    showResult(`
        <p class="status-msg status-msg--loading">
            <span class="material-symbols-rounded" style="animation: logo-wave 1.5s ease-in-out infinite; font-variation-settings:'FILL' 1,'wght' 500;">wifi_tethering</span>
            Handshaking with Termux Edge Node…
        </p>
    `);
}

/**
 * Show a friendly error state with icon.
 * @param {string} message - Human-friendly error text.
 * @param {'error'|'warn'} [type='error']
 */
function showError(message, type = 'error') {
    const icon = type === 'warn' ? 'warning' : 'error';
    showResult(`
        <p class="status-msg status-msg--error">
            <span class="material-symbols-rounded">${icon}</span>
            ${message}
        </p>
    `);
}

/**
 * Build the result card HTML from the API response data.
 */
function buildResultCard(data, videoId) {
    const title = truncateTitle(data.title);
    const duration = formatDuration(data.duration);
    const thumbUrl = videoId
        ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        : null;

    const thumbHtml = thumbUrl
        ? `<img
                src="${thumbUrl}"
                alt="${title}"
                class="result-thumb"
                loading="lazy"
                onerror="this.style.display='none'"
           >`
        : '';

    const metaChips = [];
    if (duration) {
        metaChips.push(`
            <span class="meta-chip">
                <span class="material-symbols-rounded">schedule</span>
                ${duration}
            </span>
        `);
    }
    if (data.videoQuality) {
        metaChips.push(`
            <span class="meta-chip">
                <span class="material-symbols-rounded">hd</span>
                ${data.videoQuality}
            </span>
        `);
    }
    const metaHtml = metaChips.length
        ? `<div class="result-meta">${metaChips.join('')}</div>`
        : '';

    const videoBtn = data.videoLink
        ? `<a href="${data.videoLink}" target="_blank" rel="noopener" class="dl-btn dl-btn--video" download>
               <span class="dl-btn__left">
                   <span class="dl-btn__icon">
                       <span class="material-symbols-rounded">movie</span>
                   </span>
                   <span class="dl-btn__label">
                       <span class="dl-btn__title">High Quality Video</span>
                       <span class="dl-btn__hint">Best available combined stream</span>
                   </span>
               </span>
               <span class="format-badge format-badge--video">MP4</span>
           </a>`
        : '';

    const audioLabel = data.audioExt ? data.audioExt.toUpperCase() : 'M4A';
    const audioBtn = data.audioLink
        ? `<a href="${data.audioLink}" target="_blank" rel="noopener" class="dl-btn dl-btn--audio" download>
               <span class="dl-btn__left">
                   <span class="dl-btn__icon">
                       <span class="material-symbols-rounded">music_note</span>
                   </span>
                   <span class="dl-btn__label">
                       <span class="dl-btn__title">Audio Only</span>
                       <span class="dl-btn__hint">Highest bitrate audio stream</span>
                   </span>
               </span>
               <span class="format-badge format-badge--audio">MP3 / ${audioLabel}</span>
           </a>`
        : '';

    return `
        ${thumbHtml}
        <p class="result-title">${title}</p>
        ${metaHtml}
        <div class="download-list">
            ${videoBtn}
            ${audioBtn}
        </div>
    `;
}

/* ═══════════════════════════════════════════════════════════════
   CORE EXTRACTION LOGIC
   ═══════════════════════════════════════════════════════════════ */

async function handleExtract() {
    const rawUrl = urlInput.value.trim();

    /* ── Input Validation ── */
    if (!rawUrl) {
        urlInput.focus();
        showToast('⚠️ Please paste a YouTube URL first.');
        return;
    }

    if (!isYouTubeUrl(rawUrl)) {
        showToast('❌ That doesn\'t look like a YouTube URL.');
        urlInput.focus();
        return;
    }

    const videoId = extractVideoId(rawUrl);

    /* ── Update UI ── */
    setButtonLoading(true);
    showLoadingState();

    /* ── Fetch with timeout ── */
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(TERMUX_API_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ url: rawUrl }),
            signal:  controller.signal,
        });

        clearTimeout(timeoutId);

        /* ── Handle HTTP-level errors ── */
        if (!response.ok) {
            let errMsg = 'The server returned an error. Please try again.';
            try {
                const errData = await response.json();
                if (errData.error) errMsg = errData.error;
            } catch { /* ignore parse error on error body */ }

            if (response.status === 403) {
                errMsg = 'YouTube blocked this request. The Termux tunnel may need a cookie update.';
            } else if (response.status === 404) {
                errMsg = 'Video not found. It may be private, deleted, or age-restricted.';
            } else if (response.status === 504 || response.status === 408) {
                errMsg = 'The request timed out. YouTube may be throttling — please try again shortly.';
            }

            showError(errMsg);
            return;
        }

        const data = await response.json();

        /* ── Handle app-level errors ── */
        if (!data.success) {
            showError(data.error || 'Extraction failed. Please try a different video.');
            return;
        }

        /* ── Render success card ── */
        showResult(buildResultCard(data, videoId));

    } catch (err) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            showError(
                'Request timed out after 30 seconds. Check that your Termux server and Cloudflare Tunnel are running.',
                'warn'
            );
        } else if (err.message === 'Failed to fetch') {
            showError(
                'Cannot reach the Termux edge node. Make sure the Cloudflare Tunnel is active and the URL in script.js is up to date.',
                'warn'
            );
        } else {
            console.error('[MediaFetch] Unexpected error:', err);
            showError('An unexpected error occurred. Please check the console for details.');
        }

    } finally {
        setButtonLoading(false);
    }
}

/* ═══════════════════════════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════════════════════════ */

/* Extract button click */
extractBtn.addEventListener('click', handleExtract);

/* Press Enter in the URL input */
urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !extractBtn.disabled) handleExtract();
});

/* Paste from clipboard button */
pasteBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text && isYouTubeUrl(text)) {
            urlInput.value = text;
            urlInput.focus();
            showToast('✅ YouTube URL pasted!');
        } else if (text) {
            urlInput.value = text;
            urlInput.focus();
            showToast('📋 Pasted — doesn\'t look like YouTube though.');
        } else {
            showToast('Clipboard is empty.');
        }
    } catch {
        showToast('⚠️ Clipboard access denied. Paste manually with Ctrl+V.');
    }
});

/* Auto-trigger on paste into the input (nice UX touch) */
urlInput.addEventListener('paste', () => {
    // Small delay so value is populated before we check
    setTimeout(() => {
        const val = urlInput.value.trim();
        if (val && isYouTubeUrl(val)) {
            showToast('🔗 YouTube URL detected! Hit Extract.');
        }
    }, 50);
});
