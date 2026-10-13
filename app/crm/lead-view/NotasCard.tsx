'use client';

// =============================================================================
// NotasCard — notas de seguimiento MANUAL del lead (cualquier etapa)
// =============================================================================
// El lugar donde el usuario deja apuntes de lo que hizo a mano con el prospecto
// (mandé WhatsApp, lo llamé, quedó en avisarme…). No depende del status: sirve
// igual en Nutrición Manual, R2, o donde sea. Cada nota queda con fecha y autor
// en el historial del lead (evento 'Nota').
//
// Lo que pidió Martín el 12/10/2026 (punto 17), textual: «En "Notas" no permitas que el modal de
// texto se pueda modificar el tamaño. E implementa el botón de audio que tenemos en varios
// lugares, para dictarle. Y una nota se debería poder editar o eliminar luego de ser creada.»
//
//   · La caja NO se redimensiona (`resize: 'none'`): crece sola con lo que se escribe, hasta un
//     tope, y desde ahí scrollea. La manija de la esquina dejaba la caja de cualquier tamaño y se
//     comía la ficha.
//   · El micrófono es `BotonDictar` (app/plan/board/CrearTareaModal.tsx), el MISMO del Plan, de
//     «Crear con IA» y del AI Step: dicta en vivo con el reconocimiento del navegador y, si el
//     navegador no lo trae, graba y transcribe. Lo dictado se PEGA en la caja; guardar sigue
//     siendo un clic de la persona.
//   · Cada nota se edita (el lápiz) y se borra (el tacho rojo de la casa, con su confirmación):
//     app/crm/notas-actions.ts, con las guardas de las vecinas.
//
// La montan la ficha del CRM (pop-up y ruta) y la ficha de un cliente de Customer Success.

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { useRefrescarFicha } from './ficha-cambio';
import { addLeadNoteAction, getLeadNotasAction, type LeadAuditRowFull } from '../actions';
import { editarNotaLeadAction, borrarNotaLeadAction, urlSubidaNotaLeadAction, urlAdjuntoNotaLeadAction, descartarAdjuntoNotaLeadAction } from '../notas-actions';
// El adjunto: la MISMA subida y los MISMOS formatos que las notas del curso (mig 0208 / 0267).
import { subirConProgreso } from '@/app/customer-success/curso/subir-video';
import { mimeDeNota, ACEPTA_NOTA, TOPE_NOTA_BYTES } from '@/app/customer-success/curso/reglas';
import { TOPE_NOTA } from '../notas-reglas';
import { useTzWorkspace } from './useTzWorkspace';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
// Los emojis son los del composer de WhatsApp: el MISMO panel y la misma inserción en el cursor
// (tercer feedback del 12/10/2026, punto 3: «las notas como los chats de MaKo»).
import { EmojiPicker } from '@/app/whatsapp/EmojiPicker';
import { PopoverWA, insertarEnCursor } from '@/app/whatsapp/_shared/ComposerWhatsApp';
import { IconSmiley, IconClip } from '@/app/whatsapp/_shared/composer-icons';

/** El archivo elegido para la nota que se está escribiendo: sube apenas se elige. */
type AdjuntoEnCurso = { nombre: string; mime: string; bytes: number; path: string | null; pct: number };
import { BotonBorrar, estiloCaja } from '@/app/_ui/BotonBorrar';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Confirm } from '@/app/_ui/Confirm';
import { Spinner } from '@/app/_ui/Feedback';
import { Toast, useToast } from '@/app/_ui/Toast';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

/** La caja de texto: sin manija de tamaño (punto 17) y creciendo sola hasta `ALTO_MAX`. */
const caja: CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 84, resize: 'none', overflowY: 'auto',
  padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 14, lineHeight: 1.5, outline: 'none',
};
const ALTO_MAX = 320;

/**
 * El alto de la caja sigue al texto. Sin la manija, una nota larga quedaría en una ventanita de
 * cuatro renglones; con esto crece hasta `ALTO_MAX` y recién ahí scrollea. Corre también cuando el
 * texto cambia desde AFUERA (el dictado lo escribe sin que haya un `onInput`).
 */
function useAltoQueSigue(texto: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(ALTO_MAX, Math.max(84, el.scrollHeight + 2))}px`;
  }, [texto]);
  return ref;
}

const fmtFecha = (iso: string, tz: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(d);
};

const botonPrincipal = (activo: boolean): CSSProperties => ({
  padding: '10px 20px', borderRadius: 10, border: 'none', background: activo ? 'var(--primary)' : 'var(--border)',
  color: activo ? '#fff' : 'var(--faint)', fontSize: 14, fontWeight: 700, cursor: activo ? 'pointer' : 'default', fontFamily: SANS,
});
const botonSecundario: CSSProperties = {
  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS,
};

export function NotasCard({ leadId }: { leadId: number }) {
  const refrescarFicha = useRefrescarFicha();
  const tz = useTzWorkspace();
  const [notas, setNotas] = useState<LeadAuditRowFull[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [pending, startTransition] = useTransition();
  const { toast, show, clear } = useToast();
  const refNueva = useAltoQueSigue(texto);
  const [btnEmoji, setBtnEmoji] = useState<HTMLButtonElement | null>(null);
  const refArchivo = useRef<HTMLInputElement>(null);
  const [adjunto, setAdjunto] = useState<AdjuntoEnCurso | null>(null);
  const subiendo = !!adjunto && !adjunto.path;
  /**
   * ⚠️ SUBE APENAS SE ELIGE, directo al bucket (lib: `urlSubidaNotaLeadAction`), y la nota lo
   * nombra recién al agregarla, después de que el server comprueba que llegó. El tipo se corrige
   * por la extensión (`mimeDeNota`): con el que pone Windows a un .csv, el bucket rebota un
   * archivo bueno.
   */
  const elegirArchivo = async (file: File | undefined) => {
    if (!file) return;
    const mime = mimeDeNota(file.name, file.type);
    if (!mime) { show('Ese formato no va', undefined, 'bad'); return; }
    if (file.size > TOPE_NOTA_BYTES) { show('Pasa de 25 MB', undefined, 'bad'); return; }
    if (adjunto?.path) void descartarAdjuntoNotaLeadAction(leadId, adjunto.path);
    setAdjunto({ nombre: file.name, mime, bytes: file.size, path: null, pct: 0 });
    const r = await urlSubidaNotaLeadAction(leadId, mime, file.size).catch(() => ({ ok: false as const, error: 'No pude preparar la subida.' }));
    if (!r.ok) { setAdjunto(null); show(r.error, undefined, 'bad'); return; }
    try {
      const f = new File([file], file.name, { type: mime });
      await subirConProgreso(r.signedUrl, f, r.apikey, (pct) => setAdjunto((a) => (a ? { ...a, pct } : a)), 'PDF, Word, Excel o una imagen').promesa;
      setAdjunto((a) => (a ? { ...a, path: r.path, pct: 100 } : a));
    } catch (e) {
      setAdjunto(null);
      show(e instanceof Error ? e.message : 'No se pudo subir', undefined, 'bad');
    }
  };
  const quitarAdjunto = () => {
    if (adjunto?.path) void descartarAdjuntoNotaLeadAction(leadId, adjunto.path);
    setAdjunto(null);
  };
  const abrirAdjunto = async (notaId: number) => {
    const r = await urlAdjuntoNotaLeadAction(leadId, notaId).catch(() => ({ ok: false as const, error: 'No pude abrir el archivo.' }));
    if (r.ok) window.open(r.url, '_blank', 'noopener');
    else show(r.error, undefined, 'bad');
  };
  const [emojis, setEmojis] = useState(false);
  /** El emoji va donde está el cursor, no al final, y nunca pasa el tope de la nota. */
  const ponerEmoji = (em: string) => {
    const el = refNueva.current;
    const r = insertarEnCursor(texto, el?.selectionStart, el?.selectionEnd, em);
    if (r.valor.length > TOPE_NOTA) return;
    setTexto(r.valor);
  };
  /** La nota que se está editando (id) y su texto en curso. */
  const [editando, setEditando] = useState<{ id: number; texto: string } | null>(null);
  const refEdicion = useAltoQueSigue(editando?.texto ?? '');
  const [aBorrar, setABorrar] = useState<LeadAuditRowFull | null>(null);

  useEffect(() => {
    let alive = true;
    getLeadNotasAction(leadId)
      .then((r) => { if (alive) setNotas(r); })
      .catch(() => {})
      .finally(() => { if (alive) setCargando(false); });
    return () => { alive = false; };
  }, [leadId]);

  const releer = async () => {
    const r = await getLeadNotasAction(leadId);
    setNotas(r);
    refrescarFicha();
  };

  const agregar = () => {
    const t = texto.trim();
    // Una nota puede ser SÓLO el archivo (como en un chat). Mientras sube, no se agrega.
    if ((!t && !adjunto?.path) || pending || subiendo) return;
    // Lo dictado no pasa por el `maxLength` de la caja: el server lo rechaza igual (TOPE_NOTA).
    if (t.length > TOPE_NOTA) { show('Nota demasiado larga', undefined, 'bad'); return; }
    const adj = adjunto?.path ? { path: adjunto.path, nombre: adjunto.nombre, mime: adjunto.mime, bytes: adjunto.bytes } : null;
    setTexto('');
    startTransition(async () => {
      try {
        await addLeadNoteAction(leadId, t, adj);
        setAdjunto(null);
        await releer();
      } catch (e) { setTexto(t); show(e instanceof Error && e.message ? e.message : 'No se pudo guardar', undefined, 'bad'); }
    });
  };

  const guardarEdicion = () => {
    if (!editando || pending) return;
    const { id, texto: t } = editando;
    const original = notas.find((n) => n.id === id)?.valor_nuevo ?? '';
    if (!t.trim()) { show('La nota quedó vacía', undefined, 'bad'); return; }
    if (t.trim() === original.trim()) { setEditando(null); return; }
    startTransition(async () => {
      const r = await editarNotaLeadAction(leadId, id, t).catch(() => ({ ok: false as const, error: 'No se pudo guardar.' }));
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      setEditando(null);
      await releer().catch(() => {});
      show('Nota guardada');
    });
  };

  const borrar = () => {
    const n = aBorrar;
    if (!n) return;
    startTransition(async () => {
      const r = await borrarNotaLeadAction(leadId, n.id).catch(() => ({ ok: false as const, error: 'No se pudo borrar.' }));
      setABorrar(null);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      // Optimista: la nota se va de la lista ya, y la relectura confirma.
      setNotas((xs) => xs.filter((x) => x.id !== n.id));
      if (editando?.id === n.id) setEditando(null);
      await releer().catch(() => {});
      show('Nota borrada');
    });
  };

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Notas</div>

      <textarea
        ref={refNueva}
        value={texto}
        maxLength={TOPE_NOTA}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); agregar(); } }}
        placeholder="Ej: Le mandé WhatsApp para retomar; quedó en avisarme la semana que viene."
        style={caja}
      />
      {adjunto && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '7px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13 }}>
          <span aria-hidden style={{ color: 'var(--dim)', display: 'inline-flex' }}><IconClip /></span>
          <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adjunto.nombre}</span>
          {subiendo && <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)' }}>{adjunto.pct}%</span>}
          <button type="button" onClick={quitarAdjunto} disabled={pending} aria-label="Quitar el archivo" title="Quitar el archivo"
            style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 2 }}>×</button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <input ref={refArchivo} type="file" accept={ACEPTA_NOTA} hidden
          onChange={(e) => { void elegirArchivo(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" onClick={() => refArchivo.current?.click()} disabled={subiendo || pending} title="Adjuntar un archivo" aria-label="Adjuntar un archivo"
          style={{ width: 34, height: 34, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, border: '1px solid transparent', background: 'transparent', cursor: subiendo ? 'default' : 'pointer', color: 'var(--dim)', opacity: subiendo ? 0.5 : 1 }}><IconClip /></button>
        <button type="button" ref={setBtnEmoji} onClick={() => setEmojis((v) => !v)} title="Emojis" aria-label="Emojis" aria-expanded={emojis}
          style={{ width: 34, height: 34, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: emojis ? 'var(--primary)' : 'var(--dim)' }}><IconSmiley /></button>
        {emojis && (
          <PopoverWA ancla={btnEmoji} etiqueta="Emojis" onCerrar={() => setEmojis(false)}>
            <EmojiPicker onPick={ponerEmoji} onClose={() => setEmojis(false)} />
          </PopoverWA>
        )}
        <BotonDictar titulo="Dictar la nota" valor={texto} onValor={setTexto} onError={(m) => show(m, undefined, 'bad')} />
        <button type="button" onClick={agregar} disabled={(!texto.trim() && !adjunto?.path) || pending || subiendo} style={botonPrincipal((!!texto.trim() || !!adjunto?.path) && !pending && !subiendo)}>
          {pending && !editando && !aBorrar ? 'Guardando…' : 'Agregar nota'}
        </button>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cargando && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--faint)' }}><Spinner size={14} /> Cargando notas</div>}
        {!cargando && notas.length === 0 && (
          <div style={{ fontSize: 13.5, color: 'var(--faint)', fontStyle: 'italic', padding: '4px 0' }}>Todavía no hay notas. Escribe la primera arriba.</div>
        )}
        {notas.map((n) => {
          const enEdicion = editando?.id === n.id;
          // `valor_anterior` en una nota es la versión ORIGINAL: sólo existe si alguien la editó
          // (app/crm/notas-actions.ts). Es lo que dice el «editada» del pie.
          const editada = n.valor_anterior != null && n.valor_anterior !== n.valor_nuevo;
          return (
            <div key={n.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', background: 'var(--surface-2)' }}>
              {enEdicion && editando ? (
                <>
                  <textarea
                    ref={refEdicion}
                    autoFocus
                    value={editando.texto}
                    maxLength={TOPE_NOTA}
                    aria-label="Editar la nota"
                    onChange={(e) => setEditando({ id: n.id, texto: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); guardarEdicion(); return; }
                      if (e.key === 'Escape') {
                        // ⚠️ `stopImmediatePropagation`: los Escape de los modales viven en `document`
                        // y en captura. Sin esto, salir de la edición cerraría además la ficha entera.
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        e.preventDefault();
                        setEditando(null);
                      }
                    }}
                    style={{ ...caja, background: 'var(--surface)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 10 }}>
                    <BotonDictar titulo="Dictar en la nota" valor={editando.texto} onValor={(v) => setEditando({ id: n.id, texto: v })} onError={(m) => show(m, undefined, 'bad')} />
                    <button type="button" onClick={() => setEditando(null)} disabled={pending} style={botonSecundario}>Dejar como estaba</button>
                    <button type="button" onClick={guardarEdicion} disabled={pending || !editando.texto.trim()} style={botonPrincipal(!pending && !!editando.texto.trim())}>
                      {pending ? 'Guardando…' : 'Guardar nota'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {(n.valor_nuevo ?? '').trim() && (
                    <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.valor_nuevo}</div>
                  )}
                  {n.archivo_nombre && (
                    <button type="button" onClick={() => void abrirAdjunto(n.id)} title={`Abrir ${n.archivo_nombre}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '100%', marginTop: (n.valor_nuevo ?? '').trim() ? 8 : 0, padding: '6px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--primary)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      <span aria-hidden style={{ display: 'inline-flex' }}><IconClip /></span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.archivo_nombre}</span>
                    </button>
                  )}
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11.5, color: 'var(--faint)' }}>
                {n.autor_foto && <img src={n.autor_foto} alt="" width={18} height={18} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
                <span style={{ fontWeight: 600, color: 'var(--dim)' }}>{n.autor_nombre}</span>
                <span>·</span>
                <span style={{ fontFamily: MONO }}>{fmtFecha(n.created_at, tz)}</span>
                {editada && <span title={`Decía: ${n.valor_anterior}`}>· editada</span>}
                {!enEdicion && (
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
                    <button type="button" onClick={() => setEditando({ id: n.id, texto: n.valor_nuevo ?? '' })} disabled={pending}
                      title="Editar la nota" aria-label="Editar la nota" style={estiloCaja('sm')}>
                      <IconoMenu nombre="editar" size={14} />
                    </button>
                    <BotonBorrar talla="sm" title="Borrar la nota" disabled={pending} onClick={() => setABorrar(n)} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {aBorrar && (
        <Confirm
          title="¿Borrar esta nota?"
          message="El texto se borra y no se puede recuperar. En el historial queda que se borró."
          confirmLabel="Borrar nota"
          cancelLabel="Conservar la nota"
          tone="danger"
          loading={pending}
          onConfirm={borrar}
          onCancel={() => setABorrar(null)}
        />
      )}
      <Toast state={toast} onClose={clear} />
    </section>
  );
}
