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
import { Barras, Cifra, Plegable, Titular, type Barra } from './Piezas';
import {
  ACCIONES, ACCIONES_NUEVAS, AUDIO, AUTOMATICOS, BENCHMARKS, BLOQUEANTES, COMPETENCIA, CUPO_MT,
  DATO_FALSO, ECONOMIA, EL_ACCIDENTE, EL_COSTO_ES_EL_VIDEO, ESCENARIOS, EXPOSICION, IMAGEN,
  MARKUP_MT, MEDICION, MT_POR_USD, PERFILES, PLANES, RERUTEO, RETENCION, RETENCION_FUENTE,
  RIESGO_QUE_QUEDA, RUTEO, SALVEDADES, TARIFA, VIDEO, VIDEO_15S,
  BYOK, COBRO, CUARTO_PLAN, FUERA_DE_GRILLA, GANCHO, GRANDFATHER, GRILLA, HUECOS,
  INDICE, ORDEN_DE_TRABAJO, PRECIOS,
  BASE_PROPIA, HIGH_TICKET, IA_POR_PRO, MES_0, OFERTA_ANUAL, PLAN_MES_1,
  PREGUNTAS_ABIERTAS, PROYECCION_24, RESULTADO_24, TOPE_PAUTA,
  ASCENSO_NETO, CAC_CANALES, CAPITAL_NECESARIO, CONTRAFACTUAL_MENSUAL, COSTO_FREE,
  FASES_TIEMPO, FEATURES_CONSTRUIDAS, entraEn, horasDe, type CanalCac,
  LLAMADA, P1_ASCENSO, PARA_QUE_ESTO_SE_PUEDA_MEDIR, PROYECCION, UNIT, type Bloque, type Celda as CeldaT,
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

// Las dos monedas de un canal, cada una con su formato. Los decimales NO son
// cosmética: sin ellos, la prospección —que cuesta tres centavos y media hora—
// se pinta «US$0 · 0 h», o sea gratis y sin esfuerzo, que es lo contrario de lo
// que dice el modelo (lo que la frena es de dónde saque contactos).
/** La plata de un canal. Sin decimales, salvo cuando redondear los borraría. */
const plata = (n: number) => (n > 0 && n < 1 ? usd(n) : usd(n, 0));
/** Las horas de un canal. 26 h no lleva decimales; 0,05 h sí. */
const horas = (h: number) => `${num(h, h > 0 && h < 1 ? 2 : 0)} h`;

/** La grilla de la tabla de canales. Una sola constante para el encabezado y las
 *  filas: dos plantillas escritas dos veces se desalinean en cuanto una cambia. */
const PLANTILLA_CANAL = 'minmax(0,1fr) 84px 84px minmax(0,1fr) 92px';

/** Qué se acaba primero y frena un canal. El nombre técnico no va a pantalla:
 *  va lo que significa. */
const QUE_LO_FRENA: Record<CanalCac['queLoLimita'], string> = {
  presupuesto: 'la plata que puedas poner',
  horas: 'tus horas',
  lista: 'de dónde saques contactos con permiso',
  'tiempo-hasta-señal': 'que tarda 6 a 12 meses en dar señal',
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesLabel = (m: string) => { const [y, x] = m.split('-'); return `${MESES[Number(x) - 1] ?? x} ${y}`; };

/** El precio en MT de una operación. Falla ruidoso: un id mal escrito acá pinta
 *  «0 MT» en una cifra del veredicto, que es la forma más cara de equivocarse. */
const mtDeOp = (id: string) => {
  const o = TARIFA.find((t) => t.id === id);
  if (!o) throw new Error(`Pricing: no existe la operación «${id}» en TARIFA`);
  return o.mt;
};

/** El nombre de la regla, sin su explicación. `reglaQueGobierna` mezcla las dos
 *  y la del Pro anual son 300 caracteres: dentro de una columna de tabla eso no
 *  es un dato, es un párrafo suelto. Lo largo va al aviso de abajo. */
const reglaCorta = (r: string) => (r.startsWith('⚠️') ? 'las dos reglas se separan 2,3×' : r.split(' —')[0].split(' (')[0]);

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
/**
 * El envoltorio de una tabla de `Fila`. En pantalla angosta la tabla NO se
 * comprime hasta que las palabras se parten: se corre de costado.
 *
 * Esto NO contradice la regla de layout de AGENTS.md — la que prohíbe el scroll
 * lateral es la de las barras de NAVEGACIÓN, porque esconde destinos. Correr
 * CONTENIDO de costado es lo que `.mk-scroll-x` existe para hacer. Sin esto, a
 * 390px la grilla de 5 columnas deja «Operación» en una celda de 25px y el texto
 * sale por encima de la columna de al lado.
 */
function Tabla({ children }: { children: React.ReactNode }) {
  return <div className="mk-scroll-x"><div style={{ minWidth: 560 }}>{children}</div></div>;
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
  <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.6 }}>{children}</p>
);
const BloqueTexto = ({ b }: { b: Bloque }) => (
  <div style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
    <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600 }}>{b.titulo}</div>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.6 }}>{b.cuerpo}</div>
    {b.fuente && <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>{b.fuente}</div>}
  </div>
);
const Fuente = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12 }}>{children}</div>
);

/** El id de anclaje de una parte. Lo comparten el índice de arriba y el título. */
export const anclaParte = (n: string) => `parte-${n}`;

/**
 * El título de una de las cuatro partes.
 *
 * Existe porque el índice de arriba prometía cuatro preguntas y abajo había ocho
 * cards del mismo peso, en otro orden, y una de las preguntas —el CAC— no tenía
 * sección. El lector no tenía forma de saber dónde estaba parado.
 *
 * Va FUERA de las cards a propósito: si el título de la parte fuera otra card se
 * leería como una sección más. Lo que lo separa es que respira, no que decore.
 */
function Parte({ n }: { n: string }) {
  const q = INDICE.find((x) => x.n === n);
  if (!q) throw new Error(`Pricing: la parte «${n}» no está en INDICE`);
  const { pregunta, bajada, conclusion } = q;
  return (
    // El filete y el aire de arriba son lo que hace que se lea como una PARTE y no
    // como una sección más. Sin ellos el título de la parte competía con el de la
    // primera card de adentro, que es más oscura y más grande, y la jerarquía se
    // invertía: la parte parecía el subtítulo de su propia sección.
    <div id={anclaParte(n)} style={{ margin: '54px 0 18px', paddingTop: 20, borderTop: '1px solid var(--border-strong)', scrollMarginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 15, color: 'var(--mako)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        <h2 style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-.025em', color: 'var(--ink)', margin: 0, lineHeight: 1.15 }}>{pregunta}</h2>
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55, marginTop: 8, paddingLeft: 29 }}>{bajada}</div>
      {/* La conclusión va en tinta normal y más grande que la bajada, porque no es
          un subtítulo: es la respuesta. La bajada dice de qué habla la parte y se
          lee en gris; esto dice qué concluye y se lee antes que cualquier card. */}
      <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, marginTop: 12, paddingLeft: 29, fontWeight: 500 }}>{conclusion}</div>
    </div>
  );
}

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

  // ── Parte 3: lo que cuesta cada canal, en las dos monedas ────────────────
  // ⚠️ UN GRÁFICO POR MONEDA, Y NUNCA SE SUMAN. El de antes graficaba `cacUsd`
  // —la plata MÁS las horas del dueño valuadas a US$100— contra un límite que
  // estaba en una sola moneda, y de ahí salía «solo entra referidos». Partidas
  // en dos, entran TRES de los cinco: los dos que sobran son justo los que se
  // compran con pauta, y los dos más baratos son los que se pagan con tiempo.
  //
  // `limitePlata` es lo máximo que se puede pagar por un cliente Pro (LTV:CAC
  // 3:1). Se compara SOLO contra la plata; las horas van a su propio gráfico.
  const limitePlata = UNIT.find((u) => u.plan === 'pro')!.gobierna;
  const limitePlataAnual = UNIT.find((u) => u.plan === 'proAnual')!.cacMaxPayback;

  // La fase que se mira. Septiembre es el mes que este documento planifica:
  // agosto es construcción y no tiene una sola hora de adquisición, y el régimen
  // recién empieza cuando hay clientes que entregar.
  const faseActual = FASES_TIEMPO.find((f) => f.id === 'adquisicion')!;
  const canalCac = (id: string) => CAC_CANALES.find((c) => c.id === id)!;

  /** La plata de un canal como % de lo que se puede pagar. Dos decimales cuando
   *  redondear a cero borraría el dato: la prospección cuesta 0,03%, no 0%. */
  const pctDeLoQuePodesPagar = (p: number) => {
    const x = (p / limitePlata) * 100;
    return `${num(x, x > 0 && x < 1 ? 2 : 0)}%`;
  };
  const entranEnPlata = CAC_CANALES.filter((c) => c.plataPorCliente <= limitePlata).length;

  // Énfasis, no arcoíris: se destacan los que SÍ se pueden comprar, y por eso el
  // tono es `good`. El tono se elige por lo que significa la barra destacada, no
  // por el tema de la sección (AGENTS.md → «Un color de acento dice algo»).
  const barrasPlata: Barra[] = [...CAC_CANALES]
    .sort((a, b) => a.plataPorCliente - b.plataPorCliente)
    .map((c) => ({
      id: c.id,
      label: c.nombre.split(' —')[0].split(' (')[0],
      nota: `${pctDeLoQuePodesPagar(c.plataPorCliente)} de lo que podés pagar · ${c.escalable ? 'escala con plata' : 'con tope propio'}`,
      valor: c.plataPorCliente,
      texto: plata(c.plataPorCliente),
      destacada: c.plataPorCliente <= limitePlata,
    }));

  // El mismo canal en la otra moneda. Sin destacada a propósito: acá no hay una
  // que «gane», y lo único que el gráfico tiene que decir es que el orgánico
  // está en otra escala. La nota de cada barra dice con qué feature baja.
  const barrasHoras: Barra[] = [...CAC_CANALES]
    .sort((a, b) => horasDe(a, FEATURES_CONSTRUIDAS) - horasDe(b, FEATURES_CONSTRUIDAS))
    .map((c) => ({
      id: c.id,
      label: c.nombre.split(' —')[0].split(' (')[0],
      nota: c.horas.loHabilita ? `con ${c.horas.loHabilita} baja a ${horas(c.horas.conMaKo)}` : '',
      valor: horasDe(c, FEATURES_CONSTRUIDAS),
      texto: horas(horasDe(c, FEATURES_CONSTRUIDAS)),
      destacada: false,
    }));

  // Las llamadas de venta SERVIDAS contra las PEDIDAS, por escenario. Es la
  // forma de ver que el numerador no se mueve aunque el denominador explote.
  // Parte 5 — de dónde salen las 11 altas del mes 1, contra el objetivo de 30.
  const barrasMes1: Barra[] = [
    { id: 'base', label: 'Tus 1.000 contactos', nota: 'a mano, 30 h tuyas', valor: PLAN_MES_1.desglose.base, texto: num(PLAN_MES_1.desglose.base) },
    { id: 'ads', label: 'US$1.000 de pauta', nota: `CAC económico ${usd(PLAN_MES_1.cacEconomicoUsd, 0)}`, valor: PLAN_MES_1.desglose.ads, texto: num(PLAN_MES_1.desglose.ads) },
    { id: 'falta', label: 'Lo que falta para 30', nota: 'no se compra: se construye', valor: PLAN_MES_1.losQueFaltan.faltan, texto: num(PLAN_MES_1.losQueFaltan.faltan), destacada: true },
  ];

  // Y el costo de IA de un Pro: lo que cuesta hoy, lo que costaría ruteado, y
  // lo que el modelo viejo decía. Destacado el de HOY, que es el que se paga.
  const barrasIa: Barra[] = [
    { id: 'hoy', label: 'Hoy, sin ruteo', nota: 'lo que se paga de verdad', valor: IA_POR_PRO.hoyUsd, texto: usd(IA_POR_PRO.hoyUsd), destacada: true },
    { id: 'ruteado', label: 'Con el ruteo de los pasos 1-6', nota: IA_POR_PRO.cuandoBaja, valor: IA_POR_PRO.conRuteoUsd, texto: usd(IA_POR_PRO.conRuteoUsd) },
    { id: 'viejo', label: 'Lo que el modelo proyectaba', nota: 'sobre un ruteo que no existe', valor: 2.52, texto: usd(2.52) },
  ];

  const barrasLlamadas: Barra[] = PROYECCION.map((p) => ({
    id: p.id,
    label: p.nombre.split(' — ')[0],
    nota: `${miles(p.hitos[p.hitos.length - 1].pagos)} clientes pagos · ${num(p.programas1a1)} programas vendidos`,
    valor: p.llamadasServidas,
    texto: `${miles(p.llamadasServidas)} de ${miles(p.llamadasPedidas)}`,
    destacada: p.id === 'base',
  }));

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
        <p style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.65, margin: 0 }}>
          Si MaKo le va a poner la IA a sus clientes en vez de que cada uno traiga su key,{' '}
          <strong>cada cosa que hace el producto pasa a costar plata de la agencia</strong>. Esta
          pantalla contesta cuatro preguntas, en este orden:
        </p>
        <ol style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, margin: '12px 0 0', paddingLeft: 20 }}>
          {INDICE.map((q) => (
            <li key={q.n} style={{ marginBottom: 2 }}>
              <a href={`#${anclaParte(q.n)}`} style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid var(--border-strong)' }}>{q.pregunta}</a>
              {' — '}{q.bajada}
            </li>
          ))}
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
          <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, fontWeight: 600 }}>
            La consecuencia es de diseño de planes, no de ingeniería: el video no puede ser una
            feature incluida, tiene que ser una unidad medida.
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, marginTop: 8 }}>
            Y lo que <em>no</em> se arregla bajando el costo es la retención: abajo de US$50/mes el
            producto retiene 23% anual, y el Pro cae en esa banda por dos dólares.
          </div>
        </div>
        {/* Los benchmarks se van al final de la sección de CAC, que es donde se
            usan. Acá abajo del veredicto eran tres líneas en monoespaciada que
            nadie lee y que le sacaban peso a las cifras. */}
      </Section>

      <Parte n="1" />

      {/* ── GRÁFICO 2 ─────────────────────────────────────────────────────── */}
      <Section titulo="El ruteo de modelo vale 8×" card>
        <Nota>
          El <strong>mismo consumo medido</strong>, facturado bajo distintas políticas de modelo.
          Es la palanca más grande que existe — más que cualquier límite de cupo.
        </Nota>
        <Barras datos={barrasRuteo} tono="mako" />
        <div style={{ marginTop: 14, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--muted)' }}>
          <span>Un Pro aguanta <strong style={{ fontFamily: MONO }}>{usd(techoIa(PRO))}</strong> de IA por mes y sigue dejando 75% de margen</span>
          <span>Un Growth aguanta <strong style={{ fontFamily: MONO }}>{usd(techoIa(GROWTH))}</strong></span>
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
          <Tabla>
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
          </Tabla>
        </div>

        <div style={{ marginTop: 16, padding: 13, border: '1px solid var(--warn-border, var(--border))', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)' }}>
          <Status tono="warn">Ojo con estos números</Status>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>
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

      <Parte n="2" />

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
          <Tabla>
            <Fila head plantilla="minmax(0,1.5fr) 74px 1fr 1fr 1fr" cols={['Operación', 'Precio', 'Free', 'Pro', 'Growth']} />
            {/* Rótulos CORTOS acá, no los de TARIFA: «Un mensaje a MaKo (web o
                WhatsApp)» se parte en dos líneas y deja la tabla con renglones de
                alturas distintas. El nombre completo vive en la tarifa completa. */}
          </Tabla>
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
          <Tabla>
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
          </Tabla>
          <div style={{ marginTop: 12, padding: 13, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)' }}>
            <Status tono="warn">El riesgo que queda es uno solo</Status>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>{RIESGO_QUE_QUEDA}</div>
          </div>
        </div>
      </Section>

      <Parte n="3" />
      {/* ── PARTE 3: EL CAC ────────────────────────────────────────────────── */}
      {/* La pregunta que el índice prometía y la pantalla no contestaba. Sale de
          la corrida de 12 agentes del 09/08/2026 (31 fallas, 14 que cambiaban el
          signo). El detalle en docs/embudo-y-high-ticket.md.

          ⚠️ CADA SECCIÓN ES UN <Titular>: un número y dos frases a la vista, y
          TODO el respaldo plegado. La primera versión ponía el párrafo entero
          arriba de la tabla entera, y el dueño lo dijo así: «pusiste muucha data
          mucho texto todo junto». No sobraba análisis, sobraba análisis a la
          vista. Si algo no entra en dos frases, son dos secciones. */}
      <Section titulo="Los dos canales que te cuestan tiempo son los más baratos en plata" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>por un cliente de US${PRO.precioUsd}/mes podés pagar hasta {usd(limitePlata)} · regla LTV:CAC 3:1</span>} card>
        {/* La frase del Titular decía lo mismo que la conclusión de la parte,
            palabra por palabra y sesenta píxeles más abajo. Los porcentajes se
            siguen DERIVANDO de CAC_CANALES —esa es la parte que no se puede
            perder—, pero lo que la frase agrega ahora es la otra moneda, que es
            lo que viene abajo y la conclusión no cuenta. */}
        <Titular
          valor={`${entranEnPlata} de ${CAC_CANALES.length}`}
          unidad="canales entran, mirando solo la plata"
          tono="good"
          frase={<>Los tres que entran cuestan {pctDeLoQuePodesPagar(canalCac('prospeccion').plataPorCliente)}, {pctDeLoQuePodesPagar(canalCac('organico').plataPorCliente)} y {pctDeLoQuePodesPagar(canalCac('referidos').plataPorCliente)} de esos {usd(limitePlata)}; los dos que no son los únicos que se compran con pauta —carrito {pctDeLoQuePodesPagar(canalCac('carrito').plataPorCliente)} y CTWA {pctDeLoQuePodesPagar(canalCac('ctwa').plataPorCliente)}—. Abajo, los mismos cinco en la otra moneda: ahí el orden se invierte, el más barato en plata es el más caro en horas, y lo que lo mueve es qué feature de MaKo esté construida.</>}
          abrir="Los cinco canales, moneda por moneda, con el veredicto de cada uno"
        >
          {/* UN GRÁFICO POR MONEDA. El de antes era uno solo y graficaba la suma
              de las dos, que es la cuenta que dio el veredicto al revés. */}
          <div style={{ marginBottom: 4 }}><Eyebrow>Lo que cuesta en plata</Eyebrow></div>
          <Barras tono="good" datos={barrasPlata} max={limitePlata} />
          <div style={{ fontSize: 11.5, color: 'var(--faint)', margin: '6px 0 22px' }}>
            La escala termina en los {usd(limitePlata)} que podés pagar por un cliente. Las dos barras
            que la pasan van cortadas a filo, con el número al lado.
          </div>

          <div style={{ marginBottom: 4 }}><Eyebrow>Lo que cuesta en horas</Eyebrow></div>
          <Barras datos={barrasHoras} />
          <div style={{ fontSize: 11.5, color: 'var(--faint)', margin: '6px 0 18px' }}>
            Otra moneda y otra escala: el orgánico se come {horas(canalCac('organico').horas.aMano)} por
            cliente y ninguno de los otros cuatro llega a la media hora. Estas horas no se convierten a
            dólares —esa cuenta fue la que dio «solo entra referidos»—: se miden contra las{' '}
            {miles(faseActual.pisoAdquisicion)} h que {faseActual.mes} tiene para conseguir clientes.
          </div>

          <Nota>
            <strong>El CAC es por cliente PAGO</strong>, nunca por lead. La <strong>plata</strong> es lo
            que sale del bolsillo —pauta, premios, IA— más el costo de vida de los Free que no pagan
            ({usd(COSTO_FREE.totalVida)} cada uno). Las <strong>horas</strong> van aparte, en su propia
            columna, y no se convierten a dólares. Un pago de CTWA arrastra 20 registros Free y 19 no
            pagan nunca: esos {usd(19 * COSTO_FREE.totalVida, 0)} son el{' '}
            {num((19 * COSTO_FREE.totalVida / canalCac('ctwa').plataPorCliente) * 100)}% de su plata.
          </Nota>
          {/* Las dos monedas en dos columnas, nunca en una. La columna «CAC» que
              había acá era la suma, y las de «Medios» y «Free» eran sus dos
              sumandos en plata: hoy van juntos en `plataPorCliente`. */}
          <Tabla>
            <Fila head plantilla={PLANTILLA_CANAL}
              cols={['Canal', 'Plata', 'Horas', 'Qué lo frena', `En ${faseActual.mes}`]} />
            {CAC_CANALES.map((c) => {
              const v = entraEn(c, faseActual, FEATURES_CONSTRUIDAS, limitePlata);
              return (
                <Fila key={c.id} plantilla={PLANTILLA_CANAL}
                  cols={[
                    <div key="n">
                      <div style={{ fontWeight: v.entra ? 600 : 400 }}>{c.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2, lineHeight: 1.45 }}>{c.cadena}</div>
                    </div>,
                    <Num key="p">{plata(c.plataPorCliente)}</Num>,
                    <Num key="h">{horas(horasDe(c, FEATURES_CONSTRUIDAS))}</Num>,
                    <span key="l" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{QUE_LO_FRENA[c.queLoLimita]}</span>,
                    // ⚠️ `clientesMax` sale SOLO de las horas, así que solo se
                    // pinta cuando lo que frena al canal son las horas. Para
                    // referidos —que lo frena la lista— daría «hasta 6.560», un
                    // número que el resto del documento desmiente en la parte 5.
                    v.entra
                      ? <Status key="v" tono="good">{c.queLoLimita === 'horas' ? `hasta ${miles(v.clientesMax)}` : 'entra'}</Status>
                      : <Status key="v" tono="bad">no entra</Status>,
                  ]} />
              );
            })}
          </Tabla>
          <div style={{ marginTop: 14 }}>
            {CAC_CANALES.map((c) => (
              <Plegable key={c.id} titulo={c.nombre}
                resumen={`${plata(c.plataPorCliente)} y ${horas(horasDe(c, FEATURES_CONSTRUIDAS))} · ${c.escalable ? 'escala con plata' : 'tiene tope propio'}`}>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>{c.veredicto}</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 8 }}>
                  confianza {c.confianza} · señal en {c.senalEn} · la plata contra el Pro anual bajo payback: {num((c.plataPorCliente / limitePlataAnual) * 100, 0)}%
                </div>
              </Plegable>
            ))}
          </div>
        </Titular>
      </Section>

      <Section titulo="Vender el anual en vez del mensual multiplica la caja por 62" card>
        <Titular
          valor={usd(189877, 0)}
          unidad="de caja a 24 meses, contra US$3.073"
          tono="good"
          frase={<>Misma máquina, mismo embudo, mismo gasto — lo único distinto es si el canal pago vende el Pro anual o el mensual. El anual cobra el año entero el día 0, y eso multiplica por 3,4 lo que podés pagar por un cliente.</>}
          abrir="Los cuatro escenarios, y lo que hay que poner para arrancar"
        >
          <Tabla>
            <Fila head plantilla="minmax(0,1fr) 100px 100px 84px 84px"
              cols={['Escenario a 24 meses', 'Caja · anual', 'Caja · mensual', 'Pagos · an.', 'Pagos · men.']} />
            {CONTRAFACTUAL_MENSUAL.map((e) => (
              <Fila key={e.escenario} plantilla="minmax(0,1fr) 100px 100px 84px 84px"
                cols={[
                  <span key="n" style={{ fontWeight: e.escenario === 'base' ? 600 : 400 }}>
                    {e.escenario}{e.escenario === 'base' ? ' — el que hay que mirar' : ''}
                  </span>,
                  <Num key="a"><span style={{ color: e.cajaAnualUsd > 0 ? 'var(--good)' : 'var(--bad)' }}>{usd(e.cajaAnualUsd, 0)}</span></Num>,
                  <Num key="m"><span style={{ color: e.cajaMensualUsd > 0 ? 'var(--ink)' : 'var(--bad)' }}>{usd(e.cajaMensualUsd, 0)}</span></Num>,
                  <Num key="pa">{miles(e.pagosAnual)}</Num>,
                  <Num key="pm">{miles(e.pagosMensual)}</Num>,
                ]} />
            ))}
          </Tabla>
          <div style={{ marginTop: 18 }}>
            <Eyebrow>Lo que hay que poner, en las dos monedas</Eyebrow>
            <Tabla>
              <Fila head plantilla="minmax(0,1fr) 86px 84px 92px 78px 92px"
                cols={['Escenario', 'Piso de caja', 'Horas dueño', 'Caja positiva', 'Tope 60 h', 'High ticket']} />
              {PROYECCION.map((p) => (
                <Fila key={p.id} plantilla="minmax(0,1fr) 86px 84px 92px 78px 92px"
                  cols={[
                    <div key="n">
                      <div style={{ fontWeight: p.id === 'base' ? 600 : 400 }}>{p.nombre.split(' — ')[0]}</div>
                      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2, lineHeight: 1.45 }}>{p.medios}</div>
                    </div>,
                    <Num key="c"><span style={{ color: 'var(--bad)' }}>{usd(p.pisoCajaUsd, 0)}</span></Num>,
                    <Num key="h">{miles(CAPITAL_NECESARIO.horasDelDueno[p.id])} h</Num>,
                    <Num key="p">{p.mesCajaPositiva ? `mes ${p.mesCajaPositiva}` : 'nunca'}</Num>,
                    <Num key="t">mes {p.mesTopeHoras}</Num>,
                    <Num key="ht">{usd(p.highTicketAcumUsd, 0)}</Num>,
                  ]} />
              ))}
            </Tabla>
            <Fuente>Las horas son 60/mes de construcción sin un peso de ingreso. {CAPITAL_NECESARIO.agencia}</Fuente>
          </div>
        </Titular>
      </Section>

      <Section titulo="La llamada gratis te cuesta más de lo que te trae" card>
        <Titular
          valor={usd(ASCENSO_NETO.netoUsd)}
          unidad="por comprador"
          tono="bad"
          frase={<>Vale {usd(ASCENSO_NETO.valorEsperadoUsd)} de ascenso esperado y cuesta {usd(ASCENSO_NETO.costoLlamadaUsd)} de calendario. El break-even está en P₁ = {num(ASCENSO_NETO.breakEvenP1 * 100)}% y la base es {num(P1_ASCENSO.base * 100, 0)}%: por eso se cayó la columna «con ascenso» y queda un solo máximo por plan.</>}
          abrir="Cuánto podés pagar por un cliente de cada plan, y por qué la llamada sale 2 horas y no 1,5"
        >
          <Tabla>
            <Fila head plantilla="minmax(0,1fr) 78px 62px 78px 74px 74px minmax(0,1.3fr)"
              cols={['Plan', 'Contrib./mes', 'Vida', 'LTV', '3:1', 'Payback', 'Gobierna']} />
            {UNIT.map((u) => (
              <Fila key={u.plan} plantilla="minmax(0,1fr) 78px 62px 78px 74px 74px minmax(0,1.3fr)"
                cols={[
                  <span key="p" style={{ fontWeight: u.plan === 'pro' || u.plan === 'proAnual' ? 600 : 400 }}>
                    {u.plan === 'proAnual' ? 'Pro ANUAL' : u.plan}
                  </span>,
                  <Num key="c">{u.contribucionMes === 0 ? '—' : usd(u.contribucionMes)}</Num>,
                  <Num key="v">{u.vidaMeses ? `${num(u.vidaMeses)} m` : '—'}</Num>,
                  <Num key="l">{u.ltvTotal === 0 ? '—' : usd(u.ltvTotal, 0)}</Num>,
                  <Num key="t">{u.cacMax3a1 === 0 ? '—' : usd(u.cacMax3a1, 0)}</Num>,
                  <Num key="y">{u.cacMaxPayback === 0 ? '—' : usd(u.cacMaxPayback, 0)}</Num>,
                  <span key="g" style={{ fontSize: 11.5, color: u.gobierna ? 'var(--ink)' : 'var(--faint)' }}>
                    {u.gobierna
                      ? <><strong>{usd(u.gobierna)}</strong> · {reglaCorta(u.reglaQueGobierna)}</>
                      : 'no se adquiere, se subsidia'}
                  </span>,
                ]} />
            ))}
          </Tabla>
          <Nota>
            <strong>La llamada son 2,0 h y no 1,5</strong>: {LLAMADA.desglose.prep} de preparación,{' '}
            {LLAMADA.desglose.llamada} de llamada y {LLAMADA.desglose.informe} del informe por escrito
            que el guion promete —«te lo llevás digas lo que digas»— y que no estaba contado en ninguna
            hora. Se le regala a TODOS los que compran, asciendan o no.
          </Nota>
          <div style={{ marginTop: 4, padding: 13, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)' }}>
            <Status tono="warn">Y la decisión más grande de la tabla</Status>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>
              {UNIT.find((u) => u.plan === 'proAnual')!.reglaQueGobierna.replace('⚠️ ', '')}
            </div>
          </div>
          <Nota>
            Antes de esto convivían <strong>seis</strong> números para lo mismo —US$104, US$53,
            US$49-97, US$55-70, US$194-381 y los ocho «con y sin ascenso»— y ninguno tenía
            derivación escrita.
          </Nota>
        </Titular>
      </Section>

      <Section titulo="El calendario vende lo mismo con 50 clientes que con 4.011" card>
        <Titular
          valor="24"
          unidad={`de ${miles(869)} llamadas pedidas`}
          tono="warn"
          frase={<>Los cuatro escenarios venden entre 0,8 y 1,5 programas de US$4.000 en 24 meses, con poblaciones de 50 a 4.011 clientes. El SaaS y el 1a1 no compiten por clientes: compiten por la misma hora.</>}
          abrir="Las llamadas servidas contra las pedidas, escenario por escenario"
        >
          <Barras tono="info" datos={barrasLlamadas} />
          <Nota>
            Por eso el ascenso no puede justificar un canal de volumen: te deja pagar más por los
            primeros compradores del mes y por el resto no cambia nada. Y el modo de falla no es el fracaso —
            cuanto mejor funciona, antes satura. El high ticket pasa del 64% de la caja en el
            escenario pesimista al 0,4% en el optimista.
          </Nota>
        </Titular>
      </Section>

      <Section titulo="Nada de esto se va a poder verificar sin tres cosas en el registro" card>
        <Titular
          valor="3"
          unidad="cosas, y son gate"
          tono="warn"
          frase={<>Sin ellas ningún número de esta parte se puede confirmar ni desmentir nunca con datos propios. Van acá y no en el respaldo por eso.</>}
          abrir="Cuáles son, con el archivo donde vive cada una"
        >
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
            {PARA_QUE_ESTO_SE_PUEDA_MEDIR.map((x) => <li key={x} style={{ marginBottom: 7 }}>{x}</li>)}
          </ol>
        </Titular>
      </Section>

      <Parte n="4" />

      {/* ── GRÁFICO 1 ─────────────────────────────────────────────────────── */}
      <Section titulo="Cuanto más barato, peor retiene" card>
        <Nota>
          Retención bruta anual de productos <strong>AI-native</strong>, segmentada por precio
          de lista. Es el benchmark que aplica a MaKo — no el de «SaaS para PyMEs», que mide otra cosa.
        </Nota>
        <Barras datos={barrasRetencion} max={100} tono="bad" />
        <Fuente>{RETENCION_FUENTE}</Fuente>
      </Section>

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
                      {`margen ${num(margen({ ...PLANES[0], precioUsd: pr.netoMensualUsd }, perfil.iaUsd)!, 0)}%`}
                    </Status>
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 9, lineHeight: 1.5 }}>{GANCHO[pr.plan]}</div>
              </div>
            );
          })}
        </div>

        <Eyebrow>Qué entra en cada uno</Eyebrow>
        <Tabla>
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
        </Tabla>

        <div style={{ marginTop: 16, padding: 13, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)' }}>
          <Status tono="warn">Por qué el Growth va en lista de espera</Status>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>{FUERA_DE_GRILLA.growthEnEspera}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ink)' }}>Y tres trampas peores que un ComingSoon</strong>, porque figuran como listo o parcial y se venderían sin querer:
          </div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            {FUERA_DE_GRILLA.trampas.map((t) => (
              <li key={t.que}><strong style={{ color: 'var(--ink)' }}>{t.que}</strong> — {t.por}</li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── TODO EL RESPALDO, PLEGADO ─────────────────────────────────────── */}
      <Parte n="5" />

      {/* ── PARTE 5: EL PLAN ───────────────────────────────────────────────── */}
      {/* Sale de la corrida del 09/08/2026 sobre el plan que el dueño decidió:
          30 usuarios el mes 1, US$1.000 en ads, los 1.000 contactos de su
          agencia, y vender high ticket siempre. 38 fallas auditadas, 14 de
          ellas cambiaban el signo. Detalle en docs/embudo-y-high-ticket.md. */}
      <Section titulo="Los 30 del mes 1 no salen: salen 11" card>
        <Titular
          valor={`${num(PLAN_MES_1.altasCobradas)} de ${PLAN_MES_1.objetivoDueno}`}
          unidad="altas cobradas"
          tono="warn"
          frase={<>Las 19 que faltan <strong>no se compran</strong>: para conseguirlas hay que gastar US$4.686 de pauta, y a ese gasto cada cliente sale {usd(311.6, 0)} — el 171% de lo que podés pagar, midiéndolo con la regla más permisiva que tiene el modelo.</>}
          abrir="La cadena completa, y las tres vías para cerrar la brecha"
        >
          <Barras tono="info" datos={barrasMes1} />
          <Nota>
            <strong>De dónde salen las 11:</strong> {num(PLAN_MES_1.desglose.base)} de tus{' '}
            {miles(BASE_PROPIA.contactos)} contactos ({miles(BASE_PROPIA.contactos)} → {num(BASE_PROPIA.responden * 100, 0)}% responden →{' '}
            {num(BASE_PROPIA.cierran * 100)}% cierran → {num(BASE_PROPIA.aprobacionCobro * 100, 0)}% de aprobación de cobro)
            y {num(PLAN_MES_1.desglose.ads)} de los US$1.000 de pauta. Las dos tasas son tuyas, de{' '}
            <span style={{ fontFamily: MONO }}>Estrategia.tsx</span>.
          </Nota>
          <Tabla>
            <Fila head plantilla="90px minmax(0,1fr)" cols={['Vía', 'Qué pasa si se empuja por ahí']} />
            {[['Con ads', PLAN_MES_1.losQueFaltan.viaAds], ['Con la base', PLAN_MES_1.losQueFaltan.viaBase], ['Con producto', PLAN_MES_1.losQueFaltan.viaProducto]].map(([k, v]) => (
              <Fila key={k} plantilla="90px minmax(0,1fr)" cols={[<strong key="k">{k}</strong>, <span key="v" style={{ fontSize: 12 }}>{v}</span>]} />
            ))}
          </Tabla>
          <div style={{ marginTop: 14, padding: 13, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            {PLAN_MES_1.losQueFaltan.veredicto}
          </div>
          <Fuente>{PLAN_MES_1.gastoAdsQue}</Fuente>
        </Titular>
      </Section>

      <Section titulo="El mes 1 tira 199 interesados a la basura" card>
        <Titular
          valor={miles(PLAN_MES_1.interesadosSinDondeAterrizar)}
          unidad="personas que quieren entrar y no pueden"
          tono="bad"
          frase={<>Los US$1.000 de pauta traen 210 personas y solo {num(PLAN_MES_1.altasCobradas)} pueden entrar. Las otras se pierden porque <strong>hoy no existe el alta pública</strong> — y valen más que la pauta que las trajo.</>}
          abrir="Dónde muere cada una, con el archivo y la línea"
        >
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>{PLAN_MES_1.elHallazgo}</div>
        </Titular>
      </Section>

      <Section titulo="A 24 meses: 160 clientes y US$69.150 de caja, sin poner un peso" nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>ningún mes en rojo · piso {usd(RESULTADO_24.pisoCaja, 0)}</span>} card>
        <Titular
          valor={usd(RESULTADO_24.cajaAcumulada, 0)}
          unidad="de caja acumulada"
          tono="good"
          frase={<>{num(RESULTADO_24.pagosVivos, 0)} clientes pagos y {usd(RESULTADO_24.mrrEquivalente, 0)} de MRR. Lo que pide no son dólares —el capital necesario es cero— son <strong>{num(RESULTADO_24.horasDuenoMax)} horas tuyas el mes 1</strong> y 46-55 por mes, todos los meses.</>}
          abrir="Los 24 meses, mes por mes"
        >
          <Tabla>
            <Fila head plantilla="34px minmax(0,1.5fr) 66px 60px 62px 74px 78px 74px 56px"
              cols={['Mes', 'Qué pasa', 'Pauta', 'Altas', 'Pagos', 'MRR', 'Cobrado', 'Caja', 'Horas']} />
            {PROYECCION_24.map((m) => (
              <Fila key={m.mes} plantilla="34px minmax(0,1.5fr) 66px 60px 62px 74px 78px 74px 56px"
                cols={[
                  <Num key="m">{m.mes}</Num>,
                  <span key="q" style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45 }}>{m.que}</span>,
                  <Num key="g">{m.gastoAds ? usd(m.gastoAds, 0) : '—'}</Num>,
                  <Num key="a">{num(m.altasNuevas)}</Num>,
                  <Num key="p">{num(m.pagosVivos, 0)}</Num>,
                  <Num key="mr">{usd(m.mrrEquivalente, 0)}</Num>,
                  <Num key="c">{usd(m.cobradoMes, 0)}</Num>,
                  <Num key="k"><span style={{ color: m.caja > 0 ? 'var(--good)' : 'var(--bad)' }}>{usd(m.caja, 0)}</span></Num>,
                  <Num key="h">{num(m.horasDueno, 0)} h</Num>,
                ]} />
            ))}
          </Tabla>
          <Nota>
            <strong>El cuello ya no es tu calendario.</strong> {RESULTADO_24.laConclusionQueCambio.replace('⚠️ ', '')}
          </Nota>
          <Plegable titulo="Por qué esto da menos que el panel de agosto" resumen={`de US$143.861 a ${usd(RESULTADO_24.cajaAcumulada, 0)}`}>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>
              {RESULTADO_24.deDondeSaleLaDiferencia.map((x) => <li key={x} style={{ marginBottom: 7 }}>{x}</li>)}
            </ul>
          </Plegable>
          <Plegable titulo="El tope de pauta no es US$5.800" resumen={`${usd(TOPE_PAUTA.bajo3a1.m5a12, 0)} bajo 3:1 · ${usd(TOPE_PAUTA.bajoPayback.m13a24, 0)} bajo payback`}>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>{TOPE_PAUTA.yLoQueNoEsLaPalanca}</div>
          </Plegable>
        </Titular>
      </Section>

      <Section titulo={HIGH_TICKET.nombre} nota={<span style={{ fontSize: 12, color: 'var(--faint)' }}>{usd(HIGH_TICKET.precioUsd, 0)} · {HIGH_TICKET.horasTotales} horas tuyas</span>} card>
        <Titular
          valor={`${HIGH_TICKET.horasTotales} h`}
          unidad={`por programa · ${usd(HIGH_TICKET.precioUsd / HIGH_TICKET.horasTotales, 0)} por hora tuya`}
          frase={<>{HIGH_TICKET.promesa}</>}
          abrir="Qué incluye, qué no, y para quién es"
        >
          <Eyebrow>Los seis renglones de la entrega</Eyebrow>
          <Tabla>
            <Fila head plantilla="minmax(0,1.4fr) 58px minmax(0,1.2fr)" cols={['Qué', 'Horas', 'De dónde sale esa hora']} />
            {HIGH_TICKET.entrega.map((e) => (
              <Fila key={e.que} plantilla="minmax(0,1.4fr) 58px minmax(0,1.2fr)"
                cols={[
                  <strong key="q" style={{ fontSize: 12.5 }}>{e.que}</strong>,
                  <Num key="h">{num(e.horas, 0)}</Num>,
                  <span key="c" style={{ fontSize: 11.5, color: 'var(--faint)' }}>{e.comoSaleLaHora}</span>,
                ]} />
            ))}
            <Fila plantilla="minmax(0,1.4fr) 58px minmax(0,1.2fr)"
              cols={[<strong key="t">Total</strong>, <Num key="h"><strong>{HIGH_TICKET.horasTotales}</strong></Num>, '']} />
          </Tabla>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18, marginTop: 20 }}>
            <div>
              <Eyebrow>Para quién es</Eyebrow>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, marginTop: 6 }}>{HIGH_TICKET.paraQuien}</div>
            </div>
            <div>
              <Eyebrow>Para quién NO</Eyebrow>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, marginTop: 6 }}>{HIGH_TICKET.noEsPara}</div>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <Eyebrow>Qué NO incluye</Eyebrow>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>
              {HIGH_TICKET.noIncluye.map((x) => <li key={x} style={{ marginBottom: 5 }}>{x}</li>)}
            </ul>
          </div>
          <Fuente>{HIGH_TICKET.precioQue}</Fuente>
        </Titular>
      </Section>

      <Section titulo="El anual: 2 meses gratis, y el margen es más fino de lo que parece" card>
        <Titular
          valor="16,7%"
          unidad="de descuento · el límite está en 19,5%"
          frase={<>Ahí el CAC del carrito toca lo máximo que podés pagar y el único canal escalable deja de cerrar. Por eso la respuesta a «hacelo más atractivo» es <strong>agregar cosas, no bajar el precio</strong>.</>}
          abrir="El switch, las cuatro cards y qué se le agrega al anual"
        >
          <div style={{ padding: 15, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)' }}>
            <div style={{ fontFamily: MONO, fontSize: 13, color: 'var(--ink)' }}>{OFERTA_ANUAL.switch.rotulo}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{OFERTA_ANUAL.switch.bajada}</div>
          </div>
          <Tabla>
            <Fila head plantilla="70px 68px 74px 82px 74px" cols={['Plan', 'Mensual', 'Anual', 'Equiv./mes', 'Ahorro']} />
            {OFERTA_ANUAL.planes.map((p) => (
              <Fila key={p.plan} plantilla="70px 68px 74px 82px 74px"
                cols={[
                  <strong key="p">{p.plan}</strong>,
                  <Num key="m">{p.mensualUsd ? usd(p.mensualUsd, 0) : 'Gratis'}</Num>,
                  <Num key="a">{p.anualUsd ? usd(p.anualUsd, 0) : '—'}</Num>,
                  <Num key="e">{p.equivalenteMesUsd ? usd(p.equivalenteMesUsd) : '—'}</Num>,
                  <Num key="h">{p.ahorroUsd ? usd(p.ahorroUsd, 0) : '—'}</Num>,
                ]} />
            ))}
          </Tabla>
          {OFERTA_ANUAL.planes.map((p) => (
            <Plegable key={p.plan} titulo={`Qué lleva el anual del ${p.plan}`} resumen={p.anualUsd ? `${usd(p.anualUsd, 0)}/año` : 'sin anual'}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>{p.extraDelAnual}</div>
            </Plegable>
          ))}
          <Plegable titulo="Las cuatro decisiones del switch" resumen="dónde va, qué muestra, y por qué el mensual nunca se esconde">
            <Tabla>
              <Fila head plantilla="110px minmax(0,1fr)" cols={['Decisión', 'Por qué']} />
              {[['Dónde va', OFERTA_ANUAL.switch.donde], ['Por default', OFERTA_ANUAL.switch.default],
                ['Qué muestra', OFERTA_ANUAL.switch.muestra], ['Innegociable', OFERTA_ANUAL.switch.condicionInnegociable],
                ['«2 meses gratis»', OFERTA_ANUAL.switch.porQueGratis]].map(([k, v]) => (
                <Fila key={k} plantilla="110px minmax(0,1fr)"
                  cols={[<strong key="k" style={{ fontSize: 12 }}>{k}</strong>, <span key="v" style={{ fontSize: 12 }}>{v}</span>]} />
              ))}
            </Tabla>
          </Plegable>
        </Titular>
      </Section>

      <Section titulo="Un cliente Pro cuesta US$10,90 de IA por mes, no US$2,52" card>
        <Titular
          valor={usd(IA_POR_PRO.hoyUsd)}
          unidad="por mes, hoy"
          tono="bad"
          frase={<>El {usd(2.52)} asumía un ruteo barato que <strong>no tiene una sola línea ejecutable</strong> en el repo. Arreglarlo baja el costo a {usd(IA_POR_PRO.conRuteoUsd)} y vale US$15.018 de caja a 24 meses.</>}
          abrir="De dónde sale cada centavo, y cuándo baja"
        >
          <Barras tono="bad" datos={barrasIa} />
          <Nota>{IA_POR_PRO.hoyComo} · Baja en el {IA_POR_PRO.cuandoBaja.toLowerCase()}</Nota>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>{IA_POR_PRO.loQueVale}</div>
        </Titular>
      </Section>

      <Section titulo="Tus 1.000 contactos sí se pueden tocar, pero no como campaña" card>
        <Titular
          valor={num(BASE_PROPIA.altasTotal)}
          unidad="altas de los 1.000"
          frase={<>Haber sido cliente <strong>no es opt-in</strong> — Meta lo excluye textual. Pero eso gobierna la plataforma de negocios: vos escribiendo desde tu número no sos una campaña.</>}
          abrir="Las reglas de ejecución, y el costo real en horas"
        >
          <Tabla>
            <Fila head plantilla="minmax(0,1fr) 70px 70px" cols={['La cadena', 'Mes 1', 'Mes 2']} />
            <Fila plantilla="minmax(0,1fr) 70px 70px" cols={[`${miles(BASE_PROPIA.contactos)} contactos → ${num(BASE_PROPIA.responden * 100, 0)}% responden → ${num(BASE_PROPIA.cierran * 100)}% cierran → ${num(BASE_PROPIA.aprobacionCobro * 100, 0)}% cobra`, <Num key="a">{num(BASE_PROPIA.altasMes1)}</Num>, <Num key="b">{num(BASE_PROPIA.altasMes2)}</Num>]} />
            <Fila plantilla="minmax(0,1fr) 70px 70px" cols={['Lo que te cuesta en horas', <Num key="c">{BASE_PROPIA.horasMes1} h</Num>, <Num key="d">{BASE_PROPIA.horasMes2} h</Num>]} />
          </Tabla>
          <Fuente>Las dos tasas son tuyas: {BASE_PROPIA.respondenFuente}. Y {usd(BASE_PROPIA.costoIaUsd, 0)} de IA para que MaKo escriba los 1.000 mensajes con lo que sabe de cada contacto.</Fuente>
        </Titular>
      </Section>

      <Section titulo="Antes del mes 1 hay un mes 0, y son 12 horas" card>
        <Titular
          valor={`${MES_0.horasDueno} h`}
          unidad="que no venden nada"
          tono="warn"
          frase={<>Tres páginas legales y la aprobación del merchant of record. Sin eso <strong>no cobrás un peso</strong>, y el atajo del link de Stripe está prohibido.</>}
          abrir="Los tres bloqueantes, uno por uno"
        >
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
            {MES_0.bloqueantes.map((x) => <li key={x} style={{ marginBottom: 7 }}>{x}</li>)}
          </ol>
        </Titular>
      </Section>

      <Section titulo="Cinco cosas que no puede decidir ningún modelo" card>
        <Titular
          valor="5"
          unidad="decisiones tuyas"
          tono="warn"
          frase={<>Ordenadas por lo que mueven. La primera vale US$18.370 de caja; la última sigue sin contestar desde la corrida anterior y se cierra en treinta segundos.</>}
          abrir="Cuáles son, con lo que mueve cada una"
        >
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
            {PREGUNTAS_ABIERTAS.map((q) => (
              <li key={q.n} style={{ marginBottom: 12 }}>
                <strong style={{ color: 'var(--ink)' }}>{q.pregunta}</strong>
                <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 3, lineHeight: 1.5 }}>{q.mueve}</div>
                <div style={{ marginTop: 5 }}>{q.porQue}</div>
              </li>
            ))}
          </ol>
        </Titular>
      </Section>

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
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.6 }}>{s.que}</div>
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
          <Tabla>
            <Fila head plantilla="30px minmax(0,3fr) minmax(0,1.4fr)" cols={['#', 'Qué', 'Dónde vive']} />
            {ORDEN_DE_TRABAJO.map((o) => (
              <Fila key={o.n} plantilla="30px minmax(0,3fr) minmax(0,1.4fr)"
                cols={[<Num key="n">{o.n}</Num>, o.que,
                  <span key="v" style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{o.vive}</span>]} />
            ))}
          </Tabla>
        </Plegable>

        <Plegable titulo="⚠️ Los huecos bloqueantes" resumen={`${HUECOS.length} cosas que frenan el primer cobro`}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>
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
              <Tabla>
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
              </Tabla>
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
          <Tabla>
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
          </Tabla>
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
              <Tabla>
                <Fila head plantilla="minmax(0,1.8fr) 90px 90px" cols={['Acción', 'Costo', 'Barata']} />
                {ACCIONES_NUEVAS.filter((a) => a.familia === fam).map((a) => (
                  <Fila key={a.id} plantilla="minmax(0,1.8fr) 90px 90px"
                    cols={[
                      <span key="n" style={{ fontWeight: a.usdBarato !== undefined ? 600 : 400 }}>{a.label}</span>,
                      <Num key="c">{a.usd === 0 ? 'gratis' : `${usd(a.usd, 4)}`}</Num>,
                      <Num key="b">{a.usdBarato !== undefined ? `${usd(a.usdBarato, 4)}` : '—'}</Num>,
                    ]} />
                ))}
              </Tabla>
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
              <Tabla>
                <Fila head plantilla="minmax(0,2fr) 80px 100px 90px" cols={['Proceso', 'Llamadas', 'Tokens', 'Costo']} />
                {data.porFeature.slice(0, 10).map((f) => (
                  <Fila key={f.clave} plantilla="minmax(0,2fr) 80px 100px 90px"
                    cols={[f.clave, <Num key="l">{miles(f.llamadas)}</Num>, <Num key="t">{miles(f.tokens)}</Num>, <Num key="c">{f.costUsd > 0 ? usd(f.costUsd) : '—'}</Num>]} />
                ))}
              </Tabla>
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
          <Tabla>
            <Fila head plantilla="minmax(0,1.7fr) 90px 110px" cols={['Acción', 'Costo real', 'Llamadas pagas']} />
            {ACCIONES.map((a) => (
              <Fila key={a.id} plantilla="minmax(0,1.7fr) 90px 110px"
                cols={[
                  <span key="n">{a.label} {a.automatico && <Status tono="warn">solo</Status>}</span>,
                  <Num key="c">{usd(costoUnitario(a), 4)}</Num>,
                  <Num key="l">{miles(a.llamadasPagas)}</Num>,
                ]} />
            ))}
          </Tabla>
        </Plegable>

        <Plegable titulo="La IA que se dispara sola" resumen="6 caminos que gastan sin que el usuario entre — la bomba del Free">
          <Nota>{EL_ACCIDENTE}</Nota>
          <Tabla>
            <Fila head plantilla="minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1.3fr)" cols={['Camino', 'Lo dispara', 'Proyección']} />
            {AUTOMATICOS.map((a) => (
              <Fila key={a.id} plantilla="minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1.3fr)"
                cols={[a.label,
                  <span key="d" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{a.disparador}</span>,
                  <span key="p" style={{ fontSize: 11.5, color: a.techo === 'ninguno' ? 'var(--bad)' : 'var(--muted)' }}>{a.proyeccion}</span>]} />
            ))}
          </Tabla>
        </Plegable>

        <Plegable titulo="Lo que va a costar lo que todavía no existe" resumen="video, imagen y voz — con tres modelos que ya tienen fecha de apagado">
          {([['Video', VIDEO], ['Imagen', IMAGEN], ['Voz', AUDIO]] as const).map(([t, lista]) => (
            <div key={t} style={{ marginBottom: 16 }}>
              <Eyebrow>{t}</Eyebrow>
              <Tabla>
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
              </Tabla>
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
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 4px', lineHeight: 1.55 }}>{d.que}</p>
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
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 4px', lineHeight: 1.55 }}>{d.que}</p>
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
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '5px 0 4px 22px', lineHeight: 1.55 }}>{b.que}</p>
              <div style={{ marginLeft: 22, fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{b.vive}</div>
            </div>
          ))}
        </Plegable>

      </Section>
    </>
  );
}
