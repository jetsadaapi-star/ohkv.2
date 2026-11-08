"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Banknote, Download, Landmark, MonitorSmartphone, Receipt, RefreshCw, ShoppingBag, TrendingUp, UserRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrencyFormatter } from "@/providers/currency-provider";
import { cn } from "@/lib/utils";

/** Mirrors `POSReport` in lib/pos/pos-reports.ts (server-only). */
interface ReportRow {
  id: string;
  name: string;
  sales: number;
  items: number;
  gross: number;
  discounts: number;
  refunds: number;
  net: number;
  average: number;
  balanceDue: number;
}
interface ReportSession {
  id: string;
  number: string;
  status: "open" | "closed";
  counter: string;
  terminalId: string;
  openedBy: string;
  openedAt: string;
  closedBy?: string;
  closedAt?: string;
  openingFloat: number;
  salesCount: number;
  expectedCash: number;
  countedCash?: number;
  variance?: number;
}
interface Report {
  currency: string;
  period: { from: string; to: string };
  totals: Omit<ReportRow, "id" | "name">;
  byCashier: ReportRow[];
  byCounter: ReportRow[];
  byTender: Array<{ method: string; amount: number; count: number }>;
  sessions: ReportSession[];
  counters: Array<{ id: string; name: string }>;
}

type Preset = "today" | "yesterday" | "week" | "month" | "thisMonth";
const PRESETS: Preset[] = ["today", "yesterday", "week", "month", "thisMonth"];
const KNOWN_TENDERS = ["cash", "card", "bank", "manual", "store_credit"];

/** The period a preset names, in the viewer's own day. */
function periodFor(preset: Preset, now = new Date()): { from: Date; to: Date } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = 24 * 60 * 60 * 1000;
  switch (preset) {
    case "yesterday":
      return { from: new Date(startOfToday.getTime() - day), to: startOfToday };
    case "week":
      return { from: new Date(startOfToday.getTime() - 6 * day), to: now };
    case "month":
      return { from: new Date(startOfToday.getTime() - 29 * day), to: now };
    case "thisMonth":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    default:
      return { from: startOfToday, to: now };
  }
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Till reports: sales by cashier and by counter, money in by tender, and the
 * drawers opened in the period with how their counts came out. Shared by the
 * admin, staff and seller areas; the server decides what each one sees.
 */
const TENDER_TONES = [
  "from-emerald-50 ring-emerald-200 text-emerald-700 dark:from-emerald-500/10",
  "from-sky-50 ring-sky-200 text-sky-700 dark:from-sky-500/10",
  "from-violet-50 ring-violet-200 text-violet-700 dark:from-violet-500/10",
  "from-amber-50 ring-amber-200 text-amber-700 dark:from-amber-500/10",
  "from-rose-50 ring-rose-200 text-rose-700 dark:from-rose-500/10",
];

export function POSReports() {
  const t = useTranslations("pos.reports");
  const format = useFormatter();
  const [preset, setPreset] = React.useState<Preset>("today");
  const [locationId, setLocationId] = React.useState("");
  const [report, setReport] = React.useState<Report | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reloadKey, setReloadKey] = React.useState(0);
  const fp = useCurrencyFormatter(report?.currency);

  React.useEffect(() => {
    const controller = new AbortController();
    const { from, to } = periodFor(preset);
    const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    if (locationId) query.set("locationId", locationId);
    fetch(`/api/pos/reports?${query.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.message || t("loadFailed"));
        setReport(json.data as Report);
        setError(null);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("loadFailed"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [preset, locationId, reloadKey, t]);

  const reload = (next?: { preset?: Preset; locationId?: string }) => {
    setLoading(true);
    if (next?.preset) setPreset(next.preset);
    if (next?.locationId !== undefined) setLocationId(next.locationId);
    if (!next) setReloadKey((key) => key + 1);
  };

  const tenderName = (method: string) => (KNOWN_TENDERS.includes(method) ? t(`tenders.${method}`) : method);
  const when = (iso?: string) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : "—";

  const exportCsv = () => {
    if (!report) return;
    const lines: string[] = [];
    const header = [t("columns.name"), t("columns.sales"), t("columns.items"), t("columns.gross"), t("columns.discounts"), t("columns.refunds"), t("columns.net"), t("columns.average")];
    const rows = (title: string, data: ReportRow[], unnamed: string) => {
      lines.push(csvCell(title), header.map(csvCell).join(","));
      for (const row of data) {
        lines.push(
          [row.name || unnamed, row.sales, row.items, row.gross, row.discounts, row.refunds, row.net, row.average]
            .map(csvCell)
            .join(","),
        );
      }
      lines.push("");
    };
    rows(t("byCashier"), report.byCashier, t("unknownCashier"));
    rows(t("byCounter"), report.byCounter, t("noCounter"));
    lines.push(csvCell(t("byTender")), [t("columns.tender"), t("columns.payments"), t("columns.amount")].map(csvCell).join(","));
    for (const row of report.byTender) lines.push([tenderName(row.method), row.count, row.amount].map(csvCell).join(","));
    lines.push("");
    lines.push(
      csvCell(t("sessions")),
      [t("columns.session"), t("columns.counter"), t("columns.openedBy"), t("columns.opened"), t("columns.closed"), t("columns.expected"), t("columns.counted"), t("columns.variance")]
        .map(csvCell)
        .join(","),
    );
    for (const row of report.sessions) {
      lines.push(
        [row.number, row.counter, row.openedBy, row.openedAt, row.closedAt ?? "", row.expectedCash, row.countedCash ?? "", row.variance ?? ""]
          .map(csvCell)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pos-report-${report.period.from.slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const groupTable = (title: string, rows: ReportRow[], unnamed: string, icon: React.ReactNode, tone: string) => (
    <Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-sm">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2.5 text-base font-bold">
          <span className={cn("flex size-8 items-center justify-center rounded-xl text-white shadow-sm [&_svg]:size-4", tone)}>{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead className="text-right">{t("columns.sales")}</TableHead>
                <TableHead className="text-right">{t("columns.gross")}</TableHead>
                <TableHead className="text-right">{t("columns.refunds")}</TableHead>
                <TableHead className="text-right">{t("columns.net")}</TableHead>
                <TableHead className="text-right">{t("columns.average")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id || "none"}>
                  <TableCell>
                    <div className="flex max-w-[14rem] items-center gap-2">
                      {/* Rank: the best seller of the period reads first. */}
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                          index === 0 ? "bg-amber-400 text-white" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="truncate font-medium">{row.name || unnamed}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.sales}</TableCell>
                  <TableCell className="text-right tabular-nums">{fp(row.gross)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.refunds ? fp(row.refunds) : "—"}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-700 tabular-nums dark:text-emerald-300">{fp(row.net)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fp(row.average)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            <MonitorSmartphone className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            value={preset}
            onChange={(event) => reload({ preset: event.target.value as Preset })}
            aria-label={t("period")}
          >
            {PRESETS.map((value) => (
              <option key={value} value={value}>
                {t(`presets.${value}`)}
              </option>
            ))}
          </NativeSelect>
          {report && report.counters.length > 1 ? (
            <NativeSelect
              value={locationId}
              onChange={(event) => reload({ locationId: event.target.value })}
              aria-label={t("counter")}
            >
              <option value="">{t("allCounters")}</option>
              {report.counters.map((counter) => (
                <option key={counter.id} value={counter.id}>
                  {counter.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => reload()} aria-label={t("refresh")}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={exportCsv} disabled={!report}>
            <Download className="mr-1.5 h-4 w-4" />
            {t("export")}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!report ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: t("stats.sales"), value: String(report.totals.sales), hint: t("stats.items", { count: report.totals.items }), icon: <ShoppingBag />, tone: "from-sky-50 ring-sky-200 text-sky-700 dark:from-sky-500/10", iconTone: "bg-sky-500" },
              { label: t("stats.gross"), value: fp(report.totals.gross), hint: t("stats.discounts", { amount: fp(report.totals.discounts) }), icon: <Receipt />, tone: "from-violet-50 ring-violet-200 text-violet-700 dark:from-violet-500/10", iconTone: "bg-violet-500" },
              { label: t("stats.net"), value: fp(report.totals.net), hint: t("stats.refunds", { amount: fp(report.totals.refunds) }), icon: <TrendingUp />, tone: "from-emerald-50 ring-emerald-200 text-emerald-700 dark:from-emerald-500/10", iconTone: "bg-emerald-500" },
              {
                label: t("stats.average"),
                value: fp(report.totals.average),
                hint: report.totals.balanceDue > 0 ? t("stats.balanceDue", { amount: fp(report.totals.balanceDue) }) : "",
                icon: <Wallet />,
                tone: "from-amber-50 ring-amber-200 text-amber-700 dark:from-amber-500/10",
                iconTone: "bg-amber-500",
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className={cn("flex min-w-0 flex-col gap-2 rounded-2xl bg-linear-to-br to-white p-4 ring-1 ring-inset dark:to-card", tile.tone)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold opacity-90">{tile.label}</p>
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm [&_svg]:size-4", tile.iconTone)}>
                    {tile.icon}
                  </span>
                </div>
                <p className="truncate text-2xl font-extrabold tracking-tight text-foreground tabular-nums" title={tile.value}>{tile.value}</p>
                <p className="h-4 truncate text-xs text-muted-foreground">{tile.hint}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {groupTable(t("byCashier"), report.byCashier, t("unknownCashier"), <UserRound />, "bg-sky-500")}
            {groupTable(t("byCounter"), report.byCounter, t("noCounter"), <MonitorSmartphone />, "bg-violet-500")}
          </div>

          <Card className="gap-0 rounded-2xl py-0 shadow-sm">
            <CardHeader className="border-b py-4">
              <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm [&_svg]:size-4"><Banknote /></span>
                {t("byTender")}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              {report.byTender.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {report.byTender.map((row, index) => (
                    <div
                      key={row.method}
                      className={cn("rounded-2xl bg-linear-to-br to-white p-3 ring-1 ring-inset dark:to-card", TENDER_TONES[index % TENDER_TONES.length])}
                    >
                      <p className="text-xs text-muted-foreground">{tenderName(row.method)}</p>
                      <p className="text-lg font-extrabold text-foreground tabular-nums">{fp(row.amount)}</p>
                      <p className="text-xs text-muted-foreground">{t("payments", { count: row.count })}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-sm">
            <CardHeader className="border-b py-4">
              <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                <span className="flex size-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm [&_svg]:size-4"><Landmark /></span>
                {t("sessions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {report.sessions.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">{t("noSessions")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("columns.session")}</TableHead>
                      <TableHead>{t("columns.counter")}</TableHead>
                      <TableHead>{t("columns.opened")}</TableHead>
                      <TableHead>{t("columns.closed")}</TableHead>
                      <TableHead className="text-right">{t("columns.expected")}</TableHead>
                      <TableHead className="text-right">{t("columns.counted")}</TableHead>
                      <TableHead className="text-right">{t("columns.variance")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.sessions.map((row) => (
                      <TableRow
                        key={row.id}
                        className={cn(
                          // A drawer still open, or one that counted short, reads at a glance.
                          row.status === "open" && "bg-emerald-50/50 dark:bg-emerald-500/5 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-emerald-400",
                          row.status !== "open" && row.variance !== undefined && row.variance < 0 && "bg-rose-50/50 dark:bg-rose-500/5 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-rose-400",
                          row.status !== "open" && row.variance !== undefined && row.variance > 0 && "bg-amber-50/50 dark:bg-amber-500/5 [&>td:first-child]:border-s-4 [&>td:first-child]:border-s-amber-400",
                        )}
                      >
                        <TableCell className="font-mono text-xs">{row.number}</TableCell>
                        <TableCell>
                          <div className="max-w-[10rem] truncate">{row.counter || row.terminalId}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">{when(row.openedAt)}</div>
                          <div className="max-w-[10rem] truncate text-xs text-muted-foreground">{row.openedBy}</div>
                        </TableCell>
                        <TableCell>
                          {row.status === "open" ? (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              {t("open")}
                            </span>
                          ) : (
                            <>
                              <div className="text-xs">{when(row.closedAt)}</div>
                              <div className="max-w-[10rem] truncate text-xs text-muted-foreground">{row.closedBy}</div>
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fp(row.expectedCash)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.countedCash === undefined ? "—" : fp(row.countedCash)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            row.variance !== undefined && row.variance < 0 && "text-rose-600",
                            row.variance !== undefined && row.variance > 0 && "text-amber-600",
                          )}
                        >
                          {row.variance === undefined ? "—" : fp(row.variance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
