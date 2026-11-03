'use client';

// =============================================================================
// AgencyM — las cuentas de los clientes de la agencia, en el teléfono (25/10/2026)
// =============================================================================
// La misma lista que /agency en la computadora (lib/partners.ts arma las dos), con menos texto: arriba, los dos números
// que se miran todos los días; cada fila dice qué espera y quién paga; el toque abre la hoja con sus datos y entrar.
// Era PartnersM (app/m/partners), que se mudó con la cartera.
//
// ⚠️ EL TELÉFONO NO VENDE (T5, docs/tiendas-play-appstore.md, 3/11/2026): abrir la cuenta de un cliente y pagar su primer
//    mes o su renovación son compras de algo digital: quedan en la computadora, y acá sólo se ve el estado. Sin precios y
//    sin links de pago (tests/tiendas-telefono-no-vende.test.ts).

import { useState } from 'react';
import { DarDeBaja } from '@/app/agency/DarDeBaja';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import {
  CabeceraM, FilaDatoM, FilaM, ListaM, PieM, PildoraM, SeccionM, SegmentadoM, SheetM, VacioM, useToastM, type TonoPildora,
} from '@/app/m/_ui';
import { RUTA_MAS } from '@/lib/movil-rutas';
import { ROTULO_CARTERA, type EstadoCartera } from '@/lib/agencia-cartera';
import { ROTULO_QUIEN_PAGA } from '@/lib/agency-reglas';
import type { CuentaPartner } from '@/lib/partners';
import { aplicarPlantillaAction } from '@/app/agency/actions';
import { MODELOS_CLIENTE, PLANTILLAS_MODELO, type ModeloCliente } from '@/lib/plantillas-modelo-reglas';
import { avisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';

function estadoDe(c: CuentaPartner): { texto: string; tono: TonoPildora } {
  if (c.cobro?.pagar) return { texto: c.paga === 'cliente' ? 'Esperando su pago' : 'Falta pagar', tono: 'warn' };
  if (c.cobro?.renovacion && !c.cobro.renovacion.activada) return { texto: 'Renovación pendiente', tono: 'warn' };
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

export function AgencyM({ cuentas, puedeAbrir, superAdmin, cuentaInicial }: {
  cuentas: CuentaPartner[];
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
  // La plantilla de su modelo de negocio (MAU-01).
  const [plantilla, setPlantilla] = useState(false);
  const [modelo, setModelo] = useState<ModeloCliente>('tienda-b2c');
  const [aplicando, setAplicando] = useState(false);
  const [plantillaHecha, setPlantillaHecha] = useState<string | null>(null);
  const aplicarPlantilla = async () => {
    if (!c || aplicando) return;
    setAplicando(true);
    try {
      const r = await aplicarPlantillaAction(c.ws, modelo);
      if (r.ok) setPlantillaHecha(r.resumen); else toast(r.error);
    } catch { toast('No pude aplicar la plantilla.'); } finally { setAplicando(false); }
  };

  const activas = cuentas.filter((x) => x.estado === 'aprobado').length;
  const porPagar = cuentas.filter((x) => !!x.cobro?.pagar || (!!x.cobro?.renovacion && !x.cobro.renovacion.activada)).length;

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
        <div data-tono={porPagar ? 'warn' : undefined}><b>{porPagar}</b><span>Pendientes</span></div>
      </div>
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
          <PieM>
            {c.estado === 'aprobado' || superAdmin ? (
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
            {c.estado === 'aprobado' && (puedeAbrir || superAdmin) && (
              <FilaDatoM k="Plantilla" v="Aplicar" azul onClick={() => { setPlantilla(true); setPlantillaHecha(null); }} />
            )}
          </ListaM>
        )}
        {/* DAR DE BAJA (29/10/2026, lib/agencia-baja.ts), como en la computadora: la agencia, nunca el super admin desde acá. */}
        {c && c.estado !== 'revocado' && puedeAbrir && !superAdmin && (
          <div style={{ padding: '12px 16px' }}>
            <DarDeBaja clienteWs={c.ws} nombre={c.nombre}
              onListo={(t) => { toast(t); setAbierta(false); setTimeout(() => router.refresh(), 400); }} onError={(m) => toast(m)} />
          </div>
        )}
      </SheetM>

      {/* La plantilla de su modelo de negocio (MAU-01, app/agency/PlantillaDeModelo.tsx en la computadora). */}
      <SheetM abierto={plantilla && c != null} onCerrar={() => setPlantilla(false)} titulo="Plantilla del negocio" ocupado={aplicando}
        pie={plantillaHecha ? undefined : (
          <PieM consecuencia="Funnel, tablero y la guía para cargar sus datos, en su cuenta.">
            <Button variant="primary" size="lg" full disabled={aplicando} onClick={() => void aplicarPlantilla()}>
              {aplicando ? 'Aplicando…' : 'Aplicar plantilla'}
            </Button>
          </PieM>
        )}>
        {plantillaHecha ? (
          <p className="m-agency-nota">{plantillaHecha}</p>
        ) : (
          <div className="m-agency-form">
            <SegmentadoM<ModeloCliente> etiqueta="Modelo de su negocio" valor={modelo} onCambio={setModelo}
              opciones={MODELOS_CLIENTE.map((id) => ({ id, label: PLANTILLAS_MODELO[id].nombre }))} />
            <p className="m-agency-nota">{PLANTILLAS_MODELO[modelo].para}</p>
          </div>
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
