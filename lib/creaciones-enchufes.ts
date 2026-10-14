// =============================================================================
// creaciones-enchufes — lo que cada TIPO de creación sabe hacer: exportarse, validarse y usarse
// =============================================================================
// El mecanismo de las estrellas (lib/creaciones.ts) es UNO; lo que cambia por tipo vive acá, en un enchufe por tipo.
// Para sumar un tipo (el contrato que se les pasó a «Graphics» y «Content Machine»):
//   1. Sacarlo de `POR_ENCHUFAR` y sumarlo a `ENCHUFADOS` (lib/creaciones-reglas.ts). El compilador pide el enchufe.
//   2. Escribir su enchufe acá, con sus cuatro funciones:
//      · `opciones()`: lo que ESTE negocio puede publicar de ese tipo (id y nombre), para el modal de publicar.
//      · `exportar(origenId)`: la DEFINICIÓN de una cosa del negocio, sin sus datos (los ids, las personas, las
//        cuentas). Corre en el workspace de quien publica (`getTenantDb`). Tira si no existe.
//      · `resumir(def)`: nombre y una línea (cuántas tarjetas, cuántos bloques). null = la definición no sirve.
//      · `usar(def)`: crea la cosa en el negocio de quien la usa, APAGADA o en borrador, y dice a qué ruta ir.
//   3. Poner el botón «Publicar» de su pantalla: `<PublicarCreacion tipo origenId nombre />` (app/creaciones).
// Nada más: la tabla, las estrellas, la galería y la API ya son de todos.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { crearDesdeCopia } from './flujo-copia-negocio';
import { disparadoresDeSecuencia } from './disparadores-canales';
import { audiosDe, copiaDeFlujo, type CronCopiado, type PasoCopiado } from './flujo-copia';
import { definicionPublicable, leerDefinicionAutomatizacion, resumenAutomatizacion } from './creaciones-automatizacion';
import type { Posiciones } from './lienzo-posiciones';
import type { TipoEnchufado } from './creaciones-reglas';

export type Usada = { id: number | string; nombre: string; aviso: string | null; ruta: string };

export type Enchufe = {
  opciones: () => Promise<Array<{ id: number; nombre: string }>>;
  exportar: (origenId: number) => Promise<{ definicion: unknown; nombre: string }>;
  resumir: (def: unknown) => { nombre: string; detalle: string } | null;
  usar: (def: unknown) => Promise<Usada>;
};

// ── automatizacion (Automations) ─────────────────────────────────────────────

type FilaSecuencia = { id: number; nombre: string | null; emoji: string | null; pasos: unknown; posiciones?: unknown; archivada_at: string | null };

const automatizacion: Enchufe = {
  async opciones() {
    const db = await getTenantDb();
    const { data, error } = await db.from('nutricion_secuencias').select('id, nombre').is('archivada_at', null).order('id', { ascending: true });
    if (error) throw new Error(`opciones de automatizaciones: ${error.message}`);
    return ((data ?? []) as Array<{ id: number; nombre: string | null }>).map((r) => ({ id: r.id, nombre: r.nombre?.trim() || `Automatización #${r.id}` }));
  },

  async exportar(origenId) {
    const db = await getTenantDb();
    const { data, error } = await db.from('nutricion_secuencias').select('id, nombre, emoji, pasos, posiciones, archivada_at').eq('id', origenId).maybeSingle();
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

/** Lo que se pidió no existe (o no sirve) en el negocio: un 404 legible, no un 500. */
export class NoExisteError extends Error {
  constructor(m: string) { super(m); this.name = 'NoExisteError'; }
}

export const ENCHUFES: Record<TipoEnchufado, Enchufe> = { automatizacion };
