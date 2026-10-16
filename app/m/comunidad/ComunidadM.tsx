'use client';

// =============================================================================
// /m/comunidad — la raíz de la pantalla: el producto, el segmentado, la lupa y las hojas
// =============================================================================
// Comunidad · Miembros · Ranking, las pestañas de app/_comunidad/Comunidad.tsx que se usan con el dedo, en su
// orden (Calendario y About: en la computadora). La lupa va a la derecha de la cabecera, como en escritorio
// va a la derecha de las pestañas. Con más de un producto, arriba la fila «Producto» abre la lista (el Select
// de escritorio); cambiarlo es otra URL (`?producto=`, leída en el server), como escritorio.
//
// ⚠️ LA PESTAÑA ES UN ESTADO, COMO EN ESCRITORIO (Comunidad.tsx no la pone en la URL, y `QUERY_DE_SECCION`
//    sólo lleva `producto` y `post`): un link de la computadora abre la Comunidad, y el teléfono también.
// ⚠️ REFRESCAR TRAE LO NUEVO: la comunidad y el feed son props del server; nada las copia a un estado sin
//    soltarlas. El feed las adopta (./FeedM.tsx) y Miembros y Ranking se vuelven a pedir (`version`).
// ⚠️ UNA HOJA POR VEZ, Y CADA UNA CON SU PROPIO `abierta`: abrir otra es SÓLO abrir la nueva
//    (`registrarApertura` cierra la de antes por su `onCerrar`). Un único «qué hoja» cerraría la de antes por
//    código en el mismo render y dejaría una entrada de más en el historial (docs/hallazgos-mobile.md).
// ⚠️ `?post=` (el link de la ficha a lo que publicó un alumno) abre ESE post UNA vez: se mira en la URL del
//    navegador, no en la prop (volver «atrás» restaura el árbol con la prop puesta y lo reabriría), y se saca.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { apiDelEquipo } from '@/app/customer-success/comunidad/api-equipo';
import type { ComunidadVista, FeedVista, PostVista } from '@/lib/comunidad-tipos';
import { CabeceraM, FilaDatoM, FilaM, ListaM, SegmentadoM, SheetM, SkeletonFilas, useToastM } from '@/app/m/_ui';
import type { ProductoComunidad } from './datos';
import { R, VISTAS_COMUNIDAD, type VistaComunidad } from './modelo';
import { CtxM, useAhora, type CtxComunidadM } from './piezas';
import { FeedM, useFeedM } from './FeedM';
import { HojaPostM } from './PostM';
import { HojaBuscarM, HojaEscribirM, HojaPerfilM } from './HojasM';
import { MiembrosM, RankingM } from './VistasM';

type Hoja = 'post' | 'perfil' | 'buscar' | 'escribir' | 'productos';
const CERRADAS: Record<Hoja, boolean> = { post: false, perfil: false, buscar: false, escribir: false, productos: false };
const CEROS: Record<Hoja, number> = { post: 0, perfil: 0, buscar: 0, escribir: 0, productos: 0 };

export function ComunidadM({ productos, productoId, comunidad, feed: feedInicial, postInicial }: {
  productos: ProductoComunidad[];
  productoId: number;
  comunidad: ComunidadVista;
  feed: FeedVista;
  postInicial: number | null;
}) {
  const router = useRouter();
  const toast = useToastM();
  const api = useMemo(() => apiDelEquipo(productoId), [productoId]);
  const ahora = useAhora();
  const feed = useFeedM(feedInicial, api, comunidad);
  const [vista, setVista] = useState<VistaComunidad>('comunidad');

  // Otra comunidad del server (tirar hacia abajo): Miembros y Ranking se vuelven a pedir.
  const [base, setBase] = useState(comunidad);
  const [version, setVersion] = useState(0);
  if (base !== comunidad) { setBase(comunidad); setVersion((v) => v + 1); }

  // ── Las hojas: cada una con su `abierta` y su `vez` (la llave que la monta limpia al abrir) ──
  // ⚠️ UNA `vez` POR HOJA: con una sola, abrir el perfil desde Buscar montaba de nuevo también a Buscar (todavía
  //    abierta), que se volvía a registrar y empujaba otra entrada al historial antes de cerrarse.
  const [abiertas, setAbiertas] = useState(CERRADAS);
  const [vez, setVez] = useState(CEROS);
  const [post, setPost] = useState<{ id: number; base: PostVista | null } | null>(null);
  const [perfil, setPerfil] = useState<string | null>(null);
  const abrir = useCallback((h: Hoja) => {
    setVez((v) => ({ ...v, [h]: v[h] + 1 }));
    setAbiertas((a) => ({ ...a, [h]: true }));
  }, []);
  const cerrar = useCallback((h: Hoja) => setAbiertas((a) => ({ ...a, [h]: false })), []);

  const abrirPost = useCallback((p: PostVista | number) => {
    setPost(typeof p === 'number' ? { id: p, base: null } : { id: p.id, base: p });
    abrir('post');
  }, [abrir]);
  const abrirPerfil = useCallback((clave: string) => { setPerfil(clave); abrir('perfil'); }, [abrir]);

  const ctx = useMemo<CtxComunidadM>(() => ({
    api, comunidad, ahora, abrirPost, abrirPerfil, cambiarTarjeta: feed.cambiar,
  }), [api, comunidad, ahora, abrirPost, abrirPerfil, feed.cambiar]);

  // `?post=`: una sola vez, y sólo si la URL del navegador todavía lo trae.
  const usado = useRef(false);
  useEffect(() => {
    if (postInicial == null || usado.current) return;
    usado.current = true;
    let enUrl = false;
    try {
      const u = new URL(window.location.href);
      enUrl = u.searchParams.has('post');
      if (enUrl) {
        // Sin `?post=`, el producto tiene que quedar en la URL: el server lo sacaba del post, y refrescar sin
        // ninguno de los dos abriría el PRIMER producto, no el de este post.
        u.searchParams.delete('post');
        u.searchParams.set('producto', String(productoId));
        window.history.replaceState(null, '', u.pathname + u.search + u.hash);
      }
    } catch { /* sin URL: no se abre nada */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (enUrl) abrirPost(postInicial);
  }, [postInicial, abrirPost, productoId]);

  // ── El producto: otra URL, leída en el server (la pantalla se monta de nuevo con su llave) ──
  const [pedido, setPedido] = useState<number | null>(null);
  const [cambiando, empezar] = useTransition();
  const elegirProducto = (id: number) => {
    if (id === productoId) { cerrar('productos'); return; }
    setPedido(id);
    // Con la hoja abierta: al llegar la página nueva se desmonta y suelta su registro sin tocar el historial
    // (cerrarla por código en el mismo tick haría un replaceState que puede deshacer la navegación).
    empezar(() => router.replace(`/m/comunidad?producto=${id}`, { scroll: false }));
  };
  const actual = productos.find((p) => p.id === productoId);

  const lupa = useMemo(() => (
    <button type="button" className="m-cabecera__accion" aria-label={R.buscar} onClick={() => abrir('buscar')}>
      <Icon name="search" size={22} />
    </button>
  ), [abrir]);

  return (
    <CtxM.Provider value={ctx}>
      <div className="m-comunidad">
        <CabeceraM accion={lupa} />

        {productos.length > 1 && actual && (
          <ListaM>
            <FilaDatoM k={R.producto} v={actual.nombre} azul onClick={() => abrir('productos')} />
          </ListaM>
        )}

        <div className="m-comunidad-seg">
          <SegmentadoM etiqueta="Vista" valor={vista} onCambio={setVista} opciones={VISTAS_COMUNIDAD} />
        </div>

        {cambiando ? (
          <SkeletonFilas filas={4} />
        ) : (
          <>
            {/* El feed no se desmonta al cambiar de pestaña (como escritorio): volver no pierde lo cargado ni el filtro. */}
            <div hidden={vista !== 'comunidad'}>
              <FeedM feed={feed} onEscribir={() => abrir('escribir')} />
            </div>
            {vista === 'miembros' && <MiembrosM version={version} />}
            {vista === 'ranking' && <RankingM version={version} />}
          </>
        )}

        <HojaPostM key={vez.post} abierta={abiertas.post} postId={post?.id ?? null} base={post?.base ?? null}
          onCerrar={() => cerrar('post')} />
        <HojaPerfilM key={vez.perfil} abierta={abiertas.perfil} clave={perfil} onCerrar={() => cerrar('perfil')} />
        <HojaBuscarM key={vez.buscar} abierta={abiertas.buscar} onCerrar={() => cerrar('buscar')} />
        <HojaEscribirM key={vez.escribir} abierta={abiertas.escribir} categoriaDelFeed={feed.cat} onCerrar={() => cerrar('escribir')}
          onPublicado={(p) => { feed.publicado(p); cerrar('escribir'); toast(R.publicado); }} />

        {productos.length > 1 && (
          <SheetM id="productos" abierto={abiertas.productos} onCerrar={() => cerrar('productos')} titulo={R.producto}
            ocupado={cambiando} rotuloCerrar="Cerrar los productos">
            <ListaM etiqueta={R.producto}>
              {productos.map((p) => {
                const elegido = (pedido ?? productoId) === p.id;
                return (
                  <FilaM key={p.id} titulo={p.nombre} navegacion chevron={false} deshabilitada={cambiando}
                    riel={elegido ? <span className="m-comunidad-check"><Icon name="check" size={20} /></span> : undefined}
                    onClick={() => elegirProducto(p.id)} />
                );
              })}
            </ListaM>
          </SheetM>
        )}
      </div>
    </CtxM.Provider>
  );
}
