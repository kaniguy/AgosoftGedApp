// Redirection legacy — les documents sont sur la page statut (casiers dépliables)
"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { isControleQualiteStatut } from "../../../../constants/controleQualiteMenu";
import { getDefaultStatutMenu } from "../../../../utils/controleQualitePermissions";

function BucketRedirectContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const localiteId = params?.localiteId;
  const statutParam = searchParams.get("statut");
  const statut = isControleQualiteStatut(statutParam) ? statutParam : getDefaultStatutMenu();

  useEffect(() => {
    const qs = localiteId ? `?casier=${localiteId}` : "";
    router.replace(`/controle_qualite/${statut}${qs}`);
  }, [router, statut, localiteId]);

  return <p className="text-slate-400 py-16 text-center">Redirection…</p>;
}

export default function ControleQualiteBucketPage() {
  return (
    <Suspense fallback={<p className="text-slate-400 py-16 text-center">Chargement…</p>}>
      <BucketRedirectContent />
    </Suspense>
  );
}
