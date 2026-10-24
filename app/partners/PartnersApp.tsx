'use client';

// =============================================================================
// PartnersApp — la tab MaKo Partners: las cuentas de MaKo de los clientes de la agencia
// =============================================================================
// Martín, 17/10/2026: «diseña la tab de "MaKo Partners" con todo lo que habíamos dicho y planeado... Y ahí deberían
// vivir los clientes de agencia». El diseño, en docs/diseno-clients.md (D7).
//
// LA ESTRUCTURA ES LA DE LAS SUB-CUENTAS DE UNA AGENCIA EN HIGHLEVEL (Agency View › Sub-Accounts): una lista de las
// cuentas de tus clientes, «+ Nuevo cliente» arriba a la derecha, y en cada fila su nombre, su estado y la entrada a la
// cuenta («Inspeccionar», el «Switch to sub-account» de allá). Lo que es nuestro es el COBRO de cada una (#866, #867:
// pagar su primer mes, activar la renovación) y su equipo. Copiada de su documentación: el Chrome no estaba conectado
// para abrirla (docs/hallazgos-customer-success.md, «MaKo Partners»).
//
// Dos vistas, en `?tab=` (leída en el server): Clients (las cuentas) y Program (cómo funciona, sólo con lo que EXISTE:
// el precio y cómo corre el mes). ⚠️ Los premios por referir (docs/referidos.md) NO se dibujan: están decididos y no
// construidos, y ponerlos acá sería prometer algo que el sistema no paga (D7).
//
// ⚠️ La ficha de una cuenta es un MODAL sin estado de carga (todo vino con el HTML) y viaja en `?cuenta=<ws>`, escrita
//    con `history.replaceState`: un F5 o un link copiado la reabren.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Pagina, PageHeader, EmptyState, ErrorState, Status, Tabs, Modal, Toast, useToast,
} from '@/app/_ui';
import Link, { useRouter } from '@/app/_ui/Link';
import { Marca } from '@/app/_components/Marca';
import { colorDe } from '@/app/_components/TarjetaEntidad';
import { ROTULO_CARTERA, type EstadoCartera } from '@/lib/agencia-cartera';
import type { CarteraPartner, CuentaPartner } from '@/lib/partners';
import { EquipoDeCuenta } from './EquipoDeCuenta';
import { avisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';
import { ModalLlevarAPartners } from './LlevarAPartners';
import { PresentacionPartners } from './PresentacionPartners';
import type { ResumenPrograma } from '@/lib/partners-programa';

type Vista = 'clients' | 'program';

/** Lo que espera algo de la agencia, en una palabra (el chip de la fila). */
function chipDe(c: CuentaPartner): { texto: string; tono: 'warn' | 'good' | 'neutral' | 'bad' } {
  if (c.cobro?.pagar) return { texto: 'Falta pagar su mes', tono: 'warn' };
  if (c.cobro?.renovacion && !c.cobro.renovacion.activada) return { texto: 'Activar renovación', tono: 'warn' };
  // ⚠️ Una cuenta habilitada SIN NADIE ADENTRO (el ws15 del 28/09: nació antes de que abrir una cuenta pidiera el email).
  // `[]` es «leí y no hay nadie»; `null` es «no pude leer», y ahí no se afirma nada (lib/partners.ts).
  if (c.estado === 'aprobado' && c.equipo?.length === 0) return { texto: 'Nadie puede entrar', tono: 'warn' };
  if (c.estado === 'aprobado') return { texto: 'Activa', tono: 'good' };
  if (c.estado === 'revocado') return { texto: ROTULO_CARTERA.revocado, tono: 'bad' };
  return { texto: ROTULO_CARTERA.pendiente, tono: 'neutral' };
}

const fecha = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function PartnersApp({ cartera, vistaInicial, cuentaInicial, leadNuevo, puedeAbrir, superAdmin }: {
  cartera: CarteraPartner;
  vistaInicial: Vista;
  cuentaInicial: number | null;
  /** `?nuevo=<leadId>`: lo propuso MaKo; se abre el alta con ese lead. */
  leadNuevo: number | null;
  /** Admin de la agencia: abre cuentas y pide sumar gente. */
  puedeAbrir: boolean;
  /** El super admin parado en la agencia: entra a cada cuenta por su `?ws=` y suma gente directo. */
  superAdmin: boolean;
}) {
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [abiertaWs, setAbiertaWs] = useState<number | null>(cuentaInicial);
  const [alta, setAlta] = useState<{ leadId: number | null } | null>(leadNuevo != null && puedeAbrir ? { leadId: leadNuevo } : null);
  const [pago, setPago] = useState<{ url: string; renovacion: boolean; desde: string | null } | null>(null);
  const [q, setQ] = useState('');

  const cuentas = useMemo(() => (cartera.ok ? cartera.cuentas : []), [cartera]);
  const abierta = cuentas.find((c) => c.ws === abiertaWs) ?? null;
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? cuentas.filter((c) => c.nombre.toLowerCase().includes(t) || (c.lead?.nombre ?? '').toLowerCase().includes(t)) : cuentas;
  }, [cuentas, q]);

  // La cuenta abierta y la vista, en la URL (replace: el Atrás saca de la tab, no recorre fichas).
  useEffect(() => {
    try {
      const { pathname, search, hash } = window.location;
      const sp = new URLSearchParams(search);
      if (abierta) sp.set('cuenta', String(abierta.ws)); else sp.delete('cuenta');
      if (vista === 'clients') sp.delete('tab'); else sp.set('tab', vista);
      sp.delete('nuevo');
      const destino = `${pathname}${sp.toString() ? `?${sp}` : ''}${hash}`;
      if (destino !== pathname + search + hash) window.history.replaceState(null, '', destino);
    } catch { /* sin URL no se pierde nada */ }
  }, [abierta, vista]);

  const cerrarFicha = useCallback(() => setAbiertaWs(null), []);

  /**
   * «Reenviar el acceso» a quien maneja la cuenta (vivía en la tarjeta de Clients hasta el 17/10/2026). El permiso lo
   * pregunta el server contra la cartera en el momento (/api/agencia/reinvitar). El resultado es el del ENVÍO: un «listo»
   * mudo no distingue «se le mandó» de «no salió».
   */
  const [reenviando, setReenviando] = useState(false);
  const reenviar = async (clienteWs: number, a: { id: number; email: string }) => {
    if (reenviando) return;
    setReenviando(true);
    try {
      const j = (await (await fetch('/api/agencia/reinvitar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clienteWs, usuarioId: a.id }),
      })).json()) as { ok?: boolean; error?: string; invitacion?: ResultadoInvitacion };
      if (!j.ok) { show(j.error ?? 'No se pudo reenviar el acceso.', undefined, 'bad'); return; }
      const aviso = avisoInvitacion(j.invitacion, a.email);
      show(aviso.texto, undefined, aviso.tono === 'ok' ? 'good' : 'warn');
    } catch {
      show('No se pudo reenviar el acceso.', undefined, 'bad');
    } finally { setReenviando(false); }
  };
  const quienManeja = abierta?.equipo?.find((u) => u.rol === 'admin') ?? abierta?.equipo?.[0] ?? null;
  const cerrarAlta = useCallback(() => setAlta(null), []);
  const cerrarPago = useCallback(() => setPago(null), []);

  const entrar = async (ws: number) => {
    // Al repartidor (/inicio), como el login: entra al Ops Center del negocio, o a su wizard si no terminó (21/10/2026).
    if (superAdmin) { window.location.href = `/inicio?ws=${ws}`; return; }
    try {
      const j = await (await fetch('/api/agencia/entrar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ws }),
      })).json();
      if (!j?.ok) { show(j?.error ?? 'No se pudo entrar.', undefined, 'bad'); return; }
      // Recarga dura: el contexto lo resuelve el server desde la cookie que acaba de quedar (CuentaDeMaKo, 27/09).
      window.location.href = '/inicio';
    } catch { show('No se pudo entrar.', undefined, 'bad'); }
  };

  const accionDe = (c: CuentaPartner): ReactNode => {
    if (c.cobro?.pagar) {
      const url = c.cobro.pagar;
      return <button type="button" className="pt-acc pt-acc--fuerte" onClick={() => setPago({ url, renovacion: false, desde: null })}>Pagar su mes</button>;
    }
    if (c.cobro?.renovacion && !c.cobro.renovacion.activada) {
      const r = c.cobro.renovacion;
      return <button type="button" className="pt-acc pt-acc--fuerte" onClick={() => setPago({ url: r.link, renovacion: true, desde: r.desde })}>Activar renovación</button>;
    }
    if (c.estado === 'aprobado' || superAdmin) {
      return <button type="button" className="pt-acc" onClick={() => void entrar(c.ws)}>Inspeccionar</button>;
    }
    return null;
  };

  const nuevo = puedeAbrir ? (
    <button type="button" className="pt-nuevo" onClick={() => setAlta({ leadId: null })}>+ Nuevo cliente</button>
  ) : undefined;

  return (
    <Pagina>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PageHeader
        titulo="MaKo Partners"
        estado={cuentas.length ? <Status>{cuentas.length} {cuentas.length === 1 ? 'cliente' : 'clientes'}</Status> : undefined}
        accion={nuevo}
      />
      <Tabs
        tabs={[{ id: 'clients', label: 'Clients' }, { id: 'program', label: 'Program' }, { id: 'referidos', label: 'Referidos' }]}
        activa={vista}
        // «Referidos» es su propia pantalla (/partners/referidos, 23/10/2026): el tablero de MaKo Partners de cualquier negocio.
        onCambio={(id) => (id === 'referidos' ? router.push('/partners/referidos') : setVista(id as Vista))}
      />

      {vista === 'program' ? (
        <Programa cartera={cartera} />
      ) : !cartera.ok ? (
        <ErrorState titulo="No pude leer tus clientes" detalle={cartera.error} detalleTecnico={cartera.error} />
      ) : cuentas.length === 0 ? (
        <EmptyState titulo="Todavía no tienes clientes en MaKo Partners"
          detalle="Ábrele su cuenta a un cliente, o llévalo desde el CRM."
          accion={puedeAbrir ? { label: 'Nuevo cliente', onClick: () => setAlta({ leadId: null }) } : undefined} />
      ) : (
        <>
          {cuentas.length > 6 && (
            <input className="pt-buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar un cliente" aria-label="Buscar un cliente" />
          )}
          <ul className="pt-lista">
            {visibles.map((c) => {
              const chip = chipDe(c);
              return (
                <li key={c.ws} className="pt-fila">
                  <button type="button" className="pt-abrir" onClick={() => setAbiertaWs(c.ws)} aria-label={`Abrir la cuenta de ${c.nombre}`}>
                    <Marca icono={null} foto={null} nombre={c.nombre} tam={38} color={colorDe(c.nombre)} />
                    <span className="pt-txt">
                      <b>{c.nombre}</b>
                      <span>{c.plan ?? 'Cuenta de MaKo'} · desde {fecha(c.desde)}{c.equipo ? ` · ${c.equipo.length} ${c.equipo.length === 1 ? 'persona' : 'personas'}` : ''}</span>
                    </span>
                    <span className={`pt-chip pt-chip--${chip.tono}`}>{chip.texto}</span>
                  </button>
                  <span className="pt-fila-acc">{accionDe(c)}</span>
                </li>
              );
            })}
            {visibles.length === 0 && <li className="pt-vacio">Ningún cliente se llama así.</li>}
          </ul>
        </>
      )}

      {abierta && (
        <Modal titulo={abierta.nombre} encabezado="Cuenta de MaKo" ancho={620} onCerrar={cerrarFicha}
          pie={<span className="pt-fila-acc">{accionDe(abierta)}</span>}>
          <dl className="pt-datos">
            <div><dt>Estado</dt><dd>{chipDe(abierta).texto}</dd></div>
            <div><dt>Desde</dt><dd>{fecha(abierta.desde)}</dd></div>
            {abierta.plan && <div><dt>Plan</dt><dd>{abierta.plan}</dd></div>}
            <div><dt>En tu CRM</dt><dd>{abierta.lead ? <Link href={`/crm/${abierta.lead.id}`}>{abierta.lead.nombre} →</Link> : 'No está'}</dd></div>
            {abierta.cobro?.renovacion?.activada && <div><dt>Renovación</dt><dd>Activa</dd></div>}
          </dl>
          <h3 className="pt-sub">Equipo</h3>
          {abierta.estado === 'aprobado' && quienManeja && (puedeAbrir || superAdmin) && (
            <button type="button" className="pt-acc pt-reenviar" disabled={reenviando}
              onClick={() => void reenviar(abierta.ws, quienManeja)}>
              {reenviando ? 'Reenviando…' : `Reenviar el acceso a ${quienManeja.nombre}`}
            </button>
          )}
          {abierta.estado === 'aprobado' ? (
            <EquipoDeCuenta equipo={abierta.equipo} altas={abierta.altas} clienteWs={abierta.ws}
              puedePedir={puedeAbrir && !superAdmin} puedeSumar={superAdmin}
              onError={(m) => { if (m) show(m, undefined, 'bad'); }} onPedido={() => router.refresh()} />
          ) : (
            <p className="pt-nota">Cuando la cuenta quede habilitada, aquí ves quién entra.</p>
          )}
        </Modal>
      )}

      {alta && (
        <ModalLlevarAPartners leadId={alta.leadId} onCerrar={cerrarAlta} onListo={() => router.refresh()} />
      )}

      {pago && typeof document !== 'undefined' && createPortal(
        <ModalPago pago={pago} onCerrar={cerrarPago} />,
        document.body,
      )}
      <Toast state={toast} onClose={clear} />
    </Pagina>
  );
}

/** El link de pago (#866: el primer mes; #867: la renovación mensual). Copiar o abrir. */
function ModalPago({ pago, onCerrar }: { pago: { url: string; renovacion: boolean; desde: string | null }; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const desde = pago.desde ? new Date(pago.desde).toLocaleDateString('es', { day: '2-digit', month: '2-digit' }) : null;
  const copiar = () => {
    void navigator.clipboard?.writeText(pago.url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); }).catch(() => {});
  };
  return (
    <Modal titulo={pago.renovacion ? 'Su renovación mensual' : 'Su primer mes'} encabezado="MaKo Partners" ancho={440} onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="pt-acc" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar el link'}</button>
          <a className="pt-acc pt-acc--fuerte" href={pago.url} target="_blank" rel="noopener noreferrer">{pago.renovacion ? 'Autorizarla' : 'Pagar ahora'}</a>
        </>
      }>
      <input className="pt-buscar" readOnly value={pago.url} aria-label="Link de pago" onFocus={(e) => e.currentTarget.select()} />
      <p className="pt-nota">
        {pago.renovacion
          ? `Se cobra sola cada mes${desde ? `, desde el ${desde}` : ''}. La autorizas una vez.`
          : 'Al pagarlo, la cuenta queda habilitada. Su mes corre desde que termine el onboarding.'}
      </p>
    </Modal>
  );
}

/** Program: cómo funciona, sólo con lo que existe (D7). Los números salen de la plataforma, no de un texto. */
function Programa({ cartera }: { cartera: CarteraPartner }) {
  const precio = cartera.ok ? cartera.precio : null;
  const usd = precio?.usd ?? 47;
  return (
    <ol className="pt-programa">
      <li><b>Cada cliente tiene su propia cuenta de MaKo.</b> La abres tú, desde aquí o desde el CRM.</li>
      <li><b>Cuesta US${usd} al mes por cliente.</b>{precio?.mp ? ` Se paga en ${precio.mp.moneda}: ${precio.mp.monto.toLocaleString('es')}.` : ''} Al pagar su primer mes, la cuenta queda habilitada.</li>
      <li><b>Su mes corre desde que termina el onboarding.</b> Después se renueva solo, cada mes, y lo autorizas una vez.</li>
      <li><b>Entras a su cuenta con «Inspeccionar»</b> y pides sumar a su equipo a quien la va a usar.</li>
    </ol>
  );
}

/** Para el super admin sin cliente: las agencias del programa. Entra a cada una con su `?ws=` (un ancla: ctrl+clic). */
export function PartnersPlataforma({ partners, programa }: {
  partners: Array<{ ws: number; nombre: string; cuentas: Record<EstadoCartera, number> }> | null;
  /** El programa de referidos entero (lib/partners-programa.ts, `resumenDelPrograma`). null = no se pudo leer. */
  programa: ResumenPrograma | null;
}) {
  const usd = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
  const alMenos = programa?.truncado ? 'al menos ' : '';
  return (
    <Pagina>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PageHeader titulo="MaKo Partners" />
      {/* Primero lo que vende la idea (como lo ven los clientes), después el panel del programa (Martín, 24/10/2026). */}
      <PresentacionPartners vista="plataforma" />
      <h3 className="pt-titulo">El programa</h3>
      {programa == null ? (
        <ErrorState titulo="No pude leer el programa" detalle="Reintenta en un momento." />
      ) : (
        <>
          <div className="pt-kpis">
            <div className="pt-kpi"><b>{alMenos}{programa.conLink}</b><span>{programa.conLink === 1 ? 'Negocio con su link' : 'Negocios con su link'}</span></div>
            <div className="pt-kpi"><b>{alMenos}{programa.referidos}</b><span>{programa.referidos === 1 ? 'Referido' : 'Referidos'}</span></div>
            <div className="pt-kpi"><b>{alMenos}{usd(programa.acreditadoUsd)}</b><span>Crédito acumulado</span></div>
          </div>
          {programa.partners.length === 0
            ? <EmptyState titulo="Todavía nadie trajo un referido" detalle="Cada negocio tiene su link en MaKo Partners: el primero que traiga uno aparece aquí." />
            : (
              <ul className="pt-lista">
                {programa.partners.map((p) => (
                  <li key={p.ws} className="pt-fila">
                    <a className="pt-abrir" href={`/partners/referidos?ws=${p.ws}`}>
                      <Marca icono={null} foto={null} nombre={p.nombre} tam={38} color={colorDe(p.nombre)} />
                      <span className="pt-txt">
                        <b>{p.nombre}</b>
                        <span>{p.referidos} {p.referidos === 1 ? 'referido' : 'referidos'} · {usd(p.acreditadoUsd)} acumulado</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
        </>
      )}
      <h3 className="pt-titulo" style={{ marginTop: 28 }}>
        Agencias del programa{partners?.length ? <> <Status>{partners.length}</Status></> : null}
      </h3>
      {partners == null ? (
        <ErrorState titulo="No pude leer las agencias" detalle="Reintenta en un momento." />
      ) : partners.length === 0 ? (
        <EmptyState titulo="Ninguna agencia en el programa" detalle="Se suma una poniéndole el plan Agencia en Clients." />
      ) : (
        <ul className="pt-lista">
          {partners.map((p) => (
            <li key={p.ws} className="pt-fila">
              <a className="pt-abrir" href={`/partners?ws=${p.ws}`}>
                <Marca icono={null} foto={null} nombre={p.nombre} tam={38} color={colorDe(p.nombre)} />
                <span className="pt-txt">
                  <b>{p.nombre}</b>
                  <span>{p.cuentas.aprobado} activas · {p.cuentas.pendiente} esperando{p.cuentas.revocado ? ` · ${p.cuentas.revocado} revocadas` : ''}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad.
const CSS = `
.pt-titulo{ margin:0 0 12px; font-size:var(--fs-md); color:var(--ink); display:flex; align-items:center; gap:8px; }
.pt-kpis{ display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); margin:0 0 16px; }
.pt-kpi{ background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:14px 16px; }
.pt-kpi b{ display:block; font-size:24px; color:var(--ink); }
.pt-kpi span{ font-size:var(--fs-sm); color:var(--dim); }
.pt-nuevo{ border:1px solid var(--primary); background:var(--primary); color:var(--on-primary, #fff); border-radius:10px;
  padding:9px 16px; font:inherit; font-size:14px; font-weight:600; cursor:pointer; white-space:nowrap; }
.pt-buscar{ width:100%; max-width:360px; border:1px solid var(--border); border-radius:10px; padding:9px 12px; font:inherit;
  font-size:14px; background:var(--surface); color:var(--ink); margin-bottom:12px; }
.pt-lista{ list-style:none; margin:0; padding:0; border-top:1px solid var(--border); }
.pt-fila{ display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--border); }
.pt-abrir{ flex:1; min-width:0; display:flex; align-items:center; gap:12px; padding:12px 6px; border:0; background:none;
  font:inherit; color:inherit; text-align:left; cursor:pointer; text-decoration:none; border-radius:10px; }
.pt-abrir:hover{ background:var(--surface-2); }
.pt-txt{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.pt-txt b{ font-size:15px; font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-txt span{ font-size:12.5px; color:var(--dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-chip{ flex:none; font-size:11.5px; font-weight:600; padding:3px 9px; border-radius:999px; white-space:nowrap; }
.pt-chip--warn{ background:var(--warn-bg); color:var(--warn); }
.pt-chip--good{ background:var(--good-bg); color:var(--good); }
.pt-chip--bad{ background:var(--bad-bg); color:var(--bad); }
.pt-chip--neutral{ background:var(--surface-2); color:var(--dim); }
.pt-fila-acc{ flex:none; display:inline-flex; gap:8px; padding-right:6px; }
.pt-acc{ display:inline-flex; align-items:center; border:1px solid var(--border); background:var(--surface); color:var(--ink);
  border-radius:9px; padding:7px 12px; font:inherit; font-size:13px; font-weight:600; cursor:pointer; text-decoration:none; white-space:nowrap; }
.pt-acc:hover{ border-color:var(--primary); color:var(--primary); }
.pt-acc--fuerte{ border-color:var(--primary); background:var(--primary); color:var(--on-primary, #fff); }
.pt-acc--fuerte:hover{ color:var(--on-primary, #fff); }
.pt-vacio{ padding:18px 6px; color:var(--faint); font-size:13.5px; }
.pt-datos{ margin:0 0 18px; display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px 20px; }
.pt-datos dt{ font-size:12px; color:var(--dim); margin-bottom:2px; }
.pt-datos dd{ margin:0; font-size:14px; font-weight:600; color:var(--ink); }
.pt-sub{ margin:6px 0 4px; font-size:14px; font-weight:700; color:var(--ink); }
.pt-reenviar{ margin:4px 0 8px; }
.pt-nota{ margin:10px 0 0; font-size:13px; color:var(--dim); }
.pt-programa{ margin:0; padding:0 0 0 20px; display:flex; flex-direction:column; gap:14px; max-width:680px; font-size:15px; color:var(--ink); }
.pt-programa b{ font-weight:700; }
@media (max-width: 640px){
  .pt-fila{ flex-wrap:wrap; }
  .pt-fila-acc{ padding:0 6px 12px 56px; }
  .pt-chip{ display:none; }
}
`;
