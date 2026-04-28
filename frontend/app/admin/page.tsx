import dynamic from "next/dynamic";
import React from "react";

const Login = dynamic(() => import("@/components/admin/Login"));

export default function AdminPage() {
  return (
    <main className="admin-shell">
      <Login />
    </main>
  );
}
