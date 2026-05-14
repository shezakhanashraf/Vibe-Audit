# Vibe Audit

Behavioral regression auditor for pull requests. Catches silent breaks in your app — the kind where all tests pass but users see broken behavior.

## How it works

Vibe Audit runs in your CI pipeline on every pull request. It combines:

1. **Static analysis** — runs `tsc` and `eslint` to find real compiler errors
2. **Dependency graph tracing** — identifies which files consume the changed exports and weren't updated
3. **Baseline test awareness** — reads your Playwright/Cypress tests to understand what flows exist
4. **LLM analysis** — sends the diff, static analysis results, dependency graph, and test context to an LLM that identifies gaps where tests pass but behavior breaks

The output is a markdown report posted as a PR comment.

## Quick start

### 1. Install

```bash
git clone https://github.com/shezakhanashraf/Vibe-Audit.git
cd Vibe-Audit
npm install
```

### 2. Configure

Copy `.env.example` to `.env` and add your API key:

```
GEMINI_API_KEY=your_key_here
```

Or use OpenAI / Anthropic instead:
```
VIBE_AUDIT_PROVIDER=openai
OPENAI_API_KEY=your_key_here
```

### 3. Run locally

```bash
# Generate a diff to analyze
git diff origin/main...HEAD > local-diff.patch

# Run the analysis
node scripts/analyze-diff.js
```

### 4. Add to your CI

Add the workflow file to your repo:

```yaml
# .github/workflows/vibe-audit.yml
name: Vibe Audit

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  vibe-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: node scripts/analyze-diff.js
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      - uses: actions/github-script@v7
        if: always()
        with:
          script: |
            const fs = require('fs');
            if (!fs.existsSync('vibe-audit-report.md')) return;
            const report = fs.readFileSync('vibe-audit-report.md', 'utf-8');
            const marker = '<!-- vibe-audit-report -->';
            const body = `${marker}\n${report}`;
            const comments = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });
            const existing = comments.data.find(c => c.body.includes(marker));
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner, repo: context.repo.repo,
                comment_id: existing.id, body,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: context.issue.number, body,
              });
            }
```

## Supported LLM providers

| Provider | Env var | Default model |
|----------|---------|---------------|
| Gemini | `GEMINI_API_KEY` | gemini-2.5-flash |
| OpenAI | `OPENAI_API_KEY` | gpt-4o |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |

Switch providers via `vibe-audit.config.js` or the `VIBE_AUDIT_PROVIDER` env var.

## Qure integration (JetBrains)

[Qure](https://www.jetbrains.com/qure/) is a desktop app by JetBrains that generates E2E tests from recorded user flows. Vibe Audit reads Qure-generated tests from `tests/qure/` and gives them extra weight in the analysis, since they represent verified real-world user behavior.

To set up:
1. Install Qure and point it at your project
2. Record user flows and let Qure generate tests into `tests/qure/`
3. Vibe Audit automatically picks them up on the next PR

## Configuration

Create `vibe-audit.config.js` in your project root:

```js
module.exports = {
  provider: "gemini",
  models: {
    gemini: "gemini-2.5-flash",
    openai: "gpt-4o",
    anthropic: "claude-sonnet-4-20250514",
  },
  maxDiffChars: 100_000,
  testDir: "tests",
  qureTestDir: "tests/qure",
  runTsc: true,
  runEslint: true,
  tsconfigPath: "tsconfig.json",
  traceDeps: true,
};
```

All fields are optional. Env vars override config file values.

## Demo app

The `demo/` directory contains a Next.js e-commerce app (product listing, cart, checkout, login) used to demonstrate the audit.

```bash
cd demo
npm install
npm run dev
# Visit http://localhost:3000
```

### Demo scenario

The demo PR renames `totalPrice` to `total` across the cart API and most components, but misses `CheckoutSummary.tsx`. All tests pass. The user sees a broken price on checkout. Vibe Audit catches it:

```
HIGH RISK -- Checkout form accepts user details (confidence: 100%)
> The CheckoutSummary component still reads cartData.totalPrice, which is now
> undefined. Users see a broken or missing price on the checkout page.
> No existing test asserts on the displayed price value.
```

## Project structure

```
scripts/
  analyze-diff.js              Entry point
  lib/
    config.js                  Config loader
    diff.js                    Git diff extraction
    tests.js                   Test file collection
    static-analysis.js         tsc + eslint runner
    dep-graph.js               Import chain tracer
    report.js                  Markdown report renderer
    providers/
      index.js                 Provider router + retry
      gemini.js
      openai.js
      anthropic.js
tests/                         Baseline tests (hand-written)
tests/qure/                   Qure-generated tests
demo/                          Demo Next.js app
action.yml                     Reusable GitHub Action
```

## License

ISC
