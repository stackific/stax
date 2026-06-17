#!/usr/bin/env bash
# Local CodeQL scan, mirroring .github/workflows/codeql.yml. Runs the same
# `<lang>-security-and-quality` query suite the CI advanced setup runs, but on
# this machine before push so findings never reach CI. CodeQL is the engine
# behind GitHub Advanced Security code scanning; it is free here because
# stackific/stax is public — the CodeQL CLI requires a GHAS license only for
# private code. Invoked per language by lefthook's pre-push hook (lefthook.yml).
#
# Like scripts/e2e_test.sh, this is a bash hook: on Windows run it under Git
# Bash (the same assumption the e2e pre-push command already makes).
#
# Usage: scripts/codeql-local.sh <language> <source-root> [build-command]
#   language       CodeQL language id: go | javascript-typescript | python
#   source-root    directory to analyze (".", "frontend", "skills-evals")
#   build-command  optional; required for Go (a compiled language with no
#                  buildless mode). Pass "task build" so CodeQL traces a real
#                  compile with frontend/dist present for //go:embed.
#
# Exit codes: 0 = clean, 1 = problems found or setup error. The push is blocked
# on any non-zero exit. `codeql database analyze` returns 0 even when it finds
# problems, so this script counts SARIF results itself to act as the gate.
set -euo pipefail

lang="${1:?usage: codeql-local.sh <language> <source-root> [build-command]}"
src="${2:?usage: codeql-local.sh <language> <source-root> [build-command]}"
build_cmd="${3:-}"

if ! command -v codeql >/dev/null 2>&1; then
  echo "codeql CLI not found on PATH." >&2
  echo "Install it: 'brew install codeql' (macOS) or download the bundle from" >&2
  echo "https://github.com/github/codeql-action/releases (ships the query packs)." >&2
  exit 1
fi

# Map the database language to its fully-qualified query-pack suite. The CLI
# needs the '<pack>:<suite-path>' form (the bare '<lang>-security-and-quality.qls'
# shorthand only resolves inside the CodeQL Action). Note the JS/TS database
# language id is 'javascript-typescript' but the query pack is 'javascript'.
case "$lang" in
  go)                    suite="codeql/go-queries:codeql-suites/go-security-and-quality.qls" ;;
  python)                suite="codeql/python-queries:codeql-suites/python-security-and-quality.qls" ;;
  javascript-typescript) suite="codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls" ;;
  *) echo "unsupported language: $lang" >&2; exit 1 ;;
esac

work=".codeql"
db="${work}/db-${lang}"
sarif="${work}/${lang}.sarif"
mkdir -p "$work"

# Build the database. --overwrite keeps re-runs idempotent. Go needs a build
# command (no buildless mode); interpreted languages extract from source with
# no build step.
if [ -n "$build_cmd" ]; then
  codeql database create "$db" --language="$lang" --source-root="$src" \
    --command="$build_cmd" --overwrite
else
  codeql database create "$db" --language="$lang" --source-root="$src" \
    --overwrite
fi

# Analyze with the security-and-quality suite. --download fetches the query
# pack if it is not already in the CLI's package cache.
codeql database analyze "$db" "$suite" \
  --format=sarif-latest --output="$sarif" --download

# `database analyze` exits 0 regardless of findings, so gate on the SARIF
# result count ourselves.
count="$(python3 - "$sarif" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
  data = json.load(f)
print(sum(len(run.get("results", [])) for run in data.get("runs", [])))
PY
)"

if [ "$count" -gt 0 ]; then
  echo "CodeQL ($lang): $count problem(s) found — inspect $sarif" >&2
  exit 1
fi
echo "CodeQL ($lang): clean"
