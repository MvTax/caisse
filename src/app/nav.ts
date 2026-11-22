/** Navigation par pile d'écrans (façon iOS) + deux onglets. */
import { computed, signal } from '@preact/signals';
import type { FlowState } from '../domain/flow';

export type Screen =
  | { name: 'home' }
  | { name: 'drinks' }
  | { name: 'flow'; state: FlowState }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'stats' }
  | { name: 'settings' };

export type Tab = 'order' | 'orders';

export const tab = signal<Tab>('order');
export const stack = signal<Screen[]>([{ name: 'home' }]);
/** Sens de la dernière transition, pour l'animation. */
export const direction = signal<'forward' | 'back'>('forward');

export const current = computed<Screen>(
  () => stack.value[stack.value.length - 1] ?? { name: 'home' },
);

export function push(s: Screen): void {
  direction.value = 'forward';
  stack.value = [...stack.value, s];
  window.scrollTo(0, 0);
}

export function pop(): void {
  direction.value = 'back';
  stack.value = stack.value.length > 1 ? stack.value.slice(0, -1) : stack.value;
}

/** Remplace l'écran courant (ex. étape suivante du parcours). */
export function replace(s: Screen, dir: 'forward' | 'back' = 'forward'): void {
  direction.value = dir;
  stack.value = [...stack.value.slice(0, -1), s];
  window.scrollTo(0, 0);
}

export function resetTo(...screens: Screen[]): void {
  direction.value = 'forward';
  stack.value = [{ name: 'home' }, ...screens];
  window.scrollTo(0, 0);
}

export function switchTab(t: Tab): void {
  tab.value = t;
  if (t === 'order') stack.value = [stack.value[0] ?? { name: 'home' }];
  window.scrollTo(0, 0);
}
