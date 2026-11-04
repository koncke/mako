// =============================================================================
// /cuenta-pausada — el negocio de esta sesión está pausado (17/10/2026)
// =============================================================================
// A dónde manda `requireSesion` (lib/tab-access.ts) a quien entra a un negocio pausado: por el super admin desde /admin,
// o porque se terminó lo pagado (lib/plan-acceso.ts). Dice por qué y qué hacer, en vez de una app vacía. No pasa por
// `requireSesion` (sería un círculo): mira la sesión y, si el negocio NO está pausado, vuelve a la app.

import { redirect } from 'next/navigation';
import { getRolWsEfectivo, negocioPausadoDeLaSesion } from '@/lib/workspace';
import { corteDe } from '@/lib/plan-acceso';
import { leOfrecePagar, textoDelCorte } from '@/lib/plan-acceso-reglas';
import { EMAIL_MAKO } from '@/lib/app-url';
import { ButtonLink } from '@/app/_ui/Button';
import { contextoDeAgencia } from '@/lib/agencia';
import { SalirDeLaCuenta } from './SalirDeLaCuenta';
import { PagarPlan } from './PagarPlan';
import { agenciaDelCobro, deudaDe } from '@/lib/plan-deuda';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { headers } from 'next/headers';
import { esTelefono } from '@/lib/telefono';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CuentaPausadaPage() {
  if ((await getRolWsEfectivo()) == null) redirect('/login');
  const ws = await negocioPausadoDeLaSesion();
  if (ws == null) redirect('/inicio');
  const [corte, cliente] = await Promise.all([corteDe(ws).catch(() => null), contextoDeAgencia().catch(() => null)]);
  // La AGENCIA que miraba a un cliente pausado no está «pausada»: el pausado es el cliente, y ella vuelve a lo suyo.
  const esAgencia = cliente != null;
  // La cuenta que paga su agencia (31/10/2026, ticket #37): el cliente no debe nada, así que tampoco se le ofrece pagar.
  const quienPaga = !esAgencia && corte?.vigente ? await agenciaDelCobro(corte.cobroId).then((a) => a?.paga ?? null, () => 'no-se' as const) : null;
  const t = textoDelCorte(corte?.vigente && quienPaga !== 'no-se' ? corte : null, { paraAgencia: esAgencia, pagaSuAgencia: quienPaga === 'agencia' });
  // PAGAR Y VOLVER (23/10/2026): con un corte por la pasarela, lo que se debe y el botón (lib/plan-deuda.ts). La agencia que
  // mira a un cliente no paga desde acá: lo resuelve en MaKo Partners. Una pausa a mano (sin corte) sigue siendo «escríbenos».
  // ⚠️ EN UN TELÉFONO NO SE OFRECE PAGAR (T5, docs/tiendas-play-appstore.md): ni el botón ni lo que se debe ni el texto que manda a
  // elegir un plan. Dice que está pausada, y sale por «Escribir a MaKo».
  const telefono = esTelefono((await headers()).get('user-agent'));
  const porPago = !telefono && leOfrecePagar({ esAgencia, corte, quienPaga });
  const d = porPago ? await deudaDe(ws).catch(() => null) : null;
  const debe = d?.deuda?.monto != null && d.deuda.moneda ? formatoMonto(d.deuda.monto, d.deuda.moneda) : null;
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '24px 16px', background: 'var(--bg)' }}>
      <section style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 24px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{t.titulo}</h1>
        <p style={{ margin: '12px 0 22px', fontSize: 'var(--fs-md)', lineHeight: 1.5, color: 'var(--dim)' }}>{telefono ? 'Tus datos están guardados.' : t.detalle}</p>
        {debe && <p style={{ margin: '-8px 0 18px', fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)' }}>Pendiente: {debe}</p>}
        {porPago
          ? <PagarPlan accion={d?.deuda ? 'deuda' : 'reactivar'} texto={d?.deuda ? 'Pagar y volver a entrar' : 'Reactivar mi plan'} />
          : <ButtonLink href={`mailto:${EMAIL_MAKO}`} variant="primary">Escribir a MaKo</ButtonLink>}
        <div style={{ marginTop: 14 }}><SalirDeLaCuenta esAgencia={esAgencia} /></div>
      </section>
    </main>
  );
}
