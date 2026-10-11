'use client';

// =============================================================================
// EditorInforme — la tab Dashboard ENTERA: un editor de informes estilo Looker Studio con los gráficos de MaKo
// =============================================================================
// Pedidos de Martín (10-11/10/2026): «Puedes copiar la app de Google Data Studio para esto», «Todo la tab
// de Dashboard debe ser el editable, no lo pongas como un recuadro abajo», y el feedback de veinticuatro
// puntos del 11/10 (el texto literal está en app/admin/dev/dashboard/bitacora.ts). Cómo quedó, de arriba
// abajo:
//
//   · LA FILA DE ARRIBA (./Cabecera.tsx): el ícono de la tab (el de la sidebar), las HOJAS con su menú
//     (⋮ y clic derecho, también mirando), la pestaña «Nueva hoja» y a la derecha el «?», AI Analyst,
//     Exportar, Editar/Ver y el ⋯ (Restablecer el informe). Sin «Dashboard» y sin «Guardado»: un
//     guardado que falla avisa con un toast.
//   · LA BARRA DE EDICIÓN, sólo editando, DEBAJO de las hojas (punto 7: las hojas no se mueven al apretar
//     Editar): deshacer, rehacer, Añadir un gráfico (con los bloques de MaKo), Insertar, Añadir datos y
//     Estilo (el de TODA la hoja, ./PanelEstilo.tsx).
//   · EL LIENZO, que es lo único que scrollea: la cabecera de la hoja (emoji, título, subtítulo), la barra
//     de CONTROLES pegada arriba (sticky, ./BarraControles.tsx: los filtros de la vista, que andan también
//     mirando) y la grilla. Una sola superficie: var(--bg) de punta a punta (./editor-css.ts).
//   · EL PANEL DE PROPIEDADES, sólo con algo elegido (./Propiedades.tsx): el CONTENIDO del componente.
//   · EL AI ANALYST, un panel del costado en la misma fila que el lienzo (./PanelAnalista.tsx): es un
//     `aside` de alto completo, no un modal.
//
// ESTADO, en tres capas que no se mezclan:
//   1. EL INFORME (`tablero`): lo que se guarda. Todo cambio pasa por `mutar`, que apila el deshacer, y
//      se autoguarda con un respiro. Si la lectura falló (`lecturaFallo`), NO se guarda nada: el primer
//      cambio pisaría el informe real de la persona.
//   2. LA VISTA (`vista`): lo que alguien elige en un control MIRANDO. Es como en Looker: no se guarda, no
//      pasa por `mutar` y no dispara el autoguardado (tests/dashboard-pantalla.test.ts).
//   3. LOS DATOS: los pide cada gráfico y cada bloque con `efectivoDe` (el período, los filtros y el
//      «agrupar por» que le tocan, lib/graficos-catalogo.ts), y sólo si cambió su FIRMA (./exportar.ts).
//      `version` sube con `refrescar()`, después de una acción que cambia los datos (marcar una cuota
//      cobrada en el detalle o en un bloque).
//
// ⚠️ MIRAR NO GUARDA: la grilla avisa un cambio también al MONTAR, cuando compacta lo que vino. Así se
//    guardó el informe de Mauricio el 11/10 a las 01:59 sin que tocara nada. `alMoverGrilla` sólo
//    escribe editando (tests/graficos.test.ts).
// ⚠️ Cambiar de hoja usa `window.history.replaceState` y no `router.replace`: con el router, cada clic de
//    pestaña volvía a correr la página del server (el informe y TODOS los datos de esa hoja) para tirar
//    el resultado. Next integra el replaceState nativo a su router.
// ⚠️ Mientras corre un recorrido, los atajos (Supr, Ctrl+Z) se apagan: el recorrido sólo frena Escape y
//    Tab, y debajo del velo Supr borraba el componente elegido sin que se viera.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Layout } from 'react-grid-layout';
import { absoluteStrategy } from 'react-grid-layout/core';
import 'react-grid-layout/css/styles.css';
import { Banner, Modal, Toast, useConfirm, useToast } from '@/app/_ui';
import { useWs } from '@/app/_ui/Link';
import { usePilaDeshacer } from '@/app/_ui/usePilaDeshacer';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { BotonRecorrido, Recorrido, useRecorrido } from '@/app/_ui/Recorrido';
import { MakoButton } from '@/app/_components/ChartIA';
import { useHojasDeFuentes } from '@/app/_cursos/SelectorFuente';
import { useFocoInicial } from '@/app/customer-success/curso/dialogo-foco';
import { conWs } from '@/lib/ws-tab';
import {
  AREAS, COLS, FUENTES, MAX_COMPONENTES, MAX_CONTROLES, MAX_HOJAS,
  campoDe, efectivoDe, esBloque, esElemento, esGrafico, nuevoBloque, nuevoControlVista, nuevoElemento, nuevoGrafico, nuevoId,
  sanearComponente, sanearControlVista, sanearControles, tituloDe, tonoDe,
  type BloqueId, type Componente, type ControlVista, type Efectivo, type Hoja, type Tablero, type TipoElemento, type ValorControl, type VistaValores,
} from '@/lib/graficos-catalogo';
import { colorDeTono, estiloEfectivo, letrasDe, paletaDe, sanearTema, varsDeTema, type TemaHoja } from '@/lib/graficos-temas';
import { tableroInicial } from '@/lib/graficos-plantillas';
import type { Resultado } from '@/lib/graficos-agregar';
import type { DatosGrafico } from '@/lib/graficos-datos';
import type { DatosBloque } from '@/lib/graficos-bloques';
import type { SelDetalle } from '@/lib/graficos-acciones';
import { CuerpoGrafico, esTarjetaNumero, type EstadoDatos } from './Grafico';
import { CuerpoBloque, type EstadoBloque } from './bloques/CuerpoBloque';
import { CuerpoElemento, PropsElemento } from './Elemento';
import { NuevaHoja } from './NuevaHoja';
import { BotonAnalista, PanelAnalista } from './PanelAnalista';
import { BarraControles, ChipsControles } from './BarraControles';
import { DetalleModal } from './Detalle';
import { CabeceraHoja, FilaHojas } from './Cabecera';
import { PropsBloque, PropsGrafico } from './Propiedades';
import { PanelEstilo } from './PanelEstilo';
import {
  Flotante, Galeria, MenuInsertar, SvgAgregarDatos, SvgAgregarGrafico, SvgDeshacer, SvgEstilo, SvgExportar, SvgFlecha, SvgInsertar, SvgLapiz, SvgLupa, SvgOjo,
} from './Galeria';
import { CSS } from './editor-css';
import { contextoDeGrafico, csvDeHoja, enOrden, loQueSeVeDe, nombreArchivo, pedidosDeHoja, periodoDeHoja, type PedidosHoja } from './exportar';
import { PASOS_DASHBOARD, PASOS_DASHBOARD_EDICION, RECORRIDO_DASHBOARD, RECORRIDO_DASHBOARD_EDICION } from './recorridos-dashboard';

/** La grilla: 12 columnas, filas de 30 px y 16 px entre tarjetas. ⚠️ El PDF (editor-css.ts) repite estos números. */
const FILA = 30;
const MARGEN = 16;
/** Por debajo de este ancho, la grilla de 12 columnas no se lee: las tarjetas van una abajo de la otra. */
const ANCHO_PILA = 640;
/** Cuánto espera el respiro del autoguardado y el de los pedidos de datos. */
const RESPIRO_GUARDAR_MS = 700;
const RESPIRO_DATOS_MS = 250;

type Menu =
  | { ancla: HTMLElement; tipo: 'graficos' | 'cambiarTipo' | 'insertar' | 'estilo' | 'exportar' | 'mas' }
  | { ancla: HTMLElement; tipo: 'hoja'; hojaId: string }
  | null;

function aEstado(d: DatosGrafico | undefined): EstadoDatos {
  if (!d) return { cargando: true };
  return d.ok ? { cargando: false, resultado: d.resultado } : { cargando: false, error: d.error };
}
function aEstadoBloque(d: DatosBloque | undefined): EstadoBloque {
  if (!d) return { cargando: true };
  return d.ok ? { cargando: false, datos: d.datos } : { cargando: false, error: d.error };
}
/** Si el foco está donde se tipea, las teclas son del texto, no del editor. */
function enUnTexto(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT');
}
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Lo de un componente que tiene id propio (él y sus controles), nuevo: para duplicar sin compartir lo elegido mirando. */
function conIdsNuevos(c: Componente): Componente {
  if (esElemento(c)) return { ...c, id: nuevoId() };
  return { ...c, id: nuevoId(), controles: c.controles.map((k) => ({ ...k, id: nuevoId() })) };
}
const altoDe = (h: number) => h * FILA + (h - 1) * MARGEN;
function descargar(texto: string, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function EditorInforme({ inicial, datosIniciales, bloquesIniciales, lecturaFallo, hoy, hojaInicial }: {
  inicial: Tablero;
  datosIniciales: Record<string, DatosGrafico>;
  bloquesIniciales: Record<string, DatosBloque>;
  lecturaFallo: boolean;
  hoy: string;
  hojaInicial: string;
}) {
  const [tablero, setTablero] = useState<Tablero>(inicial);
  const tableroRef = useRef(tablero);
  tableroRef.current = tablero;
  const [hojaId, setHojaId] = useState(hojaInicial);
  const [editando, setEditando] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [modalDatos, setModalDatos] = useState(false);
  const [nuevaHoja, setNuevaHoja] = useState(false);
  const [analista, setAnalista] = useState(false);
  const [detalle, setDetalle] = useState<{ id: string; sel: SelDetalle } | null>(null);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [vista, setVista] = useState<VistaValores>({});
  const [version, setVersion] = useState(0);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [datos, setDatos] = useState<Record<string, EstadoDatos>>(() => {
    const o: Record<string, EstadoDatos> = {};
    for (const [id, d] of Object.entries(datosIniciales)) o[id] = aEstado(d);
    return o;
  });
  const [datosBloque, setDatosBloque] = useState<Record<string, EstadoBloque>>(() => {
    const o: Record<string, EstadoBloque> = {};
    for (const [id, d] of Object.entries(bloquesIniciales)) o[id] = aEstadoBloque(d);
    return o;
  });
  const { toast, show, clear } = useToast(6000);
  const { confirm, confirmNode } = useConfirm();
  const { width, containerRef, mounted } = useContainerWidth();
  const ws = useWs();
  const guardable = !lecturaFallo;

  const hoja = tablero.hojas.find((h) => h.id === hojaId) ?? tablero.hojas[0];
  const sel = editando ? hoja.componentes.find((c) => c.id === selId) ?? null : null;

  // ── El recorrido: uno para mirar y otro para editar (el «?» abre el del lugar) ─────────────────
  // No se abre solo con un menú o un modal abierto: los flotantes del editor van por encima del velo.
  const capaAbierta = !!menu || modalDatos || nuevaHoja || analista || !!detalle;
  const recorrido = useRecorrido(RECORRIDO_DASHBOARD, { autoabrir: !editando && !capaAbierta });
  const recorridoEdicion = useRecorrido(RECORRIDO_DASHBOARD_EDICION, { autoabrir: editando && !recorrido.abierto && !capaAbierta });
  const enRecorrido = recorrido.abierto || recorridoEdicion.abierto;

  // ── El tema de la hoja: su letra se baja, sus variables pintan el lienzo ─────────────────────
  useHojasDeFuentes(letrasDe(hoja.tema));
  const estilo = useMemo(() => estiloEfectivo(hoja.tema), [hoja.tema]);
  const colores = useMemo(() => paletaDe(hoja.tema), [hoja.tema]);
  const varsTema = useMemo(() => varsDeTema(hoja.tema) as CSSProperties, [hoja.tema]);

  // ── Deshacer / rehacer (y Ctrl+Z / Ctrl+Y, sólo editando y nunca debajo de un recorrido) ─────────
  const pila = usePilaDeshacer<Tablero>((estado) => {
    const actual = tableroRef.current;
    setTablero(estado);
    return actual;
  }, { activa: editando && !enRecorrido });
  const { apilar, deshacer } = pila;
  /** Todo cambio de una persona al INFORME pasa por acá: así cada uno se puede deshacer y se guarda. */
  const mutar = useCallback((fn: (t: Tablero) => Tablero) => {
    apilar(tableroRef.current);
    setTablero((t) => fn(t));
  }, [apilar]);
  const mutarHoja = useCallback((fn: (h: Hoja) => Hoja, id = hoja.id) => {
    mutar((t) => ({ ...t, hojas: t.hojas.map((h) => (h.id === id ? fn(h) : h)) }));
  }, [mutar, hoja.id]);

  // ── Los datos: sólo lo de la hoja a la vista, y sólo si su firma cambió ───────────────────────
  const firmaPedida = useRef<Record<string, string> | null>(null);
  if (firmaPedida.current === null) {
    // Lo que trajo el server en la primera pintada ya está pedido: con la vista vacía y la versión 0,
    // con la MISMA función que usó page.tsx.
    const h0 = inicial.hojas.find((h) => h.id === hojaInicial) ?? inicial.hojas[0];
    const p0 = pedidosDeHoja(h0, {}, hoy, 0);
    const f: Record<string, string> = {};
    for (const x of p0.graficos) if (datosIniciales[x.g.id]) f[x.g.id] = x.firma;
    for (const x of p0.bloques) if (bloquesIniciales[x.b.id]) f[x.b.id] = x.firma;
    firmaPedida.current = f;
  }
  useEffect(() => {
    const firmas = firmaPedida.current!;
    const p = pedidosDeHoja(hoja, vista, hoy, version);
    const graficos = p.graficos.filter((x) => firmas[x.g.id] !== x.firma);
    const bloques = p.bloques.filter((x) => firmas[x.b.id] !== x.firma);
    if (!graficos.length && !bloques.length) return;

    const pedirGraficos = async (lista: PedidosHoja['graficos']) => {
      setDatos((prev) => {
        const n = { ...prev };
        for (const { g } of lista) n[g.id] = { ...(n[g.id] ?? {}), cargando: true };
        return n;
      });
      let respuesta: Record<string, DatosGrafico> = {};
      let fallo = false;
      try {
        const r = await fetch('/api/graficos', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ accion: 'datos', pedidos: lista.map((x) => x.pedido) }),
          signal: AbortSignal.timeout(65_000),
        });
        if (!r.ok) fallo = true; else respuesta = (await r.json()).datos ?? {};
      } catch { fallo = true; }
      setDatos((prev) => {
        const n = { ...prev };
        for (const x of lista) {
          // Si entre medio cambió el gráfico (o la vista, o la versión), esta respuesta ya es vieja.
          if (firmas[x.g.id] !== x.firma) continue;
          n[x.g.id] = fallo ? { cargando: false, error: 'No pude leer los datos' } : aEstado(respuesta[x.g.id] ?? { ok: false, error: 'Sin respuesta' });
        }
        return n;
      });
    };
    const pedirBloques = async (lista: PedidosHoja['bloques']) => {
      setDatosBloque((prev) => {
        const n = { ...prev };
        for (const { b } of lista) n[b.id] = { ...(n[b.id] ?? {}), cargando: true };
        return n;
      });
      let respuesta: Record<string, DatosBloque> = {};
      let fallo = false;
      try {
        const r = await fetch('/api/graficos', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ accion: 'bloques', pedidos: lista.map((x) => x.pedido) }),
          signal: AbortSignal.timeout(65_000),
        });
        if (!r.ok) fallo = true; else respuesta = (await r.json()).datos ?? {};
      } catch { fallo = true; }
      setDatosBloque((prev) => {
        const n = { ...prev };
        for (const x of lista) {
          if (firmas[x.b.id] !== x.firma) continue;
          n[x.b.id] = fallo ? { cargando: false, error: 'No pude leer los datos' } : aEstadoBloque(respuesta[x.b.id] ?? { ok: false, error: 'Sin respuesta' });
        }
        return n;
      });
    };

    const t = setTimeout(() => {
      for (const x of graficos) firmas[x.g.id] = x.firma;
      for (const x of bloques) firmas[x.b.id] = x.firma;
      // Son una RUTA y no server actions, así que los dos pedidos salen a la vez (las actions se encolan).
      if (graficos.length) void pedirGraficos(graficos);
      if (bloques.length) void pedirBloques(bloques);
    }, RESPIRO_DATOS_MS);
    return () => clearTimeout(t);
  }, [hoja, vista, hoy, version]);
  /** Después de una acción que cambia los datos (una cuota cobrada): todo lo de la hoja se vuelve a pedir. */
  const refrescar = useCallback(() => setVersion((v) => v + 1), []);

  /** Lo que mira cada gráfico y cada bloque de la hoja, resuelto una vez: lo usan los chips, el detalle y el CSV. */
  const efectivos = useMemo(() => {
    const o: Record<string, Efectivo> = {};
    for (const c of hoja.componentes) if (!esElemento(c)) o[c.id] = efectivoDe(c, hoja, vista, hoy);
    return o;
  }, [hoja, vista, hoy]);
  const resultados = useMemo(() => {
    const o: Record<string, Resultado | undefined> = {};
    for (const [id, e] of Object.entries(datos)) o[id] = e.resultado;
    return o;
  }, [datos]);

  // ── El guardado: solo, con un respiro, y nunca si la lectura falló ─────────────────────────────
  const ultimoGuardado = useRef(JSON.stringify(inicial));
  const pendienteGuardar = useRef<string | null>(null);
  const mandar = useCallback(async (json: string, keepalive = false) => {
    if (!guardable || json === ultimoGuardado.current) return;
    try {
      const r = await fetch('/api/graficos', {
        method: 'POST', headers: { 'content-type': 'application/json' }, keepalive,
        body: `{"accion":"guardar","tablero":${json}}`,
      });
      if (!r.ok) throw new Error(String(r.status));
      ultimoGuardado.current = json;
      if (pendienteGuardar.current === json) pendienteGuardar.current = null;
    } catch {
      // «Guardado» se fue de la fila de arriba (punto 3); lo que no puede irse es el aviso de que NO se guardó.
      if (!keepalive) show('No se guardó', undefined, 'bad');
    }
  }, [guardable, show]);
  useEffect(() => {
    const json = JSON.stringify(tablero);
    if (json === ultimoGuardado.current) return;
    pendienteGuardar.current = json;
    const t = setTimeout(() => { void mandar(json); }, RESPIRO_GUARDAR_MS);
    return () => clearTimeout(t);
  }, [tablero, mandar]);
  useEffect(() => {
    const flush = () => { if (pendienteGuardar.current) void mandar(pendienteGuardar.current, true); };
    const alOcultar = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => { document.removeEventListener('visibilitychange', alOcultar); flush(); };
  }, [mandar]);

  // ── Las hojas ─────────────────────────────────────────────────────────────────────────────────
  const irAHoja = useCallback((id: string) => {
    setHojaId(id);
    setSelId(null);
    setDetalle(null);
    try {
      const qs = new URLSearchParams(window.location.search);
      qs.set('hoja', id);
      window.history.replaceState(null, '', conWs(`${window.location.pathname}?${qs.toString()}`, ws));
    } catch { /* sin history: la hoja ya cambió en pantalla, y el link copiado abre la primera */ }
  }, [ws]);
  /** Lo que devuelve «Nueva hoja» (en blanco, de una plantilla o armada por MaKo), ya saneado. */
  const crearHoja = useCallback((h: Hoja, aviso?: string) => {
    const t = tableroRef.current;
    if (t.hojas.length >= MAX_HOJAS) { show('Máximo de hojas'); return; }
    const nueva: Hoja = t.hojas.some((x) => x.id === h.id) ? { ...h, id: nuevoId() } : h;
    mutar((tt) => ({ ...tt, hojas: [...tt.hojas, nueva] }));
    setNuevaHoja(false);
    irAHoja(nueva.id);
    if (aviso) show(aviso);
  }, [mutar, irAHoja, show]);
  const duplicarHoja = (id: string) => {
    const h = tablero.hojas.find((x) => x.id === id);
    if (!h || tablero.hojas.length >= MAX_HOJAS) return;
    // TODO lo que tiene id se acuña de nuevo (la hoja, sus controles, sus componentes y los controles de
    // cada uno): con el mismo id, lo elegido mirando en una se vería en la otra.
    const copia: Hoja = {
      ...h, id: nuevoId(), nombre: `${h.nombre} (copia)`.slice(0, 40),
      controles: h.controles.map((c) => ({ ...c, id: nuevoId() })),
      componentes: h.componentes.map(conIdsNuevos),
    };
    mutar((t) => { const i = t.hojas.findIndex((x) => x.id === id); const hs = [...t.hojas]; hs.splice(i + 1, 0, copia); return { ...t, hojas: hs }; });
    irAHoja(copia.id);
  };
  const eliminarHoja = (id: string) => {
    if (tablero.hojas.length <= 1) return;
    const i = tablero.hojas.findIndex((x) => x.id === id);
    mutar((t) => ({ ...t, hojas: t.hojas.filter((x) => x.id !== id) }));
    if (id === hoja.id) irAHoja(tablero.hojas[i === 0 ? 1 : i - 1].id);
    show('Hoja eliminada', () => pila.deshacer());
  };
  const moverHoja = (id: string, delta: number) => mutar((t) => {
    const i = t.hojas.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= t.hojas.length) return t;
    const hs = [...t.hojas];
    [hs[i], hs[j]] = [hs[j], hs[i]];
    return { ...t, hojas: hs };
  });
  const renombrarHoja = (id: string, nombre: string) => mutarHoja((h) => ({ ...h, nombre: nombre.slice(0, 40) }), id);
  const cambiarCabecera = (p: Partial<Pick<Hoja, 'nombre' | 'emoji' | 'subtitulo'>>) => mutarHoja((h) => ({ ...h, ...p }));
  const cambiarTema = (p: Partial<TemaHoja>) => mutarHoja((h) => ({ ...h, tema: sanearTema({ ...h.tema, ...p }) }));

  // ── Los componentes ──────────────────────────────────────────────────────────────────────────
  const cambiar = useCallback((id: string, parche: Record<string, unknown>) => {
    mutarHoja((h) => ({ ...h, componentes: h.componentes.map((c) => (c.id === id ? sanearComponente({ ...c, ...parche }) ?? c : c)) }));
  }, [mutarHoja]);
  const aMirar = useRef<string | null>(null);
  // El id se acuña AFUERA del updater: en modo estricto React lo corre dos veces.
  const agregarComponente = (c: Componente) => {
    if (hoja.componentes.length >= MAX_COMPONENTES) { show('Máximo de componentes'); return; }
    mutarHoja((h) => ({ ...h, componentes: [...h.componentes, c] }));
    setSelId(c.id);
    aMirar.current = c.id;
  };
  // Lo que se acaba de agregar nace abajo de todo: se lleva a la vista.
  useEffect(() => {
    const id = aMirar.current;
    if (!id) return;
    aMirar.current = null;
    const t = window.setTimeout(() => document.querySelector(`[data-comp="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80);
    return () => window.clearTimeout(t);
  }, [tablero]);
  const duplicar = (c: Componente) => agregarComponente({ ...conIdsNuevos(c), y: c.y + c.h });
  const borrar = useCallback((c: Componente) => {
    mutarHoja((h) => ({ ...h, componentes: h.componentes.filter((x) => x.id !== c.id) }));
    setSelId(null);
    show(esBloque(c) ? 'Bloque eliminado' : esElemento(c) ? 'Elemento eliminado' : 'Gráfico eliminado', () => deshacer());
  }, [mutarHoja, show, deshacer]);
  const anadirFuente = (id: string) => {
    setModalDatos(false);
    agregarComponente(nuevoGrafico('tabla', hoja.componentes, id));
  };
  const fuenteParaNuevo = () => (sel && esGrafico(sel) ? sel.fuente : 'negocio');
  const restablecer = async () => {
    setMenu(null);
    const ok = await confirm('Vuelve al informe inicial de MaKo, con sus dos hojas. Puedes deshacerlo.', { title: '¿Restablecer el informe?', confirmLabel: 'Restablecer' });
    if (!ok) return;
    const ini = tableroInicial();
    mutar(() => ini);
    setVista({});
    setSelId(null);
    irAHoja(ini.hojas[0].id);
    show('Informe restablecido', () => pila.deshacer());
  };

  // ── Los controles de la hoja (la barra de arriba) y los de cada gráfico (su cabecera) ─────────
  /**
   * Lo que alguien elige MIRANDO: estado de la vista. ⚠️ No pasa por `mutar`, no se guarda y no dispara el
   * autoguardado (como en Looker). Lo que se guarda es lo que el control muestra de entrada.
   */
  const onVista = useCallback((id: string, valor: ValorControl) => {
    setVista((v) => ({ ...v, [id]: { ...v[id], ...valor } }));
  }, []);
  const agregarControl = (c: ControlVista) => {
    if (hoja.controles.length >= MAX_CONTROLES) { show('Máximo de filtros'); return; }
    // Uno por cosa (un período, un «agrupar por», uno por campo): el saneo descarta el repetido.
    mutarHoja((h) => ({ ...h, controles: sanearControles([...h.controles, c]) }));
  };
  /**
   * Cambiar lo de ENTRADA de un control olvida lo elegido mirando en él. Sin esto la tarjeta seguía
   * mostrando lo de antes, con el punto de «distinto de lo de entrada», hasta apretar «Restablecer».
   */
  const olvidarVista = (ids: string[]) => {
    if (ids.length) setVista((v) => Object.fromEntries(Object.entries(v).filter(([id]) => !ids.includes(id))));
  };
  const cambiarControl = (id: string, parche: Partial<ControlVista>) => {
    mutarHoja((h) => ({ ...h, controles: sanearControles(h.controles.map((c) => (c.id === id ? sanearControlVista({ ...c, ...parche }) ?? c : c))) }));
    olvidarVista([id]);
  };
  /** Lo que cambia el panel de propiedades; si tocó los controles del gráfico, olvida la vista de los que cambiaron. */
  const cambiarDesdePanel = (c: Componente, p: Record<string, unknown>) => {
    cambiar(c.id, p);
    if (esElemento(c) || !Array.isArray(p.controles)) return;
    const nuevos = p.controles as ControlVista[];
    const antes = new Map(c.controles.map((k) => [k.id, JSON.stringify(k)]));
    olvidarVista([
      ...nuevos.filter((k) => antes.get(k.id) !== JSON.stringify(k)).map((k) => k.id),
      ...c.controles.filter((k) => !nuevos.some((x) => x.id === k.id)).map((k) => k.id),
    ]);
  };
  const quitarControl = (id: string) => {
    mutarHoja((h) => ({ ...h, controles: h.controles.filter((c) => c.id !== id) }));
    setVista((v) => { const n = { ...v }; delete n[id]; return n; });
  };
  /** «Restablecer» de la barra: lo elegido mirando en ESTA hoja vuelve a lo de entrada. */
  const restablecerVista = () => {
    const ids = new Set([...hoja.controles.map((c) => c.id), ...hoja.componentes.flatMap((c) => (esElemento(c) ? [] : c.controles.map((k) => k.id)))]);
    setVista((v) => Object.fromEntries(Object.entries(v).filter(([id]) => !ids.has(id))));
  };

  // ── El detalle de un número (clic en una KPI, una barra, una fila) ─────────────────────────────
  const cerrarDetalle = useCallback(() => setDetalle(null), []);
  /**
   * «Filtrar la página por esto», desde el detalle: si la hoja ya tiene una lista de ese campo, se elige
   * el valor EN LA VISTA (no se guarda); si no, se agrega el control (eso sí se guarda, con `mutar`) y el
   * valor va igual a la vista: lo que se guarda es «todos».
   */
  const filtrarPor = useCallback((campo: string, valor: string) => {
    if (!campoDe(campo)) return;
    const h = tableroRef.current.hojas.find((x) => x.id === hojaId) ?? tableroRef.current.hojas[0];
    const existente = h.controles.find((c) => c.tipo === 'lista' && c.campo === campo);
    if (existente) {
      setVista((v) => ({ ...v, [existente.id]: { ...v[existente.id], valores: [valor] } }));
      setDetalle(null);
      return;
    }
    if (h.controles.length >= MAX_CONTROLES) { show('Máximo de filtros'); return; }
    const c = nuevoControlVista('lista', campo);
    if (!c) return;
    mutarHoja((hh) => ({ ...hh, controles: sanearControles([...hh.controles, c]) }), h.id);
    setVista((v) => ({ ...v, [c.id]: { valores: [valor] } }));
    setDetalle(null);
  }, [hojaId, mutarHoja, show]);

  // ── Los modales: onCerrar con identidad FIJA (AGENTS.md: si no, el foco salta en cada tecla) ──────
  const cerrarNuevaHoja = useCallback(() => setNuevaHoja(false), []);
  const cerrarAnalista = useCallback(() => setAnalista(false), []);
  const alternarAnalista = useCallback(() => setAnalista((v) => !v), []);
  const cerrarModalDatos = useCallback(() => setModalDatos(false), []);
  const loQueSeVe = useMemo(() => (analista ? loQueSeVeDe(hoja, resultados, efectivos) : []), [analista, hoja, resultados, efectivos]);

  // ── Exportar ─────────────────────────────────────────────────────────────────────────────────
  const exportarCsv = () => {
    setMenu(null);
    const { csv, salteados } = csvDeHoja({ hoja, resultados, efectivos, hoy });
    descargar(csv, nombreArchivo(hoja.nombre, hoy, 'csv'), 'text/csv;charset=utf-8');
    const n = salteados.bloques + salteados.elementos + salteados.sinDatos;
    show(n ? `CSV sin ${n} piezas` : 'CSV descargado');
  };
  /** El PDF es la impresión del navegador: primero el lienzo pasa al ancho del papel y después se imprime. */
  const exportarPdf = () => { setMenu(null); setSelId(null); setImprimiendo(true); };
  useEffect(() => {
    if (!imprimiendo) return;
    let hecho = false;
    const fin = () => { if (!hecho) { hecho = true; setImprimiendo(false); } };
    window.addEventListener('afterprint', fin);
    // El respiro deja que la grilla y los gráficos se vuelvan a medir con el ancho del papel.
    const t = window.setTimeout(() => { window.print(); fin(); }, 450);
    return () => { window.clearTimeout(t); window.removeEventListener('afterprint', fin); };
  }, [imprimiendo]);

  // ── El teclado del editor: Escape suelta, Suprimir borra (editando, fuera de un texto, sin recorrido) ──
  useEffect(() => {
    if (!editando) return;
    const k = (e: KeyboardEvent) => {
      if (enRecorrido || enUnTexto() || capaAbierta) return;
      if (e.key === 'Escape') setSelId(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); borrar(sel); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [editando, enRecorrido, capaAbierta, sel, borrar]);

  // ── La grilla ────────────────────────────────────────────────────────────────────────────────
  const layout: Layout = useMemo(
    () => hoja.componentes.map((c) => ({ i: c.id, x: c.x, y: c.y, w: c.w, h: c.h, minW: esElemento(c) ? 1 : 2, minH: esElemento(c) ? 1 : 2 })),
    [hoja.componentes],
  );
  // Arrastrar y agrandar: se apila UNA vez al empezar el gesto, no en cada píxel.
  const alEmpezarGesto = useCallback(() => apilar(tableroRef.current), [apilar]);
  const idHoja = hoja.id;
  // La grilla avisa un cambio también al MONTAR, cuando compacta lo que vino (medido el 11/10: así se
  // guardó el informe de Mauricio a las 01:59 sin que tocara nada). Mirando, no se escribe: sólo editando.
  const alMoverGrilla = useCallback((l: Layout) => {
    if (!editando) return;
    setTablero((t) => {
      let cambio = false;
      const hojas = t.hojas.map((h) => {
        if (h.id !== idHoja) return h;
        const componentes = h.componentes.map((c) => {
          const it = l.find((x) => x.i === c.id);
          if (!it || (it.x === c.x && it.y === c.y && it.w === c.w && it.h === c.h)) return c;
          cambio = true;
          return { ...c, x: it.x, y: it.y, w: it.w, h: it.h };
        });
        return cambio ? { ...h, componentes } : h;
      });
      return cambio ? { ...t, hojas } : t;
    });
  }, [idHoja, editando]);

  const angosto = mounted && width > 0 && width < ANCHO_PILA && !imprimiendo;
  // El que el recorrido señala: el primero EN PANTALLA (arriba a la izquierda), no el primero del arreglo,
  // que puede ser el último que se agregó y estar abajo de todo.
  const primerGrafico = enOrden(hoja.componentes).find(esGrafico)?.id ?? null;
  const alternarEdicion = () => { setEditando((v) => !v); setSelId(null); setMenu(null); setDetalle(null); };
  const abrirMenu = (tipo: Exclude<NonNullable<Menu>['tipo'], 'hoja'>) => (e: ReactMouseEvent<HTMLElement>) => {
    const ancla = e.currentTarget;
    setMenu((m) => (m && m.tipo === tipo ? null : { ancla, tipo }));
  };

  /** Una tarjeta de la grilla (o de la pila del celular). */
  const tarjeta = (c: Componente, enPila = false) => {
    const elegido = editando && c.id === selId;
    // La posición en la grilla del PDF (editor-css.ts): el lugar de la tarjeta, en columnas y filas.
    const base = { '--lk-col': `${c.x + 1} / span ${c.w}`, '--lk-fila': `${c.y + 1} / span ${c.h}`, ...(enPila ? { height: altoDe(c.h) } : {}) } as CSSProperties;
    const alClic = (ev: ReactMouseEvent) => { if (editando) { ev.stopPropagation(); setSelId(c.id); } };
    if (esElemento(c)) {
      return (
        <div key={c.id} data-comp={c.id} className={`lk-comp lk-comp--elemento${elegido ? ' lk-comp--sel' : ''}`} style={base} onClick={alClic}>
          <CuerpoElemento e={c} colores={colores} editando={editando} onCambiar={(p) => cambiar(c.id, p)} />
        </div>
      );
    }
    const ef = efectivos[c.id] ?? efectivoDe(c, hoja, vista, hoy);
    const chips = (
      <ChipsControles comp={c} hoja={hoja} vista={vista} efectivo={ef} hoy={hoy} editando={editando} onVista={onVista} onCambiarComp={(p) => cambiar(c.id, p)} />
    );
    if (esBloque(c)) {
      const est = datosBloque[c.id] ?? { cargando: true };
      return (
        <div key={c.id} data-comp={c.id} className={`lk-comp${elegido ? ' lk-comp--sel' : ''}`} style={base} onClick={alClic}>
          <div className="lk-comp-cab">
            <div className="lk-comp-tit">
              <span title={tituloDe(c)}>{tituloDe(c)}</span>
              {est.cargando && est.datos !== undefined && <span className="lk-mini-giro" aria-label="Actualizando" />}
            </div>
            <div className="lk-comp-acciones lk-no-arrastrar" onClick={(e) => e.stopPropagation()}>{chips}</div>
          </div>
          {c.subtitulo && <div className="lk-comp-sub" title={c.subtitulo}>{c.subtitulo}</div>}
          <CuerpoBloque b={c} estado={est} estilo={estilo} desde={ef.desde} hasta={ef.hasta} onRefrescar={refrescar} />
        </div>
      );
    }
    const est = datos[c.id] ?? { cargando: true };
    const kpi = esTarjetaNumero(c.tipo);
    // El filete y el color de una KPI salen de lo que SIGNIFICA su métrica (lo cobrado, verde; lo
    // pendiente, rojo), no de un color elegido a mano: el estilo es de la hoja.
    const filete = kpi && estilo.filete;
    const tono = filete ? colorDeTono(tonoDe(c.fuente, c.metricas[0]), hoja.tema) : null;
    const clases = ['lk-comp', kpi && 'lk-comp--kpi', kpi && estilo.kpiEtiqueta === 'mono' && 'lk-comp--mono', filete && 'lk-comp--filete', elegido && 'lk-comp--sel'].filter(Boolean).join(' ');
    return (
      <div key={c.id} data-comp={c.id} className={clases} style={{ ...base, ...(tono ? { '--lk-filete': tono } : {}) } as CSSProperties} onClick={alClic}
        data-recorrido={c.id === primerGrafico ? (editando ? 'dash-componente' : 'dash-grafico') : undefined}>
        <div className="lk-comp-cab">
          <div className="lk-comp-tit">
            <span title={tituloDe(c)}>{tituloDe(c)}</span>
            {est.cargando && est.resultado && <span className="lk-mini-giro" aria-label="Actualizando" />}
          </div>
          <div className="lk-comp-acciones lk-no-arrastrar" onClick={(e) => e.stopPropagation()}>
            {chips}
            {/* El chat de MaKo de cada gráfico (el de las tabs viejas), también mirando. Sin personas: ./exportar.ts. */}
            {est.resultado && (
              <span className="lk-mako" data-recorrido={c.id === primerGrafico ? 'dash-mako' : undefined}>
                <MakoButton chartKey={`dashboard:${hoja.id}:${c.id}`} titulo={tituloDe(c)} contexto={contextoDeGrafico(c, est.resultado, ef)} />
              </span>
            )}
          </div>
        </div>
        {!kpi && c.subtitulo && <div className="lk-comp-sub" title={c.subtitulo}>{c.subtitulo}</div>}
        <CuerpoGrafico g={c} estado={est} tema={hoja.tema} onDetalle={editando ? undefined : (s) => setDetalle({ id: c.id, sel: s })} />
      </div>
    );
  };

  const gDetalle = detalle ? hoja.componentes.find((c) => c.id === detalle.id) : undefined;

  return (
    <div className={`lk lk-app${editando ? ' lk--editando' : ''}${imprimiendo ? ' lk--imprimir' : ''}`}>
      {lecturaFallo && <div className="lk-sin-imprimir" style={{ padding: '8px 16px 0' }}><Banner tono="warn" alcance="local">No pude leer tu informe. Los cambios no se guardan.</Banner></div>}

      {/* ── La fila de arriba: el ícono, las hojas y las acciones ── */}
      <FilaHojas
        hojas={tablero.hojas} activa={hoja.id} guardable={guardable} renombrando={renombrando}
        puedeNueva={guardable && tablero.hojas.length < MAX_HOJAS}
        onIr={irAHoja}
        onMenu={(ancla, id) => setMenu({ ancla, tipo: 'hoja', hojaId: id })}
        onRenombrar={renombrarHoja}
        onFinRenombre={() => setRenombrando(null)}
        onNueva={() => setNuevaHoja(true)}
        acciones={(
          <>
            <BotonRecorrido objetivo="dash-ayuda" titulo={editando ? 'Ver la guía de edición' : 'Ver la guía del Dashboard'} onClick={editando ? recorridoEdicion.reabrir : recorrido.reabrir} />
            {/* El botón de MaKo de la casa, con el punto de «hay un análisis nuevo» (./PanelAnalista.tsx). */}
            <span className="lk-analista" data-recorrido="dash-analista">
              <BotonAnalista hojaId={hoja.id} abierto={analista} onClick={alternarAnalista} />
            </span>
            <button type="button" className="lk-pill" data-recorrido="dash-exportar" aria-haspopup="menu" aria-expanded={menu?.tipo === 'exportar'} onClick={abrirMenu('exportar')}>
              <SvgExportar /> Exportar <SvgFlecha />
            </button>
            <button type="button" className="lk-pill lk-pill--azul" data-recorrido={editando ? 'dash-ver' : 'dash-editar'} disabled={!guardable && !editando} onClick={alternarEdicion}>
              {editando ? <><SvgOjo /> Ver</> : <><SvgLapiz /> Editar</>}
            </button>
            {guardable && (
              <button type="button" className="lk-pill lk-pill--icono" aria-label="Más opciones" aria-haspopup="menu" aria-expanded={menu?.tipo === 'mas'} onClick={abrirMenu('mas')}>⋯</button>
            )}
          </>
        )}
      />

      {/* ── La barra de edición: DEBAJO de las hojas, así las hojas no se mueven al apretar Editar ── */}
      {editando && (
        <div className="lk-barra" role="toolbar" aria-label="Herramientas de la hoja">
          <button type="button" className="lk-herr lk-herr--icono" data-recorrido="dash-deshacer" onClick={pila.deshacer} disabled={!pila.puedeDeshacer} title="Deshacer (Ctrl+Z)" aria-label="Deshacer"><SvgDeshacer /></button>
          <button type="button" className="lk-herr lk-herr--icono" onClick={pila.rehacer} disabled={!pila.puedeRehacer} title="Rehacer (Ctrl+Y)" aria-label="Rehacer"><SvgDeshacer espejo /></button>
          <span className="lk-sep" />
          <button type="button" className="lk-herr" data-recorrido="dash-anadir-grafico" aria-haspopup="menu" aria-expanded={menu?.tipo === 'graficos'} onClick={abrirMenu('graficos')}>
            <SvgAgregarGrafico /> Añadir un gráfico <SvgFlecha />
          </button>
          <button type="button" className="lk-herr" data-recorrido="dash-insertar" aria-haspopup="menu" aria-expanded={menu?.tipo === 'insertar'} onClick={abrirMenu('insertar')}>
            <SvgInsertar /> Insertar <SvgFlecha />
          </button>
          <button type="button" className="lk-herr" data-recorrido="dash-datos" onClick={() => setModalDatos(true)}><SvgAgregarDatos /> Añadir datos</button>
          <span className="lk-sep" />
          <button type="button" className="lk-herr" data-recorrido="dash-estilo" aria-haspopup="dialog" aria-expanded={menu?.tipo === 'estilo'} onClick={abrirMenu('estilo')}>
            <SvgEstilo /> Estilo <SvgFlecha />
          </button>
        </div>
      )}

      {/* ── El lienzo (lo único que scrollea) y el panel de propiedades ── */}
      <div className="lk-cuerpo">
        <div className="lk-lienzo" style={varsTema} onClick={() => { if (editando) setSelId(null); }}>
          <CabeceraHoja hoja={hoja} editando={editando} periodo={periodoDeHoja(hoja, vista, hoy)} onCambiar={cambiarCabecera} />
          {/* Pegada arriba al scrollear: hija DIRECTA del que scrollea, sin nada con overflow en el medio. */}
          <div className="lk-controles" data-recorrido="dash-controles" onClick={(e) => e.stopPropagation()}>
            <BarraControles
              hoja={hoja} vista={vista} editando={editando} guardable={guardable} hoy={hoy}
              onVista={onVista} onAgregar={agregarControl} onCambiar={cambiarControl} onQuitar={quitarControl} onRestablecer={restablecerVista}
            />
          </div>
          <div className="lk-pagina" ref={containerRef}>
            {!hoja.componentes.length ? (
              <div className="lk-vacio">
                <p>Esta hoja no tiene gráficos.</p>
                {editando ? (
                  <button type="button" className="lk-pill lk-pill--azul" onClick={(e) => { e.stopPropagation(); setMenu({ ancla: e.currentTarget, tipo: 'graficos' }); }}>Añadir un gráfico</button>
                ) : (
                  <button type="button" className="lk-pill lk-pill--azul" onClick={alternarEdicion} disabled={!guardable}>Editar</button>
                )}
              </div>
            ) : angosto ? (
              // En el celular la grilla de 12 columnas no se lee: una tarjeta abajo de la otra, en el orden
              // en que se leen. No se arrastra (no hay dónde), pero se elige y se edita igual.
              <div className="lk-pila">{enOrden(hoja.componentes).map((c) => tarjeta(c, true))}</div>
            ) : mounted && (
              // ⚠️ `absoluteStrategy` (top/left) y NO el transform de siempre: un ancestro con `transform`
              // vuelve a un `position: fixed` relativo a ÉL. El modal del chat de MaKo (MakoButton), el
              // toast de «Marcar cobrada» y los menús que no van en portal se dibujaban ADENTRO de la
              // tarjeta, recortados por su overflow.
              <ReactGridLayout
                positionStrategy={absoluteStrategy}
                width={width}
                layout={layout}
                gridConfig={{ cols: COLS, rowHeight: FILA, margin: [MARGEN, MARGEN], containerPadding: [0, 0] }}
                dragConfig={{ enabled: editando, cancel: '.lk-no-arrastrar' }}
                resizeConfig={{ enabled: editando, handles: ['se', 'e', 's'] }}
                compactor={verticalCompactor}
                onDragStart={alEmpezarGesto}
                onResizeStart={alEmpezarGesto}
                onLayoutChange={alMoverGrilla}
              >
                {hoja.componentes.map((c) => tarjeta(c))}
              </ReactGridLayout>
            )}
          </div>
        </div>

        {sel && (
          <aside className="lk-props" aria-label="Propiedades" onClick={(e) => e.stopPropagation()}>
            {esGrafico(sel) ? (
              <PropsGrafico key={sel.id} g={sel} hoja={hoja} hoy={hoy} onCambiar={(p) => cambiarDesdePanel(sel, p)}
                onCambiarTipo={(el) => setMenu({ ancla: el, tipo: 'cambiarTipo' })} onDuplicar={() => duplicar(sel)} onBorrar={() => borrar(sel)} onCerrar={() => setSelId(null)} />
            ) : esBloque(sel) ? (
              <PropsBloque key={sel.id} b={sel} hoja={hoja} hoy={hoy} onCambiar={(p) => cambiarDesdePanel(sel, p)}
                onDuplicar={() => duplicar(sel)} onBorrar={() => borrar(sel)} onCerrar={() => setSelId(null)} />
            ) : (
              <PropsElemento key={sel.id} e={sel} colores={colores} onCambiar={(p) => cambiar(sel.id, p)} onDuplicar={() => duplicar(sel)} onBorrar={() => borrar(sel)} />
            )}
          </aside>
        )}

        {/* El AI Analyst es un panel del costado (un `aside` de alto completo), no un modal: va en esta
            fila, al lado del lienzo. Con la vista: el análisis a mano mira lo que la persona eligió. */}
        {analista && <PanelAnalista hoja={hoja} loQueSeVe={loQueSeVe} vista={vista} onCerrar={cerrarAnalista} />}
      </div>

      {/* ── Los menús de la fila de arriba y de la barra ── */}
      {menu?.tipo === 'graficos' || menu?.tipo === 'cambiarTipo' ? (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={372}>
          <Galeria
            actual={menu.tipo === 'cambiarTipo' && sel && esGrafico(sel) ? sel.tipo : undefined}
            onElegir={(tipo) => {
              const m = menu;
              setMenu(null);
              if (m.tipo === 'cambiarTipo' && sel && esGrafico(sel)) cambiar(sel.id, { tipo });
              else agregarComponente(nuevoGrafico(tipo, hoja.componentes, fuenteParaNuevo()));
            }}
            onBloque={menu.tipo === 'graficos' ? (b: BloqueId) => { setMenu(null); agregarComponente(nuevoBloque(b, hoja.componentes)); } : undefined}
          />
        </Flotante>
      ) : null}
      {menu?.tipo === 'insertar' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={220}>
          <MenuInsertar onElegir={(t: TipoElemento) => { setMenu(null); agregarComponente(nuevoElemento(t, hoja.componentes)); }} />
        </Flotante>
      )}
      {menu?.tipo === 'estilo' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={340}>
          <PanelEstilo tema={hoja.tema} onCambiar={cambiarTema} />
        </Flotante>
      )}
      {menu?.tipo === 'exportar' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={220}>
          <div className="lk-lista" role="menu">
            <button type="button" role="menuitem" className="lk-opcion" onClick={exportarCsv}><IconoMenu nombre="descargar" size={17} /> <span>Datos (CSV)</span></button>
            <button type="button" role="menuitem" className="lk-opcion" onClick={exportarPdf}><IconoMenu nombre="archivo" size={17} /> <span>PDF</span></button>
          </div>
        </Flotante>
      )}
      {menu?.tipo === 'mas' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={240}>
          <div className="lk-lista" role="menu">
            <button type="button" role="menuitem" className="lk-opcion" onClick={() => { void restablecer(); }}><IconoMenu nombre="restaurar" size={17} /> <span>Restablecer el informe</span></button>
          </div>
        </Flotante>
      )}
      {menu?.tipo === 'hoja' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={230}>
          <div className="lk-lista" role="menu">
            {(() => {
              const id = menu.hojaId;
              const i = tablero.hojas.findIndex((h) => h.id === id);
              const op = (texto: string, icono: NombreIconoMenu, fn: () => void, deshabilitada = false, peligro = false) => (
                <button type="button" role="menuitem" className={`lk-opcion${peligro ? ' lk-opcion--peligro' : ''}`} disabled={deshabilitada || !guardable}
                  onClick={() => { setMenu(null); fn(); }}>
                  <IconoMenu nombre={icono} size={17} /> <span>{texto}</span>
                </button>
              );
              return (
                <>
                  {op('Renombrar', 'renombrar', () => setRenombrando(id))}
                  {op('Duplicar', 'duplicar', () => duplicarHoja(id), tablero.hojas.length >= MAX_HOJAS)}
                  {op('Mover a la izquierda', 'mover', () => moverHoja(id, -1), i <= 0)}
                  {op('Mover a la derecha', 'mover', () => moverHoja(id, 1), i >= tablero.hojas.length - 1)}
                  <div className="lk-sep-h" />
                  {op('Eliminar', 'borrar', () => eliminarHoja(id), tablero.hojas.length <= 1, true)}
                </>
              );
            })()}
          </div>
        </Flotante>
      )}

      {/* ── Los modales ── */}
      {modalDatos && <ModalDatos onElegir={anadirFuente} onCerrar={cerrarModalDatos} />}
      {nuevaHoja && <NuevaHoja onCerrar={cerrarNuevaHoja} onCrear={crearHoja} enBlanco={`Página ${tablero.hojas.length + 1}`} />}
      {gDetalle && esGrafico(gDetalle) && detalle && (
        <DetalleModal g={gDetalle} hoja={hoja} efectivo={efectivos[gDetalle.id] ?? efectivoDe(gDetalle, hoja, vista, hoy)} sel={detalle.sel} tema={hoja.tema}
          onCerrar={cerrarDetalle} onCambio={refrescar} onFiltrar={filtrarPor} />
      )}
      {confirmNode}

      <Recorrido id={RECORRIDO_DASHBOARD} pasos={PASOS_DASHBOARD} abierto={recorrido.abierto} onCerrar={recorrido.onCerrar} />
      <Recorrido id={RECORRIDO_DASHBOARD_EDICION} pasos={PASOS_DASHBOARD_EDICION} abierto={recorridoEdicion.abierto} onCerrar={recorridoEdicion.onCerrar} />
      <Toast state={toast} onClose={clear} />
      <style>{CSS}</style>
    </div>
  );
}

// ── «Añadir datos»: más simple que Looker, porque la fuente es una sola, MaKo ─────────────────
// Con el `Modal` de la casa (entra en la pila de modales: queda arriba del recorrido y el Escape cierra
// sólo esto). El foco va al buscador con `useFocoInicial`: `autoFocus` adentro de un Modal no llega.

function ModalDatos({ onElegir, onCerrar }: { onElegir: (id: string) => void; onCerrar: () => void }) {
  const [q, setQ] = useState('');
  useFocoInicial('lk-buscar-datos');
  const filtro = norm(q.trim());
  return (
    <Modal titulo="Añadir datos de MaKo" onCerrar={onCerrar} ancho={640}>
      <div className="lk">
        <div className="lk-buscar lk-buscar--modal"><SvgLupa /><input id="lk-buscar-datos" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar datos" /></div>
        {AREAS.map((area) => {
          const fs = FUENTES.filter((f) => f.area === area && (!filtro || norm(`${f.nombre} ${f.descripcion} ${area}`).includes(filtro)));
          if (!fs.length) return null;
          return (
            <div key={area}>
              <div className="lk-darea-tit">{area}</div>
              {fs.map((f) => (
                <button key={f.id} type="button" className="lk-dato" onClick={() => onElegir(f.id)}>
                  <span className="lk-fuente-ico"><IconoMenu nombre="grafico" size={14} /></span>
                  <span className="lk-dato-txt"><span className="lk-dato-nom">{f.nombre}</span><span className="lk-dato-desc">{f.descripcion}</span></span>
                  <span className="lk-dato-mas">Añadir</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
