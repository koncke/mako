// =============================================================================
// /api/crm/llamadas-grabadas — grabar una llamada desde MaKo (la ficha del lead y Cold Calling)
// =============================================================================
// GET  ?leadId=N                                          → { ok, grabaciones }         (las de ese lead, con su audio firmado)
// POST { accion:'empezar', leadId, origen, fuente, mime } → { ok, id }
// POST multipart: accion=parte, id, n, inicio, segundos, audio → { ok }               (una parte de 3 min; se transcribe por detrás)
// POST { accion:'terminar', id, partes, duracion, resultado? } → { ok }              (se analiza por detrás)
// POST { accion:'resultado', id, resultado }              → { ok }                     (cómo terminó, después)
// POST { accion:'reintentar', id }                        → { ok }                     (lo que se trabó: la IA, su Claude)
//
// Lo que decide vive en lib/grabar-llamada.ts (guardar, transcribir, analizar) y lib/grabar-llamada-reglas.ts (las partes, los
// tipos, qué se puede grabar). Esto sólo traduce HTTP. PRIVADA: no está en PUBLICOS (lib/rutas-publicas.ts) y además exige la
// sesión adentro, con el lead del workspace de la sesión. Sin chequeo de rol: closers y setters graban desde su ficha.
//
// ⚠️ LO LENTO CORRE EN `after()`: transcribir una parte y analizar la llamada. La persona sigue trabajando (cambia de lead o de
//    tab) y el trabajo no depende de que la pantalla siga abierta. Corre con la IA DEL NEGOCIO (`conSuIADelNegocio`, D6b) y en
//    su workspace (`procesarGrabacion` → `runWithWorkspace`).
// ⚠️ LAS PARTES VAN EN MULTIPART y miden ≤ 4 MB (lib/grabar-llamada-reglas.ts): Vercel corta todo POST de más de ~4,5 MB.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import {
  SinTablaError, crearGrabacion, grabacionesDeLead, guardarParte, marcarResultado, procesarGrabacion, terminarGrabacion,
} from '@/lib/grabar-llamada';
import { TOPE_BYTES_PARTE, esIdGrabacion, esOrigen, esResultado } from '@/lib/grabar-llamada-reglas';
import { buscarLeads } from '@/lib/crm-movil';

export const dynamic = 'force-dynamic';
// Transcribir una parte de 3 min y analizar una llamada con el Claude del negocio: hasta ~2 min cada uno, en `after()`.
export const maxDuration = 300;

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status });
const num = (v: unknown): number | null => { const n = typeof v === 'number' ? v : Number(String(v ?? '').trim()); return Number.isFinite(n) ? n : null; };
const id = (v: unknown): number | null => { const n = num(v); return n != null && Number.isInteger(n) && n > 0 ? n : null; };

/** La sesión y el negocio. Sin cookie (o una que no resuelve), 401: no se graba ni se lee a nombre de nadie. */
async function quien(): Promise<{ ws: number; usuarioId: number | null; autor: string } | null> {
  const s = await getUsuarioActual();
  const ws = s ? await getWorkspaceActual() : null;
  if (!s || ws == null) return null;
  const uid = Number(s.sub);
  return { ws, usuarioId: Number.isSafeInteger(uid) && uid > 0 ? uid : null, autor: s.nombre?.trim() || s.email };
}

/** Lo de fondo, en `after()`: con la IA del negocio, y sin tumbar nada si falla (queda escrito en la grabación). */
function porDetras(ws: number, grabacionId: string, o: { reintentar?: boolean; soloParte?: number } = {}) {
  after(async () => {
    try { await conSuIADelNegocio(ws, () => procesarGrabacion(ws, grabacionId, o)); }
    catch (e) { console.error(`[api/crm/llamadas-grabadas] ${grabacionId}:`, e instanceof Error ? e.message : String(e)); }
  });
}

const errorDe = (e: unknown): Response =>
  (e instanceof SinTablaError ? json({ ok: false, error: e.message }, 503) : json({ ok: false, error: 'No pude guardar la grabación. Vuelve a intentarlo.' }, 500));

export async function GET(req: NextRequest) {
  const q = await quien();
  if (!q) return json({ ok: false, error: 'No autorizado' }, 401);
  // Cold Calling: el buscador de leads de «Grabar llamada» en la hoja (app/_components/grabar/GrabarEnFrio.tsx). Es el MISMO buscador
  // del CRM del teléfono (`buscarLeads`: ~20 filas compactas, nunca la cartera).
  const buscar = req.nextUrl.searchParams.get('buscar');
  if (buscar != null) {
    try {
      const r = await buscarLeads(buscar.slice(0, 120));
      return json({ ok: true, filas: r.filas, hayMas: r.hayMas });
    } catch (e) {
      console.error('[api/crm/llamadas-grabadas] buscar', e instanceof Error ? e.message : String(e));
      return json({ ok: false, error: 'No pude buscar los leads.' }, 500);
    }
  }
  const leadId = id(req.nextUrl.searchParams.get('leadId'));
  if (!leadId) return json({ ok: false, error: 'Falta el lead.' }, 400);
  try {
    return json({ ok: true, grabaciones: await grabacionesDeLead(leadId) });
  } catch (e) {
    console.error('[api/crm/llamadas-grabadas] GET', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'No pude leer las grabaciones.' }, 500);
  }
}

export async function POST(req: NextRequest) {
  const q = await quien();
  if (!q) return json({ ok: false, error: 'No autorizado' }, 401);
  try {
    const tipo = (req.headers.get('content-type') ?? '').toLowerCase();
    if (tipo.startsWith('multipart/form-data')) {
      // El largo se mira ANTES de parsear: después del formData() el cuerpo ya está en memoria.
      if (Number(req.headers.get('content-length') ?? 0) > TOPE_BYTES_PARTE + 64_000) return json({ ok: false, error: 'Llegó una parte demasiado pesada.' }, 413);
      const form = await req.formData();
      const gid = String(form.get('id') ?? '');
      const n = num(form.get('n'));
      const audio = form.get('audio');
      if (!esIdGrabacion(gid) || n == null || !(audio instanceof File)) return json({ ok: false, error: 'Pedido inválido.' }, 400);
      const bytes = new Uint8Array(await audio.arrayBuffer());
      const r = await guardarParte({ ws: q.ws, grabacionId: gid, n, bytes, inicioSeg: num(form.get('inicio')) ?? 0, segundos: num(form.get('segundos')) });
      if (r) return json({ ok: false, error: r.error }, r.status);
      porDetras(q.ws, gid, { soloParte: n });
      return json({ ok: true });
    }

    let b: Record<string, unknown>;
    try { b = (await req.json()) as Record<string, unknown>; } catch { return json({ ok: false, error: 'Pedido inválido.' }, 400); }
    const accion = b.accion;

    if (accion === 'empezar') {
      const leadId = id(b.leadId);
      if (!leadId) return json({ ok: false, error: 'Falta el lead.' }, 400);
      const mime = typeof b.mime === 'string' ? b.mime : '';
      if (!/^audio\//.test(mime)) return json({ ok: false, error: 'Este navegador no graba audio.' }, 400);
      const r = await crearGrabacion({
        ws: q.ws, leadId, origen: esOrigen(b.origen) ? b.origen : 'ficha',
        fuente: b.fuente === 'microfono_y_pestana' ? 'microfono_y_pestana' : 'microfono', mime, usuarioId: q.usuarioId, autor: q.autor,
      });
      if ('error' in r) return json({ ok: false, error: r.error }, r.status);
      return json({ ok: true, id: r.id });
    }

    const gid = typeof b.id === 'string' ? b.id : '';
    if (!esIdGrabacion(gid)) return json({ ok: false, error: 'Pedido inválido.' }, 400);

    if (accion === 'terminar') {
      const partes = num(b.partes);
      const r = await terminarGrabacion({ grabacionId: gid, partesTotal: partes ?? -1, duracionSeg: num(b.duracion) ?? 0, resultado: esResultado(b.resultado) ? b.resultado : null });
      if (r) return json({ ok: false, error: r.error }, r.status);
      porDetras(q.ws, gid);
      return json({ ok: true });
    }
    if (accion === 'resultado') {
      const resultado = b.resultado == null ? null : esResultado(b.resultado) ? b.resultado : undefined;
      if (resultado === undefined) return json({ ok: false, error: 'Pedido inválido.' }, 400);
      return (await marcarResultado(gid, resultado)) ? json({ ok: true }) : json({ ok: false, error: 'No encuentro esa grabación.' }, 404);
    }
    if (accion === 'reintentar') {
      porDetras(q.ws, gid, { reintentar: true });
      return json({ ok: true });
    }
    return json({ ok: false, error: 'Pedido inválido.' }, 400);
  } catch (e) {
    console.error('[api/crm/llamadas-grabadas] POST', e instanceof Error ? e.message : String(e));
    return errorDe(e);
  }
}
