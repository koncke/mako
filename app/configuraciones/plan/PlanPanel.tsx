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
import { CuerpoGrupo, FilaAjustes, GrupoAjustes, Pastilla } from '../../_ui/Ajustes';
import { IconoMenu } from '../../_ui/iconos-menu';
import { aceptarRetencionAction, darmeDeBajaAction, empezarPlanYaAction, pasarAProAction } from './actions';
import type { OfertaRetencion, OpcionRetencion } from '@/lib/retencion-plan';
import { CAPACIDADES_PASARELA, COMO_SE_PAGA, NOMBRE_PASARELA, type Pasarela } from '@/lib/cobros-tipos';

const SANS = "'Geist', sans-serif";
const BTN_PRIMARIO = { padding: '10px 16px', borderRadius: 10, border: 0, background: 'var(--accent)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' } as const;
const BTN_SECUNDARIO = { padding: '10px 16px', borderRadius: 10, border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' } as const;

export type SuscripcionVisible = {
  proveedor: Pasarela;
  monto: string;
  cancelada: boolean;
  /** El texto de la baja ya pedida («Baja pedida el … (código …). Deja de cobrarse el …»), o null. */
  baja: string | null;
  /** LA PRUEBA GRATIS (25/10/2026): hasta qué día va («el lunes 3 de noviembre»), o null si ya se cobra. */
  prueba?: { hasta: string } | null;
  /** El 50% del primer mes, mientras corre ese mes, ya dicho (lib/primer-mes-reglas.ts). */
  primerMes?: string | null;
} | null;

export function PlanPanel({ plan, suscripcion, emailMako, oferta, retencion, subir, porLlamada, destacarEmpezar, clienteDeAgencia, gratisHasta }: {
  /** Los 6 meses gratis (30/10/2026): la fecha en que terminan, ya dicha. */
  gratisHasta?: string | null;
  /** La cuenta de un cliente de una agencia (29/10/2026): su plan lo maneja la agencia; no ve «Recomienda MaKo». */
  clienteDeAgencia?: boolean;
  plan: string; suscripcion: SuscripcionVisible; emailMako: string; oferta?: OfertaRetencion; retencion?: string | null;
  /** «Pasar a Pro» (23/10/2026): a quien paga MaKo Esencial por la pasarela. El monto de Pro, en su moneda; null = no se ofrece. */
  subir?: { nombre: string; monto: string } | null;
  /** «Pasar a Pro» sin la subida en el acto (sin pasarela): la agenda. Es a donde llevan los carteles de tope. */
  porLlamada?: { titulo: string; detalle: string; href: string } | null;
  /** Viene de un tope de la prueba (`?empezar=1`): «Empezar mi plan ya» arriba de todo y a la vista. */
  destacarEmpezar?: boolean;
}) {
  const [corriendo, setCorriendo] = useState(false);
  const [confirmarSubida, setConfirmarSubida] = useState(false);
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

  const pasarAPro = async () => {
    setConfirmarSubida(false); setCorriendo(true); setAviso(null);
    const r = await pasarAProAction().catch(() => ({ ok: false, resumen: 'No pudimos cambiar tu plan. Intenta de nuevo.' }));
    setAviso({ ok: r.ok, texto: r.resumen });
    setCorriendo(false);
  };

  // «Empezar mi plan ya» (25/10/2026): abre el pago desde hoy; la prueba se cancela recién cuando ese pago entra.
  const empezarYa = async () => {
    setCorriendo(true); setAviso(null);
    const r = await empezarPlanYaAction().catch(() => ({ ok: false as const, resumen: 'No pudimos abrir el pago. Prueba otra vez.' }));
    if (r.ok) { window.location.href = r.link; return; }
    setAviso({ ok: false, texto: r.resumen });
    setCorriendo(false);
  };

  const darmeDeBaja = async () => {
    setPreguntar(false); setCorriendo(true); setAviso(null);
    const r = await darmeDeBajaAction().catch(() => ({ ok: false as const, resumen: 'No pudimos darte de baja.' }));
    setAviso(r.ok ? { ok: true, texto: `Listo. Tu código de baja es ${r.codigo}: también te llega por email.` } : { ok: false, texto: r.resumen });
    setCorriendo(false);
  };

  const enPrueba = !!suscripcion?.prueba;
  const estado = !suscripcion ? undefined : suscripcion.cancelada ? 'De baja' : suscripcion.baja ? 'Baja pedida' : enPrueba ? 'En prueba' : 'Activo';
  const puedeDarseDeBaja = !!suscripcion && !suscripcion.cancelada && !suscripcion.baja && !aviso?.ok;
  // EN SECCIONES (25/10/2026, Martín: «En settings no me gusta el diseño de "... Tu plan"... Fijate pagina por pagina como lo hacen
  // otras apps»). Era UNA tarjeta con todo en filas iguales: el plan, recomendar, subir y darse de baja, del mismo tamaño. Ahora,
  // como la facturación de Vercel y Linear: arriba el plan que tienes (su nombre grande, el estado, cuánto y por dónde se cobra) con
  // lo que lo mejora debajo; después recomendar; y la baja en su propia sección al final, como el «Danger Zone» de GitHub.
  // SIN TÍTULOS QUE REPITEN LA FILA (30/10/2026, medido en el banco): el título de la página, el de la sección y la fila decían lo
  // mismo («Recomienda MaKo» dos veces y su frase dos veces). Es el «texto de sobra» que Martín rechazó el 25/10: cada tarjeta dice
  // lo suyo una vez, en su fila.
  // «Empezar mi plan ya» (25/10/2026, la prueba gratis): arriba si se llegó desde un tope de la prueba, si no debajo del plan.
  const filaEmpezar = enPrueba && puedeDarseDeBaja && (
    <FilaAjustes icono="subir" titulo="Empezar mi plan ya" detalle={`Pagas ${suscripcion!.monto} desde hoy y tienes todo, sin los topes de la prueba.`}
      onClick={corriendo ? undefined : () => void empezarYa()} apilada />
  );
  const tono = suscripcion ? (suscripcion.cancelada || suscripcion.baja ? 'warn' : 'good') : undefined;
  return (
    <>
      <GrupoAjustes>
        {destacarEmpezar && filaEmpezar}
        <div className="aj-plan">
          <span className="aj-plan__icono"><IconoMenu nombre="repetir" size={22} /></span>
          <span className="aj-plan__texto">
            <span className="aj-plan__nombre">{plan}{tono && estado && <Pastilla tono={tono}>{estado}</Pastilla>}</span>
            <span className="aj-plan__precio">{!suscripcion ? (clienteDeAgencia ? 'Lo maneja tu agencia' : gratisHasta ? `Gratis hasta el ${gratisHasta}` : 'Acordado con MaKo') : enPrueba
              ? <>Prueba gratis hasta el {suscripcion.prueba!.hasta}: ese día se cobra <b>{suscripcion.monto}</b>, y después cada mes.</>
              : <><b>{suscripcion.monto}</b> por mes · {COMO_SE_PAGA[suscripcion.proveedor]}</>}</span>
          </span>
        </div>
        {!destacarEmpezar && filaEmpezar}
        {suscripcion?.primerMes && <FilaAjustes icono="nota" titulo="Tu primer mes" detalle={suscripcion.primerMes} apilada />}
        {suscripcion?.baja && <FilaAjustes icono="nota" titulo="Tu baja" detalle={suscripcion.baja} apilada />}
        {retencion && <FilaAjustes icono="nota" titulo="Tu oferta" detalle={retencion} apilada />}
        {subir && puedeDarseDeBaja && (
          <FilaAjustes icono="subir" titulo={`Pasar a ${subir.nombre}`} detalle={`${subir.monto} por mes, sin topes. Lo tienes en el acto.`}
            onClick={corriendo ? undefined : () => setConfirmarSubida(true)} apilada />
        )}
        {porLlamada && <FilaAjustes icono="subir" titulo={porLlamada.titulo} detalle={porLlamada.detalle} href={porLlamada.href} apilada />}
        {/* El cliente de una AGENCIA (29/10/2026): su plan lo paga y lo cambia su agencia, no MaKo. Los carteles de tope traen acá. */}
        {!suscripcion && clienteDeAgencia && (
          <CuerpoGrupo><p className="aj-texto" style={{ margin: 0 }}>Tu plan lo maneja tu agencia: para cambiarlo, pídeselo a ella.</p></CuerpoGrupo>
        )}
        {!suscripcion && !clienteDeAgencia && (
          <CuerpoGrupo><p className="aj-texto" style={{ margin: 0 }}>Tu plan se acordó con MaKo: para darte de baja, escríbenos a <a href={`mailto:${emailMako}`}>{emailMako}</a>.</p></CuerpoGrupo>
        )}
      </GrupoAjustes>
      {aviso && <p className="aj-texto" role="status" style={{ color: aviso.ok ? 'var(--good)' : 'var(--bad)' }}>{aviso.texto}</p>}
      {/* MaKo Partners (23/10/2026): cualquier negocio recomienda MaKo. Desde el 25/10 gana DINERO: el 100% del primer mes. */}
      {!clienteDeAgencia && (
        <GrupoAjustes titulo="Recomienda MaKo" descripcion="Comparte tu link: te llevas el primer mes entero de cada negocio que entra por él.">
          <FilaAjustes icono="equipo" titulo="Recomienda MaKo" detalle="Con MaKo Partners te llevas el primer mes entero de cada negocio que traigas." href="/partners" apilada />
        </GrupoAjustes>
      )}
      {puedeDarseDeBaja && (
        <GrupoAjustes>
          <FilaAjustes icono="pausar" titulo="Darme de baja"
            detalle={enPrueba ? 'No se te cobra nada, y lo sigues usando hasta el fin de la prueba. Tus datos quedan guardados.' : 'Lo sigues usando hasta el fin del mes pagado. Tus datos quedan guardados.'}
            onClick={corriendo ? undefined : () => (ofertaViva ? setOfrecer(true) : setPreguntar(true))} apilada />
        </GrupoAjustes>
      )}
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
      {confirmarSubida && subir && (
        <ConfirmDialog titulo={`¿Pasar a ${subir.nombre}?`}
          detalle={suscripcion && CAPACIDADES_PASARELA[suscripcion.proveedor].subidaCobraLaDiferencia
            ? `Te cobramos ahora la diferencia de este período, y desde el próximo pagas ${subir.monto} por mes.`
            : `Tienes ${subir.nombre} desde ya, y desde tu próximo cobro pagas ${subir.monto} por mes.`}
          confirmLabel={`Pasar a ${subir.nombre}`} onCancel={() => setConfirmarSubida(false)} onConfirm={pasarAPro} />
      )}
      {preguntar && (
        <ConfirmDialog titulo="¿Darte de baja?"
          detalle={enPrueba
            ? `No se te cobra nada, y sigues usando MaKo hasta el ${suscripcion!.prueba!.hasta}. No se puede deshacer.`
            : suscripcion && CAPACIDADES_PASARELA[suscripcion.proveedor].bajaAlFinDelPeriodo
              ? 'No se te cobra el mes siguiente, y sigues usando MaKo hasta el fin del mes pagado.'
              : `${suscripcion ? NOMBRE_PASARELA[suscripcion.proveedor] : 'La pasarela'} deja de cobrarlo desde ya, y sigues usando MaKo hasta el fin del mes pagado. No se puede deshacer.`}
          confirmLabel="Darme de baja" danger onCancel={() => setPreguntar(false)} onConfirm={darmeDeBaja} />
      )}
    </>
  );
}
