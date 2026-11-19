// =============================================================================
// recuperar-comentarios-reglas — qué comentarios perdidos se recuperan, y a qué automatización (puro, con test)
// =============================================================================
// Ticket #114 (Leandro, ws10, 18/11/2026). Durante el corte del #113 (del 14 al 18/11) el webhook de Zernio descartó los
// comentarios de @fiestamusic con un 200 «sin workspace»: 32 personas comentaron una palabra clave y no les llegó su recurso.
// Martín: «no debería salir por acá por una decisión de Claude… para eso está la aplicación… preguntárselo al cliente». Así
// que es una operación de la API de MaKo (`recuperar_comentarios_perdidos`) que el cliente confirma.
//
// Lo que decide este módulo, sin red:
//   · QUÉ AUTOMATIZACIÓN le toca a cada comentario: con el MISMO comparador del motor (`dispara`, que en el server es
//     `disparaPorEvento` de lib/disparadores.ts), no con uno parecido.
//   · NADIE RECIBE DOS VECES EL MISMO RECURSO: persona × automatización una sola vez, con el comentario más viejo. Una
//     persona que comentó dos palabras distintas recibe un DM por cada recurso, cada uno como respuesta a SU comentario
//     (Meta deja UNA respuesta privada por comentario).
//   · QUIEN YA LA TIENE, no: si la persona ya está inscripta en esa automatización (le llegó por otro lado), se salta.
//   · LOS 7 DÍAS DE META: la respuesta privada a un comentario sale dentro de los 7 días desde que se creó
//     (developers.facebook.com, Instagram Messaging › Private replies). Un comentario vencido va a `vencidos` y no se
//     propone: el motor tampoco lo mandaría (`VENTANA_COMENTARIO_MS`, lib/canal-social.ts).
//   · LOS DUDOSOS los decide el cliente: un comentario que dice algo más que la palabra («Con Marc antony» disparó «marc»).
//     No se descartan solos: van marcados, y el cliente saca los que no quiere al confirmar.
// =============================================================================

import { normalizarComentario } from './palabras-clave';

export const SIETE_DIAS_MS = 7 * 24 * 3600_000;

export type ComentarioLeido = {
  comentarioId: string;
  texto: string;
  autorId: string;
  usuario: string | null;
  /** El comentario es de la propia cuenta: nunca se recupera. */
  propio: boolean;
  postId: string;
  cuentaId: string;
  atMs: number;
};

export type DisparadorDeComentario = { palabras?: readonly string[] | null } & Record<string, unknown>;
export type SecuenciaDeComentario = { id: number; nombre: string; disparadores: readonly DisparadorDeComentario[] };

export type ItemRecuperar = {
  comentarioId: string;
  usuario: string | null;
  autorId: string;
  postId: string;
  cuentaId: string;
  texto: string;
  atMs: number;
  venceMs: number;
  /** Las automatizaciones que le tocan a ESTE comentario (sin las que la persona ya tiene o ya se le planearon). */
  secuencias: Array<{ id: number; nombre: string }>;
  /** El comentario dice algo más que la palabra clave: lo decide el cliente. */
  dudoso: boolean;
};

export type PlanRecuperacion = { items: ItemRecuperar[]; vencidos: ItemRecuperar[]; yaLaTenian: number };

const EMOJIS = /\p{Extended_Pictographic}/gu;
const limpio = (s: string): string => normalizarComentario(s).replace(EMOJIS, ' ').replace(/\s+/g, ' ').trim();

/** ¿El comentario es SÓLO una de las palabras clave (sin emojis ni signos)? Si dice algo más, es dudoso. */
export function esSoloLaPalabra(texto: string, palabras: readonly string[]): boolean {
  const t = limpio(texto);
  return !!t && palabras.some((p) => limpio(p) === t);
}

export function planDeRecuperacion(
  comentarios: readonly ComentarioLeido[],
  secuencias: readonly SecuenciaDeComentario[],
  opc: {
    ahoraMs: number;
    /** ¿Este disparador arranca con este comentario? En el server, `disparaPorEvento` del motor. */
    dispara: (d: DisparadorDeComentario, texto: string, postId: string) => boolean;
    /** ¿La persona ya está inscripta en esa automatización? */
    yaLaTiene: (autorId: string, secuenciaId: number) => boolean;
  },
): PlanRecuperacion {
  const planeado = new Set<string>();
  const items: ItemRecuperar[] = [];
  const vencidos: ItemRecuperar[] = [];
  let yaLaTenian = 0;
  const vistos = new Set<string>();
  for (const c of [...comentarios].sort((a, b) => a.atMs - b.atMs)) {
    if (c.propio || !c.autorId || !c.comentarioId || vistos.has(c.comentarioId)) continue;
    vistos.add(c.comentarioId);
    const tocan: Array<{ id: number; nombre: string }> = [];
    const palabras: string[] = [];
    for (const s of secuencias) {
      const d = s.disparadores.find((x) => opc.dispara(x, c.texto, c.postId));
      if (!d) continue;
      const clave = `${c.autorId}:${s.id}`;
      if (planeado.has(clave)) continue;
      planeado.add(clave);
      if (opc.yaLaTiene(c.autorId, s.id)) { yaLaTenian++; continue; }
      tocan.push({ id: s.id, nombre: s.nombre });
      palabras.push(...(d.palabras ?? []));
    }
    if (!tocan.length) continue;
    const item: ItemRecuperar = {
      comentarioId: c.comentarioId, usuario: c.usuario, autorId: c.autorId, postId: c.postId, cuentaId: c.cuentaId, texto: c.texto,
      atMs: c.atMs, venceMs: c.atMs + SIETE_DIAS_MS, secuencias: tocan, dudoso: !esSoloLaPalabra(c.texto, palabras),
    };
    (opc.ahoraMs >= item.venceMs ? vencidos : items).push(item);
  }
  items.sort((a, b) => a.venceMs - b.venceMs);
  return { items, vencidos, yaLaTenian };
}

/** Saca del plan a las personas que el cliente no quiere (`@usuario`, sin importar mayúsculas ni la @). */
export function sinExcluidos(items: readonly ItemRecuperar[], excluir: string): ItemRecuperar[] {
  const fuera = new Set(excluir.split(/[\s,;]+/).map((x) => x.replace(/^@/, '').trim().toLowerCase()).filter(Boolean));
  return items.filter((i) => !fuera.has(String(i.usuario ?? '').toLowerCase()));
}
