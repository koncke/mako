'use client';

/**
 * El curso de Avatar Hype con la pantalla de SU plataforma, replicada.
 *
 * Por que existe una vista aparte: el portal es una grilla de tarjetas con la
 * transcripcion detras de un <details>, y sirve para los 17 cursos que son "video +
 * transcripcion". Este no lo es: su valor esta en el DOCUMENTO de cada leccion -los
 * prompts con sus partes etiquetadas, las imagenes, los clips- y en como esta
 * organizado, con el video y el papel lado a lado.
 *
 * El molde salio del DOM del origen (scripts/ah-html), no de la imaginacion:
 *
 *   .ugc-shell
 *     aside.ugc-side   marca, volver, Inicio, Recursos, MODULOS
 *     .ugc-main
 *       .ugc-topbar    buscador
 *       .ugc-content   indice (hero + modulos + clases) o leccion (video | papel)
 *
 * ATENCION - NADA DE FLECHAS UNICODE EN ESTE ARCHIVO. Un reemplazo hecho con
 * PowerShell rompio la codificacion y los caracteres de 3 bytes se perdieron: en
 * pantalla quedaron rombos negros. El texto se leia bien en el editor y COMPILABA,
 * asi que ni el typecheck ni los tests lo vieron. Las flechas van como entidades
 * (&larr; / &rarr;), que sobreviven a cualquier reescritura.
 *
 * QUE NO SE REPLICA: la barra de SU plataforma (Comunicados, Propuestas, Recomienda y
 * gana, el chat de Ayuda, el Tour). Son features de su producto; aca serian botones
 * que no llevan a ningun lado.
 */

import { useEffect, useMemo, useState } from 'react';
import { TIPO_BADGE } from './CursoPortal';
import { Miniatura } from './Miniatura';

/**
 * La miniatura que Drive genera para CUALQUIER archivo suyo: el primer fotograma de un
 * video, la primera página de un PDF.
 *
 * ⚠️ Es pública y no se genera ni se guarda NADA. Antes de esto había 3.444 clases y
 *    solo 30 con `portadaClase`: hacer una tapa por clase a mano no escala, y
 *    generarlas con ffmpeg exigía tener el video en disco — que justamente se BORRA
 *    cuando Drive confirma la subida (`--liberar`). El endpoint resuelve las dos cosas.
 *
 *    `Miniatura` ya se hace cargo del 404: si un archivo no tiene thumbnail, la imagen
 *    desaparece y queda la tarjeta sin tapa, que es lo que había.
 */
const DRIVE_THUMB = (id: string, w = 800) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
import { PortadaModulo } from './PortadaModulo';
import type { Clase, Curso, Recurso } from './curso';

const FLECHA_IZQ = '←';
const FLECHA_DER = '→';

/**
 * El nombre del modulo que se INVENTA cuando las clases no traen `grupo`.
 *
 * Vive en una constante y no como literal repetido porque lo usan DOS lugares que tienen
 * que coincidir exactamente: el que agrupa las clases en modulos y el que filtra al hacer
 * click en uno. Si se desincronizan, el modulo se dibuja en la barra y al abrirlo la
 * grilla sale vacia — sin ningun error. Es «una cosa, un lugar» aplicada a un nombre.
 */
const SIN_MODULO = 'Clases';

/**
 * Carga la hoja del origen y avisa CUANDO ESTA. Las dos mitades importan.
 *
 * ⚠️ Sin esperar el `load`, hay varios segundos de contenido crudo apilado. Medido a
 * 1440x900 con la cache apagada: durante mas de 4 s el shell renderiza con
 * `display: block`, la barra queda en y=984 midiendo 120x984, y la pantalla se ve
 * exactamente igual que cuando el CSS no matchea. Son 333 KB que se piden reciEn al
 * montar el componente, asi que la ventana es larga y en una conexion lenta, mas.
 *
 * Y no es solo feo: es el mismo cuadro que el dueno reporto tres veces como «no se ve
 * nada» y como «se ve igual que antes». Una pantalla a medio vestir y una pantalla rota
 * son indistinguibles desde afuera, asi que se prefiere no mostrar nada.
 *
 * El `load` se engancha aunque el <link> ya exista de una visita anterior: en ese caso
 * `sheet` ya esta y se contesta al toque, sin esperar un evento que no va a volver.
 */
function useCssDelOrigen() {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const ya = document.getElementById('ahdoc-css') as HTMLLinkElement | null;
    if (ya) { if (ya.sheet) { setListo(true); return; } ya.addEventListener('load', () => setListo(true), { once: true }); return; }
    const l = document.createElement('link');
    l.id = 'ahdoc-css';
    l.rel = 'stylesheet';
    l.href = '/cono-doc/ugc.css';
    l.addEventListener('load', () => setListo(true), { once: true });
    // Si la hoja no carga, mostrar el curso sin estilo es mejor que no mostrar nada:
    // el material sigue siendo legible. Lo que no puede pasar es quedarse en blanco.
    l.addEventListener('error', () => setListo(true), { once: true });
    document.head.appendChild(l);
  }, []);
  return listo;
}

const minutosDe = (cs: Clase[]) => {
  const seg = cs.reduce((t, c) => {
    const m = /(\d{1,2}):(\d{2})/.exec(c.cardDesc || '');
    return t + (m ? Number(m[1]) * 60 + Number(m[2]) : 0);
  }, 0);
  return seg ? `${Math.round(seg / 60)} min` : '';
};

type Modulo = { n: number; nombre: string; clases: Clase[]; portada: string | null };

/**
 * UNA POSICION EN EL CURSO. Es TODO lo que define «dónde estoy», y va entero en la URL.
 *
 * ⚠️ El comentario de abajo ya decía «LA VISTA VIVE EN LA URL, NO EN EL ESTADO» — y al
 * lado se le fueron agregando `mod`, `q` y el recurso abierto como `useState`. La regla
 * estaba escrita y el código creció en contra: cada uno de esos es una posición que el
 * Atrás no podía devolver. Volver de una clase te dejaba en el índice del curso aunque
 * hubieras salido del módulo 7, porque el módulo no estaba en ningún lado que sobreviva.
 *
 * Reportado por Martín el 29/08/2026: «cuando entro a una clase y le doy para atrás me
 * lleva a todos los cursos, cuando debería llevarme exactamente a la posición anterior. Y
 * con el scroll anterior».
 *
 * La regla que queda: **si algo cambia lo que se ve, va acá.** Un estado de navegación
 * que no está en la URL no sobrevive al Atrás, ni al F5, ni a copiar el link — y las tres
 * cosas se reportan como bugs distintos del mismo botón.
 */
type Vista = {
  clase?: number;       // la clase abierta
  recursos?: boolean;   // la lista de recursos del curso
  r?: string;           // el recurso abierto, por slug
  mod?: string;         // el módulo por el que está filtrada la grilla
  q?: string;           // lo que se escribió en el buscador
};

export default function CursoReplica({ curso, onSalir }: { curso: Curso; onSalir?: () => void }) {
  const cssListo = useCssDelOrigen();

  /**
   * ATENCION - LA VISTA VIVE EN LA URL, NO EN EL ESTADO.
   * Con `useState` a secas, refrescar la pagina devolvia a la grilla de cursos: se
   * perdia la clase abierta y, en un link compartido, tambien el curso. Un curso que
   * no sobrevive a F5 no se puede compartir ni dejar abierto en una pestana.
   * Se usa el hash porque esta vista se monta dentro de rutas distintas (/conocimientos
   * y /compartido/<token>) y el hash no depende de ninguna de las dos.
   */
  const [vista, setVista] = useState<Vista>({});

  /**
   * ⚠️ EL SCROLL SE GUARDA POR POSICION, y la clave es la URL entera.
   *
   * Antes `ir()` hacía `scrollTo({top:0})` SIEMPRE — también al volver. Así que aunque el
   * Atrás devolviera al lugar correcto, devolvía al lugar correcto arriba de todo: en un
   * módulo de 78 clases eso es no volver. Y había otros dos lugares mandando el scroll a
   * cero (Conocimientos.tsx y PortalCompartido.tsx), cada uno con su propia clave.
   *
   * Va en `sessionStorage` y no en memoria porque tiene que sobrevivir a un F5, que es
   * justo cuando más se nota. La clave incluye el pathname: la misma vista se monta bajo
   * /conocimientos y bajo /compartido/<token>, y compartir clave entre dos rutas hace que
   * restaurar sea PEOR que no restaurar — te deja en la posición de otra pantalla.
   */
  /**
   * ⚠️ ACA NO SCROLLEA LA VENTANA: SCROLLEA `.ugc-content`.
   *
   * La hoja del origen arma la pantalla con la barra fija y el contenido en su propio
   * contenedor con `overflow-y: auto`. Medido en MasteryHaus: `window.scrollY` vale 0
   * SIEMPRE (body 663 = innerHeight 663) mientras `.ugc-content` tiene 8.063px de alto
   * sobre 561 visibles.
   *
   * O sea que `window.scrollTo(...)` acá no hace nada — ni el que había en `ir()` para
   * subir al tope, ni el primero que escribí para restaurar. Y la prueba que lo tenía que
   * cazar pasaba en verde comparando 0 con 0: un chequeo sobre un valor que no se mueve
   * confirma cualquier cosa. Se descubrió porque la prueba se preguntó primero si el caso
   * era VALIDO («¿la página puede bajar?») y se contestó que no.
   */
  const carril = () => document.querySelector('.ugc-content') as HTMLElement | null;
  const clave = () => `cono-pos:${location.pathname}${location.hash}`;
  const guardarScroll = () => {
    try { sessionStorage.setItem(clave(), String(carril()?.scrollTop ?? 0)); } catch { /* noop */ }
  };
  const restaurarScroll = () => {
    let y = 0;
    try { y = parseInt(sessionStorage.getItem(clave()) || '0', 10) || 0; } catch { /* noop */ }
    // Dos frames: el primero deja pintar la vista nueva, el segundo ya tiene el alto real.
    // Con uno solo, la lista todavía no creció y el scroll queda topeado en lo que había.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = carril();
      if (c) c.scrollTop = y; else window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
    }));
  };

  useEffect(() => {
    const leer = () => {
      const h = new URLSearchParams(location.hash.replace(/^#/, ''));
      const n = Number(h.get('clase'));
      setVista({
        clase: Number.isFinite(n) && n > 0 ? n : undefined,
        recursos: h.get('v') === 'recursos',
        r: h.get('r') ?? undefined,
        mod: h.get('mod') ?? undefined,
        q: h.get('q') ?? undefined,
      });
      // Llegar acá es SIEMPRE ir a una posición que ya existía (Atrás, Adelante, o el
      // link pegado): se restaura lo que se había guardado para ella.
      restaurarScroll();
    };
    leer();
    window.addEventListener('hashchange', leer);
    return () => window.removeEventListener('hashchange', leer);
  }, []);
  /**
   * ⚠️ ESCRIBE SOLO SUS CLAVES; el resto del hash NO se toca.
   *
   * Arrancaba de un `URLSearchParams` vacio, o sea REEMPLAZABA el hash entero. En
   * /conocimientos daba igual, pero en un link compartido el hash lo comparte con el
   * portal, que guarda ahi el `curso=`: abrir una clase lo borraba, y al refrescar no
   * quedaba de que curso era esa clase — volvias a la grilla de cursos.
   *
   * Medido en produccion: `#curso=creativos-ugc-realistas` pasaba a `#clase=1`.
   *
   * La regla, que vale para cualquier estado compartido en una misma URL: el que
   * escribe parte de una clave PARTE DE LO QUE HAY, nunca de vacio.
   */
  /**
   * ⚠️ Y EMPUJA, NO REEMPLAZA. `replaceState` no crea entrada en el historial, asi que el
   * boton ATRAS del navegador no volvia a la pantalla anterior del curso: se salia del
   * portal entero, a la pagina de donde habias venido. Reportado por Martin el 29/08:
   * «cuando le doy a atras no me lleva atras, sino que se sale de la pantalla».
   *
   * Con `pushState` cada paso —abrir una clase, ir a recursos, volver al indice— deja su
   * entrada, y el `hashchange` de arriba ya redibuja solo cuando el navegador la saca.
   *
   * Se compara el destino con la URL actual antes de empujar: sin eso, hacer click en la
   * clase que ya estas viendo apila entradas identicas y Atras «no hace nada» N veces.
   */
  /**
   * `reemplazar` PISA la entrada actual en vez de agregar una.
   *
   * Es para los cambios que no son «un paso» para el usuario: escribir en el buscador
   * (una entrada por tecla haría que salir de una búsqueda de 12 letras cueste 12 clicks)
   * o limpiar un filtro que quedó incoherente con lo que se acaba de hacer.
   */
  const ir = (v: Vista, o?: { reemplazar?: boolean }) => {
    // Lo primero: anotar dónde estábamos, para poder volver ACA y no al tope.
    guardarScroll();
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    // Se escriben las CINCO claves de la posición. Las que no van, se borran: dejar una
    // colgada (un `mod` viejo al abrir una clase de otro módulo) es peor que no tenerla,
    // porque el Atrás devuelve a un lugar que nunca existió.
    if (v.clase) h.set('clase', String(v.clase)); else h.delete('clase');
    if (v.recursos) h.set('v', 'recursos'); else h.delete('v');
    if (v.r) h.set('r', v.r); else h.delete('r');
    if (v.mod) h.set('mod', v.mod); else h.delete('mod');
    if (v.q) h.set('q', v.q); else h.delete('q');
    const s = h.toString();
    const base = location.pathname + location.search;
    const destino = s ? `${base}#${s}` : base;
    if (o?.reemplazar) history.replaceState(null, '', destino);
    else if (destino !== base + location.hash) history.pushState(null, '', destino);
    setVista(v);
    // Un paso HACIA ADELANTE arranca arriba: es contenido que no viste todavía. El
    // scroll de la posición anterior ya quedó guardado, así que el Atrás lo va a
    // encontrar. Un `reemplazar` NO sube: no es un paso — escribiendo en el buscador te
    // tiraría al tope en cada tecla.
    if (!o?.reemplazar) {
      const c = carril();
      if (c) c.scrollTop = 0; else window.scrollTo({ top: 0 });
    }
  };

  /**
   * ⚠️ EL BUSCADOR SI ES ESTADO LOCAL, y a propósito: se escribe letra por letra.
   *
   * Empujar una entrada de historial por cada tecla haría que el Atrás borre una letra
   * por vez y que salir de una búsqueda de 12 caracteres cueste 12 clicks. Lo que se
   * guarda en la URL es la búsqueda YA HECHA (cuando se abre algo desde sus resultados),
   * y de ahí sale el valor inicial: por eso arranca de `vista.q`.
   */
  const [q, setQ] = useState(vista.q ?? '');
  // Si la URL cambia por Atrás/Adelante, el input tiene que seguirla.
  useEffect(() => { setQ(vista.q ?? ''); }, [vista.q]);

  const modulos: Modulo[] = useMemo(() => {
    const m = new Map<string, Clase[]>();
    for (const c of curso.clases) {
      const g = c.grupo || SIN_MODULO;
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
    const grupos = [...m.entries()];

    /**
     * ⚠️ CUANDO EL MODULO DICE COMO SE LLAMA, GANA EL.
     *
     * `n` salia de la posicion en la lista, y eso contradice al propio contenido: en
     * `m5-95` los modulos se llaman «Modulo 9», «Modulo 10»… «Modulo 19» y la posicion
     * daba 8..18. Medido sobre los 374 modulos del portal: 134 traen su ordinal escrito y
     * **95 discrepan**. No es un detalle interno — en la tarjeta conviven TRES numeros: el
     * chip, el numero gigante de la lamina y el titulo completo escrito abajo. Con la
     * posicion, el que mira lee «10» dos veces y «Modulo 11» debajo.
     *
     * Pero el ordinal del titulo NO se toma a ciegas, porque no siempre es el numero del
     * modulo: `ugc-sim-academy` los llama «Modulo 1.1», «1.2», «1.3», donde el 1 es el
     * PADRE y tomarlo dejaria tres modulos numerados 1. Por eso la regla es por CURSO y
     * exige coherencia: se adopta la numeracion propia solo si TODOS los grupos la traen y
     * ninguna tiene parte decimal. Si algo de eso falla, el curso entero se queda con la
     * posicion — nunca una mezcla, que seria la peor de las dos.
     *
     * ⚠️ Y NO se exige que los numeros sean UNICOS, aunque el reflejo diga que si. Un
     * ordinal repetido no es un error nuestro: es lo que dice la fuente. `nuevo-organic-
     * ecom` tiene dos modulos llamados «Modulo 12 - Guionizar Los Videos Antes De Grabar»
     * (el segundo con un «(1)» pegado) porque la plataforma de origen lo tiene duplicado.
     * Con la guarda de unicidad puesta, ESE curso —47 modulos— se caia entero a la
     * posicion y los otros 46 pasaban a contradecir su propio titulo, para tapar un
     * duplicado que existe de verdad. Mostrar 12 en los dos es fiel; mostrar 12 y 13 es
     * inventar. El `key` del render va por NOMBRE, asi que un `n` repetido no rompe nada.
     */
    const ORDINAL_PROPIO = /^\s*[([]?\s*(?:m[oó]dulo|semana|unidad|secci[oó]n|bloque|cap[ií]tulo)\s*[)\]]?\s*(\d{1,3})(\.\d+)?\b/iu;
    const propios = grupos.map(([nombre]) => ORDINAL_PROPIO.exec(nombre));
    const numerosPropios = propios.every((o) => o && !o[2]) ? propios.map((o) => Number(o![1])) : null;
    const propiaSirve = numerosPropios != null;

    // El numero del modulo sale del CODIGO de la leccion, no de su posicion: el origen
    // tiene 5 modulos y aca hay 4 -el 2 es una tabla sin lecciones- asi que numerar por
    // indice corria todas las portadas un lugar.
    return grupos.map(([nombre, clases], i) => {
      const n = propiaSirve ? numerosPropios![i] : (Number((clases[0]?.codigo ?? '').split('.')[0]) || i + 1);
      // La tapa del módulo sale del CURSO, no de una ruta escrita acá: ver
      // `portadasModulo` en curso.ts. Sin ella, la de su primera clase; sin ninguna, el
      // degradé con el número, que es el diseño para cuando no hay tapa.
      const portada = curso.portadasModulo
        ? `${curso.portadasModulo}${n}.webp`
        : (clases.find((c) => c.portadaClase)?.portadaClase ?? null);
      return { n, nombre, clases, portada };
    });
  }, [curso.clases, curso.portadasModulo]);

  /**
   * ⚠️ ABRIR UN MODULO ES FILTRAR POR MODULO, NO BUSCAR SU NOMBRE.
   *
   * Antes el click hacia `setQ(m.nombre)` y el filtro era un `includes` de texto sobre
   * `titulo + grupo + codigo`. Un buscador con cara de filtro, y falla en las dos
   * direcciones:
   *
   *  · DE MENOS: cuando ninguna clase trae `grupo`, el agrupado inventa el modulo
   *    sintetico (`SIN_MODULO`) — un nombre que no esta escrito en NINGUNA clase, asi que
   *    buscarlo como texto da cero. Entonces se llamaba «Sin modulo»; hoy dice «Clases»,
   *    que es lo que el usuario tiene que leer — «Sin modulo» se lee como un error.
   *    Medido el 29/08/2026: **82 clases de 10 cursos** quedaban inalcanzables por ese
   *    camino (termux 17, mindset-millonario 14, trading-clutifx 11, the-real-wolf 10,
   *    codigo-genio 9, mentoria-d60 8, us30 6, the-real-world 4, iman-gadzhi 2,
   *    creativos-animados 1). El usuario ve «0 de 17» y una grilla vacia.
   *  · DE MAS: un nombre de modulo contenido en otro, o en el titulo de una clase de otro
   *    modulo, arrastra clases ajenas adentro.
   *
   * El modulo es una IDENTIDAD, no un texto: se compara por igualdad y con la MISMA
   * expresion que arma el agrupado de arriba, para que el sintetico matchee.
   */
  // Sale de la URL, no de `useState`: es una POSICION, y tiene que sobrevivir al Atrás.
  const mod = vista.mod ?? null;

  /**
   * ⚠️ ABRIR UNA CLASE CONSERVA EL LUGAR DEL QUE SALISTE. Es el bug que reportó Martín.
   *
   * Antes era `ir({ clase: n })`, que borra el resto de la posición: entrabas al módulo 7,
   * abrías una clase, y el Atrás te devolvía al índice del curso — o directamente al
   * catálogo— porque en la URL ya no quedaba rastro de que venías de un módulo. El paso
   * atrás llevaba a un lugar por el que nunca habías pasado.
   *
   * Llevando el contexto adentro de la posición de la clase, el Atrás lo devuelve solo:
   * `#mod=Módulo 7&clase=12` → Atrás → `#mod=Módulo 7`, que es exactamente de donde
   * saliste. Y lo mismo con una búsqueda.
   */
  const contexto = { mod: vista.mod, q: vista.q };
  const abrirClase = (n: number) => ir({ ...contexto, clase: n });
  /** El «Volver» de una clase: al listado del que salió, no al índice pelado. */
  const volverAlListado = () => ir(contexto);

  const filtradas = useMemo(() => {
    if (mod) return curso.clases.filter((c) => (c.grupo || SIN_MODULO) === mod);
    const t = q.trim().toLowerCase();
    if (!t) return null;
    return curso.clases.filter((c) => `${c.titulo} ${c.grupo ?? ''} ${c.codigo ?? ''}`.toLowerCase().includes(t));
  }, [q, mod, curso.clases]);

  const clase = vista.clase ? curso.clases.find((c) => c.n === vista.clase) : undefined;

  // Hasta que la hoja del origen este, el curso NO se dibuja: ver `useCssDelOrigen`.
  if (!cssListo) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{curso.titulo}</span>
        <span style={{ opacity: 0.6, fontSize: 13 }}>Abriendo el curso…</span>
      </div>
    );
  }

  return (
    <div className="ahdoc">
      <div className="paper-bg" aria-hidden />
      <div className="grain" aria-hidden />
      <div className="ugc">
        <div className="ugc-shell">
          <aside className="ugc-side" aria-label="Navegacion del curso">
            <div className="ugc-side-brand">
              <span className="ugc-side-name">{curso.titulo}</span>
              <span className="ugc-side-sub">{curso.clases.length} clases</span>
            </div>
            {onSalir && (
              <button type="button" className="ugc-side-exit" onClick={onSalir}>
                <span className="ugc-side-exit-label">{FLECHA_IZQ} Volver a los cursos</span>
              </button>
            )}
            <nav className="ugc-nav">
              {/* El `!q` no sobra: sin el, «Inicio del curso» seguia marcado mientras un
                  modulo estaba filtrando, y quedaban DOS renglones en verde. Una barra que
                  marca dos lugares a la vez no dice donde estas: dice menos que ninguno. */}
              <button type="button" className={`ugc-nav-item${!clase && !vista.recursos && !q && !mod ? ' on' : ''}`}
                onClick={() => ir({})}>
                <span className="ugc-nav-label">Inicio del curso</span>
              </button>
              {curso.recursos.length > 0 && (
                <button type="button" className={`ugc-nav-item${vista.recursos ? ' on' : ''}`}
                  onClick={() => ir({ recursos: true })}>
                  <span className="ugc-nav-label">Recursos del curso</span>
                  <span className="ugc-nav-count">{curso.recursos.length}</span>
                </button>
              )}
              <div className="ugc-nav-h">Modulos</div>
              {/* «Estar parado en un modulo» son DOS cosas y la barra tiene que marcar las
                  dos: verlo filtrado, y estar adentro de una de sus clases. La segunda es
                  la que faltaba — con una leccion abierta la barra no marcaba nada, que es
                  justo cuando mas se necesita saber de que modulo es lo que estas viendo. */}
              {modulos.map((m) => (
                <button key={m.nombre} type="button"
                  className={`ugc-nav-item${(clase ? (clase.grupo || SIN_MODULO) === m.nombre : mod === m.nombre) ? ' on' : ''}`}
                  onClick={() => ir({ mod: m.nombre })} title={m.nombre}>
                  <span className="ugc-nav-num">{m.n}</span>
                  <span className="ugc-nav-label">{m.nombre}</span>
                  <span className="ugc-nav-count">{m.clases.length} {'·'} {minutosDe(m.clases)}</span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="ugc-main">
            <div className="ugc-topbar">
              <div className="ugc-search">
                {/* Buscar te saca de donde estés (un módulo, una clase) y queda en la URL,
                    pero REEMPLAZANDO: una entrada por tecla haría que salir de una
                    búsqueda de 12 letras cueste 12 clicks en el Atrás. */}
                <input value={q} onChange={(e) => { setQ(e.target.value); ir({ q: e.target.value || undefined }, { reemplazar: true }); }}
                  placeholder="Buscar leccion, modelo, formato" aria-label="Buscar en el curso" />
              </div>
            </div>

            <div className="ugc-content">
              {clase ? (
                <Leccion clase={clase} curso={curso} abrirClase={abrirClase} volverAlListado={volverAlListado} />
              ) : vista.recursos ? (
                <Recursos curso={curso} abiertoSlug={vista.r}
                  abrir={(slug) => ir({ recursos: true, r: slug })}
                  cerrar={() => ir({ recursos: true })} />
              ) : filtradas ? (
                <>
                  {/* Filtrando por modulo, el titulo dice DE QUE modulo: «12 de 404» no
                      dice donde estas parado, y era lo unico que se veia al abrir uno. */}
                  <div className="ugc-rail-head">
                    <h2>{mod ? `${mod} ${'·'} ${filtradas.length} ${filtradas.length === 1 ? 'leccion' : 'lecciones'}` : `${filtradas.length} de ${curso.clases.length}`}</h2>
                  </div>
                  <div className="ugc-rail">
                    {filtradas.map((c) => <TarjetaClase key={c.n} clase={c} onAbrir={() => abrirClase(c.n)} />)}
                  </div>
                </>
              ) : (
                <Indice curso={curso} modulos={modulos} onAbrir={(c) => abrirClase(c.n)}
                  onModulo={(m) => ir({ mod: m.nombre })} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * El indice: el hero de por donde empezar y los modulos.
 *
 * ATENCION - NO va abajo una lista con TODAS las clases. Estaba, y contradecia a la
 * barra: alli se ven 3 modulos y abajo aparecian las 30 clases sueltas, asi que el
 * curso parecia tener dos organizaciones distintas al mismo tiempo. Un modulo se abre
 * y muestra LAS SUYAS.
 */
function Indice({ curso, modulos, onAbrir, onModulo }: {
  curso: Curso; modulos: Modulo[]; onAbrir: (c: Clase) => void; onModulo: (m: Modulo) => void;
}) {
  const primera = curso.clases[0];
  // El hero es el bloque mas grande del indice, y sin imagen queda un rectangulo negro
  // vacio. La tapa de la clase la tiene un curso solo; la del CURSO la tienen todos, asi
  // que es la que evita que la pantalla nazca vacia en los otros veintipico.
  const tapaHero = primera?.portadaClase ?? curso.portada;
  return (
    <>
      {primera && (
        <button type="button" className="ugc-hero" onClick={() => onAbrir(primera)}>
          {tapaHero && <Miniatura className="ugc-hero-img" src={tapaHero} />}
          <span className="ugc-hero-shade" aria-hidden />
          <span className="ugc-hero-body">
            <span className="ugc-hero-eyebrow">Empieza aquí{primera.codigo ? ` ${'·'} ${primera.codigo}` : ''}</span>
            <span className="ugc-hero-title">{primera.titulo}</span>
            <span className="ugc-hero-cta">Abrir</span>
          </span>
        </button>
      )}
      <div className="ugc-rail-head"><h2>Los modulos</h2></div>
      <div className="ugc-rail">
        {modulos.map((m) => (
          <button key={m.nombre} type="button" className="ugc-modcard" onClick={() => onModulo(m)}>
            <span className="ugc-modcard-cover">
              {/* ⚠️ LA LÁMINA VA SIEMPRE Y VA PRIMERA, sin ninguna condición sobre
                  `m.portada`. La razón es que `m.portada` es una ruta CONSTRUIDA
                  (`${portadasModulo}${n}.webp`) y no comprobada: «Creativos Animados» sale
                  con n=6 y m6.webp nunca existió, así que preguntarle a `m.portada` si hay
                  tapa devuelve que sí sobre un 404. Dibujada abajo, la tapa real la tapa
                  entera cuando carga (inset:0 + object-fit:cover, opaca) y cuando no carga
                  la lámina ya estaba. Cero estado, cero segundo render, cero parpadeo — y
                  el módulo 6, que hasta hoy era un rectángulo negro, queda cubierto. */}
              <PortadaModulo n={m.n} titulo={m.nombre} />
              {m.portada && <Miniatura src={m.portada} />}
              <span className="shade" aria-hidden />
              {/* El chip se queda: la lámina dibuja el número en HUECO y el chip es macizo
                  sobre lima, así que no compiten — y sobre una tapa REAL sigue siendo la
                  única forma de saber de qué módulo es. Es lo que ya hacía AvatarHype. */}
              <span className="ugc-modcard-n" aria-hidden>{m.n}</span>
            </span>
            <span className="ugc-modcard-body">
              <span className="ugc-modcard-t">{m.nombre}</span>
              <span className="ugc-modcard-meta">{m.clases.length} lecciones{minutosDe(m.clases) ? ` ${'·'} ${minutosDe(m.clases)}` : ''}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function TarjetaClase({ clase, onAbrir }: { clase: Clase; onAbrir: () => void }) {
  return (
    <button type="button" className="ugc-modcard" onClick={onAbrir}>
      <span className="ugc-modcard-cover">
        {/* La tapa hecha a mano gana; si no hay, el FOTOGRAMA del video. Sin esto la
            tarjeta era un rectángulo negro en 3.414 de 3.444 clases. */}
        {clase.portadaClase
          ? <Miniatura src={clase.portadaClase} />
          : clase.videoId && <Miniatura src={DRIVE_THUMB(clase.videoId)} />}
        <span className="shade" aria-hidden />
        {/* El numero es el de la clase DENTRO de su modulo (`vn`), no el `n` global.
            `n` es el id de la plataforma: el modulo 1 arrancaba en 61 y el usuario veia
            "1 Introduccion a la Formula" con las clases 61..67. Con vn arranca en 1 y
            reinicia en cada modulo, que es la unica numeracion que le sirve a quien
            estudia: ya sabe en que modulo esta. El dato YA existia y no lo usaba nadie. */}
        <span className="ugc-modcard-n" aria-hidden>{clase.vn ?? clase.codigo ?? clase.n}</span>
        {/* El triángulo dice que es un VIDEO. Sobre un fotograma real hace falta: sin
            él, la tapa se lee como una imagen suelta y no como algo que se reproduce. */}
        {clase.videoId && <span className="ugc-modcard-play" aria-hidden>{'\u25B6'}</span>}
      </span>
      <span className="ugc-modcard-body">
        <span className="ugc-modcard-t">{clase.titulo}</span>
        <span className="ugc-modcard-meta">{clase.cardDesc}</span>
      </span>
    </button>
  );
}

/** Los recursos del curso: los 13 que venian del curso viejo (agentes, Notion, PDFs). */
function Recursos({ curso, abiertoSlug, abrir, cerrar }: {
  curso: Curso;
  /** Qué recurso está abierto. Viene de la URL: si fuera estado local, el Atrás desde un
   *  recurso saltearía la lista entera y saldría del curso. */
  abiertoSlug?: string;
  abrir: (slug: string) => void;
  cerrar: () => void;
}) {
  const abierto = abiertoSlug ? curso.recursos.find((r) => r.slug === abiertoSlug) ?? null : null;
  const setAbierto = (r: Recurso | null) => (r ? abrir(r.slug) : cerrar());
  if (abierto) {
    return (
      <div className="ugc-paper">
        <button type="button" className="ugc-btn" onClick={() => setAbierto(null)}>{FLECHA_IZQ} Todos los recursos</button>
        <h2 className="ugc-paper-title">{abierto.label}</h2>
        <p className="ugc-doc-p">{abierto.cardDesc}</p>
        {abierto.intro && <p className="ugc-doc-p">{abierto.intro}</p>}
        {abierto.texto && <pre className="ugc-pre">{abierto.texto}</pre>}

        {/* ⚠️ EL ARCHIVO. Esto FALTABA, y es el 90% de los recursos de un curso.
            Este detalle pintaba `label`, `cardDesc`, `intro`, `texto`, `notionUrl` e
            `items` — y nunca `driveId`. O sea que todo recurso que es un ARCHIVO (un PDF,
            una planilla) mostraba el título, la descripción y DEBAJO NADA. Los únicos que
            se veían eran los enlaces, porque usan `items`.

            Martin lo reportó tres veces como «adentro de los recursos no hay NADA», y las
            tres busqué del lado de los DATOS: el formato del archivo, el id de Drive, el
            título, los permisos. Los datos estaban bien las tres veces. Lo que faltaba era
            el <iframe>, en el componente del portal COMPARTIDO — `CursoPortal` sí lo
            tenía, y por eso mirar ese archivo confirmaba que «el código está bien».

            La lección: cuando el reporte es «no se ve», el ÚLTIMO eslabón —quién pinta,
            EN LA RUTA QUE EL USUARIO ABRIÓ— se mira PRIMERO, no al final. Dos rutas que
            comparten datos no comparten vista. */}
        {abierto.driveId && (
          <div className="ugc-vcard">
            <div className="ugc-vframe" style={{ aspectRatio: '3 / 4', width: '100%' }}>
              <iframe
                src={`https://drive.google.com/file/d/${abierto.driveId}/preview`}
                title={abierto.label}
                loading="lazy"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
              />
            </div>
            <div className="ugc-vbar">
              <a
                className="ugc-vbar-dur"
                href={`https://drive.google.com/file/d/${abierto.driveId}/view`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir en Drive {FLECHA_DER}
              </a>
            </div>
          </div>
        )}
        {abierto.notionUrl && (
          <p className="ugc-doc-p">
            <a href={abierto.notionUrl} target="_blank" rel="noopener noreferrer">Abrir en Notion {FLECHA_DER}</a>
          </p>
        )}
        {abierto.items?.map((i) => (
          <p className="ugc-doc-p" key={i.url}>
            <a href={i.url} target="_blank" rel="noopener noreferrer">{i.label} {FLECHA_DER}</a>
          </p>
        ))}
      </div>
    );
  }
  return (
    <>
      <div className="ugc-rail-head"><h2>Recursos del curso</h2></div>
      <div className="ugc-rail">
        {curso.recursos.map((r) => (
          <button key={r.slug} type="button" className="ugc-modcard" onClick={() => setAbierto(r)}>
            {/* La PRIMERA PÁGINA del PDF como tapa. Un recurso sin tapa es una fila de
                texto, y con 62 en una grilla no hay forma de reconocer ninguno de un
                vistazo. Los enlaces no tienen archivo, así que no llevan tapa. */}
            {r.driveId && (
              <span className="ugc-modcard-cover">
                <Miniatura src={DRIVE_THUMB(r.driveId)} />
                <span className="shade" aria-hidden />
                <span className="ugc-modcard-n" aria-hidden>{r.badge ?? TIPO_BADGE[r.tipo]}</span>
              </span>
            )}
            <span className="ugc-modcard-body">
              <span className="ugc-modcard-t">{r.label}</span>
              <span className="ugc-modcard-meta">{r.cardDesc}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function Leccion({ clase, curso, abrirClase, volverAlListado }: {
  clase: Clase; curso: Curso;
  /** Abre otra clase CONSERVANDO el listado del que se salió (módulo o búsqueda). */
  abrirClase: (n: number) => void;
  /** Vuelve a ese mismo listado, no al índice pelado del curso. */
  volverAlListado: () => void;
}) {
  const [doc, setDoc] = useState<{ paneles: Record<string, string> } | null>(null);
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'error'>('idle');
  const [tab, setTab] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [tx, setTx] = useState<string[] | null>(null);

  const i = curso.clases.findIndex((c) => c.n === clase.n);
  const prev = i > 0 ? curso.clases[i - 1] : null;
  const next = i >= 0 && i < curso.clases.length - 1 ? curso.clases[i + 1] : null;

  // El cruce va por SLUG contra los recursos del curso: un slug que no resuelve se
  // descarta en silencio y no dibuja una tarjeta vacia (pasa cuando la ficha se regenera
  // con menos recursos de los que sus clases todavia nombran).
  const material = (clase.recursoSlugs ?? [])
    .map((s) => curso.recursos.find((r) => r.slug === s))
    .filter((r): r is Recurso => Boolean(r));

  useEffect(() => {
    setDoc(null); setTab(null); setTx(null);
    if (clase.hasDoc && clase.docSlug) {
      setEstado('cargando');
      fetch(`/cono-doc/${clase.docSlug}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => { setDoc(d); setTab(Object.keys(d.paneles ?? {})[0] ?? null); setEstado('idle'); })
        .catch(() => setEstado('error'));
    }
    // La TRANSCRIPCION, que faltaba. Vive en /cono-tx/<videoId>.json igual que en el
    // portal, y se suma como una tab mas del papel: es contenido de la leccion.
    if (clase.hasTx && clase.videoId) {
      fetch(`/cono-tx/${clase.videoId}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((p: string[]) => setTx(p))
        .catch(() => setTx(null));
    }
  }, [clase.docSlug, clase.hasDoc, clase.videoId, clase.hasTx]);

  const alClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest('.ugc-copy');
    if (!btn) return;
    const pre = (btn.closest('.ugc-card') ?? btn.parentElement)?.querySelector('.ugc-pre');
    const texto = (pre?.textContent ?? '').trim();
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    });
  };

  const tabs = [...Object.keys(doc?.paneles ?? {}), ...(tx?.length ? ['Transcripcion'] : [])];
  const activa = tab && tabs.includes(tab) ? tab : tabs[0] ?? null;

  return (
    <div className="ugc-split">
      <div className="ugc-vcol">
        {/* UNA sola barra de navegacion. Estaba puesta arriba y abajo, asi que los
            botones aparecian dos veces en la misma pantalla. */}
        <nav className="ugc-lecnav">
          {/* Lleva al listado del que saliste —el módulo, o los resultados de tu
              búsqueda—, no al índice pelado: es el mismo destino al que va el Atrás del
              navegador desde acá. Que los dos coincidan es la mitad del arreglo; si
              llevan a lugares distintos, el usuario no puede predecir ninguno. */}
          <button type="button" className="ugc-btn" onClick={volverAlListado}>{FLECHA_IZQ} Todas las clases</button>
          {prev && <button type="button" className="ugc-btn" onClick={() => abrirClase(prev.n)}>{FLECHA_IZQ} {prev.titulo}</button>}
          {next && <button type="button" className="ugc-btn" onClick={() => abrirClase(next.n)}>{next.titulo} {FLECHA_DER}</button>}
        </nav>
        <div className="ugc-ltitle">
          <span className="ugc-pill">{clase.grupo}{clase.codigo ? ` ${'·'} ${clase.codigo}` : ''}</span>
          <h1>{clase.titulo}</h1>
        </div>
        {/* Sin video Y sin portada NO se dibuja el marco. Antes salia igual: un rectangulo
            16:9 negro con la barra debajo, o sea el hueco donde deberia haber un video —
            para una clase que es solo documento (3 de 37: «Musica y efectos», «Agentes»,
            «bienvenida») eso se lee como un reproductor roto, no como una clase de leer. */}
        {(clase.videoId || clase.portadaClase) && (
          <div className="ugc-vcard">
            <div className="ugc-vframe" style={{ aspectRatio: '16 / 9', width: '100%' }}>
              {clase.videoId ? (
                <iframe src={`https://drive.google.com/file/d/${clase.videoId}/preview`}
                  allow="autoplay" title={clase.titulo}
                  style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
              ) : (
                <Miniatura src={clase.portadaClase!} />
              )}
            </div>
            <div className="ugc-vbar"><span className="ugc-vbar-dur">{clase.cardDesc}</span></div>
          </div>
        )}
      </div>

      <div className="ugc-pcol">
        {tabs.length > 0 && (
          <div className="ugc-tabs">
            <div className="ugc-tablist" role="tablist" aria-label="Contenido de la leccion">
              {tabs.map((n) => (
                <button key={n} type="button" role="tab" aria-selected={activa === n}
                  className={`ugc-tab${activa === n ? ' on' : ''}`} onClick={() => setTab(n)}>{n}</button>
              ))}
            </div>
            {copiado && <span className="ugc-badge">Copiado</span>}
          </div>
        )}
        {estado === 'cargando' && <div className="ugc-paper">Cargando el material...</div>}
        {estado === 'error' && <div className="ugc-paper">No pude cargar el material de esta clase.</div>}
        {activa === 'Transcripcion' ? (
          <div className="ugc-paper">
            {/* Copiar y descargar, como en el resto del portal. Sin esto la
                transcripcion es un muro de texto que no se puede llevar a ningun lado,
                y es justamente lo que la gente usa para buscar y citar. */}
            <div className="ugc-lecnav">
              <button type="button" className="ugc-btn"
                onClick={() => navigator.clipboard.writeText((tx ?? []).join('\n\n'))}>
                Copiar transcripcion
              </button>
              <button type="button" className="ugc-btn" onClick={() => {
                // Los caracteres de control van como ESCAPE y nunca como byte crudo: un NUL
                // hace que la busqueda declare binario el archivo y no devuelva ni una linea.
                // Contesta vacio, y el vacio parece una respuesta. Esta escrito en AGENTS.md.
                const sucio = /[<>:"/\\|?*\u0000-\u001f]+/g;
                const nombre = String(clase.titulo).replace(sucio, ' ').trim().slice(0, 90);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([(tx ?? []).join('\n\n')], { type: 'text/plain;charset=utf-8' }));
                a.download = `${nombre}.txt`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}>
                Descargar .txt
              </button>
            </div>
            {tx?.map((p, k) => <p className="ugc-doc-p" key={k}>{p}</p>)}
          </div>
        ) : activa && doc?.paneles[activa] ? (
          <div className="ugc-paper" onClick={alClick}
            dangerouslySetInnerHTML={{ __html: doc.paneles[activa] }} />
        ) : !tabs.length && estado === 'idle' ? (
          /* ⚠️ EL `resumen` NO SE PINTABA EN NINGUN LADO. Es el unico contenido de las
             clases que no tienen video ni documento —las de los cursos de la casa—, asi
             que la pantalla les decia «Esta clase no trae documento» teniendo el texto
             adentro de la ficha. Medido el 29/08/2026: 11 clases, 17.894 caracteres.
             `CursoPortal` si lo dibujaba, pero es codigo muerto (ver el bloque de
             `material` aca abajo). */
          clase.resumen?.trim()
            ? <div className="ugc-paper">{clase.resumen.split(/\n{2,}/).map((p, k) => <p className="ugc-doc-p" key={k}>{p}</p>)}</div>
            : <div className="ugc-paper">Esta clase no trae documento.</div>
        ) : null}

        {/* ⚠️ EL MATERIAL DE LA CLASE, que tampoco se dibujaba.
            `recursoSlugs` dice que PDF va con que clase, y esta vista tenia CERO
            referencias al campo: 5.284 vinculos clase→recurso invisibles en 23 cursos. El
            archivo seguia estando en la lista general del curso, pero desde la clase no
            habia forma de saber cual le tocaba — ni desde el recurso, cual era su clase.

            ⚠️ Y LA CAUSA DE FONDO, que vale para el proximo campo que se agregue:
            `catalogo.ts` pone `replica: true` a TODOS los cursos con un `.map()`, asi que
            `CursoPortal` cortocircuita a esta vista SIEMPRE — tambien para el admin. O sea
            que `CursoPortal` es codigo muerto y todo lo que dibuja y esta no, no se ve en
            ninguna parte. Son «dos componentes para la misma pantalla»: lo que se agrega a
            uno no aparece en el otro, y hoy el que manda es este. */}
        {material.length > 0 && (
          <div className="ugc-paper">
            <h3 className="ugc-paper-title">Material de esta clase</h3>
            {material.map((r) => {
              const href = r.driveId ? `https://drive.google.com/file/d/${r.driveId}/view` : r.notionUrl;
              const etiqueta = `${r.badge ? `${r.badge} ${'·'} ` : ''}${r.label}`;
              return href ? (
                <a key={r.slug} className="ugc-btn" href={href} target="_blank" rel="noreferrer"
                   style={{ display: 'block', marginTop: 8 }}>{etiqueta} {FLECHA_DER}</a>
              ) : (
                /* Un recurso sin archivo ni link (un prompt, un banco) vive en la pestaña
                   «Recursos del curso»: se NOMBRA, y no se finge un boton que no lleva a
                   ningun lado. Un boton muerto es peor que no tenerlo. */
                <p className="ugc-doc-p" key={r.slug} style={{ marginTop: 8 }}>{etiqueta}</p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
