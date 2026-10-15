-- Opaque cursor metadata only; no transaction IDs, merchant names, or transaction rows.
CREATE TABLE IF NOT EXISTS plaid_transaction_cursors (
  item_id TEXT PRIMARY KEY REFERENCES plaid_items(item_id) ON DELETE CASCADE,
  cursor TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
