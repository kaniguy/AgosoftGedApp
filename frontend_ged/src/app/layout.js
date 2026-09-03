import "./globals.css";
import Header from "../components/strucuture_page/Header";
import AuthGuard from "../components/strucuture_page/AuthGuard";
import RouteAccessGuard from "../components/strucuture_page/RouteAccessGuard";
import PageFrame from "../components/strucuture_page/PageFrame";

export const metadata = {
  title: "AGOSOFT-GED",
  description: "Gestion Électronique de Documents",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-slate-50">
        <AuthGuard>
          <Header />
          <PageFrame>
            <RouteAccessGuard>{children}</RouteAccessGuard>
          </PageFrame>
        </AuthGuard>
      </body>
    </html>
  );
}