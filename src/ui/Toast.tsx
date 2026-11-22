import { toast } from '../app/state';

export function ToastHost() {
  const t = toast.value;
  return (
    <div class="toast-host" aria-live="polite" role="status">
      {t && (
        <div key={t.id} class={`toast toast-${t.kind}`}>
          {t.message}
        </div>
      )}
    </div>
  );
}
