# FRONTEND STATE — Hampers by Her Digital Commerce Ecosystem

## 1. Storefront & Atelier UI
- **Active Implementation**: Tactile Storybook & Scrapbook multi-page storefront in `website/` (`index.html`, `catalog.html`, `hamper.html`, `moments.html`, `how-it-works.html`, `faq.html`, `contact.html`, `delivered.html`, `storybook.css`, `storybook-ui.js`, `styles.css`, `styles_ext.css`, `script.js`).
- **Storybook Reference Architecture**: Inspired by `https://puppy.instabizweb.com/` featuring theme-synced scalloped sticky navbar, reading progress bar (`#sb-scroll-progress`), back-to-top button (`#sb-back-top`), full-screen warm-gold mobile drawer + unified `.mobile-bar` docks, peekaboo arches over quilted diamond fence, New Delhi studio illustration, scroll-opening arched wooden doors, Two-Ways wooden signpost, tilted WhatsApp phone mockup with staggered bubble reveal & playable 4D video preview, open Atelier Passport stamps, taped Polaroid wall + dark lightbox, corkboard sticky-note FAQ with live search, stationery fill-in-the-blank contact letter (synced to Studio OS `Stationery Letters` queue), PDP pairings (`#detail-recommendations-grid`), and perforated boarding-pass archive tickets.
- **Design System Tokens**: 12 switchable Theme Studio presets (`themes.css`, `theme-switcher.js`), led by **Atelier Signature** (`#4A1E29` Bordeaux, `#C89D42` Clay Gold, `#FAF6EC` Warm Cream, `#1C7C54` WhatsApp Forest Green) and **Craft Storybook** (`#FAF6EC` Warm Cream, `#F5D69E` Honey, `#8F3F14` Terracotta, `#2B180E` Espresso).
- **Typography**: Fraunces & Playfair Display (editorial serif), Caveat (handwritten script accents), Plus Jakarta Sans (clean UI sans), JetBrains Mono (labels & dimensions).

## 2. Interactive 4D Motion & Sensory UX Suite
- **4D Gyroscopic Tilt & Parallax**:
  - Implemented on `.product-card` with dynamic specular light reflection gloss overlay (`.specular-glare`) and multi-layer Z-depth parallax (`translateZ`).
  - Throttled through `requestAnimationFrame` to eliminate frame drops and layout thrashing on high-frequency gaming mice (500-1000Hz).
- **4-Step Virtual Unboxing Theater (`#unboxing-4d-modal`)**:
  - Interactive multi-stage unboxing: Ribbon Untying -> Botanical Wax Seal Cracking -> Keepsake Box Lid 3D Elevation -> Floating Gourmet Inclusions Reveal.
  - 4-step sensory navigation pills with 3D perspective transforms.
- **Ambient Golden Dust Particle Engine**:
  - Canvas-based particle simulation (`#ambient-particles-canvas`) running at 60fps with Brownian drift physics.
  - Includes `visibilitychange` listener automatically halting the animation loop when the browser tab is hidden or backgrounded, conserving CPU and battery.
- **Magnetic Luxury Buttons**:
  - Cursor attraction effect on `.magnetic-btn` debounced with `requestAnimationFrame`.
- **Synthetic Web Audio Soundscapes**:
  - Real-time zero-dependency procedural audio synthesis via Web Audio API (`playVelvetTap` at 180Hz sine exponential decay, `playGoldenChime` with high-Q 2400Hz bell harmonics).
- **Accessibility & Compliance**:
  - WCAG 2.2 AA compliant keyboard navigation with global `Escape` key handlers dismissing active modals and drawers.

## 3. Modals & Interactive Commerce Flow
- **Enriched PDP Modal (`#item-modal-overlay`)**: Multi-angle image gallery, artisan provenance specs, live PIN code delivery check, and customization selection.
- **Bespoke Hamper Builder Modal (`#builder-modal-overlay`)**: 11-step interactive customization wizard with real-time 3D volumetric capacity gauge.
- **Fast Checkout Modal (`#checkout-modal-overlay`)**: Shipping address capture, ALMAS10 coupon computation, and dynamic payment rail selector.
- **WhatsApp Concierge Widget (`#wa-floating-btn` & `#wa-popover`)**: Direct access to 2-way conversational support and artisan consultations.
