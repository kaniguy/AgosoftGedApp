// app/parametrage/page.jsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParametrageIndex() {
  const router = useRouter();

  useEffect(() => {
    // Rediriger vers type_document par défaut
    router.push('/parametrage/type_document');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
        <p className="mt-4 text-slate-500">Redirection...</p>
      </div>
    </div>
  );
}