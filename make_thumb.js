const { spawn } = require('child_process');
const fs = require('fs');

async function getThumbnail() {
  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--disable-gpu',
    'http://localhost:8085/'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9227/json');
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  function send(method, params={}) {
    return new Promise(r => {
      const curId = id++;
      const onmsg = (e) => {
        const d = JSON.parse(e.data);
        if (d.id === curId) { ws.removeEventListener('message', onmsg); r(d); }
      };
      ws.addEventListener('message', onmsg);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 1000));
  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const img = document.querySelector('.gfl-logo-img');
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 120, 120);
        return canvas.toDataURL('image/jpeg', 0.85);
      })()
    `,
    returnByValue: true
  });
  const dataUrl = evalRes.result.result.value;
  console.log('Thumbnail length:', dataUrl.length);
  fs.writeFileSync('logo_thumbnail_dataurl.txt', dataUrl);
  ws.close();
  chromeProcess.kill();
  console.log('Done!');
}
getThumbnail().catch(console.error);
