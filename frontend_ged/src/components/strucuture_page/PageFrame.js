"use client";

import { usePathname } from "next/navigation";
import { APP_BACKGROUND_SRC } from "../../assets/branding";

export default function PageFrame({ children }) {
  const pathname = usePathname();
  const isLogin = pathname === "/auth/login";
  const fullBleed = isLogin || pathname?.startsWith("/telechargement/");

  return (
    <div
      className={`${fullBleed ? "" : "pt-20"} min-h-app-screen bg-cover bg-center bg-no-repeat bg-fixed`}
      style={
        isLogin
          ? undefined
          : {
              backgroundImage: `linear-gradient(rgba(248,250,252,0.82), rgba(248,250,252,0.88)), url(${APP_BACKGROUND_SRC})`,
            }
      }
    >
      {children}
    </div>
  );
}
