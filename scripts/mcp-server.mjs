import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPharmacyMcpServer } from '../src/mcp-server.mjs';

const server = createPharmacyMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
