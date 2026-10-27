const { spawn } = require('child_process');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8085/'
  ]);

  await sleep(2500);

  let targets;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9226/json');
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch (e) {
      await sleep(1000);
    }
  }

  const page = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function send(method, params = {}) {
    return new Promise(r => {
      const curId = id++;
      const onmsg = (e) => {
        const d = JSON.parse(e.data);
        if (d.id === curId) {
          ws.removeEventListener('message', onmsg);
          r(d);
        }
      };
      ws.addEventListener('message', onmsg);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://localhost:8085/' });
  await sleep(2000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const darkBtns = Array.from(document.querySelectorAll('.gfl-btn-dark'));
        return darkBtns.map(btn => ({
          text: btn.textContent.trim(),
          color: window.getComputedStyle(btn).color,
          bgColor: window.getComputedStyle(btn).backgroundColor,
          spanColor: btn.querySelector('span') ? window.getComputedStyle(btn.querySelector('span')).color : null
        }));
      })()
    `,
    returnByValue: true
  });

  console.log('DARK BUTTONS AUDIT:');
  console.log(JSON.stringify(evalRes.result.result.value, null, 2));

  ws.close();
  chromeProcess.kill();
}

run().catch(console.error);
