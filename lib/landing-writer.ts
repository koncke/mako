// =============================================================================
// Landing Generator — MaKo escribe la landing entera (estructura + copy)
// =============================================================================
// Un "writer": no persiste una fila por entidad ni corre un sync batcheado como
// el Landing Analyst — genera a pedido y guarda el resultado en `landing_drafts`
// para que la propuesta no se pierda al recargar y se puedan comparar versiones.
//
// Lo que lo diferencia de pedirle copy a un chat: el brief. MaKo escribe con el
// FUNNEL (el CTA tiene que empujar a la entrada real del negocio), el PERFIL del
// onboarding (oferta, precio, garantía, promesa), el MÉTODO del RAG y —si esa
// URL ya pasó por el Landing Analyst— el diagnóstico con sus hallazgos. Ese
// último enganche es el que cierra el loop: analizar → reescribir lo que falla.
//
// El copy sale en español neutro/mexicano (es para la audiencia del cliente); el
// `rationale` va en la voz de MaKo, que le habla al dueño.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { chatClaude } from './anthropic';
import { contenidoNoConfiable, renderPrompt } from './prompt-render';
import { getActivePersona, MAKO_NUCLEO } from './mako-prompts';
import { getFunnel } from './leads';
import { perfilNegocioTexto } from './onboarding';
import { searchKnowledge, formatKnowledge } from './mako-knowledge';
import { normalizarUrl } from './landing-fetch';
import type { LandingAnalysisRow } from './landing-analyst';
import {
  OBJETIVOS_LANDING, BLOQUE_TIPOS, TIPO_LABEL, objetivoLabel, specAMarkdown,
  type ObjetivoLanding, type BloqueTipo, type BloqueLanding, type LandingSpec,
} from './landing-spec';

// El spec que devuelve MaKo vive en lib/landing-spec.ts (puro): la pantalla de
// revisión lo necesita como VALOR y este módulo es server-only. Se re-exporta
// para que los call-sites del server sigan importando de un solo lugar.
export {
  OBJETIVOS_LANDING, BLOQUE_TIPOS, TIPO_LABEL, objetivoLabel, specAMarkdown,
  type ObjetivoLanding, type BloqueTipo, type BloqueLanding, type LandingSpec,
};

// ─────────────────────────────────────────────────────────────────────────────
// Contrato JSON (editable como referencia)
// ─────────────────────────────────────────────────────────────────────────────

export const LANDING_JSON_SHAPE = `Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto fuera del JSON) con esta forma EXACTA:
{
  "nombre": "nombre interno de la página",
  "objetivo": "agendar | vender | registrar | descargar",
  "avatar": "a quién le habla la página, en una frase concreta",
  "promesa": "la promesa principal en UNA frase: qué logra, para quién, en cuánto tiempo",
  "headline": "el H1. Específico, sin adjetivos vacíos. Máx ~90 caracteres",
  "subheadline": "una frase que completa el H1 y dice cómo. Máx ~160 caracteres",
  "cta_principal": "texto del botón, 2-4 palabras, en primera persona del visitante",
  "bloques": [
    {
      "tipo": "hero | prueba_social | problema | solucion | beneficios | como_funciona | testimonios | oferta | precio | garantia | objeciones | faq | cta_final",
      "titulo": "el H2 de la sección",
      "copy": "el cuerpo de la sección, escrito, listo para pegar",
      "bullets": ["..."],
      "cta": "texto del botón si la sección lleva uno, si no cadena vacía",
      "nota": "por qué esta sección va acá, para el dueño"
    }
  ],
  "meta_titulo": "el <title> de la página",
  "meta_descripcion": "la meta descripción, ~155 caracteres",
  "rationale": "UNA frase para el dueño explicando la decisión central de la estructura"
}
Reglas: entre 6 y 10 bloques; el primero SIEMPRE "hero" y el último SIEMPRE "cta_final". NO inventes testimonios, nombres, cifras de resultados ni logos: si no te pasaron prueba real, el bloque de testimonios va con el copy vacío y la nota diciendo qué prueba hay que conseguir. NO prometas resultados que el negocio no dijo que da.`;

// ─────────────────────────────────────────────────────────────────────────────
// Plantillas (con {{slots}}) — editables en /configuraciones
// ─────────────────────────────────────────────────────────────────────────────

export const LANDING_SUGGEST_SYSTEM_TEMPLATE = `Sos MaKo y estás escribiendo la LANDING del negocio: la página a la que llega el tráfico y que tiene UN trabajo, que la persona correcta dé el siguiente paso.

Escribís COPY TERMINADO, no un esquema. Cada bloque sale listo para pegar en la página.

CÓMO DECIDIR LA ESTRUCTURA:
- El CTA se deriva del FUNNEL, no de tu gusto: si la entrada real del negocio es una reunión agendada, todos los botones empujan ahí y no hay un segundo llamado que compita.
- Una sola promesa. Si la página promete tres cosas, no promete ninguna.
- Especificidad como prueba: un número, un plazo o un nombre concreto valen más que tres adjetivos.
- Escribí contra las objeciones REALES del avatar, no contra objeciones genéricas.
- El orden manda: cada bloque tiene que ganarse el siguiente scroll.

PROHIBIDO INVENTAR: testimonios, nombres de clientes, cifras de resultados, cantidad de clientes, premios, logos y garantías que el negocio no te haya dicho que tiene. Si te falta la prueba, dejá el bloque con el copy vacío y usá la "nota" para pedirle al dueño exactamente qué conseguir. Una landing con un testimonio inventado es un problema legal, no una sugerencia.

{{metodologia}}

IDIOMA (IMPORTANTE): TODO el copy de la página es para la AUDIENCIA del cliente, que es de MÉXICO. Escribilo en ESPAÑOL NEUTRO/MEXICANO, sin voseo ni modismos argentinos: "tú / tienes / quieres / puedes / mira", NUNCA "vos / tenés / querés / podés / mirá". Tu voz rioplatense va SOLO en el "rationale" y en las "nota" de cada bloque, que me los escribís a mí.

{{jsonShape}}`;

export const LANDING_SUGGEST_USER_TEMPLATE = `PEDIDO DEL USUARIO:
{{pedido}}

OBJETIVO DE LA PÁGINA: {{objetivo}}

CONTEXTO DEL NEGOCIO (datos reales):
{{contexto}}

{{diagnostico}}
Devolvé el JSON del LandingSpec con tu propuesta.`;

export const LANDING_ADJUST_SYSTEM_TEMPLATE = `Sos MaKo ajustando una landing que YA propusiste. El usuario te pide cambios: aplicá SOLO lo que pide y conservá TODO lo demás del spec actual, palabra por palabra. No reescribas bloques que no te pidió tocar.

Siguen valiendo las mismas prohibiciones: no inventes testimonios, cifras, nombres ni garantías.

IDIOMA: el copy de la página va en español neutro/mexicano ("tú / tienes / puedes"), sin voseo. Tu voz rioplatense solo en el rationale y en las notas.

{{jsonShape}}`;

export const LANDING_ADJUST_USER_TEMPLATE = `SPEC ACTUAL (JSON):
{{specActual}}

CAMBIO QUE PIDE EL USUARIO:
{{instruccion}}

CONTEXTO DEL NEGOCIO (por si lo necesitás):
{{contexto}}

Devolvé el JSON COMPLETO del LandingSpec ya ajustado.`;

/** Método de páginas de conversión — el criterio, editable como el resto. */
export const LANDING_METODOLOGIA = `MÉTODO (aplicalo):
- Los primeros 5 segundos deciden: arriba de todo tiene que quedar claro QUÉ es, PARA QUIÉN y QUÉ hacer. Si hay que hacer scroll para entenderlo, la página ya falló.
- Una promesa, un CTA, repetido. Nada de "agenda una llamada" arriba y "descarga la guía" abajo.
- Beneficio antes que feature: la persona no compra el método, compra lo que le pasa después.
- Prueba pegada a la promesa: el testimonio va inmediatamente después de la afirmación que sostiene, no en una sección aislada al final.
- Las objeciones se contestan en la página, no en la llamada: precio, tiempo, "¿me sirve a mí?", "¿y si no funciona?".
- Fricción: cada campo del formulario cuesta. Pedí lo mínimo para dar el siguiente paso.`;

// ─────────────────────────────────────────────────────────────────────────────
// Brief del negocio (grounding)
// ─────────────────────────────────────────────────────────────────────────────

/** System prompt branded (persona + núcleo + plantilla ya renderizada). */
export async function brandSystem(rendered: string): Promise<string> {
  const persona = await getActivePersona().catch(() => '');
  return [persona, MAKO_NUCLEO, rendered].filter(Boolean).join('\n\n');
}

/**
 * Compone el contexto real del negocio. Tolerante: cada bloque degrada a '—' sin
 * romper la generación (un negocio recién onboardeado no tiene todo cargado).
 */
export async function buildLandingBrief(pedido: string): Promise<string> {
  const [funnelTxt, perfilTxt, conocimientoTxt] = await Promise.all([
    (async () => {
      try {
        const f = await getFunnel();
        const etapas = f.pipeline.map((s) => `${s.label}${s.kind ? ` (${s.kind})` : ''}`).join(' → ');
        const entrada = f.pipeline.find((s) => s.kind === 'entrada');
        return `Etapas: ${etapas}.\nEntrada real del funnel: ${entrada ? entrada.label : '—'}. El CTA de la landing tiene que empujar EXACTAMENTE a esa entrada.`;
      } catch { return '—'; }
    })(),
    perfilNegocioTexto().catch(() => '—'),
    (async () => {
      try {
        const k = await searchKnowledge(pedido || 'copywriting de landing page, estructura de página de conversión', 4);
        return k.length ? formatKnowledge(k) : '';
      } catch { return ''; }
    })(),
  ]);

  return [
    `### FUNNEL\n${funnelTxt}`,
    `### PERFIL DEL NEGOCIO (oferta, promesa, precio, garantía)\n${perfilTxt}`,
    conocimientoTxt ? `### MÉTODO (conocimiento cargado)\n${conocimientoTxt}` : '',
  ].filter(Boolean).join('\n\n');
}

/**
 * Si esa URL ya pasó por el Landing Analyst, se le pasa el diagnóstico: es el
 * enganche que convierte "escribime una landing" en "arreglá ESTA landing".
 */
export async function diagnosticoDe(url: string | null | undefined): Promise<string> {
  if (!url) return '';
  let norm: string;
  try { norm = normalizarUrl(url); } catch { return ''; }
  try {
    const supabase = (await getTenantDb());
    const { data } = await supabase
      .from('landing_analyses')
      .select('url, titulo, score, veredicto, resumen, promesa, avatar, hallazgos, dims, comportamiento')
      .eq('url', norm)
      .eq('status', 'analizada')
      .maybeSingle();
    if (!data) return '';
    const row = data as unknown as LandingAnalysisRow;
    const hall = (row.hallazgos ?? []).slice(0, 8)
      .map((h) => `- [${h.severidad}] ${h.titulo} — dice "${h.cita}". Arreglo propuesto: ${h.arreglo}`).join('\n');
    const dims = (row.dims ?? []).map((d) => `${d.label} ${d.score}/10`).join(' · ');
    const c = row.comportamiento;
    const comp = c?.hay_datos
      ? `Comportamiento medido: ${c.visitas} visitas de ${c.visitantes} personas, ${c.agendas} agendaron.`
      : 'Sin datos de comportamiento para esa URL.';
    return [
      '## DIAGNÓSTICO DE LA PÁGINA ACTUAL (Landing Analyst)',
      `Es la MISMA página que estás reescribiendo: ${row.url}`,
      `Veredicto: ${row.veredicto ?? '—'} (${row.score ?? '—'}/10). ${dims}`,
      row.resumen ? `Resumen: ${row.resumen}` : '',
      // `promesa` y las `cita` de los hallazgos son, por contrato del prompt del
      // analista, texto LITERAL de la página de un tercero. Crudos acá volvían a
      // entrar al modelo como contexto confiable: el mismo agujero de inyección,
      // una vuelta más adelante en el circuito.
      row.promesa ? `Promesa actual:\n${contenidoNoConfiable(row.promesa, 'promesa_actual')}` : '',
      comp,
      hall ? `Hallazgos a resolver SÍ o SÍ en la nueva versión:\n${contenidoNoConfiable(hall, 'hallazgos_pagina')}` : '',
      '',
    ].filter(Boolean).join('\n');
  } catch { return ''; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parseo + coerción del JSON
// ─────────────────────────────────────────────────────────────────────────────

export function parseJsonObject(text: string): Record<string, unknown> {
  const c = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const a = c.indexOf('{'), b = c.lastIndexOf('}');
  if (a === -1 || b <= a) throw new Error('respuesta sin JSON');
  return JSON.parse(c.slice(a, b + 1)) as Record<string, unknown>;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

// Set<string> explícito: con el tipo inferido (la unión literal) `.has(objRaw)`
// no compila, porque lo que llega del modelo es un string cualquiera.
const OBJ_VALUES = new Set<string>(OBJETIVOS_LANDING.map((o) => o.value));
const TIPO_VALUES = new Set<string>(BLOQUE_TIPOS);

function coerceBloque(raw: unknown, idx: number): BloqueLanding {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const t = str(b.tipo).toLowerCase();
  return {
    tipo: (TIPO_VALUES.has(t) ? t : 'beneficios') as BloqueTipo,
    titulo: str(b.titulo) || `Sección ${idx + 1}`,
    copy: str(b.copy),
    bullets: strArr(b.bullets),
    cta: str(b.cta),
    nota: str(b.nota),
  };
}

/**
 * Coacciona el JSON de MaKo a un LandingSpec válido, con defaults sanos. La
 * pantalla de revisión lee ESTA forma: si cambia el jsonShape, cambia acá.
 */
export function parseLandingSpec(text: string, objetivoFallback: ObjetivoLanding = 'agendar'): LandingSpec {
  const raw = parseJsonObject(text);
  const objRaw = str(raw.objetivo).toLowerCase();
  const bloquesRaw = Array.isArray(raw.bloques) && raw.bloques.length ? raw.bloques : [{}];
  const bloques = bloquesRaw.map(coerceBloque);
  // El contrato promete hero primero y cta_final último: lo garantizamos acá en
  // vez de confiar en que el modelo lo respete siempre.
  if (bloques.length && bloques[0].tipo !== 'hero') bloques[0] = { ...bloques[0], tipo: 'hero' };
  if (bloques.length > 1 && bloques[bloques.length - 1].tipo !== 'cta_final') {
    bloques[bloques.length - 1] = { ...bloques[bloques.length - 1], tipo: 'cta_final' };
  }
  return {
    nombre: str(raw.nombre) || 'Landing nueva',
    objetivo: (OBJ_VALUES.has(objRaw) ? objRaw : objetivoFallback) as ObjetivoLanding,
    avatar: str(raw.avatar),
    promesa: str(raw.promesa),
    headline: str(raw.headline),
    subheadline: str(raw.subheadline),
    cta_principal: str(raw.cta_principal) || 'Agenda tu llamada',
    bloques,
    meta_titulo: str(raw.meta_titulo),
    meta_descripcion: str(raw.meta_descripcion),
    rationale: str(raw.rationale),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generación (pura) + historial
// ─────────────────────────────────────────────────────────────────────────────

export type GenerarResult = { ok: true; spec: LandingSpec } | { ok: false; error: string };

export type GenerarInput = {
  pedido: string;
  objetivo?: ObjetivoLanding;
  /** URL ya analizada: si viene, el diagnóstico entra al prompt. */
  basadoEnUrl?: string | null;
};

/** MaKo escribe la landing desde cero. PURA: nunca tira, devuelve {ok}. */
export async function generarLanding(input: GenerarInput): Promise<GenerarResult> {
  try {
    const objetivo = input.objetivo && OBJ_VALUES.has(input.objetivo) ? input.objetivo : 'agendar';
    const objDef = OBJETIVOS_LANDING.find((o) => o.value === objetivo)!;
    const [contexto, diagnostico] = await Promise.all([
      buildLandingBrief(input.pedido),
      diagnosticoDe(input.basadoEnUrl),
    ]);

    const system = await brandSystem(await renderPrompt('landing_writer.suggest.system', LANDING_SUGGEST_SYSTEM_TEMPLATE, {
      metodologia: LANDING_METODOLOGIA,
      jsonShape: LANDING_JSON_SHAPE,
    }));
    const user = await renderPrompt('landing_writer.suggest.user', LANDING_SUGGEST_USER_TEMPLATE, {
      // Lo que escribe el usuario es contenido no confiable: delimitado.
      pedido: contenidoNoConfiable(input.pedido || '(sin pedido: proponé la mejor página para este negocio)', 'pedido'),
      objetivo: `${objDef.label} — ${objDef.hint}`,
      contexto,
      diagnostico,
    });

    const text = await chatClaude(system, [{ role: 'user', content: user }], {
      thinking: true, effort: 'high', maxTokens: 8000,
      feature: 'landing-writer',
      motivo: input.basadoEnUrl ? `Reescribir landing ${input.basadoEnUrl}` : 'Escribir landing nueva',
    });
    const spec = parseLandingSpec(text, objetivo);
    // El onboarding de la tab se completa usándola (ver TAB_ONBOARDINGS).
    try {
      const { marcarPasoTab } = await import('./tab-onboarding-state');
      await marcarPasoTab('landing-writer', 'generar');
    } catch { /* accesorio al resultado */ }
    return { ok: true, spec };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** MaKo ajusta una propuesta que ya hizo, conservando lo que no se pidió tocar. */
export async function ajustarLanding(spec: LandingSpec, instruccion: string): Promise<GenerarResult> {
  try {
    const contexto = await buildLandingBrief(instruccion);
    const system = await brandSystem(await renderPrompt('landing_writer.adjust.system', LANDING_ADJUST_SYSTEM_TEMPLATE, {
      jsonShape: LANDING_JSON_SHAPE,
    }));
    const user = await renderPrompt('landing_writer.adjust.user', LANDING_ADJUST_USER_TEMPLATE, {
      specActual: JSON.stringify(spec, null, 2),
      instruccion: contenidoNoConfiable(instruccion, 'instruccion'),
      contexto,
    });
    const text = await chatClaude(system, [{ role: 'user', content: user }], {
      thinking: true, effort: 'high', maxTokens: 8000,
      feature: 'landing-writer', motivo: 'Ajustar landing',
    });
    return { ok: true, spec: parseLandingSpec(text, spec.objetivo) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Historial (landing_drafts)
// ─────────────────────────────────────────────────────────────────────────────

export type LandingDraft = {
  id: number;
  pedido: string;
  objetivo: string | null;
  basado_en_url: string | null;
  spec: LandingSpec;
  titulo: string | null;
  created_at: string;
};

export async function guardarDraft(input: GenerarInput, spec: LandingSpec): Promise<number | null> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('landing_drafts')
    .insert({
      pedido: input.pedido,
      objetivo: spec.objetivo,
      basado_en_url: input.basadoEnUrl ? normalizarUrl(input.basadoEnUrl) : null,
      spec,
      titulo: spec.nombre,
      model: 'landing-writer',
    })
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`Error guardando el borrador: ${error.message}`);
  try {
    const { marcarPasoTab } = await import('./tab-onboarding-state');
    await marcarPasoTab('landing-writer', 'guardar');
  } catch { /* accesorio al guardado */ }
  return (data as { id: number } | null)?.id ?? null;
}

export async function listarDrafts(limite = 20): Promise<LandingDraft[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('landing_drafts')
    .select('id, pedido, objetivo, basado_en_url, spec, titulo, created_at')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw new Error(`Error leyendo el historial: ${error.message}`);
  return (data ?? []) as unknown as LandingDraft[];
}

export async function borrarDraft(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('landing_drafts').delete().eq('id', id);
  if (error) throw new Error(`Error borrando el borrador: ${error.message}`);
}

