// =============================================================================
// curso-estilo — cómo se VE el curso de un producto, y qué se puede guardar de eso
// =============================================================================
// Pedido de Martín (07/10/2026), mirando la tab Curso con el diseño de Conocimientos: «Permite
// personalizar cosas, como colores (el verde), las portadas, los títulos solo con darle click».
// Lo que se elige lo ve también el alumno en su portal: es el MISMO curso.
//
// Se guarda en `curso_estilo` (mig 0214), una fila por ajuste. Este módulo decide qué claves
// existen, qué vale cada una y cómo se arma el estilo desde las filas. La base sólo pone techos.
//
// ⚠️ SIN `server-only` A PROPÓSITO: lo importan las dos pantallas (el editor y el portal, para el
//    color y las tapas) y el server (el saneo de lo que se guarda), y los tests.
// ⚠️ LO QUE SE LEE TAMBIÉN SE SANEA (`armarEstilo`), no sólo lo que se escribe. Una portada
//    guardada con un origen que hoy ya no se acepta, o un color de antes de la regla del
//    contraste, se dibujaría en el navegador de un alumno: se descarta al leer y vuelve el default.

import { saneaPortada, urlPortada, fondoPortada } from './portadas';
import { leerLamina, valorDeLamina, type ValorLamina } from './laminas';
import type { DisposicionUgc } from '@/app/_cursos/tipos';
// El catálogo de fuentes es del DIBUJO (lo pinta y lo muestra); acá sólo se decide qué id se guarda.
// Es un módulo puro (sin React ni DOM), así que el server lo importa sin arrastrar nada.
import { fuenteGuardable } from '@/app/_cursos/fuentes';

/** El estilo de un curso, ya saneado. `null` (o ausente en los mapas) = el default. */
export type EstiloCurso = {
  /** El color de acento (el «verde» de la casa), en `#RRGGBB` y ya legible con tinta encima. */
  acento: string | null;
  /** El nombre del curso. Default: el del producto. ⚠️ No renombra el producto del CRM. */
  titulo: string | null;
  /** La línea de la portada. Default: el avance del alumno (o la cuenta de etapas en el editor). */
  resumen: string | null;
  /** La tapa de la portada del curso, con el formato de lib/portadas.ts (`grad:<id>` o una foto). */
  portada: string | null;
  /**
   * Etapa (su key) → su tapa. Default: la lámina dibujada. Además de lo de lib/portadas.ts acepta una
   * lámina elegida (`lam:…`, lib/laminas.ts), igual que `portadasClase`; la del curso, no.
   */
  portadasEtapa: Record<string, string>;
  /** Clase (su id) → su tapa. Default: la miniatura del video, si la plataforma la publica. */
  portadasClase: Record<number, string>;
  /**
   * Dónde va el texto de la lección: `null` = al COSTADO del video (lo de siempre); `'abajo'` = el
   * video y, debajo, la descripción y la tarea, todo a lo ancho. Item 16 del 07/10/2026: «si el
   * usuario prefiere… que la descripción y la tarea estén al costado del vídeo, o abajo de forma
   * extendida». Es del CURSO, no de cada clase: lo ve el alumno igual en todas.
   */
  disposicion: 'abajo' | null;
  /**
   * La FUENTE del curso: un id del catálogo cerrado de app/_cursos/fuentes.ts. `null` = la de siempre.
   * Item 3 del 08/10/2026: se elige en el menú de la marca, al lado del color, y cambia el curso
   * entero —la tab, el portal del alumno y la vista previa—, descripción y tarea incluidas.
   */
  fuente: string | null;
  /**
   * Clase (su id) → sus COMENTARIOS prendidos (`'si'`). Item 13 del audio del 08/10/2026, minuto 15:00:
   * «agregar si el usuario quiere un apartado de chat, entonces vos puedes chatear acerca de esa clase».
   * Prendidos, la clase tiene su hilo en el portal, debajo de la lección; sin fila, APAGADOS, que es el
   * default: un negocio que no lo pidió no amanece con un chat abierto en sus clases.
   *
   * ⚠️ ES DE CADA CLASE DESDE EL 14/10/2026. Hasta ese día era un ajuste del CURSO entero, en el menú de
   *    la marca, y Martín: «la opción de comentarios no debería ir allí, debería ir en la edición de cada
   *    clase». Se prende en el «…» de la clase. Medido ese día: ningún curso lo tenía prendido, así que
   *    no hubo nada que pasar de un lado al otro. Lo hace cumplir el SERVER (lib/comunidad-datos.ts,
   *    `claseParaComentar`): apagado, un alumno no lee ni escribe en el hilo aunque llame la ruta a mano.
   */
  comentariosClase: Record<number, 'si'>;
};

/** ¿La clase tiene sus comentarios prendidos? Sin fila, no (ver `comentariosClase`). */
export const comentariosDeClase = (e: EstiloCurso | null | undefined, claseId: number): boolean =>
  !!e && Object.prototype.hasOwnProperty.call(e.comentariosClase, claseId) && e.comentariosClase[claseId] === 'si';

/**
 * Las dos disposiciones de la lección. Las define el DIBUJO (app/_cursos/tipos.ts, `DisposicionUgc`):
 * acá se guarda una de ésas, y no una copia del tipo que se quede vieja.
 */
export type Disposicion = DisposicionUgc;

/** La disposición que se dibuja: lo elegido, o al costado. Una fila rota ya cayó a `null` al leerse. */
export const disposicionDe = (e: EstiloCurso | null | undefined): Disposicion => (e?.disposicion === 'abajo' ? 'abajo' : 'costado');

export const estiloVacio = (): EstiloCurso => ({
  acento: null, titulo: null, resumen: null, portada: null, portadasEtapa: {}, portadasClase: {}, disposicion: null, fuente: null,
  comentariosClase: {},
});

export const TOPE_TITULO_CURSO = 80;
export const TOPE_RESUMEN_CURSO = 280;

/** Qué se ajusta. Es lo que viaja de la pantalla a la acción; la clave de la base sale de acá. */
export type Ajuste =
  | { tipo: 'acento' }
  | { tipo: 'titulo' }
  | { tipo: 'resumen' }
  | { tipo: 'portada' }
  | { tipo: 'portada-etapa'; etapa: string }
  | { tipo: 'portada-clase'; clase: number }
  | { tipo: 'disposicion' }
  | { tipo: 'fuente' }
  | { tipo: 'comentarios-clase'; clase: number };

/**
 * La misma regla que las keys de la entrega (lib/servicio-etapas.ts, `CLAVE_OK`), menos las que
 * son nombres del prototipo de un objeto: `__proto__` en un mapa común le cambia el prototipo en
 * vez de guardar una portada.
 */
const KEY_ETAPA = /^(?!__proto__$)[a-z0-9_]{1,60}$/;

/**
 * La portada de una etapa o de una clase, leída como PROPIA del mapa.
 *
 * ⚠️ NUNCA `mapa[key]` a secas. Los mapas son objetos comunes (tienen que serlo: viajan por RSC,
 *    que no acepta objetos sin prototipo), y una etapa que se llame «Constructor» tiene la key
 *    `constructor`: sin portada elegida, `mapa['constructor']` devuelve la función `Object`, y el
 *    `startsWith` de la portada tira y se cae el portal entero de ese producto. Lo encontró la
 *    revisión del 07/10/2026, medido con `nuevaClaveEtapa('Constructor')`.
 */
const propia = (m: Record<string | number, string>, k: string | number): string | null =>
  (Object.prototype.hasOwnProperty.call(m, k) && typeof m[k] === 'string' ? m[k] : null);
export const portadaDeEtapa = (e: EstiloCurso | null | undefined, key: string): string | null => (e ? propia(e.portadasEtapa, key) : null);
export const portadaDeClase = (e: EstiloCurso | null | undefined, id: number): string | null => (e ? propia(e.portadasClase, id) : null);

/** La clave de la fila. ⚠️ Un solo lugar la arma y uno solo la lee (`ajusteDe`). */
export function claveDe(a: Ajuste): string {
  switch (a.tipo) {
    case 'portada-etapa': return `portada:etapa:${a.etapa}`;
    case 'portada-clase': return `portada:clase:${a.clase}`;
    case 'comentarios-clase': return `comentarios:clase:${a.clase}`;
    default: return a.tipo;
  }
}

/** El ajuste de una clave, o `null` si no es una que exista. Valida las dos mitades. */
export function ajusteDe(clave: unknown): Ajuste | null {
  if (typeof clave !== 'string') return null;
  // ⚠️ `comentarios` (el ajuste del curso entero, hasta el 14/10/2026) YA NO ES UNA CLAVE: una fila vieja
  //    con ese nombre se ignora. Ahora es de cada clase (`comentarios:clase:<id>`, abajo).
  if (clave === 'acento' || clave === 'titulo' || clave === 'resumen' || clave === 'portada' || clave === 'disposicion' || clave === 'fuente') return { tipo: clave };
  const etapa = /^portada:etapa:(.+)$/.exec(clave);
  if (etapa) return KEY_ETAPA.test(etapa[1]) ? { tipo: 'portada-etapa', etapa: etapa[1] } : null;
  const clase = /^portada:clase:(\d{1,12})$/.exec(clave);
  if (clase && Number(clase[1]) > 0) return { tipo: 'portada-clase', clase: Number(clase[1]) };
  const coment = /^comentarios:clase:(\d{1,12})$/.exec(clave);
  if (coment && Number(coment[1]) > 0) return { tipo: 'comentarios-clase', clase: Number(coment[1]) };
  return null;
}

/** Un ajuste que llega de la pantalla (no confiable), validado. */
export function ajusteValido(a: unknown): Ajuste | null {
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  if (o.tipo === 'portada-etapa') return typeof o.etapa === 'string' && KEY_ETAPA.test(o.etapa) ? { tipo: 'portada-etapa', etapa: o.etapa } : null;
  if (o.tipo === 'portada-clase' || o.tipo === 'comentarios-clase') {
    const n = Number(o.clase);
    return Number.isInteger(n) && n > 0 ? { tipo: o.tipo, clase: n } : null;
  }
  return ajusteDe(o.tipo);
}

/** Un texto de una línea: espacios colapsados, recortado al tope. `''` = nada. */
const linea = (v: unknown, tope: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, tope).trim() : '');

/**
 * Lo que de verdad se guarda para un ajuste. `null` = volver al default (se BORRA la fila).
 *
 * Corre en el SERVER, que es el único que decide: lo que manda el navegador es una propuesta.
 */
export function sanearAjuste(a: Ajuste, valor: unknown): string | null {
  switch (a.tipo) {
    case 'acento': {
      const hex = hexValido(valor);
      return hex ? acentoLegible(hex) : null;
    }
    case 'titulo': return linea(valor, TOPE_TITULO_CURSO) || null;
    case 'resumen': return linea(valor, TOPE_RESUMEN_CURSO) || null;
    case 'portada': return saneaPortada(valor);
    // Sólo «abajo» se guarda: al costado es el default, y volver a él BORRA la fila (mig 0214: «nadie
    // lo eligió» y «eligió lo de siempre» no quedan mezclados en un valor). Cualquier otra cosa, también.
    case 'disposicion': return valor === 'abajo' ? 'abajo' : null;
    // Un id del catálogo cerrado (app/_cursos/fuentes.ts), tal cual; la de siempre BORRA la fila. Nunca
    // un nombre de familia ni una pila CSS: el valor termina adentro del `style` del curso de cada alumno.
    case 'fuente': return fuenteGuardable(valor);
    // Sólo «si» se guarda: apagado es el default, y apagarlo BORRA la fila (igual que la disposición).
    // Cualquier otra cosa —un `true`, un «1»— cae a apagado: prender un chat no se deduce de un valor raro.
    case 'comentarios-clase': return valor === 'si' ? 'si' : null;
    default: return portadaConLamina(valor);
  }
}

/**
 * La portada de una ETAPA o de una CLASE: lo de lib/portadas.ts o una lámina dibujada (lib/laminas.ts,
 * item 5 del 07/10/2026). La lámina se guarda en su forma CANÓNICA (`valorDeLamina`), así la que marca
 * el selector y la que está guardada son el mismo string.
 *
 * ⚠️ LA PORTADA DEL CURSO NO ACEPTA LÁMINAS, a propósito y en positivo: una lámina es un número con su
 *    rótulo, y la portada del curso no tiene número; nada la dibujaría y el curso quedaría con el fondo
 *    de la casa sin que nadie entienda por qué.
 */
function portadaConLamina(valor: unknown): string | null {
  const l = leerLamina(valor);
  return l ? valorDeLamina(l) : saneaPortada(valor);
}

/** El estilo desde las filas de `curso_estilo`, saneando cada una (ver la cabecera). */
export function armarEstilo(filas: ReadonlyArray<{ clave: unknown; valor: unknown }>): EstiloCurso {
  const e = estiloVacio();
  for (const f of filas) {
    const a = ajusteDe(f.clave);
    if (!a) continue;
    const v = sanearAjuste(a, f.valor);
    if (v == null) continue;
    if (a.tipo === 'portada-etapa') e.portadasEtapa[a.etapa] = v;
    else if (a.tipo === 'portada-clase') e.portadasClase[a.clase] = v;
    else if (a.tipo === 'disposicion') e.disposicion = v === 'abajo' ? 'abajo' : null;
    else if (a.tipo === 'comentarios-clase') { if (v === 'si') e.comentariosClase[a.clase] = 'si'; }
    else e[a.tipo] = v;
  }
  return e;
}

/** El valor actual de un ajuste en un estilo (lo que la pantalla marca como elegido). */
export function valorDe(e: EstiloCurso, a: Ajuste): string | null {
  if (a.tipo === 'portada-etapa') return portadaDeEtapa(e, a.etapa);
  if (a.tipo === 'portada-clase') return portadaDeClase(e, a.clase);
  if (a.tipo === 'comentarios-clase') return comentariosDeClase(e, a.clase) ? 'si' : null;
  return e[a.tipo];
}

/**
 * El estilo con las portadas de clase SÓLO de las clases que viajan al alumno. Las de una etapa
 * con candado no viajan (`armarModulos`: «lo que no se abre no tiene por qué estar en el HTML»), y
 * la portada de una de esas clases tampoco; ni la de una clase borrada, que deja su fila.
 */
export function soloDeClases(e: EstiloCurso, ids: ReadonlySet<number>): EstiloCurso {
  const portadasClase: Record<number, string> = {};
  // Los comentarios, igual: el alumno no tiene por qué saber qué clases cerradas tienen hilo.
  const comentariosClase: Record<number, 'si'> = {};
  for (const id of ids) {
    const v = portadaDeClase(e, id);
    if (v != null) portadasClase[id] = v;
    if (comentariosDeClase(e, id)) comentariosClase[id] = 'si';
  }
  return { ...e, portadasClase, comentariosClase };
}

/** El estilo con un ajuste cambiado (para la pantalla, que lo aplica antes de que conteste el server). */
export function conAjuste(e: EstiloCurso, a: Ajuste, v: string | null): EstiloCurso {
  if (a.tipo === 'portada-etapa') {
    const m = { ...e.portadasEtapa };
    if (v == null) delete m[a.etapa]; else m[a.etapa] = v;
    return { ...e, portadasEtapa: m };
  }
  if (a.tipo === 'portada-clase') {
    const m = { ...e.portadasClase };
    if (v == null) delete m[a.clase]; else m[a.clase] = v;
    return { ...e, portadasClase: m };
  }
  if (a.tipo === 'disposicion') return { ...e, disposicion: v === 'abajo' ? 'abajo' : null };
  if (a.tipo === 'comentarios-clase') {
    const m = { ...e.comentariosClase };
    if (v === 'si') m[a.clase] = 'si'; else delete m[a.clase];
    return { ...e, comentariosClase: m };
  }
  return { ...e, [a.tipo]: v };
}

/**
 * Una portada guardada, en lo que dibuja el curso: una FOTO (`tapa`), un degradado (`fondo`,
 * como `background` CSS) o una LÁMINA dibujada (`lamina`, para app/_cursos/laminas/: el diseño, sus
 * dos colores y el texto; vacío = el nombre). Sin portada, nada: cada lugar pone su default (la
 * lámina de siempre, la miniatura del video, el fondo de la casa).
 */
export function tapaDe(v: unknown): { tapa?: string; fondo?: string; lamina?: ValorLamina } {
  // `typeof` y no `!v`: lo que llega de un mapa leído a mano puede ser cualquier cosa (ver `propia`).
  if (typeof v !== 'string' || !v) return {};
  const lamina = leerLamina(v);
  if (lamina) return { lamina };
  const url = urlPortada(v);
  if (url) return { tapa: url };
  return v.startsWith('grad:') ? { fondo: fondoPortada(v, ACENTO_DEFAULT) } : {};
}

// ── El color ─────────────────────────────────────────────────────────────────────────────────

/** La tinta del dibujo de Conocimientos (`--u-ink`): el texto que va ENCIMA del acento. */
const TINTA = '#16150F';
/** El lima de la casa: el acento cuando nadie eligió otro. */
export const ACENTO_DEFAULT = '#CDF13B';

/**
 * Los acentos para elegir de un toque. Todos CLAROS a propósito: el acento es FONDO de texto
 * oscuro (el botón «Empezar», la etapa marcada, el número de cada tarjeta).
 */
export const ACENTOS: ReadonlyArray<{ nombre: string; hex: string }> = [
  { nombre: 'Lima', hex: '#CDF13B' },
  { nombre: 'Amarillo', hex: '#FFD43B' },
  { nombre: 'Naranja', hex: '#FFB066' },
  { nombre: 'Coral', hex: '#FF9B8F' },
  { nombre: 'Rosa', hex: '#F7A8D8' },
  { nombre: 'Lila', hex: '#C9B6FF' },
  { nombre: 'Celeste', hex: '#8FD8FF' },
  { nombre: 'Menta', hex: '#7BEBC0' },
];

/** `#rgb` o `#rrggbb` (con o sin `#`) a `#RRGGBB`; `null` si no es un color. */
export function hexValido(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toUpperCase()}` : null;
}

const rgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const aHex = (c: readonly number[]) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** `a` mezclado con `b` en proporción `t` (0 = `a`, 1 = `b`). */
export function mezclar(a: string, b: string, t: number): string {
  const x = rgb(a); const y = rgb(b);
  return aHex(x.map((v, i) => v + (y[i] - v) * t));
}

/** El color con transparencia, como `rgba(…)` CSS. */
export function tinte(hex: string, alfa: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

/**
 * Los tintes del acento que usa app/_cursos/estilos.ts, con su transparencia. Van como VARIABLES
 * calculadas acá y no con `color-mix` en el CSS: un `color-mix` que el navegador no entiende,
 * con una variable adentro, no cae a la regla de antes — deja la propiedad en su valor inicial
 * (sin fondo, sin anillo), y eso le pasa al alumno con un teléfono viejo.
 */
export const TINTES_ACENTO: ReadonlyArray<readonly [string, number]> = [
  ['--u-lime-a12', 0.12], ['--u-lime-a18', 0.18], ['--u-lime-a22', 0.22],
  ['--u-lime-a30', 0.3], ['--u-lime-a45', 0.45], ['--u-lime-a50', 0.5],
];

/** Luminancia relativa (WCAG 2). */
function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** El contraste WCAG entre dos colores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/**
 * El acento, aclarado hasta que la tinta se LEA encima (contraste ≥ 4.5, el AA de WCAG).
 *
 * ⚠️ ES UNA REGLA, NO UN AVISO. El acento pinta el fondo de «Empezar», de la etapa marcada y del
 *    número de cada tarjeta, todos con texto oscuro encima: un azul marino elegido con buena
 *    intención dejaría esos rótulos invisibles en la pantalla de cada alumno. Se aclara de a
 *    poco hacia el blanco, así sigue siendo SU color; en 20 pasos llega al blanco, que siempre
 *    contrasta.
 */
export function acentoLegible(hex: string): string {
  let c = hex;
  for (let i = 1; i <= 20 && contraste(c, TINTA) < 4.5; i++) c = mezclar(hex, '#FFFFFF', i / 20);
  return c;
}

/**
 * Las variables CSS que pinta el acento, para el `style` de `.ugc` (app/_cursos/CursoUgc.tsx).
 * `undefined` = el lima de siempre: no se toca nada.
 *
 * ⚠️ VAN EN `.ugc` Y NO EN `.ahdoc`: la hoja declara `--u-lime` y `--u-lime-soft` SOBRE `.ugc`,
 *    y una variable declarada en el elemento le gana a la que hereda. Puestas en `.ahdoc`, el
 *    `.ugc` de adentro las volvería a pisar con el lima.
 */
export function varsDeAcento(acento: string | null | undefined): Record<string, string> | undefined {
  const a = hexValido(acento);
  if (!a || a === ACENTO_DEFAULT) return undefined;
  return {
    '--lime': a,
    '--u-lime': a,
    '--lime-d': mezclar(a, '#000000', 0.12),
    '--lime-ink': mezclar(a, '#000000', 0.3),
    '--u-lime-soft': mezclar(a, '#FFFFFF', 0.85),
    // La lámina dibujada de cada etapa (app/conocimientos/PortadaModulo.tsx): el brochazo es un
    // poco más claro que el sticker, como en la del origen.
    '--lamina-brocha': mezclar(a, '#FFFFFF', 0.25),
    '--lamina-sticker': a,
    ...Object.fromEntries(TINTES_ACENTO.map(([nombre, alfa]) => [nombre, tinte(a, alfa)])),
  };
}
