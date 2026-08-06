'use client';

// =============================================================================
// MakoBrand — identidad visual de MaKo: estrella, logo y loader de bienvenida
// =============================================================================
// MakoStar:  la chispa ✨ vectorial de MaKo, que BRILLA (para los botones).
// MakoLogo:  el nuevo logo (badge con la chispa) con animación de ENTRADA de una
//            sola vez (no es un loader: entra y se queda, no queda girando).
// MakoIntro: loader gigante de bienvenida al entrar a la tab "Preguntale a MaKo".

import { useId, type ReactNode } from 'react';

// Los dos extremos del gradiente de marca. Salen del ÚNICO dorado del sistema
// (--mako, #F2B01E, globals.css): antes este archivo definía sus propios hex
// (#F6D365 y #EF9F27), y con el --accent y el --accent-soft de entonces la
// marca tenía CUATRO dorados distintos. Un `var()` funciona igual dentro de un
// stop-color de SVG, así que no hace falta duplicar nada.
const GOLD_1 = 'var(--mako-lite)';
const GOLD_2 = 'var(--mako)';
/** El oscuro del wordmark y del badge. No es dorado: es el fondo de marca. */
const INK = '#1A1813';

// Chispa de 4 puntas centrada en el origen (0,0), radio ~11. Se reutiliza en
// todas las piezas para que la marca sea coherente.
const SPARK = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';

// ── Estrella que brilla (botones "✨ MaKo") ──────────────────────────────────
export function MakoStar({ size = 14, color }: { size?: number; color?: string }) {
  const uid = `mks${useId().replace(/[:]/g, '')}`;
  const fill = color ?? `url(#${uid}-g)`;
  const css = `
    .${uid}-spark { transform-box: fill-box; transform-origin: center; animation: ${uid}-tw 2.4s ease-in-out infinite; }
    .${uid}-mini  { transform-box: fill-box; transform-origin: center; animation: ${uid}-mn 2.4s ease-in-out infinite; }
    @keyframes ${uid}-tw { 0%,100% { transform: scale(1); opacity: .9; } 45% { transform: scale(1.18); opacity: 1; } }
    @keyframes ${uid}-mn { 0%,100% { transform: scale(.5); opacity: .35; } 50% { transform: scale(1); opacity: 1; } }
  `;
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" role="img" aria-label="MaKo" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GOLD_1} />
          <stop offset="100%" stopColor={GOLD_2} />
        </linearGradient>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </defs>
      <path className={`${uid}-spark`} d={SPARK} fill={fill} />
      <circle className={`${uid}-mini`} cx="8.5" cy="-8.5" r="1.6" fill={fill} />
    </svg>
  );
}

// ── Texto de marca ("MaKo") ──────────────────────────────────────────────────
// Un destello dorado puede barrer las letras, PERO ya no por defecto. Regla del
// documento de rediseño: «Reservar gradientes, destellos y barridos para
// momentos puntuales de activación o proceso de MaKo». Un wordmark que brilla
// para siempre en la barra lateral y adentro de cada modal deja de significar
// «MaKo está haciendo algo» y pasa a ser decoración — y es justo el significado
// que el rediseño le quiere devolver al dorado.
//
// Pasá `shimmer` solo cuando el barrido MARQUE un momento: la IA arrancando, un
// resultado que acaba de llegar.
export function MakoWord({ children, base = '#F3F0E7', shimmer = false }: { children: ReactNode; base?: string; shimmer?: boolean }) {
  const uid = `mkw${useId().replace(/[:]/g, '')}`;
  const css = `
    .${uid} {
      background: linear-gradient(100deg, ${base} 0%, ${base} 36%, ${GOLD_1} 50%, ${base} 64%, ${base} 100%);
      background-size: 220% 100%;
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent; color: transparent;
      ${shimmer ? `animation: ${uid}-sh 2.6s ease-in-out infinite;` : 'background-position: -30% 0;'}
    }
    @keyframes ${uid}-sh { 0% { background-position: 130% 0; } 55%, 100% { background-position: -30% 0; } }
    @media (prefers-reduced-motion: reduce) { .${uid} { animation: none; background-position: -30% 0; } }
  `;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <span className={uid}>{children}</span>
    </>
  );
}

// ── Logo nuevo de MaKo (badge + chispa, con animación de entrada) ────────────
export function MakoLogo({ size = 30, animate = true }: { size?: number; animate?: boolean }) {
  const uid = `mkl${useId().replace(/[:]/g, '')}`;
  const css = `
    .${uid}-badge { transform-box: fill-box; transform-origin: center; ${animate ? `animation: ${uid}-in .6s cubic-bezier(.34,1.56,.64,1) both;` : ''} }
    .${uid}-spark { transform-box: fill-box; transform-origin: center; ${animate ? `animation: ${uid}-sp .55s cubic-bezier(.34,1.56,.64,1) .26s both;` : ''} }
    @keyframes ${uid}-in { 0% { transform: scale(.4) rotate(-18deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
    @keyframes ${uid}-sp { 0% { transform: scale(0) rotate(-90deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
  `;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="MaKo" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2A251C" />
          <stop offset="100%" stopColor="#171511" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GOLD_1} />
          <stop offset="100%" stopColor={GOLD_2} />
        </linearGradient>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </defs>
      <g className={`${uid}-badge`}>
        <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill={`url(#${uid}-bg)`} stroke={GOLD_2} strokeOpacity="0.35" strokeWidth="1" />
      </g>
      <g transform="translate(24 24) scale(1.55)">
        <g className={`${uid}-spark`}>
          <path d={SPARK} fill={`url(#${uid}-gold)`} />
        </g>
      </g>
    </svg>
  );
}

// ── Loader gigante de bienvenida ("Preguntale a MaKo") ───────────────────────
// Entrada distinta al resto: la chispa estalla en el centro, dos anillos se
// expanden y el wordmark "MaKo" aparece. Dura ~1.5s y se desvanece sola.
export function MakoIntro({ saludo, caption = 'Preparando tus números…' }: { saludo?: string; caption?: string } = {}) {
  const uid = `mki${useId().replace(/[:]/g, '')}`;
  const css = `
    .${uid}-wrap {
      position: fixed; inset: 0; z-index: 200;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
      background: radial-gradient(120% 120% at 50% 42%, #FBF7EE 0%, #F2F0EA 72%);
      animation: ${uid}-fade 1.5s ease forwards;
    }
    @keyframes ${uid}-fade { 0% { opacity: 0; } 9% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; visibility: hidden; } }

    .${uid}-spark { transform-box: fill-box; transform-origin: center; animation: ${uid}-pop .8s cubic-bezier(.34,1.56,.64,1) both; }
    @keyframes ${uid}-pop { 0% { transform: scale(0) rotate(-70deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }

    .${uid}-ring { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ${uid}-burst 1.15s ease-out both; }
    .${uid}-ring2 { animation-delay: .28s; }
    @keyframes ${uid}-burst { 0% { transform: scale(.25); opacity: .55; } 100% { transform: scale(2.1); opacity: 0; } }

    .${uid}-word { display: flex; gap: 1px; font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 56px; line-height: 1; }
    .${uid}-ltr { opacity: 0; transform: translateY(12px); animation: ${uid}-rise .5s ease both; }
    .${uid}-l1 { animation-delay: .42s; } .${uid}-l2 { animation-delay: .50s; }
    .${uid}-l3 { animation-delay: .58s; } .${uid}-l4 { animation-delay: .66s; }
    @keyframes ${uid}-rise { to { opacity: 1; transform: translateY(0); } }

    .${uid}-cap { opacity: 0; font-family: 'Geist Mono', monospace; font-size: 11.5px; letter-spacing: .18em; text-transform: uppercase; color: #A39E91; animation: ${uid}-rise .5s ease .8s both; }
    .${uid}-saludo { opacity: 0; font-family: 'Geist', sans-serif; font-size: 19px; font-weight: 500; color: #6B675C; animation: ${uid}-rise .5s ease .34s both; }
  `;
  return (
    <div className={`${uid}-wrap`} aria-label="Abriendo MaKo">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <svg width={150} height={150} viewBox="-75 -75 150 150" role="img" aria-label="MaKo">
        <defs>
          <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={GOLD_1} />
            <stop offset="100%" stopColor={GOLD_2} />
          </linearGradient>
        </defs>
        <circle className={`${uid}-ring`} cx="0" cy="0" r="26" fill="none" stroke={GOLD_2} strokeWidth="2" strokeOpacity="0.55" />
        <circle className={`${uid}-ring ${uid}-ring2`} cx="0" cy="0" r="26" fill="none" stroke={GOLD_1} strokeWidth="2" strokeOpacity="0.45" />
        <g transform="scale(4.4)">
          <path className={`${uid}-spark`} d={SPARK} fill={`url(#${uid}-gold)`} />
        </g>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
        {saludo && <div className={`${uid}-saludo`}>{saludo}</div>}
        <div className={`${uid}-word`}>
          <span className={`${uid}-ltr ${uid}-l1`} style={{ color: GOLD_2 }}>M</span>
          <span className={`${uid}-ltr ${uid}-l2`} style={{ color: INK }}>a</span>
          <span className={`${uid}-ltr ${uid}-l3`} style={{ color: GOLD_2 }}>K</span>
          <span className={`${uid}-ltr ${uid}-l4`} style={{ color: INK }}>o</span>
        </div>
      </div>
      {caption && <div className={`${uid}-cap`}>{caption}</div>}
    </div>
  );
}
