import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getIncomingRequests, getSystemOverviewMetrics } from './pharmacy-crawler.mjs';

const crawlerOptionsSchema = {
  headless: z.boolean().optional().describe('Override PHARMACY_HEADLESS for this call. Defaults to true unless PHARMACY_HEADLESS=false.'),
  timeoutMs: z.number().int().positive().optional().describe('Override PHARMACY_TIMEOUT_MS for this call.'),
};

const tools = [
  {
    name: 'get_system_overview_metrics',
    title: 'Get System Overview Metrics',
    description: 'Log in to the Mercy Pharmacy System and return the four System Overview metrics.',
    inputSchema: {
      ...crawlerOptionsSchema,
      overviewUrl: z.string().url().optional().describe('Override PHARMACY_OVERVIEW_URL for this call.'),
    },
    handler: getSystemOverviewMetrics,
  },
  {
    name: 'get_incoming_requests',
    title: 'Get Incoming Requests',
    description: 'Log in to the Mercy Pharmacy System and return the Incoming Requests / Requisition Management table.',
    inputSchema: {
      ...crawlerOptionsSchema,
      incomingRequestsUrl: z.string().url().optional().describe('Override PHARMACY_INCOMING_REQUESTS_URL for this call.'),
    },
    handler: getIncomingRequests,
  },
];

export function createPharmacyMcpServer() {
  const server = new McpServer({
    name: 'mercy-pharmacy-crawler',
    version: '1.0.0',
  });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async options => asJsonToolResult(await tool.handler(options)),
    );
  }

  return server;
}

export function getPharmacyMcpToolSummaries() {
  return tools.map(tool => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
  }));
}

function asJsonToolResult(value) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
