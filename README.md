# qwack.ai 🦆

> Agentic desktop app — AI agent + shell control + remote desktop

## What it is

qwack is a native desktop app (Electron) that gives you:

- **Agent tab** — AI-powered chat that can run commands, read/write files, and control your computer
- **Terminal tab** — Direct shell access with output display
- **Remote Desktop tab** — Built-in VNC viewer (noVNC) — connect to any VNC server
- **Files tab** — Browse and open files, integrated with the agent

## Setup

```bash
cd qwack
npm install
npm start
```

## Add your AI key

Open `renderer.js` and find this line near the top:

```js
const OPENAI_API_KEY = ''; // ← Paste your OpenAI API key here
```

Paste your key. Save. Restart the app. The agent is now live.

## Remote Desktop

1. Go to the **Remote** tab
2. Enter the VNC host IP, port (default 5900), and password
3. Click Connect

The app uses noVNC (loaded from CDN). For this to work, the VNC server needs
a WebSocket proxy running (websockify). Run it on the remote machine:

```bash
# Install websockify
pip install websockify

# Run it (maps ws port 6000 → VNC port 5900)
websockify 6000 localhost:5900
```

Then in qwack, connect to that host with port 5900 (the app adds 100 for the websocket port automatically).

## Stack

- **Electron** — native desktop shell
- **noVNC** — remote desktop via WebSocket/VNC
- **OpenAI API** — AI agent (GPT-4o by default; swap to any provider)
- **node-pty** — (optional, for future full PTY terminal)

## Next steps

- [ ] Add Claude API support (Anthropic)
- [ ] Bundle noVNC locally instead of CDN
- [ ] Full PTY terminal (arrow keys, tab complete)
- [ ] File editor panel
- [ ] SSH remote control (alternative to VNC)
- [ ] Settings panel (API key, theme, default cwd)
- [ ] Packaged .exe / .dmg / .AppImage builds
