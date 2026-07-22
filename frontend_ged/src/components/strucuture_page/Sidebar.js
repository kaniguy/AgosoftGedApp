"use client";

export default function Sidebar({ open }) {
  if (!open) return null;

  return (
    <div className="w-64 bg-white shadow h-screen p-4 fixed left-0 top-16">
      <ul className="space-y-3">
        <li className="hover:text-blue-500 cursor-pointer">Type Documents</li>
        <li className="hover:text-blue-500 cursor-pointer">Utilisateurs</li>
        <li className="hover:text-blue-500 cursor-pointer">Rôles</li>
      </ul>
    </div>
  );
}