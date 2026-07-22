"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GestionAccesIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/gestion_acces/utilisateurs");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
