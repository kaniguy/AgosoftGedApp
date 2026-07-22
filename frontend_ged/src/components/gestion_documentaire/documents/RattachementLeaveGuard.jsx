"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import LeaveRattachementModal from "./LeaveRattachementModal";

const RattachementLeaveGuardContext = createContext(null);

function normalizePath(path) {
  if (!path) return "";
  try {
    const url = path.startsWith("http") ? new URL(path) : new URL(path, window.location.origin);
    return url.pathname.replace(/\/$/, "") || "/";
  } catch {
    return path.split("?")[0].replace(/\/$/, "") || "/";
  }
}

export function RattachementLeaveGuardProvider({ children, currentPath }) {
  const router = useRouter();
  const guardApiRef = useRef(null);
  const [hasWork, setHasWork] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingActionRef = useRef(null);
  const allowLeaveRef = useRef(false);

  const runPendingNavigation = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setModalOpen(false);
    if (action) action();
  }, []);

  const requestNavigation = useCallback((action) => {
    if (!action) return;
    const workInProgress = Boolean(guardApiRef.current?.hasWorkInProgress);
    if (!workInProgress || allowLeaveRef.current) {
      action();
      return;
    }
    pendingActionRef.current = action;
    setModalOpen(true);
  }, []);

  const navigateToHref = useCallback(
    (href) => {
      const path = normalizePath(href);
      const current = normalizePath(currentPath);
      if (path === current) return;
      requestNavigation(() => {
        allowLeaveRef.current = true;
        if (href.startsWith("http")) {
          window.location.href = href;
        } else {
          router.push(href);
        }
      });
    },
    [currentPath, requestNavigation, router]
  );

  const registerGuard = useCallback((api) => {
    guardApiRef.current = api;
    const nextHasWork = Boolean(api?.hasWorkInProgress);
    setHasWork((prev) => (prev === nextHasWork ? prev : nextHasWork));
  }, []);

  useEffect(() => {
    allowLeaveRef.current = false;
  }, [currentPath]);

  useEffect(() => {
    if (!hasWork) return undefined;

    const handleClick = (event) => {
      if (allowLeaveRef.current || modalOpen) return;

      const anchor = event.target.closest("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      const targetPath = normalizePath(href);
      const current = normalizePath(currentPath);
      if (targetPath === current) return;

      event.preventDefault();
      event.stopPropagation();
      navigateToHref(href);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [hasWork, modalOpen, currentPath, navigateToHref]);

  useEffect(() => {
    if (!hasWork) return undefined;

    const handleBeforeUnload = (event) => {
      if (allowLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasWork]);

  const handleSaveDraft = async () => {
    if (!guardApiRef.current?.persistNow) return;
    setBusy(true);
    try {
      allowLeaveRef.current = true;
      await guardApiRef.current.persistNow();
      runPendingNavigation();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!guardApiRef.current?.clearDraft) return;
    setBusy(true);
    try {
      allowLeaveRef.current = true;
      await guardApiRef.current.clearDraft();
      runPendingNavigation();
    } finally {
      setBusy(false);
    }
  };

  const handleContinueEditing = () => {
    pendingActionRef.current = null;
    setModalOpen(false);
  };

  const value = useMemo(
    () => ({
      requestNavigation,
      navigateToHref,
      registerGuard,
      hasWorkInProgress: hasWork,
    }),
    [requestNavigation, navigateToHref, registerGuard, hasWork]
  );

  return (
    <RattachementLeaveGuardContext.Provider value={value}>
      {children}
      <LeaveRattachementModal
        open={modalOpen}
        busy={busy}
        onSaveDraft={handleSaveDraft}
        onDeleteDraft={handleDeleteDraft}
        onContinueEditing={handleContinueEditing}
      />
    </RattachementLeaveGuardContext.Provider>
  );
}

export function useRattachementLeaveGuard() {
  const ctx = useContext(RattachementLeaveGuardContext);
  if (!ctx) {
    throw new Error("useRattachementLeaveGuard must be used within RattachementLeaveGuardProvider");
  }
  return ctx;
}

export function useRattachementLeaveGuardOptional() {
  return useContext(RattachementLeaveGuardContext);
}
