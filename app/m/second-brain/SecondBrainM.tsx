'use client';

// =============================================================================
// SecondBrainM — el buscador, el mapa chico, «Tu negocio» y la hoja de un área o un dato
// =============================================================================
// Obsidian en el teléfono: escribir arriba y la pantalla pasa a ser la lista de lo encontrado
// (el «3/72» de escritorio va en el campo, y la ✕ en modo MaKo vuelve a la búsqueda normal, como
// allá); sin texto, el mapa en chico y las carpetas. Tocar un área o un dato abre UNA hoja (Notion:
// la página como hoja, las propiedades como filas nombre → valor) que navega adentro: área → dato →
// dato conectado; el área de arriba del dato lleva a su área. «Atrás» cierra la hoja.
//
// ⚠️ Nada de lo que llega del server se copia a un estado: refrescar trae el cerebro nuevo y la hoja
//    abierta se vuelve a leer por id (si el dato ya no está, lo dice).
// ⚠️ La hoja guarda su última vista mientras se cierra: sin eso, los 220 ms de la salida bajan vacíos.
// =============================================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useWs } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { conWs } from '@/lib/ws-tab';
import type { AreaId, Cerebro, NodoCerebro } from '@/lib/cerebro-modelo';
import { contarPorArea, rellenoNodo, rutaVistaDocumento, sePuedeVerDocumento, OPACIDAD_PENDIENTE } from '@/lib/cerebro-areas';
import {
  CabeceraM, ComputadoraM, FilaDatoM, FilaM, ListaM, PieM, SeccionM, SegmentadoM, SheetM, SkeletonFilas, VacioM,
} from '@/app/m/_ui';
import {
  R, accesos, areaPorId, buscarNodos, carpetaDeArea, carpetas, conexionesDe, datosConValor, datosDelArea, deDondeSalio,
  elegidosPorMako, esCorto, miniMapa, primeraLinea, totalBuscable, type DondeBuscar,
} from './modelo';
import { ArchiveroM } from './ArchiveroM';

type Hoja = { tipo: 'area'; area: AreaId } | { tipo: 'dato'; id: string };
type EstadoIA = { pensando: boolean; ids: string[] | null; explico: string };
const SIN_IA: EstadoIA = { pensando: false, ids: null, explico: '' };

/** El punto de color de un área o un dato, en su baldosa oscura (el lienzo de escritorio, en chico). */
function Punto({ color, apagado = false }: { color: string; apagado?: boolean }) {
  return (
    <span className="m-second-brain-punto" aria-hidden>
      <i style={{ color, opacity: apagado ? OPACIDAD_PENDIENTE : 1 }} />
    </span>
  );
}

/** Un nombre → valor que no entra al lado (un párrafo, una lista): el nombre arriba, el valor entero abajo. */
function ParLargo({ k, v }: { k: string; v: string }) {
  return (
    <div className="m-fila-envoltorio">
      <div className="m-fila m-second-brain-par">
        <span className="m-fila__txt">
          <span className="m-second-brain-par__k">{k}</span>
          <span className="m-second-brain-par__v">{v}</span>
        </span>
      </div>
    </div>
  );
}

/** La foto del mapa: las mismas posiciones del server, sin gestos. Una isla oscura, como el lienzo. */
function MapaChico({ cerebro }: { cerebro: Cerebro }) {
  const { puntos, lineas } = useMemo(() => miniMapa(cerebro, 340, 170), [cerebro]);
  if (!puntos.length) return null;
  return (
    <div className="m-second-brain-mapa" data-tema="oscuro" role="img" aria-label="El mapa de tu negocio">
      <svg viewBox="0 0 340 170" preserveAspectRatio="xMidYMid meet" aria-hidden focusable="false">
        <g className="m-second-brain-mapa__aristas">
          {lineas.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />)}
        </g>
        {puntos.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r={p.r} fill={p.color} opacity={p.opacidad} />)}
      </svg>
    </div>
  );
}

export function SecondBrainM({ cerebro, areaInicial }: { cerebro: Cerebro; areaInicial: AreaId | null }) {
  const ws = useWs();
  const [q, setQ] = useState('');
  const [donde, setDonde] = useState<DondeBuscar>('nombre');
  const [ia, setIa] = useState<EstadoIA>(SIN_IA);
  const pedido = useRef(0);
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [subir, setSubir] = useState(false);

  // `?area=` (la clave de escritorio): entra con esa área abierta. El parámetro se saca de la URL
  // antes de que la hoja ponga el suyo, para que «atrás» no la vuelva a abrir.
  const abrioInicial = useRef(false);
  useEffect(() => {
    if (abrioInicial.current || !areaInicial) return;
    abrioInicial.current = true;
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('area');
      u.searchParams.delete('vista');
      window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
    } catch { /* sin URL no hay nada que limpiar */ }
    setHoja({ tipo: 'area', area: areaInicial });
  }, [areaInicial]);

  const accion = useMemo(() => (
    <button type="button" className="m-cabecera__accion" aria-label={R.abrirArchivero} onClick={() => setSubir(true)}>
      <Icon name="plus" size={22} />
    </button>
  ), []);

  const conteo = useMemo(() => contarPorArea(cerebro.nodos), [cerebro.nodos]);
  const { norte, cuello } = useMemo(() => accesos(cerebro.nodos), [cerebro.nodos]);
  const total = useMemo(() => totalBuscable(cerebro), [cerebro]);

  const hayTexto = q.trim() !== '';
  const conIA = ia.ids !== null || ia.pensando;
  const resultados = useMemo(
    () => (ia.ids ? elegidosPorMako(cerebro, ia.ids) : buscarNodos(cerebro, q, donde)),
    [cerebro, q, donde, ia.ids],
  );

  const volverANormal = () => { pedido.current++; setIa(SIN_IA); };
  const escribir = (v: string) => { setQ(v); if (conIA) volverANormal(); };

  /** Le pide a MaKo que lea el mapa (la misma ruta de escritorio). Devuelve IDS: se dibujan los nodos de acá. */
  const buscarConMako = async () => {
    const texto = q.trim();
    if (!texto) return;
    const n = ++pedido.current;
    setIa({ pensando: true, ids: null, explico: '' });
    try {
      const r = await fetch('/api/second-brain/buscar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: texto }), signal: AbortSignal.timeout(60_000),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; ids?: unknown; explico?: unknown } | null;
      if (n !== pedido.current) return;
      if (!j || j.ok === false) { setIa({ pensando: false, ids: [], explico: R.sinMako }); return; }
      setIa({ pensando: false, ids: Array.isArray(j.ids) ? j.ids.map(String) : [], explico: String(j.explico ?? '') });
    } catch {
      if (n === pedido.current) setIa({ pensando: false, ids: [], explico: R.sinMako });
    }
  };

  const abrirArea = (area: AreaId) => setHoja({ tipo: 'area', area });
  const abrirNodo = (n: NodoCerebro) => {
    // La caja de un área (o su «falta») se abre como el área: es la lista, no un dato.
    if (n.id.startsWith('area:') || n.id.startsWith('falta:')) abrirArea(n.area);
    else setHoja({ tipo: 'dato', id: n.id });
  };
  const filaNodo = (n: NodoCerebro, segunda?: string) => {
    const esArea = n.id.startsWith('area:') || n.id.startsWith('falta:');
    return (
      <FilaM
        key={n.id}
        leading={<Punto color={rellenoNodo(n)} apagado={n.autoria === 'pendiente'} />}
        titulo={n.etiqueta}
        segunda={segunda ?? (esArea ? carpetaDeArea(n.area) : areaPorId(n.area).nombre)}
        onClick={() => abrirNodo(n)}
      />
    );
  };

  // ── La hoja: un área o un dato, y la última vista mientras se cierra ─────────
  const ultima = useRef<Hoja | null>(null);
  if (hoja) ultima.current = hoja;
  const vista = hoja ?? ultima.current;
  const nodoAbierto = vista?.tipo === 'dato' ? cerebro.nodos.find((n) => n.id === vista.id) ?? null : null;
  const tituloHoja = !vista ? '' : vista.tipo === 'area' ? areaPorId(vista.area).nombre : nodoAbierto?.etiqueta ?? 'Dato';
  const cuerpoHoja = useRef<HTMLDivElement>(null);
  const claveVista = !vista ? '' : vista.tipo === 'area' ? `area:${vista.area}` : `dato:${vista.id}`;
  useEffect(() => {
    // Pasar de un área a un dato (o de un dato a otro) es otra página: arranca arriba.
    cuerpoHoja.current?.closest('.m-sheet__cuerpo')?.scrollTo({ top: 0 });
  }, [claveVista]);

  const pieHoja = (() => {
    if (vista?.tipo === 'area' && vista.area === 'documentos') {
      const hay = (conteo.documentos ?? 0) > 0;
      return (
        <PieM>
          {/* Sólo se ABRE la otra: SheetM cierra ésta y le pasa su entrada del historial (una hoja sobre otra
              reemplaza). Cerrarla además por código la sacaba con replaceState y la nueva hacía pushState:
              una entrada de más, y el segundo «atrás» no hacía nada visible (leído en SheetM, no medido). */}
          <Button variant="primary" size="lg" full onClick={() => setSubir(true)}>
            {hay ? `${R.subirMas} documentos` : 'Subir un documento'}
          </Button>
        </PieM>
      );
    }
    if (nodoAbierto && nodoAbierto.id.startsWith('doc:') && sePuedeVerDocumento(nodoAbierto.mime)) {
      return (
        <PieM>
          {/* Un <a> pelado y no el Link de la casa: es una ruta de la API (Next la prefetchearía), y el
              `?ws=` se pega a mano porque una pestaña nueva no pasa por el parche de fetch. */}
          <a className="mk-btn mk-btn--primary mk-btn--lg mk-btn--full" href={conWs(rutaVistaDocumento(nodoAbierto.id), ws)}
            target="_blank" rel="noopener noreferrer">{R.verDoc}</a>
        </PieM>
      );
    }
    return undefined;
  })();

  return (
    <>
      <CabeceraM accion={accion} />

      <div className="m-second-brain-buscar" role="search">
        <span className="m-second-brain-buscar__ico" aria-hidden><Icon name="search" size={18} /></span>
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={q}
          onChange={(e) => escribir(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder={R.buscar}
          aria-label={R.buscar}
        />
        {hayTexto && !conIA && (
          <span className="m-second-brain-buscar__n" aria-hidden>{resultados.length ? `${resultados.length}/${total}` : 'nada'}</span>
        )}
        {hayTexto && (
          <button
            type="button"
            className="m-second-brain-buscar__limpiar"
            // En modo MaKo la ✕ vuelve a la búsqueda normal (con el texto), como en escritorio.
            aria-label={conIA ? 'Volver a la búsqueda normal' : 'Borrar la búsqueda'}
            onClick={() => { if (conIA) volverANormal(); else setQ(''); }}
          >
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
      <p className="m-sr" aria-live="polite">
        {!hayTexto ? '' : ia.pensando ? R.leyendo : `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}`}
      </p>

      {hayTexto ? (
        <>
          {!conIA && (
            <div className="m-second-brain-donde">
              <SegmentadoM<DondeBuscar>
                etiqueta={R.donde}
                valor={donde}
                onCambio={setDonde}
                opciones={[{ id: 'nombre', label: R.soloNombre }, { id: 'todo', label: R.todo }]}
              />
            </div>
          )}

          {ia.pensando ? (
            <>
              <p className="m-second-brain-estado">{R.leyendo}</p>
              <SkeletonFilas filas={3} />
            </>
          ) : conIA ? (
            resultados.length ? (
              <SeccionM titulo={`${R.eligio} ${resultados.length}`}>
                <ListaM etiqueta={`${R.eligio} ${resultados.length}`}>{resultados.map((n) => filaNodo(n))}</ListaM>
              </SeccionM>
            ) : (
              <VacioM frase={ia.explico || 'MaKo no encontró nada.'} />
            )
          ) : resultados.length ? (
            <div className="m-second-brain-resultados">
              <ListaM etiqueta="Resultados">{resultados.map((n) => filaNodo(n))}</ListaM>
            </div>
          ) : (
            <VacioM
              frase={donde === 'nombre' ? 'Nada con ese nombre.' : 'Nada con esas palabras.'}
              accion={donde === 'nombre' ? { rotulo: 'Buscar en todo', onClick: () => setDonde('todo') } : undefined}
            />
          )}

          {!conIA && (
            <div className="m-second-brain-mako">
              <Button variant="mako" size="lg" full icon={<Icon name="mako" size={18} />} onClick={() => void buscarConMako()}>
                {R.conMako}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          {cerebro.cuenta.total === 0 ? (
            <VacioM frase={`${R.vacio}.`} accion={{ rotulo: R.abrirArchivero, onClick: () => setSubir(true) }} />
          ) : (
            <MapaChico cerebro={cerebro} />
          )}

          {(norte || cuello) && (
            <SeccionM titulo={R.negocio}>
              <ListaM etiqueta={R.negocio}>
                {norte && <FilaM leading={<Punto color={rellenoNodo(norte)} />} titulo={R.norte} segunda={norte.etiqueta} onClick={() => abrirNodo(norte)} />}
                {cuello && <FilaM leading={<Punto color={rellenoNodo(cuello)} />} titulo={R.cuello} segunda={cuello.etiqueta} onClick={() => abrirNodo(cuello)} />}
              </ListaM>
            </SeccionM>
          )}

          {carpetas().map((c) => (
            <SeccionM key={c.id} titulo={c.nombre}>
              <ListaM etiqueta={c.nombre}>
                {c.areas.map((a) => {
                  const n = conteo[a.id] ?? 0;
                  return (
                    <FilaM
                      key={a.id}
                      leading={<Punto color={a.color} />}
                      titulo={a.nombre}
                      navegacion
                      // El conteo dice que hay algo; «falta», que no. Nunca un 0, que se lee como un dato que vale cero.
                      riel={n ? <span className="m-second-brain-n">{n}</span> : <span className="m-second-brain-falta">falta</span>}
                      etiqueta={`${a.nombre}: ${n ? `${n} ${n === 1 ? 'dato' : 'datos'}` : 'falta'}`}
                      onClick={() => abrirArea(a.id)}
                    />
                  );
                })}
              </ListaM>
            </SeccionM>
          ))}
        </>
      )}

      <SheetM id="cerebro" abierto={hoja != null} onCerrar={() => setHoja(null)} titulo={tituloHoja} snap="alto" pie={pieHoja}>
        <div ref={cuerpoHoja}>
          {vista?.tipo === 'area' && (
            <VistaArea key={claveVista} cerebro={cerebro} area={vista.area} fila={filaNodo} />
          )}
          {vista?.tipo === 'dato' && (
            nodoAbierto
              ? <VistaDato key={claveVista} cerebro={cerebro} nodo={nodoAbierto} onArea={abrirArea} onNodo={abrirNodo} />
              : <VacioM frase="Este dato ya no está en tu mapa." />
          )}
        </div>
      </SheetM>

      <ArchiveroM abierto={subir} onCerrar={() => setSubir(false)} />
    </>
  );
}

/** Un área abierta: sus datos (el más conectado arriba) y lo que falta; completarla, en la computadora. */
function VistaArea({ cerebro, area, fila }: {
  cerebro: Cerebro;
  area: AreaId;
  fila: (n: NodoCerebro, segunda?: string) => ReactNode;
}) {
  const a = areaPorId(area);
  const { reales, pendientes } = useMemo(() => datosDelArea(cerebro, area), [cerebro, area]);
  if (reales.length + pendientes.length === 0) {
    return (
      <>
        <VacioM frase="Todavía no sé nada de esto." />
        {area !== 'documentos' && <ComputadoraM que={`Completar ${a.nombre}`} />}
      </>
    );
  }
  return (
    <>
      <ListaM etiqueta={a.nombre}>
        {reales.map((n) => fila(n, primeraLinea(n.detalle) || undefined))}
        {pendientes.map((n) => fila(n, 'Todavía no existe'))}
      </ListaM>
      {area !== 'documentos' && <ComputadoraM que={`Completar ${a.nombre}`} />}
    </>
  );
}

/** Un dato abierto: su área, lo que dice, sus datos, lo que MaKo explica, de dónde salió y con qué se conecta. */
function VistaDato({ cerebro, nodo: n, onArea, onNodo }: {
  cerebro: Cerebro;
  nodo: NodoCerebro;
  onArea: (a: AreaId) => void;
  onNodo: (n: NodoCerebro) => void;
}) {
  const [entero, setEntero] = useState(false);
  const [todas, setTodas] = useState(false);
  const a = areaPorId(n.area);
  const datos = datosConValor(n);
  const origen = deDondeSalio(n);
  const conexiones = useMemo(() => conexionesDe(cerebro, n.id), [cerebro, n.id]);
  const visibles = todas ? conexiones : conexiones.slice(0, 3);

  return (
    <>
      <button type="button" className="m-second-brain-migas" onClick={() => onArea(n.area)}>
        <Punto color={a.color} />
        <span>{a.nombre}</span>
      </button>

      {n.detalle && <p className="m-second-brain-detalle">{n.detalle}</p>}

      {datos.length > 0 && (
        <ListaM etiqueta="Datos">
          {datos.map((d, i) => (esCorto(d.v) ? <FilaDatoM key={`${d.k}-${i}`} k={d.k} v={d.v} /> : <ParLargo key={`${d.k}-${i}`} k={d.k} v={d.v} />))}
        </ListaM>
      )}

      {n.cuerpo && (
        entero
          ? <p className="m-second-brain-cuerpo">{n.cuerpo}</p>
          : (
            <button type="button" className="m-second-brain-leer" onClick={() => setEntero(true)}>
              <span>{R.leer}</span>
              <Icon name="chevron" size={16} />
            </button>
          )
      )}

      {origen && (
        <ListaM etiqueta={R.deDonde}>
          <ParLargo k={R.deDonde} v={origen} />
        </ListaM>
      )}

      {conexiones.length > 0 && (
        <SeccionM titulo={`${R.conectado} · ${conexiones.length}`}>
          <ListaM etiqueta={R.conectado}>
            {visibles.map((c) => (
              <FilaM
                key={c.nodo.id}
                leading={<Punto color={rellenoNodo(c.nodo)} apagado={c.nodo.autoria === 'pendiente'} />}
                titulo={c.nodo.etiqueta}
                segunda={c.motivo || undefined}
                onClick={() => onNodo(c.nodo)}
              />
            ))}
          </ListaM>
          {conexiones.length > 3 && !todas && (
            <button type="button" className="m-second-brain-mas" onClick={() => setTodas(true)}>
              {R.verLas} {conexiones.length}
            </button>
          )}
        </SeccionM>
      )}
    </>
  );
}
