'use client';

// =============================================================================
// SimuladorWhatsApp — la tab /chatbot: la lista de automatizaciones flotando sobre el lienzo
// =============================================================================
// El nombre es de cuando esto era un chat simulado (réplica de PlantillasView de SuperAdmin). Hoy
// es la pantalla entera: el lienzo de la automatización elegida de borde a borde, la lista
// flotando a la izquierda y, al tocar «Probar», el panel del canal elegido acoplado a la derecha
// (PanelProbar). El editor de la secuencia (SecuenciaPerfil) queda SIEMPRE montado.
//
// ── TERCERA TANDA (09/10/2026): «Probar» por canal, los tres puntos y «Nueva» al instante ──
//   · «PROBAR» ES DE UN CANAL (decisión 14): el desplegable lo dibuja SecuenciaPerfil y llama
//     `onProbar(canal)`; acá se guarda el canal y se monta PanelProbar con él. Otro canal es otro
//     panel (va en la `key`).
//   · LOS TRES PUNTOS DE CADA FILA (decisión 6, pedido literal: «en la sidebar donde están todas
//     las secuencias pon los típicos 3 puntos para poder hacer estas acciones, como activarla,
//     eliminarla, etc...»): el menú de la casa (`Dropdown` con «⋯», el de las columnas del CRM) con
//     Activar/Pausar, Duplicar y Eliminar. Eliminar ARCHIVA (se recupera desde la base) y pregunta
//     con la confirmación de la casa, una frase pegada al botón. El «⋯» tiene su PROPIA columna
//     (no tapa el nombre): para que el nombre siga entrando en dos renglones (tope 40), el punto
//     de estado pasó a ser una marca sobre el emoji, y la fila ganó los píxeles que el menú ocupa.
//   · «NUEVA» (decisión 7, pedido literal: «si le paso el cursor debería tener una animación... Y
//     al apretarlo... Mejor si se crea automáticamente la tarjeta en la sidebar y se abre el
//     lienzo, y que el loader en todo caso esté al entrar al lienzo»): una animación al pasar el
//     cursor (el ＋ gira, como el logo de la marca) y al tocarla la fila aparece YA, elegida, con el
//     lienzo abierto y un loader adentro. La fila la pone ChatAgentApp (`crearNueva`, con
//     `listaConCreando`); cuando el server contesta, la fila toma su id real y la selección la
//     sigue (por su clave, `claveCreando`). Si falla, la fila se va y vuelve la que estaba elegida.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dropdown } from '../components/Dropdown';
import { Confirm } from '@/app/_ui/Confirm';
import { SecuenciaPerfil, type EdicionLocal } from './SecuenciaPerfil';
import { PanelProbar, type CanalProbar } from './PanelProbar';
import { RecordatorioFlujo, NOMBRE_RECORDATORIO } from './RecordatorioFlujo';
import type { ProductoOpcion } from './ChatAgentApp';
import type { AudioSetting, SecuenciaDto, Opcion } from './ChatAgentApp';
import type { Objetivo } from '@/lib/setting-estrategia';
import { muelles as calcularMuelles, MUELLE } from '@/lib/lienzo-grafo';

export const EMOJI_OBJETIVO: Record<Objetivo, string> = { agendar: '📅', preparar: '🎯', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };

/**
 * EL ANCHO DE LA LISTA, Y SU HUECO AL BORDE. Son UNA constante porque los usan dos cosas: la
 * caja de la lista y el corrimiento de lo que flota sobre el lienzo. Con dos números, el título
 * vuelve a nacer debajo del buscador en cuanto alguien toque uno. El panel de «Probar» usa el
 * mismo hueco del lado derecho.
 *
 * Desde la segunda tanda viven en `MUELLE` (lib/lienzo-grafo.ts): los lee también `muelles`, la
 * única función que decide dónde va cada cosa que flota (la lista, «Probar» y el editor).
 */
export const LISTA_ANCHO = MUELLE.listaAncho;
const LISTA_HUECO = MUELLE.hueco;

/**
 * El tope del nombre de una automatización. Medido el 08/10/2026: los seis vigentes miden de 31
 * a 39 caracteres, y en dos renglones de la lista entran ~44. Lo hacen cumplir los escritores del
 * nombre (el server y el título del lienzo); la lista lo usa para el `title` de lo que no entre.
 */
export const TOPE_NOMBRE = 40;

/** El ítem del recordatorio en la lista. No es una fila de `nutricion_secuencias`. */
const ID_RECORDATORIO = 'recordatorio' as const;

// ── «Nueva» al instante (decisión 7) ──────────────────────────────────────────
// Viven ACÁ y no en ChatAgentApp porque los usan los dos y ChatAgentApp ya importa este archivo:
// al revés sería un ciclo.

/** El nombre de la fila mientras el server la crea: el mismo que le pone `crearSecuenciaVacia`. */
export const NOMBRE_CREANDO = 'Nueva automatización';

/**
 * La CLAVE de la fila que se está creando: dice qué fila es aunque su id cambie (nace con un id
 * negativo y toma el real cuando el server contesta). Ninguna clave de verdad empieza así.
 */
export const claveCreando = (temporal: number): string => `creando:${temporal}`;
export const esFilaCreando = (j: Pick<SecuenciaDto, 'clave'>): boolean => j.clave.startsWith('creando:');

/**
 * La fila que aparece YA al tocar «Nueva». Es una automatización vacía y pausada, como la que
 * crea el server (`crearSecuenciaVacia`: etapa y disparador 'manual', sin pasos): así, cuando el
 * server contesta, la fila no cambia de cara, sólo de id.
 */
export function filaCreando(temporal: number): SecuenciaDto {
  return {
    id: temporal, clave: claveCreando(temporal), nombre: NOMBRE_CREANDO, etapa: 'manual', trigger_tipo: 'manual',
    activa: false, pasos: [], inscriptos: 0, enviados: 0, estrategia: null,
    metricas: {} as SecuenciaDto['metricas'],
  };
}

/** Una creación en vuelo: el id temporal y, cuando el server contesta, el real. */
export type Creando = { temporal: number; id: number | null };

/**
 * La lista con la fila que se está creando AL FINAL (donde el server pone la nueva: ordena por id).
 * Se CALCULA, no se escribe en la lista: un `load()` que llegue en el medio (otra pantalla que
 * recarga) la borraría. Con el id real ya contestado, la fila tiene ese id; y cuando la fila de
 * verdad llega en la lista, ésta se va sola (mismo id): no hay un tercer paso que olvidar.
 */
export function listaConCreando(lista: readonly SecuenciaDto[], creando: Creando | null): SecuenciaDto[] {
  if (!creando) return [...lista];
  if (creando.id != null && lista.some((j) => j.id === creando.id)) return [...lista];
  return [...lista, { ...filaCreando(creando.temporal), id: creando.id ?? creando.temporal }];
}

/** Lo que ofrece el «⋯» de una fila. Activar o Pausar según cómo esté. */
export function opcionesDeFila(activa: boolean): Array<{ value: 'activa' | 'duplicar' | 'eliminar'; label: string }> {
  return [
    { value: 'activa', label: activa ? 'Pausar' : 'Activar' },
    { value: 'duplicar', label: 'Duplicar' },
    { value: 'eliminar', label: 'Eliminar' },
  ];
}

// El emoji que se eligió en el título (tercera tanda, decisión 8: `nutricion_secuencias.emoji`) y, sin
// uno elegido, el del objetivo, como el chrome del lienzo. El objetivo puede ser uno del catálogo O uno
// que escribió el dueño: para esos no hay emoji propio y cae al genérico.
const emojiSecuencia = (j: SecuenciaDto): string =>
  j.emoji || (j.estrategia ? (EMOJI_OBJETIVO[j.estrategia.objetivo as Objetivo] ?? '🎯') : '⚑');

const API_SECUENCIAS = '/api/chat-agent/secuencias';

async function pedir(url: string, method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<Record<string, unknown> & { ok?: boolean; error?: string }> {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
}

/**
 * Lo que un estilo en línea no puede: el hover de la fila y del «⋯», y la animación de «Nueva».
 * Con `prefers-reduced-motion` el ＋ no gira. Sin backticks acá adentro: es un template literal.
 *
 * ⚠️ El fondo de la fila y de «Nueva» va en la CLASE y no en el `style`: un estilo en línea le
 * gana a cualquier `:hover` (AGENTS.md, los 129 botones del CRM).
 */
const CSS_LISTA = `
.chb-fila{background:transparent;border-color:transparent;transition:background .14s ease}
.chb-fila:hover{background:var(--surface-2)}
.chb-fila.is-on{background:var(--surface-2);border-color:var(--border-strong)}
.chb-fila .chb-menu{opacity:0;transition:opacity .14s ease}
.chb-fila:hover .chb-menu,.chb-fila:focus-within .chb-menu,.chb-fila.is-on .chb-menu{opacity:1}
@media (hover: none){.chb-fila .chb-menu{opacity:1}}
.chb-nueva{background:transparent;color:var(--dim);border:1px dashed var(--border-strong);opacity:.85;transition:border-color .16s ease,color .16s ease,background .16s ease,opacity .16s ease}
.chb-nueva:hover,.chb-nueva:focus-visible{opacity:1;color:var(--primary);border-color:var(--primary);background:var(--primary-bg)}
.chb-nueva__mas{background:var(--surface-2);border:1px dashed var(--border-strong);color:var(--faint);transition:transform .24s cubic-bezier(.34,1.36,.64,1),color .16s ease,border-color .16s ease,background .16s ease}
.chb-nueva:hover .chb-nueva__mas,.chb-nueva:focus-visible .chb-nueva__mas{transform:rotate(90deg) scale(1.06);color:var(--primary);border-color:var(--primary);border-style:solid;background:var(--surface)}
.chb-nueva:active .chb-nueva__mas{transform:rotate(90deg) scale(.92)}
@media (prefers-reduced-motion: reduce){.chb-nueva__mas{transition:none}.chb-nueva:hover .chb-nueva__mas,.chb-nueva:focus-visible .chb-nueva__mas,.chb-nueva:active .chb-nueva__mas{transform:none}}
`;

/**
 * Un pedido de abrir el LIENZO de una automatización desde afuera (el link del aviso,
 * `/chatbot?sec=<id>`). Es un objeto y no un número a propósito: cada pedido es uno NUEVO, así
 * que el mismo id dos veces seguidas (dos avisos de la misma secuencia) vuelve a abrirla.
 */
export type AbrirSecuencia = { id: number };

export function SimuladorWhatsApp({ secuencias, objetivos, etiquetaEtapa, negocio, rolAdmin, audios, canalCaido, onAudioNuevo, onNueva, errorNueva, onReload, productos, disparadores, pie, tz, abrir, handoffs, pedidoIA }: {
  /** Las respuestas sin caso pendientes: la tarjeta «Si responde» las cuenta en «Otra cosa». */
  handoffs?: ReadonlyArray<{ secuenciaId: number | null }>;
  productos: ProductoOpcion[];
  disparadores: Opcion[];
  secuencias: SecuenciaDto[];
  objetivos: Opcion[];
  etiquetaEtapa: (key: string) => string;
  negocio: string;
  /** El WhatsApp del negocio está caído: prender una secuencia no va a enviar nada. */
  canalCaido: boolean;
  rolAdmin: boolean;
  audios: AudioSetting[];
  onAudioNuevo: (a: AudioSetting) => void;
  /**
   * «Nueva»: crea una automatización VACÍA y pausada y la abre con la caja de «Crear con IA»
   * (decisión 14 de la segunda tanda). `pedido` precarga la caja («Armar una»). Se llama SIEMPRE
   * por `nueva`, la puerta que pregunta por lo no publicado ANTES de crear.
   */
  onNueva: (pedido?: string) => void;
  /** Por qué no se pudo crear la última («＋ Nueva»): se dibuja pegado al botón. */
  errorNueva?: string | null;
  /** Un pedido ya escrito para la automatización recién creada («Armar una»). */
  pedidoIA?: { secuenciaId: number; pedido: string } | null;
  onReload: () => void;
  /** El pie de la LISTA (hoy: qué etapas quedaron sin secuencia). Viene de la tab
   *  porque el dato es del workspace, no de esta pieza. Como función recibe `nueva`, la puerta
   *  de crear: su «Armar una» pregunta por lo no publicado igual que «＋ Nueva». */
  pie?: ReactNode | ((nueva: (pedido?: string) => void) => ReactNode);
  /** La zona del negocio, para el texto del horario. */
  tz: string | null;
  /** Abrir esta automatización en su lienzo (el deep link `?sec=`). */
  abrir?: AbrirSecuencia | null;
}) {
  const [busq, setBusq] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'activas' | 'pausadas'>('todas');
  const [elegida, setSelId] = useState<number | typeof ID_RECORDATORIO | ''>('');
  /** La que estaba elegida antes de abrir una fila que se está creando: si falla, se vuelve. */
  const [volverA, setVolverA] = useState<number | typeof ID_RECORDATORIO | ''>('');

  // LA FILA NUEVA TOMÓ SU ID REAL: la selección la sigue, por su clave (decisión 7). Se aplica AL
  // DIBUJAR y no en un efecto: un efecto pintaría primero «Elige una automatización».
  let elegidaViva = elegida;
  if (typeof elegida === 'number' && elegida < 0) {
    const fila = secuencias.find((j) => j.clave === claveCreando(elegida));
    if (fila && fila.id !== elegida) { elegidaViva = fila.id; setSelId(fila.id); }
  }
  /**
   * Lo elegido, si todavía está; si no (se eliminó, o la fila nueva no se pudo crear), la que estaba
   * antes y, si tampoco, la primera. Se CALCULA y no se escribe con un efecto: un efecto que
   * corrige el estado dibuja primero la pantalla vacía y después la corrige.
   */
  const existe = (id: number | typeof ID_RECORDATORIO | ''): boolean =>
    id === ID_RECORDATORIO ? true : id !== '' && secuencias.some((j) => j.id === id);
  const selId = existe(elegidaViva) ? elegidaViva : existe(volverA) ? volverA : (secuencias[0]?.id ?? '');
  /** El panel de «Probar» abierto, y de qué canal. El lienzo NO se desmonta: se prueba lo que se edita. */
  const [probando, setProbando] = useState<CanalProbar | null>(null);
  /** Lo que el lienzo tiene sin publicar (`onCambioLocal`): es lo que prueba el panel. */
  const [edicion, setEdicion] = useState<EdicionLocal | null>(null);
  /** El interruptor del recordatorio, para el punto de la lista y el filtro. null = no se sabe. */
  const [recordatorioActivo, setRecordatorioActivo] = useState<boolean | null>(null);

  // El recordatorio es sólo del admin (su ruta tiene guard de admin): para el resto no existe.
  useEffect(() => {
    if (!rolAdmin) return;
    let vivo = true;
    void fetch('/api/chat-agent/recordatorio-reunion', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (vivo && j?.ok) setRecordatorioActivo(Boolean(j.activo));
    }).catch(() => { /* sin punto de estado */ });
    return () => { vivo = false; };
  }, [rolAdmin]);

  const sel = typeof selId === 'number' ? secuencias.find((j) => j.id === selId) : undefined;
  const creandoSel = !!sel && esFilaCreando(sel);
  // La fila que se está creando nace PAUSADA: con «Activas» o un texto en el buscador no se vería,
  // y «aparece YA en la lista» es lo que se pidió. Se limpian AL DIBUJAR, sólo mientras está elegida.
  if (creandoSel && (filtro !== 'todas' || busq)) { setFiltro('todas'); setBusq(''); }

  // ⚠️ EL BUSCADOR BUSCA POR NOMBRE, que es lo único que la lista muestra (pedido de Martín,
  // 08/10/2026, punto 3: «elimina el subtitulo, solo el título»). Buscar por un gancho que no se
  // ve devolvía filas que no dicen por qué coinciden.
  const q = busq.trim().toLowerCase();
  const pasaFiltro = (activa: boolean) => filtro === 'todas' || (filtro === 'activas') === activa;
  const lista = useMemo(
    () => secuencias.filter((j) => (filtro === 'todas' || (filtro === 'activas') === j.activa) && (!q || j.nombre.toLowerCase().includes(q))),
    [secuencias, q, filtro],
  );
  const verRecordatorio = rolAdmin
    && (filtro === 'todas' || (recordatorioActivo != null && pasaFiltro(recordatorioActivo)))
    && (!q || NOMBRE_RECORDATORIO.toLowerCase().includes(q));

  /**
   * Elegir OTRA automatización: cierra «Probar» y suelta la edición local de la anterior.
   *
   * ⚠️ TOCAR LA QUE YA ESTÁ ELEGIDA NO HACE NADA (revisión adversarial del 08/10/2026,
   * lienzo-5). Antes vaciaba `edicion` igual: el lienzo no se remonta (misma `key`) y su efecto no
   * vuelve a emitir hasta el próximo cambio, así que «Probar» caía a lo GUARDADO —el texto viejo,
   * sin «Cambió · ↻» y, con la prueba real prendida, mandándolo—. Un clic sin efecto visible no
   * puede cambiar qué se prueba.
   */
  const cambiarA = (id: number | typeof ID_RECORDATORIO) => {
    setSelId(id); setProbando(null); setEdicion(null);
    // Abrir la fila que se está creando recuerda de dónde se vino (si el server falla, se vuelve).
    if (typeof id === 'number' && id < 0) setVolverA(selId);
  };
  /**
   * ⚠️ Y CON CAMBIOS SIN PUBLICAR, SE PREGUNTA ANTES (decisión 15). El lienzo se remonta por
   * automatización (`key={sel.id}`), así que cambiar de una a otra tiraba lo no publicado sin
   * aviso (medido, R1/R3). La pregunta es la de la casa (`Confirm`), con la consecuencia pegada al
   * botón; «Nueva secuencia» pasa por la misma puerta.
   */
  const [sinPublicar, setSinPublicar] = useState(false);
  const [pendiente, setPendiente] = useState<{ ir: number | typeof ID_RECORDATORIO | 'nueva'; pedido?: string } | null>(null);
  const elegir = (id: number | typeof ID_RECORDATORIO) => {
    if (id === selId) return;
    if (sinPublicar) { setPendiente({ ir: id }); return; }
    cambiarA(id);
  };
  // ⚠️ La pregunta va ANTES de crear, también para «Armar una» del pie (revisión de la segunda
  // tanda, 09/10/2026): creaba la fila primero y «Seguir editando» dejaba una vacía de más.
  const nueva = (pedido?: string) => {
    if (sinPublicar) { setPendiente({ ir: 'nueva', pedido }); return; }
    onNueva(pedido);
  };
  const descartar = () => {
    const p = pendiente;
    setPendiente(null);
    if (!p) return;
    setSinPublicar(false);
    if (p.ir === 'nueva') onNueva(p.pedido);
    else cambiarA(p.ir);
  };
  const recibirEdicion = useCallback((v: EdicionLocal) => setEdicion(v), []);

  // ── Los tres puntos de cada fila (decisión 6) ─────────────────────────────────
  /** La fila con una acción en vuelo: su «⋯» se apaga hasta que vuelva. */
  const [ocupada, setOcupada] = useState<number | null>(null);
  /** Por qué no se pudo: debajo de ESA fila, no en otro lado. */
  const [errFila, setErrFila] = useState<{ id: number; texto: string } | null>(null);
  const [aEliminar, setAEliminar] = useState<SecuenciaDto | null>(null);
  const [eliminando, setEliminando] = useState(false);
  /** La copia recién creada: se abre cuando llegue en la lista (si no hay nada sin publicar). */
  const [abrirCopia, setAbrirCopia] = useState<number | null>(null);
  if (abrirCopia != null && secuencias.some((j) => j.id === abrirCopia)) {
    setAbrirCopia(null);
    // Con cambios sin publicar NO se abre: preguntar por algo que nadie pidió se lee como un
    // error. La copia queda a la vista en la lista.
    if (!sinPublicar) cambiarA(abrirCopia);
  }

  /**
   * Activar/Pausar y Duplicar. Lo valida el server: Activar valida lo mismo que Publicar
   * (`setSecuenciaActiva`) y Duplicar pasa los pasos por `setSecuenciaPasos`
   * (lib/secuencia-duplicar.ts); lo que contesta mal queda pegado a la fila.
   */
  const accionFila = async (j: SecuenciaDto, accion: string) => {
    if (accion === 'eliminar') { setErrFila(null); setAEliminar(j); return; }
    if (accion !== 'activa' && accion !== 'duplicar') return;
    setErrFila(null); setOcupada(j.id);
    try {
      if (accion === 'activa') {
        const r = await pedir('/api/whatsapp/secuencias', 'PATCH', { id: j.id, activa: !j.activa });
        if (!r.ok) { setErrFila({ id: j.id, texto: r.error || 'No se pudo cambiar' }); return; }
      } else {
        const r = await pedir(API_SECUENCIAS, 'POST', { action: 'duplicar', secuenciaId: j.id });
        if (!r.ok || !(Number(r.secuenciaId) > 0)) { setErrFila({ id: j.id, texto: r.error || 'No se pudo duplicar' }); return; }
        // La copia nace pausada: con «Activas» no se vería.
        if (filtro === 'activas') setFiltro('todas');
        setAbrirCopia(Number(r.secuenciaId));
      }
      onReload();
    } catch {
      setErrFila({ id: j.id, texto: 'Sin conexión' });
    } finally {
      setOcupada(null);
    }
  };

  /** Eliminar = ARCHIVAR (`archivarSecuencias`): deja de enviar, sale de la lista, se recupera desde la base. */
  const eliminar = async () => {
    const j = aEliminar;
    if (!j) return;
    setEliminando(true);
    try {
      const r = await pedir(API_SECUENCIAS, 'POST', { action: 'archivar', ids: [j.id] });
      if (!r.ok) { setErrFila({ id: j.id, texto: r.error || 'No se pudo eliminar' }); return; }
      // Lo no publicado de la que se fue ya no tiene dónde publicarse: que no pregunte al cambiar.
      if (j.id === selId) setSinPublicar(false);
      onReload();
    } catch {
      setErrFila({ id: j.id, texto: 'Sin conexión' });
    } finally {
      setEliminando(false); setAEliminar(null);
    }
  };

  /**
   * LOS MUELLES (decisión 11): dónde va «Probar», el editor apaisado y lo que cada cosa que flota
   * tiene que dejar libre. Lo decide UNA función pura (`muelles`, lib/lienzo-grafo.ts) con la caja
   * de esta tab: acá sólo se mide la caja y se reparte el resultado.
   */
  const raiz = useRef<HTMLDivElement | null>(null);
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const medir = () => setCaja((c) => (c.w === el.clientWidth && c.h === el.clientHeight ? c : { w: el.clientWidth, h: el.clientHeight }));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * EL LINK DEL AVISO ABRE EL LIENZO (revisión adversarial del 08/10/2026, costuras-5). El aviso
   * de una charla que pasó a una persona dice «súmalo como caso en «Si responde»» con
   * `/chatbot?sec=<id>`, y ese link abría el wizard de 9 pasos, donde «Si responde» no existe.
   * Se aplica AL DIBUJAR y no en un efecto: un efecto pintaría primero la primera de la lista y
   * después la del link. Es también la puerta por la que se abre la fila que se está creando.
   */
  const [abrirVisto, setAbrirVisto] = useState<AbrirSecuencia | null>(null);
  if (abrir && abrir !== abrirVisto && secuencias.some((j) => j.id === abrir.id)) {
    setAbrirVisto(abrir);
    elegir(abrir.id);
  }

  // `editorAbierto: true`: lo que se reparte es el muelle que el editor ocupa CUANDO se abre (el
  // lienzo lo usa al tocar una tarjeta). «Probar» no depende de eso (ver `muelles`).
  const probarVisible = probando != null && !!sel && !creandoSel && caja.w > 0;
  const m = calcularMuelles(caja, { listaAbierta: true, probarAbierto: probarVisible, editorAbierto: true });

  /**
   * LA TAB ES EL LIENZO, Y LA LISTA SE LE APOYA ENCIMA.
   *
   * Martín, con la captura de /mensajes al lado: «fijate la sidebar que quiero que copies, es
   * como flotando, con bordes más redondos, con la barra de búsqueda… replicala tal cual… Y por
   * atrás debe pasar también la grilla». La cuadrícula NO se corta donde empieza la lista: el
   * lienzo ocupa el ancho entero y la lista es una tarjeta con su sombra encima (`position:
   * absolute`, no una columna del flex, que le quitaría ancho al lienzo).
   *
   * ⚠️ «PROBAR» YA NO REEMPLAZA AL LIENZO (punto 10, 08/10/2026). Era un modo 'chat' que
   * desmontaba el editor —se perdía lo no publicado— y dejaba el chat debajo de esta lista, con
   * «Editar» como única salida. Ahora es un panel acoplado a la DERECHA, como la lista a la
   * izquierda, y el lienzo le corre lo que flota con `insetDer`.
   */
  return (
    <div ref={raiz} style={{ flex: 1, minHeight: 0, position: 'relative', minWidth: 0, display: 'flex' }}>
      <style>{CSS_LISTA}</style>
      {/* EL LIENZO: debajo de todo y de borde a borde. */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {selId === ID_RECORDATORIO && rolAdmin ? (
          <RecordatorioFlujo negocio={negocio} insetIzq={m.insets.izq} onCambio={setRecordatorioActivo} />
        ) : !sel ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 14 }}>
            Elige una automatización
          </div>
        ) : creandoSel ? (
          /* «NUEVA» AL INSTANTE (decisión 7): el lienzo ya está abierto, con su cuadrícula, y lo
             que tarda —el server creando la fila— se ve ACÁ adentro. El lienzo de verdad se monta
             cuando la fila tiene su id real (no hay a dónde guardar antes). */
          <div aria-busy="true" style={{
            flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            paddingLeft: m.insets.izq, color: 'var(--dim)', fontSize: 13.5,
            backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '22px 22px',
          }}>
            <span className="mk-spin" style={{ width: 18, height: 18 }} aria-hidden />
            Creando…
          </div>
        ) : (
          /**
           * ⚠️ EL `key` ES OBLIGATORIO, y es un hallazgo de esta casa: «un `useState`
           * sembrado de props no se resiembra; si la vista deja de desmontarse, hay que
           * poner el key». Se cambia de secuencia SIN desmontar, así que sin esto el
           * nombre, el texto, el interruptor y el producto se quedarían con los de la
           * anterior.
           */
          <SecuenciaPerfil key={sel.id} secuencia={sel} objetivos={objetivos} etiquetaEtapa={etiquetaEtapa} rolAdmin={rolAdmin} audios={audios} negocio={negocio} canalCaido={canalCaido} tz={tz}
            insetIzq={m.insets.izq}
            insetDer={m.insets.der || undefined}
            muelles={m}
            onSinPublicar={setSinPublicar}
            handoffs={handoffs}
            onAudioNuevo={onAudioNuevo}
            productos={productos} disparadores={disparadores}
            secuencias={secuencias}
            onAbrirClave={(clave) => {
              // El «Sigue con» del lienzo tiene que LLEVAR: un nodo que nombra otra
              // secuencia y no la abre es la mitad inútil del encadenamiento.
              const otra = secuencias.find((j) => j.clave === clave);
              if (otra) elegir(otra.id);
            }}
            /* El canal lo elige el desplegable de «Probar» (SecuenciaPerfil, `onProbar(canal)`), y
               el panel se monta con ESE canal. Una sola forma: el tipo es `CanalProbar` en las dos
               puntas, así que no hay un «sin canal» que adivinar. */
            onProbar={(canal: CanalProbar) => setProbando(canal)}
            onCambioLocal={recibirEdicion}
            pedidoIA={pedidoIA?.secuenciaId === sel.id ? pedidoIA.pedido : undefined}
            onCambio={onReload} />
        )}
      </div>

      {/* LA LISTA, FLOTANDO.
          `aria-label` porque la app YA tiene un <aside>: el de la navegación global. Sin
          nombre los dos son «complementary» y no hay forma de distinguirlos —ni para un
          lector de pantalla ni para una verificación, que es como un arnés terminó
          clickeando los íconos del menú de la izquierda creyendo que eran secuencias.
          Y lleva su `overflowY` con la barra teñida de la casa: el scroll es del
          CONTENIDO —sus secuencias—, no de la navegación de la app, así que se ve. */}
      <aside aria-label="Tus secuencias" style={{
        position: 'absolute', left: LISTA_HUECO, top: LISTA_HUECO, bottom: LISTA_HUECO, width: LISTA_ANCHO, zIndex: 3,
        display: 'flex', flexDirection: 'column', minHeight: 0,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
        boxShadow: '0 8px 28px rgba(18,21,27,.12)', overflow: 'hidden',
      }}>
        {/* El buscador va SIEMPRE, como en el molde. Antes aparecía con más de seis
            secuencias, y un control que aparece solo es un control que nadie busca. */}
        <div style={{ flex: 'none', padding: '14px 14px 12px', borderBottom: '1px solid var(--border)' }}>
          <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar" aria-label="Buscar por nombre"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13.5, outline: 'none' }} />
          <div style={{ marginTop: 10 }}>
            {/* El filtro del molde es por categoría; acá la pregunta equivalente es por
                ESTADO. Una pausada no manda nada, y es lo que uno busca cuando algo no
                sale. Un filtro que devuelve siempre la misma lista sería ruido. */}
            <Dropdown value={filtro} onChange={(v) => setFiltro(v as 'todas' | 'activas' | 'pausadas')} width={180}
              ariaLabel="Filtrar secuencias" buttonStyle={{ padding: '8px 11px', fontSize: 13 }}
              options={[
                { value: 'todas', label: `Todas · ${secuencias.length}` },
                { value: 'activas', label: `Activas · ${secuencias.filter((j) => j.activa).length}` },
                { value: 'pausadas', label: `Pausadas · ${secuencias.filter((j) => !j.activa).length}` },
              ]} />
          </div>
        </div>
        <div className="mk-scroll-oscuro" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
          {rolAdmin && (
            <button type="button" onClick={() => nueva()} className="chb-nueva"
              style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', padding: '10px', borderRadius: 12, cursor: 'pointer', marginBottom: 6, fontFamily: 'inherit' }}>
              <span aria-hidden className="chb-nueva__mas" style={{ width: 36, height: 36, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>＋</span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Nueva</span>
            </button>
          )}
          {rolAdmin && errorNueva && <div role="alert" style={{ padding: '0 12px 8px', fontSize: 12.5, color: 'var(--bad)' }}>{errorNueva}</div>}
          {lista.length === 0 && !verRecordatorio && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13 }}>Ninguna coincide</div>}
          {lista.map((j) => {
            const creando = esFilaCreando(j);
            return (
              <div key={creando ? j.clave : j.id}>
                <ItemLista on={j.id === selId} activa={j.activa} emoji={emojiSecuencia(j)} nombre={j.nombre} creando={creando}
                  onClick={() => elegir(j.id)}
                  menu={rolAdmin && !creando ? (
                    /* ⚠️ VA EL `Dropdown` DE LA CASA y no un menú propio: la lista scrollea
                       (`overflowY: auto`) y un menú en flujo se recortaría contra su borde. Éste se
                       dibuja por portal. Es el molde del «⋯» de las columnas del CRM. */
                    <Dropdown value="" placeholder="⋯" align="right" resetAfterSelect sinFlecha search={false}
                      ariaLabel={`Opciones de ${j.nombre}`} disabled={ocupada === j.id}
                      buttonStyle={{ width: 28, height: 28, padding: 0, justifyContent: 'center', border: '1px solid transparent', background: 'transparent', color: 'var(--dim)', fontSize: 16, lineHeight: 1 }}
                      options={opcionesDeFila(j.activa)}
                      onChange={(v) => void accionFila(j, v)} />
                  ) : undefined} />
                {errFila?.id === j.id && <div role="alert" style={{ padding: '0 12px 8px 56px', fontSize: 12.5, color: 'var(--bad)' }}>{errFila.texto}</div>}
              </div>
            );
          })}
          {/* EL RECORDATORIO, COMO UNA AUTOMATIZACIÓN MÁS (punto 2). Lo sigue mandando su
              emisor de siempre; la lista sólo lo abre en su lienzo. Sin «⋯»: no se duplica ni
              se archiva (no es una fila de secuencias), y se prende en su propio lienzo. */}
          {verRecordatorio && (
            <ItemLista on={selId === ID_RECORDATORIO} activa={recordatorioActivo === true} emoji="⏰" nombre={NOMBRE_RECORDATORIO} onClick={() => elegir(ID_RECORDATORIO)} />
          )}
        </div>
        {/* El pie de la lista: lo que antes era una franja arriba del lienzo y le comía
            alto a la pizarra. Acá cuelga de lo que nombra —las secuencias— y no ocupa
            un renglón de la tab. */}
        {pie && <div style={{ flex: 'none', borderTop: '1px solid var(--border)', padding: '9px 14px' }}>{typeof pie === 'function' ? pie(nueva) : pie}</div>}
      </aside>

      {/* «PROBAR», EN SU MUELLE (decisión 11): ancho y bajo, arriba a la derecha y debajo del
          chrome; o de arriba a abajo a la derecha si la ventana es baja. El rectángulo sale de
          `muelles` y el panel lo LLENA (width/height 100 %): ni el ancho ni el alto se deciden
          adentro. Se remonta por automatización y por canal: otra secuencia u otro canal es otra
          prueba. */}
      {probarVisible && sel && m.probar && (
        <div data-muelle="probar" style={{ position: 'absolute', left: m.probar.left, top: m.probar.top, width: m.probar.width, height: m.probar.height, zIndex: 3, display: 'flex' }}>
          <PanelProbar
            key={`${sel.id}-${probando}`}
            canal={probando ?? 'whatsapp'}
            secuencia={sel} edicion={edicion} secuencias={secuencias} audios={audios} negocio={negocio}
            rolAdmin={rolAdmin} etiquetaEtapa={etiquetaEtapa} onCerrar={() => setProbando(null)}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}

      {/* Lo no publicado se pregunta ANTES de perderlo (decisión 15). La consecuencia, pegada al
          botón: el texto que se dibuja es corto (AGENTS.md). */}
      {pendiente && (
        <Confirm
          message="Tienes cambios sin publicar"
          confirmLabel="Descartar cambios" cancelLabel="Seguir editando" tone="danger"
          onConfirm={descartar} onCancel={() => setPendiente(null)}
        />
      )}

      {/* Eliminar ARCHIVA: la confirmación de la casa, una frase pegada al botón. */}
      {aEliminar && (
        <Confirm
          message={`«${aEliminar.nombre}» deja de enviar y sale de la lista.`}
          confirmLabel="Eliminar automatización" cancelLabel="No eliminar" tone="danger" loading={eliminando}
          onConfirm={() => void eliminar()} onCancel={() => setAEliminar(null)}
        />
      )}
    </div>
  );
}

/**
 * Una fila de la lista: el emoji (con el punto de estado encima), el NOMBRE ENTERO y su «⋯».
 *
 * ⚠️ SIN SUBTÍTULO (pedido de Martín, 08/10/2026, punto 3): «elimina el subtitulo, solo el
 * título. Y procura que se vea todo, con un máximo de caracteres para los títulos». El nombre va
 * en DOS renglones (`line-clamp`). Antes medía ~162 px (emoji 38 + punto 8 al costado). Con el
 * «⋯» de la tercera tanda (28 px) el punto se mudó ENCIMA del emoji y la fila se ajustó (emoji
 * de 36, relleno de 10 y 4): el nombre sigue midiendo ~162 px, o sea ~44 caracteres en dos
 * renglones, por encima del tope de 40. El «⋯» tiene su columna propia y no tapa el nombre;
 * aparece al pasar el cursor, con la fila elegida y siempre en una pantalla táctil.
 *
 * La fila es un <div> con DOS botones (abrir y el menú): un botón adentro de otro no es HTML.
 */
function ItemLista({ on, activa, emoji, nombre, onClick, menu, creando }: {
  on: boolean; activa: boolean; emoji: string; nombre: string; onClick: () => void;
  /** El «⋯» de la fila. Sin él (el recordatorio, la que se está creando, quien no es admin), nada. */
  menu?: ReactNode;
  /** La fila que el server está creando: en vez del emoji, el giro. */
  creando?: boolean;
}) {
  return (
    <div className={`chb-fila${on ? ' is-on' : ''}`}
      style={{ display: 'flex', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderStyle: 'solid', marginBottom: 2 }}>
      <button type="button" onClick={onClick} title={nombre.length > TOPE_NOMBRE ? nombre : undefined} aria-current={on || undefined}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', padding: '10px 4px 10px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', opacity: activa || creando ? 1 : 0.55 }}>
        {/* El punto dice el estado sin una palabra: en una fila de 272 px, «pausada» se come el
            nombre. El rótulo entero está en el lienzo. */}
        <span style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          {creando ? <span className="mk-spin" style={{ width: 14, height: 14 }} aria-hidden /> : emoji}
          <span title={activa ? 'Activa' : 'Pausada'} style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: '50%', background: activa ? 'var(--good)' : 'var(--border-strong)', boxShadow: `0 0 0 2px ${on ? 'var(--surface-2)' : 'var(--surface)'}` }} />
        </span>
        <span style={{ minWidth: 0, flex: 1, fontWeight: 600, fontSize: 13.5, lineHeight: 1.3, color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{nombre}</span>
      </button>
      {menu && <span className="chb-menu" style={{ flex: 'none', marginRight: 4, display: 'inline-flex' }}>{menu}</span>}
    </div>
  );
}
