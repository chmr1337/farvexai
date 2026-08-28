/**
 * Farvex AI // Inbound Dispatch Serverless Node
 * Fortified with IP Rate Limiting, CORS Origin Verification,
 * Anti-Bot Honeypot Traps, Input Sanitization & HTML Entity Encoding.
 */

// In-Memory Rate Limiting Cache (IP -> Array of timestamps)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 6; // Max 6 submissions per window per IP

function cleanRateLimitMap() {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, valid);
    }
  }
}

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

// HTML Entity Encoding to prevent HTML Injection in email templates
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

// Discord Webhook Markdown Sanitization
function sanitizeWebhookContent(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/@everyone/gi, '@\u200beveryone')
    .replace(/@here/gi, '@\u200bhere')
    .replace(/<@&?[0-9]+>/g, '[role]')
    .slice(0, 1000);
}

// Allowed CORS Origins
const ALLOWED_ORIGINS = [
  'https://farvex.ai',
  'https://www.farvex.ai',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500'
];

module.exports = async function handler(req, res) {
  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  // CORS Origin check
  const origin = req.headers.origin;
  const isVercelPreview = origin && origin.endsWith('.vercel.app') && origin.includes('farvex');
  if (origin && (ALLOWED_ORIGINS.includes(origin) || isVercelPreview)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', 'https://farvex.ai');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://farvex.ai');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Requested-With, Accept, Accept-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      service: 'Farvex AI Inbound Dispatch Serverless Node',
      version: '3.0.0-hardened',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate Limiting by IP
  const clientIp = req.headers['x-forwarded-for']
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : req.socket?.remoteAddress || 'unknown-client';

  if (Math.random() < 0.05) cleanRateLimitMap();

  if (clientIp !== 'unknown-client' && isRateLimited(clientIp)) {
    res.setHeader('Retry-After', '600');
    return res.status(429).json({
      error: 'Security rate limit exceeded. Please wait 10 minutes before transmitting another telemetry payload.'
    });
  }

  try {
    const body = req.body || {};
    const {
      type,
      name,
      email,
      company,
      scope,
      message,
      timestamp,
      _farvex_hp_node,
      _render_ts
    } = body;

    // 1. Anti-Bot Honeypot Trap Check
    if (_farvex_hp_node && _farvex_hp_node.trim().length > 0) {
      // Bot caught in trap - return 200 to prevent bot learning
      return res.status(200).json({
        success: true,
        id: 'FX-FILTERED-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        message: 'Telemetry payload acknowledged.'
      });
    }

    // 2. Submission Velocity Check (Bots completing form in under 1 second)
    if (_render_ts && typeof _render_ts === 'number') {
      const durationMs = Date.now() - _render_ts;
      if (durationMs < 1000) {
        return res.status(400).json({ error: 'Automated high-velocity submission rejected by security filter.' });
      }
    }

    // 3. Strict Input Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'A valid name parameter (minimum 2 characters) is required.' });
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'A valid email parameter is required.' });
    }

    const trimmedName = name.trim().slice(0, 100);
    const trimmedEmail = email.trim().slice(0, 150);
    const trimmedCompany = (company && typeof company === 'string') ? company.trim().slice(0, 150) : '';
    const trimmedScope = (scope && typeof scope === 'string') ? scope.trim().slice(0, 150) : '';
    const trimmedMessage = (message && typeof message === 'string') ? message.trim().slice(0, 5000) : '';
    const safeType = type === 'booking' ? 'booking' : 'contact';

    // Email format validation (RFC-compliant regex)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }

    const payloadId = 'FX-' + (safeType === 'booking' ? 'BOOK-' : 'MSG-') + Math.random().toString(36).substring(2, 8).toUpperCase();
    const submissionTime = timestamp || new Date().toISOString();

    // HTML-Escaped fields for Email Template
    const safeNameHtml = escapeHtml(trimmedName);
    const safeEmailHtml = escapeHtml(trimmedEmail);
    const safeCompanyHtml = escapeHtml(trimmedCompany) || 'Enterprise';
    const safeScopeHtml = escapeHtml(trimmedScope) || 'General Automation';
    const safeMessageHtml = escapeHtml(trimmedMessage) || 'No additional notes.';
    const safePayloadId = escapeHtml(payloadId);

    // 4. Send Email via Resend API if Key Available
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: 'Farvex AI Inbound <dispatch@farvexai.com>',
            to: ['farvexai@gmail.com'],
            subject: `[FARVEX ${safeType.toUpperCase()}] New Transmission from ${safeNameHtml} (${safeCompanyHtml})`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #030712; color: #f1f5f9; padding: 28px; border-radius: 12px; border: 1px solid rgba(0, 240, 255, 0.2);">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 14px; margin-bottom: 18px;">
                  <h2 style="color: #00f0ff; margin: 0; font-size: 20px;">⚡ Farvex AI Inbound Telemetry</h2>
                  <span style="background: rgba(0,240,255,0.1); color: #00f0ff; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 11px;">${safePayloadId}</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr><td style="padding: 6px 0; color: #94a3b8; width: 140px;"><strong>Transmission Type:</strong></td><td style="color: #ffffff;">${safeType === 'booking' ? '📅 1-on-1 Architecture Consultation' : '✉ Direct Engineering Uplink'}</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;"><strong>Officer Name:</strong></td><td style="color: #ffffff;">${safeNameHtml}</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;"><strong>Work Email:</strong></td><td><a href="mailto:${safeEmailHtml}" style="color: #38bdf8; text-decoration: none;">${safeEmailHtml}</a></td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;"><strong>Organization:</strong></td><td style="color: #ffffff;">${safeCompanyHtml}</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;"><strong>Automation Scope:</strong></td><td style="color: #ffffff;">${safeScopeHtml}</td></tr>
                </table>
                <div style="background: #070d1e; border-left: 3px solid #00f0ff; border-radius: 6px; padding: 14px; margin-top: 18px;">
                  <p style="margin: 0 0 6px 0; color: #94a3b8; font-size: 12px; font-family: monospace; text-transform: uppercase;">Inquiry / Payload Notes:</p>
                  <p style="margin: 0; color: #f1f5f9; white-space: pre-wrap; font-size: 13.5px; line-height: 1.6;">${safeMessageHtml}</p>
                </div>
                <div style="font-size: 11px; color: #64748b; margin-top: 24px; padding-top: 12px; border-top: 1px solid #1e293b; display: flex; justify-content: space-between;">
                  <span>Dispatched: ${submissionTime}</span>
                  <span>Origin: ${escapeHtml(clientIp)}</span>
                </div>
              </div>
            `
          })
        });
      } catch (err) {
        console.error('[FARVEX SECURITY] Resend API Error:', err);
      }
    }

    // 5. Dispatch to Webhooks if Configured
    if (process.env.DISCORD_WEBHOOK) {
      try {
        await fetch(process.env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `⚡ **New Farvex AI ${safeType === 'booking' ? 'Consultation Booking' : 'Uplink Message'}**\n**Name:** ${sanitizeWebhookContent(trimmedName)}\n**Email:** ${sanitizeWebhookContent(trimmedEmail)}\n**Company:** ${sanitizeWebhookContent(trimmedCompany || 'N/A')}\n**Scope:** ${sanitizeWebhookContent(trimmedScope || 'General')}\n**ID:** \`${payloadId}\`\n**Payload:**\n\`\`\`\n${sanitizeWebhookContent(trimmedMessage || 'No notes.')}\n\`\`\``
          })
        });
      } catch (err) {
        console.error('[FARVEX SECURITY] Discord Webhook Error:', err);
      }
    }

    return res.status(200).json({
      success: true,
      id: payloadId,
      timestamp: submissionTime,
      recipient: 'farvexai@gmail.com',
      message: 'Transmission successfully verified, sanitized and logged to Farvex telemetry node.'
    });
  } catch (error) {
    console.error('[FARVEX SECURITY] Inbound Handler Error:', error);
    return res.status(500).json({ error: 'Internal server error processing transmission payload.' });
  }
};
