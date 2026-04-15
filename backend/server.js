const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());

// Health Check to prove the server is awake
app.get('/', (req, res) => {
    res.send('✅ MediaFetch Cloud Backend is online and ready!');
});

app.post('/extract', async (req, res) => {
    const videoUrl = req.body.url;
    if (!videoUrl) return res.status(400).json({ success: false, error: 'URL is required' });

    console.log(`Processing URL: ${videoUrl}`);

    try {
        // This safely executes yt-dlp in the background
        const output = await youtubedl(videoUrl, {
            dumpJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificates: true
        });

        const videoLink = output.url; 
        const formats = output.formats || [];
        const audioFormat = formats.reverse().find(f => f.acodec !== 'none' && f.vcodec === 'none');
        const audioLink = audioFormat ? audioFormat.url : null;

        res.json({
            success: true,
            title: output.title,
            videoLink: videoLink,
            audioLink: audioLink
        });

    } catch (error) {
        console.error("Extraction error:", error.message);
        res.status(500).json({ success: false, error: 'Cloud extraction failed. Video might be restricted.' });
    }
});

app.listen(PORT, () => {
    console.log(`Cloud backend active on port ${PORT}`);
});
