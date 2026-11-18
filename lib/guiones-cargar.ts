// =============================================================================
// guiones-cargar — cargar guiones propios pegando texto o un link (el ORQUESTADOR, server-only)
// =============================================================================
// Vivía adentro de app/video-generator/cargar-guiones-action.ts y se mudó acá el 18/11/2026 (pendiente O19, P0-10:
// docs/pendientes-verificados-17-11.md): las server actions leen la sesión de la cookie (su `ctx()`), así que por WhatsApp
// o por HTTP no había forma de cargar un guion. Ahora hay UNA implementación y dos puertas:
//   · la pantalla (CargarGuiones.tsx → las server actions de app/video-generator/cargar-guiones-action.ts, que miran la
//     sesión y llaman a esto), y
//   · la API de MaKo (`cargar_guiones_anuncio`, lib/api-mako/areas/contenido.run.ts: WhatsApp y HTTP; por la app sigue
//     `cargar_guion_propio`, que llama a la acción del botón).
//
// ⚠️ ESTO ES DEUDA DELIBERADA, no la feature (lo decía la acción y sigue valiendo). El diseño acordado (proyecto P39,
// «Feature: Ideas») es que un guion que entra pase por REVISIÓN contra la oferta, el avatar y el funnel: alguien copia un
// guion de la competencia y el CTA manda a un webinar que el negocio no tiene. Nada de eso está acá: esto separa, ordena y
// guarda. Lo que sí hace bien es ordenar: «Cualquier usuario puede cargar algo así de desordenado, MaKo lo tiene que
// ordenar y separar los guiones».
//
// ⚠️ LA MATRIZ SE LEE EN ESTRICTO (`getRazonesEstricto`), y se relee DESPUÉS de la IA. Hasta la mudanza la acción leía con
// `getRazones`, que convierte un 5xx en [], y después escribía la matriz ENTERA (`setRazones`): con la base caída un
// instante, cargar un guion borraba todos los anuncios del negocio. Y la leía ANTES de ordenar los guiones con la IA (hasta
// decenas de segundos): lo que otra pestaña escribía en el medio se perdía. Ahora se escribe sobre lo leído justo antes.
//
// ⚠️ TODA LA MATRIZ ES UN JSON EN UNA CLAVE (`mako.razones`): no hay escritura de una celda sola. Por eso la lectura de
// antes de escribir va pegada a la escritura, sin nada lento en el medio.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getRazonesEstricto, setRazones, type RazonCelda, type GuionItem } from '@/lib/razones';
import { separarGuiones, type GuionSeparado } from '@/lib/guiones-separar';
import { huellaGuion } from '@/lib/guiones-normalizar';
import { estructurarGuion } from '@/lib/guion-estructurar';
import { CELDA_GUIONES_PROPIOS } from '@/lib/angulos-data';
import { resolverLink, htmlATexto, pareceLogin } from '@/lib/texto-de-link';
import { validarDestino } from '@/lib/landing-fetch';
import { fetchSeguro } from '@/lib/fetch-seguro';

export type PrevioCarga = {
  guiones: GuionSeparado[];
  /** Cuántos ya estaban guardados, comparando el texto con lo que hay. */
  yaEstaban: number;
  /** CUÁLES ya estaban guardados (índices de `guiones`): el resumen de la API nombra sólo los que se van a guardar. */
  yaGuardados?: number[];
};

export type ResultadoCarga =
  | { ok: true; cargados: number; salteados: number; ids: string[] }
  | { ok: false; error: string };

/** Lo que dice la carga cuando la base no contesta: no es que no haya guiones (y no se escribe nada). */
export const NO_PUDE_LEER_GUIONES = 'No pude leer tus guiones guardados. No guardé nada: reintenta en un momento.';

/**
 * Normaliza para COMPARAR con lo ya guardado. Nunca para escribir. Es la MISMA huella que usa el resto del flujo
 * (`huellaGuion`): ignora los rótulos de sección, así volver a cargar el mismo archivo (que MaKo ordenó con GANCHO /
 * HISTORIA / CTA) no lo guarda dos veces.
 */
const huella = huellaGuion;
const huellasDe = (celdas: RazonCelda[]): Set<string> => new Set(celdas.flatMap((c) => c.guiones ?? []).map((g) => huella(g.texto)));

/**
 * Qué se va a cargar, ANTES de cargarlo. Se mira primero y se confirma después a propósito: pegar un archivo entero y que
 * aparezcan siete guiones sin haberlos visto es cómo se llena el banco de basura que después nadie borra.
 */
export async function previoCarga(crudo: string): Promise<{ ok: true; previo: PrevioCarga } | { ok: false; error: string }> {
  const guiones = separarGuiones(crudo);
  if (guiones.length === 0) return { ok: false, error: 'No encontré ningún guion en ese texto. ¿Está muy corto?' };
  let celdas: RazonCelda[];
  try { celdas = await getRazonesEstricto(); } catch { return { ok: false, error: NO_PUDE_LEER_GUIONES }; }
  const existentes = huellasDe(celdas);
  const yaGuardados = guiones.map((g, i) => (existentes.has(huella(g.texto)) ? i : -1)).filter((i) => i >= 0);
  return { ok: true, previo: { guiones, yaEstaban: yaGuardados.length, yaGuardados } };
}

/**
 * Guarda los guiones elegidos en la celda «Guiones propios», en borrador.
 *
 * @param indices cuáles de los que devolvió el previo se cargan (por índice: el texto puede tener miles de caracteres).
 * @param opts.hastaMs hasta cuándo puede ordenar la IA (epoch ms): la API por HTTP corta a 60 s. Lo que no se ordena a
 *   tiempo se guarda igual, sin rótulos (como cuando no hay IA).
 */
export async function cargarGuiones(crudo: string, indices: number[], opts: { hastaMs?: number } = {}): Promise<ResultadoCarga> {
  const encontrados = separarGuiones(crudo);
  const elegidos = indices.map((i) => encontrados[i]).filter((g): g is GuionSeparado => !!g);
  if (elegidos.length === 0) return { ok: false, error: 'No elegiste ningún guion.' };

  let celdas: RazonCelda[];
  try { celdas = await getRazonesEstricto(); } catch { return { ok: false, error: NO_PUDE_LEER_GUIONES }; }
  // Los que ya estaban NO se vuelven a guardar. Es la última red: el previo ya los marcó, pero entre que se miró y se
  // confirmó pudo entrar otro por otro lado.
  const nuevos = elegidos.filter((g) => !huellasDe(celdas).has(huella(g.texto)));
  if (!nuevos.length) return { ok: true, cargados: 0, salteados: elegidos.length, ids: [] };
  const ahora = Date.now();

  // ── MaKo los ORDENA antes de guardarlos ───────────────────────────────────
  // Lo que falta es la estructura: los rótulos GANCHO / HISTORIA / CTA en su propia línea, que es el contrato con el que el
  // resto de la app lee un guion (la UI lo corta en tarjetas y el planificador de tomas sabe cuál es el gancho). En
  // PARALELO: son independientes. Si el modelo no contesta (o no le alcanza el plazo), el guion se guarda igual sin
  // rótulos: cargar los guiones propios no puede depender de que haya IA.
  const ordenados = await Promise.all(
    nuevos.map(async (g) => ({ g, orden: await estructurarGuion(g.texto, { hastaMs: opts.hastaMs }).catch(() => null) })),
  );

  // ⚠️ SE RELEE DESPUÉS DE LA IA (ver la cabecera): lo que otra pestaña escribió mientras se ordenaba no se pisa, y un
  // guion que alguien cargó en el medio no se guarda dos veces.
  try { celdas = await getRazonesEstricto(); } catch { return { ok: false, error: NO_PUDE_LEER_GUIONES }; }
  const ya = huellasDe(celdas);
  const items: GuionItem[] = ordenados
    .filter(({ g }) => !ya.has(huella(g.texto)))
    .map(({ g, orden }) => ({
      id: randomUUID(),
      anguloId: '',
      // El título que traía el archivo. Es lo que después distingue un guion de otro en la lista, así que si no traía uno
      // se dice — no se inventa.
      anguloNombre: g.titulo || 'Cargado por mí',
      texto: orden?.texto ?? g.texto,
      creadoEn: ahora,
      estado: 'borrador',
      estructuraId: orden?.estructuraId ?? '',
      estructuraNombre: orden?.estructuraNombre ?? '',
    }));
  if (!items.length) return { ok: true, cargados: 0, salteados: elegidos.length, ids: [] };

  const iCelda = celdas.findIndex((x) => x.id === CELDA_GUIONES_PROPIOS);
  if (iCelda >= 0) {
    celdas[iCelda] = { ...celdas[iCelda], guiones: [...(celdas[iCelda].guiones ?? []), ...items] };
  } else {
    const celda: RazonCelda = {
      id: CELDA_GUIONES_PROPIOS,
      avatarId: '',
      nombre: 'Guiones propios',
      descripcion: 'Los que cargaste tú, sin pasar por la revisión de MaKo.',
      copy: '',
      guiones: items,
      imagenUrl: '',
      anguloImagen: '',
      anguloVideo: '',
    };
    celdas.push(celda);
  }

  await setRazones(celdas);
  return { ok: true, cargados: items.length, salteados: elegidos.length - items.length, ids: items.map((i) => i.id) };
}

/**
 * Baja el texto que hay detrás de un link. ⚠️ La URL la escribe el USUARIO (o su agente), así que pasa sí o sí por
 * `validarDestino` (lib/landing-fetch.ts) y por `fetchSeguro` (lib/fetch-seguro.ts), que vuelve a validar en cada salto:
 * sin eso, pegar `http://169.254.169.254/…` convierte esto en la puerta al metadata service de la nube.
 */
export async function textoDeLink(crudo: string): Promise<{ ok: true; texto: string; nota?: string } | { ok: false; error: string }> {
  const link = (crudo || '').trim();
  if (!link) return { ok: false, error: 'Pega el link primero.' };

  const { url, tipo, nota } = resolverLink(link);

  const chequeo = await validarDestino(url);
  if (!chequeo.ok) return { ok: false, error: chequeo.error };

  try {
    const res = await fetchSeguro(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaKoBot/1.0)', Accept: 'text/plain,text/html,*/*' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { ok: false, error: `El link respondió ${res.status}. ${nota ?? ''}`.trim() };
    }

    // Tope de 3 MB: un guion no pesa más, y sin tope una página cualquiera puede traer decenas de megas a la memoria.
    const crudoTexto = Buffer.from((await res.arrayBuffer()).slice(0, 3 * 1024 * 1024)).toString('utf8');

    const esHtml = /^\s*<(?:!doctype|html)/i.test(crudoTexto) || /<body[\s>]/i.test(crudoTexto);
    const texto = tipo === 'texto-plano' && !esHtml ? crudoTexto : (esHtml ? htmlATexto(crudoTexto) : crudoTexto);

    // Un Doc privado NO devuelve 403: devuelve 200 con la pantalla de acceso. Sin esto se diría «lo cargué» sobre el HTML
    // de un login.
    if (pareceLogin(texto, tipo)) {
      return {
        ok: false,
        error: 'Ese documento pide permiso para abrirse. Compártelo como «cualquiera con el enlace» y vuelve a pegarlo.',
      };
    }

    if (texto.trim().length < 40) {
      return { ok: false, error: 'El link no trajo texto suficiente. ¿Es la dirección correcta?' };
    }

    return { ok: true, texto, nota };
  } catch (e) {
    return { ok: false, error: `No pude abrir el link: ${e instanceof Error ? e.message : 'falló la conexión'}` };
  }
}
