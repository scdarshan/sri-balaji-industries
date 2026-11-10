/* =====================================================
   Sri Balaji Industries – main.js  v2.0
   ===================================================== */

/* ── Dynamic copyright year ───────────────────────── */
const yearEl = document.getElementById('copyrightYear');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ── Mobile menu toggle ───────────────────────────── */
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navUl         = document.querySelector('nav ul');

if (mobileMenuBtn && navUl) {
  mobileMenuBtn.addEventListener('click', function () {
    const isExpanded = navUl.classList.toggle('show');
    mobileMenuBtn.setAttribute('aria-expanded', String(isExpanded));
  });

  // Close menu when any nav link is clicked
  navUl.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navUl.classList.remove('show');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ── Smooth scrolling for anchor links ───────────────*/
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;
    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
    }
  });
});

/* ── Sticky header hide-on-scroll-down ──────────────
   Header stays visible when mobile menu is open.      */
let lastScrollTop = 0;
const header      = document.querySelector('header');

window.addEventListener('scroll', function () {
  // Don't hide header when mobile menu is open
  if (navUl && navUl.classList.contains('show')) return;

  const current = Math.max(window.pageYOffset, 0);
  header.style.top       = current > lastScrollTop && current > 80 ? '-100px' : '0';
  header.style.boxShadow = current > 50
    ? '0 2px 10px rgba(0,0,0,0.15)'
    : 'none';
  lastScrollTop = current;
}, { passive: true });

/* ── Active nav link on scroll ───────────────────── */
const sections  = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('nav a');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 150) {
      current = section.getAttribute('id');
    }
  });
  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}, { passive: true });

/* ── Animated counter ────────────────────────────────
   Reads data-target (number) and data-suffix (string).
   Preserves suffixes like "+", "k+", "%" correctly.   */
function animateCounter(el, target, suffix, duration = 2000) {
  const increment = target / (duration / 16);
  let   current   = 0;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      clearInterval(timer);
      current = target;
    }
    el.textContent = Math.floor(current) + suffix;
  }, 16);
}

function initCounters() {
  const statsSection = document.querySelector('.stats');
  if (!statsSection || statsSection.classList.contains('counted')) return;

  const rect = statsSection.getBoundingClientRect();
  if (rect.top <= window.innerHeight && rect.bottom >= 0) {
    statsSection.classList.add('counted');
    document.querySelectorAll('.counter').forEach(el => {
      const target = parseInt(el.getAttribute('data-target'), 10);
      const suffix = el.getAttribute('data-suffix') || '';
      el.textContent = '0' + suffix;        // reset first
      animateCounter(el, target, suffix);
    });
  }
}

window.addEventListener('scroll', initCounters, { passive: true });
window.addEventListener('load',   initCounters);

/* ── Form helpers ────────────────────────────────── */
function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => {
    el.textContent = '';
    el.style.display = 'none';
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/* ── Contact form submission ─────────────────────── */
const contactForm = document.getElementById('contactForm');
const formStatus  = document.getElementById('formStatus');

if (contactForm) {
  contactForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearFieldErrors();

    const form      = e.target;
    const submitBtn = document.getElementById('submitBtn');
    const btnText   = submitBtn.querySelector('.btn-text');
    const btnLoad   = submitBtn.querySelector('.btn-loading');

    // Client-side validation
    let valid = true;
    const name    = form.name.value.trim();
    const email   = form.email.value.trim();
    const subject = form.subject.value.trim();
    const message = form.message.value.trim();

    if (!name)              { showFieldError('nameError',    'Please enter your name.');          valid = false; }
    if (!isValidEmail(email)) { showFieldError('emailError', 'Please enter a valid email address.'); valid = false; }
    if (!subject)           { showFieldError('subjectError', 'Please enter a subject.');           valid = false; }
    if (message.length < 10){ showFieldError('messageError', 'Please write a bit more detail.');   valid = false; }
    if (!valid) return;

    // Show loading state
    btnText.style.display = 'none';
    btnLoad.style.display = 'inline-flex';
    submitBtn.disabled    = true;
    formStatus.hidden     = true;
    formStatus.className  = 'form-status';

    const payload = {
      name,
      email,
      phone:     form.phone.value.trim(),
      company:   form.company.value.trim(),
      subject,
      message,
      honeypot:  form.honeypot.value,   // server checks this
    };

    try {
      // Use relative URL – works on any host without hard-coding
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Failed to send message.');

      formStatus.textContent = result.message;
      formStatus.classList.add('form-status--success');
      formStatus.hidden = false;
      form.reset();
    } catch (err) {
      formStatus.textContent = err.message || 'Something went wrong. Please call us or try again.';
      formStatus.classList.add('form-status--error');
      formStatus.hidden = false;
    } finally {
      btnText.style.display = 'inline';
      btnLoad.style.display = 'none';
      submitBtn.disabled    = false;
    }
  });
}
