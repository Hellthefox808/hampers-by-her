<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 23_ADMIN_DASHBOARD.md — Atelier Operations & Commerce Backoffice Dashboard

## 1. Purpose
This document establishes the architecture, functional capabilities, user experience, and access governance for the **Hampers by Her Admin Backoffice Dashboard** (`/admin`). The backoffice is the operational nerve center of the boutique: empowering workshop artisans, catalog curators, customer support concierges, and business founders to oversee order processing, manage bespoke curation queues, generate shipping manifests, communicate with customers over WhatsApp, and analyze financial performance without directly querying production databases.

## 2. Scope
- **In-Scope**:
  - Secure backoffice web application built on Next.js App Router (`/app/(admin)`).
  - 8 core functional workspaces:
    1. **Overview & Executive Metrics Cockpit**: Live sales, orders pending QC, NDR exceptions, and daily capacity utilization.
    2. **Orders & Fulfillment Management**: Kanban and tabular views of orders across 11 lifecycle stages with packing slip and invoice printing.
    3. **Catalog & Inventory Studio**: Product, collection, inventory allocation, and personalization rule management.
    4. **Hamper Builder Studio**: Configuration of the 11-step consumer hamper builder (box types, compatibility matrices, capacity limits).
    5. **Atelier Production Queue & QC Gate**: Verification of custom wax seals, photo polaroid quality, and assembly checklists.
    6. **CRM & Lead Inbox**: Unified customer timeline, WhatsApp two-way live chat, and bespoke quotation builder.
    7. **Logistics & Dispatch Cockpit**: AWB creation, manifest handover printing, and courier NDR resolution.
    8. **Finance & Promotions**: Coupon code engine, refund processing, and daily GST tax reports.
  - Role-Based Access Control (RBAC) with audit logging across all state-mutating actions.
- **Out-of-Scope**:
  - Direct consumer shopping features (isolated strictly to `/app/(storefront)`).
  - Low-level cloud infrastructure management (handled via AWS Console / Terraform).

## 3. Context
Gifting operations fail when workshop staff have to juggle spreadsheets, personal WhatsApp accounts, Razorpay dashboards, and courier portals simultaneously. Hampers by Her aggregates all these disparate operational flows into a unified single-pane-of-glass atelier workstation.

```
[Admin / Artisan / Concierge User]
                 │
                 ▼ (MFA Authenticated Session)
   [Next.js Admin SPA / Admin Router]
                 │
                 ▼ (REST API + Server Actions over TLS)
   [NestJS Backend RBAC Guards] ──► [Audit Log Interceptor]
                 │
    ┌────────────┼────────────┬────────────┬────────────┐
    ▼            ▼            ▼            ▼            ▼
[Orders]     [Catalog]     [Atelier]    [Logistics]    [CRM/WhatsApp]
(Kanban)    (Inventory)   (QC Photos)   (AWB Print)    (Live Chat)
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-ADM-01**: Executive Cockpit: Display live GMV, net revenue, AOV (Average Order Value), orders awaiting production, and urgent delivery exceptions with 60-second auto-refresh.
- **FR-ADM-02**: Visual Order Kanban: Organize orders into draggable or status-filtered columns (`NEW`, `IN_PRODUCTION`, `READY_FOR_QC`, `PACKED`, `DISPATCHED`, `DELIVERED`).
- **FR-ADM-03**: Single-Click Packing Slip & Label Printing: Thermal-printer formatted (4x6 inch) shipping label and gift invoice generation.
- **FR-ADM-04**: Atelier QC Photo Verification: Force fulfillment operators to upload or capture a smartphone photograph of the assembled hamper before allowing state transition to `READY_FOR_DISPATCH`.
- **FR-ADM-05**: Interactive Quotation Generator: Create custom multi-item quotes for wedding and corporate inquiries, auto-calculating volume discounts, GST, and generating a secure Razorpay payment link.
- **FR-ADM-06**: Live WhatsApp Inbox: Operator messaging window supporting text, image previews, and pre-approved Meta Utility templates with conversation state indicators.
- **FR-ADM-07**: CSV Bulk Import / Export: Bulk product price updates, inventory restocks, and tax report exports with schema validation preview prior to database commit.

### 4.2 Non-Functional Requirements
- **NFR-ADM-01**: Security: Mandatory Multi-Factor Authentication (TOTP Authenticator app) for all staff accounts; strict session timeout after 30 minutes of inactivity.
- **NFR-ADM-02**: Auditability: 100% immutable audit logging for price changes, inventory adjustments, refunds, and permission modifications.
- **NFR-ADM-03**: Performance: Order list search and filtering response time under 300ms across 100,000+ records using database indexing.

## 5. Architecture & Design

### 5.1 Role-Based Access Control (RBAC) Matrix
The admin dashboard enforces 6 discrete operational roles:

| Module / Permission | SUPER_ADMIN | ATELIER_LEAD | CONCIERGE / CS | LOGISTICS_STAFF | FINANCE | MARKETING |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Manage Staff & Roles** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **View Financial Reports** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Issue Refunds** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Edit Product & Pricing**| ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Atelier QC Sign-off** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Generate AWB & Manifest**| ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **WhatsApp Chat & Quotes** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Manage Coupons & SEO** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 5.2 Admin User Experience & Layout
- **Navigation Shell**: Collapsible sidebar with high-contrast, distraction-free typography (Inter), dark/light theme support, and persistent Global Search (`Cmd + K` / `Ctrl + K`) for instant lookup of Order #, Customer Name, Phone, or AWB.
- **QC Gate Modal**: Displays the customer's exact personalization text, uploaded photos, and wax seal initials side-by-side with an artisan camera upload viewfinder.

## 6. Business Rules
1. **Four-Eyes Principle on Refunds**: Refunds exceeding ₹5,000 require dual authorization (initiated by Customer Support, approved by Super Admin or Finance).
2. **Mandatory QC Gate**: An order can NEVER be moved to `DISPATCHED` without at least one approved QC photograph linked to the order entity.
3. **No Direct PII Export**: CSV export of customer phone numbers and physical addresses is restricted strictly to `SUPER_ADMIN` to prevent customer list poaching.
4. **Active Lock on Order Editing**: When an operator opens an order for manual detail editing, a Redis distributed lock (`order:edit:lock:{id}`) prevents concurrent modifications by another team member.

## 7. Technical Details

### 7.1 Database Entity Relations (Admin Subsystem)
```sql
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL, -- SUPER_ADMIN, ATELIER_LEAD, CONCIERGE, etc.
    phone_number VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    totp_secret VARCHAR(128),
    is_mfa_enabled BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_admin_email ON admin_users(email);

CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id),
    action VARCHAR(64) NOT NULL, -- ORDER_STATUS_UPDATE, REFUND_ISSUED, PRICE_CHANGED
    target_entity VARCHAR(64) NOT NULL, -- Order, Product, User
    target_id UUID NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_target ON admin_audit_logs(target_entity, target_id);
CREATE INDEX idx_audit_user ON admin_audit_logs(admin_user_id, created_at DESC);
```

### 7.2 Audit Log NestJS Interceptor
```typescript
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const user = req.user; // Authenticated admin user
    const method = req.method;

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && user) {
      return next.handle().pipe(
        tap(async (resData) => {
          await this.prisma.adminAuditLog.create({
            data: {
              adminUserId: user.id,
              action: `${context.getClass().name}.${context.getHandler().name}`,
              targetEntity: req.params.entity || 'UNKNOWN',
              targetId: req.params.id || resData?.id,
              previousState: req.body?._originalState,
              newState: resData,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            },
          });
        }),
      );
    }
    return next.handle();
  }
}
```

## 8. Dependencies
- **Upstream Modules**: All core business modules (`Orders`, `Catalog`, `Customization`, `Payments`, `Logistics`, `CRM`).
- **Downstream Modules**: `MediaCDN` (QC image uploads), `NotificationSystem` (alerts to staff on order SLA breaches).

## 9. Security
- **MFA Enforcement**: Authenticator App TOTP verification required at every login.
- **IP Whitelisting**: Optional AWS WAF rule restricting `/admin/*` routes to known atelier static office IPs or Tailscale VPN.
- **CSRF & Secure Cookies**: Admin session cookies set with `HttpOnly`, `SameSite=Strict`, `Secure=true`, and scoped to `/admin`.

## 10. Failure Modes & Resilience
1. **Atelier Photo Upload Failure**: If network connectivity drops while an artisan is uploading a QC photograph, the Next.js client utilizes IndexedDB to cache the uncompressed photo locally and automatically retries upon reconnection.
2. **Session Expired During Edits**: If an artisan's session times out while drafting a complex custom hamper quote, an in-page modal prompts for re-authentication without clearing unsaved form state.

## 11. Testing
- **Unit Tests**:
  - RBAC permission guard evaluation against user role claims.
  - Audit log serialization and sensitive field masking (passwords, tokens).
- **Component Tests**:
  - React Testing Library verification of Order Kanban column drag-and-drop and filter state updates.
- **End-to-End Tests**:
  - Playwright test: Admin logs in with MFA ──► navigates to Order #1001 ──► uploads QC photo ──► transitions status to `PACKED` ──► generates Shiprocket AWB ──► asserts label PDF preview.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `admin.active_operators_count`.
  - `admin.audit_log_write_failure_count` (Critical alarm if > 0).
  - `admin.qc_verification_duration_seconds`.
  - `admin.order_kanban_render_duration_ms`.
- **Alerts**: Real-time Slack/WhatsApp alert to CTO if more than 3 failed admin login attempts occur within 5 minutes.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: initial_admin_user_roster
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "One super_admin user created during initial seeding for the business founder"

unknown:
  field: atelier_hardware_profile
  status: TO_VERIFY
  source_required: brand_owner
  impact: medium
  temporary_assumption: "Standard iPad / Android tablets used on packaging benches for camera QC capture; thermal 4x6 USB/Network printer for shipping labels"
```

## 14. Future Evolution
- Voice-enabled packing assistant: Artisans can verify packed items hands-free using voice commands ("Verified candle", "Verified wax seal").
- Automated thermal label printing via direct WebUSB/WebBluetooth protocol without standard browser print dialogs.

## 15. References
- Next.js Server Actions and Authentication: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- RFC 6238 (TOTP: Time-Based One-Time Password Algorithm): https://datatracker.ietf.org/doc/html/rfc6238
