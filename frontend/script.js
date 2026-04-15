const downloadBtn = document.getElementById('downloadBtn');
const urlInput = document.getElementById('youtubeUrl');
const resultDiv = document.getElementById('result');

// Pointing to your permanent Render cloud server
const API_URL = 'https://termux-tube-fetch.onrender.com/extract'; 

downloadBtn.addEventListener('click', async () => {
    const videoUrl = urlInput.value.trim();
    
    if (!videoUrl) {
        alert("Please enter a valid URL.");
        return;
    }

    // Update UI for loading state
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `<p class="status-text">Handshaking with Cloud Node... ⏳<br><small style="font-size: 0.75rem; opacity: 0.7;">(May take up to 30s if the server is waking up)</small></p>`;
    downloadBtn.disabled = true;
    downloadBtn.querySelector('.btn-text').innerText = 'Extracting...';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: videoUrl })
        });

        const data = await response.json();

        if (data.success) {
            // Truncate title if it's too long for a clean UI
            const shortTitle = data.title.length > 50 ? data.title.substring(0, 50) + '...' : data.title;

            resultDiv.innerHTML = `
                <h3 class="video-title">${shortTitle}</h3>
                <div class="download-options">
                    <a href="${data.videoLink}" target="_blank" class="btn-tonal">
                        <span>High Quality Video</span>
                        <span class="format-tag">MP4</span>
                    </a>
                    ${data.audioLink ? `
                    <a href="${data.audioLink}" target="_blank" class="btn-tonal">
                        <span>Audio Only</span>
                        <span class="format-tag audio-tag">MP3 / M4A</span>
                    </a>
                    ` : ''}
                </div>
            `;
        } else {
            resultDiv.innerHTML = `<p class="status-text" style="color: var(--md-sys-color-error);">Error: ${data.error}</p>`;
        }

    } catch (error) {
        console.error(error);
        resultDiv.innerHTML = `<p class="status-text" style="color: var(--md-sys-color-error);">Connection failed. Check if the cloud server is online.</p>`;
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.querySelector('.btn-text').innerText = 'Extract Media';
    }
});
