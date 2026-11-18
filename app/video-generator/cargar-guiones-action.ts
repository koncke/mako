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

// ⚠️ EL ORQUESTADOR VIVE EN lib/guiones-cargar.ts desde el 18/11/2026 (pendiente O19, P0-10): estas acciones miran la
// sesión de la cookie (`ctx()`) y llaman a lib, la MISMA implementación que usa la API de MaKo por WhatsApp y por HTTP
// (`cargar_guiones_anuncio`, lib/api-mako/areas/contenido.run.ts). Lo que hace cada una es lo de siempre.

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getRazones, setRazones } from '@/lib/razones';
import { archivoATexto, puedeLeerse, porQueNoPuedo, MAX_ARCHIVO_BYTES } from '@/lib/archivo-a-texto';
import {
  previoCarga, cargarGuiones, textoDeLink,
  type PrevioCarga as PrevioCargaLib,
} from '@/lib/guiones-cargar';

export type PrevioCarga = PrevioCargaLib;

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

/**
 * Qué se va a cargar, ANTES de cargarlo (lib/guiones-cargar.ts → `previoCarga`). Se mira primero y se confirma después a
 * propósito: pegar un archivo entero y que aparezcan siete guiones sin haberlos visto es cómo se llena el banco de basura.
 */
export async function previoCargaAction(crudo: string): Promise<{ ok: true; previo: PrevioCarga } | { ok: false; error: string }> {
  const c = await ctx();
  if (!c.ok) return c;
  return previoCarga(crudo);
}

/**
 * Guarda los guiones elegidos (lib/guiones-cargar.ts → `cargarGuiones`: los ordena con la IA y los guarda en «Guiones
 * propios», sin repetir los que ya estaban).
 *
 * @param indices cuáles de los que devolvió el previo se cargan. Se pasan por índice y no por texto: el texto puede tener
 *   miles de caracteres y viajaría dos veces por la red para nada.
 */
export async function cargarGuionesAction(crudo: string, indices: number[]): Promise<CargarOut> {
  const c = await ctx();
  if (!c.ok) return c;
  const r = await cargarGuiones(crudo, indices);
  return r.ok ? { ok: true, cargados: r.cargados, salteados: r.salteados } : r;
}

// ── Las otras dos puertas: un archivo y un link ─────────────────────────────
//
// Las tres entradas terminan en el MISMO lugar —un string de texto que pasa por
// `separarGuiones`— y eso es deliberado: si cada una tuviera su propio camino de
// separación, la que menos se use sería la que se queda vieja.

/**
 * Lee un archivo que subió el usuario y devuelve su texto.
 *
 * Reusa `archivoATexto` del repo, que ya sabe leer .md, .txt, .docx, .pdf y
 * planillas, y que ya tiene el catálogo de qué se puede leer y qué no
 * (`lib/formatos-archivo.ts`). Escribir un lector propio acá sería un segundo
 * lugar con la misma lista de formatos, y el segundo se queda viejo.
 */
export async function textoDeArchivoAction(form: FormData): Promise<{ ok: true; texto: string; nota?: string } | { ok: false; error: string }> {
  const c = await ctx();
  if (!c.ok) return c;

  const file = form.get('archivo');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'No llegó ningún archivo.' };
  if (file.size > MAX_ARCHIVO_BYTES) {
    return { ok: false, error: `El archivo pesa más de ${Math.round(MAX_ARCHIVO_BYTES / 1024 / 1024)} MB.` };
  }
  // El mensaje sale del catálogo y nombra el formato: «no puedo leer .key» le
  // dice al usuario qué hacer, «formato no soportado» no.
  if (!puedeLeerse(file.name, file.type)) return { ok: false, error: porQueNoPuedo(file.name) };

  try {
    const { texto, warning } = await archivoATexto(file);
    if (!texto.trim()) {
      return { ok: false, error: 'El archivo no tiene texto que pueda leer. ¿Está escaneado como imagen?' };
    }
    return { ok: true, texto, nota: warning };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer el archivo.' };
  }
}

/**
 * Baja el texto que hay detrás de un link (lib/guiones-cargar.ts → `textoDeLink`, que pasa la URL por `validarDestino` y
 * `fetchSeguro`: la escribe el usuario).
 */
export async function textoDeLinkAction(crudo: string): Promise<{ ok: true; texto: string; nota?: string } | { ok: false; error: string }> {
  const c = await ctx();
  if (!c.ok) return c;
  return textoDeLink(crudo);
}

/**
 * Reescribe el texto de un guion.
 *
 * El dueño lo pidió al ver el detalle: «donde está el guion también deberías
 * dejar corregirlo, es decir escribir. Que es lo que ya se puede hacer en los
 * desplegables de la matriz». Es la misma edición inline de /ads-writer, en la
 * pantalla donde se elige qué grabar — que es justo donde uno se da cuenta de
 * que una frase no cierra.
 *
 * ⚠️ Escribe sobre `mako.razones`, que es el MISMO lugar del que come la matriz.
 * No hay copia: corregir acá corrige en todos lados, que es lo que se espera de
 * un guion que es uno solo.
 *
 * Lo que NO hace es tocar `estructuraId`: si el dueño reescribe el cuerpo, la
 * estructura que MaKo detectó sigue siendo la misma. Y si borra los rótulos, el
 * guion se sigue leyendo —`parsearSecciones` cae a texto plano— y el reparto en
 * tomas también, porque `soloHablado` no exige rótulos.
 */
export async function editarGuionAction(id: string, texto: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await ctx();
  if (!c.ok) return c;

  const limpio = (texto ?? '').trim();
  if (!limpio) return { ok: false, error: 'El guion no puede quedar vacío.' };
  if (limpio.length > 20000) return { ok: false, error: 'Ese texto es demasiado largo para un guion.' };

  const celdas = await getRazones();
  let encontrado = false;

  const nuevas = celdas.map((celda) => ({
    ...celda,
    guiones: (celda.guiones ?? []).map((g) => {
      if (g.id !== id) return g;
      encontrado = true;
      return { ...g, texto: limpio };
    }),
  }));

  // Un id que no está NO se crea: sería guardar el guion de nadie. El error es
  // honesto porque el caso real es que otro lo borró mientras este lo editaba.
  if (!encontrado) return { ok: false, error: 'Ese guion ya no existe. Recarga la pantalla.' };

  await setRazones(nuevas);
  return { ok: true };
}
