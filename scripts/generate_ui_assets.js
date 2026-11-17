const fs = require('fs');
const path = require('path');

const websiteDir = path.resolve('website');
const indexPath = path.join(websiteDir, 'index.html');

const builderHtml = `
  <!-- ═══════════════ BESPOKE HAMPER BUILDER ATELIER MODAL ═══════════════ -->
  <div id="builder-overlay" class="modal-overlay">
    <div class="builder-modal" role="dialog" aria-modal="true" aria-labelledby="builder-modal-title">
      <header class="builder-modal__head">
        <div>
          <span class="mono-label" id="builder-step-indicator">Step 1 of 11 &middot; Box Selection</span>
          <h2 id="builder-modal-title" class="cart-drawer__title" style="margin: 2px 0 0;">The Bespoke Atelier</h2>
        </div>
        <button id="builder-close-btn" class="cart-drawer__close" aria-label="Close atelier">&times;</button>
      </header>

      <div class="builder-modal__progress-bar">
        <div id="builder-progress" class="builder-modal__progress-fill" style="width: 9%;"></div>
      </div>

      <!-- Live 3D Capacity & Volume Meter -->
      <div style="padding: 12px 28px 0;">
        <div class="fullness-widget">
          <div style="font-size: 0.8rem; font-weight: 500;">
            <span class="mono-label">Packing Volume:</span>
            <strong id="fullness-text" style="margin-left: 6px; font-family: 'JetBrains Mono', monospace;">0 / 5,200 cm³</strong>
          </div>
          <div class="fullness-meter">
            <div id="fullness-bar" class="fullness-meter__bar" style="width: 0%;"></div>
          </div>
          <span id="fullness-badge" class="fullness-badge UNDERFILLED">Underfilled</span>
        </div>
        <div id="builder-collision-alert" style="display: none; padding: 8px 12px; margin-bottom: 12px; border-radius: 6px; font-size: 0.78rem; background: #FFF4E5; color: #8A4B00; border: 1px solid #FFE0B2;"></div>
      </div>

      <div class="builder-modal__body">
        <!-- STEP 1: Box Base -->
        <div class="builder-step-pane active" data-step="1">
          <h3 class="display-text" style="font-size: 1.3rem;">1. Choose Your Box Vessel</h3>
          <p class="text-secondary" style="font-size: 0.88rem; margin-bottom: 16px;">Every composition begins with an heirloom-grade presentation box.</p>
          <div class="builder-card-grid">
            <div class="select-card selected" data-box-id="BOX_KRAFT_RIGID" data-price="45000" data-capacity="5200">
              <div class="select-card__icon">📦</div>
              <div class="select-card__title">Classic Rigid Kraft Box</div>
              <div class="select-card__desc">FSC-certified recycled kraft board with magnetic catch (28 &times; 22 &times; 10 cm).</div>
              <div class="select-card__price">₹ 450</div>
            </div>
            <div class="select-card" data-box-id="BOX_LINEN_KEEPSAKE" data-price="95000" data-capacity="8200">
              <div class="select-card__icon">🪵</div>
              <div class="select-card__title">Linen-Lined Pine Keepsake</div>
              <div class="select-card__desc">Natural pine with raw ecru linen lining and antique brass hinges (32 &times; 25 &times; 12 cm).</div>
              <div class="select-card__price">₹ 950</div>
            </div>
            <div class="select-card" data-box-id="BOX_VELVET_BORDEAUX" data-price="145000" data-capacity="11800">
              <div class="select-card__icon">✨</div>
              <div class="select-card__title">Royal Bordeaux Velvet Casket</div>
              <div class="select-card__desc">Deep wine velvet wrap with gold foiled crest and ribbon clasp (35 &times; 28 &times; 14 cm).</div>
              <div class="select-card__price">₹ 1,450</div>
            </div>
          </div>
        </div>

        <!-- STEP 2: Paper Shred Fill -->
        <div class="builder-step-pane" data-step="2">
          <h3 class="display-text" style="font-size: 1.3rem;">2. Nesting Paper Shred</h3>
          <p class="text-secondary" style="font-size: 0.88rem; margin-bottom: 16px;">Cushioning that cradles each artisanal item inside.</p>
          <div class="builder-card-grid">
            <div class="select-card selected" data-shred="SHRED_ECRU" data-price="0">
              <div class="select-card__icon">🌾</div>
              <div class="select-card__title">Warm Ecru Shred</div>
              <div class="select-card__desc">Unbleached natural cotton paper crinkles. Gentle &amp; timeless.</div>
              <div class="select-card__price">Included</div>
            </div>
            <div class="select-card" data-shred="SHRED_GOLD" data-price="10000">
              <div class="select-card__icon">🌟</div>
              <div class="select-card__title">Golden Honeycomb Paper</div>
              <div class="select-card__desc">Geometric die-cut kraft paper with subtle gold lustre.</div>
              <div class="select-card__price">+ ₹ 100</div>
            </div>
            <div class="select-card" data-shred="SHRED_BORDEAUX" data-price="10000">
              <div class="select-card__icon">🍷</div>
              <div class="select-card__title">Deep Wine Crinkle</div>
              <div class="select-card__desc">Saturated bordeaux paper shred for dramatic, intimate reveals.</div>
              <div class="select-card__price">+ ₹ 100</div>
            </div>
          </div>
        </div>

        <!-- STEP 3: Confections & Beverages -->
        <div class="builder-step-pane" data-step="3">
          <h3 class="display-text" style="font-size: 1.3rem;">3. Confections &amp; Slow Sips</h3>
          <p class="text-secondary" style="font-size: 0.88rem; margin-bottom: 16px;">Select culinary delights crafted by independent makers.</p>
          <div class="builder-card-grid">
            <div class="select-card" data-item-id="ITEM_CHOCO_DARK_HAZELNUT" data-price="42000" data-volume="450">
              <div class="select-card__icon">🍫</div>
              <div class="select-card__title">Single-Origin Hazelnut Dark Cocoa</div>
              <div class="select-card__desc">70% Idukki cocoa bar studded with slow-roasted Oregon hazelnuts.</div>
              <div class="select-card__price">₹ 420 &middot; 450 cm³</div>
            </div>
            <div class="select-card" data-item-id="ITEM_TEA_ROSE_BLUSH" data-price="49000" data-volume="600">
              <div class="select-card__icon">🫖</div>
              <div class="select-card__title">Himalayan Rose Blush Tisane</div>
              <div class="select-card__desc">Organic loose-leaf whole buds with soothing chamomile &amp; peppermint.</div>
              <div class="select-card__price">₹ 490 &middot; 600 cm³</div>
            </div>
            <div class="select-card" data-item-id="ITEM_TONIC_ELDERFLOWER" data-price="34000" data-volume="700">
              <div class="select-card__icon">🍾</div>
              <div class="select-card__title">Elderflower &amp; Pear Sparkling Tonic</div>
              <div class="select-card__desc">Cold-pressed botanical aperitif bottled in amber glass.</div>
              <div class="select-card__price">₹ 340 &middot; 700 cm³</div>
            </div>
          </div>
        </div>

        <!-- STEP 4: Scents & Botanicals -->
        <div class="builder-step-pane" data-step="4">
          <h3 class="display-text" style="font-size: 1.3rem;">4. Ambient Aromatics</h3>
          <p class="text-secondary" style="font-size: 0.88rem; margin-bottom: 16px;">Enchanting notes that fill the room when the lid is lifted.</p>
          <div class="builder-card-grid">
            <div class="select-card" data-item-id="ITEM_CANDLE_AMBER" data-price="68000" data-volume="750">
              <div class="select-card__icon">🕯️</div>
              <div class="select-card__title">Amber &amp; Vanilla Castor Candle</div>
              <div class="select-card__desc">Hand-poured into amber tumbler with wooden crackling wick (40hr burn).</div>
              <div class="select-card__price">₹ 680 &middot; 750 cm³</div>
            </div>
            <div class="select-card" data-item-id="ITEM_BATH_SALTS" data-price="62000" data-volume="850">
              <div class="select-card__icon">🛁</div>
              <div class="select-card__title">French Clay &amp; Bergamot Bath Soak</div>
              <div class="select-card__desc">Epsom crystal salts blended with cold-pressed Calabrian bergamot.</div>
              <div class="select-card__price">₹ 620 &middot; 850 cm³</div>
            </div>
          </div>
        </div>

        <!-- STEP 5: Keepsakes & Textiles -->
        <div class="builder-step-pane" data-step="5">
          <h3 class="display-text" style="font-size: 1.3rem;">5. Lasting Keepsakes</h3>
          <p class="text-secondary" style="font-size: 0.88rem; margin-bottom: 16px;">Treasures kept long after the treats have disappeared.</p>
          <div class="builder-card-grid">
            <div class="select-card" data-item-id="ITEM_BRASS_BELL" data-price="55000" data-volume="350">
              <div class="select-card__icon">🔔</div>
              <div class="select-card__title">Hand-Etched Vintage Brass Bell</div>
              <div class="select-card__desc">Artisanal sand-cast bell paperweight with melodic ring.</div>
              <div class="select-card__price">₹ 550 &middot; 350 cm³</div>
            </div>
            <div class="select-card" data-item-id="ITEM_SILK_NAPKIN" data-price="38000" data-volume="300">
              <div class="select-card__icon">🧣</div>
              <div class="select-card__title">Washed Raw Silk Napkins (Set of 2)</div>
              <div class="select-card__desc">Frayed edge Mulberry silk squares dyed with natural walnut bark.</div>
              <div class="select-card__price">₹ 380 &middot; 300 cm³</div>
            </div>
            <div class="select-card" data-item-id="ITEM_LEATHER_JOURNAL" data-price="79000" data-volume="500">
              <div class="select-card__icon">📖</div>
              <div class="select-card__title">Full-Grain Leather Pocket Journal</div>
              <div class="select-card__desc">Handmade cotton rag deckle paper bound in supple saddle leather.</div>
              <div class="select-card__price">₹ 790 &middot; 500 cm³</div>
            </div>
          </div>
        </div>

        <!-- STEP 6: Ribbon Selection -->
        <div class="builder-step-pane" data-step="6">
          <h3 class="display-text" style="font-size: 1.3rem;">6. Signature Ribbon Finish</h3>
          <p class="text-secondary" style="font-size: 0.88rem; margin-bottom: 16px;">Tied by hand in our signature double-loop French knot.</p>
          <div class="swatch-group">
            <div class="swatch-item selected" data-ribbon-id="RIB_SATIN_CREAM" data-price="0">
              <div class="swatch-circle" style="background: #F5F2EB;"></div>
              <span style="font-size: 0.8rem; font-weight: 500;">Warm Ivory Satin</span>
              <span class="mono-label">Included</span>
            </div>
            <div class="swatch-item" data-ribbon-id="RIB_VELVET_BORDEAUX" data-price="15000">
              <div class="swatch-circle" style="background: #4A1E29;"></div>
              <span style="font-size: 0.8rem; font-weight: 500;">Crushed Bordeaux</span>
              <span class="mono-label">+ ₹ 150</span>
            </div>
            <div class="swatch-item" data-ribbon-id="RIB_RAW_GOLD" data-price="12000">
              <div class="swatch-circle" style="background: #C89D42;"></div>
              <span style="font-size: 0.8rem; font-weight: 500;">Clay Gold Silk</span>
              <span class="mono-label">+ ₹ 120</span>
            </div>
            <div class="swatch-item" data-ribbon-id="RIB_GROSGRAIN_FOREST" data-price="10000">
              <div class="swatch-circle" style="background: #2E5A44;"></div>
              <span style="font-size: 0.8rem; font-weight: 500;">Forest Pine</span>
              <span class="mono-label">+ ₹ 100</span>
            </div>
          </div>
        </div>

        <!-- STEP 7: Wax Seal Crest -->
        <div class="builder-step-pane" data-step="7">
          <h3 class="display-text" style="font-size: 1.3rem;">7. Wax Seal Crest</h3>
          <p class="text-secondary" style="font-size: 0.88rem; margin-bottom: 16px;">Hand-melted sealing wax stamped with an antique brass seal.</p>
          <div class="builder-card-grid">
            <div class="select-card selected" data-wax-id="WAX_BOTANICAL_GOLD" data-price="12000">
              <div class="select-card__icon">🌿</div>
              <div class="select-card__title">Botanical Olive Sprig</div>
              <div class="select-card__desc">Shimmering antique gold metallic wax with fine leaf detail.</div>
              <div class="select-card__price">₹ 120</div>
            </div>
            <div class="select-card" data-wax-id="WAX_CREST_BORDEAUX" data-price="15000">
              <div class="select-card__icon">🛡️</div>
              <div class="select-card__title">Atelier Monogram Crest</div>
              <div class="select-card__desc">Deep bordeaux wax stamped with the iconic HBH insignia.</div>
              <div class="select-card__price">₹ 150</div>
            </div>
            <div class="select-card" data-wax-id="WAX_HEART_ROSE" data-price="12000">
              <div class="select-card__icon">🤍</div>
              <div class="select-card__title">Minimalist Heart</div>
              <div class="select-card__desc">Matte rose blush wax stamp for romantic sentiments.</div>
              <div class="select-card__price">₹ 120</div>
            </div>
            <div class="select-card" data-wax-id="WAX_FLORAL_SAGE" data-price="12000">
              <div class="select-card__icon">🌸</div>
              <div class="select-card__title">Wildflower Wreath</div>
              <div class="select-card__desc">Calming sage green wax with intricate wild blossom ring.</div>
              <div class="select-card__price">₹ 120</div>
            </div>
          </div>
        </div>

        <!-- STEP 8: Dried Florals -->
        <div class="builder-step-pane" data-step="8">
          <h3 class="display-text" style="font-size: 1.3rem;">8. Botanical Sprig Tuck</h3>
          <p class="text-secondary" style="font-size: 0.88rem; margin-bottom: 16px;">Tucked beneath the ribbon bow on the exterior lid.</p>
          <div class="builder-card-grid">
            <div class="select-card selected" data-botanical="BOT_BABYS_BREATH" data-price="0">
              <div class="select-card__icon">☁️</div>
              <div class="select-card__title">Preserved Baby's Breath</div>
              <div class="select-card__desc">Delicate cloud of white dried gypsophila florets.</div>
              <div class="select-card__price">Included</div>
            </div>
            <div class="select-card" data-botanical="BOT_LAVENDER" data-price="8000">
              <div class="select-card__icon">🌾</div>
              <div class="select-card__title">French Lavender Sprig</div>
              <div class="select-card__desc">Fragrant dried Provence lavender stems with purple tint.</div>
              <div class="select-card__price">+ ₹ 80</div>
            </div>
            <div class="select-card" data-botanical="BOT_WHEAT" data-price="8000">
              <div class="select-card__icon">🌾</div>
              <div class="select-card__title">Golden Wheat Stalks</div>
              <div class="select-card__desc">Rustic sun-dried golden sheaves symbolizing abundance.</div>
              <div class="select-card__price">+ ₹ 80</div>
            </div>
          </div>
        </div>

        <!-- STEP 9: Calligraphy Note -->
        <div class="builder-step-pane" data-step="9">
          <h3 class="display-text" style="font-size: 1.3rem;">9. Handwritten Calligraphy Card</h3>
          <p class="text-secondary" style="font-size: 0.88rem; margin-bottom: 16px;">Penned with dip-pen sepia ink on 300gsm cotton deckled paper.</p>
          <div class="card-writing-box">
            <div class="form-row" style="margin-bottom: 12px;">
              <div>
                <label class="form-label" for="card-to-input">To (Recipient Name)</label>
                <input type="text" id="card-to-input" class="form-input" placeholder="e.g. My Dearest Almas">
              </div>
              <div>
                <label class="form-label" for="card-from-input">From (Sender Name)</label>
                <input type="text" id="card-from-input" class="form-input" placeholder="e.g. With Love, Kabir">
              </div>
            </div>
            <label class="form-label" for="card-message-textarea">Your Personal Note</label>
            <textarea id="card-message-textarea" class="card-writing-textarea" maxlength="280" placeholder="Write your words here... They will be penned by hand exactly as written."></textarea>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.75rem; color: var(--text-tertiary);">
              <span>Max 280 characters</span>
              <span id="card-char-counter">0 / 280</span>
            </div>
          </div>
        </div>

        <!-- STEP 10: Polaroid Photo -->
        <div class="builder-step-pane" data-step="10">
          <h3 class="display-text" style="font-size: 1.3rem;">10. Polaroid Keepsake Print</h3>
          <p class="text-secondary" style="font-size: 0.88rem; margin-bottom: 16px;">Tuck a real printed Fujifilm square photo inside the inner lid.</p>
          <div style="text-align: center; margin-top: 14px;">
            <div class="polaroid-slip">
              <img id="polaroid-preview-img" src="images/hero-hamper.jpg" alt="Polaroid Memory" class="polaroid-slip__img">
              <input type="text" id="polaroid-caption-input" class="form-input" style="font-family: 'Playfair Display', serif; font-style: italic; font-size: 0.8rem; text-align: center; padding: 4px;" placeholder="Add caption...">
            </div>
            <label class="btn btn--outline btn--sm" style="cursor: pointer; display: inline-block; margin-top: 8px;">
              Choose Photo
              <input type="file" id="polaroid-upload-input" accept="image/*" style="display: none;">
            </label>
            <p class="mono-label" style="margin-top: 8px;">Optional &middot; Printed on archival instant film (+ ₹ 120)</p>
          </div>
        </div>

        <!-- STEP 11: Final Review -->
        <div class="builder-step-pane" data-step="11">
          <h3 class="display-text" style="font-size: 1.3rem;">11. Review Your Composition</h3>
          <p class="text-secondary" style="font-size: 0.88rem; margin-bottom: 16px;">Every element confirmed, ready to be hand-tied in our studio.</p>
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 20px;">
            <div id="builder-summary-breakdown" style="display: flex; flex-direction: column; gap: 8px; font-size: 0.88rem;">
              <!-- Injected by script -->
            </div>
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border-accent); display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 600;">Atelier Total</span>
              <span id="builder-final-total" style="font-family: 'JetBrains Mono', monospace; font-size: 1.3rem; font-weight: 700; color: var(--color-bordeaux);">₹ 0</span>
            </div>
          </div>
        </div>
      </div>

      <footer class="builder-modal__foot">
        <button id="builder-prev-btn" class="btn btn--outline btn--sm" style="visibility: hidden;">&larr; Previous</button>
        <div class="builder-price-ticker">
          <span class="mono-label" style="font-size: 0.7rem; display: block; line-height: 1;">Current Total</span>
          <span id="builder-price-ticker-val">₹ 450</span>
        </div>
        <button id="builder-next-btn" class="btn btn--bordeaux btn--sm">Next Step &rarr;</button>
        <button id="builder-finish-btn" class="btn btn--primary btn--sm" style="display: none;">Add Hamper to Bag &rarr;</button>
      </footer>
    </div>
  </div>
`;

const checkoutHtml = `
  <!-- ═══════════════ 2-STEP CHECKOUT MODAL ═══════════════ -->
  <div id="checkout-overlay" class="modal-overlay">
    <div class="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
        <h2 id="checkout-title" class="cart-drawer__title" style="margin: 0;">Checkout Atelier</h2>
        <button id="checkout-close-btn" class="cart-drawer__close" aria-label="Close checkout">&times;</button>
      </div>

      <!-- Step 1: Address & PIN Verification -->
      <div id="checkout-step-1">
        <p class="mono-label" style="margin-bottom: 12px;">Step 1 &middot; Recipient &amp; Delivery Destination</p>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="co-recipient-name">Recipient Name *</label>
            <input type="text" id="co-recipient-name" class="form-input" placeholder="e.g. Almas Fatima" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="co-recipient-phone">Mobile Phone *</label>
            <input type="tel" id="co-recipient-phone" class="form-input" placeholder="e.g. 9876543210" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="co-address">Street Address / Suite / Landmark *</label>
          <input type="text" id="co-address" class="form-input" placeholder="e.g. Flat 402, Rosewood Manor, 12th Main Road" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="co-pincode">6-Digit Indian PIN Code *</label>
            <input type="text" id="co-pincode" class="form-input" maxlength="6" placeholder="e.g. 110001 or 400001" required>
            <div id="pincode-status" style="font-size: 0.78rem; margin-top: 4px; display: none;"></div>
          </div>
          <div class="form-group">
            <label class="form-label" for="co-city">City &amp; State *</label>
            <input type="text" id="co-city" class="form-input" placeholder="Auto-fills from PIN" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="co-special-inst">Delivery Instructions (Optional)</label>
          <input type="text" id="co-special-inst" class="form-input" placeholder="e.g. Please ring bell twice, fragile hamper.">
        </div>

        <button id="checkout-proceed-btn" class="btn btn--bordeaux btn--block" style="margin-top: 14px;">
          Continue to Payment &rarr;
        </button>
      </div>

      <!-- Step 2: Payment Simulation -->
      <div id="checkout-step-2" style="display: none;">
        <p class="mono-label" style="margin-bottom: 12px;">Step 2 &middot; Secure Payment Selection</p>
        
        <div style="background: var(--bg-surface); padding: 14px 18px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Payable Amount:</span>
            <strong id="co-final-amount" style="font-family: 'JetBrains Mono', monospace; color: var(--color-bordeaux);">₹ 0</strong>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-tertiary);">Includes all taxes &middot; Razorpay 256-bit SSL Encrypted</div>
        </div>

        <label class="form-label">Select Payment Method</label>
        <div class="payment-methods">
          <div class="payment-method-card selected" data-method="UPI">
            <div style="font-size: 1.4rem;">📱</div>
            <strong style="font-size: 0.85rem; display: block; margin-top: 4px;">Instant UPI</strong>
            <span style="font-size: 0.72rem; color: var(--text-tertiary);">GPay / PhonePe / Paytm</span>
          </div>
          <div class="payment-method-card" data-method="CARD">
            <div style="font-size: 1.4rem;">💳</div>
            <strong style="font-size: 0.85rem; display: block; margin-top: 4px;">Cards</strong>
            <span style="font-size: 0.72rem; color: var(--text-tertiary);">Visa / Mastercard / RuPay</span>
          </div>
          <div class="payment-method-card" data-method="NETBANKING">
            <div style="font-size: 1.4rem;">🏛️</div>
            <strong style="font-size: 0.85rem; display: block; margin-top: 4px;">Net Banking</strong>
            <span style="font-size: 0.72rem; color: var(--text-tertiary);">All Indian Banks</span>
          </div>
        </div>

        <div id="upi-qr-box" style="text-align: center; margin: 18px 0; padding: 16px; background: #FAF6F5; border-radius: 8px; border: 1px dashed var(--border-accent);">
          <p class="mono-label" style="margin-bottom: 6px;">Simulated UPI QR &middot; Scan &amp; Pay</p>
          <div style="display: inline-block; padding: 8px; background: #fff; border: 1px solid #ddd; border-radius: 4px;">
            <svg width="120" height="120" viewBox="0 0 100 100">
              <rect width="100" height="100" fill="#ffffff"/>
              <rect x="10" y="10" width="30" height="30" fill="#4A1E29"/>
              <rect x="15" y="15" width="20" height="20" fill="#ffffff"/>
              <rect x="20" y="20" width="10" height="10" fill="#4A1E29"/>
              <rect x="60" y="10" width="30" height="30" fill="#4A1E29"/>
              <rect x="65" y="15" width="20" height="20" fill="#ffffff"/>
              <rect x="70" y="20" width="10" height="10" fill="#4A1E29"/>
              <rect x="10" y="60" width="30" height="30" fill="#4A1E29"/>
              <rect x="15" y="65" width="20" height="20" fill="#ffffff"/>
              <rect x="20" y="70" width="10" height="10" fill="#4A1E29"/>
              <rect x="45" y="45" width="10" height="10" fill="#C89D42"/>
              <rect x="60" y="60" width="12" height="12" fill="#4A1E29"/>
              <rect x="75" y="75" width="15" height="15" fill="#4A1E29"/>
            </svg>
          </div>
          <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 6px;">VPA: <code>hampersbyher@icici</code></p>
        </div>

        <div style="display: flex; gap: 10px;">
          <button id="checkout-back-btn" class="btn btn--outline btn--sm">&larr; Back</button>
          <button id="checkout-pay-btn" class="btn btn--bordeaux btn--block">
            Confirm &amp; Authorize Payment &rarr;
          </button>
        </div>
      </div>

      <!-- Step 3: Order Confirmation Timeline -->
      <div id="checkout-step-3" style="display: none; text-align: center; padding: 14px 0;">
        <div style="font-size: 2.8rem; margin-bottom: 8px;">✨</div>
        <h3 class="display-text" style="font-size: 1.5rem; color: var(--color-bordeaux);">Composition Confirmed</h3>
        <p class="mono-label" id="confirmed-order-number" style="font-size: 0.95rem; margin: 8px 0;">Order # HBH-20260918-9182</p>
        <p class="text-secondary" style="font-size: 0.88rem; max-width: 420px; margin: 0 auto 20px;">
          Your artisanal hamper is now scheduled with our master binder. We will compose, press with sealing wax, and dispatch with express priority.
        </p>

        <div style="text-align: left; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
          <p class="mono-label" style="margin-bottom: 12px;">Live Atelier Timeline</p>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem;">
            <div style="display: flex; gap: 10px; align-items: center;">
              <span style="color: var(--color-success);">✓</span>
              <span><strong>Payment Received:</strong> Authorised via Razorpay Secure</span>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
              <span style="color: var(--color-gold);">●</span>
              <span><strong>Studio Queue:</strong> Hand-curation and calligraphy in progress</span>
            </div>
            <div style="display: flex; gap: 10px; align-items: center; color: var(--text-tertiary);">
              <span>○</span>
              <span><strong>Sealing &amp; Ribboning:</strong> Wax crest application</span>
            </div>
            <div style="display: flex; gap: 10px; align-items: center; color: var(--text-tertiary);">
              <span>○</span>
              <span><strong>Air Courier Dispatch:</strong> BlueDart / Delhivery Express</span>
            </div>
          </div>
        </div>

        <a id="confirmed-whatsapp-btn" href="https://wa.me/?text=Hi%20Hampers%20by%20Her,%20I%20just%20placed%20order" target="_blank" class="btn btn--primary btn--block">
          Chat with Atelier on WhatsApp &rarr;
        </a>
      </div>
    </div>
  </div>
`;

const toastHtml = `
  <!-- ═══════════════ GLOBAL TOAST NOTIFICATION ═══════════════ -->
  <div id="hbh-toast" class="hbh-toast" role="status" aria-live="polite">Item added to your gifting bag</div>
`;

fs.writeFileSync(path.join(websiteDir, 'modals_builder.html'), builderHtml, 'utf8');
fs.writeFileSync(path.join(websiteDir, 'modals_checkout.html'), checkoutHtml, 'utf8');
fs.writeFileSync(path.join(websiteDir, 'toast.html'), toastHtml, 'utf8');

console.log('Modal templates written successfully.');

// Now inject into index.html if not already present
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Ensure styles_ext.css is linked
if (!indexContent.includes('styles_ext.css')) {
  indexContent = indexContent.replace(
    '<link rel="stylesheet" href="styles.css">',
    '<link rel="stylesheet" href="styles.css">\n  <link rel="stylesheet" href="styles_ext.css">'
  );
}

// Inject cart, builder, checkout, and toast before <script src="script.js">
if (!indexContent.includes('id="cart-drawer"')) {
  const cartHtml = fs.readFileSync(path.join(websiteDir, 'modals_cart.html'), 'utf8');
  const fullModals = [cartHtml, builderHtml, checkoutHtml, toastHtml].join('\n');
  indexContent = indexContent.replace('<script src="script.js"></script>', fullModals + '\n  <script src="script.js"></script>');
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log('Injected all modals into index.html successfully!');
} else {
  console.log('Modals already injected or partly present in index.html.');
}
