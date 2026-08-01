// =============================================================================
// API: elegir QUÉ conversaciones analiza MaKo (paso de contexto)
// =============================================================================
// Es normal que el dueño mezcle su número personal con el de la empresa. En vez
// de leerle TODO (y sacar conclusiones de chats que no son de clientes), le
// mostramos sus conversaciones y él elige cuáles puede leer MaKo.
//
// GET → { conversaciones: [{ chatJid, nombre, telefono, mensajes, ultimo }] }
// Guard: admin del workspace. Todo por getTenantDb: no sale del workspace.
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual, getTenantDb } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede configurar esta tab.' }, { status: 403 });
  }
  try {
    const supabase = await getTenantDb();
    const { data } = await supabase
      .from('wa_mensajes')
      .select('chat_jid, telefono, push_name, texto, from_me, wa_timestamp')
      .not('chat_jid', 'is', null)
      .order('wa_timestamp', { ascending: false })
      .limit(4000);

    type Fila = { chat_jid: string; telefono: string | null; push_name: string | null; texto: string | null; from_me: boolean; wa_timestamp: string | null };
    const porChat = new Map<string, { chatJid: string; nombre: string | null; telefono: string | null; mensajes: number; propios: number; ultimo: string | null; muestra: string | null }>();
    for (const f of (data ?? []) as Fila[]) {
      // Los grupos no son conversaciones con clientes.
      if (f.chat_jid.endsWith('@g.us')) continue;
      let c = porChat.get(f.chat_jid);
      if (!c) {
        c = { chatJid: f.chat_jid, nombre: null, telefono: f.telefono, mensajes: 0, propios: 0, ultimo: f.wa_timestamp, muestra: null };
        porChat.set(f.chat_jid, c);
      }
      c.mensajes += 1;
      if (f.from_me) c.propios += 1;
      if (!c.nombre && !f.from_me && f.push_name) c.nombre = f.push_name;
      if (!c.muestra && f.texto) c.muestra = f.texto.slice(0, 90);
    }

    // Solo sirven las conversaciones donde el dueño ESCRIBIÓ (de ahí se aprende
    // su forma de escribir) y con ida y vuelta real.
    const conversaciones = [...porChat.values()]
      .filter((c) => c.propios >= 2 && c.mensajes >= 4)
      .sort((a, b) => (b.ultimo ?? '').localeCompare(a.ultimo ?? ''))
      .slice(0, 120);

    return Response.json({ ok: true, conversaciones });
  } catch (e) {
    console.error(`[api:setting/onboarding/conversaciones] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
