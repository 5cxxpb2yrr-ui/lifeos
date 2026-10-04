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

## Cloudflare Agent setup

Cloudflare's current agent setup recommends giving coding agents three layers of Cloudflare access: Cloudflare Skills, the Cloudflare API MCP server, and Wrangler for project-local development/deployment.

For OpenAI Codex:

1. Install Codex: `npm install -g @openai/codex`
2. Start Codex from the repository root (this repo already contains `wrangler.jsonc`).
3. In Codex, open `/plugins` and install the Cloudflare plugin. This provides Cloudflare Skills and MCP integrations.
4. If configuring MCP manually, add the Cloudflare API server with:
   `codex mcp add cloudflare --url https://mcp.cloudflare.com/mcp`
5. Complete the Cloudflare OAuth authorization when Codex first requests account access.
6. Use Wrangler for local development/deployment because this repository already has `wrangler.jsonc`.

Useful local commands:

```bash
npm install
npm run cf:typegen
npm run typecheck
npm test
npm run build
```

The repository's `AGENTS.md` contains the persistent Cloudflare and LifeOS invariants that coding agents should follow.

## Data safety
Never delete or regenerate personal records to add features. Preserve IDs, relationships and historical events. Contract changes require schema versioning, migration, validation and backup.

The actual Full Life Control seed must be supplied separately and preserved exactly.