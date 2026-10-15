// =============================================================================
// /api/chats — la lista de la tab Chats (la bandeja unificada copiada de respond.io)
// =============================================================================
// GET               → { ok, chats, lineas, cuentasSociales, etapas, yo, equipo, fallas }
// GET ?buscar=<q>   → { ok, chats, fallas } — lo que matchea en el servidor (leads del CRM y personas de
//                     Instagram/Messenger), aunque no tenga mensajes. La pantalla lo SUMA (por clave) a lo que
//                     ya filtró en memoria. Con menos de 2 caracteres, `chats: []`.
//
// Contrato: docs/diseno-chats.md §2.2. La puerta es `puertaChats` (lib/chats.ts): sesión, la tab en la capa y
// un workspace. `fallas` = las fuentes que NO se pudieron leer: «no pude leer» es un tercer estado, nunca
// «no hay chats». La pantalla sondea esto cada 15 s con la pestaña visible: el mismo costo que /whatsapp.

import { NextResponse, type NextRequest } from 'next/server';
import { puertaChats, listarChats } from '@/lib/chats';
// El equipo con su foto, por el MISMO lector que el desplegable de Setter/Closer del CRM (sin admins de
// agencia, suspendidos ni MaKo): una lista, un lugar.
import { getEquipoAction } from '@/app/crm/actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** Una lectura por línea de WhatsApp + Instagram/Messenger + el CRM: holgado, como la bandeja de /whatsapp. */
export const maxDuration = 60;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const puerta = await puertaChats();
  if (!puerta.ok) return err(puerta.status, puerta.error);
  const buscar = req.nextUrl.searchParams.get('buscar');
  try {
    if (buscar != null) {
      if (buscar.trim().length < 2) return NextResponse.json({ ok: true, chats: [], fallas: [] });
      const r = await listarChats({ buscar, usuario: puerta.yo });
      return NextResponse.json({ ok: true, chats: r.chats, fallas: r.fallas });
    }
    const [r, equipo] = await Promise.all([listarChats({ usuario: puerta.yo }), getEquipoAction()]);
    return NextResponse.json({
      ok: true,
      chats: r.chats,
      lineas: r.lineas,
      cuentasSociales: r.cuentasSociales,
      etapas: r.etapas,
      yo: puerta.yo,
      equipo: equipo.map((m) => ({ nombre: m.nombre, foto_url: m.foto_url })),
      fallas: r.fallas,
    });
  } catch (e) {
    console.error(`[api:chats] ${msg(e)}`);
    return err(500, 'No pude leer los chats.');
  }
}
