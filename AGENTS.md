# LifeOS Cloudflare Agent Instructions

## Cloudflare operating rules

- This repository is a Cloudflare-targeted Next.js application.
- A `wrangler.jsonc` exists in the repository. When interacting with Cloudflare for this project, prefer Wrangler for local development, deployment, type generation, migrations, and Worker/Pages-specific operations.
- Use current Cloudflare documentation as the source of truth for APIs, configuration, limits, compatibility, and deployment behavior.
- Do not replace or remove the existing `wrangler.jsonc` configuration unless the task explicitly requires it.
- Before changing Cloudflare architecture, inspect the existing repository configuration and deployment model first.
- For Cloudflare account resources (DNS, Pages projects, WAF, R2, D1, etc.), use the Cloudflare API/MCP tooling when available rather than inventing resource IDs or configuration.
- Keep Cloudflare changes minimal, explicit, and reversible.

## LifeOS project invariants

- Preserve the immutable Full Life Control seed and its integration protocol. Never silently omit, regenerate, substitute, or overwrite the seed.
- Events remain canonical; derived views consume resolver-owned view models.
- Preserve existing IDs, relationships, historical events, backups, and migrations.
- Contract changes require schema versioning, migration, validation, and backup.
- Do not introduce a backend or remote persistence layer merely to make a feature work when the current architecture calls for local-first behavior.

## Validation

Before considering a Cloudflare-related change complete:

1. Run the relevant type checks and tests.
2. Run the production build.
3. Validate Wrangler configuration/types when applicable.
4. Inspect the resulting diff for accidental seed/data/config loss.
5. Do not claim deployment success unless the deployment actually completes.

## Preferred Cloudflare resources

Choose the simplest Cloudflare primitive that matches the requirement. Prefer retrieval from current Cloudflare documentation before making product or architecture decisions.

