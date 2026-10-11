'use client';

// =============================================================================
// EditorInforme — la tab Dashboard ENTERA es el editor de informes, copiado de Looker Studio
// =============================================================================
// Pedidos de Martín (10-11/10/2026), en orden:
//   · «Puedes copiar la app de Google Data Studio para esto.»
//   · «No, no se ve igual al editor de Looker, te pido que lo hagas igual.»
//   · «Elimina las tab de Marketing y Comercial… Todo la tab de Dashboard debe ser el editable,
//     no lo pongas como un recuadro abajo. Elimina la topbar, el título de la tab, el filtro de
//     fecha (que eso cada uno lo va a agregar si quiere...) Y justamente falta la opción de
//     nueva "hoja" que eso sería lo que hoy es la tab de comercial y marketing. Y faltan un
//     montón de gráficos… rediseña más simple la parte de "Agregar datos"… revisa que se pueda
//     editar el estilo de cada gráfico.»
//
// Lo que se copió de Looker, pieza por pieza: la cabecera del informe (nombre, Restablecer y
// Ver/Editar), la barra (deshacer, rehacer, Añadir página, Añadir datos, Añadir un gráfico ▾,
// Añadir un control ▾), las PÁGINAS, el lienzo gris con la página blanca, el panel de
// PROPIEDADES con CONFIGURACIÓN y ESTILO (las fichas verdes y azules, «Empecemos» cuando no hay
// nada elegido), el panel DATOS y la barra vertical para mostrarlos u ocultarlos.
//
// Lo que se hizo MÁS SIMPLE que Looker, a propósito: «Añadir datos». Looker conecta decenas de
// fuentes; acá la fuente es una, MaKo, y sus conjuntos de datos están todos a mano en el panel.
// Y lo que no se copió: filtros, campos calculados, combinar fuentes y SQL libre.
//
// ⚠️ El CSS vive limitado a `.lk` (como el de GitHub en /api-mako): son los valores de Looker.
// Guardado: solo, con un respiro, por persona y workspace (lib/graficos-tablero.ts). Si la
// lectura falló, NO se guarda nada: el primer cambio pisaría el informe real.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useRouter } from '@/app/_ui/Link';
import { Banner, Toast, useToast } from '@/app/_ui';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { usePilaDeshacer } from '@/app/_ui/usePilaDeshacer';
import {
  AREAS, FUENTES, GRUPOS, LIMITES, MAX_COMPONENTES, MAX_HOJAS, PALETA, PRESETS, TIPOS,
  desglosesPara, dimensionesPara, esControl, esGrafico, fuenteDe, metricaDe, metricasPara, nombrePreset, nuevoControl, nuevoGrafico,
  nuevoId, rangoDe, rangoDeGrafico, sanearComponente, tableroInicial, tituloDe, tipoDe,
  type Area, type Componente, type Control, type Dimension, type Estilo, type Grafico, type Hoja, type Metrica, type Preset, type Tablero,
} from '@/lib/graficos-catalogo';
import type { DatosGrafico } from '@/lib/graficos-datos';
import { CuerpoGrafico, esTarjetaNumero, type EstadoDatos } from './Grafico';

/** Lo que decide los DATOS de un gráfico, período incluido. Moverlo o pintarlo no pide nada. */
const firmaDe = (g: Grafico, rg: { desde: string; hasta: string }) =>
  [g.tipo, g.fuente, g.fecha, g.dimension ?? '', g.desglose ?? '', g.metricas.join(','), g.limite, g.ordenMetrica ?? '', g.ordenAsc, rg.desde, rg.hasta].join('|');

const ICONO_AREA: Record<Area, NombreIconoMenu> = {
  Negocio: 'dinero', Marketing: 'anuncio', 'CRM y ventas': 'persona', 'Comunicación': 'whatsapp', Automations: 'repetir',
  Plan: 'plan', 'Customer Success': 'cliente', 'Second Brain': 'archivo', Onboarding: 'check', 'IA y contenido': 'mako',
};
const COLOR_AREA: Record<Area, string> = {
  Negocio: '#1a73e8', Marketing: '#1877F2', 'CRM y ventas': '#188038', 'Comunicación': '#25A366', Automations: '#7B61FF',
  Plan: '#E37400', 'Customer Success': '#D93025', 'Second Brain': '#5F6368', Onboarding: '#12A4AF', 'IA y contenido': '#B06000',
};
const iconoFuente = (id: string) => ICONO_AREA[fuenteDe(id)?.area ?? 'Negocio'];
const colorFuente = (id: string) => COLOR_AREA[fuenteDe(id)?.area ?? 'Negocio'];

/** Un campo arrastrado desde el panel Datos. */
const MIME_CAMPO = 'application/x-mako-campo';
type Campo = { fuente: string; clase: 'dim' | 'met'; id: string };
type Zona = { 'data-soltar'?: true; onDragOver: (e: DragEvent) => void; onDragLeave: () => void; onDrop: (e: DragEvent) => void };

function aEstado(d: DatosGrafico | undefined): EstadoDatos {
  if (!d) return { cargando: true };
  return d.ok ? { cargando: false, resultado: d.resultado } : { cargando: false, error: d.error };
}
function leerCampo(e: DragEvent): Campo | null {
  try {
    const c = JSON.parse(e.dataTransfer.getData(MIME_CAMPO)) as Campo;
    return fuenteDe(c.fuente) && (c.clase === 'dim' || c.clase === 'met') ? c : null;
  } catch { return null; }
}
const traeCampo = (e: DragEvent) => e.dataTransfer.types.includes(MIME_CAMPO);
/** Si el foco está donde se tipea, las teclas son del texto, no del editor. */
function enUnTexto(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT');
}
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

type Menu = { ancla: HTMLElement; tipo: 'graficos' | 'cambiarTipo' | 'controles' | 'hoja'; hojaId?: string } | null;

export function EditorInforme({ inicial, datosIniciales, lecturaFallo, hoy, hojaInicial }: {
  inicial: Tablero;
  datosIniciales: Record<string, DatosGrafico>;
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
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [paneles, setPaneles] = useState({ props: true, datos: true });
  const [guardado, setGuardado] = useState<'ok' | 'guardando' | 'error' | null>(null);
  const [soltandoEn, setSoltandoEn] = useState<string | null>(null);
  const [datos, setDatos] = useState<Record<string, EstadoDatos>>(() => {
    const o: Record<string, EstadoDatos> = {};
    for (const [id, d] of Object.entries(datosIniciales)) o[id] = aEstado(d);
    return o;
  });
  const { toast, show, clear } = useToast(6000);
  const { width, containerRef, mounted } = useContainerWidth();
  const router = useRouter();
  const guardable = !lecturaFallo;

  const hoja = tablero.hojas.find((h) => h.id === hojaId) ?? tablero.hojas[0];
  const sel = hoja.componentes.find((c) => c.id === selId) ?? null;

  // ── Deshacer / rehacer (y Ctrl+Z / Ctrl+Y) ───────────────────────────────────────────────
  const pila = usePilaDeshacer<Tablero>((estado) => {
    const actual = tableroRef.current;
    setTablero(estado);
    return actual;
  }, { activa: editando });
  /** Todo cambio de una persona pasa por acá: así cada uno se puede deshacer. */
  const mutar = useCallback((fn: (t: Tablero) => Tablero) => {
    pila.apilar(tableroRef.current);
    setTablero((t) => fn(t));
  }, [pila]);
  const mutarHoja = useCallback((fn: (h: Hoja) => Hoja, id = hoja.id) => {
    mutar((t) => ({ ...t, hojas: t.hojas.map((h) => (h.id === id ? fn(h) : h)) }));
  }, [mutar, hoja.id]);

  // ── Datos: sólo los gráficos de la hoja a la vista, y sólo si su firma cambió ─────────────
  const firmaPedida = useRef<Record<string, string>>({});
  if (!Object.keys(firmaPedida.current).length) {
    const h0 = inicial.hojas.find((h) => h.id === hojaInicial) ?? inicial.hojas[0];
    for (const c of h0.componentes) if (esGrafico(c) && datosIniciales[c.id]) firmaPedida.current[c.id] = firmaDe(c, rangoDeGrafico(c, h0, hoy));
  }
  useEffect(() => {
    const pendientes = hoja.componentes.filter(esGrafico).map((g) => ({ g, rg: rangoDeGrafico(g, hoja, hoy) }))
      .filter(({ g, rg }) => firmaPedida.current[g.id] !== firmaDe(g, rg));
    if (!pendientes.length) return;
    const t = setTimeout(async () => {
      const firmas: Record<string, string> = {};
      for (const { g, rg } of pendientes) { firmas[g.id] = firmaDe(g, rg); firmaPedida.current[g.id] = firmas[g.id]; }
      setDatos((prev) => {
        const n = { ...prev };
        for (const { g } of pendientes) n[g.id] = { ...(n[g.id] ?? {}), cargando: true };
        return n;
      });
      let respuesta: Record<string, DatosGrafico> = {};
      let fallo = false;
      try {
        const r = await fetch('/api/graficos', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ accion: 'datos', pedidos: pendientes.map(({ g, rg }) => ({ grafico: g, ...rg })) }),
          signal: AbortSignal.timeout(65_000),
        });
        if (!r.ok) fallo = true; else respuesta = (await r.json()).datos ?? {};
      } catch { fallo = true; }
      setDatos((prev) => {
        const n = { ...prev };
        for (const { g } of pendientes) {
          // Si entre medio la persona volvió a cambiar el gráfico, esta respuesta ya es vieja.
          if (firmaPedida.current[g.id] !== firmas[g.id]) continue;
          n[g.id] = fallo ? { cargando: false, error: 'No pude leer los datos' } : aEstado(respuesta[g.id] ?? { ok: false, error: 'Sin respuesta' });
        }
        return n;
      });
    }, 250);
    return () => clearTimeout(t);
  }, [hoja, hoy]);

  // ── Guardado: solo, con un respiro, y nunca si la lectura falló ─────────────────────────
  const ultimoGuardado = useRef(JSON.stringify(inicial));
  const pendienteGuardar = useRef<string | null>(null);
  const mandar = useCallback(async (json: string, keepalive = false) => {
    if (!guardable || json === ultimoGuardado.current) return;
    setGuardado('guardando');
    try {
      const r = await fetch('/api/graficos', {
        method: 'POST', headers: { 'content-type': 'application/json' }, keepalive,
        body: `{"accion":"guardar","tablero":${json}}`,
      });
      if (!r.ok) throw new Error(String(r.status));
      ultimoGuardado.current = json;
      if (pendienteGuardar.current === json) pendienteGuardar.current = null;
      setGuardado('ok');
    } catch { setGuardado('error'); }
  }, [guardable]);
  useEffect(() => {
    const json = JSON.stringify(tablero);
    if (json === ultimoGuardado.current) return;
    pendienteGuardar.current = json;
    const t = setTimeout(() => { void mandar(json); }, 700);
    return () => clearTimeout(t);
  }, [tablero, mandar]);
  useEffect(() => {
    const flush = () => { if (pendienteGuardar.current) void mandar(pendienteGuardar.current, true); };
    const alOcultar = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => { document.removeEventListener('visibilitychange', alOcultar); flush(); };
  }, [mandar]);

  // ── Hojas ───────────────────────────────────────────────────────────────────────────────
  const irAHoja = useCallback((id: string) => {
    setHojaId(id);
    setSelId(null);
    router.replace(`/dashboard?hoja=${encodeURIComponent(id)}`, { scroll: false });
  }, [router]);
  const anadirHoja = () => {
    if (tablero.hojas.length >= MAX_HOJAS) { show('Llegaste al máximo de páginas'); return; }
    const h: Hoja = { id: nuevoId(), nombre: `Página ${tablero.hojas.length + 1}`, componentes: [] };
    mutar((t) => ({ ...t, hojas: [...t.hojas, h] }));
    irAHoja(h.id);
  };
  const duplicarHoja = (id: string) => {
    const h = tablero.hojas.find((x) => x.id === id);
    if (!h || tablero.hojas.length >= MAX_HOJAS) return;
    const copia: Hoja = { id: nuevoId(), nombre: `${h.nombre} (copia)`.slice(0, 40), componentes: h.componentes.map((c) => ({ ...c, id: nuevoId() })) };
    mutar((t) => { const i = t.hojas.findIndex((x) => x.id === id); const hs = [...t.hojas]; hs.splice(i + 1, 0, copia); return { ...t, hojas: hs }; });
    irAHoja(copia.id);
  };
  const eliminarHoja = (id: string) => {
    if (tablero.hojas.length <= 1) return;
    const i = tablero.hojas.findIndex((x) => x.id === id);
    mutar((t) => ({ ...t, hojas: t.hojas.filter((x) => x.id !== id) }));
    if (id === hoja.id) irAHoja(tablero.hojas[i === 0 ? 1 : i - 1].id);
    show('Página eliminada', () => pila.deshacer());
  };
  const moverHoja = (id: string, delta: number) => mutar((t) => {
    const i = t.hojas.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= t.hojas.length) return t;
    const hs = [...t.hojas];
    [hs[i], hs[j]] = [hs[j], hs[i]];
    return { ...t, hojas: hs };
  });

  // ── Componentes ─────────────────────────────────────────────────────────────────────────
  const cambiar = useCallback((id: string, parche: Partial<Grafico> | Partial<Control>) => {
    mutarHoja((h) => ({ ...h, componentes: h.componentes.map((c) => (c.id === id ? sanearComponente({ ...c, ...parche }) ?? c : c)) }));
  }, [mutarHoja]);
  // El id se acuña AFUERA del updater: en modo estricto React lo corre dos veces.
  const agregarComponente = (c: Componente) => {
    if (hoja.componentes.length >= MAX_COMPONENTES) { show('Llegaste al máximo de componentes'); return; }
    mutarHoja((h) => ({ ...h, componentes: [...h.componentes, c] }));
    setSelId(c.id);
    setEditando(true);
  };
  const duplicar = (c: Componente) => agregarComponente({ ...c, id: nuevoId(), y: c.y + c.h });
  const borrar = useCallback((c: Componente) => {
    mutarHoja((h) => ({ ...h, componentes: h.componentes.filter((x) => x.id !== c.id) }));
    setSelId(null);
    show(esControl(c) ? 'Control eliminado' : 'Gráfico eliminado', () => pila.deshacer());
  }, [mutarHoja, show, pila]);
  const restablecer = () => {
    mutar(() => tableroInicial());
    setSelId(null);
    irAHoja(tableroInicial().hojas[0].id);
    show('Informe restablecido', () => pila.deshacer());
  };
  const fuenteParaNuevo = () => (sel && esGrafico(sel) ? sel.fuente : 'negocio');

  /** Un campo soltado sobre un gráfico: la dimensión se reemplaza, la métrica se suma. */
  const soltarEnGrafico = (g: Grafico, c: Campo) => {
    const base: Grafico = c.fuente === g.fuente ? g : { ...g, fuente: c.fuente, metricas: [], dimension: null, desglose: null };
    if (c.clase === 'dim') {
      const info = tipoDe(base.tipo)!;
      cambiar(g.id, { ...base, dimension: c.id, tipo: info.dimension === 'ninguna' ? 'tabla' : base.tipo });
    } else {
      const info = tipoDe(base.tipo)!;
      const mets = base.metricas.includes(c.id) ? base.metricas : [...base.metricas, c.id].slice(-info.maxMetricas);
      cambiar(g.id, { ...base, metricas: mets });
    }
    setSelId(g.id);
  };
  /** Un campo soltado en la página vacía crea un gráfico, como en Looker. */
  const soltarEnPagina = (c: Campo) => {
    const f = fuenteDe(c.fuente)!;
    const dim = f.dimensiones.find((d) => d.id === c.id);
    const tipo = c.clase === 'met' ? 'numero' : dim?.clase === 'tiempo' ? 'serie' : 'tabla';
    const n = nuevoGrafico(tipo, hoja.componentes, c.fuente);
    const g = sanearComponente(c.clase === 'met' ? { ...n, metricas: [c.id] } : { ...n, dimension: c.id })!;
    agregarComponente(g);
  };
  const tocarCampo = (c: Campo) => { if (sel && esGrafico(sel)) soltarEnGrafico(sel, c); else soltarEnPagina(c); };
  const anadirFuente = (id: string) => {
    setModalDatos(false);
    agregarComponente(nuevoGrafico('tabla', hoja.componentes, id));
  };

  // Escape suelta el componente; Suprimir lo elimina (sólo editando y fuera de un texto).
  useEffect(() => {
    if (!editando) return;
    const k = (e: KeyboardEvent) => {
      if (enUnTexto() || menu || modalDatos) return;
      if (e.key === 'Escape') setSelId(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); borrar(sel); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [editando, menu, modalDatos, sel, borrar]);

  const layout: Layout = useMemo(
    () => hoja.componentes.map((c) => ({ i: c.id, x: c.x, y: c.y, w: c.w, h: c.h, minW: esControl(c) ? 2 : 2, minH: esControl(c) ? 1 : 2 })),
    [hoja.componentes],
  );
  // Arrastrar y agrandar: se apila UNA vez al empezar el gesto, no en cada píxel.
  const alEmpezarGesto = useCallback(() => pila.apilar(tableroRef.current), [pila]);
  const idHoja = hoja.id;
  // La grilla avisa un cambio también al MONTAR, cuando compacta lo que vino (medido el 11/10: así
  // se guardó el informe de Mauricio a las 01:59 sin que tocara nada, y una copia guardada ya no
  // recibe las mejoras del informe inicial). Mirando, no se escribe: sólo editando.
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

  return (
    <div className={`lk lk-app${editando ? ' lk--editando' : ''}`}>
      {lecturaFallo && <div style={{ padding: '8px 16px 0' }}><Banner tono="warn" alcance="local">No pude leer tu informe. Los cambios no se guardan.</Banner></div>}

      {/* ── La cabecera del informe ── */}
      <div className="lk-cabecera">
        <span className="lk-logo" aria-hidden><SvgLogo /></span>
        <input
          className="lk-nombre" value={tablero.nombre} readOnly={!editando} aria-label="Nombre del informe" maxLength={80}
          onFocus={() => { if (editando) pila.apilar(tableroRef.current); }}
          onChange={(e) => setTablero((t) => ({ ...t, nombre: e.target.value }))}
          onBlur={() => setTablero((t) => (t.nombre.trim() ? t : { ...t, nombre: 'Dashboard' }))}
        />
        <span className="lk-guardado" data-error={guardado === 'error' || undefined}>
          {guardado === 'guardando' ? 'Guardando…' : guardado === 'ok' ? 'Guardado' : guardado === 'error' ? 'No se guardó' : ''}
        </span>
        <div className="lk-acciones">
          {editando && <button type="button" className="lk-pill" onClick={restablecer} title="Volver al informe inicial de MaKo"><SvgReset /> Restablecer</button>}
          <button type="button" className="lk-pill lk-pill--azul" disabled={!guardable && !editando} onClick={() => { setEditando((v) => !v); setSelId(null); }}>
            {editando ? <><SvgOjo /> Ver</> : <><SvgLapiz /> Editar</>}
          </button>
        </div>
      </div>

      {/* ── La barra de herramientas ── */}
      {editando && (
        <div className="lk-barra" role="toolbar" aria-label="Herramientas del informe">
          <button type="button" className="lk-herr lk-herr--icono" onClick={pila.deshacer} disabled={!pila.puedeDeshacer} title="Deshacer (Ctrl+Z)" aria-label="Deshacer"><SvgDeshacer /></button>
          <button type="button" className="lk-herr lk-herr--icono" onClick={pila.rehacer} disabled={!pila.puedeRehacer} title="Rehacer (Ctrl+Y)" aria-label="Rehacer"><SvgDeshacer espejo /></button>
          <span className="lk-sep" />
          <button type="button" className="lk-herr" onClick={anadirHoja}><SvgPagina /> Añadir página</button>
          <button type="button" className="lk-herr" onClick={() => setModalDatos(true)}><SvgAgregarDatos /> Añadir datos</button>
          <span className="lk-sep" />
          <button type="button" className="lk-herr" aria-haspopup="menu" aria-expanded={menu?.tipo === 'graficos'} onClick={(e) => setMenu(menu ? null : { ancla: e.currentTarget, tipo: 'graficos' })}>
            <SvgAgregarGrafico /> Añadir un gráfico <SvgFlecha />
          </button>
          <button type="button" className="lk-herr" aria-haspopup="menu" aria-expanded={menu?.tipo === 'controles'} onClick={(e) => setMenu(menu ? null : { ancla: e.currentTarget, tipo: 'controles' })}>
            <SvgControl /> Añadir un control <SvgFlecha />
          </button>
        </div>
      )}

      {/* ── Las páginas ── */}
      <div className="lk-hojas" role="tablist" aria-label="Páginas">
        {tablero.hojas.map((h, i) => (
          <div key={h.id} className="lk-hoja-tab" aria-selected={h.id === hoja.id} role="tab">
            {renombrando === h.id ? (
              <input autoFocus defaultValue={h.nombre} maxLength={40} className="lk-hoja-input" aria-label="Nombre de la página"
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== h.nombre) mutar((t) => ({ ...t, hojas: t.hojas.map((x) => (x.id === h.id ? { ...x, nombre: v } : x)) })); setRenombrando(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenombrando(null); }} />
            ) : (
              <button type="button" className="lk-hoja-btn" onClick={() => irAHoja(h.id)} onDoubleClick={() => { if (editando) setRenombrando(h.id); }} title={editando ? 'Doble clic para renombrar' : h.nombre}>
                {h.nombre}
              </button>
            )}
            {editando && h.id === hoja.id && renombrando !== h.id && (
              <button type="button" className="lk-hoja-mas" aria-label={`Opciones de ${h.nombre}`} onClick={(e) => setMenu({ ancla: e.currentTarget, tipo: 'hoja', hojaId: h.id })}>⋮</button>
            )}
            {i < tablero.hojas.length - 1 && <span className="lk-hoja-sep" aria-hidden />}
          </div>
        ))}
        {editando && <button type="button" className="lk-hoja-nueva" onClick={anadirHoja} title="Añadir página" aria-label="Añadir página">＋</button>}
      </div>

      {/* ── El lienzo, la página y los paneles ── */}
      <div className="lk-cuerpo">
        <div className="lk-lienzo" onClick={() => { if (editando) setSelId(null); }}>
          <div
            className="lk-pagina" ref={containerRef}
            data-soltar={soltandoEn === 'pagina' || undefined}
            onDragOver={(e) => { if (editando && traeCampo(e)) { e.preventDefault(); setSoltandoEn('pagina'); } }}
            onDragLeave={() => setSoltandoEn((s) => (s === 'pagina' ? null : s))}
            onDrop={(e) => { const c = leerCampo(e); setSoltandoEn(null); if (c) { e.preventDefault(); soltarEnPagina(c); } }}
          >
            {!hoja.componentes.length ? (
              <div className="lk-vacio">
                <p>Esta página no tiene gráficos.</p>
                {editando ? (
                  <button type="button" className="lk-pill lk-pill--azul" onClick={(e) => { e.stopPropagation(); setMenu({ ancla: e.currentTarget, tipo: 'graficos' }); }}>Añadir un gráfico</button>
                ) : (
                  <button type="button" className="lk-pill lk-pill--azul" onClick={() => setEditando(true)} disabled={!guardable}>Editar</button>
                )}
              </div>
            ) : mounted && (
              <ReactGridLayout
                width={width}
                layout={layout}
                gridConfig={{ cols: 12, rowHeight: 30, margin: [16, 16], containerPadding: [0, 0] }}
                dragConfig={{ enabled: editando, cancel: '.lk-no-arrastrar' }}
                resizeConfig={{ enabled: editando, handles: ['se', 'e', 's'] }}
                compactor={verticalCompactor}
                onDragStart={alEmpezarGesto}
                onResizeStart={alEmpezarGesto}
                onLayoutChange={alMoverGrilla}
              >
                {hoja.componentes.map((c) => {
                  const elegido = editando && c.id === selId;
                  if (esControl(c)) {
                    return (
                      <div key={c.id} className={`lk-comp lk-comp--control${elegido ? ' lk-comp--sel' : ''}`} onClick={(e) => { if (editando) { e.stopPropagation(); setSelId(c.id); } }}>
                        <ControlPeriodo c={c} hoy={hoy} onCambiar={(p) => cambiar(c.id, p)} />
                      </div>
                    );
                  }
                  const est = datos[c.id] ?? { cargando: true };
                  const e = c.estilo;
                  // La tarjeta de las tabs viejas: el número lleva SIEMPRE su filete de 3 px (gris si
                  // no se eligió color); un gráfico, sólo si se eligió. El blanco de fábrica es el
                  // token de superficie, así la tarjeta se da vuelta en el tema oscuro.
                  const kpi = esTarjetaNumero(c.tipo);
                  const filete = e.bordeSuperior ?? (kpi ? 'var(--border-strong)' : null);
                  const estilo: CSSProperties = {
                    background: e.fondo.toLowerCase() === '#ffffff' ? 'var(--surface)' : e.fondo,
                    borderRadius: e.radio,
                    ...(filete ? { borderTop: `3px solid ${filete}` } : {}),
                  };
                  return (
                    <div
                      key={c.id} style={estilo}
                      className={`lk-comp${kpi ? ' lk-comp--kpi' : ''}${elegido ? ' lk-comp--sel' : ''}${soltandoEn === c.id ? ' lk-comp--soltar' : ''}${e.borde ? ' lk-comp--borde' : ''}`}
                      onClick={(ev) => { if (editando) { ev.stopPropagation(); setSelId(c.id); } }}
                      onDragOver={(ev) => { if (editando && traeCampo(ev)) { ev.preventDefault(); ev.stopPropagation(); setSoltandoEn(c.id); } }}
                      onDragLeave={() => setSoltandoEn((s) => (s === c.id ? null : s))}
                      onDrop={(ev) => { const f = leerCampo(ev); setSoltandoEn(null); if (f) { ev.preventDefault(); ev.stopPropagation(); soltarEnGrafico(c, f); } }}
                    >
                      {e.mostrarTitulo && (
                        <div className={`lk-comp-tit lk-comp-tit--${e.tamTitulo}`} style={{ justifyContent: e.alinear === 'centro' ? 'center' : 'flex-start' }}>
                          <span title={tituloDe(c)}>{tituloDe(c)}</span>
                          {est.cargando && est.resultado && <span className="lk-mini-giro" aria-label="Actualizando" />}
                        </div>
                      )}
                      {!kpi && e.subtitulo && <div className="lk-comp-sub" style={{ textAlign: e.alinear === 'centro' ? 'center' : 'left' }} title={e.subtitulo}>{e.subtitulo}</div>}
                      <CuerpoGrafico g={c} estado={est} />
                    </div>
                  );
                })}
              </ReactGridLayout>
            )}
          </div>
        </div>

        {editando && paneles.props && (
          sel ? (
            esControl(sel)
              ? <PropsControl key={sel.id} c={sel} hoy={hoy} cambiar={(p) => cambiar(sel.id, p)} onBorrar={() => borrar(sel)} />
              : <Propiedades key={sel.id} g={sel} cambiar={(p) => cambiar(sel.id, p)} onDuplicar={() => duplicar(sel)} onBorrar={() => borrar(sel)}
                onCambiarTipo={(el) => setMenu({ ancla: el, tipo: 'cambiarTipo' })} onAnadirDatos={() => setModalDatos(true)} />
          ) : (
            <aside className="lk-panel lk-props lk-empecemos">
              <SvgEmpecemos />
              <h3>Empecemos</h3>
              <p>Arrastra un campo del panel de datos al lienzo para añadir un gráfico, o selecciona un componente del lienzo para editarlo.</p>
            </aside>
          )
        )}
        {editando && paneles.datos && <PanelDatos elegido={sel && esGrafico(sel) ? sel : null} onTocar={tocarCampo} onAnadirDatos={() => setModalDatos(true)} />}
        {editando && (
          <nav className="lk-riel" aria-label="Paneles">
            <button type="button" aria-pressed={paneles.datos} onClick={() => setPaneles((p) => ({ ...p, datos: !p.datos }))}><SvgDatos /><span>Datos</span></button>
            <button type="button" aria-pressed={paneles.props} onClick={() => setPaneles((p) => ({ ...p, props: !p.props }))}><SvgLapiz /><span>Propiedades</span></button>
          </nav>
        )}
      </div>

      {menu?.tipo === 'graficos' || menu?.tipo === 'cambiarTipo' ? (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={372}>
          <Galeria actual={menu.tipo === 'cambiarTipo' && sel && esGrafico(sel) ? sel.tipo : undefined} onElegir={(tipo) => {
            const m = menu;
            setMenu(null);
            if (m.tipo === 'cambiarTipo' && sel && esGrafico(sel)) cambiar(sel.id, { tipo });
            else agregarComponente(nuevoGrafico(tipo, hoja.componentes, fuenteParaNuevo()));
          }} />
        </Flotante>
      ) : null}
      {menu?.tipo === 'controles' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={240}>
          <div className="lk-lista" role="menu">
            <button type="button" role="menuitem" className="lk-opcion" onClick={() => { setMenu(null); agregarComponente(nuevoControl(hoja.componentes)); }}>
              <SvgCalendario /> <span>Control de período</span>
            </button>
          </div>
        </Flotante>
      )}
      {menu?.tipo === 'hoja' && menu.hojaId && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={220}>
          <div className="lk-lista" role="menu">
            {(() => {
              const id = menu.hojaId!;
              const i = tablero.hojas.findIndex((h) => h.id === id);
              const op = (texto: string, fn: () => void, deshabilitada = false) => (
                <button type="button" role="menuitem" className="lk-opcion" disabled={deshabilitada} onClick={() => { setMenu(null); fn(); }}>{texto}</button>
              );
              return (
                <>
                  {op('Renombrar', () => setRenombrando(id))}
                  {op('Duplicar', () => duplicarHoja(id), tablero.hojas.length >= MAX_HOJAS)}
                  {op('Mover a la izquierda', () => moverHoja(id, -1), i <= 0)}
                  {op('Mover a la derecha', () => moverHoja(id, 1), i >= tablero.hojas.length - 1)}
                  {op('Eliminar', () => eliminarHoja(id), tablero.hojas.length <= 1)}
                </>
              );
            })()}
          </div>
        </Flotante>
      )}

      {modalDatos && <ModalDatos onElegir={anadirFuente} onCerrar={() => setModalDatos(false)} />}

      <Toast state={toast} onClose={clear} />
      <style>{CSS}</style>
    </div>
  );
}

// ── El control de período (un componente de la página) ─────────────────────────────────────

function ControlPeriodo({ c, hoy, onCambiar }: { c: Control; hoy: string; onCambiar: (p: Partial<Control>) => void }) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const rg = rangoDe(c.preset, hoy, c.desde, c.hasta);
  const dd = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  return (
    <>
      <button type="button" className="lk-control lk-no-arrastrar" onClick={(e) => { e.stopPropagation(); const t = e.currentTarget; setAncla((a) => (a ? null : t)); }} aria-haspopup="listbox">
        <SvgCalendario />
        <span className="lk-control-txt">{c.preset === 'personalizado' ? `${dd(rg.desde)} – ${dd(rg.hasta)}` : nombrePreset(c.preset)}</span>
        <SvgFlecha />
      </button>
      {ancla && (
        <Flotante ancla={ancla} onCerrar={() => setAncla(null)} ancho={260}>
          <SelectorPeriodo preset={c.preset} desde={c.desde} hasta={c.hasta} hoy={hoy}
            onElegir={(p) => { if (p.preset === 'auto') return; onCambiar(p); if (p.preset !== 'personalizado') setAncla(null); }} />
        </Flotante>
      )}
    </>
  );
}

function SelectorPeriodo({ preset, desde, hasta, hoy, onElegir, conAuto }: {
  preset: Preset | 'auto'; desde: string | null; hasta: string | null; hoy: string;
  onElegir: (p: { preset: Preset; desde?: string | null; hasta?: string | null } | { preset: 'auto' }) => void; conAuto?: boolean;
}) {
  const rg = preset === 'auto' ? null : rangoDe(preset, hoy, desde, hasta);
  return (
    <div className="lk-lista" role="listbox">
      {conAuto && <button type="button" className="lk-opcion" aria-selected={preset === 'auto'} onClick={() => onElegir({ preset: 'auto' })}>Automático</button>}
      {PRESETS.map((p) => (
        <button key={p.id} type="button" role="option" aria-selected={preset === p.id} className="lk-opcion"
          onClick={() => onElegir(p.id === 'personalizado' ? { preset: 'personalizado', desde: rg?.desde ?? hoy, hasta: rg?.hasta ?? hoy } : { preset: p.id })}>
          {p.nombre}
        </button>
      ))}
      {preset === 'personalizado' && rg && (
        <div className="lk-fechas" onClick={(e) => e.stopPropagation()}>
          <label>Desde <input type="date" className="lk-input" value={rg.desde} max={rg.hasta} onChange={(e) => onElegir({ preset: 'personalizado', desde: e.target.value, hasta: rg.hasta })} /></label>
          <label>Hasta <input type="date" className="lk-input" value={rg.hasta} min={rg.desde} max={hoy} onChange={(e) => onElegir({ preset: 'personalizado', desde: rg.desde, hasta: e.target.value })} /></label>
        </div>
      )}
    </div>
  );
}

function PropsControl({ c, hoy, cambiar, onBorrar }: { c: Control; hoy: string; cambiar: (p: Partial<Control>) => void; onBorrar: () => void }) {
  return (
    <aside className="lk-panel lk-props" onClick={(e) => e.stopPropagation()}>
      <div className="lk-props-tipo"><SvgCalendario /><strong className="lk-props-nombre">Control de período</strong></div>
      <div className="lk-secciones">
        <Seccion titulo="Período predeterminado">
          <SelectorPeriodo preset={c.preset} desde={c.desde} hasta={c.hasta} hoy={hoy} onElegir={(p) => cambiar(p as Partial<Control>)} />
          <p className="lk-ayuda">Manda sobre los gráficos de esta página que tengan el período en «Automático».</p>
        </Seccion>
        <div className="lk-botones"><button type="button" className="lk-pill lk-pill--rojo" onClick={onBorrar}>Eliminar</button></div>
      </div>
    </aside>
  );
}

// ── El panel de propiedades de un gráfico: CONFIGURACIÓN | ESTILO ───────────────────────────

function Propiedades({ g, cambiar, onDuplicar, onBorrar, onCambiarTipo, onAnadirDatos }: {
  g: Grafico;
  cambiar: (p: Partial<Grafico>) => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onCambiarTipo: (el: HTMLElement) => void;
  onAnadirDatos: () => void;
}) {
  const [pestana, setPestana] = useState<'config' | 'estilo'>('config');
  const [soltar, setSoltar] = useState<'dim' | 'met' | null>(null);
  const fuente = fuenteDe(g.fuente)!;
  const info = tipoDe(g.tipo)!;
  const dims = dimensionesPara(fuente, g.tipo);
  const desgs = desglosesPara(fuente, g.tipo, g.dimension);
  const mets = metricasPara(fuente, g.tipo);
  const dim = dims.find((d) => d.id === g.dimension);
  const desg = desgs.find((d) => d.id === g.desglose);
  const porCategoria = dim?.clase === 'categoria';
  const est = (p: Partial<Estilo>) => cambiar({ estilo: { ...g.estilo, ...p } });

  const zona = (clase: 'dim' | 'met'): Zona => ({
    'data-soltar': soltar === clase ? true : undefined,
    onDragOver: (e) => { if (traeCampo(e)) { e.preventDefault(); setSoltar(clase); } },
    onDragLeave: () => setSoltar(null),
    onDrop: (e) => {
      setSoltar(null);
      const c = leerCampo(e);
      if (!c) return;
      e.preventDefault();
      const base = c.fuente === g.fuente ? {} : { fuente: c.fuente };
      if (c.clase === 'dim' && clase === 'dim') cambiar({ ...base, dimension: c.id });
      if (c.clase === 'met' && clase === 'met') cambiar({ ...base, metricas: c.fuente === g.fuente && !g.metricas.includes(c.id) ? [...g.metricas, c.id].slice(-info.maxMetricas) : [c.id] });
    },
  });
  const usaLimite = porCategoria && info.grupo !== 'Histograma';
  const conEjes = ['Serie temporal', 'Barras', 'Líneas', 'Áreas', 'Dispersión', 'Histograma', 'Cascada', 'Cronología'].includes(info.grupo) && g.tipo !== 'serie_sparkline';
  const conLeyenda = ['Serie temporal', 'Barras', 'Líneas', 'Áreas', 'Circular'].includes(info.grupo) && g.tipo !== 'serie_sparkline';
  const conObjetivo = info.grupo === 'Bala' || info.grupo === 'Indicador';
  const conTotal = info.grupo === 'Tabla' || info.grupo === 'Tabla dinámica';

  return (
    <aside className="lk-panel lk-props" onClick={(e) => e.stopPropagation()}>
      <div className="lk-props-tipo">
        <IconoTipo tipo={g.tipo} size={22} />
        <button type="button" className="lk-tipo-btn" aria-haspopup="menu" onClick={(e) => onCambiarTipo(e.currentTarget)}>{info.nombre} <SvgFlecha /></button>
      </div>
      <div className="lk-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'config'} onClick={() => setPestana('config')}>Configuración</button>
        <button type="button" role="tab" aria-selected={pestana === 'estilo'} onClick={() => setPestana('estilo')}>Estilo</button>
      </div>

      {pestana === 'config' ? (
        <div className="lk-secciones">
          <Seccion titulo="Fuente de datos">
            <Elegir
              boton={<span className="lk-fuente"><span className="lk-fuente-ico" style={{ background: colorFuente(g.fuente) }}><IconoMenu nombre={iconoFuente(g.fuente)} size={13} /></span><span className="lk-fuente-nom">{fuente.nombre}</span><SvgFlecha /></span>}
              opciones={FUENTES.map((f) => ({ id: f.id, nombre: f.nombre, grupo: f.area, ico: <span className="lk-fuente-ico lk-fuente-ico--chico" style={{ background: colorFuente(f.id) }}><IconoMenu nombre={iconoFuente(f.id)} size={11} /></span> }))}
              pie={{ texto: '＋ Añadir datos', onClick: onAnadirDatos }}
              onElegir={(id) => cambiar({ fuente: id })}
            />
          </Seccion>

          <Seccion titulo="Dimensión del período">
            {fuente.fechas.length > 1 ? (
              <Elegir
                boton={<Ficha clase="dim" ico={<SvgCalendario />} texto={fuente.fechas.find((f) => f.id === g.fecha)?.nombre ?? ''} />}
                opciones={fuente.fechas.map((f) => ({ id: f.id, nombre: f.nombre, ico: <SvgCalendario /> }))}
                onElegir={(id) => cambiar({ fecha: id })}
              />
            ) : <Ficha clase="dim" ico={<SvgCalendario />} texto={fuente.fechas[0].nombre} />}
          </Seccion>

          {dims.length > 0 && (
            <Seccion titulo={info.grupo === 'Tabla dinámica' ? 'Dimensión de fila' : 'Dimensión'} zona={zona('dim')}>
              <Elegir
                boton={<Ficha clase="dim" ico={dim ? <TipoCampo d={dim} /> : null} texto={dim?.nombre ?? 'Elegir'} />}
                opciones={dims.map((d) => ({ id: d.id, nombre: d.nombre, ico: <TipoCampo d={d} /> }))}
                onElegir={(id) => cambiar({ dimension: id })}
              />
            </Seccion>
          )}

          {info.desglose !== 'no' && (
            <Seccion titulo={info.grupo === 'Tabla dinámica' ? 'Dimensión de columna' : info.grupo === 'Sankey' ? 'Dimensión de destino' : 'Dimensión de desglose'}>
              {desg ? (
                <div className="lk-ficha-fila">
                  <Elegir boton={<Ficha clase="dim" ico={<TipoCampo d={desg} />} texto={desg.nombre} />} opciones={desgs.map((d) => ({ id: d.id, nombre: d.nombre, ico: <TipoCampo d={d} /> }))} onElegir={(id) => cambiar({ desglose: id })} />
                  {info.desglose === 'opcional' && <button type="button" className="lk-quitar" title="Quitar" aria-label="Quitar el desglose" onClick={() => cambiar({ desglose: null })}>✕</button>}
                </div>
              ) : desgs.length ? (
                <Elegir boton={<span className="lk-agregar">＋ Añadir dimensión</span>} opciones={desgs.map((d) => ({ id: d.id, nombre: d.nombre, ico: <TipoCampo d={d} /> }))} onElegir={(id) => cambiar({ desglose: id })} />
              ) : <p className="lk-ayuda">Esta fuente no tiene otra dimensión para desglosar.</p>}
            </Seccion>
          )}

          <Seccion titulo={info.maxMetricas > 1 ? (info.grupo === 'Embudo de conversión' ? 'Pasos del embudo' : 'Métricas') : 'Métrica'} zona={zona('met')}>
            <div className="lk-fichas">
              {g.metricas.map((mid, i) => {
                const met = metricaDe(fuente, mid);
                return (
                  <div key={`${mid}-${i}`} className="lk-ficha-fila">
                    <Elegir
                      boton={<Ficha clase="met" ico={<Agregacion m={met} />} texto={met?.nombre ?? mid} />}
                      opciones={mets.filter((x) => x.id === mid || !g.metricas.includes(x.id)).map((x) => ({ id: x.id, nombre: x.nombre, ico: <Agregacion m={x} /> }))}
                      onElegir={(id) => cambiar({ metricas: g.metricas.map((x, j) => (j === i ? id : x)) })}
                    />
                    {g.metricas.length > info.minMetricas && (
                      <button type="button" className="lk-quitar" aria-label={`Quitar ${met?.nombre ?? mid}`} title="Quitar" onClick={() => cambiar({ metricas: g.metricas.filter((_, j) => j !== i) })}>✕</button>
                    )}
                  </div>
                );
              })}
              {g.metricas.length < info.maxMetricas && mets.some((x) => !g.metricas.includes(x.id)) && (
                <Elegir boton={<span className="lk-agregar">＋ Añadir métrica</span>}
                  opciones={mets.filter((x) => !g.metricas.includes(x.id)).map((x) => ({ id: x.id, nombre: x.nombre, ico: <Agregacion m={x} /> }))}
                  onElegir={(id) => cambiar({ metricas: [...g.metricas, id] })} />
              )}
            </div>
          </Seccion>

          {porCategoria && (
            <Seccion titulo="Ordenar">
              <Elegir
                boton={<Ficha clase="met" ico={<Agregacion m={metricaDe(fuente, g.ordenMetrica ?? g.metricas[0])} />} texto={metricaDe(fuente, g.ordenMetrica ?? g.metricas[0])?.nombre ?? ''} />}
                opciones={g.metricas.map((id) => ({ id, nombre: metricaDe(fuente, id)?.nombre ?? id, ico: <Agregacion m={metricaDe(fuente, id)} /> }))}
                onElegir={(id) => cambiar({ ordenMetrica: id })}
              />
              <div className="lk-radios">
                <label><input type="radio" checked={!g.ordenAsc} onChange={() => cambiar({ ordenAsc: false })} /> Descendente</label>
                <label><input type="radio" checked={g.ordenAsc} onChange={() => cambiar({ ordenAsc: true })} /> Ascendente</label>
              </div>
            </Seccion>
          )}

          <Seccion titulo="Período predeterminado">
            {fuente.fechas.find((f) => f.id === g.fecha)?.sinRango ? (
              <p className="lk-ayuda">Esta dimensión es la foto de hoy: no usa período.</p>
            ) : (
              <>
                <div className="lk-radios">
                  <label><input type="radio" checked={g.periodo === 'auto'} onChange={() => cambiar({ periodo: 'auto' })} /> Automático</label>
                  <label><input type="radio" checked={g.periodo !== 'auto'} onChange={() => cambiar({ periodo: 'ult30' })} /> Personalizado</label>
                </div>
                {g.periodo !== 'auto' ? (
                  <Elegir boton={<span className="lk-select">{nombrePreset(g.periodo)} <SvgFlecha /></span>} opciones={PRESETS.map((p) => ({ id: p.id, nombre: p.nombre }))}
                    onElegir={(id) => cambiar({ periodo: id as Preset })} />
                ) : <p className="lk-ayuda">Toma el control de período de la página; si no hay, los últimos 30 días.</p>}
                {g.periodo === 'personalizado' && (
                  <div className="lk-fechas">
                    <label>Desde <input type="date" className="lk-input" value={g.desde ?? ''} onChange={(e) => cambiar({ desde: e.target.value })} /></label>
                    <label>Hasta <input type="date" className="lk-input" value={g.hasta ?? ''} onChange={(e) => cambiar({ hasta: e.target.value })} /></label>
                  </div>
                )}
              </>
            )}
          </Seccion>
        </div>
      ) : (
        <div className="lk-secciones">
          <Seccion titulo="Encabezado del gráfico">
            <label className="lk-check"><input type="checkbox" checked={g.estilo.mostrarTitulo} onChange={(e) => est({ mostrarTitulo: e.target.checked })} /> Mostrar título</label>
            <input className="lk-input" value={g.titulo} placeholder={tituloDe({ ...g, titulo: '' })} maxLength={80} onChange={(e) => cambiar({ titulo: e.target.value })} aria-label="Título" />
            <input className="lk-input" value={g.estilo.subtitulo} placeholder="Subtítulo" maxLength={80} onChange={(e) => est({ subtitulo: e.target.value })} aria-label="Subtítulo" />
            <div className="lk-segmento" role="group" aria-label="Tamaño del título">
              {(['s', 'm', 'l'] as const).map((t) => <button key={t} type="button" aria-pressed={g.estilo.tamTitulo === t} onClick={() => est({ tamTitulo: t })}>{t === 's' ? 'Chico' : t === 'm' ? 'Mediano' : 'Grande'}</button>)}
            </div>
            <div className="lk-segmento" role="group" aria-label="Alineación">
              <button type="button" aria-pressed={g.estilo.alinear === 'izquierda'} onClick={() => est({ alinear: 'izquierda' })}>Izquierda</button>
              <button type="button" aria-pressed={g.estilo.alinear === 'centro'} onClick={() => est({ alinear: 'centro' })}>Centro</button>
            </div>
          </Seccion>

          <Seccion titulo="Colores">
            <div className="lk-colores">
              {g.estilo.colores.map((col, i) => (
                <label key={i} className="lk-color" title={`Serie ${i + 1}`}>
                  <input type="color" value={col} onChange={(e) => { const cs = [...g.estilo.colores]; cs[i] = e.target.value; est({ colores: cs }); }} aria-label={`Color de la serie ${i + 1}`} />
                </label>
              ))}
            </div>
            <button type="button" className="lk-agregar" onClick={() => est({ colores: PALETA.slice() })}>Restablecer colores</button>
          </Seccion>

          {(conEjes || conLeyenda || info.grupo === 'Circular') && (
            <Seccion titulo="Gráfico">
              <label className="lk-check"><input type="checkbox" checked={g.estilo.etiquetas} onChange={(e) => est({ etiquetas: e.target.checked })} /> Mostrar etiquetas de datos</label>
              {conEjes && <label className="lk-check"><input type="checkbox" checked={g.estilo.ejes} onChange={(e) => est({ ejes: e.target.checked })} /> Mostrar ejes</label>}
              {conEjes && <label className="lk-check"><input type="checkbox" checked={g.estilo.cuadricula} onChange={(e) => est({ cuadricula: e.target.checked })} /> Mostrar cuadrícula</label>}
              {conLeyenda && (
                <>
                  <span className="lk-sub">Leyenda</span>
                  <Elegir boton={<span className="lk-select">{({ arriba: 'Arriba', abajo: 'Abajo', derecha: 'A la derecha', no: 'No mostrar' } as const)[g.estilo.leyenda]} <SvgFlecha /></span>}
                    opciones={[{ id: 'arriba', nombre: 'Arriba' }, { id: 'abajo', nombre: 'Abajo' }, { id: 'derecha', nombre: 'A la derecha' }, { id: 'no', nombre: 'No mostrar' }]}
                    onElegir={(id) => est({ leyenda: id as Estilo['leyenda'] })} />
                </>
              )}
            </Seccion>
          )}

          {conObjetivo && (
            <Seccion titulo="Objetivo">
              <label className="lk-campo-num">Objetivo <input type="number" className="lk-input" value={g.estilo.objetivo ?? ''} onChange={(e) => est({ objetivo: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              <label className="lk-campo-num">Máximo <input type="number" className="lk-input" value={g.estilo.maximo ?? ''} placeholder="Automático" onChange={(e) => est({ maximo: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            </Seccion>
          )}

          {(usaLimite || conTotal) && (
            <Seccion titulo="Datos">
              {usaLimite && (
                <>
                  <span className="lk-sub">{info.grupo === 'Circular' ? 'Porciones' : info.grupo === 'Barras' ? 'Barras' : 'Filas'}</span>
                  <Elegir boton={<span className="lk-select">{g.limite} <SvgFlecha /></span>} opciones={LIMITES.map((n) => ({ id: String(n), nombre: String(n) }))} onElegir={(id) => cambiar({ limite: Number(id) })} />
                </>
              )}
              {conTotal && <label className="lk-check"><input type="checkbox" checked={g.estilo.total} onChange={(e) => est({ total: e.target.checked })} /> Mostrar fila de total</label>}
            </Seccion>
          )}

          <Seccion titulo="Números">
            <label className="lk-check"><input type="checkbox" checked={g.estilo.compacto} onChange={(e) => est({ compacto: e.target.checked })} /> Números compactos (1,2 k)</label>
            {info.grupo === 'Cuadro de resultados' && (
              <label className="lk-check"><input type="checkbox" checked={g.estilo.comparar} onChange={(e) => est({ comparar: e.target.checked })} /> Comparar con el período anterior</label>
            )}
          </Seccion>

          <Seccion titulo="Fondo y borde">
            <label className="lk-campo-num">Color de fondo <input type="color" className="lk-color-input" value={g.estilo.fondo} onChange={(e) => est({ fondo: e.target.value })} /></label>
            <label className="lk-check"><input type="checkbox" checked={g.estilo.borde} onChange={(e) => est({ borde: e.target.checked })} /> Mostrar borde</label>
            <label className="lk-check"><input type="checkbox" checked={g.estilo.bordeSuperior != null} onChange={(e) => est({ bordeSuperior: e.target.checked ? g.estilo.colores[0] : null })} /> Filete de color arriba</label>
            {g.estilo.bordeSuperior != null && (
              <label className="lk-campo-num">Color del filete <input type="color" className="lk-color-input" value={g.estilo.bordeSuperior} onChange={(e) => est({ bordeSuperior: e.target.value })} /></label>
            )}
            <span className="lk-sub">Radio de las esquinas</span>
            <div className="lk-segmento" role="group" aria-label="Radio de las esquinas">
              {[0, 4, 8, 16].map((n) => <button key={n} type="button" aria-pressed={g.estilo.radio === n} onClick={() => est({ radio: n })}>{n}</button>)}
            </div>
          </Seccion>

          <div className="lk-botones">
            <button type="button" className="lk-pill" onClick={onDuplicar}>Duplicar</button>
            <button type="button" className="lk-pill lk-pill--rojo" onClick={onBorrar}>Eliminar</button>
          </div>
        </div>
      )}
    </aside>
  );
}

// ── El panel Datos: todos los conjuntos de MaKo ──────────────────────────────────────────────

function PanelDatos({ elegido, onTocar, onAnadirDatos }: { elegido: Grafico | null; onTocar: (c: Campo) => void; onAnadirDatos: () => void }) {
  const [q, setQ] = useState('');
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set(elegido ? [elegido.fuente] : ['negocio']));
  useEffect(() => { if (elegido) setAbiertas((s) => (s.has(elegido.fuente) ? s : new Set([...s, elegido.fuente]))); }, [elegido]);
  const filtro = norm(q.trim());
  const arrastrar = (c: Campo) => (e: DragEvent) => { e.dataTransfer.setData(MIME_CAMPO, JSON.stringify(c)); e.dataTransfer.effectAllowed = 'copy'; };
  return (
    <aside className="lk-panel lk-datos" onClick={(e) => e.stopPropagation()}>
      <div className="lk-panel-tit"><SvgDatos /> Datos</div>
      <div className="lk-buscar"><SvgLupa /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar campos…" aria-label="Buscar campos" /></div>
      <div className="lk-datos-lista">
        {AREAS.map((area) => {
          const fs = FUENTES.filter((f) => f.area === area);
          return (
            <div key={area} className="lk-darea">
              <div className="lk-darea-tit">{area}</div>
              {fs.map((f) => {
                const dims = f.dimensiones.filter((d) => !filtro || norm(`${d.nombre} ${f.nombre}`).includes(filtro));
                const mets = f.metricas.filter((x) => !filtro || norm(`${x.nombre} ${f.nombre}`).includes(filtro));
                if (filtro && !dims.length && !mets.length) return null;
                const abierta = !!filtro || abiertas.has(f.id);
                return (
                  <div key={f.id} className="lk-dfuente" data-elegida={elegido?.fuente === f.id || undefined}>
                    <button type="button" className="lk-dfuente-tit" aria-expanded={abierta}
                      onClick={() => setAbiertas((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })}>
                      <span className="lk-fuente-ico lk-fuente-ico--chico" style={{ background: colorFuente(f.id) }}><IconoMenu nombre={iconoFuente(f.id)} size={11} /></span>
                      <span className="lk-dfuente-nom">{f.nombre}</span>
                      <SvgFlecha arriba={abierta} />
                    </button>
                    {abierta && (
                      <ul className="lk-campos">
                        {dims.map((d) => (
                          <li key={`d-${d.id}`} draggable onDragStart={arrastrar({ fuente: f.id, clase: 'dim', id: d.id })} onClick={() => onTocar({ fuente: f.id, clase: 'dim', id: d.id })} className="lk-campo lk-campo--dim" title="Arrastrar a un gráfico o al lienzo">
                            <TipoCampo d={d} /> {d.nombre}
                          </li>
                        ))}
                        {mets.map((x) => (
                          <li key={`m-${x.id}`} draggable onDragStart={arrastrar({ fuente: f.id, clase: 'met', id: x.id })} onClick={() => onTocar({ fuente: f.id, clase: 'met', id: x.id })} className="lk-campo lk-campo--met" title="Arrastrar a un gráfico o al lienzo">
                            <span className="lk-tipo-campo">123</span> {x.nombre}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <button type="button" className="lk-agregar lk-agregar--bloque" onClick={onAnadirDatos}>＋ Añadir datos</button>
    </aside>
  );
}

// ── «Añadir datos»: más simple que Looker, porque la fuente es una sola, MaKo ────────────────

function ModalDatos({ onElegir, onCerrar }: { onElegir: (id: string) => void; onCerrar: () => void }) {
  const [q, setQ] = useState('');
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); cerrar.current(); } };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, []);
  const filtro = norm(q.trim());
  return createPortal(
    <div className="lk lk-velo" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="lk-modal" role="dialog" aria-label="Añadir datos">
        <div className="lk-modal-cab">
          <h2>Añadir datos de MaKo</h2>
          <button type="button" className="lk-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="lk-buscar lk-buscar--modal"><SvgLupa /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar datos" /></div>
        <div className="lk-modal-cuerpo">
          {AREAS.map((area) => {
            const fs = FUENTES.filter((f) => f.area === area && (!filtro || norm(`${f.nombre} ${f.descripcion} ${area}`).includes(filtro)));
            if (!fs.length) return null;
            return (
              <div key={area}>
                <div className="lk-darea-tit">{area}</div>
                {fs.map((f) => (
                  <button key={f.id} type="button" className="lk-dato" onClick={() => onElegir(f.id)}>
                    <span className="lk-fuente-ico" style={{ background: colorFuente(f.id) }}><IconoMenu nombre={iconoFuente(f.id)} size={14} /></span>
                    <span className="lk-dato-txt"><span className="lk-dato-nom">{f.nombre}</span><span className="lk-dato-desc">{f.descripcion}</span></span>
                    <span className="lk-dato-mas">Añadir</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── La galería «Añadir un gráfico», agrupada como la de Looker ─────────────────────────────

function Galeria({ actual, onElegir }: { actual?: string; onElegir: (tipo: string) => void }) {
  return (
    <div className="lk-galeria" role="menu">
      {GRUPOS.map((gr) => (
        <div key={gr} className="lk-galeria-grupo">
          <div className="lk-galeria-tit">{gr}</div>
          <div className="lk-galeria-fila">
            {TIPOS.filter((x) => x.grupo === gr).map((x) => (
              <button key={x.id} type="button" role="menuitem" className="lk-galeria-tipo" data-actual={actual === x.id || undefined} title={x.nombre} aria-label={x.nombre} onClick={() => onElegir(x.id)}>
                <IconoTipo tipo={x.id} size={34} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Un panel anclado a un botón, PORTALEADO al body y ubicado por cuenta: los paneles laterales
 * scrollean y un menú adentro se cortaría. Se cierra tocando afuera o con Escape, y el Escape
 * no le llega a nadie más.
 */
function Flotante({ ancla, onCerrar, ancho, children }: { ancla: HTMLElement; onCerrar: () => void; ancho: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; alto: number } | null>(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useLayoutEffect(() => {
    const ubicar = () => {
      const r = ancla.getBoundingClientRect();
      const alto = ref.current?.offsetHeight ?? 0;
      const w = Math.max(ancho, r.width);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      const abajo = r.bottom + 6;
      const libreAbajo = window.innerHeight - abajo - 8;
      const top = alto > libreAbajo && r.top - alto - 6 > 8 ? r.top - alto - 6 : abajo;
      setPos({ left, top, alto: Math.max(160, top === abajo ? libreAbajo : r.top - 14) });
    };
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => { window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); };
  }, [ancla, ancho]);
  useEffect(() => {
    const fuera = (e: MouseEvent) => { const t = e.target as Node; if (ref.current?.contains(t) || ancla.contains(t)) return; cerrar.current(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); cerrar.current(); } };
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('mousedown', fuera, true); document.removeEventListener('keydown', tecla, true); };
  }, [ancla]);
  return createPortal(
    <div ref={ref} className="lk lk-flotante" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, minWidth: ancho, maxHeight: pos?.alto ?? 400, visibility: pos ? 'visible' : 'hidden' }}>
      {children}
    </div>,
    document.body,
  );
}

type OpcionElegir = { id: string; nombre: string; grupo?: string; ico?: ReactNode };

/** Una ficha o un botón que abre la lista de campos, como los selectores del panel de Looker. */
function Elegir({ boton, opciones, onElegir, pie }: { boton: ReactNode; opciones: OpcionElegir[]; onElegir: (id: string) => void; pie?: { texto: string; onClick: () => void } }) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const [q, setQ] = useState('');
  const lista = opciones.filter((o) => !q.trim() || norm(`${o.nombre} ${o.grupo ?? ''}`).includes(norm(q.trim())));
  let grupoAnterior: string | undefined;
  return (
    <>
      <button type="button" className="lk-elegir" aria-haspopup="listbox" aria-expanded={!!ancla} onClick={(e) => { const t = e.currentTarget; setQ(''); setAncla((a) => (a ? null : t)); }}>
        {boton}
      </button>
      {ancla && (
        <Flotante ancla={ancla} onCerrar={() => setAncla(null)} ancho={260}>
          <div className="lk-lista" role="listbox">
            {opciones.length > 7 && <div className="lk-buscar lk-buscar--lista"><SvgLupa /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" autoFocus /></div>}
            {lista.map((o) => {
              const cab = o.grupo && o.grupo !== grupoAnterior ? <div key={`g-${o.grupo}`} className="lk-lista-grupo">{o.grupo}</div> : null;
              grupoAnterior = o.grupo;
              return (
                <div key={o.id}>
                  {cab}
                  <button type="button" role="option" aria-selected={false} className="lk-opcion" onClick={() => { setAncla(null); onElegir(o.id); }}>
                    {o.ico} <span>{o.nombre}</span>
                  </button>
                </div>
              );
            })}
            {pie && <button type="button" className="lk-opcion lk-opcion--pie" onClick={() => { setAncla(null); pie.onClick(); }}>{pie.texto}</button>}
          </div>
        </Flotante>
      )}
    </>
  );
}

function Seccion({ titulo, zona, children }: { titulo: string; zona?: Zona; children: ReactNode }) {
  return <div className="lk-seccion" {...zona}><div className="lk-seccion-tit">{titulo}</div>{children}</div>;
}
/** La ficha de un campo: verde la dimensión, azul la métrica, como en Looker. */
function Ficha({ clase, ico, texto }: { clase: 'dim' | 'met'; ico: ReactNode; texto: string }) {
  return <span className={`lk-ficha lk-ficha--${clase}`}>{ico && <span className="lk-ficha-ico">{ico}</span>}<span className="lk-ficha-txt">{texto}</span></span>;
}
/** El ícono del tipo de una dimensión: el calendario para el tiempo, «ABC» para el texto. */
function TipoCampo({ d }: { d: Dimension }) {
  return d.clase === 'tiempo' ? <SvgCalendario /> : <span className="lk-tipo-campo">ABC</span>;
}
/** La insignia de la agregación: SUM si se suma, CTD si cuenta distintos, AUT si la calcula MaKo. */
function Agregacion({ m }: { m?: Metrica }) {
  return <span className="lk-agg">{m?.razon ? 'AUT' : m?.distinto ? 'CTD' : 'SUM'}</span>;
}

/** El dibujito de cada tipo de gráfico, para la galería y el panel (en los colores de Looker). */
function IconoTipo({ tipo, size = 34 }: { tipo: string; size?: number }) {
  const s: CSSProperties = { width: size, height: size * 0.82, flex: 'none' };
  const A = '#4285F4', B = '#FA7B17', C = '#A142F4', G = '#9AA0A6', L = '#DADCE0';
  const caja = (hijos: ReactNode) => <svg viewBox="0 0 40 32" style={s} fill="none" aria-hidden>{hijos}</svg>;
  const filasTabla = (extra?: ReactNode) => caja(<>{[6, 12, 18, 24].map((y) => <rect key={y} x="4" y={y} width="32" height="3" rx="1" fill={L} />)}<rect x="4" y="2" width="32" height="3" rx="1" fill={G} />{extra}</>);
  switch (tipo) {
    case 'tabla': return filasTabla();
    case 'tabla_barras': return filasTabla(<>{[6, 12, 18, 24].map((y, i) => <rect key={y} x="22" y={y} width={[12, 8, 5, 10][i]} height="3" fill={A} />)}</>);
    case 'tabla_calor': return filasTabla(<>{[6, 12, 18, 24].map((y, i) => <rect key={y} x="22" y={y} width="14" height="3" fill={A} opacity={[1, 0.6, 0.3, 0.8][i]} />)}</>);
    case 'numero': return caja(<><rect x="3" y="5" width="34" height="22" rx="2" stroke={L} /><text x="7" y="13" fontSize="5" fill={G}>Total</text><text x="7" y="23" fontSize="9" fill="#202124">1,168</text></>);
    case 'numero_compacto': return caja(<><rect x="3" y="5" width="34" height="22" rx="2" stroke={L} /><text x="7" y="13" fontSize="5" fill={G}>Sesiones</text><text x="7" y="23" fontSize="9" fill="#202124">69.3K</text></>);
    case 'numero_tendencia': return caja(<><rect x="3" y="5" width="34" height="22" rx="2" stroke={L} /><text x="7" y="15" fontSize="8" fill="#202124">812</text><path d="M7 23l6-3 5 2 6-5 6 2 5-4" stroke={A} strokeWidth="1.6" /></>);
    case 'serie': case 'lineas': return caja(<path d="M3 24l8-7 7 4 8-10 11 4" stroke={A} strokeWidth="2" strokeLinejoin="round" />);
    case 'serie_sparkline': return caja(<path d="M3 18l3-4 3 5 3-6 3 7 3-3 3 2 3-6 3 5 3-3 3 4 3-2" stroke={A} strokeWidth="1.6" />);
    case 'serie_suave': case 'lineas_suaves': return caja(<path d="M3 24c6 0 6-9 12-9s6 6 12 1 6-7 10-9" stroke={A} strokeWidth="2" />);
    case 'columnas': return caja(<>{[5, 11, 17, 23, 29].map((x, i) => <rect key={x} x={x} y={[16, 10, 18, 8, 14][i]} width="4" height={28 - [16, 10, 18, 8, 14][i]} fill={A} />)}</>);
    case 'columnas_apiladas': return caja(<>{[5, 11, 17, 23, 29].map((x, i) => <g key={x}><rect x={x} y={[16, 10, 18, 8, 14][i]} width="4" height="6" fill={B} /><rect x={x} y={[22, 16, 24, 14, 20][i]} width="4" height={28 - [22, 16, 24, 14, 20][i]} fill={A} /></g>)}</>);
    case 'columnas_100': return caja(<>{[5, 11, 17, 23, 29].map((x, i) => <g key={x}><rect x={x} y="4" width="4" height={[8, 12, 6, 10, 9][i]} fill={C} /><rect x={x} y={4 + [8, 12, 6, 10, 9][i]} width="4" height="7" fill={B} /><rect x={x} y={11 + [8, 12, 6, 10, 9][i]} width="4" height={17 - [8, 12, 6, 10, 9][i]} fill={A} /></g>)}</>);
    case 'barras': return caja(<>{[5, 11, 17, 23].map((y, i) => <rect key={y} x="4" y={y} width={[30, 22, 16, 10][i]} height="4" fill={A} />)}</>);
    case 'barras_apiladas': return caja(<>{[5, 11, 17, 23].map((y, i) => <g key={y}><rect x="4" y={y} width={[18, 14, 10, 6][i]} height="4" fill={A} /><rect x={4 + [18, 14, 10, 6][i]} y={y} width="8" height="4" fill={B} /></g>)}</>);
    case 'barras_100': return caja(<>{[5, 11, 17, 23].map((y, i) => <g key={y}><rect x="4" y={y} width={[16, 12, 20, 10][i]} height="4" fill={A} /><rect x={4 + [16, 12, 20, 10][i]} y={y} width="8" height="4" fill={B} /><rect x={12 + [16, 12, 20, 10][i]} y={y} width={24 - [16, 12, 20, 10][i]} height="4" fill={C} /></g>)}</>);
    case 'histograma': return caja(<>{[4, 10, 16, 22, 28].map((x, i) => <rect key={x} x={x} y={[20, 12, 6, 14, 22][i]} width="6" height={28 - [20, 12, 6, 14, 22][i]} fill={A} stroke="#fff" />)}<path d="M4 18c6-8 10-14 14-14s10 10 18 16" stroke={B} strokeWidth="1.4" /></>);
    case 'circular': return caja(<><circle cx="20" cy="16" r="12" fill={A} /><path d="M20 16V4a12 12 0 0 1 10.4 18Z" fill={B} /><path d="M20 16l10.4 6A12 12 0 0 1 14 26.4Z" fill={C} /></>);
    case 'anillo': return caja(<><circle cx="20" cy="16" r="10" stroke={A} strokeWidth="5" /><path d="M20 6a10 10 0 0 1 8.7 15" stroke={B} strokeWidth="5" /></>);
    case 'combinado': return caja(<>{[5, 13, 21, 29].map((x, i) => <rect key={x} x={x} y={[14, 18, 10, 16][i]} width="5" height={28 - [14, 18, 10, 16][i]} fill={A} />)}<path d="M7 12l8-4 8 6 8-8" stroke={B} strokeWidth="2" /></>);
    case 'combinado_apilado': return caja(<>{[5, 13, 21, 29].map((x, i) => <g key={x}><rect x={x} y={[14, 18, 10, 16][i]} width="5" height="5" fill={C} /><rect x={x} y={[19, 23, 15, 21][i]} width="5" height={28 - [19, 23, 15, 21][i]} fill={A} /></g>)}<path d="M7 10l8-4 8 6 8-8" stroke={B} strokeWidth="2" /></>);
    case 'area': return caja(<path d="M3 28V20l8-6 8 4 9-9 9 5v14Z" fill={A} opacity=".5" stroke={A} />);
    case 'area_apilada': return caja(<><path d="M3 28V18l8-6 8 4 9-9 9 5v16Z" fill={B} opacity=".6" /><path d="M3 28v-5l8-3 8 2 9-5 9 3v8Z" fill={A} opacity=".8" /></>);
    case 'area_100': return caja(<><rect x="3" y="4" width="34" height="24" fill={C} opacity=".5" /><path d="M3 28V14l8-4 8 5 9-7 9 4v16Z" fill={B} opacity=".7" /><path d="M3 28v-6l8-2 8 3 9-4 9 2v7Z" fill={A} /></>);
    case 'dispersion': return caja(<>{[[8, 22], [12, 16], [17, 19], [21, 11], [26, 14], [31, 7], [15, 24], [28, 20]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill={A} />)}</>);
    case 'burbujas': return caja(<>{[[9, 20, 4], [18, 12, 6], [28, 18, 3], [30, 8, 2.5], [14, 25, 2]].map(([x, y, rr]) => <circle key={`${x}${y}`} cx={x} cy={y} r={rr} fill={A} opacity=".75" />)}</>);
    case 'dinamica': return caja(<>{[4, 10, 16, 22].map((y) => <rect key={y} x="4" y={y + 2} width="32" height="3" rx="1" fill={L} />)}<rect x="4" y="2" width="9" height="24" fill={G} opacity=".4" /></>);
    case 'dinamica_barras': return caja(<>{[4, 10, 16, 22].map((y, i) => <g key={y}><rect x="4" y={y + 2} width="32" height="3" rx="1" fill={L} /><rect x="16" y={y + 2} width={[14, 8, 18, 5][i]} height="3" fill={A} /></g>)}</>);
    case 'dinamica_calor': return caja(<>{[4, 10, 16, 22].map((y, i) => [16, 23, 30].map((x, j) => <rect key={`${y}${x}`} x={x} y={y + 2} width="6" height="4" fill={A} opacity={[[1, 0.4, 0.2], [0.6, 0.9, 0.3], [0.2, 0.5, 1], [0.8, 0.3, 0.6]][i][j]} />))}<rect x="4" y="2" width="9" height="24" fill={G} opacity=".4" /></>);
    case 'bala': return caja(<><rect x="3" y="11" width="34" height="10" fill={L} /><rect x="3" y="14" width="22" height="4" fill={A} /><rect x="28" y="9" width="2" height="14" fill="#202124" /></>);
    case 'rectangulos': return caja(<><rect x="3" y="4" width="18" height="24" fill={A} /><rect x="22" y="4" width="15" height="12" fill={B} /><rect x="22" y="17" width="7" height="11" fill={C} /><rect x="30" y="17" width="7" height="11" fill="#34A853" /></>);
    case 'sankey': return caja(<><rect x="3" y="4" width="3" height="10" fill={A} /><rect x="3" y="17" width="3" height="11" fill={B} /><rect x="34" y="4" width="3" height="14" fill={C} /><rect x="34" y="20" width="3" height="8" fill="#34A853" /><path d="M6 9c14 0 14 2 28 2M6 22c14 0 14-11 28-11M6 25c14 0 14 0 28-1" stroke={A} strokeWidth="3" opacity=".35" /></>);
    case 'indicador': return caja(<><path d="M6 26a14 14 0 0 1 28 0" stroke={L} strokeWidth="6" /><path d="M6 26a14 14 0 0 1 20-12.6" stroke={A} strokeWidth="6" /></>);
    case 'indicador_rangos': return caja(<><path d="M6 26a14 14 0 0 1 4-9.9" stroke="#EA4335" strokeWidth="6" /><path d="M10 16.1a14 14 0 0 1 19.8 0" stroke="#FBBC04" strokeWidth="6" /><path d="M29.8 16.1A14 14 0 0 1 34 26" stroke="#34A853" strokeWidth="6" /><path d="M20 26l6-10" stroke="#202124" strokeWidth="1.6" /></>);
    case 'cascada': return caja(<><rect x="4" y="16" width="5" height="12" fill={A} /><rect x="11" y="10" width="5" height="6" fill="#34A853" /><rect x="18" y="10" width="5" height="5" fill="#EA4335" /><rect x="25" y="5" width="5" height="10" fill="#34A853" /><rect x="32" y="5" width="5" height="23" fill={A} /></>);
    case 'cronologia': return caja(<><rect x="5" y="5" width="16" height="4" fill={A} /><rect x="12" y="12" width="20" height="4" fill={B} /><rect x="8" y="19" width="10" height="4" fill={C} /><rect x="22" y="26" width="13" height="3" fill="#34A853" /></>);
    case 'embudo': return caja(<><path d="M4 4h32l-4 7H8Z" fill={A} /><path d="M9 12h22l-3 7H12Z" fill={B} /><path d="M13 20h14l-3 7h-8Z" fill={C} /></>);
    case 'embudo_vertical': return caja(<><path d="M5 3h30l-4 6H9Z" fill={A} /><rect x="17" y="10.5" width="6" height="2" rx="1" fill={C} /><path d="M10 14h20l-3 6H13Z" fill={B} /><rect x="17" y="21.5" width="6" height="2" rx="1" fill={C} /><path d="M14 25h12l-2 4h-8Z" fill={C} /></>);
    case 'embudo_barras': return caja(<><rect x="4" y="5" width="32" height="6" fill={A} /><rect x="9" y="13" width="22" height="6" fill={B} /><rect x="14" y="21" width="12" height="6" fill={C} /></>);
    case 'embudo_columnas': return caja(<><rect x="4" y="4" width="8" height="24" fill={A} /><rect x="16" y="12" width="8" height="16" fill={B} /><rect x="28" y="19" width="8" height="9" fill={C} /></>);
    default: return caja(<rect x="4" y="4" width="32" height="24" stroke={L} />);
  }
}

// ── Íconos de la barra (trazos de Material, a 20 px) ────────────────────────────────────────
const svg = (d: ReactNode, extra?: CSSProperties) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={extra} aria-hidden>{d}</svg>;
const SvgDeshacer = ({ espejo }: { espejo?: boolean }) => svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>, espejo ? { transform: 'scaleX(-1)' } : undefined);
const SvgPagina = () => svg(<><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8Z" /><path d="M14 3v5h5M12 11v6M9 14h6" /></>);
const SvgAgregarDatos = () => svg(<><rect x="3" y="4" width="13" height="16" rx="1.5" /><path d="M6.5 8.5h6M6.5 12h6M6.5 15.5h3.5M19 9v6M16 12h6" /></>);
const SvgAgregarGrafico = () => svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7.5 16.5v-4M12 16.5v-8M16.5 16.5v-6" /></>);
const SvgControl = () => svg(<><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>);
const SvgFlecha = ({ arriba }: { arriba?: boolean }) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden style={arriba ? { transform: 'rotate(180deg)' } : undefined}><path d="M7 10l5 5 5-5z" /></svg>;
const SvgReset = () => svg(<><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4h4" /></>);
const SvgOjo = () => svg(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
const SvgLapiz = () => svg(<><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>);
const SvgLupa = () => svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>);
const SvgDatos = () => svg(<><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 9h16M4 14h16M9 9v11" /></>);
const SvgCalendario = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>;
const SvgLogo = () => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden><circle cx="7" cy="16" r="3.2" stroke="#4285F4" strokeWidth="2" /><circle cx="16.5" cy="7.5" r="3.2" stroke="#4285F4" strokeWidth="2" /><path d="M9.3 13.7l4.9-4" stroke="#4285F4" strokeWidth="2" /><circle cx="18" cy="17" r="2.2" fill="#FBBC04" /></svg>;
const SvgEmpecemos = () => (
  <svg viewBox="0 0 120 90" width="140" height="105" fill="none" aria-hidden>
    <circle cx="20" cy="30" r="4" fill="#FBBC04" /><circle cx="100" cy="14" r="3" fill="#34A853" /><circle cx="104" cy="74" r="4" fill="#4285F4" /><circle cx="16" cy="64" r="7" fill="#EA4335" />
    <rect x="36" y="44" width="10" height="30" rx="1" stroke="#202124" strokeWidth="2" /><rect x="52" y="34" width="10" height="40" rx="1" stroke="#202124" strokeWidth="2" /><rect x="68" y="50" width="10" height="24" rx="1" stroke="#202124" strokeWidth="2" />
    <path d="M30 40l18-14 14 8 20-16" stroke="#202124" strokeWidth="2" /><circle cx="48" cy="26" r="4" fill="#fff" stroke="#202124" strokeWidth="2" /><circle cx="62" cy="34" r="4" fill="#fff" stroke="#202124" strokeWidth="2" /><circle cx="82" cy="18" r="4" fill="#fff" stroke="#202124" strokeWidth="2" />
  </svg>
);

// ── Los valores de Looker Studio, limitados a `.lk` ─────────────────────────────────────────
const CSS = `
.lk { --lk-azul: #1a73e8; --lk-azul-claro: #e8f0fe; --lk-verde: #188038; --lk-verde-claro: #e6f4ea; --lk-tinta: #202124; --lk-gris: #5f6368; --lk-borde: #dadce0; --lk-barra: #f0f4f9; --lk-lienzo: #e8eaed; font-family: Roboto, 'Google Sans', Arial, sans-serif; color: var(--lk-tinta); }
.lk button { font-family: inherit; }
.lk-app { height: 100vh; display: flex; flex-direction: column; background: #f8fafd; min-width: 0; }
.lk-cabecera { display: flex; align-items: center; gap: 10px; padding: 10px 18px 6px; flex: none; }
.lk-logo { display: grid; place-items: center; width: 34px; height: 34px; flex: none; }
.lk-nombre { font: inherit; font-size: 18px; color: var(--lk-tinta); border: 1px solid transparent; border-radius: 4px; padding: 4px 6px; min-width: 0; width: 320px; max-width: 40vw; background: transparent; }
.lk--editando .lk-nombre:hover { border-color: var(--lk-borde); }
.lk--editando .lk-nombre:focus { outline: none; border-color: var(--lk-azul); background: #fff; }
.lk-nombre[readonly] { cursor: default; }
.lk-guardado { font-size: 12.5px; color: var(--lk-gris); }
.lk-guardado[data-error] { color: #d93025; }
.lk-acciones { margin-left: auto; display: flex; gap: 10px; }
.lk-pill { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 18px; border-radius: 18px; border: 1px solid var(--lk-borde); background: #fff; color: var(--lk-gris); font-size: 14px; font-weight: 500; cursor: pointer; }
.lk-pill:hover:not(:disabled) { background: #f8f9fa; }
.lk-pill:disabled { opacity: .5; cursor: default; }
.lk-pill--azul { background: var(--lk-azul); border-color: var(--lk-azul); color: #fff; }
.lk-pill--azul:hover:not(:disabled) { background: #1765cc; }
.lk-pill--rojo { color: #d93025; }
.lk-barra { display: flex; align-items: center; gap: 2px; background: var(--lk-barra); border-radius: 24px; padding: 4px 10px; margin: 0 16px 6px; flex-wrap: wrap; flex: none; }
.lk-herr { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: none; border-radius: 18px; background: transparent; color: #3c4043; font-size: 14px; cursor: pointer; }
.lk-herr:hover:not(:disabled) { background: rgba(60,64,67,.08); }
.lk-herr:disabled { color: #bdc1c6; cursor: default; }
.lk-herr--icono { width: 36px; padding: 0; justify-content: center; }
.lk-sep { width: 1px; height: 22px; background: var(--lk-borde); margin: 0 6px; }
.lk-hojas { display: flex; align-items: center; gap: 2px; padding: 0 16px; flex: none; min-height: 38px; flex-wrap: wrap; border-bottom: 1px solid var(--lk-borde); }
.lk-hoja-tab { display: inline-flex; align-items: center; position: relative; }
.lk-hoja-btn { border: none; background: transparent; padding: 9px 12px 8px; font-size: 14px; color: var(--lk-gris); cursor: pointer; border-bottom: 3px solid transparent; }
.lk-hoja-tab[aria-selected="true"] .lk-hoja-btn { color: var(--lk-azul); border-bottom-color: var(--lk-azul); font-weight: 500; }
.lk-hoja-btn:hover { color: var(--lk-tinta); }
.lk-hoja-mas { border: none; background: transparent; width: 24px; height: 28px; border-radius: 14px; color: var(--lk-gris); cursor: pointer; font-size: 16px; }
.lk-hoja-mas:hover { background: rgba(60,64,67,.08); }
.lk-hoja-input { font: inherit; font-size: 14px; border: 1px solid var(--lk-azul); border-radius: 4px; padding: 5px 8px; width: 160px; outline: none; }
.lk-hoja-sep { width: 1px; height: 16px; background: var(--lk-borde); margin: 0 2px; }
.lk-hoja-nueva { border: none; background: transparent; width: 32px; height: 32px; border-radius: 16px; font-size: 18px; color: var(--lk-gris); cursor: pointer; margin-left: 4px; }
.lk-hoja-nueva:hover { background: rgba(60,64,67,.08); color: var(--lk-tinta); }
.lk-cuerpo { flex: 1; min-height: 0; display: flex; align-items: stretch; }
.lk-lienzo { flex: 1; min-width: 0; background: var(--lk-lienzo); padding: 24px; overflow: auto; }
.lk-pagina { background: var(--bg); min-height: calc(100% - 4px); padding: 20px; box-shadow: 0 1px 2px rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15); box-sizing: border-box; }
.lk-pagina[data-soltar] { outline: 2px dashed var(--lk-azul); outline-offset: -6px; }
.lk-vacio { display: grid; place-items: center; gap: 12px; padding: 140px 0; color: var(--lk-gris); font-size: 14px; }
.lk-vacio p { margin: 0; }
/* Las tarjetas son las de MaKo (las KPI y las secciones de las tabs viejas): Geist, la tinta de la
   app, borde var(--border) y esquinas de 16. El cromo de alrededor sigue siendo el de Looker. */
.lk-comp { display: flex; flex-direction: column; gap: 10px; padding: 20px 22px; box-sizing: border-box; background: var(--surface); border: 1px solid transparent; overflow: hidden; font-family: 'Geist', system-ui, sans-serif; color: var(--ink); }
.lk-comp--borde { border-color: var(--border); }
/* Como las KPI viejas: el rótulo y el número van juntos y centrados en la tarjeta, por alta que sea. */
.lk-comp--kpi { justify-content: center; }
.lk--editando .lk-comp { cursor: move; }
.lk--editando .lk-comp:hover { outline: 1px solid var(--lk-borde); }
.lk-comp--sel, .lk--editando .lk-comp--sel:hover { outline: 2px solid var(--lk-azul) !important; outline-offset: -1px; }
.lk-comp--soltar { outline: 2px solid var(--lk-azul) !important; background: var(--lk-azul-claro) !important; }
.lk-comp--control { padding: 4px; justify-content: center; }
.lk-comp-tit { display: flex; align-items: center; gap: 6px; min-width: 0; font-weight: 600; letter-spacing: -0.015em; color: var(--ink); line-height: 1.2; }
.lk-comp-tit span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-comp-tit--s { font-size: 15px; } .lk-comp-tit--m { font-size: 19px; } .lk-comp-tit--l { font-size: 23px; }
/* El rótulo de la KPI: mono, mayúsculas, espaciado, en gris. */
.lk-comp--kpi .lk-comp-tit { font-family: 'Geist Mono', monospace; font-weight: 400; text-transform: uppercase; letter-spacing: .1em; color: var(--dim); margin-bottom: 8px; }
.lk-comp--kpi .lk-comp-tit--s { font-size: 11px; } .lk-comp--kpi .lk-comp-tit--m { font-size: 12px; } .lk-comp--kpi .lk-comp-tit--l { font-size: 13px; }
.lk-comp-sub { margin-top: -6px; font-size: 13px; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lk-mini-giro { width: 10px; height: 10px; border: 2px solid var(--lk-borde); border-top-color: var(--lk-azul); border-radius: 50%; animation: lkGiro .8s linear infinite; flex: none; }
@keyframes lkGiro { to { transform: rotate(360deg); } }
.lk .recharts-wrapper *:focus, .lk .recharts-surface:focus { outline: none; }
.lk .react-grid-item.react-grid-placeholder { background: var(--lk-azul); opacity: .15; border-radius: 0; }
.lk .react-grid-item > .react-resizable-handle { opacity: 0; }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle { opacity: 1; }
.lk-control { display: flex; align-items: center; gap: 8px; width: 100%; height: 100%; border: 1px solid var(--lk-borde); border-radius: 4px; background: #fff; padding: 0 10px; font-size: 14px; color: var(--lk-tinta); cursor: pointer; }
.lk-control:hover { background: #f8f9fa; }
.lk-control-txt { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-panel { flex: none; background: #fff; border-left: 1px solid var(--lk-borde); overflow-y: auto; box-sizing: border-box; }
.lk-props { width: 300px; padding: 0 0 16px; }
.lk-datos { width: 256px; padding: 0 0 12px; display: flex; flex-direction: column; }
.lk-datos-lista { flex: 1; overflow-y: auto; }
.lk-empecemos { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 48px 22px; }
.lk-empecemos h3 { margin: 10px 0 8px; font-size: 17px; font-weight: 500; }
.lk-empecemos p { margin: 0; font-size: 14px; color: #3c4043; line-height: 1.45; }
.lk-panel-tit { display: flex; align-items: center; gap: 8px; font-size: 16px; padding: 14px 16px 10px; }
.lk-ayuda { margin: 6px 0 0; font-size: 12.5px; color: var(--lk-gris); line-height: 1.45; }
.lk-props-tipo { display: flex; align-items: center; gap: 8px; padding: 12px 12px 8px 16px; }
.lk-props-nombre { font-size: 15px; font-weight: 500; }
.lk-tipo-btn { display: inline-flex; align-items: center; gap: 2px; border: none; background: transparent; font-size: 15px; color: var(--lk-tinta); padding: 4px 6px; border-radius: 4px; cursor: pointer; }
.lk-tipo-btn:hover { background: rgba(60,64,67,.08); }
.lk-tabs { display: flex; border-bottom: 1px solid var(--lk-borde); padding: 0 8px; }
.lk-tabs button { flex: 1; height: 40px; border: none; background: transparent; font-size: 13px; font-weight: 500; letter-spacing: .03em; text-transform: uppercase; color: var(--lk-gris); border-bottom: 3px solid transparent; cursor: pointer; }
.lk-tabs button[aria-selected="true"] { color: var(--lk-azul); border-bottom-color: var(--lk-azul); }
.lk-secciones { display: flex; flex-direction: column; }
.lk-seccion { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border-bottom: 1px solid #f1f3f4; }
.lk-seccion[data-soltar] { background: var(--lk-azul-claro); }
.lk-seccion-tit { font-size: 12px; font-weight: 500; color: var(--lk-gris); }
.lk-sub { font-size: 12px; color: var(--lk-gris); margin-top: 2px; }
.lk-elegir { display: flex; width: 100%; border: none; background: transparent; padding: 0; text-align: left; cursor: pointer; min-width: 0; }
.lk-fuente { display: flex; align-items: center; gap: 8px; width: 100%; font-size: 14px; color: var(--lk-tinta); padding: 6px 8px; border-radius: 4px; border: 1px solid var(--lk-borde); min-width: 0; }
.lk-fuente-nom { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-elegir:hover .lk-fuente { background: #f8f9fa; }
.lk-fuente-ico { width: 22px; height: 22px; border-radius: 5px; display: grid; place-items: center; color: #fff; flex: none; }
.lk-fuente-ico--chico { width: 18px; height: 18px; border-radius: 4px; }
.lk-fichas { display: flex; flex-direction: column; gap: 6px; }
.lk-ficha-fila { display: flex; align-items: center; gap: 4px; }
.lk-ficha-fila .lk-elegir { flex: 1; }
.lk-ficha { display: flex; align-items: center; width: 100%; height: 30px; border-radius: 15px; overflow: hidden; font-size: 13.5px; min-width: 0; }
.lk-ficha--dim { background: var(--lk-verde-claro); color: #137333; }
.lk-ficha--met { background: var(--lk-azul-claro); color: #1967d2; }
.lk-ficha-ico { display: grid; place-items: center; min-width: 34px; height: 100%; padding: 0 6px; box-sizing: border-box; }
.lk-ficha--dim .lk-ficha-ico { background: #ceead6; }
.lk-ficha--met .lk-ficha-ico { background: #d2e3fc; }
.lk-ficha-txt { padding: 0 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-elegir:hover .lk-ficha { filter: brightness(.97); }
.lk-agg, .lk-tipo-campo { font-size: 10px; font-weight: 700; letter-spacing: .02em; }
.lk-agregar { display: inline-flex; align-items: center; height: 28px; padding: 0 4px; font-size: 13.5px; color: var(--lk-azul); font-weight: 500; border: none; background: none; cursor: pointer; align-self: flex-start; }
.lk-agregar--bloque { margin: 8px 12px 0; }
.lk-quitar { flex: none; width: 26px; height: 26px; border: none; border-radius: 50%; background: transparent; color: var(--lk-gris); cursor: pointer; font-size: 13px; }
.lk-quitar:hover { background: rgba(60,64,67,.08); color: var(--lk-tinta); }
.lk-radios { display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; }
.lk-radios label, .lk-check { display: flex; align-items: center; gap: 8px; font-size: 13.5px; }
.lk-radios input, .lk-check input { accent-color: var(--lk-azul); margin: 0; }
.lk-input { width: 100%; box-sizing: border-box; height: 34px; border: 1px solid var(--lk-borde); border-radius: 4px; padding: 0 10px; font: inherit; font-size: 14px; color: var(--lk-tinta); background: #fff; }
.lk-input:focus { outline: none; border-color: var(--lk-azul); }
.lk-select { display: inline-flex; align-items: center; justify-content: space-between; width: 100%; height: 34px; border: 1px solid var(--lk-borde); border-radius: 4px; padding: 0 6px 0 10px; font-size: 14px; color: var(--lk-tinta); }
.lk-segmento { display: flex; border: 1px solid var(--lk-borde); border-radius: 4px; overflow: hidden; }
.lk-segmento button { flex: 1; height: 30px; border: none; border-right: 1px solid var(--lk-borde); background: #fff; font-size: 12.5px; color: var(--lk-gris); cursor: pointer; }
.lk-segmento button:last-child { border-right: none; }
.lk-segmento button[aria-pressed="true"] { background: var(--lk-azul-claro); color: #1967d2; font-weight: 500; }
.lk-colores { display: flex; flex-wrap: wrap; gap: 6px; }
.lk-color input { width: 28px; height: 28px; padding: 0; border: 1px solid var(--lk-borde); border-radius: 4px; background: none; cursor: pointer; }
.lk-color-input { width: 44px; height: 28px; padding: 0; border: 1px solid var(--lk-borde); border-radius: 4px; cursor: pointer; }
.lk-campo-num { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13.5px; }
.lk-campo-num .lk-input { width: 130px; }
.lk-fechas { display: flex; flex-direction: column; gap: 6px; padding: 6px 12px 4px; font-size: 12.5px; color: var(--lk-gris); }
.lk-seccion .lk-fechas { padding: 0; }
.lk-fechas label { display: flex; flex-direction: column; gap: 3px; }
.lk-botones { display: flex; gap: 10px; padding: 16px; }
.lk-buscar { display: flex; align-items: center; gap: 8px; margin: 0 12px 8px; height: 36px; padding: 0 12px; border: none; border-radius: 18px; background: #e9eef6; color: var(--lk-gris); }
.lk-buscar input { flex: 1; min-width: 0; border: none; outline: none; font: inherit; font-size: 14px; background: transparent; color: var(--lk-tinta); }
.lk-buscar--lista { margin: 4px 8px 6px; }
.lk-buscar--modal { margin: 0 24px 12px; height: 44px; border-radius: 22px; flex: none; }
.lk-darea-tit { font-size: 11.5px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; color: var(--lk-gris); padding: 12px 16px 4px; }
.lk-dfuente-tit { display: flex; align-items: center; gap: 8px; width: 100%; border: none; background: transparent; padding: 7px 12px; font-size: 13.5px; color: var(--lk-tinta); cursor: pointer; text-align: left; }
.lk-dfuente-tit:hover { background: #f1f3f4; }
.lk-dfuente[data-elegida] > .lk-dfuente-tit { font-weight: 500; }
.lk-dfuente-nom { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-campos { list-style: none; margin: 0 0 6px; padding: 0; }
.lk-campo { display: flex; align-items: center; gap: 8px; padding: 5px 12px 5px 22px; font-size: 13.5px; cursor: grab; user-select: none; }
.lk-campo:hover { background: #f1f3f4; }
.lk-campo--dim { color: var(--lk-verde); }
.lk-campo--met { color: var(--lk-azul); }
.lk-campo .lk-tipo-campo, .lk-campo svg { width: 26px; text-align: center; flex: none; }
.lk-riel { flex: none; width: 72px; background: #fff; border-left: 1px solid var(--lk-borde); display: flex; flex-direction: column; gap: 6px; padding: 8px 6px; }
.lk-riel button { display: flex; flex-direction: column; align-items: center; gap: 3px; border: none; border-radius: 10px; background: transparent; padding: 8px 2px; font-size: 11.5px; color: var(--lk-gris); cursor: pointer; }
.lk-riel button[aria-pressed="true"] { background: #d3e3fd; color: #041e49; }
.lk-flotante { position: fixed; z-index: 580; background: #fff; border-radius: 6px; box-shadow: 0 2px 6px 2px rgba(60,64,67,.15), 0 1px 2px rgba(60,64,67,.3); padding: 6px 0; overflow-y: auto; }
.lk-lista { display: flex; flex-direction: column; }
.lk-lista-grupo { font-size: 11.5px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; color: var(--lk-gris); padding: 10px 16px 4px; }
.lk-opcion { display: flex; align-items: center; gap: 10px; width: 100%; border: none; background: transparent; padding: 8px 16px; font-size: 14px; color: var(--lk-tinta); text-align: left; cursor: pointer; }
.lk-opcion:hover:not(:disabled) { background: #f1f3f4; }
.lk-opcion:disabled { color: #bdc1c6; cursor: default; }
.lk-opcion[aria-selected="true"] { background: var(--lk-azul-claro); color: #1967d2; }
.lk-opcion--pie { color: var(--lk-azul); border-top: 1px solid var(--lk-borde); margin-top: 4px; }
.lk-opcion .lk-agg, .lk-opcion .lk-tipo-campo { width: 30px; color: var(--lk-gris); }
.lk-galeria { padding: 4px 12px 10px; }
.lk-galeria-tit { font-size: 13px; color: var(--lk-tinta); margin: 10px 0 6px; }
.lk-galeria-fila { display: flex; flex-wrap: wrap; gap: 6px; }
.lk-galeria-tipo { display: grid; place-items: center; width: 50px; height: 42px; border: 1px solid #e3e3e3; border-radius: 4px; background: #fff; cursor: pointer; padding: 0; }
.lk-galeria-tipo:hover { border-color: var(--lk-azul); box-shadow: 0 0 0 1px var(--lk-azul); }
.lk-galeria-tipo[data-actual] { border-color: var(--lk-azul); background: var(--lk-azul-claro); }
.lk-velo { position: fixed; inset: 0; z-index: 560; background: rgba(32,33,36,.4); display: grid; place-items: center; padding: 16px; }
.lk-modal { width: min(640px, 100%); max-height: min(720px, 90vh); background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(60,64,67,.3); display: flex; flex-direction: column; }
.lk-modal-cab { display: flex; align-items: center; padding: 16px 16px 12px 24px; }
.lk-modal-cab h2 { margin: 0; flex: 1; font-size: 20px; font-weight: 400; }
.lk-cerrar { border: none; background: transparent; font-size: 20px; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; color: var(--lk-tinta); }
.lk-cerrar:hover { background: rgba(60,64,67,.08); }
.lk-modal-cuerpo { overflow-y: auto; padding: 0 12px 16px; }
.lk-dato { display: flex; align-items: center; gap: 14px; width: 100%; border: none; background: transparent; padding: 10px 12px; border-radius: 8px; text-align: left; cursor: pointer; }
.lk-dato:hover { background: #f1f3f4; }
.lk-dato-txt { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lk-dato-nom { font-size: 15px; color: var(--lk-tinta); }
.lk-dato-desc { font-size: 13px; color: var(--lk-gris); }
.lk-dato-mas { font-size: 13.5px; color: var(--lk-azul); font-weight: 500; }
.lk-tabla { flex: 1; min-height: 0; overflow: auto; }
.lk-tabla table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.lk-tabla th { text-align: right; font-family: 'Geist Mono', monospace; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .08em; color: var(--dim); padding: 8px 10px; border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; white-space: nowrap; }
.lk-tabla td { text-align: right; padding: 9px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--ink); }
.lk-tabla .lk-tabla-izq { text-align: left; max-width: 240px; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
.lk-tabla tbody tr:hover td { background: var(--surface-2); }
.lk-tabla-total td { font-weight: 600; border-bottom: none; border-top: 1px solid var(--border-strong); }
.lk-tabla-fuerte { font-weight: 600; }
.lk-tabla-barra { min-width: 130px; }
.lk-celda-barra { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
.lk-celda-num { flex: none; min-width: 52px; text-align: right; }
.lk-celda-pista { flex: 1; min-width: 50px; max-width: 120px; height: 10px; display: flex; background: var(--surface-2); border-radius: 5px; overflow: hidden; }
.lk-celda-pista span { display: block; height: 100%; border-radius: 5px; }
.lk-tabla-mas { margin: 8px 10px 0; font-family: 'Geist Mono', monospace; font-size: 12px; color: var(--faint); }
@media (max-width: 1200px) { .lk-datos { width: 220px; } .lk-props { width: 270px; } }
@media (max-width: 980px) { .lk-datos { display: none; } }
@media (max-width: 760px) { .lk-props, .lk-riel { display: none; } .lk-nombre { width: 160px; } .lk-lienzo { padding: 12px; } }
`;
