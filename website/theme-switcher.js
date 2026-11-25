/**
 * HAMPERS BY HER — UNIVERSAL THEME FACTORY SWITCHER
 * Supports Atelier Signature + All 10 Official Theme Factory Presets
 * Persists selection in localStorage ('hbh_theme_factory_v1') & syncs across
 * Storefront (index.html), Atelier Studio OS (admin.html), and Lookbook Deck (lookbook.html).
 */
(function () {
  const STORAGE_KEY = "hbh_theme_factory_v1";

  const THEME_CATALOG = [
    {
      id: "atelier-signature",
      name: "Atelier Signature",
      mode: "Light",
      vibe: "Warm Creme · Deep Bordeaux · Champagne Gold",
      swatches: ["#4A1E29", "#C89D42", "#FAF6EC", "#1C7C54"]
    },
    {
      id: "craft-storybook",
      name: "Craft Storybook",
      mode: "Light",
      vibe: "Warm Cream · Caramel Terracotta · Honey · Espresso",
      swatches: ["#8F3F14", "#F5D69E", "#FAF6EC", "#2B180E"]
    },
    {
      id: "desert-rose",
      name: "Desert Rose",
      mode: "Light",
      vibe: "Dusty Rose · Clay · Sand · Deep Burgundy",
      swatches: ["#5D2E46", "#D4A5A5", "#B87D6D", "#E8D5C4"]
    },
    {
      id: "golden-hour",
      name: "Golden Hour",
      mode: "Light",
      vibe: "Mustard Gold · Terracotta · Warm Beige · Chocolate",
      swatches: ["#4A403A", "#F4A900", "#C1666B", "#D4B896"]
    },
    {
      id: "botanical-garden",
      name: "Botanical Garden",
      mode: "Light",
      vibe: "Fern Green · Marigold · Terracotta · Cream",
      swatches: ["#4A7C59", "#F9A620", "#B7472A", "#F5F3ED"]
    },
    {
      id: "forest-canopy",
      name: "Forest Canopy",
      mode: "Light",
      vibe: "Forest Green · Sage · Olive · Ivory",
      swatches: ["#2D4A2B", "#7D8471", "#A4AC86", "#FAF9F6"]
    },
    {
      id: "sunset-boulevard",
      name: "Sunset Boulevard",
      mode: "Light",
      vibe: "Burnt Orange · Coral · Warm Sand · Deep Teal",
      swatches: ["#264653", "#E76F51", "#F4A261", "#E9C46A"]
    },
    {
      id: "arctic-frost",
      name: "Arctic Frost",
      mode: "Light",
      vibe: "Ice Blue · Steel Blue · Silver · Crisp White",
      swatches: ["#4A6FA5", "#D4E4F7", "#C0C0C0", "#FAFAFA"]
    },
    {
      id: "modern-minimalist",
      name: "Modern Minimalist",
      mode: "Light",
      vibe: "Charcoal · Slate Gray · Light Gray · White",
      swatches: ["#36454F", "#708090", "#D3D3D3", "#FFFFFF"]
    },
    {
      id: "ocean-depths",
      name: "Ocean Depths",
      mode: "Dark",
      vibe: "Deep Navy · Teal · Seafoam · Cream",
      swatches: ["#1A2332", "#2D8B8B", "#A8DADC", "#F1FAEE"]
    },
    {
      id: "midnight-galaxy",
      name: "Midnight Galaxy",
      mode: "Dark",
      vibe: "Deep Purple · Cosmic Blue · Lavender · Silver",
      swatches: ["#2B1E3E", "#4A4E8F", "#A490C2", "#E6E6FA"]
    },
    {
      id: "tech-innovation",
      name: "Tech Innovation",
      mode: "Dark",
      vibe: "Electric Blue · Neon Cyan · Dark Gray · White",
      swatches: ["#1E1E1E", "#0066FF", "#00FFFF", "#FFFFFF"]
    }
  ];

  const VALID_IDS = new Set(THEME_CATALOG.map((t) => t.id));

  function getInitialTheme() {
    try {
      const params = new URLSearchParams(window.location.search);
      const qTheme = params.get("theme");
      if (qTheme && VALID_IDS.has(qTheme)) return qTheme;
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && VALID_IDS.has(saved)) return saved;
    } catch {}
    return "atelier-signature";
  }

  function applyTheme(themeId, persist = true) {
    const chosen = VALID_IDS.has(themeId) ? themeId : "atelier-signature";
    if (chosen === "atelier-signature") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", chosen);
    }
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, chosen);
      } catch {}
    }

    const activeObj = THEME_CATALOG.find((t) => t.id === chosen) || THEME_CATALOG[0];
    const labelEl = document.getElementById("theme-studio-active-label");
    if (labelEl) labelEl.textContent = activeObj.name;

    document.querySelectorAll(".theme-swatch-card").forEach((card) => {
      card.classList.toggle("active", card.getAttribute("data-theme-id") === chosen);
    });

    window.dispatchEvent(new CustomEvent("hbh:themechange", { detail: activeObj }));
    return activeObj;
  }

  // Apply immediately before paint to avoid flash
  const initialTheme = getInitialTheme();
  applyTheme(initialTheme, false);

  function mountThemeStudioWidget() {
    if (document.getElementById("theme-studio-fab")) return;

    const currentId = getInitialTheme();
    const currentTheme = THEME_CATALOG.find((t) => t.id === currentId) || THEME_CATALOG[0];

    const fab = document.createElement("button");
    fab.type = "button";
    fab.id = "theme-studio-fab";
    fab.className = "theme-studio-fab";
    fab.setAttribute("aria-label", "Open Theme Factory Studio");
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-controls", "theme-studio-panel");
    fab.innerHTML = `<span>🎨</span><span id="theme-studio-active-label">${currentTheme.name}</span>`;

    const panel = document.createElement("div");
    panel.id = "theme-studio-panel";
    panel.className = "theme-studio-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Theme Factory Palette Switcher");

    const isLookbook = window.location.pathname.endsWith("lookbook.html");
    const cardsHtml = THEME_CATALOG.map((t) => {
      const dots = t.swatches
        .map((hex) => `<span class="theme-swatch-dot" style="background:${hex};" title="${hex}"></span>`)
        .join("");
      const activeClass = t.id === currentId ? " active" : "";
      return `
        <button type="button" class="theme-swatch-card${activeClass}" data-theme-id="${t.id}">
          <div>
            <div style="font-weight:600; font-size:0.84rem;">${t.name} <span style="opacity:0.65; font-size:0.68rem;">(${t.mode})</span></div>
            <div style="font-size:0.7rem; opacity:0.75; margin-top:2px;">${t.vibe}</div>
          </div>
          <div class="theme-swatch-dots">${dots}</div>
        </button>
      `;
    }).join("");

    panel.innerHTML = `
      <div class="theme-studio-head">
        <div>
          <div style="font-family:'JetBrains Mono',monospace; font-size:0.65rem; text-transform:uppercase; opacity:0.7;">Theme Factory · 12 Presets</div>
          <h3 class="theme-studio-title">Atelier Theme Studio</h3>
        </div>
        <button type="button" id="theme-studio-close" style="background:none; border:none; font-size:1.3rem; cursor:pointer; color:inherit;" aria-label="Close Theme Studio">&times;</button>
      </div>
      <div class="theme-studio-grid">${cardsHtml}</div>
      <div class="theme-studio-footer">
        <span style="opacity:0.7;">Synced across all pages</span>
        <a class="theme-studio-link" href="${isLookbook ? "index.html" : "lookbook.html"}">${isLookbook ? "← Storefront" : "Executive Lookbook →"}</a>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    function setThemePanelOpen(isOpen) {
      panel.classList.toggle("open", isOpen);
      fab.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    fab.addEventListener("click", (e) => {
      e.stopPropagation();
      setThemePanelOpen(!panel.classList.contains("open"));
    });

    panel.querySelector("#theme-studio-close")?.addEventListener("click", () => {
      setThemePanelOpen(false);
    });

    panel.querySelectorAll(".theme-swatch-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-theme-id");
        applyTheme(id, true);
      });
    });

    document.addEventListener("click", (e) => {
      if (panel.classList.contains("open") && !panel.contains(e.target) && !fab.contains(e.target)) {
        setThemePanelOpen(false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("open")) {
        setThemePanelOpen(false);
      }
    });
  }

  window.HBHThemeFactory = {
    catalog: THEME_CATALOG,
    applyTheme,
    getActiveTheme: getInitialTheme
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountThemeStudioWidget);
  } else {
    mountThemeStudioWidget();
  }
})();
