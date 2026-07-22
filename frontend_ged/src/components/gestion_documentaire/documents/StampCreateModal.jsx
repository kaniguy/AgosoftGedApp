"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SIGNATURE_FONTS, SIGNATURE_COLORS } from "./SignatureCreateModal";

const TABS = [
  { id: "type", label: "Type" },
  { id: "upload", label: "Télécharger" },
];

const CANVAS_W = 640;
const CANVAS_H = 180;

const FONT_STYLESHEET_HREFS = [
  "https://fonts.googleapis.com/css2?family=Alex+Brush&family=Allura&family=Amatic+SC:wght@400;700&family=Architects+Daughter&family=Birthstone&family=Caveat:wght@400;600&family=Cookie&family=Courgette&family=Covered+By+Your+Grace&family=Dancing+Script:wght@400;600&family=Ephesis&display=swap",
  "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Homemade+Apple&family=Indie+Flower&family=Inspiration&family=Italianno&family=Kaushan+Script&family=La+Belle+Aurore&family=Luxurious+Script&family=Marck+Script&family=Meow+Script&display=swap",
  "https://fonts.googleapis.com/css2?family=Moon+Dance&family=Mr+Dafoe&family=Nothing+You+Could+Do&family=Pacifico&family=Parisienne&family=Pinyon+Script&family=Qwigley&family=Reenie+Beanie&family=Rochester&family=Rock+Salt&display=swap",
  "https://fonts.googleapis.com/css2?family=Sacramento&family=Satisfy&family=Seaweed+Script&family=Shadows+Into+Light&family=Square+Peg&family=Style+Script&family=Tangerine:wght@400;700&family=Whisper&family=Yellowtail&display=swap",
];

function loadStampFonts() {
  if (typeof document === "undefined") return Promise.resolve();
  FONT_STYLESHEET_HREFS.forEach((href) => {
    if (!document.querySelector(`link[data-sig-fonts="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute("data-sig-fonts", href);
      document.head.appendChild(link);
    }
  });
  return document.fonts?.ready ?? Promise.resolve();
}

function dataUrlToFile(dataUrl, filename = "tampon.png") {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function renderTypedStamp(text, fontFamily, color) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, CANVAS_W - 32, CANVAS_H - 32);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 48;
  ctx.font = `700 ${size}px ${fontFamily}`;
  while (size > 18 && ctx.measureText(text).width > CANVAS_W - 64) {
    size -= 2;
    ctx.font = `700 ${size}px ${fontFamily}`;
  }
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
  return canvas.toDataURL("image/png");
}

/**
 * Modal tampon personnalisé : Type (polices) ou Upload — pas de dessin.
 */
export default function StampCreateModal({ open, onClose, onCreated, busy = false }) {
  const [tab, setTab] = useState("type");
  const [typedText, setTypedText] = useState("APPROUVÉ");
  const [fontId, setFontId] = useState(SIGNATURE_FONTS[0].id);
  const [color, setColor] = useState(SIGNATURE_COLORS[0].value);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [error, setError] = useState("");
  const [fontsReady, setFontsReady] = useState(false);
  const fileInputRef = useRef(null);

  const selectedFont = useMemo(
    () => SIGNATURE_FONTS.find((f) => f.id === fontId) || SIGNATURE_FONTS[0],
    [fontId]
  );

  useEffect(() => {
    if (!open) return undefined;
    setTab("type");
    setTypedText("APPROUVÉ");
    setFontId(SIGNATURE_FONTS[0].id);
    setColor(SIGNATURE_COLORS[0].value);
    setUploadPreview(null);
    setError("");
    setFontsReady(false);
    loadStampFonts().then(() => setFontsReady(true));
    return undefined;
  }, [open]);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image (PNG, JPG…).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 2 Mo.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 800;
        const scale = Math.min(1, maxW / Math.max(1, img.width));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setUploadPreview(canvas.toDataURL("image/png"));
      };
      img.onerror = () => setError("Impossible de lire cette image.");
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    setError("");
    let dataUrl = null;
    let label = "Tampon";
    if (tab === "type") {
      const text = typedText.trim();
      if (!text) {
        setError("Veuillez saisir le texte du tampon.");
        return;
      }
      await loadStampFonts();
      dataUrl = renderTypedStamp(text, selectedFont.family, color);
      label = text;
    } else {
      if (!uploadPreview) {
        setError("Veuillez télécharger une image de tampon.");
        return;
      }
      dataUrl = uploadPreview;
      label = "Tampon image";
    }
    onCreated?.({ dataUrl, file: dataUrlToFile(dataUrl), label, text: label });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Créer un tampon personnalisé</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-5 pt-3 flex gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              disabled={busy}
              className={`px-4 py-2 text-sm rounded-t-md transition ${
                tab === t.id
                  ? "bg-sky-50 text-sky-700 border-b-2 border-sky-500 font-medium"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          <div className="relative rounded-lg bg-white border-2 border-dashed border-slate-300 min-h-[180px] flex items-center justify-center overflow-hidden">
            {tab === "type" && (
              <>
                <input
                  type="text"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  disabled={busy}
                  className="w-full bg-transparent text-center outline-none px-4 py-8 uppercase tracking-wide"
                  style={{
                    fontFamily: selectedFont.family,
                    fontSize: Math.min(48, Math.max(22, 480 / Math.max(1, typedText.length * 0.5))),
                    color,
                    opacity: fontsReady ? 1 : 0.7,
                    fontWeight: 700,
                  }}
                  placeholder="Texte du tampon"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setTypedText("")}
                  className="absolute bottom-2 right-3 text-xs text-sky-600 hover:underline"
                >
                  Effacer
                </button>
              </>
            )}
            {tab === "upload" && (
              <div className="w-full h-[180px] flex flex-col items-center justify-center gap-3 px-4">
                {uploadPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={uploadPreview} alt="Aperçu tampon" className="max-h-[120px] max-w-full object-contain" />
                ) : (
                  <p className="text-sm text-slate-500 text-center">
                    Téléchargez une image de tampon (PNG ou JPG).
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleUpload}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  {uploadPreview ? "Changer l'image" : "Choisir un fichier"}
                </button>
              </div>
            )}
          </div>

          {tab === "type" && (
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={fontId}
                onChange={(e) => setFontId(e.target.value)}
                disabled={busy}
                className="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm min-w-[220px]"
                style={{ fontFamily: selectedFont.family, fontSize: 16 }}
              >
                {SIGNATURE_FONTS.map((f) => (
                  <option key={f.id} value={f.id} style={{ fontFamily: f.family }}>
                    {f.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                {SIGNATURE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.id}
                    onClick={() => setColor(c.value)}
                    disabled={busy}
                    className={`w-7 h-7 rounded-full border-2 transition ${
                      color === c.value ? "border-slate-800 scale-110" : "border-slate-200"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-white"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleCreate}
            className="px-5 py-2 text-sm rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}
