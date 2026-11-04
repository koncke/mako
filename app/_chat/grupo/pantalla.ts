// =============================================================================
// El grupo de la app en la pantalla: las decisiones, puras (3/11/2026)
// =============================================================================
// Martín: «la funcionalidad de grupos, tipo grupos de WhatsApp dentro del Ops Center... que esté posicionado arriba». Lo que el hilo y la lista
// deciden sin React ni servidor: qué se ve según el rol, cómo un mensaje del servidor se vuelve una fila del hilo único (HiloMako) y qué dice
// la lista. tests/grupos-ops-pantalla.test.ts.
//
// ⚠️ LO QUE PUEDE CADA UNO LO DICE EL SERVIDOR (`administra`, `invitado`: lib/grupo-puerta.ts) y acá sólo se esconde lo que igual daría 404:
// esconder no es la puerta. Sólo tipos de lib/grupo-reglas.ts: ese módulo no tiene que viajar al navegador.
// =============================================================================

import { idWA, type ArchivoHilo, type ItemHilo } from '@/app/m/mako/chat-ui';
import { renglonDeCita, type Cita, type IdMensaje } from '@/lib/centro-mensajes';
import { edadCorta } from '@/lib/chat-mako-reglas';
import type { MensajeDelHilo } from '@/lib/grupo-reglas';

/** Una fila de GET /api/grupos. */
export type GrupoDeLaLista = {
  ws: number; administra: boolean; invitado: boolean; titulo: string;
  ultimo: MensajeDelHilo | null; noLeidos: number; hastaId: number;
};
/** Una página de GET /api/grupos/[ws]/mensajes. */
export type PaginaDelGrupo = { mensajes: MensajeDelHilo[]; hayMas: boolean; cursor: number; makoPensando: boolean };
/** Lo de GET /api/grupos/[ws]/whatsapp: se lee, no se copia, y no tiene autor. */
export type MensajeDeWhatsApp = { rol: 'user' | 'assistant'; texto: string; creadoEn: string };

/** Lo que se ve según quién entró. */
export type QuePuede = { invitar: boolean; sacar: boolean; salir: boolean; verWhatsApp: boolean };
/**
 * Invitar y sacar: quien administra. Salir: sólo quien entró invitado (quien entra por su rol no tiene de dónde salir). Lo anterior de WhatsApp: todos
 * menos un invitado, que ve desde que entró. Sin saber quién es, lo mínimo.
 */
export const quePuede = (g: Pick<GrupoDeLaLista, 'administra' | 'invitado'> | null | undefined): QuePuede => ({
  invitar: g?.administra === true, sacar: g?.administra === true, salir: g?.invitado === true, verWhatsApp: g != null && !g.invitado,
});

/** Cuántos grupos se ven antes de «Ver N grupos más»: una agencia puede tener decenas. */
export const GRUPOS_VISIBLES = 3;

/** Los que se dibujan: los primeros y el abierto, en el orden que da el servidor (el de la pestaña primero). */
export function filasVisibles<T extends { ws: number }>(grupos: readonly T[], o: { todos: boolean; abierto: number | null }): { visibles: T[]; resto: number } {
  if (o.todos || grupos.length <= GRUPOS_VISIBLES) return { visibles: [...grupos], resto: 0 };
  const visibles = grupos.filter((g, i) => i < GRUPOS_VISIBLES || g.ws === o.abierto);
  return { visibles, resto: grupos.length - visibles.length };
}

/** Un texto en un renglón, sin las marcas de WhatsApp. */
const unRenglon = (t: string): string => t.replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();

const QUE_ES_EL_ARCHIVO: Record<string, string> = { audio: 'Nota de voz', imagen: 'Foto', pdf: 'PDF' };

/**
 * El segundo renglón de la fila: quién y qué, como en la lista de WhatsApp. Nunca «Espera tu respuesta», que es sólo de una pregunta abierta (22/10).
 * Sin mensajes, para quien entra por primera vez la invitación.
 */
export function previaDelGrupo(g: Pick<GrupoDeLaLista, 'ultimo' | 'invitado'>): string {
  const u = g.ultimo;
  if (!u) return g.invitado ? 'Te invitaron a este grupo' : 'Aquí caen los avisos de MaKo';
  const texto = unRenglon(u.texto) || QUE_ES_EL_ARCHIVO[u.adjunto?.tipo ?? ''] || '';
  if (u.autor.tipo === 'sistema') return texto;
  return `${u.autor.propio ? 'Tú' : u.autor.tipo === 'mako' ? 'MaKo' : u.autor.nombre}: ${texto}`.slice(0, 160);
}

/** Cuándo fue lo último. */
export const edadDelGrupo = (g: Pick<GrupoDeLaLista, 'ultimo'>, ahora: number): string => {
  const t = g.ultimo ? Date.parse(g.ultimo.creadoEn) : NaN;
  return Number.isFinite(t) ? edadCorta(t, ahora) : '';
};

/** Sobre 99, «99+». Cero no se dibuja. */
export const noLeidosEnFila = (n: number): string | null => (n > 0 ? (n > 99 ? '99+' : String(n)) : null);

/**
 * El `*negrita*` con que MaKo escribe para WhatsApp, en el Markdown del hilo: con un asterisco se leería cursiva. Sólo cuando abre y cierra pegado a
 * una palabra: un «* uno» es una lista y un «2*3» es una cuenta.
 */
export const negritaDeWhatsApp = (t: string): string =>
  t.replace(/(^|[\s(¡¿"«])\*([^\s*](?:[^*\n]*[^\s*])?)\*(?=$|[\s).,;:!?…"»])/gm, '$1**$2**');

/** Lo de cada id, sin repetir y en orden: el sondeo pide con solape, y lo que vuelve (la reacción, el archivo ya subido) reemplaza a lo de antes. */
export function mezclarMensajes(antes: readonly MensajeDelHilo[], nuevos: readonly MensajeDelHilo[]): MensajeDelHilo[] {
  const porId = new Map(antes.map((m) => [m.id, m]));
  for (const m of nuevos) porId.set(m.id, m);
  return [...porId.values()].sort((a, b) => a.id - b.id);
}

/** Cuánto se relee para atrás en cada vuelta: una fila ajena puede entrar con un id menor que la última (lib/grupo-app.ts → leerHilo). */
export const SOLAPE_DEL_SONDEO = 30;
export const urlDelSondeo = (ws: number, cursor: number): string => `/api/grupos/${ws}/mensajes?despues=${Math.max(0, cursor - SOLAPE_DEL_SONDEO)}`;
/** El cursor sólo sube: una vuelta sin nada devuelve el `despues` pedido, que es menor. */
export const cursorNuevo = (actual: number, leido: unknown): number => Math.max(actual, Number(leido) || 0);

export const rutaDelAdjunto = (ws: number, id: number): string => `/api/grupos/${ws}/adjunto/${id}`;

const rolDe = (m: Pick<MensajeDelHilo, 'autor'>): 'user' | 'assistant' => (m.autor.tipo === 'mako' || m.autor.tipo === 'equipo' ? 'assistant' : 'user');
export const idDelItem = (m: MensajeDelHilo): IdMensaje => idWA({ id: `g${m.id}`, role: rolDe(m), at: m.creadoEn });

const textoParaCitar = (m: MensajeDelHilo): string => unRenglon(m.texto) || QUE_ES_EL_ARCHIVO[m.adjunto?.tipo ?? ''] || '';
const autorParaCitar = (m: MensajeDelHilo): string => (m.autor.propio ? 'Tú' : m.autor.tipo === 'mako' ? 'MaKo' : m.autor.nombre);
/** La cita arriba de la caja. */
export const citaDeMensaje = (m: MensajeDelHilo): Cita => ({ de: autorParaCitar(m), texto: textoParaCitar(m), id: idDelItem(m) });

/** El color del nombre de una persona: siempre el mismo para el mismo nombre. Cuatro, los que se leen en claro y en oscuro (grupo.css). */
export function colorDeAutor(nombre: string): number {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.codePointAt(0)!) % 997;
  return h % 4;
}

/** Lo que todavía está saliendo de este navegador. */
export type PendienteDelGrupo = {
  id: string; clienteId: string; texto: string; respondeA: number | null; sigue: boolean;
  archivo: File | null; voz: { blob: Blob; secs: number } | null; url: string | null;
  estado: 'enviando' | 'error'; error?: string;
};

const MIN_PARA_SEGUIR_MS = 5 * 60_000;

function archivosDe(m: MensajeDelHilo, ws: number): ArchivoHilo[] {
  const a = m.adjunto;
  if (!a || a.tipo === 'audio') return [];
  const tipo = a.tipo === 'imagen' ? 'image' : 'document';
  const nombre = a.nombre ?? (a.tipo === 'imagen' ? 'Foto' : 'Archivo.pdf');
  // Nace sin archivo: la tarjeta no se frena subiéndolo (`copiarAlGrupo`). Lo dice, y en la vuelta siguiente aparece.
  return a.listo ? [{ nombre, tipo, local: rutaDelAdjunto(ws, m.id) }] : [{ nombre, tipo, sinAbrir: true, nota: 'Subiendo…' }];
}

/**
 * LOS MENSAJES DEL SERVIDOR, COMO FILAS DEL HILO ÚNICO.
 *   · lo propio, a la derecha; lo de otra persona, a la izquierda y con su nombre (`grupo.autor`): sin esto saldría con la foto de quien mira;
 *   · lo de MaKo o del equipo, con la criatura;
 *   · lo del sistema, una píldora que no dijo nadie;
 *   · lo que vino de WhatsApp lleva su chip, y `desdeLeido` marca el primero sin leer.
 */
export function itemsDelGrupo(p: {
  ws: number; mensajes: readonly MensajeDelHilo[]; pendientes?: readonly PendienteDelGrupo[]; deWhatsApp?: readonly MensajeDeWhatsApp[];
  /** Hasta dónde había leído al abrir. null: no se sabe, y no se marca nada. 0: nunca lo abrió, y «Sin leer» arriba de todo no dice nada: abre en lo último. */
  desdeLeido?: number | null;
}): ItemHilo[] {
  const porId = new Map(p.mensajes.map((m) => [m.id, m]));
  const fuera: ItemHilo[] = [];
  // Lo de antes, de WhatsApp: de sólo lectura y sin autor (`mako_doer_conv` no lo guarda).
  for (const w of p.deWhatsApp ?? []) {
    const id = `wa-${w.creadoEn}`;
    fuera.push(w.rol === 'assistant'
      ? { k: 'msg', id, role: 'assistant', texto: negritaDeWhatsApp(w.texto), at: w.creadoEn, grupo: { autor: null, chip: 'En WhatsApp' } }
      : { k: 'msg', id, role: 'user', texto: w.texto, at: w.creadoEn, grupo: { autor: 'En WhatsApp', color: 0 } });
  }
  let previo: MensajeDelHilo | null = null;
  let marcado = false;
  for (const m of p.mensajes) {
    if (m.autor.tipo === 'sistema') {
      fuera.push({ k: 'aviso', id: `s${m.id}`, texto: m.texto, tono: 'sistema' });
      previo = null;
      continue;
    }
    const citado = m.respondeA != null ? porId.get(m.respondeA) ?? null : null;
    const cita = m.respondeA == null ? null : citado
      ? { de: autorParaCitar(citado), texto: renglonDeCita(textoParaCitar(citado), 140), id: idDelItem(citado) }
      : { de: 'Mensaje anterior', texto: '', id: null };
    const sinLeer = !marcado && !!p.desdeLeido && m.id > p.desdeLeido && !m.autor.propio;
    if (sinLeer) marcado = true;
    const sigue = !!previo && !sinLeer && previo.autor.tipo === m.autor.tipo && previo.autor.nombre === m.autor.nombre
      && Date.parse(m.creadoEn) - Date.parse(previo.creadoEn) < MIN_PARA_SEGUIR_MS;
    const chip = m.canal === 'whatsapp' ? 'WhatsApp' : null;
    const voz = m.adjunto?.tipo === 'audio' && m.adjunto.listo ? { url: rutaDelAdjunto(p.ws, m.id), secs: m.adjunto.secs ?? 0 } : null;
    const archivos = archivosDe(m, p.ws);
    // Una nota de voz todavía sin archivo no es un globo vacío.
    const texto = m.adjunto?.tipo === 'audio' && !m.adjunto.listo && !m.texto.trim() ? 'Nota de voz' : m.texto;
    const base = { k: 'msg' as const, id: `g${m.id}`, at: m.creadoEn, ...(voz ? { voz } : {}), ...(archivos.length ? { archivos } : {}) };
    if (rolDe(m) === 'assistant') {
      fuera.push({
        ...base, role: 'assistant', texto: negritaDeWhatsApp(texto),
        grupo: { autor: null, aviso: !!m.avisoTipo, chip, sigue, sinLeer, ...(m.autor.tipo === 'equipo' ? { deParte: m.autor.nombre, color: colorDeAutor(m.autor.nombre) } : {}) },
      });
    } else {
      fuera.push({
        ...base, role: 'user', texto,
        grupo: { autor: m.autor.propio ? null : m.autor.nombre, color: colorDeAutor(m.autor.nombre), chip, sigue, cita, sinLeer, reaccion: m.reaccion },
      });
    }
    previo = m;
  }
  for (const x of p.pendientes ?? []) {
    const citada = x.respondeA != null ? porId.get(x.respondeA) ?? null : null;
    fuera.push({
      k: 'msg', id: x.id, role: 'user', texto: x.texto, at: null, estado: x.estado, ...(x.error ? { error: x.error, descartable: true } : {}),
      ...(x.voz && x.url ? { voz: { url: x.url, secs: Math.max(1, Math.round(x.voz.secs)) } } : {}),
      ...(x.archivo && x.url ? { archivos: [{ nombre: x.archivo.name, tipo: x.archivo.type === 'application/pdf' ? 'document' : 'image', local: x.url } satisfies ArchivoHilo] } : {}),
      grupo: { autor: null, cita: citada ? { de: autorParaCitar(citada), texto: renglonDeCita(textoParaCitar(citada), 140), id: idDelItem(citada) } : null },
    });
  }
  return fuera;
}

/** Un mensaje del servidor por su id de WhatsApp: el menú y el deslizar dan el id de la fila. */
export const mensajePorIdDeFila = (mensajes: readonly MensajeDelHilo[], id: IdMensaje): MensajeDelHilo | null => mensajes.find((m) => idDelItem(m) === id) ?? null;

/** Lo que dice el hilo cuando no pudo: nunca lo que dijo la base. */
export const FRASES_DEL_GRUPO = {
  noAbre: 'No pude abrir el grupo.',
  fuera: 'Ya no estás en este grupo.',
  vacio: 'Todavía no hay mensajes.',
  vacioDetalle: 'Aquí caen los avisos de MaKo.',
  noSalio: 'No salió. Vuelve a intentarlo.',
  invitadoDesde: 'Ves este grupo desde que te invitaron.',
  invitacion: 'Si no es tu negocio, puedes salir.',
} as const;
