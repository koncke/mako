'use client';

// =============================================================================
// El semáforo, renderizado — los cuatro estados y de dónde sale cada color
// =============================================================================
// Vivía adentro del catálogo del rediseño, y no correspondía: el semáforo no es
// una pieza del sistema de diseño, es un CONCEPTO del producto que lo cruza
// entero (la salud de Meta, los avisos de MaKo, el estado de cada campaña).
// Apareció trabajando la gramática de MaKo, pero es otra cosa, y mezclarlos
// hacía que el registro del rediseño hablara de algo que no era el rediseño.

import { Section } from '@/app/_ui';
import { MONO } from '@/app/_ui';
import { EMOJI_SEMAFORO, type Semaforo } from '@/lib/mako-gramatica';
import { colorDeSemaforo, bgDeSemaforo } from '@/lib/meta-health-ui';

const VALORES: { s: Semaforo; viejo: string; caso: string }[] = [
  { s: 'verde', viejo: 'verde', caso: 'Cuenta activa, campaña corriendo, nada que hacer' },
  { s: 'ambar', viejo: 'amarillo', caso: 'Revisión de riesgo, saldo por agotarse, anuncio en revisión' },
  { s: 'rojo', viejo: 'rojo', caso: 'Cuenta deshabilitada, token vencido, anuncio rechazado' },
  { s: 'gris', viejo: 'na', caso: 'Pausado, archivado, o todavía sin leer' },
];

/** Quién lo consume hoy. Sale de grepear `semaforo` sobre el repo. */
const CONSUMIDORES: { donde: string; que: string }[] = [
  { donde: 'lib/meta-health.ts', que: 'La salud de la cuenta de Meta y de cada nodo (campaña, conjunto, anuncio)' },
  { donde: 'app/marketing/salud/SaludBoard.tsx', que: 'La pantalla donde el dueño lo ve' },
  { donde: 'app/ads-manager/CampanasBrowser.tsx', que: 'El punto de color de cada fila del Ads Manager' },
  { donde: 'lib/avisos-catalogo.ts', que: 'Los ~48 avisos que MaKo manda por WhatsApp' },
  { donde: 'lib/reportes.ts', que: 'El reporte diario' },
];

export function ElSemaforo() {
  return (
    <>
      {/* El porqué de la unificación NO va acá: está en el Change History de esta
          misma tab, que es donde se lee. Repetirlo tapaba lo único que esta vista
          puede dar y ningún texto puede — ver los cuatro colores. */}
      <Section titulo="Los cuatro estados" card>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {VALORES.map((v) => (
            <div key={v.s} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,104px) minmax(0,86px) 24px minmax(0,1fr)', gap: 14, alignItems: 'center', padding: '11px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: MONO, fontSize: 12.5, color: 'var(--ink)' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', flex: 'none', background: colorDeSemaforo(v.s), outline: `3px solid ${bgDeSemaforo(v.s)}` }} aria-hidden />
                {v.s}
              </span>
              {/* El nombre viejo, tachado: es la mitad del valor de esta tabla. */}
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', textDecoration: v.viejo === v.s ? 'none' : 'line-through' }}>
                {v.viejo}
              </span>
              {/* El emoji es el valor REAL que viaja en los mensajes de WhatsApp. */}
              <span style={{ fontSize: 14 }} title="En los mensajes">{EMOJI_SEMAFORO[v.s]}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>{v.caso}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section titulo="Quién lo usa" card>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {CONSUMIDORES.map((c) => (
            <div key={c.donde} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,290px) minmax(0,1fr)', gap: 16, alignItems: 'baseline', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <code style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)' }}>{c.donde}</code>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>{c.que}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
