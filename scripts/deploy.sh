#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="/home/node/.openclaw/code/mission-control/dist"

echo "Running tests..."
if ! (cd "$ROOT_DIR" && npm test); then
  echo "Tests failed. Aborting deployment."
  exit 1
fi
echo "Tests passed."

echo "Building project..."
if ! (cd "$ROOT_DIR" && npm run build); then
  echo "Build failed. Aborting deployment."
  exit 1
fi
echo "Build succeeded."

echo "Deploying build to $TARGET_DIR..."
mkdir -p "$TARGET_DIR"
if ! (cd "$ROOT_DIR" && cp -r dist/* "$TARGET_DIR/"); then
  echo "Deploy failed during copy."
  exit 1
fi

echo "Deployed."
