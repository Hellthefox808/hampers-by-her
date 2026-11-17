<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# ADR 005: Mandatory Atelier QC Photo Gate & Carrier Logistics Architecture

## Status
APPROVED

## Date
2026-09-18

## Context
As an artisanal luxury gifting atelier, Hampers by Her crafts bespoke keepsake hampers where each box involves hand-pressed botanical wax seals, hand-tied raw silk ribbons, and dip-pen copperplate calligraphy cards. Because of the bespoke nature and unboxing expectations of patrons, delivering an incorrect ribbon colorway, typo in the handwritten note, or damaged inclusion fatally harms brand reputation and leads to costly reverse logistics.

We required a programmatic gate ensuring no bespoke order is ever dispatched without physical inspection, and an automated logistics carrier pipeline linking studio packaging with real-time AWB generation and carrier scan tracking.

## Decision
1. **Mandatory QC Photo Inspection Gate**:
   - Programmatic state transition invariant: Orders in `IN_PRODUCTION` cannot transition to `QUALITY_CHECKED` or `DISPATCHED` without calling `/api/v1/admin/orders/:orderNumber/qc-inspect`.
   - The inspection payload requires:
     - Verified Inspector ID & Name (`inspectorId`, `inspectorName`).
     - Cryptographic SHA-256 hash or high-resolution URL of photographic evidence (`photoProofUrl`, `photoProofHash`).
     - Verification of all 4 criteria: Ribbon silk binding, wax seal integrity, handwritten calligraphy text accuracy, and component completeness.
2. **Automated Carrier Logistics Adapter**:
   - Real-time generation of compliant Air Waybill (AWB) numbers (`HBH-AWB-2026-XXXXXX`) across BlueDart Priority Air, Delhivery Express, and Shiprocket.
   - Dynamic pickup scheduling with transit SLA calculation based on Indian 6-digit PIN code classification (Metro Air vs Regional Surface).
   - Bi-directional carrier webhook ingestion updating order tracking checkpoints.
   - Automated Non-Delivery Report (NDR) recovery sequence dispatching WhatsApp interactive messages to resolve patron address or contact anomalies.

## Consequences
### Positive
- Zero defect delivery: Ensures 100% of dispatched luxury hampers match the patron's exact bespoke customizer specifications.
- Photographic audit trail: Eliminates disputes regarding package condition or missing items upon transit delivery.
- Frictionless courier dispatch: Packing slips contain barcode/AWB identifiers and wax seal specifications ready for carrier handover.

### Negative / Trade-Offs
- Adds ~30–45 seconds per hamper to the artisan packaging workflow (streamlined via the Atelier Studio OS webcam/mobile photo inspection modal).

## Compliance & Verification
Verified via `tests/admin_studio_ops.test.js`, `tests/logistics_courier.test.js`, and Tier 13 & 14 of `tests/e2e_integration.test.js`.
