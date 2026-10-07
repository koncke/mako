'use client';

// =============================================================================
// EditorClase — crear o editar UNA clase del curso
// =============================================================================
// Título, etapa, tipo, minutos, lo que ve el cliente arriba del video, el video (un link o un
// archivo subido), la tarea con su formulario, y si cierra la etapa. Y debajo, las notas del
// equipo sobre la clase (NotasClase, #692), que puede dejar cualquiera que vea la tab.
//
// ⚠️ «CIERRA LA ETAPA» ES LO QUE MUEVE AL CLIENTE. La etapa se completa cuando el cliente
// ENVIÓ todas las tareas marcadas así (`etapaCompleta`, lib/curso.ts), y entonces el paso
// automático lo lleva a la siguiente. Por eso el rótulo dice lo que hace y no «obligatoria».
//
// ⚠️ EL VIDEO SUBIDO NO PASA POR EL SERVER: va del navegador al bucket con una URL firmada
// (una server action topa en 1 MB). El path lo arma el server; el guardado verifica que el
// archivo haya llegado. Cerrar el editor con la subida en curso la CANCELA: dejarla seguir
// subiría hasta 2 GB a un path que ninguna clase va a mirar.

import { useEffect, useRef, useState } from 'react';
import { Modal, Button, TextField, Select, Switch, Field, Input, Textarea, Progress, Alert, useConfirm } from '@/app/_ui';
import { videoDeLink, embedDe, tieneTarea, type Campo, type Clase, type TipoClase } from '@/lib/curso';
import { TIPOS_CLASE, TOPE_TITULO, TOPE_VIDEO_BYTES, MIME_VIDEO, mimeDeArchivo, type EntradaClase } from './reglas';
import { guardarClaseAction, urlSubidaVideoAction, urlVerVideoAction, descartarVideoAction } from './actions';
import { subirConProgreso, duracionDeArchivo, type Subida } from './subir-video';
import { EditorCampos } from './EditorCampos';
import { NotasClase } from './NotasClase';

type ModoVideo = 'ninguno' | 'link' | 'archivo';

export type EtapaOpcion = { key: string; label: string };

export function EditorClase({ productoId, etapas, clase, etapaInicial, puedeEditar, avanceEnClase, onCerrar, onGuardada, onBorrar, onNotas }: {
  productoId: number;
  etapas: EtapaOpcion[];
  /** `null` = clase nueva. */
  clase: Clase | null;
  etapaInicial: string;
  puedeEditar: boolean;
  /** Cuántos clientes ya tienen avance en esta clase (para el aviso de borrar). */
  avanceEnClase: number;
  onCerrar: () => void;
  onGuardada: (c: Clase) => void;
  onBorrar?: (c: Clase) => void;
  /** Cuántas notas tiene la clase, cada vez que cambia (el «N notas» de la lista). */
  onNotas?: (n: number) => void;
}) {
  const [titulo, setTitulo] = useState(clase?.titulo ?? '');
  const [etapa, setEtapa] = useState(clase?.etapa ?? etapaInicial);
  const [tipo, setTipo] = useState<TipoClase>(clase?.tipo ?? 'clase');
  const [minutos, setMinutos] = useState<string>(clase?.minutos != null ? String(clase.minutos) : '');
  const [descripcion, setDescripcion] = useState(clase?.descripcion ?? '');
  const [modo, setModo] = useState<ModoVideo>(clase?.videoTipo === 'archivo' ? 'archivo' : clase && clase.videoTipo !== 'ninguno' ? 'link' : 'ninguno');
  const [link, setLink] = useState(clase?.videoUrl ?? '');
  const [path, setPath] = useState<string | null>(clase?.videoPath ?? null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [tarea, setTarea] = useState(clase?.tarea ?? '');
  const [campos, setCampos] = useState<Campo[]>(clase?.campos ?? []);
  const [obligatoria, setObligatoria] = useState(clase?.obligatoria ?? false);

  const [subiendo, setSubiendo] = useState<number | null>(null);
  const subida = useRef<Subida | null>(null);
  // El último video que se subió en ESTE editor y todavía no quedó guardado en la clase. Si se
  // cierra sin guardar, se guarda con otro video, o se sube otro encima, se descarta: cada
  // subida abandonada son hasta 2 GiB en un bucket con 5 GiB de tope para toda la plataforma.
  const subidoSinGuardar = useRef<string | null>(null);
  const descartar = (p: string | null) => { if (p) void descartarVideoAction(p); };
  const [verUrl, setVerUrl] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmNode } = useConfirm();

  // Cerrar el editor (o desmontarlo) corta la subida que esté en vuelo. Ver la cabecera.
  useEffect(() => () => subida.current?.cancelar(), []);

  const reconocido = modo === 'link' ? videoDeLink(link) : null;
  const conTarea = tieneTarea({ tarea, campos });
  const ocupado = guardando || subiendo !== null;
  const soloVer = !puedeEditar;

  const elegirArchivo = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setVerUrl(null);
    const mime = mimeDeArchivo(file.name, file.type);
    if (!mime) { setError('Ese formato no va: MP4, WEBM o MOV.'); return; }
    if (file.size > TOPE_VIDEO_BYTES) { setError('Pasa de 2 GB.'); return; }
    // El tipo corregido viaja en la parte del multipart (ver subir-video.ts). `new File` sobre
    // el mismo archivo no copia los bytes: es otra vista del mismo blob.
    const archivo = file.type === mime ? file : new File([file], file.name, { type: mime });
    if (!minutos.trim()) {
      const d = await duracionDeArchivo(archivo);
      if (d) setMinutos(String(Math.max(1, Math.round(d / 60))));
    }
    const firma = await urlSubidaVideoAction(productoId, mime, archivo.size);
    if (!firma.ok) { setError(firma.error); return; }
    setSubiendo(0);
    const s = subirConProgreso(firma.signedUrl, archivo, firma.apikey, setSubiendo);
    subida.current = s;
    try {
      await s.promesa;
      descartar(subidoSinGuardar.current);
      subidoSinGuardar.current = firma.path;
      setPath(firma.path);
      setNombreArchivo(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir.');
    } finally {
      subida.current = null;
      setSubiendo(null);
    }
  };

  const ver = async () => {
    if (verUrl) { setVerUrl(null); return; }
    if (modo === 'archivo' && path) {
      const r = await urlVerVideoAction(path);
      if (!r.ok) { setError(r.error); return; }
      setVerUrl(r.url);
    } else if (reconocido) {
      setVerUrl(embedDe(reconocido) ?? reconocido.url);
    }
  };

  const guardar = async () => {
    setError(null);
    if (!titulo.trim()) { setError('Falta el título.'); return; }
    if (modo === 'link' && !reconocido) { setError('Ese link no es válido.'); return; }
    if (modo === 'archivo' && !path) { setError('Falta subir el video.'); return; }
    if (obligatoria && !conTarea) { setError('Para cerrar la etapa, agrega la tarea.'); return; }
    const entrada: EntradaClase = {
      id: clase?.id ?? null, productoId, etapa, titulo, descripcion, tipo,
      minutos: minutos.trim() === '' ? null : minutos,
      video: modo === 'link' ? { tipo: 'link', url: link } : modo === 'archivo' && path ? { tipo: 'archivo', path } : { tipo: 'ninguno' },
      tarea, campos, obligatoria,
    };
    setGuardando(true);
    const r = await guardarClaseAction(entrada);
    setGuardando(false);
    if (!r.ok) { setError(r.error); return; }
    if (subidoSinGuardar.current !== r.clase.videoPath) descartar(subidoSinGuardar.current);
    subidoSinGuardar.current = null;
    onGuardada(r.clase);
  };

  const borrar = async () => {
    if (!clase || !onBorrar) return;
    const ok = await confirm(
      avanceEnClase > 0
        ? `Se pierde el avance de ${avanceEnClase} ${avanceEnClase === 1 ? 'cliente' : 'clientes'}.`
        : 'Nadie la empezó todavía.',
      { title: '¿Borrar la clase?', confirmLabel: 'Borrar' },
    );
    if (!ok) return;
    descartar(subidoSinGuardar.current);
    subidoSinGuardar.current = null;
    onBorrar(clase);
  };

  const cerrar = async () => {
    if (subiendo !== null && !(await confirm('El video se está subiendo.', { title: '¿Cancelar la subida?', confirmLabel: 'Cancelar subida', cancelLabel: 'Seguir' }))) return;
    descartar(subidoSinGuardar.current);
    subidoSinGuardar.current = null;
    onCerrar();
  };

  // Lo que se dice debajo del link: de qué es y si se puede medir. «Sin medir» y no un 0%:
  // Drive y Loom se ven, pero no avisan cuánto (decisión del 06/10).
  const notaLink = !link.trim() ? undefined
    : !reconocido ? 'No es un link válido.'
    : `${ROTULO[reconocido.tipo]} · ${reconocido.medible ? 'se mide' : 'sin medir'}`;

  // «Ver» sólo con algo que se pueda reproducir acá: un iframe de su plataforma o un archivo
  // directo. Un link a una página cualquiera dentro de un <video> es un recuadro negro que parece
  // un video roto.
  const puedeVerse = (modo === 'archivo' && path && subiendo === null) || (modo === 'link' && reconocido && (embedDe(reconocido) || reconocido.medible));
  const vistaPrevia = (
    <>
      {puedeVerse && (
        <div>
          <Button size="sm" variant="tertiary" onClick={() => void ver()}>{verUrl ? 'Ocultar' : 'Ver'}</Button>
        </div>
      )}
      {verUrl && (
        modo === 'archivo' || (reconocido && !embedDe(reconocido))
          ? <video className="edc-ver" src={verUrl} controls preload="metadata" />
          : <iframe className="edc-ver" src={verUrl} title="Vista previa" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      )}
    </>
  );

  return (
    <Modal
      titulo={clase ? (soloVer ? clase.titulo : 'Editar clase') : 'Nueva clase'}
      ancho={720}
      alto="min(88vh, 820px)"
      onCerrar={() => void cerrar()}
      pie={
        <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
          {clase && onBorrar && puedeEditar && (
            <Button variant="tertiary" size="sm" disabled={ocupado} onClick={() => void borrar()}>Borrar</Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" onClick={() => void cerrar()}>{soloVer ? 'Cerrar' : 'Cancelar'}</Button>
          {puedeEditar && <Button size="sm" loading={guardando} disabled={subiendo !== null} onClick={() => void guardar()}>Guardar</Button>}
        </div>
      }
    >
      <fieldset disabled={soloVer} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <Alert tono="bad">{error}</Alert>}

        <TextField label="Título" required value={titulo} maxLength={TOPE_TITULO} onChange={(e) => setTitulo(e.target.value)} />

        <div className="edc-grid">
          <Select label="Etapa" value={etapa} onChange={setEtapa} disabled={soloVer}
            options={etapas.map((e) => ({ value: e.key, label: e.label }))} />
          <Select label="Tipo" value={tipo} onChange={(v) => setTipo(v as TipoClase)} disabled={soloVer}
            options={TIPOS_CLASE.map((t) => ({ value: t.value, label: t.label }))} />
          <TextField label="Minutos" type="number" min={0} max={600} value={minutos} onChange={(e) => setMinutos(e.target.value)} />
        </div>

        <Field label="Descripción" hint="Lo que lee arriba del video.">
          <Textarea rows={3} value={descripcion} aria-label="Descripción" onChange={(e) => setDescripcion(e.target.value)} />
        </Field>

        <Field label="Video">
          <div className="edc-modos" role="radiogroup" aria-label="Video">
            {(['ninguno', 'link', 'archivo'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={modo === m} data-on={modo === m}
                disabled={soloVer || subiendo !== null} onClick={() => { setModo(m); setVerUrl(null); setError(null); }}>
                {m === 'ninguno' ? 'Sin video' : m === 'link' ? 'Link' : 'Subir'}
              </button>
            ))}
          </div>

          {modo === 'link' && (
            <div className="edc-video">
              <Input value={link} placeholder="https://…" aria-label="Link del video" onChange={(e) => { setLink(e.target.value); setVerUrl(null); }} />
              {notaLink && <span className={`edc-nota${reconocido ? '' : ' is-mal'}`}>{notaLink}</span>}
            </div>
          )}

          {modo === 'archivo' && (
            <div className="edc-video">
              {subiendo !== null ? (
                <Progress value={subiendo} label={`Subiendo ${subiendo}%`} />
              ) : path ? (
                <span className="edc-nota">{nombreArchivo ?? 'Video subido'} · se mide</span>
              ) : null}
              {puedeEditar && subiendo === null && (
                <label className="edc-archivo">
                  <input type="file" accept={[...MIME_VIDEO, '.mp4', '.webm', '.mov', '.m4v'].join(',')}
                    onChange={(e) => { void elegirArchivo(e.target.files?.[0]); e.target.value = ''; }} />
                  <span>{path ? 'Cambiar video' : 'Elegir video'}</span>
                </label>
              )}
            </div>
          )}

          {!soloVer && vistaPrevia}
        </Field>

        <Field label="Tarea" hint="Qué tiene que hacer después de verla.">
          <Textarea rows={3} value={tarea} aria-label="Tarea" onChange={(e) => setTarea(e.target.value)} />
        </Field>

        <Field label="Formulario" hint={campos.length ? undefined : 'Sin campos, contesta en texto libre.'}>
          <EditorCampos campos={campos} onCampos={setCampos} deshabilitado={soloVer} />
        </Field>

        <Switch checked={obligatoria} onChange={setObligatoria} disabled={soloVer}
          label="Cierra la etapa" hint={obligatoria && !conTarea ? 'Necesita una tarea.' : undefined} />
      </fieldset>
      {/* ⚠️ PARA QUIEN SÓLO MIRA, LA VISTA PREVIA VA AFUERA DEL FIELDSET: un `<fieldset disabled>`
          apaga TODOS los botones que tiene adentro, así que «Ver» quedaba muerto justo para la
          persona para la que existe `urlVerVideoAction` (revisión del 06/10/2026). */}
      {soloVer && vistaPrevia}

      {/* ⚠️ LAS NOTAS VAN AFUERA DEL FIELDSET, por la misma razón que «Ver»: comenta quien VE la
          tab, no sólo un admin, y adentro de un `<fieldset disabled>` la caja y sus botones
          quedaban muertos para todos los que no editan (#692). Sólo con la clase guardada: una
          nota cuelga del id de la clase, y una clase nueva todavía no tiene. */}
      {clase && (
        <div className="edc-notas">
          <NotasClase productoId={productoId} destino={{ claseId: clase.id }} puedeBorrarTodo={puedeEditar} onTotal={onNotas} />
        </div>
      )}

      {confirmNode}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Modal>
  );
}

const ROTULO: Record<string, string> = { youtube: 'YouTube', vimeo: 'Vimeo', loom: 'Loom', drive: 'Drive', url: 'Link' };

const CSS = `
.edc-grid{ display:grid; grid-template-columns:1.4fr 1fr 110px; gap:12px; align-items:start; }
@media (max-width:640px){ .edc-grid{ grid-template-columns:1fr; } }
.edc-modos{ display:inline-flex; border:1px solid var(--border-strong); border-radius:var(--r-sm); overflow:hidden; align-self:flex-start; }
.edc-modos button{ padding:7px 14px; border:0; background:var(--surface); color:var(--dim); font:inherit; font-size:var(--fs-sm); cursor:pointer; min-height:34px; }
.edc-modos button + button{ border-left:1px solid var(--border-strong); }
.edc-modos button[data-on="true"]{ background:var(--primary-bg); color:var(--primary); font-weight:600; }
.edc-modos button:disabled{ cursor:default; opacity:.6; }
.edc-video{ display:flex; flex-direction:column; gap:6px; margin-top:8px; }
.edc-nota{ font-size:var(--fs-meta); color:var(--dim); }
.edc-nota.is-mal{ color:var(--bad); }
.edc-archivo{ align-self:flex-start; display:inline-flex; align-items:center; padding:7px 14px; border:1px dashed var(--border-strong); border-radius:var(--r-sm); cursor:pointer; font-size:var(--fs-sm); color:var(--ink); }
.edc-archivo:hover{ border-color:var(--primary); color:var(--primary); }
.edc-archivo input{ position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
.edc-ver{ width:100%; aspect-ratio:16/9; border:0; border-radius:var(--r-md); background:#000; margin-top:8px; }
.edc-notas{ margin-top:20px; padding-top:16px; border-top:1px solid var(--border); }
`;
