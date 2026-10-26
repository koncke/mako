// =============================================================================
// Notificaciones — lo que dice cada canal a la derecha de su fila (25/10/2026)
// =============================================================================
// Settings › Notificaciones copia «Notification methods» de Linear (docs/settings/referencia.md): una fila por canal con su
// estado y su punto verde o gris («Enabled for all notifications», «Disabled»). Acá vive ese resumen, puro, para que el
// test lo pruebe sin la pantalla (tests/settings-notificaciones.test.ts).

import type { NotifInApp, NotifPush } from '@/lib/notif-catalogo';

export type CanalNotif = 'app' | 'celular' | 'whatsapp' | 'email';
export const CANALES: readonly CanalNotif[] = ['app', 'celular', 'whatsapp', 'email'];
export const NOMBRE_CANAL: Record<CanalNotif, string> = { app: 'En la app', celular: 'Celular', whatsapp: 'WhatsApp', email: 'Email' };

/** El `?canal=` de la URL, o null (la lista de canales). Lo que no es un canal, también null. */
export function canalDeUrl(v: unknown): CanalNotif | null {
  return typeof v === 'string' && (CANALES as readonly string[]).includes(v) ? (v as CanalNotif) : null;
}

export type Resumen = { texto: string; tono: 'good' | 'off' | 'warn' };

export function resumenApp(p: NotifInApp): Resumen {
  if (!p.popup) return { texto: 'Apagado', tono: 'off' };
  return { texto: p.sonido ? 'Pop-up y sonido' : 'Pop-up sin sonido', tono: 'good' };
}

/**
 * El celular: apagado; prendido pero sin ningún teléfono que reciba (ámbar: hay que instalar la app); o cuántos avisos de
 * los que se le ofrecen a la persona (`ids`, ya filtrados por su rol) le llegan.
 */
export function resumenCelular(p: NotifPush, telefonos: number | null, ids: readonly string[]): Resumen {
  if (!p.activo) return { texto: 'Apagado', tono: 'off' };
  if (telefonos === 0) return { texto: 'Sin teléfono', tono: 'warn' };
  const prendidos = ids.filter((id) => p.items[id] !== false).length;
  if (prendidos === 0) return { texto: 'Ningún aviso', tono: 'off' };
  return { texto: prendidos === ids.length ? 'Todos los avisos' : `${prendidos} de ${ids.length} avisos`, tono: 'good' };
}

/** WhatsApp y Email del negocio: a cuántos les llega. Sin nadie, en ámbar: MaKo no puede avisar por ahí. */
export function resumenDestinatarios(n: number, canal: 'whatsapp' | 'email'): Resumen {
  const [uno, varios] = canal === 'whatsapp' ? ['número', 'números'] : ['dirección', 'direcciones'];
  if (n === 0) return { texto: `Sin ${varios}`, tono: 'warn' };
  return { texto: `${n} ${n === 1 ? uno : varios}`, tono: 'good' };
}

/** «Tijuana» de «America/Tijuana»: cómo se nombra la zona del «No molestar» en una línea. */
export function ciudadDeZona(tz: string): string {
  const ultima = (tz || '').split('/').pop() ?? '';
  return ultima.replace(/_/g, ' ') || tz;
}
