#!/bin/bash
# Vibe Audit — one-command setup
# Run this once after cloning: ./setup.sh

set -e

echo "━━━ Vibe Audit Setup ━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Install main dependencies
echo "Installing dependencies..."
npm install

# Install demo app dependencies
echo ""
echo "Installing demo app dependencies..."
cd demo && npm install && cd ..

# Install Playwright browsers
echo ""
echo "Installing Playwright browsers..."
npx playwright install --with-deps chromium

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo ""
  echo "Creating .env from template..."
  cp .env.example .env
  echo "⚠  Edit .env and add your API key (GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY)"
fi

# Create baseline directories
mkdir -p .vibe-audit/baselines
mkdir -p .vibe-audit/screenshots

echo ""
echo "━━━ Setup Complete ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Add your API key to .env"
echo "  2. Start the demo app:  cd demo && npm run dev"
echo "  3. Run analysis:        npm run analyze:v3"
echo "  4. Or use with Qure:    node scripts/qure-run.js --suggest-tests"
echo ""
