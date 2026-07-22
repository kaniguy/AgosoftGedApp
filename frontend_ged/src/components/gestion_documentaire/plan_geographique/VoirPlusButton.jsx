"use client";

function VoirPlusButton({ onClick, loading, loaded, total }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mt-2 ml-8 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-blue-200 transition disabled:opacity-50"
    >
      {loading
        ? "Chargement..."
        : `Voir plus (${loaded} / ${total})`}
    </button>
  );
}

export default VoirPlusButton;
