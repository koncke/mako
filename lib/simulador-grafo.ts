// =============================================================================
// simulador-grafo — «Probar» recorre el FLUJO que se está editando, tarjeta por tarjeta
// =============================================================================
// Pedido de Martín (08/10/2026, punto 10): «El botón de probar se rompe… No tiene la animación
// de entrada de los mensajes y tampoco puedo interactuar, para probarlo de verdad». Molde de
// ManyChat («In Manychat»): un teléfono al lado del lienzo que recorre la automatización; una
// espera no espera; una acción no se ejecuta. Una condición la decidía quien prueba con botones; desde
// la quinta tanda la decide el MOTOR con un lead RECIÉN LLEGADO (`hechosDeLeadNuevo`, más abajo).
//
// Módulo PURO y sin `server-only`: lo ejecutan tests/simulador-grafo.test.ts y
// tests/simulador-hilos.test.ts, y lo usa el panel (app/automations/PanelProbar.tsx). La navegación es
// la de lib/flujo-grafo.ts —la MISMA que lee el motor—, así que lo que se prueba es lo que va a
// pasar, y no un setter libre como antes: la #198 tenía cero casos y en el simulador viejo MaKo
// contestaba igual, mientras en producción toda respuesta iba a hand-off. Un simulador que no
// recorre el dato del motor afirma algo que el motor no hace.
//
// ── QUÉ SE PRUEBA: LO QUE SE VE, NO LO GUARDADO ──────────────────────────────
// Recibe los pasos LOCALES (lo que el lienzo tiene sin publicar, `onCambioLocal`). Antes
// «Probar» desmontaba el editor y simulaba la prop guardada: se probaba otra cosa y encima se
// perdía lo escrito.
//
// ── LAS DOS RAÍCES ───────────────────────────────────────────────────────────
// La SALIDA arranca en `raicesSalida` y corre sola. Una respuesta del lead la PAUSA
// (`pausarPorRespuesta`, igual que el motor) y corre «Si responde»: el servidor clasifica contra
// los casos locales y este módulo entra por la rama elegida (`entrarEnRespuesta`). Un «Ir a» a una
// tarjeta desde «Si responde» RETOMA la salida ahí (lo mismo que hace el motor).
//
// ── SEGUNDA TANDA (08/10/2026, noche): VARIOS CAMINOS A LA VEZ ───────────────
// Pedido de Martín, punto 2: «de un mismo cron puedo sacar todo una secuencia para WhatsApp y
// toda otra secuencia de email». Con flechas en paralelo (`paralelos`, lib/flujo-grafo.ts) la
// salida deja de ser UN cursor: es una lista de HILOS, cada uno con su RELOJ en minutos virtuales
// (docs/chatbot-flujo-ramas-diseno.md, «"Probar" (parte P)», y la decisión 3 del motor).
//
//   · Corre el hilo de reloj más bajo; en un empate, el primero del array (que es el orden en
//     que nacieron). Así la prueba muestra el ORDEN REAL: el WhatsApp del día 0, el email del
//     día 0, y recién después el WhatsApp del día 1. Con un solo cursor, «Probar» mostraba toda
//     la rama de WhatsApp —días incluidos— antes del primer email.
//   · Una espera suma sus minutos al reloj de SU hilo y nada más.
//   · Una tarjeta con flechas en paralelo, cuando termina, agrega un hilo por flecha con el
//     reloj que tiene el padre en ese momento (una espera termina DESPUÉS de esperar).
//   · Una condición pendiente frena la prueba ENTERA: una pregunta a la vez, aunque otro hilo
//     tenga algo para mostrar.
//   · Una respuesta del lead pausa TODOS los hilos (como el motor, decisión 4); «Si responde»
//     corre en UN hilo, y su «Ir a {tarjeta}» retoma la salida en UN hilo y descarta los
//     congelados.
//   · Las raíces y las salidas salen del modelo (`raicesSalida`, `puertosDe`), no de una idea
//     propia: el puerto `par:<id>` es la flecha en paralelo.
// =============================================================================

import {
  type PasoGrafo, type NombresParaTexto, type HechosLead, type MedioAIStep, type FilaCondicion,
  claseDe, idDe, indicePorId, nodoPorId, normalizar, puertosDe, raicesSalida, raizRespuesta,
  textoEspera, textoRama, TOPE_HILOS, RESULTADO_SI_NO, paralelosDeResultado, elegirSalida, expandirPasoIA,
  extrasDeCaso, gruposDeRama, cumpleFila, textoFila, escenariosDeRespuesta, llegaTarde,
} from './flujo-grafo';

/**
 * ⚠️ LO QUE SE RECORRE ES EL FLUJO CON EL AI STEP EXPANDIDO (novena tanda, `expandirPasoIA`): el MISMO que
 * recorre el motor (`responderConGrafo`). Quien llama pasa los pasos como se ven en el lienzo —la forma
 * compacta, la que se valida (`frenoDelFlujo`) y se firma (`firmaFlujo`)— y cada función que CAMINA los
 * expande acá adentro: es idempotente y determinística (los cursores de un caso, `<nodo>~<caso>~r`, existen
 * igual en cada llamada). Con uno solo de los dos lados expandido, «Probar» entraba a un caso y cerraba
 * con «Esa tarjeta ya no existe», o contestaba distinto que el motor.
 */
// Con el MEDIO de la prueba (TikTok fase 0): por Instagram se expande el AI Step de Instagram, como en el motor.
const recorrido = <P extends PasoGrafo>(pasos: readonly P[], medio?: MedioAIStep): P[] => expandirPasoIA(pasos, { medio });
import { legadoAGrafo, tieneLegado, type EstrategiaLegada } from './flujo-legado';
import { TRIGGER_ETAPA, TRIGGER_ENTREGA, TRIGGER_ETIQUETA } from './nutricion-etapa';
import { PIPELINE_KIND } from './pipeline';
import { valoresVariablesLead, VARIABLES_LEAD } from './template-vars';
import { valoresDeEjemplo } from './variables-aviso';
import { textoConDatos } from './variables-del-lead';
// El HTML de un email (parte C de la tercera tanda): puro y sin `server-only`, como este módulo.
import { aplicarVariablesHtml, sanearHtmlEmail, htmlEmailVacio, TOPE_HTML_EMAIL } from './email-html-seguro';
// El remitente de la prueba real (sexta tanda): puro y sin imports, como este módulo.
import { sanearRemitente } from './email-remitente';

/** Topes: el motor corta a 20 saltos por corrida; acá además se cortan las vueltas infinitas. */
export const TOPE_SALTOS = 20;
export const TOPE_EVENTOS = 200;

/**
 * Un resultado de una condición, para elegir. `paralelos`: sus flechas en paralelo (cuarta tanda,
 * punto 8), que arrancan un hilo cada una al elegirlo (`elegir`). Ausente = ninguna.
 */
export type OpcionRama = { puerto: string; texto: string; destino: string | null; paralelos?: string[] };

/** Lo que pasa en el teléfono, de a uno. El panel decide CÓMO se ve (burbuja, píldora, chips). */
export type EventoSim<P extends PasoGrafo = PasoGrafo> =
  | { t: 'mensaje'; nodo: string; paso: P; enRespuesta: boolean }
  | { t: 'espera'; nodo: string; texto: string }
  /** `paso`: la tarjeta, para que el panel dibuje lo que hace (16/10/2026: la «MaKo en WhatsApp» le escribe al grupo). */
  | { t: 'accion'; nodo: string; texto: string; paso: P }
  | { t: 'salto'; nodo: string; texto: string }
  | { t: 'condicion'; nodo: string; opciones: OpcionRama[] }
  | { t: 'fin'; texto: string };

export type CasoElegido = { id: string | null; titulo: string; cuando: string };

/**
 * Un camino que corre: en qué tarjeta está y su reloj.
 *
 * `esperado`: la espera donde está parado YA se sumó al reloj y falta DECIRLA. La píldora
 * «⏳ Esperar 1 día» sale cuando a este hilo le vuelve a tocar —o sea, después de lo que los
 * otros hilos mandan mientras tanto—, justo antes de lo que sigue a la espera. Si saliera al
 * empezar a esperar, el email del día 0 aparecería DEBAJO de «Esperar 1 día» y se leería como
 * que llega al día siguiente.
 */
/**
 * `tarde`: llegó tarde a una espera «antes de la reunión» (`llegaTarde`, 16/10/2026) y `saltea`: lo que sigue a esa espera
 * no sale hasta la próxima, como en el motor (`resolverControl`).
 */
export type HiloSim = { cursor: string; reloj: number; esperado?: true; tarde?: true; saltea?: true };

export type EstadoSim = {
  /**
   * Los caminos vivos (vacío = no queda nada que correr). Sin flechas en paralelo hay uno solo,
   * como siempre. Un hilo que termina SALE del array: su `cursor` nunca es null.
   */
  hilos: HiloSim[];
  rama: 'salida' | 'respuesta';
  /**
   * La condición que espera que quien prueba elija, y en QUÉ hilo (su índice: mientras se elige
   * no corre nada, así que el array no cambia). Mientras no elija, no avanza ningún hilo.
   */
  eligiendo: { nodo: string; opciones: OpcionRama[]; hilo: number } | null;
  /** Una respuesta del lead pausó la salida: ya no corre (salvo un «Ir a» desde «Si responde»). */
  salidaPausada: boolean;
  /**
   * Los hilos de la salida que corrían cuando el lead contestó. Que conteste no corta nada (14/10/2026: lo dice la
   * condición «No contestó desde que entró», como en el motor). Esperan a que termine la respuesta y ahí vuelven a
   * correr; sin «Si responde», vuelven enseguida. En el motor corren a la vez: la prueba va de a un evento.
   */
  salidaQueSigue?: HiloSim[];
  terminado: boolean;
  saltos: number;
  eventos: number;
  /**
   * El minuto virtual de lo último que corrió. Una respuesta del lead llega «ahora»: el hilo de
   * «Si responde» (y el que retoma la salida con un «Ir a») nace con este reloj.
   */
  ahora: number;
  /** El caso de «Si responde» por el que se entró (para redactar «MaKo contesta»). */
  caso: CasoElegido | null;
  /**
   * Por qué MEDIO se prueba (TikTok fase 0, 14/10/2026): el AI Step que contesta es el de ese medio, como en el motor
   * (`asistirRespuesta` con `{ medio }`). Ausente = WhatsApp. Lo pone `iniciar`.
   */
  medio?: MedioAIStep;
  /**
   * EL MINUTO VIRTUAL DE LA PRÓXIMA REUNIÓN DEL LEAD (16/10/2026, Martín: «salen primero los "1 hora antes de la
   * reunión" cuando tendrían que salir antes los "⏳ Esperar 5 min"... si tenemos varias condiciones de "antes de...",
   * eso debe funcionar bien»). Con él, una espera «N antes de la reunión» lleva el reloj a la reunión menos N, como el
   * motor (`nutricion-grafo-motor.ts`: si eso ya pasó, sigue enseguida). Sin él, no lo mueve: no hay de qué descontar.
   * Lo pone `iniciar` desde los hechos del lead de la prueba (`reunionMinDe`).
   */
  reunionMin?: number;
};

/**
 * El minuto (contado desde que el lead entra) de su próxima reunión, de los hechos de la prueba (`hechosDeLeadNuevo`:
 * quien entra por una etapa de reunión tiene una mañana a esta hora). `undefined` = no tiene.
 */
export function reunionMinDe(hechos: HechosLead | null | undefined): number | undefined {
  const r = hechos?.catalogo?.lead?.proximaReunionMs;
  const ahora = hechos?.ahoraMs;
  if (r == null || ahora == null || !Number.isFinite(r) || !Number.isFinite(ahora)) return undefined;
  return Math.max(0, Math.round((r - ahora) / 60_000));
}

/** Los nombres que el texto de una píldora necesita y este módulo no tiene. */
export type NombresSim = NombresParaTexto & {
  secuencia?: (id: number) => string | null;
  accion?: (operacion: string) => string | null;
};

// ── El flujo que se prueba ─────────────────────────────────────────────────────

/**
 * El flujo a recorrer. Una secuencia de ANTES (delays en el paso, `requiere`, casos en la
 * estrategia) se pasa a tarjetas con `legadoAGrafo`, que es lo que hace el lienzo al abrirla y lo
 * que corre el motor: así el simulador no tiene una segunda idea de qué significaba.
 *
 * ⚠️ SÓLO SI TODAVÍA NO ES UN FLUJO. Un flujo que ya tiene tarjetas de control (`nodo`) se
 * normaliza y nada más: convertirlo otra vez con una estrategia sin limpiar le agregaría una
 * SEGUNDA tarjeta «Si responde» con los casos viejos.
 */
export function flujoParaProbar<P extends PasoGrafo>(
  pasos: readonly P[],
  est: EstrategiaLegada,
  op: { idDeClave?: (clave: string) => number | null } = {},
): { pasos: P[]; notas: string[] } {
  const yaEsFlujo = pasos.some((p) => p?.nodo != null);
  if (!yaEsFlujo && tieneLegado(pasos, est)) {
    const r = legadoAGrafo(pasos, est, { idDeClave: op.idDeClave });
    return { pasos: r.pasos, notas: r.notas };
  }
  return { pasos: normalizar(pasos), notas: [] };
}

/** Una huella corta del flujo, para decir «Cambió» si se edita mientras se prueba. */
export function firmaFlujo(pasos: readonly unknown[]): string {
  const s = JSON.stringify(pasos ?? []);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

// ── El lead de ejemplo ─────────────────────────────────────────────────────────

// ── El lead RECIÉN LLEGADO: por dónde sigue una condición en la prueba ─────────────────────────
// Pedido de Martín (09/10/2026, quinta tanda, punto 1): «al darle probar en la automatización de
// bienvenida, no salió el mensaje que debería salir en la prueba». MEDIDO sobre la Bienvenida del ws1
// (docs/relevo/chatbot-secuencias.json, M2) con la regla de la cuarta tanda —cada condición sigue por
// su PRIMERA rama, el «Sí»—: la prueba mostraba «Esperar 1 h», entraba por el «Sí» de «Agendó» y
// saltaba a OTRA automatización («↪ Sigue en «Agendó: confirmar y preparar»»). Ningún mensaje. No era
// la espera (una espera ya no espera: se dice y se sigue): era la rama.
//
// La regla nueva: «Probar» corre como un lead que ACABA de entrar por el CRON —sin agenda, sin pago,
// sin respuestas, llegado ahora— y cada condición se decide con la MISMA función del motor
// (`elegirSalida`, lib/flujo-grafo.ts), sin botones (cuarta tanda, puntos 3 y 17). Lo que la prueba
// misma produce también cuenta: después de un mensaje, «ya le escribimos» es verdad; después de
// contestar como el lead, «respondió» también.
//
// ⚠️ LO QUE NO PASÓ, NO PASÓ (ceros), y lo que NO SE SABE de un lead nuevo queda sin saber: el bloque
// `catalogo` va con ceros y listas vacías (ni reuniones, ni pagos, ni curso, ni clics), no ausente —
// ausente, una condición negada del catálogo («No vio el video») nunca se cumpliría y la prueba
// seguiría por el «Si no» de algo que un lead nuevo sí cumple—.

/** Lo que el CRON dice de quién entra, y lo que ya pasó en ESTA prueba. */
export type LeadNuevoPrueba = {
  /** La etapa por la que entra (CRON por etapa o por entrega). */
  etapa?: string | null;
  /** El embudo de esa etapa (CRON por etapa de un producto). */
  funnelId?: number | null;
  /** El producto de cuya ENTREGA cuelga (CRON por etapa de entrega). */
  productoId?: number | null;
  /** La etiqueta que lo dispara (CRON por etiqueta): un lead que entra por ahí la TIENE. */
  etiquetaId?: number | null;
  /** Ya le salió un mensaje en esta prueba. */
  yaContactado?: boolean;
  /** Quien prueba escribió como el lead. */
  respondio?: boolean;
  /**
   * Si el lead de la prueba tiene teléfono / email. Ausente = sí (lo de siempre). Lo elige
   * `contactoParaProbar` según el canal que se prueba: de un lead nuevo, es lo único que NO se sabe.
   */
  tieneTelefono?: boolean;
  tieneEmail?: boolean;
  ahoraMs?: number;
};

/**
 * Quién entra según el CRON: por una etapa (del embudo o de la entrega) entra EN esa etapa; por una
 * etiqueta, con esa etiqueta puesta. Por otra cosa (a mano, un evento) no se sabe nada de su etapa.
 */
export function leadNuevoDelCron(s: {
  trigger_tipo?: string | null; etapa?: string | null; funnel_id?: number | null; producto_id?: number | null; etiqueta_id?: number | null;
}): LeadNuevoPrueba {
  if (s.trigger_tipo === TRIGGER_ETAPA) return { etapa: s.etapa ?? null, funnelId: s.funnel_id ?? null };
  if (s.trigger_tipo === TRIGGER_ENTREGA) return { etapa: s.etapa ?? null, productoId: s.producto_id ?? null };
  if (s.trigger_tipo === TRIGGER_ETIQUETA) return { etiquetaId: s.etiqueta_id ?? null };
  return {};
}

/** Los hechos de un lead que acaba de entrar: lo que el motor sabría de él en su primer minuto. */
export function hechosDeLeadNuevo(c: LeadNuevoPrueba = {}): HechosLead {
  const ahoraMs = c.ahoraMs ?? Date.now();
  const etapa = c.etapa ? String(c.etapa) : null;
  const funnel = c.funnelId != null && Number.isFinite(Number(c.funnelId)) ? Number(c.funnelId) : null;
  const producto = c.productoId != null && Number.isFinite(Number(c.productoId)) ? Number(c.productoId) : null;
  const etiqueta = c.etiquetaId != null && Number.isFinite(Number(c.etiquetaId)) ? Number(c.etiquetaId) : null;
  // QUIEN ENTRA POR UNA ETAPA DE REUNIÓN («Agenda R1») TIENE UNA REUNIÓN (14/10/2026): mañana, a esta hora. Sin esto,
  // «Su reunión sigue en pie» (la condición que reemplaza la regla escondida «la reunión ya pasó») daba que no, y
  // «Probar» de «Un Lead Agendó Llamada» no mostraba nada. Sólo las etapas de la casa (`PIPELINE_KIND`).
  const reunionMs = producto == null && etapa && PIPELINE_KIND[etapa] === 'reunion' ? ahoraMs + 24 * 3_600_000 : null;
  return {
    etiquetas: new Set(etiqueta != null ? [etiqueta] : []),
    // Por la entrega, la etapa es del kanban de ENTREGA (`catalogo.entrega`), no de la casa.
    etapa: producto == null ? etapa : null,
    // Entra EN la etapa del CRON: «Sigue en la etapa del CRON» se cumple para él.
    ...(etapa ? { etapasDelCron: [producto != null ? { tipo: 'entrega' as const, productoId: producto, keys: [etapa] } : { tipo: 'venta' as const, funnelId: funnel, keys: [etapa] }] } : {}),
    ...(funnel != null && etapa && producto == null ? { etapasPorProducto: new Map([[funnel, etapa]]) } : {}),
    agendo: reunionMs != null,
    pago: false,
    yaContactado: !!c.yaContactado,
    respondio: !!c.respondio,
    // En «Probar», el lead contestó desde que entró si quien prueba escribió algo (la condición `contesto`).
    contestoEnEsta: !!c.respondio,
    // En una prueba nadie del equipo contesta en el grupo (#849): «El equipo no contestó» se cumple y se ve ese camino.
    equipoContestoEnEsta: false,
    creadoMs: ahoraMs,
    tieneTelefono: c.tieneTelefono !== false,
    tieneEmail: c.tieneEmail !== false,
    ahoraMs,
    catalogo: {
      lead: {
        origen: null, estado: null, calificado: null, deFormularioMeta: false, conVisitante: false, campana: null,
        emailBaja: false, ventaTipo: null, tieneFechaAgenda: false,
        r1: { fechaMs: reunionMs, asistio: null, finMs: reunionMs }, r2: { fechaMs: null, asistio: null },
        cerro: null, tieneFechaCierre: false, confirmoCompra: false, proximaReunionMs: reunionMs,
      },
      vsl: { plays: 0, maxPct: null },
      clics: 0,
      respuestas: '',
      pagos: { pagadas: 0, vencidas: 0, cuotas: new Map() },
      curso: { completas: new Set(), enviadas: new Set(), aprobadas: new Set(), modulosCompletos: new Set(), avance: new Map() },
      acceso: null,
      comunidad: { posts: 0, comentarios: 0, comentoPosts: new Set() },
      entrega: new Set(producto != null && etapa ? [`${producto}:${etapa}`] : []),
      estadoCliente: 'activo',
    },
  };
}

/**
 * La condición que espera elección, decidida como la decidiría el motor con este lead
 * (`elegirSalida`). `opcion`: por cuál siguió (null = la tarjeta ya no está: el hilo sigue por el «Si
 * no», que es lo que el motor hace con lo que no sabe).
 */
export function elegirComoLead(pasos: readonly PasoGrafo[], estado: EstadoSim, hechos: HechosLead): { estado: EstadoSim; opcion: OpcionRama | null } {
  const e = estado.eligiendo;
  if (!e) return { estado, opcion: null };
  const p = nodoPorId(recorrido(pasos, estado.medio), e.nodo);
  const puerto = p ? elegirSalida(p, hechos).puerto : RESULTADO_SI_NO;
  const opcion = e.opciones.find((o) => o.puerto === puerto) ?? e.opciones.find((o) => o.puerto === RESULTADO_SI_NO) ?? null;
  return { estado: opcion ? elegir(estado, opcion.puerto) : { ...estado, eligiendo: null }, opcion };
}

/**
 * El lead con el que se resuelven las variables: los EJEMPLOS del catálogo del motor
 * (lib/template-vars.ts), no un «Juan / Acme SRL» propio. El simulador viejo tenía su propio
 * reemplazo y dejaba crudos `{{negocio}}` y `{{nombre_completo}}`, que el motor sí resuelve.
 */
const ejemplo = (key: string): string => VARIABLES_LEAD.find((v) => v.key === key)?.ejemplo ?? '';
export const LEAD_DE_EJEMPLO = { nombre: ejemplo('nombre_completo'), empresa: ejemplo('empresa') };

/**
 * LOS DATOS «{ }» DE UNA PRUEBA, en UN lugar: los EJEMPLOS del catálogo entero (`valoresDeEjemplo`,
 * lib/variables-aviso.ts) debajo, y el lead de la prueba encima (gana: es lo que la prueba sabe).
 *
 * ⚠️ DESDE LA SEXTA TANDA EL MOTOR RESUELVE EL CATÁLOGO ENTERO (`datosParaElLead`), y «Probar» seguía con
 * los cinco de antes: la etapa, la reunión o el curso salían CRUDOS en el simulador y en la prueba real,
 * y se leía como que el dato no funcionaba. Lo usan `textoDeEjemplo` (el simulador) y `probarSecuencia`
 * (lib/setting-secuencias.ts, la prueba real).
 *
 * El NOMBRE DEL NEGOCIO no sale de un ejemplo: es el real o queda crudo, como en el motor (un nombre de
 * negocio inventado en la burbuja se leería como el del cliente).
 */
export function datosDeEjemplo(lead: { nombre?: string | null; empresa?: string | null }, negocio?: string | null): Record<string, string> {
  const { negocio: _sinNegocio, ...ejemplos } = valoresDeEjemplo();
  void _sinNegocio;
  return { ...ejemplos, ...valoresVariablesLead(lead, { negocio }) };
}

/**
 * El texto tal como le llegaría al lead de ejemplo. Lo desconocido queda CRUDO, como en el motor. `extra`: los
 * datos propios de quien manda (el recordatorio de la reunión: `EJEMPLOS_RECORDATORIO`; los de un evento de MaKo),
 * que pisan a los del motor.
 *
 * ⚠️ CON `textoConDatos` (lib/variables-del-lead.ts, undécima tanda), LA MISMA FUNCIÓN QUE EL ENVÍO: un renglón que
 * nombra un dato del catálogo SIN valor se va entero (`sinRenglonesVacios`). Con `aplicarVariables` sola, «Probar»
 * mostraba ese renglón con el token crudo y el lead no lo recibía. El ejemplo que más se nota: `{{negocio}}` sin el
 * nombre del negocio (no se inventa uno: ver `datosDeEjemplo`) se lleva su renglón, como en el envío.
 */
export function textoDeEjemplo(texto: string, negocio?: string | null, extra?: Record<string, string>): string {
  return textoConDatos(texto ?? '', { ...datosDeEjemplo(LEAD_DE_EJEMPLO, negocio), ...(extra ?? {}) });
}

/**
 * Un email del flujo tal como lo ve el lead en su bandeja: el asunto, la vista previa (el
 * `preheader`, lo gris que Gmail pone al lado del asunto) y el cuerpo, con las variables del lead
 * de ejemplo. «Probar» lo dibuja como un MAIL y no como una burbuja de WhatsApp: un email que se
 * ve como un WhatsApp no prueba cómo llega (decisión 11 de la segunda tanda).
 *
 * Vacío = vacío: el panel decide qué rótulo poner («Sin asunto»), y la vista previa ausente no se
 * reemplaza por el principio del cuerpo, que ya se ve debajo.
 *
 * `html`: el cuerpo del editor rico (`cuerpo_html`, parte C de la tercera tanda) con las variables
 * puestas POR CONTEXTO (`aplicarVariablesHtml`: escapadas en el texto, codificadas en un link), que es
 * como lo pone el envío. '' = el paso no tiene HTML (un email de antes): se dibuja el `cuerpo`.
 */
export function correoDeEjemplo(
  p: { asunto?: string | null; preheader?: string | null; cuerpo?: string | null; cuerpo_html?: string | null },
  negocio?: string | null,
): { asunto: string; vistaPrevia: string; cuerpo: string; html: string } {
  return {
    asunto: textoDeEjemplo(p.asunto ?? '', negocio).trim(),
    vistaPrevia: textoDeEjemplo(p.preheader ?? '', negocio).trim(),
    cuerpo: textoDeEjemplo(p.cuerpo ?? '', negocio),
    html: p.cuerpo_html ? aplicarVariablesHtml(p.cuerpo_html, datosDeEjemplo(LEAD_DE_EJEMPLO, negocio)) : '',
  };
}

// ── Recorrer ───────────────────────────────────────────────────────────────────

export function iniciar(pasos: readonly PasoGrafo[], op: { medio?: MedioAIStep; reunionMin?: number } = {}): EstadoSim {
  // Un hilo por raíz: la principal y cada flecha en paralelo del CRON, todas en el minuto 0.
  const hilos = raicesSalida(pasos).slice(0, TOPE_HILOS).map((cursor) => ({ cursor, reloj: 0 }));
  return {
    hilos, rama: 'salida', eligiendo: null, salidaPausada: false, terminado: false, saltos: 0, eventos: 0, ahora: 0, caso: null,
    ...(op.medio && op.medio !== 'whatsapp' ? { medio: op.medio } : {}),
    ...(op.reunionMin != null ? { reunionMin: op.reunionMin } : {}),
  };
}

/** El hilo que corre ahora: el de reloj más bajo; en un empate, el primero del array. */
export function proximoHilo(hilos: readonly HiloSim[]): number {
  let k = 0;
  for (let i = 1; i < hilos.length; i++) if (hilos[i].reloj < hilos[k].reloj) k = i;
  return k;
}

const nombreAccion = (p: PasoGrafo, n: NombresSim): string => {
  const a = p.accion as { operacion?: unknown } | null | undefined;
  const op = typeof a?.operacion === 'string' ? a.operacion : '';
  if (!op) return 'Acción sin elegir';
  return n.accion?.(op) ?? op.replace(/_/g, ' ');
};

type Paso<P extends PasoGrafo> = { evento: EventoSim<P> | null; estado: EstadoSim };

function fin<P extends PasoGrafo>(estado: EstadoSim, texto: string): Paso<P> {
  return { evento: { t: 'fin', texto }, estado: { ...estado, hilos: [], eligiendo: null, terminado: true } };
}

/**
 * Las salidas de una tarjeta de UNA salida, leídas de sus PUERTOS (el modelo): la de siempre
 * (`sig`) y las flechas en paralelo (`par:<id>`).
 */
function salidasDe(pasos: readonly PasoGrafo[], i: number): { sig: string | null; paralelos: string[] } {
  const pts = puertosDe(pasos, i);
  return {
    sig: pts.find((pt) => pt.puerto === 'sig')?.destino ?? null,
    paralelos: pts.filter((pt) => pt.puerto.startsWith('par:') && pt.destino).map((pt) => pt.destino as string),
  };
}

/**
 * El hilo `k` terminó su tarjeta: sigue en `sig` (o sale del array si no hay nada después) y
 * cada flecha en paralelo agrega un hilo AL FINAL con el mismo reloj.
 *
 * ⚠️ El tope de hilos vivos (`TOPE_HILOS`) se respeta acá aunque `validarGrafo` ya lo exija: lo
 * que se prueba es lo LOCAL, sin publicar, y puede ser un flujo que no se podría guardar. Lo que
 * no entra no se abre; el tope de eventos corta el resto.
 */
function seguir(hilos: readonly HiloSim[], k: number, sig: string | null, paralelos: readonly string[], reloj: number, saltea = false): HiloSim[] {
  const out = hilos.slice();
  if (sig) out[k] = saltea ? { cursor: sig, reloj, saltea: true } : { cursor: sig, reloj };
  else out.splice(k, 1);
  for (const d of paralelos) if (out.length < TOPE_HILOS) out.push({ cursor: d, reloj });
  return out;
}

/**
 * El hilo `k` se cierra sin decir nada (una tarjeta que ya no existe, un «Ir a» sin destino). Si
 * era el último, la prueba termina con `texto`.
 */
function cerrarHilo<P extends PasoGrafo>(estado: EstadoSim, k: number, texto: string): Paso<P> {
  const hilos = estado.hilos.filter((_, j) => j !== k);
  if (!hilos.length) return fin(estado, texto);
  return { evento: null, estado: { ...estado, hilos } };
}

/** Lo que dice la pastilla de una espera «antes de la reunión» a la que se llegó tarde (`llegaTarde`). */
export const NO_SALE_AGENDO_CERCA = 'agendó más cerca: no sale';

/**
 * Corre UNA tarjeta del hilo `k`. `evento: null` = avanzó sin nada que mostrar (contó una espera,
 * cerró un hilo en silencio): `siguiente` vuelve a elegir hilo.
 */
function correrHilo<P extends PasoGrafo>(pasos: readonly P[], estado: EstadoSim, k: number, nombres: NombresSim): Paso<P> {
  const h = estado.hilos[k];
  const st: EstadoSim = { ...estado, ahora: h.reloj };
  const i = indicePorId(pasos, h.cursor);
  if (i < 0) return cerrarHilo(st, k, 'Esa tarjeta ya no existe');
  const p = pasos[i];
  const id = idDe(p, i);
  // `eventos` cuenta lo que se MUESTRA: lo que avanza en silencio (`cerrarHilo`, contar una
  // espera) parte de `st`.
  const base: EstadoSim = { ...st, eventos: st.eventos + 1 };
  // Adentro de «Si responde» no se reparte (no se puede guardar: `validarGrafo`), y la respuesta
  // corre en UN hilo, como en el motor.
  const avanzar = (reloj: number): HiloSim[] => {
    const s = salidasDe(pasos, i);
    return seguir(st.hilos, k, s.sig, st.rama === 'respuesta' ? [] : s.paralelos, reloj);
  };
  // «SI AGENDA MÁS CERCA» (16/10/2026): lo que sigue a una espera a la que se llegó tarde no sale, hasta la próxima.
  if (h.saltea && (claseDe(p) === 'mensaje' || claseDe(p) === 'accion')) {
    const hilos = seguir(st.hilos, k, salidasDe(pasos, i).sig, [], h.reloj, true);
    return hilos.length ? { evento: null, estado: { ...st, hilos } } : fin(st, 'Fin');
  }
  switch (claseDe(p)) {
    case 'mensaje':
      return { evento: { t: 'mensaje', nodo: id, paso: p, enRespuesta: st.rama === 'respuesta' }, estado: { ...base, hilos: avanzar(h.reloj) } };
    case 'accion':
      // No se ejecuta: probar no puede mover un lead ni crear una tarea de verdad.
      return { evento: { t: 'accion', nodo: id, texto: `⚡ ${nombreAccion(p, nombres)}`, paso: p }, estado: { ...base, hilos: avanzar(h.reloj) } };
    case 'esperar': {
      if (!h.esperado) {
        // No espera: suma al reloj de SU hilo y lo dice cuando le vuelve a tocar (ver `HiloSim`).
        // «N antes de la reunión» lleva el reloj a la reunión menos N, como el motor; si eso ya pasó, enseguida
        // (16/10/2026: sin esto quedaba en el minuto 0 y salía antes que el «Esperar 5 min» de otro camino). Sin
        // reunión no lo mueve: un número inventado ordenaría los hilos con un dato que no existe.
        const min = Math.max(0, Number(p.espera?.minutos) || 0);
        const reloj = p.espera?.modo === 'tiempo' ? h.reloj + min
          : st.reunionMin != null ? Math.max(h.reloj, st.reunionMin - min) : h.reloj;
        const tarde = st.reunionMin != null && llegaTarde(p.espera, st.reunionMin - h.reloj);
        const hilos = st.hilos.slice();
        hilos[k] = tarde ? { cursor: h.cursor, reloj, esperado: true, tarde: true } : { cursor: h.cursor, reloj, esperado: true };
        return { evento: null, estado: { ...st, hilos } };
      }
      // Llegó tarde: se dice, y lo de esta espera (y sus flechas en paralelo) no sale.
      if (h.tarde) {
        const hilos = seguir(st.hilos, k, salidasDe(pasos, i).sig, [], h.reloj, true);
        return { evento: { t: 'espera', nodo: id, texto: `⏳ ${textoEspera(p.espera)} · ${NO_SALE_AGENDO_CERCA}` }, estado: { ...base, hilos } };
      }
      return { evento: { t: 'espera', nodo: id, texto: `⏳ ${textoEspera(p.espera)}` }, estado: { ...base, hilos: avanzar(h.reloj) } };
    }
    case 'condicion': {
      // Las flechas en paralelo de cada resultado viajan con su opción (cuarta tanda, punto 8): las
      // lee la MISMA función que el motor (`paralelosDeResultado`), y `elegir` las abre.
      const conParalelos = (o: OpcionRama): OpcionRama => {
        const par = paralelosDeResultado(p, o.puerto);
        return par.length ? { ...o, paralelos: par } : o;
      };
      const opciones: OpcionRama[] = [
        ...(p.ramas ?? []).map((r) => ({ puerto: r.id, texto: textoRama(r, nombres), destino: r.siguiente ?? null })),
        { puerto: RESULTADO_SI_NO, texto: 'Si no', destino: p.si_no ?? null },
      ].map(conParalelos);
      return { evento: { t: 'condicion', nodo: id, opciones }, estado: { ...base, eligiendo: { nodo: id, opciones, hilo: k } } };
    }
    case 'respuesta':
      // A «Si responde» se entra por una respuesta del lead, no caminando (y no se puede guardar
      // una flecha hacia ella). Se cierra ese hilo; si era el último, se dice qué falta.
      return cerrarHilo(st, k, 'Espera la respuesta');
    case 'inicio':
      // El CRON no es una tarjeta del camino: nadie puede seguir en él (`validarGrafo`).
      return cerrarHilo(st, k, 'Fin');
    case 'ir_a': {
      const d = p.destino;
      if (!d) return cerrarHilo(st, k, 'Fin');
      if ('secuencia_id' in d) {
        // Cierra SU hilo (el motor la inscribe en la otra); los demás siguen.
        const nom = nombres.secuencia?.(d.secuencia_id) ?? 'otra automatización';
        const hilos = st.hilos.filter((_, j) => j !== k);
        return { evento: { t: 'salto', nodo: id, texto: `↪ Sigue en «${nom}»` }, estado: { ...base, hilos, terminado: hilos.length === 0 } };
      }
      const saltos = st.saltos + 1;
      if (saltos > TOPE_SALTOS) return fin(base, 'Se repite: fin de la prueba');
      const evento: EventoSim<P> = { t: 'salto', nodo: id, texto: '↪ Ir a otra tarjeta' };
      if (st.rama === 'respuesta') {
        // Desde «Si responde», un salto a una tarjeta RETOMA la salida ahí en UN hilo (el motor
        // hace lo mismo y descarta los congelados: retomar todo junto le mandaría varios mensajes
        // seguidos a alguien que acaba de escribir).
        return { evento, estado: { ...base, saltos, hilos: [{ cursor: d.nodo, reloj: h.reloj }], rama: 'salida', salidaPausada: false, salidaQueSigue: undefined } };
      }
      const hilos = st.hilos.slice();
      hilos[k] = { cursor: d.nodo, reloj: h.reloj };
      return { evento, estado: { ...base, saltos, hilos } };
    }
  }
}

/** Cuántas vueltas sin evento puede dar `siguiente`: cada hilo cuenta una espera o se cierra. */
const TOPE_VUELTAS_MUDAS = TOPE_HILOS * 2 + 2;

/**
 * El próximo evento. `null` cuando no hay nada que correr: terminó, espera una elección, o la
 * salida está pausada. Un evento por llamada: el panel pone el «escribiendo…» y la pausa entre
 * uno y otro.
 */
export function siguiente<P extends PasoGrafo>(
  pasosIn: readonly P[],
  estado: EstadoSim,
  nombres: NombresSim = {},
): Paso<P> {
  if (estado.terminado || estado.eligiendo) return { evento: null, estado };
  if (estado.rama === 'salida' && estado.salidaPausada) return { evento: null, estado };
  const pasos = recorrido(pasosIn, estado.medio);
  let st = estado;
  for (let vuelta = 0; vuelta <= TOPE_VUELTAS_MUDAS; vuelta++) {
    if (!st.hilos.length) {
      // Terminó la respuesta y hay caminos de la salida que SIGUEN cuando el lead contesta: vuelven a correr.
      if (st.rama === 'respuesta' && st.salidaQueSigue?.length) { st = reanudarSalida(st); continue; }
      return fin(st, st.rama === 'respuesta' ? 'Fin de la respuesta' : st.eventos === 0 ? 'Sin tarjetas' : 'Fin');
    }
    if (st.eventos >= TOPE_EVENTOS) return fin(st, 'Se repite: fin de la prueba');
    const r = correrHilo(pasos, st, proximoHilo(st.hilos), nombres);
    if (r.evento || r.estado.terminado) return r;
    st = r.estado;
  }
  return fin(st, 'Se repite: fin de la prueba');
}

/**
 * Quien prueba elige por qué rama sigue una condición: se mueve SU hilo, no otro. Y cada flecha en
 * paralelo de ESE resultado abre un hilo con el mismo reloj (cuarta tanda, punto 8: «Probar» sigue
 * solo por el «Sí», y con esto se ven también el email y el WhatsApp que salen a la vez). Adentro de
 * «Si responde» no se reparte, como en el motor.
 */
export function elegir(estado: EstadoSim, puerto: string): EstadoSim {
  const e = estado.eligiendo;
  if (!e) return estado;
  const o = e.opciones.find((x) => x.puerto === puerto);
  if (!o) return estado;
  const h = estado.hilos[e.hilo];
  if (!h) return { ...estado, eligiendo: null };
  const paralelos = estado.rama === 'respuesta' ? [] : (o.paralelos ?? []);
  // Una condición en lo que se saltea («Si agenda más cerca») se decide igual, y lo de después sigue salteado.
  return { ...estado, eligiendo: null, hilos: seguir(estado.hilos, e.hilo, o.destino, paralelos, h.reloj, h.saltea === true) };
}

// ── LOS ESCENARIOS DE «PROBAR» (14/10/2026) ─────────────────────────────────────────────────────────
// Martín: «En "Probar" para las automatizaciones que tengas varios casos, varias condiciones, ese chat de "probar"
// debería al lado tener la sidebar de diferentes contactos de WhatsApp o de IG... y justamente que ahí caigan los
// diferentes escenarios para la prueba. Y si puedo por WhatsApp, debo elegir un escenario». Un ESCENARIO es un camino
// por las condiciones de la salida: qué resultado sale en cada una. Se arman recorriendo el MISMO simulador que la
// prueba (`siguiente` + `elegir`), así que salen sólo los caminos que la prueba puede recorrer de verdad.

//
// ⚠️ 15/10/2026, Martín: «Pusiste una cantidad impresionante de chats en "Un lead agendó llamada", revisa por qué tantos
// casos». Medido en #213: 8 escenarios y uno afuera, casi todos IMPOSIBLES («No: Su reunión sigue en pie · … · Su
// reunión sigue en pie»). Cada condición se abría por su cuenta, aunque dos preguntaran lo MISMO, así que salía el
// producto de todas. Ahora un escenario es una combinación de HECHOS (cada fila sin su «No», `claveHecho`): el mismo
// hecho vale lo mismo en todo el flujo, y dos combinaciones que en el chat se ven igual (los mismos mensajes) son un
// solo escenario. #213 pasó de 8 + 1 a los que se distinguen. Y «En ninguno de esos casos el LEAD responde para
// simular el AI Step»: con un AI Step, un escenario más por cada caso, en el que el lead contesta (`respuesta`).

/** Un camino por las condiciones: el resultado (`puerto`) de cada una, y cómo se dice. */
export type EscenarioPrueba = {
  /** Estable: las elecciones en orden ("c1=si|c2=__si_no"); con el lead que contesta, más «#<caso>». */
  id: string;
  elecciones: Readonly<Record<string, string>>;
  /** Lo elegido en cada condición, en el orden en que se pasó. Un «Si no» dice de qué. */
  pasos: readonly string[];
  /** Cuántos mensajes le llegan por este camino (los que `cuenta` cuenta: los del canal que se prueba). */
  mensajes: number;
  /** CUÁNDO CAE este caso, en palabras («Ya le escribiste», «No: Su reunión sigue en pie»): lo dice el chat al empezar. */
  cuando: readonly string[];
  /** El lead CONTESTA (para probar el AI Step): el caso al que apunta. Ausente = el lead no escribe. */
  respuesta?: { casoId: string; titulo: string; cuando: string };
};

/** Hasta cuántos escenarios por la salida (la barra se lee de un vistazo). */
export const TOPE_ESCENARIOS = 8;
/** Y hasta cuántos en los que el lead contesta (uno por caso del AI Step). */
export const TOPE_RESPUESTAS = 4;

/** Una fila sin su «No» ni su unión: el HECHO que pregunta. Dos filas con la misma clave preguntan lo mismo. */
function claveHecho(f: FilaCondicion): string {
  return JSON.stringify([f.campo, f.valor ?? null, f.funnel_id ?? null, f.op ?? null, f.ref ?? null]);
}

/** Por dónde sale una condición con estos hechos: la primera rama que se cumple (como `elegirSalida`), o «si no». */
function salidaConHechos(p: PasoGrafo, hechos: ReadonlyMap<string, boolean>): string {
  for (const r of p.ramas ?? []) {
    const grupos = gruposDeRama(r);
    if (grupos.some((g) => g.every((f) => (hechos.get(claveHecho(f)) ?? false) !== !!f.no))) return r.id;
  }
  return RESULTADO_SI_NO;
}

/** Cómo se dice un resultado: el texto de su rama; el «Si no», contra la primera rama. */
function textoDeEleccion(o: OpcionRama, opciones: readonly OpcionRama[]): string {
  if (o.puerto !== RESULTADO_SI_NO) return o.texto;
  const otra = opciones.find((x) => x.puerto !== RESULTADO_SI_NO);
  return otra ? `No: ${otra.texto}` : 'Si no';
}

/**
 * LOS ESCENARIOS de un flujo: cada combinación de los HECHOS que preguntan sus condiciones, recorrida con el MISMO
 * simulador, y una sola vez por lo que se VE (los mensajes que llegan), hasta `TOPE_ESCENARIOS`. Los hechos se abren
 * recién cuando una condición los pregunta, y con `hechos` (el lead recién llegado de la prueba) primero va el valor
 * que tiene ese lead: el primer escenario es el que elegiría el motor. Sin condiciones, uno solo (vacío). Con un AI Step
 * que escucha por este medio, después, uno por caso (hasta `TOPE_RESPUESTAS`) en el que el lead CONTESTA, sobre el
 * primero. `faltan`: cuántos quedaron afuera del tope.
 */
export function escenariosDePrueba(
  pasosIn: readonly PasoGrafo[],
  o: { hechos?: HechosLead; nombres?: NombresSim; cuenta?: (p: PasoGrafo) => boolean; medio?: MedioAIStep } = {},
): { escenarios: EscenarioPrueba[]; faltan: number } {
  const pasos = recorrido(pasosIn, o.medio);
  type Hecho = { fila: FilaCondicion; si: boolean };
  /** Cada escenario con los hechos que lo armaron: el «cuándo» se escribe al final, con los que lo DISTINGUEN. */
  const crudos: Array<{ e: Omit<EscenarioPrueba, 'cuando'>; hechos: ReadonlyMap<string, Hecho> }> = [];
  /** Lo que se ve en el chat de cada escenario ya armado: dos con los mismos mensajes son uno. */
  const vistos = new Set<string>();
  let faltan = 0;
  const cerrar = (elecciones: Record<string, string>, dichos: string[], mensajes: string[], hechos: ReadonlyMap<string, Hecho>) => {
    const clave = mensajes.join('>');
    if (vistos.has(clave)) return;
    if (crudos.length >= TOPE_ESCENARIOS) { faltan += 1; return; }
    vistos.add(clave);
    const id = Object.entries(elecciones).map(([n, p]) => `${n}=${p}`).join('|');
    crudos.push({ e: { id, elecciones, pasos: dichos, mensajes: mensajes.length }, hechos });
  };
  const visitar = (inicio: EstadoSim, hechos: ReadonlyMap<string, Hecho>, elecciones: Record<string, string>, dichos: string[], mensajes: string[]): void => {
    let st = inicio;
    let elec = elecciones;
    let dich = dichos;
    const vistosAca = [...mensajes];
    for (let vuelta = 0; vuelta <= TOPE_EVENTOS; vuelta++) {
      const e = st.eligiendo;
      if (e) {
        const p = nodoPorId(pasos, e.nodo);
        // El primer hecho que esta condición pregunta y todavía no tiene valor: se abre en dos (primero el del lead).
        const falta = (p?.ramas ?? []).flatMap((r) => r.filas ?? []).find((f) => !hechos.has(claveHecho(f)));
        if (falta) {
          const base: FilaCondicion = { ...falta, no: false };
          const delLead = o.hechos ? cumpleFila(base, o.hechos) : false;
          for (const si of [delLead, !delLead]) {
            if (crudos.length >= TOPE_ESCENARIOS) { faltan += 1; continue; }
            visitar(st, new Map([...hechos, [claveHecho(falta), { fila: base, si }]]), elec, dich, vistosAca);
          }
          return;
        }
        const valores = new Map([...hechos].map(([k, h]) => [k, h.si] as const));
        const puerto = p ? salidaConHechos(p, valores) : RESULTADO_SI_NO;
        const op = e.opciones.find((x) => x.puerto === puerto) ?? e.opciones.find((x) => x.puerto === RESULTADO_SI_NO) ?? null;
        if (!op) break;
        elec = { ...elec, [e.nodo]: op.puerto };
        dich = [...dich, textoDeEleccion(op, e.opciones)];
        st = elegir(st, op.puerto);
        continue;
      }
      const r = siguiente(pasosIn, st, o.nombres);
      if (!r.evento || r.evento.t === 'fin') break;
      if (r.evento.t === 'mensaje' && (!o.cuenta || o.cuenta(r.evento.paso))) vistosAca.push(r.evento.nodo);
      st = r.estado;
    }
    cerrar(elec, dich, vistosAca, hechos);
  };
  visitar(iniciar(pasosIn, { medio: o.medio, reunionMin: reunionMinDe(o.hechos) }), new Map(), {}, [], []);

  // CUÁNDO CAE CADA UNO, sólo con lo que lo DISTINGUE (visto en producción el 15/10/2026: «Tiene WhatsApp · Tiene email»
  // en los seis casos alargaban la píldora sin decir nada). Un hecho que vale lo mismo en todos los escenarios no va.
  const claves = new Set(crudos.flatMap((c) => [...c.hechos.keys()]));
  const distinguen = new Set([...claves].filter((k) => new Set(crudos.map((c) => c.hechos.get(k)?.si)).size > 1));
  const out: EscenarioPrueba[] = crudos.map((c) => ({
    ...c.e,
    cuando: [...new Set([...c.hechos].filter(([k]) => distinguen.has(k)).map(([, h]) => textoFila({ ...h.fila, no: !h.si }, o.nombres)))],
  }));

  // EL LEAD CONTESTA (15/10/2026): un escenario por caso del AI Step que escucha por este medio. El panel le hace escribir
  // al lead algo de ese caso, y lo demás es la prueba de siempre (clasifica y contesta). ⚠️ Sobre el primer camino CON
  // mensajes: visto en producción, con el primero sin ninguno el lead no tenía qué contestar y la prueba terminaba en «Fin».
  const primero = out.find((e) => e.mensajes > 0) ?? out[0];
  if (primero && nodoPorId(pasos, raizRespuesta(pasos))) {
    const casos = escenariosDeRespuesta(pasosIn, { medio: o.medio }).map((c) => ({ casoId: c.casoId, titulo: c.titulo, cuando: c.cuando }));
    // Un AI Step sin casos con nombre contesta todo con su objetivo («Lo demás»): un escenario igual, para verlo contestar.
    if (!casos.length) {
      const ai = pasosIn.find((p) => p.paso_ia && (p.medio ?? 'whatsapp') === (o.medio ?? 'whatsapp'));
      casos.push({ casoId: '', titulo: 'Lo demás', cuando: String(ai?.objetivo ?? '') });
    }
    for (const c of casos.slice(0, TOPE_RESPUESTAS)) {
      out.push({
        ...primero, id: `${primero.id}#${c.casoId}`, mensajes: primero.mensajes + 1,
        cuando: [...primero.cuando, `Contesta: ${c.titulo}`],
        respuesta: { casoId: c.casoId, titulo: c.titulo, cuando: c.cuando },
      });
    }
  }
  return { escenarios: out, faltan };
}

/**
 * El lead escribió. Como en el motor (14/10/2026), eso NO corta nada: los hilos de la salida que corrían quedan en
 * `salidaQueSigue` y vuelven cuando termine la respuesta; los corta, si está, la condición «No contestó desde que
 * entró» (`contesto`), que «Probar» decide con `contestoEnEsta` (`hechosDeLeadNuevo`). Si estaba corriendo «Si
 * responde», esa respuesta se corta: el turno nuevo la reemplaza. `siguen` = cuántos hilos de la salida esperan.
 */
export function pausarPorRespuesta(estado: EstadoSim): { estado: EstadoSim; siguen: number } {
  const corria = estado.rama === 'salida' && !estado.salidaPausada && !estado.terminado && estado.hilos.length > 0;
  const salidaQueSigue = corria ? estado.hilos : (estado.salidaQueSigue ?? []);
  return {
    estado: {
      ...estado, salidaPausada: estado.salidaPausada || estado.rama === 'salida', eligiendo: null,
      ...(estado.rama === 'respuesta' ? { terminado: true, hilos: [] } : {}),
      salidaQueSigue: salidaQueSigue.length ? salidaQueSigue : undefined,
    },
    siguen: salidaQueSigue.length,
  };
}

/** La salida que seguía vuelve a correr (terminó la respuesta, o no hay «Si responde»): desde «ahora». */
function reanudarSalida(estado: EstadoSim): EstadoSim {
  const vivos = estado.salidaQueSigue ?? [];
  return {
    ...estado, rama: 'salida', salidaPausada: false, terminado: false, eligiendo: null, salidaQueSigue: undefined,
    hilos: vivos.map((h) => ({ ...h, reloj: Math.max(h.reloj, estado.ahora) })),
  };
}

/**
 * Entra a «Si responde» por el caso que eligió el clasificador (`casoId`), o por «Otra cosa»
 * (`null`), en UN hilo con el reloj de «ahora». Los hilos congelados de la salida se descartan:
 * sólo vuelve el que retome un «Ir a» (decisión 4). Sin tarjeta «Si responde», `sinRespuesta`:
 * MaKo no contesta.
 */
export function entrarEnRespuesta(
  pasosIn: readonly PasoGrafo[],
  estado: EstadoSim,
  casoId: string | null,
): { estado: EstadoSim; sinRespuesta: boolean; caso: CasoElegido | null } {
  // Por el flujo EXPANDIDO (`recorrido`) del medio de la prueba: un caso de un AI Step no tiene `siguiente` en la tarjeta.
  const pasos = recorrido(pasosIn, estado.medio);
  const r = nodoPorId(pasos, raizRespuesta(pasos));
  if (!r) {
    // Sin «Si responde» MaKo no contesta, y la salida que corría vuelve a correr.
    if (estado.salidaQueSigue?.length) return { estado: reanudarSalida(estado), sinRespuesta: true, caso: null };
    return { estado: { ...estado, terminado: true, hilos: [], eligiendo: null }, sinRespuesta: true, caso: null };
  }
  const c = casoId ? (r.casos ?? []).find((x) => x.id === casoId) ?? null : null;
  const caso: CasoElegido = c ? { id: c.id, titulo: c.titulo, cuando: c.cuando } : { id: null, titulo: 'Otra cosa', cuando: '' };
  const destino = c ? c.siguiente ?? null : r.si_no ?? null;
  return {
    estado: { ...estado, hilos: destino ? [{ cursor: destino, reloj: estado.ahora }] : [], rama: 'respuesta', eligiendo: null, terminado: false, saltos: 0, caso },
    sinRespuesta: false,
    caso,
  };
}

/**
 * El caso con el que se redacta un «MaKo contesta» (`tipo: 'ia'`) de «Si responde»: su `cuerpo`
 * es la guía, como en el motor (`escenariosDeRespuesta`). La forma es la del clasificador y el
 * redactor de siempre (`EscenarioSecuencia`).
 */
export function escenarioParaRedactar(estado: EstadoSim, paso: PasoGrafo): { titulo: string; cuando: string; comoResponder: string } & ReturnType<typeof extrasDeCaso> {
  // AI Step v2 (décima tanda): lo del caso que viaja en su «MaKo contesta» (`paso.ia`: objetivo, ejemplos, audio,
  // «1 vez»), el MISMO que lee el motor (`responderConGrafo`). Con «Cualquier respuesta» no hay caso del
  // clasificador: el título es el de su tarjeta.
  const ia = paso.ia;
  return {
    titulo: (estado.caso?.id ? estado.caso.titulo : ia?.titulo) || estado.caso?.titulo || 'Otra cosa',
    cuando: (estado.caso?.id ? estado.caso.cuando : ia?.cuando) || estado.caso?.cuando || '',
    comoResponder: String(paso.cuerpo ?? ''),
    ...extrasDeCaso(ia),
  };
}

// ── Qué CONTACTO tiene el lead de la prueba (sexta tanda, «Probar» 1, 09/10/2026) ──────────────
// Pedido de Martín, textual: «Mira la captura que te paso, está configurado el email y en PROBAR no
// salió nada. Al igual que WhatsApp, el email debe salir con su animación...». La captura: la
// automatización «Felicitación al terminar clase» (#226 del ws1), CRON → CONDITION «Tiene WhatsApp»
// → «Sí»: WhatsApp + TAG; «Si no»: EMAIL. «Probar en Email» abierto, «Sin correos» y «Fin» abajo.
//
// ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: el envío, la bandeja y la animación andaban. MEDIDO con
// el flujo real (leído de la base, sólo lectura): el lead de la prueba (`hechosDeLeadNuevo`) tenía
// teléfono Y email SIEMPRE, así que «Tiene WhatsApp» salía por el «Sí» —un WhatsApp, que la bandeja
// no dibuja, y la etiqueta— y el email del «Si no» no aparecía nunca. La quinta tanda ya había
// pagado lo mismo con «Agendó»: decidir como el motor está bien; lo que estaba mal era el DATO.
//
// La regla: de un lead que ACABA de entrar, lo que NO se sabe es si tiene teléfono y si tiene email
// (un lead real llega con uno, con el otro o con los dos). Esos dos hechos se ELIGEN para el canal
// que se prueba: primero el lead con los dos (lo de siempre), y si así no llega ningún mensaje de ese
// canal, el que tiene SÓLO ese canal, después el que tiene sólo el otro y al final ninguno. El
// primero con el que llega algo es el lead de la prueba. Lo demás —sin agenda, sin pago, llegado
// ahora— sigue siendo un hecho y no se elige.

/** Lo que de un lead recién llegado no se sabe y puede ir para los dos lados. */
export type ContactoPrueba = { tieneTelefono: boolean; tieneEmail: boolean };

/** El contacto de siempre: los dos. */
export const CONTACTO_COMPLETO: ContactoPrueba = { tieneTelefono: true, tieneEmail: true };

/**
 * Los MENSAJES que vería el lead de la prueba, de una vez y sin animación: el MISMO recorrido del
 * panel (`siguiente`, y cada condición con `elegirComoLead`), con «ya le escribimos» después del
 * primer mensaje, como lo marca el panel. Lo que no es un mensaje (esperas, acciones, saltos) no se
 * devuelve. Exportada para el test y para `contactoParaProbar`.
 */
export function mensajesDelRecorrido<P extends PasoGrafo>(pasos: readonly P[], lead: LeadNuevoPrueba = {}, nombres: NombresSim = {}): P[] {
  const ahoraMs = lead.ahoraMs ?? Date.now();
  let st = iniciar(pasos, { reunionMin: reunionMinDe(hechosDeLeadNuevo({ ...lead, ahoraMs })) });
  let contactado = false;
  const out: P[] = [];
  // Cada vuelta muestra un evento o decide una condición: el tope de eventos corta cualquier bucle.
  for (let vuelta = 0; vuelta < TOPE_EVENTOS * 2 + 4; vuelta++) {
    const r = siguiente(pasos, st, nombres);
    st = r.estado;
    if (r.evento?.t === 'mensaje') { out.push(r.evento.paso); contactado = true; continue; }
    if (r.evento?.t === 'fin') break;
    if (!st.eligiendo) { if (!r.evento) break; continue; }
    const e = elegirComoLead(pasos, st, hechosDeLeadNuevo({ ...lead, yaContactado: contactado, respondio: false, ahoraMs }));
    if (!e.opcion) break;
    st = e.estado;
  }
  return out;
}

/**
 * LOS MENSAJES DE UN ESCENARIO (14/10/2026: `probar_secuencia` de la API manda los de UNO, no todos los pasos): el
 * MISMO recorrido de `escenariosDePrueba`, eligiendo en cada condición lo que el escenario eligió (`elecciones`, por
 * nodo). Una condición que el escenario no nombra corta ahí: no se inventa un camino. Lo que no es un mensaje no se
 * devuelve.
 */
export function mensajesDelEscenario<P extends PasoGrafo>(pasos: readonly P[], elecciones: Readonly<Record<string, string>>, nombres: NombresSim = {}, op: { reunionMin?: number } = {}): P[] {
  let st = iniciar(pasos, { reunionMin: op.reunionMin });
  const out: P[] = [];
  for (let vuelta = 0; vuelta < TOPE_EVENTOS * 2 + 4; vuelta++) {
    if (st.eligiendo) {
      const puerto = elecciones[st.eligiendo.nodo];
      if (!puerto || !st.eligiendo.opciones.some((o) => o.puerto === puerto)) break;
      st = elegir(st, puerto);
      continue;
    }
    const r = siguiente(pasos, st, nombres);
    st = r.estado;
    if (r.evento?.t === 'mensaje') { out.push(r.evento.paso); continue; }
    if (r.evento?.t === 'fin') break;
    if (!r.evento && !st.eligiendo) break;
  }
  return out;
}

/**
 * LOS ESCENARIOS DE UNA AUTOMATIZACIÓN GUARDADA, como los arma «Probar»: el MISMO flujo (`flujoParaProbar`) y el MISMO
 * lead recién llegado por su CRON (`leadNuevoDelCron`). Lo leen `escenarios_secuencia` y `probar_secuencia` de la API
 * (lib/api-mako/areas/chatbot.run.ts) y la prueba en vivo (lib/setting-secuencias.ts): una regla, un lugar.
 * `mensajes` cuenta los de WhatsApp, como dice `escenarios_secuencia`.
 */
export function escenariosDeLaSecuencia(
  s: Parameters<typeof leadNuevoDelCron>[0] & { pasos: readonly PasoGrafo[]; estrategia: unknown },
  idDeClave: (clave: string) => number | null,
): { pasos: PasoGrafo[]; escenarios: EscenarioPrueba[]; faltan: number; reunionMin?: number } {
  const pasos = flujoParaProbar(s.pasos as PasoGrafo[], s.estrategia as EstrategiaLegada, { idDeClave }).pasos;
  const hechos = hechosDeLeadNuevo(leadNuevoDelCron(s));
  const { escenarios, faltan } = escenariosDePrueba(pasos, {
    hechos,
    cuenta: (p) => (p.canal ?? 'whatsapp') === 'whatsapp',
  });
  // Sin los escenarios en que el lead CONTESTA (15/10/2026): por la API no hay quién escriba como el lead, y
  // `probar_secuencia` mandaría lo mismo que el primero. Son de la pantalla.
  // La reunión del lead de la prueba viaja: `mensajesDelEscenario` ordena con ella los «antes de la reunión».
  return { pasos, escenarios: escenarios.filter((e) => !e.respuesta), faltan, reunionMin: reunionMinDe(hechos) };
}

/**
 * El contacto del lead de la prueba de UN canal: el primero (en el orden de la cabecera) con el que
 * le llega algún mensaje de ese canal. `esDelCanal` lo decide quien prueba (el panel), y `propio`
 * es el dato que ese canal necesita: `tieneEmail` para el email, `tieneTelefono` para WhatsApp. Si
 * con ninguno llega nada, el de siempre: no hay a quién inventarle un dato.
 */
export function contactoParaProbar<P extends PasoGrafo>(
  pasos: readonly P[],
  esDelCanal: (p: P) => boolean,
  propio: keyof ContactoPrueba,
  lead: LeadNuevoPrueba = {},
  nombres: NombresSim = {},
): ContactoPrueba {
  const otro: keyof ContactoPrueba = propio === 'tieneEmail' ? 'tieneTelefono' : 'tieneEmail';
  const candidatos: ContactoPrueba[] = [
    CONTACTO_COMPLETO,
    { [propio]: true, [otro]: false } as ContactoPrueba,
    { [propio]: false, [otro]: true } as ContactoPrueba,
    { tieneTelefono: false, tieneEmail: false },
  ];
  const ahoraMs = lead.ahoraMs ?? Date.now();
  for (const c of candidatos) {
    if (mensajesDelRecorrido(pasos, { ...lead, ...c, ahoraMs }, nombres).some(esDelCanal)) return c;
  }
  return CONTACTO_COMPLETO;
}

// ── La prueba REAL: qué sale a «mi WhatsApp» / «mi email» ────────────────────────
// Lo envía lib/prueba-paso.ts (server-only). Acá vive la parte que se puede EJECUTAR en un test:
// qué forma tiene un mensaje de prueba y qué envíos produce.

/** Un mensaje tal como APARECIÓ en el panel. El texto ya trae las variables resueltas. */
export type MensajePrueba = {
  canal: 'whatsapp' | 'email';
  tipo: 'texto' | 'audio' | 'media';
  /** El texto, el pie del audio, el caption del archivo o el cuerpo del email. */
  texto: string;
  asunto?: string | null;
  audio_id?: number | null;
  media_id?: number | null;
  /** Sólo email: el cuerpo HTML como apareció en la bandeja (las variables ya puestas). */
  html?: string | null;
  /** Sólo un texto de WhatsApp: sus links sin la vista previa, como al lead (`sinVistaPrevia` del paso, #869). */
  sin_vista_previa?: boolean;
};

export type DestinoPrueba = { telefono: string | null; email: string | null };

/** Un envío concreto. El orden del array es el orden en que salen. */
export type EnvioPrueba =
  | { via: 'wa-texto'; texto: string }
  | { via: 'wa-audio'; audioId: number }
  | { via: 'wa-media'; mediaId: number; caption: string }
  | { via: 'email'; asunto: string; texto: string; html?: string };

/** El aviso del PRIMER mensaje real: quien lo recibe tiene que saber que es una prueba. */
export const AVISO_PRUEBA = '🧪 Prueba de MaKo';
export const TOPE_TEXTO_PRUEBA = 4000;

// ── El ritmo de la prueba real (revisión adversarial del 08/10/2026, datos-4) ─────────────────
// Medido sobre el recorrido: un flujo mensaje → esperar → «Ir a» el mismo mensaje, con «A mi
// WhatsApp» prendido, mandaba ~21 WhatsApp IDÉNTICOS en un par de minutos por la línea NO
// oficial del cliente: el simulador no espera (`esperar` se dice y se sigue) y el «Ir a» vuelve
// hasta `TOPE_SALTOS`. Lo que protege a una línea no oficial es el RITMO (AGENTS.md, «El WhatsApp
// del chatbot es el NO OFICIAL»), así que van dos cortes, uno en cada punta:
//   · el PANEL no repite el envío real de una tarjeta que ya salió en esta prueba
//     (`debeSalirDeVerdad`); el teléfono la sigue DIBUJANDO, porque eso es lo que se prueba;
//   · el SERVER pone un tope por (workspace, destino): `TOPE_PRUEBA_REAL` mensajes del panel
//     cada `VENTANA_PRUEBA_MIN` minutos (`reclamarCupoPrueba`, con `reclamarEspaciado`). El
//     panel corre en el navegador: sin el tope del server, un POST a mano no tiene freno.

/** Cuántos mensajes del panel salen de verdad a UN destino por ventana. */
export const TOPE_PRUEBA_REAL = 10;
/** La ventana del tope, y la del aviso «🧪 Prueba de MaKo» que decide el server. */
export const VENTANA_PRUEBA_MIN = 10;

/**
 * ¿Esta tarjeta sale DE VERDAD, o ya salió en esta prueba? Marca y contesta en un paso.
 *
 * En la SALIDA la clave es la tarjeta: un «Ir a» que vuelve sobre un mensaje ya mandado no lo
 * reenvía (es el bucle de arriba). En «Si responde» la clave lleva además el TURNO del lead: cada
 * vez que quien prueba escribe como el lead es un pedido nuevo, y la respuesta que aparece tiene
 * que llegar —un «MaKo contesta» redacta otra cosa en cada turno—. Un bucle dentro del mismo
 * turno tampoco repite.
 *
 * ↻ arranca con un `Set` vacío: es otra prueba.
 */
export function debeSalirDeVerdad(enviados: Set<string>, nodo: string, enRespuesta: boolean, turno: number): boolean {
  const clave = enRespuesta ? `r${turno}:${nodo}` : `s:${nodo}`;
  if (enviados.has(clave)) return false;
  enviados.add(clave);
  return true;
}

/**
 * A quién se le cuenta el tope: el canal y el destino, normalizados. null = sin destino (no se
 * manda nada, así que no hay nada que contar).
 */
export function claveDestinoPrueba(m: Pick<MensajePrueba, 'canal'>, d: DestinoPrueba): string | null {
  if (m.canal === 'email') return d.email ? `email:${d.email.toLowerCase()}` : null;
  return d.telefono ? `wa:${d.telefono}` : null;
}

/**
 * Reclama UN lugar de los `tope` que tiene la ventana. Cada casillero guarda cuándo se usó por
 * última vez (`reclamarEspaciado`, con su compare-and-set): uno libre es uno cuya marca ya salió
 * de la ventana. Con los `tope` ocupados no queda lugar, así que en cualquier tramo de
 * `VENTANA_PRUEBA_MIN` minutos salen como mucho `tope` mensajes.
 *
 * Recibe el reclamo inyectado para que el test lo EJECUTE (el real es `server-only`). Un error del
 * reclamo sube: quien llama decide, y el server corta (sin poder contar, no se manda).
 */
export async function reclamarCupoPrueba(reclamar: (casillero: number) => Promise<boolean>, tope = TOPE_PRUEBA_REAL): Promise<boolean> {
  for (let i = 0; i < tope; i++) if (await reclamar(i)) return true;
  return false;
}

// ── Cómo se DIBUJA en el teléfono un archivo de la biblioteca (costuras-8) ──────────────────────

/** image | video | document, como lo pide Evolution `sendMedia` y como lo dibuja la burbuja. */
export const tipoDeMime = (mime: string): 'image' | 'video' | 'document' =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'document';

/**
 * La burbuja de un paso «archivo», tal como le llega al lead: el documento con SU nombre
 * (`catalogo.pdf`) y el caption como texto aparte.
 *
 * ⚠️ Antes el caption iba en `texto` y no había `nombreArchivo`: `ChatHilo` usa el `texto` de un
 * documento sin `nombreArchivo` como su NOMBRE, así que «Probar» mostraba un documento llamado
 * «Te dejo el catálogo» y ningún caption. La prueba no mostraba cómo llega.
 */
export function burbujaDeArchivo(
  adj: { url: string | null; mime: string; nombre: string | null } | null,
  caption: string,
): { tipo: 'image' | 'video' | 'document'; mediaUrl: string | null; mediaMime: string | null; nombreArchivo: string | null; texto: string | null } {
  const tipo = adj ? tipoDeMime(adj.mime) : 'document';
  return {
    tipo,
    mediaUrl: adj?.url ?? null,
    mediaMime: adj?.mime || null,
    nombreArchivo: tipo === 'document' ? (adj?.nombre?.trim() || 'Archivo') : null,
    texto: caption.trim() ? caption : null,
  };
}

// ── El destino precargado: el de QUIEN PRUEBA (lienzo-3) ────────────────────────────────────────

/**
 * El teléfono y el email de la persona que está mirando, de SU fila de `usuarios` (el teléfono vive
 * en el jsonb `perfil`). Sin fila, vacío: se escribe a mano.
 *
 * ⚠️ NUNCA el contacto de reportes del workspace (`user_telefono` / `user_email`). Ése es del
 * NEGOCIO: con el super admin mirando a un cliente, «A mi WhatsApp» venía cargado con el número
 * del cliente y cada mensaje de la prueba le llegaba a él. El rótulo dice «A mi…»: tiene que ser
 * de quien prueba, o vacío.
 */
export function destinoDelQueMira(u: { email?: unknown; perfil?: unknown } | null | undefined): { telefono: string; email: string } {
  if (!u) return { telefono: '', email: '' };
  const perfil = u.perfil && typeof u.perfil === 'object' && !Array.isArray(u.perfil) ? (u.perfil as Record<string, unknown>) : {};
  return {
    telefono: typeof perfil.telefono === 'string' ? perfil.telefono.trim() : '',
    email: typeof u.email === 'string' ? u.email.trim() : '',
  };
}

// ── Los destinos GUARDADOS de quien prueba (quinta tanda, punto 1) ──────────────────────────────
// Pedido de Martín (09/10/2026), textual: «que no esté desplegado el "Tu número", sino que al
// clickear ese botón salga el desplegable... Y primero el desplegable me debe ofrecer los números que
// ya tiene guardado, y abajo un botón de "Nuevo número", y que tenga el form que ya tenemos de número,
// con la característica con las banderas, etc... Esto mismo con Email».
//
// ⚠️ SON DE LA PERSONA, NO DEL NEGOCIO, como el precargado de antes (lienzo-3): viven en el jsonb
// `perfil` de SU fila de `usuarios` (`destinosPrueba`), primero su teléfono / su email de siempre y
// después los que fue usando. NUNCA el contacto de reportes ni los destinatarios del workspace: con el
// super admin mirando a un cliente, ofrecer los números del cliente es un clic de distancia de
// mandarle la prueba a él.

/** Cuántos guardados por canal (además del de su perfil). Los más nuevos primero. */
export const TOPE_DESTINOS_GUARDADOS = 6;
/** La clave adentro de `usuarios.perfil`. */
export const CLAVE_DESTINOS_PRUEBA = 'destinosPrueba';

export type DestinosGuardados = { telefonos: string[]; emails: string[] };

const listaDeTextos = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Los destinos de quien prueba, en orden y sin repetidos: el de su perfil primero, después los guardados. */
export function destinosGuardados(u: { email?: unknown; perfil?: unknown } | null | undefined): DestinosGuardados {
  const propio = destinoDelQueMira(u);
  const perfil = u?.perfil && typeof u.perfil === 'object' && !Array.isArray(u.perfil) ? (u.perfil as Record<string, unknown>) : {};
  const g = (perfil[CLAVE_DESTINOS_PRUEBA] && typeof perfil[CLAVE_DESTINOS_PRUEBA] === 'object' ? perfil[CLAVE_DESTINOS_PRUEBA] : {}) as Record<string, unknown>;
  const telefonos: string[] = [];
  for (const t of [propio.telefono, ...listaDeTextos(g.telefonos)]) {
    const d = sanearDestinoPrueba({ telefono: t }).telefono;
    if (d && !telefonos.includes(d)) telefonos.push(d);
  }
  const emails: string[] = [];
  for (const e of [propio.email, ...listaDeTextos(g.emails)]) {
    const d = sanearDestinoPrueba({ email: e }).email?.toLowerCase();
    if (d && !emails.includes(d)) emails.push(d);
  }
  return { telefonos, emails };
}

/**
 * El `perfil` con un destino más guardado: al principio, sin repetir y con el tope. Lo demás del
 * jsonb viaja INTACTO (ahí viven los campos del formulario y `notifInApp`: partir de {} los borraría).
 * null = el destino no sirve (no se guarda nada).
 */
export function perfilConDestino(perfil: unknown, d: { telefono?: unknown; email?: unknown }): Record<string, unknown> | null {
  const base = perfil && typeof perfil === 'object' && !Array.isArray(perfil) ? { ...(perfil as Record<string, unknown>) } : {};
  const s = sanearDestinoPrueba(d);
  if (!s.telefono && !s.email) return null;
  const g = (base[CLAVE_DESTINOS_PRUEBA] && typeof base[CLAVE_DESTINOS_PRUEBA] === 'object' ? base[CLAVE_DESTINOS_PRUEBA] : {}) as Record<string, unknown>;
  const sumar = (lista: string[], v: string | null) => (v ? [v, ...lista.filter((x) => x !== v)] : lista).slice(0, TOPE_DESTINOS_GUARDADOS);
  base[CLAVE_DESTINOS_PRUEBA] = {
    telefonos: sumar(listaDeTextos(g.telefonos), s.telefono),
    emails: sumar(listaDeTextos(g.emails), s.email?.toLowerCase() ?? null),
  };
  return base;
}

const idPositivo = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Lo que llega del navegador, saneado. null = no es un mensaje que se pueda mandar. */
export function sanearMensajePrueba(raw: unknown): MensajePrueba | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const canal = o.canal === 'email' ? 'email' : o.canal === 'whatsapp' ? 'whatsapp' : null;
  if (!canal) return null;
  const tipo = o.tipo === 'audio' || o.tipo === 'media' ? o.tipo : 'texto';
  const texto = typeof o.texto === 'string' ? o.texto.slice(0, TOPE_TEXTO_PRUEBA) : '';
  const asunto = typeof o.asunto === 'string' ? o.asunto.slice(0, 300) : null;
  const audio_id = idPositivo(o.audio_id);
  const media_id = idPositivo(o.media_id);
  // El HTML de un email vuelve a pasar por la lista blanca: lo manda el navegador. Uno sin nada que
  // leer (`<p></p>`) no viaja; uno con sólo una imagen sí, aunque su texto plano esté vacío.
  const saneado = canal === 'email' && typeof o.html === 'string' ? sanearHtmlEmail(o.html.slice(0, TOPE_HTML_EMAIL)) : '';
  const html = saneado && !htmlEmailVacio(saneado) ? saneado : null;
  if (canal === 'whatsapp' && tipo === 'audio' && !audio_id) return null;
  if (canal === 'whatsapp' && tipo === 'media' && !media_id) return null;
  if (tipo === 'texto' && !texto.trim() && !html) return null;
  const sinTarjeta = canal === 'whatsapp' && tipo === 'texto' && o.sin_vista_previa === true;
  return { canal, tipo: canal === 'email' ? 'texto' : tipo, texto, asunto, audio_id, media_id, ...(html ? { html } : {}), ...(sinTarjeta ? { sin_vista_previa: true } : {}) };
}

/**
 * El destino que se eligió o se escribió en el panel. Lo que sale de acá se usa para ESTA prueba; si
 * quien prueba lo escribió como «Nuevo número», se suma a SUS guardados (`perfilConDestino`).
 */
export function sanearDestinoPrueba(raw: unknown): DestinoPrueba {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const digitos = typeof o.telefono === 'string' ? o.telefono.replace(/\D/g, '') : '';
  const telefono = digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
  const em = typeof o.email === 'string' ? o.email.trim() : '';
  const email = em.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? em : null;
  return { telefono, email };
}

// ── El EMISOR de la prueba real (sexta tanda, «Probar» 2) ────────────────────────────────────────
// Pedido de Martín, textual: «Los botones de Probar con WhatsApp / Email. Para probarlo en la vida
// real, deberían pedir emisor (siempre dentro de los email y numeros configurados, con la opción de
// agregar nuevo) y remitente...». O sea: DESDE qué número / email sale la prueba (sólo los vinculados
// del negocio) y A cuál llega (los guardados de quien prueba).
//
// ⚠️ LO QUE LLEGA DEL NAVEGADOR ES UN PEDIDO, NO UNA AUTORIZACIÓN: la línea la vuelve a resolver el
// envío con `elegirLinea` (lib/lineas-whatsapp.ts), que rechaza una línea que no es del negocio sin
// caer a la de por default; el remitente lo vuelve a decidir `remitenteDelPaso` (mismo dominio que el
// del negocio, nunca el sandbox). Acá sólo se le da forma.

/**
 * Desde dónde sale la prueba. `linea`: ausente = la de la automatización; null = la de por default.
 * `remitente`: ausente o null = el del negocio.
 */
export type EmisorPrueba = { linea?: string | null; remitente?: string | null };

/** El emisor que manda el panel, saneado. Lo que no se puede leer queda AUSENTE (= el de siempre). */
export function sanearEmisorPrueba(raw: unknown): EmisorPrueba {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const out: EmisorPrueba = {};
  if ('linea' in o) {
    const l = typeof o.linea === 'string' ? o.linea.trim() : '';
    if (o.linea === null || l === '') out.linea = null;
    else if (/^[A-Za-z0-9_.-]{1,80}$/.test(l)) out.linea = l;
  }
  if (typeof o.remitente === 'string' && o.remitente.trim()) {
    const r = sanearRemitente(o.remitente);
    if (r) out.remitente = r;
  }
  return out;
}

/**
 * La línea que se le PIDE al envío para la prueba: la que eligió quien prueba (null = la de por
 * default) o, si no eligió, la de la automatización. El envío la vuelve a validar (`elegirLinea`).
 */
export function lineaDePrueba(emisor: EmisorPrueba | null | undefined, deLaSecuencia: string | null | undefined): string | null {
  if (emisor && 'linea' in emisor && emisor.linea !== undefined) return emisor.linea || null;
  return (deLaSecuencia ?? '').trim() || null;
}

/**
 * Qué sale, en orden. El primero lleva el aviso: en un texto va como primer renglón; un audio no
 * tiene dónde llevarlo y sale antes como texto aparte; un archivo lo lleva en el caption.
 */
export function planDePrueba(m: MensajePrueba, primero: boolean): EnvioPrueba[] {
  const texto = m.texto.trim();
  if (m.canal === 'email') {
    const asunto = `${primero ? '[Prueba] ' : ''}${(m.asunto ?? '').trim() || 'Sin asunto'}`;
    // El HTML lleva el aviso como su primer párrafo, igual que el texto plano lo lleva arriba.
    const html = m.html ? `${primero ? `<p>${AVISO_PRUEBA}</p>` : ''}${m.html}` : undefined;
    return [{ via: 'email', asunto, texto: primero ? `${AVISO_PRUEBA}\n\n${texto}` : texto, ...(html ? { html } : {}) }];
  }
  const conAviso = (t: string) => (primero ? (t ? `${AVISO_PRUEBA}\n${t}` : AVISO_PRUEBA) : t);
  if (m.tipo === 'audio' && m.audio_id) {
    return [
      ...(primero ? [{ via: 'wa-texto' as const, texto: AVISO_PRUEBA }] : []),
      { via: 'wa-audio', audioId: m.audio_id },
      // El pie del audio sale DESPUÉS, como segundo mensaje: así le llega al lead.
      ...(texto ? [{ via: 'wa-texto' as const, texto }] : []),
    ];
  }
  if (m.tipo === 'media' && m.media_id) return [{ via: 'wa-media', mediaId: m.media_id, caption: conAviso(texto) }];
  return [{ via: 'wa-texto', texto: conAviso(texto) }];
}
