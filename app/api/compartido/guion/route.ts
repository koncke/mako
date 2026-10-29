// =============================================================================
// POST /api/compartido/guion — guardar un guion con un link para EDITAR, sin cuenta (docs/diseno-copywriter.md, D9)
// =============================================================================
// «Tu cliente entra y edita lo que le presentás» (Martín a Teo, 28/10/2026). Quien abre /compartido/<token> de un
// guion lo escribe en el mismo editor de la tab, y cada guardado viene acá.
//
// LA CREDENCIAL ENTERA ES EL TOKEN DEL LINK, y viaja en el CUERPO (lib/rutas-publicas.ts, PUBLICOS_ESCRITURA): esta
// ruta no lee la cookie de sesión. Cada pedido revalida el token contra la fila viva (`resolverToken`: revocar corta
// al instante) y pregunta `guionDelShare`, la MISMA puerta que la página.
//   · El id del guion sale de la FILA del link, nunca del pedido: no hay un `id` que cambiar para escribir otro.
//   · Corre en el workspace DEL LINK (`enSuWorkspace`): sin sesión, el de la pestaña sería el dueño de la plataforma.
//   · Desde afuera se escribe el cuerpo y el título. Las propiedades (tipo, ángulo, estructura) no: son del método.
//   · Lo que contesta no lleva nada del negocio: renombrar devuelve el árbol entero, y acá se contesta `{ ok }`.
//   · La marca de quién editó: el invitado de su link personal, o el nombre que escribió quien entró con el link.
// =============================================================================

import { clientIp, rateLimit } from '@/lib/rate-limit';
import { leerJsonTopeado } from '@/lib/curso-portal';
import { resolverToken } from '@/lib/shares';
import { accesoDeGuion, enSuWorkspace } from '@/lib/copywriter/compartir';
import { abrir, guardar, renombrar } from '@/lib/copywriter/server';
import { autorDeVisita } from '@/lib/copywriter/editado';
import { TOPES } from '@/lib/copywriter/tipos';

export const dynamic = 'force-dynamic';

const SIN_CACHE = { 'Cache-Control': 'no-store' };
const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status, headers: SIN_CACHE });
const falla = (status: number, error: string) => json({ ok: false, error }, status);
// Un token malo, revocado, de otro recurso o de un guion en la Papelera: lo mismo, sin el porqué.
const NO = () => falla(404, 'Este link ya no está disponible.');

/** El cuerpo más grande que se lee: el documento entero con su tope, y el resto del pedido. */
const TOPE_PEDIDO = TOPES.bytesContenido + 20_000;

export async function POST(req: Request) {
  // Por IP antes de leer nada: corta el barrido de tokens sin tocar la base. El autoguardado manda, como mucho, uno
  // por respiro (1,2 s): 120 por minuto le sobran a quien escribe.
  if (!rateLimit(`compartido-guion:ip:${clientIp(req)}`, 120, 60_000)) return falla(429, 'Muchos cambios seguidos: espera un momento.');
  const origen = req.headers.get('origin');
  let mismo = false;
  try { mismo = !!origen && new URL(origen).host === req.headers.get('host'); } catch { mismo = false; }
  if (!mismo) return falla(403, 'No salió de MaKo');

  const leido = await leerJsonTopeado(req, TOPE_PEDIDO);
  if (!leido.ok) return falla(leido.status, leido.status === 413 ? 'El guion es demasiado largo' : 'Pedido inválido');
  const b = (leido.valor && typeof leido.valor === 'object' && !Array.isArray(leido.valor) ? leido.valor : {}) as Record<string, unknown>;

  const acceso = await resolverToken(typeof b.token === 'string' ? b.token : '').catch(() => null);
  const a = accesoDeGuion(acceso);
  if (!a || !acceso) return NO();
  const autor = autorDeVisita(acceso.invitado, b.nombre);

  try {
    return await enSuWorkspace(a, async () => {
      // Vivo y fuera de la Papelera: un guion borrado no se edita por el link.
      const vivo = await abrir(a.id);
      if (!vivo.ok || vivo.pagina.papelera) return NO();
      switch (b.accion) {
        case 'guardar': {
          if (!Number.isInteger(b.version)) return falla(400, 'Falta la versión');
          if (b.contenido === undefined) return falla(400, 'Falta el guion');
          const r = await guardar({ id: a.id, version: b.version as number, contenido: b.contenido }, autor);
          if (r.ok) return json(r);
          return r.status === 409 ? json({ ok: false, error: r.error, conflicto: true }, 409) : falla(r.status, r.error);
        }
        case 'titulo': {
          if (typeof b.titulo !== 'string') return falla(400, 'Falta el título');
          const r = await renombrar(a.id, { titulo: b.titulo });
          return r.ok ? json({ ok: true }) : falla(r.status, r.error);
        }
        default:
          return falla(400, 'Acción desconocida');
      }
    });
  } catch (err) {
    console.error('[compartido:guion]', err instanceof Error ? err.message : err);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
