// =============================================================================
// portadas — qué se ve arriba: de un cliente y de un proyecto
// =============================================================================
// Una portada es UN string y significa una de tres cosas (mig 0173):
//
//   ''  / null / undefined  → el degradado DERIVADO del nombre. Es el default y es
//                             lo que se ve hoy: `colorDe(nombre)` hashea el nombre a
//                             un hue estable, así que el mismo cliente tiene siempre
//                             el mismo color en cualquier pantalla y en cualquier orden.
//   'grad:<id>'             → uno del catálogo de acá abajo.
//   'https://…'             → una foto, de un origen PERMITIDO (ver `ORIGENES_OK`).
//
// ⚠️ UNA SOLA COLUMNA PARA LAS TRES, y es la decisión. Dos campos —un color y una
// URL— serían dos respuestas a «¿qué se ve arriba?», y el día que estén los dos
// puestos gana el que el código mire primero. Nadie sabe cuál es, y el que eligió
// la foto ve un degradado sin entender por qué.
//
// ⚠️ SIN `server-only` A PROPÓSITO: lo importan el navegador (la tarjeta, la ficha,
// el selector) y el server (el saneo de lo que se guarda). Sólo sabe de forma y de
// texto; no toca la base.

// El catálogo de íconos es un módulo hermano y también SIN `server-only`: los dos
// los importan el navegador y el server. Se importa el VALOR (`esIcono`), no una
// copia de la regla — quién es un ícono se decide en un solo lugar.
import { esIcono } from './iconos-catalogo';

/** Un degradado del catálogo. El `id` es lo que se guarda: `grad:<id>`. */
export type Gradiente = { id: string; nombre: string; a: string; b: string };

/**
 * Una foto del repositorio, ya en la forma que dibuja el selector.
 *
 * ⚠️ EL TIPO VIVE ACÁ Y NO EN LA RUTA que lo produce (`app/api/portadas/route.ts`),
 * aunque sea ahí donde se arma. Un `'use client'` que importe de un `route.ts` —aunque
 * sea `import type`— ata una pantalla al grafo de un handler de servidor, y el día que
 * ese handler importe un valor con `server-only` se arrastra al navegador. Es la misma
 * frontera que AGENTS.md documenta: los tipos viajan gratis, los módulos no.
 */
export type FotoDeCatalogo = { id: string; autor: string; mini: string; grande: string };

/**
 * EL CATÁLOGO, y no una API. Un degradado se dibuja sin red, entra en cualquier
 * ancho, se ve igual en tema claro y oscuro y no puede 404ear — así que es lo que
 * abre el selector. Las FOTOS están en la otra pestaña, que sí sale a buscarlas.
 */
export const GRADIENTES: Gradiente[] = [
  { id: 'amanecer',  nombre: 'Amanecer',   a: '#f6d365', b: '#fda085' },
  { id: 'durazno',   nombre: 'Durazno',    a: '#ffecd2', b: '#fcb69f' },
  { id: 'coral',     nombre: 'Coral',      a: '#ff9a9e', b: '#fecfef' },
  { id: 'ciruela',   nombre: 'Ciruela',    a: '#a18cd1', b: '#fbc2eb' },
  { id: 'indigo',    nombre: 'Índigo',     a: '#667eea', b: '#764ba2' },
  { id: 'oceano',    nombre: 'Océano',     a: '#2193b0', b: '#6dd5ed' },
  { id: 'menta',     nombre: 'Menta',      a: '#43e97b', b: '#38f9d7' },
  { id: 'bosque',    nombre: 'Bosque',     a: '#134e5e', b: '#71b280' },
  { id: 'arena',     nombre: 'Arena',      a: '#d7d2cc', b: '#f0e6d2' },
  { id: 'grafito',   nombre: 'Grafito',    a: '#434343', b: '#8e9095' },
  { id: 'noche',     nombre: 'Noche',      a: '#232526', b: '#414345' },
  { id: 'vino',      nombre: 'Vino',       a: '#870000', b: '#d16ba5' },
];

const PREFIJO_GRAD = 'grad:';
const gradPorId = new Map(GRADIENTES.map((g) => [g.id, g]));

/** El CSS de un degradado del catálogo. Mismo ángulo en todos: se comparan de un vistazo. */
export const cssGradiente = (g: Gradiente): string => `linear-gradient(135deg, ${g.a}, ${g.b})`;

/** ¿Esta portada es una FOTO? (lo que decide si hay que dibujar un `<img>` o un fondo). */
export const esFoto = (v: string | null | undefined): boolean => !!v && v.startsWith('https://');

/** La URL de la foto, o `null` si la portada no es una foto. */
export const urlPortada = (v: string | null | undefined): string | null => (esFoto(v) ? (v as string) : null);

/**
 * El `background` con el que se pinta la banda.
 *
 * `colorBase` es el derivado del nombre y es el DEFAULT, no un respaldo de error: un
 * cliente que nunca eligió portada no tiene una portada rota, tiene la de siempre.
 *
 * ⚠️ LA URL VA CON COMILLAS Y SIN COMILLAS ADENTRO. Lo que llega acá ya pasó por
 * `saneaPortada` en el server, pero esto se dibuja en el navegador con un string
 * interpolado: una comilla suelta cerraría el `url()` y abriría lo que siga como CSS.
 */
export function fondoPortada(v: string | null | undefined, colorBase: string, y?: number | null): string {
  const url = urlPortada(v);
  if (url) return `center ${posicionY(y)} / cover no-repeat url("${sinComillas(url)}")`;
  const g = v?.startsWith(PREFIJO_GRAD) ? gradPorId.get(v.slice(PREFIJO_GRAD.length)) : undefined;
  if (g) return cssGradiente(g);
  return `linear-gradient(135deg, color-mix(in srgb, ${colorBase} 26%, var(--surface)), color-mix(in srgb, ${colorBase} 6%, var(--surface)))`;
}

/**
 * Sin comillas ni barras: lo que va adentro de un `url("…")`.
 *
 * ⚠️ ESCRITO CON `split`/`join` Y NO CON UNA REGEX, a propósito. La clase que hace
 * falta es `["\\]`, y este archivo se escribe desde un heredoc de bash que se come
 * una de las dos barras — con lo cual queda `["\]`, que es una expresión regular sin
 * terminar. Ya pasó (AGENTS.md → «El heredoc del Bash se come las barras»), y acá el
 * resultado es idéntico sin un solo carácter de escape.
 */
const sinComillas = (s: string): string => s.split('"').join('').split(String.fromCharCode(92)).join('');

/** El valor que se guarda cuando alguien elige el degradado `g`. */
export const valorGradiente = (g: Gradiente): string => `${PREFIJO_GRAD}${g.id}`;

/**
 * LOS ORÍGENES DE LOS QUE SE ACEPTA UNA FOTO.
 *
 * ⚠️ SE COMPARA `new URL(u).origin`, NUNCA UN PREFIJO DE LA URL. Medido en este repo
 * (AGENTS.md → «Un guard de ORIGEN se escribe con `origin`»): con `startsWith`,
 * `https://picsum.photos@evil.tld/x` pasa y su origen REAL es `evil.tld` — o sea que
 * el navegador de un cliente iría a buscar la imagen a un tercero, con su referer.
 * La url se lee bien en cualquier log, que es lo que lo vuelve caro.
 */
function origenesOk(): Set<string> {
  const ok = new Set<string>(['https://picsum.photos', 'https://fastly.picsum.photos']);
  // El bucket público de Supabase, que es donde caen las que se SUBEN. Sale del env
  // y no de una constante: cada entorno tiene su proyecto.
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (base) ok.add(new URL(base).origin);
  } catch { /* env mal formado: se queda sin el origen propio, que es lo seguro */ }
  return ok;
}

/**
 * Lo que de verdad se guarda. Devuelve `null` para «sin portada» (el default).
 *
 * Corre en el SERVER, que es el único que decide: lo que manda el navegador es una
 * propuesta. Un `grad:` inventado, una URL http, un `javascript:` o un origen que no
 * está en la lista se descartan — y descartar es volver al default, nunca guardar algo
 * a medias.
 */
export function saneaPortada(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (s.startsWith(PREFIJO_GRAD)) return gradPorId.has(s.slice(PREFIJO_GRAD.length)) ? s : null;
  return urlDeImagenOk(s);
}

/**
 * Una URL de imagen de un origen permitido, o `null`.
 *
 * Sirve para la portada y para la FOTO de perfil, que tiene el mismo problema y la
 * misma cura: se pinta en un `<img>` del navegador de cualquiera que abra la tab.
 */
export function urlDeImagenOk(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== 'https:') return null;
    return origenesOk().has(u.origin) ? u.toString() : null;
  } catch { return null; }
}

// =============================================================================
// EL ENCUADRE (mig 0174)
// =============================================================================

/**
 * EL `background-position` VERTICAL de una portada, listo para el CSS.
 *
 * ⚠️ ESTA FUNCIÓN EXISTE PORQUE `fondoPortada` CABLEABA `center`. Medido el
 * 27/09/2026 antes de tocarlo: la posición se podía guardar perfecto y los SEIS
 * lugares que dibujan una portada la ignoraban, porque el string decía
 * `center / cover`. El botón «Reposicionar» habría funcionado —guardaba— y no se
 * habría visto NADA. Es el modo de falla de «escribir la salida no es ofrecerla»:
 * el dato llega y nadie lo lee.
 *
 * `null` = centrado, que es exactamente lo que se veía antes. 0 = el borde de
 * arriba de la imagen, 100 = el de abajo.
 */
export function posicionY(y: number | null | undefined): string {
  const n = yPortada(y);
  return n === null ? 'center' : `${n}%`;
}

/**
 * El encuadre que de verdad se guarda: un entero 0-100, o `null` para centrado.
 *
 * Corre en el SERVER igual que `saneaPortada` — lo que manda el navegador es una
 * propuesta. Y corre también en el navegador para no dibujar cualquier cosa
 * mientras se arrastra.
 *
 * ⚠️ DEVUELVE `null` PARA LO QUE NO ES UN NÚMERO, no 50. «Nadie lo movió» y «lo
 * dejó justo al medio» son dos hechos distintos: el primero se puede reencuadrar
 * solo el día que cambie el alto de la banda, el segundo no. La base tiene el
 * mismo CHECK (mig 0174), que es la segunda capa.
 */
export function yPortada(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Lo que de verdad se guarda en `icono` (mig 0174): un ícono del catálogo o una
 * foto de un origen permitido. `null` = no hay ícono propio, se usa el respaldo
 * (el `emoji` de un proyecto, la foto o las iniciales de un cliente).
 *
 * ⚠️ NO ACEPTA UN EMOJI. Un emoji se guarda en la columna `emoji`, que es la que
 * leen el prompt de reuniones, el export y la API de MaKo — y que se trunca a 4
 * caracteres en la mitad del cliente (`lib/todo.ts:621`). Meter acá un glifo
 * dejaría dos respuestas a «¿qué se dibuja?» y la de texto se quedaría vieja.
 */
export function saneaIcono(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim();
  if (esIcono(s)) return s;
  return urlDeImagenOk(s);
}
