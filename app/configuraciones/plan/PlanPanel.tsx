'use client';

// =============================================================================
// «Tu plan» — el plan de MaKo del negocio y el botón «Darme de baja» (15/10/2026)
// =============================================================================
// Copia de cómo lo resuelven los SaaS y las pasarelas (Stripe y Paddle: la baja se programa al FINAL del período pagado):
// vive en la configuración del negocio, junto al plan, y son DOS pasos —el botón y una confirmación que dice qué pasa—.
// Al terminar se ve el código de baja, que también llega por email. Un botón propio y no el portal de Stripe: cubre
// Mercado Pago, que no tiene portal (lo decidió Estrategia el 15/10).

import { useState } from 'react';
import { ConfirmDialog } from '../../_components/ChatItemMenu';
import { CuerpoGrupo, FilaAjustes, GrupoAjustes } from '../../_ui/Ajustes';
import { darmeDeBajaAction } from './actions';

export type SuscripcionVisible = {
  proveedor: 'stripe' | 'mercadopago';
  monto: string;
  cancelada: boolean;
  /** El texto de la baja ya pedida («Baja pedida el … (código …). Deja de cobrarse el …»), o null. */
  baja: string | null;
} | null;

export function PlanPanel({ plan, suscripcion, emailMako }: { plan: string; suscripcion: SuscripcionVisible; emailMako: string }) {
  const [corriendo, setCorriendo] = useState(false);
  const [preguntar, setPreguntar] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const darmeDeBaja = async () => {
    setPreguntar(false); setCorriendo(true); setAviso(null);
    const r = await darmeDeBajaAction().catch(() => ({ ok: false as const, resumen: 'No pudimos darte de baja.' }));
    setAviso(r.ok ? { ok: true, texto: `Listo. Tu código de baja es ${r.codigo}: también te llega por email.` } : { ok: false, texto: r.resumen });
    setCorriendo(false);
  };

  const estado = !suscripcion ? undefined : suscripcion.cancelada ? 'De baja' : suscripcion.baja ? 'Baja pedida' : 'Activo';
  const puedeDarseDeBaja = !!suscripcion && !suscripcion.cancelada && !suscripcion.baja && !aviso?.ok;
  return (
    <>
      <GrupoAjustes>
        <FilaAjustes icono="repetir" titulo={plan} detalle={suscripcion ? `${suscripcion.monto} por mes` : 'Acordado con MaKo'}
          tono={suscripcion ? (suscripcion.cancelada || suscripcion.baja ? 'warn' : 'good') : undefined} estado={estado} apilada />
        {suscripcion?.baja && <FilaAjustes icono="nota" titulo="Tu baja" detalle={suscripcion.baja} apilada />}
        {puedeDarseDeBaja && (
          <FilaAjustes icono="pausar" titulo="Darme de baja"
            detalle={suscripcion?.proveedor === 'stripe' ? 'Lo sigues usando hasta el fin del mes pagado.' : 'Mercado Pago deja de cobrarlo desde ya.'}
            onClick={corriendo ? undefined : () => setPreguntar(true)} apilada />
        )}
      </GrupoAjustes>
      {!suscripcion && (
        <GrupoAjustes>
          <CuerpoGrupo><p className="aj-texto" style={{ margin: 0 }}>Tu plan se acordó con MaKo: para darte de baja, escríbenos a <a href={`mailto:${emailMako}`}>{emailMako}</a>.</p></CuerpoGrupo>
        </GrupoAjustes>
      )}
      {aviso && <p className="aj-texto" role="status" style={{ color: aviso.ok ? 'var(--good)' : 'var(--bad)' }}>{aviso.texto}</p>}
      {preguntar && (
        <ConfirmDialog titulo="¿Darte de baja?"
          detalle={suscripcion?.proveedor === 'stripe'
            ? 'No se te cobra el mes siguiente, y sigues usando MaKo hasta el fin del mes pagado.'
            : 'Mercado Pago deja de cobrarlo desde ya. No se puede deshacer.'}
          confirmLabel="Darme de baja" danger onCancel={() => setPreguntar(false)} onConfirm={darmeDeBaja} />
      )}
    </>
  );
}
