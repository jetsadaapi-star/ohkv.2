"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Trash2,
  Plus,
  Loader2,
  ChevronUp,
  ChevronDown,
  Lock,
  Eye,
  EyeOff,
  PencilLine,
  ListChecks,
  Sparkles,
  TextCursorInput,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { AdminStatsStrip } from "@/components/admin/admin-stats-strip";
import { FormPageTitle } from "@/components/admin/form-sections";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/toast-notification";
import { OnboardingWizardPreview } from "@/components/admin/onboarding/onboarding-wizard-preview";
import {
  CUSTOM_FIELD_TYPES,
  ONBOARDING_STEP_KINDS,
  type OnboardingFieldWidget,
} from "@/lib/vendors/vendor-onboarding-fields";
import type {
  EditableField,
  EditableStep,
  EditableTemplate,
} from "@/lib/vendors/onboarding-template-editor";
import type { PublicVendorPlan } from "@/lib/vendors/vendor-onboarding";
import { cn } from "@/lib/utils";

const WIDGET_LABELS: Record<string, string> = {
  text: "widgetText",
  textarea: "widgetTextarea",
  select: "widgetSelect",
  checkbox: "widgetCheckbox",
  document: "widgetDocument",
  email: "widgetEmail",
  password: "widgetPassword",
  phone: "widgetPhone",
  country: "widgetCountry",
  state: "widgetState",
};

/**
 * A system step/field's built-in name in the admin's language: its
 * `labelKey` (the key the public form uses) when that message exists, the
 * English `defaultLabel` otherwise.
 */
function translatedDefaultLabel(
  tRoot: ((key: never) => string) & { has: (key: string) => boolean },
  item: { labelKey?: string; defaultLabel: string },
): string {
  return item.labelKey && tRoot.has(item.labelKey)
    ? tRoot(item.labelKey as never)
    : item.defaultLabel;
}

const newId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

/** Pin account first and review last; keep everything else in order. */
function normalizeOrder(steps: EditableStep[]): EditableStep[] {
  const rank = (s: EditableStep) =>
    s.kind === ONBOARDING_STEP_KINDS.ACCOUNT
      ? 0
      : s.kind === ONBOARDING_STEP_KINDS.REVIEW
        ? 2
        : 1;
  return steps
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .map(({ s }) => s);
}

export function OnboardingFlowBuilder({
  initialTemplate,
  plansEnabled,
  marketplaceEnabled,
  plans,
  defaultCommissionRate,
}: {
  initialTemplate: EditableTemplate;
  plansEnabled: boolean;
  marketplaceEnabled: boolean;
  plans: PublicVendorPlan[];
  defaultCommissionRate: number;
}) {
  const t = useTranslations("admin.hc.onboardingFlowBuilder");
  const tp = useTranslations("admin.hc.adminPages.vendorOnboarding");
  const [steps, setSteps] = useState<EditableStep[]>(
    normalizeOrder(initialTemplate.steps),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // Which step's editor is expanded (accordion — one at a time), like the home
  // page builder.
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const update = (updater: (prev: EditableStep[]) => EditableStep[]) => {
    setSteps((prev) => normalizeOrder(updater(prev)));
    setIsDirty(true);
  };

  const patchStep = (stepId: string, patch: Partial<EditableStep>) =>
    update((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    );

  const patchField = (
    stepId: string,
    fieldId: string,
    patch: Partial<EditableField>,
  ) =>
    update((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? {
              ...s,
              fields: s.fields.map((f) =>
                f.id === fieldId ? { ...f, ...patch } : f,
              ),
            }
          : s,
      ),
    );

  const removeField = (stepId: string, fieldId: string) =>
    update((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) }
          : s,
      ),
    );

  const addField = (stepId: string) => {
    const id = newId("custom");
    const field: EditableField = {
      id,
      key: id,
      widget: "text",
      label: "",
      placeholder: "",
      helpText: "",
      required: false,
      visible: true,
      system: false,
      defaultLabel: t("newField"),
      isDocument: false,
      locked: false,
      options: [],
    };
    update((prev) =>
      prev.map((s) =>
        s.id === stepId ? { ...s, fields: [...s.fields, field] } : s,
      ),
    );
  };

  const reorderFields = (stepId: string, activeId: string, overId: string) =>
    update((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const oldIndex = s.fields.findIndex((f) => f.id === activeId);
        const newIndex = s.fields.findIndex((f) => f.id === overId);
        if (oldIndex < 0 || newIndex < 0) return s;
        return { ...s, fields: arrayMove(s.fields, oldIndex, newIndex) };
      }),
    );

  const moveStep = (stepId: string, dir: -1 | 1) =>
    update((prev) => {
      const idx = prev.findIndex((s) => s.id === stepId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      return arrayMove(prev, idx, target);
    });

  const removeStep = (stepId: string) =>
    update((prev) => prev.filter((s) => s.id !== stepId));

  const addStep = () => {
    const id = newId("custom_step");
    const step: EditableStep = {
      id,
      key: id,
      kind: ONBOARDING_STEP_KINDS.CUSTOM,
      label: "",
      enabled: true,
      system: false,
      defaultLabel: t("newStep"),
      fields: [],
    };
    // Insert before the review step so it stays last.
    update((prev) => {
      const reviewIdx = prev.findIndex(
        (s) => s.kind === ONBOARDING_STEP_KINDS.REVIEW,
      );
      if (reviewIdx < 0) return [...prev, step];
      const copy = prev.slice();
      copy.splice(reviewIdx, 0, step);
      return copy;
    });
  };

  const save = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/vendors/onboarding-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSteps(normalizeOrder(data.data.template.steps));
        setIsDirty(false);
        toast.success(data.message || t("toastSaved"));
      } else {
        toast.error(data.message || t("toastSaveFailed"));
      }
    } catch {
      toast.error(t("toastSaveFlowFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const template: EditableTemplate = { steps };

  return (
    <div className="space-y-4">
      <AdminFormStickyHeader
        className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
        title={
          <FormPageTitle icon={<ListChecks />} tone="amber">
            {t("title")}
          </FormPageTitle>
        }
        description={t("intro")}
        status={
          isDirty ? <StatusBadge tone="warning">{t("unsavedChanges")}</StatusBadge> : undefined
        }
        actions={
          <Button
            onClick={save}
            disabled={isSaving || !isDirty}
            size="sm"
            className="rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("saving")}
              </>
            ) : (
              t("saveChanges")
            )}
          </Button>
        }
      />

      {/* Counted from the flow being edited, so they move as you build. */}
      <AdminStatsStrip
        variant="tiles"
        items={[
          { title: tp("tiles.steps"), description: tp("tiles.steps"), value: steps.filter((s) => s.enabled).length, icon: <ListChecks />, iconClassName: "bg-amber-100" },
          { title: tp("tiles.custom"), description: tp("tiles.custom"), value: steps.filter((s) => !s.system).length, icon: <Sparkles />, iconClassName: "bg-violet-100" },
          {
            title: tp("tiles.fields"),
            description: tp("tiles.fields"),
            value: steps.reduce((sum, s) => sum + s.fields.length, 0),
            icon: <TextCursorInput />,
            iconClassName: "bg-blue-100",
          },
        ]}
      />

      {!marketplaceEnabled && (
        <Card>
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">
              {t("marketplaceOff")}
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="builder" className="gap-4">
        <TabsList className="h-auto w-fit justify-start gap-1.5 rounded-full bg-muted/60 p-1">
          {(
            [
              ["builder", Wrench, t("tabBuilder")],
              ["preview", Eye, t("tabPreview")],
            ] as const
          ).map(([value, Icon, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "h-auto flex-none gap-2 rounded-full border-0 bg-transparent px-4 py-2 text-sm font-medium shadow-none transition-colors",
                "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                "data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
              )}
            >
              <Icon className="size-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Builder — collapsible step cards */}
        <TabsContent value="builder" className="space-y-3">
          {steps.map((step, index) => (
            <StepCard
              key={step.id}
              step={step}
              index={index}
              isExpanded={expandedStepId === step.id}
              onToggleExpand={() =>
                setExpandedStepId((cur) => (cur === step.id ? null : step.id))
              }
              canMoveUp={
                index > 0 &&
                step.kind !== ONBOARDING_STEP_KINDS.ACCOUNT &&
                steps[index - 1]?.kind !== ONBOARDING_STEP_KINDS.ACCOUNT
              }
              canMoveDown={
                index < steps.length - 1 &&
                step.kind !== ONBOARDING_STEP_KINDS.REVIEW &&
                steps[index + 1]?.kind !== ONBOARDING_STEP_KINDS.REVIEW
              }
              onMove={(dir) => moveStep(step.id, dir)}
              onPatch={(patch) => patchStep(step.id, patch)}
              onRemove={() => removeStep(step.id)}
              onPatchField={(fid, patch) => patchField(step.id, fid, patch)}
              onRemoveField={(fid) => removeField(step.id, fid)}
              onAddField={() => addField(step.id)}
              onReorderFields={(a, b) => reorderFields(step.id, a, b)}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addStep}
            className="w-full rounded-2xl border-dashed border-emerald-300 bg-emerald-50/50 py-6 font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/5 dark:text-emerald-300"
          >
            <Plus className="mr-2 h-4 w-4" /> {t("addStep")}
          </Button>
        </TabsContent>

        {/* Preview — exact storefront wizard */}
        <TabsContent value="preview">
          <OnboardingWizardPreview
            template={template}
            plansEnabled={plansEnabled}
            plans={plans}
            defaultCommissionRate={defaultCommissionRate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StepCard({
  step,
  index,
  isExpanded,
  onToggleExpand,
  canMoveUp,
  canMoveDown,
  onMove,
  onPatch,
  onRemove,
  onPatchField,
  onRemoveField,
  onAddField,
  onReorderFields,
}: {
  step: EditableStep;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onPatch: (patch: Partial<EditableStep>) => void;
  onRemove: () => void;
  onPatchField: (fieldId: string, patch: Partial<EditableField>) => void;
  onRemoveField: (fieldId: string) => void;
  onAddField: () => void;
  onReorderFields: (activeId: string, overId: string) => void;
}) {
  const t = useTranslations("admin.hc.onboardingFlowBuilder");
  const tRoot = useTranslations();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const isAccount = step.kind === ONBOARDING_STEP_KINDS.ACCOUNT;
  const isReview = step.kind === ONBOARDING_STEP_KINDS.REVIEW;
  const isSubscription = step.kind === ONBOARDING_STEP_KINDS.SUBSCRIPTION;
  // Only steps that actually collect fields can gain custom fields.
  const canAddFields = !isReview && !isSubscription && !isAccount;

  const visibleCount = step.fields.filter((f) => f.visible || f.locked).length;
  const hiddenCount = step.fields.length - visibleCount;
  const subtitle = isSubscription
    ? t("subtitlePlanStep")
    : isReview
      ? t("subtitleSummaryStep")
      : hiddenCount > 0
        ? t("fieldsCountHidden", { count: visibleCount, hidden: hiddenCount })
        : t("fieldsCount", { count: visibleCount });

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id)
      onReorderFields(String(active.id), String(over.id));
  };

  return (
    <Card className={cn("overflow-hidden rounded-2xl shadow-sm transition-opacity", !step.enabled && "opacity-60")}>
      <CardContent className="py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
              // A built-in step indigo, one the admin added emerald.
              step.system
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
            )}
          >
            {index + 1}
          </span>
          <Input
            value={step.label}
            placeholder={translatedDefaultLabel(tRoot, step)}
            onChange={(e) => onPatch({ label: e.target.value })}
            className="h-9 flex-1"
          />
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
              step.system
                ? "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30"
                : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
            )}
          >
            {step.system ? t("badgeSystem") : t("badgeCustom")}
          </span>
          <div className="flex flex-col">
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
              className="text-muted-foreground disabled:opacity-30"
              aria-label={t("moveStepUp")}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
              className="text-muted-foreground disabled:opacity-30"
              aria-label={t("moveStepDown")}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-lg text-blue-600 transition-transform dark:text-blue-400",
              isExpanded && "rotate-6 bg-blue-50 dark:bg-blue-500/15",
            )}
            onClick={onToggleExpand}
            aria-label={isExpanded ? t("collapseStep") : t("editStep")}
          >
            <PencilLine className="h-3.5 w-3.5" />
          </Button>
          {!step.system && (
            <button
              type="button"
              onClick={onRemove}
              className="text-destructive"
              aria-label={t("deleteStep")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="mt-1 pl-8 text-xs text-muted-foreground">{subtitle}</p>

        {/* Collapsible editor body */}
        <div
          className={cn(
            "grid overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isExpanded
              ? "mt-2 grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="rounded-lg border border-border bg-muted/40 p-3.5">
              {isSubscription ? (
                <p className="text-xs text-muted-foreground">
                  {t("planSelectionInfo")}
                </p>
              ) : isReview ? (
                <p className="text-xs text-muted-foreground">
                  {t("summaryInfo")}
                </p>
              ) : (
                <div className="space-y-2">
                  <DndContext
                    id={`dnd-${step.id}`}
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                  >
                    <SortableContext
                      items={step.fields.map((f) => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {step.fields.map((field) => (
                          <SortableFieldRow
                            key={field.id}
                            field={field}
                            onPatch={(patch) => onPatchField(field.id, patch)}
                            onRemove={() => onRemoveField(field.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  {step.fields.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("noFields")}
                    </p>
                  )}

                  {canAddFields && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onAddField}
                      className="text-muted-foreground"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> {t("addCustomField")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableFieldRow({
  field,
  onPatch,
  onRemove,
}: {
  field: EditableField;
  onPatch: (patch: Partial<EditableField>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("admin.hc.onboardingFlowBuilder");
  const tRoot = useTranslations();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card p-2.5"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab text-muted-foreground touch-none"
          {...attributes}
          {...listeners}
          aria-label={t("dragField")}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          value={field.label}
          placeholder={translatedDefaultLabel(tRoot, field)}
          onChange={(e) => onPatch({ label: e.target.value })}
          className="h-8 flex-1"
        />
        {field.system ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {WIDGET_LABELS[field.widget] ? t(WIDGET_LABELS[field.widget]) : field.widget}
          </Badge>
        ) : (
          <NativeSelect
            size="sm"
            value={field.widget}
            onChange={(e) =>
              onPatch({ widget: e.target.value as OnboardingFieldWidget })
            }
            className="w-32 shrink-0"
          >
            {CUSTOM_FIELD_TYPES.map((w) => (
              <option key={w} value={w}>
                {WIDGET_LABELS[w] ? t(WIDGET_LABELS[w]) : w}
              </option>
            ))}
          </NativeSelect>
        )}
        {field.locked ? (
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <button
            type="button"
            onClick={() => onPatch({ visible: !field.visible })}
            className="shrink-0 text-muted-foreground"
            aria-label={field.visible ? t("hideField") : t("showField")}
          >
            {field.visible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>
        )}
        {!field.system && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-destructive"
            aria-label={t("deleteField")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-6">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Switch
            checked={field.required}
            disabled={field.locked || !field.visible}
            onCheckedChange={(v) => onPatch({ required: v })}
          />
          {t("required")}
        </label>
        {!field.visible && !field.locked && (
          <span className="text-xs text-muted-foreground/70">{t("hidden")}</span>
        )}
      </div>

      {/* Custom-field extras: placeholder, help text, dropdown options. */}
      {!field.system && field.visible && (
        <div className="mt-2 space-y-2 pl-6">
          {field.widget !== "checkbox" && (
            <Input
              value={field.placeholder}
              placeholder={t("placeholderText")}
              onChange={(e) => onPatch({ placeholder: e.target.value })}
              className="h-8"
            />
          )}
          <Input
            value={field.helpText}
            placeholder={t("helpText")}
            onChange={(e) => onPatch({ helpText: e.target.value })}
            className="h-8"
          />
          {field.widget === "select" && (
            <OptionsEditor
              options={field.options ?? []}
              onChange={(options) => onPatch({ options })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: { label: string; value: string }[];
  onChange: (options: { label: string; value: string }[]) => void;
}) {
  const setAt = (i: number, patch: Partial<{ label: string; value: string }>) =>
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const add = () => onChange([...options, { label: "", value: "" }]);
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));
  const t = useTranslations("admin.hc.onboardingFlowBuilder");

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{t("options")}</Label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={opt.label}
            placeholder={t("optionLabel")}
            onChange={(e) => {
              const label = e.target.value;
              // Default the stored value to the label until edited.
              setAt(i, {
                label,
                value: opt.value || slugifyValue(label),
              });
            }}
            className="h-8 flex-1"
          />
          <Input
            value={opt.value}
            placeholder={t("optionValue")}
            onChange={(e) => setAt(i, { value: e.target.value })}
            className="h-8 w-28"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-destructive"
            aria-label={t("removeOption")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={add}
        className="text-muted-foreground"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" /> {t("addOption")}
      </Button>
    </div>
  );
}

function slugifyValue(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}
