// =============================================================================
// La nota de voz que sale EN EL ACTO en un chat cuyo motor lee texto (28/10/2026)
// =============================================================================
// Martín (27/10): «Apenas envío el audio, en todos los chats de todo MaKo, se debe enviar automáticamente; yo puedo
// reproducirlo... Recién se envió cuando terminó de transcribirlo todo, y como me fui para atrás y volví a la pestaña del
// Cerebro, no lo tomó». La caja le da la grabación a la pantalla (`onGrabada`), la pantalla la dibuja YA en su hilo (se escucha,
// con «Enviando…») y esto la pasa a texto por detrás, FUERA de React: cerrar el panel o cambiar de tab no la pierde (al volver
// al mismo chat, sale). Con el texto, sale por el camino de siempre de la pantalla (su `enviar`), en el orden en que se
// grabaron, y su globo sigue sonando (`voces`: el texto que salió → su audio). El hook: ./useNotaEnElActo.ts. El Ops Center
// tiene el suyo, que además la manda como nota (app/admin/operaciones/envios-en-curso.ts).
// ⚠️ Sin 'use client' y sin el transcriptor adentro (`crearNotasEnElActo` lo recibe): esto se prueba en node
//    (tests/cajas-de-chat-unificadas.test.ts).
// =============================================================================

import type { ItemHilo } from '@/app/m/mako/chat-ui';

export type VozDeNota = { url: string; secs: number };
export type NotaEnElActo = {
  id: string;
  voz: VozDeNota;
  audio: Blob;
  at: string;
  /** pasando: se está pasando a texto · lista: tiene su texto y espera a que la pantalla pueda mandar · error: no se entendió */
  estado: 'pasando' | 'lista' | 'error';
  texto?: string;
  error?: string;
};
/** Lo de un chat: sus notas sin salir y la voz de las que ya salieron (por el texto con que salieron). */
export type NotasDelChat = { notas: readonly NotaEnElActo[]; voces: ReadonlyMap<string, VozDeNota> };

type Preparar = (audio: Blob) => Promise<{ texto: string } | { error: string }>;

const VACIO: NotasDelChat = { notas: [], voces: new Map() };
const NO_SALIO = 'No se pudo pasar la nota a texto. Vuelve a intentarlo.';

export function crearNotasEnElActo(preparar: Preparar, urlDe: (b: Blob) => string = (b) => URL.createObjectURL(b)) {
  const chats = new Map<string, NotasDelChat>();
  const oyentes = new Set<() => void>();
  let n = 0;
  const de = (clave: string): NotasDelChat => chats.get(clave) ?? VACIO;
  // Cada cambio reemplaza lo del chat (no lo muta): el hook lo lee con useSyncExternalStore.
  const poner = (clave: string, x: NotasDelChat) => {
    if (!x.notas.length && !x.voces.size) chats.delete(clave); else chats.set(clave, x);
    for (const f of oyentes) f();
  };
  const cambiar = (clave: string, id: string, c: Partial<NotaEnElActo>) => {
    const x = de(clave);
    poner(clave, { ...x, notas: x.notas.map((y) => (y.id === id ? { ...y, ...c } : y)) });
  };
  const correr = async (clave: string, id: string, audio: Blob) => {
    const r = await preparar(audio).catch(() => ({ error: NO_SALIO }));
    // Si se descartó mientras se pasaba a texto, `cambiar` no la encuentra: no vuelve.
    cambiar(clave, id, 'error' in r ? { estado: 'error', error: r.error } : { estado: 'lista', texto: r.texto });
  };
  return {
    de,
    suscribir: (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; },
    /** La nota recién grabada: se dibuja ya y se pasa a texto por detrás. */
    grabar(clave: string, audio: Blob, secs: number, ahora = new Date()): string {
      const id = `nota-${++n}`;
      const x = de(clave);
      poner(clave, { ...x, notas: [...x.notas, { id, voz: { url: urlDe(audio), secs }, audio, at: ahora.toISOString(), estado: 'pasando' }] });
      void correr(clave, id, audio);
      return id;
    },
    /** La que sale ahora: la primera con su texto, si ninguna grabada antes se está pasando todavía (salen en orden). */
    siguiente(clave: string): (NotaEnElActo & { texto: string }) | null {
      for (const y of de(clave).notas) {
        if (y.estado === 'pasando') return null;
        if (y.estado === 'lista' && y.texto) return y as NotaEnElActo & { texto: string };
      }
      return null;
    },
    /** Salió por el camino de la pantalla: deja de estar pendiente, y su texto queda con su audio para el globo. */
    salio(clave: string, id: string) {
      const x = de(clave);
      const y = x.notas.find((z) => z.id === id);
      if (!y) return;
      const voces = new Map(x.voces);
      if (y.texto) voces.set(y.texto.trim(), y.voz);
      poner(clave, { notas: x.notas.filter((z) => z.id !== id), voces });
    },
    /** Una que no se entendió, otra vez. `false` = no es una nota de este chat (el «Reintentar» es de la pantalla). */
    reintentar(clave: string, id: string): boolean {
      const y = de(clave).notas.find((z) => z.id === id);
      if (!y) return false;
      if (y.estado !== 'error') return true;
      cambiar(clave, id, { estado: 'pasando', error: undefined });
      void correr(clave, id, y.audio);
      return true;
    },
    descartar(clave: string, id: string) {
      const x = de(clave);
      const y = x.notas.find((z) => z.id === id);
      if (!y) return;
      try { URL.revokeObjectURL(y.voz.url); } catch { /* sin URL (node) */ }
      poner(clave, { ...x, notas: x.notas.filter((z) => z.id !== id) });
    },
  };
}

/** Una nota sin salir, como fila del hilo (HiloMako): se escucha ya; «Enviando…» mientras se pasa a texto. Pura (test). */
export function filaDeNota(y: NotaEnElActo): Extract<ItemHilo, { k: 'msg' }> {
  return {
    k: 'msg', id: y.id, role: 'user', texto: y.texto ?? '', at: y.at, voz: y.voz,
    estado: y.estado === 'error' ? 'error' : 'enviando',
    ...(y.estado === 'error' ? { error: y.error ?? NO_SALIO, descartable: true } : {}),
  };
}

/** El hilo de la pantalla con sus notas: las que salieron suenan en su globo (por su texto) y las que no, al final. Pura. */
export function conNotas(items: readonly ItemHilo[], { notas, voces }: NotasDelChat): ItemHilo[] {
  const conVoz = voces.size
    ? items.map((x) => {
      if (x.k !== 'msg' || x.role !== 'user' || x.voz) return x;
      const v = voces.get(x.texto.trim());
      return v ? { ...x, voz: v } : x;
    })
    : [...items];
  return notas.length ? [...conVoz, ...notas.map(filaDeNota)] : conVoz;
}
