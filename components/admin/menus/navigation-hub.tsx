"use client";

import Link from "@/components/language/link";
import { useTranslations } from "next-intl";
import { ArrowRight, LayoutTemplate, ListTree, Menu, PanelBottom } from "lucide-react";
import { VendorPageHeader } from "@/components/vendor/vendor-page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createTSafe } from "@/components/admin/online-store/t-safe";

/**
 * The Navigation landing: one card per navigation surface, each opening its
 * dedicated editor. Replaces the old generic menus table — the storefront
 * has exactly these three navigation surfaces, so a list you could add
 * arbitrary menus to only created rows nothing rendered.
 */
export function NavigationHub() {
  const tSafe = createTSafe(useTranslations());

  const surfaces = [
    {
      key: "header",
      href: "/admin/online-store/menus/header",
      icon: LayoutTemplate,
      tone: "bg-indigo-500",
      title: tSafe("admin.navigationHub.header.title", "Header"),
      description: tSafe(
        "admin.navigationHub.header.description",
        "Pick a header style and configure the announcement bar, menu links, search, and action buttons.",
      ),
    },
    {
      key: "footer",
      href: "/admin/online-store/menus/footer",
      icon: PanelBottom,
      tone: "bg-sky-500",
      title: tSafe("admin.navigationHub.footer.title", "Footer"),
      description: tSafe(
        "admin.navigationHub.footer.description",
        "Link columns, contact details, social links, and the payment strip.",
      ),
    },
    {
      key: "megaMenu",
      href: "/admin/online-store/menus/main-mega-menu/edit",
      icon: ListTree,
      tone: "bg-violet-500",
      title: tSafe("admin.navigationHub.megaMenu.title", "Mega Menu"),
      description: tSafe(
        "admin.navigationHub.megaMenu.description",
        "The All Categories rail: build category flyouts with links, images, and promos.",
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <VendorPageHeader
        icon={<Menu />}
        tone="indigo"
        title={tSafe("admin.navigationHub.title", "Navigation")}
        description={tSafe(
          "admin.navigationHub.description",
          "Choose a navigation surface to customize.",
        )}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {surfaces.map((surface) => (
          <Link key={surface.key} href={surface.href} className="group">
            <Card className="h-full gap-3 rounded-2xl shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-indigo-300 group-hover:shadow-md dark:group-hover:border-indigo-500/50">
              <CardHeader>
                <span className={`mb-2 grid size-11 place-items-center rounded-2xl text-white shadow-sm ${surface.tone}`}>
                  <surface.icon className="h-5 w-5" />
                </span>
                <CardTitle className="flex items-center justify-between gap-2 text-base font-bold">
                  {surface.title}
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180" />
                </CardTitle>
                <CardDescription>{surface.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
