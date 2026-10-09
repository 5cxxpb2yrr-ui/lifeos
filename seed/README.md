# Full Life Control Seed

This directory contains the versioned Full Life Control seed baseline. The original v1.0.0 export is preserved as an archival artifact; the canonical v1.0.1 baseline reflects the user's explicit authorization to remove the existing seeded People records.

## Canonical artifact

- **Seed:** `seed/full-life-control-seed-backup.json`
- **Seed version:** `1.0.1`
- **Format:** `FLC-v5`
- **Architecture:** LifeOS Core: Events + Graph + Resolver-owned Views
- **Git blob SHA:** `92c5a8acff69ae4ba21970fd824397a4ea573aa5`
- **Byte length:** 57,328
- **Seeded People records:** 0

## Preserved archive

- **Original:** `seed/archive/full-life-control-seed-backup-v1.0.0.json`
- **Original version:** `1.0.0`
- This archive retains the original export before the authorized People removal.

## Scope of authorized amendment

- Removed the seven seeded People records.
- Removed the seed's event-level `people` and `personIds` references so no event points to a deleted seeded person.
- Preserved the remaining seed records and the Events bus.
- Kept People as a supported entity type, including creation, editing, and relationship support. People can be added later through Universal Capture.
- No further seed changes are authorized by this amendment.

## Integrity

`seed/manifest.json` records the canonical version, Git blob SHA, byte length, and narrow amendment scope. Repository CI verifies the file hash and byte length so unintended seed mutations fail validation.
