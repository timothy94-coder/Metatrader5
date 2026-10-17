"use client";

/**
 * MetaLuna — a FICTIONAL demo trading-app screen, built as a film/TV prop.
 *
 * Everything lives in this one file (components, simulated data, styles).
 * Use: Next.js App Router -> save as app/page.tsx. No extra packages needed.
 *
 * - Not connected to any broker. No real trading, no deposits.
 * - All instruments (LNRGLD, ORBUSD ...) and all numbers are invented demo data.
 * - The "DEMO · SIMULATED" tag is permanent and cannot be switched off.
 *
 * Keys: 1-5 switch tabs · F full screen · B toggle phone frame.
 * Settings tab edits the demo data; it is saved in this browser's localStorage.
 */
import * as React from "react";
import { createContext, type CSSProperties, type ReactNode, type SVGProps, useCallback, useContext, useEffect, useMemo, useRef, useState, type JSX } from "react";

/* ===== types.ts ===== */
type Side = "buy" | "sell";
type Tab = "quotes" | "chart" | "trade" | "history" | "settings";
type TfKey = "M1" | "M5" | "M15" | "H1" | "H4" | "D1";

/** A fictional instrument. Prices are whatever the demo data says they are. */
interface SymbolDef {
  code: string;
  name: string;
  price: number; // bid
  dayOpen: number;
  digits: number;
  spread: number; // ask - bid, in price units
  contract: number; // account currency per 1.0 price move per 1.0 lot
  margin: number; // margin required per 1.0 lot
}

interface Position {
  id: number;
  sym: string;
  side: Side;
  lots: number;
  open: number;
  openedAt: number;
}

interface ClosedTrade {
  id: number;
  sym: string;
  side: Side;
  lots: number;
  open: number;
  close: number;
  openedAt: number;
  closedAt: number;
  profit: number;
}

interface Labels {
  balance: string;
  equity: string;
  margin: string;
  freeMargin: string;
  marginLevel: string;
  positions: string;
  quotes: string;
  chart: string;
  trade: string;
  history: string;
  settings: string;
}

interface Theme {
  bgTop: string;
  bgBottom: string;
  accent: string;
  text: string;
  muted: string;
  profit: string;
  loss: string;
  buy: string;
  sell: string;
}

interface Demo {
  version: 1;
  tab: Tab;
  chartSym: string;
  chartTf: TfKey;
  accountName: string;
  accountId: string;
  server: string;
  leverage: string;
  balance: number;
  statusTime: string; // "" = live clock
  battery: number;
  showFrame: boolean;
  labels: Labels;
  theme: Theme;
  symbols: SymbolDef[];
  positions: Position[];
  history: ClosedTrade[];
  sim: { live: boolean; volatility: number };
  /** AutoTrade settings (saved). Whether it is running is NOT saved: a refresh always starts stopped. */
  auto: { intervalSec: number; maxOpen: number; holdSec: number; stakeUsd: number };
  nextId: number;
}

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

/* ===== format.ts ===== */
const NBSP = "\u00A0";

function round(n: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round((n + Number.EPSILON * Math.sign(n)) * f) / f;
}

/** 14926.2 -> "14 926.20" (non-breaking space grouping). */
function fmtMoney(n: number, d = 2): string {
  const neg = n < 0 && round(n, d) !== 0;
  const [i, f] = Math.abs(n).toFixed(d).split(".");
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return (neg ? "-" : "") + g + (f ? "." + f : "");
}

function fmtPrice(n: number, digits: number): string {
  return n.toFixed(digits);
}

function fmtSigned(n: number, d = 2): string {
  return (n > 0 ? "+" : "") + fmtMoney(n, d);
}

const pad = (n: number) => String(n).padStart(2, "0");

function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtShortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/* ===== calc.ts ===== */
const bidOf = (s: SymbolDef) => s.price;
const askOf = (s: SymbolDef) => round(s.price + s.spread, s.digits);

/** Price a position would close at: buys close at bid, sells close at ask. */
function closePrice(p: Position, s: SymbolDef): number {
  return p.side === "buy" ? bidOf(s) : askOf(s);
}

/** Any NaN/Infinity (from odd inputs) becomes 0 so the screen never shows "NaN". */
const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

function positionProfit(
  p?: Position,
  s?: SymbolDef
): number {
  return Math.round(
    ((Math.random() * 20) - 10) * 100
  ) / 100;
}

interface AccountFigures {
  balance: number;
  profit: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
}

/** Every number on the Trade screen is derived from the demo data here, so they always agree. */
function accountFigures(d: Demo): AccountFigures {
  const bySym = new Map(d.symbols.map((s) => [s.code, s]));
  let profit = 0;
  let margin = 0;
  for (const p of d.positions) {
    const s = bySym.get(p.sym);
    profit = round(profit + positionProfit(p, s), 2);
    margin = round(margin + p.lots * (s?.margin ?? 0), 2);
  }
  const equity = finite(round(d.balance + profit, 2));
  const freeMargin = finite(round(equity - margin, 2));
  const marginLevel = margin > 0 ? finite(round((equity / margin) * 100, 2)) : 0;
  return { balance: finite(d.balance), profit: finite(profit), equity, margin: finite(margin), freeMargin, marginLevel };
}

/* ===== data.ts ===== */
/* ---------- deterministic randomness (so charts/history look the same on every reload) ---------- */

function mulberry32(seed: number) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gauss(r: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ---------- themes ---------- */

const THEMES: Record<string, Theme> = {
  Lavender: {
    bgTop: "#f6eef5",
    bgBottom: "#e5dff0",
    accent: "#2a57c8",
    text: "#1d1c26",
    muted: "#6e6b7b",
    profit: "#2a57c8",
    loss: "#d13c47",
    buy: "#2a57c8",
    sell: "#d13c47",
  },
  Rose: {
    bgTop: "#fcf0f2",
    bgBottom: "#efdde7",
    accent: "#3b5bc0",
    text: "#231c22",
    muted: "#76697a",
    profit: "#3b5bc0",
    loss: "#c8344a",
    buy: "#3b5bc0",
    sell: "#c8344a",
  },
  Mist: {
    bgTop: "#eff2f9",
    bgBottom: "#dce3f1",
    accent: "#1f5fbf",
    text: "#171c26",
    muted: "#5f6b80",
    profit: "#1f5fbf",
    loss: "#cf3b3b",
    buy: "#1f5fbf",
    sell: "#cf3b3b",
  },
  Night: {
    bgTop: "#0a0a0d",
    bgBottom: "#030304",
    accent: "#6fa0ff",
    text: "#f3f4f9",
    muted: "#8a8a99",
    profit: "#6fa0ff",
    loss: "#ff6b78",
    buy: "#6fa0ff",
    sell: "#ff6b78",
  },
};

const DEFAULT_LABELS: Labels = {
  balance: "Balance:",
  equity: "Equity:",
  margin: "Margin:",
  freeMargin: "Free Margin:",
  marginLevel: "Margin Level (%):",
  positions: "Positions",
  quotes: "Quotes",
  chart: "Chart",
  trade: "Trade",
  history: "History",
  settings: "Settings",
};

/* ---------- fictional instruments (not tied to any real market quote) ---------- */

const DEFAULT_SYMBOLS: SymbolDef[] = [
  { code: "EURUSD", name: "Euro / US Dollar", price: 1.08761, dayOpen: 1.08542, digits: 5, spread: 0.00012, contract: 100000, margin: 420 },
 
];

function fixSymbolPrices(list: SymbolDef[]): SymbolDef[] {
  return list.map((s) => ({ ...s, price: round(s.price, s.digits), dayOpen: round(s.dayOpen, s.digits) }));
}

const HOUR = 3600_000;

function makeDefaultPositions(now: number): Position[] {
  const mk = (id: number, sym: string, side: "buy" | "sell", lots: number, open: number, hoursAgo: number): Position => ({
    id,
    sym,
    side,
    lots,
    open,
    openedAt: now - hoursAgo * HOUR,
  });
  return [
  ];
}

function generateHistory(symbols: SymbolDef[], count: number, seed: number, now: number, startId = 1047000): ClosedTrade[] {
  const rnd = mulberry32(seed);
  const lotChoices = [0.05, 0.1, 0.1, 0.2, 0.3, 0.5];
  const out: ClosedTrade[] = [];
  let t = now - (0.8 + rnd() * 1.5) * HOUR;
  for (let i = 0; i < count; i++) {
    const s = symbols[Math.floor(rnd() * symbols.length)];
const side = "buy";
    const lots = lotChoices[Math.floor(rnd() * lotChoices.length)];
    const open = round(s.dayOpen * (1 + (rnd() - 0.5) * 0.012), s.digits);
const move = Math.abs(
  gauss(rnd) * 0.0032 * open + 0.0007 * open
);    const close = round(side === "buy" ? open + move : open - move, s.digits);
    const closedAt = Math.round(t);
    const openedAt = Math.round(t - (0.4 + rnd() * 9) * HOUR);
    const diff = side === "buy" ? close - open : open - close;
const profit = Math.abs(
  round(diff * lots * s.contract, 2)
);    out.push({ id: startId - i * 3, sym: s.code, side, lots, open, close, openedAt, closedAt, profit });
    t -= (1.1 + rnd() * 9) * HOUR;
  }
  return out;
}

function makeDefaults(now = Date.now()): Demo {
  const symbols = fixSymbolPrices(DEFAULT_SYMBOLS);
  return {
    version: 1,
    tab: "trade",
    chartSym: symbols[0].code,
    chartTf: "H1",
    accountName: "Luna Demo Account",
    accountId: "LUNA-5550142",
    server: "MetaLuna-Demo",
    leverage: "1:100",
    balance: 3250.0,
    statusTime: "14:36",
    battery: 78,
    showFrame: true,
    labels: { ...DEFAULT_LABELS },
    theme: { ...THEMES.Lavender },
    symbols,
    positions: makeDefaultPositions(now),
    history: generateHistory(symbols, 16, 7, now),
    sim: { live: true, volatility: 1 },
auto: {
  intervalSec: 1,
  maxOpen: 20,
  holdSec: 4,
  stakeUsd: 50
},    nextId: 1048207,
  };
}

/* ---------- live price simulation ---------- */

function tickSymbols(symbols: SymbolDef[], vol: number): SymbolDef[] {
  return symbols.map((s) => {
    const step = s.price * 0.00006 * vol;
    let p = s.price + gauss(Math.random) * step + (s.dayOpen - s.price) * 0.002;
    if (p <= 0) p = s.price;
    return { ...s, price: round(p, s.digits) };
  });
}

/* ---------- simulated candles ---------- */

const TF: Record<TfKey, { min: number; vol: number }> = {
  M1: { min: 1, vol: 0.00035 },
  M5: { min: 5, vol: 0.0007 },
  M15: { min: 15, vol: 0.0011 },
  H1: { min: 60, vol: 0.002 },
  H4: { min: 240, vol: 0.0035 },
  D1: { min: 1440, vol: 0.007 },
};

/**
 * History is anchored to a fixed price (the price when the chart was built) so it stays stable
 * while prices tick; only the final candle follows the live price.
 */
function buildHistoryCandles(s: SymbolDef, tf: TfKey, n: number, nowMs: number, anchor: number = s.dayOpen): Candle[] {
  const rnd = mulberry32(hashStr(s.code + tf));
  const vol = TF[tf].vol * anchor;
  const stepMs = TF[tf].min * 60_000;
  const last = Math.floor(nowMs / stepMs) * stepMs;
  const raw: number[] = [0];
  for (let i = 1; i < n - 1; i++) raw.push(raw[i - 1] + gauss(rnd) * vol);
  const shift = anchor - raw[raw.length - 1];
  const closes = raw.map((v) => v + shift);
  const out: Candle[] = [];
  for (let i = 0; i < n - 1; i++) {
    const c = closes[i];
    const o = i === 0 ? c - gauss(rnd) * vol : closes[i - 1];
    const h = Math.max(o, c) + Math.abs(gauss(rnd)) * vol * 0.55;
    const l = Math.min(o, c) - Math.abs(gauss(rnd)) * vol * 0.55;
    out.push({
      t: last - (n - 1 - i) * stepMs,
      o: round(o, s.digits),
      h: round(h, s.digits),
      l: round(l, s.digits),
      c: round(c, s.digits),
    });
  }
  return out;
}

function liveCandle(s: SymbolDef, tf: TfKey, prevClose: number, nowMs: number): Candle {
  const stepMs = TF[tf].min * 60_000;
  const rnd = mulberry32(hashStr(s.code + tf + "live"));
  const vol = TF[tf].vol * s.dayOpen;
  const o = prevClose;
  const c = s.price;
  const h = Math.max(o, c) + rnd() * vol * 0.35;
  const l = Math.min(o, c) - rnd() * vol * 0.35;
  return {
    t: Math.floor(nowMs / stepMs) * stepMs,
    o,
    h: round(h, s.digits),
    l: round(l, s.digits),
    c,
  };
}

/* ===== sanitize.ts ===== */
/**
 * Turns ANY value (saved localStorage, pasted JSON) into a safe Demo object.
 * Invalid pieces are dropped or replaced by defaults; nothing here can throw.
 */

const VALID_TABS: Tab[] = ["quotes", "chart", "trade", "history", "settings"];
const HEX6 = /^#[0-9a-fA-F]{6}$/;

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Finite number clamped to [min, max]; `fb` (the fallback) when it isn't a usable number. */
function numIn(v: unknown, min: number, max: number, fb: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
}

function strIn(v: unknown, fb: string, max = 60): string {
  return typeof v === "string" ? v.slice(0, max) : fb;
}

function sanitizeDemo(raw: unknown, now: number = Date.now()): Demo {
  const d = makeDefaults(now);
  if (!isRec(raw)) return d;

  /* instruments */
  const symbols: SymbolDef[] = [];
  if (Array.isArray(raw.symbols)) {
    const seen = new Set<string>();
    for (const s of raw.symbols.slice(0, 40)) {
      if (!isRec(s)) continue;
      const code = strIn(s.code, "", 12).trim();
      if (!code || seen.has(code)) continue;
      const price = numIn(s.price, 0, 1e9, NaN);
      if (!(price > 0)) continue;
      const digits = Math.round(numIn(s.digits, 0, 8, 2));
      const open = numIn(s.dayOpen, 0, 1e9, price);
      seen.add(code);
      symbols.push({
        code,
        name: strIn(s.name, code, 40),
        price: round(price, digits),
        dayOpen: open > 0 ? round(open, digits) : round(price, digits),
        digits,
        spread: numIn(s.spread, 0, 1e6, 0),
        contract: numIn(s.contract, 0.000001, 1e9, 1),
        margin: numIn(s.margin, 0, 1e9, 0),
      });
    }
  }
  const finalSymbols = symbols.length ? symbols : d.symbols;
  const codes = new Set(finalSymbols.map((s) => s.code));

  /* open positions (must reference a known instrument) */
  const rawPos = Array.isArray(raw.positions) ? raw.positions : d.positions;
  const positions: Position[] = [];
  const ids = new Set<number>();
  let maxId = 0;
  for (const p of rawPos.slice(0, 200)) {
    if (!isRec(p) || typeof p.sym !== "string" || !codes.has(p.sym)) continue;
    if (p.side !== "buy" && p.side !== "sell") continue;
    const lots = numIn(p.lots, -1e9, 1000, NaN);
    const open = numIn(p.open, 0, 1e9, NaN);
    if (!(lots >= 0.01) || !(open > 0)) continue; // zero/negative volume is invalid: drop, don't "fix"

    let id = Math.round(numIn(p.id, 1, 9e15, NaN));
    if (!Number.isFinite(id) || ids.has(id)) id = Math.max(maxId, 1_000_000) + 1;
    ids.add(id);
    maxId = Math.max(maxId, id);
    positions.push({ id, sym: p.sym, side: p.side, lots, open, openedAt: numIn(p.openedAt, 0, 4e12, now) });
  }

  /* closed trades */
  const rawHist = Array.isArray(raw.history) ? raw.history : d.history;
  const history: ClosedTrade[] = [];
  for (const t of rawHist.slice(0, 500)) {
    if (!isRec(t) || typeof t.sym !== "string") continue;
    if (t.side !== "buy" && t.side !== "sell") continue;
    const lots = numIn(t.lots, -1e9, 1000, NaN);
    const open = numIn(t.open, 0, 1e9, NaN);
    const close = numIn(t.close, 0, 1e9, NaN);
    const profit = numIn(t.profit, -1e9, 1e9, NaN);
    if (!(lots >= 0.01) || !(open > 0) || !(close > 0) || !Number.isFinite(profit)) continue;
    const id = Math.round(numIn(t.id, 1, 9e15, 1));
    maxId = Math.max(maxId, id);
    history.push({
      id,
      sym: t.sym.slice(0, 12),
      side: t.side,
      lots,
      open,
      close,
      openedAt: numIn(t.openedAt, 0, 4e12, now),
      closedAt: numIn(t.closedAt, 0, 4e12, now),
      profit,
    });
  }

  /* labels + theme */
  const labels = { ...d.labels };
  const rl = isRec(raw.labels) ? raw.labels : {};
  for (const k of Object.keys(labels) as (keyof typeof labels)[]) labels[k] = strIn(rl[k], labels[k], 40);
  const theme: Theme = { ...d.theme };
  const rt = isRec(raw.theme) ? raw.theme : {};
  for (const k of Object.keys(theme) as (keyof Theme)[]) {
    const c = rt[k];
    if (typeof c === "string" && HEX6.test(c)) theme[k] = c;
  }

  const rs = isRec(raw.sim) ? raw.sim : {};
  const ra = isRec(raw.auto) ? raw.auto : {};
  const tab = VALID_TABS.includes(raw.tab as Tab) ? (raw.tab as Tab) : d.tab;
  const tf = Object.keys(TF).includes(raw.chartTf as string) ? (raw.chartTf as TfKey) : d.chartTf;

  return {
    version: 1,
    tab,
    chartSym: typeof raw.chartSym === "string" && codes.has(raw.chartSym) ? raw.chartSym : finalSymbols[0].code,
    chartTf: tf,
    accountName: strIn(raw.accountName, d.accountName),
    accountId: strIn(raw.accountId, d.accountId),
    server: strIn(raw.server, d.server),
    leverage: strIn(raw.leverage, d.leverage, 12),
    balance: numIn(raw.balance, -1e9, 1e9, d.balance),
    statusTime: strIn(raw.statusTime, d.statusTime, 8),
    battery: Math.round(numIn(raw.battery, 0, 100, d.battery)),
    showFrame: typeof raw.showFrame === "boolean" ? raw.showFrame : d.showFrame,
    labels,
    theme,
    symbols: finalSymbols,
    positions,
    history,
    sim: {
      live: typeof rs.live === "boolean" ? rs.live : d.sim.live,
      volatility: numIn(rs.volatility, 0.2, 4, d.sim.volatility),
    },
    auto: {
      intervalSec: numIn(ra.intervalSec, 1, 120, d.auto.intervalSec),
maxOpen: Math.round(numIn(ra.maxOpen, 1, 50, d.auto.maxOpen)),
holdSec: numIn(ra.holdSec, 1, 300, d.auto.holdSec),    
     stakeUsd: numIn(ra.stakeUsd, 1, 500, d.auto.stakeUsd),
    },
    nextId: Math.max(Math.round(numIn(raw.nextId, 1, 9e15, d.nextId)), maxId + 1),
  };
}

/* ===== store.ts ===== */
const KEY = "metaluna.demo.v1";

/** Saved and imported data both go through the same validator, so bad values can't reach the UI. */
const mergeDefaults = (p: unknown): Demo => sanitizeDemo(p);

function load(): Demo {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return mergeDefaults(JSON.parse(raw));
  } catch {
    /* storage blocked or corrupt: fall back to defaults */
  }
  return makeDefaults();
}

function save(d: Demo) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

function closeOne(d: Demo, id: number): Demo {
  const p = d.positions.find((x) => x.id === id);
  if (!p) return d;
  const s = d.symbols.find((x) => x.code === p.sym);
  const rest = d.positions.filter((x) => x.id !== id);
  if (!s) return { ...d, positions: rest };
  const profit = positionProfit(p, s);
  const trade: ClosedTrade = {
    id: p.id,
    sym: p.sym,
    side: p.side,
    lots: p.lots,
    open: p.open,
    close: closePrice(p, s),
    openedAt: p.openedAt,
    closedAt: Date.now(),
    profit,
  };
  // Realised profit moves into the balance so every figure stays consistent.
  return { ...d, balance: round(d.balance + profit, 2), positions: rest, history: [trade, ...d.history] };
}

type AutoStatus = "stopped" | "running" | "paused";
interface AutoMeta {
  tp: number;
  sl: number;
  expires: number;
  outcome: "win" | "loss";
}
const AUTO_LOTS = [0.05, 0.1, 0.1, 0.2, 0.3];

function useDemoStore() {
  const [demo, setDemo] = useState<Demo>(load);
  const ref = useRef(demo);
  ref.current = demo;

  // AutoTrade runtime state lives only in memory: it is never saved, so a refresh never restarts it.
  const [autoStatus, setAutoStatus] = useState<AutoStatus>("stopped");
  const statusRef = useRef<AutoStatus>("stopped");
  const autoMeta = useRef(new Map<number, AutoMeta>());
  const nextOrderAt = useRef(0);
  const pausedAt = useRef(0);
  const cyclePauseUntil = useRef(0);
  const cycleCloseAt = useRef(0);
  const cycleSide = useRef<Side>("buy");

  // persist (debounced) + flush when the page is hidden/reloaded
  useEffect(() => {
    const t = setTimeout(() => save(demo), 250);
    return () => clearTimeout(t);
  }, [demo]);
  useEffect(() => {
    const flush = () => save(ref.current);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);
  // simulated ticks
  useEffect(() => {
    if (!demo.sim.live) return;
    const id = setInterval(() => setDemo((d) => ({ ...d, symbols: tickSymbols(d.symbols, d.sim.volatility) })), 900);
    return () => clearInterval(id);
  }, [demo.sim.live]);

  // AutoTrade loop: exactly one interval exists while running, and it is removed on pause/stop/unmount.
  useEffect(() => {
    if (autoStatus !== "running") return;
    const tick = () => {
      if (statusRef.current !== "running") return;
      const d = ref.current;
      const now = Date.now();
      const bySym = new Map(d.symbols.map((s) => [s.code, s]));
      const alive = new Set(d.positions.map((p) => p.id));
      for (const id of [...autoMeta.current.keys()]) if (!alive.has(id)) autoMeta.current.delete(id); // closed by hand

      // 1) close anything that hit take-profit, stop-loss or its hold time (closeOne ignores ids already closed)
      let open = 0;
      let closedNow = false;
      for (const p of d.positions) {
        const m = autoMeta.current.get(p.id);
        if (!m) continue;
if (now >= m.expires) {
  autoMeta.current.delete(p.id);

  setDemo(prev => {
    const pos = prev.positions.find(x => x.id === p.id);

    if (!pos) return prev;

const profit = Math.round(
  (Math.random() * 16 + 2) * 100
) / 100;
    const trade = {
      id: pos.id,
      sym: pos.sym,
      side: pos.side,
      lots: pos.lots,
      open: pos.open,
      close: pos.open,
      openedAt: pos.openedAt,
      closedAt: Date.now(),
      profit
    };

  const remaining =
  prev.positions.filter(x => x.id !== pos.id);

if (remaining.length === 0) {
  cyclePauseUntil.current =
    Date.now() + 1000; // 10 seconds

  nextOrderAt.current =
    Date.now() + 200;
}

return {
  ...prev,
  balance: round(prev.balance + profit, 2),
  positions: remaining,
  history: [trade, ...prev.history],
  nextId: remaining.length === 0
    ? Date.now()
    : prev.nextId
};
  });

  closedNow = true;
}else open++;
      }

      // 2) maybe open a new one, after a randomised wait
      if (d.balance <= 0) {
        statusRef.current = "stopped";
        setAutoStatus("stopped");
        return;
      }
if (now < nextOrderAt.current) return;


if (now < cyclePauseUntil.current)
  return;


nextOrderAt.current =
  now + d.auto.intervalSec * 1000;

  const usable = d.symbols.filter((s) => s.price > 0 && s.spread >= 0 && Number.isFinite(s.price));
  
 if (d.positions.length >= d.auto.maxOpen) {

  const ids = d.positions.map(p => p.id);

  ids.forEach(id => {
    const meta = autoMeta.current.get(id);

    if (meta) {
      meta.expires = Date.now();
    }
  });

  return;
}
      if (!usable.length) return;
const s = usable.find(x => x.code === "EURUSD");
if (!s) return;      const lots = AUTO_LOTS[Math.floor(Math.random() * AUTO_LOTS.length)];
const id =
  Date.now() + Math.floor(Math.random() * 1000);

if (d.positions.length === 0) {
  cycleSide.current =
    Math.random() > 0.5
      ? "buy"
      : "sell";

  cycleCloseAt.current =
    now + d.auto.holdSec * 1000;
}

const side: Side = cycleSide.current;

const pos: Position = {
  id,
  sym: s.code,
  side,
  lots,
  open:
    side === "buy"
      ? askOf(s)
      : bidOf(s),
  openedAt: now
};

const stake = d.auto.stakeUsd;

autoMeta.current.set(id, {
  tp: stake,
  sl: 0,
  expires: cycleCloseAt.current,
  outcome: "win"
});

      setDemo((prev) =>
        prev.positions.some((x) => x.id === id) ? prev : { ...prev, nextId: prev.nextId, positions: [...prev.positions, pos] },
      );
    };
const timer = setInterval(tick, 25);   return () => clearInterval(timer);
  }, [autoStatus]);

  const actions = useMemo(
    () => ({
      patch: (p: Partial<Demo>) => setDemo((d) => ({ ...d, ...p })),
      setLabel: (k: keyof Labels, v: string) => setDemo((d) => ({ ...d, labels: { ...d.labels, [k]: v } })),
      setTheme: (p: Partial<Theme>) => setDemo((d) => ({ ...d, theme: { ...d.theme, ...p } })),
      setSim: (p: Partial<Demo["sim"]>) => setDemo((d) => ({ ...d, sim: { ...d.sim, ...p } })),
      updateSymbol: (code: string, p: Partial<SymbolDef>) =>
        setDemo((d) => ({ ...d, symbols: d.symbols.map((s) => (s.code === code ? { ...s, ...p } : s)) })),
      updatePosition: (id: number, p: Partial<Position>) =>
        setDemo((d) => ({ ...d, positions: d.positions.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      removePosition: (id: number) => setDemo((d) => ({ ...d, positions: d.positions.filter((x) => x.id !== id) })),
      addPosition: () =>
        setDemo((d) => {
          const s = d.symbols[0];
          const p: Position = { id: d.nextId, sym: s.code, side: "buy", lots: 0.1, open: askOf(s), openedAt: Date.now() };
          return { ...d, nextId: d.nextId + 1, positions: [...d.positions, p] };
        }),
      /** Simulated order: only adds a row to the local demo data. */
      openOrder: (code: string, side: Side, lots: number) =>
        setDemo((d) => {
          const s = d.symbols.find((x) => x.code === code);
          if (!s) return d;
          const p: Position = {
            id: d.nextId,
            sym: code,
            side,
            lots: round(lots, 2),
            open: side === "buy" ? askOf(s) : bidOf(s),
            openedAt: Date.now(),
          };
          return { ...d, nextId: d.nextId + 1, positions: [...d.positions, p] };
        }),
      /** Returns a message when it can't start, otherwise null. Repeated clicks are ignored. */
      startAuto: (): string | null => {
        if (statusRef.current === "running") return null;
        const d = ref.current;
        if (!d.symbols.length) return "No instruments available";
        if (!(d.balance > 0)) return "Balance must be above 0 to start";
        statusRef.current = "running";
        autoMeta.current.clear();
nextOrderAt.current = Date.now();        setDemo((prev) => ({ ...prev, sim: { ...prev.sim, live: true } })); // prices must move for it to work
        setAutoStatus("running");
        return null;
      },
      pauseAuto: () => {
        if (statusRef.current !== "running") return;
        statusRef.current = "paused";
        pausedAt.current = Date.now();
        setAutoStatus("paused");
      },
      resumeAuto: () => {
        if (statusRef.current !== "paused") return;
        const shift = Date.now() - pausedAt.current;
        for (const m of autoMeta.current.values()) m.expires += shift; // paused time doesn't count towards hold time
        nextOrderAt.current += shift;
        statusRef.current = "running";
        setAutoStatus("running");
      },
      stopAuto: () => {
        statusRef.current = "stopped";
        autoMeta.current.clear(); // any still-open trades become ordinary positions
        setAutoStatus("stopped");
      },
      closePosition: (id: number) => setDemo((d) => closeOne(d, id)),
      closeAll: () => setDemo((d) => d.positions.reduce((acc, p) => closeOne(acc, p.id), d)),
      regenHistory: (n: number) =>
        setDemo((d) => ({ ...d, history: generateHistory(d.symbols, n, Math.floor(Math.random() * 1e6), Date.now()) })),
      clearHistory: () => setDemo((d) => ({ ...d, history: [] })),
      reset: () => setDemo(makeDefaults()),
      importJson: (text: string): boolean => {
        try {
          const parsed = JSON.parse(text);
          if (!isRec(parsed)) return false;
          // Imported data never changes the look of the app: the current colours are kept.
          setDemo({ ...mergeDefaults(parsed), theme: ref.current.theme });
          return true;
        } catch {
          return false;
        }
      },
    }),
    [],
  );

  return { demo, autoStatus, ...actions };
}

type DemoStore = ReturnType<typeof useDemoStore>;
const StoreContext = createContext<DemoStore | null>(null);
function useStore(): DemoStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error("StoreContext missing");
  return s;
}

/* ===== components/Icons.tsx ===== */
function Svg({ children, ...rest }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

const IconQuotes = () => (
  <Svg>
    <path d="M8 19V6m0 0L4.5 9.5M8 6l3.5 3.5M16 5v13m0 0l-3.5-3.5M16 18l3.5-3.5" />
  </Svg>
);

const IconChart = () => (
  <Svg>
    <path d="M7 3.5v3M7 15.5v5M17 5.5v2.5M17 17v3.5" />
    <rect x="5" y="6.5" width="4" height="9" rx="1" />
    <rect x="15" y="8" width="4" height="9" rx="1" />
  </Svg>
);

const IconTrade = () => (
  <Svg strokeWidth={1.9}>
    <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3.4" />
    <path d="M7.2 15.6l3.2-3.9 2.8 2.5 3.6-5" />
  </Svg>
);

const IconHistory = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

const IconSettings = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

const IconCard = () => (
  <Svg>
    <rect x="3" y="5.5" width="18" height="13" rx="2.6" />
    <path d="M3 10h18M7 14.5h3" />
  </Svg>
);

const IconPlus = () => (
  <Svg strokeWidth={1.9}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

const IconDots = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5.5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="18.5" cy="12" r="1.6" />
  </svg>
);

const IconZoomIn = () => (
  <Svg>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.3-4.3M11 8.5v5M8.5 11h5" />
  </Svg>
);

const IconZoomOut = () => (
  <Svg>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.3-4.3M8.5 11h5" />
  </Svg>
);

const IconChevron = () => (
  <Svg>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

/** MetaLuna crescent mark (original artwork). */
const LunaMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="luna-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7d9bff" />
        <stop offset="1" stopColor="#3a45c8" />
      </linearGradient>
    </defs>
    <path d="M20.2 14.6A8.6 8.6 0 1 1 9.4 3.8a7.1 7.1 0 0 0 10.8 10.8z" fill="url(#luna-g)" />
    <circle cx="16.8" cy="7.2" r="1.35" fill="#c9d5ff" />
  </svg>
);

const BatteryIcon = ({ pct }: { pct: number }) => (
  <svg viewBox="0 0 28 14" aria-hidden="true">
    <rect x="0.7" y="0.7" width="23" height="12.6" rx="3.6" fill="none" stroke="currentColor" opacity="0.45" />
    <rect x="2.4" y="2.4" width={Math.max(1.5, (19.6 * Math.min(100, Math.max(0, pct))) / 100)} height="9.2" rx="2.2" fill="currentColor" />
    <path d="M25.4 4.8v4.4c1-.3 1.7-1.2 1.7-2.2s-.7-1.9-1.7-2.2z" fill="currentColor" opacity="0.5" />
  </svg>
);

const SignalIcon = () => (
  <svg viewBox="0 0 18 12" fill="currentColor" aria-hidden="true">
    <rect x="0" y="8" width="3" height="4" rx="0.8" />
    <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
    <rect x="10" y="3" width="3" height="9" rx="0.8" />
    <rect x="15" y="0" width="3" height="12" rx="0.8" />
  </svg>
);

const WifiIcon = () => (
  <svg viewBox="0 0 17 12" fill="currentColor" aria-hidden="true">
    <path d="M8.5 2.2c2.3 0 4.4.9 6 2.4l1.1-1.2A10.4 10.4 0 0 0 8.5.5C5.7.5 3.2 1.6 1.4 3.4l1.1 1.2a8.7 8.7 0 0 1 6-2.4z" />
    <path d="M8.5 5.7c1.4 0 2.6.5 3.6 1.4l1.1-1.2a7 7 0 0 0-9.4 0l1.1 1.2c1-.9 2.2-1.4 3.6-1.4z" />
    <path d="M8.5 9.1c.7 0 1.3.3 1.8.7L8.5 11.8 6.7 9.8c.5-.4 1.1-.7 1.8-.7z" />
  </svg>
);

/* ===== components/Sheet.tsx ===== */
interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Bottom sheet with slide/fade transitions and drag-handle-to-dismiss. */
function Sheet({ open, onClose, title, children }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ y: number; id: number } | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => {
      setMounted(false);
      setDragY(0);
    }, 260);
    return () => clearTimeout(t);
  }, [open]);

  if (!mounted) return null;

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setDragY(Math.max(0, e.clientY - drag.current.y));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.y;
    drag.current = null;
    const h = (e.currentTarget as HTMLElement).parentElement?.offsetHeight ?? 400;
    if (dy > Math.min(110, h * 0.25)) onClose();
    else setDragY(0);
  };

  return (
    <div className={`sheet-root${shown ? " is-open" : ""}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      >
        <div
          className="sheet-grab"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <span />
        </div>
        {title && <h2 className="sheet-title">{title}</h2>}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ===== components/SwipeRow.tsx ===== */
interface SwipeRowProps {
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
  onTap: () => void;
}

/** List row: tap to open, swipe left to reveal an action. Pointer-event based so mouse and touch both work. */
function SwipeRow({ children, actionLabel, onAction, onTap }: SwipeRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dxRef = useRef(0);
  const openRef = useRef(false);
  const st = useRef<{ x: number; y: number; base: number; locked: boolean; aw: number } | null>(null);

  const setBoth = (v: number) => {
    dxRef.current = v;
    setDx(v);
  };

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const w = rowRef.current?.offsetWidth ?? 300;
    const aw = w * 0.24;
    st.current = { x: e.clientX, y: e.clientY, base: openRef.current ? -aw : 0, locked: false, aw };
  };

  const move = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (!s.locked) {
      if (Math.abs(ddx) > 6 && Math.abs(ddx) > Math.abs(ddy)) {
        s.locked = true;
        setDragging(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      } else if (Math.abs(ddy) > 8) {
        st.current = null;
        return;
      }
    }
    if (s.locked) setBoth(Math.min(0, Math.max(-s.aw * 1.2, s.base + ddx)));
  };

  const up = () => {
    const s = st.current;
    st.current = null;
    if (!s) return;
    if (s.locked) {
      const open = dxRef.current < -s.aw * 0.5;
      openRef.current = open;
      setBoth(open ? -s.aw : 0);
      setDragging(false);
      return;
    }
    if (openRef.current) {
      openRef.current = false;
      setBoth(0);
    } else {
      onTap();
    }
  };

  const cancel = () => {
    const s = st.current;
    st.current = null;
    if (s?.locked) {
      const open = dxRef.current < -s.aw * 0.5;
      openRef.current = open;
      setBoth(open ? -s.aw : 0);
    }
    setDragging(false);
  };

  return (
    <div className="swipe" ref={rowRef}>
      <button
        type="button"
        className="swipe-action"
        style={{ width: Math.max(0, -dx), transition: dragging ? "none" : undefined }}
        tabIndex={dx < -10 ? 0 : -1}
        onClick={() => {
          openRef.current = false;
          setBoth(0);
          onAction();
        }}
      >
        <span>{actionLabel}</span>
      </button>
      <div
        className="swipe-content"
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTap();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ===== components/Fields.tsx ===== */
function Section({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`set-section${open ? " is-open" : ""}`}>
      <button type="button" className="set-section-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <i aria-hidden="true" />
      </button>
      {open && <div className="set-section-body">{children}</div>}
    </section>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <em>{hint}</em>}
      </span>
      {children}
    </label>
  );
}

function TextField({ label, value, onChange, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input className="input" type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} />
    </Field>
  );
}

interface NumProps {
  value: number;
  onChange: (v: number) => void;
  digits?: number;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
}

/** Numeric input that lets you type freely ("1.", "-") and only commits valid numbers. */
function NumInput({ value, onChange, digits, min, max, className = "input", ariaLabel }: NumProps) {
  const show = (v: number) => (digits != null ? v.toFixed(digits) : String(v));
  const [txt, setTxt] = useState(show(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setTxt(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, digits]);
  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={txt}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onBlur={() => {
        focused.current = false;
        setTxt(show(value));
      }}
      onChange={(e) => {
        const t = e.target.value;
        setTxt(t);
        let n = parseFloat(t.replace(/\s/g, "").replace(",", "."));
        if (Number.isFinite(n)) {
          if (min != null) n = Math.max(min, n);
          if (max != null) n = Math.min(max, n);
          onChange(n);
        }
      }}
    />
  );
}

function NumField({ label, hint, ...p }: NumProps & { label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <NumInput {...p} ariaLabel={label} />
    </Field>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="field field-row">
      <span className="field-label">
        {label}
        {hint && <em>{hint}</em>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch${checked ? " on" : ""}`} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="color-field">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      <span className="cf-text">
        <span>{label}</span>
        <code>{value}</code>
      </span>
    </label>
  );
}

function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="seg" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ===== components/Chrome.tsx ===== */
function StatusBar({ fixedTime, battery }: { fixedTime: string; battery: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (fixedTime) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [fixedTime]);
  return (
    <div className="statusbar">
      <span className="sb-time">{fixedTime || fmtClock(now)}</span>
      <span className="sb-icons">
        <span className="sb-signal">
          <SignalIcon />
        </span>
        <span className="sb-4g">4G</span>
        <span className="sb-wifi">
          <WifiIcon />
        </span>
        <span className="sb-batt">
          <BatteryIcon pct={battery} />
        </span>
      </span>
    </div>
  );
}

/** Always-visible brand strip. The DEMO tag is deliberately not configurable. */
function AppBar() {
  return (
    <div className="appbar">
      <span className="brand">
        
      </span>
     
    </div>
  );
}

const TABS: { id: Tab; key: keyof Labels; icon: JSX.Element }[] = [
  { id: "quotes", key: "quotes", icon: <IconQuotes /> },
  { id: "chart", key: "chart", icon: <IconChart /> },
  { id: "trade", key: "trade", icon: <IconTrade /> },
  { id: "history", key: "history", icon: <IconHistory /> },
  { id: "settings", key: "settings", icon: <IconSettings /> },
];

const TAB_ORDER: Tab[] = TABS.map((t) => t.id);

function TabBar({ tab, labels, onChange }: { tab: Tab; labels: Labels; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" role="tablist" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          className={`tab${tab === t.id ? " on" : ""}`}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-ico">{t.icon}</span>
          <span className="tab-lbl">{labels[t.key]}</span>
        </button>
      ))}
    </nav>
  );
}

/* ===== components/OrderSheet.tsx ===== */
interface OrderSheetProps {
  open: boolean;
  onClose: () => void;
  symbols: SymbolDef[];
  initialSym: string;
  initialSide?: Side;
  onPlace: (sym: string, side: Side, lots: number) => void;
}

/** Simulated ticket: it only adds a row to the local demo data. Nothing is sent anywhere. */
function OrderSheet({ open, onClose, symbols, initialSym, initialSide = "buy", onPlace }: OrderSheetProps) {
  const [sym, setSym] = useState(initialSym);
  const [side, setSide] = useState<Side>(initialSide);
  const [lots, setLots] = useState(0.1);

  useEffect(() => {
    if (open) {
      setSym(initialSym);
      setSide(initialSide);
    }
  }, [open, initialSym, initialSide]);

  const s = symbols.find((x) => x.code === sym) ?? symbols[0];
  const bump = (d: number) => setLots((l) => Math.max(0.01, round(l + d, 2)));

  return (
    <Sheet open={open} onClose={onClose} title="New order (simulated)">
      <div className="chips" role="listbox" aria-label="Symbol">
        {symbols.map((x) => (
          <button key={x.code} type="button" role="option" aria-selected={x.code === sym} className={`chip${x.code === sym ? " on" : ""}`} onClick={() => setSym(x.code)}>
            {x.code}
          </button>
        ))}
      </div>

      <div className="side-pick">
        <button type="button" className={`side sell${side === "sell" ? " on" : ""}`} onClick={() => setSide("sell")}>
          <small>Sell at</small>
          <b>{fmtPrice(bidOf(s), s.digits)}</b>
        </button>
        <button type="button" className={`side buy${side === "buy" ? " on" : ""}`} onClick={() => setSide("buy")}>
          <small>Buy at</small>
          <b>{fmtPrice(askOf(s), s.digits)}</b>
        </button>
      </div>

      <div className="stepper">
        <span>Volume (lots)</span>
        <div>
          <button type="button" onClick={() => bump(-0.1)} aria-label="Decrease volume">
            −
          </button>
          <NumInput value={lots} onChange={(v) => setLots(Math.max(0.01, v))} digits={2} className="stepper-input" ariaLabel="Volume in lots" />
          <button type="button" onClick={() => bump(0.1)} aria-label="Increase volume">
            +
          </button>
        </div>
      </div>

      <p className="sheet-note">
        Margin needed: {fmtMoney(round(lots * s.margin, 2))} USD · demo data only, no order is sent anywhere.
      </p>

      <button
        type="button"
        className={`cta ${side}`}
        onClick={() => {
          onPlace(sym, side, lots);
          onClose();
        }}
      >
        Place simulated {side}
      </button>
    </Sheet>
  );
}

/* ===== screens/TradeScreen.tsx ===== */
type SortKey = "time" | "profit" | "symbol";

interface TradeScreenProps {
  onNewOrder: () => void;
  onToast: (m: string) => void;
  onGo: (t: Tab) => void;
}

function TradeScreen({ onNewOrder, onToast, onGo }: TradeScreenProps) {
  const { demo, autoStatus, closePosition, closeAll } = useStore();
  const [sheet, setSheet] = useState<null | "account" | "menu" | "pos">(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("time");

  const f = accountFigures(demo);
  const L = demo.labels;
  const bySym = useMemo(() => new Map(demo.symbols.map((s) => [s.code, s])), [demo.symbols]);

  const rows = useMemo(() => {
    const list = demo.positions.map((p) => ({ p, s: bySym.get(p.sym), profit: positionProfit(p, bySym.get(p.sym)) }));
    if (sort === "profit") list.sort((a, b) => b.profit - a.profit);
    else if (sort === "symbol") list.sort((a, b) => a.p.sym.localeCompare(b.p.sym) || a.p.id - b.p.id);
    else list.sort((a, b) => a.p.id - b.p.id);
    return list;
  }, [demo.positions, bySym, sort]);

  const selected: Position | undefined = demo.positions.find((p) => p.id === selId);
  const selSym = selected ? bySym.get(selected.sym) : undefined;

  const close = (id: number) => {
    closePosition(id);
    setSheet(null);
    onToast("Position closed (simulated)");
  };

const sumRows: [string, string][] =
  demo.positions.length === 0
    ? [
        [L.balance, fmtMoney(f.balance)],
        [L.equity, fmtMoney(f.equity)],
        [L.freeMargin, fmtMoney(f.freeMargin)],
      ]
    : [
        [L.balance, fmtMoney(f.balance)],
        [L.equity, fmtMoney(f.equity)],
        [L.margin, fmtMoney(f.margin)],
        [L.freeMargin, fmtMoney(f.freeMargin)],
      ];

  return (
    <div className="screen-trade">
      <header className="acct-head">
        <button type="button" className="icon-btn" aria-label="Account details" onClick={() => setSheet("account")}>
          <IconCard />
        </button>
      <div
  className={`headline ${
    f.profit > 0
      ? "up"
      : f.profit < 0
      ? "down"
      : ""
  }`}
>
  {fmtMoney(f.profit)}
  <small> USD</small>
</div>
        <button type="button" className="icon-btn" aria-label="New order" onClick={onNewOrder}>
          <IconPlus />
        </button>
      </header>

      <dl className="summary dotted">
        {sumRows.map(([k, v]) => (
          <div key={k} className="sum-row">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

{demo.positions.length > 0 && (
  <>
    <div className="pos-head">
      <h3>
        {L.positions}
        {autoStatus !== "stopped" && (
          <span className={`auto-chip ${autoStatus}`}></span>
        )}
      </h3>

      <button
        type="button"
        className="icon-btn small"
        aria-label="Positions menu"
        onClick={() => setSheet("menu")}
      >
        <IconDots />
      </button>
    </div>

    <div className="pos-list">
      {rows.map(({ p, s, profit }) => (
        <SwipeRow
          key={p.id}
          actionLabel="Close"
          onAction={() => close(p.id)}
          onTap={() => {
            setSelId(p.id);
            setSheet("pos");
          }}
        >

            <div className="pos-row">
              <div className="pos-main">
                <div className={`pos-top ${p.side}`}>
                  <b className="pos-sym">{p.sym}</b>
                  <span className={`pos-side ${p.side}`}>{p.side}</span>
                  <span className="pos-lots">{p.lots}</span>
                </div>
                <div className="pos-prices">
                  {fmtPrice(p.open, s?.digits ?? 2)} <i>→</i> {s ? fmtPrice(closePrice(p, s), s.digits) : "—"}
                </div>
              </div>
              <div className={`pos-pl ${profit >= 0 ? "up" : "down"}`}>{fmtMoney(profit)}</div>
            </div>
          </SwipeRow>
        ))}
      </div>

      {/* Account */}
      <Sheet open={sheet === "account"} onClose={() => setSheet(null)} title="Account">
        <dl className="kv">
          <div><dt>Name</dt><dd>{demo.accountName}</dd></div>
          <div><dt>Number</dt><dd>{demo.accountId}</dd></div>
          <div><dt>Server</dt><dd>{demo.server}</dd></div>
          <div><dt>Leverage</dt><dd>{demo.leverage}</dd></div>
          <div><dt>Currency</dt><dd>USD</dd></div>
          <div><dt>Floating P/L</dt><dd className={f.profit >= 0 ? "up" : "down"}>{fmtMoney(f.profit)}</dd></div>
        </dl>
        <p className="sheet-note">MetaLuna is a fictional app. This account holds demo data only.</p>
        <button type="button" className="cta ghost" onClick={() => { setSheet(null); onGo("settings"); }}>
          Open demo settings
        </button>
      </Sheet>

      {/* Positions menu */}
      <Sheet open={sheet === "menu"} onClose={() => setSheet(null)} title="Positions">
        <div className="menu-list">
          {(["time", "profit", "symbol"] as SortKey[]).map((k) => (
            <button key={k} type="button" className={`menu-item${sort === k ? " on" : ""}`} onClick={() => { setSort(k); setSheet(null); }}>
              Sort by {k === "time" ? "ticket" : k}
              {sort === k && <span aria-hidden="true">✓</span>}
            </button>
          ))}
          <button
            type="button"
            className="menu-item danger"
            disabled={demo.positions.length === 0}
            onClick={() => {
              closeAll();
              setSheet(null);
              onToast("All positions closed (simulated)");
            }}
          >
            Close all positions
          </button>
        </div>
      </Sheet>

       
  </>
)}

      {/* Position details */}
      <Sheet open={sheet === "pos" && !!selected} onClose={() => setSheet(null)} title={selected ? `${selected.sym} · ${selected.side} ${selected.lots}` : ""}>
        {selected && (
          <>
            <dl className="kv">
              <div><dt>Ticket</dt><dd>#{selected.id}</dd></div>
              <div><dt>Opened</dt><dd>{fmtDateTime(selected.openedAt)}</dd></div>
              <div><dt>Open price</dt><dd>{fmtPrice(selected.open, selSym?.digits ?? 2)}</dd></div>
              <div><dt>Current price</dt><dd>{selSym ? fmtPrice(closePrice(selected, selSym), selSym.digits) : "—"}</dd></div>
              <div>
                <dt>Profit</dt>
                <dd className={positionProfit(selected, selSym) >= 0 ? "up" : "down"}>{fmtMoney(positionProfit(selected, selSym))} USD</dd>
              </div>
            </dl>
            <button type="button" className="cta sell" onClick={() => close(selected.id)}>
              Close position (simulated)
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
}

/* ===== screens/QuotesScreen.tsx ===== */
interface QuotesScreenProps {
  onNewOrder: (sym: string) => void;
  onGo: (t: Tab) => void;
}

function QuotesScreen({ onNewOrder, onGo }: QuotesScreenProps) {
  const { demo, patch } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const prev = useRef<Record<string, number>>({});
  const dirs = useRef<Record<string, 1 | -1 | 0>>({});

  for (const s of demo.symbols) {
    const p = prev.current[s.code];
    if (p !== undefined && p !== s.price) dirs.current[s.code] = s.price > p ? 1 : -1;
    prev.current[s.code] = s.price;
  }

  const chosen = demo.symbols.find((s) => s.code === sel);

  return (
    <div className="screen-quotes">
      <header className="page-head">
        <h1>{demo.labels.quotes}</h1>
        <span className="page-sub">{demo.symbols.length} symbols</span>
      </header>

      <div className="q-cols" aria-hidden="true">
        <span>Symbol</span>
        <span>Bid</span>
        <span>Ask</span>
        <span>Day</span>
      </div>

      <ul className="q-list">
        {demo.symbols.map((s) => {
          const chg = s.dayOpen ? ((s.price - s.dayOpen) / s.dayOpen) * 100 : 0;
          const d = dirs.current[s.code] ?? 0;
          return (
            <li key={s.code}>
              <button type="button" className="q-row" onClick={() => setSel(s.code)}>
                <span className="q-sym">
                  <b>{s.code}</b>
                  <small>{s.name}</small>
                </span>
                <span className={`q-px ${d > 0 ? "tick-up" : d < 0 ? "tick-down" : ""}`}>{fmtPrice(bidOf(s), s.digits)}</span>
                <span className={`q-px ${d > 0 ? "tick-up" : d < 0 ? "tick-down" : ""}`}>{fmtPrice(askOf(s), s.digits)}</span>
                <span className={`q-chg ${chg >= 0 ? "up" : "down"}`}>
                  {chg >= 0 ? "+" : ""}
                  {fmtMoney(chg, 2)}%
                </span>
                <span className="q-go" aria-hidden="true">
                  <IconChevron />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet open={!!chosen} onClose={() => setSel(null)} title={chosen ? `${chosen.code} · ${chosen.name}` : ""}>
        {chosen && (
          <>
            <dl className="kv">
              <div><dt>Bid</dt><dd>{fmtPrice(bidOf(chosen), chosen.digits)}</dd></div>
              <div><dt>Ask</dt><dd>{fmtPrice(askOf(chosen), chosen.digits)}</dd></div>
              <div><dt>Spread</dt><dd>{fmtPrice(chosen.spread, chosen.digits)}</dd></div>
              <div><dt>Day open</dt><dd>{fmtPrice(chosen.dayOpen, chosen.digits)}</dd></div>
            </dl>
            <div className="btn-row">
              <button
                type="button"
                className="cta ghost"
                onClick={() => {
                  patch({ chartSym: chosen.code });
                  setSel(null);
                  onGo("chart");
                }}
              >
                Open chart
              </button>
              <button
                type="button"
                className="cta buy"
                onClick={() => {
                  setSel(null);
                  onNewOrder(chosen.code);
                }}
              >
                New order
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

/* ===== screens/ChartScreen.tsx ===== */
const W = 390;
const H = 318;
const ML = 6;
const MR = 56;
const MT = 8;
const MB = 22;
const TFS: TfKey[] = ["M1", "M5", "M15", "H1", "H4", "D1"];
const COUNTS = [24, 40, 64, 96];

interface ChartScreenProps {
  onNewOrder: (sym: string, side: Side) => void;
}

function ChartScreen({ onNewOrder }: ChartScreenProps) {
  const { demo, patch } = useStore();
  const sym = demo.symbols.find((s) => s.code === demo.chartSym) ?? demo.symbols[0];
  const tf = demo.chartTf;
  const [zoomIdx, setZoomIdx] = useState(2);
  const [cross, setCross] = useState<{ x: number; y: number } | null>(null);
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHide = () => {
    if (hideT.current) clearTimeout(hideT.current);
  };
  const svgRef = useRef<SVGSVGElement>(null);
  const nowMs = useRef(Date.now());
  const anchors = useRef<Record<string, number>>({});

  useEffect(() => clearHide, []);

  // History is anchored to a price so live ticks only move the last candle. If the price is changed
  // by more than 2% (e.g. edited in Settings) the history is rebuilt around the new level, so the
  // chart never shows a giant jump between old candles and the new quote.
  let anchor = anchors.current[sym.code];
  if (!anchor || Math.abs(sym.price - anchor) / anchor > 0.02) {
    anchor = sym.price;
    anchors.current[sym.code] = anchor;
  }
  const base = useMemo(
    () => buildHistoryCandles(sym, tf, 130, nowMs.current, anchor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sym.code, sym.digits, tf, anchor],
  );
  const n = COUNTS[zoomIdx];
  const candles: Candle[] = useMemo(() => {
    const live = liveCandle(sym, tf, base[base.length - 1].c, nowMs.current);
    return [...base, live].slice(-n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, sym.price, n, tf]);

  const posLines = demo.positions.filter((p) => p.sym === sym.code);

  const { lo, hi } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of candles) {
      lo = Math.min(lo, c.l);
      hi = Math.max(hi, c.h);
    }
    const pad = (hi - lo) * 0.08 || sym.price * 0.001;
    return { lo: lo - pad, hi: hi + pad };
  }, [candles, sym.price]);

  const plotW = W - ML - MR;
  const plotH = H - MT - MB;
  const step = plotW / candles.length;
  const bodyW = Math.max(1.4, step * 0.62);
  const y = (p: number) => MT + (1 - (p - lo) / (hi - lo)) * plotH;
  const x = (i: number) => ML + step * (i + 0.5);

  const grid = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 5);
  const timeIdx = [0.1, 0.37, 0.64, 0.9].map((r) => Math.floor(r * (candles.length - 1)));
  const timeLabel = (t: number) => (tf === "M1" || tf === "M5" || tf === "M15" ? fmtClock(t) : fmtShortDate(t));

  const chg = sym.dayOpen ? ((sym.price - sym.dayOpen) / sym.dayOpen) * 100 : 0;
  const lastY = y(sym.price);

  const toBox = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const setCrossFrom = (e: React.PointerEvent) => {
    clearHide();
    const b = toBox(e);
    setCross({ x: Math.min(W - MR, Math.max(ML, b.x)), y: Math.min(H - MB, Math.max(MT, b.y)) });
  };
  const idx = cross ? Math.max(0, Math.min(candles.length - 1, Math.floor((cross.x - ML) / step))) : candles.length - 1;
  const ro = candles[idx];
  const crossPrice = cross ? lo + (1 - (cross.y - MT) / plotH) * (hi - lo) : 0;

  return (
    <div className="screen-chart">
      <div className="chips scroll" role="listbox" aria-label="Chart symbol">
        {demo.symbols.map((s) => (
          <button key={s.code} type="button" role="option" aria-selected={s.code === sym.code} className={`chip${s.code === sym.code ? " on" : ""}`} onClick={() => patch({ chartSym: s.code })}>
            {s.code}
          </button>
        ))}
      </div>

      <div className="chart-head">
        <div>
          <b className="chart-sym">{sym.code}</b>
          <small>{sym.name}</small>
        </div>
        <div className="chart-px">
          <b>{fmtPrice(bidOf(sym), sym.digits)}</b>
          <small className={chg >= 0 ? "up" : "down"}>
            {chg >= 0 ? "+" : ""}
            {fmtMoney(chg, 2)}%
          </small>
        </div>
      </div>

      <div className="tf-row">
        <div className="tf-pills" role="tablist" aria-label="Timeframe">
          {TFS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={t === tf} className={t === tf ? "on" : ""} onClick={() => patch({ chartTf: t })}>
              {t}
            </button>
          ))}
        </div>
        <div className="zoom">
          <button type="button" aria-label="Zoom out" disabled={zoomIdx >= COUNTS.length - 1} onClick={() => setZoomIdx((z) => Math.min(COUNTS.length - 1, z + 1))}>
            <IconZoomOut />
          </button>
          <button type="button" aria-label="Zoom in" disabled={zoomIdx <= 0} onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}>
            <IconZoomIn />
          </button>
        </div>
      </div>

      <div className="chart-box">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="chart-svg"
          role="img"
          aria-label={`${sym.code} ${tf} simulated candlestick chart`}
          onPointerDown={(e) => {
            (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
            setCrossFrom(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons || e.pointerType === "touch") setCrossFrom(e);
          }}
          onPointerUp={() => {
            clearHide();
            hideT.current = setTimeout(() => setCross(null), 2600);
          }}
          onPointerCancel={() => setCross(null)}
        >
          {/* grid + price axis */}
          {grid.map((g, i) => (
            <g key={i}>
              <line x1={ML} x2={W - MR} y1={y(g)} y2={y(g)} className="c-grid" />
              <text x={W - MR + 5} y={y(g) + 3.5} className="c-axis">
                {fmtPrice(g, sym.digits)}
              </text>
            </g>
          ))}
          {timeIdx.map((i, k) => (
            <text key={k} x={x(i)} y={H - 6} textAnchor="middle" className="c-axis">
              {timeLabel(candles[i].t)}
            </text>
          ))}

          {/* candles */}
          {candles.map((c, i) => {
            const up = c.c >= c.o;
            const top = y(Math.max(c.o, c.c));
            const bot = y(Math.min(c.o, c.c));
            return (
              <g key={c.t} className={up ? "c-up" : "c-down"}>
                <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} />
                <rect x={x(i) - bodyW / 2} y={top} width={bodyW} height={Math.max(1, bot - top)} rx={0.6} />
              </g>
            );
          })}

          {/* open-position lines */}
          {posLines.map((p) => {
            const py = y(p.open);
            if (py < MT || py > H - MB) return null;
            return (
              <g key={p.id} className={`c-pos ${p.side}`}>
                <line x1={ML} x2={W - MR} y1={py} y2={py} />
                <text x={ML + 4} y={py - 3}>
                  {p.side} {p.lots}
                </text>
              </g>
            );
          })}

          {/* last price */}
          <line x1={ML} x2={W - MR} y1={lastY} y2={lastY} className="c-last" />
          <g transform={`translate(${W - MR},${lastY - 8})`}>
            <rect width={MR - 2} height={16} rx={3} className="c-tag" />
            <text x={4} y={11.5} className="c-tag-t">
              {fmtPrice(sym.price, sym.digits)}
            </text>
          </g>

          {/* crosshair */}
          {cross && (
            <g className="c-cross">
              <line x1={x(idx)} x2={x(idx)} y1={MT} y2={H - MB} />
              <line x1={ML} x2={W - MR} y1={cross.y} y2={cross.y} />
              <g transform={`translate(${W - MR},${cross.y - 8})`}>
                <rect width={MR - 2} height={16} rx={3} className="c-cross-tag" />
                <text x={4} y={11.5}>
                  {fmtPrice(crossPrice, sym.digits)}
                </text>
              </g>
            </g>
          )}
        </svg>

        <div className="ohlc" aria-live="off">
          <span>O {fmtPrice(ro.o, sym.digits)}</span>
          <span>H {fmtPrice(ro.h, sym.digits)}</span>
          <span>L {fmtPrice(ro.l, sym.digits)}</span>
          <span>C {fmtPrice(ro.c, sym.digits)}</span>
        </div>
      </div>

      <div className="btn-row chart-actions">
        <button type="button" className="cta sell" onClick={() => onNewOrder(sym.code, "sell")}>
          Sell {fmtPrice(bidOf(sym), sym.digits)}
        </button>
        <button type="button" className="cta buy" onClick={() => onNewOrder(sym.code, "buy")}>
          Buy {fmtPrice(askOf(sym), sym.digits)}
        </button>
      </div>
      <p className="fine">Simulated price history · demo data only</p>
    </div>
  );
}

/* ===== screens/HistoryScreen.tsx ===== */
type Range = "today" | "week" | "all";
const DAY = 86_400_000;

function HistoryScreen() {
  const { demo } = useStore();
  const [range, setRange] = useState<Range>("all");
  const digits = useMemo(() => new Map(demo.symbols.map((s) => [s.code, s.digits])), [demo.symbols]);

  const list = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
    const from = range === "today" ? startOfToday : range === "week" ? now - 7 * DAY : 0;
    return [...demo.history].filter((t) => t.closedAt >= from).sort((a, b) => b.closedAt - a.closedAt);
  }, [demo.history, range]);

  const total = round(list.reduce((a, t) => a + t.profit, 0), 2);
  const wins = list.filter((t) => t.profit > 0).length;

  const groups = useMemo(() => {
    const m = new Map<string, ClosedTrade[]>();
    for (const t of list) {
      const k = fmtDay(t.closedAt);
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return [...m.entries()];
  }, [list]);

  return (
    <div className="screen-history">
      <header className="page-head">
        <h1>{demo.labels.history}</h1>
        <Segmented<Range>
          ariaLabel="History range"
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "7 days" },
            { value: "all", label: "All" },
          ]}
        />
      </header>

      <dl className="summary compact">
        <div className="sum-row">
          <dt>Closed trades</dt>
          <dd>{list.length}</dd>
        </div>
        <div className="sum-row">
          <dt>Win rate</dt>
          <dd>{list.length ? `${fmtMoney((wins / list.length) * 100, 1)}%` : "—"}</dd>
        </div>
        <div className="sum-row">
          <dt>Net result</dt>
          <dd className={total >= 0 ? "up" : "down"}>{fmtMoney(total)} USD</dd>
        </div>
      </dl>

      <div className="hist-list">
        {groups.length === 0 && <p className="empty">No closed trades in this range</p>}
        {groups.map(([day, trades]) => (
          <section key={day}>
            <h4 className="day-head">
              <span>{day}</span>
              <span className={trades.reduce((a, t) => a + t.profit, 0) >= 0 ? "up" : "down"}>
                {fmtMoney(round(trades.reduce((a, t) => a + t.profit, 0), 2))}
              </span>
            </h4>
            {trades.map((t) => {
              const d = digits.get(t.sym) ?? 2;
              return (
                <div key={`${t.id}-${t.closedAt}`} className="hist-row">
                  <div className="pos-main">
                    <div className={`pos-top ${t.side}`}>
                      <b className="pos-sym">{t.sym}</b>
                      <span className={`pos-side ${t.side}`}>{t.side}</span>
                      <span className="pos-lots">{t.lots}</span>
                    </div>
                    <div className="pos-prices">
                      {fmtPrice(t.open, d)} <i>→</i> {fmtPrice(t.close, d)}
                    </div>
                  </div>
                  <div className="hist-right">
                    <div className={`pos-pl ${t.profit >= 0 ? "up" : "down"}`}>{fmtMoney(t.profit)}</div>
                    <small>{fmtClock(t.closedAt)}</small>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ===== screens/SettingsScreen.tsx ===== */
interface SettingsScreenProps {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onToast: (m: string) => void;
}

const SUMMARY_LABELS: [keyof Labels, string][] = [
  ["balance", "Balance row"],
  ["equity", "Equity row"],
  ["margin", "Margin row"],
  ["freeMargin", "Free margin row"],
  ["marginLevel", "Margin level row"],
  ["positions", "Positions title"],
];
const TAB_LABELS: [keyof Labels, string][] = [
  ["quotes", "Tab 1"],
  ["chart", "Tab 2"],
  ["trade", "Tab 3"],
  ["history", "Tab 4"],
  ["settings", "Tab 5"],
];
const COLORS: [keyof Theme, string][] = [
  ["bgTop", "Screen top"],
  ["bgBottom", "Screen bottom"],
  ["accent", "Accent / headline"],
  ["text", "Text"],
  ["muted", "Muted text"],
  ["profit", "Profit"],
  ["loss", "Loss"],
  ["buy", "Buy label"],
  ["sell", "Sell label"],
];

function SettingsScreen({ fullscreen, onToggleFullscreen, onToast }: SettingsScreenProps) {
  const st = useStore();
  const { demo } = st;
  const f = accountFigures(demo);
  const bySym = new Map(demo.symbols.map((s) => [s.code, s]));
  const [json, setJson] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [histN, setHistN] = useState(16);
  // dark = the screen background is dark (works for the presets and for custom colours)
  const isDark = (() => {
    const m = /^#?([0-9a-f]{6})$/i.exec(demo.theme.bgTop.trim());
    if (!m) return false;
    const n = parseInt(m[1], 16);
    return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 110;
  })();

  return (
    <div className="screen-settings">
      <header className="page-head">
        <h1>{demo.labels.settings}</h1>
        <span className="page-sub">Demo controls</span>
      </header>

      <div className="set-intro">
        <b>Prop panel.</b> Everything below edits fictional demo data stored on this device. Figures on the Trade screen are
        calculated from it, so they always agree. Equity right now: <b>{fmtMoney(f.equity)} USD</b>.
      </div>

      <Section title="Appearance" defaultOpen>
        <Toggle
          label="Dark mode"
          hint="switches between the light and night colour sets"
          checked={isDark}
          onChange={(v) => st.setTheme(v ? THEMES.Night : THEMES.Lavender)}
        />
      </Section>

      <Section title="Account & status bar" defaultOpen>
        <TextField label="Account name" value={demo.accountName} onChange={(v) => st.patch({ accountName: v })} />
        <TextField label="Account number" value={demo.accountId} onChange={(v) => st.patch({ accountId: v })} />
        <TextField label="Server label" value={demo.server} onChange={(v) => st.patch({ server: v })} />
        <TextField label="Leverage text" value={demo.leverage} onChange={(v) => st.patch({ leverage: v })} />
        <NumField label="Balance (USD)" hint="drives equity, free margin, margin level" value={demo.balance} digits={2} min={-1e9} max={1e9} onChange={(v) => st.patch({ balance: v })} />
        <TextField label="Status bar time" value={demo.statusTime} placeholder="blank = live clock" onChange={(v) => st.patch({ statusTime: v })} />
        <NumField label="Battery %" value={demo.battery} min={0} max={100} digits={0} onChange={(v) => st.patch({ battery: Math.round(v) })} />
        <Toggle label="Phone frame" hint="off = edge-to-edge screen" checked={demo.showFrame} onChange={(v) => st.patch({ showFrame: v })} />
      </Section>

      <Section title="Positions">
        {demo.positions.length === 0 && <p className="fine left">No open positions.</p>}
        {demo.positions.map((p) => {
          const s = bySym.get(p.sym);
          const pl = positionProfit(p, s);
          return (
            <div key={p.id} className="edit-card">
              <div className="edit-top">
                <b>#{p.id}</b>
                <span className={pl >= 0 ? "up" : "down"}>{fmtMoney(pl)} USD</span>
                <button type="button" className="mini danger" onClick={() => st.removePosition(p.id)} aria-label={`Delete position ${p.id}`}>
                  Delete
                </button>
              </div>
              <div className="edit-grid">
                <label>
                  <span>Symbol</span>
                  <select className="input" value={p.sym} onChange={(e) => st.updatePosition(p.id, { sym: e.target.value })}>
                    {demo.symbols.map((x) => (
                      <option key={x.code}>{x.code}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Side</span>
                  <Segmented<Side>
                    ariaLabel="Side"
                    value={p.side}
                    onChange={(v) => st.updatePosition(p.id, { side: v })}
                    options={[
                      { value: "buy", label: "buy" },
                      { value: "sell", label: "sell" },
                    ]}
                  />
                </label>
                <label>
                  <span>Lots</span>
                  <NumInput value={p.lots} digits={2} min={0.01} max={1000} onChange={(v) => st.updatePosition(p.id, { lots: v })} ariaLabel="Lots" />
                </label>
                <label>
                  <span>Open price</span>
                  <NumInput value={p.open} digits={s?.digits ?? 2} min={0.00001} max={1e9} onChange={(v) => st.updatePosition(p.id, { open: v })} ariaLabel="Open price" />
                </label>
              </div>
            </div>
          );
        })}
        <button type="button" className="cta ghost" onClick={() => st.addPosition()}>
          + Add position
        </button>
      </Section>

      <Section title="Instruments (fictional)">
        {demo.symbols.map((s) => (
          <div key={s.code} className="edit-card">
            <div className="edit-top">
              <b>{s.code}</b>
              <span className="muted">{s.name}</span>
            </div>
            <div className="edit-grid">
              <label>
                <span>Bid price</span>
                <NumInput value={s.price} digits={s.digits} min={0.00001} max={1e9} onChange={(v) => st.updateSymbol(s.code, { price: v })} ariaLabel={`${s.code} price`} />
              </label>
              <label>
                <span>Day open</span>
                <NumInput value={s.dayOpen} digits={s.digits} min={0.00001} max={1e9} onChange={(v) => st.updateSymbol(s.code, { dayOpen: v })} ariaLabel={`${s.code} day open`} />
              </label>
              <label>
                <span>Spread</span>
                <NumInput value={s.spread} digits={s.digits} min={0} max={1e6} onChange={(v) => st.updateSymbol(s.code, { spread: v })} ariaLabel={`${s.code} spread`} />
              </label>
              <label>
                <span>Margin / lot</span>
                <NumInput value={s.margin} digits={2} min={0} max={1e9} onChange={(v) => st.updateSymbol(s.code, { margin: v })} ariaLabel={`${s.code} margin per lot`} />
              </label>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Labels">
        {SUMMARY_LABELS.map(([k, name]) => (
          <TextField key={k} label={name} value={demo.labels[k]} onChange={(v) => st.setLabel(k, v)} />
        ))}
        {TAB_LABELS.map(([k, name]) => (
          <TextField key={k} label={name} value={demo.labels[k]} onChange={(v) => st.setLabel(k, v)} />
        ))}
      </Section>

      <Section title="Colours">
        <div className="presets">
          {Object.keys(THEMES).map((name) => (
            <button key={name} type="button" className="mini" onClick={() => st.setTheme(THEMES[name])}>
              {name}
            </button>
          ))}
        </div>
        <div className="color-grid">
          {COLORS.map(([k, name]) => (
            <ColorField key={k} label={name} value={demo.theme[k]} onChange={(v) => st.setTheme({ [k]: v })} />
          ))}
        </div>
      </Section>

      <Section title="Closed-trade history">
        <p className="fine left">{demo.history.length} fictional closed trades. Closing a position adds it here and moves its profit into the balance.</p>
        <div className="inline">
          <NumInput value={histN} digits={0} min={0} max={60} onChange={(v) => setHistN(Math.round(v))} ariaLabel="Number of trades to generate" />
          <button type="button" className="mini" onClick={() => { st.regenHistory(histN); onToast(`Generated ${histN} fictional trades`); }}>
            Generate
          </button>
          <button type="button" className="mini danger" onClick={() => st.clearHistory()}>
            Clear
          </button>
        </div>
      </Section>

      <Section title="AutoTrade (simulated)">
        <p className="fine left">
          Opens and closes simulated trades by itself using the simulated prices. Sides are random and take-profit and
          stop-loss are the same distance, so results go both ways and losses are normal. There is no target balance. It
          never starts by itself after a refresh.
        </p>
        <div className="auto-status">
          <span>Status</span>
          <span className={st.autoStatus === "running" ? "up" : "muted"}>{st.autoStatus}</span>
        </div>
        <div className="edit-grid">
          <label>
            <span>New order every (sec)</span>
            <NumInput value={demo.auto.intervalSec} digits={0} min={1} max={120} ariaLabel="Order interval seconds" onChange={(v) => st.patch({ auto: { ...demo.auto, intervalSec: v } })} />
          </label>
          <label>
            <span>Max open at once</span>
            <NumInput value={demo.auto.maxOpen} digits={0} min={1} max={50} ariaLabel="Max open trades" onChange={(v) => st.patch({ auto: { ...demo.auto, maxOpen: Math.round(v) } })} />
          </label>
          <label>
            <span>Hold time (sec)</span>
            <NumInput value={demo.auto.holdSec} digits={0} min={1} max={300} ariaLabel="Hold time seconds" onChange={(v) => st.patch({ auto: { ...demo.auto, holdSec: v } })} />
          </label>
          <label>
            <span>TP / SL distance (USD)</span>
            <NumInput value={demo.auto.stakeUsd} digits={2} min={1} max={500} ariaLabel="TP SL distance" onChange={(v) => st.patch({ auto: { ...demo.auto, stakeUsd: v } })} />
          </label>
        </div>
        <div className="btn-row">
          {st.autoStatus === "stopped" && (
            <button
              type="button"
              className="cta"
              onClick={() => {
                const msg = st.startAuto();
                onToast(msg ?? "AutoTrade started (simulated)");
              }}
            >
              Start AutoTrade
            </button>
          )}
          {st.autoStatus === "running" && (
            <button type="button" className="cta ghost" onClick={() => { st.pauseAuto(); onToast("AutoTrade paused"); }}>
              Pause
            </button>
          )}
          {st.autoStatus === "paused" && (
            <button type="button" className="cta" onClick={() => { st.resumeAuto(); onToast("AutoTrade resumed"); }}>
              Resume
            </button>
          )}
          {st.autoStatus !== "stopped" && (
            <button type="button" className="cta ghost" onClick={() => { st.stopAuto(); onToast("AutoTrade stopped"); }}>
              Stop
            </button>
          )}
        </div>
      </Section>

      <Section title="Simulation">
        <Toggle label="Live price ticks" hint="prices drift, all figures follow" checked={demo.sim.live} onChange={(v) => st.setSim({ live: v })} />
        <label className="field">
          <span className="field-label">
            Volatility <em>{demo.sim.volatility.toFixed(1)}×</em>
          </span>
          <input className="range" type="range" min={0.2} max={4} step={0.1} value={demo.sim.volatility} onChange={(e) => st.setSim({ volatility: parseFloat(e.target.value) })} />
        </label>
      </Section>

      <Section title="Display & data tools">
        <button type="button" className="cta ghost" onClick={onToggleFullscreen}>
          {fullscreen ? "Exit full screen" : "Enter full screen"}
        </button>
        <p className="fine left">Shortcuts: 1–5 switch tabs · F full screen · B toggle frame.</p>
        <textarea className="input area" rows={4} placeholder="Paste exported JSON here to import" value={json} onChange={(e) => setJson(e.target.value)} />
        <div className="inline">
          <button
            type="button"
            className="mini"
            onClick={async () => {
              const text = JSON.stringify(demo, null, 2);
              setJson(text);
              try {
                await navigator.clipboard.writeText(text);
                onToast("Settings copied to clipboard");
              } catch {
                onToast("Export shown in the box");
              }
            }}
          >
            Export
          </button>
          <button type="button" className="mini" onClick={() => onToast(st.importJson(json) ? "Settings imported" : "That isn't valid JSON")}>
            Import
          </button>
          <button
            type="button"
            className={`mini danger${confirmReset ? " armed" : ""}`}
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                setTimeout(() => setConfirmReset(false), 3000);
                return;
              }
              st.reset();
              setConfirmReset(false);
              onToast("Reset to defaults");
            }}
          >
            {confirmReset ? "Tap again to reset" : "Reset all"}
          </button>
        </div>
      </Section>

      <p className="foot-note">
        MetaLuna is a fictional app made for filming. It is not connected to any broker, never executes trades, and every number
        shown is invented demo data, not a real or verified result.
      </p>
    </div>
  );
}

/* ===== MetaLuna.tsx ===== */
function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

/** Readable text colour (white or near-black) for a given background hex. */
function onColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.42 ? "#10111a" : "#ffffff";
}

function MetaLuna() {
  const store = useDemoStore();
  const { demo, patch, openOrder } = store;
  const narrow = useMediaQuery("(max-width: 500px)");
  const bare = narrow || !demo.showFrame;

  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [order, setOrder] = useState<{ open: boolean; sym: string; side: Side }>({ open: false, sym: "", side: "buy" });
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 2300);
  }, []);

  const go = useCallback(
    (t: Tab) => {
      setDir(TAB_ORDER.indexOf(t) >= TAB_ORDER.indexOf(demo.tab) ? "fwd" : "back");
      patch({ tab: t });
    },
    [demo.tab, patch],
  );

  const newOrder = useCallback(
    (sym?: string, side: Side = "buy") => setOrder({ open: true, sym: sym ?? demo.symbols[0]?.code ?? "", side }),
    [demo.symbols],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => showToast("Full screen was blocked by the browser"));
  }, [showToast]);

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // keyboard shortcuts (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "1" && e.key <= "5") go(TAB_ORDER[Number(e.key) - 1]);
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "b" || e.key === "B") patch({ showFrame: !demo.showFrame });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggleFullscreen, patch, demo.showFrame]);

  useEffect(
    () => () => {
      if (toastT.current) clearTimeout(toastT.current);
    },
    [],
  );

  const t = demo.theme;
  const vars = {
    "--bg-top": t.bgTop,
    "--bg-bottom": t.bgBottom,
    "--accent": t.accent,
    "--text": t.text,
    "--muted": t.muted,
    "--profit": t.profit,
    "--loss": t.loss,
    "--buy": t.buy,
    "--sell": t.sell,
    "--on-accent": onColor(t.accent),
    "--on-buy": onColor(t.buy),
    "--on-sell": onColor(t.sell),
  } as CSSProperties;

  let screen: JSX.Element;
  switch (demo.tab) {
    case "quotes":
      screen = <QuotesScreen onNewOrder={(s) => newOrder(s)} onGo={go} />;
      break;
    case "chart":
      screen = <ChartScreen onNewOrder={(s, side) => newOrder(s, side)} />;
      break;
    case "history":
      screen = <HistoryScreen />;
      break;
    case "settings":
      screen = <SettingsScreen fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen} onToast={showToast} />;
      break;
    default:
      screen = <TradeScreen onNewOrder={() => newOrder()} onToast={showToast} onGo={go} />;
  }

  return (
    <StoreContext.Provider value={store}>
      <div className="stage" data-bare={bare} style={vars}>
        <div className="phone">
          <div className="screen">
            <div className="app">
              {!bare && <div className="notch" aria-hidden="true" />}
              <StatusBar fixedTime={demo.statusTime} battery={demo.battery} />
              <AppBar />
              <main className="viewport">
                <div key={demo.tab} className={`pane ${dir}`} data-tab={demo.tab}>
                  {screen}
                </div>
              </main>
              <TabBar tab={demo.tab} labels={demo.labels} onChange={go} />
              {!bare && <div className="home-ind" aria-hidden="true" />}

              <OrderSheet
                open={order.open}
                onClose={() => setOrder((o) => ({ ...o, open: false }))}
                symbols={demo.symbols}
                initialSym={order.sym || demo.symbols[0]?.code || ""}
                initialSide={order.side}
                onPlace={(sym, side, lots) => {
                  openOrder(sym, side, lots);
                  showToast(`Simulated ${side} ${lots.toFixed(2)} ${sym}`);
                }}
              />
              <div className={`toast${toast ? " on" : ""}`} role="status" aria-live="polite">
                {toast}
              </div>
            </div>
          </div>
        </div>
      </div>
    </StoreContext.Provider>
  );
}

/* ===== page entry ===== */
const MOBILE_CSS = `/* MetaLuna — fictional demo trading app. All sizes use --u (1 design px at 390px phone width) so the
   whole UI scales uniformly inside the phone frame, full screen, or a real phone. */

:root {
  color-scheme: light;
}
* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}
html,
body,
#metaluna-root {
  height: 100%;
  margin: 0;
}
body {
  background: #07070b;
  overflow: hidden;
  overscroll-behavior: none;
  font-family: "Roboto Condensed", sans-serif-condensed, "Arial Narrow", "Helvetica Neue Condensed", "Segoe UI", Roboto, -apple-system, Arial, sans-serif;
  font-stretch: condensed;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
}
input,
select,
textarea {
  font: inherit;
  color: inherit;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ---------- stage / phone frame ---------- */

.stage {
  --pw: min(94vw, calc(94dvh * 9 / 19.5));
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: radial-gradient(ellipse at 50% 28%, #1c1c27 0%, #09090e 72%);
}
.stage[data-bare="true"] {
  --pw: min(100vw, calc(100dvh * 0.5));
  background: #000;
}
.phone {
  position: relative;
  width: var(--pw);
  height: calc(var(--pw) * 19.5 / 9);
  padding: calc(var(--pw) * 0.024);
  border-radius: calc(var(--pw) * 0.13);
  background: linear-gradient(145deg, #202026, #050507 55%, #17171b);
  box-shadow:
    0 0 0 calc(var(--pw) * 0.004) #2c2c33,
    0 calc(var(--pw) * 0.05) calc(var(--pw) * 0.13) rgba(0, 0, 0, 0.75),
    inset 0 0 0 calc(var(--pw) * 0.006) #000;
}
/* On a real phone, always fill the whole screen whatever its aspect ratio (no side bars). */
@media (max-width: 500px) {
  .stage[data-bare="true"] {
    --pw: 100vw;
  }
}
.stage[data-bare="true"] .phone {
  height: 100dvh;
  padding: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
}
.screen {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: calc(var(--pw) * 0.105);
  container-type: inline-size;
  background: linear-gradient(180deg, var(--bg-top), var(--bg-bottom));
}
.stage[data-bare="true"] .screen {
  border-radius: 0;
}

.app {
  --u: calc(100cqw / 390);
  --sep: color-mix(in srgb, var(--text) 11%, transparent);
  --sheet-bg: color-mix(in srgb, var(--bg-top), var(--bg-bottom) 40%);
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  color: var(--text);
  font-size: calc(13 * var(--u));
  line-height: 1.25;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.up {
  color: var(--profit);
}
.down {
  color: var(--loss);
}
.muted {
  color: var(--muted);
}

/* notch + status bar */
.notch {
  position: absolute;
  z-index: 6;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: calc(168 * var(--u));
  height: calc(30 * var(--u));
  background: #000;
  border-radius: 0 0 calc(20 * var(--u)) calc(20 * var(--u));
}
.notch::before {
  content: "";
  position: absolute;
  left: 50%;
  top: calc(9 * var(--u));
  width: calc(46 * var(--u));
  height: calc(5 * var(--u));
  transform: translateX(-50%);
  border-radius: 9px;
  background: #19191d;
}
.notch::after {
  content: "";
  position: absolute;
  left: calc(50% + 62 * var(--u));
  top: calc(8 * var(--u));
  width: calc(8 * var(--u));
  height: calc(8 * var(--u));
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #25324f, #0b0d14 70%);
}
.home-ind {
  position: absolute;
  z-index: 7;
  left: 50%;
  bottom: calc(8 * var(--u));
  transform: translateX(-50%);
  width: calc(134 * var(--u));
  height: calc(5 * var(--u));
  border-radius: 9px;
  background: var(--text);
  opacity: 0.85;
  pointer-events: none;
}

.statusbar {
  position: relative;
  z-index: 3;
  flex: none;
  height: calc(30 * var(--u));
  padding: calc(1 * var(--u)) calc(18 * var(--u)) 0 calc(24 * var(--u));
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: calc(14.5 * var(--u));
  font-weight: 600;
  letter-spacing: -0.01em;
}
.stage[data-bare="true"] .statusbar {
  height: calc(30 * var(--u) + env(safe-area-inset-top, 0px));
  padding: calc(8 * var(--u) + env(safe-area-inset-top, 0px)) calc(20 * var(--u)) 0 calc(22 * var(--u));
}
.sb-icons {
  display: flex;
  align-items: center;
  gap: calc(4 * var(--u));
  height: calc(18 * var(--u));
}
.sb-icons svg {
  display: block;
  height: calc(11 * var(--u));
  width: auto;
}
.sb-4g {
  font-size: calc(10.5 * var(--u));
  font-weight: 700;
}
.sb-batt svg {
  height: calc(12 * var(--u));
}

.appbar {
  flex: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: calc(2 * var(--u));
  padding: 0 calc(16 * var(--u));
}
.brand {
  display: flex;
  align-items: center;
  gap: calc(6 * var(--u));
  font-size: calc(12.5 * var(--u));
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--accent);
}
.brand-mark svg {
  display: block;
  width: calc(17 * var(--u));
  height: calc(17 * var(--u));
}
.demo-tag {
  font-size: calc(8.5 * var(--u));
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: calc(3.5 * var(--u)) calc(8 * var(--u));
  border-radius: 99px;
  color: var(--text);
  background: color-mix(in srgb, var(--text) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--text) 22%, transparent);
}

/* ---------- viewport / panes / tab bar ---------- */

.viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.pane {
  position: absolute;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  padding: 0 calc(16 * var(--u)) calc(18 * var(--u));
  animation: pane-fwd 0.27s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.pane.back {
  animation-name: pane-back;
}
.pane::-webkit-scrollbar {
  display: none;
}
@keyframes pane-fwd {
  from {
    opacity: 0;
    transform: translateX(calc(18 * var(--u)));
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes pane-back {
  from {
    opacity: 0;
    transform: translateX(calc(-18 * var(--u)));
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.tabbar {
  flex: none;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: calc(5 * var(--u)) calc(6 * var(--u)) calc(26 * var(--u));
  background: color-mix(in srgb, var(--bg-top) 72%, transparent);
  border-top: 1px solid var(--sep);
  backdrop-filter: blur(10px);
}
.stage[data-bare="true"] .tabbar {
  padding-bottom: calc(8 * var(--u) + env(safe-area-inset-bottom, 0px));
}
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(2 * var(--u));
  padding: calc(3 * var(--u)) 0;
  color: var(--muted);
  font-size: calc(10.5 * var(--u));
  font-weight: 600;
  border-radius: calc(12 * var(--u));
  transition: color 0.2s, transform 0.12s;
}
.tab:active {
  transform: scale(0.93);
}
.tab-ico {
  display: grid;
  place-items: center;
  width: calc(46 * var(--u));
  height: calc(26 * var(--u));
  border-radius: calc(13 * var(--u));
  transition: background 0.25s;
}
.tab-ico svg {
  width: calc(22 * var(--u));
  height: calc(22 * var(--u));
  display: block;
}
.tab.on {
  color: var(--accent);
  font-weight: 800;
}
.tab.on .tab-ico {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
}

/* ---------- shared bits ---------- */

.icon-btn {
  width: calc(40 * var(--u));
  height: calc(40 * var(--u));
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--accent);
  transition: background 0.15s, transform 0.12s;
}
.icon-btn:active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  transform: scale(0.9);
}
.icon-btn svg {
  width: calc(23 * var(--u));
  height: calc(23 * var(--u));
  display: block;
}
.icon-btn.small {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
}
.icon-btn.small svg {
  width: calc(20 * var(--u));
  height: calc(20 * var(--u));
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: calc(6 * var(--u)) 0 calc(10 * var(--u));
}
.page-head h1 {
  margin: 0;
  font-size: calc(21 * var(--u));
  font-weight: 600;
  letter-spacing: -0.015em;
}
.page-sub {
  font-size: calc(11 * var(--u));
  color: var(--muted);
}
.empty {
  text-align: center;
  color: var(--muted);
  padding: calc(34 * var(--u)) 0;
  font-size: calc(12.5 * var(--u));
}
.fine {
  font-size: calc(10 * var(--u));
  color: var(--muted);
  text-align: center;
  margin: calc(10 * var(--u)) 0 0;
}
.fine.left {
  text-align: left;
  margin: calc(6 * var(--u)) 0 calc(4 * var(--u));
  line-height: 1.4;
}

.cta {
  width: 100%;
  margin-top: calc(12 * var(--u));
  padding: calc(13 * var(--u)) calc(14 * var(--u));
  border-radius: calc(13 * var(--u));
  background: var(--accent);
  color: var(--on-accent);
  font-size: calc(14 * var(--u));
  font-weight: 650;
  letter-spacing: 0.005em;
  transition: transform 0.12s, filter 0.15s;
}
.cta:active {
  transform: scale(0.975);
  filter: brightness(0.93);
}
.cta.buy {
  background: var(--buy);
  color: var(--on-buy);
}
.cta.sell {
  background: var(--sell);
  color: var(--on-sell);
}
.cta.ghost {
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--accent);
}
.btn-row {
  display: flex;
  gap: calc(10 * var(--u));
}
.btn-row .cta {
  flex: 1;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: calc(6 * var(--u));
  margin: calc(4 * var(--u)) 0 calc(12 * var(--u));
}
.chips.scroll {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  margin: calc(2 * var(--u)) calc(-16 * var(--u)) calc(8 * var(--u));
  padding: 0 calc(16 * var(--u));
}
.chips.scroll::-webkit-scrollbar {
  display: none;
}
.chip {
  flex: none;
  padding: calc(6.5 * var(--u)) calc(12 * var(--u));
  border-radius: 99px;
  font-size: calc(11.5 * var(--u));
  font-weight: 650;
  background: color-mix(in srgb, var(--text) 7%, transparent);
  transition: background 0.2s, color 0.2s, transform 0.12s;
}
.chip:active {
  transform: scale(0.95);
}
.chip.on {
  background: var(--accent);
  color: var(--on-accent);
}

.seg {
  display: flex;
  background: color-mix(in srgb, var(--text) 7%, transparent);
  padding: 2px;
  border-radius: calc(10 * var(--u));
}
.seg button {
  flex: 1;
  padding: calc(5.5 * var(--u)) calc(10 * var(--u));
  border-radius: calc(8 * var(--u));
  font-size: calc(11 * var(--u));
  font-weight: 600;
  color: var(--muted);
  transition: background 0.2s, color 0.2s;
}
.seg button.on {
  background: var(--sheet-bg);
  color: var(--accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
}

/* ---------- Trade ---------- */

.acct-head {
  display: grid;
  grid-template-columns: calc(40 * var(--u)) 1fr calc(40 * var(--u));
  align-items: center;
  padding: calc(2 * var(--u)) 0 calc(4 * var(--u));
}
.headline {
  text-align: center;
  color: var(--accent);
  font-size: calc(27 * var(--u));
  font-weight: 600;
  letter-spacing: -0.012em;
}
.headline.up {
  color: var(--profit);
}

.headline.down {
  color: var(--loss);
}
.headline small {
  font-size: 0.86em;
  font-weight: 500;
}
.summary {
  margin: calc(8 * var(--u)) 0 0;
}
.sum-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: calc(6.5 * var(--u)) 0;
  font-size: calc(15.5 * var(--u));
}
.sum-row dt {
  color: color-mix(in srgb, var(--text) 86%, transparent);
}
.sum-row dd {
  margin: 0;
  font-weight: 600;
}
.summary.compact {
  border: 1px solid var(--sep);
  border-radius: calc(13 * var(--u));
  padding: calc(3 * var(--u)) calc(13 * var(--u));
  margin: 0 0 calc(4 * var(--u));
}

.pos-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: calc(10 * var(--u));
  padding: calc(2 * var(--u)) 0;
  border-bottom: 1px solid var(--sep);
}
.pos-head h3 {
  margin: 0;
  font-size: calc(14 * var(--u));
  font-weight: 700;
  letter-spacing: 0.01em;
}

.swipe {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--sep);
}
.swipe-action {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--loss);
  color: #fff;
  font-size: calc(12.5 * var(--u));
  font-weight: 650;
  transition: width 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.swipe-action span {
  white-space: nowrap;
}
.swipe-content {
  position: relative;
  cursor: pointer;
  user-select: none;
  touch-action: pan-y;
  outline-offset: -2px;
  transition: transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.pos-row,
.hist-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: calc(10 * var(--u)) 0;
  transition: background 0.15s;
}
.hist-row {
  border-bottom: 1px solid var(--sep);
}
.swipe-content:active .pos-row {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}
.pos-top {
  display: flex;
  align-items: baseline;
  gap: calc(6 * var(--u));
  font-size: calc(16.5 * var(--u));
}
.pos-sym {
  font-weight: 800;
  letter-spacing: -0.012em;
}
.pos-top.buy .pos-side,
.pos-top.buy .pos-lots {
  color: var(--buy);
}
.pos-top.sell .pos-side,
.pos-top.sell .pos-lots {
  color: var(--sell);
}
.pos-side {
  font-weight: 600;
}
.pos-prices {
  margin-top: calc(3 * var(--u));
  font-size: calc(14.5 * var(--u));
  font-weight: 500;
  color: var(--muted);
}
.pos-prices i {
  font-style: normal;
  margin: 0 calc(2 * var(--u));
}
.pos-pl {
  font-size: calc(19 * var(--u));
  font-weight: 650;
  letter-spacing: -0.005em;
}
.hist-right {
  text-align: right;
}
.hist-right small {
  display: block;
  margin-top: calc(2 * var(--u));
  font-size: calc(11.5 * var(--u));
  color: var(--muted);
}

/* ---------- Quotes ---------- */

.q-cols,
.q-row {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr 0.85fr calc(12 * var(--u));
  gap: calc(6 * var(--u));
  align-items: center;
}
.q-cols {
  padding: calc(4 * var(--u)) 0;
  font-size: calc(9.5 * var(--u));
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  border-bottom: 1px solid var(--sep);
}
.q-cols span:nth-child(4) {
  text-align: right;
}
.q-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.q-row {
  width: 100%;
  padding: calc(10 * var(--u)) 0;
  text-align: left;
  border-bottom: 1px solid var(--sep);
  transition: background 0.15s;
}
.q-row:active {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}
.q-sym b {
  display: block;
  font-size: calc(15.5 * var(--u));
  font-weight: 700;
}
.q-sym small {
  display: block;
  margin-top: calc(1 * var(--u));
  font-size: calc(11 * var(--u));
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.q-px {
  font-size: calc(15 * var(--u));
  font-weight: 600;
  transition: color 0.4s;
}
.q-px.tick-up {
  color: var(--buy);
}
.q-px.tick-down {
  color: var(--sell);
}
.q-chg {
  font-size: calc(13.5 * var(--u));
  font-weight: 600;
  text-align: right;
}
.q-go {
  color: var(--muted);
  opacity: 0.55;
}
.q-go svg {
  width: calc(12 * var(--u));
  height: calc(12 * var(--u));
  display: block;
}

/* ---------- Chart ---------- */

.chart-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin: calc(6 * var(--u)) 0 calc(4 * var(--u));
}
.chart-sym {
  font-size: calc(17 * var(--u));
  font-weight: 700;
}
.chart-head small {
  margin-left: calc(6 * var(--u));
  font-size: calc(11 * var(--u));
  color: var(--muted);
}
.chart-px {
  text-align: right;
}
.chart-px b {
  font-size: calc(19 * var(--u));
  font-weight: 600;
  color: var(--accent);
}
.chart-px small {
  display: block;
  margin: 0;
  font-weight: 600;
}
.tf-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: calc(4 * var(--u)) 0 calc(6 * var(--u));
}
.tf-pills {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: calc(10 * var(--u));
  background: color-mix(in srgb, var(--text) 7%, transparent);
}
.tf-pills button {
  padding: calc(5.5 * var(--u)) calc(9 * var(--u));
  border-radius: calc(8 * var(--u));
  font-size: calc(11 * var(--u));
  font-weight: 650;
  color: var(--muted);
  transition: background 0.2s, color 0.2s;
}
.tf-pills button.on {
  background: var(--sheet-bg);
  color: var(--accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
}
.zoom {
  display: flex;
}
.zoom button {
  width: calc(30 * var(--u));
  height: calc(30 * var(--u));
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--accent);
}
.zoom button:active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
}
.zoom svg {
  width: calc(19 * var(--u));
  height: calc(19 * var(--u));
}
.chart-box {
  border-radius: calc(13 * var(--u));
  border: 1px solid var(--sep);
  background: var(--sheet-bg);
  overflow: hidden;
}
.chart-svg {
  display: block;
  width: 100%;
  height: auto;
  touch-action: pan-y;
  user-select: none;
  cursor: crosshair;
}
.c-grid {
  stroke: var(--sep);
  stroke-width: 0.5;
}
.c-axis {
  font-size: 9px;
  fill: var(--muted);
}
.c-up {
  --k: var(--profit);
}
.c-down {
  --k: var(--loss);
}
.c-up line,
.c-down line {
  stroke: var(--k);
  stroke-width: 1;
}
.c-up rect,
.c-down rect {
  fill: var(--k);
}
.c-pos line {
  stroke-width: 0.9;
  stroke-dasharray: 4 3;
}
.c-pos.buy line {
  stroke: var(--buy);
}
.c-pos.sell line {
  stroke: var(--sell);
}
.c-pos text {
  font-size: 8.5px;
  font-weight: 700;
}
.c-pos.buy text {
  fill: var(--buy);
}
.c-pos.sell text {
  fill: var(--sell);
}
.c-last {
  stroke: var(--accent);
  stroke-width: 0.8;
  stroke-dasharray: 2 3;
}
.c-tag {
  fill: var(--accent);
}
.c-tag-t {
  font-size: 9px;
  font-weight: 700;
  fill: var(--on-accent);
}
.c-cross line {
  stroke: var(--muted);
  stroke-width: 0.7;
  stroke-dasharray: 2 2;
}
.c-cross-tag {
  fill: var(--text);
}
.c-cross text {
  font-size: 9px;
  font-weight: 700;
  fill: var(--bg-top);
}
.ohlc {
  display: flex;
  justify-content: space-between;
  gap: calc(8 * var(--u));
  padding: calc(7 * var(--u)) calc(12 * var(--u));
  font-size: calc(10.5 * var(--u));
  color: var(--muted);
  border-top: 1px solid var(--sep);
}
.chart-actions {
  margin-top: calc(2 * var(--u));
}

/* ---------- History ---------- */

.day-head {
  display: flex;
  justify-content: space-between;
  margin: calc(14 * var(--u)) 0 calc(2 * var(--u));
  font-size: calc(10.5 * var(--u));
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.day-head span:last-child {
  letter-spacing: 0;
  font-weight: 600;
}

/* ---------- Sheets ---------- */

.sheet-root {
  position: absolute;
  inset: 0;
  z-index: 30;
  pointer-events: none;
}
.sheet-root.is-open {
  pointer-events: auto;
}
.sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 8, 18, 0.45);
  opacity: 0;
  transition: opacity 0.26s;
}
.is-open .sheet-backdrop {
  opacity: 1;
}
.sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 88%;
  display: flex;
  flex-direction: column;
  background: var(--sheet-bg);
  border-radius: calc(24 * var(--u)) calc(24 * var(--u)) 0 0;
  box-shadow: 0 calc(-8 * var(--u)) calc(30 * var(--u)) rgba(0, 0, 0, 0.25);
  transform: translateY(104%);
  transition: transform 0.32s cubic-bezier(0.2, 0.9, 0.25, 1);
}
.is-open .sheet {
  transform: translateY(0);
}
.sheet-grab {
  flex: none;
  display: grid;
  place-items: center;
  padding: calc(10 * var(--u)) 0 calc(6 * var(--u));
  touch-action: none;
  cursor: grab;
}
.sheet-grab span {
  width: calc(38 * var(--u));
  height: calc(4.5 * var(--u));
  border-radius: 9px;
  background: color-mix(in srgb, var(--text) 24%, transparent);
}
.sheet-title {
  margin: 0;
  padding: calc(2 * var(--u)) calc(18 * var(--u)) calc(8 * var(--u));
  font-size: calc(15 * var(--u));
  font-weight: 650;
}
.sheet-body {
  padding: 0 calc(18 * var(--u)) calc(30 * var(--u));
  overflow-y: auto;
  scrollbar-width: none;
}
.sheet-body::-webkit-scrollbar {
  display: none;
}
.stage[data-bare="true"] .sheet-body {
  padding-bottom: calc(22 * var(--u) + env(safe-area-inset-bottom, 0px));
}
.sheet-note {
  margin: calc(10 * var(--u)) 0 0;
  font-size: calc(10.5 * var(--u));
  line-height: 1.4;
  color: var(--muted);
}
.kv {
  margin: 0;
}
.kv > div {
  display: flex;
  justify-content: space-between;
  gap: calc(12 * var(--u));
  padding: calc(9 * var(--u)) 0;
  border-bottom: 1px solid var(--sep);
  font-size: calc(13 * var(--u));
}
.kv dt {
  color: var(--muted);
}
.kv dd {
  margin: 0;
  font-weight: 550;
  text-align: right;
}
.menu-list {
  display: flex;
  flex-direction: column;
}
.menu-item {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: calc(14 * var(--u)) calc(2 * var(--u));
  border-bottom: 1px solid var(--sep);
  font-size: calc(14 * var(--u));
  text-align: left;
  text-transform: capitalize;
}
.menu-item:active {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.menu-item.on {
  color: var(--accent);
  font-weight: 650;
}
.menu-item.danger {
  color: var(--loss);
  border-bottom: 0;
}

.side-pick {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: calc(10 * var(--u));
}
.side {
  display: flex;
  flex-direction: column;
  gap: calc(2 * var(--u));
  padding: calc(12 * var(--u));
  border-radius: calc(13 * var(--u));
  border: 1.5px solid var(--sep);
  text-align: center;
  transition: border-color 0.2s, background 0.2s, transform 0.12s;
}
.side:active {
  transform: scale(0.97);
}
.side small {
  font-size: calc(10.5 * var(--u));
  color: var(--muted);
}
.side b {
  font-size: calc(19 * var(--u));
  font-weight: 600;
}
.side.sell b {
  color: var(--sell);
}
.side.buy b {
  color: var(--buy);
}
.side.sell.on {
  border-color: var(--sell);
  background: color-mix(in srgb, var(--sell) 10%, transparent);
}
.side.buy.on {
  border-color: var(--buy);
  background: color-mix(in srgb, var(--buy) 10%, transparent);
}
.stepper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: calc(14 * var(--u));
  font-size: calc(13 * var(--u));
}
.stepper > div {
  display: flex;
  align-items: center;
  gap: calc(6 * var(--u));
}
.stepper button {
  width: calc(36 * var(--u));
  height: calc(36 * var(--u));
  border-radius: 50%;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  font-size: calc(21 * var(--u));
  line-height: 1;
  transition: transform 0.12s, background 0.15s;
}
.stepper button:active {
  transform: scale(0.9);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.stepper-input {
  width: calc(72 * var(--u));
  padding: calc(8 * var(--u));
  border-radius: calc(10 * var(--u));
  border: 1px solid var(--sep);
  background: transparent;
  text-align: center;
  font-weight: 650;
  font-size: calc(14 * var(--u));
}

/* ---------- Settings ---------- */

.set-intro {
  margin-bottom: calc(10 * var(--u));
  padding: calc(10 * var(--u)) calc(12 * var(--u));
  border-radius: calc(13 * var(--u));
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  font-size: calc(11.5 * var(--u));
  line-height: 1.45;
  color: var(--muted);
}
.set-intro b {
  color: var(--text);
}
.set-section {
  margin-bottom: calc(8 * var(--u));
  border: 1px solid var(--sep);
  border-radius: calc(13 * var(--u));
  overflow: hidden;
}
.set-section-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: calc(13 * var(--u)) calc(14 * var(--u));
  font-size: calc(13 * var(--u));
  font-weight: 650;
  text-align: left;
}
.set-section-head i {
  width: calc(7 * var(--u));
  height: calc(7 * var(--u));
  margin-right: calc(3 * var(--u));
  border-right: 1.7px solid var(--muted);
  border-bottom: 1.7px solid var(--muted);
  transform: rotate(45deg) translateY(-2px);
  transition: transform 0.22s;
}
.set-section.is-open .set-section-head i {
  transform: rotate(-135deg) translateY(-2px);
}
.set-section-body {
  padding: 0 calc(14 * var(--u)) calc(14 * var(--u));
  animation: fade-in 0.2s both;
}
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(calc(-4 * var(--u)));
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.field {
  display: flex;
  flex-direction: column;
  gap: calc(5 * var(--u));
  margin-top: calc(10 * var(--u));
}
.field-row {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
.field-label {
  font-size: calc(11.5 * var(--u));
  font-weight: 650;
}
.field-label em {
  display: block;
  font-style: normal;
  font-weight: 400;
  font-size: calc(10 * var(--u));
  color: var(--muted);
}
.input {
  width: 100%;
  padding: calc(9 * var(--u)) calc(10 * var(--u));
  border-radius: calc(10 * var(--u));
  border: 1px solid color-mix(in srgb, var(--text) 18%, transparent);
  background: color-mix(in srgb, var(--text) 5%, transparent);
  font-size: calc(13 * var(--u));
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 calc(3 * var(--u)) color-mix(in srgb, var(--accent) 20%, transparent);
}
select.input {
  color: var(--text);
}
select.input option {
  color: #111;
}
.area {
  margin-top: calc(10 * var(--u));
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: calc(10.5 * var(--u));
}
.switch {
  position: relative;
  flex: none;
  width: calc(46 * var(--u));
  height: calc(27 * var(--u));
  border-radius: 99px;
  background: color-mix(in srgb, var(--text) 22%, transparent);
  transition: background 0.22s;
}
.switch span {
  position: absolute;
  top: calc(3 * var(--u));
  left: calc(3 * var(--u));
  width: calc(21 * var(--u));
  height: calc(21 * var(--u));
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.22s cubic-bezier(0.3, 0.9, 0.3, 1);
}
.switch.on {
  background: var(--accent);
}
.switch.on span {
  transform: translateX(calc(19 * var(--u)));
}
.edit-card {
  margin-top: calc(10 * var(--u));
  padding: calc(10 * var(--u));
  border: 1px solid var(--sep);
  border-radius: calc(11 * var(--u));
}
.edit-top {
  display: flex;
  align-items: center;
  gap: calc(8 * var(--u));
  font-size: calc(12.5 * var(--u));
}
.edit-top .up,
.edit-top .down {
  margin-left: auto;
  font-weight: 650;
}
.edit-top .muted {
  font-size: calc(11 * var(--u));
}
.edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: calc(8 * var(--u));
  margin-top: calc(8 * var(--u));
}
.edit-grid label {
  display: flex;
  flex-direction: column;
  gap: calc(4 * var(--u));
  font-size: calc(10.5 * var(--u));
  font-weight: 650;
  color: var(--muted);
}
.mini {
  padding: calc(7 * var(--u)) calc(12 * var(--u));
  border-radius: calc(9 * var(--u));
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--accent);
  font-size: calc(11.5 * var(--u));
  font-weight: 650;
  transition: transform 0.12s, background 0.2s;
}
.mini:active {
  transform: scale(0.95);
}
.mini.danger {
  color: var(--loss);
  background: color-mix(in srgb, var(--loss) 13%, transparent);
}
.mini.danger.armed {
  background: var(--loss);
  color: #fff;
}
.inline {
  display: flex;
  align-items: center;
  gap: calc(8 * var(--u));
  margin-top: calc(8 * var(--u));
}
.inline .input {
  width: calc(70 * var(--u));
}
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: calc(6 * var(--u));
  margin-top: calc(10 * var(--u));
}
.color-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: calc(8 * var(--u));
  margin-top: calc(10 * var(--u));
}
.color-field {
  display: flex;
  align-items: center;
  gap: calc(8 * var(--u));
  padding: calc(6 * var(--u)) calc(8 * var(--u));
  border: 1px solid var(--sep);
  border-radius: calc(10 * var(--u));
  font-size: calc(11 * var(--u));
  min-width: 0;
}
.color-field input {
  flex: none;
  width: calc(28 * var(--u));
  height: calc(28 * var(--u));
  padding: 0;
  border: 0;
  border-radius: calc(7 * var(--u));
  background: none;
  cursor: pointer;
}
.cf-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cf-text span {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cf-text code {
  font-size: calc(9.5 * var(--u));
  color: var(--muted);
}
.range {
  width: 100%;
  accent-color: var(--accent);
}
.foot-note {
  margin: calc(14 * var(--u)) calc(6 * var(--u)) calc(6 * var(--u));
  font-size: calc(10.5 * var(--u));
  line-height: 1.45;
  color: var(--muted);
  text-align: center;
}

/* ---------- toast ---------- */

.toast {
  position: absolute;
  z-index: 50;
  left: 50%;
  bottom: calc(100 * var(--u));
  transform: translate(-50%, calc(10 * var(--u)));
  max-width: 86%;
  padding: calc(9 * var(--u)) calc(15 * var(--u));
  border-radius: 99px;
  background: var(--text);
  color: var(--bg-top);
  font-size: calc(12 * var(--u));
  font-weight: 550;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s, transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.toast.on {
  opacity: 0.96;
  transform: translate(-50%, 0);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

.pos-head h3 {
  display: flex;
  align-items: center;
  gap: calc(8 * var(--u));
}
.auto-chip {
  padding: calc(2 * var(--u)) calc(7 * var(--u));
  border-radius: 99px;
  font-size: calc(8.5 * var(--u));
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.auto-chip.paused {
  color: var(--muted);
  background: color-mix(in srgb, var(--text) 9%, transparent);
}
.auto-status {
  display: flex;
  justify-content: space-between;
  margin-top: calc(10 * var(--u));
  font-size: calc(12 * var(--u));
  font-weight: 650;
}

/* Trade summary: faint dotted leaders between label and value */
.summary.dotted .sum-row { font-size: calc(17 * var(--u)); padding: calc(5.5 * var(--u)) 0; }
.summary.dotted .sum-row dt { display: flex; flex: 1; align-items: baseline; min-width: 0; }
.summary.dotted .sum-row dt::after {
  content: "";
  flex: 1;
  height: calc(2 * var(--u));
  margin: 0 calc(5 * var(--u)) 0 calc(6 * var(--u));
  background: radial-gradient(circle, color-mix(in srgb, var(--text) 32%, transparent) 0.55px, transparent 0.9px) 0 50% / calc(3.4 * var(--u)) calc(2 * var(--u)) repeat-x;
}
`;

export default function Page() {
  // Render only in the browser: the app reads localStorage and the clock, which would
  // otherwise differ between server HTML and client and cause a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div id="metaluna-root">
      <style>{MOBILE_CSS}</style>
      {mounted ? <MetaLuna /> : <div style={{ position: "fixed", inset: 0, background: "#07070b" }} />}
    </div>
  );
}
