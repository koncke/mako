'use client';

// =============================================================================
// Grafo — el mapa del segundo cerebro: lo que MaKo entendió del negocio
// =============================================================================
// Tres decisiones que no son de gusto y conviene no revertir sin leer esto:
//
// 1. LAYOUT DETERMINISTA, NO SIMULACIÓN DE FUERZAS. Las posiciones se calculan
//    con trigonometría a partir del área y del índice del nodo: mismas entradas,
//    mismas coordenadas, siempre. Un force layout resuelve un problema que acá no
//    existe (no hay que descubrir la estructura: el negocio YA tiene diez áreas)
//    y trae tres bugs conocidos de regalo — identidad de objetos mutados entre
//    renders, arranque en frío por alpha(1) y temblor permanente en reposo. Ese
//    temblor además viola la regla de la casa de no dejar animación decorativa
//    indefinida. Sin física tampoco hay nada que arrastrar, y eso es deliberado:
//    un mapa que se puede desordenar deja de ser un registro y pasa a ser un
//    juguete. Costo de esta decisión: 0 KB de dependencias.
//
// 2. EL COLOR DICE **QUIÉN**, NO QUÉ. Un borde de 3 px dorado = lo dedujo MaKo;
//    borde neutro = lo escribiste tú; punteado = todavía no existe. Es la misma
//    gramática del filo izquierdo de `.mk-mako` en ui.css («fondos de color
//    distinto son una bolsa de caramelos; un filo de 3 px alcanza»). Diez colores
//    por área serían justamente esa bolsa, y encima taparían el único dato que
//    hace honesto al mapa. Rellenos de color hay exactamente dos en todo el
//    lienzo, y los dos significan algo: el Norte (dorado) y el cuello (naranja).
//
// 3. LAS ETIQUETAS SE ANCLAN POR LADO. En la mitad izquierda del círculo el texto
//    termina en el nodo, en la derecha empieza en él; si no, el texto se cruza
//    encima del grafo y a los 40 nodos no se lee ninguno. El halo blanco
//    (paint-order: stroke) es lo que lo mantiene legible sobre las aristas.
// =============================================================================

import { useMemo, useState, useId } from 'react';
// Del modelo PURO, nunca de `cerebro-grafo`: ése lleva `server-only` y arrastra
// la cadena entera de auth al bundle del browser. Ver lib/cerebro-modelo.ts.
import { AREAS, type Cerebro, type NodoCerebro, type AreaId } from '@/lib/cerebro-modelo';

// El lienzo es un cuadrado con el negocio en el centro. Coordenadas en unidades
// de viewBox: el SVG escala solo y nunca hay que medir el DOM.
const LADO = 1000;
const C = LADO / 2;
// Los anillos: hasta 3 nodos en el primero, 5 en el segundo, y de ahí 7 por fila.
const CUPOS = [3, 5, 7, 9, 11];
const R0 = 205;
const DR = 92;

type Pos = {
  x: number; y: number; ang: number;
  /** Dónde va la etiqueta. NO es siempre `y`: ver `descongestionar`. */
  ly: number;
  /** false = la etiqueta se pisaba con otra y no se dibuja hasta el hover. */
  visible: boolean;
};

// Medidas de la etiqueta, aproximadas pero suficientes para detectar choques: a
// 11.5 px, un carácter promedio ocupa ~5,6 px de ancho y la línea ~13 px de alto.
const CHAR = 5.6;
const ALTO = 13;
/** Cuánto se puede correr una etiqueta de su nodo antes de que deje de leerse como
 *  suya. Más que esto y el texto parece de otro punto: mejor esconderla. */
const CORRIMIENTO_MAX = 22;

/** El ángulo del sector de cada área, arrancando arriba y girando como el reloj. */
const anguloArea = (i: number): number => -90 + (i * 360) / AREAS.length;

/**
 * Las posiciones. Determinista y sin estado: es una función pura del área y del
 * índice del nodo dentro de su área, así que dos renders con los mismos nodos dan
 * exactamente el mismo dibujo y nada salta al agregar uno nuevo.
 */
function disponer(nodos: NodoCerebro[]): Map<string, Pos> {
  const pos = new Map<string, Pos>();
  pos.set('raiz', { x: C, y: C, ang: 0, ly: C, visible: true });

  const porArea = new Map<AreaId, NodoCerebro[]>();
  for (const n of nodos) {
    if (n.id === 'raiz') continue;
    const lista = porArea.get(n.area) ?? [];
    lista.push(n);
    porArea.set(n.area, lista);
  }

  AREAS.forEach((area, ai) => {
    const lista = porArea.get(area.id) ?? [];
    const base = anguloArea(ai);

    // Repartir en filas según los cupos, y quedarse con cuántos cayeron en cada una:
    // el abanico se centra sobre los que HAY, no sobre el cupo, o una fila a medio
    // llenar queda pegada a un costado del sector.
    const filas: NodoCerebro[][] = [];
    let resto = lista.slice();
    let f = 0;
    while (resto.length) {
      const cupo = CUPOS[Math.min(f, CUPOS.length - 1)];
      filas.push(resto.slice(0, cupo));
      resto = resto.slice(cupo);
      f++;
    }

    filas.forEach((fila, fi) => {
      const radio = R0 + fi * DR;
      // La apertura crece con el anillo (más lejos, más lugar) pero se topea antes
      // de invadir el sector vecino: 360/10 = 36°, así que 30 deja aire de sobra.
      const apertura = Math.min(30, 20 + fi * 5);
      const paso = fila.length > 1 ? apertura / (fila.length - 1) : 0;
      fila.forEach((n, i) => {
        const ang = base + (fila.length > 1 ? -apertura / 2 + i * paso : 0);
        const rad = (ang * Math.PI) / 180;
        const x = C + radio * Math.cos(rad);
        const y = C + radio * Math.sin(rad);
        pos.set(n.id, { x, y, ang, ly: y, visible: true });
      });
    });
  });

  descongestionar(nodos, pos);
  return pos;
}

/**
 * Separa las etiquetas que se pisan. Hace falta porque en un layout radial dos
 * nodos de ANILLOS distintos pueden caer casi a la misma altura —el de adentro
 * más abierto en ángulo, el de afuera más cerrado— y ahí sus textos se montan uno
 * sobre otro. Medido sobre un cliente real: 7 choques en 39 etiquetas.
 *
 * Mueve solo la ETIQUETA, nunca el nodo: el punto es el dato y su posición
 * significa a qué área pertenece. Y si correrla no alcanza, la esconde en vez de
 * dejarla lejos de su punto — una etiqueta a 40 px parece de otro nodo, que es
 * peor que no tenerla. El hover la muestra igual.
 *
 * Determinista: mismo orden de entrada, mismo resultado. No hay iteración hasta
 * converger ni azar, así que dos renders dibujan exactamente lo mismo.
 */
function descongestionar(nodos: NodoCerebro[], pos: Map<string, Pos>): void {
  type Caja = { id: string; x0: number; x1: number; p: Pos };
  // Cada lado se resuelve por separado: un texto anclado a la derecha nunca se
  // cruza con uno anclado a la izquierda del otro extremo del círculo.
  for (const lado of [-1, 1]) {
    const cajas: Caja[] = [];
    for (const n of nodos) {
      const p = pos.get(n.id);
      if (!p || n.id === 'raiz') continue;
      const izq = Math.cos((p.ang * Math.PI) / 180) < 0;
      if ((izq ? -1 : 1) !== lado) continue;
      const w = n.etiqueta.length * CHAR;
      const x = izq ? p.x - 14 : p.x + 14;
      cajas.push({ id: n.id, x0: izq ? x - w : x, x1: izq ? x : x + w, p });
    }
    cajas.sort((a, b) => a.p.ly - b.p.ly);

    for (let i = 1; i < cajas.length; i++) {
      const prev = cajas[i - 1];
      const cur = cajas[i];
      if (!prev.p.visible) continue;
      const cruzanEnX = Math.min(prev.x1, cur.x1) - Math.max(prev.x0, cur.x0) > 2;
      const separacion = cur.p.ly - prev.p.ly;
      if (!cruzanEnX || separacion >= ALTO) continue;
      const necesita = ALTO - separacion;
      if (Math.abs(cur.p.ly + necesita - cur.p.y) <= CORRIMIENTO_MAX) cur.p.ly += necesita;
      else cur.p.visible = false;
    }
  }
}

/** Curva suave entre dos nodos: el punto de control se corre hacia el centro, así
 *  las aristas que cruzan sectores se arquean en vez de atravesar el dibujo en
 *  línea recta. Es el truco barato de agrupar aristas, sin librería. */
function curva(a: Pos, b: Pos): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const cx = mx + (C - mx) * 0.22;
  const cy = my + (C - my) * 0.22;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

const radioNodo = (n: NodoCerebro): number => {
  if (n.id === 'raiz') return 15;
  if (n.destacado || n.alerta) return 10;
  if (n.autoria === 'pendiente') return 6;
  return 7.5;
};

export function Grafo({ cerebro }: { cerebro: Cerebro }) {
  const uid = `cbg-${useId().replace(/[:»]/g, '')}`;
  const [activo, setActivo] = useState<string | null>(null);
  const [fijado, setFijado] = useState<string | null>(null);
  const [areaFoco, setAreaFoco] = useState<AreaId | null>(null);

  const { nodos, aristas, cuenta } = cerebro;
  const pos = useMemo(() => disponer(nodos), [nodos]);
  const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos]);

  // Los vecinos de cada nodo, para poder atenuar todo lo demás al pasar por encima.
  const vecinos = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => { const s = m.get(a) ?? new Set(); s.add(b); m.set(a, s); };
    for (const e of aristas) { add(e.de, e.a); add(e.a, e.de); }
    return m;
  }, [aristas]);

  const sel = fijado ?? activo;
  const nodoSel = sel ? porId.get(sel) ?? null : null;
  const cerca = useMemo(() => (sel ? new Set([sel, ...(vecinos.get(sel) ?? [])]) : null), [sel, vecinos]);

  // Un nodo está apagado si hay una selección y no es vecino, o si hay un área en
  // foco y no pertenece. La raíz nunca se apaga: es el ancla de lectura del mapa.
  const apagado = (n: NodoCerebro): boolean => {
    if (n.id === 'raiz') return false;
    if (cerca) return !cerca.has(n.id);
    if (areaFoco) return n.area !== areaFoco;
    return false;
  };

  const areaDe = (id: AreaId) => AREAS.find((a) => a.id === id)!;

  return (
    <div className={uid}>
      <style>{`
        .${uid} { --cbg-mako: var(--mako); --cbg-linea: var(--border-strong); }
        .${uid} .cbg-nodo { cursor: pointer; }
        .${uid} .cbg-nodo circle { transition: opacity .18s ease, r .18s ease; }
        .${uid} .cbg-nodo text { transition: opacity .18s ease; }
        .${uid} .cbg-arista { transition: opacity .18s ease, stroke .18s ease; }
        .${uid} .cbg-rot { font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; fill: var(--faint); }
        .${uid} .cbg-et { font-size: 11.5px; fill: var(--dim); paint-order: stroke; stroke: var(--surface); stroke-width: 3.5px; stroke-linejoin: round; }
        .${uid} .cbg-et-fuerte { fill: var(--ink); font-weight: 600; }
        .${uid} .cbg-entra { animation: cbg-in .5s cubic-bezier(.23,1,.32,1) backwards; }
        @keyframes cbg-in { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .${uid} .cbg-entra { animation: none; }
          .${uid} .cbg-nodo circle, .${uid} .cbg-nodo text, .${uid} .cbg-arista { transition: none; }
        }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 20, alignItems: 'start' }} className="cbg-cols">
        {/* ── El lienzo ───────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <svg
            viewBox={`0 0 ${LADO} ${LADO}`}
            style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: '1 / 1' }}
            role="img"
            aria-label={`Mapa del segundo cerebro: ${cuenta.total} cosas que MaKo entendió de tu negocio`}
            onClick={() => setFijado(null)}
          >
            {/* Los rótulos de área, en el borde exterior de su sector. Van primero
                para que cualquier nodo quede por encima. */}
            {AREAS.map((a, i) => {
              const ang = (anguloArea(i) * Math.PI) / 180;
              const r = 470;
              const x = C + r * Math.cos(ang);
              const y = C + r * Math.sin(ang);
              const izq = Math.cos(ang) < -0.15;
              const centro = Math.abs(Math.cos(ang)) <= 0.15;
              return (
                <text
                  key={a.id}
                  className="cbg-rot"
                  x={x}
                  y={y}
                  textAnchor={centro ? 'middle' : izq ? 'end' : 'start'}
                  dominantBaseline="middle"
                  style={{ fill: areaFoco === a.id ? 'var(--mako-ink)' : undefined, cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); setAreaFoco(areaFoco === a.id ? null : a.id); }}
                >
                  {a.nombre}
                </text>
              );
            })}

            {/* Aristas */}
            <g fill="none">
              {aristas.map((e, i) => {
                const a = pos.get(e.de);
                const b = pos.get(e.a);
                if (!a || !b) return null;
                const viva = cerca ? cerca.has(e.de) && cerca.has(e.a) : true;
                const na = porId.get(e.a);
                const punteada = na?.autoria === 'pendiente';
                return (
                  <path
                    key={`${e.de}-${e.a}-${i}`}
                    className="cbg-arista"
                    d={curva(a, b)}
                    stroke={viva && cerca ? 'var(--mako-ink)' : 'var(--cbg-linea)'}
                    strokeWidth={viva && cerca ? 1.6 : 1}
                    strokeDasharray={punteada ? '3 5' : undefined}
                    opacity={cerca ? (viva ? 0.9 : 0.12) : areaFoco ? (na?.area === areaFoco ? 0.7 : 0.12) : 0.5}
                  />
                );
              })}
            </g>

            {/* Nodos */}
            {nodos.map((n, i) => {
              const p = pos.get(n.id);
              if (!p) return null;
              const off = apagado(n);
              const r = radioNodo(n);
              const esSel = sel === n.id;
              const izq = Math.cos((p.ang * Math.PI) / 180) < 0 && n.id !== 'raiz';

              // Relleno y borde. Solo dos rellenos de color en todo el mapa, y los
              // dos significan algo: el Norte y el cuello.
              let fill = 'var(--surface)';
              let stroke = 'var(--border-strong)';
              let sw = 2;
              if (n.id === 'raiz') { fill = 'var(--sidebar)'; stroke = 'var(--sidebar)'; sw = 0; }
              else if (n.destacado) { fill = 'var(--mako)'; stroke = 'var(--mako-ink)'; sw = 2; }
              else if (n.alerta) { fill = 'var(--warn-bg)'; stroke = 'var(--warn-fill)'; sw = 2.5; }
              else if (n.autoria === 'mako') { stroke = 'var(--mako)'; sw = 3; }
              else if (n.autoria === 'pendiente') { fill = 'transparent'; stroke = 'var(--faint)'; sw = 1.5; }

              return (
                <g
                  key={n.id}
                  className={`cbg-nodo cbg-entra`}
                  style={{ animationDelay: `${Math.min(i * 22, 900)}ms`, transformOrigin: `${p.x}px ${p.y}px` }}
                  onMouseEnter={() => setActivo(n.id)}
                  onMouseLeave={() => setActivo(null)}
                  onClick={(e) => { e.stopPropagation(); setFijado(fijado === n.id ? null : n.id); }}
                >
                  {/* Área de toque generosa: el punto mide 7 px y el dedo no. */}
                  <circle cx={p.x} cy={p.y} r={Math.max(r + 12, 22)} fill="transparent" />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={esSel ? r + 2.5 : r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                    strokeDasharray={n.autoria === 'pendiente' ? '3 3' : undefined}
                    opacity={off ? 0.15 : 1}
                  />
                  {/* Una etiqueta escondida por choque vuelve al pasar por encima o
                      al fijar el nodo: el dato no se pierde, solo deja de competir. */}
                  {(p.visible || esSel || activo === n.id) && (
                    <text
                      className={`cbg-et${n.id === 'raiz' || n.destacado || n.alerta ? ' cbg-et-fuerte' : ''}`}
                      x={n.id === 'raiz' ? p.x : izq ? p.x - r - 6 : p.x + r + 6}
                      y={n.id === 'raiz' ? p.y + r + 16 : p.ly}
                      textAnchor={n.id === 'raiz' ? 'middle' : izq ? 'end' : 'start'}
                      dominantBaseline="middle"
                      opacity={off ? 0.12 : 1}
                    >
                      {n.etiqueta}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── El lector ───────────────────────────────────────────────────── */}
        {/* Panel fijo, no tooltip flotante: un tooltip de 300 px al lado del cursor
            se sale del lienzo en los nodos del borde y tapa justo lo que se estaba
            mirando. Acá el texto siempre aparece en el mismo lugar. */}
        <aside style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, minHeight: 190 }}>
            {nodoSel ? (
              <>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
                  {areaDe(nodoSel.area).nombre}
                </div>
                <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 8 }}>
                  {nodoSel.etiqueta}
                </div>
                <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                  {nodoSel.detalle}
                </p>
                {nodoSel.fuente && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)' }}>
                    {nodoSel.fuente}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)', marginBottom: 8 }}>
                  MaKo entendió {cuenta.total} {cuenta.total === 1 ? 'cosa' : 'cosas'} de tu negocio
                </div>
                <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
                  {cuenta.mako} las dedujo de tus documentos y tus cuentas conectadas. {cuenta.usuario} las escribiste tú.
                  {cuenta.pendientes > 0 && ` Quedan ${cuenta.pendientes} ${cuenta.pendientes === 1 ? 'área' : 'áreas'} sin construir.`}
                </p>
                <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--faint)', lineHeight: 1.55 }}>
                  Pasa el cursor por un punto para leerlo. Haz clic para fijarlo.
                </p>
              </>
            )}
          </div>

          {/* La leyenda ES el control: cada fila enfoca su área. */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
            <Leyenda />
          </div>
        </aside>
      </div>

      {/* Una sola media query, del lado del contenedor: en mobile el lector baja
          debajo del lienzo en vez de comprimirlo a una columna ilegible. */}
      <style>{`
        @media (max-width: 900px) {
          .${uid} .cbg-cols { grid-template-columns: minmax(0,1fr) !important; }
          .${uid} .cbg-cols > aside { position: static !important; }
        }
      `}</style>
    </div>
  );
}

function Leyenda() {
  const fila = (nodo: React.ReactNode, texto: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
      <svg width={18} height={18} viewBox="0 0 18 18" style={{ flex: 'none' }}>{nodo}</svg>
      {texto}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {fila(<circle cx={9} cy={9} r={5.5} fill="var(--surface)" stroke="var(--mako)" strokeWidth={3} />, 'Lo dedujo MaKo')}
      {fila(<circle cx={9} cy={9} r={5.5} fill="var(--surface)" stroke="var(--border-strong)" strokeWidth={2} />, 'Lo escribiste tú')}
      {fila(<circle cx={9} cy={9} r={5} fill="transparent" stroke="var(--faint)" strokeWidth={1.5} strokeDasharray="3 3" />, 'Todavía no existe')}
      {fila(<circle cx={9} cy={9} r={6} fill="var(--mako)" stroke="var(--mako-ink)" strokeWidth={2} />, 'Tu Norte')}
      {fila(<circle cx={9} cy={9} r={6} fill="var(--warn-bg)" stroke="var(--warn-fill)" strokeWidth={2.5} />, 'Lo que te frena')}
    </div>
  );
}
