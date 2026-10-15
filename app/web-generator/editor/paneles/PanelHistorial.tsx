'use client';

// =============================================================================
// PanelHistorial — «Historial de versiones» (Gamma: ⋯ → Historial de versiones…)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Diseño:
// docs/diseno-editor-landing.md (D8: se guarda una versión al publicar, antes de aplicar un
// cambio de la IA, al restaurar, a mano y sola cada 10 minutos de edición — el server decide).
// Gamma (relevo gamma-ui §5.12.5, layout sin confirmar): la lista de versiones y «Restaurar esta
// versión», con «¿Restaurar esta versión?» antes. Acá: el panel derecho con la lista (fecha,
// motivo, autor), «Guardar versión», y la vista previa de una versión en un visor grande con el
// render público (`htmlDePagina`), que es donde se restaura.
//
// ⚠️ GUARDAR Y RESTAURAR MANDAN LO PENDIENTE PRIMERO (`guardarAhora`). Las dos operaciones del
//    server leen la FILA guardada: sin ese paso, «Guardar versión» guardaría lo de hace un respiro
//    del autoguardado, y la instantánea «Antes de restaurar» perdería lo último que se escribió.
// ⚠️ DESPUÉS DE RESTAURAR, `recargar()`: el documento cambió en el server y el armazón es el
//    único dueño del documento de la pantalla (contexto.ts). Este panel no toca el editor.
// ⚠️ La confirmación va en el PIE del visor y no en un `Confirm` encima: el Escape de un Confirm
//    encima de un `Modal` lo contestan los dos (el Confirm no se registra en la pila de modales),
//    y una tecla cerraba la pregunta y el visor juntos.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import { useEditorLanding } from '../contexto';
import type { TemaPropio, VersionResumen } from '@/lib/editor-landing/api-tipos';
import type { VersionCompleta } from '@/lib/editor-landing/server';
import { temaPorId, type Tema } from '@/lib/editor-landing/temas';
import { htmlDePagina } from '@/lib/editor-landing/render';
import { EstilosContenido, EstilosPanelesB, Ico, pedirDocs, useAncho } from './PanelAgente';

/** «11 oct, 14:32». */
export function fechaVersion(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** «Hoy», «Ayer» o «11 de octubre»: el día de cada grupo de la lista. */
function diaDe(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  const mismo = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismo(d, hoy)) return 'Hoy';
  if (mismo(d, ayer)) return 'Ayer';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long', ...(d.getFullYear() !== hoy.getFullYear() ? { year: 'numeric' } : {}) });
}

export function PanelHistorial({ onCerrar }: { onCerrar?: () => void } = {}) {
  const ctx = useEditorLanding();
  const { docId, paginaActual, config, tema, guardarAhora, recargar, setPanelDer, avisar } = ctx;
  const [versiones, setVersiones] = useState<VersionResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<VersionResumen | null>(null);

  const cargar = useCallback(async () => {
    const r = await pedirDocs({ accion: 'versiones', id: docId });
    if (!r.ok) { setError('No se pudo cargar el historial.'); return; }
    setError(null);
    setVersiones([...r.versiones].sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado)));
  }, [docId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- es sincronizar con el server: la lista llega por la red
  useEffect(() => { void cargar(); }, [cargar]);

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    setFalla(null);
    await guardarAhora();
    // Sin motivo: el server pone el de «a mano» (MOTIVO.manual, server-reglas.ts). Un solo lugar.
    const r = await pedirDocs({ accion: 'guardarVersion', id: docId, motivo: '' });
    setGuardando(false);
    if (!r.ok) { setFalla(r.error); return; }
    setVersiones((vs) => [r.version, ...(vs ?? []).filter((v) => v.id !== r.version.id)]);
    avisar('Versión guardada');
  };

  const grupos = useMemo(() => {
    const out: { dia: string; lista: VersionResumen[] }[] = [];
    for (const v of versiones ?? []) {
      const dia = diaDe(v.creado);
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.dia === dia) ultimo.lista.push(v);
      else out.push({ dia, lista: [v] });
    }
    return out;
  }, [versiones]);

  return (
    <aside className="gma gma-pb gma-hi" aria-label="Historial de versiones">
      <EstilosPanelesB />
      <style href="gma-historial" precedence="medium">{CSS_HISTORIAL}</style>
      <header className="gma-hi-cab">
        <h2 className="gma-hi-h">Historial de versiones</h2>
        <button type="button" className="gma-pb-iconbtn" onClick={() => (onCerrar ? onCerrar() : setPanelDer(null))} aria-label="Cerrar" title="Cerrar"><Ico n="cerrar" t={16} /></button>
      </header>
      <div className="gma-hi-guardar">
        <button type="button" className="gma-pb-boton" data-v="secundario" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? <span className="gma-pb-giro" aria-hidden /> : <Ico n="historial" t={15} />} Guardar versión
        </button>
      </div>
      {falla && <p className="gma-rv-error gma-hi-falla" role="alert">{falla}</p>}
      <div className="gma-hi-lista">
        {error && (
          <div className="gma-hi-vacio" role="alert">
            <span>{error}</span>
            <button type="button" className="gma-pb-boton" data-v="contorno" data-t="s" onClick={() => { setError(null); void cargar(); }}>Reintentar</button>
          </div>
        )}
        {!error && versiones === null && <div className="gma-hi-vacio"><span className="gma-pb-giro" aria-label="Cargando" /></div>}
        {versiones !== null && versiones.length === 0 && <div className="gma-hi-vacio">Todavía no hay versiones.</div>}
        {grupos.map((g) => (
          <section key={g.dia} className="gma-hi-grupo">
            <div className="gma-hi-dia">{g.dia}</div>
            {g.lista.map((v) => (
              <button key={v.id} type="button" className="gma-hi-fila" aria-pressed={abierta?.id === v.id} onClick={() => setAbierta(v)}>
                <span className="gma-hi-hora">{new Date(v.creado).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="gma-hi-motivo">{v.motivo}</span>
                {v.autor && <span className="gma-hi-autor">{v.autor}</span>}
              </button>
            ))}
          </section>
        ))}
      </div>
      {abierta && (
        <VisorVersion
          key={abierta.id}
          version={abierta}
          docId={docId}
          paginaActual={paginaActual}
          temaActual={tema}
          temaIdActual={config.tema}
          onCerrar={() => setAbierta(null)}
          onRestaurar={async () => {
            await guardarAhora();
            const r = await pedirDocs({ accion: 'restaurarVersion', id: docId, versionId: abierta.id });
            if (!r.ok) return r.conflicto ? 'Hay una versión más nueva. Recarga la página.' : 'No se pudo restaurar esta versión.';
            await recargar();
            setAbierta(null);
            avisar('Versión restaurada');
            void cargar();
            return null;
          }}
        />
      )}
    </aside>
  );
}

export default PanelHistorial;

/** Los temas propios del workspace, una vez por pestaña (para dibujar una versión con un tema 'ws:'). */
let temasPropiosPromesa: Promise<TemaPropio[]> | null = null;
function temasPropios(): Promise<TemaPropio[]> {
  if (!temasPropiosPromesa) {
    temasPropiosPromesa = pedirDocs({ accion: 'temas' }).then((r) => {
      if (r.ok) return r.temas;
      temasPropiosPromesa = null;
      return [];
    });
  }
  return temasPropiosPromesa;
}

/**
 * El visor de UNA versión: la página dibujada con el render público, a la escala del visor (la
 * sección mide 64.5em y la página deja 2em de aire por lado: `--gm-base` = ancho / 68.5, la misma
 * cuenta que usa la hoja con el ancho de la ventana).
 */
function VisorVersion({ version, docId, paginaActual, temaActual, temaIdActual, onCerrar, onRestaurar }: {
  version: VersionResumen;
  docId: number;
  paginaActual: string;
  temaActual: Tema;
  temaIdActual: string;
  onCerrar: () => void;
  /** Devuelve el error a mostrar, o null si salió. */
  onRestaurar: () => Promise<string | null>;
}) {
  const [completa, setCompleta] = useState<VersionCompleta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState<string | null>(null);
  const [propios, setPropios] = useState<TemaPropio[] | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);
  const cerrar = useCerrarEstable(onCerrar, restaurando);
  const lienzoRef = useRef<HTMLDivElement>(null);
  const ancho = useAncho(lienzoRef);

  // Una versión por montaje (el padre le pone `key`): no hay estado de otra que limpiar.
  useEffect(() => {
    let vivo = true;
    void pedirDocs({ accion: 'version', id: docId, versionId: version.id }).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setError('No se pudo abrir esta versión.'); return; }
      setCompleta(r.version);
      const paginas = r.version.contenido.paginas;
      setPagina(paginas.some((p) => p.id === paginaActual) ? paginaActual : paginas[0]?.id ?? null);
    });
    return () => { vivo = false; };
  }, [docId, version.id, paginaActual]);

  const temaId = completa?.config.tema ?? temaIdActual;
  useEffect(() => {
    if (!temaId.startsWith('ws:') || temaId === temaIdActual) return;
    let vivo = true;
    void temasPropios().then((t) => { if (vivo) setPropios(t); });
    return () => { vivo = false; };
  }, [temaId, temaIdActual]);

  const temaV = useMemo(() => (temaId === temaIdActual ? temaActual : temaPorId(temaId, propios)), [temaId, temaIdActual, temaActual, propios]);
  const pag = completa?.contenido.paginas.find((p) => p.id === pagina) ?? null;
  const html = useMemo(() => {
    if (!completa || !pag) return '';
    try { return htmlDePagina(pag, completa.config, temaV, { modo: 'exportar', paginas: completa.contenido.paginas }); } catch { return ''; }
  }, [completa, pag, temaV]);

  const restaurar = async () => {
    setRestaurando(true);
    setFalla(null);
    const e = await onRestaurar();
    setRestaurando(false);
    if (e) setFalla(e);
  };

  const pie = confirmando
    ? (
      <div className="gma gma-pb gma-hi-pie">
        <span className="gma-hi-pregunta">{falla ?? 'Lo de ahora queda en el historial.'}</span>
        <button type="button" className="gma-pb-boton" data-v="fantasma" onClick={() => setConfirmando(false)} disabled={restaurando}>Cancelar</button>
        <button type="button" className="gma-pb-boton" data-v="primario" onClick={() => void restaurar()} disabled={restaurando}>
          {restaurando && <span className="gma-pb-giro" aria-hidden />} Restaurar
        </button>
      </div>
    )
    : (
      <div className="gma gma-pb gma-hi-pie">
        <button type="button" className="gma-pb-boton" data-v="fantasma" onClick={cerrar}>Cerrar</button>
        <button type="button" className="gma-pb-boton" data-v="primario" onClick={() => setConfirmando(true)} disabled={!completa}>Restaurar esta versión</button>
      </div>
    );

  return (
    <Modal titulo={fechaVersion(version.creado)} encabezado={<span className="gma-hi-encabezado">{version.motivo}{version.autor ? ` · ${version.autor}` : ''}</span>} onCerrar={cerrar} ancho={1040} alto="min(88vh, 900px)" pie={pie} sinFiletes>
      <EstilosPanelesB />
      <style href="gma-historial" precedence="medium">{CSS_HISTORIAL}</style>
      {completa && <EstilosContenido tema={temaV} />}
      <div className="gma gma-pb gma-hi-visor">
        {completa && completa.contenido.paginas.length > 1 && (
          <div className="gma-pb-segmento gma-hi-paginas" role="group" aria-label="Página">
            {completa.contenido.paginas.map((p) => (
              <button key={p.id} type="button" aria-pressed={p.id === pagina} onClick={() => setPagina(p.id)}>{p.titulo || 'Sin título'}</button>
            ))}
          </div>
        )}
        {error && <div className="gma-hi-vacio" role="alert">{error}</div>}
        {!error && !completa && <div className="gma-hi-vacio"><span className="gma-pb-giro" aria-label="Cargando" /></div>}
        <div
          ref={lienzoRef}
          className="gma-hi-lienzo"
          style={{ ['--gm-base' as string]: ancho ? `${ancho / 68.5}px` : undefined, visibility: ancho && html ? 'visible' : 'hidden' } as CSSProperties}
          inert
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </Modal>
  );
}

const CSS_HISTORIAL = `
.gma-hi{display:flex;flex-direction:column;width:340px;max-width:100%;height:100%;min-height:0;background:var(--pb-fondo);border-left:1px solid var(--pb-borde)}
.gma-hi-cab{display:flex;align-items:center;justify-content:space-between;gap:8px;height:52px;flex:none;padding:0 10px 0 16px}
.gma-hi-h{margin:0;font-size:18px;font-weight:700;color:var(--pb-titulo)}
.gma-hi-guardar{flex:none;padding:0 16px 12px}
.gma-hi-falla{margin:0 16px 10px}
.gma-hi-lista{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:14px;padding:0 10px 16px}
.gma-hi-grupo{display:grid;gap:2px}
.gma-hi-dia{padding:4px 6px;font-size:11.5px;font-weight:700;color:var(--pb-suave)}
.gma-hi-fila{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:10px;row-gap:1px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:var(--pb-texto);font:inherit;text-align:left;cursor:pointer}
.gma-hi-fila:hover{background:var(--pb-sup)}
.gma-hi-fila[aria-pressed="true"]{background:var(--pb-celeste);color:var(--pb-tinta)}
.gma-hi-hora{grid-row:span 2;font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--pb-tenue);padding-top:1px}
.gma-hi-motivo{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gma-hi-autor{font-size:12px;color:var(--pb-suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gma-hi-vacio{display:grid;justify-items:center;gap:10px;padding:28px 8px;color:var(--pb-suave);font-size:13px;text-align:center}
.gma-hi-encabezado{font-size:12px;color:var(--pb-suave,#8b8b90)}
.gma-hi-visor{display:grid;gap:12px}
.gma-hi-paginas{justify-self:start;flex-wrap:wrap}
.gma-hi-lienzo{width:100%;border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px var(--pb-borde)}
.gma-hi-pie{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;width:100%}
.gma-hi-pregunta{margin-right:auto;font-size:13px;color:var(--pb-texto)}
`;
