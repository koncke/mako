'use client';

// =============================================================================
// Competitors Spy: sus piezas se juntan y se reparten en carpetas (1/11/2026)
// =============================================================================
// Martín: «https://yanny.space/studio/ ... la animación de "Sort my footage"... Eso copialo para Competitors Spy... Asegurate de que se
// vea bien». Copiada de mirar su video cuadro por cuadro: la cabecera con el estado, la fila de números, las miniaturas que entran
// volando y forman una bola, las carpetas a los dos lados, cada miniatura que vuela a la suya mientras sube la cuenta, y el cierre
// con todo desenfocado y la frase escrita encima. Las cuentas son puras: lib/spy-orden.ts.
//
// ⚠️ SON SUS PIEZAS DE VERDAD: lo que se acaba de leer, con sus miniaturas de YouTube. De Instagram no hay imagen que dure (lib/spy.ts, la
//    del CDN de Meta vence y no se guarda): esa miniatura es su texto. Sin piezas no se anima nada: SpyApp.tsx ni la monta.
// ⚠️ NO TRABA A NADIE: «Saltar» la corta, y con «reducir movimiento» no corre. Dura unos 6 segundos y sólo después de una lectura pedida: una
//    relectura sola de una ficha que ya tiene piezas no la dispara.
// ⚠️ SE MUEVE CON LA WEB ANIMATIONS API, sólo `transform` y `opacity`: 140 elementos a 60 cuadros, sin un render de React por cuadro.
// ⚠️ ANTES DE LA ANIMACIÓN, SÓLO LA CRIATURA (4/11/2026). Martín: «Donde sale MaKo, previo a la animación, no debería haber
//    absolutamente nada más en pantalla, solo la estrella de MaKo y luego la animación… muchas veces aparecen tarjetas vacías sin
//    la miniatura, y segundos después, cuando la animación ya empezó, ahí aparece la miniatura». Mientras se lee y mientras se bajan
//    las miniaturas se ve `CargandoMako` (la pieza común, que al irse vuela a su lugar) y nada más: la escena está debajo, oculta,
//    sólo para medirla. La animación arranca cuando TODAS las miniaturas se bajaron (o a los `TOPE_PRECARGA_MS`), y una que no se
//    pudo bajar entra con su texto: ninguna caja vacía.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../_components/icons';
import { CargandoMako } from '@/app/_ui/CargandoMako';
import { carpetasDe, disponer, repartirMiniaturas, type CarpetaOrden, type Disposicion } from '@/lib/spy-orden';
import { NOMBRE_CANAL } from '@/lib/spy-reglas';
import { miniaturaDePieza } from '@/lib/spy-vista';
import type { PiezaVista } from './actions';
import { espera, precargarTodas, quieto } from './precarga';

const CSS = `
.spyo{position:relative;display:flex;flex-direction:column;gap:12px;min-height:max(540px,calc(100dvh - 210px))}
.spyo[data-lista='false'] > :not(.cm-carga){visibility:hidden}
.spyo-cab{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.spyo-titulo{margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em;color:var(--ink)}
.spyo-titulo em{font-family:Georgia,'Times New Roman',serif;font-weight:500;color:var(--primary)}
.spyo-estado{margin-left:auto;display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);font-size:12.5px;color:var(--dim)}
.spyo-estado i{width:7px;height:7px;border-radius:50%;background:var(--primary);animation:spyoLatido 1.1s ease-in-out infinite}
.spyo-saltar{height:32px;padding:0 12px;border:0;border-radius:999px;background:none;color:var(--dim);font:inherit;font-size:12.5px;cursor:pointer}
.spyo-saltar:hover{background:var(--velo-hover);color:var(--ink)}
.spyo-numeros{display:flex;border:1px solid var(--border);border-radius:14px;background:var(--surface);overflow:hidden}
.spyo-numero{flex:1 1 0;min-width:0;padding:10px 16px;border-left:1px solid var(--border)}
.spyo-numero:first-child{border-left:0;background:color-mix(in srgb,var(--primary) 7%,transparent)}
.spyo-numero span{display:block;font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spyo-numero b{display:block;margin-top:2px;font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ink)}
.spyo-escena{position:relative;flex:1;min-height:420px;border-radius:16px;overflow:hidden;background:radial-gradient(60% 70% at 50% 50%,color-mix(in srgb,var(--primary) 10%,transparent),transparent 72%)}
.spyo-mundo{position:absolute;inset:0;transform-origin:50% 50%}
.spyo-carpeta{position:absolute;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:14px;background:var(--surface);box-shadow:0 6px 20px rgba(18,21,27,.07);opacity:0;transform:translateY(8px) scale(.97);transition:opacity .38s ease,transform .38s cubic-bezier(.2,.8,.2,1)}
.spyo-carpeta[data-visible='true']{opacity:1;transform:none}
.spyo-carpeta-cab{display:flex;align-items:center;gap:6px;height:38px;padding:0 10px;color:var(--ink);font-size:12.5px;font-weight:600}
.spyo-carpeta-cab span{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.spyo-carpeta-cab small{display:block;font-size:10px;font-weight:500;color:var(--dim)}
.spyo-carpeta-cab b{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
.spyo-mini{position:absolute;left:0;top:0;border-radius:22%;background:var(--surface);border:2px solid #fff;box-shadow:0 2px 7px rgba(18,21,27,.28);overflow:hidden;will-change:transform,opacity;opacity:0;display:grid;place-items:center;color:#fff}
.spyo-mini img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.spyo-mini[data-canal='instagram']{background:linear-gradient(140deg,#F58529,#DD2A7B 55%,#8134AF)}
.spyo-mini[data-canal='youtube']{background:#23252B}
.spyo-mini[data-canal='anuncios']{background:linear-gradient(140deg,#2F6BFF,#1B3FA8)}
.spyo-mini p{position:absolute;inset:0;margin:0;padding:12%;font-size:7px;line-height:1.25;font-weight:600;overflow:hidden;color:#fff}
.spyo-fin{position:absolute;inset:0;display:grid;place-items:center;background:color-mix(in srgb,var(--bg) 40%,transparent);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);opacity:0;pointer-events:none;transition:opacity .28s ease;z-index:3}
.spyo-fin[data-visible='true']{opacity:1}
.spyo-fin p{margin:0;font-size:clamp(26px,4vw,42px);font-weight:800;letter-spacing:-.03em;color:var(--ink)}
.spyo-fin i{display:inline-block;width:3px;height:.9em;margin-left:3px;vertical-align:-.08em;background:var(--primary);animation:spyoLatido .7s steps(2) infinite}
@keyframes spyoLatido{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.spyo-estado i,.spyo-fin i{animation:none}}
@media (max-width:640px){.spyo-numero{padding:8px 10px}.spyo-numero b{font-size:17px}.spyo-titulo{font-size:18px}}
`;

type Fase = 'leyendo' | 'juntando' | 'ordenando' | 'fin';
const ESTADO: Record<Fase, string> = { leyendo: 'Leyendo sus canales', juntando: 'Juntando sus piezas', ordenando: 'Ordenando por formato', fin: 'Listo' };
/** Un orden mezclado pero siempre el mismo: que no se vacíe la bola de afuera hacia adentro. */
const mezclado = (n: number) => Array.from({ length: n }, (_, i) => i).sort((a, b) => ((a * 2654435761) >>> 0) % 997 - ((b * 2654435761) >>> 0) % 997);
const mover = (x: number, y: number, rot: number, escala: number, lado: number) => `translate(${x - lado / 2}px,${y - lado / 2}px) rotate(${rot}deg) scale(${escala})`;

/** Cuántas piezas de cada tipo hay, para la fila de números: una carpeta es un tipo de contenido (`carpetasDe`). */
function formatos(carpetas: readonly CarpetaOrden[]) {
  return carpetas.map((c) => ({ tipo: c.clave, rotulo: c.rotulo, cs: [c] }));
}

export function PeliculaDeOrden({ nombre, piezas, onTerminar }: {
  nombre: string;
  /** null = todavía se está leyendo. */
  piezas: readonly PiezaVista[] | null;
  onTerminar: () => void;
}) {
  const escena = useRef<HTMLDivElement>(null);
  const mundo = useRef<HTMLDivElement>(null);
  const terminar = useRef(onTerminar);
  terminar.current = onTerminar;
  const [dispo, setDispo] = useState<Disposicion | null>(null);
  const [fase, setFase] = useState<Fase>('leyendo');
  const [juntadas, setJuntadas] = useState(0);
  const [llegaron, setLlegaron] = useState<Record<string, number>>({});
  const [frase, setFrase] = useState('');
  /** Las piezas cuya miniatura ya se bajó. null = todavía se están bajando (o leyendo): se ve sólo la criatura. */
  const [bajadas, setBajadas] = useState<Set<number> | null>(null);

  const carpetas = useMemo(() => (piezas ? carpetasDe(piezas) : []), [piezas]);
  const visibles = useMemo(() => repartirMiniaturas(carpetas), [carpetas]);
  const total = carpetas.reduce((s, c) => s + c.n, 0);
  // Una miniatura por pieza dibujada, con su carpeta y su hueco adentro.
  const minis = useMemo(() => {
    if (!piezas) return [];
    const porId = new Map(piezas.map((p) => [p.id, p]));
    return carpetas.flatMap((c) => (visibles.get(c.clave) ?? []).map((id, hueco) => ({ pieza: porId.get(id)!, clave: c.clave, hueco })));
  }, [piezas, carpetas, visibles]);

  // Llegaron las piezas: se bajan TODAS sus miniaturas antes de arrancar.
  useEffect(() => {
    if (!piezas) return;
    if (!total || quieto()) return;
    let vivo = true;
    const conImagen = minis.map((m) => ({ id: m.pieza.id, url: miniaturaDePieza(m.pieza) })).filter((m): m is { id: number; url: string } => !!m.url);
    void precargarTodas(conImagen).then((ok) => { if (vivo) setBajadas(ok); });
    return () => { vivo = false; };
  }, [piezas, total, minis]);

  // Con las miniaturas bajadas, se mide la escena (está debajo de la criatura, oculta) y se calcula dónde cae todo.
  useLayoutEffect(() => {
    if (!piezas) return;
    if (!total || quieto()) { terminar.current(); return; }
    if (!bajadas) return;
    const r = escena.current?.getBoundingClientRect();
    if (!r?.width || !r.height) { terminar.current(); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hay que medir el DOM: no hay cómo calcularlo antes
    setDispo(disponer(r.width, r.height, carpetas, visibles));
  }, [piezas, total, carpetas, visibles, bajadas]);

  // La película.
  useEffect(() => {
    if (!dispo || !escena.current) return;
    let vivo = true;
    const anims: Animation[] = [];
    const lado = dispo.ladoBola;
    const els = [...escena.current.querySelectorAll<HTMLElement>('[data-mini]')];
    const rects = new Map(dispo.carpetas.map((c) => [c.clave, c]));
    const correr = async () => {
      // Las imágenes ya están bajadas (`bajadas`): se dibujan en el primer cuadro, sin cajas vacías que se llenan después.
      const imgs = [...escena.current!.querySelectorAll('img')];
      await Promise.race([Promise.allSettled(imgs.map((i) => i.decode())), espera(300)]);
      if (!vivo) return;

      // 1. Entran volando desde afuera y forman la bola, y el número sube con ellas.
      setFase('juntando');
      const lejos = Math.hypot(dispo.centro.x, dispo.centro.y) * 1.25;
      const pasoEntrada = Math.min(14, 1250 / Math.max(1, els.length));
      els.forEach((el, i) => {
        const p = dispo.bola[i];
        const a = i * 2.399963 + 1.1;
        anims.push(el.animate([
          { transform: mover(dispo.centro.x + Math.cos(a) * lejos, dispo.centro.y + Math.sin(a) * lejos, p.rot * 4, 0.55, lado), opacity: 0 },
          { opacity: 1, offset: 0.3 },
          { transform: mover(p.x, p.y, p.rot, 1, lado), opacity: 1 },
        ], { duration: 820, delay: i * pasoEntrada, easing: 'cubic-bezier(.16,.84,.3,1)', fill: 'both' }));
      });
      if (mundo.current) anims.push(mundo.current.animate([{ transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 2400, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }));
      const duracionEntrada = els.length * pasoEntrada + 820;
      const inicio = performance.now();
      const contar = () => {
        if (!vivo) return;
        const t = Math.min(1, (performance.now() - inicio) / duracionEntrada);
        setJuntadas(Math.round(total * t));
        if (t < 1) requestAnimationFrame(contar);
      };
      requestAnimationFrame(contar);
      await espera(duracionEntrada + 220);
      if (!vivo) return;

      // 2. Aparecen las carpetas y cada una se lleva las suyas, en un orden mezclado: la bola se vacía de a poco por todos lados.
      setFase('ordenando');
      await espera(420);
      if (!vivo) return;
      const orden = mezclado(els.length);
      const pasoOrden = Math.min(22, 1900 / Math.max(1, els.length));
      await Promise.all(orden.map((i, k) => {
        const el = els[i];
        const p = dispo.bola[i];
        const c = rects.get(el.dataset.clave ?? '');
        const hueco = c?.huecos[Number(el.dataset.hueco)];
        if (!c || !hueco) return Promise.resolve();
        const escala = c.lado / lado;
        const medio = { x: (p.x + hueco.x) / 2, y: (p.y + hueco.y) / 2 - 26 };
        // Desde donde quedó: sin esto, el `fill` de la entrada le gana.
        const a = el.animate([
          { transform: mover(p.x, p.y, p.rot, 1, lado), opacity: 1 },
          { transform: mover(medio.x, medio.y, p.rot / 2, Math.max(escala, 0.85) * 1.06, lado), opacity: 1, offset: 0.48 },
          { transform: mover(hueco.x, hueco.y, 0, escala, lado), opacity: 1 },
        ], { duration: 640, delay: k * pasoOrden, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'both' });
        anims.push(a);
        return a.finished.then(() => { if (vivo) setLlegaron((v) => ({ ...v, [c.clave]: (v[c.clave] ?? 0) + 1 })); }, () => {});
      }));
      if (!vivo) return;
      await espera(380);
      if (!vivo) return;

      // 3. El cierre: todo se desenfoca y la frase se escribe encima.
      setFase('fin');
      const texto = `${total} ${total === 1 ? 'pieza ordenada' : 'piezas ordenadas'}`;
      for (let i = 1; i <= texto.length && vivo; i += 1) { setFrase(texto.slice(0, i)); await espera(26); }
      await espera(520);
      if (vivo) terminar.current();
    };
    void correr();
    return () => { vivo = false; anims.forEach((a) => a.cancel()); };
  }, [dispo, total]);

  const mostrado = (c: CarpetaOrden) => {
    const dibujadas = visibles.get(c.clave)?.length ?? 0;
    return dibujadas ? Math.round((c.n * (llegaron[c.clave] ?? 0)) / dibujadas) : 0;
  };

  const lista = dispo != null;
  return (
    <div className="spyo" aria-live="polite" data-lista={lista}>
      <style>{CSS}</style>
      {!lista && <CargandoMako cubre que={`lo que publica ${nombre}`} size={88} />}
      <div className="spyo-cab">
        <h2 className="spyo-titulo">Ordenando lo que publica <em>{nombre}</em></h2>
        <span className="spyo-estado"><i />{ESTADO[fase]}</span>
        {lista && <button type="button" className="spyo-saltar" onClick={onTerminar}>Saltar</button>}
      </div>
      <div className="spyo-numeros">
        <div className="spyo-numero"><span>Piezas</span><b>{juntadas}</b></div>
        {formatos(carpetas).slice(0, 3).map((f) => (
          <div key={f.tipo} className="spyo-numero"><span>{f.rotulo}</span><b>{f.cs.reduce((s, c) => s + mostrado(c), 0)}</b></div>
        ))}
        <div className="spyo-numero"><span>Carpetas</span><b>{fase === 'ordenando' || fase === 'fin' ? carpetas.length : 0}</b></div>
      </div>
      <div className="spyo-escena" ref={escena}>
        <div className="spyo-mundo" ref={mundo}>
          {dispo?.carpetas.map((r) => {
            const c = carpetas.find((x) => x.clave === r.clave);
            if (!c) return null;
            return (
              <div key={r.clave} className="spyo-carpeta" data-visible={fase === 'ordenando' || fase === 'fin'} style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
                <div className="spyo-carpeta-cab">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>
                  <span>{c.rotulo}<small>{NOMBRE_CANAL[c.canal as keyof typeof NOMBRE_CANAL] ?? c.canal}</small></span>
                  <b>{mostrado(c)}</b>
                </div>
              </div>
            );
          })}
          {dispo && minis.map((m) => {
            // Sólo la que ya se bajó: la que falló entra con su texto, nunca como una caja vacía que se llena a mitad de camino.
            const mini = bajadas?.has(m.pieza.id) ? miniaturaDePieza(m.pieza) : null;
            return (
              <div key={m.pieza.id} className="spyo-mini" data-mini="" data-clave={m.clave} data-hueco={m.hueco} data-canal={m.pieza.canal} style={{ width: dispo.ladoBola, height: dispo.ladoBola }}>
                {mini
                  // eslint-disable-next-line @next/next/no-img-element -- la miniatura la sirve YouTube, y no pasa por nuestro optimizador
                  /* `referrerPolicy="no-referrer"`: el CDN de Meta devuelve 403 a la imagen pedida
                     desde otro dominio, y sin esto la película volaba cajas vacías (Martín, 2/11). */
                  ? <img src={mini} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  : m.pieza.texto ? <p>{m.pieza.texto.slice(0, 60)}</p> : <Icon name={m.pieza.canal === 'anuncios' ? 'meta' : 'instagram'} size={Math.round(dispo.ladoBola * 0.42)} />}
              </div>
            );
          })}
        </div>
        <div className="spyo-fin" data-visible={fase === 'fin'}><p>{frase}<i /></p></div>
      </div>
    </div>
  );
}
