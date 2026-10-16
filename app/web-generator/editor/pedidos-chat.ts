// =============================================================================
// pedidos-chat — los pedidos SUELTOS en el chat del agente del editor: de la interpretación a las burbujas
// =============================================================================
// Martín, 16/10/2026 (textual en docs/diseno-mako-pedidos.md): «Y si en cualquier momento, por ejemplo, estoy
// creando una automatización, o un dashboard, una web, o lo que sea y le digo algo como "Feedback sobre lo
// actual... Y luego <y también quiero que me crees otra landing para mi otro producto...>" ahí debe saber
// interpretarlo y llamar a la función para crear otra landing, e incluso proponerle "¿Quieres que primero
// terminemos esto y luego creamos la otra landing?"... o cosas así... Es más incluso si se está trabajando en una
// tab y se envía un mensaje totalmente diferente, relacionado a otra tab, que el chat le deje ahí en el chat el
// link para ir a donde corresponde.»
//
// El panel (paneles/PanelAgente.tsx) le pregunta a POST /api/mako/pedidos ANTES de «editar con IA». Acá vive lo
// PURO de lo que vuelve, y lo que le pasa a cada burbuja (tests/editor-landing-pedidos-chat.test.ts):
//   · `interpretacionDe`: la respuesta de la ruta, validada. Si no sirve (falló, tardó, vino con otra forma),
//     la de siempre: el mensaje ENTERO es de la landing abierta. Cero regresión: el chat hace lo de antes;
//   · `textoActual`: lo que sigue a «editar» (los pedidos sobre lo abierto, juntos), o null si no hay;
//   · `burbujasDe`: una burbuja de MaKo por cada pedido que NO es de lo abierto;
//   · `vistaDeBurbuja`: qué texto, qué botones (y cuáles apagados) y qué links dibuja cada una;
//   · `pulsar` y `tras*`: lo que le pasa a una burbuja con un clic y con la respuesta de lo que el clic pidió.
//
// ⚠️ SÓLO TIPOS de lib/mako-pedidos.ts (`import type`): ese módulo trae `AREA_KEYWORDS` y no es para el navegador
//    (lo dice su cabecera). La interpretación la hace la ruta; acá no se decide nada que ella no haya decidido.
// ⚠️ UN BOTÓN USADO SE APAGA EN EL ESTADO, no en la pantalla: `pulsar` sobre un botón apagado no devuelve efecto.
//    El panel lee la burbuja del STORE (sincrónico) y no la del render: dos clics en el mismo tick no repiten.
// ⚠️ NUNCA LA LANDING ABIERTA. «Elimina esta landing» vuelve de la ruta con el objeto abierto (el núcleo la manda a
//    confirmar porque el camino de siempre del editor no borra), pero por acá no se archiva: se dice dónde está
//    «Eliminar». Y nada borra para siempre: el «Sí» es la Papelera del Panel (se restaura).
// ⚠️ «CREAR» VA POR EL CAMINO DE LA CAJA DEL PANEL que existe hoy: el pedido en sessionStorage con la MISMA clave y
//    forma que lee `tomarCaja` (MiniaturaLanding.tsx) y `?desde=caja` (`derechaDeQuery`, panel-reglas.ts), que abre
//    Crear con IA en Plan con el pedido escrito arriba. NUNCA en la URL: el pedido trae datos del negocio y una URL
//    queda en el historial y en los logs (la cabecera de `tomarCaja`). El test hace la vuelta entera con las dos.

import type { Interpretacion, ObjetoChat, PedidoResuelto } from '@/lib/mako-pedidos';

// ─────────────────────────────────────────────────────────────────────────────
// Lo que se le manda a la ruta, y lo que vuelve
// ─────────────────────────────────────────────────────────────────────────────

/** El cuerpo de POST /api/mako/pedidos para el chat del editor: la tab y la landing abierta. */
export function cuerpoPedidos(texto: string, docId: number, titulo: string): { texto: string; tab: 'landing'; actualId: number; actualNombre: string } {
  return { texto: texto.trim(), tab: 'landing', actualId: docId, actualNombre: titulo.trim() };
}

/** Lo de siempre: el mensaje entero es de la landing abierta. */
function deSiempre(texto: string): Interpretacion {
  return { pedidos: [{ sobre: 'actual', texto: texto.trim() }], propuesta: null, origen: 'reglas' };
}

const VERBOS: readonly string[] = ['crear', 'borrar', 'editar', 'ver', 'otro'];
const esTexto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const textoONull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
/** Un link de la ruta es de ADENTRO de la app: `/algo`, nunca `//otro.com` ni `javascript:`. */
const esInterno = (v: unknown): v is string => typeof v === 'string' && /^\/(?!\/)/.test(v) && !/[\s<>"]/.test(v);

function objetoValido(v: unknown): ObjetoChat | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { id?: unknown; nombre?: unknown; tocadoAt?: unknown };
  const id = typeof o.id === 'number' || typeof o.id === 'string' ? String(o.id).trim() : '';
  if (!id || typeof o.nombre !== 'string') return null;
  return { id, nombre: o.nombre, tocadoAt: typeof o.tocadoAt === 'string' ? o.tocadoAt : null };
}

/** Un pedido de la respuesta, con la forma del contrato; null si no la tiene. */
function pedidoValido(v: unknown): PedidoResuelto | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  if (!esTexto(p.texto)) return null;
  const texto = p.texto.trim();
  const operacion = textoONull(p.operacion);
  if (p.sobre === 'actual') return { sobre: 'actual', texto };
  if (p.sobre === 'nuevo') return { sobre: 'nuevo', texto, operacion };
  if (p.sobre === 'otra-tab') {
    if (!esTexto(p.area) || !esTexto(p.titulo) || !esInterno(p.link)) return null;
    return { sobre: 'otra-tab', texto, area: p.area as Extract<PedidoResuelto, { sobre: 'otra-tab' }>['area'], titulo: p.titulo.trim(), link: p.link, operacion, confirmar: p.confirmar === true };
  }
  if (p.sobre === 'otro') {
    if (typeof p.verbo !== 'string' || !VERBOS.includes(p.verbo)) return null;
    const objeto = p.objeto == null ? null : objetoValido(p.objeto);
    if (p.objeto != null && !objeto) return null;
    const candidatos = Array.isArray(p.candidatos) ? p.candidatos.map(objetoValido) : [];
    if (candidatos.some((c) => !c)) return null;
    return {
      sobre: 'otro', texto, verbo: p.verbo as Extract<PedidoResuelto, { sobre: 'otro' }>['verbo'], objeto,
      candidatos: candidatos as ObjetoChat[], operacion, confirmar: p.confirmar === true, pregunta: textoONull(p.pregunta),
    };
  }
  return null;
}

/**
 * La interpretación que vuelve de la ruta, o la de siempre (el mensaje entero a «editar») si no sirve: una falla
 * (`ok: false`, un plazo vencido, sin conexión), una lista vacía o un pedido con otra forma. Un pedido roto tira la
 * respuesta ENTERA: quedarse con una parte podría no editar lo que se pidió.
 */
export function interpretacionDe(respuesta: unknown, texto: string): Interpretacion {
  const deRuta = respuesta && typeof respuesta === 'object' ? (respuesta as { ok?: unknown; pedidos?: unknown; propuesta?: unknown; origen?: unknown }) : null;
  if (!deRuta || deRuta.ok !== true || !Array.isArray(deRuta.pedidos) || !deRuta.pedidos.length) return deSiempre(texto);
  const pedidos = deRuta.pedidos.map(pedidoValido);
  if (pedidos.some((p) => !p)) return deSiempre(texto);
  const prop = deRuta.propuesta && typeof deRuta.propuesta === 'object' ? (deRuta.propuesta as { texto?: unknown }).texto : null;
  return {
    pedidos: pedidos as PedidoResuelto[],
    propuesta: esTexto(prop) ? { texto: prop.trim(), botones: ['Sí', 'Después'] as const } : null,
    origen: deRuta.origen === 'ia' ? 'ia' : 'reglas',
  };
}

/** Lo que sigue a «editar con IA»: los pedidos sobre lo abierto, juntos (uno por renglón), o null si no hay. */
export function textoActual(i: Interpretacion): string | null {
  const t = i.pedidos.flatMap((p) => (p.sobre === 'actual' && p.texto.trim() ? [p.texto.trim()] : [])).join('\n');
  return t || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Las burbujas
// ─────────────────────────────────────────────────────────────────────────────

/** Abrir la creación: preguntada (con algo de lo abierto en el mismo mensaje) o directa. */
export type EstadoCrear = 'lista' | 'abriendo' | 'abierta' | 'error';
/** Mandar OTRA landing a la Papelera: siempre con confirmación. */
export type EstadoPapelera = 'pregunta' | 'archivando' | 'hecha' | 'no' | 'error' | 'restaurada';

export type BurbujaPedido =
  /** Una landing NUEVA. `pregunta`: la propuesta «¿Terminamos esto y después…?»; null = directa. */
  | { tipo: 'crear'; pedido: string; pregunta: string | null; despues: boolean; estado: EstadoCrear; pulsado: BotonId | null }
  /** «Elimina la otra landing» con dos candidatas: primero cuál, después la confirmación (otra burbuja). */
  | { tipo: 'elegir'; candidatos: ObjetoChat[]; elegido: string | null }
  | { tipo: 'papelera'; objeto: ObjetoChat; estado: EstadoPapelera }
  /** Otra landing con otro verbo («cambia la otra»): el link para abrirla (una, o las dos candidatas). */
  | { tipo: 'abrir'; objetos: ObjetoChat[] }
  /** Es de otra tab: el link que armó la ruta (ya con el `?ws=`). */
  | { tipo: 'ir'; titulo: string; link: string }
  /** Borrar la landing ABIERTA: por acá no; dónde está «Eliminar». */
  | { tipo: 'abierta' }
  | { tipo: 'aviso'; texto: string };

export type BotonId = 'si' | 'despues' | 'crear-ahora' | 'papelera' | 'no' | `elegir:${string}`;

export const TEXTOS = {
  propuesta: '¿Terminamos esto y después creamos otra landing?',
  directa: 'Eso va en una landing nueva.',
  despues: 'Cuando quieras, la creamos.',
  si: 'Sí',
  despuesBoton: 'Después',
  crearAhora: 'Crear ahora',
  abriendo: 'Abriendo la creación…',
  abierta: 'Abierta en el Panel.',
  noAbrio: 'No se pudo abrir.',
  aPapelera: 'Sí, a la Papelera',
  no: 'No',
  archivando: 'Archivando…',
  enPapelera: 'Está en la Papelera.',
  noArchivo: 'No se pudo archivar.',
  restaurada: 'Volvió de la Papelera.',
  laAbierta: 'Esta landing está abierta: usa ⋯ › Eliminar.',
  cual: '¿Cuál? Dime su nombre.',
} as const;

export const SIN_TITULO = 'Sin título';

/** El nombre para mostrar: sin espacios de más, «Sin título» si está vacío, y cortado con «…». */
export function nombreCorto(o: ObjetoChat, max: number): string {
  const n = (o.nombre ?? '').replace(/\s+/g, ' ').trim() || SIN_TITULO;
  return n.length > max ? `${n.slice(0, max - 1).trimEnd()}…` : n;
}
const EN_TEXTO = 60;
const EN_BOTON = 28;

/** El id de una landing del negocio (entero positivo), o null: por acá no se archiva nada que no lo sea. */
export function idDeLanding(o: ObjetoChat): number | null {
  if (!/^\d{1,12}$/.test(o.id)) return null;
  const n = Number(o.id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** El editor de una landing (el ?ws= lo pega el `Link` de app/_ui/Link al dibujarlo). */
export const rutaDeLanding = (o: ObjetoChat): string => `/web-generator/${idDeLanding(o) ?? ''}`;

/** La confirmación de mandar ESA landing a la Papelera; la abierta, nunca. */
export function papeleraDe(o: ObjetoChat, actualId: number | string): BurbujaPedido {
  return o.id === String(actualId) ? { tipo: 'abierta' } : { tipo: 'papelera', objeto: o, estado: 'pregunta' };
}

/**
 * Una burbuja por cada pedido que NO es de lo abierto, en el orden del mensaje:
 *   · `nuevo` → crear: con algo de lo abierto en el mismo mensaje, la propuesta (el texto de la ruta si es de este
 *     pedido —la ruta la arma sobre el PRIMERO que no es de lo abierto—, si no la genérica) con Sí / Después; sin
 *     nada de lo abierto, directa con «Crear ahora»;
 *   · `otro` que borra → la confirmación de la Papelera; con dos candidatas, primero cuál; la abierta, nunca;
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
    const objetos = (p.objeto ? [p.objeto] : p.candidatos).filter((o) => o.id !== abierta && idDeLanding(o) !== null);
    const claro = !!p.objeto && objetos.length === 1;
    const dos = !p.objeto && objetos.length === 2;
    if (!claro && !dos) return [{ tipo: 'aviso', texto: TEXTOS.cual }];
    if (p.verbo === 'borrar') return [claro ? papeleraDe(objetos[0], abierta) : { tipo: 'elegir', candidatos: objetos, elegido: null }];
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

/** Los botones de «crear» según por dónde va: Sí / Después, o «Crear ahora» (directa, o después de «Después»). */
function botonesCrear(b: Extract<BurbujaPedido, { tipo: 'crear' }>): BotonVista[] {
  const apagado = b.estado === 'abriendo' || b.estado === 'abierta';
  const boton = (id: BotonId, texto: string, v: VarianteBoton): BotonVista => ({ id, texto, v, apagado, elegido: apagado && b.pulsado === id });
  if (b.pregunta && !b.despues) return [boton('si', TEXTOS.si, 'primario'), boton('despues', TEXTOS.despuesBoton, 'contorno')];
  return [boton('crear-ahora', TEXTOS.crearAhora, b.despues ? 'secundario' : 'primario')];
}

export function vistaDeBurbuja(b: BurbujaPedido): VistaBurbuja {
  const vacia = { botones: [] as BotonVista[], links: [] as LinkVista[], nota: null, ocupado: false, error: false };
  switch (b.tipo) {
    case 'crear': {
      const texto = b.despues ? TEXTOS.despues : b.pregunta ?? TEXTOS.directa;
      const nota = b.estado === 'abriendo' ? TEXTOS.abriendo : b.estado === 'abierta' ? TEXTOS.abierta : b.estado === 'error' ? TEXTOS.noAbrio : null;
      return { ...vacia, texto, botones: botonesCrear(b), nota, ocupado: b.estado === 'abriendo', error: b.estado === 'error' };
    }
    case 'elegir':
      return {
        ...vacia,
        texto: cual(b.candidatos[0], b.candidatos[1]),
        botones: b.candidatos.map((o) => ({ id: `elegir:${o.id}` as const, texto: nombreCorto(o, EN_BOTON), v: 'secundario' as const, apagado: b.elegido !== null, elegido: b.elegido === o.id })),
      };
    case 'papelera': {
      const e = b.estado;
      const apagado = e !== 'pregunta' && e !== 'error';
      const nota = e === 'archivando' ? TEXTOS.archivando : e === 'hecha' ? TEXTOS.enPapelera : e === 'error' ? TEXTOS.noArchivo : e === 'restaurada' ? TEXTOS.restaurada : null;
      return {
        ...vacia,
        texto: `¿Mando «${nombreCorto(b.objeto, EN_TEXTO)}» a la Papelera?`,
        botones: [
          { id: 'papelera', texto: TEXTOS.aPapelera, v: 'primario', apagado, elegido: e === 'archivando' || e === 'hecha' || e === 'restaurada' },
          { id: 'no', texto: TEXTOS.no, v: 'contorno', apagado, elegido: e === 'no' },
        ],
        nota, ocupado: e === 'archivando', error: e === 'error',
      };
    }
    case 'abrir':
      return {
        ...vacia,
        texto: b.objetos.length === 2 ? cual(b.objetos[0], b.objetos[1]) : `Eso va en «${nombreCorto(b.objetos[0], EN_TEXTO)}».`,
        links: b.objetos.map((o) => ({ texto: `Abrir «${nombreCorto(o, EN_BOTON)}»`, href: rutaDeLanding(o) })),
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

/** Lo que el panel tiene que HACER después de un clic (la burbuja ya quedó en su estado nuevo). */
export type EfectoPedido =
  | { tipo: 'crear'; pedido: string }
  | { tipo: 'papelera'; objeto: ObjetoChat; id: number }
  /** Se eligió una de las dos candidatas: la confirmación va como burbuja nueva, debajo. */
  | { tipo: 'agregar'; burbuja: BurbujaPedido };

/**
 * Un clic en un botón de la burbuja. Sólo cuenta un botón que la vista dibuja PRENDIDO: uno apagado (ya usado,
 * o mientras corre lo que pidió) devuelve la misma burbuja y ningún efecto.
 */
export function pulsar(b: BurbujaPedido, boton: string, actualId: number | string): { burbuja: BurbujaPedido; efecto: EfectoPedido | null } {
  const igual = { burbuja: b, efecto: null };
  const prendido = vistaDeBurbuja(b).botones.some((x) => x.id === boton && !x.apagado);
  if (!prendido) return igual;
  if (b.tipo === 'crear') {
    if (boton === 'despues') return { burbuja: { ...b, despues: true, estado: 'lista', pulsado: null }, efecto: null };
    return { burbuja: { ...b, estado: 'abriendo', pulsado: boton as BotonId }, efecto: { tipo: 'crear', pedido: b.pedido } };
  }
  if (b.tipo === 'papelera') {
    if (boton === 'no') return { burbuja: { ...b, estado: 'no' }, efecto: null };
    const id = idDeLanding(b.objeto);
    // La abierta no llega acá (`papeleraDe`), y un id que no es de una landing no se manda.
    if (id === null || b.objeto.id === String(actualId)) return { burbuja: { ...b, estado: 'error' }, efecto: null };
    return { burbuja: { ...b, estado: 'archivando' }, efecto: { tipo: 'papelera', objeto: b.objeto, id } };
  }
  if (b.tipo === 'elegir') {
    const o = b.candidatos.find((c) => `elegir:${c.id}` === boton);
    if (!o) return igual;
    return { burbuja: { ...b, elegido: o.id }, efecto: { tipo: 'agregar', burbuja: papeleraDe(o, actualId) } };
  }
  return igual;
}

/** La respuesta de la Papelera (`pedirDocs({ accion: 'papelera' })`): en la Papelera, o el botón otra vez prendido. */
export function trasPapelera(b: BurbujaPedido, ok: boolean): BurbujaPedido {
  return b.tipo === 'papelera' && b.estado === 'archivando' ? { ...b, estado: ok ? 'hecha' : 'error' } : b;
}

/** El «Deshacer» del aviso (`restaurar`): si volvió, se dice; si no, sigue en la Papelera. */
export function trasRestaurar(b: BurbujaPedido, ok: boolean): BurbujaPedido {
  return b.tipo === 'papelera' && b.estado === 'hecha' && ok ? { ...b, estado: 'restaurada' } : b;
}

/** No se pudo dejar el pedido para la caja (sessionStorage bloqueado): el botón vuelve a estar prendido. */
export function trasNoAbrir(b: BurbujaPedido): BurbujaPedido {
  return b.tipo === 'crear' && b.estado === 'abriendo' ? { ...b, estado: 'error', pulsado: null } : b;
}

/**
 * De vuelta en el editor (el chat vive en la memoria de la pestaña y sobrevive a la navegación): una creación que
 * quedó «Abriendo…» ya se abrió. Sin esto, el giro seguiría ahí para siempre.
 */
export function alVolver(b: BurbujaPedido): BurbujaPedido {
  return b.tipo === 'crear' && b.estado === 'abriendo' ? { ...b, estado: 'abierta' } : b;
}

// ─────────────────────────────────────────────────────────────────────────────
// El pedido para la caja del Panel
// ─────────────────────────────────────────────────────────────────────────────

/** La clave de sessionStorage que lee `tomarCaja` (MiniaturaLanding.tsx). El test hace la vuelta con la de allá. */
export const CLAVE_CAJA = 'gp.crear.caja';
/** El Panel con el pedido de la caja: `derechaDeQuery` lo abre en Crear con IA, en Plan (se revisa antes de crear). */
export const RUTA_CREAR = '/web-generator?desde=caja&modo=plan';

/** Lo que se deja en sessionStorage para `tomarCaja`: el pedido, Plan, y cuándo (vence a los 10 minutos). */
export function cajaParaCrear(pedido: string, ahora: number): string {
  return JSON.stringify({ prompt: pedido.trim(), modo: 'plan', t: ahora });
}
