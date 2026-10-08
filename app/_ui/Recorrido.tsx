'use client';

// =============================================================================
// Recorrido — el tutorial de app: todo se oscurece y una flecha señala la acción
// =============================================================================
// Reemplaza al recuadro de «Configura tu curso» (docs/diseno-curso-skool.md, D7), y es
// GENÉRICO: lo puede montar cualquier tab. El pedido, textual (07/10/2026): «haz el
// típico tutorial de app, donde se pone todo medio oscuro y salen flechas apuntándote a
// las acciones disponibles, como un pequeño recorrido con texto explicativo. Con botones
// de siguiente y uno para omitir tutorial».
//
//   const r = useRecorrido('cs-curso');
//   <BotonRecorrido onClick={r.reabrir} />
//   <Recorrido id="cs-curso" pasos={PASOS} abierto={r.abierto} onCerrar={r.onCerrar} />
//   … y en la pantalla, `data-recorrido="marca"` en cada cosa que se señala.
//
// Lo que decide —qué paso se saltea, dónde va la tarjeta, qué se guarda— vive en
// lib/recorridos.ts, que es puro y tiene test. Acá queda lo que sólo puede vivir en el
// navegador: medir el DOM, escuchar el scroll y el teclado, y pintar.
//
// Cinco decisiones que no se ven en la firma:
//
//  1. UN PASO SIN OBJETIVO EN LA PANTALLA SE SALTEA. Nunca se dibuja una flecha a la nada.
//     Si NINGUNO está todavía (la pantalla carga sus datos después de montarse), el
//     recorrido espera callado a que aparezca el primero — no se cierra ni se marca como
//     visto: quien no lo vio, no lo vio.
//  2. ES UNA CAPA `anidada` DE LA PILA DE MODALES. Señala cosas de lo que tiene DEBAJO, así
//     que nunca puede apagarlo: registrado como capa normal, la pila escondería con
//     `display:none` al modal de atrás y con él a los objetivos (un recorrido montado
//     adentro de una ficha la haría desaparecer). Y estar en la pila es lo que hace que el
//     Escape lo conteste sólo él.
//  3. VA EN UN PORTAL AL `body`. Montado adentro de la tab, un ancestro con `transform`,
//     `overflow` o un `sticky` con z-index le recortaría el z-index (AGENTS.md, «un sticky
//     con z-index crea un contexto de apilamiento»), y el fondo oscuro quedaría debajo de
//     la sidebar.
//  4. LA TARJETA SE ENCAJA SIEMPRE EN LA VENTANA. Lleva los botones —«Omitir» incluido—:
//     si el objetivo se va de la pantalla con un scroll, la tarjeta no se va con él.
//  5. NO SE LLAMA A `scrollIntoView` SI EL OBJETIVO YA SE VE. Ese método scrollea todos los
//     ancestros, incluidos los de `overflow: hidden` (ver `necesitaScroll`).
// =============================================================================

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import { Button, IconButton } from './Button';
import {
  PREFIJO_LOCAL, Z_PISO_RECORRIDO, anteriorVisible, claveLocal, contadorDe, necesitaScroll, posicionTarjeta,
  primerVisible, quienValido, recorteDe, selectorDe, siguienteVisible, vistoActual, vistoDeFuentes,
  type Caja, type LadoRecorrido, type Medida, type PasoRecorrido, type PosicionTarjeta,
} from '@/lib/recorridos';

export type { PasoRecorrido, LadoRecorrido };

/** Cómo se cerró: con el «Listo» del último paso, o con «Omitir recorrido» / Escape. */
export type MotivoCierreRecorrido = 'fin' | 'omitido';

/** Lo que puede recibir el foco adentro de la tarjeta, para el ciclo del Tab. */
const FOCABLES = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Cuánto dura el corrimiento del recorte de un paso al otro. Va también en la hoja. */
const MS_TRANSICION = 220;

// ── El DOM ────────────────────────────────────────────────────────────────────

/**
 * El objetivo de un paso, si está EN LA PANTALLA. Un nodo con `display: none` (o adentro
 * de uno) no tiene cajas: cuenta como ausente, igual que uno que no existe. Si el selector
 * es inválido `querySelector` tira, y eso también es «no está» — un paso mal escrito no
 * puede tumbar el recorrido entero.
 */
function objetivoEnDom(objetivo: string): HTMLElement | null {
  try {
    const el = document.querySelector<HTMLElement>(selectorDe(objetivo));
    return el && el.getClientRects().length > 0 ? el : null;
  } catch {
    return null;
  }
}

const presentesEnDom = (pasos: readonly PasoRecorrido[]): boolean[] => pasos.map((p) => objetivoEnDom(p.objetivo) != null);

/** El área visible SIN las barras de scroll: es contra lo que se encaja la tarjeta. */
function ventanaActual(): Medida {
  const d = document.documentElement;
  return { ancho: d.clientWidth || window.innerWidth, alto: d.clientHeight || window.innerHeight };
}

const cajaDe = (r: DOMRect): Caja => ({ x: r.left, y: r.top, ancho: r.width, alto: r.height });

function menosMovimiento(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

type Geometria = { hueco: Caja; tarjeta: PosicionTarjeta; presentes: boolean[] };

/** Medio píxel de tolerancia: re-pintar por un redondeo es un render por cuadro de scroll. */
const casi = (a: number, b: number) => Math.abs(a - b) < 0.5;
function mismaGeometria(a: Geometria, b: Geometria): boolean {
  return casi(a.hueco.x, b.hueco.x) && casi(a.hueco.y, b.hueco.y) && casi(a.hueco.ancho, b.hueco.ancho) && casi(a.hueco.alto, b.hueco.alto)
    && a.tarjeta.x === b.tarjeta.x && a.tarjeta.y === b.tarjeta.y && a.tarjeta.lado === b.tarjeta.lado && a.tarjeta.flecha === b.tarjeta.flecha
    && a.presentes.length === b.presentes.length && a.presentes.every((p, i) => p === b.presentes[i]);
}

// ── El componente ─────────────────────────────────────────────────────────────

export function Recorrido({ id, pasos, abierto, onCerrar }: {
  /** El id del recorrido (`cs-curso`). Es la clave de «ya lo vio», así que no se cambia. */
  id: string;
  pasos: PasoRecorrido[];
  abierto: boolean;
  onCerrar: (motivo: MotivoCierreRecorrido) => void;
}) {
  const [indice, setIndice] = useState<number | null>(null);
  const [geo, setGeo] = useState<Geometria | null>(null);
  const [animando, setAnimando] = useState(false);
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const textoId = useId();
  const contId = useId();

  // ⚠️ LOS PASOS VIAJAN POR UN REF Y LOS EFECTOS DEPENDEN DE SU FIRMA, no del array. Quien
  // monta esto casi siempre escribe `pasos={[…]}` en línea, o sea un array nuevo en cada
  // render: con el array en las dependencias, cada render volvería a buscar el primer paso
  // y a medir. La firma cambia sólo si cambian los objetivos o los lados — el título y el
  // texto se leen al pintar, no deciden nada.
  const pasosRef = useRef(pasos);
  const firma = JSON.stringify(pasos.map((p) => [p.objetivo, p.lado ?? null]));
  const onCerrarRef = useRef(onCerrar);
  useLayoutEffect(() => { pasosRef.current = pasos; onCerrarRef.current = onCerrar; });

  // Cerrado, la próxima vez arranca de nuevo desde el primer paso. Se resetea DURANTE el
  // render al ver el cambio (el patrón de React para «ajustar estado cuando cambia una
  // prop»), no en un efecto: con un efecto habría un render de más con el paso viejo.
  const [abiertoAntes, setAbiertoAntes] = useState(abierto);
  if (abierto !== abiertoAntes) {
    setAbiertoAntes(abierto);
    if (!abierto) { setIndice(null); setGeo(null); setAnimando(false); }
  }

  const mostrando = abierto && indice !== null;
  const capa = useCapaModal(mostrando, { anidada: true });
  const esElDeArriba = capa.esElDeArriba;
  const z = Math.max(capa.z, Z_PISO_RECORRIDO);
  const esperando = abierto && indice === null;

  // 1. Al abrirse —o cuando el paso actual desaparece de la pantalla—, buscar el primer
  //    paso que esté. Si no hay ninguno, mirar el DOM hasta que aparezca uno. Siempre en
  //    un cuadro de animación: el primer intento también, así la pantalla que lo monta
  //    termina de pintarse antes de que se la mida.
  useEffect(() => {
    if (!esperando) return;
    let cuadro = 0;
    let obs: MutationObserver | null = null;
    const intentar = () => {
      cuadro = 0;
      const i = primerVisible(presentesEnDom(pasosRef.current));
      if (i == null) return;
      obs?.disconnect();
      setIndice((actual) => actual ?? i);
    };
    obs = new MutationObserver(() => { if (!cuadro) cuadro = requestAnimationFrame(intentar); });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-recorrido', 'hidden', 'style', 'class'] });
    cuadro = requestAnimationFrame(intentar);
    return () => { obs?.disconnect(); if (cuadro) cancelAnimationFrame(cuadro); };
  }, [esperando, firma]);

  // 2. Medir: dónde está el objetivo, dónde va el recorte y dónde la tarjeta.
  const medir = useCallback(() => {
    if (indice == null) return;
    const ps = pasosRef.current;
    const paso = ps[indice];
    const el = paso ? objetivoEnDom(paso.objetivo) : null;
    const presentes = presentesEnDom(ps);
    if (!el) {
      // El objetivo se fue (la pantalla se redibujó sin él): al siguiente que esté, o al
      // anterior. Si no queda ninguno, `null` vuelve a poner a esperar al efecto 1.
      setIndice(siguienteVisible(presentes, indice) ?? anteriorVisible(presentes, indice));
      setGeo(null);
      return;
    }
    const ventana = ventanaActual();
    const hueco = recorteDe(cajaDe(el.getBoundingClientRect()), ventana);
    const t = tarjetaRef.current?.getBoundingClientRect();
    const tarjeta = posicionTarjeta({
      objetivo: hueco,
      // La tarjeta ya está montada (con `visibility: hidden` hasta la primera medida, que
      // sí ocupa lugar), y el efecto de abajo no mide mientras la capa esté en
      // `display: none`: así esto no cae al respaldo, que es el tamaño típico de una.
      tarjeta: { ancho: t?.width || 320, alto: t?.height || 150 },
      ventana,
      lado: paso.lado,
    });
    const nueva: Geometria = { hueco, tarjeta, presentes };
    setGeo((prev) => (prev && mismaGeometria(prev, nueva) ? prev : nueva));
  }, [indice]);

  // Antes de pintar (layout effect): sin esto la tarjeta se vería un cuadro en la esquina.
  // Y después, en cada cosa que puede mover al objetivo: el tamaño de la ventana, el scroll
  // de CUALQUIER contenedor (en captura: el scroll no burbujea), el tamaño del objetivo y
  // de la tarjeta, y los cambios del DOM — datos que llegan arriba y lo empujan para abajo
  // sin que nada cambie de tamaño. Todo pasa por un solo cuadro de animación.
  //
  // ⚠️ DEPENDE DE `visible`. La capa se registra en la pila en un efecto, así que el
  // PRIMER render del recorrido abierto todavía no está en la pila y sale con
  // `display: none` (`decidirVisible` da false a lo que no está registrado). Midiendo ahí,
  // la tarjeta da 0×0 y cae SIEMPRE al respaldo de 320×150; y como el render que la hace
  // visible no volvía a medir (la medida real llegaba recién en el cuadro siguiente, por
  // el ResizeObserver), se pintaba UN cuadro con la posición del respaldo —del lado
  // equivocado si la real no entraba donde la de 320×150 sí— y después saltaba. Lo mismo
  // al volver de quedar tapada por otro modal. (Razonado sobre el código de la pila, no
  // medido en un navegador.)
  const visible = capa.visible;
  useLayoutEffect(() => {
    if (indice == null || !visible) return;
    // Medir el DOM y guardar la medida ANTES de que el navegador pinte es justo el caso que
    // la documentación de React pone para `useLayoutEffect` (el tooltip que mide su alto).
    // La regla del linter no distingue ese caso del `setState` de más que viene a evitar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    medir();
    let cuadro = 0;
    const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = 0; medir(); }); };
    window.addEventListener('resize', pedir);
    document.addEventListener('scroll', pedir, { capture: true, passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(pedir) : null;
    const paso = pasosRef.current[indice];
    const el = paso ? objetivoEnDom(paso.objetivo) : null;
    if (ro && el) ro.observe(el);
    if (ro && tarjetaRef.current) ro.observe(tarjetaRef.current);
    // ⚠️ SÓLO `childList`, sin atributos: el recorte y la tarjeta cambian su `style` en cada
    // medida, y mirando atributos el recorrido se observaría a sí mismo en un bucle.
    const mo = new MutationObserver(pedir);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', pedir);
      document.removeEventListener('scroll', pedir, { capture: true });
      ro?.disconnect();
      mo.disconnect();
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, [indice, medir, visible]);

  // 3. El teclado. Va ANTES del efecto del paso: los dos corren en el mismo commit al
  //    abrirse, y éste tiene que anotar de dónde venía el foco antes de que el otro lo
  //    mueva a la tarjeta.
  useEffect(() => {
    if (!mostrando) return;
    const previo = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      // ⚠️ SÓLO SI ES LA CAPA DE ARRIBA, y frena con `stopImmediatePropagation`: los Escape
      // de la casa viven todos en `document` y en captura, y `stopPropagation` no frena a
      // los otros listeners del mismo nodo. Sin esto, un Escape omitiría el recorrido Y
      // cerraría el modal de atrás (AGENTS.md, «un popover anclado también es una capa»).
      if (!esElDeArriba()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCerrarRef.current('omitido');
        return;
      }
      if (e.key !== 'Tab') return;
      // El Tab se queda adentro de la tarjeta: con la página tapada, irse con Tab a un
      // botón de atrás es apretar algo que no se ve.
      const caja = tarjetaRef.current;
      const focables = caja?.querySelectorAll<HTMLElement>(FOCABLES);
      if (!caja || !focables?.length) { e.preventDefault(); return; }
      const primero = focables[0];
      const ultimo = focables[focables.length - 1];
      const activo = document.activeElement;
      if (!caja.contains(activo)) { e.preventDefault(); primero.focus(); return; }
      if (e.shiftKey && (activo === primero || activo === caja)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      // Al cerrar, el foco vuelve a donde estaba (normalmente el «?» que lo abrió). Sin
      // scroll: el recorrido ya movió la página y devolver el foco no la tiene que mover más.
      try { previo?.focus?.({ preventScroll: true }); } catch { /* el nodo ya no existe */ }
    };
  }, [mostrando, esElDeArriba]);

  // 4. Cada paso nuevo: traer el objetivo a la vista si no se ve.
  useEffect(() => {
    if (indice == null) return;
    const paso = pasosRef.current[indice];
    const el = paso ? objetivoEnDom(paso.objetivo) : null;
    if (!el) return;
    const { scroll, bloque } = necesitaScroll(cajaDe(el.getBoundingClientRect()), ventanaActual());
    if (scroll) el.scrollIntoView({ block: bloque, inline: 'nearest', behavior: menosMovimiento() ? 'auto' : 'smooth' });
  }, [indice]);

  // El recorte se desliza de un objetivo al otro, pero SÓLO al cambiar de paso con los
  // botones (que es donde se prende `animando`): con la transición siempre puesta, un
  // scroll de la persona dejaría el recorte persiguiendo al objetivo con retraso. El
  // primer paso no se anima —no viene de ningún lado— y tampoco el salto que hace el
  // recorrido solo cuando un objetivo desaparece.
  useEffect(() => {
    if (!animando) return;
    const t = setTimeout(() => setAnimando(false), MS_TRANSICION * 2);
    return () => clearTimeout(t);
  }, [animando, indice]);

  // 5. El foco a la tarjeta, en cada paso (el lector de pantalla anuncia el título y el
  //    texto por `aria-labelledby`).
  //
  //    ⚠️ DEPENDE DE `medida`, NO SÓLO DEL PASO. Antes de la primera medida la tarjeta está
  //    en `visibility: hidden`, y un nodo así NO RECIBE EL FOCO: `focus()` no falla, no
  //    hace nada. Y este efecto puede correr antes del re-render que la hace visible (la
  //    medida es un `setState` adentro de un layout effect). Con sólo `[indice]` el primer
  //    paso nacía sin foco: el lector de pantalla no anunciaba nada y el foco seguía en el
  //    botón de la página que quedó tapada (el Escape y el Tab andan igual: viven en
  //    `document`).
  const medida = geo !== null;
  useEffect(() => {
    if (indice == null || !medida) return;
    tarjetaRef.current?.focus({ preventScroll: true });
  }, [indice, medida]);

  // ── Los botones. Leen el DOM en el momento del clic: es la foto más fresca. ──
  const siguiente = () => {
    if (indice == null) return;
    const s = siguienteVisible(presentesEnDom(pasosRef.current), indice);
    if (s == null) { onCerrarRef.current('fin'); return; }
    setAnimando(true);
    setIndice(s);
  };
  const atras = () => {
    if (indice == null) return;
    const a = anteriorVisible(presentesEnDom(pasosRef.current), indice);
    if (a == null) return;
    setAnimando(true);
    setIndice(a);
  };
  const omitir = () => onCerrarRef.current('omitido');

  // ── De acá para abajo no hay más hooks (AGENTS.md: ningún hook detrás de un `return`). ──
  if (!mostrando || indice === null) return null;
  const paso = pasos[indice];
  if (!paso) return null;

  // El contador y los botones salen de la MISMA foto que la posición: si un paso aparece
  // en el medio, se enteran juntos en la próxima medida.
  const presentes = geo?.presentes ?? pasos.map((_, i) => i === indice);
  const { n, total } = contadorDe(presentes, indice);
  const hayAnterior = anteriorVisible(presentes, indice) != null;
  const esUltimo = siguienteVisible(presentes, indice) == null;

  const t = geo?.tarjeta;
  const estiloFlecha: CSSProperties | null = t && t.flecha != null
    ? (t.lado === 'abajo' || t.lado === 'arriba' ? { left: t.flecha - 6 } : { top: t.flecha - 6 })
    : null;

  return createPortal(
    <div className="mk-rec" data-recorrido-capa={id} style={{ zIndex: z, display: capa.visible ? 'block' : 'none' }}>
      <style>{CSS}</style>
      {geo
        ? <div
            className={animando ? 'mk-rec__hueco mk-rec__hueco--anima' : 'mk-rec__hueco'}
            style={{ left: geo.hueco.x, top: geo.hueco.y, width: geo.hueco.ancho, height: geo.hueco.alto }}
            aria-hidden
          />
        : <div className="mk-rec__velo" aria-hidden />}
      <div
        ref={tarjetaRef}
        className="mk-rec__tarjeta"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={total > 1 ? `${contId} ${textoId}` : textoId}
        tabIndex={-1}
        // Invisible hasta la primera medida: montada, para que se la pueda medir.
        style={{ left: t?.x ?? 0, top: t?.y ?? 0, visibility: t ? 'visible' : 'hidden' }}
      >
        {estiloFlecha && t && <span className="mk-rec__flecha" data-lado={t.lado} style={estiloFlecha} aria-hidden />}
        {/* El `key` reinicia la entrada suave en cada paso. */}
        <div key={indice} className="mk-rec__cuerpo">
          {total > 1 && <div id={contId} className="mk-rec__cont">{n} de {total}</div>}
          <h2 id={tituloId} className="mk-rec__tit">{paso.titulo}</h2>
          <p id={textoId} className="mk-rec__txt">{paso.texto}</p>
        </div>
        <div className="mk-rec__pie">
          {/* En el último paso «Omitir» haría lo mismo que «Listo»: dos botones para una
              salida es uno de más. Y «Atrás» no se dibuja en el primero: un botón que no
              puede hacer nada se lee como roto. */}
          {!esUltimo && <Button variant="tertiary" size="sm" onClick={omitir}>Omitir recorrido</Button>}
          <span className="mk-rec__aire" />
          {hayAnterior && <Button variant="secondary" size="sm" onClick={atras}>Atrás</Button>}
          <Button variant="primary" size="sm" onClick={siguiente}>{esUltimo ? 'Listo' : 'Siguiente'}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * El «?» para volver a verlo. Lo dibuja quien monta el recorrido, donde le quede cerca de
 * lo que explica; esto es sólo para que sea el mismo botón en todas las tabs.
 */
export function BotonRecorrido({ onClick, titulo = 'Ver el recorrido' }: { onClick: () => void; titulo?: string }) {
  return (
    <IconButton title={titulo} small onClick={onClick}>
      <span aria-hidden style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', lineHeight: 1 }}>?</span>
    </IconButton>
  );
}

// ── Quién ya lo vio ───────────────────────────────────────────────────────────

/** `clave` es la clave ENTERA (`claveLocal(id, quien)`): quién es la persona lo decide el gancho. */
function leerLocal(clave: string): boolean {
  try { return !!window.localStorage.getItem(clave); } catch { return false; }
}

/**
 * Quién escucha lo local en ESTA pestaña. El evento `storage` sólo les avisa a las OTRAS
 * pestañas, así que lo que escribe ésta se avisa a mano.
 */
const oyentesLocales = new Set<() => void>();

function suscribirLocal(avisar: () => void): () => void {
  oyentesLocales.add(avisar);
  const deOtraPestana = (e: StorageEvent) => { if (!e.key || e.key.startsWith(PREFIJO_LOCAL)) avisar(); };
  window.addEventListener('storage', deOtraPestana);
  return () => { oyentesLocales.delete(avisar); window.removeEventListener('storage', deOtraPestana); };
}

function escribirLocal(clave: string): void {
  try { window.localStorage.setItem(clave, new Date().toISOString()); } catch { /* modo privado o bloqueado: queda el server */ }
  for (const f of oyentesLocales) f();
}

/** Un tope para el pedido: un server colgado no puede dejar el recorrido sin decidirse nunca. */
function senal(ms: number): AbortSignal | undefined {
  try { return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(ms) : undefined; } catch { return undefined; }
}

function guardarEnServidor(id: string): void {
  try {
    // `keepalive`: el «Listo» suele ser lo último antes de navegar, y sin esto el pedido
    // muere con la página. Si falla, el respaldo local ya quedó escrito y el gancho lo
    // vuelve a mandar en la próxima visita (`sincronizar`).
    void fetch('/api/recorridos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* sin red: queda lo local */ }
}

/**
 * El estado del recorrido de ESTA persona.
 *
 *   visto      null mientras no se sabe; true / false después.
 *   abierto    se abre SOLO la primera vez (cuando `visto` da false), y con `reabrir`.
 *   reabrir    para el «?»: lo vuelve a mostrar desde el primer paso.
 *   onCerrar   pasáselo tal cual a <Recorrido>. «Omitir» también cuenta como visto: es
 *              la persona diciendo que no lo quiere ver.
 *
 * Se guarda en el server, por persona (`/api/recorridos`), con un respaldo en el
 * navegador que TAMBIÉN es por persona (la clave lleva la huella que manda el server; ver
 * `claveLocal`). ⚠️ MIENTRAS NO SE SABE, NO SE ABRE: abrir con `visto` en null le mostraría el
 * recorrido un instante a quien ya lo vio, cada vez que entra.
 *
 * `soloLocal` es para pantallas sin sesión (el portal del alumno): ahí el server contesta
 * 401 siempre, así que ni se le pregunta.
 *
 * El `id` es una constante de la pantalla: cambiarlo en vivo no reinicia `reabrir`.
 */
export function useRecorrido(id: string, opciones?: { soloLocal?: boolean; autoabrir?: boolean }) {
  const soloLocal = !!opciones?.soloLocal;
  const autoabrir = opciones?.autoabrir !== false;
  // Lo que dijo el server, con el id al que contestó: una respuesta vieja no vale para otro.
  // `quien` es la huella de la persona (null = el server no la sabe o no contestó).
  const [servidor, setServidor] = useState<{ id: string; visto: boolean | null; quien: string | null } | null>(null);
  const resp = servidor && servidor.id === id ? servidor : null;
  // ⚠️ LO LOCAL ES DE UNA PERSONA, no del navegador (ver `claveLocal`): con sesión, la
  // clave lleva la huella que manda el server, así que hasta que contesta no hay qué leer
  // (`null`) — y abrir también lo espera, así que no se pierde nada. Sin sesión (el portal
  // del alumno) o con el server mudo, la clave del navegador, que es el único respaldo.
  const clave = soloLocal ? claveLocal(id) : resp ? claveLocal(id, resp.quien) : null;
  // Lo local se lee con `useSyncExternalStore` y no en un efecto: en el server (y al
  // hidratar) vale `null`, o sea «todavía no sé», y en el navegador es la lectura real.
  // Leerlo en un `useState` inicial daría un HTML distinto del que mandó el server.
  const local = useSyncExternalStore(suscribirLocal, () => (clave ? leerLocal(clave) : null), () => null);
  // Lo marcó en esta visita. Hace falta aparte de lo local: en una ventana privada
  // `localStorage` puede tirar, y el recorrido no puede volver a abrirse por eso.
  const [marcadoId, setMarcadoId] = useState<string | null>(null);
  // `auto` = lo decide `visto`. Calculado y no disparado: con un efecto que lo abra al
  // llegar la respuesta, cada camino nuevo que cambie `visto` tendría que acordarse.
  const [modo, setModo] = useState<'auto' | 'abierto' | 'cerrado'>('auto');

  useEffect(() => {
    if (soloLocal) return;
    let vivo = true;
    fetch('/api/recorridos', { cache: 'no-store', signal: senal(8000) })
      // El cuerpo se lee también en el 503: trae la huella de la persona aunque la base
      // esté caída. Un cuerpo que no es JSON (el 401 del proxy) es `null`.
      .then((r) => r.json().catch(() => null).then((j: unknown) => ({ okHttp: r.ok, j })))
      .then(({ okHttp, j: crudo }) => {
        if (!vivo) return;
        const j = (crudo && typeof crudo === 'object' ? crudo : {}) as { ok?: boolean; guardado?: boolean; vistos?: unknown; quien?: unknown };
        const quien = quienValido(j.quien) ? j.quien : null;
        // `guardado: false` (sesión sin cuenta propia) o una respuesta rara = el server no
        // sabe (`null`): decide lo local. Sólo un `vistos` de verdad es su palabra.
        const enServidor = okHttp && j.ok && j.guardado && Array.isArray(j.vistos) ? j.vistos.includes(id) : null;
        // Lo que ESTA PERSONA vio en este navegador mientras el server fallaba, el server no
        // lo sabe: se le manda, o en otra computadora vuelve a aparecer. Con la clave de la
        // persona: con la del navegador se le mandaría lo que vio otra.
        if (vistoDeFuentes(leerLocal(claveLocal(id, quien)), enServidor).sincronizar) guardarEnServidor(id);
        setServidor({ id, visto: enServidor, quien });
      })
      .catch(() => { if (vivo) setServidor({ id, visto: null, quien: null }); });
    return () => { vivo = false; };
  }, [id, soloLocal]);

  // La decisión vive en lib/recorridos.ts (`vistoActual`), con test: la asimetría entre
  // «no abrirlo» y «abrirlo» es lo que evita mostrárselo un instante a quien ya lo vio.
  const visto = vistoActual({
    marcado: marcadoId === id,
    local,
    soloLocal,
    servidor: resp ? resp.visto : undefined,
  });

  const marcarVisto = useCallback(() => {
    setMarcadoId(id);
    // Si se cierra antes de que el server conteste (con el «?»), todavía no se sabe de
    // quién es: va a la clave del navegador. Lo que cuenta en esta visita es `marcado`, y
    // el server se entera igual por el POST.
    escribirLocal(clave ?? claveLocal(id));
    if (!soloLocal) guardarEnServidor(id);
  }, [id, clave, soloLocal]);

  const reabrir = useCallback(() => setModo('abierto'), []);
  const onCerrar = useCallback((motivo: MotivoCierreRecorrido) => {
    void motivo; // los dos motivos marcan visto; el parámetro queda para quien quiera distinguirlos
    setModo('cerrado');
    marcarVisto();
  }, [marcarVisto]);

  const abierto = modo === 'abierto' || (modo === 'auto' && autoabrir && visto === false);
  return { visto, abierto, reabrir, marcarVisto, onCerrar };
}

// ── La hoja ───────────────────────────────────────────────────────────────────
//
// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO, ni en los comentarios: la hoja es un template
// literal y una sola la cierra a la mitad (AGENTS.md, «adentro de un template literal no
// va NINGÚN backtick»). Lo cuida tests/recorrido.test.ts.
//
// Los colores son TOKENS. El velo sale de --sidebar, que es el token de las «islas
// oscuras» de la app (la sidebar, el tooltip, el toast): oscurecer la pantalla es volverla
// una isla oscura, y así el velo se oscurece o aclara con el tema en vez de quedar clavado.
// (La caja de los modales usa un rgba suelto; si algún día hay un token de velo en
// globals.css, va acá también.)
const CSS = `
.mk-rec {
  position: fixed; inset: 0;
  --rec-velo: color-mix(in srgb, var(--sidebar) 66%, transparent);
}
.mk-rec__velo { position: absolute; inset: 0; background: var(--rec-velo); }
.mk-rec__hueco {
  position: fixed;
  border-radius: var(--r-md);
  box-shadow: 0 0 0 2px var(--primary), 0 0 0 200vmax var(--rec-velo);
  pointer-events: none;
}
.mk-rec__hueco::after {
  content: ''; position: absolute; inset: -2px; border-radius: inherit;
  animation: mkRecLatido 1.8s ease-out infinite;
}
.mk-rec__hueco--anima {
  transition: left ${MS_TRANSICION}ms ease, top ${MS_TRANSICION}ms ease, width ${MS_TRANSICION}ms ease, height ${MS_TRANSICION}ms ease;
}
@keyframes mkRecLatido {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 45%, transparent); }
  100% { box-shadow: 0 0 0 10px color-mix(in srgb, var(--primary) 0%, transparent); }
}
.mk-rec__tarjeta {
  position: fixed;
  width: min(340px, calc(100vw - 24px));
  box-sizing: border-box;
  padding: 16px 18px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: 0 18px 44px color-mix(in srgb, var(--sidebar) 32%, transparent);
  font-family: inherit;
  color: var(--ink);
}
.mk-rec__tarjeta:focus { outline: none; }
.mk-rec__tarjeta:focus-visible { box-shadow: var(--focus-ring), 0 18px 44px color-mix(in srgb, var(--sidebar) 32%, transparent); }
.mk-rec__cuerpo { animation: mkRecEntra .16s ease both; }
@keyframes mkRecEntra { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
.mk-rec__cont { margin-bottom: 4px; font-size: var(--fs-meta); color: var(--faint); font-variant-numeric: tabular-nums; }
.mk-rec__tit { margin: 0; font-size: var(--fs-card); font-weight: 650; line-height: 1.3; color: var(--ink); }
.mk-rec__txt { margin: 6px 0 0; font-size: var(--fs-sm); line-height: 1.5; color: var(--dim); }
.mk-rec__pie { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; }
.mk-rec__aire { flex: 1 1 auto; }
.mk-rec__flecha {
  position: absolute; width: 12px; height: 12px;
  background: var(--surface);
  border: 0 solid var(--border);
  transform: rotate(45deg);
}
.mk-rec__flecha[data-lado="abajo"] { top: -7px; border-top-width: 1px; border-left-width: 1px; }
.mk-rec__flecha[data-lado="arriba"] { bottom: -7px; border-right-width: 1px; border-bottom-width: 1px; }
.mk-rec__flecha[data-lado="derecha"] { left: -7px; border-left-width: 1px; border-bottom-width: 1px; }
.mk-rec__flecha[data-lado="izquierda"] { right: -7px; border-top-width: 1px; border-right-width: 1px; }
@media (prefers-reduced-motion: reduce) {
  .mk-rec__hueco--anima { transition: none; }
  .mk-rec__hueco::after, .mk-rec__cuerpo { animation: none; }
}
`;
