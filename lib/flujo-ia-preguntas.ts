// =============================================================================
// flujo-ia-preguntas — MaKo pregunta ANTES de crear, con opciones del catálogo (puro, sin `server-only`)
// =============================================================================
// Duodécima tanda (12/10/2026, docs/diseno-duodecima-tanda.md §2.4). Martín, de la prueba con Fiesta Music: «antes de
// generar la automatización haga preguntas para clarificarlo... el medio WhatsApp o Instagram» y «la regla de MaKo es
// que no genere fricción... No siempre... como hoy lo hace Claude que te saltan una pregunta con tres opciones».
//
// Tres piezas, las tres puras (las usan la ruta, `crearConIA` y la API de MaKo):
//   · `preguntaAntes`: lo que el CÓDIGO pregunta antes de llamar al modelo. SÓLO tres casos (canal, producto, evento),
//     y sólo si el dato es DECISIVO. Nunca más de `TOPE_RONDAS` rondas.
//   · `preguntaDeIA`: la `{pregunta}` que devolvió el modelo en vez del flujo, validada contra el catálogo.
//   · `aplicarRespuestas`: lo que la persona contestó lo IMPONE el código (no se le pide al modelo que lo respete).
//
// ⚠️ NADA INVENTADO: el rótulo de una opción sale SIEMPRE del catálogo (el desplegable del CRON, `EVENTOS_*`, los
// productos, `MENU_MAS`, el rótulo de una condición). El texto de la pregunta es fijo y corto, en «tú».
// =============================================================================

import {
  canalDelPedido, canalDeValor, disparadorDeClave, idsDeCondiciones, normNombre, numerosEn,
  type CtxIA, type CanalIA, type DisparadorIA,
} from './flujo-ia';
import { eventosParaIA, valorEventoIA, disparadorDeValorIA, type ClaseDeEventos, type Disparador } from './disparadores';
import { NOMBRE_CANAL } from './canal-social';
import { MENU_MAS } from './flujo-conversacion';
import { condicionPorId, deValorOpcion, type AmbitoDisparo } from './condiciones-catalogo';
import { marcasDeVoseo } from './puestas-data';
import {
  TOPE_RONDAS, sanearMensaje,
  type PreguntaMako, type RespuestaMako, type OpcionPregunta, type MensajeChatMako, type SobrePregunta,
} from './automatizacion-chat';

/** Los textos de las preguntas del código (6 palabras o menos). */
export const TEXTO_PREGUNTA = {
  canal: '¿Por dónde le escribo?',
  producto: '¿De qué producto?',
  evento: '¿Qué hace la persona?',
  cron: '¿Qué la dispara?',
  condicion: '¿Qué condición uso?',
} as const satisfies Record<SobrePregunta, string>;

/** El rótulo de «Elige tú» (la respuesta con `valor: null` y sin texto). */
export const ELIGE_TU = 'Elige tú';

/** Cuántas opciones lleva una pregunta como mucho (§0: «2 a 4 opciones»). */
export const TOPE_OPCIONES_PREGUNTA = 4;

/** Lo que mira `preguntaAntes` del contexto (la API de MaKo arma sólo esto: `contextoDePreguntas`). */
export type CtxPreguntas = Pick<CtxIA, 'disparadores' | 'productos'>;

/** Sin tildes ni mayúsculas, y lo que no es letra ni número como un espacio (para buscar una frase ENTERA). */
const palabras = (s: unknown): string => normNombre(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const contiene = (texto: string, frase: string): boolean => !!frase && ` ${texto} `.includes(` ${frase} `);

// ── Los canales ──────────────────────────────────────────────────────────────────

/** Los canales por los que se le puede escribir a un lead y que esta pregunta ofrece (el email no es de esta duda). */
const CANALES_PREGUNTA: readonly CanalIA[] = ['whatsapp', 'instagram', 'messenger'];
const esCanalPregunta = (v: unknown): v is CanalIA => typeof v === 'string' && (CANALES_PREGUNTA as readonly string[]).includes(v);

/** El nombre de un canal, del catálogo: `NOMBRE_CANAL` para los sociales y la fila de `MENU_MAS` para WhatsApp. */
export function nombreDeCanal(c: CanalIA): string {
  if (c === 'instagram' || c === 'messenger') return NOMBRE_CANAL[c];
  return MENU_MAS.find((o) => o.value === (c === 'whatsapp' ? 'mensaje' : c))?.label ?? c;
}

/**
 * LOS CANALES CONECTADOS, según el desplegable del CRON (`ctx.disparadores`): Instagram y Messenger están si su sección
 * está (`opcionesCronIA` la suma SÓLO con el canal conectado). WhatsApp cuenta siempre: es el de siempre, y un flujo sin
 * canal va por ahí sin preguntar.
 */
export function canalesConectados(ctx: Pick<CtxIA, 'disparadores'>): CanalIA[] {
  return CANALES_PREGUNTA.filter((c) => c === 'whatsapp' || ctx.disparadores.some((d) => canalDeValor(d.value) === c));
}

/** La señal social DÉBIL (§2.4): no decide el canal, sólo hace preguntar. Sin tildes ni mayúsculas. */
export const SENAL_SOCIAL = /comenta|publicaci|\bposts?\b|seguid|\bdms?\b|mensaje directo|historia/;

// ── Qué hace la persona (el evento de Instagram o Messenger) ─────────────────────

/** Las palabras de cada evento (por `subtipo` de `EVENTOS_*`): si el pedido dice una, no hace falta preguntar. */
const PALABRAS_EVENTO: Readonly<Record<string, RegExp>> = {
  comentario: /coment/,
  historia: /historia|\bstor(y|ies)\b/,
  dm: /mensaje directo|\bdms?\b|\b(me|te|nos) (escrib|manda|envia)|\b(alguien|persona|usuario|lead|cliente)s? (me |te |nos )?(escrib|manda un mensaje|envia un mensaje)/,
  en_vivo: /en vivo|\blives?\b/,
  ref: /referencia|\bref\b/,
  qr: /\bqr\b/,
};

/** ¿El pedido dice qué hace la persona en ese canal? (una palabra de alguno de los eventos que ofrece el CRON) */
export function diceQueHace(pedido: string, canal: 'instagram' | 'messenger'): boolean {
  const t = normNombre(pedido);
  return eventosParaIA(canal).some((ev) => PALABRAS_EVENTO[ev.subtipo]?.test(t) ?? false);
}

// ── Lo que ya contestó ───────────────────────────────────────────────────────────

/** El pedido con lo que se escribió en «Otra cosa» (cuenta para buscar palabras: lo dijo la persona). */
function pedidoConTextos(pedido: string, respuestas: readonly RespuestaMako[]): string {
  return [pedido, ...respuestas.map((r) => r.texto?.trim() ?? '').filter(Boolean)].join('\n');
}

const respondida = (respuestas: readonly RespuestaMako[], ...sobres: SobrePregunta[]) => respuestas.some((r) => sobres.includes(r.sobre));

/** El canal que vale: el que eligió al contestar, o el que nombra el pedido (con lo de «Otra cosa»). */
function canalQueVale(pedido: string, respuestas: readonly RespuestaMako[]): CanalIA | null {
  const elegido = [...respuestas].reverse().find((r) => r.sobre === 'canal' && esCanalPregunta(r.valor));
  return elegido ? (elegido.valor as CanalIA) : canalDelPedido(pedido);
}

// ── Las preguntas del código ─────────────────────────────────────────────────────

function preguntaCanal(pedido: string, ctx: CtxPreguntas): PreguntaMako | null {
  if (canalDelPedido(pedido) || !SENAL_SOCIAL.test(normNombre(pedido))) return null;
  const conectados = canalesConectados(ctx);
  if (conectados.length < 2) return null;
  return {
    id: 'pregunta-canal', sobre: 'canal', texto: TEXTO_PREGUNTA.canal, otra: true,
    opciones: conectados.map((c) => ({ valor: c, label: nombreDeCanal(c) })),
  };
}

function preguntaEvento(pedido: string, ctx: CtxPreguntas, canal: 'instagram' | 'messenger'): PreguntaMako | null {
  if (diceQueHace(pedido, canal)) return null;
  const clase: ClaseDeEventos = canal;
  const valores = new Set(ctx.disparadores.map((d) => d.value));
  // Las 3 primeras que ofrece el CRON sin las apagadas (`eventosParaIA`), y sólo si están en el desplegable (conectado).
  const opciones: OpcionPregunta[] = eventosParaIA(clase).slice(0, 3)
    .map((ev) => ({ valor: valorEventoIA(clase, ev.subtipo), label: ev.label }))
    .filter((o) => valores.has(o.valor));
  if (opciones.length < 2) return null;
  return { id: `pregunta-evento-${canal}`, sobre: 'evento', texto: TEXTO_PREGUNTA.evento, opciones, otra: true };
}

/** El producto de una opción de kanban del CRON: `entrega:<productoId>` o el producto del embudo de `venta:<funnelId>`. */
function productoDeValor(valor: string, ctx: CtxPreguntas): number | null {
  const m = /^(venta|entrega):([^:]+):/.exec(valor);
  if (!m) return null;
  if (m[1] === 'entrega') { const n = Number(m[2]); return Number.isInteger(n) && n > 0 ? n : null; }
  return ctx.productos.find((p) => p.funnelId != null && String(p.funnelId) === m[2])?.productoId ?? null;
}

/** El nombre de la etapa de una opción del CRON («Llega a «Onboarding»» → «onboarding»), sin tildes. */
const etapaDe = (d: DisparadorIA): string => palabras(/«(.+)»$/.exec(d.corto ?? d.label)?.[1] ?? '');

function preguntaProducto(pedido: string, ctx: CtxPreguntas): PreguntaMako | null {
  const ped = palabras(pedido);
  // Etapa nombrada en el pedido → los productos que la tienen (una opción de UNA etapa: `entrega:39:onboarding`).
  const porEtapa = new Map<string, number[]>();
  for (const d of ctx.disparadores) {
    if (!/^(venta|entrega):[^:]+:[^,]+$/.test(d.value)) continue;
    const etapa = etapaDe(d);
    if (etapa.length < 3 || !contiene(ped, etapa)) continue;
    const pid = productoDeValor(d.value, ctx);
    if (pid == null) continue;
    const l = porEtapa.get(etapa) ?? [];
    if (!l.includes(pid)) l.push(pid);
    porEtapa.set(etapa, l);
  }
  for (const pids of porEtapa.values()) {
    if (pids.length < 2) continue;
    const prods = pids.map((id) => ctx.productos.find((p) => p.productoId === id)).filter((p): p is NonNullable<typeof p> => !!p && !!p.nombre.trim());
    // Si el pedido nombra uno de esos productos, no hay duda.
    if (prods.some((p) => contiene(ped, palabras(p.nombre)))) continue;
    if (prods.length < 2) continue;
    return {
      id: 'pregunta-producto', sobre: 'producto', texto: TEXTO_PREGUNTA.producto, otra: true,
      opciones: prods.slice(0, TOPE_OPCIONES_PREGUNTA).map((p) => ({ valor: String(p.productoId), label: p.nombre })),
    };
  }
  return null;
}

/**
 * LO QUE EL CÓDIGO PREGUNTA ANTES DEL MODELO (§2.4), o null. Pregunta SÓLO si el dato es decisivo:
 *   · canal: el pedido no nombra ninguno, hay 2 o más conectados (WhatsApp + Instagram y/o Messenger) y trae una señal
 *     social débil (`SENAL_SOCIAL`). Sin la señal, va por WhatsApp sin preguntar;
 *   · evento: el canal (el del pedido o el elegido) es Instagram o Messenger y el pedido no dice qué hace la persona;
 *   · producto: el pedido nombra una etapa que está en 2 o más productos y no nombra el producto (el «Onboarding» de
 *     ws10: «Fiesta Music» y «Service Delivery & Ops»). Con un canal social no se pregunta: el CRON es el evento.
 * Con `TOPE_RONDAS` respuestas, nunca más. Lo ya contestado (también con «Elige tú» u «Otra cosa») no se repite.
 */
export function preguntaAntes(pedido: string, ctx: CtxPreguntas, respuestas: readonly RespuestaMako[] = []): PreguntaMako | null {
  if (respuestas.length >= TOPE_RONDAS) return null;
  const texto = pedidoConTextos(String(pedido ?? ''), respuestas);
  // Un CRON ya elegido (evento o el del modelo) dice todo lo que estas preguntas buscan.
  if (respondida(respuestas, 'cron', 'evento')) return null;
  if (!respondida(respuestas, 'canal')) {
    const p = preguntaCanal(texto, ctx);
    if (p) return p;
  }
  const canal = canalQueVale(texto, respuestas);
  if (canal === 'instagram' || canal === 'messenger') return preguntaEvento(texto, ctx, canal);
  if (!respondida(respuestas, 'producto')) return preguntaProducto(texto, ctx);
  return null;
}

// ── La pregunta del modelo ───────────────────────────────────────────────────────

/** El error para el reintento cuando la pregunta del modelo no sirve (§2.4: «no preguntes: elige tú»). */
export const ERROR_NO_PREGUNTES = 'No preguntes: elige tú entre las opciones de las listas y devuelve el flujo completo.';

/** Un texto del modelo vale si es corto (6 palabras o menos), sin voseo; si no, el del código. */
function textoDelModelo(raw: unknown, sobre: 'cron' | 'condicion'): string {
  const t = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (!t || t.length > 60 || t.split(' ').length > 6 || marcasDeVoseo(t).length) return TEXTO_PREGUNTA[sobre];
  return t;
}

/**
 * LA `{pregunta}` QUE DEVOLVIÓ EL MODELO en vez del flujo (regla 11 del system de crear):
 *   · `cron`: claves `d3` del bloque DISPARADORES (`disparadorDeClave`, el mismo helper que resuelve el flujo), con el
 *     rótulo del desplegable y el valor del CRON;
 *   · `condicion`: ids del desplegable de condiciones con ese ámbito (`idsDeCondiciones`), con su rótulo.
 * null = el objeto no trae pregunta. `{ error }` = trae una que no sirve (menos de 2 opciones válidas, o ya se preguntó
 * `TOPE_RONDAS` veces): va al reintento. `rondas` = cuántas ya contestó la persona.
 */
export function preguntaDeIA(
  obj: unknown, ctx: Pick<CtxIA, 'disparadores' | 'catalogoCondicion'>, rondas: number,
  ambito: AmbitoDisparo | 'sin_cron' | 'cualquiera' = 'cualquiera',
): { pregunta: PreguntaMako } | { error: string } | null {
  const o = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj as Record<string, unknown> : {};
  const raw = o.pregunta;
  if (raw == null) return null;
  if (rondas >= TOPE_RONDAS) return { error: `Ya preguntaste ${TOPE_RONDAS} veces. ${ERROR_NO_PREGUNTES}` };
  const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const sobre = p.sobre === 'cron' || p.sobre === 'condicion' ? p.sobre : null;
  const claves = Array.isArray(p.opciones) ? p.opciones : [];
  const opciones: OpcionPregunta[] = [];
  const vistos = new Set<string>();
  const sumar = (o2: OpcionPregunta) => { if (!vistos.has(o2.valor)) { vistos.add(o2.valor); opciones.push(o2); } };
  if (sobre === 'cron') {
    for (const k of claves) {
      const d = disparadorDeClave(k, ctx);
      if (d) sumar({ valor: d.value, label: d.label });
    }
  } else if (sobre === 'condicion') {
    const validos = idsDeCondiciones(ambito, ctx.catalogoCondicion ?? {});
    for (const k of claves) {
      const s = typeof k === 'string' ? k.trim() : '';
      const v = deValorOpcion(s) ?? (condicionPorId(s) ? { id: s, no: false } : null);
      const def = v ? condicionPorId(v.id) : null;
      if (!v || !def || !validos.has(v.id)) continue;
      sumar({ valor: v.id, label: v.no && def.rotulo[1] ? def.rotulo[1] : def.rotulo[0] });
    }
  }
  if (!sobre || opciones.length < 2) return { error: `Tu pregunta no tenía 2 opciones de las listas. ${ERROR_NO_PREGUNTES}` };
  return {
    pregunta: {
      id: `pregunta-ia-${sobre}-${rondas + 1}`, sobre, texto: textoDelModelo(p.texto, sobre), otra: true,
      opciones: opciones.slice(0, TOPE_OPCIONES_PREGUNTA),
    },
  };
}

// ── Las respuestas: las impone el código ─────────────────────────────────────────

/** Cuántas respuestas viajan como mucho (las rondas, con aire para una de más que se ignora). */
const TOPE_RESPUESTAS = TOPE_RONDAS + 2;

/**
 * LAS RESPUESTAS DE LO QUE SEA QUE LLEGÓ (el body de la ruta, el payload de la API), con el MISMO saneador del chat
 * (`sanearMensaje`, lib/automatizacion-chat.ts): una que no se entiende se descarta. Nunca tira.
 */
export function sanearRespuestas(raw: unknown): RespuestaMako[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, TOPE_RESPUESTAS)
    .map((r) => sanearMensaje({ id: 'r', de: 'yo', via: 'app', texto: '', at: '1970-01-01T00:00:00.000Z', respuesta: r })?.respuesta ?? null)
    .filter((r): r is RespuestaMako => r != null);
}

export type Aplicadas<C extends CtxIA> = { ctx: C; pedido: string; disparadorForzado?: string };

/**
 * LO QUE CONTESTÓ, IMPUESTO POR EL CÓDIGO (§2.4):
 *   · canal → `ctx.canalElegido` (lo hace cumplir `validarIA`);
 *   · producto → `ctx.disparadores` sin los kanbans de OTROS productos (quedan `entrega:<productoId>` y
 *     `venta:<funnelId>` de ése, y lo que no es de un kanban: etiquetas y eventos);
 *   · evento o cron → `disparadorForzado` (sólo si es una opción del desplegable de hoy);
 *   · condición y «Otra cosa» → texto al final del pedido (el catálogo igual la valida);
 *   · «Elige tú» (valor null, sin texto) → nada.
 * Lo que se suma al pedido va también a `ctx.pedido` y sus números a `numerosPermitidos` (lo escribió la persona).
 */
export function aplicarRespuestas<C extends CtxIA>(ctx: C, pedido: string, respuestas: readonly RespuestaMako[]): Aplicadas<C> {
  let c: C = { ...ctx };
  let forzado: string | undefined;
  const extras: string[] = [];
  for (const r of respuestas) {
    const otra = r.texto?.trim();
    if (otra) { extras.push(otra); continue; }
    if (r.valor == null) continue;
    if (r.sobre === 'canal') {
      if (esCanalPregunta(r.valor) || r.valor === 'email') c = { ...c, canalElegido: r.valor as CanalIA };
    } else if (r.sobre === 'producto') {
      const pid = Number(r.valor);
      const prod = c.productos.find((p) => p.productoId != null && p.productoId === pid);
      if (!prod) continue;
      c = {
        ...c,
        disparadores: c.disparadores.filter((d) => {
          const m = /^(venta|entrega):([^:]+):/.exec(d.value);
          if (!m) return true;
          return m[1] === 'entrega' ? Number(m[2]) === pid : prod.funnelId != null && m[2] === String(prod.funnelId);
        }),
      };
      extras.push(`Es de «${prod.nombre}».`);
    } else if (r.sobre === 'evento' || r.sobre === 'cron') {
      const d = c.disparadores.find((x) => x.value === r.valor);
      if (!d) continue;
      forzado = d.value;
      extras.push(`Arranca cuando: «${d.label}».`);
    } else if (r.sobre === 'condicion') {
      const v = deValorOpcion(r.valor) ?? (condicionPorId(r.valor) ? { id: r.valor, no: false } : null);
      const def = v ? condicionPorId(v.id) : null;
      if (def) extras.push(`Usa la condición «${v!.no && def.rotulo[1] ? def.rotulo[1] : def.rotulo[0]}».`);
    }
  }
  const nuevo = extras.length ? `${pedido.trim()}\n${extras.join('\n')}` : pedido;
  if (extras.length) {
    c = { ...c, pedido: nuevo, numerosPermitidos: [...(c.numerosPermitidos ?? []), ...numerosEn(extras.join('\n'))] };
  }
  return { ctx: c, pedido: nuevo, ...(forzado ? { disparadorForzado: forzado } : {}) };
}

// ── Por WhatsApp (la API de MaKo): la pregunta numerada y la respuesta en palabras ─────

/**
 * LA PREGUNTA EN UNA LÍNEA, NUMERADA, para que el doer la haga en el grupo: «¿De qué producto? Responde con el número:
 * 1) Fiesta Music 2) Service Delivery & Ops 3) Elige tú». Los rótulos son los del catálogo (los mismos de la pantalla).
 */
export function preguntaParaWhatsApp(p: PreguntaMako): string {
  const ops = [...p.opciones.map((o) => o.label), ELIGE_TU].map((l, i) => `${i + 1}) ${l}`).join(' ');
  return `${p.texto} Responde con el número: ${ops}`;
}

/**
 * LO QUE CONTESTÓ EN EL GRUPO → la respuesta a esa pregunta: el número de la lista de `preguntaParaWhatsApp`, el valor o
 * el rótulo de una opción (sin tildes ni mayúsculas), o «Elige tú» (el último número también). Cualquier otra cosa es
 * «Otra cosa»: va como texto al pedido. Nunca «la opción más parecida».
 */
export function respuestaDeTexto(p: PreguntaMako, dado: string): RespuestaMako {
  const t = String(dado ?? '').trim();
  const k = normNombre(t).replace(/[.)\s]+$/, '');
  const base = { preguntaId: p.id, sobre: p.sobre };
  if (/^\d+$/.test(k)) {
    const n = Number(k);
    if (n >= 1 && n <= p.opciones.length) return { ...base, valor: p.opciones[n - 1].valor };
    if (n === p.opciones.length + 1) return { ...base, valor: null };
  }
  if (k === normNombre(ELIGE_TU) || k === 'elige' || k === 'eligelo tu') return { ...base, valor: null };
  const op = p.opciones.find((o) => o.valor === t || normNombre(o.label) === k);
  if (op) return { ...base, valor: op.valor };
  return { ...base, valor: null, texto: t.slice(0, 500) };
}

// ── Los mensajes del chat (los arma el CÓDIGO) ───────────────────────────────────

/** Un id de mensaje del chat (único de sobra: tiempo + azar; `agregarMensajes` deduplica por id). */
export function idMensajeChat(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Un mensaje del chat con su id y su hora. */
export function mensajeChat(de: 'yo' | 'mako', texto: string, via: 'app' | 'whatsapp', extra: Partial<MensajeChatMako> = {}): MensajeChatMako {
  return { id: idMensajeChat(), de, texto, at: new Date().toISOString(), via, ...extra };
}

/** El mensaje de MaKo que hace la pregunta. */
export const mensajeDePregunta = (p: PreguntaMako, via: 'app' | 'whatsapp'): MensajeChatMako => mensajeChat('mako', p.texto, via, { pregunta: p });

/** El rótulo de lo que eligió, buscado en la pregunta del historial (o su valor, si la pregunta no está). */
function rotuloDeRespuesta(r: RespuestaMako, historial: readonly MensajeChatMako[]): string {
  if (r.texto?.trim()) return r.texto.trim();
  if (r.valor == null) return ELIGE_TU;
  const p = [...historial].reverse().find((m) => m.pregunta?.id === r.preguntaId)?.pregunta;
  return p?.opciones.find((o) => o.valor === r.valor)?.label ?? r.valor;
}

/**
 * EL TURNO DE LA PERSONA: el pedido, o —si viene contestando— la ÚLTIMA respuesta con su rótulo. Si el historial ya
 * termina con ese mismo turno (el cliente lo sumó antes de mandar), devuelve null: no se escribe dos veces.
 */
export function turnoDelUsuario(pedido: string, respuestas: readonly RespuestaMako[], historial: readonly MensajeChatMako[], via: 'app' | 'whatsapp'): MensajeChatMako | null {
  const ultima = respuestas[respuestas.length - 1];
  const texto = ultima ? rotuloDeRespuesta(ultima, historial) : pedido.trim();
  if (!texto) return null;
  const ult = historial[historial.length - 1];
  if (ult?.de === 'yo' && ult.texto.trim() === texto) return null;
  return mensajeChat('yo', texto, via, ultima ? { respuesta: ultima } : {});
}

/** Lo que dice MaKo al crear: vive en lib/flujo-ia-cliente.ts (lo dibuja también el chat del lienzo). */
export { textoDeCreada } from './flujo-ia-cliente';

// ── Editar: la respuesta a «¿Cambio qué la dispara?» (sin modelo) ─────────────────

/** El valor de «Déjalo así» en la pregunta del CRON de editar (§3.4): no toca nada. */
export const VALOR_IGUAL = 'igual';

/**
 * LA RESPUESTA A «¿CAMBIO QUÉ LA DISPARA?» (§3.4), SIN MODELO (la ruta de editar no lo llama):
 *   · `'igual'` («Déjalo así») → no toca nada (`disparadores` ausente);
 *   · un valor del desplegable → `disparadorDeValorIA(valor)`, que la pantalla guarda por la acción del CRON;
 *   · «Elige tú» → la PRIMERA opción de esa pregunta (la del historial); sin la pregunta, como «Déjalo así»;
 *   · «Otra cosa» → no se adivina un CRON de un texto: se deja como está, con el aviso para elegirlo.
 */
export function respuestaDelCron(r: RespuestaMako, historial: readonly MensajeChatMako[]): { texto: string; avisos: string[]; disparadores?: Disparador[] } {
  const pregunta = [...historial].reverse().find((m) => m.pregunta?.id === r.preguntaId)?.pregunta;
  if (r.texto?.trim()) return { texto: 'Lo dejé así', avisos: ['Elige qué la dispara en el CRON'] };
  const valor = r.valor ?? pregunta?.opciones.find((o) => o.valor !== VALOR_IGUAL)?.valor ?? VALOR_IGUAL;
  if (valor === VALOR_IGUAL) return { texto: 'Lo dejé así', avisos: [] };
  const lista = disparadorDeValorIA(valor);
  if (!lista.length) return { texto: 'Esa opción ya no está en el CRON', avisos: ['Elige qué la dispara en el CRON'] };
  const label = pregunta?.opciones.find((o) => o.valor === valor)?.label;
  return { texto: label ? `Cambié qué la dispara: «${label}»` : 'Cambié qué la dispara', avisos: [], disparadores: lista };
}
