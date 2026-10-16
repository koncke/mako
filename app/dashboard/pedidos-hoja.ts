// =============================================================================
// pedidos-hoja — los pedidos SUELTOS en «Editar con MaKo» (Dashboard y General): de la interpretación a las burbujas
// =============================================================================
// Martín, 16/10/2026 (textual en docs/diseno-mako-pedidos.md): «si en cualquier momento, por ejemplo, estoy creando
// una automatización, o un dashboard, una web, o lo que sea y le digo algo como "Feedback sobre lo actual... Y luego <y
// también quiero que me crees otra...>" ahí debe saber interpretarlo... e incluso proponerle "¿Quieres que primero
// terminemos esto y luego creamos la otra?"... Es más incluso si se está trabajando en una tab y se envía un mensaje
// totalmente diferente, relacionado a otra tab, que el chat le deje ahí en el chat el link para ir a donde corresponde.»
//
// El panel (./PanelEditarMako.tsx) le pregunta a POST /api/mako/pedidos ANTES de editar (el punto de enganche del
// diseño). Lo que vuelve se lee con `interpretacionDe` y `textoActual` del chat del Web Generator (la misma lectura de la
// misma respuesta: app/web-generator/editor/pedidos-chat.ts); lo de la hoja abierta sigue a la edición de siempre, y lo
// demás es una burbuja de MaKo. Acá, lo PURO de esas burbujas (tests/dashboard-pedidos-chat.test.ts):
//   · `burbujasDeHoja`: una por cada pedido que no es de la hoja abierta;
//   · `vistaDeBurbujaHoja`: qué texto, qué botones y qué link dibuja cada una;
//   · `pulsarHoja` y `trasCrear`: lo que le pasa a una burbuja con un clic, y el efecto que el panel tiene que correr.
//
// Lo que gobierna, y no se ve en las firmas:
//   · «CREAR OTRA HOJA» la arma MaKo con el pedido (/api/graficos/ia, «¿Qué vas a crear hoy?») y entra por `crearHoja`
//     del editor. «Sí» a «¿Terminamos esto y después…?» ya puede crear: el cambio de la hoja abierta se aplicó antes de
//     que la burbuja aparezca (no queda nada a medias, como en el Web Generator).
//   · BORRAR OTRA HOJA SIEMPRE CONFIRMA, y archiva (`eliminarHoja` del editor: queda en Archivados, con su Deshacer).
//     La hoja ABIERTA nunca se archiva desde el chat: se dice dónde está («⋯ › Eliminar»).
//   · UN BOTÓN USADO SE APAGA EN EL ESTADO: `pulsarHoja` sobre una burbuja que ya hizo lo suyo no devuelve efecto.
//   · OTRA TAB es un link (el de la ruta, relativo y con el `?ws=`): nada se ejecuta por acá.
//
// ⚠️ SÓLO TIPOS de lib/mako-pedidos.ts (`import type`): ese módulo trae `AREA_KEYWORDS` y no es para el navegador.

import type { Interpretacion, ObjetoChat, Verbo } from '@/lib/mako-pedidos';

export { interpretacionDe, textoActual } from '@/app/web-generator/editor/pedidos-chat';

/** La tab de la API de MaKo de cada informe (el `tab` del cuerpo de /api/mako/pedidos). */
export const TAB_DEL_INFORME = { dashboard: 'metricas', general: 'general' } as const;

export type BurbujaHoja =
  /** Crear OTRA hoja con ese pedido. `propuesta`: «¿Terminamos esto y después creamos otra hoja?» (si hubo un cambio). */
  | { tipo: 'crear'; pedido: string; propuesta: string | null; estado: 'pregunta' | 'despues' | 'creando' | 'creada' | 'error' }
  /** Otra hoja que el pedido nombra: archivarla (borrar, con confirmación) o abrirla (lo demás). */
  | { tipo: 'hoja'; verbo: Verbo; objeto: ObjetoChat; estado: 'pregunta' | 'hecha' | 'no' }
  /** Dos hojas posibles: cuál. */
  | { tipo: 'elegir'; verbo: Verbo; candidatos: ObjetoChat[]; pregunta: string }
  /** Sólo un texto: la pregunta de la ruta sin candidatos, o dónde se archiva la hoja abierta. */
  | { tipo: 'texto'; texto: string }
  /** Es de otra tab: el link de la ruta. */
  | { tipo: 'ir'; titulo: string; link: string; propuesta: string | null };

export type BotonHoja = 'si' | 'despues' | 'crear' | 'archivar' | 'no' | 'abrir' | `elegir:${string}`;
export type EfectoHoja = { tipo: 'crear'; pedido: string } | { tipo: 'abrir'; id: string } | { tipo: 'archivar'; id: string };

export const TEXTOS_HOJA = {
  crearSinPropuesta: (pedido: string) => `¿Armo otra hoja con «${pedido}»?`,
  creando: 'Armando la hoja…',
  creada: 'Listo: la abrí.',
  errorCrear: 'No pude armarla. Prueba desde «Nueva hoja».',
  despues: 'Cuando quieras, la armo.',
  archivar: (n: string) => `¿Archivo «${n}»? Queda en Archivados.`,
  archivada: (n: string) => `Archivé «${n}».`,
  noArchivar: 'No la archivo.',
  abrir: (n: string) => `«${n}» es otra hoja.`,
  abierta: (n: string) => `Abrí «${n}».`,
  estaHoja: 'Esta hoja se archiva desde su ⋯ › Eliminar, arriba en las pestañas.',
  cual: '¿Cuál? Dime su nombre.',
  irA: (titulo: string) => `Eso se hace en ${titulo}.`,
} as const;

const EN_TEXTO = 60;
const corto = (s: string, max = EN_TEXTO) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * Una burbuja por cada pedido que NO es de la hoja abierta. `actualId` = la hoja abierta (la que no se archiva desde acá).
 * La propuesta de la ruta («¿Terminamos esto y después…?») va en la primera burbuja de crear o de otra tab, si hubo algo
 * de la hoja abierta; sin eso, cada burbuja dice lo suyo.
 */
export function burbujasDeHoja(i: Interpretacion, actualId: string): BurbujaHoja[] {
  const hayActual = i.pedidos.some((p) => p.sobre === 'actual');
  let propuesta = hayActual ? (i.propuesta?.texto ?? null) : null;
  const tomarPropuesta = () => { const p = propuesta; propuesta = null; return p; };
  return i.pedidos.flatMap((p): BurbujaHoja[] => {
    if (p.sobre === 'actual') return [];
    if (p.sobre === 'nuevo') return [{ tipo: 'crear', pedido: p.texto, propuesta: tomarPropuesta(), estado: 'pregunta' }];
    if (p.sobre === 'otra-tab') return [{ tipo: 'ir', titulo: p.titulo, link: p.link, propuesta: tomarPropuesta() }];
    // `otro`: otra hoja de este informe.
    if (p.objeto) {
      if (p.objeto.id === actualId && p.verbo === 'borrar') return [{ tipo: 'texto', texto: TEXTOS_HOJA.estaHoja }];
      if (p.objeto.id === actualId) return [];
      return [{ tipo: 'hoja', verbo: p.verbo, objeto: p.objeto, estado: 'pregunta' }];
    }
    const candidatos = p.candidatos.filter((c) => c.id !== actualId);
    if (candidatos.length >= 2) return [{ tipo: 'elegir', verbo: p.verbo, candidatos: candidatos.slice(0, 2), pregunta: p.pregunta ?? TEXTOS_HOJA.cual }];
    if (candidatos.length === 1) return [{ tipo: 'hoja', verbo: p.verbo, objeto: candidatos[0], estado: 'pregunta' }];
    return [{ tipo: 'texto', texto: p.pregunta ?? TEXTOS_HOJA.cual }];
  });
}

export type VistaBotonHoja = { id: BotonHoja; texto: string; primario: boolean };
export type VistaBurbujaHoja = { texto: string; botones: VistaBotonHoja[]; link: { texto: string; href: string } | null; ocupado: boolean; error: boolean };

/** Lo que dibuja una burbuja. Sin botones = ya hizo lo suyo (o no hay qué hacer). */
export function vistaDeBurbujaHoja(b: BurbujaHoja): VistaBurbujaHoja {
  const base = { botones: [] as VistaBotonHoja[], link: null, ocupado: false, error: false };
  switch (b.tipo) {
    case 'crear':
      if (b.estado === 'creando') return { ...base, texto: TEXTOS_HOJA.creando, ocupado: true };
      if (b.estado === 'creada') return { ...base, texto: TEXTOS_HOJA.creada };
      if (b.estado === 'error') return { ...base, texto: TEXTOS_HOJA.errorCrear, error: true, botones: [{ id: 'crear', texto: 'Probar de nuevo', primario: false }] };
      if (b.estado === 'despues') return { ...base, texto: TEXTOS_HOJA.despues, botones: [{ id: 'crear', texto: 'Crear ahora', primario: true }] };
      return {
        ...base, texto: b.propuesta ?? TEXTOS_HOJA.crearSinPropuesta(corto(b.pedido)),
        botones: [{ id: 'si', texto: 'Sí', primario: true }, { id: 'despues', texto: 'Después', primario: false }],
      };
    case 'hoja': {
      const n = corto(b.objeto.nombre);
      if (b.verbo === 'borrar') {
        if (b.estado === 'hecha') return { ...base, texto: TEXTOS_HOJA.archivada(n) };
        if (b.estado === 'no') return { ...base, texto: TEXTOS_HOJA.noArchivar };
        return { ...base, texto: TEXTOS_HOJA.archivar(n), botones: [{ id: 'archivar', texto: 'Archivar', primario: true }, { id: 'no', texto: 'No', primario: false }] };
      }
      if (b.estado === 'hecha') return { ...base, texto: TEXTOS_HOJA.abierta(n) };
      return { ...base, texto: TEXTOS_HOJA.abrir(n), botones: [{ id: 'abrir', texto: `Abrir «${corto(b.objeto.nombre, 28)}»`, primario: true }] };
    }
    case 'elegir':
      return { ...base, texto: b.pregunta, botones: b.candidatos.map((c) => ({ id: `elegir:${c.id}` as const, texto: corto(c.nombre, 28), primario: false })) };
    case 'texto':
      return { ...base, texto: b.texto };
    case 'ir':
      return { ...base, texto: b.propuesta ?? TEXTOS_HOJA.irA(b.titulo), link: { texto: `Ir a ${b.titulo}`, href: b.link } };
  }
}

/**
 * Un clic en un botón de una burbuja: la burbuja nueva y el efecto que el panel corre (crear, abrir o archivar una
 * hoja). Un botón que la burbuja ya no ofrece no hace nada (el estado manda, no la pantalla).
 */
export function pulsarHoja(b: BurbujaHoja, boton: BotonHoja): { burbuja: BurbujaHoja; efecto: EfectoHoja | null } {
  const nada = { burbuja: b, efecto: null };
  if (!vistaDeBurbujaHoja(b).botones.some((x) => x.id === boton)) return nada;
  if (b.tipo === 'crear') {
    if (boton === 'despues') return { burbuja: { ...b, estado: 'despues' }, efecto: null };
    return { burbuja: { ...b, estado: 'creando' }, efecto: { tipo: 'crear', pedido: b.pedido } };
  }
  if (b.tipo === 'hoja') {
    if (boton === 'no') return { burbuja: { ...b, estado: 'no' }, efecto: null };
    if (boton === 'archivar') return { burbuja: { ...b, estado: 'hecha' }, efecto: { tipo: 'archivar', id: b.objeto.id } };
    return { burbuja: { ...b, estado: 'hecha' }, efecto: { tipo: 'abrir', id: b.objeto.id } };
  }
  if (b.tipo === 'elegir' && boton.startsWith('elegir:')) {
    const elegido = b.candidatos.find((c) => `elegir:${c.id}` === boton);
    if (!elegido) return nada;
    // Elegida la hoja: borrar todavía confirma; lo demás la abre.
    if (b.verbo === 'borrar') return { burbuja: { tipo: 'hoja', verbo: 'borrar', objeto: elegido, estado: 'pregunta' }, efecto: null };
    return { burbuja: { tipo: 'hoja', verbo: b.verbo, objeto: elegido, estado: 'hecha' }, efecto: { tipo: 'abrir', id: elegido.id } };
  }
  return nada;
}

/** Cómo termina «crear»: la hoja se armó (y el editor la abrió) o no. */
export function trasCrear(b: BurbujaHoja, ok: boolean): BurbujaHoja {
  return b.tipo === 'crear' && b.estado === 'creando' ? { ...b, estado: ok ? 'creada' : 'error' } : b;
}
