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
// ⚠️ ARRASTRAR PARA CONECTAR SE COPIA DESDE LA SEXTA TANDA (09/10/2026). Hasta acá este comentario
// decía que no, porque el editor de flechas del funnel se había descartado por rebuscado. Martín
// ahora lo pidió con todas las letras (punto 5: «si apreto y mantengo el click en el "+" debería
// poder arrastrar esa flecha a otra tarjeta»). Lo que NO cambió: la flecha ES el dato (`siguiente`,
// las ramas, los `paralelos`), no un dibujo aparte. Arrastrar escribe ese dato por una función pura
// (`conectar`, lib/flujo-edicion.ts) y este módulo lo vuelve a dibujar; una tarjeta puede tener
// varios padres (punto 13: «más de una flecha saliendo y llegando a una tarjeta»).
//
// ── LA POSICIÓN DE UNA TARJETA ───────────────────────────────────────────────────────
// El árbol (auto-arrange, como ManyChat) sigue siendo el default y se calcula acá. Desde la quinta
// tanda una tarjeta que la persona movió va donde la dejó (lib/lienzo-posiciones.ts, en su propia
// columna, nunca en `pasos`), y desde la sexta las SUELTAS nacen donde se crearon con el click
// derecho. Con varios padres, una tarjeta se coloca UNA vez, bajo el primero que la alcanza.
//
// ── EL LAYOUT (reescrito el 08/10/2026, segunda tanda: UN SOLO CRON) ─────────────────────
// Pedido literal, punto 1: «No pueden haber 2 flujos por separado. Solo 1 CRON y de ahí
// desprende todo». Hasta acá «Si responde» se dibujaba ABAJO, suelta en la columna del CRON, y
// cuando no existía había una tarjeta fantasma «＋ Si responde»: dos flujos, uno debajo del otro.
//   · arriba a la izquierda, la tarjeta CRON (el disparador; NO es un paso), con su salida al pie
//     (lo que MaKo manda por su cuenta, `raizSalida`, y las flechas en paralelo del CRON);
//   · «Si responde» se dibuja como la CONDITION QUE ESCUCHA (segunda pasada de la sexta tanda,
//     punto 12), COLGADA DEL CRON con una flecha punteada «Si responde» (séptima tanda: sin flecha se
//     leía como una condición suelta, ver `grafoDeSecuencia`). Es el último hijo del CRON, debajo de
//     la salida. Hasta la sexta era una segunda fila del CRON con su flecha, y esa fila no vuelve
//     (cuarta tanda, punto 4). El DATO no cambia: «Si responde» no tiene padre (`validarGrafo` lo
//     exige), es única y la flecha no se borra ni se le agrega nada en el medio (`sinMas`);
//   · cada nodo de varias salidas —una condición, «Si responde», el CRON y toda tarjeta con
//     flechas en paralelo— apila sus hijos ARRIBA y ABAJO de su ancla, cada uno con el alto de
//     su subárbol, así dos ramas no se pisan nunca;
//   · al final todo se corre a coordenadas ≥ 0 (`aOrigen`): la primera rama de la primera
//     condición nace arriba de su padre, o sea con `y` negativa.
//   · el nodo de INICIO (`'entrada'`, lib/flujo-grafo.ts) NO se dibuja: ES el CRON. Sus flechas
//     salen de la salida del CRON.

// Puro (sólo importa ./template-vars): la pregunta «¿este HTML tiene algo que leer?» del saneo del email.
import { htmlEmailVacio } from './email-html-seguro';
// Instagram y Messenger (sexta tanda, parte «canales»): sus tarjetas, su ＋ y su «Probar». Puro.
import { esCanalSocial, logoSocialSvg, VENTANA_META_MS, type CanalSocial } from './canal-social';
// Puro: cuántas etiquetas lleva una tarjeta TAG y cómo se dice («Agregar Cualificado y 2 más»). El
// verbo vive en UN lugar, `VERBO_ETIQUETA` (sexta tanda, TAG 1 y 2).
import { etiquetasDelPaso, textoDeEtiquetas } from './editor-acciones';
import {
  ANCHO_NODO, ALTO_MIN, GAP_Y, MARGEN, ALTO_PUERTO, PIE_PUERTOS, BORDE_NODO, ICONO_MAKO, ICONO_GMAIL,
  encerrar, aOrigen, centroDeFilas, tieneFilas, posicionDePildora, anchoPildoraFlecha,
  type NodoFlujo, type AristaFlujo, type GrafoFlujo, type PuertoNodo,
} from './lienzo-grafo';
import {
  type PasoGrafo, type RamaCondicion, type CampoCondicion, type NombresParaTexto, type LugarInsercion,
  CAMPOS_CONDICION, ID_INICIO, TOPE_PARALELOS, TOPE_HILOS,
  claseDe, idDe, normalizar, puertosDe, raizSalida, raicesSalida, raizRespuesta, descendientes, puedeTenerParalelos, padresDe,
  indicePorId, nodoPorId, nuevoId, insertarNodo, conectarPuerto, validarGrafo, textoRama, textoEspera, nodosEnBucle, textoCasoRespuesta,
  RESULTADO_SI_NO, paralelosDeResultado, puertoParalelo, contarParalelos, rotuloSiNoDeRespuesta,
  esPasoIA, erroresDelPasoIA, medioDe, raicesRespuesta, puedeSumarAIStep, juntarPasosIA,
  type MedioAIStep,
} from './flujo-grafo';
// La libertad de un escenario del AI Step (undécima tanda): UNA lectura para la tarjeta, el editor y el motor.
import { libertadDeCaso, type Libertad } from './ai-step-libertad';
import { limpiezaPara, OP_AVISAR, type EstrategiaLegada } from './flujo-legado';
import { textoCron, type CronAviso } from './cron-aviso';
import { LEAD_DEL_EVENTO } from './api-mako/flujo-params';
// Puro (sólo importa ./nutricion-ambito, sin imports): la regla de cuáles etapas disparan (`etapasDe`).
import { etapasDe, normalizarEtapas } from './nutricion-etapa';
import { alternarValor } from '../app/components/dropdown-varios';
// Puro (sólo importa ./nutricion-canal): cuántas partes tiene un mensaje, para su alto (`altoDeMensaje`).
import { partesExplicitas, partesDe, type ParteMensaje } from './mensaje-partes';
// Puro: la tarjeta «MaKo en WhatsApp» por partes (undécima tanda). Lo que la tarjeta dice y si está escrita.
import { partesDeMako, resumenDeMako, problemaDeEmailMako, esPorEmail } from './mako-tarjeta';
// SÓLO EL TIPO (undécima tanda): el valor NO se importa acá. lib/tokens-del-flujo.ts → lib/aviso-evento.ts →
// lib/disparadores.ts → ESTE archivo es un ciclo, y aviso-evento lee `EVENTOS_MAKO` al cargarse: medido el 11/10/2026,
// con el import estático `import('lib/disparadores.ts')` tira «Cannot access 'EVENTOS_MAKO' before initialization».
import type { ProblemaDeTokens } from './tokens-del-flujo';
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
/** El rótulo de la flecha del CRON a la condición que escucha (séptima tanda). Corto: va sobre la flecha. */
export const ETIQUETA_FLECHA_ESCUCHA = 'Si responde';
/*
 * (Hasta la segunda pasada de la sexta tanda el CRON de un flujo con «Si responde» tenía una segunda
 * fila, «Si responde» —el puerto 'resp', `PUERTO_RESPUESTA`—, y su ＋ creaba la tarjeta. «Si responde»
 * se dibuja ahora como la CONDITION que escucha —colgada de la ÚNICA salida del CRON con la flecha
 * `ETIQUETA_FLECHA_ESCUCHA` desde la séptima tanda—, y lo nuevo se crea eligiendo «Su respuesta trata
 * de» en una CONDITION vacía (`condicionARespuesta`, lib/flujo-grafo.ts).)
 */

/** Las dos operaciones que se dibujan como la tarjeta de ETIQUETA (decisión 8). */
export const OP_PONER_ETIQUETA = 'poner_etiqueta_lead';
export const OP_SACAR_ETIQUETA = 'sacar_etiqueta_lead';

/** Separación entre columnas del árbol. Sin etiquetas sobre las flechas, alcanza para el
 *  ＋ de una salida vacía y el ＋ del medio. */
const GAP_COLUMNA = 92;
/**
 * Lo que una pastilla de espera deja libre a cada lado, contra la tarjeta de antes y la de después.
 *
 * ⚠️ EL HUECO DE 92 NO MIDE LA PASTILLA (10/10/2026, la verificación de los restos): «1 h antes de la
 * reunión» mide 150 px, así que en una automatización con una espera antes de la reunión la pastilla iba
 * de x=251 a x=401 con el CRON terminando en 280 y la tarjeta siguiente empezando en 372: pisaba las dos.
 * Una columna cuya flecha lleva pastilla se corre lo que pide la pastilla (`huecoHacia`).
 */
export const AIRE_PILDORA = 20;
/** Entre el árbol del CRON y lo que haya suelto debajo. */
const GAP_RAICES = 56;
/*
 * (Hasta la sexta tanda el alto del CRON eran dos constantes —con filas y sin filas— más un renglón
 * de 18 px por renglón del disparador. Desde que el CRON lleva una caja por disparador y su salida al
 * pie, se suma por partes en `altoCron`.)
 */
/**
 * El ícono del CRON: EL RAYO (sexta tanda, CRON 10, literal: «Y que el emoji de CRON sea el rayo»).
 * Hasta acá era ⏰ porque el ⚡ era de la Acción y las dos tarjetas lo compartían (R3): el que se
 * mudó es el de la Acción (`ICONO_ACCION`). Siguen sin compartirlo.
 */
export const ICONO_CRON = '⚡';
/** El ícono de la ACTION: el engranaje. Le cedió el rayo al CRON (sexta tanda). */
export const ICONO_ACCION = '⚙️';

/**
 * UN DISPARADOR DE LA TARJETA CRON (sexta tanda, CRON 10: «Me gusta que se vea la opción de Cron que
 * seleccioné y abajo también "+Nuevo CRON", es decir, agrega la opción de tener más de un CRON»). Lo
 * arma quien sabe cuáles son (la parte de los disparadores, desde SecuenciaPerfil); el lienzo sólo
 * los dibuja, cada uno en su cajita, como el «Cuando…» de ManyChat. `icono`: un emoji o una marca
 * del catálogo (`ServicioVisual`), lo mismo que el ícono de una tarjeta.
 */
export type DisparadorTarjeta = { id: string; texto: string; icono?: string };

/**
 * LAS PIEZAS DE LA TARJETA CRON, en px (las dibuja `TarjetaCron`, app/automations/FlujoLienzo.tsx: si
 * cambia una, cambia acá). La tarjeta tiene alto FIJO —lleva su salida al pie— así que se SUMA:
 * cada disparador es una caja de uno o dos renglones, «+ Nuevo CRON» un renglón punteado.
 */
export const RENGLON_DISPARO = 17;
export const MARCO_DISPARO = 14;
export const SEP_DISPARO = 6;
export const ALTO_NUEVO_DISPARO = 30;
/** Las letras de un renglón de la caja (252 de tarjeta − rellenos, borde y el ícono, a 12,5 px). */
const LETRAS_DISPARO = 28;
/** Relleno de arriba, la cabecera (el ícono de 22) y su margen, y el borde de arriba. */
const CABECERA_TARJETA = 11 + 22 + 7 + BORDE_NODO;
export const altoCajaDisparo = (texto: string): number =>
  MARCO_DISPARO + Math.min(2, Math.max(1, renglonesDe(texto, LETRAS_DISPARO))) * RENGLON_DISPARO;

/** El alto de la tarjeta CRON con sus disparadores, «+ Nuevo CRON» y `filas` filas de salida al pie. */
export function altoCron(disparadores: readonly string[], conNuevo: boolean, filas: number): number {
  const cajas = disparadores.reduce((s, t) => s + altoCajaDisparo(t), 0) + SEP_DISPARO * Math.max(0, disparadores.length - 1);
  return Math.ceil(CABECERA_TARJETA + cajas + (conNuevo ? SEP_DISPARO + ALTO_NUEVO_DISPARO : 0) + SEP_DISPARO
    + filas * ALTO_PUERTO + PIE_PUERTOS + BORDE_NODO);
}

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

// ── LA TARJETA AI STEP (novena tanda; v2 en la décima; UNA POR OBJETIVO desde la undécima) ───────────────────────
// Undécima (docs/diseno-undecima-tanda.md §2, puntos 11-13): UNA tarjeta por medio con el OBJETIVO y sus escenarios
// adentro. ALTO FIJO: «→ objetivo» en negrita (o «Falta el objetivo», en rojo), los nombres de los escenarios en una
// línea y al pie los chips —cuántos «sólo avisa» / «aprueba» / «sola» y 🎙 si contesta en audio—. El MEDIO va como
// una franja de 3 px arriba y su logo a la derecha de la cabecera (`CuerpoPasoIA`, app/automations/EditorPasoIA.tsx).
// Cuelga del CRON como «Si responde» (`grafoDeSecuencia`). Lo de varias tarjetas lo junta el lienzo al abrir
// (`juntarPasosIA`, en `abrirFlujo`).
//
// ⚠️ LOS NÚMEROS SON LOS DE `CuerpoPasoIA`, que dibuja cada renglón con ESTE alto exacto: la tarjeta tiene alto
// fijo (no tiene puertos, pero el lienzo la mide antes de pintar para el layout) y lo que no entra se corta.

/** El renglón de «→ objetivo» (en negrita: es el nombre de la tarjeta). */
export const FILA_OBJETIVO_IA = 20;
/** El renglón con los nombres de los escenarios. */
export const FILA_ESCENARIOS_IA = 18;
/** El pie con los chips. */
export const FILA_CHIPS_IA = 28;
/** Lo que dice el objetivo, cortado (el renglón es uno). */
const RESUMEN_IA = 60;

/** Lo que dibuja la tarjeta AI Step: su objetivo y sus escenarios en una mirada. */
export type ResumenPasoIA = {
  /** «→ objetivo» cortado a un renglón; null = sin objetivo (se dibuja «Falta el objetivo», en rojo). */
  objetivo: string | null;
  /** Los escenarios (sin «Lo demás»), con su libertad, en el orden del clasificador. */
  escenarios: Array<{ titulo: string; libertad: Libertad }>;
  /** «Lo demás»: el caso `cualquiera`, o «Sólo te avisa» si no hay uno. */
  loDemas: Libertad;
  /** Cuántos escenarios hay de cada libertad (los chips del pie; «Lo demás» no cuenta). */
  conteo: Readonly<Record<Libertad, number>>;
  /** Contesta en audio (🎙). */
  audio: boolean;
  /** Le falta algo para publicar: la MISMA regla que el freno de Publicar (`erroresDelPasoIA`). */
  falta: boolean;
  medio: MedioAIStep;
};

/** El resumen de la tarjeta AI Step: el objetivo, los escenarios con su libertad y lo que le falta. */
export function resumenPasoIA(p: PasoGrafo): ResumenPasoIA {
  const obj = (p.objetivo ?? '').replace(/\s+/g, ' ').trim();
  const casos = p.casos ?? [];
  const escenarios = casos.filter((c) => c.cualquiera !== true)
    .map((c) => ({ titulo: (c.titulo ?? '').trim() || 'Sin nombre', libertad: libertadDeCaso(c) }));
  const conteo: Record<Libertad, number> = { avisa: 0, aprueba: 0, sola: 0 };
  for (const e of escenarios) conteo[e.libertad]++;
  const loDemas = casos.find((c) => c.cualquiera === true);
  return {
    objetivo: obj ? (obj.length > RESUMEN_IA ? `${obj.slice(0, RESUMEN_IA - 1).trimEnd()}…` : obj) : null,
    escenarios,
    loDemas: loDemas ? libertadDeCaso(loDemas) : 'avisa',
    conteo,
    audio: !!p.audio || casos.some((c) => !!c.audio),
    falta: erroresDelPasoIA(p, idDe(p, 0), true).length > 0,
    medio: medioDe(p),
  };
}

/** El alto de la tarjeta AI Step: FIJO (la cabecera, el objetivo, los escenarios, los chips y el pie). */
export function altoPasoIA(): number {
  return Math.ceil(CABECERA_TARJETA + FILA_OBJETIVO_IA + FILA_ESCENARIOS_IA + FILA_CHIPS_IA + PIE_PUERTOS + BORDE_NODO);
}

/** El ancho de la píldora de una espera: el de su texto, con piso y techo. */
function anchoPildora(texto: string): number {
  return Math.min(ANCHO_NODO, Math.max(ANCHO_PILDORA, Math.ceil(64 + texto.length * 7.5)));
}

/**
 * ¿ESTE PASO ES UNA TARJETA DE ETIQUETA? Una ⚡ Acción `poner_etiqueta_lead` /
 * `sacar_etiqueta_lead` (decisión 8: una PRESENTACIÓN, el motor no cambia). Devuelve qué hace, la
 * primera etiqueta (null = todavía sin elegir) y TODAS (sexta tanda, TAG 2: «Se debería poder
 * seleccionar multiple»: la primera en `etiquetaId` y las demás en `etiquetaIds`, `etiquetasDelPaso`),
 * o null si no es una.
 */
export function etiquetaDeAccion(p: PasoGrafo): { operacion: typeof OP_PONER_ETIQUETA | typeof OP_SACAR_ETIQUETA; etiquetaId: number | null; etiquetaIds: number[] } | null {
  if (claseDe(p) !== 'accion') return null;
  const a = p.accion as { operacion?: unknown; params?: Record<string, unknown> } | null | undefined;
  const op = typeof a?.operacion === 'string' ? a.operacion : '';
  if (op !== OP_PONER_ETIQUETA && op !== OP_SACAR_ETIQUETA) return null;
  const ids = etiquetasDelPaso(a?.params);
  return { operacion: op, etiquetaId: ids[0] ?? null, etiquetaIds: ids };
}

/**
 * ¿ESTE PASO ES LA TARJETA MAKO? (tercera tanda, decisión 11; pedido literal: «Falta una tarjeta de
 * "WhatsApp de MaKo" para que se pueda configurar un mensaje que envíe MaKo al grupo de WhatsApp»).
 * Es la ⚡ Acción `avisar_al_equipo` (OP_AVISAR) dibujada como lo que hace, igual que la etiqueta: el
 * motor no cambia. NO es un mensaje al lead: le escribe al GRUPO del negocio. El «Si no» con el que
 * nace la CONDITION que escucha (`condicionARespuesta`) también es una.
 */
export function esMako(p: PasoGrafo): boolean {
  if (claseDe(p) !== 'accion') return false;
  const a = p.accion as { operacion?: unknown } | null | undefined;
  return a?.operacion === OP_AVISAR;
}

/**
 * El mensaje, el título y las PARTES de una tarjeta MAKO (lo que el editor edita y la tarjeta muestra).
 *
 * ⚠️ UNDÉCIMA TANDA (decisión 2 de la décima): la tarjeta tiene `params.partes`, la misma lista que un WhatsApp
 * (`partesDeMako`, lib/mako-tarjeta.ts). Lo que cuenta para «¿está escrita?» son las PARTES, no `mensaje` (el
 * espejo): una tarjeta que es sólo la Voz de MaKo o sólo un archivo está escrita.
 */
export function makoDeAccion(p: PasoGrafo): { mensaje: string; titulo: string; partes: ParteMensaje[] } | null {
  if (!esMako(p)) return null;
  const params = (p.accion as { params?: Record<string, unknown> } | null | undefined)?.params ?? {};
  return {
    mensaje: typeof params.mensaje === 'string' ? params.mensaje : '',
    titulo: typeof params.titulo === 'string' ? params.titulo : '',
    partes: partesDeMako(params),
  };
}

/** ¿La tarjeta MAKO no dice nada? Sin ninguna parte (ni texto, ni la Voz de MaKo, ni un archivo). */
const makoVacia = (p: PasoGrafo): boolean => !(makoDeAccion(p)?.partes.length);

/** Los `params` de una tarjeta MAKO. */
const paramsDeMakoDe = (p: PasoGrafo): Record<string, unknown> | undefined =>
  (p.accion as { params?: Record<string, unknown> } | null | undefined)?.params;

/** La tarjeta MAKO en un renglón (`resumenDeMako`): lo que dibuja el lienzo y nombra un error. */
const resumenMako = (p: PasoGrafo): string => resumenDeMako(paramsDeMakoDe(p));

/**
 * «Agregar Cualificado» / «Eliminar Seguimiento» / «Agregar Cualificado y Seguimiento»: lo que dice la
 * tarjeta de etiqueta (sexta tanda, TAG 1 y 2). Con más de una las nombra `textoDeEtiquetas`
 * (lib/editor-acciones.ts), que es también la que pone el verbo: «Agregar» y «Eliminar» viven ahí.
 */
function textoEtiqueta(e: NonNullable<ReturnType<typeof etiquetaDeAccion>>, nombres?: NombresParaTexto): string {
  if (e.etiquetaId == null) return 'Sin elegir';
  return textoDeEtiquetas(e.operacion, e.etiquetaIds.map((id) => nombres?.etiqueta?.(id) ?? 'una etiqueta'));
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
  /**
   * Con VARIAS etapas (cuarta tanda, punto 14): sus nombres, en el orden en que se eligieron. Con dos
   * o más, mandan sobre `nombreEtapa`. `todas`: son todas las de su kanban.
   */
  nombresEtapas?: readonly string[] | null;
  todas?: boolean;
}): string {
  if (d.cron) return textoCron(d.cron, d.tz ?? null);
  if (d.trigger_tipo === 'etapa_actual' || d.trigger_tipo === 'entrega_actual') {
    const nombres = (d.nombresEtapas ?? []).map((n) => n.trim()).filter(Boolean);
    if (nombres.length > 1) return fraseEtapas(nombres, d.todas === true, d.trigger_tipo === 'entrega_actual' ? 'entrega' : 'venta');
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
/** «+N más» debajo de la burbuja de un mensaje de VARIAS partes: 11 px × 1,45 (`VistaMensaje`). */
export const RENGLON_MAS_PARTES = 16;
const HOLGURA = 6;              // la fuente que no llegó, el redondeo
const TOPE_MENSAJE = 260;
/**
 * LA TARJETA DE WHATSAPP COMO UN WHATSAPP (10/10/2026, WhatsApp 1: «los mensajes deben estar separados,
 * como en el editable, y que se vean como máximo 2 mensajes en la tarjeta del lienzo, para no romper
 * diseño. Que se vea las palomitas todo, como si fuera un whatsapp... Y si hay más mensajes un pequeño y
 * sutil recuadro que diga "+3 mensajes..."»). Cada burbuja lleva su fila de la hora y el ✓✓
 * (`ALTO_PALOMITAS`: marginTop 3 + 10,5 px), hasta dos burbujas separadas, y el recuadro de lo que queda.
 */
export const ALTO_PALOMITAS = 15;
export const SEP_BURBUJAS_TARJETA = 6;
export const ALTO_MAS_PARTES = 22;
export const PARTES_EN_TARJETA = 2;
/** Los renglones de texto de cada burbuja cuando la tarjeta dibuja dos (con uno, `RENGLONES_TEXTO`). */
export const RENGLONES_CON_DOS = 3;
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
 * en app/automations/FlujoLienzo.tsx): el reproductor, el título y el pie. El archivo, con su chip y el
 * caption. Un mensaje de VARIAS partes dibuja la primera y un renglón «+N más»
 * (`RENGLON_MAS_PARTES`).
 *
 * ⚠️ LA TRANSCRIPCIÓN DEL AUDIO YA NO SE DIBUJA (cuarta tanda, punto 15: «que no se vea la
 * transcripción del audio»), así que tampoco suma: medir lo que la tarjeta no pinta deja aire
 * abajo. `_audio` queda en la firma porque el árbol se lo pasa (`audioDe`).
 */
export function altoDeMensaje(p: PasoParaGrafo, _audio?: AudioParaAlto): number {
  const conPalomitas = p.canal !== 'email' && !esCanalSocial(p.canal);
  // Las burbujas que DIBUJA la tarjeta (`burbujasDeTarjeta`, la misma función que `VistaMensaje`); fuera de
  // WhatsApp, las explícitas de siempre (el renglón «+N más» del email y de Instagram/Messenger).
  const partes = conPalomitas ? burbujasDeTarjeta(p) : partesExplicitas(p);
  // VARIOS MENSAJES: hasta dos burbujas y el recuadro «+N mensajes…» (WhatsApp 1, 10/10/2026).
  if (conPalomitas && partes && partes.length > 1) {
    const vis = partes.slice(0, PARTES_EN_TARJETA);
    const h = MARCO_TARJETA
      + vis.reduce((acc, x, k) => acc + (k ? SEP_BURBUJAS_TARJETA : 0) + altoDeBurbuja(x, RENGLONES_CON_DOS), 0)
      + (partes.length > PARTES_EN_TARJETA ? SEP_BURBUJAS_TARJETA + ALTO_MAS_PARTES : 0) + HOLGURA;
    return Math.min(TOPE_MENSAJE, Math.max(ALTO_MIN, Math.ceil(h)));
  }
  const mas = (partes?.length ?? 1) - 1;
  const base = altoDeLaPrimera(p);
  if (!conPalomitas) return mas > 0 ? Math.min(TOPE_MENSAJE, base + SEP_BURBUJA + RENGLON_MAS_PARTES) : base;
  // La fila de las palomitas comparte renglón con el ✦ de «MaKo lo adapta»: con hora, ese renglón ya está.
  return Math.min(TOPE_MENSAJE, base + ALTO_PALOMITAS - (p.tipo === 'ia' ? 18 : 0));
}

/**
 * LAS BURBUJAS DE UN WHATSAPP EN SU TARJETA, o null si es UNA (décima tanda, WhatsApp 1, 11/10/2026: «la tarjeta
 * del lienzo, donde aparece el mensaje con el fondo gris, con las palomitas... que cada mensaje sea un recuadro de
 * fondo gris, como si fueran mensajes diferentes, porque lo son. No que estén todo junto»).
 *
 * ⚠️ `partesDe` Y NO `partesExplicitas`: un audio con su texto guardado como se guardaba antes (`tipo: 'audio'` +
 * `cuerpo`, sin `partes`) son DOS mensajes —así le llegan al lead y así los muestra el editor—, y la tarjeta los
 * dibujaba en UNA burbuja gris, el audio y el texto juntos. `partesExplicitas` devuelve null para esa forma; ésta
 * los parte como el editor. La usan la tarjeta (`VistaMensaje`, app/automations/FlujoLienzo.tsx) y su alto
 * (`altoDeMensaje`): con dos cuentas, la tarjeta cortaría la segunda burbuja.
 */
export function burbujasDeTarjeta(p: PasoParaGrafo): ParteMensaje[] | null {
  const lista = partesDe(p);
  return lista.length > 1 ? lista : null;
}

/** El alto de UNA burbuja de la tarjeta (una parte), con su fila de palomitas. */
export function altoDeBurbuja(parte: { tipo: string; cuerpo?: string }, renglonesMax: number): number {
  if (parte.tipo === 'audio') return MARCO_BURBUJA + ALTO_REPRODUCTOR + SEP_BURBUJA + ALTO_TITULO_AUDIO + ALTO_PALOMITAS;
  const r = Math.min(renglonesMax, renglonesDe(parte.cuerpo ?? '', LETRAS_TEXTO));
  if (parte.tipo === 'media') return MARCO_BURBUJA + ALTO_CHIP_ARCHIVO + (r ? SEP_BURBUJA + r * RENGLON_TEXTO : 0) + ALTO_PALOMITAS;
  return MARCO_BURBUJA + Math.max(1, r) * RENGLON_TEXTO + ALTO_PALOMITAS;
}

/** El alto de la burbuja que la tarjeta dibuja: el mensaje, o la PRIMERA parte (el espejo). */
function altoDeLaPrimera(p: PasoParaGrafo): number {
  const cuerpo = p.cuerpo ?? '';
  const pie = Math.min(RENGLONES_TEXTO, renglonesDe(cuerpo, LETRAS_TEXTO));
  if (p.tipo === 'audio') {
    const h = MARCO_TARJETA + MARCO_BURBUJA + ALTO_REPRODUCTOR + (pie ? SEP_BURBUJA : 0) + ALTO_TITULO_AUDIO
      + (pie ? SEP_BURBUJA + pie * RENGLON_TEXTO : 0) + HOLGURA;
    return Math.min(TOPE_MENSAJE, Math.max(ALTO_MIN, Math.ceil(h)));
  }
  if (p.tipo === 'media') {
    const h = MARCO_TARJETA + MARCO_BURBUJA + ALTO_CHIP_ARCHIVO + (pie ? SEP_BURBUJA + pie * RENGLON_TEXTO : 0) + HOLGURA;
    return Math.min(TOPE_MENSAJE, Math.max(ALTO_MIN, Math.ceil(h)));
  }
  if (p.canal === 'email') {
    // ⚠️ UN EMAIL SE DIBUJA COMO UN MAIL, NO COMO UNA BURBUJA (segunda tanda): la caja del correo
    // (`VistaEmail`, app/automations/FlujoLienzo.tsx) con el asunto arriba, la vista previa en gris y
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
 * errores leen de acá. Van en mayúsculas
 * porque así se dibujan, y el error nombra la tarjeta con lo mismo que se lee.
 */
export const TITULO = {
  cron: 'CRON', whatsapp: 'WHATSAPP', email: 'EMAIL', esperar: 'DELAY', condicion: 'CONDITION',
  etiqueta: 'TAG', accion: 'ACTION',
  // Sexta tanda, MaKo en WhatsApp 1, literal: «El título debe ser ese, "MaKo en WhatsApp" no solo
  // MaKo... Sino se confunde con una ayuda de la IA».
  mako: 'MAKO EN WHATSAPP',
  // La misma tarjeta por correo al equipo (16/10/2026, `esPorEmail`, lib/mako-tarjeta.ts): se nombra como sale.
  mako_email: 'MAKO POR EMAIL',
  // (`respuesta: 'REPLY'` se fue en la segunda pasada de la sexta tanda: «Si responde» se dibuja como
  // la CONDITION que escucha —punto 12: «Reply ya te dije que tiene que estar dentro de CONDITION»—.)
  // «Ir a» ya no se crea (decisión 3), pero los que existen se siguen dibujando.
  ir_a: 'GO TO',
  // Los canales de Meta por Zernio (sexta tanda, CRON 5 y 7).
  instagram: 'INSTAGRAM', messenger: 'MESSENGER',
  // Novena tanda: «Si responde» con sus casos adentro. El nombre es el del pedido («una nueva tarjeta que
  // sea "AI Step"»), en mayúsculas como todos.
  paso_ia: 'AI STEP',
} as const;

/**
 * EL TÍTULO QUE LA TARJETA DIBUJA. Lo usan el árbol (la cabecera de cada tarjeta) y los
 * nombres de los errores: una sola función, para que el error nombre la tarjeta con lo
 * mismo que se lee en el lienzo.
 */
export function tituloDeTarjeta(p: PasoGrafo, enRespuesta?: boolean): string {
  void enRespuesta;
  switch (claseDe(p)) {
    // «Si responde» es la CONDITION que escucha (sexta tanda, punto 12): se nombra como se ve. El AI Step
    // (novena tanda) es la misma clase con otra cara: también se nombra como se ve.
    case 'respuesta': return esPasoIA(p) ? TITULO.paso_ia : TITULO.condicion;
    case 'condicion': return TITULO.condicion;
    case 'ir_a': return TITULO.ir_a;
    case 'esperar': return TITULO.esperar;
    case 'accion': return etiquetaDeAccion(p) ? TITULO.etiqueta : esMako(p) ? (esPorEmail(paramsDeMakoDe(p)) ? TITULO.mako_email : TITULO.mako) : TITULO.accion;
    case 'inicio': return TITULO.cron;
    // Un WhatsApp con texto, audio, archivo o escrito por MaKo es WHATSAPP (decisión 5): «no pongas
    // "Nota de voz" es simplemente "WhatsApp" y un WhatsApp puede contener diversas cosas».
    default: return esCanalSocial(p.canal) ? TITULO[p.canal] : p.canal === 'email' ? TITULO.email : TITULO.whatsapp;
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
  // La que escucha, por su primer caso («CONDITION: Pregunta el precio»): la frase entera no entra. El AI
  // Step, por su nombre solo: hay uno por automatización, y su primer caso al lado se leía como el caso
  // del que habla el error («AI STEP: Precio: «Precio» no contesta»).
  else if (c === 'respuesta' && p.casos?.[0] && !esPasoIA(p)) t = p.casos[0].titulo ?? '';
  else if (et && et.etiquetaId != null) t = textoEtiqueta(et, nombres);
  else if (esMako(p)) t = resumenMako(p);
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
    // Undécima: «sin mensaje» = sin PARTES (`makoVacia`); una que es sólo la Voz de MaKo o un archivo, sale.
    if (esMako(p) && makoVacia(p)) {
      const id = idDe(p, i);
      return { id, error: `Falta completar «${nombreDeTarjeta(pasos, id)}»` };
    }
    // «MaKo por email» (16/10/2026): sin asunto, o con algo que un correo no lleva, no se publica.
    const malEmail = esMako(p) ? problemaDeEmailMako(paramsDeMakoDe(p)) : null;
    if (malEmail) {
      const id = idDe(p, i);
      return { id, error: `«${nombreDeTarjeta(pasos, id)}»: ${malEmail}` };
    }
    if (claseDe(p) !== 'mensaje') continue;
    const id = idDe(p, i);
    if (mensajeVacio(p)) return { id, error: `Falta completar «${nombreDeTarjeta(pasos, id)}»` };
  }
  return null;
}

/**
 * LAS TARJETAS A MEDIO COMPLETAR (10/10/2026, condición 4: «Si cierro una condición, como cualquier
 * cosa, sin completar, debe remarcarse con rojo para identificar donde falta»). La MISMA vara que
 * Publicar: los errores de `validarGrafo` que nombran una tarjeta, más lo que falta escribir
 * (`faltaEscribir`, para TODAS y no sólo la primera). Lo de estar SUELTA no cuenta: una tarjeta suelta
 * es un borrador permitido y ya se dibuja punteada, no le falta nada adentro.
 */
export function tarjetasIncompletas(pasos: readonly PasoGrafo[]): Set<string> {
  const out = new Set<string>();
  for (const e of validarGrafo(pasos)) {
    if (e.startsWith('tarjetas sueltas')) continue;
    const t = tarjetaDelError(e, pasos);
    if (t) out.add(t);
  }
  pasos.forEach((p, i) => {
    const vacia = esMako(p) ? makoVacia(p) || !!problemaDeEmailMako(paramsDeMakoDe(p)) : claseDe(p) === 'mensaje' && mensajeVacio(p);
    if (vacia) out.add(idDe(p, i));
  });
  return out;
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
  /**
   * LOS DISPARADORES DE LA TARJETA CRON (sexta tanda, CRON 10), uno por caja. Ausente = una sola caja
   * con `disparador` (lo de siempre). Lo que cuenta acá es cuántos son y qué dicen: de eso sale el
   * alto de la tarjeta, que es fijo (lleva su salida al pie).
   */
  disparadores?: readonly DisparadorTarjeta[];
  /** Se dibuja «+ Nuevo CRON» debajo de los disparadores (quien monta sabe agregar uno). */
  nuevoDisparador?: boolean;
};

/** Lo que cuelga de «Si responde» (sin ella). Ahí no hay esperas: se contesta en el momento. */
export function subarbolRespuesta(pasos: readonly PasoGrafo[]): Set<string> {
  const r = raizRespuesta(pasos);
  return r ? descendientes(pasos, r) : new Set();
}

/**
 * EL AVISO DE UN DM QUE NO VA A SALIR (segunda pasada de la sexta tanda): un DELAY de más de 24 h justo
 * antes de una tarjeta de Instagram o Messenger. Meta deja escribirle a alguien sólo dentro de las 24 h
 * de SU último mensaje (`VENTANA_META_MS`, lib/canal-social.ts), y el motor cierra ese paso sin mandar
 * (`decidirSalida`). Hasta acá no se decía en ningún lado antes de que pasara. Corto: es el ⚠ de la
 * tarjeta, y el porqué es este comentario.
 */
export const AVISO_VENTANA_META = 'Tras 24 h no sale';

/**
 * CUÁNTOS MINUTOS SE ESPERA JUSTO ANTES DE UNA TARJETA: la espera (por tiempo) que la apunta, sumada a
 * las que vienen pegadas antes de ella (dos esperas seguidas son UNA espera más larga). Con varios
 * padres, el camino que más espera. Una espera «antes de la reunión» no cuenta: depende de la fecha.
 */
export function esperaAntesDe(pasos: readonly PasoGrafo[], id: string, vistos: ReadonlySet<string> = new Set()): number {
  let max = 0;
  for (const pa of padresDe(pasos, id)) {
    if (vistos.has(pa.id)) continue;
    const q = nodoPorId(pasos, pa.id);
    if (!q || claseDe(q) !== 'esperar' || q.espera?.modo === 'antes_reunion') continue;
    const m = Math.max(0, Number(q.espera?.minutos) || 0);
    max = Math.max(max, m + esperaAntesDe(pasos, pa.id, new Set([...vistos, id])));
  }
  return max;
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
  // Las que escuchan: con AI Step v2 son varias tarjetas (`raicesRespuesta`), cada una colgada del CRON.
  const escuchan = raicesRespuesta(pasos);
  const raices = [...raicesSalida(pasos), ...escuchan, ...pasos.flatMap((p) => (claseDe(p) === 'ir_a' && p.destino && 'nodo' in p.destino ? [p.destino.nodo] : []))];
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

  // ── Las ESPERAS QUE VAN EN LA FLECHA (sexta tanda, DELAY 1: «Que Delay no sea una tarjeta, que la
  //    flecha no se corte, que sea algo en medio de la flecha, más sutil») ──
  // Una espera es una pastilla sobre la flecha de su padre a lo que sigue cuando ESO es lo que es: un
  // solo padre, una sola salida que sigue en algo que existe, y nada en paralelo. Ahí la flecha va del
  // padre a lo de después sin cortarse y la espera no ocupa columna. Lo demás (una espera al final,
  // suelta, con dos padres, que reparte) se sigue dibujando como su píldora, con su salida: ahí sí es
  // un lugar del dibujo (hay que poder agregar después de ella). El DATO no cambia: sigue siendo un
  // nodo `esperar` en `pasos`, con su `siguiente`.
  const padres = new Map<string, number>();
  pasos.forEach((_, i) => { for (const pt of puertosDe(pasos, i)) if (pt.destino) padres.set(pt.destino, (padres.get(pt.destino) ?? 0) + 1); });
  if (iIni < 0 && raiz) padres.set(raiz, (padres.get(raiz) ?? 0) + 1);
  const salidaUnica = (id: string): string | null => {
    const i = indicePorId(pasos, id);
    const pts = i >= 0 ? puertosDe(pasos, i) : [];
    return pts.length === 1 && pts[0].puerto === 'sig' ? pts[0].destino : null;
  };
  const colapsable = (id: string): boolean => {
    const i = indicePorId(pasos, id);
    if (i < 0 || claseDe(pasos[i]) !== 'esperar' || padres.get(id) !== 1 || enRespuesta.has(id)) return false;
    const d = salidaUnica(id);
    return d != null && d !== id && existe.has(d);
  };
  /** De `d` en adelante: las esperas que van en la flecha y la tarjeta donde la flecha llega. */
  const tramo = (d: string | null): { hasta: string | null; esperas: string[] } => {
    const esperas: string[] = [];
    let cur = d;
    while (cur && colapsable(cur) && !esperas.includes(cur)) { esperas.push(cur); cur = salidaUnica(cur); }
    // Un círculo de esperas (no se puede publicar, pero se dibuja) no se aplasta: se ve como es.
    if (cur && esperas.includes(cur)) return { hasta: d, esperas: [] };
    return { hasta: cur, esperas };
  };
  // Sólo las que se alcanzan desde una tarjeta que SE dibuja (o desde el CRON): una espera colapsable
  // a la que no llega nadie (un círculo de esperas sueltas) se dibuja como píldora, o desaparecería.
  const enFlecha = new Set<string>();
  {
    const fuentes = [
      ...(iIni >= 0 ? puertosDe(pasos, iIni).map((pt) => pt.destino) : [raiz]),
      ...pasos.flatMap((p, i) => (i === iIni || colapsable(ids[i]) ? [] : puertosDe(pasos, i).map((pt) => pt.destino))),
    ];
    for (const d of fuentes) for (const e of tramo(d).esperas) enFlecha.add(e);
  }
  const textoDeEspera = (id: string) => textoEspera(nodoPorId(pasos, id)?.espera).replace(/^Esperar /, '');

  // ── Dónde van los hand-offs pendientes: el AI Step de WhatsApp que escucha (undécima: uno por medio; los
  //    hand-offs salen del chat de WhatsApp), o el primero que escucha. Una sola: «2 sin caso» repetido en cada
  //    tarjeta contaría de más. ──
  const iasQueEscuchan = escuchan.filter((x) => esPasoIA(nodoPorId(pasos, x)));
  const tarjetaDeHandoffs = iasQueEscuchan.find((x) => medioDe(nodoPorId(pasos, x)) === 'whatsapp') ?? iasQueEscuchan[0] ?? null;

  // ── La tarjeta de cada paso (sin posición todavía) ──
  type Tarjeta = Omit<NodoFlujo, 'x' | 'y'>;
  const tarjetas = new Map<string, Tarjeta>();
  pasos.forEach((p, i) => {
    const id = ids[i];
    const c = claseDe(p);
    // El inicio ES el CRON: no tiene tarjeta propia (la del CRON se arma abajo). Y una espera que va
    // en la flecha tampoco: es la pastilla de una arista (se agrega como nodo `enFlecha` al final).
    if (c === 'inicio' || enFlecha.has(id)) return;
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
    } else if (c === 'respuesta' && esPasoIA(p)) {
      // EL AI STEP: UNA tarjeta sin puertos —`puertos: []`, como un «Ir a»: sin puntos ni ＋— con SU objetivo y
      // sus escenarios adentro (undécima: una por objetivo, `resumenPasoIA`; lo dibuja `CuerpoPasoIA`). La flecha
      // que le llega es la del CRON (abajo). El ✦ de MaKo: la escribe MaKo.
      // Los hand-offs pendientes salieron por «Lo demás» (`detalle`, sólo en la de WhatsApp).
      const falta = resumenPasoIA(p).falta;
      const pendientes = Math.max(0, Math.floor(Number(op.pendientesOtraCosa) || 0));
      t = {
        ...base, tipo: 'paso-ia', familia: 'contenido', titulo: TITULO.paso_ia, icono: ICONO_MAKO, puertos: [],
        alto: altoPasoIA(), ...(pendientes && id === tarjetaDeHandoffs ? { detalle: `${pendientes} sin caso` } : {}),
        ...(falta ? { advertencia: 'Falta completar' } : {}),
      };
    } else if (c === 'respuesta') {
      // «SI RESPONDE» SE DIBUJA COMO LA CONDITION QUE ESCUCHA (sexta tanda, punto 12: «Reply ya te dije
      // que tiene que estar dentro de CONDITION»): una fila por caso, «Su respuesta trata de «…»»
      // (`textoCasoRespuesta`, la frase del catálogo), y la última «Si no» —lo que antes era «Otra
      // cosa»—. El dato y el motor no cambian (lib/flujo-grafo.ts, «Si responde» es una CONDITION).
      // `tipo` sigue siendo 'respuesta': de ahí salen el alto de su editor y su identidad.
      //
      // ⚠️ SIN CASOS, LA ÚNICA FILA ES «Respondió», NO «Si no» (séptima tanda, la #198 del ws1): sin un
      // «Sí» arriba, «Si no» decía que faltaba algo. Es la misma salida (`si_no`) con el rótulo de lo
      // que ES, y en verde: no es la rama de lo que no se cumplió (`rotuloSiNoDeRespuesta`, que lee
      // también el editor de la tarjeta).
      const puertos: PuertoNodo[] = (p.casos ?? []).map((x) => ({ id: x.id, rotulo: textoCasoRespuesta(x), tono: 'buena' as const, vacio: !x.siguiente }));
      const pendientes = Math.max(0, Math.floor(Number(op.pendientesOtraCosa) || 0));
      const conCasos = puertos.length > 0;
      puertos.push({ id: 'si_no', rotulo: rotuloSiNoDeRespuesta(p), tono: conCasos ? 'mala' : 'buena', vacio: !p.si_no, ...(pendientes ? { marca: `${pendientes} sin caso` } : {}) });
      t = { ...base, tipo: 'respuesta', familia: 'control', titulo: TITULO.condicion, icono: '🔀', puertos, alto: altoConFilas(puertos.length) };
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
      // Mensaje, acción y espera: UNA salida. Con el punto ocupado, la misma salida ofrece una flecha
      // EN PARALELO (si se puede publicar).
      //
      // ⚠️ SEXTA TANDA, PUNTO 4: LA SALIDA VA AL PIE, «Entonces ●» / «Siguiente paso ○» (`salidaAlPie`),
      // y la tarjeta mide eso de más (`ALTO_PUERTO`). La píldora de una espera, no: es de una línea y
      // su círculo va en el medio de su borde derecho, como siempre.
      const puertos: PuertoNodo[] = [{ id: 'sig', vacio: !pts[0]?.destino, ...(admiteParalelo(i) ? { paralelo: true } : {}) }];
      const pie = { salidaAlPie: true as const };
      const et = etiquetaDeAccion(p);
      if (c === 'esperar') {
        const detalle = textoEspera(p.espera).replace(/^Esperar /, '');
        t = { ...base, tipo: 'espera', familia: 'control', titulo: TITULO.esperar, icono: '⏳', detalle, puertos, ancho: anchoPildora(detalle), alto: ALTO_PILDORA };
      } else if (esMako(p)) {
        // LA TARJETA MAKO (decisión 11): la ⚡ Acción `avisar_al_equipo` dibujada como lo que hace,
        // con el mensaje recortado. Le escribe al grupo del negocio, no al lead. Desde la undécima, sus
        // PARTES en un renglón (`resumenDeMako`): una que es sólo la Voz de MaKo no dice «Sin escribir».
        const msg = resumenMako(p).replace(/\s+/g, ' ').trim();
        t = {
          ...base, tipo: 'mako', familia: 'contenido', titulo: TITULO.mako, icono: ICONO_MAKO, puertos, ...pie, alto: ALTO_MAKO + ALTO_PUERTO,
          detalle: msg ? (msg.length > 90 ? `${msg.slice(0, 89).trimEnd()}…` : msg) : 'Sin escribir',
          ...(msg ? {} : { advertencia: 'Sin escribir' }),
        };
      } else if (et) {
        // LA TARJETA DE ETIQUETA (decisión 8): la misma ⚡ Acción, dibujada como lo que hace.
        t = {
          ...base, tipo: 'etiqueta', familia: 'control', titulo: TITULO.etiqueta, icono: '🏷️', puertos, ...pie,
          ancho: ANCHO_ETIQUETA, alto: ALTO_COMPACTO + ALTO_PUERTO, detalle: textoEtiqueta(et, op.nombres),
          color: et.etiquetaId != null ? (op.colorEtiqueta?.(et.etiquetaId) ?? null) : null,
          ...(et.etiquetaId == null ? { advertencia: 'Falta elegir la etiqueta' } : {}),
        };
      } else if (c === 'accion') {
        // ⚠️ UN PASO DE ACCIÓN ES OTRO NODO, NO UN MENSAJE VACÍO: dibujado como mensaje sería
        // una burbuja en blanco que afirma que al lead le llega algo.
        const operacion = (p.accion?.operacion ?? '').trim();
        t = {
          ...base, tipo: 'accion', familia: 'contenido', titulo: TITULO.accion, icono: ICONO_ACCION, puertos, ...pie, alto: ALTO_MIN + 14 + ALTO_PUERTO,
          detalle: operacion ? (op.tituloAccion?.(operacion) || operacion) : 'Sin elegir',
          ...(operacion ? {} : { advertencia: 'Falta elegir la acción' }),
        };
      } else {
        const email = p.canal === 'email';
        const social = esCanalSocial(p.canal) ? p.canal : null;
        const titulo = tituloDeTarjeta(p, enRespuesta.has(id));
        // La identidad de la app (decisión 5): el logo de WhatsApp para todo lo que sale por ahí
        // —texto, audio, archivo o escrito por MaKo— y el sobre de Gmail para el email. Instagram y
        // Messenger llevan su logo (la clave del catálogo de marcas, app/_components/ServicioVisual.tsx).
        const icono = social ?? (email ? ICONO_GMAIL : 'whatsapp');
        const vacio = mensajeVacio(p);
        const audio = p.tipo === 'audio' && Number(p.audio_id) > 0 ? op.audioDe?.(Number(p.audio_id)) : undefined;
        // Un DM de Instagram o Messenger después de una espera de más de 24 h: Meta no deja escribirle
        // y el motor lo cierra sin mandar (`decidirSalida`, lib/canal-social.ts). Se avisa en la tarjeta.
        const fueraDeVentana = social != null && esperaAntesDe(pasos, id) > VENTANA_META_MS / 60_000;
        t = {
          ...base, tipo: 'mensaje', familia: 'contenido', titulo, icono, canal: social ?? (email ? 'email' : 'whatsapp'),
          puertos, ...pie, alto: altoDeMensaje(p, audio) + ALTO_PUERTO,
          ...(vacio ? { advertencia: 'Sin escribir' } : fueraDeVentana ? { advertencia: AVISO_VENTANA_META } : {}),
        };
      }
    }
    // SUELTA (sexta tanda, punto 7): no cuelga de nada. Se marca en el dibujo (borde punteado) aunque
    // ya diga otra cosa, como «Sin escribir»: Publicar la frena igual (`validarGrafo`).
    if (!alcanzable.has(id)) t = { ...t, suelta: true };
    if (!alcanzable.has(id) && !t.advertencia) t = { ...t, advertencia: 'Tarjeta suelta' };
    // Lo de ANTES que quedó en un paso de un flujo ya convertido (una espera en
    // `delay_horas`, un `requiere`): el motor lo sigue haciendo y la tarjeta no lo muestra,
    // así que se marca en vez de esconderlo.
    if ((c === 'mensaje' || c === 'accion') && (Number(p.delay_horas) > 0 || p.ancla === 'reunion' || !!p.requiere) && !t.advertencia) {
      t = { ...t, advertencia: 'Tiene una espera o condición de antes' };
    }
    tarjetas.set(id, t);
  });

  // ── La tarjeta CRON: el disparador ──
  // ⚠️ CUARTA TANDA, PUNTO 4: «No tiene sentido que el CRON tenga la opción de "Si responde"... Eso es
  // una CONDITION... se va el texto "Si responde" del CRON, y también quita el texto "Al entrar"». El
  // CRON no tiene filas: de él salen varias flechas (en paralelo) desde su salida.
  //
  // ⚠️ SEXTA TANDA, CRON 10: «copiá la tarjeta de CRON de ManyChat»: «⚡ CRON» con una cajita por
  // disparador elegido (`op.disparadores`, o la de siempre con `op.disparador`), «+ Nuevo CRON» abajo
  // si quien monta sabe agregar uno, y la salida al pie, «Entonces ●». El alto se SUMA (`altoCron`):
  // la tarjeta tiene alto fijo.
  //
  // ⚠️ Y SIN LA FILA «SI RESPONDE» TAMPOCO EN LOS FLUJOS QUE LA TIENEN (segunda pasada de la sexta
  // tanda). Hasta acá un flujo convertido de la primera tanda seguía dibujando las dos filas («Al
  // entrar» y «Si responde») y una flecha del CRON a la tarjeta. «Si responde» es la CONDITION que
  // escucha: se decide cuando el lead ESCRIBE. Desde la séptima tanda la cuelga del CRON una flecha
  // desde ESTA salida (abajo, «la flecha de la que escucha»), no una fila. Lo que corre no cambió.
  const textosCron = (op.disparadores?.length ? op.disparadores.map((d) => d.texto) : [op.disparador]);
  const salidaCron = { id: 'sig', vacio: !raiz, ...(raiz && admiteParalelo(iIni) ? { paralelo: true } : {}) };
  tarjetas.set(ID_ENTRADA, {
    id: ID_ENTRADA, tipo: 'entrada', familia: 'contenido', titulo: TITULO.cron, icono: ICONO_CRON, detalle: op.disparador,
    puertos: [salidaCron], salidaAlPie: true,
    ancho: ANCHO_NODO, alto: altoCron(textosCron, op.nuevoDisparador === true, 1),
  });

  // ── El árbol: a quién le cuelga cada uno (el PRIMERO que lo alcanza gana) ──
  // Con un grafo válido cada nodo tiene un padre; mientras se edita puede no serlo, y un
  // nodo con dos padres se dibuja UNA vez (las dos flechas igual se ven).
  //
  // Los hijos del CRON son [la salida principal, …sus flechas en paralelo, «Si responde»]: en ese orden
  // se apilan, así la que escucha queda DEBAJO de la salida, en la columna de al lado del CRON.
  //
  // ⚠️ SÉPTIMA TANDA (10/10/2026): «SI RESPONDE» VUELVE A SER HIJO DEL CRON EN EL DIBUJO. Pedido literal
  // de Martín sobre la #198 del ws1: «hay una condición suelta que no esta conectado a nada... cuando
  // habíamos dicho que una tarjeta sin conexiones puede estar, pero como borrador». En la segunda pasada
  // de la sexta tanda se la había sacado del árbol del CRON —sin flecha de entrada, en la columna 0,
  // debajo de todo— y eso es EXACTAMENTE cómo se ve una tarjeta suelta (sin la marca, pero con el mismo
  // lugar y la misma falta de flecha). Medido en la base ese día: la #198 no tiene NINGUNA suelta de
  // verdad (`tarjetasSueltas` vacío, `validarGrafo` vacío), así que Publicar y Probar no tenían nada que
  // frenar: lo que mentía era el dibujo. En el motor «Si responde» cuelga del CRON (escucha desde que el
  // lead entra), y eso es lo que ahora se dibuja: su flecha sale de la salida del CRON (la ÚNICA: la
  // fila «Si responde» del CRON no vuelve, cuarta tanda, punto 4).
  //
  // Una espera que va EN LA FLECHA no ocupa columna: el hijo es lo que viene después de ella (`tramo`).
  const destinosDe = (id: string): Array<string | null> => {
    const visibles = (ds: Array<string | null>) => ds.map((d) => tramo(d).hasta);
    if (id !== ID_ENTRADA) return visibles(puertosDe(pasos, indicePorId(pasos, id)).map((pt) => pt.destino));
    return [...visibles(iIni >= 0 ? puertosDe(pasos, iIni).map((pt) => pt.destino) : [raiz]), ...escuchan];
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
  // Cuánto se separa la columna de los hijos de `id`: el hueco de siempre, o lo que pidan las pastillas de
  // las esperas que van en sus flechas (ver `AIRE_PILDORA`). Una flecha con N esperas las pone en los
  // tramos k/(N+1) (`tDePildora`), así que cada tramo tiene que alojar media pastilla de cada lado —y
  // contra una tarjeta, media pastilla más su aire—: el hueco es N+1 veces el tramo más exigente.
  const huecoHacia = (id: string, hs: readonly string[]): number => {
    const ds = id === ID_ENTRADA
      ? (iIni >= 0 ? puertosDe(pasos, iIni).map((pt) => pt.destino) : [raiz])
      : puertosDe(pasos, indicePorId(pasos, id)).map((pt) => pt.destino);
    let hueco = GAP_COLUMNA;
    for (const d of ds) {
      const t = tramo(d);
      if (!t.esperas.length || !t.hasta || !hs.includes(t.hasta)) continue;
      const w = t.esperas.map((e) => anchoPildoraFlecha(textoDeEspera(e)));
      let tramoMax = Math.max(w[0] / 2, w[w.length - 1] / 2) + AIRE_PILDORA;
      for (let k = 1; k < w.length; k++) tramoMax = Math.max(tramoMax, (w[k - 1] + w[k]) / 2 + AIRE_PILDORA / 2);
      hueco = Math.max(hueco, Math.ceil(tramoMax * (w.length + 1)));
    }
    return hueco;
  };
  const pos = new Map<string, { x: number; y: number }>();
  const colocar = (id: string, x: number, y: number) => {
    pos.set(id, { x, y });
    const hs = hijos.get(id) ?? [];
    if (!hs.length) return;
    const x2 = x + ANCHO_NODO + huecoHacia(id, hs);
    if (!esMulti(id)) { colocar(hs[0], x2, y); return; }
    let cur = y + anclaDe(id) - bloque(hs) / 2;
    for (const h of hs) {
      const m = medidas.get(h)!;
      colocar(h, x2, cur + m.sobre);
      cur += m.sobre + m.bajo + GAP_Y;
    }
  };

  // 1. El CRON y todo lo que cuelga de él: la salida, sus paralelos y «Si responde» (columna 1).
  //    Las esperas que van en una flecha no son de nadie: no se colocan (ni abajo, como sueltas).
  for (const e of enFlecha) asignado.add(e);
  asignado.add(ID_ENTRADA); armar(ID_ENTRADA);
  const mCron = medir(ID_ENTRADA);
  colocar(ID_ENTRADA, 0, 0);
  let cursor = mCron.bajo + GAP_RAICES;

  // 2. Lo que no cuelga del CRON, abajo y en columna 0 —el destino de un salto sin padre, una tarjeta
  //    suelta, un ciclo— en el orden del array. El inicio no: ES el CRON. («Si responde» ya no está
  //    acá desde la séptima tanda: es el último hijo del CRON.)
  const libres = ids.map((_, i) => i);
  for (const i of libres) {
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
  // Una flecha que pasa por esperas (`tramo`) llega a lo de después y las lleva como pastillas.
  const aristas: AristaFlujo[] = [];
  const conEsperas = (t: { esperas: string[] }) => (t.esperas.length ? { esperas: t.esperas.map((e) => ({ id: e, texto: textoDeEspera(e) })) } : {});
  if (iIni < 0 && raiz) {
    const t = tramo(raiz);
    if (t.hasta && pos.has(t.hasta)) aristas.push({ desde: ID_ENTRADA, hasta: t.hasta, puerto: 'sig', tono: 'normal', ...conEsperas(t) });
  }
  pasos.forEach((_, i) => {
    if (enFlecha.has(ids[i])) return;
    for (const pt of puertosDe(pasos, i)) {
      const t = tramo(pt.destino);
      if (t.hasta && pos.has(t.hasta)) {
        aristas.push({ desde: i === iIni ? ID_ENTRADA : ids[i], hasta: t.hasta, puerto: pt.puerto, tono: pt.puerto.startsWith('par:') ? 'condicional' : 'normal', ...conEsperas(t) });
      }
    }
  });
  // ── LA FLECHA DE LA QUE ESCUCHA: del CRON a «Si responde», desde su salida ──
  // En `pasos` «Si responde» no tiene padre: la flecha dice lo que hace el motor —escucha desde que el
  // lead entra por el CRON—. `sinMas`: sin ＋ en el medio (insertar ahí escribiría una flecha que el dato
  // no admite).
  //
  // ⚠️ DESDE EL 10/10/2026 ES UNA FLECHA NORMAL, SIN RÓTULO Y CON PAPELERA (`quitable`). Pedido de Martín:
  // «aparece luego del cron una flecha punteada que dice "Si responde"… La flecha no se puede eliminar, no
  // se puede editar, nada de eso tiene sentido. De por sí no debería haber un chip en el medio… para eso
  // ya tenemos la tarjeta de condición»; y eligió «Una condición normal». Borrarla deja «Si responde»
  // SUELTA (`suelta`, lib/flujo-grafo.ts: el motor deja de escuchar y Publicar la frena como a cualquier
  // suelta); se vuelve a conectar arrastrando desde el CRON (`conectar`, lib/flujo-edicion.ts).
  // AI Step v2: una flecha por CADA tarjeta que escucha (las AI Step son varias).
  for (const r of escuchan) {
    if (pos.has(r)) aristas.push({ desde: ID_ENTRADA, hasta: r, puerto: 'sig', tono: 'normal', sinMas: true, quitable: true });
  }

  const normal = aOrigen(nodos, MARGEN);
  // Las esperas de las flechas, como nodos `enFlecha` en el lugar de su pastilla: no se dibujan como
  // tarjeta, pero se seleccionan, se editan y salen en el menú como cualquiera (el panel las busca acá).
  const ocultas: NodoFlujo[] = [];
  const g0 = { nodos: normal, aristas };
  for (const e of enFlecha) {
    const r = posicionDePildora(g0, e);
    if (!r) continue;
    ocultas.push({
      id: e, tipo: 'espera', familia: 'control', titulo: TITULO.esperar, icono: '⏳', detalle: textoDeEspera(e),
      enFlecha: true, puertos: [], x: r.x, y: r.y, ancho: r.ancho, alto: r.alto,
    });
  }
  const todos = [...normal, ...ocultas];
  return { nodos: todos, aristas, ...encerrar(normal) };
}

// ── Editar: lo que hace cada ＋ ─────────────────────────────────────────────────────

/**
 * Lo que el ＋ CREA. Sin «Ir a» desde la tercera tanda (decisión 3; pedido literal: «No se entiende
 * lo de "Ir a" eso para mi no tiene mucho sentido. Eliminalo»). Los «Ir a» que ya existen (la 198
 * salta a la 212, el que junta ramas) se siguen dibujando, corriendo y borrando: lo que se va es
 * crearlos. Con «MaKo» (decisión 11): la ⚡ Acción `avisar_al_equipo`, dibujada como su tarjeta.
 */
export type QueAgregar = 'mensaje' | 'email' | 'esperar' | 'condicion' | 'etiqueta' | 'accion' | 'mako' | 'ai_step' | CanalSocial;
/**
 * Una opción del menú del ＋ (estructural: `DropdownOption` vive en un componente). `grupo` separa
 * el menú con una línea; `icono` es un SVG (`data:`), nunca un emoji.
 *
 * (Hasta la segunda pasada de la sexta tanda el ＋ podía ofrecer además 'respuesta' —crear «Si
 * responde» desde su fila del CRON—. Se fue con la fila: lo nuevo se crea eligiendo «Su respuesta
 * trata de» en una CONDITION vacía, `condicionARespuesta`.)
 */
export type OpcionMas = { value: QueAgregar; label: string; icono?: string; grupo?: number };

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
  // El engranaje: el rayo es del CRON desde la sexta tanda (`ICONO_CRON`), y las dos no lo comparten.
  accion: svg(`<g ${LINEA}><circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g>`),
  mako: svg('<path fill="#F2B01E" d="M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z"/>', '-12 -12 24 24'),
  // AI Step (novena tanda): la chispa de MaKo con una chispa chica al lado. La sola es «MaKo en WhatsApp»:
  // las dos en el mismo menú con el mismo dibujo no se distinguían.
  ai_step: svg('<path fill="#F2B01E" d="M-2 -9 C-1.2 -3.4 1.4 -0.8 7 0 C1.4 0.8 -1.2 3.4 -2 9 C-2.8 3.4 -5.4 0.8 -11 0 C-5.4 -0.8 -2.8 -3.4 -2 -9 Z"/><path fill="#F2B01E" d="M7.5 -11 C7.9 -8.6 8.9 -7.6 11 -7.2 C8.9 -6.8 7.9 -5.8 7.5 -3.4 C7.1 -5.8 6.1 -6.8 4 -7.2 C6.1 -7.6 7.1 -8.6 7.5 -11 Z"/>', '-12 -12 24 24'),
  // Los logos oficiales sobre su degradé (lib/canal-social.ts, `logoSocialSvg`).
  instagram: logoSocialSvg('instagram'),
  messenger: logoSocialSvg('messenger'),
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
 * · «AI Step» (novena tanda) SÍ: es «Si responde» con sus escenarios adentro, y se ofrece con sus mismas
 *   reglas —desde la undécima UNO por medio (`puedeSumarAIStep`: no con un «Si responde» de los de siempre ni
 *   si ya hay uno), nunca adentro de la rama de la respuesta— desde cualquier ＋. NO se engancha en esa
 *   salida: nace colgada del CRON, como «Si responde» (no tiene padre: es un evento), y la salida queda como
 *   estaba (`insertarDesdeLienzo`).
 */
export function opcionesDelMas(pasos: readonly PasoGrafo[], nodoLienzo: string, medio: boolean, puerto?: string): OpcionMas[] {
  void medio; void puerto;
  const resp = raizRespuesta(pasos);
  const enRespuesta = nodoLienzo !== ID_ENTRADA && (nodoLienzo === resp || subarbolRespuesta(pasos).has(nodoLienzo));
  const sinAIStep = !puedeSumarAIStep(pasos);
  return MENU_MAS
    .filter((o) => !(enRespuesta && o.fueraDeRespuesta) && !(sinAIStep && o.value === 'ai_step'))
    .map(({ fueraDeRespuesta, ...o }) => { void fueraDeRespuesta; return o; });
}

// (Acá vivía `hayQueEscucha`: «una tarjeta que escucha por automatización». La regla es `puedeSumarAIStep`
// (lib/flujo-grafo.ts): no con un «Si responde» de los de siempre, y UN AI Step por medio (undécima tanda).)

/**
 * LO QUE SE PUEDE CREAR, una fila por tipo de tarjeta: lo leen el ＋ de cada salida
 * (`opcionesDelMas`) y el click derecho en el lienzo (`opcionesSueltas`, sexta tanda, punto 2).
 *
 * ⚠️ PARA SUMAR UN TIPO, UNA FILA ACÁ (y su caso en `nodoNuevo` y en `QueAgregar`): el menú se arma
 * solo. `fueraDeRespuesta`: no se ofrece debajo de un «Si responde» (se contesta en el momento y por
 * el chat donde el lead escribió). `grupo` lo separa con una línea; `icono` es un SVG, nunca un emoji.
 */
export const MENU_MAS: ReadonlyArray<OpcionMas & { fueraDeRespuesta?: boolean }> = [
  { value: 'mensaje', label: 'WhatsApp', icono: ICONOS_MAS.whatsapp, grupo: 0 },
  { value: 'email', label: 'Email', icono: ICONOS_MAS.email, grupo: 0, fueraDeRespuesta: true },
  // Instagram y Messenger (sexta tanda, CRON 5 y 7) van con los mensajes. No adentro de «Si
  // responde»: esa rama le contesta por el WhatsApp donde escribió, y el motor la frena ahí.
  { value: 'instagram', label: 'Instagram', icono: ICONOS_MAS.instagram, grupo: 0, fueraDeRespuesta: true },
  { value: 'messenger', label: 'Messenger', icono: ICONOS_MAS.messenger, grupo: 0, fueraDeRespuesta: true },
  { value: 'esperar', label: 'Esperar', icono: ICONOS_MAS.esperar, grupo: 1, fueraDeRespuesta: true },
  { value: 'condicion', label: 'Condición', icono: ICONOS_MAS.condicion, grupo: 1 },
  // Novena tanda: la tarjeta que contesta cuando el lead escribe, con sus escenarios adentro. Va con la lógica:
  // es la condición que escucha. No adentro de su propia rama (`fueraDeRespuesta`); una por medio
  // (`puedeSumarAIStep`, undécima tanda).
  { value: 'ai_step', label: 'AI Step', icono: ICONOS_MAS.ai_step, grupo: 1, fueraDeRespuesta: true },
  { value: 'etiqueta', label: 'Etiqueta', icono: ICONOS_MAS.etiqueta, grupo: 2 },
  { value: 'accion', label: 'Acción', icono: ICONOS_MAS.accion, grupo: 2 },
  { value: 'mako', label: 'MaKo en WhatsApp', icono: ICONOS_MAS.mako, grupo: 3 },
];

/**
 * LO QUE EL CLICK DERECHO CREA SUELTO en el lienzo (sexta tanda, punto 2: «crear una tarjeta» en
 * cualquier lugar). Lo mismo que el ＋, sin la restricción de «Si responde» (una tarjeta suelta no
 * cuelga de nada todavía) y sin «Si responde» (no se ofrece desde la cuarta tanda).
 */
export function opcionesSueltas(pasos: readonly PasoGrafo[] = []): OpcionMas[] {
  // «AI Step» sólo si se puede sumar (`puedeSumarAIStep`): con un «Si responde» de los de siempre, o con el AI
  // Step del medio ya puesto, no se publica. Sin `pasos`, lo de siempre (la lista entera).
  const sinAIStep = !puedeSumarAIStep(pasos);
  return MENU_MAS.filter((o) => !(sinAIStep && o.value === 'ai_step')).map(({ fueraDeRespuesta, ...o }) => { void fueraDeRespuesta; return o; });
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
    // Instagram y Messenger: el mismo mensaje con su canal (sale por Zernio, lib/canal-zernio.ts).
    case 'instagram': case 'messenger': return { ...b, canal: que };
    // La etiqueta es la ⚡ Acción de poner una etiqueta, sobre el lead del EVENTO (decisión 8): nace
    // «Poner» y sin etiqueta elegida, y así no se puede publicar hasta elegir una.
    case 'etiqueta': return { ...b, accion: { operacion: OP_PONER_ETIQUETA, params: { leadId: LEAD_DEL_EVENTO } } };
    // La tarjeta MAKO (decisión 11): el aviso al grupo del negocio, sobre el lead del EVENTO. Nace sin mensaje:
    // `faltaEscribir` lo frena.
    // ⚠️ UNDÉCIMA: NACE CON `partes: []` (la lista EXPLÍCITA, aunque vacía), así sale TAL CUAL (`esTarjetaTalCual`,
    // lib/mako-tarjeta.ts): lo que se escribe en la tarjeta es lo que llega, sin «🟡 título», sin «— MaKo» y sin el
    // nombre · teléfono · link que agregaba el aviso. Los datos van a la vista, con el «{ }».
    case 'mako': return { ...b, accion: { operacion: OP_AVISAR, params: { leadId: LEAD_DEL_EVENTO, partes: [] } } };
    // EL AI STEP (novena tanda): «Si responde» con sus escenarios adentro, colgada del CRON.
    //
    // UNDÉCIMA TANDA: NACE SIN ESCENARIOS Y SIN OBJETIVO. Lo primero es el objetivo (el único texto libre, con
    // «✦ Armar» que propone los escenarios); sin él, Publicar no deja (`erroresDelPasoIA`) y la tarjeta dice
    // «Falta el objetivo» en rojo. (En la novena nacía con un caso vacío para que Publicar frenara: sin casos era
    // una tarjeta válida que no contestaba nada. El objetivo obligatorio lo cubre.)
    case 'ai_step': return { ...b, nodo: 'respuesta', paso_ia: true, casos: [], si_no: null };
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
 * EL BORRADOR como lo abre el lienzo: un borrador de antes se abre con UN AI Step por medio
 * (`juntarPasosIA` entre dos `normalizar`, como `abrirFlujo`). La llaman el lienzo
 * (app/automations/SecuenciaPerfil.tsx) y el teléfono (app/m/automations): una regla, un lugar.
 */
export function borradorAlAbrir<P extends PasoGrafo>(pasos: readonly P[]): P[] {
  return renumerar(normalizar(juntarPasosIA(normalizar(pasos)).pasos));
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
  // ⚠️ EL AI STEP NO SE ENGANCHA EN EL ＋ QUE LO CREÓ (novena tanda). Es la que ESCUCHA (`respuesta`): no
  // tiene padre (`validarGrafo`: «cuelga del CRON»), así que `insertarNodo` la dejaba apuntada por esa
  // salida —un flujo que ni Publicar ni el borrador aceptan— y lo que colgaba de la salida pasaba a colgar
  // de ella. Nace al FINAL del array (no corre el índice de nadie), colgada del CRON, y la salida queda
  // como estaba. Una sola por medio: si ya hay una, no se crea (el menú tampoco la ofrece).
  if (que === 'ai_step') {
    // Undécima: UNO por medio (`puedeSumarAIStep`), y no con un «Si responde» de los de siempre.
    if (!puedeSumarAIStep(base)) return { pasos: base, id: null };
    const n = nodoNuevo('ai_step', base, rnd) as unknown as P;
    return { pasos: renumerar(normalizar([...base, n])), id: n.id! };
  }
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

// (Acá vivía `tarjetasParaIrA`, a dónde podía saltar un «Ir a». Desde la sexta tanda GO TO no se crea ni
// elige destino: su editor lo pasa a flecha o lo quita (`quitarIrA`, lib/flujo-legado.ts). Se fue en la
// segunda pasada, sin call site.)

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
  // La rama se lleva también el subárbol de cada flecha en paralelo suya (cuarta tanda, punto 8): si no,
  // quedan tarjetas sueltas que Publicar rechaza.
  let sin = sacarSubarbol(pasos, r.siguiente);
  for (const d of paralelosDeResultado(c, ramaId)) sin = sacarSubarbol(sin, d);
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

// (Acá vivía `crearRespuesta`, que armaba «Si responde» desde la fila del CRON. Se fue con la fila en la
// segunda pasada de la sexta tanda: la CONDITION que escucha nace de una CONDITION vacía al elegir «Su
// respuesta trata de» (`condicionARespuesta`, lib/flujo-grafo.ts), con su «Si no» avisando al equipo.)

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
  /** VARIAS etapas del mismo kanban (punto 14, mig 0230). Cuáles disparan lo dice `etapasDe`. */
  etapas?: readonly string[] | null;
};

/** Un paso del desplegable del CRON: sus opciones, o los pasos de adentro (`grupos`). */
export type SeccionDisparo = { title: string; options: OpcionDisparo[]; grupos?: SeccionDisparo[] };

/** Los dos kanbans de un producto, con el nombre con que se ofrecen (decisión 4). */
export const KANBAN_ADQUISICION = 'Adquisición de clientes';
export const KANBAN_ENTREGA = 'Entrega del servicio';

/**
 * El valor del desplegable para lo que la secuencia tiene puesto.
 *
 * Con VARIAS etapas (punto 14) las claves van juntas detrás del ámbito, separadas por coma:
 * `entrega:9:onb,hito1,hito2`. Es UN string a propósito: es lo que viaja entre «Crear con IA», la
 * ruta, el 409 con lo guardado y la tarjeta CRON (`ListoIA.disparador`, `disparoDeValor`), y así
 * ninguno de esos caminos necesitó otro campo. Una clave de etapa no lleva coma: las de la entrega
 * son `[a-z0-9_]` (`nuevaClaveEtapa`) y las del embudo, de fábrica o `st<N>`.
 */
export function valorDisparo(s: DisparoActual): string {
  if (s.trigger_tipo === 'etapa_actual') return `venta:${s.funnel_id ?? ''}:${etapasDe(s).join(',')}`;
  if (s.trigger_tipo === 'entrega_actual') return `entrega:${s.producto_id ?? ''}:${etapasDe(s).join(',')}`;
  if (s.trigger_tipo === 'etiqueta_puesta') return `etiqueta:${s.etiqueta_id ?? ''}`;
  return `trigger:${s.trigger_tipo}`;
}

/**
 * Lo puesto, como los valores de UNA etapa cada uno (los de las opciones del desplegable): es lo que
 * el Dropdown marca con `varios`. Un disparador sin etapa es un valor solo.
 */
export function valoresDisparo(s: DisparoActual): string[] {
  return separarValor(valorDisparo(s));
}

/** `venta:5:a,b` → [`venta:5:a`, `venta:5:b`]. Lo demás, tal cual. */
export function separarValor(valor: string): string[] {
  const m = /^(venta|entrega):([^:]*):(.*)$/.exec(valor);
  if (!m) return valor ? [valor] : [];
  const keys = normalizarEtapas(m[3].split(','));
  return keys.length ? keys.map((k) => `${m[1]}:${m[2]}:${k}`) : [];
}

/** El KANBAN de un valor: `venta:<embudo>` o `entrega:<producto>`. null = no es de etapa. */
export function kanbanDeValor(valor: string): string | null {
  const m = /^(venta|entrega):([^:]*):/.exec(valor);
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * LOS VALORES DESPUÉS DE TOCAR UNA OPCIÓN del desplegable del CRON (punto 14: «quiero que en el CRON
 * se puedan seleccionar más de 1 etapa»).
 *
 *   · Una etapa del MISMO kanban que lo puesto → se prende o se apaga (`alternarValor`, la misma del
 *     Dropdown), y la última no se apaga: un CRON sin etapa no dispara nunca.
 *   · Una etapa de OTRO kanban (la entrega en vez de la adquisición, u otro producto) → REEMPLAZA a
 *     lo puesto. Un CRON es de UN kanban: su ámbito (`funnel_id` o `producto_id`) es una columna, así
 *     que mezclar no se puede ni guardar. Reemplazar es lo que la persona espera cuando cambia de
 *     kanban; sumarla en silencio no se podría escribir.
 *   · Una etiqueta → reemplaza todo (dispara UNA).
 */
export function valoresTrasTocar(actuales: readonly string[], tocado: string): string[] {
  const k = kanbanDeValor(tocado);
  if (!k) return [tocado];
  const mismos = actuales.filter((v) => kanbanDeValor(v) === k);
  if (mismos.length !== actuales.length || !mismos.length) return [tocado];
  return alternarValor([...mismos], tocado, 1);
}

/** Los valores de UN kanban, juntos en el valor que se guarda (`venta:5:a,b`). Vacío → ''. */
export function valorDeVarios(valores: readonly string[]): string {
  if (!valores.length) return '';
  const k = kanbanDeValor(valores[0]);
  if (!k) return valores[0];
  const keys = normalizarEtapas(valores.filter((v) => kanbanDeValor(v) === k).map((v) => v.slice(k.length + 1)));
  return `${k}:${keys.join(',')}`;
}

/**
 * CÓMO SE DICEN VARIAS ETAPAS, en el botón del desplegable y en la tarjeta CRON (punto 14: «el botón
 * dice cuántas o cuáles»). Dice CUÁLES mientras entren en un renglón y, si son todas las del kanban,
 * lo dice así — es lo que la persona eligió, no una lista que hay que leer.
 *   · 2 → `Llega a «A» o «B»`
 *   · todas (3+) → `Cualquier etapa de la entrega` / `… de la venta`
 *   · 3+ → `Llega a «A», «B» y 3 más`
 */
export function fraseEtapas(nombres: readonly string[], todas: boolean, kanban: 'venta' | 'entrega'): string {
  if (nombres.length === 1) return `Llega a «${nombres[0]}»`;
  if (nombres.length === 2) return `Llega a «${nombres[0]}» o «${nombres[1]}»`;
  if (todas) return kanban === 'entrega' ? 'Cualquier etapa de la entrega' : 'Cualquier etapa de la venta';
  return `Llega a «${nombres[0]}», «${nombres[1]}» y ${nombres.length - 2} más`;
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
export const PASO_PRODUCTOS = 'Funnels';

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
  // El camino de títulos hasta una opción, y cuántas opciones tiene su paso (para «todas»).
  const buscar = (s: readonly SeccionDisparo[], ruta: string[], v: string): { ruta: string[]; enElPaso: number } | null => {
    for (const g of s) {
      const o = g.options.find((x) => x.value === v);
      if (o) return { ruta: [...ruta, g.title, o.label], enElPaso: g.options.length };
      const r = buscar(g.grupos ?? [], [...ruta, g.title], v);
      if (r) return r;
    }
    return null;
  };
  // VARIAS etapas (punto 14): cada una se busca por su valor de UNA etapa. Si alguna no está en la
  // lista (la borraron del kanban), el botón dice lo puesto como lo dice la tarjeta (`textoActual`).
  const partes = separarValor(valor);
  const halladas = partes.map((v) => buscar(secs, [], v));
  if (!halladas.length || halladas.some((h) => !h)) return textoActual;
  const r = halladas[0]!.ruta;
  if (r[r.length - 2] === 'Etiquetas') return r[r.length - 1];
  // [Productos, <producto>, <kanban>, <etapa>]; con un solo producto, [Productos, <kanban>, <etapa>].
  const producto = r.length >= 4 ? r[r.length - 3] : null;
  const nombres = halladas.map((h) => h!.ruta[h!.ruta.length - 1]);
  const todas = nombres.length >= 3 && nombres.length === halladas[0]!.enElPaso;
  const frase = fraseEtapas(nombres, todas, r[r.length - 2] === KANBAN_ENTREGA ? 'entrega' : 'venta');
  return producto ? `${producto} · ${frase}` : frase;
}

/**
 * LOS CANALES QUE «PROBAR» OFRECE (tercera tanda, decisión 14): los que el flujo USA, en el orden
 * WhatsApp → Email. Sin ningún mensaje, WhatsApp (el teléfono es lo que «Probar» abre por default).
 */
export function canalesParaProbar(pasos: readonly PasoGrafo[]): Array<'whatsapp' | 'email' | CanalSocial> {
  const mensajes = pasos.filter((p) => claseDe(p) === 'mensaje');
  const out: Array<'whatsapp' | 'email' | CanalSocial> = [];
  if (mensajes.some((p) => p.canal !== 'email' && !esCanalSocial(p.canal))) out.push('whatsapp');
  if (mensajes.some((p) => p.canal === 'email')) out.push('email');
  // Instagram y Messenger, después (sexta tanda): cada uno con su simulador (app/automations/SimuladorSocial.tsx).
  if (mensajes.some((p) => p.canal === 'instagram')) out.push('instagram');
  if (mensajes.some((p) => p.canal === 'messenger')) out.push('messenger');
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
 *
 * `datos` (undécima tanda, punto 4: «{{Mensaje de MaKo}}, ese dato NO existe»): lo que `problemasDeTokens`
 * (lib/tokens-del-flujo.ts) devuelve para ESTOS pasos con el CRON de la fila —`problemasDeTokens(pasos, trigger,
 * subtipo)`, la MISMA llamada con la que frena el server en `setSecuenciaPasos`—: el primero frena con su motivo
 * corto («No existe: {{x}}») y abre su tarjeta. Va DESPUÉS de lo estructural: primero que el flujo exista, después
 * que cada dato se pueda citar. Lo pasa quien conoce la fila (su CRON y su evento); sin él, no se miran los datos.
 * No se calcula acá por el ciclo de imports de arriba.
 */
export function frenoDelFlujo(
  pasos: readonly PasoGrafo[], faltanEnAccion?: FaltanEnAccion | null, datos?: readonly ProblemaDeTokens[] | null,
): { error: string; tarjeta: string | null } | null {
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
  const datoMalo = datos?.[0];
  if (datoMalo) return { error: datoMalo.motivo, tarjeta: datoMalo.tarjeta };
  return null;
}

/** Lo que se le manda al server al elegir un valor del desplegable (POST
 *  /api/chat-agent/secuencias, `action: 'trigger'`). null = el valor no se entiende. */
export function pedidoDisparo(valor: string, secuenciaId: number): Record<string, unknown> | null {
  const [clase, ambito, ...resto] = valor.split(':');
  // VARIAS etapas (punto 14) viajan juntas, con coma (`valorDisparo`). Con una sola, el pedido es
  // EXACTAMENTE el de siempre (sin `etapas`): la ruta, la API y los tests viejos lo siguen leyendo igual.
  const keys = clase === 'venta' || clase === 'entrega' ? normalizarEtapas(resto.join(':').split(',')) : [];
  const etapa = keys[0] ?? '';
  const varias = keys.length > 1 ? { etapas: keys } : {};
  if (clase === 'trigger' && ambito) return { action: 'trigger', id: secuenciaId, trigger_tipo: [ambito, ...resto].join(':') };
  if (clase === 'venta' && etapa) return { action: 'trigger', id: secuenciaId, trigger_tipo: 'etapa_actual', etapa, ...varias, funnel_id: ambito ? Number(ambito) : null };
  if (clase === 'entrega' && etapa && Number(ambito) > 0) return { action: 'trigger', id: secuenciaId, trigger_tipo: 'entrega_actual', etapa, ...varias, producto_id: Number(ambito) };
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
    // Con una sola etapa, null (como la fila que escribe `escribirDisparador`): así la firma de lo
    // pintado y la de la relectura coinciden y no se vuelve a sembrar de gusto.
    etapas: (p.etapas as string[] | undefined) ?? null,
  };
}
