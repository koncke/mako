// =============================================================================
// pedidos-chat — los pedidos SUELTOS en el chat de MaKo de Automations: de la interpretación a las burbujas
// =============================================================================
// Martín, 16/10/2026 (textual en docs/diseno-mako-pedidos.md): «Si hablo con un "sub-chat" y en algún momento le digo
// algo como "Quiero eliminar la otra automatización que tengo porque podría unificarla..." Que sepa como hacerlo, y a
// que automatización se refiere incluso sin nombrarla, interpretandolo y de última preguntando...». Y el contrato del
// enganche lo dejó el Web Generator (docs/diseno-mako-pedidos.md → «El punto de enganche»): ANTES de mandarle el
// mensaje a su modelo, el chat le pregunta a POST /api/mako/pedidos; lo de la automatización ABIERTA sigue a MaKo como
// siempre, y el resto se dibuja como burbujas de MaKo.
//
// Acá vive lo PURO (tests/automations-pedidos-chat.test.ts):
//   · `cuerpoPedidos`: lo que se le manda a la ruta (la tab `chatbot` y la automatización abierta);
//   · `interpretacionDe` y `textoActual`: los MISMOS del Web Generator (validan la respuesta de la ruta: si no sirve, el
//     mensaje entero sigue a MaKo como siempre, cero regresión);
//   · `burbujasDe`, `vistaDeBurbuja`, `pulsar` y `tras*`: cada burbuja, lo que dibuja y lo que le pasa con un clic;
//   · `cuerpoEliminar` / `cuerpoRecuperar`: lo que «Eliminar» manda a la API de la lista, SIEMPRE con UN id;
//   · `objetosDeAutomatizaciones`: las filas de la lista como objetos del chat (la ruta los usa para «la otra»).
//
// ⚠️ «ELIMINAR» ES ARCHIVAR, como en el «⋯» de la lista (`eliminar`, ./SimuladorWhatsApp.tsx): sale de la lista y deja
//    de enviar; nada se borra, y la burbuja ofrece «Deshacer» (`desarchivar`). Y SIEMPRE con confirmación.
// ⚠️ `archivar` SIN `ids` ARCHIVA TODAS (app/api/chat-agent/secuencias/route.ts): `cuerpoEliminar` no arma un cuerpo
//    sin un id entero positivo. Es la línea que más importa de este archivo.
// ⚠️ NUNCA LA ABIERTA: «elimina esta automatización» no se archiva por acá; se dice dónde está «Eliminar».
// ⚠️ «CREAR» VA POR LA MISMA PUERTA QUE «PÍDESELO A MaKo» (`pedirAMako`, ./ChatAgentApp.tsx): la fila nace YA y su
//    lienzo abre con el chat de MaKo y el pedido puesto. Con MaKo trabajando en la abierta, «Sí» espera a que termine.

import type { Interpretacion, ObjetoChat } from '@/lib/mako-pedidos';
// Puros y de la tab: validan la respuesta de la ruta igual para todos los chats (una regla, un lugar).
import { interpretacionDe, textoActual, nombreCorto } from '@/app/web-generator/editor/pedidos-chat';

export { interpretacionDe, textoActual };

/** El cuerpo de POST /api/mako/pedidos para el chat de Automations: la tab y la automatización abierta. */
export function cuerpoPedidos(texto: string, secuenciaId: number, nombre: string): { texto: string; tab: 'chatbot'; actualId: number; actualNombre: string } {
  return { texto: texto.trim(), tab: 'chatbot', actualId: secuenciaId, actualNombre: nombre.trim() };
}

/** El id de una automatización (entero positivo), o null: por acá no se elimina ni se abre nada que no lo sea. */
export function idDeAutomatizacion(o: Pick<ObjetoChat, 'id'>): number | null {
  if (!/^\d{1,12}$/.test(o.id)) return null;
  const n = Number(o.id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Su lienzo: `?sec=` abre ESA automatización (el ?ws= lo pega el `Link` de app/_ui/Link al dibujarlo). */
export const rutaDeAutomatizacion = (o: ObjetoChat): string => `/automations?sec=${idDeAutomatizacion(o) ?? ''}`;

/** «Eliminar» de la lista: archivar ESA y sólo esa. null si el id no sirve (nunca un cuerpo sin `ids`). */
export function cuerpoEliminar(o: ObjetoChat): { action: 'archivar'; ids: [number] } | null {
  const id = idDeAutomatizacion(o);
  return id === null ? null : { action: 'archivar', ids: [id] };
}

/** «Deshacer»: vuelve a la lista (`desarchivar`). */
export function cuerpoRecuperar(o: ObjetoChat): { action: 'desarchivar'; secuenciaId: number } | null {
  const id = idDeAutomatizacion(o);
  return id === null ? null : { action: 'desarchivar', secuenciaId: id };
}

/**
 * Las filas de la lista (sin las archivadas, la última tocada arriba) como objetos del chat. Las sin nombre quedan con
 * su nombre vacío: el chat dice «Sin título», y la ruta igual las puede nombrar por «la otra».
 */
export function objetosDeAutomatizaciones(filas: ReadonlyArray<{ id: unknown; nombre?: unknown; updated_at?: unknown }>): ObjetoChat[] {
  return filas.flatMap((f) => {
    const id = Number(f.id);
    if (!Number.isSafeInteger(id) || id <= 0) return [];
    return [{ id: String(id), nombre: typeof f.nombre === 'string' ? f.nombre : '', tocadoAt: typeof f.updated_at === 'string' ? f.updated_at : null }];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Las burbujas
// ─────────────────────────────────────────────────────────────────────────────

/** Crear otra: preguntada (con algo de la abierta en el mismo mensaje) o directa. `esperando`: «Sí» con MaKo trabajando. */
export type EstadoCrear = 'lista' | 'esperando' | 'creando' | 'creada' | 'error';
/** Eliminar OTRA automatización: siempre con confirmación, y se puede deshacer. */
export type EstadoEliminar = 'pregunta' | 'eliminando' | 'hecha' | 'no' | 'error' | 'recuperando' | 'recuperada';

export type BurbujaPedido =
  /** Una automatización NUEVA. `pregunta`: «¿Terminamos esto y después…?»; null = directa. */
  | { tipo: 'crear'; pedido: string; pregunta: string | null; despues: boolean; estado: EstadoCrear; pulsado: BotonId | null }
  /** «Elimina la otra» con dos candidatas: primero cuál, después la confirmación (otra burbuja). */
  | { tipo: 'elegir'; candidatos: ObjetoChat[]; elegido: string | null }
  | { tipo: 'eliminar'; objeto: ObjetoChat; estado: EstadoEliminar }
  /** Otra automatización con otro verbo («cambia la otra»): el link para abrirla (una, o las dos candidatas). */
  | { tipo: 'abrir'; objetos: ObjetoChat[] }
  /** Es de otra tab: el link que armó la ruta (ya con el `?ws=`). */
  | { tipo: 'ir'; titulo: string; link: string }
  /** Eliminar la ABIERTA: por acá no; dónde está «Eliminar». */
  | { tipo: 'abierta' }
  | { tipo: 'aviso'; texto: string };

export type BotonId = 'si' | 'despues' | 'crear-ahora' | 'eliminar' | 'no' | 'deshacer' | `elegir:${string}`;

export const TEXTOS = {
  propuesta: '¿Terminamos esto y después creamos la otra automatización?',
  directa: 'Eso va en una automatización nueva.',
  despues: 'Cuando quieras, la creamos.',
  esperando: 'Al terminar esto, la creo.',
  si: 'Sí',
  despuesBoton: 'Después',
  crearAhora: 'Crear ahora',
  creando: 'Creándola…',
  creada: 'Creada: está en la lista.',
  noCreo: 'No se pudo crear.',
  siEliminar: 'Sí, eliminarla',
  no: 'No',
  deshacer: 'Deshacer',
  eliminando: 'Eliminando…',
  eliminada: 'Eliminada: ya no envía.',
  noElimino: 'No se pudo eliminar.',
  recuperando: 'Recuperándola…',
  recuperada: 'Volvió a la lista, pausada.',
  laAbierta: 'Esta automatización está abierta: usa ⋯ › Eliminar en la lista.',
  cual: '¿Cuál? Dime su nombre.',
} as const;

const EN_TEXTO = 60;
const EN_BOTON = 28;

/** La confirmación de eliminar ESA automatización; la abierta, nunca. */
export function eliminarDe(o: ObjetoChat, actualId: number | string): BurbujaPedido {
  return o.id === String(actualId) ? { tipo: 'abierta' } : { tipo: 'eliminar', objeto: o, estado: 'pregunta' };
}

/**
 * Una burbuja por cada pedido que NO es de la abierta, en el orden del mensaje:
 *   · `nuevo` → crear: con algo de la abierta en el mismo mensaje, la propuesta (la de la ruta si es de este pedido, si
 *     no la genérica) con Sí / Después; sin nada de la abierta, directa con «Crear ahora»;
 *   · `otro` que borra → la confirmación de eliminar; con dos candidatas, primero cuál; la abierta, nunca;
 *   · `otro` con otro verbo → el link para abrirla (o las dos candidatas);
 *   · `otra-tab` → el link de la ruta.
 * Sin un objeto claro ni dos candidatas, se pregunta el nombre: nunca se elige el primero de una lista.
 */
export function burbujasDe(i: Interpretacion, actualId: number | string): BurbujaPedido[] {
  const abierta = String(actualId);
  const hayActual = i.pedidos.some((p) => p.sobre === 'actual');
  const primero = i.pedidos.find((p) => p.sobre !== 'actual');
  return i.pedidos.flatMap((p): BurbujaPedido[] => {
    if (p.sobre === 'actual') return [];
    if (p.sobre === 'nuevo') {
      const pregunta = hayActual ? (p === primero && i.propuesta?.texto) || TEXTOS.propuesta : null;
      return [{ tipo: 'crear', pedido: p.texto, pregunta, despues: false, estado: 'lista', pulsado: null }];
    }
    if (p.sobre === 'otra-tab') return [{ tipo: 'ir', titulo: p.titulo, link: p.link }];
    if (p.verbo === 'borrar' && p.objeto?.id === abierta) return [{ tipo: 'abierta' }];
    const objetos = (p.objeto ? [p.objeto] : p.candidatos).filter((o) => o.id !== abierta && idDeAutomatizacion(o) !== null);
    const claro = !!p.objeto && objetos.length === 1;
    const dos = !p.objeto && objetos.length === 2;
    if (!claro && !dos) return [{ tipo: 'aviso', texto: TEXTOS.cual }];
    if (p.verbo === 'borrar') return [claro ? eliminarDe(objetos[0], abierta) : { tipo: 'elegir', candidatos: objetos, elegido: null }];
    return [{ tipo: 'abrir', objetos }];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que se dibuja
// ─────────────────────────────────────────────────────────────────────────────

export type VarianteBoton = 'primario' | 'secundario' | 'contorno';
export type BotonVista = { id: BotonId; texto: string; v: VarianteBoton; apagado: boolean; elegido: boolean };
export type LinkVista = { texto: string; href: string };
export type VistaBurbuja = { texto: string; botones: BotonVista[]; links: LinkVista[]; nota: string | null; ocupado: boolean; error: boolean };

const cual = (a: ObjetoChat, b: ObjetoChat) => `¿Cuál: «${nombreCorto(a, EN_TEXTO)}» o «${nombreCorto(b, EN_TEXTO)}»?`;

function botonesCrear(b: Extract<BurbujaPedido, { tipo: 'crear' }>): BotonVista[] {
  const apagado = b.estado === 'creando' || b.estado === 'creada';
  const boton = (id: BotonId, texto: string, v: VarianteBoton, tambien = false): BotonVista =>
    ({ id, texto, v, apagado: apagado || tambien, elegido: (apagado || tambien) && b.pulsado === id });
  // Esperando, «Sí» ya está dicho; «Después» sigue prendido por si cambia de idea.
  if (b.pregunta && !b.despues) return [boton('si', TEXTOS.si, 'primario', b.estado === 'esperando'), boton('despues', TEXTOS.despuesBoton, 'contorno')];
  return [boton('crear-ahora', TEXTOS.crearAhora, b.despues ? 'secundario' : 'primario')];
}

export function vistaDeBurbuja(b: BurbujaPedido): VistaBurbuja {
  const vacia = { botones: [] as BotonVista[], links: [] as LinkVista[], nota: null, ocupado: false, error: false };
  switch (b.tipo) {
    case 'crear': {
      const texto = b.despues ? TEXTOS.despues : b.pregunta ?? TEXTOS.directa;
      const nota = b.estado === 'esperando' ? TEXTOS.esperando : b.estado === 'creando' ? TEXTOS.creando : b.estado === 'creada' ? TEXTOS.creada : b.estado === 'error' ? TEXTOS.noCreo : null;
      return { ...vacia, texto, botones: botonesCrear(b), nota, ocupado: b.estado === 'creando', error: b.estado === 'error' };
    }
    case 'elegir':
      return {
        ...vacia,
        texto: cual(b.candidatos[0], b.candidatos[1]),
        botones: b.candidatos.map((o) => ({ id: `elegir:${o.id}` as const, texto: nombreCorto(o, EN_BOTON), v: 'secundario' as const, apagado: b.elegido !== null, elegido: b.elegido === o.id })),
      };
    case 'eliminar': {
      const e = b.estado;
      const nombre = nombreCorto(b.objeto, EN_TEXTO);
      // Hecha: queda «Deshacer» (vuelve pausada, como la deja `desarchivarSecuencia`).
      if (e === 'hecha' || e === 'recuperando') {
        return {
          ...vacia, texto: `«${nombre}» deja de enviar y sale de la lista.`,
          botones: [{ id: 'deshacer', texto: TEXTOS.deshacer, v: 'contorno', apagado: e === 'recuperando', elegido: e === 'recuperando' }],
          nota: e === 'recuperando' ? TEXTOS.recuperando : TEXTOS.eliminada, ocupado: e === 'recuperando',
        };
      }
      const apagado = e !== 'pregunta' && e !== 'error';
      const nota = e === 'eliminando' ? TEXTOS.eliminando : e === 'error' ? TEXTOS.noElimino : e === 'recuperada' ? TEXTOS.recuperada : null;
      return {
        ...vacia,
        texto: `¿Elimino «${nombre}»? Deja de enviar y sale de la lista.`,
        botones: [
          { id: 'eliminar', texto: TEXTOS.siEliminar, v: 'primario', apagado, elegido: e === 'eliminando' || e === 'recuperada' },
          { id: 'no', texto: TEXTOS.no, v: 'contorno', apagado, elegido: e === 'no' },
        ],
        nota, ocupado: e === 'eliminando', error: e === 'error',
      };
    }
    case 'abrir':
      return {
        ...vacia,
        texto: b.objetos.length === 2 ? cual(b.objetos[0], b.objetos[1]) : `Eso va en «${nombreCorto(b.objetos[0], EN_TEXTO)}».`,
        links: b.objetos.map((o) => ({ texto: `Abrir «${nombreCorto(o, EN_BOTON)}»`, href: rutaDeAutomatizacion(o) })),
      };
    case 'ir':
      return { ...vacia, texto: `Eso se hace en ${b.titulo}.`, links: [{ texto: `Ir a ${b.titulo}`, href: b.link }] };
    case 'abierta':
      return { ...vacia, texto: TEXTOS.laAbierta };
    case 'aviso':
      return { ...vacia, texto: b.texto };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que le pasa a una burbuja
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que el chat tiene que HACER después de un clic (la burbuja ya quedó en su estado nuevo). */
export type EfectoPedido =
  | { tipo: 'crear'; pedido: string }
  | { tipo: 'eliminar'; objeto: ObjetoChat; cuerpo: { action: 'archivar'; ids: [number] } }
  | { tipo: 'recuperar'; objeto: ObjetoChat; cuerpo: { action: 'desarchivar'; secuenciaId: number } }
  /** Se eligió una de las dos candidatas: la confirmación va como burbuja nueva, debajo. */
  | { tipo: 'agregar'; burbuja: BurbujaPedido };

/**
 * Un clic en un botón de la burbuja. Sólo cuenta un botón que la vista dibuja PRENDIDO: uno apagado (ya usado, o
 * mientras corre lo que pidió) devuelve la misma burbuja y ningún efecto. `trabajando`: MaKo está con la abierta.
 */
export function pulsar(
  b: BurbujaPedido, boton: string, actualId: number | string, op?: { trabajando?: boolean },
): { burbuja: BurbujaPedido; efecto: EfectoPedido | null } {
  const igual = { burbuja: b, efecto: null };
  const prendido = vistaDeBurbuja(b).botones.some((x) => x.id === boton && !x.apagado);
  if (!prendido) return igual;
  if (b.tipo === 'crear') {
    if (boton === 'despues') return { burbuja: { ...b, despues: true, estado: 'lista', pulsado: null }, efecto: null };
    // «¿Terminamos esto y después…?» → «Sí»: con MaKo trabajando en la abierta, primero eso.
    if (boton === 'si' && op?.trabajando) return { burbuja: { ...b, estado: 'esperando', pulsado: 'si' }, efecto: null };
    return { burbuja: { ...b, estado: 'creando', pulsado: boton as BotonId }, efecto: { tipo: 'crear', pedido: b.pedido } };
  }
  if (b.tipo === 'eliminar') {
    if (boton === 'no') return { burbuja: { ...b, estado: 'no' }, efecto: null };
    if (boton === 'deshacer') {
      const cuerpo = cuerpoRecuperar(b.objeto);
      return cuerpo ? { burbuja: { ...b, estado: 'recuperando' }, efecto: { tipo: 'recuperar', objeto: b.objeto, cuerpo } } : igual;
    }
    const cuerpo = cuerpoEliminar(b.objeto);
    // La abierta no llega acá (`eliminarDe`), y un id que no es de una automatización no se manda.
    if (!cuerpo || b.objeto.id === String(actualId)) return { burbuja: { ...b, estado: 'error' }, efecto: null };
    return { burbuja: { ...b, estado: 'eliminando' }, efecto: { tipo: 'eliminar', objeto: b.objeto, cuerpo } };
  }
  if (b.tipo === 'elegir') {
    const o = b.candidatos.find((c) => `elegir:${c.id}` === boton);
    if (!o) return igual;
    return { burbuja: { ...b, elegido: o.id }, efecto: { tipo: 'agregar', burbuja: eliminarDe(o, actualId) } };
  }
  return igual;
}

/** La respuesta de «Eliminar»: hecha (con «Deshacer»), o el botón otra vez prendido. */
export function trasEliminar(b: BurbujaPedido, ok: boolean): BurbujaPedido {
  return b.tipo === 'eliminar' && b.estado === 'eliminando' ? { ...b, estado: ok ? 'hecha' : 'error' } : b;
}

/** La respuesta de «Deshacer»: volvió a la lista, o sigue eliminada (con «Deshacer» prendido). */
export function trasRecuperar(b: BurbujaPedido, ok: boolean): BurbujaPedido {
  return b.tipo === 'eliminar' && b.estado === 'recuperando' ? { ...b, estado: ok ? 'recuperada' : 'hecha' } : b;
}

/** La creación: hecha (la fila está en la lista y su lienzo abre), o el botón otra vez prendido. */
export function trasCrear(b: BurbujaPedido, ok: boolean): BurbujaPedido {
  return b.tipo === 'crear' && b.estado === 'creando' ? { ...b, estado: ok ? 'creada' : 'error', pulsado: ok ? b.pulsado : null } : b;
}

/** MaKo terminó con la abierta: una creación que esperaba sale. */
export function alTerminar(b: BurbujaPedido): { burbuja: BurbujaPedido; efecto: EfectoPedido | null } {
  return b.tipo === 'crear' && b.estado === 'esperando'
    ? { burbuja: { ...b, estado: 'creando' }, efecto: { tipo: 'crear', pedido: b.pedido } }
    : { burbuja: b, efecto: null };
}
