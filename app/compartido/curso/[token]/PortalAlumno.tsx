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
// Qué etapa está hecha/abierta/bloqueada lo decide el server (`armarEtapas`, lib/curso-portal.ts) y
// llega armado: acá no se recalcula. Cuando un envío completa la etapa, la página se pide de nuevo
// (`router.refresh`) y la etapa nueva llega abierta.
//
// Texto de pantalla: español neutro con TÚ (los clientes de Mauricio son mexicanos), y corto.
//
// #665 (06/10/2026), tres cosas que llegan armadas del server y acá sólo se dibujan:
//   · «AGENDA TU SESIÓN» en una etapa que el alumno COMPLETÓ (`etapa.agendaUrl`): arriba del curso
//     la de la última terminada (completarla lo pasa a la siguiente en el acto, así que es la sesión
//     que le toca ahora), y en la cabecera de cada etapa terminada la suya. Antes de completarla el
//     link no llega al navegador (lib/curso-portal.ts, `armarEtapas`).
//   · UNA CLASE POR ÁREA (`clase.areas`) se contesta una vez por área: un bloque por área, cada uno
//     con su `TareaAlumno` y su `a`. El chip de la clase dice el estado de TODAS (`estadoDeAreas`).
//   · EL LÍDER DE UN ÁREA (`vista.area`): ve sólo sus clases, y ni la cuenta de etapas ni el avance
//     del cliente (no es su recorrido). Lo que el server no le mandó no se puede dibujar.
//   · EL PASO 5 (07/10/2026): una tarea con la versión de la IA esperando su ok (`clase.ia`, o
//     `area.ia`) lleva el chip «Nueva versión», y el botón de la portada lleva a ella. Aprobarla o
//     corregirla es de ./TareaAlumno.tsx.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { VistaAlumno, ProductoVista, ClaseVista } from '@/lib/curso-portal';
import type { EstadoTarea, Valores } from '@/lib/curso';
import { estadoDeAreas } from '@/lib/curso';
import { Pagina, EmptyState } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import CursoUgc, { ChipUgc } from '@/app/_cursos/CursoUgc';
import type { LeccionUgc } from '@/app/_cursos/tipos';
import { navegar, sembrar } from '@/app/conocimientos/posicion';
import Reproductor from './Reproductor';
import TareaAlumno from './TareaAlumno';
import { VistaPreviaCtx } from './vista-previa';
import { CSS_PORTAL } from './estilos';
import {
  TEXTOS_PORTAL, agendaVigente, chipsDeClase, claseDeArranque, clasesDelPortal, etapaActual,
  marcaDelProducto, metaDeEtapa, modulosDelPortal,
} from './modelo-ugc';

export default function PortalAlumno({ token, vista, vistaPrevia = false }: {
  token: string;
  vista: VistaAlumno;
  /**
   * La vista previa del EQUIPO (app/customer-success/curso/vista): sin alumno detrás, nada se
   * escribe (./vista-previa.ts), y el curso va EMBEBIDO debajo de su barra. Las puertas de un
   * alumno real no lo pasan nunca.
   */
  vistaPrevia?: boolean;
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

function Producto({ token, vista, producto, vistaPrevia, onProducto, onAvance }: {
  token: string;
  vista: VistaAlumno;
  producto: ProductoVista;
  vistaPrevia: boolean;
  onProducto: (id: number) => void;
  onAvance: () => void;
}) {
  const lider = vista.area != null;

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
  if (base !== producto) {
    setBase(producto); setPcts({}); setEstados({}); setValores({}); setResueltas(new Set());
  }

  const modulos = useMemo(() => modulosDelPortal(producto), [producto]);
  const clases = useMemo(() => clasesDelPortal(producto), [producto]);
  const porId = useMemo(() => new Map(clases.map((c) => [c.ugc.id, c])), [clases]);
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

  // Los módulos llevan, en la cabecera de su etapa, el link de agenda de una etapa terminada.
  const modulosConAcciones = modulos.map((m) => {
    const e = producto.etapas.find((x) => x.key === m.key);
    return e?.agendaUrl && !lider ? { ...m, acciones: <BotonAgenda href={e.agendaUrl} /> } : m;
  });

  // Los chips de cada tarjeta, con lo que la pantalla ya sabe.
  const clasesUgc = clases.map(({ ugc, vista: c }) => ({
    ...ugc,
    chips: chipsDeClase(c, { pct: pctDe(c), estado: estadoDe(c), propuesta: hayPropuesta(c) })
      .map((ch) => <ChipUgc key={ch.texto} tono={ch.tono}>{ch.texto}</ChipUgc>),
  }));

  const arranque = claseDeArranque(clases, actual?.key ?? null, {
    propuesta: (c) => c.tieneTarea && hayPropuesta(c), estado: estadoDe,
  });
  const empezado = producto.etapas.some((e) => e.estado === 'hecha' || e.tareasEnviadas > 0);

  const leccion = (id: number): LeccionUgc => {
    const cp = porId.get(id);
    if (!cp) return {};
    const c = cp.vista;
    const reproductor = c.video && (
      <Reproductor token={token} claseId={c.id} video={c.video} titulo={c.titulo}
        onPct={(p) => setPcts((m) => ({ ...m, [c.id]: Math.max(m[c.id] ?? 0, p) }))} />
    );
    const tarea = c.tieneTarea ? <Tarea token={token} c={c} estados={estados} valores={valores} resueltas={resueltas}
      onEstado={(k, e) => setEstados((m) => ({ ...m, [k]: e }))}
      onValores={(k, v) => setValores((m) => ({ ...m, [k]: v }))}
      onResuelta={(k) => setResueltas((s) => new Set(s).add(k))}
      onAvance={onAvance} /> : null;
    const desc = c.descripcion.trim();
    const papelDesc = desc ? <div className="ugc-paper">{parrafos(desc)}</div> : null;
    const papelTarea = tarea ? <div className="ugc-paper">{tarea}</div> : null;
    return {
      // Un link de afuera (`afuera`) no se reproduce acá: es un botón, y adentro del marco negro
      // del video se leería como un reproductor roto. Va debajo del título.
      video: reproductor && c.video?.tipo !== 'afuera' ? { cuerpo: reproductor } : undefined,
      debajoDelVideo: c.video?.tipo === 'afuera' ? reproductor : undefined,
      ...(papelTarea && papelDesc
        // Con las dos, la TAREA primero: es lo que vino a hacer.
        ? { pestanas: [{ nombre: 'Tarea', cuerpo: papelTarea }, { nombre: 'Descripción', cuerpo: papelDesc }] }
        : { papel: papelTarea ?? papelDesc ?? undefined }),
    };
  };

  const arriba: ReactNode = (vista.productos.length > 1 || agenda) ? (
    <>
      {vista.productos.length > 1 && vista.productos.map((p) => (
        <button key={p.productoId} type="button"
          className={`ugc-btn${p.productoId === producto.productoId ? ' primary' : ''}`}
          aria-pressed={p.productoId === producto.productoId}
          onClick={() => p.productoId !== producto.productoId && onProducto(p.productoId)}>
          {p.nombre}
        </button>
      ))}
      {agenda && (
        <>
          <span style={{ flex: 1 }} />
          <BotonAgenda href={agenda.agendaUrl!} etapa={agenda.label} />
        </>
      )}
    </>
  ) : undefined;

  return (
    <CursoUgc
      modo={vistaPrevia ? 'embebido' : 'pagina'}
      titulo={vista.nombre ? `Hola, ${vista.nombre}` : producto.nombre}
      subtitulo={lider ? `Área: ${vista.area}` : `Etapa ${iActual + 1} de ${producto.etapas.length}`}
      marca={marcaDelProducto(producto.nombre)}
      modulos={modulosConAcciones}
      clases={clasesUgc}
      portada={{
        eyebrow: lider ? `Área: ${vista.area}` : actual ? `Etapa ${iActual + 1} · ${actual.label}` : undefined,
        titulo: producto.nombre,
        resumen: !lider && actual ? metaDeEtapa(actual) : undefined,
        claseId: arranque,
        progreso: lider ? undefined : {
          hechas: producto.etapas.filter((e) => e.estado === 'hecha').length,
          total: producto.etapas.length,
        },
      }}
      leccion={(clase) => leccion(clase.id)}
      arriba={arriba}
      pieBarra={vistaPrevia ? 'Vista previa. No se guarda nada.' : 'Este enlace es personal. No lo compartas.'}
      textos={{ ...TEXTOS_PORTAL, empezar: empezado ? 'Seguir' : 'Empezar' }}
    />
  );
}

/** El texto de una descripción, en párrafos: una línea en blanco los separa. */
function parrafos(texto: string) {
  return texto.split(/\n{2,}/).map((p, i) => <p key={i} className="ugc-doc-p">{p}</p>);
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
function Tarea({ token, c, estados, valores, resueltas, onEstado, onValores, onResuelta, onAvance }: {
  token: string;
  c: ClaseVista;
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
                campos={c.campos}
                valoresIniciales={valores[k] ?? a.valores}
                estadoInicial={estados[k] ?? a.estado}
                propuesta={resueltas.has(k) ? undefined : a.ia}
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
      campos={c.campos}
      valoresIniciales={valores[k] ?? c.valores}
      estadoInicial={estados[k] ?? c.estado}
      propuesta={resueltas.has(k) ? undefined : c.ia}
      onEstado={(e) => onEstado(k, e)}
      onValores={(v) => onValores(k, v)}
      onPropuesta={() => onResuelta(k)}
      onAvance={onAvance}
    />
  );
}
