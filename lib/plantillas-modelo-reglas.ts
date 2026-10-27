// =============================================================================
// plantillas-modelo-reglas — la base de una cuenta según el MODELO de negocio del cliente (MAU-01, 27/10/2026)
// =============================================================================
// Mauricio (DM con Martín, 14/10/2026): «lo que ahora me genera valor es tener una base tipo copy paste que disminuya
// mi intervención de iniciar de cero». Sus clientes son de tres modelos: tienda que le vende a personas (Texx, Baja
// Teriyaki), B2B con CRM (HMO) y manufactura (Aspro, Sibelco). Martín: «Sin problemas los hago, lo incluimos», como
// plantillas DENTRO de MaKo y con una guía para cargar los datos (sus audios del 14/10).
//
// Una plantilla arma, en la cuenta del cliente:
//   · EL FUNNEL del CRM, con las etapas de cómo vende ese modelo;
//   · EL TABLERO: el objetivo del trimestre (la meta que importa, la MCI de su método) y los KPIs semanales que la
//     mueven (Objectives y KPIs de MaKo). Sin números: la meta y el compromiso los pone el cliente, nunca la plantilla;
//   · LA GUÍA para cargar sus datos, como tareas de un proyecto de su Plan: la ve su equipo y se tilda;
//   · y, la que la trae (Inmobiliaria, MK-15), UNA HOJA DEL DASHBOARD con sus números en el orden en que los mira.
//
// Lo que gobierna, y no se ve en los datos:
//   · ⚠️ LAS ETAPAS USAN LAS CLAVES CANÓNICAS (lead, conversando, agenda, agendaj2, facturando, ganado), con su rótulo.
//     Una clave inventada no la conoce `deriveStageKey` y el CRM dibuja al lead en la primera columna (lo mismo que
//     FUNNEL_TEMPLATES en lib/pipeline.ts, que es el molde). La única excepción es una etapa a la que se llega SÓLO
//     moviendo el lead a mano, como `conversando`: lleva la clave que acuña el editor del CRM (`st0`), `kind: 'paso'` y
//     la marca de que NO es una reunión (`marcadaComo: 'etapa'`). `pipeline_stage` manda sobre lo derivado cuando la
//     etapa está en el funnel (`etapaVigenteDe`, lib/funnel-etapas.ts), y `kind: 'paso'` no pide requisitos.
//   · APLICARLA DOS VECES NO DUPLICA NADA: lo que ya existe con el mismo nombre se deja como está (`queFalta`).
//
// Sin `server-only`: lo usan la pantalla, la API y los tests.
// =============================================================================

import { DEFAULT_STAGES, type Stage, type StageKind } from './pipeline';
import type { FuenteId, MetricaObjetivo, UnidadObjetivo } from './objectives-modelo';
import { ARMADO } from './graficos-plantillas-analysts';
import type { PlantillaHoja } from './graficos-plantillas';
import { MAX_HOJAS, type Hoja, type Tablero } from './graficos-catalogo';

export const MODELOS_CLIENTE = ['tienda-b2c', 'b2b-crm', 'manufactura', 'inmobiliaria'] as const;
export type ModeloCliente = (typeof MODELOS_CLIENTE)[number];

export const esModeloCliente = (v: unknown): v is ModeloCliente =>
  typeof v === 'string' && (MODELOS_CLIENTE as readonly string[]).includes(v);

export type KpiDePlantilla = { nombre: string; unidad: UnidadObjetivo } & ({ fuente: 'manual' } | { fuente: 'auto'; fuenteId: FuenteId });
export type PasoDeGuia = { titulo: string; detalle: string; recurrente?: true };

export type PlantillaModelo = {
  id: ModeloCliente;
  nombre: string;
  /** Una línea: a quién le sirve. */
  para: string;
  funnel: { nombre: string; pipeline: Stage[] };
  objetivo: { titulo: string; metrica: MetricaObjetivo; unidad: UnidadObjetivo };
  kpis: KpiDePlantilla[];
  /** El proyecto del Plan donde queda la guía. */
  proyecto: string;
  guia: PasoDeGuia[];
  /** La hoja del Dashboard que suma, si la trae. */
  hoja?: PlantillaHoja;
};

const CONVERSANDO: Stage = { key: 'conversando', label: 'Conversación abierta', dot: '#1FA855', tone: 'teal', kind: 'paso' };
const etapa = (key: string, kind: StageKind, label: string): Stage => {
  const base = key === 'conversando' ? CONVERSANDO : DEFAULT_STAGES.find((s) => s.key === key);
  if (!base) throw new Error(`La etapa ${key} no es canónica.`);
  return { ...base, kind, label };
};

/** Lo mismo para los tres: lo que hay que cargar para que el tablero mida algo. */
const GUIA_COMUN: PasoDeGuia[] = [
  { titulo: 'Poner la meta del trimestre', detalle: 'En Objectives, abre el objetivo que dejó la plantilla y escribe el número que quieres lograr este trimestre. Sin la meta, el tablero no sabe si vas bien.' },
  { titulo: 'Ponerle el compromiso semanal a cada KPI', detalle: 'En Objectives, cada KPI pide cuánto te comprometes a hacer por semana. Empieza con lo que hoy haces de verdad, y súbelo cuando lo cumplas dos semanas seguidas.' },
  { titulo: 'Cargar tus productos o servicios', detalle: 'En el CRM, en el desplegable de arriba → «Nuevo producto»: carga lo que vendes con su precio. Con eso el CRM sabe qué se vendió y cuánto.' },
  { titulo: 'Revisar el tablero una vez por semana', detalle: 'Una reunión corta, siempre el mismo día: cada uno dice qué se comprometió, qué hizo y qué va a hacer la semana que viene. Anota los números de los KPIs a mano en Objectives.', recurrente: true },
];

/**
 * La hoja de una inmobiliaria (MK-15, Joan: «DeadlinesMakoxJJ», 25/09 y 05/10). El Dashboard de sus clientes estaba
 * pensado para un VSL (Impresión → Click → Landing → VSL, la hoja Marketing) y no les sirve: venden con campañas a
 * FORMULARIO y cierran en persona. Pidió, en este orden:
 *   · marketing: Inversión → Alcance → Visualizaciones → Clics salientes → Formularios;
 *   · comercial: Leads → Calificados → Tasaciones/Pre listing → Captaciones.
 * ⚠️ SÓLO LO QUE MaKo GUARDA, con su nombre de verdad: el alcance existe sólo en vivo y sin total (la fuente `audiencia`),
 *    y las visualizaciones de video y los clics salientes no se sincronizan de Meta. Van Impresiones y Clics, que sí, y
 *    se llaman así: rotular «Alcance» a las impresiones sería un número falso con el nombre correcto. Las tasaciones
 *    son una etapa del funnel: las cuenta «Leads por etapa».
 */
const { kpi } = ARMADO;
export const HOJA_INMOBILIARIA: PlantillaHoja = {
  id: 'inmobiliaria', nombre: 'Inmobiliaria', emoji: '🏠',
  linea: 'De la pauta a la captación: lo invertido, los formularios, los calificados y las captaciones.',
  armar: (id) => ({
    id: id('inmobiliaria'), nombre: 'Inmobiliaria', emoji: '🏠', subtitulo: 'De la pauta a la captación.',
    controles: [{ id: id('in-periodo'), tipo: 'periodo', preset: 'ult30' }],
    componentes: [
      // 1 · Marketing, en el orden de Joan
      kpi(id('in-inversion'), 'negocio', 'gasto', 'Inversión', 'lo invertido en Meta', 0, 0, { comparar: true }),
      kpi(id('in-impresiones'), 'negocio', 'impresiones', 'Impresiones', 'veces que se vieron tus anuncios', 3, 0),
      kpi(id('in-clics'), 'negocio', 'clics', 'Clics', 'en tus anuncios', 6, 0),
      kpi(id('in-formularios'), 'meta', 'leads', 'Formularios', 'leads de tus anuncios', 9, 0, { comparar: true }),
      // 2 · Los dos embudos, uno al lado del otro
      { id: id('in-embudo-mk'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'negocio', metricas: ['impresiones', 'clics', 'leads'], titulo: 'Embudo de marketing', x: 0, y: 4, w: 6, h: 12 },
      { id: id('in-embudo-co'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'leads', metricas: ['leads', 'calificados', 'cierres'], titulo: 'Embudo comercial', x: 6, y: 4, w: 6, h: 12 },
      // 3 · Dónde está cada lead hoy: acá se ven las tasaciones y los pre listing
      { id: id('in-etapas'), clase: 'grafico', tipo: 'barras', fuente: 'leads', dimension: 'etapa', metricas: ['leads'], titulo: 'Leads por etapa', x: 0, y: 16, w: 12, h: 10 },
    ],
  }),
};

export const PLANTILLAS_MODELO: Readonly<Record<ModeloCliente, PlantillaModelo>> = {
  'tienda-b2c': {
    id: 'tienda-b2c',
    nombre: 'Tienda',
    para: 'Le vende a personas: un local, una tienda online o un restaurante.',
    funnel: {
      nombre: 'Ventas de la tienda',
      pipeline: [
        etapa('lead', 'entrada', 'Consulta'),
        etapa('conversando', 'paso', 'Conversación abierta'),
        etapa('facturando', 'pago', 'Pedido'),
        etapa('ganado', 'cierre', 'Compró'),
      ],
    },
    objetivo: { titulo: 'Vender más este trimestre', metrica: 'cash_usd', unidad: 'usd' },
    kpis: [
      { nombre: 'Consultas nuevas', unidad: 'cantidad', fuente: 'auto', fuenteId: 'leads_nuevos' },
      { nombre: 'Ventas', unidad: 'cantidad', fuente: 'auto', fuenteId: 'cierres' },
      { nombre: 'Clientes que volvieron a comprar', unidad: 'cantidad', fuente: 'manual' },
      { nombre: 'Reseñas pedidas', unidad: 'cantidad', fuente: 'manual' },
    ],
    proyecto: 'Arranque · Tienda',
    guia: [
      { titulo: 'Conectar el WhatsApp de la tienda', detalle: 'En Chats, «Conectar un canal» → WhatsApp: escanea el QR con el teléfono de la tienda. Las consultas que entren por ahí caen solas en el CRM.' },
      { titulo: 'Importar tus clientes', detalle: 'En el CRM, importa la lista de clientes que ya tienes (una planilla con nombre y teléfono alcanza). Los que ya compraron van a «Compró».' },
      ...GUIA_COMUN,
    ],
  },
  'b2b-crm': {
    id: 'b2b-crm',
    nombre: 'B2B con CRM',
    para: 'Le vende a empresas, con reuniones y propuestas.',
    funnel: {
      nombre: 'Ventas a empresas',
      pipeline: [
        etapa('lead', 'entrada', 'Prospecto'),
        etapa('agenda', 'reunion', 'Reunión de diagnóstico'),
        etapa('agendaj2', 'reunion', 'Propuesta presentada'),
        etapa('facturando', 'pago', 'Negociación'),
        etapa('ganado', 'cierre', 'Cliente'),
      ],
    },
    objetivo: { titulo: 'Cerrar más contratos este trimestre', metrica: 'cierres', unidad: 'cantidad' },
    kpis: [
      { nombre: 'Prospectos nuevos', unidad: 'cantidad', fuente: 'auto', fuenteId: 'leads_nuevos' },
      { nombre: 'Reuniones de diagnóstico', unidad: 'cantidad', fuente: 'auto', fuenteId: 'agendas' },
      { nombre: 'Propuestas enviadas', unidad: 'cantidad', fuente: 'manual' },
      { nombre: 'Seguimientos hechos', unidad: 'cantidad', fuente: 'manual' },
    ],
    proyecto: 'Arranque · B2B',
    guia: [
      { titulo: 'Importar tus prospectos y clientes al CRM', detalle: 'En el CRM, importa tu lista de empresas con el contacto de cada una. Pon cada una en su etapa: así el tablero arranca con lo que ya tienes en curso.' },
      { titulo: 'Conectar tu calendario', detalle: 'En Calendario, conecta tu Google Calendar: las reuniones de diagnóstico que agendes ahí cuentan solas en el KPI.' },
      ...GUIA_COMUN,
    ],
  },
  manufactura: {
    id: 'manufactura',
    nombre: 'Manufactura',
    para: 'Fabrica y le vende a empresas por cotización y orden de compra.',
    funnel: {
      nombre: 'Ventas industriales',
      pipeline: [
        etapa('lead', 'entrada', 'Solicitud de cotización'),
        etapa('agenda', 'reunion', 'Visita técnica'),
        etapa('agendaj2', 'reunion', 'Cotización enviada'),
        etapa('facturando', 'pago', 'Orden de compra'),
        etapa('ganado', 'cierre', 'Entregado'),
      ],
    },
    objetivo: { titulo: 'Entregar a tiempo y vender más este trimestre', metrica: 'sold_usd', unidad: 'usd' },
    kpis: [
      { nombre: 'Cotizaciones enviadas', unidad: 'cantidad', fuente: 'manual' },
      { nombre: 'Órdenes de compra', unidad: 'cantidad', fuente: 'auto', fuenteId: 'cierres' },
      { nombre: 'Pedidos entregados a tiempo', unidad: 'cantidad', fuente: 'manual' },
      { nombre: 'Reclamos de calidad', unidad: 'cantidad', fuente: 'manual' },
    ],
    proyecto: 'Arranque · Manufactura',
    guia: [
      { titulo: 'Importar tus clientes industriales al CRM', detalle: 'En el CRM, importa tus clientes y las cotizaciones abiertas. Pon cada una en su etapa: «Cotización enviada» u «Orden de compra».' },
      { titulo: 'Cargar tus líneas de producto', detalle: 'En el CRM, en el desplegable de arriba → «Nuevo producto»: carga cada línea de producto con su precio de lista. Con eso cada orden de compra suma al objetivo.' },
      ...GUIA_COMUN.filter((p) => p.titulo !== 'Cargar tus productos o servicios'),
    ],
  },
  inmobiliaria: {
    id: 'inmobiliaria',
    nombre: 'Inmobiliaria',
    para: 'Capta propiedades con campañas a formulario y cierra en persona.',
    // Sin R1 ni R2 ni Calendly (Joan: «en el caso de los inmobiliarios esa lógica no se utiliza»).
    funnel: {
      nombre: 'Captaciones',
      pipeline: [
        etapa('lead', 'entrada', 'Formulario'),
        etapa('conversando', 'paso', 'Calificado'),
        { key: 'st0', label: 'Tasación / pre listing', dot: '#C8870C', tone: 'orange', kind: 'paso', marcadaComo: 'etapa' },
        etapa('ganado', 'cierre', 'Captación'),
      ],
    },
    objetivo: { titulo: 'Captar más propiedades este trimestre', metrica: 'cierres', unidad: 'cantidad' },
    kpis: [
      { nombre: 'Leads', unidad: 'cantidad', fuente: 'auto', fuenteId: 'leads_nuevos' },
      { nombre: 'Leads calificados', unidad: 'cantidad', fuente: 'manual' },
      { nombre: 'Tasaciones o pre listing presentadas', unidad: 'cantidad', fuente: 'manual' },
      { nombre: 'Captaciones', unidad: 'cantidad', fuente: 'auto', fuenteId: 'cierres' },
    ],
    proyecto: 'Arranque · Inmobiliaria',
    guia: [
      { titulo: 'Conectar los formularios de Meta', detalle: 'En Integraciones, conecta Facebook: cada formulario de tus campañas entra solo al CRM, en «Formulario».' },
      { titulo: 'Conectar tu calendario', detalle: 'En Calendario, conecta tu Google Calendar para anotar las tasaciones y las visitas.' },
      ...GUIA_COMUN.filter((p) => p.titulo !== 'Cargar tus productos o servicios'),
    ],
    hoja: HOJA_INMOBILIARIA,
  },
};

/** Para comparar nombres: sin tildes, sin mayúsculas y sin espacios de más. */
export const nombreComparable = (s: string): string =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export type LoQueHay = { funnels: readonly string[]; objetivos: readonly string[]; kpis: readonly string[]; tareas: readonly string[] };
export type LoQueFalta = { funnel: boolean; objetivo: boolean; kpis: KpiDePlantilla[]; guia: PasoDeGuia[] };

/** Qué de la plantilla todavía no está en la cuenta (por nombre): aplicarla dos veces no duplica nada. */
export function queFalta(p: PlantillaModelo, hay: LoQueHay): LoQueFalta {
  const en = (lista: readonly string[]) => new Set(lista.map(nombreComparable));
  const funnels = en(hay.funnels);
  const objetivos = en(hay.objetivos);
  const kpis = en(hay.kpis);
  const tareas = en(hay.tareas);
  return {
    funnel: !funnels.has(nombreComparable(p.funnel.nombre)),
    objetivo: !objetivos.has(nombreComparable(p.objetivo.titulo)),
    kpis: p.kpis.filter((k) => !kpis.has(nombreComparable(k.nombre))),
    guia: p.guia.filter((g) => !tareas.has(nombreComparable(g.titulo))),
  };
}

/**
 * El informe de una persona con la hoja de la plantilla PRIMERA (es lo que vino a mirar), o por qué no se toca:
 * `ya-estaba` si la tiene o si la ARCHIVÓ (borrarla fue su decisión: aplicar la plantilla otra vez no se la revive),
 * `lleno` si ya tiene el máximo de hojas. Un informe sin hojas (`enBlanco`) queda con ésta sola.
 */
export function conHojaDeModelo(t: Tablero, h: Hoja): { tablero: Tablero } | { motivo: 'ya-estaba' | 'lleno' } {
  const es = (x: Hoja) => x.plantilla != null && x.plantilla === h.plantilla;
  if ((!t.enBlanco && t.hojas.some(es)) || (t.archivadas ?? []).some(es)) return { motivo: 'ya-estaba' };
  if (t.enBlanco) {
    const { enBlanco: _vacio, ...resto } = t;
    return { tablero: { ...resto, hojas: [h] } };
  }
  if (t.hojas.length >= MAX_HOJAS) return { motivo: 'lleno' };
  return { tablero: { ...t, hojas: [h, ...t.hojas] } };
}

export type ResumenPlantilla = { funnel: boolean; objetivo: boolean; kpis: number; pasos: number; hojas: number };

/** Lo que se le dice a la persona después de aplicarla: lo creado, y si no había nada que crear, eso. */
export function resumenDePlantilla(p: PlantillaModelo, hecho: ResumenPlantilla): string {
  const partes: string[] = [];
  if (hecho.funnel) partes.push(`el funnel «${p.funnel.nombre}» con ${p.funnel.pipeline.length} etapas`);
  if (hecho.objetivo || hecho.kpis) {
    const k = hecho.kpis ? ` y ${hecho.kpis} ${hecho.kpis === 1 ? 'KPI' : 'KPIs'}` : '';
    partes.push(hecho.objetivo ? `el objetivo del trimestre${k}` : `${hecho.kpis} ${hecho.kpis === 1 ? 'KPI' : 'KPIs'}`);
  }
  if (hecho.pasos) partes.push(`${hecho.pasos} ${hecho.pasos === 1 ? 'paso' : 'pasos'} de la guía en su Plan («${p.proyecto}»)`);
  if (hecho.hojas && p.hoja) partes.push(`la hoja «${p.hoja.nombre}» en el Dashboard de ${hecho.hojas === 1 ? 'una persona' : `${hecho.hojas} personas`}`);
  if (!partes.length) return `La plantilla ${p.nombre} ya estaba aplicada: no faltaba nada.`;
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
  return `Listo: ${lista}.`;
}
