// =============================================================================
// VistaAnalisis — el informe, en el orden en que se pregunta
// =============================================================================
// La tab «Análisis» de Experiments (/experimentos?tab=analisis). Hasta el
// 11/10/2026 era su propia tab de la barra, /analisis (que hoy redirige acá con
// su query); Martín pidió llevarla adentro de Experiments. La calcula
// app/experimentos/page.tsx sólo cuando esta tab está abierta, y llega a
// ExperimentosApp (client) como un ReactNode ya dibujado en el server.
//
// Sale de la reunión Mau <> Martín del 31/07/2026: tres horas mirando los datos
// en vivo, de las cuales **media fue aritmética con la calculadora del celular**.
// Esta vista es esa aritmética resuelta, en el mismo orden en que se pregunta.
//
// POR QUÉ NO ES OTRO DASHBOARD, y es la decisión que gobierna el diseño: un
// dashboard muestra métricas y deja que la persona arme la historia. Acá el orden
// ES la historia — primero qué pasó, después dónde se va la plata escalón por
// escalón, después la fuga barata (los que asistieron sin calificar), después qué
// replicar y al final qué haría falta para la meta. Un informe que arranca por los
// creativos invita a optimizar el anuncio cuando el agujero está en el show rate.
//
// Y LAS ADVERTENCIAS VAN ARRIBA DE TODO. Si el 46% de las asistencias no tiene la
// calificación marcada, eso hay que saberlo ANTES de leer el número — no después
// de haber sacado una conclusión. Es la misma razón por la que el rango de fechas
// se dice en el encabezado y no se esconde: el «histórico» sin fecha de inicio fue
// lo que en la reunión dejó todos los costos unitarios 33% abajo.
//
// Server component a propósito: no hay estado que manejar (el rango viaja en la
// URL, para que un análisis se pueda compartir y volver a abrir igual) y así el
// tipo `AnalisisNegocio` nunca cruza la frontera al bundle del navegador.
//
// Los links de rango llevan `tab=analisis`: sin él, /experimentos abre en Retro
// y el rango nuevo se calcula para nadie. Navegan en suave (el Link de la casa,
// que además conserva el ?ws=) y ExperimentosApp no se desmonta, así que la tab
// sigue en Análisis y sólo llega el informe del rango nuevo.
// =============================================================================

import Link from '@/app/_ui/Link';
import { Section, Alert, Badge, MONO } from '@/app/_ui';
import type { AnalisisNegocio } from '@/lib/analisis-modelo';
import { RANGOS_ANALISIS, n0Analisis, pctAnalisis, rangoHace } from '@/lib/experimentos-formato';

// Los formateadores y los rangos viven en lib/experimentos-formato.ts (módulo PURO, 15/10/2026): el
// Análisis del teléfono (app/m/experimentos/AnalisisM.tsx) escribe los MISMOS números con ellos.
const pct = pctAnalisis;
const n0 = n0Analisis;
const RANGOS = RANGOS_ANALISIS;
const hace = (dias: number) => rangoHace(dias);

export function VistaAnalisis({ datos, error }: { datos: AnalisisNegocio | null; error: string }) {
  if (error || !datos) {
    return (
      <Alert tono="bad">
        No se pudo armar el análisis: {error || 'sin datos'}.
        {/rango|fecha/i.test(error) ? ' Revisa las fechas del filtro.' : ''}
      </Alert>
    );
  }

  const a = datos;
  const c = a.cascada;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      {/* ── El rango, arriba y visible. Nunca un «histórico» mudo. ─────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>
          {a.periodo.desde} → {a.periodo.hasta} · {a.periodo.zona}
        </span>
        {RANGOS.map((r) => {
          const { desde, hasta } = hace(r.dias);
          return (
            <Link key={r.label} href={`/experimentos?tab=analisis&desde=${desde}&hasta=${hasta}`} scroll={false}
              style={{ fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none' }}>
              {r.label}
            </Link>
          );
        })}
      </div>

      {/* ── LAS ADVERTENCIAS VAN PRIMERO, no al pie ────────────────────────── */}
      {a.advertencias.length > 0 && (
        <Section titulo="Antes de leer los números">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {a.advertencias.map((w, i) => (
              <Alert key={i} tono={w.startsWith('⚠️') ? 'warn' : 'info'}>{w.replace(/^⚠️\s*/, '')}</Alert>
            ))}
          </div>
        </Section>
      )}

      {/* ── 1 · La cascada ──────────────────────────────────────────────────── */}
      <Section titulo="La cascada" nota="Cuánto entró en cada escalón y cuánto costó cada uno.">
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 14 }}>
          <Dato k="Inversión" v={n0(c.inversion)} sub={c.inversion_usd == null ? '' : `~US$${n0(c.inversion_usd)}`} />
          <Dato k="Ingreso" v={c.ingreso_usd == null ? '—' : `US$${n0(c.ingreso_usd)}`} />
          <Dato k="ROAS" v={c.roas == null ? '—' : `${c.roas}x`}
            sub={c.roas == null ? 'falta cargar el ingreso' : ''} />
        </div>
        <Tabla
          cabeceras={['Escalón', 'Cuántos', 'Costo c/u', 'Sobrevive', 'De dónde sale']}
          alinear={['left', 'right', 'right', 'right', 'left']}
          filas={c.escalones.map((e) => [
            e.nombre,
            String(e.cantidad),
            e.costo_unitario == null ? '—'
              : `${n0(e.costo_unitario)}${e.costo_unitario_usd == null ? '' : ` · ~US$${n0(e.costo_unitario_usd)}`}`,
            pct(e.conversion_desde_anterior),
            e.fuente,
          ])}
        />
        <p style={{ fontSize: 13, color: 'var(--faint)', marginTop: 12 }}>
          Show rate <b>{pct(a.tasas.show_rate)}</b> · no-show <b>{pct(a.tasas.no_show)}</b> ·
          cierre sobre asistencias <b>{pct(a.tasas.tasa_cierre_sobre_asistencias)}</b> ·
          hacen falta <b>{a.tasas.agendas_por_cierre ?? '—'} agendas por cada cierre</b>.
        </p>
      </Section>

      {/* ── 2 · La fuga barata ──────────────────────────────────────────────── */}
      <Section titulo="Los que asistieron y no calificaban"
        nota="Llamadas pagadas con gente que no podía comprar. Es la fuga más barata de tapar.">
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <Dato k="Asistieron" v={String(a.calificacion.asistieron)} />
          <Dato k="Calificados" v={String(a.calificacion.calificados)} />
          <Dato k="No calificaban" v={String(a.calificacion.no_calificados)} />
          <Dato k="Sin marcar" v={String(a.calificacion.sin_marcar)}
            sub={a.calificacion.sin_marcar > 0 ? 'ni sí ni no' : ''} />
        </div>
        {a.calificacion.respuestas_no_calificados.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>Qué contestaron los que no calificaban:</p>
            {a.calificacion.respuestas_no_calificados.map((r) => (
              <p key={r.pregunta} style={{ fontSize: 13, color: 'var(--faint)', margin: '3px 0' }}>
                <b style={{ color: 'var(--ink)' }}>{r.pregunta}</b>{' — '}
                {Object.entries(r.respuestas).map(([v, k]) => `${v} (${k})`).join(' · ')}
              </p>
            ))}
          </div>
        )}
      </Section>

      {/* ── 3 · Los creativos ───────────────────────────────────────────────── */}
      <Section titulo="Los creativos"
        nota={`${a.creativos.total_anuncios} anuncios · ${a.creativos.con_agendas} trajeron agenda · mediana ${n0(a.creativos.mediana_costo_por_agenda)} por agenda`}>
        <Alert tono="info">{a.creativos.nota_fuente}</Alert>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginTop: 14 }}>
          <ListaCreativos titulo="Los que más trajeron" sub="el ranking que se mira por reflejo"
            items={a.creativos.top_volumen.slice(0, 5)} destacar="agendas" />
          <ListaCreativos titulo="Los más baratos por agenda" sub="el ranking que decide dónde va la plata"
            items={a.creativos.top_costo.slice(0, 5)} destacar="costo" />
        </div>
        {a.creativos.escondidos.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <ListaCreativos
              titulo="Los que el ranking por cantidad esconde"
              sub="baratos con poco volumen — son los candidatos a replicar"
              items={a.creativos.escondidos} destacar="costo" />
          </div>
        )}
      </Section>

      {/* ── 4 · La meta ─────────────────────────────────────────────────────── */}
      {a.plan && (
        <Section titulo="Para llegar a la meta"
          nota="Derivado de las tasas MEDIDAS de este período, no de las deseadas.">
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <Dato k="Cierres objetivo" v={String(a.plan.cierres_objetivo)} />
            <Dato k="Asistencias" v={String(a.plan.asistencias_necesarias ?? '—')} />
            <Dato k="Agendas" v={String(a.plan.agendas_necesarias ?? '—')} />
            <Dato k="Inversión" v={n0(a.plan.inversion_necesaria)} />
          </div>
          {a.plan.contradiccion && <div style={{ marginTop: 12 }}><Alert tono="warn">{a.plan.contradiccion}</Alert></div>}
        </Section>
      )}

      {/* ── 5 · La forma, mes a mes ─────────────────────────────────────────── */}
      <Section titulo="Mes a mes" nota="El acumulado aplana todo; la serie muestra la forma.">
        <Tabla
          cabeceras={['Mes', 'Inversión', 'Agendas', 'R1 hechas', 'Cierres', 'Ingreso US$']}
          alinear={['left', 'right', 'right', 'right', 'right', 'right']}
          filas={a.serie.map((f) => [
            f.periodo, n0(f.meta_inversion), String(f.agendas_creadas),
            String(f.j1_realizadas), String(f.ganados), n0(f.ingreso_usd),
          ])}
        />
      </Section>
    </div>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Dato({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>{k}</div>
      <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{v}</div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--faint)' }}>{sub}</div> : null}
    </div>
  );
}

/** Tabla simple. El scroll horizontal va ADENTRO, nunca en la página. */
function Tabla({ cabeceras, filas, alinear }: {
  cabeceras: string[]; filas: string[][]; alinear: Array<'left' | 'right'>;
}) {
  return (
    <div className="mk-scroll-x" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr>
            {cabeceras.map((h, i) => (
              <th key={h} style={{
                textAlign: alinear[i], padding: '7px 10px', borderBottom: '1px solid var(--border)',
                fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase',
                color: 'var(--faint)', fontWeight: 500, whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, r) => (
            <tr key={r}>
              {f.map((celda, i) => (
                <td key={i} style={{
                  textAlign: alinear[i], padding: '7px 10px',
                  borderBottom: '1px solid var(--border)',
                  color: i === f.length - 1 && alinear[i] === 'left' ? 'var(--faint)' : 'var(--ink)',
                  fontSize: i === f.length - 1 && alinear[i] === 'left' ? 12 : 13.5,
                }}>{celda}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListaCreativos({ titulo, sub, items, destacar }: {
  titulo: string; sub: string;
  items: AnalisisNegocio['creativos']['top_costo'];
  destacar: 'agendas' | 'costo';
}) {
  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 10 }}>{sub}</div>
      {items.length === 0 && <p style={{ fontSize: 13, color: 'var(--faint)' }}>Sin anuncios con agendas en el período.</p>}
      {items.map((x) => (
        <div key={x.ad_id} className="mk-fila" style={{
          display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0',
          borderBottom: '1px solid var(--border)',
        }}>
          <Badge tono={destacar === 'costo' ? 'good' : 'info'}>
            {destacar === 'costo' ? n0(x.costo_por_agenda) : `${x.agendas} ag`}
          </Badge>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {x.nombre}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap' }}>
            {destacar === 'costo' ? `${x.agendas} ag` : `${n0(x.costo_por_agenda)}/ag`} · {x.dias_al_aire}d
          </span>
        </div>
      ))}
    </div>
  );
}
