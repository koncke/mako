'use client';

// =============================================================================
// PostAbierto — el post entero y sus comentarios (dos niveles), en su modal
// =============================================================================
// Skool abre el post encima del feed: el cuerpo completo, el video, la imagen o el archivo, la
// encuesta, los likes, y los comentarios. Los comentarios son de DOS niveles: comentario y respuesta.
// «Responder» a una respuesta deja la nueva en el mismo hilo (la cuelga el server, `padreDeRespuesta`),
// con `@Nombre` de a quién se le contestó, como en Skool.
//
// Lo que cambia acá (un like, un comentario, un borrado) se le cuenta al feed por `onCambio`, así la
// tarjeta de atrás dice lo mismo al cerrar, sin volver a pedir la página.

import { useEffect, useState } from 'react';
import { Button, Modal, Spinner } from '@/app/_ui';
import type { ComentarioVista, PostDetalle, PostVista } from '@/lib/comunidad-tipos';
import { TOPE_COMENTARIO, mencionesDeTokens } from '@/lib/comunidad-reglas';
import { CampoMenciones, mencionesVigentes, type Mencion } from './CampoMenciones';
import { Adjunto, AvatarNivel, BotonLike, Encuesta, Hace, Ico, Menu, NombreMiembro, Texto, Video, useComunidad, type ItemMenu } from './piezas';

/** Cuántos comentarios hay en un hilo de dos niveles. */
const contar = (hilo: readonly ComentarioVista[]) => hilo.reduce((n, c) => n + 1 + c.respuestas.length, 0);

export function PostAbierto({ postId, onCerrar, onCambio, onBorrado, onEditar }: {
  postId: number;
  onCerrar: () => void;
  onCambio: (id: number, cambio: Partial<PostVista>) => void;
  onBorrado: (id: number) => void;
  onEditar: (p: PostDetalle) => void;
}) {
  const { api, comunidad, aviso, confirmar, sacar } = useComunidad();
  const [post, setPost] = useState<PostDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [siguiendo, setSiguiendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    void api.post(postId).then((r) => {
      if (!vivo) return;
      if (r.ok) setPost(r.post); else setError(r.error);
    });
    return () => { vivo = false; };
  }, [api, postId]);

  /** Cambia el post acá y en la tarjeta del feed (sólo campos que la tarjeta también tiene). */
  const cambiar = (c: Partial<PostVista>) => {
    setPost((p) => (p ? { ...p, ...c } : p));
    onCambio(postId, c);
  };
  const cambiarHilo = (f: (h: ComentarioVista[]) => ComentarioVista[]) => {
    setPost((p) => (p ? { ...p, hilo: f(p.hilo) } : p));
  };
  // La cuenta de la tarjeta sale del hilo que se ve: un efecto y no adentro del `setPost`, que React
  // puede llamar dos veces.
  const cuantos = post ? contar(post.hilo) : null;
  useEffect(() => {
    if (cuantos != null) onCambio(postId, { comentarios: cuantos });
    // `onCambio` cambia de identidad en cada render del feed; lo que dispara es la cuenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuantos, postId]);

  const borrar = async () => {
    if (!post) return;
    const si = await confirmar('Se van también sus comentarios.', { title: '¿Borrar este post?', confirmLabel: 'Borrar post', cancelLabel: 'No borrar' });
    if (!si) return;
    const r = await api.borrarPost(post.id);
    if (!r.ok) { aviso(r.error); return; }
    aviso('Post borrado');
    onBorrado(post.id);
  };
  const fijar = async (si: boolean) => {
    if (!post || !api.fijarPost) return;
    const r = await api.fijarPost(post.id, si);
    if (!r.ok) { aviso(r.error); return; }
    cambiar({ fijado: r.fijado });
    aviso(r.fijado ? 'Fijado' : 'Ya no está fijado');
  };

  const cerrar = async (si: boolean) => {
    if (!post || !api.cerrarComentarios) return;
    const r = await api.cerrarComentarios(post.id, si);
    if (!r.ok) { aviso(r.error); return; }
    cambiar({ cerrado: r.cerrado });
    aviso(r.cerrado ? 'Comentarios cerrados' : 'Comentarios abiertos');
  };

  /**
   * Seguir el post: la campana del post. Le avisan los comentarios nuevos (el autor lo sigue desde que
   * lo publica). Optimista: cambia en el acto y vuelve atrás si el server dice que no.
   */
  const seguir = async () => {
    if (!post || siguiendo) return;
    const si = !post.sigo;
    setPost((p) => (p ? { ...p, sigo: si } : p));
    setSiguiendo(true);
    const r = await api.seguirPost(post.id, si);
    setSiguiendo(false);
    if (!r.ok) { setPost((p) => (p ? { ...p, sigo: !si } : p)); aviso(r.error); return; }
    aviso(si ? 'Siguiendo el post' : 'Ya no lo sigues');
  };

  const items: ItemMenu[] = post ? [
    ...(post.puedoEditar ? [{ label: 'Editar', onClick: () => onEditar(post) }] : []),
    ...(comunidad.puedoFijar && api.fijarPost ? [{ label: post.fijado ? 'Soltar' : 'Fijar arriba', onClick: () => void fijar(!post.fijado) }] : []),
    ...(comunidad.puedoModerar && api.cerrarComentarios ? [{ label: post.cerrado ? 'Abrir comentarios' : 'Cerrar comentarios', onClick: () => void cerrar(!post.cerrado) }] : []),
    ...(sacar && !post.autor.equipo && post.autor.clave !== comunidad.yo.clave ? [{ label: `Sacar a ${post.autor.nombre}`, onClick: () => { onCerrar(); sacar(post.autor); } }] : []),
    ...(post.puedoBorrar ? [{ label: 'Borrar', onClick: () => void borrar(), peligro: true }] : []),
  ] : [];
  const categoria = post?.categoriaId != null ? comunidad.categorias.find((c) => c.id === post.categoriaId) : null;

  return (
    <Modal titulo={post?.titulo ?? 'Post'} ancho={760} alto="min(88vh, 820px)" onCerrar={onCerrar} sinFiletes
      encabezado={categoria ? <span className="cmu-tag">{categoria.nombre}</span> : undefined}>
      {!post && !error && <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>}
      {error && <p className="cmu-error" role="alert">{error}</p>}
      {post && (
        <div className="cmu-detalle">
          <div className="cmu-post-cab">
            <AvatarNivel m={post.autor} size={40} />
            <div className="cmu-post-quien" style={{ flex: 1 }}>
              <NombreMiembro m={post.autor} />
              <span className="cmu-post-meta">
                <Hace iso={post.creado} />{post.editado ? ' · editado' : ''}
                {post.fijado ? ' · fijado' : ''}
              </span>
            </div>
            <Menu items={items} />
          </div>
          {post.cuerpo.length > 0 && <Texto tokens={post.cuerpo} />}
          {post.video && <Video video={post.video} />}
          {post.adjunto && <Adjunto adjunto={post.adjunto} />}
          {post.encuesta && <Encuesta postId={post.id} encuesta={post.encuesta} onCambio={(encuesta) => cambiar({ encuesta })} />}
          <div className="cmu-detalle-pie">
            <BotonLike objetivo={`p:${post.id}`} likes={post.likes} meGusta={post.meGusta} puede={post.puedoLikear}
              onCambio={(likes, meGusta) => cambiar({ likes, meGusta })} />
            <span className="cmu-accion" style={{ cursor: 'default' }}><Ico n="comentario" /> {contar(post.hilo)}</span>
            <button type="button" className="cmu-accion" data-on={post.sigo} aria-pressed={post.sigo} disabled={siguiendo}
              title={post.sigo ? 'Te avisamos de los comentarios nuevos' : 'Avisarme de los comentarios nuevos'}
              onClick={() => void seguir()} style={{ marginLeft: 'auto' }}>
              <Ico n={post.sigo ? 'campana' : 'campanaOff'} /> {post.sigo ? 'Siguiendo' : 'Seguir'}
            </button>
          </div>
          <Hilo postId={post.id} hilo={post.hilo} onHilo={cambiarHilo} cerrado={post.cerrado} />
        </div>
      )}
    </Modal>
  );
}

// ── Los comentarios ─────────────────────────────────────────────────────────────

type Respondiendo = { a: number; raiz: number; mencion: Mencion | null };

function Hilo({ postId, hilo, onHilo, cerrado }: {
  postId: number;
  hilo: ComentarioVista[];
  onHilo: (f: (h: ComentarioVista[]) => ComentarioVista[]) => void;
  /** Comentarios cerrados (moderación): se leen, no se responde ni se agrega nada. */
  cerrado: boolean;
}) {
  const { comunidad } = useComunidad();
  const [respondiendo, setRespondiendo] = useState<Respondiendo | null>(null);

  const agregar = (c: ComentarioVista) => onHilo((h) => (c.padreId == null
    ? [...h, c]
    : h.map((r) => (r.id === c.padreId ? { ...r, respuestas: [...r.respuestas, c] } : r))));
  const reemplazar = (id: number, f: (c: ComentarioVista) => ComentarioVista) => onHilo((h) => h.map((r) => (r.id === id
    ? f(r)
    : { ...r, respuestas: r.respuestas.map((x) => (x.id === id ? f(x) : x)) })));
  const quitar = (id: number) => onHilo((h) => h.filter((r) => r.id !== id).map((r) => ({ ...r, respuestas: r.respuestas.filter((x) => x.id !== id) })));

  const responder = (c: ComentarioVista, raiz: number) => setRespondiendo({
    a: c.id, raiz,
    // A quién se le contesta va mencionado (como en Skool), salvo que sea uno mismo.
    mencion: c.autor.clave === comunidad.yo.clave ? null : { clave: c.autor.clave, nombre: c.autor.nombre },
  });

  return (
    <div className="cmu-coms">
      {hilo.map((r) => (
        <div key={r.id}>
          <Comentario c={r} onCambio={(f) => reemplazar(r.id, f)} onBorrado={() => quitar(r.id)} onResponder={cerrado ? null : () => responder(r, r.id)} />
          {(r.respuestas.length > 0 || (!cerrado && respondiendo?.raiz === r.id)) && (
            <div className="cmu-resps" style={{ paddingLeft: 46 }}>
              {r.respuestas.map((x) => (
                <Comentario key={x.id} c={x} chico onCambio={(f) => reemplazar(x.id, f)} onBorrado={() => quitar(x.id)} onResponder={cerrado ? null : () => responder(x, r.id)} />
              ))}
              {!cerrado && respondiendo?.raiz === r.id && (
                <NuevoComentario key={respondiendo.a} postId={postId} responderA={respondiendo.a} mencion={respondiendo.mencion}
                  onListo={(c) => { agregar(c); setRespondiendo(null); }} onCerrar={() => setRespondiendo(null)} />
              )}
            </div>
          )}
        </div>
      ))}
      {cerrado
        ? <p className="cmu-meta" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Ico n="candado" size={13} /> Comentarios cerrados.</p>
        : <NuevoComentario postId={postId} responderA={null} mencion={null} onListo={agregar} />}
    </div>
  );
}

function Comentario({ c, chico = false, onCambio, onBorrado, onResponder }: {
  c: ComentarioVista;
  chico?: boolean;
  onCambio: (f: (c: ComentarioVista) => ComentarioVista) => void;
  onBorrado: () => void;
  /** `null` = no se puede responder (comentarios cerrados). */
  onResponder: (() => void) | null;
}) {
  const { api, aviso, confirmar } = useComunidad();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(c.texto);
  const [menciones, setMenciones] = useState<Mencion[]>([]);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    const r = await api.editarComentario(c.id, { cuerpo: texto, menciones: mencionesVigentes(texto, menciones), responderA: null });
    setGuardando(false);
    if (!r.ok) { aviso(r.error); return; }
    onCambio((x) => ({ ...x, cuerpo: r.cuerpo, texto: r.texto, editado: true }));
    setEditando(false);
  };
  const borrar = async () => {
    const si = await confirmar(c.respuestas.length ? 'Se van también sus respuestas.' : 'No se puede deshacer.', {
      title: '¿Borrar este comentario?', confirmLabel: 'Borrar comentario', cancelLabel: 'No borrar',
    });
    if (!si) return;
    const r = await api.borrarComentario(c.id);
    if (!r.ok) { aviso(r.error); return; }
    onBorrado();
  };
  const items: ItemMenu[] = [
    // El campo arranca con las menciones que el comentario YA tiene (`mencionesDeTokens`): con la lista
    // vacía, guardar mandaba `menciones: []` y el `@Nombre` quedaba como texto suelto, sin link ni aviso.
    ...(c.puedoEditar ? [{ label: 'Editar', onClick: () => { setTexto(c.texto); setMenciones(mencionesDeTokens(c.cuerpo)); setEditando(true); } }] : []),
    ...(c.puedoBorrar ? [{ label: 'Borrar', onClick: () => void borrar(), peligro: true }] : []),
  ];

  return (
    <div className="cmu-com">
      <AvatarNivel m={c.autor} size={chico ? 30 : 36} />
      <div className="cmu-com-cuerpo">
        <div className="cmu-com-burbuja">
          <div className="cmu-com-cab">
            <NombreMiembro m={c.autor} />
            <span className="cmu-meta"><Hace iso={c.creado} />{c.editado ? ' · editado' : ''}</span>
          </div>
          {editando ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              <CampoMenciones valor={texto} onCambio={setTexto} menciones={menciones} onMenciones={setMenciones}
                filas={2} maxLength={TOPE_COMENTARIO} autoFocus onEnviar={() => void guardar()} etiqueta="Editar comentario" />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="tertiary" size="sm" onClick={() => setEditando(false)}>No guardar</Button>
                <Button size="sm" loading={guardando} disabled={!texto.trim()} onClick={() => void guardar()}>Guardar</Button>
              </div>
            </div>
          ) : <Texto tokens={c.cuerpo} />}
        </div>
        <div className="cmu-com-acc">
          <BotonLike objetivo={`c:${c.id}`} likes={c.likes} meGusta={c.meGusta} puede={c.puedoLikear}
            onCambio={(likes, meGusta) => onCambio((x) => ({ ...x, likes, meGusta }))} />
          {onResponder && <button type="button" className="cmu-accion" onClick={onResponder}>Responder</button>}
          <Menu items={items} />
        </div>
      </div>
    </div>
  );
}

function NuevoComentario({ postId, responderA, mencion, onListo, onCerrar }: {
  postId: number;
  responderA: number | null;
  mencion: Mencion | null;
  onListo: (c: ComentarioVista) => void;
  onCerrar?: () => void;
}) {
  const { api, comunidad, aviso } = useComunidad();
  const [texto, setTexto] = useState(mencion ? `@${mencion.nombre} ` : '');
  const [menciones, setMenciones] = useState<Mencion[]>(mencion ? [mencion] : []);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const r = await api.comentar(postId, { cuerpo: texto, menciones: mencionesVigentes(texto, menciones), responderA });
    setEnviando(false);
    if (!r.ok) { aviso(r.error); return; }
    setTexto(''); setMenciones([]);
    onListo(r.comentario);
  };

  return (
    <div className="cmu-nuevo-com">
      <AvatarNivel m={comunidad.yo} size={responderA ? 30 : 36} />
      <div className="cmu-campo">
        <CampoMenciones valor={texto} onCambio={setTexto} menciones={menciones} onMenciones={setMenciones}
          placeholder={responderA ? 'Tu respuesta' : 'Escribe un comentario'} filas={2}
          maxLength={TOPE_COMENTARIO} autoFocus={responderA != null} onEnviar={() => void enviar()} />
        {(texto.trim() || onCerrar) && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {onCerrar && <Button variant="tertiary" size="sm" onClick={onCerrar}>No responder</Button>}
            <Button size="sm" loading={enviando} disabled={!texto.trim()} onClick={() => void enviar()}>
              {responderA ? 'Responder' : 'Comentar'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
