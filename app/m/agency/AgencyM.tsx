'use client';

// =============================================================================
// AgencyM — las cuentas de los clientes de la agencia, en el teléfono (25/10/2026)
// =============================================================================
// La misma lista que /agency en la computadora (lib/partners.ts arma las dos), con menos texto: arriba, los dos números
// que se miran todos los días; cada fila dice qué espera y quién paga; el toque abre la hoja con sus datos y LA acción
// que le toca (pagar su primer mes, activar la renovación o entrar). «Nuevo cliente» abre la misma alta que la
// computadora, con quién paga (`abrirCuentaClienteAction`). Era PartnersM (app/m/partners), que se mudó con la cartera.

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button, ButtonLink } from '@/app/_ui/Button';
import {
  CabeceraM, FilaDatoM, FilaM, ListaM, PieM, PildoraM, SeccionM, SegmentadoM, SheetM, VacioM, useToastM, type TonoPildora,
} from '@/app/m/_ui';
import { RUTA_MAS } from '@/lib/movil-rutas';
import { emailUtilizable } from '@/lib/agencia-altas';
import { ROTULO_CARTERA, type EstadoCartera } from '@/lib/agencia-cartera';
import { ROTULO_QUIEN_PAGA, type QuienPaga } from '@/lib/agency-reglas';
import type { CuentaPartner } from '@/lib/partners';
import { abrirCuentaClienteAction } from '@/app/agency/actions';
import { avisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

function estadoDe(c: CuentaPartner): { texto: string; tono: TonoPildora } {
  if (c.cobro?.pagar) return { texto: c.paga === 'cliente' ? 'Esperando su pago' : 'Falta pagar', tono: 'warn' };
  if (c.cobro?.renovacion && !c.cobro.renovacion.activada) return { texto: 'Activar renovación', tono: 'warn' };
  // Habilitada y sin nadie adentro (`[]` = leí y no hay nadie; `null` = no pude leer). Igual que la computadora.
  if (c.estado === 'aprobado' && c.equipo?.length === 0) return { texto: 'Nadie puede entrar', tono: 'warn' };
  if (c.estado === 'aprobado') return { texto: 'Activa', tono: 'good' };
  if (c.estado === 'revocado') return { texto: ROTULO_CARTERA.revocado, tono: 'bad' };
  return { texto: ROTULO_CARTERA.pendiente, tono: 'neutro' };
}

const fecha = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
};

export function AgencyM({ cuentas, usd, pagaSugerida, puedeAbrir, superAdmin, cuentaInicial }: {
  cuentas: CuentaPartner[];
  usd: number;
  pagaSugerida: QuienPaga;
  puedeAbrir: boolean;
  superAdmin: boolean;
  cuentaInicial: number | null;
}) {
  const router = useRouter();
  const toast = useToastM();
  // La hoja de una cuenta: la ÚLTIMA abierta (su contenido se queda mientras la hoja baja).
  const [ws, setWs] = useState<number | null>(cuentaInicial);
  const [abierta, setAbierta] = useState(cuentaInicial != null);
  const c = cuentas.find((x) => x.ws === ws) ?? null;
  // El alta.
  const [alta, setAlta] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [paga, setPaga] = useState<QuienPaga>(pagaSugerida);
  const [ocupado, setOcupado] = useState(false);
  // ⚠️ «hecho» es su propio estado y no `link !== null`: sin link la cuenta YA se abrió, y un segundo envío chocaría con el
  // email ya usado (la lección de PartnersM).
  // ⚠️ «PAGA TU CLIENTE» SIN LINK DEL PRIMER MES (25/10/2026): su acceso NO salió (lib/partners.ts) y la cuenta espera la
  // firma de MaKo, como si pagara la agencia: es «Le llega su acceso cuando MaKo la habilite», igual que la computadora.
  // Decía «Le llegó su acceso. Al terminar su configuración, le aparece el pago.»: el acceso no salió y no hay cobro. Y el
  // pie del alta dice los dos caminos: mientras MaKo no pueda cobrarle, toda alta con «Mi cliente» queda pedida.
  const [hecho, setHecho] = useState<{ link: string | null; paga: QuienPaga; acceso: string | null } | null>(null);
  const [mal, setMal] = useState<string | null>(null);

  const activas = cuentas.filter((x) => x.estado === 'aprobado').length;
  const porPagar = cuentas.filter((x) => !!x.cobro?.pagar || (!!x.cobro?.renovacion && !x.cobro.renovacion.activada)).length;

  const abrirAlta = () => { setNombre(''); setEmail(''); setPaga(pagaSugerida); setHecho(null); setMal(null); setAlta(true); };
  const crear = async () => {
    if (!nombre.trim() || !emailUtilizable(email) || ocupado) return;
    setOcupado(true);
    setMal(null);
    const r = await abrirCuentaClienteAction({ nombre, email, paga }).catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    setOcupado(false);
    if (!r.ok) { setMal(r.error); return; }
    const acceso = r.paga === 'cliente' && r.acceso ? avisoInvitacion(r.acceso, email.trim()).texto : null;
    setHecho({ link: r.link, paga: r.paga, acceso });
    toast('Cuenta abierta');
    // Diferido: abrir o cerrar una hoja toca el historial (app/m/_ui/LEEME.md, «Tanda 3»).
    setTimeout(() => router.refresh(), 400);
  };

  // «Reenviar el acceso» a quien maneja la cuenta, como en la computadora (/api/agencia/reinvitar decide el permiso).
  const quien = c?.equipo?.find((u) => u.rol === 'admin') ?? c?.equipo?.[0] ?? null;
  const [reenviando, setReenviando] = useState(false);
  const reenviar = async (clienteWs: number, a: { id: number; email: string }) => {
    if (reenviando) return;
    setReenviando(true);
    try {
      const j = (await (await fetch('/api/agencia/reinvitar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clienteWs, usuarioId: a.id }),
      })).json()) as { ok?: boolean; error?: string; invitacion?: ResultadoInvitacion };
      if (!j.ok) { toast('No se pudo reenviar'); return; }
      toast(avisoInvitacion(j.invitacion, a.email).tono === 'ok' ? 'Acceso reenviado' : 'No salió el mail');
    } catch { toast('No se pudo reenviar'); } finally { setReenviando(false); }
  };

  const entrar = async (clienteWs: number) => {
    if (superAdmin) { window.location.href = `/inicio?ws=${clienteWs}`; return; }
    try {
      const j = await (await fetch('/api/agencia/entrar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ws: clienteWs }),
      })).json();
      if (!j?.ok) { toast(j?.error ?? 'No se pudo entrar'); return; }
      window.location.href = '/inicio';
    } catch { toast('No se pudo entrar'); }
  };

  return (
    <>
      <CabeceraM titulo="Agency Dashboard" padre={{ href: RUTA_MAS, label: 'More' }} />
      <div className="m-agency-kpis">
        <div><b>{activas}</b><span>{activas === 1 ? 'Activa' : 'Activas'}</span></div>
        <div data-tono={porPagar ? 'warn' : undefined}><b>{porPagar}</b><span>Esperando un pago</span></div>
      </div>
      {puedeAbrir && (
        <div className="m-agency-arriba">
          <Button variant="primary" size="lg" full onClick={abrirAlta}>Nuevo cliente</Button>
        </div>
      )}
      {cuentas.length === 0 ? (
        <VacioM frase="Todavía no tienes clientes en tu Agency Dashboard." />
      ) : (
        <SeccionM titulo="Tus clientes">
          <ListaM>
            {cuentas.map((x) => {
              const e = estadoDe(x);
              return (
                <FilaM key={x.ws} avatar={x.nombre} titulo={x.nombre} segunda={`${ROTULO_QUIEN_PAGA[x.paga]} · desde ${fecha(x.desde)}`}
                  pill={<PildoraM tono={e.tono}>{e.texto}</PildoraM>} onClick={() => { setWs(x.ws); setAbierta(true); }} />
              );
            })}
          </ListaM>
        </SeccionM>
      )}

      <SheetM abierto={abierta && c != null} onCerrar={() => setAbierta(false)} titulo={c?.nombre ?? 'Cuenta'}
        pie={c ? (
          <PieM consecuencia={c.cobro?.pagar && c.paga === 'agencia' ? 'Al pagarlo, la cuenta queda habilitada.' : undefined}>
            {c.cobro?.pagar && c.paga === 'agencia' ? (
              <ButtonLink variant="primary" size="lg" full href={c.cobro.pagar} newTab>Pagar su primer mes</ButtonLink>
            ) : c.cobro?.renovacion && !c.cobro.renovacion.activada && c.paga === 'agencia' ? (
              <ButtonLink variant="primary" size="lg" full href={c.cobro.renovacion.link} newTab>Activar la renovación</ButtonLink>
            ) : c.estado === 'aprobado' || superAdmin ? (
              <Button variant="primary" size="lg" full onClick={() => void entrar(c.ws)}>Entrar a su cuenta</Button>
            ) : null}
          </PieM>
        ) : undefined}>
        {c && (
          <ListaM>
            <FilaDatoM k="Estado" v={estadoDe(c).texto} />
            <FilaDatoM k="Quién paga" v={ROTULO_QUIEN_PAGA[c.paga]} />
            <FilaDatoM k="Desde" v={fecha(c.desde)} />
            {c.plan && <FilaDatoM k="Plan" v={c.plan} />}
            <FilaDatoM k="Equipo" v={c.equipo ? `${c.equipo.length} ${c.equipo.length === 1 ? 'persona' : 'personas'}` : '—'} />
            <FilaDatoM k="En tu CRM" v={c.lead ? c.lead.nombre : 'No está'} href={c.lead ? `/m/crm/${c.lead.id}` : undefined} />
            {c.estado === 'aprobado' && quien && (
              <FilaDatoM k="Acceso" v={reenviando ? 'Reenviando…' : `Reenviar a ${quien.nombre}`} azul
                onClick={() => void reenviar(c.ws, quien)} />
            )}
          </ListaM>
        )}
      </SheetM>

      <SheetM abierto={alta} onCerrar={() => setAlta(false)}
        titulo={hecho === null ? 'Nuevo cliente' : hecho.paga === 'agencia' && hecho.link ? 'Su primer mes' : 'Cuenta abierta'} ocupado={ocupado}
        pie={hecho === null ? (
          <PieM consecuencia={paga === 'agencia' ? `Pagas tú: US$${usd} al mes.` : `Paga tu cliente, US$${usd} al mes: si MaKo ya puede cobrarle, al terminar su configuración; si no, su cuenta espera a que MaKo la habilite.`}>
            <Button variant="primary" size="lg" full disabled={!nombre.trim() || !emailUtilizable(email) || ocupado} onClick={() => void crear()}>
              {ocupado ? 'Abriendo…' : 'Abrir su cuenta'}
            </Button>
          </PieM>
        ) : hecho.paga === 'agencia' && hecho.link ? (
          <PieM consecuencia="Al pagarlo, la cuenta queda habilitada.">
            <ButtonLink variant="primary" size="lg" full href={hecho.link} newTab>Pagar con mi tarjeta</ButtonLink>
          </PieM>
        ) : undefined}>
        {hecho === null ? (
          <div className="m-agency-form">
            <label className="m-agency-lab" htmlFor="m-agency-nombre">Nombre de su negocio</label>
            <input id="m-agency-nombre" className="m-agency-in" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <label className="m-agency-lab" htmlFor="m-agency-email">Email de quien la va a usar</label>
            <input id="m-agency-email" className="m-agency-in" type="email" inputMode="email" value={email}
              onChange={(e) => setEmail(e.target.value)} />
            <span className="m-agency-lab">¿Quién paga su cuenta?</span>
            <SegmentadoM<QuienPaga> etiqueta="Quién paga su cuenta" valor={paga} onCambio={setPaga}
              opciones={[{ id: 'agencia', label: 'Yo, ahora' }, { id: 'cliente', label: 'Mi cliente' }]} />
            {mal && <p className="m-agency-mal" role="alert">{mal}<ReportarASoporte /></p>}
          </div>
        ) : hecho.paga === 'cliente' && hecho.link ? (
          <p className="m-agency-nota">{hecho.acceso ?? 'Le llegó su acceso.'} Al terminar su configuración, le aparece el pago.</p>
        ) : hecho.link ? null : (
          <p className="m-agency-nota">Le llega su acceso cuando MaKo la habilite.</p>
        )}
      </SheetM>
    </>
  );
}

/** Para el super admin sin cliente: las agencias, y entra a cada una con su `?ws=`. */
export function AgenciasM({ agencias }: { agencias: Array<{ ws: number; nombre: string; cuentas: Record<EstadoCartera, number> }> }) {
  if (!agencias.length) return <VacioM frase="Todavía no hay agencias." />;
  return (
    <SeccionM titulo="Agencias">
      <ListaM>
        {agencias.map((a) => (
          <FilaM key={a.ws} avatar={a.nombre} titulo={a.nombre}
            segunda={`${a.cuentas.aprobado} activas · ${a.cuentas.pendiente} esperando`} href={`/m/agency?ws=${a.ws}`} />
        ))}
      </ListaM>
    </SeccionM>
  );
}
