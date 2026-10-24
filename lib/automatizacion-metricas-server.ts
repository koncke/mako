// =============================================================================
// automatizacion-metricas-server — leer las Métricas de una automatización y llevarlas al Dashboard
// =============================================================================
// Lo puro (el informe, la plantilla de MaKo, el filtro) vive en lib/automatizacion-metricas.ts. Acá lo que toca la base:
//   · `metricasParaMostrar(id)`: el informe de quien mira, o la plantilla de MaKo si nunca lo tocó, con cada hoja mirando
//     SÓLO esa automatización por su nombre de HOY. Mirar nunca guarda: la plantilla viaja como «inicial» y se escribe
//     recién cuando la persona cambia algo (el autoguardado del editor).
//   · `llevarAlDashboard(id, hojaId)`: la hoja que se está mirando, con ids nuevos, como hoja NUEVA del informe del
//     Dashboard de quien mira, con la MISMA receta que `pegar_dashboard` (lib/api-mako/areas/dashboard.run.ts):
//     `leerTableroVisible` + `crear_hoja` + compare-and-set. Así quien nunca guardó su Dashboard no se queda, además, con
//     las hojas iniciales escritas.
// =============================================================================
import 'server-only';
import { getUsuarioActual } from './auth';
import { getTenantDb } from './workspace';
import { getSettingEstricto } from './settings';
import { sanearTablero, type Hoja, type Tablero } from './graficos-catalogo';
import { claveInformeAutomatizacion } from './informe-automatizacion';
import { guardarTableroSi, leerInformeAutomatizacion, leerTableroVisible, type LecturaTablero } from './graficos-tablero';
import { aplicarCambio } from './api-mako/areas/dashboard.helpers';
import { hojaConIdsNuevos } from './graficos-copia';
import {
  conLaAutomatizacion, hojaConLaAutomatizacion, hojaDeMetricas, hojaInicialDeMetricas, HOJA_DE_METRICAS_VIEJA, idDeHojaDeMetricas,
  informeInicialDeMetricas, nombreDeHojaLlevada,
} from './automatizacion-metricas';
import { datosDeGraficos } from './graficos-datos';
import { fmtValor } from './graficos-agregar';
import { hoyEnTijuana } from './date-utils';
import { pedidosDeHoja } from '@/app/dashboard/exportar';
import type { PasoGrafo } from './flujo-grafo';

export type AutomatizacionDeMetricas = { id: number; nombre: string; pasos: PasoGrafo[] };

/** La automatización `id` si es de este negocio (la lectura va por el workspace en curso), o null. */
export async function automatizacionDelNegocio(id: number): Promise<AutomatizacionDeMetricas | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_secuencias').select('id, nombre, pasos').eq('id', id).maybeSingle();
  if (error) throw new Error(`No pude leer la automatización: ${error.message}`);
  if (!data) return null;
  const f = data as { id: number; nombre: string | null; pasos: unknown };
  return { id: Number(f.id), nombre: (f.nombre ?? '').trim() || `Automatización ${f.id}`, pasos: Array.isArray(f.pasos) ? (f.pasos as PasoGrafo[]) : [] };
}

export type MetricasParaMostrar = LecturaTablero & {
  automatizacion: { id: number; nombre: string };
  /** true = es la plantilla de MaKo (nunca la tocó): el editor la muestra, y la guarda recién con el primer cambio. */
  deMaKo: boolean;
};

/** Lo que abre el botón «Métricas». null = la automatización no es de este negocio. */
export async function metricasParaMostrar(id: number): Promise<MetricasParaMostrar | null> {
  const a = await automatizacionDelNegocio(id);
  if (!a) return null;
  const l = await leerInformeAutomatizacion(id);
  const deMaKo = l.estado !== 'propio' || !l.tablero.hojas.length;
  const tablero = deMaKo ? informeInicialDeMetricas(a.pasos, a.nombre, a.id) : conLaAutomatizacion(conHojaRenombrada(l.tablero, a.id), a.nombre);
  return { ...l, tablero, deMaKo, automatizacion: { id: a.id, nombre: a.nombre } };
}

/** Un informe guardado antes del 24/10/2026 tiene la hoja 'am-hoja' (la misma en todas): se lee con la de SU automatización. */
function conHojaRenombrada(t: Tablero, secuenciaId: number): Tablero {
  if (!t.hojas.some((h) => h.id === HOJA_DE_METRICAS_VIEJA)) return t;
  return { ...t, hojas: t.hojas.map((h) => (h.id === HOJA_DE_METRICAS_VIEJA ? { ...h, id: hojaDeMetricas(secuenciaId) } : h)) };
}

/**
 * LA HOJA DE MÉTRICAS QUE PROGRAMÓ UNA PERSONA, PARA EL CRON DEL AI ANALYST (24/10/2026). En el cron no hay sesión: se lee
 * el informe guardado de ESA persona para ESA automatización (`claveInformeAutomatizacion`), y si nunca lo tocó, la hoja
 * que arma MaKo (la misma que vio al programar). `undefined` = la hoja no es de Métricas (que la busque el Dashboard o
 * General); `null` = la automatización ya no está o la hoja se borró. «No pude leer» TIRA, como `leerInformeGuardado`.
 */
export async function hojaDeMetricasGuardada(usuario: string, hojaId: string): Promise<Hoja | null | undefined> {
  const id = idDeHojaDeMetricas(hojaId);
  if (id == null) return undefined;
  const a = await automatizacionDelNegocio(id);
  if (!a) return null;
  const raw = await getSettingEstricto(claveInformeAutomatizacion(id, usuario));
  const guardado = raw == null ? null : sanearTablero(JSON.parse(raw));
  const tablero = guardado?.hojas.length ? conLaAutomatizacion(conHojaRenombrada(guardado, id), a.nombre) : informeInicialDeMetricas(a.pasos, a.nombre, a.id);
  return tablero.hojas.find((h) => h.id === hojaId) ?? null;
}

export type MetricasEnNumeros = {
  automatizacion: { id: number; nombre: string };
  desde: string; hasta: string;
  /** Cada cuadro de resultados de la hoja de MaKo: su título y su número escrito. null = no se pudo leer. */
  numeros: Array<{ titulo: string; valor: string | null }>;
  /** Cuántas personas llegaron a cada tarjeta del flujo, en el orden del flujo. */
  porTarjeta: Array<{ tarjeta: string; personas: number }>;
  /** Enviados y fallados por día. */
  porDia: Array<{ dia: string; enviados: number; fallaron: number }>;
};

/**
 * Las Métricas de la automatización EN NÚMEROS (la API de MaKo, `metricas_automatizacion`): la hoja que arma MaKo (no la
 * que personalizó alguien: la API no tiene «quién mira»), leída con el MISMO armador de pedidos y el MISMO agregador que
 * la pantalla. Así lo que contesta MaKo y lo que se ve en «Métricas» salen de la misma cuenta.
 */
export async function metricasEnNumeros(id: number, periodo: 'ult7' | 'ult30' | 'ult90' = 'ult30'): Promise<MetricasEnNumeros | null> {
  const a = await automatizacionDelNegocio(id);
  if (!a) return null;
  const hoy = hoyEnTijuana();
  const base = hojaInicialDeMetricas(a.pasos, a.nombre, a.id);
  const ctrl = base.controles.find((c) => c.tipo === 'periodo');
  const { graficos } = pedidosDeHoja(base, ctrl ? { [ctrl.id]: { preset: periodo } } : {}, hoy, 0);
  const datos = await datosDeGraficos(graficos.map(({ pedido }) => pedido));
  const out: MetricasEnNumeros = { automatizacion: { id: a.id, nombre: a.nombre }, desde: '', hasta: hoy, numeros: [], porTarjeta: [], porDia: [] };
  for (const { g, pedido } of graficos) {
    out.desde ||= pedido.desde;
    const d = datos[g.id];
    const r = d?.ok ? d.resultado : null;
    if (g.tipo === 'numero') {
      const c = r?.columnas[0];
      out.numeros.push({ titulo: g.titulo, valor: r && c ? fmtValor(r.totales[0] ?? null, c.formato) : null });
    } else if (g.dimension === 'tarjeta' && r) {
      out.porTarjeta = r.filas.map((f) => ({ tarjeta: f.etiqueta, personas: Number(f.valores[0] ?? 0) }));
    } else if (g.dimension === 'dia' && r) {
      out.porDia = r.filas.map((f) => ({ dia: f.clave, enviados: Number(f.valores[0] ?? 0), fallaron: Number(f.valores[1] ?? 0) }));
    }
  }
  return out;
}

export type ResultadoLlevar ={ ok: true; hojaId: string; nombre: string } | { ok: false; error: string; conflicto?: boolean };

/**
 * «Llevar al Dashboard»: la hoja `hojaId` de las Métricas (la plantilla de MaKo si nunca las tocó) como hoja nueva del
 * Dashboard de quien mira, filtrada a la automatización por su nombre de hoy. Un reintento si el Dashboard cambió en
 * otra pestaña entre la lectura y la escritura.
 */
export async function llevarAlDashboard(id: number, hojaId: string | null): Promise<ResultadoLlevar> {
  const s = await getUsuarioActual();
  if (!s) return { ok: false, error: 'Sin sesión' };
  const m = await metricasParaMostrar(id);
  if (!m) return { ok: false, error: 'No existe esa automatización en este negocio.' };
  if (m.estado === 'error') return { ok: false, error: 'No pude leer las métricas: prueba de nuevo.' };
  const origen = m.tablero.hojas.find((h) => h.id === hojaId) ?? m.tablero.hojas[0];
  if (!origen) return { ok: false, error: 'Las métricas no tienen ninguna hoja.' };
  const nombre = nombreDeHojaLlevada(m.automatizacion.nombre);
  const hoja = hojaConLaAutomatizacion(hojaConIdsNuevos(origen, nombre), m.automatizacion.nombre);
  for (let intento = 0; intento < 2; intento++) {
    const actual = await leerTableroVisible(s.sub);
    const ap = aplicarCambio(actual.tablero, { op: 'crear_hoja', hoja });
    if (!ap.ok) return { ok: false, error: ap.error };
    const g = await guardarTableroSi(s.sub, ap.tablero, actual.version);
    if (g.ok) return { ok: true, hojaId: hoja.id, nombre: hoja.nombre };
  }
  return { ok: false, error: 'El Dashboard cambió en otra pestaña: prueba de nuevo.', conflicto: true };
}
