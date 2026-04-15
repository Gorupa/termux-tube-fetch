const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

// Allow the frontend to communicate with this backend
app.use(cors());
app.use(express.json());

app.post('/extract', (req, res) => {
    const videoUrl = req.body.url;

    if (!videoUrl) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    console.log(`Processing URL: ${videoUrl}`);

    // Command to dump video metadata as JSON
    const command = `yt-dlp -J "${videoUrl}"`;

    // Increased maxBuffer because yt-dlp JSON output can be quite large
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
            console.error('Execution error:', error);
            return res.status(500).json({ success: false, error: 'Failed to process URL. Ensure yt-dlp is installed.' });
        }

        try {
            const data = JSON.parse(stdout);

            // Direct URL for the best combined format
            const videoLink = data.url; 
            
            // Find the best audio-only stream
            const formats = data.formats || [];
            const audioFormat = formats.reverse().find(f => f.acodec !== 'none' && f.vcodec === 'none');
            const audioLink = audioFormat ? audioFormat.url : null;

            res.json({
                success: true,
                title: data.title,
                thumbnail: data.thumbnail,
                videoLink: videoLink,
                audioLink: audioLink
            });

        } catch (parseError) {
            console.error('Parse error:', parseError);
            res.status(500).json({ success: false, error: 'Failed to parse extraction data.' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Termux backend is active on http://localhost:${PORT}`);
});
