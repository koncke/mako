'use client';

// =============================================================================
// ModalLlevarAPartners — abrirle su cuenta de MaKo a un cliente de la agencia (el «+ Nuevo cliente» de Partners y la
// opción «Llevar a MaKo Partners» del CRM)
// =============================================================================
// Martín, 17/10/2026: «si un usuario se unió al programa de "MaKo Partners", que le aparezca la opción en el CRM para
// llevarlos allí». UNA pieza para las dos puertas (la tab y el CRM), autocontenida: la monta quien la necesite con
// `leadId` (desde el CRM) o sin él (un cliente que no está en el CRM: «podrían serlo como no»). El núcleo es
// `abrirCuentaDePartner` (lib/partners.ts) por `llevarAPartnersAction`.
//
// Dos pasos en la misma caja:
//   1. su nombre y su email (obligatorio: es por donde le llega el acceso);
//   2. el link del primer mes (#866): pagarlo la habilita, y su mes corre desde que termina el onboarding (#867). Sin
//      link (MaKo todavía no cobra por Mercado Pago), queda esperando que la habilite MaKo, y se dice.
// Si el lead YA tiene cuenta, no se pregunta nada: se dice y se ofrece verla.
//
// ⚠️ POR PORTAL AL BODY: el CRM la abre desde una tarjeta o un menú, y un `<Modal>` adentro de un contexto de
//    apilamiento queda atrapado debajo de la tarjeta siguiente (el caso de CuentaDeMaKo del 05/10/2026).

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { emailUtilizable } from '@/lib/agencia-altas';
import { llevarAPartnersAction, leadParaPartnersAction } from './actions';

type Hecho = { clienteWs: number; link: string | null; sinLink: string | null };

export function ModalLlevarAPartners({ leadId = null, nombre: nombreInicial = '', email: emailInicial = null, onCerrar, onListo }: {
  /** El lead del CRM. Sin él, un cliente nuevo (nombre y email a mano). */
  leadId?: number | null;
  nombre?: string;
  email?: string | null;
  onCerrar: () => void;
  /** Se abrió la cuenta (para refrescar la pantalla de quien la montó). */
  onListo?: (clienteWs: number) => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [email, setEmail] = useState(emailInicial ?? '');
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
    void leadParaPartnersAction(leadId).then((r) => {
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
    const r = await llevarAPartnersAction({ leadId, nombre, email }).catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    setOcupado(false);
    if (!r.ok) {
      if ('yaTiene' in r && r.yaTiene) setYa(r.yaTiene);
      else setMal(r.error);
      return;
    }
    setHecho({ clienteWs: r.clienteWs, link: r.link, sinLink: r.sinLink });
    onListo?.(r.clienteWs);
  };
  const copiar = () => {
    if (!hecho?.link) return;
    void navigator.clipboard?.writeText(hecho.link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); }).catch(() => {});
  };

  if (typeof document === 'undefined') return null;
  const quien = nombre.trim() || 'este cliente';

  let titulo = `Llevar a ${quien} a MaKo Partners`;
  let cuerpo: ReactNode;
  let pie: ReactNode;
  if (ya != null) {
    titulo = 'Ya está en MaKo Partners';
    cuerpo = <p className="pll-ayuda">{quien} ya tiene su cuenta de MaKo.</p>;
    pie = (
      <>
        <button type="button" className="pll-no" onClick={onCerrar}>Cerrar</button>
        <Link className="pll-si" href={`/partners?cuenta=${ya}`}>Ver su cuenta</Link>
      </>
    );
  } else if (hecho) {
    titulo = hecho.link ? 'Su primer mes' : 'Cuenta pedida';
    cuerpo = hecho.link ? (
      <>
        <input className="pll-in" readOnly value={hecho.link} aria-label="Link de pago" onFocus={(e) => e.currentTarget.select()} />
        <p className="pll-ayuda">Al pagarlo, la cuenta queda habilitada. Su mes corre desde que termine el onboarding.</p>
      </>
    ) : (
      <p className="pll-ayuda">Le llega su acceso cuando MaKo la habilite.</p>
    );
    pie = hecho.link ? (
      <>
        <button type="button" className="pll-no" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar el link'}</button>
        <a className="pll-si" href={hecho.link} target="_blank" rel="noopener noreferrer">Pagar ahora</a>
      </>
    ) : (
      <>
        <button type="button" className="pll-no" onClick={onCerrar}>Cerrar</button>
        <Link className="pll-si" href={`/partners?cuenta=${hecho.clienteWs}`}>Ver su cuenta</Link>
      </>
    );
  } else {
    cuerpo = (
      <>
        {leadId == null && (
          <>
            <label className="pll-lab" htmlFor="pll-nombre">Nombre de su negocio</label>
            <input id="pll-nombre" className="pll-in" value={nombre} data-autofocus placeholder="Inmobiliaria del Sur"
              onChange={(e) => setNombre(e.target.value)} />
          </>
        )}
        <label className="pll-lab" htmlFor="pll-correo">Email de quien la va a usar</label>
        <input id="pll-correo" className="pll-in" type="email" value={email} placeholder="persona@empresa.com"
          data-autofocus={leadId != null ? true : undefined}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void abrir(); }} />
        {/* La consecuencia, pegada al botón y antes del clic. */}
        <p className="pll-ayuda">Se crea su cuenta de MaKo y te damos el link de su primer mes.</p>
        {mal && <p className="pll-mal" role="alert">{mal}</p>}
      </>
    );
    pie = (
      <>
        <button type="button" className="pll-no" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="pll-si" disabled={!listo || ocupado} onClick={() => void abrir()}>
          {ocupado ? 'Abriendo…' : 'Abrir su cuenta'}
        </button>
      </>
    );
  }

  return createPortal(
    <Modal titulo={titulo} encabezado="MaKo Partners" ancho={460} onCerrar={onCerrar} pie={pie}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {cuerpo}
    </Modal>,
    document.body,
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad.
const CSS = `
.pll-lab{ display:block; margin:0 0 6px; font-size:13px; font-weight:600; color:var(--ink); }
.pll-lab + .pll-in{ margin-bottom:14px; }
.pll-in{ width:100%; border:1px solid var(--border); border-radius:10px; padding:10px 12px; font:inherit; font-size:14px;
  background:var(--surface); color:var(--ink); }
.pll-in:focus{ outline:none; border-color:var(--primary); box-shadow:var(--focus-ring); }
.pll-ayuda{ margin:10px 0 0; font-size:13px; color:var(--dim); }
.pll-mal{ margin:10px 0 0; font-size:13px; color:var(--bad); }
.pll-si, .pll-no{ display:inline-flex; align-items:center; border-radius:10px; padding:9px 16px; font:inherit; font-size:14px;
  font-weight:600; cursor:pointer; text-decoration:none; }
.pll-si{ border:1px solid var(--primary); background:var(--primary); color:var(--on-primary, #fff); }
.pll-si:disabled{ opacity:.5; cursor:default; }
.pll-no{ border:1px solid var(--border); background:var(--surface); color:var(--dim); }
`;
