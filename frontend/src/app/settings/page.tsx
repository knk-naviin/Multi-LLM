import { SettingsPanel } from "@/components/settings/SettingsPanel";

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar w-full px-3 sm:px-4">
      <SettingsPanel />
    </div>
  );
}
