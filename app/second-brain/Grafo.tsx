'use client';

// =============================================================================
// Grafo — el mapa del segundo cerebro: lo que MaKo entendió del negocio
// =============================================================================
// El lenguaje visual es el de Obsidian, y no de oído: los parámetros salieron de
// leer su worker de física (publish.obsidian.md/sim.js, que es un build de d3-force)
// y su renderer. De ahí vienen el fade de etiquetas por zoom, la atenuación a 0,20
// al pasar el cursor, el grosor de arista constante en píxeles de pantalla y el
// radio que "resiste" el zoom out (r · √k).
//
// LAS POSICIONES NO SE CALCULAN ACÁ. Vienen del servidor, ya asentadas
// (lib/cerebro-layout.ts). Este componente dibuja y navega, nada más. Es lo que
// mantiene d3-force fuera del bundle del browser.
//
// TRES REGLAS QUE SE ROMPEN SOLAS SI NO SE SABEN:
//
//  1. El transform del zoom NO va como prop de JSX. Va con setAttribute sobre un ref
//     adentro de un rAF. Si además se renderiza como prop, el próximo render de React
//     lo pisa con el valor viejo del vdom y el mapa salta hacia atrás. Lo único que
//     entra a useState es `kPaso` (la escala redondeada a cuartos), que cambia ~15
//     veces en todo el recorrido del zoom y no 60 por segundo.
//  2. `onWheel` de JSX NO puede preventDefault: react-dom 19 registra `wheel`,
//     `touchstart` y `touchmove` con { passive: true }. Sin un addEventListener propio
//     con { passive: false }, el zoom anda Y la página scrollea al mismo tiempo.
//  3. Una etiqueta apagada por el nivel de detalle NO se renderiza. `opacity: 0` en
//     SVG no ahorra nada: el nodo sigue costando layout igual que si se viera.
// =============================================================================

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { AREAS, type Cerebro, type NodoCerebro, type AreaId, type Punto } from '@/lib/cerebro-modelo';
import { MONO } from '@/app/_ui/tokens';

// ── Constantes de navegación ─────────────────────────────────────────────────
const K_MIN = 0.5;
const K_MAX = 4;
/** Umbral de clic vs arrastre, en px de pantalla al cuadrado (5 px, como Obsidian). */
const ARRASTRE2 = 25;
/** La `Rl` de Obsidian: cuánto se apaga lo que no es vecino del nodo en foco. */
const ATENUADO = 0.2;
const ATENUADO_ARISTA = 0.1;

type Vista = { k: number; x: number; y: number };

// ── Radio, en unidades de mundo ──────────────────────────────────────────────
// Misma fórmula que usa el layout del servidor para la colisión: si divergen, los
// nodos se pisan o dejan huecos. No se copia el `max(8, min(3√(g+1), 30))` de
// Obsidian porque es plano hasta grado 6 y acá dejaría el 95% del mapa igual.
const radioBase = (n: NodoCerebro): number =>
  n.id === 'raiz' ? 9 : n.destacado || n.alerta ? 6.5 : n.autoria === 'pendiente' ? 3.5 : 4.5;

const radioMundo = (n: NodoCerebro, grado: number): number =>
  radioBase(n) + Math.min(3, 0.9 * Math.sqrt(Math.max(0, grado - 1)));

/** Qué tan "importante" es un nodo, para decidir a quién le toca etiqueta cuando no
 *  entran todas. En un grafo, importante = muy conectado. */
const PESO_AUTORIA: Record<NodoCerebro['autoria'], number> = { mako: 2, usuario: 1.5, pendiente: 0.5 };
const importancia = (n: NodoCerebro, grado: number): number =>
  n.id === 'raiz' ? 1e6 : n.destacado || n.alerta ? 1e5 : (2 + Math.sqrt(grado)) * PESO_AUTORIA[n.autoria];

export function Grafo({ cerebro }: { cerebro: Cerebro }) {
  const { nodos, aristas, cuenta, posiciones, encuadre } = cerebro;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const vista = useRef<Vista>({ k: 1, x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const [kPaso, setKPaso] = useState(1);
  const [activo, setActivo] = useState<string | null>(null);
  const [fijado, setFijado] = useState<string | null>(null);
  const [areaFoco, setAreaFoco] = useState<AreaId | null>(null);

  const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos]);

  const grados = useMemo(() => {
    const g: Record<string, number> = {};
    for (const n of nodos) g[n.id] = 0;
    for (const a of aristas) { if (a.de in g) g[a.de]++; if (a.a in g) g[a.a]++; }
    return g;
  }, [nodos, aristas]);

  const vecinos = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => { const s = m.get(a) ?? new Set<string>(); s.add(b); m.set(a, s); };
    for (const e of aristas) { add(e.de, e.a); add(e.a, e.de); }
    return m;
  }, [aristas]);

  const sel = fijado ?? activo;
  const nodoSel = sel ? porId.get(sel) ?? null : null;
  const cerca = useMemo(() => (sel ? new Set([sel, ...(vecinos.get(sel) ?? [])]) : null), [sel, vecinos]);

  // ── El centroide de cada área: ahí va su rótulo ────────────────────────────
  // Antes los rótulos vivían en un anillo exterior fijo, que era una pista de que el
  // layout era radial. Ahora el rótulo va donde de verdad quedó el racimo.
  const rotulos = useMemo(() => {
    const acc = new Map<AreaId, { x: number; y: number; n: number }>();
    for (const n of nodos) {
      if (n.id === 'raiz') continue;
      const p = posiciones[n.id];
      if (!p) continue;
      const a = acc.get(n.area) ?? { x: 0, y: 0, n: 0 };
      a.x += p.x; a.y += p.y; a.n++;
      acc.set(n.area, a);
    }
    // Un área con UN solo nodo no lleva rótulo: el rótulo y la etiqueta del nodo se
    // pisarían y dirían casi lo mismo.
    return AREAS.filter((a) => (acc.get(a.id)?.n ?? 0) >= 2)
      .map((a) => { const c = acc.get(a.id)!; return { ...a, x: c.x / c.n, y: c.y / c.n }; });
  }, [nodos, posiciones]);

  // ── Nivel de detalle de las etiquetas ──────────────────────────────────────
  // Obsidian usa solo un umbral de zoom, que alcanza con 50 notas. Acá el presupuesto
  // crece con k² (al duplicar el zoom se ve un cuarto del área) y se reparte por
  // importancia, así que a cualquier zoom se lee lo que más pesa y nunca hay 300
  // etiquetas encima. El hover SIEMPRE gana: es lo que hace Obsidian.
  const etiquetas = useMemo(() => {
    const forzadas = new Set<string>(['raiz']);
    for (const n of nodos) if (n.destacado || n.alerta) forzadas.add(n.id);
    if (sel) { forzadas.add(sel); for (const v of vecinos.get(sel) ?? []) forzadas.add(v); }

    const presupuesto = Math.min(Math.max(Math.round(10 * kPaso * kPaso), 6), nodos.length);
    const rank = [...nodos]
      .filter((n) => !forzadas.has(n.id))
      .sort((a, b) => importancia(b, grados[b.id] ?? 0) - importancia(a, grados[a.id] ?? 0));

    const visibles = new Set(forzadas);
    for (const n of rank) {
      if (visibles.size >= presupuesto + forzadas.size) break;
      if (areaFoco && n.area !== areaFoco) continue;
      visibles.add(n.id);
    }

    // Descongestión en coordenadas de PANTALLA: dos nodos separados en el mundo se
    // pisan igual si el zoom los junta. Una sola pasada, ordenada por y.
    const cajas = [...visibles]
      .map((id) => ({ id, n: porId.get(id)!, p: posiciones[id] }))
      .filter((c) => c.n && c.p)
      .map((c) => {
        const w = (c.n.etiqueta.length * 5.4) / kPaso;    // ancho en unidades de mundo
        const r = radioMundo(c.n, grados[c.id] ?? 0) / Math.sqrt(kPaso);
        return { id: c.id, x: c.p.x, y: c.p.y + r + 11 / kPaso, w, base: c.p.y + r + 11 / kPaso };
      })
      .sort((a, b) => a.y - b.y);

    const alto = 13 / kPaso;
    const tope = 22 / kPaso;
    const fuera = new Set<string>();
    for (let i = 1; i < cajas.length; i++) {
      const prev = cajas[i - 1];
      const cur = cajas[i];
      if (fuera.has(prev.id)) continue;
      const cruzanX = Math.min(prev.x + prev.w / 2, cur.x + cur.w / 2) - Math.max(prev.x - prev.w / 2, cur.x - cur.w / 2) > 0;
      const sep = cur.y - prev.y;
      if (!cruzanX || sep >= alto) continue;
      const necesita = alto - sep;
      if (cur.y + necesita - cur.base <= tope) cur.y += necesita;
      else if (!forzadas.has(cur.id)) fuera.add(cur.id);
    }
    const ys = new Map(cajas.map((c) => [c.id, c.y]));
    for (const id of fuera) visibles.delete(id);
    return { visibles, ys };
  }, [nodos, sel, vecinos, kPaso, areaFoco, grados, posiciones, porId]);

  // ── Zoom y pan ─────────────────────────────────────────────────────────────
  const aplicar = useCallback(() => {
    rafRef.current = null;
    const g = gRef.current;
    if (!g) return;
    const v = vista.current;
    g.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.k})`);
    g.style.setProperty('--k', String(v.k));
    const paso = Math.round(v.k * 4) / 4;
    setKPaso((prev) => (prev === paso ? prev : paso));
  }, []);

  const pedirPintado = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(aplicar);
  }, [aplicar]);

  /** Un punto de pantalla a coordenadas del viewBox. `getScreenCTM` fuerza layout, así
   *  que se llama una vez por gesto y no por frame. */
  const aMundo = useCallback((cx: number, cy: number): Punto | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = svg.createSVGPoint();
    p.x = cx; p.y = cy;
    const q = p.matrixTransform(ctm.inverse());
    return { x: q.x, y: q.y };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // { passive: false } es obligatorio: el onWheel de React no puede preventDefault.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = aMundo(e.clientX, e.clientY);
      if (!pt) return;
      const unidad = e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002;
      const factor = Math.pow(2, -e.deltaY * unidad * (e.ctrlKey ? 10 : 1));
      const v = vista.current;
      const k = Math.min(K_MAX, Math.max(K_MIN, v.k * factor));
      // La invariante del zoom anclado: el punto del mundo bajo el cursor no se mueve.
      const mx = (pt.x - v.x) / v.k;
      const my = (pt.y - v.y) / v.k;
      vista.current = { k, x: pt.x - mx * k, y: pt.y - my * k };
      pedirPintado();
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [aMundo, pedirPintado]);

  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const arrastre = useRef<{ x0: number; y0: number; vx: number; vy: number; movido: boolean } | null>(null);
  const pellizco = useRef<{ d0: number; k0: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 1) {
      const v = vista.current;
      arrastre.current = { x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, movido: false };
    } else if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      pellizco.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: vista.current.k };
      arrastre.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pellizco.current && punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const medio = aMundo((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (!medio) return;
      const v = vista.current;
      const k = Math.min(K_MAX, Math.max(K_MIN, pellizco.current.k0 * (d / pellizco.current.d0)));
      const mx = (medio.x - v.x) / v.k;
      const my = (medio.y - v.y) / v.k;
      vista.current = { k, x: medio.x - mx * k, y: medio.y - my * k };
      pedirPintado();
      return;
    }

    const arr = arrastre.current;
    if (!arr) return;
    const dx = e.clientX - arr.x0;
    const dy = e.clientY - arr.y0;
    if (!arr.movido && dx * dx + dy * dy <= ARRASTRE2) return;
    arr.movido = true;
    // El desplazamiento se convierte a unidades de mundo con la escala del viewBox.
    const svg = svgRef.current;
    const caja = svg?.getBoundingClientRect();
    if (!caja) return;
    const escala = encuadre.lado / caja.width;
    vista.current = { ...vista.current, x: arr.vx + dx * escala, y: arr.vy + dy * escala };
    pedirPintado();
  };

  const soltar = (e: React.PointerEvent<SVGSVGElement>) => {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) pellizco.current = null;
    if (punteros.current.size === 0) {
      // Un arrastre no deselecciona; un clic en el vacío sí.
      if (arrastre.current && !arrastre.current.movido) setFijado(null);
      arrastre.current = null;
    }
  };

  const clicNodo = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (arrastre.current?.movido) return;
    setFijado((f) => (f === id ? null : id));
  };

  const apagado = (n: NodoCerebro): boolean => {
    if (n.id === 'raiz') return false;
    if (cerca) return !cerca.has(n.id);
    if (areaFoco) return n.area !== areaFoco;
    return false;
  };

  const areaDe = (id: AreaId) => AREAS.find((a) => a.id === id)!;
  const kr = Math.sqrt(kPaso);
  const vb = `${encuadre.x} ${encuadre.y} ${encuadre.lado} ${encuadre.lado}`;

  return (
    <div className="cbg">
      <style>{`
        .cbg .cbg-lienzo { background: var(--sidebar); border: 1px solid var(--sidebar-2); border-radius: 14px; overflow: hidden; }
        .cbg svg { width: 100%; height: auto; display: block; aspect-ratio: 1/1; touch-action: none; cursor: grab; }
        .cbg svg:active { cursor: grabbing; }
        .cbg .cbg-nodo { cursor: pointer; }
        .cbg .cbg-nodo circle, .cbg .cbg-arista, .cbg .cbg-et, .cbg .cbg-rot { transition: opacity .18s ease, stroke .18s ease, fill .18s ease; }
        .cbg .cbg-et {
          font-size: calc(11px / var(--k, 1));
          fill: var(--sidebar-text);
          paint-order: stroke;
          stroke: var(--sidebar);
          stroke-width: calc(3px / var(--k, 1));
          stroke-linejoin: round;
          pointer-events: none;
        }
        .cbg .cbg-et-fuerte { fill: var(--on-sidebar); font-weight: 600; }
        .cbg .cbg-rot {
          font-family: ${MONO};
          font-size: calc(10px / var(--k, 1));
          letter-spacing: .1em;
          text-transform: uppercase;
          fill: var(--sidebar-text);
          opacity: .45;
          cursor: pointer;
        }
        .cbg .cbg-rot-on { opacity: 1; fill: var(--mako); }
        .cbg .cbg-entra { animation: cbg-in .55s cubic-bezier(.23,1,.32,1) backwards; }
        @keyframes cbg-in { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .cbg .cbg-entra { animation: none; }
          .cbg .cbg-nodo circle, .cbg .cbg-arista, .cbg .cbg-et, .cbg .cbg-rot { transition: none; }
        }
        @media (max-width: 900px) {
          .cbg .cbg-cols { grid-template-columns: minmax(0,1fr) !important; }
          .cbg .cbg-cols > aside { position: static !important; }
        }
      `}</style>

      <div className="cbg-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 20, alignItems: 'start' }}>
        <div className="cbg-lienzo">
          <svg
            ref={svgRef}
            viewBox={vb}
            role="img"
            aria-label={`Mapa del segundo cerebro: ${cuenta.total} cosas que MaKo entendió de tu negocio`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onPointerLeave={soltar}
          >
            <g ref={gRef} style={{ ['--k' as string]: 1 }}>
              {/* Rótulos de área, en el centroide de su racimo. Van primero: cualquier
                  nodo tiene que quedar por encima. */}
              {rotulos.map((a) => (
                <text
                  key={a.id}
                  className={`cbg-rot${areaFoco === a.id ? ' cbg-rot-on' : ''}`}
                  x={a.x}
                  y={a.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  onClick={(e) => { e.stopPropagation(); setAreaFoco(areaFoco === a.id ? null : a.id); }}
                >
                  {a.nombre}
                </text>
              ))}

              <g fill="none">
                {aristas.map((e, i) => {
                  const a = posiciones[e.de];
                  const b = posiciones[e.a];
                  if (!a || !b) return null;
                  const na = porId.get(e.a);
                  const viva = cerca ? cerca.has(e.de) && cerca.has(e.a) : true;
                  const enFoco = areaFoco ? na?.area === areaFoco || porId.get(e.de)?.area === areaFoco : true;
                  const op = cerca ? (viva ? 0.9 : ATENUADO_ARISTA) : areaFoco ? (enFoco ? 0.7 : ATENUADO_ARISTA) : 0.35;
                  return (
                    <line
                      key={`${e.de}-${e.a}-${i}`}
                      className="cbg-arista"
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={viva && cerca ? 'var(--on-sidebar)' : 'var(--sidebar-text)'}
                      strokeWidth={viva && cerca ? 1.6 : 1}
                      strokeDasharray={na?.autoria === 'pendiente' ? '3 5' : undefined}
                      strokeOpacity={op}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>

              {nodos.map((n, i) => {
                const p = posiciones[n.id];
                if (!p) return null;
                const off = apagado(n);
                // El radio "resiste" el zoom out: en pantalla queda r·√k, igual que la
                // nodeScale de Obsidian. Sin esto los nodos desaparecen al alejarse.
                const r = radioMundo(n, grados[n.id] ?? 0) / kr;
                const esSel = sel === n.id;

                // El COLOR dice QUIÉN, y sobre fondo oscuro se invierte: acá el relleno
                // es la autoría (un borde de 3 px sobre un punto de 4,5 sería casi todo
                // el nodo). Rellenos con significado: los dos de siempre, Norte y cuello.
                let fill = 'var(--sidebar-text)';
                let stroke = 'none';
                let sw = 0;
                if (n.id === 'raiz') fill = 'var(--on-sidebar)';
                else if (n.destacado) fill = 'var(--mako)';
                else if (n.alerta) fill = 'var(--warn-fill)';
                else if (n.autoria === 'mako') fill = 'var(--mako)';
                else if (n.autoria === 'pendiente') { fill = 'none'; stroke = 'var(--sidebar-text)'; sw = 1; }

                const mostrarEt = etiquetas.visibles.has(n.id);
                const ey = etiquetas.ys.get(n.id) ?? p.y + r + 11 / kPaso;

                return (
                  <g
                    key={n.id}
                    className="cbg-nodo cbg-entra"
                    style={{ animationDelay: `${Math.min(i * 14, 700)}ms` }}
                    onMouseEnter={() => setActivo(n.id)}
                    onMouseLeave={() => setActivo(null)}
                    onClick={clicNodo(n.id)}
                  >
                    <circle cx={p.x} cy={p.y} r={Math.max(r + 10 / kr, 18 / kr)} fill="transparent" />
                    {esSel && (
                      <circle cx={p.x} cy={p.y} r={r + 3.5 / kr} fill="none" stroke="var(--on-sidebar)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                    )}
                    <circle
                      cx={p.x} cy={p.y} r={r}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={sw}
                      strokeDasharray={n.autoria === 'pendiente' ? '2 2' : undefined}
                      vectorEffect={sw ? 'non-scaling-stroke' : undefined}
                      opacity={off ? ATENUADO : 1}
                    />
                    {mostrarEt && (
                      <text
                        className={`cbg-et${n.id === 'raiz' || n.destacado || n.alerta ? ' cbg-et-fuerte' : ''}`}
                        x={p.x}
                        y={ey}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        opacity={off ? ATENUADO : 1}
                      >
                        {n.etiqueta}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <aside style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, minHeight: 190 }}>
            {nodoSel ? (
              <>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
                  {areaDe(nodoSel.area).nombre}
                </div>
                <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 8 }}>
                  {nodoSel.etiqueta}
                </div>
                <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                  {nodoSel.detalle}
                </p>
                {nodoSel.fuente && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>
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
                  Pasa el cursor por un punto para leerlo, haz clic para fijarlo, y usa la rueda para acercarte.
                </p>
              </>
            )}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
            <Leyenda />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Leyenda() {
  const fila = (nodo: React.ReactNode, texto: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
      <span style={{ display: 'inline-flex', flex: 'none', background: 'var(--sidebar)', borderRadius: 5, padding: 2 }}>
        <svg width={16} height={16} viewBox="0 0 16 16">{nodo}</svg>
      </span>
      {texto}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {fila(<circle cx={8} cy={8} r={4.5} fill="var(--mako)" />, 'Lo dedujo MaKo')}
      {fila(<circle cx={8} cy={8} r={4.5} fill="var(--sidebar-text)" />, 'Lo escribiste tú')}
      {fila(<circle cx={8} cy={8} r={4} fill="none" stroke="var(--sidebar-text)" strokeWidth={1} strokeDasharray="2 2" />, 'Todavía no existe')}
      {fila(<circle cx={8} cy={8} r={5.5} fill="var(--mako)" />, 'Tu Norte')}
      {fila(<circle cx={8} cy={8} r={5.5} fill="var(--warn-fill)" />, 'Lo que te frena')}
    </div>
  );
}
