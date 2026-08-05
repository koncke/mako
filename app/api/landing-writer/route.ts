// =============================================================================
// POST /api/landing-writer — MaKo escribe (o ajusta) la landing
// =============================================================================
// Tres acciones sobre el mismo endpoint, como el resto de los writers del repo:
//   generar → propone la página entera desde el brief del negocio (+ el
//             diagnóstico del Landing Analyst si esa URL ya se analizó)
//   ajustar → aplica un cambio conservando el resto del spec
//   guardar → persiste el spec aprobado en landing_drafts (historial)
// La generación NO guarda sola: el dueño revisa primero y guarda si le sirve.
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  generarLanding, ajustarLanding, guardarDraft, borrarDraft,
  type LandingSpec, type ObjetivoLanding,
} from '@/lib/landing-writer';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Body = {
  accion?: 'generar' | 'ajustar' | 'guardar' | 'borrar';
  pedido?: string;
  objetivo?: ObjetivoLanding;
  basadoEnUrl?: string | null;
  spec?: LandingSpec;
  instruccion?: string;
  id?: number;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    switch (body.accion) {
      case 'generar': {
        const pedido = (body.pedido ?? '').trim();
        if (!pedido) return Response.json({ ok: false, error: 'Contale a MaKo qué página necesitás.' }, { status: 400 });
        const res = await generarLanding({ pedido, objetivo: body.objetivo, basadoEnUrl: body.basadoEnUrl ?? null });
        if (!res.ok) { console.error(`[landing-writer:generar] ${res.error}`); return Response.json({ ok: false, error: res.error }, { status: 502 }); }
        console.log(`[landing-writer:generar] "${res.spec.nombre}" bloques=${res.spec.bloques.length} base=${body.basadoEnUrl ?? '—'}`);
        return Response.json({ ok: true, spec: res.spec });
      }

      case 'ajustar': {
        const instruccion = (body.instruccion ?? '').trim();
        if (!body.spec || !instruccion) return Response.json({ ok: false, error: 'Falta el spec o el cambio pedido.' }, { status: 400 });
        const res = await ajustarLanding(body.spec, instruccion);
        if (!res.ok) { console.error(`[landing-writer:ajustar] ${res.error}`); return Response.json({ ok: false, error: res.error }, { status: 502 }); }
        return Response.json({ ok: true, spec: res.spec });
      }

      case 'guardar': {
        if (!body.spec) return Response.json({ ok: false, error: 'Falta el spec a guardar.' }, { status: 400 });
        const id = await guardarDraft(
          { pedido: body.pedido ?? '', objetivo: body.objetivo, basadoEnUrl: body.basadoEnUrl ?? null },
          body.spec,
        );
        return Response.json({ ok: true, id });
      }

      case 'borrar': {
        if (!body.id) return Response.json({ ok: false, error: 'Falta el id.' }, { status: 400 });
        await borrarDraft(body.id);
        return Response.json({ ok: true });
      }

      default:
        return Response.json({ ok: false, error: 'Acción desconocida.' }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[landing-writer:${body.accion ?? '?'}] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
