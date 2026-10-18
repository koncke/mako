// =============================================================================
// «Nuevo chat» SIN modal: con el primer mensaje, MaKo decide dónde va y cómo se llama (17/10/2026; puro, con test)
// =============================================================================
// Martín (22:50): «Nuevo chat jamás debe abrir un modal, eso es lo más contraintuitivo y contra IA que existe... Que simplemente
// abra el chat y que el usuario al comenzar a escribir la IA vaya entendiendo dónde lo debe colocar, si debe ser un jefe o un
// empleado, qué nombre ponerle, etc.». Antes pedía nombre y cuenta en un formulario ANTES de poder escribir.
//
// Las convenciones que se respetan (memoria chat-jefe-por-tab, lib/centro-chats.ts → `partesDelNombre`):
//   · el JEFE se llama EXACTO como la tab («CRM», «Automations»); es uno por tab y lo deciden los jefes, no Martín;
//   · un EMPLEADO (sub-chat) se llama «<Jefe> › <Sub>» y cuelga de su jefe;
//   · si el jefe o el empleado YA existen, no se crea otro: el mensaje va a ese chat (nunca duplicar);
//   · el Cerebro y el Runner no son destinos de un tema nuevo.
//
// ⚠️ La IA SUGIERE y este módulo VALIDA: lo que la IA contesta nunca llega a un trabajo firmado sin pasar por `decisionDeRespuesta`
// (el nombre entra por la lista blanca de `problemaDeNombreNuevo`, que es la que verifica la PC). Y si la IA no contesta, decide
// `decisionPorReglas`: el nombre de una tab que aparezca en el mensaje, o las primeras palabras. Sin ninguna de las dos, igual hay
// un chat: nunca se le pregunta a Martín.
// ⚠️ SIN `server-only`: lo usan el servidor (la acción), la pantalla (el respaldo si la acción falla) y los tests.

import { MAX_NOMBRE_NUEVO, problemaDeNombreNuevo } from './operaciones-reglas';
import { SEPARADOR_JEFE, esCerebro, esChatDelRunner, partesDelNombre } from './centro-chats';

export type AccionChatNuevo = 'existente' | 'empleado' | 'jefe';
/** Dónde va el mensaje: a un chat que ya existe (`clave`), a un empleado nuevo de un jefe, o a un jefe nuevo. */
export type DecisionChatNuevo = {
  accion: AccionChatNuevo;
  /** El nombre con el que se abre (o el que ya tiene el chat existente). */
  nombre: string;
  /** El jefe al que pertenece (el nombre de la tab), o null si es un jefe nuevo sin tab. */
  jefe: string | null;
  /** La clave del chat existente (`existente`). */
  clave: string | null;
  /** Quién lo decidió: la IA barata, o las reglas (sin IA o con una respuesta que no valía). */
  origen: 'ia' | 'reglas';
};
/** Lo que hace falta saber para decidir: las tabs (los jefes posibles) y los chats que hoy existen. */
export type ContextoChatNuevo = { tabs: readonly string[]; chats: ReadonlyArray<{ clave: string; titulo: string }> };

const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const SEPARADOR = /\s*[›>]\s*/;

/** Un nombre que la PC acepta (lista blanca de `NOMBRE_NUEVO_RE`): sin comillas, signos raros ni emojis, de hasta 80. null = nada. */
export function limpiarNombre(s: string): string | null {
  const t = s
    .replace(/https?:\/\/\S+/gi, ' ')
    // Sólo lo que la lista blanca de la PC deja pasar (`NOMBRE_NUEVO_RE`): lo demás se vuelve un espacio.
    .replace(/[^\p{L}\p{M}\p{N} ›>\-_.,()+:]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .slice(0, MAX_NOMBRE_NUEVO)
    .trim();
  return t && !problemaDeNombreNuevo(t) ? t : null;
}

/** Los chats que pueden recibir un tema nuevo: ni el Cerebro ni el Runner. */
const candidatos = (ctx: ContextoChatNuevo) => ctx.chats.filter((c) => !esCerebro(c.titulo) && !esChatDelRunner({ titulo: c.titulo }));

/** Los jefes posibles, con su nombre «oficial»: las tabs y el jefe de cada chat que ya existe. */
export function jefesConocidos(ctx: ContextoChatNuevo): string[] {
  const por = new Map<string, string>();
  for (const t of ctx.tabs) if (t.trim() && !por.has(normal(t))) por.set(normal(t), t.trim());
  for (const c of candidatos(ctx)) {
    const j = partesDelNombre(c.titulo).jefe;
    if (j && !por.has(normal(j))) por.set(normal(j), j);
  }
  return [...por.values()];
}

const chatLlamado = (titulo: string, ctx: ContextoChatNuevo) => candidatos(ctx).find((c) => normal(c.titulo) === normal(titulo)) ?? null;
const jefeLlamado = (nombre: string, ctx: ContextoChatNuevo) => jefesConocidos(ctx).find((j) => normal(j) === normal(nombre)) ?? null;

const comoExistente = (c: { clave: string; titulo: string }, origen: DecisionChatNuevo['origen']): DecisionChatNuevo =>
  ({ accion: 'existente', nombre: c.titulo, jefe: partesDelNombre(c.titulo).jefe, clave: c.clave, origen });

/**
 * Lo que contestó la IA, validado: `{ accion, jefe, sub }` (o `nombre`). null = no vale (se decide por reglas). Un jefe o un
 * empleado que ya existen NO se crean otra vez: la decisión pasa a `existente` con el chat que ya está.
 */
export function decisionDeRespuesta(raw: unknown, ctx: ContextoChatNuevo): DecisionChatNuevo | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const accion = texto(o.accion).toLowerCase();
  const jefeDicho = limpiarNombre(texto(o.jefe));
  const jefe = jefeDicho ? jefeLlamado(jefeDicho, ctx) ?? jefeDicho : null;
  const sub = limpiarNombre(texto(o.sub).split(SEPARADOR).pop() ?? '') ?? limpiarNombre(texto(o.nombre).split(SEPARADOR).slice(1).join(SEPARADOR_JEFE));
  if (accion === 'existente') {
    const c = chatLlamado(texto(o.nombre), ctx) ?? (jefe ? chatLlamado(sub ? `${jefe}${SEPARADOR_JEFE}${sub}` : jefe, ctx) : null);
    return c ? comoExistente(c, 'ia') : null;
  }
  if (accion === 'empleado') {
    if (!jefe || !sub) return null;
    const nombre = limpiarNombre(`${jefe}${SEPARADOR_JEFE}${sub}`);
    if (!nombre) return null;
    const ya = chatLlamado(nombre, ctx);
    if (ya) return comoExistente(ya, 'ia');
    // Un empleado sin su jefe abierto igual cuelga de él: el jefe puede no existir todavía como chat.
    return { accion: 'empleado', nombre, jefe, clave: null, origen: 'ia' };
  }
  if (accion === 'jefe') {
    const nombre = limpiarNombre(jefe ?? texto(o.nombre));
    if (!nombre) return null;
    const ya = chatLlamado(nombre, ctx);
    if (ya) return comoExistente(ya, 'ia');
    return { accion: 'jefe', nombre, jefe: jefeLlamado(nombre, ctx) ? nombre : null, clave: null, origen: 'ia' };
  }
  return null;
}

/** Las primeras palabras de un mensaje como nombre de chat («Arreglar el filtro del CRM» → «Arreglar el filtro del CRM»). */
export function nombreDeTexto(texto: string): string {
  const palabras = texto.split('\n').map((l) => l.trim()).find(Boolean)?.split(/\s+/) ?? [];
  const nombre = limpiarNombre(palabras.slice(0, 5).join(' ')) ?? 'Chat nuevo';
  return nombre[0].toLocaleUpperCase('es') + nombre.slice(1);
}

/**
 * SIN IA: el jefe cuyo nombre aparece en el mensaje (el más largo gana: «Ads Manager» antes que «Ads») y, si no hay ninguno, un
 * jefe nuevo con las primeras palabras. Si ese jefe ya tiene su chat, el mensaje va a él.
 */
export function decisionPorReglas(texto: string, ctx: ContextoChatNuevo): DecisionChatNuevo {
  const t = ` ${normal(texto)} `;
  const mencionado = jefesConocidos(ctx)
    .filter((j) => normal(j).length >= 3 && t.includes(` ${normal(j)} `))
    .sort((a, b) => b.length - a.length)[0];
  if (mencionado) {
    const chat = chatLlamado(mencionado, ctx);
    if (chat) return comoExistente(chat, 'reglas');
    return { accion: 'jefe', nombre: mencionado, jefe: mencionado, clave: null, origen: 'reglas' };
  }
  return { accion: 'jefe', nombre: nombreDeTexto(texto), jefe: null, clave: null, origen: 'reglas' };
}

/** El mensaje para la IA barata: qué decidir, con qué lista de jefes y chats, y la forma exacta de la respuesta. */
export function promptChatNuevo(texto: string, ctx: ContextoChatNuevo): { system: string; user: string } {
  const jefes = jefesConocidos(ctx);
  const chats = candidatos(ctx).map((c) => c.titulo).slice(0, 120);
  return {
    system: [
      'Eres quien ordena los chats de trabajo de Martín, el dueño de MaKo. Te llega el PRIMER mensaje de un chat nuevo y decides dónde va. No preguntas nada.',
      'Reglas:',
      '- Un JEFE se llama exactamente como una tab de MaKo (por ejemplo «CRM», «Automations», «Video Editor»). Hay uno por tab.',
      '- Un EMPLEADO es un chat de un tema más chico DENTRO de un jefe, y se llama «<Jefe> › <Tema corto>» (por ejemplo «CRM › Funnels»).',
      '- Si ya existe un chat donde este mensaje encaja (el jefe de esa tab o el empleado de ese tema), usa la acción "existente" con su nombre EXACTO. No crees uno parecido.',
      '- Si es un tema nuevo dentro de una tab que ya tiene jefe, usa "empleado". Si es de una tab nueva o de nada que ya exista, usa "jefe".',
      '- El nombre es corto (hasta 5 palabras), sin signos raros, y no repite el mensaje.',
      'Contesta SOLO un JSON: {"accion":"existente"|"empleado"|"jefe","jefe":"<tab>","sub":"<tema corto, sólo para empleado>","nombre":"<nombre exacto del chat existente, sólo para existente>"}',
    ].join('\n'),
    user: [
      `Mensaje de Martín:\n${texto.slice(0, 1500)}`,
      `\nJefes posibles (las tabs): ${jefes.slice(0, 150).join(', ') || '(ninguno)'}`,
      `\nChats que ya existen: ${chats.join(' | ') || '(ninguno)'}`,
    ].join('\n'),
  };
}

/** Cómo se dice, en una frase de pantalla, lo que se decidió (la cabecera y la nota del chat). */
export function frasePorDonde(d: DecisionChatNuevo): string {
  if (d.accion === 'existente') return `Se lo mando a «${d.nombre}»`;
  if (d.accion === 'empleado') return `Lo abro como «${d.nombre}», debajo de ${d.jefe}`;
  return d.jefe ? `Lo abro como el jefe de ${d.jefe}` : `Lo abro como «${d.nombre}»`;
}

/** La cuenta donde se abre el chat nuevo: de las que pueden abrir, la que menos gastó en la semana (sin dato, como a la mitad). */
export function cuentaParaChatNuevo(posibles: readonly string[], semanaPct: (cuenta: string) => number | null): string | null {
  return [...posibles].sort((a, b) => (semanaPct(a) ?? 50) - (semanaPct(b) ?? 50))[0] ?? null;
}

/** La decisión de un nombre que escribió Martín: si ya hay un chat así va a él; con «›» es un empleado de ese jefe; si no, un jefe. */
export function decisionConNombre(nombreEscrito: string, ctx: ContextoChatNuevo): DecisionChatNuevo {
  const nombre = nombreEscrito.replace(/\s*>\s*/g, SEPARADOR_JEFE).replace(/\s*›\s*/g, SEPARADOR_JEFE).trim();
  const ya = chatLlamado(nombre, ctx);
  if (ya) return comoExistente(ya, 'reglas');
  const { jefe, sub } = partesDelNombre(nombre);
  if (sub) return { accion: 'empleado', nombre, jefe: jefeLlamado(jefe, ctx) ?? jefe, clave: null, origen: 'reglas' };
  return { accion: 'jefe', nombre, jefe: jefeLlamado(nombre, ctx) ? nombre : null, clave: null, origen: 'reglas' };
}
