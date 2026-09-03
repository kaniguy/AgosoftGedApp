"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const AGOSOFT_URL = "https://agosoftci.com/";

export default function AProposPage() {
  const router = useRouter();

  useEffect(() => {
    window.open(AGOSOFT_URL, "_blank", "noopener,noreferrer");
    router.replace("/");
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <p className="text-slate-600 text-sm">
        Ouverture de{" "}
        <a
          href={AGOSOFT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 underline"
        >
          agosoftci.com
        </a>{" "}
        dans un nouvel onglet…
      </p>
    </main>
  );
}
