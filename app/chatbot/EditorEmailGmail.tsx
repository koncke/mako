'use client';

// =============================================================================
// EditorEmailGmail — el paso de EMAIL de un flujo, como se redacta en Gmail
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 4): «De la misma manera que creaste el editor de
// WhatsApp, crea el editor de Email, con la interfaz de Gmail, que se parezca.» Decisión 12 del diseño
// (docs/chatbot-flujo-ramas-diseno.md).
//
// A la IZQUIERDA, «Mensaje nuevo» como la ventana de redactar de Gmail: De (sólo lectura), Para, Asunto,
// Vista previa y el cuerpo, con el emoji y el 🔗 en la barra de abajo. A la DERECHA, el mail ABIERTO con
// el MISMO render que sale (`renderEmailHtml`, lib/email-html.ts) en un iframe: lo que se ve es lo que
// llega. El molde de la derecha es app/perfil/BandejaEmail.tsx.
//
// Lo que NO hay, a propósito, porque el motor no lo manda y prometerlo sería una mentira de pantalla
// (lib/nutricion.ts, el envío de email, y lib/email-html.ts):
//   · HTML, imágenes, títulos, listas, colores: el cuerpo se ESCAPA entero (`bodyToHtml`). Por eso el
//     cuerpo es app/agencia/EditorMensaje.tsx, que guarda las marcas `*` `_` `~` —las tres que el mail
//     traduce— y NO app/_ui/EditorRico.tsx, que emite HTML: el lead recibiría `<b>` literal.
//   · un link con texto propio: el 🔗 mete la URL COMO TEXTO; la vuelve link `linkify` al mandar.
//   · un botón: `renderEmailHtml` lo sabe dibujar, pero el motor no le pasa `cta`.
//   · otras variables que las del MOTOR (lib/template-vars.ts): lo que el envío no conoce queda literal.
//
// El De: el remitente es del WORKSPACE, no del paso (`getEmailFrom`), y se lee de GET
// /api/email/dominio. Si es el sandbox de Resend, el motor falla ese paso cada 24 h («remitente
// sandbox»); si el envío de email está apagado, no sale nada. Las dos cosas se dicen con un chip corto
// al lado del De, que es donde se mira quién manda.
//
// ⚠️ NADA DE ACÁ PUBLICA: `onChange` es un cambio local del lienzo (sólo «Publicar» publica).
// =============================================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as EventoMouse } from 'react';
import { EditorMensaje, type EditorMensajeHandle } from '../agencia/EditorMensaje';
import { PopoverWA, MenuWA, insertarEnCursor } from '../whatsapp/_shared/ComposerWhatsApp';
import { IconSmiley } from '../whatsapp/_shared/composer-icons';
import { EmojiPicker } from '../whatsapp/EmojiPicker';
import { useWs } from '@/app/_ui/Link';
import { renderEmailHtml } from '@/lib/email-html';
import { VARIABLES_LEAD, VARIABLES_NEGOCIO, aplicarVariables } from '@/lib/template-vars';

export type EditorEmailGmailProps = {
  asunto: string;
  preheader: string;
  cuerpo: string;
  /** Cambio LOCAL: nunca publica. */
  onChange: (patch: { asunto?: string; preheader?: string; cuerpo?: string }) => void;
  /** Nombre del negocio: resuelve `{{negocio}}` en la vista previa, como el motor. */
  negocio?: string;
  deshabilitado?: boolean;
};

const SANS = "'Geist', sans-serif";

/** Lo que contesta GET /api/email/dominio y este editor usa. */
type EstadoRemitente = { remitente: string; sandbox: boolean; envioHabilitado: boolean };

// El remitente se pide UNA vez por pestaña y cliente (5 min): la ruta le pregunta a Resend en vivo, y
// el editor se monta cada vez que se toca una tarjeta de email.
const CACHE_MS = 5 * 60_000;
const cacheRemitente = new Map<string, { t: number; estado: EstadoRemitente | null }>();

/**
 * El nombre que firma el pie del mail, con la MISMA regla que el motor (`displayNameDe` en
 * lib/resend.ts, que no se puede importar acá: ese módulo lleva `server-only` por la API key).
 * «Nombre <mail>» → «Nombre»; un mail pelado no tiene nombre.
 */
export function nombreDelRemitente(remitente: string): string {
  const m = remitente.match(/^(.*?)\s*</);
  return m ? m[1].trim().replace(/^"|"$/g, '') : '';
}

/** «Nombre <mail>» → sus dos mitades, para la cabecera del mail abierto. */
function partirRemitente(s: string): { nombre: string; mail: string } {
  const m = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(s);
  if (m) return { nombre: m[1] || m[2], mail: m[2] };
  return { nombre: s.trim(), mail: s.trim() };
}

/** Qué avisa el chip del De, o nada. El sandbox primero: con él no sale aunque el envío esté prendido. */
export function avisoDelRemitente(e: Pick<EstadoRemitente, 'sandbox' | 'envioHabilitado'> | null): string | null {
  if (!e) return null;
  if (e.sandbox) return 'No sale · dominio sin verificar';
  if (!e.envioHabilitado) return 'Email apagado';
  return null;
}

/** Una URL tipeada, lista para que `linkify` la reconozca: sin esquema no sería un link. */
export function urlParaInsertar(crudo: string): string | null {
  const t = crudo.trim();
  if (!t || /\s/.test(t)) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}

const CSS = `
.mk-gmail{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);grid-template-rows:minmax(0,1fr);gap:12px;flex:1 1 auto;min-height:0}
.mk-gmail>section{min-height:0;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface)}
.mk-gmail-fila{display:flex;align-items:center;gap:8px;min-height:30px;padding:0 12px;border-bottom:1px solid var(--border);font-size:13px}
.mk-gmail-fila input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--ink);font-family:${SANS};font-size:13px;padding:6px 0}
.mk-gmail-boton{flex:none;height:28px;min-width:28px;padding:0 7px;border:none;border-radius:7px;background:transparent;color:var(--dim);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-family:${SANS};font-size:12.5px;font-weight:600}
.mk-gmail-boton:hover:not(:disabled){background:var(--surface-2);color:var(--ink)}
.mk-gmail-boton:disabled{opacity:.5;cursor:default}
@container mkgmail (max-width: 620px){.mk-gmail{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto}.mk-gmail-abierto{height:380px}}
`;

const rotuloFila: CSSProperties = { flex: 'none', width: 34, color: 'var(--faint)', fontSize: 12.5 };

function Avatar({ letra }: { letra: string }) {
  return (
    <div aria-hidden style={{ width: 32, height: 32, borderRadius: '50%', flex: 'none', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, fontFamily: SANS }}>
      {letra}
    </div>
  );
}

function IconLink() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.4" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.33-1.33" />
    </svg>
  );
}

export function EditorEmailGmail({ asunto, preheader, cuerpo, onChange, negocio, deshabilitado }: EditorEmailGmailProps) {
  const ws = useWs();
  const clave = String(ws ?? '');
  const [estado, setEstado] = useState<EstadoRemitente | null | undefined>(() => {
    const c = cacheRemitente.get(clave);
    return c && Date.now() - c.t < CACHE_MS ? c.estado : undefined;
  });
  const [abierto, setAbierto] = useState<'datos' | 'emoji' | 'link' | null>(null);
  const [url, setUrl] = useState('');
  const [btnDatos, setBtnDatos] = useState<HTMLButtonElement | null>(null);
  const [btnEmoji, setBtnEmoji] = useState<HTMLButtonElement | null>(null);
  const [btnLink, setBtnLink] = useState<HTMLButtonElement | null>(null);
  const campoAsunto = useRef<HTMLInputElement>(null);
  const editor = useRef<EditorMensajeHandle>(null);

  useEffect(() => {
    const c = cacheRemitente.get(clave);
    if (c && Date.now() - c.t < CACHE_MS) return;
    let vivo = true;
    fetch('/api/email/dominio', { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      .then((r) => r.json())
      .then((j: { ok?: boolean; remitente?: string; sandbox?: boolean; envioHabilitado?: boolean }) => {
        const e: EstadoRemitente | null = j?.ok
          ? { remitente: String(j.remitente ?? ''), sandbox: j.sandbox === true, envioHabilitado: j.envioHabilitado === true }
          : null;
        cacheRemitente.set(clave, { t: Date.now(), estado: e });
        if (vivo) setEstado(e);
      })
      // Sin red o sin permiso: el De queda sin nombre. No se inventa un remitente.
      .catch(() => { if (vivo) setEstado(null); });
    return () => { vivo = false; };
  }, [clave]);

  // La vista previa resuelve SÓLO `{{negocio}}`, con la función del MOTOR: el nombre del lead lo pone
  // el envío para cada uno, y lo que el motor no conoce tiene que verse crudo, como va a llegar.
  const vars = useMemo<Record<string, string>>(() => (negocio?.trim() ? { negocio: negocio.trim() } : {}), [negocio]);
  const asuntoVisto = aplicarVariables(asunto, vars).trim() || '(sin asunto)';
  const preheaderVisto = aplicarVariables(preheader, vars).trim();
  const remitente = estado?.remitente ?? '';
  const de = remitente ? partirRemitente(remitente) : null;
  const firma = nombreDelRemitente(remitente);
  const aviso = avisoDelRemitente(estado ?? null);

  const html = useMemo(() => renderEmailHtml({
    subject: asuntoVisto,
    bodyText: aplicarVariables(cuerpo, vars),
    preheader: preheaderVisto || undefined,
    // El link de baja de verdad lleva un token por lead; acá alcanza con que el pie se vea igual.
    unsubscribeUrl: '#',
    // La firma es la del motor: el nombre del remitente, y si no tiene nombre, ninguna.
    fromName: firma || undefined,
  }), [asuntoVisto, cuerpo, vars, preheaderVisto, firma]);
  // ⚠️ EL IFRAME SE RECARGA CON CADA `srcDoc` NUEVO: escribiendo, parpadearía en cada tecla. La vista
  // previa va con un respiro; el primer render ya la trae.
  const [htmlVisto, setHtmlVisto] = useState(html);
  useEffect(() => {
    if (html === htmlVisto) return;
    const t = setTimeout(() => setHtmlVisto(html), 350);
    return () => clearTimeout(t);
  }, [html, htmlVisto]);

  const variables = [...VARIABLES_LEAD, ...VARIABLES_NEGOCIO];
  const datosCuerpo = [
    { titulo: 'El lead', items: VARIABLES_LEAD },
    { titulo: 'Tu negocio', items: VARIABLES_NEGOCIO },
  ];

  const insertarEnAsunto = (texto: string) => {
    const el = campoAsunto.current;
    const r = insertarEnCursor(asunto, el?.selectionStart, el?.selectionEnd, texto);
    onChange({ asunto: r.valor });
    // El cursor vuelve después del dato, cuando React ya escribió el valor nuevo.
    requestAnimationFrame(() => { try { el?.focus(); el?.setSelectionRange(r.cursor, r.cursor); } catch { /* el campo ya no está */ } });
  };

  const insertarLink = () => {
    const u = urlParaInsertar(url);
    if (!u) return;
    editor.current?.insertar(`${u} `);
    setUrl('');
    setAbierto(null);
  };

  // Los botones de la barra NO se llevan el foco: con el foco en el cuerpo, el emoji entra donde está
  // el cursor sin tener que volver a ubicarlo.
  const sinRobarFoco = (e: EventoMouse) => e.preventDefault();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, minWidth: 0, containerType: 'inline-size', containerName: 'mkgmail', fontFamily: SANS }}>
      <style>{CSS}</style>
      <div className="mk-gmail">
        {/* ── Mensaje nuevo ── */}
        <section aria-label="Mensaje nuevo">
          <div style={{ flex: 'none', padding: '8px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
            Mensaje nuevo
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div className="mk-gmail-fila">
              <span style={rotuloFila}>De</span>
              <span style={{ flex: 1, minWidth: 0, color: de ? 'var(--ink)' : 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                title={remitente || undefined}>
                {estado === undefined ? '…' : de ? (de.nombre !== de.mail ? `${de.nombre} <${de.mail}>` : de.mail) : '—'}
              </span>
              {aviso && (
                <span style={{ flex: 'none', padding: '2px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: 'var(--warn-bg)', color: 'var(--warn)', whiteSpace: 'nowrap' }}>
                  {aviso}
                </span>
              )}
            </div>
            <div className="mk-gmail-fila">
              <span style={rotuloFila}>Para</span>
              <span style={{ color: 'var(--ink)' }}>El lead</span>
            </div>
            <div className="mk-gmail-fila">
              <input ref={campoAsunto} value={asunto} placeholder="Asunto" aria-label="Asunto" disabled={deshabilitado}
                onChange={(e) => onChange({ asunto: e.target.value })} style={{ fontWeight: 600 }} />
              <button type="button" ref={setBtnDatos} className="mk-gmail-boton" onMouseDown={sinRobarFoco} disabled={deshabilitado}
                title="Insertar un dato" aria-label="Insertar un dato en el asunto" aria-expanded={abierto === 'datos'}
                onClick={() => setAbierto((a) => (a === 'datos' ? null : 'datos'))} style={{ fontFamily: "'Geist Mono', monospace" }}>{'{ }'}</button>
            </div>
            <div className="mk-gmail-fila">
              <input value={preheader} placeholder="Vista previa" aria-label="Vista previa" disabled={deshabilitado}
                onChange={(e) => onChange({ preheader: e.target.value })} style={{ color: 'var(--dim)' }} />
            </div>
            <div style={{ flex: '1 0 auto', padding: '8px 10px 4px' }}>
              <EditorMensaje ref={editor} valor={cuerpo} onChange={(v) => onChange({ cuerpo: v })} filas={4} maxAlto={600}
                disabled={deshabilitado} variables={datosCuerpo} etiqueta="Cuerpo del email" />
            </div>
          </div>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', borderTop: '1px solid var(--border)' }}>
            <button type="button" ref={setBtnEmoji} className="mk-gmail-boton" onMouseDown={sinRobarFoco} disabled={deshabilitado}
              title="Emojis" aria-label="Insertar un emoji" aria-expanded={abierto === 'emoji'}
              onClick={() => setAbierto((a) => (a === 'emoji' ? null : 'emoji'))}><IconSmiley /></button>
            <button type="button" ref={setBtnLink} className="mk-gmail-boton" onMouseDown={sinRobarFoco} disabled={deshabilitado}
              title="Insertar un link" aria-label="Insertar un link" aria-expanded={abierto === 'link'}
              onClick={() => setAbierto((a) => (a === 'link' ? null : 'link'))}><IconLink /></button>
          </div>
        </section>

        {/* ── El mail abierto: el MISMO render que sale ── */}
        <section className="mk-gmail-abierto" aria-label="Así llega">
          <div style={{ flex: 'none', padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asuntoVisto}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, minWidth: 0 }}>
              <Avatar letra={((de?.nombre || negocio || 'M').trim().charAt(0) || 'M').toUpperCase()} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong style={{ fontWeight: 600 }}>{de?.nombre || negocio?.trim() || 'Tu negocio'}</strong>
                  {de && de.mail !== de.nombre && <span style={{ color: 'var(--faint)' }}> &lt;{de.mail}&gt;</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 1 }}>para el lead</div>
              </div>
            </div>
          </div>
          {/* Sin `allow-scripts` ni `allow-same-origin`: el documento queda aislado (molde: BandejaEmail). */}
          <iframe
            title="Vista previa del correo"
            srcDoc={htmlVisto}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            style={{ flex: 1, minHeight: 220, width: '100%', border: 'none', background: 'var(--surface-2)' }}
          />
        </section>
      </div>

      {abierto === 'datos' && (
        <PopoverWA ancla={btnDatos} etiqueta="Datos" onCerrar={() => setAbierto(null)}>
          <MenuWA alElegir={() => setAbierto(null)}
            opciones={variables.map((v) => ({ key: v.key, label: v.label, detalle: `{{${v.key}}}`, onElegir: () => insertarEnAsunto(`{{${v.key}}}`) }))} />
        </PopoverWA>
      )}
      {abierto === 'emoji' && (
        <PopoverWA ancla={btnEmoji} etiqueta="Emojis" onCerrar={() => setAbierto(null)}>
          {/* Elegir un emoji no se lleva el foco del cuerpo; escribir en su buscador, sí (por eso
              EditorMensaje recuerda dónde estaba el cursor). */}
          <div onMouseDown={(e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault(); }}>
            <EmojiPicker onPick={(em) => editor.current?.insertar(em)} onClose={() => setAbierto(null)} />
          </div>
        </PopoverWA>
      )}
      {abierto === 'link' && (
        <PopoverWA ancla={btnLink} etiqueta="Insertar un link" onCerrar={() => setAbierto(null)}>
          <form onSubmit={(e) => { e.preventDefault(); insertarLink(); }}
            style={{ display: 'flex', gap: 6, padding: 8, width: 300, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: '0 12px 34px rgba(18,21,27,.18)' }}>
            <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="La dirección del link"
              style={{ flex: 1, minWidth: 0, height: 32, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, outline: 'none' }} />
            <button type="submit" disabled={!urlParaInsertar(url)}
              style={{ flex: 'none', height: 32, padding: '0 12px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: urlParaInsertar(url) ? 'pointer' : 'default', opacity: urlParaInsertar(url) ? 1 : 0.5 }}>
              Insertar
            </button>
          </form>
        </PopoverWA>
      )}
    </div>
  );
}
