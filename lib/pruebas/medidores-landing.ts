// =============================================================================
// pruebas/medidores-landing — «tocó el botón de conversión», «dejó sus datos» y «le dio play» de una prueba de landing (O18)
// =============================================================================
// Los medidores de la superficie `landing` que corre el cron de pruebas (app/api/cron/pruebas), como los de Automations
// (./medidores-automatizacion.ts). La unidad es el `visitor_id` y se lee lo que el Pixel YA registra, con el ws EXPLÍCITO
// (corren en un cron): las visitas (`landing_visits`) y los eventos (`vsl_events`) de las direcciones de ESA landing
// publicada (`urlsAMedir`, la misma cuenta que su Análisis), sin la marca del probador; y los leads por su `visitor_id` para
// «dejó sus datos» (el opt-in del Pixel guarda el visitante en el lead que crea). Las reglas, puras y con test, en
// ./medidores-landing-reglas.ts. Una lectura que falla TIRA: la corrida queda fallida y no decide (nunca «0 éxitos»).
//
// ⚠️ Lo que no mide (dicho, no escondido):
//   · el dominio propio: como el Análisis, sólo hola-mako.site/<slug> y hola-mako.com/l/<slug>;
//   · «dejó sus datos» de quien YA era lead (el opt-in le suma un funnel, no crea un lead): un «no» en las dos ramas por
//     igual, no un sesgo.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { leerTodo, type ConsultaPaginada } from '@/lib/supabase-paginado';
import { basesLandings } from '@/lib/app-url';
import { esUrlMedida, urlsAMedir } from '@/lib/editor-landing/server-reglas';
import { rutasDeFoto } from '@/lib/editor-landing/server';
import { unidadValida } from './asignar';
import { TOLERANCIA_ASIGNACION_MS, type Asignacion, type Medidor } from './metricas';
import { destinoCuenta, resultadosDeLanding, type EventoUnidad } from './medidores-landing-reglas';

const TANDA = 200;
type FilaEvento = { id: number; visitor_id: string | null; landing_url: string | null; created_at: string; detalle?: string | null; auto?: boolean | null };

/** Las direcciones medidas de la landing de la prueba (`lugar.doc_id`), o tira si no se puede medir. */
async function direccionesDe(ws: number, lugar: Readonly<Record<string, unknown>>): Promise<Set<string>> {
  const docId = Number(lugar.doc_id);
  if (!Number.isInteger(docId) || docId <= 0) throw new Error('la prueba no dice de qué landing es (lugar.doc_id)');
  const { data, error } = await getSupabaseServer().from('landing_docs').select('slug, publicado').eq('workspace_id', ws).eq('id', docId).maybeSingle();
  if (error) throw new Error(`landing_docs: ${error.message}`);
  const f = data as { slug: string | null; publicado: unknown } | null;
  const urls = f?.publicado ? urlsAMedir(basesLandings(), f.slug, rutasDeFoto(f.publicado)) : [];
  if (!urls.length) throw new Error(`la landing #${docId} no está publicada: no hay qué medir`);
  return new Set(urls);
}

/** Las filas de `tabla` de los visitantes de las asignaciones, de a tandas, desde la primera asignación hasta `hasta`. */
async function deLosVisitantes(ws: number, tabla: string, cols: string, asignaciones: readonly Asignacion[], hasta: string, filtro?: (q: ConsultaPaginada) => ConsultaPaginada): Promise<FilaEvento[]> {
  const validas = asignaciones.filter((a) => unidadValida(a.unidad));
  const unidades = [...new Set(validas.map((a) => a.unidad))];
  if (!unidades.length) return [];
  const desde = new Date(Math.min(...validas.map((a) => Date.parse(a.asignadaAt))) - TOLERANCIA_ASIGNACION_MS).toISOString();
  const out: FilaEvento[] = [];
  for (let i = 0; i < unidades.length; i += TANDA) {
    const tanda = unidades.slice(i, i + TANDA);
    out.push(...await leerTodo<FilaEvento>(getSupabaseServer(), tabla, cols, {
      eq: { workspace_id: ws }, orden: 'id',
      filtros: (q) => { const base = q.in('visitor_id', tanda).gte('created_at', desde).lte('created_at', hasta); return filtro ? filtro(base) : base; },
    }));
  }
  return out;
}

const comoEventos = (filas: readonly FilaEvento[], medidas: ReadonlySet<string> | null, vale: (f: FilaEvento) => boolean = () => true): EventoUnidad[] =>
  filas.filter((f) => f.visitor_id && (!medidas || esUrlMedida(f.landing_url, medidas)) && vale(f)).map((f) => ({ unidad: String(f.visitor_id), at: f.created_at }));

/** Un medidor de landing: el denominador son los que vieron la página; `logros` lee lo que cuenta como éxito. */
function medidorLanding(logros: (p: { ws: number; asignaciones: readonly Asignacion[]; hasta: string; medidas: ReadonlySet<string>; destinos: readonly string[] }) => Promise<EventoUnidad[]>): Medidor {
  return async ({ ws, lugar, asignaciones, hasta, definicion }) => {
    const medidas = await direccionesDe(ws, lugar);
    const visitas = comoEventos(await deLosVisitantes(ws, 'landing_visits', 'id, visitor_id, landing_url, created_at', asignaciones, hasta, (q) => q.is('prueba', null)), medidas);
    const hechos = await logros({ ws, asignaciones, hasta, medidas, destinos: definicion.destinos ?? [] });
    return resultadosDeLanding(asignaciones, visitas, hechos, hasta);
  };
}

/** «Tocó el botón de conversión»: un clic a uno de los destinos que la prueba congeló al crearse. */
export const medirClicConversion: Medidor = medidorLanding(async ({ ws, asignaciones, hasta, medidas, destinos }) => {
  if (!destinos.some((d) => typeof d === 'string' && d.trim())) throw new Error('la prueba no guardó los destinos que cuentan como conversión');
  const filas = await deLosVisitantes(ws, 'vsl_events', 'id, visitor_id, landing_url, created_at, detalle', asignaciones, hasta, (q) => q.eq('tipo_evento', 'click').is('prueba', null));
  return comoEventos(filas, medidas, (f) => destinoCuenta(f.detalle, destinos));
});

/** «Le dio play al video»: un play que NO arrancó solo (`auto`, mig 0136). */
export const medirPlayManual: Medidor = medidorLanding(async ({ ws, asignaciones, hasta, medidas }) => {
  const filas = await deLosVisitantes(ws, 'vsl_events', 'id, visitor_id, landing_url, created_at, auto', asignaciones, hasta, (q) => q.eq('tipo_evento', 'play').is('prueba', null));
  return comoEventos(filas, medidas, (f) => f.auto !== true);
});

/** «Dejó sus datos»: el lead que nació del opt-in de ese visitante. */
export const medirOptin: Medidor = medidorLanding(async ({ ws, asignaciones, hasta }) => {
  const filas = await deLosVisitantes(ws, 'leads', 'id, visitor_id, created_at', asignaciones, hasta);
  return comoEventos(filas, null);
});

/** Los medidores de la landing, por clave de métrica (lib/pruebas/metricas.ts). */
export const MEDIDORES_LANDING: Readonly<Record<string, Medidor>> = {
  clic_conversion: medirClicConversion,
  optin: medirOptin,
  play_manual: medirPlayManual,
};
