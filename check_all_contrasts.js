const { spawn } = require('child_process');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8085/'
  ]);

  await sleep(2500);

  let targets;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9225/json');
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

  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  await sendCommand('Page.navigate', { url: 'http://localhost:8085/' });
  await sleep(2500);

  const checkRes = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const results = [];
        const selectors = [
          '.gfl-hero-title',
          '.gfl-hero-text',
          '.gfl-hero-location-pill span',
          '.gfl-hero-services-strip',
          '.gfl-section-title',
          '.gfl-section-subtitle',
          '.gfl-service-card h3',
          '.gfl-service-desc',
          '.gfl-service-highlight',
          '.gfl-service-featured h3',
          '.gfl-service-featured p',
          '.gfl-featured-notice p',
          '.gfl-step-card h3',
          '.gfl-step-card p',
          '.gfl-review-card',
          '.gfl-review-text',
          '.gfl-reviewer-name',
          '.gfl-reviewer-src',
          '.gfl-google-profile-box h3',
          '.gfl-google-profile-box p',
          '.gfl-booking-box h2',
          '.gfl-booking-box p',
          '.gfl-field-group label',
          '.gfl-field-help',
          '#whatsappMessagePreview',
          '.gfl-location-card h4',
          '.gfl-location-card p',
          '.gfl-faq-item h3 button',
          '.gfl-faq-answer p',
          '.gfl-cta-banner h2',
          '.gfl-cta-banner p',
          '.gfl-footer-col h4',
          '.gfl-footer-col p',
          '.gfl-footer-links a',
          '.gfl-footer-bottom p'
        ];

        selectors.forEach(sel => {
          const el = document.querySelector(sel);
          if (el) {
            const cs = window.getComputedStyle(el);
            results.push({
              selector: sel,
              color: cs.color,
              fontSize: cs.fontSize,
              fontWeight: cs.fontWeight
            });
          } else {
            results.push({ selector: sel, missing: true });
          }
        });
        return results;
      })()
    `,
    returnByValue: true
  });

  console.log('ELEMENT STYLES REPORT:');
  console.log(JSON.stringify(checkRes.result.result.value, null, 2));

  ws.close();
  chromeProcess.kill();
}

run().catch(console.error);
