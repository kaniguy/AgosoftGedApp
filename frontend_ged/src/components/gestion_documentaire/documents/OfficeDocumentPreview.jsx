// Aperçu local (navigateur, sans service en ligne) des fichiers Word .docx, Excel .xlsx/.xls, CSV et TXT.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PdfPageControls from "./PdfPageControls";
import { cssZoomOf } from "@/utils/appZoom";

const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;
const MAX_TABLE_ROWS = 2000;
const MAX_TABLE_COLS = 100;
const MAX_TEXT_CHARS = 1_000_000;

const SAFE_LINK_PATTERN = /^(https?:|mailto:|#)/i;
const UNSAFE_TAGS = "script, iframe, object, embed, link[rel='import'], meta, base, form";

function decodeText(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(start));
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function detectCsvDelimiter(text) {
  const firstLine = text.slice(0, 5000).split(/\r?\n/, 1)[0] || "";
  const candidates = [";", ",", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const delimiter of candidates) {
    let count = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === delimiter && !quoted) count += 1;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function parseCsv(text, maxRows) {
  const delimiter = detectCsvDelimiter(text);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const pushRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = "";
  };

  while (i < text.length && rows.length < maxRows) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      pushRow();
    } else {
      field += ch;
    }
    i += 1;
  }

  const truncated = i < text.length;
  if (!truncated && (field || row.length)) pushRow();
  return { rows, truncated };
}

function columnLabel(index) {
  let label = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 10 });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  dateStyle: "short",
  timeStyle: "short",
});

function formatCell(value) {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) return value.text;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const hasTime = value.getUTCHours() || value.getUTCMinutes() || value.getUTCSeconds();
    return hasTime ? dateTimeFormatter.format(value) : dateFormatter.format(value);
  }
  if (typeof value === "number") return numberFormatter.format(value);
  if (typeof value === "boolean") return value ? "VRAI" : "FAUX";
  return String(value);
}

/** SheetJS renvoie les dates Excel à minuit heure locale : pas de timeZone forcé ici. */
const sheetDateFormatter = new Intl.DateTimeFormat("fr-FR");
const EXCEL_DEFAULT_DATE_FORMAT = /^m{1,2}\/d{1,2}\/yy(yy)?$/i;

/** Cellule SheetJS → texte affiché : format Excel (%, devises…), nombres « General » et dates par défaut en fr-FR. */
function toSheetCell(cell) {
  if (!cell || cell.v == null) return null;
  const numeric = cell.t === "n";
  const generalFormat = !cell.z || cell.z === "General";
  if (numeric && generalFormat) return { text: numberFormatter.format(cell.v), numeric };
  if (cell.v instanceof Date && (!cell.z || EXCEL_DEFAULT_DATE_FORMAT.test(cell.z))) {
    return { text: sheetDateFormatter.format(cell.v), numeric: false };
  }
  if (cell.w != null) return { text: cell.w, numeric };
  return { text: formatCell(cell.v), numeric };
}

/** Neutralise les liens et éléments actifs éventuellement produits depuis le contenu du .docx. */
function sanitizeRenderedDocx(container) {
  container.querySelectorAll(UNSAFE_TAGS).forEach((el) => el.remove());
  container.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.toLowerCase().startsWith("on")) el.removeAttribute(attr.name);
    }
  });
  container.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!SAFE_LINK_PATTERN.test(href.trim())) {
      a.removeAttribute("href");
      return;
    }
    if (!href.startsWith("#")) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
  });
}

const VML_NS = "urn:schemas-microsoft-com:vml";
const VML_BOX_SHAPES = new Set(["rect", "roundrect", "oval"]);
const DOCX_SHAPE_PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;
const VML_DEFAULT_INSET = ["7.2pt", "3.6pt", "7.2pt", "3.6pt"];

function vmlColor(value, fallback) {
  const color = (value || "").replace(/\s*\[[^\]]*\]\s*$/, "").trim();
  return color || fallback;
}

function vmlIsOff(value) {
  return ["f", "false", "off", "0"].includes((value || "").trim().toLowerCase());
}

function vmlStylePt(style, name) {
  const match = style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([\\d.]+)pt`, "i"));
  return match ? parseFloat(match[1]) : null;
}

/** arcsize VML : fraction du plus petit côté ("10923f" = 10923/65536, ou pourcentage). */
function vmlArcSize(value) {
  const raw = (value || "").trim();
  if (!raw) return 0.2;
  if (raw.endsWith("f")) return parseInt(raw, 10) / 65536;
  if (raw.endsWith("%")) return parseFloat(raw) / 100;
  return parseFloat(raw) || 0.2;
}

/**
 * docx-preview ignore les v:roundrect, les attributs filled/stroked/strokecolor/strokeweight,
 * et remplit les formes en noir par défaut : on ramène les formes VML à ce qu'il sait lire.
 */
function normalizeVmlShape(doc, shape) {
  let el = shape;
  let style = shape.getAttribute("style") || "";
  const extraStyles = [];

  if (shape.localName === "roundrect") {
    el = doc.createElementNS(VML_NS, `${shape.prefix || "v"}:rect`);
    for (const attr of Array.from(shape.attributes)) {
      el.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    }
    while (shape.firstChild) el.appendChild(shape.firstChild);
    shape.replaceWith(el);
    const width = vmlStylePt(style, "width");
    const height = vmlStylePt(style, "height");
    if (width && height) {
      const radius = vmlArcSize(shape.getAttribute("arcsize")) * Math.min(width, height);
      extraStyles.push(`--docx-vml-rx:${radius.toFixed(2)}pt`);
    }
  }

  const anchor = style.match(/v-text-anchor\s*:\s*([a-z-]+)/i)?.[1];
  if (anchor) extraStyles.push(`--docx-vml-anchor:${anchor}`);

  const textbox = Array.from(el.children).find((c) => c.namespaceURI === VML_NS && c.localName === "textbox");
  if (textbox) {
    const parts = (textbox.getAttribute("inset") || "").split(",").map((v) => v.trim());
    const [left, top, right, bottom] = VML_DEFAULT_INSET.map((d, i) => parts[i] || d);
    extraStyles.push(`--docx-vml-inset:${top} ${right} ${bottom} ${left}`);
  }

  el.setAttribute("fillcolor", vmlIsOff(el.getAttribute("filled")) ? "none" : vmlColor(el.getAttribute("fillcolor"), "white"));

  let stroke = Array.from(el.children).find((c) => c.namespaceURI === VML_NS && c.localName === "stroke");
  if (!stroke) {
    stroke = doc.createElementNS(VML_NS, `${el.prefix || "v"}:stroke`);
    el.insertBefore(stroke, el.firstChild);
  }
  if (vmlIsOff(el.getAttribute("stroked")) || vmlIsOff(stroke.getAttribute("on"))) {
    stroke.setAttribute("color", "none");
  } else {
    stroke.setAttribute("color", vmlColor(stroke.getAttribute("color") || el.getAttribute("strokecolor"), "black"));
    if (!stroke.getAttribute("weight")) stroke.setAttribute("weight", el.getAttribute("strokeweight") || "0.75pt");
  }

  if (extraStyles.length) {
    style = style.trim().replace(/;$/, "");
    el.setAttribute("style", [style, ...extraStyles].filter(Boolean).join(";"));
  }
}

function normalizeVmlXml(xml) {
  if (!xml.includes(VML_NS)) return xml;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return xml;
  const shapes = Array.from(doc.getElementsByTagNameNS(VML_NS, "*")).filter((el) =>
    VML_BOX_SHAPES.has(el.localName),
  );
  if (!shapes.length) return xml;
  shapes.forEach((shape) => normalizeVmlShape(doc, shape));
  return new XMLSerializer().serializeToString(doc);
}

async function normalizeDocxShapes(blob) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(blob);
  let changed = false;
  for (const path of Object.keys(zip.files).filter((p) => DOCX_SHAPE_PARTS.test(p))) {
    const xml = await zip.file(path).async("string");
    const normalized = normalizeVmlXml(xml);
    if (normalized !== xml) {
      zip.file(path, normalized);
      changed = true;
    }
  }
  return changed ? zip.generateAsync({ type: "blob" }) : blob;
}

function vmlAnchorJustify(anchor) {
  if (anchor.startsWith("middle")) return "center";
  if (anchor.startsWith("bottom")) return "flex-end";
  return "flex-start";
}

/** docx-preview insère la zone de texte dans le <rect> SVG (donc invisible) : on la ressort et on la met en forme. */
function fixRenderedVmlShapes(container) {
  container.querySelectorAll("section.docx").forEach((section) => {
    // Les formes « derrière le texte » (z-index négatif) doivent rester au-dessus du fond blanc de la page.
    section.style.isolation = "isolate";
  });
  container.querySelectorAll("svg").forEach((svg) => {
    const shape = svg.firstElementChild;
    if (!shape || !["rect", "ellipse"].includes(shape.localName)) return;
    svg.style.overflow = "visible";
    const radius = svg.style.getPropertyValue("--docx-vml-rx").trim();
    if (radius && shape.localName === "rect") {
      shape.setAttribute("rx", radius);
      shape.setAttribute("ry", radius);
    }
    const anchor = svg.style.getPropertyValue("--docx-vml-anchor").trim();
    const inset = svg.style.getPropertyValue("--docx-vml-inset").trim();
    Array.from(shape.children)
      .filter((child) => child.localName === "foreignObject")
      .forEach((foreignObject) => {
        svg.appendChild(foreignObject);
        const box = document.createElement("div");
        box.style.cssText = [
          "box-sizing:border-box",
          "width:100%",
          "height:100%",
          "display:flex",
          "flex-direction:column",
          `justify-content:${vmlAnchorJustify(anchor)}`,
          `padding:${inset || "3.6pt 7.2pt"}`,
          "overflow:hidden",
        ].join(";");
        while (foreignObject.firstChild) box.appendChild(foreignObject.firstChild);
        foreignObject.appendChild(box);
      });
  });
}

const MAX_DOCX_PAGES = 1000;

async function waitForDocxAssets(container) {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(images.map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
  if (document.fonts?.ready) await document.fonts.ready;
}

function nextDocxPage(section) {
  let node = section.nextElementSibling;
  while (node && !(node.tagName === "SECTION" && node.classList.contains("docx"))) {
    node = node.nextElementSibling;
  }
  return node;
}

/**
 * Bas de la zone de contenu, en pixels écran (comme getBoundingClientRect) :
 * hauteur de page − marge basse − débordement éventuel du pied de page.
 */
function docxContentLimit(section) {
  const style = getComputedStyle(section);
  const pageHeight = parseFloat(style.minHeight);
  if (!pageHeight) return null;
  const footer = section.querySelector(":scope > footer");
  let footerIntrusion = 0;
  if (footer) {
    const reserved = parseFloat(getComputedStyle(footer).minHeight) || 0;
    footerIntrusion = Math.max(0, footer.offsetHeight - reserved);
  }
  const contentHeight = pageHeight - (parseFloat(style.paddingBottom) || 0) - footerIntrusion;
  return section.getBoundingClientRect().top + contentHeight * cssZoomOf(section);
}

function createDocxContinuationPage(section, article) {
  const page = section.cloneNode(false);
  const header = section.querySelector(":scope > header");
  const footer = section.querySelector(":scope > footer");
  const newArticle = article.cloneNode(false);
  if (header) page.appendChild(header.cloneNode(true));
  page.appendChild(newArticle);
  if (footer) page.appendChild(footer.cloneNode(true));
  section.after(page);
  return { page, article: newArticle };
}

/** Coupe un tableau entre deux lignes ; renvoie la partie à reporter (null si aucune ligne ne tient). */
function splitDocxTable(table, limit) {
  const rows = Array.from(table.rows);
  const cut = rows.findIndex((row, index) => index > 0 && row.getBoundingClientRect().bottom > limit);
  if (cut <= 0) return null;
  const rest = table.cloneNode(false);
  Array.from(table.children)
    .filter((child) => child.tagName === "COLGROUP")
    .forEach((colgroup) => rest.appendChild(colgroup.cloneNode(true)));
  const body = rows[cut].parentElement.cloneNode(false);
  rest.appendChild(body);
  rows.slice(cut).forEach((row) => body.appendChild(row));
  table.after(rest);
  return rest;
}

/**
 * Le navigateur compose le texte un peu plus haut que Word : un débordement de quelques lignes
 * reste sur la page plutôt que de créer une page presque vide.
 */
const DOCX_OVERFLOW_TOLERANCE = 0.07;

/** Reporte sur une nouvelle page les blocs qui dépassent. Renvoie true si la page a été coupée. */
function splitDocxPage(section, limit) {
  const articles = Array.from(section.querySelectorAll(":scope > article"));
  const lastBlock = articles.at(-1)?.lastElementChild;
  const pageHeight = (parseFloat(getComputedStyle(section).minHeight) || 0) * cssZoomOf(section);
  if (!lastBlock || lastBlock.getBoundingClientRect().bottom - limit <= pageHeight * DOCX_OVERFLOW_TOLERANCE) {
    return false;
  }
  let placed = 0;
  for (let a = 0; a < articles.length; a += 1) {
    const article = articles[a];
    for (const block of Array.from(article.children)) {
      const rect = block.getBoundingClientRect();
      if (rect.height === 0 || rect.bottom <= limit + 0.5) {
        placed += 1;
        continue;
      }
      let moveFrom = block;
      if (block.tagName === "TABLE" && rect.top < limit) {
        moveFrom = splitDocxTable(block, limit) || (placed > 0 ? block : null);
      } else if (placed === 0) {
        moveFrom = null;
      }
      if (!moveFrom) {
        placed += 1;
        continue;
      }
      const { page, article: target } = createDocxContinuationPage(section, article);
      for (let node = moveFrom; node; ) {
        const next = node.nextElementSibling;
        target.appendChild(node);
        node = next;
      }
      const footer = page.querySelector(":scope > footer");
      articles.slice(a + 1).forEach((other) => page.insertBefore(other, footer));
      return true;
    }
  }
  return false;
}

/** docx-preview ne coupe qu'aux sauts de page explicites : on pagine d'après la hauteur réelle des pages. */
function repaginateDocx(container) {
  let section = container.querySelector("section.docx");
  let guard = 0;
  while (section && guard < MAX_DOCX_PAGES) {
    guard += 1;
    const limit = docxContentLimit(section);
    if (limit != null) splitDocxPage(section, limit);
    section = nextDocxPage(section);
  }
  const pages = Array.from(container.querySelectorAll("section.docx"));
  pages.forEach((page) => {
    if (pages.length > 1 && isEmptyDocxPage(page)) page.remove();
  });
}

function isEmptyDocxPage(section) {
  return Array.from(section.querySelectorAll(":scope > article")).every(
    (article) => !article.textContent.trim() && !article.querySelector("img, svg, table, canvas")
  );
}

function SpreadsheetTable({ rows, truncatedRows }) {
  const colCount = useMemo(
    () => Math.min(MAX_TABLE_COLS, rows.reduce((max, row) => Math.max(max, row?.length || 0), 0)),
    [rows]
  );
  const truncatedCols = rows.some((row) => (row?.length || 0) > MAX_TABLE_COLS);

  if (!rows.length || !colCount) {
    return <p className="p-6 text-sm text-slate-400 text-center">Feuille vide</p>;
  }

  return (
    <div className="inline-block min-w-full">
      <table className="border-collapse text-xs text-slate-800 bg-white">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-20 bg-slate-100 border border-slate-300 w-10 min-w-10" />
            {Array.from({ length: colCount }, (_, c) => (
              <th
                key={c}
                className="sticky top-0 z-10 bg-slate-100 border border-slate-300 px-2 py-1 font-medium text-slate-500 min-w-20"
              >
                {columnLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              <th className="sticky left-0 z-10 bg-slate-100 border border-slate-300 px-2 py-1 font-medium text-slate-500 text-right tabular-nums">
                {r + 1}
              </th>
              {Array.from({ length: colCount }, (_, c) => {
                const value = row?.[c];
                const numeric = typeof value === "number" || Boolean(value?.numeric);
                return (
                  <td
                    key={c}
                    className={`border border-slate-200 px-2 py-1 whitespace-pre-wrap align-top max-w-[28rem] ${
                      numeric ? "text-right tabular-nums" : ""
                    }`}
                  >
                    {formatCell(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {(truncatedRows || truncatedCols) && (
        <p className="px-3 py-2 text-[11px] text-amber-700 bg-amber-50 border-t border-amber-200">
          Aperçu limité à {MAX_TABLE_ROWS} lignes et {MAX_TABLE_COLS} colonnes. Téléchargez le fichier
          pour le consulter en entier.
        </p>
      )}
    </div>
  );
}

function DocxView({ blob, zoom, onError }) {
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const [rendering, setRendering] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return undefined;

    const render = async () => {
      setRendering(true);
      setNumPages(0);
      setPage(1);
      try {
        const { renderAsync } = await import("docx-preview");
        const source = await normalizeDocxShapes(blob).catch(() => blob);
        if (cancelled) return;
        container.innerHTML = "";
        await renderAsync(source, container, undefined, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          renderAltChunks: false,
          renderComments: false,
          useBase64URL: true,
          experimental: false,
        });
        if (cancelled) return;
        sanitizeRenderedDocx(container);
        fixRenderedVmlShapes(container);
        await waitForDocxAssets(container);
        if (cancelled) return;
        // Mesures à l'échelle 1 : le zoom d'affichage fausserait la comparaison avec la hauteur de page.
        const zoomWrapper = container.parentElement;
        const previousZoom = zoomWrapper.style.zoom;
        zoomWrapper.style.zoom = "1";
        repaginateDocx(container);
        zoomWrapper.style.zoom = previousZoom;
        setNumPages(container.querySelectorAll("section.docx").length);
      } catch {
        if (!cancelled) onError("Le document Word n'a pas pu être affiché.");
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    render();
    return () => {
      cancelled = true;
      container.innerHTML = "";
    };
  }, [blob, onError]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll("section.docx").forEach((section, index) => {
      section.style.display = index === page - 1 ? "" : "none";
    });
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page, numPages]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {numPages > 0 && (
        <div className="shrink-0 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <PdfPageControls
            pageNumber={page}
            numPages={numPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(numPages, p + 1))}
          />
        </div>
      )}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto relative bg-slate-100">
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 bg-white/70 z-10">
            Mise en page du document…
          </div>
        )}
        <div style={{ zoom }} className="min-h-full">
          <div
            ref={containerRef}
            className="[&_.docx-wrapper]:bg-slate-100 [&_.docx-wrapper]:p-6 [&_section.docx]:shadow-md"
          />
        </div>
      </div>
    </div>
  );
}

function XlsxView({ blob, zoom, onError }) {
  const [sheets, setSheets] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSheets(null);
    setActiveIndex(0);

    const load = async () => {
      try {
        const XLSX = await import("xlsx");
        const buffer = await blob.arrayBuffer();
        if (cancelled) return;
        const workbook = XLSX.read(buffer, {
          type: "array",
          dense: true,
          cellDates: true,
          cellNF: true,
          sheetRows: MAX_TABLE_ROWS + 1,
        });
        const result = workbook.SheetNames.map((name) => ({
          sheet: name,
          data: (workbook.Sheets[name]?.["!data"] || []).map((row) =>
            Array.from(row || [], toSheetCell)
          ),
        }));
        if (!cancelled) setSheets(result);
      } catch {
        if (!cancelled) onError("Le classeur Excel n'a pas pu être lu.");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [blob, onError]);

  if (!sheets) {
    return <p className="p-6 text-sm text-slate-500 text-center">Lecture du classeur…</p>;
  }

  const active = sheets[activeIndex];
  const allRows = active?.data || [];
  const rows = allRows.length > MAX_TABLE_ROWS ? allRows.slice(0, MAX_TABLE_ROWS) : allRows;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto">
        <div style={{ zoom }} className="min-h-full">
          <SpreadsheetTable rows={rows} truncatedRows={allRows.length > MAX_TABLE_ROWS} />
        </div>
      </div>
      <div className="shrink-0 flex items-end gap-0.5 px-2 bg-slate-200 border-t border-slate-300 overflow-x-auto">
        <span className="self-center mr-2 text-[11px] text-slate-500 whitespace-nowrap">
          {sheets.length} feuille{sheets.length > 1 ? "s" : ""}
        </span>
        {sheets.length === 0 && (
          <span className="self-center text-[11px] text-slate-500">Classeur vide</span>
        )}
        {sheets.map((sheet, index) => (
          <button
            key={`${sheet.sheet}-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`px-4 py-1.5 text-xs whitespace-nowrap border-x border-b-2 cursor-pointer ${
              index === activeIndex
                ? "bg-white border-x-slate-300 border-b-emerald-600 text-emerald-700 font-semibold"
                : "bg-slate-100 border-x-transparent border-b-transparent text-slate-600 hover:bg-white"
            }`}
          >
            {sheet.sheet || `Feuille ${index + 1}`}
          </button>
        ))}
      </div>
    </div>
  );
}

function TextualView({ blob, format, zoom, onError }) {
  const [content, setContent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);

    blob
      .arrayBuffer()
      .then((buffer) => {
        if (cancelled) return;
        const text = decodeText(buffer);
        if (format === "csv") {
          const { rows, truncated } = parseCsv(text, MAX_TABLE_ROWS);
          setContent({ rows, truncated });
        } else {
          setContent({
            text: text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text,
            truncated: text.length > MAX_TEXT_CHARS,
          });
        }
      })
      .catch(() => {
        if (!cancelled) onError("Le fichier n'a pas pu être lu.");
      });

    return () => {
      cancelled = true;
    };
  }, [blob, format, onError]);

  if (!content) {
    return <p className="p-6 text-sm text-slate-500 text-center">Lecture du fichier…</p>;
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div style={{ zoom }} className="min-h-full bg-white">
        {format === "csv" ? (
          <SpreadsheetTable rows={content.rows} truncatedRows={content.truncated} />
        ) : (
          <>
            <pre className="p-4 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap break-words font-mono">
              {content.text}
            </pre>
            {content.truncated && (
              <p className="px-3 py-2 text-[11px] text-amber-700 bg-amber-50 border-t border-amber-200">
                Aperçu tronqué. Téléchargez le fichier pour le consulter en entier.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * @param {Blob} blob contenu du fichier
 * @param {"docx"|"xlsx"|"csv"|"text"} format
 * @param {number} zoom facteur d'affichage
 * @param {(message: string) => React.ReactNode} renderFallback affichage si l'aperçu est impossible
 */
export default function OfficeDocumentPreview({ blob, format, zoom = 1, renderFallback }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
  }, [blob, format]);

  const tooLarge = blob?.size > MAX_PREVIEW_BYTES;
  const message = tooLarge ? "Fichier trop volumineux pour l'aperçu." : error;

  if (!blob || message) {
    return renderFallback(message || "Aperçu non disponible pour ce format.");
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      {format === "docx" && <DocxView blob={blob} zoom={zoom} onError={setError} />}
      {format === "xlsx" && <XlsxView blob={blob} zoom={zoom} onError={setError} />}
      {(format === "csv" || format === "text") && (
        <TextualView blob={blob} format={format} zoom={zoom} onError={setError} />
      )}
    </div>
  );
}
