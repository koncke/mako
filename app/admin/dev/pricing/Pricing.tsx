'use client';

// =============================================================================
// Pricing — cuánto cuesta la IA y qué plan la aguanta
// =============================================================================
// LA CONCLUSIÓN VA ARRIBA. La primera versión eran nueve tarjetas de prosa del
// mismo peso, y el dato que decide el negocio quedaba en la séptima. El dueño:
// «es muy confusa, mucho texto». No sobraba contenido: faltaba jerarquía.
//
// La forma es la de un análisis de unit economics, no la de un informe:
//   1. El veredicto en tres cifras, sin scrollear.
//   2. Los dos gráficos que sostienen el veredicto — magnitud se ve, no se lee.
//   3. Todo el respaldo PLEGADO. A un clic para quien quiera auditarlo.
//
// Y cada métrica se muestra contra su benchmark: «margen 30%» no dice nada solo;
// «30% contra un objetivo de 75%» decide una conversación.
//
// Lo MEDIDO se lee en vivo de anthropic_usage (/api/costos-ia). Lo PROYECTADO sale
// de ./modelo.ts, donde cada número dice si es medido, publicado o supuesto.
// El análisis en prosa está en docs/costos-ia-y-planes.md.

import { useCallback, useEffect, useState } from 'react';
import { Section, Eyebrow, Status, Select, Spinner, ErrorState, MONO } from '@/app/_ui';
import { Barras, Cifra, Plegable, type Barra } from './Piezas';
import {
  ACCIONES, AUDIO, AUTOMATICOS, BENCHMARKS, BLOQUEANTES, COMPETENCIA, DATO_FALSO,
  ECONOMIA, EL_ACCIDENTE, ESCENARIOS, IMAGEN, MEDICION, MT_POR_USD, PLANES,
  RETENCION, RETENCION_FUENTE, VIDEO, VIDEO_15S,
  aMes, costoUnitario, margen, techoIa,
} from './modelo';

type Corte = { clave: string; llamadas: number; tokens: number; costUsd: number };
type Resumen = {
  periodo: string; llamadas: number; tokens: number; costUsd: number; filas: number;
  porFeature: Corte[]; porProveedor: Corte[];
  porWorkspace: Array<Corte & { atribuible: boolean }>;
  mesesDisponibles: string[];
};

const usd = (n: number) => `US$${n.toFixed(2)}`;
const miles = (n: number) => n.toLocaleString('es-AR');
const mtDe = (c: number) => Math.ceil((c * MT_POR_USD) / 5) * 5;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesLabel = (m: string) => { const [y, x] = m.split('-'); return `${MESES[Number(x) - 1] ?? x} ${y}`; };

const PRO = PLANES.find((p) => p.id === 'pro')!;
const GROWTH = PLANES.find((p) => p.id === 'growth')!;
/** El costo real de un workspace intensivo, a mes. Es la vara de todo lo de arriba. */
const COSTO_INTENSIVO = (MEDICION.costUsd / MEDICION.dias) * 30;

function Fila({ cols, plantilla, head = false }: { cols: React.ReactNode[]; plantilla: string; head?: boolean }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: plantilla, gap: 12, alignItems: 'baseline',
      padding: '8px 0', borderTop: head ? 'none' : '1px solid var(--border)',
      fontSize: head ? 10.5 : 12.5, color: head ? 'var(--faint)' : 'var(--ink)',
      fontFamily: head ? MONO : undefined,
      letterSpacing: head ? '.07em' : undefined, textTransform: head ? 'uppercase' : undefined,
    }}>
      {cols.map((c, i) => <div key={i} style={{ minWidth: 0 }}>{c}</div>)}
    </div>
  );
}
const Num = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontFamily: MONO, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{children}</span>
);
const Nota = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px', maxWidth: '72ch', lineHeight: 1.6 }}>{children}</p>
);
const Fuente = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12 }}>{children}</div>
);

export function Pricing() {
  const [periodo, setPeriodo] = useState('todo');
  const [data, setData] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (p: string) => {
    setCargando(true); setError(null);
    try {
      const r = await fetch(`/api/costos-ia?periodo=${encodeURIComponent(p)}`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'no se pudo leer el gasto');
      setData(j as Resumen);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { void cargar(periodo); }, [cargar, periodo]);

  const margenPro = margen(PRO, COSTO_INTENSIVO)!;

  // ── Gráfico 1: la retención se desploma con el precio ────────────────────
  const barrasRetencion: Barra[] = RETENCION.map((b) => ({
    id: b.id,
    label: b.banda,
    nota: b.cae ?? undefined,
    valor: b.grrAnual,
    texto: `${b.grrAnual}%`,
    // Énfasis en la banda donde cae el Pro: es la que decide. El resto, recesivo.
    destacada: b.id === 'baja',
  }));

  // ── Gráfico 2: el ruteo vale 8× ──────────────────────────────────────────
  const barrasRuteo: Barra[] = [...ESCENARIOS]
    .sort((a, b) => a.usdPeriodo - b.usdPeriodo)
    .map((e) => ({
      id: e.id,
      label: e.label,
      valor: aMes(e.usdPeriodo),
      texto: usd(aMes(e.usdPeriodo)),
      destacada: e.id === 'real',
    }));

  return (
    <>
      {/* ── EL VEREDICTO ──────────────────────────────────────────────────── */}
      <Section titulo="El veredicto" card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 26, marginBottom: 20 }}>
          {/* Signo MENOS (U+2212), no el guion del teclado: a 34px el guion se lee
              como un separador y la cifra pierde el signo. */}
          <Cifra
            valor={`${margenPro < 0 ? '−' : ''}${Math.abs(margenPro).toFixed(0)}%`} tono="bad"
            rotulo="Margen bruto del Pro"
            detalle={`Con un usuario intensivo, medido. El objetivo del sector es 75%.`}
          />
          <Cifra
            valor="23%" tono="bad"
            rotulo="Retención anual bajo US$50/mes"
            detalle="El Pro cae en la peor banda medida, por dos dólares."
          />
          {/* Acá estuvo «US$666 · costo de una reunión de venta» y era un ERROR:
              ese número es el costo de una reunión agendada por un SDR en un
              equipo de venta OUTBOUND — un modelo que MaKo no usa. Puesto como
              cifra del veredicto se leía como «este es tu CAC», que es falso. Y
              encima venía de blogs de agencias de lead-gen sin muestra publicada.
              Lo que SÍ se sostiene es el TECHO: cuánto se puede gastar en
              adquirir sin destruir valor. Es un límite, no un costo incurrido. */}
          <Cifra
            valor="US$53-104" tono="warn"
            rotulo="Techo de CAC del Pro"
            detalle="Lo máximo que puede costar adquirir un cliente sin destruir valor. Derivado de la retención por banda y una relación LTV:CAC de 3 a 4,1×."
          />
        </div>
        <Nota>
          <strong>Con el ruteo de HOY, el plan que pierde plata es el Pro, no el Free.</strong> Un
          workspace intensivo cuesta {usd(COSTO_INTENSIVO)} por mes de IA — más que la suscripción
          entera. Pero eso es un problema de ruteo, no de precio: con los modelos del paso 1 el
          texto se derrumba (extraer una reunión pasa de US$0,93 a US$0,002) y el que queda
          apretado es el <strong>Growth</strong>, por el video. Lo que no se arregla bajando el
          costo es la retención: a menos de US$50/mes el producto retiene 23% anual.
        </Nota>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {BENCHMARKS.map((b) => (
            <div key={b.id} style={{ fontSize: 11.5 }}>
              <span style={{ color: 'var(--faint)' }}>{b.que}: </span>
              <span style={{ color: 'var(--ink)', fontFamily: MONO }}>{b.objetivo}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── GRÁFICO 1 ─────────────────────────────────────────────────────── */}
      <Section titulo="Cuanto más barato, peor retiene" card>
        <Nota>
          Retención bruta anual de productos <strong>AI-native</strong>, segmentada por precio
          de lista. Es el benchmark que aplica a MaKo — no el de «SaaS para PyMEs», que mide otra cosa.
        </Nota>
        <Barras datos={barrasRetencion} max={100} tono="bad" />
        <Fuente>{RETENCION_FUENTE}</Fuente>
      </Section>

      {/* ── GRÁFICO 2 ─────────────────────────────────────────────────────── */}
      <Section titulo="El ruteo de modelo vale 8×" card>
        <Nota>
          El <strong>mismo consumo medido</strong>, facturado bajo distintas políticas de modelo.
          Es la palanca más grande que existe — más que cualquier límite de cupo.
        </Nota>
        <Barras datos={barrasRuteo} tono="mako" />
        <div style={{ marginTop: 14, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--muted)' }}>
          <span>Techo del Pro para 75% de margen: <strong style={{ fontFamily: MONO }}>{usd(techoIa(PRO))}</strong></span>
          <span>Techo del Growth: <strong style={{ fontFamily: MONO }}>{usd(techoIa(GROWTH))}</strong></span>
        </div>
        <Fuente>Medido sobre {MEDICION.dias} días de producción; los escenarios usan precio de lista de cada proveedor.</Fuente>
      </Section>

      {/* ── LOS PLANES ────────────────────────────────────────────────────── */}
      <Section titulo="Los planes" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>1.000 MaKo Tokens = US$1 de costo de IA</span>} card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          {PLANES.map((p) => {
            const costo = p.cupoMt / MT_POR_USD;
            const m = margen(p, costo);
            return (
              <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 15 }}>
                <Eyebrow>{p.label}</Eyebrow>
                <div style={{ fontSize: 25, margin: '5px 0 1px', fontWeight: 600, letterSpacing: '-.02em' }}>
                  {p.precioUsd === 0 ? 'Gratis' : `US$${p.precioUsd}`}
                  {p.precioUsd > 0 && <span style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 400 }}>/mes</span>}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--muted)', marginBottom: 9 }}>
                  {miles(p.cupoMt)} MT · {usd(costo)} de IA
                </div>
                {m !== null && <Status tono={m >= 70 ? 'good' : 'bad'}>{`margen ${m.toFixed(0)}%`}</Status>}
                <ul style={{ margin: '10px 0 0', paddingLeft: 15, fontSize: 12, lineHeight: 1.65 }}>
                  {p.incluye.map((i) => <li key={i}>{i}</li>)}
                  {p.noIncluye.map((i) => <li key={i} style={{ color: 'var(--faint)', textDecoration: 'line-through' }}>{i}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── TODO EL RESPALDO, PLEGADO ─────────────────────────────────────── */}
      <Section titulo="El respaldo" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>abrí lo que quieras auditar</span>} card>

        <Plegable titulo="Lo que se gastó de verdad" resumen="en vivo, con filtro de mes">
          <div style={{ marginBottom: 12 }}>
            <Select value={periodo} onChange={setPeriodo} ariaLabel="Período" width={190}
              options={[{ value: 'todo', label: 'Todo el histórico' }, ...(data?.mesesDisponibles ?? []).map((m) => ({ value: m, label: mesLabel(m) }))]} />
          </div>
          {error && <ErrorState titulo="No se pudo leer el gasto" detalle={error} onReintentar={() => void cargar(periodo)} />}
          {!error && cargando && <div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}><Spinner /></div>}
          {!error && !cargando && data && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 16, marginBottom: 14 }}>
                {([['Costo', usd(data.costUsd)], ['Llamadas', miles(data.llamadas)], ['Tokens', miles(data.tokens)], ['Filas leídas', miles(data.filas)]] as const).map(([k, v]) => (
                  <div key={k}><Eyebrow>{k}</Eyebrow><div style={{ fontFamily: MONO, fontSize: 18, marginTop: 3 }}>{v}</div></div>
                ))}
              </div>
              {data.porWorkspace.some((w) => !w.atribuible) && (
                <div style={{ marginBottom: 12 }}>
                  <Status tono="warn">El corte por cliente no es real: todo lo de Claude se registra en el workspace 1</Status>
                </div>
              )}
              <Fila head plantilla="minmax(0,2fr) 80px 100px 90px" cols={['Proceso', 'Llamadas', 'Tokens', 'Costo']} />
              {data.porFeature.slice(0, 10).map((f) => (
                <Fila key={f.clave} plantilla="minmax(0,2fr) 80px 100px 90px"
                  cols={[f.clave, <Num key="l">{miles(f.llamadas)}</Num>, <Num key="t">{miles(f.tokens)}</Num>, <Num key="c">{f.costUsd > 0 ? usd(f.costUsd) : '—'}</Num>]} />
              ))}
            </>
          )}
        </Plegable>

        <Plegable titulo="Cuánto cuesta cada acción" resumen={`${ACCIONES.length} procesos medidos, y su precio en MaKo Tokens`}>
          <Nota>El denominador son las llamadas que <strong>efectivamente se pagaron</strong>: mezclarlas con las gratis da un número que no sirve para cotizar, porque el free tier no escala.</Nota>
          <Fila head plantilla="minmax(0,1.7fr) 90px 70px" cols={['Acción', 'Costo real', 'MT']} />
          {ACCIONES.map((a) => (
            <Fila key={a.id} plantilla="minmax(0,1.7fr) 90px 70px"
              cols={[
                <span key="n">{a.label} {a.automatico && <Status tono="warn">solo</Status>}</span>,
                <Num key="c">US${costoUnitario(a).toFixed(4)}</Num>,
                <Num key="m">{mtDe(costoUnitario(a))}</Num>,
              ]} />
          ))}
        </Plegable>

        <Plegable titulo="La IA que se dispara sola" resumen="6 caminos que gastan sin que el usuario entre — la bomba del Free">
          <Nota>{EL_ACCIDENTE}</Nota>
          <Fila head plantilla="minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1.3fr)" cols={['Camino', 'Lo dispara', 'Proyección']} />
          {AUTOMATICOS.map((a) => (
            <Fila key={a.id} plantilla="minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1.3fr)"
              cols={[a.label,
                <span key="d" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{a.disparador}</span>,
                <span key="p" style={{ fontSize: 11.5, color: a.techo === 'ninguno' ? 'var(--bad)' : 'var(--muted)' }}>{a.proyeccion}</span>]} />
          ))}
        </Plegable>

        <Plegable titulo="Lo que va a costar lo que todavía no existe" resumen="video, imagen y voz — con tres modelos que ya tienen fecha de apagado">
          {([['Video', VIDEO], ['Imagen', IMAGEN], ['Voz', AUDIO]] as const).map(([t, lista]) => (
            <div key={t} style={{ marginBottom: 16 }}>
              <Eyebrow>{t}</Eyebrow>
              <Fila head plantilla="minmax(0,1.2fr) 80px minmax(0,1.6fr)" cols={['Modelo', 'Precio', 'Nota']} />
              {lista.map((m) => (
                <Fila key={m.id} plantilla="minmax(0,1.2fr) 80px minmax(0,1.6fr)"
                  cols={[
                    <span key="n" style={{ opacity: m.muere ? 0.55 : 1, textDecoration: m.muere ? 'line-through' : 'none' }}>
                      <span style={{ color: 'var(--faint)', fontSize: 11 }}>{m.proveedor}</span> {m.modelo}
                    </span>,
                    <Num key="p">{m.usd === 0 ? '—' : `$${m.usd}`}</Num>,
                    <span key="q" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                      {m.muere && <><Status tono="bad">{`se apaga ${m.muere}`}</Status>{' '}</>}
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{m.unidad}</span> · {m.nota}
                    </span>,
                  ]} />
              ))}
            </div>
          ))}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 13, background: 'var(--surface-2)' }}>
            <strong style={{ fontSize: 12.5 }}>{VIDEO_15S.que}: piso {usd(VIDEO_15S.piso)}</strong>
            <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: MONO, margin: '3px 0 6px' }}>{VIDEO_15S.pisoQuien}</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>{VIDEO_15S.nota}</p>
          </div>
        </Plegable>

        <Plegable titulo="La economía del negocio" resumen={`${ECONOMIA.length} benchmarks con fuente y muestra`}>
          {ECONOMIA.map((d, i) => (
            <div key={d.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', padding: '12px 0' }}>
              <strong style={{ fontSize: 12.5 }}>{d.titulo}</strong>
              <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--mako-ink)', margin: '4px 0 5px' }}>{d.numero}</div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 4px', lineHeight: 1.55, maxWidth: '76ch' }}>{d.que}</p>
              <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{d.fuente}</div>
            </div>
          ))}
          <div style={{ marginTop: 14, border: '1px solid var(--bad)', borderRadius: 'var(--r-lg)', padding: 13, background: 'var(--bad-bg)' }}>
            <Status tono="bad">No usar</Status>
            <div style={{ fontFamily: MONO, fontSize: 12, margin: '6px 0 4px' }}>{DATO_FALSO.numero}</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>{DATO_FALSO.por_que}</p>
          </div>
        </Plegable>

        <Plegable titulo="Cómo cobran los que ya lo resolvieron" resumen="el mecanismo del cupo agotado, no el precio">
          {COMPETENCIA.map((d, i) => (
            <div key={d.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', padding: '12px 0' }}>
              <strong style={{ fontSize: 12.5 }}>{d.titulo}</strong>
              <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--mako-ink)', margin: '4px 0 5px' }}>{d.numero}</div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 4px', lineHeight: 1.55, maxWidth: '76ch' }}>{d.que}</p>
              <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{d.fuente}</div>
            </div>
          ))}
        </Plegable>

        <Plegable titulo="Lo que hay que arreglar antes de cobrar" resumen={`${BLOQUEANTES.length} bloqueantes verificados contra el código`}>
          <Nota>No son mejoras: sin estos, el cupo de MaKo Tokens no se puede ni medir ni cobrar.</Nota>
          {BLOQUEANTES.map((b) => (
            <div key={b.id} style={{ borderTop: '1px solid var(--border)', padding: '11px 0' }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{b.orden}</span>
                <strong style={{ fontSize: 12.5 }}>{b.titulo}</strong>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '5px 0 4px 22px', lineHeight: 1.55, maxWidth: '76ch' }}>{b.que}</p>
              <div style={{ marginLeft: 22, fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{b.vive}</div>
            </div>
          ))}
        </Plegable>

      </Section>
    </>
  );
}
