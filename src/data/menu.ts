/**
 * SOURCE UNIQUE du menu et des prix (CLAUDE.md §8).
 *
 * - Tous les prix sont en CENTIMES entiers (650 = 6,50 €).
 * - Le parcours de chaque catégorie est déclaratif (`steps`) : ajouter une catégorie ou un
 *   produit = modifier ce fichier, pas le code des écrans.
 * - Les noms s'écrivent exactement comme sur la carte (« Manatthan » compris).
 */
import type { Cents } from '../domain/money';

export type CategoryId =
  | 'smoothies'
  | 'bubble'
  | 'milkshake'
  | 'jus'
  | 'softs'
  | 'crepes'
  | 'glaces'
  | 'donuts'
  | 'sandwich';

/** Étapes possibles du parcours d'ajout d'un article. */
export type StepKind = 'product' | 'format' | 'size' | 'topping' | 'supplements' | 'service';

export type ServiceId = 'emporter' | 'surplace';

export interface Choice {
  id: string;
  label: string;
}

export interface SizeOption extends Choice {
  price: Cents;
}

export interface FormatOption extends Choice {
  icon: string;
  /** Tailles propres à ce format (glaces : le pot n'existe pas en petit). */
  sizes?: SizeOption[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  /** Prix unitaire si le produit n'a pas de taille (sodas, donuts…). */
  price?: Cents;
  icon?: string;
}

export interface Category {
  id: CategoryId;
  label: string;
  group?: 'boissons';
  icon: string;
  accent: string;
  /** Ordre sur le ticket de préparation (boissons d'abord). */
  ticketOrder: number;
  products: Product[];
  steps: StepKind[];
  /** Titres contextuels des étapes (« Choisir le smoothie », « Crêpe ou Gaufre ? »…). */
  stepTitles: Partial<Record<StepKind, string>>;
  sizes?: SizeOption[];
  formats?: FormatOption[];
  toppings?: Choice[];
  supplementGroup?: SupplementGroupId;
  basePrice?: Cents;
  /** Unité affichée dans les sous-titres de tuile : « 14 recettes ». */
  countLabel?: [singular: string, plural: string];
}

export type SupplementGroupId = 'crepes';

export interface SupplementGroup {
  label: string;
  unitPrice: Cents;
  items: Choice[];
}

export interface Menu {
  version: number;
  categories: Category[];
  supplementGroups: Record<SupplementGroupId, SupplementGroup>;
  services: (Choice & { id: ServiceId; icon: string; ticketLabel: string })[];
}

const DRINK_SIZES: SizeOption[] = [
  { id: 'petit', label: 'Petit', price: 650 },
  { id: 'moyen', label: 'Moyen', price: 675 },
  { id: 'grand', label: 'Grand', price: 695 },
];

/** Copie par catégorie : les prix pourront être différenciés plus tard (§8.1). */
const drinkSizes = (): SizeOption[] => DRINK_SIZES.map((s) => ({ ...s }));

const products = (list: [id: string, name: string, description: string][]): Product[] =>
  list.map(([id, name, description]) => ({ id, name, description }));

export const MENU: Menu = {
  version: 1,
  services: [
    { id: 'emporter', label: 'À emporter', icon: '🥡', ticketLabel: 'À EMPORTER' },
    { id: 'surplace', label: 'Sur place', icon: '🍽️', ticketLabel: 'SUR PLACE' },
  ],
  supplementGroups: {
    crepes: {
      label: 'Suppléments',
      unitPrice: 95,
      items: [
        { id: 'kinder-bueno', label: 'Kinder Bueno/White' },
        { id: 'kinder-country', label: 'Kinder Country' },
        { id: 'mms', label: "M&M's" },
        { id: 'oreo', label: 'Oreo' },
        { id: 'speculoos', label: 'Spéculoos' },
        { id: 'chantilly', label: 'Chantilly' },
        { id: 'cereales', label: 'Céréales' },
        { id: 'banane', label: 'Banane' },
        { id: 'fraise', label: 'Fraise' },
        { id: 'framboise', label: 'Framboise' },
      ],
    },
  },
  categories: [
    {
      id: 'smoothies',
      label: 'Smoothies',
      group: 'boissons',
      icon: '🥤',
      accent: '#ff8c1a',
      ticketOrder: 1,
      steps: ['product', 'size'],
      stepTitles: { product: 'Choisir le smoothie', size: 'Choisir la taille' },
      countLabel: ['recette', 'recettes'],
      sizes: drinkSizes(),
      products: products([
        ['tahiti', 'Tahiti', 'Mangue, papaye, passion, banane, jus de pomme'],
        ['copacabana', 'Copacabana', 'Mangue, melon, ananas, jus de pomme'],
        ['california', 'California', 'Fraise, framboise, ananas, passion, jus de pomme'],
        ['florida', 'Florida', 'Mangue, fraise, passion, jus de pomme'],
        ['miami', 'Miami', 'Ananas, framboise, coco, gingembre, jus de pomme'],
        ['punta-cana', 'Punta Cana', 'Fraise, coco, ananas, jus de pomme'],
        ['tropicana', 'Tropicana', 'Fraise, banane, passion, jus de pomme'],
        ['cocktail-fresh', 'Cocktail Fresh', 'Ananas, framboise, fraise, menthe, jus de pomme'],
        ['mykonos', 'Mykonos', 'Mangue, framboise, ananas, passion, jus de pomme'],
        ['costa-rica', 'Costa Rica', 'Ananas, fraise, gingembre, jus de pomme'],
        ['coco-des-iles', 'Coco des Îles', 'Ananas, coco, banane, jus de pomme'],
        ['passion-caraibe', 'Passion Caraïbe', 'Mangue, ananas, passion, jus de pomme'],
        ['bahamas', 'Bahamas', 'Fraise, banane, jus de pomme'],
        ['rouge-passion', 'Rouge Passion', 'Fraise, framboise, ananas, banane, jus de pomme'],
      ]),
    },
    {
      id: 'bubble',
      label: 'Bubble Tea',
      group: 'boissons',
      icon: '🧋',
      accent: '#2bb5a3',
      ticketOrder: 2,
      steps: ['product', 'size'],
      stepTitles: { product: 'Choisir le bubble tea', size: 'Choisir la taille' },
      countLabel: ['recette', 'recettes'],
      sizes: drinkSizes(),
      products: products([
        ['sunset-tea', 'Sunset Tea', 'Thé vert glacé à la passion, perles passion'],
        ['exotic-tea', 'Exotic Tea', 'Thé vert glacé à la passion, perles ananas'],
        ['pink-beach', 'Pink Beach', 'Thé vert glacé à la passion, perles framboise'],
        ['white-peach', 'White Peach', 'Thé vert glacé à la pêche blanche, perles ananas'],
        ['mango-tea', 'Mango Tea', 'Thé vert glacé à la mangue, perles ananas'],
        ['tropical-tea', 'Tropical Tea', 'Thé vert glacé à la mangue, perles passion'],
        ['red-love', 'Red Love', 'Thé vert glacé à la fraise, perles framboises'],
        ['red-passion', 'Red Passion', 'Thé vert glacé à la fraise, perles ananas'],
      ]),
    },
    {
      id: 'milkshake',
      label: 'Milkshakes',
      group: 'boissons',
      icon: '🍦',
      accent: '#f2609a',
      ticketOrder: 3,
      steps: ['product', 'size'],
      stepTitles: { product: 'Choisir le milkshake', size: 'Choisir la taille' },
      countLabel: ['recette', 'recettes'],
      sizes: drinkSizes(),
      products: products([
        ['manatthan', 'Manatthan', 'Kinder Bueno, Nutella, glace vanille, crème fouettée'],
        ['coconut-rio', 'Coconut Rio', 'Coco, Nutella, glace vanille, crème fouettée'],
        ['red-speculoos', 'Red Spéculoos', 'Spéculoos, fraise, glace vanille, crème fouettée'],
        ['cookie-mokkie', 'Cookie Mokkie', 'Oréo, Nutella, glace vanille, crème fouettée'],
        ['fraccitella', 'Fraccitella', 'Glace fraise, glace vanille, crème fouettée'],
      ]),
    },
    {
      id: 'jus',
      label: 'Jus Frais',
      group: 'boissons',
      icon: '🍹',
      accent: '#f5a623',
      ticketOrder: 4,
      steps: ['product', 'size'],
      stepTitles: { product: 'Choisir le jus', size: 'Choisir la taille' },
      countLabel: ['recette', 'recettes'],
      sizes: drinkSizes(),
      products: products([
        ['tropical', 'Tropical', 'Mangue, melon, ananas, jus de pomme'],
        ['exotic-juice', 'Exotic Juice', 'Mangue, passion, papaye, jus de pomme'],
        ['ibiza', 'Ibiza', 'Fraise, banane, passion, jus de pomme'],
        ['hawai', 'Hawaï', 'Coco, mangue, fraise, jus de pomme'],
        ['bonne-mine', 'Bonne Mine', 'Ananas, gingembre, menthe, jus de pomme'],
      ]),
    },
    {
      id: 'softs',
      label: 'Sodas & Eau',
      group: 'boissons',
      icon: 'can',
      accent: '#3a86ff',
      ticketOrder: 5,
      steps: ['product'],
      stepTitles: { product: 'Choisir la boisson' },
      countLabel: ['boisson', 'boissons'],
      products: [
        {
          id: 'soft',
          name: 'Soft',
          description: 'Coca, Fanta, Sprite, etc.',
          price: 250,
          icon: 'can',
        },
        {
          id: 'eau',
          name: "Bouteille d'eau",
          description: 'Eau plate 50 cl',
          price: 220,
          icon: '💧',
        },
      ],
    },
    {
      id: 'crepes',
      label: 'Crêpes & Gaufres',
      icon: '🥞',
      accent: '#a0623a',
      ticketOrder: 6,
      steps: ['format', 'topping', 'supplements', 'service'],
      stepTitles: {
        format: 'Crêpe ou Gaufre ?',
        topping: 'Choisir le nappage',
        supplements: 'Suppléments',
        service: 'Sur place ou à emporter ?',
      },
      basePrice: 395,
      supplementGroup: 'crepes',
      products: [{ id: 'crepe-gaufre', name: 'Crêpe / Gaufre' }],
      formats: [
        { id: 'crepe', label: 'Crêpe', icon: '🥞' },
        { id: 'gaufre', label: 'Gaufre', icon: '🧇' },
      ],
      toppings: [
        { id: 'chocolat', label: 'Chocolat' },
        { id: 'sucre', label: 'Sucre' },
        { id: 'speculoos', label: 'Spéculoos' },
        { id: 'caramel', label: 'Caramel' },
        { id: 'pistache', label: 'Pistache' },
      ],
    },
    {
      id: 'glaces',
      label: 'Glaces',
      icon: '🍨',
      accent: '#3fa7d6',
      ticketOrder: 7,
      steps: ['format', 'size'],
      stepTitles: { format: 'Cornet ou Pot ?', size: 'Choisir la taille' },
      products: [{ id: 'glace', name: 'Glace' }],
      formats: [
        {
          id: 'cornet',
          label: 'Cornet',
          icon: '🍦',
          sizes: [
            { id: 'petit', label: 'Petit', price: 350 },
            { id: 'moyen', label: 'Moyen', price: 395 },
            { id: 'grand', label: 'Grand', price: 450 },
          ],
        },
        {
          id: 'pot',
          label: 'Pot',
          icon: '🍨',
          sizes: [
            { id: 'moyen', label: 'Moyen', price: 395 },
            { id: 'grand', label: 'Grand', price: 450 },
          ],
        },
      ],
    },
    {
      id: 'donuts',
      label: 'Donuts & Muffins',
      icon: '🍩',
      accent: '#8e5bd6',
      ticketOrder: 8,
      steps: ['product'],
      stepTitles: { product: 'Donut ou Muffin ?' },
      products: [
        { id: 'donut', name: 'Donut', price: 395, icon: '🍩' },
        { id: 'muffin', name: 'Muffin', price: 395, icon: '🧁' },
      ],
    },
    {
      id: 'sandwich',
      label: 'Sandwich',
      icon: '🥪',
      accent: '#d9632b',
      ticketOrder: 9,
      steps: [],
      stepTitles: {},
      products: [{ id: 'sandwich', name: 'Sandwich', price: 695, icon: '🥪' }],
    },
  ],
};

export function getCategory(menu: Menu, id: string): Category | undefined {
  return menu.categories.find((c) => c.id === id);
}
