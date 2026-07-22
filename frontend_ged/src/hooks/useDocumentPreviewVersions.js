"use client";

import { useEffect, useMemo, useState } from "react";
import { getDocumentVersions } from "../services/documentLocalite.service";
import { normalizeAnnotations } from "@/utils/pdfAnnotationUtils";

const CURRENT_KEY = "current";

function dedupeArchivedVersions(versions) {
  const seen = new Map();
  versions.forEach((version) => {
    const existing = seen.get(version.version_number);
    if (!existing) {
      seen.set(version.version_number, version);
      return;
    }
    const existingTime = new Date(existing.date_creation || 0).getTime();
    const versionTime = new Date(version.date_creation || 0).getTime();
    if (versionTime > existingTime || (versionTime === existingTime && version.id > existing.id)) {
      seen.set(version.version_number, version);
    }
  });
  return Array.from(seen.values()).sort((a, b) => b.version_number - a.version_number);
}

export function useDocumentPreviewVersions(previewDoc) {
  const [loading, setLoading] = useState(false);
  const [versionCourante, setVersionCourante] = useState(1);
  const [archivedVersions, setArchivedVersions] = useState([]);
  const [selectedKey, setSelectedKey] = useState(CURRENT_KEY);

  useEffect(() => {
    if (!previewDoc?.id) {
      setVersionCourante(1);
      setArchivedVersions([]);
      setSelectedKey(CURRENT_KEY);
      return undefined;
    }

    let cancelled = false;
    const couranteFromDoc = previewDoc.version_courante ?? 1;
    setVersionCourante(couranteFromDoc);
    setSelectedKey(CURRENT_KEY);
    setLoading(true);

    (async () => {
      try {
        const data = await getDocumentVersions(previewDoc.id);
        if (cancelled) return;
        setVersionCourante(data.version_courante ?? couranteFromDoc);
        setArchivedVersions(
          dedupeArchivedVersions(Array.isArray(data.results) ? data.results : [])
        );
      } catch {
        if (!cancelled) {
          setArchivedVersions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewDoc?.id, previewDoc?.version_courante]);

  const previewSource = useMemo(() => {
    if (!previewDoc) return null;

    if (selectedKey === CURRENT_KEY) {
      return {
        previewUrl: previewDoc.fichier_url,
        annotations: normalizeAnnotations(previewDoc.annotations),
        versionLabel: versionCourante,
        isCurrent: true,
        downloadMode: "current",
      };
    }

    const archivedId = Number(String(selectedKey).replace("archived:", ""));
    const archived = archivedVersions.find((v) => v.id === archivedId);
    if (!archived) {
      return {
        previewUrl: previewDoc.fichier_url,
        annotations: normalizeAnnotations(previewDoc.annotations),
        versionLabel: versionCourante,
        isCurrent: true,
        downloadMode: "current",
      };
    }

    return {
      previewUrl: archived.fichier_url,
      annotations: normalizeAnnotations(archived.annotations),
      versionLabel: archived.version_number,
      isCurrent: false,
      downloadMode: "archived",
      archivedVersionId: archived.id,
    };
  }, [previewDoc, selectedKey, archivedVersions, versionCourante]);

  const versionOptions = useMemo(() => {
    const options = [
      {
        key: CURRENT_KEY,
        versionNumber: versionCourante,
        label: `v${versionCourante} — courante`,
      },
    ];
    archivedVersions.forEach((v) => {
      options.push({
        key: `archived:${v.id}`,
        versionNumber: v.version_number,
        label: `v${v.version_number} — archivée`,
      });
    });
    return options.sort((a, b) => b.versionNumber - a.versionNumber);
  }, [archivedVersions, versionCourante]);

  return {
    loading,
    versionCourante,
    selectedKey,
    setSelectedKey,
    versionOptions,
    previewSource,
    showVersionSelect: Boolean(previewDoc),
  };
}
