module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'online', service: 'Farvex AI Inbound Dispatch Serverless Node', version: '2.4.0' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, name, email, company, scope, message, timestamp } = req.body || {};
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required parameters.' });
    }

    const payloadId = 'FX-' + (type === 'booking' ? 'BOOK-' : 'MSG-') + Math.random().toString(36).substring(2, 8).toUpperCase();
    const submissionTime = timestamp || new Date().toISOString();

    // 1. If RESEND_API_KEY environment variable exists, send email via Resend
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
            subject: `[FARVEX ${type ? type.toUpperCase() : 'UPLINK'}] New Transmission from ${name} (${company || 'Enterprise'})`,
            html: `
              <div style="font-family: Arial, sans-serif; background-color: #030712; color: #f1f5f9; padding: 24px; border-radius: 8px;">
                <h2 style="color: #00f0ff; border-bottom: 1px solid #1e293b; padding-bottom: 10px;">? Farvex AI Inbound Transmission</h2>
                <p><strong>Tracking ID:</strong> <code>${payloadId}</code></p>
                <p><strong>Type:</strong> ${type === 'booking' ? '1-on-1 Architecture Consultation' : 'Direct Engineering Uplink'}</p>
                <p><strong>Officer Name:</strong> ${name}</p>
                <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #38bdf8;">${email}</a></p>
                <p><strong>Company:</strong> ${company || 'N/A'}</p>
                <p><strong>Scope:</strong> ${scope || 'General Automation'}</p>
                <div style="background: #0f172a; border-left: 3px solid #00f0ff; padding: 12px; margin-top: 15px;">
                  <p style="margin: 0; color: #cbd5e1;"><strong>Message / Tech Stack:</strong></p>
                  <p style="margin-top: 6px; white-space: pre-wrap;">${message || 'No additional notes.'}</p>
                </div>
                <p style="font-size: 11px; color: #64748b; margin-top: 20px;">Transmission Timestamp: ${submissionTime}</p>
              </div>
            `
          })
        });
      } catch (err) {
        console.error('Failed to send via Resend API:', err);
      }
    }

    // 2. If DISCORD_WEBHOOK or SLACK_WEBHOOK environment variable exists
    if (process.env.DISCORD_WEBHOOK) {
      try {
        await fetch(process.env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `?? **New Farvex AI ${type === 'booking' ? 'Booking' : 'Message'} Received!**\n**Name:** ${name}\n**Email:** ${email}\n**Company:** ${company || 'N/A'}\n**Scope:** ${scope || 'General'}\n**Payload:** ${message || 'N/A'}\n**ID:** \`${payloadId}\``
          })
        });
      } catch (err) {
        console.error('Webhook error:', err);
      }
    }

    return res.status(200).json({
      success: true,
      id: payloadId,
      timestamp: submissionTime,
      recipient: 'farvexai@gmail.com',
      message: 'Transmission successfully processed and logged to Farvex telemetry node.'
    });
  } catch (error) {
    console.error('Inbound submission error:', error);
    return res.status(500).json({ error: 'Internal server error processing transmission' });
  }
}
