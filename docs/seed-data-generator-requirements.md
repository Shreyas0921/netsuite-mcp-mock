# Seed Data Generator Requirements

## Purpose
Define requirements for an application that generates demo seed data (scenario packs) compatible with this repository's mock mode.

## Scope
The application must generate and maintain scenario packs under:

- `demo-data/scenarios/<scenario_name>`

The output must be accepted by the existing loader and validator used by mock mode.

## Functional Requirements

1. Generate a complete scenario folder at `demo-data/scenarios/<scenario_name>`.
2. Create `manifest.json` containing:
   - `version: 1`
   - `scenario` (non-empty string)
   - `description` (optional)
   - `as_of_date` (optional, recommended)
   - `datasets` object mapping required dataset keys to relative file paths
3. Generate all required dataset files as JSON arrays of objects for:
   - `accounts`
   - `accountingperiod`
   - `subsidiary`
   - `vendor`
   - `customer`
   - `department`
   - `location`
   - `item`
   - `classification`
   - `invoice`
   - `customerpayment`
   - `creditmemo`
   - `transaction`
4. Ensure all manifest dataset paths resolve within the scenario directory (no path escape).
5. Support creating a new scenario from scratch.
6. Support updating an existing scenario safely (without breaking required structure).
7. Run validation after generation and fail if output is invalid.

## Data Integrity Requirements

1. Enforce minimum referential integrity expected by runtime loader:
   - `invoice` references valid `customer` and `account`
   - `transaction` references valid `account`, `subsidiary`, and `vendor`
2. Ensure each dataset file is a valid JSON array.
3. Ensure each row is a JSON object.

## Data Modeling Requirements

1. IDs should be stable and integer-like for NetSuite parity.
2. Dates should match expectations of current tools:
   - Search-style rows: NetSuite-like date strings where tools expect them.
   - Accounting period/SuiteQL rows: ISO-like dates (`YYYY-MM-DD`) for filtering/sorting.
3. Include fields used by existing filters/formulas/joins (for example `account`, `entity`, `subsidiary`, `status`, joined display fields).
4. Include values required for `txt`-style lookups where applicable.

## Interface Requirements

The application should expose a CLI with at least:

1. `create-scenario`
2. `update-scenario`
3. `validate-scenario`
4. `list-scenarios`

Expected CLI inputs/options:

1. Scenario name
2. As-of date
3. Record count/scale controls
4. Distribution or profile knobs (for scenario characteristics)
5. Optional base scenario/template to clone
6. Optional deterministic random seed

## Validation Requirements

1. Structural validation of manifest and dataset presence.
2. Referential integrity validation before write and/or before final success.
3. Deterministic mode validation (same seed + inputs => same output).
4. Clear error messages with file path and row context where possible.
5. Must pass repository validator command:
   - `npm run validate:demo-data`

## Non-Functional Requirements

1. Deterministic output when seed and inputs are fixed.
2. Idempotent behavior for repeated runs.
3. Safe write behavior (`--force`, explicit overwrite, or merge policy).
4. Fast enough for demo workflows.
5. Auditable generation metadata (config, seed, generator version).

## Testing Requirements

1. Unit tests for:
   - Manifest creation
   - Dataset shape checks
   - Referential integrity checks
2. Golden-file tests for deterministic output.
3. Integration test verifying generated scenarios load via runtime loader.
4. CI step that validates generated/committed scenario packs.

## Compatibility Constraints

Generated output must remain compatible with:

- `src/providers/mock/scenario-loader.ts`
- `src/providers/mock-provider.ts`
- `setup/validate-demo-data.js`
- `docs/mock-data.md`

## Acceptance Criteria

A generated scenario is considered acceptable when all are true:

1. The scenario directory contains `manifest.json` and all required datasets.
2. `npm run validate:demo-data` succeeds.
3. Mock server starts with:
   - `NETSUITE_MODE=mock`
   - `DEMO_SCENARIO=<scenario_name>`
4. Tool calls return valid responses using the generated scenario.
