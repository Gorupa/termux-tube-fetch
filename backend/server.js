const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());

// Health Check to prove the server is running
app.get('/', (req, res) => {
    res.send('✅ MediaFetch Cloud Backend is awake!');
});

app.post('/extract', (req, res) => {
    const videoUrl = req.body.url;
    if (!videoUrl) return res.status(400).json({ success: false, error: 'URL is required' });

    console.log(`Processing URL: ${videoUrl}`);
    
    // Check if yt-dlp actually exists on the server
    if (!fs.existsSync('./yt-dlp')) {
        return res.status(500).json({ success: false, error: 'Server configuration error: yt-dlp binary not found.' });
    }

    const command = `./yt-dlp -J "${videoUrl}"`;

    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
            console.error("--- YT-DLP ERROR ---");
            console.error("Message:", error.message);
            console.error("Stderr:", stderr);
            
            // Extract the most important part of the error to show on the frontend
            const shortError = stderr ? stderr.split('\n')[0] : error.message;
            return res.status(500).json({ success: false, error: `Extraction failed: ${shortError}` });
        }

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
            console.error('Parse error:', parseError);
            res.status(500).json({ success: false, error: 'Failed to read media data.' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Cloud backend active on port ${PO
                                                RT}`);
});
