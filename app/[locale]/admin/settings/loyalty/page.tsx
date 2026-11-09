"use client";

import { LoyaltySettingsTab } from "@/components/admin/settings/sections/loyalty-settings-tab";
import { useAdminSettingsContext } from "@/components/admin/settings/admin-settings-context";
import { SectionLoader } from "@/components/admin/settings/section-loader";

export default function Page() {
  const { isSaving, dirtySections, updateNestedField, saveSection, discardEdits } =
    useAdminSettingsContext();

  return (
    <SectionLoader>
      {(loadedSettings) => (
        <LoyaltySettingsTab
          settings={loadedSettings}
          isSaving={isSaving}
          isDirty={dirtySections.has("loyalty")}
          updateField={updateNestedField}
          onSave={() => saveSection("loyalty", loadedSettings.loyalty ?? { enabled: false })}
          onDiscard={discardEdits}
        />
      )}
    </SectionLoader>
  );
}
