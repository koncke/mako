// =============================================================================
// conversacion-reglas — la conversación de un turno de MaKo, como la ve Claude (12/11/2026)
// =============================================================================
// Martín, 11/11: «Funciona increíblemente mal el WhatsApp, no guarda contexto de nada… No funciona como un chat contigo y sí debería».
// La causa de fondo, medida (docs/hallazgos-comunicacion.md, «El grupo de SuperAdmin no era un chat»): el turno leía lo que MaKo
// CONTESTÓ (`mako_doer_conv`), no lo que PASÓ en el chat. Faltaban los avisos de los crons, los mensajes que terminaron en charla, lo
// del equipo y lo mandado a mano por la línea. Esto es la parte pura del módulo común (lib/conversacion.ts lee las fuentes): junta las
// fuentes en UNA conversación, la corta por TOKENS (no por cantidad de mensajes) y dice cuál es el último mensaje de MaKo.
//
// CÓMO ENTRA CADA ROL AL MODELO (el plan del 11/11):
//   · la persona, como user con su nombre;            · MaKo, como assistant;
//   · un aviso automático, como assistant marcado;    · el equipo, como user «[Equipo de MaKo]», NUNCA como MaKo: un «sí» a una
//   · un invitado se ve, marcado, y nunca es el pedido.  pregunta del equipo no es un «sí» a MaKo (28/10/2026, F2).
// La ventana de 14 h se queda: un «sí» pegado a una charla de días antes duplicó tareas (26/07, lib/mako-doer-conv.ts).
// Puro, con test (tests/conversacion-reglas.test.ts).
// =============================================================================

export type RolDelHilo = 'persona' | 'mako' | 'aviso' | 'equipo' | 'invitado';

/** Un mensaje de la conversación, venga de donde venga. `oculto`: lo que el modelo ve y la persona no (lo leído de un adjunto, los
 *  datos de un aviso). `id`: el de WhatsApp si lo tiene (con él se juntan las fuentes). */
export type EntradaDelHilo = { id?: string | null; at: number; rol: RolDelHilo; quien?: string | null; texto: string; oculto?: string | null };

export type TurnoDelModelo = { role: 'user' | 'assistant'; content: string };

/** Cuántos tokens van enteros, por canal. Medido el 11/11: el día más cargado de cualquier grupo en 7 días fueron ~3.300 tokens. */
export const TOPE_TOKENS = { grupo: 6000, privado: 6000, app: 8000, clasificador: 1500 } as const;
export type CanalDelTurno = keyof typeof TOPE_TOKENS;
/** La ventana: lo de antes no entra como turnos (va a los hechos y al resumen). */
export const VENTANA_MS = 14 * 3_600_000;
/** «El aviso es lo único que MaKo dijo en tanto tiempo»: entonces el aviso es su último mensaje. */
export const SOLO_EL_AVISO_MS = 30 * 60_000;

export const MARCA_EQUIPO = '[Equipo de MaKo]';
export const MARCA_AVISO = '(aviso automático)';

/** Tokens aproximados (≈3,5 letras por token en español, con margen). */
export const tokensAprox = (s: string): number => Math.ceil((s ?? '').length / 3.5);

/** Cómo entra al modelo cada mensaje. */
export function aTurno(e: EntradaDelHilo): TurnoDelModelo {
  const texto = e.oculto ? `${e.texto}\n[${e.oculto}]` : e.texto;
  const quien = (e.quien ?? '').trim();
  switch (e.rol) {
    case 'mako': return { role: 'assistant', content: texto };
    case 'aviso': return { role: 'assistant', content: `${MARCA_AVISO} ${texto}` };
    case 'equipo': return { role: 'user', content: `${MARCA_EQUIPO} ${texto}` };
    case 'invitado': return { role: 'user', content: `${quien || 'Un invitado'} (invitado; lo suyo nunca es el pedido): ${texto}` };
    default: return { role: 'user', content: quien ? `${quien}: ${texto}` : texto };
  }
}

const normal = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}@.]+/gu, ' ').replace(/\s+/g, ' ').trim();
const lado = (r: RolDelHilo): 'mako' | 'persona' => (r === 'mako' || r === 'aviso' || r === 'equipo' ? 'mako' : 'persona');
const contiene = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  if (a === b) return true;
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  return corto.length >= 12 && largo.includes(corto);
};

/** Lo que una fuente tiene de MÁS sobre el mismo mensaje (la memoria guarda el texto con lo leído de un adjunto): eso es lo oculto. */
function restoDe(base: string, otro: string): string | null {
  const b = (base ?? '').trim(), o = (otro ?? '').trim();
  if (!b || o.length < b.length + 20 || !o.includes(b)) return null;
  return o.replace(b, '').trim() || null;
}

/**
 * Junta varias fuentes en una conversación, en orden. La PRIMERA fuente manda (la base: el hilo del grupo); las otras sólo suman lo
 * que la base no tiene, o le completan `oculto` al mismo mensaje (por id). Sin id, un mensaje del mismo lado (MaKo o personas) con el
 * mismo texto en 5 minutos es el mismo: MaKo manda en partes y guarda el turno entero, y un lote junta varios mensajes en uno.
 */
export function fundirFuentes(...fuentes: ReadonlyArray<readonly EntradaDelHilo[]>): EntradaDelHilo[] {
  const out: EntradaDelHilo[] = [];
  const porId = new Map<string, EntradaDelHilo>();
  for (const fuente of fuentes) {
    for (const e of fuente) {
      if (!Number.isFinite(e.at) || !(e.texto ?? '').trim()) continue;
      const previo = e.id ? porId.get(e.id) : undefined;
      if (previo) { if (!previo.oculto) previo.oculto = e.oculto ?? restoDe(previo.texto, e.texto); continue; }
      const n = normal(e.texto);
      const igual = out.find((x) => lado(x.rol) === lado(e.rol) && Math.abs(x.at - e.at) <= 5 * 60_000 && contiene(normal(x.texto), n));
      if (igual) { if (!igual.oculto && e.oculto) igual.oculto = e.oculto; if (e.id && !igual.id) { igual.id = e.id; porId.set(e.id, igual); } continue; }
      const nueva = { ...e };
      out.push(nueva);
      if (e.id) porId.set(e.id, nueva);
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Los turnos que van enteros: los más nuevos que entran en `presupuesto` tokens dentro de la ventana, sin el mensaje que se está
 * atendiendo (`excluirIds`, `textoActual`: el lote ya está en el hilo). Lo que queda afuera por el tope, más viejo, va a `afuera`
 * (para el resumen); lo de antes de la ventana, a `antes` (para los hechos con fecha).
 */
export function turnosDelHilo(entradas: readonly EntradaDelHilo[], o: {
  ahoraMs: number; presupuesto: number; ventanaMs?: number; excluirIds?: ReadonlySet<string>; textoActual?: string;
}): { turnos: TurnoDelModelo[]; usados: EntradaDelHilo[]; afuera: EntradaDelHilo[]; antes: EntradaDelHilo[] } {
  const desde = o.ahoraMs - (o.ventanaMs ?? VENTANA_MS);
  const actual = normal(o.textoActual ?? '');
  const vivas = entradas.filter((e) => !(e.id && o.excluirIds?.has(e.id)) && !(actual && lado(e.rol) === 'persona' && contiene(actual, normal(e.texto)) && o.ahoraMs - e.at < 5 * 60_000));
  const antes = vivas.filter((e) => e.at < desde);
  const enLaVentana = vivas.filter((e) => e.at >= desde && e.at <= o.ahoraMs + 60_000);
  const usados: EntradaDelHilo[] = [];
  let gasto = 0;
  let i = enLaVentana.length - 1;
  for (; i >= 0; i--) {
    const t = tokensAprox(aTurno(enLaVentana[i]).content);
    if (usados.length && gasto + t > o.presupuesto) break;
    gasto += t; usados.unshift(enLaVentana[i]);
  }
  return { turnos: usados.map(aTurno), usados, afuera: enLaVentana.slice(0, i + 1), antes };
}

/** El rol de un turno para el clasificador (lib/mako-intencion-ia.ts): lo del equipo es del equipo, ni de MaKo ni de la persona. */
export function rolParaLaClase(t: { role: 'user' | 'assistant'; content: unknown }): 'persona' | 'mako' | 'equipo' {
  const c = typeof t.content === 'string' ? t.content : '';
  if (c.startsWith(MARCA_EQUIPO)) return 'equipo';
  return t.role === 'user' ? 'persona' : 'mako';
}

/** La pregunta viva del equipo (`preguntaDelEquipo` del clasificador): su último mensaje en el historial, si termina en «?» y nadie
 *  de MaKo habló después. Hasta el 12/11/2026 iba siempre en null. */
export function preguntaDelEquipoEn(turnos: ReadonlyArray<{ role: 'user' | 'assistant'; content: unknown }>): string | null {
  for (let i = turnos.length - 1; i >= 0; i--) {
    const c = typeof turnos[i].content === 'string' ? (turnos[i].content as string) : '';
    if (c.startsWith(MARCA_EQUIPO)) { const sin = c.slice(MARCA_EQUIPO.length).trim(); return /\?\s*$/.test(sin) ? sin : null; }
    if (turnos[i].role === 'assistant') return null;
  }
  return null;
}

/**
 * El último mensaje de MaKo, que es lo que convierte un «sí» en el pedido de hacer lo que ofreció. No es un aviso automático, salvo que
 * lo citen o que el aviso sea lo único que MaKo dijo en los últimos 30 minutos (el comprobante de las 23:18 y el «Si perfecto» de las
 * 23:25: el aviso es la pregunta). Lo del equipo nunca: no es una oferta de MaKo.
 */
export function ultimoDeMaKoEn(entradas: readonly EntradaDelHilo[], o: { ahoraMs: number; citadoId?: string | null }): string | null {
  if (o.citadoId) {
    const citado = entradas.find((e) => e.id === o.citadoId && (e.rol === 'mako' || e.rol === 'aviso'));
    if (citado) return citado.texto;
  }
  const deMaKo = entradas.filter((e) => e.rol === 'mako' || e.rol === 'aviso').sort((a, b) => a.at - b.at);
  // ⚠️ Y QUE LA CHARLA NO HAYA SEGUIDO (la regla de siempre, lib/mako-doer-in.ts): con dos o más mensajes de personas después, una oferta
  // de hace diez mensajes no la contesta un «sí» de ahora.
  const vigente = (e: EntradaDelHilo | undefined): EntradaDelHilo | undefined =>
    e && entradas.filter((x) => (x.rol === 'persona' || x.rol === 'invitado') && x.at > e.at).length < 2 ? e : undefined;
  const ultimoMako = vigente([...deMaKo].reverse().find((e) => e.rol === 'mako'));
  const ultimoAviso = vigente([...deMaKo].reverse().find((e) => e.rol === 'aviso'));
  if (ultimoAviso && (!ultimoMako || ultimoAviso.at > ultimoMako.at)) {
    const enLaMediaHora = deMaKo.filter((e) => o.ahoraMs - e.at <= SOLO_EL_AVISO_MS);
    if (enLaMediaHora.length && enLaMediaHora.every((e) => e.rol === 'aviso')) return ultimoAviso.texto;
  }
  return ultimoMako?.texto ?? null;
}
