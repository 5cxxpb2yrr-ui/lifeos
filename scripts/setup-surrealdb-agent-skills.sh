#!/usr/bin/env bash
set -euo pipefail

# Official SurrealDB Agent Skills. Run from the LifeOS repository root.
# Installs only the three skills specified by SurrealDB's setup instructions.
npx skills add surrealdb/agent-skills --skill surrealql --skill surrealdb-vector --skill surrealdb-python
