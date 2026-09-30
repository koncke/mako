// =============================================================================
// flujo-conversacion — una secuencia leída como GRAFO, para dibujarla
// =============================================================================
// Módulo SIN `server-only` y PURO: entra el dato de una secuencia, sale la lista
// de nodos y aristas con su posición ya calculada. Lo importa el lienzo del
// navegador y lo puede importar un test sin montar React.
//
// ── POR QUÉ LAS ARISTAS NO SE DIBUJAN A MANO ────────────────────────────────
// El pedido fue «una pantalla tipo flujo, y ahí se edita todo», con la captura
// del Flow Builder de ManyChat al lado. Lo que de ManyChat NO se copia es el
// drag-to-connect, y no es una simplificación: este repo ya lo construyó una vez
// —el mapa de transiciones del funnel, con clic-y-arrastrar de una etapa a otra,
// 14 etapas y 24 flechas— y el dueño lo descartó por REBUSCADO, con el criterio
// escrito: «así se evita que el usuario tenga que configurar flechas». El editor
// de aquel mapa se borró el 29/09/2026 (516 líneas) y la razón que quedó anotada
// no fue «los diagramas están mal» sino que dos editores del mismo dato divergen.
//
// Acá las flechas no son una decisión: son una CONSECUENCIA. Lo que conecta dos
// cosas en una conversación de MaKo ya está en el dato y lo ejecuta el motor:
//
//   · el ORDEN de los pasos            → la cadena principal
//   · `delay_horas` / `ancla`          → cuánto tarda esa arista
//   · `requiere`                       → la arista se bifurca (paso condicional)
//   · `modo` de la estrategia          → qué pasa si el lead contesta
//   · `desenlace.logradoSecuencia`     → el «Go To» de ManyChat, puerto ✅
//   · `desenlace.falloSecuencia`       → el «Go To» de ManyChat, puerto 🏁
//
// Nadie tiene que conectar nada: si la secuencia encadena con otra, la flecha
// aparece. Y al revés —y esto es lo que el dibujo de hoy no muestra— si NO
// encadena, se ve el puerto suelto, que es justamente la pregunta que nadie
// podía contestar mirando la pantalla vieja.
//
// ── POR QUÉ NO SE GUARDA LA POSICIÓN DE UN NODO ─────────────────────────────
// ManyChat guarda el layout porque un flujo suyo tiene decenas de steps. Medido
// en producción el 29/09/2026: 62 secuencias, 136 pasos, y **la más grande de
// toda la base tiene TRES pasos** (promedio 2,2). Para siete nodos, acomodarlos a
// mano es la ceremonia que el dueño ya rechazó una vez, y guardar posiciones
// significa un campo nuevo en `pasos` — que pasa por `setSecuenciaPasos`, el cual
// reconstruye cada paso CAMPO POR CAMPO y descarta lo que no conoce: el layout se
// perdería en silencio en el primer guardado hecho desde cualquier otra pantalla.
//
// El layout se calcula acá, es determinista, y si algún día una secuencia crece
// lo suficiente como para necesitar acomodarla a mano, ese día se agrega — con el
// campo pasando por las tres puertas de escritura, no por una.

/** Lo mínimo que este módulo necesita de un paso. Escrito estructural a propósito:
 *  el DTO vive en un componente `use client` y un módulo de lib no importa valores
 *  de ahí. Lo que sí importa es que los NOMBRES coincidan con el dato real. */
export type PasoParaGrafo = {
  orden: number;
  canal: 'email' | 'whatsapp';
  delay_horas: number;
  ancla?: 'reunion';
  tipo?: 'texto' | 'audio';
  cuerpo: string;
  asunto?: string | null;
  requiere?: 'respondio' | 'sin_respuesta' | 'ya_contactado' | 'primer_contacto';
  variantes?: string[];
};

export type EstrategiaParaGrafo = {
  objetivo?: string;
  gancho?: string | null;
  preguntas?: string[];
  modo?: 'asistido' | 'automatico';
  antiguedad_max_horas?: number | null;
  envio_automatico?: boolean;
  desenlace?: {
    logrado?: string;
    logradoEtapa?: string | null;
    logradoSecuencia?: string | null;
    falloHoras?: number;
    falloEtapa?: string | null;
    falloSecuencia?: string | null;
  } | null;
} | null;

// ⚠️ LOS TIPOS Y LA GEOMETRÍA SE MUDARON A `lib/lienzo-grafo.ts` el 30/09/2026,
// cuando apareció el SEGUNDO lienzo (el de un aviso de MaKo). Copiarlos habría
// dejado dos dibujos que se separan en la primera edición — que es la razón escrita
// por la que se borró el editor de diagramas del funnel. Acá queda lo PROPIO de una
// conversación: qué nodos tiene, qué los une y cómo se dicen sus tiempos.
//
// Se re-exportan porque el lienzo los importaba de acá, y un `export … from` no crea
// binding local: van los dos, el import y el re-export.
import {
  ANCHO_NODO, ALTO_MIN, GAP_X, GAP_Y, MARGEN, encerrar,
  type NodoFlujo, type AristaFlujo, type GrafoFlujo, type TonoArista,
} from './lienzo-grafo';
export type { TipoNodo, TonoArista, NodoFlujo, AristaFlujo, GrafoFlujo } from './lienzo-grafo';
export { curvaEntre, medioDeCurva, ANCHO_NODO, ALTO_MIN, GAP_X, GAP_Y } from './lienzo-grafo';


/** Alto estimado de un nodo de mensaje, sin medir el DOM.
 *
 *  Se estima y no se mide porque el layout tiene que existir ANTES del primer
 *  pintado: calcularlo del DOM obliga a dibujar, medir y volver a dibujar, y en
 *  el medio se ven los nodos amontonados en la esquina. El número no necesita ser
 *  exacto — la caja del nodo crece sola con su contenido; lo que esto decide es
 *  cuánto aire dejarle al de abajo. */
function altoDeMensaje(p: PasoParaGrafo): number {
  if (p.tipo === 'audio') return 104;
  const cuerpo = p.cuerpo ?? '';
  const renglones = Math.max(1, Math.ceil(cuerpo.length / 34)) + (cuerpo.match(/\n/g)?.length ?? 0);
  const conAsunto = p.canal === 'email' && p.asunto ? 22 : 0;
  return Math.min(300, ALTO_MIN + Math.min(renglones, 9) * 17 + conAsunto);
}

/** Cuándo sale este paso, dicho como lo diría una persona.
 *
 *  Es la misma traducción que hacía la vista de chat que este lienzo reemplazó:
 *  en horas crudas no se puede juzgar una cadencia. Vive acá porque ahora la leen
 *  dos pantallas, y dos copias de la misma frase se separan en la primera edición. */
export function cuandoSale(horas: number, esPrimero: boolean, ancla?: 'reunion'): string {
  if (ancla === 'reunion') {
    if (horas <= 0) return 'Al empezar la reunión';
    return horas === 1 ? '1 hora antes de la reunión' : `${horas} horas antes de la reunión`;
  }
  if (esPrimero) {
    if (horas <= 0) return 'Al instante';
    if (horas === 1) return '1 hora después';
    if (horas < 24) return `${horas} horas después`;
    return `${Math.round(horas / 24)} día${horas >= 48 ? 's' : ''} después`;
  }
  if (horas <= 0) return 'Enseguida';
  if (horas === 1) return '1 hora después';
  if (horas < 24) return `${horas} horas después`;
  if (horas === 24) return 'Al día siguiente';
  return `${Math.round(horas / 24)} días después`;
}

/**
 * La condición de un paso, del lado del LEAD.
 *
 * ⚠️ `sin_respuesta` DICE una cosa y el motor hace otra: `lib/nutricion.ts` tiene
 * rama para `respondio`, `ya_contactado` y `primer_contacto`, y para ésta no —
 * cae de largo y el paso sale igual, le haya contestado el lead o no. Hay 7 pasos
 * así en producción. El lienzo no puede dibujar una bifurcación que el motor no
 * ejecuta: sería el control que se dibuja y no cambia nada, y encima afirmando un
 * comportamiento ante quien decide a quién le escribe. Así que se dibuja lo que
 * PASA, con la marca puesta, y arreglar el motor es otra decisión.
 */
export const CONDICION_TXT: Record<string, string> = {
  respondio: 'solo si contestó',
  ya_contactado: 'solo si ya le habías escrito',
  primer_contacto: 'solo si es la primera vez',
  sin_respuesta: 'sale siempre',
};

/** Las condiciones que el motor SÍ evalúa. En positivo: una condición nueva no
 *  se da por ejecutada hasta que alguien la agregue acá y al motor. */
export const CONDICIONES_VIVAS: ReadonlySet<string> = new Set(['respondio', 'ya_contactado', 'primer_contacto']);

const LOGRADO_TITULO: Record<string, string> = {
  respondio: 'Contesta',
  agendo: 'Agenda',
  pago: 'Paga',
  ninguno: 'No cierra sola',
};

/**
 * El grafo de una secuencia.
 *
 * `clavesQueExisten` son las secuencias del workspace: con eso un «Go To» sabe si
 * apunta a algo que existe. Una clave que no resuelve NO se esconde — se dibuja
 * rota, porque un encadenamiento que apunta a la nada deja al lead en el limbo y
 * hoy no hay ninguna pantalla que lo diga.
 */
export function grafoDeSecuencia(
  pasos: PasoParaGrafo[],
  estrategia: EstrategiaParaGrafo,
  etiquetaEtapa: string,
  secuenciasDelWorkspace: ReadonlyArray<{ clave: string; nombre: string }> = [],
): GrafoFlujo {
  const nodos: NodoFlujo[] = [];
  const aristas: AristaFlujo[] = [];
  const des = estrategia?.desenlace ?? null;
  const porClave = new Map(secuenciasDelWorkspace.map((s) => [s.clave, s.nombre]));

  // ── Columna 0: la entrada ──────────────────────────────────────────────
  const anti = estrategia?.antiguedad_max_horas;
  nodos.push({
    id: 'entrada', tipo: 'entrada', titulo: 'Se dispara', icono: '⚡',
    detalle: anti != null
      ? `El lead cae en «${etiquetaEtapa}» hace menos de ${anti} h`
      : `El lead cae en «${etiquetaEtapa}»`,
    x: MARGEN, y: MARGEN, ancho: ANCHO_NODO, alto: ALTO_MIN + 14,
  });

  // ── Columna 1..N: la cadena de mensajes ────────────────────────────────
  // Va en COLUMNAS y no apilada hacia abajo por la razón por la que el pedido
  // trajo una captura: una conversación se lee en el orden en que ocurre, y en
  // el eje horizontal la rama que se abre hacia abajo no empuja a nadie.
  let previo = 'entrada';
  let x = MARGEN + ANCHO_NODO + GAP_X;
  const yFila = MARGEN;
  let altoCadena = ALTO_MIN + 14;

  const ordenados = [...pasos].sort((a, b) => a.orden - b.orden);
  ordenados.forEach((p, i) => {
    const alto = altoDeMensaje(p);
    const id = `paso-${p.orden}`;
    nodos.push({
      id, tipo: 'mensaje', orden: p.orden,
      titulo: p.canal === 'email' ? 'Email' : p.tipo === 'audio' ? 'Nota de voz' : 'WhatsApp',
      icono: p.canal === 'email' ? '✉️' : p.tipo === 'audio' ? '🎙️' : '💬',
      x, y: yFila, ancho: ANCHO_NODO, alto,
    });
    const cond = p.requiere ? CONDICION_TXT[p.requiere] : null;
    const tiempo = cuandoSale(p.delay_horas, i === 0, p.ancla);
    aristas.push({
      desde: previo, hasta: id,
      etiqueta: cond && p.requiere !== 'sin_respuesta' ? `${tiempo} · ${cond}` : tiempo,
      tono: p.requiere && CONDICIONES_VIVAS.has(p.requiere) ? 'condicional' : 'normal',
      editaOrden: p.orden,
    });
    previo = id;
    x += ANCHO_NODO + GAP_X;
    altoCadena = Math.max(altoCadena, alto);
  });

  // Una secuencia sin pasos NO se dibuja vacía: se dibuja el hueco, que es lo
  // único accionable que hay en esa pantalla.
  if (ordenados.length === 0) {
    nodos.push({
      id: 'sin-mensajes', tipo: 'suelto', titulo: 'Sin mensajes', icono: '＋',
      detalle: 'Todavía no le dice nada al lead',
      x, y: yFila, ancho: ANCHO_NODO, alto: ALTO_MIN,
    });
    aristas.push({ desde: previo, hasta: 'sin-mensajes', tono: 'normal' });
    previo = 'sin-mensajes';
    x += ANCHO_NODO + GAP_X;
  }

  // ── La rama de RESPUESTA: sale de la cadena, no la continúa ────────────
  // Es la única rama de entrada que existe hoy, y en el dibujo viejo no estaba:
  // se leía como un renglón más del final, cuando en realidad es lo que pasa
  // MIENTRAS la secuencia corre.
  const yRespuesta = yFila + altoCadena + GAP_Y + 16;
  const modo = estrategia?.modo ?? 'asistido';
  nodos.push({
    id: 'respuesta', tipo: 'respuesta', titulo: 'Si contesta', icono: '↩️',
    detalle: modo === 'asistido' ? 'MaKo te deja el borrador' : 'Se frena y sigues tú',
    x: x - ANCHO_NODO - GAP_X, y: yRespuesta, ancho: ANCHO_NODO, alto: ALTO_MIN,
  });
  aristas.push({ desde: previo, hasta: 'respuesta', etiqueta: 'si contesta', tono: 'buena' });

  // Lo que MaKo PREGUNTA cuelga de la respuesta, no de la cadena: cualificar es
  // algo que pasa cuando el lead contesta. En el dibujo viejo era un renglón más
  // de la columna, o sea que se leía como un mensaje que sale solo.
  const preguntas = (estrategia?.preguntas ?? []).filter((q) => q && q.trim());
  if (preguntas.length > 0) {
    nodos.push({
      id: 'cualifica', tipo: 'cualifica', titulo: `Pregunta ${preguntas.length}`, icono: '❓',
      detalle: preguntas.slice(0, 3).join(' · '),
      x, y: yRespuesta, ancho: ANCHO_NODO, alto: ALTO_MIN + 8,
    });
    aristas.push({ desde: 'respuesta', hasta: 'cualifica', tono: 'buena' });
  }

  // ── El desenlace, con sus DOS puertos ──────────────────────────────────
  const logradoTxt = LOGRADO_TITULO[String(des?.logrado ?? 'respondio')] ?? 'Contesta';
  nodos.push({
    id: 'desenlace', tipo: 'desenlace', titulo: `Termina si ${logradoTxt.toLowerCase()}`, icono: '🏁',
    detalle: des?.falloHoras && des.falloHoras > 0
      ? `Se da por perdida a las ${des.falloHoras} h sin respuesta`
      : 'No se da por perdida nunca',
    x, y: yFila, ancho: ANCHO_NODO, alto: ALTO_MIN + 14,
  });
  aristas.push({ desde: previo, hasta: 'desenlace', tono: 'normal' });

  // Los dos «Go To». Se dibujan SIEMPRE que haya clave, exista o no la destino.
  const salidas: Array<{ clave: string | null | undefined; tono: TonoArista; etiqueta: string; id: string }> = [
    { clave: des?.logradoSecuencia, tono: 'buena', etiqueta: '✅ lo logró', id: 'ir-logrado' },
    { clave: des?.falloSecuencia, tono: 'mala', etiqueta: '🏁 se perdió', id: 'ir-fallo' },
  ];
  let yGo = yFila;
  for (const s of salidas) {
    if (!s.clave) continue;
    const nombre = porClave.get(s.clave);
    nodos.push({
      id: s.id, tipo: 'ir-a', titulo: 'Sigue con', icono: '↪️',
      claveDestino: s.clave, destinoExiste: nombre != null,
      detalle: nombre ?? `«${s.clave}» ya no existe`,
      x: x + ANCHO_NODO + GAP_X, y: yGo, ancho: ANCHO_NODO, alto: ALTO_MIN,
    });
    aristas.push({ desde: 'desenlace', hasta: s.id, etiqueta: s.etiqueta, tono: s.tono });
    yGo += ALTO_MIN + GAP_Y;
  }

  return { nodos, aristas, ...encerrar(nodos) };
}

/**
 * La curva de una arista, de la derecha de un nodo a la izquierda del otro.
 *
 * Es una Bézier cúbica con los tiradores horizontales — la misma forma que usa
 * ManyChat (`curveBumpX` de d3-shape). Se escribe a mano en vez de importar
 * d3-shape a propósito: d3-shape está en `node_modules` pero NO está declarado en
 * `package.json` — entra como dependencia TRANSITIVA de recharts, así que
 * importarlo funciona hoy y se rompe el día que recharts cambie de versión, con
 * un error que no nombra a este archivo.
 */
