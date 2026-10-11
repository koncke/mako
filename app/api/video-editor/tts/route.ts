// =============================================================================
// /api/video-editor/tts — «Texto a voz» del Video Editor, con la key DEL CLIENTE
// =============================================================================
// GET                        → { ok, hayKey, voces:[…], tope }   (lectura, gratis)
// POST json {texto, voz}     → el mp3 (audio/mpeg) | { ok:false, error, motivo }
//
// La pestaña «Texto a voz» del panel derecho (subtitles/components/texto-a-voz.tsx)
// pide la lista de voces de la cuenta del cliente y, con el botón «Generar
// contenido de voz», UN mp3 que el editor guarda en el proyecto y pone en la
// línea de tiempo al inicio del texto.
//
// Las reglas que mandan acá (AGENTS.md):
//   · BYOK: `decirConVoz` / `listarVoces` resuelven `elevenKey()` = la key DEL
//     CLIENTE (`credDelCliente`). Sin key: «Conecta ElevenLabs en Integraciones»
//     y nada más. NUNCA la key de la plataforma, ni de respaldo.
//   · «En lo que gasta plata ajena, el default es NO reintentar»: un click es UN
//     pedido. Ni esta ruta ni la pantalla reintentan; si la respuesta no vuelve,
//     el cliente decide si aprieta de nuevo.
//   · «Un default que cobra es un cobro silencioso»: nada genera solo. La muestra
//     de cada voz es el mp3 de ElevenLabs (`preview_url`), que no consume cuota.
//   · «Una capacidad nueva se DECLARA en el registro de la API»: ésta NO entra, a
//     propósito. docs/api-mako-diseno.md §8 deja la generación que gasta créditos
//     de terceros (voz incluida) fuera de v1 «ni como `pantalla`», y el área
//     `video` lo repite. El cuerpo es `decirConVoz` de lib/elevenlabs.ts, el mismo
//     que usa el onboarding del Video Generator: no hay una segunda implementación.
//
// La puerta es la de app/api-mako/actions.ts: sesión, rol de admin, el candado del
// editor (`veEditorVideo`, el mismo de `requireEditorVideo` en las pages), capa con
// la tab y workspace. ⚠️ El
// workspace se exige ANTES de tocar la key: `credDelCliente` sin workspace cae al
// ws 1 (`wsDefault` → OWNER_WS), que es un CLIENTE, no la casa.
//
// Va detrás de la sesión (NO está en lib/rutas-publicas.ts) y el proxy le exige
// Origin propio al POST.

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { veEditorVideo } from '@/app/video-editor/acceso';
import { tabEnCapa } from '@/lib/capas';
import { rateLimit } from '@/lib/rate-limit';
import { decirConVoz, listarVoces, TOPE_TTS } from '@/lib/elevenlabs';
import { textoEleven, type FalloEleven } from '@/lib/elevenlabs-fallo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// 400 caracteres tardan unos segundos; el default de 10 s puede cortar con el
// pedido ya cobrado.
export const maxDuration = 60;

const SIN_KEY = 'Conecta ElevenLabs en Integraciones';

type Puerta = { ws: number } | { error: string; status: number };

async function puerta(): Promise<Puerta> {
  const [sesion, rol] = await Promise.all([getUsuarioActual(), getRolWsEfectivo()]);
  if (!sesion || rol == null) return { error: 'Tu sesión venció. Vuelve a entrar.', status: 401 };
  if (rol !== 'admin') return { error: 'Solo el administrador.', status: 403 };
  // El MISMO candado que las pages del editor (app/video-editor/acceso.ts: hoy, sólo
  // el super admin). 404 y no 403: a quien no le toca, el editor no existe.
  if (!(await veEditorVideo())) return { error: 'No encontrado.', status: 404 };
  if (!tabEnCapa('video-editor', await getCapaActual())) return { error: 'Tu plan no incluye el Video Editor.', status: 403 };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Entra a un cliente primero.', status: 400 };
  return { ws };
}

/** Lo que dice la pantalla por cada motivo: corto, y sin culpar al cliente por lo ajeno. */
function textoDe(motivo: FalloEleven): string {
  if (motivo === 'sin_key') return SIN_KEY;
  // El texto de `voz_muerta` de textoEleven habla del CLON; acá la voz puede ser
  // cualquiera de la cuenta.
  if (motivo === 'voz_muerta') return 'Esa voz ya no está en tu cuenta de ElevenLabs';
  // `proveedor` de textoEleven promete que «se reintenta solo»: acá NO.
  if (motivo === 'proveedor') return 'ElevenLabs no está respondiendo. Prueba más tarde.';
  return textoEleven(motivo).titulo;
}

const fallo = (error: string, status: number, motivo?: FalloEleven) =>
  Response.json({ ok: false, error, motivo: motivo ?? null }, { status, headers: { 'cache-control': 'no-store' } });

export async function GET() {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  return runWithWorkspace(p.ws, async () => {
    try {
      const r = await listarVoces();
      if (!r.ok) {
        // Sin key es un estado, no un error: la pestaña dibuja el aviso y nada más.
        if (r.motivo === 'sin_key') {
          return Response.json({ ok: true, hayKey: false, voces: [], tope: TOPE_TTS }, { headers: { 'cache-control': 'no-store' } });
        }
        console.error(`[video-editor/tts] voces (ws ${p.ws}): ${r.motivo} ${r.error}`);
        return fallo(textoDe(r.motivo), 502, r.motivo);
      }
      return Response.json(
        { ok: true, hayKey: true, voces: r.valor, tope: TOPE_TTS },
        { headers: { 'cache-control': 'no-store' } },
      );
    } catch (e) {
      console.error(`[video-editor/tts] voces (ws ${p.ws}): ${e instanceof Error ? e.message : String(e)}`);
      return fallo('No se pudieron cargar las voces', 500);
    }
  });
}

export async function POST(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);

  let body: { texto?: unknown; voz?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return fallo('Pedido inválido', 400); }
  const texto = typeof body.texto === 'string' ? body.texto.trim() : '';
  const voz = typeof body.voz === 'string' ? body.voz.trim() : '';
  if (!texto) return fallo('El texto está vacío', 400);
  if (!voz || voz.length > 64) return fallo('Elige una voz', 400);
  // Se rechaza en vez de cortar: `decirConVoz` recorta a TOPE_TTS y el audio
  // terminaría a mitad de frase, cobrado igual.
  if (texto.length > TOPE_TTS) return fallo('Se alcanzó el límite de caracteres', 400);
  // Un techo de clicks, no un reintento: corta una ráfaga (doble click, una tecla
  // trabada) antes de que llegue a la cuenta del cliente.
  if (!rateLimit(`video-editor:tts:${p.ws}`, 20, 60_000)) return fallo('Demasiados intentos. Espera un minuto.', 429);

  return runWithWorkspace(p.ws, async () => {
    try {
      const r = await decirConVoz(voz, texto);
      if (!r.ok) {
        if (r.motivo !== 'sin_key') console.error(`[video-editor/tts] generar (ws ${p.ws}): ${r.motivo} ${r.error}`);
        return fallo(textoDe(r.motivo), r.motivo === 'sin_key' ? 400 : 502, r.motivo);
      }
      return new Response(new Uint8Array(r.valor.mp3), {
        headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' },
      });
    } catch (e) {
      // ⚠️ Sin reintento: si el pedido llegó a ElevenLabs, ya se cobró.
      console.error(`[video-editor/tts] generar (ws ${p.ws}): ${e instanceof Error ? e.message : String(e)}`);
      return fallo('No se pudo generar la voz', 500);
    }
  });
}
