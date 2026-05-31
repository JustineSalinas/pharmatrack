#!/usr/bin/env bash
# Install gstack into ~/.claude/skills/gstack for this project.
# Requires: git, bun (https://bun.sh)
set -euo pipefail

DEST="$HOME/.claude/skills/gstack"

if [ -d "$DEST" ]; then
  echo "gstack already installed at $DEST — pulling latest"
  cd "$DEST" && git pull --ff-only
else
  echo "Cloning gstack to $DEST"
  git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git "$DEST"
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found. Install with: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

cd "$DEST" && ./setup
echo "gstack installed. See CLAUDE.md for the list of available skills."
