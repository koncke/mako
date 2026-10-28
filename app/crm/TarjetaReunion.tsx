'use client';

// =============================================================================
// La tarjeta de una reunión que viene: para PREPARARLA (22/10/2026)
// =============================================================================
// Martín, 22/10/2026: «Tampoco me gustó el pop-up con los bloques azules, rediseñalo... Piensa en un diseño que sea útil,
// justamente se acerca la reunión que la tarjeta refleje algo al respecto... Y que no tenga "Llamar o WhatsApp"».
//   · ARRIBA, CUÁNTO FALTA, y cambia solo («En 25 min», «Empieza en 5 min»): es lo primero que se mira. Al lado, la hora, el
//     día y si es la R1 o la R2. Las reglas son puras (./reunion-tarjeta.ts).
//   · QUIÉN ES y en qué paso del camino está.
//   · LO ÚTIL PARA ENTRAR A LA LLAMADA: lo que hay en juego, lo que contestó en el formulario (en la R1), lo último que hizo y,
//     en la R2, lo que quedó de la R1 (Closing Analyst: el próximo paso, sus objeciones, la grabación). Eso último se pide al
//     abrir (./reuniones-actions.ts), no al cargar el CRM.
//   · AL ACERCARSE la tarjeta se nota: un borde del color de la casa, y a 10 minutos el aviso lleno y «Entrar a la reunión»
//     (con el link de Calendly). Sin «Llamar» ni «WhatsApp», y sin el bloque azul pleno. Queda «Ver detalle».
//   · LA MISMA EN LA COMPUTADORA Y EN EL TELÉFONO (el pop-up de app/crm/ReunionesProximas.tsx y «Próximo» de
//     app/m/crm/TableroCrm.tsx), y en todos los negocios.
// ⚠️ LA HORA SE CUENTA DESPUÉS DE MONTAR (`montado`): el HTML del server diría otra cosa que el navegador (la hidratación falla).
// =============================================================================

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Avatar, Button, ButtonLink } from '@/app/_ui';
import type { ContextoReunion } from '@/lib/reunion-preparar';
import { contextoDeReunionesAction } from './reuniones-actions';
import { cadaCuanto, cuantoFalta, horaCorta, instanteDe, lineaDeLaR1, lineaUltimo, puedeEntrar, type Cercania } from './reunion-tarjeta';

/** Una reunión que viene, con lo que la pantalla ya sabe. */
export type ReunionParaPreparar = {
  /** La key de la tarjeta (`<leadId>-J1`). */
  id: string;
  leadId: number;
  cual: 'R1' | 'R2';
  /** El día de la reunión (AAAA-MM-DD), para no usar una hora de otro día. */
  fecha: string | null;
  /** Lo que se dice sin hora: «hoy», «mañana», «pasó», «24/10/2026». */
  dia: string;
  /** El instante (`junta_N_at`) y el link para entrar (`junta_N_url`). */
  at: string | null;
  url: string | null;
  nombre: string;
  empresa: string | null;
  foto: string | null;
  /** El paso del CAMINO (las etapas del pipeline): «Paso 3 de 7 · Agenda R1». null = en nutrición o salido. */
  paso: { n: number; de: number; etapa: string } | null;
  /** Lo que hay en juego (el monto, o el estimado con su «≈»). */
  plata: string | null;
  /** Lo que contestó en el formulario (sirve sobre todo en la R1). */
  objetivo: string | null;
  facturacion: string | null;
  /** Agendó sin ver el VSL (pisó la landing y no lo arrancó). */
  sinVsl: boolean;
};

const sinSuscripcion = () => () => {};

const CSS = `
.crm-reus { display: flex; flex-direction: column; gap: 12px; }
.crm-reu { position: relative; display: flex; flex-direction: column; gap: 12px; padding: 16px 18px; border-radius: 16px;
  background: var(--surface); border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(18,21,27,.04); }
.crm-reu[data-cerca='pronto'] { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); box-shadow: inset 3px 0 0 var(--primary), 0 1px 2px rgba(18,21,27,.04); }
.crm-reu[data-cerca='ya'], .crm-reu[data-cerca='en_curso'] { border-color: var(--primary);
  box-shadow: inset 3px 0 0 var(--primary), 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent); }
.crm-reu[data-cerca='paso'] { opacity: .72; }
.crm-reu__cab { display: flex; align-items: flex-start; gap: 12px; }
.crm-reu__quien { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.crm-reu__nombre { margin: 0; font-size: 15.5px; font-weight: 650; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.crm-reu__sub { margin: 0; font-size: 12.5px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.crm-reu__falta { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px;
  font-size: 12.5px; font-weight: 650; white-space: nowrap; background: var(--surface-2); color: var(--dim); }
.crm-reu[data-cerca='pronto'] .crm-reu__falta { background: var(--primary-bg); color: var(--primary); }
.crm-reu[data-cerca='ya'] .crm-reu__falta, .crm-reu[data-cerca='en_curso'] .crm-reu__falta { background: var(--primary); color: var(--on-primary, #fff); }
.crm-reu__punto { width: 7px; height: 7px; border-radius: 999px; background: currentColor; animation: crmReuLatido 1.4s ease-in-out infinite; }
@keyframes crmReuLatido { 0%, 100% { transform: scale(1); } 50% { transform: scale(.55); } }
@media (prefers-reduced-motion: reduce) { .crm-reu__punto { animation: none; } }
.crm-reu__paso { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--dim); }
.crm-reu__barra { height: 4px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.crm-reu__barra > span { display: block; height: 100%; border-radius: 999px; background: var(--primary); }
.crm-reu__datos { margin: 0; display: grid; grid-template-columns: minmax(84px, max-content) minmax(0, 1fr); gap: 6px 14px; font-size: 13px; line-height: 1.45; }
.crm-reu__datos dt { color: var(--dim); }
.crm-reu__datos dd { margin: 0; color: var(--ink); overflow-wrap: anywhere; }
.crm-reu__cargando { color: var(--faint); }
.crm-reu__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.crm-reu__chip { padding: 2px 8px; border-radius: 999px; background: var(--surface-2); color: var(--dim); font-size: 12px; }
.crm-reu__aviso { margin: 0; font-size: 12.5px; color: var(--warn); }
.crm-reu__pie { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.crm-reu__link { font-size: 12.5px; font-weight: 600; color: var(--primary); text-decoration: none; }
.crm-reu__link:hover { text-decoration: underline; }
@media (max-width: 520px) {
  .crm-reu { padding: 14px; }
  .crm-reu__datos { grid-template-columns: 1fr; gap: 2px; }
  .crm-reu__datos dd { margin-bottom: 6px; }
}
`;

/** La tarjeta de UNA reunión. `ahora` null = todavía sin montar: se dice el día, sin contar. */
export function TarjetaReunion({ r, ahora, ctx, onVerDetalle }: {
  r: ReunionParaPreparar;
  ahora: number | null;
  /** Lo que se pidió al abrir: `'cargando'`, el contexto, o null (no se pudo: esa parte no se dice). */
  ctx: ContextoReunion | 'cargando' | null;
  onVerDetalle?: () => void;
}) {
  const ms = instanteDe(r.at, r.fecha);
  const falta = ahora == null ? cuantoFalta(null, 0, r.dia) : cuantoFalta(ms, ahora, r.dia);
  const cerca: Cercania = falta.cerca;
  const entrar = ahora != null && puedeEntrar(ms, r.url, ahora);
  const hora = ms != null ? horaCorta(ms) : null;
  const ultimo = ctx && ctx !== 'cargando' && ahora != null ? lineaUltimo(ctx.ultimo, ahora) : null;
  const r1 = ctx && ctx !== 'cargando' ? ctx.r1 : null;
  const deLaR1 = r.cual === 'R2' ? lineaDeLaR1(r1) : null;
  const sub = [r.cual, hora && falta.cerca !== 'otro_dia' ? hora : null, r.empresa].filter(Boolean).join(' · ');

  return (
    <article className="crm-reu" data-cerca={cerca} aria-label={`${r.cual} con ${r.nombre}: ${falta.texto}`}>
      <div className="crm-reu__cab">
        <Avatar name={r.nombre} url={r.foto} size={40} />
        <div className="crm-reu__quien">
          <p className="crm-reu__nombre" title={r.nombre}>{r.nombre}</p>
          <p className="crm-reu__sub">{sub}</p>
        </div>
        <span className="crm-reu__falta" role="timer">
          {(cerca === 'ya' || cerca === 'en_curso') && <span className="crm-reu__punto" aria-hidden />}
          {falta.texto}
        </span>
      </div>

      {r.paso && (
        <div className="crm-reu__paso">
          <span>{`Paso ${r.paso.n} de ${r.paso.de} · ${r.paso.etapa}`}</span>
          <span className="crm-reu__barra" aria-hidden><span style={{ width: `${Math.round((r.paso.n / r.paso.de) * 100)}%` }} /></span>
        </div>
      )}

      <dl className="crm-reu__datos">
        {r.plata && <><dt>En juego</dt><dd>{r.plata}</dd></>}
        {r.cual === 'R1' && r.objetivo && <><dt>Quiere</dt><dd>{r.objetivo}</dd></>}
        {r.cual === 'R1' && r.facturacion && <><dt>Factura</dt><dd>{r.facturacion}</dd></>}
        {ctx === 'cargando'
          ? <><dt>Lo último</dt><dd className="crm-reu__cargando">Leyendo…</dd></>
          : ultimo ? <><dt>Lo último</dt><dd>{ultimo}</dd></> : null}
        {r.cual === 'R2' && (deLaR1 || r1?.objeciones?.length || r1?.grabacion) && (
          <>
            <dt>En la R1</dt>
            <dd>
              {deLaR1}
              {!!r1?.objeciones?.length && (
                <span className="crm-reu__chips">{(r1.objeciones ?? []).map((o, i) => <span key={i} className="crm-reu__chip" title={o}>{o.length > 60 ? `«${o.slice(0, 57)}…»` : `«${o}»`}</span>)}</span>
              )}
              {r1?.grabacion && <><br /><a className="crm-reu__link" href={r1.grabacion} target="_blank" rel="noopener noreferrer">Ver la grabación</a></>}
            </dd>
          </>
        )}
      </dl>

      {r.sinVsl && <p className="crm-reu__aviso">Agendó sin ver el VSL.</p>}

      <div className="crm-reu__pie">
        {entrar && r.url && <ButtonLink href={r.url} newTab variant="primary" size="sm">Entrar a la reunión</ButtonLink>}
        {onVerDetalle && <Button variant={entrar ? 'secondary' : 'primary'} size="sm" onClick={onVerDetalle}>Ver detalle</Button>}
      </div>
    </article>
  );
}

/**
 * Las reuniones, cada una con su tarjeta: el reloj que las cuenta (de a minuto; de a 15 s cuando alguna está cerca) y lo
 * que se pide al abrir (lo último y la R1), UNA vez para todas.
 */
export function ReunionesParaPreparar({ reuniones, onVerDetalle }: {
  reuniones: readonly ReunionParaPreparar[];
  onVerDetalle?: (leadId: number) => void;
}) {
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const [ahora, setAhora] = useState(() => Date.now());
  const [ctx, setCtx] = useState<Record<number, ContextoReunion> | 'cargando' | null>('cargando');
  const ids = useMemo(() => [...new Set(reuniones.map((r) => r.leadId))], [reuniones]);
  const clave = ids.join(',');

  useEffect(() => {
    let vivo = true;
    contextoDeReunionesAction(ids)
      .then((x) => { if (vivo) setCtx(x.ok ? x.porLead : null); })
      .catch(() => { if (vivo) setCtx(null); });
    return () => { vivo = false; };
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  const cercas = reuniones.map((r) => cuantoFalta(instanteDe(r.at, r.fecha), ahora, r.dia).cerca);
  const cada = cadaCuanto(cercas);
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), cada);
    return () => window.clearInterval(t);
  }, [cada]);

  // Las que vienen primero, por su hora; las que ya pasaron, al final.
  const orden = [...reuniones].sort((a, b) => {
    const pa = /pas[oó]/i.test(a.dia) ? 1 : 0;
    const pb = /pas[oó]/i.test(b.dia) ? 1 : 0;
    if (pa !== pb) return pa - pb;
    const ma = instanteDe(a.at, a.fecha) ?? Date.parse(`${a.fecha ?? '9999-12-31'}T23:59:00`);
    const mb = instanteDe(b.at, b.fecha) ?? Date.parse(`${b.fecha ?? '9999-12-31'}T23:59:00`);
    return ma - mb;
  });

  return (
    <div className="crm-reus">
      <style>{CSS}</style>
      {orden.map((r) => (
        <TarjetaReunion key={r.id} r={r} ahora={montado ? ahora : null}
          ctx={ctx === 'cargando' || ctx === null ? ctx : ctx[r.leadId] ?? null}
          onVerDetalle={onVerDetalle ? () => onVerDetalle(r.leadId) : undefined} />
      ))}
    </div>
  );
}
