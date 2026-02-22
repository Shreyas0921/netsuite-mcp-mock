#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || "demo-data/scenarios";

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(root)) {
  fail(`Scenario root does not exist: ${root}`);
}

const scenarios = fs.readdirSync(root).filter((entry) => {
  const p = path.join(root, entry);
  return fs.statSync(p).isDirectory();
});

if (scenarios.length === 0) {
  fail(`No scenarios found in ${root}`);
}

for (const scenario of scenarios) {
  const scenarioDir = path.resolve(root, scenario);
  const manifestPath = path.join(scenarioDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    fail(`Missing manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.version !== 1) {
    fail(`Unsupported version in ${manifestPath}: ${manifest.version}`);
  }

  if (!manifest.datasets || typeof manifest.datasets !== "object") {
    fail(`manifest.datasets must be an object in ${manifestPath}`);
  }

  for (const [dataset, relPath] of Object.entries(manifest.datasets)) {
    const datasetPath = path.resolve(scenarioDir, relPath);
    if (!datasetPath.startsWith(scenarioDir)) {
      fail(`Dataset path escapes scenario dir (${scenario}): ${relPath}`);
    }
    if (!fs.existsSync(datasetPath)) {
      fail(`Missing dataset file (${scenario}): ${relPath}`);
    }

    const rows = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
    if (!Array.isArray(rows)) {
      fail(`Dataset '${dataset}' in ${scenario} must be an array`);
    }
  }

  console.log(`validated ${scenario}`);
}

console.log("All demo scenario packs are valid JSON and structurally complete.");
