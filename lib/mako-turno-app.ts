// =============================================================================
// mako-turno-app — el turno del chat de MaKo en el TELÉFONO (MaKo Mobile)
// =============================================================================
// El «turno compartido» que pedía docs/api-mako-diseno.md §4.2 para que el chat de la app
// deje de ser sólo lectura: MaKo lee datos reales y PROPONE acciones, y la persona las
// confirma tocando la tarjeta del hilo (app/m/mako/acciones.ts → confirmarPendiente, que
// reclama antes de ejecutar y vuelve a mirar el gating). Lo usan app/api/m/mako/route.ts y
// app/m/mako/acciones.ts. El chat de escritorio (/api/mako-doer) sigue SÓLO LECTURA.
//
// Las piezas son las del doer de WhatsApp (lib/mako-doer-in.ts), sin el jid ni Evolution:
//   · qué herramientas viajan: `herramientasDelChat` → `herramientasDelTurno` sobre el
//     veredicto de `clasificarIntencion` (el MISMO camino; AGENTS.md, «Una capacidad nueva
//     del doer se prueba con el turno que CORRE»), sin confirmar_accion y sin las lecturas
//     de la agenda de Google (lib/mako-turno-app-reglas.ts);
//   · las pendientes vigentes del canal en el system y `ctx.turnStart` (el anti
//     auto-confirm de lib/api-mako/acciones.ts);
//   · `crearMemoDeAcciones` + `nuevoIntento()` en CADA corrida (lib/turno-sin-duplicar.ts);
//   · los links de una acción los escribe el CÓDIGO (`linksDeUnaAccion`).
//
// ⚠️ LA CLAVE DE SCOPE ES `app:<sesión>`, nunca `app:ws<N>`: una persona sólo ve, confirma o
// cancela lo que se propuso en ESE chat.
//
// ⚠️ LAS SESIONES SON POR PERSONA: `chart_key = mako-movil:<persona>` (chartKeyDePersona).
// `getSession(id)` de lib/chart-chats.ts NO filtra por clave, así que toda lectura o
// escritura por id pasa por `sesionDe`, que compara la clave. Y `listAllSessions` (la tab
// /mako de escritorio, que es por workspace) excluye `mako-movil:%` para no mostrarlos.
//
// ⚠️ UNA FOTO NO LLEGA AL MODELO COMO BLOQUE (medido el 11/10/2026, ver lib/mako-adjuntos.ts):
// se lee ANTES con el lector compartido (lib/archivo-a-texto.ts) y su texto entra al turno.
// =============================================================================

import 'server-only';
import { chatClaudeTools, type RichMsg, type ToolDef } from '@/lib/anthropic';
import { MAKO_TOOLS, runMakoTool } from '@/lib/mako-tools';
import { MAKO_ACCION_TOOLS, NOMBRES_ACCION } from '@/lib/mako-doer-acciones';
import { porId } from '@/lib/api-mako/registro';
import { runnerDelRegistro, vistaDe } from '@/lib/api-mako/ejecutar';
import { confirmarPendiente, cancelarPendiente } from '@/lib/api-mako/acciones';
import type { Ctx } from '@/lib/api-mako/tipos';
import { pendientesVigentes } from '@/lib/mako-pendientes';
import { clasificarIntencion, makoPreguntoAlgo } from '@/lib/mako-intencion';
import { preguntoReunionOTarea } from '@/lib/doer-herramientas';
import { recetasDelTurno } from '@/lib/doer-recetas';
import { bloqueAgendaGoogle, agendaQueSigue, agendaSeCierra, agendaVigente, contextoAgendaAbierta, herramientasQueSiguen, ACCIONES_AGENDA } from '@/lib/agenda-sin-ia';
import { crearMemoDeAcciones, MARGEN_RELOJ_MS } from '@/lib/turno-sin-duplicar';
import { buildSystemPrompt } from '@/lib/mako-context';
import { avisoDePuntos } from '@/lib/puntos-mensaje';
import { validarRespuestaDoer } from '@/lib/respuesta-doer';
import { credWs } from '@/lib/credenciales';
import { getSetting, setSetting } from '@/lib/settings';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { runWithWorkspace, getWorkspaceActual, getRolWsEfectivo, getCapaActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { createSession, getSession, listSessions, getSessionMessages, appendMessage, renameSession, tituloDesde, type ChartSession } from '@/lib/chart-chats';
import { archivoATexto } from '@/lib/archivo-a-texto';
import { aFila } from '@/lib/bandeja-filas';
import { puedeVerKey } from '@/lib/movil-rutas';
import { bloquesDeAdjuntos, placeholderDeAdjunto, promptDeAdjunto, type AdjuntoListo } from '@/lib/mako-adjuntos';
import {
  chartKeyDePersona, canalKeyDeSesion, herramientasDelChat, tarjetaDePendiente, linksDeUnaAccion,
  propuestaDePantalla, sinLinksDeRevision, MENSAJE_BORRADOR_APP, mensajeLeadApp, TEXTO_SOLO_TARJETA,
  historialParaModelo, hoyLegible, errorCortoDeTarjeta, conInstruccionDeTarjeta,
  type LinkCapturado, type MensajeChat, type RespuestaTurno, type ResultadoTarjeta, type SesionChat, type TarjetaPendiente,
} from '@/lib/mako-turno-app-reglas';

/** La feature registrada del doer (lib/model-catalogo.ts → Gemini). Claude está vetado. */
const FEATURE = 'mako-doer';
/** Cuánto texto de la persona entra por mensaje: un chat, no una importación. */
const TOPE_MENSAJE = 8_000;
/** Cuánto de lo leído de los archivos entra al turno. El loop re-manda la conversación en
 *  cada paso: 40.000 caracteres son ~10 páginas, y lo que se corta SE DICE. */
const TOPE_LECTURA = 40_000;

// ── Quién habla ──────────────────────────────────────────────────────────────

export type PersonaChat = {
  ws: number;
  /** el rol REAL en el workspace: un closer/setter es 'miembro' y no ve lo de admin */
  rol: 'admin' | 'miembro';
  /** quién confirma, para el historial de la pendiente */
  actor: string;
  /** de quién son las sesiones (chartKeyDePersona) */
  chartKey: string;
};

export type FalloPersona = { error: string; status: 400 | 401 | 403 };

/**
 * La persona del request, o por qué no. Exige sesión ADENTRO (el proxy no alcanza como red)
 * y la misma regla del Sidebar para la tab MaKo (`puedeVerKey`, lib/movil-rutas.ts): rol +
 * capa del workspace. El workspace sale de `getWorkspaceActual()`, nunca del `?ws=` crudo.
 */
export async function personaDelRequest(): Promise<PersonaChat | FalloPersona> {
  const sesion = await getUsuarioActual();
  if (!sesion) return { error: 'Tu sesión venció.', status: 401 };
  const rolWs = await getRolWsEfectivo();
  if (!rolWs) return { error: 'Tu sesión venció.', status: 401 };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Elige una cuenta primero.', status: 400 };
  const capa = await getCapaActual().catch(() => null);
  if (!puedeVerKey('mako', rolWs, capa)) return { error: 'MaKo no está en tu cuenta.', status: 403 };
  const chartKey = chartKeyDePersona(sesion);
  if (!chartKey) return { error: 'Tu sesión venció.', status: 401 };
  return { ws, rol: rolWs === 'admin' ? 'admin' : 'miembro', actor: sesion.email || sesion.nombre || sesion.sub, chartKey };
}

// ── Las sesiones de la persona ───────────────────────────────────────────────

const aSesion = (s: ChartSession): SesionChat => ({ id: s.id, titulo: s.titulo, pinned: s.pinned, updatedAt: s.updated_at });

/** La sesión si es de ESTA persona; null si no existe o es de otro (no se distingue: a
 *  quien no le corresponde, no existe). */
async function sesionDe(persona: PersonaChat, sessionId: number): Promise<ChartSession | null> {
  if (!Number.isInteger(sessionId) || sessionId <= 0) return null;
  const s = await getSession(sessionId);
  return s && s.chart_key === persona.chartKey ? s : null;
}

export async function listarSesiones(persona: PersonaChat): Promise<SesionChat[]> {
  return runWithWorkspace(persona.ws, async () => (await listSessions(persona.chartKey)).map(aSesion));
}

/** Una sesión vacía. Sin saludo del modelo: cada «Nuevo chat» costaba dos llamadas (el
 *  saludo y el título) en el chat de escritorio. */
export async function nuevaSesion(persona: PersonaChat): Promise<SesionChat> {
  return runWithWorkspace(persona.ws, async () => aSesion(await createSession(persona.chartKey, null, '')));
}

/** Las tarjetas de las pendientes vigentes de UN chat (las de este turno, con `desde`).
 *  La fila sale de `aFila` (lib/bandeja-filas.ts), la misma de /mako/pendientes y de Inbox.
 *  ⚠️ `pendientesVigentes` ESCRIBE (vence lo vencido antes de leer): bien acá, que es una
 *  pantalla o un turno; nunca en un badge con polling. */
const tarjetasVigentes = async (ws: number, canalKey: string, desde?: number): Promise<TarjetaPendiente[]> => {
  const vigentes = (await pendientesVigentes(ws, canalKey))
    .filter((p) => desde == null || Date.parse(p.createdAt) >= desde - MARGEN_RELOJ_MS);
  if (!vigentes.length) return [];
  const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
  return vigentes.map((p) => tarjetaDePendiente(p, aFila(p, tz)));
};

/** Los mensajes de la sesión y las acciones que esperan confirmación en ella. */
export async function abrirSesion(persona: PersonaChat, sessionId: number): Promise<{ sesion: SesionChat; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[] } | null> {
  return runWithWorkspace(persona.ws, async () => {
    const s = await sesionDe(persona, sessionId);
    if (!s) return null;
    const [mensajes, propuestas] = await Promise.all([
      getSessionMessages(s.id),
      tarjetasVigentes(persona.ws, canalKeyDeSesion(s.id)),
    ]);
    return { sesion: aSesion(s), mensajes, propuestas };
  });
}

// ── El system del turno ──────────────────────────────────────────────────────

const VOZ_APP = `CONTEXTO: estás en el chat de MaKo en el TELÉFONO de la persona (el dueño del negocio o alguien de su equipo). Responde breve y claro (2-5 líneas), sin volcar JSON ni tecnicismos. Ves el historial de este chat: úsalo y no pidas datos que ya te dieron.`;

/** El protocolo de herramientas: SÓLO si viajan herramientas (AGENTS.md, «Un prompt que
 *  ORDENA usar algo que no se mandó…»). */
const TOOLS_APP = `TUS HERRAMIENTAS (la lista exacta de este turno está al final): úsalas para responder con datos reales; nunca inventes nombres, números ni fechas. Si te preguntan por un lead, una reunión o una campaña, BÚSCALO antes de decir que no lo tienes. Si necesitas varios datos, pide todas las herramientas en el mismo paso.
Una lectura trae el dato. Una acción NUNCA ejecuta directo: o deja una acción pendiente, o deja una propuesta para revisar en una pantalla.`;

/** Lo que cambia en ESTE canal y manda sobre las recetas (que hablan de WhatsApp). */
const CANAL_APP = `EN ESTE CHAT (la app en el teléfono), y esto manda sobre lo de arriba:
- Una acción pendiente se confirma TOCANDO la tarjeta que el sistema pone debajo de tu mensaje, no con un «sí» escrito, y tú no puedes confirmarla. Di en una línea qué vas a hacer y que lo confirme en la tarjeta.
- Lo que se revisa en una pantalla (un borrador del plan, la ficha de un lead, un formulario) la persona lo abre desde Inbox.
- NO escribas links, rutas ni ids: los pone el sistema. Y nada de separar en varios mensajes con ---.`;

const SIN_TOOLS_APP = `EN ESTE TURNO NO TIENES HERRAMIENTAS: no puedes mirar el CRM, el plan ni las campañas. ⛔ NO inventes números, nombres ni fechas, y no los deduzcas de la conversación. Si te piden un dato del negocio, dilo en una línea («pídemelo con lo que necesitas y lo busco») y nada más.`;

// ── El turno ─────────────────────────────────────────────────────────────────

export type EntradaTurnoApp = { mensaje: string; adjuntos?: AdjuntoListo[] };

/** El cartel de la plataforma: se muestra y NO se guarda (AGENTS.md, «Un cartel de la
 *  PLATAFORMA no es un turno de la conversación»). */
const AVISO_NO_PUDE = 'No pude contestar ahora. Tu mensaje quedó guardado.';
const AVISO_NO_LEI = (nombre: string) => `No pude leer «${nombre}».`;

/**
 * Un turno del chat del teléfono. Devuelve null si la sesión no es de esta persona.
 * Nunca tira por un fallo del modelo: lo devuelve como `aviso` (y no lo guarda). Sin texto
 * ni archivos tira: eso lo frena antes quien llama.
 */
export async function turnoApp(persona: PersonaChat, sessionId: number, entrada: EntradaTurnoApp): Promise<RespuestaTurno | null> {
  return runWithWorkspace(persona.ws, async () => {
    const s = await sesionDe(persona, sessionId);
    if (!s) return null;
    const ws = persona.ws;
    const canalKey = canalKeyDeSesion(s.id);
    const textoPersona = (entrada.mensaje ?? '').trim().slice(0, TOPE_MENSAJE);
    const adjuntos = entrada.adjuntos ?? [];
    const avisos: string[] = [];

    // Los archivos se LEEN antes: el bloque nativo no le llega al modelo del doer (ver la
    // cabecera). El lector es el mismo del importador del tablero.
    const lecturas: Array<{ nombre: string; texto: string }> = [];
    for (const a of adjuntos) {
      const leido = await archivoATexto(new File([a.bytes as BlobPart], a.nombre, { type: a.mime })).catch(() => null);
      if (leido?.texto?.trim()) lecturas.push({ nombre: a.nombre, texto: leido.texto.trim() });
      else avisos.push(AVISO_NO_LEI(a.nombre));
    }
    // Lo que queda en la MEMORIA del chat: el texto de la persona, o el placeholder del archivo.
    const textoMemoria = adjuntos.length === 1
      ? placeholderDeAdjunto(adjuntos[0].tipo, adjuntos[0].nombre, textoPersona)
      : adjuntos.length > 1
        ? `(envió ${adjuntos.length} archivos: ${adjuntos.map((a) => a.nombre).join(', ')})${textoPersona ? ` — ${textoPersona}` : ''}`
        : textoPersona;
    // La ruta ya lo frena; acá es la red para otro llamador.
    if (!textoMemoria) throw new Error('turnoApp: mensaje vacío');

    // El historial de ANTES de este mensaje: se lee antes de guardarlo.
    const previos = await getSessionMessages(s.id);

    // LO QUE ESCRIBIÓ LA PERSONA SE GUARDA SIEMPRE, antes del modelo.
    const guardados: MensajeChat[] = [];
    await appendMessage(s.id, 'user', textoMemoria);
    guardados.push({ role: 'user', content: textoMemoria });
    let titulo = s.titulo;
    if (!titulo) {
      titulo = tituloDesde(textoPersona || textoMemoria);
      await renameSession(s.id, titulo).catch(() => {});
    }
    const sesion: SesionChat = { id: s.id, titulo, pinned: s.pinned, updatedAt: new Date().toISOString() };
    const vacio = (aviso: string | null): RespuestaTurno => ({ ok: false, sesion, mensajes: guardados, aviso, paraLaPersona: [], propuestas: [], pantallas: [] });

    // Con archivos y nada legible ni escrito, no hay pedido: no se gasta el modelo.
    if (adjuntos.length && !lecturas.length && !textoPersona) return vacio(avisos.join(' ') || AVISO_NO_PUDE);

    let lectura = lecturas.map((l) => `[Lo que dice «${l.nombre}», leído por el sistema:]\n${l.texto}`).join('\n\n');
    if (lectura.length > TOPE_LECTURA) lectura = `${lectura.slice(0, TOPE_LECTURA)}\n[…el archivo sigue; se cortó aquí por largo]`;
    const pedido = textoPersona || (adjuntos.length ? promptDeAdjunto(adjuntos[0].tipo) : '');
    const textoModelo = lectura ? `${pedido}\n\n${lectura}` : pedido;
    const userContent: RichMsg['content'] = adjuntos.length
      ? bloquesDeAdjuntos(adjuntos.map((a) => ({ tipo: a.tipo, mime: a.mime, base64: Buffer.from(a.bytes).toString('base64') })), textoModelo)
      : textoModelo;

    const turnStart = Date.now();
    const historial = historialParaModelo(previos, 12);
    const vigentes = await pendientesVigentes(ws, canalKey);
    const claveAgenda = `mako.doer.agenda.${canalKey}`;
    const agendaAbierta = agendaVigente(await getSetting(claveAgenda).catch(() => null), Date.now());
    const ultimoDeMako = previos.slice(-2).reverse().find((r) => r.role === 'assistant')?.content ?? null;
    const textoClasificar = adjuntos.length ? textoMemoria : textoPersona;
    const intencion = clasificarIntencion(textoClasificar, {
      hayMedia: adjuntos.length > 0,
      hayPendientes: vigentes.length > 0,
      hayPendienteDeAgenda: vigentes.some((p) => (ACCIONES_AGENDA as readonly string[]).includes(p.tipo)),
      hayAgendaAbierta: !!agendaAbierta,
      makoPregunto: makoPreguntoAlgo(ultimoDeMako),
      preguntoReunionOTarea: preguntoReunionOTarea(ultimoDeMako),
    });

    // Lo que el CÓDIGO le muestra a la persona sin pasar por el modelo (la agenda de Google):
    // va en la respuesta y NO se guarda en el hilo, que vuelve al modelo en el turno siguiente.
    const paraLaPersona: string[] = [];
    const ctx: Ctx = {
      ws, canal: 'app', canalKey,
      // `proponer`: este turno deja pendientes y propuestas; confirmar es de la persona
      // (confirmar_accion pide `ejecutar` y además no viaja: dos cortes).
      alcance: 'proponer', rol: persona.rol, turnStart, mensajeUsuario: textoPersona || textoMemoria, actor: persona.actor,
      aPersona: (t) => { const x = (t ?? '').trim(); if (x && !paraLaPersona.includes(x)) paraLaPersona.push(x); },
    };
    const vista = await vistaDe(ctx);
    const sinCalendly = intencion.intencion === 'actuar'
      ? (await credWs('CALENDLY_API_TOKEN', ws).catch(() => 'no se pudo leer')) == null
      : false;
    const ultimoPedido = previos.slice().reverse().find((r) => r.role === 'user')?.content;
    const contextoDelSi = intencion.sigueOfrecimiento ? [ultimoPedido ?? '', ultimoDeMako ?? ''].filter(Boolean).join('\n') : null;
    const turno = herramientasDelChat<ToolDef>({
      veredicto: intencion, texto: textoClasificar, contextoDelSi, agendaAbierta: !!agendaAbierta,
      deSiempre: [...MAKO_TOOLS, ...MAKO_ACCION_TOOLS], vista,
      hayPendientes: vigentes.length > 0, resumenesPendientes: vigentes.map((p) => p.resumen), sinCalendly,
    });
    const tools = turno.tools as ToolDef[];
    const permitidas = new Set(tools.map((t) => t.name));

    // El system se arma DESPUÉS de las tools: depende de ellas.
    const base = await buildSystemPrompt({ chartKey: 'mako-doer', titulo: titulo ?? 'MaKo', contexto: '', query: textoPersona || textoMemoria });
    const tz = tools.length ? await tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : null;
    const puedeCancelar = permitidas.has('cancelar_accion');
    const ctxPend = vigentes.length
      ? `\n\nACCIONES ESPERANDO CONFIRMACIÓN EN ESTE CHAT (la más reciente primero):\n${vigentes.map((p) => `- #${p.id}: ${p.resumen}`).join('\n')}\nLa persona las confirma tocando su tarjeta; tú no puedes confirmarlas.${puedeCancelar ? ' Si te dice que no la quiere, usa cancelar_accion con su id.' : ''}`
      : '';
    const ctxAgenda = agendaAbierta && tools.some((t) => herramientasQueSiguen(agendaAbierta).includes(t.name)) ? contextoAgendaAbierta(agendaAbierta) : '';
    const ctxPuntos = avisoDePuntos(textoPersona);
    const bloqueTools = tools.length
      ? `\n\n${TOOLS_APP}${recetasDelTurno(permitidas, turno.ofrece)}${bloqueAgendaGoogle(tools.map((t) => t.name))}${turno.instruccion ? `\n\n${turno.instruccion}` : ''}\n\n${CANAL_APP}\n\nLAS QUE TIENES EN ESTE TURNO (y NINGUNA otra): ${tools.map((t) => t.name).join(', ')}.`
      : `\n\n${SIN_TOOLS_APP}`;
    const ctxHoy = tz ? `\n\nHOY ES ${hoyLegible(tz)} (zona ${tz}). Para «mañana», «el jueves» o «la semana que viene», calcula la fecha desde aquí; las horas que te digan son de esta zona.` : '';
    const system = `${base}\n\n${VOZ_APP}${bloqueTools}${ctxHoy}${ctxPend}${ctxAgenda}${ctxPuntos ? `\n\n${ctxPuntos}` : ''}`;

    // ── Las herramientas ───────────────────────────────────────────────────────
    const runRegistro = runnerDelRegistro(ctx);
    const NOMBRES_DE_SIEMPRE = new Set(MAKO_TOOLS.map((t) => t.name));
    const capturados: LinkCapturado[] = [];
    // Un turno que se re-arranca (la cascada de chatClaudeTools rota de cuenta) no repite
    // acciones: el mismo memo que el doer de WhatsApp.
    const memo = crearMemoDeAcciones((n) => {
      const d = porId(n);
      return d ? d.tipo !== 'lectura' : NOMBRES_ACCION.has(n) && !n.startsWith('listar_');
    });
    const runTool = async (name: string, input: Record<string, unknown>) => {
      // El contrato se aplica AL EJECUTAR: lo que no viajó no corre, aunque el modelo lo
      // llame (lo dice el texto, lo pide igual). Confirmar, menos que nada.
      if (!permitidas.has(name)) {
        return { content: JSON.stringify({ ok: false, error: `«${name}» no está disponible en este chat.` }), isError: true };
      }
      const previo = memo.previo(name);
      if (previo) return previo.out as Awaited<ReturnType<typeof runRegistro>>;
      // Las de siempre por sus cuerpos de siempre; TODO lo demás (incluidas las acciones
      // heredadas, que tienen gemela) por el registro: así cada acción pasa por el gating
      // de la vista de ESTA persona y deja su pendiente con la clave de ESTE chat.
      // La instrucción de una pendiente es la de WhatsApp («pide un sí»): acá se confirma en la tarjeta.
      const out = conInstruccionDeTarjeta(await (NOMBRES_DE_SIEMPRE.has(name) ? runMakoTool(name, input) : runRegistro(name, input)));
      memo.anotar(name, out);
      const sigue = agendaQueSigue(name, input, out, Date.now());
      if (sigue) await setSetting(claveAgenda, JSON.stringify(sigue)).catch(() => {});
      else if (agendaSeCierra(name, out)) await setSetting(claveAgenda, '').catch(() => {});
      for (const l of linksDeUnaAccion(name, input, out)) if (!capturados.some((c) => c.url === l.url)) capturados.push(l);
      return out;
    };
    /** Cada corrida abre un intento nuevo para el memo (tests/turno-sin-duplicar.test.ts). */
    const nuevoIntento = () => { memo.nuevoIntento(); return runTool; };

    const msgs: RichMsg[] = [...historial, { role: 'user', content: userContent }];
    let texto = '';
    let fallo: string | null = null;
    try {
      const r = await chatClaudeTools(system, msgs, tools, nuevoIntento(), {
        feature: FEATURE, maxSteps: 8, sinFallbackClaude: true,
        motivo: `app ${intencion.intencion} «${(textoPersona || textoMemoria).slice(0, 60)}»`,
      });
      texto = (r.text ?? '').trim();
      if (texto.startsWith('(')) { fallo = `centinela ${texto.slice(0, 40)}`; texto = ''; }
    } catch (e) {
      fallo = e instanceof Error ? e.message : String(e);
    }
    if (fallo) console.error(`[mako-turno-app] ws=${ws} sesión=${s.id} ${intencion.intencion}: ${fallo.slice(0, 300)}`);

    // ── Lo que sale ────────────────────────────────────────────────────────────
    const propuestas = await tarjetasVigentes(ws, canalKey, turnStart).catch(() => [] as TarjetaPendiente[]);
    const pantallas = capturados.map(propuestaDePantalla);
    const borrador = capturados.find((c) => c.clase === 'borrador') ?? null;
    const lead = capturados.find((c) => c.clase === 'lead') ?? null;

    let respuesta: string | null = null;
    let aviso: string | null = avisos.length ? avisos.join(' ') : null;
    if (texto) {
      const v = validarRespuestaDoer(texto, { motivoRuta: `→ ${intencion.intencion}`, linkBorrador: borrador?.url ?? null });
      if (!v.ok && v.razon !== 'sin-borrador' && !borrador) {
        // Volcó el molde, o anuncia un borrador que nadie creó: eso no se manda.
        console.error(`[mako-turno-app] ws=${ws} BLOQUEADA (${v.razon}): ${v.detalle}`);
      } else {
        respuesta = texto;
      }
    }
    // El estado de un dato no depende de cómo le salió la frase al modelo.
    if (borrador) respuesta = MENSAJE_BORRADOR_APP;
    else if (lead) respuesta = mensajeLeadApp(lead.nombre);
    if (respuesta) respuesta = sinLinksDeRevision(respuesta) || null;
    if (!respuesta && (propuestas.length || pantallas.length)) respuesta = TEXTO_SOLO_TARJETA;

    if (respuesta) {
      await appendMessage(s.id, 'assistant', respuesta);
      guardados.push({ role: 'assistant', content: respuesta });
    } else {
      aviso = [aviso, AVISO_NO_PUDE].filter(Boolean).join(' ');
    }
    return { ok: !!respuesta, sesion, mensajes: guardados, aviso, paraLaPersona, propuestas, pantallas };
  });
}

// ── La tarjeta: confirmar o cancelar ─────────────────────────────────────────

/** Lo que queda en el hilo después de tocar la tarjeta: el modelo lo lee en el turno
 *  siguiente («¿ya lo hiciste?»). Es el `resumen` del resultado, que por contrato es apto
 *  para un modelo (lo que no, va en `paraLaPersona` y no se guarda). Si guardarlo falla, la
 *  acción igual quedó hecha: no se revierte una ejecución porque no se pudo anotar. */
async function anotarEnHilo(sessionId: number, texto: string): Promise<void> {
  try { await appendMessage(sessionId, 'assistant', texto); }
  catch (e) { console.error(`[mako-turno-app] no pude anotar en la sesión ${sessionId}:`, e instanceof Error ? e.message : String(e)); }
}

function ctxDeTarjeta(persona: PersonaChat, sessionId: number, aPersona?: (t: string) => void): Ctx {
  // Sin `turnStart`: el toque es un acto aparte del turno que propuso. Sin `bandeja`: este
  // chat ve SÓLO su clave. `rol` es el real: gatingOk se vuelve a mirar al confirmar.
  return { ws: persona.ws, canal: 'app', canalKey: canalKeyDeSesion(sessionId), alcance: 'ejecutar', rol: persona.rol, actor: persona.actor, aPersona };
}

const NO_ES_TUYA: ResultadoTarjeta = { ok: false, error: 'No encuentro ese chat' };

export async function confirmarDesdeTarjeta(persona: PersonaChat, sessionId: number, pendienteId: number): Promise<ResultadoTarjeta> {
  return runWithWorkspace(persona.ws, async () => {
    if (!(await sesionDe(persona, sessionId))) return NO_ES_TUYA;
    const detalle: string[] = [];
    const r = await confirmarPendiente(ctxDeTarjeta(persona, sessionId, (t) => { if (t && !detalle.includes(t)) detalle.push(t); }), pendienteId);
    if ('error' in r) return { ok: false, error: errorCortoDeTarjeta(r.error), paraLaPersona: detalle };
    await anotarEnHilo(sessionId, r.ok ? `Hecho: ${r.resumen}` : `No se pudo: ${r.resumen}`);
    // ok:false acá es «se ejecutó y falló»: la pendiente quedó en error y no vuelve.
    return r.ok ? { ok: true, resumen: r.resumen, paraLaPersona: detalle } : { ok: false, error: r.resumen, ejecutada: true, paraLaPersona: detalle };
  });
}

export async function cancelarDesdeTarjeta(persona: PersonaChat, sessionId: number, pendienteId: number): Promise<ResultadoTarjeta> {
  return runWithWorkspace(persona.ws, async () => {
    if (!(await sesionDe(persona, sessionId))) return NO_ES_TUYA;
    const r = await cancelarPendiente(ctxDeTarjeta(persona, sessionId), pendienteId);
    if ('error' in r) return { ok: false, error: errorCortoDeTarjeta(r.error) };
    await anotarEnHilo(sessionId, r.resumen);
    return { ok: true, resumen: r.resumen, paraLaPersona: [] };
  });
}
