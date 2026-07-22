export const STATUT_COLORS = {
  brouillon: "#94a3b8",
  en_attente: "#f59e0b",
  valide: "#10b981",
  rejete: "#f43f5e",
};

const CHART_PALETTE = [
  "#6366f1", "#8b5cf6", "#f59e0b", "#10b981", "#06b6d4",
  "#3b82f6", "#ec4899", "#ea580c", "#14b8a6", "#a855f7",
];

/** Génère et télécharge un rapport HTML autonome avec graphiques intégrés. */
export function downloadAnalytiqueReport({
  title = "Rapport analytique",
  subtitle = "",
  filtersLabel = "",
  sections = [],
}) {
  const generatedAt = new Date().toLocaleString("fr-FR");
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `rapport-${slug}-${new Date().toISOString().slice(0, 10)}.html`;

  const sectionsHtml = sections.map(renderSection).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — ${generatedAt}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Segoe UI, Arial, sans-serif; color: #1e293b; margin: 2rem; line-height: 1.5; }
    header { border-bottom: 3px solid #ea580c; padding-bottom: 1rem; margin-bottom: 2rem; }
    h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
    .meta { color: #64748b; font-size: 0.875rem; }
    section { margin-bottom: 2rem; page-break-inside: avoid; }
    h2 { font-size: 1rem; color: #ea580c; margin: 0 0 0.75rem; border-bottom: 1px solid #fed7aa; padding-bottom: 0.25rem; }
    .sub { font-size: 0.8rem; color: #64748b; margin: -0.5rem 0 0.75rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f8fafc; font-weight: 600; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
    footer { margin-top: 2rem; font-size: 0.75rem; color: #94a3b8; text-align: center; }
    .chart-empty { color: #94a3b8; font-size: 0.875rem; padding: 1.5rem; text-align: center; background: #f8fafc; border-radius: 8px; }
    .chart-donut-wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 2rem; }
    .chart-donut { width: 180px; height: 180px; border-radius: 50%; position: relative; flex-shrink: 0; }
    .chart-donut-hole { position: absolute; inset: 28%; background: #fff; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.75rem; color: #64748b; }
    .chart-donut-hole strong { font-size: 1.25rem; color: #1e293b; }
    .chart-legend { flex: 1; min-width: 200px; }
    .legend-item { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; font-size: 0.875rem; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .hbar-row { display: grid; grid-template-columns: minmax(80px, 28%) 1fr auto; gap: 0.75rem; align-items: center; margin-bottom: 0.5rem; font-size: 0.875rem; }
    .hbar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hbar-track { height: 14px; background: #f1f5f9; border-radius: 7px; overflow: hidden; }
    .hbar-fill { height: 100%; border-radius: 7px; min-width: 2px; }
    .hbar-value { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; color: #475569; }
    .bar-extra { font-weight: 400; color: #94a3b8; font-size: 0.8rem; }
    .vbar-chart { display: flex; align-items: flex-end; justify-content: center; gap: 1rem; height: 200px; padding-top: 1rem; border-bottom: 1px solid #e2e8f0; }
    .vbar-col { display: flex; flex-direction: column; align-items: center; flex: 1; max-width: 80px; }
    .vbar-value { font-size: 0.75rem; font-weight: 600; margin-bottom: 0.25rem; color: #475569; }
    .vbar { width: 100%; max-width: 48px; border-radius: 4px 4px 0 0; min-height: 4px; }
    .vbar-label { font-size: 0.7rem; color: #64748b; margin-top: 0.35rem; text-align: center; word-break: break-word; }
    .stack-row { display: grid; grid-template-columns: 72px 1fr 36px; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; font-size: 0.8rem; }
    .stack-label { color: #64748b; }
    .stack-bar { display: flex; height: 16px; border-radius: 4px; overflow: hidden; background: #f1f5f9; }
    .stack-seg { height: 100%; min-width: 1px; }
    .stack-total { font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
    .stack-legend { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.75rem; font-size: 0.75rem; color: #64748b; }
    .stack-legend span { display: inline-flex; align-items: center; gap: 0.25rem; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="meta">${escapeHtml(subtitle)}</p>` : ""}
    <p class="meta">Généré le ${generatedAt}${filtersLabel ? ` · Filtres : ${escapeHtml(filtersLabel)}` : ""}</p>
  </header>
  ${sectionsHtml}
  <footer>AGOSOFT GED — Rapport analytique</footer>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderSection(section) {
  if (section.type === "kpis") return renderKpisSection(section);
  if (section.type === "table") return renderTableSection(section);
  if (section.type === "chart") return renderChartSection(section);
  return "";
}

function renderKpisSection(section) {
  const rows = (section.items ?? [])
    .map(
      (item) => `
          <tr>
            <td>${escapeHtml(item.label)}</td>
            <td class="num">${item.count ?? "—"}</td>
            <td class="num">${item.taux != null ? `${item.taux} %` : "—"}</td>
          </tr>`
    )
    .join("");
  return `
        <section>
          <h2>${escapeHtml(section.title)}</h2>
          <table>
            <thead><tr><th>Indicateur</th><th>Nombre</th><th>Part</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`;
}

function renderTableSection(section) {
  const head = (section.columns ?? [])
    .map((col) => `<th>${escapeHtml(col)}</th>`)
    .join("");
  const rows = (section.rows ?? [])
    .map((row) => {
      const cells = row
        .map((cell, i) => {
          const isNum =
            i > 0 &&
            (typeof cell === "number" || (typeof cell === "string" && /^\d+([.,]\d+)?\s*%?$/.test(cell)));
          const cls = isNum ? ' class="num"' : "";
          return `<td${cls}>${escapeHtml(String(cell ?? "—"))}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `
        <section>
          <h2>${escapeHtml(section.title)}</h2>
          ${section.subtitle ? `<p class="sub">${escapeHtml(section.subtitle)}</p>` : ""}
          <table>
            <thead><tr>${head}</tr></thead>
            <tbody>${rows || '<tr><td colspan="99">Aucune donnée</td></tr>'}</tbody>
          </table>
        </section>`;
}

function renderChartSection(section) {
  const chart = section.chart || "hbars";
  if (chart === "donut") return renderDonutChart(section);
  if (chart === "bars") return renderVerticalBars(section);
  if (chart === "stacked") return renderStackedBars(section);
  return renderHorizontalBars(section);
}

function renderDonutChart(section) {
  const items = (section.items ?? []).filter((i) => (i.value ?? 0) > 0);
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!items.length) return renderEmptySection(section);

  let angle = 0;
  const stops = items.map((item) => {
    const pct = total > 0 ? (item.value / total) * 100 : 0;
    const start = angle;
    angle += pct;
    return `${item.color || "#6366f1"} ${start}% ${angle}%`;
  });

  const legend = items
    .map((item) => {
      const pct = total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0;
      return `<div class="legend-item"><span class="dot" style="background:${item.color || "#6366f1"}"></span>${escapeHtml(item.label)} — ${item.value} (${pct} %)</div>`;
    })
    .join("");

  return `
        <section>
          <h2>${escapeHtml(section.title)}</h2>
          ${section.subtitle ? `<p class="sub">${escapeHtml(section.subtitle)}</p>` : ""}
          <div class="chart-donut-wrap">
            <div class="chart-donut" style="background:conic-gradient(${stops.join(", ")})">
              <div class="chart-donut-hole"><strong>${total}</strong><span>total</span></div>
            </div>
            <div class="chart-legend">${legend}</div>
          </div>
        </section>`;
}

function renderHorizontalBars(section) {
  const items = section.items ?? [];
  if (!items.length) return renderEmptySection(section);

  const max = Math.max(...items.map((i) => i.value ?? 0), 1);
  const rows = items
    .map((item, index) => {
      const value = item.value ?? 0;
      const pct = Math.round((value / max) * 100);
      const color = item.color || CHART_PALETTE[index % CHART_PALETTE.length];
      const extra = item.extra ? `<span class="bar-extra">${escapeHtml(item.extra)}</span>` : "";
      return `
            <div class="hbar-row">
              <div class="hbar-label">${escapeHtml(item.label)}</div>
              <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${color}"></div></div>
              <div class="hbar-value">${value}${extra}</div>
            </div>`;
    })
    .join("");

  return `
        <section>
          <h2>${escapeHtml(section.title)}</h2>
          ${section.subtitle ? `<p class="sub">${escapeHtml(section.subtitle)}</p>` : ""}
          ${rows}
        </section>`;
}

function renderVerticalBars(section) {
  const items = section.items ?? [];
  if (!items.length) return renderEmptySection(section);

  const max = Math.max(...items.map((i) => i.value ?? 0), 1);
  const barMaxHeight = 140;
  const cols = items
    .map((item, index) => {
      const value = item.value ?? 0;
      const h = Math.max(4, Math.round((value / max) * barMaxHeight));
      const color = item.color || CHART_PALETTE[index % CHART_PALETTE.length];
      return `
            <div class="vbar-col">
              <div class="vbar-value">${value}</div>
              <div class="vbar" style="height:${h}px;background:${color}"></div>
              <div class="vbar-label">${escapeHtml(item.label)}</div>
            </div>`;
    })
    .join("");

  return `
        <section>
          <h2>${escapeHtml(section.title)}</h2>
          ${section.subtitle ? `<p class="sub">${escapeHtml(section.subtitle)}</p>` : ""}
          <div class="vbar-chart">${cols}</div>
        </section>`;
}

function renderStackedBars(section) {
  const rows = section.rows ?? [];
  const series = section.series ?? [];
  if (!rows.length || !series.length) return renderEmptySection(section);

  const stackRows = rows
    .map((row) => {
      const total = series.reduce((s, ser) => s + (row.values?.[ser.key] ?? 0), 0);
      const segments =
        total > 0
          ? series
              .map((ser) => {
                const val = row.values?.[ser.key] ?? 0;
                if (val <= 0) return "";
                const pct = (val / total) * 100;
                return `<div class="stack-seg" style="width:${pct}%;background:${ser.color}" title="${escapeHtml(ser.label)}: ${val}"></div>`;
              })
              .join("")
          : "";
      return `
            <div class="stack-row">
              <div class="stack-label">${escapeHtml(row.label)}</div>
              <div class="stack-bar">${segments || '<div class="stack-seg" style="width:100%"></div>'}</div>
              <div class="stack-total">${total}</div>
            </div>`;
    })
    .join("");

  const legend = series
    .map(
      (ser) =>
        `<span><span class="dot" style="background:${ser.color}"></span>${escapeHtml(ser.label)}</span>`
    )
    .join("");

  return `
        <section>
          <h2>${escapeHtml(section.title)}</h2>
          ${section.subtitle ? `<p class="sub">${escapeHtml(section.subtitle)}</p>` : ""}
          ${stackRows}
          <div class="stack-legend">${legend}</div>
        </section>`;
}

function renderEmptySection(section) {
  return `
        <section>
          <h2>${escapeHtml(section.title)}</h2>
          <div class="chart-empty">Aucune donnée disponible</div>
        </section>`;
}

export function printAnalytiqueReport(title = "Rapport analytique") {
  const previousTitle = document.title;
  document.title = `${title} — ${new Date().toLocaleDateString("fr-FR")}`;
  window.print();
  document.title = previousTitle;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Libellé lisible des filtres actifs pour le rapport. */
export function buildFiltersLabel(filters, meta = {}) {
  const parts = [];
  const periodeLabels = {
    "7": "7 jours",
    "30": "30 jours",
    "90": "90 jours",
    "180": "6 mois",
    "365": "12 mois",
    all: "Toute la période",
  };
  if (filters.periode && filters.periode !== "365") {
    parts.push(`Période : ${periodeLabels[filters.periode] || filters.periode}`);
  }
  if (filters.statut) {
    const label = meta.statuts?.find((s) => s.value === filters.statut)?.label || filters.statut;
    parts.push(`Statut : ${label}`);
  }
  if (filters.type_document) {
    const label =
      meta.types?.find((t) => String(t.id) === filters.type_document)?.libelle || filters.type_document;
    parts.push(`Type : ${label}`);
  }
  if (filters.localite) {
    const label =
      meta.localites?.find((l) => String(l.id) === filters.localite)?.libelle || filters.localite;
    parts.push(`Zone : ${label}`);
  }
  return parts.length ? parts.join(" · ") : "Aucun filtre actif";
}

export function formatMoisReport(str) {
  if (!str) return "";
  const [year, month] = str.split("-");
  const names = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${names[parseInt(month, 10) - 1]} ${year}`;
}
