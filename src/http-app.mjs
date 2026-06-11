import { randomUUID } from 'node:crypto';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createPharmacyMcpServer, getPharmacyMcpToolSummaries } from './mcp-server.mjs';

export function createPharmacyHttpApp() {
  const mcpPath = process.env.MCP_HTTP_PATH ?? '/mcp';
  const bearerToken = process.env.MCP_BEARER_TOKEN;
  const app = createMcpExpressApp({ allowedHosts: getAllowedHosts() });
  const sessions = new Map();

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      name: 'mercy-pharmacy-crawler',
      transport: 'streamable-http',
      mcpPath,
      toolsPath: '/tools',
    });
  });

  app.use((req, res, next) => {
    if (req.path === '/health' || !bearerToken) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (token === bearerToken) {
      next();
      return;
    }

    res
      .status(401)
      .set('WWW-Authenticate', 'Bearer')
      .json({
        error: 'unauthorized',
        message: 'Missing or invalid bearer token.',
      });
  });

  app.get('/tools', (_req, res) => {
    res.json({
      name: 'mercy-pharmacy-crawler',
      note: 'Debug endpoint for humans. MCP clients should use POST requests to the MCP endpoint.',
      mcpPath,
      tools: getPharmacyMcpToolSummaries(),
    });
  });

  app.post(mcpPath, async (req, res) => {
    try {
      const existingSessionId = readSessionId(req);
      let session = existingSessionId ? sessions.get(existingSessionId) : undefined;

      if (!session && isInitializeRequest(req.body)) {
        const server = createPharmacyMcpServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: initializedSessionId => {
            sessions.set(initializedSessionId, { server, transport });
          },
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
          }
        };

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (!session) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid MCP session ID provided.',
          },
          id: null,
        });
        return;
      }

      await session.transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP HTTP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error.',
          },
          id: null,
        });
      }
    }
  });

  app.get(mcpPath, (_req, res) => {
    res.status(405).set('Allow', 'POST, DELETE').send('Method Not Allowed');
  });

  app.delete(mcpPath, async (req, res) => {
    const existingSessionId = readSessionId(req);
    const session = existingSessionId ? sessions.get(existingSessionId) : undefined;

    if (!session) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid MCP session ID provided.',
        },
        id: null,
      });
      return;
    }

    await session.transport.handleRequest(req, res);
    sessions.delete(existingSessionId);
    session.server.close();
  });

  app.closePharmacySessions = () => {
    for (const session of sessions.values()) {
      session.server.close();
    }
    sessions.clear();
  };

  return app;
}

function readSessionId(req) {
  const sessionId = req.headers['mcp-session-id'];
  return Array.isArray(sessionId) ? sessionId[0] : sessionId;
}

function getAllowedHosts() {
  return [
    '127.0.0.1',
    'localhost',
    '::1',
    process.env.VERCEL_URL,
    ...splitCsv(process.env.MCP_ALLOWED_HOSTS),
  ].filter(Boolean);
}

function splitCsv(value) {
  return value
    ? value.split(',').map(item => item.trim()).filter(Boolean)
    : [];
}
