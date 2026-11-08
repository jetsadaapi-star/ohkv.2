"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type FormState = {
  name: string;
  company: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  website: string;
};

const initialState: FormState = {
  name: "",
  company: "",
  phone: "",
  email: "",
  subject: "",
  message: "",
  website: "",
};

export function ContactForm() {
  const t = useTranslations("storeText.contactForm");
  const [form, setForm] = useState<FormState>(initialState);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t("sendFailed"));
      }

      setStatus("success");
      setMessage(t("sent"));
      setForm(initialState);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : t("sendFailedNow"),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={(event) => updateField("website", event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="contact-name" className="text-sm font-medium">
            {t("name")}
          </label>
          <Input
            id="contact-name"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder={t("namePlaceholder")}
            required
            minLength={2}
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="contact-company" className="text-sm font-medium">
            {t("company")}
          </label>
          <Input
            id="contact-company"
            value={form.company}
            onChange={(event) => updateField("company", event.target.value)}
            placeholder={t("company")}
            maxLength={100}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="contact-phone" className="text-sm font-medium">
            {t("phone")}
          </label>
          <Input
            id="contact-phone"
            type="tel"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder={t("phone")}
            maxLength={40}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="contact-email" className="text-sm font-medium">
            {t("email")}
          </label>
          <Input
            id="contact-email"
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder={t("email")}
            required
            maxLength={160}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="contact-subject" className="text-sm font-medium">
          {t("subject")}
        </label>
        <Input
          id="contact-subject"
          value={form.subject}
          onChange={(event) => updateField("subject", event.target.value)}
          placeholder={t("subject")}
          required
          minLength={3}
          maxLength={140}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="contact-message" className="text-sm font-medium">
          {t("message")}
        </label>
        <Textarea
          id="contact-message"
          value={form.message}
          onChange={(event) => updateField("message", event.target.value)}
          placeholder={t("messagePlaceholder")}
          required
          minLength={10}
          maxLength={2000}
          className="min-h-32 resize-y"
        />
      </div>

      {message ? (
        <p
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {status === "success" ? <CheckCircle2 className="h-4 w-4" /> : null}
          {message}
        </p>
      ) : null}

      <Button type="submit" className="h-11 w-full" disabled={status === "submitting"}>
        {status === "submitting" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {t("send")}
      </Button>
    </form>
  );
}
