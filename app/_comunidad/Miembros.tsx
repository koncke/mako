'use client';

// =============================================================================
// Miembros — el directorio de la comunidad, y el perfil de cada uno
// =============================================================================
// Como Skool: buscar por nombre y filtrar Todos / Equipo / En línea («en línea» = actividad en los
// últimos 5 minutos), de la actividad más reciente a la más vieja. Un miembro abre su perfil: foto con
// su nivel, bio, links, desde cuándo y su última actividad. El propio se edita ahí (bio, links,
// ubicación); el nombre y la foto salen de su ficha y no se tocan desde la comunidad.

import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Input, Modal, Spinner, Textarea } from '@/app/_ui';
import type { FiltroMiembros, MiembroVista, MiembrosVista, PerfilVista, SacadoVista } from '@/lib/comunidad-tipos';
import { REDES, ROTULO_RED, TOPE_BIO, TOPE_UBICACION, type Red } from '@/lib/comunidad-reglas';
import { rotuloNivel } from '@/lib/comunidad-niveles';
import { AvatarNivel, Hace, Ico, useComunidad } from './piezas';

const fecha = (iso: string | null) => {
  const d = iso ? new Date(iso) : null;
  return d && Number.isFinite(d.getTime()) ? d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
};

export function Miembros({ version = 0 }: {
  /** Cambia cuando alguien entra o sale de la comunidad (moderación): se vuelve a pedir la lista. */
  version?: number;
}) {
  const { api, abrirPerfil, comunidad } = useComunidad();
  const [filtro, setFiltro] = useState<FiltroMiembros | 'fuera'>('todos');
  const [q, setQ] = useState('');
  const [vista, setVista] = useState<MiembrosVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sacados, setSacados] = useState<SacadoVista[] | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const pedido = useRef(0);

  // El buscador espera a que se deje de tipear (un pedido por nombre, no por tecla).
  useEffect(() => {
    if (filtro === 'fuera') return;
    const n = ++pedido.current;
    const t = setTimeout(() => {
      void api.miembros({ filtro, q }).then((r) => {
        if (n !== pedido.current) return;
        if (r.ok) { setVista(r.miembros); setError(null); } else setError(r.error);
      });
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [api, filtro, q, version, vuelta]);

  // Los que están FUERA de la comunidad: sólo el equipo los ve, para volver a admitirlos.
  useEffect(() => {
    if (!comunidad.puedoModerar || !api.sacados) return;
    let vivo = true;
    void api.sacados().then((r) => { if (vivo && r.ok) setSacados(r.sacados); });
    return () => { vivo = false; };
  }, [api, comunidad.puedoModerar, version, vuelta]);

  const chips: Array<{ id: FiltroMiembros | 'fuera'; label: string; n?: number }> = [
    { id: 'todos', label: 'Todos', n: vista?.conteos.todos },
    { id: 'equipo', label: 'Equipo', n: vista?.conteos.equipo },
    { id: 'en_linea', label: 'En línea', n: vista?.conteos.enLinea },
    ...(sacados && sacados.length > 0 ? [{ id: 'fuera' as const, label: 'Fuera', n: sacados.length }] : []),
  ];

  return (
    <div className="cmu-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cmu-barra">
        <div className="cmu-chips" role="tablist" aria-label="Filtro">
          {chips.map((c) => (
            <button key={c.id} type="button" role="tab" className="cmu-chip" data-on={filtro === c.id} aria-selected={filtro === c.id} onClick={() => setFiltro(c.id)}>
              {c.label}{c.n != null ? ` ${c.n}` : ''}
            </button>
          ))}
        </div>
        {filtro !== 'fuera' && (
          <div style={{ flex: '0 1 260px', minWidth: 180 }}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar miembros" aria-label="Buscar miembros" />
          </div>
        )}
      </div>
      {filtro === 'fuera' ? (
        <Sacados lista={sacados ?? []} onCambio={() => setVuelta((v) => v + 1)} />
      ) : (
        <>
          {error && <p className="cmu-error" role="alert">{error}</p>}
          {!vista && !error && <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Spinner /></div>}
          {vista && vista.miembros.length === 0 && <p className="cmu-dim" style={{ margin: 0 }}>{q ? 'Nadie con ese nombre.' : 'Nadie en este filtro.'}</p>}
        </>
      )}
      <div style={{ display: filtro === 'fuera' ? 'none' : undefined }}>
        {vista?.miembros.map((m) => (
          <button key={m.clave} type="button" className="cmu-miembro" onClick={() => abrirPerfil(m.clave)}>
            <AvatarNivel m={m} size={44} />
            <span className="cmu-miembro-txt">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span className="cmu-nombre">{m.nombre}</span>
                {m.equipo && <span className="cmu-tag cmu-tag--equipo">Equipo</span>}
              </span>
              {m.bio && <span className="cmu-miembro-bio" style={{ display: 'block' }}>{m.bio}</span>}
            </span>
            <span className="cmu-miembro-der">
              {m.enLinea
                ? <span className="cmu-en-linea"><span className="cmu-punto" aria-hidden /> En línea</span>
                : m.ultimaActividad ? <span>Activo <Hace iso={m.ultimaActividad} /></span> : null}
              {fecha(m.desde) && <span>Desde {fecha(m.desde)}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── El perfil ───────────────────────────────────────────────────────────────────

// ── Fuera de la comunidad (moderación) ──────────────────────────────────────────

/** Los alumnos sacados, con «Volver a admitir». Sólo el equipo llega acá. */
function Sacados({ lista, onCambio }: { lista: SacadoVista[]; onCambio: () => void }) {
  const { api, aviso } = useComunidad();
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const admitir = async (s: SacadoVista) => {
    if (!api.admitir) return;
    setEnCurso(s.miembro.clave);
    const r = await api.admitir(s.miembro.clave);
    setEnCurso(null);
    if (!r.ok) { aviso(r.error); return; }
    aviso('Volvió a la comunidad');
    onCambio();
  };
  if (!lista.length) return <p className="cmu-dim" style={{ margin: 0 }}>Nadie fuera.</p>;
  return (
    <div>
      {lista.map((s) => (
        <div key={s.miembro.clave} className="cmu-miembro" style={{ cursor: 'default' }}>
          <AvatarNivel m={s.miembro} size={40} sinNivel />
          <span className="cmu-miembro-txt">
            {/* Sin link al perfil: fuera de la comunidad no es miembro, y su perfil diría «ya no está». */}
            <span className="cmu-nombre">{s.miembro.nombre}</span>
            <span className="cmu-miembro-bio" style={{ display: 'block' }}>
              Fuera <Hace iso={s.desde} />{s.motivo ? ` · ${s.motivo}` : ''}
            </span>
          </span>
          {api.admitir && (
            <Button variant="secondary" size="sm" loading={enCurso === s.miembro.clave} onClick={() => void admitir(s)}>Volver a admitir</Button>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Sacar a un alumno de la comunidad (sin cortarle el curso). Con la casilla, además se borra lo que
 * escribió en los últimos 7 días (como el ban de Skool): eso no tiene vuelta atrás, y lo dice al lado.
 */
export function SacarModal({ miembro, onCerrar, onListo }: {
  miembro: Pick<MiembroVista, 'clave' | 'nombre'>;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const { api, aviso } = useComunidad();
  const [motivo, setMotivo] = useState('');
  const [borrar, setBorrar] = useState(false);
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sacar = async () => {
    if (!api.sacar) return;
    setEnCurso(true);
    setError(null);
    const r = await api.sacar(miembro.clave, { motivo, borrarContenido: borrar });
    setEnCurso(false);
    if (!r.ok) { setError(r.error); return; }
    aviso('Fuera de la comunidad');
    onListo();
  };
  return (
    <Modal titulo={`Sacar a ${miembro.nombre}`} ancho={460} onCerrar={onCerrar} anidada
      pie={(
        <>
          <Button variant="tertiary" onClick={onCerrar}>No sacar</Button>
          <Button variant="danger" loading={enCurso} onClick={() => void sacar()}>Sacar de la comunidad</Button>
        </>
      )}>
      <div className="cmu-form">
        <p className="cmu-chico" style={{ margin: 0 }}>Deja de ver la comunidad. Su curso sigue abierto.</p>
        <label className="cmu-campo-l">Motivo (lo ve el equipo)
          <Input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
        </label>
        <Checkbox checked={borrar} onChange={setBorrar} label="Borrar sus posts y comentarios de los últimos 7 días"
          hint="No se puede deshacer." />
        {error && <p className="cmu-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

export function PerfilModal({ clave, onCerrar }: { clave: string; onCerrar: () => void }) {
  const { api, aviso, comunidad, sacar } = useComunidad();
  const [p, setP] = useState<PerfilVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [bio, setBio] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [links, setLinks] = useState<Partial<Record<Red, string>>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void api.perfil(clave).then((r) => { if (!vivo) return; if (r.ok) setP(r.perfil); else setError(r.error); });
    return () => { vivo = false; };
  }, [api, clave]);

  const empezar = () => {
    if (!p) return;
    setBio(p.bio); setUbicacion(p.ubicacion); setLinks(p.links); setError(null); setEditando(true);
  };
  const guardar = async () => {
    setGuardando(true);
    const r = await api.guardarPerfil({ bio, ubicacion, links });
    setGuardando(false);
    if (!r.ok) { setError(r.error); return; }
    setP(r.perfil);
    setEditando(false);
    aviso('Perfil guardado');
  };

  const pie = p?.esYo ? (editando ? (
    <>
      <Button variant="tertiary" onClick={() => setEditando(false)}>No guardar</Button>
      <Button onClick={() => void guardar()} loading={guardando}>Guardar perfil</Button>
    </>
  ) : <Button variant="secondary" icon={<Ico n="lapiz" size={14} />} onClick={empezar}>Editar mi perfil</Button>)
    // Moderación: el equipo saca a un alumno desde su perfil (el server vuelve a preguntar `puedeSacar`).
    : p?.puedoSacar && sacar ? (
      <Button variant="tertiary" onClick={() => { onCerrar(); sacar({ clave: p.clave, nombre: p.nombre }); }}>Sacar de la comunidad</Button>
    ) : undefined;

  return (
    <Modal titulo={p?.nombre ?? 'Perfil'} ancho={520} onCerrar={onCerrar} sinFiletes pie={pie}>
      {!p && !error && <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Spinner /></div>}
      {error && <p className="cmu-error" role="alert">{error}</p>}
      {p && !editando && (
        <div className="cmu-perfil">
          <AvatarNivel m={p} size={104} />
          {/* El nombre ya es el título de la caja: acá va lo que lo distingue (equipo, nivel, puntos). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {p.equipo && <span className="cmu-tag cmu-tag--equipo">Equipo</span>}
            <span className="cmu-dim cmu-chico">{rotuloNivel(p.nivel, comunidad.nombresNivel)} · {p.puntos} {p.puntos === 1 ? 'punto' : 'puntos'}</span>
          </div>
          {p.bio && <p className="cmu-texto" style={{ textAlign: 'center' }}>{p.bio}</p>}
          {p.ubicacion && <span className="cmu-dim cmu-chico">{p.ubicacion}</span>}
          {Object.keys(p.links).length > 0 && (
            <div className="cmu-links">
              {REDES.filter((r) => p.links[r]).map((r) => (
                <a key={r} className="cmu-tag" href={p.links[r]} target="_blank" rel="noopener noreferrer nofollow"><Ico n="link" size={12} /> {ROTULO_RED[r]}</a>
              ))}
            </div>
          )}
          <span className="cmu-meta">
            {p.enLinea ? 'En línea' : p.ultimaActividad ? <>Activo <Hace iso={p.ultimaActividad} /></> : null}
            {fecha(p.desde) ? `${p.enLinea || p.ultimaActividad ? ' · ' : ''}Miembro desde ${fecha(p.desde)}` : ''}
          </span>
        </div>
      )}
      {p && editando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="cmu-chico" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Bio
            <Textarea value={bio} maxLength={TOPE_BIO} rows={3} onChange={(e) => setBio(e.target.value)} />
            <span className="cmu-meta" style={{ textAlign: 'right' }}>{bio.length}/{TOPE_BIO}</span>
          </label>
          <label className="cmu-chico" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Ubicación
            <Input value={ubicacion} maxLength={TOPE_UBICACION} onChange={(e) => setUbicacion(e.target.value)} />
          </label>
          {REDES.map((r) => (
            <label key={r} className="cmu-chico" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ROTULO_RED[r]}
              <Input value={links[r] ?? ''} placeholder="https://" onChange={(e) => setLinks((l) => ({ ...l, [r]: e.target.value }))} />
            </label>
          ))}
          {error && <p className="cmu-error" role="alert">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
