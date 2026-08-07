// =============================================================================
// API: contexto del onboarding del Chat Agent — leer CÓMO VENDE el negocio
// =============================================================================
// Principio de baja fricción: no se le pide al dueño que redacte cómo habla con
// sus clientes; se lee de sus PROPIAS conversaciones. Pero leer todo lo que
// eligió NO alcanzaba: un cliente actual habla de soporte y entrega, y de ahí
// salían conclusiones de venta falsas que se guardaban como la voz del negocio.
//
// Ahora el trabajo pesado vive en lib/chat-agent-voz.ts (segmentar la etapa de
// venta → analizar solo eso → VERIFICAR las citas contra el material). Esta ruta
// junta el material, lo manda y guarda el resultado.
//
// POST {}                          → analiza y devuelve evidencia + preguntas
// POST { action:'responder', … }   → guarda lo que el dueño contestó
// Guard: admin del workspace. Nada sale del workspace: getTenantDb scopea.
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual, getTenantDb } from '@/lib/workspace';
import { leerPorPaginas } from '@/lib/supabase-paginado';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { setVozGuia } from '@/lib/nutricion-generator';
import {
  analizarVoz, componerVozGuia, huecosDeVoz, generarPreguntasVoz, textoConocido,
  getEvidencia, setEvidencia, getManual, setManual,
  BLOQUES, type ConvParaVoz, type VozEvidencia,
} from '@/lib/chat-agent-voz';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Fila = { chat_jid: string; texto: string | null; from_me: boolean; wa_timestamp: string | null };

/** Lo que la UI necesita para pintar el resultado y las preguntas. */
async function armarRespuesta(ev: VozEvidencia | null, manual: Record<string, string>, perfil: string) {
  const huecos = huecosDeVoz(ev, manual);
  const preguntas = huecos.length ? await generarPreguntasVoz(huecos, textoConocido(ev, perfil)) : [];
  return {
    ok: true,
    evidencia: ev,
    // Los bloques deducidos, ya listos para pintar (título + texto + citas).
    deducido: BLOQUES
      .map((b) => ({ key: b.key, titulo: b.titulo, ...(ev?.bloques?.[b.key] ?? { estado: 'hueco', texto: '', citas: [] }) }))
      .filter((b) => b.estado === 'deducido' || (manual[b.key] ?? '').trim()),
    huecos, preguntas,
    resumen: componerVozGuia(ev, manual),
  };
}

export async function POST(req: Request) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el administrador del workspace puede configurar esta sección.' }, { status: 403 });
  }

  let body: { chats?: unknown; conversaciones?: unknown; action?: unknown; respuestas?: unknown } = {};
  try { body = (await req.json()) as typeof body; } catch { /* body vacío = analizar */ }

  try {
    // ── Guardar lo que el dueño contestó para cerrar un hueco ──
    if (body.action === 'responder') {
      const entrada = (body.respuestas && typeof body.respuestas === 'object' ? body.respuestas : {}) as Record<string, unknown>;
      const validas = new Set(BLOQUES.map((b) => b.key as string));
      const manual = await getManual();
      for (const [k, v] of Object.entries(entrada)) {
        if (!validas.has(k)) continue;
        const val = String(v ?? '').trim().slice(0, 600);
        if (val) manual[k] = val; else delete manual[k];
      }
      await setManual(manual);

      const ev = await getEvidencia();
      const perfil = await perfilNegocioTexto().catch(() => '');
      const compuesto = componerVozGuia(ev, manual);
      // NUNCA escribir una guía vacía: `setVozGuia('')` borraría la que ya
      // existiera (la que destila el generador desde otras fuentes) y dejaría sin
      // voz a los cinco lugares que escriben en nombre del negocio.
      if (compuesto.trim()) await setVozGuia(compuesto);
      return Response.json(await armarRespuesta(ev, manual, perfil));
    }

    // ── Analizar ──
    // Se aceptan las dos formas: la nueva agrupa los jids POR CONVERSACIÓN, que
    // es lo que permite cortar la etapa de venta de cada charla por separado. La
    // vieja mandaba todos los jids aplanados, y así el server no podía saber
    // cuáles eran la misma charla. Se conserva por si quedó una pestaña abierta.
    let convs: Array<{ clave: string; nombre: string; jids: string[] }> = [];
    if (Array.isArray(body.conversaciones)) {
      convs = (body.conversaciones as Array<Record<string, unknown>>)
        .map((c) => ({
          clave: String(c.clave ?? ''),
          nombre: String(c.nombre ?? '').trim() || 'Sin nombre',
          jids: Array.isArray(c.jids) ? c.jids.map((j) => String(j)).filter(Boolean) : [],
        }))
        .filter((c) => c.clave && c.jids.length);
    } else if (Array.isArray(body.chats)) {
      convs = (body.chats as unknown[])
        .filter((c): c is string => typeof c === 'string' && !!c)
        .map((jid) => ({ clave: jid, nombre: jid.replace(/@.*/, ''), jids: [jid] }));
    }
    convs = convs.slice(0, 40);
    if (!convs.length) {
      return Response.json({ ok: false, error: 'Elige al menos una conversación para analizar.' }, { status: 400 });
    }

    const supabase = await getTenantDb();
    const todosLosJids = [...new Set(convs.flatMap((c) => c.jids))];

    // UNA query para todas las conversaciones (no una por chat): 40 round-trips
    // secuenciales se comían el presupuesto de la función. Se pagina porque
    // PostgREST corta en 1000 filas sin avisar (lib/supabase-paginado).
    //
    // El desempate por `id` NO es cosmético: `wa_timestamp` se REPITE (una ráfaga
    // de mensajes comparte segundo, y un volcado del importador comparte varios),
    // y con empates Postgres puede repartir las filas empatadas distinto en cada
    // request → la página 2 repite unas y saltea otras, sin error. Es el mismo
    // bug que ya se arregló en lib/evolution-mensajes.
    const filas: Fila[] = [];
    await leerPorPaginas<Fila>(
      supabase, 'wa_mensajes', 'chat_jid, texto, from_me, wa_timestamp',
      // Tope explícito de 8 páginas (8000 mensajes), el mismo que tenía el bucle
      // a mano: es material para un prompt, no un export.
      (pagina, nro) => { filas.push(...pagina); return nro < 8; },
      {
        orden: [{ col: 'wa_timestamp' }, { col: 'id' }],
        filtros: (q) => q.in('chat_jid', todosLosJids).not('texto', 'is', null).neq('tipo', 'evento'),
      },
    );

    const porJid = new Map<string, string>(); // jid → clave de conversación
    for (const c of convs) for (const j of c.jids) porJid.set(j, c.clave);
    const mensajesPorClave = new Map<string, Array<{ mio: boolean; texto: string }>>();
    for (const f of filas) {
      const clave = porJid.get(f.chat_jid);
      const t = (f.texto ?? '').trim();
      if (!clave || t.length < 2) continue;
      const arr = mensajesPorClave.get(clave) ?? [];
      // Cronológico y acotado: el arranque es donde vive la venta, y el techo
      // evita que una charla de 2.000 mensajes se coma el material entero.
      if (arr.length < 60) arr.push({ mio: f.from_me, texto: t });
      mensajesPorClave.set(clave, arr);
    }

    const paraVoz: ConvParaVoz[] = convs
      .map((c) => ({ clave: c.clave, nombre: c.nombre, mensajes: mensajesPorClave.get(c.clave) ?? [] }))
      .filter((c) => c.mensajes.length >= 2);

    const perfil = await perfilNegocioTexto().catch(() => '');
    const ev = await analizarVoz(paraVoz, perfil);
    await setEvidencia(ev);

    // La guía se compone con lo deducido MÁS lo que ya estuviera respondido a
    // mano de una pasada anterior: reanalizar no puede tirar a la basura lo que
    // el dueño ya se tomó el trabajo de contestar.
    const manual = await getManual();
    const compuesto = componerVozGuia(ev, manual);
    if (compuesto.trim()) await setVozGuia(compuesto);

    return Response.json(await armarRespuesta(ev, manual, perfil));
  } catch (e) {
    console.error(`[api:chat-agent/onboarding/contexto] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
