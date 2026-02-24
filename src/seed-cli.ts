#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { buildGeneratorConfig, isProfile, isScale, loadConfigFile } from "./seed/config";
import { generateScenario } from "./seed/generator";
import {
  cloneBaseScenario,
  listScenarios,
  resolveScenarioRoot,
  runRepoDemoValidator,
  scenarioDir,
  writeScenarioAtomic,
} from "./seed/io";
import { validateGeneratedScenario, validateScenarioOnDisk } from "./seed/validation";
import { GeneratedScenario, SeedCliOptions } from "./seed/types";

function main(): void {
  try {
    const [cmd, ...args] = process.argv.slice(2);

    if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
      printHelp();
      process.exit(0);
    }

    const parsed = parseOptions(args);

    if (cmd === "list-scenarios") {
      runList(parsed);
      return;
    }

    if (cmd === "validate-scenario") {
      runValidate(parsed);
      return;
    }

    if (cmd === "create-scenario") {
      runCreate(parsed);
      return;
    }

    if (cmd === "update-scenario") {
      runUpdate(parsed);
      return;
    }

    throw new Error(`Unknown command '${cmd}'. Run with --help.`);
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function runCreate(options: SeedCliOptions): void {
  const root = resolveScenarioRoot(options.rootDir);
  const scenario = buildScenario(options);
  const targetDir = scenarioDir(root, scenario.manifest.scenario);

  if (fs.existsSync(targetDir) && !options.force) {
    throw new Error(`Scenario already exists: ${targetDir}. Use --force to overwrite.`);
  }

  const validation = validateGeneratedScenario(scenario, targetDir);
  if (!validation.ok) {
    printIssues(validation.issues);
    throw new Error("Generated scenario failed validation");
  }

  writeScenarioAtomic(root, scenario, true);

  const post = validateScenarioOnDisk(root, scenario.manifest.scenario);
  if (!post.ok) {
    printIssues(post.issues);
    throw new Error("Scenario failed on-disk validation after write");
  }

  const repoValidation = runRepoDemoValidator();
  if (!repoValidation.ok) {
    throw new Error(`Repository demo validator failed:\n${repoValidation.output}`);
  }

  console.log(`Created scenario '${scenario.manifest.scenario}' at ${targetDir}`);
}

function runUpdate(options: SeedCliOptions): void {
  const root = resolveScenarioRoot(options.rootDir);
  const config = buildGeneratorConfig(options, loadConfigFile(options.configPath));
  const existingDir = scenarioDir(root, config.scenario);

  if (!fs.existsSync(existingDir)) {
    throw new Error(`Scenario does not exist: ${existingDir}`);
  }

  const scenario = buildScenario(options);
  const validation = validateGeneratedScenario(scenario, existingDir);

  if (!validation.ok) {
    printIssues(validation.issues);
    throw new Error("Updated scenario failed validation");
  }

  if (options.dryRun) {
    console.log(`Dry-run successful. Scenario '${scenario.manifest.scenario}' is valid and ready to write.`);
    return;
  }

  writeScenarioAtomic(root, scenario, true);

  const post = validateScenarioOnDisk(root, scenario.manifest.scenario);
  if (!post.ok) {
    printIssues(post.issues);
    throw new Error("Updated scenario failed on-disk validation after write");
  }

  const repoValidation = runRepoDemoValidator();
  if (!repoValidation.ok) {
    throw new Error(`Repository demo validator failed:\n${repoValidation.output}`);
  }

  console.log(`Updated scenario '${scenario.manifest.scenario}' at ${existingDir}`);
}

function runList(options: SeedCliOptions): void {
  const root = resolveScenarioRoot(options.rootDir);
  const rows = listScenarios(root);

  if (options.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log(`No scenarios found in ${root}`);
    return;
  }

  for (const row of rows) {
    console.log(`${row.scenario} | as_of=${row.asOfDate || "-"} | ${row.description || ""}`);
  }
}

function runValidate(options: SeedCliOptions): void {
  const root = resolveScenarioRoot(options.rootDir);

  if (options.name) {
    const result = validateScenarioOnDisk(root, options.name);
    if (!result.ok) {
      printIssues(result.issues);
      throw new Error(`Scenario '${options.name}' failed validation`);
    }
    console.log(`Scenario '${options.name}' is valid.`);
    return;
  }

  const rows = listScenarios(root);
  if (rows.length === 0) {
    throw new Error(`No scenarios found in ${root}`);
  }

  let failures = 0;
  for (const row of rows) {
    const result = validateScenarioOnDisk(root, row.scenario);
    if (!result.ok) {
      failures += 1;
      console.error(`Scenario '${row.scenario}' failed:`);
      printIssues(result.issues);
    } else {
      console.log(`Scenario '${row.scenario}' is valid.`);
    }
  }

  if (failures > 0) {
    throw new Error(`${failures} scenario(s) failed validation`);
  }
}

function buildScenario(options: SeedCliOptions): GeneratedScenario {
  const configFile = loadConfigFile(options.configPath);
  const config = buildGeneratorConfig(options, configFile);
  const root = resolveScenarioRoot(options.rootDir);
  const packageVersion = readPackageVersion();

  if (config.baseScenario) {
    const cloned = cloneBaseScenario(root, config.baseScenario, config.scenario);
    cloned.manifest.as_of_date = config.asOfDate;
    if (config.description) {
      cloned.manifest.description = config.description;
    }
    cloned.metadata = {
      ...cloned.metadata,
      seed: config.seed,
      generated_at: new Date().toISOString(),
      generator_version: packageVersion,
    };
    return cloned;
  }

  return generateScenario(config, packageVersion);
}

function parseOptions(args: string[]): SeedCliOptions {
  const options: SeedCliOptions = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument '${arg}'`);
    }

    const key = arg.slice(2);

    if (key === "force" || key === "dry-run" || key === "strict" || key === "json") {
      (options as unknown as Record<string, unknown>)[toCamelCase(key)] = true;
      continue;
    }

    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Option '--${key}' requires a value`);
    }
    i += 1;

    switch (key) {
      case "name":
        options.name = next;
        break;
      case "as-of-date":
        options.asOfDate = next;
        break;
      case "scale":
        if (!isScale(next)) throw new Error(`Invalid scale '${next}'`);
        options.scale = next;
        break;
      case "profile":
        if (!isProfile(next)) throw new Error(`Invalid profile '${next}'`);
        options.profile = next;
        break;
      case "seed":
      case "customers":
      case "vendors":
      case "items":
      case "invoices":
      case "transactions": {
        const parsed = Number(next);
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
          throw new Error(`Option '--${key}' must be an integer`);
        }
        (options as unknown as Record<string, number>)[toCamelCase(key)] = parsed;
        break;
      }
      case "base-scenario":
        options.baseScenario = next;
        break;
      case "config":
        options.configPath = next;
        break;
      case "root-dir":
        options.rootDir = next;
        break;
      default:
        throw new Error(`Unknown option '--${key}'`);
    }
  }

  return options;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function printIssues(issues: Array<{ path: string; message: string }>): void {
  for (const issue of issues) {
    console.error(`- ${issue.path}: ${issue.message}`);
  }
}

function readPackageVersion(): string {
  const packagePath = path.resolve(__dirname, "../package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8")) as { version?: string };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printHelp(): void {
  console.log(`netsuite-mcp-seed

Commands:
  create-scenario
  update-scenario
  list-scenarios
  validate-scenario

Common options:
  --name <scenario_name>
  --as-of-date <YYYY-MM-DD>
  --scale <small|medium|large>
  --profile <baseline|ar_spike|revenue_drop>
  --seed <int>
  --customers <int>
  --vendors <int>
  --items <int>
  --invoices <int>
  --transactions <int>
  --base-scenario <name>
  --config <path>
  --root-dir <path>
  --force
  --dry-run
  --json`);
}

main();
