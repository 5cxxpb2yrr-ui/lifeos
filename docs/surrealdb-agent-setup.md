# SurrealDB agent setup

This repository's SurrealDB agent setup follows the official instructions at https://surrealdb.com/docs/agents/instructions.md.

## Agent Skills

From the repository root, run:

```bash
bash scripts/setup-surrealdb-agent-skills.sh
```

This uses the official `npx skills` installer to install the three requested skills from `surrealdb/agent-skills`: `surrealql`, `surrealdb-vector`, and `surrealdb-python`. The install must be run in a coding environment with Node.js/npm and network access; this GitHub integration cannot execute repository shell commands, so the skill payloads are not falsely reported as installed by this change.

## MCP server

`.vscode/mcp.json` configures the official hosted server at `https://mcp.surrealdb.com` for VS Code/GitHub Copilot. No credentials or tokens are stored in the repository. After this change is merged or checked out, reload VS Code, start/connect to the `surrealdb` server from the MCP view, and approve browser sign-in.

For Codex, the equivalent user-level command is:

```bash
codex mcp add surrealdb --url https://mcp.surrealdb.com
```

ChatGPT's browser client does not expose a user-configurable remote MCP connection through this GitHub setup path, and no SurrealDB tools are currently available in this ChatGPT session. Complete the connection in a supported MCP client, then verify with the read-only prompt: “Which SurrealDB Cloud organisations can you see?”

## Safety boundary

This setup does not create, deploy, resize, pause, upgrade, or delete a SurrealDB instance; it does not run SurrealQL; and it does not change LifeOS production data or deployment configuration. Database creation is a separate, potentially billable action and requires separate approval.
