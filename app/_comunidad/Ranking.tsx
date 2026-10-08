'use client';

// =============================================================================
// Ranking — la pantalla de Leaderboards de Skool
// =============================================================================
// Arriba, la tarjeta con mi nivel y «X puntos para subir»; al lado, los 9 niveles con el % de
// miembros en cada uno y lo que abre cada nivel (los módulos y clases del curso con bloqueo por nivel,
// cuando los haya). Abajo, tres tablas: 7 días, 30 días y total. 1 like recibido = 1 punto.
//
// El equipo no aparece en las tablas (como owners y admins en Skool) y por eso no tiene tarjeta
// propia; un admin del workspace ve, en su lugar, «Nombres de los niveles» para editarlos.

import { useEffect, useState, type ReactNode } from 'react';
import { Button, Input, Modal, Spinner } from '@/app/_ui';
import type { FilaRanking, RankingVista } from '@/lib/comunidad-tipos';
import { NIVEL_MAX, TOPE_NOMBRE_NIVEL, UMBRALES_NIVEL, nombreNivelDefault, rotuloNivel } from '@/lib/comunidad-niveles';
import { AvatarNivel, Hace, Ico, useComunidad } from './piezas';

export function Ranking() {
  const { api, comunidad } = useComunidad();
  const [r, setR] = useState<RankingVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void api.ranking().then((x) => { if (!vivo) return; if (x.ok) setR(x.ranking); else setError(x.error); });
    return () => { vivo = false; };
  }, [api, comunidad.nombresNivel]);

  if (error) return <p className="cmu-error" role="alert">{error}</p>;
  if (!r) return <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>;
  const miNivel = r.yo?.nivel ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="cmu-rank-cab">
        <div className="cmu-card cmu-yo">
          {r.yo ? (
            <>
              <AvatarNivel m={r.yo} size={88} />
              <b className="cmu-card-tit">{r.yo.nombre}</b>
              <span>{rotuloNivel(r.yo.nivel, comunidad.nombresNivel)}</span>
              <span className="cmu-dim cmu-chico">
                {r.yo.puntosParaSubir == null ? 'Llegaste al nivel máximo' : `${r.yo.puntosParaSubir} ${r.yo.puntosParaSubir === 1 ? 'punto' : 'puntos'} para subir`}
              </span>
            </>
          ) : (
            <>
              <b className="cmu-card-tit">Ranking de alumnos</b>
              <span className="cmu-dim cmu-chico">1 like = 1 punto</span>
              {comunidad.puedoConfigurar && api.guardarNombresNivel && (
                <Button variant="secondary" size="sm" icon={<Ico n="lapiz" size={14} />} onClick={() => setEditando(true)}>Nombres de los niveles</Button>
              )}
            </>
          )}
        </div>
        <div className="cmu-card">
          <div className="cmu-niveles">
            {r.niveles.map((n) => (
              <div key={n.nivel} className="cmu-nivel" data-mio={miNivel === n.nivel}>
                <span className="cmu-nivel-num">{miNivel != null && n.nivel > miNivel ? <Ico n="candado" size={13} /> : n.nivel}</span>
                <div className="cmu-nivel-txt">
                  <div className="cmu-nivel-nom">{rotuloNivel(n.nivel, comunidad.nombresNivel)}</div>
                  <div className="cmu-meta">{n.pct}% de los miembros</div>
                  {n.abre.length > 0 && <div className="cmu-chico cmu-dim">Abre: {n.abre.slice(0, 3).join(', ')}{n.abre.length > 3 ? ` y ${n.abre.length - 3} más` : ''}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cmu-tablas">
        <Tabla titulo="Últimos 7 días" filas={r.semana} />
        <Tabla titulo="Últimos 30 días" filas={r.mes} />
        <Tabla titulo="Total" filas={r.total} />
      </div>
      <span className="cmu-meta">Actualizado <Hace iso={r.actualizado} /></span>

      {editando && <EditorNiveles onCerrar={() => setEditando(false)} />}
    </div>
  );
}

/** Una tabla del ranking. Vacía dice que todavía nadie sumó, no un hueco. */
export function Tabla({ titulo, filas, compacta = false, pie }: { titulo: string; filas: readonly FilaRanking[]; compacta?: boolean; pie?: ReactNode }) {
  const { abrirPerfil } = useComunidad();
  return (
    <div className="cmu-card">
      <b className="cmu-card-tit">{titulo}</b>
      {filas.length === 0 && <p className="cmu-meta" style={{ margin: '6px 0 0' }}>Nadie sumó puntos todavía.</p>}
      {filas.map((f) => (
        <button key={f.miembro.clave} type="button" className="cmu-fila cmu-nombre-btn" style={{ width: '100%' }} onClick={() => abrirPerfil(f.miembro.clave)}>
          <span className="cmu-puesto">{f.puesto}</span>
          <AvatarNivel m={f.miembro} size={compacta ? 28 : 32} />
          <span className="cmu-fila-nom">{f.miembro.nombre}</span>
          <span className="cmu-mas">+{f.puntos}</span>
        </button>
      ))}
      {pie}
    </div>
  );
}

/** Los nombres de los 9 niveles (un admin). Vacío = «Nivel N». */
function EditorNiveles({ onCerrar }: { onCerrar: () => void }) {
  const { api, comunidad, setComunidad, aviso } = useComunidad();
  const [nombres, setNombres] = useState<string[]>(() => Array.from({ length: NIVEL_MAX }, (_, i) => comunidad.nombresNivel[i] ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!api.guardarNombresNivel) return;
    setGuardando(true);
    const r = await api.guardarNombresNivel(nombres);
    setGuardando(false);
    if (!r.ok) { setError(r.error); return; }
    setComunidad((c) => ({ ...c, nombresNivel: r.nombresNivel }));
    aviso('Niveles guardados');
    onCerrar();
  };

  return (
    <Modal titulo="Nombres de los niveles" ancho={520} onCerrar={onCerrar} sinFiletes
      pie={(
        <>
          <Button variant="tertiary" onClick={onCerrar}>No guardar</Button>
          <Button onClick={() => void guardar()} loading={guardando}>Guardar nombres</Button>
        </>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {nombres.map((n, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="cmu-nivel-num" style={{ flex: 'none' }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <Input value={n} maxLength={TOPE_NOMBRE_NIVEL} placeholder={nombreNivelDefault(i + 1)} aria-label={`Nombre del nivel ${i + 1}`}
                onChange={(e) => setNombres((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
            </span>
            <span className="cmu-meta" style={{ width: 72, textAlign: 'right' }}>{UMBRALES_NIVEL[i].toLocaleString('es')} pts</span>
          </label>
        ))}
        {error && <p className="cmu-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
