# Immutable Full Life Control Seed

This directory contains the **authoritative Full Life Control seed**. It is a first-class, versioned repository artifact and must be preserved across every LifeOS iteration unless the user explicitly replaces it.

## Canonical artifact

- **Seed:** `seed/full-life-control-seed-backup.json`
- **Seed version:** `1.0.0`
- **Format:** `FLC-v5`
- **Architecture:** LifeOS Core: Events + Graph + Resolver-owned Views
- **Git blob SHA:** `f4444b6d2f851ec4e8733c7a5ca2422fe0de5e09`
- **Byte length:** 59,563

## Immutability rule

The seed is **not current operational state**. It is the permanent baseline / DNA of LifeOS.

- Do not replace it with demo data.
- Do not silently edit or regenerate it.
- Do not migrate it into a different shape in place.
- Current application state, imports, and backups are separate from the seed.
- A new seed version may only be created after explicit user authorization.

## Lifecycle

`IMMUTABLE SEED → PRESERVE → MODIFY SYSTEM AROUND IT → VALIDATE → PACKAGE`

## Integrity

`seed/manifest.json` records the canonical version and Git blob SHA. Repository CI verifies the file hash and byte length so an accidental seed mutation fails validation.

## Archive

The JSON file is human-readable and self-contained so it can be copied to independent archival storage without the LifeOS repository.
