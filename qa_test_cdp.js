const { spawn } = require('child_process');
const http = require('http');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- STARTING AUTOMATED BROWSER & QA TEST SUITE ---');

  // 1. Launch Headless Chrome on port 9222
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8085/'
  ]);

  chromeProcess.on('error', err => {
    console.error('Failed to spawn Chrome:', err);
    process.exit(1);
  });

  // Give Chrome 2 seconds to bind port
  await sleep(2000);

  let targets;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch (e) {
      await sleep(1000);
    }
  }

  if (!targets || targets.length === 0) {
    console.error('Could not connect to Chrome debugging endpoint');
    chromeProcess.kill();
    process.exit(1);
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  console.log(`Attached to target: ${pageTarget.title} (${pageTarget.url})`);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let id = 1;
  const callbacks = new Map();
  const consoleMessages = [];
  const networkErrors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      cb(msg);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      consoleMessages.push(msg.params);
    }
    if (msg.method === 'Network.responseReceived') {
      if (msg.params.response.status >= 400) {
        networkErrors.push({ url: msg.params.response.url, status: msg.params.response.status });
      }
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

  async function evaluate(expression) {
    const res = await sendCommand('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result && res.result.result ? res.result.result.value : null;
  }

  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  await sendCommand('Network.enable');

  // Wait for document ready
  await sleep(1500);

  const testResults = [];

  // TEST 1: Page Title and Meta Tags
  console.log('\n[TEST 1] Verifying Page Metadata and SEO...');
  const title = await evaluate('document.title');
  const metaDesc = await evaluate('document.querySelector("meta[name=\'description\']")?.content');
  const canonical = await evaluate('document.querySelector("link[rel=\'canonical\']")?.href');
  const schemaScript = await evaluate('document.querySelector("script[type=\'application/ld+json\']")?.textContent');
  
  const schemaObj = schemaScript ? JSON.parse(schemaScript) : null;
  const isSchemaValid = schemaObj && schemaObj['@type'] === 'DryCleaningOrLaundry' && schemaObj.name === 'Garment Fix Laundry';

  testResults.push({
    test: 'Page Title',
    pass: title.includes('Garment Fix Laundry') && title.includes('Akure'),
    details: title
  });
  testResults.push({
    test: 'Meta Description',
    pass: metaDesc && metaDesc.includes('Garment Fix Laundry') && metaDesc.includes('Alagbaka'),
    details: metaDesc
  });
  testResults.push({
    test: 'Canonical Link',
    pass: canonical === 'https://garmentfixlaundry.com/',
    details: canonical
  });
  testResults.push({
    test: 'LocalBusiness Schema JSON-LD',
    pass: isSchemaValid && schemaObj.telephone === '+2348063063559',
    details: schemaObj ? `${schemaObj.name} | ${schemaObj.telephone} | Price: ${schemaObj.priceRange}` : 'Missing'
  });

  // TEST 2: Header Brand & Uncluttered State (Phase 2B)
  console.log('\n[TEST 2] Verifying Header Brand Identity & Elements (Phase 2B)...');
  const headerTextContent = await evaluate('document.querySelector(".gfl-header")?.textContent');
  const hasExtraTextInHeader = headerTextContent.includes('Clean. Care. Class.');
  const logoSrc = await evaluate('document.querySelector(".gfl-header .gfl-logo-img")?.getAttribute("src")');
  const logoAlt = await evaluate('document.querySelector(".gfl-header .gfl-logo-img")?.getAttribute("alt")');
  
  testResults.push({
    test: 'Header Free of Tagline / Slogan Clutter ("Clean. Care. Class.")',
    pass: !hasExtraTextInHeader,
    details: hasExtraTextInHeader ? 'FAILED: Found slogan in header' : 'PASSED: Clean logo only'
  });
  testResults.push({
    test: 'Header Logo Asset Verified',
    pass: logoSrc === 'assets/garment-fix-logo.jpg' && (logoAlt === 'Garment Fix Laundry' || logoAlt === 'Garment Fix Laundry Logo'),
    details: `src: ${logoSrc}, alt: ${logoAlt}`
  });

  // TEST 3: All Images Loaded Successfully
  console.log('\n[TEST 3] Verifying Image Asset Loading & Broken Link Check...');
  await evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await sleep(1000);
  await evaluate('window.scrollTo(0, 0)');
  await sleep(500);

  const imageReport = await evaluate(`
    Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.getAttribute('src'),
      loaded: img.complete && img.naturalWidth > 0,
      width: img.naturalWidth,
      height: img.naturalHeight,
      alt: img.alt
    }))
  `);

  const allImagesLoaded = imageReport.every(img => img.loaded);
  testResults.push({
    test: 'All Images Complete & Non-Zero Dimensions',
    pass: allImagesLoaded,
    details: imageReport.map(img => `${img.src}: ${img.loaded ? 'OK (' + img.width + 'x' + img.height + ')' : 'FAILED'}`).join('; ')
  });

  // TEST 4: Pricing Table Verification (All 20 Items Exact)
  console.log('\n[TEST 4] Verifying Pricing Table (20 Items Exact & Snacks shoes preservation)...');
  const priceRows = await evaluate(`
    Array.from(document.querySelectorAll('#gflPriceTable tbody tr:not(#gflPriceNoMatchRow)')).map(r => ({
      num: r.children[0]?.textContent.trim(),
      desc: r.children[1]?.textContent.trim(),
      price: r.children[2]?.textContent.trim(),
      cat: r.getAttribute('data-cat')
    }))
  `);

  const countIs20 = priceRows.length === 20;
  const item6 = priceRows.find(r => r.num === '06');
  const isItem6SnacksShoes = item6 && item6.desc.includes('Snacks shoes') && item6.price === '₦2,200';
  const item1WhiteAgbada = priceRows.find(r => r.num === '01');
  const isItem1Correct = item1WhiteAgbada && item1WhiteAgbada.desc === 'White Agbada' && item1WhiteAgbada.price === '₦3,700';

  testResults.push({
    test: 'Pricing Table Count',
    pass: countIs20,
    details: `Total items: ${priceRows.length} (Expected 20)`
  });
  testResults.push({
    test: 'Item 01 White Agbada Rate',
    pass: isItem1Correct,
    details: `${item1WhiteAgbada?.desc}: ${item1WhiteAgbada?.price}`
  });
  testResults.push({
    test: 'Item 06 Snacks shoes Preserved & Flagged',
    pass: isItem6SnacksShoes,
    details: `${item6?.desc}: ${item6?.price}`
  });

  // TEST 5: Responsive Viewports & Horizontal Overflow Check (Phase 9)
  console.log('\n[TEST 5] Testing Responsive Layouts across 6 Viewports (Phase 9)...');
  const viewports = [
    { name: '360px mobile', width: 360, height: 740 },
    { name: '390px mobile', width: 390, height: 844 },
    { name: '430px mobile', width: 430, height: 932 },
    { name: '768px tablet', width: 768, height: 1024 },
    { name: '1024px laptop', width: 1024, height: 768 },
    { name: '1440px desktop', width: 1440, height: 900 }
  ];

  for (const vp of viewports) {
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width < 768
    });
    await sleep(300);

    const overflowCheck = await evaluate(`
      ({
        docWidth: document.documentElement.scrollWidth,
        winWidth: window.innerWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        mobileToggleVisible: window.getComputedStyle(document.getElementById('gflMobileToggle')).display !== 'none',
        navMenuVisible: window.getComputedStyle(document.getElementById('gflNavMenu')).display !== 'none'
      })
    `);

    testResults.push({
      test: `Viewport ${vp.name} (${vp.width}x${vp.height}) Layout Check`,
      pass: !overflowCheck.hasHorizontalOverflow,
      details: `scrollWidth: ${overflowCheck.docWidth}px, innerWidth: ${overflowCheck.winWidth}px, overflow: ${overflowCheck.hasHorizontalOverflow ? 'FAIL' : 'NONE'}, mobileToggle: ${overflowCheck.mobileToggleVisible ? 'VISIBLE' : 'HIDDEN'}`
    });
  }

  // Reset to desktop viewport for remaining interaction tests
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(300);

  // TEST 6: Mobile Menu Toggle Interaction
  console.log('\n[TEST 6] Testing Mobile Menu Toggle Interaction...');
  // Switch to mobile viewport
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await sleep(300);

  const menuOpenTest = await evaluate(`
    (() => {
      const toggle = document.getElementById('gflMobileToggle');
      const menu = document.getElementById('gflNavMenu');
      toggle.click();
      const opened = menu.classList.contains('open') && toggle.getAttribute('aria-expanded') === 'true';
      // Click a link inside
      const firstLink = menu.querySelector('a');
      firstLink.click();
      const closedAfterClick = !menu.classList.contains('open') && toggle.getAttribute('aria-expanded') === 'false';
      return { opened, closedAfterClick };
    })()
  `);

  testResults.push({
    test: 'Mobile Drawer Menu Opens on Toggle',
    pass: menuOpenTest.opened,
    details: `Toggled open: ${menuOpenTest.opened}`
  });
  testResults.push({
    test: 'Mobile Drawer Closes on Nav Anchor Click',
    pass: menuOpenTest.closedAfterClick,
    details: `Closed on link click: ${menuOpenTest.closedAfterClick}`
  });

  // Reset back to desktop
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(300);

  // TEST 7: Pricing Table Filtering & Search
  console.log('\n[TEST 7] Testing Pricing Table Search & Filter Pills...');
  const searchTest = await evaluate(`
    (() => {
      const search = document.getElementById('priceSearchInput');
      const noMatch = document.getElementById('gflPriceNoMatchRow');
      
      // Filter by 'Traditional' pill
      const tradPill = document.querySelector('.gfl-cat-btn[data-category="traditional"]') || document.querySelector('.gfl-pill-btn[data-category="traditional"]');
      if (tradPill) tradPill.click();
      const visibleTrad = Array.from(document.querySelectorAll('#gflPriceTable tbody tr:not(#gflPriceNoMatchRow)'))
        .filter(r => r.style.display !== 'none').length;

      // Filter by search query
      search.value = 'Duvet';
      search.dispatchEvent(new Event('input'));
      const allPill = document.querySelector('.gfl-cat-btn[data-category="all"]') || document.querySelector('.gfl-pill-btn[data-category="all"]');
      if (allPill) allPill.click();
      const visibleDuvet = Array.from(document.querySelectorAll('#gflPriceTable tbody tr:not(#gflPriceNoMatchRow)'))
        .filter(r => r.style.display !== 'none').length;

      // Unmatched query
      search.value = 'NonExistentGarmentXYZ';
      search.dispatchEvent(new Event('input'));
      const noMatchShown = noMatch && noMatch.style.display !== 'none';

      // Reset
      search.value = '';
      search.dispatchEvent(new Event('input'));
      if (allPill) allPill.click();

      return { visibleTrad, visibleDuvet, noMatchShown };
    })()
  `);

  testResults.push({
    test: 'Pricing Category Filter (Traditional Wear)',
    pass: searchTest.visibleTrad > 0 && searchTest.visibleTrad < 20,
    details: `Traditional items filtered: ${searchTest.visibleTrad}`
  });
  testResults.push({
    test: 'Pricing Search Filter ("Duvet")',
    pass: searchTest.visibleDuvet === 1,
    details: `Duvet items matched: ${searchTest.visibleDuvet}`
  });
  testResults.push({
    test: 'Pricing Table Empty State on Unmatched Query',
    pass: searchTest.noMatchShown,
    details: `No match banner display: ${searchTest.noMatchShown}`
  });

  // TEST 8: Pickup Booking Form Validation & WhatsApp URI Generator (Phase 7D & 7E)
  console.log('\n[TEST 8] Testing Pickup Booking Form Validation & WhatsApp URL Generator...');
  const formValidationTest = await evaluate(`
    (() => {
      const form = document.getElementById('gflPickupForm');
      const nameInp = document.getElementById('bookingName');
      const phoneInp = document.getElementById('bookingPhone');
      const addrInp = document.getElementById('bookingAddress');
      const areaInp = document.getElementById('bookingArea');
      const dateInp = document.getElementById('bookingDate');
      const timeInp = document.getElementById('bookingTime');
      const servInp = document.getElementById('bookingService');
      const itemsInp = document.getElementById('bookingItems');
      const submitBtn = document.getElementById('bookingSubmitBtn');

      // 1. Submit empty form
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      const emptyValidationPass = nameInp.classList.contains('invalid') && 
                                  phoneInp.classList.contains('invalid') &&
                                  addrInp.classList.contains('invalid');

      // 2. Fill with invalid phone
      nameInp.value = 'Dr. Segun Adeleke';
      phoneInp.value = '12345'; // too short / invalid Nigerian prefix
      addrInp.value = '12 Alagbaka Estate Road';
      areaInp.value = 'Alagbaka';
      dateInp.value = '2026-11-01';
      timeInp.value = 'Morning (8:30 AM – 11:30 AM)';
      servInp.value = 'Wash, Dry & Fold';
      itemsInp.value = '15';

      form.dispatchEvent(new Event('submit', { cancelable: true }));
      const invalidPhoneCaught = phoneInp.classList.contains('invalid');

      // 3. Correct phone number
      phoneInp.value = '0806 306 3559';
      phoneInp.dispatchEvent(new Event('input'));
      const phoneErrorCleared = !phoneInp.classList.contains('invalid');

      // 4. Check WhatsApp Message Preview text
      const previewText = document.getElementById('whatsappMessagePreview')?.textContent;
      const previewContainsData = previewText.includes('Dr. Segun Adeleke') &&
                                  previewText.includes('0806 306 3559') &&
                                  previewText.includes('Alagbaka') &&
                                  previewText.includes('15');

      // 5. Submit valid form and check generated fallback link
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      const fallbackLink = document.getElementById('bookingFallbackLink')?.href;
      const fallbackContainsWhatsApp = fallbackLink && fallbackLink.includes('wa.me/2348063063559') &&
                                      fallbackLink.includes(encodeURIComponent('Dr. Segun Adeleke'));

      return {
        emptyValidationPass,
        invalidPhoneCaught,
        phoneErrorCleared,
        previewContainsData,
        fallbackContainsWhatsApp,
        fallbackLink
      };
    })()
  `);

  testResults.push({
    test: 'Form Required Fields Validation (Empty Check)',
    pass: formValidationTest.emptyValidationPass,
    details: `Empty fields flagged invalid: ${formValidationTest.emptyValidationPass}`
  });
  testResults.push({
    test: 'Form Nigerian Phone Format Validation',
    pass: formValidationTest.invalidPhoneCaught,
    details: `Invalid phone caught: ${formValidationTest.invalidPhoneCaught}, cleared on valid input: ${formValidationTest.phoneErrorCleared}`
  });
  testResults.push({
    test: 'Live WhatsApp Message Preview Real-Time Sync',
    pass: formValidationTest.previewContainsData,
    details: `Preview dynamically updated with form state: ${formValidationTest.previewContainsData}`
  });
  testResults.push({
    test: 'WhatsApp Dispatch URL & Fallback Link Generation',
    pass: formValidationTest.fallbackContainsWhatsApp,
    details: formValidationTest.fallbackLink
  });

  // TEST 9: FAQ Accordion Expand & Collapse (Phase 7G)
  console.log('\n[TEST 9] Testing FAQ Accordion Semantics and State Transitions...');
  const accordionTest = await evaluate(`
    (() => {
      const firstItem = document.querySelector('.gfl-faq-item') || document.querySelector('.gfl-accordion-item');
      if (!firstItem) return { initialExpanded: 'false', openExpanded: 'false', openActive: false, closedExpanded: 'false', closedActive: false };
      const btn = firstItem.querySelector('.gfl-faq-question') || firstItem.querySelector('.gfl-accordion-btn');
      const content = firstItem.querySelector('.gfl-faq-answer') || firstItem.querySelector('.gfl-accordion-content');

      const initialExpanded = btn ? btn.getAttribute('aria-expanded') : 'false';
      
      // Click open
      if (btn) btn.click();
      const openExpanded = btn ? btn.getAttribute('aria-expanded') : 'false';
      const openActive = firstItem.classList.contains('open') || firstItem.classList.contains('active');
      const contentHeightOpen = content ? content.style.maxHeight : '';

      // Click close
      if (btn) btn.click();
      const closedExpanded = btn ? btn.getAttribute('aria-expanded') : 'false';
      const closedActive = firstItem.classList.contains('open') || firstItem.classList.contains('active');

      return {
        initialExpanded,
        openExpanded,
        openActive,
        contentHeightOpen,
        closedExpanded,
        closedActive
      };
    })()
  `);

  testResults.push({
    test: 'FAQ Accordion Opens & Sets aria-expanded="true"',
    pass: accordionTest.openExpanded === 'true' && accordionTest.openActive,
    details: `open: ${accordionTest.openExpanded}, active class: ${accordionTest.openActive}, maxHeight: ${accordionTest.contentHeightOpen}`
  });
  testResults.push({
    test: 'FAQ Accordion Closes & Sets aria-expanded="false"',
    pass: accordionTest.closedExpanded === 'false' && !accordionTest.closedActive,
    details: `closed: ${accordionTest.closedExpanded}, active class: ${accordionTest.closedActive}`
  });

  // TEST 10: Verified Testimonials & Google Trust Link
  console.log('\n[TEST 10] Verifying Customer Testimonials & Verified Google Link...');
  const reviewQuotes = await evaluate(`
    Array.from(document.querySelectorAll('.gfl-review-card')).map(c => ({
      author: (c.querySelector('.gfl-reviewer-name') || c.querySelector('.gfl-review-author'))?.textContent.trim(),
      quote: (c.querySelector('.gfl-review-text') || c.querySelector('.gfl-review-quote'))?.textContent.trim()
    }))
  `);

  const rebecca = reviewQuotes.find(r => r.author === 'Rebecca Daniel');
  const richLinks = reviewQuotes.find(r => r.author === 'RICH LINKS');
  const googleLink = await evaluate('document.querySelector("a[href*=\'share.google\']")?.href');

  testResults.push({
    test: 'Authentic Customer Testimonials Displayed',
    pass: reviewQuotes.length >= 6 && !!rebecca && !!richLinks,
    details: `Total verified quotes: ${reviewQuotes.length}; Rebecca Daniel: "${rebecca?.quote}"; RICH LINKS: "${richLinks?.quote}"`
  });
  testResults.push({
    test: 'Official Google Business Profile Link Verified',
    pass: googleLink === 'https://share.google/d9FAOVOUMlC2maJrE',
    details: googleLink
  });

  // TEST 11: Console Errors and Network Failures
  console.log('\n[TEST 11] Checking Browser Console Errors & Failed Network Requests...');
  const consoleErrors = consoleMessages.filter(m => m.type === 'error');
  testResults.push({
    test: 'Zero Browser Console Errors',
    pass: consoleErrors.length === 0,
    details: consoleErrors.length === 0 ? 'CLEAN: 0 errors' : JSON.stringify(consoleErrors)
  });
  testResults.push({
    test: 'Zero 4xx/5xx Failed Network Requests',
    pass: networkErrors.length === 0,
    details: networkErrors.length === 0 ? 'CLEAN: All resources 200 OK' : JSON.stringify(networkErrors)
  });

  // Print Summary Table
  console.log('\n============================================================');
  console.log('                 AUTOMATED QA TEST RESULTS                  ');
  console.log('============================================================');
  let passCount = 0;
  testResults.forEach((t, idx) => {
    const status = t.pass ? '✓ PASS' : '✗ FAIL';
    if (t.pass) passCount++;
    console.log(`[${status}] ${idx + 1}. ${t.test}`);
    console.log(`       Details: ${t.details}`);
  });
  console.log('============================================================');
  console.log(`Summary: ${passCount} of ${testResults.length} tests passed (${Math.round(passCount / testResults.length * 100)}%)`);
  console.log('============================================================\n');

  // Close Chrome
  ws.close();
  chromeProcess.kill();
  process.exit(passCount === testResults.length ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
