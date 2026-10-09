// =============================================================================
// condiciones-catalogo — TODO lo que una tarjeta CONDITION puede preguntar de un lead
// =============================================================================
// Pedido de Martín (09/10/2026, punto 10): «Aquí en el condicional es donde tienes que poner
// todas las cosas que pueden pasar... Para eso primero se filtra si el CRON se creó para
// adquisición, todas las condiciones del CRM... Y de lo contrario, todas las condiciones de
// Customer Success... Debe ser bien amplio... No pongas esas preguntas genéricas, hazlo
// profesional, técnico... Se me ocurre un desplegable con opciones, como el CRON... La sección de
// "Pagos" en el CRM, la sección de "Cursos", la sección de "Información del Lead", "Tracking",
// "Plan", "Llamadas", etc». Y el punto 4: «Elimina lo de "Eventos" (del CRON), todo eso debería ir
// dentro del editable del CONDICIONAL».
//
// Módulo PURO y sin `server-only`: lo leen el editor (app/chatbot/EditorCondicion.tsx), el modelo
// (`cumpleFila`, `validarGrafo` y `textoFila` de lib/flujo-grafo.ts), el saneo de lo que se guarda
// (lib/nutricion-grafo-motor.ts) y el motor, que lee en batch SÓLO las fuentes que piden las
// condiciones del flujo (`fuentesDeFilas` → `hechosDeLeads`, lib/nutricion.ts). Una condición vive
// acá UNA vez: su id, su sección, su ámbito, cómo se dice, qué valor lleva, de qué dato sale y cómo
// se evalúa.
//
// ── LAS REGLAS ───────────────────────────────────────────────────────────────────
//   · CADA CONDICIÓN TIENE SU LECTOR, O NO ESTÁ. Una condición que el motor no puede evaluar es
//     una mentira de pantalla: la rama se elige y nadie la decide. `fuentes` dice qué lee el motor
//     y `evaluar` lo decide; tests/condiciones-catalogo.test.ts falla si una entrada nueva no tiene
//     las dos (salvo las nueve de antes, que decide el `switch` de `cumpleFila`).
//   · «NO SÉ» NO ES «NO». `evaluar` devuelve `null` cuando el dato no existe (un lead sin visitante
//     no «no reprodujo el VSL»: no se sabe). Una fila con `null` NO SE CUMPLE, NI NEGADA — la misma
//     regla que un campo desconocido. Si no, «No asistió a la R1» saldría para todo el que todavía
//     no tuvo la reunión.
//   · LOS ID SON ESTABLES. Se guardan en `nutricion_secuencias.pasos`; renombrar uno deja a las
//     filas guardadas como «condición desconocida». El rótulo se cambia libre; el id, nunca.
//   · GENÉRICO. Nada armado para un cliente: la confirmación antes de la reunión de Mauricio es
//     «Próxima reunión en ≤ 24 h» + «R1 pendiente»; el no-show de Código Inmobiliario es «No
//     asistió a la R1»; «experiencia en el rubro» es «Respuesta del formulario contiene …».
//
// ── LO QUE QUEDÓ AFUERA, Y POR QUÉ (medido el 09/10/2026 contra producción) ──────────
//   · «Plan»: la única unión exacta tarea→lead es `cliente_lead_id`, puesta en 6 de 776 tareas; el
//     resto se ata por nombre (`tableroDeLaCartera`, Customer Success). Una condición «tiene tareas
//     abiertas» diría «no» sobre clientes llenos de tareas.
//   · «Reagendó» y «Confirmó la asistencia»: no hay ningún campo que lo registre (`fecha_confirmacion`
//     es la confirmación de COMPRA, no de asistencia: ver `confirmado_sin_pago` en lib/nutricion.ts).
//   · «Último mensaje hace N h»: sale de `wa_mensajes` (50.903 filas) y no hay una lectura por lote
//     que no traiga todo el historial de cada lead.
// =============================================================================

import type { FilaCondicion, HechosLead } from './flujo-grafo';

// ── Tipos ─────────────────────────────────────────────────────────────────────────

/** De qué lado del negocio es una condición. 'ambos' = se ofrece con cualquier CRON. */
export type AmbitoCondicion = 'adquisicion' | 'entrega' | 'ambos';
/** De qué lado es el CRON de la automatización (`ambitoDeDisparo`). */
export type AmbitoDisparo = 'adquisicion' | 'entrega';

export type SeccionCondicion =
  | 'Información del lead' | 'Origen y tracking' | 'Etapa y pipeline' | 'Agenda y llamadas' | 'Pagos'
  | 'Mensajes' | 'Etiquetas'
  | 'Curso y avance' | 'Comunidad' | 'Tareas del curso' | 'Pagos del cliente' | 'Etapa de entrega';

/** El orden de las secciones en el desplegable, por ámbito. */
export const SECCIONES: Record<AmbitoDisparo, readonly SeccionCondicion[]> = {
  adquisicion: ['Información del lead', 'Origen y tracking', 'Etapa y pipeline', 'Agenda y llamadas', 'Pagos', 'Mensajes', 'Etiquetas'],
  entrega: ['Curso y avance', 'Comunidad', 'Tareas del curso', 'Pagos del cliente', 'Etapa de entrega', 'Mensajes', 'Etiquetas', 'Información del lead'],
};

/**
 * De dónde saca el motor el dato. Cada una es UNA lectura por lote (`hechosDeLeads`): pedir una
 * fuente que ninguna condición del flujo usa es leer de más; no pedirla es decidir sin el dato.
 */
export type Fuente =
  | 'lead'        // la fila de `leads` (siempre se lee: es la que arma el resto)
  | 'etiquetas'   // crm_lead_etiquetas (menos las archivadas)
  | 'productos'   // lead_funnel + la casa (la etapa por producto)
  | 'contacto'    // leadsYaContactados
  | 'respondio'   // wa_mensajes entrantes + inscripciones que pausaron por respuesta
  | 'vsl'         // getVslEngagementMap (plays y % máximo del VSL)
  | 'clics'       // vsl_events con tipo 'click'
  | 'respuestas'  // lead_respuestas + las columnas respuesta_* + meta_field_data
  | 'pagos'       // pagos (cuotas)
  | 'curso'       // curso_progreso (el efectivo) + curso_clases
  | 'acceso'      // curso_accesos (el portal)
  | 'comunidad'   // comunidad_posts (sin los hilos de clase) + comunidad_comentarios
  | 'entrega'     // la etapa del kanban de entrega (`clientesEnEtapaDeEntrega`)
  | 'cs';         // cs_clientes.estado

/** Los catálogos de los que sale el valor de una condición de lista. */
export type CatalogoValor =
  | 'etiqueta' | 'etapa' | 'producto' | 'campana'
  | 'origen' | 'estado_lead' | 'estado_cliente'
  | 'curso' | 'modulo' | 'clase' | 'clase_tarea' | 'post' | 'etapa_entrega';

export type TipoValor =
  | { t: 'ninguno' }
  /** Un número con su operador (≥ / ≤). `unidad` va pegada al número en la tarjeta. */
  | { t: 'numero'; unidad: string; def: number; min: number; max: number; ref?: CatalogoValor }
  /** Un elemento de un catálogo. */
  | { t: 'lista'; catalogo: CatalogoValor }
  /** Un texto libre (se busca sin mayúsculas ni tildes). */
  | { t: 'texto' }
  /** Las nueve de antes: su valor lo dibuja el editor como siempre (etiqueta, etapa, horas). */
  | { t: 'legado' };

export type OperadorCondicion = 'mayor_igual' | 'menor_igual';
export const OPERADORES: readonly OperadorCondicion[] = ['mayor_igual', 'menor_igual'];
export const SIMBOLO_OP: Record<OperadorCondicion, string> = { mayor_igual: '≥', menor_igual: '≤' };

export type DefCondicion = {
  id: string;
  seccion: SeccionCondicion;
  /** La sección con un CRON de entrega, si cambia (los pagos son «Pagos del cliente»). */
  seccionEntrega?: SeccionCondicion;
  ambito: AmbitoCondicion;
  /** [afirmativa, negada]. Una frase técnica y corta: es lo que se DIBUJA. */
  rotulo: readonly [string, string];
  /** ¿Se ofrece negada? Un número no (el operador ya dice ≥ o ≤) ni un compuesto. */
  negable: boolean;
  valor: TipoValor;
  fuentes: readonly Fuente[];
  /**
   * true / false, o `null` = el dato no se sabe (no se cumple, ni negada). Ausente SÓLO en las
   * nueve de antes (`legado`): ésas las decide el `switch` de `cumpleFila` (lib/flujo-grafo.ts).
   */
  evaluar?: (f: FilaCondicion, h: HechosLead) => boolean | null;
};

/**
 * Lo que el motor sabe del lead para las condiciones del catálogo (`HechosLead.catalogo`). Cada
 * bloque lo llena SU lector, y sólo si una condición del flujo lo pide: ausente = no se leyó, y
 * la condición que lo necesita devuelve `null`. Datos planos: el cálculo vive en el motor.
 */
export type HechosCatalogo = {
  lead?: {
    origen: string | null;
    estado: string | null;
    /** true / false / null (no se calificó todavía). */
    calificado: boolean | null;
    deFormularioMeta: boolean;
    conVisitante: boolean;
    campana: string | null;
    emailBaja: boolean;
    ventaTipo: string | null;
    tieneFechaAgenda: boolean;
    r1: { fechaMs: number | null; asistio: boolean | null };
    r2: { fechaMs: number | null; asistio: boolean | null };
    cerro: boolean | null;
    tieneFechaCierre: boolean;
    confirmoCompra: boolean;
    /** La próxima reunión FUTURA (`reunionFuturaMs`), o null. */
    proximaReunionMs: number | null;
  };
  /** null = el lead no tiene visitante (nunca se lo pudo seguir en la landing). */
  vsl?: { plays: number; maxPct: number | null } | null;
  /** null = sin visitante. */
  clics?: number | null;
  /** Todas sus respuestas de formulario, en un texto normalizado (`normalizarTexto`). */
  respuestas?: string;
  pagos?: { pagadas: number; vencidas: number };
  curso?: {
    completas: ReadonlySet<number>;
    enviadas: ReadonlySet<number>;
    aprobadas: ReadonlySet<number>;
    /** `${productoId}:${clave}` de cada módulo con TODAS sus clases completas. */
    modulosCompletos: ReadonlySet<string>;
    /** productoId → % de clases completas (redondeado). Sólo los productos con clases. */
    avance: ReadonlyMap<number, number>;
  };
  /** null = nunca tuvo acceso al portal. */
  acceso?: { ingresos: number; ultimoMs: number | null } | null;
  comunidad?: { posts: number; comentarios: number; comentoPosts: ReadonlySet<number> };
  /** `${productoId}:${etapa}` de las etapas de entrega en las que está (sólo las que pide el flujo). */
  entrega?: ReadonlySet<string>;
  /** Sin fila en cs_clientes = 'activo'. */
  estadoCliente?: string;
};

// ── Ayudas de evaluación ──────────────────────────────────────────────────────────

const L = (h: HechosLead) => h.catalogo?.lead;
const tri = (x: boolean | null | undefined): boolean | null => (x == null ? null : x);
const num = (f: FilaCondicion): number | null => {
  const n = Number(f.valor);
  return f.valor == null || f.valor === '' || !Number.isFinite(n) ? null : n;
};
/** La fila numérica contra un dato. `null` (sin dato, sin número u operador roto) no se cumple. */
function compara(f: FilaCondicion, dato: number | null | undefined): boolean | null {
  const n = num(f);
  if (dato == null || n == null) return null;
  if (f.op === 'menor_igual') return dato <= n;
  if (f.op === 'mayor_igual' || f.op == null) return dato >= n;
  return null;
}
const agendoDe = (l: NonNullable<HechosCatalogo['lead']>) => l.r1.fechaMs != null || l.r2.fechaMs != null || l.tieneFechaAgenda;

/** Minúsculas y sin tildes: «Experiencia» encuentra «experiencia» y «EXPERIÉNCIA». */
export function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const UMBRAL_VSL = 50;   // el mismo que `UMBRAL_VSL_PCT` (lib/nutricion.ts): «vio el VSL»

// ── EL CATÁLOGO ───────────────────────────────────────────────────────────────────

const LEGADO = { t: 'legado' } as const;
const NINGUNO = { t: 'ninguno' } as const;

export const CONDICIONES: readonly DefCondicion[] = [
  // ── Información del lead ──
  { id: 'tiene_telefono', seccion: 'Información del lead', ambito: 'ambos', rotulo: ['Tiene WhatsApp', 'Sin WhatsApp'], negable: true, valor: LEGADO, fuentes: ['lead'] },
  { id: 'tiene_email', seccion: 'Información del lead', ambito: 'ambos', rotulo: ['Tiene email', 'Sin email'], negable: true, valor: LEGADO, fuentes: ['lead'] },
  {
    id: 'email_baja', seccion: 'Información del lead', ambito: 'ambos', rotulo: ['Dado de baja del email', 'Recibe email'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => (L(h) ? L(h)!.emailBaja : null),
  },
  { id: 'antiguedad', seccion: 'Información del lead', ambito: 'adquisicion', rotulo: ['Llegó hace menos de', 'Llegó hace más de'], negable: true, valor: LEGADO, fuentes: ['lead'] },
  {
    id: 'estado_lead', seccion: 'Información del lead', ambito: 'adquisicion', rotulo: ['Estado del lead', 'Estado del lead no es'], negable: true, valor: { t: 'lista', catalogo: 'estado_lead' }, fuentes: ['lead'],
    evaluar: (f, h) => (L(h)?.estado ? L(h)!.estado === String(f.valor) : null),
  },
  {
    id: 'respuesta_contiene', seccion: 'Información del lead', ambito: 'adquisicion', rotulo: ['Respuesta del formulario contiene', 'Ninguna respuesta contiene'], negable: true, valor: { t: 'texto' }, fuentes: ['respuestas'],
    evaluar: (f, h) => {
      const r = h.catalogo?.respuestas;
      const buscado = normalizarTexto(String(f.valor ?? ''));
      if (r == null || !buscado) return null;
      // Sin ninguna respuesta no hay qué buscar: «no contiene» sería afirmar sobre un formulario vacío.
      if (!r) return null;
      return r.includes(buscado);
    },
  },

  // ── Origen y tracking ──
  {
    id: 'origen', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Origen', 'Origen no es'], negable: true, valor: { t: 'lista', catalogo: 'origen' }, fuentes: ['lead'],
    evaluar: (f, h) => {
      const o = L(h)?.origen;
      if (!o) return null;
      // «Carga manual» son dos valores en la base (`manual` y `carga_manual`).
      const norm = (x: string) => (x === 'carga_manual' ? 'manual' : x);
      return norm(o) === norm(String(f.valor));
    },
  },
  {
    id: 'campana_meta', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Campaña de Meta', 'Campaña de Meta no es'], negable: true, valor: { t: 'lista', catalogo: 'campana' }, fuentes: ['lead'],
    evaluar: (f, h) => {
      const c = L(h)?.campana;
      return c ? c === String(f.valor) : null;
    },
  },
  {
    id: 'form_sin_agenda', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Dejó el formulario sin agendar', ''], negable: false, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => { const l = L(h); return l ? l.deFormularioMeta && !agendoDe(l) : null; },
  },
  {
    id: 'visito_landing', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Visitó la landing', 'No visitó la landing'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => (L(h) ? L(h)!.conVisitante : null),
  },
  {
    id: 'reprodujo_vsl', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Reprodujo el VSL', 'No reprodujo el VSL'], negable: true, valor: NINGUNO, fuentes: ['vsl'],
    evaluar: (_f, h) => { const v = h.catalogo?.vsl; return v == null ? null : v.plays > 0 || (v.maxPct ?? 0) > 0; },
  },
  {
    id: 'vsl_pct', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['VSL visto', 'VSL visto'], negable: false, valor: { t: 'numero', unidad: ' %', def: UMBRAL_VSL, min: 1, max: 100 }, fuentes: ['vsl'],
    // Con visitante y sin avance medido, 0: es la regla de las cohortes de antes (`?? 0`).
    evaluar: (f, h) => { const v = h.catalogo?.vsl; return v == null ? null : compara(f, v.maxPct ?? 0); },
  },
  {
    id: 'vsl_sin_agendar', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Vio el VSL y no agendó', ''], negable: false, valor: NINGUNO, fuentes: ['vsl', 'lead'],
    evaluar: (_f, h) => { const v = h.catalogo?.vsl; const l = L(h); return v == null || !l ? null : (v.maxPct ?? 0) >= UMBRAL_VSL && !agendoDe(l); },
  },
  {
    id: 'vsl_poco', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Vio poco del VSL y no agendó', ''], negable: false, valor: NINGUNO, fuentes: ['vsl', 'lead'],
    evaluar: (_f, h) => { const v = h.catalogo?.vsl; const l = L(h); return v == null || !l ? null : (v.maxPct ?? 0) < UMBRAL_VSL && !agendoDe(l); },
  },
  {
    id: 'hizo_clic', seccion: 'Origen y tracking', ambito: 'adquisicion', rotulo: ['Hizo clic en la landing', 'Sin clics en la landing'], negable: true, valor: NINGUNO, fuentes: ['clics'],
    evaluar: (_f, h) => { const c = h.catalogo?.clics; return c == null ? null : c > 0; },
  },

  // ── Etapa y pipeline ──
  { id: 'etapa', seccion: 'Etapa y pipeline', ambito: 'adquisicion', rotulo: ['Está en la etapa', 'No está en la etapa'], negable: true, valor: LEGADO, fuentes: ['lead', 'productos'] },
  {
    id: 'en_producto', seccion: 'Etapa y pipeline', ambito: 'adquisicion', rotulo: ['Está en el embudo de', 'No está en el embudo de'], negable: true, valor: { t: 'lista', catalogo: 'producto' }, fuentes: ['lead', 'productos'],
    evaluar: (f, h) => { const id = num(f); return id == null || !h.etapasPorProducto ? null : h.etapasPorProducto.has(id); },
  },

  // ── Agenda y llamadas ──
  { id: 'agendo', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Agendó', 'No agendó'], negable: true, valor: LEGADO, fuentes: ['lead'] },
  {
    id: 'r1_pendiente', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['R1 agendada a futuro', 'Sin R1 a futuro'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    // La regla de «Agendó pero no confirmó» (`agendado_sin_confirmar`): la R1 por delante y sin
    // asistencia registrada. No hay un campo «confirmó»: no se inventa. «A futuro» con 12 h de
    // gracia: una R1 de sólo fecha se lee al mediodía de México (`parseFechaJunta`) y la de HOY
    // tiene que contar todo el día, como el `>= hoy` de la cohorte.
    evaluar: (_f, h) => { const l = L(h); return l ? l.r1.fechaMs != null && l.r1.fechaMs >= h.ahoraMs - 12 * 3_600_000 && l.r1.asistio == null : null; },
  },
  {
    id: 'reunion_en', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Próxima reunión en', 'Próxima reunión en'], negable: false, valor: { t: 'numero', unidad: ' h', def: 24, min: 1, max: 720 }, fuentes: ['lead'],
    evaluar: (f, h) => { const r = L(h)?.proximaReunionMs; return r == null ? null : compara(f, (r - h.ahoraMs) / 3_600_000); },
  },
  {
    id: 'asistio_r1', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Asistió a la R1', 'No asistió a la R1'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => tri(L(h)?.r1.asistio),
  },
  {
    id: 'agendo_r2', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Tiene R2 agendada', 'Sin R2 agendada'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => (L(h) ? L(h)!.r2.fechaMs != null : null),
  },
  {
    id: 'asistio_r2', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Asistió a la R2', 'No asistió a la R2'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => tri(L(h)?.r2.asistio),
  },
  {
    id: 'calificado', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Calificado', 'No calificado'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => tri(L(h)?.calificado),
  },
  {
    id: 'r1_sin_avanzar', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Asistió a la R1 y no avanza', ''], negable: false, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => { const l = L(h); return l ? l.r1.asistio === true && l.calificado == null && l.r2.fechaMs == null : null; },
  },
  {
    id: 'calificado_sin_r2', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Calificado sin R2', ''], negable: false, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => { const l = L(h); return l ? l.calificado === true && l.r2.fechaMs == null && l.r2.asistio == null : null; },
  },
  {
    id: 'r2_sin_cerrar', seccion: 'Agenda y llamadas', ambito: 'adquisicion', rotulo: ['Asistió a la R2 y no cerró', ''], negable: false, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => { const l = L(h); return l ? l.r2.asistio === true && l.cerro == null && !l.tieneFechaCierre : null; },
  },

  // ── Pagos ──
  { id: 'pago', seccion: 'Pagos', ambito: 'adquisicion', rotulo: ['Pagó', 'No pagó'], negable: true, valor: LEGADO, fuentes: ['lead'] },
  {
    id: 'confirmo_sin_pago', seccion: 'Pagos', ambito: 'adquisicion', rotulo: ['Confirmó la compra y no pagó', ''], negable: false, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => (L(h) ? L(h)!.confirmoCompra && !h.pago : null),
  },
  {
    id: 'venta_suscripcion', seccion: 'Pagos', seccionEntrega: 'Pagos del cliente', ambito: 'ambos', rotulo: ['Venta por suscripción', 'Venta de pago único'], negable: true, valor: NINGUNO, fuentes: ['lead'],
    evaluar: (_f, h) => { const t = L(h)?.ventaTipo; return t === 'suscripcion' ? true : t === 'unico' ? false : null; },
  },
  {
    id: 'cuotas_pagadas', seccion: 'Pagos', seccionEntrega: 'Pagos del cliente', ambito: 'ambos', rotulo: ['Cuotas pagadas', 'Cuotas pagadas'], negable: false, valor: { t: 'numero', unidad: '', def: 1, min: 0, max: 60 }, fuentes: ['pagos'],
    evaluar: (f, h) => compara(f, h.catalogo?.pagos?.pagadas),
  },
  {
    id: 'cuotas_vencidas', seccion: 'Pagos', seccionEntrega: 'Pagos del cliente', ambito: 'ambos', rotulo: ['Cuotas vencidas', 'Cuotas vencidas'], negable: false, valor: { t: 'numero', unidad: '', def: 1, min: 0, max: 60 }, fuentes: ['pagos'],
    evaluar: (f, h) => compara(f, h.catalogo?.pagos?.vencidas),
  },

  // ── Mensajes ──
  { id: 'ya_contactado', seccion: 'Mensajes', ambito: 'ambos', rotulo: ['Ya le escribiste', 'Nunca le escribiste'], negable: true, valor: LEGADO, fuentes: ['contacto'] },
  { id: 'respondio', seccion: 'Mensajes', ambito: 'ambos', rotulo: ['Te escribió alguna vez', 'Nunca te escribió'], negable: true, valor: LEGADO, fuentes: ['respondio'] },

  // ── Etiquetas ──
  { id: 'etiqueta', seccion: 'Etiquetas', ambito: 'ambos', rotulo: ['Tiene la etiqueta', 'No tiene la etiqueta'], negable: true, valor: LEGADO, fuentes: ['etiquetas'] },

  // ── Curso y avance (entrega) ──
  {
    id: 'completo_clase', seccion: 'Curso y avance', ambito: 'entrega', rotulo: ['Completó la clase', 'No completó la clase'], negable: true, valor: { t: 'lista', catalogo: 'clase' }, fuentes: ['curso'],
    evaluar: (f, h) => { const c = h.catalogo?.curso; const id = num(f); return !c || id == null ? null : c.completas.has(id); },
  },
  {
    id: 'completo_modulo', seccion: 'Curso y avance', ambito: 'entrega', rotulo: ['Completó el módulo', 'No completó el módulo'], negable: true, valor: { t: 'lista', catalogo: 'modulo' }, fuentes: ['curso'],
    evaluar: (f, h) => { const c = h.catalogo?.curso; const k = String(f.valor ?? ''); return !c || !k ? null : c.modulosCompletos.has(k); },
  },
  {
    id: 'avance_curso', seccion: 'Curso y avance', ambito: 'entrega', rotulo: ['Avance del curso', 'Avance del curso'], negable: false, valor: { t: 'numero', unidad: ' %', def: 50, min: 0, max: 100, ref: 'curso' }, fuentes: ['curso'],
    // El lector pone TODOS los cursos con clases (0 % si no completó nada): un curso que no está en
    // el mapa no tiene clases, y su avance no se sabe.
    evaluar: (f, h) => {
      const c = h.catalogo?.curso;
      const prod = Number(f.ref);
      if (!c || !(prod > 0)) return null;
      return compara(f, c.avance.get(prod) ?? null);
    },
  },
  {
    id: 'entro_portal', seccion: 'Curso y avance', ambito: 'entrega', rotulo: ['Entró al portal del curso', 'Nunca entró al portal'], negable: true, valor: NINGUNO, fuentes: ['acceso'],
    // Sin acceso es un hecho (nunca se le dio el link): «nunca entró» es cierto, no «no sé».
    evaluar: (_f, h) => (h.catalogo?.acceso === undefined ? null : (h.catalogo.acceso?.ingresos ?? 0) > 0),
  },
  {
    id: 'dias_sin_entrar', seccion: 'Curso y avance', ambito: 'entrega', rotulo: ['Días sin entrar al portal', 'Días sin entrar al portal'], negable: false, valor: { t: 'numero', unidad: ' días', def: 7, min: 1, max: 365 }, fuentes: ['acceso'],
    evaluar: (f, h) => { const u = h.catalogo?.acceso?.ultimoMs; return u == null ? null : compara(f, Math.floor((h.ahoraMs - u) / 86_400_000)); },
  },

  // ── Comunidad (entrega) ──
  {
    id: 'publico_comunidad', seccion: 'Comunidad', ambito: 'entrega', rotulo: ['Publicó en la comunidad', 'Nunca publicó en la comunidad'], negable: true, valor: NINGUNO, fuentes: ['comunidad'],
    evaluar: (_f, h) => { const c = h.catalogo?.comunidad; return c ? c.posts > 0 : null; },
  },
  {
    id: 'comento_comunidad', seccion: 'Comunidad', ambito: 'entrega', rotulo: ['Comentó en la comunidad', 'Nunca comentó en la comunidad'], negable: true, valor: NINGUNO, fuentes: ['comunidad'],
    evaluar: (_f, h) => { const c = h.catalogo?.comunidad; return c ? c.comentarios > 0 : null; },
  },
  {
    id: 'comento_post', seccion: 'Comunidad', ambito: 'entrega', rotulo: ['Comentó el post', 'No comentó el post'], negable: true, valor: { t: 'lista', catalogo: 'post' }, fuentes: ['comunidad'],
    evaluar: (f, h) => { const c = h.catalogo?.comunidad; const id = num(f); return !c || id == null ? null : c.comentoPosts.has(id); },
  },

  // ── Tareas del curso (entrega) ──
  {
    id: 'tareas_enviadas', seccion: 'Tareas del curso', ambito: 'entrega', rotulo: ['Tareas enviadas', 'Tareas enviadas'], negable: false, valor: { t: 'numero', unidad: '', def: 1, min: 0, max: 500 }, fuentes: ['curso'],
    evaluar: (f, h) => { const c = h.catalogo?.curso; return c ? compara(f, c.enviadas.size) : null; },
  },
  {
    id: 'envio_tarea', seccion: 'Tareas del curso', ambito: 'entrega', rotulo: ['Envió la tarea de', 'No envió la tarea de'], negable: true, valor: { t: 'lista', catalogo: 'clase_tarea' }, fuentes: ['curso'],
    evaluar: (f, h) => { const c = h.catalogo?.curso; const id = num(f); return !c || id == null ? null : c.enviadas.has(id); },
  },
  {
    id: 'tarea_aprobada', seccion: 'Tareas del curso', ambito: 'entrega', rotulo: ['Tarea aprobada de', 'Tarea sin aprobar de'], negable: true, valor: { t: 'lista', catalogo: 'clase_tarea' }, fuentes: ['curso'],
    evaluar: (f, h) => { const c = h.catalogo?.curso; const id = num(f); return !c || id == null ? null : c.aprobadas.has(id); },
  },

  // ── Etapa de entrega (entrega) ──
  {
    id: 'etapa_entrega', seccion: 'Etapa de entrega', ambito: 'entrega', rotulo: ['Está en la etapa de entrega', 'No está en la etapa de entrega'], negable: true, valor: { t: 'lista', catalogo: 'etapa_entrega' }, fuentes: ['entrega'],
    evaluar: (f, h) => { const e = h.catalogo?.entrega; const k = String(f.valor ?? ''); return !e || !k ? null : e.has(k); },
  },
  {
    id: 'estado_cliente', seccion: 'Etapa de entrega', ambito: 'entrega', rotulo: ['Estado del cliente', 'Estado del cliente no es'], negable: true, valor: { t: 'lista', catalogo: 'estado_cliente' }, fuentes: ['cs'],
    evaluar: (f, h) => { const e = h.catalogo?.estadoCliente; return e == null ? null : e === String(f.valor); },
  },
];

/** Los ids del catálogo (las nueve de antes incluidas). */
export const IDS_CONDICION: readonly string[] = CONDICIONES.map((c) => c.id);
const POR_ID: ReadonlyMap<string, DefCondicion> = new Map(CONDICIONES.map((c) => [c.id, c]));

export function condicionPorId(id: unknown): DefCondicion | null {
  return typeof id === 'string' ? POR_ID.get(id) ?? null : null;
}

/** Las listas FIJAS (las que no salen de la base del negocio). */
export const OPCIONES_FIJAS: Partial<Record<CatalogoValor, ReadonlyArray<{ value: string; label: string }>>> = {
  origen: [
    { value: 'instant_form', label: 'Formulario de Meta' },
    { value: 'landing', label: 'Landing' },
    { value: 'calendly', label: 'Calendly' },
    { value: 'calcom', label: 'Cal.com' },
    { value: 'chat_whatsapp', label: 'WhatsApp' },
    { value: 'manual', label: 'Carga manual' },
  ],
  estado_lead: [
    { value: 'abierto', label: 'Abierto' },
    { value: 'ganado', label: 'Ganado' },
    { value: 'perdido', label: 'Perdido' },
    { value: 'descalificado', label: 'Descalificado' },
    { value: 'no_responde', label: 'No responde' },
  ],
  // `graduado` y `baja` son decisiones del equipo (mig 0129); sin fila = activo.
  estado_cliente: [
    { value: 'activo', label: 'Activo' },
    { value: 'graduado', label: 'Graduado' },
    { value: 'baja', label: 'Baja' },
  ],
};

// ── El ámbito del CRON ────────────────────────────────────────────────────────────

/**
 * ¿El CRON es de adquisición o de entrega? La ENTREGA del servicio (el kanban de Customer
 * Success) es `entrega_actual`; todo lo demás —una etapa de venta, una etiqueta, un evento de
 * antes, manual— es adquisición.
 */
export function ambitoDeDisparo(triggerTipo: string | null | undefined): AmbitoDisparo {
  return triggerTipo === 'entrega_actual' ? 'entrega' : 'adquisicion';
}

/** ¿Se ofrece esta condición con este CRON? */
export function seOfrece(c: DefCondicion, ambito: AmbitoDisparo): boolean {
  return c.ambito === 'ambos' || c.ambito === ambito;
}

export function seccionEn(c: DefCondicion, ambito: AmbitoDisparo): SeccionCondicion {
  return ambito === 'entrega' && c.seccionEntrega ? c.seccionEntrega : c.seccion;
}

// ── Los catálogos que el editor recibe ─────────────────────────────────────────────

export type OpcionCatalogo = { value: string; label: string };
export type SeccionOpciones = { title: string; options: OpcionCatalogo[] };

/** Un producto con su embudo y su entrega (la forma de `ProductoParaDisparo`). */
export type ProductoCondicion = {
  funnelId: number | null; productoId: number | null; nombre: string;
  etapas: ReadonlyArray<OpcionCatalogo>; etapasEntrega: ReadonlyArray<OpcionCatalogo>;
};
/** Un curso (un producto con clases), de GET /api/chat-agent/condiciones. */
export type CursoCondicion = {
  productoId: number; nombre: string;
  modulos: ReadonlyArray<{ clave: string; nombre: string }>;
  clases: ReadonlyArray<{ id: number; titulo: string; modulo: string; tieneTarea: boolean }>;
};
export type CatalogosCondicion = {
  etiquetas?: ReadonlyArray<{ id: number; nombre: string; archivada_at?: string | null }>;
  /** Las etapas de venta por producto (las que dibuja el selector de etapa de siempre). */
  etapas?: ReadonlyArray<{ title: string; funnelId: number; options: ReadonlyArray<OpcionCatalogo> }>;
  productos?: ReadonlyArray<ProductoCondicion>;
  cursos?: ReadonlyArray<CursoCondicion>;
  posts?: ReadonlyArray<{ id: number; titulo: string }>;
  campanas?: ReadonlyArray<string>;
};

/**
 * Los CURSOS para el editor (GET /api/chat-agent/condiciones): los productos que tienen clases, con
 * sus módulos en el orden del curso y sus clases. Un módulo que no tiene clases no se ofrece («Completó
 * el módulo» de un módulo vacío nunca se cumple: el motor exige al menos una clase), y una clase que
 * cuelga de un módulo que ya no existe va igual, bajo su curso.
 */
export function armarCursos(
  productos: ReadonlyArray<{ id: number; nombre: string }>,
  clases: ReadonlyArray<{ id: number; productoId: number; etapa: string; orden?: number; titulo: string; tieneTarea: boolean }>,
  modulos: ReadonlyMap<number, ReadonlyArray<{ clave: string; nombre: string }>>,
): CursoCondicion[] {
  const out: CursoCondicion[] = [];
  for (const p of productos) {
    const suyas = clases.filter((c) => c.productoId === p.id);
    if (!suyas.length) continue;
    const conClases = new Set(suyas.map((c) => c.etapa));
    const mods = (modulos.get(p.id) ?? []).filter((m) => conClases.has(m.clave));
    const orden = new Map(mods.map((m, i) => [m.clave, i]));
    out.push({
      productoId: p.id,
      nombre: p.nombre || `Producto ${p.id}`,
      modulos: mods.map((m) => ({ clave: m.clave, nombre: m.nombre })),
      clases: [...suyas]
        .sort((a, b) => (orden.get(a.etapa) ?? 999) - (orden.get(b.etapa) ?? 999) || (a.orden ?? 0) - (b.orden ?? 0) || a.id - b.id)
        .map((c) => ({ id: c.id, titulo: c.titulo || `Clase ${c.id}`, modulo: c.etapa, tieneTarea: c.tieneTarea })),
    });
  }
  return out;
}

/**
 * Las opciones de un catálogo, en secciones (para un Dropdown con `secciones`, o aplanadas). Un
 * catálogo dinámico que no se cargó devuelve []: la condición que lo necesita no se ofrece.
 */
export function opcionesDe(catalogo: CatalogoValor, cat: CatalogosCondicion): SeccionOpciones[] {
  const fija = OPCIONES_FIJAS[catalogo];
  if (fija) return [{ title: '', options: [...fija] }];
  const varios = (cat.productos?.length ?? 0) > 1 || (cat.cursos?.length ?? 0) > 1;
  switch (catalogo) {
    case 'etiqueta':
      return [{ title: '', options: (cat.etiquetas ?? []).filter((e) => !e.archivada_at).map((e) => ({ value: String(e.id), label: e.nombre })) }];
    case 'etapa':
      return (cat.etapas ?? []).map((s) => ({ title: s.title, options: s.options.map((o) => ({ value: `${s.funnelId}:${o.value}`, label: o.label })) }));
    case 'producto':
      return [{ title: '', options: (cat.productos ?? []).filter((p) => p.funnelId != null).map((p) => ({ value: String(p.funnelId), label: p.nombre })) }];
    case 'campana':
      return [{ title: '', options: (cat.campanas ?? []).map((c) => ({ value: c, label: c })) }];
    case 'post':
      return [{ title: '', options: (cat.posts ?? []).map((p) => ({ value: String(p.id), label: p.titulo || `Post ${p.id}` })) }];
    case 'curso':
      return [{ title: '', options: (cat.cursos ?? []).map((c) => ({ value: String(c.productoId), label: c.nombre })) }];
    case 'modulo':
      return (cat.cursos ?? []).map((c) => ({ title: varios ? c.nombre : '', options: c.modulos.map((m) => ({ value: `${c.productoId}:${m.clave}`, label: m.nombre })) }));
    case 'clase':
    case 'clase_tarea':
      return (cat.cursos ?? []).map((c) => ({
        title: varios ? c.nombre : '',
        options: c.clases.filter((k) => catalogo === 'clase' || k.tieneTarea).map((k) => ({ value: String(k.id), label: k.titulo })),
      }));
    case 'etapa_entrega':
      return (cat.productos ?? []).filter((p) => p.productoId != null).map((p) => ({
        title: varios ? p.nombre : '',
        options: p.etapasEntrega.map((e) => ({ value: `${p.productoId}:${e.value}`, label: e.label })),
      }));
    default:
      return [];
  }
}

const hayOpciones = (s: SeccionOpciones[]) => s.some((x) => x.options.length > 0);

/** ¿Hay con qué completar esta condición? Una de lista sin elementos no se ofrece. */
export function tieneCatalogo(c: DefCondicion, cat: CatalogosCondicion): boolean {
  if (c.valor.t === 'lista') return hayOpciones(opcionesDe(c.valor.catalogo, cat));
  if (c.valor.t === 'numero' && c.valor.ref) return hayOpciones(opcionesDe(c.valor.ref, cat));
  if (c.id === 'etiqueta') return true;   // el selector de etiqueta deja crear una nueva
  if (c.id === 'etapa') return hayOpciones(opcionesDe('etapa', cat));
  return true;
}

/** El valor de una opción del desplegable de condiciones: el id y si va negada. */
export const valorOpcion = (id: string, no: boolean): string => `${id}|${no ? 1 : 0}`;
export function deValorOpcion(v: string): { id: string; no: boolean } | null {
  const [id, n] = v.split('|');
  return condicionPorId(id) ? { id, no: n === '1' } : null;
}

/**
 * EL DESPLEGABLE DE CONDICIONES, POR SECCIONES (el patrón del Plan y del CRON): las del ámbito del
 * CRON, cada una en positivo y —si se puede— negada, en el orden de `SECCIONES`. Las que no tienen
 * con qué completarse (no hay cursos, no hay posts) no se ofrecen.
 */
export function seccionesDeCondiciones(ambito: AmbitoDisparo, cat: CatalogosCondicion): SeccionOpciones[] {
  return SECCIONES[ambito].map((titulo) => ({
    title: titulo,
    options: CONDICIONES
      .filter((c) => seOfrece(c, ambito) && seccionEn(c, ambito) === titulo && tieneCatalogo(c, cat))
      .flatMap((c) => [
        { value: valorOpcion(c.id, false), label: c.rotulo[0] },
        ...(c.negable && c.rotulo[1] && c.rotulo[1] !== c.rotulo[0] ? [{ value: valorOpcion(c.id, true), label: c.rotulo[1] }] : []),
      ]),
  })).filter((s) => s.options.length > 0);
}

/**
 * La fila NUEVA al elegir una condición: su valor por defecto (el número, el operador) y nada que
 * haya que adivinar (una lista nace sin elegir: `validarFila` la frena hasta que se elija).
 */
export function filaNueva(id: string, no: boolean): FilaCondicion | null {
  const c = condicionPorId(id);
  if (!c) return null;
  const f: FilaCondicion = { campo: id as FilaCondicion['campo'] };
  if (no && c.negable) f.no = true;
  if (c.valor.t === 'numero') { f.op = 'mayor_igual'; f.valor = c.valor.def; }
  if (id === 'antiguedad') f.valor = 72;
  return f;
}

// ── Validar (lo que la fila necesita para que el motor la pueda decidir) ─────────

/** null = la fila se puede guardar. Si no, en palabras para quien guarda. */
export function problemaDeFila(f: FilaCondicion): string | null {
  const c = condicionPorId(f.campo);
  if (!c) return `condición desconocida: ${String(f.campo)}`;
  const v = c.valor;
  if (v.t === 'legado') {
    if ((f.campo === 'etiqueta' || f.campo === 'etapa') && (f.valor == null || f.valor === '')) return `falta elegir la ${f.campo}`;
    if (f.campo === 'antiguedad' && !(Number(f.valor) > 0)) return 'falta el número de horas';
    return null;
  }
  if (v.t === 'lista' && (f.valor == null || f.valor === '')) return `falta elegir «${c.rotulo[0]}»`;
  if (v.t === 'texto' && !String(f.valor ?? '').trim()) return `falta el texto de «${c.rotulo[0]}»`;
  if (v.t === 'numero') {
    const n = Number(f.valor);
    if (f.valor == null || f.valor === '' || !Number.isFinite(n) || n < v.min || n > v.max) return `falta el número de «${c.rotulo[0]}»`;
    if (f.op != null && !OPERADORES.includes(f.op)) return `operador inválido en «${c.rotulo[0]}»`;
    if (v.ref && !(Number(f.ref) > 0)) return `falta elegir el curso de «${c.rotulo[0]}»`;
  }
  return null;
}

// ── Evaluar ───────────────────────────────────────────────────────────────────────

/**
 * Una fila del catálogo NUEVO (las nueve de antes las decide `cumpleFila`). Desconocida o sin
 * dato = NO SE CUMPLE, ni negada. `no` sólo cuenta en las negables.
 */
export function cumpleCatalogo(f: FilaCondicion, h: HechosLead): boolean {
  const c = condicionPorId(f.campo);
  if (!c?.evaluar) return false;
  const si = c.evaluar(f, h);
  if (si == null) return false;
  return f.no && c.negable ? !si : si;
}

// ── Qué tiene que leer el motor ───────────────────────────────────────────────────

/** Las fuentes que piden estas filas. `lead` va siempre: es la fila que arma el resto. */
export function fuentesDeFilas(filas: readonly FilaCondicion[]): Set<Fuente> {
  const out = new Set<Fuente>(['lead']);
  for (const f of filas) for (const x of condicionPorId(f.campo)?.fuentes ?? []) out.add(x);
  return out;
}

/** Las etapas de entrega (`productoId:etapa`) que piden estas filas: la fuente `entrega` lee sólo ésas. */
export function etapasEntregaDeFilas(filas: readonly FilaCondicion[]): Array<{ productoId: number; etapa: string }> {
  const vistos = new Set<string>();
  const out: Array<{ productoId: number; etapa: string }> = [];
  for (const f of filas) {
    if (f.campo !== 'etapa_entrega') continue;
    const k = String(f.valor ?? '');
    const [p, ...e] = k.split(':');
    const productoId = Number(p);
    const etapa = e.join(':');
    if (!(productoId > 0) || !etapa || vistos.has(k)) continue;
    vistos.add(k);
    out.push({ productoId, etapa });
  }
  return out;
}

// ── Cómo se dice en la tarjeta ────────────────────────────────────────────────────

/** Los nombres que la tarjeta necesita para decir el valor (los da quien dibuja). */
export type NombresCatalogo = (catalogo: CatalogoValor, valor: string) => string | null;

const GENERICO: Record<CatalogoValor, string> = {
  etiqueta: 'una etiqueta', etapa: 'una etapa', producto: 'un producto', campana: 'una campaña', origen: 'un origen',
  estado_lead: 'un estado', estado_cliente: 'un estado', curso: 'un curso', modulo: 'un módulo', clase: 'una clase',
  clase_tarea: 'una clase', post: 'un post', etapa_entrega: 'una etapa',
};

/**
 * Los nombres de los valores, sacados de los MISMOS catálogos que ofrece el editor: lo que la
 * tarjeta dice es lo que se eligió. Para `NombresParaTexto.catalogo` (lib/flujo-grafo.ts).
 */
export function nombresCatalogoDe(cat: CatalogosCondicion): NombresCatalogo {
  return (catalogo, valor) => {
    for (const s of opcionesDe(catalogo, cat)) {
      const o = s.options.find((x) => x.value === valor);
      if (o) return o.label;
    }
    return null;
  };
}

/** El nombre de un valor: el de una lista fija, o el que dé quien dibuja, o el genérico. */
export function nombreDeValor(catalogo: CatalogoValor, valor: string, n?: NombresCatalogo): string {
  const fijo = OPCIONES_FIJAS[catalogo]?.find((o) => o.value === valor)?.label;
  return fijo ?? n?.(catalogo, valor) ?? (catalogo === 'campana' && valor ? valor : GENERICO[catalogo]);
}

/**
 * La frase de una fila del catálogo NUEVO (las nueve de antes las dice `textoFila`). Corta: es lo
 * que se dibuja en la tarjeta («Cuotas vencidas ≥ 2», «Completó la clase «Bienvenida»»).
 */
export function textoCondicion(f: FilaCondicion, n?: NombresCatalogo): string {
  const c = condicionPorId(f.campo);
  if (!c) return 'Condición';
  const r = c.rotulo[f.no && c.negable ? 1 : 0];
  const v = c.valor;
  if (v.t === 'numero') {
    const op = SIMBOLO_OP[f.op === 'menor_igual' ? 'menor_igual' : 'mayor_igual'];
    const base = `${r} ${op} ${f.valor ?? '…'}${v.unidad}`;
    return v.ref ? `${base} · ${nombreDeValor(v.ref, String(f.ref ?? ''), n)}` : base;
  }
  if (v.t === 'lista') {
    if (f.valor == null || f.valor === '') return `${r} …`;
    const nom = nombreDeValor(v.catalogo, String(f.valor), n);
    return v.catalogo === 'origen' || v.catalogo === 'estado_lead' || v.catalogo === 'estado_cliente' ? `${r}: ${nom}` : `${r} «${nom}»`;
  }
  if (v.t === 'texto') return `${r} «${String(f.valor ?? '').trim() || '…'}»`;
  return r;
}
