'use client';

// =============================================================================
// InfoPrincipalCard — información principal del lead (contacto accionable)
// =============================================================================
// Teléfono y email: click en el dato (o en el ícono de copiar) lo copia al
// portapapeles; al lado, el ícono de WhatsApp le escribe por la línea NO oficial y el de
// Gmail abre un correo a ese lead.
//
// ⚠️ UN SOLO BOTÓN DE WHATSAPP (06/10/2026). Había dos: el link al chat del WhatsApp
// OFICIAL (/whatsapp?lead=) y el envío por la línea no oficial. Martín: «Si eliminamos el
// WhatsApp OFICIAL, solo debe quedar 1 botón de WhatsApp». Queda el no oficial, que es el
// canal del producto (ver «El WhatsApp del chatbot es el NO OFICIAL» en AGENTS.md).
//
// ⚠️ Y SIN FOTO PROPIA. Acá vivía `LeadFoto` (la foto de WhatsApp en un círculo), y con la
// foto en la cabecera de la ficha quedaban DOS caras del mismo lead en la misma pantalla.
// La cara vive en la cabecera (app/_components/foto-contacto.ts); esta tarjeta son datos.
//
// La montan la ficha del CRM (pop-up y ruta) y la ficha de un cliente de Customer Success.

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRefrescarFicha } from './ficha-cambio';
import { EditableInline } from '@/app/_components/EditableInline';
import { Toast, useToast } from '@/app/_ui/Toast';
import { saveLeadMetaAction } from '../actions';
import { hrefDeWeb } from '@/lib/contacto-lead';
import { linkInstagram, usuarioInstagram } from '../campo-inline';
import { CajaCampo, InstagramEditable, MontoEditable, TelefonoEditable } from './CampoEditable';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

function IconCopy() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>;
}
function IconWhatsApp() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.4Z" /></svg>;
}
function IconExterno() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6" /><path d="M10 14 20 4" /><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" /></svg>;
}

function IconMail() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>;
}

// #8: enviar un WhatsApp por el número NO oficial (Evolution) a este lead, con
// confirmación + advertencia de baneo. Manual = directo (la regla anti-ban del
// motor es solo para lo automático); sale con demora "humana".
function EnviarNoOficial({ leadId, nombre, telefono }: { leadId: number; nombre: string; telefono: string }) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; x: string } | null>(null);

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    setSending(true); setMsg(null);
    try {
      const r = await fetch('/api/whatsapp/evolution/mensajes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefono, texto: t, leadId }) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (j.ok) { setMsg({ t: 'ok', x: 'Enviado por el número no oficial.' }); setTexto(''); }
      else setMsg({ t: 'err', x: j.error || 'No se pudo enviar.' });
    } catch (e) { setMsg({ t: 'err', x: e instanceof Error ? e.message : String(e) }); }
    finally { setSending(false); }
  }

  const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--wa, #1c8a54)', cursor: 'pointer', flex: 'none' };
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setMsg(null); }} aria-label="Enviar WhatsApp no oficial" title="Enviar por WhatsApp no oficial (Evolution)" style={btn}><IconWhatsApp /></button>
      {open && (
        // `data-no-abre`: este pop-up vive ADENTRO de la tarjeta del teléfono (`CajaCampo`), y sin la
        // marca un clic en su fondo o en su texto abriría además la edición del número.
        <div data-no-abre onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 22, fontFamily: SANS }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>WhatsApp no oficial</div>
              <button onClick={() => setOpen(false)} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12 }}>Para <b style={{ color: 'var(--ink)' }}>{nombre}</b> · {telefono}</div>
            <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 12.5, lineHeight: 1.45, marginBottom: 12 }}>
              El número no oficial (por QR) tiene riesgo de baneo. Úsalo con criterio, nunca en masa. Sale como si lo escribieras tú, con demora anti-ban.
            </div>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Escribe el mensaje…" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, lineHeight: 1.5, outline: 'none', resize: 'vertical' }} />
            {msg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: msg.t === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{msg.x}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button onClick={() => setOpen(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cerrar</button>
              <button onClick={() => void enviar()} disabled={sending || !texto.trim()} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--wa, #1c8a54)', color: '#fff', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: sending || !texto.trim() ? 0.5 : 1 }}>{sending ? 'Enviando…' : 'Enviar por no oficial'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** El recuadro de cada dato: el mismo en las celdas que copian y en las que no. */
const celda: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px' };

function Row({ label, value, copyKey, copied, onCopy, extra, onGuardar, editor, copiable = true }: {
  label: string; value: string | null; copyKey: string; copied: string;
  onCopy: (text: string, key: string) => void; extra?: ReactNode;
  /** Presente = el valor se corrige acá mismo. Ausente = solo se copia. */
  onGuardar?: (v: string) => void;
  /** Un editor propio en lugar del texto libre (el teléfono con su país, el monto, Instagram). */
  editor?: ReactNode;
  /** El botón de copiar. Sin él para lo que no se pega en otro lado (el ingreso estimado). */
  copiable?: boolean;
}) {
  const has = !!value?.trim();
  const iconBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', flex: 'none' };
  // ⚠️ LA TARJETA ENTERA ABRE LA EDICIÓN (punto 7 del 12/10/2026): `CajaCampo` lleva un clic en
  // cualquier parte que no sea un botón (copiar, WhatsApp, Gmail, el link) al campo de adentro, y
  // la caja de edición ocupa el ancho. Antes había que acertarle al «—».
  // ⚠️ El envoltorio se elige en el `return` y NO con un componente definido acá adentro: uno
  // definido en el cuerpo es un TIPO nuevo en cada render y React remontaría el campo —se pierde el
  // foco a mitad de escribir— cada vez que cambia el «Copiado ✓».
  const editable = !!(onGuardar || editor);
  const contenido = (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{label}</div>
        {/* ⚠️ CON `onGuardar` EL VALOR SE EDITA ACÁ; el COPIAR no se pierde, sigue en
            el botón de la derecha. Antes el texto ERA el botón de copiar, así que el
            único camino a corregirlo era irse de la ficha. */}
        {editor ? (
          <div style={{ marginTop: 2, fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{editor}</div>
        ) : onGuardar ? (
          <div style={{ marginTop: 2, fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>
            <EditableInline valor={value ?? ''} onGuardar={onGuardar} placeholder="—" titulo={`Edita ${label.toLowerCase()}`} maxLargo={120} />
          </div>
        ) : has ? (
          <button
            type="button"
            onClick={() => onCopy(value!, copyKey)}
            title="Copiar"
            style={{ display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'transparent', border: 'none', padding: 0, marginTop: 2, fontSize: 14.5, fontWeight: 600, color: copied === copyKey ? 'var(--good)' : 'var(--ink)', cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
          >
            {copied === copyKey ? 'Copiado ✓' : value}
          </button>
        ) : (
          <div style={{ fontSize: 14.5, color: 'var(--faint)', marginTop: 2 }}>—</div>
        )}
      </div>
      {has && copiable && (
        <button type="button" onClick={() => onCopy(value!, copyKey)} aria-label={`Copiar ${label.toLowerCase()}`} title="Copiar" style={iconBtn}>
          <IconCopy />
        </button>
      )}
      {has && extra}
    </>
  );
  return editable ? <CajaCampo style={celda}>{contenido}</CajaCampo> : <div style={celda}>{contenido}</div>;
}

export function InfoPrincipalCard({ leadId, nombre, empresa, email, telefono, web = null, cohorte, ingresoEstimado, instagram }: {
  leadId: number; nombre: string; empresa: string | null; email: string | null; telefono: string | null;
  /** La web del lead (`leads.web`, mig 0194). Reemplazó a «Dirección»: «Saca en el resumen
   *  el dato de "Dirección" eso no importa. En su lugar, pon "Web"» (Martín, 06/10/2026). */
  web?: string | null;
  /** Cohorte de madurez del lead — solo tiene sentido si hubo R1. */
  cohorte?: { label: string; color: string; texto: string | null } | null;
  /**
   * El ingreso ESTIMADO en USD (`leads.ingreso_estimado`, mig 0258). Martín (12/10/2026, punto 21):
   * «en "Información principal" pon una opción de "Ingreso Estimado"». `undefined` = esta ficha no
   * lo ofrece (la de Customer Success: un cliente ya compró); `null` = nadie lo cargó.
   */
  ingresoEstimado?: number | null;
  /** El usuario de Instagram (`leads.instagram`, mig 0258; punto 28). `undefined` = no se ofrece. */
  instagram?: string | null;
}) {
  const [copied, setCopied] = useState('');
  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1200); }).catch(() => {});
  };

  const refrescarFicha = useRefrescarFicha();
  const { toast, show, clear } = useToast();
  const [, startGuardar] = useTransition();

  /**
   * Corregir un dato del lead SIN salir de la ficha.
   *
   * ⚠️ ERA LA DECISIÓN 3 DEL PLAN DE FRICCIÓN, y la pregunta («¿la previsualización
   * antes, en un modal, o el deshacer después?») ya la contestó el repo en todo lo
   * demás: `app/_ui/Toast.tsx` lo dice textual — «es más barato y más honesto que
   * preguntar ¿estás seguro? antes de cada cosa». Así que va el deshacer.
   *
   * El camino de antes eran 5 clics y 2 recargas: el teléfono era un BOTÓN DE COPIAR,
   * y para cambiarlo había que ir a /crm/<id>, prender «Editar», guardar y confirmar
   * en un modal — perdiendo el scroll y el filtro del tablero.
   *
   * No hizo falta ni una pantalla nueva: `EditableInline` ya existía (y ya resolvía el
   * Escape dentro de un modal con `stopImmediatePropagation`), `saveLeadMetaAction`
   * también — con CERO call sites, escrita y nunca enchufada— y el historial ya
   * registra estos campos y los sabe revertir.
   */
  const guardar = (campo: 'nombre' | 'empresa' | 'email' | 'telefono' | 'web', antes: string | null) => (v: string) => {
    const nuevo = v.trim();
    startGuardar(async () => {
      try {
        await saveLeadMetaAction(leadId, { [campo]: nuevo || null });
        refrescarFicha();
        // Tres palabras y el deshacer, que escribe en el SERVER: revertir sólo la
        // pantalla sería mentir hasta el próximo F5.
        show('Guardado', () => {
          startGuardar(async () => {
            try { await saveLeadMetaAction(leadId, { [campo]: antes }); refrescarFicha(); }
            catch { show('No se pudo deshacer', undefined, 'bad'); }
          });
        });
      } catch (e) {
        show(e instanceof Error ? e.message : 'No se pudo guardar', undefined, 'bad');
      }
    });
  };
  const iconLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--primary)', flex: 'none', textDecoration: 'none' };
  const ig = usuarioInstagram(instagram);
  const usuarioIg = linkInstagram(ig);
  const debajo: ReactNode[] = [
    <Row
      key="web"
      label="Web"
      onGuardar={guardar('web', web)} value={web} copyKey="web" copied={copied} onCopy={copy}
      extra={hrefDeWeb(web)
        ? <a href={hrefDeWeb(web)!} target="_blank" rel="noopener noreferrer" aria-label="Abrir la web" title="Abrir la web" style={iconLink}><IconExterno /></a>
        : null}
    />,
    // Instagram (punto 28): se lee con la @ y se abre el perfil al lado. Se guarda sin la @ y en
    // minúsculas (`usuarioInstagram`, la misma regla del alta y del server).
    ...(instagram !== undefined ? [
      <Row
        key="instagram"
        label="Instagram"
        value={ig ? `@${ig}` : null} copyKey="ig" copied={copied} onCopy={copy}
        editor={<InstagramEditable leadId={leadId} valor={instagram} />}
        extra={usuarioIg
          ? <a href={usuarioIg} target="_blank" rel="noopener noreferrer" aria-label="Abrir el perfil de Instagram" title="Abrir el perfil de Instagram" style={iconLink}><IconExterno /></a>
          : null}
      />,
    ] : []),
    // El ingreso ESTIMADO (punto 21): en USD, corregible en el lugar. No se copia: no es un dato que
    // se pegue en otro lado. El total por columna lo suma el tablero con la marca de estimado.
    ...(ingresoEstimado !== undefined ? [
      <Row
        key="ingreso"
        label="Ingreso estimado (USD)"
        value={ingresoEstimado != null ? String(ingresoEstimado) : null} copyKey="ingreso" copied={copied} onCopy={copy} copiable={false}
        editor={<MontoEditable leadId={leadId} campo="ingreso_estimado" valor={ingresoEstimado} titulo="Ingreso estimado del lead, en dólares" />}
      />,
    ] : []),
    ...(cohorte ? [
      <div key="cohorte" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px' }}>
        <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>Cohorte</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: cohorte.color }}>{cohorte.label}</span>
          {cohorte.texto && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{cohorte.texto}</span>}
        </div>
      </div>,
    ] : []),
  ];
  return (
    <>
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Información principal</div>
      {/* 2×2 fijo (nombre|empresa / teléfono|email) — nunca 3 arriba y 1 abajo. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 24px' }}>
        <Row label="Nombre" value={nombre} copyKey="nombre" copied={copied} onCopy={copy} onGuardar={guardar('nombre', nombre)} />
        <Row label="Empresa" value={empresa} copyKey="empresa" copied={copied} onCopy={copy} onGuardar={guardar('empresa', empresa)} />
        {/* ⚠️ EL TELÉFONO SE EDITA CON EL PAÍS PRIMERO (punto 5 del 12/10/2026): «siempre en todos
            lados que pida telefono, primero tiene que ir la numeración que ya tenemos con las
            banderas». `TelefonoEditable` no reescribe el formato guardado si los dígitos no
            cambiaron; el guardado sigue siendo el de siempre (`saveLeadMetaAction`, con su
            deshacer y su línea en el historial). */}
        <Row
          label="Teléfono"
          value={telefono && telefono !== '—' ? telefono : null} copyKey="tel" copied={copied} onCopy={copy}
          editor={<TelefonoEditable valor={telefono && telefono !== '—' ? telefono : null} onGuardar={guardar('telefono', telefono)} />}
          extra={telefono && telefono !== '—' ? <EnviarNoOficial leadId={leadId} nombre={nombre} telefono={telefono} /> : null}
        />
        <Row
          label="Email"
          onGuardar={guardar('email', email)} value={email} copyKey="email" copied={copied} onCopy={copy}
          extra={<a href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email ?? '')}`} target="_blank" rel="noopener noreferrer" aria-label="Escribir por Gmail" title="Escribir por Gmail" style={iconLink}><IconMail /></a>}
        />
        {/* Lo que sigue al 2×2 va de a DOS por fila, y si queda uno solo ocupa la fila entera
            (como la Web cuando no hay cohorte). En la ficha del CRM son cuatro: Web | Instagram,
            Ingreso estimado | Cohorte. En la de Customer Success, Web y Cohorte, como siempre. */}
        {debajo.map((celdaDebajo, i) => (
          <div key={i} style={{ minWidth: 0, display: 'grid', gridColumn: i === debajo.length - 1 && debajo.length % 2 === 1 ? '1 / -1' : undefined }}>
            {celdaDebajo}
          </div>
        ))}
      </div>
    </section>
    <Toast state={toast} onClose={clear} />
    </>
  );
}
