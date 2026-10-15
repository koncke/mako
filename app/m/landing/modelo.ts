// =============================================================================
// /m/landing — las reglas puras de Landing Generator en el teléfono (con test)
// =============================================================================
// Sin 'use client' ni server-only: lo importan la página del server, el componente de cliente y
// tests/m-landing.test.ts. Nada de esto decide QUÉ EXISTE (eso lo leen lib/editor-landing/server.ts
// y publicar.ts, los mismos de escritorio); decide cómo se DICE en una fila de 390 px.
// =============================================================================

import type { TonoPildora } from '@/app/m/_ui/Piezas';

export type EstadoLanding = 'publicada' | 'pausada' | 'borrador';

/**
 * Publicada = tiene dirección (slug) y una foto publicada: la MISMA regla que `esPublicada` del
 * Panel de escritorio (app/web-generator/Inicio.tsx) y que `urlPublica` de `aCompleta`
 * (lib/editor-landing/server.ts). No se importa de Inicio.tsx porque es un módulo 'use client': su
 * función llegaría al server como una referencia de cliente, no como algo que se pueda llamar.
 *
 * Pausada = publicada con el interruptor «Sitio activo» apagado (publicar.ts → `sitioActivo`): la
 * dirección contesta como si no existiera. `sitioActivo` desconocido (null) se dibuja publicada.
 */
export function estadoLanding(d: { slug: string | null; publicadoAt: string | null }, sitioActivo: boolean | null | undefined): EstadoLanding {
  if (!d.slug || !d.publicadoAt) return 'borrador';
  return sitioActivo === false ? 'pausada' : 'publicada';
}

/** La píldora de cada estado: el color va en el punto (el texto queda en tinta). */
export const PILDORA_LANDING: Readonly<Record<EstadoLanding, { tono: TonoPildora; texto: string }>> = {
  publicada: { tono: 'good', texto: 'Publicada' },
  pausada: { tono: 'warn', texto: 'Pausada' },
  borrador: { tono: 'neutro', texto: 'Borrador' },
};

const entero = (v: number) => Math.max(0, Math.round(v)).toLocaleString('es-AR');

/**
 * «1.240 visitas · 96 leads en 30 días»: lo que mide `analitica` (lib/editor-landing/server.ts) con
 * el Pixel de MaKo sobre la página PUBLICADA. Sólo se llama con una medición que salió bien: una que
 * falla no se dibuja como «0 visitas».
 */
export function lineaNumeros(visitas: number, leads: number): string {
  return `${entero(visitas)} ${visitas === 1 ? 'visita' : 'visitas'} · ${entero(leads)} ${leads === 1 ? 'lead' : 'leads'} en 30 días`;
}

/**
 * Cuántas landings publicadas se miden en la lista. Cada medición pagina las visitas de 30 días de
 * esa landing (y lee su foto publicada): con más que esto, la lista tardaría en terminar de cargar
 * y la base pagaría por filas que nadie va a mirar. Las de más quedan sin la línea de números.
 */
export const TOPE_MEDIDAS = 12;

/** Cuántas mediciones corren a la vez (las filas se completan de a poco, sin bloquear la lista). */
export const MEDIDAS_A_LA_VEZ = 3;

/**
 * El pie de la pantalla de una landing PUBLICADA: la consecuencia en tinta arriba del botón
 * «Publicar cambios», apagado si no hay nada que publicar (prototipo, `data-ir="landing-ed"`).
 *
 * ⚠️ Publicar vuelve a prender el sitio (publicar.ts escribe `sitio_activo: true`): con el sitio
 * pausado la consecuencia lo dice, porque eso es lo que pasa.
 */
export function piePublicar(o: { cambios: boolean; sitioActivo: boolean; enLinea: boolean }): { consecuencia: string; habilitado: boolean } {
  if (!o.cambios) return { consecuencia: 'Sin cambios por publicar.', habilitado: false };
  if (!o.enLinea) return { consecuencia: 'Sin conexión.', habilitado: false };
  return {
    consecuencia: o.sitioActivo ? 'La página publicada cambia al instante.' : 'El sitio vuelve a estar en línea.',
    habilitado: true,
  };
}

/** El id de la URL: sólo dígitos (como /web-generator/<id>), positivo y seguro. */
export function idDeLanding(crudo: string): number | null {
  if (!/^\d{1,15}$/.test(crudo)) return null;
  const id = Number(crudo);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
