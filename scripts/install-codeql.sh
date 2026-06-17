#!/usr/bin/env bash
# Ensure the CodeQL CLI is installed so the codeql-* pre-push hooks (lefthook.yml)
# and scripts/codeql-local.sh can run. Invoked by `task setup` (and the
# standalone `task setup:codeql`). Idempotent: a no-op when codeql is already on
# PATH.
#
# Like scripts/e2e_test.sh, this is a bash script; on Windows run `task setup`
# from Git Bash.
set -euo pipefail

if command -v codeql >/dev/null 2>&1; then
  echo "codeql already installed: $(codeql version | head -n 1)"
  exit 0
fi

# Preferred: the gh CodeQL extension when the GitHub CLI is available. It
# installs + manages the CodeQL CLI uniformly across macOS/Linux/Windows and
# authenticates query-pack downloads with your gh token. `install-stub` drops a
# `codeql` shim on PATH so the hooks can keep calling plain `codeql`.
if command -v gh >/dev/null 2>&1; then
  echo "Installing CodeQL via the gh codeql extension..."
  gh extension install github/gh-codeql 2>/dev/null || true
  gh codeql set-version latest
  # Prefer a no-sudo PATH dir the repo already expects to be on PATH
  # (GOPATH/bin); otherwise fall back to install-stub's default (/usr/local/bin).
  stub_dir="$(go env GOPATH 2>/dev/null)/bin"
  if [ -d "$stub_dir" ]; then
    gh codeql install-stub "$stub_dir"
  else
    gh codeql install-stub
  fi
  if command -v codeql >/dev/null 2>&1; then
    echo "codeql installed via gh: $(codeql version | head -n 1)"
    exit 0
  fi
  echo "gh codeql is set up but 'codeql' is not on PATH yet; add the stub dir to PATH." >&2
  echo "Falling back to a direct install..." >&2
fi

# Fallback: Homebrew (macOS / Linuxbrew) — puts codeql on PATH and keeps it
# upgradable.
if command -v brew >/dev/null 2>&1; then
  echo "Installing codeql via Homebrew..."
  brew install codeql
  echo "codeql installed: $(codeql version | head -n 1)"
  exit 0
fi

# No Homebrew: download the official CodeQL bundle (CLI + bundled query packs)
# for this platform into ~/.codeql, then point PATH at it.
case "$(uname -s)" in
  Darwin)               plat=osx64 ;;
  Linux)                plat=linux64 ;;
  MINGW*|MSYS*|CYGWIN*) plat=win64 ;;
  *) echo "Unsupported platform '$(uname -s)'. Install codeql manually:" >&2
     echo "  https://github.com/github/codeql-action/releases" >&2
     exit 1 ;;
esac

dest="${HOME}/.codeql"
url="https://github.com/github/codeql-action/releases/latest/download/codeql-bundle-${plat}.tar.gz"
echo "Homebrew not found; downloading the CodeQL bundle (${plat}) to ${dest} ..."
mkdir -p "$dest"
curl -fsSL "$url" | tar -xz -C "$dest"

# The bundle unpacks a top-level codeql/ directory containing the launcher.
bindir="${dest}/codeql"
if ! "${bindir}/codeql" version >/dev/null 2>&1; then
  echo "Extraction completed but '${bindir}/codeql' did not run; check the archive." >&2
  exit 1
fi
echo
echo "CodeQL extracted: $("${bindir}/codeql" version | head -n 1)"
echo "Add it to your PATH to finish setup (append to your shell profile):"
echo "  export PATH=\"${bindir}:\$PATH\""
