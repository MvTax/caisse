/**
 * Persistance localStorage versionnée (CLAUDE.md §10).
 * Clé `ma_commander` : { schemaVersion, settings, orders, menuOverrides, counters, ... }.
 * La clé de l'ancienne version (`ma_commander_v2`) est importée une fois et n'est jamais supprimée.
 */
import type { Cart } from '../domain/cart';
import type { Counters, Order } from '../domain/order';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { migrateV1, V1_KEY } from './migrateV1';

export const STORAGE_KEY = 'ma_commander';
export const SCHEMA_VERSION = 3;

export interface AppData {
  schemaVersion: number;
  settings: Settings;
  orders: Order[];
  menuOverrides: Record<string, unknown>;
  counters: Counters;
  /** Panier en cours (survit à un rechargement). */
  cart: Cart;
  lastBipper?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, bippers: [...DEFAULT_SETTINGS.bippers] },
    orders: [],
    menuOverrides: {},
    counters: { day: '', lastNumber: 0 },
    cart: [],
  };
}

/** Normalise des données brutes (versions futures / champs manquants). */
function upgrade(raw: Partial<AppData> & { schemaVersion?: number }): AppData {
  const base = emptyData();
  // Ajouter ici les migrations v3 → v4, etc. quand le schéma évoluera.
  return {
    ...base,
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    settings: cleanSettings({ ...base.settings, ...(raw.settings ?? {}) }),
    orders: Array.isArray(raw.orders) ? raw.orders : [],
    cart: Array.isArray(raw.cart) ? raw.cart : [],
    counters: raw.counters ?? base.counters,
    menuOverrides: raw.menuOverrides ?? {},
  };
}

/** Retire les anciens réglages et corrige les types invalides. */
function cleanSettings(s: Settings & { bipperMax?: unknown }): Settings {
  const { bipperMax: _old, ...rest } = s;
  void _old;
  if (!Array.isArray(rest.bippers) || !rest.bippers.every((b) => typeof b === 'string')) {
    rest.bippers = [...DEFAULT_SETTINGS.bippers];
  }
  return rest;
}

export interface LoadResult {
  data: AppData;
  /** Nombre de commandes importées depuis la v1 (0 si aucune). */
  importedFromV1: number;
  error?: string;
}

export function loadData(storage: StorageLike | null): LoadResult {
  if (!storage) return { data: emptyData(), importedFromV1: 0, error: 'Stockage indisponible' };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) return { data: upgrade(JSON.parse(raw)), importedFromV1: 0 };
    const v1 = storage.getItem(V1_KEY);
    if (v1) {
      const data = emptyData();
      const migrated = migrateV1(JSON.parse(v1));
      data.orders = migrated.orders;
      data.counters = migrated.counters;
      data.settings = { ...data.settings, ...migrated.settings };
      return { data, importedFromV1: migrated.orders.length };
    }
    return { data: emptyData(), importedFromV1: 0 };
  } catch (e) {
    return { data: emptyData(), importedFromV1: 0, error: `Lecture impossible : ${String(e)}` };
  }
}

/** Sauvegarde ; retourne un message d'erreur (quota, mode privé) ou null. */
export function saveData(storage: StorageLike | null, data: AppData): string | null {
  if (!storage) return 'Stockage indisponible';
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return null;
  } catch (e) {
    return `Sauvegarde impossible : ${String(e)}`;
  }
}

export function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = '__ma_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
