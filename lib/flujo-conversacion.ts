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
// ── EL LAYOUT ──────────────────────────────────────────────────────────────────────────
//   · arriba a la izquierda, la tarjeta CRON (el disparador; NO es un paso) y, a su
//     derecha, la SALIDA: lo que MaKo manda por su cuenta (`raizSalida`);
//   · abajo, la raíz «Si responde» (o la tarjeta fantasma «＋ Si responde»);
//   · cada nodo de varias salidas apila sus ramas ARRIBA y ABAJO del centro de sus filas,
//     cada una con el alto de su subárbol, así dos ramas no se pisan nunca;
//   · al final todo se corre a coordenadas ≥ 0 (`aOrigen`): la primera rama de la primera
//     condición nace arriba de su padre, o sea con `y` negativa.

import {
  ANCHO_NODO, ALTO_MIN, GAP_Y, MARGEN, ALTO_PUERTO, PIE_PUERTOS, BORDE_NODO,
  encerrar, aOrigen, centroDeFilas,
  type NodoFlujo, type AristaFlujo, type GrafoFlujo, type PuertoNodo,
} from './lienzo-grafo';
import {
  type PasoGrafo, type RamaCondicion, type CampoCondicion, type NombresParaTexto, type LugarInsercion,
  CAMPOS_CONDICION, claseDe, idDe, normalizar, puertosDe, raizSalida, raizRespuesta, descendientes,
  indicePorId, nodoPorId, nuevoId, insertarNodo, conectarPuerto, textoRama, textoEspera,
} from './flujo-grafo';
import { LIMPIEZA, OP_AVISAR, type EstrategiaLegada } from './flujo-legado';
import { textoCron, type CronAviso } from './cron-aviso';
export type { TipoNodo, TonoArista, NodoFlujo, AristaFlujo, GrafoFlujo, PuertoNodo } from './lienzo-grafo';
export { curvaEntre, medioDeCurva, ANCHO_NODO, ALTO_MIN, GAP_X, GAP_Y } from './lienzo-grafo';

/** Lo que este módulo lee de un paso: el nodo del flujo y lo de siempre del mensaje. Es
 *  estructural a propósito: el DTO vive en un componente `use client` y un módulo de lib
 *  no importa valores de ahí. */
export type PasoParaGrafo = PasoGrafo & {
  /** El paso «⚡ Acción de MaKo» (lib/nutricion-paso-accion.ts). */
  accion?: { operacion?: string; params?: Record<string, unknown> } | null;
  variantes?: string[];
};

/** Los ids de lo que NO es un paso. Un paso nunca se llama así: `nuevoId` da `n…` y
 *  `normalizar` da `o<índice>`. */
export const ID_ENTRADA = 'entrada';
export const ID_NUEVA_RESPUESTA = 'nueva-respuesta';

/** Separación entre columnas del árbol. Sin etiquetas sobre las flechas, alcanza para el
 *  ＋ de una salida vacía y el ＋ del medio. */
const GAP_COLUMNA = 92;
/** Entre la salida y «Si responde» (y lo que haya debajo). */
const GAP_RAICES = 56;
const ALTO_ENTRADA = ALTO_MIN + 14;
const ALTO_FANTASMA = 56;

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

/** Alto estimado de un mensaje. Se estima y no se mide porque el layout tiene que existir
 *  ANTES del primer pintado. La tarjeta tiene alto FIJO (lleva puertos): lo que no entra
 *  se corta, y el texto entero está en el editor. */
function altoDeMensaje(p: PasoParaGrafo): number {
  if (p.tipo === 'audio') return 108;
  if (p.tipo === 'media') return 100;
  const cuerpo = p.cuerpo ?? '';
  const renglones = Math.max(1, Math.ceil(cuerpo.length / 34)) + (cuerpo.match(/\n/g)?.length ?? 0);
  const extra = (p.canal === 'email' && p.asunto ? 22 : 0) + (p.tipo === 'ia' ? 18 : 0);
  return Math.min(260, ALTO_MIN + 8 + Math.min(renglones, 8) * 17 + extra);
}

/** Una tarjeta con N filas de salida: la cabecera, las filas y el pie. */
export function altoConFilas(filas: number): number {
  return Math.max(ALTO_MIN, 40 + filas * ALTO_PUERTO + PIE_PUERTOS + BORDE_NODO * 2);
}

// ── Nombrar una tarjeta (para los errores) ────────────────────────────────────────

const NOMBRE_CLASE = { mensaje: 'Mensaje', accion: 'Acción', esperar: 'Espera', condicion: 'Condición', respuesta: 'Si responde', ir_a: 'Ir a' } as const;

/** «Mensaje 2», «Condición 1»: el número es el orden entre las de su clase. Es lo que
 *  la persona puede encontrar en el lienzo; el id (`n0a1b2c`) no le dice nada. */
export function nombreDeTarjeta(pasos: readonly PasoGrafo[], id: string): string {
  const i = indicePorId(pasos, id);
  if (i < 0) return 'una tarjeta';
  const c = claseDe(pasos[i]);
  if (c === 'respuesta') return NOMBRE_CLASE.respuesta;
  const n = pasos.slice(0, i + 1).filter((p) => claseDe(p) === c).length;
  return `${NOMBRE_CLASE[c]} ${n}`;
}

/** Un error de `validarGrafo` con las tarjetas nombradas como se ven, no por su id. */
export function errorLegible(err: string, pasos: readonly PasoGrafo[]): string {
  const ids = pasos.map((p, i) => idDe(p, i)).sort((a, b) => b.length - a.length);
  let out = err;
  for (const id of ids) {
    const re = new RegExp(`(^|[^\\w])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'g');
    out = out.replace(re, (_m, pre: string) => `${pre}«${nombreDeTarjeta(pasos, id)}»`);
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
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
  /** Se puede editar: sin «Si responde», dibuja la tarjeta fantasma «＋ Si responde». */
  editable?: boolean;
};

/** Lo que cuelga de «Si responde» (sin ella). Ahí no hay esperas: se contesta en el momento. */
export function subarbolRespuesta(pasos: readonly PasoGrafo[]): Set<string> {
  const r = raizRespuesta(pasos);
  return r ? descendientes(pasos, r) : new Set();
}

export function grafoDeSecuencia(pasosIn: readonly PasoParaGrafo[], op: OpcionesGrafo): GrafoFlujo {
  const pasos = normalizar(pasosIn);
  const ids = pasos.map((p, i) => idDe(p, i));
  const existe = new Set(ids);
  const raiz = raizSalida(pasos);
  const resp = raizRespuesta(pasos);
  const enRespuesta = subarbolRespuesta(pasos);
  const porSecuencia = new Map((op.secuencias ?? []).map((s) => [s.id, s.nombre]));

  // Lo que se alcanza desde una raíz o desde un salto. Lo demás es una tarjeta suelta
  // (la misma regla que `validarGrafo`): se dibuja igual —esconderla la haría imposible de
  // borrar— y con su marca.
  const alcanzable = new Set<string>();
  const raices = [raiz, resp, ...pasos.flatMap((p) => (claseDe(p) === 'ir_a' && p.destino && 'nodo' in p.destino ? [p.destino.nodo] : []))];
  for (const x of raices) if (x && existe.has(x)) { alcanzable.add(x); for (const d of descendientes(pasos, x)) alcanzable.add(d); }

  // ── La tarjeta de cada paso (sin posición todavía) ──
  type Tarjeta = Omit<NodoFlujo, 'x' | 'y'>;
  const tarjetas = new Map<string, Tarjeta>();
  pasos.forEach((p, i) => {
    const id = ids[i];
    const c = claseDe(p);
    const pts = puertosDe(pasos, i);
    const base = { id, ancho: ANCHO_NODO };
    let t: Tarjeta;
    if (c === 'condicion') {
      const puertos: PuertoNodo[] = (p.ramas ?? []).map((r) => ({ id: r.id, rotulo: textoRama(r, op.nombres), tono: 'buena' as const, vacio: !r.siguiente }));
      puertos.push({ id: 'si_no', rotulo: 'Si no', tono: 'mala', vacio: !p.si_no });
      t = { ...base, tipo: 'condicion', titulo: 'Condición', icono: '🔀', puertos, alto: altoConFilas(puertos.length) };
    } else if (c === 'respuesta') {
      const puertos: PuertoNodo[] = (p.casos ?? []).map((x) => ({ id: x.id, rotulo: x.titulo?.trim() || 'Caso sin nombre', tono: 'buena' as const, vacio: !x.siguiente }));
      puertos.push({ id: 'si_no', rotulo: 'Otra cosa', tono: 'mala', vacio: !p.si_no });
      t = { ...base, tipo: 'respuesta', titulo: 'Si responde', icono: '↩️', puertos, alto: altoConFilas(puertos.length) };
    } else if (c === 'ir_a') {
      const d = p.destino;
      let detalle = 'Sin elegir';
      let advertencia: string | undefined = 'Falta elegir a dónde';
      if (d && 'secuencia_id' in d) {
        const nom = porSecuencia.get(Number(d.secuencia_id));
        detalle = nom ?? 'Una automatización que ya no existe';
        advertencia = nom ? undefined : 'Esa automatización ya no existe';
      } else if (d && 'nodo' in d) {
        detalle = existe.has(d.nodo) ? nombreDeTarjeta(pasos, d.nodo) : 'Una tarjeta que ya no existe';
        advertencia = existe.has(d.nodo) ? undefined : 'Esa tarjeta ya no existe';
      }
      // `puertos: []`: un «Ir a» termina ahí. Sin puntos y sin el ＋ de pasar el cursor.
      t = { ...base, tipo: 'ir-a', titulo: 'Ir a', icono: '↪️', detalle, ...(advertencia ? { advertencia } : {}), puertos: [], alto: ALTO_MIN };
    } else {
      // Mensaje, acción y espera: UNA salida, el punto a la altura de la cabecera.
      const puertos: PuertoNodo[] = [{ id: 'sig', vacio: !pts[0]?.destino }];
      if (c === 'esperar') {
        t = { ...base, tipo: 'espera', titulo: 'Esperar', icono: '⏳', detalle: textoEspera(p.espera).replace(/^Esperar /, ''), puertos, alto: ALTO_MIN };
      } else if (c === 'accion') {
        // ⚠️ UN PASO DE ACCIÓN ES OTRO NODO, NO UN MENSAJE VACÍO: dibujado como mensaje sería
        // una burbuja en blanco que afirma que al lead le llega algo.
        const operacion = (p.accion?.operacion ?? '').trim();
        t = {
          ...base, tipo: 'accion', titulo: 'Acción', icono: '⚡', puertos, alto: ALTO_MIN + 14,
          detalle: operacion ? (op.tituloAccion?.(operacion) || operacion) : 'Sin elegir',
          ...(operacion ? {} : { advertencia: 'Falta elegir la acción' }),
        };
      } else {
        const email = p.canal === 'email';
        const titulo = email ? 'Email'
          : p.tipo === 'audio' ? 'Nota de voz'
          : p.tipo === 'media' ? 'Archivo'
          : p.tipo === 'ia' && enRespuesta.has(id) ? 'MaKo contesta'
          : 'Mensaje';
        const icono = email ? '✉️' : p.tipo === 'audio' ? '🎙️' : p.tipo === 'media' ? '📎' : '💬';
        const vacio = (p.tipo === 'audio' && !p.audio_id) || (p.tipo === 'media' && !p.media_id) || (p.tipo !== 'audio' && p.tipo !== 'media' && !(p.cuerpo ?? '').trim());
        t = { ...base, tipo: 'mensaje', titulo, icono, puertos, alto: altoDeMensaje(p), ...(vacio ? { advertencia: 'Sin escribir' } : {}) };
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

  // ── El árbol: a quién le cuelga cada uno (el PRIMERO que lo alcanza gana) ──
  // Con un grafo válido cada nodo tiene un padre; mientras se edita puede no serlo, y un
  // nodo con dos padres se dibuja UNA vez (las dos flechas igual se ven).
  const hijos = new Map<string, string[]>();
  const asignado = new Set<string>();
  const armar = (id: string) => {
    const i = indicePorId(pasos, id);
    const hs: string[] = [];
    for (const pt of puertosDe(pasos, i)) {
      const d = pt.destino;
      if (d && existe.has(d) && !asignado.has(d)) { asignado.add(d); hs.push(d); }
    }
    hijos.set(id, hs);
    for (const h of hs) armar(h);
  };
  const esMulti = (id: string) => { const c = claseDe(pasos[indicePorId(pasos, id)]); return c === 'condicion' || c === 'respuesta'; };
  const anclaDe = (id: string) => {
    const t = tarjetas.get(id)!;
    return esMulti(id) ? centroDeFilas(t.alto, t.puertos?.length ?? 0) : 0;
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

  // 1. La salida, a la derecha del CRON, arrancando a su altura.
  const nodos: NodoFlujo[] = [{
    id: ID_ENTRADA, tipo: 'entrada', titulo: 'CRON', icono: '⚡', detalle: op.disparador,
    puertos: [{ id: 'sig', vacio: !raiz }],
    x: 0, y: 0, ancho: ANCHO_NODO, alto: ALTO_ENTRADA,
  }];
  let cursor = ALTO_ENTRADA;
  if (raiz && existe.has(raiz)) {
    asignado.add(raiz); armar(raiz);
    const m = medir(raiz);
    colocar(raiz, ANCHO_NODO + GAP_COLUMNA, 0);
    cursor = Math.max(ALTO_ENTRADA, m.bajo);
  }
  cursor += GAP_RAICES;

  // 2. «Si responde» abajo, en la columna del CRON (o su tarjeta fantasma).
  if (resp && !asignado.has(resp)) {
    asignado.add(resp); armar(resp);
    const m = medir(resp);
    colocar(resp, 0, cursor + m.sobre);
    cursor += m.sobre + m.bajo + GAP_RAICES;
  } else if (!resp && op.editable) {
    nodos.push({
      id: ID_NUEVA_RESPUESTA, tipo: 'suelto', titulo: 'Si responde', icono: '＋', puertos: [],
      x: 0, y: cursor, ancho: ANCHO_NODO, alto: ALTO_FANTASMA,
    });
    cursor += ALTO_FANTASMA + GAP_RAICES;
  }

  // 3. Lo que no cuelga de ninguna raíz (el destino de un salto sin padre, una tarjeta
  //    suelta, un ciclo), abajo de todo y en el orden del array.
  for (const id of ids) {
    if (asignado.has(id)) continue;
    asignado.add(id); armar(id);
    const m = medir(id);
    colocar(id, 0, cursor + m.sobre);
    cursor += m.sobre + m.bajo + GAP_RAICES;
  }

  for (const id of ids) {
    const p = pos.get(id);
    if (p) nodos.push({ ...tarjetas.get(id)!, ...p });
  }

  // ── Las flechas: una por salida con destino, desde SU puerto ──
  const aristas: AristaFlujo[] = [];
  if (raiz && pos.has(raiz)) aristas.push({ desde: ID_ENTRADA, hasta: raiz, puerto: 'sig', tono: 'normal' });
  pasos.forEach((_, i) => {
    for (const pt of puertosDe(pasos, i)) {
      if (pt.destino && pos.has(pt.destino)) aristas.push({ desde: ids[i], hasta: pt.destino, puerto: pt.puerto, tono: 'normal' });
    }
  });

  const normal = aOrigen(nodos, MARGEN);
  return { nodos: normal, aristas, ...encerrar(normal) };
}

// ── Editar: lo que hace cada ＋ ─────────────────────────────────────────────────────

export type QueAgregar = 'mensaje' | 'esperar' | 'condicion' | 'accion' | 'ir_a';

/**
 * El menú del ＋. Lista plana con emoji y título, como la de /mensajes (son cinco: el
 * patrón se elige por el TAMAÑO de la lista).
 *
 * · Debajo de «Si responde» no hay «Esperar»: se contesta en el momento (`validarGrafo`
 *   lo rechaza igual; ofrecerlo sería un control que no se puede publicar).
 * · En el MEDIO de una flecha no hay «Ir a»: un salto termina ahí, y lo que colgaba de
 *   esa salida quedaría suelto.
 */
export function opcionesDelMas(pasos: readonly PasoGrafo[], nodoLienzo: string, medio: boolean): Array<{ value: QueAgregar; label: string }> {
  const resp = raizRespuesta(pasos);
  const enRespuesta = nodoLienzo !== ID_ENTRADA && (nodoLienzo === resp || subarbolRespuesta(pasos).has(nodoLienzo));
  return [
    { value: 'mensaje', label: '💬 Mensaje' },
    ...(enRespuesta ? [] : [{ value: 'esperar' as const, label: '⏳ Esperar' }]),
    { value: 'condicion', label: '🔀 Condición' },
    { value: 'accion', label: '⚡ Acción' },
    ...(medio ? [] : [{ value: 'ir_a' as const, label: '↪ Ir a' }]),
  ];
}

/** Los campos que `setSecuenciaPasos` exige a todo paso, incluido uno de control. */
const relleno = () => ({ orden: 0, canal: 'whatsapp' as const, delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' as const });

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
    case 'condicion': {
      const rama = nuevoId([...pasos, { id }], rnd);
      return { ...b, nodo: 'condicion', ramas: [{ id: rama, modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: null }], si_no: null };
    }
    case 'accion': return { ...b, accion: { operacion: '', params: {} } };
    case 'ir_a': return { ...b, nodo: 'ir_a', destino: null };
    default: return b;
  }
}

/** Dónde inserta el ＋ de un nodo del lienzo: el del CRON, al principio de la salida. */
export function lugarDesdeLienzo(nodo: string, puerto?: string): LugarInsercion {
  return nodo === ID_ENTRADA ? { inicio: true } : { nodo, puerto: puerto || 'sig' };
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
  // Un «Ir a» sólo entra en una salida VACÍA: insertado en el medio, lo que seguía
  // quedaría suelto (`insertarNodo` no le cuelga nada a un salto).
  const ocupado = 'inicio' in lugar
    ? raizSalida(base)
    : (puertosDe(base, indicePorId(base, lugar.nodo)).find((pt) => pt.puerto === lugar.puerto)?.destino ?? null);
  if (que === 'ir_a' && ocupado) return { pasos: base, id: null };
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

export function cambiarNodo<P extends PasoGrafo>(pasos: readonly P[], id: string, patch: Partial<P>): P[] {
  return pasos.map((p, i) => (idDe(p, i) === id ? { ...p, ...patch } : p));
}

/** «+ condición»: una rama más, al final (antes del «Si no»). */
export function agregarRama<P extends PasoGrafo>(pasos: readonly P[], condId: string, rnd: () => number = Math.random): P[] {
  const c = nodoPorId(pasos, condId);
  if (!c || claseDe(c) !== 'condicion') return [...pasos];
  const rama: RamaCondicion = { id: nuevoId(pasos, rnd), modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: null };
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
 */
export function agregarCaso<P extends PasoGrafo>(pasos: readonly P[], respId: string, rnd: () => number = Math.random): { pasos: P[]; mensaje: string | null } {
  const base = normalizar(pasos);
  const r = nodoPorId(base, respId);
  if (!r || claseDe(r) !== 'respuesta') return { pasos: base, mensaje: null };
  const msgId = nuevoId(base, rnd);
  const msg = { ...relleno(), id: msgId, tipo: 'ia', siguiente: null } as unknown as P;
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
 */
export function estrategiaConLimpieza<E extends EstrategiaLegada>(est: E): Record<string, unknown> {
  return { objetivo: 'agendar', ...(est ?? {}), ...LIMPIEZA };
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

/** Los disparadores que el desplegable ofrece en su PROPIA sección (etapa, entrega,
 *  etiqueta), y `manual`, que no inscribe a nadie: ofrecerlo sería elegir que la
 *  automatización no corra nunca. */
const TRIGGERS_APARTE = new Set(['etapa_actual', 'entrega_actual', 'etiqueta_puesta', 'manual']);

/** El valor del desplegable para lo que la secuencia tiene puesto. */
export function valorDisparo(s: DisparoActual): string {
  if (s.trigger_tipo === 'etapa_actual') return `venta:${s.funnel_id ?? ''}:${s.etapa ?? ''}`;
  if (s.trigger_tipo === 'entrega_actual') return `entrega:${s.producto_id ?? ''}:${s.etapa ?? ''}`;
  if (s.trigger_tipo === 'etiqueta_puesta') return `etiqueta:${s.etiqueta_id ?? ''}`;
  return `trigger:${s.trigger_tipo}`;
}

/**
 * TODO LO QUE PUEDE DISPARAR UNA AUTOMATIZACIÓN, EN UN DESPLEGABLE CON SECCIONES.
 *
 * Punto 5: «No pongas un botón de "Cambiar a etapa", eso debe ser un desplegable para
 * seleccionar las acciones que pueden disparar esa automatización». Hasta el 08/10 había
 * dos formas según el disparador: con uno de etapa, dos desplegables (etapa y producto);
 * con cualquier otro, el texto y el botón «Cambiar a una etapa», que REESCRIBÍA el
 * disparador a etapa sin que nadie lo pidiera. Ahora es una sola lista: los eventos del
 * catálogo (`TRIGGERS`), las etapas de venta de cada producto, las de su entrega y cada
 * etiqueta. El producto viaja en el VALOR, así que no hay un segundo desplegable.
 *
 * ⚠️ Y LA QUE ESTÁ PUESTA ENTRA SIEMPRE: un valor que no está entre las opciones se dibuja
 * como la primera y el primer clic lo pisa (AGENTS.md, el `<select>` que borra datos).
 */
export function seccionesDisparo(op: {
  disparadores: readonly OpcionDisparo[];
  productos: readonly ProductoParaDisparo[];
  etiquetas: readonly EtiquetaParaDisparo[];
  actual: DisparoActual;
  /** Cómo se dice lo que está puesto (`detalleDisparador`), para cuando no está en la lista. */
  textoActual: string;
}): Array<{ title: string; options: OpcionDisparo[] }> {
  const varios = op.productos.length > 1;
  const secciones: Array<{ title: string; options: OpcionDisparo[] }> = [
    { title: 'Eventos', options: op.disparadores.filter((d) => !TRIGGERS_APARTE.has(d.value)).map((d) => ({ value: `trigger:${d.value}`, label: d.label })) },
  ];
  // Sólo los productos con EMBUDO tienen etapas de venta: un servicio sin embudo tiene
  // `funnelId` null y sólo trae las de su entrega.
  for (const pr of op.productos) {
    if (pr.funnelId == null || !pr.etapas.length) continue;
    secciones.push({ title: varios ? `Etapa · ${pr.nombre}` : 'Etapa', options: pr.etapas.map((e) => ({ value: `venta:${pr.funnelId}:${e.value}`, label: `Llega a «${e.label}»` })) });
  }
  for (const pr of op.productos) {
    if (pr.productoId == null || !pr.etapasEntrega.length) continue;
    secciones.push({ title: varios ? `Entrega · ${pr.nombre}` : 'Entrega', options: pr.etapasEntrega.map((e) => ({ value: `entrega:${pr.productoId}:${e.value}`, label: `Llega a «${e.label}»` })) });
  }
  const vivas = op.etiquetas.filter((t) => !t.archivada_at);
  if (vivas.length) secciones.push({ title: 'Etiquetas', options: vivas.map((t) => ({ value: `etiqueta:${t.id}`, label: `Se le puso «${t.nombre}»` })) });
  const actual = valorDisparo(op.actual);
  if (!secciones.some((s) => s.options.some((o) => o.value === actual))) {
    secciones.unshift({ title: 'La que tiene puesta', options: [{ value: actual, label: op.textoActual }] });
  }
  return secciones.filter((s) => s.options.length > 0);
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
