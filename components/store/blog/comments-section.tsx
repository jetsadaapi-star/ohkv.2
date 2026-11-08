"use client";

import { pageLocale } from "@/lib/intl/date-locale";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-notification";
import { useTranslations } from "next-intl";

interface Comment {
  _id: string;
  authorName: string;
  content: string;
  createdAt: string;
  status: string;
}

export function CommentsSection({ postId }: { postId: string }) {
  const t = useTranslations("storeText.commentsSection");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    authorName: "",
    authorEmail: "",
    content: "",
  });

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blog-comments?postId=${postId}&limit=50`);
      const data = await res.json();
      if (data.success) {
        setComments(data.data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchComments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchComments]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.authorName.trim() || !form.authorEmail.trim() || !form.content.trim()) {
      toast.error(t("fillAllFields"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/blog-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, postId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          data.data?.status === "approved"
            ? t("commentPosted")
            : t("commentSubmittedForReview"),
        );
        setForm({ authorName: "", authorEmail: "", content: "" });
        fetchComments();
      } else {
        toast.error(data.error || t("postFailed"));
      }
    } catch {
      toast.error(t("postFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("commentsCount", { count: comments.length })}
        </p>
      </div>

      {/* A skeleton in the shape of the list, not a spinner — the thread keeps
          its place on the page instead of collapsing to a dot and jumping. */}
      {loading ? (
        <ul className="space-y-4" aria-busy="true">
          {[0, 1].map((i) => (
            <li key={i} className="rounded-xl border bg-card p-5">
              <div className="mb-3 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="mt-2 h-3.5 w-4/5" />
            </li>
          ))}
        </ul>
      ) : comments.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("beFirst")}
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c._id} className="rounded-xl border bg-card p-5">
              <div className="mb-2 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-sm font-semibold">
                  {c.authorName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{c.authorName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString(pageLocale())}
                  </p>
                </div>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {c.content}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6">
        <h3 className="text-base font-semibold">{t("leaveComment")}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="authorName">{t("name")}</Label>
            <Input
              id="authorName"
              className="mt-1"
              value={form.authorName}
              onChange={(e) => setForm((p) => ({ ...p, authorName: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="authorEmail">{t("email")}</Label>
            <Input
              id="authorEmail"
              type="email"
              className="mt-1"
              value={form.authorEmail}
              onChange={(e) => setForm((p) => ({ ...p, authorEmail: e.target.value }))}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="content">{t("comment")}</Label>
          <Textarea
            id="content"
            className="mt-1"
            rows={4}
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            required
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {t("postComment")}
        </Button>
      </form>
    </div>
  );
}
