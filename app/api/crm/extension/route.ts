// =============================================================================
// POST /api/crm/extension — «Guardar en MaKo» desde la extensión: el perfil abierto de Instagram o LinkedIn, como lead del CRM
// =============================================================================
// Lo prometido a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md). La extensión no tiene sesión de MaKo: se autentica
// con el token del puente, como /api/flow/puente y /api/competitor-spy/extension. Por eso está en `PUBLICOS`
// (lib/rutas-publicas.ts): se hace cargo de su auth y NO mira la cookie para nada.
//
// Dos pedidos, los dos por el toque de la persona en el desplegable:
//   · `ver`: lo que leyó extension/perfil-leer.js, interpretado acá (lib/perfil-captura.ts), y si ya está en el CRM. No escribe;
//   · `guardar`: crea el lead (lib/perfil-captura-db.ts), con el nombre que dejó la persona.

import { NextResponse, type NextRequest } from 'next/server';
import { workspaceDeToken } from '@/lib/flow-cola';
import { limitePorClave } from '@/lib/limite-publico';
import { leerCapturaPerfil } from '@/lib/perfil-captura';
import { guardarPerfil, verPerfil } from '@/lib/perfil-captura-db';
import { negocioPausado, runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

/** Un perfil son el título, tres etiquetas y seis encabezados: unos pocos KB. */
const TOPE_CUERPO = 40_000;

export async function POST(req: NextRequest) {
  const token = (req.headers.get('x-flow-token') ?? '').trim();
  const ws = await workspaceDeToken(token);
  // 404 y no 403: a quien no le corresponde, no existe. El mismo criterio que /api/flow/puente.
  if (ws == null || (await negocioPausado(ws))) return NextResponse.json({ ok: false, error: 'no encontrado' }, { status: 404 });
  // Es el toque de una persona sobre UN perfil: treinta por minuto por negocio sobran.
  const frenado = limitePorClave('crm-extension', ws, 30, 60_000);
  if (frenado) return frenado;

  const crudo = await req.text().catch(() => '');
  if (crudo.length > TOPE_CUERPO) return NextResponse.json({ ok: false, error: 'cuerpo demasiado grande' }, { status: 413 });
  let cuerpo: Record<string, unknown>;
  try { cuerpo = JSON.parse(crudo) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: 'cuerpo inválido' }, { status: 400 }); }
  if (cuerpo.accion !== 'ver' && cuerpo.accion !== 'guardar') return NextResponse.json({ ok: false, error: 'pedido desconocido' }, { status: 400 });
  const captura = leerCapturaPerfil(cuerpo.captura);
  if (!captura) return NextResponse.json({ ok: false, motivo: 'no-es-perfil', error: 'No puedo leer este perfil.' }, { status: 400 });

  return runWithWorkspace(ws, async () => NextResponse.json(cuerpo.accion === 'ver'
    ? await verPerfil(ws, captura)
    : await guardarPerfil(ws, captura, { nombre: cuerpo.nombre, aunqueSeLlameIgual: cuerpo.aunqueSeLlameIgual === true })));
}
