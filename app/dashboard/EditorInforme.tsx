'use client';

// =============================================================================
// EditorInforme — la tab Dashboard ENTERA: un editor de informes estilo Looker Studio con los gráficos de MaKo
// =============================================================================
// Pedidos de Martín (10-11/10/2026): «Puedes copiar la app de Google Data Studio para esto», «Todo la tab
// de Dashboard debe ser el editable, no lo pongas como un recuadro abajo», y el feedback de veinticuatro
// puntos del 11/10 (el texto literal está en app/admin/dev/dashboard/bitacora.ts) y la tanda de la TOPBAR
// del mismo día (nueve puntos: «La topbar se tiene que ver igual a la de looker»). Cómo quedó, de arriba
// abajo:
//
//   · LA TOPBAR (./Cabecera.tsx, `BarraSuperior`), como la de Looker: el emoji, el TÍTULO de la hoja con
//     su ▾ (el desplegable de las hojas, con «Nueva hoja» primera) y debajo el SUBTÍTULO, donde Looker
//     pone «Archivo · Vista · Página · Ayuda»; los tres se editan con un clic, también mirando. A la
//     derecha: los FILTROS de la hoja (./BarraControles.tsx, siempre a la vista; agregarlos o quitarlos,
//     sólo editando), Compartir (./CompartirInforme.tsx, del paquete «Compartir»), Editar/Ver y el ⋮ con
//     AI Analyst, Exportar (CSV y PDF) y la guía. Sin pestañas, sin el ícono de la tab, sin «Restablecer
//     el informe» y sin «Guardado»: un guardado que falla avisa con un toast.
//   · LA BARRA DE EDICIÓN, sólo editando, DEBAJO de la topbar (la topbar no se mueve al apretar Editar),
//     en el orden de la de Looker: deshacer, rehacer · Añadir datos · Añadir un gráfico (con los bloques
//     de MaKo) · lo que se inserta, un ícono por cosa (`BARRA_INSERTAR`, ./Galeria.tsx) · y a la derecha
//     Estilo de la hoja (./PanelEstilo.tsx).
//   · EL LIENZO, que es lo único que scrollea: la grilla. Una sola superficie: var(--bg) de punta a punta
//     (./editor-css.ts), sin filete entre la topbar y el lienzo.
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
//
// DESDE EL 11/10/2026 (Closing, Ads y Landing Analyst se retiraron y traen acá con `?hoja=`):
//   · `hojaAgregada`: la plantilla que pidió el link y no estaba (`hojaDestino`, lib/graficos-plantillas.ts).
//     Entra en el informe del PRIMER render —así no hay un parpadeo de la primera hoja— y como
//     `ultimoGuardado` sigue siendo el informe que vino, el autoguardado la escribe: la persona fue a
//     buscarla. No se apila en el deshacer: no es un cambio suyo.
//   · `soloLectura` (el closer, decisión 6 de Martín): sin Editar, sin Nueva hoja, sin menú de hoja, sin
//     AI Analyst ni el chat de MaKo de cada gráfico, sin el detalle de un número y sin guardar nunca;
//     Exportar sí. ⚠️ La pantalla sólo esconde: lo que cierra es /api/graficos (`closerPuedePedir`).
//   · `llamadaInicial` (`?llamada=`): abre la ficha de esa llamada (./bloques/extra/FichaLlamada.tsx);
//     al cerrarla se saca de la URL con el mismo replaceState que usa la hoja.
//
// `compartido` (punto 9, el link que arma el paquete «Compartir»): quien lo abre NO tiene sesión. Sin
// Editar, sin Compartir, sin AI Analyst, sin «Nueva hoja» ni el menú de una hoja, sin el chat de MaKo de
// cada gráfico, sin el DETALLE de un número (son listas de personas: el endpoint público lo contesta 403,
// así que el clic no lo ofrece), sin guía y sin guardar nunca; el ⋮ sólo con Exportar. Y TODO lo que se
// LEE va a /api/compartido/graficos con el token, el id de la hoja y el de cada componente
// (`pedidoDeLectura`, ./lectura-compartida.ts, que es el contrato con ese endpoint). Igual que con el
// closer: la pantalla sólo esconde; lo que cierra es el endpoint.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Layout } from 'react-grid-layout';
import { absoluteStrategy } from 'react-grid-layout/core';
import 'react-grid-layout/css/styles.css';
import { Banner, Modal, Toast, useToast } from '@/app/_ui';
import { useWs } from '@/app/_ui/Link';
import { usePilaDeshacer } from '@/app/_ui/usePilaDeshacer';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Recorrido, useRecorrido } from '@/app/_ui/Recorrido';
import { EmojiPicker } from '@/app/whatsapp/EmojiPicker';
import { useHojasDeFuentes } from '@/app/_cursos/SelectorFuente';
import { useFocoInicial } from '@/app/customer-success/curso/dialogo-foco';
import { conWs } from '@/lib/ws-tab';
import {
  AREAS, COLS, FUENTES, MAX_COMPONENTES, MAX_CONTROLES, MAX_HOJAS, TIPOS_ELEMENTO,
  campoDe, efectivoDe, esBloque, esElemento, esGrafico, minimoDeElemento, nuevoBloque, nuevoControlVista, nuevoElemento, nuevoGrafico, nuevoId,
  sanearComponente, sanearControlVista, sanearControles, tituloDe, tonoDe,
  type BloqueId, type Componente, type ControlVista, type Efectivo, type Hoja, type Tablero, type TipoElemento, type ValorControl, type VistaValores,
} from '@/lib/graficos-catalogo';
import { colorDeTono, estiloEfectivo, letrasDe, paletaDe, sanearTema, varsDeTema, type TemaHoja } from '@/lib/graficos-temas';
import { conHojaAgregada } from '@/lib/graficos-plantillas';
import type { Resultado } from '@/lib/graficos-agregar';
import type { DatosGrafico } from '@/lib/graficos-datos';
import type { DatosBloque } from '@/lib/graficos-bloques';
import type { SelDetalle } from '@/lib/graficos-acciones';
import { CuerpoGrafico, esTarjetaNumero, type EstadoDatos } from './Grafico';
import { CuerpoBloque, type EstadoBloque } from './bloques/CuerpoBloque';
import { CuerpoElemento, IconoElemento, PropsElemento } from './Elemento';
import { NuevaHoja } from './NuevaHoja';
import { ChatMakoGrafico, LogoMako, PanelAnalista, PuntoNuevo, useAnalisisNuevo } from './PanelAnalista';
import { BarraControles, ChipsControles } from './BarraControles';
import { DetalleModal } from './Detalle';
import { FichaLlamada } from './bloques/extra/FichaLlamada';
import { BarraSuperior, MenuHojas } from './Cabecera';
import { BotonCompartir } from './CompartirInforme';
import { PropsBloque, PropsGrafico } from './Propiedades';
import { PanelEstilo } from './PanelEstilo';
import {
  BARRA_INSERTAR, Flotante, Galeria, MenuElementos, MenuInsertar, SvgAgregarDatos, SvgAgregarGrafico, SvgDeshacer, SvgEstilo, SvgFlecha, SvgInsertar, SvgLapiz, SvgLupa, SvgOjo,
} from './Galeria';
import { CSS } from './editor-css';
import { contextoDeGrafico, csvDeHoja, enOrden, loQueSeVeDe, nombreArchivo, pedidosDeHoja, periodoDeHoja, type PedidosHoja } from './exportar';
import { pedidoDeLectura, type Compartido } from './lectura-compartida';
import { PASOS_DASHBOARD, PASOS_DASHBOARD_EDICION, RECORRIDO_DASHBOARD, RECORRIDO_DASHBOARD_EDICION } from './recorridos-dashboard';

/** La grilla: 12 columnas, filas de 30 px y 16 px entre tarjetas. ⚠️ El PDF (editor-css.ts) repite estos números. */
const FILA = 30;
const MARGEN = 16;
/** Por debajo de este ancho, la grilla de 12 columnas no se lee: las tarjetas van una abajo de la otra. */
const ANCHO_PILA = 640;
/**
 * Lo más chico que se puede achicar una tarjeta. El de un elemento sale del catálogo (`minimoDeElemento`,
 * TIPOS_ELEMENTO): un video o una página insertada más chicos que 3 × 4 no se ven ni se tocan.
 */
const minimoDe = (c: Componente): { w: number; h: number } => (esElemento(c) ? minimoDeElemento(c.tipo) : { w: 2, h: 2 });
/** Cuánto espera el respiro del autoguardado y el de los pedidos de datos. */
const RESPIRO_GUARDAR_MS = 700;
const RESPIRO_DATOS_MS = 250;

/** Los flotantes del editor: uno a la vez. `hojas` es el desplegable del título; `mas`, el ⋮ de la topbar. */
type Menu =
  | { ancla: HTMLElement; tipo: 'graficos' | 'cambiarTipo' | 'insertar' | 'lineas' | 'formas' | 'estilo' | 'mas' | 'hojas' | 'emoji' }
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
/** El `title` de un ícono suelto de la barra de inserción: la acción y su objeto («Insertar imagen»). */
const etiquetaInsertar = (t: TipoElemento) => (t === 'insertado' ? 'Insertar una página o un código' : `Insertar ${(TIPOS_ELEMENTO.find((x) => x.id === t)?.nombre ?? t).toLowerCase()}`);
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

export function EditorInforme({
  inicial, datosIniciales, bloquesIniciales, lecturaFallo, hoy, hojaInicial,
  hojaAgregada = null, aviso = null, soloLectura = false, llamadaInicial = null, compartido = null,
}: {
  inicial: Tablero;
  datosIniciales: Record<string, DatosGrafico>;
  bloquesIniciales: Record<string, DatosBloque>;
  lecturaFallo: boolean;
  hoy: string;
  hojaInicial: string;
  /** La plantilla que pidió `?hoja=` y no estaba: se suma al informe y se guarda. */
  hojaAgregada?: Hoja | null;
  /** Un aviso para mostrar al abrir (el link pidió una hoja y el informe ya no tiene lugar). */
  aviso?: string | null;
  /** El closer: mira la hoja Closing, exporta, y nada más. */
  soloLectura?: boolean;
  /** `?llamada=`: el recording_id de la llamada cuya ficha se abre al entrar. */
  llamadaInicial?: number | null;
  /** El link compartido (sin sesión): se mira y se exporta; lo que se lee va por la ruta del link. */
  compartido?: Compartido | null;
}) {
  // El informe del primer render: el que vino, más la hoja que pidió el link si no estaba.
  const [arranque] = useState<Tablero>(() => conHojaAgregada(inicial, hojaAgregada));
  const [tablero, setTablero] = useState<Tablero>(arranque);
  const tableroRef = useRef(tablero);
  tableroRef.current = tablero;
  const [hojaId, setHojaId] = useState(hojaInicial);
  const [llamada, setLlamada] = useState<number | null>(llamadaInicial);
  const [editando, setEditando] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [modalDatos, setModalDatos] = useState(false);
  const [nuevaHoja, setNuevaHoja] = useState(false);
  const [analista, setAnalista] = useState(false);
  const [detalle, setDetalle] = useState<{ id: string; sel: SelDetalle } | null>(null);
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
  const { width, containerRef, mounted } = useContainerWidth();
  const ws = useWs();
  // Mirando sin poder guardar: la lectura falló (el primer cambio pisaría el informe real), es el closer o
  // es un link compartido.
  const guardable = !lecturaFallo && !soloLectura && !compartido;
  // Sólo mirar, sin nada de lo que es del admin (Editar, AI Analyst, el chat de MaKo, el detalle de un número).
  const soloMirar = soloLectura || !!compartido;

  const hoja = tablero.hojas.find((h) => h.id === hojaId) ?? tablero.hojas[0];
  const sel = editando ? hoja.componentes.find((c) => c.id === selId) ?? null : null;

  // ── El recorrido: uno para mirar y otro para editar (el «?» abre el del lugar) ─────────────────
  // No se abre solo con un menú o un modal abierto: los flotantes del editor van por encima del velo.
  const capaAbierta = !!menu || modalDatos || nuevaHoja || analista || !!detalle || llamada != null;
  // En un link compartido no hay guía: quien entra no tiene sesión (`soloLocal`: no le pregunta nada al
  // server) y el ⋮ es sólo Exportar.
  const conGuia = !compartido;
  const recorrido = useRecorrido(RECORRIDO_DASHBOARD, { autoabrir: conGuia && !editando && !capaAbierta, soloLocal: !conGuia });
  const recorridoEdicion = useRecorrido(RECORRIDO_DASHBOARD_EDICION, { autoabrir: conGuia && editando && !recorrido.abierto && !capaAbierta, soloLocal: !conGuia });
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
    // con la MISMA función que usó page.tsx (y sobre el MISMO informe: el que incluye la hoja agregada).
    const h0 = arranque.hojas.find((h) => h.id === hojaInicial) ?? arranque.hojas[0];
    const p0 = pedidosDeHoja(h0, {}, hoy, 0);
    const f: Record<string, string> = {};
    for (const x of p0.graficos) if (datosIniciales[x.g.id]) f[x.g.id] = x.firma;
    for (const x of p0.bloques) if (bloquesIniciales[x.b.id]) f[x.b.id] = x.firma;
    firmaPedida.current = f;
  }
  // El link compartido por el que se entró (o nadie): decide a qué ruta van las LECTURAS (./lectura-compartida.ts).
  const tokenLink = compartido?.token ?? null;
  useEffect(() => {
    const firmas = firmaPedida.current!;
    const p = pedidosDeHoja(hoja, vista, hoy, version);
    const graficos = p.graficos.filter((x) => firmas[x.g.id] !== x.firma);
    const bloques = p.bloques.filter((x) => firmas[x.b.id] !== x.firma);
    if (!graficos.length && !bloques.length) return;
    const link = tokenLink ? { token: tokenLink } : null;

    const pedirGraficos = async (lista: PedidosHoja['graficos']) => {
      setDatos((prev) => {
        const n = { ...prev };
        for (const { g } of lista) n[g.id] = { ...(n[g.id] ?? {}), cargando: true };
        return n;
      });
      let respuesta: Record<string, DatosGrafico> = {};
      let fallo = false;
      try {
        // Con sesión, /api/graficos con el cuerpo de siempre; en un link compartido, la ruta del link con
        // el token, la hoja y el id de cada gráfico.
        const { ruta, cuerpo } = pedidoDeLectura({ accion: 'datos', hojaId: hoja.id, pedidos: lista.map((x) => ({ id: x.g.id, pedido: x.pedido })) }, link);
        const r = await fetch(ruta, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(cuerpo),
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
        const { ruta, cuerpo } = pedidoDeLectura({ accion: 'bloques', hojaId: hoja.id, pedidos: lista.map((x) => ({ id: x.b.id, pedido: x.pedido })) }, link);
        const r = await fetch(ruta, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(cuerpo),
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
  }, [hoja, vista, hoy, version, tokenLink]);
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
  // Lo guardado es el informe que VINO (`inicial`), no el del primer render: si el link sumó una hoja,
  // la diferencia la escribe el autoguardado de abajo sin que nadie toque nada.
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
  /** La ficha de la llamada que abrió el link (`?llamada=`): al cerrarla, el parámetro se va de la URL. */
  const cerrarLlamada = useCallback(() => {
    setLlamada(null);
    try {
      const qs = new URLSearchParams(window.location.search);
      qs.delete('llamada');
      const q = qs.toString();
      window.history.replaceState(null, '', conWs(`${window.location.pathname}${q ? `?${q}` : ''}`, ws));
    } catch { /* sin history: la ficha ya se cerró, y recargar la vuelve a abrir */ }
  }, [ws]);
  // Lo que pasó al abrir sin que la persona tocara nada: se dice una vez, corto.
  const avisado = useRef(false);
  useEffect(() => {
    if (avisado.current) return;
    avisado.current = true;
    if (hojaAgregada && arranque.hojas.some((h) => h.id === hojaAgregada.id) && !inicial.hojas.some((h) => h.id === hojaAgregada.id)) {
      show(`Hoja ${hojaAgregada.nombre} agregada`);
    } else if (aviso) show(aviso);
  }, [hojaAgregada, arranque, inicial, aviso, show]);
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
  // «Restablecer el informe» se fue (punto 2 de la tanda de la topbar: «eso no tiene sentido, eliminalo»).

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
  const alternarAnalista = useCallback(() => { setMenu(null); setAnalista((v) => !v); }, []);
  const cerrarModalDatos = useCallback(() => setModalDatos(false), []);
  const loQueSeVe = useMemo(() => (analista ? loQueSeVeDe(hoja, resultados, efectivos) : []), [analista, hoja, resultados, efectivos]);
  // El punto de «hay un análisis nuevo», en el ⋮ y en su opción. Al closer y a un link, nada: no tienen AI Analyst.
  const analisisNuevo = useAnalisisNuevo(hoja.id, analista, !soloMirar);

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
    () => hoja.componentes.map((c) => { const m = minimoDe(c); return { i: c.id, x: c.x, y: c.y, w: c.w, h: c.h, minW: m.w, minH: m.h }; }),
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
  const puedeNuevaHoja = guardable && tablero.hojas.length < MAX_HOJAS;
  /** Un elemento de la barra de inserción (o de su menú), agregado a la hoja. */
  const insertar = (t: TipoElemento) => { setMenu(null); agregarComponente(nuevoElemento(t, hoja.componentes)); };
  /** Abre (o cierra, si ya estaba abierto) un flotante anclado a `ancla`. */
  const alternarMenu = (tipo: NonNullable<Menu>['tipo'], ancla: HTMLElement) => setMenu((m) => (m && m.tipo === tipo ? null : { ancla, tipo }));
  const abrirMenu = (tipo: NonNullable<Menu>['tipo']) => (e: ReactMouseEvent<HTMLElement>) => {
    const ancla = e.currentTarget;
    alternarMenu(tipo, ancla);
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
      <ChipsControles comp={c} hoja={hoja} vista={vista} efectivo={ef} hoy={hoy} editando={editando} onVista={onVista} onCambiarComp={(p) => cambiar(c.id, p)} compartido={compartido} />
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
            {/* El chat de MaKo de cada gráfico (el de las tabs viejas), también mirando, con el botón CHICO (sólo
                el logo sobre negro, punto 3). Sin personas: ./exportar.ts. Al closer y a un link no: su tab de
                antes no lo tenía, es IA que gasta en una vista de sólo lectura, y sin sesión no hay chat. */}
            {est.resultado && !soloMirar && (
              <span className="lk-mako" data-recorrido={c.id === primerGrafico ? 'dash-mako' : undefined}>
                <ChatMakoGrafico chartKey={`dashboard:${hoja.id}:${c.id}`} titulo={tituloDe(c)} contexto={contextoDeGrafico(c, est.resultado, ef)} />
              </span>
            )}
          </div>
        </div>
        {!kpi && c.subtitulo && <div className="lk-comp-sub" title={c.subtitulo}>{c.subtitulo}</div>}
        {/* El detalle de un número pide `detalle` a /api/graficos: al closer le contesta 403, y en un link
            compartido no se ofrece (son listas de personas; el endpoint del link también lo contesta 403).
            Sin `onDetalle`, el clic en un número no hace nada y no se pinta como clicable. */}
        <CuerpoGrafico g={c} estado={est} tema={hoja.tema} onDetalle={editando || soloMirar ? undefined : (s) => setDetalle({ id: c.id, sel: s })} />
      </div>
    );
  };

  const gDetalle = detalle ? hoja.componentes.find((c) => c.id === detalle.id) : undefined;

  return (
    <div className={`lk lk-app${editando ? ' lk--editando' : ''}${imprimiendo ? ' lk--imprimir' : ''}`}>
      {lecturaFallo && <div className="lk-sin-imprimir" style={{ padding: '8px 16px 0' }}><Banner tono="warn" alcance="local">No pude leer tu informe. Los cambios no se guardan.</Banner></div>}

      {/* ── La topbar, como la de Looker: el título de la hoja (con su desplegable) y a la derecha los
             filtros, Compartir, Editar y el ⋮ ── */}
      <BarraSuperior
        hoja={hoja} editable={guardable} conHojas={puedeNuevaHoja || tablero.hojas.length > 1}
        hojasAbierto={menu?.tipo === 'hojas'} emojiAbierto={menu?.tipo === 'emoji'} periodo={periodoDeHoja(hoja, vista, hoy)}
        onHojas={(ancla) => alternarMenu('hojas', ancla)} onEmoji={(ancla) => alternarMenu('emoji', ancla)} onCambiar={cambiarCabecera}
        derecha={(
          <>
            {/* Los filtros de la hoja, SIEMPRE a la vista (punto 7); agregarlos y quitarlos, sólo editando. */}
            <div className="lk-top-filtros" data-recorrido="dash-controles">
              <BarraControles
                hoja={hoja} vista={vista} editando={editando} guardable={guardable} hoy={hoy} compartido={compartido}
                onVista={onVista} onAgregar={agregarControl} onCambiar={cambiarControl} onQuitar={quitarControl} onRestablecer={restablecerVista}
              />
            </div>
            {/* Compartir (punto 9): lo implementa el paquete «Compartir» con esta misma firma. Sólo quien puede
                guardar comparte: el closer no, y desde un link no se re-comparte. */}
            {guardable && <BotonCompartir hojaId={hoja.id} titulo={hoja.nombre} />}
            {!soloMirar && (
              <button type="button" className="lk-pill" data-recorrido={editando ? 'dash-ver' : 'dash-editar'} disabled={!guardable && !editando} onClick={alternarEdicion}>
                {editando ? <><SvgOjo /> Ver</> : <><SvgLapiz /> Editar</>}
              </button>
            )}
            {/* El ⋮ (punto 4): el AI Analyst, Exportar y la guía. «Restablecer el informe» se fue (punto 2). */}
            <button type="button" className="lk-pill lk-pill--icono lk-mas" data-recorrido="dash-ayuda" aria-label={analisisNuevo ? 'Más opciones: hay un análisis nuevo' : 'Más opciones'}
              title="Más opciones" aria-haspopup="menu" aria-expanded={menu?.tipo === 'mas'} onClick={abrirMenu('mas')}>
              <span aria-hidden>⋮</span>
              {analisisNuevo && <PuntoNuevo />}
            </button>
          </>
        )}
      />

      {/* ── La barra de edición: DEBAJO de la topbar (la topbar no se mueve al apretar Editar), en el orden
             de la de Looker. Agregar un filtro está en la topbar, al lado de los filtros (sólo editando). ── */}
      {editando && (
        <div className="lk-barra" role="toolbar" aria-label="Herramientas de la hoja">
          <button type="button" className="lk-herr lk-herr--icono" data-recorrido="dash-deshacer" onClick={pila.deshacer} disabled={!pila.puedeDeshacer} title="Deshacer (Ctrl+Z)" aria-label="Deshacer"><SvgDeshacer /></button>
          <button type="button" className="lk-herr lk-herr--icono" onClick={pila.rehacer} disabled={!pila.puedeRehacer} title="Rehacer (Ctrl+Y)" aria-label="Rehacer"><SvgDeshacer espejo /></button>
          <span className="lk-sep" />
          <button type="button" className="lk-herr" data-recorrido="dash-datos" onClick={() => setModalDatos(true)}><SvgAgregarDatos /> Añadir datos</button>
          <span className="lk-sep" />
          <button type="button" className="lk-herr" data-recorrido="dash-anadir-grafico" aria-haspopup="menu" aria-expanded={menu?.tipo === 'graficos'} onClick={abrirMenu('graficos')}>
            <SvgAgregarGrafico /> Añadir un gráfico <SvgFlecha />
          </button>
          <span className="lk-sep" />
          {/* Lo que se inserta, un ícono por cosa y en el orden de Looker (código, imagen, texto, línea,
              formas: `BARRA_INSERTAR`). En el celular no entran: un solo «Insertar ▾» con los nueve. */}
          <div className="lk-insertar" role="group" aria-label="Insertar" data-recorrido="dash-insertar">
            <span className="lk-ins-sueltos">
              {BARRA_INSERTAR.map((l) => (l.clase === 'suelto' ? (
                <button key={l.tipo} type="button" className="lk-herr lk-herr--icono" title={etiquetaInsertar(l.tipo)} aria-label={etiquetaInsertar(l.tipo)}
                  onClick={() => insertar(l.tipo)}>
                  <IconoElemento tipo={l.tipo} size={19} />
                </button>
              ) : (
                <button key={l.menu} type="button" className="lk-herr lk-herr--menu" title={l.nombre} aria-label={l.nombre} aria-haspopup="menu"
                  aria-expanded={menu?.tipo === l.menu} onClick={abrirMenu(l.menu)}>
                  <IconoElemento tipo={l.tipos[0]} size={19} /> <SvgFlecha />
                </button>
              )))}
            </span>
            <button type="button" className="lk-herr lk-ins-menu" aria-haspopup="menu" aria-expanded={menu?.tipo === 'insertar'} onClick={abrirMenu('insertar')}>
              <SvgInsertar /> Insertar <SvgFlecha />
            </button>
          </div>
          <button type="button" className="lk-herr lk-herr--fin" data-recorrido="dash-estilo" aria-haspopup="dialog" aria-expanded={menu?.tipo === 'estilo'} onClick={abrirMenu('estilo')}>
            <SvgEstilo /> Estilo de la hoja <SvgFlecha />
          </button>
        </div>
      )}

      {/* ── El lienzo (lo único que scrollea) y el panel de propiedades ── */}
      <div className="lk-cuerpo">
        <div className="lk-lienzo" style={varsTema} onClick={() => { if (editando) setSelId(null); }}>
          <div className="lk-pagina" ref={containerRef}>
            {!hoja.componentes.length ? (
              <div className="lk-vacio">
                <p>Esta hoja no tiene gráficos.</p>
                {editando ? (
                  <button type="button" className="lk-pill lk-pill--azul" onClick={(e) => { e.stopPropagation(); setMenu({ ancla: e.currentTarget, tipo: 'graficos' }); }}>Añadir un gráfico</button>
                ) : !soloMirar && (
                  <button type="button" className="lk-pill lk-pill--azul" onClick={alternarEdicion} disabled={!guardable}>Editar</button>
                )}
              </div>
            ) : angosto ? (
              // En el celular la grilla de 12 columnas no se lee: una tarjeta abajo de la otra, en el orden
              // en que se leen. No se arrastra (no hay dónde), pero se elige y se edita igual.
              <div className="lk-pila">{enOrden(hoja.componentes).map((c) => tarjeta(c, true))}</div>
            ) : mounted && (
              // ⚠️ `absoluteStrategy` (top/left) y NO el transform de siempre: un ancestro con `transform`
              // vuelve a un `position: fixed` relativo a ÉL. El modal del chat de MaKo (antes MakoButton), el
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
          <MenuInsertar onElegir={insertar} />
        </Flotante>
      )}
      {(menu?.tipo === 'lineas' || menu?.tipo === 'formas') && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={200}>
          <MenuElementos tipos={BARRA_INSERTAR.flatMap((l) => (l.clase === 'menu' && l.menu === menu.tipo ? l.tipos : []))} onElegir={insertar} />
        </Flotante>
      )}
      {menu?.tipo === 'estilo' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={340}>
          <PanelEstilo tema={hoja.tema} onCambiar={cambiarTema} />
        </Flotante>
      )}
      {/* El ⋮: AI Analyst (no al closer ni a un link), Exportar y la guía (no en un link). */}
      {menu?.tipo === 'mas' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={240}>
          <div className="lk-lista" role="menu">
            {!soloMirar && (
              <>
                <button type="button" role="menuitem" className="lk-opcion lk-opcion--mako" data-abierto={analista || undefined} onClick={alternarAnalista}
                  title="MaKo analiza los gráficos de esta hoja">
                  <LogoMako lado={22} /> <span>AI Analyst</span>
                  {analisisNuevo && <PuntoNuevo enMenu />}
                </button>
                <div className="lk-sep-h" />
              </>
            )}
            <div className="lk-lista-grupo">Exportar</div>
            <button type="button" role="menuitem" className="lk-opcion" onClick={exportarCsv}><IconoMenu nombre="descargar" size={17} /> <span>Datos (CSV)</span></button>
            <button type="button" role="menuitem" className="lk-opcion" onClick={exportarPdf}><IconoMenu nombre="archivo" size={17} /> <span>PDF</span></button>
            {conGuia && (
              <>
                <div className="lk-sep-h" />
                <button type="button" role="menuitem" className="lk-opcion" onClick={() => { setMenu(null); (editando ? recorridoEdicion.reabrir : recorrido.reabrir)(); }}>
                  <IconoMenu nombre="pregunta" size={17} /> <span>{editando ? 'Guía de edición' : 'Guía del Dashboard'}</span>
                </button>
              </>
            )}
          </div>
        </Flotante>
      )}
      {/* El desplegable del título: «Nueva hoja» primera, y las hojas (punto 1). */}
      {menu?.tipo === 'hojas' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={300}>
          <MenuHojas
            hojas={tablero.hojas} activa={hoja.id} puedeNueva={puedeNuevaHoja}
            acciones={guardable ? { onRenombrar: renombrarHoja, onDuplicar: duplicarHoja, onMover: moverHoja, onEliminar: eliminarHoja } : null}
            onIr={(id) => { setMenu(null); irAHoja(id); }}
            onNueva={() => { setMenu(null); setNuevaHoja(true); }}
          />
        </Flotante>
      )}
      {menu?.tipo === 'emoji' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={320}>
          <EmojiPicker embebido onPick={(e) => { setMenu(null); cambiarCabecera({ emoji: e }); }} onClose={() => setMenu(null)} />
        </Flotante>
      )}

      {/* ── Los modales ── */}
      {modalDatos && <ModalDatos onElegir={anadirFuente} onCerrar={cerrarModalDatos} />}
      {nuevaHoja && <NuevaHoja onCerrar={cerrarNuevaHoja} onCrear={crearHoja} enBlanco={`Página ${tablero.hojas.length + 1}`} />}
      {gDetalle && esGrafico(gDetalle) && detalle && (
        <DetalleModal g={gDetalle} hoja={hoja} efectivo={efectivos[gDetalle.id] ?? efectivoDe(gDetalle, hoja, vista, hoy)} sel={detalle.sel} tema={hoja.tema}
          onCerrar={cerrarDetalle} onCambio={refrescar} onFiltrar={filtrarPor} />
      )}
      {/* La llamada del link (`?llamada=`). Sus tareas (re-analizar, revisar) son también del closer:
          la ficha no va en sólo lectura. Después de una, los bloques se vuelven a pedir. */}
      {llamada != null && !compartido && <FichaLlamada recordingId={llamada} onCerrar={cerrarLlamada} onCambio={refrescar} />}

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
