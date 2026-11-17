-- Hampers by Her Atelier AI Platform — Production PostgreSQL 16 + pgvector Schema
-- Complete relational, vector, full-text, outbox, and multi-tenant RLS foundation.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. IDENTITY & TENANTS
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    plan_tier VARCHAR(32) DEFAULT 'ENTERPRISE',
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) DEFAULT 'GTM_MEMBER',
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tenant_user_email UNIQUE (tenant_id, email)
);

-- 2. GTM ENTITIES (LEADS, DEALS, CAMPAIGNS)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    status VARCHAR(32) DEFAULT 'NEW',
    source VARCHAR(64) DEFAULT 'AI_ASSISTANT',
    enrichment_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tenant_lead_email UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    stage VARCHAR(64) DEFAULT 'Leads',
    arr_amount_cents BIGINT DEFAULT 0,
    currency VARCHAR(8) DEFAULT 'USD',
    close_date TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DOCUMENTS & HYBRID RAG VECTOR STORAGE
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    byte_size BIGINT NOT NULL,
    sha256_checksum CHAR(64) NOT NULL,
    version INT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'PENDING',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    parent_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    token_count INT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536), -- Dense Vector representation
    text_search_vec tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED, -- Sparse Lexical
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_doc_chunk_idx UNIQUE (document_id, chunk_index)
);

-- 4. REAL-TIME VOICE SESSIONS
CREATE TABLE IF NOT EXISTS voice_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    transport VARCHAR(32) DEFAULT 'WEBSOCKET_PCM16',
    sample_rate INT DEFAULT 16000,
    audio_duration_ms BIGINT DEFAULT 0,
    metrics JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS voice_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    speaker VARCHAR(16) NOT NULL, -- 'USER' or 'ASSISTANT'
    transcript TEXT,
    confidence FLOAT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TRANSACTIONAL OUTBOX & EVENT INFRASTRUCTURE
CREATE TABLE IF NOT EXISTS outbox_events (
    sequence_id BIGSERIAL PRIMARY KEY,
    id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aggregate_type VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING',
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    dispatched_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS processed_messages (
    message_id VARCHAR(128) PRIMARY KEY,
    consumer_name VARCHAR(128) NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. IMMUTABLE AUDIT LOGGING
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID,
    action VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128),
    outcome VARCHAR(32) NOT NULL,
    ip_address VARCHAR(64),
    details JSONB DEFAULT '{}'::jsonb,
    signature_hmac VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- INDEX OPTIMIZATIONS
-- ═══════════════════════════════════════════════════════════

-- HNSW Vector Index for Dense Cosine Similarity
CREATE INDEX IF NOT EXISTS idx_chunks_hnsw_embedding 
ON document_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- GIN Full-Text Index for Sparse Keyword Matching
CREATE INDEX IF NOT EXISTS idx_chunks_gin_textsearch 
ON document_chunks USING gin (text_search_vec);

-- Outbox FIFO Processing Index
CREATE INDEX IF NOT EXISTS idx_outbox_pending_fifo 
ON outbox_events (sequence_id) 
WHERE status = 'PENDING';

-- ═══════════════════════════════════════════════════════════
-- HARDWARE ROW-LEVEL SECURITY (RLS) POLICIES
-- ═══════════════════════════════════════════════════════════

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_leads ON leads AS RESTRICTIVE
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_deals ON deals AS RESTRICTIVE
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_documents ON documents AS RESTRICTIVE
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_chunks ON document_chunks AS RESTRICTIVE
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_voice ON voice_sessions AS RESTRICTIVE
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
