// =============================================================================
// LA PRUEBA POR WHATSAPP DE LOS DÍAS 3, 4 Y 5, CONTESTADA (20/11/2026, a la tarde; wa-02, d24-16, R57-10): LO PURO
// =============================================================================
// El Cerebro lo decidió el 20/11 a la tarde (memoria, onboarding-16-11-decisiones): los días 3, 4 y 5 NO esperan a que el bot 1 a 1
// se mude a la línea que recibe. Se contestan en lib/reto/respuestas.ts (`responderAlReto`), como el día 7, y cada uno marca su prueba
// (`pruebaRespondida`, la tarjeta del chat del reto). Lo que hace cada día (la maqueta, `waMomentoHtml`, d3/d4/d5):
//   · día 3, un AUDIO: «MaKo, carga a Juan Pérez en mi CRM…» → el lead, con la misma herramienta del bot (`proponer_lead`);
//   · día 4, el TEXTO «¿Qué le está funcionando a mi competencia?» → lo que lee Competitor Spy;
//   · día 5, un AUDIO con la idea → el guion, escrito por MaKo con «Editar» del Copywriter y guardado ahí.
// ⚠️ EL LEAD QUEDA PARA CONFIRMAR, no cargado: la maqueta dice «cargué», pero la regla de la casa es que nada que llega por un canal
// escribe en el CRM sin que una persona vea el dato (app/api/agente/lead/route.ts, AGENTS.md: «un DATO EXACTO que pasa por las manos de
// un LLM deja de ser exacto»). El bot hace lo mismo: deja la propuesta y el link a /crm/revisar.
// Lo que habla con la base y la IA: ./pruebas-whatsapp-servidor.ts. Acá, qué prueba contesta un mensaje y los textos.
// =============================================================================
import type { Pieza } from '../spy';
import { diasAlAire, porDiasAlAire, sigueActivo } from '../spy-anuncios-ficha';
import { mejoresPiezas } from '../spy-detalle';
import { rotuloCortoDeMultiplo } from '../multiplo-rendimiento';
import { diaAbierto, type EstadoReto } from './dias';

const sinTildes = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** «¿Qué le está funcionando a mi competencia?» (la prueba del día 4), o cualquier pregunta que nombre a su competencia. */
export const esPreguntaDeCompetencia = (texto: string): boolean => /\b(competencia|competencias|competidor|competidores|competidora|competidoras)\b/.test(sinTildes(texto));

/**
 * Las pruebas que este mensaje puede contestar, la más nueva primero: la de un día ya abierto y todavía sin responder. Un audio es la
 * del día 5 (la idea del guion) o la del 3 (el lead); el texto que nombra a su competencia, la del 4. Vacío: no es una prueba, sigue al bot.
 */
export function pruebasDelMensaje(p: { e: EstadoReto; ahora: number; esAudio: boolean; competencia: boolean }): number[] {
  const abierto = diaAbierto(p.e, p.ahora);
  const dias = p.esAudio ? [5, 3] : p.competencia ? [4] : [];
  return dias.filter((d) => d <= abierto && !p.e.pruebas?.[String(d)]);
}

/** Con las dos de audio pendientes, lo que dice el audio decide: un guion es el 5; un lead, el CRM o «carga», el 3. Si no dice, la más nueva. */
export function diaDelAudio(transcripcion: string, candidatos: readonly number[]): number | null {
  if (candidatos.length <= 1) return candidatos[0] ?? null;
  const t = sinTildes(transcripcion);
  if (/\bguion(es)?\b/.test(t) && candidatos.includes(5)) return 5;
  if (/\b(crm|leads?|carg\w*)\b/.test(t) && candidatos.includes(3)) return 3;
  return candidatos[0];
}

// ── Los textos ───────────────────────────────────────────────────────────────

export const NO_TE_ESCUCHE = 'No pude escuchar tu audio. ¿Me lo mandas otra vez?';
/** El mismo del bot (lib/mako-bot.ts) cuando algo de este lado falla. */
export const SE_ME_CORTO = 'Se me cortó algo de este lado. ¿Me lo mandas otra vez en un rato?';

/** Día 3. Sin «cargué»: queda para confirmar (ver la cabecera). Neutro en género: «los datos de», nunca «listo/a». */
export const respuestaDelLead = (nombre: string, url: string): string =>
  `Listo: te dejé los datos de ${nombre} para tu CRM ✓ Revísalos y confírmalos aquí: ${url}`;
export const leidoDelLead = (nombre: string): string => `Te dejé los datos de ${nombre} para tu CRM.`;
export const PIDE_EL_NOMBRE = 'No entendí a quién cargo en tu CRM. Mándame otro audio con su nombre, por ejemplo: «MaKo, carga a Juan Pérez en mi CRM».';

/**
 * Lo que la IA barata saca del audio para `proponer_lead`: con la descripción de ESA herramienta y de cada campo (lib/mako-doer-acciones.ts),
 * no con una copia. Lo que no dijo queda vacío: un teléfono o un email inventado entra al CRM y no cruza con nada.
 */
export function sistemaDelLead(descripcion: string, campos: Readonly<Record<string, { description?: string }>>): string {
  return [
    'El dueño de un negocio le mandó a MaKo un audio (abajo, transcripto) pidiéndole que cargue a una persona en su CRM.',
    'Saca los datos de ESA persona para la herramienta de abajo. Devuelve SOLO un objeto JSON con estas claves, todas texto; la que no dijo, "".',
    '⛔ Nunca inventes un dato: un teléfono, un email o un @ que no dijo va vacío. Lo que contó de la persona (de dónde vino, qué quiere) va en «nota».',
    '', `LA HERRAMIENTA: ${descripcion}`, '', 'LAS CLAVES:',
    ...Object.entries(campos).map(([k, v]) => `- ${k}: ${v.description ?? ''}`),
  ].join('\n');
}

/** Lo que devolvió la IA, sólo con las claves de la herramienta y en texto. Sin `nombre` no hay a quién proponer. */
export function datosDelLead(crudo: unknown, claves: readonly string[]): Record<string, string> {
  const o = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of claves) {
    const v = typeof o[k] === 'string' ? (o[k] as string).replace(/\s+/g, ' ').trim() : typeof o[k] === 'number' ? String(o[k]) : '';
    if (v) out[k] = v.slice(0, 500);
  }
  return out;
}

/** Día 4. */
export const LEIDO_COMPETENCIA = 'Te conté lo que mejor le funciona a tu competencia.';
export const respuestaDeLaCompetencia = (lineas: readonly string[], link: string): string =>
  `Esto es lo que mejor le está funcionando a tu competencia:\n${lineas.map((l) => `• ${l}`).join('\n')}\nLo tienes en Competitor Spy: ${link}`;
export const sinCompetencia = (link: string): string =>
  `Todavía no tengo lo que publica tu competencia. Agrega a 3 competidores en Competitor Spy y, cuando estén revisados, pregúntamelo otra vez: ${link}`;

/** Día 5. Lo que dice la tarjeta es `GUION_POR_WHATSAPP` (./pruebas.ts), que además deja hecha la tarea del guion. */
export const respuestaDelGuion = (link: string): string => `Listo: escribí tu guion con tu idea ✓ Lo tienes en Copywriting: ${link}`;
/** Lo que le pide a «Editar» del Copywriter (lib/copywriter/ia.ts): la idea, en sus palabras. */
export const instruccionDelGuion = (idea: string): string =>
  `Escribe el guion entero, listo para grabar, con esta idea que la persona te dijo en un audio de WhatsApp: «${idea.trim()}»`;

/** El título de la página: la idea sin el «quiero un guion sobre…», corta. */
export function tituloDelGuion(idea: string): string {
  const t = idea.replace(/\s+/g, ' ').trim()
    .replace(/^(hola[,!.]?\s+)?(mako[,:.]?\s+)?/i, '')
    .replace(/^(quiero|necesito|hazme|escr[ií]beme|[aá]rmame)\s+(un\s+)?gui[oó]n\s+(sobre|de|para|acerca de)\s+/i, '')
    .replace(/[.!?…]+$/, '').trim();
  if (!t) return 'Tu guion del reto';
  const corto = t.length > 60 ? `${t.slice(0, 59).replace(/\s+\S*$/, '')}…` : t;
  return corto.charAt(0).toUpperCase() + corto.slice(1);
}

// ── Día 4: lo que más le funciona a su competencia ───────────────────────────

export type DelCompetidor = { nombre: string; piezas: readonly Pieza[] };

const gancho = (p: Pick<Pieza, 'titulo' | 'texto'>): string | null => {
  const t = (p.titulo || p.texto || '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > 70 ? `${t.slice(0, 69).replace(/\s+\S*$/, '')}…` : t;
};

/**
 * Hasta 3 renglones, con lo MISMO que dibuja Competitor Spy: primero lo que más tiempo lleva al aire (sus anuncios, `porDiasAlAire`,
 * la maqueta: «Lo que más tiempo lleva activo… los 3 que más duran»), después lo que más rindió de lo que publica frente a su cuenta
 * (`mejoresPiezas`, el «3,7×»). Sin IA y sin inventar: lo que no tiene número no entra. Vacío: no hay nada leído.
 */
export function loQueMasLeFunciona(cs: readonly DelCompetidor[], ahora: number, tope = 3): string[] {
  const hoy = new Date(ahora);
  const anuncios = cs.flatMap((c) => c.piezas.filter((p) => p.canal === 'anuncios' && (diasAlAire(p, hoy) ?? 0) >= 1).map((p) => ({ c, p })))
    .sort((x, y) => porDiasAlAire<Pieza>(hoy)(x.p, y.p));
  const deAnuncios = anuncios.map(({ c, p }) => {
    const g = gancho(p), n = diasAlAire(p, hoy)!;
    const dias = `${n} ${n === 1 ? 'día' : 'días'} al aire`;
    return `${c.nombre}: ${g ? `su anuncio «${g}»` : 'un anuncio'} ${sigueActivo(p) ? `lleva ${dias}` : `estuvo ${dias}`}.`;
  });
  const organicas = cs.flatMap((c) => {
    const porId = new Map(c.piezas.map((p) => [p.id, p]));
    return mejoresPiezas(c.piezas, tope, ahora).map((d) => ({ c, p: porId.get(d.id), d }));
  }).sort((x, y) => y.d.veces - x.d.veces);
  const deOrganicas = organicas.map(({ c, p, d }) => {
    const g = p ? gancho(p) : null;
    return `${c.nombre}: ${g ? `«${g}»` : 'una publicación'} rindió ${rotuloCortoDeMultiplo(d.multiplo)} lo que suele hacer su cuenta.`;
  });
  return [...deAnuncios, ...deOrganicas].slice(0, tope);
}
