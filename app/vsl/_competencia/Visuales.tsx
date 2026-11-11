// =============================================================================
// Los visuales de la portada de las landings que copian a un competidor (app/vsl/_competencia)
// =============================================================================
// Un visual por función, dibujado con HTML y CSS (las clases viven en ./LandingCompetencia.tsx). No usa fotos de nadie:
// el avatar es una silueta. Lo que dice el subtítulo y el nombre de la escena salen del código de la función (lo pasa
// el bloque `hero`), nunca escritos acá.
// =============================================================================

import type { VisualHero } from './tipos';
import { FEATURES } from '../_detalle/features';
import { FEATURE_VISUALS } from '../_detalle/feature-visuals';
import { Visual } from '../_detalle/Visual';
import PandaPlayer from '../_detalle/PandaPlayer';
import { VISUALES_PROPIOS } from './visuales-propios';

/** AI Avatar: tu foto → la escena → el video vertical, con el subtítulo de la plantilla. */
function Avatar({ escena, estilo, frase, segundos }: Extract<VisualHero, { tipo: 'avatar' }>) {
  const palabras = frase.split(/\s+/).filter(Boolean);
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
      <div className="mk-c-av-tel">
        <div className="mk-c-av-escena">
          <span className="mk-c-av-pill">{estilo} · {escena}</span>
          <span className="mk-c-av-dur">0:{String(segundos).padStart(2, '0')}</span>
          <svg className="mk-c-av-sil" viewBox="0 0 120 150" preserveAspectRatio="xMidYMax meet">
            <defs>
              <linearGradient id="mkcav" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3B3226" /><stop offset="1" stopColor="#1D1912" /></linearGradient>
            </defs>
            <circle cx="60" cy="52" r="24" fill="url(#mkcav)" />
            <path d="M14 150c0-34 20-58 46-58s46 24 46 58z" fill="url(#mkcav)" />
          </svg>
          <p className="mk-c-av-sub">
            {palabras.map((p, i) => (
              <span key={i} style={{ animationDelay: `${(i * 0.32).toFixed(2)}s`, animationDuration: `${(palabras.length * 0.32 + 1.6).toFixed(2)}s` }}>{p} </span>
            ))}
          </p>
        </div>
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
