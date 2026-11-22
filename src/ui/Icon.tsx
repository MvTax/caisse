/** Icône produit : emoji, ou SVG intégré (« can » = canette, pas une conserve 🥫). */
export function Icon({ icon, size = 28 }: { icon: string; size?: number }) {
  if (icon === 'can') {
    return (
      <svg
        class="icon-svg"
        width={size}
        height={size}
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="9" y="5" width="14" height="23" rx="3.5" fill="#e63946" />
        <rect x="10" y="3" width="12" height="3" rx="1.5" fill="#b8c0cc" />
        <rect x="10" y="27" width="12" height="2.5" rx="1.25" fill="#b8c0cc" />
        <path d="M9 13c4 2 10-2 14 0v4c-4-2-10 2-14 0z" fill="#fff" opacity=".9" />
        <rect x="11.5" y="7.5" width="2" height="17" rx="1" fill="#fff" opacity=".35" />
      </svg>
    );
  }
  return (
    <span class="emoji" style={{ fontSize: `${size}px` }} aria-hidden="true">
      {icon}
    </span>
  );
}
