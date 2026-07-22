"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TABS = [
  { id: "draw", label: "Dessiner" },
  { id: "type", label: "Type" },
  { id: "upload", label: "Télécharger" },
];

export const SIGNATURE_FONTS = [
  { id: "dancing", label: "Dancing Script", family: '"Dancing Script", cursive' },
  { id: "great-vibes", label: "Great Vibes", family: '"Great Vibes", cursive' },
  { id: "pacifico", label: "Pacifico", family: '"Pacifico", cursive' },
  { id: "satisfy", label: "Satisfy", family: '"Satisfy", cursive' },
  { id: "allura", label: "Allura", family: '"Allura", cursive' },
  { id: "alex-brush", label: "Alex Brush", family: '"Alex Brush", cursive' },
  { id: "sacramento", label: "Sacramento", family: '"Sacramento", cursive' },
  { id: "yellowtail", label: "Yellowtail", family: '"Yellowtail", cursive' },
  { id: "kaushan", label: "Kaushan Script", family: '"Kaushan Script", cursive' },
  { id: "cookie", label: "Cookie", family: '"Cookie", cursive' },
  { id: "courgette", label: "Courgette", family: '"Courgette", cursive' },
  { id: "caveat", label: "Caveat", family: '"Caveat", cursive' },
  { id: "indie-flower", label: "Indie Flower", family: '"Indie Flower", cursive' },
  { id: "shadows", label: "Shadows Into Light", family: '"Shadows Into Light", cursive' },
  { id: "homemade", label: "Homemade Apple", family: '"Homemade Apple", cursive' },
  { id: "marck", label: "Marck Script", family: '"Marck Script", cursive' },
  { id: "pinyon", label: "Pinyon Script", family: '"Pinyon Script", cursive' },
  { id: "tangerine", label: "Tangerine", family: '"Tangerine", cursive' },
  { id: "parisienne", label: "Parisienne", family: '"Parisienne", cursive' },
  { id: "italianno", label: "Italianno", family: '"Italianno", cursive' },
  { id: "ephesis", label: "Ephesis", family: '"Ephesis", cursive' },
  { id: "whisper", label: "Whisper", family: '"Whisper", cursive' },
  { id: "style-script", label: "Style Script", family: '"Style Script", cursive' },
  { id: "meow", label: "Meow Script", family: '"Meow Script", cursive' },
  { id: "moon-dance", label: "Moon Dance", family: '"Moon Dance", cursive' },
  { id: "qwigley", label: "Qwigley", family: '"Qwigley", cursive' },
  { id: "la-belle", label: "La Belle Aurore", family: '"La Belle Aurore", cursive' },
  { id: "nothing", label: "Nothing You Could Do", family: '"Nothing You Could Do", cursive' },
  { id: "reenie", label: "Reenie Beanie", family: '"Reenie Beanie", cursive' },
  { id: "rock-salt", label: "Rock Salt", family: '"Rock Salt", cursive' },
  { id: "covered", label: "Covered By Your Grace", family: '"Covered By Your Grace", cursive' },
  { id: "amatic", label: "Amatic SC", family: '"Amatic SC", cursive' },
  { id: "architects", label: "Architects Daughter", family: '"Architects Daughter", cursive' },
  { id: "birthstone", label: "Birthstone", family: '"Birthstone", cursive' },
  { id: "inspiration", label: "Inspiration", family: '"Inspiration", cursive' },
  { id: "luxurious", label: "Luxurious Script", family: '"Luxurious Script", cursive' },
  { id: "mr-dafoe", label: "Mr Dafoe", family: '"Mr Dafoe", cursive' },
  { id: "rochester", label: "Rochester", family: '"Rochester", cursive' },
  { id: "seaweed", label: "Seaweed Script", family: '"Seaweed Script", cursive' },
  { id: "square-peg", label: "Square Peg", family: '"Square Peg", cursive' },
];

export const SIGNATURE_COLORS = [
  { id: "black", value: "#111827" },
  { id: "blue", value: "#2563EB" },
  { id: "sky", value: "#0EA5E9" },
  { id: "red", value: "#DC2626" },
  { id: "green", value: "#059669" },
  { id: "violet", value: "#7C3AED" },
];

const CANVAS_W = 640;
const CANVAS_H = 220;

const FONT_STYLESHEET_HREFS = [
  "https://fonts.googleapis.com/css2?family=Alex+Brush&family=Allura&family=Amatic+SC:wght@400;700&family=Architects+Daughter&family=Birthstone&family=Caveat:wght@400;600&family=Cookie&family=Courgette&family=Covered+By+Your+Grace&family=Dancing+Script:wght@400;600&family=Ephesis&display=swap",
  "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Homemade+Apple&family=Indie+Flower&family=Inspiration&family=Italianno&family=Kaushan+Script&family=La+Belle+Aurore&family=Luxurious+Script&family=Marck+Script&family=Meow+Script&display=swap",
  "https://fonts.googleapis.com/css2?family=Moon+Dance&family=Mr+Dafoe&family=Nothing+You+Could+Do&family=Pacifico&family=Parisienne&family=Pinyon+Script&family=Qwigley&family=Reenie+Beanie&family=Rochester&family=Rock+Salt&display=swap",
  "https://fonts.googleapis.com/css2?family=Sacramento&family=Satisfy&family=Seaweed+Script&family=Shadows+Into+Light&family=Square+Peg&family=Style+Script&family=Tangerine:wght@400;700&family=Whisper&family=Yellowtail&display=swap",
];

function loadSignatureFonts() {
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

function dataUrlToFile(dataUrl, filename = "signature.png") {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function renderTypedSignature(text, fontFamily, color) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 72;
  ctx.font = `${size}px ${fontFamily}`;
  while (size > 28 && ctx.measureText(text).width > CANVAS_W - 48) {
    size -= 2;
    ctx.font = `${size}px ${fontFamily}`;
  }
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
  return canvas.toDataURL("image/png");
}

function trimCanvas(sourceCanvas) {
  const ctx = sourceCanvas.getContext("2d");
  const { width, height } = sourceCanvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const pad = 8;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width, maxX + pad) - sx;
  const sh = Math.min(height, maxY + pad) - sy;
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  out.getContext("2d").drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL("image/png");
}

/**
 * Modal de création de signature (Dessiner / Type / Télécharger).
 * onCreated({ dataUrl, file }) — image PNG + File pour upload profil.
 */
export default function SignatureCreateModal({
  open,
  onClose,
  onCreated,
  username = "",
  busy = false,
}) {
  const [tab, setTab] = useState("type");
  const [typedText, setTypedText] = useState(username || "");
  const [fontId, setFontId] = useState(SIGNATURE_FONTS[0].id);
  const [color, setColor] = useState(SIGNATURE_COLORS[0].value);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [error, setError] = useState("");
  const [fontsReady, setFontsReady] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const fileInputRef = useRef(null);

  const selectedFont = useMemo(
    () => SIGNATURE_FONTS.find((f) => f.id === fontId) || SIGNATURE_FONTS[0],
    [fontId]
  );

  useEffect(() => {
    if (!open) return undefined;
    setTab("type");
    setTypedText(username || "");
    setFontId(SIGNATURE_FONTS[0].id);
    setColor(SIGNATURE_COLORS[0].value);
    setUploadPreview(null);
    setError("");
    setPassword("");
    setPasswordConfirm("");
    setShowPassword(false);
    setShowPasswordConfirm(false);
    setFontsReady(false);
    loadSignatureFonts().then(() => setFontsReady(true));
    return undefined;
  }, [open, username]);

  const clearDrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (!open || tab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * ratio;
    canvas.height = CANVAS_H * ratio;
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
  }, [open, tab, color]);

  const pointerPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const startDraw = (e) => {
    drawingRef.current = true;
    lastPointRef.current = pointerPos(e);
    canvasRef.current?.setPointerCapture?.(e.pointerId);
  };

  const moveDraw = (e) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const point = pointerPos(e);
    const last = lastPointRef.current;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  };

  const endDraw = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

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

  const buildDataUrl = async () => {
    if (tab === "draw") {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return trimCanvas(canvas);
    }
    if (tab === "type") {
      const text = typedText.trim();
      if (!text) return null;
      await loadSignatureFonts();
      return renderTypedSignature(text, selectedFont.family, color);
    }
    return uploadPreview;
  };

  const handleCreate = async () => {
    setError("");
    if (password || passwordConfirm) {
      if (password.length < 4) {
        setError("Le mot de passe doit contenir au moins 4 caractères.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("Les mots de passe ne correspondent pas.");
        return;
      }
    }
    const dataUrl = await buildDataUrl();
    if (!dataUrl) {
      setError(
        tab === "upload"
          ? "Veuillez télécharger une image de signature."
          : tab === "type"
            ? "Veuillez saisir votre signature."
            : "Veuillez dessiner votre signature."
      );
      return;
    }
    const file = dataUrlToFile(dataUrl);
    onCreated?.({ dataUrl, file, password: password || "" });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Créer une nouvelle signature</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1 disabled:opacity-50"
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
          <div className="relative rounded-lg bg-white border-2 border-dashed border-slate-300 min-h-[220px] flex items-center justify-center overflow-hidden shadow-inner">
            {tab === "draw" && (
              <>
                <canvas
                  ref={canvasRef}
                  className="touch-none cursor-crosshair max-w-full"
                  onPointerDown={startDraw}
                  onPointerMove={moveDraw}
                  onPointerUp={endDraw}
                  onPointerLeave={endDraw}
                />
                <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-slate-400">
                  Dessinez Signature
                </span>
                <button
                  type="button"
                  onClick={clearDrawCanvas}
                  className="absolute bottom-2 right-3 text-xs text-sky-600 hover:underline"
                >
                  Effacer
                </button>
              </>
            )}

            {tab === "type" && (
              <>
                <input
                  type="text"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  disabled={busy}
                  className="w-full bg-transparent text-center outline-none px-4 py-8 placeholder:text-slate-300"
                  style={{
                    fontFamily: selectedFont.family,
                    fontSize: Math.min(64, Math.max(28, 520 / Math.max(1, typedText.length * 0.55))),
                    color,
                    opacity: fontsReady ? 1 : 0.7,
                  }}
                  placeholder="Tapez Signature"
                  autoFocus
                />
                <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-slate-400">
                  Tapez Signature
                </span>
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
              <div className="w-full h-[220px] flex flex-col items-center justify-center gap-3 px-4">
                {uploadPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={uploadPreview}
                    alt="Aperçu signature"
                    className="max-h-[160px] max-w-full object-contain"
                  />
                ) : (
                  <p className="text-sm text-slate-500 text-center">
                    Téléchargez une image de votre signature (PNG ou JPG).
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
                {uploadPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute bottom-2 right-3 text-xs text-sky-600 hover:underline"
                  >
                    Effacer
                  </button>
                )}
              </div>
            )}
          </div>

          {tab === "type" && (
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={fontId}
                onChange={(e) => setFontId(e.target.value)}
                disabled={busy}
                className="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm min-w-[220px] max-w-full text-slate-800"
                style={{ fontFamily: selectedFont.family, fontSize: 18 }}
              >
                {SIGNATURE_FONTS.map((f) => (
                  <option key={f.id} value={f.id} style={{ fontFamily: f.family, fontSize: 16 }}>
                    {f.label} — {typedText.trim() || username || "Aperçu"}
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

          {tab === "draw" && (
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
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-900 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Mot de passe de protection (optionnel)
            </p>
            <p className="text-[11px] text-amber-900/70">
              Si défini, ce mot de passe sera demandé avant de placer la signature sur un document.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  placeholder="Mot de passe"
                  autoComplete="new-password"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-800"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={busy}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 disabled:opacity-40"
                  title={showPassword ? "Masquer" : "Afficher"}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPasswordConfirm ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  disabled={busy}
                  placeholder="Confirmer"
                  autoComplete="new-password"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-800"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={busy}
                  onClick={() => setShowPasswordConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 disabled:opacity-40"
                  title={showPasswordConfirm ? "Masquer" : "Afficher"}
                  aria-label={
                    showPasswordConfirm ? "Masquer la confirmation" : "Afficher la confirmation"
                  }
                >
                  {showPasswordConfirm ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleCreate}
            className="px-5 py-2 text-sm rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export { dataUrlToFile };
