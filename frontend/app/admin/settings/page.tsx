import Link from "next/link";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";

const Settings = dynamic(() => import("@/components/admin/Settings"), { ssr: false });

export const metadata: Metadata = {
  title: "Campus controls | PES EC Canteen",
  description: "Manage the campus calendar, breaks, and working days for the PES EC Canteen.",
};

export default function AdminSettingsPage() {
  return (
    <main className="admin-settings-page animate-in fade-in duration-500">
      <Settings />
    </main>
  );
}
