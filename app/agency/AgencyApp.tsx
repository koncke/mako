'use client';

// =============================================================================
// AgencyApp — Agency Dashboard: las cuentas de MaKo de los clientes de la agencia (25/10/2026)
// =============================================================================
// Martín (docs/feedback-25-10-tarde.md punto 9): «Pon el dashboard de "Agencia" allí, con todos los clientes de Codigo
// allí también... como siempre revisa como lo hacen otras apps y copialo, quiero que se vea bien, epico». Era la cartera
// de /partners (app/partners/PartnersApp.tsx, 17/10/2026), que ya copiaba las sub-cuentas de HighLevel; se mudó acá y
// sumó lo que tienen los paneles de agencia que se miraron (HighLevel Agency View, AgencyAnalytics, Vendasta):
//   · ARRIBA, LOS NÚMEROS QUE SE MIRAN TODOS LOS DÍAS: cuántas cuentas activas, cuántas esperan un pago, cuánto pagas tú
//     por mes y cuántas pagan tus clientes. Salen de la cartera, no de otra lectura.
//   · LOS SEGMENTOS COMO PESTAÑAS CON SU CONTEO (Todas · Activas · Por pagar · Revocadas), la búsqueda al lado.
//   · LA LISTA: el nombre con su cara, el estado con un punto de color, QUIÉN PAGA (lo nuevo: «Pagas tú» / «Paga tu
//     cliente»), el equipo y la entrada a la cuenta («Inspeccionar», el «Switch to sub-account» de HighLevel).
//   · «Ver la landing» arriba, como pidió para Partners (punto 3: «con un botón arriba para ver la landing nuevamente»).
//
// ⚠️ La ficha de una cuenta es un MODAL sin estado de carga (todo vino con el HTML) y viaja en `?cuenta=<ws>`, escrita
//    con `history.replaceState`: un F5 o un link copiado la reabren.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Pagina, PageHeader, EmptyState, ErrorState, Modal, Toast, useToast } from '@/app/_ui';
import Link, { useRouter } from '@/app/_ui/Link';
import { Marca } from '@/app/_components/Marca';
import { colorDe } from '@/app/_components/TarjetaEntidad';
import { ROTULO_CARTERA, type EstadoCartera } from '@/lib/agencia-cartera';
import type { CarteraPartner, CuentaPartner } from '@/lib/partners';
import { ESTADO_FALTA_PAGAR, ROTULO_QUIEN_PAGA, avisoFaltaPagar, quienPagaSugerido, type PerfilAgency } from '@/lib/agency-reglas';
import { avisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';
import { EquipoDeCuenta } from '@/app/partners/EquipoDeCuenta';
import { MenuContextual } from '@/app/_ui/MenuContextual';
import { useMenuContextual } from '@/app/_ui/useMenuContextual';
import { ROTULO_ACCION_CUENTA, accionDeCuenta, itemsCuentaAgency } from './menu-contextual-agency';
import { ModalNuevoCliente } from './NuevoCliente';
import { PlantillaDeModelo } from './PlantillaDeModelo';
import { DarDeBaja } from './DarDeBaja';
import { ConfirmDialog } from '@/app/_components/ChatItemMenu';
import { cambiarPlanClienteAction } from './actions';
import { CorregirReloj, Mensualidad } from './Mensualidad';
import type { MensualidadPantalla as DatosMensualidad, FilaMensualidad } from '@/lib/agencia-mes';
import { textoDeSituacion, usd as usdMes } from '@/lib/agencia-mes-reglas';

type Segmento = 'todas' | 'activas' | 'por-pagar' | 'revocadas';
type Tono = 'warn' | 'good' | 'neutral' | 'bad';

/**
 * Lo que espera algo de la agencia (o de su cliente), en una palabra (el estado de la fila). `faltaPagar`: en pausa por la
 * mensualidad de la agencia (14/11/2026): se dice ANTES de tocar «Inspeccionar», no después.
 */
function estadoDe(c: CuentaPartner, faltaPagar = false): { texto: string; tono: Tono } {
  if (faltaPagar) return { texto: ESTADO_FALTA_PAGAR, tono: 'bad' };
  if (c.cobro?.pagar) return { texto: c.paga === 'cliente' ? 'Esperando su pago' : 'Falta pagar su mes', tono: 'warn' };
  if (c.cobro?.renovacion && !c.cobro.renovacion.activada) return { texto: c.paga === 'cliente' ? 'Esperando su renovación' : 'Activar renovación', tono: 'warn' };
  // ⚠️ Una cuenta habilitada SIN NADIE ADENTRO (el ws15 del 28/09: nació antes de que abrir una cuenta pidiera el email).
  // `[]` es «leí y no hay nadie»; `null` es «no pude leer», y ahí no se afirma nada (lib/partners.ts).
  if (c.estado === 'aprobado' && c.equipo?.length === 0) return { texto: 'Nadie puede entrar', tono: 'warn' };
  if (c.estado === 'aprobado') return { texto: 'Activa', tono: 'good' };
  if (c.estado === 'revocado') return { texto: ROTULO_CARTERA.revocado, tono: 'bad' };
  return { texto: ROTULO_CARTERA.pendiente, tono: 'neutral' };
}

/** ¿Espera un pago? (de la agencia o de su cliente) */
const porPagar = (c: CuentaPartner) => !!c.cobro?.pagar || (!!c.cobro?.renovacion && !c.cobro.renovacion.activada);

/** `pp`: ¿espera un pago?, con la mensualidad (la que está en pausa por ella también va en «Por pagar»). */
const enSegmento = (c: CuentaPartner, s: Segmento, pp: (c: CuentaPartner) => boolean): boolean =>
  s === 'todas' ? true : s === 'activas' ? c.estado === 'aprobado' : s === 'por-pagar' ? pp(c) : c.estado === 'revocado';

const fecha = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
};
const usdTxt = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

export function AgencyApp({ cartera, cuentaInicial, leadNuevo, puedeAbrir, superAdmin, perfil, mensualidad = null, verMensualidad = false }: {
  cartera: CarteraPartner;
  cuentaInicial: number | null;
  /** `?nuevo=<leadId>`: lo propuso MaKo; se abre el alta con ese lead. */
  leadNuevo: number | null;
  /** Admin de la agencia: abre cuentas y pide sumar gente. */
  puedeAbrir: boolean;
  /** El super admin parado en la agencia: entra a cada cuenta por su `?ws=` y suma gente directo. */
  superAdmin: boolean;
  /** Lo que la agencia contó al sumarse: propone primero quién paga. */
  perfil: PerfilAgency | null;
  /** La mensualidad por fuera de MaKo (lib/agencia-mes.ts): null = no se muestra (apagada, y no es el super admin). */
  mensualidad?: DatosMensualidad | null;
  /** `?vista=mensualidad`: el link de los avisos baja hasta ella. */
  verMensualidad?: boolean;
}) {
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [segmento, setSegmento] = useState<Segmento>('todas');
  const [abiertaWs, setAbiertaWs] = useState<number | null>(cuentaInicial);
  const [alta, setAlta] = useState<{ leadId: number | null } | null>(leadNuevo != null && puedeAbrir ? { leadId: leadNuevo } : null);
  const [pago, setPago] = useState<{ url: string; renovacion: boolean; desde: string | null } | null>(null);
  const [q, setQ] = useState('');

  const cuentas = useMemo(() => (cartera.ok ? cartera.cuentas : []), [cartera]);
  const usd = cartera.ok ? cartera.precio.usd : null;
  const abierta = cuentas.find((c) => c.ws === abiertaWs) ?? null;
  const mesPrendido = mensualidad?.ok && mensualidad.config ? mensualidad.actual : null;
  // Con la mensualidad prendida, cada cuenta dice desde cuándo cuenta (en vez de quién paga: lo paga todo la agencia). El super
  // admin lo ve también con la mensualidad apagada: así corrige una fecha antes de prenderla.
  const delMes = useMemo(() => new Map(mensualidad?.ok && (mensualidad.config || superAdmin) ? mensualidad.clientes.map((c) => [c.ws, c]) : []), [mensualidad, superAdmin]);
  const enMes = (c: CuentaPartner) => delMes.get(c.ws) ?? null;
  // En pausa por la mensualidad de esta agencia (`enPausa`, lib/agencia-mes.ts): «Falta pagar», y al tocar «Inspeccionar», el aviso.
  const faltaPagar = useCallback((c: CuentaPartner) => !!delMes.get(c.ws)?.enPausa, [delMes]);
  const esPorPagar = useCallback((c: CuentaPartner) => porPagar(c) || faltaPagar(c), [faltaPagar]);
  const conteo = useMemo(() => {
    const n = (s: Segmento) => cuentas.filter((c) => enSegmento(c, s, esPorPagar)).length;
    return { todas: cuentas.length, activas: n('activas'), 'por-pagar': n('por-pagar'), revocadas: n('revocadas') } as Record<Segmento, number>;
  }, [cuentas, esPorPagar]);
  const kpis = useMemo(() => {
    const activas = cuentas.filter((c) => c.estado === 'aprobado');
    const pagasTu = activas.filter((c) => c.paga === 'agencia').length;
    return { activas: activas.length, porPagar: cuentas.filter(esPorPagar).length, pagasTu, paganEllos: activas.length - pagasTu };
  }, [cuentas, esPorPagar]);
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return cuentas.filter((c) => enSegmento(c, segmento, esPorPagar)
      && (!t || c.nombre.toLowerCase().includes(t) || (c.lead?.nombre ?? '').toLowerCase().includes(t)));
  }, [cuentas, q, segmento, esPorPagar]);
  // «No puedes entrar: falta pagar el mes de …» (14/11/2026): la cuenta que tocó «Inspeccionar» y no puede. Una a la vez.
  const [aviso, setAviso] = useState<number | null>(null);
  // «Pagar su mes» del aviso: baja hasta su renglón de la mensualidad y lo marca (`n` cambia en cada toque: vuelve a bajar).
  const [resaltar, setResaltar] = useState<{ ws: number; n: number } | null>(null);
  const hayMensualidad = !!mensualidad && (!mensualidad.ok || !!mensualidad.config || superAdmin);
  const irAPagar = (ws: number) => {
    setAviso(null);
    setAbiertaWs(null);
    // Sin la mensualidad en la pantalla (se prendió después de abrirla), la página la trae y baja hasta ella.
    if (!hayMensualidad) { window.location.href = '/agency?vista=mensualidad'; return; }
    setResaltar((r) => ({ ws, n: (r?.n ?? 0) + 1 }));
  };

  // La cuenta abierta en la URL (replace: el Atrás saca de la tab, no recorre fichas).
  useEffect(() => {
    try {
      const { pathname, search, hash } = window.location;
      const sp = new URLSearchParams(search);
      if (abierta) sp.set('cuenta', String(abierta.ws)); else sp.delete('cuenta');
      sp.delete('nuevo');
      const destino = `${pathname}${sp.toString() ? `?${sp}` : ''}${hash}`;
      if (destino !== pathname + search + hash) window.history.replaceState(null, '', destino);
    } catch { /* sin URL no se pierde nada */ }
  }, [abierta]);

  const cerrarFicha = useCallback(() => setAbiertaWs(null), []);
  const [cambiandoPlan, setCambiandoPlan] = useState(false);
  // Con confirmación (29/10/2026, revisión de plata): subir con tarjeta cobra la diferencia hoy; si no, Pro llega con el próximo cobro.
  const [planAConfirmar, setPlanAConfirmar] = useState<{ ws: number; plan: 'esencial' | 'pro'; nombre: string } | null>(null);
  const cambiarPlan = async (ws: number, plan: 'esencial' | 'pro') => {
    setPlanAConfirmar(null);
    setCambiandoPlan(true);
    const r = await cambiarPlanClienteAction(ws, plan).catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    setCambiandoPlan(false);
    if (r.ok) { show(r.resumen); router.refresh(); } else show(r.error, undefined, 'bad');
  };
  const cerrarAlta = useCallback(() => setAlta(null), []);
  const cerrarPago = useCallback(() => setPago(null), []);

  /**
   * «Reenviar el acceso» a quien maneja la cuenta. El permiso lo pregunta el server contra la cartera en el momento
   * (/api/agencia/reinvitar). El resultado es el del ENVÍO: un «listo» mudo no distingue «se le mandó» de «no salió».
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

  const entrar = async (ws: number) => {
    // Al repartidor (/inicio), como el login: entra al Ops Center del negocio, o a su wizard si no terminó (21/10/2026).
    if (superAdmin) { window.location.href = `/inicio?ws=${ws}`; return; }
    try {
      const j = await (await fetch('/api/agencia/entrar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ws }),
      })).json();
      // En pausa por su mensualidad (la ruta lo dice ANTES de dar la cookie): el aviso, ahí mismo. Aunque la pantalla no lo supiera.
      if (j?.pausa === 'falta-pagar') { setAviso(ws); return; }
      if (!j?.ok) { show(j?.error ?? 'No se pudo entrar.', undefined, 'bad'); return; }
      // Recarga dura: el contexto lo resuelve el server desde la cookie que acaba de quedar (CuentaDeMaKo, 27/09).
      window.location.href = '/inicio';
    } catch { show('No se pudo entrar.', undefined, 'bad'); }
  };

  /**
   * Lo que hace el botón de una cuenta (el de su fila, el de su ficha y el de su clic derecho). Cuál le toca lo decide
   * `accionDeCuenta` (menu-contextual-agency.ts): lo que paga la agencia, a la vista; lo que paga su cliente lo ve él (su
   * cartel): acá sólo se dice que espera.
   */
  const hacerAccion = (c: CuentaPartner) => {
    const a = accionDeCuenta(c, superAdmin);
    if (a === 'pagar' && c.cobro?.pagar) setPago({ url: c.cobro.pagar, renovacion: false, desde: null });
    else if (a === 'renovacion' && c.cobro?.renovacion) setPago({ url: c.cobro.renovacion.link, renovacion: true, desde: c.cobro.renovacion.desde });
    // Falta pagar su mes: el aviso al instante, sin ir al server (el super admin entra igual: él no está en pausa).
    else if (a === 'inspeccionar' && !superAdmin && faltaPagar(c)) setAviso(c.ws);
    else if (a === 'inspeccionar') void entrar(c.ws);
  };
  const avisoDe = (c: CuentaPartner): ReactNode => (aviso === c.ws ? <AvisoFaltaPagar nombre={c.nombre} onPagar={() => irAPagar(c.ws)} /> : null);
  const accionDe = (c: CuentaPartner): ReactNode => {
    const a = accionDeCuenta(c, superAdmin);
    if (!a) return null;
    return <button type="button" className={a === 'inspeccionar' ? 'ad-acc' : 'ad-acc ad-acc--fuerte'} onClick={() => hacerAccion(c)}>{ROTULO_ACCION_CUENTA[a]}</button>;
  };
  // El clic derecho (y mantener presionado) de una fila: abrir su ficha y su botón (menu-contextual-agency.ts).
  const menu = useMenuContextual<number>();
  const cuentaDelMenu = menu.abierto ? cuentas.find((c) => c.ws === menu.abierto?.de) ?? null : null;

  const acciones = (
    <span className="ad-cab">
      <Link className="ad-acc" href="/agency?landing=1">Ver la landing</Link>
      {puedeAbrir && <button type="button" className="ad-nuevo" onClick={() => setAlta({ leadId: null })}>+ Nuevo cliente</button>}
    </span>
  );

  return (
    <Pagina>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PageHeader titulo="Agency Dashboard" accion={acciones} />

      {!cartera.ok ? (
        <ErrorState titulo="No pude leer tus clientes" detalle={cartera.error} detalleTecnico={cartera.error} />
      ) : (
        <>
          <div className="ad-kpis">
            <Kpi valor={kpis.activas} rotulo={kpis.activas === 1 ? 'Cuenta activa' : 'Cuentas activas'} />
            {mesPrendido ? (
              <Kpi valor={new Set(mesPrendido.cuenta.lineas.flatMap((l) => (l.tipo === 'agencia' ? [] : [l.ws]))).size} rotulo="Clientes en tu mensualidad" />
            ) : (
              <Kpi valor={kpis.porPagar} rotulo="Esperando un pago" tono={kpis.porPagar ? 'warn' : undefined} />
            )}
            {/* Con la mensualidad prendida, lo que se paga este mes es su total (plan de la agencia y clientes que cuentan). */}
            {mesPrendido ? (
              <Kpi valor={usdMes(mesPrendido.cuenta.totalUsd)} rotulo={`Tu mensualidad · ${mesPrendido.pagado ? 'pagada' : mesPrendido.pagadoUsd > 0 ? 'a cuenta' : 'sin pagar'}`} tono={mesPrendido.pagado ? undefined : 'warn'} />
            ) : (
              <Kpi valor={usd != null ? usdTxt(kpis.pagasTu * usd) : kpis.pagasTu} rotulo={`Pagas tú al mes · ${kpis.pagasTu} ${kpis.pagasTu === 1 ? 'cuenta' : 'cuentas'}`} />
            )}
            {mesPrendido ? (
              <Kpi valor={[...delMes.values()].filter((f) => f.situacion.tipo === 'sin-costo').length} rotulo="Todavía sin costo" />
            ) : (
              <Kpi valor={kpis.paganEllos} rotulo={kpis.paganEllos === 1 ? 'La paga tu cliente' : 'Las pagan tus clientes'} />
            )}
          </div>

          {mensualidad && (
            <Mensualidad m={mensualidad} superAdmin={superAdmin} ver={verMensualidad} resaltar={resaltar}
              onAviso={(t, tono, deshacer) => show(t, deshacer, tono)} />
          )}

          {cuentas.length === 0 ? (
            <EmptyState titulo="Todavía no tienes clientes en tu Agency Dashboard"
              detalle="Ábrele su cuenta a un cliente, o llévalo desde tu CRM."
              accion={puedeAbrir ? { label: 'Nuevo cliente', onClick: () => setAlta({ leadId: null }) } : undefined} />
          ) : (
            <>
              <div className="ad-barra">
                <div className="ad-segs" role="tablist" aria-label="Qué cuentas ver">
                  {([['todas', 'Todas'], ['activas', 'Activas'], ['por-pagar', 'Por pagar'], ['revocadas', 'Revocadas']] as const)
                    .filter(([id]) => id === 'todas' || conteo[id] > 0 || segmento === id)
                    .map(([id, rotulo]) => (
                      <button key={id} type="button" role="tab" aria-selected={segmento === id} className="ad-seg" data-on={segmento === id}
                        onClick={() => setSegmento(id)}>
                        {rotulo}<span>{conteo[id]}</span>
                      </button>
                    ))}
                </div>
                <input className="ad-buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar un cliente" aria-label="Buscar un cliente" />
              </div>
              <div className={delMes.size ? 'ad-tabla ad-tabla--mes' : 'ad-tabla'} role="table" aria-label="Las cuentas de tus clientes">
                <div className="ad-th" role="row">
                  <span role="columnheader">Cliente</span><span role="columnheader">Estado</span><span role="columnheader">{delMes.size ? 'Mensualidad' : 'Quién paga'}</span>
                  <span role="columnheader">Equipo</span><span role="columnheader">Desde</span><span role="columnheader" />
                </div>
                {visibles.map((c) => {
                  const e = estadoDe(c, faltaPagar(c));
                  return (
                    <div key={c.ws} className="ad-fila" role="row" {...menu.propsDe(c.ws)}>
                      <button type="button" className="ad-abrir" onClick={() => setAbiertaWs(c.ws)} aria-label={`Abrir la cuenta de ${c.nombre}`}>
                        <Marca icono={null} foto={null} nombre={c.nombre} tam={36} color={colorDe(c.nombre)} />
                        <span className="ad-txt"><b>{c.nombre}</b><span>{c.plan ?? 'Cuenta de MaKo'}{c.lead ? ' · en tu CRM' : ''}</span></span>
                      </button>
                      <span className="ad-est" data-tono={e.tono} role="cell"><i />{e.texto}</span>
                      {delMes.size ? (
                        <span role="cell"><SituacionMes fila={enMes(c)} /></span>
                      ) : (
                        <span role="cell"><span className="ad-chip" data-paga={c.paga}>{ROTULO_QUIEN_PAGA[c.paga]}</span></span>
                      )}
                      <span className="ad-equipo" role="cell"><Caras equipo={c.equipo} /></span>
                      <span className="ad-desde" role="cell">{fecha(c.desde)}</span>
                      <span className="ad-fila-acc" role="cell">{accionDe(c)}</span>
                      {abiertaWs !== c.ws && avisoDe(c)}
                    </div>
                  );
                })}
                {visibles.length === 0 && <div className="ad-vacio">{q.trim() ? 'Ningún cliente se llama así.' : 'Ninguna cuenta en este grupo.'}</div>}
              </div>
            </>
          )}
        </>
      )}

      {planAConfirmar && (
        <ConfirmDialog titulo={`¿Pasar ${planAConfirmar.nombre} a MaKo ${planAConfirmar.plan === 'pro' ? 'Pro' : 'Esencial'}?`}
          detalle={planAConfirmar.plan === 'pro'
            ? 'Con tarjeta se cobra hoy la diferencia de este mes y tiene Pro en el acto. Con Mercado Pago, o si todavía no se cobró su renovación, tiene Pro desde su próximo cobro, que ya es al precio de Pro.'
            : 'Pasa a Esencial en el acto, con sus topes, y desde el próximo cobro se cobra el precio de Esencial.'}
          confirmLabel={planAConfirmar.plan === 'pro' ? 'Pasar a Pro' : 'Pasar a Esencial'}
          onCancel={() => setPlanAConfirmar(null)} onConfirm={() => void cambiarPlan(planAConfirmar.ws, planAConfirmar.plan)} />
      )}

      {menu.abierto && cuentaDelMenu && (
        <MenuContextual key={menu.abierto.n} punto={{ x: menu.abierto.x, y: menu.abierto.y }} porDedo={menu.abierto.porDedo}
          items={itemsCuentaAgency(accionDeCuenta(cuentaDelMenu, superAdmin))} etiqueta={`Acciones de ${cuentaDelMenu.nombre}`}
          onCerrar={menu.cerrar}
          onElegir={(id) => { if (id === 'abrir') setAbiertaWs(cuentaDelMenu.ws); else hacerAccion(cuentaDelMenu); }} />
      )}

      {abierta && (
        <Modal titulo={abierta.nombre} encabezado="Cuenta de MaKo" ancho={620} onCerrar={cerrarFicha}
          pie={<span className="ad-fila-acc">{avisoDe(abierta) ?? accionDe(abierta)}</span>}>
          <dl className="ad-datos">
            <div><dt>Estado</dt><dd>{estadoDe(abierta, faltaPagar(abierta)).texto}</dd></div>
            {enMes(abierta) ? (
              <div><dt>Mensualidad</dt><dd><SituacionMes fila={enMes(abierta)} />
                {superAdmin && abierta.estado !== 'revocado' && mensualidad?.ok && (
                  <CorregirReloj key={abierta.ws} fila={enMes(abierta)!} puede={mensualidad.puedeCorregir} onAviso={(t, tono, deshacer) => show(t, deshacer, tono)} />
                )}
              </dd></div>
            ) : (
              <div><dt>Quién paga</dt><dd>{ROTULO_QUIEN_PAGA[abierta.paga]}</dd></div>
            )}
            <div><dt>Desde</dt><dd>{fecha(abierta.desde)}</dd></div>
            {abierta.plan && (
              <div><dt>Plan</dt><dd>{abierta.plan}
                {/* Cambiar el plan (29/10/2026, lib/agencia-plan.ts): la agencia, con la cuenta no dada de baja. */}
                {abierta.estado !== 'revocado' && puedeAbrir && !superAdmin && abierta.planElegido && (
                  <button type="button" className="ad-acc" style={{ marginLeft: 10 }} disabled={cambiandoPlan}
                    onClick={() => setPlanAConfirmar({ ws: abierta.ws, plan: abierta.planId === 'pro' ? 'esencial' : 'pro', nombre: abierta.nombre })}>
                    {cambiandoPlan ? 'Cambiando…' : abierta.planId === 'pro' ? 'Pasar a Esencial' : 'Pasar a Pro'}
                  </button>
                )}
                {/* Las de antes del 29/10, sin el plan elegido, siguen como Pro hasta que la agencia lo elija (lib/plan-esencial-reglas.ts). */}
                {abierta.estado !== 'revocado' && puedeAbrir && !superAdmin && !abierta.planElegido && (['esencial', 'pro'] as const).map((pl) => (
                  <button key={pl} type="button" className="ad-acc" style={{ marginLeft: 10 }} disabled={cambiandoPlan}
                    onClick={() => setPlanAConfirmar({ ws: abierta.ws, plan: pl, nombre: abierta.nombre })}>
                    {cambiandoPlan ? 'Cambiando…' : pl === 'pro' ? 'Elegir Pro' : 'Elegir Esencial'}
                  </button>
                ))}
              </dd></div>
            )}
            <div><dt>En tu CRM</dt><dd>{abierta.lead ? <Link href={`/crm/${abierta.lead.id}`}>{abierta.lead.nombre} →</Link> : 'No está'}</dd></div>
            {abierta.cobro?.renovacion?.activada && <div><dt>Renovación</dt><dd>Activa</dd></div>}
          </dl>
          {abierta.paga === 'cliente' && abierta.cobro?.pagar && (
            <p className="ad-nota">Le aparece el pago al terminar su configuración. Cuando pague, puedes entrar a su cuenta.</p>
          )}
          {/* La plantilla de su modelo de negocio (MAU-01): sólo con la cuenta habilitada, como entrar a ella. */}
          {abierta.estado === 'aprobado' && (puedeAbrir || superAdmin) && (
            <>
              <h3 className="ad-sub">Plantilla del negocio</h3>
              <PlantillaDeModelo key={abierta.ws} clienteWs={abierta.ws} onError={(m) => show(m, undefined, 'bad')} />
            </>
          )}
          <h3 className="ad-sub">Equipo</h3>
          {abierta.estado === 'aprobado' && quienManeja && (puedeAbrir || superAdmin) && (
            <button type="button" className="ad-acc ad-reenviar" disabled={reenviando}
              onClick={() => void reenviar(abierta.ws, quienManeja)}>
              {reenviando ? 'Reenviando…' : `Reenviar el acceso a ${quienManeja.nombre}`}
            </button>
          )}
          {abierta.estado === 'aprobado' ? (
            <EquipoDeCuenta equipo={abierta.equipo} altas={abierta.altas} clienteWs={abierta.ws}
              puedePedir={puedeAbrir && !superAdmin} puedeSumar={superAdmin}
              onError={(m) => { if (m) show(m, undefined, 'bad'); }} onPedido={() => router.refresh()} />
          ) : (
            <p className="ad-nota">Cuando la cuenta quede habilitada, aquí ves quién entra.</p>
          )}
          {/* DAR DE BAJA (29/10/2026, lib/agencia-baja.ts): la agencia, nunca el super admin desde acá. */}
          {abierta.estado !== 'revocado' && puedeAbrir && !superAdmin && (
            <>
              <h3 className="ad-sub">Dar de baja</h3>
              <p className="ad-nota">Deja de cobrarse, dejas de administrarla y sus datos quedan guardados para tu cliente.</p>
              <DarDeBaja clienteWs={abierta.ws} nombre={abierta.nombre}
                onListo={(t) => { show(t); cerrarFicha(); router.refresh(); }} onError={(m) => show(m, undefined, 'bad')} />
            </>
          )}
        </Modal>
      )}

      {alta && (
        <ModalNuevoCliente leadId={alta.leadId} pagaSugerida={quienPagaSugerido(perfil)} usd={usd}
          onCerrar={cerrarAlta} onListo={() => router.refresh()} />
      )}

      {pago && typeof document !== 'undefined' && createPortal(
        <ModalPago pago={pago} onCerrar={cerrarPago} />,
        document.body,
      )}
      <Toast state={toast} onClose={clear} />
    </Pagina>
  );
}

/** Desde cuándo cuenta una cuenta en la mensualidad (lib/agencia-mes-reglas.ts, `textoDeSituacion`). */
function SituacionMes({ fila }: { fila: FilaMensualidad | null }) {
  if (!fila) return <span className="ad-gris">—</span>;
  const t = textoDeSituacion(fila.situacion);
  return <span className="ad-est ad-est--mes" data-tono={t.tono ?? undefined} title={fila.corregido ? `Sus 14 días corren desde el ${fila.corregido.slice(8, 10)}/${fila.corregido.slice(5, 7)} (fecha corregida)` : undefined}><i />{t.texto}</span>;
}

/** «No puedes entrar: falta pagar el mes de …» y su «Pagar su mes» (14/11/2026). Donde se tocó «Inspeccionar»: la fila o la ficha. */
function AvisoFaltaPagar({ nombre, onPagar }: { nombre: string; onPagar: () => void }) {
  return (
    <div className="ad-aviso" role="alert">
      <span>{avisoFaltaPagar(nombre)}</span>
      <button type="button" className="ad-acc ad-acc--fuerte" onClick={onPagar}>{ROTULO_ACCION_CUENTA.pagar}</button>
    </div>
  );
}

function Kpi({ valor, rotulo, tono }: { valor: ReactNode; rotulo: string; tono?: 'warn' }) {
  return <div className="ad-kpi" data-tono={tono}><b>{valor}</b><span>{rotulo}</span></div>;
}

/** Las caras del equipo (hasta tres) y cuántas más; «—» si no se pudo leer o si todavía no está habilitada. */
function Caras({ equipo }: { equipo: CuentaPartner['equipo'] }) {
  if (!equipo) return <span className="ad-gris">—</span>;
  if (equipo.length === 0) return <span className="ad-gris">Nadie</span>;
  return (
    <span className="ad-caras" title={equipo.map((u) => u.nombre).join(', ')}>
      {equipo.slice(0, 3).map((u) => <Marca key={u.id} icono={null} foto={u.foto} nombre={u.nombre} tam={24} color={colorDe(u.nombre)} />)}
      {equipo.length > 3 && <em>+{equipo.length - 3}</em>}
    </span>
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
    <Modal titulo={pago.renovacion ? 'Su renovación mensual' : 'Su primer mes'} encabezado="Agency Dashboard" ancho={440} onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="ad-acc" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar el link'}</button>
          <a className="ad-acc ad-acc--fuerte" href={pago.url} target="_blank" rel="noopener noreferrer">{pago.renovacion ? 'Autorizarla' : 'Pagar con mi tarjeta'}</a>
        </>
      }>
      <input className="ad-buscar" readOnly value={pago.url} aria-label="Link de pago" onFocus={(e) => e.currentTarget.select()} />
      <p className="ad-nota">
        {pago.renovacion
          ? `Se cobra sola cada mes${desde ? `, desde el ${desde}` : ''}. La autorizas una vez.`
          : 'Al pagarlo, la cuenta queda habilitada. Su mes corre desde que termine su configuración.'}
      </p>
    </Modal>
  );
}

/** Para el super admin sin cliente: todas las agencias, con sus cuentas por estado. Entra a cada una con su `?ws=`. */
export function AgencyPlataforma({ agencias, usd }: {
  agencias: Array<{ ws: number; nombre: string; cuentas: Record<EstadoCartera, number> }> | null;
  usd: number;
}) {
  const total = (k: EstadoCartera) => (agencias ?? []).reduce((a, x) => a + x.cuentas[k], 0);
  return (
    <Pagina>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PageHeader titulo="Agency Dashboard" accion={<Link className="ad-acc" href="/agency?landing=1">Ver la landing</Link>} />
      {agencias == null ? (
        <ErrorState titulo="No pude leer las agencias" detalle="Reintenta en un momento." />
      ) : (
        <>
          <div className="ad-kpis">
            <Kpi valor={agencias.length} rotulo={agencias.length === 1 ? 'Agencia' : 'Agencias'} />
            <Kpi valor={total('aprobado')} rotulo="Cuentas activas de sus clientes" />
            <Kpi valor={total('pendiente')} rotulo="Esperando un pago o tu firma" tono={total('pendiente') ? 'warn' : undefined} />
            <Kpi valor={usdTxt(usd)} rotulo="Por cuenta de cliente, al mes" />
          </div>
          {agencias.length === 0 ? (
            <EmptyState titulo="Todavía no hay agencias" detalle="Un negocio con MaKo Pro se suma desde su Agency Dashboard." />
          ) : (
            <div className="ad-tabla" role="table" aria-label="Las agencias">
              <div className="ad-th ad-th--ag" role="row">
                <span role="columnheader">Agencia</span><span role="columnheader">Activas</span><span role="columnheader">Esperando</span>
                <span role="columnheader">Revocadas</span><span role="columnheader" />
              </div>
              {agencias.map((a) => (
                <div key={a.ws} className="ad-fila ad-fila--ag" role="row">
                  <a className="ad-abrir" href={`/agency?ws=${a.ws}`}>
                    <Marca icono={null} foto={null} nombre={a.nombre} tam={36} color={colorDe(a.nombre)} />
                    <span className="ad-txt"><b>{a.nombre}</b><span>{a.cuentas.aprobado + a.cuentas.pendiente} {a.cuentas.aprobado + a.cuentas.pendiente === 1 ? 'cliente' : 'clientes'}</span></span>
                  </a>
                  <span className="ad-num" role="cell">{a.cuentas.aprobado}</span>
                  <span className="ad-num" role="cell">{a.cuentas.pendiente}</span>
                  <span className="ad-num ad-gris" role="cell">{a.cuentas.revocado}</span>
                  <span className="ad-fila-acc" role="cell"><a className="ad-acc" href={`/agency?ws=${a.ws}`}>Ver su dashboard</a></span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Pagina>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad.
const CSS = `
.ad-cab{ display:inline-flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
.ad-nuevo{ border:1px solid var(--primary); background:var(--primary); color:var(--on-primary, #fff); border-radius:10px;
  padding:9px 16px; font:inherit; font-size:14px; font-weight:650; cursor:pointer; white-space:nowrap; }
.ad-kpis{ display:grid; gap:12px; grid-template-columns:repeat(4, minmax(0, 1fr)); margin:0 0 22px; }
.ad-kpi{ background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:16px 18px; display:flex; flex-direction:column; gap:4px; min-width:0; }
.ad-kpi b{ font-size:30px; line-height:1.1; font-weight:800; letter-spacing:-.03em; color:var(--ink); }
.ad-kpi[data-tono="warn"] b{ color:var(--warn); }
.ad-kpi span{ font-size:var(--fs-sm); color:var(--dim); }
.ad-barra{ display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; margin:0 0 12px; }
.ad-segs{ display:inline-flex; gap:4px; padding:4px; border-radius:12px; background:var(--surface-2); border:1px solid var(--border); flex-wrap:wrap; }
.ad-seg{ border:0; background:none; border-radius:9px; padding:7px 12px; font:inherit; font-size:13.5px; font-weight:600; color:var(--dim);
  cursor:pointer; display:inline-flex; gap:7px; align-items:center; }
.ad-seg span{ font-size:12px; font-weight:700; padding:1px 7px; border-radius:999px; background:color-mix(in srgb, var(--ink) 7%, transparent); }
.ad-seg[data-on="true"]{ background:var(--surface); color:var(--ink); box-shadow:0 1px 3px rgba(18,21,27,.10); }
.ad-buscar{ width:100%; max-width:300px; box-sizing:border-box; border:1px solid var(--border); border-radius:10px; padding:9px 12px; font:inherit;
  font-size:14px; background:var(--surface); color:var(--ink); }
.ad-tabla{ border:1px solid var(--border); border-radius:16px; overflow:hidden; background:var(--surface); }
.ad-th, .ad-fila{ display:grid; grid-template-columns:minmax(220px, 2.2fr) minmax(140px, 1.2fr) 130px 110px 120px minmax(150px, auto); gap:12px; align-items:center; }
.ad-th--ag, .ad-fila--ag{ grid-template-columns:minmax(220px, 2.4fr) 100px 100px 100px minmax(150px, auto); }
.ad-th{ padding:10px 16px; background:var(--surface-2); border-bottom:1px solid var(--border); font-size:10.5px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--faint); font-weight:700; }
.ad-fila{ padding:4px 16px 4px 10px; border-bottom:1px solid var(--border); }
.ad-fila:last-child{ border-bottom:0; }
.ad-fila:hover{ background:color-mix(in srgb, var(--surface-2) 60%, transparent); }
.ad-abrir{ min-width:0; display:flex; align-items:center; gap:11px; padding:10px 6px; border:0; background:none; font:inherit; color:inherit;
  text-align:left; cursor:pointer; text-decoration:none; border-radius:10px; }
.ad-txt{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.ad-txt b{ font-size:14.5px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ad-txt span{ font-size:12.5px; color:var(--dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ad-est{ display:inline-flex; align-items:center; gap:8px; font-size:13.5px; font-weight:600; color:var(--ink); }
.ad-est i{ width:8px; height:8px; border-radius:50%; background:var(--faint); flex:none; }
.ad-est[data-tono="good"] i{ background:var(--good); }
.ad-est[data-tono="warn"] i{ background:var(--warn); }
.ad-est[data-tono="bad"] i{ background:var(--bad); }
.ad-est--mes{ font-weight:550; font-size:13px; white-space:nowrap; }
/* Con la mensualidad, su columna necesita lugar para «Sin costo hasta el 11/11» en un renglón; cede el equipo. Cabe en 1024. */
.ad-tabla--mes .ad-th, .ad-tabla--mes .ad-fila{ grid-template-columns:minmax(180px, 2fr) minmax(130px, 1fr) minmax(165px, 1.2fr) 80px 100px minmax(120px, auto); }
.ad-chip{ display:inline-block; font-size:12px; font-weight:650; padding:3px 10px; border-radius:999px; white-space:nowrap;
  background:var(--surface-2); color:var(--dim); }
.ad-chip[data-paga="agencia"]{ background:var(--primary-bg); color:var(--primary); }
.ad-caras{ display:inline-flex; align-items:center; }
.ad-caras > *{ margin-left:-6px; border-radius:50%; box-shadow:0 0 0 2px var(--surface); }
.ad-caras > *:first-child{ margin-left:0; }
.ad-caras em{ font-style:normal; font-size:12px; color:var(--dim); margin-left:6px; box-shadow:none; }
.ad-desde, .ad-gris{ font-size:13px; color:var(--dim); }
.ad-num{ font-size:14px; font-weight:650; font-variant-numeric:tabular-nums; }
.ad-fila-acc{ display:inline-flex; gap:8px; justify-content:flex-end; }
.ad-acc{ display:inline-flex; align-items:center; border:1px solid var(--border); background:var(--surface); color:var(--ink);
  border-radius:9px; padding:7px 12px; font:inherit; font-size:13px; font-weight:600; cursor:pointer; text-decoration:none; white-space:nowrap; }
.ad-acc:hover{ border-color:var(--primary); color:var(--primary); }
.ad-acc--fuerte{ border-color:var(--primary); background:var(--primary); color:var(--on-primary, #fff); }
.ad-acc--fuerte:hover{ color:var(--on-primary, #fff); }
.ad-vacio{ padding:18px 16px; color:var(--faint); font-size:13.5px; }
.ad-datos{ margin:0 0 14px; display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px 20px; }
.ad-datos dt{ font-size:12px; color:var(--dim); margin-bottom:2px; }
.ad-datos dd{ margin:0; font-size:14px; font-weight:600; color:var(--ink); }
.ad-sub{ margin:10px 0 4px; font-size:14px; font-weight:700; color:var(--ink); }
.ad-reenviar{ margin:4px 0 8px; }
.ad-nota{ margin:10px 0 0; font-size:13px; color:var(--dim); }
/* El aviso de «Inspeccionar» a un cliente en pausa: una línea con su botón, debajo de la fila (toda la fila de ancho) o en la ficha. */
.ad-aviso{ display:flex; align-items:center; justify-content:space-between; gap:8px 12px; flex-wrap:wrap; padding:7px 7px 7px 12px;
  border-radius:10px; background:var(--bad-bg); border:1px solid color-mix(in srgb, var(--bad) 28%, transparent); color:var(--ink);
  font-size:13.5px; font-weight:600; text-align:left; animation:ad-aviso-in .16s ease-out; }
.ad-fila > .ad-aviso{ grid-column:1 / -1; margin:0 0 8px 6px; }
@keyframes ad-aviso-in{ from{ opacity:0; transform:translateY(-3px); } to{ opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce){ .ad-aviso{ animation:none; } }
@media (max-width: 980px){
  .ad-kpis{ grid-template-columns:repeat(2, minmax(0, 1fr)); }
  .ad-th{ display:none; }
  .ad-fila, .ad-fila--ag, .ad-tabla--mes .ad-fila{ grid-template-columns:1fr auto; row-gap:4px; padding:8px 12px 12px 8px; }
  .ad-abrir{ grid-column:1 / -1; }
  .ad-est, .ad-num{ padding-left:6px; }
  .ad-equipo, .ad-desde{ display:none; }
  .ad-fila-acc{ grid-column:1 / -1; justify-content:flex-start; padding-left:6px; }
  .ad-buscar{ max-width:none; }
}
`;
