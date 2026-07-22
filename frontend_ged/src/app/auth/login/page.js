"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "../../../services/auth.service";
import { getEntreprise } from "../../../services/entreprise.service";

const DEFAULT_BRANDING = {
  libelle: "AGOSOFT-GED",
  slogan: "Gestion Électronique de Documents",
  description: "",
  email: "",
  telephone: "",
  logo: null,
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    getEntreprise()
      .then((data) => {
        setBranding({
          libelle: data.libelle || DEFAULT_BRANDING.libelle,
          slogan: data.slogan || DEFAULT_BRANDING.slogan,
          description: data.description || "",
          email: data.email || "",
          telephone: data.telephone || "",
          logo: data.logo || null,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get("session") === "expired") {
      setError("Votre session a expiré. Veuillez vous reconnecter.");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loginId || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await login(loginId, password);
      if (result.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(result.error || "Identifiants incorrects.");
      }
    } catch (err) {
      setError("Une erreur inattendue est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const brandInitial = (branding.libelle || "A").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-4 py-10">
      {/* Carte blanche rectangulaire */}
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden">
        <div className="flex flex-col md:flex-row min-h-[420px]">
          {/* Panneau gauche : logo + identité */}
          <div className="md:w-[42%] flex flex-col justify-center px-8 py-10 md:py-12 md:px-10 bg-slate-50/80 border-b md:border-b-0 md:border-r border-slate-200">
            <div className="flex items-start gap-5">
              <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
                {branding.logo ? (
                  <img
                    src={branding.logo}
                    alt=""
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <span className="text-3xl sm:text-4xl font-bold text-blue-700">
                    {brandInitial}
                  </span>
                )}
              </div>
              <div className="pt-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                  {branding.libelle}
                </h1>
                {branding.slogan && (
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                    {branding.slogan}
                  </p>
                )}
                {branding.description && (
                  <p className="mt-3 text-xs text-slate-500 leading-relaxed line-clamp-4">
                    {branding.description}
                  </p>
                )}
                {(branding.email || branding.telephone) && (
                  <div className="mt-4 space-y-1 text-xs text-slate-600">
                    {branding.email && (
                      <p className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {branding.email}
                      </p>
                    )}
                    {branding.telephone && (
                      <p className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {branding.telephone}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panneau droit : formulaire */}
          <div className="flex-1 flex flex-col justify-center px-8 py-10 md:py-12 md:px-12">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 md:hidden">
              Connexion
            </h2>

            {error && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="loginId"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Nom d&apos;utilisateur ou e-mail
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    id="loginId"
                    name="loginId"
                    type="text"
                    required
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-md bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="utilisateur1 ou email@exemple.com"
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-md bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Connexion en cours…</span>
                  </>
                ) : (
                  <>
                    <span>Se connecter</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} AGOSOFT. Tous droits réservés.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
