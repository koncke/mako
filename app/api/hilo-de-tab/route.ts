// =============================================================================
// /api/hilo-de-tab — la charla de «Editar con MaKo» y del Web Generator, en la base (22/10/2026)
// =============================================================================
// GET  ?clave=dashboard:<hoja> | landing:<id>  → { mensajes: [{ role, content }] } (los últimos, de la charla más reciente)
// POST { clave, titulo, mensajes: [{ role, content }], siVacia? }  → { ok, sessionId }
//
// Lo que MaKo contesta en esas tabs sale de SUS rutas (/api/graficos/editar, /api/landing-generator/ia): ésta sólo GUARDA
// lo que el panel ya mostró, para que sobreviva a recargar y se vea en el Ops Center (lib/hilo-de-tab-reglas.ts). No
// llama a ninguna IA. Usa las funciones de lib/chart-chats.ts tal cual (ese archivo es del chat del Ops Center).
//
// ⛔ DE QUIÉN ES: la misma regla de /api/chart-insights (lib/chart-chats-reglas.ts). La charla de un admin es del
//    workspace; la de un closer o un setter, SUYA (`persona:<p>:<clave>`). Y sólo las claves de esta vía: nunca la de un
//    chat del teléfono o del Ops Center de otra persona (`claveDeTab`).
// `siVacia`: sólo si esa entidad no tiene charla todavía. Es para subir UNA vez lo que quedó en el navegador de antes
// (app/dashboard/hilo-guardado.ts) sin duplicarlo encima de lo que ya está en la base.

import type { NextRequest } from 'next/server';
import { appendMessage, createSession, getSessionMessages, listSessions } from '@/lib/chart-chats';
import { claveGuardada, personaDeSesion, type QuienChatea } from '@/lib/chart-chats-reglas';
import { TOPE_FILAS_LEIDAS, claveDeTab, filasValidas, tituloValido } from '@/lib/hilo-de-tab-reglas';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SIN_SESION = () => Response.json({ error: 'Tu sesión venció.' }, { status: 401 });
const CLAVE_MALA = () => Response.json({ error: 'clave inválida' }, { status: 400 });
const NO_EXISTE = () => Response.json({ error: 'no existe' }, { status: 404 });

/** Quién pide: admin o no, y su persona (la regla de /api/chart-insights). null = sin sesión. */
async function quienPide(): Promise<QuienChatea | null> {
  const [rolWs, sesion] = await Promise.all([getRolWsEfectivo(), getUsuarioActual()]);
  if (!rolWs || !sesion) return null;
  const persona = personaDeSesion(sesion);
  return persona ? { admin: rolWs === 'admin', persona } : null;
}

export async function GET(req: NextRequest) {
  try {
    const q = await quienPide();
    if (!q) return SIN_SESION();
    const clave = claveDeTab(req.nextUrl.searchParams.get('clave'));
    if (!clave) return CLAVE_MALA();
    const guardada = claveGuardada(clave, q);
    if (!guardada) return NO_EXISTE();
    const [s] = await listSessions(guardada);
    if (!s) return Response.json({ mensajes: [] });
    const mensajes = (await getSessionMessages(s.id)).slice(-TOPE_FILAS_LEIDAS).map(({ role, content }) => ({ role, content }));
    return Response.json({ mensajes });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { clave?: unknown; titulo?: unknown; mensajes?: unknown; siVacia?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  try {
    const q = await quienPide();
    if (!q) return SIN_SESION();
    const clave = claveDeTab(body.clave);
    if (!clave) return CLAVE_MALA();
    const filas = filasValidas(body.mensajes);
    if (!filas) return Response.json({ error: 'sin mensajes' }, { status: 400 });
    const guardada = claveGuardada(clave, q);
    if (!guardada) return NO_EXISTE();
    const [existente] = await listSessions(guardada);
    if (existente && body.siVacia === true) return Response.json({ ok: true, sessionId: existente.id, omitido: true });
    const s = existente ?? await createSession(guardada, tituloValido(body.titulo, 'Chat con MaKo'), null);
    // En orden: el Ops Center los dibuja por `created_at`.
    for (const f of filas) await appendMessage(s.id, f.role, f.content);
    return Response.json({ ok: true, sessionId: s.id });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
