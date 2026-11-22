import { describe, expect, it } from 'vitest';
import { MENU } from '../../src/data/menu';
import {
  back,
  choose,
  currentStep,
  startFlow,
  stepTitle,
  toggleSupplement,
  type FlowResult,
  type FlowState,
} from '../../src/domain/flow';

const cat = (id: string) => MENU.categories.find((c) => c.id === id)!;
const state = (r: FlowResult): FlowState => {
  if (r.kind !== 'next') throw new Error('attendu : étape suivante');
  return r.state;
};

describe('parcours déclaratif', () => {
  it('smoothie : produit → taille → terminé', () => {
    const c = cat('smoothies');
    let s = state(startFlow(c));
    expect(stepTitle(c, currentStep(c, s)!)).toBe('Choisir le smoothie');
    s = state(choose(c, s, 'tahiti'));
    expect(currentStep(c, s)).toBe('size');
    expect(choose(c, s, 'grand')).toEqual({
      kind: 'done',
      sel: { productId: 'tahiti', sizeId: 'grand' },
    });
  });

  it('crêpe : format → nappage → suppléments → service', () => {
    const c = cat('crepes');
    let s = state(startFlow(c));
    expect(stepTitle(c, currentStep(c, s)!)).toBe('Crêpe ou Gaufre ?');
    s = state(choose(c, s, 'gaufre'));
    expect(stepTitle(c, currentStep(c, s)!)).toBe('Choisir le nappage');
    s = state(choose(c, s, 'chocolat'));
    s = toggleSupplement(s, 'oreo');
    s = toggleSupplement(s, 'banane');
    s = toggleSupplement(s, 'banane');
    s = state(choose(c, s, ''));
    expect(stepTitle(c, currentStep(c, s)!)).toBe('Sur place ou à emporter ?');
    const done = choose(c, s, 'surplace');
    expect(done).toEqual({
      kind: 'done',
      sel: {
        formatId: 'gaufre',
        toppingId: 'chocolat',
        supplementIds: ['oreo'],
        service: 'surplace',
      },
    });
  });

  it('retour arrière conserve les choix ; changer de format sans tout recommencer', () => {
    const c = cat('glaces');
    let s = state(startFlow(c));
    s = state(choose(c, s, 'cornet'));
    const r = back(s)!;
    expect(r.stepIndex).toBe(0);
    expect(r.sel.formatId).toBe('cornet');
    s = state(choose(c, r, 'pot'));
    expect(s.sel.formatId).toBe('pot');
    expect(back(state(startFlow(c)))).toBeNull();
  });

  it('glace : le petit disparaît en passant de cornet à pot', () => {
    const c = cat('glaces');
    const s: FlowState = {
      categoryId: 'glaces',
      stepIndex: 0,
      sel: { formatId: 'cornet', sizeId: 'petit' },
    };
    expect(state(choose(c, s, 'pot')).sel.sizeId).toBeUndefined();
    const s2: FlowState = { ...s, sel: { formatId: 'cornet', sizeId: 'grand' } };
    expect(state(choose(c, s2, 'pot')).sel.sizeId).toBe('grand');
  });

  it('sandwich : ajout direct, sans étape', () => {
    expect(startFlow(cat('sandwich'))).toEqual({ kind: 'done', sel: { productId: 'sandwich' } });
  });

  it('sodas : un seul choix', () => {
    const c = cat('softs');
    expect(choose(c, state(startFlow(c)), 'eau')).toEqual({
      kind: 'done',
      sel: { productId: 'eau' },
    });
  });
});
