"use client";

import { useEffect, useState } from "react";
import { getTypeDocuments } from "../services/typeDocument.service";

export default function TypeDocumentTable() {
  const [data, setData] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const result = await getTypeDocuments();
    console.log("API RESULT =", result);
    setData(result);
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Types de documents</h1>

      <table className="border w-full mt-4">
        <thead>
          <tr>
            <th className="border p-2">Code</th>
            <th className="border p-2">Libellé</th>
          </tr>
        </thead>

        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td className="border p-2">{item.code}</td>
              <td className="border p-2">{item.libelle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}