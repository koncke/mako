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

// Ojo / ojo tachado (mostrar / ocultar contacto).
export function IconEye({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" {...strokeProps} /><circle cx="12" cy="12" r="3" {...strokeProps} /></svg>;
}
export function IconEyeOff({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18" {...strokeProps} /><path d="M10.6 6.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.3 3.9M6.3 6.4A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4-.85" {...strokeProps} /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" {...strokeProps} /></svg>;
}
// Flechas circulares (sincronizar / recargar).
export function IconRefresh({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14-4.5L3 9M3 4v5h5M4 13a8 8 0 0 0 14 4.5L21 15M21 20v-5h-5" {...strokeProps} /></svg>;
}
// Documento (archivo / PDF).
export function IconDoc({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...strokeProps} /><path d="M14 3v5h5M8.5 13h7M8.5 16.5h7" {...strokeProps} /></svg>;
}
// Llave inglesa (reparar).
export function IconWrench({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0 5 5l-8.4 8.4a2.1 2.1 0 0 1-3-3l8.4-8.4a4 4 0 0 0-2-2Z" {...strokeProps} /></svg>;
}
// Prohibido (bloqueado).
export function IconBan({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" {...strokeProps} /><path d="M5.6 5.6l12.8 12.8" {...strokeProps} /></svg>;
}
// Documento con lápiz (borradores).
export function IconDraft({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" {...strokeProps} /><path d="M18.4 3.6a1.8 1.8 0 0 1 2.5 2.5L14 13l-3 .8.8-3Z" {...strokeProps} /></svg>;
}

// Botón redondo del composer (emoji/clip/mic): hereda color, sin fondo.
export const iconComposerBtn: CSSProperties = { flex: 'none', width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
