import { data } from '../app/state';
import { switchTab, tab } from '../app/nav';

export function TabBar() {
  const pending = data.value.orders.filter((o) => o.status === 'pending').length;
  return (
    <nav class="tabbar" aria-label="Navigation principale">
      <button
        type="button"
        class="tab"
        aria-current={tab.value === 'order' ? 'page' : undefined}
        onClick={() => switchTab('order')}
      >
        <span class="tab-icon" aria-hidden="true">
          🧾
        </span>
        Commander
      </button>
      <button
        type="button"
        class="tab"
        aria-current={tab.value === 'orders' ? 'page' : undefined}
        onClick={() => switchTab('orders')}
      >
        <span class="tab-icon" aria-hidden="true">
          📋
        </span>
        Commandes
        {pending > 0 && (
          <span class="tab-badge" aria-label={`${pending} en cours`}>
            {pending}
          </span>
        )}
      </button>
    </nav>
  );
}
