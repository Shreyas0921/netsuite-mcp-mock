const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateSearchRequest } = require('../dist/providers/mock/query-evaluator.js');
const { executeMockSuiteQL } = require('../dist/providers/mock/sql-router.js');

test('evaluateSearchRequest supports filters, sorting, and projection', () => {
  const rows = [
    { internalid: 1, amount: 10, trandate: '10/01/2025', status: 'Open' },
    { internalid: 2, amount: 20, trandate: '11/01/2025', status: 'Paid In Full' },
    { internalid: 3, amount: 15, trandate: '10/15/2025', status: 'Open' },
  ];

  const req = {
    type: 'invoice',
    filters: [['status', 'is', 'Open'], 'AND', ['trandate', 'onorafter', '10/01/2025']],
    columns: [
      { name: 'internalid' },
      { name: 'amount', sort: 'DESC' },
      { name: 'trandate' },
    ],
    maxResults: 10,
  };

  const result = evaluateSearchRequest(rows, req);

  assert.equal(result.count, 2);
  assert.deepEqual(result.rows[0], [3, 15, '10/15/2025']);
  assert.deepEqual(result.rows[1], [1, 10, '10/01/2025']);
});

test('evaluateSearchRequest supports GROUP + SUM summaries', () => {
  const rows = [
    { account: { internalid: 1110 }, amount: 10 },
    { account: { internalid: 1110 }, amount: 15 },
    { account: { internalid: 1120 }, amount: 7 },
  ];

  const req = {
    type: 'transaction',
    filters: [['amount', 'anyof', '10', '15', '7']],
    columns: [
      { name: 'internalid', join: 'account', summary: 'GROUP' },
      { name: 'amount', summary: 'SUM' },
    ],
    maxResults: 10,
  };

  const result = evaluateSearchRequest(rows, req);
  assert.equal(result.count, 2);
});

test('executeMockSuiteQL handles account queries with ordering and pagination', () => {
  const datasets = {
    accounts: [
      { internalid: 1, accountSearchDisplayNameCopy: 'Zeta', acctNumber: '200', parent: null, acctType: 'Expense', acctTypeText: 'Expense' },
      { internalid: 2, accountSearchDisplayNameCopy: 'Alpha', acctNumber: '100', parent: null, acctType: 'Income', acctTypeText: 'Income' },
    ],
    accountingperiod: [],
  };

  const query = 'SELECT TOP 1 a.Id AS Id, a.accountSearchDisplayNameCopy AS Name FROM Account a ORDER BY a.accountSearchDisplayNameCopy ASC';
  const result = executeMockSuiteQL(query, 0, datasets);

  assert.equal(result.count, 1);
  assert.equal(result.totalCount, 2);
  assert.equal(result.items[0].Name, 'Alpha');
});
