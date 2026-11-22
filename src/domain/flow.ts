/**
 * Machine à états du parcours d'ajout d'un article (leçon v1 : plus d'étape « 3.5 »).
 * Un seul moteur pour toutes les catégories, piloté par `category.steps`.
 */
import type { Category, ServiceId, StepKind } from '../data/menu';
import { availableSizes, type Selection } from './pricing';

export interface FlowState {
  categoryId: string;
  stepIndex: number;
  sel: Selection;
}

export type FlowResult = { kind: 'next'; state: FlowState } | { kind: 'done'; sel: Selection };

export function startFlow(category: Category): FlowResult {
  const state: FlowState = { categoryId: category.id, stepIndex: 0, sel: {} };
  if (category.steps.length === 0) {
    return { kind: 'done', sel: { productId: category.products[0]?.id } };
  }
  return { kind: 'next', state };
}

export function currentStep(category: Category, state: FlowState): StepKind | undefined {
  return category.steps[state.stepIndex];
}

/** Titre contextuel ; jamais « Choisir une boisson » pour une crêpe. */
export function stepTitle(category: Category, step: StepKind): string {
  return category.stepTitles[step] ?? DEFAULT_TITLES[step];
}

const DEFAULT_TITLES: Record<StepKind, string> = {
  product: 'Choisir le produit',
  format: 'Choisir le format',
  size: 'Choisir la taille',
  topping: 'Choisir le nappage',
  supplements: 'Suppléments',
  service: 'Sur place ou à emporter ?',
};

function advance(category: Category, state: FlowState, sel: Selection): FlowResult {
  const stepIndex = state.stepIndex + 1;
  if (stepIndex >= category.steps.length) return { kind: 'done', sel };
  return { kind: 'next', state: { ...state, stepIndex, sel } };
}

/** Choix d'une valeur pour l'étape courante (produit, format, taille, nappage, service). */
export function choose(category: Category, state: FlowState, value: string): FlowResult {
  const step = currentStep(category, state);
  const sel: Selection = { ...state.sel };
  switch (step) {
    case 'product':
      sel.productId = value;
      break;
    case 'format':
      sel.formatId = value;
      // Changer de format sans tout recommencer : on garde la taille si elle existe encore.
      if (sel.sizeId && !availableSizes(category, sel).some((s) => s.id === sel.sizeId)) {
        delete sel.sizeId;
      }
      break;
    case 'size':
      sel.sizeId = value;
      break;
    case 'topping':
      sel.toppingId = value;
      break;
    case 'service':
      sel.service = value as ServiceId;
      break;
    case 'supplements':
      return confirmSupplements(category, state);
    default:
      throw new Error('Étape inconnue');
  }
  return advance(category, state, sel);
}

export function toggleSupplement(state: FlowState, id: string): FlowState {
  const cur = state.sel.supplementIds ?? [];
  const supplementIds = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  return { ...state, sel: { ...state.sel, supplementIds } };
}

export function confirmSupplements(category: Category, state: FlowState): FlowResult {
  return advance(category, state, state.sel);
}

/** Retour à l'étape précédente (les choix sont conservés). null = sortir du parcours. */
export function back(state: FlowState): FlowState | null {
  if (state.stepIndex === 0) return null;
  return { ...state, stepIndex: state.stepIndex - 1 };
}
