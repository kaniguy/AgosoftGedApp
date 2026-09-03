"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { logout } from "../../services/auth.service";
import { getProfile } from "../../services/profile.service";
import { getEntrepriseFromStorage, refreshEntreprise } from "../../services/entreprise.service";
import { resolveMediaUrl, hasClientSession } from "../../services/api";
import { APP_LOGO_SRC } from "../../assets/branding";
import ProfileModal from "./ProfileModal";

const DEFAULT_BRANDING = {
  libelle: "AGOSOFT-GED",
  slogan: "Gestion Électronique de Documents",
  logo: null,
};

export default function Header() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const [entreprise, setEntreprise] = useState(DEFAULT_BRANDING);
  const router = useRouter();
  const pathname = usePathname();

  // Charger l'utilisateur connecté (+ photo de profil) et le branding entreprise
  useEffect(() => {
    const loadEntreprise = () => {
      setEntreprise(getEntrepriseFromStorage());
    };

    const loadUserFromStorage = () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          console.error("Erreur parsing user:", e);
        }
      } else {
        setUser(null);
      }
    };

    const refreshProfile = async () => {
      if (!hasClientSession()) return;
      try {
        const data = await getProfile();
        setUser(data);
      } catch (e) {
        // Backend injoignable : conserver les données locales sans bloquer l'UI
        loadUserFromStorage();
        if (process.env.NODE_ENV === "development") {
          console.warn("Profil header (cache local):", e.message);
        }
      }
    };

    loadUserFromStorage();
    loadEntreprise();
    refreshEntreprise().then((data) => data && setEntreprise(data)).catch(() => {});
    refreshProfile();

    window.addEventListener("user-profile-updated", loadUserFromStorage);
    window.addEventListener("entreprise-updated", loadEntreprise);
    return () => {
      window.removeEventListener("user-profile-updated", loadUserFromStorage);
      window.removeEventListener("entreprise-updated", loadEntreprise);
    };
  }, []);

  // Détection du scroll pour l'effet de shadow
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fermer le menu utilisateur quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (open && !event.target.closest(".user-menu")) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  const handleNavigation = (path) => {
    router.push(path);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/auth/login");
    } catch (e) {
      console.error("Erreur de déconnexion:", e);
      router.push("/auth/login");
    }
  };

  if (pathname?.startsWith("/telechargement/") || pathname === "/auth/login") {
    return null;
  }

  const photoUrl = resolveMediaUrl(user?.photo);
  const logoUrl = entreprise.logo || APP_LOGO_SRC;
  const brandInitial = (entreprise.libelle || "A").charAt(0).toUpperCase();

  return (
    <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
      scrolled 
        ? "bg-white/95 backdrop-blur-md shadow-lg" 
        : "bg-white shadow-sm"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <div 
            onClick={() => router.push("/")}
            className="flex items-center space-x-2 cursor-pointer group"
          >
            <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-lg bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={entreprise.libelle || "AGOSOFT GED"} className="h-full w-full object-contain p-0.5" />
              ) : (
                <span className="text-blue-700 font-bold text-lg">{brandInitial}</span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-900 to-blue-600 bg-clip-text text-transparent">
                {entreprise.libelle}
              </h1>
              {entreprise.slogan && (
                <p className="text-xs text-gray-500 hidden sm:block">{entreprise.slogan}</p>
              )}
            </div>
          </div>

          {/* Boutons Modules et Tâches - AJOUTÉS SANS MODIFIER LE STYLE EXISTANT */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-500 hover:text-white transition-colors duration-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
              </svg>
              Modules
            </button>

            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center px-4 py-2 border border-yellow-500 text-yellow-500 rounded-md hover:bg-yellow-500 hover:text-white transition-colors duration-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 12h.01M7 16h.01M7 8h.01M12 16h6" />
              </svg>
              Tâches
            </button>
          </div>

          {/* Menu utilisateur */}
          <div className="relative user-menu">
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-sm font-medium overflow-hidden border border-gray-200">
                {photoUrl ? (
                  <img src={photoUrl} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  user?.first_name ? user.first_name[0].toUpperCase() : (user?.username ? user.username[0].toUpperCase() : 'U')
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-700">
                  {user?.first_name || user?.last_name 
                    ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                    : user?.username || "Utilisateur"}
                </p>
                <p className="text-xs text-gray-500">{user?.email || ""}</p>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {open && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.first_name || user?.last_name 
                      ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                      : user?.username || "Utilisateur"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{user?.email || ""}</p>
                </div>
                
                <div className="py-2">
                  <button 
                    onClick={() => {
                      setOpen(false);
                      setProfileOpen(true);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Mon profil</span>
                  </button>
                  
                  {/* <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Paramètres</span>
                  </button> */}
                </div>
                
                <div className="border-t border-gray-100 py-2">
                  <button 
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Déconnexion</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barre de progression sous le header au scroll */}
      <div className={`h-0.5 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ${scrolled ? "w-full" : "w-0"}`} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
}