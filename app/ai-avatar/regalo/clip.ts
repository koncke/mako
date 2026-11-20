// =============================================================================
// EL CLIP DE 10 s QUE EL RETO REGALA EL DÍA 6 — lo que toca la red y la base (20/11/2026)
// =============================================================================
// Las reglas (qué se guarda, qué se le dice a la persona, la frase y el prompt) viven en lib/reto/clip-regalo-reglas.ts; acá,
// el camino entero, en dos llamadas que la tarjeta del día 6 hace por las actions de ./actions.ts:
//   · `pedirClipRegalo` RESERVA el regalo (compare-and-set: de dos clics a la vez gana uno, y no se paga dos veces), arma la
//     imagen y lanza el Omni de ApiMart (10 s, 9:16, 720p). Contesta enseguida: ApiMart tarda un par de minutos.
//   · `avanzarClipRegalo` pregunta cómo va y, cuando terminó, lo BAJA (el link de ApiMart vence a las 24 h), lo guarda en
//     el bucket de los clips, lo deja en el historial de videos como un video con avatar y anota lo que costó.
//   · Si la persona se va y nadie pregunta, la MISMA vuelta (`terminarClipDe`) la hace el cron app/api/cron/clip-regalo cada
//     15 min: un clip pagado no se pierde a las 24 h porque nadie volvió a abrir la tarjeta.
//
// ⚠️ SIN EL CANDADO DE PRO, A PROPÓSITO. AI Avatar es de Pro (`candadoDeAiAvatar`), pero el reto se lo regala también a una
// prueba de Essential: es ESTA pieza, una vez. La puerta es la del reto (el interruptor de la revisión, `veOnboardingV2`) y
// la prueba: fuera de la prueba no hay regalo (la revisión de Martín pasa, para poder probarlo en el ws 3).
//
// ⚠️ LA IMAGEN: el personaje de AI Avatar (el look) o, si no hay, su foto. El link del look es de Google Flow y VENCE a la
// hora (lib/flow-imagen.ts): se baja AL PEDIR y se sube al bucket privado de medios, con un link firmado que ApiMart alcanza
// a leer. Si ya venció, va su foto de referencia (link firmado de 6 h, lib/persona.ts). En una prueba de Essential no hay
// look (crearlo es de Pro), así que el clip sale con su foto.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { veAiAvatar } from '../acceso';
import { leerLooks } from '../looks';
import { getWorkspaceActual, getTenantDb } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { getSettingEstricto, cambiarSettingSi } from '@/lib/settings';
import { EMAILS_REVISION, WS_REVISION_V2, veOnboardingV2 } from '@/lib/onboarding-v2/revision';
import { estadoDePrueba } from '@/lib/prueba-uso';
import { personaEstado } from '@/lib/persona';
import { MEDIA_BUCKET } from '@/lib/evolution-media';
import { generarVideo, estadoDeTarea } from '@/lib/apimart';
import { MODELO_OMNI } from '@/lib/apimart-reglas';
import { recordCostoDeMedio } from '@/lib/anthropic-usage';
import { plantillaPorId, PLANTILLAS_AVATAR } from '@/lib/ai-avatar/plantillas';
import { guardarEnHistorial, type PlanGuardado } from '@/app/video-generator/video-datos';
import { conAvatar, type AvatarIA } from '@/app/video-editor/avatar/avatares';
import {
  CLAVE_CLIP_REGALO, FEATURE_CLIP_REGALO, MAX_PALABRAS_CLIP, SEGUNDOS_CLIP_REGALO, TEXTOS_CLIP, USD_ESTIMADO_CLIP_REGALO,
  fraseDelClip, intentosPrevios, leerEstado, promptDelClip, publico, sePuedePedir, vencido,
  type ClipRegalo, type EstadoGuardado,
} from '@/lib/reto/clip-regalo-reglas';

export type SalidaClip = { ok: true; clip: ClipRegalo } | { ok: false; error: string };

/** El bucket PÚBLICO de los clips del Video Generator: el historial guarda el link y lo reproduce (app/video-generator/video-action.ts). */
const BUCKET_CLIPS = 'video-clips';

type Puerta = { ok: true; ws: number; puedePedir: boolean } | { ok: false; error: string };

/** Quién pasa: el admin del negocio (`veAiAvatar`, sin el candado de Pro), con el reto prendido; pide si está en prueba. */
async function puerta(): Promise<Puerta> {
  if (!(await veAiAvatar())) return { ok: false, error: 'El clip de regalo lo pide quien administra el negocio.' };
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Elige un workspace arriba.' };
  const s = await getUsuarioActual().catch(() => null);
  const email = (s?.email ?? '').trim().toLowerCase();
  if (!s || !veOnboardingV2({ email, ws })) return { ok: false, error: 'Esto todavía no está disponible.' };
  const revision = EMAILS_REVISION.includes(email) || WS_REVISION_V2.includes(ws);
  const puedePedir = revision || (await estadoDePrueba(ws)).enPrueba;
  return { ok: true, ws, puedePedir };
}

/** Lee el estado guardado TAL CUAL (el crudo es el `esperado` del compare-and-set). Si no se puede leer, tira. */
async function leer(): Promise<{ crudo: string | null; g: EstadoGuardado | null }> {
  const crudo = await getSettingEstricto(CLAVE_CLIP_REGALO);
  return { crudo, g: leerEstado(crudo) };
}

const ahoraIso = () => new Date().toISOString();

// ── La imagen ────────────────────────────────────────────────────────────────

type Imagen = { url: string; id: string; deDonde: 'personaje' | 'foto'; plantillaId: string; avatar: AvatarIA };

/** Baja una imagen y la sube al bucket privado; devuelve un link firmado de 2 h, o null. */
async function copiaFirmada(ws: number, url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const tipo = r.headers.get('content-type') || '';
    if (!r.ok || !/^image\//i.test(tipo)) return null; // una página de login de Google no es una imagen
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.byteLength < 1000) return null;
    const ext = /png/i.test(tipo) ? 'png' : /webp/i.test(tipo) ? 'webp' : 'jpg';
    const ruta = `${ws}/reto/personaje-${randomUUID()}.${ext}`;
    const db = await getTenantDb();
    const { error } = await db.storage.from(MEDIA_BUCKET).upload(ruta, bytes, { contentType: tipo, upsert: false });
    if (error) return null;
    const { data } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(ruta, 7200);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** El personaje más nuevo que esté listo; si su link venció, su foto; si no hay personaje, la primera foto. */
async function imagenDelClip(ws: number): Promise<Imagen | null> {
  const looks = await leerLooks();
  const look = looks.find((l) => l.mediaId && l.url && !l.error) ?? null;
  const p = (look && plantillaPorId(look.plantillaId)) || PLANTILLAS_AVATAR[0];
  const escena = { n: 1, desde: 1, hasta: 1, lugar: p.lugar, prompt: p.prompt };
  if (look) {
    const url = await copiaFirmada(ws, look.url);
    if (url) return { url, id: look.mediaId, deDonde: 'personaje', plantillaId: p.id, avatar: { id: look.mediaId, url: look.url, lugar: p.lugar, puestaId: p.puestaId, deAnuncio: 'AI Avatar', escena } };
  }
  const est: { fotos: ReadonlyArray<{ id: string; url: string | null }> } = await personaEstado().catch(() => ({ fotos: [] }));
  const fotos = est.fotos.filter((f) => !!f.url);
  const foto = (look && fotos.find((f) => f.id === look.fotoId)) || fotos[0];
  if (!foto?.url) return null;
  return { url: foto.url, id: foto.id, deDonde: 'foto', plantillaId: p.id, avatar: { id: foto.id, url: foto.url, lugar: p.lugar, puestaId: p.puestaId, deAnuncio: 'Tu foto', escena } };
}

// ── Pedir ────────────────────────────────────────────────────────────────────

/** Pide el clip de regalo con la frase que va a decir (el gancho de su guion, hasta 25 palabras). */
export async function pedirClipRegalo(input: { frase: unknown }): Promise<SalidaClip> {
  const pu = await puerta();
  if (!pu.ok) return pu;
  const f = fraseDelClip(input.frase);
  if (!f.ok) return { ok: false, error: f.error };

  let leido: Awaited<ReturnType<typeof leer>>;
  try { leido = await leer(); } catch { return { ok: false, error: 'No pude leer tu clip de regalo. Vuelve a intentarlo en un momento.' }; }
  if (!pu.puedePedir) return { ok: true, clip: publico(leido.g, false) };
  // Ya pedido (o hecho): se contesta cómo va, sin pedir otro.
  if (!sePuedePedir(leido.g)) return { ok: true, clip: publico(leido.g, true) };

  const imagen = await imagenDelClip(pu.ws);
  if (!imagen) return { ok: false, error: TEXTOS_CLIP.sinFoto };

  // LA RESERVA: de dos pedidos a la vez gana UNO. El que pierde contesta lo que dejó el que ganó.
  const previos = intentosPrevios(leido.g);
  const pidiendo: EstadoGuardado = { e: 'pidiendo', at: ahoraIso(), intentos: previos, frase: f.frase };
  const reservado = JSON.stringify(pidiendo);
  let gano = false;
  try { gano = await cambiarSettingSi(CLAVE_CLIP_REGALO, leido.crudo, reservado); } catch { gano = false; }
  if (!gano) {
    try { return { ok: true, clip: publico((await leer()).g, true) }; } catch { return { ok: false, error: 'No pude leer tu clip de regalo. Vuelve a intentarlo en un momento.' }; }
  }

  const a = await generarVideo({ fotoUrl: imagen.url, prompt: promptDelClip(f.frase), segundos: SEGUNDOS_CLIP_REGALO, modelo: MODELO_OMNI });
  let sigue: EstadoGuardado;
  if (a.estado === 'aceptado') {
    sigue = {
      e: 'generando', at: ahoraIso(), intentos: previos + 1, frase: f.frase, taskId: a.taskId, planId: randomUUID(),
      imagen: imagen.avatar.url, imagenId: imagen.id, plantillaId: imagen.plantillaId, deDonde: imagen.deDonde,
    };
  } else if (a.estado === 'rechazado') {
    // No arrancó: no costó y NO cuenta como intento.
    if (a.sinSaldo) console.error(`[reto-clip-regalo] ⚠️ ApiMart SIN SALDO: el negocio ${pu.ws} no pudo recibir su clip de regalo — ${a.porque}`);
    sigue = { e: 'fallo', at: ahoraIso(), intentos: previos, porque: a.porque, ...(a.sinSaldo ? { sinSaldo: true as const } : {}) };
  } else {
    // Puede estar corriendo y cobrándose: NO se reintenta solo (lib/apimart-reglas.ts, `desconocido`).
    console.error(`[reto-clip-regalo] ⚠️ no sé si arrancó el clip del negocio ${pu.ws}: ${a.porque} ${a.crudo}`);
    sigue = { e: 'revisar', at: ahoraIso(), intentos: previos + 1, porque: a.porque };
  }
  // La reserva es nuestra (nadie más escribe sobre un «pidiendo» vivo): un segundo intento por si la base parpadeó. Si igual no
  // queda, a los 10 min pasa a «revisar» (`vencido`) y no se vuelve a pagar.
  const final = JSON.stringify(sigue);
  if (!(await cambiarSettingSi(CLAVE_CLIP_REGALO, reservado, final).catch(() => false))) {
    await cambiarSettingSi(CLAVE_CLIP_REGALO, reservado, final).catch(() => false);
  }
  return { ok: true, clip: publico(sigue, true) };
}

// ── Cómo va (y terminarlo) ──────────────────────────────────────────────────

/** Baja el video de ApiMart y lo sube al bucket de los clips. Devuelve el link público, o '' (se reintenta en la vuelta siguiente). */
async function guardarVideo(planId: string, taskId: string, url: string): Promise<string> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok || /text\/html/i.test(r.headers.get('content-type') || '')) return '';
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.byteLength < 1000) return '';
    const ruta = `video-generator/${planId}/toma-1-${taskId}.mp4`;
    const db = await getTenantDb();
    const { error } = await db.storage.from(BUCKET_CLIPS).upload(ruta, bytes, { contentType: 'video/mp4', upsert: false });
    // Ya estaba (una vuelta anterior lo subió y murió antes de anotarlo): sirve el mismo archivo.
    if (error && !/exists|duplicate/i.test(error.message)) return '';
    return db.storage.from(BUCKET_CLIPS).getPublicUrl(ruta).data?.publicUrl ?? '';
  } catch {
    return '';
  }
}

/** El video con avatar del historial (el que lee el Video Editor y cierra la tarea «tu primer clip» del día 6). */
function entradaDelHistorial(g: Extract<EstadoGuardado, { e: 'generando' | 'guardando' }>, url: string): PlanGuardado {
  const p = plantillaPorId(g.plantillaId) ?? PLANTILLAS_AVATAR[0];
  const avatar: AvatarIA = {
    id: g.imagenId, url: g.imagen, lugar: p.lugar, puestaId: p.puestaId,
    deAnuncio: g.deDonde === 'foto' ? 'Tu foto' : 'AI Avatar',
    escena: { n: 1, desde: 1, hasta: 1, lugar: p.lugar, prompt: p.prompt },
  };
  const palabras = g.frase.split(' ').filter(Boolean).length;
  const base: PlanGuardado = {
    id: g.planId,
    pedido: 'Tu clip de regalo del reto',
    at: ahoraIso(),
    plan: {
      puestaId: p.puestaId, titulo: 'Tu clip de regalo del reto', duracionTotalSeg: SEGUNDOS_CLIP_REGALO, ritmo: 'H',
      clips: [{
        n: 1, segundos: SEGUNDOS_CLIP_REGALO, habla: true, voz: g.frase, queSeVe: 'Mira a cámara y dice el gancho.',
        camara: 'Vertical, plano fijo.', prompt: promptDelClip(g.frase), palabras, tope: MAX_PALABRAS_CLIP, literal: true, voseo: [],
      }],
      deCorrido: g.frase,
    },
    video: { '1': { url, mediaId: g.taskId } },
  };
  return conAvatar(base, avatar);
}

/** Cómo va el clip de regalo, para la tarjeta del día 6: la puerta (la sesión) y la vuelta de `terminarClipDe`. */
export async function avanzarClipRegalo(): Promise<SalidaClip> {
  const pu = await puerta();
  if (!pu.ok) return pu;
  return terminarClipDe(pu.ws, pu.puedePedir);
}

/**
 * Una vuelta del clip de UN negocio, SIN sesión: si ya terminó en ApiMart, lo termina acá (bajarlo, guardarlo en el historial,
 * anotar lo que costó). La llaman la tarjeta (por `avanzarClipRegalo`) y el cron que termina los clips que nadie vuelve a
 * mirar (app/api/cron/clip-regalo), los dos por el mismo compare-and-set: si caen a la vez, lo guarda uno.
 *
 * ⚠️ NUNCA LANZA UN CLIP: sólo termina el que ya está pago. Pedir uno nuevo es `pedirClipRegalo`, con su puerta.
 * ⚠️ LOS SETTINGS SON LOS DEL CONTEXTO (lib/settings.ts lee y escribe en el negocio de `getWorkspaceActual`). Si el contexto no
 * es `ws` (un cron que se olvidó el `runWithWorkspace`), no toca nada: escribiría el clip de un negocio en otro.
 */
export async function terminarClipDe(ws: number, puedePedir: boolean): Promise<SalidaClip> {
  if ((await getWorkspaceActual()) !== ws) return { ok: false, error: 'No sé de qué negocio es este clip: no lo toco.' };
  const pu = { ws, puedePedir };
  let leido: Awaited<ReturnType<typeof leer>>;
  try { leido = await leer(); } catch { return { ok: false, error: 'No pude leer tu clip de regalo. Vuelve a intentarlo en un momento.' }; }
  let { crudo, g } = leido;
  if (!g) return { ok: true, clip: publico(null, pu.puedePedir) };

  // Lo colgado se destraba primero (un server que murió a mitad de camino).
  const v = vencido(g, Date.now());
  if (v) {
    const nuevo = JSON.stringify(v);
    if (v.e === 'revisar') console.error(`[reto-clip-regalo] ⚠️ el clip del negocio ${pu.ws} quedó a revisar: ${v.porque}`);
    if (await cambiarSettingSi(CLAVE_CLIP_REGALO, crudo, nuevo).catch(() => false)) { crudo = nuevo; g = v; }
    else return { ok: true, clip: publico(g, pu.puedePedir) };
  }
  if (g.e !== 'generando') return { ok: true, clip: publico(g, pu.puedePedir) };

  const t = await estadoDeTarea(g.taskId);
  if (t.fase === 'esperando') return { ok: true, clip: publico(g, pu.puedePedir) };
  if (t.fase === 'error') {
    // Arrancó y falló: el intento ya contó (ApiMart lo cobra), y queda el otro si tiene.
    const fallo: EstadoGuardado = { e: 'fallo', at: ahoraIso(), intentos: g.intentos, porque: t.detalle };
    await cambiarSettingSi(CLAVE_CLIP_REGALO, crudo, JSON.stringify(fallo)).catch(() => false);
    return { ok: true, clip: publico(fallo, pu.puedePedir) };
  }

  // Terminó. Lo toma UNA vuelta (dos pestañas preguntando a la vez no lo guardan dos veces).
  const guardando: Extract<EstadoGuardado, { e: 'guardando' }> = { ...g, e: 'guardando', desde: ahoraIso() };
  const tomado = JSON.stringify(guardando);
  if (!(await cambiarSettingSi(CLAVE_CLIP_REGALO, crudo, tomado).catch(() => false))) return { ok: true, clip: publico(g, pu.puedePedir) };

  const url = await guardarVideo(g.planId, g.taskId, t.url);
  if (!url) {
    // Se suelta para la vuelta siguiente: el clip está pagado y el link de ApiMart dura 24 h.
    await cambiarSettingSi(CLAVE_CLIP_REGALO, tomado, JSON.stringify(g)).catch(() => false);
    return { ok: true, clip: publico(g, pu.puedePedir) };
  }
  try {
    await guardarEnHistorial(entradaDelHistorial(guardando, url));
  } catch (e) {
    console.error(`[reto-clip-regalo] no pude guardar el clip del negocio ${pu.ws} en el historial: ${e instanceof Error ? e.message : String(e)}`);
    await cambiarSettingSi(CLAVE_CLIP_REGALO, tomado, JSON.stringify(g)).catch(() => false);
    return { ok: true, clip: publico(g, pu.puedePedir) };
  }
  // Lo que costó, por negocio y sin cobrárselo (un regalo). El real lo dice ApiMart al terminar.
  // Sin `data.cost` (ApiMart no lo mandó), el estimado de la tabla, y se dice que es estimado.
  const usd = t.usdReal > 0 ? t.usdReal : USD_ESTIMADO_CLIP_REGALO;
  await recordCostoDeMedio(FEATURE_CLIP_REGALO, MODELO_OMNI, usd, { ws: pu.ws, motivo: `clip de regalo del reto (${g.deDonde}${t.usdReal > 0 ? '' : ', estimado'}) · ${g.taskId}` });
  const listo: EstadoGuardado = { e: 'listo', at: ahoraIso(), intentos: g.intentos, planId: g.planId, url, usd };
  await cambiarSettingSi(CLAVE_CLIP_REGALO, tomado, JSON.stringify(listo)).catch(() => false);
  return { ok: true, clip: publico(listo, pu.puedePedir) };
}
