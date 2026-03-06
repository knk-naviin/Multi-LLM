"use client";

import dynamic from "next/dynamic";

const TaskModeWorkspace = dynamic(
  () => import("@/components/taskmode/TaskModeWorkspace"),
  { ssr: false }
);

export default function TaskModePage() {
  return <TaskModeWorkspace />;
}
