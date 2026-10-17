// =============================================================================
// api-mako / comunidad — lo puro del área (con test): sin `server-only`
// =============================================================================
// Tres familias, las tres ejecutadas por tests/api-mako-comunidad-acciones.test.ts:
//   · QUIÉN FIRMA: la persona del equipo con cuyo nombre sale lo que se publica por la API.
//   · LA MEZCLA: los PATCH de la comunidad (`editarPost`, `guardarAbout`, `guardarEvento`, `guardarPerfil`,
//     `guardarCategoria`, `guardarNombresNivel`) revalidan el objeto ENTERO; lo que no viene en el pedido
//     sale de lo que hay, y `-` es «vaciar» (un "" lo descarta el validador como «no vino»).
//   · LO QUE SALE: las vistas de lib/comunidad-tipos.ts sin lo que es de QUIEN MIRA (meGusta, puedo*) y sin
//     las URLs firmadas de los adjuntos: ninguna lectura del registro devuelve un link firmado.
// =============================================================================

import type { Ctx } from '../tipos';
import type { PostVista, PostDetalle, ComentarioVista } from '@/lib/comunidad-tipos';
import { claveDeUsuario, REDES } from '@/lib/comunidad-reglas';
import { NIVEL_MAX, TOPE_NOMBRE_NIVEL } from '@/lib/comunidad-niveles';

// ── Quién firma ───────────────────────────────────────────────────────────────────

/**
 * La clave del actor NEUTRAL con que la API lee, modera y configura: no es `u:N` ni `l:N`, así que
 * `leerClave` la rechaza. Con eso `marcarActividad` no anota a nadie «en línea», `contarPuntos` da 0,
 * `infoDeMiembros` la ignora, y si una escritura la llegara a guardar como autor, el CHECK de la 0217
 * (`^(u|l):N`) la rebota. Lo que se PUBLICA (un post, un comentario, un like, un voto) nunca sale con
 * esta clave: sale firmado por una persona del equipo (`firmaDelEquipo`) o no sale.
 */
export const CLAVE_API = 'api:mako';

/** El valor que VACÍA un campo opcional por la API: el validador descarta "" como «no vino». */
export const VACIAR = '-';

/** Lo que mira `personaDe`: el Ctx de hoy, más `persona` (que el registro todavía no declara). */
export type CtxPersona = Pick<Ctx, 'bandeja' | 'actor'> & { persona?: string };

/**
 * El email de la persona del equipo que firma lo que se escribe, o `null` si este pedido no trae a nadie.
 *
 *   · `ctx.persona`: quien creó el token detallado (cuando el registro lo pase en el Ctx).
 *   · la BANDEJA de la app (/mako/pendientes y /mako/revisar/<id>): `ctx.actor` es el email de la sesión
 *     que confirma (app/mako/ctx-bandeja.ts).
 *
 * ⚠️ NUNCA `ctx.actor` FUERA DE LA BANDEJA: por HTTP es «API · token «x»», y en WhatsApp es otra cosa. Un
 *    actor que no es un email no firma nada.
 */
export function personaDe(ctx: CtxPersona): string | null {
  const p = typeof ctx.persona === 'string' ? ctx.persona.trim() : '';
  if (p.includes('@')) return p.toLowerCase();
  const a = typeof ctx.actor === 'string' ? ctx.actor.trim() : '';
  if (ctx.bandeja && a.includes('@')) return a.toLowerCase();
  return null;
}

/** La fila de `usuarios` que hace falta para decidir si firma (lib/usuarios.ts, `Usuario`). */
export type UsuarioFirma = {
  id: number; email: string; nombre: string | null; estado: string; workspace_id: number | null; rol: string;
};

/**
 * ¿Esta cuenta firma en la comunidad de ESTE negocio? Con qué clave y qué nombre, o `null`.
 *
 * En POSITIVO: firma una cuenta NO suspendida que es del workspace, o un admin de la plataforma (el
 * super admin publica en la comunidad de un cliente igual que desde la tab: `infoDeMiembros` lo prevé).
 * Una cuenta de otro negocio no firma acá, aunque sea admin del suyo. El nombre sale como en
 * app/customer-success/comunidad/actor.ts: el de la cuenta, o la parte de antes de la arroba.
 */
export function firmaDelEquipo(u: UsuarioFirma | null, ws: number): { clave: string; nombre: string } | null {
  if (!u) return null;
  const id = Number(u.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (u.estado === 'suspendido') return null;
  const delNegocio = u.workspace_id != null && Number(u.workspace_id) === ws;
  const dePlataforma = u.rol === 'admin';
  if (!delNegocio && !dePlataforma) return null;
  const nombre = (u.nombre ?? '').trim() || String(u.email ?? '').split('@')[0] || 'Equipo';
  return { clave: claveDeUsuario(id), nombre };
}

/**
 * El nombre que queda ESCRITO como «quién» en lo que no se firma (`por` de un baneo, `creado_por` de un
 * evento, `actualizado_por` de los ajustes): la persona si se sabe; si no, el actor del canal mientras no
 * sea un email (esas columnas las lee el equipo y un email ahí es un dato que no se pidió mostrar).
 */
export function nombreDeQuien(firma: { nombre: string } | null, ctx: CtxPersona): string {
  if (firma) return firma.nombre;
  const a = typeof ctx.actor === 'string' ? ctx.actor.trim() : '';
  return a && !a.includes('@') ? a.slice(0, 80) : 'API de MaKo';
}

// ── La mezcla de los PATCH ────────────────────────────────────────────────────────

/** Lo que queda de un campo de texto: lo pedido; `''` si se pidió vaciar con `-`; lo actual si no vino. */
export function textoMezclado(pedido: unknown, actual: string): string {
  if (typeof pedido !== 'string') return actual;
  return pedido.trim() === VACIAR ? '' : pedido;
}

/**
 * El orden pedido de las categorías: la lista ENTERA de ids (como textos, `["3","1"]`), cada una una vez.
 * `yaEstaba` si es el orden de hoy. Lo de más o lo que falta se nombra.
 */
export function ordenPedido(actuales: readonly number[], pedidos: readonly string[]):
  { ids: number[] } | { error: string; yaEstaba?: true } {
  const ids = pedidos.map((s) => (/^\d{1,15}$/.test(s.trim()) ? Number(s.trim()) : NaN));
  const faltan = actuales.filter((x) => !ids.includes(x));
  const sobran = pedidos.filter((_, i) => !actuales.includes(ids[i]));
  const repetidos = new Set(ids).size !== ids.length;
  if (faltan.length || sobran.length || repetidos) {
    const detalle = [faltan.length && ` Faltan: ${faltan.join(', ')}.`, sobran.length && ` No existen: ${sobran.join(', ')}.`, repetidos && ' Hay ids repetidos.']
      .filter(Boolean).join('');
    return { error: `Pasa TODAS las categorías, una vez cada una.${detalle}` };
  }
  if (ids.every((x, i) => x === actuales[i])) return { error: 'Las categorías ya están en ese orden.', yaEstaba: true };
  return { ids };
}

/**
 * Los 9 nombres de nivel después de los cambios pedidos (`{ nivel, nombre }`, `-` = «Nivel N»). Va por
 * nivel y no por posición: una lista posicional de 9 con un "" adentro la acorta el validador y corre
 * los nombres de lugar. El largo se FRENA acá con el mismo tope que la pantalla: `sanearNombresNivel`
 * recorta en silencio y un nombre cortado a la mitad no lo pidió nadie.
 */
export function nombresDeNivel(actuales: readonly string[], cambios: ReadonlyArray<{ nivel?: unknown; nombre?: unknown }>):
  { nombres: string[]; cambiados: number[] } | { error: string } {
  const nombres = Array.from({ length: NIVEL_MAX }, (_, i) => (typeof actuales[i] === 'string' ? actuales[i] : ''));
  const vistos = new Set<number>();
  const cambiados: number[] = [];
  for (const c of cambios) {
    const nivel = Number(c.nivel);
    if (!Number.isInteger(nivel) || nivel < 1 || nivel > NIVEL_MAX) return { error: `El nivel va del 1 al ${NIVEL_MAX}.` };
    if (vistos.has(nivel)) return { error: `El nivel ${nivel} viene dos veces.` };
    vistos.add(nivel);
    const crudo = typeof c.nombre === 'string' ? c.nombre.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const nombre = crudo === VACIAR ? '' : crudo;
    if (!crudo) return { error: `Falta el nombre del nivel ${nivel} (usa «${VACIAR}» para volver a «Nivel ${nivel}»).` };
    if (nombre.length > TOPE_NOMBRE_NIVEL) return { error: `El nombre del nivel ${nivel} pasa de ${TOPE_NOMBRE_NIVEL} letras.` };
    if (nombres[nivel - 1] !== nombre) cambiados.push(nivel);
    nombres[nivel - 1] = nombre;
  }
  return { nombres, cambiados };
}

/** Lo que `eventoParaEditar` (lib/comunidad-calendario.ts) devuelve y la mezcla necesita. */
export type EventoBase = {
  titulo: string; descripcion: string; zona: string; duracionMin: number;
  local: { fecha: string; hora: string };
  lugarTipo: 'link' | 'direccion'; lugar: string; portada: string | null;
  acceso: unknown; recurrencia: unknown;
  /** Una serie de verdad (no un evento suelto ni una ocurrencia movida). */
  serie: boolean;
};

const texto = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/**
 * El evento ENTERO que se le pasa a `guardarEvento` al editar: lo pedido encima de lo que hay.
 *
 * ⚠️ LA FECHA POR DEFECTO DE UNA SERIE ES LA DE LA OCURRENCIA ELEGIDA, NUNCA EL INICIO DE LA SERIE. Con el
 *    alcance «todos», `guardarEvento` corre la serie entera `diasEntre(ocurrencia, fecha)` días: rellenar
 *    `fecha` con el inicio y pasar una ocurrencia posterior movería TODAS las fechas para atrás sin error.
 *    Sin ocurrencia (o en un evento suelto), la fecha de hoy del evento.
 * ⚠️ `acceso` y `recurrencia` REEMPLAZAN entero lo que había (no se mezclan campo por campo): una regla a
 *    medias es más difícil de leer que una completa. `recurrencia.frecuencia: "nunca"` deja de repetir.
 */
export function eventoMezclado(base: EventoBase, input: Record<string, unknown>): Record<string, unknown> {
  const ocurrencia = texto(input.ocurrencia);
  const fecha = texto(input.fecha) ?? (base.serie && ocurrencia ? ocurrencia : base.local.fecha);
  const portada = texto(input.portada);
  return {
    titulo: texto(input.titulo) ?? base.titulo,
    descripcion: textoMezclado(input.descripcion, base.descripcion),
    fecha,
    hora: texto(input.hora) ?? base.local.hora,
    zona: texto(input.zona) ?? base.zona,
    duracionMin: typeof input.duracionMin === 'number' ? input.duracionMin : base.duracionMin,
    lugarTipo: input.lugarTipo === 'link' || input.lugarTipo === 'direccion' ? input.lugarTipo : base.lugarTipo,
    lugar: textoMezclado(input.lugar, base.lugar),
    portada: portada === undefined ? base.portada : portada.trim() === VACIAR ? null : portada,
    acceso: input.acceso && typeof input.acceso === 'object' ? input.acceso : (base.acceso ?? { tipo: 'todos' }),
    recurrencia: input.recurrencia && typeof input.recurrencia === 'object' ? input.recurrencia : (base.recurrencia ?? null),
  };
}

/** El perfil que hay (lib/comunidad-tipos.ts, `PerfilVista`): lo que `guardarPerfil` reescribe entero. */
export type PerfilBase = { bio: string; ubicacion: string; links: Partial<Record<string, string>> };

/**
 * El perfil ENTERO que se le pasa a `guardarPerfil`: lo pedido encima de lo que hay. Un link que no viene
 * queda; uno con `-` se saca. `sanearPerfil` valida el resultado (las direcciones, los topes).
 */
export function perfilMezclado(actual: PerfilBase, input: Record<string, unknown>): { bio: string; ubicacion: string; links: Record<string, string> } {
  const links: Record<string, string> = {};
  for (const red of REDES) {
    const v = actual.links[red];
    if (typeof v === 'string' && v) links[red] = v;
  }
  const pedidos = (input.links && typeof input.links === 'object' ? input.links : {}) as Record<string, unknown>;
  for (const red of REDES) {
    const v = pedidos[red];
    if (typeof v !== 'string') continue;
    if (v.trim() === VACIAR) delete links[red];
    else links[red] = v;
  }
  return { bio: textoMezclado(input.bio, actual.bio), ubicacion: textoMezclado(input.ubicacion, actual.ubicacion), links };
}

/**
 * Un día o un instante que llega como texto (`YYYY-MM-DD` = a las 00:00 UTC, o ISO) → ms.
 * `undefined` = no vino; `null` = vino y no es una fecha (se rechaza, no se ignora).
 */
export function msDeFecha(v: unknown): number | null | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T00:00:00Z`) : Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

// ── Lo que sale ───────────────────────────────────────────────────────────────────

/** Un adjunto sin su URL firmada. */
const adjuntoSinUrl = (a: PostVista['adjunto']) => (a ? { nombre: a.nombre, mime: a.mime, bytes: a.bytes, imagen: a.imagen } : null);

/** Una tarjeta del feed como sale por la API: sin URL firmada y sin lo de quien mira. */
export function postPublico(p: PostVista) {
  return {
    id: p.id, titulo: p.titulo, extracto: p.extracto, autor: p.autor, categoriaId: p.categoriaId,
    creado: p.creado, editado: p.editado, fijado: p.fijado, likes: p.likes, comentarios: p.comentarios,
    cerrado: p.cerrado, video: p.video ? { proveedor: p.video.proveedor, url: p.video.url } : null,
    adjunto: adjuntoSinUrl(p.adjunto),
    encuesta: p.encuesta ? { opciones: p.encuesta.opciones, total: p.encuesta.total } : null,
  };
}

/** Un comentario (y sus respuestas) como sale por la API. */
export function comentarioPublico(c: ComentarioVista): {
  id: number; padreId: number | null; autor: ComentarioVista['autor']; texto: string; creado: string;
  editado: boolean; likes: number; respuestas: ReturnType<typeof comentarioPublico>[];
} {
  return {
    id: c.id, padreId: c.padreId, autor: c.autor, texto: c.texto, creado: c.creado, editado: c.editado,
    likes: c.likes, respuestas: c.respuestas.map(comentarioPublico),
  };
}

/** El post abierto como sale por la API: el texto entero, a quién menciona y el hilo. */
export function detallePublico(d: PostDetalle) {
  return { ...postPublico(d), texto: d.texto, menciones: d.menciones, hilo: d.hilo.map(comentarioPublico) };
}

/** Un comentario de un hilo, buscado en los dos niveles. */
export function comentarioEn(hilo: readonly ComentarioVista[], id: number): ComentarioVista | null {
  for (const c of hilo) {
    if (c.id === id) return c;
    const r = c.respuestas.find((x) => x.id === id);
    if (r) return r;
  }
  return null;
}
