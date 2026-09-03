// =============================================================================
// metricas-negocio — los NÚMEROS del negocio por período, en un solo lugar
// =============================================================================
// «Quiero ver un trimestre: inversión en Meta, impresiones, llegadas al landing
// VSL, juntas agendadas, juntas 1 realizadas, j2 realizadas… ¿puedo bajar la
// data?» — Mauricio, 02/09/2026. Este módulo es esa pregunta contestada.
//
// POR QUÉ EXISTE SEPARADO de `lib/queries.ts`, que ya tiene `getMarketingWindow`:
//
//  1. `getMarketingWindow(start, end)` devuelve UN agregado de toda la ventana.
//     La pregunta es una SERIE (mes a mes de un trimestre), y llamarlo N veces
//     multiplica el problema del punto 2 por N.
//  2. ⚠️ **`getMarketingWindow` NO PAGINA.** Lee `marketing_metrics_daily` con un
//     `.select().gte().lte()` pelado, y PostgREST corta en 1000 filas SIN avisar
//     (ver la cabecera de lib/supabase-paginado.ts). Esa tabla tiene UNA FILA POR
//     ANUNCIO POR DÍA: con 12 anuncios activos, un trimestre son ~1080 filas y el
//     total sale corto. En silencio, y siempre para abajo — que es la dirección
//     que hace creer que la inversión rindió más de lo que rindió. El propio
//     `queries.ts` importa `leerTodo` y lo usa más abajo (línea ~2072, con el
//     comentario del tope de 1000); `getMarketingWindow` quedó del lado viejo.
//     Acá se pagina SIEMPRE.
//  3. La pantalla de /marketing es del dueño y mezcla Meta + YouTube + Panda +
//     reconciliaciones. Esto es el dato crudo por período, workspace-aware, que
//     tiene que poder bajar cualquier cliente y leer un agente.
//
// LA REGLA QUE GOBIERNA EL MÓDULO: **un cero y un «no hay fuente» no se dicen
// igual.** Si el workspace no tiene Meta conectado, la columna de inversión es
// `null`, no `0`, y `cobertura` explica por qué. Un cero afirma un hecho del
// negocio («no invertiste»); un null dice lo único que sabemos («no tenemos de
// dónde leerlo»). Es la regla de AGENTS.md → «un verde que cierra la pregunta
// sobre algo que se está perdiendo es peor que un rojo».
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { leerPorPaginas } from './supabase-paginado';
import { TIPO_DE_CAMBIO_USD_MXN } from './config';
import { tzActual } from './timezone';
import { hoyEnTz, diasAntes } from './date-utils';
import { integracionConectada } from './credenciales';
import { esPreviewDeEditor } from './landing-paginas';

// ── El modelo ────────────────────────────────────────────────────────────────
// Los tipos, la agrupación por período y las salidas (CSV/markdown) viven en
// `metricas-modelo.ts`, SIN `server-only`, para que se puedan testear: es la
// misma separación que `cerebro-modelo` / `cerebro-grafo`.
//
// ⚠️ Se IMPORTA además de reexportarse. Un `export { x } from './y'` reexporta
// pero NO crea el binding local: `claveDe` usado acá abajo no existiría, y el
// error saldría recién al compilar. Son las dos cosas a propósito.
import {
  GRANOS, claveDe, clavesDelRango, validarRango, type Grano, type Cobertura,
  type FilaMetricas, type ReporteMetricas,
} from './metricas-modelo';

export type {
  Grano, FilaMetricas, CoberturaFuente, Cobertura, ReporteMetricas,
} from './metricas-modelo';
export {
  GRANOS, DIAS_DEFAULT, MAX_DIAS, claveDe, clavesDelRango, validarRango,
  COLUMNAS, metricasACsv, metricasAMarkdown,
} from './metricas-modelo';

/**
 * El rango pedido, ya validado y con la zona del workspace resuelta.
 *
 * La validación en sí vive en `validarRango` (puro, testeado). Lo único que
 * agrega esta función es lo que NO se puede testear sin base: qué día es HOY en
 * la zona de ESTE workspace. Por eso el reloj entra por acá y no allá.
 */
export async function resolverRango(
  desdeRaw?: string | null,
  hastaRaw?: string | null,
): Promise<{ desde: string; hasta: string; zona: string }> {
  const zona = await tzActual();
  return { ...validarRango(hoyEnTz(zona), desdeRaw, hastaRaw), zona };
}

/**
 * La fecha calendario de un `timestamptz`, en la zona del workspace.
 *
 * ⚠️ NO se puede cortar el ISO con `.slice(0, 10)`: eso da la fecha en UTC, y una
 * visita de las 19:00 en Tijuana es del día SIGUIENTE en UTC. Con el grano `mes`
 * eso corre al mes que viene todo lo que pasó después de las 16-17 h del último
 * día del mes — y como `marketing_metrics_daily.fecha` SÍ está en día local (la
 * escribe `ayerEnTijuana`), las dos series quedan desalineadas justo cuando se
 * las pone lado a lado. El resto del dashboard hace el slice y arrastra ese
 * corrimiento; acá no.
 *
 * Las columnas `DATE` (fecha_junta_1, marketing_metrics_daily.fecha) se cortan
 * directo: una DATE no tiene zona, y convertirla sería inventarle una.
 */
function fechaLocalDe(iso: string, zona: string): string {
  return hoyEnTz(zona, new Date(iso));
}

// ── El acumulador ────────────────────────────────────────────────────────────

type Acc = {
  meta_inversion: number; meta_impresiones: number; meta_clics: number;
  meta_clics_link: number; meta_landing_views: number; meta_formularios: number;
  landing_visitas: number; vsl_plays: number;
  /** Sets porque el único se cuenta DENTRO del período; ver `advertencias`. */
  landing_ids: Set<string>; vsl_ids: Set<string>;
  leads_nuevos: number; agendas_creadas: number;
  j1_programadas: number; j1_realizadas: number; j1_noshow: number; j1_sin_marcar: number;
  j2_programadas: number; j2_realizadas: number; j2_noshow: number; j2_sin_marcar: number;
  ganados: number; ingreso_usd: number;
};

const accVacio = (): Acc => ({
  meta_inversion: 0, meta_impresiones: 0, meta_clics: 0,
  meta_clics_link: 0, meta_landing_views: 0, meta_formularios: 0,
  landing_visitas: 0, vsl_plays: 0,
  landing_ids: new Set(), vsl_ids: new Set(),
  leads_nuevos: 0, agendas_creadas: 0,
  j1_programadas: 0, j1_realizadas: 0, j1_noshow: 0, j1_sin_marcar: 0,
  j2_programadas: 0, j2_realizadas: 0, j2_noshow: 0, j2_sin_marcar: 0,
  ganados: 0, ingreso_usd: 0,
});

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Orden estable para paginar `marketing_metrics_daily`.
 *
 * ⚠️ El `id` del final NO es adorno y la lección ya está pagada en
 * lib/ads-analyst.ts: hay una fila por anuncio POR DÍA, así que ni `fecha` ni
 * `ad_id` son únicos. Con un orden que empata, Postgres reparte los empates
 * distinto en cada request y el `.range()` de la página 2 se aplica sobre otro
 * orden → filas repetidas y filas salteadas, sin ningún error. Acá eso es spend
 * e impresiones sumadas de más o de menos.
 */
const ORDEN_META = [{ col: 'fecha' }, { col: 'ad_id' }, { col: 'id' }] as const;

/**
 * Arma el reporte. Corre DENTRO del workspace del que llama (todas las lecturas
 * van por `getTenantDb()`, que scopea sola por `workspace_id`); este módulo no
 * conoce inquilinos y no tiene que conocerlos.
 */
export async function reporteMetricas(opts: {
  desde?: string | null;
  hasta?: string | null;
  grano?: Grano;
}): Promise<ReporteMetricas> {
  const grano: Grano = GRANOS.includes(opts.grano as Grano) ? (opts.grano as Grano) : 'mes';
  const { desde, hasta, zona } = await resolverRango(opts.desde, opts.hasta);
  const db = await getTenantDb();

  const buckets = new Map<string, Acc>();
  const de = (clave: string): Acc => {
    let a = buckets.get(clave);
    if (!a) { a = accVacio(); buckets.set(clave, a); }
    return a;
  };
  /** Solo cuenta si la fecha cae en el rango pedido. Las columnas de fecha del
   *  lead se filtran EN MEMORIA (un lead tiene cinco fechas distintas y PostgREST
   *  no sabe hacer ese OR), así que el recorte tiene que estar acá. */
  const dentro = (f: string | null | undefined): string | null =>
    f && f >= desde && f <= hasta ? f : null;

  let filasMeta = 0;
  let filasLanding = 0;
  let filasVsl = 0;
  let filasLeads = 0;

  // ── Meta ───────────────────────────────────────────────────────────────────
  // `fecha` es DATE: se agrupa por el string tal cual, sin convertir zona.
  await leerPorPaginas<{
    fecha: string; spend: number | null; impressions: number | null;
    clicks: number | null; link_clicks: number | null;
    landing_page_views: number | null; leads_count: number | null;
  }>(
    db, 'marketing_metrics_daily',
    'id, fecha, ad_id, spend, impressions, clicks, link_clicks, landing_page_views, leads_count',
    (filas) => {
      for (const r of filas) {
        if (!r.fecha) continue;
        filasMeta++;
        const a = de(claveDe(r.fecha, grano));
        a.meta_inversion += num(r.spend);
        a.meta_impresiones += num(r.impressions);
        a.meta_clics += num(r.clicks);
        a.meta_clics_link += num(r.link_clicks);
        a.meta_landing_views += num(r.landing_page_views);
        a.meta_formularios += num(r.leads_count);
      }
    },
    {
      orden: ORDEN_META,
      // ⚠️ La MISMA tabla guarda YouTube y Panda. Sin este filtro, `spend` suma
      // filas que no son de Meta y las impresiones se mezclan con vistas de video.
      eq: { plataforma: 'meta' },
      filtros: (q) => q.gte('fecha', desde).lte('fecha', hasta),
    },
  );

  // ── Landing (snippet propio) ───────────────────────────────────────────────
  // `created_at` es timestamptz → se convierte a la fecha local del workspace.
  // El rango se pide con un día de colchón de cada lado y se recorta en memoria:
  // el borde del día en la zona del cliente no coincide con el borde en UTC.
  const desdeUtc = `${diasAntes(desde, 1)}T00:00:00Z`;
  const hastaUtc = `${diasAntes(hasta, -1)}T23:59:59Z`;

  let previewsDescartados = 0;
  await leerPorPaginas<{ created_at: string; visitor_id: string | null; landing_url: string | null }>(
    db, 'landing_visits', 'id, created_at, visitor_id, landing_url',
    (filas) => {
      for (const r of filas) {
        // ⚠️ EL PREVIEW DEL EDITOR NO ES TRÁFICO. Lovable guarda las visitas de
        // `id-preview--….lovable.app` y `*.lovableproject.com` en la misma tabla:
        // es la gente CONSTRUYENDO la página, no visitándola. Sin este descarte,
        // una semana de trabajo sobre la landing se lee como una semana buena.
        // La regla vive en `esPreviewDeEditor` y no se copia acá: es angosta a
        // propósito —un cliente sin dominio propio publica de verdad en
        // `<proyecto>.lovable.app`— y dos copias de una regla angosta divergen.
        if (r.landing_url && esPreviewDeEditor(r.landing_url)) { previewsDescartados++; continue; }
        const f = dentro(fechaLocalDe(r.created_at, zona));
        if (!f) continue;
        filasLanding++;
        const a = de(claveDe(f, grano));
        a.landing_visitas++;
        if (r.visitor_id) a.landing_ids.add(r.visitor_id);
      }
    },
    {
      orden: 'id',
      // ⚠️ `prueba is null` = tráfico REAL. La columna la puso la mig 0134 para el
      // probador de /integraciones: sin este filtro, cada vez que alguien aprieta
      // «Probar» en la landing su propia prueba entra al reporte como una visita.
      filtros: (q) => q.gte('created_at', desdeUtc).lte('created_at', hastaUtc).is('prueba', null),
    },
  );

  // ── VSL ────────────────────────────────────────────────────────────────────
  await leerPorPaginas<{ created_at: string; visitor_id: string | null }>(
    db, 'vsl_events', 'id, created_at, visitor_id',
    (filas) => {
      for (const r of filas) {
        const f = dentro(fechaLocalDe(r.created_at, zona));
        if (!f) continue;
        filasVsl++;
        const a = de(claveDe(f, grano));
        a.vsl_plays++;
        if (r.visitor_id) a.vsl_ids.add(r.visitor_id);
      }
    },
    {
      orden: 'id',
      // Solo el PLAY. La tabla guarda además pNN (cada 5% del video), sNN (cada
      // segundo), exit y click: sin este filtro un solo espectador que mira el VSL
      // entero cuenta como ~25 «plays» y el número no significa nada.
      // `event='vsl_play'` es la forma legacy y la escribe el mismo insert
      // (app/api/track/vsl/route.ts), así que cubre las filas viejas y las nuevas.
      eq: { event: 'vsl_play' },
      // ⚠️ FUERA EL AUTOPLAY. Panda arranca solo, y hasta la mig 0136 un play del
      // reproductor y un play de una persona se contaban igual. Se filtra con
      // `not is true` y NO con `eq false` a propósito: `auto` es NULL en todo lo
      // anterior a esa migración, y NULL es «no lo sé», no «fue automático».
      // Descartar los NULL borraría meses de datos buenos.
      filtros: (q) => q.gte('created_at', desdeUtc).lte('created_at', hastaUtc)
        .is('prueba', null).not('auto', 'is', true),
    },
  );

  // ── CRM ────────────────────────────────────────────────────────────────────
  // Un lead aporta a VARIOS períodos: se creó en enero, su J1 fue en febrero y
  // cerró en marzo. Por eso se lee la fila entera y cada fecha se imputa a SU
  // bucket — no se puede filtrar por una sola columna en la query.
  //
  // ⚠️ NO se usa `listLeads()`: ese getter lee con un `.select().order()` pelado y
  // PostgREST corta en 1000 filas sin avisar. Acá va paginado.
  await leerPorPaginas<{
    created_at: string; fecha_agenda: string | null;
    fecha_junta_1: string | null; asistio_j1: boolean | null;
    fecha_junta_2: string | null; asistio_j2: boolean | null;
    cerro: boolean | null; fecha_cierre: string | null; monto_cierre_usd: number | null;
  }>(
    db, 'leads',
    'id, created_at, fecha_agenda, fecha_junta_1, asistio_j1, fecha_junta_2, asistio_j2, cerro, fecha_cierre, monto_cierre_usd',
    (filas) => {
      for (const r of filas) {
        filasLeads++;
        // created_at es timestamptz; las fecha_* son DATE (se toman tal cual).
        const nac = dentro(r.created_at ? fechaLocalDe(r.created_at, zona) : null);
        if (nac) de(claveDe(nac, grano)).leads_nuevos++;

        const ag = dentro(r.fecha_agenda);
        if (ag) de(claveDe(ag, grano)).agendas_creadas++;

        const j1 = dentro(r.fecha_junta_1);
        if (j1) {
          const a = de(claveDe(j1, grano));
          a.j1_programadas++;
          if (r.asistio_j1 === true) a.j1_realizadas++;
          else if (r.asistio_j1 === false) a.j1_noshow++;
          else a.j1_sin_marcar++;
        }

        const j2 = dentro(r.fecha_junta_2);
        if (j2) {
          const a = de(claveDe(j2, grano));
          a.j2_programadas++;
          if (r.asistio_j2 === true) a.j2_realizadas++;
          else if (r.asistio_j2 === false) a.j2_noshow++;
          else a.j2_sin_marcar++;
        }

        // Misma definición que `v_cohortes_mensuales` (mig 0084): `cerro = true`.
        // Se usa esa y no `estado_lead='ganado'` para que el número reconcilie con
        // lo que muestra /comercial en vez de discutir con ello.
        const ci = dentro(r.fecha_cierre);
        if (ci && r.cerro === true) {
          const a = de(claveDe(ci, grano));
          a.ganados++;
          a.ingreso_usd += num(r.monto_cierre_usd);
        }
      }
    },
    { orden: 'id' },
  );

  // ── Cobertura: ¿un 0 es un 0, o es que no hay de dónde leer? ───────────────
  const metaConectado = await integracionConectada('meta').catch(() => false);
  const cobertura: Cobertura = {
    meta: filasMeta > 0
      ? { hay_datos: true, filas: filasMeta, nota: '' }
      : {
        hay_datos: false, filas: 0,
        nota: metaConectado
          ? 'Meta está conectado pero no hay ni una fila en este rango. O no hubo campañas corriendo, o el backfill nunca llegó hasta aquí (el cron diario solo trae el día de ayer).'
          : 'Este workspace no tiene Meta conectado, así que no hay inversión ni impresiones que leer. Se conecta en /integraciones.',
      },
    landing: filasLanding > 0
      ? { hay_datos: true, filas: filasLanding, nota: '' }
      : { hay_datos: false, filas: 0, nota: 'Sin pageviews en el rango. O el snippet de MaKo no está puesto en la landing, o no llegó nadie. El probador de /integraciones distingue las dos.' },
    vsl: filasVsl > 0
      ? { hay_datos: true, filas: filasVsl, nota: '' }
      : { hay_datos: false, filas: 0, nota: 'Sin plays del VSL en el rango. Si la landing sí tiene visitas, es que el snippet no está enganchado al reproductor.' },
    crm: { hay_datos: true, filas: filasLeads, nota: '' },
  };

  // ── Salida ─────────────────────────────────────────────────────────────────
  const nulo = (v: number, hay: boolean): number | null => (hay ? v : null);
  const redondo = (v: number, d = 2): number => Math.round(v * 10 ** d) / 10 ** d;

  const filas: FilaMetricas[] = clavesDelRango(desde, hasta, grano).map((periodo) => {
    const a = buckets.get(periodo) ?? accVacio();
    return {
      periodo,
      meta_inversion: nulo(redondo(a.meta_inversion), cobertura.meta.hay_datos),
      meta_inversion_usd: nulo(redondo(a.meta_inversion / TIPO_DE_CAMBIO_USD_MXN), cobertura.meta.hay_datos),
      meta_impresiones: nulo(a.meta_impresiones, cobertura.meta.hay_datos),
      meta_clics: nulo(a.meta_clics, cobertura.meta.hay_datos),
      meta_clics_link: nulo(a.meta_clics_link, cobertura.meta.hay_datos),
      meta_landing_views: nulo(a.meta_landing_views, cobertura.meta.hay_datos),
      meta_formularios: nulo(a.meta_formularios, cobertura.meta.hay_datos),
      landing_visitas: nulo(a.landing_visitas, cobertura.landing.hay_datos),
      landing_visitantes: nulo(a.landing_ids.size, cobertura.landing.hay_datos),
      vsl_plays: nulo(a.vsl_plays, cobertura.vsl.hay_datos),
      vsl_visitantes: nulo(a.vsl_ids.size, cobertura.vsl.hay_datos),
      leads_nuevos: a.leads_nuevos,
      agendas_creadas: a.agendas_creadas,
      j1_programadas: a.j1_programadas,
      j1_realizadas: a.j1_realizadas,
      j1_noshow: a.j1_noshow,
      j1_sin_marcar: a.j1_sin_marcar,
      j2_programadas: a.j2_programadas,
      j2_realizadas: a.j2_realizadas,
      j2_noshow: a.j2_noshow,
      j2_sin_marcar: a.j2_sin_marcar,
      ganados: a.ganados,
      ingreso_usd: redondo(a.ingreso_usd),
    };
  });

  // El total se suma de las filas EXCEPTO los únicos, que no son aditivos: la
  // misma persona que volvió en febrero y en marzo es UN visitante, no dos. Se
  // recalcula sobre la unión de los sets.
  const unionLanding = new Set<string>();
  const unionVsl = new Set<string>();
  for (const a of buckets.values()) {
    for (const v of a.landing_ids) unionLanding.add(v);
    for (const v of a.vsl_ids) unionVsl.add(v);
  }
  const sumar = (f: (x: FilaMetricas) => number | null): number =>
    filas.reduce((acc, x) => acc + (f(x) ?? 0), 0);

  const totales: Omit<FilaMetricas, 'periodo'> = {
    meta_inversion: nulo(redondo(sumar((x) => x.meta_inversion)), cobertura.meta.hay_datos),
    meta_inversion_usd: nulo(redondo(sumar((x) => x.meta_inversion) / TIPO_DE_CAMBIO_USD_MXN), cobertura.meta.hay_datos),
    meta_impresiones: nulo(sumar((x) => x.meta_impresiones), cobertura.meta.hay_datos),
    meta_clics: nulo(sumar((x) => x.meta_clics), cobertura.meta.hay_datos),
    meta_clics_link: nulo(sumar((x) => x.meta_clics_link), cobertura.meta.hay_datos),
    meta_landing_views: nulo(sumar((x) => x.meta_landing_views), cobertura.meta.hay_datos),
    meta_formularios: nulo(sumar((x) => x.meta_formularios), cobertura.meta.hay_datos),
    landing_visitas: nulo(sumar((x) => x.landing_visitas), cobertura.landing.hay_datos),
    landing_visitantes: nulo(unionLanding.size, cobertura.landing.hay_datos),
    vsl_plays: nulo(sumar((x) => x.vsl_plays), cobertura.vsl.hay_datos),
    vsl_visitantes: nulo(unionVsl.size, cobertura.vsl.hay_datos),
    leads_nuevos: sumar((x) => x.leads_nuevos),
    agendas_creadas: sumar((x) => x.agendas_creadas),
    j1_programadas: sumar((x) => x.j1_programadas),
    j1_realizadas: sumar((x) => x.j1_realizadas),
    j1_noshow: sumar((x) => x.j1_noshow),
    j1_sin_marcar: sumar((x) => x.j1_sin_marcar),
    j2_programadas: sumar((x) => x.j2_programadas),
    j2_realizadas: sumar((x) => x.j2_realizadas),
    j2_noshow: sumar((x) => x.j2_noshow),
    j2_sin_marcar: sumar((x) => x.j2_sin_marcar),
    ganados: sumar((x) => x.ganados),
    ingreso_usd: redondo(sumar((x) => x.ingreso_usd)),
  };

  const advertencias: string[] = [
    'Cada fecha se imputa a SU período: un lead creado en enero cuya reunión fue en febrero suma en los dos, en columnas distintas. No es un embudo de cohorte — para eso está /comercial, que agrupa por fecha de J1.',
    '«J1 realizada» es `asistio_j1 = true`. Un no-show queda en `j1_noshow` y una reunión que nadie marcó queda en `j1_sin_marcar`. Las tres son columnas distintas a propósito: `asistio_j1` tiene TRES estados y un NULL no es un «no vino», es «nadie lo marcó todavía». Restar programadas − realizadas para sacar el no-show —que es lo que hace el funnel del dashboard— mete a los sin marcar adentro del no-show e infla el número sin que se note.',
    'Las fechas de reunión se PISAN al reagendar: una R1 reservada en enero y movida a abril cuenta en abril y desaparece del primer trimestre. Y una reunión futura que se cancela deja la fecha en NULL, o sea que sale del reporte entera. El número es «reuniones que hoy tienen fecha en este período», no «reuniones que se pactaron en este período».',
    'Los visitantes únicos NO se suman entre períodos (la misma persona puede volver). El único del total se calcula aparte, sobre todo el rango.',
    'El alcance (reach) y la frecuencia de Meta no están: no son aditivos —sumar el alcance de 90 días no da el alcance del trimestre—, así que un total sumado sería un número inventado. Se piden en vivo a Meta, por anuncio (`/api/ad-insights`) o por campaña (`/api/entity-insights`).',
    'Las visitas propias se agrupan por el día del CALENDARIO DEL WORKSPACE, igual que la fecha con la que Meta escribe su gasto. Es a propósito: cortar el `created_at` en UTC —lo que hace el resto del dashboard— corre al día siguiente todo lo que pasó después de las 16-17 h, y las dos series quedan desalineadas justo cuando se las compara.',
    'Los cierres se cuentan por `cerro = true` con fecha en el período, que es la misma definición de `v_cohortes_mensuales` y de /comercial. Conviven otras dos en el código (`estado_lead = ganado` y `fecha_cierre` a secas) y no siempre coinciden: si este número discute con otra pantalla, es por eso.',
  ];
  if (previewsDescartados > 0) {
    advertencias.push(
      `Se descartaron ${previewsDescartados} visitas del PREVIEW DEL EDITOR de la landing (Lovable): es tráfico de quien construye la página, no de quien la visita.`,
    );
  }
  if (totales.j2_programadas > 0 || totales.j1_programadas > 0) {
    advertencias.push(
      'Las R2 que el sistema no logró cruzar con un lead NO están aquí: el webhook nunca crea un lead desde una segunda reunión (quedan en la cola de revisión). El total real de R2 puede ser mayor que el de esta tabla.',
    );
  }
  if (cobertura.meta.hay_datos) {
    advertencias.push(
      `La inversión sale en la moneda de la cuenta publicitaria. El USD es un derivado con un tipo de cambio FIJO (${TIPO_DE_CAMBIO_USD_MXN}) escrito a mano en lib/config.ts: para un trimestre pasado usa la tasa de hoy, no la de esos meses. Si el número importa en USD, verificalo contra el resumen de facturación de Meta.`,
    );
  }
  // ⚠️ EL CASO QUE HACE QUE ESTE REPORTE MIENTA FEO, y por eso se dice con nombre
  // propio. `asistio_j1` llega a `true` sola por UN camino: que el CRM automático
  // encuentre una grabación de Fathom. Sin Fathom conectado, `encuentroGrabable()`
  // deja el campo en NULL a propósito — o sea que un negocio que hizo las 40
  // reuniones sale con «0 realizadas, 40 sin marcar». Sin esta línea, el número se
  // lee como una catástrofe comercial en vez de como una integración que falta.
  const sinMarcar = totales.j1_sin_marcar + totales.j2_sin_marcar;
  const programadas = totales.j1_programadas + totales.j2_programadas;
  if (programadas > 0 && sinMarcar / programadas >= 0.5) {
    advertencias.push(
      `⚠️ ${sinMarcar} de ${programadas} reuniones del período NO tienen asistencia marcada, así que «realizadas» está subestimado y no dice cómo le fue al negocio. La asistencia se marca sola cuando hay una grabación de Fathom; sin esa integración conectada queda en manos de que alguien la cargue a mano en el CRM. Antes de sacar conclusiones de este número, decilo.`,
    );
  }
  if (cobertura.vsl.hay_datos) {
    advertencias.push(
      '`vsl_plays` cuenta solo el arranque del video y excluye los plays que disparó el autoplay del reproductor. No es «cuánta gente lo vio»: para eso está la retención, que vive en su propia pantalla. Y hay una tercera fuente de plays del VSL (Panda, vía el cron diario) que este reporte no mezcla aquí.',
    );
  }
  if (cobertura.landing.hay_datos && cobertura.meta.hay_datos) {
    advertencias.push(
      '`landing_visitas` (snippet propio) y `meta_landing_views` (píxel de Meta) miden cosas distintas: el primero cuenta a TODO el que llegó, el segundo solo lo que Meta se atribuye. Que no coincidan es lo esperable.',
    );
  }

  return {
    periodo: { desde, hasta, grano, zona },
    moneda: {
      meta: 'moneda de la cuenta publicitaria (MXN en las cuentas configuradas así)',
      tipo_cambio_usd_mxn: TIPO_DE_CAMBIO_USD_MXN,
      nota: '`meta_inversion` es el número real que cobró Meta. `meta_inversion_usd` es un derivado con tipo de cambio fijo.',
    },
    filas,
    totales,
    cobertura,
    advertencias,
  };
}
