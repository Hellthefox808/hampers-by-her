/* ═══════════════════════════════════════════════════════
   HAMPERS BY HER — Interactive JavaScript
   ═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Nav Scroll Effect ──
  const nav = document.getElementById('main-nav');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    if (currentScroll > 40) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
  }, { passive: true });

  // ── Mobile Menu ──
  const menuBtn = document.getElementById('mobile-menu-btn');
  const menuClose = document.getElementById('mobile-menu-close');
  const mobileMenu = document.getElementById('mobile-menu');
  const overlay = mobileMenu?.querySelector('.mobile-menu__overlay');
  const mobileLinks = mobileMenu?.querySelectorAll('.mobile-menu__link');

  function openMenu() {
    mobileMenu?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    mobileMenu?.classList.remove('open');
    document.body.style.overflow = '';
  }

  menuBtn?.addEventListener('click', openMenu);
  menuClose?.addEventListener('click', closeMenu);
  overlay?.addEventListener('click', closeMenu);
  mobileLinks?.forEach(link => link.addEventListener('click', closeMenu));

  // ── Scroll Reveal (Intersection Observer) ──
  const revealElements = document.querySelectorAll(
    '.product-card, .bespoke-card, .builder, .whatsapp-card, .stories-grid'
  );

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  revealElements.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 700ms cubic-bezier(0.32, 0.72, 0, 1), transform 700ms cubic-bezier(0.32, 0.72, 0, 1)';
    revealObserver.observe(el);
  });

  // ── Instagram Grid (Generate Gradient Placeholders) ──
  const igGrid = document.getElementById('ig-grid');
  const igGradients = [
    'linear-gradient(135deg, #F4ECE8 0%, #E8D5C4 40%, #C89D42 100%)',
    'linear-gradient(135deg, #FDFBF7 0%, #F0E2D8 50%, #4A1E29 100%)',
    'linear-gradient(135deg, #E2D1B3 0%, #D4B896 40%, #8B6914 100%)',
    'linear-gradient(135deg, #F6EFEA 0%, #E8CDB8 50%, #6E4233 100%)',
  ];

  if (igGrid) {
    igGradients.forEach((gradient, i) => {
      const item = document.createElement('div');
      item.className = 'ig-item';
      item.innerHTML = `<div class="ig-item__gradient" style="background: ${gradient}"></div>`;
      item.style.animationDelay = `${i * 100}ms`;
      igGrid.appendChild(item);
    });
  }

  // ── Testimonial Carousel (Dot Clicks) ──
  const quotes = [
    {
      text: '"It didn\'t feel like a hamper. It felt like a letter I could keep on the shelf for a year."',
      author: '— Anaya M., Pune · for her sister\'s wedding'
    },
    {
      text: '"The wax seal alone made my mother cry. Everything inside was secondary to that detail."',
      author: '— Priya K., Mumbai · Mother\'s Day'
    },
    {
      text: '"I ordered 60 for our team offsite. Every box arrived as if it were the only one made."',
      author: '— Rohan S., Bengaluru · Corporate retreat'
    }
  ];

  const quoteEl = document.querySelector('.stories__quote');
  const authorEl = document.querySelector('.stories__author');
  const dots = document.querySelectorAll('.quote-dot');

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      if (index < quotes.length && quoteEl && authorEl) {
        // Fade transition
        quoteEl.style.opacity = '0';
        authorEl.style.opacity = '0';

        setTimeout(() => {
          quoteEl.innerHTML = quotes[index].text;
          authorEl.textContent = quotes[index].author;
          quoteEl.style.opacity = '1';
          authorEl.style.opacity = '1';
        }, 300);

        dots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      }
    });
  });

  if (quoteEl) {
    quoteEl.style.transition = 'opacity 300ms ease';
    authorEl.style.transition = 'opacity 300ms ease';
  }

  // ── Quick Add Button Feedback ──
  const quickAddBtns = document.querySelectorAll('.btn--outline');
  quickAddBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const originalText = this.textContent;
      this.textContent = '✓ Added';
      this.style.background = '#2E5A44';
      this.style.color = '#fff';
      this.style.borderColor = '#2E5A44';

      setTimeout(() => {
        this.textContent = originalText;
        this.style.background = '';
        this.style.color = '';
        this.style.borderColor = '';
      }, 1800);
    });
  });

  // ── Smooth Anchor Scrolling (for mobile bottom bar) ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Occasion Chip Hover Sound-like Micro-interaction ──
  const chips = document.querySelectorAll('.occasion-chip');
  chips.forEach(chip => {
    chip.addEventListener('mouseenter', () => {
      chip.style.transform = 'translateY(-2px) scale(1.02)';
    });
    chip.addEventListener('mouseleave', () => {
      chip.style.transform = '';
    });
  });

});
