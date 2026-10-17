'use client';

// =============================================================================
// PartnersM — las cuentas de los clientes de la agencia, en el teléfono
// =============================================================================
// La misma lista que /partners en la computadora (lib/partners.ts arma las dos), con menos texto: cada fila dice qué
// espera de la agencia; el toque abre la hoja con sus datos y LA acción que le toca (pagar su primer mes, activar la
// renovación o entrar). «+ Nuevo cliente» abre la misma alta que la computadora (`llevarAPartnersAction`).

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button, ButtonLink } from '@/app/_ui/Button';
import {
  CabeceraM, FilaDatoM, FilaM, ListaM, PieM, PildoraM, SeccionM, SheetM, VacioM, useToastM, type TonoPildora,
} from '@/app/m/_ui';
import { RUTA_MAS } from '@/lib/movil-rutas';
import { emailUtilizable } from '@/lib/agencia-altas';
import { ROTULO_CARTERA } from '@/lib/agencia-cartera';
import type { CuentaPartner } from '@/lib/partners';
import { llevarAPartnersAction } from '@/app/partners/actions';
import { avisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';

function estadoDe(c: CuentaPartner): { texto: string; tono: TonoPildora } {
  if (c.cobro?.pagar) return { texto: 'Falta pagar', tono: 'warn' };
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

export function PartnersM({ cuentas, usd }: { cuentas: CuentaPartner[]; usd: number }) {
  const router = useRouter();
  const toast = useToastM();
  // La hoja de una cuenta: la ÚLTIMA abierta (su contenido se queda mientras la hoja baja).
  const [ws, setWs] = useState<number | null>(null);
  const [abierta, setAbierta] = useState(false);
  const c = cuentas.find((x) => x.ws === ws) ?? null;
  // El alta.
  const [alta, setAlta] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // Lo que dejó el alta. ⚠️ Sin link de pago NO es un error (`sinLink`, lib/partners.ts): la cuenta ya se abrió y espera
  // la aprobación. Por eso «hecho» es su propio estado y no `link !== null`: con el link vacío el formulario volvía a
  // aparecer y un segundo envío chocaba con el email ya usado.
  const [hecho, setHecho] = useState<{ link: string | null } | null>(null);
  const [mal, setMal] = useState<string | null>(null);

  const abrirAlta = () => { setNombre(''); setEmail(''); setHecho(null); setMal(null); setAlta(true); };
  const crear = async () => {
    if (!nombre.trim() || !emailUtilizable(email) || ocupado) return;
    setOcupado(true);
    setMal(null);
    const r = await llevarAPartnersAction({ nombre, email }).catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    setOcupado(false);
    if (!r.ok) { setMal(r.error); return; }
    setHecho({ link: r.link });
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
      // El toast de /m es corto (3-4 palabras): el detalle del envío, sólo si no salió.
      if (!j.ok) { toast('No se pudo reenviar'); return; }
      toast(avisoInvitacion(j.invitacion, a.email).tono === 'ok' ? 'Acceso reenviado' : 'No salió el mail');
    } catch { toast('No se pudo reenviar'); } finally { setReenviando(false); }
  };

  const entrar = async (clienteWs: number) => {
    try {
      const j = await (await fetch('/api/agencia/entrar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ws: clienteWs }),
      })).json();
      if (!j?.ok) { toast(j?.error ?? 'No se pudo entrar'); return; }
      window.location.href = '/general';
    } catch { toast('No se pudo entrar'); }
  };

  return (
    <>
      {/* Sin fila en More todavía (la key `partners` la suma el chat Sidebar): el título y el «volver» los pone acá. */}
      <CabeceraM titulo="MaKo Partners" padre={{ href: RUTA_MAS, label: 'More' }} />
      <div className="m-partners-arriba">
        <Button variant="primary" size="lg" full onClick={abrirAlta}>Nuevo cliente</Button>
      </div>
      {cuentas.length === 0 ? (
        <VacioM frase="Todavía no tienes clientes en MaKo Partners." />
      ) : (
        <SeccionM titulo="Tus clientes">
          <ListaM>
            {cuentas.map((x) => {
              const e = estadoDe(x);
              return (
                <FilaM key={x.ws} avatar={x.nombre} titulo={x.nombre} segunda={`${x.plan ?? 'Cuenta de MaKo'} · desde ${fecha(x.desde)}`}
                  pill={<PildoraM tono={e.tono}>{e.texto}</PildoraM>} onClick={() => { setWs(x.ws); setAbierta(true); }} />
              );
            })}
          </ListaM>
        </SeccionM>
      )}

      <SheetM abierto={abierta} onCerrar={() => setAbierta(false)} titulo={c?.nombre ?? 'Cuenta'}
        pie={c ? (
          <PieM consecuencia={c.cobro?.pagar ? 'Al pagarlo, la cuenta queda habilitada.' : undefined}>
            {c.cobro?.pagar ? (
              <ButtonLink variant="primary" size="lg" full href={c.cobro.pagar} newTab>Pagar su primer mes</ButtonLink>
            ) : c.cobro?.renovacion && !c.cobro.renovacion.activada ? (
              <ButtonLink variant="primary" size="lg" full href={c.cobro.renovacion.link} newTab>Activar la renovación</ButtonLink>
            ) : c.estado === 'aprobado' ? (
              <Button variant="primary" size="lg" full onClick={() => void entrar(c.ws)}>Entrar a su cuenta</Button>
            ) : null}
          </PieM>
        ) : undefined}>
        {c && (
          <ListaM>
            <FilaDatoM k="Estado" v={estadoDe(c).texto} />
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

      <SheetM abierto={alta} onCerrar={() => setAlta(false)} titulo={hecho === null ? 'Nuevo cliente' : hecho.link ? 'Su primer mes' : 'Cuenta abierta'} ocupado={ocupado}
        pie={hecho === null ? (
          <PieM consecuencia={`Se crea su cuenta de MaKo: US$${usd} al mes.`}>
            <Button variant="primary" size="lg" full disabled={!nombre.trim() || !emailUtilizable(email) || ocupado} onClick={() => void crear()}>
              {ocupado ? 'Abriendo…' : 'Abrir su cuenta'}
            </Button>
          </PieM>
        ) : hecho.link ? (
          <PieM consecuencia="Al pagarlo, la cuenta queda habilitada.">
            <ButtonLink variant="primary" size="lg" full href={hecho.link} newTab>Pagar su primer mes</ButtonLink>
          </PieM>
        ) : undefined}>
        {hecho === null ? (
          <div className="m-partners-form">
            <label className="m-partners-lab" htmlFor="m-partners-nombre">Nombre de su negocio</label>
            <input id="m-partners-nombre" className="m-partners-in" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <label className="m-partners-lab" htmlFor="m-partners-email">Email de quien la va a usar</label>
            <input id="m-partners-email" className="m-partners-in" type="email" inputMode="email" value={email}
              onChange={(e) => setEmail(e.target.value)} />
            {mal && <p className="m-partners-mal" role="alert">{mal}</p>}
          </div>
        ) : hecho.link ? null : (
          <p className="m-partners-nota">Le llega su acceso cuando MaKo la habilite.</p>
        )}
      </SheetM>
    </>
  );
}
