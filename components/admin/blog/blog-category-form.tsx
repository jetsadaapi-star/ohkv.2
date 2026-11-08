"use client";

import * as z from "zod";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, FileText, Loader2, Settings2, Tags } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { useRouter } from "@/hooks/use-locale-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-notification";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { FormPageTitle, SectionTitle } from "@/components/admin/form-sections";
import { foldForSlug } from "@/lib/strings";

const buildSchema = (t: ReturnType<typeof useTranslations>) =>
  z.object({
    name: z.string().min(2, t("nameMin")),
    slug: z.string().optional(),
    description: z.string().max(500, t("descriptionMax")).optional(),
    isActive: z.boolean(),
    order: z.number().int().min(0),
  });

type FormData = z.infer<ReturnType<typeof buildSchema>>;

export function BlogCategoryForm({ categoryId }: { categoryId?: string }) {
  const t = useTranslations("admin.hc.blogCategoryForm");
  const schema = useMemo(() => buildSchema(t), [t]);
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = typeof params.locale === "string" ? params.locale : "en";
  const basePath = `/${locale}/admin/content/blog-categories`;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!!categoryId);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      isActive: true,
      order: 0,
    },
  });

  useEffect(() => {
    if (!categoryId) return;
    (async () => {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/blog-categories/${categoryId}`);
        const data = await res.json();
        if (data.success) {
          const c = data.data;
          form.reset({
            name: c.name,
            slug: c.slug || "",
            description: c.description || "",
            isActive: c.isActive,
            order: c.order || 0,
          });
        }
      } catch {
        toast.error(t("loadFailed"));
      } finally {
        setIsFetching(false);
      }
    })();
  }, [categoryId, form, t]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const url = categoryId
        ? `/api/blog-categories/${categoryId}`
        : "/api/blog-categories";
      const method = categoryId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(t("saved"));
        router.push(basePath);
      } else {
        toast.error(result.error || t("saveFailed"));
      }
    } catch {
      toast.error(t("errorOccurred"));
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 -mx-2 md:mx-0"
      >
        <AdminFormStickyHeader
          flushWithAdminShell
          title={
            <FormPageTitle icon={<Tags />} tone="amber">
              {categoryId ? t("titleEdit") : t("titleCreate")}
            </FormPageTitle>
          }
          actions={
            <>
              <Button
                type="submit"
                disabled={isLoading}
                size="sm"
                className="rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700"
              >
                {isLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {t("save")}
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                {t("back")}
              </Button>
            </>
          }
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="gap-2 rounded-2xl shadow-sm">
              <CardHeader>
                <SectionTitle icon={<FileText />} tone="amber">{t("details")}</SectionTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("nameLabel")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("urlHandle")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              foldForSlug(e.target.value)
                                .replace(/\s+/g, "-")
                                .replace(/[^a-z0-9-]/g, ""),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("description")}</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="gap-2 rounded-2xl shadow-sm">
              <CardHeader>
                <SectionTitle icon={<Settings2 />} tone="indigo">{t("settings")}</SectionTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <FormLabel className="m-0">{t("active")}</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("displayOrder")}</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={0}
                          step={1}
                          {...field}
                          whenEmpty={0}
                          normalize={Math.trunc}
                          onValueChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
