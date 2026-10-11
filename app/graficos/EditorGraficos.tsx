'use client';

// =============================================================================
// EditorGraficos — «Mis gráficos»: el editor de informes copiado de Looker Studio
// =============================================================================
// Pedido de Martín (10/10/2026): «Puedes copiar la app de Google Data Studio para esto» y,
// con una captura del editor de Looker al lado, «No, no se ve igual al editor de Looker, te
// pido que lo hagas igual». Lo que se copió, pieza por pieza:
//
//   · La CABECERA del informe: su nombre (se edita tocándolo), «Restablecer» y el botón azul
//     «Ver» / «Editar», que alterna los dos modos de Looker.
//   · La BARRA DE HERRAMIENTAS gris: deshacer, rehacer, «Agregar datos» y «Agregar un
//     gráfico ▾», que abre la galería de tipos con los nombres de Looker.
//   · El LIENZO gris con la PÁGINA blanca adentro; los gráficos se arrastran y se agrandan
//     (react-grid-layout, MIT).
//   · El panel de PROPIEDADES con CONFIGURACIÓN y ESTILO: fuente de datos, dimensión del
//     período, la DIMENSIÓN en verde, las MÉTRICAS en azul con su «SUM» / «AUT», «Ordenar» y
//     «Período predeterminado».
//   · El panel DATOS: los campos de cada fuente del informe, que se arrastran a un gráfico, a
//     la configuración o a la página (una métrica suelta crea un cuadro de resultados, una
//     fecha una serie temporal y una dimensión una tabla, como en Looker).
//   · La hoja de abajo «Agregar datos al informe», con sus dos pestañas y los conectores.
//
// Lo que NO se copió, a propósito: campos calculados, filtros, combinar fuentes («Blend»),
// controles sobre la página y SQL libre. El período lo pone el filtro de arriba de Graphics.
//
// ⚠️ El CSS vive limitado a `.lk` (como el de GitHub en /api-mako): son los valores de Looker,
// no los de la casa, y no se «arregla» a los componentes de app/_ui.
//
// Guardado: solo, con un respiro, y por persona y workspace (lib/graficos-tablero.ts). Si la
// lectura del tablero falló, NO se guarda nada: el primer cambio pisaría el tablero real.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import Link from '@/app/_ui/Link';
import { Banner, Toast, useToast } from '@/app/_ui';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { usePilaDeshacer } from '@/app/_ui/usePilaDeshacer';
import {
  FUENTES, LIMITES, MAX_GRAFICOS, TIPOS, dimensionesPara, fuenteDe, fuentesDe, metricaDe, metricasPara, nuevoGrafico, nuevoId,
  sanearGrafico, tableroInicial, tituloDe, tipoDe, type Dimension, type FuenteId, type Grafico, type Metrica, type Tablero, type TipoGrafico,
} from '@/lib/graficos-catalogo';
import type { DatosGrafico } from '@/lib/graficos-datos';
import { CuerpoGrafico, type EstadoDatos } from './Grafico';

/** Lo que decide los DATOS de un gráfico. Moverlo o renombrarlo no vuelve a pedir nada. */
const firmaDe = (g: Grafico, desde: string, hasta: string) =>
  [g.tipo, g.fuente, g.fecha, g.dimension ?? '', g.metricas.join(','), g.limite, g.ordenMetrica ?? '', g.ordenAsc, desde, hasta].join('|');

const ICONO_FUENTE: Record<FuenteId, NombreIconoMenu> = { meta: 'anuncio', leads: 'persona', pagos: 'dinero' };
const COLOR_FUENTE: Record<FuenteId, string> = { meta: '#1877F2', leads: '#188038', pagos: '#E37400' };
const DESCRIPCION_FUENTE: Record<FuenteId, string> = {
  meta: 'Gasto, impresiones, clics, leads y agendas de tus anuncios de Meta.',
  leads: 'Los leads de tu CRM: cuándo entraron, si agendaron, asistieron y cerraron.',
  pagos: 'Las cuotas de tus clientes: cobradas, pendientes y vencidas.',
};
/** Un campo arrastrado desde el panel Datos. */
const MIME_CAMPO = 'application/x-mako-campo';
type Campo = { fuente: FuenteId; clase: 'dim' | 'met'; id: string };
/** Lo que una zona de la configuración necesita para recibir un campo arrastrado. */
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
  return !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');
}

export function EditorGraficos({ inicial, datosIniciales, lecturaFallo, metaConectada, desde, hasta }: {
  inicial: Tablero;
  datosIniciales: Record<string, DatosGrafico>;
  lecturaFallo: boolean;
  metaConectada: boolean;
  desde: string;
  hasta: string;
}) {
  const [tablero, setTablero] = useState<Tablero>(inicial);
  const tableroRef = useRef(tablero);
  tableroRef.current = tablero;
  const [editando, setEditando] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [menuGraficos, setMenuGraficos] = useState<HTMLElement | null>(null);
  const [hojaDatos, setHojaDatos] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const [guardado, setGuardado] = useState<'ok' | 'guardando' | 'error' | null>(null);
  const [soltandoEn, setSoltandoEn] = useState<string | null>(null);
  const [datos, setDatos] = useState<Record<string, EstadoDatos>>(() => {
    const o: Record<string, EstadoDatos> = {};
    for (const g of inicial.graficos) o[g.id] = aEstado(datosIniciales[g.id]);
    return o;
  });
  const { toast, show, clear } = useToast(6000);
  const { width, containerRef, mounted } = useContainerWidth();
  const guardable = !lecturaFallo;

  // ── Deshacer / rehacer, como la barra de Looker (y Ctrl+Z / Ctrl+Y) ──────────────────────
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

  // ── Datos: se piden de nuevo SÓLO los gráficos cuya firma cambió ─────────────────────────
  const firmaPedida = useRef<Record<string, string>>(
    Object.fromEntries(inicial.graficos.map((g) => [g.id, firmaDe(g, desde, hasta)])),
  );
  useEffect(() => {
    const pendientes = tablero.graficos.filter((g) => firmaPedida.current[g.id] !== firmaDe(g, desde, hasta));
    if (!pendientes.length) return;
    const t = setTimeout(async () => {
      const firmas: Record<string, string> = {};
      for (const g of pendientes) { firmas[g.id] = firmaDe(g, desde, hasta); firmaPedida.current[g.id] = firmas[g.id]; }
      setDatos((prev) => {
        const n = { ...prev };
        for (const g of pendientes) n[g.id] = { ...(n[g.id] ?? {}), cargando: true };
        return n;
      });
      let respuesta: Record<string, DatosGrafico> = {};
      let fallo = false;
      try {
        const r = await fetch('/api/graficos', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ accion: 'datos', graficos: pendientes, desde, hasta }),
          signal: AbortSignal.timeout(65_000),
        });
        if (!r.ok) fallo = true; else respuesta = (await r.json()).datos ?? {};
      } catch { fallo = true; }
      setDatos((prev) => {
        const n = { ...prev };
        for (const g of pendientes) {
          // Si entre medio la persona volvió a cambiar el gráfico, esta respuesta ya es vieja.
          if (firmaPedida.current[g.id] !== firmas[g.id]) continue;
          n[g.id] = fallo ? { cargando: false, error: 'No pude leer los datos' } : aEstado(respuesta[g.id] ?? { ok: false, error: 'Sin respuesta' });
        }
        return n;
      });
    }, 250);
    return () => clearTimeout(t);
  }, [tablero.graficos, desde, hasta]);

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
  // Salir de la pestaña o de la pantalla con un cambio en el respiro: se manda igual.
  useEffect(() => {
    const flush = () => { if (pendienteGuardar.current) void mandar(pendienteGuardar.current, true); };
    const alOcultar = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => { document.removeEventListener('visibilitychange', alOcultar); flush(); };
  }, [mandar]);

  // ── Edición ─────────────────────────────────────────────────────────────────────────────
  const sel = tablero.graficos.find((g) => g.id === selId) ?? null;
  const cambiar = useCallback((id: string, parche: Partial<Grafico>) => {
    mutar((t) => ({ ...t, graficos: t.graficos.map((g) => (g.id === id ? sanearGrafico({ ...g, ...parche }) ?? g : g)) }));
  }, [mutar]);
  const fuenteParaNuevo = (): FuenteId => sel?.fuente ?? tablero.fuentes[0] ?? 'meta';
  // El id se acuña AFUERA del updater: en modo estricto React lo corre dos veces, y el gráfico
  // elegido quedaría con un id distinto del que entró al tablero.
  const agregarGrafico = (g: Grafico) => {
    if (tablero.graficos.length >= MAX_GRAFICOS) { show('Llegaste al máximo de gráficos'); return; }
    mutar((t) => ({ ...t, fuentes: fuentesDe(t.fuentes, [...t.graficos, g]), graficos: [...t.graficos, g] }));
    setSelId(g.id);
    setEditando(true);
  };
  const duplicar = (g: Grafico) => agregarGrafico({ ...g, id: nuevoId(), y: g.y + g.h });
  const borrar = useCallback((g: Grafico) => {
    mutar((t) => ({ ...t, graficos: t.graficos.filter((x) => x.id !== g.id) }));
    setSelId(null);
    show('Gráfico eliminado', () => pila.deshacer());
  }, [mutar, show, pila]);
  const restablecer = () => {
    mutar(() => tableroInicial());
    setSelId(null);
    show('Informe restablecido', () => pila.deshacer());
  };

  /** Un campo soltado sobre un gráfico: la dimensión se reemplaza, la métrica se suma. */
  const soltarEnGrafico = (g: Grafico, c: Campo) => {
    const base = c.fuente === g.fuente ? g : { ...g, fuente: c.fuente, metricas: [] as string[], dimension: null };
    if (c.clase === 'dim') cambiar(g.id, { ...base, dimension: c.id, tipo: base.tipo === 'numero' ? 'tabla' : base.tipo });
    else {
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
    const tipo: TipoGrafico = c.clase === 'met' ? 'numero' : dim?.clase === 'tiempo' ? 'linea' : 'tabla';
    const n = nuevoGrafico(tipo, tablero.graficos, c.fuente);
    agregarGrafico(sanearGrafico(c.clase === 'met' ? { ...n, metricas: [c.id] } : { ...n, dimension: c.id })!);
  };
  /** Un campo tocado en el panel Datos va al gráfico elegido. */
  const tocarCampo = (c: Campo) => { if (sel) soltarEnGrafico(sel, c); else soltarEnPagina(c); };

  const agregarFuente = (f: FuenteId) => {
    const nueva = !tablero.fuentes.includes(f);
    setHojaDatos(false);
    if (!nueva) { show('Esa fuente ya está en el informe'); return; }
    // Como Looker: agregar una fuente pone una tabla con ella, lista para configurar.
    const g = nuevoGrafico('tabla', tablero.graficos, f);
    agregarGrafico(g);
  };
  const quitarFuente = (f: FuenteId) => mutar((t) => ({ ...t, fuentes: t.fuentes.filter((x) => x !== f || t.graficos.some((g) => g.fuente === f)) }));

  // Escape suelta el gráfico; Suprimir lo elimina (las dos, sólo editando y fuera de un texto).
  useEffect(() => {
    if (!editando) return;
    const k = (e: KeyboardEvent) => {
      if (enUnTexto() || menuGraficos || hojaDatos) return;
      if (e.key === 'Escape') setSelId(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); borrar(sel); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [editando, menuGraficos, hojaDatos, sel, borrar]);

  const layout: Layout = useMemo(
    () => tablero.graficos.map((g) => ({ i: g.id, x: g.x, y: g.y, w: g.w, h: g.h, minW: 2, minH: 2 })),
    [tablero.graficos],
  );
  // Arrastrar y agrandar: se apila UNA vez al empezar el gesto, no en cada píxel.
  const alEmpezarGesto = useCallback(() => pila.apilar(tableroRef.current), [pila]);
  const alMoverGrilla = useCallback((l: Layout) => {
    setTablero((t) => {
      let cambio = false;
      const graficos = t.graficos.map((g) => {
        const it = l.find((x) => x.i === g.id);
        if (!it || (it.x === g.x && it.y === g.y && it.w === g.w && it.h === g.h)) return g;
        cambio = true;
        return { ...g, x: it.x, y: it.y, w: it.w, h: it.h };
      });
      return cambio ? { ...t, graficos } : t;
    });
  }, []);

  const vacio = tablero.graficos.length === 0;

  return (
    <div ref={raiz} className={`lk lk-raiz${editando ? ' lk--editando' : ''}`}>
      {lecturaFallo && (
        <div style={{ marginBottom: 12 }}>
          <Banner tono="warn" alcance="local">No pude leer tu informe. Los cambios no se guardan.</Banner>
        </div>
      )}

      {/* ── La cabecera del informe ── */}
      <div className="lk-cabecera">
        <span className="lk-logo" aria-hidden><IconoMenu nombre="grafico" size={22} /></span>
        <input
          className="lk-nombre" value={tablero.nombre} readOnly={!editando} aria-label="Nombre del informe" maxLength={80}
          onFocus={() => { if (editando) pila.apilar(tableroRef.current); }}
          onChange={(e) => setTablero((t) => ({ ...t, nombre: e.target.value }))}
          onBlur={() => setTablero((t) => (t.nombre.trim() ? t : { ...t, nombre: inicial.nombre || 'Mis gráficos' }))}
        />
        <span className="lk-guardado" data-error={guardado === 'error' || undefined}>
          {guardado === 'guardando' ? 'Guardando…' : guardado === 'ok' ? 'Guardado' : guardado === 'error' ? 'No se guardó' : ''}
        </span>
        <div className="lk-acciones">
          {editando && (
            <button type="button" className="lk-pill" onClick={restablecer} title="Volver al informe inicial de MaKo">
              <SvgReset /> Restablecer
            </button>
          )}
          <button type="button" className="lk-pill lk-pill--azul" disabled={!guardable && !editando}
            onClick={() => { setEditando((v) => !v); setSelId(null); }}>
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
          <button type="button" className="lk-herr" onClick={() => setHojaDatos(true)}><SvgAgregarDatos /> Agregar datos</button>
          <span className="lk-sep" />
          <button type="button" className="lk-herr" aria-haspopup="menu" aria-expanded={!!menuGraficos}
            onClick={(e) => setMenuGraficos(menuGraficos ? null : e.currentTarget)}>
            <SvgAgregarGrafico /> Agregar un gráfico <SvgFlecha />
          </button>
        </div>
      )}

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
            {vacio ? (
              <div className="lk-vacio">
                <p>Este informe no tiene gráficos.</p>
                {editando ? (
                  <button type="button" className="lk-pill lk-pill--azul" onClick={(e) => { e.stopPropagation(); setMenuGraficos(e.currentTarget); }}>Agregar un gráfico</button>
                ) : (
                  <button type="button" className="lk-pill lk-pill--azul" onClick={() => setEditando(true)} disabled={!guardable}>Editar</button>
                )}
              </div>
            ) : mounted && (
              <ReactGridLayout
                width={width}
                layout={layout}
                gridConfig={{ cols: 12, rowHeight: 34, margin: [16, 16], containerPadding: [0, 0] }}
                dragConfig={{ enabled: editando, cancel: '.lk-no-arrastrar' }}
                resizeConfig={{ enabled: editando, handles: ['se', 'e', 's'] }}
                compactor={verticalCompactor}
                onDragStart={alEmpezarGesto}
                onResizeStart={alEmpezarGesto}
                onLayoutChange={alMoverGrilla}
              >
                {tablero.graficos.map((g) => {
                  const est = datos[g.id] ?? { cargando: true };
                  return (
                    <div
                      key={g.id}
                      className={`lk-comp${editando && g.id === selId ? ' lk-comp--sel' : ''}${soltandoEn === g.id ? ' lk-comp--soltar' : ''}`}
                      onClick={(e) => { if (editando) { e.stopPropagation(); setSelId(g.id); } }}
                      onDragOver={(e) => { if (editando && traeCampo(e)) { e.preventDefault(); e.stopPropagation(); setSoltandoEn(g.id); } }}
                      onDragLeave={() => setSoltandoEn((s) => (s === g.id ? null : s))}
                      onDrop={(e) => { const c = leerCampo(e); setSoltandoEn(null); if (c) { e.preventDefault(); e.stopPropagation(); soltarEnGrafico(g, c); } }}
                    >
                      <div className="lk-comp-tit">
                        <span title={tituloDe(g)}>{tituloDe(g)}</span>
                      </div>
                      <CuerpoGrafico g={g} estado={est} />
                    </div>
                  );
                })}
              </ReactGridLayout>
            )}
          </div>
        </div>

        {editando && (
          <>
            {sel ? (
              <Propiedades key={sel.id} g={sel} fuentesInforme={tablero.fuentes} cambiar={(p) => cambiar(sel.id, p)}
                onAgregarDatos={() => setHojaDatos(true)} onDuplicar={() => duplicar(sel)} onBorrar={() => borrar(sel)}
                onCambiarTipoMenu={(el) => setMenuGraficos(el)} />
            ) : (
              <aside className="lk-panel lk-props">
                <div className="lk-panel-tit">Propiedades</div>
                <p className="lk-ayuda">Selecciona un gráfico para ver sus propiedades.</p>
              </aside>
            )}
            <PanelDatos fuentes={tablero.fuentes} elegido={sel} onTocar={tocarCampo} onAgregarDatos={() => setHojaDatos(true)} />
          </>
        )}
      </div>

      {menuGraficos && (
        <MenuGraficos ancla={menuGraficos} onCerrar={() => setMenuGraficos(null)} actual={sel?.tipo}
          onElegir={(tipo) => {
            setMenuGraficos(null);
            // Con un gráfico elegido, el menú del panel CAMBIA su tipo; el de la barra agrega uno.
            if (sel && menuGraficos.dataset.lkCambiar === '1') cambiar(sel.id, { tipo });
            else agregarGrafico(nuevoGrafico(tipo, tablero.graficos, fuenteParaNuevo()));
          }} />
      )}

      {hojaDatos && (
        <HojaAgregarDatos izquierda={raiz.current?.closest('main')?.getBoundingClientRect().left ?? 0} fuentesInforme={tablero.fuentes} graficos={tablero.graficos} metaConectada={metaConectada}
          onAgregar={agregarFuente} onQuitar={quitarFuente} onCerrar={() => setHojaDatos(false)} />
      )}

      <Toast state={toast} onClose={clear} />
      <style>{CSS}</style>
    </div>
  );
}

// ── El panel de propiedades: CONFIGURACIÓN | ESTILO ─────────────────────────────────────────

function Propiedades({ g, fuentesInforme, cambiar, onAgregarDatos, onDuplicar, onBorrar, onCambiarTipoMenu }: {
  g: Grafico;
  fuentesInforme: FuenteId[];
  cambiar: (p: Partial<Grafico>) => void;
  onAgregarDatos: () => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onCambiarTipoMenu: (el: HTMLElement) => void;
}) {
  const [pestana, setPestana] = useState<'config' | 'estilo'>('config');
  const [soltar, setSoltar] = useState<'dim' | 'met' | null>(null);
  const fuente = fuenteDe(g.fuente)!;
  const info = tipoDe(g.tipo)!;
  const dims = dimensionesPara(fuente, g.tipo);
  const mets = metricasPara(fuente, g.tipo);
  const dim = dims.find((d) => d.id === g.dimension);
  const porCategoria = dim?.clase === 'categoria';
  const cantidad = g.tipo === 'barras' ? 'Cantidad de barras' : g.tipo === 'torta' ? 'Cantidad de porciones' : 'Filas';

  const zona = (clase: 'dim' | 'met'): Zona => ({
    'data-soltar': soltar === clase ? true : undefined,
    onDragOver: (e: DragEvent) => { if (traeCampo(e)) { e.preventDefault(); setSoltar(clase); } },
    onDragLeave: () => setSoltar(null),
    onDrop: (e: DragEvent) => {
      setSoltar(null);
      const c = leerCampo(e);
      if (!c) return;
      e.preventDefault();
      const base = c.fuente === g.fuente ? {} : { fuente: c.fuente };
      if (c.clase === 'dim' && clase === 'dim') cambiar({ ...base, dimension: c.id });
      if (c.clase === 'met' && clase === 'met') cambiar({ ...base, metricas: c.fuente === g.fuente && !g.metricas.includes(c.id) ? [...g.metricas, c.id].slice(-info.maxMetricas) : [c.id] });
    },
  });

  return (
    <aside className="lk-panel lk-props" onClick={(e) => e.stopPropagation()}>
      <div className="lk-props-tipo">
        <DibujoTipo tipo={g.tipo} size={22} />
        <button type="button" className="lk-tipo-btn" data-lk-cambiar="1" aria-haspopup="menu" onClick={(e) => onCambiarTipoMenu(e.currentTarget)}>
          {info.nombre} <SvgFlecha />
        </button>
      </div>
      <div className="lk-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'config'} onClick={() => setPestana('config')}>Configuración</button>
        <button type="button" role="tab" aria-selected={pestana === 'estilo'} onClick={() => setPestana('estilo')}>Estilo</button>
      </div>

      {pestana === 'config' ? (
        <div className="lk-secciones">
          <Seccion titulo="Fuente de datos">
            <Elegir
              boton={<span className="lk-fuente"><span className="lk-fuente-ico" style={{ background: COLOR_FUENTE[g.fuente] }}><IconoMenu nombre={ICONO_FUENTE[g.fuente]} size={13} /></span>{fuente.nombre}</span>}
              opciones={fuentesInforme.map((f) => ({ id: f, nombre: fuenteDe(f)!.nombre, icono: ICONO_FUENTE[f] }))}
              pie={{ texto: '＋ Agregar datos', onClick: onAgregarDatos }}
              onElegir={(id) => cambiar({ fuente: id as FuenteId })}
            />
          </Seccion>

          <Seccion titulo="Dimensión del período">
            {fuente.fechas.length > 1 ? (
              <Elegir
                boton={<Ficha clase="dim" ico={<SvgCalendario />} texto={fuente.fechas.find((f) => f.id === g.fecha)?.nombre ?? ''} />}
                opciones={fuente.fechas.map((f) => ({ id: f.id, nombre: f.nombre, icono: 'calendario' as const }))}
                onElegir={(id) => cambiar({ fecha: id })}
              />
            ) : <Ficha clase="dim" ico={<SvgCalendario />} texto={fuente.fechas[0].nombre} />}
          </Seccion>

          {dims.length > 0 && (
            <Seccion titulo="Dimensión" zona={zona('dim')}>
              <Elegir
                boton={<Ficha clase="dim" ico={dim ? <TipoCampo d={dim} /> : null} texto={dim?.nombre ?? 'Elegir'} />}
                opciones={dims.map((d) => ({ id: d.id, nombre: d.nombre, ico: <TipoCampo d={d} /> }))}
                onElegir={(id) => cambiar({ dimension: id })}
              />
            </Seccion>
          )}

          <Seccion titulo="Métrica" zona={zona('met')}>
            <div className="lk-fichas">
              {g.metricas.map((m, i) => {
                const met = metricaDe(fuente, m);
                return (
                  <div key={`${m}-${i}`} className="lk-ficha-fila">
                    <Elegir
                      boton={<Ficha clase="met" ico={<Agregacion m={met} />} texto={met?.nombre ?? m} />}
                      opciones={mets.filter((x) => x.id === m || !g.metricas.includes(x.id)).map((x) => ({ id: x.id, nombre: x.nombre, ico: <Agregacion m={x} /> }))}
                      onElegir={(id) => cambiar({ metricas: g.metricas.map((x, j) => (j === i ? id : x)) })}
                    />
                    {g.metricas.length > 1 && (
                      <button type="button" className="lk-quitar" aria-label={`Quitar ${met?.nombre ?? m}`} title="Quitar"
                        onClick={() => cambiar({ metricas: g.metricas.filter((_, j) => j !== i) })}>✕</button>
                    )}
                  </div>
                );
              })}
              {g.metricas.length < info.maxMetricas && mets.some((x) => !g.metricas.includes(x.id)) && (
                <Elegir
                  boton={<span className="lk-agregar">＋ Agregar métrica</span>}
                  opciones={mets.filter((x) => !g.metricas.includes(x.id)).map((x) => ({ id: x.id, nombre: x.nombre, ico: <Agregacion m={x} /> }))}
                  onElegir={(id) => cambiar({ metricas: [...g.metricas, id] })}
                />
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
            <div className="lk-radios">
              <label><input type="radio" checked readOnly /> Automático</label>
            </div>
            <p className="lk-ayuda">Lo pone el filtro de fechas de arriba.</p>
          </Seccion>
        </div>
      ) : (
        <div className="lk-secciones">
          <Seccion titulo="Título del gráfico">
            <input className="lk-input" value={g.titulo} placeholder={tituloDe({ ...g, titulo: '' })} maxLength={80} onChange={(e) => cambiar({ titulo: e.target.value })} />
          </Seccion>
          {(g.tipo === 'barras' || g.tipo === 'torta' || (g.tipo === 'tabla' && porCategoria)) && (
            <Seccion titulo={cantidad}>
              <Elegir
                boton={<span className="lk-select">{g.limite} <SvgFlecha /></span>}
                opciones={LIMITES.map((n) => ({ id: String(n), nombre: String(n) }))}
                onElegir={(id) => cambiar({ limite: Number(id) })}
              />
            </Seccion>
          )}
          <div className="lk-botones">
            <button type="button" className="lk-pill" onClick={onDuplicar}>Duplicar</button>
            <button type="button" className="lk-pill lk-pill--rojo" onClick={onBorrar}>Eliminar</button>
          </div>
        </div>
      )}
    </aside>
  );
}

// ── El panel Datos: los campos de cada fuente del informe ───────────────────────────────────

function PanelDatos({ fuentes, elegido, onTocar, onAgregarDatos }: {
  fuentes: FuenteId[];
  elegido: Grafico | null;
  onTocar: (c: Campo) => void;
  onAgregarDatos: () => void;
}) {
  const [q, setQ] = useState('');
  const [cerradas, setCerradas] = useState<Set<FuenteId>>(new Set());
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const filtro = norm(q.trim());
  // La fuente del gráfico elegido va primero: es la única cuyos campos le sirven tal cual.
  const orden = elegido ? [elegido.fuente, ...fuentes.filter((f) => f !== elegido.fuente)] : fuentes;
  const arrastrar = (c: Campo) => (e: DragEvent) => {
    e.dataTransfer.setData(MIME_CAMPO, JSON.stringify(c));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside className="lk-panel lk-datos" onClick={(e) => e.stopPropagation()}>
      <div className="lk-panel-tit">Datos</div>
      <div className="lk-buscar">
        <SvgLupa />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar campos" />
      </div>
      {orden.map((fid) => {
        const f = fuenteDe(fid)!;
        const abierta = !cerradas.has(fid) || !!filtro;
        const dims = f.dimensiones.filter((d) => !filtro || norm(d.nombre).includes(filtro));
        const mets = f.metricas.filter((m) => !filtro || norm(m.nombre).includes(filtro));
        if (filtro && !dims.length && !mets.length) return null;
        return (
          <div key={fid} className="lk-dfuente">
            <button type="button" className="lk-dfuente-tit" aria-expanded={abierta}
              onClick={() => setCerradas((s) => { const n = new Set(s); if (n.has(fid)) n.delete(fid); else n.add(fid); return n; })}>
              <span className="lk-fuente-ico" style={{ background: COLOR_FUENTE[fid] }}><IconoMenu nombre={ICONO_FUENTE[fid]} size={12} /></span>
              <span className="lk-dfuente-nom">{f.nombre}</span>
              <SvgFlecha arriba={abierta} />
            </button>
            {abierta && (
              <ul className="lk-campos">
                {dims.map((d) => (
                  <li key={`d-${d.id}`} draggable onDragStart={arrastrar({ fuente: fid, clase: 'dim', id: d.id })}
                    onClick={() => onTocar({ fuente: fid, clase: 'dim', id: d.id })} className="lk-campo lk-campo--dim" title="Arrastrar a un gráfico, o tocar para usarlo">
                    <TipoCampo d={d} /> {d.nombre}
                  </li>
                ))}
                {mets.map((m) => (
                  <li key={`m-${m.id}`} draggable onDragStart={arrastrar({ fuente: fid, clase: 'met', id: m.id })}
                    onClick={() => onTocar({ fuente: fid, clase: 'met', id: m.id })} className="lk-campo lk-campo--met" title="Arrastrar a un gráfico, o tocar para usarlo">
                    <span className="lk-tipo-campo">123</span> {m.nombre}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <button type="button" className="lk-agregar lk-agregar--bloque" onClick={onAgregarDatos}>＋ Agregar datos</button>
    </aside>
  );
}

// ── La hoja «Agregar datos al informe» ──────────────────────────────────────────────────────

function HojaAgregarDatos({ izquierda, fuentesInforme, graficos, metaConectada, onAgregar, onQuitar, onCerrar }: {
  /** Dónde empieza el contenido: la barra lateral de la app es fija y taparía el título. */
  izquierda: number;
  fuentesInforme: FuenteId[];
  graficos: Grafico[];
  metaConectada: boolean;
  onAgregar: (f: FuenteId) => void;
  onQuitar: (f: FuenteId) => void;
  onCerrar: () => void;
}) {
  const [pestana, setPestana] = useState<'conectar' | 'mias'>('conectar');
  const [q, setQ] = useState('');
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const visibles = FUENTES.filter((f) => !q.trim() || norm(`${f.nombre} ${DESCRIPCION_FUENTE[f.id]}`).includes(norm(q.trim())));
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); cerrar.current(); } };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, []);

  return createPortal(
    <div className="lk lk-hoja" role="dialog" aria-label="Agregar datos al informe" style={{ left: Math.max(0, Math.round(izquierda)) }}>
      <div className="lk-hoja-asa" aria-hidden>••••</div>
      <div className="lk-hoja-cab">
        <h2>Agregar datos al informe</h2>
        <button type="button" className="lk-cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>
      <div className="lk-tabs lk-tabs--hoja" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'conectar'} onClick={() => setPestana('conectar')}>Conectar con datos</button>
        <button type="button" role="tab" aria-selected={pestana === 'mias'} onClick={() => setPestana('mias')}>Mis fuentes de datos</button>
      </div>
      <div className="lk-hoja-cuerpo">
        {pestana === 'conectar' ? (
          <>
            <div className="lk-buscar lk-buscar--grande">
              <SvgLupa />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar conectores" autoFocus />
            </div>
            <h3>Conectores de MaKo ({visibles.length})</h3>
            <p className="lk-hoja-sub">Conectores creados y mantenidos por MaKo</p>
            <div className="lk-conectores">
              {visibles.map((f) => {
                const sinConectar = f.id === 'meta' && !metaConectada;
                const enInforme = fuentesInforme.includes(f.id);
                return (
                  <div key={f.id} className="lk-conector" data-apagado={sinConectar || undefined}>
                    <button type="button" className="lk-conector-btn" disabled={sinConectar} onClick={() => onAgregar(f.id)}>
                      <span className="lk-conector-ico" style={{ background: COLOR_FUENTE[f.id] }}><IconoMenu nombre={ICONO_FUENTE[f.id]} size={22} /></span>
                      <span className="lk-conector-txt">
                        <span className="lk-conector-nom">{f.nombre}</span>
                        <span className="lk-conector-por">Por MaKo{enInforme ? ' · en el informe' : ''}</span>
                        <span className="lk-conector-desc">{DESCRIPCION_FUENTE[f.id]}</span>
                      </span>
                    </button>
                    {sinConectar && <Link href="/integraciones" className="lk-conector-link">Conectar Meta</Link>}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <ul className="lk-mias">
            {fuentesInforme.map((fid) => {
              const f = fuenteDe(fid)!;
              const usos = graficos.filter((g) => g.fuente === fid).length;
              return (
                <li key={fid}>
                  <span className="lk-conector-ico lk-conector-ico--chico" style={{ background: COLOR_FUENTE[fid] }}><IconoMenu nombre={ICONO_FUENTE[fid]} size={14} /></span>
                  <span className="lk-mias-nom">{f.nombre}</span>
                  <span className="lk-mias-usos">{usos === 1 ? '1 gráfico' : `${usos} gráficos`}</span>
                  {usos === 0 && <button type="button" className="lk-quitar" title="Quitar del informe" aria-label={`Quitar ${f.nombre} del informe`} onClick={() => onQuitar(fid)}>✕</button>}
                </li>
              );
            })}
            {!fuentesInforme.length && <li className="lk-ayuda">El informe todavía no tiene datos.</li>}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── El menú «Agregar un gráfico» (y el de cambiar el tipo) ──────────────────────────────────

function MenuGraficos({ ancla, actual, onElegir, onCerrar }: { ancla: HTMLElement; actual?: TipoGrafico; onElegir: (t: TipoGrafico) => void; onCerrar: () => void }) {
  return (
    <Flotante ancla={ancla} onCerrar={onCerrar} ancho={340}>
      <div className="lk-menu-graficos" role="menu">
        {TIPOS.map((t) => (
          <button key={t.id} type="button" role="menuitem" className="lk-menu-tipo" data-actual={(ancla.dataset.lkCambiar === '1' && actual === t.id) || undefined} onClick={() => onElegir(t.id)} title={t.nombre}>
            <DibujoTipo tipo={t.id} size={40} />
            <span>{t.nombre}</span>
          </button>
        ))}
      </div>
    </Flotante>
  );
}

/**
 * Un panel anclado a un botón, PORTALEADO al body y ubicado por cuenta: los paneles laterales
 * scrollean y un menú adentro se cortaría (AGENTS.md, «Una caja cuyo alto es un TOPE…»). Se
 * cierra tocando afuera o con Escape, y el Escape no le llega a nadie más.
 */
function Flotante({ ancla, onCerrar, ancho, children }: { ancla: HTMLElement; onCerrar: () => void; ancho: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useLayoutEffect(() => {
    const ubicar = () => {
      const r = ancla.getBoundingClientRect();
      const alto = ref.current?.offsetHeight ?? 0;
      const w = Math.max(ancho, r.width);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      const abajo = r.bottom + 6;
      const top = abajo + alto > window.innerHeight - 8 && r.top - alto - 6 > 8 ? r.top - alto - 6 : abajo;
      setPos({ left, top });
    };
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => { window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); };
  }, [ancla, ancho]);
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || ancla.contains(t)) return;
      cerrar.current();
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); cerrar.current(); } };
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('mousedown', fuera, true); document.removeEventListener('keydown', tecla, true); };
  }, [ancla]);
  return createPortal(
    <div ref={ref} className="lk lk-flotante" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, minWidth: Math.max(ancho, 0), visibility: pos ? 'visible' : 'hidden' }}>
      {children}
    </div>,
    document.body,
  );
}

type OpcionElegir = { id: string; nombre: string; icono?: NombreIconoMenu; ico?: ReactNode };

/** Una ficha o un botón que abre la lista de campos, como los selectores del panel de Looker. */
function Elegir({ boton, opciones, onElegir, pie }: { boton: ReactNode; opciones: OpcionElegir[]; onElegir: (id: string) => void; pie?: { texto: string; onClick: () => void } }) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const [q, setQ] = useState('');
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const lista = opciones.filter((o) => !q.trim() || norm(o.nombre).includes(norm(q.trim())));
  return (
    <>
      <button type="button" className="lk-elegir" aria-haspopup="listbox" aria-expanded={!!ancla}
        onClick={(e) => { const t = e.currentTarget; setQ(''); setAncla((a) => (a ? null : t)); }}>
        {boton}
      </button>
      {ancla && (
        <Flotante ancla={ancla} onCerrar={() => setAncla(null)} ancho={240}>
          <div className="lk-lista" role="listbox">
            {opciones.length > 7 && (
              <div className="lk-buscar lk-buscar--lista"><SvgLupa /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" autoFocus /></div>
            )}
            {lista.map((o) => (
              <button key={o.id} type="button" role="option" aria-selected={false} className="lk-opcion" onClick={() => { setAncla(null); onElegir(o.id); }}>
                {o.ico ?? (o.icono ? <IconoMenu nombre={o.icono} size={16} /> : null)} <span>{o.nombre}</span>
              </button>
            ))}
            {pie && <button type="button" className="lk-opcion lk-opcion--pie" onClick={() => { setAncla(null); pie.onClick(); }}>{pie.texto}</button>}
          </div>
        </Flotante>
      )}
    </>
  );
}

function Seccion({ titulo, zona, children }: { titulo: string; zona?: Zona; children: ReactNode }) {
  return (
    <div className="lk-seccion" {...zona}>
      <div className="lk-seccion-tit">{titulo}</div>
      {children}
    </div>
  );
}

/** La ficha de un campo: verde la dimensión, azul la métrica, como en Looker. */
function Ficha({ clase, ico, texto }: { clase: 'dim' | 'met'; ico: ReactNode; texto: string }) {
  return (
    <span className={`lk-ficha lk-ficha--${clase}`}>
      {ico && <span className="lk-ficha-ico">{ico}</span>}
      <span className="lk-ficha-txt">{texto}</span>
    </span>
  );
}

/** El ícono del tipo de una dimensión: el calendario para el tiempo, «ABC» para el texto. */
function TipoCampo({ d }: { d: Dimension }) {
  return d.clase === 'tiempo' ? <SvgCalendario /> : <span className="lk-tipo-campo">ABC</span>;
}

/** La insignia de la agregación de una métrica: SUM si se suma, AUT si la calcula la fuente. */
function Agregacion({ m }: { m?: Metrica }) {
  return <span className="lk-agg">{m?.razon ? 'AUT' : 'SUM'}</span>;
}

/** El dibujito de cada tipo de gráfico, para el menú y el panel. */
function DibujoTipo({ tipo, size = 24 }: { tipo: TipoGrafico; size?: number }) {
  const s: CSSProperties = { width: size, height: size, flex: 'none' };
  const c = '#1a73e8';
  const g = '#9aa0a6';
  if (tipo === 'numero') return (
    <svg viewBox="0 0 24 24" style={s} fill="none"><rect x="2.5" y="5" width="19" height="14" rx="2" stroke={g} strokeWidth="1.5" /><path d="M6.5 10h5M6.5 14.5h8" stroke={c} strokeWidth="2" strokeLinecap="round" /></svg>
  );
  if (tipo === 'linea') return (
    <svg viewBox="0 0 24 24" style={s} fill="none"><path d="M3 20h18M3 4v16" stroke={g} strokeWidth="1.5" /><path d="M5 15l4-5 4 3 6-7" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
  if (tipo === 'barras') return (
    <svg viewBox="0 0 24 24" style={s} fill="none"><path d="M3 20h18" stroke={g} strokeWidth="1.5" /><rect x="5" y="11" width="3" height="9" rx="0.5" fill={c} /><rect x="10.5" y="6" width="3" height="14" rx="0.5" fill={c} /><rect x="16" y="13" width="3" height="7" rx="0.5" fill={c} /></svg>
  );
  if (tipo === 'torta') return (
    <svg viewBox="0 0 24 24" style={s} fill="none"><circle cx="12" cy="12" r="8.5" fill={g} opacity=".45" /><path d="M12 12V3.5A8.5 8.5 0 0 1 20.2 14.2Z" fill={c} /></svg>
  );
  return (
    <svg viewBox="0 0 24 24" style={s} fill="none"><rect x="3" y="4.5" width="18" height="15" rx="1.5" stroke={g} strokeWidth="1.5" /><path d="M3 9.5h18M3 14.5h18M9.5 4.5v15" stroke={g} strokeWidth="1.5" /><path d="M3.8 5.3h16.4v3.4H3.8z" fill={c} opacity=".35" /></svg>
  );
}

// ── Los íconos de la barra (trazos de Material, a 20 px) ────────────────────────────────────
const svg = (d: ReactNode, extra?: CSSProperties) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={extra} aria-hidden>{d}</svg>;
const SvgDeshacer = ({ espejo }: { espejo?: boolean }) => svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>, espejo ? { transform: 'scaleX(-1)' } : undefined);
const SvgAgregarDatos = () => svg(<><rect x="3" y="4" width="13" height="16" rx="1.5" /><path d="M6.5 8.5h6M6.5 12h6M6.5 15.5h3.5M19 9v6M16 12h6" /></>);
const SvgAgregarGrafico = () => svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7.5 16.5v-4M12 16.5v-8M16.5 16.5v-6" /></>);
const SvgFlecha = ({ arriba }: { arriba?: boolean }) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden style={arriba ? { transform: 'rotate(180deg)' } : undefined}><path d="M7 10l5 5 5-5z" /></svg>;
const SvgReset = () => svg(<><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4h4" /></>);
const SvgOjo = () => svg(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
const SvgLapiz = () => svg(<><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>);
const SvgLupa = () => svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>);
const SvgCalendario = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>;

// ── Los valores de Looker Studio, limitados a `.lk` ─────────────────────────────────────────
const CSS = `
.lk { --lk-azul: #1a73e8; --lk-azul-claro: #e8f0fe; --lk-verde: #188038; --lk-verde-claro: #e6f4ea; --lk-tinta: #202124; --lk-gris: #5f6368; --lk-borde: #dadce0; --lk-barra: #f1f3f4; --lk-lienzo: #e8eaed; font-family: Roboto, 'Google Sans', Arial, sans-serif; color: var(--lk-tinta); }
.lk button { font-family: inherit; }
.lk-raiz { background: #fff; border: 1px solid var(--lk-borde); border-radius: 8px; padding: 10px 14px 14px; }
.lk .recharts-wrapper *:focus, .lk .recharts-surface:focus { outline: none; }
.lk-cabecera { display: flex; align-items: center; gap: 10px; padding: 4px 0 10px; }
.lk-logo { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--lk-azul); background: var(--lk-azul-claro); flex: none; }
.lk-nombre { font: inherit; font-size: 18px; color: var(--lk-tinta); border: 1px solid transparent; border-radius: 4px; padding: 4px 6px; min-width: 0; width: 320px; max-width: 40vw; background: transparent; }
.lk--editando .lk-nombre:hover { border-color: var(--lk-borde); }
.lk--editando .lk-nombre:focus { outline: none; border-color: var(--lk-azul); }
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
.lk-barra { display: flex; align-items: center; gap: 2px; background: var(--lk-barra); border-radius: 8px; padding: 4px 8px; margin-bottom: 12px; flex-wrap: wrap; }
.lk-herr { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: none; border-radius: 4px; background: transparent; color: #3c4043; font-size: 14px; cursor: pointer; }
.lk-herr:hover:not(:disabled) { background: rgba(60,64,67,.08); }
.lk-herr:disabled { color: #bdc1c6; cursor: default; }
.lk-herr--icono { width: 36px; padding: 0; justify-content: center; }
.lk-sep { width: 1px; height: 22px; background: var(--lk-borde); margin: 0 6px; }
.lk-cuerpo { display: flex; gap: 0; align-items: stretch; border: 1px solid var(--lk-borde); border-radius: 8px; overflow: hidden; min-height: 620px; background: #fff; }
.lk:not(.lk--editando) .lk-cuerpo { border: none; background: transparent; }
.lk-lienzo { flex: 1; min-width: 0; background: var(--lk-lienzo); padding: 24px; overflow: auto; }
.lk:not(.lk--editando) .lk-lienzo { background: transparent; padding: 0; }
.lk-pagina { background: #fff; min-height: 560px; padding: 20px; box-shadow: 0 1px 2px rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15); border-radius: 2px; }
.lk-pagina[data-soltar] { outline: 2px dashed var(--lk-azul); outline-offset: -6px; }
.lk-vacio { display: grid; place-items: center; gap: 12px; padding: 120px 0; color: var(--lk-gris); font-size: 14px; }
.lk-vacio p { margin: 0; }
.lk-comp { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; box-sizing: border-box; background: #fff; border: 1px solid transparent; overflow: hidden; }
.lk--editando .lk-comp { cursor: move; }
.lk--editando .lk-comp:hover { border-color: var(--lk-borde); }
.lk-comp--sel, .lk--editando .lk-comp--sel:hover { border-color: var(--lk-azul); }
.lk-comp--soltar { border-color: var(--lk-azul) !important; background: var(--lk-azul-claro); }
.lk-comp-tit { display: flex; min-width: 0; font-size: 13px; font-weight: 500; color: var(--lk-gris); }
.lk-comp-tit span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk .react-grid-item.react-grid-placeholder { background: var(--lk-azul); opacity: .15; border-radius: 0; }
.lk .react-grid-item > .react-resizable-handle { opacity: 0; }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle { opacity: 1; }
.lk .react-grid-item > .react-resizable-handle::after { border-color: var(--lk-azul) !important; }
.lk-panel { flex: none; background: #fff; border-left: 1px solid var(--lk-borde); overflow-y: auto; max-height: 760px; box-sizing: border-box; }
.lk-props { width: 288px; padding: 0 0 16px; }
.lk-datos { width: 232px; padding: 0 0 16px; }
.lk-panel-tit { font-size: 16px; padding: 14px 16px 10px; }
.lk-ayuda { margin: 0 16px; font-size: 12.5px; color: var(--lk-gris); line-height: 1.45; }
.lk-seccion .lk-ayuda { margin: 6px 0 0; }
.lk-props-tipo { display: flex; align-items: center; gap: 8px; padding: 12px 12px 8px 16px; }
.lk-tipo-btn { display: inline-flex; align-items: center; gap: 2px; border: none; background: transparent; font-size: 15px; color: var(--lk-tinta); padding: 4px 6px; border-radius: 4px; cursor: pointer; }
.lk-tipo-btn:hover { background: rgba(60,64,67,.08); }
.lk-tabs { display: flex; border-bottom: 1px solid var(--lk-borde); padding: 0 8px; }
.lk-tabs button { flex: 1; height: 40px; border: none; background: transparent; font-size: 13px; font-weight: 500; letter-spacing: .03em; text-transform: uppercase; color: var(--lk-gris); border-bottom: 3px solid transparent; cursor: pointer; }
.lk-tabs button[aria-selected="true"] { color: var(--lk-azul); border-bottom-color: var(--lk-azul); }
.lk-tabs--hoja { padding: 0 20px; }
.lk-tabs--hoja button { flex: none; padding: 0 18px; text-transform: none; font-size: 15px; letter-spacing: 0; }
.lk-secciones { display: flex; flex-direction: column; }
.lk-seccion { padding: 14px 16px; border-bottom: 1px solid #f1f3f4; }
.lk-seccion[data-soltar] { background: var(--lk-azul-claro); }
.lk-seccion-tit { font-size: 12px; font-weight: 500; color: var(--lk-gris); margin-bottom: 8px; }
.lk-elegir { display: flex; width: 100%; border: none; background: transparent; padding: 0; text-align: left; cursor: pointer; min-width: 0; }
.lk-fuente { display: flex; align-items: center; gap: 8px; width: 100%; font-size: 14px; color: var(--lk-tinta); padding: 6px 8px; border-radius: 4px; border: 1px solid var(--lk-borde); }
.lk-elegir:hover .lk-fuente { background: #f8f9fa; }
.lk-fuente-ico { width: 20px; height: 20px; border-radius: 4px; display: grid; place-items: center; color: #fff; flex: none; }
.lk-fichas { display: flex; flex-direction: column; gap: 6px; }
.lk-ficha-fila { display: flex; align-items: center; gap: 4px; }
.lk-ficha-fila .lk-elegir { flex: 1; }
.lk-ficha { display: flex; align-items: center; gap: 0; width: 100%; height: 30px; border-radius: 15px; overflow: hidden; font-size: 13.5px; min-width: 0; }
.lk-ficha--dim { background: var(--lk-verde-claro); color: #137333; }
.lk-ficha--met { background: var(--lk-azul-claro); color: #1967d2; }
.lk-ficha-ico { display: grid; place-items: center; min-width: 34px; height: 100%; padding: 0 6px; box-sizing: border-box; }
.lk-ficha--dim .lk-ficha-ico { background: #ceead6; }
.lk-ficha--met .lk-ficha-ico { background: #d2e3fc; }
.lk-ficha-txt { padding: 0 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-elegir:hover .lk-ficha { filter: brightness(.97); }
.lk-agg, .lk-tipo-campo { font-size: 10px; font-weight: 700; letter-spacing: .02em; }
.lk-agregar { display: inline-flex; align-items: center; height: 30px; padding: 0 4px; font-size: 13.5px; color: var(--lk-azul); font-weight: 500; }
.lk-agregar--bloque { border: none; background: transparent; cursor: pointer; margin: 10px 12px 0; }
.lk-quitar { flex: none; width: 26px; height: 26px; border: none; border-radius: 50%; background: transparent; color: var(--lk-gris); cursor: pointer; font-size: 13px; }
.lk-quitar:hover { background: rgba(60,64,67,.08); color: var(--lk-tinta); }
.lk-radios { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; font-size: 13.5px; }
.lk-radios label { display: flex; align-items: center; gap: 8px; }
.lk-radios input { accent-color: var(--lk-azul); margin: 0; }
.lk-input { width: 100%; box-sizing: border-box; height: 34px; border: 1px solid var(--lk-borde); border-radius: 4px; padding: 0 10px; font: inherit; font-size: 14px; color: var(--lk-tinta); }
.lk-input:focus { outline: none; border-color: var(--lk-azul); }
.lk-select { display: inline-flex; align-items: center; justify-content: space-between; width: 100%; height: 34px; border: 1px solid var(--lk-borde); border-radius: 4px; padding: 0 6px 0 10px; font-size: 14px; color: var(--lk-tinta); }
.lk-botones { display: flex; gap: 10px; padding: 16px; }
.lk-buscar { display: flex; align-items: center; gap: 8px; margin: 0 12px 8px; height: 34px; padding: 0 10px; border: 1px solid var(--lk-borde); border-radius: 4px; color: var(--lk-gris); }
.lk-buscar input { flex: 1; min-width: 0; border: none; outline: none; font: inherit; font-size: 14px; background: transparent; color: var(--lk-tinta); }
.lk-buscar--grande { height: 54px; max-width: 760px; margin: 0 0 26px; padding: 0 16px; border-color: #80868b; }
.lk-buscar--grande input { font-size: 17px; }
.lk-buscar--lista { margin: 4px 8px 6px; }
.lk-dfuente { border-top: 1px solid #f1f3f4; }
.lk-dfuente-tit { display: flex; align-items: center; gap: 8px; width: 100%; border: none; background: transparent; padding: 10px 12px; font-size: 13.5px; font-weight: 500; color: var(--lk-tinta); cursor: pointer; text-align: left; }
.lk-dfuente-nom { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-campos { list-style: none; margin: 0 0 6px; padding: 0; }
.lk-campo { display: flex; align-items: center; gap: 8px; padding: 5px 12px 5px 16px; font-size: 13.5px; cursor: grab; user-select: none; }
.lk-campo:hover { background: #f1f3f4; }
.lk-campo--dim { color: var(--lk-verde); }
.lk-campo--met { color: var(--lk-azul); }
.lk-campo .lk-tipo-campo, .lk-campo svg { width: 26px; text-align: center; flex: none; }
.lk-flotante { position: fixed; z-index: 580; background: #fff; border-radius: 4px; box-shadow: 0 2px 6px 2px rgba(60,64,67,.15), 0 1px 2px rgba(60,64,67,.3); padding: 6px 0; max-height: 60vh; overflow-y: auto; }
.lk-lista { display: flex; flex-direction: column; }
.lk-opcion { display: flex; align-items: center; gap: 10px; border: none; background: transparent; padding: 8px 16px; font-size: 14px; color: var(--lk-tinta); text-align: left; cursor: pointer; }
.lk-opcion:hover { background: #f1f3f4; }
.lk-opcion--pie { color: var(--lk-azul); border-top: 1px solid var(--lk-borde); margin-top: 4px; }
.lk-opcion .lk-agg, .lk-opcion .lk-tipo-campo { width: 30px; color: var(--lk-gris); }
.lk-menu-graficos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 6px 10px; }
.lk-menu-tipo { display: flex; flex-direction: column; align-items: center; gap: 6px; border: 1px solid transparent; border-radius: 4px; background: transparent; padding: 10px 4px; font-size: 12px; color: var(--lk-tinta); cursor: pointer; text-align: center; }
.lk-menu-tipo:hover { background: #f1f3f4; }
.lk-menu-tipo[data-actual] { border-color: var(--lk-azul); background: var(--lk-azul-claro); }
.lk-hoja { position: fixed; left: 0; right: 0; bottom: 0; height: 66vh; z-index: 55; background: #fff; box-shadow: 0 -2px 8px rgba(60,64,67,.25); display: flex; flex-direction: column; animation: lkSube .18s ease; }
@keyframes lkSube { from { transform: translateY(24px); opacity: .6; } to { transform: none; opacity: 1; } }
.lk-hoja-asa { text-align: center; color: var(--lk-azul); font-size: 14px; letter-spacing: 2px; line-height: 10px; padding-top: 4px; }
.lk-hoja-cab { display: flex; align-items: center; padding: 6px 20px 12px; border-bottom: 1px solid var(--lk-borde); }
.lk-hoja-cab h2 { margin: 0; font-size: 22px; font-weight: 400; color: var(--lk-tinta); flex: 1; }
.lk-cerrar { border: none; background: transparent; font-size: 22px; color: var(--lk-tinta); width: 40px; height: 40px; border-radius: 50%; cursor: pointer; }
.lk-cerrar:hover { background: rgba(60,64,67,.08); }
.lk-hoja-cuerpo { flex: 1; overflow-y: auto; padding: 28px 90px 40px; }
.lk-hoja-cuerpo h3 { margin: 0; font-size: 22px; font-weight: 400; }
.lk-hoja-sub { margin: 4px 0 22px; font-size: 14px; color: var(--lk-gris); }
.lk-conectores { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 412px)); gap: 30px; }
.lk-conector { position: relative; border: 1px solid var(--lk-borde); border-radius: 8px; min-height: 150px; }
.lk-conector:hover:not([data-apagado]) { box-shadow: 0 1px 3px rgba(60,64,67,.3); }
.lk-conector-btn { display: flex; gap: 18px; width: 100%; height: 100%; border: none; background: transparent; padding: 24px 24px 20px 36px; text-align: left; cursor: pointer; }
.lk-conector-btn:disabled { cursor: default; opacity: .55; }
.lk-conector-ico { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; color: #fff; flex: none; }
.lk-conector-ico--chico { width: 26px; height: 26px; border-radius: 6px; }
.lk-conector-txt { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.lk-conector-nom { font-size: 20px; color: var(--lk-azul); }
.lk-conector-por { font-size: 14px; color: var(--lk-gris); }
.lk-conector-desc { font-size: 14px; color: var(--lk-gris); margin-top: 8px; line-height: 1.4; }
.lk-conector-link { position: absolute; right: 18px; bottom: 14px; font-size: 13.5px; color: var(--lk-azul); }
.lk-mias { list-style: none; margin: 0; padding: 0; max-width: 760px; }
.lk-mias li { display: flex; align-items: center; gap: 12px; padding: 12px 6px; border-bottom: 1px solid var(--lk-borde); font-size: 15px; }
.lk-mias-nom { flex: 1; }
.lk-mias-usos { color: var(--lk-gris); font-size: 13.5px; }
@media (max-width: 1100px) { .lk-datos { display: none; } }
@media (max-width: 760px) { .lk-props { display: none; } .lk-hoja-cuerpo { padding: 20px 16px; } .lk-nombre { width: 160px; } }
`;
