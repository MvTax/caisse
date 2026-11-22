/**
 * Copie dans le presse-papiers, fiable sur iOS :
 * - API Clipboard si disponible (HTTPS uniquement) ;
 * - sinon zone de texte temporaire + execCommand('copy') (page HTTP de la passerelle).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* on tente la méthode de secours */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.opacity = '0';
  ta.style.fontSize = '16px'; // évite le zoom iOS
  document.body.appendChild(ta);
  ta.focus();
  ta.setSelectionRange(0, text.length);
  let ok: boolean;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
