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
    // Allow requests with no origin (Postman, curl) only in dev
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
app.use(express.static(path.join(__dirname, 'public')));

/* ─── Simple in-memory rate limiter (IP · 5 requests / 15 min) ─── */
const rateMap = new Map();
const RATE_LIMIT   = 5;
const RATE_WINDOW  = 15 * 60 * 1000; // 15 minutes in ms

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
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
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

/* ─── Email validation helper ─── */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/* ─── Contact form endpoint ─── */
app.post('/api/contact', rateLimiter, async (req, res) => {
  const { name, email, phone, company, subject, message, honeypot } = req.body;

  // Honeypot: if the hidden field is filled, it's a bot
  if (honeypot) {
    return res.status(200).json({ message: 'Thank you for your message!' }); // silent discard
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

  // Sanitise inputs before embedding in email HTML
  const safeName    = escapeHtml(name.trim().slice(0, 100));
  const safeEmail   = escapeHtml(email.trim().slice(0, 200));
  const safePhone   = escapeHtml((phone   || '').trim().slice(0, 30));
  const safeCompany = escapeHtml((company || '').trim().slice(0, 150));
  const safeSubject = escapeHtml(subject.trim().slice(0, 200));
  const safeMessage = escapeHtml(message.trim().slice(0, 3000));

  try {
    await resend.emails.send({
      from:     process.env.EMAIL_FROM,
      to:       process.env.EMAIL_TO,
      replyTo:  safeEmail,
      subject:  `New Enquiry: ${safeSubject}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <div style="background:#F7B538;padding:20px 30px;">
            <h2 style="margin:0;color:#000;">New Enquiry – Sri Balaji Industries</h2>
          </div>
          <div style="padding:30px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;font-weight:bold;width:120px;">Name</td><td style="padding:8px 0;">${safeName}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;">Email</td><td style="padding:8px 0;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;">Phone</td><td style="padding:8px 0;">${safePhone || '<em>Not provided</em>'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;">Company</td><td style="padding:8px 0;">${safeCompany || '<em>Not provided</em>'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;">Subject</td><td style="padding:8px 0;">${safeSubject}</td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <h3 style="color:#3A6B35;">Message</h3>
            <p style="white-space:pre-wrap;background:#f9f9f9;padding:15px;border-radius:4px;">${safeMessage}</p>
            <p style="margin-top:20px;font-size:0.85rem;color:#777;">
              To reply, simply hit Reply – the visitor's email is set as Reply-To.
            </p>
          </div>
          <div style="background:#2D2D2D;padding:15px 30px;text-align:center;">
            <p style="color:#aaa;margin:0;font-size:0.8rem;">Sri Balaji Industries · D.No. 5-63A, Amarapuram – 515281, India</p>
          </div>
        </div>
      `,
    });

    res.status(200).json({ message: 'Thank you for your enquiry! We will get back to you within one business day.' });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ error: 'Sorry, there was a problem sending your message. Please call us or try again later.' });
  }
});

/* ─── Health check (for Render uptime monitoring) ─── */
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

/* ─── Fallback: serve index.html for any unknown GET ─── */
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ─── Start ─── */
app.listen(PORT, () => console.log(`Sri Balaji Industries server running on port ${PORT}`));
