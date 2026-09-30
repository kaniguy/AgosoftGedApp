"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getEtatParametrage,
  PARAMETRAGE_DATA_CHANGED_EVENT,
} from "../services/etatParametrage.service";

/** Avancement du paramétrage, rafraîchi à chaque navigation, modification ou retour sur l'onglet. */
export default function useEtatParametrage(pathname) {
  const [etat, setEtat] = useState(null);

  const refresh = useCallback(async () => {
    const next = await getEtatParametrage();
    if (next) setEtat(next);
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(PARAMETRAGE_DATA_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(PARAMETRAGE_DATA_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return etat;
}
