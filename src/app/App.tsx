import { current, direction, stack, tab } from './nav';
import { Cart } from '../ui/Cart';
import { Checkout } from '../ui/Checkout';
import { Drinks } from '../ui/Drinks';
import { Flow } from '../ui/Flow';
import { Home } from '../ui/Home';
import { Orders } from '../ui/Orders';
import { CrepeRotaScreen } from '../ui/CrepeRota';
import { Settings } from '../ui/Settings';
import { Stats } from '../ui/Stats';
import { TabBar } from '../ui/TabBar';
import { ToastHost } from '../ui/Toast';
import { PrintFailSheet } from '../ui/PrintFailSheet';
import { startHealthPolling } from '../printing/printService';

startHealthPolling();

function CurrentScreen() {
  if (tab.value === 'orders') return <Orders />;
  const s = current.value;
  switch (s.name) {
    case 'home':
      return <Home />;
    case 'drinks':
      return <Drinks />;
    case 'flow':
      return <Flow state={s.state} />;
    case 'cart':
      return <Cart />;
    case 'checkout':
      return <Checkout />;
    case 'stats':
      return <Stats />;
    case 'settings':
      return <Settings />;
    case 'crepes':
      return <CrepeRotaScreen />;
  }
}

export function App() {
  const s = current.value;
  const showTabs = tab.value === 'orders' || s.name === 'home';
  // La clé change avec l'écran → animation d'entrée façon iOS.
  const key =
    tab.value === 'orders'
      ? 'orders'
      : `${stack.value.length}-${s.name}${s.name === 'flow' ? `-${s.state.stepIndex}` : ''}`;
  return (
    <div class={`app${showTabs ? ' with-tabs' : ''}`}>
      <div key={key} class={`screen-anim ${direction.value}`}>
        <CurrentScreen />
      </div>
      {showTabs && <TabBar />}
      <PrintFailSheet />
      <ToastHost />
    </div>
  );
}
