-- Summary-only Plaid sync history. This table intentionally contains no transaction IDs,
-- merchant names, transaction-level records, or raw provider payloads.
CREATE TABLE IF NOT EXISTS plaid_sync_summaries (
  sync_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  cursor_from TEXT,
  cursor_to TEXT NOT NULL,
  added_count INTEGER NOT NULL DEFAULT 0,
  modified_count INTEGER NOT NULL DEFAULT 0,
  removed_count INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plaid_sync_summaries_item_created
  ON plaid_sync_summaries(item_id, created_at DESC);
