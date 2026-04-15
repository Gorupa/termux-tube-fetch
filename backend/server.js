const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/extract', (req, res) => {
    const videoUrl = req.body.url;
    if (!videoUrl) return res.status(400).json({ success: false, error: 'URL is required' });

    console.log(`[Termux Node] Processing: ${videoUrl}`);
    
    // Executes the globally installed yt-dlp in Termux
    const command = `yt-dlp -J "${videoUrl}"`;

    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
            console.error("Extraction error:", stderr || error.message);
            return res.status(500).json({ success: false, error: 'Failed to process URL.' });
        }

        try {
            const data = JSON.parse(stdout);
            const videoLink = data.url; 
            const formats = data.formats || [];
            
            // Find best audio-only stream
            const audioFormat = formats.reverse().find(f => f.acodec !== 'none' && f.vcodec === 'none');
            const audioLink = audioFormat ? audioFormat.url : null;

            res.json({
                success: true,
                title: data.title,
                videoLink: videoLink,
                audioLink: audioLink
            });
        } catch (parseError) {
            console.error('Parse error:', parseError);
            res.status(500).json({ success: false, error: 'Failed to parse media data.' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Termux Edge Proxy active on http://localhost:${PORT}
    `);
});
