'use client';

// =============================================================================
// PanelComentarios — los comentarios por sección (panel derecho de Gamma)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Diseño:
// docs/diseno-editor-landing.md (D8: «Comentarios por sección, con respuestas y "Resolver"»).
// Lo que se copia de Gamma (relevo gamma-ui §5.12.3 y el catálogo de textos): el panel derecho
// con el filtro «Abiertos / Cerrados» («No hay comentarios abiertos» / «No hay comentarios
// cerrados»), «Agregar un comentario», «Responder», «Marcar como cerrado» / «Marcar como
// abierto» («Comentario reabierto»), «Eliminar respuesta».
// Lo que cambia: Gamma ancla un comentario a un BLOQUE y agrupa por fecha; acá el comentario es
// de una SECCIÓN (la tabla `landing_doc_comentarios` guarda `tarjeta_id`) y se agrupa por sección,
// con la activa arriba (es donde se escribe). Sin menciones con @: no hay a quién avisarle.
//
// ⚠️ «BORRAR EL PROPIO»: la pantalla ofrece el tacho sólo en los comentarios de quien mira, y
//    eso lo dice el server (`Comentario.propio`, por el `sub` de la sesión, nunca por el nombre).
//    Esconder el botón no protege nada (AGENTS.md): `borrarComentario` (lib/editor-landing/
//    server.ts) exige que el comentario sea de quien borra, o del super admin.
// ⚠️ Borrar un comentario raíz se lleva sus respuestas (`on delete cascade` en la 0246): si tiene
//    respuestas, se pregunta antes y se dice cuántas.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useConfirm } from '@/app/_ui/Confirm';
import { useEditorLanding } from '../contexto';
import type { Comentario } from '@/lib/editor-landing/api-tipos';
import { tarjetasDe, tituloDeTarjeta } from '@/lib/editor-landing/doc';
import { EstilosPanelesB, Ico, pedirDocs } from './PanelAgente';
import { idDe, recortar } from '../diff-tarjetas';

const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat('es', { numeric: 'auto' }) : null;
function hace(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = (Date.now() - t) / 1000;
  if (s < 60 || !rtf) return 'ahora';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86_400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 7 * 86_400) return rtf.format(-Math.round(s / 86_400), 'day');
  return new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

const inicial = (nombre: string) => (nombre.trim()[0] ?? '?').toUpperCase();

type HiloC = { raiz: Comentario; respuestas: Comentario[] };
type Seccion = { titulo: string; paginaId: string; orden: number };

export function PanelComentarios({ onCerrar }: { onCerrar?: () => void } = {}) {
  const ctx = useEditorLanding();
  const ctxRef = useRef(ctx);
  useLayoutEffect(() => { ctxRef.current = ctx; });
  const { docId, editor, paginas, paginaActual, tarjetaActiva, setPanelDer, avisar } = ctx;
  const { confirm, confirmNode } = useConfirm();

  const [comentarios, setComentarios] = useState<Comentario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'abiertos' | 'cerrados'>('abiertos');
  const [nuevo, setNuevo] = useState('');
  const [respondiendo, setRespondiendo] = useState<number | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fallaAccion, setFallaAccion] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await pedirDocs({ accion: 'comentarios', id: docId });
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setComentarios(r.comentarios);
  }, [docId]);

  useEffect(() => { void cargar(); }, [cargar]);

  // Los títulos: la página abierta, del documento VIVO; las otras, de lo guardado. El documento
  // es inmutable: su identidad dice si cambió.
  const docVivo = editor && !editor.isDestroyed ? editor.state.doc : null;
  const secciones = useMemo(() => {
    const m = new Map<string, Seccion>();
    let orden = 0;
    for (const p of paginas) {
      if (p.id === paginaActual && docVivo) {
        docVivo.forEach((n) => {
          const id = typeof n.attrs?.id === 'string' ? n.attrs.id : '';
          if (!id) return;
          let h = '';
          n.forEach((b) => { if (!h && b.type.name === 'heading') h = b.textContent; });
          m.set(id, { titulo: recortar((h || n.textContent).trim(), 60) || 'Sin título', paginaId: p.id, orden: orden++ });
        });
      } else {
        for (const t of tarjetasDe(p)) m.set(idDe(t), { titulo: recortar(tituloDeTarjeta(t), 60) || 'Sin título', paginaId: p.id, orden: orden++ });
      }
    }
    return m;
  }, [paginas, paginaActual, docVivo]);

  const hilos = useMemo(() => {
    const porSeccion = new Map<string, HiloC[]>();
    if (!comentarios) return porSeccion;
    const respuestas = new Map<number, Comentario[]>();
    for (const c of comentarios) if (c.parentId != null) respuestas.set(c.parentId, [...(respuestas.get(c.parentId) ?? []), c]);
    for (const c of comentarios) {
      if (c.parentId != null) continue;
      if (c.resuelto !== (filtro === 'cerrados')) continue;
      const lista = porSeccion.get(c.tarjetaId) ?? [];
      lista.push({ raiz: c, respuestas: respuestas.get(c.id) ?? [] });
      porSeccion.set(c.tarjetaId, lista);
    }
    return porSeccion;
  }, [comentarios, filtro]);

  // La sección activa siempre arriba (ahí se escribe); el resto en el orden del documento.
  const orden = useMemo(() => {
    const ids = [...hilos.keys()].filter((id) => id !== tarjetaActiva);
    ids.sort((a, b) => (secciones.get(a)?.orden ?? 1e9) - (secciones.get(b)?.orden ?? 1e9));
    return ids;
  }, [hilos, secciones, tarjetaActiva]);

  const irA = (id: string) => {
    const s = secciones.get(id);
    if (!s) return;
    if (s.paginaId !== ctxRef.current.paginaActual) {
      ctxRef.current.irAPagina(s.paginaId);
      window.setTimeout(() => ctxRef.current.irATarjeta(id), 80);
      return;
    }
    ctxRef.current.irATarjeta(id);
  };

  const comentar = async (tarjetaId: string, texto: string, parentId: number | null) => {
    const t = texto.trim();
    if (!t || enviando) return false;
    setEnviando(true);
    setFallaAccion(null);
    const r = await pedirDocs({ accion: 'comentar', id: docId, tarjetaId, texto: t, parentId });
    setEnviando(false);
    if (!r.ok) { setFallaAccion(r.error); return false; }
    setComentarios((cs) => [...(cs ?? []), r.comentario]);
    avisar(parentId ? 'Respuesta publicada' : 'Comentario publicado');
    return true;
  };

  const resolver = async (c: Comentario) => {
    setFallaAccion(null);
    const valor = !c.resuelto;
    const r = await pedirDocs({ accion: 'resolverComentario', id: docId, comentarioId: c.id, valor });
    if (!r.ok) { setFallaAccion(r.error); return; }
    setComentarios((cs) => (cs ?? []).map((x) => (x.id === c.id ? { ...x, resuelto: r.resuelto } : x)));
    avisar(r.resuelto ? 'Comentario cerrado' : 'Comentario reabierto');
  };

  const borrar = async (c: Comentario, respuestasDe: number) => {
    if (respuestasDe > 0) {
      const ok = await confirm(respuestasDe === 1 ? 'Se elimina también su respuesta.' : `Se eliminan también sus ${respuestasDe} respuestas.`, { title: '¿Eliminar el comentario?', confirmLabel: 'Eliminar' });
      if (!ok) return;
    }
    setFallaAccion(null);
    const r = await pedirDocs({ accion: 'borrarComentario', id: docId, comentarioId: c.id });
    if (!r.ok) { setFallaAccion(r.error); return; }
    setComentarios((cs) => (cs ?? []).filter((x) => x.id !== c.id && x.parentId !== c.id));
    avisar(c.parentId ? 'Respuesta eliminada' : 'Comentario eliminado');
  };

  const esMio = (c: Comentario) => c.propio === true;

  const burbuja = (c: Comentario, acciones: ReactNode) => (
    <div className="gma-cm-com">
      <span className="gma-cm-avatar" aria-hidden>{inicial(c.autor || '?')}</span>
      <div className="gma-cm-cuerpo">
        <div className="gma-cm-meta"><b>{c.autor || 'Alguien'}</b><span>{hace(c.creado)}</span></div>
        <p className="gma-cm-texto">{c.texto}</p>
        {acciones}
      </div>
    </div>
  );

  const hiloUI = (h: HiloC) => (
    <div key={h.raiz.id} className="gma-cm-hilo" data-cerrado={h.raiz.resuelto ? '' : undefined}>
      {burbuja(h.raiz, (
        <div className="gma-cm-acciones">
          <button type="button" className="gma-cm-link" onClick={() => { setRespondiendo(respondiendo === h.raiz.id ? null : h.raiz.id); setRespuesta(''); }}>Responder</button>
          <button type="button" className="gma-cm-link" onClick={() => void resolver(h.raiz)}>
            <Ico n={h.raiz.resuelto ? 'refrescar' : 'check'} t={12} /> {h.raiz.resuelto ? 'Marcar como abierto' : 'Marcar como cerrado'}
          </button>
          {esMio(h.raiz) && (
            <button type="button" className="gma-cm-borrar" onClick={() => void borrar(h.raiz, h.respuestas.length)} title="Eliminar el comentario" aria-label="Eliminar el comentario"><IconoBorrar size={14} /></button>
          )}
        </div>
      ))}
      {h.respuestas.length > 0 && (
        <div className="gma-cm-respuestas">
          {h.respuestas.map((r) => (
            <div key={r.id}>
              {burbuja(r, esMio(r) ? (
                <div className="gma-cm-acciones">
                  <button type="button" className="gma-cm-borrar" onClick={() => void borrar(r, 0)} title="Eliminar respuesta" aria-label="Eliminar respuesta"><IconoBorrar size={14} /></button>
                </div>
              ) : null)}
            </div>
          ))}
        </div>
      )}
      {respondiendo === h.raiz.id && (
        <div className="gma-cm-escribir" data-respuesta="">
          <textarea
            className="gma-cm-input"
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void comentar(h.raiz.tarjetaId, respuesta, h.raiz.id).then((ok) => { if (ok) { setRespuesta(''); setRespondiendo(null); } }); }
            }}
            placeholder="Responder"
            rows={2}
            autoFocus
            aria-label="Responder"
          />
          <div className="gma-cm-escribir-pie">
            <button type="button" className="gma-pb-boton" data-v="fantasma" data-t="s" onClick={() => setRespondiendo(null)}>Cancelar</button>
            <button type="button" className="gma-pb-boton" data-v="primario" data-t="s" disabled={!respuesta.trim() || enviando}
              onClick={() => void comentar(h.raiz.tarjetaId, respuesta, h.raiz.id).then((ok) => { if (ok) { setRespuesta(''); setRespondiendo(null); } })}>Responder</button>
          </div>
        </div>
      )}
    </div>
  );

  const activa = tarjetaActiva ? secciones.get(tarjetaActiva) : undefined;
  const hilosActiva = tarjetaActiva ? hilos.get(tarjetaActiva) ?? [] : [];
  const nadaEnFiltro = comentarios !== null && hilos.size === 0;

  return (
    <aside className="gma gma-pb gma-cm" aria-label="Comentarios">
      <EstilosPanelesB />
      <style href="gma-comentarios" precedence="medium">{CSS_COMENTARIOS}</style>
      {confirmNode}
      <header className="gma-cm-cab">
        <h2 className="gma-cm-h">Comentarios</h2>
        <button type="button" className="gma-pb-iconbtn" onClick={() => (onCerrar ? onCerrar() : setPanelDer(null))} aria-label="Cerrar" title="Cerrar"><Ico n="cerrar" t={16} /></button>
      </header>
      <div className="gma-cm-filtro">
        <div className="gma-pb-segmento" role="group" aria-label="Filtro">
          <button type="button" aria-pressed={filtro === 'abiertos'} onClick={() => setFiltro('abiertos')}>Abiertos</button>
          <button type="button" aria-pressed={filtro === 'cerrados'} onClick={() => setFiltro('cerrados')}>Cerrados</button>
        </div>
      </div>

      <div className="gma-cm-lista">
        {error && (
          <div className="gma-cm-vacio" role="alert">
            <span>{error}</span>
            <button type="button" className="gma-pb-boton" data-v="contorno" data-t="s" onClick={() => { setError(null); void cargar(); }}>Reintentar</button>
          </div>
        )}
        {!error && comentarios === null && <div className="gma-cm-vacio"><span className="gma-pb-giro" aria-label="Cargando" /></div>}
        {fallaAccion && <p className="gma-rv-error" role="alert">{fallaAccion}</p>}

        {comentarios !== null && (
          <section className="gma-cm-grupo" data-activa="">
            <div className="gma-cm-gcab">
              <Ico n="diseno" t={13} />
              {activa
                ? <button type="button" className="gma-cm-gtit" onClick={() => irA(tarjetaActiva!)}>{activa.titulo}</button>
                : <span className="gma-cm-gtit" data-tenue="">Elige una sección</span>}
            </div>
            {tarjetaActiva && activa && filtro === 'abiertos' && (
              <div className="gma-cm-escribir">
                <textarea
                  className="gma-cm-input"
                  value={nuevo}
                  onChange={(e) => setNuevo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void comentar(tarjetaActiva, nuevo, null).then((ok) => { if (ok) setNuevo(''); }); }
                  }}
                  placeholder="Agregar un comentario"
                  rows={2}
                  aria-label="Agregar un comentario"
                />
                {nuevo.trim() && (
                  <div className="gma-cm-escribir-pie">
                    <button type="button" className="gma-pb-boton" data-v="primario" data-t="s" disabled={enviando}
                      onClick={() => void comentar(tarjetaActiva, nuevo, null).then((ok) => { if (ok) setNuevo(''); })}>Comentar</button>
                  </div>
                )}
              </div>
            )}
            {hilosActiva.map(hiloUI)}
          </section>
        )}

        {orden.map((id) => {
          const s = secciones.get(id);
          return (
            <section key={id} className="gma-cm-grupo">
              <div className="gma-cm-gcab">
                <Ico n="diseno" t={13} />
                {s
                  ? <button type="button" className="gma-cm-gtit" onClick={() => irA(id)}>{s.titulo}</button>
                  : <span className="gma-cm-gtit" data-tenue="">Sección eliminada</span>}
              </div>
              {(hilos.get(id) ?? []).map(hiloUI)}
            </section>
          );
        })}

        {nadaEnFiltro && (
          <div className="gma-cm-vacio">{filtro === 'abiertos' ? 'No hay comentarios abiertos' : 'No hay comentarios cerrados'}</div>
        )}
      </div>
    </aside>
  );
}

export default PanelComentarios;

const CSS_COMENTARIOS = `
.gma-cm{display:flex;flex-direction:column;width:340px;max-width:100%;height:100%;min-height:0;background:var(--pb-fondo);border-left:1px solid var(--pb-borde)}
.gma-cm-cab{display:flex;align-items:center;justify-content:space-between;gap:8px;height:52px;flex:none;padding:0 10px 0 16px}
.gma-cm-h{margin:0;font-size:18px;font-weight:700;color:var(--pb-titulo)}
.gma-cm-filtro{flex:none;padding:0 16px 10px}
.gma-cm-lista{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:18px;padding:4px 16px 16px}
.gma-cm-grupo{display:grid;gap:10px}
.gma-cm-gcab{display:flex;align-items:center;gap:6px;min-width:0;color:var(--pb-suave)}
.gma-cm-gtit{min-width:0;padding:0;border:0;background:transparent;color:var(--pb-texto);font:inherit;font-size:12.5px;font-weight:700;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.gma-cm-gtit:hover{color:var(--pb-azul)}
.gma-cm-gtit[data-tenue]{color:var(--pb-suave);font-weight:600;cursor:default}
.gma-cm-hilo{display:grid;gap:10px;padding:12px;border-radius:12px;background:var(--pb-sup)}
.gma-cm-hilo[data-cerrado]{opacity:.8}
.gma-cm-com{display:flex;gap:10px;min-width:0}
.gma-cm-avatar{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex:none;border-radius:50%;background:var(--pb-azul);color:var(--pb-azul-txt);font-size:11.5px;font-weight:600}
.gma-cm-cuerpo{display:grid;gap:3px;min-width:0;flex:1}
.gma-cm-meta{display:flex;align-items:baseline;gap:6px;min-width:0;font-size:12.5px}
.gma-cm-meta b{font-weight:600;color:var(--pb-texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gma-cm-meta span{flex:none;color:var(--pb-suave);font-size:11.5px}
.gma-cm-texto{margin:0;font-size:13px;line-height:1.5;color:var(--pb-texto);white-space:pre-wrap;overflow-wrap:anywhere}
.gma-cm-acciones{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:2px}
.gma-cm-link{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:transparent;color:var(--pb-tenue);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.gma-cm-link:hover{color:var(--pb-azul)}
.gma-cm-borrar{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-left:auto;padding:0;border:0;border-radius:6px;background:transparent;cursor:pointer}
.gma-cm-borrar:hover{background:var(--pb-mal-bg)}
.gma-cm-respuestas{display:grid;gap:10px;padding-left:36px}
.gma-cm-escribir{display:grid;gap:6px}
.gma-cm-escribir[data-respuesta]{padding-left:36px}
.gma-cm-input{width:100%;min-height:56px;resize:vertical;padding:9px 11px;border:0;border-radius:10px;background:var(--pb-fondo);box-shadow:0 0 0 1px var(--pb-borde);color:var(--pb-texto);font:inherit;font-size:13px;line-height:1.45;outline:none}
.gma-cm-input:focus{box-shadow:0 0 0 1.5px var(--pb-vivo)}
.gma-cm-input::placeholder{color:var(--pb-suave)}
.gma-cm-escribir-pie{display:flex;justify-content:flex-end;gap:6px}
.gma-cm-vacio{display:grid;justify-items:center;gap:10px;padding:28px 8px;color:var(--pb-suave);font-size:13px;text-align:center}
`;
