# FRONTEND STATE — Hampers by Her

## 1. Current State
- **Prototype Status**: Interactive static atelier preview active in `website/` (`index.html`, `styles.css`, `script.js`). Features occasions bar, curated collections, bespoke builder preview, Instagram aesthetic grid, and testimonials.
- **Target Architecture**: Next.js 15 (App Router), React 19, TypeScript 5.5+.
- **Design System Tokens**: Warm luxury palette defined (`#4A1E29` Bordeaux, `#C89D42` Clay Gold, `#FDFBF7` Warm Alabaster, `#2E5A44` Forest Green).
- **Typography**: Playfair Display (editorial serif), Plus Jakarta Sans (clean UI sans), JetBrains Mono (labels & dimensions).

## 2. Component Boundaries
- **Server Components (RSC)**: Catalog browsing, occasion collections, static story pages, SEO metadata.
- **Client Components ('use client')**: 11-step Hamper Builder wizard, cart slide-over, live fullness gauge, interactive customization controls, checkout form.

## 3. Client State Management
- **Volatile UI State**: Zustand stores (`useCartStore`, `useBuilderStore`, `useAuthStore`).
- **Server Cache & Sync**: TanStack Query v5 with optimistic mutations.
- **Persistence**: `localStorage` backup for active hamper draft (`hbh_builder_v2`) and cart (`hbh_cart_v2`).

## 4. Performance & Core Web Vitals Targets
- **LCP**: $\le 2.2$s (hero priority loading, WebP/AVIF images).
- **INP**: $\le 150$ms (lightweight component islands).
- **CLS**: $\le 0.05$ (explicit aspect ratios on all product media).
- **Bundle Size**: Critical path JS $\le 90$KB gzipped.
