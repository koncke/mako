'use client';
// =============================================================================
// PublicarCreacion — publicar algo del negocio en la galería de MaKo
// =============================================================================
// Lo que cada feature monta para publicar (el contrato, en lib/creaciones-enchufes.ts):
//   <BotonPublicar tipo="automatizacion" origenId={sec.id} nombre={sec.nombre} />
// Sin `origenId` (la galería), el modal pregunta QUÉ publicar entre lo del negocio de ese tipo.
// La definición la arma el server desde la base: acá sólo viajan el id, el título, la descripción y el autor.
//
// `modo="plantilla"` (6/11/2026, Leila: plantillas propias en todas las tabs): «Guardar como plantilla», con la elección
// «Sólo para mi negocio» (privada, tal cual) o «Compartir con la comunidad» (sin los datos del negocio: el server los
// cambia por [DATO: …] y no comparte si queda alguno, lib/plantillas-propias-reglas.ts). Lo monta cada tab con
// `<BotonGuardarPlantilla>` o desde el «⋯» de un proyecto.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal } from '@/app/_ui';
import { INFO_TIPO, TOPE_AUTOR_CREACION, TOPE_DESCRIPCION_CREACION, TOPE_TITULO_CREACION, type TipoCreacion } from '@/lib/creaciones-reglas';
import { guardarPlantillaAction, opcionesPublicarAction, publicarCreacionAction } from './actions';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontSize: 14,
};
const rotulo: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, margin: '14px 0 6px' };

export function PublicarCreacion({
  tipo, origenId, nombre, onCerrar, onPublicada, modo = 'publicar',
}: {
  tipo: TipoCreacion;
  /** El id de la cosa en el negocio: un número (automatización) o un UUID (anuncio). Viaja como texto. */
  origenId?: string | number;
  nombre?: string;
  onCerrar: () => void;
  onPublicada?: (x: { id: number; actualizada: boolean; estado?: string }) => void;
  /** `plantilla`: «Guardar como plantilla», sólo para el negocio o para todos. */
  modo?: 'publicar' | 'plantilla';
}) {
  // Identidad FIJA para el Modal (AGENTS.md): con una flecha nueva por render, el foco se pierde con cada letra.
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  const [ocupado, setOcupado] = useState(false);
  const ocupadoRef = useRef(false);
  ocupadoRef.current = ocupado;
  const cerrar = useCallback(() => { if (!ocupadoRef.current) cerrarRef.current(); }, []);

  const fijo = origenId != null && origenId !== '' ? String(origenId) : null;
  const [opciones, setOpciones] = useState<Array<{ id: string; nombre: string }> | null>(fijo ? [] : null);
  const [elegido, setElegido] = useState<string | null>(fijo);
  const [titulo, setTitulo] = useState(nombre ?? '');
  const [descripcion, setDescripcion] = useState('');
  const [autor, setAutor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ actualizada: boolean; privada: boolean } | null>(null);
  const comoPlantilla = modo === 'plantilla';
  // Por defecto, sólo para el negocio: compartir con todos es la decisión que se toma a propósito.
  const [paraTodos, setParaTodos] = useState(!comoPlantilla);
  const info = INFO_TIPO[tipo];

  useEffect(() => {
    if (fijo) return;
    let vivo = true;
    opcionesPublicarAction(tipo).then((r) => {
      if (!vivo) return;
      if ('error' in r) { setError(r.error); setOpciones([]); return; }
      setOpciones(r);
    }).catch(() => { if (vivo) { setError('Sin conexión'); setOpciones([]); } });
    return () => { vivo = false; };
  }, [tipo, fijo]);

  const elegir = (id: string) => {
    setElegido(id);
    const o = opciones?.find((x) => x.id === id);
    if (o && !titulo.trim()) setTitulo(o.nombre);
  };

  const publicar = async () => {
    if (!elegido || ocupado) return;
    setOcupado(true);
    setError(null);
    const datos = { tipo, origenId: elegido, titulo, descripcion, autorNombre: paraTodos ? autor : '' };
    const r = await (comoPlantilla
      ? guardarPlantillaAction({ ...datos, visibilidad: paraTodos ? 'publica' : 'privada' })
      : publicarCreacionAction(datos)).catch(() => ({ error: 'Sin conexión' }));
    setOcupado(false);
    if ('error' in r) { setError(r.error); return; }
    setHecho({ actualizada: r.actualizada, privada: comoPlantilla && !paraTodos });
    onPublicada?.(r);
  };
  const accion = comoPlantilla ? (paraTodos ? 'Compartir con todos' : 'Guardar plantilla') : 'Publicar para todos';

  const pie = hecho
    ? <Button variant="primary" onClick={cerrar}>Listo</Button>
    : (
      <>
        <Button variant="secondary" onClick={cerrar} disabled={ocupado}>{comoPlantilla ? 'No guardar' : 'No publicar'}</Button>
        <Button variant="primary" onClick={publicar} loading={ocupado} disabled={!elegido || !titulo.trim()}>{accion}</Button>
      </>
    );

  return (
    <Modal titulo={comoPlantilla ? 'Guardar como plantilla' : `Publicar ${info.singular}`} onCerrar={cerrar} pie={pie} ancho={520}>
      {hecho ? (
        <p style={{ margin: 0, fontSize: 14 }}>
          {hecho.privada
            ? (hecho.actualizada ? 'Plantilla actualizada. La ves en «Nuevo».' : 'Plantilla guardada. La ves en «Nuevo».')
            : (hecho.actualizada ? 'Actualizada en la galería.' : 'Publicada en la galería.')}
        </p>
      ) : (
        <div>
          {!fijo && (
            <>
              <label style={{ ...rotulo, marginTop: 0 }} htmlFor="pub-que">Qué publicas</label>
              {opciones == null ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>Cargando…</p>
              ) : opciones.length ? (
                <select id="pub-que" style={campo} value={elegido ?? ''} onChange={(e) => elegir(e.target.value)}>
                  <option value="" disabled>Elige una</option>
                  {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              ) : (
                <p style={{ margin: 0, fontSize: 13 }}>No tienes {info.titulo.toLowerCase()} para publicar.</p>
              )}
            </>
          )}
          <label style={{ ...rotulo, ...(fijo ? { marginTop: 0 } : null) }} htmlFor="pub-titulo">Título</label>
          <input id="pub-titulo" style={campo} value={titulo} maxLength={TOPE_TITULO_CREACION} onChange={(e) => setTitulo(e.target.value)} />
          <label style={rotulo} htmlFor="pub-desc">Para qué sirve</label>
          <textarea id="pub-desc" style={{ ...campo, minHeight: 72, resize: 'vertical' }} value={descripcion} maxLength={TOPE_DESCRIPCION_CREACION} onChange={(e) => setDescripcion(e.target.value)} />
          {comoPlantilla && (
            <fieldset style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
              <legend style={{ ...rotulo, margin: '0 0 6px' }}>Quién la ve</legend>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginBottom: 6 }}>
                <input type="radio" name="pub-vis" checked={!paraTodos} onChange={() => setParaTodos(false)} /> Sólo mi negocio
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input type="radio" name="pub-vis" checked={paraTodos} onChange={() => setParaTodos(true)} /> Toda la comunidad
              </label>
            </fieldset>
          )}
          {paraTodos && (
            <>
              <label style={rotulo} htmlFor="pub-autor">Firma</label>
              <input id="pub-autor" style={campo} value={autor} maxLength={TOPE_AUTOR_CREACION} placeholder="Un negocio de MaKo" onChange={(e) => setAutor(e.target.value)} />
            </>
          )}
          <p style={{ margin: '14px 0 0', fontSize: 13 }}>
            {!paraTodos
              ? 'Queda tal cual, sólo para tu negocio.'
              : comoPlantilla
                ? 'Se comparte la forma: tu negocio, tu equipo, emails, teléfonos, links, precios y fotos quedan como [DATO].'
                : 'Los textos salen sin datos de tu negocio. No viajan tus audios, archivos, etiquetas ni contactos.'}
          </p>
          {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--bad)' }}>{error}<ReportarASoporte /></p>}
        </div>
      )}
    </Modal>
  );
}

/** «Guardar como plantilla»: el botón que monta una tab al lado de lo que se puede guardar (sólo para el negocio o para todos). */
export function BotonGuardarPlantilla({ tipo, origenId, nombre, onGuardada }: { tipo: TipoCreacion; origenId: string | number; nombre?: string; onGuardada?: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>Guardar como plantilla</Button>
      {abierto && <PublicarCreacion modo="plantilla" tipo={tipo} origenId={origenId} nombre={nombre} onCerrar={cerrar} onPublicada={onGuardada} />}
    </>
  );
}

/**
 * «Guardar como plantilla» abierto desde el «⋯» de un proyecto de una tab (`de` = qué se guarda; null = cerrado). Los
 * nombres de las props no dicen «cerrar» a propósito: el Image Editor tiene un guard contra un chat que se cierre
 * (tests/image-editor-chat.test.ts, 24) y esto no es el chat.
 */
export function ModalGuardarPlantilla({ tipo, de, alSalir, alGuardar }: {
  tipo: TipoCreacion; de: { id: string; nombre: string } | null; alSalir: () => void; alGuardar?: () => void;
}) {
  if (!de) return null;
  return <PublicarCreacion modo="plantilla" tipo={tipo} origenId={de.id} nombre={de.nombre} onCerrar={alSalir} onPublicada={alGuardar} />;
}

/** El botón que monta una feature al lado de lo que se puede publicar. */
export function BotonPublicar({ tipo, origenId, nombre, onPublicada }: { tipo: TipoCreacion; origenId: string | number; nombre?: string; onPublicada?: (x: { id: number; actualizada: boolean }) => void }) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>Publicar</Button>
      {abierto && <PublicarCreacion tipo={tipo} origenId={origenId} nombre={nombre} onCerrar={cerrar} onPublicada={onPublicada} />}
    </>
  );
}
