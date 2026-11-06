// =============================================================================
// creaciones-enchufes — lo que cada TIPO de creación sabe hacer: exportarse, validarse y usarse
// =============================================================================
// El mecanismo de las estrellas (lib/creaciones.ts) es UNO; lo que cambia por tipo vive acá, en un enchufe por tipo.
// Para sumar un tipo (el contrato que se les pasó a «Graphics» y «Content Machine»):
//   1. Sacarlo de `POR_ENCHUFAR` y sumarlo a `ENCHUFADOS` (lib/creaciones-reglas.ts). El compilador pide el enchufe.
//   2. Escribir su enchufe acá, con sus cuatro funciones:
//      · `opciones()`: lo que ESTE negocio puede publicar de ese tipo (id y nombre), para el modal de publicar. El id
//        es TEXTO: un número para una automatización, un UUID para un anuncio.
//      · `exportar(origenId)`: la DEFINICIÓN de una cosa del negocio, sin sus datos (los ids, las personas, las
//        cuentas). Corre en el workspace de quien publica (`getTenantDb`). Tira si no existe.
//      · `resumir(def)`: nombre y una línea (cuántas tarjetas, cuántos bloques). null = la definición no sirve.
//      · `usar(def)`: crea la cosa en el negocio de quien la usa, APAGADA o en borrador, y dice a qué ruta ir.
//   3. Poner el botón «Publicar» de su pantalla: `<PublicarCreacion tipo origenId nombre />` (app/creaciones).
// Nada más: la tabla, las estrellas, la galería y la API ya son de todos.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getUsuarioActual } from './auth';
import { abrir as abrirGuion, crear as crearGuion, listar as listarGuiones } from './copywriter/server';
import { definicionDeGuion, guionParaPublico, leerDefinicionGuion, resumenGuion } from './creaciones-guion';
import { crearDiseno, leerDiseno, listarDisenos } from './image-editor/server';
import { disenoParaPublico, leerDefinicionDiseno, resumenDiseno } from './creaciones-diseno';
import { crearDesdeCopia } from './flujo-copia-negocio';
import { disparadoresDeSecuencia } from './disparadores-canales';
import { audiosDe, copiaDeFlujo, type CronCopiado, type PasoCopiado } from './flujo-copia';
import { definicionPublicable, leerDefinicionAutomatizacion, resumenAutomatizacion } from './creaciones-automatizacion';
import type { Posiciones } from './lienzo-posiciones';
import type { TipoEnchufado } from './creaciones-reglas';

export type Usada = { id: number | string; nombre: string; aviso: string | null; ruta: string };

export type Enchufe = {
  opciones: () => Promise<Array<{ id: string; nombre: string }>>;
  exportar: (origenId: string) => Promise<{ definicion: unknown; nombre: string }>;
  resumir: (def: unknown) => { nombre: string; detalle: string } | null;
  usar: (def: unknown) => Promise<Usada>;
  /**
   * Plantillas propias (6/11/2026): lo que NO es texto y es del negocio (las fotos que subió, los links de un documento),
   * fuera, ANTES de compartir con todos. Los textos los limpia el server después (`limpiarTextos`), en todos los tipos.
   * Sin esto, la definición pasa tal cual a esa limpieza.
   */
  paraPublico?: (def: unknown) => unknown;
};

// ── automatizacion (Automations) ─────────────────────────────────────────────

type FilaSecuencia = { id: number; nombre: string | null; emoji: string | null; pasos: unknown; posiciones?: unknown; archivada_at: string | null };

const automatizacion: Enchufe = {
  async opciones() {
    const db = await getTenantDb();
    const { data, error } = await db.from('nutricion_secuencias').select('id, nombre').is('archivada_at', null).order('id', { ascending: true });
    if (error) throw new Error(`opciones de automatizaciones: ${error.message}`);
    return ((data ?? []) as Array<{ id: number; nombre: string | null }>).map((r) => ({ id: String(r.id), nombre: r.nombre?.trim() || `Automatización #${r.id}` }));
  },

  async exportar(origenId) {
    const id = Number(origenId);
    if (!Number.isInteger(id) || id <= 0) throw new NoExisteError(`No existe la automatización #${origenId} en tu negocio.`);
    const db = await getTenantDb();
    const { data, error } = await db.from('nutricion_secuencias').select('id, nombre, emoji, pasos, posiciones, archivada_at').eq('id', id).maybeSingle();
    if (error) throw new Error(`exportar la automatización: ${error.message}`);
    const f = data as FilaSecuencia | null;
    if (!f || f.archivada_at) throw new NoExisteError(`No existe la automatización #${origenId} en tu negocio.`);
    // Se publica lo PUBLICADO (`pasos`), nunca el borrador: lo que se comparte es lo que anda.
    const pasos = (Array.isArray(f.pasos) ? f.pasos : []) as PasoCopiado[];
    if (!pasos.length) throw new NoExisteError('Esa automatización no tiene tarjetas publicadas.');
    const disparadores = (await disparadoresDeSecuencia(f.id)) as unknown as CronCopiado[];
    // Los guiones de sus audios: del otro lado el audio no existe, y un audio con guion pasa a texto.
    const ids = audiosDe(pasos);
    const guiones: Record<string, string> = {};
    if (ids.length) {
      const { data: auds, error: eA } = await db.from('setting_audios').select('id, transcript').in('id', ids);
      if (eA) throw new Error(`exportar los guiones: ${eA.message}`);
      for (const a of (auds ?? []) as Array<{ id: number; transcript: string | null }>) if (a.transcript?.trim()) guiones[String(a.id)] = a.transcript;
    }
    const nombre = f.nombre?.trim() || `Automatización #${f.id}`;
    const copia = copiaDeFlujo({ nombre, emoji: f.emoji, pasos, posiciones: (f.posiciones ?? null) as Posiciones | null, disparadores, guiones });
    return { definicion: definicionPublicable(copia), nombre };
  },

  resumir: resumenAutomatizacion,

  async usar(def) {
    const copia = leerDefinicionAutomatizacion(def);
    if (!copia) throw new Error('La automatización publicada no se pudo leer.');
    const r = await crearDesdeCopia(copia);
    return { id: r.id, nombre: r.nombre, aviso: r.aviso, ruta: `/automations?sec=${r.id}` };
  },
};

// ── guion (Copywriter) ───────────────────────────────────────────────────────

const guion: Enchufe = {
  async opciones() {
    const r = await listarGuiones();
    if (!r.ok) throw new Error(`opciones de guiones: ${r.error}`);
    return r.paginas.filter((p) => !p.papelera).map((p) => ({ id: p.id, nombre: p.titulo || 'Sin título' }));
  },

  async exportar(origenId) {
    const r = await abrirGuion(origenId);
    if (!r.ok) {
      if (r.status === 404) throw new NoExisteError('No existe ese guion en tu negocio.');
      throw new Error(`exportar el guion: ${r.error}`);
    }
    return { definicion: definicionDeGuion(r.pagina, r.doc), nombre: r.pagina.titulo || 'Sin título' };
  },

  resumir: resumenGuion,
  paraPublico: guionParaPublico,

  async usar(def) {
    const d = leerDefinicionGuion(def);
    if (!d) throw new Error('El guion de la plantilla no se pudo leer.');
    const r = await crearGuion({ titulo: d.titulo, tipo: d.tipo, props: d.props, contenido: d.contenido, emoji: d.emoji });
    if (!r.ok) throw new Error(r.error);
    return { id: r.pagina.id, nombre: r.pagina.titulo, aviso: null, ruta: `/copywriter/${r.pagina.id}` };
  },
};

// ── formato_imagen (los diseños del Image Editor) ────────────────────────────

async function negocioYQuien(): Promise<{ ws: number; quien: string }> {
  const [ws, yo] = await Promise.all([getWorkspaceActual(), getUsuarioActual()]);
  if (ws == null) throw new Error('Entra a un negocio primero.');
  return { ws, quien: yo?.email || yo?.sub || '' };
}

const formatoImagen: Enchufe = {
  async opciones() {
    const { ws } = await negocioYQuien();
    const r = await listarDisenos(ws);
    if (!r.ok) throw new Error(`opciones de diseños: ${r.error}`);
    return r.disenos.map((d) => ({ id: d.id, nombre: d.titulo || 'Diseño' }));
  },

  async exportar(origenId) {
    const { ws } = await negocioYQuien();
    const r = await leerDiseno(ws, origenId);
    if (!r.ok) {
      if (r.status === 404) throw new NoExisteError('No existe ese diseño en tu negocio.');
      throw new Error(`exportar el diseño: ${r.error}`);
    }
    const nombre = r.diseno.titulo || 'Diseño';
    return { definicion: { v: 1, titulo: nombre, doc: r.diseno.doc }, nombre };
  },

  resumir: resumenDiseno,
  paraPublico: disenoParaPublico,

  async usar(def) {
    const d = leerDefinicionDiseno(def);
    if (!d) throw new Error('El diseño de la plantilla no se pudo leer.');
    const { ws, quien } = await negocioYQuien();
    const r = await crearDiseno(ws, quien, { titulo: d.titulo, doc: d.doc });
    if (!r.ok) throw new Error(r.error);
    return { id: r.id, nombre: d.titulo, aviso: null, ruta: `/image-editor/${r.id}` };
  },
};

/** Lo que se pidió no existe (o no sirve) en el negocio: un 404 legible, no un 500. */
export class NoExisteError extends Error {
  constructor(m: string) { super(m); this.name = 'NoExisteError'; }
}

export const ENCHUFES: Record<TipoEnchufado, Enchufe> = { automatizacion, guion, formato_imagen: formatoImagen };
