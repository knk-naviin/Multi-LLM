"use client";

import dynamic from "next/dynamic";

const DashboardWorkspace = dynamic(
  () =>
    import("@/components/dashboard/DashboardWorkspace").then(
      (mod) => mod.DashboardWorkspace
    ),
  { ssr: false }
);

export default function DashboardPage() {
  return (
    <div className="h-full min-h-0 w-full">
      <DashboardWorkspace />
    </div>
  );
}
