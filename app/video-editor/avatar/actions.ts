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
//
// SÓLO MaKo Pro DESDE EL 14/11/2026, y ACÁ TAMBIÉN. Martín, sobre /planes: «el de 97
// ya podés generar avatares de IA… el de 47 debería estar bien limitado y
// restrictivo». El candado es el de la tab (`candadoDeAiAvatar`,
// app/ai-avatar/acceso.ts → `FUNCIONES_SOLO_PRO`, 'ai-avatar'), no uno nuevo.
// ⚠️ ESTA ERA LA PUERTA QUE FALTABA: el 14/11 se cerró la tab AI Avatar y se dio por
//    cerrada la función, pero el VIDEO EDITOR está abierto en los dos planes
//    (`TABS_SOLO_PRO` sólo tiene 'closing-analyst'), así que un Esencial entraba por
//    Biblioteca › «Avatar de IA», elegía un look de su historial, escribía el guion y
//    filmaba el video gastando créditos de Flow, sin pasar nunca por /ai-avatar. El
//    candado va en la FUNCIÓN QUE HACE LA COSA (AGENTS.md: «no en la pantalla»), o
//    sea en `crearAvatarAction`; la pestaña lo dibuja aparte (../_opencut/avatar/).

import { veEditorVideo } from '../acceso';
import { candadoDeAiAvatar } from '@/app/ai-avatar/acceso';
import { generarPlanAction } from '@/app/video-generator/actions';
import {
  estadoContextoVideo,
  guardarEnHistorial,
  leerHistorial,
} from '@/app/video-generator/video-datos';
import { avataresDelHistorial, conAvatar } from './avatares';
import { getWorkspaceActual } from '@/lib/workspace';
import { frenoDePrueba, sumarUsoDePrueba } from '@/lib/prueba-uso';

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

/**
 * ⚠️ SIN CANDADO, A PROPÓSITO: esto LEE (los escenarios que ya están en su historial, el acento y si tiene fotos). Lo que es
 * de Pro es GENERAR, y cerrar la lectura le deja a un Esencial una biblioteca vacía con un error en vez de sus propios
 * avatares — el mismo daño que hizo el candado en la puerta común de app/ai-avatar/actions.ts, que le borró la galería de
 * fotos a la guía del chat. Como dice el test de la tab: entra, los ve, y lo que no puede es generar.
 */
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
  // SÓLO MaKo Pro (14/11/2026, arriba): ésta es la función que filma el video con su avatar, así que el candado va acá y no
  // en la pestaña. Es el MISMO (`candadoDeAiAvatar`) que frena el estudio de /ai-avatar: dos candados para la misma acción se
  // contradicen el día que uno cambie.
  // ⚠️ ANTES QUE TODO LO DEMÁS: rechazar no tiene que consumirle un avatar de su prueba gratis (`frenoDePrueba`, abajo) ni
  //    pedirle a Flow nada. Y «ante la duda, pasa»: si no se pudo leer el plan, `candadoDeAiAvatar` devuelve null.
  const pro = await candadoDeAiAvatar();
  if (pro) return { ok: false, error: pro };
  const guion = (input.guion ?? '').trim();
  if (!guion) return { ok: false, error: 'Escribe lo que quieres que lea el avatar de IA' };

  const avatar = avataresDelHistorial(await leerHistorial()).find((a) => a.id === input.avatarId);
  if (!avatar) return { ok: false, error: 'Ese avatar ya no está. Elige otro.' };

  // LA PRUEBA GRATIS (25/10/2026): un video con avatar de IA cuenta para el tope de la prueba (lib/prueba-uso.ts).
  const ws = await getWorkspaceActual();
  if (ws != null) {
    const enPrueba = await frenoDePrueba(ws, 'prueba.avatares');
    if (!enPrueba.ok) return { ok: false, error: enPrueba.texto };
  }
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
  if (ws != null) await sumarUsoDePrueba(ws, 'prueba.avatares');
  return { ok: true, planId: item.id, tomas: item.plan.clips.map((c) => c.n) };
}
