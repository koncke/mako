'use client';

// =============================================================================
// ModalNuevoCliente — abrirle su cuenta de MaKo a un cliente de la agencia, eligiendo quién la paga (25/10/2026)
// =============================================================================
// El «+ Nuevo cliente» de Agency Dashboard y el «Abrirle su cuenta de MaKo» del CRM: UNA pieza para las dos puertas.
// Era app/partners/LlevarAPartners.tsx (17/10/2026); se mudó con la cartera y sumó lo que pidió Martín el 25/10
// (docs/feedback-25-10-tarde.md punto 9): «puedes elegir si el cobro se realiza ahí mismo con tu tarjeta, o si quieres
// que lo pague tu cliente, y en dicho caso, al finalizar el onboarding de ese cliente debe saltar el cartel de pago».
//
// Dos pasos en la misma caja:
//   1. su nombre, su email (obligatorio: es por donde le llega el acceso) y quién paga;
//   2. si pagas tú: el link del primer mes, para pagarlo ahí mismo (#866). Si paga tu cliente: que le llegó su acceso y
//      que al terminar su onboarding le aparece el pago. Sin link (MaKo todavía no cobra), queda esperando que la
//      habilite MaKo, y se dice.
// Si el lead YA tiene cuenta, no se pregunta nada: se dice y se ofrece verla.
//
// ⚠️ POR PORTAL AL BODY: el CRM la abre desde una tarjeta o un menú, y un `<Modal>` adentro de un contexto de
//    apilamiento queda atrapado debajo de la tarjeta siguiente (el caso de CuentaDeMaKo del 05/10/2026).

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { emailUtilizable } from '@/lib/agencia-altas';
import { avisoInvitacion } from '@/lib/invitacion-aviso';
import type { QuienPaga } from '@/lib/agency-reglas';
import { abrirCuentaClienteAction, leadParaAgencyAction } from './actions';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { TOPES } from '@/lib/topes-plan';

type Hecho = { clienteWs: number; link: string | null; sinLink: string | null; paga: QuienPaga; aviso: { tono: 'ok' | 'warn'; texto: string } | null };

export function ModalNuevoCliente({ leadId = null, nombre: nombreInicial = '', email: emailInicial = null, pagaSugerida = 'agencia', usd = null, onCerrar, onListo }: {
  /** El lead del CRM. Sin él, un cliente nuevo (nombre y email a mano). */
  leadId?: number | null;
  nombre?: string;
  email?: string | null;
  /** La opción que se propone primero (lo que la agencia contó al sumarse). */
  pagaSugerida?: QuienPaga;
  /** Lo que vale el mes de cada cuenta, para decirlo en las opciones. */
  usd?: number | null;
  onCerrar: () => void;
  /** Se abrió la cuenta (para refrescar la pantalla de quien la montó). */
  onListo?: (clienteWs: number) => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [email, setEmail] = useState(emailInicial ?? '');
  const [paga, setPaga] = useState<QuienPaga>(pagaSugerida);
  // Su plan (29/10/2026, Thiago: «son los mismos planes, de 47 y 97»): Esencial o Pro, con los topes de cada uno.
  const [plan, setPlan] = useState<'esencial' | 'pro'>('esencial');
  const [ya, setYa] = useState<number | null>(null);
  const [mal, setMal] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [hecho, setHecho] = useState<Hecho | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Desde el CRM: el email que tiene el lead (se pregunta igual: el del CRM puede ser el del contacto comercial) y si ya
  // tiene cuenta. Sin red no se traba nada: queda el formulario con lo que vino.
  useEffect(() => {
    if (leadId == null) return;
    let vivo = true;
    void leadParaAgencyAction(leadId).then((r) => {
      if (!vivo || !r.ok) return;
      if (r.clienteWs) setYa(r.clienteWs);
      setNombre((n) => n || r.nombre);
      setEmail((e) => e || r.email || '');
    }).catch(() => {});
    return () => { vivo = false; };
  }, [leadId]);

  const listo = emailUtilizable(email) && (leadId != null || nombre.trim().length > 0);
  const abrir = async () => {
    if (!listo || ocupado) return;
    setOcupado(true);
    setMal('');
    const r = await abrirCuentaClienteAction({ leadId, nombre, email, paga, plan }).catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    setOcupado(false);
    if (!r.ok) {
      if ('yaTiene' in r && r.yaTiene) setYa(r.yaTiene);
      else setMal(r.error);
      return;
    }
    const aviso = r.paga === 'cliente' && r.acceso ? avisoInvitacion(r.acceso, email.trim()) : null;
    setHecho({ clienteWs: r.clienteWs, link: r.link, sinLink: r.sinLink, paga: r.paga, aviso });
    onListo?.(r.clienteWs);
  };
  const copiar = () => {
    if (!hecho?.link) return;
    void navigator.clipboard?.writeText(hecho.link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); }).catch(() => {});
  };

  if (typeof document === 'undefined') return null;
  const quien = nombre.trim() || 'este cliente';
  const mes = plan === 'pro' ? 'US$ 97 al mes' : usd ? `US$ ${usd.toLocaleString('es-AR')} al mes` : 'su mes';

  let titulo = leadId != null ? `Abrirle su cuenta a ${quien}` : 'Nuevo cliente';
  let cuerpo: ReactNode;
  let pie: ReactNode;
  if (ya != null) {
    titulo = 'Ya tiene su cuenta';
    cuerpo = <p className="nc-ayuda">{quien} ya tiene su cuenta de MaKo en tu Agency Dashboard.</p>;
    pie = (
      <>
        <button type="button" className="nc-no" onClick={onCerrar}>Cerrar</button>
        <Link className="nc-si" href={`/agency?cuenta=${ya}`}>Ver su cuenta</Link>
      </>
    );
  } else if (hecho && hecho.paga === 'cliente' && hecho.link) {
    // Sin link del primer mes, su acceso NO sale (lib/partners.ts, 25/10/2026): cae en «Cuenta pedida», como si pagara la
    // agencia. Decirle «Su acceso no salió: reenvíaselo» era empujar a la agencia a mandarle MaKo gratis.
    titulo = 'Cuenta abierta';
    cuerpo = (
      <>
        <p className="nc-ayuda nc-ayuda--fuerte">{hecho.aviso?.tono === 'ok' ? `Le llegó su acceso a ${email.trim()}.` : hecho.aviso?.texto ?? 'Su acceso no salió: reenvíaselo desde su cuenta.'}</p>
        <p className="nc-ayuda">Cuando termine su configuración, le aparece el pago de {mes}. Al pagarlo, puedes entrar a su cuenta.</p>
      </>
    );
    pie = (
      <>
        <button type="button" className="nc-no" onClick={onCerrar}>Cerrar</button>
        <Link className="nc-si" href={`/agency?cuenta=${hecho.clienteWs}`}>Ver su cuenta</Link>
      </>
    );
  } else if (hecho) {
    titulo = hecho.link ? 'Paga su primer mes' : 'Cuenta pedida';
    cuerpo = hecho.link ? (
      <>
        <input className="nc-in" readOnly value={hecho.link} aria-label="Link de pago" onFocus={(e) => e.currentTarget.select()} />
        <p className="nc-ayuda">Al pagarlo, la cuenta queda habilitada y le llega su acceso. Su mes corre desde que termine su configuración.</p>
      </>
    ) : (
      <p className="nc-ayuda">Le llega su acceso cuando MaKo la habilite.</p>
    );
    pie = hecho.link ? (
      <>
        <button type="button" className="nc-no" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar el link'}</button>
        <a className="nc-si" href={hecho.link} target="_blank" rel="noopener noreferrer">Pagar con mi tarjeta</a>
      </>
    ) : (
      <>
        <button type="button" className="nc-no" onClick={onCerrar}>Cerrar</button>
        <Link className="nc-si" href={`/agency?cuenta=${hecho.clienteWs}`}>Ver su cuenta</Link>
      </>
    );
  } else {
    // «Mi cliente» dice los DOS caminos (25/10/2026): mientras MaKo no tenga Mercado Pago conectado o le falte el precio
    // en pesos, toda alta así termina en «Cuenta pedida», sin acceso. Prometía «Le llega su acceso ya».
    cuerpo = (
      <>
        {leadId == null && (
          <>
            <label className="nc-lab" htmlFor="nc-nombre">Nombre de su negocio</label>
            <input id="nc-nombre" className="nc-in" value={nombre} data-autofocus placeholder="Inmobiliaria del Sur"
              onChange={(e) => setNombre(e.target.value)} />
          </>
        )}
        <label className="nc-lab" htmlFor="nc-correo">Email de quien la va a usar</label>
        <input id="nc-correo" className="nc-in" type="email" value={email} placeholder="persona@empresa.com"
          data-autofocus={leadId != null ? true : undefined}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void abrir(); }} />
        <fieldset className="nc-paga">
          <legend className="nc-lab">Su plan</legend>
          <label className="nc-op" data-on={plan === 'esencial'}>
            <input type="radio" name="nc-plan" checked={plan === 'esencial'} onChange={() => setPlan('esencial')} />
            <span><b>MaKo Esencial</b><small>{`US$ 47 al mes. ${TOPES.completo['crm.funnels']} funnel, ${TOPES.completo['chats.lineas_whatsapp']} WhatsApp, ${TOPES.completo['automations.activas']} automatizaciones y ${TOPES.completo['web.landings_publicadas']} ${TOPES.completo['web.landings_publicadas'] === 1 ? 'landing' : 'landings'}.`}</small></span>
          </label>
          <label className="nc-op" data-on={plan === 'pro'}>
            <input type="radio" name="nc-plan" checked={plan === 'pro'} onChange={() => setPlan('pro')} />
            <span><b>MaKo Pro</b><small>US$ 97 al mes. Sin esos topes, con anuncios y equipo.</small></span>
          </label>
        </fieldset>
        <fieldset className="nc-paga">
          <legend className="nc-lab">¿Quién paga su cuenta?</legend>
          <label className="nc-op" data-on={paga === 'agencia'}>
            <input type="radio" name="nc-paga" checked={paga === 'agencia'} onChange={() => setPaga('agencia')} />
            <span><b>Yo, ahora</b><small>Pagas {mes} con tu tarjeta, ahí mismo.</small></span>
          </label>
          <label className="nc-op" data-on={paga === 'cliente'}>
            <input type="radio" name="nc-paga" checked={paga === 'cliente'} onChange={() => setPaga('cliente')} />
            <span><b>Mi cliente</b><small>Si MaKo ya puede cobrarle, le llega su acceso y paga al terminar su configuración. Si no, su cuenta espera a que MaKo la habilite.</small></span>
          </label>
        </fieldset>
        {mal && <p className="nc-mal" role="alert">{mal}<ReportarASoporte /></p>}
      </>
    );
    pie = (
      <>
        <button type="button" className="nc-no" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="nc-si" disabled={!listo || ocupado} onClick={() => void abrir()}>
          {ocupado ? 'Abriendo…' : 'Abrir su cuenta'}
        </button>
      </>
    );
  }

  return createPortal(
    <Modal titulo={titulo} encabezado="Agency Dashboard" ancho={480} onCerrar={onCerrar} pie={pie}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {cuerpo}
    </Modal>,
    document.body,
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad.
const CSS = `
.nc-lab{ display:block; margin:0 0 6px; font-size:13px; font-weight:600; color:var(--ink); padding:0; }
.nc-lab + .nc-in{ margin-bottom:14px; }
.nc-in{ width:100%; box-sizing:border-box; border:1px solid var(--border); border-radius:10px; padding:10px 12px; font:inherit; font-size:14px;
  background:var(--surface); color:var(--ink); }
.nc-in:focus{ outline:none; border-color:var(--primary); box-shadow:var(--focus-ring); }
.nc-paga{ border:0; margin:2px 0 0; padding:0; display:flex; flex-direction:column; gap:8px; min-width:0; }
.nc-op{ display:flex; gap:11px; align-items:flex-start; border:1px solid var(--border); border-radius:12px; padding:12px 14px; cursor:pointer;
  background:var(--surface); transition:border-color .15s ease, background .15s ease; }
.nc-op[data-on="true"]{ border-color:var(--primary); background:var(--primary-bg); }
.nc-op input{ margin:3px 0 0; accent-color:var(--primary); }
.nc-op span{ display:flex; flex-direction:column; gap:2px; }
.nc-op b{ font-size:14.5px; color:var(--ink); }
.nc-op small{ font-size:13px; color:var(--dim); line-height:1.45; }
.nc-ayuda{ margin:10px 0 0; font-size:13px; color:var(--dim); line-height:1.5; }
.nc-ayuda--fuerte{ font-size:14.5px; font-weight:600; color:var(--ink); margin-top:0; }
.nc-mal{ margin:10px 0 0; font-size:13px; color:var(--bad); }
.nc-si, .nc-no{ display:inline-flex; align-items:center; border-radius:10px; padding:9px 16px; font:inherit; font-size:14px;
  font-weight:600; cursor:pointer; text-decoration:none; }
.nc-si{ border:1px solid var(--primary); background:var(--primary); color:var(--on-primary, #fff); }
.nc-si:disabled{ opacity:.5; cursor:default; }
.nc-no{ border:1px solid var(--border); background:var(--surface); color:var(--dim); }
`;
