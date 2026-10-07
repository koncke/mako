'use client';

// =============================================================================
// NotasClase — las notas del equipo sobre UNA clase o UNA etapa, con su adjunto
// =============================================================================
// Pedido (tablero #692): una caja de notas debajo de cada clase (y de cada etapa), donde se
// dejan comentarios y se suben PDF, documentos o planillas. La monta el editor de la clase
// (EditorClase, debajo del formulario) y la cabecera de cada etapa (CursoApp, en un modal).
//
// ⚠️ COMENTA QUIEN VE LA TAB, no sólo un admin. Por eso el editor la monta AFUERA de su
// `<fieldset disabled>`: un fieldset deshabilitado apaga cada botón y cada textarea que tenga
// adentro, y quien sólo mira el curso se quedaba sin poder comentar (la misma trampa que ya
// mordió a «Ver» el 06/10, ver EditorClase).
//
// ⚠️ EL ADJUNTO VA DEL NAVEGADOR AL BUCKET con una URL firmada (`subirConProgreso`, la misma
// subida que los videos), y la nota se guarda DESPUÉS, verificando que el archivo haya llegado.
// Lo que se sube y no se comenta (se quita, o se cierra la caja) se descarta acá; lo que se
// escapa (pestaña cerrada a mitad) lo barre el cron de huérfanos pasadas 24 h.
//
// ⚠️ LAS NOTAS NO LLEGAN NUNCA AL ALUMNO: viven en `curso_clase_notas` y el portal no la lee.

import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, Textarea, Progress, Alert, Spinner, useConfirm } from '@/app/_ui';
import { mimeDeNota, ACEPTA_NOTA, TOPE_NOTA_BYTES, TOPE_NOTA_TEXTO, type DestinoNota, type NotaVista } from './reglas';
import {
  notasAction, agregarNotaAction, borrarNotaAction, urlSubidaNotaAction, descartarAdjuntoNotaAction, urlAdjuntoNotaAction,
} from './actions';
import { subirConProgreso, type Subida } from './subir-video';

type Adjunto = { path: string; nombre: string; mime: string; bytes: number };

/** Lo que dice el error cuando el formato no va. Corto: el detalle es la lista de MIME_NOTA. */
const FORMATOS = 'PDF, Office, CSV o imagen';

const fmtFecha = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
};

const fmtPeso = (b: number | null) => {
  if (b == null || !Number.isFinite(b)) return '';
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
};

const errorDe = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);

export function NotasClase({ productoId, destino, puedeBorrarTodo, onTotal }: {
  productoId: number;
  destino: DestinoNota;
  /** Es admin: puede borrar cualquier nota. Sólo decide si se DIBUJA el botón; el server decide. */
  puedeBorrarTodo?: boolean;
  /** Cuántas notas hay, cada vez que cambia: para el «N notas» de la lista sin recargar la página. */
  onTotal?: (n: number) => void;
}) {
  const claveDestino = 'claseId' in destino ? `c${destino.claseId}` : `e${destino.etapa}`;
  const [notas, setNotas] = useState<NotaVista[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [adjunto, setAdjunto] = useState<Adjunto | null>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmNode } = useConfirm();

  const subida = useRef<Subida | null>(null);
  // El adjunto subido que todavía no quedó en ninguna nota: se descarta si se quita, si se sube
  // otro encima o si la caja se cierra. Un ref y no el estado, porque lo lee el desmontaje.
  const pendiente = useRef<string | null>(null);
  const descartar = (p: string | null) => { if (p) void descartarAdjuntoNotaAction(p).catch(() => {}); };
  const onTotalRef = useRef(onTotal);
  useEffect(() => { onTotalRef.current = onTotal; });
  // El total sale de la lista, no de cada camino que la cambia (cargar, comentar, borrar).
  useEffect(() => { if (notas) onTotalRef.current?.(notas.length); }, [notas]);

  useEffect(() => {
    let vivo = true;
    setNotas(null); setErrorCarga(null);
    notasAction(productoId, destino)
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setNotas(r.notas); else setErrorCarga(r.error);
      })
      .catch((e) => { if (vivo) setErrorCarga(errorDe(e, 'No pude leer las notas.')); });
    return () => { vivo = false; };
    // `destino` se compara por su clave: es un objeto nuevo en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, claveDestino]);

  // Cerrar la caja (o el editor que la contiene) corta la subida en vuelo y descarta lo subido.
  useEffect(() => () => {
    subida.current?.cancelar();
    descartar(pendiente.current);
    pendiente.current = null;
  }, []);

  const elegirArchivo = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const mime = mimeDeNota(file.name, file.type);
    if (!mime) { setError(`Ese formato no va: ${FORMATOS}.`); return; }
    if (file.size > TOPE_NOTA_BYTES) { setError('Pasa de 25 MB.'); return; }
    // El tipo corregido viaja en la parte del multipart (ver `mimeDeNota`). Otra vista del mismo blob.
    const archivo = file.type === mime ? file : new File([file], file.name, { type: mime });
    try {
      const firma = await urlSubidaNotaAction(productoId, mime, archivo.size);
      if (!firma.ok) { setError(firma.error); return; }
      setSubiendo(0);
      const s = subirConProgreso(firma.signedUrl, archivo, firma.apikey, setSubiendo, FORMATOS);
      subida.current = s;
      await s.promesa;
      descartar(pendiente.current);
      pendiente.current = firma.path;
      setAdjunto({ path: firma.path, nombre: file.name, mime, bytes: archivo.size });
    } catch (e) {
      setError(errorDe(e, 'No se pudo subir.'));
    } finally {
      subida.current = null;
      setSubiendo(null);
    }
  };

  const quitarAdjunto = () => {
    descartar(pendiente.current);
    pendiente.current = null;
    setAdjunto(null);
  };

  const comentar = async () => {
    setError(null);
    if (!texto.trim() && !adjunto) return;
    if (texto.trim().length > TOPE_NOTA_TEXTO) { setError('La nota es demasiado larga.'); return; }
    setGuardando(true);
    try {
      const r = await agregarNotaAction({
        productoId,
        ...('claseId' in destino ? { claseId: destino.claseId } : { etapa: destino.etapa }),
        texto,
        archivo: adjunto,
      });
      if (!r.ok) { setError(r.error); return; }
      pendiente.current = null;
      setAdjunto(null);
      setTexto('');
      setNotas((ns) => [r.nota, ...(ns ?? [])]);
    } catch (e) {
      setError(errorDe(e, 'No se pudo guardar la nota.'));
    } finally {
      setGuardando(false);
    }
  };

  const abrir = async (n: NotaVista) => {
    setError(null);
    // La ventana se abre ANTES de esperar al server: abierta después de un `await`, el bloqueador
    // de ventanas emergentes la frena porque ya no viene «del clic».
    const w = window.open('about:blank', '_blank');
    try {
      const r = await urlAdjuntoNotaAction(n.id);
      if (!r.ok) { w?.close(); setError(r.error); return; }
      if (w) { w.opener = null; w.location.href = r.url; } else window.location.href = r.url;
    } catch (e) {
      w?.close();
      setError(errorDe(e, 'No pude abrir el archivo.'));
    }
  };

  const borrar = async (n: NotaVista) => {
    const ok = await confirm(n.archivo ? 'Se borra también su archivo.' : 'No se puede deshacer.', { title: '¿Borrar la nota?', confirmLabel: 'Borrar' });
    if (!ok) return;
    try {
      const r = await borrarNotaAction(n.id);
      if (!r.ok) { setError(r.error); return; }
      setNotas((ns) => (ns ?? []).filter((x) => x.id !== n.id));
    } catch (e) {
      setError(errorDe(e, 'No se pudo borrar la nota.'));
    }
  };

  const ocupado = guardando || subiendo !== null;

  return (
    <section className="cn" aria-label="Notas">
      <div className="cn-rotulo">Notas</div>

      {error && <Alert tono="bad">{error}</Alert>}

      <div className="cn-nueva">
        <Textarea rows={2} value={texto} placeholder="Escribe una nota…" aria-label="Nota"
          maxLength={TOPE_NOTA_TEXTO} onChange={(e) => setTexto(e.target.value)} />
        {subiendo !== null && <Progress value={subiendo} label={`Subiendo ${subiendo}%`} />}
        <div className="cn-pie">
          {adjunto ? (
            <span className="cn-chip">
              <span className="cn-chip-nombre">{adjunto.nombre}</span>
              <IconButton small title="Quitar archivo" disabled={guardando} onClick={quitarAdjunto}>✕</IconButton>
            </span>
          ) : subiendo === null && (
            <label className="cn-adjuntar">
              <input type="file" accept={ACEPTA_NOTA} disabled={ocupado}
                onChange={(e) => { void elegirArchivo(e.target.files?.[0]); e.target.value = ''; }} />
              <span>Adjuntar</span>
            </label>
          )}
          <span style={{ flex: 1 }} />
          <Button size="sm" loading={guardando} disabled={subiendo !== null || (!texto.trim() && !adjunto)} onClick={() => void comentar()}>Comentar</Button>
        </div>
      </div>

      {errorCarga ? (
        <Alert tono="bad">No pude leer las notas. {errorCarga}</Alert>
      ) : notas == null ? (
        <div className="cn-cargando"><Spinner /></div>
      ) : notas.length === 0 ? (
        <p className="cn-vacio">Sin notas.</p>
      ) : (
        <ol className="cn-lista">
          {notas.map((n) => (
            <li key={n.id} className="cn-nota">
              {n.texto && <p className="cn-texto">{n.texto}</p>}
              {n.archivo && (
                <button type="button" className="cn-archivo" onClick={() => void abrir(n)} title="Abrir archivo">
                  <span className="cn-chip-nombre">{n.archivo.nombre}</span>
                  {n.archivo.bytes != null && <span className="cn-peso">{fmtPeso(n.archivo.bytes)}</span>}
                </button>
              )}
              <div className="cn-meta">
                <span className="cn-autor">{n.autor}</span>
                <span>·</span>
                <span>{fmtFecha(n.createdAt)}</span>
                <span style={{ flex: 1 }} />
                {(n.borrable || puedeBorrarTodo) && (
                  <IconButton small danger title="Borrar nota" onClick={() => void borrar(n)}>✕</IconButton>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {confirmNode}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </section>
  );
}

const CSS = `
.cn{ display:flex; flex-direction:column; gap:10px; }
.cn-rotulo{ font-size:var(--fs-sm); font-weight:600; color:var(--ink); }
.cn-nueva{ display:flex; flex-direction:column; gap:8px; }
.cn-pie{ display:flex; align-items:center; gap:8px; min-width:0; }
.cn-adjuntar{ display:inline-flex; align-items:center; padding:5px 12px; border:1px dashed var(--border-strong); border-radius:var(--r-sm); cursor:pointer; font-size:var(--fs-sm); color:var(--ink); }
.cn-adjuntar:hover{ border-color:var(--primary); color:var(--primary); }
.cn-adjuntar input{ position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
.cn-chip{ display:inline-flex; align-items:center; gap:4px; min-width:0; max-width:60%; padding:2px 4px 2px 10px; border:1px solid var(--border); border-radius:var(--r-sm); background:var(--surface-2); font-size:var(--fs-sm); }
.cn-chip-nombre{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.cn-cargando{ display:flex; justify-content:center; padding:8px 0; color:var(--dim); }
.cn-vacio{ margin:0; font-size:var(--fs-sm); color:var(--dim); }
.cn-lista{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; border-top:1px solid var(--border); }
.cn-nota{ display:flex; flex-direction:column; gap:6px; padding:10px 0; border-bottom:1px solid var(--border); }
.cn-texto{ margin:0; font-size:var(--fs-sm); color:var(--ink); line-height:1.5; white-space:pre-wrap; overflow-wrap:anywhere; }
.cn-archivo{ align-self:flex-start; display:inline-flex; align-items:center; gap:8px; max-width:100%; padding:5px 10px; border:1px solid var(--border); border-radius:var(--r-sm); background:var(--surface-2); color:var(--primary); font:inherit; font-size:var(--fs-sm); cursor:pointer; }
.cn-archivo:hover{ border-color:var(--primary); }
.cn-peso{ flex:none; color:var(--dim); font-size:var(--fs-meta); }
.cn-meta{ display:flex; align-items:center; gap:6px; font-size:var(--fs-meta); color:var(--faint); }
.cn-autor{ font-weight:600; color:var(--dim); }
`;
