-- LifeOS Plaid integration foundation.
-- Store access tokens only as AES-GCM ciphertext; never store plaintext access tokens.
-- Apply this migration only after the D1 database and binding are provisioned.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS plaid_items (
  item_id TEXT PRIMARY KEY,
  institution_id TEXT,
  institution_name TEXT,
  access_token_ciphertext TEXT NOT NULL,
  access_token_nonce TEXT NOT NULL,
  token_key_version INTEGER NOT NULL DEFAULT 1,
  sync_cursor TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'login_required', 'error', 'disconnected')),
  consented_at TEXT NOT NULL,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plaid_accounts (
  account_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES plaid_items(item_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  official_name TEXT,
  mask TEXT,
  type TEXT,
  subtype TEXT,
  iso_currency_code TEXT,
  linked_lifeos_account_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plaid_transactions (
  transaction_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES plaid_items(item_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES plaid_accounts(account_id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  authorized_date TEXT,
  name TEXT NOT NULL,
  merchant_name TEXT,
  amount REAL NOT NULL,
  iso_currency_code TEXT,
  pending INTEGER NOT NULL DEFAULT 0 CHECK (pending IN (0, 1)),
  removed INTEGER NOT NULL DEFAULT 0 CHECK (removed IN (0, 1)),
  personal_finance_category_primary TEXT,
  personal_finance_category_detailed TEXT,
  raw_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plaid_transactions_item_date
  ON plaid_transactions(item_id, date);

CREATE INDEX IF NOT EXISTS idx_plaid_transactions_account_date
  ON plaid_transactions(account_id, date);

CREATE TABLE IF NOT EXISTS plaid_webhook_events (
  event_key TEXT PRIMARY KEY,
  item_id TEXT,
  webhook_type TEXT NOT NULL,
  webhook_code TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed'))
);
