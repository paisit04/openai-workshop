import { createPharmacyHttpApp } from '../src/http-app.mjs';

const host = process.env.MCP_HTTP_HOST ?? '127.0.0.1';
const port = Number(process.env.MCP_HTTP_PORT ?? 3000);
const mcpPath = process.env.MCP_HTTP_PATH ?? '/mcp';

const app = createPharmacyHttpApp();

const httpServer = app.listen(port, host, error => {
  if (error) {
    console.error('Failed to start MCP HTTP server:', error);
    process.exit(1);
  }

  console.log(`MCP HTTP server listening at http://${host}:${port}${mcpPath}`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  app.closePharmacySessions();
  httpServer.close(() => process.exit(0));
}
