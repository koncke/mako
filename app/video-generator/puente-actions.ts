'use server';

// =============================================================================
// /video-generator — conectar el navegador y probar que el circuito existe
// =============================================================================
// La prueba más chica que recorre TODO el camino: MaKo encola un `creditos`, la
// extensión lo toma, le pega a Google con la sesión del cliente y devuelve. Si
// eso vuelve con un número, el puente entero funciona.
//
// Se eligió `creditos` y no una generación a propósito: no gasta nada, es
// instantáneo, y contesta de paso la única pregunta que decide la economía del
// pipeline —cuántos créditos hay y en qué tier está la cuenta—, que hasta ahora
// solo se podía leer mirando la pantalla de Flow.

import { getRolWsEfectivo, getWorkspaceActual, getWorkspace } from '@/lib/workspace';
import { crearTokenPuente, encolar, estadoPuente, type Puente } from '@/lib/flow-cola';
import { estaVivo } from '@/lib/flow-puente-frescura';
import { randomUUID } from 'node:crypto';
import { ENDPOINTS } from '@/lib/flow-protocolo';
import { parchesImagenEscena } from '@/lib/flow-imagen';
import { getTenantDb } from '@/lib/workspace';
import { getSetting, setSetting } from '@/lib/settings';

/** El motivo, no la frase: quien pinta es el popup y necesita elegir pantalla. */
export type MotivoConectar = 'rol' | 'sin_ws' | 'otro_navegador' | 'error';

async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; motivo: MotivoConectar; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, motivo: 'rol', error: 'Solo el administrador del workspace puede conectar el navegador.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, motivo: 'sin_ws', error: 'Sin workspace activo.' };
  return { ok: true, ws };
}

export type ConectarOut =
  // ⚠️ `wsId` viaja para que la extensión sepa SI CAMBIÓ DE CLIENTE. No alcanza
  // con mirar el token: `crearTokenPuente` acuña uno nuevo en cada conexión, así
  // que comparar tokens da «cambió» hasta reconectando el mismo workspace. No es
  // un dato sensible: es el workspace que la propia página ya está mirando.
  | { ok: true; token: string; workspace: string; wsId: number }
  | { ok: false; motivo: MotivoConectar; error: string; etiqueta?: string };

/**
 * Crea el código de conexión y lo devuelve EN CLARO una sola vez.
 *
 * Se guarda hasheado, así que no hay forma de volver a leerlo: si el cliente lo
 * pierde, se genera otro.
 *
 * ⚠️ QUIÉN LLAMA A ESTO CAMBIÓ, y por eso hizo falta el guard de abajo. Antes lo
 * disparaba una persona apretando «Conectar» en la web, mirando un panel que le
 * decía qué estaba haciendo. Ahora lo dispara el POPUP de la extensión, a un
 * clic, desde cualquier navegador — y `crearTokenPuente` hace un upsert por
 * workspace, así que cada llamada DESCONECTA a la máquina anterior. Lo que era
 * un accidente raro pasaba a ser uno normal.
 *
 * La negativa es por `vivo && listo` y no por `vivo` a secas a propósito: un
 * navegador que late pero tiene Flow cerrado no está trabajando, así que no tiene
 * derecho a bloquear al que sí puede. Y `forzar` es la salida explícita — el
 * popup la ofrece nombrando al otro navegador, que es lo único que convierte esto
 * en una decisión en vez de una sorpresa.
 */
/**
 * Cuánto vale el permiso de desbancar al otro navegador, desde que se avisó.
 *
 * Es el tiempo de leer «ya hay otro navegador: X» y decidir. Corto a propósito:
 * lo que autoriza es pisar una sesión que está trabajando.
 */
const FORZAR_MS = 60_000;
const KEY_FORZAR = 'flow.puente.forzar_hasta';

export async function conectarPuenteAction(etiqueta: string): Promise<ConectarOut> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    // ⚠️ `forzar` YA NO ES UN PARÁMETRO, y ése era el agujero.
    //
    // Venía del `detail` de un evento de ventana (`PuenteEnlace`), así que
    // cualquier script de la página podía pedir el token con `forzar: true` y
    // llevarse dos cosas de un saque: una credencial y la desconexión del
    // navegador que estaba trabajando.
    //
    // Ahora el permiso lo emite el SERVER: la primera vez contesta «ya hay otro»
    // y deja una marca de un minuto; la segunda —que en el popup es la persona
    // apretando de nuevo después de LEER de quién es— la consume. El que pide no
    // decide, decide el que sabe.
    //
    // No hace inexpugnable el evento: un script podría dar los dos pasos. Lo que
    // corta es el disparo a ciegas, que es la forma que tiene esto de pasar.
    const permiso = Number(await getSetting(KEY_FORZAR)) || 0;
    const forzar = permiso > Date.now();
    if (forzar) await setSetting(KEY_FORZAR, '0');

    if (!forzar) {
      const p = await estadoPuente();
      if (estaVivo(p.ultimoVisto, Date.now()) && p.estado === 'listo') {
        await setSetting(KEY_FORZAR, String(Date.now() + FORZAR_MS));
        return {
          ok: false,
          motivo: 'otro_navegador',
          error: 'Ya hay otro navegador conectado y trabajando.',
          etiqueta: p.etiqueta || '',
        };
      }
    }
    const { token } = await crearTokenPuente(etiqueta);
    // ⚠️ EL NOMBRE DEL CLIENTE VIAJA, y se pinta en el pie del popup.
    //
    // La pestaña que abre la extensión no lleva `?ws=`, así que el workspace lo
    // resuelve la cookie de impersonación: un admin de agencia con un cliente
    // abierto empareja su navegador AL WORKSPACE DEL CLIENTE y gasta ahí sus
    // créditos de Flow, sin una sola pantalla que lo diga. Mostrarlo es la
    // diferencia entre un error que se ve y uno que se descubre a los tres días.
    return { ok: true, token, workspace: (await nombreDeWorkspace(ctx.ws)), wsId: ctx.ws };
  } catch (e) {
    // ⚠️ AL LOG TAMBIÉN. Este `return` viaja por tres saltos —action, evento del
    // DOM, mensaje de la extensión— y en cada uno se puede perder. Cuando una
    // clienta no podía conectar, el motivo real no estaba en NINGÚN lado: ni en
    // su pantalla, ni en la base, ni acá.
    console.error('[puente] no se pudo acuñar el token:', e);
    return { ok: false, motivo: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * El nombre del cliente, para el pie del popup. Su ausencia no rompe nada.
 *
 * Usa `getWorkspace` y no una consulta propia: la tabla `workspaces` se lee con
 * el cliente crudo cross-workspace, no con el scopeado — pedirla por `getTenantDb`
 * devolveria vacio y el pie quedaria mudo justo en el caso que viene a cubrir.
 */
async function nombreDeWorkspace(ws: number): Promise<string> {
  try {
    return String((await getWorkspace(ws))?.nombre ?? '');
  } catch {
    return '';
  }
}

/**
 * Solo el estado del puente. Es lo que la pantalla pregunta cada 15 s.
 *
 * Aparte de `estadoPruebaAction` a proposito: aquella trae ademas la ultima
 * prueba, que solo le importaba al panel de configuracion. Pedir dos datos para
 * usar uno es tráfico contra la base por algo que nadie mira — y ese panel ya no
 * existe: los cuatro pasos viven en el popup de la extension.
 *
 * Sin guard de admin: leer si el navegador propio esta conectado no es una
 * escritura, y `estadoPuente` ya viene scopeado por `getTenantDb`.
 */
export async function estadoPuenteAction(): Promise<Puente> {
  return estadoPuente();
}

export type PruebaOut =
  | { ok: true; trabajoId: number }
  | { ok: false; error: string };

/** Encola la prueba. No espera: el navegador la toma cuando pollea. */
export async function probarPuenteAction(): Promise<PruebaOut> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const id = await encolar('creditos', { path: ENDPOINTS.creditos, body: {} });
    if (id == null) return { ok: false, error: 'No se pudo encolar la prueba.' };
    return { ok: true, trabajoId: id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type EstadoPruebaOut = {
  puente: Puente;
  /** null = todavía nadie la tomó. */
  prueba: { estado: string; resultado: unknown; error: string; motivo: string } | null;
};

/**
 * Lo que la pantalla pregunta mientras espera.
 *
 * Devuelve el estado del puente Y el de la última prueba: sin los dos juntos, un
 * «no pasa nada» no distingue «el navegador no está conectado» de «está pero la
 * llamada falló», que son dos arreglos distintos.
 */
export async function estadoPruebaAction(trabajoId: number | null): Promise<EstadoPruebaOut> {
  const puente = await estadoPuente();
  if (trabajoId == null) return { puente, prueba: null };

  const db = await getTenantDb();
  const { data } = await db
    .from('flow_trabajos')
    .select('estado, resultado, error, motivo')
    .eq('id', trabajoId)
    .maybeSingle();

  return {
    puente,
    prueba: data
      ? {
        estado: String(data.estado ?? ''),
        resultado: data.resultado ?? null,
        error: String(data.error ?? ''),
        motivo: String(data.motivo ?? ''),
      }
      : null,
  };
}

/**
 * La segunda prueba: generar una IMAGEN de verdad.
 *
 * `creditos` prueba que el puente puede LEER. Esto prueba que puede ESCRIBIR, que
 * es lo que el producto necesita — y un circuito que solo lee no demuestra nada
 * sobre el que genera.
 *
 * Se eligió una imagen y no un clip porque en Flow las imágenes no consumen
 * créditos de video: la prueba de escritura sale gratis.
 *
 * ⚠️ El `body` va VACÍO a propósito. El cuerpo real lo arma la extensión copiando
 * el último `batchGenerateImages` que hizo la propia app de Flow y reemplazándole
 * el prompt. Armarlo acá sería volver a inventar un contrato de terceros, que es
 * lo que costó el 26/08 entero.
 */
export async function probarImagenAction(
  prompt: string,
): Promise<{ ok: true; trabajoId: number } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;

  const texto = prompt.trim();
  if (texto.length < 3) return { ok: false, error: 'Escribe qué imagen quieres generar.' };

  try {
    // ⚠️ `path` Y `parches`, NO `body`. Encolaba `{ body: { prompt } }` a secas, y
    // `extension/background.js` rechaza todo pedido sin un `path` que empiece con
    // `/v1`: «pedido sin path válido». O sea que este botón encolaba un trabajo,
    // lo cobraba como intento, y moría con un error que no nombra nada — un
    // control muerto puesto justo donde alguien va a probar si el puente anda.
    //
    // El molde es el call site que SÍ funciona (`video-action.ts`): el projectId
    // del path es de mentira a propósito —la extensión lo usa sólo para encontrar
    // la plantilla, de cuyo último tramo sale la clase, y copia la URL real
    // entera— y el prompt va por PARCHES porque `fundir()` reemplaza arrays: un
    // `requests` a medias perdería el modelo y la cara.
    const id = await encolar('generar_imagen', {
      path: ENDPOINTS.generarImagenes('x'),
      // La semilla FIJA y el `batchId` propio: es una prueba, no una generación
      // del anuncio, así que repetirla tiene que dar lo mismo y no puede pisar el
      // lote de nadie.
      parches: parchesImagenEscena({ prompt: texto.slice(0, 500), seed: 1, batchId: randomUUID() }),
    });
    if (id == null) return { ok: false, error: 'No se pudo encolar la prueba.' };
    return { ok: true, trabajoId: id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'falló al encolar' };
  }
}


/**
 * Vuelve a habilitar un puente que quedó `marcada`.
 *
 * El estado es de CONTENCIÓN y no se levanta solo, a propósito: un freno que se
 * suelta con un ciclo automático no frena nada. Pero hasta acá tampoco se
 * levantaba con NADA — el aviso decía «espera, borra las cookies, vuelve a
 * entrar» y después no había forma de decir «ya lo hice». La tab quedaba muerta
 * aunque el problema estuviera resuelto, y la única salida era que alguien
 * tocara la base.
 *
 * Esta es la acción explícita de la persona que el diseño ya pedía.
 */
export async function rehabilitarPuenteAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede hacer esto.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo.' };

  const db = await getTenantDb();
  await db.from('flow_puentes').update({ estado: 'listo', estado_detalle: '' }).eq('workspace_id', ws);

  // Y los trabajos que murieron POR LA MARCA se sacan de en medio: quedaron
  // fallidos por algo que ya se resolvió, y verlos en rojo al volver hace pensar
  // que sigue roto.
  //
  // ⚠️ ACOTADO POR MOTIVO, y antes borraba TODOS los fallidos del workspace.
  // Con eso se llevaba puesta la evidencia cruda de cualquier otra falla —de otro
  // motivo y de otro tipo de trabajo— justo cuando alguien está investigando por
  // qué algo no anda. Este módulo se esforzó en conservar esa evidencia
  // (`crudoGuardable`, «nunca se recorta el error»), y un botón la borraba entera.
  //
  // Lo que sobrevive es lo correcto: un fallo por contenido o por cuota no lo
  // resolvió volver a habilitar la sesión, así que sigue siendo verdad.
  await db.from('flow_trabajos').delete()
    .eq('workspace_id', ws)
    .eq('estado', 'fallido')
    .eq('motivo', 'sesion_marcada');
  return { ok: true };
}
