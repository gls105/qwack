// ─── Tab Navigation ───────────────────────────────────────────────────────────
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    tabPanels.forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ─── Window Controls ──────────────────────────────────────────────────────────
document.getElementById('btn-minimize').addEventListener('click', () => window.qwack.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => window.qwack.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.qwack.close());

// ─── Agent / Chat ──────────────────────────────────────────────────────────────
const OPENAI_API_KEY = ''; // ← Paste your OpenAI API key here, or load from a config file

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

let chatHistory = [
  {
    role: 'system',
    content: `You are qwack, an agentic AI assistant built into a desktop app. You can control the user's computer.

You have access to these tools (call them by outputting JSON in a special block):
- shell: run a shell command → {"tool":"shell","command":"<cmd>","cwd":"<optional path>"}
- read_file: read a file → {"tool":"read_file","path":"<path>"}
- write_file: write a file → {"tool":"write_file","path":"<path>","content":"<content>"}
- list_dir: list a directory → {"tool":"list_dir","path":"<path>"}

When you want to use a tool, output ONLY this JSON on its own line (no other text in that message):
TOOL: {"tool":"shell","command":"ls -la"}

After the tool runs, you'll see the result as a system message. Then continue your response.

Be direct, capable, and efficient. You are qwack — built to get things done.`
  }
];

function appendMessage(role, text, toolCall = null) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  if (role === 'user') {
    div.textContent = text;
  } else {
    const label = document.createElement('div');
    label.className = 'msg-label';
    label.textContent = role === 'assistant' ? '🦆 qwack' : '⚙️ system';
    div.appendChild(label);

    if (toolCall) {
      const tc = document.createElement('div');
      tc.className = 'tool-call';
      tc.textContent = toolCall;
      div.appendChild(tc);
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    div.appendChild(bubble);
  }

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

async function runToolCall(toolJson) {
  const tool = JSON.parse(toolJson);
  let result = '';

  if (tool.tool === 'shell') {
    const r = await window.qwack.runShell(tool.command, tool.cwd || null);
    result = (r.stdout + r.stderr).trim() || `(exit ${r.exitCode})`;
  } else if (tool.tool === 'read_file') {
    const r = await window.qwack.readFile(tool.path);
    result = r.ok ? r.content : `Error: ${r.error}`;
  } else if (tool.tool === 'write_file') {
    const r = await window.qwack.writeFile(tool.path, tool.content);
    result = r.ok ? 'File written.' : `Error: ${r.error}`;
  } else if (tool.tool === 'list_dir') {
    const r = await window.qwack.listDir(tool.path);
    result = r.ok ? r.entries.map((e) => `${e.isDir ? '📁' : '📄'} ${e.name}`).join('\n') : `Error: ${r.error}`;
  } else {
    result = `Unknown tool: ${tool.tool}`;
  }

  return result;
}

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  chatInput.style.height = 'auto';

  appendMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  const thinkingDiv = appendMessage('assistant', '...');

  // Simple agentic loop: call AI, check for tool call, run it, repeat
  let iterations = 0;
  const MAX_ITER = 6;

  while (iterations < MAX_ITER) {
    iterations++;

    let aiText = '';

    if (!OPENAI_API_KEY) {
      // Demo mode: no API key
      aiText = `[No API key set — edit renderer.js and add your OpenAI key to OPENAI_API_KEY]\n\nBut I can still run tools directly from the Terminal tab! Try it.`;
    } else {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: chatHistory,
            temperature: 0.3,
          }),
        });
        const data = await res.json();
        aiText = data.choices?.[0]?.message?.content || 'No response.';
      } catch (e) {
        aiText = `Network error: ${e.message}`;
      }
    }

    // Check for tool call
    const toolMatch = aiText.match(/^TOOL:\s*(\{.+\})/m);
    if (toolMatch) {
      const toolJson = toolMatch[1];
      // Show the tool call in UI
      thinkingDiv.querySelector('.bubble').textContent = `Running tool: ${toolJson}`;

      chatHistory.push({ role: 'assistant', content: aiText });

      const toolResult = await runToolCall(toolJson);

      // Show tool result
      appendMessage('system', toolResult, `Tool: ${toolJson}`);
      chatHistory.push({ role: 'system', content: `Tool result:\n${toolResult}` });
    } else {
      // Final response
      thinkingDiv.querySelector('.bubble').textContent = aiText;
      chatHistory.push({ role: 'assistant', content: aiText });
      break;
    }
  }
}

chatSend.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
});

// ─── Terminal ──────────────────────────────────────────────────────────────────
const termOutput = document.getElementById('terminal-output');
const termInput = document.getElementById('terminal-input');
const termRun = document.getElementById('terminal-run');
let termCwd = null;

async function runTermCmd() {
  const cmd = termInput.value.trim();
  if (!cmd) return;
  termInput.value = '';

  // Handle `cd` locally
  if (cmd.startsWith('cd ')) {
    const newDir = cmd.slice(3).trim();
    termCwd = newDir;
    appendTerm(cmd, `(cwd → ${newDir})`, '', 0);
    return;
  }

  const block = document.createElement('div');
  block.className = 'term-block';
  block.innerHTML = `<div class="term-cmd">${escapeHtml(cmd)}</div><div class="term-stdout">running...</div>`;
  termOutput.appendChild(block);
  termOutput.scrollTop = termOutput.scrollHeight;

  const r = await window.qwack.runShell(cmd, termCwd);

  const outEl = block.querySelector('.term-stdout');
  outEl.textContent = r.stdout || '';

  if (r.stderr) {
    const errEl = document.createElement('div');
    errEl.className = 'term-stderr';
    errEl.textContent = r.stderr;
    block.appendChild(errEl);
  }

  const exitEl = document.createElement('div');
  exitEl.className = r.exitCode === 0 ? 'term-exit-ok' : 'term-exit-err';
  exitEl.textContent = `exit ${r.exitCode}`;
  block.appendChild(exitEl);

  termOutput.scrollTop = termOutput.scrollHeight;
}

function appendTerm(cmd, stdout, stderr, exitCode) {
  const block = document.createElement('div');
  block.className = 'term-block';
  block.innerHTML = `
    <div class="term-cmd">${escapeHtml(cmd)}</div>
    ${stdout ? `<div class="term-stdout">${escapeHtml(stdout)}</div>` : ''}
    ${stderr ? `<div class="term-stderr">${escapeHtml(stderr)}</div>` : ''}
    <div class="${exitCode === 0 ? 'term-exit-ok' : 'term-exit-err'}">exit ${exitCode}</div>
  `;
  termOutput.appendChild(block);
  termOutput.scrollTop = termOutput.scrollHeight;
}

termRun.addEventListener('click', runTermCmd);
termInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runTermCmd(); });

// ─── Remote Desktop (noVNC) ───────────────────────────────────────────────────
const vncConnect = document.getElementById('vnc-connect');
const vncDisconnect = document.getElementById('vnc-disconnect');
const vncWebview = document.getElementById('vnc-webview');
const vncFrameContainer = document.getElementById('vnc-frame-container');
const remoteHint = document.getElementById('remote-hint');

// noVNC web endpoint — user can self-host or use novnc.com
// For local use, we load the noVNC client pointed at their VNC server via websockify
vncConnect.addEventListener('click', () => {
  const host = document.getElementById('vnc-host').value.trim();
  const port = document.getElementById('vnc-port').value || '5900';
  const password = document.getElementById('vnc-password').value;

  if (!host) return;

  // noVNC expects a websocket proxy (websockify). We build a URL using the
  // online noVNC viewer as a fallback UI (loads noVNC JS from CDN).
  // For production: bundle noVNC locally in /vendor/novnc/
  const wsPort = parseInt(port) + 100; // websockify default: VNC port + 100
  const pwParam = password ? `&password=${encodeURIComponent(password)}` : '';
  const novncUrl = `novnc.html?host=${encodeURIComponent(host)}&port=${wsPort}${pwParam}`;

  vncWebview.src = novncUrl;
  vncFrameContainer.style.display = 'flex';
  remoteHint.style.display = 'none';
  vncDisconnect.disabled = false;
});

vncDisconnect.addEventListener('click', () => {
  vncWebview.src = 'about:blank';
  vncFrameContainer.style.display = 'none';
  remoteHint.style.display = 'flex';
  vncDisconnect.disabled = true;
});

// ─── Files ─────────────────────────────────────────────────────────────────────
const filesList = document.getElementById('files-list');
const filesPath = document.getElementById('files-path');
let currentFilesPath = '';

async function loadDir(p) {
  const r = await window.qwack.listDir(p);
  if (!r.ok) {
    filesList.innerHTML = `<li style="color:var(--red)">Error: ${escapeHtml(r.error)}</li>`;
    return;
  }
  currentFilesPath = p;
  filesPath.value = p;
  filesList.innerHTML = '';

  // Back button
  if (p !== '/') {
    const back = document.createElement('li');
    back.className = 'file-item dir';
    back.innerHTML = '<span class="file-icon">⬆️</span> ..';
    back.addEventListener('click', () => {
      const parent = p.split('/').slice(0, -1).join('/') || '/';
      loadDir(parent);
    });
    filesList.appendChild(back);
  }

  r.entries.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  r.entries.forEach((entry) => {
    const li = document.createElement('li');
    li.className = `file-item ${entry.isDir ? 'dir' : ''}`;
    li.innerHTML = `<span class="file-icon">${entry.isDir ? '📁' : '📄'}</span>${escapeHtml(entry.name)}`;
    li.addEventListener('click', () => {
      const full = `${p}/${entry.name}`.replace(/\/\//g, '/');
      if (entry.isDir) {
        loadDir(full);
      } else {
        // Open file in agent tab with read command
        window.qwack.readFile(full).then((r) => {
          if (r.ok) {
            document.querySelector('[data-tab="agent"]').click();
            chatInput.value = `Show me the contents of ${full}`;
            sendChat();
          }
        });
      }
    });
    filesList.appendChild(li);
  });
}

document.getElementById('files-go').addEventListener('click', () => {
  loadDir(filesPath.value.trim() || '/');
});
filesPath.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadDir(filesPath.value.trim() || '/');
});

// Init files tab with home dir
window.qwack.sysInfo().then((info) => {
  filesPath.value = info.homeDir;
  currentFilesPath = info.homeDir;
});

// ─── Util ─────────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Welcome message ──────────────────────────────────────────────────────────
appendMessage('assistant', `Welcome to qwack.ai 🦆\n\nI'm your agentic desktop assistant. I can:\n• Run shell commands and control your computer\n• Read and write files\n• Connect to remote desktops via VNC\n• Browse your filesystem\n\nAdd your OpenAI API key in renderer.js to enable the AI agent. The Terminal and Files tabs work without a key.\n\nWhat do you want to build?`);
