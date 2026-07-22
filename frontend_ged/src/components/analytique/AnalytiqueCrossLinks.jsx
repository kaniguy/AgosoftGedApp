"use client";

import Link from "next/link";
import { useAnalytiqueFilters } from "../../hooks/useAnalytiqueFilters";

export default function AnalytiqueCrossLinks({ links = [] }) {
  const { buildUrl } = useAnalytiqueFilters();

  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {links.map((link) => (
        <Link
          key={link.href + link.label}
          href={buildUrl(link.href, link.filters ?? {})}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 text-xs font-medium hover:bg-orange-100 transition-colors"
        >
          {link.label}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ))}
    </div>
  );
}
