import { FilterNode, SearchRestletRequest } from "../types";

type RecordLike = Record<string, unknown>;
type EvaluatedSearchResult = {
  count: number;
  rows: unknown[][];
};

function compareStrings(left: unknown, right: unknown): number {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { sensitivity: "base" });
}

function parseDate(value: unknown): number {
  if (typeof value !== "string") return Number.NEGATIVE_INFINITY;

  const asDate = new Date(value);
  if (!isNaN(asDate.getTime())) return asDate.getTime();

  const usDate = new Date(`${value} UTC`);
  return isNaN(usDate.getTime()) ? Number.NEGATIVE_INFINITY : usDate.getTime();
}

function getPath(obj: RecordLike, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    if (typeof acc !== "object") return undefined;
    return (acc as RecordLike)[key];
  }, obj);
}

function normalizeFormulaPath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function resolveField(record: RecordLike, field: string): unknown {
  if (field.startsWith("formulatext:")) {
    const expression = field.split(":")[1] ?? "";
    return getPath(record, normalizeFormulaPath(expression));
  }

  return getPath(record, field);
}

function normalizeTextValue(fieldName: string, value: unknown): unknown {
  if (typeof value !== "string") return value;

  if (fieldName === "type") {
    const typeMap: Record<string, string> = {
      VendBill: "Bill",
      VendCred: "Bill Credit",
      VendPymt: "Bill Payment",
      CustInvc: "Invoice",
      Journal: "Journal",
    };
    return typeMap[value] ?? value;
  }

  return value;
}

function evaluateSimpleCondition(record: RecordLike, condition: string[]): boolean {
  if (condition.length < 3) return true;

  const field = condition[0];
  const operator = condition[1].toLowerCase();
  const rightValues = condition.slice(2);

  const leftValue = resolveField(record, field);

  switch (operator) {
    case "is":
      return String(leftValue) === String(rightValues[0]);
    case "anyof": {
      const set = new Set(rightValues.map((v) => String(v).toLowerCase()));
      return set.has(String(leftValue).toLowerCase());
    }
    case "noneof": {
      const set = new Set(rightValues.map((v) => String(v).toLowerCase()));
      return !set.has(String(leftValue).toLowerCase());
    }
    case "contains":
      return String(leftValue ?? "").toLowerCase().includes(String(rightValues[0] ?? "").toLowerCase());
    case "doesnotcontain":
      return !String(leftValue ?? "").toLowerCase().includes(String(rightValues[0] ?? "").toLowerCase());
    case "onorafter": {
      const left = parseDate(leftValue);
      const right = parseDate(rightValues[0]);
      return left >= right;
    }
    case "onorbefore": {
      const left = parseDate(leftValue);
      const right = parseDate(rightValues[0]);
      return left <= right;
    }
    case "before": {
      const left = parseDate(leftValue);
      const right = parseDate(rightValues[0]);
      return left < right;
    }
    case "after": {
      const left = parseDate(leftValue);
      const right = parseDate(rightValues[0]);
      return left > right;
    }
    case "on": {
      const left = parseDate(leftValue);
      const right = parseDate(rightValues[0]);
      return left === right;
    }
    case "noton": {
      const left = parseDate(leftValue);
      const right = parseDate(rightValues[0]);
      return left !== right;
    }
    default:
      return true;
  }
}

function evaluateNode(record: RecordLike, node: FilterNode): boolean {
  if (typeof node === "string") {
    return true;
  }

  const isSimpleCondition = node.length >= 3 && typeof node[0] === "string" && typeof node[1] === "string";
  if (isSimpleCondition && !Array.isArray(node[0])) {
    return evaluateSimpleCondition(record, node as string[]);
  }

  let result: boolean | undefined;
  let pendingOp: "AND" | "OR" = "AND";

  for (const part of node) {
    if (typeof part === "string") {
      const upper = part.toUpperCase();
      if (upper === "AND" || upper === "OR") pendingOp = upper;
      continue;
    }

    const partResult = evaluateNode(record, part);

    if (result === undefined) {
      result = partResult;
    } else {
      result = pendingOp === "AND" ? result && partResult : result || partResult;
    }
  }

  return result ?? true;
}

function projectColumns(record: RecordLike, columns: Array<Record<string, unknown>>): unknown[] {
  return columns.map((col) => {
    const name = String(col.name ?? "");
    const join = col.join ? String(col.join) : "";
    const formula = col.formula ? String(col.formula) : "";
    const txt = Boolean(col.txt);

    if (formula) {
      return resolveField(record, normalizeFormulaPath(formula));
    }

    const path = join ? `${join}.${name}` : name;
    const raw = resolveField(record, path);

    if (txt && raw && typeof raw === "object") {
      const objValue = (raw as RecordLike).text ?? (raw as RecordLike).name ?? raw;
      return normalizeTextValue(name, objValue);
    }

    if (txt && record[path + "Text"] !== undefined) {
      return normalizeTextValue(name, record[path + "Text"]);
    }

    if (txt && typeof raw === "object" && raw !== null) {
      const asObj = raw as RecordLike;
      return normalizeTextValue(name, asObj.text ?? asObj.name ?? asObj.value ?? "");
    }

    if (txt) {
      return normalizeTextValue(name, raw);
    }

    if (typeof raw === "object" && raw !== null) {
      const asObj = raw as RecordLike;
      const value = asObj.internalid ?? asObj.value ?? asObj.text ?? asObj.name ?? "";
      return String(value);
    }

    return raw;
  });
}

function compareValues(a: unknown, b: unknown): number {
  const aDate = parseDate(a);
  const bDate = parseDate(b);

  if (aDate !== Number.NEGATIVE_INFINITY && bDate !== Number.NEGATIVE_INFINITY) {
    return aDate - bDate;
  }

  const aNum = Number(a);
  const bNum = Number(b);
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return aNum - bNum;
  }

  return compareStrings(a, b);
}

function sortRows(records: RecordLike[], columns: Array<Record<string, unknown>>): RecordLike[] {
  const sortCol = columns.find((c) => c.sort === "ASC" || c.sort === "DESC");
  if (!sortCol) return records;

  const direction = String(sortCol.sort).toUpperCase() === "DESC" ? -1 : 1;
  const sorted = [...records].sort((left, right) => {
    const projectedLeft = projectColumns(left, [sortCol])[0];
    const projectedRight = projectColumns(right, [sortCol])[0];
    return compareValues(projectedLeft, projectedRight) * direction;
  });

  return sorted;
}

function maybeAggregateRows(rows: unknown[][], columns: Array<Record<string, unknown>>): unknown[][] {
  const hasSummary = columns.some((col) => col.summary === "GROUP" || col.summary === "SUM");
  if (!hasSummary) return rows;

  const groupIdx = columns.findIndex((col) => col.summary === "GROUP");
  const sumIdx = columns.findIndex((col) => col.summary === "SUM");
  if (groupIdx === -1 || sumIdx === -1) return rows;

  const grouped = new Map<string, { groupValue: unknown; sum: number }>();

  for (const row of rows) {
    const key = String(row[groupIdx]);
    const existing = grouped.get(key) ?? { groupValue: row[groupIdx], sum: 0 };
    existing.sum += Number(row[sumIdx] ?? 0);
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).map((g) => {
    const row = new Array(columns.length).fill(undefined);
    row[groupIdx] = g.groupValue;
    row[sumIdx] = g.sum;
    return row;
  });
}

export function evaluateSearchRequest(records: RecordLike[], req: SearchRestletRequest): EvaluatedSearchResult {
  const filtered = records.filter((row) => evaluateNode(row, req.filters));
  const sorted = sortRows(filtered, req.columns);
  const maxResults = req.maxResults && req.maxResults > 0 ? req.maxResults : sorted.length;

  const projected = sorted.map((row) => projectColumns(row, req.columns));
  const aggregated = maybeAggregateRows(projected, req.columns);

  const count = aggregated.length;
  const rows = aggregated.slice(0, maxResults);

  return { count, rows };
}
