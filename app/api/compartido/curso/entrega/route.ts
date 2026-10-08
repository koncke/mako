// =============================================================================
// POST /api/compartido/curso/entrega
//   {t, c, a?, accion: 'subir', campo, mime, bytes}          → {ok, path, signedUrl, apikey}
//   {t, c, a?, accion: 'ver', path, nombre?}                  → {ok, url}
// =============================================================================
// Los ARCHIVOS de una tarea del alumno (los campos `archivo`, `audio` y `video` de lib/curso.ts, item
// 18 del curso tipo Skool, 07/10/2026), desde su portal SIN sesión. El archivo NO pasa por acá: esta
// ruta FIRMA la subida y el navegador lo sube directo al bucket privado `curso-entregas` (mig 0218)
// con barra de progreso (xhr). Una ruta que recibiera el archivo topa en 1 MB (AGENTS.md, «tres
// topes del entorno»). Lo que queda en la tarea es la referencia, y la guarda /api/compartido/curso/
// tarea, que vuelve a verificar que el path sea de este alumno y esta clase y que haya llegado
// (lib/curso-entregas.ts, `verificarEntregas`).
//
// ⚠️ LAS MISMAS PUERTAS QUE LA TAREA, en el mismo orden (tests/curso-tareas-tipos.test.ts lo fija):
//   1. Rate limit por IP antes de leer nada, y por ALUMNO después de resolverlo.
//   2. El WORKSPACE SALE DE LA FIRMA del token (`leerTokenPortal(t).ws`), nunca de un parámetro, y
//      todo corre adentro de `runWithWorkspace`, empezando por `resolverAccesoPortal`.
//   3. EL CANDADO: `claseDelAlumno` con `exigeAbierta: true` y el área del acceso. Una clase
//      cerrada (su candado o el de su módulo) no se contesta (403), y una ajena o inexistente es 404 — igual que un token
//      inválido, para no ayudar a enumerar ids. Al líder de un área sólo se le abren sus clases.
//   4. El ÁREA: la que corresponde a este acceso (`areaDeLaTarea`). Un área que no le toca: 404.
//   5. El campo tiene que ser de ESA clase y recibir archivos; el tipo, uno que ese campo acepta; el
//      tamaño, el del bucket.
// El DUEÑO del archivo (workspace, producto, alumno, clase) lo pone esta ruta desde la firma y la
// clase, y va adentro del path: es lo que después deja contestar «¿esto es suyo?» con un prefijo.
//
// ⚠️ ANTES DE FIRMAR SE CUENTA LO QUE YA SUBIÓ HOY (revisión del 08/10/2026, `topeDeSubidasAlcanzado`
// en lib/curso.ts): cada firma es un archivo de hasta 100 MB, y el Storage tiene 5 GiB para toda la
// plataforma. Sin tope, un link filtrado lo llenaba en dos minutos y se le cortaban las subidas a
// todos los clientes. Más el rate limit propio de `subir`, que acota las firmas pedidas de golpe.
//
// ⚠️ `ver`: el link de vida corta para que el alumno vuelva a escuchar o abrir lo que entregó. Sólo
// un path de ESTE alumno en ESTA clase (`pathEsDeEntrega`); el path viaja desde su navegador.
//
// ⚠️ ESTA RUTA ESCRIBE (firma una subida al bucket) y va en `PUBLICOS_ESCRITURA`
// (lib/rutas-publicas.ts), al lado de `progreso` y `tarea`. Sin eso el proxy la corta en producción
// antes de que corra, y en local no se ve (AGENTS.md, «Una ruta con auth propia va en
// lib/rutas-publicas.ts»).

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { leerTokenPortal } from '@/lib/curso-acceso';
import { resolverAccesoPortal, avanceDelCliente } from '@/lib/curso-datos';
import { esCampoDeArchivo, tieneTarea, mimeBase, type DuenoEntrega } from '@/lib/curso';
import { claseDelAlumno, areaDeLaTarea, leerJsonTopeado, idDeClase } from '@/lib/curso-portal';
import { urlSubidaEntrega, urlVerEntrega } from '@/lib/curso-entregas';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

/** El cuerpo es un puñado de campos cortos: el archivo nunca viaja por acá. */
const TOPE_PEDIDO = 4_000;

const SIN_CACHE = { 'Cache-Control': 'private, no-store' };
const NO = () => Response.json({ ok: false }, { status: 404, headers: SIN_CACHE });
const MUCHO = () => Response.json({ ok: false, error: 'demasiados pedidos' }, { status: 429, headers: SIN_CACHE });
const MAL = (error: string) => Response.json({ ok: false, error }, { status: 400, headers: SIN_CACHE });

export async function POST(req: NextRequest) {
  if (!rateLimit(`curso-entrega:ip:${clientIp(req)}`, 60, 60_000)) return MUCHO();

  const cuerpo = await leerJsonTopeado(req, TOPE_PEDIDO);
  if (!cuerpo.ok) return Response.json({ ok: false }, { status: cuerpo.status, headers: SIN_CACHE });
  const b = (cuerpo.valor && typeof cuerpo.valor === 'object' ? cuerpo.valor : {}) as Record<string, unknown>;
  const token = typeof b.t === 'string' ? b.t : '';
  const claseId = idDeClase(b.c);
  const accion = b.accion === 'subir' || b.accion === 'ver' ? b.accion : null;
  if (!claseId || !accion) return NO();

  const firma = leerTokenPortal(token);
  if (!firma) return NO();

  return runWithWorkspace(firma.ws, async () => {
    const acceso = await resolverAccesoPortal(token);
    if (!acceso) return NO();
    // Por ALUMNO, como la tarea: el cliente y sus líderes comparten el tope. Subir es raro (un
    // archivo por vez, con su barra); 30 por minuto cubre volver a abrir lo entregado varias veces.
    if (!rateLimit(`curso-entrega:lead:${acceso.ws}:${acceso.leadId}`, 30, 60_000)) return MUCHO();
    // ⚠️ FIRMAR UNA SUBIDA TIENE SU PROPIO TOPE, más corto (revisión del 08/10/2026). Cada firma es un
    // archivo de hasta 100 MB, y el tope por DÍA (`urlSubidaEntrega`) cuenta lo que ya LLEGÓ al bucket:
    // diez firmas pedidas de golpe no las ve hasta que suben. Esto acota esa ráfaga. 12 cubre elegir
    // los diez archivos de un campo de una vez (`MAX_ARCHIVOS`). Es por instancia (lib/rate-limit.ts).
    if (accion === 'subir' && !rateLimit(`curso-entrega:subir:${acceso.ws}:${acceso.leadId}`, 12, 60_000)) return MUCHO();
    try {
      const r = await claseDelAlumno(acceso.leadId, claseId, { exigeAbierta: true, lider: acceso.area, alcance: acceso.alcance });
      if (r.decision !== 'ok') {
        return r.decision === 'bloqueada'
          ? Response.json({ ok: false, error: 'clase cerrada' }, { status: 403, headers: SIN_CACHE })
          : NO();
      }
      if (!tieneTarea(r.clase)) return NO();
      const areas = r.clase.porArea === true && acceso.area == null ? (await avanceDelCliente(acceso.leadId)).areas : [];
      if (areaDeLaTarea(r.clase, acceso, b.a, areas) == null) return NO();

      const dueno: DuenoEntrega = { ws: acceso.ws, productoId: r.clase.productoId, leadId: acceso.leadId, claseId: r.clase.id };

      if (accion === 'ver') {
        const v = await urlVerEntrega(dueno, b.path, b.nombre);
        return v.ok ? Response.json({ ok: true, url: v.url }, { headers: SIN_CACHE }) : NO();
      }

      // accion === 'subir'
      const campo = r.clase.campos.find((c) => c.id === b.campo);
      if (!campo || !esCampoDeArchivo(campo.tipo)) return NO();
      const mime = mimeBase(typeof b.mime === 'string' ? b.mime : '');
      const bytes = typeof b.bytes === 'number' ? b.bytes : NaN;
      const s = await urlSubidaEntrega(dueno, campo, mime, bytes);
      if (!s.ok) return MAL(s.error);
      return Response.json({ ok: true, path: s.path, signedUrl: s.signedUrl, apikey: s.apikey }, { headers: SIN_CACHE });
    } catch (e) {
      console.error('[curso-portal] no pude preparar la entrega:', e instanceof Error ? e.message : e);
      return Response.json({ ok: false, error: 'no se pudo' }, { status: 500, headers: SIN_CACHE });
    }
  });
}
