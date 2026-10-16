'use client';

// =============================================================================
// ficha/registro-resumen — los COMPONENTES de los bloques de la tab Resumen
// =============================================================================
// Las reglas (vacío, lo que incluye, los diseños) están en ./reglas-resumen.ts, que es puro y lo ejecutan
// los tests. Los dos archivos son del frente del Resumen (ver ./tipos.ts, «Cómo se enchufa un bloque»).
//
// HOY (14/10/2026) son las tarjetas que ya existían, envueltas: con la plantilla de respaldo la ficha se
// ve como antes. Las MISMAS piezas que montaban las dos puertas (el pop-up y /crm/[id]) a mano.
// =============================================================================

import type { CSSProperties } from 'react';
import { nutricionPositivaDe } from '@/lib/pipeline';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { InfoPrincipalCard } from '../InfoPrincipalCard';
import { CalificacionCard } from '../CalificacionCard';
import { RespuestasFormulario } from '../RespuestasFormulario';
import { NotasCard } from '../NotasCard';
import { MotivoCard, PlazoNutricionCard } from '../MotivoYPlazoCard';
import { OrigenCard } from '../OrigenCard';
import { REGLAS_RESUMEN, respuestasDelBloque } from './reglas-resumen';
import type { EntradaRegistro, PropsBloque } from './tipos';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

/**
 * El contacto: InfoPrincipalCard con lo que eligió el negocio (`crm.resumen.campos`, que ya no tiene
 * modal: la ficha se arma acá) y la cohorte que trae el server (`cohorteDeLead`, las dos puertas igual).
 */
function Contacto({ ctx }: PropsBloque) {
  const { lead, data } = ctx;
  return (
    <InfoPrincipalCard leadId={lead.id} nombre={lead.nombre} empresa={lead.empresa} email={lead.email} telefono={lead.telefono} web={lead.web ?? null}
      cohorte={data.cohorte ?? null} ingresoEstimado={lead.ingreso_estimado ?? null} instagram={lead.instagram ?? null}
      youtube={lead.youtube ?? null} linkedin={lead.linkedin ?? null} direccion={lead.direccion ?? null} sexo={lead.sexo ?? null}
      resumen={data.resumen ?? {}} />
  );
}

/**
 * «Va bien» (`nutricionPositivaDe`): el lead avanza y tiene la reunión por delante. ⚠️ SIN «ventana
 * informativa», que es jerga NUESTRA: dice cuándo es y cuánto falta. Dos diseños: el banner de siempre y
 * un renglón.
 */
function ProximaReunion({ ctx, diseno }: PropsBloque) {
  const np = nutricionPositivaDe(ctx.lead, ctx.hoy);
  if (!np) return null;
  const cual = np.tipo === 'post-agenda' ? 'Reunión 1' : 'Reunión 2';
  const cuando = np.dias === 0 ? 'hoy' : `en ${np.dias} día${np.dias === 1 ? '' : 's'}`;
  const frase = <>Va bien: su {cual} es el <b>{fmtDDMMYYYY(np.hasta)}</b> ({cuando}).</>;
  if (diseno === 'renglon') {
    return (
      <div className="fb-propio" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderRadius: 12, border: '1px solid #BFE6CD', background: 'var(--good-bg)', fontSize: 13.5, color: 'var(--ink)' }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--good)', flex: 'none' }} />
        <span>{frase}</span>
      </div>
    );
  }
  return (
    <section className="fb-propio" style={{ ...card, borderColor: '#BFE6CD', background: 'var(--good-bg)' }}>
      <div style={{ ...sectLabel, color: 'var(--good)', marginBottom: 6 }}>Nutrición {np.tipo === 'post-agenda' ? 'Post Agenda' : 'Post Reunión R1'}</div>
      <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>{frase}</p>
    </section>
  );
}

/** «¿Era calificado?»: la que alimenta a Meta. Vive en el Resumen desde el 13/10/2026 («Que no esté más en tracking»). */
function Calificacion({ ctx }: PropsBloque) {
  return <CalificacionCard lead={ctx.lead} />;
}

/** Lo que contestó, en el orden de las fuentes del bloque (Meta y la landing; la agenda sigue en la reunión). */
function LoQueContesto({ ctx, puesto }: PropsBloque) {
  return (
    <>
      {respuestasDelBloque(ctx, puesto).map((f) => <RespuestasFormulario key={f.fuente} respuestas={f.respuestas} de={f.fuente} />)}
    </>
  );
}

/** De dónde vino. Sin atribución no se dibuja (`origenConDatos`). */
function Origen({ ctx }: PropsBloque) {
  const { lead, data } = ctx;
  return <OrigenCard lead={lead} vslEng={data.vslEng} campana={data.campana} adNombre={data.adNombre} adId={data.adId} />;
}

/** Las notas: las mismas que ve Customer Success. */
function Notas({ ctx }: PropsBloque) {
  return <NotasCard leadId={ctx.lead.id} />;
}

function MotivoDeSalida({ ctx }: PropsBloque) {
  return <MotivoCard leadId={ctx.lead.id} motivo={ctx.lead.motivo_perdida} />;
}

function PlazoNutricion({ ctx }: PropsBloque) {
  return <PlazoNutricionCard leadId={ctx.lead.id} deadline={ctx.lead.nutricion_manual_deadline ?? null} />;
}

export const REGISTRO_RESUMEN: { [K in keyof typeof REGLAS_RESUMEN]: EntradaRegistro } = {
  contacto: { Componente: Contacto, ...REGLAS_RESUMEN.contacto },
  'proxima-reunion': { Componente: ProximaReunion, ...REGLAS_RESUMEN['proxima-reunion'] },
  calificacion: { Componente: Calificacion, ...REGLAS_RESUMEN.calificacion },
  'lo-que-contesto': { Componente: LoQueContesto, ...REGLAS_RESUMEN['lo-que-contesto'] },
  origen: { Componente: Origen, ...REGLAS_RESUMEN.origen },
  notas: { Componente: Notas, ...REGLAS_RESUMEN.notas },
  'motivo-de-salida': { Componente: MotivoDeSalida, ...REGLAS_RESUMEN['motivo-de-salida'] },
  'plazo-nutricion': { Componente: PlazoNutricion, ...REGLAS_RESUMEN['plazo-nutricion'] },
};
