# Immutable Full Life Control Seed

The **Full Life Control seed is the immutable baseline / DNA of LifeOS**. The canonical personal seed does **not** live in the public Git repository or client bundle.

## Canonical artifact

- **Seed:** `full-life-control-seed-backup.json`
- **Seed version:** `1.0.0`
- **Format:** `FLC-v5`
- **Byte length:** 59,563
- **SHA-256:** `d22e0386087b4d6eee4063d4d77eab29b17b6d675f0a92dc87c2bd5d546531b7`
- **R2 bucket:** `lifeos-immutable-seed`
- **R2 object:** `immutable/full-life-control-seed-backup.json`

## Storage boundary

The canonical seed is stored in a **private Cloudflare R2 bucket**. GitHub contains only non-sensitive seed metadata, validation rules, and documentation.

The application may know the canonical seed ID, version, expected byte length, and SHA-256. It must never bundle the personal seed contents into browser JavaScript.

## Immutability rule

The seed is **not current operational state**. It is the permanent baseline / DNA of LifeOS.

- Do not replace it with demo data.
- Do not silently edit, normalize, migrate, or regenerate it.
- Current application state, imports, and backups are separate from the seed.
- A new seed version may only be created after explicit user authorization.
- R2 object locking protects the `immutable/` namespace from overwrite/delete.

## Lifecycle

`R2 IMMUTABLE SEED → PRESERVE → MODIFY SYSTEM AROUND IT → VALIDATE → PACKAGE`

## Integrity

Every seed import/download path must verify the exact SHA-256 above before accepting the artifact as the canonical seed.

`seed/manifest.json` contains public metadata only; it does not contain the personal seed payload.

## Archive

An independent local/offline copy may be kept by the user for disaster recovery. The R2 copy is the canonical vault copy; the independent copy is the recovery copy.
