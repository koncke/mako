// =============================================================================
// Los estilos del panel de admin, en un lugar
// =============================================================================
// Eran constantes locales de AdminView.tsx. Se mudaron el 27/09/2026, cuando el
// cerebro de copywriting se fue a su propia ruta (/admin/copywriting) y se llevo
// puestos ocho de ellos: copiarlos alla habria sido el segundo lugar donde vive
// el mismo boton, y el segundo se queda viejo.
//
// No son un sistema de diseno: son los estilos de ESTA pantalla. Lo que sirve
// para todas vive en app/_ui.

import type { CSSProperties } from 'react';

export const MONO = "'Geist Mono', monospace";
export const SANS = "'Geist', sans-serif";

export const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 };
export const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
export const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
export const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
export const btnGhost: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' };
export const btnPrimary: CSSProperties = { padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' };
export const chip = (bg: string, color: string): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', flex: 'none' });
export const bannerError: CSSProperties = { background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '11px 15px', fontSize: 13, color: 'var(--bad)', fontWeight: 600, lineHeight: 1.5 };
