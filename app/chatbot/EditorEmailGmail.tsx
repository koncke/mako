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
// Cuarta tanda (09/10/2026, punto 16 y decisión 16): «En la opción de "De" se debería poder elegir el
// email remitente, si se tiene vinculado varios email, con el botón de vincular nuevo, y que se haga
// desde allí mismo... Debajo de ASUNTO, hay un editable de "Vista previa", eso no tiene mucho sentido,
// eliminalo. Y también elimina el botón del ojo de "Así llega", para eso ya tenemos arriba del todo la
// opción de PROBAR, sin embargo, siempre debe estar formateado el email de salida, si le quiero editar
// tipo HTML debería poder... Y los botones de abajo del todo de "{}" y emoji, deberían estar en algún
// lugar del editable de texto arriba, donde están las negritas, etc...»
//
// UNA columna, como la ventana de redactar de Gmail: «Mensaje nuevo», De, Para, Asunto y el CUERPO
// abajo, que es el editor rico de las lecciones del curso (`app/_ui/EditorRico.tsx`, cargado a demanda
// como en LeccionEditable: `editor-rico-perezoso`). En SU barra de formato van «{ }» (un dato del lead),
// el emoji y «</>» (el HTML crudo): `botonesExtra`, una prop opcional que las lecciones no pasan.
//
// Cómo mapea al paso:
//   · el editor rico escribe HTML → `cuerpo_html`; el texto plano de respaldo `cuerpo` lo deriva
//     `textoDeHtmlEmail` (lib/email-html-seguro.ts). El server vuelve a sanear y a derivar al guardar
//     (`setSecuenciaPasos`): la pantalla no decide qué se guarda, sólo qué se ve mientras tanto.
//   · el MODO HTML edita el mismo `cuerpo_html` como texto: cada tecla pasa por la MISMA lista blanca
//     (`sanearHtmlEmail`) antes de llegar al paso, y la caja conserva lo que se escribió. Las variables
//     `{{…}}` se resuelven por contexto al mandar, igual que desde el editor (escapadas en el texto,
//     codificadas en un link: `aplicarVariablesHtml`).
//   · un email de ANTES (sin `cuerpo_html`) abre su texto con marcas como HTML (`htmlDeCuerpoTexto`, las
//     mismas reglas con que sale hoy); mientras no se toque el cuerpo, el paso sigue sin HTML y sale igual.
//   · el «De» guarda `remitente` en el paso SÓLO si no es el del workspace (el del workspace = ausente,
//     como siempre). El motor lo usa sólo si es del dominio del negocio (lib/email-remitente.ts).
//
// Lo que NO hay, a propósito:
//   · «Vista previa» (el preheader) y el ojo «Así llega» (punto 16): el correo como llega se mira en
//     «Probar», arriba del lienzo. El DATO preheader no se borra: lo guardado sigue saliendo, y
//     `paramsDeVista` (que usa «Probar») lo sigue poniendo.
//   · subir imágenes o archivos: el editor rico sólo acepta adjuntos de un bucket PRIVADO
//     (`mako-adjunto:<uuid>`), con URLs que vencen, y un correo abierto mañana mostraría la imagen rota.
//     Sin `subirAdjunto`, sus botones no se dibujan. El saneo sí deja pasar una imagen https.
//   · otros datos que los que el MOTOR resuelve en un email al lead: el «{ }» (asunto y cuerpo) es el
//     árbol de la casa (`ArbolDeDatos`) con `datosOfrecidos({ destino: 'lead', conLead: true })`, que
//     es lo que el envío pasa por `datosParaElLead` (lib/nutricion.ts). Lo que no conoce queda literal.
//
// El De: los remitentes vinculados salen de GET /api/email/dominio (hoy uno por workspace: ver la
// cabecera de lib/email-remitente.ts). «Vincular nuevo» abre EL MISMO flujo de conectar el dominio que
// la tab /email (`DominioSetup`), en un modal y cargado a demanda: un segundo flujo sería la segunda
// implementación de lo mismo. Si el remitente es el sandbox de Resend o el envío está apagado, lo dice
// un chip corto al lado del De, que es donde se mira quién manda.
//
// ⚠️ NADA DE ACÁ PUBLICA: `onChange` es un cambio local del lienzo (sólo «Publicar» publica). Lo único
//    que escribe es el flujo de «Vincular nuevo», que es el de /email y guarda en el workspace.
// ⚠️ `cuerpoHtml` lo pasa quien monta (`paso.cuerpo_html`). Si no lo pasa, el editor lleva su propia
//    copia (sembrada del texto) para no recargarse en cada tecla: funciona, pero un deshacer del lienzo
//    sólo vuelve el texto.
// ⚠️ LO QUE EL EDITOR VISUAL NO SABE DIBUJAR (un h1, sub/sup, colspan) pasa el saneo desde el modo HTML
//    y SALE, pero se simplifica la próxima vez que se escribe en el modo visual: el editor guarda lo que
//    dibuja (su esquema es su lista blanca). Escrito en docs/hallazgos-chatbot.md.
// =============================================================================

import { useEffect, useRef, useState, type ComponentProps, type CSSProperties, type MouseEvent as EventoMouse } from 'react';
import { createPortal } from 'react-dom';
import { PopoverWA, MenuWA, insertarEnCursor } from '../whatsapp/_shared/ComposerWhatsApp';
import { IconSmiley } from '../whatsapp/_shared/composer-icons';
import { EmojiPicker } from '../whatsapp/EmojiPicker';
import { EditorRicoPerezoso } from '../customer-success/curso/editor-rico-perezoso';
import { Modal } from '@/app/_ui/Modal';
import { useWs } from '@/app/_ui/Link';
import { htmlDeCuerpoTexto, type RenderEmailParams } from '@/lib/email-html';
import { textoDeHtmlEmail, aplicarVariablesHtml, sanearHtmlEmail } from '@/lib/email-html-seguro';
import { aplicarVariables } from '@/lib/template-vars';
import { datosOfrecidos } from '@/lib/variables-aviso';
import { ArbolDeDatos } from '@/app/_components/SelectorDatos';
import { remitentesVinculados, opcionesDeRemitente, remitenteDelPaso, partesDeRemitente, firmaDelPie } from '@/lib/email-remitente';
import type { DomState } from '../email/EmailApp';

export type CambioEmail = {
  asunto?: string;
  preheader?: string;
  cuerpo?: string;
  cuerpo_html?: string;
  /** El «De» del paso. `null` = el del workspace (se saca del paso). */
  remitente?: string | null;
};

export type EditorEmailGmailProps = {
  asunto: string;
  /**
   * El preheader guardado. ⚠️ YA NO SE DIBUJA (punto 16: «Vista previa… eliminalo»): se acepta para no
   * romper a quien lo pasa, y el dato sigue en el paso y sigue saliendo. Nadie lo edita desde acá.
   */
  preheader?: string;
  /** El texto plano del paso (`cuerpo`). Con él abre un email de antes, que no tiene `cuerpoHtml`. */
  cuerpo: string;
  /** El cuerpo del editor rico (`paso.cuerpo_html`). Ver la cabecera si falta. */
  cuerpoHtml?: string | null;
  /** El «De» guardado en el paso (`paso.remitente`). Ausente = el del workspace. */
  remitente?: string | null;
  /** Cambio LOCAL: nunca publica. Un cambio del cuerpo trae `cuerpo_html` y su `cuerpo` derivado. */
  onChange: (patch: CambioEmail) => void;
  /** Nombre del negocio: resuelve `{{negocio}}` y firma el pie (`paramsDeVista`, como el motor). */
  negocio?: string;
  deshabilitado?: boolean;
};

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Un botón de la barra del editor rico, con el tipo que declara el editor (sin importarlo estático). */
type BotonBarra = NonNullable<ComponentProps<typeof EditorRicoPerezoso>['botonesExtra']>[number];

/** Lo que el editor usa de GET /api/email/dominio, ya leído. `dom` es la respuesta entera, para el modal. */
type EstadoRemitente = { remitente: string; sandbox: boolean; envioHabilitado: boolean; vinculados: string[]; dom: DomState };

// El remitente se pide UNA vez por pestaña y cliente (5 min): la ruta le pregunta a Resend en vivo, y
// el editor se monta cada vez que se toca una tarjeta de email.
const CACHE_MS = 5 * 60_000;
const cacheRemitente = new Map<string, { t: number; estado: EstadoRemitente | null }>();

/** La respuesta de la ruta (o lo que devuelve el flujo de vincular) como lo que usa el editor. */
function estadoDe(d: DomState): EstadoRemitente {
  return {
    remitente: String(d.remitente ?? ''),
    sandbox: d.sandbox === true,
    envioHabilitado: d.envioHabilitado === true,
    vinculados: remitentesVinculados(d),
    dom: d,
  };
}

/** GET /api/email/dominio. `null` = no se pudo leer (sin red, sin permiso): no se inventa un remitente. */
async function leerDominio(): Promise<EstadoRemitente | null> {
  const r = await fetch('/api/email/dominio', { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  const j = (await r.json()) as ({ ok?: boolean } & DomState) | null;
  return j?.ok ? estadoDe(j) : null;
}

/**
 * El NOMBRE VISIBLE de un remitente, con la MISMA regla que el motor (`displayNameDe` en lib/resend.ts,
 * que no se puede importar acá: ese módulo lleva `server-only` por la API key). «Nombre <mail>» →
 * «Nombre»; un mail pelado no tiene nombre. Es lo que ve el lead como «De» en su bandeja (lo usa la
 * bandeja de «Probar», PanelProbar.tsx). ⚠️ YA NO FIRMA EL PIE (punto 16): eso es `firmaDelPie`.
 */
export function nombreDelRemitente(remitente: string): string {
  const m = remitente.match(/^(.*?)\s*</);
  return m ? m[1].trim().replace(/^"|"$/g, '') : '';
}

/** Qué avisa el chip del De, o nada. El sandbox primero: con él no sale aunque el envío esté prendido. */
export function avisoDelRemitente(e: Pick<EstadoRemitente, 'sandbox' | 'envioHabilitado'> | null): string | null {
  if (!e) return null;
  if (e.sandbox) return 'No sale · dominio sin verificar';
  if (!e.envioHabilitado) return 'Email apagado';
  return null;
}

/** Cómo se lee un remitente en el De y en su menú. */
function etiquetaRemitente(r: string): string {
  const p = partesDeRemitente(r);
  return p.nombre !== p.mail ? `${p.nombre} <${p.mail}>` : p.mail;
}

/**
 * Lo que la vista de cómo llega le pasa a `renderEmailHtml`, con las MISMAS reglas que el envío
 * (lib/nutricion.ts, la rama de email de `procesarEnvios`): el asunto vacío sale «(sin asunto)», el
 * preheader vacío no va, la FIRMA es el nombre del negocio (`firmaDelPie`, nunca el nombre visible del
 * remitente: así llegaba «MaKo», punto 16) y el cuerpo HTML va con las variables escapadas
 * (`aplicarVariablesHtml`). Sólo se resuelve `{{negocio}}`, con la función del motor: el nombre del lead
 * lo pone el envío para cada uno, y lo que el motor no conoce tiene que verse crudo, como va a llegar.
 * Pura y exportada para que un test la compare con el motor. La usa «Probar» (PanelProbar.tsx).
 * `remitente` ya no firma: se acepta para no romper a quien lo pasa.
 */
export function paramsDeVista(p: { asunto: string; preheader: string; cuerpo: string; cuerpoHtml?: string | null; negocio?: string; remitente?: string }): RenderEmailParams {
  const vars: Record<string, string> = p.negocio?.trim() ? { negocio: p.negocio.trim() } : {};
  const asunto = aplicarVariables(p.asunto, vars) || '(sin asunto)';
  return {
    subject: asunto,
    bodyText: aplicarVariables(p.cuerpo, vars),
    ...(p.cuerpoHtml ? { bodyHtml: aplicarVariablesHtml(p.cuerpoHtml, vars) } : {}),
    preheader: aplicarVariables(p.preheader, vars) || undefined,
    // El link de baja de verdad lleva un token por lead; acá alcanza con que el pie se vea igual.
    unsubscribeUrl: '#',
    fromName: firmaDelPie(p.negocio),
  };
}

/**
 * El HTML con un salto de renglón después de cada cierre de bloque (y de las aperturas de listas y
 * tablas), para que se pueda leer en la caja del modo HTML: el editor lo guarda en un solo renglón.
 * IDEMPOTENTE: entrar y salir del modo HTML no suma renglones (cada etiqueta queda con UNO).
 */
export function htmlLegible(html: string): string {
  return html
    .replace(/(<\/(?:p|h[1-6]|li|ul|ol|blockquote|pre|div|table|thead|tbody|tfoot|tr)>|<(?:ul|ol|table|thead|tbody|tfoot|tr)(?:\s[^>]*)?>|<hr\s*\/?>)[ \t]*\n*/gi, '$1\n')
    .trim();
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
.mk-gmail-de{flex:1;min-width:0;display:inline-flex;align-items:center;gap:4px;height:28px;margin:2px 0;padding:0 6px 0 0;border:none;border-radius:7px;background:transparent;color:var(--ink);font-family:${SANS};font-size:13px;text-align:left;cursor:pointer}
.mk-gmail-de:hover:not(:disabled){background:var(--surface-2)}
.mk-gmail-de:disabled{cursor:default}
.mk-gmail-de-txt{flex:0 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mk-gmail-cuerpo{flex:1 0 auto;display:flex;flex-direction:column;padding:2px 4px 6px}
.mk-gmail .mk-gmail-cuerpo .mk-editor-rico{border:none;border-radius:0;background:transparent}
.mk-gmail .mk-gmail-cuerpo .mk-editor-rico:focus-within{box-shadow:none}
.mk-gmail .mk-gmail-cuerpo .mk-er-barra{border-radius:0}
.mk-gmail-barra{flex:none;display:flex;align-items:center;gap:2px;padding:5px 6px;border-bottom:1px solid var(--border)}
.mk-gmail-sep{flex:none;width:9px;height:18px;background:linear-gradient(var(--border),var(--border)) center/1px 100% no-repeat}
.mk-gmail-html{flex:1 0 auto;min-height:220px;width:100%;box-sizing:border-box;border:none;outline:none;resize:none;padding:10px 12px;background:transparent;color:var(--ink);font-family:${MONO};font-size:12.5px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
`;

const rotuloFila: CSSProperties = { flex: 'none', width: 34, color: 'var(--faint)', fontSize: 12.5 };
const iconoMono: CSSProperties = { fontFamily: MONO, fontSize: 12.5, fontWeight: 600 };

function IconFlecha() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', color: 'var(--faint)' }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function IconTilde({ visible }: { visible: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ visibility: visible ? 'visible' : 'hidden' }}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IconMas() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** El editor no tiene adjuntos (ver la cabecera): ninguna referencia se dibuja. */
const sinAdjuntos = () => null;

/** El flujo de conectar el dominio de /email, cuando ya llegó (se pide UNA vez por pestaña). */
type ModuloEmail = typeof import('../email/EmailApp');
let moduloEmail: ModuloEmail | null = null;

/**
 * «VINCULAR NUEVO»: el MISMO flujo de /email (`DominioSetup`) en un modal, sin salir del lienzo. Se pide
 * a demanda: es la pantalla entera de Email y no tiene por qué viajar con /chatbot. Va con un portal al
 * `body`: el panel del editor vive adentro del lienzo, y un `fixed` adentro de una capa transformada o
 * de un `sticky` con z-index no cubre la pantalla (AGENTS.md).
 *
 * ⚠️ HOY «VINCULAR» REEMPLAZA, NO SUMA: el workspace tiene UN remitente (`resend_from`) y «Guardar
 *    remitente» de ese flujo lo pisa, así que cambia el «De» de TODOS los emails del negocio (los
 *    pasos sin remitente propio y los broadcasts de /email). Mudar ese botón al editor de un paso le
 *    cambia los supuestos de frecuencia (AGENTS.md: «Mover una acción a un lugar más accesible…»), y
 *    el rótulo «Vincular nuevo» promete sumar. Por eso, si ya hay uno, el modal lo DICE arriba
 *    (`reemplaza`). Sumar de verdad necesita guardar varios remitentes por negocio, que no existe:
 *    lo decide Martín (docs/relevo/chatbot.md).
 */
export const AVISO_REEMPLAZA = 'Reemplaza el remitente de tu negocio.';

/**
 * El modal de «Vincular nuevo» del email: el flujo de /email (`DominioSetup`), cargado a demanda y en un
 * portal. Lo usan el «De» de este editor y el «De» de «Probar» (`VincularEmisor`, app/chatbot/PanelProbar.tsx):
 * UN modal, para que los dos digan lo mismo (el aviso de que reemplaza incluido).
 */
export function VincularRemitente({ inicial, reemplaza, onCerrar, onDominio }: { inicial: DomState | null; reemplaza: boolean; onCerrar: () => void; onDominio: (d: DomState) => void }) {
  const [m, setM] = useState<ModuloEmail | null>(moduloEmail);
  const [dom, setDom] = useState<DomState | null>(inicial);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (m) return;
    let vivo = true;
    import('../email/EmailApp').then((x) => { moduloEmail = x; if (vivo) setM(x); }).catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [m]);
  useEffect(() => {
    if (dom) return;
    let vivo = true;
    leerDominio().then((e) => { if (!vivo) return; if (e) setDom(e.dom); else setError(true); }).catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [dom]);
  const Setup = m?.DominioSetup;
  return createPortal(
    <Modal titulo="Vincular remitente" onCerrar={onCerrar} ancho={680}>
      {reemplaza && (
        <div role="note" style={{ marginBottom: 12, fontSize: 13, color: 'var(--ink)' }}>{AVISO_REEMPLAZA}</div>
      )}
      {error ? (
        <div role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>No se pudo abrir.</div>
      ) : Setup && dom ? (
        <Setup dom={dom} onUpdate={(d) => { setDom(d); onDominio(d); }} />
      ) : (
        <div role="status" style={{ fontSize: 13, color: 'var(--faint)' }}>Cargando…</div>
      )}
    </Modal>,
    document.body,
  );
}

type Abierto = 'datos-asunto' | 'datos-cuerpo' | 'emoji' | 'de' | null;

export function EditorEmailGmail({ asunto, cuerpo, cuerpoHtml, remitente, onChange, negocio, deshabilitado }: EditorEmailGmailProps) {
  const ws = useWs();
  const clave = String(ws ?? '');
  const [estado, setEstado] = useState<EstadoRemitente | null | undefined>(() => {
    const c = cacheRemitente.get(clave);
    return c && Date.now() - c.t < CACHE_MS ? c.estado : undefined;
  });
  const [abierto, setAbierto] = useState<Abierto>(null);
  /** El botón del que cuelga el panel abierto (los de la barra del editor rico no tienen ref: llegan acá). */
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const [btnDatosAsunto, setBtnDatosAsunto] = useState<HTMLButtonElement | null>(null);
  const [btnDe, setBtnDe] = useState<HTMLButtonElement | null>(null);
  const [vincular, setVincular] = useState(false);
  /** El modo HTML (punto 16). `crudo` es lo que se escribe en la caja; al paso llega saneado. */
  const [modo, setModo] = useState<'visual' | 'html'>('visual');
  const [crudo, setCrudo] = useState('');
  /** Lo que tiene el editor rico mientras se edita el HTML: no se le recarga el documento en cada tecla. */
  const [congelado, setCongelado] = useState('');
  const campoAsunto = useRef<HTMLInputElement>(null);
  const campoHtml = useRef<HTMLTextAreaElement>(null);
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

  // El modo HTML: lo escrito pasa por la MISMA lista blanca antes de llegar al paso (decisión 16). La
  // caja se queda con lo que se escribió: sanear a mitad de una etiqueta la borraría bajo el cursor.
  const alCambiarCrudo = (raw: string) => {
    setCrudo(raw);
    alCambiarCuerpo(sanearHtmlEmail(raw));
  };
  const entrarHtml = () => { setCongelado(valorHtml); setCrudo(htmlLegible(valorHtml)); setAbierto(null); setModo('html'); };
  const salirHtml = () => { setAbierto(null); setModo('visual'); };

  useEffect(() => {
    const c = cacheRemitente.get(clave);
    if (c && Date.now() - c.t < CACHE_MS) return;
    let vivo = true;
    leerDominio()
      .then((e) => {
        cacheRemitente.set(clave, { t: Date.now(), estado: e });
        if (vivo) setEstado(e);
      })
      // Sin red o sin permiso: el De queda sin nombre. No se inventa un remitente.
      .catch(() => { if (vivo) setEstado(null); });
    return () => { vivo = false; };
  }, [clave]);

  const vinculados = estado?.vinculados ?? [];
  // El que queda elegido lo decide la MISMA función que usa el motor: si el paso guardó uno que ya no
  // es del dominio del negocio, la pantalla muestra el del workspace, que es con el que va a salir.
  const elegido = remitenteDelPaso(remitente, estado?.remitente) ?? vinculados[0] ?? null;
  const opciones = opcionesDeRemitente(vinculados, remitente, estado?.remitente);
  const aviso = avisoDelRemitente(estado ?? null);

  /** El del workspace es la AUSENCIA del campo: así sigue al del negocio si cambia en /email. */
  const elegirRemitente = (r: string) => {
    if (r === elegido) return;
    onChange({ remitente: r === vinculados[0] ? null : r });
  };

  /**
   * Lo que devuelve el flujo de vincular (cada paso: el dominio, la verificación, el remitente). Se
   * guarda en la caché del editor y, si apareció UN remitente nuevo, este paso pasa a usarlo: se
   * vinculó desde acá. Si el nuevo es el del workspace (hoy «Guardar remitente» lo reemplaza), el paso
   * vuelve a la ausencia del campo.
   */
  const alVincular = (d: DomState) => {
    const nuevo = estadoDe(d);
    cacheRemitente.set(clave, { t: Date.now(), estado: nuevo });
    const recien = nuevo.vinculados.filter((r) => !vinculados.includes(r));
    setEstado(nuevo);
    if (recien.length === 1) onChange({ remitente: recien[0] === nuevo.vinculados[0] ? null : recien[0] });
  };

  // El «{ }» de un email al LEAD: lo que el envío resuelve (`datosParaElLead`, lib/nutricion.ts).
  const datos = datosOfrecidos({ destino: 'lead', conLead: true });

  const insertarEnAsunto = (texto: string) => {
    const el = campoAsunto.current;
    const r = insertarEnCursor(asunto, el?.selectionStart, el?.selectionEnd, texto);
    onChange({ asunto: r.valor });
    // El cursor vuelve después del dato, cuando React ya escribió el valor nuevo.
    requestAnimationFrame(() => { try { el?.focus(); el?.setSelectionRange(r.cursor, r.cursor); } catch { /* el campo ya no está */ } });
  };

  /** Un dato o un emoji en el cuerpo: en el editor rico, o donde está el cursor de la caja HTML. */
  const insertarEnCuerpo = (texto: string) => {
    if (modo === 'visual') { insertarEnEditorRico(cajaCuerpo.current, texto); return; }
    const el = campoHtml.current;
    const r = insertarEnCursor(crudo, el?.selectionStart, el?.selectionEnd, texto);
    alCambiarCrudo(r.valor);
    requestAnimationFrame(() => { try { el?.focus(); el?.setSelectionRange(r.cursor, r.cursor); } catch { /* la caja ya no está */ } });
  };

  const abrirEn = (tipo: Exclude<Abierto, null>, el: HTMLElement | null) => {
    setAncla(el);
    setAbierto((a) => (a === tipo ? null : tipo));
  };

  // «{ }», el emoji y «</>» en la barra de formato del editor rico, donde están las negritas (punto 16).
  const botonesBarra: BotonBarra[] = [
    { id: 'dato', nombre: 'Insertar un dato', icono: <span style={iconoMono}>{'{ }'}</span>, accion: (el) => abrirEn('datos-cuerpo', el) },
    { id: 'emoji', nombre: 'Emojis', icono: <IconSmiley />, accion: (el) => abrirEn('emoji', el) },
    { id: 'html', nombre: 'Editar el HTML', icono: <span style={iconoMono}>{'</>'}</span>, activo: false, accion: () => entrarHtml() },
  ];

  // Los botones NO se llevan el foco: con el foco en el cuerpo, el dato entra donde está el cursor sin
  // tener que volver a ubicarlo.
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
            <button type="button" ref={setBtnDe} className="mk-gmail-de" disabled={deshabilitado || estado === undefined}
              aria-label="Elegir el remitente" aria-haspopup="menu" aria-expanded={abierto === 'de'} title={elegido ?? undefined}
              onClick={(e) => abrirEn('de', e.currentTarget)}>
              <span className="mk-gmail-de-txt" style={elegido ? undefined : { color: 'var(--faint)' }}>
                {estado === undefined ? '…' : elegido ? etiquetaRemitente(elegido) : '—'}
              </span>
              <IconFlecha />
            </button>
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
            <button type="button" ref={setBtnDatosAsunto} className="mk-gmail-boton" onMouseDown={sinRobarFoco} disabled={deshabilitado}
              title="Insertar un dato" aria-label="Insertar un dato en el asunto" aria-expanded={abierto === 'datos-asunto'}
              onClick={() => abrirEn('datos-asunto', btnDatosAsunto)} style={{ fontFamily: MONO }}>{'{ }'}</button>
          </div>
          {/* El editor rico se ESCONDE en el modo HTML, no se desmonta: así no pierde su deshacer. */}
          <div ref={cajaCuerpo} className="mk-gmail-cuerpo" style={modo === 'html' ? { display: 'none' } : undefined}>
            <EditorRicoPerezoso valor={modo === 'html' ? congelado : valorHtml} onCambio={alCambiarCuerpo} urlDeAdjunto={sinAdjuntos}
              placeholder="Escribe el email" etiqueta="Cuerpo del email" minAlto={120} soloLectura={deshabilitado} botonesExtra={botonesBarra} />
          </div>
          {modo === 'html' && (
            <div className="mk-gmail-cuerpo">
              <div className="mk-gmail-barra" role="toolbar" aria-label="Formato">
                <button type="button" className="mk-gmail-boton" onMouseDown={sinRobarFoco} disabled={deshabilitado}
                  title="Insertar un dato" aria-label="Insertar un dato" aria-expanded={abierto === 'datos-cuerpo'}
                  onClick={(e) => abrirEn('datos-cuerpo', e.currentTarget)} style={iconoMono}>{'{ }'}</button>
                <button type="button" className="mk-gmail-boton" onMouseDown={sinRobarFoco} disabled={deshabilitado}
                  title="Emojis" aria-label="Emojis" aria-expanded={abierto === 'emoji'}
                  onClick={(e) => abrirEn('emoji', e.currentTarget)}><IconSmiley /></button>
                <span className="mk-gmail-sep" aria-hidden="true" />
                <button type="button" className="mk-gmail-boton" onMouseDown={sinRobarFoco} aria-pressed="true"
                  title="Volver al editor" aria-label="Volver al editor" onClick={salirHtml} style={iconoMono}>{'</>'}</button>
              </div>
              <textarea ref={campoHtml} className="mk-gmail-html" value={crudo} readOnly={deshabilitado} spellCheck={false}
                aria-label="HTML del email" onChange={(e) => alCambiarCrudo(e.target.value)} />
            </div>
          )}
        </div>
      </section>

      {abierto === 'de' && (
        <PopoverWA ancla={btnDe ?? ancla} etiqueta="Remitente" onCerrar={() => setAbierto(null)}>
          <MenuWA alElegir={() => setAbierto(null)} opciones={[
            ...opciones.map((r) => ({ key: r, label: etiquetaRemitente(r), icono: <IconTilde visible={r === elegido} />, onElegir: () => elegirRemitente(r) })),
            { key: '__vincular', label: 'Vincular nuevo', icono: <IconMas />, onElegir: () => setVincular(true) },
          ]} />
        </PopoverWA>
      )}
      {/* El «{ }»: el árbol de la casa (app/_components/SelectorDatos.tsx), igual que en WhatsApp. */}
      {abierto === 'datos-asunto' && (
        <PopoverWA ancla={btnDatosAsunto} etiqueta="Datos" onCerrar={() => setAbierto(null)}>
          <ArbolDeDatos grupos={datos} onElegir={(k) => { insertarEnAsunto(`{{${k}}}`); setAbierto(null); }} />
        </PopoverWA>
      )}
      {abierto === 'datos-cuerpo' && (
        <PopoverWA ancla={ancla} etiqueta="Datos" onCerrar={() => setAbierto(null)}>
          <ArbolDeDatos grupos={datos} onElegir={(k) => { insertarEnCuerpo(`{{${k}}}`); setAbierto(null); }} />
        </PopoverWA>
      )}
      {abierto === 'emoji' && (
        <PopoverWA ancla={ancla} etiqueta="Emojis" onCerrar={() => setAbierto(null)}>
          <EmojiPicker onPick={(em) => { insertarEnCuerpo(em); }} onClose={() => setAbierto(null)} />
        </PopoverWA>
      )}
      {vincular && (
        <VincularRemitente inicial={estado?.dom ?? null} reemplaza={vinculados.length > 0} onCerrar={() => setVincular(false)} onDominio={alVincular} />
      )}
    </div>
  );
}
