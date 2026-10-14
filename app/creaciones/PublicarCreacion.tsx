'use client';
// =============================================================================
// PublicarCreacion — publicar algo del negocio en la galería de MaKo
// =============================================================================
// Lo que cada feature monta para publicar (el contrato, en lib/creaciones-enchufes.ts):
//   <BotonPublicar tipo="automatizacion" origenId={sec.id} nombre={sec.nombre} />
// Sin `origenId` (la galería), el modal pregunta QUÉ publicar entre lo del negocio de ese tipo.
// La definición la arma el server desde la base: acá sólo viajan el id, el título, la descripción y el autor.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal } from '@/app/_ui';
import { INFO_TIPO, TOPE_AUTOR_CREACION, TOPE_DESCRIPCION_CREACION, TOPE_TITULO_CREACION, type TipoCreacion } from '@/lib/creaciones-reglas';
import { opcionesPublicarAction, publicarCreacionAction } from './actions';

const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontSize: 14,
};
const rotulo: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, margin: '14px 0 6px' };

export function PublicarCreacion({
  tipo, origenId, nombre, onCerrar, onPublicada,
}: {
  tipo: TipoCreacion;
  origenId?: number;
  nombre?: string;
  onCerrar: () => void;
  onPublicada?: (x: { id: number; actualizada: boolean }) => void;
}) {
  // Identidad FIJA para el Modal (AGENTS.md): con una flecha nueva por render, el foco se pierde con cada letra.
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  const [ocupado, setOcupado] = useState(false);
  const ocupadoRef = useRef(false);
  ocupadoRef.current = ocupado;
  const cerrar = useCallback(() => { if (!ocupadoRef.current) cerrarRef.current(); }, []);

  const [opciones, setOpciones] = useState<Array<{ id: number; nombre: string }> | null>(origenId ? [] : null);
  const [elegido, setElegido] = useState<number | null>(origenId ?? null);
  const [titulo, setTitulo] = useState(nombre ?? '');
  const [descripcion, setDescripcion] = useState('');
  const [autor, setAutor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ actualizada: boolean } | null>(null);
  const info = INFO_TIPO[tipo];

  useEffect(() => {
    if (origenId) return;
    let vivo = true;
    opcionesPublicarAction(tipo).then((r) => {
      if (!vivo) return;
      if ('error' in r) { setError(r.error); setOpciones([]); return; }
      setOpciones(r);
    }).catch(() => { if (vivo) { setError('Sin conexión'); setOpciones([]); } });
    return () => { vivo = false; };
  }, [tipo, origenId]);

  const elegir = (id: number) => {
    setElegido(id);
    const o = opciones?.find((x) => x.id === id);
    if (o && !titulo.trim()) setTitulo(o.nombre);
  };

  const publicar = async () => {
    if (!elegido || ocupado) return;
    setOcupado(true);
    setError(null);
    const r = await publicarCreacionAction({ tipo, origenId: elegido, titulo, descripcion, autorNombre: autor }).catch(() => ({ error: 'Sin conexión' }));
    setOcupado(false);
    if ('error' in r) { setError(r.error); return; }
    setHecho({ actualizada: r.actualizada });
    onPublicada?.(r);
  };

  const pie = hecho
    ? <Button variant="primary" onClick={cerrar}>Listo</Button>
    : (
      <>
        <Button variant="secondary" onClick={cerrar} disabled={ocupado}>No publicar</Button>
        <Button variant="primary" onClick={publicar} loading={ocupado} disabled={!elegido || !titulo.trim()}>Publicar para todos</Button>
      </>
    );

  return (
    <Modal titulo={`Publicar ${info.singular}`} onCerrar={cerrar} pie={pie} ancho={520}>
      {hecho ? (
        <p style={{ margin: 0, fontSize: 14 }}>{hecho.actualizada ? 'Actualizada en la galería.' : 'Publicada en la galería.'}</p>
      ) : (
        <div>
          {!origenId && (
            <>
              <label style={{ ...rotulo, marginTop: 0 }} htmlFor="pub-que">Qué publicas</label>
              {opciones == null ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>Cargando…</p>
              ) : opciones.length ? (
                <select id="pub-que" style={campo} value={elegido ?? ''} onChange={(e) => elegir(Number(e.target.value))}>
                  <option value="" disabled>Elige una</option>
                  {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              ) : (
                <p style={{ margin: 0, fontSize: 13 }}>No tienes {info.titulo.toLowerCase()} para publicar.</p>
              )}
            </>
          )}
          <label style={{ ...rotulo, ...(origenId ? { marginTop: 0 } : null) }} htmlFor="pub-titulo">Título</label>
          <input id="pub-titulo" style={campo} value={titulo} maxLength={TOPE_TITULO_CREACION} onChange={(e) => setTitulo(e.target.value)} />
          <label style={rotulo} htmlFor="pub-desc">Para qué sirve</label>
          <textarea id="pub-desc" style={{ ...campo, minHeight: 72, resize: 'vertical' }} value={descripcion} maxLength={TOPE_DESCRIPCION_CREACION} onChange={(e) => setDescripcion(e.target.value)} />
          <label style={rotulo} htmlFor="pub-autor">Firma</label>
          <input id="pub-autor" style={campo} value={autor} maxLength={TOPE_AUTOR_CREACION} placeholder="Un negocio de MaKo" onChange={(e) => setAutor(e.target.value)} />
          <p style={{ margin: '14px 0 0', fontSize: 13 }}>Los textos salen tal cual. No viajan tus audios, archivos, etiquetas ni contactos.</p>
          {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--bad)' }}>{error}</p>}
        </div>
      )}
    </Modal>
  );
}

/** El botón que monta una feature al lado de lo que se puede publicar. */
export function BotonPublicar({ tipo, origenId, nombre, onPublicada }: { tipo: TipoCreacion; origenId: number; nombre?: string; onPublicada?: (x: { id: number; actualizada: boolean }) => void }) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>Publicar</Button>
      {abierto && <PublicarCreacion tipo={tipo} origenId={origenId} nombre={nombre} onCerrar={cerrar} onPublicada={onPublicada} />}
    </>
  );
}
