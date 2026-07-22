"use client";

import { formatChampValue } from "../../../utils/dateFormat";
import { isHttpUrl } from "../../../utils/qrLink";
import QrLinkCell from "./QrLinkCell";

/**
 * Affiche une valeur de champ métier : lien + aperçu si la valeur est une URL, sinon formatage selon le type.
 */
export default function ChampCellValue({ value, typeChamp, className = "" }) {
  if (isHttpUrl(value)) {
    return <QrLinkCell value={value} className={className} />;
  }

  return (
    <span className={`break-words text-gray-800 ${className}`.trim()}>
      {formatChampValue(value, typeChamp)}
    </span>
  );
}
