// =============================================================================
// API: elegir QUÉ conversaciones analiza MaKo (paso "Tu forma de escribir")
// =============================================================================
// Es normal que el dueño mezcle su número personal con el de la empresa. En vez
// de leerle TODO —y sacar conclusiones de chats que no son de clientes—, se le
// muestran sus conversaciones y él elige.
//
// Tres cosas que esta ruta aprendió a la mala:
//
//   1. AGRUPAR POR TELÉFONO, no por chat_jid. Evolution guarda entrantes y
//      salientes bajo jids que a veces difieren (@lid vs @s.whatsapp.net, el 9
//      de Argentina, sufijo de dispositivo). Agrupando por el jid crudo, una
//      misma charla se partía en dos o tres filas, cada una con la mitad de los
//      mensajes — y el filtro de abajo las mataba a todas. Es el mismo criterio
//      que usa el inbox (claveTel).
//   2. MARCAR, no filtrar. Antes se descartaba todo chat con menos de 2
//      mensajes propios; ahora se devuelve igual con `apta: false`. Esconder una
//      conversación es peor que mostrarla sin preseleccionar: el dueño no puede
//      pedir lo que no ve.
//   3. NOMBRE Y FOTO. La fila tiene que verse como un contacto, no como un
//      número. El nombre sale de la misma cascada del inbox y la foto la
//      resuelve el componente Avatar contra el proxy, con el teléfono.
//
// GET ?clasificar=1 → además separa posibles clientes de personales (señales
// duras del CRM primero; la IA barata solo desempata).
// Guard: admin del workspace. Todo por getTenantDb: no sale del workspace.
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual, getTenantDb } from '@/lib/workspace';
import { claveTel } from '@/lib/evolution-mensajes';
import { getNombresContacto } from '@/lib/evolution-contactos';
import { telefonosOcultos } from '@/lib/evolution-block';
import { clasificarChats, type ClaseChat } from '@/lib/chat-agent-clasificador';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ult10 = (s: string | null) => (s || '').replace(/\D/g, '').slice(-10);

type Fila = {
  chat_jid: string; telefono: string | null; push_name: string | null;
  texto: string | null; from_me: boolean; wa_timestamp: string | null;
  tipo: string | null; lead_id: number | null;
};

type Conv = {
  clave: string;
  /** TODOS los jids de la charla: el análisis filtra por el conjunto. */
  jids: string[];
  nombre: string | null;
  telefono: string | null;
  mensajes: number;
  propios: number;
  ultimo: string | null;
  muestra: string | null;
  leadId: number | null;
  /** Sirve para aprender el estilo: hay ida y vuelta de verdad. */
  apta: boolean;
  clase: ClaseChat;
  razon: string;
  arranque: Array<{ mio: boolean; texto: string }>;
};

export async function GET(req: Request) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el administrador del workspace puede configurar esta sección.' }, { status: 403 });
  }
  const clasificar = new URL(req.url).searchParams.get('clasificar') === '1';

  try {
    const supabase = await getTenantDb();
    const { data } = await supabase
      .from('wa_mensajes')
      // Sin `raw`: el cupo de filas se gasta en conversaciones, no en payloads.
      .select('chat_jid, telefono, push_name, texto, from_me, wa_timestamp, tipo, lead_id')
      .not('chat_jid', 'is', null)
      // Las reacciones y el protocolo inflaban el contador y hacían pasar por
      // "conversación" a chats sin una sola frase. El inbox ya los excluye.
      .neq('tipo', 'evento')
      .order('wa_timestamp', { ascending: false })
      .limit(9000);

    const porChat = new Map<string, Conv>();
    for (const f of (data ?? []) as Fila[]) {
      if (f.chat_jid.endsWith('@g.us') || f.chat_jid.startsWith('status@') || f.chat_jid.includes('broadcast')) continue;
      const clave = claveTel(f.telefono, f.chat_jid);
      let c = porChat.get(clave);
      if (!c) {
        c = {
          clave, jids: [], nombre: null, telefono: f.telefono, mensajes: 0, propios: 0,
          ultimo: f.wa_timestamp, muestra: null, leadId: null, apta: false,
          clase: 'no_se', razon: '', arranque: [],
        };
        porChat.set(clave, c);
      }
      if (!c.jids.includes(f.chat_jid)) c.jids.push(f.chat_jid);
      c.mensajes += 1;
      if (f.from_me) c.propios += 1;
      if (!c.telefono && f.telefono) c.telefono = f.telefono;
      if (c.leadId == null && f.lead_id != null) c.leadId = f.lead_id;
      // El push_name de un SALIENTE es el nombre del propio dueño: no sirve.
      if (!c.nombre && !f.from_me && f.push_name && f.push_name !== 'Você') c.nombre = f.push_name;
      if (!c.muestra && f.texto) c.muestra = f.texto.slice(0, 90);
      // Los mensajes vienen de más nuevo a más viejo, así que el arranque se
      // arma por delante: al terminar queda en orden cronológico.
      if (f.texto) c.arranque.unshift({ mio: f.from_me, texto: f.texto });
    }

    let convs = [...porChat.values()];

    // Lo que el dueño ya ocultó desde la tab de WhatsApp no vuelve a aparecer.
    try {
      const ocultos = new Set([...(await telefonosOcultos())].map((t) => ult10(t)));
      if (ocultos.size) convs = convs.filter((c) => !ocultos.has(ult10(c.telefono) || c.clave));
    } catch { /* sin lista de ocultos, se muestran todas */ }

    // Nombre del contacto de WhatsApp (lo llena el importador y el webhook).
    try {
      const nombres = await getNombresContacto();
      // El teléfono puede venir nulo en la fila: se saca del jid, que siempre está.
      for (const c of convs) if (!c.nombre) c.nombre = nombres.get(ult10(c.telefono) || ult10(c.jids[0] ?? '')) ?? null;
    } catch { /* se queda el número */ }

    // Cruce con el CRM: da el nombre real y, sobre todo, la señal dura de que
    // ese teléfono ES un cliente — que vale más que cualquier clasificación.
    try {
      const { data: leads } = await supabase.from('leads').select('id, nombre, telefono_normalizado').limit(2000);
      const porTel = new Map<string, { id: number; nombre: string }>();
      for (const l of ((leads ?? []) as Array<{ id: number; nombre: string; telefono_normalizado: string | null }>)) {
        const k = ult10(l.telefono_normalizado);
        if (k) porTel.set(k, { id: l.id, nombre: l.nombre });
      }
      for (const c of convs) {
        const l = porTel.get(ult10(c.telefono) || '');
        if (!l) continue;
        if (c.leadId == null) c.leadId = l.id;
        if (!c.nombre) c.nombre = l.nombre;
      }
    } catch { /* sin cruce de CRM */ }

    for (const c of convs) {
      c.apta = c.propios >= 2 && c.mensajes >= 4;
      if (c.leadId != null) { c.clase = 'cliente'; c.razon = 'Está en tu CRM'; }
      c.arranque = c.arranque.slice(0, 6);
    }

    convs.sort((a, b) => (b.ultimo ?? '').localeCompare(a.ultimo ?? ''));

    // La IA solo desempata sobre los que no matchearon ningún lead, y solo si
    // el paso lo pidió. Sin proveedor de IA la lista sale igual, sin clasificar.
    if (clasificar) {
      const dudosos = convs.filter((c) => c.clase === 'no_se' && c.arranque.length >= 2).slice(0, 120);
      if (dudosos.length) {
        const clases = await clasificarChats(dudosos.map((c) => ({
          clave: c.clave, nombre: c.nombre || c.telefono || 'Sin nombre', arranque: c.arranque,
        })));
        for (const c of convs) {
          const r = clases.get(c.clave);
          if (r) { c.clase = r.clase; c.razon = r.razon; }
        }
      }
    }

    const conversaciones = convs.slice(0, 300).map((c) => ({
      clave: c.clave, jids: c.jids, nombre: c.nombre, telefono: c.telefono,
      mensajes: c.mensajes, propios: c.propios, ultimo: c.ultimo, muestra: c.muestra,
      apta: c.apta, clase: c.clase, razon: c.razon, esLead: c.leadId != null,
    }));

    return Response.json({ ok: true, conversaciones, clasificado: clasificar });
  } catch (e) {
    console.error(`[api:chat-agent/onboarding/conversaciones] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
