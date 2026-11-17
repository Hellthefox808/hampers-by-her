/* ═══════════════════════════════════════════════════════
   HAMPERS BY HER — Luxury Digital Commerce Operating System
   Enriched Item View (PDP), Meta WhatsApp Cloud API Concierge,
   Live Instagram Feed Sync, Bespoke Builder & Cart Drawer.
   ═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

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

  // ── Scroll Reveal Observer ──
  const revealElements = document.querySelectorAll(
    '.product-card, .bespoke-card, .builder, .whatsapp-card, .stories-grid'
  );
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  revealElements.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 700ms cubic-bezier(0.32, 0.72, 0, 1), transform 700ms cubic-bezier(0.32, 0.72, 0, 1)';
    revealObserver.observe(el);
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

  let cart = [
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
    }
  });

});
