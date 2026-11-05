'use server';

// =============================================================================
// AI Avatar — server actions
// =============================================================================
// Pedido de Martín (17/10/2026, desde el Centro de Operaciones): «implementes end-to-end la tab nueva de "AI Avatar"…
// algo como Heygen». Y el 29/10/2026: «Lo mismo para AI Avatar... replica a higgsfield tal cual». La pantalla pasó a
// ser el estudio de Higgsfield (./Estudio.tsx): los PROYECTOS son los looks, y cada uno junta sus videos.
//
// Acá NO hay un camino de generación propio, igual que en el «Avatar de IA» del Video Editor
// (app/video-editor/avatar/actions.ts):
//   · el LOOK es una imagen `generar_imagen` del puente a Flow con la cara de la persona (lib/flow-cara.ts), la
//     composición de un preset y, al final, lo que la persona escribió en la barra (lib/ai-avatar/prompt-look.ts);
//   · el VIDEO es el plan del Video Generator (`generarPlanAction`, guion literal) con el look como escenario de todas
//     las tomas (`conAvatar`), y cada toma se filma con SU `generarTomaAction` (./filmar.ts): ahí viven el freno de
//     plata, el puente y la cara.
//
// DEPRECADO el 29/10/2026 («prefiero deprecar antes que conservar»): las acciones de las Voces (la galería pública de
// ElevenLabs y «Agregar a mi cuenta»). La voz elegida no llegaba al video —el Video Generator habla con la voz de Flow
// en el acento del negocio— así que la sección prometía algo que el motor no hace. La voz propia sobre el video sigue
// en «lo que quedó sin hacer» (docs/hallazgos-ai-avatar.md); la galería (lib/ai-avatar/voces-galeria.ts) queda como dato.

import { randomUUID } from 'node:crypto';
import { veAiAvatar } from './acceso';
import { leerLooks, guardarLook, quitarLook, type Look } from './looks';
import { getWorkspaceActual, getTenantDb } from '@/lib/workspace';
import { estadoPuente, encolar, esRechazoDeModeracion } from '@/lib/flow-cola';
import { estaVivo } from '@/lib/flow-puente-frescura';
import { usaInterfaz, pedidoImagenInterfaz, rutaDeSubida } from '@/lib/flow-interfaz';
import { caraDeFoto } from '@/lib/flow-cara';
import { imagenesDeRespuesta } from '@/lib/flow-imagen';
import { plantillaPorId, PLANTILLAS_AVATAR } from '@/lib/ai-avatar/plantillas';
import { promptDelLook, limpiarDetalle } from '@/lib/ai-avatar/prompt-look';
import { videosDelLook, type VideoDeLook } from '@/lib/ai-avatar/proyectos';
import type { PuenteVisto } from '@/lib/ai-avatar/requisitos';
import { estadoContextoVideo, leerHistorial, guardarEnHistorial } from '@/app/video-generator/video-datos';
import { generarPlanAction } from '@/app/video-generator/actions';
import { avataresDelHistorial, conAvatar, type AvatarIA } from '@/app/video-editor/avatar/avatares';
import { frenoDePrueba, sumarUsoDePrueba } from '@/lib/prueba-uso';

const NO_PUEDE = 'Todavía no tienes acceso a AI Avatar.';
const SIN_WS = 'Elige un workspace arriba para usar AI Avatar.';

async function puerta(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await veAiAvatar())) return { ok: false, error: NO_PUEDE };
  if ((await getWorkspaceActual()) == null) return { ok: false, error: SIN_WS };
  return { ok: true };
}

// ── El puente: ¿se puede generar ahora? ─────────────────────────────────────

/**
 * El puente del negocio para AI Avatar: si se puede generar ahora (`puede`, y si no, el `motivo` en una frase) y lo que la
 * pantalla necesita para listar los pasos que faltan (lib/ai-avatar/requisitos.ts): el estado, si late y si la extensión es
 * la que genera por la interfaz. Lo de la persona (la extensión, su Flow, su foto) se dice ANTES de «Generar».
 */
export type EstadoPuenteAvatar = PuenteVisto & { puede: boolean; motivo: string };

/**
 * Lo mismo que exige el Video Generator antes de encolar, más una cosa: los looks salen sólo por el motor por interfaz
 * (extensión ≥ 0.69). El camino viejo de BOQ no sabe adjuntar la cara de una foto, y generar sin cara es generar a otra
 * persona.
 */
async function puenteParaAvatar(): Promise<EstadoPuenteAvatar> {
  const p = await estadoPuente().catch(() => null);
  const visto: PuenteVisto = {
    estado: p?.estado ?? 'sin_conectar',
    vivo: !!p && estaVivo(p.ultimoVisto, Date.now()),
    actualizada: !!p && usaInterfaz(p.version),
  };
  const no = (motivo: string): EstadoPuenteAvatar => ({ ...visto, puede: false, motivo });
  if (!p || p.estado === 'sin_conectar') return no('Conecta la extensión de MaKo para generar.');
  if (p.estado === 'marcada') return no('Google pausó tu sesión de Flow. Abre la extensión de MaKo.');
  if (!visto.vivo) return no('Tu navegador dejó de responder. Abre la extensión de MaKo.');
  if (!visto.actualizada) return no('Actualiza la extensión de MaKo para crear avatares.');
  if (p.estado !== 'listo') return no('Abre Google Flow con tu cuenta, desde el ícono de MaKo.');
  return { ...visto, puede: true, motivo: '' };
}

// ── Lo que dibuja la tab ─────────────────────────────────────────────────────

/** Un proyecto del estudio: un look (la persona en la escena de un preset) y los videos que se hicieron con él. */
export type LookCard = {
  id: string;
  plantillaId: string;
  nombre: string;
  lugar: string;
  url: string;
  /** El `mediaId` en Flow: con esto se anima. '' hasta que Flow lo devuelve. */
  mediaId: string;
  fotoId: string;
  detalle: string;
  creadoEn: string;
  estado: 'generando' | 'listo' | 'error';
  error: string;
  videos: VideoDeLook[];
};

export type InicioOut =
  | {
    ok: true;
    looks: LookCard[];
    fotos: { id: string; url: string }[];
    puente: EstadoPuenteAvatar;
    acento: string;
  }
  | { ok: false; error: string };

function tarjetaDeLook(l: Look, videos: VideoDeLook[] = []): LookCard {
  const p = plantillaPorId(l.plantillaId);
  return {
    id: l.id,
    plantillaId: l.plantillaId,
    nombre: p?.nombre ?? 'Look',
    lugar: p?.lugar ?? '',
    url: l.url,
    mediaId: l.mediaId,
    fotoId: l.fotoId,
    detalle: l.detalle,
    creadoEn: l.creadoEn,
    estado: l.mediaId && l.url ? 'listo' : l.error ? 'error' : 'generando',
    error: l.error,
    videos,
  };
}

export async function inicioAvatarAction(): Promise<InicioOut> {
  const g = await puerta();
  if (!g.ok) return g;
  const [looks, historial, contexto, puente] = await Promise.all([
    leerLooks(),
    leerHistorial(),
    estadoContextoVideo().catch(() => null),
    puenteParaAvatar(),
  ]);
  return {
    ok: true,
    looks: looks.map((l) => tarjetaDeLook(l, videosDelLook(historial, l.mediaId))),
    fotos: contexto?.fotos ?? [],
    puente,
    acento: contexto?.acento.etiqueta ?? '',
  };
}

// ── Crear un look ────────────────────────────────────────────────────────────

export async function crearLookAction(input: { plantillaId: string; fotoId: string; detalle?: string }): Promise<
  { ok: true; look: LookCard } | { ok: false; error: string }
> {
  const g = await puerta();
  if (!g.ok) return g;
  const plantilla = plantillaPorId(String(input.plantillaId ?? ''));
  if (!plantilla) return { ok: false, error: 'Elige un preset.' };
  const contexto = await estadoContextoVideo().catch(() => null);
  const foto = contexto?.fotos.find((f) => f.id === input.fotoId);
  if (!foto) return { ok: false, error: 'Elige una de tus fotos.' };
  const detalle = limpiarDetalle(input.detalle);

  const puente = await puenteParaAvatar();
  if (!puente.puede) return { ok: false, error: puente.motivo };

  // La cara: el mediaId de ESA foto en Flow. Si todavía no está, la sube (un latido) y se vuelve a intentar, como en el
  // Video Generator.
  const cara = await caraDeFoto(foto.id);
  if (!cara) return { ok: false, error: 'MaKo está subiendo tu foto a Google. En unos segundos vuelve a intentar.' };

  // LA PRUEBA GRATIS (25/10/2026): el look es una imagen generada (lib/prueba-uso.ts).
  const ws = (await getWorkspaceActual())!;
  const enPrueba = await frenoDePrueba(ws, 'prueba.imagenes');
  if (!enPrueba.ok) return { ok: false, error: enPrueba.texto };
  const trabajoId = await encolar('generar_imagen', pedidoImagenInterfaz({
    prompt: promptDelLook(plantilla, detalle),
    cara,
    ruta: rutaDeSubida('ai-avatar', 'escena', 1, randomUUID()),
  }));
  // Creem frenó el prompt (lib/creem-moderacion.ts): no se encoló nada ni cuenta para la prueba.
  if (esRechazoDeModeracion(trabajoId)) return { ok: false, error: trabajoId.texto };
  if (trabajoId == null) return { ok: false, error: 'No se pudo pedir el look. Es un problema nuestro: vuelve a intentar.' };
  await sumarUsoDePrueba(ws, 'prueba.imagenes');

  const look: Look = {
    id: randomUUID(),
    plantillaId: plantilla.id,
    fotoId: foto.id,
    trabajoId,
    mediaId: '',
    url: '',
    error: '',
    detalle,
    creadoEn: new Date().toISOString(),
  };
  await guardarLook(look);
  return { ok: true, look: tarjetaDeLook(look) };
}

/** Cuánto puede esperar un pedido que nadie toma: el mismo plazo del Video Generator. */
const ABANDONO_MS = 4 * 60 * 1000;

/**
 * Cómo va un look. Un paso por llamada, sin esperar adentro: la pantalla vuelve a preguntar.
 */
export async function estadoLookAction(lookId: string): Promise<{ ok: true; look: LookCard } | { ok: false; error: string }> {
  const g = await puerta();
  if (!g.ok) return g;
  const look = (await leerLooks()).find((l) => l.id === lookId);
  if (!look) return { ok: false, error: 'Ese proyecto ya no está.' };
  if ((look.mediaId && look.url) || look.error || look.trabajoId == null) return { ok: true, look: tarjetaDeLook(look) };

  const db = await getTenantDb();
  const { data, error } = await db
    .from('flow_trabajos')
    .select('estado, resultado, error, tomado_at, created_at')
    .eq('id', look.trabajoId)
    .maybeSingle();
  // No poder leer no es «no salió»: se vuelve a preguntar.
  if (error || !data) return { ok: true, look: tarjetaDeLook(look) };

  const estado = String(data.estado ?? '');
  if (estado === 'listo') {
    const img = imagenesDeRespuesta(data.resultado)[0];
    const hecho: Look = img?.url
      ? { ...look, url: img.url, mediaId: img.mediaId ?? '' }
      : { ...look, error: 'Flow terminó sin devolver la imagen. Vuelve a crearlo.' };
    // Sin `mediaId` la imagen se ve pero no se puede animar: no sirve como avatar.
    if (img?.url && !img.mediaId) hecho.error = 'Flow devolvió la imagen sin su id. Vuelve a crearlo.';
    await guardarLook(hecho);
    return { ok: true, look: tarjetaDeLook(hecho) };
  }
  if (estado === 'fallido') {
    // Lo que escribe la cola es «frase para la persona» + `[crudo]` técnico abajo.
    const frase = String(data.error ?? '').split('\n[crudo]')[0].trim() || 'Flow no pudo generar el look.';
    const fallo: Look = { ...look, error: frase };
    await guardarLook(fallo);
    return { ok: true, look: tarjetaDeLook(fallo) };
  }
  const nacio = Date.parse(String(data.created_at ?? ''));
  if (!data.tomado_at && Number.isFinite(nacio) && Date.now() - nacio > ABANDONO_MS) {
    // Se CIERRA antes de contestar: si el navegador despierta más tarde, no lo genera a escondidas de una pantalla que
    // ya dijo que no salió.
    await db.from('flow_trabajos')
      .update({ estado: 'fallido', motivo: 'puente_ausente', error: 'Nadie levantó el pedido.', listo_at: new Date().toISOString() })
      .eq('id', look.trabajoId)
      .eq('estado', 'pendiente');
    const fallo: Look = { ...look, error: 'Tu navegador no tomó el pedido. Abre la extensión de MaKo y vuelve a intentar.' };
    await guardarLook(fallo);
    return { ok: true, look: tarjetaDeLook(fallo) };
  }
  return { ok: true, look: tarjetaDeLook(look) };
}

/**
 * «Eliminar» un proyecto: lo saca de la lista de MaKo. La imagen sigue en el Flow de la persona y sus videos en el
 * historial del Video Generator (los usa el Video Editor): esto no borra ningún archivo.
 */
export async function borrarLookAction(lookId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const g = await puerta();
  if (!g.ok) return g;
  const quitado = await quitarLook(String(lookId ?? '')).catch(() => null);
  if (quitado == null) return { ok: false, error: 'No se pudo eliminar. Vuelve a intentar.' };
  return quitado ? { ok: true } : { ok: false, error: 'Ese proyecto ya no está.' };
}

// ── Crear el video ───────────────────────────────────────────────────────────

export type CrearVideoOut = { ok: true; planId: string; tomas: number[] } | { ok: false; error: string };

/**
 * Arma el plan del Video Generator con el guion LITERAL y el avatar elegido como escenario de todas las tomas. Filmar
 * lo hace la pantalla, toma por toma, con `generarTomaAction` (en serie y sin reintento: cada toma se paga).
 */
export async function crearVideoAction(input: { avatarId: string; guion: string }): Promise<CrearVideoOut> {
  const g = await puerta();
  if (!g.ok) return g;
  const guion = String(input.guion ?? '').trim();
  if (!guion) return { ok: false, error: 'Escribe lo que va a decir tu avatar.' };

  const [looks, historial] = await Promise.all([leerLooks(), leerHistorial()]);
  let avatar: AvatarIA | null = null;
  const look = looks.find((l) => l.mediaId && l.mediaId === input.avatarId && l.url);
  if (look) {
    const p = plantillaPorId(look.plantillaId) ?? PLANTILLAS_AVATAR[0];
    avatar = {
      id: look.mediaId,
      url: look.url,
      lugar: p.lugar,
      puestaId: p.puestaId,
      deAnuncio: 'AI Avatar',
      escena: { n: 1, desde: 1, hasta: 1, lugar: p.lugar, prompt: p.prompt },
    };
  } else {
    // Un escenario de un anuncio (el «Avatar de IA» del Video Editor los ofrece): se sigue aceptando por id.
    avatar = avataresDelHistorial(historial).find((a) => a.id === input.avatarId) ?? null;
  }
  if (!avatar) return { ok: false, error: 'Ese avatar ya no está. Elige otro.' };

  // LA PRUEBA GRATIS (25/10/2026): un video con avatar de IA cuenta para el tope de la prueba (lib/prueba-uso.ts).
  const ws = (await getWorkspaceActual())!;
  const enPrueba = await frenoDePrueba(ws, 'prueba.avatares');
  if (!enPrueba.ok) return { ok: false, error: enPrueba.texto };
  const plan = await generarPlanAction({
    puestaId: avatar.puestaId,
    guionId: '',
    guionTexto: guion,
    // Es SU texto: va tal cual, sin que MaKo le cambie las palabras.
    adaptarVoz: false,
    // Un avatar que dice una frase no es un anuncio de siete tomas.
    clipsMinimos: 1,
  });
  if (!plan.ok) return plan;
  const item = conAvatar(plan.item, avatar);
  await guardarEnHistorial(item);
  await sumarUsoDePrueba(ws, 'prueba.avatares');
  return { ok: true, planId: item.id, tomas: item.plan.clips.map((c) => c.n) };
}
