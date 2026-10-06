'use server';

// =============================================================================
// Lo que el workspace declara sobre su landing — páginas y videos
// =============================================================================
// Dos listas que la persona mantiene a mano: qué páginas son suyas y cómo se
// llama cada video. Las decisiones (normalizar, deduplicar, reemplazar al
// editar, dejar un solo VSL) viven en `lib/landing-paginas.ts` y
// `lib/landing-videos.ts`, sin `server-only`, para poder testearlas. Acá queda
// solo el acceso al setting y el `revalidatePath`.

import { revalidatePath } from 'next/cache';
import { getSetting, setSetting } from '@/lib/settings';
import { requireRolWs } from '@/lib/tab-access';
import { emitirDelCatalogo } from '@/lib/avisos';
import { getWorkspaceActual } from '@/lib/workspace';
import { contarEventosDePrueba } from '@/lib/landing-token';
import { configDeReplay } from '@/lib/replay-ingesta';
import { OCULTAS_KEY, PAGINAS_KEY, conOculta, conPagina, parsearOcultas, parsearPaginas, sinPagina } from '@/lib/landing-paginas';
import { VIDEOS_KEY, conVideo, parsearVideos, sinVideo, type VideoLanding, VIDEOS_OCULTOS_KEY, parsearOcultos, conOculto, sinOculto } from '@/lib/landing-videos';

export type Listas = { paginas: string[]; ocultas: string[] };
export type PaginasResult = { ok: true; paginas: string[]; ocultas: string[] } | { ok: false; error: string };

/**
 * Todas las acciones pasan por el mismo gate de la pantalla. `getSetting` ya
 * scopea por workspace, así que nadie puede tocar la lista de otro — pero el
 * permiso de la TAB se pide igual: leer o escribir la config de un cliente no es
 * algo que deba poder hacer cualquiera que tenga sesión.
 */
async function leer(): Promise<Listas> {
  await requireRolWs([], { nav: 'integraciones' });
  const [p, o] = await Promise.all([getSetting(PAGINAS_KEY), getSetting(OCULTAS_KEY)]);
  return { paginas: parsearPaginas(p), ocultas: parsearOcultas(o) };
}

export async function getPaginasAction(): Promise<Listas> {
  return leer().catch(() => ({ paginas: [], ocultas: [] }));
}

/** Agrega una página, o REEMPLAZA `anterior` si viene (eso es «editar»). */
export async function guardarPaginaAction(url: string, anterior?: string | null): Promise<PaginasResult> {
  try {
    const { paginas, ocultas } = await leer();
    const nuevas = conPagina(paginas, url, anterior);
    if (!nuevas) return { ok: false, error: 'Esa dirección no parece una página web.' };
    await setSetting(PAGINAS_KEY, JSON.stringify(nuevas));
    revalidatePath('/integraciones');
    return { ok: true, paginas: nuevas, ocultas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

/**
 * Sacar una página de la lista. Son DOS cosas según de dónde salga, y por eso se
 * hacen las dos: si estaba guardada se borra, y en todos los casos se anota como
 * escondida — porque una guardada puede además estar llegando por los eventos, y
 * borrarla sola la haría reaparecer al toque como «detectada».
 */
export async function borrarPaginaAction(url: string): Promise<PaginasResult> {
  try {
    const { paginas, ocultas } = await leer();
    const nuevas = sinPagina(paginas, url);
    const nuevasOcultas = conOculta(ocultas, url);
    await Promise.all([
      setSetting(PAGINAS_KEY, JSON.stringify(nuevas)),
      setSetting(OCULTAS_KEY, JSON.stringify(nuevasOcultas)),
    ]);
    revalidatePath('/integraciones');
    return { ok: true, paginas: nuevas, ocultas: nuevasOcultas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo borrar.' };
  }
}

// =============================================================================
// Los videos: cómo se llama cada uno y cuál es el VSL
// =============================================================================
// El sistema DETECTA los videos (cada evento trae su `video_id`); lo que no
// puede saber es cuál es cuál. Eso solo lo sabe quien armó la página, así que se
// le pide que NOMBRE lo que ya está a la vista — no que descubra nada.

export type VideosResult = { ok: true; videos: VideoLanding[] } | { ok: false; error: string };

async function leerVideos(): Promise<VideoLanding[]> {
  await requireRolWs([], { nav: 'integraciones' });
  return parsearVideos(await getSetting(VIDEOS_KEY));
}

export async function getVideosAction(): Promise<VideoLanding[]> {
  return leerVideos().catch(() => []);
}

/**
 * Nombra un video (o lo renombra), y opcionalmente lo marca como EL VSL.
 *
 * Marcar uno desmarca al anterior — es una elección, no una etiqueta que se
 * acumula. Esa regla vive en `conVideo`, con su test: si dos quedaran marcados,
 * cada pantalla que pregunta «cuál es el VSL» elegiría uno distinto según cómo
 * ordene, y los números dejarían de cerrar entre sí.
 */
export async function guardarVideoAction(video: VideoLanding): Promise<VideosResult> {
  try {
    const nuevos = conVideo(await leerVideos(), video);
    if (!nuevos) return { ok: false, error: 'Ponle un nombre al video para poder distinguirlo.' };
    await setSetting(VIDEOS_KEY, JSON.stringify(nuevos));
    revalidatePath('/integraciones');
    revalidatePath('/crm');
    return { ok: true, videos: nuevos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

/**
 * Olvida el nombre de un video. NO borra sus eventos: la retención que ya se
 * midió sigue estando —el dato es un hecho— y lo único que se pierde es el
 * rótulo, así que vuelve a aparecer como detectado sin nombre.
 */
/**
 * «Este video no es de mi página»: se deja de ofrecer para nombrar.
 *
 * ⚠️ ESCONDER NO ES BORRAR. Los eventos de ese video son un hecho —se reprodujo
 * de verdad en esa página— y quedan donde están. Lo único que cambia es que deja
 * de aparecer en la lista que pide nombrarlos.
 *
 * El caso que lo pidió: un «redirect al terminar» configurado en Panda mandaba
 * solo al espectador a un video viejo de otra persona. El redirect se eliminó,
 * pero los eventos que dejó siguen siendo ciertos, así que el sistema lo seguía
 * listando con razón — y no había forma de decirle que ese video no es del
 * negocio.
 */
/** Dónde se anota qué pruebas ya se cerraron, para no avisar dos veces. */
const CERRADAS_KEY = 'landing.pruebas_cerradas';

/**
 * Se terminó una prueba: avisar que quedó registrada y que la grabación viene.
 *
 * ⚠️ ESTE MENSAJE VA AL TERMINAR, no cuando la grabación está lista — de eso se
 * ocupa el cron `prueba-grabacion`, que manda el link cuando se terminó de guardar. Este
 * cierra el bucle EN EL MOMENTO: quien termina de probar cierra la ventana y se
 * queda sin ninguna señal de que lo que hizo quedó registrado.
 *
 * ⚠️ IDEMPOTENTE POR MARCADOR, y hace falta: la prueba puede terminar por dos
 * caminos a la vez —cerrar la ventana y apretar «Terminar»— y los dos llaman acá.
 */
export async function finPruebaAction(prueba: string): Promise<{ ok: boolean }> {
  try {
    await requireRolWs([], { nav: 'integraciones' });
    const p = prueba?.trim();
    if (!p) return { ok: false };

    let cerradas: string[] = [];
    try {
      const v: unknown = JSON.parse((await getSetting(CERRADAS_KEY)) ?? '[]');
      cerradas = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch { cerradas = []; }
    if (cerradas.includes(p)) return { ok: true };
    await setSetting(CERRADAS_KEY, JSON.stringify([p, ...cerradas].slice(0, 40)));

    const { eventos, pagina } = await contarEventosDePrueba(p);
    // Una prueba sin un solo evento no merece un mensaje: no hay nada que contar
    // y el aviso se leería como ruido justo cuando la persona ya está frustrada.
    if (!eventos) return { ok: true };

    const ws = (await getWorkspaceActual()) ?? undefined;
    // ⚠️ SE PROMETE EL AVISO DE LA GRABACIÓN SÓLO SI VA A LLEGAR. Hasta el
    // 06/10/2026 este mensaje prometía «el link de Clarity» a TODO negocio, lo
    // tuviera conectado o no — y el cron que lo mandaba cortaba sin Clarity, así
    // que a los demás no les llegaba nunca. Ahora la grabación es propia y el aviso
    // lo manda `prueba-grabacion` sólo con la grabación prendida: se pregunta lo
    // mismo que él antes de prometerlo.
    const grabando = (await configDeReplay().catch(() => null))?.activo === true;
    await emitirDelCatalogo('prueba-recibida', {
      ws,
      // El texto lo arma el CÓDIGO: acá viaja un conteo exacto y un dominio.
      texto: `Listo, recibí tu prueba del Pixel${pagina ? ` en *${pagina}*` : ''}: ${eventos} ${eventos === 1 ? 'evento' : 'eventos'}.${grabando ? ' Te aviso cuando la grabación esté lista.' : ''}`,
    });
    return { ok: true };
  } catch {
    // Que el aviso falle no puede romper el cierre de la prueba.
    return { ok: false };
  }
}

export async function ocultarVideoAction(id: string, ocultar = true): Promise<{ ok: true; ocultos: string[] } | { ok: false; error: string }> {
  try {
    await requireRolWs([], { nav: 'integraciones' });
    const actuales = parsearOcultos(await getSetting(VIDEOS_OCULTOS_KEY));
    const nuevos = ocultar ? conOculto(actuales, id) : sinOculto(actuales, id);
    await setSetting(VIDEOS_OCULTOS_KEY, JSON.stringify(nuevos));
    revalidatePath('/integraciones');
    return { ok: true, ocultos: nuevos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

export async function borrarVideoAction(id: string): Promise<VideosResult> {
  try {
    const nuevos = sinVideo(await leerVideos(), id);
    await setSetting(VIDEOS_KEY, JSON.stringify(nuevos));
    revalidatePath('/integraciones');
    revalidatePath('/crm');
    return { ok: true, videos: nuevos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo borrar.' };
  }
}
