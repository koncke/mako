'use client';

// =============================================================================
// EditorEmailGmail — el paso de EMAIL de un flujo, como se redacta en Gmail
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 4): «De la misma manera que creaste el editor de
// WhatsApp, crea el editor de Email, con la interfaz de Gmail, que se parezca.»
//
// Tercera tanda (09/10/2026, punto 12 y decisión 12 de docs/chatbot-flujo-ramas-diseno.md): «Mejora el
// diseño de la tarjeta de Email, nuevamente, que no esté una cosa al costado y el editable en el otro
// costado... Sería bueno que copies el editor de texto que tenemos en las descripciones de las clases de
// la tab de cursos, donde se puede poner de todo, ya que así funciona un email».
//
// UNA columna, como la ventana de redactar de Gmail: «Mensaje nuevo», De (sólo lectura), Para, Asunto,
// Vista previa (el preheader) y el CUERPO abajo, que es el editor rico de las lecciones del curso
// (`app/_ui/EditorRico.tsx`, cargado a demanda como en LeccionEditable: `editor-rico-perezoso`). Abajo,
// la barra de Gmail: { } (un dato del lead), el emoji y el ojo, que cambia el cuerpo por el correo tal
// como LLEGA (el MISMO render que manda el motor, `renderEmailHtml`) en la misma columna.
//
// Cómo mapea al paso:
//   · el editor rico escribe HTML → `cuerpo_html`; el texto plano de respaldo `cuerpo` lo deriva
//     `textoDeHtmlEmail` (lib/email-html-seguro.ts). El server vuelve a sanear y a derivar al guardar
//     (`setSecuenciaPasos`): la pantalla no decide qué se guarda, sólo qué se ve mientras tanto.
//   · un email de ANTES (sin `cuerpo_html`) abre su texto con marcas como HTML (`htmlDeCuerpoTexto`, las
//     mismas reglas con que sale hoy); mientras no se toque el cuerpo, el paso sigue sin HTML y sale igual.
//
// Lo que NO hay, a propósito:
//   · subir imágenes o archivos: el editor rico sólo acepta adjuntos de un bucket PRIVADO
//     (`mako-adjunto:<uuid>`), con URLs que vencen, y un correo abierto mañana mostraría la imagen rota.
//     Sin `subirAdjunto`, sus botones no se dibujan. El saneo sí deja pasar una imagen https.
//   · lo insertado (un video, una agenda): un mail no reproduce un iframe; el saneo lo manda como un LINK
//     a su dirección, y así se ve en el ojo.
//   · otras variables que las del MOTOR (lib/template-vars.ts): lo que el envío no conoce queda literal.
//
// El De: el remitente es del WORKSPACE, no del paso (`getEmailFrom`), y se lee de GET /api/email/dominio.
// Si es el sandbox de Resend, el motor falla ese paso cada 24 h; si el envío de email está apagado, no
// sale nada. Las dos cosas se dicen con un chip corto al lado del De, que es donde se mira quién manda.
//
// ⚠️ NADA DE ACÁ PUBLICA: `onChange` es un cambio local del lienzo (sólo «Publicar» publica).
// ⚠️ `cuerpoHtml` lo pasa quien monta (`paso.cuerpo_html`). Si no lo pasa, el editor lleva su propia
//    copia (sembrada del texto) para no recargarse en cada tecla: funciona, pero un deshacer del lienzo
//    sólo vuelve el texto.
// =============================================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as EventoMouse } from 'react';
import { PopoverWA, MenuWA, insertarEnCursor } from '../whatsapp/_shared/ComposerWhatsApp';
import { IconSmiley } from '../whatsapp/_shared/composer-icons';
import { EmojiPicker } from '../whatsapp/EmojiPicker';
import { EditorRicoPerezoso } from '../customer-success/curso/editor-rico-perezoso';
import { useWs } from '@/app/_ui/Link';
import { renderEmailHtml, htmlDeCuerpoTexto, type RenderEmailParams } from '@/lib/email-html';
import { textoDeHtmlEmail, aplicarVariablesHtml } from '@/lib/email-html-seguro';
import { VARIABLES_LEAD, VARIABLES_NEGOCIO, aplicarVariables } from '@/lib/template-vars';

export type CambioEmail = { asunto?: string; preheader?: string; cuerpo?: string; cuerpo_html?: string };

export type EditorEmailGmailProps = {
  asunto: string;
  preheader: string;
  /** El texto plano del paso (`cuerpo`). Con él abre un email de antes, que no tiene `cuerpoHtml`. */
  cuerpo: string;
  /** El cuerpo del editor rico (`paso.cuerpo_html`). Ver la cabecera si falta. */
  cuerpoHtml?: string | null;
  /** Cambio LOCAL: nunca publica. Un cambio del cuerpo trae `cuerpo_html` y su `cuerpo` derivado. */
  onChange: (patch: CambioEmail) => void;
  /** Nombre del negocio: resuelve `{{negocio}}` en la vista de cómo llega, como el motor. */
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

/** «Nombre <mail>» → sus dos mitades, para el De. */
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

/**
 * Lo que la vista de cómo llega le pasa a `renderEmailHtml`, con las MISMAS reglas que el envío
 * (lib/nutricion.ts, la rama de email de `procesarEnvios`): el asunto vacío sale «(sin asunto)», el
 * preheader vacío no va, la firma es el nombre del remitente (o ninguna) y el cuerpo HTML va con las
 * variables escapadas (`aplicarVariablesHtml`). Sólo se resuelve `{{negocio}}`, con la función del
 * motor: el nombre del lead lo pone el envío para cada uno, y lo que el motor no conoce tiene que verse
 * crudo, como va a llegar. Pura y exportada para que un test la compare con el motor.
 */
export function paramsDeVista(p: { asunto: string; preheader: string; cuerpo: string; cuerpoHtml?: string | null; negocio?: string; remitente: string }): RenderEmailParams {
  const vars: Record<string, string> = p.negocio?.trim() ? { negocio: p.negocio.trim() } : {};
  const asunto = aplicarVariables(p.asunto, vars) || '(sin asunto)';
  return {
    subject: asunto,
    bodyText: aplicarVariables(p.cuerpo, vars),
    ...(p.cuerpoHtml ? { bodyHtml: aplicarVariablesHtml(p.cuerpoHtml, vars) } : {}),
    preheader: aplicarVariables(p.preheader, vars) || undefined,
    // El link de baja de verdad lleva un token por lead; acá alcanza con que el pie se vea igual.
    unsubscribeUrl: '#',
    fromName: nombreDelRemitente(p.remitente),
  };
}

/**
 * Mete un texto (un dato `{{…}}`, un emoji) donde está el cursor del editor rico, que no expone su
 * instancia: se le PEGA. ProseMirror toma el pegado de su propia selección aunque el foco esté en el
 * botón o en el buscador de emojis, y lo apila en su deshacer como cualquier pegado. Sin un
 * `DataTransfer` construible (navegadores viejos), cae a `insertText` sobre el texto enfocado.
 */
function insertarEnEditorRico(caja: HTMLElement | null, texto: string): boolean {
  const pm = caja?.querySelector<HTMLElement>('.ProseMirror');
  if (!pm || !texto) return false;
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', texto);
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    pm.dispatchEvent(ev);
    if (ev.defaultPrevented) { pm.focus(); return true; }
  } catch { /* sin DataTransfer construible: el camino de abajo */ }
  pm.focus();
  return typeof document.execCommand === 'function' && document.execCommand('insertText', false, texto);
}

const CSS = `
.mk-gmail{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface)}
.mk-gmail-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column}
.mk-gmail-fila{flex:none;display:flex;align-items:center;gap:8px;min-height:32px;padding:0 12px;border-bottom:1px solid var(--border);font-size:13px}
.mk-gmail-fila input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--ink);font-family:${SANS};font-size:13px;padding:6px 0}
.mk-gmail-boton{flex:none;height:28px;min-width:28px;padding:0 7px;border:none;border-radius:7px;background:transparent;color:var(--dim);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-family:${SANS};font-size:12.5px;font-weight:600}
.mk-gmail-boton:hover:not(:disabled){background:var(--surface-2);color:var(--ink)}
.mk-gmail-boton[aria-pressed="true"]{background:var(--primary-bg);color:var(--primary)}
.mk-gmail-boton:disabled{opacity:.5;cursor:default}
.mk-gmail-cuerpo{flex:1 0 auto;display:flex;flex-direction:column;padding:2px 4px 6px}
.mk-gmail .mk-gmail-cuerpo .mk-editor-rico{border:none;border-radius:0;background:transparent}
.mk-gmail .mk-gmail-cuerpo .mk-editor-rico:focus-within{box-shadow:none}
.mk-gmail .mk-gmail-cuerpo .mk-er-barra{border-radius:0}
`;

const rotuloFila: CSSProperties = { flex: 'none', width: 34, color: 'var(--faint)', fontSize: 12.5 };

function IconOjo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** El editor no tiene adjuntos (ver la cabecera): ninguna referencia se dibuja. */
const sinAdjuntos = () => null;

export function EditorEmailGmail({ asunto, preheader, cuerpo, cuerpoHtml, onChange, negocio, deshabilitado }: EditorEmailGmailProps) {
  const ws = useWs();
  const clave = String(ws ?? '');
  const [estado, setEstado] = useState<EstadoRemitente | null | undefined>(() => {
    const c = cacheRemitente.get(clave);
    return c && Date.now() - c.t < CACHE_MS ? c.estado : undefined;
  });
  const [abierto, setAbierto] = useState<'datos' | 'datos-cuerpo' | 'emoji' | null>(null);
  const [verLlega, setVerLlega] = useState(false);
  const [btnDatos, setBtnDatos] = useState<HTMLButtonElement | null>(null);
  const [btnDatosCuerpo, setBtnDatosCuerpo] = useState<HTMLButtonElement | null>(null);
  const [btnEmoji, setBtnEmoji] = useState<HTMLButtonElement | null>(null);
  const campoAsunto = useRef<HTMLInputElement>(null);
  const cajaCuerpo = useRef<HTMLDivElement>(null);

  // La copia propia del cuerpo, para cuando quien monta no pasa `cuerpoHtml` (y para abrir un email de
  // antes). Se re-siembra sólo si el TEXTO cambió desde afuera (un deshacer del lienzo); lo que escribe
  // el editor la actualiza ANTES de avisar, así su propio cambio no la vuelve a sembrar del texto.
  const [copia, setCopia] = useState(() => ({ cuerpo, html: cuerpoHtml || htmlDeCuerpoTexto(cuerpo) }));
  if (!cuerpoHtml && cuerpo !== copia.cuerpo) setCopia({ cuerpo, html: htmlDeCuerpoTexto(cuerpo) });
  const valorHtml = cuerpoHtml || copia.html;

  const alCambiarCuerpo = (html: string) => {
    const texto = textoDeHtmlEmail(html);
    setCopia({ cuerpo: texto, html });
    onChange({ cuerpo_html: html, cuerpo: texto });
  };

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

  const remitente = estado?.remitente ?? '';
  const de = remitente ? partirRemitente(remitente) : null;
  const aviso = avisoDelRemitente(estado ?? null);
  // El correo como llega se arma SÓLO con el ojo prendido: con el editor a la vista no hace falta.
  const html = useMemo(
    () => (verLlega ? renderEmailHtml(paramsDeVista({ asunto, preheader, cuerpo, cuerpoHtml: valorHtml, negocio, remitente })) : ''),
    [verLlega, asunto, preheader, cuerpo, valorHtml, negocio, remitente],
  );

  const variables = [...VARIABLES_LEAD, ...VARIABLES_NEGOCIO];

  const insertarEnAsunto = (texto: string) => {
    const el = campoAsunto.current;
    const r = insertarEnCursor(asunto, el?.selectionStart, el?.selectionEnd, texto);
    onChange({ asunto: r.valor });
    // El cursor vuelve después del dato, cuando React ya escribió el valor nuevo.
    requestAnimationFrame(() => { try { el?.focus(); el?.setSelectionRange(r.cursor, r.cursor); } catch { /* el campo ya no está */ } });
  };

  // Los botones de la barra NO se llevan el foco: con el foco en el cuerpo, el dato entra donde está
  // el cursor sin tener que volver a ubicarlo.
  const sinRobarFoco = (e: EventoMouse) => e.preventDefault();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, minWidth: 0, fontFamily: SANS }}>
      <style>{CSS}</style>
      <section className="mk-gmail" aria-label="Mensaje nuevo">
        <div style={{ flex: 'none', padding: '8px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
          Mensaje nuevo
        </div>
        <div className="mk-gmail-scroll">
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
          {/* El cuerpo se ESCONDE con el ojo prendido, no se desmonta: así no pierde su deshacer. */}
          <div ref={cajaCuerpo} className="mk-gmail-cuerpo" style={verLlega ? { display: 'none' } : undefined}>
            <EditorRicoPerezoso valor={valorHtml} onCambio={alCambiarCuerpo} urlDeAdjunto={sinAdjuntos}
              placeholder="Escribe el email" etiqueta="Cuerpo del email" minAlto={120} soloLectura={deshabilitado} />
          </div>
          {verLlega && (
            // Sin `allow-scripts` ni `allow-same-origin`: el documento queda aislado (molde: BandejaEmail).
            <iframe
              title="Así llega el correo"
              srcDoc={html}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              style={{ flex: '1 0 auto', minHeight: 260, width: '100%', border: 'none', background: 'var(--surface-2)' }}
            />
          )}
        </div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', borderTop: '1px solid var(--border)' }}>
          <button type="button" ref={setBtnDatosCuerpo} className="mk-gmail-boton" onMouseDown={sinRobarFoco} disabled={deshabilitado || verLlega}
            title="Insertar un dato" aria-label="Insertar un dato en el cuerpo" aria-expanded={abierto === 'datos-cuerpo'}
            onClick={() => setAbierto((a) => (a === 'datos-cuerpo' ? null : 'datos-cuerpo'))} style={{ fontFamily: "'Geist Mono', monospace" }}>{'{ }'}</button>
          <button type="button" ref={setBtnEmoji} className="mk-gmail-boton" onMouseDown={sinRobarFoco} disabled={deshabilitado || verLlega}
            title="Emojis" aria-label="Insertar un emoji" aria-expanded={abierto === 'emoji'}
            onClick={() => setAbierto((a) => (a === 'emoji' ? null : 'emoji'))}><IconSmiley /></button>
          <button type="button" className="mk-gmail-boton" onMouseDown={sinRobarFoco} aria-pressed={verLlega}
            title="Así llega" aria-label="Ver cómo llega el correo" style={{ marginLeft: 'auto' }}
            onClick={() => { setAbierto(null); setVerLlega((v) => !v); }}><IconOjo /></button>
        </div>
      </section>

      {abierto === 'datos' && (
        <PopoverWA ancla={btnDatos} etiqueta="Datos" onCerrar={() => setAbierto(null)}>
          <MenuWA alElegir={() => setAbierto(null)}
            opciones={variables.map((v) => ({ key: v.key, label: v.label, detalle: `{{${v.key}}}`, onElegir: () => insertarEnAsunto(`{{${v.key}}}`) }))} />
        </PopoverWA>
      )}
      {abierto === 'datos-cuerpo' && (
        <PopoverWA ancla={btnDatosCuerpo} etiqueta="Datos" onCerrar={() => setAbierto(null)}>
          <MenuWA alElegir={() => setAbierto(null)}
            opciones={variables.map((v) => ({ key: v.key, label: v.label, detalle: `{{${v.key}}}`, onElegir: () => { insertarEnEditorRico(cajaCuerpo.current, `{{${v.key}}}`); } }))} />
        </PopoverWA>
      )}
      {abierto === 'emoji' && (
        <PopoverWA ancla={btnEmoji} etiqueta="Emojis" onCerrar={() => setAbierto(null)}>
          <EmojiPicker onPick={(em) => { insertarEnEditorRico(cajaCuerpo.current, em); }} onClose={() => setAbierto(null)} />
        </PopoverWA>
      )}
    </div>
  );
}
