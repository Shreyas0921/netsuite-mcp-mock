import { SuiteQLResponse } from "../types";

type RecordLike = Record<string, unknown>;

function parseTopLimit(query: string): number | undefined {
  const match = query.match(/SELECT\s+TOP\s+(\d+)/i);
  if (!match) return undefined;
  return parseInt(match[1], 10);
}

function parseOrderBy(query: string): { field: string; direction: "ASC" | "DESC" } | null {
  const match = query.match(/ORDER\s+BY\s+([\w\.\(\)]+)\s+(ASC|DESC)/i);
  if (!match) return null;

  return {
    field: match[1],
    direction: match[2].toUpperCase() as "ASC" | "DESC",
  };
}

function sortByField(records: RecordLike[], field: string, direction: "ASC" | "DESC"): RecordLike[] {
  const accessor = (() => {
    if (/acctType/i.test(field)) return (row: RecordLike) => String(row.acctTypeText ?? row.acctType ?? "");
    if (/accountSearchDisplayNameCopy/i.test(field))
      return (row: RecordLike) => String(row.accountSearchDisplayNameCopy ?? row.Name ?? "");
    if (/acctNumber/i.test(field))
      return (row: RecordLike) => String(row.acctNumber ?? row.AccountNumber ?? "");
    if (/startDate/i.test(field)) return (row: RecordLike) => new Date(String(row.startDate ?? "")).getTime();
    if (/endDate/i.test(field)) return (row: RecordLike) => new Date(String(row.endDate ?? "")).getTime();
    return (row: RecordLike) => String(row[field] ?? "");
  })();

  const sorted = [...records].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);

    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
  });

  return direction === "DESC" ? sorted.reverse() : sorted;
}

function mapAccountRows(records: RecordLike[]): RecordLike[] {
  return records.map((r) => ({
    Id: r.Id ?? r.internalid,
    Name: r.Name ?? r.accountSearchDisplayNameCopy,
    AccountNumber: r.AccountNumber ?? r.acctNumber,
    ParentId: r.ParentId ?? r.parent,
    Type: r.Type ?? r.acctTypeText ?? r.acctType,
  }));
}

function mapAccountingPeriodRows(records: RecordLike[]): RecordLike[] {
  return records.map((r) => ({
    Id: r.Id ?? r.internalid,
    StartDate: r.StartDate ?? r.startDate,
    EndDate: r.EndDate ?? r.endDate,
  }));
}

export function executeMockSuiteQL(
  query: string,
  offset: number,
  datasets: Record<string, Record<string, unknown>[]>
): SuiteQLResponse {
  const normalized = query.replace(/\s+/g, " ").trim();
  const isCountOnly = /COUNT\(\*\)\s+AS\s+Count/i.test(normalized);
  const limit = parseTopLimit(normalized);

  if (/FROM\s+Account\s+a/i.test(normalized)) {
    const order = parseOrderBy(normalized);
    let rows = mapAccountRows(datasets.accounts || []);
    if (order) rows = sortByField(rows, order.field, order.direction);

    const totalCount = rows.length;
    const sliced = rows.slice(offset, limit ? offset + limit : undefined);

    if (isCountOnly) {
      return {
        totalCount,
        items: [{ Count: totalCount }],
        hasMore: false,
        offset,
        count: totalCount,
      };
    }

    return {
      totalCount,
      items: sliced,
      hasMore: offset + sliced.length < totalCount,
      offset,
      count: sliced.length,
    };
  }

  if (/FROM\s+AccountingPeriod\s+ap/i.test(normalized)) {
    const order = parseOrderBy(normalized);
    const sourceRows = (datasets.accountingperiod || []).filter(
      (r) => String(r.isQuarter ?? "F") === "F" && String(r.isYear ?? "F") === "F"
    );
    let rows = mapAccountingPeriodRows(sourceRows);
    if (order) rows = sortByField(rows, order.field, order.direction);

    const totalCount = rows.length;
    const sliced = rows.slice(offset, limit ? offset + limit : undefined);

    if (isCountOnly) {
      return {
        totalCount,
        items: [{ Count: totalCount }],
        hasMore: false,
        offset,
        count: totalCount,
      };
    }

    return {
      totalCount,
      items: sliced,
      hasMore: offset + sliced.length < totalCount,
      offset,
      count: sliced.length,
    };
  }

  throw new Error(`Mock SuiteQL router does not recognize query: ${normalized.slice(0, 140)}...`);
}
