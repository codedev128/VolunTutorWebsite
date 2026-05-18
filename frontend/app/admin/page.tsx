"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    if (localStorage.getItem("vt_admin_session")) router.replace("/admin/dashboard");
    else router.replace("/find/auth");
  }, [router]);
  return null;
}
