'use client';

// =============================================================================
// Publicaciones — compositor (feed/reel/story/carrusel) + lista con estados
// =============================================================================
// La subida NO pasa por el serverless (Vercel corta los POST >4.5 MB, y un reel
// no entra): el navegador pide una URL firmada y sube el binario DIRECTO a
// storage; al guardar, la action firma URLs largas para Zernio (que tienen que
// sobrevivir hasta el momento programado — gotcha del contrato) y llama a
// createPost. El estado local espeja el de Zernio; el error queda VISIBLE en la
// fila, nunca tragado.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Button, Confirm, EmptyState, Field, Select, SkeletonLines, Status, Textarea,
} from '@/app/_ui';
import type { Tono } from '@/app/_ui';
import type { MediaLocal, PublicacionIg } from './ig-datos';
import {
  cancelarProgramacionAction, crearPublicacionAction, crearUrlSubidaMediaAction,
  listarPublicacionesAction, refrescarPublicacionAction, type CrearPublicacionInput,
} from './actions';

type Tipo = CrearPublicacionInput['tipo'];
type Modo = CrearPublicacionInput['modo'];

const TIPOS = [
  { value: 'feed', label: 'Publicación en el feed' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'carrusel', label: 'Carrusel' },
];

const ESTADO_UI: Record<PublicacionIg['estado'], { label: string; tono: Tono }> = {
  borrador: { label: 'Borrador', tono: 'neutral' },
  programado: { label: 'Programada', tono: 'info' },
  publicando: { label: 'Publicando', tono: 'info' },
  publicado: { label: 'Publicada', tono: 'good' },
  parcial: { label: 'Parcial', tono: 'warn' },
  error: { label: 'Con error', tono: 'bad' },
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '';

export function Publicaciones({ cuentaConectada, avisar }: {
  cuentaConectada: boolean;
  avisar: (msg: string) => void;
}) {
  // ── Compositor ──
  const [tipo, setTipo] = useState<Tipo>('feed');
  const [caption, setCaption] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);
  const [programadoLocal, setProgramadoLocal] = useState('');
  const [busyModo, setBusyModo] = useState<Modo | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ── Lista ──
  const [posts, setPosts] = useState<PublicacionIg[] | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<PublicacionIg | null>(null);
  const [busyFila, setBusyFila] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    const r = await listarPublicacionesAction();
    if (!r.ok) { setErrorLista(r.error); return; }
    setErrorLista(null);
    setPosts(r.posts);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const agregarArchivos = (lista: FileList | null) => {
    if (!lista?.length) return;
    setArchivos((prev) => [...prev, ...Array.from(lista)]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const subirTodo = async (): Promise<MediaLocal[]> => {
    const media: MediaLocal[] = [];
    for (const f of archivos) {
      const mime = f.type || 'application/octet-stream';
      const su = await crearUrlSubidaMediaAction(f.name, mime);
      if (!su.ok) throw new Error(su.error);
      const up = await fetch(su.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': mime, 'x-upsert': 'true' },
        body: f,
      });
      if (!up.ok) throw new Error(`No se pudo subir «${f.name}» (HTTP ${up.status}).`);
      media.push({ path: su.path, mime, nombre: f.name });
    }
    return media;
  };

  const guardar = async (modo: Modo) => {
    setErrorForm(null);
    if (!archivos.length) { setErrorForm('Sube al menos una imagen o video.'); return; }
    if (modo === 'programar' && !programadoLocal) { setErrorForm('Elige la fecha y hora de publicación.'); return; }
    setBusyModo(modo);
    try {
      const media = await subirTodo();
      const r = await crearPublicacionAction({
        tipo,
        caption,
        media,
        modo,
        // datetime-local es hora de pared local: se manda como instante ABSOLUTO
        // (ISO con Z) — el gotcha de zonas del contrato de Zernio.
        programadoAt: modo === 'programar' ? new Date(programadoLocal).toISOString() : undefined,
      });
      if (!r.ok) { setErrorForm(r.error); return; }
      setCaption('');
      setArchivos([]);
      setProgramadoLocal('');
      avisar(
        modo === 'borrador' ? 'Borrador guardado.'
        : modo === 'programar' ? 'Publicación programada.'
        : 'Publicación enviada a Instagram.',
      );
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyModo(null);
    }
  };

  const etiquetaPublicar = tipo === 'reel' ? 'Publicar reel'
    : tipo === 'story' ? 'Publicar story'
    : tipo === 'carrusel' ? 'Publicar carrusel'
    : 'Publicar en el feed';

  const cancelar = async (p: PublicacionIg) => {
    setBusyFila(p.id);
    const r = await cancelarProgramacionAction(p.id);
    setBusyFila(null);
    setCancelando(null);
    if (!r.ok) { setErrorLista(r.error ?? 'No se pudo cancelar.'); await cargar(); return; }
    avisar('Programación cancelada: la publicación volvió a borrador.');
    await cargar();
  };

  const refrescar = async (p: PublicacionIg) => {
    setBusyFila(p.id);
    const r = await refrescarPublicacionAction(p.id);
    setBusyFila(null);
    if (!r.ok) { setErrorLista(r.error ?? 'No se pudo actualizar.'); return; }
    await cargar();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
      {/* ── Compositor ── */}
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--card-pad)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Select
              label="Tipo de publicación"
              options={TIPOS}
              value={tipo}
              onChange={(v) => setTipo(v as Tipo)}
              width={230}
            />
            <Field label="Programación (opcional)" hint="Vacío = se publica cuando toques el botón.">
              <input
                type="datetime-local"
                value={programadoLocal}
                onChange={(e) => setProgramadoLocal(e.target.value)}
                style={{ minHeight: 'var(--touch)', padding: '8px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 'var(--fs-md)' }}
                aria-label="Fecha y hora de publicación"
              />
            </Field>
          </div>

          <Field label="Caption" count={[caption.length, 2200]}>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              maxLength={2200}
              placeholder="El texto que acompaña la publicación…"
            />
          </Field>

          <Field
            label="Media"
            hint={tipo === 'reel' ? 'Un video.' : tipo === 'story' ? 'Una imagen o video.' : tipo === 'carrusel' ? 'De 2 a 10 archivos.' : 'Al menos una imagen o video.'}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                ref={inputRef}
                type="file"
                multiple={tipo === 'carrusel' || tipo === 'feed'}
                accept={tipo === 'reel' ? 'video/*' : 'image/*,video/*'}
                onChange={(e) => agregarArchivos(e.target.files)}
                style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}
                aria-label="Archivos de la publicación"
              />
              {archivos.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {archivos.map((f, i) => (
                    <span key={`${f.name}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                      {f.name}
                      <button
                        type="button"
                        onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={`Quitar ${f.name}`}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 13, lineHeight: 1, padding: 0 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {errorForm && <Alert tono="bad">{errorForm}</Alert>}
          {!cuentaConectada && (
            <Alert tono="warn">
              Sin cuenta conectada solo se pueden guardar borradores. Conecta tu cuenta en Configuración para publicar.
            </Alert>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="tertiary" onClick={() => void guardar('borrador')} loading={busyModo === 'borrador'} disabled={busyModo !== null}>
              Guardar borrador
            </Button>
            {programadoLocal ? (
              <Button variant="primary" onClick={() => void guardar('programar')} loading={busyModo === 'programar'} disabled={busyModo !== null || !cuentaConectada}>
                Programar publicación
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void guardar('ahora')} loading={busyModo === 'ahora'} disabled={busyModo !== null || !cuentaConectada}>
                {etiquetaPublicar}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ── Lista ── */}
      <section>
        {errorLista && <Alert tono="bad">{errorLista}</Alert>}
        {posts === null ? (
          <SkeletonLines lines={4} />
        ) : posts.length === 0 ? (
          <EmptyState
            titulo="Todavía no hay publicaciones"
            detalle="Lo que guardes o programes desde el compositor aparece aquí, con su estado."
          />
        ) : (
          <div role="list">
            {posts.map((p) => {
              const ui = ESTADO_UI[p.estado];
              return (
                <div key={p.id} role="listitem" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 4px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 'var(--fs-md)' }}>
                        {TIPOS.find((t) => t.value === p.tipo)?.label ?? p.tipo}
                      </span>
                      <Status tono={ui.tono}>{ui.label}</Status>
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>
                        {p.estado === 'programado' && p.programadoAt ? `Sale el ${fecha(p.programadoAt)}`
                          : p.estado === 'publicado' && p.publicadoAt ? `Publicada el ${fecha(p.publicadoAt)}`
                          : `Creada el ${fecha(p.createdAt)}`}
                      </span>
                    </div>
                    {p.caption && (
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.caption}
                      </div>
                    )}
                    {/* El error, VISIBLE en la fila — nunca solo en un log. */}
                    {p.error && (
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--bad)', marginTop: 3 }}>{p.error}</div>
                    )}
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 3 }}>
                      {p.media.length} archivo{p.media.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                    {p.estado === 'programado' && (
                      <Button size="sm" variant="secondary" onClick={() => setCancelando(p)} disabled={busyFila === p.id}>
                        Cancelar programación
                      </Button>
                    )}
                    {p.zernioPostId && (p.estado === 'publicando' || p.estado === 'programado' || p.estado === 'parcial') && (
                      <Button size="sm" variant="tertiary" onClick={() => void refrescar(p)} loading={busyFila === p.id}>
                        Actualizar estado
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {cancelando && (
        <Confirm
          title="¿Cancelar la programación?"
          message={`La publicación deja de estar programada${cancelando.programadoAt ? ` para el ${fecha(cancelando.programadoAt)}` : ''} y vuelve a borrador. El contenido no se pierde.`}
          tone="primary"
          confirmLabel="Cancelar la programación"
          cancelLabel="Mantenerla programada"
          loading={busyFila === cancelando.id}
          onConfirm={() => void cancelar(cancelando)}
          onCancel={() => setCancelando(null)}
        />
      )}
    </div>
  );
}
