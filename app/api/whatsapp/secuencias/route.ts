// =============================================================================
// API interna: secuencias de nutrición para la tab /whatsapp
// =============================================================================
// GET   → todas las secuencias (activas y pausadas) + inscriptos/enviados.
// PATCH → activar/pausar una secuencia, sus pasos o su línea. Body: { id, activa?, pasos?, linea? }.
//         Con `pasos` (Publicar), un medio sin conectar contesta 409 { error: 'Conecta tu WhatsApp', medio }.
//         Los pasos llevan los campos del flujo con ramas (id, siguiente, nodo, espera, ramas,
//         casos, si_no, destino, revisar, media_id): `setSecuenciaPasos` los sanea, normaliza y
//         valida (`validarGrafo`). Un flujo que no se puede guardar contesta 400 con el motivo.
//         Con `visto` = { base, guardado_at } (el teléfono publica un borrador que LEYÓ), 409
//         { desactualizado } si lo publicado o el borrador ya no son los que vio (`comprobarVisto`).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSecuenciasConStats, setSecuenciaActiva, setSecuenciaPasos, setSecuenciaLinea, vozDeAIStepQueFalta, PasosInvalidosError, type PasoSecuencia } from '@/lib/nutricion';
import { getRolWsEfectivo, getTenantDb } from '@/lib/workspace';
import { envioWhatsappHabilitado, envioEmailHabilitado } from '@/lib/envio-flags';
import { lineaDeSecuencia, medioSinConectar } from '@/lib/disparadores-canales';
import { comprobarVisto, type DbBorrador } from '@/lib/secuencia-borrador';

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
  let body: { id?: unknown; activa?: unknown; pasos?: unknown; linea?: unknown; visto?: unknown };
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
      // ⚠️ PUBLICAR DESDE UNA FOTO (MaKo Mobile, 12/10/2026): el teléfono publica el borrador TAL COMO LO
      // LEYÓ, quizá hace horas. Si después la computadora guardó otro borrador o publicó otra cosa, publicar
      // esa foto revertía lo nuevo (y salía a los leads). Con `visto`, no se escribe nada si la fila ya no es
      // la que se vio (lib/secuencia-borrador.ts). Sin `visto` (el lienzo, que publica lo suyo), como siempre.
      if (body.visto !== undefined) {
        const c = await comprobarVisto((await getTenantDb()) as unknown as DbBorrador, id, body.visto);
        if (!c.ok && c.motivo === 'no_existe') return Response.json({ ok: false, error: 'Esa automatización no existe en este negocio.' }, { status: 404 });
        if (!c.ok) return Response.json({ ok: false, desactualizado: true, error: 'La automatización cambió desde que la abriste.' }, { status: 409 });
      }
      // PUBLICAR NO DEJA UN MEDIO SIN CONECTAR (décima tanda, GENERAL 6: «no dejar publicarlo hasta que no lo
      // configure»): 409 con el medio, que la pantalla usa para abrir «Conectar» ahí mismo. Sólo acá, que es
      // Publicar: guardar un borrador no pasa por esta ruta. «No pude comprobarlo» no frena.
      const linea = 'linea' in body
        ? (typeof body.linea === 'string' && body.linea.trim() ? body.linea.trim() : null)
        : await lineaDeSecuencia(id).catch(() => null);
      const falta = await medioSinConectar(body.pasos as PasoSecuencia[], linea).catch(() => null);
      if (falta) return Response.json({ ok: false, error: falta.error, medio: falta.medio }, { status: 409 });
      // Y la voz de un AI Step que contesta en audio (AI Step v2, §1). «No pude comprobarlo» no frena.
      const sinVoz = await vozDeAIStepQueFalta(body.pasos as PasoSecuencia[]).catch(() => null);
      if (sinVoz) return Response.json({ ok: false, error: `No se guardó: ${sinVoz}.` }, { status: 400 });
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
    // Con la TARJETA culpable cuando el error es de una (los datos que no existen, undécima tanda): el lienzo la abre.
    if (err instanceof PasosInvalidosError) return Response.json({ ok: false, error: msg, ...(err.tarjeta ? { tarjeta: err.tarjeta } : {}) }, { status: 400 });
    console.error(`[api:whatsapp/secuencias PATCH] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
