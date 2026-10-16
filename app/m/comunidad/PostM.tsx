'use client';

// =============================================================================
// /m/comunidad — el post abierto: el cuerpo entero, el pulgar, los comentarios (dos niveles) y el campo
// para comentar pegado abajo
// =============================================================================
// Lo de app/_comunidad/PostAbierto.tsx, en una hoja alta: la cara y «hace cuánto · categoría», el texto
// (links y @menciones), el video, la foto o el archivo, la encuesta (se vota con un toque, como escritorio),
// el pulgar y la cuenta de comentarios; después los comentarios con su pulgar y «Responder», y abajo el campo
// «Escribe un comentario» (la app de Skool lo deja pegado al pie, como un chat). «Responder» deja el @nombre
// puesto (la mención viaja si el texto todavía lo nombra: `entradaComentario`) y el server cuelga la respuesta
// del hilo de su raíz. Editar y borrar un comentario, seguir el post y la moderación: en la computadora.
//
// ⚠️ SE MONTA DE NUEVO CADA VEZ QUE SE ABRE (la llave `vez` de ./ComunidadM.tsx): el sub-estado (el post, el
//    texto a medio escribir, a quién se responde) arranca limpio al ABRIR, nunca al cerrar (la hoja sigue en
//    pantalla los 220 ms de la salida).
// ⚠️ LO QUE CAMBIA ACÁ SE LE CUENTA A LA TARJETA (`cambiarTarjeta`): al cerrar, el feed dice lo mismo sin
//    volver a pedirlo. Un post que no está en el feed (el hilo de una clase abierto con `?post=`) no cambia nada.
// ⚠️ COMENTAR NO ES IDEMPOTENTE: nunca dos envíos a la vez (`enviandoRef`), y la hoja no se cierra mientras va
//    (`ocupado`).

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { Ico } from '@/app/_comunidad/iconos';
import type { ComentarioVista, PostDetalle, PostVista } from '@/lib/comunidad-tipos';
import { TOPE_COMENTARIO, haceCuanto } from '@/lib/comunidad-reglas';
import { ErrorM, SheetM, SkeletonFilas, useConexion, useToastM } from '@/app/m/_ui';
import {
  R, T, conCambioEnHilo, conComentario, entradaComentario, metaDePost, respondiendoA, textoDeRespuesta,
  type Respondiendo,
} from './modelo';
import { AvatarNivelM, LikeM, TextoM, useComunidadM } from './piezas';

/** El alto máximo del campo antes de hacer scroll adentro (unas cinco líneas). */
const ALTO_CAMPO = 132;

export function HojaPostM({ abierta, postId, base, onCerrar }: {
  abierta: boolean;
  postId: number | null;
  /** La tarjeta del feed o de la búsqueda: se dibuja ya, mientras llega el post entero. */
  base: PostVista | null;
  onCerrar: () => void;
}) {
  const { api, comunidad, ahora, cambiarTarjeta } = useComunidadM();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [post, setPost] = useState<PostDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [respondiendo, setRespondiendo] = useState<Respondiendo | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const votandoRef = useRef(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (postId == null) return;
    let vivo = true;
    void api.post(postId).then((r) => {
      if (!vivo) return;
      if (r.ok) setPost(r.post); else setError(r.error);
    });
    return () => { vivo = false; };
  }, [api, postId]);

  // El campo crece con el texto hasta ~5 líneas (iOS < 18 no tiene `field-sizing`).
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, ALTO_CAMPO)}px`;
  }, [texto]);

  /** Cambia el post acá y en su tarjeta (sólo campos que la tarjeta también tiene). */
  const cambiar = (c: Partial<PostVista>) => {
    setPost((p) => (p ? { ...p, ...c } : p));
    if (postId != null) cambiarTarjeta(postId, c);
  };

  const responder = (c: ComentarioVista) => {
    const r = respondiendoA(c, comunidad.yo.clave);
    setRespondiendo(r);
    // Lo ya escrito no se pisa: el @nombre va sólo en un campo vacío (o con el de otra respuesta).
    setTexto((t) => (!t.trim() || t === textoDeRespuesta(respondiendo) ? textoDeRespuesta(r) : t));
    campo.current?.focus();
  };
  const noResponder = () => {
    setTexto((t) => (t === textoDeRespuesta(respondiendo) ? '' : t));
    setRespondiendo(null);
  };

  const enviar = async () => {
    if (!post || enviandoRef.current || !texto.trim()) return;
    if (!enLinea) { toast(T.sinConexion); return; }
    enviandoRef.current = true;
    setEnviando(true);
    const r = await api.comentar(post.id, entradaComentario(texto, respondiendo));
    enviandoRef.current = false;
    setEnviando(false);
    if (!r.ok) { toast(r.error); return; }
    const comentarios = post.comentarios + 1;
    setPost((p) => (p ? { ...p, hilo: conComentario(p.hilo, r.comentario), comentarios: p.comentarios + 1 } : p));
    cambiarTarjeta(post.id, { comentarios });
    setTexto('');
    setRespondiendo(null);
  };

  const votar = async (opcion: string) => {
    const e = post?.encuesta;
    if (!post || !e || votandoRef.current || opcion === e.miVoto) return;
    if (!enLinea) { toast(T.sinConexion); return; }
    votandoRef.current = true;
    const r = await api.votar(post.id, opcion);
    votandoRef.current = false;
    if (r.ok) cambiar({ encuesta: r.encuesta }); else toast(r.error);
  };

  const cab = post ?? base;
  const titulo = cab?.titulo || R.post;

  const pie = post && !post.cerrado ? (
    <div className="m-comunidad-composer">
      {respondiendo && (
        <div className="m-comunidad-composer__resp">
          <span className="m-comunidad-composer__resp-txt">{T.respondiendoA} <b>{respondiendo.nombre}</b></span>
          <button type="button" className="m-comunidad-composer__x" aria-label={R.noResponder} onClick={noResponder}>
            <Icon name="x" size={18} />
          </button>
        </div>
      )}
      <div className="m-comunidad-composer__fila">
        <textarea ref={campo} className="m-comunidad-composer__campo" rows={1} value={texto} maxLength={TOPE_COMENTARIO}
          placeholder={respondiendo ? R.tuRespuesta : R.escribeComentario} aria-label={respondiendo ? R.tuRespuesta : R.escribeComentario}
          onChange={(e) => setTexto(e.target.value)} />
        <Button variant="primary" size="md" loading={enviando} disabled={!texto.trim()} onClick={() => { void enviar(); }}>
          {respondiendo ? R.responder : R.comentar}
        </Button>
      </div>
    </div>
  ) : undefined;

  return (
    <SheetM id="post" abierto={abierta} onCerrar={onCerrar} titulo={titulo} snap="alto" ocupado={enviando}
      rotuloCerrar="Cerrar el post" pie={pie}>
      {cab && (
        <div className="m-comunidad-detalle__cab">
          <AvatarNivelM m={cab.autor} tam={40} />
          <span className="m-comunidad-post__quien">
            <span className="m-comunidad-post__autor">{cab.autor.nombre}</span>
            <span className="m-comunidad-post__meta">
              {[metaDePost(cab, comunidad.categorias, ahora), cab.editado ? 'editado' : '', cab.fijado ? 'fijado' : ''].filter(Boolean).join(' · ')}
            </span>
          </span>
        </div>
      )}

      {error ? (
        <ErrorM frase={error} onReintentar={() => {
          if (postId == null) return;
          setError(null);
          void api.post(postId).then((r) => { if (r.ok) setPost(r.post); else setError(r.error); });
        }} />
      ) : !post ? (
        <SkeletonFilas filas={3} />
      ) : (
        <>
          <div className="m-comunidad-detalle">
            {post.cuerpo.length > 0 && <TextoM tokens={post.cuerpo} />}
            {post.video && (
              <div className="m-comunidad-video">
                <iframe src={post.video.embed} title="Video" loading="lazy" allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
              </div>
            )}
            {post.adjunto && (post.adjunto.imagen && post.adjunto.url ? (
              <a href={post.adjunto.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="m-comunidad-img" src={post.adjunto.url} alt={post.adjunto.nombre} loading="lazy" />
              </a>
            ) : post.adjunto.url ? (
              <a className="m-comunidad-adjunto" href={post.adjunto.url} target="_blank" rel="noopener noreferrer">
                <Ico n="archivo" size={20} /><span className="m-comunidad-adjunto__nombre">{post.adjunto.nombre}</span>
              </a>
            ) : (
              <span className="m-comunidad-adjunto"><Ico n="archivo" size={20} /><span className="m-comunidad-adjunto__nombre">{post.adjunto.nombre}</span></span>
            ))}
            {post.encuesta && (
              <div className="m-comunidad-encuesta" role="group" aria-label={R.encuesta}>
                {post.encuesta.opciones.map((o) => (
                  <button key={o.id} type="button" className="m-comunidad-opcion" aria-pressed={post.encuesta?.miVoto === o.id}
                    onClick={() => { void votar(o.id); }}>
                    {post.encuesta?.miVoto && <i className="m-comunidad-opcion__barra" style={{ width: `${o.pct}%` }} aria-hidden />}
                    <span className="m-comunidad-opcion__txt">{o.texto}</span>
                    {post.encuesta?.miVoto && <span className="m-comunidad-opcion__pct">{o.pct}%</span>}
                  </button>
                ))}
                <span className="m-comunidad-meta">{post.encuesta.total} {post.encuesta.total === 1 ? 'voto' : 'votos'}</span>
              </div>
            )}
          </div>

          <div className="m-comunidad-post__pie m-comunidad-detalle__pie">
            <LikeM objetivo={`p:${post.id}`} likes={post.likes} meGusta={post.meGusta} puede={post.puedoLikear}
              onCambio={(likes, meGusta) => cambiar({ likes, meGusta })} />
            <span className="m-comunidad-accion m-comunidad-accion--quieta"><Ico n="comentario" size={20} /><span>{post.comentarios}</span></span>
          </div>

          <div className="m-comunidad-coms">
            {post.hilo.map((c) => (
              <div key={c.id}>
                <ComentarioM c={c} cerrado={post.cerrado} onResponder={() => responder(c)}
                  onLike={(id, likes, meGusta) => setPost((p) => (p ? { ...p, hilo: conCambioEnHilo(p.hilo, id, { likes, meGusta }) } : p))} />
                {c.respuestas.length > 0 && (
                  <div className="m-comunidad-resps">
                    {c.respuestas.map((x) => (
                      <ComentarioM key={x.id} c={x} chico cerrado={post.cerrado} onResponder={() => responder(x)}
                        onLike={(id, likes, meGusta) => setPost((p) => (p ? { ...p, hilo: conCambioEnHilo(p.hilo, id, { likes, meGusta }) } : p))} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {post.cerrado && (
              <p className="m-comunidad-meta m-comunidad-cerrados"><Ico n="candado" size={13} />{R.comentariosCerrados}</p>
            )}
          </div>
        </>
      )}
    </SheetM>
  );
}

/** Un comentario: la cara, la burbuja con el nombre y «hace cuánto», el texto, y abajo el pulgar y «Responder». */
function ComentarioM({ c, chico = false, cerrado, onResponder, onLike }: {
  c: ComentarioVista;
  chico?: boolean;
  cerrado: boolean;
  onResponder: () => void;
  onLike: (id: number, likes: number, meGusta: boolean) => void;
}) {
  const { ahora } = useComunidadM();
  const meta = [ahora == null ? '' : haceCuanto(c.creado, ahora), c.editado ? 'editado' : ''].filter(Boolean).join(' · ');
  return (
    <div className="m-comunidad-com" data-chico={chico || undefined}>
      <AvatarNivelM m={c.autor} tam={chico ? 28 : 34} />
      <div className="m-comunidad-com__cuerpo">
        <div className="m-comunidad-com__burbuja">
          <span className="m-comunidad-com__cab">
            <span className="m-comunidad-com__autor">{c.autor.nombre}</span>
            {meta && <span className="m-comunidad-meta">{meta}</span>}
          </span>
          <TextoM tokens={c.cuerpo} />
        </div>
        <div className="m-comunidad-com__acc">
          <LikeM objetivo={`c:${c.id}`} likes={c.likes} meGusta={c.meGusta} puede={c.puedoLikear}
            onCambio={(likes, meGusta) => onLike(c.id, likes, meGusta)} />
          {!cerrado && <button type="button" className="m-comunidad-accion" onClick={onResponder}>{R.responder}</button>}
        </div>
      </div>
    </div>
  );
}
