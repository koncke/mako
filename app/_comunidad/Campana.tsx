'use client';

// =============================================================================
// Campana — las notificaciones de la comunidad (el equipo y el alumno)
// =============================================================================
// Skool (relevo, B.3): una campana con un globito de no leídas. Avisa de un like en lo tuyo (agrupados:
// «Ana y 3 más»), un comentario en tu post, una respuesta a tu comentario, una mención, un comentario
// nuevo en un post que sigues y un evento que empieza pronto. Tocar un aviso lo marca leído y lleva a lo
// suyo; arriba, «Marcar todas como leídas».
//
// Se refresca sola cada minuto mientras la pestaña está a la vista (no hay push todavía), y al abrirla.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '@/app/_ui';
import type { CampanaVista, NotificacionVista } from '@/lib/comunidad-tipos';
import { AvatarNivel, CapaPopover, Hace, Ico, useComunidad } from './piezas';
import { diaCortoEn, fechaEn, hoyEn, horaEn, zonaDelNavegador } from './tiempo';

const REFRESCO_MS = 60_000;

/** «Ana», «Ana y Luis», «Ana y 3 más». */
function quienes(n: NotificacionVista): string {
  const [a, b] = n.quienes.map((m) => m.nombre);
  if (!a) return 'Alguien';
  if (n.total <= 1) return a;
  if (n.total === 2 && b) return `${a} y ${b}`;
  return `${a} y ${n.total - 1} más`;
}

/** Cuándo empieza un evento, corto y en la hora de quien mira: «hoy 18:00», «mañana 9:30», «jue 15 oct 18:00». */
function cuando(iso: string | null): string {
  if (!iso) return 'pronto';
  const zona = zonaDelNavegador();
  const f = fechaEn(iso, zona);
  const hoy = hoyEn(zona);
  const [y, m, d] = hoy.split('-').map(Number);
  const manana = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const dia = f === hoy ? 'hoy' : f === manana ? 'mañana' : diaCortoEn(iso, zona);
  return `${dia} ${horaEn(iso, zona)}`;
}

/** El texto de un aviso. Corto: es un renglón de una lista (AGENTS.md, «el texto que se dibuja»). */
export function textoDeAviso(n: NotificacionVista): string {
  const t = n.postTitulo ? `«${n.postTitulo}»` : 'un post';
  switch (n.tipo) {
    case 'like': return `${quienes(n)} ${n.total > 1 ? 'dieron' : 'dio'} like a ${n.comentarioId ? `tu comentario en ${t}` : `tu post ${t}`}`;
    case 'comentario': return `${quienes(n)} comentó tu post ${t}`;
    case 'respuesta': return `${quienes(n)} te respondió en ${t}`;
    case 'mencion': return `${quienes(n)} te mencionó en ${t}`;
    case 'post_seguido': return `${quienes(n)} comentó en ${t}`;
    case 'evento': return `«${n.eventoTitulo ?? 'Un evento'}» empieza ${cuando(n.ocurrencia)}`;
  }
}

export function Campana() {
  const { api, abrirPost, abrirEvento, aviso } = useComunidad();
  const [abierta, setAbierta] = useState(false);
  const [datos, setDatos] = useState<CampanaVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    const r = await api.campana();
    if (r.ok) { setDatos(r.campana); setError(null); } else setError(r.error);
  }, [api]);

  useEffect(() => {
    let vivo = true;
    const tick = () => { if (vivo && document.visibilityState === 'visible') void cargar(); };
    const primera = setTimeout(tick, 0);
    const t = setInterval(tick, REFRESCO_MS);
    return () => { vivo = false; clearTimeout(primera); clearInterval(t); };
  }, [cargar]);

  const marcarLocal = (ids: number[] | 'todas') => setDatos((d) => {
    if (!d) return d;
    const items = d.items.map((n) => (ids === 'todas' || n.ids.some((x) => ids.includes(x)) ? { ...n, leida: true } : n));
    return { items, sinLeer: items.filter((n) => !n.leida).length };
  });

  const ir = (n: NotificacionVista) => {
    if (!n.leida) {
      marcarLocal(n.ids);
      void api.leerCampana(n.ids);
    }
    setAbierta(false);
    if (n.tipo === 'evento' && n.eventoId != null) abrirEvento(n.eventoId, n.ocurrencia);
    else if (n.postId != null) abrirPost(n.postId);
  };

  const todas = async () => {
    marcarLocal('todas');
    const r = await api.leerCampana('todas');
    if (!r.ok) { aviso(r.error); void cargar(); }
  };

  const sinLeer = datos?.sinLeer ?? 0;
  return (
    <div className="cmu-campana" ref={ref}>
      <button type="button" className="cmu-icono-btn" aria-label={sinLeer ? `Notificaciones, ${sinLeer} sin leer` : 'Notificaciones'}
        aria-expanded={abierta} onClick={() => { setAbierta((x) => !x); if (!abierta) void cargar(); }}>
        <Ico n="campana" size={20} />
        {sinLeer > 0 && <span className="cmu-globito">{sinLeer > 9 ? '9+' : sinLeer}</span>}
      </button>
      {/* Afuera y Escape cierran, y como CAPA: un Escape no se lleva puesto lo que haya abajo. */}
      {abierta && <CapaPopover caja={ref} onCerrar={() => setAbierta(false)} />}
      {abierta && (
        <div className="cmu-campana-panel" role="dialog" aria-label="Notificaciones">
          <div className="cmu-campana-cab">
            <b>Notificaciones</b>
            {sinLeer > 0 && <button type="button" className="cmu-accion" onClick={() => void todas()}>Marcar todas como leídas</button>}
          </div>
          {error && !datos && <p className="cmu-error" role="alert" style={{ padding: '8px 12px' }}>{error}</p>}
          {!datos && !error && <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}><Spinner /></div>}
          {datos && datos.items.length === 0 && <p className="cmu-meta" style={{ padding: '12px 14px', margin: 0 }}>Sin notificaciones.</p>}
          <div className="cmu-campana-lista">
            {datos?.items.map((n) => (
              <button key={n.ids[0]} type="button" className="cmu-aviso" data-leida={n.leida || undefined} onClick={() => ir(n)}>
                {n.tipo === 'evento' || !n.quienes[0]
                  ? <span className="cmu-aviso-ico" aria-hidden><Ico n="calendario" size={18} /></span>
                  : <AvatarNivel m={n.quienes[0]} size={34} sinNivel />}
                <span className="cmu-aviso-txt">
                  <span>{textoDeAviso(n)}</span>
                  <span className="cmu-meta"><Hace iso={n.creado} /></span>
                </span>
                {!n.leida && <span className="cmu-aviso-punto" aria-label="Sin leer" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
