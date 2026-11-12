// =============================================================================
// Los visuales de la portada de las landings que copian a un competidor (app/vsl/_competencia)
// =============================================================================
// Un visual por función, dibujado con HTML y CSS (las clases viven en ./LandingCompetencia.tsx). El de AI Avatar usa las
// imágenes REALES de sus presets (public/formatos/presets/, hechas en Flow con la cara de Martín; él lo aprobó el 12/11/2026:
// «Sí, con imágenes»): antes era una silueta sobre un degradado. Lo que dice el subtítulo, el nombre de la escena y la
// imagen salen del código de la función (lo pasa el bloque `hero`), nunca escritos acá.
// =============================================================================

import type { EscenaAvatar, VisualHero } from './tipos';
import { FEATURES } from '../_detalle/features';
import { FEATURE_VISUALS } from '../_detalle/feature-visuals';
import { Visual } from '../_detalle/Visual';
import PandaPlayer from '../_detalle/PandaPlayer';
import { VISUALES_PROPIOS } from './visuales-propios';

/** Un teléfono con la imagen real de una escena. El principal lleva la duración y el subtítulo que se va pintando; los de
 *  los lados, sólo el nombre de su escena. */
function Telefono({ e, principal }: { e: EscenaAvatar; principal: boolean }) {
  const palabras = principal ? e.frase.split(/\s+/).filter(Boolean) : [];
  return (
    <div className={principal ? 'mk-c-av-tel' : 'mk-c-av-tel mk-c-av-tel-lado'}>
      <div className="mk-c-av-escena">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mk-c-av-img" src={e.poster} alt="" width={540} height={968} loading={principal ? 'eager' : 'lazy'} decoding="async" />
        <span className="mk-c-av-pill">{e.escena}</span>
        {principal ? <span className="mk-c-av-dur">0:{String(e.segundos).padStart(2, '0')}</span> : null}
        {principal ? (
          <p className="mk-c-av-sub">
            {palabras.map((p, i) => (
              <span key={i} style={{ animationDelay: `${(i * 0.32).toFixed(2)}s`, animationDuration: `${(palabras.length * 0.32 + 1.6).toFixed(2)}s` }}>{p} </span>
            ))}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** AI Avatar: tu foto → tus escenas, en video vertical, con el subtítulo de la plantilla en la principal. Cada diseño elige
 *  qué partes muestra (el hero, sólo las escenas; el paso 1, sólo la foto). */
function Avatar({ escenas }: Extract<VisualHero, { tipo: 'avatar' }>) {
  const [principal, izquierda, ...resto] = escenas;
  if (!principal) return null;
  return (
    <div className="mk-c-av" aria-hidden="true">
      <div className="mk-c-av-foto">
        <span className="mk-c-av-foto-cara">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" transform="translate(0 -3)" /><path d="M5 21v-1.5a5.5 5.5 0 0 1 5.5 -5.5h3a5.5 5.5 0 0 1 5.5 5.5v1.5" /></svg>
        </span>
        <span className="mk-c-av-foto-t">Tu foto</span>
        <span className="mk-c-av-foto-d">De frente y con buena luz</span>
      </div>
      <span className="mk-c-av-flecha">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>
      </span>
      <div className="mk-c-av-escenas">
        {izquierda ? <Telefono e={izquierda} principal={false} /> : null}
        <Telefono e={principal} principal />
        {resto.map((e) => <Telefono key={e.poster} e={e} principal={false} />)}
      </div>
    </div>
  );
}

export function VisualDeLanding({ visual }: { visual: VisualHero }) {
  switch (visual.tipo) {
    case 'avatar': return <Avatar {...visual} />;
    case 'detalle': {
      const f = FEATURES[visual.slug];
      if (f?.videoEmbed) return <PandaPlayer src={f.videoEmbed} title={`${f.name} — cómo funciona`} />;
      return <Visual spec={FEATURE_VISUALS[visual.slug]?.hero} />;
    }
    case 'propio': {
      const Propio = VISUALES_PROPIOS[visual.slug];
      return Propio ? <Propio /> : null;
    }
  }
}
