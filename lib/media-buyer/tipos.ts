// =============================================================================
// Media Buyer — los tipos (sin `server-only`: los usan el motor puro, los tests y la pantalla)
// =============================================================================
// Martín, 25/10/2026: reemplazar el Ads Manager por «una app de IA, como un media buyer de MaKo», que
// suba y baje presupuesto, prenda y apague campañas, conjuntos y anuncios, y cree variaciones. La pantalla
// y las tácticas se copian de Madgicx (AI Marketer y sus «automation tactics»): docs/media-buyer/referencia.md.
//
// Una DECISIÓN es la unidad de todo: el agente la propone con su porqué y los números que la dispararon,
// una persona (o el piloto automático) la lanza, y se puede deshacer. Es la «recommendation» de Madgicx.
// =============================================================================

import type { ConfigTacticas } from './tacticas';
import type { LugarZona } from './zona';

/** Cómo trabaja el agente en un negocio. Martín: «piloto automático» y «propone y yo apruebo». */
export type ModoMediaBuyer = 'propone' | 'piloto';

/**
 * Qué cuenta como RESULTADO al decidir. Es el «Primary KPI» de Madgicx, pero medido con lo que MaKo sabe y
 * Meta no: el lead que entró al CRM, la agenda y la venta (con su caja) atribuidas al anuncio.
 */
export type KpiMediaBuyer = 'lead' | 'agenda' | 'venta';

export type ConfigMediaBuyer = {
  /** El interruptor que lo apaga todo: sin él no se analiza, no se lanza y el piloto no toca nada. */
  encendido: boolean;
  /** Por defecto `propone`: el piloto automático lo prende cada negocio (nunca MaKo por él). */
  modo: ModoMediaBuyer;
  kpi: KpiMediaBuyer;
  /** Costo por resultado objetivo, en la unidad del gasto (dólares si la cuenta convierte). null = lo recomienda MaKo. */
  objetivo: number | null;
  /** Cuánto puede subir el presupuesto de una campaña o conjunto en UN día, en %. */
  subidaMaxPctDia: number;
  /** Tope de la suma de los presupuestos diarios ACTIVOS de la cuenta, en la unidad del gasto. null = sin tope. */
  presupuestoMaxDia: number | null;
  /** «Monthly goals» de Madgicx: la caja del mes que se busca (CRM) y el gasto del mes previsto. */
  metaVentasMes: number | null;
  metaGastoMes: number | null;
  /** La cuenta publicitaria (act_…) si el negocio no la tiene en Integraciones. La de Integraciones manda. */
  cuentaPublicitaria: string | null;
  /** Cada táctica como automatización: estado, umbrales y campañas que cubre (lib/media-buyer/tacticas.ts). Vacío = lo recomendado. */
  tacticas: ConfigTacticas;
  /** DÓNDE: los lugares donde MaKo puede prender y subir presupuestos ([] = toda la cuenta). lib/media-buyer/zona.ts. */
  zona: LugarZona[];
  /** HASTA: la fecha de fin de toda la cuenta (YYYY-MM-DD, el día del negocio). Pasada, las campañas se pausan solas. */
  hasta: string | null;
  /** La fecha de fin de cada campaña (gana a la de la cuenta): { id de campaña: YYYY-MM-DD }. */
  hastaCampanas: Record<string, string>;
};

/**
 * Sin fila de configuración el Media Buyer está APAGADO: no analiza, no escribe variaciones (que gastarían la IA del
 * negocio sin que lo pidiera: AGENTS.md, «Un default que cobra es un cobro silencioso») y no lanza nada. Lo prende cada
 * negocio en su onboarding, y entonces arranca en «propone». Es lo que decidía el diseño del Autopilot del 13-14/10
 * (docs/diseno-ads-autopilot.md: «default apagado para TODOS, sin backfill»).
 */
export const CONFIG_POR_DEFECTO: ConfigMediaBuyer = Object.freeze({
  encendido: false,
  modo: 'propone',
  kpi: 'lead',
  objetivo: null,
  subidaMaxPctDia: 20,
  presupuestoMaxDia: null,
  metaVentasMes: null,
  metaGastoMes: null,
  cuentaPublicitaria: null,
  tacticas: {},
  zona: [],
  hasta: null,
  hastaCampanas: {},
}) as ConfigMediaBuyer;

export type NivelMeta = 'campaign' | 'adset' | 'ad';

export type TipoDecision =
  | 'subir_presupuesto'
  | 'bajar_presupuesto'
  | 'pausar'
  | 'activar'
  | 'variaciones_texto'
  | 'variaciones_hook'
  /** Una persona subió creativos nuevos a un conjunto (no lo propone el motor): queda registrado para poder deshacerlo. */
  | 'crear_anuncios'
  /** Una campaña entera que lanzó MaKo (Nueva campaña o la API: lib/media-buyer/campana.ts). Deshacerla la borra. */
  | 'crear_campana';

/**
 * La táctica que la disparó. Las cuatro primeras son las de Madgicx (academy.madgicx.com/lessons/
 * madgicx-automation-tactics); las otras dos son de MaKo, porque salen del CRM.
 */
export type Tactica =
  | 'surf'          // sube el presupuesto de lo que rinde, con techo
  | 'sunsetting'    // baja de a poco y apaga lo que no se recupera
  | 'stop_loss'     // pausa lo que gastó sin resultado
  | 'revive'        // prende lo que se apagó y después resultó bueno (la atribución llega tarde)
  | 'calidad'       // MaKo: leads que no agendan, aunque Meta los cuente
  | 'ganador'       // MaKo: lo que gana alimenta lo que se escribe (variaciones)
  | 'manual'        // lo hizo una persona desde el Media Buyer (subir creativos): no lo disparó ninguna táctica
  | 'hasta';        // la fecha de fin que puso la persona (zona.ts): se lanza sola, es su regla y no una recomendación

export type EstadoDecision =
  | 'abierta'       // propuesta, esperando a una persona
  | 'aplicada'      // lanzada (por una persona o por el piloto)
  | 'descartada'
  | 'deshecha'
  | 'fallida'       // se intentó y Meta/Zernio dijo que no: el error queda escrito
  | 'vencida'       // pasaron 48 h sin lanzarla: los números ya no son los de hoy
  | 'bloqueada';    // un tope no la dejó (y queda escrito cuál)

/** Una fila de la tabla «Condición · Valor · Por qué este valor» (academy-08.png). */
export type NumeroDecision = { condicion: string; valor: string; porQue: string };

/** El estado de la entidad que la decisión cambia. El presupuesto, en la moneda de la CUENTA (lo que va a Meta). */
export type EstadoEntidad = { estado?: 'ACTIVE' | 'PAUSED'; presupuesto?: number };

/** Una variación de texto o de hook, para elegir con su casilla antes de lanzar (academy-07.png, columna 2). */
export type Variacion = {
  id: string; textoPrincipal: string; titulo?: string; gancho?: string; elegida: boolean;
  /**
   * La variación de BOTÓN (lib/media-buyer/variacion-boton.ts): el mismo texto con otro `call_to_action` de Meta. Sin esto, la
   * copia conserva el botón del original. La elige el código, nunca la IA.
   */
  cta?: string;
};

/** Lo que propone el motor: una decisión sin identidad ni estado todavía. */
export type Propuesta = {
  /** Una por táctica, entidad y día: el motor puede correr dos veces sin duplicar. */
  clave: string;
  tipo: TipoDecision;
  tactica: Tactica;
  nivel: NivelMeta;
  entidadId: string;
  entidadNombre: string;
  campanaNombre: string | null;
  titulo: string;
  /** El titular de color de la columna del medio («Gastaste $13 de más la última semana»). */
  titular: string;
  /** Las viñetas de la columna izquierda: el porqué, en criollo. */
  porque: string[];
  numeros: NumeroDecision[];
  antes: EstadoEntidad;
  despues: EstadoEntidad;
  /** Para las variaciones: el anuncio ganador del que salen. */
  anuncioBase?: { id: string; esVideo: boolean; miniatura: string | null } | null;
  variaciones?: Variacion[];
};

export type Decision = Propuesta & {
  id: string;
  ws: number;
  creada: string;
  estado: EstadoDecision;
  /** Quién la lanzó: el piloto automático o una persona (su nombre o email). */
  origen: 'piloto' | 'persona' | null;
  aplicadaPor: string | null;
  aplicadaAt: string | null;
  deshechaPor: string | null;
  deshechaAt: string | null;
  /** Por dónde se escribió: la Zernio del negocio o su token de Meta. */
  canal: 'zernio' | 'meta' | null;
  error: string | null;
  /** Cómo se aplicó, si hubo algo que decir (un tope que recortó el monto). No es un error. */
  nota: string | null;
  motivoDescarte: string | null;
  estrellas: number | null;
  /** La moneda de la cuenta cuando se propuso (para pintar el antes → después). */
  moneda: string | null;
  /** Lo que se creó al lanzar una variación (ids de los anuncios nuevos), para poder deshacerla. */
  creados: string[];
};

/** Las decisiones que tocan plata: presupuesto o prender. Siempre pasan por los topes. */
export const MUEVE_PLATA: ReadonlySet<TipoDecision> = new Set<TipoDecision>(['subir_presupuesto', 'activar']);

/** Una decisión abierta vence a las 48 h: los números que la dispararon ya no son los de hoy. */
export const VENCE_HORAS = 48;

/** «Metas del mes» (la tarjeta de la derecha): el mes en curso hasta ayer, de la base (lib/media-buyer/datos.ts). */
export type MetasDelMes = {
  desde: string;
  hasta: string;
  diasQuedan: number;
  gasto: number;
  caja: number;
  resultados: { leads: number; agendas: number; ventas: number };
  moneda: string | null;
  convierte: boolean;
};
