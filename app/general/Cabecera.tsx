// =============================================================================
// La cabecera de /general — el norte del trimestre y la acción del día, juntos
// =============================================================================
// ⚠️ TERCERA REESCRITURA DE ESTE BLOQUE, Y LAS TRES ESTÁN ANOTADAS PORQUE EL ERROR
// FUE DISTINTO CADA VEZ.
//
// v1 (`HeroGoal`): un bloque oscuro con un contador de 108 px, cuarenta bloquecitos
// de «1 bloque = 1 cierre» y dos tarjetas abajo. Medía CIERRES, que es la
// consecuencia, y sobre un workspace sin meta cargada decía «Camino a los 20
// cierres · 0/20» — un número inventado (`?? 20`) como el texto más grande.
//
// v2 (`TiraQ`): lo encogió a una línea sin caja, buscando «minimalista». El dueño
// lo reportó así: «sacaste el semáforo y otras cosas que SÍ estaban bien y ahora se
// ve mucho peor, no se ve nada». Encoger no era el arreglo: /general quedó como la
// única pantalla del producto sin una sola superficie, un documento suelto al lado
// de /comercial y /marketing, que son ocho y una secciones en tarjeta.
//
// v3 es esto, y son DOS decisiones del dueño, no opciones a rediscutir (08/09/2026):
//   · vuelve el bloque oscuro grande, pero mide FACTURACIÓN y no cierres;
//   · lleva a la vez el avance del trimestre y la acción del día, «sin que ninguno
//     se coma la pantalla».
//
// Cómo se cumple lo segundo, que es lo difícil: NO con dos tamaños peleando, sino
// con dos IDIOMAS. La izquierda es un NÚMERO (grande, con su barra); la derecha es
// una FRASE (con el único botón azul lleno de la pantalla). Los dos títulos son
// pares tipográficos —21 px los dos— y lo único que domina es la cifra. La acción
// bajó de 40 px a 21: pierde tamaño y gana contraste y posición, que sobre la única
// isla oscura de la app pesa más.
//
// ⚠️ Y LA REGLA QUE SOSTIENE TODO EL BLOQUE: el hero tiene DOS trabajos que no se
// pisan. El número es el OBJETIVO; la frase es `elegirFoco`. El hero NUNCA pinta el
// copy de una alerta — si lo hiciera, con el semáforo abajo habría TRES lugares
// diciendo lo mismo, que es exactamente el problema medido el 07/09.
//
// Paleta: acá adentro NO existen `--ink`, `--dim` ni `--faint`. Sobre `--sidebar`
// miden 1,01:1, 2,09:1 y 3,61:1 — o sea invisible, ilegible y al borde. Va
// `--on-sidebar` (16,57) para lo que se lee y `--sidebar-text` (6,55) para lo
// secundario, que además son los únicos que NO se dan vuelta con el tema.
// =============================================================================

import Link from '@/app/_ui/Link';
import { fmtUSD, fmtNum } from '@/lib/format';
import { EditarObjetivo, EditarCapacidad } from './EditarObjetivo';
import { Ahora } from './Ahora';
import { DesgloseTrigger, type DesgloseData } from '../_components/Desglose';
import type { ObjectiveConAvance, CapacidadLeida } from '@/lib/objectives';
import { METRICA_LABEL, ES_PLATA, type ProgresoQuarter } from '@/lib/objectives-modelo';
import type { Foco } from '@/lib/focus';

/**
 * El relleno y la línea de una pieza elevada DENTRO de la isla oscura.
 *
 * ⚠️ Se derivan de `--on-sidebar` con `color-mix` y no se escriben como
 * `rgba(255,255,255,.05)`. La diferencia importa: `[data-tema-candidato="true-north"]`
 * redefine `--sidebar` a **#E5E9F0** —un gris casi blanco— y ahí un blanco al 5%
 * desaparece sin dejar rastro. Derivándolo del color del TEXTO de esta superficie, el
 * relleno se da vuelta junto con ella: sobre fondo claro queda un tinte oscuro, que es
 * lo correcto. Es la misma regla de la casa que dice que un color que existe PARA un
 * fondo se declara al lado de ese fondo.
 */
const RELLENO = 'color-mix(in srgb, var(--on-sidebar) 7%, transparent)';
const RELLENO_LINEA = 'color-mix(in srgb, var(--on-sidebar) 13%, transparent)';

/** El valor de un objetivo, en su unidad. Sin abreviar: en un hero, `US$127k` esconde precisión. */
const fmtValor = (n: number | null, unidad: string): string =>
  (unidad === 'usd' ? fmtUSD(n) : n === null ? '—' : fmtNum(n));

export function Cabecera({ objetivo, foco, capacidad, progreso, fraccion, anio, quarter, desglose, complemento }: {
  objetivo: ObjectiveConAvance | null;
  foco: Foco;
  capacidad: CapacidadLeida;
  progreso: ProgresoQuarter;
  /**
   * Dónde cae la marca del tiempo en la barra, 0..1 (`fraccionDelObjetivo`,
   * lib/vista-general-modelo.ts). Para un objetivo ANUAL es la fracción del AÑO a hoy.
   */
  fraccion: number;
  anio: number;
  quarter: number;
  /** El detalle lead por lead del número grande. Sólo existe para objetivos de plata. */
  desglose: DesgloseData | null;
  /** La OTRA métrica de plata del mismo período (firmado si el objetivo es cobrado). */
  complemento: { label: string; valor: string; pie: string; desglose: DesgloseData | null } | null;
}) {
  // ⚠️ `pct` topea en 100 (`pctKpi`), así que el sobrecumplimiento se calcula aparte —
  // y `metaValor` puede ser 0: se guarda en un click con el campo vacío, y entonces
  // `actual / metaValor` es Infinity. Sin esta guarda, el texto más grande de la
  // pantalla muestra una división por cero.
  const metaOk = objetivo !== null && objetivo.metaValor > 0;
  const supera = metaOk && objetivo.actual !== null && objetivo.actual > objetivo.metaValor;
  const alDia = objetivo?.ritmo?.alDia ?? true;
  const colorBarra = supera || alDia ? 'var(--good)' : 'var(--warn-fill)';

  // Dónde cae la marca del tiempo llega calculada (`fraccion`): para un objetivo ANUAL,
  // `progreso.fraccion` es la del trimestre y pondría la marca en el lugar equivocado. La
  // cuenta vivía acá y le pasaba el FIN del trimestre como si fuera hoy; ahora vive en
  // `fraccionDelObjetivo` (lib/vista-general-modelo.ts), con test, y la comparte el móvil.

  const periodo = objetivo?.quarter === null ? `${anio}` : `Q${quarter} ${anio}`;

  return (
    <section style={{
      background: 'var(--sidebar)',
      // ⚠️ El hero viejo usaba `--sidebar-2` para el borde: 1,13:1 contra el fondo, o
      // sea invisible. El token escrito PARA una línea sobre oscuro es `--sidebar-line`.
      border: '1px solid var(--sidebar-line)',
      borderRadius: 18,
      padding: 'var(--card-pad)',
      color: 'var(--on-sidebar)',
    }}>
      {/* ── El renglón de arriba: qué objetivo es, y en qué período ──
          Sin cejilla en monospace arriba del título: es veto de la casa, no un
          default. El h2 carga solo y la pastilla dice CUÁL de las dos métricas de
          plata se está mostrando — «Facturación» a secas no distingue lo cobrado de
          lo firmado, que son dos números distintos del mismo trimestre. */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
        paddingBottom: 14, marginBottom: 20, borderBottom: `1px solid var(--sidebar-line)`,
      }}>
        <EditarObjetivo
          objetivo={objetivo ? {
            id: objetivo.id, titulo: objetivo.titulo, metrica: objetivo.metrica,
            metaValor: objetivo.metaValor, quarter: objetivo.quarter, avanceManual: objetivo.avanceManual,
          } : null}
          anio={anio}
          quarter={quarter}
          disparador={
            <span style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
              background: 'none', border: 'none', padding: 0, font: 'inherit',
              textAlign: 'left', cursor: 'pointer',
            }}>
              <span style={{ fontSize: 'var(--fs-sect)', fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--on-sidebar)' }}>
                {objetivo ? objetivo.titulo : 'Define tu OKR del trimestre'}
              </span>
              {objetivo && (
                <span style={{
                  fontSize: 'var(--fs-meta)', padding: '4px 10px', borderRadius: 999,
                  background: RELLENO, border: `1px solid ${RELLENO_LINEA}`, color: 'var(--sidebar-text)',
                }}>
                  {METRICA_LABEL[objetivo.metrica]}
                </span>
              )}
            </span>
          }
        />

        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap', fontSize: 'var(--fs-sm)', color: 'var(--sidebar-text)' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {periodo} · {progreso.diasRestantes === 0 ? 'último día' : `quedan ${progreso.diasRestantes} días`}
          </span>
          <Capacidad capacidad={capacidad} />
        </span>
      </div>

      {/* ── Las dos zonas ──
          `1.35fr / 1fr`, que es el mismo split que /comercial y /marketing ya usan
          adentro de sus secciones. La clase vive en ui.css porque el corte a una
          columna en pantalla angosta necesita una media query, y una pantalla no
          escribe media queries. */}
      <div className="mk-cabecera">
        <div>
          {objetivo === null ? (
            // Sin objetivo NO se inventa un número. El «?? 20» del hero viejo —que
            // mostraba «Camino a los 20 cierres · 0/20» a quien nunca cargó una meta—
            // es el patrón que esto viene a reemplazar. Pero un estado vacío tampoco
            // puede ser sólo una frase: acá va el CONTROL, porque el lugar donde se
            // carga la meta es exactamente el lugar donde falta.
            <>
              <p style={{ margin: '0 0 20px', fontSize: 'var(--fs-md)', lineHeight: 1.55, color: 'var(--sidebar-text)', maxWidth: '46ch' }}>
                Sin una meta cargada no puedo decirte si el trimestre va bien ni elegir qué mover primero.
              </p>
              <EditarObjetivo
                objetivo={null}
                anio={anio}
                quarter={quarter}
                disparador={
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '12px 20px', borderRadius: 'var(--r-md)', minHeight: 'var(--touch)',
                    background: 'none', font: 'inherit', cursor: 'pointer',
                    border: `1px solid ${RELLENO_LINEA}`, color: 'var(--on-sidebar)',
                    fontSize: 'var(--fs-card)', fontWeight: 600,
                  }}>
                    Cargar la meta del trimestre →
                  </span>
                }
              />
            </>
          ) : (
            <>
              <NumeroGrande objetivo={objetivo} desglose={desglose} metaOk={metaOk} />

              {/* La barra ES el dato, y la marca vertical es el tiempo: si el relleno
                  pasó la marca, vas adelantado. Contesta «¿voy a tiempo?» sin una
                  palabra — que es lo que los cuarenta bloquecitos intentaban y no
                  lograban, gastando 46 px para repetir el número de arriba. */}
              {metaOk && objetivo.actual !== null && (
                <div style={{ marginTop: 22 }}>
                  <div style={{ position: 'relative', width: '100%', height: 12, borderRadius: 999, background: RELLENO_LINEA, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, objetivo.pct ?? 0)}%`, height: '100%',
                      borderRadius: 999, background: colorBarra,
                    }} />
                    {/* Recortada al 100% y CON marca de corte: una barra llena que no
                        avisa que se pasó afirma «llegaste justo». */}
                    {supera && (
                      <span aria-hidden style={{
                        position: 'absolute', top: 0, bottom: 0, right: 0, width: 5,
                        background: 'repeating-linear-gradient(135deg, var(--on-sidebar) 0 2px, transparent 2px 4px)',
                        opacity: 0.85,
                      }} />
                    )}
                    <span aria-hidden style={{
                      position: 'absolute', top: 0, bottom: 0, left: `${Math.min(100, fraccion * 100)}%`,
                      width: 2, background: 'var(--on-sidebar)', opacity: 0.5,
                    }} />
                  </div>
                  <Ritmo objetivo={objetivo} supera={supera} periodo={periodo} />
                </div>
              )}

              {objetivo.actual === null && (
                <p style={{ margin: '18px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--warn-fill)', maxWidth: '46ch' }}>
                  {objetivo.metrica === 'libre'
                    ? 'Este objetivo lo mides tú y todavía no cargaste el avance.'
                    : `No pude leer el avance${objetivo.error ? `: ${objetivo.error}` : '.'}`}
                </p>
              )}

              {complemento && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid var(--sidebar-line)` }}>
                  <Complemento c={complemento} />
                </div>
              )}
            </>
          )}
        </div>

        {/* La acción del día. Cuando el foco ES «carga el objetivo», la zona derecha
            calla en vez de repetir lo que la izquierda ya está pidiendo — y sólo en
            ese caso: un workspace con el plan cargado y sin objetivo tiene una acción
            real, y perderla por un texto de arranque sería peor que el problema.
            ⚠️ Se pregunta por el CAMPO (`pideConfigurar`), nunca por el texto del botón:
            comparar `hrefLabel` se rompía en silencio el día que cambiara ese copy. */}
        <div className="mk-cabecera__b">
          {foco.pideConfigurar === 'objetivo' ? (
            <p style={{ margin: 0, fontSize: 'var(--fs-md)', lineHeight: 1.55, color: 'var(--sidebar-text)' }}>
              Cuando cargues la meta, aquí va a aparecer qué hacer hoy.
            </p>
          ) : (
            <Ahora foco={foco} />
          )}
        </div>
      </div>
    </section>
  );
}

function NumeroGrande({ objetivo, desglose, metaOk }: {
  objetivo: ObjectiveConAvance;
  desglose: DesgloseData | null;
  metaOk: boolean;
}) {
  const inner = (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <span style={{
        fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 700, lineHeight: 0.95,
        letterSpacing: '-0.035em', color: 'var(--on-sidebar)', fontVariantNumeric: 'tabular-nums',
      }}>
        {fmtValor(objetivo.actual, objetivo.unidad)}
      </span>
      {/* La meta es parte del dato, no decoración: va en `--sidebar-text` (6,55:1) y
          nunca en un blanco al 45% de opacidad como el hero viejo. */}
      <span style={{ fontSize: 'var(--fs-sect)', fontWeight: 500, color: 'var(--sidebar-text)', fontVariantNumeric: 'tabular-nums' }}>
        {metaOk ? `/ ${fmtValor(objetivo.metaValor, objetivo.unidad)}` : 'sin meta cargada'}
      </span>
    </span>
  );

  if (!desglose) return inner;
  return (
    <DesgloseTrigger data={desglose} style={{ display: 'block', width: 'auto', cursor: 'pointer' }}>
      {inner}
      <span style={{ display: 'block', marginTop: 8, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--on-sidebar)' }}>
        ver de qué está hecho →
      </span>
    </DesgloseTrigger>
  );
}

/**
 * El ritmo, en una frase.
 *
 * ⚠️ Dice «a esta altura» y no «vas a llegar»: el prorrateo es LINEAL y un negocio con
 * estacionalidad no factura parejo. La fecha estimada, cuando va, va rotulada como
 * estimación y en tipografía secundaria — nunca al lado del número grande, que es
 * donde el hero viejo ponía «a este ritmo llegas en ~N semanas» con el mismo peso que
 * un dato medido.
 */
function Ritmo({ objetivo, supera, periodo }: { objetivo: ObjectiveConAvance; supera: boolean; periodo: string }) {
  const r = objetivo.ritmo;
  const fuerte = { color: 'var(--on-sidebar)', fontWeight: 600 };
  let texto: React.ReactNode;

  if (supera) {
    texto = <>Meta superada: <strong style={fuerte}>{fmtValor(objetivo.actual, objetivo.unidad)}</strong> sobre {fmtValor(objetivo.metaValor, objetivo.unidad)}</>;
  } else if (r === null || r.desvioPct === null) {
    texto = <>{periodo} recién arranca: todavía no hay ritmo para comparar</>;
  } else {
    const delta = Math.abs(r.desvio);
    texto = r.alDia
      ? <>Vas <strong style={fuerte}>{fmtValor(delta, objetivo.unidad)} arriba</strong> de lo esperado a esta altura</>
      : <>Vas <strong style={fuerte}>{fmtValor(delta, objetivo.unidad)} abajo</strong> de lo esperado a esta altura</>;
  }

  return (
    <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-sm)', lineHeight: 1.5, color: 'var(--sidebar-text)' }}>
      {texto}
      {r?.llegadaEstimada && !supera && (
        <span style={{ color: 'var(--sidebar-text)' }}> · estimado: a este ritmo llegas el {r.llegadaEstimada.split('-').reverse().join('/')}</span>
      )}
    </p>
  );
}

/** La otra métrica de plata del mismo período. Firmado si el objetivo es Cobrado, y al revés. */
function Complemento({ c }: { c: { label: string; valor: string; pie: string; desglose: DesgloseData | null } }) {
  const inner = (
    <span style={{ display: 'block' }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--sidebar-text)' }}>{c.label}</span>
        <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--on-sidebar)', fontVariantNumeric: 'tabular-nums' }}>{c.valor}</span>
      </span>
      <span style={{ display: 'block', marginTop: 3, fontSize: 'var(--fs-meta)', color: 'var(--sidebar-text)' }}>{c.pie}</span>
    </span>
  );
  return c.desglose
    ? <DesgloseTrigger data={c.desglose} style={{ display: 'block', cursor: 'pointer' }}>{inner}</DesgloseTrigger>
    : inner;
}

/**
 * La capacidad instalada. Tres estados y ninguno miente.
 *
 * ⚠️ «No pude contarlos» NO es «cero clientes»: `clientesActivos()` devuelve
 * `activos: 0` con `libres: null` cuando la lectura falla, y pintar ese cero diría
 * «tenés todo el lugar libre» justo en la pantalla donde se decide si vender más.
 */
function Capacidad({ capacidad }: { capacidad: CapacidadLeida }) {
  return (
    <EditarCapacidad
      cupo={capacidad.cupo}
      mesesEntrega={capacidad.mesesEntrega}
      disparador={
        <span style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', color: 'var(--sidebar-text)' }}>
          {capacidad.error ? (
            'clientes: no pude contarlos'
          ) : capacidad.cupo === null ? (
            <>{capacidad.activos} clientes · <span style={{ color: 'var(--on-sidebar)' }}>define tu cupo →</span></>
          ) : (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: 'var(--on-sidebar)' }}>{capacidad.activos}</span>/{capacidad.cupo} clientes
              {capacidad.libres === 0 ? <span style={{ color: 'var(--warn-fill)' }}> · sin lugar</span> : ` · ${capacidad.libres} libres`}
            </span>
          )}
        </span>
      }
    />
  );
}
