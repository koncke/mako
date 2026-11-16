// =============================================================================
// Lo que decide el formulario de /accelerator/aplicar, sin React (16/11/2026): el borrador, cómo se dibuja cada campo y el origen
// =============================================================================
// Lo usa ./FormularioAplicacion.tsx (en el navegador) y lo prueba tests/aplicacion-accelerator.test.ts. Las preguntas, cómo se
// valida cada una y quién califica NO viven acá: son el contrato, lib/aplicacion-accelerator.ts (el mismo que lee el servidor).
// Sin imports de servidor: va al navegador.
// =============================================================================

import { CAMPOS, LARGO_MAXIMO, SECCIONES, erroresDeLaSeccion, type Campo, type Respuestas, type Seccion } from '@/lib/aplicacion-accelerator';
import { numeroTecleado, telefonoDeFormulario } from '@/lib/paises';

/**
 * EL VIDEO DE MARTÍN EN LA PANTALLA FINAL (16/11/2026). Martín: «deja ahí un espacio… para un video, porque les voy a agradecer por
 * su aplicación, yo en video, y les voy a invitar exactamente a lo mismo» (la prueba gratuita). Cuando lo grabe, va acá el link del
 * reproductor de Panda (el `embed/?v=…`, como `VSL_ACELERADOR` de app/accelerator/contenido.ts). Mientras es null, el espacio está
 * igual, con «Muy pronto»: así se ve dónde va y la pantalla no cambia de forma el día que llega.
 */
export const VIDEO_DE_GRACIAS: string | null = null;

/** Dónde se guarda el borrador en el navegador. Con la versión: si cambian las preguntas, un borrador viejo no se lee mal. */
export const CLAVE_BORRADOR = 'mako.aplicacion-accelerator.v1';
/** Un borrador de más de 30 días ya no se retoma: es otra persona, u otra decisión. */
export const VIGENCIA_BORRADOR_MS = 30 * 24 * 3600_000;

/** El id del control de un campo (el input, el textarea, o el primer radio o checkbox de su grupo). */
export const idDelCampo = (id: string) => `apl-${id}`;

/**
 * EL CAMPO TRAMPA, con un nombre que ningún autocompletado reconoce (revisión del 16/11/2026). Se llamaba «web» y su rótulo era
 * «Web»: un gestor de contraseñas o la tarjeta de contacto del navegador lo llenaban con el sitio de la persona, y su aplicación
 * se tomaba por un bot. En el POST sigue viajando como `web` (la ruta no cambia); lo que cambia es lo que ve el navegador.
 */
export const ID_TRAMPA = 'apl-hp-k7';
export const NOMBRE_TRAMPA = 'apl_hp_k7';
export const ROTULO_TRAMPA = 'No completes este campo';

/** El paso donde vive cada campo. */
export const pasoDelCampo = (id: string): number => SECCIONES.findIndex((s) => s.campos.some((c) => c.id === id));

/** El primer paso con algo sin completar, hasta `hasta` (inclusive): no se retoma en el paso 5 con el 2 a medias. */
export function pasoQueVale(r: Respuestas, hasta: number): number {
  const tope = Math.max(0, Math.min(Math.trunc(hasta) || 0, SECCIONES.length - 1));
  for (let i = 0; i < tope; i++) if (Object.keys(erroresDeLaSeccion(SECCIONES[i], r)).length) return i;
  return tope;
}

/**
 * LA APLICACIÓN YA ENVIADA (16/11/2026): quien vuelve a la página en la semana ve su pantalla final otra vez (el gracias, el video
 * y su paso siguiente), y nadie llena dos veces los cinco minutos ni le deja a Martín una aplicación repetida. «Enviar otra
 * aplicación» la borra.
 */
export const CLAVE_ENVIADA = 'mako.aplicacion-accelerator.enviada.v1';
export const VIGENCIA_ENVIADA_MS = 7 * 24 * 3600_000;
/** Lo único que la pantalla final vuelve a usar: el nombre del saludo y si ya tiene cuenta de MaKo (el botón). */
const LO_DE_LA_PANTALLA_FINAL = ['nombre', 'cuenta'] as const;

/**
 * Lo que se guarda de la aplicación enviada: SÓLO lo que la pantalla final vuelve a usar (revisión del 16/11/2026: quedaba entera
 * una semana, y en un navegador compartido la leía el siguiente). Versión 2 (16/11/2026, a la tarde): sin la agenda, ni el
 * «califica» (la pantalla final es la misma para todos).
 */
export function enviadaParaGuardar(r: Respuestas, ahora: number): string {
  const guardado: Respuestas = {};
  for (const id of LO_DE_LA_PANTALLA_FINAL) if (r[id] !== undefined) guardado[id] = r[id];
  return JSON.stringify({ v: 2, r: guardado, t: ahora });
}

/**
 * La aplicación enviada que guardó este navegador, limpia (sólo `LO_DE_LA_PANTALLA_FINAL`); null si no hay, es vieja o no se
 * entiende. Una de la versión 1 (con la agenda: el WhatsApp, el email, la meta…) se lee igual y vuelve con `reescribir`: quien la
 * usa la guarda otra vez en la 2, y lo de más se borra del navegador.
 */
export function enviadaLimpia(crudo: unknown, ahora: number): { respuestas: Respuestas; reescribir: boolean } | null {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const o = crudo as { v?: unknown; r?: unknown; t?: unknown };
  if ((o.v !== 1 && o.v !== 2) || typeof o.t !== 'number' || ahora - o.t > VIGENCIA_ENVIADA_MS) return null;
  const todas = respuestasLimpias(o.r);
  if (!todas) return null;
  const respuestas: Respuestas = {};
  for (const id of LO_DE_LA_PANTALLA_FINAL) if (todas[id] !== undefined) respuestas[id] = todas[id];
  return { respuestas, reescribir: o.v === 1 };
}

/**
 * El botón de la prueba gratuita de la pantalla final: el checkout de MaKo Pro con su prueba (`rutaPrueba`, page.tsx), con la
 * campaña que trajo a quien aplicó y `landing=accelerator` si no traía una (así la compra cuenta que vino de la aplicación).
 */
export function linkDeLaPrueba(rutaPrueba: string, origen: Record<string, string> | null | undefined, claves: readonly string[]): string {
  const q = new URLSearchParams();
  for (const k of claves) {
    const v = origen?.[k];
    if (typeof v === 'string' && v.trim()) q.set(k, v.trim().slice(0, 250));
  }
  if (!q.get('landing')) q.set('landing', 'accelerator');
  return `${rutaPrueba}?${q.toString()}`;
}

/**
 * El borrador guardado, limpio: sólo los campos de la aplicación y cada uno con el tipo que le toca (lo de otra versión, o lo que
 * alguien escribió a mano en el navegador, se descarta). null = no hay nada que retomar. `origen`: la campaña con la que llegó
 * (`borradorParaGuardar`), sólo las `claves` de la campaña y como texto corto: el servidor la vuelve a limpiar (`origenLimpio`).
 * El paso se decide con lo GUARDADO: un WhatsApp de antes del selector de país, sin país, no vale, y retoma en «Tus datos».
 */
export function borradorLimpio(crudo: unknown, ahora: number, claves: readonly string[] = []): { paso: number; respuestas: Respuestas; origen: Record<string, string> | null } | null {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const o = crudo as { v?: unknown; paso?: unknown; r?: unknown; t?: unknown; o?: unknown };
  if (o.v !== 1 || typeof o.t !== 'number' || ahora - o.t > VIGENCIA_BORRADOR_MS) return null;
  const respuestas = respuestasLimpias(o.r);
  return respuestas ? { paso: pasoQueVale(respuestas, typeof o.paso === 'number' ? o.paso : 0), respuestas, origen: origenGuardado(o.o, claves) } : null;
}

/** La campaña guardada en el borrador: sólo esas claves, texto sin caracteres de control y con un tope. null si no trae nada. */
function origenGuardado(crudo: unknown, claves: readonly string[]): Record<string, string> | null {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const out: Record<string, string> = {};
  for (const k of claves) {
    const v = (crudo as Record<string, unknown>)[k];
    // eslint-disable-next-line no-control-regex
    const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 250) : '';
    if (s) out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * EL WHATSAPP GUARDADO, PARA EL SELECTOR DE PAÍS (16/11/2026, `TelefonoConPais`): la lada, el número sin ella y lo que va a la
 * respuesta (`whatsapp`: «+» y los dígitos, lo que valida el servidor). Uno con «+» o «00» trae su país. ⚠️ UN BORRADOR DE ANTES DEL
 * SELECTOR puede traer un número suelto, sin país («55 1234 5678»): abre con la lada de donde está la persona (`ladaInicial`) y
 * `revisar`, para que el formulario le pida mirarlo (y `borradorLimpio` ya lo retoma en «Tus datos»). Nunca rompe: lo que no se
 * entiende queda en el campo del número, para que lo corrija.
 */
export function telefonoDelBorrador(guardado: unknown, ladaInicial: string): { lada: string; numero: string; whatsapp: string | undefined; revisar: boolean } {
  const s = typeof guardado === 'string' ? guardado.trim() : '';
  if (!s) return { lada: ladaInicial, numero: '', whatsapp: undefined, revisar: false };
  const conPais = s.startsWith('00') ? `+${s.slice(2)}` : s;
  const t = conPais.startsWith('+') ? numeroTecleado(conPais) : { lada: null, numero: numeroTecleado(s).numero };
  const lada = t.lada ?? ladaInicial;
  const d = telefonoDeFormulario(lada, t.numero);
  return { lada, numero: t.numero, whatsapp: d ? `+${d}` : undefined, revisar: !conPais.startsWith('+') };
}

/** Las respuestas guardadas en el navegador, cada una con el tipo de su campo; null si no queda ninguna. */
function respuestasLimpias(crudas: unknown): Respuestas | null {
  if (!crudas || typeof crudas !== 'object' || Array.isArray(crudas)) return null;
  const guardadas = crudas as Record<string, unknown>;
  const r: Respuestas = {};
  for (const c of CAMPOS) {
    const v = guardadas[c.id];
    const n = c.opciones?.length ?? 0;
    if (c.tipo === 'una') {
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n) r[c.id] = v;
    } else if (c.tipo === 'varias') {
      if (Array.isArray(v)) {
        const l = [...new Set(v.filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < n))].sort((x, y) => x - y);
        if (l.length) r[c.id] = l;
      }
    } else if (c.tipo === 'confirmo') {
      if (v === true) r[c.id] = true;
    } else if (typeof v === 'string' && v) {
      r[c.id] = v.slice(0, LARGO_MAXIMO[c.tipo]);
    }
  }
  return Object.keys(r).length ? r : null;
}

/**
 * Lo que se guarda en el navegador. Con la campaña (`origen`, revisión del 16/11/2026): quien llegó de un anuncio y vuelve otro día
 * a terminar el borrador ya no trae el `utm` en la URL ni en la página anterior, y su aplicación llegaba «sin campaña».
 */
export const borradorParaGuardar = (paso: number, r: Respuestas, ahora: number, origen: Record<string, string> | null = null) =>
  JSON.stringify({ v: 1, paso, r, t: ahora, ...(origen && Object.keys(origen).length ? { o: origen } : {}) });

/** Las opciones van en dos columnas en la computadora, salvo que alguna sea larga (en el teléfono, siempre una). */
export const enUnaColumna = (c: Campo): boolean => (c.opciones ?? []).some((o) => o.length > 34);

/** Cómo se escribe cada campo de texto: el teclado del teléfono, el autocompletado y si corrige. */
export function entradaDe(c: Campo): {
  type: 'text' | 'email' | 'tel'; inputMode: 'text' | 'email' | 'tel' | 'url'; autoComplete: string;
  autoCapitalize?: 'none' | 'words'; spellCheck?: boolean;
} {
  switch (c.tipo) {
    case 'email': return { type: 'email', inputMode: 'email', autoComplete: c.autoComplete ?? 'email', autoCapitalize: 'none', spellCheck: false };
    case 'whatsapp': return { type: 'tel', inputMode: 'tel', autoComplete: c.autoComplete ?? 'tel' };
    // Un link sin «https://» (instagram.com/usuario) es válido acá: `type="url"` lo marcaría inválido.
    case 'link': return { type: 'text', inputMode: 'url', autoComplete: c.autoComplete ?? 'url', autoCapitalize: 'none', spellCheck: false };
    // El @, el nombre o el link: el teclado de texto (con espacio para el nombre), sin mayúsculas ni corrector.
    case 'canal': return { type: 'text', inputMode: 'text', autoComplete: 'off', autoCapitalize: 'none', spellCheck: false };
    default: return { type: 'text', inputMode: 'text', autoComplete: c.autoComplete ?? 'off', ...(c.autoComplete?.endsWith('name') ? { autoCapitalize: 'words' as const } : {}) };
  }
}

/** Los campos de una sección en renglones: dos campos cortos seguidos (nombre y apellido, WhatsApp y email) van juntos. */
export function filasDeLaSeccion(s: Seccion): Campo[][] {
  const corto = (c: Campo) => (c.tipo === 'texto' || c.tipo === 'email' || c.tipo === 'whatsapp') && !c.ayuda;
  const filas: Campo[][] = [];
  for (const c of s.campos) {
    const ultima = filas[filas.length - 1];
    if (corto(c) && ultima?.length === 1 && corto(ultima[0])) ultima.push(c);
    else filas.push([c]);
  }
  return filas;
}

/** El nombre para el saludo de la pantalla final: el primero que escribió, limpio. */
export const nombreDelSaludo = (r: Respuestas): string => (typeof r.nombre === 'string' ? r.nombre.replace(/\s+/g, ' ').trim().split(' ')[0] ?? '' : '');

/**
 * El origen de la campaña si la URL de esta página no lo trae: el de la página de la que vino, si es de este mismo sitio (la
 * política de la casa manda la URL entera entre páginas del mismo origen). Así la campaña de un anuncio que llevó a /accelerator
 * no se pierde si el botón de la landing no la pasó. El servidor lo vuelve a limpiar (`origenLimpio`).
 */
export function origenDelReferer(referer: string, actual: string, claves: readonly string[]): Record<string, string> | null {
  try {
    const de = new URL(referer);
    if (de.origin !== new URL(actual).origin) return null;
    const out: Record<string, string> = {};
    for (const k of claves) {
      const v = de.searchParams.get(k);
      if (v) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
