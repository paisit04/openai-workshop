# Repository Guidelines

## Project Structure & Module Organization

This repository contains a Node.js ES module crawler for the Mercy Malaysia Pharmacy System. Core reusable code lives in `src/`:

- `src/pharmacy-crawler.mjs` contains Playwright login, navigation, and data extraction helpers.
- `src/mcp-server.mjs` defines MCP tools around the crawler.

CLI entrypoints live in `scripts/`:

- `scripts/get-system-overview-metrics.mjs` prints dashboard metrics as JSON.
- `scripts/get-incoming-requests.mjs` prints incoming request data as JSON.
- `scripts/mcp-server.mjs` starts the stdio MCP server.
- `scripts/mcp-http-server.mjs` starts the Streamable HTTP MCP server.

Configuration examples belong in `.env.example`; local secrets belong only in `.env`.

## Build, Test, and Development Commands

Install dependencies:

```bash
npm install
npx playwright install chromium
```

Run the crawlers:

```bash
npm run metrics
npm run incoming
```

Run MCP servers:

```bash
npm run mcp
npm run mcp:http
```

Use visible browser mode when debugging login or page selectors:

```bash
PHARMACY_HEADLESS=false npm run metrics
```

## Coding Style & Naming Conventions

Use modern JavaScript ES modules with `.mjs` files. Keep indentation at two spaces and prefer `const` unless reassignment is required. Name script files by action and target, for example `get-system-overview-metrics.mjs`. Keep reusable crawler behavior in `src/` and thin command wrappers in `scripts/`.

Selectors and label text should be configurable through environment variables when they are likely to vary between deployments.

## Testing Guidelines

There is no automated test suite yet. Before submitting changes, run the relevant command manually and confirm JSON output shape. For crawler changes, test both normal headless mode and visible mode if selectors, login flow, or navigation changed.

When tests are added, prefer Playwright-focused integration tests and name them after the behavior under test, such as `metrics extraction returns overview counts`.

## Commit & Pull Request Guidelines

The repository currently has no commits, so no project-specific commit convention is established. Use short imperative commit messages, for example `Add incoming requests crawler`.

Pull requests should include the purpose of the change, commands run, sample sanitized output, and any new or changed environment variables. Link related issues when available.

## Security & Configuration Tips

Never commit `.env`, credentials, cookies, screenshots with private data, or raw pharmacy exports. Keep `.env.example` limited to variable names and safe defaults. Do not expose `npm run mcp:http` publicly without authentication, because the tools use configured pharmacy credentials.
