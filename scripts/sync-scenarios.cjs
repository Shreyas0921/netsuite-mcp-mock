#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  CONTRACT_VERSION,
  PACKAGE,
  listScenarios,
  generateNetSuiteScenario,
} = require("@chatfinai/mcp-scenario-contract");

const checkOnly = process.argv.includes("--check");
const repoRoot = path.resolve(__dirname, "..");
const scenariosRoot = path.join(repoRoot, "demo-data", "scenarios");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function equalJsonFile(filePath, expected) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const actual = readJson(filePath);
    return JSON.stringify(actual) === JSON.stringify(expected);
  } catch {
    return false;
  }
}

let changed = false;
for (const scenario of listScenarios()) {
  const generated = generateNetSuiteScenario(scenario);
  generated.manifest.contract = { package: PACKAGE, version: CONTRACT_VERSION, scenario };

  const scenarioDir = path.join(scenariosRoot, scenario);
  const manifestPath = path.join(scenarioDir, "manifest.json");

  if (checkOnly && !equalJsonFile(manifestPath, generated.manifest)) {
    console.error(`Mismatch: ${path.relative(repoRoot, manifestPath)}`);
    changed = true;
  } else if (!checkOnly) {
    writeJson(manifestPath, generated.manifest);
  }

  for (const [datasetKey, rows] of Object.entries(generated.datasets)) {
    const relPath = generated.manifest.datasets[datasetKey];
    const datasetPath = path.join(scenarioDir, relPath);

    if (checkOnly && !equalJsonFile(datasetPath, rows)) {
      console.error(`Mismatch: ${path.relative(repoRoot, datasetPath)}`);
      changed = true;
    } else if (!checkOnly) {
      writeJson(datasetPath, rows);
    }
  }
}

if (checkOnly && changed) {
  console.error("Scenario data is out of sync with contract package.");
  process.exit(1);
}

if (!checkOnly) {
  console.log("NetSuite scenario data synchronized from contract package.");
} else {
  console.log("NetSuite scenario data matches contract package.");
}
