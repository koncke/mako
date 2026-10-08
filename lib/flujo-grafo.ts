// =============================================================================
// flujo-grafo — una automatización del chatbot como FLUJO CON RAMAS
// =============================================================================
// Pedido de Martín (08/10/2026, punto 9): «Yo debería poder crear CONDICIONALES... A raíz
// de cada condicional, debería poder crear tarjetas arriba y abajo, no solo a la derecha,
// hoy en día no es un flujo, es solamente una secuencia lineal... Ya te había pedido que
// revises como lo hace Manychat, copiemos de allí».
//
// Módulo PURO y sin `server-only`. Lo leen cuatro lugares que antes tenían cada uno su
// idea de «cuál es el paso siguiente»: el motor (lib/nutricion.ts), el lienzo
// (lib/flujo-conversacion.ts + app/chatbot), el simulador de «Probar» y el script que pasa
// las secuencias de antes a tarjetas. Si el dibujo y el motor no leen la MISMA función,
// se separan en la primera edición (AGENTS.md, «Sólo se dibuja la rama que el motor
// EJECUTA»).
//
// ── EL DATO SIGUE SIENDO `pasos` ─────────────────────────────────────────────────────
// No hay una columna `grafo` aparte: cada elemento de `nutricion_secuencias.pasos` es un
// NODO. Con dos fuentes, los diez escritores de `pasos` que ya existen (la API de MaKo,
// el generador, regrabar un audio, /email…) dejarían el grafo desincronizado. Lo que se
// suma son campos opcionales:
//
//   · `id`         identidad ESTABLE. `orden` no sirve: `setSecuenciaPasos` lo renumera en
//                  cada guardado, y `paso_actual` (un índice) le manda a un lead el paso
//                  de OTRO apenas alguien inserta una tarjeta en el medio.
//   · `siguiente`  a qué nodo sigue (null = termina). AUSENTE = el elemento siguiente del
//                  array: así una secuencia lineal de antes ES un grafo sin convertir nada.
//   · `nodo`       la clase cuando no es un mensaje ni una acción: esperar · condicion ·
//                  respuesta · ir_a. Es un campo APARTE de `tipo` a propósito: `tipo` dice
//                  de qué está hecho un MENSAJE (texto, audio, ia, media) y lo tocan
//                  pasoAVoz/pasoATexto y la API; mezclar las dos preguntas en un campo
//                  dejaba que «pasar a voz» convirtiera una condición en un audio.
//
// ── LAS DOS RAÍCES ───────────────────────────────────────────────────────────────────
// Una automatización tiene DOS puntas de entrada, como en el lienzo:
//
//   1. La SALIDA (lo que MaKo manda por su cuenta). Arranca en la tarjeta del CRON, que
//      no es un nodo de `pasos` sino el disparador de la secuencia, y sigue por el primer
//      nodo que nadie apunta (`raizSalida`).
//   2. «SI RESPONDE» (un nodo `respuesta`, uno solo). Es lo que hoy hacía el modo asistido
//      con sus `escenarios` y el hand-off: cada CASO es una rama con su salida, y «otra
//      cosa» es la rama de lo que no encaja. El formulario «Enseñarle este caso» de arriba
//      de la pantalla (punto 1) se va: un caso nuevo es una rama más de esta tarjeta.
//
// Una respuesta del lead PAUSA la salida, como siempre (`pausarPorRespuesta`): por eso en
// la salida no hay condición «respondió» —mientras la salida corre, el lead NO respondió—
// y lo que pasa cuando contesta se dibuja y se configura en «Si responde».
//
// ── ÁRBOL, CON SALTOS ────────────────────────────────────────────────────────────────
// Cada nodo tiene UN padre (las salidas de un nodo son sus PUERTOS, todos al borde
// derecho, una fila por rama — el molde de ManyChat). Para volver a juntar dos ramas está
// el nodo `ir_a` con destino `{ nodo }`: un salto, no un segundo padre. Así el layout es
// un árbol determinista (sin posiciones guardadas) y el motor no puede quedar en un ciclo
// sin una espera en el medio (`validarGrafo`).
//
// ── SEGUNDA TANDA (08/10/2026, noche): UN SOLO CRON Y FLECHAS EN PARALELO ─────────────
// Pedido de Martín, puntos 1 y 2: «No pueden haber 2 flujos por separado. Solo 1 CRON y de
// ahí desprende todo» y «Del CRON inicial debería poder sacar varias flechas... En realidad de
// varias tarjetas debería poder sacar varias flechas, para que se pueda personalizar. Por
// ejemplo, de un mismo cron puedo sacar todo una secuencia para WhatsApp y toda otra
// secuencia de email». El contrato entero está en docs/chatbot-flujo-ramas-diseno.md, sección
// «SEGUNDA TANDA».
//
//   · «Si responde» NO TIENE PADRE: se dibuja colgando del CRON (una fila de su tarjeta), pero
//     es un EVENTO, no un camino en el tiempo. Ninguna tarjeta puede seguir en ella.
//   · `paralelos` en un mensaje, una acción o una espera: los ids que arrancan A LA VEZ cuando
//     esa tarjeta termina. Son PUERTOS más (`par:<id>`), así que el «un padre», las sueltas,
//     `padreDe` y `descendientes` funcionan sin saber que existen. Una condición, «Si responde»
//     y un «Ir a» no los tienen: sus salidas se excluyen entre sí o terminan.
//   · El CRON lleva sus flechas en paralelo en un nodo `inicio` con el id reservado `'entrada'`
//     (el mismo `ID_ENTRADA` del lienzo). Se crea SÓLO con la primera flecha en paralelo desde el
//     CRON y va al FINAL del array: inyectarlo en todos los flujos los volvía «flujos de
//     tarjetas» (`esFlujoExplicito`) y `puedePisarFlujo` dejaba de aceptar a /email, a la API
//     «por orden» y al armado de audios del onboarding sobre una secuencia lineal.
// =============================================================================

// ── Tipos ─────────────────────────────────────────────────────────────────────────

/** De qué está hecha una condición. Cada una la evalúa el motor con un dato que YA tiene. */
export type CampoCondicion =
  | 'etiqueta'        // valor: id de crm_etiquetas
  | 'etapa'           // valor: key de la etapa; funnel_id: de qué producto (null = la casa)
  | 'agendo'          // tiene una reunión cargada (la misma regla que el desenlace de antes)
  | 'pago'            // ya pagó
  | 'ya_contactado'   // alguna vez le salió algo (lo que decidían ya_contactado/primer_contacto)
  | 'respondio'       // alguna vez te escribió (no «respondió a esta»: eso es «Si responde»)
  | 'antiguedad'      // valor: horas — llegó hace menos de N h (el «Solo a leads recientes»)
  | 'tiene_telefono'
  | 'tiene_email';

export const CAMPOS_CONDICION: readonly CampoCondicion[] = [
  'etiqueta', 'etapa', 'agendo', 'pago', 'ya_contactado', 'respondio', 'antiguedad', 'tiene_telefono', 'tiene_email',
];

export type FilaCondicion = {
  campo: CampoCondicion;
  /** La negación: «No tiene», «No agendó», «Llegó hace MÁS de». */
  no?: boolean;
  valor?: string | number | null;
  /** Sólo `etapa`: el producto. null/ausente = la casa del lead. */
  funnel_id?: number | null;
};

/** Una rama de la condición. Gana la PRIMERA que se cumple, de arriba hacia abajo. */
export type RamaCondicion = {
  id: string;
  /** 'todas' = Y entre sus filas; 'cualquiera' = O. Una rama sin filas nunca se cumple. */
  modo: 'todas' | 'cualquiera';
  filas: FilaCondicion[];
  siguiente: string | null;
};

/** Un caso de «Si responde»: lo que el clasificador busca en el mensaje del lead. */
export type CasoRespuesta = {
  id: string;
  /** Cómo se llama el caso: «Quiere cambiar el día». */
  titulo: string;
  /** Cuándo aplica, en palabras del negocio. Es lo que lee el clasificador. */
  cuando: string;
  siguiente: string | null;
};

export type Espera =
  | { modo: 'tiempo'; minutos: number }
  /** Hasta N minutos ANTES de la próxima reunión del lead (lo que era `ancla: 'reunion'`). */
  | { modo: 'antes_reunion'; minutos: number };

/** Un salto: a otra automatización (se lo inscribe) o a otra tarjeta de ésta. */
export type DestinoIrA = { secuencia_id: number } | { nodo: string };

export type ClaseNodo = 'mensaje' | 'accion' | 'esperar' | 'condicion' | 'respuesta' | 'ir_a' | 'inicio';

/**
 * El id del nodo de INICIO: el CRON cuando tiene flechas en paralelo. Es el mismo string que
 * `ID_ENTRADA` del lienzo (lib/flujo-conversacion.ts) a propósito: el ＋ del CRON ya manda ese id
 * como nodo, y así `{ nodo: ID_INICIO, puerto: 'par' }` es literalmente lo que el lienzo pide.
 * `nuevoId` da `n…` y `normalizar` da `o<i>`: ninguno choca con él.
 */
export const ID_INICIO = 'entrada';

/**
 * Las claves de hilo que devuelve `hiloDe` además de los ids: 'p' = el principal, 'r' = lo que
 * cuelga de «Si responde». Una flecha en paralelo a una tarjeta con uno de estos ids abriría un
 * hilo que se confunde con ellos: `validarGrafo` la rechaza.
 */
export const HILO_PRINCIPAL = 'p';
export const HILO_RESPUESTA = 'r';

/** Los campos que este módulo lee de un paso. El resto del paso viaja intacto. */
export type PasoGrafo = {
  id?: string;
  siguiente?: string | null;
  /**
   * Mensaje, acción, espera e inicio: los ids que arrancan A LA VEZ cuando esta tarjeta termina
   * (además de su `siguiente`). Ausente o vacío = una sola salida, como siempre.
   */
  paralelos?: string[];
  nodo?: 'esperar' | 'condicion' | 'respuesta' | 'ir_a' | 'inicio';
  espera?: Espera;
  ramas?: RamaCondicion[];
  casos?: CasoRespuesta[];
  /** condicion: «si no» · respuesta: «otra cosa». */
  si_no?: string | null;
  destino?: DestinoIrA | null;
  /**
   * Sólo mensajes: true = queda como BORRADOR para que lo apruebe una persona; false = sale
   * solo. AUSENTE = lo que diga la secuencia (`estrategia.envio_automatico`), que es como
   * se comportan todas las de antes. Reemplaza el «Sale sola» de la tarjeta del CRON
   * (punto 6: «mucho menos se entiende el checkbox de Sale sola»): es de cada mensaje.
   */
  revisar?: boolean;
  /** Sólo `tipo: 'media'`: el archivo de la biblioteca (`setting_adjuntos`), por referencia. */
  media_id?: number | null;
  // ── Lo de siempre, que el conversor y el motor leen ──
  orden?: number;
  canal?: string;
  proveedor?: string;
  delay_horas?: number;
  ancla?: 'reunion';
  tipo?: string;
  requiere?: string;
  accion?: unknown;
  cuerpo?: string;
  asunto?: string | null;
  template_wa?: string | null;
  audio_id?: number | null;
};

export type Puerto = {
  /** 'sig' para el único de un nodo simple, el id de la rama/caso, o 'si_no'. */
  puerto: string;
  destino: string | null;
};

// ── Identidad y clase ─────────────────────────────────────────────────────────────

/**
 * El id de un nodo. Uno sin `id` (todo lo escrito antes del 08/10/2026, y lo que escriban
 * los escritores que no pasan por `setSecuenciaPasos`) toma `o<índice>`: es lo mismo que
 * hacía `paso_actual`, así que una secuencia vieja se lee igual que siempre.
 */
export const idDe = (p: PasoGrafo, i: number): string => (typeof p.id === 'string' && p.id ? p.id : `o${i}`);

/** Tiene ids explícitos: la escribió alguien que ya sabe de ramas. */
export const esGrafo = (pasos: readonly PasoGrafo[]): boolean =>
  pasos.some((p) => typeof p?.id === 'string' && p.id.length > 0);

export function claseDe(p: PasoGrafo): ClaseNodo {
  if (p.nodo === 'esperar' || p.nodo === 'condicion' || p.nodo === 'respuesta' || p.nodo === 'ir_a' || p.nodo === 'inicio') return p.nodo;
  const a = p.accion;
  if (a != null && typeof a === 'object' && !Array.isArray(a)) return 'accion';
  return 'mensaje';
}

export const esNodoMensaje = (p: PasoGrafo): boolean => claseDe(p) === 'mensaje';

export const TOPE_PARALELOS = 3;   // flechas en paralelo por tarjeta
export const TOPE_HILOS = 6;       // por inscripción: 1 (el principal) + la suma de todos los paralelos

/**
 * ¿Esta tarjeta puede sacar flechas en paralelo? Un mensaje, una acción, una espera y el
 * inicio, sí. Una condición no (sus ramas se EXCLUYEN: gana la primera que se cumple), «Si
 * responde» tampoco (sus casos también se excluyen, y corre en el momento) y un «Ir a» termina
 * ahí.
 */
export function puedeTenerParalelos(p: PasoGrafo): boolean {
  const c = claseDe(p);
  return c === 'mensaje' || c === 'accion' || c === 'esperar' || c === 'inicio';
}

/**
 * Los paralelos de un nodo TAL COMO ESTÁN, sin repetidos ni vacíos, y sólo si su clase los
 * admite. No saca el propio id ni los que no existen: eso lo tiene que VER `validarGrafo` (se
 * dibuja y se rechaza), y lo limpia `normalizar`.
 */
function paralelosDe(p: PasoGrafo | undefined): string[] {
  if (!p || !Array.isArray(p.paralelos) || !puedeTenerParalelos(p)) return [];
  const out: string[] = [];
  for (const d of p.paralelos) if (typeof d === 'string' && d && !out.includes(d)) out.push(d);
  return out;
}

/** El nodo de inicio, si la automatización tiene uno (el primero, si por error hay varios). */
function indiceInicio(pasos: readonly PasoGrafo[]): number {
  return pasos.findIndex((p) => p && claseDe(p) === 'inicio');
}

export function indicePorId(pasos: readonly PasoGrafo[], id: string | null | undefined): number {
  if (!id) return -1;
  return pasos.findIndex((p, i) => idDe(p, i) === id);
}

export function nodoPorId<P extends PasoGrafo>(pasos: readonly P[], id: string | null | undefined): P | null {
  const i = indicePorId(pasos, id);
  return i >= 0 ? pasos[i] : null;
}

// ── Navegación ────────────────────────────────────────────────────────────────────

/**
 * A qué nodo sigue uno de UNA salida (mensaje, acción, esperar). `siguiente` explícito
 * manda; ausente = el elemento siguiente del array (la secuencia lineal de siempre).
 * Los nodos de varias salidas devuelven null: se leen con `puertosDe`.
 */
export function siguienteDe(pasos: readonly PasoGrafo[], i: number): string | null {
  const p = pasos[i];
  if (!p) return null;
  const c = claseDe(p);
  if (c === 'condicion' || c === 'respuesta' || c === 'ir_a') return null;
  if (p.siguiente !== undefined) return p.siguiente ?? null;
  // El inicio va al FINAL del array: «el de abajo» no existe o es cualquier cosa. Su salida
  // principal es la explícita o ninguna.
  if (c === 'inicio') return null;
  const sig = pasos[i + 1];
  return sig ? idDe(sig, i + 1) : null;
}

/** Las salidas de un nodo, en el orden en que se dibujan (de arriba hacia abajo). */
export function puertosDe(pasos: readonly PasoGrafo[], i: number): Puerto[] {
  const p = pasos[i];
  if (!p) return [];
  switch (claseDe(p)) {
    case 'condicion':
      return [...(p.ramas ?? []).map((r) => ({ puerto: r.id, destino: r.siguiente ?? null })), { puerto: 'si_no', destino: p.si_no ?? null }];
    case 'respuesta':
      return [...(p.casos ?? []).map((c) => ({ puerto: c.id, destino: c.siguiente ?? null })), { puerto: 'si_no', destino: p.si_no ?? null }];
    case 'ir_a':
      return [];
    default:
      // Mensaje, acción, espera e inicio: la salida de siempre y una por flecha en paralelo.
      // Como PUERTOS, así `apuntados`, `padreDe`, `descendientes`, el «un padre» y las sueltas
      // las ven sin saber que existen.
      return [
        { puerto: 'sig', destino: siguienteDe(pasos, i) },
        ...paralelosDe(p).map((d) => ({ puerto: `par:${d}`, destino: d })),
      ];
  }
}

/** Los ids que algún puerto apunta (los «hijos»). Un salto `ir_a` NO cuenta: no es un padre. */
function apuntados(pasos: readonly PasoGrafo[]): Set<string> {
  const s = new Set<string>();
  pasos.forEach((_, i) => { for (const pt of puertosDe(pasos, i)) if (pt.destino) s.add(pt.destino); });
  return s;
}

/**
 * Dónde arranca la SALIDA: el primer nodo que ningún PUERTO apunta y que no es «Si responde».
 *
 * ⚠️ SER DESTINO DE UN «IR A» NO LO DESCARTA. Un salto no es un padre, y el caso más natural de
 * un salto hacia atrás es «volver al principio» (ManyChat lo hace: espera y vuelve a la primera
 * tarjeta). Hasta el 08/10/2026 se descartaban los destinos de salto, y [m1 → esperar → ir a m1]
 * se quedaba SIN raíz: la salida no arrancaba nunca y `validarGrafo` no decía nada, porque
 * contaba los destinos de salto como alcanzables. Lo encontró la parte de «Probar».
 */
export function raizSalida(pasos: readonly PasoGrafo[]): string | null {
  // ⚠️ CON INICIO, LA PRIMERA TARJETA REAL, NUNCA 'entrada'. Lo leen `antiguedadDeEntrada` (el
  // «Solo a leads recientes» de #198 es una condición que tiene que ser la PRIMERA tarjeta),
  // `pasoDeEntrada` y `encadenar`: devolviendo el inicio, los tres miraban una tarjeta vacía.
  const ini = indiceInicio(pasos);
  if (ini >= 0) return pasos[ini].siguiente ?? null;
  const ap = apuntados(pasos);
  for (let i = 0; i < pasos.length; i++) {
    const id = idDe(pasos[i], i);
    const c = claseDe(pasos[i]);
    if (c === 'respuesta' || c === 'inicio' || ap.has(id)) continue;
    return id;
  }
  return null;
}

/**
 * Dónde arranca CADA hilo de la salida: [la principal, …las flechas en paralelo del CRON]. Sin
 * inicio es `[raizSalida]` (o nada). El motor arranca un hilo por cada una al inscribir; con una
 * sola, la inscripción sigue siendo de un cursor, como siempre.
 */
export function raicesSalida(pasos: readonly PasoGrafo[]): string[] {
  const out: string[] = [];
  const principal = raizSalida(pasos);
  if (principal) out.push(principal);
  const ini = indiceInicio(pasos);
  if (ini >= 0) for (const d of paralelosDe(pasos[ini])) if (!out.includes(d)) out.push(d);
  return out;
}

/**
 * A qué HILO pertenece cada nodo: nodo → la clave del hilo. `'p'` = el principal (y el inicio);
 * el de una flecha en paralelo se llama como su PRIMERA tarjeta (el id del destino de la flecha,
 * el `h` del motor); `'r'` = lo que cuelga de «Si responde».
 *
 * Lo de «Si responde» ENTRA (como 'r') a propósito: es la única forma de que una regla pueda
 * preguntar «¿esto es de la salida o de la respuesta?» con el mismo mapa. Un «Ir a» desde 'r'
 * puede saltar a cualquier lado (retoma UN hilo); desde la salida, sólo a su propio hilo.
 *
 * Se sigue por PUERTOS: los saltos no cuentan (no son un padre). Un nodo que no está en el mapa
 * es una tarjeta suelta.
 */
export function hiloDe(pasos: readonly PasoGrafo[]): Map<string, string> {
  const hilo = new Map<string, string>();
  const pila: Array<[string, string]> = [];
  const ini = indiceInicio(pasos);
  if (ini >= 0) pila.push([idDe(pasos[ini], ini), HILO_PRINCIPAL]);
  else { const r = raizSalida(pasos); if (r) pila.push([r, HILO_PRINCIPAL]); }
  const resp = raizRespuesta(pasos);
  if (resp) pila.push([resp, HILO_RESPUESTA]);
  while (pila.length) {
    const [id, h] = pila.pop()!;
    if (hilo.has(id)) continue;
    hilo.set(id, h);
    const i = indicePorId(pasos, id);
    if (i < 0) continue;
    for (const pt of puertosDe(pasos, i)) {
      if (!pt.destino || hilo.has(pt.destino)) continue;
      // Una flecha en paralelo abre un hilo nuevo, salvo adentro de «Si responde» (eso no se
      // puede guardar; acá sigue en 'r' para que la regla que lo prohíbe lo encuentre).
      const nuevo = pt.puerto.startsWith('par:') && h !== HILO_RESPUESTA ? pt.destino : h;
      pila.push([pt.destino, nuevo]);
    }
  }
  return hilo;
}

/** El nodo «Si responde», si la automatización tiene uno. */
export function raizRespuesta(pasos: readonly PasoGrafo[]): string | null {
  const i = pasos.findIndex((p) => claseDe(p) === 'respuesta');
  return i >= 0 ? idDe(pasos[i], i) : null;
}

/** El padre de un nodo (por puertos) y por cuál de sus puertos cuelga. */
export function padreDe(pasos: readonly PasoGrafo[], id: string): { id: string; puerto: string } | null {
  for (let i = 0; i < pasos.length; i++) {
    for (const pt of puertosDe(pasos, i)) if (pt.destino === id) return { id: idDe(pasos[i], i), puerto: pt.puerto };
  }
  return null;
}

/** Todos los nodos que cuelgan de uno (sin él), siguiendo puertos. Los saltos no se siguen. */
export function descendientes(pasos: readonly PasoGrafo[], id: string): Set<string> {
  const out = new Set<string>();
  const pila = [id];
  while (pila.length) {
    const cur = pila.pop()!;
    const i = indicePorId(pasos, cur);
    if (i < 0) continue;
    for (const pt of puertosDe(pasos, i)) {
      if (pt.destino && !out.has(pt.destino) && pt.destino !== id) { out.add(pt.destino); pila.push(pt.destino); }
    }
  }
  return out;
}

// ── Generar ids ───────────────────────────────────────────────────────────────────

/**
 * Un id nuevo que no choca con ninguno. ALEATORIO a propósito: uno correlativo («el mayor
 * más uno») reusaría el id de un nodo recién borrado, y una inscripción parada en ese nodo
 * seguiría por la tarjeta nueva. `rnd` se inyecta en los tests.
 */
export function nuevoId(pasos: readonly PasoGrafo[], rnd: () => number = Math.random): string {
  const usados = new Set(pasos.map((p, i) => idDe(p, i)));
  for (const p of pasos) {
    for (const r of p.ramas ?? []) usados.add(r.id);
    for (const c of p.casos ?? []) usados.add(c.id);
  }
  for (let k = 0; k < 50; k++) {
    const id = `n${Math.floor(rnd() * 36 ** 6).toString(36).padStart(6, '0')}`;
    if (!usados.has(id)) return id;
  }
  // 50 choques seguidos sólo pasan con un `rnd` roto: se desempata con el tamaño.
  return `n${usados.size}x${Math.floor(rnd() * 1e9).toString(36)}`;
}

// ── Normalizar: lo que se GUARDA ──────────────────────────────────────────────────

/**
 * Deja todos los ids y todos los `siguiente` EXPLÍCITOS. Lo corre `setSecuenciaPasos` en
 * cada guardado y el lienzo al cargar: después de esto, insertar o borrar un elemento del
 * array no le cambia a nadie el paso siguiente.
 *
 * Los ids que faltan toman `o<índice>` (el mismo que leía el motor con `paso_actual`), así
 * que la PRIMERA normalización de una secuencia vieja no mueve a ninguna inscripción.
 * Idempotente.
 */
export function normalizar<P extends PasoGrafo>(pasos: readonly P[]): P[] {
  // Un inicio sin id sólo puede tener uno: el reservado. Con `o<i>` `validarGrafo` lo rechazaría
  // por un id que nadie eligió.
  const ids = pasos.map((p, i) => (claseDe(p) === 'inicio' && !(typeof p.id === 'string' && p.id) ? ID_INICIO : idDe(p, i)));
  // Un id repetido (dos escritores que copiaron un paso con su id) se desempata: el
  // segundo toma otro. Sin esto, `nodoPorId` devolvería siempre el primero.
  const vistos = new Set<string>();
  ids.forEach((id, i) => {
    if (!vistos.has(id)) { vistos.add(id); return; }
    let k = 2;
    while (vistos.has(`${id}_${k}`)) k++;
    ids[i] = `${id}_${k}`;
    vistos.add(ids[i]);
  });
  return pasos.map((p, i) => {
    const out: P = { ...p, id: ids[i] };
    const c = claseDe(p);
    if (c === 'mensaje' || c === 'accion' || c === 'esperar') {
      out.siguiente = p.siguiente !== undefined ? (p.siguiente ?? null) : (pasos[i + 1] ? ids[i + 1] : null);
    } else if (c === 'inicio') {
      // El inicio, siempre explícito: «el de abajo del array» no es su salida (siguienteDe).
      out.siguiente = p.siguiente ?? null;
    } else {
      delete out.siguiente;
    }
    // Las flechas en paralelo se conservan SÓLO donde se admiten, sin repetidos, sin vacíos, sin
    // apuntarse a sí misma y sin repetir la salida principal (una flecha «en paralelo» al mismo
    // lugar que la de siempre es la misma flecha dos veces: le daría dos padres). Vacío = sin el
    // campo, así un flujo que nunca tuvo paralelos queda IGUAL que antes byte a byte.
    let par = puedeTenerParalelos(p) && Array.isArray(p.paralelos)
      ? p.paralelos.filter((d, k, a): d is string => typeof d === 'string' && d.length > 0 && d !== ids[i] && a.indexOf(d) === k)
      : [];
    // Un inicio sin salida principal y con paralelos PROMUEVE el primero: la principal es la que
    // leen `raizSalida` y el «Solo a leads recientes», y no puede quedar vacía con hilos vivos.
    if (c === 'inicio' && out.siguiente == null && par.length) { out.siguiente = par[0]; par = par.slice(1); }
    par = par.filter((d) => d !== out.siguiente);
    if (par.length) out.paralelos = par;
    else delete out.paralelos;
    if (c === 'condicion') {
      out.ramas = (p.ramas ?? []).map((r, k) => ({ ...r, id: r.id || `${ids[i]}r${k}`, siguiente: r.siguiente ?? null, filas: r.filas ?? [], modo: r.modo === 'cualquiera' ? 'cualquiera' : 'todas' }));
      out.si_no = p.si_no ?? null;
    }
    if (c === 'respuesta') {
      out.casos = (p.casos ?? []).map((x, k) => ({ ...x, id: x.id || `${ids[i]}c${k}`, siguiente: x.siguiente ?? null }));
      out.si_no = p.si_no ?? null;
    }
    return out;
  });
}

// ── Validar: lo que NO se guarda ──────────────────────────────────────────────────

export const TOPE_NODOS = 60;
export const TOPE_RAMAS = 8;
export const TOPE_FILAS = 6;
export const TOPE_CASOS = 30;

/**
 * Los errores de forma, en palabras para el que guarda. Vacío = se puede guardar. Lo corre
 * `setSecuenciaPasos` (rechaza: AGENTS.md, «una combinación imposible es una VALIDACIÓN al
 * guardar, no una degradación») y el lienzo antes de Publicar.
 */
export function validarGrafo(pasos: readonly PasoGrafo[]): string[] {
  const err: string[] = [];
  if (pasos.length > TOPE_NODOS) err.push(`una automatización tiene como mucho ${TOPE_NODOS} tarjetas`);
  const ids = pasos.map((p, i) => idDe(p, i));
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) err.push(`ids repetidos: ${[...new Set(dup)].join(', ')}`);
  const existe = new Set(ids);
  const padres = new Map<string, number>();
  let respuestas = 0;
  pasos.forEach((p, i) => {
    const c = claseDe(p);
    if (c === 'respuesta') respuestas++;
    if (c === 'condicion') {
      const ramas = p.ramas ?? [];
      if (!ramas.length) err.push(`la condición ${ids[i]} no tiene ninguna rama`);
      if (ramas.length > TOPE_RAMAS) err.push(`la condición ${ids[i]} tiene más de ${TOPE_RAMAS} ramas`);
      for (const r of ramas) {
        if (!r.filas?.length) err.push(`una rama de la condición ${ids[i]} no tiene ninguna condición`);
        if ((r.filas?.length ?? 0) > TOPE_FILAS) err.push(`una rama de la condición ${ids[i]} tiene más de ${TOPE_FILAS} condiciones`);
        for (const f of r.filas ?? []) {
          if (!CAMPOS_CONDICION.includes(f.campo)) err.push(`condición desconocida: ${String(f.campo)}`);
          if ((f.campo === 'etiqueta' || f.campo === 'etapa') && (f.valor == null || f.valor === '')) err.push(`falta elegir la ${f.campo} en la condición ${ids[i]}`);
          if (f.campo === 'antiguedad' && !(Number(f.valor) > 0)) err.push(`falta el número de horas en la condición ${ids[i]}`);
        }
      }
    }
    if (c === 'respuesta' && (p.casos?.length ?? 0) > TOPE_CASOS) err.push(`«Si responde» tiene más de ${TOPE_CASOS} casos`);
    if (c === 'respuesta') for (const x of p.casos ?? []) if (!x.titulo?.trim() || !x.cuando?.trim()) err.push('un caso de «Si responde» no tiene nombre o descripción');
    if (c === 'esperar') {
      const m = Number(p.espera?.minutos);
      if (!p.espera || !(m > 0)) err.push(`la espera ${ids[i]} no dice cuánto`);
    }
    if (c === 'ir_a') {
      const d = p.destino;
      if (!d) err.push(`el «Ir a» ${ids[i]} no dice a dónde`);
      else if ('nodo' in d && !existe.has(d.nodo)) err.push(`el «Ir a» ${ids[i]} apunta a una tarjeta que no existe`);
    }
    for (const pt of puertosDe(pasos, i)) {
      if (!pt.destino) continue;
      if (!existe.has(pt.destino)) err.push(`la tarjeta ${ids[i]} sigue en ${pt.destino}, que no existe`);
      padres.set(pt.destino, (padres.get(pt.destino) ?? 0) + 1);
    }
  });
  if (respuestas > 1) err.push('hay más de una tarjeta «Si responde»');
  for (const [id, n] of padres) if (n > 1) err.push(`la tarjeta ${id} cuelga de ${n} lugares (para juntar ramas se usa «Ir a»)`);
  // Un nodo que se apunta a sí mismo por puertos es un ciclo sin padre válido.
  for (let i = 0; i < pasos.length; i++) if (descendientes(pasos, ids[i]).has(ids[i])) err.push(`la tarjeta ${ids[i]} vuelve sobre sí misma`);
  // Lo que cuelga de «Si responde» corre EN EL MOMENTO de la respuesta: una espera ahí
  // dejaría al lead esperando una contestación horas. No se puede.
  const r = raizRespuesta(pasos);
  if (r) for (const d of descendientes(pasos, r)) if (claseDe(pasos[indicePorId(pasos, d)]) === 'esperar') err.push('«Si responde» no puede tener esperas: se contesta en el momento');
  // Un salto hacia ATRÁS sin una espera en el medio es un bucle que el motor daría vueltas
  // en la misma corrida.
  pasos.forEach((p, i) => {
    if (claseDe(p) !== 'ir_a' || !p.destino || !('nodo' in p.destino)) return;
    const destino = p.destino.nodo;
    if (!descendientes(pasos, destino).has(ids[i]) && destino !== ids[i]) return;
    // el salto está DEBAJO de su destino: ¿hay una espera en el camino?
    let cur: string | null = ids[i];
    let conEspera = false;
    for (let guard = 0; cur && cur !== destino && guard < TOPE_NODOS + 2; guard++) {
      const pa = padreDe(pasos, cur);
      if (!pa) break;
      if (claseDe(pasos[indicePorId(pasos, pa.id)]) === 'esperar') conEspera = true;
      cur = pa.id;
    }
    if (claseDe(pasos[indicePorId(pasos, destino)] ?? {}) === 'esperar') conEspera = true;
    if (!conEspera) err.push(`el «Ir a» ${ids[i]} vuelve atrás sin ninguna espera en el medio`);
  });
  err.push(...reglasDeHilos(pasos, ids, r));
  // Lo que no cuelga de ninguna de las raíces es una tarjeta suelta. Un salto NO la salva: una
  // tarjeta a la que sólo se llega saltando es una segunda salida que nadie dibuja ni arranca.
  // Las raíces son las de CADA hilo de la salida (`raicesSalida`) y «Si responde»; el inicio es
  // el CRON y cuenta como alcanzable (no es una tarjeta que alguien pueda dejar suelta).
  const alcanzable = new Set<string>();
  const raices = [...raicesSalida(pasos), ...(r ? [r] : [])];
  const ini = indiceInicio(pasos);
  if (ini >= 0) raices.push(ids[ini]);
  for (const x of raices) { alcanzable.add(x); for (const d of descendientes(pasos, x)) alcanzable.add(d); }
  const sueltas = ids.filter((id) => !alcanzable.has(id));
  if (sueltas.length) err.push(`tarjetas sueltas: ${sueltas.join(', ')}`);
  return [...new Set(err)];
}

/**
 * Las reglas de la SEGUNDA TANDA (el inicio, «Si responde» sin padre y las flechas en paralelo).
 * Aparte de `validarGrafo` para que cada una se lea con su porqué.
 */
function reglasDeHilos(pasos: readonly PasoGrafo[], ids: readonly string[], resp: string | null): string[] {
  const err: string[] = [];
  // ── El inicio: uno solo, con su id, y nadie sigue en él ──
  const inicios = pasos.map((p, i) => (claseDe(p) === 'inicio' ? i : -1)).filter((i) => i >= 0);
  if (inicios.length > 1) err.push('hay más de un inicio');
  for (const i of inicios) if (ids[i] !== ID_INICIO) err.push(`el inicio tiene que llamarse «${ID_INICIO}» (se llama ${ids[i]})`);
  // 'entrada' en una tarjeta que no es el inicio: es el CRON del lienzo, y la tarjeta quedaría
  // dibujada debajo de él.
  pasos.forEach((p, i) => {
    if (claseDe(p) !== 'inicio' && ids[i] === ID_INICIO) err.push(`el id «${ID_INICIO}» es del CRON: la tarjeta que lo usa tiene que cambiarlo`);
  });
  for (const i of inicios) if (padreDe(pasos, ids[i])) err.push('ninguna tarjeta puede seguir en el CRON');
  // ── «Si responde» no tiene padre: cuelga del CRON (pedido literal, punto 1) ──
  // Es un EVENTO (el lead contestó), no un paso del camino: una flecha hacia él lo convertiría en
  // «después de este mensaje, si responde», que es otro modelo (un oyente con alcance) y no éste.
  if (resp && padreDe(pasos, resp)) err.push('«Si responde» cuelga del CRON: ninguna tarjeta puede seguir en él');
  // ── Las flechas en paralelo ──
  let total = 0;
  pasos.forEach((p, i) => {
    const crudos = Array.isArray(p.paralelos) ? p.paralelos.filter((d) => typeof d === 'string' && d) : [];
    if (!crudos.length) return;
    if (!puedeTenerParalelos(p)) { err.push(`la tarjeta ${ids[i]} no puede sacar flechas en paralelo (una condición, «Si responde» y un «Ir a» no las tienen)`); return; }
    const par = paralelosDe(p);
    if (par.length !== crudos.length) err.push(`la tarjeta ${ids[i]} repite una flecha en paralelo`);
    // El hilo de una flecha en paralelo se llama como su primera tarjeta (`hiloDe`, el `h` del
    // motor): una llamada 'p' o 'r' sería «el principal» o «Si responde». Sólo pasa con ids
    // escritos a mano (`nuevoId` da `n…`); como id de cualquier otra tarjeta, 'r' es válido y los
    // tests lo usan.
    if (par.some((d) => d === HILO_PRINCIPAL || d === HILO_RESPUESTA)) err.push(`una flecha en paralelo de ${ids[i]} va a una tarjeta con un id reservado («${HILO_PRINCIPAL}» o «${HILO_RESPUESTA}»)`);
    if (par.length > TOPE_PARALELOS) err.push(`la tarjeta ${ids[i]} saca más de ${TOPE_PARALELOS} flechas en paralelo`);
    total += par.length;
  });
  if (1 + total > TOPE_HILOS) err.push(`una automatización corre como mucho ${TOPE_HILOS} caminos a la vez`);
  // Adentro de «Si responde» todo corre EN EL MOMENTO de la respuesta y retoma UN hilo (diseño,
  // decisión 4): repartir ahí no tiene a qué hilo volver.
  if (resp) for (const d of [resp, ...descendientes(pasos, resp)]) {
    if (paralelosDe(pasos[indicePorId(pasos, d)]).length) err.push('«Si responde» no puede sacar flechas en paralelo');
  }
  // Una tarjeta con paralelos DENTRO DE UN BUCLE de «Ir a» abre hilos nuevos en cada vuelta, sin
  // fin: m1 (en paralelo m2) → esperar 1 día → «Ir a» m1 suma un hilo m2 por día. Un bucle es
  // cualquier ciclo del grafo de EJECUCIÓN (puertos + saltos a una tarjeta), no sólo un salto
  // hacia su propio ancestro: dos saltos cruzados entre ramas también vuelven.
  const ejec = (i: number): string[] => {
    const p = pasos[i];
    const out = puertosDe(pasos, i).map((pt) => pt.destino).filter((d): d is string => !!d);
    if (claseDe(p) === 'ir_a' && p.destino && 'nodo' in p.destino) out.push(p.destino.nodo);
    return out;
  };
  pasos.forEach((p, i) => {
    if (!paralelosDe(p).length) return;
    const vistos = new Set<string>();
    const pila = ejec(i);
    while (pila.length) {
      const cur = pila.pop()!;
      if (cur === ids[i]) { err.push(`la tarjeta ${ids[i]} saca flechas en paralelo dentro de un bucle de «Ir a» (abriría caminos nuevos en cada vuelta)`); return; }
      if (vistos.has(cur)) continue;
      vistos.add(cur);
      const k = indicePorId(pasos, cur);
      if (k >= 0) pila.push(...ejec(k));
    }
  });
  // Un «Ir a {tarjeta}» de la SALIDA sólo salta dentro de su propio hilo: a la tarjeta de otro,
  // dos cursores caen en la misma tarjeta y al lead le llega el mismo mensaje dos veces. Desde «Si
  // responde» sí se puede ir a cualquier lado: la respuesta pausa todo y retoma UN solo hilo.
  // Y nunca al CRON: volver a entrar no es un salto, es inscribir de nuevo.
  const hilo = hiloDe(pasos);
  pasos.forEach((p, i) => {
    if (claseDe(p) !== 'ir_a' || !p.destino || !('nodo' in p.destino)) return;
    const destino = p.destino.nodo;
    const di = indicePorId(pasos, destino);
    if (di >= 0 && claseDe(pasos[di]) === 'inicio') { err.push(`el «Ir a» ${ids[i]} no puede volver al CRON`); return; }
    const desde = hilo.get(ids[i]);
    if (!desde || desde === HILO_RESPUESTA) return;
    const hasta = hilo.get(destino);
    if (hasta !== undefined && hasta !== desde) err.push(`el «Ir a» ${ids[i]} salta a una tarjeta de otro camino (le llegaría lo mismo dos veces)`);
  });
  return err;
}

// ── Evaluar (motor y simulador) ───────────────────────────────────────────────────

/** Lo que el motor sabe del lead en el momento de decidir. Lo junta el motor en batch. */
export type HechosLead = {
  etiquetas: ReadonlySet<number>;
  /** Etapa de la casa (key). */
  etapa: string | null;
  /** Etapa por producto (funnel_id → key), para `etapa` con funnel_id. */
  etapasPorProducto?: ReadonlyMap<number, string>;
  agendo: boolean;
  pago: boolean;
  yaContactado: boolean;
  respondio: boolean;
  creadoMs: number | null;
  tieneTelefono: boolean;
  tieneEmail: boolean;
  ahoraMs: number;
};

export function cumpleFila(f: FilaCondicion, h: HechosLead): boolean {
  let si: boolean;
  switch (f.campo) {
    case 'etiqueta': si = h.etiquetas.has(Number(f.valor)); break;
    case 'etapa': {
      const etapa = f.funnel_id != null ? (h.etapasPorProducto?.get(Number(f.funnel_id)) ?? null) : h.etapa;
      si = etapa != null && etapa === String(f.valor ?? '');
      break;
    }
    case 'agendo': si = h.agendo; break;
    case 'pago': si = h.pago; break;
    case 'ya_contactado': si = h.yaContactado; break;
    case 'respondio': si = h.respondio; break;
    // La misma regla que `dentroDeAntiguedad` (lib/setting-estrategia.ts): sin fecha de
    // alta no se sabe cuándo llegó, y «no sé» no es «reciente».
    case 'antiguedad': si = h.creadoMs != null && (h.ahoraMs - h.creadoMs) / 3_600_000 <= Number(f.valor); break;
    case 'tiene_telefono': si = h.tieneTelefono; break;
    case 'tiene_email': si = h.tieneEmail; break;
    default: return false;   // un campo que no se conoce NUNCA se cumple, ni negado
  }
  return f.no ? !si : si;
}

export function cumpleRama(r: RamaCondicion, h: HechosLead): boolean {
  const filas = r.filas ?? [];
  if (!filas.length) return false;
  return r.modo === 'cualquiera' ? filas.some((f) => cumpleFila(f, h)) : filas.every((f) => cumpleFila(f, h));
}

/** Por dónde sale una condición: la primera rama que se cumple, o «si no». */
export function elegirSalida(p: PasoGrafo, h: HechosLead): Puerto {
  for (const r of p.ramas ?? []) if (cumpleRama(r, h)) return { puerto: r.id, destino: r.siguiente ?? null };
  return { puerto: 'si_no', destino: p.si_no ?? null };
}

/**
 * El tope de antigüedad que se puede mirar AL INSCRIBIR. La condición «Llegó hace menos de
 * N h» puesta como PRIMERA tarjeta, con «si no» terminando, equivale al viejo «Solo a leads
 * recientes» — y ése se miraba también al inscribir, porque si no, prender la secuencia
 * crea una fila por cada lead de la cohorte de 30 días (medido el 17/09: 126, 66 de más de
 * 14 días), todas trabadas por el UNIQUE y contando como «inscriptos».
 *
 * Sólo si TODAS las ramas exigen la antigüedad (si una no, entra igual por esa).
 */
export function antiguedadDeEntrada(pasos: readonly PasoGrafo[]): number | null {
  // Con flechas en paralelo desde el CRON, la condición de la principal frena a SU hilo y no a
  // los otros: el lead entra igual por el hilo de al lado. Mirarla al inscribir dejaría afuera a
  // quien el otro hilo sí atiende.
  if (raicesSalida(pasos).length > 1) return null;
  const raiz = raizSalida(pasos);
  const p = nodoPorId(pasos, raiz);
  if (!p || claseDe(p) !== 'condicion' || (p.si_no ?? null) !== null) return null;
  const ramas = p.ramas ?? [];
  if (!ramas.length) return null;
  let max = 0;
  for (const r of ramas) {
    const exige = (r.filas ?? []).filter((f) => f.campo === 'antiguedad' && !f.no && Number(f.valor) > 0);
    if (!exige.length) return null;
    if (r.modo === 'cualquiera' && (r.filas ?? []).length > 1) return null;
    max = Math.max(max, ...exige.map((f) => Number(f.valor)));
  }
  return max || null;
}

/**
 * Los casos de «Si responde» en la forma del clasificador de siempre
 * (`clasificarEscenario`, lib/chat-agent-handoff.ts) — así el motor nuevo usa EL MISMO
 * clasificador, probado, y no uno paralelo. `comoResponder` y `contestaSolo` salen del
 * PRIMER nodo de la rama si es un mensaje «MaKo contesta» (`tipo: 'ia'`): su `cuerpo` es la
 * guía y `revisar === false` es «sale solo».
 */
export type EscenarioDeGrafo = {
  casoId: string;
  titulo: string;
  cuando: string;
  comoResponder: string;
  contestaSolo?: boolean;
  siguiente: string | null;
};

export function escenariosDeRespuesta(pasos: readonly PasoGrafo[]): EscenarioDeGrafo[] {
  const r = nodoPorId(pasos, raizRespuesta(pasos));
  if (!r) return [];
  return (r.casos ?? []).map((c) => {
    const primero = nodoPorId(pasos, c.siguiente);
    const contesta = primero && claseDe(primero) === 'mensaje' && primero.tipo === 'ia' ? primero : null;
    return {
      casoId: c.id, titulo: c.titulo, cuando: c.cuando,
      comoResponder: contesta?.cuerpo ?? '',
      ...(contesta && contesta.revisar === false ? { contestaSolo: true } : {}),
      siguiente: c.siguiente ?? null,
    };
  });
}

// ── Editar (lienzo) ───────────────────────────────────────────────────────────────

/**
 * Apunta un puerto de un nodo a otro destino. Devuelve un array nuevo.
 *
 * Las flechas en paralelo: `'par:<id>'` REEMPLAZA ese elemento (con `null` lo saca), y `'par'`
 * AGREGA una al final (si la tarjeta las admite y no estaba). Una lista que queda vacía se va
 * con el campo.
 */
export function conectarPuerto<P extends PasoGrafo>(pasos: readonly P[], id: string, puerto: string, destino: string | null): P[] {
  const conPar = (p: P, par: string[]): P => {
    const q = { ...p };
    if (par.length) q.paralelos = par;
    else delete q.paralelos;
    return q;
  };
  return pasos.map((p, i) => {
    if (idDe(p, i) !== id) return p;
    if (puerto === 'par') {
      if (!destino || !puedeTenerParalelos(p)) return p;
      const actual = Array.isArray(p.paralelos) ? p.paralelos : [];
      return actual.includes(destino) ? p : conPar(p, [...actual, destino]);
    }
    if (puerto.startsWith('par:')) {
      const viejo = puerto.slice(4);
      const actual = Array.isArray(p.paralelos) ? p.paralelos : [];
      if (!actual.includes(viejo)) return p;
      return conPar(p, destino ? actual.map((d) => (d === viejo ? destino : d)) : actual.filter((d) => d !== viejo));
    }
    if (puerto === 'sig') return { ...p, siguiente: destino };
    if (puerto === 'si_no') return { ...p, si_no: destino };
    if (p.ramas?.some((r) => r.id === puerto)) return { ...p, ramas: p.ramas.map((r) => (r.id === puerto ? { ...r, siguiente: destino } : r)) };
    if (p.casos?.some((c) => c.id === puerto)) return { ...p, casos: p.casos.map((c) => (c.id === puerto ? { ...c, siguiente: destino } : c)) };
    return p;
  });
}

/**
 * Dónde se inserta:
 *   · `{ nodo, puerto }` después de un puerto de un nodo: `'sig'`, `'si_no'`, el id de una rama o
 *     de un caso, o `'par:<id>'` (el ＋ del MEDIO de una flecha en paralelo: la tarjeta nueva queda
 *     en el medio y apunta a la de antes);
 *   · `{ nodo, puerto: 'par' }` una flecha en paralelo NUEVA desde ese nodo (desde el CRON:
 *     `nodo: ID_INICIO`, exista o no el inicio todavía);
 *   · `{ inicio: true }` al principio de la salida principal.
 */
export type LugarInsercion = { nodo: string; puerto: 'sig' | 'si_no' | 'par' | `par:${string}` | (string & {}) } | { inicio: true };

/**
 * Inserta un nodo YA ARMADO (con id) en un lugar. Lo que colgaba de ese lugar pasa a
 * colgar del nodo nuevo: de su `siguiente` si es simple, o de su PRIMERA rama si es una
 * condición («si se cumple, sigue como antes»). «Si responde» no se inserta: es una raíz.
 *
 * Una flecha en paralelo NUEVA (`puerto: 'par'`) no tiene nada colgando: la tarjeta nace con su
 * `siguiente` en null. Desde el CRON sin inicio, el inicio se CREA (al final del array, con la
 * salida de hoy como principal) — salvo que no haya salida principal: ahí la tarjeta nueva PASA a
 * ser la principal y no hace falta ningún inicio (una sola raíz es un flujo de siempre).
 */
export function insertarNodo<P extends PasoGrafo>(pasos: readonly P[], lugarIn: LugarInsercion, nuevo: P): P[] {
  const base = normalizar(pasos);
  const n = normalizar([nuevo])[0];
  let lugar: LugarInsercion = lugarIn;
  const ini = indiceInicio(base);
  // Con inicio, «al principio» es su salida principal: anteponer la tarjeta en el array la
  // dejaba sin padre y al inicio apuntando a la de antes (dos raíces que nadie dibuja).
  if ('inicio' in lugar && ini >= 0) lugar = { nodo: base[ini].id!, puerto: 'sig' };
  if (!('inicio' in lugar) && lugar.puerto === 'par') {
    const desdeCron = lugar.nodo === ID_INICIO && ini < 0;
    const principal = raizSalida(base);
    if (desdeCron && !principal) {
      lugar = { inicio: true };
    } else if (desdeCron) {
      const inicio = { id: ID_INICIO, nodo: 'inicio', siguiente: principal, paralelos: [n.id!] } as unknown as P;
      return [...base, sinSalida(n), inicio];
    } else {
      const i = indicePorId(base, lugar.nodo);
      if (i < 0 || !puedeTenerParalelos(base[i])) return base;
      // Un inicio sin principal (lo dejó así un borrado): la flecha nueva ES la principal.
      if (claseDe(base[i]) === 'inicio' && base[i].siguiente == null) lugar = { nodo: lugar.nodo, puerto: 'sig' };
      else {
        const out = conectarPuerto(base, lugar.nodo, 'par', n.id!);
        out.splice(i + 1, 0, sinSalida(n));
        return out;
      }
    }
  }
  let antes: string | null;
  let out: P[];
  if ('inicio' in lugar) {
    antes = raizSalida(base);
    out = [n, ...base];
  } else {
    const i = indicePorId(base, lugar.nodo);
    if (i < 0) return base;
    antes = puertosDe(base, i).find((pt) => pt.puerto === lugar.puerto)?.destino ?? null;
    out = conectarPuerto(base, lugar.nodo, lugar.puerto, n.id!);
    // El nodo nuevo va justo después de su padre en el array: el orden del array es el
    // orden de lectura (`orden`, las métricas por paso), no el del dibujo.
    out.splice(i + 1, 0, n);
  }
  const c = claseDe(n);
  return out.map((p) => {
    if (p.id !== n.id) return p;
    if (c === 'condicion' && p.ramas?.length) return { ...p, ramas: p.ramas.map((r, k) => (k === 0 ? { ...r, siguiente: antes } : r)) };
    if (c === 'respuesta' || c === 'ir_a' || c === 'condicion') return p;
    return { ...p, siguiente: antes };
  });
}

/** Una tarjeta que nace en una flecha en paralelo NUEVA: no hay nada que siga después de ella. */
function sinSalida<P extends PasoGrafo>(n: P): P {
  const c = claseDe(n);
  if (c === 'condicion' && n.ramas?.length) return { ...n, ramas: n.ramas.map((r, k) => (k === 0 ? { ...r, siguiente: null } : r)) };
  if (c === 'respuesta' || c === 'ir_a' || c === 'condicion') return n;
  return { ...n, siguiente: null };
}

/**
 * Borra un nodo. Uno SIMPLE (mensaje, acción, espera) se saca de la cadena: lo que seguía
 * pasa a colgar de su padre. Uno de VARIAS salidas (condición, «Si responde») se lleva todo
 * lo que cuelga de él —no hay una rama que tenga más derecho que otra a quedarse— y el
 * deshacer del lienzo lo devuelve. Los saltos que apuntaban a algo borrado se van también.
 */
export function borrarNodo<P extends PasoGrafo>(pasos: readonly P[], id: string): P[] {
  const base = normalizar(pasos);
  const i = indicePorId(base, id);
  if (i < 0) return base;
  const p = base[i];
  const c = claseDe(p);
  // El inicio es el CRON: no es una tarjeta que se borre. Sus flechas se sacan de a una.
  if (c === 'inicio') return base;
  const padre = padreDe(base, id);
  const quitar = new Set<string>([id]);
  let reemplazo: string | null = null;
  // Las flechas en paralelo que SALÍAN de la borrada: pasan a la que la reemplaza si puede
  // tenerlas; si no, se van con su subárbol (el deshacer del lienzo las devuelve).
  let heredan: string[] = [];
  if (c === 'condicion' || c === 'respuesta') for (const d of descendientes(base, id)) quitar.add(d);
  else {
    reemplazo = siguienteDe(base, i);
    const par = paralelosDe(p);
    // Sin salida principal, la PRIMERA flecha en paralelo pasa a ser la que la reemplaza.
    if (!reemplazo && par.length) { reemplazo = par[0]; heredan = par.slice(1); }
    else heredan = par;
    const r = reemplazo ? base[indicePorId(base, reemplazo)] : undefined;
    if (heredan.length && !(r && puedeTenerParalelos(r))) {
      for (const d of heredan) { quitar.add(d); for (const x of descendientes(base, d)) quitar.add(x); }
      heredan = [];
    }
  }
  // Un salto a algo que se borra no tiene a dónde ir: se borra con él (y lo que colgara de
  // él, que no puede ser nada: un `ir_a` no tiene salidas).
  for (const q of base) if (claseDe(q) === 'ir_a' && q.destino && 'nodo' in q.destino && quitar.has(q.destino.nodo)) quitar.add(q.id!);
  let out = base.filter((q) => !quitar.has(q.id!));
  // Si colgaba de una flecha en paralelo (`par:<id>`), el padre se reconecta POR ESA flecha:
  // `conectarPuerto` reemplaza el elemento (o lo saca, si no queda nada).
  if (padre && !quitar.has(padre.id)) out = conectarPuerto(out, padre.id, padre.puerto, reemplazo);
  if (reemplazo && heredan.length) for (const d of heredan) out = conectarPuerto(out, reemplazo, 'par', d);
  // Un salto borrado deja a su padre apuntando a la nada: se corta ahí.
  for (const q of base) {
    if (q.id === id || !quitar.has(q.id!)) continue;
    const pa = padreDe(base, q.id!);
    if (pa && !quitar.has(pa.id)) out = conectarPuerto(out, pa.id, pa.puerto, null);
  }
  // Un inicio que se quedó sin principal y con paralelos promueve el primero (lo mismo que hace
  // `normalizar` al guardar; acá para que el lienzo lo dibuje igual que lo que se va a guardar).
  const ini = indiceInicio(out);
  if (ini >= 0 && out[ini].siguiente == null) {
    const par = paralelosDe(out[ini]);
    if (par.length) {
      out = conectarPuerto(out, out[ini].id!, `par:${par[0]}`, null);
      out = conectarPuerto(out, out[ini].id!, 'sig', par[0]);
    }
  }
  return out;
}

// ── Textos que dibuja la tarjeta (cortos: AGENTS.md, el texto que se DIBUJA) ────────

export type NombresParaTexto = {
  etiqueta?: (id: number) => string | null;
  etapa?: (key: string, funnelId: number | null) => string | null;
};

export function textoFila(f: FilaCondicion, n: NombresParaTexto = {}): string {
  const no = !!f.no;
  switch (f.campo) {
    case 'etiqueta': {
      const nom = n.etiqueta?.(Number(f.valor)) ?? 'una etiqueta';
      return no ? `No tiene «${nom}»` : `Tiene «${nom}»`;
    }
    case 'etapa': {
      const nom = n.etapa?.(String(f.valor ?? ''), f.funnel_id ?? null) ?? String(f.valor ?? 'una etapa');
      return no ? `No está en «${nom}»` : `Está en «${nom}»`;
    }
    case 'agendo': return no ? 'No agendó' : 'Agendó';
    case 'pago': return no ? 'No pagó' : 'Pagó';
    case 'ya_contactado': return no ? 'Nunca le escribiste' : 'Ya le escribiste';
    case 'respondio': return no ? 'Nunca te escribió' : 'Te escribió alguna vez';
    case 'antiguedad': return `Llegó hace ${no ? 'más' : 'menos'} de ${horasTexto(Number(f.valor))}`;
    case 'tiene_telefono': return no ? 'Sin WhatsApp' : 'Tiene WhatsApp';
    case 'tiene_email': return no ? 'Sin email' : 'Tiene email';
    default: return 'Condición';
  }
}

export function textoRama(r: RamaCondicion, n: NombresParaTexto = {}): string {
  const filas = r.filas ?? [];
  if (!filas.length) return 'Elige una condición';
  return filas.map((f) => textoFila(f, n)).join(r.modo === 'cualquiera' ? ' o ' : ' y ');
}

function horasTexto(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return '…';
  if (h % 24 === 0 && h >= 48) return `${h / 24} días`;
  return `${h} h`;
}

export function textoEspera(e: Espera | undefined): string {
  if (!e) return 'Esperar';
  const m = Math.max(0, Math.round(Number(e.minutos) || 0));
  const dur = m % 1440 === 0 && m >= 1440 ? `${m / 1440} ${m === 1440 ? 'día' : 'días'}`
    : m % 60 === 0 ? `${m / 60} h`
    : `${m} min`;
  return e.modo === 'antes_reunion' ? `${dur} antes de la reunión` : `Esperar ${dur}`;
}
