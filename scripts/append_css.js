const fs = require('fs');
const path = require('path');

const cssPath = path.resolve('website', 'styles.css');
const css = 
/* ── DRAWER & MODAL OVERLAYS ── */
.drawer-overlay, .modal-overlay {
  position: fixed; inset: 0; background: rgba(34, 30, 31, 0.6);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  z-index: 1000; opacity: 0; visibility: hidden;
  transition: opacity 300ms var(--ease-gift), visibility 300ms;
}
.drawer-overlay.open, .modal-overlay.open { opacity: 1; visibility: visible; }

/* ── CART DRAWER ── */
.cart-drawer {
  position: fixed; top: 0; right: 0; bottom: 0; width: 100%; max-width: 460px;
  background: var(--bg-canvas); box-shadow: -8px 0 32px rgba(74, 30, 41, 0.15);
  z-index: 1001; display: flex; flex-direction: column; transform: translateX(100%);
  transition: transform 400ms cubic-bezier(0.32, 0.72, 0, 1);
}
.drawer-overlay.open .cart-drawer { transform: translateX(0); }
.cart-drawer__header {
  padding: 22px 26px; border-bottom: 1px solid var(--border-subtle);
  display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface);
}
.cart-drawer__title { font-family: 'Playfair Display', serif; font-size: 1.35rem; font-weight: 600; color: var(--color-bordeaux); }
.cart-drawer__close { background: none; border: none; font-size: 1.75rem; color: var(--text-secondary); cursor: pointer; padding: 4px; }
.cart-drawer__body { flex: 1; overflow-y: auto; padding: 22px 26px; display: flex; flex-direction: column; gap: 16px; }

/* Shipping Meter */
.shipping-meter { background: var(--color-gold-subtle); padding: 12px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-accent); }
.shipping-meter__text { font-size: 0.82rem; font-weight: 500; color: var(--color-bordeaux); margin-bottom: 6px; display: flex; justify-content: space-between; }
.shipping-meter__track { height: 6px; background: rgba(200, 157, 66, 0.25); border-radius: 999px; overflow: hidden; }
.shipping-meter__bar { height: 100%; background: var(--color-bordeaux); width: 0%; transition: width 400ms ease; }

/* Cart Item */
.cart-item { display: grid; grid-template-columns: 75px 1fr auto; gap: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--border-subtle); align-items: center; }
.cart-item__img { width: 75px; height: 75px; object-fit: cover; border-radius: var(--radius-sm); }
.cart-item__title { font-family: 'Playfair Display', serif; font-size: 0.95rem; font-weight: 600; }
.cart-item__subtitle { font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 6px; }
.cart-item__price { font-family: 'JetBrains Mono', monospace; font-size: 0.88rem; font-weight: 600; color: var(--color-bordeaux); }
.cart-item__qty { display: inline-flex; align-items: center; border: 1px solid var(--border-subtle); border-radius: var(--radius-pill); background: var(--bg-surface); }
.cart-item__qty-btn { background: none; border: none; padding: 3px 8px; cursor: pointer; }
.cart-item__qty-val { font-size: 0.8rem; font-family: 'JetBrains Mono', monospace; padding: 0 4px; }
.cart-item__remove { background: none; border: none; color: var(--text-tertiary); cursor: pointer; font-size: 0.75rem; text-decoration: underline; }

/* Cart Footer */
.cart-drawer__footer { padding: 18px 26px; background: var(--bg-surface); border-top: 1px solid var(--border-subtle); }
.cart-summary-row { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; }
.cart-summary-row--total { font-size: 1.1rem; font-weight: 600; color: var(--color-bordeaux); margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-accent); }
.coupon-box { display: flex; gap: 8px; margin-bottom: 14px; }
.coupon-input { flex: 1; padding: 8px 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; text-transform: uppercase; }
;

fs.appendFileSync(cssPath, css, 'utf8');
console.log('Appended Cart Drawer CSS');
