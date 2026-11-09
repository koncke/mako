'use client';

// =============================================================================
// crear/EscenarioReplica — la réplica armándose con varios mouse a la vista (Martín, 9/11/2026)
// =============================================================================
// Martín: «PARA WEB REPLICATE, COPIAR ESTO: https://www.instagram.com/reel/DfZFAfzs3Ng/ … Sobre todo la animación de los
// multiples mouse actuando». Copiado del reel (cuadro por cuadro en docs/relevo/web-replicate-nube.md): un escenario oscuro
// con la página que se arma; mientras MaKo lee, el anillo de puntos de colores; cuando llega la estructura, los doce
// cursores salen disparados del anillo y trazan una caja azul por sección (con su etiqueta «Textos · 720 × 140»); cuando
// una sección se armó, su dueño escribe el título letra por letra («· escribiendo»); con el diseño, Colores, Imágenes y
// Fuentes la pintan con el color de la original; al terminar se juntan abajo, al lado del botón. La página baja sola
// siguiendo lo que se arma. Abajo, la barra del reel («● MaKo en vivo · la fase · el botón naranja»).
//
// TODO lo que avanza sale de los eventos reales (lib/editor-landing/replicar-escena.ts, sobre replicar-progreso.ts) y de
// lo ya revelado por ArmadoEnVivo (`visibles`): ninguna caja ni ningún título aparece antes de que exista. Lo único que no
// mide nada son los tirones de los cursores sin tarea, que es cómo se ve que MaKo trabaja.
//
// El movimiento corre en UN requestAnimationFrame que escribe `transform`, textos y atributos por ref: React dibuja la
// estructura cuando cambia la escena, nunca por cuadro. Con «reducir movimiento» del sistema no hay bucle: cada caja y
// cada cursor se dibujan quietos en su estado final (`tiemposFinales`).
// =============================================================================

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AGENTES, COLA_TECLEO, acercar, acercar1, type Punto } from '@/app/_ui/enjambre';
import { CSS_CURSOR, CursorAgente } from '@/app/_ui/CursorAgente';
import type { EventoReplica } from '@/lib/editor-landing/replicar-progreso';
import type { MoldeSeccion } from '@/lib/editor-landing/replicar-estructura';
import {
  FINAL, acentoDe, avanceDeTrazo, camaraDe, destinoDeAgente, escenaDeReplica, estadoDeCaja, etiquetaDeCaja, letrasDeCaja,
  tiemposFinales, type CajaEscena, type Escena, type EtapaEscena, type Tiempos,
} from '@/lib/editor-landing/replicar-escena';

/** Lo que dice la barra en cada etapa (la del reel decía «12 AGENTS LIVE»; acá, la fase real). `leyendo`: lo que dice el
 * arranque, si el que lee lo sabe mejor (el paso «Leer» de Replicar, la extensión copiando en la pestaña real). */
export function textoDeEtapa(escena: Escena, leyendo?: string): string {
  const etapas: Record<EtapaEscena, string> = {
    arranque: leyendo || 'Leyendo la página',
    secciones: `Escribiendo · ${escena.escritas} de ${escena.total}`,
    diseno: 'Aplicando el diseño',
    lista: 'Lista',
    fallo: 'Se detuvo',
  };
  return etapas[escena.etapa];
}

const sinMovimiento = (): boolean => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Una caja de la página: el marco que se traza, la etiqueta, las asas y lo que lleva adentro. */
function Caja({ c, refCaja, quieto }: {
  c: CajaEscena;
  refCaja: (el: HTMLDivElement | null) => void;
  /** Sin movimiento: el estado, la etiqueta y las letras finales, ya puestos. */
  quieto: { estado: string; etiqueta: string | null; letras: number } | null;
}) {
  const e = c.esqueleto;
  const letras = Array.from(c.titulo);
  return (
    <div ref={refCaja} className="wr-caja" data-indice={c.indice} data-estado={quieto?.estado} style={{ left: c.rect.x, top: c.rect.y, width: c.rect.w, height: c.rect.h }}>
      <div className="wr-marco">
        <i className="wr-asa" data-esq="1" /><i className="wr-asa" data-esq="2" /><i className="wr-asa" data-esq="3" /><i className="wr-asa" data-esq="4" />
        <div className="wr-contenido">
          <p className="wr-titulo">
            <span className="wr-escrito">{quieto ? letras.slice(0, quieto.letras).join('') : null}</span>
            <span className="wr-cola" />
          </p>
          {e.tarjetas > 0 && (
            <div className="wr-tarjetas">{Array.from({ length: e.tarjetas }, (_, k) => <i key={k} className="wr-tarjeta" />)}</div>
          )}
          {e.lineas > 0 && (
            <div className="wr-lineas">{Array.from({ length: e.lineas }, (_, k) => <i key={k} className="wr-linea" style={{ width: `${[92, 78, 58][k]}%` }} />)}</div>
          )}
          {e.vinetas > 0 && (
            <div className="wr-lineas">{Array.from({ length: e.vinetas }, (_, k) => <i key={k} className="wr-vineta" style={{ width: `${[46, 40, 34][k]}%` }} />)}</div>
          )}
          {e.botones > 0 && (
            <div className="wr-botones">{Array.from({ length: e.botones }, (_, k) => <i key={k} className="wr-boton" data-segundo={k > 0 ? 'si' : undefined} />)}</div>
          )}
        </div>
      </div>
      <span className="wr-etiqueta" data-ver={quieto ? (quieto.etiqueta ? 'si' : 'no') : undefined}>{quieto ? quieto.etiqueta : null}</span>
    </div>
  );
}

export function EscenarioReplica({ eventos, visibles, llegadas, saltear, moldes, colores, leyendo }: {
  eventos: readonly EventoReplica[];
  /**
   * Tanda 2 (9/11/2026): lo que dice el anillo mientras todavía no hay estructura. El paso «Leer» de Replicar monta el
   * escenario sólo con el anillo (no hay eventos de la lectura: sólo «leyendo» y «leída»), y la extensión dice cuánto
   * lleva copiado en la pestaña real.
   */
  leyendo?: string;
  /** Cuántas secciones armadas ya se ven (useRevelado de ArmadoEnVivo: la misma cadencia que la cuenta). */
  visibles: number;
  /** Cuántas secciones llegaron armadas. */
  llegadas: number;
  /** «Ver todo»: lo que llegó, a la vista de una. */
  saltear: () => void;
  /** La forma de cada sección según la lectura (si son las mismas secciones, las cajas la repiten). */
  moldes?: readonly MoldeSeccion[];
  /** Los colores de la original: el más vivo pinta el diseño. */
  colores?: readonly string[] | null;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const pagina = useRef<HTMLDivElement>(null);
  const cajas = useRef<(HTMLDivElement | null)[]>([]);
  const cursores = useRef<(HTMLDivElement | null)[]>([]);
  const [medida, setMedida] = useState({ ancho: 640, alto: 380 });
  const [quieto, setQuieto] = useState(false);
  useEffect(() => { setQuieto(sinMovimiento()); }, []);
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const medir = () => setMedida((m) => (m.ancho === el.clientWidth && m.alto === el.clientHeight ? m : { ancho: el.clientWidth || m.ancho, alto: el.clientHeight || m.alto }));
    medir();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const escena = useMemo(() => escenaDeReplica(eventos, { visibles, ancho: medida.ancho, moldes }), [eventos, visibles, medida.ancho, moldes]);
  const acento = useMemo(() => acentoDe(colores), [colores]);

  // Cuándo pasó cada cosa, en el reloj de esta pantalla (lo usa el bucle para repartir trazos, tecleos y pinturas).
  const tiempos = useRef<Tiempos & { escritas: Map<number, number> }>({ esquema: null, escritas: new Map(), diseno: null, lista: null });
  useLayoutEffect(() => {
    const t = tiempos.current;
    const ahora = Date.now();
    if (escena.etapa === 'arranque' && !escena.cajas.length) { tiempos.current = { esquema: null, escritas: new Map(), diseno: null, lista: null }; return; }
    if (t.esquema === null && escena.cajas.length) t.esquema = ahora;
    for (const c of escena.cajas) if (c.escrita && !t.escritas.has(c.indice)) t.escritas.set(c.indice, ahora);
    if ((escena.etapa === 'diseno' || escena.etapa === 'lista') && t.diseno === null) t.diseno = ahora;
    if (escena.etapa === 'lista' && t.lista === null) t.lista = ahora;
  }, [escena]);

  // Lo que lee el bucle sin volver a suscribirse en cada cambio.
  const vivo = useRef({ escena, medida });
  vivo.current = { escena, medida };

  // El bucle: la cámara, cada caja y cada cursor, por ref.
  useEffect(() => {
    if (quieto) return;
    const pos: Punto[] = AGENTES.map(() => ({ x: vivo.current.medida.ancho / 2, y: vivo.current.medida.alto / 2 }));
    let camara = 0;
    let previo = performance.now();
    let raf = 0;
    const cuadro = () => {
      const p = performance.now();
      const dt = Math.min(64, p - previo);
      previo = p;
      const ahora = Date.now();
      const { escena: esc, medida: m } = vivo.current;
      const t = tiempos.current;
      camara = acercar1(camara, camaraDe(esc, t, ahora, m.alto), dt);
      if (pagina.current) pagina.current.style.transform = `translate3d(0, ${(-camara).toFixed(1)}px, 0)`;
      esc.cajas.forEach((c, k) => {
        const el = cajas.current[k];
        if (!el) return;
        const estado = estadoDeCaja(c, esc, t, ahora);
        if (el.dataset.estado !== estado) el.dataset.estado = estado;
        const marco = el.firstElementChild as HTMLElement | null;
        if (marco) {
          const a = estado === 'trazando' ? avanceDeTrazo(c, esc, t, ahora) : 1;
          const ancho = `${(a * 100).toFixed(1)}%`;
          if (marco.style.width !== ancho) { marco.style.width = ancho; marco.style.height = ancho; }
        }
        const etiqueta = etiquetaDeCaja(c, esc, t, ahora);
        const tag = el.querySelector<HTMLElement>('.wr-etiqueta');
        if (tag) {
          if (etiqueta && tag.textContent !== etiqueta) tag.textContent = etiqueta;
          const ver = etiqueta ? 'si' : 'no';
          if (tag.dataset.ver !== ver) tag.dataset.ver = ver;
        }
        const letras = letrasDeCaja(c, esc, t, ahora);
        const todas = Array.from(c.titulo);
        const escrito = todas.slice(0, letras).join('');
        const cola = letras > 0 && letras < todas.length ? todas.slice(letras, letras + COLA_TECLEO).join('') : '';
        const sEsc = el.querySelector<HTMLElement>('.wr-escrito');
        const sCola = el.querySelector<HTMLElement>('.wr-cola');
        if (sEsc && sEsc.textContent !== escrito) sEsc.textContent = escrito;
        if (sCola && sCola.textContent !== cola) sCola.textContent = cola;
      });
      for (let i = 0; i < AGENTES.length; i++) {
        const el = cursores.current[i];
        if (!el) continue;
        const d = destinoDeAgente(i, esc, t, ahora, { y: camara, alto: m.alto }, m.ancho);
        // Trazando o escribiendo, el cursor va pegado a la punta (el reel: arrastra la esquina); sin tarea, el tirón.
        pos[i] = acercar(pos[i], d.p, dt, d.accion === 'trazar' || d.accion === 'escribir' || d.accion === 'pintar' ? 40 : undefined);
        el.style.transform = `translate3d(${pos[i].x.toFixed(1)}px, ${pos[i].y.toFixed(1)}px, 0)`;
        const ver = d.visible ? 'si' : 'no';
        if (el.dataset.ver !== ver) el.dataset.ver = ver;
        if (el.dataset.accion !== d.accion) el.dataset.accion = d.accion;
      }
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [quieto]);

  // Sin movimiento: todo quieto en su estado final, dibujado por React.
  const final = useMemo(() => (quieto ? tiemposFinales(escena) : null), [quieto, escena]);
  const camaraQuieta = final ? camaraDe(escena, final, FINAL, medida.alto) : 0;

  return (
    <div className="wr-escenario" data-etapa={escena.etapa} style={{ ['--wr-acento' as string]: acento }}>
      <style href="ca-cursor" precedence="medium">{CSS_CURSOR}</style>
      <style href="wr-escenario" precedence="medium">{CSS_ESCENARIO}</style>
      <div className="wr-lienzo" ref={raiz} aria-hidden>
        {escena.etapa === 'arranque' && (
          <div className="wr-anillo">
            <div className="wr-puntos">
              {AGENTES.map((a, i) => <i key={a.id} style={{ background: a.color, transform: `rotate(${i * 30}deg) translateY(-22px)` }} />)}
              <b className="wr-centro" />
            </div>
            <span className="wr-anillo-texto">{leyendo || 'Leyendo la página'}</span>
          </div>
        )}
        <div className="wr-pagina" ref={pagina} style={{ height: escena.alto, transform: final ? `translate3d(0, ${-camaraQuieta}px, 0)` : undefined }}>
          {escena.cajas.map((c, k) => (
            <Caja
              key={c.indice}
              c={c}
              refCaja={(el) => { cajas.current[k] = el; }}
              quieto={final ? { estado: estadoDeCaja(c, escena, final, FINAL), etiqueta: etiquetaDeCaja(c, escena, final, FINAL), letras: letrasDeCaja(c, escena, final, FINAL) } : null}
            />
          ))}
          {AGENTES.map((a, i) => {
            const d = final ? destinoDeAgente(i, escena, final, FINAL, { y: camaraQuieta, alto: medida.alto }, medida.ancho) : null;
            return (
              <CursorAgente
                key={a.id}
                ref={(el) => { cursores.current[i] = el; }}
                agente={a}
                visible={d ? d.visible : escena.etapa !== 'arranque'}
                style={d ? { transform: `translate3d(${d.p.x}px, ${d.p.y}px, 0)` } : { transform: `translate3d(${medida.ancho / 2}px, ${medida.alto / 2}px, 0)` }}
              />
            );
          })}
        </div>
      </div>
      <div className="wr-barra">
        <span className="wr-vivo"><i aria-hidden /><span className="wr-vivo-texto">MaKo en vivo</span></span>
        <span className="wr-sep" aria-hidden />
        <span className="wr-fase">{textoDeEtapa(escena, leyendo)}</span>
        {visibles < llegadas && <button type="button" className="wr-ver-todo" onClick={saltear}>Ver todo</button>}
      </div>
    </div>
  );
}

/** El escenario es una isla oscura en las dos pantallas (como el reel): sus colores no dependen del tema de la app. */
const CSS_ESCENARIO = `
.wr-escenario { --wr-fondo: #0A0D14; --wr-linea: rgba(96, 165, 250, .78); --wr-azul: #3B7DDD; --wr-tenue: rgba(255, 255, 255, .16); --wr-naranja: #F2552C; position: relative; container-type: inline-size; margin-top: 12px; height: clamp(300px, 46vw, 420px); border-radius: 12px; overflow: hidden; background: var(--wr-fondo); color: #F3F4F6; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .06); }
.wr-lienzo { position: absolute; inset: 0; overflow: hidden; }
.wr-pagina { position: absolute; left: 0; top: 0; width: 100%; will-change: transform; }
.wr-anillo { position: absolute; inset: 0 0 58px; display: grid; place-content: center; justify-items: center; gap: 16px; }
.wr-puntos { position: relative; width: 56px; height: 56px; animation: wr-gira 2.4s linear infinite; }
.wr-puntos i { position: absolute; left: 25px; top: 25px; width: 6px; height: 6px; border-radius: 50%; transform-origin: 3px 3px; }
.wr-centro { position: absolute; left: 22px; top: 22px; width: 12px; height: 12px; border-radius: 50%; background: var(--wr-naranja); box-shadow: 0 0 12px rgba(242, 85, 44, .6); }
.wr-anillo-texto { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: rgba(255, 255, 255, .62); }
.wr-caja { position: absolute; }
.wr-caja[data-estado="oculta"], .wr-caja:not([data-estado]) { visibility: hidden; }
.wr-marco { position: absolute; left: 0; top: 0; width: 100%; height: 100%; border: 1px solid var(--wr-linea); background: rgba(59, 130, 246, .10); border-radius: 3px; transition: background-color .4s, border-color .4s; }
.wr-asa { position: absolute; width: 5px; height: 5px; background: #fff; border: 1px solid var(--wr-azul); transition: opacity .3s; }
.wr-asa[data-esq="1"] { left: -3px; top: -3px; } .wr-asa[data-esq="2"] { right: -3px; top: -3px; }
.wr-asa[data-esq="3"] { left: -3px; bottom: -3px; } .wr-asa[data-esq="4"] { right: -3px; bottom: -3px; }
.wr-etiqueta { position: absolute; left: -1px; top: -18px; max-width: calc(100% + 2px); padding: 1px 7px; border-radius: 3px 3px 3px 0; background: var(--wr-azul); color: #fff; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 10px; line-height: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: opacity .25s; }
.wr-etiqueta[data-ver="no"] { opacity: 0; }
.wr-contenido { position: absolute; inset: 20px 18px 18px; display: grid; align-content: start; gap: 8px; overflow: hidden; opacity: 0; transition: opacity .35s; }
.wr-caja[data-estado="escribiendo"] .wr-contenido, .wr-caja[data-estado="escrita"] .wr-contenido, .wr-caja[data-estado="pintando"] .wr-contenido, .wr-caja[data-estado="pintada"] .wr-contenido { opacity: 1; }
.wr-titulo { margin: 0; min-height: 22px; font-size: 17px; font-weight: 800; letter-spacing: -.01em; line-height: 22px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wr-cola { opacity: .35; }
.wr-tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(40px, 1fr)); gap: 8px; }
.wr-tarjeta { height: 56px; border-radius: 5px; border: 1px solid var(--wr-tenue); transition: border-color .4s, background-color .4s; }
.wr-lineas { display: grid; gap: 6px; }
.wr-linea, .wr-vineta { height: 6px; border-radius: 3px; background: var(--wr-tenue); }
.wr-vineta { height: 5px; }
.wr-botones { display: flex; gap: 8px; margin-top: 4px; }
.wr-boton { width: 92px; height: 24px; border-radius: 5px; background: rgba(255, 255, 255, .22); transition: background-color .4s; }
.wr-boton[data-segundo] { width: 72px; background: transparent; border: 1px solid var(--wr-tenue); }
.wr-caja[data-estado="escribiendo"] .wr-marco, .wr-caja[data-estado="trazada"] .wr-marco, .wr-caja[data-estado="trazando"] .wr-marco { border-color: var(--wr-linea); }
.wr-caja[data-estado="escrita"] .wr-marco { background: rgba(255, 255, 255, .025); border-color: rgba(255, 255, 255, .07); }
.wr-caja[data-estado="escrita"] .wr-asa, .wr-caja[data-estado="pintada"] .wr-asa, .wr-caja[data-estado="pintando"] .wr-asa { opacity: 0; }
.wr-caja[data-estado="pintando"] .wr-marco, .wr-caja[data-estado="pintada"] .wr-marco { background: color-mix(in srgb, var(--wr-acento) 9%, transparent); border-color: color-mix(in srgb, var(--wr-acento) 32%, transparent); }
.wr-caja[data-estado="pintada"] .wr-boton:not([data-segundo]), .wr-caja[data-estado="pintando"] .wr-boton:not([data-segundo]) { background: var(--wr-acento); }
.wr-caja[data-estado="pintada"] .wr-tarjeta { border-color: color-mix(in srgb, var(--wr-acento) 45%, transparent); }
.wr-caja[data-estado="pintada"] .wr-titulo .wr-escrito { color: #fff; text-shadow: 0 0 18px color-mix(in srgb, var(--wr-acento) 45%, transparent); }
.wr-barra { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; max-width: calc(100% - 24px); padding: 5px 5px 5px 14px; border-radius: 9999px; background: rgba(17, 19, 24, .92); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08), 0 8px 24px rgba(0, 0, 0, .4); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
.wr-vivo { display: inline-flex; align-items: center; gap: 7px; color: #fff; font-weight: 600; }
.wr-vivo i { width: 7px; height: 7px; border-radius: 50%; background: #34D399; box-shadow: 0 0 8px #34D399; animation: wr-late 1.6s ease-in-out infinite; }
.wr-sep { width: 1px; height: 12px; background: rgba(255, 255, 255, .16); }
.wr-fase { color: rgba(255, 255, 255, .7); overflow: hidden; text-overflow: ellipsis; }
.wr-ver-todo { flex: none; padding: 5px 12px; border: 0; border-radius: 9999px; background: var(--wr-naranja); color: #fff; font: inherit; font-weight: 600; letter-spacing: inherit; text-transform: inherit; cursor: pointer; }
.wr-ver-todo:hover { filter: brightness(1.08); }
.wr-ver-todo:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.wr-escenario[data-etapa="secciones"] .wr-fase, .wr-escenario[data-etapa="diseno"] .wr-fase { color: #fff; }
@keyframes wr-gira { to { transform: rotate(360deg); } }
@keyframes wr-late { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) {
  .wr-puntos, .wr-vivo i { animation: none; }
  .wr-marco, .wr-contenido, .wr-etiqueta, .wr-asa, .wr-tarjeta, .wr-boton { transition: none; }
}
@media (max-width: 560px) { .wr-escenario { height: 320px; } }
/* Angosto (un teléfono): la barra se queda con el punto, la fase y el botón; el título de cada caja, más chico. */
@container (max-width: 480px) { .wr-vivo-texto, .wr-sep { display: none; } .wr-titulo { font-size: 14px; } }
`;
