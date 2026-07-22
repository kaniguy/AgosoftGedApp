// components/ModuleCard.jsx
export default function ModuleCard({ title, color, icon, description, onClick }) {
  const colors = {
    blue: {
      bg: "bg-gradient-to-br from-blue-500 to-blue-700",
      hover: "hover:from-blue-600 hover:to-blue-800",
      light: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-200",
      gradient: "from-blue-400 to-blue-600"
    },
    green: {
      bg: "bg-gradient-to-br from-emerald-500 to-teal-700",
      hover: "hover:from-emerald-600 hover:to-teal-800",
      light: "bg-emerald-50",
      text: "text-emerald-600",
      border: "border-emerald-200",
      gradient: "from-emerald-400 to-teal-600"
    },
    purple: {
      bg: "bg-gradient-to-br from-violet-500 to-purple-700",
      hover: "hover:from-violet-600 hover:to-purple-800",
      light: "bg-violet-50",
      text: "text-violet-600",
      border: "border-violet-200",
      gradient: "from-violet-400 to-purple-600"
    },
    orange: {
      bg: "bg-gradient-to-br from-amber-500 to-orange-700",
      hover: "hover:from-amber-600 hover:to-orange-800",
      light: "bg-amber-50",
      text: "text-amber-600",
      border: "border-amber-200",
      gradient: "from-amber-400 to-orange-600"
    },
    rose: {
      bg: "bg-gradient-to-br from-rose-500 to-pink-700",
      hover: "hover:from-rose-600 hover:to-pink-800",
      light: "bg-rose-50",
      text: "text-rose-600",
      border: "border-rose-200",
      gradient: "from-rose-400 to-pink-600"
    },
    indigo: {
      bg: "bg-gradient-to-br from-indigo-500 to-blue-700",
      hover: "hover:from-indigo-600 hover:to-blue-800",
      light: "bg-indigo-50",
      text: "text-indigo-600",
      border: "border-indigo-200",
      gradient: "from-indigo-400 to-blue-600"
    },
    cyan: {
      bg: "bg-gradient-to-br from-cyan-500 to-sky-700",
      hover: "hover:from-cyan-600 hover:to-sky-800",
      light: "bg-cyan-50",
      text: "text-cyan-600",
      border: "border-cyan-200",
      gradient: "from-cyan-400 to-sky-600"
    },
  teal: {
      bg: "bg-gradient-to-br from-teal-500 to-emerald-700",
      hover: "hover:from-teal-600 hover:to-emerald-800",
      light: "bg-teal-50",
      text: "text-teal-600",
      border: "border-teal-200",
      gradient: "from-teal-400 to-emerald-600"
    },
    fuchsia: {
      bg: "bg-gradient-to-br from-fuchsia-500 to-purple-700",
      hover: "hover:from-fuchsia-600 hover:to-purple-800",
      light: "bg-fuchsia-50",
      text: "text-fuchsia-600",
      border: "border-fuchsia-200",
      gradient: "from-fuchsia-400 to-purple-600"
    },
    yellow: {
      bg: "bg-gradient-to-br from-yellow-500 to-yellow-700",
      hover: "hover:from-yellow-600 hover:to-yellow-800",
      light: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-200",
      gradient: "from-yellow-400 to-yellow-600"
    },
  };

  const getIconSvg = () => {
    switch(icon) {
      case 'settings':
        return (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'documents':
        return (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'reports':
        return (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'users':
        return (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case 'video':
        return (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'search':
        return (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case 'quality':
        return (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      default:
        return (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        );
    }
  };

  return (
    <div className="group relative cursor-pointer h-full" onClick={onClick}>
      <div className={`absolute inset-0 ${colors[color].bg} rounded-2xl blur-xl opacity-0 group-hover:opacity-25 transition-all duration-500`}></div>
      
      <div className={`relative ${colors[color].bg} text-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden backdrop-blur-sm h-full flex flex-col`}>
        
        <div className="absolute top-0 right-0 w-40 h-40 opacity-10">
          <svg className="absolute transform rotate-45 translate-x-8 -translate-y-8" viewBox="0 0 100 100" fill="white">
            <circle cx="50" cy="50" r="40" />
            <circle cx="50" cy="50" r="20" />
          </svg>
        </div>
        
        <div className="relative z-10 flex flex-col h-full">
          <div className="mb-4 transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            {getIconSvg()}
          </div>
          
          <h2 className="text-xl font-bold mb-2 tracking-tight">{title}</h2>
          
          <div className="flex-grow">
            {description && (
              <p className="text-sm opacity-90 leading-relaxed line-clamp-2">{description}</p>
            )}
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/20">
            <span className="text-sm font-medium">Accéder au module</span>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-all group-hover:translate-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}