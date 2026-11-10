/**
 * Sri Balaji Industries – Server v2.0
 * Resend email API · rate limiting · honeypot · input sanitisation · CORS
 */

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { Resend } = require('resend');

/* ─── Resend client ─── */
const resend = new Resend(process.env.RESEND_API_KEY);

/* ─── App setup ─── */
const app  = express();
const PORT = process.env.PORT || 3001;

// Trust the first proxy hop (required for correct client IP on Render)
app.set('trust proxy', 1);

/* ─── CORS ─── */
const allowedOrigins = [
  process.env.SITE_URL,          // production URL from env
  'http://localhost:3001',        // local dev
  'http://127.0.0.1:3001',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS policy: origin not allowed'));
  },
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

/* ─── Body parsing – cap at 10 KB to block oversized payloads ─── */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/* ─── Static files ─── */
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache static assets for 1 day
  setHeaders: (res, filePath) => {
    // Ensure HTML is revalidated
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

/* ─── In-memory rate limiter with automated cleanup (IP · 5 requests / 15 min) ─── */
const rateMap = new Map();
const RATE_LIMIT   = 5;
const RATE_WINDOW  = 15 * 60 * 1000; // 15 minutes

// Clean up expired entries every 30 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of rateMap.entries()) {
    if (now - rec.start > RATE_WINDOW) {
      rateMap.delete(ip);
    }
  }
}, 30 * 60 * 1000).unref();

function rateLimiter(req, res, next) {
  const ip  = req.ip || 'unknown';
  const now = Date.now();
  const rec = rateMap.get(ip) || { count: 0, start: now };

  if (now - rec.start > RATE_WINDOW) {
    rec.count = 0;
    rec.start = now;
  }

  rec.count += 1;
  rateMap.set(ip, rec);

  if (rec.count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests. Please wait a few minutes before trying again.' });
  }
  next();
}

/* ─── HTML escaping helper (prevents email HTML injection) ─── */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ─── Control character / CRLF stripper (prevents email header injection) ─── */
function stripControlChars(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\r\n\x00-\x1F\x7F]/g, ' ').trim();
}

/* ─── Email validation helper (RFC-compliant simplified check) ─── */
function isValidEmail(email) {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email);
}

/* ─── Contact form endpoint ─── */
app.post('/api/contact', rateLimiter, async (req, res) => {
  const { name, email, phone, company, subject, message, honeypot } = req.body;

  // Honeypot: if filled, quietly succeed to trap bots
  if (honeypot) {
    return res.status(200).json({ message: 'Thank you for your enquiry! We will get back to you soon.' });
  }

  // Server-side validation
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (message.trim().length < 10) {
    return res.status(400).json({ error: 'Message is too short. Please provide more detail.' });
  }

  // Strip headers and control characters
  const cleanSubject = stripControlChars(subject).slice(0, 150);
  const cleanEmail   = stripControlChars(email).slice(0, 200);

  // Sanitise HTML inputs before embedding in template
  const safeName    = escapeHtml(stripControlChars(name).slice(0, 100));
  const safeEmail   = escapeHtml(cleanEmail);
  const safePhone   = escapeHtml(stripControlChars(phone || '').slice(0, 30));
  const safeCompany = escapeHtml(stripControlChars(company || '').slice(0, 100));
  const safeSubject = escapeHtml(cleanSubject);
  const safeMessage = escapeHtml(message.trim().slice(0, 3000));

  try {
    const data = await resend.emails.send({
      from:     process.env.EMAIL_FROM || 'Sri Balaji Industries <onboarding@resend.dev>',
      to:       process.env.EMAIL_TO || 'sribalajiindustries@gmail.com',
      reply_to: cleanEmail,
      replyTo:  cleanEmail, // compatible across Resend SDK versions
      subject:  `New Enquiry: ${cleanSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #F7B538; padding: 24px 30px; text-align: left;">
            <h2 style="margin: 0; color: #111111; font-size: 20px;">New Enquiry &ndash; Sri Balaji Industries</h2>
          </div>
          <div style="padding: 30px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 15px; line-height: 1.5;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold; width: 120px; color: #444;">Name</td>
                <td style="padding: 10px 0; color: #111;">${safeName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #444;">Email</td>
                <td style="padding: 10px 0; color: #111;"><a href="mailto:${safeEmail}" style="color: #3A6B35; text-decoration: none;">${safeEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #444;">Phone</td>
                <td style="padding: 10px 0; color: #111;">${safePhone || '<em>Not provided</em>'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #444;">Company</td>
                <td style="padding: 10px 0; color: #111;">${safeCompany || '<em>Not provided</em>'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #444;">Subject</td>
                <td style="padding: 10px 0; color: #111;">${safeSubject}</td>
              </tr>
            </table>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 24px 0;">
            <h3 style="color: #3A6B35; font-size: 16px; margin: 0 0 12px;">Message Content</h3>
            <div style="background-color: #f9f9f9; padding: 18px; border-radius: 6px; border: 1px solid #f0f0f0; white-space: pre-wrap; font-family: inherit; font-size: 14px; color: #333; line-height: 1.6;">${safeMessage}</div>
            <p style="margin-top: 24px; font-size: 12px; color: #777777;">
              Tip: Replying directly to this email will send your response to <strong>${safeEmail}</strong>.
            </p>
          </div>
          <div style="background-color: #2D2D2D; padding: 16px 30px; text-align: center;">
            <p style="color: #cccccc; margin: 0; font-size: 12px;">Sri Balaji Industries &middot; D.No. 5-63A, Amarapuram &ndash; 515281, India</p>
          </div>
        </div>
      `,
    });

    if (data.error) {
      console.error('Resend API returned an error:', data.error);
      return res.status(500).json({ error: 'Unable to send message at this time. Please contact us via phone or WhatsApp.' });
    }

    return res.status(200).json({ message: 'Thank you for your enquiry! We will get back to you within one business day.' });
  } catch (error) {
    console.error('Unexpected email dispatch error:', error);
    return res.status(500).json({ error: 'Sorry, there was a problem sending your message. Please call us or try again later.' });
  }
});

/* ─── Health check (for Render uptime monitoring) ─── */
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }));

/* ─── Fallback: serve index.html for any unknown GET ─── */
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ─── Start ─── */
app.listen(PORT, () => {
  console.log(`Sri Balaji Industries server running on port ${PORT}`);
});
