import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/storage/settings';
import {
  emptyData,
  loadData,
  saveData,
  STORAGE_KEY,
  type StorageLike,
} from '../../src/storage/store';
import { v1MoneyToCents, V1_KEY } from '../../src/storage/migrateV1';

class MemStorage implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

// Fixture réaliste de la v1 (format de MA_Commander_v1.html).
const t1 = Date.UTC(2026, 10, 21, 13, 2); // 21/11 14:02 Paris
const t2 = Date.UTC(2026, 10, 21, 13, 30);
const t3 = Date.UTC(2026, 10, 22, 9, 0);
const V1 = {
  orders: [
    {
      id: t3,
      items: [
        {
          cat: 'softs',
          catLabel: 'Sodas & Eau',
          catEmoji: '💧',
          dot: '#3a86ff',
          item: "Bouteille d'eau",
          size: '–',
          price: '2,20€',
        },
      ],
      bipper: '3',
      done: false,
      time: '10:00',
      payment: 'card',
      cashGiven: null,
      change: null,
    },
    {
      id: t2,
      items: [
        {
          cat: 'crepes',
          catLabel: 'Crêpes & Gaufres',
          item: 'Gaufre Chocolat',
          size: 'Oreo · Chantilly',
          price: '5,85€',
          supplements: ['Oreo', 'Chantilly'],
          service: 'Sur place',
        },
        {
          cat: 'glaces',
          catLabel: 'Glaces Pot',
          item: 'Glace Pot Grand',
          size: 'Grand',
          price: '4,50€',
        },
      ],
      bipper: '7',
      done: true,
      time: '14:30',
      payment: 'cash',
      cashGiven: 20,
      change: 9.65,
    },
    {
      id: t1,
      items: [
        { cat: 'smoothies', catLabel: 'Smoothies', item: 'Tahiti', size: 'Moyen', price: '6,75€' },
      ],
      bipper: 12,
      done: true,
      time: '14:02',
      payment: null,
      cashGiven: null,
      change: null,
    },
  ],
  autoPrint: false,
  bridgeIp: '192.168.1.122',
  printerIp: '192.168.1.200',
  printerPort: 9100,
};

describe('v1MoneyToCents', () => {
  it.each([
    ['6,50€', 650],
    ['6.50', 650],
    [6.5, 650],
    [9.65, 965],
    [0.1 + 0.2, 30],
    [20, 2000],
    [null, null],
    ['', null],
  ])('%s → %s', (v, c) => expect(v1MoneyToCents(v)).toBe(c));
});

describe('store', () => {
  it('vide → données par défaut', () => {
    const r = loadData(new MemStorage());
    expect(r.data).toEqual(emptyData());
    expect(r.importedFromV1).toBe(0);
  });

  it('aller-retour sauvegarde / lecture', () => {
    const s = new MemStorage();
    const d = emptyData();
    d.lastBipper = '5';
    expect(saveData(s, d)).toBeNull();
    expect(loadData(s).data).toEqual(d);
  });

  it('complète les réglages manquants (nouvelle version)', () => {
    const s = new MemStorage();
    s.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 3, settings: { copies: 2 }, orders: [] }),
    );
    const d = loadData(s).data;
    expect(d.settings).toEqual({ ...DEFAULT_SETTINGS, copies: 2 });
    expect(d.cart).toEqual([]);
  });

  it('anciens réglages nettoyés, liste de bippers par défaut', () => {
    const s = new MemStorage();
    s.setItem(STORAGE_KEY, JSON.stringify({ settings: { bipperMax: 20, bippers: 'oups' } }));
    const st = loadData(s).data.settings;
    expect('bipperMax' in st).toBe(false);
    expect(st.bippers).toHaveLength(11);
  });

  it('imprimante : Epson Wi-Fi par défaut, valeur invalide corrigée, passerelle conservée', () => {
    expect(DEFAULT_SETTINGS.printerMode).toBe('epson');
    expect(DEFAULT_SETTINGS.epsonIp).toBe('192.168.1.103');
    const s = new MemStorage();
    expect(DEFAULT_SETTINGS.epsonFormat).toBe('escpos');
    s.setItem(
      STORAGE_KEY,
      JSON.stringify({ settings: { printerMode: 'fax', epsonIp: '', epsonFormat: 'pdf' } }),
    );
    expect(loadData(s).data.settings).toMatchObject({
      printerMode: 'epson',
      epsonIp: '192.168.1.103',
      epsonFormat: 'escpos',
    });
    s.setItem(STORAGE_KEY, JSON.stringify({ settings: { epsonFormat: 'text' } }));
    expect(loadData(s).data.settings.epsonFormat).toBe('text');
    s.setItem(STORAGE_KEY, JSON.stringify({ settings: { printerMode: 'bridge' } }));
    expect(loadData(s).data.settings.printerMode).toBe('bridge');
  });

  it('JSON corrompu → pas de plantage', () => {
    const s = new MemStorage();
    s.setItem(STORAGE_KEY, '{oups');
    const r = loadData(s);
    expect(r.error).toBeTruthy();
    expect(r.data.orders).toEqual([]);
  });

  it('quota dépassé → message, pas d’exception', () => {
    const s: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(saveData(s, emptyData())).toMatch(/impossible/);
  });

  it('stockage indisponible (mode privé)', () => {
    expect(loadData(null).error).toBeTruthy();
    expect(saveData(null, emptyData())).toBeTruthy();
  });
});

describe('migration v1 → v3', () => {
  const s = new MemStorage();
  s.setItem(V1_KEY, JSON.stringify(V1));
  const r = loadData(s);
  const byBipper = (b: string) => r.data.orders.find((o) => o.bipper === b)!;

  it('importe toutes les commandes, plus récentes d’abord, sans effacer la v1', () => {
    expect(r.importedFromV1).toBe(3);
    expect(r.data.orders.map((o) => o.bipper)).toEqual(['3', '7', '12']);
    expect(s.getItem(V1_KEY)).not.toBeNull();
    expect(r.data.schemaVersion).toBe(3);
  });

  it('prix en centimes, totaux recalculés', () => {
    const o = byBipper('7');
    expect(o.lines.map((l) => l.unitPrice)).toEqual([585, 450]);
    expect(o.total).toBe(1035);
    expect(o.payment).toEqual({ method: 'cash', cashGiven: 2000, change: 965 });
    expect(o.status).toBe('done');
    expect(o.legacy).toBe(true);
  });

  it('options reconstituées (crêpe, glace, taille de boisson)', () => {
    const [gaufre, glace] = byBipper('7').lines;
    expect(gaufre).toMatchObject({
      displayName: 'Gaufre Chocolat',
      options: {
        format: 'Gaufre',
        supplements: ['Oreo', 'Chantilly'],
        service: 'surplace',
        supplementPrice: 95,
      },
    });
    expect(gaufre!.options.size).toBeUndefined();
    expect(glace).toMatchObject({
      displayName: 'Glace Pot',
      options: { format: 'Pot', size: 'Grand' },
    });
    expect(byBipper('12').lines[0]).toMatchObject({
      productId: 'tahiti',
      displayName: 'Tahiti',
      options: { size: 'Moyen' },
    });
    expect(byBipper('3').lines[0]!.options.size).toBeUndefined();
  });

  it('paiement inconnu conservé, numérotation par jour, réglages repris', () => {
    expect(byBipper('12').payment.method).toBe('unknown');
    expect(byBipper('12').number).toBe(1);
    expect(byBipper('7').number).toBe(2);
    expect(byBipper('3').number).toBe(1);
    expect(r.data.counters).toEqual({ day: '2026-11-22', lastNumber: 1 });
    expect(r.data.settings.autoPrint).toBe(false);
  });

  it('une fois la nouvelle clé écrite, la v1 n’est plus relue', () => {
    saveData(s, emptyData());
    expect(loadData(s).importedFromV1).toBe(0);
  });
});
