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
import { leerPorPaginas } from '@/lib/supabase-paginado';
import { claveTel } from '@/lib/evolution-mensajes';
import { getNombresContacto, getFotosContacto } from '@/lib/evolution-contactos';
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
  /** Nombre que el contacto se puso a sí mismo. Cede ante el de la agenda. */
  pushName: string | null;
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
  /** Hay foto de perfil guardada. Solo 1 de cada 6 contactos tiene. */
  foto: boolean;
  arranque: Array<{ mio: boolean; texto: string }>;
};

export async function GET(req: Request) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el administrador del workspace puede configurar esta sección.' }, { status: 403 });
  }
  const clasificar = new URL(req.url).searchParams.get('clasificar') === '1';

  try {
    // Con el número desvinculado NO se listan sus conversaciones. El espejo
    // sigue guardado —borrarlo al desconectar sería irreversible y un corte de
    // red no puede costar el historial—, pero mostrarlo después de desvincular
    // contradice lo que el dueño acaba de hacer.
    const { getInstanciaRow } = await import('@/lib/evolution');
    const inst = await getInstanciaRow().catch(() => null);
    if (inst?.estado !== 'conectado') {
      return Response.json({
        ok: true, conversaciones: [], clasificado: false, pedidos: 0,
        desvinculado: true,
        guardadas: inst ? true : false,
      });
    }

    const supabase = await getTenantDb();
    // PAGINADO, y no es un detalle: `.limit(9000)` NO sube el techo del servidor
    // — PostgREST devuelve como mucho 1000 filas por request y el resto se pierde
    // sin error. El espejo tenía 106 conversaciones y la lista mostraba 36 por
    // esto: se leía la primera página y nada más.
    //
    // El desempate por `id` tampoco es cosmético: `wa_timestamp` se REPITE (las
    // ráfagas comparten segundo y un volcado del importador comparte varios), y
    // con empates el reparto entre páginas no está garantizado → filas repetidas
    // y filas salteadas, otra vez sin error. Mismo bug que ya se cerró en
    // lib/evolution-mensajes.
    const filas: Fila[] = [];
    await leerPorPaginas<Fila>(
      supabase, 'wa_mensajes',
      // Sin `raw`: el cupo de filas se gasta en conversaciones, no en payloads.
      'chat_jid, telefono, push_name, texto, from_me, wa_timestamp, tipo, lead_id',
      // Tope explícito de 20 páginas (los 20.000 mensajes MÁS RECIENTES, por el
      // orden descendente), el mismo que tenía el bucle a mano.
      (pagina, nro) => { filas.push(...pagina); return nro < 20; },
      {
        orden: [{ col: 'wa_timestamp', asc: false }, { col: 'id', asc: false }],
        // Las reacciones y el protocolo inflaban el contador y hacían pasar por
        // "conversación" a chats sin una sola frase. El inbox ya los excluye.
        filtros: (q) => q.not('chat_jid', 'is', null).neq('tipo', 'evento'),
      },
    );

    const porChat = new Map<string, Conv>();
    for (const f of filas) {
      // @newsletter son los CANALES de WhatsApp: difusión de una vía a la que
      // el dueño está suscripto, no conversaciones suyas. Entraban a la lista
      // como contactos con un mensaje suelto.
      if (f.chat_jid.endsWith('@g.us') || f.chat_jid.endsWith('@newsletter') || f.chat_jid.startsWith('status@') || f.chat_jid.includes('broadcast')) continue;
      const clave = claveTel(f.telefono, f.chat_jid);
      let c = porChat.get(clave);
      if (!c) {
        c = {
          clave, jids: [], nombre: null, pushName: null, telefono: f.telefono, mensajes: 0, propios: 0,
          ultimo: f.wa_timestamp, muestra: null, leadId: null, apta: false,
          clase: 'no_se', razon: '', foto: false, arranque: [],
        };
        porChat.set(clave, c);
      }
      if (!c.jids.includes(f.chat_jid)) c.jids.push(f.chat_jid);
      c.mensajes += 1;
      if (f.from_me) c.propios += 1;
      if (!c.telefono && f.telefono) c.telefono = f.telefono;
      if (c.leadId == null && f.lead_id != null) c.leadId = f.lead_id;
      // El push_name de un SALIENTE es el nombre del propio dueño: no sirve. Y
      // el de un ENTRANTE muchas veces ES EL NÚMERO (WhatsApp lo rellena así
      // cuando el contacto no se puso nombre): eso no es un nombre, y dejarlo
      // ganar tapaba el de la agenda, que es el que el dueño reconoce.
      if (!c.pushName && !f.from_me && f.push_name && f.push_name !== 'Você' && !/^[\d\s+()-]+$/.test(f.push_name)) {
        c.pushName = f.push_name;
      }
      if (!c.muestra && f.texto) c.muestra = f.texto.slice(0, 90);
      // Los mensajes vienen de más nuevo a más viejo, así que el arranque se
      // arma por delante: al terminar queda en orden cronológico.
      if (f.texto) c.arranque.unshift({ mio: f.from_me, texto: f.texto });
    }

    // Un chat con UN solo mensaje no es una conversación: no tiene ida y vuelta,
    // no enseña nada del estilo y no hay con qué clasificarlo. Son la mayoría de
    // lo que trae el espejo (91 de 124 en el número de prueba) y son justo el
    // ruido que hace que la lista se lea como basura. Fuera.
    let convs = [...porChat.values()].filter((c) => c.mensajes >= 2);

    // Lo que el dueño ya ocultó desde la tab de WhatsApp no vuelve a aparecer.
    try {
      const ocultos = new Set([...(await telefonosOcultos())].map((t) => ult10(t)));
      if (ocultos.size) convs = convs.filter((c) => !ocultos.has(ult10(c.telefono) || c.clave));
    } catch { /* sin lista de ocultos, se muestran todas */ }

    // Nombre del contacto de WhatsApp (lo llena el importador y el webhook).
    try {
      const nombres = await getNombresContacto();
      // ORDEN: primero la agenda (el nombre que el DUEÑO le puso, el que
      // reconoce), después el que el contacto se puso a sí mismo. El teléfono
      // puede venir nulo en la fila: se saca del jid, que siempre está.
      for (const c of convs) {
        c.nombre = nombres.get(ult10(c.telefono) || ult10(c.jids[0] ?? '')) ?? c.pushName ?? null;
      }
    } catch { /* se queda el número */ }

    // Foto: se marca cuáles TIENEN, para que el avatar no pida al vacío las que
    // no existen (Evolution solo guarda foto de 1 de cada 6 contactos).
    try {
      const fotos = await getFotosContacto();
      for (const c of convs) c.foto = fotos.has(ult10(c.telefono) || ult10(c.jids[0] ?? ''));
    } catch { /* sin fotos, todas con iniciales */ }

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
    let pedidos = 0;
    if (clasificar) {
      // Con UN solo mensaje ("Hola, buenas tardes") no hay contexto para
      // distinguir cliente de personal — sonaba "profesional" y el modelo lo
      // marcaba 'cliente' de puro corto. Se pide ida y vuelta real (2+).
      const dudosos = convs.filter((c) => c.clase === 'no_se' && c.arranque.length >= 2).slice(0, 150);
      pedidos = dudosos.length;
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
      apta: c.apta, clase: c.clase, razon: c.razon, esLead: c.leadId != null, foto: c.foto,
    }));

    return Response.json({ ok: true, conversaciones, clasificado: clasificar, pedidos });
  } catch (e) {
    console.error(`[api:chat-agent/onboarding/conversaciones] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
