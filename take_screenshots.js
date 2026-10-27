const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function capture() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9224;
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8085/'
  ]);

  chromeProcess.on('error', err => {
    console.error('Failed to spawn Chrome:', err);
    process.exit(1);
  });

  await sleep(2500);

  let targets;
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch (e) {
      await sleep(1000);
    }
  }

  if (!targets || targets.length === 0) {
    console.error('Could not connect to Chrome debugging endpoint on port', port);
    chromeProcess.kill();
    process.exit(1);
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let id = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg);
      callbacks.delete(msg.id);
    }
  };

  await new Promise(resolve => ws.onopen = resolve);

  function sendCommand(method, params = {}) {
    return new Promise((resolve) => {
      const cmdId = id++;
      callbacks.set(cmdId, resolve);
      ws.send(JSON.stringify({ id: cmdId, method, params }));
    });
  }

  await sendCommand('Page.enable');

  // 1. Desktop 1440px
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(1500);
  const snapDesktop = await sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  if (snapDesktop.result && snapDesktop.result.data) {
    fs.writeFileSync('screenshot_desktop_fullpage.png', Buffer.from(snapDesktop.result.data, 'base64'));
    console.log('Saved screenshot_desktop_fullpage.png');
    // Also copy to artifact dir for view_file
    const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity-ide\\brain\\c9af37e2-b653-4544-90b8-56d61e24d366';
    if (fs.existsSync(artifactDir)) {
      fs.writeFileSync(path.join(artifactDir, 'screenshot_desktop_fullpage.png'), Buffer.from(snapDesktop.result.data, 'base64'));
    }
  }

  // 2. Mobile 390px
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(1500);
  const snapMobile = await sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  if (snapMobile.result && snapMobile.result.data) {
    fs.writeFileSync('screenshot_mobile_fullpage.png', Buffer.from(snapMobile.result.data, 'base64'));
    console.log('Saved screenshot_mobile_fullpage.png');
    const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity-ide\\brain\\c9af37e2-b653-4544-90b8-56d61e24d366';
    if (fs.existsSync(artifactDir)) {
      fs.writeFileSync(path.join(artifactDir, 'screenshot_mobile_fullpage.png'), Buffer.from(snapMobile.result.data, 'base64'));
    }
  }

  ws.close();
  chromeProcess.kill();
  console.log('All screenshots captured successfully.');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
