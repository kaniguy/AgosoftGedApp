import "./globals.css";
import Header from "../components/strucuture_page/Header";
import AuthGuard from "../components/strucuture_page/AuthGuard";

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-gray-100">
        <AuthGuard>
          <Header />
          <div className="pt-20">{children}</div>
        </AuthGuard>
      </body>
    </html>
  );
}