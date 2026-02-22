# Mock Data Guide

This document explains:

1. How mock mode works in this repository.
2. How to create and maintain scenario packs.
3. What data shape is expected for each dataset.
4. What the mock query engine supports.

## Overview

The server supports two runtime modes:

1. `live`: calls real NetSuite endpoints.
2. `mock`: serves data from local JSON scenario packs.

Mode is selected with:

```bash
NETSUITE_MODE=mock
```

In mock mode, the provider loads a scenario from:

```bash
demo-data/scenarios/<DEMO_SCENARIO>
```

Key environment variables:

1. `NETSUITE_MODE=mock`
2. `DEMO_SCENARIO=ar_spike` (required in mock mode)
3. `DEMO_DATA_DIR=demo-data/scenarios` (optional)

## Runtime Flow

When the server starts:

1. Environment validation checks mock-specific requirements.
2. The provider factory initializes `MockScenarioProvider`.
3. Scenario JSON is loaded and validated (manifest + required datasets + reference checks).
4. Tool calls go through the existing helper layer:
   - `NetSuiteHelper.searchRestlet(...)`
   - `NetSuiteHelper.executeSuiteQL(...)`
5. Those helper calls delegate to the mock provider instead of HTTP.

Files involved:

1. `src/shared/mcp-server-factory.ts`
2. `src/providers/provider-factory.ts`
3. `src/providers/mock-provider.ts`
4. `src/providers/mock/scenario-loader.ts`
5. `src/providers/mock/query-evaluator.ts`
6. `src/providers/mock/sql-router.ts`

## Scenario Pack Structure

Each scenario directory must contain:

1. `manifest.json`
2. `datasets/*.json` files listed by the manifest

Example:

```text
demo-data/scenarios/ar_spike/
├── manifest.json
└── datasets/
    ├── accounts.json
    ├── accountingperiod.json
    ├── subsidiary.json
    ├── vendor.json
    ├── customer.json
    ├── department.json
    ├── location.json
    ├── item.json
    ├── classification.json
    ├── invoice.json
    ├── customerpayment.json
    ├── creditmemo.json
    └── transaction.json
```

Schema reference:

1. `demo-data/schema/scenario-pack.schema.json`

## Manifest Format

Example:

```json
{
  "version": 1,
  "scenario": "ar_spike",
  "description": "AR spike caused by concentration risk and delayed collections",
  "as_of_date": "2025-11-30",
  "datasets": {
    "accounts": "datasets/accounts.json",
    "accountingperiod": "datasets/accountingperiod.json",
    "subsidiary": "datasets/subsidiary.json",
    "vendor": "datasets/vendor.json",
    "customer": "datasets/customer.json",
    "department": "datasets/department.json",
    "location": "datasets/location.json",
    "item": "datasets/item.json",
    "classification": "datasets/classification.json",
    "invoice": "datasets/invoice.json",
    "customerpayment": "datasets/customerpayment.json",
    "creditmemo": "datasets/creditmemo.json",
    "transaction": "datasets/transaction.json"
  }
}
```

Rules:

1. `version` must be `1`.
2. All required dataset keys must exist.
3. Paths must stay inside the scenario directory.
4. Each dataset file must be a JSON array of objects.

## Creating a New Scenario

Recommended workflow:

1. Copy an existing scenario:

```bash
cp -R demo-data/scenarios/ar_spike demo-data/scenarios/my_new_scenario
```

2. Edit `demo-data/scenarios/my_new_scenario/manifest.json`:
   - set `"scenario"` to the new name
   - update `description` and `as_of_date`

3. Update datasets in `datasets/*.json`.

4. Validate:

```bash
npm run validate:demo-data
```

5. Run server in mock mode and smoke test tools:

```bash
NETSUITE_MODE=mock DEMO_SCENARIO=my_new_scenario npm run start:stdio
```

## Data Modeling Conventions

Mock records are designed to satisfy the current tool column configs (joins, formulas, `txt` values, filters).

Use these conventions:

1. IDs:
   - Use integer-like values in raw records (for parity with NetSuite).
   - Tool outputs may convert IDs to strings where schema expects string.

2. Dates:
   - For search-style records, preserve expected NetSuite-like strings (`M/d/yyyy`) when tools rely on date format conversion.
   - For accounting period records used in SuiteQL emulation, keep ISO-like values (`YYYY-MM-DD`) for easier sorting/filtering.

3. Joined fields:
   - Store joined entities as nested objects where needed:
     - `customerMain.companyname`
     - `vendor.entityid`
     - `class.name`
     - `location.name`

4. `txt` fields:
   - For fields used with `txt: true`, include values resolvable to display text.
   - The evaluator normalizes known code fields (for example, transaction `type` codes).

5. Formula/filter fields:
   - Keep fields referenced by filters/formulas present in records (e.g. `account.number`, `status`, `entity`, `subsidiary`).

## Supported Mock Query Behavior

### Search Restlet Emulation

Implemented in `src/providers/mock/query-evaluator.ts`.

Supports:

1. Nested filter groups with `AND` / `OR`.
2. Operators used by current tools:
   - `is`
   - `anyof`
   - `noneof`
   - `contains`
   - `doesnotcontain`
   - date comparisons (`onorafter`, `onorbefore`, `before`, `after`, `on`, `noton`)
3. Column projection with:
   - `name`
   - `join`
   - `formula`
   - `txt`
   - `sort`
4. Group/SUM summary rows for account-balance style queries.
5. `countOnly` and `maxResults`.

### SuiteQL Emulation

Implemented in `src/providers/mock/sql-router.ts`.

Current supported patterns:

1. `FROM Account a ...`
2. `FROM AccountingPeriod ap ...`

Features:

1. Count-only detection.
2. `TOP N` limits.
3. `ORDER BY` parsing.
4. Pagination using `offset`.

## Auto-Reload Behavior

In mock mode, file watching is enabled for scenario files:

1. Valid edits are auto-reloaded.
2. If reload fails validation, the provider keeps the last good in-memory snapshot.

Notes:

1. Recursive file watching depends on platform support.
2. If unsupported, server still works but you may need restart after edits.

## Validation and Safety

Startup validation includes:

1. Manifest version and required keys.
2. Dataset presence and array/object shape.
3. Basic referential integrity:
   - invoice -> customer/account
   - transaction -> account/subsidiary/vendor

Local validation command:

```bash
npm run validate:demo-data
```

## Troubleshooting

1. `Missing required environment variables: DEMO_SCENARIO`
   - Set `DEMO_SCENARIO` when `NETSUITE_MODE=mock`.

2. `No dataset configured for search type ...`
   - Ensure manifest includes required dataset key and file path is correct.

3. Tool schema validation errors in MCP response
   - Check field types in dataset rows (for example enum strings and string-vs-number mismatches).

4. Scenario edits not reflected
   - If your platform does not support recursive watch, restart the server.

## Current Scenario Packs

1. `ar_spike`
2. `revenue_drop`

Use these as templates for new demos.
