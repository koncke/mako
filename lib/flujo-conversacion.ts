// =============================================================================
// flujo-conversacion — una automatización del chatbot leída como ÁRBOL, para dibujarla
// =============================================================================
// Módulo SIN `server-only` y PURO: entra el flujo de una secuencia (`pasos`, leído con
// lib/flujo-grafo.ts), sale la lista de nodos y aristas con su posición ya calculada.
// Lo importa el lienzo del navegador y lo puede importar un test sin montar React.
//
// ── QUÉ SE COPIA DE MANYCHAT Y QUÉ NO (reescrito el 08/10/2026) ──────────────────────
// Hasta el 08/10 este comentario decía que un flujo de MaKo no tenía ramas ni posiciones
// porque las secuencias eran listas de tres pasos. Eso ya no es cierto y NO es un
// argumento contra las ramas: Martín las pidió con todas las letras (punto 9: «Yo debería
// poder crear CONDICIONALES... A raíz de cada condicional, debería poder crear tarjetas
// arriba y abajo... hoy en día no es un flujo, es solamente una secuencia lineal») y el
// modelo las tiene (lib/flujo-grafo.ts: condición con N ramas y «si no», «Si responde»
// con sus casos, esperar, «Ir a»).
//
// Lo que SIGUE sin copiarse de ManyChat es ARRASTRAR PARA CONECTAR, y por la misma razón
// de siempre: este repo ya construyó un editor de flechas a mano (el mapa del funnel) y
// el dueño lo descartó por rebuscado — «así se evita que el usuario tenga que configurar
// flechas». Y ManyChat tampoco lo exige: medido en su ayuda, una tarjeta nueva se crea
// «clicking on the connection dot and choosing another step». Acá es lo mismo: cada
// salida es un punto en el borde derecho de su tarjeta y la rama se crea desde el ＋ de
// ese punto (o desde el ＋ del medio de una flecha, que inserta EN esa salida). Nadie
// conecta nada: la flecha es una consecuencia del dato.
//
// ── POR QUÉ NO SE GUARDA LA POSICIÓN DE UNA TARJETA ──────────────────────────────────
// ManyChat tiene «auto-arrange», o sea que un layout automático en árbol es fiel al
// molde. Y guardar posiciones sería otro campo en cada paso, que pasa por
// `setSecuenciaPasos` (reconstruye campo por campo): una posición que no viaja en uno de
// los diez escritores de `pasos` se pierde en silencio. El árbol se calcula acá, es
// determinista y no tiene casos: cada nodo tiene UN padre (las salidas son sus puertos)
// y para juntar ramas está «Ir a», que es un salto y no un segundo padre.
//
// ── EL LAYOUT (reescrito el 08/10/2026, segunda tanda: UN SOLO CRON) ─────────────────────
// Pedido literal, punto 1: «No pueden haber 2 flujos por separado. Solo 1 CRON y de ahí
// desprende todo». Hasta acá «Si responde» se dibujaba ABAJO, suelta en la columna del CRON, y
// cuando no existía había una tarjeta fantasma «＋ Si responde»: dos flujos, uno debajo del otro.
//   · arriba a la izquierda, la tarjeta CRON (el disparador; NO es un paso) con DOS filas: «Al
//     entrar» (la salida: lo que MaKo manda por su cuenta, `raizSalida`, y las flechas en
//     paralelo del CRON) y «Si responde» (vacía, su ＋ crea la tarjeta: `crearRespuesta`);
//   · «Si responde» es un HIJO del CRON en el dibujo (columna 1, debajo de la salida y de los
//     paralelos), con su flecha desde su fila. No es una flecha más de «Al entrar»: es un EVENTO,
//     no un camino en el tiempo (decisión 1). El DATO no cambia: «Si responde» no tiene padre
//     (`validarGrafo` lo exige) y la relación con el CRON sale de que es única.
//   · cada nodo de varias salidas —una condición, «Si responde», el CRON y toda tarjeta con
//     flechas en paralelo— apila sus hijos ARRIBA y ABAJO de su ancla, cada uno con el alto de
//     su subárbol, así dos ramas no se pisan nunca;
//   · al final todo se corre a coordenadas ≥ 0 (`aOrigen`): la primera rama de la primera
//     condición nace arriba de su padre, o sea con `y` negativa.
//   · el nodo de INICIO (`'entrada'`, lib/flujo-grafo.ts) NO se dibuja: ES el CRON. Sus flechas
//     salen de la fila «Al entrar».

// Puro (sólo importa ./template-vars): la pregunta «¿este HTML tiene algo que leer?» del saneo del email.
import { htmlEmailVacio } from './email-html-seguro';
import {
  ANCHO_NODO, ALTO_MIN, GAP_Y, MARGEN, ALTO_PUERTO, PIE_PUERTOS, BORDE_NODO, ICONO_MAKO, ICONO_GMAIL,
  encerrar, aOrigen, centroDeFilas, tieneFilas,
  type NodoFlujo, type AristaFlujo, type GrafoFlujo, type PuertoNodo,
} from './lienzo-grafo';
import {
  type PasoGrafo, type RamaCondicion, type CampoCondicion, type NombresParaTexto, type LugarInsercion,
  CAMPOS_CONDICION, ID_INICIO, TOPE_PARALELOS, TOPE_HILOS, HILO_RESPUESTA,
  claseDe, idDe, normalizar, puertosDe, raizSalida, raicesSalida, raizRespuesta, descendientes, puedeTenerParalelos, hiloDe,
  indicePorId, nodoPorId, nuevoId, insertarNodo, conectarPuerto, validarGrafo, textoRama, textoEspera, nodosEnBucle, repartenEnBucle,
  RESULTADO_SI_NO, paralelosDeResultado, puertoParalelo, contarParalelos,
} from './flujo-grafo';
import { limpiezaPara, OP_AVISAR, type EstrategiaLegada } from './flujo-legado';
import { textoCron, type CronAviso } from './cron-aviso';
import { LEAD_DEL_EVENTO } from './api-mako/flujo-params';
export type { TipoNodo, TonoArista, NodoFlujo, AristaFlujo, GrafoFlujo, PuertoNodo, FamiliaNodo } from './lienzo-grafo';
export { curvaEntre, medioDeCurva, ANCHO_NODO, ALTO_MIN, GAP_X, GAP_Y } from './lienzo-grafo';

/** Lo que este módulo lee de un paso: el nodo del flujo y lo de siempre del mensaje. Es
 *  estructural a propósito: el DTO vive en un componente `use client` y un módulo de lib
 *  no importa valores de ahí. */
export type PasoParaGrafo = PasoGrafo & {
  /** El paso «⚡ Acción de MaKo» (lib/nutricion-paso-accion.ts). */
  accion?: { operacion?: string; params?: Record<string, unknown> } | null;
  variantes?: string[];
  /** Sólo email: la «vista previa» (el texto gris que el cliente de correo muestra tras el asunto). */
  preheader?: string | null;
};

/**
 * La tarjeta CRON. Es el MISMO id que el nodo de inicio del modelo (`ID_INICIO`, lib/flujo-grafo.ts)
 * a propósito: el ＋ del CRON manda ese id, y `{ nodo: ID_INICIO, puerto: 'par' }` es literalmente
 * lo que el lienzo pide para una flecha en paralelo desde el CRON. Un paso nunca se llama así:
 * `nuevoId` da `n…` y `normalizar` da `o<índice>`.
 */
export const ID_ENTRADA = ID_INICIO;
/** La fila «Si responde» del CRON (la otra es «Al entrar», el puerto 'sig'). */
export const PUERTO_RESPUESTA = 'resp';

/** Las dos operaciones que se dibujan como la tarjeta de ETIQUETA (decisión 8). */
export const OP_PONER_ETIQUETA = 'poner_etiqueta_lead';
export const OP_SACAR_ETIQUETA = 'sacar_etiqueta_lead';

/** Separación entre columnas del árbol. Sin etiquetas sobre las flechas, alcanza para el
 *  ＋ de una salida vacía y el ＋ del medio. */
const GAP_COLUMNA = 92;
/** Entre el árbol del CRON y lo que haya suelto debajo. */
const GAP_RAICES = 56;
/**
 * El CRON: borde 1,5×2 + relleno 11 + 8 + la cabecera (24) + sus dos filas; más un renglón de
 * 18 px por renglón del disparador (uno o dos: «Todos los días a las 09:00 de America/Tijuana»
 * son dos). Se ESTIMA: la tarjeta tiene alto fijo y las filas van pegadas al pie.
 */
const ALTO_CRON_BASE = 11 + 24 + 2 * ALTO_PUERTO + PIE_PUERTOS + BORDE_NODO * 2;
/** El CRON sin filas (cuarta tanda, punto 4): la cabecera, el disparador y su relleno. */
const ALTO_CRON_SIN_FILAS = 11 + 24 + 11 + BORDE_NODO * 2;
const RENGLON_DETALLE = 18;
/** El ícono del CRON. NO es ⚡: ése es de la Acción, y las dos tarjetas lo compartían (R3). */
export const ICONO_CRON = '⏰';

/**
 * LAS TARJETAS DE CONTROL, compactas (decisión 9). Los números salen de los estilos de
 * `TarjetaNodo` (app/_components/Lienzo.tsx): si cambia uno, cambia acá.
 *
 *   · la ESPERA es una píldora de una línea: alto 44 (el punto de salida, `yDePuerto`, cae a la
 *     mitad), ancho ~170 o lo que pida su texto («1 h antes de la reunión»);
 *   · la ETIQUETA y el «IR A»: la cabecera y una línea — relleno 11 + cabecera 24 + 18 + pie 8 +
 *     borde 3 = 64.
 *
 * El layout pone las columnas a `x + ANCHO_NODO + GAP_COLUMNA` (no a `x + ancho`): una tarjeta más
 * angosta queda alineada a la izquierda de su columna y la de al lado no se corre.
 */
export const ALTO_PILDORA = 44;
export const ANCHO_PILDORA = 170;
export const ALTO_COMPACTO = 64;
export const ANCHO_ETIQUETA = 210;
/**
 * La tarjeta MAKO: la cabecera (47) y hasta tres renglones del mensaje (12,5 × 1,45 ≈ 18 c/u), con la
 * misma holgura que un mensaje. El texto se corta con «…» a los 90 caracteres (`grafoDeSecuencia`).
 */
export const ALTO_MAKO = 47 + 3 * 18 + 8;

/** El ancho de la píldora de una espera: el de su texto, con piso y techo. */
function anchoPildora(texto: string): number {
  return Math.min(ANCHO_NODO, Math.max(ANCHO_PILDORA, Math.ceil(64 + texto.length * 7.5)));
}

/**
 * ¿ESTE PASO ES UNA TARJETA DE ETIQUETA? Una ⚡ Acción `poner_etiqueta_lead` /
 * `sacar_etiqueta_lead` (decisión 8: una PRESENTACIÓN, el motor no cambia). Devuelve qué hace y
 * con qué etiqueta (null = todavía sin elegir), o null si no es una.
 */
export function etiquetaDeAccion(p: PasoGrafo): { operacion: typeof OP_PONER_ETIQUETA | typeof OP_SACAR_ETIQUETA; etiquetaId: number | null } | null {
  if (claseDe(p) !== 'accion') return null;
  const a = p.accion as { operacion?: unknown; params?: Record<string, unknown> } | null | undefined;
  const op = typeof a?.operacion === 'string' ? a.operacion : '';
  if (op !== OP_PONER_ETIQUETA && op !== OP_SACAR_ETIQUETA) return null;
  const id = Number(a?.params?.etiquetaId);
  return { operacion: op, etiquetaId: Number.isFinite(id) && id > 0 ? id : null };
}

/**
 * ¿ESTE PASO ES LA TARJETA MAKO? (tercera tanda, decisión 11; pedido literal: «Falta una tarjeta de
 * "WhatsApp de MaKo" para que se pueda configurar un mensaje que envíe MaKo al grupo de WhatsApp»).
 * Es la ⚡ Acción `avisar_al_equipo` (OP_AVISAR) dibujada como lo que hace, igual que la etiqueta: el
 * motor no cambia. NO es un mensaje al lead: le escribe al GRUPO del negocio. La «Otra cosa» que
 * nace con «Si responde» (`crearRespuesta`) también es una.
 */
export function esMako(p: PasoGrafo): boolean {
  if (claseDe(p) !== 'accion') return false;
  const a = p.accion as { operacion?: unknown } | null | undefined;
  return a?.operacion === OP_AVISAR;
}

/** El mensaje y el título de una tarjeta MAKO (lo que el editor edita y la tarjeta muestra). */
export function makoDeAccion(p: PasoGrafo): { mensaje: string; titulo: string } | null {
  if (!esMako(p)) return null;
  const params = (p.accion as { params?: Record<string, unknown> } | null | undefined)?.params ?? {};
  return {
    mensaje: typeof params.mensaje === 'string' ? params.mensaje : '',
    titulo: typeof params.titulo === 'string' ? params.titulo : '',
  };
}

/** «+ Cualificado» / «− Seguimiento»: lo que dice la tarjeta de etiqueta. */
function textoEtiqueta(e: NonNullable<ReturnType<typeof etiquetaDeAccion>>, nombres?: NombresParaTexto): string {
  if (e.etiquetaId == null) return 'Sin elegir';
  const nom = nombres?.etiqueta?.(e.etiquetaId) ?? 'una etiqueta';
  return `${e.operacion === OP_PONER_ETIQUETA ? '+' : '−'} ${nom}`;
}

// ── El disparador, dicho como es ──────────────────────────────────────────────────

/**
 * LO QUE DICE LA TARJETA CRON: el disparador REAL.
 *
 * ⚠️ HASTA EL 08/10 MENTÍA. Decía «El lead cae en «<etapa>»» con la etapa de la fila sin
 * mirar `trigger_tipo`: en la #198 el disparador es «Dejó el formulario sin agendar» y la
 * tarjeta afirmaba que caía en la etapa «nutri». Es la misma mentira que el 05/10 se
 * arregló en el panel y no en la tarjeta. La etapa se dice SÓLO si el disparador es de
 * etapa; si hay horario, manda el horario; si es una etiqueta, la etiqueta.
 */
export function detalleDisparador(d: {
  trigger_tipo: string;
  etapa?: string | null;
  cron?: CronAviso | null;
  tz?: string | null;
  /** El rótulo del disparador en el catálogo (`TRIGGERS`). */
  etiquetaTrigger?: string | null;
  nombreEtapa?: string | null;
  nombreEtiqueta?: string | null;
}): string {
  if (d.cron) return textoCron(d.cron, d.tz ?? null);
  if (d.trigger_tipo === 'etapa_actual' || d.trigger_tipo === 'entrega_actual') {
    return `Llega a «${(d.nombreEtapa || d.etapa || 'una etapa').trim()}»`;
  }
  if (d.trigger_tipo === 'etiqueta_puesta') return `Se le puso «${d.nombreEtiqueta || 'una etiqueta'}»`;
  return d.etiquetaTrigger || d.trigger_tipo;
}

// ── Las condiciones que el motor evalúa ───────────────────────────────────────────

/**
 * Las condiciones que el motor SÍ evalúa: las de `cumpleFila` (lib/flujo-grafo.ts), que
 * es la MISMA función que usan el motor y el simulador. En positivo: el lienzo no ofrece
 * una condición que no esté acá, y el guard de tests/flujo-conversacion.test.ts mide el
 * `switch` de `cumpleFila` para que esta lista no se quede vieja.
 *
 * Antes eran los `requiere` de un paso (respondio, ya_contactado, primer_contacto) y la
 * lista dejaba afuera `sin_respuesta`, que el motor no miraba. En el flujo con ramas no
 * hay «respondió a esta» en la salida: una respuesta PAUSA la salida y corre «Si responde».
 */
export const CONDICIONES_VIVAS: ReadonlySet<CampoCondicion> = new Set(CAMPOS_CONDICION);

/** Cada condición como la primera mitad de una frase: [en positivo, negada]. */
export const FRASE_CONDICION: Record<CampoCondicion, readonly [string, string]> = {
  etiqueta: ['Tiene la etiqueta', 'No tiene la etiqueta'],
  etapa: ['Está en la etapa', 'No está en la etapa'],
  agendo: ['Agendó', 'No agendó'],
  pago: ['Pagó', 'No pagó'],
  ya_contactado: ['Ya le escribiste', 'Nunca le escribiste'],
  respondio: ['Te escribió alguna vez', 'Nunca te escribió'],
  antiguedad: ['Llegó hace menos de', 'Llegó hace más de'],
  tiene_telefono: ['Tiene WhatsApp', 'Sin WhatsApp'],
  tiene_email: ['Tiene email', 'Sin email'],
};

// ── Alto de cada tarjeta, sin medir el DOM ────────────────────────────────────────

/**
 * LAS PIEZAS DE UNA TARJETA DE MENSAJE, en px. Salen de los estilos que las dibujan, no de
 * una captura: si cambia uno, cambia aquí.
 *
 * ⚠️ HASTA EL 08/10 LA NOTA DE VOZ MEDÍA 108 FIJO, Y NO ENTRABA (revisión, costuras-7). La
 * tarjeta tiene alto FIJO con `overflow: hidden` (lleva puertos), y quitando su marco quedaban
 * ≈44 px para el reproductor (34) + el título (14): el título salía cortado y el pie —el link
 * que llevan los audios del ws1— y la transcripción no se veían NUNCA. Una nota con link se
 * veía igual que una sin link. Ahora el alto se suma por partes, como el del texto.
 */
const MARCO_TARJETA = 47;       // TarjetaNodo: borde 1,5×2 + relleno 11 + 8 + la cabecera (ícono + 7)
const MARCO_BURBUJA = 18;       // BurbujaHilo compacta: relleno 8×2 + borde 1×2
const SEP_BURBUJA = 4;          // el `sep` compacto entre las piezas de la burbuja
const ALTO_REPRODUCTOR = 34;    // AudioPlay compacto
const ALTO_TITULO_AUDIO = 14;   // la fila «título · duración», a 11 px
const ALTO_CHIP_ARCHIVO = 34;   // el chip del documento compacto (relleno 7×2, ícono 18, borde)
const RENGLON_TEXTO = 18.5;     // 12,5 px × 1,45
const LETRAS_TEXTO = 32;        // las que entran en un renglón de la burbuja compacta (205 px)
const RENGLONES_TEXTO = 5;      // el `WebkitLineClamp` de la burbuja compacta
const RENGLON_DICE = 16;        // «Dice: …», 11 px × 1,45
const LETRAS_DICE = 36;
const HOLGURA = 6;              // la fuente que no llegó, el redondeo
const TOPE_MENSAJE = 260;
// La caja del mail (`VistaEmail`): relleno 7×2 + borde 1×2; el asunto a 12,5 px en 18; la vista
// previa a 11 px en 16; el cuerpo a 12 px × 1,45, tres renglones como mucho, de ~36 letras.
export const MARCO_MAIL = 16;
export const RENGLON_ASUNTO = 18;
export const RENGLON_PREHEADER = 16;
export const RENGLON_CUERPO_MAIL = 17.5;
export const SEP_MAIL = 4;
export const RENGLONES_EMAIL = 3;
const LETRAS_EMAIL = 36;

const renglonesDe = (t: string, letras: number): number =>
  t.trim() ? Math.max(1, Math.ceil(t.trim().length / letras)) + (t.trim().match(/\n/g)?.length ?? 0) : 0;

/** Lo que el layout necesita saber de un audio de la biblioteca (lo da quien monta). */
export type AudioParaAlto = { transcript?: string | null } | null | undefined;

/**
 * Alto estimado de un mensaje. Se estima y no se mide porque el layout tiene que existir
 * ANTES del primer pintado. La tarjeta tiene alto FIJO (lleva puertos): lo que no entra
 * se corta, y el texto entero está en el editor.
 *
 * El audio y el archivo se suman POR PARTES con lo mismo que dibuja la tarjeta (`VistaMensaje`
 * en app/chatbot/FlujoLienzo.tsx): el reproductor, el título, la transcripción (si la hay, a lo
 * sumo 90 letras, como la recorta la burbuja) y el pie. El archivo, con su chip y el caption.
 */
export function altoDeMensaje(p: PasoParaGrafo, audio?: AudioParaAlto): number {
  const cuerpo = p.cuerpo ?? '';
  const pie = Math.min(RENGLONES_TEXTO, renglonesDe(cuerpo, LETRAS_TEXTO));
  if (p.tipo === 'audio') {
    const dice = (audio?.transcript ?? '').trim();
    const renglonesDice = dice ? Math.min(3, Math.ceil((Math.min(dice.length, 90) + 9) / LETRAS_DICE)) : 0;
    const hay = pie > 0 || renglonesDice > 0;
    const h = MARCO_TARJETA + MARCO_BURBUJA + ALTO_REPRODUCTOR + (hay ? SEP_BURBUJA : 0) + ALTO_TITULO_AUDIO
      + (renglonesDice ? SEP_BURBUJA + renglonesDice * RENGLON_DICE : 0)
      + (pie ? SEP_BURBUJA + pie * RENGLON_TEXTO : 0) + HOLGURA;
    return Math.min(TOPE_MENSAJE, Math.max(ALTO_MIN, Math.ceil(h)));
  }
  if (p.tipo === 'media') {
    const h = MARCO_TARJETA + MARCO_BURBUJA + ALTO_CHIP_ARCHIVO + (pie ? SEP_BURBUJA + pie * RENGLON_TEXTO : 0) + HOLGURA;
    return Math.min(TOPE_MENSAJE, Math.max(ALTO_MIN, Math.ceil(h)));
  }
  if (p.canal === 'email') {
    // ⚠️ UN EMAIL SE DIBUJA COMO UN MAIL, NO COMO UNA BURBUJA (segunda tanda): la caja del correo
    // (`VistaEmail`, app/chatbot/FlujoLienzo.tsx) con el asunto arriba, la vista previa en gris y
    // a lo sumo tres renglones del cuerpo. Se suma por partes con lo mismo que dibuja.
    const asunto = (p.asunto ?? '').trim();
    const pre = (p.preheader ?? '').trim();
    if (!asunto && !cuerpo.trim()) return ALTO_MIN;
    const rc = Math.min(RENGLONES_EMAIL, renglonesDe(cuerpo, LETRAS_EMAIL));
    const h = MARCO_TARJETA + MARCO_MAIL + RENGLON_ASUNTO + (pre ? RENGLON_PREHEADER : 0)
      + (rc ? SEP_MAIL + rc * RENGLON_CUERPO_MAIL : 0) + HOLGURA;
    return Math.min(TOPE_MENSAJE, Math.max(ALTO_MIN, Math.ceil(h)));
  }
  const renglones = Math.max(1, Math.ceil(cuerpo.length / 34)) + (cuerpo.match(/\n/g)?.length ?? 0);
  const extra = p.tipo === 'ia' ? 18 : 0;
  return Math.min(TOPE_MENSAJE, ALTO_MIN + 8 + Math.min(renglones, 8) * 17 + extra);
}

/** Una tarjeta con N filas de salida: la cabecera, las filas y el pie. */
export function altoConFilas(filas: number): number {
  return Math.max(ALTO_MIN, 40 + filas * ALTO_PUERTO + PIE_PUERTOS + BORDE_NODO * 2);
}

// ── Nombrar una tarjeta (para los errores y el «Ir a») ────────────────────────────

/**
 * LOS TÍTULOS DE LAS TARJETAS, EN INGLÉS (tercera tanda, decisión 5; pedido literal: «todos los
 * títulos de las tarjetas estén en inglés, "CRON - DELAY - WHATSAPP"»). UN lugar: el árbol, los
 * errores y el recordatorio (app/chatbot/RecordatorioFlujo.tsx) leen de acá. Van en mayúsculas
 * porque así se dibujan, y el error nombra la tarjeta con lo mismo que se lee.
 */
export const TITULO = {
  cron: 'CRON', whatsapp: 'WHATSAPP', email: 'EMAIL', esperar: 'DELAY', condicion: 'CONDITION',
  etiqueta: 'TAG', accion: 'ACTION', mako: 'MAKO', respuesta: 'REPLY',
  // «Ir a» ya no se crea (decisión 3), pero los que existen se siguen dibujando.
  ir_a: 'GO TO',
} as const;

/**
 * EL TÍTULO QUE LA TARJETA DIBUJA. Lo usan el árbol (la cabecera de cada tarjeta) y los
 * nombres de los errores: una sola función, para que el error nombre la tarjeta con lo
 * mismo que se lee en el lienzo.
 */
export function tituloDeTarjeta(p: PasoGrafo, enRespuesta?: boolean): string {
  void enRespuesta;
  switch (claseDe(p)) {
    case 'condicion': return TITULO.condicion;
    case 'respuesta': return TITULO.respuesta;
    case 'ir_a': return TITULO.ir_a;
    case 'esperar': return TITULO.esperar;
    case 'accion': return etiquetaDeAccion(p) ? TITULO.etiqueta : esMako(p) ? TITULO.mako : TITULO.accion;
    case 'inicio': return TITULO.cron;
    // Un WhatsApp con texto, audio, archivo o escrito por MaKo es WHATSAPP (decisión 5): «no pongas
    // "Nota de voz" es simplemente "WhatsApp" y un WhatsApp puede contener diversas cosas».
    default: return p.canal === 'email' ? TITULO.email : TITULO.whatsapp;
  }
}

/** Un trozo de lo que la tarjeta DICE: el texto del mensaje, cuánto espera, la primera rama. */
const TROZO = 26;
function trozoDe(p: PasoGrafo, nombres?: NombresParaTexto): string {
  const c = claseDe(p);
  const et = etiquetaDeAccion(p);
  let t = '';
  if (c === 'mensaje') t = p.canal === 'email' ? (p.asunto ?? '') || (p.cuerpo ?? '') : (p.cuerpo ?? '');
  else if (c === 'esperar') t = textoEspera(p.espera).replace(/^Esperar /, '');
  else if (c === 'condicion' && p.ramas?.[0]) t = textoRama(p.ramas[0], nombres);
  else if (et && et.etiquetaId != null) t = textoEtiqueta(et, nombres);
  else if (esMako(p)) t = makoDeAccion(p)?.mensaje ?? '';
  t = t.replace(/\s+/g, ' ').trim();
  return t.length > TROZO ? `${t.slice(0, TROZO - 1).trimEnd()}…` : t;
}

/**
 * LA TARJETA NOMBRADA POR LO QUE SE VE: su título y un trozo de lo que dice («Mensaje: Hola,
 * te escribo de…», «Condición: Agendó»). Sin trozo (una tarjeta vacía), sólo el título.
 *
 * ⚠️ HASTA EL 08/10 ERA «Mensaje 4» (revisión, lienzo-6): un número que salía del orden del
 * array y contaba todas las clases de mensaje, mientras ninguna tarjeta dibuja un número. En
 * la forma de #212, «Mensaje 4» era la segunda «MaKo contesta». Un nombre que no se dibuja no
 * se encuentra; por eso además Publicar SELECCIONA la tarjeta culpable (`tarjetaDelError`).
 */
export function nombreDeTarjeta(pasos: readonly PasoGrafo[], id: string, nombres?: NombresParaTexto): string {
  const i = indicePorId(pasos, id);
  if (i < 0) return 'una tarjeta';
  const titulo = tituloDeTarjeta(pasos[i], subarbolRespuesta(pasos).has(id));
  const t = trozoDe(pasos[i], nombres);
  return t ? `${titulo}: ${t}` : titulo;
}

/**
 * LA PRIMERA TARJETA DE MENSAJE QUE NO DICE NADA, con su id para seleccionarla, o null.
 *
 * `validarGrafo` mira la FORMA (ramas, destinos, topes) y no el contenido, así que una
 * tarjeta recién agregada —un «Mensaje», o el «MaKo contesta» con el que nace cada caso de
 * «Si responde»— pasa vacía y se publicaría: un WhatsApp en blanco, o un caso sin guía de
 * cómo responder. Va acá y no en el modelo (sólo lectura para esta parte); la tarjeta ya lo
 * marca con «Sin escribir», y esto lo frena antes de Publicar.
 */
export function faltaEscribir(pasos: readonly PasoGrafo[]): { id: string; error: string } | null {
  for (let i = 0; i < pasos.length; i++) {
    const p = pasos[i];
    // La tarjeta MAKO sin mensaje tampoco sale: `avisar_al_equipo` lo exige, y el saneo del server
    // la guardaría igual (corre en cada lead y falla en cada uno). Se frena acá, abriéndola.
    if (esMako(p) && !(makoDeAccion(p)?.mensaje ?? '').trim()) {
      const id = idDe(p, i);
      return { id, error: `Falta completar «${nombreDeTarjeta(pasos, id)}»` };
    }
    if (claseDe(p) !== 'mensaje') continue;
    const id = idDe(p, i);
    if (mensajeVacio(p)) return { id, error: `Falta completar «${nombreDeTarjeta(pasos, id)}»` };
  }
  return null;
}

/**
 * ¿UN MENSAJE NO DICE NADA? La MISMA regla para el «Sin escribir» de la tarjeta y para el freno de
 * Publicar (`faltaEscribir`): eran dos copias.
 *   · Un email sin asunto está a medio escribir: saldría «(sin asunto)», que es lo que pone el motor
 *     cuando no hay, y un email nuevo nace con el asunto vacío (`nodoNuevo('email')`).
 *   · ⚠️ UN EMAIL CON SÓLO UNA IMAGEN NO ESTÁ VACÍO (integración de la tercera tanda): su `cuerpo` (el
 *     texto plano derivado del editor rico) puede quedar en '' y el `cuerpo_html` tener qué mostrar.
 *     La pregunta sobre el HTML es la del saneo (`htmlEmailVacio`), no una copia.
 */
export function mensajeVacio(p: PasoGrafo): boolean {
  if (p.tipo === 'audio') return !p.audio_id;
  if (p.tipo === 'media') return !p.media_id;
  if (p.canal === 'email') {
    if (!(p.asunto ?? '').trim()) return true;
    const html = (p as { cuerpo_html?: unknown }).cuerpo_html;
    return !(p.cuerpo ?? '').trim() && (typeof html !== 'string' || htmlEmailVacio(html));
  }
  return !(p.cuerpo ?? '').trim();
}

const escaparRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Un error de `validarGrafo` con las tarjetas nombradas como se ven, no por su id. El
 * sustantivo que `validarGrafo` pone delante del id («la condición n0ab…») se va con él: si
 * no, queda «la condición «Condición: Agendó»».
 */
export function errorLegible(err: string, pasos: readonly PasoGrafo[]): string {
  const ids = pasos.map((p, i) => idDe(p, i)).sort((a, b) => b.length - a.length);
  let out = err;
  for (const id of ids) {
    const re = new RegExp(`(^|[^\\w])(?:(?:la condición|la espera|el «Ir a»|la tarjeta) )?${escaparRe(id)}(?![\\w])`, 'g');
    out = out.replace(re, (_m, pre: string) => `${pre}«${nombreDeTarjeta(pasos, id)}»`);
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * LA TARJETA DE LA QUE HABLA UN ERROR: la primera que nombra (por su id), o null. Es la que
 * Publicar abre al frenar, para que el error se arregle donde se ve y no buscando un nombre.
 */
export function tarjetaDelError(err: string, pasos: readonly PasoGrafo[]): string | null {
  let mejor: string | null = null;
  let en = Infinity;
  for (let i = 0; i < pasos.length; i++) {
    const id = idDe(pasos[i], i);
    const m = new RegExp(`(^|[^\\w])${escaparRe(id)}(?![\\w])`).exec(err);
    if (m && m.index < en) { mejor = id; en = m.index; }
  }
  return mejor;
}

// ── El grafo ──────────────────────────────────────────────────────────────────────

export type OpcionesGrafo = {
  /** Lo que dice la tarjeta CRON (`detalleDisparador`). */
  disparador: string;
  /** Las automatizaciones del workspace, para nombrar el destino de un «Ir a». */
  secuencias?: ReadonlyArray<{ id: number; nombre: string }>;
  /**
   * El título humano de una operación del registro («Mover un lead de etapa»). Viene de
   * afuera porque el catálogo lo arma el server (GET /api/flujos/acciones) y este módulo
   * es puro. Sin él —cargando, o quien mira no es admin— el nodo dice el id de la operación,
   * que es feo y es verdad.
   */
  tituloAccion?: (operacion: string) => string | null | undefined;
  /** Los nombres de las etiquetas y las etapas, para las filas de una condición. */
  nombres?: NombresParaTexto;
  /**
   * El color (`#rrggbb`) de una etiqueta, para teñir su tarjeta (decisión 9: «la etiqueta con el
   * color de la etiqueta»). Sin él, la tarjeta de etiqueta va en `--surface-2`.
   */
  colorEtiqueta?: (id: number) => string | null | undefined;
  /** El audio de la biblioteca de una nota de voz: si tiene transcripción, la tarjeta la
   *  muestra y el alto la cuenta (`altoDeMensaje`). Sin esto, se mide sin transcripción. */
  audioDe?: (id: number) => AudioParaAlto;
  /**
   * Cuántas respuestas de esta automatización quedaron SIN CASO y esperan a una persona (los
   * hand-offs pendientes, GET /api/chat-agent/secuencias → `handoffs`). Se marcan en la fila
   * «Otra cosa», que es por donde salieron: sin la marca, no se ven en ningún lado.
   */
  pendientesOtraCosa?: number;
};

/** Lo que cuelga de «Si responde» (sin ella). Ahí no hay esperas: se contesta en el momento. */
export function subarbolRespuesta(pasos: readonly PasoGrafo[]): Set<string> {
  const r = raizRespuesta(pasos);
  return r ? descendientes(pasos, r) : new Set();
}

/**
 * QUÉ FILAS DE RESULTADO admiten una flecha en paralelo NUEVA (cuarta tanda, punto 8: «varias si se
 * cumple y varias si no se cumple»), como `<condición>|<resultado>` → sí/no. `pasos`, normalizados.
 *
 * Lo que se ofrece sale de la regla que Publicar RECHAZA: se arma el flujo HIPOTÉTICO con la flecha
 * nueva (`insertarNodo`, lo mismo que hace el ＋) y tiene que pasar `validarGrafo` sin ningún error
 * que hoy no esté. Los topes, «Si responde» y el bucle se preguntan ADEMÁS a mano, con las mismas
 * funciones (`contarParalelos`, `nodosEnBucle`): un error que YA está en la lista («corre como mucho
 * 6 caminos», «"Si responde" no puede…») repetido no se ve como nuevo. Y al revés, el hipotético ve lo
 * que ningún chequeo a mano mira (hoy: el tope de 60 tarjetas).
 *
 * ⚠️ MEMORIZADO POR LA FORMA DEL FLUJO. Medido el 09/10/2026: con un `validarGrafo` hipotético por fila,
 * `grafoDeSecuencia` pasaba de 4,4 ms a 75-110 ms en un flujo de 57 tarjetas y 19 condiciones, y corre
 * en CADA render del lienzo (FlujoLienzo no lo memoriza: una tecla en un editor es un render). La
 * respuesta depende sólo de la FORMA (ids, clases, salidas, flechas, destinos): lo que depende del
 * contenido (una fila de condición incompleta, una espera sin minutos, un caso sin nombre) da el MISMO
 * error en el flujo de hoy y en el hipotético, así que no cambia la resta. Una sola entrada: la del
 * flujo que se está editando.
 */
let memoFilasConParalelo: { firma: string; filas: ReadonlyMap<string, boolean> } | null = null;

export function filasConParalelo(pasos: readonly PasoGrafo[]): ReadonlyMap<string, boolean> {
  const firma = JSON.stringify(pasos.map((p, i) => [
    idDe(p, i), claseDe(p), p.siguiente ?? null, p.paralelos ?? null,
    (p.ramas ?? []).map((r) => [r.id, r.siguiente ?? null, r.paralelos ?? null]),
    p.si_no ?? null, p.paralelos_si_no ?? null, (p.casos ?? []).map((c) => [c.id, c.siguiente ?? null]), p.destino ?? null,
  ]));
  if (memoFilasConParalelo?.firma === firma) return memoFilasConParalelo.filas;
  const filas = new Map<string, boolean>();
  const condiciones = pasos.map((p, i) => i).filter((i) => claseDe(pasos[i]) === 'condicion');
  if (condiciones.length) {
    const ids = pasos.map((p, i) => idDe(p, i));
    const resp = raizRespuesta(pasos);
    const enRespuesta = new Set(resp ? [resp, ...descendientes(pasos, resp)] : []);
    const enBucle = nodosEnBucle(pasos);
    const caminos = 1 + contarParalelos(pasos);
    const erroresHoy = new Set(validarGrafo(pasos));
    const idDePrueba = nuevoId(pasos, () => 0.5);
    for (const i of condiciones) {
      for (const resultado of [...(pasos[i].ramas ?? []).map((r) => r.id), RESULTADO_SI_NO]) {
        let si = !enRespuesta.has(ids[i]) && !enBucle.has(ids[i]) && caminos < TOPE_HILOS
          && paralelosDeResultado(pasos[i], resultado).length < TOPE_PARALELOS;
        if (si) {
          const prueba = { ...relleno(), id: idDePrueba } as unknown as PasoGrafo;
          const hipotetico = insertarNodo(pasos, { nodo: ids[i], puerto: puertoParalelo(null, resultado) }, prueba);
          si = hipotetico.some((q) => q.id === idDePrueba) && validarGrafo(hipotetico).every((e) => erroresHoy.has(e));
        }
        filas.set(`${ids[i]}|${resultado}`, si);
      }
    }
  }
  memoFilasConParalelo = { firma, filas };
  return filas;
}

export function grafoDeSecuencia(pasosIn: readonly PasoParaGrafo[], op: OpcionesGrafo): GrafoFlujo {
  const pasos = normalizar(pasosIn);
  const ids = pasos.map((p, i) => idDe(p, i));
  const existe = new Set(ids);
  const iIni = pasos.findIndex((p) => claseDe(p) === 'inicio');
  const raiz = raizSalida(pasos);
  const resp = raizRespuesta(pasos);
  const enRespuesta = subarbolRespuesta(pasos);
  const porSecuencia = new Map((op.secuencias ?? []).map((s) => [s.id, s.nombre]));

  // Lo que se alcanza desde una raíz (la de cada hilo de la salida y «Si responde») o desde un
  // salto. Lo demás es una tarjeta suelta (la misma regla que `validarGrafo`): se dibuja igual
  // —esconderla la haría imposible de borrar— y con su marca.
  const alcanzable = new Set<string>();
  const raices = [...raicesSalida(pasos), resp, ...pasos.flatMap((p) => (claseDe(p) === 'ir_a' && p.destino && 'nodo' in p.destino ? [p.destino.nodo] : []))];
  for (const x of raices) if (x && existe.has(x)) { alcanzable.add(x); for (const d of descendientes(pasos, x)) alcanzable.add(d); }

  // ── Las flechas en paralelo que todavía se pueden sacar (decisión 2) ──
  // Una salida las ofrece (`paralelo` en su puerto: el lienzo dibuja el ＋ con el punto ocupado)
  // sólo donde se pueden PUBLICAR: en una clase que las admite, fuera de «Si responde», debajo
  // del tope por tarjeta y del tope de caminos de la automatización. Ofrecerlas donde
  // `validarGrafo` las rechaza sería un control que no se puede guardar.
  //
  // ⚠️ Y FUERA DE UN BUCLE DE «IR A» (`nodosEnBucle`, la misma función que usa la regla). Hasta el
  // 09/10/2026 esto no miraba los bucles: en CRON → m1 → esperar → «Ir a» m1 ofrecía el ＋ en
  // paralelo en m1 y en la espera, y Publicar lo rechazaba con «saca flechas en paralelo dentro
  // de un bucle». Una flecha nueva no arma un bucle (la tarjeta que crea no sigue en nada), así
  // que alcanza con mirar el flujo como está.
  const paralelosDe = (i: number) => puertosDe(pasos, i).filter((pt) => pt.puerto.startsWith('par:')).length;
  // Los caminos con la MISMA cuenta que `validarGrafo` (`contarParalelos`): las flechas de las tarjetas
  // y, desde la cuarta tanda, las de cada resultado de una condición.
  const caminos = 1 + contarParalelos(pasos);
  const enBucle = nodosEnBucle(pasos);
  const admiteParalelo = (i: number): boolean => i >= 0
    ? puedeTenerParalelos(pasos[i]) && !enRespuesta.has(ids[i]) && ids[i] !== resp && !enBucle.has(ids[i]) && caminos < TOPE_HILOS && paralelosDe(i) < TOPE_PARALELOS
    : caminos < TOPE_HILOS;
  // ── Y las de cada RESULTADO de una condición (cuarta tanda, punto 8): `filasConParalelo` ──
  const conParalelo = filasConParalelo(pasos);
  const admiteEnResultado = (i: number, resultado: string): boolean => conParalelo.get(`${ids[i]}|${resultado}`) === true;

  // ── La tarjeta de cada paso (sin posición todavía) ──
  type Tarjeta = Omit<NodoFlujo, 'x' | 'y'>;
  const tarjetas = new Map<string, Tarjeta>();
  pasos.forEach((p, i) => {
    const id = ids[i];
    const c = claseDe(p);
    // El inicio ES el CRON: no tiene tarjeta propia (la del CRON se arma abajo).
    if (c === 'inicio') return;
    const pts = puertosDe(pasos, i);
    const base = { id, ancho: ANCHO_NODO };
    let t: Tarjeta;
    if (c === 'condicion') {
      // Cada fila es un RESULTADO: con `paralelo` ofrece el ＋ de una flecha en paralelo desde ESA fila
      // (cuarta tanda, punto 8), y las que ya salen en paralelo (`par:<id>@<resultado>`) se dibujan
      // desde ella.
      const enParalelo = (resultado: string) => (admiteEnResultado(i, resultado) ? { paralelo: true } : {});
      const puertos: PuertoNodo[] = (p.ramas ?? []).map((r) => ({ id: r.id, rotulo: textoRama(r, op.nombres), tono: 'buena' as const, vacio: !r.siguiente, ...enParalelo(r.id) }));
      puertos.push({ id: RESULTADO_SI_NO, rotulo: 'Si no', tono: 'mala', vacio: !p.si_no, ...enParalelo(RESULTADO_SI_NO) });
      t = { ...base, tipo: 'condicion', familia: 'control', titulo: TITULO.condicion, icono: '🔀', puertos, alto: altoConFilas(puertos.length) };
    } else if (c === 'respuesta') {
      const puertos: PuertoNodo[] = (p.casos ?? []).map((x) => ({ id: x.id, rotulo: x.titulo?.trim() || 'Caso sin nombre', tono: 'buena' as const, vacio: !x.siguiente }));
      const pendientes = Math.max(0, Math.floor(Number(op.pendientesOtraCosa) || 0));
      puertos.push({ id: 'si_no', rotulo: 'Otra cosa', tono: 'mala', vacio: !p.si_no, ...(pendientes ? { marca: `${pendientes} sin caso` } : {}) });
      t = { ...base, tipo: 'respuesta', familia: 'contenido', titulo: TITULO.respuesta, icono: '↩️', puertos, alto: altoConFilas(puertos.length) };
    } else if (c === 'ir_a') {
      const d = p.destino;
      let detalle = 'Sin elegir';
      let advertencia: string | undefined = 'Falta elegir a dónde';
      if (d && 'secuencia_id' in d) {
        const nom = porSecuencia.get(Number(d.secuencia_id));
        detalle = nom ?? 'Una automatización que ya no existe';
        advertencia = nom ? undefined : 'Esa automatización ya no existe';
      } else if (d && 'nodo' in d) {
        detalle = existe.has(d.nodo) ? nombreDeTarjeta(pasos, d.nodo, op.nombres) : 'Una tarjeta que ya no existe';
        advertencia = existe.has(d.nodo) ? undefined : 'Esa tarjeta ya no existe';
      }
      // `puertos: []`: un «Ir a» termina ahí. Sin puntos y sin el ＋ de pasar el cursor.
      t = { ...base, tipo: 'ir-a', familia: 'control', titulo: TITULO.ir_a, icono: '↪️', detalle, ...(advertencia ? { advertencia } : {}), puertos: [], alto: ALTO_COMPACTO };
    } else {
      // Mensaje, acción y espera: UNA salida, el punto a la altura de la cabecera. Con el punto
      // ocupado, la misma salida ofrece una flecha EN PARALELO (si se puede publicar).
      const puertos: PuertoNodo[] = [{ id: 'sig', vacio: !pts[0]?.destino, ...(admiteParalelo(i) ? { paralelo: true } : {}) }];
      const et = etiquetaDeAccion(p);
      if (c === 'esperar') {
        const detalle = textoEspera(p.espera).replace(/^Esperar /, '');
        t = { ...base, tipo: 'espera', familia: 'control', titulo: TITULO.esperar, icono: '⏳', detalle, puertos, ancho: anchoPildora(detalle), alto: ALTO_PILDORA };
      } else if (esMako(p)) {
        // LA TARJETA MAKO (decisión 11): la ⚡ Acción `avisar_al_equipo` dibujada como lo que hace,
        // con el mensaje recortado. Le escribe al grupo del negocio, no al lead.
        const m = makoDeAccion(p)!;
        const msg = m.mensaje.replace(/\s+/g, ' ').trim();
        t = {
          ...base, tipo: 'mako', familia: 'contenido', titulo: TITULO.mako, icono: ICONO_MAKO, puertos, alto: ALTO_MAKO,
          detalle: msg ? (msg.length > 90 ? `${msg.slice(0, 89).trimEnd()}…` : msg) : 'Sin escribir',
          ...(msg ? {} : { advertencia: 'Sin escribir' }),
        };
      } else if (et) {
        // LA TARJETA DE ETIQUETA (decisión 8): la misma ⚡ Acción, dibujada como lo que hace.
        t = {
          ...base, tipo: 'etiqueta', familia: 'control', titulo: TITULO.etiqueta, icono: '🏷️', puertos,
          ancho: ANCHO_ETIQUETA, alto: ALTO_COMPACTO, detalle: textoEtiqueta(et, op.nombres),
          color: et.etiquetaId != null ? (op.colorEtiqueta?.(et.etiquetaId) ?? null) : null,
          ...(et.etiquetaId == null ? { advertencia: 'Falta elegir la etiqueta' } : {}),
        };
      } else if (c === 'accion') {
        // ⚠️ UN PASO DE ACCIÓN ES OTRO NODO, NO UN MENSAJE VACÍO: dibujado como mensaje sería
        // una burbuja en blanco que afirma que al lead le llega algo.
        const operacion = (p.accion?.operacion ?? '').trim();
        t = {
          ...base, tipo: 'accion', familia: 'contenido', titulo: TITULO.accion, icono: '⚡', puertos, alto: ALTO_MIN + 14,
          detalle: operacion ? (op.tituloAccion?.(operacion) || operacion) : 'Sin elegir',
          ...(operacion ? {} : { advertencia: 'Falta elegir la acción' }),
        };
      } else {
        const email = p.canal === 'email';
        const titulo = tituloDeTarjeta(p, enRespuesta.has(id));
        // La identidad de la app (decisión 5): el logo de WhatsApp para todo lo que sale por ahí
        // —texto, audio, archivo o escrito por MaKo— y el sobre de Gmail para el email.
        const icono = email ? ICONO_GMAIL : 'whatsapp';
        const vacio = mensajeVacio(p);
        const audio = p.tipo === 'audio' && Number(p.audio_id) > 0 ? op.audioDe?.(Number(p.audio_id)) : undefined;
        t = {
          ...base, tipo: 'mensaje', familia: 'contenido', titulo, icono, canal: email ? 'email' : 'whatsapp',
          puertos, alto: altoDeMensaje(p, audio), ...(vacio ? { advertencia: 'Sin escribir' } : {}),
        };
      }
    }
    if (!alcanzable.has(id) && !t.advertencia) t = { ...t, advertencia: 'Tarjeta suelta' };
    // Lo de ANTES que quedó en un paso de un flujo ya convertido (una espera en
    // `delay_horas`, un `requiere`): el motor lo sigue haciendo y la tarjeta no lo muestra,
    // así que se marca en vez de esconderlo.
    if ((c === 'mensaje' || c === 'accion') && (Number(p.delay_horas) > 0 || p.ancla === 'reunion' || !!p.requiere) && !t.advertencia) {
      t = { ...t, advertencia: 'Tiene una espera o condición de antes' };
    }
    tarjetas.set(id, t);
  });

  // ── La tarjeta CRON: el disparador, con sus DOS filas (decisión 1) ──
  // «Al entrar» es la salida (`sig`) y de ella salen las flechas en paralelo del CRON; «Si
  // responde» es el evento, y vacía su ＋ crea la tarjeta. Las dos se dibujan SIEMPRE: una fila
  // que aparece sólo a veces es un lugar que nadie encuentra.
  //
  // ⚠️ CUARTA TANDA, PUNTO 4: «No tiene sentido que el CRON tenga la opción de "Si responde"... Eso es
  // una CONDITION... se va el texto "Si responde" del CRON, y también quita el texto "Al entrar"». El
  // CRON nuevo no tiene filas: de él salen varias flechas (en paralelo) desde la cabecera. Sólo un
  // flujo que YA tiene «Si responde» (los convertidos de la primera tanda) lo sigue dibujando con
  // sus dos filas: sacarlo cambiaría qué hace hoy una secuencia prendida.
  const lineasCron = Math.min(2, Math.max(1, renglonesDe(op.disparador, 34)));
  const salidaCron = { id: 'sig', vacio: !raiz, ...(raiz && admiteParalelo(iIni) ? { paralelo: true } : {}) };
  tarjetas.set(ID_ENTRADA, {
    id: ID_ENTRADA, tipo: 'entrada', familia: 'contenido', titulo: TITULO.cron, icono: ICONO_CRON, detalle: op.disparador,
    puertos: resp
      ? [{ ...salidaCron, rotulo: 'Al entrar' }, { id: PUERTO_RESPUESTA, rotulo: 'Si responde', vacio: false }]
      : [salidaCron],
    ancho: ANCHO_NODO, alto: (resp ? ALTO_CRON_BASE : ALTO_CRON_SIN_FILAS) + lineasCron * RENGLON_DETALLE,
  });

  // ── El árbol: a quién le cuelga cada uno (el PRIMERO que lo alcanza gana) ──
  // Con un grafo válido cada nodo tiene un padre; mientras se edita puede no serlo, y un
  // nodo con dos padres se dibuja UNA vez (las dos flechas igual se ven).
  //
  // Los hijos del CRON son [la salida principal, …sus flechas en paralelo, «Si responde»]: en
  // ese orden se apilan, así «Si responde» queda debajo de la salida y de los paralelos.
  const destinosDe = (id: string): Array<string | null> => {
    if (id !== ID_ENTRADA) return puertosDe(pasos, indicePorId(pasos, id)).map((pt) => pt.destino);
    const salida = iIni >= 0 ? puertosDe(pasos, iIni).map((pt) => pt.destino) : [raiz];
    return [...salida, resp];
  };
  const hijos = new Map<string, string[]>();
  const asignado = new Set<string>();
  const armar = (id: string) => {
    const hs: string[] = [];
    for (const d of destinosDe(id)) {
      if (d && existe.has(d) && d !== ID_ENTRADA && !asignado.has(d)) { asignado.add(d); hs.push(d); }
    }
    hijos.set(id, hs);
    for (const h of hs) armar(h);
  };
  // Varias salidas: las que tienen filas (condición, «Si responde», el CRON) y toda tarjeta con
  // flechas en paralelo (sus hijos son [siguiente, …paralelos] y se apilan igual).
  const esMulti = (id: string) => {
    if (id === ID_ENTRADA) return true;
    const c = claseDe(pasos[indicePorId(pasos, id)]);
    return c === 'condicion' || c === 'respuesta' || (hijos.get(id)?.length ?? 0) > 1;
  };
  // El ancla es de donde SALEN las flechas: el centro de las filas, o la cabecera de una tarjeta
  // de una sola salida (con paralelos, todas salen del mismo punto).
  const anclaDe = (id: string) => {
    const t = tarjetas.get(id)!;
    if (!esMulti(id)) return 0;
    return tieneFilas(t) ? centroDeFilas(t.alto, t.puertos?.length ?? 0) : Math.min(t.alto / 2, 44);
  };

  // `sobre`: cuánto se extiende el subárbol ARRIBA del tope del nodo; `bajo`: hasta dónde
  // llega por debajo de ese tope. Un nodo simple pone a su hijo a SU altura (la cadena es
  // una fila derecha); uno de varias salidas apila a sus hijos centrados en sus filas.
  const medidas = new Map<string, { sobre: number; bajo: number }>();
  const bloque = (hs: string[]) => hs.reduce((s, h) => s + medidas.get(h)!.sobre + medidas.get(h)!.bajo, 0) + GAP_Y * Math.max(0, hs.length - 1);
  const medir = (id: string): { sobre: number; bajo: number } => {
    const alto = tarjetas.get(id)!.alto;
    const hs = hijos.get(id) ?? [];
    hs.forEach(medir);
    let m: { sobre: number; bajo: number };
    if (!hs.length) m = { sobre: 0, bajo: alto };
    else if (!esMulti(id)) { const h = medidas.get(hs[0])!; m = { sobre: h.sobre, bajo: Math.max(alto, h.bajo) }; }
    else {
      const T = bloque(hs);
      const top = anclaDe(id) - T / 2;
      m = { sobre: Math.max(0, -top), bajo: Math.max(alto, top + T) };
    }
    medidas.set(id, m);
    return m;
  };
  const pos = new Map<string, { x: number; y: number }>();
  const colocar = (id: string, x: number, y: number) => {
    pos.set(id, { x, y });
    const hs = hijos.get(id) ?? [];
    if (!hs.length) return;
    const x2 = x + ANCHO_NODO + GAP_COLUMNA;
    if (!esMulti(id)) { colocar(hs[0], x2, y); return; }
    let cur = y + anclaDe(id) - bloque(hs) / 2;
    for (const h of hs) {
      const m = medidas.get(h)!;
      colocar(h, x2, cur + m.sobre);
      cur += m.sobre + m.bajo + GAP_Y;
    }
  };

  // 1. El CRON y todo lo que cuelga de él: la salida, sus paralelos y «Si responde» (columna 1).
  asignado.add(ID_ENTRADA); armar(ID_ENTRADA);
  const mCron = medir(ID_ENTRADA);
  colocar(ID_ENTRADA, 0, 0);
  let cursor = mCron.bajo + GAP_RAICES;

  // 2. Lo que no cuelga de ninguna raíz (el destino de un salto sin padre, una tarjeta
  //    suelta, un ciclo), abajo de todo y en el orden del array. El inicio no: ES el CRON.
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (asignado.has(id) || i === iIni) continue;
    asignado.add(id); armar(id);
    const m = medir(id);
    colocar(id, 0, cursor + m.sobre);
    cursor += m.sobre + m.bajo + GAP_RAICES;
  }

  const nodos: NodoFlujo[] = [];
  for (const id of [ID_ENTRADA, ...ids.filter((_, i) => i !== iIni)]) {
    const p = pos.get(id);
    if (p) nodos.push({ ...tarjetas.get(id)!, ...p });
  }

  // ── Las flechas: una por salida con destino, desde SU puerto ──
  // Las del inicio salen del CRON (es el mismo id: «Al entrar»). Sin inicio, la flecha del CRON a
  // la salida se arma a mano. Las flechas EN PARALELO van con otro tono (`condicional`: punteada,
  // en el color primario) para que se lea que corren a la vez, no una después de la otra.
  const aristas: AristaFlujo[] = [];
  if (iIni < 0 && raiz && pos.has(raiz)) aristas.push({ desde: ID_ENTRADA, hasta: raiz, puerto: 'sig', tono: 'normal' });
  pasos.forEach((_, i) => {
    for (const pt of puertosDe(pasos, i)) {
      if (pt.destino && pos.has(pt.destino)) {
        aristas.push({ desde: i === iIni ? ID_ENTRADA : ids[i], hasta: pt.destino, puerto: pt.puerto, tono: pt.puerto.startsWith('par:') ? 'condicional' : 'normal' });
      }
    }
  });
  // «Si responde», desde su fila del CRON. SIN el ＋ del medio: nada puede ir antes de «Si
  // responde» (no tiene padre), así que insertar ahí sería un control que no se puede publicar.
  if (resp && pos.has(resp)) aristas.push({ desde: ID_ENTRADA, hasta: resp, puerto: PUERTO_RESPUESTA, tono: 'normal', sinMas: true });

  const normal = aOrigen(nodos, MARGEN);
  return { nodos: normal, aristas, ...encerrar(normal) };
}

// ── Editar: lo que hace cada ＋ ─────────────────────────────────────────────────────

/**
 * Lo que el ＋ CREA. Sin «Ir a» desde la tercera tanda (decisión 3; pedido literal: «No se entiende
 * lo de "Ir a" eso para mi no tiene mucho sentido. Eliminalo»). Los «Ir a» que ya existen (la 198
 * salta a la 212, el que junta ramas) se siguen dibujando, corriendo y borrando: lo que se va es
 * crearlos. Con «MaKo» (decisión 11): la ⚡ Acción `avisar_al_equipo`, dibujada como su tarjeta.
 */
export type QueAgregar = 'mensaje' | 'email' | 'esperar' | 'condicion' | 'etiqueta' | 'accion' | 'mako';
/** Lo que ofrece el ＋ de un lugar: lo que se inserta, y en la fila «Si responde» del CRON, crearla. */
export type QueAgregarEn = QueAgregar | 'respuesta';
/** Una opción del menú del ＋ (estructural: `DropdownOption` vive en un componente). `grupo` separa
 *  el menú con una línea; `icono` es un SVG (`data:`), nunca un emoji. */
export type OpcionMas = { value: QueAgregarEn; label: string; icono?: string; grupo?: number };

/** Un SVG chico como `data:` para un renglón del menú. */
const svg = (cuerpo: string, viewBox = '0 0 24 24') =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${cuerpo}</svg>`)}`;
const LINEA = 'fill="none" stroke="#4C5363" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

/**
 * Los íconos del ＋ (cuarta tanda, punto 10: «pon ÍCONOS no emojis, y los logos de WhatsApp y Gmail
 * en ese caso. Y revisa que el ícono de MaKo está mal, no es la estrella de siempre»). La estrella es
 * la chispa de `MakoLogo` (`SPARK` en app/_components/MakoBrand.tsx), en el dorado de `--mako`.
 */
export const ICONOS_MAS = {
  whatsapp: svg('<path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/><path fill="#fff" d="M8.6 7.2c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.4.6c-.2.2-.3.4-.1.7.3.5 1 1.4 1.6 1.9.8.7 1.5 1 1.8 1.1.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.3.1.4.2.4.4 0 .3-.1 1.1-.6 1.6-.5.5-1.3.8-1.9.8-.6 0-2.3-.3-4.3-2.1-2.3-2-2.9-3.9-3-4.4-.1-.6.1-1.7.6-2.2z"/>'),
  email: svg('<rect x="2" y="5" width="20" height="14" rx="2.5" fill="#fff" stroke="#EA4335" stroke-width="1.6"/><path d="M3.2 6.4 12 13l8.8-6.6" fill="none" stroke="#EA4335" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'),
  esperar: svg(`<path ${LINEA} d="M7 3h10M7 21h10M8 3v2.5c0 1.6 1.2 2.8 4 4.5 2.8-1.7 4-2.9 4-4.5V3M8 21v-2.5c0-1.6 1.2-2.8 4-4.5 2.8 1.7 4 2.9 4 4.5V21"/>`),
  condicion: svg(`<g ${LINEA}><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 4-3 6-12 8"/></g>`),
  etiqueta: svg(`<g ${LINEA}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.4"/></g>`),
  accion: svg(`<path ${LINEA} d="M13 2 4 14h7l-1 8 9-12h-7z"/>`),
  mako: svg('<path fill="#F2B01E" d="M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z"/>', '-12 -12 24 24'),
} as const;

/**
 * El menú del ＋, por grupos separados con una línea (cuarta tanda, punto 10):
 *   mensajes (WhatsApp, Email) · tiempo y lógica (Esperar, Condición) · CRM (Etiqueta, Acción) ·
 *   MaKo en WhatsApp.
 *
 * · «WhatsApp» y no «Mensaje»: desde que el ＋ también crea un email, «mensaje» no dice por
 *   dónde sale.
 * · Debajo de un «Si responde» que ya existe no hay «Email» ni «Esperar»: se contesta en el momento
 *   y por el chat donde el lead escribió (`validarGrafo` rechaza la espera).
 * · «Si responde» y «Ir a» NO se ofrecen (cuarta tanda, puntos 4 y 12: «Elimina las tarjetas de
 *   "Reply" y "Go to"... si alguien quiere configurar que la automatización se detenga cuando alguien
 *   contesta, ya lo puede hacer con CONDITION»). Los que ya existen se dibujan, corren y se borran.
 */
export function opcionesDelMas(pasos: readonly PasoGrafo[], nodoLienzo: string, medio: boolean, puerto?: string): OpcionMas[] {
  void medio; void puerto;
  const resp = raizRespuesta(pasos);
  const enRespuesta = nodoLienzo !== ID_ENTRADA && (nodoLienzo === resp || subarbolRespuesta(pasos).has(nodoLienzo));
  return [
    { value: 'mensaje', label: 'WhatsApp', icono: ICONOS_MAS.whatsapp, grupo: 0 },
    ...(enRespuesta ? [] : [{ value: 'email' as const, label: 'Email', icono: ICONOS_MAS.email, grupo: 0 }, { value: 'esperar' as const, label: 'Esperar', icono: ICONOS_MAS.esperar, grupo: 1 }]),
    { value: 'condicion', label: 'Condición', icono: ICONOS_MAS.condicion, grupo: 1 },
    { value: 'etiqueta', label: 'Etiqueta', icono: ICONOS_MAS.etiqueta, grupo: 2 },
    { value: 'accion', label: 'Acción', icono: ICONOS_MAS.accion, grupo: 2 },
    { value: 'mako', label: 'MaKo en WhatsApp', icono: ICONOS_MAS.mako, grupo: 3 },
  ];
}

/** Los campos que `setSecuenciaPasos` exige a todo paso, incluido uno de control. */
const relleno = () => ({ orden: 0, canal: 'whatsapp' as string, delay_horas: 0, asunto: null as string | null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' as const });

/**
 * Una tarjeta nueva, ya con id.
 *
 * ⚠️ NINGÚN MENSAJE NACE CON ESPERA (punto 7: «Por defecto entre el CRON y la siguiente
 * tarjeta ponés siempre un delay, cuando no debe ser así... Eso lo debe configurar el
 * usuario»). Hasta el 08/10 un mensaje nuevo nacía con `delay_horas: 24` en DOS lugares
 * de SecuenciaPerfil, y el delay se dibujaba sobre la flecha sin forma de quitarlo. Ahora
 * la espera es una tarjeta que se agrega a propósito.
 */
export function nodoNuevo(que: QueAgregar, pasos: readonly PasoGrafo[], rnd: () => number = Math.random): PasoParaGrafo & ReturnType<typeof relleno> {
  const id = nuevoId(pasos, rnd);
  const b = { ...relleno(), id };
  switch (que) {
    case 'esperar': return { ...b, nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 } };
    // ⚠️ LA RAMA NACE SIN FILAS (tercera tanda, punto 9): una fila «Agendó» de relleno era de donde
    // salían las filas repetidas de la captura. La fila se agrega al ELEGIR la condición
    // (EditorCondicion), y una rama vacía la frena `validarGrafo` hasta entonces («Elige una condición»).
    case 'condicion': {
      const rama = nuevoId([...pasos, { id }], rnd);
      return { ...b, nodo: 'condicion', ramas: [{ id: rama, modo: 'todas', filas: [], siguiente: null }], si_no: null };
    }
    case 'accion': return { ...b, accion: { operacion: '', params: {} } };
    // Un email: el mismo paso con su canal, el asunto y la vista previa vacíos (los pide el editor
    // tipo Gmail; sin asunto, `faltaEscribir` no lo deja publicar).
    case 'email': return { ...b, canal: 'email', asunto: '', preheader: '', cuerpo: '' };
    // La etiqueta es la ⚡ Acción de poner una etiqueta, sobre el lead del EVENTO (decisión 8): nace
    // «Poner» y sin etiqueta elegida, y así no se puede publicar hasta elegir una.
    case 'etiqueta': return { ...b, accion: { operacion: OP_PONER_ETIQUETA, params: { leadId: LEAD_DEL_EVENTO } } };
    // La tarjeta MAKO (decisión 11): el aviso al grupo del negocio, sobre el lead del EVENTO (el aviso
    // lleva su nombre, su teléfono y el link a su ficha). Nace sin mensaje: `faltaEscribir` lo frena.
    case 'mako': return { ...b, accion: { operacion: OP_AVISAR, params: { leadId: LEAD_DEL_EVENTO, mensaje: '' } } };
    default: return b;
  }
}

/**
 * Dónde inserta el ＋ de un nodo del lienzo.
 *
 *   · El del CRON en «Al entrar» (vacía), al principio de la salida.
 *   · El de una salida con el punto OCUPADO que ofrece paralelo (`puerto: 'par'`): una flecha en
 *     paralelo NUEVA. Desde el CRON es `{ nodo: ID_INICIO, puerto: 'par' }`, exista o no el
 *     inicio: `insertarNodo` lo crea con la primera.
 *   · El del MEDIO de una flecha en paralelo (`puerto: 'par:<id>'`): la tarjeta nueva queda en el
 *     medio de ESA flecha.
 *   · El de la fila de un RESULTADO de una condición con el punto ocupado (`puerto: 'par@<resultado>'`,
 *     cuarta tanda, punto 8): una flecha en paralelo NUEVA desde ese resultado; y el del medio de una
 *     de ellas (`'par:<id>@<resultado>'`). Viajan tal cual: `insertarNodo` los entiende.
 */
export function lugarDesdeLienzo(nodo: string, puerto?: string): LugarInsercion {
  if (nodo === ID_ENTRADA) {
    if (puerto === 'par' || puerto?.startsWith('par:')) return { nodo: ID_INICIO, puerto };
    return { inicio: true };
  }
  return { nodo, puerto: puerto || 'sig' };
}

/** El orden del array es el orden de lectura (`orden`, las métricas por paso). */
export function renumerar<P extends PasoGrafo>(pasos: readonly P[]): P[] {
  return pasos.map((p, i) => ({ ...p, orden: i + 1 }));
}

/**
 * EL ＋ DE UN PUERTO INSERTA EN ESE PUERTO. Lo que colgaba de esa salida pasa a colgar de
 * la tarjeta nueva (`insertarNodo`). Devuelve el id nuevo, o null si no se insertó.
 *
 * Antes el ＋ del medio de una flecha insertaba «después del nodo de origen», que con N
 * salidas es ambiguo: el ＋ de la rama de abajo agregaba en la de arriba.
 */
export function insertarDesdeLienzo<P extends PasoParaGrafo>(
  pasos: readonly P[], nodo: string, puerto: string | undefined, que: QueAgregar, rnd: () => number = Math.random,
): { pasos: P[]; id: string | null } {
  const base = normalizar(pasos);
  const lugar = lugarDesdeLienzo(nodo, puerto);
  // (Hasta la tercera tanda acá se frenaba un «Ir a» en una salida ocupada. El ＋ ya no crea «Ir a»:
  // decisión 3.)
  const nuevo = nodoNuevo(que, base, rnd) as unknown as P;
  const out = insertarNodo(base, lugar, nuevo);
  if (!out.some((p) => p.id === nuevo.id)) return { pasos: base, id: null };
  return { pasos: renumerar(out), id: nuevo.id! };
}

/** Saca un subárbol entero (con los saltos que apuntaban adentro) y corta las salidas que
 *  lo apuntaban. Es lo que hace quitar una rama o un caso: no hay una tarjeta de abajo con
 *  más derecho que otra a quedarse, y el deshacer lo devuelve. */
export function sacarSubarbol<P extends PasoGrafo>(pasos: readonly P[], raiz: string | null | undefined): P[] {
  const base = normalizar(pasos);
  if (!raiz || indicePorId(base, raiz) < 0) return base;
  const quitar = new Set<string>([raiz, ...descendientes(base, raiz)]);
  for (const q of base) if (claseDe(q) === 'ir_a' && q.destino && 'nodo' in q.destino && quitar.has(q.destino.nodo)) quitar.add(q.id!);
  let out = base.filter((q) => !quitar.has(q.id!));
  for (let i = 0; i < out.length; i++) {
    for (const pt of puertosDe(out, i)) if (pt.destino && quitar.has(pt.destino)) out = conectarPuerto(out, out[i].id!, pt.puerto, null);
  }
  return out;
}

/**
 * LAS TARJETAS A LAS QUE PUEDE SALTAR UN «IR A» (en el orden del array).
 *
 * ⚠️ DESDE LA SALIDA, SÓLO LAS DE SU PROPIO HILO (segunda tanda): con flechas en paralelo, un
 * «Ir a» a la tarjeta de OTRO hilo pone dos cursores en la misma tarjeta y al lead le llega el
 * mismo mensaje dos veces. `validarGrafo` lo rechaza al publicar; ofrecerlo en el desplegable
 * sería un control que no se puede guardar. Desde «Si responde» se ofrecen todas: la respuesta
 * pausa todo y retoma UN solo hilo. Un «Ir a» suelto (sin hilo todavía) también las ve todas.
 *
 * ⚠️ Y NINGUNA QUE ARME UN BUCLE CON UNA TARJETA QUE REPARTE. Con m1 sacando una flecha en
 * paralelo, un «Ir a» puesto después de la espera ofrecía m1, y elegirla armaba el bucle que
 * `validarGrafo` rechaza («saca flechas en paralelo dentro de un bucle»). Se pregunta con la MISMA
 * regla (`repartenEnBucle`) sobre el flujo con ese destino puesto, contra el mismo flujo con el
 * «Ir a» sin destino: así un bucle que ya estaba mal por otro lado no esconde todas las opciones,
 * y el destino que tiene puesto, si el resto está bien, sigue en la lista.
 *
 * Nunca a sí mismo, a otro «Ir a», a «Si responde» ni al CRON (volver a entrar no es un salto).
 */
export function tarjetasParaIrA(pasos: readonly PasoGrafo[], irAId: string): string[] {
  const hilo = hiloDe(pasos);
  const desde = hilo.get(irAId);
  const todas = desde === undefined || desde === HILO_RESPUESTA;
  const sinDestino = cambiarNodo(pasos, irAId, { destino: undefined });
  const yaMal = repartenEnBucle(sinDestino);
  const armaBucle = (d: string): boolean => [...repartenEnBucle(cambiarNodo(pasos, irAId, { destino: { nodo: d } }))].some((x) => !yaMal.has(x));
  return pasos
    .map((p, i) => ({ p, id: idDe(p, i) }))
    .filter(({ p, id }) => {
      const c = claseDe(p);
      if (id === irAId || c === 'ir_a' || c === 'respuesta' || c === 'inicio') return false;
      return (todas || hilo.get(id) === desde) && !armaBucle(id);
    })
    .map(({ id }) => id);
}

export function cambiarNodo<P extends PasoGrafo>(pasos: readonly P[], id: string, patch: Partial<P>): P[] {
  return pasos.map((p, i) => (idDe(p, i) === id ? { ...p, ...patch } : p));
}

/** «＋ Rama»: una rama más, al final (antes del «Si no»). Nace SIN filas, como la de `nodoNuevo`. */
export function agregarRama<P extends PasoGrafo>(pasos: readonly P[], condId: string, rnd: () => number = Math.random): P[] {
  const c = nodoPorId(pasos, condId);
  if (!c || claseDe(c) !== 'condicion') return [...pasos];
  const rama: RamaCondicion = { id: nuevoId(pasos, rnd), modo: 'todas', filas: [], siguiente: null };
  return cambiarNodo(pasos, condId, { ramas: [...(c.ramas ?? []), rama] } as Partial<P>);
}

export function quitarRama<P extends PasoGrafo>(pasos: readonly P[], condId: string, ramaId: string): P[] {
  const c = nodoPorId(pasos, condId);
  const r = c?.ramas?.find((x) => x.id === ramaId);
  if (!c || !r) return [...pasos];
  const sin = sacarSubarbol(pasos, r.siguiente);
  const c2 = nodoPorId(sin, condId)!;
  return cambiarNodo(sin, condId, { ramas: (c2.ramas ?? []).filter((x) => x.id !== ramaId) } as Partial<P>);
}

/**
 * «+ caso»: un caso nuevo NACE CON SU TARJETA «MaKo contesta» (un mensaje `tipo: 'ia'`
 * cuyo cuerpo es CÓMO responder). Es lo que el motor lee como guía del caso
 * (`escenariosDeRespuesta`): un caso sin su tarjeta sería una rama que no contesta nada.
 *
 * ⚠️ Y NACE CON `revisar: true` EXPLÍCITO (revisión, costuras-3). Para un «MaKo contesta» de
 * «Si responde» el motor contesta solo SÓLO con `revisar === false` (`escenariosDeRespuesta` →
 * `contestaSolo`); ausente, deja un borrador. Sin el valor puesto, la casilla heredaba el
 * `envio_automatico` de la secuencia y en las post-agenda del ws1 decía «sale sola» sobre un
 * caso que dejaba borradores. Es lo mismo que hacen el conversor y `agregarCasoAlGrafo`.
 */
export function agregarCaso<P extends PasoGrafo>(pasos: readonly P[], respId: string, rnd: () => number = Math.random): { pasos: P[]; mensaje: string | null } {
  const base = normalizar(pasos);
  const r = nodoPorId(base, respId);
  if (!r || claseDe(r) !== 'respuesta') return { pasos: base, mensaje: null };
  const msgId = nuevoId(base, rnd);
  const msg = { ...relleno(), id: msgId, tipo: 'ia', revisar: true, siguiente: null } as unknown as P;
  const casoId = nuevoId([...base, msg], rnd);
  const conCaso = cambiarNodo(base, respId, { casos: [...(r.casos ?? []), { id: casoId, titulo: '', cuando: '', siguiente: msgId }] } as Partial<P>);
  const i = indicePorId(conCaso, respId);
  const out = [...conCaso.slice(0, i + 1), msg, ...conCaso.slice(i + 1)];
  return { pasos: renumerar(out), mensaje: msgId };
}

export function quitarCaso<P extends PasoGrafo>(pasos: readonly P[], respId: string, casoId: string): P[] {
  const r = nodoPorId(pasos, respId);
  const caso = r?.casos?.find((x) => x.id === casoId);
  if (!r || !caso) return [...pasos];
  const sin = sacarSubarbol(pasos, caso.siguiente);
  const r2 = nodoPorId(sin, respId)!;
  return renumerar(cambiarNodo(sin, respId, { casos: (r2.casos ?? []).filter((x) => x.id !== casoId) } as Partial<P>));
}

/**
 * La tarjeta «Si responde», si no la hay. Nace sin casos y con «Otra cosa» ya puesta en
 * una Acción que avisa al equipo: es lo que hacía el hand-off de antes (MaKo se calla y
 * te avisa), y una respuesta que no encaja en nada no puede quedar sin nadie que la mire.
 */
export function crearRespuesta<P extends PasoGrafo>(pasos: readonly P[], rnd: () => number = Math.random): { pasos: P[]; id: string } {
  const base = normalizar(pasos);
  const hay = raizRespuesta(base);
  if (hay) return { pasos: base, id: hay };
  const avisoId = nuevoId(base, rnd);
  const aviso = { ...relleno(), id: avisoId, accion: { operacion: OP_AVISAR, params: { leadId: 'evento', mensaje: 'Te escribió algo que no sé contestar' } }, siguiente: null } as unknown as P;
  const respId = nuevoId([...base, aviso], rnd);
  const resp = { ...relleno(), id: respId, nodo: 'respuesta', casos: [], si_no: avisoId } as unknown as P;
  return { pasos: renumerar([...base, resp, aviso]), id: respId };
}

/**
 * La estrategia que se publica cuando la secuencia se CONVIRTIÓ (`legadoAGrafo`): la de
 * siempre con la LIMPIEZA encima, entera. `guardar-estrategia` reescribe el objeto
 * completo y lo que no viaja vuelve a su default (AGENTS.md: un campo nuevo en un objeto
 * que se guarda ENTERO), así que se manda todo lo que había.
 *
 * ⚠️ SIN ESTRATEGIA NO HAY NADA QUE LIMPIAR, y devuelve null (revisión, lienzo-8). Hasta el
 * 08/10 inventaba `{ objetivo: 'agendar', … }` donde no había nada: una secuencia de
 * `crearSecuenciaDesdeEtapa` (convertida por su espera de 48 h) pasaba a tener objetivo, y
 * desde ahí `encadenar()` salteaba a todo lead que ya agendó (`ya-hizo-agendar`). Quien
 * publica no manda `guardar-estrategia` con null; el script de migración hace lo mismo.
 */
export function estrategiaConLimpieza<E extends EstrategiaLegada>(est: E): Record<string, unknown> | null {
  if (!est) return null;
  return { objetivo: 'agendar', ...est, ...limpiezaPara(est) };
}

/**
 * EL «REVISAR ANTES DE ENVIAR» QUE UN MENSAJE HEREDA cuando no tiene `revisar` propio: lo que
 * el MOTOR hace con él, no lo que dice la secuencia a secas (revisión, costuras-3).
 *
 *   · Un «MaKo contesta» (`tipo: 'ia'`) de «Si responde» contesta solo SÓLO con
 *     `revisar === false` (`escenariosDeRespuesta` → `contestaSolo`): ausente = borrador.
 *   · Todo lo demás —la salida, y el texto, el audio o el archivo de una rama— usa
 *     `saleSolo(p, envio_automatico)` (lib/nutricion-grafo-motor.ts): ausente = la secuencia.
 *
 * Con la casilla pintada desde `envio_automatico` para todo, un caso viejo sin `revisar`
 * decía «sale sola» y el motor dejaba un borrador.
 */
export function revisarHeredado(pasos: readonly PasoGrafo[], id: string, envioAutoSecuencia: boolean): boolean {
  const p = nodoPorId(pasos, id);
  if (p && claseDe(p) === 'mensaje' && p.tipo === 'ia' && subarbolRespuesta(pasos).has(id)) return true;
  return !envioAutoSecuencia;
}

/**
 * ¿ESTE CAMBIO DEL EDITOR DEL MENSAJE ENTRA A LA PILA DE DESHACER? Tipear no entra (el Ctrl+Z
 * del texto es del navegador, y una foto por tecla vacía la pila); cambiar de audio, de
 * archivo, de tipo o de «Revisar», sí.
 *
 * ⚠️ LAS VARIANTES («↻ N») SON TEXTO MIENTRAS NO CAMBIE CUÁNTAS HAY (revisión, costuras-9 y
 * lienzo-7). Cada tecla en una variante manda `{ variantes }`, y contada como cambio apilaba
 * una foto por tecla: con el tope de 30, escribir una variante de 30 letras tiraba la foto de
 * antes de borrar una rama, y ↶ deshacía la variante letra por letra. Quitar una (cambia el
 * largo) sí entra.
 */
export function cambioApila(patch: Record<string, unknown>, paso: { variantes?: string[] | null }): boolean {
  const largo = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  return !Object.keys(patch).every((k) =>
    k === 'cuerpo' || k === 'asunto' || (k === 'variantes' && largo(patch.variantes) === largo(paso.variantes)));
}

/** Lo que la tarjeta necesita de un archivo de la biblioteca (`AdjuntoDto`, estructural). */
export type ArchivoParaTarjeta = { id: number; titulo: string; media_mime: string; nombre_archivo: string | null; url: string | null };

/**
 * QUÉ DIBUJA LA TARJETA DE UN ARCHIVO (revisión, costuras-6). Hasta el 08/10 le pasaba a la
 * burbuja un archivo con `url: null` y la burbuja decía «(no disponible)» —o «document (no
 * disponible)», en inglés— sobre un PDF bien subido.
 *
 *   · `documento`: la biblioteca lo tiene y con su URL. Siempre como documento (nombre +
 *     caption), también una foto: una miniatura cambiaría el alto, que es fijo y se calcula
 *     antes de pintar (`altoDeMensaje`).
 *   · `fila` sin `falta`: no se pudo saber (cargando, no se pudo leer, quien mira no es admin).
 *     Dice «Archivo» y no afirma nada.
 *   · `fila` con `falta`: la biblioteca se leyó y el archivo no está. Eso sí se dice.
 *
 * `biblioteca`: la lista leída, `'error'` si no se pudo leer, o null mientras carga.
 */
export function vistaDeArchivo(mediaId: number | null | undefined, biblioteca: readonly ArchivoParaTarjeta[] | 'error' | null):
  | { modo: 'documento'; url: string; mime: string; nombre: string }
  | { modo: 'fila'; nombre: string; falta: boolean } {
  const lista = Array.isArray(biblioteca) ? biblioteca : null;
  const adj = lista && mediaId != null ? lista.find((a) => a.id === Number(mediaId)) ?? null : null;
  const nombre = adj ? (adj.nombre_archivo?.trim() || adj.titulo?.trim() || 'Archivo') : 'Archivo';
  if (adj?.url) return { modo: 'documento', url: adj.url, mime: adj.media_mime, nombre };
  if (lista && !adj) return { modo: 'fila', nombre: 'Un archivo que ya no está', falta: true };
  return { modo: 'fila', nombre, falta: false };
}

/**
 * EL NOMBRE DE UNA ETIQUETA COMO SE DICE EN EL LIENZO: la archivada que sigue puesta, con
 * «(archivada)» (decisión del 08/10: archivar la apaga —el motor ya no la cuenta en las
 * condiciones ni en los disparadores— y la pantalla lo dice donde todavía está puesta).
 * null = no está en la lista (todavía cargando, o borrada).
 */
export function nombreEtiqueta(etiquetas: readonly EtiquetaParaDisparo[], id: number | null | undefined): string | null {
  const t = id == null ? null : etiquetas.find((x) => x.id === Number(id));
  if (!t) return null;
  return t.archivada_at ? `${t.nombre} (archivada)` : t.nombre;
}

// ── El desplegable del disparador ─────────────────────────────────────────────────

export type OpcionDisparo = { value: string; label: string };
export type ProductoParaDisparo = {
  funnelId: number | null; productoId: number | null; nombre: string;
  etapas: OpcionDisparo[]; etapasEntrega: OpcionDisparo[];
};
export type EtiquetaParaDisparo = { id: number; nombre: string; archivada_at?: string | null };
export type DisparoActual = {
  trigger_tipo: string; etapa?: string | null; funnel_id?: number | null;
  producto_id?: number | null; etiqueta_id?: number | null;
};

/** Un paso del desplegable del CRON: sus opciones, o los pasos de adentro (`grupos`). */
export type SeccionDisparo = { title: string; options: OpcionDisparo[]; grupos?: SeccionDisparo[] };

/** Los dos kanbans de un producto, con el nombre con que se ofrecen (decisión 4). */
export const KANBAN_ADQUISICION = 'Adquisición de clientes';
export const KANBAN_ENTREGA = 'Entrega del servicio';

/** El valor del desplegable para lo que la secuencia tiene puesto. */
export function valorDisparo(s: DisparoActual): string {
  if (s.trigger_tipo === 'etapa_actual') return `venta:${s.funnel_id ?? ''}:${s.etapa ?? ''}`;
  if (s.trigger_tipo === 'entrega_actual') return `entrega:${s.producto_id ?? ''}:${s.etapa ?? ''}`;
  if (s.trigger_tipo === 'etiqueta_puesta') return `etiqueta:${s.etiqueta_id ?? ''}`;
  return `trigger:${s.trigger_tipo}`;
}

/** Todas las opciones de un árbol de pasos, aplanadas (para saber si lo puesto está). */
export function opcionesDeSecciones(secs: readonly SeccionDisparo[]): OpcionDisparo[] {
  return secs.flatMap((s) => [...s.options, ...opcionesDeSecciones(s.grupos ?? [])]);
}

/**
 * LO QUE PUEDE DISPARAR UNA AUTOMATIZACIÓN, EN UN DESPLEGABLE POR PASOS (tercera tanda, decisión 4).
 *
 * Pedido literal: «En el CRON, deben aparecer en el desplegable los productos, solo el nombre de los
 * mismos. Luego, al ingresar, 2 opciones: "Entrega de Servicio" o "Adquisición de Cliente", y dentro
 * las etapas de cada kanban. SI solo tiene un producto, el primer paso se omite... Elimina lo de
 * "Eventos" todo eso debería ir dentro del editable del CONDICIONAL».
 *
 *   · PRODUCTO (sólo el nombre) → «Adquisición de clientes» (las etapas del EMBUDO, lo de antes de
 *     comprar) o «Entrega del servicio» (las de la ENTREGA, lo de después) → la etapa. Con un solo
 *     producto, el primer paso no está. Un producto sin embudo no tiene «Adquisición»; uno sin
 *     entrega declarada, no tiene «Entrega»: un paso sin nada adentro es un callejón.
 *   · «Etiquetas» queda como un paso más al final (primera tanda, punto 12: «debería también poder
 *     salir acciones y CRON desde etiquetas»). No es un evento.
 *   · Los EVENTOS del catálogo (`TRIGGERS`: «dejó el formulario», «agendó»…) ya no se ofrecen: pasan a
 *     las condiciones. Una automatización que ya dispara por uno lo sigue mostrando como lo que es
 *     («La que tiene puesta»), sin ofrecerlo.
 *
 * Hasta el 09/10 era una lista de secciones planas: «Eventos», «Etapa · <producto>» y «Entrega ·
 * <producto>», una por cada combinación, y con tres productos eran siete secciones en la raíz.
 *
 * ⚠️ Y LA QUE ESTÁ PUESTA ENTRA SIEMPRE: un valor que no está entre las opciones se dibuja
 * como la primera y el primer clic lo pisa (AGENTS.md, el `<select>` que borra datos).
 * `disparadores` sigue entrando: es con lo que `textoActual` dice un evento de antes.
 */
export function pasosDisparo(op: OpcionesDisparo): SeccionDisparo[] {
  // ⚠️ CUARTA TANDA, PUNTO 2: «no tiene sentido la opción "La que tiene puesta"... te pido que las
  // opciones sean: "Productos" / "Etiquetas". Y ahí venga todo el resto». La raíz son DOS pasos:
  // «Productos» (producto → adquisición o entrega → etapa; con un solo producto, el producto no está)
  // y «Etiquetas». Lo que ya está puesto y no está en la lista (un evento de antes) lo sigue diciendo
  // el BOTÓN (`rotuloDisparo` cae a `textoActual`), y nada lo pisa hasta que se elija otra cosa: el
  // desplegable de la casa no es un `<select>`.
  const conAlgo = op.productos.filter((pr) => kanbansDe(pr).length > 0);
  const secciones: SeccionDisparo[] = [];
  if (conAlgo.length > 1) secciones.push({ title: PASO_PRODUCTOS, options: [], grupos: conAlgo.map((pr) => ({ title: pr.nombre, options: [], grupos: kanbansDe(pr) })) });
  else if (conAlgo.length === 1) secciones.push({ title: PASO_PRODUCTOS, options: [], grupos: kanbansDe(conAlgo[0]) });
  const etiquetas = seccionEtiquetas(op);
  if (etiquetas) secciones.push(etiquetas);
  return secciones;
}

/** El primer paso del CRON: los productos (cuarta tanda, punto 2). */
export const PASO_PRODUCTOS = 'Productos';

/** Las etiquetas que pueden disparar (las vivas), o null si no hay ninguna. */
function seccionEtiquetas(op: Pick<OpcionesDisparo, 'etiquetas'>): SeccionDisparo | null {
  const vivas = op.etiquetas.filter((t) => !t.archivada_at);
  return vivas.length ? { title: 'Etiquetas', options: vivas.map((t) => ({ value: `etiqueta:${t.id}`, label: `Se le puso «${t.nombre}»` })) } : null;
}

/** Lo que entra a `pasosDisparo` y a `seccionesDisparo`. */
export type OpcionesDisparo = {
  disparadores: readonly OpcionDisparo[];
  productos: readonly ProductoParaDisparo[];
  etiquetas: readonly EtiquetaParaDisparo[];
  actual: DisparoActual;
  /** Cómo se dice lo que está puesto (`detalleDisparador`), para cuando no está en la lista. */
  textoActual: string;
};

/**
 * Los dos kanbans de UN producto con sus etapas. Sólo los productos con EMBUDO tienen etapas de venta:
 * un servicio sin embudo tiene `funnelId` null y sólo trae las de su entrega. Lo leen los dos armados
 * (`pasosDisparo` y `seccionesDisparo`): un valor (`venta:<embudo>:<etapa>`) se escribe en UN lugar.
 */
function kanbansDe(pr: ProductoParaDisparo): SeccionDisparo[] {
  const out: SeccionDisparo[] = [];
  if (pr.funnelId != null && pr.etapas.length) {
    out.push({ title: KANBAN_ADQUISICION, options: pr.etapas.map((e) => ({ value: `venta:${pr.funnelId}:${e.value}`, label: e.label })) });
  }
  if (pr.productoId != null && pr.etapasEntrega.length) {
    out.push({ title: KANBAN_ENTREGA, options: pr.etapasEntrega.map((e) => ({ value: `entrega:${pr.productoId}:${e.value}`, label: e.label })) });
  }
  return out;
}

/**
 * LO MISMO, PLANO: una sección por kanban de cada producto («Etapa · <producto>», «Entrega ·
 * <producto>»; con un solo producto, «Etapa» y «Entrega»), con el rótulo `Llega a «X»`. Es el
 * contrato de antes de la tercera tanda, MENOS «Eventos» (decisión 4), y lo leen los que aplanan el
 * catálogo para otro lector — «Crear con IA» (`disparadoresParaIA`, lib/flujo-ia.ts, que pone el
 * título de la sección en el rótulo para no confundir dos productos con la misma etapa). El
 * desplegable del CRON usa `pasosDisparo`. Los valores salen de `kanbansDe` en los dos.
 */
export function seccionesDisparo(op: OpcionesDisparo): Array<{ title: string; options: OpcionDisparo[] }> {
  const conAlgo = op.productos.filter((pr) => kanbansDe(pr).length > 0);
  const varios = conAlgo.length > 1;
  const out: Array<{ title: string; options: OpcionDisparo[] }> = [];
  for (const pr of conAlgo) for (const k of kanbansDe(pr)) out.push(planoDe(k, pr.nombre, varios));
  const etiquetas = seccionEtiquetas(op);
  if (etiquetas) out.push(etiquetas);
  return out.filter((s) => s.options.length > 0);
}

function planoDe(g: SeccionDisparo, producto: string | null, varios: boolean): { title: string; options: OpcionDisparo[] } {
  const kanban = g.title === KANBAN_ADQUISICION ? 'Etapa' : g.title === KANBAN_ENTREGA ? 'Entrega' : null;
  if (!kanban) return { title: g.title, options: g.options };
  return {
    title: varios && producto ? `${kanban} · ${producto}` : kanban,
    options: g.options.map((o) => ({ value: o.value, label: `Llega a «${o.label}»` })),
  };
}

/**
 * CÓMO SE DICE LA ETAPA ELEGIDA EN EL BOTÓN DEL DESPLEGABLE: «Llega a «Agendado»», y con varios
 * productos el producto adelante. Las opciones del último paso dicen sólo la etapa (el paso ya dice
 * de qué producto y de qué kanban); cerrado, el botón tiene que decirlo todo.
 */
export function rotuloDisparo(secs: readonly SeccionDisparo[], valor: string, textoActual: string): string {
  const buscar = (s: readonly SeccionDisparo[], ruta: string[]): string[] | null => {
    for (const g of s) {
      const o = g.options.find((x) => x.value === valor);
      if (o) return [...ruta, g.title, o.label];
      const r = buscar(g.grupos ?? [], [...ruta, g.title]);
      if (r) return r;
    }
    return null;
  };
  const r = buscar(secs, []);
  if (!r) return textoActual;
  if (r[r.length - 2] === 'Etiquetas') return r[r.length - 1];
  const etapa = r[r.length - 1];
  // [Productos, <producto>, <kanban>, <etapa>]; con un solo producto, [Productos, <kanban>, <etapa>].
  const producto = r.length >= 4 ? r[r.length - 3] : null;
  return producto ? `${producto} · Llega a «${etapa}»` : `Llega a «${etapa}»`;
}

/**
 * LOS CANALES QUE «PROBAR» OFRECE (tercera tanda, decisión 14): los que el flujo USA, en el orden
 * WhatsApp → Email. Sin ningún mensaje, WhatsApp (el teléfono es lo que «Probar» abre por default).
 */
export function canalesParaProbar(pasos: readonly PasoGrafo[]): Array<'whatsapp' | 'email'> {
  const mensajes = pasos.filter((p) => claseDe(p) === 'mensaje');
  const out: Array<'whatsapp' | 'email'> = [];
  if (mensajes.some((p) => p.canal !== 'email')) out.push('whatsapp');
  if (mensajes.some((p) => p.canal === 'email')) out.push('email');
  return out.length ? out : ['whatsapp'];
}

/**
 * Lo OBLIGATORIO que le falta a un paso «⚡ Acción», por nombre de parámetro (`faltanDelFormulario`,
 * lib/editor-acciones.ts, con el catálogo y las opciones del negocio). Lo arma quien tiene esos datos
 * (el componente); null = todavía no se sabe (el catálogo no llegó) y no se frena por eso.
 */
export type FaltanEnAccion = (operacion: string, params: Record<string, unknown>) => readonly string[];

/**
 * ¿SE PUEDE PROBAR / PUBLICAR? Lo mismo que frena Publicar (decisión 13: «No debería dejarme "Probar"
 * si hay cosas inconclusas en la edición... que me lleve al lugar donde falta el dato»): la forma
 * (`validarGrafo`), lo que falta escribir (`faltaEscribir`) y lo obligatorio que le falta a una acción
 * (`faltanEnAccion`). Devuelve el error ya legible y la tarjeta a abrir, o null si está todo. UNA
 * función para los dos botones: con dos, uno se queda viejo.
 *
 * ⚠️ LA ACCIÓN MIRA LO QUE EL FORMULARIO PIDE, NO SÓLO LO DECLARADO (integración de la tercera tanda,
 * decisión 16). `faltanEnPaso` (el del server) ve sólo los parámetros obligatorios de la def: un
 * «Mover a Ganado» sin monto se publicaba y rebotaba en cada lead con «falta cargar: Monto de cierre».
 * El monto lo pide la ETAPA elegida, y eso sólo lo sabe el formulario.
 */
export function frenoDelFlujo(pasos: readonly PasoGrafo[], faltanEnAccion?: FaltanEnAccion | null): { error: string; tarjeta: string | null } | null {
  const errores = validarGrafo(pasos);
  if (errores.length) return { error: errorLegible(errores[0], pasos), tarjeta: tarjetaDelError(errores[0], pasos) };
  const vacia = faltaEscribir(pasos);
  if (vacia) return { error: vacia.error, tarjeta: vacia.id };
  if (faltanEnAccion) {
    for (let i = 0; i < pasos.length; i++) {
      const a = pasos[i].accion as { operacion?: unknown; params?: unknown } | null | undefined;
      const op = typeof a?.operacion === 'string' ? a.operacion : '';
      if (claseDe(pasos[i]) !== 'accion' || !op) continue;
      const params = a?.params && typeof a.params === 'object' && !Array.isArray(a.params) ? (a.params as Record<string, unknown>) : {};
      if (faltanEnAccion(op, params).length) {
        const id = idDe(pasos[i], i);
        return { error: `Falta completar «${nombreDeTarjeta(pasos, id)}»`, tarjeta: id };
      }
    }
  }
  return null;
}

/** Lo que se le manda al server al elegir un valor del desplegable (POST
 *  /api/chat-agent/secuencias, `action: 'trigger'`). null = el valor no se entiende. */
export function pedidoDisparo(valor: string, secuenciaId: number): Record<string, unknown> | null {
  const [clase, ambito, ...resto] = valor.split(':');
  const etapa = resto.join(':');
  if (clase === 'trigger' && ambito) return { action: 'trigger', id: secuenciaId, trigger_tipo: [ambito, ...resto].join(':') };
  if (clase === 'venta' && etapa) return { action: 'trigger', id: secuenciaId, trigger_tipo: 'etapa_actual', etapa, funnel_id: ambito ? Number(ambito) : null };
  if (clase === 'entrega' && etapa && Number(ambito) > 0) return { action: 'trigger', id: secuenciaId, trigger_tipo: 'entrega_actual', etapa, producto_id: Number(ambito) };
  if (clase === 'etiqueta' && Number(ambito) > 0) return { action: 'trigger', id: secuenciaId, trigger_tipo: 'etiqueta_puesta', etiqueta_id: Number(ambito) };
  return null;
}

// ── El emoji del título (tercera tanda, decisión 8) ───────────────────────────────

/** El tope de un emoji en unidades UTF-16: alcanza para una familia con ZWJ y tonos de piel. */
export const TOPE_EMOJI = 16;

/**
 * EL EMOJI DEL TÍTULO COMO SE GUARDA (mig 0229): sin espacios, con su tope, y sin letras ni números
 * sueltos (un «a» no es un emoji: lo que el selector manda siempre es uno). null = el de su objetivo.
 * Qué es un emoji lo dice Unicode (`\p{Extended_Pictographic}`, y las banderas): si el texto no trae
 * ninguno, no se guarda. Vive acá (puro) y no en lib/setting-secuencias.ts (`server-only`), para que
 * el test lo pueda ejecutar; quien guarda lo importa.
 */
export function emojiDeSecuencia(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.length > TOPE_EMOJI) return null;
  if (!/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t)) return null;
  // Lo que queda sin las piezas de un emoji (banderas, keycaps, selectores) no puede traer letras.
  if (/[\p{L}\p{N}]/u.test(t.replace(/[\u{1F1E6}-\u{1F1FF}#*0-9️⃣]/gu, ''))) return null;
  return t;
}

/** Lo puesto después de elegir (lo que se pinta mientras el server confirma). */
export function disparoDeValor(valor: string, previo: DisparoActual): DisparoActual {
  const p = pedidoDisparo(valor, 0);
  if (!p) return previo;
  return {
    trigger_tipo: String(p.trigger_tipo),
    etapa: (p.etapa as string | undefined) ?? null,
    funnel_id: (p.funnel_id as number | null | undefined) ?? null,
    producto_id: (p.producto_id as number | undefined) ?? null,
    etiqueta_id: (p.etiqueta_id as number | undefined) ?? null,
  };
}
