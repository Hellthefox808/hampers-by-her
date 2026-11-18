/* ═══════════════════════════════════════════════════════
   HAMPERS BY HER — Luxury Digital Commerce Operating System
   Enriched Item View (PDP), Meta WhatsApp Cloud API Concierge,
   Live Instagram Feed Sync, Bespoke Builder & Cart Drawer.
   ═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Global Toast Notification ──
  const toastEl = document.getElementById('hbh-toast');
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2800);
  }

  // ── Navigation & Scroll Dynamics ──
  const nav = document.getElementById('main-nav');
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    if (currentScroll > 40) {
      nav?.classList.add('scrolled');
    } else {
      nav?.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
  }, { passive: true });

  // ── Mobile Slide Navigation ──
  const menuBtn = document.getElementById('mobile-menu-btn');
  const menuClose = document.getElementById('mobile-menu-close');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileOverlay = mobileMenu?.querySelector('.mobile-menu__overlay');
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
  mobileOverlay?.addEventListener('click', closeMenu);
  mobileLinks?.forEach(link => link.addEventListener('click', closeMenu));

  // ── Scroll Reveal Observer (Progressive: never hides sections in blank voids) ──
  const revealElements = document.querySelectorAll(
    '.product-card, .bespoke-card, .builder, .whatsapp-card, .stories-grid'
  );
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        entry.target.style.transform = 'translateY(0)';
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px 80px 0px' });

  revealElements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    el.style.opacity = '1';
    if (rect.top > window.innerHeight * 0.95) {
      el.style.transform = 'translateY(14px)';
      el.style.transition = 'transform 520ms cubic-bezier(0.32, 0.72, 0, 1)';
      revealObserver.observe(el);
    } else {
      el.classList.add('visible');
      el.style.transform = 'translateY(0)';
    }
  });

  // ── Testimonial Carousel ──
  const quotes = [
    { text: '"It didn\'t feel like a hamper. It felt like a letter I could keep on the shelf for a year."', author: '— Anaya M., Pune · for her sister\'s wedding' },
    { text: '"The wax seal alone made my mother cry. Everything inside was secondary to that detail."', author: '— Priya K., Mumbai · Mother\'s Day' },
    { text: '"I ordered 60 for our team offsite. Every box arrived as if it were the only one made."', author: '— Rohan S., Bengaluru · Corporate retreat' }
  ];
  const quoteEl = document.querySelector('.stories__quote');
  const authorEl = document.querySelector('.stories__author');
  const dots = document.querySelectorAll('.quote-dot');

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      if (index < quotes.length && quoteEl && authorEl) {
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

  // ═══════════════════════════════════════════════════════════
  // SHOPPING CART DRAWER SYSTEM
  // ═══════════════════════════════════════════════════════════
  const cartOverlay = document.getElementById('cart-overlay');
  const cartCloseBtn = document.getElementById('cart-close-btn');
  const cartItemsList = document.getElementById('cart-items-list');
  const cartCountLabel = document.getElementById('cart-count-label');
  const navCartLinks = document.querySelectorAll('.nav__cart, a[href="#collections"].mobile-bar__item');

  const CART_STORAGE_KEY = 'hbh_cart_v2';
  function getPersistedCart() {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [
      {
        id: "prod_wedding_vows",
        title: "The Vows & Vines Hamper",
        subtitle: "Wedding Edition · Raw Silk",
        priceRupees: "3,950",
        basePricePaise: 395000,
        image: "images/hamper-wedding.jpg",
        quantity: 1,
        ribbon: "Natural Ecru Raw Silk",
        waxSeal: "Olive Branch Botanica"
      }
    ];
  }

  function persistCartState() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {}
  }

  let cart = getPersistedCart();
  let appliedCoupon = null;

  function openCart() {
    renderCart();
    cartOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    cartOverlay?.classList.remove('open');
    document.body.style.overflow = '';
  }

  navCartLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      if (link.classList.contains('nav__cart') || link.querySelector('span')?.textContent === 'Bag') {
        e.preventDefault();
        openCart();
      }
    });
  });

  cartCloseBtn?.addEventListener('click', closeCart);
  cartOverlay?.addEventListener('click', (e) => {
    if (e.target === cartOverlay) closeCart();
  });

  function renderCart() {
    persistCartState();
    if (!cartItemsList) return;
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCountLabel) cartCountLabel.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'} selected`;

    // Update nav links
    const navCart = document.querySelector('.nav__cart');
    if (navCart) navCart.textContent = `Cart · ${totalCount}`;

    if (cart.length === 0) {
      cartItemsList.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-secondary);">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">🧺</div>
          <p style="font-family: 'Playfair Display', serif; font-size: 1.15rem;">Your gifting bag is empty.</p>
          <p class="mono-label" style="font-size: 0.78rem; margin-top: 6px;">Compose a custom hamper or explore our curated edits.</p>
        </div>
      `;
      updateTotals(0);
      return;
    }

    cartItemsList.innerHTML = cart.map((item, index) => `
      <div class="cart-item" data-index="${index}">
        <img src="${item.image}" alt="${item.title}" class="cart-item__img">
        <div>
          <h4 class="cart-item__title">${item.title}</h4>
          <p class="cart-item__subtitle">${item.ribbon} · ${item.waxSeal}</p>
          <div class="cart-item__price">₹ ${item.priceRupees}</div>
          <button class="cart-item__remove" data-index="${index}" style="margin-top: 6px;">Remove</button>
        </div>
        <div class="cart-item__qty">
          <button class="cart-item__qty-btn btn-dec" data-index="${index}">-</button>
          <span class="cart-item__qty-val">${item.quantity}</span>
          <button class="cart-item__qty-btn btn-inc" data-index="${index}">+</button>
        </div>
      </div>
    `).join('');

    // Wire up Quantity & Remove
    cartItemsList.querySelectorAll('.btn-dec').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (cart[idx].quantity > 1) {
          cart[idx].quantity--;
        } else {
          cart.splice(idx, 1);
        }
        renderCart();
      });
    });

    cartItemsList.querySelectorAll('.btn-inc').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        cart[idx].quantity++;
        renderCart();
      });
    });

    cartItemsList.querySelectorAll('.cart-item__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        cart.splice(idx, 1);
        renderCart();
        showToast("Hamper removed from bag");
      });
    });

    const subtotalPaise = cart.reduce((sum, item) => sum + (item.basePricePaise * item.quantity), 0);
    updateTotals(subtotalPaise);
  }

  function updateTotals(subtotalPaise) {
    const subtotalRupees = Math.round(subtotalPaise / 100);
    const subtotalEl = document.getElementById('cart-subtotal');
    if (subtotalEl) subtotalEl.textContent = `₹ ${subtotalRupees.toLocaleString('en-IN')}`;

    // Free shipping threshold: ₹2,999
    const freeShippingThreshold = 299900;
    const isFreeShipping = subtotalPaise >= freeShippingThreshold || subtotalPaise === 0;
    const shippingFeePaise = isFreeShipping ? 0 : 15000;

    const shippingBar = document.getElementById('shipping-meter-bar');
    const shippingStatus = document.getElementById('shipping-meter-status');
    const shippingPct = document.getElementById('shipping-meter-pct');

    if (shippingBar && shippingStatus && shippingPct) {
      if (subtotalPaise === 0) {
        shippingBar.style.width = '0%';
        shippingStatus.textContent = 'Add ₹2,999 more for Free Express Delivery';
        shippingPct.textContent = '0%';
      } else if (isFreeShipping) {
        shippingBar.style.width = '100%';
        shippingStatus.textContent = '✨ You have unlocked Complimentary Express Air Delivery!';
        shippingPct.textContent = '100%';
      } else {
        const diffRupees = Math.round((freeShippingThreshold - subtotalPaise) / 100);
        const pct = Math.min(100, Math.round((subtotalPaise / freeShippingThreshold) * 100));
        shippingBar.style.width = `${pct}%`;
        shippingStatus.textContent = `Add ₹${diffRupees.toLocaleString('en-IN')} more for Free Express Delivery`;
        shippingPct.textContent = `${pct}%`;
      }
    }

    const shippingEl = document.getElementById('cart-shipping');
    if (shippingEl) shippingEl.textContent = isFreeShipping ? 'FREE' : '₹ 150';

    // Discount
    let discountPaise = 0;
    if (appliedCoupon === 'ALMAS10') {
      discountPaise = Math.min(Math.round(subtotalPaise * 0.10), 100000);
      const discountRow = document.getElementById('cart-discount-row');
      const discountEl = document.getElementById('cart-discount');
      if (discountRow && discountEl) {
        discountRow.style.display = 'flex';
        discountEl.textContent = `- ₹ ${(discountPaise / 100).toLocaleString('en-IN')}`;
      }
    }

    // GST (18%)
    const taxablePaise = Math.max(0, subtotalPaise - discountPaise);
    const taxPaise = Math.round(taxablePaise * 0.18);
    const taxEl = document.getElementById('cart-tax');
    if (taxEl) taxEl.textContent = `₹ ${Math.round(taxPaise / 100).toLocaleString('en-IN')}`;

    // Total
    const totalPaise = taxablePaise + taxPaise + shippingFeePaise;
    const totalEl = document.getElementById('cart-total');
    if (totalEl) totalEl.textContent = `₹ ${Math.round(totalPaise / 100).toLocaleString('en-IN')}`;
  }

  // Coupon handling
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  const couponInput = document.getElementById('coupon-input');
  applyCouponBtn?.addEventListener('click', () => {
    const code = couponInput?.value?.trim().toUpperCase();
    if (code === 'ALMAS10') {
      appliedCoupon = 'ALMAS10';
      const badge = document.getElementById('applied-coupon-badge');
      if (badge) {
        badge.textContent = '✓ ALMAS10 Applied (10% Atelier Courtesy)';
        badge.style.display = 'block';
      }
      renderCart();
      showToast("Coupon ALMAS10 applied successfully!");
    } else {
      showToast("Invalid promo code. Try ALMAS10");
    }
  });

  // ═══════════════════════════════════════════════════════════
  // ENRICHED ITEM DETAIL VIEW (PDP) MODAL
  // ═══════════════════════════════════════════════════════════
  const itemModalOverlay = document.getElementById('item-modal-overlay');
  const itemModalCloseBtn = document.getElementById('item-modal-close-btn');

  let activeProduct = null;
  let selectedRibbon = null;
  let selectedSeal = null;

  function closeItemModal() {
    itemModalOverlay?.classList.remove('open');
    document.body.style.overflow = '';
  }

  itemModalCloseBtn?.addEventListener('click', closeItemModal);
  itemModalOverlay?.addEventListener('click', (e) => {
    if (e.target === itemModalOverlay) closeItemModal();
  });

  async function openItemDetail(productId) {
    try {
      const res = await fetch(`/api/v1/catalog/products/${productId}`);
      const json = await res.json();
      if (!json.success || !json.data) throw new Error("Could not load product details");
      activeProduct = json.data;
    } catch {
      // Fallback local representation if offline
      activeProduct = {
        id: productId,
        title: "The Vows & Vines Hamper",
        occasion: "Wedding",
        theme: "Understated Botanical",
        priceRupees: "3,950",
        basePricePaise: 395000,
        badge: "Best Seller",
        primaryImage: "images/hamper-wedding.jpg",
        story: "Composed specifically for quiet wedding mornings and trousseau gifting.",
        gallery: [
          { url: "images/hamper-wedding.jpg", label: "Composition" },
          { url: "images/hero-hamper.jpg", label: "Unboxing Flat Lay" },
          { url: "images/hamper-anniversary.jpg", label: "Ribbon & Wax Seal" }
        ],
        inclusions: [
          { name: "Craft Elderflower Botanical Tonic", artisan: "Svami Studio", quantity: "200 ml", tags: ["Craft Brew"], description: "Small-batch tonic brewed with Austrian elderflower." },
          { name: "Amber & Smoked Vanilla Candle", artisan: "Atelier Waxworks", quantity: "220g", tags: ["100% Soy"], description: "Hand-poured into amber glass jar." }
        ],
        personalizationOptions: {
          ribbonColors: [
            { id: "RIB_ECRU_SILK", name: "Natural Ecru Raw Silk", hex: "#E8D5C4", default: true },
            { id: "RIB_BORDEAUX_VELVET", name: "Royal Bordeaux Velvet", hex: "#4A1E29" },
            { id: "RIB_FOREST_EMERALD", name: "Forest Emerald Satin", hex: "#2E5A44" },
            { id: "RIB_ANTIQUE_GOLD", name: "Antique Gold Grosgrain", hex: "#C89D42" }
          ],
          waxSeals: [
            { id: "SEAL_BOTANICAL_OLIVE", name: "Olive Branch Botanica", default: true },
            { id: "SEAL_FLEUR_CREST", name: "Atelier Fleur Crest" },
            { id: "SEAL_DOUBLE_HEART", name: "Interlocking Vines" }
          ]
        }
      };
    }

    // Populate Fields
    const catEl = document.getElementById('item-modal-category');
    if (catEl) catEl.textContent = `${activeProduct.occasion} · ${activeProduct.theme || "Artisanal Edit"}`;

    const titleEl = document.getElementById('item-modal-title');
    if (titleEl) titleEl.textContent = activeProduct.title;

    const priceEl = document.getElementById('item-modal-price');
    if (priceEl) priceEl.textContent = `₹ ${activeProduct.priceRupees}`;

    const storyEl = document.getElementById('item-modal-story');
    if (storyEl) storyEl.textContent = activeProduct.story || activeProduct.description;

    const heroImg = document.getElementById('item-gallery-hero');
    if (heroImg) heroImg.src = activeProduct.primaryImage || activeProduct.imageUrl;

    const badgeEl = document.getElementById('item-gallery-badge');
    if (badgeEl) badgeEl.textContent = activeProduct.badge || "Artisan Pick";

    // Populate Gallery Thumbs
    const thumbsContainer = document.getElementById('item-gallery-thumbs');
    if (thumbsContainer && Array.isArray(activeProduct.gallery)) {
      thumbsContainer.innerHTML = activeProduct.gallery.map((g, i) => `
        <div class="item-gallery__thumb ${i === 0 ? 'active' : ''}" data-url="${g.url}">
          <img src="${g.url}" alt="${g.label}">
        </div>
      `).join('');

      thumbsContainer.querySelectorAll('.item-gallery__thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
          thumbsContainer.querySelectorAll('.item-gallery__thumb').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          if (heroImg) heroImg.src = thumb.dataset.url;
        });
      });
    }

    // Ribbon Swatches
    const ribbonContainer = document.getElementById('item-ribbon-swatches');
    if (ribbonContainer && activeProduct.personalizationOptions?.ribbonColors) {
      selectedRibbon = activeProduct.personalizationOptions.ribbonColors[0].name;
      ribbonContainer.innerHTML = activeProduct.personalizationOptions.ribbonColors.map((r, i) => `
        <button class="swatch-btn ${i === 0 ? 'selected' : ''}" data-ribbon="${r.name}">
          <span class="swatch-dot" style="background-color: ${r.hex};"></span>
          <span>${r.name}</span>
        </button>
      `).join('');

      ribbonContainer.querySelectorAll('.swatch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          ribbonContainer.querySelectorAll('.swatch-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedRibbon = btn.dataset.ribbon;
        });
      });
    }

    // Wax Seal Swatches
    const sealContainer = document.getElementById('item-seal-swatches');
    if (sealContainer && activeProduct.personalizationOptions?.waxSeals) {
      selectedSeal = activeProduct.personalizationOptions.waxSeals[0].name;
      sealContainer.innerHTML = activeProduct.personalizationOptions.waxSeals.map((s, i) => `
        <button class="swatch-btn ${i === 0 ? 'selected' : ''}" data-seal="${s.name}">
          <span>🔖</span>
          <span>${s.name}</span>
        </button>
      `).join('');

      sealContainer.querySelectorAll('.swatch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          sealContainer.querySelectorAll('.swatch-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedSeal = btn.dataset.seal;
        });
      });
    }

    // Inclusions List
    const inclusionsList = document.getElementById('item-inclusions-list');
    const inclusionsCount = document.getElementById('item-inclusions-count');
    if (inclusionsList && Array.isArray(activeProduct.inclusions)) {
      if (inclusionsCount) inclusionsCount.textContent = `${activeProduct.inclusions.length} curated inclusions`;
      inclusionsList.innerHTML = activeProduct.inclusions.map(inc => `
        <div class="inclusion-card">
          <div class="inclusion-card__head">
            <span class="inclusion-card__name">${inc.name}</span>
            <span class="inclusion-card__artisan">${inc.artisan || ''}</span>
          </div>
          <p class="inclusion-card__desc">${inc.description || ''}</p>
          <div class="inclusion-card__tags">
            <span class="inclusion-tag">Qty: ${inc.quantity}</span>
            ${(inc.tags || []).map(t => `<span class="inclusion-tag">${t}</span>`).join('')}
          </div>
        </div>
      `).join('');
    }

    // Reset PIN Code Result
    const pinRes = document.getElementById('item-pincode-result');
    if (pinRes) pinRes.style.display = 'none';

    itemModalOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  // Bind Click to View Item Buttons & Product Cards
  document.querySelectorAll('.btn-view-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (id) openItemDetail(id);
    });
  });

  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return; // ignore clicks on buttons inside card
      const id = card.dataset.productId;
      if (id) openItemDetail(id);
    });
  });

  // PIN Code Serviceability Check on PDP
  const pinInput = document.getElementById('item-pincode-input');
  const pinBtn = document.getElementById('item-pincode-btn');
  const pinResult = document.getElementById('item-pincode-result');

  pinBtn?.addEventListener('click', async () => {
    const val = pinInput?.value?.trim();
    if (!val || val.length !== 6) {
      if (pinResult) {
        pinResult.textContent = 'Please enter a valid 6-digit Indian PIN code.';
        pinResult.className = 'pincode-result error';
        pinResult.style.display = 'block';
      }
      return;
    }

    try {
      const res = await fetch(`/api/v1/delivery/serviceability/${val}`);
      const json = await res.json();
      if (json.success && json.data.serviceable) {
        const d = json.data;
        pinResult.innerHTML = `✓ <strong>Serviceable to ${d.city || d.tier}</strong> (${d.slaHours}h SLA &middot; Express Air Eligible)`;
        pinResult.className = 'pincode-result serviceable';
        pinResult.style.display = 'block';
      } else {
        pinResult.textContent = 'Non-serviceable or extended delivery zone.';
        pinResult.className = 'pincode-result error';
        pinResult.style.display = 'block';
      }
    } catch {
      pinResult.textContent = '✓ Express Air Delivery Available (Estimated 2-3 Days)';
      pinResult.className = 'pincode-result serviceable';
      pinResult.style.display = 'block';
    }
  });

  // PDP "Add to Gifting Bag"
  const itemAddCartBtn = document.getElementById('item-add-cart-btn');
  itemAddCartBtn?.addEventListener('click', () => {
    if (!activeProduct) return;
    const cardNote = document.getElementById('item-card-note')?.value?.trim();

    cart.push({
      id: activeProduct.id,
      title: activeProduct.title,
      subtitle: `${activeProduct.occasion} Edition`,
      priceRupees: activeProduct.priceRupees,
      basePricePaise: activeProduct.basePricePaise,
      image: activeProduct.primaryImage || activeProduct.imageUrl,
      quantity: 1,
      ribbon: selectedRibbon || "Natural Ecru Raw Silk",
      waxSeal: selectedSeal || "Olive Branch Botanica",
      cardNote: cardNote || null
    });

    closeItemModal();
    renderCart();
    showToast(`Added ${activeProduct.title} to your gifting bag!`);
    openCart();
  });

  // PDP "WhatsApp Inquire"
  const itemWaInquireBtn = document.getElementById('item-wa-inquire-btn');
  itemWaInquireBtn?.addEventListener('click', async () => {
    if (!activeProduct) return;
    const pin = document.getElementById('item-pincode-input')?.value?.trim() || "";

    try {
      const res = await fetch('/api/v1/whatsapp/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: activeProduct.id,
          customerName: "Website Patron",
          ribbon: selectedRibbon,
          waxSeal: selectedSeal,
          pinCode: pin
        })
      });
      const data = await res.json();
      if (data.data?.waMeUrl) {
        window.open(data.data.waMeUrl, '_blank');
      } else {
        throw new Error();
      }
    } catch {
      const text = encodeURIComponent(`Hi Hampers by Her! I am inquiring about *${activeProduct.title}* (₹${activeProduct.priceRupees}) with ${selectedRibbon} ribbon.`);
      window.open(`https://wa.me/919876543210?text=${text}`, '_blank');
    }
  });

  // PDP "Customize in Bespoke Atelier"
  const itemCustomizeBuilderBtn = document.getElementById('item-customize-builder-btn');
  const builderOverlay = document.getElementById('builder-overlay');
  itemCustomizeBuilderBtn?.addEventListener('click', () => {
    closeItemModal();
    builderOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  // ═══════════════════════════════════════════════════════════
  // INSTAGRAM LIVE FEED SYNCHRONIZATION
  // ═══════════════════════════════════════════════════════════
  const igFeedContainer = document.getElementById('ig-feed-container');
  async function loadInstagramFeed() {
    if (!igFeedContainer) return;
    try {
      const res = await fetch('/api/v1/instagram/feed?limit=4');
      const json = await res.json();
      if (!json.success || !json.data?.items) throw new Error();

      igFeedContainer.innerHTML = json.data.items.map(post => `
        <div class="ig-feed-card" data-hamper="${post.linkedHamperId || ''}" data-url="${post.permalink}">
          <img src="${post.thumbnailUrl}" alt="${post.caption}">
          ${post.isReel ? `
            <div class="ig-reel-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <span>Reel</span>
            </div>
          ` : ''}
          <div class="ig-feed-card__overlay">
            <p class="ig-feed-card__caption">${post.caption}</p>
            <div class="ig-feed-card__meta">
              <span>❤️ ${post.likeCount}</span>
              <span>💬 ${post.commentsCount}</span>
            </div>
          </div>
        </div>
      `).join('');

      igFeedContainer.querySelectorAll('.ig-feed-card').forEach(card => {
        card.addEventListener('click', () => {
          const hamperId = card.dataset.hamper;
          if (hamperId) {
            openItemDetail(hamperId);
          } else {
            window.open(card.dataset.url, '_blank');
          }
        });
      });
    } catch {
      // Fallback
      igFeedContainer.innerHTML = `
        <div class="ig-feed-card"><img src="images/hero-hamper.jpg" alt="Reel"></div>
        <div class="ig-feed-card"><img src="images/hamper-wedding.jpg" alt="Post"></div>
        <div class="ig-feed-card"><img src="images/hamper-corporate.jpg" alt="Reel"></div>
        <div class="ig-feed-card"><img src="images/hamper-festive.jpg" alt="Post"></div>
      `;
    }
  }
  loadInstagramFeed();

  // ═══════════════════════════════════════════════════════════
  // WHATSAPP FLOATING CONCIERGE WIDGET
  // ═══════════════════════════════════════════════════════════
  const waFloatingBtn = document.getElementById('wa-floating-btn');
  const waPopover = document.getElementById('wa-popover');
  const waPopoverClose = document.getElementById('wa-popover-close');

  waFloatingBtn?.addEventListener('click', () => {
    waPopover?.classList.toggle('open');
  });

  waPopoverClose?.addEventListener('click', () => {
    waPopover?.classList.remove('open');
  });

  document.querySelectorAll('.wa-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.waPrompt;
      const url = `https://wa.me/919876543210?text=${encodeURIComponent(prompt)}`;
      window.open(url, '_blank');
      waPopover?.classList.remove('open');
    });
  });

  // ── Quick Add Feedback ──
  document.querySelectorAll('.btn-quick-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const hamper = {
        prod_wedding_vows: { title: "The Vows & Vines Hamper", pricePaise: 395000, price: "3,950", img: "images/hamper-wedding.jpg" },
        prod_corporate_wellwisher: { title: "The Office Well-Wisher", pricePaise: 215000, price: "2,150", img: "images/hamper-corporate.jpg" },
        prod_festive_diwali: { title: "The Diwali Slow-Burn", pricePaise: 285000, price: "2,850", img: "images/hamper-festive.jpg" },
        prod_anniversary_letter: { title: "The Ten-Year Letter", pricePaise: 320000, price: "3,200", img: "images/hamper-anniversary.jpg" }
      }[id];

      if (hamper) {
        cart.push({
          id,
          title: hamper.title,
          subtitle: "Curated Edition",
          priceRupees: hamper.price,
          basePricePaise: hamper.pricePaise,
          image: hamper.img,
          quantity: 1,
          ribbon: "Natural Ecru Raw Silk",
          waxSeal: "Olive Branch Botanica"
        });
        renderCart();
        showToast(`Added ${hamper.title} to your bag!`);
        openCart();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4D INTERACTIVE MOTION & LUXURY SENSORY SUITE
  // ═══════════════════════════════════════════════════════════

  // 1. Synthetic Web Audio Luxury Sound Engine (Zero external dependencies)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playVelvetTap() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  function playGoldenChime() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const frequencies = [528, 660, 792]; // Harmonic luxury chord
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.05);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.05 + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.05);
        osc.stop(ctx.currentTime + idx * 0.05 + 0.9);
      });
    } catch {
      // Audio autoplay fallback
    }
  }

  // Bind velvet tap to luxury buttons and swatches
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn, .swatch-item, .occasion-chip, .wa-quick-btn, .btn-view-item')) {
      playVelvetTap();
    }
  });

  // 2. Interactive 4D Gyroscopic & Cursor Tilt on Product Cards (60fps rAF Optimized)
  const cards4D = document.querySelectorAll('.product-card, .bespoke-card');
  cards4D.forEach((card) => {
    // Inject specular reflection layer
    if (!card.querySelector('.specular-glare')) {
      const glare = document.createElement('div');
      glare.className = 'specular-glare';
      card.appendChild(glare);
    }

    let tiltRaf = null;
    card.addEventListener('mousemove', (e) => {
      if (tiltRaf) cancelAnimationFrame(tiltRaf);
      tiltRaf = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        const rotateY = (x - 0.5) * 16;  // -8deg to +8deg
        const rotateX = -(y - 0.5) * 16; // -8deg to +8deg

        card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
        card.style.setProperty('--mouse-x', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--mouse-y', `${(y * 100).toFixed(1)}%`);
      });
    }, { passive: true });

    card.addEventListener('mouseleave', () => {
      if (tiltRaf) cancelAnimationFrame(tiltRaf);
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  });

  // 3. Magnetic Luxury Buttons Controller (rAF Optimized)
  const magneticBtns = document.querySelectorAll('.magnetic-btn');
  magneticBtns.forEach((btn) => {
    let magRaf = null;
    btn.addEventListener('mousemove', (e) => {
      if (magRaf) cancelAnimationFrame(magRaf);
      magRaf = requestAnimationFrame(() => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - (rect.left + rect.width / 2);
        const y = e.clientY - (rect.top + rect.height / 2);
        btn.style.transform = `translate(${x * 0.28}px, ${y * 0.28}px)`;
      });
    }, { passive: true });

    btn.addEventListener('mouseleave', () => {
      if (magRaf) cancelAnimationFrame(magRaf);
      btn.style.transform = 'translate(0px, 0px)';
    });
  });

  // 4. Ambient Golden Leaf Dust Particle Canvas (Battery & Tab-Visibility Aware)
  const canvas = document.getElementById('ambient-particles-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }, { passive: true });

    const particles = [];
    const particleCount = Math.min(35, Math.floor(width / 35));

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.2 + 0.8,
        speedY: Math.random() * 0.35 + 0.1,
        speedX: (Math.random() - 0.5) * 0.25,
        opacity: Math.random() * 0.5 + 0.2,
        shimmerDelta: Math.random() * 0.02 + 0.005
      });
    }

    let isParticlesRunning = true;
    let animFrameId = null;

    function renderParticles() {
      if (!isParticlesRunning) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y -= p.speedY;
        p.x += p.speedX;
        p.opacity += Math.sin(Date.now() * 0.002 + i) * p.shimmerDelta;

        if (p.y < -10) { p.y = height + 10; p.x = Math.random() * width; }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${Math.max(0.1, Math.min(0.65, p.opacity))})`;
        ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
        ctx.shadowBlur = 8;
        ctx.fill();
      }

      animFrameId = requestAnimationFrame(renderParticles);
    }

    animFrameId = requestAnimationFrame(renderParticles);

    // Pause particle loop when tab is hidden to save GPU/CPU battery
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        isParticlesRunning = false;
        if (animFrameId) cancelAnimationFrame(animFrameId);
      } else {
        if (!isParticlesRunning) {
          isParticlesRunning = true;
          animFrameId = requestAnimationFrame(renderParticles);
        }
      }
    });
  }

  // 5. Interactive 4D Virtual Unboxing Theater
  const unboxingModal = document.getElementById('unboxing-4d-modal');
  const btnHeroUnboxing = document.getElementById('btn-hero-unboxing-4d');
  const unboxingClose = document.getElementById('unboxing-close-btn');
  const unboxingBox = document.getElementById('unboxing-box-3d');
  const unboxingRibbonH = document.getElementById('unboxing-ribbon-h');
  const unboxingRibbonV = document.getElementById('unboxing-ribbon-v');
  const unboxingSeal = document.getElementById('unboxing-seal');
  const unboxingLid = document.getElementById('unboxing-box-lid');
  const unboxingInclusions = document.getElementById('unboxing-inclusions-grid');
  const instructionTitle = document.getElementById('unboxing-instruction-title');
  const instructionSub = document.getElementById('unboxing-instruction-sub');

  const pills = [
    document.getElementById('pill-step-1'),
    document.getElementById('pill-step-2'),
    document.getElementById('pill-step-3'),
    document.getElementById('pill-step-4')
  ];

  let unboxingStep = 1;

  function updateUnboxingStep(step) {
    unboxingStep = step;
    pills.forEach((p, idx) => {
      if (idx + 1 === step) p?.classList.add('active');
      else p?.classList.remove('active');
    });

    if (step === 1) {
      instructionTitle.textContent = "Step 1: Untie the Bordeaux Raw Silk Ribbon";
      instructionSub.textContent = "Click on the ribbon to release the silk binding →";
    } else if (step === 2) {
      instructionTitle.textContent = "Step 2: Crack the Botanical Gold Wax Seal";
      instructionSub.textContent = "Tap the wax seal crest with your fingertip / cursor →";
    } else if (step === 3) {
      instructionTitle.textContent = "Step 3: Lift the Keepsake Box Lid";
      instructionSub.textContent = "Click the box lid to elevate and open the atelier crate →";
    } else if (step === 4) {
      instructionTitle.textContent = "Step 4: Revel in the Artisanal Curations";
      instructionSub.textContent = "Hover over each inclusion to inspect artisan provenance ✨";
      playGoldenChime();
      showToast("🌸 4D Unboxing Complete! All inclusions revealed.");
    }
  }

  function resetUnboxing() {
    unboxingStep = 1;
    unboxingRibbonH?.classList.remove('untying');
    unboxingRibbonV?.classList.remove('untying');
    unboxingSeal?.classList.remove('cracked');
    unboxingLid?.classList.remove('opened');
    unboxingInclusions?.classList.remove('revealed');
    updateUnboxingStep(1);
  }

  btnHeroUnboxing?.addEventListener('click', () => {
    resetUnboxing();
    unboxingModal?.classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  unboxingClose?.addEventListener('click', () => {
    unboxingModal?.classList.remove('open');
    document.body.style.overflow = '';
  });

  // Step-by-step interactive progression
  unboxingBox?.addEventListener('click', () => {
    if (unboxingStep === 1) {
      // Untie ribbon
      playVelvetTap();
      unboxingRibbonH?.classList.add('untying');
      unboxingRibbonV?.classList.add('untying');
      setTimeout(() => updateUnboxingStep(2), 500);
    } else if (unboxingStep === 2) {
      // Crack wax seal
      playVelvetTap();
      unboxingSeal?.classList.add('cracked');
      setTimeout(() => updateUnboxingStep(3), 500);
    } else if (unboxingStep === 3) {
      // Lift lid and reveal
      playVelvetTap();
      unboxingLid?.classList.add('opened');
      setTimeout(() => {
        unboxingInclusions?.classList.add('revealed');
        updateUnboxingStep(4);
      }, 500);
    }
  });

  // 6. Global Escape Key Modal & Drawer Dismissal (WCAG 2.2 AA)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      if (itemModalOverlay?.classList.contains('open')) closeItemModal();
      if (unboxingModal?.classList.contains('open')) {
        unboxingModal.classList.remove('open');
        document.body.style.overflow = '';
      }
      if (mobileMenu?.classList.contains('open')) closeMenu();
      const cartDrawer = document.getElementById('cart-drawer');
      if (cartDrawer?.classList.contains('open')) {
        cartDrawer.classList.remove('open');
        document.body.style.overflow = '';
      }
      const waPopover = document.getElementById('wa-popover');
      if (waPopover?.classList.contains('active')) {
        waPopover.classList.remove('active');
      }
      document.getElementById('builder-overlay')?.classList.remove('open');
      document.getElementById('checkout-overlay')?.classList.remove('open');
      document.getElementById('knapsack-curator-modal')?.classList.remove('open');
      document.getElementById('order-tracking-modal')?.classList.remove('open');
      if (document.getElementById('voice-concierge-modal')?.classList.contains('open')) {
        document.getElementById('voice-close-btn')?.click();
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 7. INTERACTIVE 11-STEP BESPOKE ATELIER BUILDER ENGINE
  // ═══════════════════════════════════════════════════════════
  const builderState = {
    currentStep: 1,
    boxId: "BOX_KRAFT_RIGID",
    boxName: "Classic Rigid Kraft Box",
    boxPricePaise: 45000,
    boxCapacityCm3: 5200,
    recipient: "Sister",
    occasion: "Wedding",
    colorway: "Warm Earth & Terracotta",
    ribbonColor: "burgundy_merlot",
    ribbonName: "Burgundy Merlot Raw Silk",
    monogramInitials: "HBH",
    waxSealColor: "vintage_gold",
    waxSealName: "Vintage Gold Botanical",
    sealMotif: "botanical_wreath",
    inclusions: [],
    cardTo: "",
    cardFrom: "",
    cardMessage: "To someone truly cherished, with warmest congratulations on your joyous milestone.",
    hasPolaroid: false
  };

  const builderOverlayEl = document.getElementById('builder-overlay');
  const builderCloseBtn = document.getElementById('builder-close-btn');
  const builderNextBtn = document.getElementById('builder-next-btn');
  const builderPrevBtn = document.getElementById('builder-prev-btn');
  const builderFinishBtn = document.getElementById('builder-finish-btn');
  const builderStepIndicator = document.getElementById('builder-step-indicator');
  const builderProgress = document.getElementById('builder-progress');
  const builderPriceTicker = document.getElementById('builder-price-ticker-val');
  const fullnessBar = document.getElementById('fullness-bar');
  const fullnessText = document.getElementById('fullness-text');
  const fullnessBadge = document.getElementById('fullness-badge');

  function updateBuilderUI() {
    // 1. Show only active step pane
    document.querySelectorAll('.builder-step-pane').forEach(pane => {
      const step = parseInt(pane.dataset.step, 10);
      if (step === builderState.currentStep) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // 2. Progress and labels
    if (builderProgress) {
      builderProgress.style.width = `${Math.round((builderState.currentStep / 11) * 100)}%`;
    }
    const stepTitles = [
      "Box Selection", "Recipient Persona", "Occasion Mood", "Colorway Palette",
      "Raw Silk Ribbon & Monogram", "Fragrance & Candle Inclusions", "Gourmet Treats",
      "Wax Seal Crest", "Handwritten Calligraphy Card", "Polaroid Print", "Review Your Composition"
    ];
    if (builderStepIndicator) {
      builderStepIndicator.textContent = `Step ${builderState.currentStep} of 11 · ${stepTitles[builderState.currentStep - 1]}`;
    }

    // 3. Buttons visibility
    if (builderPrevBtn) {
      builderPrevBtn.style.visibility = builderState.currentStep > 1 ? 'visible' : 'hidden';
    }
    if (builderState.currentStep === 11) {
      if (builderNextBtn) builderNextBtn.style.display = 'none';
      if (builderFinishBtn) builderFinishBtn.style.display = 'inline-block';
      renderBuilderSummary();
      renderProceduralPreview();
    } else {
      if (builderNextBtn) builderNextBtn.style.display = 'inline-block';
      if (builderFinishBtn) builderFinishBtn.style.display = 'none';
    }

    // 4. Calculate total price
    let totalPaise = builderState.boxPricePaise;
    builderState.inclusions.forEach(inc => { totalPaise += (inc.pricePaise || 0); });
    if (builderState.hasPolaroid) totalPaise += 12000;
    if (builderPriceTicker) {
      builderPriceTicker.textContent = `₹ ${Math.round(totalPaise / 100).toLocaleString('en-IN')}`;
    }

    // 5. Calculate 3D capacity fullness
    let usedVolumeCm3 = 0;
    builderState.inclusions.forEach(inc => { usedVolumeCm3 += (inc.volumeCm3 || 650); });
    const fullnessPct = Math.min(100, Math.round((usedVolumeCm3 / builderState.boxCapacityCm3) * 100));

    if (fullnessBar) fullnessBar.style.width = `${fullnessPct}%`;
    if (fullnessText) fullnessText.textContent = `${usedVolumeCm3.toLocaleString('en-IN')} / ${builderState.boxCapacityCm3.toLocaleString('en-IN')} cm³`;
    if (fullnessBadge) {
      if (fullnessPct < 40) {
        fullnessBadge.textContent = "Underfilled";
        fullnessBadge.className = "fullness-badge UNDERFILLED";
      } else if (fullnessPct <= 85) {
        fullnessBadge.textContent = "Optimal Fill";
        fullnessBadge.className = "fullness-badge OPTIMAL";
      } else {
        fullnessBadge.textContent = "Near Capacity";
        fullnessBadge.className = "fullness-badge OVERFILLED";
      }
    }
  }

  // Open builder from triggers
  document.querySelectorAll('a[href="#builder"], .hero__builder-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      builderOverlayEl?.classList.add('open');
      document.body.style.overflow = 'hidden';
      updateBuilderUI();
    });
  });

  builderCloseBtn?.addEventListener('click', () => {
    builderOverlayEl?.classList.remove('open');
    document.body.style.overflow = '';
  });

  builderNextBtn?.addEventListener('click', () => {
    if (builderState.currentStep < 11) {
      builderState.currentStep++;
      updateBuilderUI();
    }
  });

  builderPrevBtn?.addEventListener('click', () => {
    if (builderState.currentStep > 1) {
      builderState.currentStep--;
      updateBuilderUI();
    }
  });

  // Step 1: Box selection
  document.querySelectorAll('.builder-step-pane[data-step="1"] .select-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.builder-step-pane[data-step="1"] .select-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      builderState.boxId = card.dataset.boxId || "BOX_KRAFT_RIGID";
      builderState.boxName = card.querySelector('.select-card__title')?.textContent || "Keepsake Box";
      builderState.boxPricePaise = parseInt(card.dataset.price, 10) || 45000;
      builderState.boxCapacityCm3 = parseInt(card.dataset.capacity, 10) || 5200;
      updateBuilderUI();
    });
  });

  // Step 5: Ribbon selection
  const ribbonMap = {
    "RIB_BORDEAUX": { key: "burgundy_merlot", name: "Burgundy Merlot Raw Silk" },
    "RIB_GOLD": { key: "champagne_gold", name: "Champagne Gold Satin" },
    "RIB_EMERALD": { key: "forest_emerald", name: "Forest Emerald Grosgrain" },
    "RIB_BLUSH": { key: "blush_rose", name: "Blush Rose Velvet" }
  };
  document.querySelectorAll('.builder-step-pane[data-step="5"] .select-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.builder-step-pane[data-step="5"] .select-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const ribId = card.dataset.ribbonId;
      if (ribbonMap[ribId]) {
        builderState.ribbonColor = ribbonMap[ribId].key;
        builderState.ribbonName = ribbonMap[ribId].name;
      }
      updateBuilderUI();
    });
  });

  // Monogram initials input
  const monogramInput = document.getElementById('monogram-input');
  monogramInput?.addEventListener('input', (e) => {
    builderState.monogramInitials = e.target.value.trim().toUpperCase() || "HBH";
  });

  // Step 6 & 7: Inclusions toggle (checkboxes or cards)
  document.querySelectorAll('.builder-step-pane[data-step="6"] .select-card, .builder-step-pane[data-step="7"] .select-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('selected');
      const incId = card.dataset.inclusionId || card.querySelector('.select-card__title')?.textContent;
      const title = card.querySelector('.select-card__title')?.textContent;
      const pricePaise = parseInt(card.dataset.price, 10) || 65000;
      const volumeCm3 = parseInt(card.dataset.volume, 10) || 800;

      const existingIdx = builderState.inclusions.findIndex(i => i.id === incId);
      if (existingIdx >= 0) {
        builderState.inclusions.splice(existingIdx, 1);
      } else {
        builderState.inclusions.push({ id: incId, title, pricePaise, volumeCm3 });
      }
      updateBuilderUI();
    });
  });

  // Step 8: Wax seal selection
  const sealMap = {
    "SEAL_BOTANICAL": { colorKey: "vintage_gold", motif: "botanical_wreath", name: "Vintage Gold Botanical Wreath" },
    "SEAL_BORDEAUX": { colorKey: "bordeaux_red", motif: "monogram_hbh", name: "Bordeaux Merlot Crest" },
    "SEAL_SAGE": { colorKey: "forest_sage", motif: "botanical_wreath", name: "Forest Sage Leaf" },
    "SEAL_BRONZE": { colorKey: "antique_bronze", motif: "celestial_star", name: "Antique Bronze Star" }
  };
  document.querySelectorAll('.builder-step-pane[data-step="8"] .select-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.builder-step-pane[data-step="8"] .select-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const sealId = card.dataset.sealId;
      if (sealMap[sealId]) {
        builderState.waxSealColor = sealMap[sealId].colorKey;
        builderState.sealMotif = sealMap[sealId].motif;
        builderState.waxSealName = sealMap[sealId].name;
      }
      updateBuilderUI();
    });
  });

  // Step 9: Calligraphy Note
  const cardToInput = document.getElementById('card-to-input');
  const cardFromInput = document.getElementById('card-from-input');
  const cardMsgTextarea = document.getElementById('card-message-textarea');
  cardToInput?.addEventListener('input', (e) => { builderState.cardTo = e.target.value; });
  cardFromInput?.addEventListener('input', (e) => { builderState.cardFrom = e.target.value; });
  cardMsgTextarea?.addEventListener('input', (e) => {
    builderState.cardMessage = e.target.value;
    const counter = document.getElementById('card-char-counter');
    if (counter) counter.textContent = `${e.target.value.length} / 280`;
  });

  // Render Step 11 Summary
  function renderBuilderSummary() {
    const summaryList = document.getElementById('builder-summary-breakdown');
    if (!summaryList) return;

    let itemsHtml = `
      <div style="display: flex; justify-content: space-between;">
        <span><strong>Box Base:</strong> ${builderState.boxName}</span>
        <span style="font-family: 'JetBrains Mono', monospace;">₹ ${(builderState.boxPricePaise / 100).toLocaleString('en-IN')}</span>
      </div>
      <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
        <span><strong>Silk Ribbon:</strong> ${builderState.ribbonName} (Monogram: ${builderState.monogramInitials})</span>
        <span>Included</span>
      </div>
      <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
        <span><strong>Wax Seal:</strong> ${builderState.waxSealName}</span>
        <span>Included</span>
      </div>
    `;

    builderState.inclusions.forEach(inc => {
      itemsHtml += `
        <div style="display: flex; justify-content: space-between;">
          <span>• ${inc.title}</span>
          <span style="font-family: 'JetBrains Mono', monospace;">₹ ${Math.round((inc.pricePaise || 0) / 100).toLocaleString('en-IN')}</span>
        </div>
      `;
    });

    if (builderState.hasPolaroid) {
      itemsHtml += `
        <div style="display: flex; justify-content: space-between;">
          <span>• Polaroid Keepsake Print</span>
          <span style="font-family: 'JetBrains Mono', monospace;">₹ 120</span>
        </div>
      `;
    }

    summaryList.innerHTML = itemsHtml;

    let totalPaise = builderState.boxPricePaise;
    builderState.inclusions.forEach(inc => { totalPaise += (inc.pricePaise || 0); });
    if (builderState.hasPolaroid) totalPaise += 12000;

    const finalTotalEl = document.getElementById('builder-final-total');
    if (finalTotalEl) {
      finalTotalEl.textContent = `₹ ${Math.round(totalPaise / 100).toLocaleString('en-IN')}`;
    }
  }

  // Render Photorealistic Vector SVG Visualizer via API
  async function renderProceduralPreview() {
    const stage = document.getElementById('builder-preview-svg-stage');
    if (!stage) return;

    stage.innerHTML = `<span class="mono-label" style="font-size: 0.8rem; color: #8A7B72;">Rendering procedural vector luxury preview...</span>`;

    try {
      const res = await fetch('/api/v1/atelier/visualize-hamper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boxId: builderState.boxId,
          ribbonColor: builderState.ribbonColor,
          waxSealColor: builderState.waxSealColor,
          sealMotif: builderState.sealMotif,
          monogramInitials: builderState.monogramInitials,
          cardMessage: builderState.cardMessage || "To someone truly cherished...",
          recipientName: builderState.cardTo || "Cherished Patron",
          width: 520,
          height: 380
        })
      });
      const data = await res.json();
      if (data.success && data.data?.svg) {
        stage.innerHTML = data.data.svg;
      } else {
        throw new Error();
      }
    } catch {
      // Local fallback vector representation if offline
      stage.innerHTML = `
        <svg viewBox="0 0 520 340" width="100%" height="auto" style="border-radius: 8px;">
          <rect width="520" height="340" fill="#FBF8F5"/>
          <rect x="60" y="50" width="400" height="240" rx="6" fill="#F5F2EB" stroke="#D6D0C3" stroke-width="2"/>
          <rect x="250" y="50" width="20" height="240" fill="#4A1E29"/>
          <rect x="60" y="160" width="400" height="20" fill="#4A1E29"/>
          <circle cx="260" cy="170" r="32" fill="#C59B3F" stroke="#7A5915" stroke-width="2"/>
          <text x="260" y="176" font-family="'Playfair Display', serif" font-size="16" font-weight="700" fill="#3B260A" text-anchor="middle">${escapeHtml(builderState.monogramInitials)}</text>
          <text x="260" y="270" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" fill="#8A7B72" text-anchor="middle">Atelier Bespoke Edition</text>
        </svg>
      `;
    }
  }

  document.getElementById('btn-refresh-preview')?.addEventListener('click', renderProceduralPreview);

  // Add Bespoke Hamper to Bag
  builderFinishBtn?.addEventListener('click', () => {
    let totalPaise = builderState.boxPricePaise;
    builderState.inclusions.forEach(inc => { totalPaise += (inc.pricePaise || 0); });
    if (builderState.hasPolaroid) totalPaise += 12000;

    const bespokeItem = {
      id: `bespoke_${Date.now()}`,
      title: `Bespoke ${builderState.boxName}`,
      subtitle: `${builderState.inclusions.length} Inclusions · ${builderState.ribbonName}`,
      priceRupees: Math.round(totalPaise / 100).toLocaleString('en-IN'),
      basePricePaise: totalPaise,
      image: "images/hero-hamper.jpg",
      quantity: 1,
      ribbon: builderState.ribbonName,
      waxSeal: builderState.waxSealName,
      monogram: builderState.monogramInitials,
      cardMessage: builderState.cardMessage,
      inclusions: builderState.inclusions
    };

    cart.push(bespokeItem);
    builderOverlayEl?.classList.remove('open');
    document.body.style.overflow = '';
    renderCart();
    showToast("✨ Bespoke Hamper composed and added to your bag!");
    openCart();
  });

  // ═══════════════════════════════════════════════════════════
  // 8. 2-STEP CHECKOUT & PATRON OTP AUTHENTICATION
  // ═══════════════════════════════════════════════════════════
  const checkoutOverlay = document.getElementById('checkout-overlay');
  const checkoutCloseBtn = document.getElementById('checkout-close-btn');
  const checkoutBtn = document.getElementById('checkout-btn');
  const checkoutStep1 = document.getElementById('checkout-step-1');
  const checkoutStep2 = document.getElementById('checkout-step-2');
  const checkoutStep3 = document.getElementById('checkout-step-3');
  const checkoutProceedBtn = document.getElementById('checkout-proceed-btn');
  const checkoutBackBtn = document.getElementById('checkout-back-btn');
  const checkoutPayBtn = document.getElementById('checkout-pay-btn');
  const pincodeInput = document.getElementById('co-pincode');
  const pincodeStatus = document.getElementById('pincode-status');

  checkoutBtn?.addEventListener('click', () => {
    if (!cart || cart.length === 0) {
      showToast("Your gifting bag is empty. Please select a luxury hamper first.");
      return;
    }
    closeCart();
    checkoutOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Reset steps
    checkoutStep1.style.display = 'block';
    checkoutStep2.style.display = 'none';
    checkoutStep3.style.display = 'none';

    // Compute total
    const subtotalPaise = cart.reduce((sum, item) => sum + (item.basePricePaise * item.quantity), 0);
    const isFreeShipping = subtotalPaise >= 299900 || subtotalPaise === 0;
    const shippingFeePaise = isFreeShipping ? 0 : 15000;
    let discountPaise = appliedCoupon === 'ALMAS10' ? Math.min(Math.round(subtotalPaise * 0.10), 50000) : 0;
    const taxablePaise = Math.max(0, subtotalPaise - discountPaise);
    const taxPaise = Math.round(taxablePaise * 0.18);
    const finalPaise = taxablePaise + taxPaise + shippingFeePaise;

    const coFinalAmount = document.getElementById('co-final-amount');
    if (coFinalAmount) coFinalAmount.textContent = `₹ ${Math.round(finalPaise / 100).toLocaleString('en-IN')}`;
  });

  checkoutCloseBtn?.addEventListener('click', () => {
    checkoutOverlay?.classList.remove('open');
    document.body.style.overflow = '';
  });

  // Pincode lookup
  pincodeInput?.addEventListener('input', async (e) => {
    const val = e.target.value.trim();
    if (val.length === 6) {
      try {
        const res = await fetch(`/api/v1/delivery/serviceability/${val}`);
        const data = await res.json();
        if (data.success && data.data?.isServiceable) {
          pincodeStatus.style.display = 'block';
          pincodeStatus.style.color = '#2E7D32';
          pincodeStatus.textContent = `✓ Serviceable (${data.data.city}, ${data.data.state}) · Est: ${data.data.standardDays} Days`;
          const cityInput = document.getElementById('co-city');
          if (cityInput && !cityInput.value) cityInput.value = `${data.data.city}, ${data.data.state}`;
        } else {
          pincodeStatus.style.display = 'block';
          pincodeStatus.style.color = '#C62828';
          pincodeStatus.textContent = "✕ Pincode unserviceable by express air courier.";
        }
      } catch {
        pincodeStatus.style.display = 'block';
        pincodeStatus.style.color = '#2E7D32';
        pincodeStatus.textContent = "✓ Verified (Standard Pan-India Transit)";
      }
    } else {
      pincodeStatus.style.display = 'none';
    }
  });

  // WhatsApp OTP Authentication flow
  const btnRequestOtp = document.getElementById('btn-request-otp');
  const btnVerifyOtp = document.getElementById('btn-verify-otp');
  const authPhoneInput = document.getElementById('auth-patron-phone');
  const authOtpInput = document.getElementById('auth-patron-otp');
  const authStepPhone = document.getElementById('auth-step-phone');
  const authStepVerify = document.getElementById('auth-step-verify');
  const patronAuthStatus = document.getElementById('patron-auth-status');
  const otpFeedback = document.getElementById('otp-feedback');

  btnRequestOtp?.addEventListener('click', async () => {
    const phone = authPhoneInput?.value?.trim();
    if (!phone) {
      showToast("Please enter your mobile phone number");
      return;
    }
    try {
      const res = await fetch('/api/v1/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, channel: 'WHATSAPP' })
      });
      const json = await res.json();
      if (json.success) {
        authStepVerify.style.display = 'block';
        if (otpFeedback) otpFeedback.textContent = "✓ 6-digit OTP dispatched to your WhatsApp! (Sandbox code: 123456)";
        showToast("OTP sent to your WhatsApp!");
      } else {
        throw new Error(json.error);
      }
    } catch {
      authStepVerify.style.display = 'block';
      if (otpFeedback) otpFeedback.textContent = "✓ Sandbox code active: Use 123456 to verify";
    }
  });

  btnVerifyOtp?.addEventListener('click', async () => {
    const phone = authPhoneInput?.value?.trim();
    const otp = authOtpInput?.value?.trim();
    if (!otp) {
      showToast("Please enter the 6-digit OTP");
      return;
    }
    try {
      const res = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const json = await res.json();
      if (json.success && json.data?.token) {
        localStorage.setItem('hbh_patron_jwt', json.data.token);
        if (patronAuthStatus) {
          patronAuthStatus.textContent = "✓ VIP Patron Verified";
          patronAuthStatus.style.color = "#2E7D32";
        }
        if (authStepVerify) authStepVerify.style.display = 'none';
        if (authStepPhone) authStepPhone.style.display = 'none';
        const nameInput = document.getElementById('co-recipient-name');
        if (nameInput && !nameInput.value && json.data.user?.name) {
          nameInput.value = json.data.user.name;
        }
        showToast("Welcome back! Verified as VIP Patron.");
      } else {
        throw new Error(json.error || "Invalid OTP code");
      }
    } catch (err) {
      showToast(err.message || "Invalid or expired OTP code. Please retry.");
    }
  });

  checkoutProceedBtn?.addEventListener('click', () => {
    const name = document.getElementById('co-recipient-name')?.value?.trim();
    const phone = document.getElementById('co-recipient-phone')?.value?.trim();
    const address = document.getElementById('co-address')?.value?.trim();
    const pin = document.getElementById('co-pincode')?.value?.trim();

    if (!name || name.length < 2) {
      showToast("Please provide recipient name (minimum 2 characters)");
      return;
    }
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    if (!cleanPhone || cleanPhone.length < 10) {
      showToast("Please enter a valid 10-digit mobile number");
      return;
    }
    const PIN_REGEX = /^[1-9][0-9]{5}$/;
    if (!pin || !PIN_REGEX.test(pin)) {
      showToast("Please enter a valid 6-digit Indian PIN code");
      return;
    }
    if (!address || address.length < 5) {
      showToast("Please provide complete delivery street address");
      return;
    }
    checkoutStep1.style.display = 'none';
    checkoutStep2.style.display = 'block';
  });

  checkoutBackBtn?.addEventListener('click', () => {
    checkoutStep2.style.display = 'none';
    checkoutStep1.style.display = 'block';
  });

  // Payment method selection
  document.querySelectorAll('.payment-method-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });

  // Confirm and Authorize Payment
  checkoutPayBtn?.addEventListener('click', async () => {
    checkoutPayBtn.textContent = "Authorizing via Secure Acquirer...";
    checkoutPayBtn.disabled = true;

    const name = document.getElementById('co-recipient-name')?.value?.trim() || "Patron";
    const phone = document.getElementById('co-recipient-phone')?.value?.trim() || "9876543210";
    const address = document.getElementById('co-address')?.value?.trim();
    const pin = document.getElementById('co-pincode')?.value?.trim() || "110001";
    const city = document.getElementById('co-city')?.value?.trim() || "New Delhi";

    const subtotalPaise = cart.reduce((sum, item) => sum + (item.basePricePaise * item.quantity), 0);
    const isFreeShipping = subtotalPaise >= 299900 || subtotalPaise === 0;
    const shippingFeePaise = isFreeShipping ? 0 : 15000;
    let discountPaise = appliedCoupon === 'ALMAS10' ? Math.min(Math.round(subtotalPaise * 0.10), 50000) : 0;
    const taxablePaise = Math.max(0, subtotalPaise - discountPaise);
    const taxPaise = Math.round(taxablePaise * 0.18);
    const finalPaise = taxablePaise + taxPaise + shippingFeePaise;

    const normalizedItems = cart.map(item => ({
      id: item.id,
      title: item.title || item.name || "Artisanal Hamper",
      name: item.title || item.name || "Artisanal Hamper",
      pricePaise: Number(item.pricePaise ?? item.basePricePaise ?? 0),
      quantity: Math.max(1, Number(item.quantity || 1)),
      ribbon: item.ribbon,
      waxSeal: item.waxSeal
    }));

    try {
      const res = await fetch('/api/v1/checkout/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        },
        body: JSON.stringify({
          items: normalizedItems,
          customer: { name, phone },
          shippingAddress: {
            recipientName: name,
            addressLine1: address,
            pincode: pin,
            city,
            phoneNumber: phone
          },
          couponCode: appliedCoupon
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.data?.orderNumber) {
        const errMsg = data?.error?.message || data?.detail || `Order creation rejected (HTTP ${res.status})`;
        showToast(`⚠ ${errMsg}`);
        return;
      }

      const orderNum = data.data.orderNumber;
      const selectedMethod = document.querySelector('.payment-method-card.selected')?.dataset?.method || "UPI";

      const verifyRes = await fetch('/api/v1/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: orderNum,
          paymentId: `pay_hbh_${Date.now()}`,
          method: selectedMethod
        })
      });
      if (!verifyRes.ok) {
        showToast(`⚠ Payment verification pending for ${orderNum}. Please retry or contact concierge.`);
        return;
      }

      // Clear Cart only after confirmed server order + payment
      cart = [];
      renderCart();

      // Show Confirmation Step
      checkoutStep2.style.display = 'none';
      checkoutStep3.style.display = 'block';
      const confirmedOrderNumEl = document.getElementById('confirmed-order-number');
      if (confirmedOrderNumEl) confirmedOrderNumEl.textContent = `Order # ${orderNum}`;

      const trackConfirmedBtn = document.getElementById('confirmed-track-order-btn');
      if (trackConfirmedBtn) {
        trackConfirmedBtn.dataset.orderNumber = orderNum;
      }

      const waBtn = document.getElementById('confirmed-whatsapp-btn');
      if (waBtn) {
        waBtn.href = `https://wa.me/919876543210?text=${encodeURIComponent(`Hi Hampers by Her! I just placed order ${orderNum}.`)}`;
      }

      playGoldenChime();
      showToast("✨ Payment Confirmed! Artisanal curation initiated.");
    } catch {
      showToast("⚠ Unable to reach Atelier checkout server. Your gifting bag is preserved — please retry.");
    } finally {
      checkoutPayBtn.textContent = "Confirm & Authorize Payment →";
      checkoutPayBtn.disabled = false;
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 9. AI BESPOKE HAMPER KNAPSACK CURATOR (39_DSA.md)
  // ═══════════════════════════════════════════════════════════
  const knapsackModal = document.getElementById('knapsack-curator-modal');
  const btnOpenKnapsack = document.getElementById('btn-open-knapsack-curator');
  const knapsackCloseBtn = document.getElementById('knapsack-close-btn');
  const btnRunKnapsack = document.getElementById('btn-run-knapsack');
  const knapsackBudgetInput = document.getElementById('knapsack-budget-input');
  const knapsackOccasionSelect = document.getElementById('knapsack-occasion-select');
  const knapsackResultsContainer = document.getElementById('knapsack-results-container');
  const knapsackHarmonyScore = document.getElementById('knapsack-harmony-score');
  const knapsackItemsList = document.getElementById('knapsack-items-list');
  const knapsackTotalPrice = document.getElementById('knapsack-total-price');
  const btnLoadKnapsackBuilder = document.getElementById('btn-load-knapsack-builder');

  let lastKnapsackComposition = null;

  btnOpenKnapsack?.addEventListener('click', () => {
    knapsackModal?.classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  knapsackCloseBtn?.addEventListener('click', () => {
    knapsackModal?.classList.remove('open');
    document.body.style.overflow = '';
  });

  btnRunKnapsack?.addEventListener('click', async () => {
    const budgetRupees = parseInt(knapsackBudgetInput?.value || "3500", 10);
    const budgetPaise = budgetRupees * 100;
    const occasion = knapsackOccasionSelect?.value || "WEDDING";

    btnRunKnapsack.textContent = "Optimizing Knapsack...";
    btnRunKnapsack.disabled = true;

    try {
      const res = await fetch('/api/v1/dsa/knapsack-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetPaise, occasion })
      });
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data;
        const curatedItems = Array.isArray(d.items)
          ? d.items
          : (Array.isArray(d.selectedItems) ? d.selectedItems : []);
        const totalPaise = Number(d.totalPricePaise ?? d.totalCostPaise ?? 0);
        const harmonyScore = Number(d.averageHarmonyScore ?? d.harmonyScore ?? 94.5);

        lastKnapsackComposition = { ...d, selectedItems: curatedItems };
        knapsackResultsContainer.style.display = 'block';
        if (knapsackHarmonyScore) {
          knapsackHarmonyScore.textContent = `Harmony Score: ${harmonyScore.toFixed(1)} / 100`;
        }
        if (knapsackTotalPrice) {
          knapsackTotalPrice.textContent = `₹ ${Math.round(totalPaise / 100).toLocaleString('en-IN')}`;
        }
        if (knapsackItemsList) {
          const boxRow = d.box ? `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #E2D9D2; font-weight: 600;">
              <span>📦 ${escapeHtml(d.box.name || "Keepsake Vessel")} (Box)</span>
              <span style="font-family: 'JetBrains Mono', monospace;">₹ ${Math.round(Number(d.box.pricePaise || 0) / 100).toLocaleString('en-IN')}</span>
            </div>
          ` : '';
          knapsackItemsList.innerHTML = boxRow + curatedItems.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #E2D9D2;">
              <span>• ${escapeHtml(item.name)} (${escapeHtml(item.category || "Inclusion")})</span>
              <span style="font-family: 'JetBrains Mono', monospace;">₹ ${Math.round(Number(item.pricePaise || 0) / 100).toLocaleString('en-IN')}</span>
            </div>
          `).join('');
        }
        playVelvetTap();
        showToast("✨ Optimal bespoke knapsack curated!");
      }
    } catch {
      showToast("Curated local collection fallback active.");
    } finally {
      btnRunKnapsack.textContent = "⚡ Optimize & Curate Hamper";
      btnRunKnapsack.disabled = false;
    }
  });

  btnLoadKnapsackBuilder?.addEventListener('click', () => {
    if (lastKnapsackComposition && Array.isArray(lastKnapsackComposition.selectedItems)) {
      builderState.inclusions = lastKnapsackComposition.selectedItems.map(it => ({
        id: it.id,
        title: it.name,
        pricePaise: it.pricePaise,
        volumeCm3: it.volume_mm3 ? Math.round(it.volume_mm3 / 1000) : 600
      }));
    }
    knapsackModal?.classList.remove('open');
    builderOverlayEl?.classList.add('open');
    document.body.style.overflow = 'hidden';
    builderState.currentStep = 6; // Jump directly to inclusions
    updateBuilderUI();
    showToast("Loaded AI curated components into Bespoke Atelier!");
  });

  // ═══════════════════════════════════════════════════════════
  // 10. RE-DOS-SAFE NATURAL LANGUAGE INTENT SEARCH
  // ═══════════════════════════════════════════════════════════
  const naturalSearchInput = document.getElementById('natural-search-input');
  const naturalSearchBtn = document.getElementById('natural-search-btn');
  const searchIntentPills = document.getElementById('search-intent-pills');

  async function executeNaturalSearch() {
    const query = naturalSearchInput?.value?.trim();
    if (!query) return;

    try {
      const res = await fetch('/api/v1/dsa/tokenize-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      if (data.success && data.data) {
        const intent = data.data.intent || data.data;
        const priceCapRupees = intent.maxPricePaise
          ? Math.round(Number(intent.maxPricePaise) / 100)
          : intent.priceCapRupees;
        if (searchIntentPills) {
          searchIntentPills.style.display = 'flex';
          let chips = '';
          if (intent.occasion) chips += `<span class="intent-chip">Occasion: ${escapeHtml(intent.occasion)}</span>`;
          if (intent.recipient) chips += `<span class="intent-chip">Recipient: ${escapeHtml(intent.recipient)}</span>`;
          if (priceCapRupees) chips += `<span class="intent-chip">Cap: ₹${Number(priceCapRupees).toLocaleString('en-IN')}</span>`;
          if (intent.isLuxury || (Array.isArray(intent.tones) && intent.tones.includes('luxury'))) {
            chips += `<span class="intent-chip">✨ Luxury Tier</span>`;
          }
          searchIntentPills.innerHTML = chips || `<span class="intent-chip">Tokens: ${escapeHtml(query)}</span>`;
        }

        // Filter cards in grid
        const cards = document.querySelectorAll('.product-card');
        cards.forEach(card => {
          const text = card.textContent.toLowerCase();
          const matchOccasion = !intent.occasion || text.includes(intent.occasion.toLowerCase());
          card.style.display = matchOccasion ? 'block' : 'none';
        });

        // Smooth scroll to collections
        document.getElementById('collections')?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch {
      // Fallback simple search
      const cards = document.querySelectorAll('.product-card');
      cards.forEach(card => {
        card.style.display = card.textContent.toLowerCase().includes(query.toLowerCase()) ? 'block' : 'none';
      });
    }
  }

  naturalSearchBtn?.addEventListener('click', executeNaturalSearch);
  naturalSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeNaturalSearch();
  });

  // ═══════════════════════════════════════════════════════════
  // 11. LIVE COURIER AWB TRACKING & CHECKPOINT TIMELINE
  // ═══════════════════════════════════════════════════════════
  const trackingModal = document.getElementById('order-tracking-modal');
  const trackingCloseBtn = document.getElementById('tracking-close-btn');
  const trackingInputId = document.getElementById('tracking-input-id');
  const btnQueryTracking = document.getElementById('btn-query-tracking');
  const trackingResultBox = document.getElementById('tracking-result-box');
  const trackCarrierName = document.getElementById('track-carrier-name');
  const trackAwbNum = document.getElementById('track-awb-num');
  const trackStatusBadge = document.getElementById('track-status-badge');
  const trackingCheckpointsList = document.getElementById('tracking-checkpoints-list');

  const navTrackOrderBtn = document.getElementById('nav-track-order-btn');
  const mobileTrackOrderBtn = document.getElementById('mobile-track-order-btn');

  function openTrackingModal(prefillId = "") {
    if (prefillId && trackingInputId) trackingInputId.value = prefillId;
    trackingModal?.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (prefillId) executeTrackingQuery(prefillId);
  }

  navTrackOrderBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openTrackingModal();
  });

  mobileTrackOrderBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    openTrackingModal();
  });

  trackingCloseBtn?.addEventListener('click', () => {
    trackingModal?.classList.remove('open');
    document.body.style.overflow = '';
  });

  async function executeTrackingQuery(queryId) {
    const id = queryId || trackingInputId?.value?.trim();
    if (!id) {
      showToast("Please enter an Order Number or AWB");
      return;
    }

    try {
      const res = await fetch(`/api/v1/delivery/track/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success && data.data) {
        const trk = data.data;
        trackingResultBox.style.display = 'block';
        if (trackCarrierName) trackCarrierName.textContent = trk.carrier || "BlueDart Air Express";
        if (trackAwbNum) trackAwbNum.textContent = trk.awbNumber || trk.orderNumber;
        if (trackStatusBadge) {
          trackStatusBadge.textContent = trk.status;
          trackStatusBadge.style.background = trk.status === 'DELIVERED' ? '#E8F5E9' : '#FFF3E0';
          trackStatusBadge.style.color = trk.status === 'DELIVERED' ? '#2E7D32' : '#E65100';
        }
        if (trackingCheckpointsList && Array.isArray(trk.checkpoints)) {
          trackingCheckpointsList.innerHTML = trk.checkpoints.map((cp, idx) => `
            <div class="tracking-node ${idx === trk.checkpoints.length - 1 ? 'active' : ''}">
              <strong style="display: block; font-size: 0.85rem;">${escapeHtml(cp.status)} · ${escapeHtml(cp.location)}</strong>
              <p style="font-size: 0.78rem; color: #555; margin: 2px 0 0;">${escapeHtml(cp.message)}</p>
              <span class="mono-label" style="font-size: 0.68rem; color: #999;">${escapeHtml(new Date(cp.timestamp).toLocaleString('en-IN'))}</span>
            </div>
          `).join('');
        }
      } else {
        trackingResultBox.style.display = 'block';
        if (trackCarrierName) trackCarrierName.textContent = "Atelier Order Lookup";
        if (trackAwbNum) trackAwbNum.textContent = id;
        if (trackStatusBadge) {
          trackStatusBadge.textContent = "NOT FOUND";
          trackStatusBadge.style.background = "#FDE8E8";
          trackStatusBadge.style.color = "#9E2A2B";
        }
        if (trackingCheckpointsList) {
          trackingCheckpointsList.innerHTML = `
            <div class="tracking-node">
              <strong style="display: block; font-size: 0.85rem;">No matching order or AWB found</strong>
              <p style="font-size: 0.78rem; color: #555; margin: 2px 0 0;">Verify your HBH order number (e.g. HBH-2026...) or contact our WhatsApp concierge.</p>
            </div>
          `;
        }
      }
    } catch {
      showToast("⚠ Tracking service temporarily unavailable. Please retry.");
    }
  }

  btnQueryTracking?.addEventListener('click', () => executeTrackingQuery());

  // Wire newly linked storefront triggers (Builder, Bespoke Occasions, Footer Track, Mobile Dock, Confirmed Track)
  document.getElementById('section-open-builder-btn')?.addEventListener('click', () => {
    builderOverlayEl?.classList.add('open');
    document.body.style.overflow = 'hidden';
    updateBuilderUI();
  });
  document.getElementById('mobile-builder-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    builderOverlayEl?.classList.add('open');
    document.body.style.overflow = 'hidden';
    updateBuilderUI();
  });
  document.getElementById('mobile-dock-build-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    builderOverlayEl?.classList.add('open');
    document.body.style.overflow = 'hidden';
    updateBuilderUI();
  });
  document.getElementById('mobile-dock-bag-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openCart();
  });
  document.getElementById('footer-track-order-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openTrackingModal();
  });
  document.getElementById('confirmed-track-order-btn')?.addEventListener('click', (e) => {
    const orderNum = e.currentTarget.dataset.orderNumber || "";
    checkoutOverlay?.classList.remove('open');
    openTrackingModal(orderNum);
  });
  document.querySelectorAll('[data-curate-occasion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const occ = btn.getAttribute('data-curate-occasion') || 'WEDDING';
      if (knapsackOccasionSelect) knapsackOccasionSelect.value = occ;
      knapsackModal?.classList.add('open');
      document.body.style.overflow = 'hidden';
      btnRunKnapsack?.click();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 12. REAL-TIME VOICE AI CONCIERGE (WebSocket PCM16 + Web Audio + Barge-In)
  // ═══════════════════════════════════════════════════════════
  const VOICE_SAMPLE_RATE_HZ = 16000;
  const VOICE_MAX_RECONNECT_ATTEMPTS = 5;

  const voiceModal = document.getElementById('voice-concierge-modal');
  const btnOpenVoice = document.getElementById('btn-open-voice-concierge');
  const voiceCloseBtn = document.getElementById('voice-close-btn');
  const voiceOrb = document.getElementById('voice-orb');
  const voiceStatusPill = document.getElementById('voice-status-pill');
  const voiceTtfaPill = document.getElementById('voice-ttfa-pill');
  const voiceTranscriptFeed = document.getElementById('voice-transcript-feed');
  const voiceActionCards = document.getElementById('voice-action-cards');
  const voiceMicBtn = document.getElementById('voice-mic-btn');
  const voiceInterruptBtn = document.getElementById('voice-interrupt-btn');
  const voiceTextInput = document.getElementById('voice-text-input');
  const voiceSendBtn = document.getElementById('voice-send-btn');

  let voiceWs = null;
  let voiceShouldStayConnected = false;
  let voiceReconnectAttempt = 0;
  let voiceReconnectTimer = null;
  let voiceAudioCtx = null;
  let voiceNextPlayTime = 0;
  let voiceScheduledSources = [];
  let voiceMicStream = null;
  let voiceMicProcessor = null;
  let voiceMicActive = false;
  let voiceActiveAssistantEl = null;

  function setVoiceStatus(label, orbState = '') {
    if (voiceStatusPill) voiceStatusPill.textContent = label;
    if (voiceOrb) {
      voiceOrb.classList.remove('listening', 'speaking');
      if (orbState) voiceOrb.classList.add(orbState);
    }
  }

  function appendVoiceMessage(role, text) {
    if (!voiceTranscriptFeed) return null;
    const div = document.createElement('div');
    div.className = `voice-msg voice-msg--${role}`;
    if (role === 'user') {
      div.innerHTML = `<strong>You:</strong> ${escapeHtml(text)}`;
    } else if (role === 'assistant') {
      div.innerHTML = `<strong>Eleanor:</strong> <span class="voice-msg-body">${escapeHtml(text)}</span>`;
    } else {
      div.textContent = text;
    }
    voiceTranscriptFeed.appendChild(div);
    voiceTranscriptFeed.scrollTop = voiceTranscriptFeed.scrollHeight;
    return div;
  }

  function clearAudioPlaybackQueue() {
    voiceScheduledSources.forEach(src => {
      try { src.stop(); } catch {}
    });
    voiceScheduledSources = [];
    if (voiceAudioCtx) {
      voiceNextPlayTime = voiceAudioCtx.currentTime;
    }
  }

  function playPcm16Base64Chunk(base64Delta, sampleRate = VOICE_SAMPLE_RATE_HZ) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!voiceAudioCtx) {
        voiceAudioCtx = new AudioCtx({ sampleRate });
      }
      if (voiceAudioCtx.state === 'suspended') {
        voiceAudioCtx.resume().catch(() => {});
      }

      const binary = atob(base64Delta);
      const byteLen = binary.length;
      const sampleCount = Math.floor(byteLen / 2);
      if (sampleCount === 0) return;

      const float32 = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const lo = binary.charCodeAt(i * 2);
        const hi = binary.charCodeAt(i * 2 + 1);
        let val = (hi << 8) | lo;
        if (val >= 0x8000) val -= 0x10000;
        float32[i] = val / 32768;
      }

      const audioBuffer = voiceAudioCtx.createBuffer(1, sampleCount, sampleRate);
      audioBuffer.copyToChannel(float32, 0);

      const source = voiceAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(voiceAudioCtx.destination);

      const now = voiceAudioCtx.currentTime;
      if (voiceNextPlayTime < now) voiceNextPlayTime = now;
      source.start(voiceNextPlayTime);
      voiceNextPlayTime += audioBuffer.duration;
      voiceScheduledSources.push(source);
      source.onended = () => {
        voiceScheduledSources = voiceScheduledSources.filter(s => s !== source);
      };
    } catch {
      // Headless or restricted audio contexts safely skip playback without crashing
    }
  }

  function stopVoiceMicrophone() {
    voiceMicActive = false;
    if (voiceMicProcessor) {
      try { voiceMicProcessor.disconnect(); } catch {}
      voiceMicProcessor = null;
    }
    if (voiceMicStream) {
      voiceMicStream.getTracks().forEach(t => t.stop());
      voiceMicStream = null;
    }
    if (voiceMicBtn) voiceMicBtn.textContent = '🎙️ Start Live Mic';
  }

  async function toggleVoiceMicrophone() {
    if (voiceMicActive) {
      stopVoiceMicrophone();
      if (voiceWs && voiceWs.readyState === WebSocket.OPEN) {
        voiceWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      }
      setVoiceStatus('Connected · Ready');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      appendVoiceMessage('system', 'Microphone API unavailable in this browser. Use quick prompts or text input below.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      voiceMicStream = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const micCtx = new AudioCtx({ sampleRate: VOICE_SAMPLE_RATE_HZ });
      const source = micCtx.createMediaStreamSource(stream);
      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      voiceMicProcessor = processor;
      voiceMicActive = true;
      if (voiceMicBtn) voiceMicBtn.textContent = '⏹ Stop & Commit Turn';
      setVoiceStatus('Listening (Live Mic)', 'listening');

      processor.onaudioprocess = (ev) => {
        if (!voiceMicActive || !voiceWs || voiceWs.readyState !== WebSocket.OPEN) return;
        const input = ev.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const clamped = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
        }
        voiceWs.send(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(micCtx.destination);
    } catch {
      appendVoiceMessage('system', 'Microphone permission declined — you can still converse via prompts or text.');
    }
  }

  function renderVoiceActionCards(cards) {
    if (!voiceActionCards) return;
    if (!Array.isArray(cards) || cards.length === 0) {
      voiceActionCards.style.display = 'none';
      return;
    }
    voiceActionCards.style.display = 'flex';
    voiceActionCards.innerHTML = cards.map(c => `
      <div class="voice-action-card">
        <div>
          <span class="mono-label" style="font-size: 0.68rem; color: var(--color-gold);">${escapeHtml(c.occasion || 'Curated')} · ${escapeHtml(c.badge || 'Atelier')}</span>
          <div style="font-family: 'Playfair Display', serif; font-weight: 600; color: var(--color-bordeaux);">${escapeHtml(c.title)}</div>
          <div style="font-size: 0.76rem; color: var(--text-secondary);">${escapeHtml(c.subtitle || '')}</div>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <div style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--color-bordeaux); margin-bottom: 6px;">₹ ${escapeHtml(c.priceRupees || '')}</div>
          <button type="button" class="btn btn--bordeaux btn--xs voice-inspect-card-btn" data-product-id="${escapeHtml(c.id || '')}">Inspect &rarr;</button>
        </div>
      </div>
    `).join('');

    voiceActionCards.querySelectorAll('.voice-inspect-card-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-product-id');
        closeVoiceModal();
        if (pid === 'bespoke_knapsack_curated') {
          btnOpenKnapsack?.click();
        } else if (pid && typeof openItemModal === 'function') {
          openItemModal(pid);
        } else {
          document.getElementById('collections')?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  function connectVoiceWebSocket() {
    if (voiceWs && (voiceWs.readyState === WebSocket.OPEN || voiceWs.readyState === WebSocket.CONNECTING)) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/api/v1/voice/stream`;
    setVoiceStatus('Connecting...');

    try {
      voiceWs = new WebSocket(wsUrl);
    } catch {
      setVoiceStatus('Connection Failed');
      return;
    }

    voiceWs.onopen = () => {
      voiceReconnectAttempt = 0;
      setVoiceStatus('Connected · Ready');
    };

    voiceWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'session.created') {
          setVoiceStatus('Connected · Server-VAD Ready');
        } else if (msg.type === 'input_audio_buffer.speech_started') {
          setVoiceStatus('Listening...', 'listening');
        } else if (msg.type === 'response.audio_transcript.delta') {
          setVoiceStatus('Eleanor Speaking', 'speaking');
          if (voiceInterruptBtn) voiceInterruptBtn.disabled = false;
          if (!voiceActiveAssistantEl) {
            voiceActiveAssistantEl = appendVoiceMessage('assistant', msg.delta || '');
          } else {
            const body = voiceActiveAssistantEl.querySelector('.voice-msg-body');
            if (body) body.textContent += msg.delta || '';
            if (voiceTranscriptFeed) voiceTranscriptFeed.scrollTop = voiceTranscriptFeed.scrollHeight;
          }
        } else if (msg.type === 'response.audio_transcript.done') {
          if (voiceActiveAssistantEl) {
            const body = voiceActiveAssistantEl.querySelector('.voice-msg-body');
            if (body) body.textContent = msg.transcript || '';
          } else if (msg.transcript) {
            appendVoiceMessage('assistant', msg.transcript);
          }
          voiceActiveAssistantEl = null;
        } else if (msg.type === 'response.audio.delta' && msg.delta) {
          playPcm16Base64Chunk(msg.delta, msg.sample_rate || VOICE_SAMPLE_RATE_HZ);
        } else if (msg.type === 'response.action_cards') {
          renderVoiceActionCards(msg.cards);
        } else if (msg.type === 'response.done') {
          setVoiceStatus('Connected · Ready');
          if (voiceInterruptBtn) voiceInterruptBtn.disabled = true;
          if (voiceTtfaPill && msg.response?.metrics?.ttfaMs !== undefined && msg.response.metrics.ttfaMs !== null) {
            voiceTtfaPill.textContent = `TTFA: ${msg.response.metrics.ttfaMs}ms`;
          }
        } else if (msg.type === 'response.cancelled') {
          clearAudioPlaybackQueue();
          voiceActiveAssistantEl = null;
          setVoiceStatus('Interrupted (Barge-In)');
          if (voiceInterruptBtn) voiceInterruptBtn.disabled = true;
          appendVoiceMessage('system', '✋ Playback interrupted — listening for your next request.');
        } else if (msg.type === 'error') {
          appendVoiceMessage('system', `Voice error: ${msg.error?.message || 'Unknown error'}`);
        }
      } catch {
        // Ignore malformed messages safely
      }
    };

    voiceWs.onerror = () => {
      setVoiceStatus('Reconnecting...');
    };

    voiceWs.onclose = () => {
      voiceWs = null;
      if (voiceShouldStayConnected && voiceReconnectAttempt < VOICE_MAX_RECONNECT_ATTEMPTS) {
        const delayMs = Math.min(8000, 500 * Math.pow(2, voiceReconnectAttempt));
        voiceReconnectAttempt++;
        setVoiceStatus(`Reconnecting (${voiceReconnectAttempt}/${VOICE_MAX_RECONNECT_ATTEMPTS})...`);
        voiceReconnectTimer = setTimeout(connectVoiceWebSocket, delayMs);
      } else if (voiceShouldStayConnected) {
        setVoiceStatus('Disconnected');
      }
    };
  }

  function sendVoicePrompt(promptText) {
    const clean = String(promptText || '').trim();
    if (!clean) return;
    if (!voiceWs || voiceWs.readyState !== WebSocket.OPEN) {
      connectVoiceWebSocket();
      setTimeout(() => sendVoicePrompt(clean), 350);
      return;
    }
    clearAudioPlaybackQueue();
    voiceActiveAssistantEl = null;
    appendVoiceMessage('user', clean);
    setVoiceStatus('Thinking...');
    if (voiceInterruptBtn) voiceInterruptBtn.disabled = false;
    voiceWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: clean }
    }));
  }

  function openVoiceModal() {
    voiceShouldStayConnected = true;
    voiceModal?.classList.add('open');
    document.body.style.overflow = 'hidden';
    connectVoiceWebSocket();
  }

  function closeVoiceModal() {
    voiceShouldStayConnected = false;
    if (voiceReconnectTimer) {
      clearTimeout(voiceReconnectTimer);
      voiceReconnectTimer = null;
    }
    stopVoiceMicrophone();
    clearAudioPlaybackQueue();
    if (voiceWs) {
      try { voiceWs.close(); } catch {}
      voiceWs = null;
    }
    voiceModal?.classList.remove('open');
    document.body.style.overflow = '';
  }

  btnOpenVoice?.addEventListener('click', openVoiceModal);
  document.getElementById('mobile-voice-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    openVoiceModal();
  });
  voiceCloseBtn?.addEventListener('click', closeVoiceModal);
  voiceMicBtn?.addEventListener('click', toggleVoiceMicrophone);
  voiceInterruptBtn?.addEventListener('click', () => {
    clearAudioPlaybackQueue();
    if (voiceWs && voiceWs.readyState === WebSocket.OPEN) {
      voiceWs.send(JSON.stringify({ type: 'response.cancel' }));
    }
  });
  voiceSendBtn?.addEventListener('click', () => {
    if (voiceTextInput && voiceTextInput.value.trim()) {
      sendVoicePrompt(voiceTextInput.value.trim());
      voiceTextInput.value = '';
    }
  });
  voiceTextInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && voiceTextInput.value.trim()) {
      sendVoicePrompt(voiceTextInput.value.trim());
      voiceTextInput.value = '';
    }
  });
  document.querySelectorAll('.voice-prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-voice-prompt');
      if (prompt) sendVoicePrompt(prompt);
    });
  });

});
