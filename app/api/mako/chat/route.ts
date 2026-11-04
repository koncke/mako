// =============================================================================
// /api/mako/chat — el chat con MaKo del Second Brain (la pieza única, en la computadora)
// =============================================================================
// GET  ?sesiones=1                                   → { ok, sesiones }             las de ESTA persona
// GET  ?trabajo=<llave>                              → { ok, texto, bloques }       cómo va un trabajo largo (1.11)
// GET  ?sessionId=N                                  → { ok, sesion, mensajes, propuestas }
// GET  ?antes=1                                      → { ok, antes }    los chats de «Pregúntale a MaKo»
// GET  ?antesId=N                                    → { ok, sesion, mensajes }
// GET  ?sessionId=N&antes=1                          → como ?sessionId, de un chat de antes (con sus tarjetas): se SIGUE
//                                                      (21/10/2026). `antes` también en el POST de 'send', 'confirmar',
//                                                      'cancelar' y en el multipart: el turno corre sobre ESA sesión.
// GET  ?adjunto=<id del mensaje>:<n>                 → 302 al archivo (link firmado, 300 s)
// GET  ?voz=<id del mensaje>                         → 302 a la nota de voz de la persona (OC7, link firmado, 300 s)
// GET  ?offer=1                                      → { ok, offer }    las conversaciones de Offer del negocio (20/10/2026)
// GET  ?offerId=N                                    → { ok, sesion, mensajes }      una, de sólo lectura; de otro ws, 404
// GET  ?marcas=<chat>                                → { ok, marcas }   las de la persona en ESE chat (21/10/2026: el menú
//                                                      del clic derecho, como el del super admin; lib/chat-mako-marcas-db.ts)
// GET  ?suIA=1                                       → { ok, conectada }  ¿la persona ya tiene SU Claude o GPT? Sin, la caja
//                                                      ofrece «Conectar tu Claude» (21/10/2026)
// POST { action:'marcar', chat, cambio }             → { ok, marcas }
// POST { action:'new' }                              → { ok, sesion }               sin saludo del modelo
// POST { action:'send', sessionId, mensaje }         → RespuestaTurno
// POST multipart: mensaje, sessionId, adjuntos[]     → RespuestaTurno               (fotos y PDF, como el teléfono)
// POST multipart: sessionId, voz (MP3), vozSecs      → RespuestaTurno               la nota de voz, SOLA (OC7, 22/10/2026):
//                                                      la escucha la IA del negocio ANTES de guardar nada; sin voz, 422;
//                                                      ninguna IA pudo, 424 (se reintenta con la misma grabación)
// POST { action:'confirmar'|'cancelar', sessionId, pendienteId } → ResultadoTarjeta
//
// El turno es el MISMO del teléfono (lib/mako-turno-app.ts, las mismas sesiones `mako-movil:u<id>`): esto sólo
// traduce HTTP y le dice al turno que está en la computadora (`CONTEXTO_SECOND_BRAIN`). Etapa 2 de
// docs/diseno-mako-ai-native.md.
//
// ⚠️ NO VA EN app/api/second-brain/: esa carpeta es sólo del admin por test (tests/puerta-admin-tab.test.ts), y este
// chat es de todos los que tienen MaKo (closer y setter incluidos), con la puerta de MaKo: `personaDelRequest`.
// ⚠️ CONFIRMAR VA POR ACÁ Y NO POR UNA SERVER ACTION, como el CRM (app/crm/mako-crm/chat-server.ts): la action toma el
// techo de la página, y confirmar replicar_landing corre ~275 s.
// ⚠️ maxDuration 420 y el `fetch` de la pantalla con `AbortSignal.timeout(425_000)` (tests/mako-doer-plazo.test.ts).
// ⚠️ UN ADJUNTO SE PIDE POR SU MENSAJE, NUNCA POR SU PATH (tanda 4, 16/10/2026): `urlDeAdjunto` mira de quién es la
//    conversación antes de firmar (lib/mako-turno-app.ts). El path no sale nunca a la pantalla.
// =============================================================================

import type { NextRequest } from 'next/server';
import { TEXTO_SIN_PERMISO_IA, esSinPermisoIa } from '@/lib/ia-permiso-reglas';
import {
  personaDelRequest, listarSesiones, abrirSesion, nuevaSesion, sesionDeTab, turnoApp, confirmarDesdeTarjeta, cancelarDesdeTarjeta, urlDeAdjunto,
  urlDeVozDelChat, escucharNotaDelChat,
} from '@/lib/mako-turno-app';
import { validarAdjuntos, esMp3, ERROR_ADJUNTO, TOPE_ADJUNTOS, TOPE_TOTAL_BYTES, MARGEN_MULTIPART_BYTES } from '@/lib/mako-adjuntos';
import { CONTEXTO_SECOND_BRAIN, ORIGEN_FUNNEL_COACH, appDeEscritorio, referenteDeTab, type AppDeEscritorio } from '@/lib/chat-mako-reglas';
import { contextoDeReferente, contextoDelFunnelCoach, pistaDelFunnelCoach } from '@/lib/asesores/contexto';
import { asesorPorId, sanearReferentes } from '@/lib/asesores/catalogo';
// Ya viene con el turno (lib/mako-turno-app.ts lo importa): estático, así la guarda de las rutas sin IA lo ve (tests/d6b-rutas.test.ts).
import { cursoDe } from '@/lib/cerebro-para-chat';
import { guardarReferentes, leerPlanFunnel, leerReferentes } from '@/lib/funnel-plan-db';
import { listarOfertas } from '@/lib/ofertas';
import { tipoDeDispositivo } from '@/lib/movil-dispositivo';
import { sanearDesde, type Desde } from '@/lib/chat-desde';
import { estadoDeTrabajo } from '@/lib/chat-trabajos';
import { runWithWorkspace, wsSuperAdmin } from '@/lib/workspace';
import { chatsDeAntes, chatsDeAutomations, chatsDeLasTabs, chatsDeLosEditores, chatsDeOffer, claveDeAntes, conTemas, gurusConCharla, hiloDeAutomatizacion, hiloDeEditor, claveDeTab, hiloDeAntes, hiloDeOffer, quienChateaDelRequest } from '@/lib/chat-mako-indice';
import type { PersonaChat } from '@/lib/mako-turno-app';
import { esChatDeMarcas, leerMarcasDelChat, marcarEnElChat } from '@/lib/chat-mako-marcas-db';
import { sanearCambio } from '@/lib/centro-mensajes';
import { negocioConSuIA } from '@/lib/ia-del-negocio';
import { claveDelCreditoAsignado } from '@/lib/credito-negocio';
import { pcDe } from '@/lib/ia-pc';
import { cuentasDeIA, eleccionDelPedido } from '@/lib/chat-ia';

export const dynamic = 'force-dynamic';
export const maxDuration = 420;

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status });

const enteroDe = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * La persona con la que corre el turno sobre un chat de ANTES (21/10/2026: se sigue en el Ops Center): la misma, con la clave
 * de ESA sesión si la regla de antes la deja (lib/chat-mako-indice.ts → claveDeAntes). Sin `antes`, la persona tal cual. null
 * = no es suyo (404, como cualquier chat que no existe).
 */
/**
 * ¿La persona ya tiene SU IA? (21/10/2026, Martín: «Si el usuario aún no conectó su Claude o GPT, debería aparecer en la barra
 * de chat... el botón de conectar»). La misma cuenta que hace el turno (lib/mako-turno-app.ts → `sinIAEs`): con la clave de
 * Claude u OpenAI del NEGOCIO, sí; en un negocio que corre con computadoras, sólo si ESTA persona conectó la suya; en el
 * workspace de la plataforma, sí (contesta la de la plataforma). Si no se pudo saber, sí: un bache de la base no le pide que
 * conecte algo que ya está.
 */
async function laApp(persona: PersonaChat, req: NextRequest): Promise<AppDeEscritorio> {
  // La app de escritorio (23/10/2026, lib/chat-mako-reglas.ts → appDeEscritorio, «Bloqueá igual»). El teléfono sale del pedido,
  // con la misma pregunta del proxy (`tipoDeDispositivo`): ahí no se instala, así que no se bloquea. Si no se pudo saber, `tiene`:
  // un bache de la base no le tapa el chat a nadie. El negocio de la plataforma también (25/10/2026: «ni en la mia... No debería»).
  try {
    const conComputadora = (await pcDe(persona.ws, persona.actor)) != null;
    const telefono = tipoDeDispositivo(req.headers.get('user-agent'), req.headers.get('sec-ch-ua-mobile')) !== 'escritorio';
    return appDeEscritorio({ conComputadora, telefono });
  } catch {
    return 'tiene';
  }
}

async function conSuIA(persona: PersonaChat): Promise<boolean> {
  try {
    if (persona.ws === (await wsSuperAdmin())) return true;
    // Con el crédito de Claude que le asignó Martín, prendido (lib/credito-negocio.ts; 22/10/2026, el ws1): tiene con qué.
    if (await claveDelCreditoAsignado(persona.ws)) return true;
    const negocio = await negocioConSuIA(persona.ws);
    if (negocio.suIA && !negocio.conPc) return true;
    return (await pcDe(persona.ws, persona.actor)) != null;
  } catch {
    return true;
  }
}

async function personaDelChat(persona: PersonaChat, sessionId: number, antes: unknown): Promise<PersonaChat | null> {
  if (antes !== true && antes !== '1' && antes !== 1) return persona;
  const q = await quienChateaDelRequest();
  // Un chat de antes (su regla de siempre) o uno de una tab de ESTA persona (CRM, la ficha de un lead: OC4, 22/10/2026).
  const chartKey = (q ? await claveDeAntes(q, sessionId) : null) ?? await claveDeTab(persona, sessionId);
  return chartKey ? { ...persona, chartKey } : null;
}

/**
 * Con qué contexto corre el turno. El Funnel Coach (1/11/2026) es el mismo turno, con SU contexto y buscando sus herramientas aunque la
 * persona escriba sólo un número. ⚠️ UNA PIEZA PARA LOS DOS CAMINOS DE ESTA RUTA (JSON y con archivos): escrito en cada uno, un PDF
 * adjunto al Funnel Coach lo dejaba hablando como el Ops Center.
 */
async function contextoDelChat(quien: PersonaChat, desde: Desde | null, mensaje: string): Promise<{ contexto: string; pista?: string; referente?: string | null }> {
  // El chat con un GURÚ (3/11/2026, #16): su ficha en cada mensaje y su curso en el Second Brain del turno. Lo dice la CLAVE de la
  // conversación (`…:referente-<id>`, lib/chat-mako-reglas.ts), no la pantalla: retomada desde la lista, sigue siendo con él.
  const guru = referenteDeTab(quien.chartKey);
  if (guru) return { contexto: `${CONTEXTO_SECOND_BRAIN}\n\n${contextoDeReferente(guru)}`, referente: guru };
  if (desde?.tab !== ORIGEN_FUNNEL_COACH) return { contexto: CONTEXTO_SECOND_BRAIN };
  const { funnel } = await runWithWorkspace(quien.ws, () => leerReferentes());
  // ⚠️ `referente` ES OTRA COSA QUE `contexto`, y por eso viaja aparte (2/11/2026). El contexto
  // lleva la FICHA —cómo piensa, 5.200 caracteres, en CADA mensaje—; `referente` sólo dice QUIÉN
  // es, para que el Second Brain pueda colgar su curso entero como capa y traer la clase que la
  // pregunta pida (lib/cerebro-para-chat.ts). Martín: «que el segundo cerebro de estos gurús tenga
  // todo el contexto».
  return { contexto: contextoDelFunnelCoach(funnel), pista: pistaDelFunnelCoach(mensaje), referente: funnel };
}

export async function GET(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return json({ ok: false, error: persona.error }, persona.status);
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get('sesiones')) return json({ ok: true, sesiones: await listarSesiones(persona) });
    // La conversación de una tab con chat propio (el Second Brain, 23/10/2026), si ya existe: se lee, no se crea.
    if (sp.has('deTab')) return json({ ok: true, sesion: await sesionDeTab(persona, sp.get('deTab') ?? '', false) });
    // Los coaches del Ops Center (1/11/2026, lib/asesores/): quién tiene cada uno al frente, si hay oferta y el plan guardado.
    // El Second Brain de UN gurú, para dibujarlo (#18, 3/11/2026): su curso como grafo, acomodado aquí. SIN el texto de las clases:
    // el de Alborna son 742 mil caracteres y el grafo dibuja títulos. El texto lo lee el chat (lib/cerebro-para-chat.ts → `cursoDe`).
    if (sp.has('cerebroDe')) {
      const id = asesorPorId(sp.get('cerebroDe'))?.id;
      const c = id ? await cursoDe(id) : null;
      if (!c) return json({ ok: false, error: 'Este gurú todavía no tiene su curso cargado.' }, 404);
      // Con la forma del grafo del negocio (4/11/2026): sus módulos como secciones, con color y tamaño (lib/cerebro-referente-vista.ts).
      // Sin el texto de las clases: sólo el principio de cada una.
      const [{ layoutCerebro }, { vistaDeReferente }] = await Promise.all([import('@/lib/cerebro-layout'), import('@/lib/cerebro-referente-vista')]);
      const vista = vistaDeReferente(c.a, c.capa);
      const { posiciones, encuadre } = layoutCerebro(vista.nodos, vista.aristas);
      return json({ ok: true, cerebro: { ...vista, posiciones, encuadre } });
    }
    if (sp.has('gurusConCharla')) return json({ ok: true, gurus: await gurusConCharla(persona) });
    if (sp.has('coaches')) {
      const [referentes, ofertas] = await runWithWorkspace(persona.ws, () => Promise.all([leerReferentes(), listarOfertas(true).catch(() => null)]));
      // Si la base no contestó no se sabe, y no se le dice a nadie que le falta una oferta que puede tener.
      return json({ ok: true, referentes, hayOferta: ofertas == null || ofertas.length > 0, puedeElegir: persona.rol === 'admin' });
    }
    if (sp.has('planFunnel')) return json({ ok: true, plan: await runWithWorkspace(persona.ws, () => leerPlanFunnel()) });
    // Y las cuentas que el «+» de la caja deja elegir para ESTE chat (8b, lib/chat-ia.ts): sin ellas, el selector no se dibuja.
    // Sólo la app de escritorio (25/10/2026): la pregunta de los chats con caja propia (app/_chat/useAppDeEscritorio.tsx), sin
    // las cuentas ni la IA conectada, que esos chats no dibujan.
    if (sp.get('app')) return json({ ok: true, app: await laApp(persona, req) });
    if (sp.get('suIA')) {
      const [conectada, cuentas, app] = await Promise.all([conSuIA(persona), cuentasDeIA(persona).catch(() => []), laApp(persona, req)]);
      return json({ ok: true, conectada, cuentas, app });
    }
    if (sp.has('marcas')) {
      const chat = sp.get('marcas');
      if (!esChatDeMarcas(chat)) return json({ ok: false, error: 'Falta el chat.' }, 400);
      return json({ ok: true, marcas: await leerMarcasDelChat(persona, chat) });
    }
    // Lo guardado de un chat que la persona SIGUE con `antes` (uno de antes o el de una tab) se abre con la regla que deja
    // seguirlo, la misma de `?sessionId=N&antes=1` (22/10/2026: la foto, el PDF y la nota de esos chats daban 404).
    const deOtroChat = (sesion: number) => personaDelChat(persona, sesion, '1');
    if (sp.has('adjunto')) {
      const url = await urlDeAdjunto(persona, sp.get('adjunto'), deOtroChat);
      // Se abre en otra pestaña o en un <img>: texto, no JSON.
      if (!url) return new Response('No pude abrir el archivo.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
      // El link vence a los 300 s: el navegador puede reusar este salto un rato menos que eso.
      return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, max-age=240' } });
    }
    // La nota de voz de la persona (OC7): un <audio src>, también por su mensaje.
    if (sp.has('voz')) {
      const url = await urlDeVozDelChat(persona, sp.get('voz'), deOtroChat);
      if (!url) return new Response('No pude abrir la nota de voz.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
      return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, max-age=240' } });
    }
    // «Antes»: lo que tenía /mako, con SU regla de quién ve qué (lib/chat-mako-indice.ts).
    // ⚠️ CON `sessionId` NO ES LA LISTA: `?sessionId=N&antes=1` es el hilo de un chat de antes que se sigue (abajo, con
    //    `personaDelChat`). Hasta el 22/10/2026 esta rama lo atrapaba primero y devolvía la lista: todo chat de antes (los
    //    del CRM, los gráficos, Editar con MaKo, el Web Generator) se abría VACÍO en el Ops Center del cliente, aunque la
    //    fila estaba y sus mensajes también (medido en el ws3). tests/ops-center-hilo-de-antes.test.ts.
    if ((sp.get('antes') && !sp.has('sessionId')) || sp.has('antesId')) {
      const q = await quienChateaDelRequest();
      if (!q) return json({ ok: false, error: 'Tu sesión venció.' }, 401);
      // Con los de las tabs de la persona (el CRM, la ficha de un lead), que se siguen igual (OC4, 22/10/2026).
      if (sp.get('antes')) {
        const [deAntes, deTabs] = await Promise.all([chatsDeAntes(q), chatsDeLasTabs(persona)]);
        // Con su tema: lo que no tiene título se nombra por lo que se dijo (22/10/2026, nunca «Chat de antes»).
        const todos = await conTemas([...deAntes, ...deTabs]);
        return json({ ok: true, antes: todos.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)) });
      }
      const id = enteroDe(sp.get('antesId'));
      const hilo = id == null ? null : await hiloDeAntes(q, id);
      if (!hilo) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
      return json({ ok: true, ...hilo });
    }
    // Automations (22/10/2026, OC5): las charlas del lienzo, una proyección del workspace con la puerta de la tab. Se LEEN; se
    // siguen en el lienzo. Sin la tab, [].
    if (sp.get('automations')) return json({ ok: true, automations: await chatsDeAutomations() });
    if (sp.has('automatizacionId')) {
      const id = enteroDe(sp.get('automatizacionId'));
      const hilo = id == null ? null : await hiloDeAutomatizacion(id);
      if (!hilo) return json({ ok: false, error: 'No encuentro esa charla.' }, 404);
      return json({ ok: true, ...hilo });
    }
    // Los chats del Image Editor y del Video Editor (22/10/2026, OC8): por persona (el admin, los del negocio), con la puerta de
    // cada tab. Se LEEN; se siguen en el editor.
    if (sp.get('editores')) {
      const q = await quienChateaDelRequest();
      return json({ ok: true, editores: q ? await chatsDeLosEditores(q) : [] });
    }
    if (sp.has('editorClave')) {
      const q = await quienChateaDelRequest();
      const tipo = sp.get('editor') === 'video' ? 'video' : sp.get('editor') === 'imagen' ? 'imagen' : null;
      const hilo = q && tipo ? await hiloDeEditor(q, tipo, String(sp.get('editorClave'))) : null;
      if (!hilo) return json({ ok: false, error: 'No encuentro esa charla.' }, 404);
      return json({ ok: true, ...hilo });
    }
    // Offer (20/10/2026): una proyección del workspace, con la puerta de la tab (lib/chat-mako-indice.ts). Sin la tab, [].
    if (sp.get('offer')) return json({ ok: true, offer: await chatsDeOffer() });
    if (sp.has('offerId')) {
      const id = enteroDe(sp.get('offerId'));
      const hilo = id == null ? null : await hiloDeOffer(id);
      if (!hilo) return json({ ok: false, error: 'No encuentro esa conversación.' }, 404);
      return json({ ok: true, ...hilo });
    }
    // Un trabajo largo (1.11): cómo va, con la llave de su G6. Se busca en el negocio de quien pregunta.
    if (sp.has('trabajo')) {
      const t = await runWithWorkspace(persona.ws, () => estadoDeTrabajo(sp.get('trabajo')));
      if (!t) return json({ ok: false, error: 'No encuentro ese trabajo.' }, 404);
      return json({ ok: true, ...t });
    }
    if (sp.has('sessionId')) {
      const id = enteroDe(sp.get('sessionId'));
      const quien = id == null ? null : await personaDelChat(persona, id, sp.get('antes'));
      const abierta = id == null || !quien ? null : await abrirSesion(quien, id);
      if (!abierta) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
      return json({ ok: true, ...abierta });
    }
    return json({ ok: false, error: 'Falta qué pedir.' }, 400);
  } catch (e) {
    console.error('[api/mako/chat] GET', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'No pude cargar el chat.' }, 500);
  }
}

export async function POST(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return json({ ok: false, error: persona.error }, persona.status);
  // Con archivos: lo mismo que /api/m/mako (el teléfono), con la voz de la computadora.
  if ((req.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) {
    try {
      // El largo se mira ANTES de parsear: después del formData() el cuerpo ya está en memoria.
      const largo = Number(req.headers.get('content-length') ?? 0);
      if (largo > TOPE_TOTAL_BYTES + MARGEN_MULTIPART_BYTES) return json({ ok: false, error: ERROR_ADJUNTO.pesado }, 413);
      const form = await req.formData();
      const archivos = form.getAll('adjuntos').filter((f): f is File => f instanceof File);
      if (archivos.length > TOPE_ADJUNTOS) return json({ ok: false, error: ERROR_ADJUNTO.muchos }, 400);
      // La nota de voz (OC7): SOLA, en MP3, y dentro del mismo tope.
      const vozCruda = form.get('voz');
      const notaDeVoz = vozCruda instanceof File ? vozCruda : null;
      if (notaDeVoz && archivos.length) return json({ ok: false, error: 'La nota de voz va sola: manda los archivos en otro mensaje.' }, 400);
      if (notaDeVoz && notaDeVoz.size > TOPE_TOTAL_BYTES) return json({ ok: false, error: 'La nota de voz es muy larga: grábala más corta o escríbemelo.' }, 413);
      if (archivos.reduce((n, f) => n + f.size, 0) > TOPE_TOTAL_BYTES) return json({ ok: false, error: ERROR_ADJUNTO.pesado }, 413);
      const leidos = await Promise.all(archivos.map(async (f) => ({ nombre: f.name, mime: f.type, bytes: new Uint8Array(await f.arrayBuffer()) })));
      const v = validarAdjuntos(leidos);
      if (!v.ok) return json({ ok: false, error: v.error }, 400);
      const sessionId = enteroDe(form.get('sessionId'));
      if (sessionId == null) return json({ ok: false, error: 'Falta el chat.' }, 400);
      const bytesDeVoz = notaDeVoz ? new Uint8Array(await notaDeVoz.arrayBuffer()) : null;
      if (bytesDeVoz && !esMp3(bytesDeVoz)) return json({ ok: false, error: 'No pude abrir esa nota de voz: grábala de nuevo.' }, 415);
      const escrito = String(form.get('mensaje') ?? '');
      if (!escrito.trim() && !v.adjuntos.length && !bytesDeVoz) return json({ ok: false, error: 'Escribe algo.' }, 400);
      const quien = await personaDelChat(persona, sessionId, form.get('antes'));
      if (!quien) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
      // La nota se escucha ANTES del turno: lo que se entendió es el mensaje, y si nadie la pudo escuchar no se guarda nada.
      let mensaje = escrito;
      if (bytesDeVoz) {
        const oido = await escucharNotaDelChat(quien, sessionId, bytesDeVoz);
        if (!oido.ok) return json({ ok: false, error: oido.error }, oido.status);
        mensaje = [escrito.trim(), oido.texto].filter(Boolean).join('\n\n');
      }
      const voz = bytesDeVoz ? { bytes: bytesDeVoz, secs: Number(form.get('vozSecs')) } : null;
      // Desde dónde escribe (OC6): la estrella de una tab lo manda como JSON en el form.
      const desde = sanearDesde((() => { try { return JSON.parse(String(form.get('desde') ?? 'null')); } catch { return null; } })());
      // Con qué IA corre (8b): lo que eligió en el «+», validado contra lo que se le ofrecería ahora; si no, Automático.
      const delChat = await contextoDelChat(quien, desde, mensaje);
      const ia = await eleccionDelPedido(quien, form.get('ia'));
      const r = await turnoApp(quien, sessionId, { mensaje, adjuntos: v.adjuntos, voz, contexto: delChat.contexto, pista: delChat.pista, referente: delChat.referente, guardarAdjuntos: true, plazoMs: maxDuration * 1000, desde, ia });
      if (!r) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
      return json({ ...r });
    } catch (e) {
      if (esSinPermisoIa(e)) return json({ ok: false, error: TEXTO_SIN_PERMISO_IA, necesitaPermisoIa: true }, 403);
      console.error('[api/mako/chat] POST multipart', e instanceof Error ? e.message : String(e));
      return json({ ok: false, error: 'Algo falló de nuestro lado. Intenta de nuevo.' }, 500);
    }
  }
  let body: { action?: unknown; tab?: unknown; sessionId?: unknown; mensaje?: unknown; pendienteId?: unknown; antes?: unknown; chat?: unknown; cambio?: unknown; desde?: unknown; ia?: unknown; referentes?: unknown };
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Pedido inválido.' }, 400); }
  try {
    if (body.action === 'new') {
      // La de una tab con chat propio (el Second Brain): la suya, o una nueva con el primer mensaje. Una tab que no la tiene, 400.
      if (body.tab != null) {
        const sesion = typeof body.tab === 'string' ? await sesionDeTab(persona, body.tab, true) : null;
        return sesion ? json({ ok: true, sesion }) : json({ ok: false, error: 'Esa pantalla no tiene su chat.' }, 400);
      }
      return json({ ok: true, sesion: await nuevaSesion(persona) });
    }
    // Quién tiene al frente un coach: del negocio, así que sólo su admin lo cambia.
    if (body.action === 'referente') {
      if (persona.rol !== 'admin') return json({ ok: false, error: 'Lo cambia quien administra el negocio.' }, 403);
      const referentes = await runWithWorkspace(persona.ws, async () => {
        const nuevos = sanearReferentes({ ...(await leerReferentes()), ...(body.referentes && typeof body.referentes === 'object' ? body.referentes : {}) });
        await guardarReferentes(nuevos);
        return nuevos;
      });
      return json({ ok: true, referentes });
    }
    // Las marcas de la persona en un mensaje (el menú del clic derecho): suyas, en su negocio (lib/chat-mako-marcas-db.ts).
    if (body.action === 'marcar') {
      const cambio = sanearCambio(body.cambio);
      if (!esChatDeMarcas(body.chat) || !cambio) return json({ ok: false, error: 'Elige el mensaje otra vez.' }, 400);
      return json({ ok: true, marcas: await marcarEnElChat(persona, body.chat, cambio) });
    }

    const sessionId = enteroDe(body.sessionId);
    if (sessionId == null) return json({ ok: false, error: 'Falta el chat.' }, 400);
    const quien = await personaDelChat(persona, sessionId, body.antes);
    if (!quien) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);

    if (body.action === 'send') {
      const mensaje = typeof body.mensaje === 'string' ? body.mensaje : '';
      if (!mensaje.trim()) return json({ ok: false, error: 'Escribe algo.' }, 400);
      // `guardarAdjuntos` también sin fotos (22/10/2026, la prueba de los chats): un texto PEGADO va en este cuerpo, y sin
      // la marca el turno no lo archivaba aunque el hilo dijera «el texto entero quedó en El Archivero». El teléfono ya la
      // pasaba (/api/m/mako); el MaKo Analyst de un lead, que no la pasa, es otra ruta.
      // Desde dónde escribe (OC6, lib/chat-desde.ts): la tab, la entidad y el modo de la estrella; saneado, nunca tal cual.
      // Con qué IA corre (8b): lo que eligió en el «+», validado contra lo que se le ofrecería ahora; si no, Automático.
      const delChat = await contextoDelChat(quien, sanearDesde(body.desde), mensaje);
      const ia = await eleccionDelPedido(quien, body.ia);
      const r = await turnoApp(quien, sessionId, { mensaje, contexto: delChat.contexto, pista: delChat.pista, referente: delChat.referente, guardarAdjuntos: true, plazoMs: maxDuration * 1000, desde: sanearDesde(body.desde), ia });
      if (!r) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
      // Un fallo del modelo NO es un error HTTP: el mensaje quedó guardado y el aviso viaja adentro.
      return json({ ...r });
    }

    if (body.action === 'confirmar' || body.action === 'cancelar') {
      const pendienteId = enteroDe(body.pendienteId);
      if (pendienteId == null) return json({ ok: false, error: 'Falta qué confirmar.' }, 400);
      const r = body.action === 'confirmar'
        ? await confirmarDesdeTarjeta(quien, sessionId, pendienteId)
        : await cancelarDesdeTarjeta(quien, sessionId, pendienteId);
      return json({ ...r });
    }

    return json({ ok: false, error: 'Pedido inválido.' }, 400);
  } catch (e) {
    if (esSinPermisoIa(e)) return json({ ok: false, error: TEXTO_SIN_PERMISO_IA, necesitaPermisoIa: true }, 403);
    console.error('[api/mako/chat] POST', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'Algo falló de nuestro lado. Intenta de nuevo.' }, 500);
  }
}
