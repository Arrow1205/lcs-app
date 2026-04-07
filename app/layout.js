import "./globals.css";

export const metadata = {
  title: "Lille Card Show 2026",
  description: "Application Visiteur et Exposant",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#01011e" }}>
        {children}
      </body>
    </html>
  );
}