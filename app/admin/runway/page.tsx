// =============================================================================
// /admin/runway — la foto del lanzamiento al 03/10: plata, plazos y lo que queda
// =============================================================================
// Pedido de Martín: «dame el panorama completo… muy gráfico», y después «dame el
// link dentro de MaKo». El mismo contenido que docs/panorama-03oct.md, pero
// dibujado: lo que un documento no puede mostrar es que **la plata se termina en
// el día 58 de 73 y la venta recién arranca en el día 29**, que es el hallazgo.
//
// ⚠️ SIN UN BYTE DE JAVASCRIPT EN EL NAVEGADOR, como /admin/docs: todo se arma en
// el server y una foto no necesita hidratarse.
//
// ⚠️ PERO NO TODO ES ESTÁTICO, y la diferencia importa. Lo que salió de una
// grabación —la plata, el show up, la ventana de venta, el veredicto de cada
// tarea— vive en `datos.ts`, porque no está en ninguna tabla y derivarlo sería
// inventarlo. Lo que el producto ya sabe se LEE en cada carga: el título y la
// prioridad de cada tarea salen del tablero, y los días que faltan, del reloj.
// Escribir eso a mano es la forma de que la pantalla empiece a mentir sola.
//
// ⚠️ Y LOS COLORES SALEN DE LOS TOKENS DE LA CASA, nunca literales: esta
// pantalla se ve en claro y en oscuro como cualquier otra, sin un tema propio.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { Pagina, PageHeader } from '@/app/_ui';
import {
  MEDIDO, DESDE, HASTA, HITOS, CIFRAS, ESCALONES, CUENTA,
  CRM_VEREDICTOS, CRM_NUEVA, CRM_DECISIONES, VEREDICTO_LABEL,
  CHATBOT_MEDIDO, CHATBOT_TAREAS, CHATBOT_EN_PRODUCCION, CHATBOT_TE_TOCA,
  CS_MEDIDO, CS_TAREAS, CS_EN_PRODUCCION, CS_TE_TOCA,
  ONB_MEDIDO, ONB_VEREDICTOS, ONB_ELIMINADAS, ONB_TE_TOCA,
  DASH_MEDIDO, DASH_VEREDICTOS, DASH_TE_TOCA, textoPlazo,
  type Veredicto, type EstadoChatbot, type TareaApartado, type Pendiente,
} from './datos';
// El chip de prioridad es EL MISMO del tablero: la banda y el color salen de
// `board/types`, no de una copia. Si mañana «alta» deja de ser 75, esta pantalla
// se entera sola.
import { prioFromScore, PCOLOR } from '@/app/plan/board/types';
// Las tareas salen del tablero, ABIERTAS Y CERRADAS: una terminada tiene que poder
// verse marcada, y el lector de /admin/dev las filtra en la consulta.
import { wsDelBoard } from '@/app/admin/dev/roadmap';
// «Hoy» sale del MISMO lugar que en Strategy: las dos pantallas cuentan contra el mismo reloj.
import { hoyAR, faltan } from '@/app/admin/estrategia/datos';
import { tareasDelCrm, tareasDelProyecto, PROYECTO_CHATBOT, PROYECTO_CS, PROYECTO_ONBOARDING, PROYECTO_DASHBOARD, type TareaCrm } from './tareas';

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

/** El chip de la decisión. Tres valores y nada más: no hay un cuarto estado. */
const TONO: Record<Veredicto, { fg: string; bg: string }> = {
  queda: { fg: 'var(--bad)', bg: 'color-mix(in srgb, var(--bad) 11%, transparent)' },
  pospone: { fg: 'var(--dim)', bg: 'var(--surface-2)' },
  va: { fg: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 11%, transparent)' },
};

function Chip({ t, fg, bg }: { t: string; fg: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-block', whiteSpace: 'nowrap', padding: '3px 10px', borderRadius: 999,
      fontSize: 12.5, fontWeight: 700, color: fg, background: bg,
    }}>{t}</span>
  );
}

/**
 * `etiquetas` pisa el rótulo de un veredicto para UNA tabla: en el CRM `va` fue «se funde»
 * (eran duplicadas), en el Onboarding es «se va» (ya no queda nada que hacer). El tono y
 * el significado del chip son los mismos; cambia la palabra.
 */
function Decision({ v, hecha, etiquetas }: { v: Veredicto | null; hecha?: boolean; etiquetas?: Partial<Record<Veredicto, string>> }) {
  // ⚠️ «Hecha» gana sobre el veredicto, y no lo reemplaza en los datos: el veredicto
  // dice qué se decidió el 03/10 y esto dice qué pasó después. Pintar «Se queda» sobre
  // algo que ya se entregó manda a trabajar dos veces.
  if (hecha) return <Chip t="✓ Hecha" fg="#fff" bg="var(--good)" />;
  if (!v) return <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>sin revisar</span>;
  const t = TONO[v];
  return <Chip t={etiquetas?.[v] ?? VEREDICTO_LABEL[v]} fg={t.fg} bg={t.bg} />;
}

type FilaVeredicto = {
  num: number; titulo: string; score: number; hecha: boolean;
  que: Veredicto | null; motivo: string; hecho?: string;
};
/** Una fila que NO está en el tablero (la que no se creó, la que se borró): va al pie. */
type FilaExtra = { clave: string; marca: React.ReactNode; titulo: string; decision: React.ReactNode; motivo: string };
type Tramo = { k: string; n: number; bg: string; ink: string };

/**
 * La tabla de una depuración: el reparto arriba y una fila por tarea con su veredicto.
 * Nació para el CRM (03/10) y la reusa el Onboarding (10/10): una sola pieza, para que las
 * dos se lean igual y la regla de «Hecha gana» viva en un lugar.
 */
function TablaVeredictos({ reparto, filas, extras = [], etiquetas }: {
  reparto: Tramo[]; filas: FilaVeredicto[]; extras?: FilaExtra[]; etiquetas?: Partial<Record<Veredicto, string>>;
}) {
  const celda: React.CSSProperties = { padding: '11px 14px', borderTop: '1px solid var(--border)' };
  const pie: React.CSSProperties = { padding: '11px 14px', borderTop: '1px solid var(--border-strong)' };
  return (
    <>
      <div style={caja}>
        <div style={{ display: 'flex', height: 30, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
          {reparto.map((r) => (
            <div key={r.k} style={{
              flex: Math.max(r.n, 1), background: r.bg, color: r.ink, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 13, fontWeight: 700, minWidth: 0, fontVariantNumeric: 'tabular-nums',
            }}>{r.n}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 11, fontSize: 13, color: 'var(--dim)' }}>
          {reparto.map((r) => (
            <span key={r.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span aria-hidden style={{ width: 12, height: 12, borderRadius: 4, background: r.bg, display: 'inline-block' }} />
              <strong style={{ color: 'var(--ink)' }}>{r.n}</strong> {r.k}
            </span>
          ))}
        </div>
      </div>

      <div style={{ ...caja, padding: 0, overflow: 'hidden', marginTop: 14 }}>
        <div className="mk-scroll-x" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 760 }}>
            <thead>
              <tr>
                {[
                  { t: 'Tarea', w: '36%' }, { t: 'Prioridad', w: '1%' },
                  { t: 'Qué hacemos', w: '1%' }, { t: 'Por qué', w: '' },
                ].map((c) => (
                  <th key={c.t} style={{
                    ...rotulo, textAlign: 'left', padding: '11px 14px', fontWeight: 600,
                    borderBottom: '1px solid var(--border)', width: c.w || undefined, whiteSpace: 'nowrap',
                  }}>{c.t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.num} style={f.hecha ? { color: 'var(--dim)' } : undefined}>
                  <td style={{ ...celda, lineHeight: 1.4 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>#{f.num}</span>{' '}
                    {f.titulo}
                  </td>
                  <td style={celda}>
                    <span style={{
                      display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums', color: PCOLOR[prioFromScore(f.score)],
                      border: `1px solid ${PCOLOR[prioFromScore(f.score)]}`,
                      background: `color-mix(in srgb, ${PCOLOR[prioFromScore(f.score)]} 10%, transparent)`,
                    }}>{f.score}</span>
                  </td>
                  <td style={celda}>
                    <Decision v={f.que} hecha={f.hecha} etiquetas={etiquetas} />
                  </td>
                  <td style={{ ...celda, color: 'var(--dim)', lineHeight: 1.4 }}>
                    {/* Cerrada: el porque de la decision ya es historia, y el de una
                        pospuesta se contradice con el «Hecha» de al lado. */}
                    {(f.hecha && f.hecho) || f.motivo}
                  </td>
                </tr>
              ))}
              {extras.map((x) => (
                <tr key={x.clave}>
                  <td style={{ ...pie, lineHeight: 1.4 }}>{x.marca}{' '}{x.titulo}</td>
                  <td style={{ ...pie, color: 'var(--faint)' }}>—</td>
                  <td style={pie}>{x.decision}</td>
                  <td style={{ ...pie, color: 'var(--dim)', lineHeight: 1.4 }}>{x.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/** Lo que le toca a Martín: una lista, y el link al lado cuando hay adónde ir. */
function ListaPendientes({ items }: { items: Pendiente[] }) {
  return (
    <div style={caja}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {items.map((x) => (
          <li key={x.t} style={{ position: 'relative', paddingLeft: 17, fontSize: 14, lineHeight: 1.5 }}>
            <span aria-hidden style={{
              position: 'absolute', left: 0, top: 8, width: 6, height: 6, borderRadius: '50%', background: 'var(--faint)',
            }} />
            <Marcado t={x.t} />
            {/* Un `<a>` y no el Link de la casa: esta pantalla no manda JavaScript, y el
                `?ws=` ya viaja escrito en el destino. */}
            {x.href && (
              <a href={x.href} style={{
                marginLeft: 10, whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: 'var(--primary)',
              }}>{x.boton ?? 'Abrir'} →</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * El estado de una tarjeta del Chatbot. «Cerrada» sale del TABLERO y gana: el resto es lo
 * que dice `datos.ts`, que es lo que se hizo el 06/10 — no si la tarjeta ya se cerró.
 */
const TONO_BOT: Record<EstadoChatbot | 'cerrada', { t: string; fg: string; bg: string }> = {
  cerrada: { t: '✓ Cerrada', fg: '#fff', bg: 'var(--good)' },
  lista: { t: 'Lista para cerrar', fg: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 11%, transparent)' },
  falta: { t: 'Falta algo', fg: 'var(--bad)', bg: 'color-mix(in srgb, var(--bad) 11%, transparent)' },
};

function EstadoBot({ e }: { e: EstadoChatbot | 'cerrada' | null }) {
  if (!e) return <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>sin revisar</span>;
  const t = TONO_BOT[e];
  return (
    <span style={{
      display: 'inline-block', whiteSpace: 'nowrap', padding: '3px 10px', borderRadius: 999,
      fontSize: 12.5, fontWeight: 700, color: t.fg, background: t.bg,
    }}>{t.t}</span>
  );
}

type FilaApartado = {
  num: number; titulo: string; score: number;
  estado: EstadoChatbot | 'cerrada' | null; hizo: string; falta: string;
};

/**
 * Las filas de un apartado: las tarjetas del proyecto, cruzadas con lo que se hizo de cada una.
 * «Cerrada» sale del `progress` de la tarjeta y GANA sobre lo que diga `datos.ts`.
 */
function filasDeApartado(tareas: TareaCrm[], datos: Record<number, TareaApartado>): FilaApartado[] {
  return tareas
    .filter((t) => datos[t.num] || t.progreso < 100)
    .map((t) => {
      const d = datos[t.num];
      const estado: FilaApartado['estado'] = t.progreso >= 100 ? 'cerrada' : d?.estado ?? null;
      return { num: t.num, titulo: t.titulo, score: t.score, estado, hizo: d?.hizo ?? '', falta: d?.falta ?? '' };
    });
}

/**
 * El apartado de un proyecto trabajado: el reparto, la tabla de tarjetas, lo que quedó en
 * producción y lo que le toca a Martín. Nació para el Chatbot (06/10) y lo reusa Customer
 * Success (07/10): una sola pieza, para que los dos se lean igual.
 */
function Apartado({ id, titulo, filas, enProduccion, teToca, deQuien }: {
  id: string; titulo: string; filas: FilaApartado[];
  enProduccion: string[]; teToca: Pendiente[]; deQuien: string;
}) {
  const reparto = [
    { k: 'cerradas', n: filas.filter((f) => f.estado === 'cerrada').length, bg: 'var(--good)', ink: '#fff' },
    { k: 'listas para cerrar', n: filas.filter((f) => f.estado === 'lista').length, bg: 'var(--primary)', ink: '#fff' },
    { k: 'con algo pendiente', n: filas.filter((f) => f.estado === 'falta').length, bg: 'var(--bad)', ink: '#fff' },
    { k: 'sin revisar', n: filas.filter((f) => f.estado === null).length, bg: 'var(--surface-2)', ink: 'var(--ink)' },
  ].filter((r) => r.n > 0);
  return (
    <>
      <h2 id={id} style={{ ...h2, margin: '56px 0 14px' }}>{titulo}</h2>
      <div style={caja}>
        <div style={{ display: 'flex', height: 30, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
          {reparto.map((r) => (
            <div key={r.k} style={{
              flex: r.n, background: r.bg, color: r.ink, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 13, fontWeight: 700, minWidth: 0, fontVariantNumeric: 'tabular-nums',
            }}>{r.n}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 11, fontSize: 13, color: 'var(--dim)' }}>
          {reparto.map((r) => (
            <span key={r.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span aria-hidden style={{ width: 12, height: 12, borderRadius: 4, background: r.bg, display: 'inline-block' }} />
              <strong style={{ color: 'var(--ink)' }}>{r.n}</strong> {r.k}
            </span>
          ))}
        </div>
      </div>

      <div style={{ ...caja, padding: 0, overflow: 'hidden', marginTop: 14 }}>
        <div className="mk-scroll-x" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 860 }}>
            <thead>
              <tr>
                {[
                  { t: 'Tarea', w: '30%' }, { t: 'Prioridad', w: '1%' }, { t: 'Estado', w: '1%' },
                  { t: 'Qué se hizo', w: '' }, { t: 'Qué falta', w: '20%' },
                ].map((c) => (
                  <th key={c.t} style={{
                    ...rotulo, textAlign: 'left', padding: '11px 14px', fontWeight: 600,
                    borderBottom: '1px solid var(--border)', width: c.w || undefined, whiteSpace: 'nowrap',
                  }}>{c.t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.num} style={f.estado === 'cerrada' ? { color: 'var(--dim)' } : undefined}>
                  <td style={{ padding: '11px 14px', borderTop: '1px solid var(--border)', lineHeight: 1.4 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>#{f.num}</span>{' '}
                    {f.titulo}
                  </td>
                  <td style={{ padding: '11px 14px', borderTop: '1px solid var(--border)' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums', color: PCOLOR[prioFromScore(f.score)],
                      border: `1px solid ${PCOLOR[prioFromScore(f.score)]}`,
                      background: `color-mix(in srgb, ${PCOLOR[prioFromScore(f.score)]} 10%, transparent)`,
                    }}>{f.score}</span>
                  </td>
                  <td style={{ padding: '11px 14px', borderTop: '1px solid var(--border)' }}>
                    <EstadoBot e={f.estado} />
                  </td>
                  <td style={{ padding: '11px 14px', borderTop: '1px solid var(--border)', lineHeight: 1.4 }}>
                    {f.hizo || <span style={{ color: 'var(--faint)' }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px', borderTop: '1px solid var(--border)', color: 'var(--dim)', lineHeight: 1.4 }}>
                    {/* Cerrada: lo que faltaba ya no es trabajo pendiente. */}
                    {f.estado === 'cerrada' ? '' : f.falta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 style={h2}>Lo que quedó en producción</h2>
      <div style={caja}><Lista items={enProduccion} /></div>

      <h2 style={h2}>Lo que te toca {deQuien}</h2>
      <ListaPendientes items={teToca} />
    </>
  );
}

export default async function RunwayPage() {
  // El mismo guard que /admin/docs: es el rol de AGENCIA, no `rol_ws` —que vale
  // 'admin' para el dueño de CADA workspace y abriría esto a todos los clientes.
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  // ⚠️ «Hoy» se calcula ACÁ, no a nivel módulo, y en hora de Buenos Aires. A nivel
  // módulo, `force-dynamic` vuelve a correr la función pero no el módulo: una
  // instancia caliente se quedaba con la fecha de su primera carga. Y con
  // `toISOString()` la fecha era la UTC, que después de las 21 h de acá ya es mañana.
  const hoy = hoyAR();

  // ⚠️ El título y la PRIORIDAD salen del tablero en cada carga, no de `datos.ts`:
  // el Perro recurva los scores todos los días, así que un número escrito acá
  // estaría viejo mañana. Lo único propio de esta pantalla es el veredicto.
  //
  // Una tarea sin veredicto se dibuja igual, marcada «sin revisar»: entró después
  // de la depuración, y esconderla sería mentir sobre cuántas hay.
  // ⚠️ `roadmapDe` y NO `tareasDelCamino`: la segunda arranca con un
  // `if (!TITULOS_PROPIOS[slug]) return []` y hoy esa tabla sólo tiene
  // customer-success, así que para cualquier otra área devuelve vacío SIN MIRAR
  // sus proyectos — un cero perfectamente válido sobre la pregunta equivocada.
  const SIN_REVISAR: { que: Veredicto | null; motivo: string } = { que: null, motivo: 'Entró después de la depuración' };
  // ⚠️ «HECHA» NO SE ESCRIBE EN `datos.ts`: SALE DEL TABLERO. Lo que está terminado lo
  // dice `progress`, que es el mismo número que mueve la tarjeta en /plan — así que
  // reabrir una allá se ve acá sin que nadie toque este archivo. Una lista de hechas
  // escrita a mano empieza a mentir el día que alguien cierra la décima.
  const FILAS = (await tareasDelCrm(wsDelBoard(admin.ws)))
    // ⚠️ El proyecto tiene tareas cerradas de antes de la depuración y no son de esta
    // foto: traerlas llenaría la tabla de trabajo viejo que nadie decidió acá. Entran
    // las 25 que la depuración revisó —estén abiertas o ya cerradas— y las que se hayan
    // abierto después, que salen marcadas «sin revisar» en vez de esconderse.
    .filter((t) => CRM_VEREDICTOS[t.num] || t.progreso < 100)
    .map((t) => ({
    num: t.num,
    titulo: t.titulo,
    score: t.score,
    hecha: t.progreso >= 100,
    ...(CRM_VEREDICTOS[t.num] ?? SIN_REVISAR),
  }));
  const cuenta = (v: Veredicto) => FILAS.filter((f) => !f.hecha && f.que === v).length;
  const REPARTO = [
    // La tarjeta nueva del pie no existe en el tablero, así que suma a mano — del lado
    // que le corresponda hoy, no del que le correspondía cuando se escribió.
    { k: 'terminadas', n: FILAS.filter((f) => f.hecha).length + (CRM_NUEVA.hecha ? 1 : 0), bg: 'var(--good)', ink: '#fff' },
    { k: 'se quedan', n: cuenta('queda') + (CRM_NUEVA.hecha ? 0 : 1), bg: 'var(--bad)', ink: '#fff' },
    { k: 'se posponen', n: cuenta('pospone'), bg: 'var(--surface-2)', ink: 'var(--ink)' },
    { k: 'se funden en otra', n: cuenta('va'), bg: 'var(--primary)', ink: '#fff' },
  ];

  // ── El Chatbot (06/10) y Customer Success (07/10): el mismo reparto que el CRM ──
  // El título, la prioridad y si está cerrada salen del tablero; lo que se hizo, de
  // `datos.ts`. Entran las tarjetas que se trabajaron y las abiertas que aparezcan
  // después (marcadas «sin revisar»): las cerradas de antes no son de esta foto.
  const [tareasBot, tareasCs, tareasOnb, tareasDash] = await Promise.all([
    tareasDelProyecto(wsDelBoard(admin.ws), PROYECTO_CHATBOT),
    tareasDelProyecto(wsDelBoard(admin.ws), PROYECTO_CS),
    tareasDelProyecto(wsDelBoard(admin.ws), PROYECTO_ONBOARDING),
    tareasDelProyecto(wsDelBoard(admin.ws), PROYECTO_DASHBOARD),
  ]);
  const BOT = filasDeApartado(tareasBot, CHATBOT_TAREAS);
  const CS = filasDeApartado(tareasCs, CS_TAREAS);

  // ── El Onboarding (10/10): el mismo reparto que el CRM ──
  // Entran las que la depuración juzgó —abiertas o ya cerradas— y las abiertas que
  // aparezcan después, marcadas «sin revisar». Las cerradas de antes no son de esta foto.
  const ONB: FilaVeredicto[] = tareasOnb
    .filter((t) => ONB_VEREDICTOS[t.num] || t.progreso < 100)
    .map((t) => ({
      num: t.num, titulo: t.titulo, score: t.score, hecha: t.progreso >= 100,
      ...(ONB_VEREDICTOS[t.num] ?? { que: null, motivo: 'Entró después de la depuración' }),
    }));
  const cuentaOnb = (v: Veredicto) => ONB.filter((f) => !f.hecha && f.que === v).length;
  const REPARTO_ONB: Tramo[] = [
    { k: 'cerradas', n: ONB.filter((f) => f.hecha).length, bg: 'var(--good)', ink: '#fff' },
    { k: 'se quedan', n: cuentaOnb('queda'), bg: 'var(--bad)', ink: '#fff' },
    { k: 'se posponen', n: cuentaOnb('pospone'), bg: 'var(--surface-2)', ink: 'var(--ink)' },
    // Una «se va» que alguien reabrió en el tablero vuelve a contar acá, no como cerrada.
    { k: 'se van', n: cuentaOnb('va'), bg: 'var(--primary)', ink: '#fff' },
    { k: ONB_ELIMINADAS.length === 1 ? 'borrada' : 'borradas', n: ONB_ELIMINADAS.length, bg: 'var(--border-strong)', ink: 'var(--ink)' },
    { k: 'sin revisar', n: ONB.filter((f) => !f.hecha && f.que === null).length, bg: 'var(--border)', ink: 'var(--ink)' },
  ].filter((r) => r.n > 0);

  // ── El Dashboard (11/10): el mismo reparto que el Onboarding ──
  const DASH: FilaVeredicto[] = tareasDash
    .filter((t) => DASH_VEREDICTOS[t.num] || t.progreso < 100)
    .map((t) => ({
      num: t.num, titulo: t.titulo, score: t.score, hecha: t.progreso >= 100,
      ...(DASH_VEREDICTOS[t.num] ?? { que: null, motivo: 'Entró después de la depuración' }),
    }));
  const cuentaDash = (v: Veredicto) => DASH.filter((f) => !f.hecha && f.que === v).length;
  const REPARTO_DASH: Tramo[] = [
    { k: 'cerradas', n: DASH.filter((f) => f.hecha).length, bg: 'var(--good)', ink: '#fff' },
    { k: 'se quedan', n: cuentaDash('queda'), bg: 'var(--bad)', ink: '#fff' },
    { k: 'se posponen', n: cuentaDash('pospone'), bg: 'var(--surface-2)', ink: 'var(--ink)' },
    { k: 'se van', n: cuentaDash('va'), bg: 'var(--primary)', ink: '#fff' },
    { k: 'sin revisar', n: DASH.filter((f) => !f.hecha && f.que === null).length, bg: 'var(--border)', ink: 'var(--ink)' },
  ].filter((r) => r.n > 0);

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
            }}>{c.faltanHasta ? textoPlazo(faltan(c.faltanHasta, hoy)) : c.valor}</p>
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
            {/* Dónde estamos parados. Sin esto, un riel de 73 días no dice si
                faltan dos meses o si la plata se termina la semana que viene. */}
            {pct(hoy) >= 0 && pct(hoy) <= 100 && (
              <div style={{ position: 'absolute', top: 44, bottom: 24, width: 2, left: pos(hoy), background: 'var(--primary)' }}>
                <span style={{
                  position: 'absolute', top: -17, left: 0, transform: anclaje(pct(hoy)), whiteSpace: 'nowrap',
                  fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                  color: 'var(--primary)', background: 'var(--surface)', padding: '0 5px',
                }}>HOY</span>
              </div>
            )}
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

      {/* ── la depuración del CRM: UNA tabla, como la del tablero ── */}
      <h2 style={h2}>El CRM · qué se hace con cada tarea</h2>
      <TablaVeredictos reparto={REPARTO} filas={FILAS} extras={[{
        // La que no existe todavía: sin número, y por eso al pie.
        clave: 'crm-nueva',
        marca: <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--bad)', fontWeight: 700 }}>NUEVA</span>,
        titulo: CRM_NUEVA.titulo,
        decision: <Decision v="queda" hecha={CRM_NUEVA.hecha} />,
        motivo: CRM_NUEVA.motivo,
      }]} />
      <p style={{ margin: '14px 0 0', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55 }}>
        Lo que se pospone <strong>no se descarta</strong>: queda con su motivo escrito. Mezclar las dos
        cosas es como vuelve el trabajo que se sacó. La prioridad sale del tablero al abrir esta pantalla.
      </p>

      {/* ── lo que decide Martín ── */}
      <h2 style={h2}>Lo que tienes que decidir</h2>
      <div style={caja}><Lista items={CRM_DECISIONES} /></div>

      {/* ── el Chatbot: lo que se hizo el 06/10 ── */}
      <Apartado id="chatbot" titulo={`El Chatbot · lo que se hizo el ${CHATBOT_MEDIDO}`} filas={BOT}
        enProduccion={CHATBOT_EN_PRODUCCION} teToca={CHATBOT_TE_TOCA} deQuien="del Chatbot" />

      {/* ── Customer Success: el cierre del proyecto, 06-07/10 ── */}
      <Apartado id="customer-success" titulo={`Customer Success · lo que se hizo el ${CS_MEDIDO}`} filas={CS}
        enProduccion={CS_EN_PRODUCCION} teToca={CS_TE_TOCA} deQuien="de Customer Success" />

      {/* ── el Onboarding: la depuración del proyecto, 10/10 ── */}
      <h2 id="onboarding" style={{ ...h2, margin: '56px 0 14px' }}>El Onboarding · qué se hace con cada tarea, al {ONB_MEDIDO}</h2>
      <TablaVeredictos reparto={REPARTO_ONB} filas={ONB} etiquetas={{ va: 'Se va' }}
        extras={ONB_ELIMINADAS.map((e) => ({
          clave: `onb-${e.num}`,
          marca: <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>#{e.num}</span>,
          titulo: e.titulo,
          decision: <Chip t="Borrada" fg="var(--dim)" bg="var(--surface-2)" />,
          motivo: e.motivo,
        }))} />
      <h2 style={h2}>Lo que te toca del Onboarding</h2>
      <ListaPendientes items={ONB_TE_TOCA} />

      {/* ── el Dashboard: la depuración del proyecto, 11/10 ── */}
      <h2 id="dashboard" style={{ ...h2, margin: '56px 0 14px' }}>El Dashboard · qué se hace con cada tarea, al {DASH_MEDIDO}</h2>
      <TablaVeredictos reparto={REPARTO_DASH} filas={DASH} etiquetas={{ va: 'Se va' }} />
      <h2 style={h2}>Lo que te toca del Dashboard</h2>
      <ListaPendientes items={DASH_TE_TOCA} />

    </Pagina>
  );
}
