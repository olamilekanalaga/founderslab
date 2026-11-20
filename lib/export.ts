import type { DataState } from "./types";
import { reportData, type Filters } from "./selectors";
export function reportRows(s: DataState, filters: Filters, demo: boolean) {
  const r = reportData(s, filters);
  const rows: string[][] = [
    ["Section", "Label", "Value"],
    [
      "Provenance",
      "Source",
      demo || s.fictional
        ? "Fictional demonstration records"
        : "Stored founder applications and manually entered interview records",
    ],
    [
      "Provenance",
      "Scope",
      "Convenience programme sample; not representative of the entire Web3 industry",
    ],
    ["Sample", "Founders", String(r.founders.length)],
    ["Sample", "Companies", String(r.companies.length)],
    ["Sample", "Complete research coverage", String(r.covered)],
    ...Object.entries(filters).map(([key, value]) => [
      "Filter",
      key,
      value || "All",
    ]),
  ];
  for (const [section, values] of Object.entries({
    Countries: r.countries,
    Sectors: r.sectors,
    "Team sizes": r.teams,
    "Product maturity": r.stages,
    "Distribution channels": r.distribution,
    "Business needs": r.businessNeeds,
    "Opportunity pipeline": r.pipeline,
  }))
    values.forEach((v) => rows.push([section, v.name, String(v.value)]));
  Object.entries(r.missing).forEach(([key, value]) =>
    rows.push(["Missing responses", key, String(value)]),
  );
  rows.push(
    ["Signals", "Explicit hiring evidence", String(r.hiring.length)],
    ["Signals", "Integration hypotheses", String(r.integrations.length)],
    ["Signals", "Partnership hypotheses", String(r.partnerships.length)],
  );
  r.companies.forEach((c) =>
    rows.push([
      "Company roster",
      c.name,
      `${c.country}; ${c.sector}; ${c.stage}; ${c.teamSize} people; founders: ${s.memberships
        .filter((m) => m.companyId === c.id)
        .map((m) => s.founders.find((f) => f.id === m.founderId)?.name)
        .join(", ")}`,
    ]),
  );
  return rows;
}
export function csvContent(rows: string[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              (/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}
export function downloadCsv(rows: string[][]) {
  const url = URL.createObjectURL(
    new Blob([csvContent(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "founders-lab-research.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadPdf(rows: string[][]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 22;
  doc.setFontSize(20);
  doc.text("Founders Lab | Research brief", 15, y);
  y += 10;
  doc.setFontSize(10);
  doc.text(
    "Hosted by Ola_Crrypt | " + new Date().toISOString().slice(0, 10),
    15,
    y,
  );
  y += 10;
  for (const row of rows.slice(1)) {
    const text = row.join(" / ").replace(/[–—]/g, "-").replace(/×/g, "x");
    const lines = doc.splitTextToSize(text, 178) as string[];
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 15, y);
      y += 5;
    }
    y += 3;
  }
  doc.save("founders-lab-research.pdf");
}
