// =============================================================================
// reset-workspace — dejar un workspace de prueba como recién creado
// =============================================================================
// Vacía TODO lo que un cliente puede haber generado: sus tablas, su
// configuración, sus credenciales, sus archivos y su sesión de WhatsApp. Lo que
// NO toca, nunca: la fila del workspace, sus usuarios y sus roles — si se
// fueran, el cliente de prueba quedaría inaccesible y habría que crearlo de nuevo.
//
// Tres cinturones para que jamás corra contra un cliente real:
//   1. Este archivo tira si el destino no es WS_PRUEBA, antes de mirar nada más.
//   2. La ruta exige el mismo workspace antes de llamar.
//   3. El botón no se ofrece fuera del cliente de prueba.
// El que vale es el primero; los otros dos son comodidad.
//
// ⚠️ Los tres decían «que no sea el del dueño», que es una condición NEGATIVA:
// protegía a Mauricio y dejaba pasar a todos los demás. Vaciar el workspace de
// Leandro o de Leila estaba a un click de distancia y no había nada que lo
// frenara. Un guard contra lo destructivo se escribe en positivo —«solo ESTE»—
// porque la lista de lo que hay que proteger crece sola con cada cliente nuevo,
// y la de lo que se puede tocar no.
//
// Y una regla de implementación: se usa getSupabaseServer() CRUDO, con el
// .eq('workspace_id', ws) escrito a mano en un solo helper. getTenantDb()
// scopearía al workspace del REQUEST, que no tiene por qué ser el destino — un
// admin impersonando al cliente A podría vaciar al B sin enterarse.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { exigirClienteDePrueba } from './auth-session';
import { TABLAS_DE_INQUILINO } from './tablas-de-inquilino';

/**
 * Qué se vacía: TODAS las tablas de inquilino.
 *
 * ⚠️ ERA UNA LISTA ESCRITA A MANO Y ESTABA MAL EN LAS DOS DIRECCIONES. Medida contra
 * producción el 29/09/2026: nombraba 70 tablas, de las cuales CUATRO no existen
 * (`archivero`, `branding`, `contratos`, `meta_health_history` — nombres plausibles que
 * ningún compilador mira) y le faltaban 24 que sí. O sea que «vaciar un workspace»
 * vaciaba 66 de 90, y lo que quedaba se arrastraba a la corrida siguiente sin que nada
 * lo dijera. Ahora sale de `TABLAS_DE_INQUILINO`, que se midió contra el esquema real y
 * la comparte con el borrado de un cliente: dos listas para la misma pregunta es cómo
 * una de las dos se queda vieja.
 *
 * El orden alfabético no importa: el bucle reintenta en pasadas.
 */
const TABLAS_RESET = TABLAS_DE_INQUILINO;

/** Buckets con binarios prefijados por `<ws>/`. `avatars` NO: es por usuario. */
const BUCKETS = ['archivero', 'wa-media', 'contratos', 'branding', 'ig-media', 'ads-creatives', 'video-clips'] as const;

export type ResultadoReset = {
  borrado: Record<string, number>;
  archivos: number;
  avisos: string[];
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lista recursiva de un prefijo de storage, paginando de a 1000. */
async function listarRecursivo(bucket: string, prefijo: string, prof = 0): Promise<string[]> {
  if (prof > 4) return [];
  const sb = getSupabaseServer();
  const out: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(prefijo, { limit: 1000, offset });
    if (error || !data || !data.length) break;
    for (const it of data) {
      const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;
      // Sin `id` es una "carpeta" (prefijo virtual): hay que bajar.
      if (it.id) out.push(ruta);
      else out.push(...await listarRecursivo(bucket, ruta, prof + 1));
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return out;
}

/**
 * Borra las filas de las 89 tablas de inquilino, en pasadas: lo que falla por una FK
 * se reintenta, porque adentro de un workspace hay hijos antes que padres y un orden
 * escrito a mano es una lista más que se queda vieja.
 *
 * ⚠️ SIN GUARD A PROPÓSITO. Esta pieza no decide sobre quién corre — eso lo deciden sus
 * dos llamadores, y cada uno con el suyo: `resetearWorkspace` con
 * `exigirClienteDePrueba` y `eliminarWorkspace` con `motivoNoEliminable`. Meterle acá
 * el guard del reset fue lo que impidió, hasta hoy, reusarla para borrar.
 *
 * ⚠️ NO TOCA `usuarios` NI LA FILA DEL WORKSPACE: no están en la lista. Quien borre un
 * cliente los tiene que sacar aparte.
 */
export async function vaciarTablas(ws: number): Promise<{ borrado: Record<string, number>; avisos: string[] }> {
  const sb = getSupabaseServer();
  const borrado: Record<string, number> = {};
  const avisos: string[] = [];
  let pendientes: string[] = [...TABLAS_RESET];
  for (let pasada = 0; pasada < 3 && pendientes.length; pasada++) {
    const fallaron: string[] = [];
    for (const tabla of pendientes) {
      try {
        const { count, error } = await sb.from(tabla).delete({ count: 'exact' }).eq('workspace_id', ws);
        if (error) {
          fallaron.push(tabla);
          // ⚠️ SE DISTINGUE «no existe» DE «una FK la está frenando». Los dos llegan
          // como error y el reintento los trata igual, así que una tabla mal escrita se
          // reportaba tres pasadas después como si fuera un problema de integridad. Con
          // 42P01 no hay nada que reintentar: la tabla no está.
          const noExiste = (error as { code?: string }).code === '42P01';
          if (noExiste) { avisos.push(`${tabla}: esa tabla no existe en la base. Sácala de TABLAS_DE_INQUILINO.`); continue; }
          if (pasada === 2) avisos.push(`${tabla}: ${error.message}`);
          continue;
        }
        if (count) borrado[tabla] = (borrado[tabla] ?? 0) + count;
      } catch (e) {
        fallaron.push(tabla);
        if (pasada === 2) avisos.push(`${tabla}: ${msg(e)}`);
      }
    }
    pendientes = fallaron;
  }
  return { borrado, avisos };
}

/**
 * Vacía el workspace `ws`. Conserva la fila del workspace, sus usuarios y sus
 * roles: el cliente sigue existiendo y se puede entrar, solo que sin nada
 * adentro.
 */
export async function resetearWorkspace(ws: number): Promise<ResultadoReset> {
  // La condición vive en auth-session.ts (sin `server-only`) para que se pueda
  // testear: ver tests/reset-workspace.test.ts.
  exigirClienteDePrueba(ws);

  const sb = getSupabaseServer();
  const borrado: Record<string, number> = {};
  const avisos: string[] = [];

  // ── 1. Cortar la sesión de WhatsApp en el servidor de Evolution ──
  // Borrar la fila de evolution_instancias no desconecta nada: la sesión sigue
  // viva allá con el número pegado, y el próximo "conectar" encuentra la
  // instancia y nunca muestra un QR nuevo.
  try {
    const { runWithWorkspace } = await import('./workspace');
    const { desconectar } = await import('./evolution');
    await runWithWorkspace(ws, () => desconectar());
  } catch (e) {
    avisos.push(`WhatsApp no oficial: no se pudo cerrar la sesión (${msg(e)}). Si el código QR no aparece, desconecta el número manualmente desde la sección de WhatsApp.`);
  }

  // ── 1b. Borrar el clon de voz de la cuenta de ElevenLabs ──
  //
  // ⚠️ ANTES DE VACIAR `app_settings`, Y NO DESPUÉS. El `voiceId` vive ahí: si se
  // borra primero la fila, el clon se queda en la cuenta de la PLATAFORMA para
  // siempre y sin el id nadie lo puede volver a encontrar. Los slots de voz de un
  // plan son un techo de cuántos clientes entran, así que cada huérfano se paga.
  //
  // Y el `catch` AVISA en vez de callar: un catch mudo acá es exactamente lo que
  // produce el huérfano — el reset diría «listo» y el slot seguiría ocupado.
  try {
    const { runWithWorkspace } = await import('./workspace');
    const { getVozCliente } = await import('../app/video-generator/voz-cliente');
    const { borrarVoz } = await import('./elevenlabs');
    const voz = await runWithWorkspace(ws, () => getVozCliente());
    if (voz.clon?.voiceId) {
      const r = await borrarVoz(voz.clon.voiceId);
      if (!r.ok) {
        avisos.push(`Voz clonada: no se pudo borrar de ElevenLabs (${r.error}). Queda ocupando un espacio de voz en la cuenta de la plataforma; bórrala a mano — su identificador es ${voz.clon.voiceId}.`);
      }
    }
  } catch (e) {
    avisos.push(`Voz clonada: no se pudo comprobar si había una (${msg(e)}). Revisa las voces de la cuenta de ElevenLabs por si quedó una huérfana.`);
  }

  // ── 2. Tablas ──
  const vaciado = await vaciarTablas(ws);
  Object.assign(borrado, vaciado.borrado);
  avisos.push(...vaciado.avisos);

  // ── 2b. El funnel default vuelve, vacío ──
  //
  // Un workspace SIEMPRE tiene exactamente un funnel default (guard en positivo,
  // índice `funnels_ws_default_uk`, mig 0170). Vaciar la tabla lo deja en CERO, que
  // es un estado que no existe en el modelo: sin fila, `saveFunnelDefault` tendría
  // que inventarla y `getFunnelDefault` devuelve `origen:'sin-fila'` para siempre.
  // Nace SIN declarar y con `data` vacío, que es justo lo que se quiere después de
  // un reset: el cliente vuelve a declarar su embudo desde /funnel.
  try {
    const { error } = await sb.from('funnels')
      .insert({ workspace_id: ws, nombre: 'Funnel principal', data: {}, declarado: false, es_default: true });
    if (error) avisos.push(`No se pudo recrear el funnel vacío: ${error.message}. Créalo entrando a la pestaña Funnel.`);
  } catch (e) {
    avisos.push(`No se pudo recrear el funnel vacío: ${msg(e)}. Créalo entrando a la pestaña Funnel.`);
  }

  // ── 3. Binarios ──
  let archivos = 0;
  for (const bucket of BUCKETS) {
    try {
      const rutas = await listarRecursivo(bucket, String(ws));
      for (let i = 0; i < rutas.length; i += 100) {
        const { error } = await sb.storage.from(bucket).remove(rutas.slice(i, i + 100));
        if (error) { avisos.push(`${bucket}: ${error.message}`); break; }
        archivos += Math.min(100, rutas.length - i);
      }
    } catch (e) {
      avisos.push(`${bucket}: ${msg(e)}`);
    }
  }

  // Lo que este botón NO puede limpiar, dicho de frente en vez de prometido.
  avisos.push('Las notificaciones y los borradores de campañas de Meta no registran a qué workspace pertenecen, así que se conservan sin cambios.');

  return { borrado, archivos, avisos };
}
