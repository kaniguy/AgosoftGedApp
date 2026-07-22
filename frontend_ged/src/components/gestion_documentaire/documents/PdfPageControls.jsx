// Boutons de navigation entre les pages d'un PDF (Préc. / Suiv.)
"use client";

export default function PdfPageControls({ pageNumber, numPages, onPrev, onNext }) {
  if (numPages == null) return null;

  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <button
        type="button"
        onClick={onPrev}
        disabled={pageNumber <= 1}
        className="px-2.5 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
      >
        Préc.
      </button>
      <span className="text-gray-600 tabular-nums font-medium min-w-[4rem] text-center">
        {pageNumber} / {numPages}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={pageNumber >= numPages}
        className="px-2.5 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
      >
        Suiv.
      </button>
    </div>
  );
}
