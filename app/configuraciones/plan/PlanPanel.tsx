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
import { aceptarRetencionAction, darmeDeBajaAction } from './actions';
import type { OfertaRetencion, OpcionRetencion } from '@/lib/retencion-plan';

const SANS = "'Geist', sans-serif";
const BTN_PRIMARIO = { padding: '10px 16px', borderRadius: 10, border: 0, background: 'var(--accent)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' } as const;
const BTN_SECUNDARIO = { padding: '10px 16px', borderRadius: 10, border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' } as const;

export type SuscripcionVisible = {
  proveedor: 'stripe' | 'mercadopago';
  monto: string;
  cancelada: boolean;
  /** El texto de la baja ya pedida («Baja pedida el … (código …). Deja de cobrarse el …»), o null. */
  baja: string | null;
} | null;

export function PlanPanel({ plan, suscripcion, emailMako, oferta, retencion }: { plan: string; suscripcion: SuscripcionVisible; emailMako: string; oferta?: OfertaRetencion; retencion?: string | null }) {
  const [corriendo, setCorriendo] = useState(false);
  const [preguntar, setPreguntar] = useState(false);
  // ANTES DE LA BAJA, LA OFERTA (23/10/2026, Martín: «debería habilitarte un descuento como lo tienen todas las
  // aplicaciones»): una vez por negocio, la mitad por 2 meses. Quien la rechaza sigue a la confirmación de siempre.
  const [ofrecer, setOfrecer] = useState(false);
  const [ofertaViva, setOfertaViva] = useState(oferta ?? null);

  const aceptarOferta = async (opcion: OpcionRetencion) => {
    setOfrecer(false); setCorriendo(true); setAviso(null);
    const r = await aceptarRetencionAction(opcion).catch(() => ({ ok: false, resumen: 'No pudimos aplicarlo.' }));
    setAviso({ ok: r.ok, texto: r.resumen });
    if (r.ok) setOfertaViva(null);
    setCorriendo(false);
  };
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
        {retencion && <FilaAjustes icono="nota" titulo="Tu oferta" detalle={retencion} apilada />}
        {/* MaKo Partners (23/10/2026): cualquier negocio con plan recomienda MaKo y gana meses gratis. */}
        <FilaAjustes icono="equipo" titulo="Recomienda MaKo" detalle="Tu link de MaKo Partners: cada referido te suma un mes." href="/partners/referidos" apilada />
        {puedeDarseDeBaja && (
          <FilaAjustes icono="pausar" titulo="Darme de baja"
            detalle="Lo sigues usando hasta el fin del mes pagado."
            onClick={corriendo ? undefined : () => (ofertaViva ? setOfrecer(true) : setPreguntar(true))} apilada />
        )}
      </GrupoAjustes>
      {!suscripcion && (
        <GrupoAjustes>
          <CuerpoGrupo><p className="aj-texto" style={{ margin: 0 }}>Tu plan se acordó con MaKo: para darte de baja, escríbenos a <a href={`mailto:${emailMako}`}>{emailMako}</a>.</p></CuerpoGrupo>
        </GrupoAjustes>
      )}
      {aviso && <p className="aj-texto" role="status" style={{ color: aviso.ok ? 'var(--good)' : 'var(--bad)' }}>{aviso.texto}</p>}
      {ofrecer && ofertaViva && (
        <div onClick={() => setOfrecer(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(18,21,27,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.32)', padding: '20px 22px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Antes de irte</div>
            <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 6, lineHeight: 1.5 }}>Tus datos quedan guardados siempre. Si te sirve, elige una de estas:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
              {ofertaViva.descuento && <button type="button" onClick={() => aceptarOferta('descuento')} style={BTN_PRIMARIO}>{ofertaViva.descuento.meses} meses a {ofertaViva.descuento.montoConDescuento} ({ofertaViva.descuento.pct}% menos)</button>}
              {ofertaViva.bajar && <button type="button" onClick={() => aceptarOferta('bajar')} style={ofertaViva.descuento ? BTN_SECUNDARIO : BTN_PRIMARIO}>Pasar a {ofertaViva.bajar.nombre} ({ofertaViva.bajar.monto} por mes)</button>}
              {ofertaViva.pausa && <button type="button" onClick={() => aceptarOferta('pausa')} style={BTN_PRIMARIO}>Pausar {ofertaViva.pausa.meses === 1 ? 'un mes' : `${ofertaViva.pausa.meses} meses`} gratis</button>}
              <button type="button" onClick={() => { setOfrecer(false); setPreguntar(true); }} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>Darme de baja igual</button>
            </div>
          </div>
        </div>
      )}
      {preguntar && (
        <ConfirmDialog titulo="¿Darte de baja?"
          detalle={suscripcion?.proveedor === 'stripe'
            ? 'No se te cobra el mes siguiente, y sigues usando MaKo hasta el fin del mes pagado.'
            : 'Mercado Pago deja de cobrarlo desde ya, y sigues usando MaKo hasta el fin del mes pagado. No se puede deshacer.'}
          confirmLabel="Darme de baja" danger onCancel={() => setPreguntar(false)} onConfirm={darmeDeBaja} />
      )}
    </>
  );
}
