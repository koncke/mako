// =============================================================================
// /admin/runway — la foto del lanzamiento al 03/10: plata, plazos y lo que queda
// =============================================================================
// Pedido de Martín: «dame el panorama completo… muy gráfico», y después «dame el
// link dentro de MaKo». El mismo contenido que docs/panorama-03oct.md, pero
// dibujado: lo que un documento no puede mostrar es que **la plata se termina en
// el día 58 de 73 y la venta recién arranca en el día 29**, que es el hallazgo.
//
// ⚠️ SIN UN BYTE DE JAVASCRIPT PROPIO, como /admin/docs. Todo es estático: los
// datos viven en `datos.ts` y las posiciones del riel se calculan en el server.
// Una foto no necesita hidratarse.
//
// ⚠️ Y LOS COLORES SALEN DE LOS TOKENS DE LA CASA, nunca literales: esta
// pantalla se ve en claro y en oscuro como cualquier otra, sin un tema propio.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { Pagina, PageHeader } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import {
  MEDIDO, DESDE, HASTA, HITOS, CIFRAS, ESCALONES, CUENTA,
  RIESGOS_MECANISMO, RIESGOS_SUPUESTOS, ROTO_HOY, CRM, CONTRADICCIONES,
} from './datos';

export const dynamic = 'force-dynamic';

const MONO = 'var(--mono, ui-monospace, monospace)';

/** Dónde cae una fecha dentro del riel, en %. Es la única cuenta de la pantalla. */
const dia = (f: string) => Math.round(Date.parse(f) / 86400000);
const LARGO = dia(HASTA) - dia(DESDE);
const pct = (f: string) => ((dia(f) - dia(DESDE)) / LARGO) * 100;
const pos = (f: string) => `${pct(f)}%`;
// ⚠️ Un rótulo centrado sobre su marca se SALE por el extremo del riel, y ahí lo
// corta el scroller: la fecha más importante —el 15 DIC, cuando dejan de comprar—
// quedaba pidiendo que alguien scrollee de costado para leerla. Los extremos se
// anclan a su borde; sólo el medio se centra.
const anclaje = (p: number) => (p < 8 ? 'translateX(0)' : p > 92 ? 'translateX(-100%)' : 'translateX(-50%)');

/**
 * El **negrita** de los textos de `datos.ts`.
 *
 * ⚠️ Se parte por el separador y se alternan los tramos, en vez de meter HTML
 * con `dangerouslySetInnerHTML`: el texto de ese archivo lo escribe una persona
 * y no tiene por qué poder inyectar marcado en esta pantalla.
 */
function Marcado({ t }: { t: string }) {
  return <>{t.split('**').map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))}</>;
}

const caja: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, minWidth: 0,
};
const rotulo: React.CSSProperties = {
  fontFamily: MONO, fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--faint)',
};
const h2: React.CSSProperties = { ...rotulo, fontSize: 12.5, fontWeight: 600, margin: '40px 0 14px' };

function Lista({ items, malo }: { items: string[]; malo?: boolean }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
      {items.map((t) => (
        <li key={t} style={{ position: 'relative', paddingLeft: 17, fontSize: 14, lineHeight: 1.5 }}>
          <span aria-hidden style={{
            position: 'absolute', left: 0, top: 8, width: 6, height: 6, borderRadius: '50%',
            background: malo ? 'var(--bad)' : 'var(--faint)',
          }} />
          <Marcado t={t} />
        </li>
      ))}
    </ul>
  );
}

export default async function RunwayPage() {
  // El mismo guard que /admin/docs: es el rol de AGENCIA, no `rol_ws` —que vale
  // 'admin' para el dueño de CADA workspace y abriría esto a todos los clientes.
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  return (
    <Pagina ancho="completo">
      <PageHeader
        titulo="Runway"
        proposito={`La foto del lanzamiento al ${MEDIDO}: la plata que queda, los plazos y lo que se sacó.`}
      />

      {/* ── los tres números ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {CIFRAS.map((c) => (
          <div key={c.clave} style={{
            ...caja,
            borderColor: c.urge ? 'var(--bad)' : 'var(--border)',
            boxShadow: c.urge ? 'inset 3px 0 0 var(--bad)' : undefined,
          }}>
            <p style={{ ...rotulo, margin: '0 0 6px' }}>{c.clave}</p>
            <p style={{
              margin: 0, fontSize: 'clamp(30px, 5vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em',
              lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: c.urge ? 'var(--bad)' : 'var(--ink)',
            }}>{c.valor}</p>
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.45 }}>
              <Marcado t={c.detalle} />
            </p>
          </div>
        ))}
      </div>

      {/* ── el riel de 73 días ── */}
      <h2 style={h2}>Los {LARGO} días que quedan</h2>
      <div style={caja}>
        {/* ⚠️ El scroll lateral va en ESTE contenedor y no en la página: un riel
            proporcional no puede encogerse sin que las marcas se pisen. */}
        <div className="mk-scroll-x" style={{ overflowX: 'auto' }}>
          <div style={{ position: 'relative', height: 160, minWidth: 820 }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 60, height: 10, borderRadius: 5, background: 'var(--surface-2)' }} />
            {/* la plata: del día 0 al 58 */}
            <div style={{
              position: 'absolute', left: 0, top: 60, height: 10, borderRadius: '5px 0 0 5px',
              width: pos('2026-11-30'),
              background: 'linear-gradient(90deg, var(--good), var(--warn-fill) 60%, var(--bad))',
            }} />
            {/* la ventana de venta: del día 29 al final */}
            <div style={{
              position: 'absolute', top: 84, height: 10, borderRadius: 5, left: pos('2026-11-01'), right: 0,
              background: 'var(--primary)', opacity: 0.85,
            }} />
            {HITOS.map((h, i) => (
              <div key={h.fecha} style={{
                position: 'absolute', top: 0, width: 1, height: 60, left: pos(h.fecha),
                background: h.tono === 'malo' ? 'var(--bad)' : h.peso === 'fuerte' ? 'var(--ink)' : 'var(--border-strong)',
              }}>
                {h.nota && (
                  <span style={{
                    // Dos renglones alternados: con 4 días entre el 14 y el 18, dos notas
                    // en el mismo renglón se tapan — y la de arriba se lee entera igual.
                    position: 'absolute', top: i % 2 ? 21 : 0, left: 0,
                    transform: anclaje(pct(h.fecha)), whiteSpace: 'nowrap',
                    fontSize: 11.5, color: 'var(--dim)', background: 'var(--surface)', padding: '0 5px',
                  }}>{h.nota}</span>
                )}
                <span style={{
                  position: 'absolute', bottom: 0, left: 0, transform: anclaje(pct(h.fecha)), whiteSpace: 'nowrap',
                  fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em',
                  background: 'var(--surface)', padding: '2px 5px', borderRadius: 4,
                  color: h.tono === 'malo' ? 'var(--bad)' : 'var(--ink)',
                }}>{h.rotulo}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14, fontSize: 12.5, color: 'var(--dim)' }}>
          {[
            ['capital disponible', 'linear-gradient(90deg, var(--good), var(--warn-fill) 60%, var(--bad))'],
            ['ventana para vender', 'var(--primary)'],
            ['sin financiar', 'var(--surface-2)'],
          ].map(([t, bg]) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span aria-hidden style={{ width: 16, height: 8, borderRadius: 4, background: bg, display: 'inline-block' }} />
              {t}
            </span>
          ))}
        </div>
      </div>
      <p style={{ margin: '14px 0 0', fontSize: 15, color: 'var(--dim)', maxWidth: '64ch', lineHeight: 1.55 }}>
        La plata se termina en el día 58 de {LARGO} y la venta recién arranca en el día 29.
        Son <strong style={{ color: 'var(--ink)' }}>29 días de venta financiada</strong>, no seis semanas.
      </p>

      {/* ── la poda ── */}
      <h2 style={h2}>La poda · ya la hiciste, está en el audio</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {ESCALONES.map((e) => {
          const fuera = e.estado === 'fuera';
          return (
            <div key={e.et} style={{
              border: `1px ${fuera ? 'dashed' : 'solid'} ${fuera ? 'var(--border)' : 'var(--bad)'}`,
              borderRadius: 10, padding: 13, minWidth: 0, opacity: fuera ? 0.62 : 1,
              boxShadow: fuera ? undefined : 'inset 0 -3px 0 var(--bad)', background: 'var(--surface)',
            }}>
              <p style={{ ...rotulo, margin: 0 }}>{e.et}</p>
              <p style={{
                margin: '5px 0 0', fontSize: 14, fontWeight: 700, lineHeight: 1.35,
                textDecoration: fuera ? 'line-through' : undefined,
              }}>{e.que}</p>
              <p style={{
                margin: '8px 0 0', fontFamily: MONO, fontSize: 12, fontVariantNumeric: 'tabular-nums',
                color: fuera ? 'var(--bad)' : 'var(--dim)',
              }}>{e.cuando}</p>
            </div>
          );
        })}
      </div>
      <div style={{ ...caja, marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>
          Sacaste <strong>seis features</strong> de un golpe. P2 y P4 no se posponen: quedan vacíos, y el
          cierre de todo lo técnico se mueve del 21 al <strong>14 de octubre</strong>.
        </p>
        <p style={{
          margin: 0, fontFamily: MONO, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5,
          borderLeft: '2px solid var(--border)', paddingLeft: 11,
        }}>
          «Lo que tengo que sacar […] es VSL análisis y VSL generator, landing generator y landing
          analysis, y offer análisis y offer generator.»
        </p>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>
          El criterio con el que las sacaste es mejor que el «capricho» de la llamada del 1/10:
          <strong> no tienes los clientes que pidieron esas features</strong>. El roadmap estaba armado
          sobre pedidos que no existen. Lo que esas features hacían ahora lo haces tú: la oferta se
          arma en la llamada con un template, y la landing eres tú dando consejos.
        </p>
      </div>

      {/* ── la cuenta ── */}
      <h2 style={h2}>La cuenta del lanzamiento</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 8 }}>
        {CUENTA.map((p, i) => (p.l ? (
          <div key={i} style={{
            ...caja, padding: '13px 15px', flex: '1 1 120px', borderRadius: 10,
            borderColor: p.fin ? 'var(--good)' : 'var(--border)',
          }}>
            <p style={{
              margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums', color: p.fin ? 'var(--good)' : 'var(--ink)',
            }}>{p.v}</p>
            <p style={{ ...rotulo, fontSize: 10.5, margin: '4px 0 0' }}>{p.l}</p>
          </div>
        ) : (
          <span key={i} aria-hidden style={{ alignSelf: 'center', fontSize: 19, color: 'var(--faint)', fontWeight: 600 }}>{p.v}</span>
        )))}
      </div>
      <div style={{
        marginTop: 14, borderLeft: '3px solid var(--bad)', padding: '12px 15px',
        background: 'var(--surface)', borderRadius: '0 10px 10px 0', fontSize: 14, lineHeight: 1.55,
      }}>
        <strong style={{ color: 'var(--bad)' }}>Los dos números de los que cuelga todo están mal.</strong>{' '}
        Los 2.000 de pauta no existen — son los mismos que te paga Mauricio y se te van en gastos; tus dos
        salidas son vender en prospección «<span style={{ fontFamily: MONO }}>o me endeudo con tarjeta de
        crédito</span>». Y el show up de 50% es un supuesto: <strong>el único medido que tienes es el 33% de
        Mauricio</strong>, y con 33% las 20 agendas dan <strong>menos de 7 llamadas</strong>, no 10.
      </div>

      {/* ── riesgos ── */}
      <h2 style={h2}>Lo que tú mismo dijiste que puede salir mal</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <div style={caja}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.015em' }}>El mecanismo</h3>
          <Lista items={RIESGOS_MECANISMO} malo />
        </div>
        <div style={caja}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.015em' }}>Los supuestos</h3>
          <Lista items={RIESGOS_SUPUESTOS} malo />
        </div>
      </div>

      {/* ── roto hoy ── */}
      <h2 style={h2}>Roto hoy, y en ningún escalón del plan</h2>
      <div style={caja}><Lista items={ROTO_HOY} malo /></div>

      {/* ── el CRM ── */}
      <h2 style={h2}>El CRM · 23 tarjetas abiertas, ninguna terminada</h2>
      <div style={{ ...caja, padding: 0, overflow: 'hidden' }}>
        <div className="mk-scroll-x" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 520 }}>
            <thead>
              <tr>{['Tarjeta', 'Qué falta', 'Cuándo'].map((t) => (
                <th key={t} style={{ ...rotulo, textAlign: 'left', padding: '11px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{t}</th>
              ))}</tr>
            </thead>
            <tbody>
              {CRM.map((f) => (
                <tr key={f.num}>
                  <td style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
                    <strong>#{f.num}</strong> {f.titulo}
                  </td>
                  <td style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', color: 'var(--dim)' }}>{f.falta}</td>
                  <td style={{
                    padding: '10px 14px', borderTop: '1px solid var(--border)', whiteSpace: 'nowrap',
                    fontFamily: MONO, fontSize: 12, fontWeight: f.dentro ? 600 : 400,
                    color: f.dentro ? 'var(--bad)' : 'var(--faint)',
                  }}>{f.cuando}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{
        marginTop: 14, borderLeft: '3px solid var(--warn-fill)', padding: '12px 15px',
        background: 'var(--surface)', borderRadius: '0 10px 10px 0', fontSize: 14, lineHeight: 1.55,
      }}>
        <strong>Y el audio le agrega un requisito que no tenía.</strong> Vas a meterle <strong>tus propios
        +1.000 leads en frío</strong> para prospectar. Eso sube de golpe lo que era secundario: <strong>#626</strong>,
        el dedup por teléfono — hoy los webhooks de Meta, Calendly y Cal.com comparan el número exacto, así
        que «+52 998…» contra «998…» entra como lead nuevo y sin aviso.
      </div>

      {/* ── contradicciones ── */}
      <h2 style={h2}>Las tres contradicciones a resolver</h2>
      <div style={caja}><Lista items={CONTRADICCIONES} /></div>

      <div style={{
        marginTop: 44, paddingTop: 18, borderTop: '1px solid var(--border)',
        fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <p style={{ margin: 0 }}>
          <strong>Una corrección de fuente:</strong> el audio de 60 minutos no es un monólogo. Hay un
          tercero —no es Leila, a ella la citas en tercera persona— y varios de los cortes más duros
          (bajar cuatro días a dos, sacar landing y VSL, prospección antes que landing) los propone él.
          No son conclusiones tuyas: son concesiones.
        </p>
        <p style={{ margin: 0 }}>
          Fuentes: llamada con Leila del 21/09 (2h20, 263 citas) · llamada del 01/10 (1h44, 164 citas) ·
          audio del 03/10 (60 min, 152 citas). Las 579 se verificaron con comparación exacta contra la
          transcripción. El detalle, en{' '}
          <Link href="/admin/docs?d=panorama-03oct" style={{ color: 'var(--primary)' }}>panorama-03oct</Link>.
        </p>
      </div>
    </Pagina>
  );
}
