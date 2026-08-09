'use client';

// =============================================================================
// Las piezas visuales de Pricing — barras, veredicto y bloques plegables
// =============================================================================
// Viven aparte del contenido a propósito: la primera versión de esta pantalla era
// nueve tarjetas de prosa, todas del mismo peso, y el dato que decide el negocio
// —que el Pro cae en la peor banda de retención medida— quedaba en el séptimo
// párrafo de la séptima sección. El dueño lo dijo así: «es muy confusa, mucho
// texto». El problema no era el contenido sino que no había jerarquía.
//
// Las reglas que sigue (del método de dataviz, y son las que más se rompen solas):
//   · UNA serie = UN color. Nada de pintar cada barra más oscura donde es más
//     grande: eso codifica el largo dos veces y quema el único canal libre.
//   · Para señalar la que importa se usa ÉNFASIS —una destacada, el resto en
//     gris—, no una paleta de arcoíris.
//   · Marcas finas, punta redondeada de 4px anclada a la base, grilla en hairline.
//   · Se rotula SELECTIVAMENTE. Un número sobre cada barra es ruido que nadie lee.
//   · Toda barra tiene su valor en texto al lado: el color nunca es el único
//     portador del dato.

import { useId, type ReactNode } from 'react';
import { MONO } from '@/app/_ui';

export type Barra = {
  id: string;
  /** Lo que se lee a la izquierda. */
  label: string;
  valor: number;
  /** El valor ya formateado: la barra nunca es la única forma de leerlo. */
  texto: string;
  /** La que importa. Se pinta con el color de acento; el resto queda recesivo. */
  destacada?: boolean;
  /** Una línea corta debajo del rótulo. Opcional y breve. */
  nota?: string;
};

/**
 * Barras horizontales para comparar magnitudes. Horizontal y no vertical porque
 * los rótulos son frases («Se agota el free tier…») y en vertical se rotan o se
 * cortan — ambas cosas las castiga el catálogo de antipatrones.
 */
export function Barras({
  datos, max, sufijo = '', tono = 'mako', altura = 26, escala = 'lineal',
}: {
  datos: Barra[];
  /** El tope de la escala. Explícito para que dos gráficos se puedan comparar. */
  max?: number;
  sufijo?: string;
  /** El color del acento. `bad` cuando la magnitud grande es mala; `good`
   *  cuando la destacada es la que PASA — pintar de rojo al único canal que
   *  entra en el techo dice lo contrario de lo que dice el dato. */
  tono?: 'mako' | 'bad' | 'good' | 'info';
  altura?: number;
  /**
   * `log` para series que abarcan órdenes de magnitud. La tarifa va de 1 a 2.000
   * MT: en escala lineal las 25 operaciones baratas quedan todas pegadas al cero
   * y el gráfico solo dice «el Reel es caro», que ya se sabía.
   *
   * ⚠️ Una escala logarítmica SIN rotular es un antipatrón: el ojo lee áreas y
   * concluye proporciones falsas. Quien la use tiene que decirlo en pantalla —
   * por eso esto es una prop explícita y no una heurística sobre los datos.
   */
  escala?: 'lineal' | 'log';
}) {
  const tope = max ?? Math.max(...datos.map((d) => d.valor), 1);
  const acento = tono === 'bad' ? 'var(--bad)' : tono === 'good' ? 'var(--good)' : tono === 'info' ? 'var(--primary)' : 'var(--mako)';
  // log1p en vez de log: la tarifa tiene valores en 0 (lo automático no cobra) y
  // log(0) es -Infinity, que pinta una barra de ancho NaN sin decir nada.
  const ancho = (v: number) => (escala === 'log'
    ? (Math.log1p(Math.max(0, v)) / Math.log1p(tope)) * 100
    : (v / tope) * 100);

  return (
    <div role="img" aria-label={datos.map((d) => `${d.label}: ${d.texto}`).join('. ')}>
      {datos.map((d) => {
        // ⚠️ SE RECORTA AL 100%, y no es cosmética. `max` es una prop explícita
        // justamente para poder comparar dos gráficos, así que un valor por
        // encima del tope es normal — pero el ancho de la barra es un % del
        // carril, y `width: 1468%` no desborda la barra: desborda la PÁGINA.
        // Medido acá: dos canales arriba del tope llevaron el documento de
        // 1.440px a 7.656px de ancho. El recorte se avisa con la flecha.
        const crudo = ancho(d.valor);
        const cortada = crudo > 100;
        const pct = Math.min(100, Math.max(1.5, crudo));
        return (
          <div key={d.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,190px) 1fr auto', gap: 12, alignItems: 'center', padding: '7px 0' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: d.destacada ? 'var(--ink)' : 'var(--muted)', fontWeight: d.destacada ? 600 : 400, lineHeight: 1.3 }}>
                {d.label}
              </div>
              {d.nota && <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 1 }}>{d.nota}</div>}
            </div>
            {/* La pista de fondo da la escala sin necesidad de grilla. */}
            <div style={{ position: 'relative', height: altura, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${pct}%`,
                  background: d.destacada ? acento : 'var(--border-strong)',
                  // La punta redondeada solo si la barra TERMINA acá. Una barra
                  // cortada con la punta redondeada miente: parece que ese es su
                  // valor. Cortada va a filo, con la flecha al lado.
                  borderRadius: cortada ? '3px 0 0 3px' : '3px 4px 4px 3px',
                }}
              />
              {cortada && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', insetInlineEnd: 4, top: '50%', transform: 'translateY(-50%)',
                    fontFamily: MONO, fontSize: 11, color: 'var(--surface)', lineHeight: 1,
                  }}
                  title="se sale de la escala — el valor está al lado"
                >
                  »
                </span>
              )}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: d.destacada ? 'var(--ink)' : 'var(--muted)', minWidth: 58, textAlign: 'right' }}>
              {d.texto}{sufijo}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * El número que decide. Cifras proporcionales, no tabulares: a tamaño grande, los
 * dígitos de ancho fijo dejan huecos y se lee flojo.
 */
export function Cifra({ valor, unidad, rotulo, detalle, tono = 'neutral' }: {
  valor: string;
  /**
   * La unidad, aparte del número. Va en tamaño chico pegada al valor: «27,40» a
   * 34px con «US$/mes» a 13px se lee de un vistazo; «US$27,40/mes» todo junto y
   * grande hace que el ojo tenga que separar la cifra del sufijo.
   */
  unidad?: string;
  rotulo: string;
  detalle?: string;
  tono?: 'bad' | 'good' | 'warn' | 'neutral';
}) {
  const color = tono === 'bad' ? 'var(--bad)' : tono === 'good' ? 'var(--good)' : tono === 'warn' ? 'var(--warn)' : 'var(--ink)';
  return (
    // La grilla de 3 filas es lo que alinea las tarjetas entre sí. Sin ella cada
    // una mide lo que mide su rótulo, y un rótulo de dos líneas al lado de uno de
    // una deja el detalle de la del medio flotando a otra altura — que es
    // exactamente lo que se veía como «texto cortado a la mitad de la card».
    <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 0, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 34, lineHeight: 1.05, color, fontWeight: 600, letterSpacing: '-.02em' }}>{valor}</span>
        {unidad && <span style={{ fontSize: 13, color: 'var(--dim)', fontWeight: 500 }}>{unidad}</span>}
      </div>
      {/* `text-wrap: balance` reparte las líneas parejas en vez de dejar una
          palabra huérfana abajo — «…con todo | construido» era eso. */}
      <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 7, fontWeight: 600, lineHeight: 1.35, textWrap: 'balance' }}>{rotulo}</div>
      {detalle && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>{detalle}</div>}
    </div>
  );
}

/**
 * Un bloque que arranca CERRADO. Es lo que hace legible la pantalla: arriba la
 * conclusión, y el respaldo a un clic de distancia para quien lo quiera auditar.
 * `<details>` nativo — teclado y lector de pantalla ya funcionan.
 */
export function Plegable({ titulo, resumen, children, abierto = false }: {
  titulo: string;
  /** Qué se va a encontrar adentro. Se lee con el bloque cerrado. */
  resumen: string;
  children: ReactNode;
  abierto?: boolean;
}) {
  const id = useId();
  return (
    <details open={abierto} style={{ borderTop: '1px solid var(--border)' }}>
      <summary
        aria-controls={id}
        style={{ cursor: 'pointer', padding: '13px 0', listStyle: 'none', display: 'flex', gap: 10, alignItems: 'baseline' }}
      >
        <span aria-hidden style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)', transform: 'translateY(-1px)' }}>▸</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{titulo}</span>
        <span style={{ fontSize: 12, color: 'var(--faint)' }}>{resumen}</span>
      </summary>
      <div id={id} style={{ padding: '2px 0 18px 20px' }}>{children}</div>
    </details>
  );
}

/**
 * UN dato y UNA frase. Todo lo demás, plegado.
 *
 * Es la respuesta al reclamo del dueño sobre la parte 3: «pusiste muucha data
 * mucho texto todo junto». No sobraba análisis — sobraba análisis A LA VISTA.
 * Un párrafo de seis renglones arriba de una tabla de siete columnas obliga a
 * leer todo para saber si te interesa algo.
 *
 * La regla que impone: **sin abrir se ve un número y como mucho dos frases.**
 * Si algo no entra en dos frases, no es que haya que achicar la letra: es que
 * son dos secciones. El respaldo va adentro de `children`, a un clic, para
 * quien quiera auditarlo — que es la misma forma que ya tenía «El respaldo» y
 * que funcionó.
 */
export function Titular({ valor, unidad, frase, tono = 'neutral', abrir = 'Cómo sale este número', children }: {
  valor: string;
  unidad?: string;
  /** Una o dos frases. No más: el componente no las va a achicar por vos. */
  frase: ReactNode;
  tono?: 'bad' | 'good' | 'warn' | 'neutral';
  /** Qué promete el plegable. Se lee cerrado, así que dice el contenido. */
  abrir?: string;
  children?: ReactNode;
}) {
  const color = tono === 'bad' ? 'var(--bad)' : tono === 'good' ? 'var(--good)' : tono === 'warn' ? 'var(--warn)' : 'var(--ink)';
  return (
    <div>
      {/* El número y la frase van LADO A LADO en pantalla ancha: apilados, la
          frase queda tan lejos del dato que se leen como dos cosas. */}
      <div style={{ display: 'flex', gap: 22, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 38, lineHeight: 1, color, fontWeight: 600, letterSpacing: '-.025em' }}>{valor}</span>
          {unidad && <span style={{ fontSize: 13, color: 'var(--dim)', fontWeight: 500 }}>{unidad}</span>}
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, flex: '1 1 320px', minWidth: 0 }}>{frase}</div>
      </div>
      {children && (
        <div style={{ marginTop: 14 }}>
          <Plegable titulo={abrir} resumen="">{children}</Plegable>
        </div>
      )}
    </div>
  );
}
