"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createDocumentComment,
  deleteDocumentComment,
  listDocumentComments,
  updateDocumentComment,
} from "../../../services/documentComment.service";

function formatCommentDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Panneau Commentaires : fil de discussion hors document (pas affiché sur le PDF).
 */
export default function NotesManagePanel({
  documentId,
  canComment = false,
  onNotify,
}) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const loadComments = useCallback(async () => {
    if (!documentId) {
      setComments([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listDocumentComments(documentId);
      setComments(rows);
    } catch (err) {
      onNotify?.(err.message || "Erreur chargement commentaires", "error");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [documentId, onNotify]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const texte = draft.trim();
    if (!texte || !documentId || !canComment) return;
    setSaving(true);
    try {
      const created = await createDocumentComment(documentId, texte);
      setComments((prev) => [...prev, created]);
      setDraft("");
      onNotify?.("Commentaire ajouté", "success");
    } catch (err) {
      onNotify?.(err.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (comment) => {
    setEditingId(comment.id);
    setEditText(comment.texte || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (commentId) => {
    const texte = editText.trim();
    if (!texte || !documentId) return;
    setSaving(true);
    try {
      const updated = await updateDocumentComment(documentId, commentId, texte);
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      cancelEdit();
      onNotify?.("Commentaire modifié", "success");
    } catch (err) {
      onNotify?.(err.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!documentId) return;
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    setSaving(true);
    try {
      await deleteDocumentComment(documentId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (editingId === commentId) cancelEdit();
      onNotify?.("Commentaire supprimé", "success");
    } catch (err) {
      onNotify?.(err.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!documentId) {
    return (
      <div className="p-4">
        <p className="text-xs text-slate-500">
          Enregistrez le document pour pouvoir y ajouter des commentaires.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs text-slate-500">
          Les commentaires sont visibles dans ce panneau uniquement — ils ne
          s&apos;affichent pas sur le document.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-3 pb-3">
        {loading && <p className="text-xs text-slate-400">Chargement…</p>}
        {!loading && comments.length === 0 && (
          <p className="text-xs text-slate-400 italic">Aucun commentaire pour l&apos;instant.</p>
        )}
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {comment.auteur_nom}
                  {comment.is_mine ? " (vous)" : ""}
                </p>
                <p className="text-[10px] text-slate-400">
                  {formatCommentDate(comment.date_creation)}
                  {comment.date_modification &&
                  comment.date_modification !== comment.date_creation
                    ? " · modifié"
                    : ""}
                </p>
              </div>
              {canComment && comment.is_mine && editingId !== comment.id && (
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(comment)}
                    disabled={saving}
                    className="text-[10px] text-emerald-700 hover:underline disabled:opacity-40"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    disabled={saving}
                    className="text-[10px] text-red-600 hover:underline disabled:opacity-40"
                  >
                    Suppr.
                  </button>
                </div>
              )}
            </div>
            {editingId === comment.id ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-slate-300 px-2 py-1.5 resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  disabled={saving}
                  maxLength={255}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(comment.id)}
                    disabled={saving || !editText.trim()}
                    className="px-2.5 py-1 text-xs font-medium bg-emerald-700 text-white disabled:opacity-40"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:underline"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                {comment.texte}
              </p>
            )}
          </div>
        ))}
      </div>

      {canComment ? (
        <div className="border-t border-slate-200 p-4 space-y-2 shrink-0">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Écrire un commentaire…"
            className="w-full text-sm border border-slate-300 px-2.5 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500"
            disabled={saving}
            maxLength={255}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !draft.trim()}
            className="w-full px-3 py-2 text-sm font-medium bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Envoi…" : "Ajouter le commentaire"}
          </button>
        </div>
      ) : (
        <div className="border-t border-slate-200 p-4">
          <p className="text-xs text-slate-500">
            Vous n&apos;avez pas le droit d&apos;ajouter des commentaires.
          </p>
        </div>
      )}
    </div>
  );
}
