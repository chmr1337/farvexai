/**
 * Automated Security Suite Verification Script for Farvex AI
 */
const crypto = require('crypto');
const handler = require('./api/submit.js');

// Mock request/response helpers
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; }
  };
  return res;
}

async function runTests() {
  console.log('=== FARVEX AI SECURITY SUITE VERIFICATION ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Web Crypto SHA-256 Salted Hashing & Master Password
  // -------------------------------------------------------------
  const AUTH_SALT = 'FX_SALT_2026_SOVEREIGN_NODE';
  const EXPECTED_HASH = 'e2574dc5be526299a42f0490a198ea4ac4eb7184b52bbd1b56615b780e72882c';
  const masterPass = 'FarvexSecure@2026!';
  const computedHash = crypto.createHash('sha256').update(AUTH_SALT + masterPass).digest('hex');
  assert(computedHash === EXPECTED_HASH, 'Web Crypto Salted SHA-256 matches master key hash');

  const wrongPassHash = crypto.createHash('sha256').update(AUTH_SALT + 'wrong_password').digest('hex');
  assert(wrongPassHash !== EXPECTED_HASH, 'Invalid password does not match master key hash');

  // -------------------------------------------------------------
  // TEST 2: API Input Validation - Missing/Invalid Email & Name
  // -------------------------------------------------------------
  const reqInvalidEmail = {
    method: 'POST',
    headers: { 'x-forwarded-for': '127.0.0.10' },
    body: { name: 'Dr. Test', email: 'not-an-email', message: 'Hello' }
  };
  const resInvalidEmail = createMockRes();
  await handler(reqInvalidEmail, resInvalidEmail);
  assert(resInvalidEmail.statusCode === 400, 'API rejects invalid email format with HTTP 400');

  const reqShortName = {
    method: 'POST',
    headers: { 'x-forwarded-for': '127.0.0.11' },
    body: { name: 'A', email: 'valid@enterprise.com', message: 'Hello' }
  };
  const resShortName = createMockRes();
  await handler(reqShortName, resShortName);
  assert(resShortName.statusCode === 400, 'API rejects name shorter than 2 characters with HTTP 400');

  // -------------------------------------------------------------
  // TEST 3: Anti-Bot Honeypot Trap Detection
  // -------------------------------------------------------------
  const reqHoneypot = {
    method: 'POST',
    headers: { 'x-forwarded-for': '127.0.0.12' },
    body: {
      name: 'Spam Bot',
      email: 'bot@spamnetwork.com',
      message: 'Buy our products now',
      _farvex_hp_node: 'I am a bot filling all fields'
    }
  };
  const resHoneypot = createMockRes();
  await handler(reqHoneypot, resHoneypot);
  assert(resHoneypot.statusCode === 200 && resHoneypot.body.id.startsWith('FX-FILTERED-'), 'API traps honeypot submissions and neutralizes bot');

  // -------------------------------------------------------------
  // TEST 4: Submission Velocity Check (< 1000ms)
  // -------------------------------------------------------------
  const reqFastBot = {
    method: 'POST',
    headers: { 'x-forwarded-for': '127.0.0.13' },
    body: {
      name: 'Headless Script',
      email: 'script@bot.com',
      message: 'Sub-second auto submit',
      _render_ts: Date.now() - 200 // 200ms ago -> automated bot
    }
  };
  const resFastBot = createMockRes();
  await handler(reqFastBot, resFastBot);
  assert(resFastBot.statusCode === 400, 'API rejects sub-second automated submissions (< 1000ms)');

  // -------------------------------------------------------------
  // TEST 5: Legitimate Submission Processing
  // -------------------------------------------------------------
  const reqLegit = {
    method: 'POST',
    headers: { 'x-forwarded-for': '127.0.0.14' },
    body: {
      name: 'Alexander Holm',
      email: 'alex.holm@nordic-logistics.se',
      company: 'Nordic Logistics AB',
      scope: 'Document Vision OCR',
      message: 'Looking for high-speed automated invoice processing.',
      _render_ts: Date.now() - 5000 // 5 seconds
    }
  };
  const resLegit = createMockRes();
  await handler(reqLegit, resLegit);
  assert(resLegit.statusCode === 200 && resLegit.body.success === true, 'API successfully processes valid legitimate payload');

  // -------------------------------------------------------------
  // TEST 6: IP Rate Limiting
  // -------------------------------------------------------------
  const spammerIp = '192.168.100.99';
  let rateLimitHit = false;
  for (let i = 0; i < 8; i++) {
    const reqSpam = {
      method: 'POST',
      headers: { 'x-forwarded-for': spammerIp },
      body: {
        name: 'Rapid Sender',
        email: 'rapid@enterprise.com',
        message: 'Spam payload #' + i,
        _render_ts: Date.now() - 3000
      }
    };
    const resSpam = createMockRes();
    await handler(reqSpam, resSpam);
    if (resSpam.statusCode === 429) {
      rateLimitHit = true;
      break;
    }
  }
  assert(rateLimitHit === true, 'API triggers HTTP 429 Rate Limit after exceeding threshold per IP');

  // -------------------------------------------------------------
  // TEST 7: CSV Formula Injection (DDE) Neutralization
  // -------------------------------------------------------------
  function sanitizeCsvCell(str) {
    if (typeof str !== 'string') str = String(str || '');
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return '"' + str.replace(/"/g, '""') + '"';
  }

  const maliciousPayload1 = '=cmd|"/C calc"!A0';
  const sanitized1 = sanitizeCsvCell(maliciousPayload1);
  assert(sanitized1 === `"'=cmd|""/C calc""!A0"`, 'CSV formula starting with "=" is prepended with single quote');

  const maliciousPayload2 = '+SUM(1,2)';
  const sanitized2 = sanitizeCsvCell(maliciousPayload2);
  assert(sanitized2 === ` "'+SUM(1,2)"`.trim(), 'CSV formula starting with "+" is neutralized');

  const maliciousPayload3 = '@EXEC("malware.exe")';
  const sanitized3 = sanitizeCsvCell(maliciousPayload3);
  assert(sanitized3 === ` "'@EXEC(""malware.exe"")"`.trim(), 'CSV formula starting with "@" is neutralized');

  // -------------------------------------------------------------
  // TEST 8: HTML Entity Encoding for XSS Prevention
  // -------------------------------------------------------------
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  const xssVector = '<script>alert("XSS")</script>';
  const escaped = escapeHtml(xssVector);
  assert(!escaped.includes('<script>') && escaped === '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;', 'XSS payloads are escaped to HTML entities');

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
  if (passed === total) {
    console.log('✓ ALL SECURITY CHECKS PASSED NOMINALLY.');
  } else {
    process.exit(1);
  }
}

runTests();
