// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// =============================================================================
// Admin › Customers — lo que la pantalla de Studio (dashboard/crm y dashboard/profile) dice de los clientes de MaKo (6/11/2026)
// =============================================================================
// Puro (sin React ni `server-only`): lo dibujan ./_components (la lista) y ./perfil (la ficha), y lo prueba
// tests/admin-customers.test.ts. Los datos son los de siempre (`vistaDeClientes`, lib/clientes-plataforma.ts); acá se decide
// qué número va en cada pieza de Studio:
//   · las cuatro tarjetas de «Pipeline Overview» → MRR, Clientes, Activos, En riesgo. Sin la insignia de tendencia (+12%) ni
//     el «last month»: MaKo no guarda cómo estaban estos números el mes pasado, y no se inventa;
//   · «Qualified Lead Flow» → lo que entró por mes (`cobrado`), y su recuadro → cuántos de los activos pagan;
//   · «Upcoming Meetings» → el cliente más nuevo de los últimos 30 días sobre su línea de tiempo;
//   · «Monthly Proposal Goal» → cuántos terminaron su configuración;
//   · «Recent Opportunities» → un negocio por fila, con su estado en una palabra (la tira de «Health»).
//
// ⚠️ SIN «US$ 0» (Martín, 26/10/2026, y la regla de la pantalla de antes): sin plata, la tarjeta dice que nadie paga y el
//    gráfico dice «Todavía no entró plata por MaKo» con el link a vender un plan. Un dato que no se pudo leer es «—», nunca 0.

import type { FilaCliente, VistaClientes } from '@/lib/clientes-plataforma';
import { estadoEnUnaPalabra, haceTxt, nombreDePlan, ultimaVezTxt, type Segmento } from '@/lib/clientes-plataforma-reglas';

export const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'] as const;

export const usdTxt = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;

export const fechaLarga = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getUTCDate()} ${MES_CORTO[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const fechaCorta = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MES_CORTO[d.getUTCMonth()]}`;
};

/** Los que son de MaKo: un cliente de agencia lo atiende su agencia, y no cuenta en «Clientes». */
export const esDeMaKo = (f: Pick<FilaCliente, 'segmentos'>) => !f.segmentos.includes('de-agencia');

/** El grupo de un cliente, dicho como en su fila: «Agency», «Partner», «Cliente», o «De <su agencia>». */
export const grupoTxt = (f: Pick<FilaCliente, 'segmentos' | 'agencia'>) =>
  f.segmentos.includes('de-agencia')
    ? `De ${f.agencia ?? 'una agencia'}`
    : f.segmentos.map((s) => ({ agency: 'Agency', partner: 'Partner', cliente: 'Cliente', 'de-agencia': '' })[s]).join(' · ');

/** Lo que paga: su mensualidad (con el primer mes al 50% si corre), o por qué no paga. */
export const plataTxt = (f: Pick<FilaCliente, 'mrrUsd' | 'primerMesUsd' | 'prueba' | 'planAManoTxt'>) =>
  f.mrrUsd > 0
    ? `${usdTxt(f.mrrUsd)} por mes${f.primerMesUsd != null ? ` · primer mes a ${usdTxt(f.primerMesUsd)}` : ''}`
    : f.prueba ? 'En prueba gratis' : f.planAManoTxt ?? 'Plan a mano';

/** Su configuración (el onboarding). `null` = no se pudo leer: «—», no «Sin terminar». */
export const configuracionTxt = (f: Pick<FilaCliente, 'onboardingHecho'>) =>
  f.onboardingHecho == null ? '—' : f.onboardingHecho ? 'Terminada' : 'Sin terminar';

/** A dónde llevan las acciones de un cliente: su cuenta, su administración (Accounts) o su ficha. */
export function destinoCliente(que: 'entrar' | 'administrar' | 'ficha', ws: number): string {
  if (que === 'entrar') return `/inicio?ws=${ws}`;
  if (que === 'administrar') return `/admin?tab=accounts&cuenta=${ws}`;
  return `/admin?tab=customers&cliente=${ws}`;
}

// ── Las cuatro tarjetas ─────────────────────────────────────────────────────────────────────────────────────────

export type TarjetaKpi = { titulo: string; valor: string; fuerte: string | null; texto: string };

export function tarjetasKpi(vista: Pick<VistaClientes, 'filas' | 'kpis' | 'paraMirar' | 'actividadLeida'>): TarjetaKpi[] {
  const { filas, kpis } = vista;
  const deMaKo = filas.filter(esDeMaKo);
  const semana = deMaKo.filter((f) => f.sinEntrar != null && f.sinEntrar <= 7).length;
  const sinDolares = kpis.sinDolares > 0 ? ` · ${kpis.sinDolares} sin su valor en dólares` : '';
  return [
    kpis.mrrUsd > 0
      ? { titulo: 'MRR', valor: usdTxt(kpis.mrrUsd), fuerte: String(kpis.pagan), texto: `${kpis.pagan === 1 ? 'negocio paga' : 'negocios pagan'} su mensualidad${sinDolares}` }
      : { titulo: 'MRR', valor: '—', fuerte: null, texto: `Nadie paga una mensualidad todavía${sinDolares}` },
    { titulo: 'Clientes', valor: deMaKo.length.toLocaleString('es-AR'), fuerte: String(kpis.nuevos30), texto: kpis.nuevos30 === 1 ? 'nuevo en 30 días' : 'nuevos en 30 días' },
    vista.actividadLeida
      ? { titulo: 'Activos', valor: kpis.activos.toLocaleString('es-AR'), fuerte: String(semana), texto: 'entraron esta semana' }
      : { titulo: 'Activos', valor: kpis.activos.toLocaleString('es-AR'), fuerte: null, texto: 'No pude leer quién entra' },
    { titulo: 'En riesgo', valor: kpis.enRiesgo.toLocaleString('es-AR'), fuerte: String(vista.paraMirar.length), texto: 'piden atención' },
  ];
}

// ── Lo que entró por mes (el gráfico) y cuántos activos pagan (su recuadro) ─────────────────────────────────────────

export const RANGOS = ['3m', '6m'] as const;
export type Rango = (typeof RANGOS)[number];
export const ROTULO_RANGO: Record<Rango, string> = { '3m': '3 meses', '6m': '6 meses' };

/** Los meses del rango (el más viejo primero) y su total. `null` si no entró nada en toda la ventana de la vista. */
export function entradoEn(cobrado: VistaClientes['cobrado'], rango: Rango): { meses: Array<{ mes: string; usd: number }>; total: number } | null {
  if (!cobrado) return null;
  const meses = cobrado.slice(-(rango === '3m' ? 3 : 6));
  return { meses, total: Math.round(meses.reduce((a, m) => a + m.usd, 0) * 100) / 100 };
}

/** «ene», «feb»… de una clave `AAAA-MM`. */
export const mesTxt = (mes: string) => MES_CORTO[Number(mes.slice(5, 7)) - 1] ?? mes;

/** De los clientes de MaKo activos, cuántos pagan su mensualidad. */
export function pagoDeActivos(filas: readonly FilaCliente[]): { pagan: number; activos: number; pct: number } {
  const activos = filas.filter((f) => esDeMaKo(f) && f.estado === 'activo');
  const pagan = activos.filter((f) => f.mrrUsd > 0).length;
  return { pagan, activos: activos.length, pct: activos.length ? Math.round((pagan / activos.length) * 100) : 0 };
}

// ── Los nuevos de los últimos 30 días (la línea de tiempo) ─────────────────────────────────────────────────────

const DIA = 86_400_000;

export type LineaNuevos = {
  /** Las cuatro marcas de la línea (hace 30, 20 y 10 días, y hoy). */
  marcas: string[];
  /** El más nuevo, con su lugar en la línea (0 a 100). `null` = nadie se sumó en 30 días. */
  ultimo: { ws: number; nombre: string; plan: string; dias: number; pos: number } | null;
  /** Cuántos se sumaron en los 30 días. */
  total: number;
};

export function lineaDeNuevos(filas: readonly FilaCliente[], ahoraMs: number): LineaNuevos {
  const inicio = ahoraMs - 30 * DIA;
  const nuevos = filas
    .filter((f) => esDeMaKo(f) && Date.parse(f.creado) >= inicio && Date.parse(f.creado) <= ahoraMs)
    .sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado));
  const u = nuevos[0];
  return {
    marcas: [fechaCorta(inicio), fechaCorta(ahoraMs - 20 * DIA), fechaCorta(ahoraMs - 10 * DIA), 'Hoy'],
    ultimo: u
      ? { ws: u.ws, nombre: u.nombre, plan: nombreDePlan(u.capa), dias: Math.floor((ahoraMs - Date.parse(u.creado)) / DIA), pos: Math.round(((Date.parse(u.creado) - inicio) / (30 * DIA)) * 100) }
      : null,
    total: nuevos.length,
  };
}

/** «Se sumó hoy», «Se sumó ayer», «Se sumó hace 5 días». */
export const seSumoTxt = (dias: number) => (dias <= 0 ? 'Se sumó hoy' : dias === 1 ? 'Se sumó ayer' : `Se sumó hace ${dias} días`);

/** Cuántos terminaron su configuración, de los que se pudo leer. `null` = no se pudo leer ninguno. */
export function configuracionTerminada(filas: readonly FilaCliente[]): { hechos: number; conocidos: number; pct: number } | null {
  const conocidos = filas.filter((f) => esDeMaKo(f) && f.onboardingHecho != null);
  if (!conocidos.length) return null;
  const hechos = conocidos.filter((f) => f.onboardingHecho === true).length;
  return { hechos, conocidos: conocidos.length, pct: Math.round((hechos / conocidos.length) * 100) };
}

// ── La tabla ───────────────────────────────────────────────────────────────────────────────────────────────

/** El filtro de grupo de la tabla. «todos» son los clientes de MaKo (sin los de agencias, como la pantalla de antes). */
export const GRUPOS = ['todos', 'cliente', 'partner', 'agency', 'de-agencia'] as const;
export type Grupo = (typeof GRUPOS)[number];
export const ROTULO_GRUPO: Record<Grupo, string> = { todos: 'Todos', cliente: 'Clientes', partner: 'Partners', agency: 'Agencies', 'de-agencia': 'Clientes de agencias' };

export const ESTADOS = ['todos', 'Activo', 'En prueba', 'Sin empezar', 'En riesgo', 'Pausado'] as const;
export type FiltroEstado = (typeof ESTADOS)[number];

/** Cuántas de las 18 barritas de «Health» se encienden, por estado (los cuatro escalones de Studio). */
export const PUNTAJE_ESTADO: Record<Exclude<FiltroEstado, 'todos'>, number> = { Activo: 18, 'En prueba': 11, 'Sin empezar': 11, 'En riesgo': 7, Pausado: 4 };

export type FilaTabla = {
  ws: number;
  nombre: string;
  grupo: string;
  segmentos: Segmento[];
  ultimaVez: string;
  estado: Exclude<FiltroEstado, 'todos'>;
  /** Lo que dice el tooltip de la tira: el estado y, si pide atención, por qué. */
  detalleEstado: string;
  mrr: number;
};

/** Una fila por negocio: los que piden atención primero; después, los que entraron más hace poco. */
export function filasDeTabla(vista: Pick<VistaClientes, 'filas' | 'paraMirar' | 'actividadLeida'>): FilaTabla[] {
  const motivo = new Map(vista.paraMirar.map((p) => [p.ws, p.texto]));
  const orden = (f: FilaCliente) => (f.riesgo ? 0 : f.onboardingHecho === false ? 1 : 2);
  return [...vista.filas]
    .sort((a, b) => orden(a) - orden(b) || (a.sinEntrar ?? 1e9) - (b.sinEntrar ?? 1e9) || a.nombre.localeCompare(b.nombre, 'es'))
    .map((f) => {
      const e = estadoEnUnaPalabra(f).rotulo as FilaTabla['estado'];
      const m = motivo.get(f.ws);
      return {
        ws: f.ws,
        nombre: f.nombre,
        grupo: grupoTxt(f),
        segmentos: f.segmentos,
        ultimaVez: vista.actividadLeida ? ultimaVezTxt(f) : '—',
        estado: e,
        detalleEstado: m ? `${e} · ${m}` : e,
        mrr: f.mrrUsd,
      };
    });
}

/** El filtro de grupo: «todos» deja afuera a los clientes de agencias. */
export const pasaGrupo = (segmentos: readonly Segmento[], g: Grupo) => (g === 'todos' ? !segmentos.includes('de-agencia') : segmentos.includes(g));

// ── La ficha ───────────────────────────────────────────────────────────────────────────────────────────────

export type DatoFicha = { rotulo: string; valor: string };

/** Lo que viene (el «Upcoming events» del perfil): un pago esperando, el fin de lo gratis. Vacío = nada pendiente. */
export function loQueViene(f: Pick<FilaCliente, 'pagoPendiente' | 'regaloPorTerminar' | 'primerMesUsd'>): DatoFicha[] {
  const out: DatoFicha[] = [];
  if (f.pagoPendiente) out.push({ rotulo: 'Pago', valor: 'Tiene un pago esperando' });
  if (f.regaloPorTerminar) out.push({ rotulo: 'Fin de lo gratis', valor: f.regaloPorTerminar });
  if (f.primerMesUsd != null) out.push({ rotulo: 'Primer mes', valor: `Pagó ${usdTxt(f.primerMesUsd)}: corre su primer mes al 50%` });
  return out;
}

/** Su actividad, dicha como en la pestaña «Actividad» de la ficha. */
export function actividadDe(f: FilaCliente, actividadLeida: boolean): DatoFicha[] {
  return [
    { rotulo: 'Última vez', valor: actividadLeida ? ultimaVezTxt(f) : '—' },
    { rotulo: 'Último lead', valor: f.leads == null ? '—' : f.sinLeads == null ? 'Todavía no tiene' : haceTxt(f.sinLeads) },
    { rotulo: 'Leads', valor: f.leads == null ? '—' : f.leads.toLocaleString('es-AR') },
    { rotulo: 'Agente', valor: f.sesionesAgente > 0 ? `${f.sesionesAgente} ${f.sesionesAgente === 1 ? 'sesión' : 'sesiones'} en 30 días` : 'Sin sesiones en 30 días' },
    { rotulo: 'Configuración', valor: configuracionTxt(f) },
  ];
}

/** «Cómo está» (el «About» del perfil): el porqué de «Para mirar» si pide atención; si no, qué significa su estado. */
export function comoEstaTxt(f: FilaCliente, motivo: string | null): string {
  if (motivo) return `${motivo}.`;
  const e = estadoEnUnaPalabra(f).rotulo;
  if (e === 'En prueba') return 'Está probando MaKo.';
  if (e === 'Pausado') return 'Su cuenta está pausada.';
  return 'Al día: no pide tu atención.';
}

/** Los datos del resumen («Work details» del perfil). */
export function datosDeResumen(f: FilaCliente, ahoraMs: number): DatoFicha[] {
  const dias = Math.floor((ahoraMs - Date.parse(f.creado)) / DIA);
  return [
    { rotulo: 'Negocio', valor: String(f.ws) },
    { rotulo: 'Estado', valor: estadoEnUnaPalabra(f).rotulo },
    { rotulo: 'Plan', valor: nombreDePlan(f.capa) },
    { rotulo: 'Grupo', valor: grupoTxt(f) },
    { rotulo: 'Configuración', valor: configuracionTxt(f) },
    { rotulo: 'Lo que paga', valor: plataTxt(f) },
    { rotulo: 'Cliente desde', valor: fechaLarga(f.creado) },
    { rotulo: 'Antigüedad', valor: Number.isFinite(dias) ? (dias < 30 ? `${Math.max(dias, 0)} días` : `${Math.floor(dias / 30)} ${Math.floor(dias / 30) === 1 ? 'mes' : 'meses'}`) : '—' },
  ];
}

/** Su plan y su cobro (la pestaña «Employment» del perfil, partida en sus dos secciones). */
export function datosDePlan(f: FilaCliente): DatoFicha[] {
  return [
    { rotulo: 'Plan', valor: nombreDePlan(f.capa) },
    { rotulo: 'Lo que paga', valor: plataTxt(f) },
    { rotulo: 'MRR', valor: f.mrrUsd > 0 ? usdTxt(f.mrrUsd) : '—' },
    ...(f.sinDolares > 0 ? [{ rotulo: 'Sin su valor en dólares', valor: `${f.sinDolares} ${f.sinDolares === 1 ? 'suscripción' : 'suscripciones'}` }] : []),
  ];
}

export function datosDeCobro(f: FilaCliente): DatoFicha[] {
  return [
    { rotulo: 'Pago esperando', valor: f.pagoPendiente ? 'Sí' : 'No' },
    { rotulo: 'En prueba', valor: f.prueba ? 'Sí' : 'No' },
    { rotulo: 'Fin de lo gratis', valor: f.regaloPorTerminar ?? '—' },
  ];
}
