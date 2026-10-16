// =============================================================================
// ficha/plantillas — con qué bloques arranca la ficha de cada tipo de funnel (diseño §4)
// =============================================================================
// «Cada funnel arranca con la plantilla de su tipo (dos reuniones, una llamada, evento, formulario de
// Meta, landing, te escriben, prospección o carrito). MaKo la elige sola con lo que el funnel ya tiene,
// sin preguntarte nada, y lo que el negocio ya eligió queda de respaldo» (docs/diseno-ficha-bloques.md §1).
//
// Una plantilla es, por tab, la LISTA de bloques en orden (los ids del catálogo, con su ancho y su
// diseño de entrada) y los avisos de «datos sin marcar» que nacen apagados. Lo que alguien cambió en un
// funnel se guarda aparte (lib/ficha/config.ts): la plantilla no se copia, así un bloque nuevo del
// catálogo o una plantilla corregida les llega a todos sin migrar nada.
//
// ⚠️ CÓMO SE ELIGE (§4), y nunca con `funnels.canal` pelado: estaba en NULL en los once funnels de
//    producción (docs/hallazgos-crm.md). El canal es `canalEfectivo(delFunnel, delNegocio)`.
//      1. dos etapas de reunión o más → Llamada con R1 y R2;
//      2. una, con un evento de fecha fija (webinar o presencial) → Evento; una sin evento → Una llamada;
//      3. ninguna: carrito → Carrito; te escriben → Te escriben; tú les escribes → Prospección;
//         formulario de Meta → Formulario de Meta; landing → Landing con opt-in;
//      4. si nada aplica → Respaldo (la ficha de hoy, en bloques).
//    Las etapas de reunión se cuentan con `tieneEtapaDeReunion` (lib/etapa-reunion.ts), la MISMA regla
//    que decide si sale la tab Reuniones: la tab y la plantilla nunca se contradicen.
//
// ⚠️ LOS AVISOS QUE NACEN APAGADOS (§4, «Reglas que valen para todas»): los que la plantilla dice, MÁS
//    los de todo dato cuyo bloque la plantilla no pone. Sacar un bloque a mano NO apaga su aviso (eso se
//    calcula sobre la PLANTILLA, no sobre la ficha que quedó). Las asistencias nunca se apagan.
//
// Puro, sin `server-only`: lo leen el motor, la API de MaKo, la pantalla y los tests.
// =============================================================================

import type { StepId } from '../stage-requirements';
import { DATOS_AVISABLES, sanearApagados } from '../datos-aviso';
import { tieneEtapaDeReunion } from '../etapa-reunion';
import { canalEfectivo, type CanalId } from '../fase-diagnostico';
import { fechaFijaDelEvento, tipoDeFunnel, type EntradaId } from '../pipeline';
import { bloqueDef, type BloqueId, type TabBloque, type TabCs, type TabFicha } from './catalogo';

export type PlantillaId =
  | 'respaldo' | 'dos-reuniones' | 'una-llamada' | 'evento' | 'formulario-meta'
  | 'landing' | 'te-escriben' | 'prospeccion' | 'carrito';

export type PlantillaFicha = {
  id: PlantillaId;
  /** Corto: es el nombre del menú «Plantilla». */
  nombre: string;
  /** Por tab, los bloques en orden. Una tab SIN lista usa la del respaldo (§4: Tracking con campaña de Meta). */
  tabs: Partial<Record<TabFicha, readonly BloqueId[]>>;
  /** Los avisos que el documento dice que nacen apagados. Se le suman los de bloques que la plantilla no pone. */
  apagados: readonly StepId[];
  /** Los que el documento deja avisando aunque su bloque no esté (Carrito: el comprobante de un pago a mano). */
  siguenAvisando?: readonly StepId[];
};

// La misma lista de Tracking para las dos de llamada («Tracking: la misma de Llamada con R1 y R2»).
const TRACKING_LLAMADA: readonly BloqueId[] = ['visitas', 'anuncio-de-origen', 'actividad-en-pagina', 'grabacion-de-visita'];

/** EL RESPALDO: la ficha de hoy pasada a bloques, sin perder nada. «Los avisos quedan como hoy». */
export const PLANTILLA_RESPALDO: PlantillaFicha = {
  id: 'respaldo', nombre: 'Respaldo',
  tabs: {
    resumen: ['proxima-reunion', 'contacto', 'redes-y-web', 'ingreso-estimado', 'calificacion', 'lo-que-contesto', 'origen', 'setter-y-closer', 'notas', 'motivo-de-salida', 'plazo-nutricion'],
    reuniones: ['reunion-1', 'reunion-2', 'agendar-reunion', 'lo-que-salio-de-la-llamada', 'cohorte'],
    pagos: ['cobrado', 'venta', 'cuotas', 'oferta', 'links-de-pago', 'movimientos', 'suscripcion', 'confirmacion-de-pago', 'contrato', 'datos-fiscales', 'servicio-vendido', 'promesa-y-garantia', 'obligaciones'],
    tracking: ['visitas', 'video-visto', 'actividad-en-pagina', 'grabacion-de-visita'],
  },
  apagados: [],
};

/** Las plantillas, en el orden del menú. El respaldo va al final: es lo que queda si nada aplica. */
export const PLANTILLAS_FICHA: readonly PlantillaFicha[] = [
  {
    // «Todos los avisos del deal quedan prendidos: es el funnel para el que se diseñó el modelo (ws1)».
    id: 'dos-reuniones', nombre: 'Llamada con R1 y R2',
    tabs: {
      resumen: ['siguiente-accion', 'posibles-duplicados', 'cambios-de-mako', 'proxima-reunion', 'contacto', 'lo-que-contesto', 'video-visto', 'calificacion', 'setter-y-closer', 'tiempo-en-etapa', 'ingreso-estimado', 'cobrado', 'charla-whatsapp', 'origen', 'redes-y-web', 'notas', 'motivo-de-salida', 'plazo-nutricion'],
      reuniones: ['reunion-1', 'reunion-2', 'lo-que-salio-de-la-llamada', 'agendar-reunion', 'mensaje-listo', 'diagnostico-mako', 'cohorte', 'ciclo-de-venta'],
      pagos: ['cobrado', 'venta', 'cuotas', 'oferta', 'links-de-pago', 'confirmacion-de-pago', 'movimientos', 'suscripcion', 'recordatorios-de-cobro', 'contrato', 'datos-fiscales', 'servicio-vendido', 'promesa-y-garantia', 'obligaciones', 'excepciones', 'cliente-en-cs'],
      tracking: TRACKING_LLAMADA,
    },
    apagados: [],
  },
  {
    id: 'una-llamada', nombre: 'Una llamada',
    tabs: {
      resumen: ['siguiente-accion', 'posibles-duplicados', 'proxima-reunion', 'contacto', 'lo-que-contesto', 'video-visto', 'calificacion', 'setter-y-closer', 'ingreso-estimado', 'cobrado', 'charla-whatsapp', 'origen', 'notas', 'motivo-de-salida', 'plazo-nutricion'],
      reuniones: ['reunion-1', 'lo-que-salio-de-la-llamada', 'agendar-reunion', 'mensaje-listo', 'diagnostico-mako', 'ciclo-de-venta'],
      pagos: ['cobrado', 'venta', 'cuotas', 'oferta', 'links-de-pago', 'confirmacion-de-pago', 'movimientos', 'suscripcion', 'contrato', 'datos-fiscales', 'servicio-vendido', 'promesa-y-garantia', 'obligaciones', 'cliente-en-cs'],
      tracking: TRACKING_LLAMADA,
    },
    apagados: [],
  },
  {
    // ws11: lista en frío por WhatsApp → 1ª sesión sin costo → mensualidad. «Tracking: sin lista propia».
    id: 'evento', nombre: 'Evento',
    tabs: {
      resumen: ['siguiente-accion', 'posibles-duplicados', 'proxima-reunion', 'contacto', 'charla-whatsapp', 'lo-que-contesto', 'lo-que-le-mandamos', 'automatizaciones-en-curso', 'setter-y-closer', 'tiempo-en-etapa', 'cobrado', 'origen', 'notas', 'motivo-de-salida', 'plazo-nutricion'],
      reuniones: ['reunion-1', 'ciclo-de-venta'],
      pagos: ['cobrado', 'suscripcion', 'links-de-pago', 'cuotas', 'movimientos', 'venta', 'oferta', 'recordatorios-de-cobro', 'cliente-en-cs'],
    },
    apagados: ['dealFiscal', 'dealFiscalDoc', 'dealServicio', 'dealPromesa', 'dealObligaciones'],
  },
  {
    // ws15 y ws17 (inmobiliaria). «Reuniones: no sale (no hay etapa de reunión)».
    id: 'formulario-meta', nombre: 'Formulario de Meta',
    tabs: {
      resumen: ['siguiente-accion', 'posibles-duplicados', 'contacto', 'lo-que-contesto', 'calificacion', 'origen', 'charla-whatsapp', 'automatizaciones-en-curso', 'tiempo-en-etapa', 'setter-y-closer', 'ingreso-estimado', 'proxima-reunion', 'notas', 'motivo-de-salida', 'plazo-nutricion'],
      pagos: ['cobrado', 'oferta', 'links-de-pago', 'venta', 'movimientos'],
      tracking: ['anuncio-de-origen', 'visitas', 'actividad-en-pagina'],
    },
    apagados: ['empresa', 'plan', 'dealServicio', 'dealPromesa', 'dealObligaciones', 'dealFiscal'],
  },
  {
    // Incluye el recurso gratis y el link de la bio o de YouTube; ws13 (landing con Cal.com sin etapa de reunión).
    id: 'landing', nombre: 'Landing con opt-in',
    tabs: {
      resumen: ['siguiente-accion', 'posibles-duplicados', 'contacto', 'lo-que-contesto', 'pagina-de-registro', 'origen', 'proxima-reunion', 'charla-whatsapp', 'automatizaciones-en-curso', 'lo-que-le-mandamos', 'tiempo-en-etapa', 'calificacion', 'notas', 'motivo-de-salida', 'plazo-nutricion'],
      pagos: ['cobrado', 'oferta', 'links-de-pago', 'venta', 'cuotas', 'movimientos', 'suscripcion'],
      tracking: ['visitas', 'video-visto', 'actividad-en-pagina', 'grabacion-de-visita', 'anuncio-de-origen'],
    },
    apagados: ['dealServicio', 'dealPromesa', 'dealObligaciones', 'dealFiscal'],
  },
  {
    // WhatsApp, Instagram o Messenger, incluido el DM funnel. «El teléfono sigue avisando, porque pedirlo
    // es parte de la charla». El «contrato» del documento no es un dato sin marcar: no tiene StepId.
    id: 'te-escriben', nombre: 'Te escriben',
    tabs: {
      resumen: ['siguiente-accion', 'posibles-duplicados', 'charla-dm', 'charla-whatsapp', 'pase-a-humano', 'mensaje-listo', 'contacto', 'publicacion-de-entrada', 'origen', 'setter-y-closer', 'tiempo-en-etapa', 'automatizaciones-en-curso', 'notas', 'motivo-de-salida', 'plazo-nutricion'],
      pagos: ['cobrado', 'oferta', 'links-de-pago', 'confirmacion-de-pago', 'venta', 'suscripcion', 'movimientos'],
    },
    apagados: ['calificado', 'empresa', 'plan', 'dealFiscal'],
  },
  {
    // Tú les escribes (WhatsApp, Instagram o LinkedIn) y cierras por chat. «El B2B de LinkedIn los suma con un toque».
    id: 'prospeccion', nombre: 'Prospección',
    tabs: {
      resumen: ['siguiente-accion', 'posibles-duplicados', 'contacto', 'redes-y-web', 'lo-que-le-mandamos', 'charla-whatsapp', 'charla-dm', 'tiempo-en-etapa', 'setter-y-closer', 'ingreso-estimado', 'notas', 'motivo-de-salida', 'plazo-nutricion'],
      pagos: ['cobrado', 'oferta', 'links-de-pago', 'confirmacion-de-pago', 'venta', 'suscripcion', 'cuotas', 'movimientos'],
    },
    apagados: ['dealFiscal'],
  },
  {
    // «El comprobante sólo se pide en un pago a mano»: no está entre los apagados del documento, aunque
    // `cuotas` (su bloque) no viene. Ver `siguenAvisando`.
    id: 'carrito', nombre: 'Carrito',
    tabs: {
      resumen: ['siguiente-accion', 'posibles-duplicados', 'contacto', 'cobrado', 'origen', 'lo-que-contesto', 'charla-whatsapp', 'notas', 'motivo-de-salida', 'plazo-nutricion'],
      pagos: ['cobrado', 'links-de-pago', 'movimientos', 'venta', 'suscripcion', 'oferta', 'cliente-en-cs'],
      tracking: ['video-visto', 'actividad-en-pagina', 'grabacion-de-visita', 'visitas', 'anuncio-de-origen'],
    },
    apagados: ['setter', 'calificado', 'empresa', 'plan', 'dealServicio', 'dealPromesa', 'dealObligaciones', 'dealFiscal', 'dealFiscalDoc'],
    siguenAvisando: ['comprobante'],
  },
  PLANTILLA_RESPALDO,
];

/**
 * La plantilla FIJA de Customer Success (§4, «Cliente en Customer Success»): no se personaliza en la v1
 * y no hereda la del CRM (le mostraría bloques de captación a alguien que ya compró).
 */
export const PLANTILLA_CS: Readonly<Record<TabCs, readonly BloqueId[]>> = {
  'cs-resumen': ['senal-de-atencion', 'reloj-del-programa', 'contacto', 'cobrado', 'servicio-vendido', 'promesa-y-garantia', 'obligaciones', 'notas'],
  'cs-pagos': ['cobrado', 'cuotas', 'suscripcion', 'links-de-pago', 'movimientos', 'recordatorios-de-cobro', 'contrato', 'datos-fiscales'],
};

export const IDS_PLANTILLA: readonly PlantillaId[] = PLANTILLAS_FICHA.map((p) => p.id);
export const esPlantillaId = (x: unknown): x is PlantillaId => typeof x === 'string' && (IDS_PLANTILLA as readonly string[]).includes(x);
/** La plantilla por id; un id que no existe es el respaldo. */
export const plantillaFicha = (id: string | null | undefined): PlantillaFicha => PLANTILLAS_FICHA.find((p) => p.id === id) ?? PLANTILLA_RESPALDO;

/** La lista de una tab: la de la plantilla, o la del respaldo si la plantilla no trae una. */
export function listaDePlantilla(p: PlantillaFicha, tab: TabFicha): readonly BloqueId[] {
  return p.tabs[tab] ?? PLANTILLA_RESPALDO.tabs[tab] ?? [];
}

/** Las listas de una tab cualquiera, incluidas las de CS (que son fijas). */
export function listaDeTab(p: PlantillaFicha, tab: TabBloque): readonly BloqueId[] {
  return tab === 'cs-resumen' || tab === 'cs-pagos' ? PLANTILLA_CS[tab] : listaDePlantilla(p, tab);
}

/**
 * Los avisos que NACEN apagados con esta plantilla: los del documento más los de todo dato que ningún
 * bloque de la plantilla completa (en ninguna de sus cuatro listas, con el respaldo donde no trae una),
 * menos los que el documento deja avisando. Nunca las asistencias (`sanearApagados`).
 */
export function apagadosDePlantilla(p: PlantillaFicha): StepId[] {
  const cubiertos = new Set<StepId>();
  for (const tab of ['resumen', 'reuniones', 'pagos', 'tracking'] as const) {
    for (const id of listaDePlantilla(p, tab)) for (const paso of bloqueDef(id)?.avisa ?? []) cubiertos.add(paso);
  }
  const sinBloque = DATOS_AVISABLES.map((x) => x.id).filter((id) => !cubiertos.has(id));
  const siguen = new Set(p.siguenAvisando ?? []);
  return sanearApagados([...p.apagados, ...sinBloque]).filter((id) => !siguen.has(id));
}

// ── Elegir la plantilla de un funnel ──────────────────────────────────────────

/** Lo que hace falta de un funnel para elegir su plantilla. */
export type FunnelParaPlantilla = {
  /** Las etapas GENERADAS del funnel (`FunnelConfig.stages`, con su banda): la misma lista que decide la tab Reuniones. */
  etapas: ReadonlyArray<{ key: string; label?: string; kind?: string; marcadaComo?: string; band?: string }>;
  /** `funnels.canal`: casi siempre null (hereda el del negocio). NUNCA se usa pelado. */
  canalDelFunnel: unknown;
  /** El canal del negocio (el del diagnóstico de fase). */
  canalDelNegocio: CanalId | null | undefined;
  /** `funnels.data.entradas` ya parseadas (`FunnelConfig.entradas`; `[]` = no declaró). */
  entradas: readonly EntradaId[];
};

/** La plantilla elegida y por qué, en una frase corta que puede leer la persona (y MaKo). */
export type EleccionPlantilla = { id: PlantillaId; porque: string };

/** Cuántas etapas de reunión tiene el funnel, con la regla de la tab Reuniones aplicada etapa por etapa. */
export function cuantasReuniones(etapas: FunnelParaPlantilla['etapas']): number {
  return etapas.filter((e) => tieneEtapaDeReunion([e])).length;
}

/** La regla de la §4, sin preguntarle nada a nadie. */
export function elegirPlantilla(f: FunnelParaPlantilla): EleccionPlantilla {
  const reuniones = cuantasReuniones(f.etapas);
  const canal = canalEfectivo(f.canalDelFunnel, f.canalDelNegocio);
  if (reuniones >= 2) return { id: 'dos-reuniones', porque: `Tiene ${reuniones} etapas de reunión.` };
  if (reuniones === 1) {
    return fechaFijaDelEvento(canal)
      ? { id: 'evento', porque: `Tiene una reunión con fecha fija (${canal === 'webinar' ? 'webinar' : 'sesión presencial'}).` }
      : { id: 'una-llamada', porque: 'Tiene una etapa de reunión.' };
  }
  // Sin reunión: decide cómo entra la gente. El carrito también por el canal (vende sin hablar con nadie).
  const tipo = tipoDeFunnel(f.entradas);
  if (canal === 'carrito' || tipo?.entrada === 'carrito') return { id: 'carrito', porque: 'Sin reunión y compran en el carrito.' };
  switch (tipo?.entrada) {
    case 'chat_entrante': return { id: 'te-escriben', porque: 'Sin reunión y te escriben.' };
    case 'chat_saliente': return { id: 'prospeccion', porque: 'Sin reunión y tú les escribes.' };
    case 'formulario_anuncio': return { id: 'formulario-meta', porque: 'Sin reunión y dejan sus datos en el anuncio.' };
    case 'landing': return { id: 'landing', porque: 'Sin reunión y llenan un formulario.' };
    default: return { id: 'respaldo', porque: 'Sin reunión ni una entrada declarada.' };
  }
}
