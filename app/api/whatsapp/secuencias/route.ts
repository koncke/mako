// =============================================================================
// API interna: secuencias de nutrición para la tab /whatsapp
// =============================================================================
// GET   → todas las secuencias (activas y pausadas) + inscriptos/enviados.
// PATCH → activar/pausar una secuencia, sus pasos o su línea. Body: { id, activa?, pasos?, linea? }.
//         Los pasos llevan los campos del flujo con ramas (id, siguiente, nodo, espera, ramas,
//         casos, si_no, destino, revisar, media_id): `setSecuenciaPasos` los sanea, normaliza y
//         valida (`validarGrafo`). Un flujo que no se puede guardar contesta 400 con el motivo.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSecuenciasConStats, setSecuenciaActiva, setSecuenciaPasos, setSecuenciaLinea, PasosInvalidosError, type PasoSecuencia } from '@/lib/nutricion';
import { getRolWsEfectivo } from '@/lib/workspace';
import { envioWhatsappHabilitado, envioEmailHabilitado } from '@/lib/envio-flags';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const etapa = req.nextUrl.searchParams.get('etapa') || '';
    const [todas, envioWhatsapp, envioEmail] = await Promise.all([
      getSecuenciasConStats(),
      envioWhatsappHabilitado(),
      envioEmailHabilitado(),
    ]);
    const secuencias = etapa ? todas.filter((s) => s.etapa === etapa) : todas;
    return Response.json({ ok: true, secuencias, envioWhatsapp, envioEmail });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/secuencias GET] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Config de secuencias = solo admin del workspace (igual que /api/email/secuencias
  // y /api/mako/nutricion). Antes cualquier miembro autenticado podía reescribir pasos.
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede editar las secuencias.' }, { status: 403 });
  }
  let body: { id?: unknown; activa?: unknown; pasos?: unknown; linea?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  }
  try {
    if (Array.isArray(body.pasos)) {
      await setSecuenciaPasos(id, body.pasos as PasoSecuencia[]);
    }
    if (typeof body.activa === 'boolean') {
      await setSecuenciaActiva(id, body.activa);
    }
    // De qué línea sale (`null` o "" = la de por default). La valida lib/nutricion.ts.
    if ('linea' in body) {
      await setSecuenciaLinea(id, typeof body.linea === 'string' && body.linea.trim() ? body.linea.trim() : null);
    }
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Lo que no es un flujo válido es un error del que guarda, no del servidor: 400, con el
    // primer motivo, que es lo que la pantalla muestra.
    if (err instanceof PasosInvalidosError) return Response.json({ ok: false, error: msg }, { status: 400 });
    console.error(`[api:whatsapp/secuencias PATCH] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
