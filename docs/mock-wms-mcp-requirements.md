# Mock WMS MCP Server Requirements

## Purpose
Define requirements for a mock Warehouse Management System (WMS) MCP server that can be used alongside the NetSuite mock MCP server to test AI agent root cause analysis (RCA) across multiple data sources.

## Goals
1. Provide a deterministic, scenario-driven mock WMS data source.
2. Enable cross-source RCA workflows by aligning WMS and NetSuite scenario keys.
3. Support repeatable evaluation of reasoning quality under controlled operational failure patterns.

## Scope
In scope:

1. A standalone MCP server for WMS mock data.
2. Scenario-pack loading and validation for WMS datasets.
3. Tool surface for inventory, fulfillment, receiving, and variance diagnostics.
4. Cross-source key compatibility with NetSuite mock scenarios.

Out of scope (v1):

1. Full live WMS API integration.
2. Full simulation of every warehouse process.
3. Real-time event streaming.

## Functional Requirements

1. The server must support runtime modes:
   - `mock` (required)
   - `live` (optional placeholder)
2. In `mock` mode, the server must load scenario data from disk:
   - `<DEMO_DATA_DIR>/<SCENARIO>/wms`
3. Scenario data must include:
   - `manifest.json`
   - required `datasets/*.json`
4. On startup, the server must fail fast on invalid scenario data.
5. The server should support file-watch auto-reload in mock mode.
6. If reload fails, server must retain last known good in-memory snapshot.

## Data Model Requirements

Required WMS datasets (v1):

1. `warehouse`
2. `item`
3. `inventory_balance`
4. `inventory_movement`
5. `receipt`
6. `shipment`
7. `pick_task`
8. `cycle_count`
9. `supplier_leadtime`

Dataset rules:

1. Each dataset file must be a JSON array of objects.
2. Required fields must be present per dataset schema.
3. IDs should be stable and deterministic under fixed seed.
4. Time fields should use a consistent format and timezone strategy.

## Scenario Pack Requirements

Each scenario directory must contain:

1. `manifest.json` with:
   - `version: 1`
   - `scenario` (string)
   - `description` (optional)
   - `as_of_date` (recommended)
   - `datasets` map for all required dataset keys
2. `datasets/*.json` files referenced by manifest.
3. Optional `generator-metadata.json` for reproducibility metadata.

## Cross-Source Compatibility Requirements

To support RCA across NetSuite + WMS, shared keys must be aligned for the same scenario name:

1. Item key alignment:
   - WMS `item.sku` must map to NetSuite `item.itemid` (or documented mapping table).
2. Location/warehouse alignment:
   - WMS warehouse must map to NetSuite location/subsidiary (directly or via mapping dataset).
3. Document linkage where applicable:
   - order IDs, invoice references, PO numbers, shipment references.
4. Temporal alignment:
   - event date ranges between sources must overlap and be comparable.
5. Scenario coherence:
   - injected anomalies in WMS should plausibly explain or contribute to finance symptoms in NetSuite.

## MCP Tool Requirements

The server must expose tools suitable for RCA workflows, including:

1. `get_inventory_by_sku_location`
2. `get_inventory_movements`
3. `get_open_pick_tasks`
4. `get_late_receipts`
5. `get_shipment_delays`
6. `get_cycle_count_variance`
7. `get_supplier_leadtime_variance`

Tool output requirements:

1. Stable response schema with explicit field types.
2. Filter support for date windows, SKU, warehouse, status.
3. Sort and pagination support for large result sets.
4. Clear error messages for invalid filters and missing entities.

## Validation Requirements

1. Manifest and dataset structural validation.
2. Referential integrity checks, including:
   - movement -> item + warehouse
   - pick_task -> shipment/order + item + warehouse
   - receipt/shipment -> item + warehouse
3. Cross-source consistency checks (optional in v1, recommended in v1.1):
   - WMS SKUs reconcile with NetSuite items for same scenario.
4. Local validation command:
   - `npm run validate:wms-demo-data`

## Determinism and Reproducibility Requirements

1. Scenario generation must support `--seed`.
2. Same input + seed must produce byte-stable output.
3. Metadata should capture:
   - generator version
   - seed
   - config hash
   - generated timestamp

## Non-Functional Requirements

1. Startup and query performance suitable for interactive MCP usage.
2. Readable logs with scenario/load context.
3. Robust error handling and safe fallback behavior.
4. Clear operational docs for local setup and testing.

## Security and Safety Requirements

1. No external network dependency required in mock mode.
2. Validate file paths to prevent directory traversal.
3. Prevent execution with partially loaded/invalid scenario state.

## Testing Requirements

1. Unit tests for:
   - manifest validation
   - dataset schema checks
   - referential checks
   - tool-level filter/sort behavior
2. Integration tests for:
   - mock server startup with valid/invalid scenarios
   - tool responses against fixture scenarios
3. Cross-server RCA tests (NetSuite + WMS):
   - at least one test case where root cause requires evidence from both servers.
4. Determinism tests for scenario generation.

## Observability Requirements

1. Log scenario name, data root, and loaded timestamp at startup.
2. Log reload success/failure events with reason.
3. Include request-level tool timing for performance diagnostics.

## Configuration Requirements

Required in mock mode:

1. `WMS_MODE=mock`
2. `WMS_DEMO_SCENARIO=<scenario_name>`

Optional:

1. `WMS_DEMO_DATA_DIR=<base_path>`
2. `LOG_LEVEL`
3. `PORT` (for HTTP mode)

## Delivery Milestones (Suggested)

1. M1: Core server + mock provider + scenario loader + validation.
2. M2: Initial RCA tool set + schema-stable outputs.
3. M3: Cross-source consistency checks + joint integration tests.
4. M4: Scenario generator and profile library for operational incident patterns.

## Acceptance Criteria

1. Server starts successfully in mock mode with a valid WMS scenario pack.
2. Invalid scenario packs are rejected with actionable errors.
3. All required WMS tools return schema-valid responses.
4. Same scenario name can be used across NetSuite and WMS servers for joined RCA workflows.
5. Deterministic generation and validation workflows pass in CI.
