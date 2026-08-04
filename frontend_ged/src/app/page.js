// app/page.jsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ModuleCard from "../components/ModuleCard";
import Header from "../components/strucuture_page/Header";
import { APP_MODULES, getVisibleModulesFromStorage, getModuleFilterChips } from "../constants/modules";
import { hasControleQualiteModule } from "../utils/controleQualitePermissions";

const FILTER_CHIP_CLASSES = {
  slate: { active: "bg-slate-700 text-white", idle: "hover:bg-slate-100 text-slate-600" },
  blue: { active: "bg-blue-600 text-white", idle: "hover:bg-blue-50 text-blue-600" },
  emerald: { active: "bg-emerald-600 text-white", idle: "hover:bg-emerald-50 text-emerald-600" },
  purple: { active: "bg-purple-600 text-white", idle: "hover:bg-purple-50 text-purple-600" },
  orange: { active: "bg-orange-600 text-white", idle: "hover:bg-orange-50 text-orange-600" },
  rose: { active: "bg-rose-600 text-white", idle: "hover:bg-rose-50 text-rose-600" },
  indigo: { active: "bg-indigo-600 text-white", idle: "hover:bg-indigo-50 text-indigo-600" },
  cyan: { active: "bg-cyan-600 text-white", idle: "hover:bg-cyan-50 text-cyan-600" },
  teal: { active: "bg-teal-600 text-white", idle: "hover:bg-teal-50 text-teal-600" },
  fuchsia: { active: "bg-fuchsia-600 text-white", idle: "hover:bg-fuchsia-50 text-fuchsia-600" },
  yellow: { active: "bg-yellow-500 text-white", idle: "hover:bg-yellow-50 text-yellow-700" },
};

export default function Home() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [allowedModules, setAllowedModules] = useState(() =>
    typeof window !== "undefined" ? getVisibleModulesFromStorage() : []
  );

  // Charge les modules autorisés selon les groupes de l'utilisateur connecté
  useEffect(() => {
    const refreshModules = () => {
      const visible = getVisibleModulesFromStorage().filter(
        (m) => m.code !== "controle_qualite" || hasControleQualiteModule()
      );
      setAllowedModules(visible);
      setSelectedFilter((current) => {
        if (current === "all") return current;
        const stillValid = visible.some((m) => m.color === current);
        return stillValid ? current : "all";
      });
    };
    refreshModules();
    window.addEventListener("user-profile-updated", refreshModules);
    return () => window.removeEventListener("user-profile-updated", refreshModules);
  }, []);

  // Mise à jour de l'heure chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const modules = allowedModules;
  const filterChips = getModuleFilterChips(modules);

  const isExternalPath = (path) => /^https?:\/\//i.test(path || "");

  const handleModuleClick = (module) => {
    if (!module.path || isExternalPath(module.path)) return;
    router.push(module.path);
  };

  const filteredModules = modules.filter(module => 
    module.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedFilter === 'all' || module.color === selectedFilter)
  );

  // Formatage de la date et l'heure
  const formattedDate = currentDateTime.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  
  const formattedTime = currentDateTime.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 pt-16">
        
        {/* Header avec dégradé et effets modernes */}
        <div className="relative bg-white/80 backdrop-blur-sm border-b border-slate-200/60 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-purple-600/5"></div>
          <div className="max-w-7xl mx-auto px-6 py-8 relative">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </div>
                  <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                    LISTE DES MODULES
                  </h1>
                </div>
                <p className="text-slate-500 ml-13">
                  Vue d'ensemble de vos modules disponibles
                </p>
              </div>
              
              <div className="flex gap-4">
                {/* Date et Heure */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity"></div>
                  <div className="relative bg-white rounded-2xl px-6 py-3 shadow-md border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">{formattedDate}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-2xl font-bold text-blue-600 font-mono">{formattedTime}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Filtres et Recherche */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row gap-6 justify-between items-center mb-10">
            <div className="relative flex-1 max-w-lg w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Rechercher un module..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all outline-none shadow-sm"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap justify-center">
              {filterChips.map((filter) => {
                const styles = FILTER_CHIP_CLASSES[filter.styleKey] || FILTER_CHIP_CLASSES.slate;
                const isActive = selectedFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedFilter(filter.id)}
                    className={`px-5 py-2 rounded-xl font-medium transition-all duration-200 ${
                      isActive
                        ? `${styles.active} shadow-md`
                        : `bg-white/50 backdrop-blur-sm border border-slate-200 ${styles.idle}`
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grille des modules */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModules.map((module) => (
              <ModuleCard
                key={module.code}
                title={module.title}
                color={module.color}
                icon={module.icon}
                description={module.description}
                href={module.path}
                external={isExternalPath(module.path)}
                onClick={() => handleModuleClick(module)}
              />
            ))}
          </div>

          {/* Message si aucun résultat */}
          {filteredModules.length === 0 && (
            <div className="text-center py-16 bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-500 text-lg font-medium">Aucun module trouvé</p>
              <p className="text-slate-400 text-sm mt-1">Essayez de modifier votre recherche</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}