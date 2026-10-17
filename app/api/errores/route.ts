// =============================================================================
// POST /api/errores — el navegador avisa que algo se rompió (una pantalla, un error suelto de la ventana)
// =============================================================================
// Martín (17/10/2026): «córrelo en toda la app: MaKo en los chats de la app, errores al navegar o lo que sea. Y todo lo
// solucionas automáticamente». Lo mandan app/error.tsx, app/global-error.tsx y el reportador de la ventana
// (app/_components/ReportarErrores.tsx). Lo registra lib/errores-app.ts: agrupado por huella, y la primera vez de cada
// huella es un ticket de bug que va solo al Cerebro.
//
// ⚠️ SÓLO CON SESIÓN y DEL MISMO ORIGEN: el error tiene que ser de alguien de MaKo (a quien avisarle cuando esté
// arreglado), y un sitio de afuera no puede llenar la Ticketera con errores inventados. El origen se compara entero
// (`new URL(origin).host`), nunca con un prefijo (AGENTS.md, «Un guard de ORIGEN se escribe con `origin`»).
// ⚠️ Contesta 204 siempre que entra, aunque sea ruido o el tope: el navegador no tiene nada que hacer con la diferencia.

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { identidadDe } from '@/lib/tickets-db';
import { registrarError } from '@/lib/errores-app';

export const dynamic = 'force-dynamic';

const TOPE_BYTES = 8_000;

export async function POST(req: NextRequest) {
  const origen = req.headers.get('origin');
  let mismo = false;
  try { mismo = !!origen && new URL(origen).host === req.headers.get('host'); } catch { mismo = false; }
  if (!mismo) return new Response(null, { status: 403 });
  const s = await getUsuarioActual();
  const ws = await getWorkspaceActual();
  if (!s?.email || !ws) return new Response(null, { status: 401 });
  const texto = await req.text();
  if (texto.length > TOPE_BYTES) return new Response(null, { status: 413 });
  let cuerpo: unknown;
  try { cuerpo = JSON.parse(texto); } catch { return new Response(null, { status: 400 }); }
  const quien = await identidadDe(ws, s.email, s.nombre ?? '');
  // El origen lo pone el servidor: lo que manda el navegador es siempre del navegador.
  await registrarError({ ...(cuerpo && typeof cuerpo === 'object' ? cuerpo : {}), origen: 'navegador' }, quien);
  return new Response(null, { status: 204 });
}
