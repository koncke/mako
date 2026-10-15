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
//   pidiendo  el pedido que llegó del cuadro y «Escribiendo esquema» (o la falla con «Reintentar»);
//   esquema   el esquema editable (EditorEsquema), «Personaliza tu landing» (Temas,
//             Contenido del texto, Visuales, Instrucciones adicionales) y la barra de
//             abajo con «N secciones en total» y «Generar»;
//   generando la generación en vivo: crea la landing, pide las secciones en tandas de 3
//             (las mismas `tandasDe` de la ruta, ia-reglas.ts), las va mostrando a medida
//             que llegan con el render público, guarda TODO al final y abre el editor.
// Lo propio de MaKo, que Gamma no tiene: «Objetivo de la página» (OBJETIVOS_LANDING) y
// «Sobre cuál» (una landing que ya pasó por el Diagnóstico: su diagnóstico entra al
// prompt, D5). La landing de base sólo vale si está entre las analizadas de ESTE negocio
// (`paramsIniciales`, ./ajustes.ts): una URL cualquiera no puede meter un diagnóstico ajeno.
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
// presentación...»; decisión T4): el generador recibe el TIPO (del cuadro del Panel) y lo deja
// cambiar con las pastillas Landing | Presentación. Con una presentación: el alta lleva
// `formato: 'presentacion'` y la proporción (`configDeCreacion`), todo pedido a la IA lleva
// `params.formato` (`paramsDeTipo`: diapositivas, poco texto, diseños optimizados), «Sobre cuál»
// se esconde (el diagnóstico de una página no es contexto de una presentación) y la pantalla dice
// «diapositiva» donde decía «sección» (`termino`, el mismo de api-tipos que usa el editor). El
// tipo de una generación se CONGELA al arrancarla (`tipoGen`): las tandas que siguen tienen que
// pedir lo mismo que el documento que se creó.
//
// TANDA 6 (14/10/2026): se monta A LA DERECHA del Panel (Inicio.tsx); /web-generator/crear redirige ahí.
// «Importar» es SÓLO un archivo; una página de afuera se ANALIZA o se REPLICA (crear/Replicar.tsx). El pedido
// llega EN MEMORIA (`arranque`, `ArranqueIA` de ../panel-reglas.ts). El link viejo de la caja (`?desde=caja`)
// sigue leyendo sessionStorage (`tomarCaja`) mientras dura el deploy.
//
// TANDA 7 (15/10/2026). Martín, textual: «4. No entiendo la diferencia entre las 2 primeras... Si tu tampoco ves
// diferencia entre esas 2, elimina y conserva la de "Generar desde una idea". 5. […] Y aprovecha el diseño que ya
// tenemos para meter las opciones... Por ejemplo la de "Personalizar", podría ir por defecto en el botón de + o en el
// desplegable de "plan" […] O por ejemplo las opciones de "Ejemplos de instrucciones", revisa dónde ponerlas o si
// directamente eliminarlas... Lo que no quiero es que esos ejemplos sean otras tarjetas […] Tampoco quiero el botón de
// "aleatorio"...»
//   · Se fueron las PANTALLAS DE ENTRADA («Generar», «Pegar texto», «Importar con IA»): el cuadro «¿Qué vas a crear
//     hoy?» (../CajaCrear.tsx) es la única puerta y esto es su RESULTADO. Sin las tarjetas «Ejemplos de instrucciones»
//     ni «Aleatorio» (los ejemplos ya se escriben solos en el cuadro), y «Personalizar» y los controles viven en el
//     desplegable «Plan» del cuadro (./AjustesCaja.tsx), con sus catálogos en ./ajustes.ts; acá siguen en el esquema.
//   · El pedido llega con sus ajustes (`arranque.params`). Un texto LARGO (ex «Pegar texto») llega como `texto` y va
//     como «pegar» con `params.modoTexto` (la opción «Tu texto» del cuadro); un archivo, igual, con lo escrito como
//     instrucciones (y las de «Más ajustes», juntas: `instruccionesConArchivo`).
//   · «Volver» (y «Editar» del texto) vuelve AL CUADRO con lo que se había mandado (`onSalir(semilla)`): lo escrito
//     no se pierde por mirar el esquema.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useWs } from '@/app/_ui/Link';
import { NODO, nuevoId, type JsonNodo, type LandingContenido } from '@/lib/editor-landing/doc';
import type {
  ConfigLanding, Esquema, ParamsGeneracion, PedidoIA, TemaPropio,
} from '@/lib/editor-landing/api-tipos';
import { MAX_INSTRUCCIONES, MAX_SECCIONES, MIN_SECCIONES, tandasDe, tarjetaDesdeEsquema } from '@/lib/editor-landing/ia-reglas';
import { temaPorId } from '@/lib/editor-landing/temas';
import { resolverAnclas } from '@/lib/editor-landing/ia-bloques';
import {
  Desplegable, Ico, MiniaturaLanding, hostDe, irDuro, marcarReciente, pedirDocs, pedirIA, tomarCaja, type OpcionDesplegable,
} from '../MiniaturaLanding';
import type { ArranqueIA } from '../panel-reglas';
import { CSS_ESQUEMA, EditorEsquema, esquemaParaEnviar, textoSecciones } from './EditorEsquema';
import { SelectorTemaCrear, temaSugerido } from './SelectorTemaCrear';
import {
  PROPORCION_IA, configDeCreacion, cuantas, docDe, formatoDeTipo, paramsDeTipo, termino, tipoValido, type TipoCrear,
} from './tipo';
import { CSS_TIPO, SelectorTipo } from './PiezasTipo';
import { FUENTES, IDIOMAS, MODOS_TEXTO, OBJETIVOS, TEXTOS, instruccionesConArchivo, paramsIniciales } from './ajustes';
import { recordarIndicacion, type OrigenIndicacion } from './recientes';
import type { SemillaCaja } from './caja-modos';

// ─────────────────────────────────────────────────────────────────────────────
// Lo puro (con test)
// ─────────────────────────────────────────────────────────────────────────────

export type LandingAnalizada = { url: string; veredicto: string | null; score: number | null };

/**
 * La landing de base del deep link y el objetivo de la query: viven en ./ajustes.ts (los usan también el cuadro y
 * `paramsIniciales`); se re-exportan acá, donde estuvieron siempre.
 */
export { baseDelDeepLink, objetivoValido } from './ajustes';


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
// La pantalla
// ─────────────────────────────────────────────────────────────────────────────

/** Por dónde entró el pedido: una instrucción (Generar) o un texto (un texto largo o el de un archivo). */
type Origen = OrigenIndicacion;
type Paso = 'pidiendo' | 'esquema' | 'generando';
type Falla = { texto: string; reintentar?: () => void };

export type PropsCrear = {
  analizadas: LandingAnalizada[];
  /** Si la lista de analizadas no se pudo leer (el «Sobre cuál» lo dice en vez de quedar vacío). */
  errorAnalizadas: string | null;
  propios: TemaPropio[];
  /** Lo crudo del tipo (T4): 'presentacion' crea una presentación; lo demás, una landing. */
  tipo: string | null;
  /** Lo que trae al abrirse, UNA vez: el pedido del cuadro (con sus ajustes), su archivo o el link viejo de la caja. */
  arranque: ArranqueIA | null;
  /** «Volver»: al cuadro del Panel, con lo que se había mandado (la semilla). Sin semilla, el cuadro vacío. */
  onSalir: (semilla?: SemillaCaja) => void;
  /** «Analizar una página»: el cuadro del Panel en Analizar, para pegar una dirección. */
  onAnalizar: () => void;
};

export function CrearConIA(props: PropsCrear) {
  const { analizadas, errorAnalizadas, propios, onSalir } = props;
  const ws = useWs();

  const arranque = props.arranque;
  /** Un archivo o un texto largo van como texto («pegar»); un pedido, como instrucción («generar»). */
  const [origen] = useState<Origen>(() => (arranque?.archivo || arranque?.texto ? 'pegar' : 'generar'));
  const [paso, setPaso] = useState<Paso>('pidiendo');
  const [tipo, setTipo] = useState<TipoCrear>(() => tipoValido(props.tipo));
  const [prompt, setPrompt] = useState('');
  const [texto, setTexto] = useState('');
  const [params, setParams] = useState<ParamsGeneracion>(() => paramsIniciales(arranque, analizadas));
  const [esquema, setEsquema] = useState<Esquema | null>(null);
  const [temaElegido, setTemaElegido] = useState<string | null>(null);
  // Arranca escribiendo: el pedido ya está en camino (si no hay pedido, vuelve al cuadro).
  const [cargando, setCargando] = useState<null | 'esquema'>(arranque ? 'esquema' : null);
  const [falla, setFalla] = useState<Falla | null>(null);
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
      if (montada.current) irDuro(`/web-generator/${d.id}`, ws);
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
    setEsquema(r.esquema);
    if (express) void generar(r.esquema, de);
    else setPaso('esquema');
  }, [generar]);

  // Lo que trae el cuadro del Panel (`arranque`), UNA vez: el ref sobrevive al doble montaje del modo estricto
  // (un esquema se paga). Un archivo o un texto largo van como texto («pegar»; el archivo, con lo escrito como
  // instrucciones); un pedido, a «generar». El link viejo de la caja (`sesion`) lo busca en sessionStorage y, si no
  // está, en la URL. Sin nada que pedir, de vuelta al cuadro (con la landing de base, si vino una).
  const arrancado = useRef(false);
  useEffect(() => {
    if (arrancado.current) return;
    arrancado.current = true;
    if (!arranque) { onSalir(); return; }
    const express = arranque.modo === 'express';
    const deTexto = arranque.archivo ? arranque.archivo.texto : arranque.texto;
    if (deTexto) {
      const p = arranque.archivo ? { ...vivo.current.params, instrucciones: instruccionesConArchivo(arranque.prompt, vivo.current.params.instrucciones) } : vivo.current.params;
      setTexto(deTexto);
      setParams(p);
      vivo.current = { ...vivo.current, texto: deTexto, params: p };
      void pedirEsquema('pegar', express);
      return;
    }
    const caja = arranque.sesion
      ? tomarCaja() ?? (arranque.prompt ? { prompt: arranque.prompt, modo: arranque.modo ?? 'plan' } : null)
      : arranque.prompt ? { prompt: arranque.prompt, modo: arranque.modo ?? 'plan' } : null;
    if (!caja) { onSalir({ base: arranque.base, objetivo: arranque.objetivo, params: arranque.params }); return; }
    setPrompt(caja.prompt);
    vivo.current = { ...vivo.current, prompt: caja.prompt };
    void pedirEsquema('generar', caja.modo === 'express');
  }, [arranque, pedirEsquema, onSalir]);

  // Mientras se genera y no se guardó, cerrar la pestaña pierde lo generado: se avisa.
  const enCurso = paso === 'generando' && gen?.guardado !== 'listo';
  useEffect(() => {
    if (!enCurso) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [enCurso]);

  /**
   * Lo que se había mandado, para volver al cuadro con eso (tanda 7: «Volver» y «Editar»). Con un archivo, el archivo
   * y lo escrito al lado (sus instrucciones de «Más ajustes», sin lo que se les sumó al mandar).
   */
  const semilla = (): SemillaCaja => {
    const de = { tipo, modoGen: arranque?.modo ?? 'plan', params: { ...params, instrucciones: arranque?.archivo ? arranque.params?.instrucciones ?? '' : params.instrucciones } };
    if (arranque?.archivo) return { ...de, archivo: arranque.archivo, texto: arranque.prompt ?? '' };
    return { ...de, texto: origen === 'generar' ? prompt : texto };
  };
  const volver = () => onSalir(semilla());

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

  /** «Tu texto» (ex «Contenido del texto» de Pegar texto): de guía, resumir o tal cual. Con los mismos rótulos del cuadro. */
  const tuTexto = (
    <div className="gp-campo-fila">
      <span className="gp-etiqueta">Tu texto</span>
      <div className="gp-segmentado" role="radiogroup" aria-label="Tu texto">
        {MODOS_TEXTO.map((m) => (
          <button key={m.valor} type="button" role="radio" title={m.ayuda} aria-checked={params.modoTexto === m.valor} disabled={ocupado} onClick={() => set('modoTexto', m.valor)}>
            <Ico n={m.icono} t={14} /> {m.texto}
          </button>
        ))}
      </div>
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

  /** Lo que se mandó desde un texto: el archivo (o «Tu texto») y su largo. */
  const resumenTexto = `${arranque?.archivo ? arranque.archivo.nombre : 'Tu texto'} · ${texto.length.toLocaleString('es-MX')} caracteres`;

  let cuerpo: ReactNode = null;

  if (paso === 'pidiendo') {
    // Lo que se mandó desde el cuadro, mientras se escribe el esquema (o la falla, con «Reintentar» y «Volver»).
    cuerpo = (
      <div className="gp-crear-centro" data-ancho="pedido">
        <section className="gp-tarjeta-blanca gp-pedido" aria-label="Tu pedido">
          <h1 className="gp-bloque-titulo">{origen === 'generar' ? 'Tu pedido' : arranque?.archivo ? 'Tu archivo' : 'Tu texto'}</h1>
          {origen === 'generar'
            ? <p className="gp-pedido-texto">{prompt}</p>
            : <p className="gp-instruccion-resumen"><Ico n={arranque?.archivo ? 'archivo' : 'texto-parrafo'} t={14} /> {resumenTexto}</p>}
          {escribiendo}
          {lineaFalla}
        </section>
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
              <>
                <p className="gp-instruccion-resumen">{resumenTexto} · <button type="button" className="gp-enlace-boton gp-en-linea" onClick={volver}>Editar</button></p>
                {tuTexto}
              </>
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
          {/* Tanda 7: vuelve al CUADRO con lo que se había mandado (era «Inicio», que lo vaciaba). */}
          <button type="button" className="gp-btn gp-btn-contorno" disabled={ocupado && paso !== 'pidiendo'} onClick={volver}><Ico n="flecha-izquierda" t={14} /> Volver</button>
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
// Tanda 7: se fueron las hojas de las pantallas de entrada (la caja del prompt, «Ejemplos de instrucciones»,
// «Recientes», «Importar con IA» y su barra de carga): esas cosas viven en el cuadro del Panel (../CajaCrear.tsx).

const CSS_CREAR = `
.gp.gp-crear { min-height: 100vh; padding: 20px 24px 0; background: var(--gp-cielo); background-attachment: fixed; }
.gp .gp-crear-barra { display: flex; align-items: center; gap: 8px; }
.gp .gp-crear-barra a.gp-btn { text-decoration: none; }
.gp .gp-crear-centro { display: flex; flex-direction: column; gap: 18px; width: 100%; max-width: 760px; margin: 24px auto 0; padding-bottom: 64px; }
.gp .gp-crear-centro[data-ancho="esquema"] { max-width: 820px; padding-bottom: 32px; }
.gp .gp-crear-centro[data-ancho="pedido"] { max-width: 720px; }
.gp .gp-crear-h2 { margin: 8px 0 0; font-size: 20px; font-weight: 600; color: var(--gp-titulo); }
.gp .gp-enlace-boton { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; padding: 0; border: 0; background: transparent; color: var(--gp-activo-texto); font-size: 14px; font-weight: 600; cursor: pointer; }
.gp .gp-en-linea { display: inline; align-self: auto; }

/* El pedido mientras se escribe el esquema (tanda 7). */
.gp .gp-pedido-texto { margin: 0; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; color: var(--gp-texto); font-size: 16px; line-height: 1.5; white-space: pre-wrap; }

/* Controles (píldoras chicas) y el stepper «[– 8 secciones +]». */
.gp .gp-controles { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
.gp .gp-stepper { display: inline-flex; align-items: center; height: 32px; border: 1px solid var(--gp-borde); border-radius: 9999px; background: var(--gp-superficie); font-size: 13px; font-weight: 500; }
.gp .gp-stepper button { display: grid; place-items: center; width: 32px; height: 30px; border: 0; background: transparent; color: var(--gp-texto); cursor: pointer; border-radius: 9999px; }
.gp .gp-stepper button:hover:not(:disabled) { background: var(--gp-hover); }
.gp .gp-stepper button:disabled { opacity: .35; cursor: default; }
.gp .gp-stepper span { min-width: 92px; text-align: center; }
.gp .gp-nota-error { font-size: 12.5px; color: var(--gp-peligro); }
.gp .gp-esperando { display: inline-flex; align-items: center; gap: 10px; color: var(--gp-tenue); font-size: 14px; }
.gp .gp-esperando strong { color: var(--gp-titulo); font-weight: 600; }

/* Personalizar (en el esquema). */
.gp .gp-personalizar { display: flex; flex-direction: column; gap: 14px; padding: 16px; border-radius: 12px; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); }
.gp .gp-tarjeta-blanca .gp-personalizar { padding: 0; box-shadow: none; background: transparent; }
.gp .gp-campo-fila { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.gp .gp-campo-fila > .gp-campo { width: 100%; }
.gp .gp-segmentado { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 3px; border-radius: 10px; background: var(--gp-borde-suave); }
.gp .gp-segmentado button { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 14px; border: 0; border-radius: 8px; background: transparent; color: var(--gp-texto); font-size: 13px; font-weight: 500; cursor: pointer; }
.gp .gp-segmentado button[aria-checked="true"] { background: var(--gp-superficie); color: var(--gp-activo-texto); box-shadow: var(--gp-sombra-tarjeta); }

/* Esquema: la tarjeta de la instrucción y la barra de abajo. */
.gp .gp-tarjeta-blanca { display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: 12px; background: var(--gp-superficie); box-shadow: var(--gp-sombra-tarjeta); }
.gp .gp-instruccion-resumen { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0; color: var(--gp-tenue); font-size: 14px; }
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
  .gp .gp-generando { grid-template-columns: minmax(0, 1fr); }
  .gp .gp-gen-log { position: static; }
  .gp .gp-barra-abajo { margin: 0 -16px; padding: 10px 16px; grid-template-columns: 1fr auto; }
  .gp .gp-barra-abajo > span:last-child { display: none; }
}
`;
