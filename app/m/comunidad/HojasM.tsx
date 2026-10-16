'use client';

// =============================================================================
// /m/comunidad — las hojas: el perfil de un miembro, Buscar y «Nuevo post»
// =============================================================================
// Cada una se MONTA DE NUEVO al abrirse (la llave `vez` de ./ComunidadM.tsx): su sub-estado arranca limpio al
// ABRIR, nunca al cerrar (la hoja sigue en pantalla los 220 ms de la salida). Pasar de una a otra (de Buscar
// a un perfil) es SÓLO abrir la nueva: `registrarApertura` cierra la anterior y le pasa su entrada del
// historial (docs/hallazgos-mobile.md, «Tanda 2»).
//
//   · El perfil (PerfilModal de app/_comunidad/Miembros.tsx): la cara grande con su nivel, «Equipo», el nivel y
//     los puntos, la bio, la ubicación, los links que eligió publicar y si está en línea. En lectura: «Editar mi
//     perfil» y «Sacar de la comunidad» quedan en la computadora.
//   · Buscar (app/_comunidad/Busqueda.tsx): posts y miembros, cuando se deja de tipear (300 ms) y desde dos
//     letras (`MIN_BUSQUEDA`); gana el último pedido. Un miembro abre su perfil; un post, su hoja.
//   · «Nuevo post» (app/_comunidad/Compositor.tsx): la categoría (sólo donde se puede publicar:
//     `categoriasParaPublicar`), el título y el texto. El video, la encuesta y el archivo, en la computadora.
//     Publicar no es idempotente: nunca dos a la vez, y la hoja no se cierra mientras va.

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { Ico } from '@/app/_comunidad/iconos';
import type { BusquedaVista, PerfilVista, PostVista } from '@/lib/comunidad-tipos';
import { MIN_BUSQUEDA, REDES, ROTULO_RED, TOPE_CUERPO, TOPE_TITULO, haceCuanto } from '@/lib/comunidad-reglas';
import { rotuloNivel } from '@/lib/comunidad-niveles';
import { ErrorM, FilaM, ListaM, PieM, PildoraM, SeccionM, SheetM, SkeletonFilas, VacioM, useConexion } from '@/app/m/_ui';
import {
  R, T, categoriaInicial, categoriasParaPublicar, entradaPost, rotuloPuntosPerfil, segundaDeMiembro,
} from './modelo';
import { AvatarNivelM, useComunidadM } from './piezas';

// ── El perfil ───────────────────────────────────────────────────────────────────

export function HojaPerfilM({ abierta, clave, onCerrar }: { abierta: boolean; clave: string | null; onCerrar: () => void }) {
  const { api, comunidad, ahora } = useComunidadM();
  const [p, setP] = useState<PerfilVista | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clave) return;
    let vivo = true;
    void api.perfil(clave).then((r) => { if (!vivo) return; if (r.ok) setP(r.perfil); else setError(r.error); });
    return () => { vivo = false; };
  }, [api, clave]);

  const links = p ? REDES.filter((r) => p.links[r]) : [];
  const estado = p ? segundaDeMiembro({ ...p, bio: '' }, ahora) : '';

  return (
    <SheetM id="perfil" abierto={abierta} onCerrar={onCerrar} titulo={p?.nombre ?? R.perfil} rotuloCerrar="Cerrar el perfil">
      {error ? (
        <VacioM frase={error} />
      ) : !p ? (
        <SkeletonFilas filas={3} />
      ) : (
        <>
          <div className="m-comunidad-perfil">
            <AvatarNivelM m={p} tam={88} enLinea={p.enLinea} />
            {p.equipo && <PildoraM tono="info">{R.equipo}</PildoraM>}
            <p className="m-comunidad-perfil__nivel">{rotuloNivel(p.nivel, comunidad.nombresNivel)} · {rotuloPuntosPerfil(p.puntos)}</p>
            {p.bio && <p className="m-comunidad-perfil__bio">{p.bio}</p>}
            {(estado || p.ubicacion) && (
              <p className="m-comunidad-meta">{[estado, p.ubicacion].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          {links.length > 0 && (
            <div className="m-comunidad-links">
              {links.map((r) => (
                <a key={r} className="m-comunidad-chip" href={p.links[r]} target="_blank" rel="noopener noreferrer nofollow">
                  <Ico n="link" size={14} />{ROTULO_RED[r]}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </SheetM>
  );
}

// ── Buscar ──────────────────────────────────────────────────────────────────────

export function HojaBuscarM({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const { api, ahora, abrirPerfil, abrirPost } = useComunidadM();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ q: string; vista: BusquedaVista | null; error: string | null } | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const pedido = useRef(0);

  useEffect(() => {
    const limpio = q.trim();
    if (limpio.length < MIN_BUSQUEDA) return;
    const n = ++pedido.current;
    const t = setTimeout(() => {
      void api.buscar(limpio).then((r) => {
        if (n !== pedido.current) return;
        setRes({ q: limpio, vista: r.ok ? r.busqueda : null, error: r.ok ? null : r.error });
      });
    }, 300);
    return () => clearTimeout(t);
  }, [api, q, vuelta]);

  const limpio = q.trim();
  const corto = limpio.length < MIN_BUSQUEDA;
  const cargando = !corto && res?.q !== limpio;
  const vista = !corto && res?.q === limpio ? res.vista : null;
  const vacio = vista && !vista.posts.length && !vista.miembros.length;

  return (
    <SheetM id="buscar" abierto={abierta} onCerrar={onCerrar} titulo={R.buscar} snap="alto" rotuloCerrar="Cerrar la búsqueda">
      <label className="m-comunidad-buscar">
        <span className="m-comunidad-buscar__ico" aria-hidden><Icon name="search" size={18} /></span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={R.postsYMiembros} aria-label={R.postsYMiembros}
          enterKeyHint="search" autoComplete="off" autoFocus />
        {q && (
          <button type="button" className="m-comunidad-buscar__limpiar" aria-label="Borrar la búsqueda" onClick={() => setQ('')}>
            <Icon name="x" size={16} />
          </button>
        )}
      </label>

      {cargando && <SkeletonFilas filas={3} />}
      {!cargando && res?.error && res.q === limpio && <ErrorM frase={res.error} onReintentar={() => { setRes(null); setVuelta((v) => v + 1); }} />}
      {vacio && <VacioM frase={`Nada con «${limpio}».`} />}
      {vista && vista.miembros.length > 0 && (
        <SeccionM titulo={R.miembros}>
          <ListaM etiqueta={R.miembros}>
            {vista.miembros.map((m) => (
              <FilaM key={m.clave} leading={<AvatarNivelM m={m} tam={36} enLinea={m.enLinea} />} titulo={m.nombre}
                segunda={m.bio || undefined} riel={m.equipo ? R.equipo : undefined} onClick={() => abrirPerfil(m.clave)} />
            ))}
          </ListaM>
        </SeccionM>
      )}
      {vista && vista.posts.length > 0 && (
        <SeccionM titulo={R.posts}>
          <ListaM etiqueta={R.posts}>
            {vista.posts.map((p) => (
              <FilaM key={p.id} leading={<AvatarNivelM m={p.autor} tam={36} />} titulo={p.titulo}
                segunda={p.extracto || undefined} riel={ahora == null ? undefined : haceCuanto(p.creado, ahora)} onClick={() => abrirPost(p)} />
            ))}
          </ListaM>
        </SeccionM>
      )}
    </SheetM>
  );
}

// ── Nuevo post ──────────────────────────────────────────────────────────────────

export function HojaEscribirM({ abierta, categoriaDelFeed, onCerrar, onPublicado }: {
  abierta: boolean;
  /** La categoría que tiene elegida el feed: se propone, si ahí se puede publicar. */
  categoriaDelFeed: number | null;
  onCerrar: () => void;
  onPublicado: (p: PostVista) => void;
}) {
  const { api, comunidad } = useComunidadM();
  const { enLinea } = useConexion();
  const permitidas = categoriasParaPublicar(comunidad);
  const [categoriaId, setCategoriaId] = useState<number | null>(() => categoriaInicial(permitidas, categoriaDelFeed));
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);

  const publicar = async () => {
    if (enviandoRef.current) return;
    setError(null);
    const v = entradaPost({ titulo, cuerpo, categoriaId }, permitidas);
    if (!v.ok) { setError(v.error); return; }
    if (!enLinea) { setError(`${T.sinConexion}.`); return; }
    enviandoRef.current = true;
    setEnviando(true);
    const r = await api.publicar(v.entrada);
    enviandoRef.current = false;
    setEnviando(false);
    if (!r.ok) { setError(r.error); return; }
    onPublicado(r.post);
  };

  return (
    <SheetM id="nuevo-post" abierto={abierta} onCerrar={onCerrar} titulo={R.nuevoPost} snap="alto" ocupado={enviando}
      rotuloCerrar="Cerrar sin publicar"
      pie={(
        <PieM>
          <Button variant="primary" size="lg" full loading={enviando} onClick={() => { void publicar(); }}>{R.publicar}</Button>
        </PieM>
      )}>
      {permitidas.length > 0 && (
        <div className="m-comunidad-chips m-comunidad-chips--hoja" role="group" aria-label="Categoría">
          {permitidas.map((c) => (
            <button key={c.id} type="button" className="m-comunidad-chip" aria-pressed={categoriaId === c.id} onClick={() => setCategoriaId(c.id)}>
              {c.nombre}
              {c.permiso === 'equipo' && <Ico n="candado" size={13} />}
            </button>
          ))}
        </div>
      )}
      <input className="m-comunidad-titulo" value={titulo} maxLength={TOPE_TITULO} placeholder={R.titulo} aria-label={R.titulo}
        enterKeyHint="next" onChange={(e) => setTitulo(e.target.value)} />
      <textarea className="m-comunidad-cuerpo" value={cuerpo} maxLength={TOPE_CUERPO} placeholder={R.textoPost} aria-label="Texto del post"
        rows={8} onChange={(e) => setCuerpo(e.target.value)} />
      {error && <p className="m-comunidad-error" role="alert">{error}</p>}
    </SheetM>
  );
}
