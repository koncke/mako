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
import { huellaGuion } from '@/lib/guiones-normalizar';
import { estructurarGuion } from '@/lib/guion-estructurar';
import { archivoATexto, puedeLeerse, porQueNoPuedo, MAX_ARCHIVO_BYTES } from '@/lib/archivo-a-texto';
import { resolverLink, htmlATexto, pareceLogin } from '@/lib/texto-de-link';
import { validarDestino } from '@/lib/landing-fetch';

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

/**
 * Normaliza para COMPARAR con lo ya guardado. Nunca para escribir.
 *
 * Es la MISMA huella que usa el resto del flujo (`huellaGuion`), y eso importa:
 * ignora los rótulos de sección. Cuando MaKo ordena un guion le agrega GANCHO /
 * HISTORIA / CTA, así que con una huella que los contara, volver a cargar el
 * mismo archivo lo guardaría de nuevo como si fuera otro — y el banco de guiones
 * se llenaría de copias del mismo texto con distinto formato.
 */
const huella = huellaGuion;

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

  // ── MaKo los ORDENA antes de guardarlos ───────────────────────────────────
  // El texto ya viene limpio de `separarGuiones` (sin markdown, sin líneas en
  // blanco de más). Lo que falta es la estructura: los rótulos GANCHO / HISTORIA
  // / CTA en su propia línea, que es el contrato con el que el resto de la app
  // lee un guion — la UI lo corta en tarjetas por esas líneas y el planificador
  // de tomas las usa para saber qué parte es el gancho.
  //
  // Va en PARALELO porque son llamadas independientes y un archivo con cinco
  // guiones esperaría cinco veces de más si fueran en fila.
  //
  // Y si el modelo no contesta, o contesta algo que no pasa la validación, el
  // guion se guarda igual sin rótulos: `estructurarGuion` devuelve null y no
  // lanza. Cargar los guiones propios no puede depender de que haya IA
  // disponible — sería cambiar «entran sin revisión» por «entran si hay cuota».
  const ordenados = await Promise.all(
    nuevos.map(async (g) => ({ g, orden: await estructurarGuion(g.texto).catch(() => null) })),
  );

  const items = ordenados.map(({ g, orden }) => ({
    id: randomUUID(),
    anguloId: '',
    // El título que traía el archivo. Es lo que después distingue un guion de otro
    // en la lista, así que si no traía uno se dice — no se inventa.
    anguloNombre: g.titulo || 'Cargado por mí',
    texto: orden?.texto ?? g.texto,
    creadoEn: ahora,
    estado: 'borrador' as const,
    estructuraId: orden?.estructuraId ?? '',
    estructuraNombre: orden?.estructuraNombre ?? '',
  }));

  const iCelda = celdas.findIndex((x) => x.id === CELDA_PROPIOS);
  if (iCelda >= 0) {
    celdas[iCelda] = { ...celdas[iCelda], guiones: [...(celdas[iCelda].guiones ?? []), ...items] };
  } else {
    const celda: RazonCelda = {
      id: CELDA_PROPIOS,
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
  return { ok: true, cargados: items.length, salteados: elegidos.length - items.length };
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
 * Baja el texto que hay detrás de un link.
 *
 * ⚠️ La URL la escribe el USUARIO, así que pasa sí o sí por `validarDestino`
 * (lib/landing-fetch.ts): bloquea loopback, redes privadas, link-local y CGNAT.
 * Sin eso, pegar `http://169.254.169.254/…` convierte esta acción en la puerta al
 * metadata service de la nube.
 */
export async function textoDeLinkAction(crudo: string): Promise<{ ok: true; texto: string; nota?: string } | { ok: false; error: string }> {
  const c = await ctx();
  if (!c.ok) return c;

  const link = (crudo || '').trim();
  if (!link) return { ok: false, error: 'Pega el link primero.' };

  const { url, tipo, nota } = resolverLink(link);

  const chequeo = await validarDestino(url);
  if (!chequeo.ok) return { ok: false, error: chequeo.error };

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaKoBot/1.0)', Accept: 'text/plain,text/html,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { ok: false, error: `El link respondió ${res.status}. ${nota ?? ''}`.trim() };
    }

    // Tope de 3 MB: un guion no pesa más, y sin tope una página cualquiera puede
    // traer decenas de megas a la memoria del server.
    const crudoTexto = Buffer.from((await res.arrayBuffer()).slice(0, 3 * 1024 * 1024)).toString('utf8');

    const esHtml = /^\s*<(?:!doctype|html)/i.test(crudoTexto) || /<body[\s>]/i.test(crudoTexto);
    const texto = tipo === 'texto-plano' && !esHtml ? crudoTexto : (esHtml ? htmlATexto(crudoTexto) : crudoTexto);

    // Un Doc privado NO devuelve 403: devuelve 200 con la pantalla de acceso. Sin
    // esto, el usuario vería «lo cargué» sobre el HTML de un login.
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

