// =============================================================================
// POST /api/landing-generator/replicar — una landing de AFUERA → una landing nueva del editor
// =============================================================================
// Tanda 2, puntos 8 y 9 (docs/diseno-editor-landing.md, T5/T6): desde el diagnóstico de una landing
// de afuera, «Replicar en el editor». Desde la tanda 6 (decisión de Martín, 14/10/2026) con FORMATO:
//   { url, formato: 'presentacion' }  diapositivas 16:9 con el texto condensado;
//   { url, formato: 'landing' }       secciones editables con el texto tal cual;
//   { url, formato: 'web', foto }     la copia idéntica EDITABLE (28/10/2026): la foto de la página que sacó el lector en el
//                                     navegador de la persona → secciones «Diseño editable» (lib/editor-landing/copia-identica.ts);
//   { url, formato: 'web' }           sin foto (la API de MaKo), la de antes: su HTML y sus estilos en «HTML personalizado».
// Presentación y Landing aceptan además `lectura` (la página leída en el navegador de la persona,
// lib/editor-landing/lectura-tipos.ts) o `texto` (pegado): cualquiera de los dos reemplaza la bajada.
// El pedido VIEJO `{ url, modo: 'bloques' | 'fiel' }` se sigue aceptando mientras dure un deploy (una
// pestaña abierta con la pantalla anterior): 'bloques' = Landing, 'fiel' = Página web.
// 28/10/2026: `partes` (qué se replica: diseño, estructura, ángulos, texto), `tema` (el de la persona, sin el diseño de la
// original) y `angulos` (los de la lectura que vio la persona, ./leer). Sin `partes`, lo de siempre.
// Y con `enVivo: true` (AGENTS.md, «se ve CONSTRUYÉNDOSE»): la respuesta es un flujo NDJSON con una línea por cosa armada
// y, al final, `{ fase: 'fin', respuesta }` con la respuesta de siempre (la falla también va ahí, con su `probar` y su
// `enNavegador`). La puerta (rol, capa) contesta como siempre, sin flujo.
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
import { lineaDeEvento, type EventoReplica } from '@/lib/editor-landing/replicar-progreso';
import { borrarBorradorReplica } from '@/lib/editor-landing/replica-borrador-server';

/**
 * La copia salió: el borrador de esa dirección se va (ticket #54, lib/editor-landing/replica-borrador.ts). La copia ya es la
 * landing, en borrador sin publicar. Si no se pudo borrar, queda en la lista de «Sin terminar» y vence solo: no tumba la copia.
 */
const soltarBorrador = (url: unknown) => borrarBorradorReplica(url).catch((e: unknown) => console.error('[landing-generator/replicar] borrador:', e instanceof Error ? e.message : e));

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const falla = (status: number, error: string, extra: Partial<SeLeeEnNavegador> & { probar?: FormatoReplicar } = {}) =>
  Response.json({ ok: false, error, ...extra } satisfies RespuestaReplicar, { status });

/** Lo que contesta la ruta, sin el `status` interno: la misma forma con y sin flujo. */
function respuestaDe(r: Awaited<ReturnType<typeof replicar>>): RespuestaReplicar {
  if (r.ok) { const { status: _s, ...cuerpo } = r; void _s; return cuerpo; }
  return {
    ok: false, error: r.error,
    ...(r.enNavegador && r.motivo ? { pegable: true as const, enNavegador: true as const, motivo: r.motivo } : {}),
    ...(r.probar ? { probar: r.probar } : {}),
  };
}

export async function POST(req: Request) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return falla(401, 'no autenticado');
  if (rol !== 'admin') return falla(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('landing-writer', await getCapaActual())) return falla(404, 'No existe');

  let body: { url?: unknown; formato?: unknown; modo?: unknown; lectura?: unknown; texto?: unknown; adaptar?: unknown; partes?: unknown; tema?: unknown; angulos?: unknown; oferta?: unknown; foto?: unknown; enVivo?: unknown };
  try { body = await req.json(); } catch { return falla(400, 'body inválido'); }
  if (!body || typeof body !== 'object') return falla(400, 'body inválido');

  if (body.enVivo === true) {
    const b = body;
    const enc = new TextEncoder();
    const flujo = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        const enviar = (e: EventoReplica) => { try { ctrl.enqueue(enc.encode(lineaDeEvento(e))); } catch { /* se cerró del otro lado */ } };
        let respuesta: RespuestaReplicar;
        try {
          const r = await replicar({ url: b.url, formato: b.formato, modo: b.modo, lectura: b.lectura, texto: b.texto, partes: b.partes, tema: b.tema, angulos: b.angulos, oferta: b.oferta, adaptar: b.adaptar, foto: b.foto }, enviar);
          respuesta = respuestaDe(r);
          if (r.ok) await soltarBorrador(b.url);
        } catch (err) {
          console.error('[landing-generator/replicar] en vivo:', err instanceof Error ? err.message : err);
          respuesta = { ok: false, error: 'Algo falló. Vuelve a intentar.' };
        }
        enviar({ fase: 'fin', respuesta });
        ctrl.close();
      },
    });
    return new Response(flujo, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
  }

  try {
    const r = await replicar({ url: body.url, formato: body.formato, modo: body.modo, lectura: body.lectura, texto: body.texto, partes: body.partes, tema: body.tema, angulos: body.angulos, adaptar: body.adaptar, foto: body.foto });
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
    await soltarBorrador(body.url);
    return Response.json(cuerpo satisfies RespuestaReplicar);
  } catch (err) {
    // replicar no tira (devuelve {ok:false}); esto es la red por si algo de afuera lo hace.
    console.error('[landing-generator/replicar]', err instanceof Error ? err.message : err);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
