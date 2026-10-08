'use client';

// =============================================================================
// Un curso de Conocimientos, con el dibujo de los cursos (app/_cursos/CursoUgc.tsx)
// =============================================================================
// Lo montan las TRES puertas de un curso de Conocimientos, cada una con lo suyo:
//   · /conocimientos, el super admin  → ./EditorConocimientos.tsx le pasa `edicion`, el menú de la
//                                       marca (el color) y el botón de Compartir;
//   · /compartido/<token>, un curso   → app/compartido/[token]/CursoCompartido.tsx, sin nada de eso;
//   · /compartido/<token>, la tab     → app/compartido/[token]/PortalCompartido.tsx, ídem.
//
// Hasta el 08/10/2026 esto era CursoReplica.tsx: SU copia del DOM del origen, la misma de la que salió
// CursoUgc, mantenida aparte. Lo que se le agregaba a una no aparecía en la otra. Ahora el dibujo es
// uno; acá queda lo que es SÓLO de Conocimientos: el papel de la lección (el documento y la
// transcripción, que llegan por fetch), los recursos del curso y el material de cada clase.
//
// ⚠️ NO SABE QUIÉN MIRA. Recibe el curso YA AJUSTADO (lib/conocimiento-ajustes.ts): para un link
//    compartido lo oculto ya no viene; para el super admin viene marcado. Y no arma `edicion`: la trae
//    quien puede editar, así ese código no llega al navegador de un invitado.
// ⚠️ NADA DE CARACTERES DE 3 BYTES EN EL TEXTO (flechas, puntos suspensivos): van como escape. Un
//    reemplazo hecho con PowerShell ya rompió una vez la codificación de este portal y quedaron rombos
//    negros en pantalla, compilando.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import CursoUgc, { CabeceraPestanas, ChipUgc } from '@/app/_cursos/CursoUgc';
import type { ClaseUgc, EdicionUgc, LeccionUgc, ModuloUgc, RecursosUgc } from '@/app/_cursos/tipos';
import type { ClaseAjustada, CursoConAjustes } from '@/lib/conocimiento-ajustes';
import { Miniatura } from './Miniatura';
import { TIPO_BADGE } from './CursoPortal';
import type { Curso, Recurso } from './curso';
import { DRIVE_THUMB, TEXTOS_CONOCIMIENTOS, chipsDeClase, clasesUgc, modulosUgc, portadaUgc } from './modelo-ugc';

const FLECHA_IZQ = '\u2190';
const FLECHA_DER = '\u2192';

export default function CursoConocimientos({ curso, onSalir, marcaMenu, topbarExtra, arriba, pieBarra, edicion, accionesDeModulo, debajoDelVideo }: {
  curso: CursoConAjustes;
  /** El nivel de arriba (todos los cursos). Sin esto —un link de UN curso— no hay salida: arriba no hay nada. */
  onSalir?: () => void;
  /** El menú de la marca (el super admin: los cursos y el color). Con esto la marca es un desplegable. */
  marcaMenu?: (cerrar: () => void) => ReactNode;
  /** La barra de arriba: el botón de Compartir del super admin. */
  topbarExtra?: ReactNode;
  /** Un aviso fijo arriba del contenido. */
  arriba?: ReactNode;
  /** Una línea al pie de la barra («Enlace privado»). */
  pieBarra?: ReactNode;
  /** Los controles de quien EDITA. Sin esto, el curso es de sólo lectura. */
  edicion?: EdicionUgc;
  /** Lo que va a la derecha del nombre de un módulo abierto (el «Mostrar» de uno oculto). */
  accionesDeModulo?: (key: string) => ReactNode;
  /** Lo que va debajo del video de una clase (el aviso de una clase oculta). */
  debajoDelVideo?: (n: number) => ReactNode;
}) {
  const porN = useMemo(() => new Map(curso.clases.map((c) => [c.n, c])), [curso.clases]);
  const modulos = useMemo<ModuloUgc[]>(() => modulosUgc(curso).map((m) => {
    const acciones = accionesDeModulo?.(m.key);
    return acciones != null ? { ...m, acciones } : m;
  }), [curso, accionesDeModulo]);
  const clases = useMemo<ClaseUgc[]>(() => clasesUgc(curso).map((u) => {
    const c = porN.get(u.id);
    const chips = c ? chipsDeClase(c) : [];
    return chips.length ? { ...u, chips: chips.map((ch) => <ChipUgc key={ch.texto} tono={ch.tono}>{ch.texto}</ChipUgc>) } : u;
  }), [curso, porN]);

  const recursos: RecursosUgc | undefined = curso.recursos.length > 0 ? {
    cuantos: curso.recursos.length,
    render: (ctl) => <Recursos recursos={curso.recursos} abiertoSlug={ctl.abierto} abrir={ctl.abrir} cerrar={ctl.cerrar} />,
  } : undefined;

  const leccion = (u: ClaseUgc): LeccionUgc => {
    const c = porN.get(u.id);
    if (!c) return {};
    // El cruce va por SLUG contra los recursos del curso: uno que no resuelve se descarta y no dibuja una
    // tarjeta vacía (pasa cuando la ficha se regenera con menos recursos de los que nombran sus clases).
    const material = (c.recursoSlugs ?? [])
      .map((s) => curso.recursos.find((r) => r.slug === s))
      .filter((r): r is Recurso => Boolean(r));
    const debajo = debajoDelVideo?.(c.n);
    return {
      // Sin video Y sin tapa NO va el marco: un 16:9 negro con la barra debajo se lee como un reproductor
      // roto, y hay clases que son sólo documento («Música y efectos», «Agentes»).
      ...(c.videoId || c.portadaClase ? {
        video: {
          cuerpo: c.videoId
            ? <iframe src={`https://drive.google.com/file/d/${c.videoId}/preview`} allow="autoplay" title={c.titulo}
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
            : <Miniatura src={c.portadaClase!} />,
          barra: <span className="ugc-vbar-dur">{c.cardDesc}</span>,
        },
      } : {}),
      ...(debajo != null ? { debajoDelVideo: debajo } : {}),
      papel: <PapelConocimientos key={c.n} clase={c} />,
      ...(material.length ? { despues: <MaterialDeClase material={material} /> } : {}),
    };
  };

  return (
    <CursoUgc
      modo="pagina"
      titulo={curso.titulo}
      // ⚠️ La marca es un BOTÓN sólo si hay a dónde ir: en un link de UN curso no hay catálogo arriba, y
      //    un botón que no lleva a ningún lado promete una salida que no está.
      marca={{ texto: 'Cono', resaltado: 'cimientos', onClick: onSalir, ariaLabel: marcaMenu ? 'Conocimientos: opciones' : 'Ir a todos los cursos', menu: marcaMenu }}
      acento={curso.acento}
      modulos={modulos}
      clases={clases}
      portada={portadaUgc(curso)}
      leccion={leccion}
      recursos={recursos}
      edicion={edicion}
      arriba={arriba}
      topbarExtra={topbarExtra}
      pieBarra={pieBarra}
      onSalir={onSalir}
      textos={TEXTOS_CONOCIMIENTOS}
    />
  );
}

/**
 * EL PAPEL DE UNA LECCIÓN: el documento de la clase (los prompts, sus partes, las imágenes) y la
 * transcripción, como pestañas, y si no hay ninguno de los dos, los apuntes (`resumen`).
 *
 * Viajan aparte de la ficha, por fetch, a propósito: son ~350 KB entre las lecciones con documento y
 * miles de transcripciones, y metidos en la ficha irían en el bundle de la grilla para leer una clase.
 * Es un componente y no un hueco de `leccion()` porque tiene estado (lo que bajó, la pestaña abierta),
 * y `leccion()` se llama en cada render. Va con `key` = la clase: cambiar de clase vuelve todo a cero.
 */
function PapelConocimientos({ clase }: { clase: ClaseAjustada }) {
  const [doc, setDoc] = useState<{ paneles: Record<string, string> } | null>(null);
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'error'>(clase.hasDoc && clase.docSlug ? 'cargando' : 'idle');
  const [tab, setTab] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [tx, setTx] = useState<string[] | null>(null);

  useEffect(() => {
    let vivo = true;
    if (clase.hasDoc && clase.docSlug) {
      fetch(`/cono-doc/${clase.docSlug}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { paneles?: Record<string, string> }) => {
          if (!vivo) return;
          setDoc({ paneles: d.paneles ?? {} });
          setTab(Object.keys(d.paneles ?? {})[0] ?? null);
          setEstado('idle');
        })
        .catch(() => { if (vivo) setEstado('error'); });
    }
    // La TRANSCRIPCIÓN vive en /cono-tx/<videoId>.json y se suma como una pestaña más: es contenido de
    // la lección. Si no está, no hay pestaña (un `catch` que la deja en nada es lo correcto acá: la
    // clase sigue teniendo su video).
    if (clase.hasTx && clase.videoId) {
      fetch(`/cono-tx/${clase.videoId}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((p: string[]) => { if (vivo) setTx(Array.isArray(p) ? p : null); })
        .catch(() => { if (vivo) setTx(null); });
    }
    return () => { vivo = false; };
  }, [clase.docSlug, clase.hasDoc, clase.videoId, clase.hasTx]);

  // El botón «Copiar» de un prompt del documento: el HTML viene del origen, así que el clic se escucha
  // en el papel y se busca el texto de su tarjeta.
  const alClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest('.ugc-copy');
    if (!btn) return;
    const pre = (btn.closest('.ugc-card') ?? btn.parentElement)?.querySelector('.ugc-pre');
    const texto = (pre?.textContent ?? '').trim();
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    }).catch(() => { /* sin permiso de portapapeles: se selecciona a mano */ });
  };

  const tabs = [...Object.keys(doc?.paneles ?? {}), ...(tx?.length ? ['Transcripcion'] : [])];
  const activa = tab && tabs.includes(tab) ? tab : tabs[0] ?? null;

  return (
    <>
      {tabs.length > 0 && (
        <CabeceraPestanas nombres={tabs} activa={activa} onCambiar={setTab}
          extra={copiado ? <span className="ugc-badge">Copiado</span> : null} />
      )}
      {estado === 'cargando' && <div className="ugc-paper">{'Cargando el material\u2026'}</div>}
      {estado === 'error' && <div className="ugc-paper">No pude cargar el material de esta clase.</div>}
      {activa === 'Transcripcion' ? (
        <div className="ugc-paper">
          {/* Copiar y descargar: sin esto la transcripción es un muro de texto que no se puede llevar a
              ningún lado, y es justamente lo que la gente usa para buscar y citar. */}
          <div className="ugc-lecnav">
            <button type="button" className="ugc-btn" onClick={() => { void navigator.clipboard.writeText((tx ?? []).join('\n\n')).catch(() => {}); }}>
              Copiar transcripción
            </button>
            <button type="button" className="ugc-btn" onClick={() => descargarTxt(clase.titulo, tx ?? [])}>
              Descargar .txt
            </button>
          </div>
          {tx?.map((p, k) => <p className="ugc-doc-p" key={k}>{p}</p>)}
        </div>
      ) : activa && doc?.paneles[activa] ? (
        <div className="ugc-paper" onClick={alClick} dangerouslySetInnerHTML={{ __html: doc.paneles[activa] }} />
      ) : !tabs.length && estado === 'idle' ? (
        // Los APUNTES (`resumen`): el único contenido de las clases que no tienen ni video ni documento
        // —las de los cursos de la casa—. Sin esto la pantalla les decía «no trae documento» teniendo
        // el texto adentro de la ficha (11 clases, 17.894 caracteres, medido el 29/08/2026).
        clase.resumen?.trim()
          ? <div className="ugc-paper">{clase.resumen.split(/\n{2,}/).map((p, k) => <p className="ugc-doc-p" key={k}>{p}</p>)}</div>
          : <div className="ugc-paper">Esta clase no trae documento.</div>
      ) : null}
    </>
  );
}

/**
 * Baja la transcripción como .txt. El nombre del archivo sale del título, sin lo que un sistema de
 * archivos no acepta. ⚠️ Los caracteres de control van como ESCAPE en la clase del regex, nunca como
 * byte crudo: un NUL en el fuente hace que la búsqueda declare binario el archivo (AGENTS.md).
 */
function descargarTxt(titulo: string, parrafos: readonly string[]) {
  const sucio = /[<>:"/\\|?*\x00-\x1f]+/g;
  const nombre = String(titulo).replace(sucio, ' ').trim().slice(0, 90) || 'transcripcion';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([parrafos.join('\n\n')], { type: 'text/plain;charset=utf-8' }));
  a.download = `${nombre}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * EL MATERIAL DE LA CLASE: los recursos que su ficha le cuelga (`recursoSlugs`). Un recurso con archivo
 * o link es un botón que lo abre; uno sin ninguno (un prompt, un banco) vive en «Recursos del curso» y
 * acá se NOMBRA, sin fingir un botón que no lleva a ningún lado.
 */
function MaterialDeClase({ material }: { material: readonly Recurso[] }) {
  return (
    <section className="ugc-material" aria-label="Material de esta clase">
      <h3 className="ugc-paper-title">Material de esta clase</h3>
      <div className="ugc-material-lista">
        {material.map((r) => {
          const href = r.driveId ? `https://drive.google.com/file/d/${r.driveId}/view` : r.notionUrl;
          const etiqueta = `${r.badge ? `${r.badge} · ` : ''}${r.label}`;
          return href ? (
            <a key={r.slug} className="ugc-btn" href={href} target="_blank" rel="noreferrer"
              style={{ display: 'block', marginTop: 8 }}>{etiqueta} {FLECHA_DER}</a>
          ) : (
            <p className="ugc-doc-p" key={r.slug} style={{ marginTop: 8 }}>{etiqueta}</p>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Los recursos del curso: la grilla, y uno abierto con su visor. Qué recurso está abierto viene de la
 * URL (lo trae `ctl.abierto`): si fuera estado local, el Atrás desde un recurso saltearía la lista entera.
 */
function Recursos({ recursos, abiertoSlug, abrir, cerrar }: {
  recursos: Curso['recursos'];
  abiertoSlug?: string;
  abrir: (slug: string) => void;
  cerrar: () => void;
}) {
  const abierto = abiertoSlug ? recursos.find((r) => r.slug === abiertoSlug) ?? null : null;
  if (abierto) {
    return (
      <div className="ugc-paper">
        <button type="button" className="ugc-btn" onClick={cerrar}>{FLECHA_IZQ} Todos los recursos</button>
        <h2 className="ugc-paper-title">{abierto.label}</h2>
        <p className="ugc-doc-p">{abierto.cardDesc}</p>
        {abierto.intro && <p className="ugc-doc-p">{abierto.intro}</p>}
        {abierto.texto && <pre className="ugc-pre">{abierto.texto}</pre>}
        {/* ⚠️ EL ARCHIVO, que es el 90% de los recursos de un curso. Sin el visor, todo recurso que es un
            ARCHIVO mostraba el título, la descripción y debajo NADA: Martín lo reportó tres veces como
            «adentro de los recursos no hay NADA», y las tres se buscó del lado de los datos. */}
        {abierto.driveId && (
          <div className="ugc-vcard">
            <div className="ugc-vframe" style={{ aspectRatio: '3 / 4', width: '100%' }}>
              <iframe src={`https://drive.google.com/file/d/${abierto.driveId}/preview`} title={abierto.label}
                loading="lazy" allowFullScreen style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
            </div>
            <div className="ugc-vbar">
              <a className="ugc-vbar-dur" href={`https://drive.google.com/file/d/${abierto.driveId}/view`} target="_blank" rel="noopener noreferrer">
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
        {recursos.map((r) => (
          <button key={r.slug} type="button" className="ugc-modcard" onClick={() => abrir(r.slug)}>
            {/* La PRIMERA PÁGINA del PDF como tapa: con 62 recursos en una grilla, sin tapa no se
                reconoce ninguno de un vistazo. Los enlaces no tienen archivo y no llevan tapa. */}
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
