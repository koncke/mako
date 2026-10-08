'use client';

// =============================================================================
// About — de qué se trata la comunidad, sus reglas y quiénes están
// =============================================================================
// Skool (relevo, B.9): la pantalla About tiene la descripción, «X miembros · Y en línea · Z admins» y las
// reglas del grupo. Acá el EQUIPO la edita en el lugar (nombre, descripción corta, el texto largo y las
// reglas); un ADMIN del workspace además fija desde qué nivel publican los alumnos (el «Unlock Posting
// at Level N» de Skool, que en la primera mitad existía sin pantalla) y la zona del calendario.
//
// Todo es TEXTO (con saltos de línea y links), nunca HTML: se dibuja como un post.

import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Select, Spinner, Textarea } from '@/app/_ui';
import type { AboutVista } from '@/lib/comunidad-tipos';
import {
  TOPE_ABOUT, TOPE_DESCRIPCION_CORTA, TOPE_NOMBRE_COMUNIDAD, TOPE_REGLAS, tokensDeTexto,
} from '@/lib/comunidad-reglas';
import { NIVEL_MAX, rotuloNivel } from '@/lib/comunidad-niveles';
import { AvatarNivel, Ico, Texto, useComunidad } from './piezas';
import { zonaDelNavegador, zonasDisponibles } from './tiempo';

export function About() {
  const { api, setComunidad, abrirPerfil } = useComunidad();
  const [about, setAbout] = useState<AboutVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void api.about().then((r) => { if (!vivo) return; if (r.ok) setAbout(r.about); else setError(r.error); });
    return () => { vivo = false; };
  }, [api]);

  if (error && !about) return <p className="cmu-error" role="alert">{error}</p>;
  if (!about) return <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>;
  const c = about.conteos;

  const listo = (a: AboutVista) => {
    setAbout(a);
    // La columna lateral y el «Publicas desde el nivel N» del feed leen esto de la comunidad.
    setComunidad((x) => ({ ...x, nombre: a.nombre, descripcion: a.descripcion, nivelParaPostear: a.nivelParaPostear }));
  };

  return (
    <div className="cmu-grid">
      <div className="cmu-main">
        <div className="cmu-card cmu-about">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="cmu-about-tit">{about.nombre}</h2>
              {about.descripcion && <p className="cmu-dim" style={{ margin: '4px 0 0' }}>{about.descripcion}</p>}
            </div>
            {about.puedoEditar && api.guardarAbout && (
              <Button variant="secondary" size="sm" icon={<Ico n="lapiz" size={14} />} onClick={() => setEditando(true)}>Editar</Button>
            )}
          </div>
          <div className="cmu-stats">
            <span className="cmu-stat"><b>{c ? c.miembros : '—'}</b><span>Miembros</span></span>
            <span className="cmu-stat"><b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{c ? c.enLinea : '—'}{c && c.enLinea > 0 && <span className="cmu-punto" aria-hidden />}</b><span>En línea</span></span>
            <span className="cmu-stat"><b>{c ? c.equipo : '—'}</b><span>Equipo</span></span>
          </div>
          {about.texto
            ? <Texto tokens={tokensDeTexto(about.texto)} />
            : <p className="cmu-meta" style={{ margin: 0 }}>{about.puedoEditar ? 'Cuenta de qué se trata esta comunidad.' : 'Sin descripción todavía.'}</p>}
        </div>
        {(about.reglas || about.puedoEditar) && (
          <div className="cmu-card cmu-about">
            <b className="cmu-card-tit">Reglas</b>
            {about.reglas ? <Texto tokens={tokensDeTexto(about.reglas)} /> : <p className="cmu-meta" style={{ margin: 0 }}>Sin reglas todavía.</p>}
          </div>
        )}
      </div>
      <aside className="cmu-aside">
        <div className="cmu-card">
          <b className="cmu-card-tit">Equipo</b>
          {about.equipo.length === 0 && <p className="cmu-meta" style={{ margin: 0 }}>—</p>}
          {about.equipo.map((m) => (
            <button key={m.clave} type="button" className="cmu-fila cmu-nombre-btn" style={{ width: '100%' }} onClick={() => abrirPerfil(m.clave)}>
              <AvatarNivel m={m} size={30} sinNivel />
              <span className="cmu-fila-nom">{m.nombre}</span>
            </button>
          ))}
        </div>
        {about.nivelParaPostear > 1 && (
          <div className="cmu-card">
            <b className="cmu-card-tit">Para publicar</b>
            <p className="cmu-chico cmu-dim" style={{ margin: 0 }}>Desde el {rotuloNivel(about.nivelParaPostear, null).toLowerCase()}.</p>
          </div>
        )}
      </aside>
      {editando && <EditorAbout about={about} onCerrar={() => setEditando(false)} onListo={(a) => { listo(a); setEditando(false); }} />}
    </div>
  );
}

function EditorAbout({ about, onCerrar, onListo }: { about: AboutVista; onCerrar: () => void; onListo: (a: AboutVista) => void }) {
  const { api, aviso } = useComunidad();
  const [nombre, setNombre] = useState(about.nombrePropio ?? '');
  const [descripcion, setDescripcion] = useState(about.descripcion);
  const [texto, setTexto] = useState(about.texto);
  const [reglas, setReglas] = useState(about.reglas);
  const [nivel, setNivel] = useState(String(about.nivelParaPostear));
  const [zona, setZona] = useState(about.zona ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const zonas = useMemo(() => zonasDisponibles(about.zona ?? zonaDelNavegador()), [about.zona]);

  const guardar = async () => {
    if (!api.guardarAbout) return;
    setGuardando(true);
    setError(null);
    let r = await api.guardarAbout({ nombre, descripcion, texto, reglas });
    // Lo del admin va aparte (otra regla: `puedeConfigurar`), y sólo si cambió.
    if (r.ok && about.puedoConfigurar && api.guardarAjustes && (Number(nivel) !== about.nivelParaPostear || (zona || null) !== about.zona)) {
      r = await api.guardarAjustes({ nivelParaPostear: Number(nivel), zona: zona || null });
    }
    setGuardando(false);
    if (!r.ok) { setError(r.error); return; }
    aviso('About guardado');
    onListo(r.about);
  };

  return (
    <Modal titulo="Editar el About" ancho={680} onCerrar={onCerrar}
      pie={(
        <>
          <Button variant="tertiary" onClick={onCerrar}>No guardar</Button>
          <Button loading={guardando} onClick={() => void guardar()}>Guardar About</Button>
        </>
      )}>
      <div className="cmu-form">
        <label className="cmu-campo-l">Nombre
          <Input value={nombre} maxLength={TOPE_NOMBRE_COMUNIDAD} placeholder={about.nombrePropio ? undefined : about.nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="cmu-campo-l">Descripción corta
          <Input value={descripcion} maxLength={TOPE_DESCRIPCION_CORTA} onChange={(e) => setDescripcion(e.target.value)} />
          <span className="cmu-meta" style={{ textAlign: 'right' }}>{descripcion.length}/{TOPE_DESCRIPCION_CORTA}</span>
        </label>
        <label className="cmu-campo-l">De qué se trata
          <Textarea value={texto} maxLength={TOPE_ABOUT} rows={7} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <label className="cmu-campo-l">Reglas
          <Textarea value={reglas} maxLength={TOPE_REGLAS} rows={5} onChange={(e) => setReglas(e.target.value)} />
        </label>
        {about.puedoConfigurar && api.guardarAjustes && (
          <div className="cmu-form-fila">
            <div className="cmu-campo-l">Publican desde
              <Select ariaLabel="Publican desde" value={nivel} onChange={setNivel}
                options={Array.from({ length: NIVEL_MAX }, (_, i) => ({ value: String(i + 1), label: i === 0 ? 'Todos' : `Nivel ${i + 1}` }))} />
            </div>
            <div className="cmu-campo-l">Zona del calendario
              <Select ariaLabel="Zona del calendario" value={zona} onChange={setZona} search placeholder="La del negocio"
                options={[{ value: '', label: 'La del negocio' }, ...zonas.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))]} />
            </div>
          </div>
        )}
        {error && <p className="cmu-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
