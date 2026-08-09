'use client';

// =============================================================================
// Pricing — cuánto cuesta la IA de verdad, y qué plan la aguanta
// =============================================================================
// Mitad y mitad, a propósito:
//   · Lo MEDIDO se lee en vivo de `anthropic_usage` (/api/costos-ia), con filtro
//     de mes. Un análisis de costos con los números pegados a mano envejece a la
//     semana y nadie se entera — es la regla de «estado vivo, no recordado».
//   · Lo PROYECTADO (escenarios, márgenes, cupos) sale de `./modelo.ts`, donde
//     cada número dice si es medido, publicado o supuesto.
//
// El análisis en prosa está en docs/costos-ia-y-planes.md y se lee en /admin/docs.

import { useCallback, useEffect, useState } from 'react';
import { Section, Eyebrow, Status, Select, Spinner, ErrorState, MONO } from '@/app/_ui';
import {
  ACCIONES, AUDIO, AUTOMATICOS, BLOQUEANTES, DATO_FALSO, ECONOMIA, EL_ACCIDENTE,
  ESCENARIOS, IMAGEN, MEDICION, MT_POR_USD, PLANES, VIDEO, VIDEO_15S,
  aMes, costoUnitario, margen, techoIa,
} from './modelo';

type Corte = { clave: string; llamadas: number; tokens: number; costUsd: number };
type Resumen = {
  periodo: string; llamadas: number; tokens: number; costUsd: number; filas: number;
  porFeature: Corte[]; porProveedor: Corte[]; porDia: Corte[];
  porWorkspace: Array<Corte & { atribuible: boolean }>;
  mesesDisponibles: string[];
};

const usd = (n: number) => `US$${n.toFixed(2)}`;
const usd4 = (n: number) => `US$${n.toFixed(4)}`;
const miles = (n: number) => n.toLocaleString('es-AR');
const mtDe = (costoUsd: number) => Math.ceil((costoUsd * MT_POR_USD) / 5) * 5;

const MES_LABEL = (m: string) => {
  const [y, mes] = m.split('-');
  const nombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${nombres[Number(mes) - 1] ?? mes} ${y}`;
};

/** Fila de tabla genérica: la usan casi todas las secciones. */
function Fila({ cols, plantilla, head = false }: { cols: React.ReactNode[]; plantilla: string; head?: boolean }) {
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: plantilla, gap: 12, alignItems: 'baseline',
        padding: '9px 0', borderTop: head ? 'none' : '1px solid var(--border)',
        fontSize: head ? 11 : 13, color: head ? 'var(--faint)' : 'var(--ink)',
        fontFamily: head ? MONO : undefined,
        letterSpacing: head ? '.06em' : undefined,
        textTransform: head ? 'uppercase' : undefined,
      }}
    >
      {cols.map((c, i) => <div key={i} style={{ minWidth: 0 }}>{c}</div>)}
    </div>
  );
}

const Num = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{children}</span>
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(periodo); }, [cargar, periodo]);

  const meses = data?.mesesDisponibles ?? [];
  const opciones = [{ value: 'todo', label: 'Todo el histórico' }, ...meses.map((m) => ({ value: m, label: MES_LABEL(m) }))];

  return (
    <>
      {/* ── 1. LO MEDIDO ─────────────────────────────────────────────────── */}
      <Section
        titulo="Lo que se gastó de verdad"
        nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>en vivo, de anthropic_usage</span>}
        accion={<Select value={periodo} onChange={setPeriodo} options={opciones} ariaLabel="Período" width={190} />}
        card
      >
        {error && <ErrorState titulo="No se pudo leer el gasto" detalle={error} onReintentar={() => void cargar(periodo)} />}
        {!error && cargando && <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><Spinner /></div>}
        {!error && !cargando && data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 18, marginBottom: 18 }}>
              {[
                ['Costo', usd(data.costUsd)],
                ['Llamadas', miles(data.llamadas)],
                ['Tokens', miles(data.tokens)],
                ['Filas leídas', miles(data.filas)],
              ].map(([k, v]) => (
                <div key={k}>
                  <Eyebrow>{k}</Eyebrow>
                  <div style={{ fontFamily: MONO, fontSize: 22, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* El dato que hace honesta a toda la pantalla. */}
            {data.porWorkspace.some((w) => !w.atribuible) && (
              <div style={{ marginBottom: 16 }}>
                <Status tono="warn">
                  El corte por cliente no es real: todo lo de Claude se registra en el workspace 1 (lib/anthropic-usage.ts:22-25)
                </Status>
              </div>
            )}

            <Fila head plantilla="minmax(0,2fr) 90px 110px 110px" cols={['Proceso', 'Llamadas', 'Tokens', 'Costo']} />
            {data.porFeature.slice(0, 14).map((f) => (
              <Fila key={f.clave} plantilla="minmax(0,2fr) 90px 110px 110px"
                cols={[f.clave, <Num key="l">{miles(f.llamadas)}</Num>, <Num key="t">{miles(f.tokens)}</Num>,
                  <Num key="c">{f.costUsd > 0 ? usd(f.costUsd) : '—'}</Num>]} />
            ))}

            <div style={{ marginTop: 22 }}>
              <Fila head plantilla="minmax(0,2fr) 90px 110px 110px" cols={['Proveedor', 'Llamadas', 'Tokens', 'Costo']} />
              {data.porProveedor.map((p) => (
                <Fila key={p.clave} plantilla="minmax(0,2fr) 90px 110px 110px"
                  cols={[p.clave, <Num key="l">{miles(p.llamadas)}</Num>, <Num key="t">{miles(p.tokens)}</Num>,
                    <Num key="c">{p.costUsd > 0 ? usd(p.costUsd) : 'gratis'}</Num>]} />
              ))}
            </div>
          </>
        )}
      </Section>

      {/* ── 2. COSTO POR ACCIÓN ──────────────────────────────────────────── */}
      <Section titulo="Cuánto cuesta cada acción" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>medido, solo llamadas pagas</span>} card>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px', maxWidth: '70ch' }}>
          El denominador son las llamadas que <strong>efectivamente se pagaron</strong>, no el promedio con las
          gratis adentro: mezclarlas da un número que no sirve para cotizar, porque el free tier no escala.
        </p>
        <Fila head plantilla="minmax(0,1.6fr) 96px 80px minmax(0,1.5fr)" cols={['Acción', 'Costo real', 'MaKo Tokens', 'Qué lo multiplica']} />
        {ACCIONES.map((a) => (
          <Fila key={a.id} plantilla="minmax(0,1.6fr) 96px 80px minmax(0,1.5fr)"
            cols={[
              <span key="n">
                {a.label}{' '}
                {a.automatico && <Status tono="warn">solo</Status>}
              </span>,
              <Num key="c">{usd4(costoUnitario(a))}</Num>,
              <Num key="m">{mtDe(costoUnitario(a))}</Num>,
              <span key="q" style={{ fontSize: 12, color: 'var(--muted)' }}>{a.multiplica}</span>,
            ]} />
        ))}
      </Section>

      {/* ── 3. ESCENARIOS DE RUTEO ───────────────────────────────────────── */}
      <Section titulo="El ruteo vale 8×" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>el mismo consumo, distintas políticas de modelo</span>} card>
        <Fila head plantilla="minmax(0,1.4fr) 100px 100px minmax(0,1.6fr)" cols={['Escenario', `${MEDICION.dias} días`, 'Por mes', 'Qué asume']} />
        {ESCENARIOS.map((e) => (
          <Fila key={e.id} plantilla="minmax(0,1.4fr) 100px 100px minmax(0,1.6fr)"
            cols={[
              <span key="n">{e.label} <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)' }}>{e.origen}</span></span>,
              <Num key="p">{usd(e.usdPeriodo)}</Num>,
              <Num key="m">{usd(aMes(e.usdPeriodo))}</Num>,
              <span key="q" style={{ fontSize: 12, color: 'var(--muted)' }}>{e.que}</span>,
            ]} />
        ))}
      </Section>

      {/* ── 4. LA IA QUE SE DISPARA SOLA ─────────────────────────────────── */}
      <Section titulo="La IA que se dispara sola" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>la bomba del plan Free</span>} card>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px', maxWidth: '70ch' }}>{EL_ACCIDENTE}</p>
        <Fila head plantilla="minmax(0,1.3fr) minmax(0,1.3fr) 130px minmax(0,1.4fr)" cols={['Camino', 'Lo dispara', 'Techo', 'Proyección']} />
        {AUTOMATICOS.map((a) => (
          <Fila key={a.id} plantilla="minmax(0,1.3fr) minmax(0,1.3fr) 130px minmax(0,1.4fr)"
            cols={[
              a.label,
              <span key="d" style={{ fontSize: 12, color: 'var(--muted)' }}>{a.disparador}</span>,
              <span key="t" style={{ fontFamily: MONO, fontSize: 11.5, color: a.techo === 'ninguno' ? 'var(--bad)' : 'var(--muted)' }}>{a.techo}</span>,
              <span key="p" style={{ fontSize: 12, color: 'var(--muted)' }}>{a.proyeccion}</span>,
            ]} />
        ))}
      </Section>

      {/* ── 5. PLANES Y MÁRGENES ─────────────────────────────────────────── */}
      <Section titulo="Los planes" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>1.000 MaKo Tokens = US$1 de costo de IA</span>} card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {PLANES.map((p) => {
            const costoCupo = p.cupoMt / MT_POR_USD;
            const m = margen(p, costoCupo);
            return (
              <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 16 }}>
                <Eyebrow>{p.label}</Eyebrow>
                <div style={{ fontFamily: MONO, fontSize: 26, margin: '6px 0 2px', fontVariantNumeric: 'tabular-nums' }}>
                  {p.precioUsd === 0 ? 'Gratis' : `US$${p.precioUsd}`}
                  <span style={{ fontSize: 12, color: 'var(--faint)' }}>{p.precioUsd ? '/mes' : ''}</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                  {miles(p.cupoMt)} MT · {usd(costoCupo)} de IA
                </div>
                {m !== null && (
                  <div style={{ marginBottom: 10 }}>
                    <Status tono={m >= 70 ? 'good' : 'bad'}>{`margen bruto ${m.toFixed(0)}%`}</Status>
                  </div>
                )}
                {p.precioUsd > 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 12, fontFamily: MONO }}>
                    techo de IA para 75%: {usd(techoIa(p))}
                  </div>
                )}
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.7 }}>
                  {p.incluye.map((i) => <li key={i}>{i}</li>)}
                </ul>
                {p.noIncluye.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.7 }}>
                    {p.noIncluye.map((i) => <li key={i} style={{ textDecoration: 'line-through' }}>{i}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20 }}>
          <Eyebrow>Qué alcanza cada cupo</Eyebrow>
          <div style={{ marginTop: 8 }}>
            <Fila head plantilla="90px repeat(3, minmax(0,1fr))" cols={['Plan', 'Reuniones', 'Llamadas analizadas', 'Mensajes a MaKo']} />
            {PLANES.map((p) => {
              const reunion = ACCIONES.find((a) => a.id === 'reunion')!;
              const closing = ACCIONES.find((a) => a.id === 'closing')!;
              const doer = ACCIONES.find((a) => a.id === 'doer')!;
              return (
                <Fila key={p.id} plantilla="90px repeat(3, minmax(0,1fr))"
                  cols={[
                    p.label,
                    <Num key="r">{Math.floor(p.cupoMt / mtDe(costoUnitario(reunion)))}</Num>,
                    <Num key="c">{Math.floor(p.cupoMt / mtDe(costoUnitario(closing)))}</Num>,
                    <Num key="d">{Math.floor(p.cupoMt / mtDe(costoUnitario(doer)))}</Num>,
                  ]} />
              );
            })}
          </div>
        </div>
      </Section>

      {/* ── 6. LO QUE TODAVÍA NO EXISTE ──────────────────────────────────── */}
      <Section titulo="Lo que va a costar lo que todavía no existe" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>precios de lista, relevados el 8 ago 2026</span>} card>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px', maxWidth: '72ch' }}>
          Generación de video, imagen y voz. Ojo con las fechas de apagado: en generación de medios los
          modelos mueren rápido, y hay tres en esta lista con fecha puesta.
        </p>

        {([['Video', VIDEO], ['Imagen', IMAGEN], ['Voz', AUDIO]] as const).map(([titulo, lista]) => (
          <div key={titulo} style={{ marginBottom: 22 }}>
            <Eyebrow>{titulo}</Eyebrow>
            <div style={{ marginTop: 6 }}>
              <Fila head plantilla="minmax(0,1.3fr) 92px minmax(0,2fr)" cols={['Modelo', 'Precio', 'Nota']} />
              {lista.map((m) => (
                <Fila key={m.id} plantilla="minmax(0,1.3fr) 92px minmax(0,2fr)"
                  cols={[
                    <span key="n" style={{ opacity: m.muere ? 0.6 : 1 }}>
                      <span style={{ color: 'var(--faint)', fontSize: 11.5 }}>{m.proveedor}</span><br />
                      <span style={{ textDecoration: m.muere ? 'line-through' : 'none' }}>{m.modelo}</span>
                    </span>,
                    <Num key="p">{m.usd === 0 ? '—' : `$${m.usd}`}</Num>,
                    <span key="q" style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {m.muere && <Status tono="bad">{`se apaga ${m.muere}`}</Status>}{m.muere ? ' ' : ''}
                      <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: MONO }}>{m.unidad}</span>
                      {' · '}{m.nota}
                    </span>,
                  ]} />
              ))}
            </div>
          </div>
        ))}

        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 14, background: 'var(--surface-2)' }}>
          <strong style={{ fontSize: 13 }}>{VIDEO_15S.que}: piso {usd(VIDEO_15S.piso)}</strong>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: MONO, margin: '3px 0 7px' }}>{VIDEO_15S.pisoQuien}</div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, lineHeight: 1.6, maxWidth: '74ch' }}>{VIDEO_15S.nota}</p>
        </div>
      </Section>

      {/* ── 7. LA ECONOMÍA DEL NEGOCIO ───────────────────────────────────── */}
      <Section titulo="La economía del negocio, no la de la IA" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>benchmarks con fuente y muestra</span>} card>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px', maxWidth: '72ch' }}>
          El costo de la IA decide el margen bruto. Lo que decide si el negocio cierra es esto — y acá
          está el hallazgo que más pesa de todo el análisis, que no es de costos sino de <strong>precio</strong>.
        </p>
        {ECONOMIA.map((d, i) => (
          <div key={d.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', padding: '14px 0' }}>
            <strong style={{ fontSize: 13.5 }}>{d.titulo}</strong>
            <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--mako-ink)', margin: '5px 0 6px' }}>{d.numero}</div>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 6px', maxWidth: '78ch', lineHeight: 1.65 }}>{d.que}</p>
            <div style={{ fontSize: 11, color: 'var(--faint)' }}>{d.fuente}</div>
          </div>
        ))}
        <div style={{ marginTop: 16, border: '1px solid var(--bad)', borderRadius: 'var(--r-lg)', padding: 14, background: 'var(--bad-bg)' }}>
          <Status tono="bad">No usar</Status>
          <div style={{ fontFamily: MONO, fontSize: 12.5, margin: '7px 0 5px' }}>{DATO_FALSO.numero}</div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, lineHeight: 1.6, maxWidth: '78ch' }}>{DATO_FALSO.por_que}</p>
        </div>
      </Section>

      {/* ── 8. BLOQUEANTES ───────────────────────────────────────────────── */}
      <Section titulo="Lo que hay que arreglar antes de cobrar" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>verificado contra el código</span>} card>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px', maxWidth: '70ch' }}>
          No son mejoras: sin estos, el cupo de MaKo Tokens no se puede ni medir ni cobrar.
        </p>
        {BLOQUEANTES.map((b) => (
          <div key={b.id} style={{ borderTop: '1px solid var(--border)', padding: '14px 0' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>{b.orden}</span>
              <strong style={{ fontSize: 13.5 }}>{b.titulo}</strong>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '6px 0 6px 24px', maxWidth: '78ch', lineHeight: 1.65 }}>{b.que}</p>
            <div style={{ marginLeft: 24, fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{b.vive}</div>
          </div>
        ))}
      </Section>
    </>
  );
}
