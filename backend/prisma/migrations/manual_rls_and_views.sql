-- ============================================================
-- RLS + Vistas filtradas para aislamiento multi-tenant RAG
-- Aplicar con: bash ./backend/scripts/apply-rls.sh
-- ============================================================

-- Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies: solo el owner puede ver sus filas
-- NULLIF maneja el caso donde app.current_user_id no está seteado (conexiones sin contexto)
DROP POLICY IF EXISTS tenant_isolation_documents ON documents;
CREATE POLICY tenant_isolation_documents ON documents
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::int);

DROP POLICY IF EXISTS tenant_isolation_document_types ON document_types;
CREATE POLICY tenant_isolation_document_types ON document_types
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::int);

DROP POLICY IF EXISTS tenant_isolation_subscriptions ON subscriptions;
CREATE POLICY tenant_isolation_subscriptions ON subscriptions
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::int);

-- FORCE: aplica RLS incluso al superuser postgres
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE document_types FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

-- ============================================================
-- Vistas filtradas para el RAG
-- La IA solo puede consultar estas vistas, nunca tablas directas
-- ============================================================

CREATE OR REPLACE VIEW my_documents AS
  SELECT * FROM documents
  WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::int;

CREATE OR REPLACE VIEW my_document_types AS
  SELECT * FROM document_types
  WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::int;

-- Confirmar
SELECT 'RLS y vistas aplicadas correctamente' AS resultado;
