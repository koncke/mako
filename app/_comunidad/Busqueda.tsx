'use client';

// =============================================================================
// Busqueda — buscar en la comunidad: posts (título y cuerpo) y miembros
// =============================================================================
// Skool tiene una barra que encuentra posts, comentarios y perfiles (relevo, B.2). Acá: los posts por
// su título y su texto, y los miembros por su nombre, sin mayúsculas ni acentos (lo decide el server:
// `buscarEnComunidad`, lib/comunidad-datos.ts). Un post abre su modal; un miembro, su perfil.

import { useEffect, useRef, useState } from 'react';
import { Input, Modal, Spinner } from '@/app/_ui';
import type { BusquedaVista } from '@/lib/comunidad-tipos';
import { MIN_BUSQUEDA } from '@/lib/comunidad-reglas';
import { AvatarNivel, Hace, Ico, useComunidad } from './piezas';

export function Busqueda({ onCerrar }: { onCerrar: () => void }) {
  const { api, abrirPost, abrirPerfil } = useComunidad();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ q: string; vista: BusquedaVista | null; error: string | null } | null>(null);
  const pedido = useRef(0);

  // Un pedido cuando se deja de tipear, y gana el último (no el que llega último).
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
  }, [api, q]);

  const limpio = q.trim();
  const corto = limpio.length < MIN_BUSQUEDA;
  const cargando = !corto && res?.q !== limpio;
  const vista = !corto && res?.q === limpio ? res.vista : null;
  const vacio = vista && !vista.posts.length && !vista.miembros.length;

  return (
    <Modal titulo="Buscar" ancho={640} alto="min(80vh, 640px)" onCerrar={onCerrar} sinFiletes>
      <div className="cmu-buscar">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Posts y miembros" aria-label="Buscar en la comunidad"
          prefix={<Ico n="lupa" size={16} />} autoFocus />
        {cargando && <div style={{ display: 'grid', placeItems: 'center', padding: 20 }}><Spinner /></div>}
        {!cargando && res?.error && res.q === limpio && <p className="cmu-error" role="alert">{res.error}</p>}
        {vacio && <p className="cmu-meta" style={{ margin: 0 }}>Nada con «{limpio}».</p>}
        {vista && vista.miembros.length > 0 && (
          <div>
            <b className="cmu-chico">Miembros</b>
            {vista.miembros.map((m) => (
              <button key={m.clave} type="button" className="cmu-miembro" onClick={() => { onCerrar(); abrirPerfil(m.clave); }}>
                <AvatarNivel m={m} size={34} />
                <span className="cmu-miembro-txt">
                  <span className="cmu-nombre">{m.nombre}</span>
                  {m.bio && <span className="cmu-miembro-bio" style={{ display: 'block' }}>{m.bio}</span>}
                </span>
                {m.equipo && <span className="cmu-tag cmu-tag--equipo">Equipo</span>}
              </button>
            ))}
          </div>
        )}
        {vista && vista.posts.length > 0 && (
          <div>
            <b className="cmu-chico">Posts</b>
            {vista.posts.map((p) => (
              <button key={p.id} type="button" className="cmu-miembro" onClick={() => { onCerrar(); abrirPost(p.id); }}>
                <AvatarNivel m={p.autor} size={34} />
                <span className="cmu-miembro-txt">
                  <span className="cmu-nombre">{p.titulo}</span>
                  {p.extracto && <span className="cmu-miembro-bio" style={{ display: 'block' }}>{p.extracto}</span>}
                </span>
                <span className="cmu-meta"><Hace iso={p.creado} /></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
