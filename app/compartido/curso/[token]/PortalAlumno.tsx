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

import { useMemo, useState } from 'react';
import type { VistaAlumno, ProductoVista, EtapaVista, ClaseVista } from '@/lib/curso-portal';
import type { EstadoTarea } from '@/lib/curso';
import { PCT_VISTO } from '@/lib/curso';
import { Pagina, Tabs, Status, EmptyState } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import Reproductor from './Reproductor';
import TareaAlumno from './TareaAlumno';

export default function PortalAlumno({ token, vista }: { token: string; vista: VistaAlumno }) {
  const router = useRouter();
  const [productoId, setProductoId] = useState<number | null>(vista.productos[0]?.productoId ?? null);
  const producto = vista.productos.find((p) => p.productoId === productoId) ?? vista.productos[0] ?? null;

  return (
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

          {vista.productos.length > 1 && (
            <Tabs
              tabs={vista.productos.map((p) => ({ id: String(p.productoId), label: p.nombre }))}
              activa={String(producto?.productoId ?? '')}
              onCambio={(id) => setProductoId(Number(id))}
            />
          )}

          {producto ? (
            <Producto key={producto.productoId} token={token} producto={producto} onAvance={() => router.refresh()} />
          ) : (
            <EmptyState titulo="Todavía no hay clases." />
          )}
        </div>
      </Pagina>

      <footer className="cp-pie">Este enlace es personal. No lo compartas.</footer>
    </div>
  );
}

// ── Un producto: la barra de avance y sus etapas ──────────────────────────────

function Producto({ token, producto, onAvance }: { token: string; producto: ProductoVista; onAvance: () => void }) {
  const iActual = Math.max(0, producto.etapas.findIndex((e) => e.estado === 'actual'));
  const actual = producto.etapas[iActual];
  // Abierta = lo que la persona eligió, y si no eligió nada, «es la actual». Se CALCULA, no se
  // dispara: cuando el server la mueve (un envío completó la etapa y la página se pidió de
  // nuevo), la nueva se abre sola y la de antes se pliega — la respuesta a «¿y ahora?» — sin un
  // efecto que tenga que enterarse del cambio.
  const [elegidas, setElegidas] = useState<Record<string, boolean>>({});
  const abierta = (e: EtapaVista) => elegidas[e.key] ?? e.estado === 'actual';
  const alternar = (e: EtapaVista) => setElegidas((t) => ({ ...t, [e.key]: !abierta(e) }));

  return (
    <>
      <div className="cp-avance" aria-label={`Etapa ${iActual + 1} de ${producto.etapas.length}`}>
        <div className="cp-avance-barra" aria-hidden>
          {producto.etapas.map((e) => <i key={e.key} className={`cp-seg cp-seg--${e.estado}`} />)}
        </div>
        <p className="cp-avance-txt">
          Etapa {iActual + 1} de {producto.etapas.length}
          {actual ? <> · <b>{actual.label}</b></> : null}
        </p>
      </div>

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
  // La primera clase con algo por hacer arranca abierta; si todas están hechas, ninguna.
  const primera = useMemo(
    () => etapa.clases.find((c) => c.tieneTarea && c.estado === 'pendiente')?.id
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

/** La línea de abajo del nombre de la etapa: qué la cierra, o cuándo se abre. */
function metaDeEtapa(e: EtapaVista): string {
  if (e.estado === 'bloqueada') return 'Se abre al terminar la etapa anterior.';
  const clases = `${e.cuantas} ${e.cuantas === 1 ? 'clase' : 'clases'}`;
  if (!e.obligatorias) return clases;
  return `${clases} · ${e.enviadas} de ${e.obligatorias} ${e.obligatorias === 1 ? 'tarea enviada' : 'tareas enviadas'}`;
}

// ── Una clase ─────────────────────────────────────────────────────────────────

function Clase({ token, clase, numero, abiertaAlInicio, onAvance }: {
  token: string; clase: ClaseVista; numero: number; abiertaAlInicio: boolean; onAvance: () => void;
}) {
  const [abierta, setAbierta] = useState(abiertaAlInicio);
  const [estado, setEstado] = useState<EstadoTarea>(clase.estado);
  const [pct, setPct] = useState<number | null>(clase.pct);

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
          {clase.tieneTarea && (
            <TareaAlumno
              token={token}
              claseId={clase.id}
              tarea={clase.tarea}
              campos={clase.campos}
              valoresIniciales={clase.valores}
              estadoInicial={clase.estado}
              onEstado={setEstado}
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

function ChipTarea({ estado }: { estado: EstadoTarea }) {
  if (estado === 'aprobada') return <Status tono="good">Aprobada</Status>;
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
