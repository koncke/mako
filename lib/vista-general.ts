// =============================================================================
// vista-general — LEER «la vista general» una vez, para /general y para Today móvil
// =============================================================================
// Hasta el 11/10/2026 esto era el cuerpo de `app/general/page.tsx:110-373`: trece lecturas
// en paralelo, sus defaults, las seis reglas del semáforo, la guarda #165, el objetivo
// principal, la plata del hero y LA acción del día. El Today de MaKo Mobile necesita lo
// mismo, y una segunda copia de esa lista es la que se queda vieja (AGENTS.md, «Una cosa, un
// lugar»). Las DECISIONES puras viven en `lib/vista-general-modelo.ts` y `lib/focus.ts`;
// acá sólo se lee y se cablea.
//
// DEVUELVE DATOS, NO JSX: cada pantalla arma su vista. Los `href` del foco y de las alertas
// son rutas de ESCRITORIO; el móvil las traduce con `rutaMovil()` (lib/movil-rutas.ts).
//
// ⚠️ LEER ESTO ESCRIBE EN LA BASE. `migrarSettingsAObjectives` deja su marca en la primera
// visita, y `getPendientesDeMarcar` dispara `adjuntarFathomAutoThrottled` y
// `registrarEtapasDerivadas` (lib/queries.ts). Va cacheado y es idempotente, pero no se
// llama en un bucle, ni desde un sondeo, ni para pre-renderizar un push.
//
// ⚠️ NO TIENE GUARD DE ROL: es de la página que la llama (`/general` hace
// `requireRolWs([], { nav: 'general' })`; `/m/hoy`, su guard móvil). Lo único que exige es
// una SESIÓN: sin cookie, `getTenantDb()` cae a `OWNER_WS` — el ws1, un cliente — y una
// página que se olvidara de su guard le serviría los datos de Mauricio a cualquiera.
// =============================================================================

import 'server-only';
import { getUsuarioActual } from './auth';
import {
  getResumenComparativo, getPendientesDeMarcar, getResumenComercialMaduras, getFatigaAdsets,
  getTramoJ1J2Reciente, type ResumenComparativo, type Pendientes,
} from './queries';
import { getCuotasPendientes, getRevenueBreakdowns, type RevItem } from './pagos';
import { getMetaAccountHealth } from './meta-health';
import { getDataSources } from './sources';
import { listTareas } from './todo';
import { listPlanBoard } from './plan-board';
import { tableroActual, type QueTablero } from './tablero-actual';
import { getDiagnosticoFase } from './fase-store';
import { pendientesOnboarding } from './onboarding-pendientes';
import {
  quarterActual, listObjectives, avanceDeObjetivo, getTableroKpis, getCapacidad,
  proponerKpis, migrarSettingsAObjectives,
  type ObjectiveConAvance, type KpiEnTablero, type CapacidadLeida,
} from './objectives';
import { filtrarPorFunnels } from './funnels-elegidos-server';
import {
  elegirObjetivoPrincipal, ES_PLATA,
  type Quarter, type ProgresoQuarter, type Cadencia, type UnidadObjetivo,
} from './objectives-modelo';
import { elegirFoco, type Foco, type TareaParaFoco } from './focus';
import {
  armarAlertas, estadoFuentes, estadoLampara, contarSemaforo, objetivoAtrasado,
  plataDelObjetivo, fraccionDelObjetivo, ayerDe, tareasDelDuenoParaFoco, tareasDelClienteParaFoco,
  type AlertaGeneral, type EstadoFuentes, type EstadoLampara, type PlataDelObjetivo,
} from './vista-general-modelo';

/** Un KPI propuesto (cuando todavía no hay ninguno). La forma de `CandidatoVista` de KpisCard. */
export type CandidatoKpiVista = {
  nombre: string;
  porque: string;
  cadencia: Cadencia;
  compromiso: number;
  unidad: UnidadObjetivo;
  fuente: 'auto' | 'manual';
};

export type VistaGeneral = {
  qt: Quarter;
  /** Hoy en la zona del WORKSPACE (`hoyEnWorkspace`), nunca el día UTC. */
  hoy: string;
  /** El día anterior: el resumen del mes se lee hasta ayer. */
  ayer: string;
  progreso: ProgresoQuarter;
  /** Los objetivos del Q (y los anuales), con su avance LEÍDO de los datos. */
  objetivos: ObjectiveConAvance[];
  /** El que manda (`elegirObjetivoPrincipal`): nunca `objetivos[0]`. null = no hay ninguno. */
  objetivoPrincipal: ObjectiveConAvance | null;
  /** Dónde cae la marca del tiempo en la barra del objetivo principal, 0..1. */
  fraccionObjetivo: number;
  /** El principal va por debajo de lo esperado. Sólo con el avance LEÍDO. */
  objetivoAtrasado: boolean;
  /** Ordenados por gravedad (`PESO_ESTADO`): rojo, ámbar, sin-datos, verde. */
  kpis: KpiEnTablero[];
  /** Sólo si no hay KPIs: la propuesta. Vacío si hay KPIs o si la propuesta falló. */
  candidatos: CandidatoKpiVista[];
  capacidad: CapacidadLeida;
  /** Las reglas del semáforo, ordenadas rojo → ámbar → verde. */
  alertas: AlertaGeneral[];
  /** Qué se sabe de las fuentes de datos (#165). */
  fuentes: EstadoFuentes;
  /** `fuentes !== 'con-datos'`: no se puede opinar. Apaga las lámparas y el «vas al día». */
  sinFuentes: boolean;
  lampara: { estado: EstadoLampara; urgentes: number; vigilar: number };
  /** LA acción del día. `foco.alertaIdx` es el índice en `alertas` de la que ya es titular. */
  foco: Foco;
  /** Leads sin marcar. Si `aviso` trae texto, la lista puede estar incompleta: se dice. */
  pendientes: Pendientes;
  /** El mes contra el mismo período del anterior. null = no se pudo leer. */
  comparativo: ResumenComparativo | null;
  /** Sólo si el principal es de plata: lo cobrado y lo firmado del período. null = no es de plata o no se pudo leer. */
  plata: PlataDelObjetivo<RevItem> | null;
  /** De qué tablero salió el escalón «Plan» del foco. null = no se pudo saber. */
  tablero: QueTablero | null;
};

const PENDIENTES_SIN_LEER: Pendientes = {
  items: [], total: 0, porTipo: { A: 0, B: 0, C: 0, M: 0, R: 0 },
  // ⚠️ Una lectura caída NO es «datos al día»: es el falso all-clear que `aviso` existe para
  // evitar (lib/queries.ts, `Pendientes.aviso`).
  aviso: 'No pude leer los leads sin marcar: esta lista puede estar incompleta.',
};

export async function leerVistaGeneral(): Promise<VistaGeneral> {
  if (!(await getUsuarioActual())) throw new Error('leerVistaGeneral: sin sesión');

  // ⚠️ LA MIGRACIÓN VA PRIMERO Y NO ROMPE NADA SI FALLA. Convierte los tres settings viejos
  // en los primeros objetivos del Q; deja su propia marca y sale temprano, así que desde la
  // segunda visita es UNA lectura de setting.
  try { await migrarSettingsAObjectives(); } catch { /* se sigue sin el objetivo migrado */ }

  const { qt, hoy, progreso } = await quarterActual();
  const ayer = ayerDe(hoy);

  // ⚠️ EL TABLERO SE ELIGE CON `tableroActual()`, COMO `/plan` Y CUSTOMER SUCCESS. Antes se
  // leía `experimento_tareas` SIEMPRE: para el dueño (ws9, 0 filas ahí y ~400 en
  // `plan_tareas`) el escalón «Plan» del foco no disparaba nunca.
  const tablero = await tableroActual().catch(() => null);
  const leerTareas = async (): Promise<TareaParaFoco[]> => {
    if (tablero === 'dueno') return tareasDelDuenoParaFoco((await listPlanBoard()).tareas);
    if (tablero === 'cliente') return tareasDelClienteParaFoco(await listTareas());
    return []; // no se sabe cuál es el tablero: sin escalón «Plan» antes que el de otro
  };

  // ⚠️ TODAS CON EL `hoy` DEL WORKSPACE. Los defaults de estas funciones son el día UTC
  // (`new Date().toISOString()`): en Tijuana, de 17:00 a 24:00 «hoy» sería mañana.
  const [objR, kpisR, capR, compR, pendR, madR, fatR, tramoR, cuotasR, saludR, fuentesR, tareasR, faseR, arranqueR] =
    await Promise.allSettled([
      listObjectives(qt),
      getTableroKpis(hoy),
      getCapacidad(hoy),
      getResumenComparativo(ayer),
      getPendientesDeMarcar(hoy),
      getResumenComercialMaduras(),
      getFatigaAdsets(hoy),
      getTramoJ1J2Reciente(hoy, 60),
      getCuotasPendientes(hoy),
      getMetaAccountHealth(),
      getDataSources(),
      leerTareas(),
      getDiagnosticoFase(),
      pendientesOnboarding(),
    ]);

  const objetivosBase = objR.status === 'fulfilled' ? objR.value : [];
  const kpis: KpiEnTablero[] = kpisR.status === 'fulfilled' ? kpisR.value : [];
  const capacidad: CapacidadLeida = capR.status === 'fulfilled' ? capR.value
    : { cupo: null, activos: 0, libres: null, ocupacionPct: null, mesesEntrega: 4, error: 'no pude leer la capacidad' };
  const comparativo = compR.status === 'fulfilled' ? compR.value : null;
  const pendientes: Pendientes = pendR.status === 'fulfilled' ? pendR.value : PENDIENTES_SIN_LEER;
  const maduras = madR.status === 'fulfilled' ? madR.value : null;
  const fatiga = fatR.status === 'fulfilled' ? fatR.value : [];
  const tramo = tramoR.status === 'fulfilled' ? tramoR.value : { promedio: null, n: 0 };
  const cuotas = cuotasR.status === 'fulfilled' ? cuotasR.value : { vencidas: [], porVencer: [] };
  const saludMeta = saludR.status === 'fulfilled' ? saludR.value : null;
  // ⚠️ null, NUNCA []: una lectura caída es «no sé» (#165). Con [] la guarda se apagaba.
  const fuentesLeidas = fuentesR.status === 'fulfilled' ? fuentesR.value : null;
  const tareas = tareasR.status === 'fulfilled' ? tareasR.value : [];
  const fase = faseR.status === 'fulfilled' ? faseR.value : null;
  const pendientesArranque = arranqueR.status === 'fulfilled' ? arranqueR.value : null;

  // El avance de cada objetivo se lee de los datos, nunca de una columna guardada.
  const objetivos: ObjectiveConAvance[] = await Promise.all(
    objetivosBase.map((o) => avanceDeObjetivo(o, hoy)),
  ).catch(() => [] as ObjectiveConAvance[]);

  // La propuesta de KPIs sólo se calcula si hace falta: con KPIs cargados nadie la ve.
  let candidatos: CandidatoKpiVista[] = [];
  if (kpis.length === 0) {
    try {
      candidatos = (await proponerKpis()).map((c) => ({
        nombre: c.nombre, porque: c.porque, cadencia: c.cadencia,
        compromiso: c.compromiso, unidad: c.unidad, fuente: c.fuente,
      }));
    } catch { /* sin propuesta, el vacío ofrece crear el primero a mano */ }
  }

  const alertas = armarAlertas({ pendientesArranque, saludMeta, cuotas, tramo, fatiga, maduras });

  const fuentes = estadoFuentes(fuentesLeidas);
  const sinFuentes = fuentes !== 'con-datos';

  // ⚠️ NO es `objetivos[0]`: `listObjectives` mezcla a propósito los ANUALES con los del Q.
  const objetivoPrincipal = elegirObjetivoPrincipal(objetivos);
  const atrasado = objetivoAtrasado(objetivoPrincipal);
  const lampara = { estado: estadoLampara(alertas, sinFuentes, atrasado), ...contarSemaforo(alertas, atrasado) };

  // La plata del hero, sólo para objetivos de plata. En su propio try: si falla se pierde el
  // detalle, nunca el número grande.
  let plata: PlataDelObjetivo<RevItem> | null = null;
  if (objetivoPrincipal && ES_PLATA(objetivoPrincipal.metrica)) {
    try {
      const br = await getRevenueBreakdowns(objetivoPrincipal.desde, objetivoPrincipal.hasta);
      // El OKR que suma sólo algunos funnels (mig 0306): el desglose y el complemento, de esos mismos funnels.
      const fs = objetivoPrincipal.funnelIds;
      const [cash, sold] = await Promise.all([filtrarPorFunnels(br.cash, fs), filtrarPorFunnels(br.sold, fs)]);
      plata = plataDelObjetivo(objetivoPrincipal.metrica, { cash, sold });
    } catch { /* el número grande no depende de esto */ }
  }

  const tituloObjetivo = new Map(objetivos.map((o) => [o.id, o.titulo]));
  const foco = elegirFoco({
    kpis: kpis.map((k) => ({
      id: k.id, nombre: k.nombre, estado: k.estado, cadencia: k.cadencia,
      compromiso: k.compromiso, unidad: k.unidad, valor: k.valor,
      fuente: k.fuente, fuenteId: k.fuenteId,
      objetivoTitulo: k.objectiveId ? (tituloObjetivo.get(k.objectiveId) ?? null) : null,
      orden: k.orden,
    })),
    alertas,
    tareas,
    objetivos: objetivos.length,
    cuello: fase?.cuello ?? null,
    // #165, las dos mitades: el que elige la acción también sabe que no se puede opinar.
    sinFuentes,
    fuentesSinLeer: fuentes === 'sin-leer',
    hoy,
  });

  return {
    qt, hoy, ayer, progreso,
    objetivos, objetivoPrincipal,
    fraccionObjetivo: fraccionDelObjetivo(objetivoPrincipal, progreso, hoy),
    objetivoAtrasado: atrasado,
    kpis, candidatos, capacidad,
    alertas, fuentes, sinFuentes, lampara, foco,
    pendientes, comparativo, plata, tablero,
  };
}
