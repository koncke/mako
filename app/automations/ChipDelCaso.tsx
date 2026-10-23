'use client';

// =============================================================================
// ChipDelCaso — el encabezado de un caso de «Probar» (16/10/2026)
// =============================================================================
// Martín (feedback del 16/10 por Cerebro, punto 2): «La animación arranca con el chip "Caso 1: Su reunión sigue en pie ·
// Nunca le escribiste", pero con otro diseño, para que no se confunda con un mensaje». Hasta ese día era una pastilla del
// sistema, igual a las de «⏳ Esperar» y «Fin». Ahora es una tarjeta de encabezado: el caso arriba, cada hecho como una
// etiqueta, y en un caso del AI Step lo que contesta el lead («Contesta: Pregunta el precio»).
// Lo dibujan el teléfono de WhatsApp (`ChatHilo`, por `renderMensaje`) y el de las redes (`SimuladorSocial`).

import type { CSSProperties } from 'react';

/**
 * 23/10/2026, Martín: «el título de los "casos" debería ser el nombre de la persona falsa, NOMBRE Y APELLIDO… En algún
 * lugar debe decir Caso 1… Tal vez en el subtítulo». `titulo` = la persona (lib/prueba-personas.ts), `subtitulo` = «Caso N»
 * y `foto` = su retrato. Sin `subtitulo` ni `foto` se dibuja como antes.
 */
export type DatosDelCaso = { titulo: string; subtitulo?: string; foto?: string; hechos: readonly string[]; contesta?: string | null };

const etiqueta: CSSProperties = {
  fontSize: 11.5, fontWeight: 600, lineHeight: 1.35, padding: '2px 8px', borderRadius: 6,
  background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)',
};

export function ChipDelCaso({ caso }: { caso: DatosDelCaso }) {
  return (
    <div data-chip-caso style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 8px' }}>
      <div style={{
        width: '100%', maxWidth: 440, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 12,
        background: 'var(--primary-bg)', border: '1px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {caso.subtitulo ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {caso.foto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img data-chip-foto src={caso.foto} alt="" loading="lazy" referrerPolicy="no-referrer" width={30} height={30}
                style={{ flex: 'none', width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface-2)' }} />
            )}
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span data-chip-titulo style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25, color: 'var(--ink)' }}>{caso.titulo}</span>
              <span data-chip-subtitulo style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--primary)' }}>{caso.subtitulo}</span>
            </span>
          </span>
        ) : (
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--primary)' }}>{caso.titulo}</span>
        )}
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {caso.hechos.map((h) => <span key={h} style={etiqueta}>{h}</span>)}
          {caso.contesta && <span data-chip-contesta style={{ ...etiqueta, background: 'var(--wa-bubble, var(--surface))' }}>💬 Contesta: {caso.contesta}</span>}
        </span>
      </div>
    </div>
  );
}
