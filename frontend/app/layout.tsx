import type { Metadata, Viewport } from "next";
import "./globals.css";
import DashboardShell from "@/components/DashboardShell";
import ToastContainer from "@/components/ToastContainer";
import { cn } from "@/lib/utils";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ee8326",
};

export const metadata: Metadata = {
  title: "Canteen IQ | Intelligent Canteen OS",
  description:
    "Next-generation AI decision support system for campus canteens. Optimized inventory, risk mitigation, and demand forecasting.",
  keywords: ["Canteen IQ", "canteen", "inventory", "AI", "DSS", "smart canteen"],
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Canteen IQ" },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <DashboardShell>{children}</DashboardShell>
        <ToastContainer />
      </body>
    </html>
  );
}
