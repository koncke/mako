'use client';
// =============================================================================
// EL VIDEO DE UN MOMENTO DEL ONBOARDING (18/11/2026)
// =============================================================================
// Martín pidió videos del estilo de los tutoriales (el Martín en cubos, su voz) para cada momento del onboarding y cada día del
// reto. Los hace el chat «Tutoriales animados con voz» en public/tutoriales/<clave>.mp4, con su línea en el manifiesto
// (lib/tutoriales/videos.ts). Las claves de los momentos, acordadas con ese chat:
//   onboarding-bienvenida (el primer mensaje del chat de bienvenida), onboarding-whatsapp (escribirle a MaKo con el código),
//   onboarding-seguir-pc (el teléfono: «Sigamos en tu computadora»), offer-coach y funnel-coach (la entrada a cada coach).
// Sin video para esa clave, NADA (nunca otro en su lugar). En la revisión de Martín, su lugar marcado: así ve dónde va.
// =============================================================================
import { useVideoTutorial } from './useVideoTutorial';

export function VideoDelMomento({ clave, titulo, revision }: { clave: string; titulo: string; revision: boolean }) {
  const v = useVideoTutorial(clave);
  return (
    <>
      <style>{CSS}</style>
      {v
        ? <video className="mk-vmom" data-clave={clave} src={v.archivo} poster={v.poster} controls playsInline preload="metadata" />
        : revision
          ? <div className="mk-vmom mk-vmom--lugar" data-clave={clave} role="note"><b>Tu video: {titulo}</b><span>Todavía no está grabado: va aquí.</span></div>
          : null}
    </>
  );
}

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md).
const CSS = `
.mk-vmom { display: block; width: min(420px, 100%); aspect-ratio: 16 / 9; border-radius: var(--r-lg); background: #000; margin: 6px 0 10px; }
.mk-vmom--lugar { background: var(--surface); border: 1.5px dashed var(--border-strong); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; padding: 10px; box-sizing: border-box; }
.mk-vmom--lugar b { font-size: var(--fs-sm); color: var(--ink); }
.mk-vmom--lugar span { font-size: var(--fs-meta); color: var(--dim); }
`;
