// The scheduler Vercel provides, for a self-hosted store: reads the cron
// table from vercel.json and calls each job on its schedule (UTC, like
// Vercel Cron) with `Authorization: Bearer $CRON_SECRET`.
import { readFileSync } from "node:fs";

const BASE = (process.env.APP_INTERNAL_URL || "http://app:3000").replace(/\/+$/, "");
const SECRET = process.env.CRON_SECRET || "";
const { crons = [] } = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8"));

function fieldMatches(expr, value, min) {
  return expr.split(",").some((part) => {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    let lo, hi;
    if (range === "*") { lo = min; hi = Infinity; }
    else if (range.includes("-")) { [lo, hi] = range.split("-").map(Number); }
    else { lo = Number(range); hi = stepRaw ? Infinity : lo; }
    return value >= lo && value <= hi && (value - lo) % step === 0;
  });
}

function due(schedule, d) {
  const [mi, h, dom, mon, dow] = schedule.trim().split(/\s+/);
  return fieldMatches(mi, d.getUTCMinutes(), 0) && fieldMatches(h, d.getUTCHours(), 0)
    && fieldMatches(dom, d.getUTCDate(), 1) && fieldMatches(mon, d.getUTCMonth() + 1, 1)
    && fieldMatches(dow, d.getUTCDay(), 0);
}

async function run(path) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
      signal: AbortSignal.timeout(5 * 60_000),
    });
    console.log(`${new Date().toISOString()} ${path} ${res.status} ${Date.now() - started}ms`);
  } catch (error) {
    console.log(`${new Date().toISOString()} ${path} FAILED ${error?.message ?? error}`);
  }
}

if (SECRET.length < 16) console.log("CRON_SECRET missing or short: every job will be refused.");
console.log(`cron-runner: ${crons.length} jobs against ${BASE}`);

let last = -1;
setInterval(() => {
  const now = new Date();
  const minute = Math.floor(now.getTime() / 60_000);
  if (minute === last) return;
  last = minute;
  for (const job of crons) if (due(job.schedule, now)) void run(job.path);
}, 5_000);
