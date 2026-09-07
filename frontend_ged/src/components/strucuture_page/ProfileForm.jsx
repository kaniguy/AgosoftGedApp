"use client";

import { useState, useEffect, useRef } from "react";
import { getProfile, updateProfile } from "../../services/profile.service";
import { PASSWORD_HELP, passwordComplexityMessage } from "../../utils/passwordPolicy";

export default function ProfileForm({ onSaved }) {
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    photo: null,
  });

  const [passwords, setPasswords] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const data = await getProfile();
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          photo: data.photo || null,
        });
        if (data.photo) {
          setPhotoPreview(data.photo);
        }
      } catch (err) {
        setMessage({
          type: "error",
          text: "Impossible de charger les données du profil.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswords((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: "error", text: "L'image ne doit pas dépasser 2 Mo." });
        return;
      }
      setProfile((prev) => ({ ...prev, photo: file }));
      setRemovePhoto(false);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setProfile((prev) => ({ ...prev, photo: null }));
    setPhotoPreview(null);
    setRemovePhoto(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    if (passwords.new_password || passwords.old_password || passwords.confirm_password) {
      if (!passwords.old_password || !passwords.new_password || !passwords.confirm_password) {
        setMessage({ type: "error", text: "Veuillez remplir tous les champs du mot de passe." });
        setSaving(false);
        return;
      }
      if (passwords.new_password !== passwords.confirm_password) {
        setMessage({ type: "error", text: "Les nouveaux mots de passe ne correspondent pas." });
        setSaving(false);
        return;
      }
      const complexity = passwordComplexityMessage(passwords.new_password);
      if (complexity) {
        setMessage({ type: "error", text: complexity });
        setSaving(false);
        return;
      }
    }

    try {
      const formData = new FormData();
      formData.append("first_name", profile.first_name);
      formData.append("last_name", profile.last_name);
      formData.append("email", profile.email);
      if (profile.photo instanceof File) formData.append("photo", profile.photo);
      else if (removePhoto) formData.append("remove_photo", "true");
      if (passwords.new_password) {
        formData.append("old_password", passwords.old_password);
        formData.append("new_password", passwords.new_password);
      }

      const updatedData = await updateProfile(formData);
      setProfile({
        first_name: updatedData.first_name || "",
        last_name: updatedData.last_name || "",
        email: updatedData.email || "",
        photo: updatedData.photo || null,
      });
      setPhotoPreview(updatedData.photo || null);
      setRemovePhoto(false);
      setPasswords({ old_password: "", new_password: "", confirm_password: "" });
      setMessage({ type: "success", text: "Profil mis à jour avec succès !" });
      onSaved?.();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Erreur lors de la mise à jour du profil." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden grid grid-cols-1 md:grid-cols-3">
      <div className="p-8 bg-slate-50/50 border-r border-slate-100 flex flex-col items-center justify-center text-center">
        <div className="relative group mb-4">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-4xl font-bold">
            {photoPreview ? (
              <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
            ) : (
              profile.first_name ? profile.first_name[0].toUpperCase() : "U"
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg">
          Changer la photo
        </button>
        {photoPreview && (
          <button type="button" onClick={handleRemovePhoto} className="mt-2 text-xs text-red-600 hover:text-red-700">
            Supprimer la photo
          </button>
        )}
      </div>

      <div className="p-8 md:col-span-2">
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl text-sm border ${message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Prénom</label>
              <input name="first_name" value={profile.first_name} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Nom</label>
              <input name="last_name" value={profile.last_name} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Email</label>
            <input name="email" type="email" required value={profile.email} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
          </div>

          <hr className="border-slate-100 my-4" />
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Changer le mot de passe</h3>
          <p className="text-xs text-slate-400 mb-2">{PASSWORD_HELP}</p>
          <input name="old_password" type="password" value={passwords.old_password} onChange={handlePasswordChange} placeholder="Ancien mot de passe" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm mb-2 focus:ring-2 focus:ring-purple-500 focus:outline-none" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input name="new_password" type="password" value={passwords.new_password} onChange={handlePasswordChange} placeholder="Nouveau mot de passe" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
            <input name="confirm_password" type="password" value={passwords.confirm_password} onChange={handlePasswordChange} placeholder="Confirmer" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" disabled={saving} className="px-6 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl disabled:opacity-50">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
