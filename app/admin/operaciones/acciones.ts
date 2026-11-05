'use server';

// =============================================================================
// /admin/operaciones — las acciones del Centro de Operaciones
// =============================================================================
// ⚠️ `getSesionAdmin()` EN LA PRIMERA LÍNEA DE CADA UNA. El id de una server action viaja en el
//    bundle y Next la ejecuta por cualquier puerta que lo tenga: que la página sea de /admin no
//    protege nada. Lo fija tests/operaciones.test.ts.
// ⚠️ Y NO ALCANZA CON SER ADMIN: esto es una puerta a la PC de Martín. Encolar y acuñar el token
//    piden además `puedeOperar` (lib/operaciones-reglas.ts): el workspace de la plataforma, una
//    sesión con fila y un segundo factor de verdad. Leer también, porque los pedidos son prompts.
// ⚠️ EL TEXTO FIRMADO VIAJA DESDE EL NAVEGADOR Y NO SE TOCA. Se firma allá con una clave que no
//    se puede exportar; acá sólo se valida y se guarda (lib/operaciones.ts).

import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { puedeOperar } from '@/lib/operaciones-reglas';
import {
  cancelarPedido, cancelarRespuestasDe, crearTokenCartero, descartarDelLimbo, encolarPedido, leerCarteros, listarPedidos, trabajoDeLaCola,
  type EstadoCarteros, type Pedido,
} from '@/lib/operaciones';
import { areasDeProgreso, leerPushes, type LecturaPushes } from '@/lib/progreso';
import { TOPE_PEDIDOS_POR_LECTURA, pedidosDelCentro, type PedidoP } from '@/lib/progreso-reglas';
import { ignorarDecision, leerDecisiones } from '@/lib/admin-decisiones';
import type { DecisionEspera, YaVistos } from '@/lib/centro-chats';
import { leerYaVistosDe, marcarYaVistoDe } from '@/lib/centro-ya-vistos-db';
import { sanearAspecto, type MunecosElegidos } from '@/lib/centro-munecos';
import { guardarMuneco } from '@/lib/centro-munecos-db';
import { leerTurnos, leerUltimosTurnos } from '@/lib/centro-turnos-db';
import type { TurnoChat } from '@/lib/operaciones-reglas';
import { ignorarPregunta, leerAbiertas, leerPreguntas, marcarContestada } from '@/lib/centro-preguntas-chat-db';
import { eleccionValida, textoDeRespuesta, type PreguntaChat } from '@/lib/centro-preguntas-chat';
import { guardarBorradorDe, leerBorradorDe } from '@/lib/centro-borradores-db';
import { conUrlsDeTurnos } from '@/lib/operaciones-adjuntos';
import type { Borrador } from '@/lib/centro-caja';
import { leerTareasDelChat } from '@/lib/centro-plan-auto';
import type { TareaDelChat } from '@/lib/centro-plan-auto-reglas';
import { leerMarcasDe, marcarDe } from '@/lib/centro-mensajes-db';
import { guardarAlias, leerCuentasConNombre } from '@/lib/centro-titulares-db';
import { leerCreditoApi } from '@/lib/credito-api-db';
import { desconectar, listarPcDelNegocio } from '@/lib/ia-pc';
import type { LecturaComputadoras } from '@/lib/ia-pc-reglas';
import { guardarInterruptorDeCredito } from '@/lib/credito-negocio';
import type { LecturaCredito } from '@/lib/credito-api';
import { CUENTA_RE } from '@/lib/operaciones-reglas';
import { aliasValido, type CuentasConNombre } from '@/lib/centro-titulares';
import { leerPasos } from '@/lib/centro-pasos-db';
import type { PasosPorChat } from '@/lib/centro-pasos';
import { chatCheap } from '@/lib/ai-cheap';
import { decisionDeRespuesta, decisionPorReglas, promptChatNuevo, type DecisionChatNuevo } from '@/lib/centro-chat-nuevo';
import { nombresDeTabs } from './tabs';
import { sanearCambio, type MarcasChat } from '@/lib/centro-mensajes';

const NO_PUEDE = 'Entra con tu segundo factor para usar el Centro.';
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Algo falló: vuelve a intentarlo.');

/** `decisiones`: las tarjetas de la Ticketera, enteras: cada chat dibuja las suyas arriba de la caja (null si no se
 *  pudieron leer: el resto se ve igual). `preguntasAbiertas`: cuántas preguntas espera cada sesión (el globito y el orden
 *  de la lista; las preguntas mismas viajan con los turnos del chat abierto). */
export type FotoCentro = {
  ok: true; pedidos: Pedido[]; carteros: EstadoCarteros; decisiones: DecisionEspera[] | null; preguntasAbiertas: Record<string, number>;
  /** El nombre y el email de cada cuenta (la G, 17/10/2026). */
  cuentas: CuentasConNombre;
  /** Lo que están haciendo AHORA los chats ocupados (la E): sus últimos pasos, si se subieron hace poco. */
  pasos: PasosPorChat;
  /** Lo ÚLTIMO de cada chat, por sesión, recortado (lib/operaciones-reglas.ts → resumirTurnos): para el aviso de un «Completado»
   *  sin ver y para esconder al vigía callado. Son para la fila de la lista, no para la conversación. */
  ultimos: Record<string, TurnoChat[]>;
  /** El ✓ de cada «Completado» (18/10/2026): null = no se pudo leer, y la lista no avisa. */
  yaVistos: YaVistos | null;
} | { ok: false; error: string };

export async function fotoCentroAction(): Promise<FotoCentro> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  try {
    const [pedidos, carteros, decisiones, preguntasAbiertas, cuentas, pasos, ultimos, yaVistos] = await Promise.all([listarPedidos(), leerCarteros(), decisionesQueEsperan(), leerAbiertas(), leerCuentasConNombre(), leerPasos(), leerUltimosTurnos(), leerYaVistosDe()]);
    return { ok: true, pedidos, carteros, decisiones, preguntasAbiertas, cuentas, pasos, ultimos, yaVistos };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Los pedidos terminados viejos de UN chat, al abrirlo (23/10/2026): la carga ya no los trae (lib/progreso-reglas.ts →
 *  pedidosDeLaCarga). Por id, recortados como todos (`pedidosDelCentro`). */
export async function pedidosDelChatAction(ids: string[]): Promise<{ ok: true; pedidos: PedidoP[] } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (!Array.isArray(ids)) return { ok: false, error: 'Faltan los trabajos.' };
  const pedir = new Set(ids.filter((x): x is string => typeof x === 'string').slice(0, TOPE_PEDIDOS_POR_LECTURA));
  try {
    return { ok: true, pedidos: pedidosDelCentro(areasDeProgreso(), Date.now()).filter((p) => pedir.has(p.id)) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Los pushes de Vercel, DESPUÉS de dibujar: la API de Vercel tarda hasta 8 s y la página no la espera
 *  («tarda mucho en aparecer», Martín, 15/10/2026). La piden Pushes y el «subió hace…» de la conversación. */
export async function pushesCentroAction(): Promise<LecturaPushes> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, motivo: NO_PUEDE };
  return leerPushes();
}

/** Lo que se dijo en un chat (sus sesiones, las de todas sus cuentas), para su conversación (17/10/2026: «los chats no
 *  se entienden»). Lo pide la pantalla al abrir un chat y en cada refresco de ese chat; los demás no viajan. */
export async function turnosCentroAction(locales: string[], direccion?: string): Promise<{ ok: true; turnos: TurnoChat[]; preguntas: PreguntaChat[]; borrador: Borrador | null; tareas: TareaDelChat[]; marcas: MarcasChat | null } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (!Array.isArray(locales)) return { ok: false, error: 'Falta el chat.' };
  const validos = locales.filter((l): l is string => typeof l === 'string');
  // Las preguntas del chat y su borrador viajan con lo que se dijo en él: son parte de su conversación (17/10/2026).
  // Y las marcas de Martín en sus mensajes (reacciones, destacados, fijados, eliminados para él: lib/centro-mensajes.ts).
  const [turnos, preguntas, borrador, tareas, marcas] = await Promise.all([
    leerTurnos(validos), leerPreguntas(validos), typeof direccion === 'string' ? leerBorradorDe(direccion) : Promise.resolve(null),
    leerTareasDelChat(validos), typeof direccion === 'string' ? leerMarcasDe(direccion) : Promise.resolve(null),
  ]);
  // Lo que Martín adjuntó en la app de Claude, con su URL firmada de 10 minutos (20/10/2026): sólo detrás de puedeOperar.
  return { ok: true, turnos: await conUrlsDeTurnos(turnos).catch(() => turnos), preguntas, borrador, tareas, marcas };
}

/** El nombre que Martín le pone a una cuenta en el Uso (la G, 17/10/2026). Vacío vuelve al del titular. Vive en MaKo, nunca
 *  en cuentas.tsv: ése es de la PC y del hook del 97%. */
export async function guardarAliasCuentaAction(cuenta: string, alias: string): Promise<{ ok: true; cuentas: CuentasConNombre } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof cuenta !== 'string' || !CUENTA_RE.test(cuenta) || typeof alias !== 'string') return { ok: false, error: 'Elige la cuenta otra vez.' };
  const v = aliasValido(alias);
  if (!v.ok) return v;
  try {
    return { ok: true, cuentas: await guardarAlias(cuenta, v.alias) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** El crédito de API de los planes Max, para el Uso (22/10/2026, Martín: «En USO de SuperAdmin quiero ver también el USO de
 *  la API»): por cuenta, si está vinculado y lo gastado según lo que registra MaKo. Sólo números: ninguna clave sale de acá. */
export async function creditoApiAction(): Promise<LecturaCredito> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  try {
    return await leerCreditoApi();
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Prende o apaga el crédito de Claude asignado a un negocio (22/10/2026, Martín: «dame luego una opción para deshabilitarle
 *  esa API a Mauricio en SuperAdmin, tal vez en USO»; lib/credito-negocio.ts). Devuelve la lectura nueva de la sección. */
export async function creditoDelNegocioAction(ws: unknown, prendido: unknown): Promise<LecturaCredito> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof ws !== 'number' || !Number.isInteger(ws) || typeof prendido !== 'boolean') return { ok: false, error: 'Elige el negocio otra vez.' };
  try {
    await guardarInterruptorDeCredito(ws, prendido);
    return await leerCreditoApi();
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Las computadoras conectadas de UN negocio, para su ficha en Clientes (23/10/2026). Ya no las de todos: Martín, al verlas en
 * «Tus cuentas de IA»: «eso esta muy mal, no tiene nada que ver, estas cruzando workspace» (lib/ia-pc.ts → listarPcDelNegocio).
 * Sin secretos.
 */
export async function computadorasDelNegocioAction(ws: unknown): Promise<LecturaComputadoras> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof ws !== 'number' || !Number.isInteger(ws) || ws <= 0) return { ok: false, error: 'Abre la ficha del negocio otra vez.' };
  try {
    return { ok: true, pcs: await listarPcDelNegocio(ws) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Desconecta la computadora de un negocio (Martín: «Y poder "Desconectar" dispositivos»), desde su ficha: la revoca al
 *  instante, y su turno en curso vence. Devuelve la lista nueva de ESE negocio. */
export async function desconectarComputadoraAction(ws: unknown, id: unknown): Promise<LecturaComputadoras> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof ws !== 'number' || !Number.isInteger(ws) || ws <= 0 || typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return { ok: false, error: 'Elige la computadora otra vez.' };
  try {
    await desconectar(ws, id);
    console.warn(`[operaciones] el super admin desconectó la PC ${id} del ws ${ws}`);
    return { ok: true, pcs: await listarPcDelNegocio(ws) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Una marca de Martín sobre un mensaje (17/10/2026, lo de WhatsApp): reaccionar, destacar, fijar o eliminar para él. NO
 *  va al chat: se guarda en MaKo para que se vea igual en la computadora y en el teléfono. */
export async function marcarMensajeAction(direccion: string, cambio: unknown): Promise<{ ok: true; marcas: MarcasChat } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  const c = sanearCambio(cambio);
  if (typeof direccion !== 'string' || !c) return { ok: false, error: 'Elige el mensaje otra vez.' };
  try {
    return { ok: true, marcas: await marcarDe(direccion, c) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** El ✓ de un «Completado» (18/10/2026, pedido 1d15877a): hasta ese «Ya está», el chat deja de decir «Espera tu respuesta»,
 *  en la computadora y en el teléfono. Sólo avanza (lib/centro-ya-vistos-db.ts). */
export async function marcarYaVistoAction(chat: string, instante: number): Promise<{ ok: true; yaVistos: YaVistos } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof chat !== 'string' || !chat || chat.length > 300 || typeof instante !== 'number' || !Number.isFinite(instante)) return { ok: false, error: 'Falta el mensaje.' };
  try {
    return { ok: true, yaVistos: await marcarYaVistoDe(chat, Math.min(instante, Date.now() + 60_000)) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Guarda el borrador de un chat en MaKo, para que cruce al teléfono (17/10/2026, la B). Sólo si es más nuevo. */
export async function guardarBorradorAction(direccion: string, texto: string, at: number): Promise<{ ok: true; borrador: Borrador } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof direccion !== 'string' || typeof texto !== 'string' || typeof at !== 'number' || !Number.isFinite(at)) return { ok: false, error: 'Falta el borrador.' };
  try {
    return { ok: true, borrador: await guardarBorradorDe(direccion, { texto, at: Math.min(at, Date.now() + 60_000) }) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Marca contestada una pregunta de un chat (17/10/2026, el formulario de su conversación). La respuesta YA salió firmada
 * por mandar.ts: acá se comprueba que el trabajo `trabajo` existe, es para esa sesión y dice EXACTAMENTE lo elegido
 * (`textoDeRespuesta`), y recién ahí se marca, sólo si no estaba contestada. Sin trabajo firmado no se marca nada.
 */
export async function contestarPreguntaAction(entrada: {
  local: string; id: string; elegidas: number[]; otra: string; trabajo: string;
}): Promise<{ ok: true; pregunta: PreguntaChat } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  try {
    const { local, id, trabajo } = entrada ?? {};
    if (typeof local !== 'string' || typeof id !== 'string' || typeof trabajo !== 'string') return { ok: false, error: 'Falta la pregunta.' };
    const p = (await leerPreguntas([local])).find((x) => x.id === id);
    if (!p) return { ok: false, error: 'Esa pregunta ya no está.' };
    const v = eleccionValida(p, Array.isArray(entrada.elegidas) ? entrada.elegidas : [], typeof entrada.otra === 'string' ? entrada.otra : '');
    if (!v.ok) return v;
    const w = await trabajoDeLaCola(trabajo);
    if (!w || w.destino !== local || w.texto.trim() !== textoDeRespuesta(p, v.elegidas, v.otra)) {
      return { ok: false, error: 'Tu respuesta no salió: vuelve a elegir.' };
    }
    const r = await marcarContestada(local, id, { elegidas: v.elegidas, otra: v.otra, at: new Date().toISOString(), trabajo });
    // Ignorada en otro dispositivo (5/11/2026): la respuesta que acaba de salir firmada no se entrega. Se cancela ya (la vuelta del
    // Runner la frena igual si esto falla).
    if (!r.ok && r.ignorada) await cancelarRespuestasDe(local, id).catch(() => 0);
    return r.ok ? r : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * «Ignorar» y «Volver a mostrar» una pregunta de un chat (5/11/2026, Martín: «una sección que marque la fecha de los pedidos o
 * decisiones y un botón de ignorar»). Sale del bloque sin contestarla y sin mandarle nada al chat; la respuesta suya que todavía no
 * salió se cancela (`cancelarRespuestasDe`), y la vuelta del Runner no entrega ninguna (lib/operaciones.ts).
 */
export async function ignorarPreguntaAction(entrada: { local: string; id: string; ignorar: boolean }): Promise<{ ok: true; pregunta: PreguntaChat } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  try {
    const { local, id } = entrada ?? {};
    if (typeof local !== 'string' || typeof id !== 'string') return { ok: false, error: 'Falta la pregunta.' };
    const r = await ignorarPregunta(local, id, entrada.ignorar !== false);
    if (r.ok && entrada.ignorar !== false) await cancelarRespuestasDe(local, id).catch((e) => console.error('[operaciones] cancelar la respuesta de una ignorada:', msg(e)));
    return r;
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** «Ignorar» y «Volver a mostrar» una decisión de la Ticketera desde el bloque de su chat (lib/admin-decisiones.ts → ignorarDecision). */
export async function ignorarDecisionAction(entrada: { id: number; ignorar: boolean }): Promise<{ ok: true; ignoradaAt: string | null } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  try {
    return await ignorarDecision(Number(entrada?.id), entrada?.ignorar !== false);
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Las tarjetas abiertas de la Ticketera (las archivadas no vienen). No es una acción. */
async function decisionesQueEsperan(): Promise<DecisionEspera[] | null> {
  const l = await leerDecisiones().catch(() => null);
  return l?.ok ? l.decisiones : null;
}

export async function encolarPedidoAction(entrada: {
  firmado: string; firma: string; clavePublica: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof entrada?.firmado !== 'string' || typeof entrada.firma !== 'string' || typeof entrada.clavePublica !== 'string') {
    return { ok: false, error: 'Vuelve a mandarlo: le faltó la firma.' };
  }
  try {
    return await encolarPedido({ ...entrada, autor: admin.email || admin.nombre || admin.sub });
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function cancelarPedidoAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof id !== 'string') return { ok: false, error: 'Falta el trabajo.' };
  try {
    const hecho = await cancelarPedido(id);
    return hecho ? { ok: true } : { ok: false, error: 'Ya salió: no se puede cancelar.' };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Dar de baja un mensaje que espera un chat cerrado. Sin botón desde que Martín sacó el cartel (31/10/2026). */
export async function descartarDelLimboAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof id !== 'string') return { ok: false, error: 'Falta el mensaje.' };
  try {
    const hecho = await descartarDelLimbo(id);
    return hecho ? { ok: true } : { ok: false, error: 'Ya salió: no hace falta descartarlo.' };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function crearTokenCarteroAction(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  try {
    return { ok: true, ...(await crearTokenCartero()) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** El muñeco que Martín eligió para un chat (por su nombre, en las tres cuentas). Con `aspecto` null vuelve al de
 *  siempre. Lo que llega del navegador se sanea: un aspecto con una pieza que no existe no se guarda. */
export async function guardarMunecoAction(titulo: string, aspecto: unknown): Promise<{ ok: true; munecos: MunecosElegidos } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof titulo !== 'string' || !titulo.trim()) return { ok: false, error: 'Elige un chat para cambiarle la criatura.' };
  const limpio = aspecto == null ? null : sanearAspecto(aspecto);
  if (aspecto != null && !limpio) return { ok: false, error: 'Elige otra criatura: ésa no existe.' };
  try {
    return { ok: true, munecos: await guardarMuneco(titulo, limpio) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * «Nuevo chat» SIN modal (17/10/2026, Martín: «jamás debe abrir un modal»): con el primer mensaje, la IA barata de la plataforma
 * decide dónde va —un chat que ya existe, un empleado nuevo de un jefe, o un jefe nuevo— y cómo se llama. Es texto de Martín,
 * no datos de clientes (por eso la barata y no una de pago: el Plan nunca paga IA). Lo que contesta pasa por
 * `decisionDeRespuesta` (la lista blanca del nombre es la de la PC); si no contesta o no vale, deciden las reglas
 * (`decisionPorReglas`). Nunca se le pregunta nada a Martín.
 */
export async function decidirChatNuevoAction(texto: unknown, chats: unknown): Promise<{ ok: true; decision: DecisionChatNuevo } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof texto !== 'string' || !texto.trim() || texto.length > 8000) return { ok: false, error: 'Escribe tu mensaje.' };
  const lista = (Array.isArray(chats) ? chats : []).slice(0, 300).flatMap((c): Array<{ clave: string; titulo: string }> => {
    const o = c && typeof c === 'object' ? (c as Record<string, unknown>) : null;
    return o && typeof o.clave === 'string' && typeof o.titulo === 'string' && o.clave.length <= 200 ? [{ clave: o.clave, titulo: o.titulo.slice(0, 120) }] : [];
  });
  const ctx = { tabs: nombresDeTabs(), chats: lista };
  try {
    const { system, user } = promptChatNuevo(texto, ctx);
    const crudo = await chatCheap({ system, user, json: true, maxTokens: 160, temperature: 0, feature: 'centro-chat-nuevo', motivo: 'Dónde va un chat nuevo del Ops Center', timeoutMs: 9000 });
    const json = crudo.match(/\{[\s\S]*\}/)?.[0];
    const d = json ? decisionDeRespuesta(JSON.parse(json), ctx) : null;
    if (d) return { ok: true, decision: d };
  } catch { /* sin IA, o una respuesta que no es JSON: deciden las reglas */ }
  return { ok: true, decision: decisionPorReglas(texto, ctx) };
}
