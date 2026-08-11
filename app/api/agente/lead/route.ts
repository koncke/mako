// =============================================================================
// POST /api/agente/lead — meter un lead al CRM desde afuera
// =============================================================================
// Auth: `Authorization: Bearer <token de /integraciones>`, igual que el resto de
// /api/agente/*. El workspace lo resuelve el token: no hay forma de pedir el de otro.
//
// POR QUÉ EXISTE. El agente ya podía LEER el negocio y proponer tareas, pero no tenía
// ninguna forma de meter un contacto. El caso que lo pidió es el más común que hay: un
// formulario de landing que le manda los leads a una planilla, y el dueño querría que
// además entren al CRM. Sin esto, el agente probaba `/leads`, `/crm`, `/contactos` y
// `/webhook` —los nombres obvios— y todos contestaban 401, con lo cual el diagnóstico
// que sacaba era «el token no tiene permisos de CRM». No era un permiso que faltaba:
// era una ruta que no existía.
//
// ES IDEMPOTENTE, y no es un lujo: un formulario de landing dispara dos veces con una
// conexión mala, y un Apps Script reintenta. Si el teléfono o el mail ya están en el
// workspace, se devuelve el lead que ya estaba con `creado: false` en vez de duplicarlo.
// El CRM no tiene deshacer para un duplicado: lo tiene que borrar una persona.
//
// ⚠️ EL TELÉFONO SE NORMALIZA y de eso se encarga `createLead`, no este archivo. Es la
// llave con la que un lead matchea su chat de WhatsApp, su Calendly y su instant form;
// un lead cargado con el teléfono crudo queda huérfano de todo eso y nadie lo nota
// hasta que falta una conversación.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { bearerDe, wsPorAgenteToken } from '@/lib/agente-token';
import { runWithWorkspace } from '@/lib/workspace';
import { createLead, findLeadByContacto, logLeadEvent } from '@/lib/leads';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const txt = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

export async function POST(req: NextRequest) {
  const ws = await wsPorAgenteToken(bearerDe(req));
  if (ws == null) return NextResponse.json({ ok: false, error: 'token inválido o revocado' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* sin cuerpo */ }

  const nombre = txt(body.nombre);
  const email = txt(body.email)?.toLowerCase() ?? null;
  const telefono = txt(body.telefono);

  // El nombre es lo único obligatorio, igual que en el alta manual del CRM. Y se pide
  // al menos una forma de contactarlo: un lead sin mail ni teléfono no se puede
  // trabajar, y entra al tablero solo para ensuciarlo.
  if (!nombre) return NextResponse.json({ ok: false, error: 'falta "nombre"' }, { status: 400 });
  if (!email && !telefono) {
    return NextResponse.json({ ok: false, error: 'falta "email" o "telefono": un lead sin forma de contacto no se puede trabajar' }, { status: 400 });
  }

  try {
    return await runWithWorkspace(ws, async () => {
      const yaEsta = await findLeadByContacto(email, telefono);
      if (yaEsta) {
        return NextResponse.json({ ok: true, creado: false, id: yaEsta.id, nombre: yaEsta.nombre });
      }

      const lead = await createLead({
        nombre,
        email,
        telefono,
        empresa: txt(body.empresa),
        utm_source: txt(body.utm_source),
        utm_medium: txt(body.utm_medium),
        utm_campaign: txt(body.utm_campaign),
        utm_content: txt(body.utm_content),
      });

      // Queda en el Change History de la ficha DE DÓNDE salió. Sin esto, un lead que
      // aparece solo en el tablero no tiene explicación: el que lo mira no sabe si lo
      // cargó alguien, si vino de un anuncio o si lo inventó una automatización.
      const origen = txt(body.origen) ?? 'una automatización';
      await logLeadEvent(lead.id, 'Alta', `Entró por Claude desde ${origen}`, 'Claude').catch(() => {});

      return NextResponse.json({ ok: true, creado: true, id: lead.id, nombre: lead.nombre });
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
