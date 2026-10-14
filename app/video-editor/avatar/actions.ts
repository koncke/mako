'use server';

// =============================================================================
// «Avatar de IA» del Video Editor — server actions
// =============================================================================
// Pedido de Martín (14/10/2026): «implementa lo que ya tenemos en MaKo para la
// generación de videos con esa tab que tiene Capcut de "Avatar de IA"».
//
// Acá NO hay un camino de generación propio. Lo que se escribe es lo mínimo para
// llegar al del Video Generator:
//   · `avataresAction`: los escenarios confirmados de su historial (./avatares.ts).
//   · `crearAvatarAction`: su `generarPlanAction` con el guion LITERAL y un piso de
//     una toma, más el avatar como escenario confirmado de todas las tomas.
// Filmar y preguntar cómo va lo hacen `generarTomaAction` y `estadoTomaAction`
// (app/video-generator/video-action.ts), llamadas tal cual desde la pestaña: ahí
// viven el freno de plata, el puente y la cara.

import { veEditorVideo } from '../acceso';
import { generarPlanAction } from '@/app/video-generator/actions';
import {
  estadoContextoVideo,
  guardarEnHistorial,
  leerHistorial,
} from '@/app/video-generator/video-datos';
import { avataresDelHistorial, conAvatar } from './avatares';

/** Lo que la pestaña necesita de un avatar (sin el prompt de la escena). */
export type AvatarParaElegir = {
  id: string;
  url: string;
  lugar: string;
  deAnuncio: string;
};

export type AvataresOut =
  | { ok: true; avatares: AvatarParaElegir[]; voz: string; tieneFotos: boolean }
  | { ok: false; error: string };

const NO_PUEDE = 'Solo el administrador del workspace puede generar avatares.';

export async function avataresAction(): Promise<AvataresOut> {
  if (!(await veEditorVideo())) return { ok: false, error: NO_PUEDE };
  const [historial, contexto] = await Promise.all([
    leerHistorial(),
    estadoContextoVideo().catch(() => null),
  ]);
  return {
    ok: true,
    avatares: avataresDelHistorial(historial).map(({ id, url, lugar, deAnuncio }) => ({ id, url, lugar, deAnuncio })),
    // La voz que va a usar la generación: la MISMA resolución que hace
    // `generarPlanAction` (el acento del cliente), así lo que dice la pantalla es
    // lo que sale.
    voz: contexto?.acento.etiqueta ?? '',
    tieneFotos: contexto?.tieneFotos ?? false,
  };
}

export type CrearAvatarOut =
  | { ok: true; planId: string; tomas: number[] }
  | { ok: false; error: string };

export async function crearAvatarAction(input: {
  avatarId: string;
  guion: string;
}): Promise<CrearAvatarOut> {
  if (!(await veEditorVideo())) return { ok: false, error: NO_PUEDE };
  const guion = (input.guion ?? '').trim();
  if (!guion) return { ok: false, error: 'Escribe lo que quieres que lea el avatar de IA' };

  const avatar = avataresDelHistorial(await leerHistorial()).find((a) => a.id === input.avatarId);
  if (!avatar) return { ok: false, error: 'Ese avatar ya no está. Elige otro.' };

  const plan = await generarPlanAction({
    puestaId: avatar.puestaId,
    guionId: '',
    guionTexto: guion,
    // Es SU texto: va tal cual, sin que MaKo le cambie las palabras.
    adaptarVoz: false,
    // Un avatar que dice una frase no es un anuncio de 7 tomas: tantas como el
    // texto necesite, desde una.
    clipsMinimos: 1,
  });
  if (!plan.ok) return plan;

  const item = conAvatar(plan.item, avatar);
  await guardarEnHistorial(item);
  return { ok: true, planId: item.id, tomas: item.plan.clips.map((c) => c.n) };
}
