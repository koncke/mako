// =============================================================================
// Marketing CoPilot — dónde vive «Oferta y comunicación» (12/11/2026)
// =============================================================================
// · LA OFERTA: las piezas de la conversación de Offer elegida (`offer_sesiones.piezas`). No se copian: marcar una la confirma ALLÍ
//   (fuente 'chat'), y Offer la ve igual. La nota es la del diagnóstico de Offer (D1-D9), si ya se hizo.
// · ÁNGULOS y TU VOZ: app_settings por negocio (./comunicacion.ts → claveOC). Sin migración, como el perfil del CoPilot
//   (lib/media-buyer/copiloto-store.ts). Ángulos va por conversación de Offer; Tu voz, una por negocio.
// Todo dentro de `runWithWorkspace(ws)`: las lecturas de Offer usan getTenantDb.
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { getSetting, getSettingEstricto, setSetting } from '@/lib/settings';
import { actualizarSesion, leerFila, listarSesionesOffer, type FilaOffer } from '@/lib/offer-sesiones';
import { esPiezaKey, type FuentePieza, type PiezaKey } from '@/lib/offer-marco';
import {
  CLAVE_OFERTA_OC, OC, claveOC, cosaDeGuardada, decirOC, marcarOC, sanearGuardadoOC,
  type CosaOC, type FuenteOC, type GuardadoOC, type NotaOC, type ParteOC,
} from './comunicacion';

export type ParteGuardadaOC = Exclude<ParteOC, 'oferta'>;

/** Lo que dibuja la pantalla de las tres partes. */
export type EstadoComunicacion = {
  /** Las conversaciones de Offer, para el desplegable «Oferta» (la más reciente primero). */
  ofertas: Array<{ id: number; titulo: string }>;
  /** La elegida (null = el negocio todavía no habló con Offer). */
  sesion: number | null;
  cosas: Record<ParteOC, Record<string, CosaOC>>;
  nota: Record<ParteOC, NotaOC | null>;
  /** Cuándo leyó MaKo por última vez cada parte (para «Volver a analizar»). */
  leidoAt: Record<ParteGuardadaOC, string | null>;
};

// ── Ángulos y Tu voz ─────────────────────────────────────────────────────────

export async function leerGuardadoOC(ws: number, p: ParteGuardadaOC, sesion: number | null, estricto = false): Promise<GuardadoOC> {
  const crudo = await runWithWorkspace(ws, () => (estricto ? getSettingEstricto(claveOC(p, sesion)) : getSetting(claveOC(p, sesion))));
  if (!crudo) return { cosas: {}, nota: null, leidoAt: null };
  try { return sanearGuardadoOC(p, JSON.parse(crudo)); } catch { return { cosas: {}, nota: null, leidoAt: null }; }
}

export async function guardarOC(ws: number, p: ParteGuardadaOC, sesion: number | null, g: GuardadoOC): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(claveOC(p, sesion), JSON.stringify(g)));
}

/** Leer, cambiar y guardar (la lectura ESTRICTA: un cambio sobre una lectura caída borraría todo lo guardado). */
export async function cambiarOC(ws: number, p: ParteGuardadaOC, sesion: number | null, f: (g: GuardadoOC) => GuardadoOC): Promise<GuardadoOC> {
  const nuevo = f(await leerGuardadoOC(ws, p, sesion, true));
  await guardarOC(ws, p, sesion, nuevo);
  return nuevo;
}

// ── La oferta (Offer) ────────────────────────────────────────────────────────

function fuenteDeOffer(f: FilaOffer, fuente: 'negocio' | 'chat' | 'doc'): FuenteOC {
  if (fuente === 'chat') return { tipo: 'chat', texto: 'Lo dijiste en el chat' };
  if (fuente === 'negocio') return { tipo: 'negocio', texto: 'Lo que sé de tu negocio' };
  const docs = (f.documentos ?? []).filter((d) => d && typeof d.nombre === 'string');
  const web = docs.length === 1 && (docs[0] as { via?: string }).via === 'web';
  if (docs.length === 1) return { tipo: web ? 'web' : 'pdf', texto: `${web ? 'Tu web' : 'Tu documento'} «${docs[0].nombre.slice(0, 80)}»` };
  return { tipo: 'pdf', texto: docs.length ? `Tus documentos (${docs.length})` : 'Un documento tuyo' };
}

export function cosasDeOferta(f: FilaOffer | null): Record<string, CosaOC> {
  const cosas: Record<string, CosaOC> = {};
  for (const k of Object.keys(OC.oferta.items)) {
    const p = f?.piezas?.[k as PiezaKey];
    if (!f || !p || !p.valor?.trim()) { cosas[k] = { estado: 'vacia', valor: '', fuente: null, at: null }; continue; }
    cosas[k] = { estado: p.fuente === 'negocio' ? 'negocio' : 'confirmada', valor: p.valor.trim(), fuente: fuenteDeOffer(f, p.fuente), at: p.at ?? null };
  }
  return cosas;
}

/** La nota de la oferta: la del último diagnóstico de Offer (el borrador o la última versión armada). */
export function notaDeOferta(f: FilaOffer | null): NotaOC | null {
  const ultima = f?.conclusiones?.length ? f.conclusiones[f.conclusiones.length - 1] : null;
  const d = ultima ?? f?.borrador ?? null;
  if (!d?.diagnostico?.dimensiones?.length) return null;
  return {
    total: d.calculo?.total ?? 0,
    criterios: d.diagnostico.dimensiones.map((x) => ({ id: x.id, nota: x.nota, porque: x.porque })),
    lei: [d.diagnostico.tesis ? { titulo: 'En una frase', texto: d.diagnostico.tesis } : null, ...(d.diagnostico.fuertes ?? []).slice(0, 2).map((t) => ({ titulo: 'Lo que ya está bien', texto: t }))]
      .filter((x): x is { titulo: string; texto: string } => !!x),
    at: (ultima?.at ?? f?.borrador?.at) || new Date(0).toISOString(),
    modelo: ultima?.modelo ?? f?.borrador?.modelo,
  };
}

/** Marcar o desmarcar una pieza de la oferta: en Offer, «confirmada» es la que no viene del negocio. */
export async function marcarPiezaOferta(ws: number, sesion: number, k: string, listo: boolean): Promise<void> {
  if (!esPiezaKey(k)) throw new Error('Esa pieza no es de la oferta.');
  const pk: PiezaKey = k;
  await runWithWorkspace(ws, () => actualizarSesion(sesion, (f) => {
    const p = f.piezas[pk];
    if (!p?.valor?.trim()) return null;
    const fuente: FuentePieza = listo ? (p.fuente === 'negocio' ? 'chat' : p.fuente) : 'negocio';
    if (fuente === p.fuente) return null;
    return { piezas: { ...f.piezas, [pk]: { ...p, fuente, at: new Date().toISOString() } } };
  }));
}

/** Lo que dice la persona de una pieza de la oferta (desde el chat del CoPilot): queda confirmada en Offer. */
export async function decirPiezaOferta(ws: number, sesion: number, k: string, valor: string): Promise<void> {
  if (!esPiezaKey(k)) throw new Error('Esa pieza no es de la oferta.');
  const v = valor.replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!v) throw new Error('Falta lo que dijo.');
  const pk: PiezaKey = k;
  await runWithWorkspace(ws, () => actualizarSesion(sesion, (f) => ({ piezas: { ...f.piezas, [pk]: { valor: v, fuente: 'chat' as const, at: new Date().toISOString() } } })));
}

// ── Todo junto ───────────────────────────────────────────────────────────────

/** La oferta elegida en la tarjeta (null = la más reciente). */
export async function leerOfertaElegida(ws: number): Promise<number | null> {
  const crudo = await runWithWorkspace(ws, () => getSetting(CLAVE_OFERTA_OC)).catch(() => null);
  const n = crudo ? Number(crudo) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function guardarOfertaElegida(ws: number, id: number): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(CLAVE_OFERTA_OC, String(id))).catch(() => undefined);
}

export async function sesionesDeOffer(ws: number): Promise<Array<{ id: number; titulo: string }>> {
  try { return (await runWithWorkspace(ws, () => listarSesionesOffer())).map((s) => ({ id: s.id, titulo: s.titulo })); } catch { return []; }
}

/** La conversación de Offer elegida: la pedida si es del negocio; si no, la más reciente. */
export function elegirSesion(ofertas: Array<{ id: number }>, pedida: number | null): number | null {
  if (pedida != null && ofertas.some((o) => o.id === pedida)) return pedida;
  return ofertas[0]?.id ?? null;
}

export async function leerComunicacion(ws: number, pedida: number | null): Promise<EstadoComunicacion> {
  const [ofertas, elegida] = await Promise.all([sesionesDeOffer(ws), leerOfertaElegida(ws)]);
  const sesion = elegirSesion(ofertas, pedida ?? elegida);
  // Cambiar de oferta en la tarjeta la deja elegida: el chat guarda en la misma.
  if (pedida != null && sesion === pedida && pedida !== elegida) await guardarOfertaElegida(ws, pedida);
  const [fila, angulos, voz] = await Promise.all([
    sesion != null ? runWithWorkspace(ws, () => leerFila(sesion)).catch(() => null) : Promise.resolve(null),
    leerGuardadoOC(ws, 'angulos', sesion),
    leerGuardadoOC(ws, 'voz', sesion),
  ]);
  const cosasDe = (p: ParteGuardadaOC, g: GuardadoOC) => Object.fromEntries(Object.keys(OC[p].items).map((k) => [k, cosaDeGuardada(g.cosas[k])]));
  return {
    ofertas, sesion,
    cosas: { oferta: cosasDeOferta(fila), angulos: cosasDe('angulos', angulos), voz: cosasDe('voz', voz) },
    nota: { oferta: notaDeOferta(fila), angulos: angulos.nota ?? null, voz: voz.nota ?? null },
    leidoAt: { angulos: angulos.leidoAt ?? null, voz: voz.leidoAt ?? null },
  };
}

/** Marcar el check de una cosa de cualquiera de las tres partes. */
export async function marcarCosaOC(ws: number, p: ParteOC, sesion: number | null, k: string, listo: boolean): Promise<void> {
  if (p === 'oferta') {
    if (sesion == null) throw new Error('Todavía no hay una oferta en Offer.');
    return marcarPiezaOferta(ws, sesion, k, listo);
  }
  await cambiarOC(ws, p, sesion, (g) => marcarOC(g, k, listo, new Date().toISOString()));
}

/** Guardar lo que dijo la persona de una cosa (el chat del CoPilot, con la API de MaKo). */
export async function decirCosaOC(ws: number, p: ParteOC, sesion: number | null, k: string, valor: string): Promise<void> {
  if (p === 'oferta') {
    if (sesion == null) throw new Error('Todavía no hay una oferta en Offer: primero se arma en Offer.');
    return decirPiezaOferta(ws, sesion, k, valor);
  }
  await cambiarOC(ws, p, sesion, (g) => decirOC(g, k, valor, new Date().toISOString()));
}
