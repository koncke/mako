'use client';

// =============================================================================
// «Tu plan» — el plan de MaKo del negocio, y cómo administrarlo (15/10/2026)
// =============================================================================
// Copia de lo que hace todo SaaS: el plan, y un lugar para cancelarlo uno mismo. Si lo cobra Stripe, su PORTAL de
// cliente (cancelar al final del período, cambiar la tarjeta, ver las facturas); si lo cobra Mercado Pago, que no tiene
// portal, un botón que lo cancela con confirmación; si no se cobra por la pasarela, a quién escribirle.

import { useState } from 'react';
import { ConfirmDialog } from '../../_components/ChatItemMenu';
import { CuerpoGrupo, FilaAjustes, GrupoAjustes } from '../../_ui/Ajustes';
import { abrirPortalPlanAction, cancelarPlanAction } from './actions';

export type SuscripcionVisible = { proveedor: 'stripe' | 'mercadopago'; monto: string; cancelada: boolean } | null;

export function PlanPanel({ plan, suscripcion, emailMako }: { plan: string; suscripcion: SuscripcionVisible; emailMako: string }) {
  const [corriendo, setCorriendo] = useState(false);
  const [preguntar, setPreguntar] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const abrirPortal = async () => {
    setCorriendo(true); setAviso(null);
    const r = await abrirPortalPlanAction().catch(() => ({ ok: false as const, error: 'No pudimos abrir el portal.' }));
    if (r.ok) { window.location.href = r.url; return; }
    setAviso({ ok: false, texto: r.error }); setCorriendo(false);
  };

  const cancelar = async () => {
    setPreguntar(false); setCorriendo(true); setAviso(null);
    const r = await cancelarPlanAction().catch(() => ({ ok: false, resumen: 'No pudimos cancelarlo.' }));
    setAviso({ ok: r.ok, texto: r.ok ? 'Plan cancelado.' : r.resumen }); setCorriendo(false);
  };

  const estado = !suscripcion ? undefined : suscripcion.cancelada ? 'Cancelado' : 'Activo';
  return (
    <>
      <GrupoAjustes>
        <FilaAjustes icono="repetir" titulo={plan} detalle={suscripcion ? `${suscripcion.monto} por mes` : 'Acordado con MaKo'}
          tono={suscripcion ? (suscripcion.cancelada ? 'warn' : 'good') : undefined} estado={estado} apilada />
        {suscripcion?.proveedor === 'stripe' && (
          <FilaAjustes icono="dinero" titulo="Tarjeta, facturas y cancelar" detalle="En el portal de Stripe."
            onClick={corriendo ? undefined : abrirPortal} apilada />
        )}
        {suscripcion?.proveedor === 'mercadopago' && !suscripcion.cancelada && (
          <FilaAjustes icono="pausar" titulo="Cancelar el plan" detalle="Mercado Pago deja de cobrarlo."
            onClick={corriendo ? undefined : () => setPreguntar(true)} apilada />
        )}
      </GrupoAjustes>
      {!suscripcion && (
        <GrupoAjustes>
          <CuerpoGrupo><p className="aj-texto" style={{ margin: 0 }}>Para cambiar o cancelar tu plan, escríbenos a <a href={`mailto:${emailMako}`}>{emailMako}</a>.</p></CuerpoGrupo>
        </GrupoAjustes>
      )}
      {aviso && <p className="aj-texto" role="status" style={{ color: aviso.ok ? 'var(--good)' : 'var(--bad)' }}>{aviso.texto}</p>}
      {preguntar && (
        <ConfirmDialog titulo="¿Cancelar tu plan?" detalle="Mercado Pago deja de cobrarlo desde ya. No se puede deshacer."
          confirmLabel="Cancelar plan" danger onCancel={() => setPreguntar(false)} onConfirm={cancelar} />
      )}
    </>
  );
}
