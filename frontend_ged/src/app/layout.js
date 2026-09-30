import "./globals.css";
import Header from "../components/strucuture_page/Header";
import AuthGuard from "../components/strucuture_page/AuthGuard";
import RouteAccessGuard from "../components/strucuture_page/RouteAccessGuard";
import PageFrame from "../components/strucuture_page/PageFrame";
import FirstLoginPasswordModal from "../components/strucuture_page/FirstLoginPasswordModal";
import ConnectionSpeedNotifier from "../components/strucuture_page/ConnectionSpeedNotifier";

export const metadata = {
  title: "AGOSOFT-GED",
  description: "Gestion Électronique de Documents",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-slate-50">
        <AuthGuard>
          <FirstLoginPasswordModal />
          <Header />
          <ConnectionSpeedNotifier />
          <PageFrame>
            <RouteAccessGuard>{children}</RouteAccessGuard>
          </PageFrame>
        </AuthGuard>
      </body>
    </html>
  );
}