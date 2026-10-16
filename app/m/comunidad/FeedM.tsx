'use client';

// =============================================================================
// /m/comunidad — la pestaña Comunidad: «Escribe algo», los chips de categoría, los fijados y las tarjetas
// =============================================================================
// El feed de app/_comunidad/Feed.tsx en su orden: la caja «Escribe algo» con la cara de quien mira, los chips
// (Todas + las categorías, con el candado en las del equipo), los fijados primero y después los posts, y
// «Ver más». Al elegir una categoría el orden pasa a ser el que ESA categoría tiene por defecto, como en
// escritorio (`ordenDeCategoria`). El selector de orden y el menú de cada tarjeta (editar, fijar, cerrar,
// sacar, borrar) son de la computadora.
//
// ⚠️ REFRESCAR TRAE LO NUEVO: lo que llega del server (`inicial`, una prop nueva con cada `router.refresh()`)
//    se ADOPTA con «Todas»; con una categoría elegida, se vuelve a pedir ésa. Copiar la prop a un estado al
//    montar dejaba el gesto animando sin traer nada (docs/hallazgos-mobile.md, «Refrescar en TODAS»).
// ⚠️ EL ÚLTIMO PEDIDO GANA (`pedido`): elegir dos chips rápido no deja el feed del primero.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import type { ApiComunidad } from '@/app/_comunidad/api';
import { Ico } from '@/app/_comunidad/iconos';
import type { ComunidadVista, FeedVista, PostVista } from '@/lib/comunidad-tipos';
import type { OrdenFeed } from '@/lib/comunidad-reglas';
import { ErrorM, SkeletonFilas, VacioM } from '@/app/m/_ui';
import { R, conCambio, conPagina, conPublicado, metaDePost, ordenDeCategoria, tapaDePost } from './modelo';
import { AvatarNivelM, LikeM, useComunidadM } from './piezas';

export type FeedEstado = ReturnType<typeof useFeedM>;

/** El estado del feed. Vive en la raíz de la pantalla: el post abierto (otra hoja) le cambia las tarjetas. */
export function useFeedM(inicial: FeedVista, api: ApiComunidad, comunidad: ComunidadVista) {
  const [cat, setCat] = useState<number | null>(null);
  const [orden, setOrden] = useState<OrdenFeed>('default');
  const [fijados, setFijados] = useState<PostVista[]>(inicial.fijados);
  const [posts, setPosts] = useState<PostVista[]>(inicial.posts);
  const [pagina, setPagina] = useState(inicial.pagina);
  const [hayMas, setHayMas] = useState(inicial.hayMas);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pedido = useRef(0);

  const cargar = useCallback(async (c: number | null, o: OrdenFeed, p: number) => {
    const n = ++pedido.current;
    setCargando(true);
    setError(null);
    const r = await api.feed({ categoriaId: c, orden: o, pagina: p });
    if (n !== pedido.current) return;
    setCargando(false);
    if (!r.ok) { setError(r.error); return; }
    if (p === 0) { setFijados(r.feed.fijados); setPosts(r.feed.posts); }
    else setPosts((prev) => conPagina(prev, r.feed.posts));
    setPagina(p);
    setHayMas(r.feed.hayMas);
  }, [api]);

  // Lo que trae el server al refrescar (ver el encabezado).
  const [base, setBase] = useState(inicial);
  const [recargar, setRecargar] = useState(0);
  if (base !== inicial) {
    setBase(inicial);
    if (cat == null) {
      setFijados(inicial.fijados); setPosts(inicial.posts); setPagina(inicial.pagina); setHayMas(inicial.hayMas);
      setError(null);
    } else {
      setRecargar((n) => n + 1);
    }
  }
  const filtro = useRef({ cat, orden });
  filtro.current = { cat, orden };
  useEffect(() => {
    if (recargar) void cargar(filtro.current.cat, filtro.current.orden, 0);
  }, [recargar, cargar]);

  const elegirCategoria = (id: number | null) => {
    if (id === cat && !error) return;
    const o = ordenDeCategoria(comunidad.categorias, id);
    setCat(id);
    setOrden(o);
    // Las tarjetas de la categoría de antes no se quedan mientras llega la nueva: se leerían como de ésta.
    setFijados([]);
    setPosts([]);
    setHayMas(false);
    void cargar(id, o, 0);
  };

  const cambiar = useCallback((id: number, cambio: Partial<PostVista>) => {
    setFijados((l) => conCambio(l, id, cambio));
    setPosts((l) => conCambio(l, id, cambio));
  }, []);

  return {
    cat, fijados, posts, hayMas, cargando, error, elegirCategoria, cambiar,
    verMas: () => { void cargar(cat, orden, pagina + 1); },
    reintentar: () => { void cargar(cat, orden, 0); },
    publicado: (p: PostVista) => setPosts((l) => conPublicado(l, p, cat)),
  };
}

export function FeedM({ feed, onEscribir }: { feed: FeedEstado; onEscribir: () => void }) {
  const { comunidad } = useComunidadM();
  const { cat, fijados, posts, hayMas, cargando, error } = feed;
  const vacio = !cargando && !error && !fijados.length && !posts.length;

  return (
    <div className="m-comunidad-feed">
      {/* Un alumno debajo del nivel mínimo no publica; el teléfono sólo lo abre el equipo, que publica siempre. */}
      {comunidad.puedoPublicar && (
        <button type="button" className="m-comunidad-escribe" onClick={onEscribir}>
          <AvatarNivelM m={comunidad.yo} tam={36} />
          <span className="m-comunidad-escribe__txt">{R.escribeAlgo}</span>
        </button>
      )}

      {comunidad.categorias.length > 0 && (
        <div className="m-comunidad-chips" role="group" aria-label="Categorías">
          <button type="button" className="m-comunidad-chip" aria-pressed={cat == null} onClick={() => feed.elegirCategoria(null)}>{R.todas}</button>
          {comunidad.categorias.map((c) => (
            <button key={c.id} type="button" className="m-comunidad-chip" aria-pressed={cat === c.id} onClick={() => feed.elegirCategoria(c.id)}>
              {c.nombre}
              {c.permiso === 'equipo' && <Ico n="candado" size={13} />}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <ErrorM frase={error} onReintentar={feed.reintentar} />
      ) : cargando && !fijados.length && !posts.length ? (
        <SkeletonFilas filas={3} />
      ) : null}

      {fijados.map((p) => <TarjetaM key={`f${p.id}`} p={p} />)}
      {posts.map((p) => <TarjetaM key={p.id} p={p} />)}

      {vacio && <VacioM frase={R.sinPosts} />}
      {cargando && (fijados.length > 0 || posts.length > 0) && <SkeletonFilas filas={2} />}
      {hayMas && !cargando && !error && (
        <Button variant="secondary" size="lg" full onClick={feed.verMas}>{R.verMas}</Button>
      )}
    </div>
  );
}

/**
 * Una tarjeta del feed (la de la app de Skool): la cara con su nivel, el nombre, «hace cuánto · categoría» y
 * «Fijado»; el título, dos líneas del texto y la foto adjunta. Abajo, el pulgar y el globo con sus números. El
 * cuerpo de la tarjeta es UN botón que abre el post; el pulgar va aparte (un botón no va adentro de otro).
 */
function TarjetaM({ p }: { p: PostVista }) {
  const { comunidad, ahora, abrirPost, cambiarTarjeta } = useComunidadM();
  const tapa = tapaDePost(p);
  const meta = metaDePost(p, comunidad.categorias, ahora);
  return (
    <article className="m-comunidad-post" data-fijado={p.fijado || undefined}>
      <button type="button" className="m-comunidad-post__abre" onClick={() => abrirPost(p)}>
        <span className="m-comunidad-post__cab">
          <AvatarNivelM m={p.autor} tam={36} />
          <span className="m-comunidad-post__quien">
            <span className="m-comunidad-post__autor">{p.autor.nombre}</span>
            {meta && <span className="m-comunidad-post__meta">{meta}</span>}
          </span>
          {p.fijado && <span className="m-comunidad-post__fijado"><Ico n="pin" size={14} />{R.fijado}</span>}
        </span>
        <span className="m-comunidad-post__titulo">{p.titulo}</span>
        {p.extracto && <span className="m-comunidad-post__ext">{p.extracto}</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {tapa && <img className="m-comunidad-post__tapa" src={tapa} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      </button>
      <div className="m-comunidad-post__pie">
        <LikeM objetivo={`p:${p.id}`} likes={p.likes} meGusta={p.meGusta} puede={p.puedoLikear}
          onCambio={(likes, meGusta) => cambiarTarjeta(p.id, { likes, meGusta })} />
        <button type="button" className="m-comunidad-accion" aria-label={`${R.comentar}, ${p.comentarios}`} onClick={() => abrirPost(p)}>
          <Ico n="comentario" size={20} /><span>{p.comentarios}</span>
        </button>
        <span className="m-comunidad-post__tags">
          {p.cerrado && <span className="m-comunidad-tag"><Ico n="candado" size={12} />{R.cerrado}</span>}
          {p.encuesta && <span className="m-comunidad-tag"><Ico n="encuesta" size={12} />{R.encuesta}</span>}
          {p.video && <span className="m-comunidad-tag"><Ico n="video" size={12} />{R.video}</span>}
          {p.adjunto && !p.adjunto.imagen && <span className="m-comunidad-tag"><Ico n="clip" size={12} />{R.archivo}</span>}
        </span>
      </div>
    </article>
  );
}
