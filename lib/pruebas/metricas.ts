// =============================================================================
// pruebas/metricas — QUÉ cuenta como éxito en una prueba A/B, y cómo se cuenta por rama (PURO, 25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md (2.6, con la crítica B): decide UNA métrica de conversión por persona, CONGELADA al crear la
// prueba; la final (agendó, compró) hace de guardrail. No hay tabla de eventos nueva: cada superficie tiene su MEDIDOR,
// que lee lo que ya existe (vsl_events y landing_visits por `visitor_id`; nutricion_envios, nutricion_inscripciones y
// leads por `lead_id`) con fecha posterior a la asignación, y devuelve el resultado de CADA unidad que se le pidió.
//   · «Agendó» y «pagó» son ESTADOS que se reescriben (`agendoLead` mira cualquier fecha de reunión, y `junta_1_at` es la
//     hora de la reunión, no la de la reserva): cuentan sólo si al asignar NO estaba (`previo`, que se congela ahí).
//   · «Respondió» sale del estado de la inscripción, que se reescribe al volver a entrar: el medidor congela el PRIMER
//     resultado y su hora (`desenlace_at`, o `updated_at`).
//   · `clic_conversion` no es un tipo de página: la prueba guarda la lista EXACTA de destinos que cuentan.
// `conteosPorRama` es lo que lee el juez: sólo personas MADURAS (cumplieron la ventana), y un éxito sólo dentro de su
// ventana. ⚠️ UNA LECTURA INCOMPLETA NO ES «0 ÉXITOS»: si el medidor no devolvió a alguien maduro, el conteo falla y la
// corrida no decide (el Analyst se traga los errores a propósito; acá las lecturas son estrictas, diseño 2.8).
// =============================================================================

import { unidadValida } from './asignar';
import type { ConteoRama } from './juez';

export type Superficie = 'landing' | 'automatizacion' | 'portada_mako' | 'anuncios' | 'vsl';
export type Unidad = 'lead' | 'visitante';

export type DefMetrica = {
  clave: string;
  superficies: readonly Superficie[];
  unidad: Unidad;
  titulo: string;
  /** Cómo se congela lo que se reescribe: el estado al asignar, o el primer resultado. */
  congela?: 'estado_previo' | 'primer_resultado';
  /** Lo que la prueba tiene que guardar al crearse para poder medirla. */
  pide?: 'destinos';
  /** Sólo como guardrail: es la final, demasiado rara para decidir. */
  soloGuardrail?: boolean;
};

/** El catálogo. Los medidores viven con su superficie (Automations, Landings); acá, qué es cada una. */
export const METRICAS: readonly DefMetrica[] = [
  { clave: 'respondio', superficies: ['automatizacion'], unidad: 'lead', titulo: 'Respondió', congela: 'primer_resultado' },
  { clave: 'agendo', superficies: ['automatizacion', 'landing'], unidad: 'lead', titulo: 'Agendó', congela: 'estado_previo' },
  { clave: 'pago', superficies: ['automatizacion', 'landing'], unidad: 'lead', titulo: 'Pagó', congela: 'estado_previo', soloGuardrail: true },
  { clave: 'clic_email', superficies: ['automatizacion'], unidad: 'lead', titulo: 'Tocó el link del email' },
  { clave: 'clic_conversion', superficies: ['landing', 'portada_mako'], unidad: 'visitante', titulo: 'Tocó el botón de conversión', pide: 'destinos' },
  { clave: 'optin', superficies: ['landing', 'portada_mako'], unidad: 'visitante', titulo: 'Dejó sus datos' },
  { clave: 'play_manual', superficies: ['landing', 'vsl'], unidad: 'visitante', titulo: 'Le dio play al video' },
];

export const metricaDe = (clave: string): DefMetrica | undefined => METRICAS.find((m) => m.clave === clave);

/** Lo que la prueba congela de su métrica al crearse (diseño 2.6 y crítica 8). */
export type DefinicionMetrica = { destinos?: string[] };

/** Los problemas de elegir esa métrica para esa superficie, en palabras. Vacío = se puede. */
export function problemasDeMetrica(clave: string, superficie: Superficie, def: DefinicionMetrica = {}, comoGuardrail = false): string[] {
  const m = metricaDe(clave);
  if (!m) return [`«${clave}» no es una métrica de pruebas.`];
  const err: string[] = [];
  if (!m.superficies.includes(superficie)) err.push(`«${m.titulo}» no se mide en ${superficie}.`);
  if (m.soloGuardrail && !comoGuardrail) err.push(`«${m.titulo}» es demasiado rara para decidir: va como guardrail.`);
  if (m.pide === 'destinos' && !(def.destinos ?? []).some((d) => typeof d === 'string' && d.trim())) {
    err.push(`«${m.titulo}» necesita la lista de destinos que cuentan (los links o botones), fijada al crear la prueba.`);
  }
  return err;
}

/**
 * Una asignación, como sale de `prueba_asignaciones`. `previo`: el estado de cada métrica de ESTADO al asignar
 * (congelado), por clave: {agendo: true}. La que decide y un guardrail pueden ser las dos de estado.
 */
export type Asignacion = { unidad: string; rama: string; asignadaAt: string; previo?: Readonly<Record<string, boolean>> };
/** Lo que el medidor dice de una unidad: si logró la métrica y cuándo (la PRIMERA vez). */
export type Resultado = { logro: boolean; at?: string | null };

/** Un medidor: lee la base de la superficie y devuelve el resultado de CADA unidad que se le pidió. */
export type Medidor = (p: {
  ws: number; pruebaId: number; metrica: string; definicion: DefinicionMetrica;
  /** Dónde vive la prueba (`pruebas.lugar`): la automatización y su tarjeta, o la landing. */
  lugar: Readonly<Record<string, unknown>>;
  /** TODAS las de la época (no sólo las maduras): el medidor congela el primer resultado el día que pasa. */
  asignaciones: readonly Asignacion[];
  /** Hasta cuándo se mira: el fin de AYER (las lecturas no miran el día que corre). */
  hasta: string;
}) => Promise<Map<string, Resultado>>;

/** La asignación se escribe DESPUÉS de responder: un evento hasta 1 minuto antes cuenta (crítica, punto 9). */
export const TOLERANCIA_ASIGNACION_MS = 60_000;
const DIA_MS = 86_400_000;

/**
 * LOS CONTEOS DEL JUEZ. Por rama: `n` = personas maduras (su ventana terminó antes de `hasta`) y `x` = las que lograron
 * la métrica DENTRO de su ventana y no la tenían al asignar. `asignados` cuenta a todas, maduras o no (para la pantalla).
 */
export function conteosPorRama(
  asignaciones: readonly Asignacion[],
  resultados: ReadonlyMap<string, Resultado>,
  o: { ramas: ReadonlyArray<{ clave: string; control?: boolean; activa?: boolean }>; ventanaDias: number; hasta: string; metrica: string },
): { ok: true; ramas: ConteoRama[]; asignados: Record<string, number> } | { ok: false; error: string } {
  const hasta = Date.parse(o.hasta);
  if (!Number.isFinite(hasta)) return { ok: false, error: `«${o.hasta}» no es una fecha` };
  const porRama = new Map(o.ramas.map((r) => [r.clave, { n: 0, x: 0, asignados: 0 }]));
  const faltan: string[] = [];
  for (const a of asignaciones) {
    if (!unidadValida(a.unidad)) continue;
    const c = porRama.get(a.rama);
    if (!c) continue;
    const desde = Date.parse(a.asignadaAt);
    if (!Number.isFinite(desde)) return { ok: false, error: `la asignación de ${a.unidad} no tiene fecha` };
    c.asignados++;
    const fin = desde + o.ventanaDias * DIA_MS;
    if (fin > hasta) continue;
    const r = resultados.get(a.unidad);
    if (!r) { faltan.push(a.unidad); continue; }
    c.n++;
    if (!r.logro || a.previo?.[o.metrica] === true) continue;
    const at = r.at ? Date.parse(r.at) : NaN;
    if (Number.isFinite(at) && (at < desde - TOLERANCIA_ASIGNACION_MS || at > fin)) continue;
    c.x++;
  }
  if (faltan.length) return { ok: false, error: `el medidor no devolvió a ${faltan.length} persona(s) madura(s) (${faltan.slice(0, 3).join(', ')}…): la lectura no cuenta` };
  return {
    ok: true,
    ramas: o.ramas.map((r) => ({ clave: r.clave, control: r.control, activa: r.activa, n: porRama.get(r.clave)!.n, x: porRama.get(r.clave)!.x })),
    asignados: Object.fromEntries([...porRama].map(([k, v]) => [k, v.asignados])),
  };
}
