// =============================================================================
// GET /api/agente/skill — la skill, servida, para que se instale como cualquier otra
// =============================================================================
// Auth: `Authorization: Bearer <token de /integraciones>`, igual que el resto de
// /api/agente/*. Devuelve el SKILL.md con la URL base y el token ya adentro.
//
// POR QUÉ EXISTE. Sin esto no había DE DÓNDE bajar la skill, así que la app la
// entregaba por el único canal que le quedaba: el portapapeles. Eso obligaba al
// usuario a manipular a mano 11.000 caracteres de markdown y ponerlos en la carpeta
// correcta — un procedimiento que ninguna otra skill necesita. La forma normal de
// instalar una skill es decirle a Claude dónde está y que la baje; para eso hace
// falta una URL, y ésta es la URL.
//
// EL TOKEN VA EN EL HEADER Y NO EN LA QUERY, aunque un `?t=` sería más cómodo para
// abrir esto en un navegador: una credencial en la URL queda en los logs del server,
// en el historial y en el `Referer` de cualquier link que se abra después. Un header
// no queda en ninguno de los tres.
//
// ⚠️ Y por eso mismo esta respuesta es `no-store` y `X-Robots-Tag: noindex`: el cuerpo
// LLEVA el token adentro. Un intermediario que la cachee estaría guardando la
// credencial de un cliente.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { bearerDe, wsDelBearer, getAgenteToken } from '@/lib/agente-token';
import { agenteSkillMarkdown, AGENTE_SKILL_ARCHIVO } from '@/lib/agente-skill';
import { APP_BASE_URL } from '@/lib/app-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const token = bearerDe(req);
  const ws = await wsDelBearer(token);
  if (ws instanceof Response) return ws;
  if (ws == null) {
    return NextResponse.json({ ok: false, error: 'token inválido o revocado' }, { status: 401 });
  }

  // Se relee el token vigente del workspace en vez de reusar el del header. Son el
  // mismo valor —`wsPorAgenteToken` ya lo verificó— pero así el archivo que se entrega
  // sale SIEMPRE de la fuente de verdad, y no de lo que mandó el que pidió.
  const vigente = (await getAgenteToken(ws)) ?? token;

  // La URL base se toma del REQUEST y no del entorno: la skill que se baja desde
  // localhost tiene que apuntar a localhost. `APP_BASE_URL` queda de respaldo por si
  // hay un proxy adelante que reescribe el Host.
  const base = new URL(req.url).origin || APP_BASE_URL;

  return new NextResponse(agenteSkillMarkdown(base, vigente), {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${AGENTE_SKILL_ARCHIVO}"`,
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex',
    },
  });
}
