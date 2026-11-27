/**
 * HAMPERS BY HER — STORYBOOK & SCRAPBOOK SHARED UI CONTROLLER
 * Powers scroll-opening arched doors, WhatsApp journey triggers, Polaroid
 * lightbox gallery, subpage mobile navigation, cart badge sync, and dedicated
 * interactive pages (catalog, hamper detail, moments, how-it-works, faq,
 * contact stationery letter, and delivered ticket archives).
 */
(function () {
  const CART_STORAGE_KEY = "hbh_cart_v2";

  const FALLBACK_PRODUCTS = [
    {
      id: "prod_wedding_vows",
      slug: "the-vows-and-vines-hamper",
      title: "The Vows & Vines Hamper",
      occasion: "Wedding",
      theme: "Understated Botanical",
      subtitle: "Elderflower tonic, wax-sealed card, dried hydrangea, castor-oil candle.",
      description: "Composed specifically for quiet wedding mornings and trousseau gifting.",
      story: "Inspired by the quiet twilight before vows are spoken, blending elderflower, soothing amber light, and dried Nilgiri botanicals.",
      basePricePaise: 395000,
      priceRupees: "3,950",
      badge: "Best Seller",
      primaryImage: "images/hamper-wedding.jpg",
      gallery: [
        { url: "images/hamper-wedding.jpg", label: "Full Composition" },
        { url: "images/hero-hamper.jpg", label: "Unboxing Lay" },
        { url: "images/hamper-anniversary.jpg", label: "Atelier Details" }
      ],
      serviceability: { dispatchSlaHours: 24, metroDeliveryDays: 2, restOfIndiaDays: 4 },
      boxVessel: "Linen-Lined Pine Keepsake Box with Brass Hinges"
    },
    {
      id: "prod_corporate_wellwisher",
      slug: "the-office-well-wisher",
      title: "The Office Well-Wisher",
      occasion: "Corporate",
      theme: "Minimalist Monogram",
      subtitle: "Single-origin cocoa, linen napkin, brass opener.",
      description: "Refined executive desk gift. Custom monogramming available on request.",
      story: "Designed for milestones, board greetings, and client appreciation with tactile brass and heirloom cocoa.",
      basePricePaise: 215000,
      priceRupees: "2,150",
      badge: "Artisan Pick",
      primaryImage: "images/hamper-corporate.jpg",
      gallery: [
        { url: "images/hamper-corporate.jpg", label: "Desk Ensemble" },
        { url: "images/hero-hamper.jpg", label: "Executive Accessories" }
      ],
      serviceability: { dispatchSlaHours: 24, metroDeliveryDays: 2, restOfIndiaDays: 3 },
      boxVessel: "Matte Charcoal FSC-Certified Rigid Board"
    },
    {
      id: "prod_festive_diwali",
      slug: "the-diwali-slow-burn",
      title: "The Diwali Slow-Burn",
      occasion: "Festive",
      theme: "Terracotta Warmth",
      subtitle: "Brass diya, dried citrus, slow-burn incense.",
      description: "Warm artisanal glow for autumn festivals scented with wild sandalwood.",
      story: "A reverent celebration of light and heritage craft with hand-beaten Thanjavur brass.",
      basePricePaise: 285000,
      priceRupees: "2,850",
      badge: "Limited Festive",
      primaryImage: "images/hamper-festive.jpg",
      gallery: [
        { url: "images/hamper-festive.jpg", label: "Festive Composition" },
        { url: "images/hero-hamper.jpg", label: "Artisan Elements" }
      ],
      serviceability: { dispatchSlaHours: 24, metroDeliveryDays: 2, restOfIndiaDays: 4 },
      boxVessel: "Terracotta Board Casket with Gold Foil Paisley Inlay"
    },
    {
      id: "prod_anniversary_letter",
      slug: "the-ten-year-letter",
      title: "The Ten-Year Letter",
      occasion: "Anniversary",
      theme: "Royal Bordeaux",
      subtitle: "Pressed rose, small-batch mead, a letter you can keep.",
      description: "Our signature romantic edit with deckle-edge paper and heirloom wax stamp.",
      story: "Designed as an enduring testament of devotion meant to be opened slowly.",
      basePricePaise: 320000,
      priceRupees: "3,200",
      badge: "Signature",
      primaryImage: "images/hamper-anniversary.jpg",
      gallery: [
        { url: "images/hamper-anniversary.jpg", label: "Romantic Suite" },
        { url: "images/hero-hamper.jpg", label: "Heirloom Craft" }
      ],
      serviceability: { dispatchSlaHours: 24, metroDeliveryDays: 1, restOfIndiaDays: 3 },
      boxVessel: "Royal Bordeaux Velvet Casket with Gilded Hardware"
    }
  ];

  const POLAROID_MOMENTS = [
    { img: "images/hamper-wedding.jpg", caption: "Anaya's bridesmaid suite in Pune 🌸✨" },
    { img: "images/hero-hamper.jpg", caption: "Autumn Slow-Brew tied in ecru silk 🎀" },
    { img: "images/hamper-anniversary.jpg", caption: "Ten-Year Letter wax seal closeup ❤️" },
    { img: "images/hamper-festive.jpg", caption: "Diwali glow & brass diya reveal 🪔" },
    { img: "images/hamper-corporate.jpg", caption: "Studio executive desk drop in Bengaluru 🌿" },
    { img: "images/hamper-wedding.jpg", caption: "Fresh Nilgiri hydrangea morning wrap 💌" },
    { img: "images/hamper-anniversary.jpg", caption: "Handwritten deckle note sealed warm 🖋️" },
    { img: "images/hero-hamper.jpg", caption: "Ready for 48hr Pan-India air express 📦" }
  ];

  function escapeHtml(val) {
    return String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  function writeCart(cart) {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {}
    syncCartBadge();
  }

  function addItemToStoredCart(product, ribbon = "Natural Ecru Raw Silk", waxSeal = "Olive Branch Botanica", cardNote = null) {
    const cart = readCart();
    const normalizedNote = cardNote || null;
    const existing = cart.find((item) => (
      item.id === product.id
      && (item.ribbon || "Natural Ecru Raw Silk") === ribbon
      && (item.waxSeal || "Olive Branch Botanica") === waxSeal
      && (item.cardNote || null) === normalizedNote
    ));

    if (existing) {
      existing.quantity = (Number(existing.quantity) || 1) + 1;
    } else {
      cart.push({
        id: product.id,
        title: product.title,
        subtitle: `${product.occasion || "Atelier"} Edition`,
        priceRupees: product.priceRupees,
        basePricePaise: Number(product.basePricePaise || 0),
        image: product.primaryImage || "images/hero-hamper.jpg",
        quantity: 1,
        ribbon,
        waxSeal,
        cardNote: normalizedNote
      });
    }
    writeCart(cart);
  }

  function syncCartBadge() {
    const cart = readCart();
    const count = cart.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);
    document.querySelectorAll(".nav__cart").forEach((el) => {
      el.textContent = `Cart · ${count}`;
    });
  }

  function showBannerToast(message) {
    const toast = document.getElementById("hbh-toast");
    if (toast) {
      toast.textContent = message;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2600);
    }
  }

  // ── 1. Subpage Mobile Menu Wiring (skip if main script.js already wired it) ──
  function initSubpageNavAndCart() {
    syncCartBadge();
    if (window.__hbhMainScriptActive) return;

    const menuBtn = document.getElementById("mobile-menu-btn");
    const menuClose = document.getElementById("mobile-menu-close");
    const mobileMenu = document.getElementById("mobile-menu");
    const overlay = mobileMenu?.querySelector(".mobile-menu__overlay");

    function openMenu() {
      mobileMenu?.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function closeMenu() {
      mobileMenu?.classList.remove("open");
      document.body.style.overflow = "";
    }

    menuBtn?.addEventListener("click", openMenu);
    menuClose?.addEventListener("click", closeMenu);
    overlay?.addEventListener("click", closeMenu);
    mobileMenu?.querySelectorAll(".mobile-menu__link").forEach((l) => l.addEventListener("click", closeMenu));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && mobileMenu?.classList.contains("open")) closeMenu();
    });
  }

  // ── 2. Scroll-Opening Arched Wooden Doors ──
  function initArchedDoors() {
    const doorCards = document.querySelectorAll(".sb-door-card");
    if (!doorCards.length) return;

    if (!("IntersectionObserver" in window)) {
      doorCards.forEach((c) => c.classList.add("doors-open"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("doors-open");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -20px 0px" }
    );

    doorCards.forEach((card, idx) => {
      const rect = card.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.95) {
        setTimeout(() => card.classList.add("doors-open"), 120 + idx * 80);
      } else {
        observer.observe(card);
      }
    });
  }

  // ── 3. WhatsApp Mockup Play Video -> 4D Unboxing Trigger ──
  function initPhoneVideoPreview() {
    const playTrigger = document.getElementById("sb-wa-play-unboxing");
    if (!playTrigger) return;
    playTrigger.addEventListener("click", () => {
      const heroBtn = document.getElementById("btn-hero-unboxing-4d");
      if (heroBtn) {
        heroBtn.click();
      } else {
        window.location.href = "index.html#hero";
      }
    });
  }

  // ── 4. Polaroid Wall & Full-Screen Dark Lightbox ──
  function initPolaroidLightbox(items = POLAROID_MOMENTS) {
    const lightbox = document.getElementById("polaroid-lightbox");
    const imgEl = document.getElementById("sb-lightbox-img");
    const captionEl = document.getElementById("sb-lightbox-caption");
    const closeBtn = document.getElementById("sb-lightbox-close");
    const prevBtn = document.getElementById("sb-lightbox-prev");
    const nextBtn = document.getElementById("sb-lightbox-next");
    const triggers = document.querySelectorAll("[data-polaroid-index]");

    if (!lightbox || !triggers.length) return;
    let activeIdx = 0;

    function renderSlide(idx) {
      activeIdx = (idx + items.length) % items.length;
      const item = items[activeIdx];
      if (imgEl) {
        imgEl.src = item.img;
        imgEl.alt = item.caption;
      }
      if (captionEl) {
        captionEl.textContent = `${activeIdx + 1} / ${items.length} — ${item.caption}`;
      }
    }

    function openAt(idx) {
      renderSlide(idx);
      lightbox.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function close() {
      lightbox.classList.remove("open");
      document.body.style.overflow = "";
    }

    triggers.forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-polaroid-index") || "0", 10);
        openAt(idx);
      });
    });

    closeBtn?.addEventListener("click", close);
    prevBtn?.addEventListener("click", () => renderSlide(activeIdx - 1));
    nextBtn?.addEventListener("click", () => renderSlide(activeIdx + 1));
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) close();
    });
    document.addEventListener("keydown", (e) => {
      if (!lightbox.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") renderSlide(activeIdx - 1);
      if (e.key === "ArrowRight") renderSlide(activeIdx + 1);
    });
  }

  // ── 5. Catalog Page Controller (catalog.html) ──
  async function initCatalogPage() {
    const grid = document.getElementById("sb-catalog-grid");
    if (!grid) return;

    const countEl = document.getElementById("sb-catalog-count");
    const clearBtn = document.getElementById("sb-clear-filters");
    const searchInput = document.getElementById("sb-catalog-search");

    let products = FALLBACK_PRODUCTS;
    try {
      const res = await fetch("/api/v1/catalog/products?limit=20");
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.items) && json.data.items.length) {
        products = json.data.items;
      }
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const state = {
      occasion: params.get("occasion") || "all",
      speed: params.get("speed") || "all",
      budget: params.get("budget") || "all",
      search: params.get("search") || ""
    };

    if (searchInput && state.search) searchInput.value = state.search;

    function syncFilterButtons() {
      document.querySelectorAll("[data-filter-group]").forEach((btn) => {
        const group = btn.getAttribute("data-filter-group");
        const val = btn.getAttribute("data-filter-value");
        btn.classList.toggle("active", state[group] === val);
      });
      const isFiltered = state.occasion !== "all" || state.speed !== "all" || state.budget !== "all" || state.search.trim() !== "";
      if (clearBtn) clearBtn.style.display = isFiltered ? "inline-flex" : "none";

      const nextUrl = new URL(window.location.href);
      ["occasion", "speed", "budget", "search"].forEach((k) => {
        if (state[k] && state[k] !== "all") nextUrl.searchParams.set(k, state[k]);
        else nextUrl.searchParams.delete(k);
      });
      window.history.replaceState({}, "", nextUrl);
    }

    function applyAndRender() {
      syncFilterButtons();
      const q = state.search.trim().toLowerCase();

      const filtered = products.filter((p) => {
        if (state.occasion !== "all" && p.occasion.toLowerCase() !== state.occasion.toLowerCase()) {
          return false;
        }
        if (state.speed === "metro1" && (p.serviceability?.metroDeliveryDays || 2) > 1) {
          return false;
        }
        if (state.speed === "express24" && (p.serviceability?.dispatchSlaHours || 24) > 24) {
          return false;
        }
        const rupees = Math.round((p.basePricePaise || 0) / 100);
        if (state.budget === "under2500" && rupees >= 2500) return false;
        if (state.budget === "mid" && (rupees < 2500 || rupees > 3500)) return false;
        if (state.budget === "luxury" && rupees <= 3500) return false;
        if (q) {
          const hay = `${p.title} ${p.occasion} ${p.theme} ${p.subtitle} ${p.description}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      if (countEl) {
        const isFiltered = state.occasion !== "all" || state.speed !== "all" || state.budget !== "all" || q !== "";
        countEl.textContent = isFiltered
          ? `${filtered.length} ${filtered.length === 1 ? "hamper matches" : "hampers match"}`
          : `${filtered.length} small-batch hampers ready for gifting`;
      }

      if (!filtered.length) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: #FFFDF8; border: 2px dashed var(--sb-ink); border-radius: 20px;">
            <p class="sb-script" style="font-size: 1.6rem; color: var(--sb-accent);">no exact matches on this shelf yet</p>
            <p style="margin: 8px 0 18px; color: var(--text-secondary);">Try clearing filters or compose a custom box in our 11-step Bespoke Atelier.</p>
            <a href="index.html?openBuilder=1" class="sb-btn sb-btn--primary">Open 11-Step Builder &rarr;</a>
          </div>
        `;
        return;
      }

      grid.innerHTML = filtered
        .map(
          (p) => `
          <article class="product-card sb-door-card doors-open">
            <a href="hamper.html?id=${encodeURIComponent(p.id)}" class="sb-arch-portal product-card__image-wrap" style="display:block;">
              <img src="${escapeHtml(p.primaryImage)}" alt="${escapeHtml(p.title)}" class="product-card__image">
              <span class="product-card__badge">${escapeHtml(p.badge || "Available")}</span>
            </a>
            <div class="sb-door-card__meta">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <span class="mono-label">${escapeHtml(p.occasion)} · 24h Dispatch</span>
                <strong style="font-family:var(--sb-font-display); font-size:1.15rem; color:var(--sb-accent);">₹ ${escapeHtml(p.priceRupees)}</strong>
              </div>
              <h3 class="product-card__name" style="margin:2px 0 0;">${escapeHtml(p.title)}</h3>
              <p class="product-card__desc" style="margin:0;">${escapeHtml(p.subtitle)}</p>
              <div class="sb-door-card__actions">
                <button type="button" class="sb-btn sb-btn--cream sb-btn--sm catalog-add-btn" data-product-id="${escapeHtml(p.id)}">+ Bag</button>
                <a href="hamper.html?id=${encodeURIComponent(p.id)}" class="sb-btn sb-btn--primary sb-btn--sm" style="flex:1;">Inspect &rarr;</a>
              </div>
            </div>
          </article>
        `
        )
        .join("");

      grid.querySelectorAll(".catalog-add-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-product-id");
          const prod = products.find((item) => item.id === id);
          if (prod) {
            addItemToStoredCart(prod);
            showBannerToast(`Added ${prod.title} to your gifting bag!`);
          }
        });
      });
    }

    document.querySelectorAll("[data-filter-group]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const group = btn.getAttribute("data-filter-group");
        const val = btn.getAttribute("data-filter-value");
        state[group] = val;
        applyAndRender();
      });
    });

    searchInput?.addEventListener("input", () => {
      state.search = searchInput.value;
      applyAndRender();
    });

    clearBtn?.addEventListener("click", () => {
      state.occasion = "all";
      state.speed = "all";
      state.budget = "all";
      state.search = "";
      if (searchInput) searchInput.value = "";
      applyAndRender();
    });

    applyAndRender();
  }

  // ── 6. Hamper Detail Page Controller (hamper.html) ──
  async function initHamperDetailPage() {
    const root = document.getElementById("sb-hamper-detail-root");
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id") || "prod_wedding_vows";

    let allProducts = FALLBACK_PRODUCTS;
    let product = FALLBACK_PRODUCTS.find((p) => p.id === idParam || p.slug === idParam) || FALLBACK_PRODUCTS[0];

    try {
      const [listRes, itemRes] = await Promise.all([
        fetch("/api/v1/catalog/products?limit=20"),
        fetch(`/api/v1/catalog/products/${encodeURIComponent(idParam)}`)
      ]);
      const listJson = await listRes.json();
      if (listJson.success && Array.isArray(listJson.data?.items)) {
        allProducts = listJson.data.items;
      }
      const itemJson = await itemRes.json();
      if (itemJson.success && itemJson.data) {
        product = itemJson.data;
      }
    } catch {}

    document.title = `${product.title} — Hampers by Her`;
    const bcName = document.getElementById("detail-breadcrumb-name");
    if (bcName) bcName.textContent = product.title;

    const mainImg = document.getElementById("detail-main-img");
    const counterEl = document.getElementById("detail-gallery-counter");
    const thumbsEl = document.getElementById("detail-thumbs");
    const gallery = Array.isArray(product.gallery) && product.gallery.length
      ? product.gallery
      : [{ url: product.primaryImage, label: "View 1" }];
    let activeImgIdx = 0;

    function showGalleryIdx(idx) {
      activeImgIdx = (idx + gallery.length) % gallery.length;
      if (mainImg) {
        mainImg.src = gallery[activeImgIdx].url;
        mainImg.alt = gallery[activeImgIdx].alt || product.title;
      }
      if (counterEl) counterEl.textContent = `${activeImgIdx + 1} / ${gallery.length}`;
      thumbsEl?.querySelectorAll("button").forEach((b, i) => {
        b.style.borderColor = i === activeImgIdx ? "var(--sb-accent)" : "var(--sb-ink)";
      });
    }

    if (thumbsEl) {
      thumbsEl.innerHTML = gallery
        .map(
          (g, i) => `
          <button type="button" data-thumb-idx="${i}" style="width:68px;height:68px;border-radius:12px;border:2px solid var(--sb-ink);overflow:hidden;padding:0;cursor:pointer;">
            <img src="${escapeHtml(g.url)}" alt="${escapeHtml(g.label || product.title)}" style="width:100%;height:100%;object-fit:cover;">
          </button>
        `
        )
        .join("");
      thumbsEl.querySelectorAll("button").forEach((b) => {
        b.addEventListener("click", () => showGalleryIdx(parseInt(b.dataset.thumbIdx, 10)));
      });
    }
    showGalleryIdx(0);

    document.getElementById("detail-prev-photo")?.addEventListener("click", () => showGalleryIdx(activeImgIdx - 1));
    document.getElementById("detail-next-photo")?.addEventListener("click", () => showGalleryIdx(activeImgIdx + 1));

    // Fill specs
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setText("detail-title", product.title);
    setText("detail-price", `₹ ${product.priceRupees}`);
    setText("detail-badge", product.badge || "Available");
    setText("detail-occasion", product.occasion);
    setText("detail-theme", product.theme || "Artisanal Edit");
    setText("detail-vessel", product.boxVessel || "Atelier Keepsake Box");
    setText("detail-story", product.story || product.description);
    setText("detail-enquiry-title", `Ask about ${product.title}`);

    const msgBox = document.getElementById("detail-inq-message");
    if (msgBox && !msgBox.value) {
      msgBox.value = `Hi Hampers by Her, I'd love to enquire about ${product.title} (₹${product.priceRupees}).`;
    }

    // Inclusions list
    const incEl = document.getElementById("detail-inclusions");
    if (incEl && Array.isArray(product.inclusions)) {
      incEl.innerHTML = product.inclusions
        .map(
          (inc) => `
          <div style="background:#FFFDF8;border:2px solid var(--sb-ink);border-radius:14px;padding:12px 14px;box-shadow:0 3px 0 var(--sb-ink);">
            <div style="display:flex;justify-content:space-between;gap:8px;">
              <strong>${escapeHtml(inc.name)}</strong>
              <span class="mono-label">${escapeHtml(inc.quantity || "")}</span>
            </div>
            <p style="font-size:0.84rem;color:var(--text-secondary);margin-top:4px;">${escapeHtml(inc.description || "")}</p>
          </div>
        `
        )
        .join("");
    }

    // Add to cart & WhatsApp CTA
    let chosenRibbon = product.personalizationOptions?.ribbonColors?.[0]?.name || "Natural Ecru Raw Silk";
    let chosenSeal = product.personalizationOptions?.waxSeals?.[0]?.name || "Olive Branch Botanica";

    const ribbonSel = document.getElementById("detail-ribbon-select");
    if (ribbonSel && product.personalizationOptions?.ribbonColors) {
      ribbonSel.innerHTML = product.personalizationOptions.ribbonColors
        .map((r) => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`)
        .join("");
      ribbonSel.addEventListener("change", () => { chosenRibbon = ribbonSel.value; });
    }

    const sealSel = document.getElementById("detail-seal-select");
    if (sealSel && product.personalizationOptions?.waxSeals) {
      sealSel.innerHTML = product.personalizationOptions.waxSeals
        .map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`)
        .join("");
      sealSel.addEventListener("change", () => { chosenSeal = sealSel.value; });
    }

    document.getElementById("detail-add-bag")?.addEventListener("click", () => {
      addItemToStoredCart(product, chosenRibbon, chosenSeal);
      showBannerToast(`Added ${product.title} to your gifting bag!`);
    });

    const waBtn = document.getElementById("detail-wa-btn");
    if (waBtn) {
      waBtn.textContent = `Ask about ${product.title} on WhatsApp`;
      waBtn.addEventListener("click", () => {
        const text = `Hi Hampers by Her! I'm interested in *${product.title}* (₹${product.priceRupees}) with ${chosenRibbon} & ${chosenSeal}.`;
        window.open(`https://wa.me/919876543210?text=${encodeURIComponent(text)}`, "_blank");
      });
    }

    // Pincode SLA check
    document.getElementById("detail-pin-btn")?.addEventListener("click", async () => {
      const pin = document.getElementById("detail-pin-input")?.value?.trim();
      const resEl = document.getElementById("detail-pin-result");
      if (!pin || pin.length !== 6) {
        if (resEl) resEl.textContent = "Please enter a valid 6-digit Indian PIN code.";
        return;
      }
      try {
        const res = await fetch(`/api/v1/delivery/serviceability/${encodeURIComponent(pin)}`);
        const json = await res.json();
        if (resEl) {
          resEl.textContent = json.data?.isServiceable
            ? `✓ Serviceable (${json.data.city}, ${json.data.state}) · Est. ${json.data.standardDays} days`
            : "Extended delivery zone — confirm availability on WhatsApp.";
        }
      } catch {
        if (resEl) resEl.textContent = "Unable to check PIN right now.";
      }
    });

    // Previous / Next hamper links
    const curIndex = Math.max(0, allProducts.findIndex((p) => p.id === product.id));
    const prevProd = allProducts[(curIndex - 1 + allProducts.length) % allProducts.length];
    const nextProd = allProducts[(curIndex + 1) % allProducts.length];
    const prevLink = document.getElementById("detail-prev-hamper");
    const nextLink = document.getElementById("detail-next-hamper");
    if (prevLink && prevProd) {
      prevLink.href = `hamper.html?id=${encodeURIComponent(prevProd.id)}`;
      prevLink.textContent = `← Previous: ${prevProd.title}`;
    }
    if (nextLink && nextProd) {
      nextLink.href = `hamper.html?id=${encodeURIComponent(nextProd.id)}`;
      nextLink.textContent = `Next: ${nextProd.title} →`;
    }

    // Recommended Pairings Grid
    const recGrid = document.getElementById("detail-recommendations-grid");
    if (recGrid) {
      const recommendations = Array.isArray(product.recommendations) && product.recommendations.length
        ? product.recommendations
        : allProducts.filter((p) => p.id !== product.id);
      recGrid.innerHTML = recommendations
        .slice(0, 3)
        .map(
          (rec) => `
          <article class="product-card sb-door-card doors-open">
            <a href="hamper.html?id=${encodeURIComponent(rec.id)}" class="sb-arch-portal product-card__image-wrap" style="display:block;">
              <img src="${escapeHtml(rec.primaryImage || "images/hamper-wedding.jpg")}" alt="${escapeHtml(rec.title)}" class="product-card__image">
              <span class="product-card__badge">${escapeHtml(rec.badge || "Available")}</span>
            </a>
            <div class="sb-door-card__meta">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <span class="mono-label">${escapeHtml(rec.occasion || "Atelier")}</span>
                <strong style="font-family:var(--sb-font-display); font-size:1.1rem; color:var(--sb-accent);">₹ ${escapeHtml(rec.priceRupees)}</strong>
              </div>
              <h3 class="product-card__name" style="margin:2px 0 0;">${escapeHtml(rec.title)}</h3>
              <div class="sb-door-card__actions" style="margin-top:8px;">
                <a href="hamper.html?id=${encodeURIComponent(rec.id)}" class="sb-btn sb-btn--cream sb-btn--sm" style="width:100%;">Inspect hamper &rarr;</a>
              </div>
            </div>
          </article>
        `
        )
        .join("");
    }

    // Inline enquiry submission
    const form = document.getElementById("detail-enquiry-form");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const statusEl = document.getElementById("detail-inq-status");
      const name = document.getElementById("detail-inq-name")?.value?.trim();
      const phone = document.getElementById("detail-inq-phone")?.value?.trim();
      const email = document.getElementById("detail-inq-email")?.value?.trim();
      const city = document.getElementById("detail-inq-city")?.value?.trim();
      const message = document.getElementById("detail-inq-message")?.value?.trim();
      try {
        const res = await fetch("/api/v1/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone, email, city, hamperId: product.id, message, source: "hamper_detail" })
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error?.message || "Could not send enquiry.");
        if (statusEl) {
          statusEl.innerHTML = `✓ Letter posted! Reference <strong>${escapeHtml(json.data.inquiry.id)}</strong>. <a href="${escapeHtml(json.data.waMeUrl)}" target="_blank" style="text-decoration:underline;font-weight:700;">Continue on WhatsApp →</a>`;
        }
        form.reset();
      } catch (err) {
        if (statusEl) statusEl.textContent = `⚠ ${err.message}`;
      }
    });
  }

  function summarizeCaption(text, maxLen = 68) {
    const clean = String(text || "").replace(/#\S+/g, "").replace(/\s+/g, " ").trim();
    if (!clean) return "Handcrafted moment from @hampers._by_her";
    if (clean.length <= maxLen) return clean;
    const cut = clean.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 24 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?-]+$/, "") + "…";
  }

  // ── 7. Happy Moments Page (moments.html) ──
  async function initMomentsPage() {
    const grid = document.getElementById("sb-moments-grid");
    if (!grid) return;

    let moments = [...POLAROID_MOMENTS];
    try {
      const res = await fetch("/api/v1/instagram/feed?limit=8");
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.items) && json.data.items.length) {
        const igMoments = json.data.items.map((it) => ({
          img: it.thumbnailUrl || it.mediaUrl,
          caption: summarizeCaption(it.caption, 68)
        }));
        moments = [...igMoments, ...POLAROID_MOMENTS.slice(0, 4)];
      }
    } catch {}

    grid.innerHTML = moments
      .map(
        (m, idx) => `
        <button type="button" class="sb-polaroid" data-polaroid-index="${idx}">
          <span class="sb-tape" aria-hidden="true"></span>
          <img src="${escapeHtml(m.img)}" alt="${escapeHtml(m.caption)}">
          <p class="sb-polaroid__caption">${escapeHtml(m.caption)}</p>
        </button>
      `
      )
      .join("");

    const countEl = document.getElementById("sb-moments-count");
    if (countEl) countEl.textContent = `${moments.length} moments and counting`;
    initPolaroidLightbox(moments);
  }

  // ── 8. How It Works Interactive Tabs (how-it-works.html) ──
  function initHowItWorksPage() {
    const tabButtons = document.querySelectorAll("[data-flow-tab]");
    if (!tabButtons.length) return;
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-flow-tab");
        tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
        document.querySelectorAll("[data-flow-panel]").forEach((panel) => {
          panel.style.display = panel.getAttribute("data-flow-panel") === target ? "block" : "none";
        });
      });
    });
  }

  // ── 9. Corkboard Sticky-Note FAQ Search & Accordion (faq.html) ──
  function initFaqPage() {
    const board = document.getElementById("sb-faq-board");
    if (!board) return;
    const searchInput = document.getElementById("sb-faq-search");
    const countLabel = document.getElementById("sb-faq-count");
    const notes = Array.from(board.querySelectorAll(".sb-sticky-note"));

    notes.forEach((note) => {
      const btn = note.querySelector(".sb-faq-trigger");
      const answer = note.querySelector(".sb-faq-answer");
      btn?.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!expanded));
        if (answer) answer.style.display = expanded ? "none" : "block";
      });
    });

    searchInput?.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      let visible = 0;
      notes.forEach((note) => {
        const match = !q || note.textContent.toLowerCase().includes(q);
        note.style.display = match ? "block" : "none";
        if (match) visible++;
      });
      if (countLabel) {
        countLabel.textContent = `${visible} ${visible === 1 ? "note" : "notes"} on the board`;
      }
    });
  }

  // ── 10. Contact Stationery Letter (contact.html) ──
  async function initContactPage() {
    const form = document.getElementById("sb-contact-letter-form");
    if (!form) return;

    const selectEl = document.getElementById("contact-hamper-select");
    if (selectEl) {
      try {
        const res = await fetch("/api/v1/catalog/products?limit=20");
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.items)) {
          json.data.items.forEach((p) => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = `${p.title} (₹${p.priceRupees})`;
            selectEl.appendChild(opt);
          });
        }
      } catch {}
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const resultBox = document.getElementById("contact-letter-result");
      const submitBtn = document.getElementById("contact-submit-btn");
      if (submitBtn) submitBtn.disabled = true;

      const payload = {
        name: document.getElementById("contact-name")?.value?.trim(),
        phone: document.getElementById("contact-phone")?.value?.trim(),
        email: document.getElementById("contact-email")?.value?.trim(),
        city: document.getElementById("contact-city")?.value?.trim(),
        hamperId: selectEl?.value || "any",
        message: document.getElementById("contact-message")?.value?.trim(),
        source: "contact_stationery"
      };

      try {
        const res = await fetch("/api/v1/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Could not post your letter.");
        }
        if (resultBox) {
          resultBox.style.display = "block";
          resultBox.innerHTML = `
            <strong>✓ Your letter has been posted to our atelier desk!</strong><br>
            <span style="font-size:0.88rem;">Reference: <code>${escapeHtml(json.data.inquiry.id)}</code> · Priority Queue: <strong>${escapeHtml(json.data.inquiry.priorityTier)}</strong></span><br>
            <a href="${escapeHtml(json.data.waMeUrl)}" target="_blank" rel="noreferrer" class="sb-btn sb-btn--whatsapp sb-btn--sm" style="margin-top:10px;">Send a copy on WhatsApp &rarr;</a>
          `;
        }
        form.reset();
      } catch (err) {
        if (resultBox) {
          resultBox.style.display = "block";
          resultBox.textContent = `⚠ ${err.message}`;
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // ── 11. Delivered Ticket Archives (delivered.html) ──
  async function initDeliveredPage() {
    const grid = document.getElementById("sb-tickets-grid");
    if (!grid) return;

    let items = [];
    try {
      const res = await fetch("/api/v1/catalog/archives");
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.items)) {
        items = json.data.items;
      }
    } catch {}

    if (!items.length) return;
    grid.innerHTML = items
      .map(
        (item) => `
        <article class="sb-ticket">
          <div class="sb-ticket__main">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="sb-ticket__photo">
            <div>
              <span class="mono-label" style="color:var(--sb-accent);">${escapeHtml(item.edition)} · ${escapeHtml(item.category)}</span>
              <h3 style="font-family:var(--sb-font-display);font-size:1.2rem;margin:3px 0;">${escapeHtml(item.title)}</h3>
              <p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.4;">${escapeHtml(item.note)}</p>
              <p class="mono-label" style="margin-top:6px;font-size:0.68rem;">${escapeHtml(item.deliveredTag)} ♥</p>
            </div>
          </div>
          <div class="sb-ticket__stub">
            <span>edition closed</span>
            <a href="index.html?openBuilder=1" style="color:var(--sb-accent);text-decoration:underline;">Remake in Builder &rarr;</a>
          </div>
        </article>
      `
      )
      .join("");
  }

  // ── 12. Reading Scroll Progress Bar & Back-to-Top Atelier Seal ──
  function initScrollProgressAndBackTop() {
    let progressEl = document.getElementById("sb-scroll-progress");
    if (!progressEl) {
      progressEl = document.createElement("div");
      progressEl.id = "sb-scroll-progress";
      progressEl.className = "sb-scroll-progress";
      progressEl.setAttribute("aria-hidden", "true");
      document.body.prepend(progressEl);
    }

    let backTopBtn = document.getElementById("sb-back-top");
    if (!backTopBtn) {
      backTopBtn = document.createElement("button");
      backTopBtn.type = "button";
      backTopBtn.id = "sb-back-top";
      backTopBtn.className = "sb-back-top";
      backTopBtn.setAttribute("aria-label", "Back to top");
      backTopBtn.textContent = "↑";
      document.body.appendChild(backTopBtn);
    }

    backTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const syncScroll = () => {
      const docEl = document.documentElement;
      const maxScroll = docEl.scrollHeight - window.innerHeight;
      const pct = maxScroll > 0 ? Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100)) : 0;
      progressEl.style.width = `${pct.toFixed(1)}%`;
      backTopBtn.classList.toggle("visible", window.scrollY > 420);
    };

    window.addEventListener("scroll", syncScroll, { passive: true });
    syncScroll();
  }

  // ── 13. Animated WhatsApp Chat Sequential Reveal ──
  function initWhatsAppPhoneReveal() {
    const phoneEl = document.getElementById("sb-phone-mockup") || document.querySelector(".sb-phone-mockup");
    if (!phoneEl) return;

    const bubbles = Array.from(phoneEl.querySelectorAll(".sb-wa-bubble[data-wa-seq]"));
    const typingEl = document.getElementById("sb-wa-typing-indicator");

    bubbles.forEach((b) => {
      const seq = Number(b.getAttribute("data-wa-seq") || 1);
      b.style.transition = "opacity 320ms ease, transform 320ms ease";
      b.style.transitionDelay = `${Math.max(0, seq - 1) * 180}ms`;
    });

    const triggerReveal = () => {
      phoneEl.classList.add("wa-revealed");
      if (typingEl) {
        setTimeout(() => {
          typingEl.style.display = "none";
        }, 720);
      }
    };

    if (!("IntersectionObserver" in window)) {
      triggerReveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            triggerReveal();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    const rect = phoneEl.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.95) {
      setTimeout(triggerReveal, 160);
    } else {
      observer.observe(phoneEl);
    }
  }

  function initFloatingVoiceLauncher() {
    if (document.getElementById("sb-voice-fab")) return;
    const hasWa = Boolean(document.getElementById("wa-floating-btn"));
    const modalBtn = document.getElementById("btn-open-voice-concierge");
    const fab = document.createElement(modalBtn ? "button" : "a");
    if (modalBtn) {
      fab.type = "button";
      fab.addEventListener("click", () => modalBtn.click());
    } else {
      fab.href = "index.html?openVoice=1";
    }
    fab.id = "sb-voice-fab";
    fab.className = "sb-voice-fab" + (hasWa ? " sb-voice-fab--with-wa" : "");
    fab.setAttribute("aria-label", "Open Eleanor Voice AI Concierge");
    fab.innerHTML = `<span aria-hidden="true">🎙️</span><span>Voice AI</span>`;
    document.body.appendChild(fab);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initSubpageNavAndCart();
    initFloatingVoiceLauncher();
    initScrollProgressAndBackTop();
    initWhatsAppPhoneReveal();
    initArchedDoors();
    initPhoneVideoPreview();
    initPolaroidLightbox();
    initCatalogPage();
    initHamperDetailPage();
    initMomentsPage();
    initHowItWorksPage();
    initFaqPage();
    initContactPage();
    initDeliveredPage();
  });
})();
