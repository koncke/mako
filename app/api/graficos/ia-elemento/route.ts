// =============================================================================
// /api/graficos/ia-elemento — las cajas «Conclusiones de MaKo» del Dashboard: leer, generar y programar
// =============================================================================
// Pedido de Martín (tanda v5, 12/10/2026, puntos 2 y 8). La caja es app/dashboard/ElementoIA.tsx; el trabajo,
// lib/graficos-ia-elemento-server.ts; lo puro (el saneo, el largo, el estado), lib/graficos-ia-elemento.ts.
//
// Una ruta PROPIA, como la del AI Analyst: /api/graficos corta a los 60 s y una corrida con la cascada de IA no
// entra. Generar corre por DETRÁS (`after()`), con el negocio capturado antes, y la caja consulta el avance.
//
//   GET  ?hoja=<id>&elemento=<id>[&popup=<id del gráfico>][&ref=<lo abierto>]  → { vista }
//   POST { accion: 'generar', hoja, elementoId, popupDe?, ref?, vista? }     → { estado: 'corriendo' | 'ocupado', vista }
//   POST { accion: 'programar', hoja, elementoId }                          → { vista }   (el «Cuándo» de la caja)
//
// LA PUERTA: sesión, y el Dashboard en la capa.
//   · Leer: el admin lee SU caja (la de su informe); el closer, la de la CUENTA (la última que escribió
//     cualquiera para esa caja), y sólo de una caja que está en SU hoja (la plantilla Closing en memoria).
//   · Generar y programar: SÓLO el admin. Es lo que gasta cuota de IA.
// ⚠️ NO es una ruta de la API de MaKo y no tiene bearer: lo que lee una caja de llamada (el transcript) nunca sale
//    por /api/v1 ni por el link compartido, que no la llaman (tests/graficos-ia-elemento.test.ts lo fija). Y la
//    respuesta es `vistaDeFilaCaja`: el texto y las huellas, nunca la entrada.
// ⚠️ Y NUNCA CORRE AL ABRIR LA HOJA: el GET sólo lee. Generar es un POST que manda una persona (el «Generar» del
//    panel o el ↻ de la caja) o el cron con un horario puesto.

import { NextResponse, after } from 'next/server';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { getUsuarioActual } from '@/lib/auth';
import { tableroActual } from '@/lib/tablero-actual';
import { rateLimit } from '@/lib/rate-limit';
import { sanearHoja, type VistaValores } from '@/lib/graficos-catalogo';
import { buscarCaja } from '@/lib/graficos-ia-elemento';
import { informeCloser } from '@/lib/graficos-plantillas';
import {
  CajaInvalida, analizarCaja, arrancarCaja, programarCaja, vistaDeCaja, vistaDeCajaDeLaCuenta,
} from '@/lib/graficos-ia-elemento-server';

export const dynamic = 'force-dynamic';
// La corrida por detrás corre adentro de este mismo plazo (`after` usa el maxDuration de la ruta).
export const maxDuration = 300;

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const ID = /^[a-z0-9-]{1,40}$/i;
const REF = /^\d{1,20}$/;
const idDe = (v: unknown): string | null => (typeof v === 'string' && ID.test(v) ? v : null);

type Puerta = { ws: number; sub: string; rol: 'admin' | 'closer' };

/** La puerta: sesión, el Dashboard en la capa, y admin o closer (el closer, si su negocio compró Closing). */
async function puerta(): Promise<Puerta | Response> {
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin' && rol !== 'closer') return err(403, 'Sólo el admin de la cuenta');
  const capa = await getCapaActual();
  if (!tabEnCapa('graphics', capa)) return err(404, 'No existe');
  if (rol === 'closer' && !tabEnCapa('closing', capa)) return err(403, 'Sólo el admin de la cuenta');
  const s = await getUsuarioActual();
  const ws = await getWorkspaceActual();
  if (!s || ws == null) return err(401, 'no autenticado');
  return { ws, sub: s.sub, rol };
}

/** Lo elegido mirando: por id de control, sólo objetos (lo vuelve a sanear el catálogo al usarlo). */
function sanearVista(raw: unknown): VistaValores {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: VistaValores = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 40)) {
    if (ID.test(k) && v && typeof v === 'object' && !Array.isArray(v)) out[k] = v as VistaValores[string];
  }
  return out;
}

/** La hoja que manda el navegador, con su id TAL CUAL (un id inválido `sanearHoja` lo reinventaría). */
function hojaDe(raw: unknown) {
  const crudo = raw as { id?: unknown } | undefined;
  if (!crudo || typeof crudo.id !== 'string' || !ID.test(crudo.id)) return null;
  return sanearHoja(crudo, 0);
}

export async function GET(req: Request) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const url = new URL(req.url);
  const hojaId = idDe(url.searchParams.get('hoja'));
  const elementoId = idDe(url.searchParams.get('elemento'));
  const popupDe = url.searchParams.get('popup') ? idDe(url.searchParams.get('popup')) : '';
  const refCrudo = url.searchParams.get('ref') ?? '';
  if (!hojaId || !elementoId || popupDe == null) return err(400, 'Caja inválida');
  if (refCrudo && !REF.test(refCrudo)) return err(400, 'Caja inválida');
  const clave = { hojaId, popupDe, elementoId, ref: refCrudo };
  try {
    if (p.rol === 'admin') return NextResponse.json({ vista: await vistaDeCaja(p.sub, clave) });
    // El closer: sólo una caja que está en SU hoja (la plantilla Closing, en memoria).
    const hoja = informeCloser().hojas.find((h) => h.id === hojaId);
    if (!hoja || !buscarCaja(hoja, elementoId, popupDe || null)) return err(403, 'Sólo la hoja Closing');
    return NextResponse.json({ vista: await vistaDeCajaDeLaCuenta(clave) });
  } catch (e) {
    console.error(`[conclusiones] GET: ${e instanceof Error ? e.message : String(e)}`);
    return err(500, 'No pude leer las conclusiones');
  }
}

export async function POST(req: Request) {
  const p = await puerta();
  if (p instanceof Response) return p;
  if (p.rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const hoja = hojaDe(body.hoja);
  const elementoId = idDe(body.elementoId);
  if (!hoja || !elementoId) return err(400, 'Caja inválida');

  try {
    if (body.accion === 'generar') {
      const popupDe = body.popupDe == null || body.popupDe === '' ? null : idDe(body.popupDe);
      if (body.popupDe != null && body.popupDe !== '' && !popupDe) return err(400, 'Caja inválida');
      const ref = typeof body.ref === 'string' && REF.test(body.ref) ? body.ref : null;
      if (!rateLimit(`conclusiones:${p.ws}:${p.sub}`, 30, 60 * 60_000)) return err(429, 'Muchas seguidas. Prueba en un rato.');
      const inicio = Date.now();
      const r = await arrancarCaja({
        usuario: p.sub, hoja, elementoId, popupDe, ref, vista: sanearVista(body.vista),
        queTablero: await tableroActual(), hastaMs: inicio + 270_000,
      });
      if (!r.ok) return NextResponse.json({ estado: 'ocupado', vista: r.vista });
      // ⚠️ El negocio va ADENTRO del pedido (lo capturó `arrancarCaja`) y `analizarCaja` lo fija con
      // `runWithWorkspace`: lo que corre por detrás no depende de la pestaña.
      after(() => analizarCaja(r.pedido).catch((e) => console.error(`[conclusiones] after: ${e instanceof Error ? e.message : String(e)}`)));
      return NextResponse.json({ estado: 'corriendo', vista: await vistaDeCaja(p.sub, r.clave) });
    }

    if (body.accion === 'programar') {
      return NextResponse.json({ vista: await programarCaja({ usuario: p.sub, hoja, elementoId, queTablero: await tableroActual() }) });
    }

    return err(400, 'Acción desconocida');
  } catch (e) {
    if (e instanceof CajaInvalida) return err(400, e.message);
    console.error(`[conclusiones] POST ${String(body.accion)}: ${e instanceof Error ? e.message : String(e)}`);
    return err(500, 'No pude completar el pedido');
  }
}
