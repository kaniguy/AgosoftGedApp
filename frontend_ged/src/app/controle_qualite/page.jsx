"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDefaultStatutMenu } from "../../utils/controleQualitePermissions";

export default function ControleQualiteIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/controle_qualite/${getDefaultStatutMenu()}`);
  }, [router]);

  return <p className="text-slate-400 py-16 text-center">Redirection…</p>;
}
