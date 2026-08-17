'use client';

// =============================================================================
// La bienvenida — datos de FICCIÓN, grafo REAL
// =============================================================================
// Tres tiempos, y los dos primeros los dispara un click:
//
//   0. «Tus anuncios» solo, centrado y enorme.
//   1. (click) Los cinco pilares: Tu Negocio, Tu Oferta, Tu Avatar, Tu Mensaje, Tu Funnel.
//   2. (click) Todo: el cerebro entero.
//   3. El mapa sube, se achica, y recién ahí entra el texto.
//
// ⚠️ LAS DOS DECISIONES CONVIVEN, y cada una se ganó por separado:
//
//  · LOS DATOS SON FICCIÓN (lib/bienvenida-cerebro.ts). El cliente que ve esta pantalla no
//    tiene datos: medido contra un workspace reseteado, su cerebro real son 25 nodos y casi
//    todos son etapas de un funnel que él no armó. «Justamente esto es ficción, es un grafo
//    sin info».
//  · EL GRAFO ES EL DE VERDAD, el mismo de /second-brain. Se arrastra un nodo y no
//    atropella a los otros, se toca uno y la cámara vuela hasta él, se panea y se hace
//    zoom. «Que se comporte como el que ya tenemos… que se puedan clickear, que se pueda
//    arrastrar, que haga todo lo que hoy en día ya hacemos».
//
// ⚠️ ENTRE LAS DOS HUBO UNA VERSIÓN A MANO Y FALLÓ POR ALGO QUE VALE ANOTAR: un SVG propio
// con los nodos animados por rAF y las aristas como `<line>` de coordenadas fijas. Los
// nodos flotaban y las líneas no, así que se despegaban — reportado como «se rompe la
// animación». No era un detalle a parchar: era la tercera reimplementación de algo que este
// componente ya hace bien. Mover un nodo es mover TODO lo que lo toca, y eso ya está
// resuelto acá.
//
// Y la forma tampoco se dibuja a mano: el mapa a mano eran anillos concéntricos calculados
// con trigonometría, o sea un ÁRBOL radial. Ahora la ficción pasa por `layoutCerebro` como
// cualquier cerebro real, y su forma está MEDIDA contra los mismos cuatro umbrales
// (densidad, hojas, hub, clustering) en tests/bienvenida-cerebro.test.ts.
//
// CÓMO SE HACE EL REVELADO SIN TOCAR EL GRAFO. No hace falta ninguna prop nueva: se le
// pasa un `cerebro` que CRECE. `Grafo` calcula su `bbox` sobre los nodos que recibe
// (Grafo.tsx:893) y `ajustar()` centra y escala contra ese bbox (Grafo.tsx:908) — así que
// un subconjunto se encuadra y se centra SOLO, y con un nodo único queda gigante en el
// medio. Las aristas se descartan solas cuando les falta una punta, y los nodos que
// llegan hacen su animación de entrada porque su `<g>` monta.
//
// ⚠️ ESTO DESTAPÓ UN BUG VIVO DE /second-brain, arreglado en el mismo commit: el efecto
// del bucle tenía `pintar` en las dependencias, y `pintar` cambia cuando cambia lo
// visible. Cada cambio reiniciaba `t0` y TODOS los nodos volvían a nacer desplazados. O
// sea que filtrar disparaba el mapa entero. Ver el comentario en Grafo.tsx.
//
// Y los tres tiempos ahora son SEMÁNTICOS. La versión con datos reales tuvo que cortar por
// un número, porque el mapa de un cliente nuevo no tiene pilares (`cerebro-grafo.ts:900`
// solo crea un padre si dos de sus áreas tienen contenido). La ficción los tiene, así que
// cada click revela una capa que significa algo.
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/app/_ui';
import { Grafo } from '@/app/second-brain/Grafo';
import { TemaOscuro } from '@/app/_components/TemaOscuro';
import { filtroVacio, type EstadoFiltro } from '@/lib/cerebro-filtro';
import type { Cerebro } from '@/lib/cerebro-modelo';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Cuánto se espera antes de sugerir el click. Suficiente para leer el nodo y dudar. */
const MS_PISTA = 3200;
/** Lo que tarda el último paso en asentarse antes de subir el mapa. */
const MS_CIERRE = 2100;

/**
 * Lo que rota al final de la frase. NO son adjetivos: son las cinco cosas que MaKo hace de
 * verdad, así el efecto de tipeo hace doble trabajo y es también la lista de features. Si
 * mañana MaKo deja de hacer alguna, esta lista miente — y es el único lugar donde hay que
 * acordarse.
 *
 * El punto va ADENTRO: así se tipea y se borra con la frase, que es como se escribe de
 * verdad. Puesto afuera, la línea se leía «…para escalar tus anun.» durante todo el tipeo.
 */
const FINALES = [
  'crecer tu negocio.',
  'escalar tus anuncios.',
  'cerrar más llamadas.',
  'llenar tu agenda.',
  'que tus leads te respondan.',
];

/**
 * Velocidades del tipeo, calibradas para que se lea como UNA PERSONA escribiendo: 165 ms
 * son unas 55 palabras por minuto. Y no es constante — el jitter le suma hasta 70 ms al
 * azar por letra, porque un intervalo PERFECTO es la firma de que lo escribe una máquina y
 * el ojo lo detecta aunque no sepa decir por qué.
 *
 * Borrar va más rápido porque en la vida real uno borra de un saque.
 */
const MS_LETRA = 165;
const MS_BORRAR = 62;
const MS_JITTER = 70;
const MS_QUIETA = 2600;

/**
 * Lo que la PRIMERA frase se queda quieta, y es más del doble que las demás a propósito.
 *
 * ⚠️ LA PRIMERA NO SE LEE EN EL MISMO TIEMPO QUE LAS OTRAS, aunque esté los mismos
 * milisegundos en pantalla. Las que siguen aparecen dentro de un ritmo que el ojo ya viene
 * siguiendo. La primera llega junto con el fundido del bloque, el título y el botón —
 * compite con todo eso— y encima no se escribe (arranca completa, para que el HTML del
 * server coincida con el del cliente), así que tampoco tiene el barrido de letras que le
 * avisa al ojo dónde mirar.
 *
 * Reportado tal cual: «no se llega a leer eso apenas aparece porque al segundo ya se
 * comienza a borrar». El reloj empezaba a correr cuando el bloque asomaba.
 */
const MS_QUIETA_PRIMERA = 5600;

/**
 * Un cuadrado alrededor de los nodos que se ven. El grafo encuadra contra el CENTRO de
 * este cuadro, así que tiene que seguir a lo que está montado o el recorte queda
 * descentrado. Con un solo nodo se usa un lado mínimo: un cuadrado del tamaño del punto
 * daría un zoom absurdo.
 */
function encuadreDe(
  nodos: Cerebro['nodos'],
  posiciones: Cerebro['posiciones'],
  original: Cerebro['encuadre'],
): Cerebro['encuadre'] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodos) {
    const p = posiciones[n.id];
    if (!p) continue;
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  if (!Number.isFinite(x0)) return original;
  const lado = Math.max(x1 - x0, y1 - y0, original.lado * 0.14) * 1.25;
  return { x: (x0 + x1) / 2 - lado / 2, y: (y0 + y1) / 2 - lado / 2, lado };
}

/**
 * Los tres tiempos del revelado, y qué ids entra cada uno.
 *
 * Los ids son los del cerebro de FICCIÓN (lib/bienvenida-cerebro.ts): la raíz, los cinco
 * pilares con prefijo n1:, y después las hojas y los formatos.
 *
 * Con la ficción el nivel 1 SÍ existe, y eso es lo que hace posibles los tres tiempos que
 * pidió el dueño: el mapa REAL de un cliente nuevo no tiene pilares —cerebro-grafo.ts solo
 * crea un padre cuando dos de sus áreas tienen contenido— así que la versión anterior tuvo
 * que partir las áreas al medio por un número. Acá el corte es semántico.
 */
function idsDelPaso(cerebro: Cerebro, paso: number): Set<string> {
  const todos = cerebro.nodos.map((n) => n.id);
  if (paso >= 2) return new Set(todos);
  if (paso === 0) return new Set(['raiz']);
  return new Set(['raiz', ...todos.filter((id) => id.startsWith('n1:'))]);
}

export function Bienvenida({ cerebro, adminBar, onComenzar }: {
  /** El mapa de FICCIÓN, ya con las posiciones que calculó el server. */
  cerebro: Cerebro;
  /** La barra del modo agencia. Se DIBUJA ACÁ ADENTRO, no se tapa: es la única salida del
   *  modo agencia, y una pantalla a pantalla completa que la cubre deja al dueño sin forma
   *  de volver. Ya pasó una vez en este repo. */
  adminBar?: ReactNode;
  onComenzar: () => void;
}) {
  const [paso, setPaso] = useState(0);
  const [pista, setPista] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [filtro, setFiltro] = useState<EstadoFiltro>(filtroVacio);

  const conTexto = paso >= 3;

  /**
   * El cerebro RECORTADO al paso. Es todo el truco: `Grafo` saca su encuadre de los nodos
   * que recibe, así que darle menos lo hace acercarse solo. Las posiciones no se tocan —
   * las calculó el server— y por eso cada nodo aparece siempre en su lugar definitivo.
   */
  const cerebroPaso = useMemo(() => {
    if (paso >= 2) return cerebro;
    const ids = idsDelPaso(cerebro, paso);
    const nodos = cerebro.nodos.filter((n) => ids.has(n.id));
    return {
      ...cerebro,
      nodos,
      aristas: cerebro.aristas.filter((a) => ids.has(a.de) && ids.has(a.a)),
      // ⚠️ Y EL ENCUADRE TAMBIÉN SE RECORTA. Recortar solo los nodos no alcanza: el
      // `encuadre` es el viewBox y su centro es contra el que `ajustar` centra la cámara
      // (Grafo.tsx:929). Dejando el del mapa completo, el nodo único quedaba abajo a la
      // izquierda — medido — porque se lo centraba contra el centro de OTRO cuadro.
      // Con un cuadrado propio alrededor de lo que se ve, el paso 0 queda en el medio.
      encuadre: encuadreDe(nodos, cerebro.posiciones, cerebro.encuadre),
    };
  }, [cerebro, paso]);

  // La pista aparece SOLO en el primer paso: después el usuario ya entendió que se toca, y
  // repetírselo sería tratarlo de tonto.
  useEffect(() => {
    if (paso !== 0) { setPista(false); return; }
    const t = setTimeout(() => setPista(true), MS_PISTA);
    return () => clearTimeout(t);
  }, [paso]);

  // El último paso no espera otro click: cuando el cerebro terminó de armarse, el mapa
  // sube solo y entra el texto. Pedir un click más ahí sería pedirlo para nada.
  useEffect(() => {
    if (paso !== 2) return;
    const t = setTimeout(() => setPaso(3), MS_CIERRE);
    return () => clearTimeout(t);
  }, [paso]);

  // Quien pidió menos movimiento entra al RESULTADO, no al camino.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPaso(3);
  }, []);

  const avanzar = useCallback(() => setPaso((p) => (p < 2 ? p + 1 : p)), []);
  const arrancar = useCallback(() => {
    setSaliendo((s) => { if (!s) onComenzar(); return true; });
  }, [onComenzar]);

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (!conTexto) { avanzar(); return; }
      if (e.key === 'Enter' || e.key === ' ') arrancar();
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [conTexto, avanzar, arrancar]);

  return (
    <div className={`bv bv-p${paso}${saliendo ? ' bv-fuera' : ''}`}>
      <style>{ESTILOS}</style>

      {/* Sin esto los títulos del mapa se dibujan con el --ink del tema CLARO: negro sobre
          negro. Están en el DOM, tienen su caja, y no se ven. */}
      <TemaOscuro />

      {/* ⚠️ ARRIBA Y EN FLUJO. La barra es sticky con z-index 100 y esta pantalla era fixed
          con 60: le perdía y tapaba la franja de arriba, que es donde el mapa se centra.
          Dibujarla acá adentro resuelve las dos cosas — no la tapa Y el alto lo resuelve el
          layout, sin descontar un número que se rompe cuando la barra envuelve.
          El stopPropagation no es opcional: sin él, tocar «Salir de la vista» avanza el
          revelado. */}
      {adminBar && (
        <div style={{ flex: 'none', position: 'relative', zIndex: 6 }}
             onPointerUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {adminBar}
        </div>
      )}

      <div className="bv-lienzo" onClick={() => { if (!conTexto) avanzar(); }}>
        <div className="bv-velo" />

        {/* El mapa queda VIVO: se puede arrastrar y tocar un nodo desde el primer instante,
            que es lo que el dueño pidió. Lo que no se ve es su chrome — el filtro, el
            tirador y el navegador lateral son la interfaz de /second-brain, no la de una
            portada. Se apaga con CSS acotado y lo cuida tests/bienvenida.test.ts. */}
        <div className="bv-mapa">
          <Grafo cerebro={cerebroPaso} filtro={filtro} onFiltro={setFiltro} />
        </div>

        <div className={`bv-pista${pista && paso === 0 ? ' bv-pista-on' : ''}`} aria-live="polite">
          Toca en cualquier lugar
        </div>
      </div>

      <div className="bv-pie">
        <h1 className="bv-titulo">Bienvenido a MaKo</h1>
        <p className="bv-golpe">
          Nunca más vas a tener que adivinar qué hacer para <Maquina activo={conTexto} />
        </p>
        <div className="bv-accion">
          <Button variant="primary" size="lg" full className="bv-boton" onClick={arrancar} disabled={!conTexto}>
            Comenzar
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * El final de la frase, escribiéndose y borrándose.
 *
 * ⚠️ ARRANCA CON LA PRIMERA FRASE COMPLETA, no vacía: así el HTML del server y el del
 * cliente coinciden. Si empezara vacía, el primer pintado diría «…para .» y después
 * saltaría. Y de paso es el orden natural — se lee, después se borra.
 */
function Maquina({ activo }: { activo: boolean }) {
  const [i, setI] = useState(0);
  const [largo, setLargo] = useState(FINALES[0].length);
  const [borrando, setBorrando] = useState(false);
  const [quieto, setQuieto] = useState(false);
  /** Todavía no se borró nada: lo que está en pantalla es la frase de la entrada. */
  const [primera, setPrimera] = useState(true);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setQuieto(true);
  }, []);

  useEffect(() => {
    if (!activo || quieto) return;
    const frase = FINALES[i];
    if (!borrando && largo === frase.length) {
      // La primera espera bastante más: llega con el fundido y sin escribirse.
      const t = setTimeout(() => { setBorrando(true); setPrimera(false); }, primera ? MS_QUIETA_PRIMERA : MS_QUIETA);
      return () => clearTimeout(t);
    }
    if (borrando && largo === 0) {
      const t = setTimeout(() => { setBorrando(false); setI((x) => (x + 1) % FINALES.length); }, 320);
      return () => clearTimeout(t);
    }
    // El azar va DENTRO del efecto y no en el render: acá no rompe la hidratación —el
    // server nunca lo ejecuta— y es lo que saca el ritmo de metrónomo.
    const base = borrando ? MS_BORRAR : MS_LETRA;
    const t = setTimeout(() => setLargo((l) => l + (borrando ? -1 : 1)), base + Math.random() * MS_JITTER);
    return () => clearTimeout(t);
  }, [activo, quieto, i, largo, borrando, primera]);

  return (
    <span className="bv-maq">
      {FINALES[i].slice(0, largo)}
      {!quieto && <span className="bv-cursor" aria-hidden />}
    </span>
  );
}

// Sin comillas invertidas adentro: el CSS vive en un template literal y una comilla en un
// comentario cierra el string y rompe el build entero. Lo cuida tests/bienvenida.test.ts.
const ESTILOS = `
.bv {
  position: fixed; inset: 0;
  /* 100 para empatarle a la barra de agencia (sticky, 100) y ganarle por orden de DOM.
     Sigue por debajo de los modales, que arrancan en 130. */
  z-index: 100;
  display: flex; flex-direction: column;
  background: #14161B; overflow: hidden;
  animation: bv-in 420ms ease both;
}
.bv-fuera { animation: bv-out 420ms ease both; pointer-events: none; }
@keyframes bv-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes bv-out { from { opacity: 1 } to { opacity: 0 } }

/* Lo que sobra después de la barra. El mapa se centra ACÁ y no contra el viewport, que era
   la mitad del reclamo: con la barra puesta, el centro real no es el centro de la pantalla. */
.bv-lienzo { flex: 1; min-height: 0; position: relative; cursor: pointer; }

.bv-mapa { position: absolute; inset: 0; transition: transform 900ms cubic-bezier(.2,.7,.3,1); }
.bv-mapa > * { height: 100% }
/* Al entrar el texto el mapa sube Y SE ACHICA: el título pasa a ser lo más grande de la
   pantalla, y un mapa del mismo tamaño se lo comería. */
.bv-p3 .bv-mapa { transform: translateY(-9%) scale(.72); }

/* El chrome del grafo es la interfaz de /second-brain, no la de una portada. */
.bv-mapa .cbg { --cbg-col: 0px !important; }
.bv-mapa .cbg-barra,
.bv-mapa .cbg-tirador,
.bv-mapa .cbg-detalle { display: none !important; }

.bv-velo {
  position: absolute; inset: auto 0 0 0; height: 42%; z-index: 2;
  background: linear-gradient(to bottom, rgba(20,22,27,0) 0%, rgba(20,22,27,.92) 44%, #14161B 74%);
  opacity: 0; transition: opacity 800ms ease; pointer-events: none;
}
.bv-p3 .bv-velo { opacity: 1 }

.bv-pista {
  position: absolute; left: 50%; bottom: 7%; transform: translateX(-50%); z-index: 3;
  font-family: ${MONO}; font-size: 12px; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(243,240,231,.34);
  opacity: 0; transition: opacity 900ms ease; pointer-events: none;
}
.bv-pista-on { opacity: 1; animation: bv-respira 2.6s ease-in-out 900ms infinite; }
@keyframes bv-respira { 0%,100% { opacity: .34 } 50% { opacity: .7 } }

/* ── El pie ──────────────────────────────────────────────────────────────── */
/* Ancho grande a propósito: la frase entera tiene que entrar SIN cortarse. El botón se
   acota aparte, que si no queda de 900 px y parece una barra. */
.bv-pie {
  position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
  width: min(96vw, 900px); padding: 0 0 46px; z-index: 5;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  cursor: default;
}
.bv-accion { width: min(92vw, 460px); }

.bv-titulo, .bv-golpe { opacity: 0; }
.bv .bv-boton { opacity: 0; }
.bv-p3 .bv-titulo   { animation: bv-sube 700ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 140ms }
.bv-p3 .bv-golpe    { animation: bv-sube 700ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 420ms }
.bv.bv-p3 .bv-boton { animation: bv-sube 700ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 700ms }
@keyframes bv-sube { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: none } }

/* El protagonista. Escala con el ancho para que sea GRANDE de verdad en pantalla grande y
   no se rompa en una chica. */
.bv-titulo {
  font-family: ${SANS}; font-size: clamp(38px, 6.4vw, 78px); font-weight: 600;
  letter-spacing: -0.04em; line-height: 1; margin: 0 0 18px; color: #F8F6F0;
}
/* ⚠️ UNA SOLA LÍNEA, y por eso nowrap + un tamaño que se adapta al ancho en vez de cortar.
   La frase completa mide ~70 caracteres: con un cuerpo fijo se parte en dos justo cuando
   la parte que se tipea es la más larga, y el salto ocurre A MITAD del tipeo. */
.bv-golpe {
  font-family: ${SANS}; font-size: clamp(12px, 1.55vw, 19px); line-height: 1.45;
  color: rgba(243,240,231,.66); margin: 0 0 30px;
  white-space: nowrap;
}
/* Lo que se escribe va en tinta plena: es la parte viva de la frase. */
.bv-maq { color: #F3F0E7; font-weight: 500; }
.bv-cursor {
  display: inline-block; width: 1.5px; height: 1.05em; margin-left: 2px;
  background: var(--mako); vertical-align: text-bottom;
  animation: bv-cursor 1.1s steps(1) infinite;
}
@keyframes bv-cursor { 0%,55% { opacity: 1 } 56%,100% { opacity: 0 } }

/* Pantalla angosta: acá SÍ se deja cortar. Un nowrap a 390 px de ancho obliga a un cuerpo
   ilegible, y entre partir la frase y no poder leerla, se parte. */
@media (max-width: 700px) {
  .bv-golpe { white-space: normal; font-size: 15px; max-width: 34ch; }
  .bv-titulo { font-size: 34px }
  .bv-p3 .bv-mapa { transform: translateY(-12%) scale(.64) }
}
@media (max-height: 760px) {
  .bv-titulo { font-size: clamp(30px, 4.6vw, 46px) }
  .bv-pie { padding-bottom: 28px }
  .bv-p3 .bv-mapa { transform: translateY(-13%) scale(.62) }
}

@media (prefers-reduced-motion: reduce) {
  .bv-titulo, .bv-golpe, .bv-boton { animation: none !important; opacity: 1 !important; transform: none !important; }
  .bv-mapa { transition: none !important; }
  .bv-velo { opacity: 1 !important; transition: none !important; }
}
`;
