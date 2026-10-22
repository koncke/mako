'use client';

// =============================================================================
// SecondBrainM — el grafo del Second Brain a pantalla entera, y la hoja de un área o un dato
// =============================================================================
// Desde el 22/10/2026 (Martín, pedido 4a15e2c3) la pantalla ES el grafo: no hay portada con «Abrir el grafo». Buscar va
// arriba del grafo; «Lo último» y las áreas, en su barra lateral («Áreas» en vertical); subir al Archivero, en el «+» de
// su barra. Tocar «Editar» de un área (o entrar con `?area=`) abre UNA hoja (Notion: la página como hoja, las propiedades
// como filas nombre → valor) ENCIMA del grafo, que navega adentro: área → dato → dato conectado. «Atrás» cierra la hoja,
// y el «‹» del grafo sale del Second Brain.
//
// ⚠️ Nada de lo que llega del server se copia a un estado: refrescar trae el cerebro nuevo y la hoja
//    abierta se vuelve a leer por id (si el dato ya no está, lo dice).
// ⚠️ La hoja guarda su última vista mientras se cierra: sin eso, los 220 ms de la salida bajan vacíos.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useWs } from '@/app/_ui/Link';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { conWs } from '@/lib/ws-tab';
import type { AreaId, Cerebro, NodoCerebro } from '@/lib/cerebro-modelo';
import {
  AUTORIA_CORTA, agruparConexiones, contarPorArea, fechaCortaNodo, rellenoNodo, rutaVistaDocumento, sePuedeVerDocumento, tipoDeNodo,
  OPACIDAD_PENDIENTE,
} from '@/lib/cerebro-areas';
import { AUTORIA_TEXTO } from '@/lib/cerebro-modelo';
import {
  ComputadoraM, FilaDatoM, FilaM, ListaM, PieM, SeccionM, SheetM, VacioM,
} from '@/app/m/_ui';
import {
  R, areaPorId, carpetaDeArea, conexionesDe, datosConValor, datosDelArea, deDondeSalio, esCorto, primeraLinea,
} from './modelo';
import { ArchiveroM } from './ArchiveroM';
import { TITULO_SECOND_BRAIN, VistaCerebro } from '@/app/second-brain/VistaCerebro';

type Hoja = { tipo: 'area'; area: AreaId } | { tipo: 'dato'; id: string };

/** «12 oct»: la misma regla de la barra lateral de la computadora (lib/cerebro-areas.ts). */
const fechaCorta = fechaCortaNodo;

/** El punto de color de un área o un dato, en su baldosa oscura (el lienzo de escritorio, en chico). */
export function Punto({ color, apagado = false }: { color: string; apagado?: boolean }) {
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

export function SecondBrainM({ cerebro, grafo = cerebro, areaInicial }: {
  /** El negocio: las hojas de un área y de un dato. */
  cerebro: Cerebro;
  /** Lo que se DIBUJA (el grafo entero): para quien opera, UN cerebro con la construcción de MaKo adentro (mapa/page.tsx).
   *  Martín, 20/10/2026: «En ningún caso jamás los cerebros se deben dividir en 2». */
  grafo?: Cerebro<string>;
  areaInicial: AreaId | null;
}) {
  const ws = useWs();
  const router = useRouter();
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [subir, setSubir] = useState(false);
  // EL GRAFO ES LA PANTALLA (22/10/2026, Martín desde el Centro, pedido 4a15e2c3: «no quiero que siga existiendo la vista
  // "Abrir Grafo", por defecto SIEMPRE abierto»). Hasta ese día el grafo era una capa encima de una portada (la foto del
  // mapa con «Abrir el grafo», el buscador, «Lo último» y las carpetas con su «falta»), y cerrarlo dejaba la portada. Lo que
  // tenía la portada sigue en el grafo: buscar arriba, «Lo último» y las áreas en su barra lateral («Áreas» en vertical), y
  // subir al Archivero en el «+» de su barra. Su «atrás» sale del Second Brain.
  // El portal necesita el documento: recién después de montar (el servidor no lo tiene).
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);
  /** Salir del Second Brain: a la pantalla de antes; si se entró directo (sin historial), al Ops Center del teléfono. */
  const salir = () => {
    if (window.history.length > 1) router.back();
    else router.replace('/m/second-brain');   // el router de la casa le pega el ?ws=
  };

  // `?area=` (la clave de escritorio): entra con esa área abierta, encima del grafo. El parámetro se saca de la URL
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

  const conteo = useMemo(() => contarPorArea(cerebro.nodos), [cerebro.nodos]);

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
    // Lo que se edita en otra pantalla (una oferta en Offer, un funnel en el CRM) lleva ahí, como en la barra lateral.
    if (nodoAbierto?.href) {
      return (
        <PieM>
          <ButtonLink href={nodoAbierto.href} variant="primary" size="lg" full>{`Abrir en ${nodoAbierto.abrirEn ?? 'su pantalla'}`}</ButtonLink>
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
      {/* El título, para quien no ve el grafo (un lector de pantalla). */}
      <h1 className="m-sr">{TITULO_SECOND_BRAIN}</h1>

      {/* Las hojas (capa 80) van ENCIMA del grafo (60): «Editar» de un área y `?area=` las abren sin cerrarlo. */}
      <SheetM id="cerebro" abierto={hoja != null} onCerrar={() => setHoja(null)} titulo={tituloHoja} snap="alto" pie={pieHoja}>
        <div ref={cuerpoHoja}>
          {vista?.tipo === 'area' && (
            <VistaArea key={claveVista} cerebro={cerebro} area={vista.area} fila={filaNodo} />
          )}
          {vista?.tipo === 'dato' && (
            nodoAbierto
              ? <VistaDato key={claveVista} cerebro={cerebro} nodo={nodoAbierto} onArea={abrirArea} onNodo={abrirNodo} />
              : <VacioM frase="Este dato ya no está en tu Second Brain." />
          )}
        </div>
      </SheetM>

      <ArchiveroM abierto={subir} onCerrar={() => setSubir(false)} />

      {/* El grafo, a pantalla entera: ES la pantalla. En `#m-root` y no en el <body>: ahí viven los tokens del teléfono
          (`[data-m]`: los tamaños de letra, el toque de 44). UN cerebro: el negocio y, para el super admin, la
          construcción de MaKo colgada de la misma raíz, con las capas como filtro (VistaCerebro). */}
      {montado && createPortal(
        <div className="m-second-brain-grafo" data-tema="oscuro" role="region" aria-label={TITULO_SECOND_BRAIN}>
          <VistaCerebro
            movil
            cerebro={grafo}
            funnelPanel={null}
            alCerrar={salir}
            alEditarArea={abrirArea}
            accionMovil={(
              <button type="button" className="cbg-ico" aria-label={R.abrirArchivero} title={R.abrirArchivero} onClick={() => setSubir(true)}>
                <Icon name="plus" size={18} />
              </button>
            )}
          />
        </div>,
        document.getElementById('m-root') ?? document.body,
      )}
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
  // Agrupadas por área con la MISMA regla de la barra lateral de la computadora (lib/cerebro-areas.ts).
  const grupos = useMemo(() => agruparConexiones(conexiones, todas ? null : 3), [conexiones, todas]);
  const nace = fechaCorta(n.nace);

  return (
    <>
      <button type="button" className="m-second-brain-migas" onClick={() => onArea(n.area)}>
        <Punto color={a.color} />
        <span>{a.nombre}</span>
      </button>

      {/* Qué clase de cosa es y quién la puso: lo mismo que arriba del título en la barra lateral de la computadora. */}
      <p className="m-second-brain-tipo">{tipoDeNodo(n)}</p>
      <div className="m-second-brain-pastillas">
        <span className="m-second-brain-pastilla" data-autoria={n.autoria} title={AUTORIA_TEXTO[n.autoria]}>{AUTORIA_CORTA[n.autoria]}</span>
        {n.destacado && <span className="m-second-brain-pastilla" data-tono="mako">{R.norte}</span>}
        {n.alerta && <span className="m-second-brain-pastilla" data-tono="warn">Cuello de botella</span>}
        {nace && <span className="m-second-brain-pastilla">{nace}</span>}
      </div>

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
          {grupos.map((g) => (
            <div key={g.area} className="m-second-brain-grupo">
              <p className="m-second-brain-grupo__nombre">{areaPorId(g.area).nombre}</p>
              <ListaM etiqueta={`${R.conectado}: ${areaPorId(g.area).nombre}`}>
                {g.items.map((c) => (
                  <FilaM
                    key={c.nodo.id}
                    leading={<Punto color={rellenoNodo(c.nodo)} apagado={c.nodo.autoria === 'pendiente'} />}
                    titulo={c.nodo.etiqueta}
                    segunda={c.motivo || undefined}
                    onClick={() => onNodo(c.nodo)}
                  />
                ))}
              </ListaM>
            </div>
          ))}
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
