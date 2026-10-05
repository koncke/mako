'use client';

// =============================================================================
// PanelMarketing — el aside NEGRO de toda pantalla de conexión
// =============================================================================
// Una sola pantalla que el cliente aprende una vez y reconoce en los 4 lugares
// donde aparece: el modal de /integraciones, el onboarding, y el panel de
// activación de cada tab que todavía no tiene su integración.
//
// La regla del panel — y es la que le da el efecto:
//   · SIN conexión  → carrusel de marketing: qué vas a poder hacer.
//   · CON conexión  → los FACTS: datos reales de SU cuenta, traídos del ping.
// O sea, la promesa se reemplaza por la prueba en el momento exacto en que el
// cliente aprieta el tilde. Un "ok ✓" no prueba nada; "Última llamada: Discovery
// con Juan, hace 2 días" prueba que quedó bien conectado.
//
// Vive sobre var(--sidebar): los colores son los del sidebar, NO los del tema
// claro (por eso --on-sidebar / --sidebar-text y no --ink / --dim).
// =============================================================================

import { useEffect, useState, type ReactNode } from 'react';
import { MakoLogo } from './MakoBrand';
import { SvcIcon, BrandDefs } from './ServicioVisual';
import type { Slide } from '@/lib/servicio-slides';

/** Un dato real del servicio conectado. `c` = color del valor (ej. rojo si adeuda). */
export type Fact = { k: string; v: string; c?: string };

// ── MaKo ⇄ servicio ───────────────────────────────────────────────────────────
// Cabecera del aside negro: el logo de MaKo, el del servicio, y en el medio dos
// líneas punteadas marchando en sentidos opuestos — los datos van y vienen.
// Son DOS líneas y no una sola oscilando: una que va y vuelve se lee como algo
// dudando; dos en paralelo se leen como un intercambio.
// Cada línea está dibujada HACIA su flecha, así el mismo dashoffset negativo
// (mkMarcha, globals.css) mueve la de arriba hacia el servicio y la de abajo
// hacia MaKo. El desfase de la de vuelta evita que marchen en espejo perfecto.
export function EnlaceMaKo({ k, nombre }: { k: string; nombre: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 22 }}
      role="img" aria-label={`MaKo intercambia datos con ${nombre}`}>
      <MakoLogo size={40} />
      {/* Tramo corto y de ancho FIJO: los dos logos tienen que leerse como un par,
          no como dos cosas lejanas unidas por un cable. Por eso no va flex:1. */}
      <svg viewBox="0 0 96 34" width="96" height="34" style={{ flex: 'none' }} aria-hidden focusable="false">
        <path className="mk-enlace-linea" d="M3 12 H83" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M92 12 l-8 -4.5 v9 z" fill="var(--accent)" />
        <path className="mk-enlace-linea" style={{ animationDelay: '-.45s' }} d="M93 24 H13" stroke="var(--sidebar-text)" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M4 24 l8 -4.5 v9 z" fill="var(--sidebar-text)" />
      </svg>
      <SvcIcon k={k} box={40} radius={11} size={23} />
    </div>
  );
}

// `arriba` va DENTRO del bloque centrado, no antes: así el enlace MaKo⇄servicio
// queda a media altura del panel junto al texto que acompaña, en vez de pegado
// al techo. Queda fuera del div con key={n} para que no se re-monte (y vuelva a
// hacer el fade) en cada slide.
export function Carrusel({ slides, arriba }: { slides: Slide[]; arriba?: ReactNode }) {
  const [n, setN] = useState(0);
  const [pausa, setPausa] = useState(false);
  const total = slides.length;

  // Autoavance suave; se frena si el mouse está encima o si tocaste un punto.
  useEffect(() => {
    if (pausa || total < 2) return;
    const id = setTimeout(() => setN((v) => (v + 1) % total), 5200);
    return () => clearTimeout(id);
  }, [n, pausa, total]);

  const s = slides[Math.min(n, total - 1)];
  if (!s) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
      {/* Los <symbol> de las marcas los monta el propio panel. Antes dependía de
          que los montara quien lo llamaba, y donde no lo hacían (el onboarding
          del Chatbot) el <use href="#ic-whatsapp"> no resolvía nada y quedaba
          un cuadrado verde liso. Montarlos dos veces es inocuo. */}
      <BrandDefs />
      {/* Vive en el aside NEGRO: los colores son los del sidebar, no los del tema claro. */}
      {/* El min-height va en .mk-svc-carrusel (globals.css), no acá: inline le
          ganaría al min-height:0 del modo apilado y lo volvería letra muerta. */}
      <div className="mk-svc-carrusel" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {arriba}
        {/* key={n} → se remonta y vuelve a correr el fade en cada slide */}
        <div key={n} style={{ animation: 'mkFade .5s ease' }}>
          <h4 style={{ margin: 0, fontWeight: 600, fontSize: 17, letterSpacing: '-0.018em', lineHeight: 1.25, color: 'var(--on-sidebar)' }}>{s.t}</h4>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--sidebar-text)', lineHeight: 1.55 }}>{s.d}</p>
        </div>
      </div>
      {total > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          {slides.map((sl, k) => (
            <button key={sl.t} type="button" title={sl.t} aria-label={sl.t} aria-current={k === n}
              onClick={() => { setN(k); setPausa(true); }}
              style={{ flex: 1, height: 3, padding: 0, border: 0, borderRadius: 999, cursor: 'pointer', background: k === n ? 'var(--accent)' : 'rgba(255,255,255,.2)', transition: 'background .25s ease' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
/**
 * El aside negro entero: eyebrow + enlace MaKo⇄servicio + (facts | carrusel).
 * `facts` gana sobre `slides`: si ya hay datos reales, el marketing sobra.
 */
export function PanelMarketing({ servicioKey, nombre, slides, facts, eyebrow, nota }: {
  servicioKey: string;
  nombre: string;
  slides: Slide[];
  /** Datos en vivo del servicio. Si vienen, reemplazan al carrusel. */
  facts?: Fact[];
  /** Línea mono de arriba. Default: "✦ Con {nombre} conectado". */
  eyebrow?: string;
  /** Pie opcional bajo los facts (ej. "Esto es lo que veo de tu cuenta"). */
  nota?: string;
}) {
  const conectado = (facts?.length ?? 0) > 0;
  return (
    <div className="mk-svc-aside" style={{ display: 'flex', flexDirection: 'column', padding: 26, minWidth: 0 }}>
      <div style={{ fontFamily: MONO_P, fontSize: 11, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 18 }}>
        {eyebrow ?? (conectado ? `✦ ${nombre} está conectado` : `✦ Con ${nombre} conectado`)}
      </div>

      {conectado ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <EnlaceMaKo k={servicioKey} nombre={nombre} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'mkFade .5s ease' }}>
            {facts!.map((f) => (
              <div key={f.k} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 11, padding: '11px 13px' }}>
                <div style={{ fontFamily: MONO_P, fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 5 }}>{f.k}</div>
                <div style={{ fontFamily: MONO_P, fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', color: f.c ?? 'var(--on-sidebar)', wordBreak: 'break-word' }}>{f.v}</div>
              </div>
            ))}
          </div>
          {nota && <div style={{ fontSize: 12, color: 'var(--sidebar-text)', lineHeight: 1.5, marginTop: 14 }}>{nota}</div>}
        </div>
      ) : (
        <Carrusel slides={slides} arriba={<EnlaceMaKo k={servicioKey} nombre={nombre} />} />
      )}
    </div>
  );
}

const MONO_P = "'Geist Mono', monospace";
