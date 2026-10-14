'use client';

// =============================================================================
// PortalAlumno — lo que ve el cliente de Mauricio con su link personal
// =============================================================================
// Es la ÚNICA pantalla de MaKo que ve el cliente de un cliente. Sin el chrome de la app
// (`/compartido` lo saca: app/_components/PublicRouteGate.tsx) y con la marca del PRODUCTO que
// compró («Negocio que Escala»), no la de MaKo.
//
// ⚠️ SE DIBUJA CON EL DISEÑO DE CONOCIMIENTOS (app/_cursos/CursoUgc.tsx), y no con uno propio. El
//    07/10/2026 Martín miró la vista del alumno —un acordeón de etapas con «Hola.» arriba— al lado
//    de un curso de /conocimientos y escribió: «No se ve para nada igual, COPIA lo que ya hicimos en
//    CONOCIMIENTOS». Las ETAPAS son los módulos (barra oscura, tarjetas con su lámina) y las CLASES
//    las lecciones (video a la izquierda, papel a la derecha). La traducción, pura y con test, está
//    en ./modelo-ugc.ts; acá se arma la lección y se guarda lo que cambia en la pantalla.
//
// Qué módulo y qué clase están abiertos —y por qué no— lo decide el server (`armarModulos`,
// lib/curso-portal.ts, con los candados de lib/curso-bloqueo.ts) y llega armado: acá no se recalcula.
// Una clase cerrada llega con su título y su motivo, nada más, y así se dibuja. Cuando un envío completa la etapa, la página se pide de nuevo
// (`router.refresh`) y la etapa nueva llega abierta.
//
// Texto de pantalla: español neutro con TÚ (los clientes de Mauricio son mexicanos), y corto.
//
// #665 (06/10/2026), tres cosas que llegan armadas del server y acá sólo se dibujan:
//   · «AGENDA TU SESIÓN» en una etapa que el alumno COMPLETÓ (`etapa.agendaUrl`): arriba del curso
//     la de la última terminada (completarla lo pasa a la siguiente en el acto, así que es la sesión
//     que le toca ahora), y en la cabecera de cada etapa terminada la suya. Antes de completarla el
//     link no llega al navegador (lib/curso-portal.ts, `armarModulos`).
//   · UNA CLASE POR ÁREA (`clase.areas`) se contesta una vez por área: un bloque por área, cada uno
//     con su `TareaAlumno` y su `a`. El chip de la clase dice el estado de TODAS (`estadoDeAreas`).
//   · EL LÍDER DE UN ÁREA (`vista.area`): ve sólo sus clases, y ni la cuenta de etapas ni el avance
//     del cliente (no es su recorrido). Lo que el server no le mandó no se puede dibujar.
//   · EL PASO 5 (07/10/2026): una tarea con la versión de la IA esperando su ok (`clase.ia`, o
//     `area.ia`) lleva el chip «Nueva versión», y el botón de la portada lleva a ella. Aprobarla o
//     corregirla es de ./TareaAlumno.tsx.
//
// LA LECCIÓN, desde el 08/10/2026 (items 14 a 17 de Martín y D4/D8 de docs/diseno-curso-skool.md):
//   · UN papel: la DESCRIPCIÓN (rica: lo que el equipo escribe con el editor, con imágenes y archivos)
//     y DEBAJO la TAREA, sin pestañas. En una clase sin tarea, «Marcar como hecha».
//   · Los adjuntos de la descripción los pide el alumno con SU token, por la ruta que mira el candado
//     de la clase; la vista previa del equipo, con las URLs firmadas que trae del server.
//   · El texto al costado del video o debajo, a lo ancho: lo elige el equipo (`disposicion`).
//   · La COMUNIDAD del producto, una entrada más de la barra, sólo para el cliente.

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { VistaAlumno, ProductoVista, ClaseVista } from '@/lib/curso-portal';
import type { EstadoTarea, Valores } from '@/lib/curso';
import { estadoDeAreas } from '@/lib/curso';
import { Pagina, EmptyState } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { HtmlSeguro, idDeRef } from '@/app/_ui/HtmlSeguro';
import CursoUgc, { ChipUgc, ItemMenuUgc, TituloMenuUgc } from '@/app/_cursos/CursoUgc';
import { comentariosDeClase, disposicionDe, tapaDe } from '@/lib/curso-estilo';
import { urlAdjuntoDelAlumno } from '@/lib/curso-adjuntos-reglas';
import type { LeccionUgc } from '@/app/_cursos/tipos';
import { navegar, sembrar, usePosicion } from '@/app/conocimientos/posicion';
import { ComunidadAlumno } from '@/app/_comunidad/ComunidadAlumno';
// Los comentarios de cada clase (item 13 del 08/10/2026): el hilo de la comunidad, debajo de la lección.
import { ComentariosClase } from '@/app/_cursos/ComentariosClase';
import { apiDelAlumno } from '@/app/_comunidad/api';
import Reproductor from './Reproductor';
import TareaAlumno from './TareaAlumno';
import { VistaPreviaCtx, useVistaPrevia } from './vista-previa';
import { CSS_PORTAL } from './estilos';
import {
  ENTRADA_COMUNIDAD, TEXTOS_PORTAL, agendaVigente, avanceDelCurso, chipCerrada, chipsDeClase, claseDeArranque, clasesDelPortal,
  descripcionDeClase, etapaActual, marcaDelProducto, metaDeEtapa, modulosDelPortal, ofreceComunidad, partesDelPapel,
} from './modelo-ugc';

const URL_PROGRESO = '/api/compartido/curso/progreso';

export default function PortalAlumno({ token, vista, vistaPrevia = false, urlsAdjuntos }: {
  token: string;
  vista: VistaAlumno;
  /**
   * La vista previa del EQUIPO (app/customer-success/curso/vista): sin alumno detrás, nada se
   * escribe (./vista-previa.ts), y el curso va EMBEBIDO debajo de su barra. Las puertas de un
   * alumno real no lo pasan nunca.
   */
  vistaPrevia?: boolean;
  /**
   * SÓLO LA VISTA PREVIA: id de adjunto → la URL firmada con la que el EQUIPO ve las imágenes y los
   * archivos de las descripciones (la calcula el server, `urlsAdjuntosEquipo`). El alumno no la
   * usa: él pide cada adjunto con SU token, por la ruta que mira el candado de la clase. Sin esto, la
   * vista previa salía sin imágenes y con los archivos sin link, sin ningún error.
   */
  urlsAdjuntos?: Record<string, string>;
}) {
  const router = useRouter();
  const [productoId, setProductoId] = useState<number | null>(vista.productos[0]?.productoId ?? null);
  const producto = vista.productos.find((p) => p.productoId === productoId) ?? vista.productos[0] ?? null;

  // ⚠️ ATERRIZAR ADENTRO (un link a una clase, un F5 en una lección) NO DEJA EL ÍNDICE DEBAJO, y la
  // posición no se lee de la URL hasta que alguien la siembra: sin esto, el link abría el índice
  // y el Atrás se iba del portal. El nivel de arriba de esta pantalla es el índice del curso (`{}`):
  // es un dato de la ruta, no del camino (app/conocimientos/posicion.ts, `sembrar`).
  useEffect(() => { sembrar({}); }, []);

  return (
    <VistaPreviaCtx.Provider value={vistaPrevia}>
      <style dangerouslySetInnerHTML={{ __html: CSS_PORTAL }} />
      {producto ? (
        <Producto
          key={producto.productoId}
          token={token}
          vista={vista}
          producto={producto}
          vistaPrevia={vistaPrevia}
          urlsAdjuntos={urlsAdjuntos}
          onProducto={(id) => {
            // La posición es de OTRO curso: las etapas de dos productos pueden llamarse igual.
            navegar({}, 'reemplazar');
            setProductoId(id);
          }}
          onAvance={() => router.refresh()}
        />
      ) : (
        <Pagina><EmptyState titulo="Todavía no hay clases." /></Pagina>
      )}
    </VistaPreviaCtx.Provider>
  );
}

/** La clave de una tarea en lo que cambió en la pantalla: la clase, y su área si es por área. */
const claveTarea = (claseId: number, area?: string) => (area ? `${claseId}:${area}` : String(claseId));

function Producto({ token, vista, producto, vistaPrevia, urlsAdjuntos, onProducto, onAvance }: {
  token: string;
  vista: VistaAlumno;
  producto: ProductoVista;
  vistaPrevia: boolean;
  urlsAdjuntos?: Record<string, string>;
  onProducto: (id: number) => void;
  onAvance: () => void;
}) {
  const lider = vista.area != null;
  // La comunidad del producto (D8): una entrada más de la barra, sólo para el cliente.
  const conComunidad = ofreceComunidad({ vistaPrevia, area: vista.area });
  const { pos } = usePosicion();

  // ── Lo que cambió EN ESTA PANTALLA sobre lo que trajo el server ──
  // Lo que vio, lo que mandó, lo que escribió y las propuestas de la IA que resolvió. La lección se
  // desmonta al pasar de clase (vive en CursoUgc), así que esto vive acá: sin esto, volver a una
  // clase la dibujaba como estaba al cargar la página. Cuando llega una vista nueva del server
  // (`router.refresh`, tras completar una etapa), ella ya lo trae y esto se vacía.
  const [base, setBase] = useState(producto);
  const [pcts, setPcts] = useState<Record<number, number>>({});
  const [estados, setEstados] = useState<Record<string, EstadoTarea>>({});
  const [valores, setValores] = useState<Record<string, Valores>>({});
  const [resueltas, setResueltas] = useState<ReadonlySet<string>>(new Set());
  /** Lo que marcó HECHA (o desmarcó) en esta pantalla: el tilde de una clase sin tarea (mig 0220). */
  const [hechas, setHechas] = useState<Record<number, boolean>>({});
  if (base !== producto) {
    setBase(producto); setPcts({}); setEstados({}); setValores({}); setResueltas(new Set()); setHechas({});
  }

  const modulos = useMemo(() => modulosDelPortal(producto), [producto]);
  const clases = useMemo(() => clasesDelPortal(producto), [producto]);
  const porId = useMemo(() => new Map(clases.map((c) => [c.ugc.id, c])), [clases]);
  // LOS COMENTARIOS DE CADA CLASE (item 13 del audio del 08/10/2026, mig 0227), en las clases donde el
  // equipo los prendió (en el «…» de cada una, desde el 14/10/2026). NO al líder de un área: su link no
  // abre la comunidad (`actorDelAlumno`), y los comentarios son de ella. La vista previa del equipo
  // dibuja el recuadro sin pedir nada.
  const conComentarios = (claseId: number) => !lider && comentariosDeClase(producto.estilo, claseId);
  const algunaConComentarios = !lider && clases.some((c) => comentariosDeClase(producto.estilo, c.ugc.id));
  const apiComentarios = useMemo(
    () => (algunaConComentarios && !vistaPrevia ? apiDelAlumno(token, producto.productoId) : null),
    [algunaConComentarios, vistaPrevia, token, producto.productoId],
  );
  const { etapa: actual, i: iActual } = etapaActual(producto);
  const agenda = lider ? null : agendaVigente(producto);

  const pctDe = (c: ClaseVista) => (c.pct == null ? null : Math.max(c.pct, pcts[c.id] ?? 0));
  const estadoDe = (c: ClaseVista): EstadoTarea => (c.areas
    // El chip de una clase por área dice el estado de TODAS sus áreas: la misma regla que la cierra.
    ? estadoDeAreas(c.areas.map((a) => estados[claveTarea(c.id, a.area)] ?? a.estado))
    : estados[claveTarea(c.id)] ?? c.estado);
  const hayPropuesta = (c: ClaseVista) => (c.areas
    ? c.areas.some((a) => a.ia && !resueltas.has(claveTarea(c.id, a.area)))
    : !!c.ia && !resueltas.has(claveTarea(c.id)));
  const hechaDe = (c: ClaseVista) => hechas[c.id] ?? c.hecha;
  /**
   * La URL con la que se DIBUJA un adjunto de la descripción de una clase: el alumno lo pide con SU
   * token por la ruta que mira el candado de esa clase (`urlAdjuntoDelAlumno`); la vista previa del
   * equipo, con la URL firmada que calculó el server (no hay token).
   */
  const urlDeAdjunto = (claseId: number) => (ref: string): string | null => (vistaPrevia
    ? urlsAdjuntos?.[idDeRef(ref) ?? ''] ?? null
    : urlAdjuntoDelAlumno(token, claseId, ref));

  // Los módulos llevan, en la cabecera de su etapa, el link de agenda de una etapa terminada.
  const modulosConAcciones = modulos.map((m) => {
    const e = producto.modulos.find((x) => x.key === m.key);
    return e?.agendaUrl && !lider ? { ...m, acciones: <BotonAgenda href={e.agendaUrl} /> } : m;
  });

  // Los chips de cada tarjeta, con lo que la pantalla ya sabe.
  const clasesUgc = clases.map(({ ugc, vista: c }) => ({
    ...ugc,
    // Una clase CERRADA lleva su candado con el motivo (es lo único que viajó de ella).
    chips: ('cerrada' in c ? [chipCerrada(c.motivo)] : chipsDeClase(c, { pct: pctDe(c), estado: estadoDe(c), propuesta: hayPropuesta(c), hecha: hechaDe(c) }))
      .map((ch) => <ChipUgc key={ch.texto} tono={ch.tono}>{ch.texto}</ChipUgc>),
  }));

  const arranque = claseDeArranque(clases, actual?.key ?? null, {
    propuesta: (c) => c.tieneTarea && hayPropuesta(c), estado: estadoDe,
  });
  const empezado = producto.modulos.some((e) => e.etapa === 'hecha' || e.tareasEnviadas > 0);

  const leccion = (id: number): LeccionUgc => {
    const cp = porId.get(id);
    if (!cp) return {};
    // Cerrada: no viajó ni el video, ni la descripción, ni la tarea. Se dice por qué, nada más.
    if ('cerrada' in cp.vista) return { papel: <div className="ugc-paper"><p className="ugc-doc-p">{cp.vista.motivo}</p></div> };
    const c = cp.vista;
    const reproductor = c.video && (
      <Reproductor token={token} claseId={c.id} video={c.video} titulo={c.titulo}
        onPct={(p) => setPcts((m) => ({ ...m, [c.id]: Math.max(m[c.id] ?? 0, p) }))} />
    );
    const tarea = c.tieneTarea ? <Tarea token={token} c={c} urlDeAdjunto={urlDeAdjunto(c.id)} estados={estados} valores={valores} resueltas={resueltas}
      onEstado={(k, e) => setEstados((m) => ({ ...m, [k]: e }))}
      onValores={(k, v) => setValores((m) => ({ ...m, [k]: v }))}
      onResuelta={(k) => setResueltas((s) => new Set(s).add(k))}
      onAvance={onAvance} /> : null;
    // ⚠️ UN SOLO PAPEL, SIN PESTAÑAS, y PRIMERO la descripción (item 14 de Martín, 07/10/2026: «por
    //    defecto ambas juntas siempre, y primero siempre la descripción»). Antes iban en dos pestañas
    //    con la tarea primero. Lo que va y en qué orden lo decide `partesDelPapel` (con test).
    const partes = partesDelPapel(c, lider);
    const papel = partes.length ? (
      <div className="ugc-paper">
        {partes.map((p) => (p === 'descripcion'
          ? <Descripcion key={p} c={c} urlDeAdjunto={urlDeAdjunto(c.id)} />
          : p === 'tarea'
            ? <Fragment key={p}>{tarea}</Fragment>
            : <MarcarHecha key={p} token={token} claseId={c.id} hecha={hechaDe(c)}
                onCambio={(v, guardado) => {
                  setHechas((m) => ({ ...m, [c.id]: v }));
                  // Completar una clase puede ABRIR lo que espera a «la anterior» (D2): lo decide el
                  // server, así que se le vuelve a pedir la vista.
                  if (guardado) onAvance();
                }} />))}
      </div>
    ) : undefined;
    return {
      // Un link de afuera (`afuera`) no se reproduce acá: es un botón, y adentro del marco negro
      // del video se leería como un reproductor roto. Va debajo del título.
      video: reproductor && c.video?.tipo !== 'afuera' ? { cuerpo: reproductor } : undefined,
      debajoDelVideo: c.video?.tipo === 'afuera' ? reproductor : undefined,
      papel,
      // Debajo de la lección, a lo ancho. Una clase CERRADA no llega acá (sale arriba, sin nada).
      despues: conComentarios(c.id)
        ? <ComentariosClase key={c.id} api={apiComentarios} claseId={c.id} vistaPrevia={vistaPrevia} />
        : undefined,
    };
  };

  const arriba: ReactNode = agenda ? (
    <>
      <span style={{ flex: 1 }} />
      <BotonAgenda href={agenda.agendaUrl!} etapa={agenda.label} />
    </>
  ) : undefined;

  // Cómo se ve el curso: lo que eligió el equipo (mig 0214), o lo de siempre.
  const estilo = producto.estilo;
  const tituloDe = (p: ProductoVista) => p.estilo?.titulo ?? p.nombre;
  // Con más de un producto, el nombre del curso de la barra es el desplegable para cambiar de uno
  // a otro (antes eran botones arriba del curso): el mismo lugar que en la tab del equipo.
  const menu = vista.productos.length > 1 ? (cerrar: () => void) => (
    <>
      <TituloMenuUgc>Tus programas</TituloMenuUgc>
      {vista.productos.map((p) => (
        <ItemMenuUgc key={p.productoId} activo={p.productoId === producto.productoId}
          onClick={() => { cerrar(); if (p.productoId !== producto.productoId) onProducto(p.productoId); }}>
          {tituloDe(p)}
        </ItemMenuUgc>
      ))}
    </>
  ) : undefined;

  // ⚠️ LA COMUNIDAD SE DIBUJA AFUERA DEL CURSO, en su propia pantalla, y no adentro del área de
  //    contenido: la hoja del curso deja sin fondo ni borde a todo `button` de `.ahdoc`, y la comunidad
  //    entera son botones (pestañas, posts, likes) con su propia piel. Se llega por una entrada de la
  //    barra (`#x=comunidad`), así el Atrás vuelve al curso como de cualquier otra posición.
  if (conComunidad && pos.extra === ENTRADA_COMUNIDAD) {
    return <PantallaComunidad token={token} productoId={producto.productoId} marca={marcaDelProducto(tituloDe(producto))} />;
  }

  return (
    <CursoUgc
      modo={vistaPrevia ? 'embebido' : 'pagina'}
      // Dónde va el texto de la lección: lo que eligió el equipo (item 16), igual que en la tab.
      disposicion={disposicionDe(estilo)}
      entradasExtra={conComunidad ? [{ key: ENTRADA_COMUNIDAD, nombre: 'Comunidad', cuerpo: null }] : undefined}
      titulo={vista.nombre ? `Hola, ${vista.nombre}` : tituloDe(producto)}
      subtitulo={lider ? `Área: ${vista.area}` : `Módulo ${iActual + 1} de ${producto.modulos.length}`}
      marca={{ ...marcaDelProducto(tituloDe(producto)), menu }}
      acento={estilo?.acento}
      // La fuente que eligió el equipo (item 3 del 08/10/2026): la misma que ve en la tab.
      fuente={estilo?.fuente}
      modulos={modulosConAcciones}
      clases={clasesUgc}
      portada={{
        eyebrow: lider ? `Área: ${vista.area}` : actual ? `Módulo ${iActual + 1} · ${actual.label}` : undefined,
        titulo: tituloDe(producto),
        // La descripción que escribió el equipo le gana al avance; el avance sigue en la cejilla.
        resumen: estilo?.resumen ?? (!lider && actual ? metaDeEtapa(actual) : undefined),
        ...tapaDe(estilo?.portada),
        claseId: arranque,
        progreso: lider ? undefined : avanceDelCurso(producto),
      }}
      leccion={(clase) => leccion(clase.id)}
      arriba={arriba}
      // UN SOLO SCROLL en la lección (punto 4 del audio del 08/10 a la noche: «hay dos scroll»; con el cursor
      // sobre el papel no se deslizaba). Ver `unSoloScroll` en app/_cursos/tipos.ts.
      unSoloScroll
      // ⚠️ NO «Este enlace es personal» (punto 8 del audio del 08/10 a la noche): el alumno entra también por
      //    /mi-curso, sin ningún enlace, y la frase se leía como un aviso técnico. Va el aviso de un curso pago,
      //    como los de Mastery House o Blue Hackers, con la marca del CURSO (la del producto, nunca MaKo).
      pieBarra={vistaPrevia ? 'Vista previa. No se guarda nada.' : `Este curso es personal. © ${tituloDe(producto)}`}
      textos={{ ...TEXTOS_PORTAL, empezar: empezado ? 'Seguir' : 'Empezar' }}
    />
  );
}

/**
 * La descripción de la clase: la RICA (el editor del equipo, con imágenes y archivos) por
 * `HtmlSeguro`, que la recibe ya saneada del server y traduce cada adjunto a la URL de quien mira; o
 * el texto plano en párrafos, en una clase de antes del editor rico.
 */
function Descripcion({ c, urlDeAdjunto }: { c: ClaseVista; urlDeAdjunto: (ref: string) => string | null }) {
  const d = descripcionDeClase(c);
  if (!d) return null;
  if (d.tipo === 'html') return <HtmlSeguro html={d.html} urlDeAdjunto={urlDeAdjunto} />;
  return <>{d.parrafos.map((p, i) => <p key={i} className="ugc-doc-p">{p}</p>)}</>;
}

/**
 * «Marcar como hecha»: el tilde de Skool en una clase SIN tarea (mig 0220). Es lo que la completa
 * (junto con ver el video), y completarla puede abrir lo que espera a «la anterior».
 *
 * ⚠️ LO GUARDADO MANDA: se dibuja lo que contesta el server (`progreso.hecha`), no lo que se pidió.
 *    En la vista previa del equipo no hay alumno: cambia en la pantalla y no sale nada.
 */
function MarcarHecha({ token, claseId, hecha, onCambio }: {
  token: string;
  claseId: number;
  hecha: boolean;
  /** `guardado`: lo confirmó el server (en la vista previa, `false`). */
  onCambio: (hecha: boolean, guardado: boolean) => void;
}) {
  const previa = useVistaPrevia();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(false);
  const cambiar = async () => {
    const quiero = !hecha;
    setError(false);
    if (previa) { onCambio(quiero, false); return; }
    setEnviando(true);
    try {
      const r = await fetch(URL_PROGRESO, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: token, c: claseId, hecha: quiero }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; progreso?: { hecha?: boolean } } | null;
      if (!r.ok || !j?.ok) { setError(true); return; }
      onCambio(j.progreso?.hecha === true, true);
    } catch {
      setError(true);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="cp-hecha">
      <button type="button" className={`ugc-btn${hecha ? ' primary' : ''}`} aria-pressed={hecha} disabled={enviando}
        onClick={() => void cambiar()}>
        {hecha ? '✓ Hecha' : 'Marcar como hecha'}
      </button>
      {error && <span className="cp-aviso cp-aviso--error" role="status">No se guardó.</span>}
    </div>
  );
}

/**
 * La comunidad del producto, en su propia pantalla (ver por qué afuera del curso, arriba). Arriba,
 * la marca y las dos pestañas del programa: «Curso» vuelve al índice del curso.
 */
function PantallaComunidad({ token, productoId, marca }: {
  token: string; productoId: number; marca: { texto: string; resaltado?: string };
}) {
  return (
    <div className="cp-com">
      <div className="cp-com-barra">
        <span className="cp-com-marca">{marca.texto}{marca.resaltado != null && <span>{marca.resaltado}</span>}</span>
        <nav className="cp-com-tabs" aria-label="Tu programa">
          <button type="button" className="cp-com-tab" onClick={() => navegar({})}>Curso</button>
          <span className="cp-com-tab" aria-current="page">Comunidad</span>
        </nav>
      </div>
      <div className="cp-com-cuerpo">
        <ComunidadAlumno token={token} productoId={productoId} />
      </div>
    </div>
  );
}

/** «Agenda tu sesión»: abre en otra pestaña para no sacarlo del portal. */
function BotonAgenda({ href, etapa }: { href: string; etapa?: string }) {
  return (
    <a className="ugc-btn primary" href={href} target="_blank" rel="noopener noreferrer"
      title={etapa ? `Terminaste ${etapa}` : undefined}>
      Agenda tu sesión
    </a>
  );
}

/**
 * La tarea de la lección: una por área en una clase POR ÁREA (con el área ARRIBA: es lo único que
 * distingue una de la otra), o la del cliente. Lo que trae de la pantalla le gana a lo de la página.
 */
function Tarea({ token, c, urlDeAdjunto, estados, valores, resueltas, onEstado, onValores, onResuelta, onAvance }: {
  token: string;
  c: ClaseVista;
  /** Los adjuntos de la consigna de la tarea (una imagen pegada en ella), como los de la descripción. */
  urlDeAdjunto: (ref: string) => string | null;
  estados: Record<string, EstadoTarea>;
  valores: Record<string, Valores>;
  resueltas: ReadonlySet<string>;
  onEstado: (clave: string, e: EstadoTarea) => void;
  onValores: (clave: string, v: Valores) => void;
  onResuelta: (clave: string) => void;
  onAvance: () => void;
}) {
  if (c.areas) {
    return (
      <>
        {c.areas.map((a) => {
          const k = claveTarea(c.id, a.area);
          return (
            <div key={a.area} className="cp-area">
              <p className="cp-area-nom">{a.area}</p>
              <TareaAlumno
                token={token}
                claseId={c.id}
                area={a.area}
                tarea={c.tarea}
                tareaHtml={c.tareaHtml}
                urlDeAdjunto={urlDeAdjunto}
                campos={c.campos}
                valoresIniciales={valores[k] ?? a.valores}
                estadoInicial={estados[k] ?? a.estado}
                propuesta={resueltas.has(k) ? undefined : a.ia}
                calificacion={a.calificacion}
                onEstado={(e) => onEstado(k, e)}
                onValores={(v) => onValores(k, v)}
                onPropuesta={() => onResuelta(k)}
                onAvance={onAvance}
              />
            </div>
          );
        })}
      </>
    );
  }
  const k = claveTarea(c.id);
  return (
    <TareaAlumno
      token={token}
      claseId={c.id}
      tarea={c.tarea}
      tareaHtml={c.tareaHtml}
      urlDeAdjunto={urlDeAdjunto}
      campos={c.campos}
      valoresIniciales={valores[k] ?? c.valores}
      estadoInicial={estados[k] ?? c.estado}
      propuesta={resueltas.has(k) ? undefined : c.ia}
      calificacion={c.calificacion}
      onEstado={(e) => onEstado(k, e)}
      onValores={(v) => onValores(k, v)}
      onPropuesta={() => onResuelta(k)}
      onAvance={onAvance}
    />
  );
}
