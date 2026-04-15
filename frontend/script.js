const downloadBtn = document.getElementById('downloadBtn');
const urlInput = document.getElementById('youtubeUrl');
const resultDiv = document.getElementById('result');

// IMPORTANT: Replace this with your actual Cloudflare Tunnel URL later
const TERMUX_API_URL = 'https://YOUR-CLOUDFLARE-TUNNEL-URL.trycloudflare.com/extract'; 

downloadBtn.addEventListener('click', async () => {
    const videoUrl = urlInput.value.trim();
    
    if (!videoUrl) {
        alert("Please enter a valid URL");
        return;
    }

    // Update UI for loading state
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `<p style="font-weight: bold;">Fetching from Termux... ⏳</p>`;
    downloadBtn.disabled = true;

    try {
        const response = await fetch(TERMUX_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: videoUrl })
        });

        const data = await response.json();

        if (data.success) {
            resultDiv.innerHTML = `
                <h3>${data.title}</h3>
                <a href="${data.videoLink}" target="_blank" class="btn-link">⬇️ Download Video (MP4)</a>
                ${data.audioLink ? `<a href="${data.audioLink}" target="_blank" class="btn-link">🎵 Download Audio Only</a>` : ''}
            `;
        } else {
            resultDiv.innerHTML = `<p style="color: red; font-weight: bold;">Error: ${data.error}</p>`;
        }

    } catch (error) {
        console.error(error);
        resultDiv.innerHTML = `<p style="color: red; font-weight: bold;">Connection failed. Is Termux running and the tunnel open?</p>`;
    } finally {
        downloadBtn.disabled = false;
   
}
});
