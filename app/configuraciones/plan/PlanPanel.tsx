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
import { MARCA } from '@/lib/tutoriales/marcas';
import { PORCENTAJE_DIRECTO } from '@/app/mako-partners/numeros';
import { aceptarRetencionAction, darmeDeBajaAction, empezarPlanYaAction, pasarAProAction, pedirProAction } from './actions';
import type { OfertaRetencion, OpcionRetencion } from '@/lib/retencion-plan';
import { CAPACIDADES_PASARELA, COMO_SE_PAGA, NOMBRE_PASARELA, type Pasarela } from '@/lib/cobros-tipos';

const SANS = "'Geist', sans-serif";
const BTN_PRIMARIO = { padding: '10px 16px', borderRadius: 10, border: 0, background: 'var(--accent)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' } as const;
const BTN_SECUNDARIO = { padding: '10px 16px', borderRadius: 10, border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' } as const;

/**
 * LAS ACCIONES DE ESTA PANTALLA, Y SI TOCAN EL COBRO (15/11/2026, ronda 3). Las que lo tocan dejan viejo lo dibujado, así que
 * con una hecha no se vuelve a ofrecer la baja (ni «Empezar mi plan ya»); PEDIR Pro no toca nada y no esconde nada.
 *
 * ⚠️ POR QUÉ ES UNA LISTA Y NO UN `!aviso?.ok`. `puedeDarseDeBaja` colgaba de que el aviso compartido fuera `ok`, y eso
 *    alcanzaba mientras en la prueba el ÚNICO que podía dejar un aviso `ok` fuera la baja misma (la oferta de retención llega
 *    null en prueba, `subir` es null, y «Empezar mi plan ya» sólo avisa cuando FALLA). Con el pedido de Pro escribiendo ese
 *    mismo aviso (ronda 2), pedir Pro BIEN borraba de la pantalla «Empezar mi plan ya» y TODA la sección «Darme de baja»
 *    —medido dibujando la pantalla—: quien pedía Pro y después quería irse no encontraba cómo. Con la lista, una acción nueva
 *    tiene que DECIDIR de qué lado cae, y el conjunto entero se mide (tests/prueba-topes.test.ts).
 */
export const TOCAN_EL_COBRO = { baja: true, retencion: true, subida: true, pedirPro: false, empezarYa: false } as const;
export type AccionDelPlan = keyof typeof TOCAN_EL_COBRO;
/** El aviso de abajo de la tarjeta: lo que pasó, y cuál de las acciones lo dejó. */
export type AvisoDelPlan = { ok: boolean; texto: string; de: AccionDelPlan };

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

/**
 * ¿Se le sigue ofreciendo darse de baja (y, en la prueba, empezar su plan)? Puro y exportado para poder MEDIRLO: la pantalla
 * se dibuja una vez por pedido y un dibujo estático no vuelve a dibujarse después de un clic, así que esta decisión —la que
 * escondía la baja entera— se corre aparte (tests/_plan-pedir-pro-hijo.ts).
 */
export function sigueOfreciendoLaBaja(suscripcion: SuscripcionVisible, aviso: AvisoDelPlan | null): boolean {
  return !!suscripcion && !suscripcion.cancelada && !suscripcion.baja && !(aviso?.ok && TOCAN_EL_COBRO[aviso.de]);
}

export function PlanPanel({ plan, suscripcion, emailMako, oferta, retencion, subir, porLlamada, destacarEmpezar, clienteDeAgencia, gratisHasta }: {
  /** Los 6 meses gratis (30/10/2026): la fecha en que terminan, ya dicha. */
  gratisHasta?: string | null;
  /** La cuenta de un cliente de una agencia (29/10/2026): su plan lo maneja la agencia; no ve «Recomienda MaKo». */
  clienteDeAgencia?: boolean;
  plan: string; suscripcion: SuscripcionVisible; emailMako: string; oferta?: OfertaRetencion; retencion?: string | null;
  /** «Pasar a Pro» (23/10/2026): a quien paga MaKo Essential por la pasarela. El monto de Pro, en su moneda; null = no se ofrece. */
  subir?: { nombre: string; monto: string } | null;
  /**
   * «Pasar a Pro» cuando NO se puede subir en el acto (en la prueba, o sin pasarela que cobre). Es a donde llevan los carteles
   * de tope, y desde el 14/11/2026 (ronda 2) **no lleva a ninguna parte**: la toca y `pedirProAction` deja el pedido escrito en
   * el CRM. Por eso ya no trae `href` — los dos destinos que tuvo fueron la agenda de Calendly (hasta el 24/10) y el checkout
   * de /planes, que está medido y es peor (app/configuraciones/plan/page.tsx lo cuenta entero).
   */
  porLlamada?: { titulo: string; detalle: string } | null;
  /** Viene de un tope de la prueba (`?empezar=1`): «Empezar mi plan ya» arriba de todo y a la vista. */
  destacarEmpezar?: boolean;
}) {
  const [corriendo, setCorriendo] = useState(false);
  const [confirmarSubida, setConfirmarSubida] = useState(false);
  const [proPedido, setProPedido] = useState(false);
  const [preguntar, setPreguntar] = useState(false);
  // ANTES DE LA BAJA, LA OFERTA (23/10/2026, Martín: «debería habilitarte un descuento como lo tienen todas las
  // aplicaciones»): una vez por negocio, la mitad por 2 meses. Quien la rechaza sigue a la confirmación de siempre.
  const [ofrecer, setOfrecer] = useState(false);
  const [ofertaViva, setOfertaViva] = useState(oferta ?? null);

  const aceptarOferta = async (opcion: OpcionRetencion) => {
    setOfrecer(false); setCorriendo(true); setAviso(null);
    const r = await aceptarRetencionAction(opcion).catch(() => ({ ok: false, resumen: 'No pudimos aplicarlo.' }));
    setAviso({ ok: r.ok, texto: r.resumen, de: 'retencion' });
    if (r.ok) setOfertaViva(null);
    setCorriendo(false);
  };
  // Cada acción firma su aviso con su nombre (`de`), y `TOCAN_EL_COBRO` decide qué sigue en pantalla: ver arriba.
  const [aviso, setAviso] = useState<AvisoDelPlan | null>(null);

  const pasarAPro = async () => {
    setConfirmarSubida(false); setCorriendo(true); setAviso(null);
    const r = await pasarAProAction().catch(() => ({ ok: false, resumen: 'No pudimos cambiar tu plan. Intenta de nuevo.' }));
    setAviso({ ok: r.ok, texto: r.resumen, de: 'subida' });
    setCorriendo(false);
  };

  // «Pasar a Pro» CUANDO NO SE PUEDE SUBIR EN EL ACTO (14/11/2026, ronda 2): el pedido queda escrito en el CRM de MaKo y el
  // equipo recibe el aviso, sin salir de esta pantalla (antes era un link al checkout de /planes: el círculo).
  // ⚠️ UN CLIC DE MÁS NO MANDA DOS PEDIDOS: con el pedido hecho la fila deja de llamar (`proPedido`) y, desde la ronda 3, el
  //    servidor tampoco lo escribe dos veces (el compare-and-set de `pedirProAction`): esto es estado del navegador, y un F5 o
  //    una segunda pestaña lo pierden.
  // ⚠️ `de: 'pedirPro'`: pedir no toca el cobro, así que no borra «Empezar mi plan ya» ni «Darme de baja» (ver `TOCAN_EL_COBRO`).
  const pedirPro = async () => {
    setCorriendo(true); setAviso(null);
    const r = await pedirProAction().catch(() => ({ ok: false, resumen: 'No pudimos registrar tu pedido. Prueba otra vez.' }));
    setAviso({ ok: r.ok, texto: r.resumen, de: 'pedirPro' });
    if (r.ok) setProPedido(true);
    setCorriendo(false);
  };

  // «Empezar mi plan ya» (25/10/2026): abre el pago desde hoy; la prueba se cancela recién cuando ese pago entra.
  const empezarYa = async () => {
    setCorriendo(true); setAviso(null);
    const r = await empezarPlanYaAction().catch(() => ({ ok: false as const, resumen: 'No pudimos abrir el pago. Prueba otra vez.' }));
    if (r.ok) { window.location.href = r.link; return; }
    setAviso({ ok: false, texto: r.resumen, de: 'empezarYa' });
    setCorriendo(false);
  };

  const darmeDeBaja = async () => {
    setPreguntar(false); setCorriendo(true); setAviso(null);
    const r = await darmeDeBajaAction().catch(() => ({ ok: false as const, resumen: 'No pudimos darte de baja.' }));
    setAviso(r.ok ? { ok: true, texto: `Listo. Tu código de baja es ${r.codigo}: también te llega por email.`, de: 'baja' } : { ok: false, texto: r.resumen, de: 'baja' });
    setCorriendo(false);
  };

  const enPrueba = !!suscripcion?.prueba;
  const estado = !suscripcion ? undefined : suscripcion.cancelada ? 'De baja' : suscripcion.baja ? 'Baja pedida' : enPrueba ? 'En prueba' : 'Activo';
  const puedeDarseDeBaja = sigueOfreciendoLaBaja(suscripcion, aviso);
  // EN SECCIONES (25/10/2026, Martín: «En settings no me gusta el diseño de "... Tu plan"... Fijate pagina por pagina como lo hacen
  // otras apps»). Era UNA tarjeta con todo en filas iguales: el plan, recomendar, subir y darse de baja, del mismo tamaño. Ahora,
  // como la facturación de Vercel y Linear: arriba el plan que tienes (su nombre grande, el estado, cuánto y por dónde se cobra) con
  // lo que lo mejora debajo; después recomendar; y la baja en su propia sección al final, como el «Danger Zone» de GitHub.
  // SIN TÍTULOS QUE REPITEN LA FILA (30/10/2026, medido en el banco): el título de la página, el de la sección y la fila decían lo
  // mismo («Recomienda MaKo» dos veces y su frase dos veces). Es el «texto de sobra» que Martín rechazó el 25/10: cada tarjeta dice
  // lo suyo una vez, en su fila.
  // «Empezar mi plan ya» (25/10/2026, la prueba gratis): arriba si se llegó desde un tope de la prueba, si no debajo del plan.
  // ⚠️ YA NO DICE «Y TIENES TODO» (14/11/2026): desde que el Essential quedó «bien limitado y restrictivo» (los candados de
  //    `FUNCIONES_SOLO_PRO`, lib/topes-plan.ts), prometerle «todo» a la prueba del de 47 era falso — pagaba los US$47 creyendo
  //    que destrababa el avatar de IA, replicar el guion o el chat con los referentes, y volvía a encontrar el candado. Dice lo
  //    que el botón hace de verdad: se van los topes de la PRUEBA. Lo que falta para tener todo es la fila «Pasar a MaKo Pro»,
  //    que ahora también se arma en prueba (app/configuraciones/plan/page.tsx).
  const filaEmpezar = enPrueba && puedeDarseDeBaja && (
    <FilaAjustes icono="subir" titulo="Empezar mi plan ya" detalle={`Pagas ${suscripcion!.monto} desde hoy y se van los topes de la prueba.`}
      onClick={corriendo ? undefined : () => void empezarYa()} apilada recorrido={MARCA.settingsPlanEmpezar} />
  );
  // LO QUE MEJORA EL PLAN, EN UNA SOLA PIEZA: la subida en el acto (con pasarela) o el pedido de Pro. Junto, porque su LUGAR
  // cambia con de dónde vino la persona (abajo, `proAntesDeEmpezar`). Las dos son BOTONES: la de arriba cobra (con su
  // confirmación, que dice qué se le cobra), la de abajo pide y no cobra nada.
  // ⚠️ LA ASIMETRÍA DE `puedeDarseDeBaja` ES REAL Y NADIE LA DECIDIÓ (visto en la ronda 2, 14/11/2026): `subir` la pide y
  //    `porLlamada` no, así que una prueba que YA PIDIÓ LA BAJA sigue viendo «Pasar a MaKo Pro». Se dejó como estaba —el pedido
  //    no cobra nada y ofrecerle el plan bueno a quien se va es retención—, pero atarla o no es una decisión de producto.
  const filaPro = (
    <>
      {subir && puedeDarseDeBaja && (
        <FilaAjustes icono="subir" titulo={`Pasar a ${subir.nombre}`} detalle={`${subir.monto} por mes, con contactos y landings ilimitados. Lo tienes en el acto.`}
          onClick={corriendo ? undefined : () => setConfirmarSubida(true)} apilada recorrido={MARCA.settingsPlanPro} />
      )}
      {porLlamada && (
        <FilaAjustes icono="subir" titulo={porLlamada.titulo} detalle={proPedido ? 'Ya nos llegó tu pedido: te escribimos para cambiártelo.' : porLlamada.detalle}
          onClick={corriendo || proPedido ? undefined : () => void pedirPro()} apilada recorrido={MARCA.settingsPlanPro} />
      )}
    </>
  );
  // ⚠️ PRO ARRIBA DE «EMPEZAR MI PLAN YA» (14/11/2026): el candado de una función de Pro lleva a `RUTA_CAMBIAR_PLAN`
  //    (/configuraciones/plan, SIN `?empezar=1`), así que quien venía de «Pasa a Pro para usarlo» aterrizaba con «Empezar mi
  //    plan ya» de primera fila — el botón que cobra los US$47 del Essential y que NO destraba lo que vino a buscar (el avatar
  //    de IA, replicar el guion, el chat con los referentes: `FUNCIONES_SOLO_PRO`, lib/topes-plan.ts). El `?empezar=1` de los
  //    topes de la PRUEBA (`RUTA_EMPEZAR_PLAN`) sigue mandando, porque ahí la persona SÍ pidió empezar su plan; sin él manda
  //    Pro (Martín, 14/11: «la idea es que compren el de 97, no el de 47»). Sin parámetro nuevo: el que ya existe alcanza.
  const proAntesDeEmpezar = !!filaEmpezar && !destacarEmpezar;
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
        {proAntesDeEmpezar && filaPro}
        {!destacarEmpezar && filaEmpezar}
        {suscripcion?.primerMes && <FilaAjustes icono="nota" titulo="Tu primer mes" detalle={suscripcion.primerMes} apilada />}
        {suscripcion?.baja && <FilaAjustes icono="nota" titulo="Tu baja" detalle={suscripcion.baja} apilada />}
        {retencion && <FilaAjustes icono="nota" titulo="Tu oferta" detalle={retencion} apilada />}
        {!proAntesDeEmpezar && filaPro}
        {/* El cliente de una AGENCIA (29/10/2026): su plan lo paga y lo cambia su agencia, no MaKo. Los carteles de tope traen acá. */}
        {!suscripcion && clienteDeAgencia && (
          <CuerpoGrupo><p className="aj-texto" style={{ margin: 0 }}>Tu plan lo maneja tu agencia: para cambiarlo, pídeselo a ella.</p></CuerpoGrupo>
        )}
        {!suscripcion && !clienteDeAgencia && (
          <CuerpoGrupo><p className="aj-texto" style={{ margin: 0 }}>Tu plan se acordó con MaKo: para darte de baja, escríbenos a <a href={`mailto:${emailMako}`}>{emailMako}</a>.</p></CuerpoGrupo>
        )}
      </GrupoAjustes>
      {aviso && <p className="aj-texto" role="status" style={{ color: aviso.ok ? 'var(--good)' : 'var(--bad)' }}>{aviso.texto}</p>}
      {/* MaKo Partners (23/10/2026): cualquier negocio recomienda MaKo y gana DINERO. Desde el 18/11, el 30% de cada pago de cada negocio,
          de por vida (el 25% si paga por pasarela): el porcentaje sale de la regla (app/mako-partners/numeros.ts). */}
      {!clienteDeAgencia && (
        <GrupoAjustes titulo="Recomienda MaKo" descripcion={`Comparte tu link: te llevas el ${PORCENTAJE_DIRECTO} de cada pago de cada negocio que entra por él, de por vida.`}>
          <FilaAjustes icono="equipo" titulo="Recomienda MaKo" detalle={`Con MaKo Partners te llevas el ${PORCENTAJE_DIRECTO} de cada pago de cada negocio que traigas, todos los meses.`} href="/partners" apilada />
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
