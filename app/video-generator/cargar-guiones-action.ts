'use server';

// =============================================================================
// Cargar guiones propios pegando texto — el ATAJO, y hay que decirlo
// =============================================================================
// ⚠️ ESTO ES DEUDA DELIBERADA, no la feature.
//
// El diseño acordado (proyecto P39, «Feature: Ideas») es que un guion que entra
// pase por REVISIÓN: MaKo lo mira contra la oferta, el avatar y el funnel del
// cliente y le dice qué no cierra. El caso que lo motiva, del dueño: alguien copia
// un guion de la competencia y el CTA no aplica — **la competencia manda a un
// webinar y él manda a su VSL Funnel**. El texto suena bien y termina mandando a
// un lugar que no existe en su embudo.
//
// Nada de eso está acá. Esto solo separa y guarda, porque el dueño necesitaba
// cargar los suyos HOY y esos tres caminos son semanas. El día que exista la
// revisión, esta puerta pasa a ser la excepción explícita —«sé lo que hago, no lo
// revises»— y no el camino por defecto.
//
// Lo que SÍ hace bien es lo que se le pidió: ordenar. «Cualquier usuario puede
// cargar algo así de desordenado, MaKo lo tiene que ordenar y separar los
// guiones.»

import { randomUUID } from 'node:crypto';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getRazones, setRazones, type RazonCelda } from '@/lib/razones';
import { separarGuiones, type GuionSeparado } from '@/lib/guiones-separar';

/** La celda donde caen los guiones que el cliente trajo. */
const CELDA_PROPIOS = 'guiones-propios';

export type PrevioCarga = {
  guiones: GuionSeparado[];
  /** Cuántos ya estaban guardados, comparando el texto con lo que hay. */
  yaEstaban: number;
};

export type CargarOut =
  | { ok: true; cargados: number; salteados: number }
  | { ok: false; error: string };

async function ctx(): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Entra al workspace de un cliente para cargar sus guiones.' };
  const rol = await getRolWsEfectivo();
  if (rol !== 'admin') return { ok: false, error: 'Solo un administrador del workspace puede cargar guiones.' };
  return { ok: true };
}

/** Normaliza para COMPARAR con lo ya guardado. Nunca para escribir. */
function huella(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Qué se va a cargar, ANTES de cargarlo.
 *
 * Se mira primero y se confirma después a propósito: pegar un archivo entero y
 * que aparezcan siete guiones sin haberlos visto es cómo se llena el banco de
 * basura que después nadie borra. El momento de mirarlo es antes de que valga.
 */
export async function previoCargaAction(crudo: string): Promise<{ ok: true; previo: PrevioCarga } | { ok: false; error: string }> {
  const c = await ctx();
  if (!c.ok) return c;

  const guiones = separarGuiones(crudo);
  if (guiones.length === 0) {
    return { ok: false, error: 'No encontré ningún guion en ese texto. ¿Está muy corto?' };
  }

  const celdas = await getRazones();
  const existentes = new Set(
    celdas.flatMap((c2) => c2.guiones ?? []).map((g) => huella(g.texto)),
  );

  return {
    ok: true,
    previo: { guiones, yaEstaban: guiones.filter((g) => existentes.has(huella(g.texto))).length },
  };
}

/**
 * Guarda los guiones elegidos.
 *
 * @param indices cuáles de los que devolvió el previo se cargan. Se pasan por
 *   índice y no por texto: el texto puede tener miles de caracteres y viajaría dos
 *   veces por la red para nada.
 */
export async function cargarGuionesAction(crudo: string, indices: number[]): Promise<CargarOut> {
  const c = await ctx();
  if (!c.ok) return c;

  const encontrados = separarGuiones(crudo);
  const elegidos = indices
    .map((i) => encontrados[i])
    .filter((g): g is GuionSeparado => !!g);

  if (elegidos.length === 0) return { ok: false, error: 'No elegiste ningún guion.' };

  const celdas = await getRazones();
  const existentes = new Set(celdas.flatMap((x) => x.guiones ?? []).map((g) => huella(g.texto)));

  // Los que ya estaban NO se vuelven a guardar. Es la última red: el previo ya los
  // marcó, pero entre que se miró y se confirmó pudo entrar otro por otro lado.
  const nuevos = elegidos.filter((g) => !existentes.has(huella(g.texto)));
  const ahora = Date.now();

  const items = nuevos.map((g) => ({
    id: randomUUID(),
    anguloId: '',
    // El título que traía el archivo. Es lo que después distingue un guion de otro
    // en la lista, así que si no traía uno se dice — no se inventa.
    anguloNombre: g.titulo || 'Cargado por mí',
    texto: g.texto,
    creadoEn: ahora,
    estado: 'borrador' as const,
    estructuraId: '',
    estructuraNombre: '',
  }));

  const iCelda = celdas.findIndex((x) => x.id === CELDA_PROPIOS);
  if (iCelda >= 0) {
    celdas[iCelda] = { ...celdas[iCelda], guiones: [...(celdas[iCelda].guiones ?? []), ...items] };
  } else {
    const celda: RazonCelda = {
      id: CELDA_PROPIOS,
      avatarId: '',
      nombre: 'Guiones propios',
      descripcion: 'Los que cargaste vos, sin pasar por la revisión de MaKo.',
      copy: '',
      guiones: items,
      imagenUrl: '',
      anguloImagen: '',
      anguloVideo: '',
    };
    celdas.push(celda);
  }

  await setRazones(celdas);
  return { ok: true, cargados: items.length, salteados: elegidos.length - items.length };
}
