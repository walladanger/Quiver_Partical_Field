#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
node --experimental-strip-types desktop/launcher.ts
