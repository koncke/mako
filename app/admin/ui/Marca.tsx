'use client';

// =============================================================================
// La marca de MaKo, junta por primera vez
// =============================================================================
// Estaba repartida en cinco lugares que no se hablan entre sí:
//   · el dorado y los neutros      → app/globals.css
//   · el logo y el wordmark        → app/_components/MakoBrand.tsx
//   · la voz de la IA              → lib/mako-persona.ts + lib/mako-prompts.ts
//   · las reglas de copy de la UI  → docs/mapa-del-proyecto.md
//   · el material descargable      → /conocimientos → «Branding MaKo»
//
// «Branding MaKo» dentro de Conocimientos NO es un manual: es una GALERÍA de
// archivos (logos, gráficos, animaciones, íconos y videos) que vive en el bucket
// privado `branding` de Storage. No tiene una sola línea sobre color, tipografía
// o voz. Por eso lo de acá abajo se sacó del código, no de ahí.
//
// Las piezas se MONTAN, no se dibujan: `MakoLogo`, `MakoWord` y `MakoStar` son
// los componentes que usa la app.

import Link from '@/app/_ui/Link';
import { Section, MONO } from '@/app/_ui';
import { MakoLogo, MakoWord, MakoStar } from '@/app/_components/MakoBrand';

const CAJA = { border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)' } as const;

function Muestra({ titulo, fondo, children, nota }: { titulo: string; fondo: string; children: React.ReactNode; nota: string }) {
  return (
    <div style={CAJA}>
      <div style={{ background: fondo, padding: '26px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 96, borderRadius: 'var(--r-md) var(--r-md) 0 0' }}>
        {children}
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)' }}>{titulo}</div>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>{nota}</div>
      </div>
    </div>
  );
}

export function LaMarca() {
  return (
    <>
      <Section titulo="Las piezas">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
          <Muestra titulo="Logo" fondo="var(--sidebar)" nota="MakoLogo · el de la barra">
            <MakoLogo size={54} />
          </Muestra>
          <Muestra titulo="Logo + palabra" fondo="var(--sidebar)" nota="MakoLogo + MakoWord">
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <MakoLogo size={32} />
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1 }}>
                <MakoWord base="#F3F0E7">MaKo</MakoWord>
              </span>
            </span>
          </Muestra>
          <Muestra titulo="Palabra sobre claro" fondo="var(--surface-2)" nota="MakoWord base clara">
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em' }}>
              <MakoWord base="#1A1813">MaKo</MakoWord>
            </span>
          </Muestra>
          <Muestra titulo="Chispa" fondo="var(--surface-2)" nota="MakoStar · botones «pedirle a MaKo»">
            <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <MakoStar size={30} />
              <MakoStar size={20} />
              <MakoStar size={14} />
            </span>
          </Muestra>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--dim)', lineHeight: 1.55 }}>
          El logo que dibuja la app no es un archivo: es SVG en línea en <code style={{ fontFamily: MONO }}>MakoBrand.tsx</code>.
          <code style={{ fontFamily: MONO }}> public/mako.svg</code> es el logo viejo y además no es vector de verdad —
          lleva PNG en base64 adentro. No usarlo.
        </p>
      </Section>

      <Section titulo="Cuándo puede brillar">
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'center', padding: '20px 22px', background: 'var(--sidebar)', borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em' }}>
            <MakoWord base="#F3F0E7">MaKo</MakoWord>
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: '#949CAA' }}>en reposo</span>
          <span style={{ width: 1, height: 26, background: 'rgba(255,255,255,.14)' }} />
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em' }}>
            <MakoWord base="#F3F0E7" shimmer>MaKo</MakoWord>
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: '#949CAA' }}>shimmer</span>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6 }}>
          El barrido se pasa a mano y solo cuando <strong style={{ color: 'var(--ink)' }}>marca un momento</strong>: la IA
          arrancando, un resultado que acaba de llegar. Un wordmark que brilla siempre en la barra y adentro de cada modal
          deja de decir «MaKo está haciendo algo» y pasa a ser decoración — que es justo el significado que el dorado
          viene a recuperar.
        </p>
      </Section>

      <Section titulo="Cómo firma la IA">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {[
            { q: 'En un mensaje que sale', v: '— MaKo', d: 'guion largo + espacio, al final' },
            { q: 'En el historial y las etapas', v: 'MaKo', d: 'AUTOR_SISTEMA · lib/etapa-historial.ts' },
            { q: 'Como setter de una nutrición', v: 'MaKo', d: 'MAKO_SETTER · lib/pipeline.ts' },
          ].map((f) => (
            <div key={f.q} style={{ ...CAJA, padding: '13px 15px' }}>
              <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{f.q}</div>
              <div style={{ fontSize: 'var(--fs-card)', fontWeight: 600, color: 'var(--ink)', margin: '5px 0 4px' }}>{f.v}</div>
              <code style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{f.d}</code>
            </div>
          ))}
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6 }}>
          Un solo actor para todo el repo: el chip del historial y el setter de las nutriciones automáticas hablan
          del mismo «MaKo».
        </p>
      </Section>

      <Section titulo="La voz">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          <div style={{ ...CAJA, padding: '15px 17px' }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 9 }}>MaKo hablándole a un lead</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5 }}>
              <li><strong style={{ color: 'var(--ink)' }}>Voseo rioplatense</strong>, siempre. Es la persona de marca.</li>
              <li>Honestidad radical, concreto, remates de una línea.</li>
              <li><strong style={{ color: 'var(--ink)' }}>Nunca termina con una pregunta</strong>: cierra con una recomendación o un próximo paso.</li>
              <li>Hipótesis, no verdades: «el dato sugiere…», y propone un experimento.</li>
              <li>Nunca: humo, urgencia falsa, cifras mágicas, datos inventados.</li>
            </ul>
            <code style={{ display: 'block', fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 11 }}>lib/mako-persona.ts · lib/mako-prompts.ts</code>
          </div>
          <div style={{ ...CAJA, padding: '15px 17px' }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 9 }}>La interfaz</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5 }}>
              <li><strong style={{ color: 'var(--ink)' }}>Español neutro profesional</strong>, sin voseo. El producto se usa en México y el rioplatense se lee como descuido.</li>
              <li>Cada tab, botón o card se entiende <strong style={{ color: 'var(--ink)' }}>solo</strong>. Explícito le gana a ingenioso.</li>
              <li>Los apodos van acompañados: «Prioridades — El Perro Guardián», nunca a secas.</li>
              <li><strong style={{ color: 'var(--ink)' }}>Sin subtítulos.</strong> La única bajada admitida es la línea de propósito del PageHeader, y si se deduce del título va vacía.</li>
              <li>Cero emojis: los botones llevan <code style={{ fontFamily: MONO }}>{'<Icon>'}</code>.</li>
            </ul>
            <code style={{ display: 'block', fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 11 }}>docs/mapa-del-proyecto.md</code>
          </div>
        </div>
      </Section>

      <Section titulo="El material descargable">
        <div style={{ ...CAJA, padding: '17px 19px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
            {[
              { s: 'La marca', d: 'logotipo, insignia y letras, con sus animaciones de fondo transparente' },
              { s: 'Gráficos', d: 'los de las landings, en PNG de alta resolución' },
              { s: 'Animaciones', d: 'las de los VSL, en MP4' },
              { s: 'Íconos y logos', d: 'los de las apps y los logos originales' },
              { s: 'Videos', d: 'los mini-VSL de cada funcionalidad' },
            ].map((x) => (
              <div key={x.s}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)' }}>{x.s}</div>
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)', marginTop: 3, lineHeight: 1.45 }}>{x.d}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6 }}>
            Vive en <Link href="/conocimientos" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conocimientos → Branding MaKo</Link>,
            no aquí: son archivos para descargar, no piezas de interfaz. Los bytes están en el bucket privado
            <code style={{ fontFamily: MONO }}> branding</code> de Storage y se sirven con URL firmada — nunca directa.
            Los archivos originales <strong style={{ color: 'var(--ink)' }}>no están versionados en el repo</strong>: se
            subieron desde el escritorio, así que Storage es la única copia durable.
          </p>
        </div>
      </Section>

      <Section titulo="Lo que todavía no cierra">
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          {[
            { q: 'El avatar de los grupos de WhatsApp todavía pinta la marca con los dos dorados viejos', d: 'lib/mako-grupo.ts:55 · genera SVG como string en el servidor, así que no puede usar var(): necesita importar los hex de un módulo único' },
            { q: 'MakoBrand define seis neutros cálidos propios que no son tokens', d: '#1A1813, #F3F0E7, #2A251C, #171511, #A39E91, #6B675C — y globals.css dice que los neutros de la app son fríos' },
            { q: 'El wordmark grande usa Georgia serif, que no es la tipografía de la app ni un token', d: 'MakoBrand.tsx:138 vs. Geist en tokens.ts' },
            { q: 'La alternancia de color letra por letra (M dorada, a oscura, K dorada, o oscura) solo vive en un render', d: 'MakoBrand.tsx:166 · es una regla de marca sin escribir' },
            { q: 'El tipo BrandingSeccion no incluye «marca», que es la sección que abre por defecto', d: 'lib/branding.ts:17 vs. migración 0100 · no rompe hoy porque hay un cast' },
          ].map((x, i) => (
            <li key={i} style={{ display: 'grid', gridTemplateColumns: '26px minmax(0,1fr)', gap: 12, padding: '12px 15px', background: 'var(--surface)' }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.5 }}>{x.q}</span>
                <code style={{ display: 'block', fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 4, lineHeight: 1.5 }}>{x.d}</code>
              </span>
            </li>
          ))}
        </ol>
        <p style={{ margin: '14px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--dim)', lineHeight: 1.55 }}>
          La regla «un solo hex dorado» está escrita y se cumple en <code style={{ fontFamily: MONO }}>MakoBrand.tsx</code>.
          La unificación del resto quedó a medias.
        </p>
      </Section>
    </>
  );
}
