// =============================================================================
// Dejar de recibir los correos de AVANCE de tus tickets (4/11/2026)
// =============================================================================
// El link del pie de cada correo de avance (lib/tickets-avance-email.ts). Es por PERSONA: apaga `ticketsPorEmail` en
// su `usuarios.perfil` (lib/tickets-avance.ts → CLAVE_PERFIL_CORREOS), y la vuelta del cron no le escribe más.
//
//   GET  ?u=<usuario>&t=<firma>  → una página con UN botón. ⚠️ El GET NO APAGA nada: los antivirus de los correos
//                                  abren los links solos, y un GET que apaga los apagaría sin que la persona lo pida.
//   POST (el botón)              → apaga (o, con `accion=prender`, los vuelve a prender) y muestra el resultado.
//   POST One-Click (RFC 8058)    → el «Cancelar suscripción» de Gmail y Outlook: apaga y contesta 200.
//
// Es pública (vive bajo /api/email/unsubscribe, lib/rutas-publicas.ts): quien la abre no tiene sesión. La autentica la
// firma (`verificarBajaTickets`, lib/resend.ts), con un prefijo propio: la de la baja de un lead no sirve acá.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { verificarBajaTickets } from '@/lib/resend';
import { CLAVE_PERFIL_CORREOS, apagoLosCorreos } from '@/lib/tickets-avance';

export const dynamic = 'force-dynamic';

type Pedido = { id: number; token: string };

/** Sólo un número y una firma hexadecimal: lo que se vuelve a escribir en la página no puede traer otra cosa. */
function leer(req: NextRequest): Pedido | null {
  const url = new URL(req.url);
  const u = url.searchParams.get('u') ?? '';
  const t = url.searchParams.get('t') ?? '';
  if (!/^\d{1,12}$/.test(u) || !/^[0-9a-f]{32}$/.test(t)) return null;
  const id = Number(u);
  return verificarBajaTickets(id, t) ? { id, token: t } : null;
}

function pagina(titulo: string, detalle: string, boton?: { p: Pedido; accion: 'apagar' | 'prender'; texto: string }, status = 200): Response {
  const form = boton
    ? `<form method="post" action="/api/email/unsubscribe/tickets?u=${boton.p.id}&amp;t=${boton.p.token}" style="margin-top:20px;">
<input type="hidden" name="accion" value="${boton.accion}">
<button type="submit" style="font:inherit;font-size:15px;font-weight:600;padding:10px 18px;border-radius:10px;border:1px solid #1A1813;background:#1A1813;color:#fff;cursor:pointer;">${boton.texto}</button>
</form>`
    : '';
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo}</title></head>
<body style="margin:0;background:#F2F0EA;font-family:'Helvetica Neue',Arial,sans-serif;color:#1A1813;">
<div style="max-width:480px;margin:64px auto;padding:32px;background:#fff;border:1px solid #E7E3D9;border-radius:14px;text-align:center;">
<div style="font-size:20px;font-weight:600;">${titulo}</div>
<div style="margin-top:10px;color:#6B675C;font-size:15px;line-height:1.5;">${detalle}</div>${form}
</div></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

const LINK_MALO = () => pagina('Este enlace no sirve', 'Ábrelo desde el último correo de tu ticket.', undefined, 400);

/** Lee el perfil de la persona. null = no existe o no se pudo leer. */
async function perfilDe(id: number): Promise<Record<string, unknown> | null> {
  const { data, error } = await getSupabaseServer().from('usuarios').select('perfil').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const p = (data as { perfil?: unknown }).perfil;
  return p && typeof p === 'object' ? (p as Record<string, unknown>) : {};
}

/** Apaga o prende. El jsonb `perfil` se escribe ENTERO, así que se parte de lo que hay (lib/perfil.ts). */
async function cambiar(id: number, prender: boolean): Promise<boolean> {
  const perfil = await perfilDe(id);
  if (!perfil) return false;
  const nuevo = { ...perfil };
  if (prender) delete nuevo[CLAVE_PERFIL_CORREOS];
  else nuevo[CLAVE_PERFIL_CORREOS] = false;
  const { error } = await getSupabaseServer().from('usuarios').update({ perfil: nuevo, updated_at: new Date().toISOString() }).eq('id', id);
  return !error;
}

export async function GET(req: NextRequest) {
  const p = leer(req);
  if (!p) return LINK_MALO();
  const perfil = await perfilDe(p.id);
  if (!perfil) return pagina('No pude abrir tus correos', 'Vuelve a intentarlo en un rato.', undefined, 503);
  if (apagoLosCorreos(perfil)) {
    return pagina('Ya no te llegan', 'Los avances de tus tickets los ves en MaKo, en Tickets.', { p, accion: 'prender', texto: 'Volver a recibirlos' });
  }
  return pagina('¿Dejar de recibir estos correos?', 'Son los avances de tus tickets. Los vas a seguir viendo en MaKo, en Tickets.', { p, accion: 'apagar', texto: 'Dejar de recibirlos' });
}

export async function POST(req: NextRequest) {
  const p = leer(req);
  const cuerpo = new URLSearchParams(await req.text().catch(() => ''));
  const unToque = cuerpo.get('List-Unsubscribe') === 'One-Click';
  if (!p) return unToque ? Response.json({ ok: false }, { status: 400 }) : LINK_MALO();
  const prender = !unToque && cuerpo.get('accion') === 'prender';
  const ok = await cambiar(p.id, prender);
  if (unToque) return Response.json({ ok }, { status: ok ? 200 : 503 });
  if (!ok) return pagina('No pude guardarlo', 'Vuelve a intentarlo en un rato.', undefined, 503);
  return prender
    ? pagina('Listo: te vuelven a llegar', 'Te escribimos cuando tu ticket avance.', { p, accion: 'apagar', texto: 'Dejar de recibirlos' })
    : pagina('Listo: ya no te llegan', 'Los avances de tus tickets los ves en MaKo, en Tickets.', { p, accion: 'prender', texto: 'Volver a recibirlos' });
}
