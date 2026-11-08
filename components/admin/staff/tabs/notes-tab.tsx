"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { StaffFormValues, StaffNoteEntry } from "../staff-detail-types";

interface NotesTabProps {
  form: StaffFormValues;
  setField: <K extends keyof StaffFormValues>(
    key: K,
    value: StaffFormValues[K],
  ) => void;
  entries: StaffNoteEntry[];
  onAddNote: (body: string) => Promise<boolean>;
  onDelete: () => void;
  isDeleting: boolean;
  readOnly?: boolean;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotesTab({
  form,
  setField,
  entries,
  onAddNote,
  onDelete,
  isDeleting,
  readOnly = false,
}: NotesTabProps) {
  const t = useTranslations("admin.hc.notesTab");
  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const submitNote = async () => {
    const body = draft.trim();
    if (!body) return;
    setIsAdding(true);
    const added = await onAddNote(body);
    if (added) setDraft("");
    setIsAdding(false);
  };

  // Newest first, without mutating the array the shell holds.
  const ordered = [...entries].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("addNoteTitle")}</CardTitle>
            <CardDescription>
              {t("addNoteDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("addNotePlaceholder")}
              rows={3}
              disabled={readOnly || isAdding}
            />
            <Button
              type="button"
              size="sm"
              onClick={submitNote}
              disabled={readOnly || isAdding || draft.trim().length === 0}
            >
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("addNote")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("noteHistory")}</CardTitle>
          </CardHeader>
          <CardContent>
            {ordered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <StickyNote className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {t("noNotes")}
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {ordered.map((entry) => (
                  <li key={entry._id} className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {entry.authorEmail || t("unknownAuthor")}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm whitespace-pre-wrap">
                        {entry.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("standingNoteTitle")}</CardTitle>
            <CardDescription>
              {t("standingNoteDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder={t("standingNotePlaceholder")}
              rows={4}
              disabled={readOnly}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">{t("dangerZone")}</CardTitle>
            <CardDescription>
              {t("dangerZoneDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={onDelete}
              disabled={isDeleting || readOnly}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t("removeFromStaff")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
