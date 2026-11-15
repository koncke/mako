// =============================================================================
// POST /api/copywriter/ia — MaKo en el Copywriter: «Discutir» (contesta) y «Editar» (escribe en el guion)
// =============================================================================
// El trabajo vive en lib/copywriter/ia.ts; acá la puerta, los archivos y el pase de campos. La puerta es la de
// /api/copywriter (`soloAdminDeTab('copywriter')` + `veCopywriter`): sin eso, quien no ve la tab usaba por acá la IA del
// negocio. Los archivos del mensaje llegan en multipart y se leen con el lector compartido de los chats
// (lib/adjuntos-del-chat.ts): al modelo va lo leído, nunca el archivo. Lo citado con «@» viaja como ids y se lee en el
// server, del negocio de la pestaña (lib/copywriter/referencias.ts).
// «Editar» NO guarda nada: devuelve las herramientas validadas y la pantalla las construye como propuesta.
// maxDuration 300: leer los archivos corta a los 90 s y «Editar» a los 110 (más la reparación del JSON).
// ⚠️ LA SEGUNDA PUERTA ES EL PLAN (14/11/2026, lib/copywriter/replica-candado.ts): una página con `props.outlier` ES una réplica,
// y acá el original entero entra al prompt y vuelve el guion adaptado (lib/copywriter/ia.ts, `conElOriginal`). Sin eso, un
// Esencial se llevaba la réplica COMPLETA por esta ruta sin tocar ninguna de las puertas de «Replicar».
// =============================================================================

import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { veCopywriter } from '@/app/copywriter/acceso';
import { cuerpoYArchivos, leerLosArchivos } from '@/lib/adjuntos-del-chat';
import { discutir, editar, FEATURE_COPY } from '@/lib/copywriter/ia';
import { candadoDeReplicarGuionEnPantalla } from '@/lib/copywriter/replica-candado';
import { sanearProps } from '@/lib/copywriter/tipos';
import { sanearReferencias } from '@/lib/copywriter/referencias-reglas';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const falla = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const cerrada = await soloAdminDeTab('copywriter');
  if (cerrada) return cerrada;
  if (!(await veCopywriter())) return falla(404, 'No existe');

  const c = await cuerpoYArchivos(req);
  if (!c.ok) return falla(c.status, c.error);
  const b = c.body;
  const guion = (b.guion && typeof b.guion === 'object' ? b.guion : {}) as Record<string, unknown>;
  const referencias = sanearReferencias(b.referencias);

  // SÓLO MaKo Pro (14/11/2026, lib/copywriter/replica-candado.ts): replicar el guion de otro es de Pro, y una página con
  // `props.outlier` (`spy:`, `biblioteca:` o `pegado:`) es justo eso: el original se lee en el server y va en CADA pedido de esa
  // página, en «Editar» y también en «Discutir» («dime el gancho de éste con mi oferta» es la réplica igual).
  // Lo que NO frena, que está en los dos planes: escribir un guion desde cero, una plantilla y «Adaptar a mi negocio» (ésa es
  // `props.plantilla`). Va ANTES de leer los archivos del mensaje, que es lo que cuesta, y el 403 lleva `pasarAPro`, la marca que
  // la pantalla reconoce para prender el candado en todas las entradas a la vez (app/_components/solo-pro.ts).
  if (sanearProps(guion.props).outlier) {
    const pro = await candadoDeReplicarGuionEnPantalla();
    if (pro) return Response.json({ ok: false, ...pro }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const leidos = c.adjuntos.length ? await leerLosArchivos(c.adjuntos, FEATURE_COPY) : { lecturas: [], noLeidos: [] };
    switch (b.accion) {
      case 'discutir': {
        const r = await discutir({ pregunta: b.pregunta, guion, charla: b.charla, lecturas: leidos.lecturas, referencias });
        if (!r.ok) return falla(r.status, r.error);
        return Response.json({ ...r, noLeidos: [...leidos.noLeidos, ...r.noLeidas] }, { headers: { 'Cache-Control': 'no-store' } });
      }
      case 'editar':
      // «Adaptar a mi negocio» (29/10/2026): `editar` con el pedido de adaptar la plantilla (lib/copywriter/experto.ts).
      case 'adaptar': {
        const r = await editar({ instruccion: b.instruccion, guion, charla: b.charla, lecturas: leidos.lecturas, referencias, adaptar: b.accion === 'adaptar' });
        if (!r.ok) return falla(r.status, r.error);
        return Response.json({ ...r, noLeidos: [...leidos.noLeidos, ...r.noLeidas] }, { headers: { 'Cache-Control': 'no-store' } });
      }
      default:
        return falla(400, 'Acción desconocida');
    }
  } catch (err) {
    console.error(`[copywriter/ia:${String(b.accion ?? '?')}]`, err instanceof Error ? err.message : err);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
