// =============================================================================
// sugerencias-crm-server — las sugerencias de MaKo de UN CRM: leer, calcular UNA vez, hacer, callar
// =============================================================================
// El motor es puro (lib/sugerencias-crm.ts); esto le junta los datos, guarda el resultado y aplica lo
// que la persona decide. Lo usan la ruta del chat del CRM (app/api/crm/mako/route.ts) y la lectura
// `sugerencias_crm` de la API de MaKo (lib/api-mako/areas/crm.run.ts): las dos ven lo MISMO.
//
// ⚠️ LO CARO VA ACÁ, UNA VEZ Y CACHEADO, NUNCA EN EL RENDER DE /crm. Calcular lee los leads del CRM,
// las automatizaciones, el funnel, las cuotas y dos conexiones: es la carga del tablero otra vez. La
// página no lo llama; lo pide el botón plegado UNA vez al montarse y el resultado queda `TTL_MS` en
// memoria, por workspace y por CRM (AGENTS.md, «Una caché en memoria del server es de TODOS los
// inquilinos del proceso»: el `ws` va en la clave).
//
// ⚠️ LO CALLADO NO SE CACHEA: se lee de `app_settings` en cada pedido (una fila) y se aplica sobre lo
// calculado. Con eso «Ahora no» y lo recién hecho se ven en TODAS las instancias del server, no sólo en
// la que atendió el clic (cada instancia tiene su propia caché). Y lo callado VUELVE: viaja aparte
// (`calladas`, lo que se vería si no estuviera callado) y «Volver a mostrar» (`volverAMostrar`) lo saca
// del mapa con el mismo compare-and-set con que «Ahora no» lo puso.
//
// ⚠️ «HACERLO» CALCULA DE NUEVO, SIN CACHÉ, y crea sólo lo que la cuenta fresca todavía sugiere: la
// pantalla manda el ID de la sugerencia, nunca la plantilla ni la etapa (un cliente no elige qué se
// crea). Con eso, dos pestañas o una caché vieja no duplican una automatización: la segunda vez la
// cuenta fresca ya la ve (`yaExiste`) y contesta que la sugerencia ya no aplica. La automatización
// entra por la puerta de la galería (`crearDesdePlantilla`, lib/plantilla-crear.ts) con las mismas
// piezas que POST /api/chat-agent/secuencias `crear_desde_plantilla`: NACE PAUSADA.
// =============================================================================

import 'server-only';
import { getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { leerFunnels, getFunnelDefault, getFunnelDe, umbralesDe, productoDeFunnel } from '@/lib/funnels';
import { listLeadsDeFunnel, type Lead } from '@/lib/leads';
import { etapaVigenteDe } from '@/lib/funnel-etapas';
import { sanearPlazosPorEtapa } from '@/lib/crm-auto-plan';
import { getDiagnosticoFase } from '@/lib/fase-store';
import { canalEfectivo } from '@/lib/fase-diagnostico';
import { nombreVisible } from '@/lib/lead-funnel-reglas';
import { entregasDeProductos } from '@/lib/entrega-servicio';
import type { EntregaConfig } from '@/lib/servicio-etapas';
import { leerTodo, type ConsultaPaginada } from '@/lib/supabase-paginado';
import { credWs } from '@/lib/credenciales';
import { estadoMedios } from '@/lib/disparadores-canales';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { hoyEnTz } from '@/lib/date-utils';
import { getSettingEstricto, cambiarSettingSi } from '@/lib/settings';
import { esColumnaInexistente } from '@/lib/nutricion-grafo-motor';
import { crearDesdePlantilla, PlantillaInvalidaError, type DbPlantilla } from '@/lib/plantilla-crear';
import { setSecuenciaPasos, PasosInvalidosError } from '@/lib/nutricion';
import { guardarDisparadores } from '@/lib/disparadores-guardar';
import { TriggerInvalidoError } from '@/lib/setting-secuencias';
import { plantillaPorId } from '@/lib/plantillas-automatizaciones';
import {
  sugerenciasDelCrm, sinCalladas, parsearCalladas, conCallada, sinCallada, estaCallada, claveCallada,
  CLAVE_CALLADAS, UMBRALES_SUGERENCIAS,
  type AutomatizacionSug, type EntradaSugerencias, type LeadSug, type Sugerencia,
} from '@/lib/sugerencias-crm';

/** Cuánto vive lo calculado. La clase 3 del mapa se mira «una vez por día»; la 1, «en el momento»: diez
 *  minutos es lo que tarda en aparecer la sugerencia de una etapa recién creada. */
const TTL_MS = 10 * 60_000;

// ── El CRM ───────────────────────────────────────────────────────────────────

export type CrmDeLaPantalla = { id: number; esDefault: boolean; nombre: string };

/**
 * El CRM que se pidió, validado contra los de ESTE workspace con la regla de /crm (app/crm/page.tsx):
 * un id que no es de acá (o el del negocio) es el del negocio. null = el workspace no tiene ninguno.
 * Si la lectura FALLA, tira: «no pude leer» no es «no hay».
 */
export async function crmDeLaPantalla(pedido: number | null): Promise<CrmDeLaPantalla | null> {
  const funnels = await leerFunnels();
  if (!funnels) throw new Error('no pude leer los CRM del negocio');
  const f = funnels.find((x) => x.id === pedido && !x.esDefault) ?? funnels.find((x) => x.esDefault) ?? funnels[0] ?? null;
  return f ? { id: f.id, esDefault: f.esDefault, nombre: nombreVisible(f) } : null;
}

// ── La foto del CRM (lo que también lee MaKo) ────────────────────────────────

export type FotoCrm = {
  crm: { id: number; nombre: string; principal: boolean; canal: string | null; entradas: string[] };
  /** las etapas del tablero en orden, con cuántos leads tiene cada una (null = no se pudieron contar) */
  etapas: Array<{ key: string; label: string; tipo: string | null; banda: string; leads: number | null }>;
  total_leads: number | null;
  /** cuántas automatizaciones vivas hay en el negocio (null = no se pudieron leer) */
  automatizaciones: number | null;
};

export type SugerenciasDeUnCrm = {
  crm: CrmDeLaPantalla;
  foto: FotoCrm;
  sugerencias: Sugerencia[];
  /**
   * Las calladas en ESTE CRM («Ahora no» o recién hechas) que hoy se verían, en el orden del motor y
   * con hasta cuándo. null = lo callado no se pudo leer (no es «no hay»): se muestra todo.
   */
  calladas: Array<{ sugerencia: Sugerencia; hasta: string }> | null;
  calculadoAt: string;
};

type Calculo = { at: number; crm: CrmDeLaPantalla; foto: FotoCrm; todas: Sugerencia[] };

/** La caché: de TODOS los inquilinos del proceso, por eso el `ws` va en la clave. */
const CACHE: Map<string, Calculo> = ((globalThis as { __sugerenciasCrm?: Map<string, Calculo> }).__sugerenciasCrm ??= new Map());
const claveCache = (ws: number, crmId: number) => `${ws}:${crmId}`;

/** Lo que se ve de una automatización para saber dónde arranca (sin `etapas`/`disparadores` si la base es vieja). */
const COLS_AUTOM = 'id, nombre, clave, trigger_tipo, etapa, funnel_id, producto_id, etiqueta_id, etapas, disparadores';
const COLS_AUTOM_VIEJAS = 'id, nombre, clave, trigger_tipo, etapa, funnel_id, producto_id, etiqueta_id';

/** Las automatizaciones VIVAS del negocio. Tira si no se pueden leer: sin ellas no se sabe qué existe. */
async function automatizacionesVivas(): Promise<AutomatizacionSug[]> {
  const db = await getTenantDb();
  const pedir = (cols: string) => db.from('nutricion_secuencias').select(cols).is('archivada_at', null).order('id');
  let r = await pedir(COLS_AUTOM);
  // La lista de CRON (0241) y las etapas (0230): sin ellas, el primer CRON de cada una (lo de siempre).
  if (r.error && esColumnaInexistente(r.error)) r = await pedir(COLS_AUTOM_VIEJAS);
  if (r.error) throw new Error(`automatizaciones: ${r.error.message}`);
  return (r.data ?? []) as unknown as AutomatizacionSug[];
}

/** Las cuotas sin pagar de estos leads: cuántas vencieron y cuántas hay. Tira si no se pueden leer. */
async function cuotasDe(leadIds: ReadonlySet<number>, hoy: string): Promise<{ vencidas: number; pendientes: number }> {
  if (!leadIds.size) return { vencidas: 0, pendientes: 0 };
  // Paginado: una cartera con planes de 6 cuotas pasa las 1.000 filas, y PostgREST corta en silencio.
  const filas = await leerTodo<{ lead_id: number; fecha_esperada: string | null }>(await getTenantDb(), 'pagos', 'id, lead_id, fecha_esperada', {
    orden: 'id', eq: { pagado: false }, filtros: (q) => q.not('fecha_esperada', 'is', null) as unknown as ConsultaPaginada,
  });
  let vencidas = 0; let pendientes = 0;
  for (const f of filas) {
    if (!leadIds.has(Number(f.lead_id))) continue;
    pendientes++;
    if (String(f.fecha_esperada ?? '').slice(0, 10) < hoy) vencidas++;
  }
  return { vencidas, pendientes };
}

const aLeadSug = (l: Lead, etapa: string): LeadSug => ({
  etapa, creado: l.created_at ?? null,
  r1: l.fecha_junta_1, asistioR1: l.asistio_j1, r2: l.fecha_junta_2, asistioR2: l.asistio_j2,
  cobrado: l.total_cobrado_usd, ventaTipo: l.venta_tipo ?? null, manualVence: l.nutricion_manual_deadline ?? null,
});

const avisar = (que: string) => (e: unknown) => {
  console.error(`[sugerencias-crm] ${que}:`, e instanceof Error ? e.message : String(e));
  return null;
};

/** Calcula, sin caché. Lo que falla se abstiene (null en la entrada del motor), salvo el funnel y las automatizaciones. */
async function calcular(ws: number, crm: CrmDeLaPantalla): Promise<Calculo> {
  const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
  const hoy = hoyEnTz(tz);
  const [cfg, umbrales, leadsCrudos, automs, diag, producto, fathom, medios] = await Promise.all([
    crm.esDefault ? getFunnelDefault() : getFunnelDe(crm.id),
    umbralesDe(crm.esDefault ? null : crm.id),
    listLeadsDeFunnel(crm.esDefault ? null : crm.id).catch(avisar('leads')),
    automatizacionesVivas(),
    getDiagnosticoFase().catch(() => null),
    productoDeFunnel([crm.id]).then((m) => m.get(crm.id) ?? null).catch(() => null),
    credWs('FATHOM_API_KEY', ws).then((v) => !!v?.trim()).catch(() => null),
    estadoMedios(['whatsapp']).then((m) => m.whatsapp?.porDefecto?.conectado ?? null).catch(() => null),
  ]);
  // Un funnel que no se pudo leer cae al pipeline de fábrica: sugerir sobre etapas que el CRM no tiene es inventar.
  if (cfg.origen === 'error') throw new Error('no pude leer el funnel del CRM');
  const entrega = producto ? (await entregasDeProductos([producto.id]).catch(() => new Map<number, EntregaConfig>())).get(producto.id) ?? null : null;

  const casa = (leadsCrudos ?? []).filter((l) => l.de_fila == null);
  const leads: LeadSug[] | null = leadsCrudos ? casa.map((l) => aLeadSug(l, etapaVigenteDe(l, cfg.stages))) : null;
  const cuotas = leadsCrudos ? await cuotasDe(new Set(casa.map((l) => l.id)), hoy).catch(avisar('cuotas')) : null;
  const { plazos } = sanearPlazosPorEtapa(umbrales?.porEtapa, new Set(cfg.stages.map((s) => s.key)));
  const canal = canalEfectivo(cfg.canal, diag?.canal);
  const entradas = [...cfg.entradas];

  const entrada: EntradaSugerencias = {
    funnel: {
      id: crm.id, canal, entradas,
      productoId: producto?.id ?? null,
      etapasEntrega: (entrega?.etapas ?? []).map((x) => x.key),
    },
    etapas: cfg.stages, transiciones: cfg.transitions, plazos,
    automatizaciones: automs, leads, cuotas,
    conectado: { whatsapp: medios, fathom }, hoy, ahora: Date.now(),
  };

  // El conteo por etapa es el del tablero: TODAS las tarjetas, también las agregadas.
  const porEtapa = new Map<string, number>();
  for (const l of leadsCrudos ?? []) { const k = etapaVigenteDe(l, cfg.stages); porEtapa.set(k, (porEtapa.get(k) ?? 0) + 1); }
  const foto: FotoCrm = {
    crm: { id: crm.id, nombre: crm.nombre, principal: crm.esDefault, canal, entradas },
    etapas: cfg.stages.map((s) => ({ key: s.key, label: s.label, tipo: s.kind ?? null, banda: s.band ?? 'pipeline', leads: leadsCrudos ? porEtapa.get(s.key) ?? 0 : null })),
    total_leads: leadsCrudos ? leadsCrudos.length : null,
    automatizaciones: automs.length,
  };
  // Sin tope acá: el tope va DESPUÉS de callar (una callada no puede dejar el lugar vacío).
  return { at: Date.now(), crm, foto, todas: sugerenciasDelCrm(entrada, Number.MAX_SAFE_INTEGER) };
}

/**
 * Las sugerencias de UN CRM para quien mira: lo calculado (de la caché si tiene menos de `TTL_MS`)
 * menos lo callado en ESE CRM. null = el workspace no tiene CRM. Tira si no se pudo calcular (el
 * funnel o las automatizaciones no se leyeron): una lista vacía diría «no hay nada que sugerir».
 */
export async function sugerenciasDeUnCrm(ws: number, crmPedido: number | null, o: { fresco?: boolean } = {}): Promise<SugerenciasDeUnCrm | null> {
  return runWithWorkspace(ws, async () => {
    const crm = await crmDeLaPantalla(crmPedido);
    if (!crm) return null;
    const k = claveCache(ws, crm.id);
    const previo = CACHE.get(k);
    const calc = !o.fresco && previo && Date.now() - previo.at < TTL_MS ? previo : await calcular(ws, crm);
    CACHE.set(k, calc);
    // Lo callado es para DIBUJAR: si no se puede leer, se muestra todo (crear igual pasa por la cuenta
    // fresca). Se lee ESTRICTO para no decir «no hay nada callado» cuando fue «no pude leer».
    const mapa = await getSettingEstricto(CLAVE_CALLADAS).then(parsearCalladas, avisar('leer lo callado'));
    const { visibles, lista } = sinCalladas(calc.todas, mapa ?? {}, crm.id, Date.now());
    return {
      crm: calc.crm, foto: calc.foto, sugerencias: visibles.slice(0, UMBRALES_SUGERENCIAS.tope),
      calladas: mapa ? lista.map(({ s, hasta }) => ({ sugerencia: s, hasta })) : null,
      calculadoAt: new Date(calc.at).toISOString(),
    };
  });
}

// ── Callar: «Ahora no» (30 días) y lo recién hecho (`hechaDias`) ────────────

/**
 * Suma una a lo callado del workspace, con compare-and-set: dos admins que callan a la vez no se pisan
 * (gana uno, el otro relee y vuelve a sumar). Lee ESTRICTO: con «no pude leer» como `{}` se borraría
 * todo lo callado de todos los CRM.
 */
async function callar(crmId: number, sugerenciaId: string, dias: number): Promise<void> {
  for (let intento = 0; intento < 4; intento++) {
    const crudo = await getSettingEstricto(CLAVE_CALLADAS);
    const nuevo = JSON.stringify(conCallada(parsearCalladas(crudo), claveCallada(crmId, sugerenciaId), dias, Date.now()));
    if (await cambiarSettingSi(CLAVE_CALLADAS, crudo, nuevo)) return;
  }
  throw new Error('otra persona estaba cambiando lo callado: intenta de nuevo');
}

export type FalloSugerencia = { ok: false; error: string; status: 400 | 404 | 409 | 500 };

/** «Ahora no»: la calla `callarDias` en ESTE CRM. Sólo una sugerencia que hoy se ve (o se vería). */
export async function ahoraNo(ws: number, crmPedido: number | null, sugerenciaId: string): Promise<{ ok: true } | FalloSugerencia> {
  return runWithWorkspace(ws, async () => {
    const r = await sugerenciasDeUnCrm(ws, crmPedido);
    if (!r) return { ok: false, error: 'No encuentro ese CRM.', status: 404 };
    const calc = CACHE.get(claveCache(ws, r.crm.id));
    if (!calc?.todas.some((s) => s.id === sugerenciaId)) return { ok: false, error: 'Esa sugerencia ya no está.', status: 409 };
    await callar(r.crm.id, sugerenciaId, UMBRALES_SUGERENCIAS.callarDias);
    return { ok: true };
  });
}

/**
 * «Volver a mostrar»: deshace el «Ahora no» de una sugerencia en ESTE CRM, con el mismo compare-and-set
 * y la misma lectura ESTRICTA que callar (con «no pude leer» como `{}` se borraría todo lo callado).
 * `cambio: false` = ya no estaba callada (otra persona la volvió a mostrar o venció): no se escribió nada.
 */
export async function volverAMostrar(ws: number, crmPedido: number | null, sugerenciaId: string): Promise<{ ok: true; cambio: boolean } | FalloSugerencia> {
  return runWithWorkspace(ws, async () => {
    const crm = await crmDeLaPantalla(crmPedido);
    if (!crm) return { ok: false, error: 'No encuentro ese CRM.', status: 404 };
    const clave = claveCallada(crm.id, sugerenciaId);
    for (let intento = 0; intento < 4; intento++) {
      const crudo = await getSettingEstricto(CLAVE_CALLADAS);
      const mapa = parsearCalladas(crudo);
      const ahora = Date.now();
      if (!estaCallada(mapa, clave, ahora)) return { ok: true, cambio: false };
      if (await cambiarSettingSi(CLAVE_CALLADAS, crudo, JSON.stringify(sinCallada(mapa, clave, ahora)))) return { ok: true, cambio: true };
    }
    return { ok: false, error: 'Otra persona estaba cambiando lo callado. Intenta de nuevo.', status: 409 };
  });
}

// ── Hacerlo ──────────────────────────────────────────────────────────────────

export type Hecha = { ok: true; secuenciaId: number; nombre: string; aviso: string | null; href: string };

/** Lo que está creándose ahora en ESTE proceso: un doble clic no crea dos. */
const EN_CURSO = new Set<string>();

/**
 * «Hacerlo» de una sugerencia de plantilla: la crea PAUSADA por la puerta de la galería, la calla
 * `hechaDias` (lo que tarda en vencer la caché de todas las instancias) y devuelve dónde abrirla. El rol
 * lo mira quien llama (crear automatizaciones es del admin).
 */
export async function hacerSugerencia(ws: number, crmPedido: number | null, sugerenciaId: string): Promise<Hecha | FalloSugerencia> {
  return runWithWorkspace(ws, async () => {
    const crm = await crmDeLaPantalla(crmPedido);
    if (!crm) return { ok: false, error: 'No encuentro ese CRM.', status: 404 };
    const llave = `${ws}:${crm.id}:${sugerenciaId}`;
    if (EN_CURSO.has(llave)) return { ok: false, error: 'Ya se está creando.', status: 409 };
    EN_CURSO.add(llave);
    try {
      // La cuenta FRESCA decide (ver la cabecera): lo que ya existe no se sugiere y no se crea.
      const calc = await calcular(ws, crm);
      CACHE.set(claveCache(ws, crm.id), calc);
      const s = calc.todas.find((x) => x.id === sugerenciaId);
      if (!s) return { ok: false, error: 'Ya no hace falta: alguien la armó.', status: 409 };
      if (s.accion.tipo !== 'plantilla') return { ok: false, error: 'Esta no crea una automatización.', status: 400 };
      if (!plantillaPorId(s.accion.plantilla)) return { ok: false, error: 'Esa plantilla ya no existe.', status: 409 };
      try {
        const r = await crearDesdePlantilla(s.accion.plantilla, {
          db: (await getTenantDb()) as unknown as DbPlantilla,
          setPasos: setSecuenciaPasos,
          setDisparadores: guardarDisparadores,
          motivoDeCron: (e) => (e instanceof TriggerInvalidoError ? e.message : null),
        }, { disparador: s.accion.disparador ?? undefined });
        // Se calla DESPUÉS de crear: si callar falla, la automatización igual quedó (y la cuenta fresca la ve).
        await callar(crm.id, s.id, UMBRALES_SUGERENCIAS.hechaDias).catch(avisar('callar la hecha'));
        CACHE.delete(claveCache(ws, crm.id));
        return { ok: true, secuenciaId: r.id, nombre: r.nombre, aviso: r.aviso ?? (r.pide ? 'Le falta elegir dónde arranca.' : null), href: `/automations?sec=${r.id}` };
      } catch (e) {
        if (e instanceof PlantillaInvalidaError || e instanceof PasosInvalidosError) return { ok: false, error: e.message, status: 400 };
        throw e;
      }
    } finally {
      EN_CURSO.delete(llave);
    }
  });
}

