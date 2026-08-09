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
  ACCIONES, ACCIONES_NUEVAS, AUDIO, AUTOMATICOS, BENCHMARKS, BLOQUEANTES, COMPETENCIA, CUPO_MT,
  DATO_FALSO, ECONOMIA, EL_ACCIDENTE, EL_COSTO_ES_EL_VIDEO, ESCENARIOS, EXPOSICION, IMAGEN,
  MARKUP_MT, MEDICION, MT_POR_USD, PERFILES, PLANES, RERUTEO, RETENCION, RETENCION_FUENTE,
  RIESGO_QUE_QUEDA, RUTEO, SALVEDADES, TARIFA, VIDEO, VIDEO_15S,
  BYOK, COBRO, CUARTO_PLAN, FUERA_DE_GRILLA, GANCHO, GRANDFATHER, GRILLA, HUECOS,
  ORDEN_DE_TRABAJO, PRECIOS, type Bloque, type Celda as CeldaT,
  aMes, costoUnitario, margen, techoIa,
} from './modelo';

type Corte = { clave: string; llamadas: number; tokens: number; costUsd: number };
type Resumen = {
  periodo: string; llamadas: number; tokens: number; costUsd: number; filas: number;
  porFeature: Corte[]; porProveedor: Corte[];
  porWorkspace: Array<Corte & { atribuible: boolean }>;
  mesesDisponibles: string[];
};

// Coma decimal, punto de miles. La pantalla mezclaba «US$0,001» escrito a mano
// con «US$0.30» salido de toFixed, y dos separadores distintos en la misma tabla
// se leen como dos unidades distintas. Un solo formateador para todo.
const usd = (n: number, dec = 2) => `US$${n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
const miles = (n: number) => n.toLocaleString('es-AR');
const num = (n: number, dec = 1) => n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesLabel = (m: string) => { const [y, x] = m.split('-'); return `${MESES[Number(x) - 1] ?? x} ${y}`; };

/** El precio en MT de una operación. Falla ruidoso: un id mal escrito acá pinta
 *  «0 MT» en una cifra del veredicto, que es la forma más cara de equivocarse. */
const mtDeOp = (id: string) => {
  const o = TARIFA.find((t) => t.id === id);
  if (!o) throw new Error(`Pricing: no existe la operación «${id}» en TARIFA`);
  return o.mt;
};

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
/** Una celda de la grilla. El valor SIEMPRE es texto o símbolo, nunca solo color:
 *  un tilde verde y una raya gris se ven igual en escala de grises y para quien
 *  no distingue rojo de verde. */
const Celda = ({ v }: { v: CeldaT }) => {
  if (v === true) return <span style={{ color: 'var(--good)', fontSize: 13 }} title="incluido">✓</span>;
  if (v === false) return <span style={{ color: 'var(--faint)', fontSize: 13 }} title="no incluido">—</span>;
  return <span style={{ fontSize: 11.5, color: 'var(--ink)' }}>{v}</span>;
};
const Nota = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px', maxWidth: '72ch', lineHeight: 1.6 }}>{children}</p>
);
const BloqueTexto = ({ b }: { b: Bloque }) => (
  <div style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
    <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600 }}>{b.titulo}</div>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.6, maxWidth: '76ch' }}>{b.cuerpo}</div>
    {b.fuente && <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>{b.fuente}</div>}
  </div>
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

  // ── Gráfico 3: con el producto completo, el costo es el video ────────────
  // Se grafica el TOTAL por plan y la parte de medios va en la `nota`, no en un
  // segundo color: son dos magnitudes de la misma serie (dinero por plan), y
  // partirlas en dos series pintaría un apilado de dos colores para comparar
  // tres barras — más ruido que dato. El número igual está en texto.
  const GROWTH_P = PERFILES.find((p) => p.plan === 'growth')!;
  const barrasPlanes: Barra[] = PERFILES.map((p) => ({
    id: p.plan,
    label: PLANES.find((x) => x.id === p.plan)?.label ?? p.plan,
    nota: p.mediosUsd > 0 ? `${usd(p.mediosUsd)} son medios` : 'sin medios',
    valor: p.iaUsd,
    texto: usd(p.iaUsd),
    destacada: p.plan === 'growth',
  }));
  const pctMedios = (GROWTH_P.mediosUsd / GROWTH_P.iaUsd) * 100;

  // ── La tarifa ────────────────────────────────────────────────────────────
  // Se grafica una MUESTRA de 12, no las 40: el gráfico existe para que se vea
  // la escala, y cuarenta filas de barras no es un gráfico, es la tabla otra vez.
  // La tabla completa vive plegada, abajo.
  const MUESTRA = ['mako-msg', 'stt', 'lead-360', 'reunion', 'closing', 'archivero', 'campana',
    'roleplay', 'imagen', 'carrusel', 'retro', 'clip8', 'reel'];
  const barrasTarifa: Barra[] = MUESTRA
    .map((id) => TARIFA.find((t) => t.id === id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o))
    .sort((a, b) => a.mt - b.mt)
    .map((o) => ({
      id: o.id,
      label: o.label,
      nota: o.origen === 'medido' ? `medido · n=${o.n}` : o.origen,
      valor: o.mt,
      texto: miles(o.mt),
      // El Reel es el que ordena la conversación: es el techo de la escala.
      destacada: o.id === 'reel',
    }));

  return (
    <>
      {/* ── DE QUÉ SE TRATA ───────────────────────────────────────────────── */}
      {/* Esto NO estaba y era el problema #1: la pantalla abría con «US$27,40» y
          el lector tenía que adivinar de qué. Un veredicto sin la pregunta que
          contesta no es un veredicto, es un número suelto. */}
      <Section titulo="Qué contesta esta pantalla" card>
        <p style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.65, margin: 0, maxWidth: '76ch' }}>
          Si MaKo le va a poner la IA a sus clientes en vez de que cada uno traiga su key,{' '}
          <strong>cada cosa que hace el producto pasa a costar plata de la agencia</strong>. Esta
          pantalla contesta cuatro preguntas, en este orden:
        </p>
        <ol style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, margin: '12px 0 0', paddingLeft: 20, maxWidth: '76ch' }}>
          <li><strong style={{ color: 'var(--ink)' }}>¿Cuánto cuesta?</strong> — medido en producción, y proyectado con el producto entero construido.</li>
          <li><strong style={{ color: 'var(--ink)' }}>¿Cuánto se le cobra?</strong> — la tarifa de MaKo Tokens, operación por operación.</li>
          <li><strong style={{ color: 'var(--ink)' }}>¿Cuánto cuesta conseguir un cliente?</strong> — el CAC de cada funnel, contra el techo que tolera cada plan.</li>
          <li><strong style={{ color: 'var(--ink)' }}>¿Cómo se empaqueta?</strong> — los planes, y qué falta para poder cobrarlos.</li>
        </ol>
        <Fuente>
          Todo lo <strong>medido</strong> sale de {miles(MEDICION.llamadas)} llamadas reales de{' '}
          <span style={{ fontFamily: MONO }}>anthropic_usage</span> ({MEDICION.dias} días,{' '}
          {MEDICION.workspaces} workspaces). Lo <strong>publicado</strong> es precio de lista con su
          fecha. Lo <strong>supuesto</strong> lo pusimos nosotros y está marcado como tal en cada tabla.
        </Fuente>
      </Section>

      {/* ── EL VEREDICTO ──────────────────────────────────────────────────── */}
      <Section titulo="El veredicto, en tres números" card>
        {/* 195px y no 230: a 230 las tres tarjetas no entran en el ancho de la
            card y se parten 2+1, que deja un hueco al lado de la tercera y rompe
            la lectura de un vistazo — que es lo único que un veredicto tiene que
            hacer. Tres o una, nunca dos y media. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(195px,1fr))', gap: 28, marginBottom: 22 }}>
          {/* Dos cifras de este veredicto estuvieron MAL y conviene que quede
              escrito, porque las dos fallaron igual: un número traído de una
              fuente sin verificar el modelo al que aplica.
              · «US$666 · costo de una reunión de venta» — es el costo de una
                reunión agendada por un SDR OUTBOUND, y MaKo vende self-serve.
              · «margen −45% del Pro» — medido con el ruteo caro Y contra un techo
                del 75% que es un supuesto de la era SaaS. La mediana de un
                producto de IA es 50%: el Pro nunca estuvo en problemas.
             Y cada rótulo tiene que sostenerse SOLO: «De ese costo son medios»
             obligaba a haber leído la tarjeta de al lado. */}
          <Cifra
            valor={usd(GROWTH_P.iaUsd)} unidad="por mes" tono="warn"
            rotulo="Lo que costará de IA el cliente más caro"
            detalle={`Un plan Growth de US$${GROWTH_P.precioUsd}/mes con el producto entero construido. Deja ${num(margen(GROWTH, GROWTH_P.iaUsd)!, 0)}% de margen, arriba de la mediana de un producto de IA (50-53%).`}
          />
          <Cifra
            valor={`${num(pctMedios, 0)}%`} unidad="del costo" tono="bad"
            rotulo="Son video e imagen, no texto"
            detalle={`${usd(GROWTH_P.mediosUsd)} de medios contra ${usd(GROWTH_P.textoUsd)} de todo el texto. Un solo intento de Reel de 15 segundos cuesta US$0,85.`}
          />
          <Cifra
            valor="436×" unidad="más barato" tono="good"
            rotulo="Lo que se ahorra extrayendo una reunión"
            detalle="De US$0,93 a US$0,0021. No es un modelo más barato: con 1M de contexto la reunión entra entera y desaparecen las 4-5 llamadas del troceo."
          />
        </div>
        {/* Acá había un párrafo en negrita que volvía a contar las tres cifras de
            arriba —y encima decía «US$2,45» del Reel donde la tarjeta dice
            «US$0,85», porque uno es con tres intentos y el otro con uno. Dos
            números del mismo objeto en la misma vista, sin decir qué los separa,
            se leen como un error. Queda solo lo que las cifras NO dicen: qué hay
            que hacer con esto. */}
        <div style={{ padding: '14px 16px', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, fontWeight: 600, maxWidth: '74ch' }}>
            La consecuencia es de diseño de planes, no de ingeniería: el video no puede ser una
            feature incluida, tiene que ser una unidad medida.
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, marginTop: 8, maxWidth: '74ch' }}>
            Y lo que <em>no</em> se arregla bajando el costo es la retención: abajo de US$50/mes el
            producto retiene 23% anual, y el Pro cae en esa banda por dos dólares.
          </div>
        </div>
        {/* Los benchmarks se van al final de la sección de CAC, que es donde se
            usan. Acá abajo del veredicto eran tres líneas en monoespaciada que
            nadie lee y que le sacaban peso a las cifras. */}
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

      {/* ── GRÁFICO 3 ─────────────────────────────────────────────────────── */}
      <Section titulo="Con el producto completo, el costo es el video" card>
        <Nota>
          Las 122 áreas del producto: <strong>55 cerradas, 29 a medias, 38 por construir</strong>. De
          las que faltan, 22 consumen IA. Con el ruteo elegido, el texto deja de importar y lo que
          queda son los medios.
        </Nota>
        <Barras datos={barrasPlanes} tono="bad" />
        <Nota>
          El Growth se lleva {usd(GROWTH_P.mediosUsd)} de medios contra {usd(GROWTH_P.textoUsd)} de
          texto. <strong>Un solo Reel de 15 segundos con 3 intentos cuesta US$2,45</strong> — más que
          todo el texto del plan Pro en un mes entero. La consecuencia es de diseño de planes, no de
          ingeniería: el video no puede ser una feature incluida, tiene que ser una unidad medida.
        </Nota>

        <div style={{ marginTop: 22 }}>
          <Eyebrow>El texto se derrumba</Eyebrow>
          <Fila head plantilla="minmax(0,1.6fr) 90px 90px 60px" cols={['Acción', 'Hoy', 'Ruteado', '']} />
          {RERUTEO.map((r) => {
            const veces = r.nuevoUsd > 0 ? r.hoyUsd / r.nuevoUsd : Infinity;
            return (
              <Fila key={r.id} plantilla="minmax(0,1.6fr) 90px 90px 60px"
                cols={[
                  <span key="n">{r.label}<div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 1 }}>{r.como}</div></span>,
                  <Num key="h">{usd(r.hoyUsd, 4)}</Num>,
                  <Num key="x">{r.nuevoUsd === 0 ? 'gratis' : usd(r.nuevoUsd, 4)}</Num>,
                  <span key="v" style={{ fontFamily: MONO, fontSize: 12, color: veces > 1.5 ? 'var(--good)' : 'var(--faint)' }}>
                    {!isFinite(veces) ? '∞' : veces > 1.5 ? `${veces.toFixed(0)}×` : '—'}
                  </span>,
                ]} />
            );
          })}
        </div>

        <div style={{ marginTop: 16, padding: 13, border: '1px solid var(--warn-border, var(--border))', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)' }}>
          <Status tono="warn">Ojo con estos números</Status>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6, maxWidth: '72ch' }}>
            El <strong>costo unitario</strong> es precio publicado del fabricante. La{' '}
            <strong>cantidad mensual</strong> es un supuesto nuestro — y es la palanca de todo el
            resultado. Con 40 clips en vez de 20, el Growth pasa de {usd(GROWTH_P.iaUsd)} a más de
            US$35 y el margen cae debajo del 65%. Hoy nada lo impide. Ver{' '}
            <strong>«Lo que este análisis daba por cierto y no lo es»</strong>, abajo.
          </div>
        </div>
        <Fuente>
          Baseline medido: un workspace intensivo con el ruteo de HOY cuesta {usd(COSTO_INTENSIVO)}/mes
          (margen del Pro {margenPro.toFixed(0)}%). Eso es lo que el re-ruteo viene a corregir.
        </Fuente>
      </Section>

      {/* ── LA TARIFA ─────────────────────────────────────────────────────── */}
      {/* El problema de forma acá es el RANGO: de 1 a 2.000 MT, 2000×. En barras
          lineales las 25 operaciones baratas quedan pegadas al cero y el gráfico
          solo dice «el Reel es caro». Por eso: primero la comparación que hace
          legible la escala de una, después el gráfico en log ROTULADO, y recién
          después la tabla completa para el que quiera auditar fila por fila. */}
      <Section titulo="La tarifa" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>1 MaKo Token = US$0,001 de precio de lista</span>} card>
        <Nota>
          Cada operación cuesta lo que cuesta. El precio sale del <strong>costo medio real
          medido</strong> por un markup de {num(MARKUP_MT)}×, redondeado a un número que se pueda sumar
          de cabeza.
        </Nota>

        {/* El gráfico de barras en log que estuvo acá se retiró, y la razón vale
            escribirla: necesitaba un párrafo explicando que el eje era
            logarítmico para poder leerse. Un gráfico que viene con instrucciones
            de uso no está comunicando — y encima el dato que la gente leía era
            la columna de números de la derecha, no las barras.
            Lo que importa de una lista de precios que abarca 2000× no es el
            valor de cada fila: son los TRES ESCALONES. Eso son tres renglones. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(195px,1fr))', gap: 26, margin: '20px 0 8px' }}>
          <Cifra
            valor="1-30" unidad="MT" tono="good"
            rotulo="Todo lo que es texto"
            detalle="Un mensaje a MaKo, priorizar tareas, extraer una reunión, analizar una llamada. Con el ruteo elegido el texto prácticamente dejó de costar."
          />
          <Cifra
            valor="80-570" unidad="MT"
            rotulo="Todo lo que es imagen"
            detalle={`Una imagen ${mtDeOp('imagen')} MT, un thumbnail ${mtDeOp('thumb')}, un carrusel de 7 ${mtDeOp('carrusel')}. El primer escalón que se siente en la factura.`}
          />
          <Cifra
            valor={`960-${miles(mtDeOp('reel'))}`} unidad="MT" tono="bad"
            rotulo="Todo lo que es video"
            detalle={`Un clip de 8 segundos ${mtDeOp('clip8')} MT; un intento de Reel de 15 s, ${miles(mtDeOp('reel'))}. Es ${miles(Math.round(mtDeOp('reel') / mtDeOp('imagen')))} veces una imagen y ${miles(mtDeOp('reel'))} veces un mensaje.`}
          />
        </div>
        <Nota>
          Ese salto —de <strong>1</strong> a <strong>2.000</strong>— es todo el diseño de los planes
          en un número. El texto se puede regalar; el video hay que medirlo.
        </Nota>

        <div style={{ marginTop: 22 }}>
          <Eyebrow>Cuánto rinde el cupo de cada plan</Eyebrow>
          {/* La versión anterior de esta tabla tenía los encabezados «Free 600 /
              Pro 5.000 / Growth 50.000» y la fila del mensaje daba exactamente
              600/5.000/50.000 —porque cuesta 1 MT—, así que se leía como si un
              mensaje COSTARA 50.000. El número estaba bien y la tabla estaba mal:
              ahora cada celda trae su unidad y el precio va en su propia columna. */}
          <Fila head plantilla="minmax(0,1.5fr) 74px 1fr 1fr 1fr" cols={['Operación', 'Precio', 'Free', 'Pro', 'Growth']} />
          {/* Rótulos CORTOS acá, no los de TARIFA: «Un mensaje a MaKo (web o
              WhatsApp)» se parte en dos líneas y deja la tabla con renglones de
              alturas distintas. El nombre completo vive en la tarifa completa. */}
          {([
            ['mako-msg', 'Un mensaje a MaKo', 'mensajes'],
            ['reunion', 'Extraer una reunión', 'reuniones'],
            ['closing', 'Analizar una llamada', 'llamadas'],
            ['imagen', 'Generar una imagen', 'imágenes'],
            ['clip8', 'Un clip de 8 segundos', 'clips'],
            ['reel', 'Un intento de Reel', 'intentos'],
          ] as const).map(([id, corto, unidad]) => {
            const o = TARIFA.find((t) => t.id === id)!;
            const cuantos = (p: 'free' | 'pro' | 'growth') => Math.floor(CUPO_MT[p] / o.mt);
            return (
              <Fila key={id} plantilla="minmax(0,1.5fr) 74px 1fr 1fr 1fr"
                cols={[
                  corto,
                  <Num key="p">{miles(o.mt)} MT</Num>,
                  ...(['free', 'pro', 'growth'] as const).map((p) => (
                    <span key={p} style={{ fontSize: 12, color: cuantos(p) === 0 ? 'var(--faint)' : 'var(--ink)' }}>
                      <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{cuantos(p) === 0 ? '—' : miles(cuantos(p))}</span>
                      {cuantos(p) > 0 && <span style={{ color: 'var(--faint)', fontSize: 11 }}> {unidad}</span>}
                    </span>
                  ))]} />
            );
          })}
          <Nota>
            Se lee así: <strong>una imagen cuesta {mtDeOp('imagen')} MT</strong>, y con los{' '}
            {miles(CUPO_MT.pro)} MT del Pro entran {miles(Math.floor(CUPO_MT.pro / mtDeOp('imagen')))} imágenes
            —<em>si no gastaras el cupo en ninguna otra cosa</em>. Por eso el contador que ve el
            cliente va en <strong>unidades</strong> («te quedan 3 Reels») y el costo se muestra{' '}
            <strong>antes</strong> de generar, nunca después.
          </Nota>
        </div>

        <div style={{ marginTop: 20 }}>
          <Eyebrow>Lo que expone cada cupo</Eyebrow>
          <Fila head plantilla="minmax(0,1fr) 110px 100px 110px 100px" cols={['Plan', 'Mes normal', 'Margen', 'Mes malo (p90)', 'Margen']} />
          {EXPOSICION.map((e) => (
            <Fila key={e.plan} plantilla="minmax(0,1fr) 110px 100px 110px 100px"
              cols={[
                <span key="p">{e.plan} <span style={{ color: 'var(--faint)', fontFamily: MONO, fontSize: 11 }}>{miles(e.cupo)} MT</span></span>,
                <Num key="n">{usd(e.normalUsd)}</Num>,
                <span key="mn">{e.margenNormal === null ? '—' : <Status tono={e.margenNormal >= 70 ? 'good' : 'warn'}>{`${num(e.margenNormal)}%`}</Status>}</span>,
                <Num key="m">{usd(e.maloUsd)}</Num>,
                <span key="mm">{e.margenMalo === null ? '—' : <Status tono={e.margenMalo >= 70 ? 'good' : e.margenMalo >= 25 ? 'warn' : 'bad'}>{`${num(e.margenMalo)}%`}</Status>}</span>,
              ]} />
          ))}
          <div style={{ marginTop: 12, padding: 13, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)' }}>
            <Status tono="warn">El riesgo que queda es uno solo</Status>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6, maxWidth: '74ch' }}>{RIESGO_QUE_QUEDA}</div>
          </div>
        </div>
      </Section>

      {/* ── LOS PLANES ────────────────────────────────────────────────────── */}
      {/* Cuatro columnas, y la del Growth va marcada como lista de espera: su
          gancho entero (Image y Video Generator) es ComingSoon. Un tercer plan
          vacío no es un ancla de precio, es un reembolso. */}
      <Section titulo="Los planes" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>1.000 MaKo Tokens = US$1 de precio de lista · {usd(1000 / MT_POR_USD / MARKUP_MT)} de costo</span>} card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 20 }}>
          {PRECIOS.map((pr) => {
            const perfil = PERFILES.find((x) => x.plan === pr.plan);
            const espera = pr.plan === 'growth' || pr.plan === 'agencia';
            return (
              <div key={pr.plan} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 15, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                  <Eyebrow>{pr.plan}</Eyebrow>
                  {espera && <span style={{ fontSize: 10, color: 'var(--warn)', fontFamily: MONO }}>en espera</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '6px 0 2px' }}>
                  <span style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em' }}>{pr.mensualUsd === 0 ? 'Gratis' : `US$${pr.mensualUsd}`}</span>
                  {pr.mensualUsd > 0 && <span style={{ fontSize: 12, color: 'var(--faint)' }}>/mes</span>}
                </div>
                {pr.anualUsd !== null && (
                  <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--muted)' }}>
                    US${miles(pr.anualUsd)}/año · {pr.descuento}
                  </div>
                )}
                <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
                  {pr.netoMensualUsd > 0 ? `neto ${usd(pr.netoMensualUsd)} · ` : ''}cupo {miles(CUPO_MT[pr.plan as keyof typeof CUPO_MT] ?? 150000)} MT
                </div>
                {perfil && perfil.precioUsd > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Status tono={margen({ ...PLANES[0], precioUsd: pr.netoMensualUsd }, perfil.iaUsd)! >= 70 ? 'good' : 'warn'}>
                      {`margen ${num(margen({ ...PLANES[0], precioUsd: pr.netoMensualUsd }, perfil.iaUsd)!, 0)}% sobre neto`}
                    </Status>
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 9, lineHeight: 1.5 }}>{GANCHO[pr.plan]}</div>
              </div>
            );
          })}
        </div>

        <Eyebrow>Qué entra en cada uno</Eyebrow>
        <Fila head plantilla="minmax(0,2fr) 1fr 1fr 1fr 1fr" cols={['', 'Free', 'Pro', 'Growth', 'Agencia']} />
        {GRILLA.map((g) => (
          <div key={g.grupo} style={{ marginBottom: 10 }}>
            <div style={{ ...{ fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase' as const }, color: 'var(--faint)', fontFamily: MONO, margin: '10px 0 2px' }}>{g.grupo}</div>
            {g.filas.map((f) => (
              <Fila key={f.que} plantilla="minmax(0,2fr) 1fr 1fr 1fr 1fr"
                cols={[f.que, ...(['free', 'pro', 'growth', 'agencia'] as const).map((c) => <Celda key={c} v={f[c]} />)]} />
            ))}
          </div>
        ))}

        <div style={{ marginTop: 16, padding: 13, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)' }}>
          <Status tono="warn">Por qué el Growth va en lista de espera</Status>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6, maxWidth: '74ch' }}>{FUERA_DE_GRILLA.growthEnEspera}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6, maxWidth: '74ch' }}>
            <strong style={{ color: 'var(--ink)' }}>Y tres trampas peores que un ComingSoon</strong>, porque figuran como listo o parcial y se venderían sin querer:
          </div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, maxWidth: '74ch' }}>
            {FUERA_DE_GRILLA.trampas.map((t) => (
              <li key={t.que}><strong style={{ color: 'var(--ink)' }}>{t.que}</strong> — {t.por}</li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── TODO EL RESPALDO, PLEGADO ─────────────────────────────────────── */}
      <Section titulo="El respaldo" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>abrí lo que quieras auditar</span>} card>

        {/* Va PRIMERO y ABIERTO a propósito: son las salvedades que invalidan
            números que están arriba. Plegarlas sería presentarlas de la forma
            más cara posible — la misma razón por la que el veredicto va arriba. */}
        <Plegable abierto titulo="⚠️ Lo que este análisis daba por cierto y NO lo es" resumen={`${SALVEDADES.length} salvedades, verificadas contra el código`}>
          <Nota>
            Salieron del crítico de completitud del paso 3 y se chequearon a mano en el repo. Dos de
            ellas califican los números del veredicto.
          </Nota>
          {SALVEDADES.map((s) => (
            <div key={s.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600 }}>{s.titulo}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.6, maxWidth: '76ch' }}>{s.que}</div>
              {s.vive !== '—' && <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>{s.vive}</div>}
            </div>
          ))}
        </Plegable>

        {/* El respaldo de los pasos 3 y 4, que hasta acá no había llegado a la
            pantalla: dos corridas de 24 agentes cuyo resultado vivía solo en el
            documento. Un análisis que no se puede auditar desde donde se decide
            es un análisis que nadie va a auditar. */}
        <Plegable titulo="BYOK vs MaKo Tokens — las dos economías" resumen={`${BYOK.length} hallazgos · por qué va en el Growth sin bajar el precio, y solo para texto`}>
          {BYOK.map((b) => <BloqueTexto key={b.id} b={b} />)}
        </Plegable>

        <Plegable titulo="Por qué NO hay un 4º plan (todavía)" resumen={`${CUARTO_PLAN.length} premisas que lo empujaban, y por qué se caen`}>
          {CUARTO_PLAN.map((b) => <BloqueTexto key={b.id} b={b} />)}
        </Plegable>

        <Plegable titulo="El precio NETO: Paddle, IVA y el CFDI" resumen={`${COBRO.length} hallazgos · lo que de verdad entra a la cuenta`}>
          {COBRO.map((b) => <BloqueTexto key={b.id} b={b} />)}
        </Plegable>

        <Plegable titulo="Los tres clientes que ya están adentro" resumen="quiénes son de verdad, qué se les dice y qué NO prometerles">
          {GRANDFATHER.map((b) => <BloqueTexto key={b.id} b={b} />)}
        </Plegable>

        <Plegable titulo="Lo que hay que construir, en orden" resumen={`${ORDEN_DE_TRABAJO.length} pasos — y el orden ES el del riesgo`}>
          <Nota>
            Hoy nada cuesta plata <strong>por accidente</strong>: un cliente sin key propia no gasta
            porque la llamada explota. El día que la plataforma sirva su propia key para que exista
            el Free, los seis caminos automáticos facturan solos. Invertir este orden es abrir la
            canilla y después buscar la llave.
          </Nota>
          <Fila head plantilla="30px minmax(0,3fr) minmax(0,1.4fr)" cols={['#', 'Qué', 'Dónde vive']} />
          {ORDEN_DE_TRABAJO.map((o) => (
            <Fila key={o.n} plantilla="30px minmax(0,3fr) minmax(0,1.4fr)"
              cols={[<Num key="n">{o.n}</Num>, o.que,
                <span key="v" style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{o.vive}</span>]} />
          ))}
        </Plegable>

        <Plegable titulo="⚠️ Los huecos bloqueantes" resumen={`${HUECOS.length} cosas que frenan el primer cobro`}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65, maxWidth: '76ch' }}>
            {HUECOS.map((h, i) => <li key={i} style={{ marginBottom: 8 }}>{h}</li>)}
          </ul>
        </Plegable>

        <Plegable titulo="La tarifa completa" resumen={`las ${TARIFA.length} operaciones, con su costo real y de dónde sale`}>
          <Nota>
            El estadístico es la <strong>media</strong>, no la mediana ni el p90. La distribución de
            tokens de salida es asimétrica a la derecha —la media es 1,9× a 3× la mediana en casi
            todas las medidas—, así que por mediana se subcobra y la cola se come el margen (el mes
            malo del Growth daba <strong>−58%</strong>), y por p90 se sobrecobra al 90% de los
            usuarios. La media es lo que se paga cuando se corren muchas.
          </Nota>
          {(['Conversar', 'Plan', 'Análisis', 'Escribir', 'Automático', 'Medios'] as const).map((g) => (
            <div key={g} style={{ marginBottom: 14 }}>
              <Eyebrow>{g}{g === 'Automático' ? ' · no consume cupo' : ''}</Eyebrow>
              <Fila head plantilla="minmax(0,1.8fr) 70px 90px 110px" cols={['Operación', 'MT', 'Costo real', 'Origen']} />
              {TARIFA.filter((o) => o.grupo === g).map((o) => (
                <Fila key={o.id} plantilla="minmax(0,1.8fr) 70px 90px 110px"
                  cols={[
                    o.label,
                    <Num key="mt">{o.mt === 0 ? '—' : miles(o.mt)}</Num>,
                    <Num key="c">{o.costoUsd === 0 ? 'gratis' : `${usd(o.costoUsd, 5)}`}</Num>,
                    <span key="o" style={{ fontSize: 11, color: o.origen === 'supuesto' ? 'var(--warn)' : 'var(--faint)' }}>
                      {o.origen}{o.n > 0 ? ` · n=${o.n}` : ''}
                    </span>,
                  ]} />
              ))}
            </div>
          ))}
          <Fuente>
            Lo <strong>medido</strong> sale de la media real sobre {miles(MEDICION.llamadas)} llamadas
            de <span style={{ fontFamily: MONO }}>anthropic_usage</span>. Lo{' '}
            <strong style={{ color: 'var(--warn)' }}>supuesto</strong> es de features que todavía no
            existen: es lo primero a recalibrar cuando corran.
          </Fuente>
        </Plegable>

        <Plegable titulo="El ruteo elegido" resumen={`${RUTEO.length} modelos, uno por tipo de tarea — todavía SIN implementar`}>
          <Nota>
            Verificados contra la página del fabricante el 09/08/2026. ⚠️ Ninguno está en{' '}
            <span style={{ fontFamily: MONO }}>lib/ai-cheap.ts</span> todavía: mover tres de los
            cuatro es configuración (<span style={{ fontFamily: MONO }}>CHEAP_MODEL</span>,{' '}
            <span style={{ fontFamily: MONO }}>GEMINI_MODEL</span>…), y el que no entra por ahí es
            justo el del contexto gigante, que es el del 436×.
          </Nota>
          <Fila head plantilla="minmax(0,1fr) 75px 75px minmax(0,1.8fr)" cols={['Modelo', 'US$/M in', 'out', 'Para qué']} />
          {RUTEO.map((r) => (
            <Fila key={r.id} plantilla="minmax(0,1fr) 75px 75px minmax(0,1.8fr)"
              cols={[
                r.modelo,
                <Num key="i">{r.inUsd === 0 ? 'gratis' : num(r.inUsd, 2)}</Num>,
                <Num key="o">{r.outUsd === 0 ? '—' : num(r.outUsd, 2)}</Num>,
                <span key="p" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.para}</span>,
              ]} />
          ))}
        </Plegable>

        <Plegable titulo="Las 22 acciones que faltan construir" resumen="16 de texto suman US$0,23 · 6 de medios suman US$3,22">
          <Nota>
            De las 38 áreas por construir, estas son las que consumen IA. La columna{' '}
            <strong>barata</strong> es la capa de revendedores — el ahorro es real y{' '}
            <strong>el riesgo contractual también</strong>: APImart prohíbe revender y Kie.ai no
            aclara derechos del output.
          </Nota>
          {(['Analyze', 'Sales', 'Content', 'Agentes'] as const).map((fam) => (
            <div key={fam} style={{ marginBottom: 14 }}>
              <Eyebrow>{fam}</Eyebrow>
              <Fila head plantilla="minmax(0,1.8fr) 90px 90px" cols={['Acción', 'Costo', 'Barata']} />
              {ACCIONES_NUEVAS.filter((a) => a.familia === fam).map((a) => (
                <Fila key={a.id} plantilla="minmax(0,1.8fr) 90px 90px"
                  cols={[
                    <span key="n" style={{ fontWeight: a.usdBarato !== undefined ? 600 : 400 }}>{a.label}</span>,
                    <Num key="c">{a.usd === 0 ? 'gratis' : `${usd(a.usd, 4)}`}</Num>,
                    <Num key="b">{a.usdBarato !== undefined ? `${usd(a.usdBarato, 4)}` : '—'}</Num>,
                  ]} />
              ))}
            </div>
          ))}
        </Plegable>

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

        {/* Acá había una columna «MT» calculada sobre ESTOS costos, y contradecía
            a la TARIFA: son el gasto con el ruteo VIEJO, no el precio del cupo.
            Dos números que se llaman igual y no coinciden es peor que uno solo. */}
        <Plegable titulo="Lo que costaba cada acción ANTES del re-ruteo" resumen={`${ACCIONES.length} procesos medidos con el ruteo viejo — el precio en MT está en «La tarifa»`}>
          <Nota>
            El denominador son las llamadas que <strong>efectivamente se pagaron</strong>: mezclarlas
            con las gratis da un número que no sirve para cotizar, porque el free tier no escala.
            Esto es el <strong>baseline</strong> contra el que se mide el ahorro del ruteo, no lo que
            se le cobra al cliente.
          </Nota>
          <Fila head plantilla="minmax(0,1.7fr) 90px 110px" cols={['Acción', 'Costo real', 'Llamadas pagas']} />
          {ACCIONES.map((a) => (
            <Fila key={a.id} plantilla="minmax(0,1.7fr) 90px 110px"
              cols={[
                <span key="n">{a.label} {a.automatico && <Status tono="warn">solo</Status>}</span>,
                <Num key="c">{usd(costoUnitario(a), 4)}</Num>,
                <Num key="l">{miles(a.llamadasPagas)}</Num>,
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
