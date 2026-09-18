-- Hampers by Her - PostgreSQL 16 Production DDL
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'OPERATIONS', 'SALES', 'FULFILLMENT', 'CUSTOMER_SUPPORT', 'FINANCE', 'VIEWER');
CREATE TYPE product_type AS ENUM ('READY_MADE', 'BUILDER_COMPONENT', 'PACKAGING_BOX', 'PACKAGING_RIBBON', 'PACKAGING_WAX_SEAL');
CREATE TYPE order_status AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'QUALITY_CHECKED', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED');
CREATE TYPE payment_status AS ENUM ('CREATED', 'INITIATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE lead_stage AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'REQUIREMENTS_COLLECTED', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'FULFILLMENT', 'LOST');

-- Users & Customers
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'OPERATIONS',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    is_guest BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    recipient_name VARCHAR(255) NOT NULL,
    address_line1 VARCHAR(500) NOT NULL,
    address_line2 VARCHAR(500),
    landmark VARCHAR(255),
    pincode VARCHAR(6) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_addresses_pincode ON addresses(pincode);

-- Catalog & Inventory
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(64) UNIQUE NOT NULL,
    slug VARCHAR(128) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(500),
    description TEXT,
    product_type product_type NOT NULL,
    base_price_paise BIGINT NOT NULL,
    is_customizable BOOLEAN NOT NULL DEFAULT FALSE,
    is_fragile BOOLEAN NOT NULL DEFAULT FALSE,
    volume_cm3 NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    weight_grams INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_type_active ON products(product_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_title_trgm ON products USING gin (title gin_trgm_ops);

CREATE TABLE inventory (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    version INTEGER NOT NULL DEFAULT 1
);

-- Orders & Payments
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(32) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    shipping_address_id UUID NOT NULL REFERENCES addresses(id),
    order_status order_status NOT NULL DEFAULT 'DRAFT',
    subtotal_paise BIGINT NOT NULL,
    discount_paise BIGINT NOT NULL DEFAULT 0,
    shipping_fee_paise BIGINT NOT NULL DEFAULT 0,
    tax_paise BIGINT NOT NULL DEFAULT 0,
    total_amount_paise BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    is_gift BOOLEAN NOT NULL DEFAULT TRUE,
    delivery_preferred_date DATE NOT NULL,
    delivery_slot VARCHAR(32),
    idempotency_key UUID UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_status_created ON orders(order_status, created_at DESC);
CREATE INDEX idx_orders_customer ON orders(customer_id);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_sku VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    unit_price_paise BIGINT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    configuration JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    gateway_provider VARCHAR(32) NOT NULL DEFAULT 'RAZORPAY',
    gateway_order_id VARCHAR(64) UNIQUE NOT NULL,
    gateway_payment_id VARCHAR(64) UNIQUE,
    amount_paise BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    payment_status payment_status NOT NULL DEFAULT 'CREATED',
    payment_method VARCHAR(32),
    raw_gateway_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Timeline & Audit
CREATE TABLE order_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status order_status,
    to_status order_status NOT NULL,
    triggered_by VARCHAR(128) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_timeline ON order_timeline_events(order_id, created_at);

-- Partitioned Webhook Events Table
CREATE TABLE webhook_events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    provider VARCHAR(32) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create Initial Monthly Partition
CREATE TABLE webhook_events_2026_09 PARTITION OF webhook_events
    FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');
