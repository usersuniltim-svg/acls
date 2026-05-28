#!/bin/bash
set -e
echo "Running pre-commit checks..."
npm run lint
npm run build
npm run test
echo "All checks passed!"
