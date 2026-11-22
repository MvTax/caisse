import { menu } from '../app/state';
import { pop } from '../app/nav';
import { CartBanner, CategoryTile } from './Home';
import { TopBar } from './TopBar';

export function Drinks() {
  const drinks = menu.categories.filter((c) => c.group === 'boissons');
  const main = drinks.filter((c) => c.id !== 'softs');
  const softs = drinks.find((c) => c.id === 'softs');
  return (
    <div class="screen">
      <TopBar title="Boissons" onBack={pop} backLabel="Accueil" />
      <main class="content">
        <CartBanner />
        <div class="tile-grid">
          {main.map((c) => (
            <CategoryTile key={c.id} c={c} />
          ))}
        </div>
        {softs && <CategoryTile c={softs} wide />}
      </main>
    </div>
  );
}
