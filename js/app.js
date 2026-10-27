/**
 * Garment Fix Laundry - Interactive JavaScript Core
 * Features:
 * 1. Accessible Testimonial Carousel (Keyboard nav, ARIA state, reduced-motion friendly)
 * 2. Layout View Toggle (Editorial Grid vs Carousel)
 * 3. Interactive Price List Category Filtering & Laundry Cost Estimator
 * 4. Mobile Navigation Toggle
 */

document.addEventListener('DOMContentLoaded', () => {
  initTestimonialCarousel();
  initViewToggle();
  initPriceListFilter();
  initMobileMenu();
});

/* ==========================================================================
   1. Accessible Testimonial Carousel
   ========================================================================== */
function initTestimonialCarousel() {
  const track = document.getElementById('carouselTrack');
  const slides = document.querySelectorAll('.carousel-slide');
  const prevBtn = document.getElementById('carouselPrevBtn');
  const nextBtn = document.getElementById('carouselNextBtn');
  const indicatorsContainer = document.getElementById('carouselIndicators');
  const currentIndicator = document.getElementById('carouselCurrentIndex');
  const playPauseBtn = document.getElementById('carouselPlayPause');
  
  if (!track || slides.length === 0) return;

  let currentIndex = 0;
  const totalSlides = slides.length;
  let autoplayTimer = null;
  let isPlaying = false; // default paused for better accessibility

  // Create dot indicators
  indicatorsContainer.innerHTML = '';
  slides.forEach((slide, idx) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `indicator-dot ${idx === 0 ? 'active' : ''}`;
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Go to slide ${idx + 1} of ${totalSlides}`);
    dot.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
    dot.addEventListener('click', () => goToSlide(idx));
    indicatorsContainer.appendChild(dot);
  });

  const dots = indicatorsContainer.querySelectorAll('.indicator-dot');

  function updateSlides() {
    // Transform track
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Update slides ARIA and classes
    slides.forEach((slide, idx) => {
      const isActive = idx === currentIndex;
      slide.classList.toggle('active-slide', isActive);
      slide.setAttribute('aria-hidden', (!isActive).toString());
      if (isActive) {
        slide.removeAttribute('inert');
      } else {
        slide.setAttribute('inert', '');
      }
    });

    // Update dots
    dots.forEach((dot, idx) => {
      const isActive = idx === currentIndex;
      dot.classList.toggle('active', isActive);
      dot.setAttribute('aria-selected', isActive.toString());
    });

    // Update status counter
    if (currentIndicator) {
      currentIndicator.textContent = `${currentIndex + 1} / ${totalSlides}`;
    }

    // Update button states if not looping
    if (prevBtn) prevBtn.setAttribute('aria-label', `Previous testimonial (${currentIndex === 0 ? totalSlides : currentIndex} of ${totalSlides})`);
    if (nextBtn) nextBtn.setAttribute('aria-label', `Next testimonial (${currentIndex + 2 > totalSlides ? 1 : currentIndex + 2} of ${totalSlides})`);
  }

  function goToSlide(index) {
    currentIndex = (index + totalSlides) % totalSlides;
    updateSlides();
  }

  function nextSlide() {
    goToSlide(currentIndex + 1);
  }

  function prevSlide() {
    goToSlide(currentIndex - 1);
  }

  if (prevBtn) prevBtn.addEventListener('click', prevSlide);
  if (nextBtn) nextBtn.addEventListener('click', nextSlide);

  // Keyboard navigation support
  const viewport = document.getElementById('carouselViewport');
  if (viewport) {
    viewport.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlide();
      }
    });
  }

  // Touch Swipe Support
  let touchStartX = 0;
  let touchEndX = 0;
  if (viewport) {
    viewport.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
  }

  function handleSwipe() {
    const threshold = 40;
    if (touchEndX < touchStartX - threshold) {
      nextSlide();
    } else if (touchEndX > touchStartX + threshold) {
      prevSlide();
    }
  }

  // Play / Pause Autoplay controls with reduced-motion respect
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function startAutoplay() {
    if (prefersReducedMotion) return;
    isPlaying = true;
    if (playPauseBtn) {
      playPauseBtn.innerHTML = `<span>⏸</span> Pause`;
      playPauseBtn.setAttribute('aria-label', 'Pause autoplay');
    }
    autoplayTimer = setInterval(nextSlide, 7000);
  }

  function stopAutoplay() {
    isPlaying = false;
    if (playPauseBtn) {
      playPauseBtn.innerHTML = `<span>▶</span> Play`;
      playPauseBtn.setAttribute('aria-label', 'Start autoplay');
    }
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (isPlaying) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    });
  }

  // Pause on mouse hover or keyboard focus
  if (viewport) {
    viewport.addEventListener('mouseenter', () => {
      if (isPlaying) clearInterval(autoplayTimer);
    });
    viewport.addEventListener('mouseleave', () => {
      if (isPlaying) autoplayTimer = setInterval(nextSlide, 7000);
    });
    viewport.addEventListener('focusin', () => {
      if (isPlaying) clearInterval(autoplayTimer);
    });
    viewport.addEventListener('focusout', () => {
      if (isPlaying) autoplayTimer = setInterval(nextSlide, 7000);
    });
  }

  // Initialize first slide view
  updateSlides();
}

/* ==========================================================================
   2. Layout View Toggle (Editorial Grid vs Carousel)
   ========================================================================== */
function initViewToggle() {
  const gridBtn = document.getElementById('viewGridBtn');
  const carouselBtn = document.getElementById('viewCarouselBtn');
  const gridView = document.getElementById('testimonialsGridView');
  const carouselView = document.getElementById('testimonialsCarouselView');

  if (!gridBtn || !carouselBtn || !gridView || !carouselView) return;

  gridBtn.addEventListener('click', () => {
    gridBtn.classList.add('active');
    gridBtn.setAttribute('aria-pressed', 'true');
    carouselBtn.classList.remove('active');
    carouselBtn.setAttribute('aria-pressed', 'false');

    gridView.classList.remove('hidden-view');
    carouselView.classList.add('hidden-view');
  });

  carouselBtn.addEventListener('click', () => {
    carouselBtn.classList.add('active');
    carouselBtn.setAttribute('aria-pressed', 'true');
    gridBtn.classList.remove('active');
    gridBtn.setAttribute('aria-pressed', 'false');

    carouselView.classList.remove('hidden-view');
    gridView.classList.add('hidden-view');
  });
}

/* ==========================================================================
   3. Price List Filtering & Interactive Estimator
   ========================================================================== */
function initPriceListFilter() {
  const filterBtns = document.querySelectorAll('.tab-btn');
  const rows = document.querySelectorAll('.price-table tbody tr');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterCategory = btn.getAttribute('data-filter');

      rows.forEach(row => {
        const rowCategory = row.getAttribute('data-category');
        if (filterCategory === 'all' || rowCategory === filterCategory) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   4. Mobile Menu Toggle
   ========================================================================== */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const navLinks = document.getElementById('primaryNavLinks');

  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', (!isExpanded).toString());
    
    if (!isExpanded) {
      navLinks.style.display = 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '80px';
      navLinks.style.left = '0';
      navLinks.style.right = '0';
      navLinks.style.background = '#0a0d13';
      navLinks.style.padding = '2rem 1.5rem';
      navLinks.style.borderBottom = '1px solid rgba(245, 179, 1, 0.3)';
      navLinks.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
    } else {
      navLinks.style.display = '';
    }
  });
}
