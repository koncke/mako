'use server';

// =============================================================================
// Las actions de la pantalla de Competitor Spy
// =============================================================================
// Todo lo que toca la base vive en lib/spy.ts. Acá sólo está el guard y lo que viaja al navegador.
//
// ⚠️ El guard se escribe EN ESTE ARCHIVO y no se importa de otro `use server`: exportar un guard
// desde un archivo 'use server' lo convierte en una server action llamable desde el navegador, o
// sea publicar el chequeo de permisos como endpoint.
//
// ⚠️ El `id` de un competidor NO es un secreto y no hace falta que lo sea: `getTenantDb()` le
// inyecta el `workspace_id` a cada consulta, así que el id de otro negocio simplemente no existe
// para estas lecturas y devuelve «no encontré».

import {
  agregarCompetidor, etapaDePieza, guardarAnuncioPegado, leerCompetidor,
  listarCompetidores, listarPiezas, mirarCompetidor, quitarCanal, quitarCompetidor, resumenDePiezas,
  type Competidor, type LecturaCanalSpy, type Pieza, type ResumenPiezas,
} from '@/lib/spy';
import { nombresDe } from '@/lib/landing-snapshot';
import { marcarActosSpy } from '@/lib/spy-actos';
import { anotarPasos, claveLectura, marcaValida, type PasoLectura } from '@/lib/spy-lectura-pasos';
import { setSetting } from '@/lib/settings';
import { sugeridosDelNegocio, sumarSugeridoAlNegocio, type Sugerido } from '@/lib/spy-sugeridos-server';
import { getRolWsEfectivo } from '@/lib/workspace';
import type { CanalSpy, EtapaTendencia } from '@/lib/spy-reglas';

/** null = entra. `getRolWsEfectivo` da 'admin' al admin del workspace y a la agencia. */
/**
 * Quién puede MIRAR: cualquiera que pertenezca al negocio.
 *
 * ⚠️ ANTES TODA LA TAB PEDÍA ADMIN, y eso es lo que había que cambiar. Martín, 2/11/2026:
 * «todavía todos los usuarios no pueden ver la nueva tab de Competitor Spy y eso ya debería
 * estar disponible... no tiene sentido que uno analice a Alex Hormozi y luego otro vuelva a
 * analizar al mismo». Sacar el `adminOnly` de la barra sin tocar esto habría sido peor que
 * dejarlo escondido: la tab se vería y no andaría ni para listar.
 */
async function soloMiembro(): Promise<string | null> {
  return (await getRolWsEfectivo()) ? null : 'Entra a tu negocio para ver los competidores.';
}

/**
 * Quién puede BORRAR: sólo el administrador.
 *
 * ⚠️ ES LO ÚNICO QUE QUEDA RESTRINGIDO, y lo pidió Martín en la misma frase: «ahí tienes que
 * fijarte cómo hacer la lógica de eliminado de ciertos análisis, para que si son ciertos
 * competidores no los puedan eliminar los usuarios». Borrar se lleva puestas TODAS las piezas
 * leídas (`on delete cascade`, 0359), o sea el trabajo de todo el equipo, y no se puede
 * deshacer. Agregar y revisar no: lo peor que hacen es sumar trabajo.
 */
async function soloAdmin(): Promise<string | null> {
  return (await getRolWsEfectivo()) === 'admin' ? null : 'Solo el administrador del negocio puede dejar de mirar a un competidor.';
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Una pieza como la dibuja la pantalla: con su etapa ya calculada, y con nombre lo que su sitio tiene. */
export type PiezaVista = Pieza & { etapa: EtapaTendencia | null; piezasDePagina?: string[] };

export async function competidoresAction(): Promise<{ ok: true; competidores: Competidor[]; resumen: Record<number, ResumenPiezas> } | { ok: false; error: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, error: no };
  try {
    const r = await listarCompetidores();
    if (!r.ok) return r;
    return { ok: true, competidores: r.competidores, resumen: await resumenDePiezas() };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function piezasAction(id: number, canal?: CanalSpy): Promise<{ ok: true; piezas: PiezaVista[] } | { ok: false; error: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, error: no };
  try {
    const piezas = await listarPiezas(id, canal);
    return {
      ok: true,
      piezas: piezas.map((p) => ({
        ...p, etapa: etapaDePieza(p),
        ...(p.canal === 'landing' ? { piezasDePagina: nombresDe(p.etiquetas ?? []) } : {}),
      })),
    };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Agregar es navegar: UN campo. Se pega un @, un canal o un sitio, el código resuelve qué es, y la
 * pantalla abre la ficha. Si ya existía, el upsert por nombre devuelve la misma fila.
 */
/** Lo que se le muestra a la persona ANTES de guardar, para que confirme que es quien cree. */
export type VistaPrevia = {
  campo: 'instagram' | 'youtube_id' | 'tiktok' | 'landing_url' | 'nombre';
  valor: string;
  /** Lo que se pudo leer del perfil. Vacío cuando no era un @ o no se pudo leer: se pregunta igual. */
  nombre?: string | null;
  foto?: string | null;
  seguidores?: number | null;
  bio?: string | null;
  /** El link de su bio: de ahí sale su landing sin buscarla en ningún lado. */
  web?: string | null;
  /** Por qué no se pudo leer, en palabras. Nunca deja a la persona sin saber qué pasó. */
  aviso?: string;
};

export async function sumarCompetidorAction(pegado: string, nombre?: string, deLaBio?: string | null): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, error: no };
  try {
    const r = await agregarCompetidor(pegado, nombre, deLaBio);
    if (!r.ok) return r;
    const c = r.competidor;
    await marcarActosSpy(c.instagram || c.youtube_id || c.landing_url ? ['spy_primero', 'spy_canales'] : ['spy_primero']);
    return { ok: true, id: c.id };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** El catálogo «Sugeridos»: los competidores de la plataforma que este negocio todavía no mira (lib/spy-sugeridos.ts). */
export async function sugeridosAction(): Promise<{ ok: true; sugeridos: Sugerido[] } | { ok: false; error: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, error: no };
  try {
    return { ok: true, sugeridos: await sugeridosDelNegocio() };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Suma un sugerido copiando lo que la plataforma ya leyó de él: no gasta la clave del negocio. */
export async function sumarSugeridoAction(id: number): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, error: no };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Falta cuál.' };
  try {
    const r = await sumarSugeridoAlNegocio(id);
    if (!r.ok) return r;
    await marcarActosSpy(['spy_primero', 'spy_canales']);
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

// ⚠️ SUS OTRAS REDES SE BUSCAN EN /api/competitor-spy/redes desde el 4/11/2026, no acá: tardan hasta 40 s y una action
// hace fila delante de todas las demás de la pantalla.

/** Deshace un canal que se sumó solo y no era de él. */
export async function quitarCanalAction(id: number, red: 'instagram' | 'youtube' | 'tiktok'): Promise<{ ok: true } | { ok: false; error: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, error: no };
  if (red !== 'instagram' && red !== 'youtube' && red !== 'tiktok') return { ok: false, error: 'Esa red no existe.' };
  try { return await quitarCanal(id, red); } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Le suma un canal al competidor que ya está: el upsert por nombre escribe sobre la MISMA fila. */
export async function sumarCanalAction(id: number, pegado: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, error: no };
  try {
    const c = await leerCompetidor(id);
    if (!c) return { ok: false, error: 'No encontré a ese competidor.' };
    const r = await agregarCompetidor(pegado, c.nombre);
    if (!r.ok) return r;
    await marcarActosSpy(['spy_primero', 'spy_canales']);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * `motivo` decide si sirve la lectura que ya pagó otro negocio (ítem 13, 2/11/2026).
 *
 * ⚠️ `'alta'` SÓLO cuando el competidor se acaba de agregar: ahí no hay nada en pantalla y la
 * lectura de hace unas horas vale más que un cuadro vacío mientras se quema un crédito del tope
 * diario. El botón «Revisar ahora» va SIEMPRE sin motivo —o sea `'a-pedido'`— porque quien lo toca
 * está mirando y pide datos de hoy.
 */
export async function revisarAction(id: number, motivo?: 'alta' | 'rutina', marca?: string): Promise<{ ok: boolean; canales: LecturaCanalSpy[]; error?: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, canales: [], error: no };
  try {
    // Con una marca, cada canal anota su paso para la pantalla del alta (lib/spy-lectura-pasos.ts, /api/competitor-spy/lectura).
    const hechos: PasoLectura[] = [];
    const alPaso = marcaValida(marca)
      ? (p: PasoLectura) => { hechos.push(p); return setSetting(claveLectura(id), anotarPasos(marca, hechos, Date.now())); }
      : undefined;
    const r = await mirarCompetidor(id, motivo ?? 'a-pedido', alPaso);
    if (r.ok) await marcarActosSpy(['spy_primero', 'spy_canales', 'spy_lectura']);
    return r;
  } catch (e) {
    return { ok: false, canales: [], error: msg(e) };
  }
}

// ⚠️ `analizarAction` se fue el 4/11/2026: el análisis corre solo (/api/competitor-spy/analizar), y una action de 90 s
// hacía fila delante de todas las demás de la pantalla.

export async function guardarAnuncioAction(id: number, enlace: string, copy?: string): Promise<{ ok: true; nuevo: boolean } | { ok: false; error: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, error: no };
  try { return await guardarAnuncioPegado(id, enlace, copy); } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function quitarCompetidorAction(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, error: no };
  try { return await quitarCompetidor(id); } catch (e) { return { ok: false, error: msg(e) }; }
}
