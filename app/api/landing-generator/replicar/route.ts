// =============================================================================
// POST /api/landing-generator/replicar — una landing de AFUERA → una landing nueva del editor
// =============================================================================
// Tanda 2, puntos 8 y 9 (docs/diseno-editor-landing.md, T5/T6): desde el diagnóstico de una landing
// de afuera, «Replicar en el editor». Desde la tanda 6 (decisión de Martín, 14/10/2026) con FORMATO:
//   { url, formato: 'presentacion' }  diapositivas 16:9 con el texto condensado;
//   { url, formato: 'landing' }       secciones editables con el texto tal cual;
//   { url, formato: 'web' }           la copia idéntica (su HTML y sus estilos en «HTML personalizado»).
// Presentación y Landing aceptan además `lectura` (la página leída en el navegador de la persona,
// lib/editor-landing/lectura-tipos.ts) o `texto` (pegado): cualquiera de los dos reemplaza la bajada.
// El pedido VIEJO `{ url, modo: 'bloques' | 'fiel' }` se sigue aceptando mientras dure un deploy (una
// pestaña abierta con la pantalla anterior): 'bloques' = Landing, 'fiel' = Página web.
//
// Contesta `RespuestaReplicar` (lib/editor-landing/replicar-reglas.ts): `{ ok, id, titulo, secciones,
// formato, aviso?, animaciones?, avisoScroll? }` (las dos últimas, tanda 8: las animaciones copiadas como Landing
// y si la original seguía al scroll), con el id de la landing NUEVA para abrirla en el editor; o la falla, que si la
// página no se lee desde el server trae `pegable`, `enNavegador` y `motivo` (HTTP 422), y si el error
// propone otro formato, `probar` (una app de Vite en «Página web» → «Landing», 422). El trabajo vive
// en lib/editor-landing/replicar.ts; acá sólo la puerta.
//
// La puerta es la de todo /api/landing-generator: admin del workspace y la tab `landing-writer` en su
// capa (sin el rol, un closer usaría por acá la IA y la red que su pantalla le esconde).
// maxDuration 300: por bloques corre las tandas de la IA con un plazo total de 240 s.
// =============================================================================

import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { replicar } from '@/lib/editor-landing/replicar';
import type { FormatoReplicar, RespuestaReplicar } from '@/lib/editor-landing/replicar-reglas';
import type { SeLeeEnNavegador } from '@/lib/editor-landing/lectura-tipos';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const falla = (status: number, error: string, extra: Partial<SeLeeEnNavegador> & { probar?: FormatoReplicar } = {}) =>
  Response.json({ ok: false, error, ...extra } satisfies RespuestaReplicar, { status });

export async function POST(req: Request) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return falla(401, 'no autenticado');
  if (rol !== 'admin') return falla(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('landing-writer', await getCapaActual())) return falla(404, 'No existe');

  let body: { url?: unknown; formato?: unknown; modo?: unknown; lectura?: unknown; texto?: unknown };
  try { body = await req.json(); } catch { return falla(400, 'body inválido'); }
  if (!body || typeof body !== 'object') return falla(400, 'body inválido');

  try {
    const r = await replicar({ url: body.url, formato: body.formato, modo: body.modo, lectura: body.lectura, texto: body.texto });
    // `probar` (verificación de la tanda 6): el formato que sí puede andar, si el error lo propone; la pantalla
    // lo ofrece como botón («Replicar como Landing»).
    if (!r.ok) {
      return falla(r.status ?? 400, r.error, {
        ...(r.enNavegador && r.motivo ? { pegable: true, enNavegador: true, motivo: r.motivo } : {}),
        ...(r.probar ? { probar: r.probar } : {}),
      });
    }
    const { status: _s, ...cuerpo } = r;
    void _s;
    return Response.json(cuerpo satisfies RespuestaReplicar);
  } catch (err) {
    // replicar no tira (devuelve {ok:false}); esto es la red por si algo de afuera lo hace.
    console.error('[landing-generator/replicar]', err instanceof Error ? err.message : err);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
