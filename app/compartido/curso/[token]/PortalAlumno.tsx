'use client';

// =============================================================================
// PortalAlumno — lo que ve el cliente de Mauricio con su link personal
// =============================================================================
// Es la ÚNICA pantalla de MaKo que ve el cliente de un cliente. Sin el chrome de la app
// (`/compartido` lo saca: app/_components/PublicRouteGate.tsx), legible en el teléfono, y con
// la marca del PRODUCTO que compró («Negocio que Escala»), no la de MaKo.
//
// La forma: el programa por etapas, en el orden de la entrega. La ETAPA ACTUAL abierta y
// destacada; las anteriores, disponibles y marcadas hechas; las siguientes, a la vista (es el
// mapa de lo que viene) pero cerradas. Adentro de cada etapa, sus clases: título, descripción,
// video con cuánto lleva visto, y la tarea con su formulario.
//
// Qué etapa está hecha/abierta/bloqueada lo decide el server (`armarEtapas`, lib/curso-portal.ts)
// y llega armado: acá no se recalcula. Cuando un envío completa la etapa, la página se pide de
// nuevo (`router.refresh`) y la etapa nueva llega abierta.
//
// Texto de pantalla: español neutro con TÚ (los clientes de Mauricio son mexicanos), y corto.
//
// #665 (06/10/2026), tres cosas que llegan armadas del server y acá sólo se dibujan:
//   · «AGENDA TU SESIÓN» en una etapa que el alumno COMPLETÓ (`etapa.agendaUrl`): va debajo del
//     nombre de la etapa y se ve aunque la etapa esté plegada — completarla lo pasa a la siguiente
//     en el acto, así que la etapa del botón casi siempre está cerrada. Antes de completarla el link
//     no llega al navegador (lib/curso-portal.ts, `armarEtapas`).
//   · UNA CLASE POR ÁREA (`clase.areas`) se contesta una vez por área: un bloque por área, cada uno
//     con su `TareaAlumno` y su `a`. El chip de la clase dice el estado de TODAS (`estadoDeAreas`).
//   · EL LÍDER DE UN ÁREA (`vista.area`): ve sólo sus clases y no la barra de etapas del cliente (no
//     es su recorrido). Lo que el server no le mandó no se puede dibujar.
//   · EL PASO 5 (07/10/2026): una tarea con la versión de la IA esperando su ok (`clase.ia`, o
//     `area.ia`) lleva el chip «Nueva versión», y su etapa y su clase arrancan abiertas. Aprobarla o
//     corregirla es de ./TareaAlumno.tsx.

import { useMemo, useState } from 'react';
import type { VistaAlumno, ProductoVista, EtapaVista, ClaseVista, TareaDeArea } from '@/lib/curso-portal';
import type { EstadoTarea } from '@/lib/curso';
import { PCT_VISTO, ROTULO_TAREA, estadoDeAreas } from '@/lib/curso';
import { Pagina, Tabs, Status, EmptyState } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import Reproductor from './Reproductor';
import TareaAlumno from './TareaAlumno';
import { VistaPreviaCtx } from './vista-previa';

export default function PortalAlumno({ token, vista, vistaPrevia = false }: {
  token: string;
  vista: VistaAlumno;
  /**
   * La vista previa del EQUIPO (app/customer-success/curso/vista): sin alumno detrás, nada se
   * escribe (./vista-previa.ts). Las puertas de un alumno real no lo pasan nunca.
   */
  vistaPrevia?: boolean;
}) {
  const router = useRouter();
  const [productoId, setProductoId] = useState<number | null>(vista.productos[0]?.productoId ?? null);
  const producto = vista.productos.find((p) => p.productoId === productoId) ?? vista.productos[0] ?? null;

  return (
    <VistaPreviaCtx.Provider value={vistaPrevia}>
    <div className="cp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="cp-top">
        <div className="cp-top-in">
          <span className="cp-eyebrow">Programa</span>
          <span className="cp-top-nombre">{producto?.nombre ?? 'Tu programa'}</span>
        </div>
      </header>

      <Pagina style={{ padding: 'var(--cp-pad)' }}>
        <div className="cp-col">
          <h1 className="cp-h1">{vista.nombre ? `Hola, ${vista.nombre}.` : 'Hola.'}</h1>
          {vista.area && <p className="cp-area-tit">Área: <b>{vista.area}</b></p>}

          {vista.productos.length > 1 && (
            <Tabs
              tabs={vista.productos.map((p) => ({ id: String(p.productoId), label: p.nombre }))}
              activa={String(producto?.productoId ?? '')}
              onCambio={(id) => setProductoId(Number(id))}
            />
          )}

          {producto ? (
            <Producto key={producto.productoId} token={token} producto={producto} lider={vista.area != null} onAvance={() => router.refresh()} />
          ) : (
            <EmptyState titulo="Todavía no hay clases." />
          )}
        </div>
      </Pagina>

      <footer className="cp-pie">{vistaPrevia ? 'Vista previa. No se guarda nada.' : 'Este enlace es personal. No lo compartas.'}</footer>
    </div>
    </VistaPreviaCtx.Provider>
  );
}

// ── Un producto: la barra de avance y sus etapas ──────────────────────────────

function Producto({ token, producto, lider, onAvance }: { token: string; producto: ProductoVista; lider: boolean; onAvance: () => void }) {
  const iActual = Math.max(0, producto.etapas.findIndex((e) => e.estado === 'actual'));
  const actual = producto.etapas[iActual];
  // Abierta = lo que la persona eligió, y si no eligió nada, «es la actual». Se CALCULA, no se
  // dispara: cuando el server la mueve (un envío completó la etapa y la página se pidió de
  // nuevo), la nueva se abre sola y la de antes se pliega — la respuesta a «¿y ahora?» — sin un
  // efecto que tenga que enterarse del cambio.
  const [elegidas, setElegidas] = useState<Record<string, boolean>>({});
  // ⚠️ Y UNA ETAPA CON UNA VERSIÓN DE LA IA ESPERANDO SU OK TAMBIÉN ARRANCA ABIERTA (paso 5 de #665).
  // Casi siempre es la ANTERIOR: la llamada se agenda con la etapa completa, y completarla lo pasa a
  // la siguiente (lib/curso-propuesta.ts, `etapasDePropuesta`). Plegada, la propuesta no la vería.
  const abierta = (e: EtapaVista) => elegidas[e.key] ?? (e.estado === 'actual' || e.clases.some(tieneTareaIA));
  const alternar = (e: EtapaVista) => setElegidas((t) => ({ ...t, [e.key]: !abierta(e) }));

  return (
    <>
      {/* El LÍDER de un área no recibe todas las etapas (sólo las que tienen sus clases), así que
          «Etapa 2 de 3» le contaría otro recorrido que el del cliente: no se dibuja. */}
      {!lider && (
        <div className="cp-avance" aria-label={`Etapa ${iActual + 1} de ${producto.etapas.length}`}>
          <div className="cp-avance-barra" aria-hidden>
            {producto.etapas.map((e) => <i key={e.key} className={`cp-seg cp-seg--${e.estado}`} />)}
          </div>
          <p className="cp-avance-txt">
            Etapa {iActual + 1} de {producto.etapas.length}
            {actual ? <> · <b>{actual.label}</b></> : null}
          </p>
        </div>
      )}

      <ol className="cp-etapas">
        {producto.etapas.map((e, i) => (
          <Etapa key={e.key} token={token} etapa={e} numero={i + 1} abierta={abierta(e)} onAlternar={() => alternar(e)} onAvance={onAvance} />
        ))}
      </ol>
    </>
  );
}

function Etapa({ token, etapa, numero, abierta, onAlternar, onAvance }: {
  token: string; etapa: EtapaVista; numero: number; abierta: boolean; onAlternar: () => void; onAvance: () => void;
}) {
  const bloqueada = etapa.estado === 'bloqueada';
  const mostrar = !bloqueada && abierta;
  // La primera clase con algo por hacer arranca abierta; si todas están hechas, ninguna. Una con
  // la versión de la IA esperando su ok va antes que todo (paso 5 de #665): es lo que vino a ver.
  const primera = useMemo(
    () => etapa.clases.find((c) => tieneTareaIA(c))?.id
      ?? etapa.clases.find((c) => c.tieneTarea && c.estado === 'pendiente')?.id
      ?? (etapa.estado === 'actual' ? etapa.clases[0]?.id : undefined),
    [etapa.clases, etapa.estado],
  );

  const cabeza = (
    <>
      <span className={`cp-marca cp-marca--${etapa.estado}`} aria-hidden>
        {etapa.estado === 'hecha' ? '✓' : bloqueada ? <Candado /> : numero}
      </span>
      <span className="cp-etapa-tit">
        <span className="cp-etapa-nom">{etapa.label}</span>
        <span className="cp-etapa-meta">{metaDeEtapa(etapa)}</span>
      </span>
      {etapa.estado === 'actual' && <Status tono="info">Etapa actual</Status>}
      {etapa.estado === 'hecha' && <Status tono="good">Hecha</Status>}
    </>
  );

  return (
    <li className={`cp-etapa cp-etapa--${etapa.estado}`}>
      {bloqueada ? (
        <div className="cp-etapa-cab">{cabeza}</div>
      ) : (
        <button type="button" className="cp-etapa-cab cp-etapa-cab--boton" aria-expanded={mostrar} onClick={onAlternar}>
          {cabeza}
          <span className={`cp-chev${mostrar ? ' cp-chev--abierto' : ''}`} aria-hidden>›</span>
        </button>
      )}
      {/* Afuera del plegado, a propósito: ver la cabecera del archivo. Abre en otra pestaña para no
          sacarlo del portal. */}
      {etapa.agendaUrl && (
        <div className="cp-agenda">
          <a className="cp-agenda-btn" href={etapa.agendaUrl} target="_blank" rel="noopener noreferrer">Agenda tu sesión</a>
        </div>
      )}
      {mostrar && (
        etapa.clases.length ? (
          <ol className="cp-clases">
            {etapa.clases.map((c, i) => (
              <Clase key={c.id} token={token} clase={c} numero={i + 1} abiertaAlInicio={c.id === primera} onAvance={onAvance} />
            ))}
          </ol>
        ) : (
          <p className="cp-nota cp-nota--etapa">Sin clases por ahora.</p>
        )
      )}
    </li>
  );
}

/** ¿La clase trae una versión de la IA esperando su ok (la suya o la de alguna de sus áreas)? */
function tieneTareaIA(c: ClaseVista): boolean {
  return c.tieneTarea && (c.areas ? c.areas.some((a) => !!a.ia) : !!c.ia);
}

/** La línea de abajo del nombre de la etapa: qué la cierra, o cuándo se abre. */
function metaDeEtapa(e: EtapaVista): string {
  if (e.estado === 'bloqueada') return 'Se abre al terminar la etapa anterior.';
  const clases = `${e.cuantas} ${e.cuantas === 1 ? 'clase' : 'clases'}`;
  if (!e.tareas) return clases;
  return `${clases} · ${e.tareasEnviadas} de ${e.tareas} ${e.tareas === 1 ? 'tarea enviada' : 'tareas enviadas'}`;
}

// ── Una clase ─────────────────────────────────────────────────────────────────

function Clase({ token, clase, numero, abiertaAlInicio, onAvance }: {
  token: string; clase: ClaseVista; numero: number; abiertaAlInicio: boolean; onAvance: () => void;
}) {
  const [abierta, setAbierta] = useState(abiertaAlInicio);
  const [estadoUnico, setEstado] = useState<EstadoTarea>(clase.estado);
  /** Por área: lo que fue mandando cada una en esta pantalla, sobre lo que trajo el server. */
  const [deAreas, setDeAreas] = useState<Record<string, EstadoTarea>>({});
  const areas: TareaDeArea[] | undefined = clase.areas;
  // El chip de una clase por área dice el estado de TODAS sus áreas: la misma regla que la cierra.
  const estado = areas ? estadoDeAreas(areas.map((a) => deAreas[a.area] ?? a.estado)) : estadoUnico;
  const [pct, setPct] = useState<number | null>(clase.pct);
  /** Las propuestas de la IA que ya resolvió en esta pantalla (`''` = la de la clase sin áreas). */
  const [resueltas, setResueltas] = useState<ReadonlySet<string>>(new Set());
  const resolver = (k: string) => setResueltas((s) => new Set(s).add(k));
  const hayPropuesta = areas ? areas.some((a) => a.ia && !resueltas.has(a.area)) : !!clase.ia && !resueltas.has('');

  return (
    <li className={`cp-clase${abierta ? ' cp-clase--abierta' : ''}`}>
      <button type="button" className="cp-clase-cab" aria-expanded={abierta} onClick={() => setAbierta((v) => !v)}>
        <span className="cp-clase-num">{numero}</span>
        <span className="cp-clase-tit">
          <span className="cp-clase-nom">{clase.titulo}</span>
          <span className="cp-chips">
            {clase.minutos ? <span className="cp-min">{clase.minutos} min</span> : null}
            {clase.video && <ChipVisto pct={pct} />}
            {clase.tieneTarea && <ChipTarea estado={estado} />}
            {clase.tieneTarea && hayPropuesta && <Status tono="info">Nueva versión</Status>}
          </span>
        </span>
        <span className={`cp-chev${abierta ? ' cp-chev--abierto' : ''}`} aria-hidden>›</span>
      </button>

      {abierta && (
        <div className="cp-clase-cuerpo">
          {clase.descripcion.trim() && <p className="cp-desc">{clase.descripcion}</p>}
          {clase.video && (
            <Reproductor token={token} claseId={clase.id} video={clase.video} titulo={clase.titulo} onPct={(p) => setPct((a) => (a == null ? a : Math.max(a, p)))} />
          )}
          {clase.tieneTarea && areas && areas.map((a) => (
            // Una tarea por área, con el área ARRIBA: es lo único que distingue una de la otra.
            <div key={a.area} className="cp-area">
              <p className="cp-area-nom">{a.area}</p>
              <TareaAlumno
                token={token}
                claseId={clase.id}
                area={a.area}
                tarea={clase.tarea}
                campos={clase.campos}
                valoresIniciales={a.valores}
                estadoInicial={a.estado}
                propuesta={a.ia}
                onEstado={(e) => setDeAreas((m) => ({ ...m, [a.area]: e }))}
                onPropuesta={() => resolver(a.area)}
                onAvance={onAvance}
              />
            </div>
          ))}
          {clase.tieneTarea && !areas && (
            <TareaAlumno
              token={token}
              claseId={clase.id}
              tarea={clase.tarea}
              campos={clase.campos}
              valoresIniciales={clase.valores}
              estadoInicial={clase.estado}
              propuesta={clase.ia}
              onEstado={setEstado}
              onPropuesta={() => resolver('')}
              onAvance={onAvance}
            />
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Cuánto vio. `null` = este video NO se puede medir (Loom, Drive, un link de afuera): se dice
 * «Sin medir», nunca «0%», que se leería como que no lo vio.
 */
function ChipVisto({ pct }: { pct: number | null }) {
  if (pct == null) return <Status tono="neutral">Sin medir</Status>;
  if (pct >= PCT_VISTO) return <Status tono="good">Visto</Status>;
  if (pct > 0) return <Status tono="info">{`${pct}% visto`}</Status>;
  return <Status tono="neutral">Sin ver</Status>;
}

/**
 * ⚠️ LA REVISADA DICE «REVISADA» (`ROTULO_TAREA`), no «Aprobada»: desde el paso 5 de #665 el cliente
 * tiene un botón «Aprobar» (la versión de la IA), y un chip «Aprobada» al lado se leería como que la
 * aprobó él. Es la marca del EQUIPO.
 */
function ChipTarea({ estado }: { estado: EstadoTarea }) {
  if (estado === 'aprobada') return <Status tono="good">{ROTULO_TAREA.aprobada}</Status>;
  if (estado === 'enviada') return <Status tono="info">Enviada</Status>;
  return <Status tono="warn">Tarea pendiente</Status>;
}

function Candado() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// =============================================================================
// El CSS, todo bajo .cp: esta pantalla la abre alguien que no es usuario de MaKo.
// Los colores son los TOKENS de la casa (si el tema cambia, cambia acá también) y los tamaños
// de letra los --fs-*, que suben solos en pantalla chica. 16 px de margen en el teléfono y
// nada que scrollee de costado: la tabla se da vuelta en bloques.
// ⚠️ Adentro de esta cadena no va ningún acento grave ni la secuencia de interpolación: la cortan.
// =============================================================================
const CSS = `
.cp{ --cp-pad: 20px 16px 56px; --cp-ancho: 760px;
  min-height: 100vh; width: 100%; background: var(--bg); color: var(--ink);
  display: flex; flex-direction: column; }
@media (min-width: 720px){ .cp{ --cp-pad: 32px 24px 72px; } }
.cp *{ box-sizing: border-box; }

.cp-top{ position: sticky; top: 0; z-index: 10; background: var(--surface);
  border-bottom: 1px solid var(--border); }
.cp-top-in{ max-width: var(--cp-ancho); margin: 0 auto; padding: 12px 16px;
  display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.cp-eyebrow{ font-family: 'Geist Mono', ui-monospace, monospace; font-size: var(--fs-meta);
  letter-spacing: .12em; text-transform: uppercase; color: var(--faint); flex: none; }
.cp-top-nombre{ font-size: var(--fs-md); font-weight: 600; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cp-col{ max-width: var(--cp-ancho); margin: 0 auto; min-width: 0; }
.cp-h1{ margin: 0 0 16px; font-size: var(--fs-page); line-height: 1.15; letter-spacing: -.02em; font-weight: 700; }
.cp-area-tit{ margin: -8px 0 20px; font-size: var(--fs-md); color: var(--dim); overflow-wrap: anywhere; }
.cp-area-tit b{ color: var(--ink); font-weight: 600; }

.cp-agenda{ padding: 0 16px 14px 56px; }
@media (max-width: 560px){ .cp-agenda{ padding: 0 16px 14px; } }
.cp-agenda-btn{ display: inline-flex; align-items: center; min-height: var(--touch); padding: 0 16px; border-radius: 10px;
  background: var(--primary); color: var(--on-primary); font-size: var(--fs-md); font-weight: 600; text-decoration: none; }
.cp-agenda-btn:hover{ filter: brightness(1.05); }
.cp-agenda-btn:focus-visible{ outline: 2px solid var(--primary); outline-offset: 2px; }

.cp-area{ display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cp-area-nom{ margin: 0; padding-top: 12px; border-top: 1px solid var(--border); font-size: var(--fs-md); font-weight: 600; overflow-wrap: anywhere; }

.cp-avance{ margin: 0 0 24px; }
.cp-avance-barra{ display: flex; gap: 4px; }
.cp-seg{ flex: 1; height: 6px; border-radius: 3px; background: var(--border); }
.cp-seg--hecha{ background: var(--good); }
.cp-seg--actual{ background: var(--primary); }
.cp-avance-txt{ margin: 8px 0 0; font-size: var(--fs-sm); color: var(--dim); }
.cp-avance-txt b{ color: var(--ink); font-weight: 600; }

.cp-etapas, .cp-clases, .cp-campos{ list-style: none; margin: 0; padding: 0; }
.cp-etapa{ border: 1px solid var(--border); border-radius: 14px; background: var(--surface);
  margin: 0 0 10px; overflow: hidden; }
.cp-etapa--actual{ border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-bg); }
.cp-etapa--bloqueada{ background: transparent; border-style: dashed; }
.cp-etapa-cab{ display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px;
  min-height: var(--touch); text-align: left; background: none; border: 0; color: inherit; font: inherit; }
.cp-etapa-cab--boton{ cursor: pointer; }
.cp-etapa-cab--boton:hover{ background: var(--velo-hover); }
.cp-etapa-cab--boton:focus-visible{ outline: 2px solid var(--primary); outline-offset: -2px; }
.cp-marca{ flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
  font-size: var(--fs-meta); font-weight: 600; background: var(--surface-2); color: var(--dim); }
.cp-marca--actual{ background: var(--primary); color: var(--on-primary); }
.cp-marca--hecha{ background: var(--good-bg); color: var(--good); }
.cp-etapa-tit{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cp-etapa-nom{ font-size: var(--fs-card); font-weight: 600; }
.cp-etapa--bloqueada .cp-etapa-nom{ color: var(--dim); }
.cp-etapa-meta{ font-size: var(--fs-meta); color: var(--faint); }
.cp-chev{ flex: none; color: var(--faint); font-size: 20px; line-height: 1; transition: transform .15s; }
.cp-chev--abierto{ transform: rotate(90deg); }

.cp-clases{ border-top: 1px solid var(--border); }
.cp-clase{ border-bottom: 1px solid var(--border); }
.cp-clase:last-child{ border-bottom: 0; }
.cp-clase-cab{ display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 14px 16px;
  min-height: var(--touch); text-align: left; background: none; border: 0; color: inherit; font: inherit; cursor: pointer; }
.cp-clase-cab:hover{ background: var(--velo-hover); }
.cp-clase-cab:focus-visible{ outline: 2px solid var(--primary); outline-offset: -2px; }
.cp-clase-num{ flex: none; width: 22px; padding-top: 2px; font-size: var(--fs-meta); color: var(--faint);
  font-variant-numeric: tabular-nums; }
.cp-clase-tit{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.cp-clase-nom{ font-size: var(--fs-md); font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
.cp-chips{ display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.cp-min{ font-size: var(--fs-meta); color: var(--faint); }
.cp-clase-cuerpo{ padding: 0 16px 20px 50px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
@media (max-width: 560px){ .cp-clase-cuerpo{ padding: 0 16px 20px; } }
.cp-desc{ margin: 0; font-size: var(--fs-md); line-height: 1.6; color: var(--dim); white-space: pre-wrap; overflow-wrap: anywhere; }

.cp-video{ position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: 10px; overflow: hidden; }
.cp-video iframe, .cp-video video{ position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.cp-video--nativo video{ object-fit: contain; background: #000; }
.cp-afuera{ display: flex; }
.cp-nota{ margin: 0; font-size: var(--fs-sm); color: var(--faint); }
.cp-nota--etapa{ padding: 0 16px 16px 56px; }

.cp-tarea{ border-top: 1px dashed var(--border-strong); padding-top: 16px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.cp-tarea-instr{ margin: 0; font-size: var(--fs-md); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.cp-campo{ padding: 14px 0; border-top: 1px solid var(--border); min-width: 0; }
.cp-campo:first-child{ border-top: 0; padding-top: 0; }
.cp-preg{ display: block; margin: 0 0 6px; padding: 0; font-size: var(--fs-md); font-weight: 600; line-height: 1.45; overflow-wrap: anywhere; }
.cp-req{ color: var(--bad); }
.cp-ayuda{ margin: 0 0 8px; font-size: var(--fs-sm); line-height: 1.5; color: var(--dim); }
.cp-fieldset{ border: 0; margin: 0; padding: 0; min-width: 0; display: flex; flex-direction: column; }

.cp-tabla-caja{ display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0; width: 100%; }
.cp-tabla{ width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.cp-tabla th{ text-align: left; font-size: var(--fs-meta); font-weight: 600; color: var(--faint);
  padding: 0 8px 6px; letter-spacing: .04em; }
.cp-tabla td{ border-top: 1px solid var(--border); padding: 0; vertical-align: top; }
.cp-fija{ display: block; padding: 10px 8px; font-weight: 600; }
.cp-celda{ width: 100%; min-height: var(--touch); border: 0; background: none; padding: 10px 8px;
  font: inherit; font-size: var(--fs-md); color: var(--ink); }
.cp-celda:focus{ outline: none; background: var(--primary-bg); }
@media (max-width: 640px){
  .cp-tabla thead{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .cp-tabla, .cp-tabla tbody, .cp-tabla tr, .cp-tabla td{ display: block; width: 100%; }
  .cp-tabla tr{ border-top: 1px solid var(--border); padding: 8px 0; }
  .cp-tabla td{ border: 0; }
  .cp-tabla td::before{ content: attr(data-col); display: block; padding: 6px 0 0; font-size: var(--fs-meta);
    color: var(--faint); font-weight: 600; }
  .cp-tabla td[data-col=""]::before{ display: none; }
  .cp-fija, .cp-celda{ padding-left: 0; padding-right: 0; }
  .cp-celda{ border-bottom: 1px solid var(--border); }
}

/* La version de la IA (paso 5): debajo de la suya, en una caja tenue para que se lea como otra. */
.cp-prop{ display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 12px;
  background: var(--primary-bg); border: 1px solid var(--border); min-width: 0; }
.cp-prop-tit{ margin: 0; font-size: var(--fs-md); font-weight: 600; color: var(--ink); }

.cp-aviso{ margin: 0; font-size: var(--fs-sm); font-weight: 500; }
.cp-aviso--falta{ color: var(--warn); }
.cp-aviso--ok{ color: var(--good); }
.cp-aviso--error{ color: var(--bad); }
.cp-tarea-pie{ display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.cp-guardado{ font-size: var(--fs-meta); color: var(--faint); }
.cp-guardado--guardado{ color: var(--good); }
.cp-guardado--error{ color: var(--bad); }

.cp-pie{ margin-top: auto; padding: 20px 16px 28px; text-align: center; font-size: var(--fs-meta); color: var(--faint); }
@media (prefers-reduced-motion: reduce){ .cp *{ transition: none !important; } }
`;
