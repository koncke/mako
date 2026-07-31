'use client';

// =============================================================================
// TutorialAprobacionMeta — cómo reducir que Meta retenga los anuncios
// =============================================================================
// Acompaña al botón "Aprobar en Meta". Meta llama a esto "aprobación de pares"
// (peer approval) y vive en el Centro de seguridad del portfolio.
//
// HONESTIDAD (esto es lo que hace útil al tutorial): el nivel base NO se puede
// apagar. La doc oficial dice que "solo los anuncios sospechosos requieren
// aprobación… está incluido en TODOS los niveles de protección". Lo que sí se
// revisa una vez son cuatro disparadores opt-in que, si están prendidos, hacen
// caer anuncios de forma sistemática. Prometer que se puede desactivar del todo
// sería mentira y el usuario perdería la tarde buscando un interruptor que no
// existe.
//
// La config del Centro de seguridad NO es legible por la API: no hay forma de
// verificar desde acá si el usuario lo hizo. Por eso es un instructivo, no un
// checklist con estado.
// =============================================================================

import { useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const SECURITY_CENTER = 'https://business.facebook.com/settings';

const PASOS: Array<{ titulo: string; detalle: string }> = [
  {
    titulo: 'Abrí el Centro de seguridad',
    detalle: 'En Meta Business Suite: Configuración → Centro de seguridad → Aprobación de pares (Peer approval). Necesitás control total del portfolio y que el portfolio sea dueño de la cuenta publicitaria.',
  },
  {
    titulo: 'Bajá el nivel de protección de la cuenta',
    detalle: 'En “Seguridad de la cuenta publicitaria” → Administrar, elegí tu cuenta. Si está en “Protección adicional” (todos los anuncios necesitan aprobación), pasala a “Protección predeterminada”. Si ya está en la predeterminada, no hay nada que bajar.',
  },
  {
    titulo: 'Revisá la seguridad de dominio',
    detalle: 'En “Seguridad de dominio” → Administrar. Si la lista tiene dominios cargados, TODO anuncio que apunte a un dominio que no esté ahí queda retenido. Agregá el dominio de tus landings, o vaciá la lista para desactivar esa protección.',
  },
  {
    titulo: 'Revisá la seguridad a nivel negocio',
    detalle: 'En “Seguridad a nivel negocio” → Administrar. Si está activo “Bloquear anuncios CTX”, todos los anuncios que abren WhatsApp/Messenger/Instagram Direct necesitan aprobación. Lo mismo con la lista de países: lo que segmente fuera de esa lista queda retenido.',
  },
  {
    titulo: 'Sumá aprobadores',
    detalle: 'En la misma pantalla podés designar quién puede aprobar, así no depende de una sola persona. Ojo: quien no tuvo actividad en la cuenta en los últimos 90 días no es elegible.',
  },
];

export function TutorialAprobacionMeta({ compacto = false }: { compacto?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const linkStyle: CSSProperties = {
    background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
    color: 'var(--dim)', fontFamily: MONO, fontSize: compacto ? 10.5 : 11,
    letterSpacing: '.04em', textDecoration: 'underline', textUnderlineOffset: 2,
  };
  return (
    <div style={{ width: '100%' }}>
      <button type="button" onClick={() => setAbierto((v) => !v)} style={linkStyle}>
        {abierto ? '▴ Ocultar' : '▾ Cómo hacer que Meta lo pida menos'}
      </button>
      {abierto && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, margin: 0 }}>
            Meta llama a esto <b>aprobación de pares</b>. El nivel base <b>no se puede apagar</b>: siempre va a retener lo que su sistema marque como sospechoso. Lo que sí podés hacer, una sola vez, es revisar los cuatro filtros que retienen anuncios de forma sistemática.
          </p>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PASOS.map((p) => (
              <li key={p.titulo} style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>
                <b>{p.titulo}.</b> <span style={{ color: 'var(--dim)' }}>{p.detalle}</span>
              </li>
            ))}
          </ol>
          <a href={SECURITY_CENTER} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
            Abrir la configuración de Meta ↗
          </a>
          <p style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5, margin: 0 }}>
            Esta configuración no se puede leer desde acá (Meta no la expone por API), así que MaKo no puede confirmarte si quedó bien: revisala en pantalla.
          </p>
        </div>
      )}
    </div>
  );
}
