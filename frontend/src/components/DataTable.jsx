import { useMemo, useState } from "react";
import { Empty } from "./states.jsx";

/**
 * Reusable sortable + paginated table.
 *
 * columns: [{ key, header, render?(row), sortValue?(row), align?, sortable? }]
 * rows:    array of objects
 * onRowClick?(row) makes rows clickable.
 */
export default function DataTable({
  columns,
  rows,
  onRowClick,
  pageSize = 10,
  emptyTitle = "No records",
  emptyHint,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    const val = col?.sortValue || ((r) => r[sortKey]);
    const out = [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), undefined, { numeric: true });
    });
    return sortDir === "asc" ? out : out.reverse();
  }, [rows, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = sorted.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (col) => {
    if (col.sortable === false) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
    setPage(1);
  };

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${c.align === "right" ? "num" : ""} ${c.sortable === false ? "" : "sortable"}`}
                onClick={() => toggleSort(c)}
              >
                {c.header}
                {sortKey === c.key && <span className="sort-arrow">{sortDir === "asc" ? " ▲" : " ▼"}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 && (
            <tr>
              <td className="placeholder" colSpan={columns.length}>
                <Empty title={emptyTitle} hint={emptyHint} />
              </td>
            </tr>
          )}
          {pageRows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "clickable" : ""}
            >
              {columns.map((c) => (
                <td key={c.key} className={c.align === "right" ? "num" : ""}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {sorted.length > pageSize && (
        <div className="pager">
          <span className="pager-info">
            {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="pager-btns">
            <button className="btn ghost sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              Prev
            </button>
            <span className="pager-page">Page {current} / {pageCount}</span>
            <button className="btn ghost sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
