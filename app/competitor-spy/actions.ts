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
  agregarCompetidor, analizarCompetidor, etapaDePieza, guardarAnuncioPegado, leerCompetidor,
  listarCompetidores, listarPiezas, mirarCompetidor, quitarCompetidor, resumenDePiezas,
  type Competidor, type LecturaCanalSpy, type Pieza, type ResumenPiezas,
} from '@/lib/spy';
import { nombresDe } from '@/lib/landing-snapshot';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { marcarActosSpy } from '@/lib/spy-actos';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { leerPerfilInstagram } from '@/lib/instagram-perfil-server';
import { queEs } from '@/lib/spy';
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
  campo: 'instagram' | 'youtube_id' | 'landing_url' | 'nombre';
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

/**
 * Lee de quién es lo que se pegó, SIN guardar nada.
 *
 * ⚠️ POR QUÉ EXISTE, y es un pedido explícito de Martín (2/11/2026): «súper importante que lo
 * valides, o sea, que le preguntes al usuario, ¿este es el YouTube de esta persona?, para que no
 * se traiga algo incorrecto». Resolver una persona por su @ o por una búsqueda y guardarla sin
 * preguntar es como se trae a OTRA — ya lo pagamos resolviendo gurús por búsqueda en vez de por
 * handle (docs/hallazgos-ops-center.md).
 *
 * ⚠️ NO SE LLAMA EN CADA TECLA. Leer un perfil de Instagram gasta del tope diario de Apify
 * (`APIFY_TOPE_POR_DIA`): la pantalla la llama cuando la persona termina de escribir, no mientras
 * escribe. Si eso se rompe, el tope se agota en una tarde y nadie puede agregar a nadie.
 *
 * Un perfil que no se puede leer NO frena el alta: se devuelve el aviso y se agrega igual. Lo que
 * se pegó es de quien lo pegó; nosotros sólo ayudamos a confirmarlo.
 */
export async function vistaPreviaAction(pegado: string): Promise<{ ok: true; vista: VistaPrevia } | { ok: false; error: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, error: no };
  try {
    const leido = queEs(pegado);
    if (!leido) return { ok: false, error: 'No reconocí eso. Pega el @ de Instagram, el enlace de su canal de YouTube o el de su sitio.' };
    // Sólo Instagram se puede previsualizar sin gastar una lectura cara: YouTube pide una llamada
    // al canal y la landing habría que bajarla. Para esos dos se confirma con lo que se pegó.
    if (leido.campo !== 'instagram') return { ok: true, vista: { campo: leido.campo, valor: leido.valor } };

    const l = await leerPerfilInstagram(leido.valor, { ws: await getWorkspaceActual(), conPiezas: false });
    if (!l.ok) {
      return { ok: true, vista: { campo: leido.campo, valor: leido.valor, aviso: `No pude leer @${leido.valor} para mostrarte quién es. Puedes agregarlo igual.` } };
    }
    return {
      ok: true,
      vista: {
        campo: leido.campo, valor: leido.valor,
        nombre: l.perfil.nombre, foto: l.perfil.foto, seguidores: l.perfil.seguidores,
        bio: l.perfil.bio ? l.perfil.bio.slice(0, 220) : null, web: l.perfil.web,
      },
    };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function sumarCompetidorAction(pegado: string, nombre?: string): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, error: no };
  try {
    const r = await agregarCompetidor(pegado, nombre);
    if (!r.ok) return r;
    const c = r.competidor;
    await marcarActosSpy(c.instagram || c.youtube_id || c.landing_url ? ['spy_primero', 'spy_canales'] : ['spy_primero']);
    return { ok: true, id: c.id };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
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

export async function revisarAction(id: number): Promise<{ ok: boolean; canales: LecturaCanalSpy[]; error?: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, canales: [], error: no };
  try {
    const r = await mirarCompetidor(id);
    if (r.ok) await marcarActosSpy(['spy_primero', 'spy_canales', 'spy_lectura']);
    return r;
  } catch (e) {
    return { ok: false, canales: [], error: msg(e) };
  }
}

export async function analizarAction(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const no = await soloMiembro();
  if (no) return { ok: false, error: no };
  try {
    // Lo que vende ESTE negocio es la mitad del análisis: sin eso sale «este competidor promete X»,
    // que es la Biblioteca de Anuncios con otro CSS. El cruce es lo que ninguna herramienta de
    // afuera puede hacer, porque ninguna conoce el negocio.
    const brief = await perfilNegocioTexto().catch(() => '');
    const r = await analizarCompetidor(id, brief);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

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
