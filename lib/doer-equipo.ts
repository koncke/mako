// =============================================================================
// doer-equipo — lo que el EQUIPO de MaKo escribe en el grupo de un negocio, para el turno (28/10/2026, el diagnóstico del
// Cerebro, F2a)
// =============================================================================
// `enviarAlGrupoMaKo` sólo anotaba el anti-eco: lo que mandaba el equipo (el aviso de un arreglo, la respuesta de un ticket)
// nunca llegaba a un turno. De 30 avisos del equipo en 7 grupos del 21 al 28/10, ninguno. Leandro contestó al aviso de los
// botones de Instagram («no necesitaba eso… tal cual como lo hace manychat») y MaKo no tenía a qué referirlo; Joan preguntó si
// el access token de Meta «sigue siendo el mismo» tres minutos después del aviso «sólo con Zernio», y MaKo le dijo que sí.
//
// ⚠️ NO VA COMO TURNO DE MaKo ('assistant'): `ultimoDeMako` (lib/mako-doer-in.ts) toma el último 'assistant' para saber si
// MaKo preguntó algo, y una pregunta del equipo pasaría por pregunta de MaKo: un «sí» del dueño se volvería una confirmación.
// Va a un anillo propio del negocio (`CLAVE_EQUIPO_EN_EL_GRUPO`) y el turno lo lee como un bloque aparte, con su rótulo.
// =============================================================================

import { cuando } from './doer-hilo';

/** El anillo del negocio (app_settings del ws): los últimos `TOPE_GUARDADOS` mensajes del equipo en su grupo. */
export const CLAVE_EQUIPO_EN_EL_GRUPO = 'mako.equipo.grupo';
export const TOPE_GUARDADOS = 10;
export const DIAS_DEL_EQUIPO = 7;
export const MAX_EN_EL_BLOQUE = 6;
export const LARGO_DEL_EQUIPO = 300;

export type DelEquipo = { at: string; texto: string; id?: string };

function leer(guardado: string | null | undefined): DelEquipo[] {
  try {
    const v = JSON.parse(guardado ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is DelEquipo => !!x && typeof x === 'object' && typeof (x as DelEquipo).at === 'string' && typeof (x as DelEquipo).texto === 'string') : [];
  } catch { return []; }
}

/** El anillo con el nuevo al final, sin pasar del tope (lo más viejo se va). */
export function conElNuevo(guardado: string | null | undefined, nuevo: DelEquipo): DelEquipo[] {
  return [...leer(guardado), { ...nuevo, texto: nuevo.texto.slice(0, 1000) }].slice(-TOPE_GUARDADOS);
}

const enUnaLinea = (s: string, max: number): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** El bloque del system del turno, o '' si el equipo no escribió en los últimos `DIAS_DEL_EQUIPO` días. */
export function bloqueDelEquipo(guardado: string | null | undefined, ahora: Date, tz: string): string {
  const desde = ahora.getTime() - DIAS_DEL_EQUIPO * 24 * 60 * 60 * 1000;
  const vivos = leer(guardado).filter((d) => Date.parse(d.at) >= desde).slice(-MAX_EN_EL_BLOQUE);
  if (!vivos.length) return '';
  return [
    `LO QUE EL EQUIPO DE MaKo ESCRIBIÓ EN ESTE GRUPO (últimos ${DIAS_DEL_EQUIPO} días; lo escribió el equipo que desarrolla MaKo, no tú). Si la persona contesta a esto, el contexto está acá: no lo contradigas.`,
    ...vivos.map((d) => `- ${cuando(d.at, ahora, tz)} — «${enUnaLinea(d.texto, LARGO_DEL_EQUIPO)}»`),
  ].join('\n');
}
