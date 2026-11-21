import type { DataState } from "./types";
import { reportData, type Filters } from "./selectors";
export function reportRows(s: DataState, filters: Filters, demo: boolean) {
  const r = reportData(s, filters);
  return [
    ["Section", "Label", "Value"],
    [
      "Source",
      "Dataset",
      demo || s.fictional
        ? "Fictional demonstration records"
        : "Founder applications and manually entered records",
    ],
    [
      "Scope",
      "Coverage",
      "Programme participants; not representative of the entire Web3 industry",
    ],
    ["Count", "Founders", String(r.founders.length)],
    ["Count", "Companies", String(r.companies.length)],
    ["Count", "Countries", String(r.countries.length)],
    ...r.countries.map((c) => ["Country", c.name, String(c.value)]),
    ["Founder", "Company", "Country", "Short description"],
    ...r.founders.map((f) => {
      const companies = s.memberships
        .filter((m) => m.founderId === f.id)
        .map((m) => s.companies.find((c) => c.id === m.companyId))
        .filter((c) => !!c);
      return [
        f.name,
        companies.map((c) => c.name).join(", "),
        f.country,
        companies
          .map((c) => c.description)
          .filter(Boolean)
          .join(" · "),
      ];
    }),
  ];
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
  a.download = "founders-lab-records.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadPdf(rows: string[][]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 22;
  doc.setFontSize(20);
  doc.text("Founders Lab | Founder records", 15, y);
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
  doc.save("founders-lab-records.pdf");
}
