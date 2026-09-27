'use client';

// =============================================================================
// PortadaPicker — elegir qué se ve arriba, COMO EN NOTION
// =============================================================================
// «Para el banner tanto que se pueda subir una imagen, como que se pueda
// seleccionar de un repositorio, como lo hace Notion» (27/09/2026), y ese mismo
// día, con la captura del selector de Notion al lado: «Quiero que sea similar a
// Notion. Replicalo».
//
// LO QUE SE REPLICÓ SON CUATRO COSAS, Y LAS CUATRO SON LA MISMA DECISIÓN:
// **se elige MIRANDO la portada**.
//
//   1. Es un POPOVER ANCLADO al botón que lo abre, no un modal centrado. Un modal
//      de 720 px tapa exactamente lo que estás eligiendo, así que había que
//      cerrarlo para ver el resultado.
//   2. ELEGIR NO CIERRA. Se aplica en el acto y el panel se queda donde está:
//      probar tres degradados son tres clicks, no tres veces abrir y cerrar.
//      Es lo que el popover HABILITA — sin ver la portada detrás, quedarse
//      abierto no serviría de nada.
//   3. ALTO FIJO Y SCROLL ADENTRO. Cambiar de pestaña no mueve el panel ni lo
//      hace saltar de lugar (AGENTS.md: «un layout fijo no tiene casos»).
//   4. LAS MUESTRAS VAN SIN RÓTULO. El nombre de un degradado no dice nada que la
//      muestra no diga mejor, y doce rótulos de 11 px son ruido; el nombre viaja
//      en el `title` y en el `aria-label`, donde no ocupa lugar (AGENTS.md: «el
//      texto que se DIBUJA es corto»).
//
// Tres pestañas, y el orden es la decisión:
//   1. Degradados — el catálogo de `lib/portadas.ts`. Se dibuja SIN RED, entra en
//      cualquier ancho y no puede 404ear, así que es lo que abre.
//   2. Fotos      — el repositorio (`/api/portadas`). Sale a buscar; si no contesta,
//      lo dice: una grilla vacía se lee como «no hay fotos».
//   3. Subir      — la propia.
//
// ⚠️ ES UNO SOLO PARA EL CLIENTE Y PARA EL PROYECTO. La misma pregunta contestada en
// dos componentes son dos componentes que divergen: el día que se agregue una pestaña,
// el otro se queda con dos.
//
// ⚠️ SE REGISTRA EN LA PILA DE MODALES AUNQUE NO SEA UN MODAL, y hace falta. El
// Escape de todos los modales abiertos vive en `document`, así que sin registrarse
// acá una tecla cerraría la FICHA de atrás en vez de este panel —y `stopPropagation`
// no lo evita, porque frena la propagación a otros NODOS y no a los otros listeners
// del mismo—. Entra como `anidada`: la capa de abajo se sigue viendo, que es el punto
// entero de que esto sea un popover.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '@/app/_ui';
import { useCapaModal } from '@/app/_components/pila-modales';
import { GRADIENTES, cssGradiente, valorGradiente, fondoPortada } from '@/lib/portadas';
import type { FotoDeCatalogo } from '@/lib/portadas';

type Pestana = 'galeria' | 'subir';

/** El ancho del panel. Notion usa ~615 de contenido; acá entran cuatro muestras por fila. */
const ANCHO = 620;
/** Lo que scrollea adentro. FIJO: cambiar de pestaña no puede mover el panel de lugar. */
const ALTO_CUERPO = 392;

type Caja = { left: number; right: number; top: number; bottom: number };

/**
 * DÓNDE CAE EL PANEL, y vive afuera del componente PARA QUE SE PUEDA TESTEAR.
 *
 * Es la misma razón por la que `decidirVisible` vive afuera de `useCapaModal` y
 * `exigirClienteDePrueba` afuera del que borra: una condición encerrada adentro del
 * componente que la usa no la puede importar ningún test (AGENTS.md).
 *
 * Alineado a la DERECHA del ancla —como en Notion, donde el panel cuelga del control
 * de la portada— y debajo. Si abajo no entra y arriba hay más lugar, se da vuelta. Y
 * siempre adentro de la ventana: un panel que se sale por el borde es un panel sin la
 * mitad de sus opciones.
 */
export function ubicarPanel(
  ancla: Caja,
  panel: { ancho: number; alto: number },
  ventana: { ancho: number; alto: number },
  margen = 10,
): { left: number; top: number } {
  const left = Math.max(margen, Math.min(ancla.right - panel.ancho, ventana.ancho - panel.ancho - margen));

  const cabeAbajo = ventana.alto - ancla.bottom - margen;
  const cabeArriba = ancla.top - margen;
  const arriba = panel.alto > cabeAbajo && cabeArriba > cabeAbajo;
  const crudo = arriba ? ancla.top - 8 - panel.alto : ancla.bottom + 8;

  const top = Math.max(margen, Math.min(crudo, ventana.alto - panel.alto - margen));
  return { left, top };
}

export function PortadaPicker({ valor, colorBase, ancla = null, titulo = 'Portada', onElegir, onCerrar }: {
  /** Lo que hay puesto hoy, para marcarlo. */
  valor: string | null | undefined;
  /** El color derivado del nombre: el default, que también es una opción. */
  colorBase: string;
  /**
   * EL BOTÓN QUE LO ABRIÓ. De ahí cuelga el panel, y por eso es el ELEMENTO y no un
   * `DOMRect`: un rect tomado al abrir se queda viejo en cuanto la columna de atrás
   * scrollea, y el panel se despega de su botón sin que nada falle. Con el nodo se
   * vuelve a medir en cada `scroll` y en cada `resize`.
   *
   * `null` = no hay de dónde colgarlo: queda centrado, que es como estaba antes.
   */
  ancla?: HTMLElement | null;
  /** Para el lector de pantalla: el panel no dibuja título (Notion tampoco). */
  titulo?: string;
  /** `null` = volver al default. ⚠️ NO cierra: se aplica y el panel se queda abierto. */
  onElegir: (v: string | null) => void;
  onCerrar: () => void;
}) {
  const [pest, setPest] = useState<Pestana>('galeria');
  const [montado, setMontado] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const capa = useCapaModal(true, { anidada: true });
  const arriba = capa.esElDeArriba;

  useEffect(() => { setMontado(true); }, []);

  /**
   * ⚠️ SE MIDE EL PANEL DE VERDAD, no el `ANCHO` declarado. En una ventana angosta el
   * CSS lo achica (`max-width: calc(100vw - 20px)`), y ubicarlo por el número declarado
   * lo dejaría corrido por la diferencia.
   */
  const recolocar = useCallback(() => {
    const p = panelRef.current;
    if (!p) return;
    const caja = p.getBoundingClientRect();
    const ventana = { ancho: window.innerWidth, alto: window.innerHeight };
    const a = ancla?.isConnected ? ancla.getBoundingClientRect() : null;
    if (!a) {
      setPos({
        left: Math.max(10, (ventana.ancho - caja.width) / 2),
        top: Math.max(10, (ventana.alto - caja.height) / 2),
      });
      return;
    }
    setPos(ubicarPanel(a, { ancho: caja.width, alto: caja.height }, ventana));
  }, [ancla]);

  /**
   * ⚠️ `montado` VA EN LAS DEPENDENCIAS, Y NO ES UN ADORNO. El portal no existe en el
   * primer render (`if (!montado) return null`), así que la primera corrida de este
   * efecto encuentra `panelRef.current` en null y se va sin medir; como `recolocar` es
   * estable, sin `montado` acá el efecto NO VUELVE A CORRER y el panel se queda en
   * `left:0, top:0` con `opacity:0` — o sea, invisible, en la esquina, para siempre.
   *
   * Medido en Chrome el 27/09/2026 antes de arreglarlo: `pop {l:0, t:0}`, `opacity "0"`,
   * con el ancla en `l:650, t:145`. No tira, no avisa: el panel simplemente no está.
   */
  useEffect(() => {
    recolocar();
    window.addEventListener('resize', recolocar);
    // EN CAPTURA: lo que scrollea puede ser la columna del detalle o el cuerpo de la
    // ficha, y un `scroll` de un contenedor NO burbujea hasta `window`.
    window.addEventListener('scroll', recolocar, true);
    return () => {
      window.removeEventListener('resize', recolocar);
      window.removeEventListener('scroll', recolocar, true);
    };
  }, [recolocar, montado]);

  // Click afuera: la única salida de un popover, y la que Notion usa. El ANCLA queda
  // exceptuada — el que la abrió la cierra por su cuenta (es un interruptor), y sin
  // esta excepción el click la cerraría acá y la volvería a abrir allá.
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (panelRef.current?.contains(t)) return;
      if (ancla?.contains(t)) return;
      onCerrar();
    };
    document.addEventListener('mousedown', fuera, true);
    return () => document.removeEventListener('mousedown', fuera, true);
  }, [ancla, onCerrar]);

  // Escape y el ciclo del Tab. `arriba()` es lo que impide que esta tecla cierre además
  // la ficha de atrás (ver la cabecera y `esElDeArriba` en pila-modales.ts).
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!arriba()) return;
        // ⚠️ `stopImmediatePropagation` Y NO `stopPropagation`. El Escape de la ficha de
        // atras vive en el MISMO nodo (`document`, en captura), y `stopPropagation` solo
        // frena la propagacion a OTROS nodos: no toca a los listeners hermanos. Medido en
        // Chrome el 27/09/2026: una sola tecla cerraba el panel Y la ficha entera, o sea
        // que perdias el cliente por cerrar el selector de portada. Es el mismo bug que
        // 72aa1109 cerro para los modales, del lado del popover.
        e.stopImmediatePropagation();
        e.preventDefault();
        onCerrar();
        return;
      }
      if (e.key !== 'Tab') return;
      const focables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focables?.length) return;
      const primero = focables[0];
      const ultimo = focables[focables.length - 1];
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === panelRef.current)) {
        e.preventDefault(); ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault(); primero.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (previo?.isConnected) previo.focus?.();
    };
  }, [arriba, onCerrar]);

  if (!montado) return null;

  return createPortal(
    <div ref={panelRef} className="pp-pop" role="dialog" aria-label={titulo} tabIndex={-1}
      style={{
        zIndex: capa.z,
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        // Hasta que esté medido no se pinta: un frame en la esquina se ve como un salto.
        opacity: pos ? 1 : 0,
        pointerEvents: pos ? undefined : 'none',
      }}>
      <div className="pp-tabs" role="tablist">
        {(['galeria', 'subir'] as const).map((p) => (
          <button key={p} type="button" role="tab" aria-selected={pest === p}
            className={`pp-tab${pest === p ? ' on' : ''}`} onClick={() => setPest(p)}>
            {p === 'galeria' ? 'Galería' : 'Subir'}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {/* Volver al default NO es borrar: es el color derivado del nombre, que es lo
            que se ve hoy. Va donde Notion pone «Remove». */}
        <button type="button" className="pp-quitar" onClick={() => onElegir(null)}>Sin portada</button>
      </div>

      {/* ⚠️ UNA SOLA PESTAÑA «GALERÍA», CON LOS DEGRADADOS ARRIBA Y LAS FOTOS ABAJO
          («en lugar de 2 tabs pon una sola que sea Galería», 27/09/2026). No es sólo
          juntar dos listas: eran dos pestañas para una MISMA pregunta —«¿qué imagen
          pongo?»—, y partirla obligaba a elegir el tipo de respuesta antes de ver las
          respuestas. Es lo mismo que hace Notion, que apila «Color & Gradient» y
          «Texturelabs» en la misma «Gallery». Los degradados van primero porque se
          dibujan sin red: la galería nunca se ve vacía mientras las fotos cargan. */}
      <div className="pp-cuerpo">
        {pest === 'galeria' && (
          <>
            <p className="pp-seccion">Color y degradado</p>
            <ul className="pp-grid">
              <li>
                <button type="button" className={`pp-op${!valor ? ' on' : ''}`} onClick={() => onElegir(null)}
                  title="Automático — el color derivado del nombre" aria-label="Automático, el color derivado del nombre"
                  style={{ background: fondoPortada(null, colorBase) }} />
              </li>
              {GRADIENTES.map((g) => (
                <li key={g.id}>
                  <button type="button" className={`pp-op${valor === valorGradiente(g) ? ' on' : ''}`}
                    onClick={() => onElegir(valorGradiente(g))} title={g.nombre} aria-label={g.nombre}
                    style={{ background: cssGradiente(g) }} />
                </li>
              ))}
            </ul>
            <Fotos valor={valor} onElegir={onElegir} />
          </>
        )}
        {pest === 'subir' && <Subir onElegir={onElegir} />}
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>,
    document.body,
  );
}

/**
 * El repositorio. Pagina de a 24; el botón de abajo trae la tanda siguiente.
 *
 * ⚠️ LA SEMILLA SE SORTEA UNA VEZ, AL MONTAR, Y NO EN CADA REQUEST. «Ponele un
 * randomizer para que no aparezcan siempre las mismas» (27/09/2026) — pero esta
 * lista ACUMULA: si cada tanda se sortea por su cuenta, «Ver más fotos» repite unas
 * y saltea otras, y `key={f.id}` duplicada además hace ruido en React. Con la
 * semilla fija por apertura, la primera tanda cae en cualquier lado del catálogo y
 * las siguientes caminan desde ahí. El server la convierte en una página real.
 *
 * Va en un `useState` con inicializador perezoso y no en un `useRef` ni en el
 * cuerpo del componente: así se sortea UNA sola vez aunque React vuelva a
 * renderizar, y no cambia al cambiar de pestaña.
 */
function Fotos({ valor, onElegir }: { valor: string | null | undefined; onElegir: (v: string) => void }) {
  const [semilla] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [fotos, setFotos] = useState<FotoDeCatalogo[]>([]);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(true);
  /** Las que el catálogo listó y no existen: se sacan de la grilla al fallar. */
  const [rotas, setRotas] = useState<Set<string>>(() => new Set());
  const [cargando, setCargando] = useState(true);
  const [mal, setMal] = useState('');

  // ⚠️ EL `setCargando(true)` NO VA ACÁ ADENTRO. Un `setState` sincrónico dentro de un
  // efecto es un render en cascada (lo marca `react-hooks/set-state-in-effect`), y no hace
  // falta: `pagina` sólo la mueve el botón de abajo, así que el estado de carga lo prende
  // el gesto que lo provoca y este efecto sólo lo apaga.
  useEffect(() => {
    let vivo = true;
    fetch(`/api/portadas?pagina=${pagina}&semilla=${semilla}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; fotos?: FotoDeCatalogo[]; hayMas?: boolean; error?: string }) => {
        if (!vivo) return;
        // ⚠️ «No pude leer» NO se pinta como «no hay fotos»: son dos pantallas, y la
        // segunda deja a alguien esperando algo que nunca va a llegar.
        if (!j.ok) { setMal(j.error || 'No pude leer el catálogo de fotos.'); return; }
        // ⚠️ Y SE DEDUPLICA POR ID. La semilla hace que las tandas caminen sin
        // repetir, pero al dar la vuelta al catálogo (42 páginas) volverían las
        // primeras — y dos `key` iguales en React es un aviso en consola y una
        // tarjeta que no se actualiza. El `Set` es la red, no el plan.
        setFotos((v) => {
          const nuevas = j.fotos ?? [];
          if (pagina === 1) return nuevas;
          const ya = new Set(v.map((f) => f.id));
          return [...v, ...nuevas.filter((f) => !ya.has(f.id))];
        });
        setHayMas(j.hayMas !== false);
      })
      .catch((e: unknown) => { if (vivo) setMal(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [pagina, semilla]);

  if (mal && !fotos.length) return <p className="pp-mal">{mal}</p>;

  return (
    <>
      <p className="pp-seccion pp-seccion-2">Fotos</p>
      <ul className="pp-grid fotos">
        {fotos.filter((f) => !rotas.has(f.id)).map((f) => (
          <li key={f.id}>
            <button type="button" className={`pp-op foto${valor === f.grande ? ' on' : ''}`}
              onClick={() => onElegir(f.grande)}
              title={f.autor ? `Foto de ${f.autor}` : 'Foto'} aria-label={f.autor ? `Foto de ${f.autor}` : 'Foto'}>
              {/* Sin `next/image`: son miniaturas de un host externo, y el optimizador
                  las volvería a servir por nuestra función pagando por cada una. */}
              {/* ⚠️ UNA QUE NO CARGA SE VA DE LA GRILLA. picsum tiene huecos en su
                  espacio de ids —medido: de 12 consecutivos, uno contesta 404— y
                  `/v2/list` igual los devuelve. Una baldosa vacía en una galería se
                  lee como que la app está a medio cargar; una foto menos, no.
                  Sin `next/image`: es un stream de nuestra ruta y el optimizador lo
                  volvería a servir por otra función, cobrando por cada miniatura. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.mini} alt="" loading="lazy"
                onError={() => setRotas((v) => (v.has(f.id) ? v : new Set(v).add(f.id)))} />
            </button>
          </li>
        ))}
      </ul>
      {cargando && <p className="pp-cargando"><Spinner /> Trayendo fotos…</p>}
      {mal && <p className="pp-mal">{mal}</p>}
      {/* ⚠️ EL BOTÓN DESAPARECE AL LLEGAR AL FINAL. Antes se dibujaba siempre, y
          pasada la última página cada click traía una lista vacía con 200: la
          pantalla no podía distinguir «no hay más» de «no llegó nada». Medido con
          curl el 27/09/2026: picsum tiene 42 páginas de 24 (993 fotos) y de la 43
          en adelante devuelve `[]`, no un error. */}
      {!cargando && !mal && hayMas && (
        <button type="button" className="pp-mas"
          onClick={() => { setCargando(true); setMal(''); setPagina((p) => p + 1); }}>Ver más fotos</button>
      )}
    </>
  );
}

/** La propia. Sube y elige en el mismo gesto: una foto subida que no se aplica es un paso de más. */
function Subir({ onElegir }: { onElegir: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [encima, setEncima] = useState(false);
  const [mal, setMal] = useState('');

  async function mandar(f: File) {
    setSubiendo(true);
    setMal('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await fetch('/api/portadas', { method: 'POST', body: fd });
      const j: { ok: boolean; url?: string; error?: string } = await r.json();
      if (!j.ok || !j.url) { setMal(j.error || 'No pude subirla.'); return; }
      onElegir(j.url);
    } catch (e) {
      setMal(e instanceof Error ? e.message : String(e));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    // Soltar un archivo encima también sube: la zona ya ocupa el cuerpo entero, así
    // que dibujarla y no aceptar el gesto que su forma promete es peor que no
    // dibujarla. `preventDefault` en los tres eventos o el navegador ABRE la imagen
    // y se lleva puesta la pantalla.
    <div className={`pp-subir${encima ? ' encima' : ''}`}
      onDragOver={(e) => { e.preventDefault(); if (!encima) setEncima(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEncima(false); }}
      onDrop={(e) => {
        e.preventDefault(); setEncima(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void mandar(f);
      }}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void mandar(f); e.target.value = ''; }} />
      <button type="button" className="pp-btn" disabled={subiendo} onClick={() => input.current?.click()}>
        {subiendo ? <><Spinner /> Subiendo…</> : 'Elegir una imagen'}
      </button>
      {/* Tres palabras y el techo. El porqué de cada formato vive en el comentario
          de `sniffImagen`, no acá (AGENTS.md: la pantalla dice QUÉ, no POR QUÉ). */}
      <p className="pp-ayuda">o soltala acá · JPG, PNG, WEBP o GIF · hasta 6MB</p>
      {mal && <p className="pp-mal">{mal}</p>}
    </div>
  );
}

const CSS = `
.pp-pop{ position:fixed; width:${ANCHO}px; max-width:calc(100vw - 20px);
  background:var(--surface); border:1px solid var(--border); border-radius:12px;
  box-shadow:0 14px 42px rgba(18,21,27,.22), 0 2px 8px rgba(18,21,27,.10);
  padding:0 0 4px; outline:none; }
.pp-pop:focus-visible{ outline:none; }

/* La pestaña activa va SUBRAYADA y no en pastilla: es lo que hace Notion, y adentro de un
   panel chico una pastilla compite con las muestras, que es lo que hay que mirar. */
.pp-tabs{ display:flex; align-items:center; gap:2px; padding:0 12px;
  border-bottom:1px solid var(--border); }
.pp-tab{ position:relative; background:none; border:0; padding:11px 8px 10px; font:inherit;
  font-size:13px; color:var(--dim); cursor:pointer; }
.pp-tab:hover{ color:var(--ink); }
.pp-tab.on{ color:var(--ink); font-weight:600; }
.pp-tab.on::after{ content:''; position:absolute; left:6px; right:6px; bottom:-1px; height:2px;
  background:var(--ink); border-radius:2px 2px 0 0; }
.pp-quitar{ background:none; border:0; font:inherit; font-size:12.5px; color:var(--faint);
  cursor:pointer; padding:8px 4px; }
.pp-quitar:hover{ color:var(--bad); }

/* ⚠️ ALTO FIJO. Lo que scrollea es esto y nada más: sin el alto fijo, pasar de «Fotos»
   (24 miniaturas) a «Subir» (un botón) encoge el panel y lo hace saltar de lugar, porque
   la posición se calcula contra su propia caja. Y la barra de scroll se VE: esconderla
   está prohibido en los dos ejes (AGENTS.md). */
.pp-cuerpo{ height:${ALTO_CUERPO}px; overflow-y:auto; padding:12px 14px 14px; }

.pp-seccion{ margin:0 2px 9px; font-size:11.5px; font-weight:600; color:var(--faint);
  letter-spacing:.01em; }
/* La segunda sección de la galería necesita aire arriba, o las fotos se leen como
   una fila más de degradados. */
.pp-seccion-2{ margin-top:18px; }

.pp-grid{ list-style:none; margin:0; padding:0; display:grid; gap:10px;
  grid-template-columns:repeat(auto-fill, minmax(126px, 1fr)); }
.pp-grid > li{ display:flex; min-width:0; }
.pp-op{ display:block; width:100%; height:64px; border:1px solid var(--border); border-radius:8px;
  padding:0; overflow:hidden; cursor:pointer; transition:box-shadow .1s, border-color .1s; }
.pp-op:hover{ border-color:var(--border-strong); box-shadow:0 2px 8px rgba(18,21,27,.14); }
.pp-op.on{ border-color:var(--primary); box-shadow:0 0 0 2px var(--primary-bg); }
.pp-op.foto img{ display:block; width:100%; height:100%; object-fit:cover; }

.pp-cargando{ display:flex; align-items:center; gap:8px; margin:14px 2px 0; font-size:13px; color:var(--dim); }
.pp-mas{ display:block; margin:14px auto 0; background:var(--surface); border:1px solid var(--border-strong);
  border-radius:9px; padding:7px 15px; font:inherit; font-size:13px; color:var(--ink); cursor:pointer; }
.pp-mas:hover{ border-color:var(--primary); color:var(--primary); }
.pp-mal{ margin:14px 2px 0; font-size:13px; color:var(--bad); }

/* ⚠️ LA PESTAÑA «SUBIR» OCUPA EL CUERPO ENTERO («revisá que la tab subir está todo
   muy chico y centrado a la izquierda arriba», 27/09/2026). Antes era un flex en
   columna con align-items:flex-start y sin alto: el botón y su ayuda quedaban
   apretados contra la esquina de arriba a la izquierda de un panel de 392 px, con
   el 90% del espacio vacío debajo. Es el mismo defecto que AGENTS.md ya tiene
   escrito para un max-width puesto al texto adentro de una caja más ancha — una
   regla correcta para el contenido, aplicada a algo que no es contenido.
   Ahora es una zona de soltar del alto del cuerpo, centrada en los dos ejes.
   (Y sin comillas invertidas acá adentro: esto vive en un template literal y una
   sola cierra la hoja a la mitad. AGENTS.md lo tiene medido y acaba de pasar.) */
.pp-subir{ display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:10px; min-height:100%; border:1.5px dashed var(--border-strong); border-radius:12px;
  padding:20px; text-align:center; transition:border-color .12s, background .12s; }
.pp-subir.encima{ border-color:var(--primary); background:var(--primary-bg); }
.pp-btn{ display:inline-flex; align-items:center; gap:8px; background:var(--primary); border:0;
  border-radius:9px; padding:10px 18px; font:inherit; font-size:13.5px; font-weight:600;
  color:#fff; cursor:pointer; }
.pp-btn:disabled{ opacity:.7; cursor:default; }
.pp-ayuda{ margin:0; font-size:12px; color:var(--faint); }

@media(prefers-reduced-motion:reduce){ .pp-op{ transition:none; } }
`;
