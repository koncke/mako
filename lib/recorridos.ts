// =============================================================================
// recorridos — la lógica PURA del recorrido guiado (app/_ui/Recorrido.tsx)
// =============================================================================
// El recorrido es el «tutorial de app» que reemplaza al recuadro de «Configura tu
// curso» (docs/diseno-curso-skool.md, D7): la pantalla se oscurece, un recorte deja a
// la vista UNA acción, una flecha la señala y una tarjeta chica dice qué hace. Con
// «Siguiente», «Atrás» y «Omitir recorrido».
//
// Vive SIN `server-only` y sin React a propósito: lo importan el componente (en el
// navegador), la ruta que guarda quién ya lo vio (en el server) y el test. Todo lo que
// decide algo —qué paso se saltea, dónde va la tarjeta, qué se guarda— está acá, que es
// el único lugar donde un test lo puede ejecutar. Es la regla de la casa: la condición de
// algo que se dibuja va en un módulo que se pueda importar sin montar nada.
// =============================================================================

export type LadoRecorrido = 'arriba' | 'abajo' | 'izquierda' | 'derecha';

export type PasoRecorrido = {
  /** Apunta a `[data-recorrido="<objetivo>"]`. Si hay varios, manda el PRIMERO del DOM. */
  objetivo: string;
  titulo: string;
  /** Corto: una o dos frases. El porqué de una acción no va en la tarjeta. */
  texto: string;
  /** Dónde va la tarjeta respecto del objetivo. Si no entra ahí, se da vuelta sola. */
  lado?: LadoRecorrido;
};

/** Un rectángulo en píxeles de la VENTANA (lo que devuelve `getBoundingClientRect`). */
export type Caja = { x: number; y: number; ancho: number; alto: number };
export type Medida = { ancho: number; alto: number };

/**
 * EL PISO DEL Z-INDEX DEL RECORRIDO.
 *
 * Se lo pidió por encima de la sidebar y de la barra de agencia, y las dos están por
 * encima de lo que la pila de modales le daría sola (`Z_BASE` 130 en
 * app/_components/pila-modales.ts):
 *
 *   sidebar (app/_components/Sidebar.tsx, `aside[data-sidebar]`)        60
 *   la pila de modales, primer nivel                                    130
 *   barra de agencia (app/_components/ImpersonationBanner.tsx)          300
 *   ► el recorrido                                                      400
 *   el toast (app/_ui/Toast.tsx)                                        600
 *   el «¿seguro?» (`Z_CONFIRM` en app/_ui/Confirm.tsx)                ≥ 3000
 *
 * Y queda por DEBAJO del toast y del confirm a propósito: un «Deshacer» o una pregunta
 * que aparezca mientras corre el recorrido tiene que poder contestarse. El test lee los
 * números de la sidebar y de la barra del FUENTE, no de esta tabla: si alguien las sube,
 * cae el test y no el recorrido.
 */
export const Z_PISO_RECORRIDO = 400;

/** Cuánto aire hay entre el recorte y la tarjeta (ahí vive la flecha). */
export const SEPARACION = 14;
/** Lo mínimo que la tarjeta se separa del borde de la ventana. */
export const MARGEN = 12;
/** Cuánto se agranda el recorte alrededor del objetivo, para que no le pise el borde. */
export const RELLENO_HUECO = 6;
/**
 * Lo más cerca de una esquina de la tarjeta que puede ir la flecha. Es el radio de la
 * tarjeta más media flecha: más cerca, la punta sale por la curva del borde y parece
 * despegada.
 */
export const FLECHA_MIN = 18;

// ── Los pasos ─────────────────────────────────────────────────────────────────
//
// ⚠️ UN PASO CUYO OBJETIVO NO ESTÁ EN LA PANTALLA SE SALTEA, NO SE DIBUJA. Una flecha que
// apunta a la nada se lee como un recorrido roto, y en esta app pasa seguido: un curso sin
// módulos no tiene «tarjeta de módulo», una persona sin permiso no tiene «Invitar». El
// recorrido se escribe UNA vez para la pantalla llena y se adapta solo a la que hay.
//
// Por eso todo lo de abajo recibe `presentes` (un booleano por paso, medido en el DOM en el
// momento) y no un predicado: el contador y la navegación tienen que contestar sobre la
// MISMA foto, o el «2 de 5» y el «Siguiente» discrepan cuando algo aparece en el medio.

/** El primer paso presente DESPUÉS de `desde` (con `desde = -1`, el primero de todos). */
export function siguienteVisible(presentes: readonly boolean[], desde: number): number | null {
  for (let i = Math.max(-1, desde) + 1; i < presentes.length; i++) if (presentes[i]) return i;
  return null;
}

/** El último paso presente ANTES de `desde`. */
export function anteriorVisible(presentes: readonly boolean[], desde: number): number | null {
  for (let i = Math.min(presentes.length, desde) - 1; i >= 0; i--) if (presentes[i]) return i;
  return null;
}

export const primerVisible = (presentes: readonly boolean[]): number | null => siguienteVisible(presentes, -1);

/**
 * El «2 de 6». Cuenta SÓLO los pasos que se van a mostrar: con un paso salteado, decir
 * «de 6» promete uno que nunca llega, y el último «Listo» aparecería en el «5 de 6».
 */
export function contadorDe(presentes: readonly boolean[], actual: number): { n: number; total: number } {
  let total = 0;
  let n = 0;
  for (let i = 0; i < presentes.length; i++) {
    if (!presentes[i]) continue;
    total++;
    if (i <= actual) n = total;
  }
  return { n: Math.max(1, n), total };
}

/**
 * El selector del objetivo. Se escapan la comilla y la barra a mano porque `CSS.escape`
 * no existe en node (el test) y el id lo escribe una persona: un `"` suelto haría que
 * `querySelector` TIRE en vez de contestar «no está», y el recorrido entero se caería por
 * un paso.
 */
export function selectorDe(objetivo: string): string {
  return `[data-recorrido="${objetivo.replace(/["\\]/g, '\\$&')}"]`;
}

// ── Dónde va la tarjeta ───────────────────────────────────────────────────────

const OPUESTO: Record<LadoRecorrido, LadoRecorrido> = { arriba: 'abajo', abajo: 'arriba', izquierda: 'derecha', derecha: 'izquierda' };
/** El orden cuando no se pidió lado: abajo primero, que es por donde se lee. */
const ORDEN_DEFAULT: LadoRecorrido[] = ['abajo', 'arriba', 'derecha', 'izquierda'];

const acotar = (v: number, min: number, max: number) => (max < min ? min : Math.min(Math.max(v, min), max));

/** Los lados a probar, en orden: el pedido, su opuesto (lo natural al darse vuelta) y el resto. */
function ordenDeLados(lado?: LadoRecorrido): LadoRecorrido[] {
  if (!lado) return ORDEN_DEFAULT;
  const primeros = [lado, OPUESTO[lado]];
  return [...primeros, ...ORDEN_DEFAULT.filter((l) => !primeros.includes(l))];
}

/** Cuánto lugar queda de ese lado del objetivo, ya descontados la separación y el margen. */
function lugar(lado: LadoRecorrido, o: Caja, v: Medida, sep: number, margen: number): number {
  switch (lado) {
    case 'abajo': return v.alto - margen - (o.y + o.alto + sep);
    case 'arriba': return o.y - sep - margen;
    case 'derecha': return v.ancho - margen - (o.x + o.ancho + sep);
    case 'izquierda': return o.x - sep - margen;
  }
}

const seTocan = (a: Caja, b: Caja) =>
  a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;

export type PosicionTarjeta = {
  x: number;
  y: number;
  /** El lado que se USÓ, que puede no ser el pedido: la flecha sale de éste. */
  lado: LadoRecorrido;
  /**
   * Dónde va la punta de la flecha, medido sobre el borde de la tarjeta que mira al
   * objetivo (en x si la tarjeta está arriba/abajo, en y si está al costado).
   *
   * `null` = sin flecha. Pasa cuando el objetivo no deja lugar de ningún lado y la tarjeta
   * termina ENCIMA de él: una flecha ahí señalaría a la propia tarjeta.
   */
  flecha: number | null;
};

/**
 * Dónde se dibuja la tarjeta. Prueba el lado pedido; si no entra, el opuesto; después
 * los otros dos. Si no entra en ninguno, va del lado con más lugar y se encaja en la
 * ventana aunque tape al objetivo — es mejor que una tarjeta cortada contra un borde, que
 * se lee como rota y deja los botones afuera.
 *
 * `objetivo` es el RECORTE (`recorteDe`), no el elemento crudo: la tarjeta se separa del
 * aro que se ve, y un objetivo más alto que la pantalla ya viene encajado.
 *
 * El eje cruzado (el horizontal si la tarjeta va arriba o abajo) se centra en el objetivo
 * y se acota a la ventana: un botón pegado a un borde no puede empujar la tarjeta afuera.
 * La flecha sigue al objetivo y no al centro de la tarjeta, por eso se calcula aparte.
 */
export function posicionTarjeta(args: {
  objetivo: Caja;
  tarjeta: Medida;
  ventana: Medida;
  lado?: LadoRecorrido;
  separacion?: number;
  margen?: number;
}): PosicionTarjeta {
  const { objetivo: o, tarjeta: t, ventana: v } = args;
  const sep = args.separacion ?? SEPARACION;
  const margen = args.margen ?? MARGEN;
  const orden = ordenDeLados(args.lado);
  const necesita = (l: LadoRecorrido) => (l === 'abajo' || l === 'arriba' ? t.alto : t.ancho);

  const entra = orden.find((l) => lugar(l, o, v, sep, margen) >= necesita(l));
  // Sin lugar en ninguno: el que MÁS tiene (a igualdad, el primero del orden).
  const lado = entra ?? orden.reduce((mejor, l) => (lugar(l, o, v, sep, margen) > lugar(mejor, o, v, sep, margen) ? l : mejor), orden[0]);

  const cx = o.x + o.ancho / 2;
  const cy = o.y + o.alto / 2;
  const vertical = lado === 'abajo' || lado === 'arriba';
  let x = vertical ? cx - t.ancho / 2 : lado === 'derecha' ? o.x + o.ancho + sep : o.x - sep - t.ancho;
  let y = !vertical ? cy - t.alto / 2 : lado === 'abajo' ? o.y + o.alto + sep : o.y - sep - t.alto;
  // ⚠️ SE ENCAJA EN LOS DOS EJES, SIEMPRE, y no sólo cuando no entra en ningún lado. La
  // tarjeta lleva los botones —«Omitir» incluido—: si la persona scrollea y el objetivo se
  // va de la pantalla, una tarjeta que lo sigue se va con él y el recorrido queda sin
  // salida a la vista. Con el objetivo a la vista, encajar no mueve nada (ya entraba).
  x = acotar(x, margen, v.ancho - margen - t.ancho);
  y = acotar(y, margen, v.alto - margen - t.alto);

  // Sin flecha en dos casos: la tarjeta terminó ENCIMA del objetivo (señalaría a sí
  // misma), o el objetivo está fuera de la pantalla (la flecha saldría del lado que se
  // eligió para cuando se veía, y podría apuntar para el lado contrario).
  const fuera = !seTocan(o, { x: 0, y: 0, ancho: v.ancho, alto: v.alto });
  const encima = seTocan({ x, y, ancho: t.ancho, alto: t.alto }, o);
  const largoBorde = vertical ? t.ancho : t.alto;
  const punta = vertical ? cx - x : cy - y;
  const flecha = fuera || encima ? null : acotar(punta, FLECHA_MIN, largoBorde - FLECHA_MIN);
  return { x: Math.round(x), y: Math.round(y), lado, flecha: flecha == null ? null : Math.round(flecha) };
}

/**
 * El recorte: el objetivo más un poco de aire, ENCAJADO en la ventana.
 *
 * Encajado porque un objetivo más grande que la pantalla (una tarjeta alta, una lista)
 * dejaría el borde del recorte —y con él el aro que lo marca— fuera de la vista, y la
 * tarjeta se posicionaría contra un rectángulo que no se ve. Si después de encajarlo no
 * queda nada (el objetivo está fuera de la pantalla, todavía scrolleando), se devuelve sin
 * encajar: el próximo cuadro del scroll lo trae.
 */
export function recorteDe(objetivo: Caja, ventana: Medida, relleno = RELLENO_HUECO): Caja {
  const x = objetivo.x - relleno;
  const y = objetivo.y - relleno;
  const ancho = objetivo.ancho + relleno * 2;
  const alto = objetivo.alto + relleno * 2;
  const x1 = Math.max(x, 2);
  const y1 = Math.max(y, 2);
  const x2 = Math.min(x + ancho, ventana.ancho - 2);
  const y2 = Math.min(y + alto, ventana.alto - 2);
  if (x2 - x1 <= 0 || y2 - y1 <= 0) return { x, y, ancho, alto };
  return { x: x1, y: y1, ancho: x2 - x1, alto: y2 - y1 };
}

/**
 * ¿Hay que traer el objetivo a la vista? Sólo si NO está entero adentro de la ventana.
 *
 * ⚠️ NO SE LLAMA A `scrollIntoView` POR LAS DUDAS. Ese método scrollea TODOS los ancestros
 * scrolleables —incluidos los que tienen `overflow: hidden`, que por código sí se mueven—,
 * y en esta app eso ya corrió un lienzo entero 330 px con el transform intacto (AGENTS.md,
 * «el gesto de un lienzo»). Si el objetivo ya se ve, no se toca nada.
 *
 * `bloque: 'start'` cuando el objetivo es más alto que la ventana: centrarlo dejaría su
 * principio —donde suele estar lo que se señala— arriba y afuera.
 */
export function necesitaScroll(objetivo: Caja, ventana: Medida): { scroll: boolean; bloque: 'center' | 'start' } {
  const entero = objetivo.x >= 0 && objetivo.y >= 0
    && objetivo.x + objetivo.ancho <= ventana.ancho && objetivo.y + objetivo.alto <= ventana.alto;
  const bloque = objetivo.alto > ventana.alto - MARGEN * 2 ? 'start' : 'center';
  return { scroll: !entero, bloque };
}

// ── Quién ya lo vio (por PERSONA) ─────────────────────────────────────────────
//
// Se guarda en el jsonb `perfil` de la fila de `usuarios` (mig 0056), bajo
// `recorridos: { [id]: <cuándo lo vio, ISO> }`. Es de la PERSONA y no del workspace
// (D7): el super admin que entra a mirar un cliente no le «consume» el recorrido a nadie,
// y dos personas del mismo equipo lo ven cada una. Es el mismo criterio que el sonido de
// las notificaciones (`notifInApp`, lib/perfil.ts), que vive en el mismo jsonb.

export const CLAVE_PERFIL = 'recorridos';

/** Hasta cuántos recorridos se recuerdan por persona. Cuando se pasa, se olvida el más viejo. */
export const TOPE_VISTOS = 100;

/** Un id de recorrido: minúsculas, números y guiones (`cs-curso`). Es una CLAVE, no un texto. */
export function idRecorridoValido(id: unknown): id is string {
  return typeof id === 'string' && id.length <= 48 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}

/** El prefijo de todas las claves del respaldo en el navegador (lo mira el evento `storage`). */
export const PREFIJO_LOCAL = 'mako.recorrido.';

/**
 * `quien` es la huella de la persona que manda el server (`/api/recorridos`): 16
 * caracteres hex. Se valida antes de meterlo en una clave porque viene de una respuesta
 * de red, y una clave armada con cualquier cosa es una clave que no se vuelve a encontrar.
 */
export function quienValido(q: unknown): q is string {
  return typeof q === 'string' && /^[0-9a-f]{16}$/.test(q);
}

/**
 * La clave del respaldo en el navegador.
 *
 * ⚠️ VA CON LA PERSONA ADENTRO (`quien`), porque el recorrido se ve una vez por PERSONA
 * (D7) y `localStorage` es del NAVEGADOR. Con la clave sola (`mako.recorrido.<id>`), quien
 * lo veía en una computadora compartida se lo escondía a todos los que entraran después
 * en ese navegador — y como el gancho le manda al server lo que el navegador vio y el
 * server no sabe (`sincronizar`), además se lo marcaba como VISTO en la cuenta de la otra
 * persona, para siempre y en todos sus dispositivos. Lo mismo con Martín probando como
 * otra cuenta en su navegador: el recorrido de «la primera vez» no aparecía nunca.
 *
 * Sin `quien` (el portal del alumno, que no tiene sesión, o un server que no contestó)
 * queda la clave del navegador: es el único respaldo que hay ahí, y está dicho.
 */
export const claveLocal = (id: string, quien?: string | null): string =>
  quien ? `${PREFIJO_LOCAL}${quien}.${id}` : `${PREFIJO_LOCAL}${id}`;

/**
 * Los recorridos vistos que trae un `perfil`, saneados: sólo ids válidos con una fecha en
 * texto. Lo demás se descarta, porque este jsonb también lo escriben otras pantallas y un
 * valor raro no puede convertirse en «visto».
 */
export function vistosDePerfil(perfil: unknown): Record<string, string> {
  const crudo = perfil && typeof perfil === 'object' ? (perfil as Record<string, unknown>)[CLAVE_PERFIL] : null;
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(crudo as Record<string, unknown>)) {
    if (idRecorridoValido(k) && typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

/**
 * El `perfil` con este recorrido marcado como visto.
 *
 * ⚠️ CONSERVA TODO LO DEMÁS. El jsonb se reescribe ENTERO, y adentro viven el teléfono, el
 * cargo, la zona horaria y el sonido de las notificaciones: partir de `{}` los borraría sin
 * que nada avise. Es el mismo cuidado que ya tiene `setPerfil` en lib/perfil.ts.
 *
 * Si ya estaba visto, se queda la fecha de la PRIMERA vez: marcar dos veces no es un
 * cambio, y así la ruta puede no escribir nada.
 */
export function perfilConVisto(perfil: unknown, id: string, cuando: string): Record<string, unknown> {
  const base = perfil && typeof perfil === 'object' && !Array.isArray(perfil) ? { ...(perfil as Record<string, unknown>) } : {};
  const vistos = vistosDePerfil(base);
  if (!vistos[id]) vistos[id] = cuando;
  const ids = Object.keys(vistos);
  if (ids.length > TOPE_VISTOS) {
    // Se olvidan los más viejos, nunca el que se acaba de marcar.
    const sobran = ids.filter((k) => k !== id).sort((a, b) => vistos[a].localeCompare(vistos[b])).slice(0, ids.length - TOPE_VISTOS);
    for (const k of sobran) delete vistos[k];
  }
  base[CLAVE_PERFIL] = vistos;
  return base;
}

/**
 * Lo que decide el gancho con las dos fuentes. «Visto» sólo SUMA: si cualquiera de las dos
 * dice que sí, es sí. Un server que no contestó (`null`) no puede des-ver lo que el
 * navegador recuerda, y un navegador nuevo no puede des-ver lo que el server guardó.
 *
 * `sincronizar` = esta persona lo vio en este navegador y el server no lo sabe (se guardó
 * local mientras el server fallaba): hay que mandárselo, o en otra computadora vuelve a
 * aparecer. Sólo es cierto si `local` es la clave CON la persona (`claveLocal(id, quien)`):
 * con la del navegador, se le mandaría al server lo que vio OTRA persona.
 */
export function vistoDeFuentes(local: boolean, servidor: boolean | null): { visto: boolean; sincronizar: boolean } {
  return { visto: local || servidor === true, sincronizar: local && servidor === false };
}

/**
 * Lo que el gancho (`useRecorrido`) contesta en cada render: `true` / `false`, o `null`
 * mientras NO SE SABE. Y con `null` el recorrido NO se abre: abrirlo antes de saber le
 * mostraría un instante el recorrido a quien ya lo vio, cada vez que entra.
 *
 *   marcado    lo cerró en esta visita (cuenta aunque el navegador no pudo guardarlo).
 *   local      lo que recuerda el navegador DE ESTA PERSONA; `null` = todavía no se leyó
 *              (el HTML del server y la hidratación no saben qué hay en el navegador) o
 *              todavía no se sabe de QUIÉN leerlo: con sesión, la clave lleva la huella
 *              que manda el server (`claveLocal`), así que lo local no se lee antes de
 *              que el server conteste. No cuesta nada: abrirlo también lo espera.
 *   servidor   `undefined` = no contestó todavía; `null` = contestó que no sabe (sin
 *              cuenta propia, o la base caída); `true` / `false` = su palabra.
 *
 * La asimetría es a propósito: para NO abrirlo alcanza con una fuente que diga «visto»;
 * para ABRIRLO hace falta esperar al server. Y si el server no sabe, decide lo local —
 * ése es el respaldo—: quien lo vio en otra computadora con la base caída lo vuelve a ver
 * una vez, que es mejor que no mostrárselo nunca a quien no lo vio.
 */
export function vistoActual(e: {
  marcado: boolean;
  local: boolean | null;
  soloLocal: boolean;
  servidor: boolean | null | undefined;
}): boolean | null {
  if (e.marcado) return true;
  if (e.local === null) return null;
  if (e.soloLocal || e.local) return e.local;
  if (e.servidor === undefined) return null;
  return vistoDeFuentes(e.local, e.servidor).visto;
}
