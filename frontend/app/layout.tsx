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
  themeColor: "#374175",
};

export const metadata: Metadata = {
  title: "PES Canteen OS | Smart Inventory & Analytics",
  description:
    "AI-powered multi-agent system helping PES University canteens optimize inventory and streamline operations.",
  keywords: ["canteen", "inventory", "college", "AI", "PES University", "smart canteen"],
  appleWebApp: { capable: true, statusBarStyle: "default", title: "PES Canteen OS" },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans")} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <DashboardShell>{children}</DashboardShell>
        <ToastContainer />
      </body>
    </html>
  );
}
