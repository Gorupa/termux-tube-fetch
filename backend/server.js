const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
// Allow Render to assign the port dynamically
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());

app.post('/extract', (req, res) => {
    const videoUrl = req.body.url;
    if (!videoUrl) return res.status(400).json({ success: false, error: 'URL is required' });

    console.log(`Processing URL: ${videoUrl}`);
    
    // Notice the ./ before yt-dlp! This tells it to use the local Render file
    const command = `./yt-dlp -J "${videoUrl}"`;

    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ success: false, error: 'Failed to process URL.' });

        try {
            const data = JSON.parse(stdout);
            const videoLink = data.url; 
            const formats = data.formats || [];
            const audioFormat = formats.reverse().find(f => f.acodec !== 'none' && f.vcodec === 'none');
            const audioLink = audioFormat ? audioFormat.url : null;

            res.json({
                success: true,
                title: data.title,
                videoLink: videoLink,
                audioLink: audioLink
            });
        } catch (parseError) {
            res.status(500).json({ success: false, error: 'Failed to parse data.' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Cloud backend active on port ${PORT}`);
});
