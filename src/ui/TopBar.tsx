import type { ComponentChildren } from 'preact';

/** Barre de navigation façon iOS : « ‹ Retour », titre centré, action à droite. */
export function TopBar(props: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ComponentChildren;
  accent?: string;
}) {
  return (
    <header class="topbar" style={props.accent ? { '--accent': props.accent } : undefined}>
      <div class="topbar-side">
        {props.onBack && (
          <button type="button" class="topbar-back" onClick={props.onBack}>
            <span aria-hidden="true">‹</span> {props.backLabel ?? 'Retour'}
          </button>
        )}
      </div>
      <h1 class="topbar-title">{props.title}</h1>
      <div class="topbar-side topbar-right">{props.right}</div>
    </header>
  );
}
