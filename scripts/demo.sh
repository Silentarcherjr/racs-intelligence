#!/usr/bin/env bash
# Thin wrapper. The implementation is scripts/demo.mjs so that Windows works
# without WSL or Git Bash; this exists for muscle memory and older docs.
exec node "$(dirname "${BASH_SOURCE[0]}")/demo.mjs" "$@"
