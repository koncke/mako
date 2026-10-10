'use client';

// =============================================================================
// Feed — la pestaña Comunidad: escribir algo, los chips de categoría, el orden y los posts
// =============================================================================
// Como Skool: arriba «Escribe algo» (abre el compositor), los chips de categoría y el orden
// (Recientes = por actividad, Nuevos, Top semana, Top mes), los fijados primero (hasta 3) y después
// las tarjetas. Al elegir una categoría, el orden pasa a ser el que esa categoría tiene por defecto.
//
// Lo que se cambia en el post abierto (likes, comentarios, fijar, borrar) se aplica sobre la tarjeta
// en el acto: el feed no se vuelve a pedir por cada clic.

import { useEffect, useRef, useState } from 'react';
import { Button, Select, Spinner } from '@/app/_ui';
import type { FeedVista, PostDetalle, PostVista } from '@/lib/comunidad-tipos';
import { ORDENES_FEED, ROTULO_ORDEN, type OrdenFeed } from '@/lib/comunidad-reglas';
import { Compositor } from './Compositor';
import { EditorCategorias } from './EditorCategorias';
import { PostAbierto } from './PostAbierto';
import { AvatarNivel, BotonLike, Hace, Ico, Menu, NombreMiembro, useComunidad, type ItemMenu } from './piezas';

/** La miniatura de YouTube de un video embebido (los otros no la publican sin pedirla a su API). */
function tapaDeVideo(embed: string): string | null {
  const m = /youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,20})/.exec(embed);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
}

export function Feed({ inicial, postPedido = null, onPostAbierto, version = 0 }: {
  inicial: FeedVista;
  /** Un post que otra pantalla pidió abrir (una mención, una notificación): se abre y se avisa. */
  postPedido?: number | null;
  onPostAbierto?: () => void;
  /** Cambia cuando la moderación borró algo de otro lado (sacar a alguien con su contenido): se recarga. */
  version?: number;
}) {
  const { api, comunidad, aviso, confirmar, sacar } = useComunidad();
  const [cat, setCat] = useState<number | null>(null);
  const [orden, setOrden] = useState<OrdenFeed>('default');
  const [fijados, setFijados] = useState<PostVista[]>(inicial.fijados);
  const [posts, setPosts] = useState<PostVista[]>(inicial.posts);
  const [pagina, setPagina] = useState(inicial.pagina);
  const [hayMas, setHayMas] = useState(inicial.hayMas);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [compositor, setCompositor] = useState<{ editando: PostDetalle | null } | null>(null);
  const [categoriasAbierto, setCategoriasAbierto] = useState(false);
  // El último pedido gana: elegir dos chips rápido no deja el feed del primero.
  const pedido = useRef(0);

  useEffect(() => {
    if (postPedido == null) return;
    setAbierto(postPedido);
    onPostAbierto?.();
    // `onPostAbierto` cambia de identidad en cada render de la raíz; lo que dispara es el pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postPedido]);

  const cargar = async (c: number | null, o: OrdenFeed, p: number) => {
    const n = ++pedido.current;
    setCargando(true);
    setError(null);
    const r = await api.feed({ categoriaId: c, orden: o, pagina: p });
    if (n !== pedido.current) return;
    setCargando(false);
    if (!r.ok) { setError(r.error); return; }
    if (p === 0) { setFijados(r.feed.fijados); setPosts(r.feed.posts); }
    else setPosts((prev) => [...prev, ...r.feed.posts.filter((x) => !prev.some((y) => y.id === x.id))]);
    setPagina(p);
    setHayMas(r.feed.hayMas);
  };

  // La moderación sacó a alguien y borró lo suyo: la página que se ve ya no es cierta.
  const versionVista = useRef(version);
  useEffect(() => {
    if (versionVista.current === version) return;
    versionVista.current = version;
    void cargar(cat, orden, 0);
    // `cargar` y el filtro cambian de identidad en cada render; lo que dispara es la versión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const elegirCategoria = (id: number | null) => {
    const o = id != null ? comunidad.categorias.find((c) => c.id === id)?.ordenDefault ?? 'default' : 'default';
    setCat(id);
    setOrden(o);
    void cargar(id, o, 0);
  };
  const elegirOrden = (o: OrdenFeed) => { setOrden(o); void cargar(cat, o, 0); };

  const actualizar = (id: number, cambio: Partial<PostVista>) => {
    const f = (l: PostVista[]) => l.map((p) => (p.id === id ? { ...p, ...cambio } : p));
    setFijados(f);
    setPosts(f);
    // Fijar o soltar mueve el post de lugar: se vuelve a pedir la primera página.
    if (cambio.fijado !== undefined) void cargar(cat, orden, 0);
  };
  const quitar = (id: number) => {
    setFijados((l) => l.filter((p) => p.id !== id));
    setPosts((l) => l.filter((p) => p.id !== id));
  };

  const editar = async (id: number) => {
    const r = await api.post(id);
    if (!r.ok) { aviso(r.error); return; }
    setAbierto(null);
    setCompositor({ editando: r.post });
  };
  const borrar = async (p: PostVista) => {
    const si = await confirmar('Se van también sus comentarios.', { title: '¿Borrar este post?', confirmLabel: 'Borrar post', cancelLabel: 'No borrar' });
    if (!si) return;
    const r = await api.borrarPost(p.id);
    if (!r.ok) { aviso(r.error); return; }
    quitar(p.id);
    aviso('Post borrado');
  };
  const fijar = async (p: PostVista, si: boolean) => {
    if (!api.fijarPost) return;
    const r = await api.fijarPost(p.id, si);
    if (!r.ok) { aviso(r.error); return; }
    aviso(r.fijado ? 'Fijado' : 'Ya no está fijado');
    void cargar(cat, orden, 0);
  };

  const cerrar = async (p: PostVista, si: boolean) => {
    if (!api.cerrarComentarios) return;
    const r = await api.cerrarComentarios(p.id, si);
    if (!r.ok) { aviso(r.error); return; }
    actualizar(p.id, { cerrado: r.cerrado });
    aviso(r.cerrado ? 'Comentarios cerrados' : 'Comentarios abiertos');
  };

  const menuDe = (p: PostVista): ItemMenu[] => [
    ...(p.puedoEditar ? [{ label: 'Editar', icono: 'editar' as const, onClick: () => void editar(p.id) }] : []),
    ...(comunidad.puedoFijar && api.fijarPost ? [{ label: p.fijado ? 'Soltar' : 'Fijar arriba', icono: 'fijar' as const, onClick: () => void fijar(p, !p.fijado) }] : []),
    // Moderación (el equipo): cerrar los comentarios y sacar al autor (un alumno) de la comunidad.
    ...(comunidad.puedoModerar && api.cerrarComentarios ? [{ label: p.cerrado ? 'Abrir comentarios' : 'Cerrar comentarios', icono: 'candado' as const, onClick: () => void cerrar(p, !p.cerrado) }] : []),
    ...(sacar && !p.autor.equipo && p.autor.clave !== comunidad.yo.clave ? [{ label: `Sacar a ${p.autor.nombre}`, icono: 'persona-menos' as const, onClick: () => sacar(p.autor) }] : []),
    ...(p.puedoBorrar ? [{ label: 'Borrar', icono: 'borrar' as const, onClick: () => void borrar(p), peligro: true }] : []),
  ];
  const nombreCategoria = (id: number | null) => (id == null ? null : comunidad.categorias.find((c) => c.id === id)?.nombre ?? null);

  const publicable = comunidad.puedoPublicar;
  const vacio = !cargando && !error && !fijados.length && !posts.length;

  return (
    <div className="cmu-main">
      <div className="cmu-card cmu-escribir">
        <AvatarNivel m={comunidad.yo} size={40} />
        <button type="button" className="cmu-escribir-btn" disabled={!publicable} onClick={() => setCompositor({ editando: null })}>
          {publicable ? 'Escribe algo'
            : comunidad.yo.nivel < comunidad.nivelParaPostear ? `Publicas desde el nivel ${comunidad.nivelParaPostear}` : 'Aquí publica el equipo'}
        </button>
      </div>

      <div className="cmu-barra">
        <div className="cmu-chips" role="tablist" aria-label="Categorías">
          <button type="button" role="tab" className="cmu-chip" data-on={cat == null} aria-selected={cat == null} onClick={() => elegirCategoria(null)}>Todas</button>
          {comunidad.categorias.map((c) => (
            <button key={c.id} type="button" role="tab" className="cmu-chip" data-on={cat === c.id} aria-selected={cat === c.id}
              onClick={() => elegirCategoria(c.id)}>
              {c.nombre}
              {c.permiso === 'equipo' && <Ico n="candado" size={12} />}
            </button>
          ))}
          {comunidad.puedoConfigurar && api.guardarCategoria && (
            <button type="button" className="cmu-chip" onClick={() => setCategoriasAbierto(true)} title="Categorías">
              <Ico n="lapiz" size={13} /> Categorías
            </button>
          )}
        </div>
        <div className="cmu-orden">
          <Select ariaLabel="Orden" value={orden} onChange={(v) => elegirOrden(v as OrdenFeed)}
            options={ORDENES_FEED.map((o) => ({ value: o, label: ROTULO_ORDEN[o] }))} />
        </div>
      </div>

      {error && <p className="cmu-error" role="alert">{error}</p>}

      {fijados.map((p) => (
        <TarjetaPost key={`f${p.id}`} p={p} categoria={nombreCategoria(p.categoriaId)} menu={menuDe(p)}
          onAbrir={() => setAbierto(p.id)} onCambio={(c) => actualizar(p.id, c)} />
      ))}
      {posts.map((p) => (
        <TarjetaPost key={p.id} p={p} categoria={nombreCategoria(p.categoriaId)} menu={menuDe(p)}
          onAbrir={() => setAbierto(p.id)} onCambio={(c) => actualizar(p.id, c)} />
      ))}

      {vacio && (
        <div className="cmu-card cmu-vacio">
          <b>Todavía no hay posts.</b>
          {publicable ? 'Escribe el primero.' : null}
        </div>
      )}
      {cargando && <div style={{ display: 'grid', placeItems: 'center', padding: 16 }}><Spinner /></div>}
      {hayMas && !cargando && (
        <Button variant="secondary" onClick={() => void cargar(cat, orden, pagina + 1)}>Ver más</Button>
      )}

      {abierto != null && (
        <PostAbierto postId={abierto} onCerrar={() => setAbierto(null)} onCambio={actualizar}
          onBorrado={(id) => { quitar(id); setAbierto(null); }} onEditar={(d) => { setAbierto(null); setCompositor({ editando: d }); }} />
      )}
      {compositor && (
        <Compositor editando={compositor.editando} categoriaInicial={cat}
          onCerrar={() => setCompositor(null)}
          onListo={(p) => {
            const editado = compositor.editando != null;
            setCompositor(null);
            if (editado) { actualizar(p.id, p); aviso('Guardado'); return; }
            // El nuevo arriba, si entra en el filtro que se está mirando.
            if (cat == null || p.categoriaId === cat) setPosts((l) => [p, ...l]);
            aviso('Publicado');
          }} />
      )}
      {categoriasAbierto && <EditorCategorias onCerrar={() => setCategoriasAbierto(false)} />}
    </div>
  );
}

// ── La tarjeta ──────────────────────────────────────────────────────────────────

function TarjetaPost({ p, categoria, menu, onAbrir, onCambio }: {
  p: PostVista;
  categoria: string | null;
  menu: ItemMenu[];
  onAbrir: () => void;
  onCambio: (c: Partial<PostVista>) => void;
}) {
  const tapa = p.adjunto?.imagen && p.adjunto.url ? p.adjunto.url : p.video ? tapaDeVideo(p.video.embed) : null;
  return (
    <article className="cmu-post" data-fijado={p.fijado} role="button" tabIndex={0} aria-label={p.titulo}
      onClick={onAbrir} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onAbrir(); }}>
      <div className="cmu-post-cuerpo">
        <div className="cmu-post-cab">
          <AvatarNivel m={p.autor} size={38} />
          <div className="cmu-post-quien" style={{ flex: 1 }}>
            <NombreMiembro m={p.autor} />
            <span className="cmu-post-meta">
              <Hace iso={p.creado} />{categoria ? ` · ${categoria}` : ''}
            </span>
          </div>
          {p.fijado && <span className="cmu-fijado"><Ico n="pin" size={14} /> Fijado</span>}
          <Menu items={menu} />
        </div>
        <h3 className="cmu-post-tit">{p.titulo}</h3>
        {p.extracto && <p className="cmu-post-ext">{p.extracto}</p>}
        <div className="cmu-post-pie">
          <BotonLike objetivo={`p:${p.id}`} likes={p.likes} meGusta={p.meGusta} puede={p.puedoLikear}
            onCambio={(likes, meGusta) => onCambio({ likes, meGusta })} />
          <span className="cmu-accion" style={{ cursor: 'inherit' }}><Ico n="comentario" /> {p.comentarios}</span>
          {p.cerrado && <span className="cmu-tag" title="Comentarios cerrados"><Ico n="candado" size={12} /> Cerrado</span>}
          {p.encuesta && <span className="cmu-tag"><Ico n="encuesta" size={12} /> Encuesta</span>}
          {p.video && !tapa && <span className="cmu-tag"><Ico n="video" size={12} /> Video</span>}
          {p.adjunto && !p.adjunto.imagen && <span className="cmu-tag"><Ico n="clip" size={12} /> Archivo</span>}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {tapa && <img className="cmu-post-thumb" src={tapa} alt="" loading="lazy" referrerPolicy="no-referrer" />}
    </article>
  );
}
