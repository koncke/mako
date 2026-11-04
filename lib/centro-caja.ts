// =============================================================================
// La caja del Ops Center: las listas mientras se escribe y el borrador que nunca se pierde (17/10/2026; puro, con test)
// =============================================================================
// Martín (feedback del 17/10, la B): las listas de Markdown en vivo («1. », «- » y «* » se vuelven lista mientras
// escribe; Enter sigue la lista y un Enter en un ítem vacío la corta), también en los mensajes que se ven; y «el borrador
// nunca se pierde»: uno por chat, guardado mientras escribe, que vuelve al abrir ese chat y se borra sólo cuando el
// mensaje SALIÓ.
//
// LA CAJA ES UN <textarea>: no hay negritas ni sangría que dibujar. «Se vuelve lista» es que el guion se cambia por la
// viñeta («• ») en el acto, y que Enter arma el ítem siguiente. Lo que SALE lleva Markdown de verdad (`textoParaMandar`:
// «• » → «- »), porque lo lee un chat de Claude Code; y la burbuja lo dibuja como lista (`bloquesDeMensaje`).
// ⚠️ SIN `server-only`: lo usan las dos pantallas y el servidor (el borrador de MaKo).

export const VINETA = '• ';
/** El texto de un trabajo que sólo lleva adjuntos (el texto firmado no puede ir vacío). La burbuja no lo dibuja: una foto
 *  sola va sin epígrafe, como en WhatsApp (Hilo.tsx). */
export const TEXTO_SOLO_ADJUNTOS = 'Te mando estos adjuntos.';
/** Lo que dice la miniatura de un documento: su extensión («PDF», «DOCX», «XLSX»). Vive acá, sin CSS, para que la burbuja
 *  del chat nuevo (ChatNuevoPiezas.tsx, que se dibuja en un test) la use como la caja (AdjuntosCaja.tsx). */
export const etiquetaDoc = (nombre: string): string => /\.([a-z0-9]{1,5})$/i.exec(nombre)?.[1]?.toUpperCase() ?? 'DOC';
const ITEM_RE = /^(\s*)(•|-|\*|(\d{1,3})[.)])\s(.*)$/;

/** El renglón donde está el cursor: dónde empieza y dónde termina. */
function renglon(t: string, i: number): { ini: number; fin: number; texto: string } {
  const ini = t.lastIndexOf('\n', i - 1) + 1;
  const f = t.indexOf('\n', i);
  const fin = f < 0 ? t.length : f;
  return { ini, fin, texto: t.slice(ini, fin) };
}

/**
 * Lo escrito, con las viñetas en vivo: un «- » o «* » al principio de un renglón pasa a «• » (el cursor se queda donde
 * estaba). Sólo el renglón donde se escribe, y sólo si recién se tipeó el espacio: pegar un texto no se toca.
 */
export function conVinetas(t: string, cursor: number): { texto: string; cursor: number } {
  const r = renglon(t, cursor);
  const m = /^(\s*)[-*] /.exec(r.texto);
  if (!m || cursor !== r.ini + m[0].length) return { texto: t, cursor };
  const nuevo = `${m[1]}${VINETA}${r.texto.slice(m[0].length)}`;
  return { texto: t.slice(0, r.ini) + nuevo + t.slice(r.fin), cursor: r.ini + m[1].length + VINETA.length };
}

/**
 * ¿AL LADO DE LA FLECHA VA TAMBIÉN EL MICRÓFONO? (ticket #51 de Leandro, 4/11/2026: «cuando adjunto una imagen ya no tengo el botón
 * de audio»). El botón de la caja es UNO (Martín, 17/10: micrófono sin nada, flecha con algo), y un adjunto lo volvía flecha: quien
 * manda una captura y la quiere explicar hablando no podía. Con lo adjuntado y NADA escrito van los dos; con texto, la flecha sola.
 */
export const micAlLadoDeLaFlecha = (e: { adjuntos: number; texto: string; hayAlgoMas?: boolean }): boolean =>
  e.adjuntos > 0 && !e.texto.trim() && !e.hayAlgoMas;

/**
 * Enter dentro de una lista: sigue con el ítem siguiente («• » o el número que sigue); en un ítem VACÍO, corta la lista
 * (le saca la viñeta). null = el renglón no es de una lista: Enter hace lo de siempre (manda).
 * `conUno: false` (la computadora, donde Enter manda): con UN solo ítem que es una PREGUNTA, Enter manda. «1. ¿Cuántos
 * leads entraron ayer?» es un mensaje: hacían falta tres Enter (revisión del 21/10/2026). Cualquier otro ítem sigue la
 * lista, como pidió Martín el 17/10 («Enter sigue la lista»): «- Llamar a Ana» y Enter es el ítem siguiente (la segunda
 * revisión: con «un solo ítem manda», no se podía empezar una lista).
 */
export function enterEnLista(t: string, ini: number, fin: number, { conUno = true }: { conUno?: boolean } = {}): { texto: string; cursor: number } | null {
  if (ini !== fin) return null;
  const r = renglon(t, ini);
  const m = ITEM_RE.exec(r.texto);
  if (!m) return null;
  const [, sangria, marca, num, resto] = m;
  if (!resto.trim() && ini === r.fin) {
    // Ítem vacío: se corta la lista y el renglón queda en blanco.
    return { texto: t.slice(0, r.ini) + t.slice(r.fin), cursor: r.ini };
  }
  if (!conUno && /[?]\s*$/.test(resto) && t.split('\n').filter((l) => { const x = ITEM_RE.exec(l); return !!x && !!x[4].trim(); }).length < 2) return null;
  const siguiente = num != null ? `${Number(num) + 1}${marca.slice(-1)} ` : marca === '•' ? VINETA : `${marca} `;
  const inserto = `\n${sangria}${siguiente}`;
  return { texto: t.slice(0, ini) + inserto + t.slice(ini), cursor: ini + inserto.length };
}

/** Lo que sale de la caja: las viñetas de la pantalla, como Markdown de verdad. */
export const textoParaMandar = (t: string): string => t.replace(/^(\s*)• /gm, '$1- ').trim();

/** `marcas`: la marca de cada ítem TAL CUAL la escribió Martín («3.», «7)», «-», «•»). Una lista numerada se dibuja con
 *  SUS números (17/10/2026, Martín: «envié un mensaje con numeración y no salió con mi numeración»): un <ol> renumera
 *  desde 1, y con un renglón en el medio cada tramo volvía a empezar en 1. WhatsApp muestra lo que se escribió. */
export type BloqueMensaje = { tipo: 'parrafo'; texto: string } | { tipo: 'lista'; numerada: boolean; items: string[]; marcas: string[] };

/** Lo que dice una burbuja, en párrafos y listas (para dibujar «1. » y «- » como lista, como Claude). */
export function bloquesDeMensaje(t: string): BloqueMensaje[] {
  const out: BloqueMensaje[] = [];
  for (const linea of t.replace(/\r\n?/g, '\n').split('\n')) {
    const m = ITEM_RE.exec(linea);
    const ultimo = out[out.length - 1];
    if (m) {
      const numerada = m[3] != null;
      if (ultimo?.tipo === 'lista' && ultimo.numerada === numerada) { ultimo.items.push(m[4]); ultimo.marcas.push(m[2]); }
      else out.push({ tipo: 'lista', numerada, items: [m[4]], marcas: [m[2]] });
    } else if (ultimo?.tipo === 'parrafo') {
      ultimo.texto += `\n${linea}`;
    } else {
      out.push({ tipo: 'parrafo', texto: linea });
    }
  }
  return out
    .map((b) => (b.tipo === 'parrafo' ? { ...b, texto: b.texto.replace(/^\n+|\n+$/g, '') } : b))
    .filter((b) => b.tipo === 'lista' || b.texto !== '');
}

// ── El borrador (B, «el borrador nunca se pierde») ───────────────────────────────────────────────────────────────
/** Lo más largo que se guarda de un borrador (lo que entra en un trabajo firmado). */
/**
 * El alto del campo, a partir de lo que mide (`scrollHeight`) y su tope. ⚠️ ESCONDIDO MIDE 0 (23/10/2026): el chat del lienzo de
 * Automations vive montado en una ranura con `display: none` y la caja se medía ahí; quedaba `height: 0px`, el mínimo del CSS
 * (24 px) le ganaba, y con un renglón de 40 px el texto («Pídele un cambio») se veía abajo, cortado y con flechas de scroll.
 * Sin medida, el alto es del CSS (un renglón con su relleno); al aparecer se vuelve a medir (CajaChat.tsx).
 */
export const altoDelCampo = (medido: number, tope: number): string => (medido > 0 ? `${Math.min(medido, tope)}px` : '');

export const MAX_BORRADOR = 8000;
/** Cuánto espera sin teclear para guardarlo en el navegador, y en MaKo (que cruza al teléfono). */
export const ESPERA_LOCAL_MS = 400;
export const ESPERA_REMOTA_MS = 2000;

export type Borrador = { texto: string; at: number };

/** La clave del borrador de un chat: su sesión (no cambia al renombrarlo), o su clave si no tiene. */
export const claveDeBorrador = (direccion: string) => `centro.borrador.${direccion}`;

/** Un borrador guardado, validado. null = no hay, o no vale. */
export function leerBorrador(x: unknown): Borrador | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.texto !== 'string' || typeof o.at !== 'number' || !Number.isFinite(o.at)) return null;
  return { texto: o.texto.slice(0, MAX_BORRADOR), at: o.at };
}

/** Entre el del navegador y el de MaKo, el más NUEVO. Uno vacío más nuevo gana: es que se mandó (o se borró) en otro lado. */
export function borradorQueVale(local: Borrador | null, remoto: Borrador | null): Borrador | null {
  if (!local) return remoto;
  if (!remoto) return local;
  return remoto.at > local.at ? remoto : local;
}

// ── El scroll sigue a lo que se escribe (18/10/2026) ─────────────────────────────────────────────────────────────
// Martín: «Si escribo hacia abajo con saltos de línea, la caja crece y el chat no lo acompaña». Dos cosas lo rompían: la
// conversación de arriba se achica cuando la caja crece (y lo último queda tapado), y el `height = 'auto'` con que la
// caja se mide cada vez le reseteaba su propio scroll. Se mide ANTES de crecer: si estaba abajo, se la deja abajo.

/** Lo que mide una caja que scrollea. */
export type Scroll = { scrollHeight: number; scrollTop: number; clientHeight: number };
/** ¿Está abajo del todo (con un margen de unos renglones)? */
export const estaAbajo = (s: Scroll, margen = 48): boolean => s.scrollHeight - s.scrollTop - s.clientHeight <= margen;

/**
 * ¿Lo que se manda es ESA nota de voz (26/10/2026)? Sólo si la caja dice lo mismo que se transcribió
 * (app/_chat/nota-que-se-manda.ts → onNota): si dice otra cosa, o la nota es de antes, lo que sale es texto. Pura (test).
 */
export function notaQueSale<N extends { texto: string }>(nota: N | null | undefined, borrador: string): N | null {
  return nota && nota.texto.trim() && nota.texto.trim() === borrador.trim() ? nota : null;
}
