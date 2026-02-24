#!/usr/bin/env node
const {
  listScenarios,
  validateGeneratedParity,
  validateCanonicalScenario,
} = require("@chatfinai/mcp-scenario-contract");

let hasError = false;

for (const scenario of listScenarios()) {
  const canonical = validateCanonicalScenario(scenario);
  if (!canonical.ok) {
    hasError = true;
    for (const issue of canonical.issues) {
      console.error(`[canonical:${scenario}] ${issue.path}: ${issue.message}`);
    }
  }

  const parity = validateGeneratedParity({ scenario });
  if (!parity.ok) {
    hasError = true;
    for (const issue of parity.issues) {
      console.error(`[parity:${scenario}] ${issue.path}: ${issue.message}`);
    }
  }
}

if (hasError) process.exit(1);
console.log("Contract canonical and parity validation passed.");
