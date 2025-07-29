// Mobile Menu Toggle
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navUl = document.querySelector('nav ul');
mobileMenuBtn.addEventListener('click', function() {
  const isExpanded = navUl.classList.toggle('show');
  mobileMenuBtn.setAttribute('aria-expanded', isExpanded);
});

// Smooth Scrolling for Anchor Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    
    const targetId = this.getAttribute('href');
    const targetElement = document.querySelector(targetId);
    
    if (targetElement) {
      window.scrollTo({
        top: targetElement.offsetTop - 100,
        behavior: 'smooth'
      });
      
      // Close mobile menu if open
      navUl.classList.remove('show');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
    }
  });
});

// Sticky Header with Scroll Behavior
let lastScrollTop = 0;
const header = document.querySelector("header");

window.addEventListener("scroll", function() {
  const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
  
  if (currentScroll > lastScrollTop) {
    // Scrolling down
    header.style.top = "-100px";
  } else {
    // Scrolling up
    header.style.top = "0";
  }
  
  // Add shadow when scrolled
  if (currentScroll > 50) {
    header.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
  } else {
    header.style.boxShadow = "none";
  }
  
  lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
});

// Form Submission Handling
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const form = e.target;
    
    // Show loading state
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-block';
    submitBtn.disabled = true;
    
    const formData = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      company: form.company ? form.company.value.trim() : '',
      subject: form.subject.value.trim(),
      message: form.message.value.trim()
    };

    try {
      const response = await fetch('https://sri-balaji-industries.onrender.com/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message.');
      }
      
      alert(result.message);
      form.reset();
    } catch (error) {
      alert('Error: ' + error.message);
      console.error('Error sending contact form:', error);
    } finally {
      // Hide loading state
      btnText.style.display = 'inline-block';
      btnLoading.style.display = 'none';
      submitBtn.disabled = false;
    }
  });
}

// Animated Counter for Stats Section
function animateCounter(element, target, duration = 2000) {
  const start = 0;
  const increment = target / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      clearInterval(timer);
      current = target;
    }
    element.textContent = Math.floor(current) + (element.getAttribute('data-suffix') || '');
  }, 16);
}

// Trigger counters when stats section is visible
function checkIfInView() {
  const statsSection = document.querySelector('.stats');
  if (!statsSection) return;
  
  const rect = statsSection.getBoundingClientRect();
  const isVisible = (rect.top <= window.innerHeight && rect.bottom >= 0);
  
  if (isVisible && !statsSection.classList.contains('counted')) {
    statsSection.classList.add('counted');
    
    document.querySelectorAll('.stat-item h3').forEach(counter => {
      const target = parseInt(counter.textContent);
      counter.textContent = '0';
      animateCounter(counter, target);
    });
  }
}

// Check on scroll and load
window.addEventListener('scroll', checkIfInView);
window.addEventListener('load', checkIfInView);

// Add active class to current section in navigation
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('nav a');

window.addEventListener('scroll', () => {
  let current = '';
  
  sections.forEach(section => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.clientHeight;
    
    if (pageYOffset >= sectionTop - 200) {
      current = section.getAttribute('id');
    }
  });
  
  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${current}`) {
      link.classList.add('active');
    }
  });
}); 