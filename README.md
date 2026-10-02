# LifeOS V2

Local-first personal operating system centered on canonical Events, Open Loops, Relationships and connected life domains.

## Foundation
- Working Mission Control shell
- Attention resolver
- Canonical Event/Open Loop contracts
- IndexedDB persistence boundary
- Universal search shell
- Mobile-first five-tab navigation
- Immutable Full Life Control seed protocol
- Cloudflare Workers configuration
- GitHub Actions CI
- Demo data isolated and never used as the real seed

## Cloudflare
Cloudflare recommends vinext for new Next.js applications on Workers. Install dependencies and run:
npm install
npm run dev
npm run deploy

For Workers Builds, use build command:
npm install && npm run build
and deploy command:
npx wrangler deploy

## Data safety
Never delete or regenerate personal records to add features. Preserve IDs, relationships and historical events. Contract changes require schema versioning, migration, validation and backup.

The actual Full Life Control seed must be supplied separately and preserved exactly.