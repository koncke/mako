'use client';

// =============================================================================
// El detalle de un competidor: todo lo que publica en un gráfico (punto 7 del 4/11/2026)
// =============================================================================
// Martín, 4/11: «quiero que eso sea el Detail de cada competidor… como va poniendo todos sus contenidos en un gráfico… uno
// para contenido corto, otro para contenido largo, de sus carruseles o imágenes, y luego el análisis de su web». La
// especificación salió de mirar su video cuadro por cuadro (docs/diseno-competitors-spy.md §15): arriba los números y el
// filtro de redes; en el medio, cada miniatura entra volando desenfocada desde una columna y cae en su lugar (X = el día
// en que se publicó, Y = sus vistas en escala logarítmica); abajo, «¿Qué formatos le funcionan?», con una fila por formato,
// la línea de su mediana y la lectura escrita arriba.
//
// Las cuentas son puras: lib/spy-detalle.ts. Tocar una miniatura abre su detalle (DetallePieza.tsx) con «Copiar estructura».
//
// ⚠️ ANTES DE LA ANIMACIÓN, SÓLO LA CRIATURA: se bajan TODAS las miniaturas que se van a dibujar (precarga.ts, la misma que
//    usa la película del orden) y recién ahí se anima. Una que no se pudo bajar entra con el color de su red: nunca una caja
//    vacía que se llena a mitad de camino.
// ⚠️ SIN INVENTAR: lo que no tiene número no se dibuja en cero (`graficoDe` lo cuenta aparte); sin vistas, «me gusta»; en
//    los anuncios, los días al aire. La curva de «siguen mirando» del video NO va: un competidor no publica su retención.
// ⚠️ SE MUEVE CON LA WEB ANIMATIONS API (transform, opacity y filter), sin un render de React por cuadro, y con «reducir
//    movimiento» no se anima.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LogoRed, redDePieza } from './LogoRed';
import { Dropdown } from '../components/Dropdown';
import { CargandoMako } from '@/app/_ui/CargandoMako';
import {
  formatosDe, graficoDe, grupoDe, lecturaDeFormatos, medidaEnElGrafico, muestraDe, numerosDe, opcionesDeGrafico, redesDe, MINIATURAS_POR_GRAFICO,
  type Grupo, type ValorDeGrafico,
} from '@/lib/spy-detalle';
import { dibujarContador } from '@/lib/spy-reglas';
import { fechaCorta, miniaturaDePieza } from '@/lib/spy-vista';
import type { PiezaVista } from './actions';
import { precargarTodas, quieto } from './precarga';

const CSS = `
.spyg{display:flex;flex-direction:column;gap:16px}
.spyg-herr{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.spyg-redes{display:flex;gap:6px;flex-wrap:wrap}
.spyg-red{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border:1px solid var(--border);border-radius:99px;background:var(--surface);color:var(--dim);font:inherit;font-size:var(--fs-sm);font-weight:600;cursor:pointer}
.spyg-red[data-activa=true]{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.spyg-red small{font-weight:500;opacity:.75}
.spyg-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.spyg-num{padding:14px 16px;border:1px solid var(--border);border-radius:14px;background:var(--surface);min-width:0}
.spyg-num:first-child{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.spyg-num span{display:block;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spyg-num b{display:block;margin-top:4px;font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spyg-caja{position:relative;border:1px solid var(--border);border-radius:16px;background:var(--surface);padding:16px 16px 12px}
.spyg-caja[data-cargando=true]{border-color:transparent;background:transparent;box-shadow:none}
.spyg-caja h3{margin:0 0 4px;font-size:15px;font-weight:700;color:var(--ink)}
.spyg-pie{margin:8px 0 0;font-size:12px;color:var(--dim)}
.spyg-plot{position:relative;height:380px;margin-left:44px;margin-bottom:22px}
.spyg-marca{position:absolute;left:0;right:0;border-top:1px dashed color-mix(in srgb,var(--border) 80%,transparent)}
.spyg-marca span{position:absolute;right:calc(100% + 8px);top:-8px;font-size:11px;color:var(--dim);font-variant-numeric:tabular-nums;white-space:nowrap}
.spyg-x{position:absolute;top:calc(100% + 6px);font-size:11px;color:var(--dim);white-space:nowrap}
.spyg-pt{position:absolute;width:34px;height:34px;padding:0;border:2px solid #fff;border-radius:9px;overflow:hidden;cursor:pointer;box-shadow:0 2px 8px rgba(18,21,27,.22);background:var(--faint);will-change:transform,opacity}
.spyg-pt:hover,.spyg-pt:focus-visible{z-index:2;outline:2px solid var(--accent);outline-offset:1px;transform:scale(1.35)}
.spyg-pt img{width:100%;height:100%;object-fit:cover;display:block}
.spyg-pt__red{position:absolute;right:1px;bottom:1px;display:flex;border-radius:4px;box-shadow:0 0 0 1px #fff;pointer-events:none}
@media (max-width:600px){.spyg-pt__red{transform:scale(.7);transform-origin:bottom right}}
.spyg-pt[data-canal=instagram]{background:linear-gradient(140deg,#F58529,#DD2A7B 55%,#8134AF)}
.spyg-pt[data-canal=youtube]{background:#23252B}
.spyg-pt[data-canal=anuncios]{background:linear-gradient(140deg,#2F6BFF,#1B3FA8)}
.spyg-lectura{margin:0 0 12px;padding:14px 16px;border-radius:14px;background:var(--ink);color:var(--bg);font-size:14px;line-height:1.45}
.spyg-fila{display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:16px;align-items:center;padding:10px 0;border-top:1px solid var(--border)}
.spyg-fila:first-of-type{border-top:0}
.spyg-fila b{display:block;font-size:14px;color:var(--ink)}
.spyg-fila small{display:block;font-size:12px;color:var(--dim)}
.spyg-fila q{display:block;margin-top:2px;font-size:12px;color:var(--ink);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.spyg-pista{position:relative;height:38px}
.spyg-pista .spyg-pt{border-radius:6px;top:50%;translate:0 -50%}
.spyg-mediana{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--ink);border-radius:2px}
.spyg-vivo{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--dim)}
.spyg-vivo i{width:7px;height:7px;border-radius:50%;background:var(--primary);animation:spygLatido 1.1s ease-in-out infinite}
@keyframes spygLatido{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.spyg-vivo i{animation:none}}
@media (max-width:640px){
  .spyg-plot{height:260px;margin-left:36px}
  .spyg-pt{width:24px;height:24px;border-radius:6px;border-width:1.5px}
  .spyg-num b{font-size:19px}
  .spyg-fila{grid-template-columns:1fr;gap:6px}
}
`;

/** El ícono de cada opción del desplegable (AGENTS.md: cada opción de un desplegable lleva el suyo). */
const ICONO: Record<ValorDeGrafico, 'video' | 'imagen' | 'anuncio' | 'web' | 'agregar'> = {
  corto: 'video', largo: 'video', imagenes: 'imagen', anuncios: 'anuncio', web: 'web', 'agregar-instagram': 'agregar', 'agregar-youtube': 'agregar',
};
const NOMBRE_RED: Record<string, string> = { todo: 'Todas', instagram: 'Instagram', youtube: 'YouTube', anuncios: 'Anuncios' };

/** El logo de su red en la esquina de cada miniatura: el mismo que el buscador (Martín, 4/11). */
function RedDeLaMiniatura({ canal }: { canal: string }) {
  const red = redDePieza(canal);
  return red ? <span className="spyg-pt__red" aria-hidden><LogoRed red={red} box={13} /></span> : null;
}
/** Cuántas miniaturas lleva como mucho la pista de un formato. */
const MINIATURAS_POR_FILA = 40;

function useTelefono(): boolean {
  const [tel, setTel] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 640px)');
    const cambio = () => setTel(m.matches);
    cambio();
    m.addEventListener('change', cambio);
    return () => m.removeEventListener('change', cambio);
  }, []);
  return tel;
}

function Miniatura({ p, bajada }: { p: PiezaVista; bajada: boolean }) {
  const url = bajada ? miniaturaDePieza(p) : null;
  // eslint-disable-next-line @next/next/no-img-element -- la sirve el CDN del canal, sin pasar por nuestro optimizador
  return url ? <img src={url} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} /> : null;
}

export function GraficoSpy({ c, piezas, analizando, onAbrir, onAgregarRed, onWeb }: {
  c: { nombre: string; instagram: string | null; youtube_id: string | null };
  /** Todo lo suyo: el gráfico elige lo que le toca (`grupoDe`). */
  piezas: readonly PiezaVista[];
  /** La IA del negocio está leyendo sus piezas: los formatos todavía se están llenando. */
  analizando: boolean;
  onAbrir: (p: PiezaVista) => void;
  onAgregarRed: () => void;
  /** «Su web» no es un gráfico: lleva a la pestaña de su web. */
  onWeb: () => void;
}) {
  const telefono = useTelefono();
  const opciones = useMemo(() => opcionesDeGrafico(piezas, c), [piezas, c]);
  const graficables = opciones.filter((o) => o.value !== 'web' && !o.value.startsWith('agregar')).map((o) => o.value as Grupo);
  const [elegido, setElegido] = useState<Grupo | null>(null);
  const grupo: Grupo | null = elegido && graficables.includes(elegido) ? elegido : (graficables[0] ?? null);
  const [red, setRed] = useState('todo');

  const delGrupo = useMemo(() => (grupo ? piezas.filter((p) => grupoDe(p) === grupo) : []), [piezas, grupo]);
  const redes = useMemo(() => redesDe(delGrupo), [delGrupo]);
  const redActiva = redes.some((r) => r.red === red) ? red : 'todo';
  const vistas = useMemo(() => (redActiva === 'todo' ? delGrupo : delGrupo.filter((p) => p.canal === redActiva)), [delGrupo, redActiva]);

  const g = useMemo(() => graficoDe(vistas), [vistas]);
  const nums = useMemo(() => numerosDe(vistas), [vistas]);
  const filas = useMemo(() => formatosDe(vistas), [vistas]);
  // Por fila, las de más arriba: con cientos en una pista, se tapan entre sí y no se lee nada.
  const enFilas = useMemo(() => filas.map((f) => ({ ...f, piezas: [...f.piezas].sort((a, b) => b.valor - a.valor).slice(0, MINIATURAS_POR_FILA) })), [filas]);
  const lectura = lecturaDeFormatos(filas);
  const porId = useMemo(() => new Map(vistas.map((p) => [p.id, p])), [vistas]);
  const dibujados = useMemo(() => muestraDe(g.puntos, telefono ? Math.round(MINIATURAS_POR_GRAFICO / 2) : MINIATURAS_POR_GRAFICO), [g.puntos, telefono]);

  // ── Se bajan TODAS las miniaturas antes de dibujar: mientras tanto, sólo la criatura. ──
  // ⚠️ CADA UNA SE PIDE UNA SOLA VEZ, Y LO BAJADO SE ACUMULA. La primera versión volvía a `null` cada vez que cambiaba lo
  // que se dibuja: cruzar el ancho del teléfono (rotar una tableta, achicar la ventana) cambia la muestra, y el gráfico
  // entero volvía a la criatura y a la animación desde cero. Medido en Chromium: una captura de página entera lo disparaba.
  const [precarga, setPrecarga] = useState<{ intentadas: ReadonlySet<number>; ok: ReadonlySet<number> }>({ intentadas: new Set(), ok: new Set() });
  const pedidas = useRef(new Set<number>());
  const aBajar = useMemo(() => [...new Set([...dibujados.map((d) => d.id), ...enFilas.flatMap((f) => f.piezas.map((x) => x.id))])], [dibujados, enFilas]);
  const firma = aBajar.join(',');
  useEffect(() => {
    const faltan = aBajar.filter((id) => !pedidas.current.has(id));
    if (!faltan.length) return;
    faltan.forEach((id) => pedidas.current.add(id));
    const urls = faltan.map((id) => ({ id, url: porId.get(id) ? miniaturaDePieza(porId.get(id)!) : null }))
      .filter((m): m is { id: number; url: string } => !!m.url);
    // Se junta aunque el gráfico ya haya cambiado: lo bajado sirve igual, y juntar dos veces da lo mismo.
    void precargarTodas(urls).then((ok) => setPrecarga((v) => ({ intentadas: new Set([...v.intentadas, ...faltan]), ok: new Set([...v.ok, ...ok]) })));
  // `firma` resume `aBajar`: con el array, cada render volvería a mirar todo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);
  const listo = aBajar.every((id) => precarga.intentadas.has(id));
  const bajadas = listo ? precarga.ok : null;

  // ── La entrada: desde una columna a la izquierda, desenfocadas y grandes, a su lugar. UNA vez por gráfico (por su
  // tipo y su red): un cambio de ancho a mitad de camino la corta y deja cada miniatura en su lugar, no la repite. ──
  const plot = useRef<HTMLDivElement>(null);
  const animado = useRef<string | null>(null);
  const clave = `${grupo}|${redActiva}`;
  useLayoutEffect(() => {
    if (!listo || !plot.current || animado.current === clave) return;
    animado.current = clave;
    if (quieto()) return;
    const els = [...plot.current.querySelectorAll<HTMLElement>('[data-pt]')];
    const caja = plot.current.getBoundingClientRect();
    if (!caja.width) return;
    // El orden de la columna: de la que más rinde a la que menos (la de arriba es la primera que se ve llegar).
    const orden = [...els].sort((a, b) => Number(b.dataset.valor) - Number(a.dataset.valor));
    const lado = telefono ? 24 : 34;
    const porFila = Math.max(2, Math.floor((caja.width * 0.18) / (lado + 6)));
    const paso = Math.min(9, 1300 / Math.max(1, els.length));
    const anims = orden.map((el, i) => {
      const r = el.getBoundingClientRect();
      const ox = (i % porFila) * (lado + 6) - (r.left - caja.left);
      const oy = Math.floor(i / porFila) * (lado + 6) - (r.top - caja.top);
      return el.animate([
        { transform: `translate(${ox}px,${oy}px) scale(1.5)`, filter: 'blur(7px)', opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { transform: 'translate(0,0) scale(1)', filter: 'blur(0)', opacity: 1 },
      ], { duration: 900, delay: i * paso, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
    });
    return () => anims.forEach((a) => a.cancel());
  }, [listo, clave, telefono]);

  if (!grupo) {
    return null;
  }

  const metricaLarga = nums.metrica === 'vistas' ? 'Vistas' : nums.metrica === 'me gusta' ? 'Me gusta' : 'Días al aire';
  const mejor = filas.find((f) => f.veces >= 1.2) ?? null;
  const numeros = [
    { k: 'piezas', rot: grupo === 'anuncios' ? 'Anuncios' : 'Piezas', val: String(nums.piezas) },
    ...(nums.total != null ? [{ k: 'total', rot: metricaLarga, val: dibujarContador(nums.total) }] : []),
    ...(nums.mediana != null ? [{ k: 'mediana', rot: nums.metrica === 'días al aire' ? 'Días, la mediana' : 'Mediana', val: dibujarContador(nums.mediana) }] : []),
    ...(mejor ? [{ k: 'funciona', rot: 'Le funciona', val: mejor.rotulo }] : []),
  ];

  return (
    <div className="spyg">
      <style>{CSS}</style>
      <div className="spyg-nums">
        {numeros.map((n) => <div key={n.k} className="spyg-num"><span>{n.rot}</span><b>{n.val}</b></div>)}
      </div>

      {/* ⚠️ EL SELECTOR Y LOS FILTROS VAN ADENTRO DE LA TARJETA DEL GRÁFICO (Martín, 4/11), arriba del dibujo. Y MIENTRAS
          CARGA, SIN TARJETA: la criatura «directo sobre el gris», sin la caja blanca detrás. */}
      <section className="spyg-caja" data-cargando={g.puntos.length > 0 && !bajadas} aria-label={`${metricaLarga} por día de publicación`}>
          <div className="spyg-herr">
            <Dropdown
              ariaLabel="Qué gráfico ver"
              value={grupo}
              width={250}
              buttonStyle={{ height: 38, borderRadius: 99, fontSize: 'var(--fs-sm)', fontWeight: 600 }}
              options={opciones.map((o) => ({ ...o, icono: ICONO[o.value] }))}
              onChange={(v) => {
                if (v === 'agregar-instagram' || v === 'agregar-youtube') { onAgregarRed(); return; }
                if (v === 'web') { onWeb(); return; }
                setElegido(v as Grupo);
                setRed('todo');
              }}
            />
            {redes.length > 0 && (
              <div className="spyg-redes" role="group" aria-label="Red">
                {redes.map((r) => (
                  <button key={r.red} type="button" className="spyg-red" data-activa={redActiva === r.red} onClick={() => setRed(r.red)}>
                    {redDePieza(r.red) && <LogoRed red={redDePieza(r.red)!} box={18} />}{NOMBRE_RED[r.red] ?? r.red} <small>{r.n}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        {g.puntos.length > 0 && !bajadas && <CargandoMako que={`lo que publica ${c.nombre}`} alto={380} size={72} />}
        {g.puntos.length > 0 && (
          <>
          <div className="spyg-plot" ref={plot} style={bajadas ? undefined : { visibility: 'hidden', position: 'absolute', inset: 0 }}>
            {g.marcas.map((m) => <div key={m.rotulo} className="spyg-marca" style={{ bottom: `${m.y * 100}%` }}><span>{m.rotulo}</span></div>)}
            {g.desde && <span className="spyg-x" style={{ left: 0 }}>{fechaCorta(g.desde)}</span>}
            {g.hasta && g.hasta !== g.desde && <span className="spyg-x" style={{ right: 0 }}>{fechaCorta(g.hasta)}</span>}
            {bajadas && dibujados.map((d) => {
              const p = porId.get(d.id);
              if (!p) return null;
              // Su proporción real: el lado más largo mide `lado` (un reel es vertical; un video de YouTube, apaisado).
              const m = medidaEnElGrafico(p, telefono ? 30 : 42);
              return (
                <button
                  key={d.id} type="button" className="spyg-pt" data-pt="" data-valor={d.valor} data-canal={p.canal}
                  style={{ width: m.ancho, height: m.alto, left: `calc(${d.x * 100}% - ${d.x * m.ancho}px)`, bottom: `calc(${d.y * 100}% - ${d.y * m.alto}px)` }}
                  aria-label={`${p.titulo || p.analisis?.gancho || 'Pieza'} · ${dibujarContador(d.valor)} ${nums.metrica}`}
                  title={`${dibujarContador(d.valor)} ${nums.metrica}`}
                  onClick={() => onAbrir(p)}
                >
                  <Miniatura p={p} bajada={bajadas.has(d.id)} />
                  <RedDeLaMiniatura canal={p.canal} />
                </button>
              );
            })}
          </div>
          {/* «Cada miniatura es un video» se fue (Martín, 4/11: los textos que narran lo que ya se ve). Queda sólo lo que no
              se ve: que hay más piezas que miniaturas. */}
          {dibujados.length < g.puntos.length && <p className="spyg-pie">Se ven {dibujados.length} de {g.puntos.length}</p>}
          </>
        )}
      </section>

      {filas.length > 0 && (
        <section className="spyg-caja">
          <h3>¿Qué formatos le funcionan?</h3>
          {lectura && <p className="spyg-lectura">{lectura}</p>}
          {enFilas.map((f) => (
            <div key={f.formato} className="spyg-fila">
              <div>
                <b>{f.rotulo}</b>
                <small>{f.n} piezas · {String(f.veces).replace('.', ',')}x la mediana</small>
                {f.gancho && <q>{f.gancho}</q>}
              </div>
              <div className="spyg-pista">
                <span className="spyg-mediana" style={{ left: `calc(${f.xMediana * 100}% - ${f.xMediana * 26}px + 12px)` }} title={`Mediana: ${dibujarContador(f.mediana)}`} />
                {bajadas && f.piezas.map((x) => {
                  const p = porId.get(x.id);
                  if (!p) return null;
                  return (
                    <button key={x.id} type="button" className="spyg-pt" data-canal={p.canal} style={{ width: medidaEnElGrafico(p, 30).ancho, height: medidaEnElGrafico(p, 30).alto, left: `calc(${x.x * 100}% - ${x.x * medidaEnElGrafico(p, 30).ancho}px)` }}
                      aria-label={`${p.titulo || p.analisis?.gancho || 'Pieza'} · ${dibujarContador(x.valor)} ${nums.metrica}`} onClick={() => onAbrir(p)}>
                      <Miniatura p={p} bajada={bajadas.has(x.id)} />
                      <RedDeLaMiniatura canal={p.canal} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
      {!filas.length && analizando && <p className="spyg-vivo" aria-live="polite"><i />Analizando sus formatos…</p>}
    </div>
  );
}
