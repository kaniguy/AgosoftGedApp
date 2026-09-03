"use client";

import ProfileForm from "../../../components/strucuture_page/ProfileForm";

export default function ProfilePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 flex items-center space-x-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center shadow-md">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mon Profil</h1>
          <p className="text-sm text-gray-500">Informations personnelles et sécurité</p>
        </div>
      </div>

      <ProfileForm />
    </div>
  );
}
