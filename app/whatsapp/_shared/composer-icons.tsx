// =============================================================================
// Íconos de línea del composer de WhatsApp (estilo WhatsApp, currentColor).
// Compartidos entre el inbox oficial y el no oficial para que se vean IGUAL y no
// usar emojis. Copiados 1:1 del set del oficial (WhatsAppApp.tsx).
// =============================================================================

import type { CSSProperties } from 'react';

const strokeProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

// Animación de la onda de grabación + parpadeo del punto rojo.
export const WAVE_CSS = '@keyframes mako-wave{0%{transform:scaleY(.28)}100%{transform:scaleY(1)}}@keyframes mako-blink{0%,49%{opacity:1}50%,100%{opacity:.25}}';

export function SendArrow() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20.5 L21 12 L3 3.5 L3 10 L15 12 L3 14 Z" fill="currentColor" /></svg>;
}
export function IconSmiley() {
  return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" {...strokeProps} /><path d="M8.5 14.5a4.2 4.2 0 0 0 7 0" {...strokeProps} /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /></svg>;
}
export function IconClip() {
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5l-8.6 8.6a4.6 4.6 0 0 1-6.5-6.5l8.7-8.7a3.1 3.1 0 0 1 4.3 4.3l-8.7 8.7a1.55 1.55 0 0 1-2.2-2.2l7.9-7.9" {...strokeProps} /></svg>;
}
export function IconMic() {
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" {...strokeProps} /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" {...strokeProps} /><path d="M12 17.5V21" {...strokeProps} /></svg>;
}
export function IconTrash() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6h17M8 6V4h8v2M6.5 6l1 14h9l1-14M10 10.5v6M14 10.5v6" {...strokeProps} /></svg>;
}
export function IconPause() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></svg>;
}
export function IconPlay() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5l13 7.5-13 7.5z" fill="currentColor" /></svg>;
}

// Botón redondo del composer (emoji/clip/mic): hereda color, sin fondo.
export const iconComposerBtn: CSSProperties = { flex: 'none', width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
