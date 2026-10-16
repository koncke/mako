// =============================================================================
// El tablero de decisiones de /admin/runway — el modelo, sin base y sin React
// =============================================================================
// Pedido de Martín (14/10/2026, vía el chat «Estrategia 3 cuentas»): «quiero que
// rediseñes esa tab para que se lea muy simple. Quiero texto grande, menos texto,
// tarjetas, etc... Quiero leerlo simple.» Y la tab cambia de trabajo: es el tablero
// donde él contesta las decisiones de TODOS los chats. Cada chat junta sus preguntas,
// «Estrategia 3 cuentas» las publica (scripts/decisiones.ts) y él contesta acá, muchas
// veces desde el teléfono (/m/decisiones dibuja lo mismo).
//
// ⚠️ SIN `server-only`, a propósito: lo importan el script que publica, la tarjeta del
// navegador y los tests. La lectura y la escritura viven en lib/admin-decisiones.ts.
//
// ⚠️ EL TEXTO QUE SE DIBUJA ES CORTO (regla de la casa, pedida tres veces): por eso los
// topes RECHAZAN al publicar en vez de recortar. Una pregunta cortada a la mitad se lee
// peor que ninguna, y el que publica es el único que la puede reescribir.
//
// ⚠️ `chat` ES UN NOMBRE, NO UNA SESIÓN (medido el 15/10/2026): «2FA», «Pricing · Strategy» o
// «Plan» no son el título de ningún chat, y dos chats pueden llamarse igual. Para que la respuesta
// le llegue sola a quien preguntó (lib/decisiones-aviso.ts), la tarjeta se publica con `destino`:
// el id de la sesión (`local_…` o `cli_…`). Sin él, el aviso sólo sale si el nombre coincide con
// el título de UN chat.

import { DESTINO_RE } from '../../../lib/operaciones-reglas';

export type Urgencia = 'bloquea' | 'cuesta' | 'criterio' | 'aviso';

/** El orden de los grupos en la pantalla, y cómo se llama cada uno. */
export const URGENCIAS: ReadonlyArray<{ clave: Urgencia; titulo: string }> = [
  { clave: 'bloquea', titulo: 'Frenan a un chat' },
  { clave: 'cuesta', titulo: 'Cuestan dinero o clientes' },
  { clave: 'criterio', titulo: 'Criterio, sin apuro' },
  // No es una decisión: algo que Martín tiene que saber. Va al final y se marca leído.
  { clave: 'aviso', titulo: 'Para saber' },
];

/** Una opción: su texto, y si el chat la explica, una descripción corta (`detalle`). En el Centro cada opción se
 *  dibuja como los renglones de AskUserQuestion de Claude Code: el título y, abajo, la descripción (16/10/2026). */
export type Opcion = { clave: string; texto: string; detalle?: string };

/** Una decisión como la lee la pantalla. */
export type Decision = {
  id: number;
  ref: string;
  chat: string;
  pregunta: string;
  opciones: Opcion[];
  destraba: string | null;
  /** Un renglón de contexto arriba de la pregunta (lo que hay que saber para contestarla). */
  contexto: string | null;
  /** La opción que recomienda el chat que pregunta, si recomienda una. */
  recomendada: string | null;
  urgencia: Urgencia;
  href: string | null;
  orden: number;
  respuesta: string | null;
  respuestaTexto: string | null;
  respondidaAt: string | null;
  recogidaAt: string | null;
  creadaAt: string;
  /** La sesión que preguntó (`local_…` / `cli_…`), si se publicó con ella. */
  destino?: string | null;
  /** El aviso de la respuesta al chat (mig 0288): a qué respuesta corresponde y cómo le fue. */
  avisoDe?: string | null;
  avisoEstado?: string | null;
  avisoAt?: string | null;
  avisoIntentos?: number;
  avisoMotivo?: string | null;
};

/** Lo que publica un chat. `ref` es la clave: republicar con la misma no duplica. */
export type Publicada = {
  ref: string;
  chat: string;
  /** La sesión que preguntó. null = no se sabe (el aviso busca un chat con ese título). */
  destino: string | null;
  pregunta: string;
  opciones: Opcion[];
  destraba: string | null;
  contexto: string | null;
  recomendada: string | null;
  urgencia: Urgencia;
  href: string | null;
  orden: number;
};

export const TOPES = { chat: 40, pregunta: 160, opcion: 100, detalle: 140, destraba: 120, contexto: 180, texto: 1000, opciones: 4 } as const;

/** Lo que contesta la lectura de la tabla: las decisiones, o por qué no se pudieron leer. */
export type LecturaDecisiones =
  | { ok: true; decisiones: Decision[] }
  | { ok: false; faltaTabla: boolean; error: string };

/** El estado de una tarjeta después de contestar (useActionState). */
export type EstadoRespuesta = { error: string | null; ok: boolean };
/**
 * La acción que guarda una respuesta. La pasa la PÁGINA como prop (app/admin/runway/acciones.ts):
 * si la tarjeta la importara, todo el que dibuja el tablero (un test incluido) arrastraría la
 * cadena hasta lib/admin-decisiones, que es `server-only`.
 */
export type AccionResponder = (prev: EstadoRespuesta, formData: FormData) => Promise<EstadoRespuesta>;

/**
 * Lo que contesta «Volver» (deshacer): la decisión queda otra vez pendiente, y si el chat ya se
 * había llevado la respuesta lo DICE —deshacer no desanda lo que el chat ya hizo con ella—.
 */
export type EstadoDeshacer = { error: string | null; ok: boolean; yaRecogida: boolean };
/** La acción que deshace una respuesta. La pasa la PÁGINA, igual que `AccionResponder`. */
export type AccionDeshacer = (formData: FormData) => Promise<EstadoDeshacer>;

/** La clave con la que se contesta en texto libre (y la única cuando no hay opciones). */
export const OTRA = 'otra';

/**
 * «Resuelta» (pedido de Martín, 14/10/2026): sale de la Ticketera SIN elegir una opción —se
 * resolvió sola, o ya no aplica—. Es una respuesta más y no un archivado, a propósito: así viaja
 * por el mismo camino que las otras y el chat que la publicó se entera (`contestadas` del script).
 */
export const RESUELTA = 'resuelta';

const URG = new Set<string>(URGENCIAS.map((u) => u.clave));
/** La forma de un `ref`. La copia el cartero (scripts/operaciones/cartero.mjs) para validar un
 *  aviso antes de escribirlo en un mensaje; tests/decisiones-aviso.test.ts compara las dos. */
export const REF_DECISION = /^[a-z0-9][a-z0-9-]{1,63}$/;
const REF = REF_DECISION;
const CLAVE = /^[A-D]$/;

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Los únicos orígenes de afuera a los que puede llevar una tarjeta (los prototipos de los chats). */
export const ORIGENES_EXTERNOS: ReadonlySet<string> = new Set(['https://claude.ai']);

/** «/algo» de MaKo (no «//otro-host», que el navegador lee como un dominio). */
export function esHrefInterno(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\');
}

/** Un https a un origen de la lista, comparado por origen (no por prefijo). */
export function esHrefExterno(href: string): boolean {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' && ORIGENES_EXTERNOS.has(u.origin) && !u.username && !u.password;
  } catch {
    return false;
  }
}

/**
 * Valida lo que publica un chat. Devuelve el motivo del rechazo en una frase, para que
 * el script lo diga y quien publica lo arregle (nada se recorta ni se inventa).
 */
export function sanearPublicada(x: unknown): { ok: true; d: Publicada } | { ok: false; motivo: string } {
  if (!x || typeof x !== 'object') return { ok: false, motivo: 'no es un objeto' };
  const o = x as Record<string, unknown>;
  const ref = txt(o.ref);
  if (!REF.test(ref)) return { ok: false, motivo: `ref inválida («${ref}»): minúsculas, números y guiones` };
  const chat = txt(o.chat);
  if (!chat || chat.length > TOPES.chat) return { ok: false, motivo: `${ref}: el chat va de 1 a ${TOPES.chat} caracteres` };
  const destino = txt(o.destino) || null;
  if (destino && !DESTINO_RE.test(destino)) {
    return { ok: false, motivo: `${ref}: el destino es el id de la sesión que pregunta («local_…» o «cli_…»)` };
  }
  const pregunta = txt(o.pregunta);
  if (!pregunta || pregunta.length > TOPES.pregunta) {
    return { ok: false, motivo: `${ref}: la pregunta va de 1 a ${TOPES.pregunta} caracteres (tiene ${pregunta.length})` };
  }
  const crudas = o.opciones == null ? [] : o.opciones;
  if (!Array.isArray(crudas)) return { ok: false, motivo: `${ref}: opciones tiene que ser una lista` };
  if (crudas.length > TOPES.opciones) return { ok: false, motivo: `${ref}: como mucho ${TOPES.opciones} opciones` };
  const opciones: Opcion[] = [];
  for (const c of crudas) {
    const clave = txt((c as Record<string, unknown>)?.clave).toUpperCase();
    const texto = txt((c as Record<string, unknown>)?.texto);
    const detalle = txt((c as Record<string, unknown>)?.detalle);
    if (!CLAVE.test(clave)) return { ok: false, motivo: `${ref}: la clave de una opción es A, B, C o D` };
    if (opciones.some((p) => p.clave === clave)) return { ok: false, motivo: `${ref}: la opción ${clave} está repetida` };
    if (!texto || texto.length > TOPES.opcion) return { ok: false, motivo: `${ref}: la opción ${clave} va de 1 a ${TOPES.opcion} caracteres` };
    if (detalle.length > TOPES.detalle) return { ok: false, motivo: `${ref}: el detalle de la opción ${clave} va hasta ${TOPES.detalle} caracteres` };
    opciones.push(detalle ? { clave, texto, detalle } : { clave, texto });
  }
  const destraba = txt(o.destraba) || null;
  if (destraba && destraba.length > TOPES.destraba) return { ok: false, motivo: `${ref}: «destraba» va hasta ${TOPES.destraba} caracteres` };
  const contexto = txt(o.contexto) || null;
  if (contexto && contexto.length > TOPES.contexto) return { ok: false, motivo: `${ref}: el contexto va hasta ${TOPES.contexto} caracteres` };
  const recomendada = txt(o.recomendada).toUpperCase() || null;
  if (recomendada && !opciones.some((p) => p.clave === recomendada)) return { ok: false, motivo: `${ref}: recomienda la opción ${recomendada}, que no está` };
  const urgencia = (txt(o.urgencia) || 'criterio') as Urgencia;
  if (!URG.has(urgencia)) return { ok: false, motivo: `${ref}: urgencia es bloquea, cuesta, criterio o aviso` };
  // ⚠️ Un camino ADENTRO de MaKo («/plan/revisar/…», se dibuja con el Link de la casa, que
  // le pega el ?ws=) o un link a un ORIGEN de la lista (un prototipo en claude.ai). Nada más:
  // un dominio cualquiera sería una puerta para mandar a Martín a cualquier lado desde un texto
  // que no escribió él. El origen se compara con `new URL().origin`, nunca con un prefijo
  // (AGENTS.md: `https://claude.ai@otro.tld` empieza igual y va a otro lado).
  let href = txt(o.href) || null;
  if (href && /^https:\/\/hola-mako\.com\//i.test(href)) href = href.replace(/^https:\/\/hola-mako\.com/i, '');
  if (href && !esHrefInterno(href) && !esHrefExterno(href)) {
    return { ok: false, motivo: `${ref}: el link va a una pantalla de MaKo («/…») o a ${[...ORIGENES_EXTERNOS].join(', ')}` };
  }
  const ordenN = o.orden == null ? 100 : Number(o.orden);
  if (!Number.isInteger(ordenN) || ordenN < 0 || ordenN > 999) return { ok: false, motivo: `${ref}: orden es un entero de 0 a 999` };
  return { ok: true, d: { ref, chat, destino, pregunta, opciones, destraba, contexto, recomendada, urgencia, href, orden: ordenN } };
}

/** La fila de `admin_decisiones` como la lee la pantalla. Lo que no cierra, se ignora. */
export function filaADecision(f: Record<string, unknown>): Decision {
  const ops = Array.isArray(f.opciones) ? f.opciones : [];
  const opciones: Opcion[] = ops
    .map((c) => {
      const o = c as Record<string, unknown>;
      const detalle = txt(o?.detalle);
      return { clave: txt(o?.clave), texto: txt(o?.texto), ...(detalle ? { detalle } : {}) };
    })
    .filter((c) => c.clave && c.texto);
  const u = txt(f.urgencia);
  return {
    id: Number(f.id),
    ref: txt(f.ref),
    chat: txt(f.chat),
    pregunta: txt(f.pregunta),
    opciones,
    destraba: txt(f.destraba) || null,
    contexto: txt(f.contexto) || null,
    recomendada: txt(f.recomendada) || null,
    urgencia: (URG.has(u) ? u : 'criterio') as Urgencia,
    href: txt(f.href) || null,
    orden: Number.isFinite(Number(f.orden)) ? Number(f.orden) : 100,
    respuesta: txt(f.respuesta) || null,
    respuestaTexto: txt(f.respuesta_texto) || null,
    respondidaAt: (f.respondida_at as string | null) ?? null,
    recogidaAt: (f.recogida_at as string | null) ?? null,
    creadaAt: String(f.creada_at ?? ''),
    destino: txt(f.destino) || null,
    avisoDe: (f.aviso_de as string | null) ?? null,
    avisoEstado: txt(f.aviso_estado) || null,
    avisoAt: (f.aviso_at as string | null) ?? null,
    avisoIntentos: Number.isInteger(Number(f.aviso_intentos)) ? Number(f.aviso_intentos) : 0,
    avisoMotivo: txt(f.aviso_motivo) || null,
  };
}

/**
 * ¿Esta respuesta vale para esta decisión? null si vale; si no, el motivo en una frase
 * corta (va a la pantalla, al lado del botón).
 */
export function motivoRespuestaInvalida(d: Pick<Decision, 'opciones'>, clave: string, texto: string): string | null {
  const t = texto.trim();
  if (t.length > TOPES.texto) return `Hasta ${TOPES.texto} caracteres`;
  if (clave === OTRA) return t ? null : 'Escribe tu respuesta';
  if (clave === RESUELTA) return null;
  return d.opciones.some((o) => o.clave === clave) ? null : 'Esa opción no existe';
}

/** Las pendientes por grupo (en el orden de URGENCIAS) y las contestadas, la última primero. */
export function repartir(ds: readonly Decision[]): {
  pendientes: Record<Urgencia, Decision[]>;
  contestadas: Decision[];
} {
  const pendientes: Record<Urgencia, Decision[]> = { bloquea: [], cuesta: [], criterio: [], aviso: [] };
  const contestadas: Decision[] = [];
  for (const d of ds) (d.respuesta ? contestadas : pendientes[d.urgencia]).push(d);
  for (const u of URGENCIAS) {
    pendientes[u.clave].sort((a, b) => a.orden - b.orden || a.creadaAt.localeCompare(b.creadaAt) || a.id - b.id);
  }
  contestadas.sort((a, b) => (b.respondidaAt ?? '').localeCompare(a.respondidaAt ?? '') || b.id - a.id);
  return { pendientes, contestadas };
}

/** Lo que se contestó, en una línea: «A · Sí» u «Otra: …». */
export function textoDeRespuesta(d: Pick<Decision, 'opciones' | 'respuesta' | 'respuestaTexto'>): string {
  if (!d.respuesta) return '';
  if (d.respuesta === OTRA) return d.respuestaTexto ?? '';
  if (d.respuesta === RESUELTA) return d.respuestaTexto ? `Resuelta: ${d.respuestaTexto}` : 'Resuelta';
  const op = d.opciones.find((o) => o.clave === d.respuesta);
  return op ? `${op.clave} · ${op.texto}` : d.respuesta;
}
