#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
npm run build
rm -f rootbound.zip
(
  cd dist
  zip -r ../rootbound.zip .
)
printf 'Created %s/rootbound.zip\n' "$PWD"
