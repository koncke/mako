// =============================================================================
// meta-conexion — guardar la conexión de Meta de un workspace, venga de donde venga
// =============================================================================
// Hay dos puertas para conectar Meta: pegar un token (la acción `descubrir` de
// /api/integraciones/credencial) y el botón «Conectar con Meta» (el callback de
// /api/integraciones/meta). Las dos tienen que guardar LO MISMO, así que lo que se
// guarda vive acá y las dos lo llaman: con dos copias, la segunda se queda vieja.
//
// ⚠️ LA CONEXIÓN SON DOS TOKENS, y el que se olvida sigue mandando (AGENTS.md →
// «La conexión de Meta de un cliente son DOS tokens»). El de página guardado le gana
// al derivado, y lo leen por su cuenta la ingesta de leads y el webhook. Por eso,
// al cambiar el token de acceso, el de la página ACTUAL se re-deriva del token
// nuevo aunque haya varias páginas para elegir: si no, reconectar con la app MaKo
// deja los leads entrando con la app vieja, sin un solo error.

import 'server-only';
import { getSesionAdmin } from './auth';
import { auditarCredencial, credWs, guardarCredencial, IdentificadorOcupadoError } from './credenciales';
import { descubrirMeta, type Descubrimiento } from './meta-descubrir';
import { ENV_SECRETO_APP } from './meta-login';

/**
 * ¿Se ofrece el botón «Conectar con Meta» a esta sesión?
 *
 * Mientras la app MaKo no pase el App Review, Meta sólo deja entrar a quien tenga
 * un ROL en la app: a cualquier otro le muestra una pantalla de error suya, sin
 * salida. Un botón que lleva ahí se lee como que MaKo está rota, así que hasta
 * entonces se ofrece sólo al super admin (que sí tiene rol y lo puede probar con
 * sus propios activos). El día que Meta apruebe, se prende para todos con
 * `META_OAUTH_ABIERTO=true` en Vercel — sin deploy.
 *
 * Y sin el secreto cargado no se ofrece a nadie: el callback no podría canjear.
 */
export async function conectarMetaDisponible(): Promise<boolean> {
  if (!process.env[ENV_SECRETO_APP]?.trim()) return false;
  if (process.env.META_OAUTH_ABIERTO === 'true') return true;
  return (await getSesionAdmin()) != null;
}

export type ResultadoConexion = {
  d: Extract<Descubrimiento, { ok: true }>;
  /** Las claves que quedaron escritas. */
  guardadas: string[];
  /** Mensajes de las que no se pudieron escribir (identificador de otro workspace). */
  conflictos: string[];
};

/**
 * Lee la cuenta con `token` y guarda en `ws` todo lo inequívoco: el token (si
 * `guardarToken`), la cuenta, la página con su token y el píxel cuando hay UNO
 * solo. Con varios, decide la persona en el formulario.
 *
 * Nunca escribe en Meta: son lecturas. Devuelve el error de Meta tal cual si el
 * token no sirve, y en ese caso NO guarda nada — tampoco el token.
 */
export async function guardarConexionMeta(
  ws: number,
  token: string,
  autor: string | null,
  opts: { guardarToken: boolean },
): Promise<ResultadoConexion | { error: string }> {
  const d = await descubrirMeta(token);
  if (!d.ok) return { error: d.error };

  const aGuardar: Array<[string, string]> = [];
  if (opts.guardarToken) aGuardar.push(['META_ACCESS_TOKEN', token.trim()]);
  if (d.cuentas.length === 1) aGuardar.push(['META_AD_ACCOUNT_ID', d.cuentas[0].id]);
  if (d.paginas.length === 1) {
    aGuardar.push(['META_PAGE_ID', d.paginas[0].id]);
    if (d.paginas[0].token) aGuardar.push(['META_PAGE_ACCESS_TOKEN', d.paginas[0].token]);
  } else if (d.paginas.length > 1) {
    // La página que ya estaba elegida sigue siendo la elegida; lo que cambia es con
    // qué token se lee. Sin esto, el token de página quedaba el de la conexión vieja.
    const actual = await credWs('META_PAGE_ID', ws);
    const misma = actual ? d.paginas.find((p) => p.id === actual) : undefined;
    if (misma?.token) aGuardar.push(['META_PAGE_ACCESS_TOKEN', misma.token]);
  }
  if (d.pixeles.length === 1) aGuardar.push(['META_PIXEL_ID', d.pixeles[0].id]);

  // Campo por campo: que un identificador ya reclamado por otro workspace
  // (META_PAGE_ID rutea leads) no tumbe TODO lo demás.
  const guardadas: string[] = [];
  const conflictos: string[] = [];
  for (const [env, valor] of aGuardar) {
    try {
      await guardarCredencial(ws, env, valor, 'meta', autor);
      await auditarCredencial(ws, env, 'guardar', autor);
      guardadas.push(env);
    } catch (e) {
      if (e instanceof IdentificadorOcupadoError) {
        await auditarCredencial(ws, env, 'guardar', autor, { permitido: false, motivo: 'identificador ya reclamado por otro workspace' });
        conflictos.push(e.message);
        continue;
      }
      throw e;
    }
  }
  return { d, guardadas, conflictos };
}
