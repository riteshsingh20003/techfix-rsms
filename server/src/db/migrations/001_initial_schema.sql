CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'technician' CHECK (role IN ('admin', 'technician')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  token_version INTEGER NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(40) NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repairs (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  remarks TEXT NOT NULL DEFAULT '',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'checking', 'done', 'cancelled')),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE repairs ALTER COLUMN code TYPE VARCHAR(64);
ALTER TABLE repairs DROP CONSTRAINT IF EXISTS repairs_payment_status_check;
ALTER TABLE repairs ADD CONSTRAINT repairs_payment_status_check CHECK (payment_status IN ('unpaid', 'partial', 'paid'));

CREATE TABLE IF NOT EXISTS repair_services (
  id BIGSERIAL PRIMARY KEY,
  repair_id BIGINT NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
  service_name VARCHAR(160) NOT NULL,
  fee NUMERIC(12,2) NOT NULL CHECK (fee >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_repair_services_repair_service
  ON repair_services(repair_id, service_id) WHERE service_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS repair_materials (
  id BIGSERIAL PRIMARY KEY,
  repair_id BIGINT NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  cost NUMERIC(12,2) NOT NULL CHECK (cost >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  repair_id BIGINT NOT NULL REFERENCES repairs(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(20) NOT NULL CHECK (method IN ('cash', 'card', 'upi', 'bank_transfer')),
  reference VARCHAR(120) NOT NULL DEFAULT '',
  idempotency_key UUID,
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency_key ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS repair_status_history (
  id BIGSERIAL PRIMARY KEY,
  repair_id BIGINT NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repairs_client_id ON repairs(client_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_created_at ON repairs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repairs_code ON repairs(code);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(archived_at) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_services_active_name ON services (lower(name)) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_repair_id ON payments(repair_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repair_history_repair_id ON repair_status_history(repair_id, created_at ASC);

-- Preserve old paid flags as legacy payment entries so balances remain consistent after upgrade.
INSERT INTO payments (repair_id, amount, method, reference)
SELECT r.id, r.total_amount, 'cash', 'Migrated legacy paid flag'
FROM repairs r
WHERE r.payment_status = 'paid'
  AND r.total_amount > 0
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.repair_id = r.id);

-- Add an initial history row for repairs created before status history existed.
INSERT INTO repair_status_history (repair_id, old_status, new_status, created_at)
SELECT r.id, NULL, r.status, r.created_at
FROM repairs r
WHERE NOT EXISTS (SELECT 1 FROM repair_status_history h WHERE h.repair_id = r.id);
