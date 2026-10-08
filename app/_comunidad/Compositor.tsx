'use client';

// =============================================================================
// Compositor — «Escribe algo»: el post nuevo (o editar uno propio)
// =============================================================================
// El modal de Skool: título, cuerpo (texto con saltos de línea, links y @menciones), categoría
// (obligatoria si la comunidad tiene), y tres agregados: un archivo o una imagen, un video (YouTube,
// Vimeo o Loom) y una encuesta. Lo que se manda el server lo vuelve a validar entero (`validarPost`):
// lo de acá es para decir «falta esto» antes del clic, no la regla.
//
// ⚠️ EL ARCHIVO SUBE DIRECTO DEL NAVEGADOR AL BUCKET con una URL firmada (una server action topa en
//    1 MB, AGENTS.md), con progreso real (`subirConProgreso`, XMLHttpRequest). Si se cierra sin
//    publicar, se pide borrarlo: un archivo subido que ningún post nombra es basura en el bucket.
//
// ⚠️ AL EDITAR, LA ENCUESTA Y EL ARCHIVO NO SE TOCAN: un voto guarda el id de su opción, y cambiar las
//    opciones le cambiaría el voto a alguien (el server tampoco lo acepta).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Modal, Select } from '@/app/_ui';
import { subirConProgreso, type Subida } from '@/app/customer-success/curso/subir-video';
import type { PostDetalle, PostVista } from '@/lib/comunidad-tipos';
import {
  MIME_ADJUNTO, MAX_OPCIONES, MIN_OPCIONES, TOPE_ADJUNTO_BYTES, TOPE_CUERPO, TOPE_OPCION, TOPE_TITULO, esImagen, videoDePost,
} from '@/lib/comunidad-reglas';
import type { AdjuntoSubido, EntradaPost } from './api';
import { CampoMenciones, mencionesVigentes, type Mencion } from './CampoMenciones';
import { AvatarNivel, Ico, useComunidad } from './piezas';

/** El tipo de un archivo: el que dice el navegador si está en la lista; si no, por su extensión. */
function mimeDeArchivo(f: File): string | null {
  if (Object.prototype.hasOwnProperty.call(MIME_ADJUNTO, f.type)) return f.type;
  const ext = (f.name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'jpeg') return 'image/jpeg';
  return Object.entries(MIME_ADJUNTO).find(([, e]) => e === ext)?.[0] ?? null;
}

export function Compositor({ editando = null, categoriaInicial = null, onCerrar, onListo }: {
  /** El post que se edita (sólo su texto). `null` = uno nuevo. */
  editando?: PostDetalle | null;
  /** La categoría que tiene elegida el feed: se propone, si se puede publicar ahí. */
  categoriaInicial?: number | null;
  onCerrar: () => void;
  onListo: (p: PostVista) => void;
}) {
  const { api, comunidad } = useComunidad();
  const yo = comunidad.yo;
  const permitidas = useMemo(
    () => comunidad.categorias.filter((c) => c.permiso === 'todos' || yo.equipo),
    [comunidad.categorias, yo.equipo],
  );

  const [titulo, setTitulo] = useState(editando?.titulo ?? '');
  const [cuerpo, setCuerpo] = useState(editando?.texto ?? '');
  const [menciones, setMenciones] = useState<Mencion[]>(editando?.menciones ?? []);
  const [categoriaId, setCategoriaId] = useState<number | null>(() => {
    const quiere = editando ? editando.categoriaId : categoriaInicial;
    return quiere != null && permitidas.some((c) => c.id === quiere) ? quiere : null;
  });
  const [conVideo, setConVideo] = useState(!!editando?.video);
  const [videoUrl, setVideoUrl] = useState(editando?.video?.url ?? '');
  const [conEncuesta, setConEncuesta] = useState(false);
  const [opciones, setOpciones] = useState<string[]>(['', '']);
  const [adjunto, setAdjunto] = useState<AdjuntoSubido | null>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const subida = useRef<Subida | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const publicado = useRef(false);

  // Al cerrar sin publicar, el archivo subido se borra (y una subida a medias se corta).
  const adjuntoRef = useRef<AdjuntoSubido | null>(null);
  adjuntoRef.current = adjunto;
  useEffect(() => () => {
    subida.current?.cancelar();
    const a = adjuntoRef.current;
    if (a && !publicado.current) void api.descartar(a.path);
  }, [api]);

  const elegirArchivo = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    const mime = mimeDeArchivo(f);
    if (!mime) { setError('Ese formato no va.'); return; }
    if (f.size > TOPE_ADJUNTO_BYTES) { setError('Pasa de 25 MB.'); return; }
    if (adjunto) { void api.descartar(adjunto.path); setAdjunto(null); }
    setSubiendo(0);
    const r = await api.subida(mime, f.size);
    if (!r.ok) { setSubiendo(null); setError(r.error); return; }
    // El tipo viaja en la parte del multipart: un `application/octet-stream` lo rebota el bucket.
    const archivo = f.type === mime ? f : new File([f], f.name, { type: mime });
    subida.current = subirConProgreso(r.signedUrl, archivo, r.apikey, (p) => setSubiendo(p), 'imagen, PDF, Word, Excel o PowerPoint');
    try {
      await subida.current.promesa;
      setAdjunto({ path: r.path, nombre: f.name, mime, bytes: f.size });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir.');
    } finally {
      subida.current = null;
      setSubiendo(null);
    }
  };

  const quitarAdjunto = () => {
    if (adjunto) void api.descartar(adjunto.path);
    setAdjunto(null);
  };

  const enviar = async () => {
    setError(null);
    const t = titulo.trim();
    if (!t) { setError('Falta el título.'); return; }
    if (permitidas.length && categoriaId == null) { setError('Elige una categoría.'); return; }
    if (conVideo && videoUrl.trim() && !videoDePost(videoUrl)) { setError('Ese video no va. Usa YouTube, Vimeo o Loom.'); return; }
    const ops = opciones.map((o) => o.trim()).filter(Boolean);
    if (conEncuesta && ops.length < MIN_OPCIONES) { setError(`La encuesta lleva al menos ${MIN_OPCIONES} opciones.`); return; }
    if (subiendo != null) { setError('Espera a que termine de subir.'); return; }
    const entrada: EntradaPost = {
      titulo: t,
      cuerpo,
      categoriaId,
      videoUrl: conVideo ? videoUrl.trim() : '',
      menciones: mencionesVigentes(`${t}\n${cuerpo}`, menciones),
      encuesta: !editando && conEncuesta ? ops : null,
      adjunto: editando ? null : adjunto,
    };
    setEnviando(true);
    const r = editando ? await api.editarPost(editando.id, entrada) : await api.publicar(entrada);
    setEnviando(false);
    if (!r.ok) { setError(r.error); return; }
    publicado.current = true;
    onListo(r.post);
  };

  const sinPermiso = !editando && !comunidad.puedoPublicar;

  return (
    <Modal
      titulo={editando ? 'Editar post' : 'Nuevo post'}
      ancho={680}
      onCerrar={onCerrar}
      pie={(
        <>
          <Button variant="tertiary" onClick={onCerrar}>{editando ? 'No guardar' : 'No publicar'}</Button>
          <Button onClick={() => void enviar()} loading={enviando} disabled={sinPermiso || subiendo != null}>
            {editando ? 'Guardar cambios' : 'Publicar'}
          </Button>
        </>
      )}
    >
      <div className="cmu-comp">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <AvatarNivel m={yo} size={36} />
          <span className="cmu-nombre">{yo.nombre}</span>
          {permitidas.length > 0 && (
            <div style={{ marginLeft: 'auto', minWidth: 190 }}>
              <Select
                ariaLabel="Categoría"
                value={categoriaId == null ? '' : String(categoriaId)}
                placeholder="Elige una categoría"
                onChange={(v) => setCategoriaId(v ? Number(v) : null)}
                options={permitidas.map((c) => ({ value: String(c.id), label: c.nombre }))}
              />
            </div>
          )}
        </div>
        {sinPermiso && <p className="cmu-error">Publicas desde el nivel {comunidad.nivelParaPostear}.</p>}

        <input className="cmu-comp-titulo" value={titulo} maxLength={TOPE_TITULO} placeholder="Título"
          aria-label="Título" onChange={(e) => setTitulo(e.target.value)} autoFocus />
        <CampoMenciones valor={cuerpo} onCambio={setCuerpo} menciones={menciones} onMenciones={setMenciones}
          placeholder="Escribe algo…" filas={6} maxLength={TOPE_CUERPO} etiqueta="Texto del post" />

        {conVideo && (
          <div className="cmu-comp-op">
            <Ico n="video" />
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Link de YouTube, Vimeo o Loom" aria-label="Link del video" />
            <Button variant="tertiary" size="sm" onClick={() => { setConVideo(false); setVideoUrl(''); }} aria-label="Quitar video"><Ico n="x" size={14} /></Button>
          </div>
        )}

        {!editando && conEncuesta && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {opciones.map((o, i) => (
              <div key={i} className="cmu-comp-op">
                <Input value={o} maxLength={TOPE_OPCION} placeholder={`Opción ${i + 1}`} aria-label={`Opción ${i + 1}`}
                  onChange={(e) => setOpciones((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
                {opciones.length > MIN_OPCIONES && (
                  <Button variant="tertiary" size="sm" aria-label={`Quitar la opción ${i + 1}`}
                    onClick={() => setOpciones((l) => l.filter((_, j) => j !== i))}><Ico n="x" size={14} /></Button>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {opciones.length < MAX_OPCIONES && <Button variant="secondary" size="sm" onClick={() => setOpciones((l) => [...l, ''])}>Agregar opción</Button>}
              <Button variant="tertiary" size="sm" onClick={() => { setConEncuesta(false); setOpciones(['', '']); }}>Quitar encuesta</Button>
            </div>
          </div>
        )}

        {!editando && (adjunto || subiendo != null) && (
          <div className="cmu-adjunto">
            <Ico n={adjunto && esImagen(adjunto.mime) ? 'clip' : 'archivo'} />
            <span className="cmu-adjunto-nombre">{adjunto?.nombre ?? 'Subiendo…'}</span>
            {subiendo != null
              ? <span className="cmu-meta">{subiendo}%</span>
              : <Button variant="tertiary" size="sm" onClick={quitarAdjunto} aria-label="Quitar el archivo"><Ico n="x" size={14} /></Button>}
          </div>
        )}
        {subiendo != null && <div className="cmu-barra-prog" aria-hidden><i style={{ width: `${subiendo}%` }} /></div>}

        {!editando && (
          <div className="cmu-comp-herr">
            <input ref={archivoRef} type="file" hidden accept={Object.keys(MIME_ADJUNTO).join(',')}
              onChange={(e) => { void elegirArchivo(e.target.files?.[0]); e.target.value = ''; }} />
            <Button variant="secondary" size="sm" icon={<Ico n="clip" size={15} />} disabled={subiendo != null}
              onClick={() => archivoRef.current?.click()}>Archivo</Button>
            {!conVideo && <Button variant="secondary" size="sm" icon={<Ico n="video" size={15} />} onClick={() => setConVideo(true)}>Video</Button>}
            {!conEncuesta && <Button variant="secondary" size="sm" icon={<Ico n="encuesta" size={15} />} onClick={() => setConEncuesta(true)}>Encuesta</Button>}
          </div>
        )}
        {editando && (editando.encuesta || editando.adjunto) && <p className="cmu-meta">La encuesta y el archivo no se editan.</p>}
        {error && <p className="cmu-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
