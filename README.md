<div align="center">

# 🎬 MediaFetch

### *Zero-Storage. Edge-Proxied. Beautifully Fast.*

**A serverless YouTube media extractor that downloads directly from Google's own edge servers —
costing the host exactly 0 MB of storage and kilobytes of mobile data.**

[![Made with Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Powered by yt-dlp](https://img.shields.io/badge/yt--dlp-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://github.com/yt-dlp/yt-dlp)
[![Hosted on Cloudflare](https://img.shields.io/badge/Cloudflare_Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![Runs on Termux](https://img.shields.io/badge/Termux-000000?style=for-the-badge&logo=android&logoColor=white)](https://termux.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

<br/>

![MediaFetch Banner](https://placehold.co/900x300/0f0f0f/ffffff?text=MediaFetch+%E2%80%94+Zero+Storage+%7C+Edge+Proxied+%7C+Open+Source)

</div>

---

## 🚀 Architecture Overview

MediaFetch is not a traditional downloader. It never touches a file. It never stores a byte. Here's the elegant trick that makes it work:

```
┌─────────────────────────────────────────────────────────────────┐
│                     THE MEDIAFETCH FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   User Browser          Cloudflare          Your Android        │
│  (Anywhere on Earth)      Tunnel             (Termux Node)      │
│                                                                 │
│  [Pastes YouTube URL] ──────────────────► [Express API]         │
│                                                                 │
│                                           [yt-dlp -J]           │
│                                           Dumps raw JSON        │
│                                           metadata only ✓       │
│                                                                 │
│  [Direct Download] ◄──── [Raw Edge URL] ◄─ [Extracts direct    │
│   from Google's CDN                         googlevideo.com     │
│   NOT your server ✓                         stream URLs]        │
│                                                                 │
│   💾 Your Storage Used: 0 MB                                    │
│   📡 Your Bandwidth Used: ~2 KB per request                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 🧠 The Zero-Storage Philosophy

Most YouTube downloaders are bandwidth hogs — they download the full video to the server, *then* serve it to you. MediaFetch eliminates this entirely.

1. **You submit a YouTube URL** to the frontend, hosted globally on Cloudflare Pages.
2. **The request travels** via an encrypted Cloudflare Tunnel to your private Termux backend on an Android device — no port forwarding, no VPS required.
3. **`yt-dlp -J`** is invoked on the backend. It extracts the raw, signed `googlevideo.com` edge server URLs from YouTube's own CDN — without downloading a single frame.
4. **The raw stream URLs are returned** to the frontend as JSON.
5. **Your browser connects directly** to YouTube's global edge servers and downloads the media at full speed. The Android device's job is done.

> **The result:** MediaFetch is essentially a metadata broker. It whispers the secret direct-download address to your browser and steps aside.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🚫 **Zero Storage** | The backend never writes a single media byte to disk |
| ⚡ **Edge-Native Speed** | Downloads come straight from Google's global CDN |
| 📱 **Runs on Android** | The entire backend lives inside Termux — no VPS needed |
| 🔒 **Secure Tunneling** | Cloudflare Tunnel encrypts all traffic, no open ports |
| 🎨 **Material 3 Expressive UI** | Sleek, human-centric design with a polished frontend |
| 🎵 **Audio & Video** | Choose between High-Quality MP4 (video) or MP3/M4A (audio only) |
| 🌍 **Globally Hosted** | Frontend deployed on Cloudflare Pages CDN worldwide |
| 🚫 **100% Ad-Free** | No ads. No trackers. No nonsense. Ever. |
| 🆓 **Open Source** | Fully transparent, forkable, and community-driven |

---

## 🛠️ Tech Stack

### Frontend
- **HTML5** — Semantic, accessible markup
- **CSS3** — Material 3 Expressive design system with custom properties
- **Vanilla JavaScript** — No frameworks, no bloat, pure speed
- **Cloudflare Pages** — Global CDN hosting with zero cold starts

### Backend
- **Node.js** — Runtime environment
- **Express.js** — Lightweight REST API server
- **yt-dlp** — The powerhouse metadata extractor (Python)
- **FFmpeg** — Audio stream processing & format conversion

### Infrastructure
- **Termux** — Linux environment on Android; the edge node host
- **Cloudflare Tunnels (`cloudflared`)** — Secure, authenticated bridge from local device to the public internet

---

## ⚙️ How to Run Your Own Edge Node

> **Prerequisites:** An Android device with [Termux](https://f-droid.org/packages/com.termux/) installed (use the F-Droid version, not Play Store). A free [Cloudflare account](https://cloudflare.com) for the tunnel.

### Step 1 — Bootstrap Termux

Open Termux and update all base packages:

```bash
pkg update && pkg upgrade -y
```

### Step 2 — Install System Dependencies

```bash
pkg install -y nodejs python ffmpeg
```

> ☑️ This installs Node.js (runtime), Python (for yt-dlp), and FFmpeg (for audio conversion).

### Step 3 — Install Cloudflare Tunnel Client

```bash
pkg install -y cloudflared
```

### Step 4 — Install `yt-dlp`

```bash
pip install -U yt-dlp
```

> 💡 The `-U` flag ensures you always get the latest version, which is important for staying ahead of YouTube's frequent format changes.

### Step 5 — Clone the Repository

```bash
git clone https://github.com/yourusername/mediafetch.git
cd mediafetch/backend
```

### Step 6 — Install Node Dependencies

```bash
npm install
```

### Step 7 — Start the API Server

```bash
node server.js
```

You should see:

```
✅ MediaFetch API running on http://localhost:3000
```

### Step 8 — Open a Cloudflare Tunnel

Open a **new Termux session** (swipe right for a new tab) and run:

```bash
cloudflared tunnel --url http://localhost:3000
```

Cloudflare will generate a secure public URL that looks like:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://random-words-here.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

### Step 9 — Connect Frontend to Your Tunnel

Copy your generated tunnel URL and update the `API_BASE` constant in the frontend's `script.js`:

```javascript
// script.js
const API_BASE = "https://random-words-here.trycloudflare.com";
```

Deploy the updated frontend to Cloudflare Pages — and you're live. 🎉

---

### 🗂️ Project Structure

```
mediafetch/
├── frontend/
│   ├── index.html          # Main UI shell
│   ├── style.css           # Material 3 Expressive design system
│   └── script.js           # Fetch logic & UI interactions
│
├── backend/
│   ├── server.js           # Express API — the metadata broker
│   ├── package.json
│   └── package-lock.json
│
└── README.md
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

---

## ⚖️ Legal Disclaimer

MediaFetch is intended for **personal, fair-use purposes only** — such as downloading content you have the right to access offline. The tool itself does not host, store, or redistribute any copyrighted content. Users are solely responsible for ensuring their use complies with YouTube's [Terms of Service](https://www.youtube.com/t/terms) and applicable copyright laws in their jurisdiction.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">

---

**Designed & Built with ❤️ by [Gaurav](https://github.com/yourusername)**

*"Why pay for bandwidth when Google already has it?"*

<br/>

![Powered by Termux](https://img.shields.io/badge/Powered_by-Termux-black?style=for-the-badge&logo=android&logoColor=3DDC84)
![Zero Storage](https://img.shields.io/badge/Storage_Used-0_MB-success?style=for-the-badge)
![Ad Free](https://img.shields.io/badge/Ads-None._Ever.-blueviolet?style=for-the-badge)

---

*If MediaFetch saved you time, consider giving it a ⭐ on GitHub — it helps more than you know.*

</div>
