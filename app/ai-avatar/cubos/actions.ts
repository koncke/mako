'use server';

// =============================================================================
// AI Avatar › Personaje en cubos — server actions (19/11/2026)
// =============================================================================
// Martín, 19/11: el video animado por código (el personaje en cubos con su voz) para que lo creen los usuarios de MaKo. El
// diseño: docs/editor-video/ai-avatar-por-codigo.md. Lo que hace cada action y lo que gasta:
//   · `inicioCubosAction`: los proyectos guardados (con su voz firmada), las voces que hay y las fotos. No gasta.
//   · `guionCubosAction`: la IA escribe el guion y los datos del formato (`avatar-cubos-guion`, pocos MaKo Tokens).
//   · `personajeDesdeFotoAction`: la IA mira su foto y elige las partes de su personaje (`avatar-cubos-personaje`).
//   · `crearVideoCubosAction`: la voz con sus tiempos (lib/ai-avatar/cubos-voz.ts: MaKo Tokens con la voz de MaKo) y el
//     proyecto guardado. La animación y el MP4 los hace el navegador: acá no se renderiza nada.
//   · `cambiarCubosAction`: otro personaje, otra marca u otros datos sobre la MISMA voz. No gasta.
//   · `borrarCubosAction`.
// El audio que sube la persona entra por /api/ai-avatar/cubos/alinear (una server action topea el cuerpo en 1 MB).
//
// LA PUERTA: la de AI Avatar (admin y capa), un workspace, el INTERRUPTOR de la revisión (lib/ai-avatar/cubos-interruptor.ts)
// y, en lo que genera, el candado de MaKo Pro (`candadoDeAiAvatar`), como el resto del estudio.
// =============================================================================

import { puertaCubos as puerta, marcaDelNegocio, type Falla } from './puerta';
import { leerProyectosCubos, guardarProyectoCubos, quitarProyectoCubos, proyectoNuevo, type ProyectoCubos } from '@/lib/ai-avatar/cubos-proyectos';
import { formatoCubos, normalizarGuion, normalizarDatos, datosAutomaticos, pedidoDelGuion, type DatosCubos, type IdFormato } from '@/lib/ai-avatar/cubos-formatos';
import { normalizarPersonaje, pedidoDelPersonaje, type Personaje } from '@/lib/ai-avatar/cubos-personaje';
import { vozConTiempos, vocesDisponibles, urlsDeVoces, VOCES_MAKO_CUBOS, type PedidoVoz } from '@/lib/ai-avatar/cubos-voz';
import { chatCheapCascade, leerDocumentoIA } from '@/lib/ai-cheap';
import { estadoContextoVideo } from '@/app/video-generator/video-datos';

export type ProyectoConVoz = ProyectoCubos & { url: string | null };
export type InicioCubos = {
  ok: true;
  proyectos: ProyectoConVoz[];
  voces: { id: string; nombre: string }[];
  clon: string | null;
  marca: string;
  fotos: { id: string; url: string }[];
};

/** Lo que abre la pantalla: sus videos, las voces y sus fotos. */
export async function inicioCubosAction(): Promise<InicioCubos | Falla> {
  const g = await puerta();
  if (!g.ok) return g;
  const [proyectos, voces, contexto, marca] = await Promise.all([
    leerProyectosCubos(), vocesDisponibles(), estadoContextoVideo().catch(() => null), marcaDelNegocio(),
  ]);
  const urls = await urlsDeVoces(proyectos.map((p) => p.audio)).catch(() => ({} as Record<string, string>));
  return {
    ok: true,
    proyectos: proyectos.map((p) => ({ ...p, url: urls[p.audio] ?? null })),
    voces: voces.mako ? VOCES_MAKO_CUBOS.map((v) => ({ id: v.id, nombre: v.nombre })) : [],
    clon: voces.clon?.nombre ?? null,
    marca,
    fotos: contexto?.fotos ?? [],
  };
}

/** El guion y los datos del formato, escritos por la IA desde una idea en una línea. */
export async function guionCubosAction(i: { formato: string; idea: string }): Promise<{ ok: true; frases: string[]; datos: DatosCubos } | Falla> {
  const g = await puerta(true);
  if (!g.ok) return g;
  const f = formatoCubos(i.formato);
  if (!f) return { ok: false, error: 'Elige un formato.' };
  const idea = String(i.idea ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (idea.length < 4) return { ok: false, error: 'Escribe de qué trata el video.' };
  const marca = await marcaDelNegocio();
  const p = pedidoDelGuion(f, idea, marca);
  let crudo: string;
  try {
    crudo = await chatCheapCascade({
      system: p.system, user: p.user, json: true, maxTokens: 600, temperature: 0.7,
      feature: 'avatar-cubos-guion', motivo: `guion de «${f.nombre}»`, redDePlataforma: true,
      validar: (t) => { try { const j = JSON.parse(t); return Array.isArray(j?.escenas) && j.escenas.length > 0; } catch { return false; } },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'MaKo no pudo escribir el guion ahora.' };
  }
  let j: { escenas?: unknown; datos?: unknown } = {};
  try { j = JSON.parse(crudo); } catch { return { ok: false, error: 'MaKo no pudo escribir el guion ahora. Prueba de nuevo.' }; }
  const gu = normalizarGuion(j.escenas);
  if (!gu.ok) return gu;
  return { ok: true, frases: gu.escenas.map((e) => e.texto), datos: normalizarDatos(f.id, j.datos, gu.escenas, marca) };
}

/** La IA mira una de sus fotos y elige las partes de su personaje en cubos (de las listas cerradas). */
export async function personajeDesdeFotoAction(fotoId: string): Promise<{ ok: true; personaje: Personaje } | Falla> {
  const g = await puerta(true);
  if (!g.ok) return g;
  const contexto = await estadoContextoVideo().catch(() => null);
  const foto = contexto?.fotos.find((x) => x.id === String(fotoId ?? ''));
  if (!foto) return { ok: false, error: 'Elige una de tus fotos.' };
  let dataUrl: string;
  try {
    const r = await fetch(foto.url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(String(r.status));
    const tipo = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
    if (!/^image\/(jpeg|png|webp)$/.test(tipo)) return { ok: false, error: 'Esa foto no es JPG, PNG ni WebP.' };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4_500_000) return { ok: false, error: 'La foto pesa demasiado: prueba con otra.' };
    dataUrl = `data:${tipo};base64,${buf.toString('base64')}`;
  } catch {
    return { ok: false, error: 'No pude abrir tu foto.' };
  }
  try {
    const out = await leerDocumentoIA({
      dataUrl, isPdf: false, nombreArchivo: 'foto', prompt: pedidoDelPersonaje(), json: true, maxTokens: 300,
      feature: 'avatar-cubos-personaje', motivo: 'tu personaje en cubos desde tu foto', redDePlataforma: true, timeoutMs: 60_000,
    });
    let j: unknown = null;
    try { j = JSON.parse(out.text); } catch { j = null; }
    if (!j) return { ok: false, error: 'MaKo no pudo leer tu foto. Elige las partes a mano.' };
    return { ok: true, personaje: normalizarPersonaje(j) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'MaKo no pudo leer tu foto.' };
  }
}

/** La voz del guion (con sus tiempos) y el proyecto guardado. */
export async function crearVideoCubosAction(i: { formato: string; frases: string[]; datos?: unknown; personaje: unknown; voz: PedidoVoz }): Promise<{ ok: true; proyecto: ProyectoConVoz; mt: number } | Falla> {
  const g = await puerta(true);
  if (!g.ok) return g;
  const f = formatoCubos(i.formato);
  if (!f) return { ok: false, error: 'Elige un formato.' };
  const gu = normalizarGuion(i.frases);
  if (!gu.ok) return gu;
  const marca = await marcaDelNegocio();
  const datos = i.datos ? normalizarDatos(f.id, i.datos, gu.escenas, marca) : datosAutomaticos(f.id, gu.escenas, marca);
  const pedido: PedidoVoz = i.voz?.tipo === 'clon' ? { tipo: 'clon' } : { tipo: 'mako', id: String((i.voz as { id?: unknown })?.id ?? '') };
  const v = await vozConTiempos(g.ws, gu.escenas, pedido);
  if (!v.ok) return v;
  const nombreVoz = pedido.tipo === 'clon' ? 'Tu voz' : VOCES_MAKO_CUBOS.find((x) => x.id === pedido.id)?.nombre ?? 'MaKo';
  const p = proyectoNuevo({ formato: f.id, escenas: gu.escenas, datos, personaje: normalizarPersonaje(i.personaje), voz: { tipo: pedido.tipo, nombre: nombreVoz }, audio: v.ruta, tiempos: v.tiempos });
  await guardarProyectoCubos(p);
  const urls = await urlsDeVoces([p.audio]).catch(() => ({} as Record<string, string>));
  return { ok: true, proyecto: { ...p, url: urls[p.audio] ?? null }, mt: v.mt };
}

/** Otro formato, personaje o datos sobre la MISMA voz (no gasta). */
export async function cambiarCubosAction(i: { id: string; formato?: string; personaje?: unknown; datos?: unknown }): Promise<{ ok: true; proyecto: ProyectoCubos } | Falla> {
  const g = await puerta();
  if (!g.ok) return g;
  const todos = await leerProyectosCubos();
  const p = todos.find((x) => x.id === String(i.id ?? ''));
  if (!p) return { ok: false, error: 'Ese video ya no está.' };
  const marca = await marcaDelNegocio();
  const formato: IdFormato = formatoCubos(i.formato)?.id ?? p.formato;
  const datos = i.datos !== undefined
    ? normalizarDatos(formato, i.datos, p.escenas, marca)
    : formato !== p.formato ? datosAutomaticos(formato, p.escenas, p.datos.marca || marca) : p.datos;
  const nuevo: ProyectoCubos = { ...p, formato, datos, personaje: i.personaje !== undefined ? normalizarPersonaje(i.personaje) : p.personaje };
  await guardarProyectoCubos(nuevo);
  return { ok: true, proyecto: nuevo };
}

export async function borrarCubosAction(id: string): Promise<{ ok: true } | Falla> {
  const g = await puerta();
  if (!g.ok) return g;
  await quitarProyectoCubos(String(id ?? ''));
  return { ok: true };
}
