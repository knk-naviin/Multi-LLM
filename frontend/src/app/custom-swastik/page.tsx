"use client";

import dynamic from "next/dynamic";

const CustomSwastikWorkspace = dynamic(
  () =>
    import("@/components/custom-swastik/CustomSwastikWorkspace").then(
      (mod) => mod.CustomSwastikWorkspace
    ),
  { ssr: false }
);

export default function CustomSwastikPage() {
  return (
    <div className="h-full min-h-0 w-full">
      <CustomSwastikWorkspace />
    </div>
  );
}
