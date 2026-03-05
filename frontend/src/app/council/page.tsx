"use client";

import dynamic from "next/dynamic";

const CouncilWorkspace = dynamic(
  () => import("@/components/council/CouncilWorkspace"),
  { ssr: false }
);

export default function CouncilPage() {
  return <CouncilWorkspace />;
}
