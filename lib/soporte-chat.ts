// =============================================================================
// El chat de Soporte: la Ticketera del cliente como una conversación con MaKo (23/10/2026)
// =============================================================================
// Martín (22/10/2026): «Mira la ticketera, se ve bastante feo... Cuando podría tener el mismo diseño que un chat y que los
// usuarios le comenten a MaKo cual fue su problema... ese debe ser la principal funcionalidad». Antes era un formulario
// (tres tipos y un campo). Ahora la persona CUENTA qué pasó, MaKo repregunta LO JUSTO (como mucho tres cosas, y sólo lo que
// falta) y arma el ticket con lo que dijo; ella lo manda con un toque. Cada conversación termina en un ticket, y la de un
// ticket ya mandado es su conversación con el equipo (app/tickets/soporte/).
//
// ⚠️ SIN IA, A PROPÓSITO. Las repreguntas son reglas: el triage no paga un modelo (lib/tickets-reglas.ts, «Por qué el triage
//    no paga un modelo»), lo que no anda puede ser justamente la IA del negocio (con la del negocio caída, Soporte tiene que
//    andar igual), y lo que la persona cuenta de su negocio no viaja a ningún proveedor.
// ⚠️ EL TIPO LO LEE EL MISMO TRIAGE (`clasificar`) que lo va a leer en el servidor: dos lecturas de las mismas palabras no
//    pueden decir cosas distintas.
// ⚠️ PURO (sin React ni red): lo usan la pantalla de la computadora, la del teléfono y los tests.

import { TIPOS, TOPES, clasificar, sanearContexto, tituloDe, type ContextoTicket, type TipoTicket } from './tickets-reglas';

/** Lo que MaKo puede repreguntar: que cuente más, dónde le pasó y si le pasa siempre. */
export type ClavePregunta = 'mas' | 'donde' | 'cuando';

/** La conversación de un ticket nuevo: lo que contó, lo que contestó a cada repregunta y qué se le preguntó, en orden. */
export type Charla = {
  relato: readonly string[];
  respuestas: Readonly<Partial<Record<ClavePregunta, string>>>;
  preguntadas: readonly ClavePregunta[];
};
export const CHARLA_VACIA: Charla = { relato: [], respuestas: {}, preguntadas: [] };

export const SALUDO = 'Hola, soy MaKo. Cuéntame qué pasó o qué necesitas: lo armo como un ticket y se lo paso al equipo.';
/** Las partes de MaKo para «¿dónde te pasó?»: las tabs que más se usan, y la salida. */
export const LUGARES = ['CRM', 'WhatsApp', 'Dashboard', 'Automations', 'Web Generator', 'Otra parte'] as const;
export const FRECUENCIAS = ['Siempre que lo intento', 'A veces', 'Fue una vez'] as const;

const PREGUNTAS: Record<ClavePregunta, { texto: string; opciones?: readonly string[] }> = {
  mas: { texto: '¿Me cuentas un poco más? Qué intentaste hacer y qué viste.' },
  donde: { texto: '¿En qué parte de MaKo te pasó?', opciones: LUGARES },
  cuando: { texto: '¿Te pasa siempre o fue una vez?', opciones: FRECUENCIAS },
};

/** El ticket que se va a mandar: el tipo que leyó el triage, el título y todo lo que contó. */
export type Borrador = { tipo: TipoTicket; titulo: string; descripcion: string };
export type Paso =
  | { k: 'pregunta'; clave: ClavePregunta; texto: string; opciones?: readonly string[] }
  | { k: 'ticket'; texto: string; borrador: Borrador };

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Menos que esto no alcanza para entender qué pasó («no anda», «error»). */
const PALABRAS_MINIMAS = 5;
/** Ya dijo dónde: el nombre de una tab o de algo que vive en una. */
const NOMBRA_LUGAR = /\b(crm|whatsapp|dashboard|general|automat\w*|web generator|landing\w*|pagina\w*|image editor|imagen\w*|video\w*|ads\w*|anuncio\w*|campan\w*|calendar\w*|agenda|offer|oferta\w*|plan|ops center|chat\w*|integracion\w*|ajustes|perfil|login|entrar|lead\w*|etapa\w*|reporte\w*|grafico\w*|metrica\w*|meta|instagram|facebook|google|correo|email|mail|ticket\w*|equipo|pago\w*|cobr\w*|factura\w*)\b/;

/** La repregunta que espera respuesta (la última que se hizo sin contestar), o null. */
export function pendiente(c: Charla): ClavePregunta | null {
  return c.preguntadas.find((k) => c.respuestas[k] == null) ?? null;
}

/** Lo que escribió la persona: contesta la repregunta que espera o, si no hay ninguna, suma a lo que cuenta. */
export function sumar(c: Charla, texto: string): Charla {
  const t = texto.trim();
  if (!t) return c;
  const p = pendiente(c);
  if (!p) return { ...c, relato: [...c.relato, t] };
  // «Cuéntame más» es más relato: va con lo que contó, no aparte.
  return { ...c, respuestas: { ...c.respuestas, [p]: t }, relato: p === 'mas' ? [...c.relato, t] : c.relato };
}

/** Marca que MaKo hizo una repregunta (para no repetirla). */
export function preguntar(c: Charla, clave: ClavePregunta): Charla {
  return c.preguntadas.includes(clave) ? c : { ...c, preguntadas: [...c.preguntadas, clave] };
}

const palabras = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** El ticket con lo que contó: el tipo lo lee el triage; el título, la primera oración. */
export function borradorDe(c: Charla): Borrador {
  const contado = c.relato.join('\n\n').trim();
  const extra = [
    c.respuestas.donde ? `Dónde: ${c.respuestas.donde}` : '',
    c.respuestas.cuando ? `Cuándo pasa: ${c.respuestas.cuando}` : '',
  ].filter(Boolean).join('\n');
  const descripcion = extra ? `${contado}\n\n${extra}` : contado;
  const titulo = tituloDe(contado);
  const tipo = clasificar({ tipoDeclarado: null, declaradoPor: null, titulo, descripcion, contexto: {} }).tipo;
  return { tipo, titulo, descripcion };
}

const AL_ARMAR: Record<TipoTicket, string> = {
  bug: 'Listo, esto es lo que le paso al equipo. Si quieres sumar algo, escríbelo antes de mandarlo.',
  pedido: 'Lo anoto como un pedido para el equipo. Si quieres sumar algo, escríbelo antes de mandarlo.',
  pregunta: 'Se la paso al equipo. Si quieres sumar algo, escríbelo antes de mandarlo.',
};

/**
 * Qué dice MaKo ahora: la próxima repregunta que hace falta, o el ticket armado. null = todavía no contó nada (va el saludo).
 * LO JUSTO: «cuéntame más» sólo si lo que contó es muy corto; dónde y si pasa siempre, sólo para algo que no anda, y «dónde»
 * sólo si no lo nombró. Cada una se hace UNA vez: lo que contesta, vale.
 */
export function queSigue(c: Charla): Paso | null {
  if (!c.relato.length) return null;
  const p = pendiente(c);
  if (p) return { k: 'pregunta', clave: p, ...PREGUNTAS[p] };
  const hecha = (k: ClavePregunta) => c.preguntadas.includes(k);
  const contado = c.relato.join(' ');
  if (palabras(contado) < PALABRAS_MINIMAS && !hecha('mas')) return { k: 'pregunta', clave: 'mas', ...PREGUNTAS.mas };
  const b = borradorDe(c);
  if (b.tipo === 'bug') {
    if (!hecha('donde') && !NOMBRA_LUGAR.test(norm(contado))) return { k: 'pregunta', clave: 'donde', ...PREGUNTAS.donde };
    if (!hecha('cuando')) return { k: 'pregunta', clave: 'cuando', ...PREGUNTAS.cuando };
  }
  return { k: 'ticket', texto: AL_ARMAR[b.tipo], borrador: b };
}

/**
 * El contexto del ticket del chat, armado en el SERVIDOR (la revisión de Integración, 23/10/2026): de lo que manda el navegador,
 * sólo lo que el navegador sabe de sí (la pantalla, el navegador, la zona, el idioma y la hora). La acción es una server action:
 * se la puede llamar a mano con cualquier argumento, y lo demás del contexto NO es del navegador:
 *   · `chat.hilo` dice en qué chat se avisa la respuesta (lib/tickets-cierre.ts → `avisarUno`): apuntado a la sesión de MaKo
 *     del dueño, la respuesta de Martín quedaba en SU chat como si la dijera MaKo, y el modelo la leía en el turno siguiente;
 *   · `error` y `herramienta` el triage los lee como lo que vio fallar el sistema (arreglo automático);
 *   · `ruta` y `noExiste` también cambian el triage.
 */
export function contextoDeSoporte(delNavegador: unknown, movil: boolean): ContextoTicket {
  const c = sanearContexto(delNavegador);
  return {
    chat: { donde: movil ? 'soporte-movil' : 'soporte' },
    ...(c.navegador ? { navegador: c.navegador } : {}), ...(c.pantalla ? { pantalla: c.pantalla } : {}),
    ...(c.zona ? { zona: c.zona } : {}), ...(c.idioma ? { idioma: c.idioma } : {}), ...(c.hora ? { hora: c.hora } : {}),
  };
}

/** El tipo con las palabras de la pantalla (las mismas del formulario y de la bandeja de Martín). */
export const rotuloTipo = (t: TipoTicket): string => TIPOS.find((x) => x.clave === t)?.rotulo ?? t;

/** El borrador se puede mandar: el servidor rechaza un detalle más largo que el tope (no lo recorta). */
export const borradorValido = (b: Borrador): string | null =>
  !b.descripcion.trim() ? 'Cuéntame qué pasó' : b.descripcion.length > TOPES.descripcion ? `Acórtalo a ${TOPES.descripcion} caracteres` : null;
