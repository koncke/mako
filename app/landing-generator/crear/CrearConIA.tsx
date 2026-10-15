'use client';

// =============================================================================
// CrearConIA — «Crear con IA», el generador de Gamma para una landing
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D5, D9).
//
// Es el generador clásico de Gamma («Usar generador clásico», relevo gamma-ui §4.B), con
// sus pantallas y sus textos en español:
//   generar   «¿Qué te gustaría crear hoy?», cantidad de secciones, idioma, la caja
//             «Describe lo que quieres hacer», «Ejemplos de instrucciones» + «Aleatorio»,
//             «Tus indicaciones recientes» y «Generar esquema»;
//   pegar     «Escribe o pega aquí el contenido» + Generar · Condensar · Conservar;
//   importar  «Importar con IA»: «Cargar un archivo» (→ /api/landing-generator/importar,
//             multipart; su texto pasa a «Pegar texto»);
//   esquema   el esquema editable (EditorEsquema), «Personaliza tu landing» (Temas,
//             Contenido del texto, Visuales, Instrucciones adicionales) y la barra de
//             abajo con «N secciones en total» y «Generar»;
//   generando la generación en vivo: crea la landing, pide las secciones en tandas de 3
//             (las mismas `tandasDe` de la ruta, ia-reglas.ts), las va mostrando a medida
//             que llegan con el render público, guarda TODO al final y abre el editor.
// Lo propio de MaKo, que Gamma no tiene: «Objetivo de la página» (OBJETIVOS_LANDING) y
// «Sobre cuál» (una landing que ya pasó por el Diagnóstico (/landing-generator/analizar): su diagnóstico entra al
// prompt, D5). El deep link del Analyst (`?url=`) preselecciona esa landing — sólo si
// está entre las analizadas de ESTE negocio: una URL cualquiera en la query no puede
// meter un diagnóstico ajeno.
//
// La caja de Gamma 5 del Panel («¿Qué quieres crear?» + Plan | Express) entra acá con el
// pedido precargado (sessionStorage, ver `tomarCaja`): Plan = muestra el esquema para
// aprobar; Express = genera directo con el esquema y el tema sugerido.
//
// Reglas que gobiernan este archivo:
//   · Todo fetch con `AbortSignal.timeout` (pedirIA/pedirDocs): la ruta tiene su tope, el
//     navegador no (AGENTS.md, «un tope que vive en la RUTA no protege al cliente»). Los
//     esperas largas dicen cuánto tardan y qué pasa si se cierra.
//   · Una tanda que falla se REINTENTA SOLA esa tanda, no la generación entera: las otras
//     ya costaron y ya están en pantalla. Y el guardado espera a TODAS (`guardarSiCompleta`):
//     guardar con huecos sería abrir el editor con secciones que faltan sin decirlo.
//   · Lo puro (troceo, colocación, guardado al final, deep link) vive arriba y tiene test
//     (tests/editor-landing-crear.test.ts); la pantalla lo llama tal cual.
//   · Lo que no se copia de Gamma: los formatos Documento y Social, las imágenes con IA (D5:
//     van por Google Flow y se construyen después), Drive (no hay integración), el modo
//     Estudio e importar una URL (tanda 6: eso es Analizar o Replicar landing).
//
// TANDA 2 (11/10/2026, punto 6: «Al momento de crear nuevo tengo que elegir si crear landing,
// presentación...»; decisión T4): el generador recibe el TIPO (`?tipo=presentacion`, de la caja
// del Panel, CajaCrear.tsx) y lo deja cambiar con las pastillas Landing | Presentación. Con una
// presentación: el alta lleva `formato: 'presentacion'` y la proporción (`configDeCreacion`), todo
// pedido a la IA lleva `params.formato` (`paramsDeTipo`: diapositivas, poco texto, diseños
// optimizados), «Sobre cuál» se esconde (el diagnóstico de una página no es contexto de una
// presentación) y la pantalla dice «diapositiva» donde decía «sección» (`termino`, el mismo de
// api-tipos que usa el editor). El tipo de una generación se CONGELA al arrancarla (`tipoGen`):
// las tandas que siguen tienen que pedir lo mismo que el documento que se creó. Y la caja de
// «Generar» suma el micrófono (`BotonDictar`, el de «Nueva automatización»).
//
// TANDA 6 (14/10/2026). Martín, textual: «2. La sección de "Importar con IA" no debería ser otra ruta,
// todo siempre en la misma ruta. 3. La sección de "Crear con IA", le faltan las opciones de "Analizar
// Landing" y "Replicar Landing". Y que el botón de "Importar" que solo sea importar, no que sea con URL,
// para eso ya las otras opciones que te dije... Y esta sección de "Crear con IA" debería estar en la tab
// principal de landing generator, en la sección de "¿Qué vas a crear hoy?".»
//   · Se monta A LA DERECHA del Panel (Inicio.tsx); /landing-generator/crear redirige ahí. La pantalla
//     «inicio» (las tarjetas «¿Cómo te gustaría empezar?») se fue a la caja del Panel (CajaCrear.tsx, «Crear
//     con IA», con Analizar y Replicar landing), y con ella «Tus indicaciones recientes», que viven en
//     Generar y en Pegar texto. «Inicio» y «Analizar una página» son funciones del Panel (`onSalir`,
//     `onAnalizar`), no links: el Panel ya está montado y un <Link> a su misma ruta no le cambia la derecha.
//   · «Importar» es SÓLO un archivo. «Importar desde URL» se fue: una página de afuera se ANALIZA o se
//     REPLICA (crear/Replicar.tsx, con su formato y el lector del navegador cuando el server no puede).
//   · El pedido de la caja llega EN MEMORIA (`arranque`, `ArranqueIA` de ../panel-reglas.ts): el texto (Plan
//     o Express) o un archivo adjunto, que va a «Pegar texto» con lo escrito como instrucciones. El link
//     viejo de la caja (`?desde=caja`) sigue leyendo sessionStorage (`tomarCaja`) mientras dura el deploy.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useWs } from '@/app/_ui/Link';
import { OBJETIVOS_LANDING, type ObjetivoLanding } from '@/lib/landing-spec';
import { NODO, nuevoId, type JsonNodo, type LandingContenido } from '@/lib/editor-landing/doc';
import type {
  ConfigLanding, Esquema, FuenteImagenes, ParamsGeneracion, PedidoIA, TemaPropio, TextoPorSeccion,
} from '@/lib/editor-landing/api-tipos';
import { MAX_INSTRUCCIONES, MAX_SECCIONES, MIN_SECCIONES, PARAMS_DEFAULT, tandasDe, tarjetaDesdeEsquema } from '@/lib/editor-landing/ia-reglas';
import { temaPorId } from '@/lib/editor-landing/temas';
import { resolverAnclas } from '@/lib/editor-landing/ia-bloques';
import { ACCEPT_IMPORTAR, porQueNoPuedo, puedeLeerse } from '@/lib/formatos-archivo';
import {
  Desplegable, Ico, MiniaturaLanding, guardarLocal, haceCuanto, hostDe, irDuro, leerLocal,
  marcarReciente, pedirDocs, pedirIA, tomarCaja, type OpcionDesplegable,
} from '../MiniaturaLanding';
import { leerArchivo } from '../cliente';
import type { ArranqueIA, PasoIA } from '../panel-reglas';
import { CSS_ESQUEMA, EditorEsquema, esquemaParaEnviar, textoSecciones } from './EditorEsquema';
import { SelectorTemaCrear, temaSugerido } from './SelectorTemaCrear';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import {
  PROPORCION_IA, configDeCreacion, cuantas, docDe, formatoDeTipo, paramsDeTipo, termino, tipoValido, type TipoCrear,
} from './tipo';
import { CSS_TIPO, SelectorTipo } from './PiezasTipo';

// ─────────────────────────────────────────────────────────────────────────────
// Lo puro (con test)
// ─────────────────────────────────────────────────────────────────────────────

export type LandingAnalizada = { url: string; veredicto: string | null; score: number | null };

/**
 * La landing de base que pide el deep link del Diagnóstico (`?url=`), sólo si es una de
 * las analizadas de este negocio. Comparación exacta (la URL viaja tal cual la guarda el
 * Analyst): un parecido no es una clave.
 */
export function baseDelDeepLink(url: string | null | undefined, analizadas: readonly { url: string }[]): string | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  return analizadas.some((a) => a.url === u) ? u : null;
}

/** Un objetivo de la query, si es uno de la lista cerrada. */
export function objetivoValido(v: string | null | undefined): ObjetivoLanding | null {
  return OBJETIVOS_LANDING.some((o) => o.value === v) ? (v as ObjetivoLanding) : null;
}

/** «Sección 4» o «Secciones 4–6» (en base 1, como las ve la persona); en una presentación, «Diapositiva…». */
export function rotuloTanda(indices: readonly number[], tipo: TipoCrear = 'landing'): string {
  if (!indices.length) return '';
  const a = indices[0] + 1;
  const b = indices[indices.length - 1] + 1;
  return a === b ? `${termino(tipo, { mayuscula: true })} ${a}` : `${termino(tipo, { plural: true, mayuscula: true })} ${a}–${b}`;
}

/** Cuántas tandas se piden a la vez. Dos: la cuota por minuto de la IA gratis es chica. */
export const TANDAS_A_LA_VEZ = 2;

export type EstadoTanda = 'esperando' | 'pidiendo' | 'lista' | 'error';
export type Tanda = { indices: number[]; estado: EstadoTanda; error?: string };
export type EstadoGen = {
  tandas: Tanda[];
  /** Una por sección del esquema, en su orden; null = todavía no llegó. */
  tarjetas: (JsonNodo | null)[];
  guardado: 'no' | 'guardando' | 'listo' | 'error';
  errorGuardar?: string;
};
export type ResultadoTanda = { ok: true; tarjetas: JsonNodo[] } | { ok: false; error: string };

export function nuevaGeneracion(total: number): EstadoGen {
  const tandas = tandasDe(total).map((indices) => ({ indices, estado: 'esperando' as const }));
  const n = tandas.reduce((m, t) => Math.max(m, ...t.indices.map((i) => i + 1)), 0);
  return { tandas, tarjetas: Array.from({ length: n }, () => null), guardado: 'no' };
}

/**
 * Pone la respuesta de una tanda en su lugar. El contrato de la ruta es UNA tarjeta por
 * índice pedido, en orden (ia.ts, `secciones`); una respuesta con otra cantidad o con algo
 * que no es una sección es un error de esa tanda — no se adivina cuál faltó.
 */
export function colocarTanda(e: EstadoGen, k: number, r: ResultadoTanda): EstadoGen {
  const t = e.tandas[k];
  if (!t) return e;
  const tandas = (nueva: Tanda) => e.tandas.map((x, i) => (i === k ? nueva : x));
  if (!r.ok) return { ...e, tandas: tandas({ ...t, estado: 'error', error: r.error }) };
  if (r.tarjetas.length !== t.indices.length || r.tarjetas.some((x) => !x || x.type !== NODO.tarjeta)) {
    return { ...e, tandas: tandas({ ...t, estado: 'error', error: 'Faltaron secciones en la respuesta.' }) };
  }
  const tarjetas = [...e.tarjetas];
  t.indices.forEach((i, j) => { tarjetas[i] = r.tarjetas[j]; });
  return { ...e, tarjetas, tandas: tandas({ ...t, estado: 'lista', error: undefined }) };
}

export function todasListas(e: EstadoGen): boolean {
  return e.tandas.length > 0 && e.tandas.every((t) => t.estado === 'lista') && e.tarjetas.every(Boolean);
}

/**
 * Lo que la generación necesita de afuera. `leer`/`escribir` son UNA fuente de verdad (un
 * ref en la pantalla): una tanda que se reintenta mientras otras siguen corriendo escribe
 * sobre el estado de AHORA, no sobre la foto de cuando arrancó.
 */
export type DepsGeneracion = {
  leer: () => EstadoGen;
  escribir: (e: EstadoGen) => void;
  pedir: (indices: number[]) => Promise<ResultadoTanda>;
  /** Se llama UNA vez, con todas las secciones en el orden del esquema. */
  guardar: (tarjetas: JsonNodo[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  aLaVez?: number;
};

/** Guarda si ya están todas y nadie está guardando. El chequeo y la marca van juntos (sin await en el medio). */
export async function guardarSiCompleta(d: DepsGeneracion): Promise<void> {
  const e = d.leer();
  if (!todasListas(e) || e.guardado === 'guardando' || e.guardado === 'listo') return;
  d.escribir({ ...e, guardado: 'guardando', errorGuardar: undefined });
  let r: { ok: true } | { ok: false; error: string };
  try {
    r = await d.guardar(e.tarjetas as JsonNodo[]);
  } catch (err) {
    r = { ok: false, error: err instanceof Error ? err.message : 'No se pudo guardar.' };
  }
  const f = d.leer();
  d.escribir(r.ok ? { ...f, guardado: 'listo' } : { ...f, guardado: 'error', errorGuardar: r.error });
}

/**
 * Corre las tandas pedidas (por su posición en `tandas`), de a `aLaVez`, y al final guarda
 * si quedó todo. Una tanda que ya está pidiendo o lista no se vuelve a pedir: un doble clic
 * en «Reintentar» no paga dos veces.
 */
export async function correrTandas(cuales: readonly number[], d: DepsGeneracion): Promise<void> {
  const cola = [...cuales];
  const marcar = (k: number, cambio: Partial<Tanda>) => {
    const e = d.leer();
    d.escribir({ ...e, tandas: e.tandas.map((t, i) => (i === k ? { ...t, ...cambio } : t)) });
  };
  const trabajador = async () => {
    for (let k = cola.shift(); k !== undefined; k = cola.shift()) {
      const t = d.leer().tandas[k];
      if (!t || t.estado === 'pidiendo' || t.estado === 'lista') continue;
      marcar(k, { estado: 'pidiendo', error: undefined });
      let r: ResultadoTanda;
      try {
        r = await d.pedir(t.indices);
      } catch (err) {
        r = { ok: false, error: err instanceof Error ? err.message : 'Algo falló.' };
      }
      d.escribir(colocarTanda(d.leer(), k, r));
    }
  };
  const n = Math.max(1, Math.min(d.aLaVez ?? TANDAS_A_LA_VEZ, cola.length || 1));
  await Promise.all(Array.from({ length: n }, () => trabajador()));
  await guardarSiCompleta(d);
}

/**
 * La salida cuando una tanda no sale ni reintentando (la IA sin cuota, por ejemplo): las
 * secciones que faltan se arman con el título y los puntos del ESQUEMA, que es texto que la
 * persona aprobó — no un relleno que mienta (la misma regla que `tarjetaDesdeEsquema` en la
 * ruta). Sólo lo dispara la persona con «Completar con el esquema»; nunca es automático.
 */
export function completarConEsquema(e: EstadoGen, esq: Esquema): EstadoGen {
  const tarjetas = e.tarjetas.map((t, i) => t ?? (esq.secciones[i] ? tarjetaDesdeEsquema(esq.secciones[i], i === 0) : null));
  const tandas = e.tandas.map((t) => (t.estado === 'error' && t.indices.every((i) => tarjetas[i]) ? { ...t, estado: 'lista' as const, error: undefined } : t));
  return { ...e, tarjetas, tandas };
}

/**
 * El contenido que se guarda: la página de la landing recién creada (su id) con las secciones.
 * Cada tanda se convierte SOLA en el server, así que un botón «al formulario» o «a la sección 3»
 * de una tanda que no tiene ese destino vuelve PENDIENTE (`#t-formulario`, `#t-seccion-3`): acá,
 * con todas juntas y en orden, se resuelven (`resolverAnclas`). Sin esto el botón no lleva a nada.
 */
export function contenidoGenerado(paginaId: string, tarjetas: JsonNodo[]): LandingContenido {
  return { v: 1, paginas: [{ id: paginaId, titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: resolverAnclas(tarjetas) } }] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogos de la pantalla
// ─────────────────────────────────────────────────────────────────────────────

/** «Ejemplos de instrucciones»: casos de landing, sin nombres de negocios reales. */
const EJEMPLOS_LANDING: readonly { icono: string; texto: string }[] = [
  { icono: 'calendario', texto: 'Landing para agendar una llamada de diagnóstico gratis con una agencia de marketing' },
  { icono: 'videollamada', texto: 'Registro a un webinar en vivo sobre finanzas personales, con página de gracias' },
  { icono: 'graduacion', texto: 'Venta de un curso online de fotografía con celular, con precio y garantía' },
  { icono: 'libro', texto: 'Página para descargar una guía gratis de recetas saludables a cambio del correo' },
  { icono: 'salud', texto: 'Landing para una clínica dental que quiere más citas de limpieza' },
  { icono: 'cohete', texto: 'Lista de espera para el lanzamiento de una app de hábitos' },
  { icono: 'calculadora', texto: 'Servicios de un despacho contable para pequeñas empresas' },
  { icono: 'diamante', texto: 'Aplicación a una mentoría de alto valor para coaches' },
  { icono: 'pesa', texto: 'Gimnasio de barrio con una clase de prueba gratis' },
  { icono: 'laptop', texto: 'Software de reservas para restaurantes con prueba gratis de 14 días' },
  { icono: 'ubicacion', texto: 'Inscripción a un taller presencial de cerámica' },
  { icono: 'edificio', texto: 'Inmobiliaria que busca compradores para departamentos en preventa' },
];
/** Los de una presentación (T4), con la misma regla: genéricos, sin negocios ni personas reales. */
const EJEMPLOS_PRESENTACION: readonly { icono: string; texto: string }[] = [
  { icono: 'cohete', texto: 'Pitch de una startup de reservas para restaurantes, para inversionistas' },
  { icono: 'apreton', texto: 'Propuesta comercial de una agencia de marketing para un cliente nuevo' },
  { icono: 'grafico', texto: 'Informe mensual de resultados de campañas de anuncios' },
  { icono: 'graduacion', texto: 'Clase de un curso sobre cómo vender por WhatsApp' },
  { icono: 'usuarios', texto: 'Onboarding para un cliente que empieza un servicio de contabilidad' },
  { icono: 'calendario', texto: 'Plan de marketing del próximo trimestre para una tienda online' },
  { icono: 'videollamada', texto: 'Webinar sobre finanzas personales para principiantes' },
  { icono: 'trofeo', texto: 'Caso de éxito de una clínica que duplicó sus citas' },
  { icono: 'ruta', texto: 'Roadmap de producto de una app de hábitos para el año' },
  { icono: 'comunidad', texto: 'Presentación del equipo de una consultora a un cliente' },
  { icono: 'dinero', texto: 'Presentación de ventas de un software para gimnasios' },
  { icono: 'objetivo', texto: 'Reporte de resultados del semestre para la dirección' },
];
const EJEMPLOS_DE: Record<TipoCrear, readonly { icono: string; texto: string }[]> = { landing: EJEMPLOS_LANDING, presentacion: EJEMPLOS_PRESENTACION };
const EJEMPLOS_VISIBLES = 6;

const IDIOMAS: readonly OpcionDesplegable<string>[] = [
  { valor: 'es-MX', texto: 'Español (México)' },
  { valor: 'es-ES', texto: 'Español (España)' },
  { valor: 'en-US', texto: 'English (US)' },
  { valor: 'pt-BR', texto: 'Português (Brasil)' },
];

const TEXTOS: readonly { valor: TextoPorSeccion; texto: string }[] = [
  { valor: 'breve', texto: 'Breve' },
  { valor: 'medio', texto: 'Medio' },
  { valor: 'detallado', texto: 'Detallado' },
  { valor: 'extenso', texto: 'Extenso' },
];

const MODOS_TEXTO: readonly { valor: ParamsGeneracion['modoTexto']; texto: string; ayuda: string; icono: string }[] = [
  { valor: 'generar', texto: 'Generar', ayuda: 'Usa tu texto como guía y escribe el copy completo', icono: 'destellos' },
  { valor: 'condensar', texto: 'Condensar', ayuda: 'Resume tu texto sin agregar ideas', icono: 'flecha-abajo' },
  { valor: 'conservar', texto: 'Conservar', ayuda: 'Usa tu texto palabra por palabra', icono: 'candado' },
];

const FUENTES: readonly OpcionDesplegable<FuenteImagenes>[] = [
  { valor: 'stock', texto: 'Fotos de archivo', sub: 'Buscar fotos gratuitas de alta resolución', icono: 'camara' },
  { valor: 'marcadores', texto: 'Marcadores de posición de imagen', sub: 'Genera marcadores de posición vacíos para tus propias imágenes', icono: 'imagen' },
  { valor: 'ninguna', texto: 'No agregues imágenes', icono: 'ojo-tachado' },
];

const OBJETIVOS: readonly OpcionDesplegable<ObjetivoLanding>[] = OBJETIVOS_LANDING.map((o) => ({ valor: o.value, texto: o.label, sub: o.hint }));

/**
 * «Tus indicaciones recientes»: comodidad de ESTE navegador (localStorage), nunca un dato. Por dónde
 * entró el pedido: una instrucción (Generar) o un texto (Pegar, también el de un archivo importado).
 * Tanda 6: las de «Importar desde URL» que hayan quedado guardadas se ignoran (esa entrada se fue).
 */
type Origen = 'generar' | 'pegar';
type Indicacion = { modo: Origen; texto: string; t: number };
const CLAVE_INDICACIONES = 'gp.crear.indicaciones';
const TOPE_INDICACIONES = 6;

function leerIndicaciones(): Indicacion[] {
  const l = leerLocal<unknown>(CLAVE_INDICACIONES, []);
  return Array.isArray(l)
    ? (l as Indicacion[]).filter((x) => x && typeof x.texto === 'string' && x.texto.trim() && (x.modo === 'generar' || x.modo === 'pegar') && typeof x.t === 'number')
    : [];
}

function recordarIndicacion(modo: Origen, texto: string): void {
  const t = texto.trim().slice(0, 20_000);
  if (!t) return;
  const otras = leerIndicaciones().filter((x) => !(x.modo === modo && x.texto === t));
  guardarLocal(CLAVE_INDICACIONES, [{ modo, texto: t, t: Date.now() }, ...otras].slice(0, TOPE_INDICACIONES));
}

// ─────────────────────────────────────────────────────────────────────────────
// La pantalla
// ─────────────────────────────────────────────────────────────────────────────

type Paso = PasoIA | 'esquema' | 'generando';
type Falla = { texto: string; reintentar?: () => void };

export type PropsCrear = {
  analizadas: LandingAnalizada[];
  /** Si la lista de analizadas no se pudo leer (el «Sobre cuál» lo dice en vez de quedar vacío). */
  errorAnalizadas: string | null;
  propios: TemaPropio[];
  /** El paso por el que se entra (la tarjeta de la caja, o `?paso=` de la URL). */
  paso: PasoIA;
  /** Lo crudo del tipo (T4): 'presentacion' crea una presentación; lo demás, una landing. */
  tipo: string | null;
  /** Lo que trae al abrirse, UNA vez: el pedido de la caja, su archivo, el link viejo o el deep link del Analyst. */
  arranque: ArranqueIA | null;
  /** «Inicio»: vuelve a la caja del Panel. */
  onSalir: () => void;
  /** «Analizar una página»: el Diagnóstico del Panel, para pegar una dirección. */
  onAnalizar: () => void;
  /** El paso de entrada o el tipo cambiaron: el Panel lo escribe en la URL. */
  onPaso?: (paso: PasoIA, tipo: TipoCrear) => void;
};

export function CrearConIA(props: PropsCrear) {
  const { analizadas, errorAnalizadas, propios } = props;
  const ws = useWs();

  const arranque = props.arranque;
  const baseInicial = baseDelDeepLink(arranque?.base, analizadas);
  const [paso, setPaso] = useState<Paso>(() => {
    if (arranque?.archivo) return 'pegar';
    if (arranque?.prompt || arranque?.sesion || baseInicial) return 'generar';
    return props.paso;
  });
  const [origen, setOrigen] = useState<Origen>('generar');
  const [tipo, setTipo] = useState<TipoCrear>(() => tipoValido(props.tipo));
  const [prompt, setPrompt] = useState('');
  const [texto, setTexto] = useState('');
  const [params, setParams] = useState<ParamsGeneracion>(() => ({
    ...PARAMS_DEFAULT,
    objetivo: objetivoValido(arranque?.objetivo) ?? PARAMS_DEFAULT.objetivo,
    basadoEnUrl: baseInicial,
  }));
  const [esquema, setEsquema] = useState<Esquema | null>(null);
  const [temaElegido, setTemaElegido] = useState<string | null>(null);
  const [cargando, setCargando] = useState<null | 'esquema' | 'archivo'>(null);
  const [falla, setFalla] = useState<Falla | null>(null);
  const [personalizar, setPersonalizar] = useState(false);
  const [ejemplo0, setEjemplo0] = useState(0);
  const [recientes, setRecientes] = useState<Indicacion[]>([]);
  const [ahora, setAhora] = useState<number | null>(null);
  const [gen, setGen] = useState<EstadoGen | null>(null);
  const [crear, setCrear] = useState<'no' | 'creando' | 'lista' | 'error'>('no');
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  const sugerido = temaSugerido(params.objetivo);
  const temaId = temaElegido ?? sugerido;
  const tema = useMemo(() => temaPorId(temaId, propios), [temaId, propios]);

  // Lo que leen los pasos asíncronos: la versión de AHORA, no la del render en que arrancaron.
  const vivo = useRef({ prompt, texto, params, temaId, tipo });
  useLayoutEffect(() => { vivo.current = { prompt, texto, params, temaId, tipo }; });
  /**
   * El tipo de la generación EN CURSO, congelado al arrancarla: las tandas piden lo que se creó.
   * El ref lo leen los pasos asíncronos; el estado, la pantalla (un ref no se lee al dibujar).
   */
  const tipoGen = useRef<TipoCrear>(tipo);
  const [tipoDeGen, setTipoDeGen] = useState<TipoCrear>(tipo);
  const genRef = useRef<EstadoGen | null>(null);
  const esqRef = useRef<Esquema | null>(null);
  const docRef = useRef<{ id: number; version: number; paginaId: string } | null>(null);
  /**
   * ¿Sigue montada? Adentro del Panel se puede salir a la mitad (la barra de la izquierda sigue ahí): la
   * generación termina y se guarda igual, pero no se arrastra a la persona al editor desde otra pantalla.
   */
  const montada = useRef(true);
  useEffect(() => { montada.current = true; return () => { montada.current = false; }; }, []);

  // Comodidades de este navegador: se leen después de montar (el server no las tiene).
  useEffect(() => {
    setRecientes(leerIndicaciones());
    setAhora(Date.now());
  }, []);

  const set = <K extends keyof ParamsGeneracion>(k: K, v: ParamsGeneracion[K]) => setParams((p) => ({ ...p, [k]: v }));

  // ── El esquema ────────────────────────────────────────────────────────────

  const deps = useCallback((): DepsGeneracion => ({
    leer: () => genRef.current as EstadoGen,
    escribir: (e) => { genRef.current = e; setGen(e); },
    pedir: async (indices) => {
      const esq = esqRef.current;
      if (!esq) return { ok: false, error: 'Falta el esquema.' };
      const r = await pedirIA({ accion: 'secciones', esquema: esq, indices, params: paramsDeTipo(vivo.current.params, tipoGen.current), temaId: vivo.current.temaId }, 90_000);
      if (!r.ok) return { ok: false, error: r.error };
      return 'tarjetas' in r ? { ok: true, tarjetas: r.tarjetas } : { ok: false, error: 'Respuesta inesperada.' };
    },
    guardar: async (tarjetas) => {
      const d = docRef.current;
      const esq = esqRef.current;
      if (!d || !esq) return { ok: false, error: `La ${docDe(tipoGen.current)} no se creó.` };
      const r = await pedirDocs({ accion: 'guardar', id: d.id, version: d.version, titulo: esq.titulo, contenido: contenidoGenerado(d.paginaId, tarjetas) }, 60_000);
      if (!r.ok) return { ok: false, error: r.conflicto ? `Otra pestaña cambió esta ${docDe(tipoGen.current)}.` : r.error };
      d.version = r.version;
      // Lo que cambió es QUÉ EXISTE (una landing con contenido): navegación dura.
      if (montada.current) irDuro(`/landing-generator/${d.id}`, ws);
      return { ok: true };
    },
  }), [ws]);

  /** Crea la landing (una sola vez) y corre todas las tandas. `de` = por dónde entró el pedido. */
  const generar = useCallback(async (esqCrudo: Esquema, de: Origen) => {
    const esq = esquemaParaEnviar(esqCrudo);
    if (!esq.secciones.length) { setFalla({ texto: `Agrega al menos una ${termino(vivo.current.tipo)}.` }); return; }
    // Con el documento ya creado (un reintento), el tipo es el suyo: no el que se eligió después.
    if (!docRef.current) { tipoGen.current = vivo.current.tipo; setTipoDeGen(vivo.current.tipo); }
    esqRef.current = esq;
    setEsquema(esq);
    setFalla(null);
    const inicial = nuevaGeneracion(esq.secciones.length);
    genRef.current = inicial;
    setGen(inicial);
    setPaso('generando');

    if (!docRef.current) {
      setCrear('creando');
      setErrorCrear(null);
      const v = vivo.current;
      const p = paramsDeTipo(v.params, tipoGen.current);
      const config: Partial<ConfigLanding> = configDeCreacion(tipoGen.current, v.temaId, {
        modo: 'ia',
        pedido: (de === 'generar' ? v.prompt : v.texto).slice(0, 2_000),
        objetivo: p.objetivo,
        basadoEnUrl: p.basadoEnUrl,
      });
      const r = await pedirDocs({ accion: 'crear', titulo: esq.titulo, config }, 30_000);
      if (!r.ok) { setCrear('error'); setErrorCrear(r.error); return; }
      docRef.current = { id: r.doc.id, version: r.doc.version, paginaId: r.doc.contenido.paginas[0]?.id ?? nuevoId('p') };
      marcarReciente(r.doc.id);
    }
    setCrear('lista');
    await correrTandas(inicial.tandas.map((_, k) => k), deps());
  }, [deps]);

  const pedirEsquema = useCallback(async (de: Origen, express = false) => {
    const v = vivo.current;
    let cuerpo: PedidoIA;
    if (de === 'generar') {
      if (!v.prompt.trim()) return;
      cuerpo = { accion: 'esquema', modo: 'generar', prompt: v.prompt, params: paramsDeTipo(v.params, v.tipo) };
    } else {
      if (!v.texto.trim()) return;
      cuerpo = { accion: 'esquema', modo: 'pegar', texto: v.texto, params: paramsDeTipo(v.params, v.tipo) };
    }
    recordarIndicacion(de, de === 'generar' ? v.prompt : v.texto);
    setCargando('esquema');
    setFalla(null);
    const r = await pedirIA(cuerpo, 150_000);
    setCargando(null);
    if (!r.ok) { setFalla({ texto: r.error, reintentar: () => void pedirEsquema(de, express) }); return; }
    if (!('esquema' in r)) { setFalla({ texto: 'Respuesta inesperada.', reintentar: () => void pedirEsquema(de, express) }); return; }
    setOrigen(de);
    setEsquema(r.esquema);
    if (express) void generar(r.esquema, de);
    else setPaso('esquema');
  }, [generar]);

  // Lo que trae la caja del Panel (`arranque`), UNA vez: el ref sobrevive al doble montaje del modo estricto
  // (un esquema se paga). Un archivo adjunto va a «Pegar texto» con lo escrito como instrucciones; un pedido,
  // a «Generar». El link viejo de la caja (`sesion`) lo busca en sessionStorage y, si no está, en la URL.
  const arrancado = useRef(false);
  useEffect(() => {
    if (arrancado.current) return;
    arrancado.current = true;
    if (!arranque) return;
    const express = arranque.modo === 'express';
    if (arranque.archivo) {
      const instrucciones = (arranque.prompt ?? '').trim().slice(0, MAX_INSTRUCCIONES);
      const p = { ...vivo.current.params, instrucciones };
      setTexto(arranque.archivo.texto);
      setParams(p);
      vivo.current = { ...vivo.current, texto: arranque.archivo.texto, params: p };
      void pedirEsquema('pegar', express);
      return;
    }
    const caja = arranque.sesion
      ? tomarCaja() ?? (arranque.prompt ? { prompt: arranque.prompt, modo: arranque.modo ?? 'plan' } : null)
      : arranque.prompt ? { prompt: arranque.prompt, modo: arranque.modo ?? 'plan' } : null;
    if (!caja) return;
    setPrompt(caja.prompt);
    vivo.current = { ...vivo.current, prompt: caja.prompt };
    void pedirEsquema('generar', caja.modo === 'express');
  }, [arranque, pedirEsquema]);

  // El paso de entrada y el tipo viajan en la URL (el Panel los escribe): un F5 vuelve acá.
  const onPaso = props.onPaso;
  useEffect(() => {
    if (paso === 'generar' || paso === 'pegar' || paso === 'importar') onPaso?.(paso, tipo);
  }, [paso, tipo, onPaso]);

  // Mientras se genera y no se guardó, cerrar la pestaña pierde lo generado: se avisa.
  const enCurso = paso === 'generando' && gen?.guardado !== 'listo';
  useEffect(() => {
    if (!enCurso) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [enCurso]);

  // ── Importar un archivo ──────────────────────────────────────────────────

  const subirArchivo = useCallback(async (f: File) => {
    if (!puedeLeerse(f.name, f.type)) { setFalla({ texto: porQueNoPuedo(f.name) }); return; }
    setCargando('archivo');
    setFalla(null);
    // El lector compartido con el «+» de la caja (../cliente.ts): multipart, con su plazo, nunca tira.
    const r = await leerArchivo(f);
    setCargando(null);
    if (!r.ok) { setFalla({ texto: r.error }); return; }
    setTexto(r.texto);
    setPaso('pegar');
  }, []);

  // ── Generación: reintentos ───────────────────────────────────────────────

  const reintentarTanda = (k: number) => { void correrTandas([k], deps()); };
  const reintentarGuardar = () => { void guardarSiCompleta(deps()); };
  const reintentarCrear = () => { if (esqRef.current) void generar(esqRef.current, origen); };
  const completar = () => {
    const d = deps();
    const e = genRef.current;
    if (!e || !esqRef.current) return;
    d.escribir(completarConEsquema(e, esqRef.current));
    void guardarSiCompleta(d);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const ir = (p: Paso) => { setFalla(null); setPaso(p); };
  // «Atrás» sólo desde el esquema (a donde se escribió); desde un paso de entrada, «Inicio» vuelve a la caja.
  const atras: Paso | null = paso === 'esquema' ? origen : null;
  const ocupado = cargando !== null;
  const opcionesBase = useMemo<OpcionDesplegable<string>[]>(() => [
    { valor: '', texto: 'Sin landing de base', icono: 'cerrar' },
    ...analizadas.map((a) => ({
      valor: a.url,
      texto: `Sobre ${hostDe(a.url)}`,
      sub: a.score != null ? `Puntaje ${a.score}${a.veredicto ? ` · ${a.veredicto}` : ''}` : a.veredicto ?? undefined,
      icono: 'reporte',
    })),
  ], [analizadas]);

  const controles = (conCantidad: boolean) => (
    <div className="gp-controles">
      {conCantidad && (
        <div className="gp-stepper" role="group" aria-label={`Cantidad de ${termino(tipo, { plural: true })}`}>
          <button type="button" aria-label={`Menos ${termino(tipo, { plural: true })}`} disabled={ocupado || params.cantidad <= MIN_SECCIONES} onClick={() => set('cantidad', params.cantidad - 1)}><Ico n="menos" t={12} /></button>
          <span>{cuantas(params.cantidad, tipo)}</span>
          <button type="button" aria-label={`Más ${termino(tipo, { plural: true })}`} disabled={ocupado || params.cantidad >= MAX_SECCIONES} onClick={() => set('cantidad', params.cantidad + 1)}><Ico n="mas" t={12} /></button>
        </div>
      )}
      <Desplegable etiqueta="Idioma de salida" icono="traducir" valor={params.idioma} opciones={IDIOMAS} onCambio={(v) => set('idioma', v)} deshabilitado={ocupado} />
      <Desplegable etiqueta="Objetivo" icono="objetivo" valor={params.objetivo} opciones={OBJETIVOS} onCambio={(v) => set('objetivo', v)} deshabilitado={ocupado} ancho={320} />
      {/* «Sobre cuál» es de una LANDING (su diagnóstico entra al prompt): en una presentación no se
          dibuja, y `paramsDeTipo` tampoco lo manda — nada viaja a la IA sin estar en la pantalla. */}
      {tipo === 'landing' && (
        <>
          <Desplegable
            etiqueta="Sobre cuál"
            valor={params.basadoEnUrl ?? ''}
            opciones={opcionesBase}
            onCambio={(v) => set('basadoEnUrl', v || null)}
            deshabilitado={ocupado || (!analizadas.length && !errorAnalizadas)}
            ancho={340}
          />
          {errorAnalizadas && <span className="gp-nota-error">No se pudieron leer las landings analizadas.</span>}
          {/* Sin analizadas el desplegable queda apagado: esto dice dónde se analiza (el ex Landing Analyst). Es una
              función del Panel y no un link: el Panel ya está montado (ver la cabecera, tanda 6). */}
          <button type="button" className="gp-enlace-boton" onClick={props.onAnalizar}>Analizar una página</button>
        </>
      )}
    </div>
  );

  const camposPersonalizar = (
    <div className="gp-personalizar">
      <div className="gp-campo-fila">
        <span className="gp-etiqueta">Cantidad de texto por {termino(tipo)}</span>
        <div className="gp-segmentado" role="radiogroup" aria-label={`Cantidad de texto por ${termino(tipo)}`}>
          {TEXTOS.map((t) => (
            <button key={t.valor} type="button" role="radio" aria-checked={params.textoPorSeccion === t.valor} onClick={() => set('textoPorSeccion', t.valor)}>{t.texto}</button>
          ))}
        </div>
      </div>
      <label className="gp-campo-fila">
        <span className="gp-etiqueta">Escribe para...</span>
        <input className="gp-campo" value={params.audiencia} maxLength={300} placeholder="Por ejemplo, dueños de restaurantes" onChange={(e) => set('audiencia', e.target.value)} />
      </label>
      <label className="gp-campo-fila">
        <span className="gp-etiqueta">Tono</span>
        <input className="gp-campo" value={params.tono} maxLength={120} placeholder="Por ejemplo, cercano y profesional" onChange={(e) => set('tono', e.target.value)} />
      </label>
      <div className="gp-campo-fila">
        <span className="gp-etiqueta">Fuente de la imagen</span>
        <Desplegable etiqueta="Fuente de la imagen" valor={params.fuenteImagenes} opciones={FUENTES} onCambio={(v) => set('fuenteImagenes', v)} ancho={340} />
      </div>
      <label className="gp-campo-fila">
        <span className="gp-etiqueta">Instrucciones adicionales</span>
        <textarea className="gp-campo" rows={3} value={params.instrucciones} maxLength={MAX_INSTRUCCIONES} placeholder="Opcional" onChange={(e) => set('instrucciones', e.target.value)} />
      </label>
    </div>
  );

  /** Las pastillas Landing | Presentación (T4). Cambiar de tipo no borra lo escrito. */
  const selectorTipo = <SelectorTipo valor={tipo} onCambio={setTipo} deshabilitado={ocupado} />;

  const lineaFalla = falla && (
    <div className="gp-error" role="alert">
      <span>{falla.texto}</span>
      {falla.reintentar && <button type="button" className="gp-btn gp-btn-contorno" onClick={falla.reintentar}>Reintentar</button>}
    </div>
  );

  const escribiendo = cargando === 'esquema' && (
    <div className="gp-esperando" role="status">
      <span className="gp-giro" />
      <span><strong>Escribiendo esquema</strong> · Puede tardar hasta un minuto.</span>
    </div>
  );

  let cuerpo: ReactNode = null;

  /** «Tus indicaciones recientes» de ESE paso (las de Generar en Generar, las de Pegar en Pegar). */
  const recientesDe = (modo: Origen) => {
    const lista = recientes.filter((r) => r.modo === modo);
    if (!lista.length) return null;
    return (
      <section className="gp-recientes" aria-labelledby={`gp-recientes-${modo}`}>
        <h2 id={`gp-recientes-${modo}`} className="gp-separador-texto">Recientes</h2>
        <ul>
          {lista.map((r) => (
            <li key={`${r.modo}-${r.t}`}>
              <button type="button" className="gp-reciente" disabled={ocupado} onClick={() => (modo === 'generar' ? setPrompt(r.texto) : setTexto(r.texto))}>
                <span className="gp-reciente-textos">
                  <span className="gp-reciente-titulo">{r.texto.split('\n')[0].slice(0, 90)}</span>
                  {ahora ? <span className="gp-reciente-sub">{haceCuanto(r.t, ahora)}</span> : null}
                </span>
                <Ico n="chevron-derecha" t={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  if (paso === 'generar') {
    const lista = EJEMPLOS_DE[tipo];
    const ejemplos = Array.from({ length: EJEMPLOS_VISIBLES }, (_, k) => lista[(ejemplo0 + k) % lista.length]);
    cuerpo = (
      <div className="gp-crear-centro">
        <h1 className="gp-crear-h1">Generar</h1>
        <p className="gp-crear-sub">¿Qué te gustaría crear hoy?</p>
        {selectorTipo}
        {controles(true)}
        <div className="gp-caja-prompt">
          <textarea
            className="gp-caja-texto"
            value={prompt}
            rows={3}
            maxLength={8_000}
            placeholder="Describe lo que quieres hacer"
            aria-label="Describe lo que quieres hacer"
            disabled={ocupado}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void pedirEsquema('generar'); } }}
          />
          {/* El micrófono de «Nueva automatización» (T4): dictado en vivo y, de respaldo, grabar y transcribir. */}
          <div className="gp-caja-mic gp-mic">
            <BotonDictar titulo="Dictar el pedido" valor={prompt} onValor={(v) => setPrompt(v.slice(0, 8_000))} onError={(m) => setFalla({ texto: m })} />
          </div>
        </div>
        <div className="gp-acciones-centro">
          {escribiendo || (
            <button type="button" className="gp-btn gp-btn-primario" data-tam="lg" disabled={!prompt.trim() || ocupado} onClick={() => void pedirEsquema('generar')}>
              <Ico n="destellos" /> Generar esquema
            </button>
          )}
        </div>
        {lineaFalla}
        <button type="button" className="gp-enlace-boton" aria-expanded={personalizar} onClick={() => setPersonalizar((v) => !v)}>
          <Ico n="ajustes" t={14} /> Personalizar
        </button>
        {personalizar && camposPersonalizar}
        {recientesDe('generar')}
        <div className="gp-ejemplos-cabeza">
          <span className="gp-separador-texto">Ejemplos de instrucciones</span>
          <button type="button" className="gp-btn gp-btn-fantasma" onClick={() => setEjemplo0((n) => (n + EJEMPLOS_VISIBLES + Math.floor(Math.random() * 3)) % lista.length)}>
            <Ico n="refrescar" t={14} /> Aleatorio
          </button>
        </div>
        <div className="gp-ejemplos">
          {ejemplos.map((e) => (
            <button key={e.texto} type="button" className="gp-ejemplo" disabled={ocupado} onClick={() => setPrompt(e.texto)}>
              <Ico n={e.icono} t={18} />
              <span>{e.texto}</span>
              <Ico n="mas" t={14} />
            </button>
          ))}
        </div>
      </div>
    );
  } else if (paso === 'pegar') {
    cuerpo = (
      <div className="gp-crear-centro">
        <h1 className="gp-crear-h1">Pegar texto</h1>
        <p className="gp-crear-sub">Pega la nota, el esquema o el contenido de texto que quieras usar</p>
        {selectorTipo}
        <div className="gp-caja-prompt">
          <textarea
            className="gp-caja-texto"
            data-alto="grande"
            value={texto}
            maxLength={60_000}
            placeholder="Escribe o pega aquí el contenido"
            aria-label="Escribe o pega aquí el contenido"
            disabled={ocupado}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="gp-caja-pie">
            <span>También puedes escribir --- para añadir saltos</span>
            <span>{texto.length.toLocaleString('es-MX')}/60.000</span>
          </div>
        </div>
        <div className="gp-campo-fila">
          <span className="gp-etiqueta">Contenido del texto</span>
          <div className="gp-segmentado" role="radiogroup" aria-label="Contenido del texto">
            {MODOS_TEXTO.map((m) => (
              <button key={m.valor} type="button" role="radio" title={m.ayuda} aria-checked={params.modoTexto === m.valor} onClick={() => set('modoTexto', m.valor)}>
                <Ico n={m.icono} t={14} /> {m.texto}
              </button>
            ))}
          </div>
        </div>
        {controles(params.modoTexto !== 'conservar')}
        <div className="gp-acciones-centro">
          {escribiendo || (
            <button type="button" className="gp-btn gp-btn-primario" data-tam="lg" disabled={!texto.trim() || ocupado} onClick={() => void pedirEsquema('pegar')}>
              Continuar <Ico n="flecha-derecha" />
            </button>
          )}
        </div>
        {lineaFalla}
        {recientesDe('pegar')}
      </div>
    );
  } else if (paso === 'importar') {
    cuerpo = (
      <div className="gp-crear-centro">
        <h1 className="gp-crear-h1">Importar con IA</h1>
        <p className="gp-crear-sub">Selecciona el archivo que quieras transformar</p>
        {selectorTipo}
        {cargando === 'archivo' ? (
          <div className="gp-cargando-archivo" role="status">
            <div className="gp-barra"><span /></div>
            <strong>Cargando archivo...</strong>
            <span>Esto puede tardar hasta un minuto o dos en el caso de archivos grandes</span>
          </div>
        ) : (
          <div className="gp-importar">
            <label
              className="gp-importar-tarjeta"
              data-color="lila"
              onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void subirArchivo(f); }}
            >
              <span className="gp-importar-cabeza"><Ico n="carpeta-abierta" t={36} /></span>
              <span className="gp-importar-titulo">Cargar un archivo</span>
              <span className="gp-importar-lista">
                <span><Ico n="check" t={12} /> PowerPoint PPTX</span>
                <span><Ico n="check" t={12} /> Documentos de Word</span>
                <span><Ico n="check" t={12} /> PDF</span>
              </span>
              <span className="gp-importar-enlace">Examinar archivos <Ico n="subir" t={13} /></span>
              <input
                type="file"
                accept={ACCEPT_IMPORTAR}
                className="gp-oculto"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void subirArchivo(f); }}
              />
            </label>
          </div>
        )}
        {escribiendo}
        {lineaFalla}
        <p className="gp-crear-link">Si tu archivo no es compatible, también puedes <button type="button" className="gp-enlace-boton gp-en-linea" onClick={() => ir('pegar')}>pegar texto</button></p>
      </div>
    );
  } else if (paso === 'esquema' && esquema) {
    const n = esquema.secciones.length;
    cuerpo = (
      <>
        <div className="gp-crear-centro" data-ancho="esquema">
          <section className="gp-tarjeta-blanca" aria-label="Instrucción">
            <div className="gp-bloque-cabeza">
              <h2 className="gp-bloque-titulo">Instrucción</h2>
              <button type="button" className="gp-btn gp-btn-contorno" disabled={ocupado} onClick={() => void pedirEsquema(origen)}>
                <Ico n="refrescar" t={14} /> Regenerar esquema
              </button>
            </div>
            {origen === 'generar' && (
              <textarea className="gp-campo" rows={2} value={prompt} maxLength={8_000} aria-label="Instrucción" disabled={ocupado} onChange={(e) => setPrompt(e.target.value)} />
            )}
            {origen === 'pegar' && (
              <p className="gp-instruccion-resumen">Texto pegado · {texto.length.toLocaleString('es-MX')} caracteres · <button type="button" className="gp-enlace-boton gp-en-linea" onClick={() => ir('pegar')}>Editar</button></p>
            )}
            {selectorTipo}
            {controles(!(origen !== 'generar' && params.modoTexto === 'conservar'))}
            {escribiendo}
            {lineaFalla}
          </section>

          <section className="gp-bloque" aria-labelledby="gp-esquema-titulo">
            <h2 id="gp-esquema-titulo" className="gp-crear-h2">Esquema</h2>
            <EditorEsquema esquema={esquema} onCambio={setEsquema} deshabilitado={ocupado} tipo={tipo} />
          </section>

          <section className="gp-bloque" aria-labelledby="gp-personaliza-titulo">
            <h2 id="gp-personaliza-titulo" className="gp-crear-h2">Personaliza tu {docDe(tipo)}</h2>
            <div className="gp-tarjeta-blanca">
              <SelectorTemaCrear valor={temaId} onCambio={setTemaElegido} sugerido={sugerido} propios={propios} />
            </div>
            <div className="gp-tarjeta-blanca">
              <h3 className="gp-bloque-titulo">Contenido del texto</h3>
              {camposPersonalizar}
            </div>
          </section>
        </div>
        <div className="gp-barra-abajo" data-esquina-ocupada>
          <span>{textoSecciones(n, tipo)}</span>
          <button type="button" className="gp-btn gp-btn-primario" data-tam="lg" disabled={ocupado || !n} onClick={() => void generar(esquema, origen)}>
            <Ico n="destellos" /> Generar
          </button>
          <span />
        </div>
      </>
    );
  } else if (paso === 'generando' && gen && esquema) {
    // `generar` deja en `esquema` lo MISMO que manda (esquemaParaEnviar): las secciones de la
    // vista en vivo son las del pedido, índice por índice.
    const esq = esquema;
    const tg = tipoDeGen;
    const doc = docDe(tg);
    cuerpo = (
      <div className="gp-generando">
        <aside className="gp-gen-log" aria-live="polite">
          <h1 className="gp-gen-titulo">{gen.guardado === 'listo' ? `${doc[0].toUpperCase()}${doc.slice(1)} generada` : `Generando tu ${doc}…`}</h1>
          <p className="gp-gen-nota">Tarda unos minutos. No cierres esta pestaña.</p>
          <ol className="gp-pasos">
            <PasoLog estado={crear === 'error' ? 'error' : crear === 'lista' ? 'lista' : 'pidiendo'} enCurso={`Creando la ${doc}`} hecho={`${doc[0].toUpperCase()}${doc.slice(1)} creada`}
              error={errorCrear} onReintentar={reintentarCrear} />
            {gen.tandas.map((t, k) => (
              <PasoLog
                key={k}
                estado={crear !== 'lista' ? 'esperando' : t.estado}
                enCurso={`Escribiendo ${rotuloTanda(t.indices, tg).toLowerCase()}`}
                hecho={`${rotuloTanda(t.indices, tg)} ${t.indices.length === 1 ? 'escrita' : 'escritas'}`}
                error={t.error ? `${rotuloTanda(t.indices, tg)}: ${t.error}` : null}
                onReintentar={() => reintentarTanda(k)}
              />
            ))}
            <PasoLog
              estado={gen.guardado === 'listo' ? 'lista' : gen.guardado === 'guardando' ? 'pidiendo' : gen.guardado === 'error' ? 'error' : 'esperando'}
              enCurso="Guardando"
              hecho="Guardada · abriendo el editor"
              error={gen.errorGuardar ?? null}
              onReintentar={reintentarGuardar}
            />
          </ol>
          {crear === 'lista' && gen.tandas.some((t) => t.estado === 'error') && !gen.tandas.some((t) => t.estado === 'pidiendo' || t.estado === 'esperando') && (
            <button type="button" className="gp-btn gp-btn-contorno" title={`Las ${termino(tg, { plural: true })} que faltan quedan con el título y los puntos del esquema`} onClick={completar}>
              Completar con el esquema
            </button>
          )}
        </aside>
        <div className="gp-gen-vista">
          {esq.secciones.map((s, i) => {
            const t = gen.tarjetas[i];
            const tanda = gen.tandas.find((x) => x.indices.includes(i));
            return t ? (
              <div key={i} className="gp-gen-seccion" data-lista="si"><MiniaturaLanding tarjeta={t} tema={tema} formato={formatoDeTipo(tg)} proporcion={PROPORCION_IA} entera /></div>
            ) : (
              <div key={i} className="gp-gen-seccion" data-falla={tanda?.estado === 'error' ? 'si' : undefined}>
                <div className="gp-gen-hueco">
                  <span className="gp-gen-hueco-num">{i + 1}</span>
                  <strong>{s.titulo}</strong>
                  {tanda?.estado === 'error' ? <span className="gp-gen-hueco-falla">No se generó</span> : (
                    <>
                      <span className="gp-brillo" style={{ height: 10, width: '80%' }} />
                      <span className="gp-brillo" style={{ height: 10, width: '60%' }} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="gma gp gp-crear" data-paso={paso}>
      {/* CSS_GP y la letra los pone el Panel, que la monta (Inicio.tsx). */}
      <style dangerouslySetInnerHTML={{ __html: CSS_ESQUEMA + CSS_TIPO + CSS_CREAR }} />
      {(paso !== 'generando' || crear === 'error') && (
        <div className="gp-crear-barra">
          <button type="button" className="gp-btn gp-btn-contorno" disabled={ocupado} onClick={props.onSalir}><Ico n="casa" t={14} /> Inicio</button>
          {atras && <button type="button" className="gp-btn gp-btn-fantasma" disabled={ocupado} onClick={() => ir(atras)}><Ico n="flecha-izquierda" t={14} /> Atrás</button>}
        </div>
      )}
      {cuerpo}
    </div>
  );
}

/** Un paso del registro de la generación en vivo (Gamma: el gerundio pasa a participio). */
function PasoLog({ estado, enCurso, hecho, error, onReintentar }: {
  estado: EstadoTanda;
  enCurso: string;
  hecho: string;
  error: string | null;
  onReintentar: () => void;
}) {
  return (
    <li className="gp-paso" data-estado={estado}>
      <span className="gp-paso-icono" aria-hidden="true">
        {estado === 'pidiendo' ? <span className="gp-giro" /> : estado === 'lista' ? <Ico n="check" t={14} /> : estado === 'error' ? <Ico n="x-circulo" t={14} /> : <span className="gp-paso-punto" />}
      </span>
      <span className="gp-paso-texto">
        {estado === 'lista' ? hecho : estado === 'error' && error ? error : enCurso}
        {estado === 'error' && <button type="button" className="gp-btn gp-btn-contorno" onClick={onReintentar}>Reintentar</button>}
      </span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// La hoja de Crear (medidas de gamma-ui §4.B; tokens de CSS_GP)
// ─────────────────────────────────────────────────────────────────────────────

const CSS_CREAR = `
.gp.gp-crear { min-height: 100vh; padding: 20px 24px 0; background: var(--gp-cielo); background-attachment: fixed; }
.gp .gp-crear-barra { display: flex; align-items: center; gap: 8px; }
.gp .gp-crear-barra a.gp-btn { text-decoration: none; }
.gp .gp-crear-centro { display: flex; flex-direction: column; gap: 18px; width: 100%; max-width: 760px; margin: 24px auto 0; padding-bottom: 64px; }
.gp .gp-crear-centro[data-ancho="esquema"] { max-width: 820px; padding-bottom: 32px; }
.gp .gp-crear-h1 { margin: 0; text-align: center; font-size: 40px; font-weight: 600; line-height: 1.1; letter-spacing: -0.02em; color: var(--gp-titulo); }
.gp .gp-crear-sub { margin: -8px 0 4px; text-align: center; font-size: 16px; color: var(--gp-tenue); }
.gp .gp-crear-h2 { margin: 8px 0 0; font-size: 20px; font-weight: 600; color: var(--gp-titulo); }
.gp .gp-crear-link { margin: 0; text-align: center; font-size: 14px; color: var(--gp-tenue); }
.gp .gp-enlace-boton { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; padding: 0; border: 0; background: transparent; color: var(--gp-activo-texto); font-size: 14px; font-weight: 600; cursor: pointer; }
.gp .gp-en-linea { display: inline; align-self: auto; }
.gp .gp-oculto { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

/* Indicaciones recientes (en Generar y en Pegar texto, tanda 6). */
.gp .gp-recientes { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
.gp .gp-recientes .gp-separador-texto { margin: 0; }
.gp .gp-recientes ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.gp .gp-reciente { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border: 0; border-radius: 10px; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); text-align: left; cursor: pointer; color: var(--gp-tenue); }
.gp .gp-reciente:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -1px rgba(0,0,0,.06); }
.gp .gp-reciente-textos { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.gp .gp-reciente-titulo { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--gp-titulo); font-weight: 600; font-size: 14px; }
.gp .gp-reciente-sub { font-size: 12.5px; }

/* Controles (píldoras chicas) y el stepper «[– 8 secciones +]». */
.gp .gp-controles { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
.gp .gp-stepper { display: inline-flex; align-items: center; height: 32px; border: 1px solid var(--gp-borde); border-radius: 9999px; background: var(--gp-superficie); font-size: 13px; font-weight: 500; }
.gp .gp-stepper button { display: grid; place-items: center; width: 32px; height: 30px; border: 0; background: transparent; color: var(--gp-texto); cursor: pointer; border-radius: 9999px; }
.gp .gp-stepper button:hover:not(:disabled) { background: var(--gp-hover); }
.gp .gp-stepper button:disabled { opacity: .35; cursor: default; }
.gp .gp-stepper span { min-width: 92px; text-align: center; }
.gp .gp-nota-error { font-size: 12.5px; color: var(--gp-peligro); }

/* La caja del prompt. */
.gp .gp-caja-prompt { border-radius: 12px; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); border: 1px solid var(--gp-borde-suave); }
.gp .gp-caja-prompt:focus-within { border-color: var(--gp-azul-300); box-shadow: 0 0 0 3px rgba(44,136,247,.15); }
.gp .gp-caja-texto { display: block; width: 100%; min-height: 84px; padding: 14px 16px; border: 0; border-radius: 12px; background: transparent; color: var(--gp-texto); font: inherit; font-size: 16px; line-height: 1.5; resize: vertical; outline: none; }
.gp .gp-caja-texto[data-alto="grande"] { min-height: 280px; font-size: 14.5px; }
.gp .gp-caja-texto::placeholder { color: var(--gp-debil); }
.gp .gp-caja-mic { display: flex; justify-content: flex-end; padding: 0 10px 10px; }
.gp .gp-caja-pie { display: flex; justify-content: space-between; gap: 12px; padding: 8px 16px 10px; border-top: 1px solid var(--gp-borde-suave); color: var(--gp-debil); font-size: 12.5px; }
.gp .gp-acciones-centro { display: flex; justify-content: center; min-height: 40px; }
.gp .gp-esperando { display: inline-flex; align-items: center; gap: 10px; color: var(--gp-tenue); font-size: 14px; }
.gp .gp-esperando strong { color: var(--gp-titulo); font-weight: 600; }

/* Personalizar. */
.gp .gp-personalizar { display: flex; flex-direction: column; gap: 14px; padding: 16px; border-radius: 12px; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); }
.gp .gp-tarjeta-blanca .gp-personalizar { padding: 0; box-shadow: none; background: transparent; }
.gp .gp-campo-fila { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.gp .gp-campo-fila > .gp-campo { width: 100%; }
.gp .gp-segmentado { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 3px; border-radius: 10px; background: var(--gp-borde-suave); }
.gp .gp-segmentado button { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 14px; border: 0; border-radius: 8px; background: transparent; color: var(--gp-texto); font-size: 13px; font-weight: 500; cursor: pointer; }
.gp .gp-segmentado button[aria-checked="true"] { background: var(--gp-superficie); color: var(--gp-activo-texto); box-shadow: var(--gp-sombra-tarjeta); }

/* Ejemplos de instrucciones. */
.gp .gp-ejemplos-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }
.gp .gp-separador-texto { font-size: 13px; font-weight: 600; color: var(--gp-tenue); text-transform: uppercase; letter-spacing: .04em; }
.gp .gp-ejemplos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.gp .gp-ejemplo { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 10px; padding: 12px 14px; border: 0; border-radius: 10px; background: rgba(208,230,254,.65); color: var(--gp-azul-950); font-size: 13.5px; line-height: 1.4; text-align: left; cursor: pointer; }
[data-tema="oscuro"] .gp .gp-ejemplo { background: rgba(11,46,121,.55); color: #d0e6fe; }
.gp .gp-ejemplo:hover:not(:disabled) { background: var(--gp-azul-100); }
.gp .gp-ejemplo .gp-ico:first-child { color: var(--gp-azul-600); }

/* Importar. */
.gp .gp-importar { display: grid; grid-template-columns: minmax(0, 380px); justify-content: center; gap: 16px; }
.gp .gp-importar-tarjeta { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 0 0 18px; border-radius: 12px; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); overflow: hidden; cursor: default; }
.gp label.gp-importar-tarjeta { cursor: pointer; }
.gp .gp-importar-cabeza { display: grid; place-items: center; height: 110px; color: #fff; }
.gp .gp-importar-tarjeta[data-color="lila"] .gp-importar-cabeza { background: linear-gradient(135deg, #bd97fd, #8131dc); }
.gp .gp-importar-titulo { padding: 0 18px; font-size: 16px; font-weight: 600; color: var(--gp-titulo); }
.gp .gp-importar-lista { display: flex; flex-direction: column; gap: 4px; padding: 0 18px; font-size: 13.5px; color: var(--gp-tenue); }
.gp .gp-importar-lista .gp-ico { color: var(--gp-exito); }
.gp .gp-importar-lista span { display: inline-flex; align-items: center; gap: 6px; }
.gp .gp-importar-enlace { display: inline-flex; align-items: center; gap: 6px; padding: 0 18px; color: #b50084; font-weight: 600; font-size: 14px; }
.gp .gp-cargando-archivo { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px; border-radius: 12px; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); text-align: center; color: var(--gp-tenue); font-size: 14px; }
.gp .gp-cargando-archivo strong { color: var(--gp-titulo); }
.gp .gp-barra { width: 100%; max-width: 360px; height: 6px; border-radius: 9999px; background: var(--gp-borde-suave); overflow: hidden; }
.gp .gp-barra span { display: block; width: 40%; height: 100%; border-radius: inherit; background: var(--gp-azul-500); animation: gp-va 1.4s ease-in-out infinite; }
@keyframes gp-va { from { transform: translateX(-100%); } to { transform: translateX(250%); } }

/* Esquema: la tarjeta de la instrucción y la barra de abajo. */
.gp .gp-tarjeta-blanca { display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: 12px; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); }
.gp .gp-instruccion-resumen { margin: 0; color: var(--gp-tenue); font-size: 14px; }
.gp .gp-barra-abajo { position: sticky; bottom: 0; z-index: 5; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin: 0 -24px; padding: 10px 24px; background: var(--gp-superficie); border-top: 1px solid var(--gp-borde-suave); box-shadow: 0 -4px 12px rgba(0,0,0,.04); font-size: 13.5px; color: var(--gp-tenue); }

/* Generando: registro a la izquierda, la página apareciendo a la derecha. */
.gp .gp-generando { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 24px; align-items: start; max-width: 1180px; margin: 24px auto 0; padding-bottom: 48px; }
.gp .gp-gen-log { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 10px; padding: 18px; border-radius: 12px; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); }
.gp .gp-gen-titulo { margin: 0; font-size: 20px; font-weight: 600; color: var(--gp-titulo); }
.gp .gp-gen-nota { margin: 0; font-size: 13px; color: var(--gp-tenue); }
.gp .gp-pasos { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.gp .gp-paso { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; align-items: start; font-size: 13.5px; color: var(--gp-tenue); }
.gp .gp-paso[data-estado="pidiendo"] { color: var(--gp-titulo); font-weight: 600; }
.gp .gp-paso[data-estado="lista"] .gp-paso-icono { color: var(--gp-exito); }
.gp .gp-paso[data-estado="error"] { color: var(--gp-peligro); }
.gp .gp-paso-icono { display: grid; place-items: center; height: 20px; color: var(--gp-azul-500); }
.gp .gp-paso-icono .gp-giro { width: 13px; height: 13px; }
.gp .gp-paso-punto { width: 6px; height: 6px; border-radius: 50%; background: var(--gp-borde); }
.gp .gp-paso-texto { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; line-height: 20px; }
.gp .gp-paso-texto .gp-btn { height: 26px; padding: 0 10px; font-size: 12.5px; }
.gp .gp-gen-vista { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.gp .gp-gen-seccion { border-radius: 10px; overflow: hidden; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); }
.gp .gp-gen-seccion[data-lista="si"] { animation: gp-revela .7s cubic-bezier(0.22,1,0.36,1); }
@keyframes gp-revela { from { opacity: 0; filter: blur(10px); transform: translateY(8px) scale(.99); } to { opacity: 1; filter: none; transform: none; } }
.gp .gp-gen-hueco { display: flex; flex-direction: column; gap: 10px; padding: 22px 24px; min-height: 140px; color: var(--gp-titulo); font-size: 15px; }
.gp .gp-gen-hueco-num { color: var(--gp-lila-num); font-weight: 700; font-size: 13px; }
.gp .gp-gen-hueco-falla { color: var(--gp-peligro); font-size: 13px; font-weight: 600; }
.gp .gp-gen-seccion[data-falla="si"] { box-shadow: inset 0 0 0 1px var(--gp-peligro); }

@media (max-width: 760px) {
  .gp.gp-crear { padding: 16px 16px 0; }
  .gp .gp-crear-h1 { font-size: 30px; }
  .gp .gp-ejemplos, .gp .gp-importar { grid-template-columns: minmax(0, 1fr); }
  .gp .gp-generando { grid-template-columns: minmax(0, 1fr); }
  .gp .gp-gen-log { position: static; }
  .gp .gp-barra-abajo { margin: 0 -16px; padding: 10px 16px; grid-template-columns: 1fr auto; }
  .gp .gp-barra-abajo > span:last-child { display: none; }
}
`;
