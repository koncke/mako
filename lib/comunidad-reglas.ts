// =============================================================================
// comunidad-reglas — las reglas de la comunidad de un producto (puro)
// =============================================================================
// La comunidad tipo Skool (D8 de docs/diseno-curso-skool.md): un feed por PRODUCTO con categorías,
// hasta 3 fijados, likes (1 like = 1 punto), comentarios de dos niveles con @menciones, encuestas,
// adjuntos y video. Los miembros son el equipo del workspace (como admins) y los alumnos con acceso
// al curso de ese producto.
//
// Sin 'use client' ni 'server-only' a propósito: lo usan las pantallas (equipo y alumno), la capa de
// datos (lib/comunidad-datos.ts), la ruta del alumno y los tests, que lo EJECUTAN
// (tests/comunidad-reglas.test.ts, tests/comunidad-permisos.test.ts). Acá no se lee ni se escribe
// nada: todo lo que decide «¿esto se puede?» o «¿esto se guarda así?» vive acá para tener red.
//
// ⚠️ LA REGLA SE APLICA EN EL SERVER. Que la pantalla esconda «Fijar» a un alumno no protege nada:
//    lib/comunidad-datos.ts vuelve a preguntar `puedeFijar` antes de escribir, con el actor que sale
//    de la SESIÓN o de la FIRMA del token, nunca del pedido.

import { videoDeLink, embedDe } from './curso';

// ── Quién es quién ────────────────────────────────────────────────────────────────

/**
 * La identidad de un miembro, y la columna `miembro` de todas las tablas de la 0217:
 *   · `u:<usuarios.id>` — alguien del EQUIPO (escribe con su nombre, es admin de la comunidad).
 *   · `l:<leads.id>`    — un ALUMNO (un cliente ganado con acceso al curso del producto).
 *
 * ⚠️ NO ES EL EMAIL. La clave viaja al navegador del alumno (las tarjetas, las menciones, el
 *    ranking) y un email del equipo ahí sería un dato que no es suyo. Un id no dice nada.
 */
export type TipoMiembro = 'equipo' | 'alumno';
export const claveDeUsuario = (id: number): string => `u:${id}`;
export const claveDeLead = (id: number): string => `l:${id}`;
export const esClaveDeEquipo = (k: string | null | undefined): boolean => typeof k === 'string' && /^u:[1-9]\d{0,17}$/.test(k);

/** Lee una clave que llega de afuera. `null` = no es una clave. */
export function leerClave(raw: unknown): { tipo: TipoMiembro; id: number; clave: string } | null {
  if (typeof raw !== 'string') return null;
  const m = /^(u|l):([1-9]\d{0,17})$/.exec(raw.trim());
  if (!m) return null;
  const id = Number(m[2]);
  if (!Number.isSafeInteger(id)) return null;
  return { tipo: m[1] === 'u' ? 'equipo' : 'alumno', id, clave: `${m[1]}:${id}` };
}

/** Un id entero positivo que llega del navegador, o `null`. */
export function idValido(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,15}$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// ── Topes ─────────────────────────────────────────────────────────────────────────
// Los de Skool cuando están documentados (categorías: 10, de 30 letras; fijados: 3). Los demás, un
// techo que ningún post real toca y que corta un cuerpo de 2 MB armado a mano. La migración 0217
// tiene los MISMOS números en sus CHECK: el server rebota antes, la base es la red.

export const TOPE_TITULO = 200;
export const TOPE_CUERPO = 10_000;
export const TOPE_COMENTARIO = 4_000;
export const TOPE_OPCION = 80;
export const MIN_OPCIONES = 2;
export const MAX_OPCIONES = 10;
export const TOPE_CATEGORIA = 30;
export const MAX_CATEGORIAS = 10;
export const MAX_FIJADOS = 3;
export const TOPE_BIO = 300;
export const TOPE_LINK = 300;
export const TOPE_UBICACION = 80;
export const MAX_MENCIONES = 20;
export const TOPE_NOMBRE_ADJUNTO = 120;
/** 25 MiB, el mismo tope del bucket `comunidad-adjuntos` (mig 0217). */
export const TOPE_ADJUNTO_BYTES = 25 * 1024 * 1024;
/** Posts por página del feed. */
export const PAGINA_FEED = 20;
/** «En línea» = alguna actividad en los últimos 5 minutos. */
export const EN_LINEA_MS = 5 * 60_000;

// ── Texto ─────────────────────────────────────────────────────────────────────────

/**
 * Limpia un texto que escribió una persona: saltos de línea normalizados (CRLF → LF), sin caracteres
 * de control, sin más de una línea en blanco seguida, sin espacios en las puntas. Con `unaLinea`, todo
 * el blanco se vuelve UN espacio (un título).
 *
 * ⚠️ EL HTML NO SE TOCA Y NO SE INTERPRETA: `<script>` queda escrito como texto. La pantalla lo dibuja
 *    con React (que escapa) y NUNCA con `dangerouslySetInnerHTML`. Sanear «sacando etiquetas» sería
 *    peor: le borraría a alguien un `a <b` que escribió a propósito, y le daría a la próxima pantalla
 *    la idea de que lo que sale de acá ya es HTML seguro para inyectar.
 */
export function sanearTexto(raw: unknown, opts: { unaLinea?: boolean } = {}): string {
  if (typeof raw !== 'string') return '';
  let s = raw.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (opts.unaLinea) return s.replace(/\s+/g, ' ').trim();
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** El extracto de un cuerpo para la tarjeta del feed: una sola línea, cortado en una palabra. */
export function extracto(texto: string, tope = 180): string {
  const s = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= tope) return s;
  const corte = s.slice(0, tope);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > tope * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

// ── Links, menciones y el cuerpo que se dibuja ──────────────────────────────────

/** Un pedazo del texto, como se dibuja. Un `link` es SIEMPRE http/https. */
export type TokenTexto =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'link'; texto: string; href: string }
  | { tipo: 'mencion'; texto: string; clave: string };

/** Lo que una mención necesita para dibujarse: a quién y con qué nombre se escribió. */
export type MencionNombrada = { clave: string; nombre: string };

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase('es');

/**
 * ¿El texto nombra a esta persona como `@Nombre`? El nombre tiene que terminar en un borde (no en
 * mitad de una palabra): `@Ana` no es `@Anabel`.
 *
 * ⚠️ EL BORDE VA POR UNICODE, NO CON `\b`: en JavaScript `\b` es ASCII aun con el flag `u`, así que
 *    `@José` seguido de un espacio no tiene borde y nunca matchearía (AGENTS.md, el detector de voseo).
 */
export function nombraA(texto: string, nombre: string): boolean {
  const n = nombre.trim();
  if (!n) return false;
  return new RegExp(`@${escapar(n.normalize('NFC'))}(?![\\p{L}\\p{N}])`, 'iu').test(texto.normalize('NFC'));
}

/**
 * Las menciones que se GUARDAN de un post o un comentario: las que pidió el navegador, filtradas.
 * Queda una clave sólo si (a) es un miembro de ESTA comunidad (`nombreDe` la conoce) y (b) el texto
 * de verdad la nombra con `@Nombre`. Sin duplicados, hasta `MAX_MENCIONES`.
 *
 * ⚠️ LA (b) NO ES UN DETALLE: una mención notifica. Sin ella, un pedido armado a mano le mandaría un
 *    aviso a cualquier miembro sin nombrarlo en el texto — una campana usada como spam.
 */
export function sanearMenciones(
  texto: string,
  pedidas: unknown,
  nombreDe: (clave: string) => string | null | undefined,
): string[] {
  if (!Array.isArray(pedidas)) return [];
  const out: string[] = [];
  for (const p of pedidas) {
    const k = leerClave(p);
    if (!k || out.includes(k.clave)) continue;
    const nombre = nombreDe(k.clave);
    if (!nombre || !nombraA(texto, nombre)) continue;
    out.push(k.clave);
    if (out.length >= MAX_MENCIONES) break;
  }
  return out;
}

/**
 * ¿Hay una mención a medio escribir justo antes del cursor? Es lo que abre las sugerencias del campo
 * (app/_comunidad/CampoMenciones.tsx): un `@` al principio o después de un espacio, y lo que sigue hasta
 * el cursor (puede tener espacios: «@Ana Pé»), sin saltos de línea y no más largo que un nombre.
 */
export function consultaDeMencion(texto: string, cursor: number): { ini: number; q: string } | null {
  const antes = texto.slice(0, Math.max(0, Math.min(cursor, texto.length)));
  const i = antes.lastIndexOf('@');
  if (i < 0) return null;
  if (i > 0 && !/[\s(¡¿"']/u.test(antes[i - 1])) return null;
  const q = antes.slice(i + 1);
  if (q.length > 40 || /[\n@]/.test(q) || /\s{2,}/.test(q) || /^\s/.test(q)) return null;
  return { ini: i, q };
}

/** Reemplaza la mención a medio escribir por `@Nombre ` y dice dónde queda el cursor. */
export function insertarMencion(texto: string, cursor: number, consulta: { ini: number }, nombre: string): { texto: string; cursor: number } {
  const ins = `@${nombre.trim()} `;
  const nuevo = texto.slice(0, consulta.ini) + ins + texto.slice(Math.max(cursor, consulta.ini));
  return { texto: nuevo, cursor: consulta.ini + ins.length };
}

/**
 * Las menciones que ya tiene un texto PARTIDO (`tokensDeTexto`), para EDITARLO: el campo arranca con
 * ellas. Sin esto, editar un comentario mandaba `menciones: []` y el server guardaba el `@Nombre`
 * como texto suelto: la mención dejaba de ser un link al perfil sin que nadie la borrara. El nombre
 * sale del pedazo tal como se escribió (sin la `@`); el server la vuelve a validar igual
 * (`sanearMenciones`, sin mayúsculas).
 */
export function mencionesDeTokens(tokens: readonly TokenTexto[]): MencionNombrada[] {
  const out: MencionNombrada[] = [];
  for (const t of tokens) {
    if (t.tipo !== 'mencion' || out.some((m) => m.clave === t.clave)) continue;
    const nombre = t.texto.replace(/^@/, '').trim();
    if (nombre) out.push({ clave: t.clave, nombre });
  }
  return out;
}

/** Las claves de una columna `menciones` leída de la base (lo que no es una clave se tira). */
export function mencionesGuardadas(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) { const k = leerClave(x); if (k && !out.includes(k.clave)) out.push(k.clave); }
  return out.slice(0, MAX_MENCIONES);
}

const RE_LINK = /https?:\/\/[^\s<>"'`]+/giu;
/** Lo que no es parte de un link cuando termina una oración: «mira https://x.com.» */
const COLA_LINK = /[.,;:!?)\]}»”’]+$/u;

/**
 * El texto partido en pedazos para dibujar: texto, links (sólo http/https) y menciones (`@Nombre` de
 * alguien de `menciones`). React dibuja cada pedazo como texto, así que nada de lo que escribió una
 * persona se interpreta como HTML.
 *
 * ⚠️ UN `javascript:` NUNCA ES LINK: el regex sólo reconoce `http://` y `https://`, y además se valida
 *    con `URL` (un link que no parsea queda como texto).
 */
export function tokensDeTexto(texto: string, menciones: readonly MencionNombrada[] = []): TokenTexto[] {
  // NFC una sola vez y para todo: si las menciones buscaran sobre otra forma del texto que los
  // links, las posiciones no coincidirían y un pedazo se cortaría por la mitad.
  const s = (texto ?? '').normalize('NFC');
  type Hallazgo = { ini: number; fin: number; token: TokenTexto };
  const hallazgos: Hallazgo[] = [];

  for (const m of s.matchAll(RE_LINK)) {
    let crudo = m[0];
    const cola = COLA_LINK.exec(crudo);
    if (cola) crudo = crudo.slice(0, crudo.length - cola[0].length);
    if (!crudo) continue;
    let href: string | null = null;
    try {
      const u = new URL(crudo);
      if (u.protocol === 'http:' || u.protocol === 'https:') href = u.toString();
    } catch { /* no es un link: queda como texto */ }
    if (href) hallazgos.push({ ini: m.index!, fin: m.index! + crudo.length, token: { tipo: 'link', texto: crudo, href } });
  }

  // Los nombres más largos primero: «@Ana María» no puede quedar partido por «@Ana».
  const porLargo = [...menciones].filter((m) => m.nombre.trim()).sort((a, b) => b.nombre.length - a.nombre.length);
  for (const m of porLargo) {
    const re = new RegExp(`@${escapar(m.nombre.trim().normalize('NFC'))}(?![\\p{L}\\p{N}])`, 'giu');
    for (const x of s.matchAll(re)) {
      hallazgos.push({ ini: x.index!, fin: x.index! + x[0].length, token: { tipo: 'mencion', texto: x[0], clave: m.clave } });
    }
  }

  // Sin solaparse: gana el que empieza antes (y, en el mismo lugar, el más largo).
  hallazgos.sort((a, b) => a.ini - b.ini || (b.fin - b.ini) - (a.fin - a.ini));
  const out: TokenTexto[] = [];
  let i = 0;
  for (const h of hallazgos) {
    if (h.ini < i) continue;
    if (h.ini > i) out.push({ tipo: 'texto', texto: s.slice(i, h.ini) });
    out.push(h.token);
    i = h.fin;
  }
  if (i < s.length) out.push({ tipo: 'texto', texto: s.slice(i) });
  return out;
}

// ── Video ─────────────────────────────────────────────────────────────────────────

export type VideoPost = { proveedor: 'youtube' | 'vimeo' | 'loom'; url: string; embed: string };

/**
 * Un link de video que se puede EMBEBER en un post: YouTube, Vimeo o Loom, con su id. Cualquier otra
 * cosa (Drive, un .mp4 suelto, un link roto) es `null` y el post no se guarda con ese video.
 *
 * Reusa el reconocedor del curso (`videoDeLink`, lib/curso.ts), que ya sabe del Vimeo no listado y
 * de los `shorts`: dos reconocedores del mismo link son dos respuestas el día que uno se arregle.
 */
export function videoDePost(raw: unknown): VideoPost | null {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 600) return null;
  const v = videoDeLink(raw);
  if (!v || !v.id || (v.tipo !== 'youtube' && v.tipo !== 'vimeo' && v.tipo !== 'loom')) return null;
  const embed = embedDe(v);
  if (!embed) return null;
  // El tope va sobre lo que se GUARDA (`v.url`, ya normalizado por `URL`), no sobre lo escrito: una
  // «ñ» normalizada son seis letras, y pasarse del CHECK de la 0217 rebotaba con el texto crudo de Postgres.
  if (v.url.length > 600) return null;
  return { proveedor: v.tipo, url: v.url, embed };
}

// ── Encuestas ─────────────────────────────────────────────────────────────────────

export type OpcionEncuesta = { id: string; texto: string };
export type Encuesta = { opciones: OpcionEncuesta[] };

/**
 * La encuesta de un post. Llega como la lista de opciones (en Skool la pregunta va en el cuerpo del
 * post). `null` = no hay encuesta (no vino, o vino vacía). Los ids son `o1`…`oN` y NO cambian: un
 * voto guarda el id, y por eso una encuesta publicada no se edita (lib/comunidad-datos.ts).
 */
export function sanearEncuesta(raw: unknown): { ok: true; encuesta: Encuesta | null } | { ok: false; error: string } {
  if (raw == null) return { ok: true, encuesta: null };
  const lista = Array.isArray(raw) ? raw : (raw as { opciones?: unknown })?.opciones;
  if (!Array.isArray(lista)) return { ok: false, error: 'La encuesta no se entiende.' };
  const textos = lista.map((x) => sanearTexto(typeof x === 'string' ? x : (x as { texto?: unknown })?.texto, { unaLinea: true })).filter(Boolean);
  if (!textos.length) return { ok: true, encuesta: null };
  if (textos.length < MIN_OPCIONES) return { ok: false, error: `La encuesta lleva al menos ${MIN_OPCIONES} opciones.` };
  if (textos.length > MAX_OPCIONES) return { ok: false, error: `Hasta ${MAX_OPCIONES} opciones.` };
  if (textos.some((t) => t.length > TOPE_OPCION)) return { ok: false, error: `Cada opción, hasta ${TOPE_OPCION} letras.` };
  if (new Set(textos.map(norm)).size !== textos.length) return { ok: false, error: 'Hay opciones repetidas.' };
  return { ok: true, encuesta: { opciones: textos.map((texto, i) => ({ id: `o${i + 1}`, texto })) } };
}

/** Una encuesta leída de la base. Lo que no tiene la forma se tira (y sin 2 opciones, no hay encuesta). */
export function encuestaGuardada(raw: unknown): Encuesta | null {
  const ops = (raw as { opciones?: unknown } | null)?.opciones;
  if (!Array.isArray(ops)) return null;
  const opciones = ops
    .filter((o): o is { id: string; texto: string } => !!o && typeof (o as OpcionEncuesta).id === 'string' && typeof (o as OpcionEncuesta).texto === 'string')
    .filter((o) => /^o\d{1,2}$/.test(o.id))
    .map((o) => ({ id: o.id, texto: o.texto }));
  return opciones.length >= MIN_OPCIONES ? { opciones } : null;
}

export type ResultadoEncuesta = {
  opciones: Array<OpcionEncuesta & { votos: number; pct: number }>;
  total: number;
  /** La opción que eligió quien mira, o `null`. */
  miVoto: string | null;
};

/**
 * Los resultados: votos y % de cada opción, y el voto de quien mira. Un voto a una opción que no
 * existe (una fila vieja) no cuenta, ni en la opción ni en el total. Un voto por persona: si llegaran
 * dos filas del mismo miembro, vale la última.
 */
export function resultadosEncuesta(
  e: Encuesta,
  votos: ReadonlyArray<{ opcion: string; miembro: string }>,
  yo: string | null,
): ResultadoEncuesta {
  const validas = new Set(e.opciones.map((o) => o.id));
  const porMiembro = new Map<string, string>();
  for (const v of votos) if (validas.has(v.opcion)) porMiembro.set(v.miembro, v.opcion);
  const cuenta = new Map<string, number>();
  for (const op of porMiembro.values()) cuenta.set(op, (cuenta.get(op) ?? 0) + 1);
  const total = porMiembro.size;
  return {
    opciones: e.opciones.map((o) => {
      const n = cuenta.get(o.id) ?? 0;
      return { ...o, votos: n, pct: total ? Math.round((n / total) * 100) : 0 };
    }),
    total,
    miVoto: yo ? porMiembro.get(yo) ?? null : null,
  };
}

// ── Comentarios: dos niveles ─────────────────────────────────────────────────────

/**
 * A qué comentario queda colgada una respuesta. Skool tiene DOS niveles: comentario y respuesta. Se
 * responde a un comentario de primer nivel → cuelga de él; se responde a una RESPUESTA → cuelga del
 * mismo comentario que ella (queda en el mismo hilo, no abre un tercer nivel). `null` = es un
 * comentario de primer nivel.
 */
export function padreDeRespuesta(objetivo: { id: number; padreId: number | null } | null | undefined): number | null {
  if (!objetivo) return null;
  return objetivo.padreId ?? objetivo.id;
}

/**
 * Arma el árbol de dos niveles: los comentarios de primer nivel en orden cronológico (como Skool),
 * y debajo de cada uno sus respuestas, también cronológicas. Una respuesta cuyo padre no está (lo
 * borraron y la base todavía no la llevó en cascada) no se dibuja: colgada de nada no tiene contexto.
 */
export function arbolDeComentarios<T extends { id: number; padreId: number | null; creado: string }>(
  lista: readonly T[],
): Array<T & { respuestas: T[] }> {
  const cron = (a: T, b: T) => (a.creado < b.creado ? -1 : a.creado > b.creado ? 1 : a.id - b.id);
  const raices = lista.filter((c) => c.padreId == null).slice().sort(cron);
  const ids = new Set(raices.map((r) => r.id));
  const hijos = new Map<number, T[]>();
  for (const c of lista) {
    if (c.padreId == null || !ids.has(c.padreId)) continue;
    hijos.set(c.padreId, [...(hijos.get(c.padreId) ?? []), c]);
  }
  return raices.map((r) => ({ ...r, respuestas: (hijos.get(r.id) ?? []).slice().sort(cron) }));
}

// ── Permisos ──────────────────────────────────────────────────────────────────────

/**
 * Quién actúa. `equipo` = alguien del workspace con sesión (es ADMIN de la comunidad: modera, fija,
 * borra lo ajeno). `adminWs` = además administra el workspace (configura: categorías y nombres de
 * nivel, como editar el curso). Un alumno es `equipo: false, adminWs: false`, siempre.
 */
export type ActorRegla = { clave: string; equipo: boolean; adminWs: boolean };
export type CategoriaRegla = { id: number; nombre: string; permiso: PermisoCategoria };
export type PermisoCategoria = 'todos' | 'equipo';

/** Editar el texto de un post o comentario: sólo quien lo escribió (ni el equipo pone palabras ajenas). */
export const puedeEditar = (a: ActorRegla, autor: string): boolean => a.clave === autor;
/** Borrar: quien lo escribió, o el equipo (moderación). */
export const puedeBorrar = (a: ActorRegla, autor: string): boolean => a.clave === autor || a.equipo;
/** Fijar arriba del feed: sólo el equipo (en Skool, sólo admins). */
export const puedeFijar = (a: ActorRegla): boolean => a.equipo;
/** Configurar la comunidad (categorías, nombres de nivel): un admin del workspace. */
export const puedeConfigurar = (a: ActorRegla): boolean => a.equipo && a.adminWs;
/** Publicar en una categoría: «todos» deja a cualquiera; «solo el equipo», al equipo. */
export const puedePublicarEn = (a: ActorRegla, c: Pick<CategoriaRegla, 'permiso'> | null): boolean =>
  !c || c.permiso === 'todos' || a.equipo;
/**
 * Dar like. ⚠️ NUNCA A LO PROPIO: un like vale un punto, y un like propio sería un punto por cada post
 * que uno escribe — el ranking premiaría escribir mucho, no lo que a los demás les sirve. Skool no deja
 * likearse a uno mismo, y la 0217 lo repite en un CHECK (`miembro <> autor_miembro`).
 */
export const puedeDarLike = (a: ActorRegla, autor: string): boolean => a.clave !== autor;
/** ¿Se puede fijar uno más? Hasta `MAX_FIJADOS` por comunidad; volver a fijar uno ya fijado no suma. */
export const hayLugarParaFijar = (fijados: number, yaFijado: boolean): boolean => yaFijado || fijados < MAX_FIJADOS;
/** El nivel mínimo para postear (ajuste de la comunidad, 1 = cualquiera). El equipo postea siempre. */
export const puedePostearPorNivel = (a: ActorRegla, nivel: number, minimo: number): boolean =>
  a.equipo || nivel >= Math.max(1, Math.floor(minimo) || 1);

/**
 * ¿Puede publicar ALGO en esta comunidad? Llega al nivel mínimo y, si hay categorías, alguna lo deja
 * (si todas son «solo el equipo», un alumno abriría el compositor para chocar con «Elige una
 * categoría» sin ninguna para elegir). Es lo que apaga «Escribe algo» (`puedoPublicar`) y lo que el
 * server vuelve a preguntar antes de firmar una SUBIDA: un archivo que no va a poder ir en ningún
 * post es basura en el bucket.
 */
export const puedePublicarEnLaComunidad = (
  a: ActorRegla, nivel: number, minimo: number, categorias: ReadonlyArray<Pick<CategoriaRegla, 'permiso'>>,
): boolean => puedePostearPorNivel(a, nivel, minimo) && (!categorias.length || categorias.some((c) => puedePublicarEn(a, c)));

// ── Moderación (la segunda mitad) ─────────────────────────────────────────────────
// Skool (relevo, B.8): admins y moderadores borran lo ajeno, fijan, sacan a alguien y arman
// categorías donde sólo postean ellos. Acá el EQUIPO del workspace es eso; un alumno, nunca.

/** Moderar (sacar a un alumno, cerrar los comentarios de un post): el equipo. */
export const puedeModerar = (a: ActorRegla): boolean => a.equipo;

/**
 * Sacar a alguien de la comunidad: el equipo, a un ALUMNO que no sea uno mismo.
 *
 * ⚠️ AL EQUIPO NO SE LO SACA DE ACÁ: es el equipo del workspace, y su lugar lo decide la cuenta de
 *    MaKo (suspenderla), no la comunidad. Y SACAR NO CORTA EL CURSO: el baneo vive en
 *    `comunidad_baneos`, aparte de `curso_accesos`; el alumno sigue con sus clases.
 */
export const puedeSacar = (a: ActorRegla, objetivo: string): boolean =>
  a.equipo && leerClave(objetivo)?.tipo === 'alumno' && objetivo !== a.clave;

/**
 * Comentar un post. Con los comentarios CERRADOS no comenta nadie, tampoco el equipo: para eso los
 * vuelve a abrir. Un «cerrado» que el equipo saltea es un cerrado que nadie entiende.
 */
export const puedeComentar = (post: { cerrado: boolean }): boolean => !post.cerrado;

/** Editar el About (nombre, descripción, texto y reglas): el equipo. */
export const puedeEditarAbout = (a: ActorRegla): boolean => a.equipo;

/** Crear, editar y borrar eventos del calendario: el equipo (en Skool, admins y moderadores). */
export const puedeGestionarEventos = (a: ActorRegla): boolean => a.equipo;

/**
 * ¿Quien actúa ve —y comenta— el hilo de ESTA clase? (los comentarios de una clase, item 13 del audio
 * del 08/10/2026, mig 0227). Pura, con lo que lib/comunidad-datos.ts (`leerClaseParaComentar`) leyó:
 *
 *   · la clase tiene que EXISTIR en el negocio del contexto, y el contexto ser el del actor
 *     (`mismoWorkspace`): una clase de otro negocio no se lee (llega `null`) — el IDOR entre inquilinos;
 *   · y ser del MISMO PRODUCTO que la comunidad del actor: una clase de otro producto del mismo negocio
 *     se comentaría en la comunidad equivocada — el IDOR entre productos;
 *   · el EQUIPO, con eso, la ve siempre (modera, con los comentarios prendidos o no);
 *   · un ALUMNO, además, sólo si el curso tiene los comentarios PRENDIDOS y la clase SE LE ABRE (su
 *     candado, el de su módulo y sus permisos: `claseDelAlumno` con `exigeAbierta`). Un alumno que no
 *     puede ver la clase no ve ni comenta sus comentarios.
 *
 * Escrita en POSITIVO: cada «sí» se nombra; lo que no está nombrado es «no» (AGENTS.md).
 */
export function puedeComentarLaClase(p: {
  equipo: boolean;
  mismoWorkspace: boolean;
  /** El producto de la clase, o `null` si no existe (borrada, en la papelera o de otro negocio). */
  productoDeLaClase: number | null;
  productoDelActor: number;
  /** Sólo alumno: los comentarios de ESTA clase, prendidos en su «…» (lib/curso-estilo.ts, `comentariosClase`). */
  comentariosPrendidos: boolean;
  /** Sólo alumno: la clase se le ABRE (la decisión del portal fue `ok` y está abierta). */
  abiertaParaElAlumno: boolean;
}): boolean {
  const suya = p.mismoWorkspace && p.productoDeLaClase != null && p.productoDeLaClase === p.productoDelActor;
  if (!suya) return false;
  if (p.equipo) return true;
  return p.comentariosPrendidos === true && p.abiertaParaElAlumno === true;
}

// ── El About ──────────────────────────────────────────────────────────────────────

/** La descripción corta de la columna lateral (Skool: hasta 150). La 0217 repite el tope. */
export const TOPE_DESCRIPCION_CORTA = 150;
export const TOPE_NOMBRE_COMUNIDAD = 80;
export const TOPE_ABOUT = 5000;
export const TOPE_REGLAS = 4000;

export type AboutLimpio = { nombre: string | null; descripcion: string; texto: string; reglas: string };

/**
 * Lo que edita el equipo en el About: el nombre (vacío = el del producto), la descripción corta (una
 * línea), el texto largo y las reglas. Texto, nunca HTML (se dibuja con React, como un post).
 */
export function sanearAbout(raw: unknown): { ok: true; about: AboutLimpio } | { ok: false; error: string } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const nombre = sanearTexto(b.nombre, { unaLinea: true });
  if (nombre.length > TOPE_NOMBRE_COMUNIDAD) return { ok: false, error: `El nombre pasa de ${TOPE_NOMBRE_COMUNIDAD} letras.` };
  const descripcion = sanearTexto(b.descripcion, { unaLinea: true });
  if (descripcion.length > TOPE_DESCRIPCION_CORTA) return { ok: false, error: `La descripción corta pasa de ${TOPE_DESCRIPCION_CORTA} letras.` };
  const texto = sanearTexto(b.texto);
  if (texto.length > TOPE_ABOUT) return { ok: false, error: `El texto pasa de ${TOPE_ABOUT} letras.` };
  const reglas = sanearTexto(b.reglas);
  if (reglas.length > TOPE_REGLAS) return { ok: false, error: `Las reglas pasan de ${TOPE_REGLAS} letras.` };
  return { ok: true, about: { nombre: nombre || null, descripcion, texto, reglas } };
}

/** El texto largo guardado en `comunidad_ajustes.about` (`{ texto }`). Lo que no tiene la forma, vacío. */
export function textoDeAbout(raw: unknown): string {
  const t = (raw as { texto?: unknown } | null)?.texto;
  return typeof t === 'string' ? t.slice(0, TOPE_ABOUT) : '';
}

// ── Buscar ────────────────────────────────────────────────────────────────────────

/** Lo mínimo que se busca: una letra suelta trae media comunidad. */
export const MIN_BUSQUEDA = 2;

/**
 * El patrón de `ilike` que trae los CANDIDATOS de una búsqueda de posts. Dos cosas, y ninguna decide:
 *   · `\`, `%` y `_` van escapados (en un `ilike` son comodines);
 *   · cada vocal pasa a `_` (cualquier letra), para que «jose» traiga «José» sin la extensión
 *     `unaccent` (la base no la tiene).
 * Eso trae DE MÁS («josa»), y lo de más lo saca `textoCoincide`, que compara de verdad (AGENTS.md: «un
 * patrón trae CANDIDATOS; quién es quién lo decide una comparación exacta»).
 */
export function patronDeBusqueda(q: string): string {
  let out = '';
  for (const ch of q.normalize('NFC').toLocaleLowerCase('es')) {
    if (ch === '\\' || ch === '%' || ch === '_') out += `\\${ch}`;
    else if (/[aeiouáéíóúüàèìòù]/u.test(ch)) out += '_';
    else out += ch;
  }
  return `%${out}%`;
}

/** ¿El texto contiene lo buscado? Sin mayúsculas ni acentos. Vacío no coincide con nada. */
export function textoCoincide(texto: string, q: string): boolean {
  const f = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
  const b = f(q);
  return b.length > 0 && f(texto).includes(b);
}

// ── Validar lo que se publica ─────────────────────────────────────────────────────

export type AdjuntoEntrada = { path: string; nombre: string; mime: string; bytes: number };
export type PostLimpio = {
  titulo: string; cuerpo: string; categoriaId: number | null; videoUrl: string | null;
  menciones: string[]; encuesta: Encuesta | null; adjunto: AdjuntoEntrada | null;
};

/**
 * Valida un post antes de escribirlo. `ctx.categorias` son las de ESTA comunidad: si tiene alguna, la
 * categoría es obligatoria (como en Skool) y tiene que dejarlo publicar ahí. El adjunto tiene que
 * vivir en la carpeta de ESTA comunidad (`<ws>/<producto>/<uuid>.<ext>`): el path viaja desde el
 * navegador, y un path ajeno publicaría el archivo de otro.
 *
 * `soloTexto`: al EDITAR, la encuesta y el adjunto no se tocan (un voto guarda el id de la opción).
 */
export function validarPost(
  raw: unknown,
  ctx: {
    actor: ActorRegla;
    categorias: readonly CategoriaRegla[];
    ws: number;
    productoId: number;
    nombreDe: (clave: string) => string | null | undefined;
    soloTexto?: boolean;
  },
): { ok: true; post: PostLimpio } | { ok: false; error: string } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const titulo = sanearTexto(b.titulo, { unaLinea: true });
  const cuerpo = sanearTexto(b.cuerpo);
  if (!titulo) return { ok: false, error: 'Falta el título.' };
  if (titulo.length > TOPE_TITULO) return { ok: false, error: `El título pasa de ${TOPE_TITULO} letras.` };
  if (cuerpo.length > TOPE_CUERPO) return { ok: false, error: `El texto pasa de ${TOPE_CUERPO} letras.` };

  let categoriaId: number | null = null;
  if (ctx.categorias.length) {
    const id = idValido(b.categoriaId);
    const cat = id ? ctx.categorias.find((c) => c.id === id) : undefined;
    if (!cat) return { ok: false, error: 'Elige una categoría.' };
    if (!puedePublicarEn(ctx.actor, cat)) return { ok: false, error: 'En esa categoría publica solo el equipo.' };
    categoriaId = cat.id;
  }

  let videoUrl: string | null = null;
  const videoCrudo = typeof b.videoUrl === 'string' ? b.videoUrl.trim() : '';
  if (videoCrudo) {
    const v = videoDePost(videoCrudo);
    if (!v) return { ok: false, error: 'Ese video no va. Usa YouTube, Vimeo o Loom.' };
    videoUrl = v.url;
  }

  const menciones = sanearMenciones(`${titulo}\n${cuerpo}`, b.menciones, ctx.nombreDe);

  if (ctx.soloTexto) return { ok: true, post: { titulo, cuerpo, categoriaId, videoUrl, menciones, encuesta: null, adjunto: null } };

  const e = sanearEncuesta(b.encuesta);
  if (!e.ok) return e;

  let adjunto: AdjuntoEntrada | null = null;
  if (b.adjunto != null) {
    const a = validarAdjunto(b.adjunto, ctx.ws, ctx.productoId);
    if (!a.ok) return a;
    adjunto = a.adjunto;
  }
  return { ok: true, post: { titulo, cuerpo, categoriaId, videoUrl, menciones, encuesta: e.encuesta, adjunto } };
}

/** Valida un comentario. `responderA` es el comentario al que contesta (o nada: primer nivel). */
export function validarComentario(
  raw: unknown,
  nombreDe: (clave: string) => string | null | undefined,
): { ok: true; cuerpo: string; menciones: string[]; responderA: number | null } | { ok: false; error: string } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const cuerpo = sanearTexto(b.cuerpo);
  if (!cuerpo) return { ok: false, error: 'Escribe algo.' };
  if (cuerpo.length > TOPE_COMENTARIO) return { ok: false, error: `Pasa de ${TOPE_COMENTARIO} letras.` };
  return { ok: true, cuerpo, menciones: sanearMenciones(cuerpo, b.menciones, nombreDe), responderA: idValido(b.responderA) };
}

// ── Adjuntos ──────────────────────────────────────────────────────────────────────

export const BUCKET_COMUNIDAD = 'comunidad-adjuntos';

/**
 * Lo que se puede adjuntar: imágenes (se ven en el post), PDF, documentos, planillas y
 * presentaciones. ⚠️ LA MISMA LISTA QUE EL BUCKET de la 0217, y un test compara las dos: el bucket
 * rechaza recién al terminar de subir, y la pantalla tiene que poder decir «no» antes.
 */
export const MIME_ADJUNTO: Readonly<Record<string, string>> = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/csv': 'csv',
  'text/plain': 'txt',
});

export const esMimeAdjunto = (mime: unknown): mime is string => typeof mime === 'string' && Object.prototype.hasOwnProperty.call(MIME_ADJUNTO, mime);
export const esImagen = (mime: string | null | undefined): boolean => /^image\/(png|jpeg|webp|gif)$/.test(mime ?? '');

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Dónde se sube un adjunto: `<ws>/<producto>/<uuid>.<ext>`. El nombre original NUNCA va en la ruta. */
export function pathDeAdjunto(ws: number, productoId: number, mime: string, uuid: string): string | null {
  const ext = MIME_ADJUNTO[mime];
  if (!ext || !Number.isInteger(ws) || ws <= 0 || !Number.isInteger(productoId) || productoId <= 0) return null;
  if (!new RegExp(`^${UUID}$`).test(uuid)) return null;
  return `${ws}/${productoId}/${uuid}.${ext}`;
}

/** ¿Este path es de la carpeta de ESTA comunidad? Exacto: nada de `..`, nada de otro workspace. */
export function pathEsDeLaComunidad(path: unknown, ws: number, productoId: number): boolean {
  if (typeof path !== 'string') return false;
  return new RegExp(`^${ws}/${productoId}/${UUID}\\.[a-z]{3,4}$`).test(path);
}

/** El nombre que se muestra de un adjunto: sin rutas ni caracteres de control, topeado. */
export function nombreDeAdjunto(raw: unknown): string {
  const s = sanearTexto(raw, { unaLinea: true }).replace(/[\\/]/g, '-');
  return s.slice(0, TOPE_NOMBRE_ADJUNTO) || 'archivo';
}

export function validarAdjunto(raw: unknown, ws: number, productoId: number): { ok: true; adjunto: AdjuntoEntrada } | { ok: false; error: string } {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (!pathEsDeLaComunidad(a.path, ws, productoId)) return { ok: false, error: 'Ese archivo no es de esta comunidad.' };
  if (!esMimeAdjunto(a.mime)) return { ok: false, error: 'Ese formato no va.' };
  const bytes = Number(a.bytes);
  if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, error: 'El archivo está vacío.' };
  if (bytes > TOPE_ADJUNTO_BYTES) return { ok: false, error: 'Pasa de 25 MB.' };
  // La extensión del path tiene que ser la del tipo: un PNG declarado con un path `.pdf` no se sirve.
  if (!(a.path as string).endsWith(`.${MIME_ADJUNTO[a.mime]}`)) return { ok: false, error: 'Ese archivo no es de esta comunidad.' };
  return { ok: true, adjunto: { path: a.path as string, nombre: nombreDeAdjunto(a.nombre), mime: a.mime, bytes: Math.floor(bytes) } };
}

// ── Categorías ────────────────────────────────────────────────────────────────────

export type OrdenFeed = 'default' | 'nuevos' | 'top_semana' | 'top_mes';
export const ORDENES_FEED: readonly OrdenFeed[] = ['default', 'nuevos', 'top_semana', 'top_mes'];
/** Lo que dice el selector de orden. «Default» de Skool = por actividad reciente. */
export const ROTULO_ORDEN: Readonly<Record<OrdenFeed, string>> = {
  default: 'Recientes', nuevos: 'Nuevos', top_semana: 'Top semana', top_mes: 'Top mes',
};
export const esOrden = (x: unknown): x is OrdenFeed => typeof x === 'string' && (ORDENES_FEED as readonly string[]).includes(x);

export type CategoriaLimpia = { nombre: string; permiso: PermisoCategoria; ordenDefault: OrdenFeed };

/**
 * Valida una categoría: nombre de 1 a 30 letras, que no repita el de otra (sin mayúsculas ni
 * acentos de diferencia), permiso «todos» o «equipo», y su orden por defecto. Hasta 10 por
 * comunidad (`existentes` son TODAS las de la comunidad; `editandoId` la que se está cambiando).
 */
export function validarCategoria(
  raw: unknown,
  existentes: ReadonlyArray<{ id: number; nombre: string }>,
  editandoId: number | null = null,
): { ok: true; categoria: CategoriaLimpia } | { ok: false; error: string } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const nombre = sanearTexto(b.nombre, { unaLinea: true });
  if (!nombre) return { ok: false, error: 'Falta el nombre.' };
  if (nombre.length > TOPE_CATEGORIA) return { ok: false, error: `Hasta ${TOPE_CATEGORIA} letras.` };
  const sinTildes = (s: string) => norm(s).normalize('NFD').replace(/\p{M}/gu, '');
  if (existentes.some((c) => c.id !== editandoId && sinTildes(c.nombre) === sinTildes(nombre))) return { ok: false, error: 'Ya hay una con ese nombre.' };
  if (editandoId == null && existentes.length >= MAX_CATEGORIAS) return { ok: false, error: `Hasta ${MAX_CATEGORIAS} categorías.` };
  const permiso: PermisoCategoria = b.permiso === 'equipo' ? 'equipo' : 'todos';
  const ordenDefault: OrdenFeed = esOrden(b.ordenDefault) ? b.ordenDefault : 'default';
  return { ok: true, categoria: { nombre, permiso, ordenDefault } };
}

// ── El orden del feed ─────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;

/**
 * Qué consulta arma cada orden:
 *   · `default` → por ACTIVIDAD reciente (el post o su último comentario), como «Default» de Skool.
 *   · `nuevos`  → por fecha de publicación.
 *   · `top_semana` / `top_mes` → los publicados en los últimos 7 / 30 días, por likes.
 * `desde` es el corte de los top (ISO), `null` en los otros dos.
 */
export function consultaDeOrden(orden: OrdenFeed, ahoraMs: number): { columna: 'actividad_at' | 'created_at'; desde: string | null; porLikes: boolean } {
  if (orden === 'top_semana' || orden === 'top_mes') {
    return { columna: 'created_at', desde: new Date(ahoraMs - (orden === 'top_semana' ? 7 : 30) * DIA_MS).toISOString(), porLikes: true };
  }
  return { columna: orden === 'nuevos' ? 'created_at' : 'actividad_at', desde: null, porLikes: false };
}

/** El orden de los top: más likes primero; a igualdad, el más nuevo. */
export function ordenarPorLikes<T extends { id: number; likes: number; creado: string }>(posts: readonly T[]): T[] {
  return posts.slice().sort((a, b) => b.likes - a.likes || (a.creado < b.creado ? 1 : a.creado > b.creado ? -1 : b.id - a.id));
}

// ── Puntos y ranking ──────────────────────────────────────────────────────────────

/** Un like, como lo cuentan los puntos: a quién le dio el punto y cuándo. */
export type LikeContado = { autor: string; creado: string };

/**
 * Los puntos de cada miembro: 1 por cada like RECIBIDO (en posts, comentarios y respuestas). Con
 * `desdeMs`, sólo los likes desde ese momento (las tablas de 7 y 30 días).
 *
 * ⚠️ SE CUENTAN FILAS, NO SE SUMA UN CONTADOR: sacar el like borra la fila y el punto se va solo. Un
 *    contador que suma al dar y resta al sacar se desincroniza con el primer pedido que falla a la
 *    mitad, y nadie lo ve (AGENTS.md: si el estado se puede CALCULAR, calcularlo le gana a dispararlo).
 */
export function puntosPorMiembro(likes: Iterable<LikeContado>, desdeMs?: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of likes) {
    if (desdeMs != null) {
      const t = Date.parse(l.creado);
      if (!Number.isFinite(t) || t < desdeMs) continue;
    }
    out.set(l.autor, (out.get(l.autor) ?? 0) + 1);
  }
  return out;
}

export type FilaRankingRegla = { clave: string; puntos: number; puesto: number };

/**
 * La tabla del ranking: los que sumaron algo, de más a menos, hasta `tope`. A igualdad de puntos
 * comparten el puesto (1, 1, 3). ⚠️ EL EQUIPO NO APARECE (como en Skool: owners y admins no están en el
 * leaderboard), y tampoco quien no es miembro HOY (`esMiembro`): un alumno al que le cortaron el acceso
 * no sigue figurando con los likes de antes.
 */
export function tablaDeRanking(
  puntos: ReadonlyMap<string, number>,
  esMiembro: (clave: string) => boolean,
  tope = 10,
): FilaRankingRegla[] {
  const filas = [...puntos.entries()]
    .filter(([k, p]) => p > 0 && !esClaveDeEquipo(k) && esMiembro(k))
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const out: FilaRankingRegla[] = [];
  for (let i = 0; i < filas.length && out.length < tope; i++) {
    const [clave, p] = filas[i];
    const puesto = i > 0 && filas[i - 1][1] === p ? out[out.length - 1].puesto : i + 1;
    out.push({ clave, puntos: p, puesto });
  }
  return out;
}

// ── El tiempo ─────────────────────────────────────────────────────────────────────

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «Hace cuánto», corto como en Skool: `ahora`, `5 min`, `3 h`, `2 d`, `12 sep`, `12 sep 2025`. */
export function haceCuanto(iso: string | null | undefined, ahoraMs: number): string {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.floor((ahoraMs - t) / 1000));
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d`;
  const d = new Date(t);
  const a = new Date(ahoraMs);
  const base = `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === a.getUTCFullYear() ? base : `${base} ${d.getUTCFullYear()}`;
}

/** ¿Está en línea? Alguna actividad en los últimos 5 minutos. */
export function enLinea(ultimaActividad: string | null | undefined, ahoraMs: number): boolean {
  const t = Date.parse(ultimaActividad ?? '');
  return Number.isFinite(t) && ahoraMs - t <= EN_LINEA_MS && t - ahoraMs < 60_000;
}

// ── La cara de un miembro ─────────────────────────────────────────────────────────

const esHttps = (s: unknown): s is string => typeof s === 'string' && /^https:\/\/\S+$/i.test(s.trim());

/**
 * La foto de un ALUMNO, de su lead: la que eligió una persona (`avatar_url`, o un `icono` que sea una
 * URL) gana; después la copia de su foto de WhatsApp (`foto_auto_url`, mig 0195); si no, `null` y van
 * las iniciales. Es el mismo orden que la ficha (lib/contacto-lead.ts, `candidatasDeFoto`), sin la
 * foto en vivo de WhatsApp: esa la pide el navegador del EQUIPO con su sesión, y un alumno no la tiene.
 */
export function fotoDeLead(l: { avatar_url?: string | null; icono?: string | null; foto_auto_url?: string | null } | null | undefined): string | null {
  if (!l) return null;
  if (esHttps(l.avatar_url)) return l.avatar_url.trim();
  if (esHttps(l.icono)) return l.icono.trim();
  if (esHttps(l.foto_auto_url)) return l.foto_auto_url.trim();
  return null;
}

// ── El perfil ─────────────────────────────────────────────────────────────────────

export const REDES = ['web', 'instagram', 'youtube', 'facebook', 'x', 'linkedin'] as const;
export type Red = (typeof REDES)[number];
export const ROTULO_RED: Readonly<Record<Red, string>> = {
  web: 'Web', instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook', x: 'X', linkedin: 'LinkedIn',
};

export type PerfilLimpio = { bio: string; links: Partial<Record<Red, string>>; ubicacion: string };

/**
 * Valida el perfil que edita un miembro: bio de hasta 300 letras, links (web y redes) que sean
 * direcciones http/https, y una ubicación corta. Un link vacío se borra; uno que no es una dirección
 * no se guarda «como venga»: rebota con el nombre de la red.
 */
export function sanearPerfil(raw: unknown): { ok: true; perfil: PerfilLimpio } | { ok: false; error: string } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bio = sanearTexto(b.bio);
  if (bio.length > TOPE_BIO) return { ok: false, error: `La bio pasa de ${TOPE_BIO} letras.` };
  const ubicacion = sanearTexto(b.ubicacion, { unaLinea: true });
  if (ubicacion.length > TOPE_UBICACION) return { ok: false, error: 'La ubicación es muy larga.' };
  const crudos = (b.links && typeof b.links === 'object' ? b.links : {}) as Record<string, unknown>;
  const links: Partial<Record<Red, string>> = {};
  for (const red of REDES) {
    const v = typeof crudos[red] === 'string' ? (crudos[red] as string).trim() : '';
    if (!v) continue;
    const conProtocolo = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    let url: URL | null = null;
    try { url = new URL(conProtocolo); } catch { url = null; }
    if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname.includes('.') || conProtocolo.length > TOPE_LINK) {
      return { ok: false, error: `El link de ${ROTULO_RED[red]} no es una dirección.` };
    }
    links[red] = url.toString();
  }
  return { ok: true, perfil: { bio, links, ubicacion } };
}

/** Los links de un perfil leído de la base: sólo las redes conocidas y sólo http/https. */
export function linksGuardados(raw: unknown): Partial<Record<Red, string>> {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Partial<Record<Red, string>> = {};
  for (const red of REDES) {
    const v = b[red];
    if (typeof v === 'string' && /^https?:\/\/\S+$/i.test(v)) out[red] = v;
  }
  return out;
}

// ── Qué abre cada nivel ───────────────────────────────────────────────────────────

/**
 * Lo que abre cada nivel (la columna «Unlock» del leaderboard de Skool): los módulos y las clases del
 * curso con bloqueo por nivel (`{ tipo: 'nivel', nivel }`, el contrato `Bloqueo` de
 * lib/curso-bloqueo.ts, mig 0220). Devuelve nivel → nombres, en el orden en que llegan.
 *
 * ⚠️ LEE LA FORMA, NO IMPORTA EL TIPO: el bloqueo es de otra pista y todavía puede no existir. Un
 *    bloqueo que no es por nivel, o un nivel fuera de 1-9, no abre nada acá.
 */
export function aperturasPorNivel(items: ReadonlyArray<{ nombre: string; bloqueo: unknown }>): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const it of items) {
    const b = it.bloqueo as { tipo?: unknown; nivel?: unknown } | null;
    if (!b || b.tipo !== 'nivel') continue;
    const n = Number(b.nivel);
    if (!Number.isInteger(n) || n < 1 || n > 9) continue;
    const nombre = (it.nombre ?? '').trim();
    if (!nombre) continue;
    (out[n] ??= []).push(nombre);
  }
  return out;
}

// ── Buscar miembros ───────────────────────────────────────────────────────────────

/** ¿El nombre contiene lo buscado? Sin mayúsculas ni acentos: «jose» encuentra a «José». */
export function nombreCoincide(nombre: string, q: string): boolean {
  const f = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();
  const b = f(q);
  return !b || f(nombre).includes(b);
}
