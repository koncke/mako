'use client';

// =============================================================================
// El ejemplo del formato: UN nodo, tres estaciones
// =============================================================================
// Martín pidió dos animaciones y son la misma:
//
//   5. «al seleccionar un template en la página principal, que haga una animación
//      y se ponga en el centro, desapareciendo a los otros templates, porque
//      elegiste ese»
//   4. «al darle siguiente, haga una animación y se coloque al costado, donde se
//      va a previsualizar durante toda la creación, y donde se puede ocultar»
//
// Son dos tramos de UN recorrido: la tarjeta que apretaste → el centro → el
// costado. Y por eso no son dos piezas: es un solo `<video>` que nunca se
// desmonta y que cambia de destino.
//
// ⚠️ POR QUÉ UN SOLO NODO Y NO DOS QUE SE CRUZAN. Un fantasma que aparece encima
// mientras el real se desmonta funciona hasta que algo lo interrumpe —apretar dos
// veces, volver atrás, cambiar de pestaña— y ahí quedan dos videos o ninguno.
// Con un nodo que sólo cambia de caja, interrumpir en el medio deja el video en
// una posición intermedia y el siguiente destino lo recoge desde ahí. No hay
// estado que reconciliar.
//
// Y es lo que hace que el ejemplo se lea como referencia sin gastar una palabra:
// la persona VE que la cosa que eligió es la misma que se corrió al costado.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../_components/icons';
import type { Puesta } from '@/lib/puestas-data';

/** La curva de la casa. Ya está tres veces en ui.css. */
const CURVA = 'cubic-bezier(.16,.84,.34,1)';
/**
 * ⚠️ 900 y no 520. El dueño: «quiero que la preview se desplace más lento a la
 * derecha». No es gusto: el viaje al riel es lo ÚNICO que explica por qué esa
 * cosa está al costado —la persona tiene que poder seguirla con el ojo— y a 520
 * ms sobre ~700 px el ojo la pierde y aparece ya puesta, que se lee como que se
 * dibujó otra.
 */
const MS = 900;

export type Estacion = 'tarjeta' | 'centro' | 'riel';

/**
 * Anima un elemento fijo de su caja actual a la caja de destino.
 *
 * FLIP a mano y no la View Transitions API: la segunda anima entre dos ESTADOS
 * del documento y acá el nodo no cambia de lugar en el árbol —siempre está fijo—,
 * así que no habría nada que transicionar. Y no se suma ninguna librería: son
 * doce líneas de `Element.animate`, que es API del navegador.
 */
function volar(el: HTMLElement, hasta: DOMRect, alTerminar?: () => void) {
  const desde = el.getBoundingClientRect();
  // Escala uniforme: las tres cajas son 9:16 por construcción, así que alcanza con
  // una. Escalar los dos ejes por separado deformaría la cara si alguna caja no
  // respetara la proporción.
  // Hoy vale 1 en el viaje del centro al riel —las dos cajas miden lo mismo, que
  // es lo que pidió el dueño: «que mantenga su tamaño»—. Se calcula igual porque
  // el viaje desde la TARJETA del catálogo sí escala.
  const escala = desde.width === 0 ? 1 : hasta.width / desde.width;
  const dx = hasta.left + hasta.width / 2 - (desde.left + desde.width / 2);
  const dy = hasta.top + hasta.height / 2 - (desde.top + desde.height / 2);

  // ⚠️ El destino se escribe ANTES de animar, y la animación va al revés: del
  // lugar viejo al nuevo. Así, si algo la interrumpe, el elemento ya está donde
  // tiene que estar en vez de quedarse a mitad de camino para siempre.
  // ⚠️ La caja se escribe SIN transición: acá el movimiento lo cuenta el
  // `transform` de abajo, y dejar la transición de CSS puesta haría que las dos
  // animaciones tiren del mismo elemento hacia el mismo lado con tiempos
  // distintos. La transición existe para el otro caso —abrir y cerrar, que
  // cambian la caja sin volar— y se repone al terminar.
  el.style.transition = 'none';
  el.style.left = `${hasta.left}px`;
  el.style.top = `${hasta.top}px`;
  el.style.width = `${hasta.width}px`;
  el.style.height = `${hasta.height}px`;
  const reponer = () => { el.style.transition = ''; };

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { reponer(); alTerminar?.(); return; }

  const anim = el.animate(
    [
      { transform: `translate(${-dx}px, ${-dy}px) scale(${1 / escala})` },
      { transform: 'translate(0, 0) scale(1)' },
    ],
    { duration: MS, easing: CURVA, fill: 'none' },
  );
  anim.addEventListener('finish', () => { reponer(); alTerminar?.(); }, { once: true });
  anim.addEventListener('cancel', () => { reponer(); alTerminar?.(); }, { once: true });
}

export function PreviaVolante({ puesta, estacion, cajaTarjeta, slotCentro, slotRiel, plegado, onToggle }: {
  puesta: Puesta;
  estacion: Estacion;
  /** La caja de la tarjeta apretada, MEDIDA en el handler del click. */
  cajaTarjeta: DOMRect | null;
  slotCentro: React.RefObject<HTMLDivElement | null>;
  slotRiel: React.RefObject<HTMLDivElement | null>;
  plegado: boolean;
  onToggle: () => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const previa = useRef<Estacion | null>(null);
  const [conSonido, setConSonido] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  // Al pasar a la versión con sonido el navegador puede rechazar la reproducción.
  // Acá SÍ hubo gesto —el click en el botón— así que se pide explícitamente.
  useEffect(() => {
    if (conSonido) video.current?.play().catch(() => { /* quedan los controles */ });
  }, [conSonido]);

  // `useLayoutEffect` y no `useEffect`: se mide y se mueve ANTES de que el
  // navegador pinte. Con `useEffect` el video aparece un cuadro en la posición
  // vieja y después salta, que es justo el parpadeo que la animación viene a
  // evitar.
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;

    const destino = estacion === 'centro' ? slotCentro.current
      : estacion === 'riel' ? slotRiel.current
        : null;

    // Primera aparición: se coloca sobre la tarjeta que se apretó, sin animar —
    // el movimiento arranca recién cuando cambia de estación.
    if (previa.current === null) {
      const r = cajaTarjeta ?? destino?.getBoundingClientRect();
      // ⚠️ Sin `r` el nodo queda SIN `left`/`top`, y un `position: fixed` sin
      // coordenadas se dibuja donde lo dejó el flujo — que es exactamente el
      // «flotando en el medio» del bug. Se esconde hasta que el observador de
      // abajo le encuentre destino: un ejemplo mal puesto tapa el guion, y no
      // verlo un cuadro no le cuesta nada a nadie.
      if (!r) el.style.visibility = 'hidden';
      if (r) {
        el.style.visibility = 'visible';
        el.style.left = `${r.left}px`;
        el.style.top = `${r.top}px`;
        el.style.width = `${r.width}px`;
        el.style.height = `${r.height}px`;
      }
      previa.current = estacion;
      // Si ya nació en otra estación, se vuela enseguida.
      if (estacion !== 'tarjeta' && destino) volar(el, destino.getBoundingClientRect());
      return;
    }

    if (previa.current === estacion) return;
    previa.current = estacion;
    if (destino) volar(el, destino.getBoundingClientRect());
  }, [estacion, cajaTarjeta, slotCentro, slotRiel]);

  // ⚠️ EL DESTINO SE PERSIGUE, NO SE MIDE UNA VEZ.
  //
  // El bug: entrando por un link directo (`?plan=…`) el ejemplo quedaba flotando
  // en el medio de la pantalla, encima del guion, con el riel vacío al costado.
  //
  // La causa son dos cosas que se suman. Una: este nodo se monta en TRES ramas
  // distintas del árbol, así que cambiar de vista lo REMONTA — la promesa de «un
  // solo nodo» se cumple mientras se navega con clicks, y no cuando se entra
  // directo. Dos: el `useLayoutEffect` de arriba mide el destino UNA vez, y sus
  // dependencias son objetos `ref`, que nunca cambian de identidad. Si en ese
  // instante el hueco todavía no existe o mide 0 —el riel se dibuja con un
  // `aspect-ratio` y una variable CSS que el motor resuelve un cuadro después—,
  // no hay segunda oportunidad: queda sin `left`/`top`, o sea donde caiga.
  //
  // Un `ResizeObserver` sobre el hueco contesta las dos: dispara cuando aparece,
  // cuando el layout se asienta y cuando la ventana cambia. Sin animar — esto
  // corrige una posición, no cuenta un movimiento.
  useEffect(() => {
    const reencajar = () => {
      const el = caja.current;
      const destino = estacion === 'centro' ? slotCentro.current : slotRiel.current;
      if (!el || !destino) return;
      const r = destino.getBoundingClientRect();
      // Un destino de 0×0 todavía no se resolvió: pegarse a él dejaría el ejemplo
      // invisible, que es peor que dejarlo donde está hasta el próximo aviso.
      if (r.width < 4 || r.height < 4) return;
      el.style.visibility = 'visible';
      el.style.left = `${r.left}px`;
      el.style.top = `${r.top}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
    };

    // ⚠️ SE ESPERA AL HUECO, NO SE LO DA POR PRESENTE.
    //
    // Medido: al entrar por un link directo este efecto corre ANTES de que el
    // riel exista, así que no había nada que observar y el único reintento —un
    // `requestAnimationFrame`— también llegaba temprano. Resultado: el ejemplo
    // quedaba sin destino para siempre.
    //
    // Un intento por cuadro hasta encontrarlo, con techo. El techo importa: sin
    // él, una pantalla que legítimamente no tiene riel deja un bucle corriendo
    // mientras la pestaña esté abierta.
    let obs: ResizeObserver | null = null;
    let rafId = 0;
    let intentos = 0;
    const TOPE = 180; // ~3 s a 60 fps

    const buscar = () => {
      const destino = estacion === 'centro' ? slotCentro.current : slotRiel.current;
      if (destino) {
        reencajar();
        // Ya está: de acá en más lo sigue el observador, que además avisa cuando
        // el hueco cambia de tamaño (el riel se pliega y se despliega).
        obs = new ResizeObserver(reencajar);
        obs.observe(destino);
        return;
      }
      if (++intentos > TOPE) return;
      rafId = window.requestAnimationFrame(buscar);
    };
    buscar();

    window.addEventListener('resize', reencajar);
    window.addEventListener('scroll', reencajar, { passive: true });
    return () => {
      window.cancelAnimationFrame(rafId);
      obs?.disconnect();
      window.removeEventListener('resize', reencajar);
      window.removeEventListener('scroll', reencajar);
    };
  }, [estacion, slotCentro, slotRiel]);

  const enRiel = estacion === 'riel';
  /** Cerrado sólo tiene sentido en el riel: en el centro el ejemplo ES la pantalla. */
  const cerrado = plegado && enRiel;

  /**
   * Cerrar SIEMPRE silencia.
   *
   * El dueño: «cuando se cierra, básicamente se mutea». Y es lo correcto aunque
   * no lo hubiera pedido: una miniatura de 100 px hablando en una esquina es un
   * sonido sin fuente visible — la persona busca de dónde sale en vez de escuchar.
   */
  const cerrar = () => { setConSonido(false); onToggle(); };

  return (
    <div ref={caja} className={`mk-volante${cerrado ? ' mk-volante--plegado' : ''}`}>
      <video
        ref={video}
        // La `key` es la PUESTA y no el `src`: cambiar de archivo para el sonido
        // NO puede remontar el elemento, o se pierde el nodo que estamos volando.
        key={puesta.nombre}
        src={conSonido && puesta.ejemplo?.completo ? puesta.ejemplo.completo : puesta.ejemplo?.video}
        poster={puesta.ejemplo?.poster}
        autoPlay
        loop
        muted={!conSonido || cerrado}
        playsInline
        className="mk-volante__video"
      />

      {/* CERRADO: la miniatura entera es el botón para volver a abrirla. Un
          control chico encima de algo chico es dos objetos donde alcanza uno. */}
      {cerrado && (
        <button
          type="button"
          className="mk-volante__abrir"
          onClick={onToggle}
          aria-label={`Ver el ejemplo de ${puesta.nombre}`}
        >
          <span className="mk-volante__abrir-ico"><Icon name="eye" size={16} /></span>
        </button>
      )}

      {!cerrado && (
        <>
          {/* ⚠️ EL SELLO YA NO ES UN BOTÓN. Era el que plegaba, y ahora eso lo
              hace la X de arriba: dejarlo clicable daría dos controles para la
              misma acción, uno de ellos sin ninguna marca de que lo es. Queda
              como lo que siempre fue de verdad — el rótulo que dice qué es esto. */}
          <span className="mk-sello mk-volante__sello">
            <span className="mk-volante__nombre">Ejemplo · {puesta.nombre}</span>
          </span>

          {/* CERRAR, arriba a la derecha. Donde el dueño lo pidió, y donde se lo
              busca: es la esquina donde cierra todo lo demás de la app. */}
          {enRiel && (
            <button
              type="button"
              className="mk-volante__cerrar"
              onClick={cerrar}
              title="Cerrar el ejemplo"
              aria-label="Cerrar el ejemplo"
            >
              <Icon name="x" size={15} />
            </button>
          )}

          {/* ⚠️ NO dice «desmutear»: los clips cortos NO TIENEN pista de audio
              —370 KB y 306 KB, medido— y los completos sí. El botón cambia de
              archivo. Sólo se dibuja si esa versión existe: un control que no
              puede cumplir su promesa no se dibuja. */}
          {puesta.ejemplo?.completo && (
            <button
              type="button"
              className="mk-volante__sonido"
              onClick={() => setConSonido((v) => !v)}
              aria-pressed={conSonido}
              title={conSonido ? 'Silenciar' : 'Escuchar el ejemplo'}
            >
              <Icon name={conSonido ? 'sonido' : 'mic'} size={14} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
