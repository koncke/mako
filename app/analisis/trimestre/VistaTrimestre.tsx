'use client';

// =============================================================================
// VistaTrimestre — «Dónde se rompió el trimestre», junio a agosto de 2026
// =============================================================================
// Es un INFORME, no un tablero, y el orden es el argumento: primero el veredicto
// entero en tres párrafos, después la plata mes a mes, el embudo, los tres
// quiebres en orden de cuánto cuestan, lo que sí funcionó, el VSL, el ritmo
// semanal, la caja, y recién al final qué haría. Un informe que arranca por los
// creativos invita a optimizar el anuncio cuando el agujero está en el show rate
// — la misma razón que gobierna la tab Análisis de Experiments (antes /analisis).
//
// ⚠️ TODO SE LEE EN DÓLARES Y NINGÚN MONTO ESTÁ ESCRITO A MANO. La fuente
// (Meta) cobra en pesos mexicanos; el tipo de cambio del control de arriba
// convierte, y cambiarlo tiene que mover también las cifras que viven adentro de
// las frases. Por eso hasta el texto corrido llama a `M(...)`: un monto tipeado
// en un párrafo es el que se queda viejo primero y nadie lo ve, porque leyendo
// no se distingue de uno calculado.
//
// Es cliente por el control de tipo de cambio y por los tooltips de los tres
// gráficos. Los datos entran como módulo estático (./datos), así que no hay
// fetch ni estado del servidor cruzando la frontera.
// =============================================================================

import { useState, type ReactNode, type MouseEvent } from 'react';
import { MONO } from '@/app/_ui';
import {
  FX_DEFAULT, PERIODO, MESES, CAMPANAS, CAMPANA_GRANDE_MXN, CAMPANA_VOLUMEN,
  CAMPANA_CITAS, CAMPANA_MUDA, VSL, SEMANAS, COHORTES, PAGOS, HECHOS,
  T, LEADS_SIN_CITA, GASTO_LEADS_SIN_CITA,
  type CampanaTrimestre,
} from './datos';

// ── Formato ──────────────────────────────────────────────────────────────────

const n0 = (v: number): string => Math.round(v).toLocaleString('es-MX');
const n1 = (v: number): string =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Un monto en dólares. Debajo de US$100 va con un decimal y no por prolijidad:
 * el costo por lead de la 004 pasó de US$5,6 a US$1,8 en el trimestre, y
 * redondeado a entero esa caída se lee como «de 6 a 2» — el mismo número dicho
 * con la mitad de la precisión que tiene el dato.
 */
const D = (v: number): string =>
  v === 0 || Math.abs(v) >= 100 ? `US$${n0(v)}` : `US$${n1(v)}`;
const D2 = (v: number): string =>
  `US$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const mesLargo = (iso: string): string =>
  new Date(`${iso}-01T12:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

const diaLargo = (iso: string): string =>
  new Date(`${iso}T12:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

/** Marcas de un eje: pasos de 1 · 2 · 2,5 · 5 · 10 por magnitud, nunca a ojo. */
function marcas(max: number, n = 3): number[] {
  if (!(max > 0)) return [0];
  const crudo = max / n;
  const mag = 10 ** Math.floor(Math.log10(crudo));
  const paso = ([1, 2, 2.5, 5, 10].find((s) => s * mag >= crudo) ?? 10) * mag;
  const out: number[] = [];
  for (let v = 0; v <= max * 1.001; v += paso) out.push(Number(v.toFixed(6)));
  return out;
}

const campana = (prefijo: string): CampanaTrimestre =>
  CAMPANAS.find((c) => c.nombre.startsWith(prefijo)) ?? CAMPANAS[0];

// ── La vista ─────────────────────────────────────────────────────────────────

export function VistaTrimestre() {
  const [fx, setFx] = useState(FX_DEFAULT);
  const [tip, setTip] = useState<{ x: number; y: number; cuerpo: ReactNode } | null>(null);

  /** Pesos mexicanos → dólares. La única puerta por la que pasa la conversión. */
  const usd = (mxn: number): number => mxn / fx;
  /** Un monto que en la fuente está en pesos, listo para leerse. */
  const M = (mxn: number): string => D(usd(mxn));

  const hover = (cuerpo: ReactNode) => ({
    onMouseMove: (e: MouseEvent) => setTip({ x: e.clientX, y: e.clientY, cuerpo }),
    onMouseLeave: () => setTip(null),
  });

  const c004 = campana(CAMPANA_VOLUMEN);
  const c029 = campana(CAMPANA_CITAS);
  const c013 = campana(CAMPANA_MUDA);
  const ago = MESES[2];
  const cohorteAgo = COHORTES.find((c) => c.mes_inicio === '2026-08-01')!;

  const inversion = T('spend');
  const leads = T('crm_leads');
  const citas = T('agenda');
  const contratos = T('usd');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── El veredicto, entero, antes de cualquier número suelto ─────────── */}
      <div style={{
        border: '1px solid var(--border)', borderLeft: '3px solid var(--accent-soft)',
        background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '24px 26px',
      }}>
        <P>
          <b>El trimestre fue rentable y agosto lo cortó.</b> Invertiste <N>{M(inversion)}</N>,
          capturaste {n0(leads)} leads, agendaste {citas} citas y cerraste {T('cierres')} clientes
          por <N>{D(contratos)}</N> en contratos: un retorno
          de <N>{n1(contratos / usd(inversion))}×</N> sobre lo invertido. Pero los tres meses no
          cuentan la misma historia.
        </P>
        <P>
          Agosto fue el mes de mayor inversión del trimestre (<N>{M(ago.spend)}</N>,{' '}
          {Math.round((ago.spend / inversion) * 100)} % del total) y el único con <b>cero
          cierres</b>. No fue por falta de demanda: agosto generó {ago.agenda} citas, más que junio
          y julio juntos, y quintuplicó la conversión de lead a cita. Lo que falló está después de
          la cita, no antes.
        </P>
        <P ultimo>
          Y hay un hallazgo que no es de marketing sino de operación: <b>el 98 % de los leads de
          agosto tiene el campo de cierre vacío</b> en el CRM. La caja sí se registra al día, y no
          entra una primera cuota nueva desde el {diaLargo(HECHOS.ultima_cuota_1)}. Eso acota el
          problema, pero no lo cierra: hay que decidir si agosto no cerró o si nadie lo capturó.
        </P>
      </div>

      {/* ── Los seis números ────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(158px,1fr))', gap: 1,
        background: 'var(--border)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', overflow: 'hidden', marginTop: 22,
      }}>
        <Stat k="Inversión Meta" v={M(inversion)} n={`${n0(inversion)} MXN al cambio de ${n1(fx)}`} />
        <Stat k="Alcance" v={n0(T('reach'))} n={`${n0(T('impr'))} impresiones`} />
        <Stat k="Leads" v={n0(leads)} n={`Costo por lead ${M(inversion / leads)}`} />
        <Stat k="Citas agendadas" v={String(citas)} n={`${M(inversion / citas)} por cita`} destacado />
        <Stat k="Cierres" v={String(T('cierres'))} n={`CAC ${M(inversion / T('cierres'))}`} />
        <Stat k="Contratos" v={D(contratos)} n={`Ticket ${D(contratos / T('cierres'))}`} />
      </div>

      {/* ── El único supuesto del informe, a la vista y editable ────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        marginTop: 14, fontSize: 'var(--fs-sm)', color: 'var(--dim)',
      }}>
        <label htmlFor="fx">Tipo de cambio con el que se lee todo el informe:</label>
        <input
          id="fx" type="number" value={fx} min={1} max={40} step={0.1}
          aria-label="Pesos mexicanos por dólar"
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (v > 0) setFx(v);
          }}
          style={{
            fontFamily: MONO, fontSize: 13, width: 80, padding: '5px 8px', textAlign: 'right',
            border: '1px solid var(--border-strong)', borderRadius: 8,
            background: 'var(--surface)', color: 'var(--ink)',
          }}
        />
        <span>
          pesos mexicanos por dólar. Meta cobra en pesos y los contratos se firman en dólares;
          cambia el número y se recalcula el informe entero, incluidas las cifras de los párrafos.
        </span>
      </div>

      {/* ── 1 · El dinero, mes por mes ──────────────────────────────────────── */}
      <Sec
        titulo="El dinero, mes por mes"
        lede="Julio recortó el gasto 42 % y aun así trajo casi los mismos leads que junio. Agosto lo duplicó y consiguió tres veces más citas. La inversión no explica los resultados por sí sola."
      >
        <Scroll>
          <table style={tabla}>
            <thead>
              <tr>
                <Th izq>Métrica</Th>
                {MESES.map((m) => <Th key={m.mes}>{mesLargo(m.mes).split(' ')[0]}</Th>)}
                <Th>Trimestre</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Gasto Meta', (m: typeof ago) => M(m.spend), () => M(inversion)],
                ['Impresiones', (m: typeof ago) => n0(m.impr), () => n0(T('impr'))],
                ['Alcance', (m: typeof ago) => n0(m.reach), () => n0(T('reach'))],
                ['Clics al link', (m: typeof ago) => n0(m.clicks), () => n0(T('clicks'))],
                ['CTR', (m: typeof ago) => `${n1((m.clicks / m.impr) * 100)} %`, () => `${n1((T('clicks') / T('impr')) * 100)} %`],
                ['Visitas a la landing', (m: typeof ago) => n0(m.visits), () => n0(T('visits'))],
                ['Plays del VSL', (m: typeof ago) => n0(m.plays), () => n0(T('plays'))],
                ['Leads que reporta Meta', (m: typeof ago) => n0(m.meta_leads), () => n0(T('meta_leads'))],
                ['Leads en el CRM', (m: typeof ago) => n0(m.crm_leads), () => n0(leads)],
                ['Costo por lead', (m: typeof ago) => M(m.spend / m.crm_leads), () => M(inversion / leads)],
                ['Citas agendadas', (m: typeof ago) => n0(m.agenda), () => n0(citas), true],
                ['Costo por cita', (m: typeof ago) => (m.agenda ? M(m.spend / m.agenda) : '—'), () => M(inversion / citas), true],
                ['Junta 1 agendadas', (m: typeof ago) => n0(m.j1), () => n0(T('j1'))],
                ['Junta 1 asistidas', (m: typeof ago) => n0(m.j1show), () => n0(T('j1show'))],
                ['% de asistencia a J1', (m: typeof ago) => (m.j1 ? `${n1((m.j1show / m.j1) * 100)} %` : '—'), () => `${n1((T('j1show') / T('j1')) * 100)} %`],
                ['Junta 2 (propuesta)', (m: typeof ago) => n0(m.j2), () => n0(T('j2'))],
                ['Cierres', (m: typeof ago) => n0(m.cierres), () => n0(T('cierres')), true],
                ['Contratos firmados', (m: typeof ago) => D(m.usd), () => D(contratos)],
                ['Cobrado en el mes', (m: typeof ago) => D(m.cash), () => D(T('cash'))],
              ].map(([label, f, total, marca]) => (
                <tr key={label as string} style={label === 'Cierres' ? { background: 'var(--surface-2)' } : undefined}>
                  <Td izq>{label as string}</Td>
                  {MESES.map((m) => (
                    <Td key={m.mes} marca={Boolean(marca)}>{(f as (m: typeof ago) => string)(m)}</Td>
                  ))}
                  <Td fuerte>{(total as () => string)()}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
        <Pie>
          Gasto, impresiones y alcance vienen de la API de Meta a nivel anuncio, en pesos
          mexicanos, convertidos a dólares con el tipo de cambio de arriba. Leads en CRM son los
          que efectivamente entraron por webhook; la diferencia contra los que Meta reporta
          aparece más abajo.
        </Pie>
      </Sec>

      {/* ── 2 · El embudo ───────────────────────────────────────────────────── */}
      <Sec
        titulo="El embudo completo"
        lede="Cada etapa como porcentaje de la anterior. Marcado en dorado el punto donde se pierde más valor."
      >
        <div style={{
          border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
          background: 'var(--surface)', overflow: 'hidden',
        }}>
          {(() => {
            const F: Array<[string, number, string | null, boolean?]> = [
              ['Impresiones', T('impr'), null],
              ['Clics al link', T('clicks'), 'de las impresiones'],
              ['Leads (Meta)', T('meta_leads'), 'de los clics'],
              ['Leads en el CRM', leads, 'de los de Meta'],
              ['Citas agendadas', citas, 'de los leads', true],
              ['Junta 1 asistida', T('j1show'), 'de las citas'],
              ['Junta 2 realizada', T('j2'), 'de las J1 asistidas'],
              ['Cierres', T('cierres'), 'de las J2'],
            ];
            return F.map(([nombre, valor, base, clave], i) => {
              const prev = i ? F[i - 1][1] : null;
              const pct = prev ? (valor / prev) * 100 : 100;
              return (
                <div key={nombre} style={{
                  display: 'grid', gridTemplateColumns: '196px 1fr 92px 78px', gap: 14,
                  alignItems: 'center', padding: '11px 18px',
                  borderBottom: i < F.length - 1 ? '1px solid var(--border)' : undefined,
                }}>
                  <div style={{ fontSize: 13.5 }}>
                    {nombre}
                    {base && <small style={{ display: 'block', color: 'var(--faint)', fontSize: 11.5 }}>% {base}</small>}
                  </div>
                  <div style={{ height: 12, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.max(pct, 0.6)}%`, borderRadius: '0 3px 3px 0',
                      background: clave ? 'var(--accent)' : 'var(--ink)',
                    }} />
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>{n0(valor)}</div>
                  <div style={{
                    textAlign: 'right', fontSize: 13,
                    color: clave ? 'var(--accent)' : 'var(--faint)', fontWeight: clave ? 600 : 400,
                  }}>{prev ? `${n1(pct)} %` : '—'}</div>
                </div>
              );
            });
          })()}
        </div>
        <Pie>
          Acumulado de los tres meses. El salto de impresión a clic y de clic a lead está dentro de
          lo normal para prospección fría en B2B. El desplome está en el paso de lead a cita.
        </Pie>
      </Sec>

      {/* ── 3 · Los quiebres, en orden de cuánto cuestan ─────────────────────── */}
      <Sec titulo="Dónde se cayó" lede="Tres quiebres, en orden de cuánto dinero cuestan.">
        <Call n="QUIEBRE 01" h="El lead barato no agenda">
          <P>
            La campaña <b>004</b> se llevó {Math.round((c004.spend / inversion) * 100)} % del
            presupuesto y entregó los leads más baratos del trimestre: {n0(c004.leads)} leads
            a <N>{M(c004.spend / c004.leads)}</N> cada uno. De esos {n0(c004.leads)},{' '}
            <b>{c004.citas} agendaron</b>. Costo real por cita: <N>{M(c004.spend / c004.citas)}</N>.
          </P>
          <P>
            La campaña <b>029</b> hizo lo contrario. Sus leads
            cuestan {Math.round((c029.spend / c029.leads) / (c004.spend / c004.leads))} veces
            más (<N>{M(c029.spend / c029.leads)}</N>) porque lleva directo a calendario en vez de
            formulario. Pero de {c029.leads} leads, <b>{c029.citas} agendaron</b>. Costo real por
            cita: <N>{M(c029.spend / c029.citas)}</N> —{' '}
            <b>{n1((c004.spend / c004.citas) / (c029.spend / c029.citas))}× más eficiente</b> que
            la 004.
          </P>
          <P ultimo>
            Optimizar por costo por lead te llevó a poner el grueso del presupuesto en la campaña
            que menos citas produce. El costo por lead es la métrica equivocada para este negocio.
          </P>
        </Call>

        <Figura
          titulo="Lo que cuesta un lead vs. lo que cuesta una cita"
          leyenda={[['var(--ink)', 'Costo por lead'], ['var(--accent)', 'Costo por cita agendada']]}
          pie={`Campañas con más de ${M(CAMPANA_GRANDE_MXN)} de gasto en el trimestre. La ${CAMPANA_MUDA.replace('.', '')} es el caso extremo: ${c013.leads} leads baratos y una sola cita en tres meses.`}
        >
          <ChartCampanas usd={usd} D={D} hover={hover} />
        </Figura>

        <Call n="QUIEBRE 02" h={`Los ${n0(LEADS_SIN_CITA)} leads que nadie volvió a tocar`}>
          <P>
            De los {n0(leads)} leads capturados en el trimestre, <b>{n0(LEADS_SIN_CITA)} nunca
            agendaron</b>. Es el activo más grande que produjo tu inversión y está intacto: la
            tabla de nutrición registra <b>{HECHOS.nutricion.envios} envíos en total</b>, los tres
            fallidos, y el primero salió el {diaLargo(HECHOS.nutricion.primero)} — después del
            período analizado.
          </P>
          <P ultimo>
            Costaron <N>{M(GASTO_LEADS_SIN_CITA)}</N> aproximadamente. Sin secuencia de
            seguimiento, ese gasto se evapora: un lead de junio que no agendó en su primera semana
            hoy no existe para el sistema.
          </P>
        </Call>

        <Call n="QUIEBRE 03" h="La asistencia a Junta 1 se cae al escalar">
          <P>
            Cuando el volumen era bajo, la gente llegaba: en abril asistió
            el <b>{HECHOS.show.abril} %</b> de las Junta 1 agendadas. Conforme subió el volumen, la
            asistencia bajó a {HECHOS.show.mayo} % en mayo, {HECHOS.show.junio} % en junio y julio,
            y <b>{HECHOS.show.agosto} % en agosto</b>.
          </P>
          <P ultimo>
            Agosto agendó {cohorteAgo.total_j1} juntas y se presentaron {cohorteAgo.asistencias}.{' '}
            {cohorteAgo.total_j1 - cohorteAgo.asistencias} espacios de tu calendario quedaron
            vacíos. Ese es el costo de escalar sin cambiar el mecanismo de confirmación.
          </P>
        </Call>

        <Scroll>
          <table style={tabla}>
            <thead>
              <tr>
                <Th izq>Cohorte (mes de J1)</Th>
                <Th>J1 agendadas</Th><Th>Asistieron</Th><Th>% show</Th>
                <Th>Cierres</Th><Th>Ingreso</Th><Th>Ciclo (días)</Th>
              </tr>
            </thead>
            <tbody>
              {COHORTES.filter((c) => c.mes_inicio >= '2026-03').map((c) => {
                const show = c.total_j1 ? (c.asistencias / c.total_j1) * 100 : null;
                const hot = c.mes_inicio.slice(0, 7) === '2026-08';
                return (
                  <tr key={c.mes_inicio} style={hot ? { background: 'var(--surface-2)' } : undefined}>
                    <Td izq>{mesLargo(c.mes_inicio.slice(0, 7))}</Td>
                    <Td>{c.total_j1}</Td>
                    <Td>{c.asistencias}</Td>
                    <Td marca={show != null && show < 50}>{show == null ? '—' : `${n1(show)} %`}</Td>
                    <Td>{c.cierres}</Td>
                    <Td>{D(c.ingreso_total_usd)}</Td>
                    <Td>{c.dias_promedio_ciclo ?? '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Scroll>
        <Pie>
          Cohortes por mes de primera junta. Agosto aparece con estado «madurando»: su ciclo
          promedio histórico es de 5 a 29 días, así que a estas alturas ya debería haber producido
          cierres.
        </Pie>
      </Sec>

      {/* ── 4 · Lo que hay que proteger antes de tocar nada ──────────────────── */}
      <Sec
        titulo="Qué sí funcionó"
        lede="Cuatro cosas mejoraron de forma medible y conviene protegerlas antes de tocar nada."
      >
        <Call dorado h="La 029 es tu máquina de citas">
          <P ultimo>
            Produjo <b>31 de las {ago.agenda} citas de agosto</b> y {c029.citas} de las {citas} del
            trimestre. Es el único activo que convierte tráfico frío en calendario a un costo sano.
            Es lo último que hay que apagar.
          </P>
        </Call>

        <Sub titulo="La 004 alcanzó su mejor costo por lead histórico" tag="mejoró" />
        <P>
          Su costo por lead bajó de <N>{M(HECHOS.cpl_004.junio)}</N> en junio
          a <N>{M(HECHOS.cpl_004.julio)}</N> en julio y <N>{M(HECHOS.cpl_004.agosto)}</N> en
          agosto. Como generador de volumen barato funciona mejor que nunca; el problema es qué se
          hace con ese volumen después, no la campaña.
        </P>

        <Sub titulo="La conversión de lead a cita se quintuplicó" tag="clave" tagOn />
        <P>
          En julio, {n1(HECHOS.lead_a_cita.julio)} % de los leads agendaba. En agosto,{' '}
          <b>{n1(HECHOS.lead_a_cita.agosto)} %</b>. Aunque parte del salto viene de la mezcla de
          campañas, es la mejora más grande del trimestre y contradice la idea de que agosto trajo
          peor tráfico.
        </P>

        <Sub titulo="El CTR subió mientras crecía el gasto" />
        <P>
          De {n1(HECHOS.ctr.julio)} % en julio a <N>{n1(HECHOS.ctr.agosto)} %</N> en agosto, con
          más impresiones. Los creativos no se desgastaron: el
          anuncio <span style={{ fontFamily: MONO, fontSize: 13 }}>{HECHOS.creativo_top.nombre}</span>{' '}
          sostuvo {n0(HECHOS.creativo_top.leads)} leads a <N>{M(HECHOS.creativo_top.cpl)}</N>{' '}
          durante todo el trimestre.
        </P>
      </Sec>

      {/* ── 5 · El VSL ──────────────────────────────────────────────────────── */}
      <Sec
        titulo="El VSL"
        lede="De cada 100 personas que le dan play, cuántas siguen ahí en cada tramo del video."
      >
        <Figura
          titulo="Retención del VSL — julio contra agosto"
          leyenda={[
            ['var(--ink)', `Julio · ${n0(VSL.base['2026-07'])} plays`],
            ['var(--accent)', `Agosto · ${n0(VSL.base['2026-08'])} plays`],
          ]}
          pie="Junio queda fuera: el rastreo por persona arrancó el 15 de junio y su curva sale inconsistente (marca más gente en el 10 % que en el 5 %), así que no es comparable."
        >
          <ChartVsl hover={hover} />
        </Figura>
        <P>
          La caída inicial es el problema. En julio, <b>{n1(VSL.series['2026-07'][0])} %</b> de
          quien daba play seguía en el primer 5 % del video; en agosto
          solo <b>{n1(VSL.series['2026-08'][0])} %</b>. Siete de cada diez personas abandonan antes
          de que empiece el argumento, y en agosto fueron casi ocho.
        </P>
        <P ultimo>
          De la mitad del video en adelante las dos curvas corren casi juntas y planas: quien pasa
          el minuto inicial se queda hasta el final. El video no aburre — <b>el problema es la
          entrada</b>. Los primeros 15 segundos son el punto de mayor retorno de todo el embudo.
        </P>
      </Sec>

      {/* ── 6 · El ritmo semanal ────────────────────────────────────────────── */}
      <Sec titulo="El ritmo semanal" lede="El costo por lead semana a semana, con el gasto de cada semana detrás.">
        <Figura
          titulo="Costo por lead por semana · junio a agosto"
          leyenda={[['var(--faint)', 'Gasto semanal'], ['var(--accent)', 'Costo por lead']]}
          pie={`El deterioro de las últimas tres semanas de agosto (${M(130)}, ${M(167)} y ${M(311)} por lead) coincide con el escalamiento de presupuesto: se le exigió más volumen a las mismas audiencias.`}
        >
          <ChartSemanas usd={usd} D={D} hover={hover} />
        </Figura>
      </Sec>

      {/* ── 7 · La caja ─────────────────────────────────────────────────────── */}
      <Sec
        titulo="La caja dice otra cosa que el CRM"
        lede="Agosto fue el mejor mes de cobranza del trimestre y aun así no entró un solo cliente nuevo."
      >
        <Scroll>
          <table style={tabla}>
            <thead>
              <tr><Th izq>Fecha</Th><Th izq>Cliente</Th><Th>Cuota</Th><Th>Monto</Th></tr>
            </thead>
            <tbody>
              {PAGOS.map((p, i) => (
                <tr key={`${p.fecha}-${i}`}>
                  <Td izq>{new Date(`${p.fecha}T12:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}</Td>
                  <Td izq>{p.cliente}</Td>
                  <Td marca={p.fecha >= '2026-08-01'}>#{p.cuota}</Td>
                  <Td>{D2(p.monto)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
        <P>
          Los <N>{D(ago.cash)}</N> cobrados en agosto son <b>cuotas 2 y 3 de clientes cerrados
          entre abril y julio</b>. La última primera cuota de un cliente nuevo entró
          el <b>{diaLargo(HECHOS.ultima_cuota_1)}</b>. La tabla de pagos se mantiene al día — hay
          un registro del 3 de septiembre — así que la ausencia de cobros iniciales en agosto es
          una señal real, no un hueco de captura.
        </P>
        <P ultimo>
          Eso deja dos lecturas posibles y hay que resolverla antes de decidir presupuesto: o
          las {cohorteAgo.asistencias} juntas que sí ocurrieron en agosto no cerraron, o cerraron y
          nadie lo registró. El resto del CRM apunta a lo primero, pero los campos de resultado
          están vacíos y no alcanza para afirmarlo.
        </P>
      </Sec>

      {/* ── 8 · Qué haría ahora ─────────────────────────────────────────────── */}
      <Sec titulo="Qué haría ahora" lede="En orden de impacto sobre el dinero, no de esfuerzo.">
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <Act n={1}>
            <b>Cerrar el ciclo de las {cohorteAgo.asistencias} juntas de agosto antes de mover un
            dólar.</b> Son prospectos que ya vieron el VSL, agendaron y se presentaron. Saber en
            qué quedaron define si el problema es de marketing o de cierre, y hasta que eso no esté
            claro cualquier cambio de presupuesto es a ciegas.
          </Act>
          <Act n={2}>
            <b>Mover presupuesto de la 004 a la 029.</b> A costo por cita constante,
            los <N>{M(c004.spend)}</N> que la 004 consumió habrían
            producido {Math.round(c004.spend / (c029.spend / c029.citas))} citas en la 029 en vez
            de {c004.citas}. Hacerlo por tramos y vigilando que el costo por cita de la 029 no se
            degrade al escalar, que es exactamente lo que le pasó a la 004.
          </Act>
          <Act n={3}>
            <b>Cambiar la métrica de optimización a costo por cita.</b> El costo por lead te está
            premiando la campaña equivocada. Todo el tablero debería rankear por costo por cita
            agendada y por costo por junta asistida.
          </Act>
          <Act n={4}>
            <b>Arreglar los primeros 15 segundos del VSL.</b> Ahí se pierde
            el {Math.round(100 - VSL.series['2026-08'][0])} % de la audiencia. Es el punto de mayor
            apalancamiento del embudo: subir la retención del 5 % de 24 % a 35 % vale más que
            cualquier optimización de puja.
          </Act>
          <Act n={5}>
            <b>Encender la nutrición sobre los {n0(LEADS_SIN_CITA)} leads que no agendaron.</b> Ya
            están pagados. La secuencia existe en el sistema pero nunca se activó y sus tres envíos
            de prueba fallaron; hay que depurarla antes de cargarle la base.
          </Act>
          <Act n={6}>
            <b>Atacar el no-show de Junta 1.</b> Pasó de {HECHOS.show.abril} %
            a {HECHOS.show.agosto} % de asistencia. Recordatorio por WhatsApp a 24 y a 2 horas, y
            confirmación activa el mismo día. Recuperar 20 puntos de asistencia en agosto habrían
            sido 7 juntas más sin gastar un dólar adicional.
          </Act>
        </ol>
      </Sec>

      {/* ── Cómo se construyó ───────────────────────────────────────────────── */}
      <div style={{
        marginTop: 46, borderTop: '1px solid var(--border)', paddingTop: 20,
        fontSize: 'var(--fs-sm)', color: 'var(--dim)',
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'var(--faint)', marginBottom: 12,
        }}>
          Cómo se construyó y qué no cubre
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li style={{ maxWidth: '78ch' }}>
            <b>Fuente:</b> base de datos de MaKo en Supabase, workspace 1 (Mauricio Bustos), leída
            en modo solo lectura el {diaLargo(PERIODO.leido)}. Meta a nivel anuncio
            vía <Mono>marketing_metrics_daily</Mono>; el resto de <Mono>leads</Mono>,{' '}
            <Mono>landing_visits</Mono>, <Mono>vsl_events</Mono>, <Mono>pagos</Mono> y la vista de
            cohortes. Se excluyó el tráfico marcado como prueba. Los números están congelados a esa
            fecha a propósito: un informe que se cita tiene que dar lo mismo seis meses después.
          </li>
          <li style={{ maxWidth: '78ch' }}>
            <b>Moneda:</b> el gasto de Meta está en pesos mexicanos y los contratos y cobros en
            dólares. Todo el informe se lee en dólares usando el tipo de cambio del control de
            arriba, por omisión {n1(FX_DEFAULT)}. <b>No es el tipo de cambio real de cada mes</b>,
            así que las cifras convertidas son órdenes de magnitud, no contabilidad. Lo que ya
            estaba en dólares —contratos, cuotas cobradas, ingreso por cohorte— no se toca.
          </li>
          <li style={{ maxWidth: '78ch' }}>
            <b>Junio está incompleto</b> en landing y VSL: el rastreo arrancó el 20 y el 15 de
            junio respectivamente. Sus {n0(MESES[0].visits)} visitas cubren unos once días, no el
            mes; por eso el crecimiento de visitas hacia agosto está sobreestimado y la curva de
            retención de junio quedó fuera del análisis. Las métricas de Meta sí cubren los tres
            meses completos.
          </li>
          <li style={{ maxWidth: '78ch' }}>
            <b>No hay etapa de presupuesto en el sistema.</b> El pipeline va de agenda J1 a agenda
            J2 a facturando a ganado, y en la metodología la propuesta se presenta en la Junta 2.
            Por eso «presupuestos» se lee aquí como Junta 2 realizada. La
            tabla <Mono>propuestas</Mono> no sirve para esto: es la cola de acciones sugeridas por
            el agente de MaKo y sus 15 registros de agosto son pruebas.
          </li>
          <li style={{ maxWidth: '78ch' }}>
            <b>Fuga de captura:</b> Meta reporta {n0(HECHOS.meta_leads_total)} leads y al CRM
            llegaron {n0(leads)}. Faltan {n0(HECHOS.meta_leads_total - leads)}, un{' '}
            {Math.round(((HECHOS.meta_leads_total - leads) / HECHOS.meta_leads_total) * 100)} %.
            Vale la pena revisar el webhook antes del próximo trimestre.
          </li>
          <li style={{ maxWidth: '78ch' }}>
            <b>Atribución:</b> {HECHOS.citas_atribuidas} de las {citas} citas se atribuyeron a
            campaña resolviendo los UTM numéricos contra los identificadores de Meta. Una quedó sin
            origen.
          </li>
          <li style={{ maxWidth: '78ch' }}>
            <b>Lo que no se midió:</b> LinkedIn, referidos y Círculo Rojo. Este análisis cubre solo
            el embudo pagado de Meta.
          </li>
        </ul>
      </div>

      {tip && (
        <div
          role="status"
          style={{
            position: 'fixed', left: tip.x + 14, top: Math.max(tip.y - 10, 8),
            pointerEvents: 'none', zIndex: 99, maxWidth: 240, lineHeight: 1.45,
            background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 12,
            padding: '7px 10px', borderRadius: 8, boxShadow: 'var(--sh-2, 0 4px 12px rgba(0,0,0,.18))',
          }}
        >
          {tip.cuerpo}
        </div>
      )}
    </div>
  );
}

// ── Los tres gráficos ────────────────────────────────────────────────────────

type Hover = (cuerpo: ReactNode) => {
  onMouseMove: (e: MouseEvent) => void;
  onMouseLeave: () => void;
};

/**
 * Campañas: dos paneles en la misma fila, costo por lead a la izquierda y costo
 * por cita a la derecha. Es el gráfico que ES el argumento del informe — las
 * barras largas cambian de lado entre un panel y el otro.
 */
function ChartCampanas({ usd, D: fmt, hover }: { usd: (n: number) => number; D: (n: number) => string; hover: Hover }) {
  const grandes = CAMPANAS.filter((c) => c.spend >= CAMPANA_GRANDE_MXN);
  const chicas = CAMPANAS.filter((c) => c.spend < CAMPANA_GRANDE_MXN);
  const grupo: CampanaTrimestre = {
    nombre: `Reconocimiento · ${chicas.length} campañas`,
    spend: chicas.reduce((a, c) => a + c.spend, 0),
    leads: chicas.reduce((a, c) => a + c.leads, 0),
    impr: 0, clicks: 0,
    citas: chicas.reduce((a, c) => a + c.citas, 0),
    shows: 0,
  };
  const R = [...grandes, grupo].map((c) => ({
    n: c.nombre, sp: usd(c.spend), l: c.leads, ci: c.citas,
    cpl: c.leads ? usd(c.spend / c.leads) : null,
    cpc: c.citas ? usd(c.spend / c.citas) : null,
  }));

  const W = 740, filaH = 46, padT = 26, H = padT + R.length * filaH + 16;
  const AX = 164, AW = 234, BX = 452, BW = 268;
  const maxA = Math.max(...R.map((r) => r.cpl ?? 0));
  const maxB = Math.max(...R.map((r) => r.cpc ?? 0));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Costo por lead y costo por cita, por campaña" style={svgFluido}>
      <text x={AX} y={14} fill="var(--faint)" fontSize={10.5} fontFamily={MONO} letterSpacing=".08em">COSTO POR LEAD</text>
      <text x={BX} y={14} fill="var(--faint)" fontSize={10.5} fontFamily={MONO} letterSpacing=".08em">COSTO POR CITA AGENDADA</text>
      {R.map((r, i) => {
        const y = padT + i * filaH + 14;
        const nombre = r.n.length > 26 ? `${r.n.slice(0, 25)}…` : r.n;
        const wA = r.cpl == null ? 0 : Math.max((r.cpl / maxA) * AW, 2);
        const wB = r.cpc == null ? 0 : Math.max((r.cpc / maxB) * BW, 2);
        return (
          <g key={r.n}>
            <text x={0} y={y + 4} fill="var(--ink)" fontSize={12} {...hover(<><b>{r.n}</b><br />Gasto {fmt(r.sp)}</>)}>{nombre}</text>
            <text x={0} y={y + 18} fill="var(--faint)" fontSize={10.5} fontFamily={MONO}>
              {fmt(r.sp)} · {r.ci} {r.ci === 1 ? 'cita' : 'citas'}
            </text>

            {r.cpl == null ? (
              <text x={AX} y={y + 5} fill="var(--faint)" fontSize={11.5} fontStyle="italic">sin leads</text>
            ) : (
              <>
                <rect x={AX} y={y - 6} width={wA} height={13} rx={2} fill="var(--ink)"
                  {...hover(<><b>{r.n}</b><br />{n0(r.l)} leads<br />Costo por lead: {fmt(r.cpl)}</>)} />
                <text x={AX + wA + 7} y={y + 5} fill="var(--dim)" fontSize={11.5} fontWeight={600}>{fmt(r.cpl)}</text>
              </>
            )}

            {r.cpc == null ? (
              <text x={BX} y={y + 5} fill="var(--faint)" fontSize={11.5} fontStyle="italic">ninguna cita</text>
            ) : (
              <>
                <rect x={BX} y={y - 6} width={wB} height={13} rx={2} fill="var(--accent)"
                  {...hover(<><b>{r.n}</b><br />{r.ci} citas de {n0(r.l)} leads<br />Costo por cita: {fmt(r.cpc)}</>)} />
                <text x={Math.min(BX + wB + 7, W - 58)} y={y + 5} fill="var(--dim)" fontSize={11.5} fontWeight={600}>{fmt(r.cpc)}</text>
              </>
            )}

            {i < R.length - 1 && <line x1={0} x2={W} y1={y + 26} y2={y + 26} stroke="var(--border)" strokeWidth={1} />}
          </g>
        );
      })}
    </svg>
  );
}

/** Retención del VSL. El eje Y no arranca en el máximo del dato: 32 % es el techo fijo. */
function ChartVsl({ hover }: { hover: Hover }) {
  const h = VSL.hitos;
  const series: Array<['2026-07' | '2026-08', string, string]> = [
    ['2026-07', 'var(--ink)', 'Julio'],
    ['2026-08', 'var(--accent)', 'Agosto'],
  ];
  const W = 740, H = 290, L = 42, Rp = 16, Tp = 16, B = 40;
  const iw = W - L - Rp, ih = H - Tp - B, maxY = 32;
  const X = (v: number) => L + ((v - 5) / 95) * iw;
  const Y = (v: number) => Tp + ih - (v / maxY) * ih;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Curva de retención del VSL" style={svgFluido}>
      {[0, 10, 20, 30].map((g) => (
        <g key={g}>
          <line x1={L} x2={W - Rp} y1={Y(g)} y2={Y(g)} stroke="var(--border)" strokeWidth={1} />
          <text x={L - 8} y={Y(g) + 4} textAnchor="end" fill="var(--faint)" fontSize={10.5} fontFamily={MONO}>{g} %</text>
        </g>
      ))}
      {[5, 25, 50, 75, 100].map((v) => (
        <text key={v} x={X(v)} y={H - 16} textAnchor="middle" fill="var(--faint)" fontSize={10.5} fontFamily={MONO}>{v} %</text>
      ))}
      <text x={L + iw / 2} y={H - 2} textAnchor="middle" fill="var(--faint)" fontSize={10.5}>tramo del video</text>

      {series.map(([k, color]) => (
        <path key={k} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
          d={VSL.series[k].map((v, i) => `${i ? 'L' : 'M'}${X(h[i])} ${Y(v)}`).join(' ')} />
      ))}

      {h.map((hh, i) => (
        <rect key={hh} x={X(hh) - 9} y={Tp} width={18} height={ih} fill="transparent"
          {...hover(
            <>
              <b>Tramo {hh} % del video</b><br />
              Julio: {n1(VSL.series['2026-07'][i])} % sigue viendo<br />
              Agosto: {n1(VSL.series['2026-08'][i])} % sigue viendo
            </>,
          )} />
      ))}

      {series.map(([k, color]) => VSL.series[k].map((v, i) => (
        (i % 3 === 0 || i === VSL.series[k].length - 1)
          ? <circle key={`${k}-${i}`} cx={X(h[i])} cy={Y(v)} r={3.4} fill={color} stroke="var(--surface)" strokeWidth={2} />
          : null
      )))}

      {series.map(([k, color, lab]) => (
        <text key={`lab-${k}`} x={X(h[0]) + 8} y={Y(VSL.series[k][0]) - 9} fill={color} fontSize={11.5} fontWeight={700}>
          {lab} {n1(VSL.series[k][0])} %
        </text>
      ))}
    </svg>
  );
}

/** Gasto semanal en barras arriba, costo por lead en línea abajo. Los dos en dólares. */
function ChartSemanas({ usd, D: fmt, hover }: { usd: (n: number) => number; D: (n: number) => string; hover: Hover }) {
  const W = 740, TH = 86, BH = 118, GAP = 30, LX = 46, Rp = 14, H = TH + GAP + BH + 34;
  const iw = W - LX - Rp, bw = iw / SEMANAS.length;
  const maxS = Math.max(...SEMANAS.map((d) => usd(d.spend)));
  const maxC = Math.max(...SEMANAS.map((d) => usd(d.cpl)));
  const y0 = TH + GAP, ih = BH - 26;
  const Y = (v: number) => y0 + 8 + ih - (v / maxC) * ih;
  const ejeY = marcas(maxC, 4);
  const pts = SEMANAS.map((d, i) => [LX + i * bw + bw / 2, Y(usd(d.cpl))] as const);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gasto y costo por lead por semana" style={svgFluido}>
      <text x={0} y={9} fill="var(--faint)" fontSize={10.5} fontFamily={MONO} letterSpacing=".08em">GASTO SEMANAL</text>
      {SEMANAS.map((d, i) => {
        const alto = Math.max((usd(d.spend) / maxS) * (TH - 18), 1);
        return (
          <rect key={d.semana} x={LX + i * bw + bw * 0.16} y={16 + (TH - 18) - alto} width={bw * 0.68} height={alto} rx={2} fill="var(--faint)"
            {...hover(
              <>
                <b>Semana del {diaLargo(d.semana)}</b><br />
                Gasto: {fmt(usd(d.spend))}<br />Leads: {d.leads}<br />
                Costo por lead: {fmt(usd(d.cpl))}
              </>,
            )} />
        );
      })}

      <text x={0} y={y0 - 6} fill="var(--faint)" fontSize={10.5} fontFamily={MONO} letterSpacing=".08em">COSTO POR LEAD</text>
      {ejeY.map((g) => (
        <g key={g}>
          <line x1={LX} x2={W - Rp} y1={Y(g)} y2={Y(g)} stroke="var(--border)" strokeWidth={1} />
          <text x={LX - 8} y={Y(g) + 4} textAnchor="end" fill="var(--faint)" fontSize={10.5} fontFamily={MONO}>{fmt(g)}</text>
        </g>
      ))}
      <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={SEMANAS[i].semana} cx={p[0]} cy={p[1]} r={3.6} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2}
          {...hover(
            <>
              <b>Semana del {diaLargo(SEMANAS[i].semana)}</b><br />
              Costo por lead: {fmt(usd(SEMANAS[i].cpl))}<br />
              {SEMANAS[i].leads} leads · {fmt(usd(SEMANAS[i].spend))} de gasto
            </>,
          )} />
      ))}
      {SEMANAS.map((d, i) => (i % 2 ? null : (
        <text key={d.semana} x={LX + i * bw + bw / 2} y={H - 8} textAnchor="middle" fill="var(--faint)" fontSize={10} fontFamily={MONO}>
          {new Date(`${d.semana}T12:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '')}
        </text>
      )))}
    </svg>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────────

const svgFluido = { display: 'block', width: '100%', height: 'auto', overflow: 'visible' } as const;

const tabla = { width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 560 } as const;

function Th({ children, izq }: { children: ReactNode; izq?: boolean }) {
  return (
    <th style={{
      textAlign: izq ? 'left' : 'right', padding: '9px 12px',
      borderBottom: '1px solid var(--border)', background: 'var(--surface-2)',
      fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase',
      color: 'var(--faint)', fontWeight: 500, whiteSpace: 'nowrap',
    }}>{children}</th>
  );
}

function Td({ children, izq, marca, fuerte }: { children: ReactNode; izq?: boolean; marca?: boolean; fuerte?: boolean }) {
  return (
    <td style={{
      textAlign: izq ? 'left' : 'right', padding: '9px 12px',
      borderBottom: '1px solid var(--border)',
      fontVariantNumeric: izq ? undefined : 'tabular-nums',
      whiteSpace: izq ? 'normal' : 'nowrap',
      minWidth: izq ? 170 : undefined,
      color: marca ? 'var(--accent)' : 'var(--ink)',
      fontWeight: marca || fuerte ? 600 : 400,
    }}>{children}</td>
  );
}

function Scroll({ children }: { children: ReactNode }) {
  return (
    <div className="mk-scroll-x" style={{
      overflowX: 'auto', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', background: 'var(--surface)',
    }}>{children}</div>
  );
}

function Sec({ titulo, lede, children }: { titulo: string; lede: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 56 }}>
      <h2 style={{ margin: 0, fontSize: 'var(--fs-sect)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{titulo}</h2>
      <p style={{ margin: '10px 0 18px', maxWidth: '68ch', color: 'var(--dim)', lineHeight: 1.55 }}>{lede}</p>
      {children}
    </section>
  );
}

function Sub({ titulo, tag, tagOn }: { titulo: string; tag?: string; tagOn?: boolean }) {
  return (
    <h3 style={{
      fontSize: 'var(--fs-card)', fontWeight: 600, margin: '30px 0 0',
      display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
    }}>
      {titulo}
      {tag && (
        <span style={{
          fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: 4, fontWeight: 400,
          border: `1px solid ${tagOn ? 'var(--accent)' : 'var(--border-strong)'}`,
          color: tagOn ? 'var(--accent)' : 'var(--faint)',
        }}>{tag}</span>
      )}
    </h3>
  );
}

function P({ children, ultimo }: { children: ReactNode; ultimo?: boolean }) {
  return <p style={{ margin: ultimo ? '0' : '0 0 12px', maxWidth: '70ch', lineHeight: 1.62, color: 'var(--ink)' }}>{children}</p>;
}

/** Un número que el ojo tiene que poder encontrar sin leer la frase entera. */
function N({ children }: { children: ReactNode }) {
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{children}</span>;
}

function Mono({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: MONO, fontSize: 12.5 }}>{children}</span>;
}

function Call({ n, h, dorado, children }: { n?: string; h: string; dorado?: boolean; children: ReactNode }) {
  return (
    <div style={{
      border: `1px solid ${dorado ? 'var(--mako-border)' : 'var(--border)'}`,
      background: dorado ? 'var(--mako-bg)' : 'var(--surface)',
      borderRadius: 'var(--r-lg)', padding: '20px 22px', marginTop: 20,
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
        fontWeight: 700, fontSize: 'var(--fs-card)', marginBottom: 10, color: 'var(--ink)',
      }}>
        {n && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--accent)', letterSpacing: '.1em', fontWeight: 500 }}>{n}</span>}
        {h}
      </div>
      {children}
    </div>
  );
}

function Figura({ titulo, leyenda, pie, children }: {
  titulo: string;
  leyenda: Array<[string, string]>;
  pie: string;
  children: ReactNode;
}) {
  return (
    <figure style={{ margin: '24px 0 0' }}>
      <div style={{
        border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
        background: 'var(--surface)', padding: '18px 18px 12px',
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14.5 }}>{titulo}</p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '0 0 14px', fontSize: 12.5, color: 'var(--dim)' }}>
          {leyenda.map(([color, texto]) => (
            <span key={texto} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <i style={{ width: 11, height: 11, borderRadius: 3, background: color, display: 'inline-block' }} />
              {texto}
            </span>
          ))}
        </div>
        <div className="mk-scroll-x" style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 560 }}>{children}</div>
        </div>
      </div>
      <figcaption style={{ fontSize: 12.5, color: 'var(--faint)', margin: '10px 0 0', maxWidth: '74ch' }}>{pie}</figcaption>
    </figure>
  );
}

function Pie({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: '10px 0 0', maxWidth: '74ch', lineHeight: 1.55 }}>{children}</p>;
}

/**
 * Una acción numerada. El número viaja como prop y no como `counter()` de CSS:
 * los estilos acá son inline y un contador necesita un `::before`, que solo se
 * puede escribir en una hoja. Escribirlo a mano en cada `<li>` tampoco — al
 * reordenar dos acciones quedaría «02, 01» y nadie lo mira.
 */
function Act({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li style={{ position: 'relative', padding: '0 0 0 42px', margin: '0 0 20px', maxWidth: '70ch', lineHeight: 1.62 }}>
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 1, fontFamily: MONO, fontSize: 12,
        color: 'var(--accent)', fontWeight: 500,
      }}>{String(n).padStart(2, '0')}</span>
      {children}
    </li>
  );
}

function Stat({ k, v, n, destacado }: { k: string; v: string; n: string; destacado?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', padding: '16px 18px 14px' }}>
      <div style={{
        fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase',
        color: 'var(--faint)',
      }}>{k}</div>
      <div style={{
        fontWeight: 700, fontSize: 26, lineHeight: 1.15, marginTop: 8,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
        color: destacado ? 'var(--accent)' : 'var(--ink)',
      }}>{v}</div>
      <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 4, lineHeight: 1.4 }}>{n}</div>
    </div>
  );
}
