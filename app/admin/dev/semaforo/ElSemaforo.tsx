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

const VALORES: { s: Semaforo; viejo: string; significa: string; caso: string }[] = [
  { s: 'verde', viejo: 'verde', significa: 'Entrega con normalidad', caso: 'Cuenta activa, campaña corriendo, nada que hacer' },
  { s: 'ambar', viejo: 'amarillo', significa: 'Todavía anda, pero mirálo', caso: 'Revisión de riesgo, saldo por agotarse, anuncio en revisión' },
  { s: 'rojo', viejo: 'rojo', significa: 'Está frenado ahora', caso: 'Cuenta deshabilitada, token vencido, anuncio rechazado' },
  { s: 'gris', viejo: 'na', significa: 'No aplica o no sabemos', caso: 'Pausado, archivado, o todavía sin leer' },
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
      <Section titulo="Los cuatro estados" nota="un solo tipo: Semaforo, en lib/mako-gramatica.ts" card>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {VALORES.map((v) => (
            <div key={v.s} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,110px) minmax(0,110px) minmax(0,1fr)', gap: 16, alignItems: 'start', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 12.5, color: 'var(--ink)' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', flex: 'none', background: colorDeSemaforo(v.s), outline: `3px solid ${bgDeSemaforo(v.s)}` }} aria-hidden />
                {v.s}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', textDecoration: v.viejo === v.s ? 'none' : 'line-through' }}>
                {v.viejo}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', fontWeight: 600 }}>{EMOJI_SEMAFORO[v.s]} {v.significa}</span>
                <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{v.caso}</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section titulo="Por qué había que unificarlo" nota="el síntoma era que no había síntoma" card>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.65, maxWidth: '70ch', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0 }}>
            El mismo concepto estaba declarado <strong>dos veces, con dos vocabularios</strong>:
            {' '}<code style={{ fontFamily: MONO, fontSize: 12 }}>Semaforo</code> decía <code style={{ fontFamily: MONO, fontSize: 12 }}>ambar</code> y
            {' '}<code style={{ fontFamily: MONO, fontSize: 12 }}>gris</code>; <code style={{ fontFamily: MONO, fontSize: 12 }}>SemaforoAviso</code> decía
            {' '}<code style={{ fontFamily: MONO, fontSize: 12 }}>amarillo</code> y <code style={{ fontFamily: MONO, fontSize: 12 }}>na</code>.
            No coincidían en <strong>dos de los cuatro valores</strong>, sobre 158 usos en 22 archivos.
          </p>
          <p style={{ margin: 0 }}>
            Un <code style={{ fontFamily: MONO, fontSize: 12 }}>switch</code> sobre el tipo equivocado es código
            perfectamente válido: nada rompe, nada avisa, y en algún lado se pinta un color que no
            corresponde. Por eso no lo encontraba nadie.
          </p>
          <p style={{ margin: 0 }}>
            Los nombres viejos <strong>siguen escritos en los datos</strong> (las ~48 filas de
            {' '}<code style={{ fontFamily: MONO, fontSize: 12 }}>CATALOGO_AVISOS</code>), así que se leen con
            {' '}<code style={{ fontFamily: MONO, fontSize: 12 }}>normalizarSemaforo()</code>, que acepta las dos escrituras.
            Renombrar el tipo y dejar los datos viejos habría sido cambiar un bug silencioso por otro.
          </p>
          <p style={{ margin: 0 }}>
            Y el color ya no se escribe al lado: <code style={{ fontFamily: MONO, fontSize: 12 }}>colorDeSemaforo</code> y
            {' '}<code style={{ fontFamily: MONO, fontSize: 12 }}>bgDeSemaforo</code> derivan de la paleta de tonos. Es lo único
            que impide que el ámbar del semáforo y el warning de un botón vuelvan a separarse — y que
            el ámbar se confunda con el dorado de marca, que es la confusión más vieja del producto.
          </p>
        </div>
      </Section>

      <Section titulo="Quién lo usa" nota="para saber qué se toca si cambia" card>
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
