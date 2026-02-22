const test = require('node:test');
const assert = require('node:assert/strict');

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { McpServerFactory } = require('../dist/shared/mcp-server-factory.js');
const { resetProviderForTests } = require('../dist/providers/provider-factory.js');

async function createConnectedClientAndServer() {
  process.env.NETSUITE_MODE = 'mock';
  process.env.DEMO_SCENARIO = 'ar_spike';
  process.env.DEMO_DATA_DIR = 'demo-data/scenarios';

  resetProviderForTests();

  const server = McpServerFactory.createServer();
  const client = new Client({ name: 'netsuite-mcp-test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    server,
    client,
    async close() {
      await client.close();
      await server.close();
      resetProviderForTests();
    },
  };
}

const dateFilters = [{ Column: 'Date', Operator: '>=', Value: '2025-10-01' }];

test('MCP server exposes expected tools and tool calls succeed in mock mode', async () => {
  const ctx = await createConnectedClientAndServer();

  try {
    const listed = await ctx.client.listTools();
    const toolNames = new Set((listed.tools || []).map((tool) => tool.name));

    const expected = [
      'get-accounts',
      'get-account-balance',
      'get-subsidiaries',
      'get-accounting-periods',
      'get-vendors',
      'get-customers',
      'get-customer-details',
      'get-classes',
      'get-departments',
      'get-locations',
      'get-items',
      'get-invoices',
      'get-payments',
      'get-credit-memos',
      'get-invoice-items',
      'get-posting-period',
      'get-transactions',
      'get-bills',
      'get-journals',
    ];

    for (const name of expected) {
      assert.ok(toolNames.has(name), `Missing tool: ${name}`);
    }

    const calls = [
      ['get-accounts', {}],
      ['get-account-balance', { AccountNumbers: ['1100'], StartDate: '2025-10-01', EndDate: '2025-11-30' }],
      ['get-subsidiaries', {}],
      ['get-accounting-periods', {}],
      ['get-vendors', {}],
      ['get-customers', {}],
      ['get-customer-details', { searchValue: 'Apex Retail' }],
      ['get-classes', {}],
      ['get-departments', {}],
      ['get-locations', {}],
      ['get-items', {}],
      ['get-invoices', { Filters: dateFilters }],
      ['get-payments', { Filters: dateFilters }],
      ['get-credit-memos', { Filters: dateFilters }],
      ['get-invoice-items', {}],
      ['get-posting-period', {}],
      ['get-transactions', { Filters: dateFilters }],
      ['get-bills', { Filters: dateFilters }],
      ['get-journals', { Filters: dateFilters }],
    ];

    for (const [name, args] of calls) {
      const result = await ctx.client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, `Tool returned error: ${name} ${JSON.stringify(result.content)}`);
      assert.ok(result.content, `Tool returned no content: ${name}`);
    }
  } finally {
    await ctx.close();
  }
});
