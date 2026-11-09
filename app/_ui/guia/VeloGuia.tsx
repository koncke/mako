'use client';

// =============================================================================
// VeloGuia — la pestaña «un poco opaca por detrás», con un hueco en lo que MaKo señala y otro en el chat (29/10/2026)
// =============================================================================
// Martín (29/10/2026): «que se siga viendo la barra lateral donde está el chat, y que Mako le pueda ir señalizando diferentes
// lugares… que la pestaña se ponga un poco opaca por detrás». docs/mako-iniciativa/guia.md §2.3 a §2.9. Montado UNA vez, en
// app/layout.tsx; dibuja lo que dice el estado de la guía (./store.ts).
//   · UNA MÁSCARA SVG con huecos: el ancla y cada chat de MaKo a la vista (`[data-mako-chat]`). El velo de los recorridos
//     (`box-shadow 200vmax`) daba UN hueco y tapaba el chat; el de `Senalar` se apagaba con la primera letra escrita en él.
//   · `pointer-events: none` EN TODA LA CAPA: no se come un clic, no atrapa el Tab, no roba el foco. Con la guía puesta se usa la
//     tab y se le escribe a MaKo. El toque lo decide `queHacerConElToque` (lib/guia/reglas.ts): en el ancla avanza; en el chat
//     nada; en otra parte de la tab, pausa (el toque llega igual).
//   · FUERA DE LA PILA DE MODALES, en el piso de los recorridos (400): debajo del toast y del «¿seguro?». Si entrara a la pila,
//     la estrella del Plan y de Clientes se subiría como sobre un modal, y «¿hay un modal abierto?» se leería mal.
//   · `--scrim` (el velo de la casa, rgba 40%) y SIN `color-mix`: en Safari < 16.2 borra el velo entero.
//   · SE RE-MIDE EN CADA CUADRO mientras señala: abrir MaKo mueve el ancla sin cambiar el DOM.
//   · Nunca se oscurece para señalar la nada: si el ancla no aparece en 1,5 s, «No lo veo en esta pantalla», sin velo.
//   · En una ventana angosta (≤ 760 px) el chat y la tab no conviven: el chat se aparta (`apartar`, lo lee la estrella) y la
//     frase va abajo, en la zona del pulgar, con «Volver al chat».
// ⚠️ La hoja es un template literal: ni un backtick adentro.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { profundidadModales } from '@/app/_components/pila-modales';
import { Z_PISO_RECORRIDO, necesitaScroll, selectorDe, type Caja, type Medida } from '@/lib/recorridos';
import { dibujoDestacado, esAngosta, huecosDelVelo, posicionFrase, type Hueco } from '@/lib/guia/huecos';
import { ANCHO_ANGOSTO, ESPERA_ANCLA_MS, ESPERA_TRAS_ANTES_MS, anclaASenalar, fraseAntes, fraseDe, queHacerConElToque } from '@/lib/guia/reglas';
import type { GuiaDeTab } from '@/lib/guia/tipos';
import { apartarChat, avanzar, destacarEnElChat, fraseEnElChat, guiaAhora, ignorarPrimeraVez, noEsta, pausar, useGuia } from './store';

const CHAT = '[data-mako-chat]';
const GLOBO = '[data-guia-globo]';
const DESTACADO = '[data-mako-destacado]';

const cajaDe = (r: DOMRect): Caja => ({ x: r.left, y: r.top, ancho: r.width, alto: r.height });
const ventana = (): Medida => ({ ancho: document.documentElement.clientWidth || window.innerWidth, alto: document.documentElement.clientHeight || window.innerHeight });
const visible = (el: Element) => el.getClientRects().length > 0 && (el as HTMLElement).getBoundingClientRect().height > 0;

/** El ancla en pantalla: las del chat, adentro de un chat de MaKo (la primera visible); las demás, la primera visible. */
function elementoDe(g: GuiaDeTab, id: string): HTMLElement | null {
  const enElChat = g.anclas.find((a) => a.id === id)?.enElChat;
  try {
    const todos = Array.from(document.querySelectorAll<HTMLElement>(selectorDe(id)));
    return todos.find((el) => visible(el) && (!enElChat || !!el.closest(CHAT))) ?? null;
  } catch { return null; }
}

type Dibujo = { huecos: Hueco[]; aro: Caja | null; frase: { x: number; y: number; texto: string } | null; angosto: { texto: string } | null };
const mismo = (a: Dibujo | null, b: Dibujo | null) => JSON.stringify(a) === JSON.stringify(b);

export function VeloGuia() {
  const e = useGuia();
  const [dibujo, setDibujo] = useState<Dibujo | null>(null);
  const fraseRef = useRef<HTMLDivElement>(null);
  /** El elemento que se señala ahora (lo mira el toque) y si es el `antes` de otro. */
  const actual = useRef<{ el: HTMLElement; antes: boolean } | null>(null);
  const activo = e.objetivo != null && e.guia != null;
  const clavePaso = activo ? `${e.objetivo!.o.id}:${e.objetivo!.i}` : null;

  // El cuadro a cuadro mientras señala: buscar el ancla, medir, y avisar cuando se hizo o cuando no está.
  useLayoutEffect(() => {
    if (!clavePaso) { setDibujo(null); actual.current = null; return; }
    let cuadro = 0;
    const inicio = performance.now();
    let tocoAntes = 0;
    let scrolleado = '';
    const tick = () => {
      cuadro = requestAnimationFrame(tick);
      const st = guiaAhora();
      const g = st.guia;
      const ob = st.objetivo;
      if (!g || !ob) return;
      const paso = ob.o.pasos[ob.i];
      if (!paso) return;
      // Un paso que se da por hecho cuando aparece otra cosa (la descarga → «Ya lo instalé: conectar»).
      if (paso.hecho && typeof paso.hecho === 'object' && elementoDe(g, paso.hecho.aparece)) { avanzar(); return; }
      const sel = anclaASenalar(g, paso, (id) => elementoDe(g, id) != null);
      if (!sel) {
        actual.current = null;
        setDibujo((d) => (d == null ? d : null));
        const espera = tocoAntes ? ESPERA_TRAS_ANTES_MS : ESPERA_ANCLA_MS;
        if (performance.now() - (tocoAntes || inicio) > espera) noEsta(profundidadModales() > 0 ? 'modal' : 'no-esta');
        return;
      }
      const el = elementoDe(g, sel.ancla)!;
      if (sel.antes && actual.current && !actual.current.antes) tocoAntes = 0;
      if (actual.current?.antes && !sel.antes) tocoAntes = 0;
      actual.current = { el, antes: sel.antes };
      // Debajo de un modal de la tab no se señala: el velo quedaría arriba de la ventana y el ancla, abajo.
      if (profundidadModales() > 0 && !el.closest('[role="dialog"]')) { noEsta('modal'); return; }
      const v = ventana();
      const ancla = g.anclas.find((a) => a.id === sel.ancla);
      const caja = cajaDe(el.getBoundingClientRect());
      if (scrolleado !== sel.ancla) {
        scrolleado = sel.ancla;
        const n = necesitaScroll(caja, v);
        // Nunca en un lienzo con overflow: hidden (corrió uno 330 px): ahí se señala donde esté.
        if (n.scroll && !ancla?.sinScroll) el.scrollIntoView({ block: n.bloque, inline: 'nearest', behavior: 'smooth' });
      }
      const texto = sel.antes ? fraseAntes(g, sel.ancla) : fraseDe(g, paso);
      fraseEnElChat(texto);
      const chats = Array.from(document.querySelectorAll<HTMLElement>(CHAT)).filter(visible).map((c) => cajaDe(c.getBoundingClientRect()));
      const enChat = !!el.closest(CHAT);
      // Angosta y el ancla es de la tab: el chat se aparta y la frase va abajo.
      const angosta = esAngosta(v.ancho, ANCHO_ANGOSTO) && !enChat;
      apartarChat(angosta);
      const medida = fraseRef.current?.getBoundingClientRect();
      const frase = angosta ? null : { ...posicionFrase({ ancla: caja, frase: { ancho: medida?.width || 260, alto: medida?.height || 40 }, ventana: v, chats: enChat ? [] : chats }), texto };
      const nuevo: Dibujo = {
        huecos: huecosDelVelo(caja, angosta ? [] : chats, v),
        aro: caja,
        frase: frase ? { x: frase.x, y: frase.y, texto } : null,
        angosto: angosta ? { texto } : null,
      };
      setDibujo((d) => (mismo(d, nuevo) ? d : nuevo));
    };
    cuadro = requestAnimationFrame(tick);

    // El toque: en el ancla avanza (después de que el clic llegue); en el chat o en el globo, nada; en otra parte, pausa.
    const alTocar = (ev: PointerEvent) => {
      const t = ev.target as Element | null;
      const a = actual.current;
      const que = queHacerConElToque({ enAncla: !!a && !!t && a.el.contains(t), enChat: !!t?.closest(CHAT), enGlobo: !!t?.closest(GLOBO) });
      if (que === 'pausa') { pausar(); return; }
      if (que !== 'avanza' || !a) return;
      if (a.antes) { tocoAntes = performance.now(); return; }
      const st = guiaAhora();
      const paso = st.objetivo?.o.pasos[st.objetivo.i];
      if (!paso?.hecho || paso.hecho === 'toque') window.setTimeout(avanzar, 0);
    };
    // Escape pausa, si no hay un modal (que es el que tiene que cerrar). Antes que el Escape del panel de la estrella.
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || profundidadModales() > 0) return;
      ev.stopImmediatePropagation();
      pausar();
    };
    document.addEventListener('pointerdown', alTocar, true);
    document.addEventListener('keydown', alTeclear, true);
    return () => {
      cancelAnimationFrame(cuadro);
      document.removeEventListener('pointerdown', alTocar, true);
      document.removeEventListener('keydown', alTeclear, true);
      apartarChat(false);
    };
  }, [clavePaso]);

  // LA PREGUNTA DE MaKo MARCADA (9/11/2026, la tab Video): sin objetivo de la guía, el velo opaca todo menos los chats y marca el
  // mensaje `[data-mako-destacado]`. Sin frase y sin avance por toque: se contesta en el chat. Con un modal arriba (el editor del
  // guion) no se dibuja: el velo vive en el piso de los recorridos, ARRIBA de la pila de modales, y lo taparía.
  const destacando = !clavePaso && e.destacado;
  useLayoutEffect(() => {
    if (!destacando) return;
    let cuadro = 0;
    const tick = () => {
      cuadro = requestAnimationFrame(tick);
      const marca = profundidadModales() > 0 ? null : Array.from(document.querySelectorAll<HTMLElement>(DESTACADO)).find((el) => visible(el) && !!el.closest(CHAT)) ?? null;
      const chats = Array.from(document.querySelectorAll<HTMLElement>(CHAT)).filter(visible).map((c) => cajaDe(c.getBoundingClientRect()));
      const d = dibujoDestacado(marca ? cajaDe(marca.getBoundingClientRect()) : null, chats, ventana());
      const nuevo: Dibujo | null = d ? { huecos: d.huecos, aro: d.aro, frase: null, angosto: null } : null;
      setDibujo((x) => (mismo(x, nuevo) ? x : nuevo));
    };
    cuadro = requestAnimationFrame(tick);
    // Usa la tab (un toque fuera de los chats): se le deja usar, y el velo se va hasta la próxima pregunta (el toque llega igual).
    const alTocar = (ev: PointerEvent) => { if (!(ev.target as Element | null)?.closest(CHAT)) destacarEnElChat(false); };
    document.addEventListener('pointerdown', alTocar, true);
    return () => { cancelAnimationFrame(cuadro); document.removeEventListener('pointerdown', alTocar, true); setDibujo(null); };
  }, [destacando]);

  // La primera vez, sin contestar: si usa la tab (un toque fuera del chat), «que lo use» (guia.md §3.3).
  const preguntando = !activo && e.guia != null && e.dice?.id === `guia:${e.guia.key}`;
  useEffect(() => {
    if (!preguntando) return;
    const alTocar = (ev: PointerEvent) => {
      const t = ev.target as Element | null;
      if (!t?.closest(CHAT) && !t?.closest(GLOBO)) ignorarPrimeraVez();
    };
    document.addEventListener('pointerdown', alTocar, true);
    return () => document.removeEventListener('pointerdown', alTocar, true);
  }, [preguntando]);

  if (!dibujo || typeof document === 'undefined') return null;
  const v = ventana();
  return createPortal(
    <div className="mk-guia" style={{ zIndex: Z_PISO_RECORRIDO }} data-guia-velo="">
      <style>{CSS}</style>
      <svg className="mk-guia__velo" width={v.ancho} height={v.alto} aria-hidden>
        <defs>
          <mask id="mk-guia-mascara">
            <rect x="0" y="0" width={v.ancho} height={v.alto} fill="white" />
            {dibujo.huecos.map((h, i) => <rect key={i} x={h.x} y={h.y} width={h.ancho} height={h.alto} rx={h.ancla ? 10 : 16} fill="black" />)}
          </mask>
        </defs>
        <rect x="0" y="0" width={v.ancho} height={v.alto} mask="url(#mk-guia-mascara)" style={{ fill: 'var(--scrim)' }} />
      </svg>
      {dibujo.aro && <div className="mk-guia__aro" aria-hidden style={{ left: dibujo.aro.x - 6, top: dibujo.aro.y - 6, width: dibujo.aro.ancho + 12, height: dibujo.aro.alto + 12 }} />}
      {dibujo.frase && <div ref={fraseRef} className="mk-guia__frase" aria-hidden style={{ left: dibujo.frase.x, top: dibujo.frase.y }}>{dibujo.frase.texto}</div>}
      {dibujo.angosto && (
        <div className="mk-guia__globo" data-guia-globo="" role="status">
          <span>{dibujo.angosto.texto}</span>
          <button type="button" onClick={() => pausar()}>Volver al chat</button>
        </div>
      )}
    </div>,
    document.body,
  );
}

// Los colores son tokens: el velo es --scrim (rgba 40%), el aro --primary. Sin color-mix (Safari < 16.2 borra la capa entera).
const CSS = `
.mk-guia { position: fixed; inset: 0; pointer-events: none; }
.mk-guia__velo { position: fixed; inset: 0; display: block; }
.mk-guia__aro { position: fixed; border-radius: 12px; box-shadow: 0 0 0 2px var(--primary); }
.mk-guia__aro::after { content: ''; position: absolute; inset: -2px; border-radius: inherit; border: 2px solid var(--primary); animation: mkGuiaLatido 1.8s ease-out infinite; }
@keyframes mkGuiaLatido { from { opacity: .7; transform: scale(1); } to { opacity: 0; transform: scale(1.06); } }
.mk-guia__frase { position: fixed; max-width: 288px; padding: 8px 12px; border-radius: 10px; background: var(--surface); color: var(--ink);
  border: 1px solid var(--border); font-size: 13px; font-weight: 600; line-height: 1.4; box-shadow: var(--shadow-md, 0 10px 28px rgba(0, 0, 0, .18)); }
.mk-guia__globo { position: fixed; left: 16px; right: 16px; bottom: 16px; pointer-events: auto; display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 14px; background: var(--surface); color: var(--ink); border: 1px solid var(--border); font-size: 14px; font-weight: 600; }
.mk-guia__globo span { flex: 1 1 auto; }
.mk-guia__globo button { min-height: 44px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-2, var(--surface));
  color: var(--ink); font: inherit; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .mk-guia__aro::after { animation: none; } }
`;
