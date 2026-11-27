-- Hampers by Her — Supabase PostgreSQL Production Migration
-- Idempotent operational store tables + Row Level Security (RLS) hardening

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Operational Storefront & Studio OS Tables (JSONB-backed for atomic domain hydration)
CREATE TABLE IF NOT EXISTS public.hbh_orders (
    order_number TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    total_paise BIGINT NOT NULL DEFAULT 0,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hbh_orders_status_updated
    ON public.hbh_orders (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.hbh_qc_records (
    order_number TEXT PRIMARY KEY,
    inspector_name TEXT NOT NULL DEFAULT 'Fatima Bi',
    passed BOOLEAN NOT NULL DEFAULT TRUE,
    payload JSONB NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hbh_shipments (
    awb TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    carrier TEXT NOT NULL DEFAULT 'BlueDart Priority Air',
    status TEXT NOT NULL DEFAULT 'MANIFEST_CREATED',
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hbh_shipments_order
    ON public.hbh_shipments (order_number);

CREATE TABLE IF NOT EXISTS public.hbh_inquiries (
    id TEXT PRIMARY KEY,
    priority_tier TEXT NOT NULL DEFAULT 'P2',
    lead_score INTEGER NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'RECEIVED',
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hbh_inquiries_created
    ON public.hbh_inquiries (created_at DESC);

-- Strict Row Level Security: block unauthenticated PostgREST anon/authenticated access to private PII/orders.
-- Server-side Express backend connects directly as database role or service role.
ALTER TABLE public.hbh_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hbh_qc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hbh_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hbh_inquiries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hbh_orders FROM anon, authenticated;
REVOKE ALL ON TABLE public.hbh_qc_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.hbh_shipments FROM anon, authenticated;
REVOKE ALL ON TABLE public.hbh_inquiries FROM anon, authenticated;
