# Mercy Pharmacy Metrics Crawler

Playwright script to log in to the Mercy Malaysia Pharmacy System and read the four System Overview metrics.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and set:

```bash
PHARMACY_USERNAME=...
PHARMACY_PASSWORD=...
```

Install Playwright's browser once:

```bash
npx playwright install chromium
```

## Run

```bash
npm run metrics
```

The script prints JSON:

```json
{
  "dispensed30Days": 36,
  "lowStockAlerts": 0,
  "pendingRequests": 0,
  "expiringUnder90Days": 0
}
```

For troubleshooting, run with a visible browser:

```bash
PHARMACY_HEADLESS=false npm run metrics
```

## Incoming Requests

Read the Incoming Requests / Requisition Management table:

```bash
npm run incoming
```

The script prints JSON:

```json
{
  "total": 9,
  "requests": [
    {
      "date": "03 Jun 26",
      "item": "ubat",
      "requester": "clinic TEST pharmacist",
      "quantity": 20,
      "status": "Approved",
      "auditBy": "ITADMIN",
      "auditAt": "08 Jun, 18:35",
      "adminRemarks": null,
      "action": "Closed"
    }
  ]
}
```

By default it navigates by clicking the Incoming Requests menu item after login. If needed, set `PHARMACY_INCOMING_REQUESTS_URL` in `.env` to go directly to the page.

## MCP Server

Run the crawler as a stdio MCP server:

```bash
npm run mcp
```

The server exposes two tools:

- `get_system_overview_metrics`
- `get_incoming_requests`

Example MCP client configuration:

```json
{
  "mcpServers": {
    "mercy-pharmacy-crawler": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/Users/paisitj/Code/openai-workshop/crawler"
    }
  }
}
```

### HTTP MCP Server

Run the crawler as a Streamable HTTP MCP server:

```bash
npm run mcp:http
```

By default it listens on:

```text
http://127.0.0.1:3000/mcp
```

Configuration:

```bash
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=3000
MCP_HTTP_PATH=/mcp
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

Debug tool listing for Postman or a browser:

```bash
curl http://127.0.0.1:3000/tools
```

The real MCP endpoint is JSON-RPC over HTTP. A plain `GET /mcp` will not list tools.

Postman MCP flow:

1. `POST http://127.0.0.1:3000/mcp`

Headers:

```text
Content-Type: application/json
Accept: application/json, text/event-stream
```

Body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {},
    "clientInfo": {
      "name": "postman",
      "version": "1.0.0"
    }
  }
}
```

Copy the `mcp-session-id` response header.

2. `POST http://127.0.0.1:3000/mcp`

Headers:

```text
Content-Type: application/json
Accept: application/json, text/event-stream
mcp-session-id: <copied-session-id>
```

Body:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

For ChatGPT MCP, deploy or tunnel the HTTP server behind a public HTTPS URL and configure ChatGPT with the MCP endpoint URL, for example:

```text
https://your-domain.example/mcp
```

Do not expose this server publicly without an access-control layer, because its tools log in to the pharmacy system using the credentials configured in `.env`.
