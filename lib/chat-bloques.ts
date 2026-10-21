// =============================================================================
// El marco de bloques del chat con MaKo (20/10/2026, ola 1 de «Ops Center = lo principal», pieza 1.7)
// =============================================================================
// docs/ops-center-principal.md §2.4. Un bloque es lo que el chat DIBUJA además del texto: lo creado con su miniatura,
// el antes y el después, un trabajo largo con sus pasos, una pregunta con opciones. Puro (sin React, sin server): lo
// importan el server (el turno, la tarjeta), la pantalla de la computadora y la del teléfono.
//
// El contrato:
//   · una operación lo devuelve en `datos.bloque` de su `Ejecutado` (lib/api-mako/tipos.ts);
//   · al confirmar la tarjeta, `confirmarDesdeTarjeta` (lib/mako-turno-app.ts) lo sanea, lo guarda con el «Hecho: …» en
//     `chart_chats.bloques` (mig 0305) como `{ k: 'bloque', b }`, y lo devuelve en `ResultadoTarjeta.bloques`;
//   · una LECTURA lo devuelve en el `bloque` de su salida (`SalidaLectura`), y una PROPUESTA de pantalla en `extra.bloque`
//     (el antes y el después del Video Editor): `ejecutarOperacion` lo sanea y lo pasa por `ctx.aDibujar`, que sólo pone el
//     turno de la app, y el turno lo guarda con la respuesta de MaKo. El modelo NO lo ve, y en WhatsApp o por HTTP se
//     descarta (el camino de Pagos, 20/10/2026, la 2.27; las propuestas, 21/10). Uno por herramienta: una lista va en UN
//     bloque. Como mucho `MAX_BLOQUES_MENSAJE` por mensaje;
//   · la pantalla lo suma al hilo como `{ k: 'bloque' }` de `ItemHilo` (app/m/mako/chat-ui.ts) SIN recargar, y al
//     recargar vuelve desde el mensaje guardado;
//   · lo dibuja UNA pieza para las dos pantallas: app/_chat/BloqueHilo.tsx.
//
// Los genéricos de esta pieza (los otros, G2 y G7 a G18, los suma cada área sobre este mismo contrato):
//   · G1 `pregunta`: 2 a 4 opciones, la recomendada marcada, de a una (o varias);
//   · G3: NO es un bloque guardado, es la tarjeta de la acción (app/_chat/TarjetaAccion.tsx), con «No se puede
//     deshacer» en rojo pegado al botón;
//   · G4 `antes_despues`: «Original | Modificado», fila por fila;
//   · G5 `creado`: miniatura, título, estado y «Abrir en <tab>»;
//   · G6 `trabajo`: los pasos de algo largo, que termina en un G5.
//
// ⚠️ EL BLOQUE SALE DE UN CAMPO ESTRUCTURADO, NUNCA DEL TEXTO DEL MODELO, y LOS LINKS LOS ARMA EL CÓDIGO: `sanearBloque`
//    se queda sólo con rutas de la app (`/image-editor/…`), nunca con un `https://` de afuera ni un `javascript:`. Lo que
//    no calza se descarta entero: un bloque a medias no se dibuja.

import { sanearBloqueGrafico, type BloqueGrafico } from './chat-bloques-dashboard';

/** El botón que lleva a la pantalla donde vive lo creado. */
export type Abrir = { titulo: string; href: string };

export type EstadoPaso = 'listo' | 'en_curso' | 'pendiente' | 'fallo';

/** G5: lo que se creó (o se tocó), con su miniatura. Sin miniatura, un marco con la forma (`ancho` × `alto`). */
export type BloqueCreado = {
  t: 'creado';
  titulo: string;
  /** «Nuevo», «Copia», «Actualizado»: corto, en una píldora. */
  estado?: string;
  /** Una ruta de la app (`/cv/plantillas/x.webp`) o la miniatura pública que guardó el editor (Supabase Storage). */
  miniatura?: string;
  ancho?: number;
  alto?: number;
  /** Una línea debajo del título («Instagram, 1080 × 1350»). */
  nota?: string;
  abrir: Abrir;
};

export type Bloque =
  | BloqueCreado
  /** G4: lo que cambió, fila por fila. */
  | { t: 'antes_despues'; titulo: string; filas: { campo?: string; antes: string; despues: string }[]; abrir?: Abrir }
  /** G6: un trabajo largo. `listo` es el G5 en que termina (o `abrir`, si no crea algo con miniatura). `consulta`: la
   *  llave con que la pantalla pregunta cómo va (lib/chat-trabajos.ts, la 1.11). `hasta`: hasta cuándo puede seguir
   *  (ms desde 1970); pasado eso, la invocación que lo corría ya no existe y se da por cortado. */
  | { t: 'trabajo'; titulo: string; pasos: { texto: string; estado: EstadoPaso }[]; listo?: BloqueCreado; abrir?: Abrir; consulta?: string; hasta?: number }
  /** G1: una pregunta con opciones; `varias` = se puede marcar más de una. */
  | { t: 'pregunta'; pregunta: string; opciones: { titulo: string; detalle?: string }[]; recomendada?: number; varias?: boolean }
  /** G16 (y la tabla, que es un gráfico de tipo tabla): una pregunta del Dashboard, dibujada (lib/chat-bloques-dashboard.ts). */
  | BloqueGrafico;

/** Lo que se guarda en `chart_chats.bloques` al lado de los adjuntos (lib/chat-mako-bloques.ts, `k: 'adjunto'`). */
export type BloqueGuardado = { k: 'bloque'; b: Bloque };

/** Como mucho, los que lleva un mensaje. */
export const MAX_BLOQUES_MENSAJE = 4;
const MAX_FILAS = 12;
const MAX_PASOS = 10;
const ESTADOS_PASO: readonly EstadoPaso[] = ['listo', 'en_curso', 'pendiente', 'fallo'];

const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const opcional = (v: unknown, max: number): string | undefined => texto(v, max) || undefined;
const lado = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 20_000 ? v : undefined;

/**
 * ¿Es una ruta de la app? Empieza con UNA barra (`//otro.com` es otro sitio), sin `\` (algunos navegadores la leen como
 * `/`), sin espacios ni caracteres de control, y sin salir con `..`. Devuelve la ruta o null.
 */
export function rutaInterna(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length < 2 || s.length > 500) return null;
  if (!s.startsWith('/') || s.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(s)) return null;
  if (/(^|\/)\.\.(\/|$|\?|#)/.test(s.split(/[?#]/)[0] + '/')) return null;
  return s;
}

/** La miniatura: una ruta de la app, o una imagen PÚBLICA de Supabase Storage (la que guarda el editor al guardar). */
export function miniaturaValida(v: unknown): string | null {
  const interna = rutaInterna(v);
  if (interna) return interna;
  if (typeof v !== 'string' || v.length > 800) return null;
  let u: URL;
  try { u = new URL(v); } catch { return null; }
  return u.protocol === 'https:' && /\.supabase\.co$/.test(u.hostname) && u.pathname.startsWith('/storage/v1/object/public/') ? u.toString() : null;
}

function sanearAbrir(v: unknown): Abrir | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const titulo = texto(o.titulo, 60);
  const href = rutaInterna(o.href);
  return titulo && href ? { titulo, href } : null;
}

function sanearCreado(o: Record<string, unknown>): BloqueCreado | null {
  const titulo = texto(o.titulo, 120);
  const abrir = sanearAbrir(o.abrir);
  if (!titulo || !abrir) return null;
  const miniatura = miniaturaValida(o.miniatura);
  const ancho = lado(o.ancho);
  const alto = lado(o.alto);
  const estado = opcional(o.estado, 30);
  const nota = opcional(o.nota, 120);
  return {
    t: 'creado', titulo, abrir,
    ...(estado ? { estado } : {}), ...(miniatura ? { miniatura } : {}),
    ...(ancho && alto ? { ancho, alto } : {}), ...(nota ? { nota } : {}),
  };
}

/** Un bloque de lo que devolvió una operación (o de lo guardado), saneado. null = no se dibuja. Nunca tira. */
export function sanearBloque(crudo: unknown): Bloque | null {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const o = crudo as Record<string, unknown>;
  switch (o.t) {
    case 'creado':
      return sanearCreado(o);
    case 'antes_despues': {
      const titulo = texto(o.titulo, 120);
      const filas = (Array.isArray(o.filas) ? o.filas : []).slice(0, MAX_FILAS).flatMap((f) => {
        if (!f || typeof f !== 'object') return [];
        const r = f as Record<string, unknown>;
        const antes = texto(r.antes, 600);
        const despues = texto(r.despues, 600);
        const campo = opcional(r.campo, 60);
        return antes || despues ? [{ ...(campo ? { campo } : {}), antes, despues }] : [];
      });
      if (!titulo || !filas.length) return null;
      const abrir = o.abrir === undefined ? null : sanearAbrir(o.abrir);
      if (o.abrir !== undefined && !abrir) return null;
      return { t: 'antes_despues', titulo, filas, ...(abrir ? { abrir } : {}) };
    }
    case 'trabajo': {
      const titulo = texto(o.titulo, 120);
      const pasos = (Array.isArray(o.pasos) ? o.pasos : []).slice(0, MAX_PASOS).flatMap((p) => {
        if (!p || typeof p !== 'object') return [];
        const r = p as Record<string, unknown>;
        const t = texto(r.texto, 120);
        const estado = ESTADOS_PASO.includes(r.estado as EstadoPaso) ? (r.estado as EstadoPaso) : null;
        return t && estado ? [{ texto: t, estado }] : [];
      });
      if (!titulo || !pasos.length) return null;
      const listo = o.listo && typeof o.listo === 'object' ? sanearCreado(o.listo as Record<string, unknown>) : null;
      const abrir = o.abrir === undefined ? null : sanearAbrir(o.abrir);
      const consulta = typeof o.consulta === 'string' && /^[1-9][0-9]{0,14}\.[A-Za-z0-9_-]{8,40}$/.test(o.consulta) ? o.consulta : null;
      const hasta = typeof o.hasta === 'number' && Number.isFinite(o.hasta) && o.hasta > 0 ? Math.round(o.hasta) : null;
      return { t: 'trabajo', titulo, pasos, ...(listo ? { listo } : {}), ...(abrir ? { abrir } : {}), ...(consulta ? { consulta } : {}), ...(hasta ? { hasta } : {}) };
    }
    case 'pregunta': {
      const pregunta = texto(o.pregunta, 300);
      const opciones = (Array.isArray(o.opciones) ? o.opciones : []).slice(0, 4).flatMap((x) => {
        if (!x || typeof x !== 'object') return [];
        const r = x as Record<string, unknown>;
        const titulo = texto(r.titulo, 80);
        const detalle = opcional(r.detalle, 200);
        return titulo ? [{ titulo, ...(detalle ? { detalle } : {}) }] : [];
      });
      // Una pregunta de una sola opción no es una pregunta (y dos opciones iguales, tampoco).
      if (!pregunta || opciones.length < 2 || new Set(opciones.map((x) => x.titulo.toLowerCase())).size !== opciones.length) return null;
      const rec = o.recomendada;
      const recomendada = typeof rec === 'number' && Number.isInteger(rec) && rec >= 0 && rec < opciones.length ? rec : undefined;
      return { t: 'pregunta', pregunta, opciones, ...(recomendada !== undefined ? { recomendada } : {}), ...(o.varias === true ? { varias: true } : {}) };
    }
    case 'grafico':
      // El Dashboard (chat Dashboard, 2.7): el gráfico contra el catálogo y su resultado acotado. Con el `sanearAbrir` de acá.
      return sanearBloqueGrafico(o, sanearAbrir);
    default:
      return null;
  }
}

/** El bloque que trae el resultado de una operación (`datos.bloque`), saneado. */
export const bloqueDeResultado = (datos: Record<string, unknown> | undefined): Bloque | null => sanearBloque(datos?.bloque);

/** Lo que se guarda en `chart_chats.bloques`. */
export const aGuardar = (b: Bloque): BloqueGuardado => ({ k: 'bloque', b });

/** Los bloques de un mensaje guardado (`chart_chats.bloques` crudo): sólo los `{ k: 'bloque' }`, saneados. */
export function bloquesGuardados(crudo: unknown): Bloque[] {
  if (!Array.isArray(crudo)) return [];
  const out: Bloque[] = [];
  for (const g of crudo) {
    if (out.length >= MAX_BLOQUES_MENSAJE) break;
    if (!g || typeof g !== 'object' || (g as { k?: unknown }).k !== 'bloque') continue;
    const b = sanearBloque((g as { b?: unknown }).b);
    if (b) out.push(b);
  }
  return out;
}

/** La forma del marco de la miniatura (`aspect-ratio`): la del diseño, entre 9:16 y 16:9 para que no ocupe toda la pantalla. */
export function proporcion(b: Pick<BloqueCreado, 'ancho' | 'alto'>): string {
  if (!b.ancho || !b.alto) return '4 / 3';
  const r = Math.min(16 / 9, Math.max(9 / 16, b.ancho / b.alto));
  return r === b.ancho / b.alto ? `${b.ancho} / ${b.alto}` : r > 1 ? '16 / 9' : '9 / 16';
}

/** La misma forma como número (ancho / alto), para el CSS: el alto tope del marco achica su ancho (`--r`, app/_chat/chat.css). */
export function razon(b: Pick<BloqueCreado, 'ancho' | 'alto'>): number {
  const [a, h] = proporcion(b).split(' / ').map(Number);
  return Math.round((a / h) * 1000) / 1000;
}

/** Lo que dice cada paso de un trabajo largo, para quien no ve el ícono. */
export const ROTULO_PASO: Record<EstadoPaso, string> = { listo: 'Listo', en_curso: 'En curso', pendiente: 'Falta', fallo: 'Falló' };

type Trabajo = Extract<Bloque, { t: 'trabajo' }>;
const enCurso = (t: Trabajo) => t.pasos.some((p) => p.estado === 'en_curso');

/** Hasta cuándo puede seguir un trabajo (el `hasta` de su G6): el techo de la ruta más larga que lo corre (420 s:
 *  /api/mako/chat, /api/crm/mako, /api/mako/propuesta) más un margen. Pasado eso, la invocación ya no existe. */
export const PLAZO_TRABAJO_MS = 480_000;

/** Lo que dice el hilo de un trabajo que se cortó (lib/chat-trabajos.ts): no se sabe si llegó a hacerse, y NO pide repetirlo. */
export const textoCortado = (titulo: string) => `No sé si terminó: ${titulo}. Revísalo en su pantalla antes de pedirlo de nuevo.`;

/** Cuántas veces pregunta la pantalla por un trabajo antes de rendirse (a 15 s cada una, más que el plazo del server). */
export const MAX_CONSULTAS = 60;

/**
 * Lo que la pantalla hace con una respuesta de GET ?trabajo= (la 1.11; revisión del 21/10/2026). `sigue`: volver a
 * preguntar. Terminado, `ok` dice si salió y `texto` lo que pasó («Hecho: …», «No se pudo: …»), para dibujarlo: antes
 * una falla era sólo un punto rojo. `ok: null` = no se sabe (el trabajo ya no está: un 404): se deja de preguntar.
 */
export type Consultado =
  | { sigue: true; trabajo?: Trabajo; aparte?: Bloque[] }
  | { sigue: false; trabajo?: Trabajo; aparte: Bloque[]; ok: boolean | null; texto: string | null };

export function leerConsulta(status: number, cuerpo: unknown, consulta: string): Consultado {
  if (status === 404) return { sigue: false, aparte: [], ok: null, texto: null };
  const j = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as { ok?: unknown; texto?: unknown; bloques?: unknown };
  const bloques = (j.ok === true && Array.isArray(j.bloques) ? j.bloques : []).map(sanearBloque).filter((x): x is Bloque => !!x);
  const trabajo = bloques.find((x): x is Trabajo => x.t === 'trabajo' && x.consulta === consulta);
  // Sin red, un 500 o una respuesta que no se entiende: se vuelve a preguntar.
  if (!trabajo) return { sigue: true };
  const aparte = bloques.filter((x) => x.t !== 'trabajo');
  if (enCurso(trabajo)) return { sigue: true, trabajo, aparte };
  const texto = typeof j.texto === 'string' && j.texto.trim() ? j.texto.trim().slice(0, 600) : null;
  return { sigue: false, trabajo, aparte, ok: !trabajo.pasos.some((p) => p.estado === 'fallo'), texto };
}
