'use client';

// =============================================================================
// Comunidad — la comunidad tipo Skool de un producto (la misma para el equipo y para el alumno)
// =============================================================================
// Pedido de Martín (07/10/2026, item 10), textual: «quiero implementar una nueva tab dentro del
// desplegable de la sidebar de Customer Success, que sea Comunidad, replica lo que tiene skool tal
// cual, todas las funcionalidades de comunidad.» Las decisiones, en docs/diseno-curso-skool.md (D8).
//
// Las pestañas de un grupo de Skool, en su orden: Comunidad (el feed con la columna lateral: los datos
// de la comunidad y el ranking de 30 días), Calendario, Miembros, Ranking (Leaderboards) y About. A la
// derecha, la búsqueda (posts y miembros) y la campana de notificaciones.
//
// La montan dos pantallas con dos pieles y dos caminos al server (./api.ts):
//   · el EQUIPO: app/customer-success/comunidad/ComunidadEquipo.tsx (server actions, tokens de la app);
//   · el ALUMNO: ./ComunidadAlumno.tsx (POST con el token de su link, la paleta del portal del curso).
//
// ⚠️ LA MODERACIÓN SE OFRECE SÓLO SI EL SERVER DIJO QUE SE PUEDE (`puedoModerar`) Y LA API LA TIENE
//    (la del alumno no la trae). Esconderla no protege nada: el server vuelve a preguntar.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Spinner, Toast, useConfirm, useToast } from '@/app/_ui';
import type { ComunidadVista, FeedVista, MiembroVista } from '@/lib/comunidad-tipos';
import type { ApiComunidad } from './api';
import { CSS_COMUNIDAD } from './estilos';
import { Feed } from './Feed';
import { Miembros, PerfilModal, SacarModal } from './Miembros';
import { Ranking, Tabla } from './Ranking';
import { Calendario } from './Calendario';
import { About } from './About';
import { Campana } from './Campana';
import { Busqueda } from './Busqueda';
import { Ctx, Ico, useComunidad, type CtxComunidad, type Tema } from './piezas';

type Pestana = 'comunidad' | 'calendario' | 'miembros' | 'ranking' | 'about';
const PESTANAS: Array<{ id: Pestana; label: string }> = [
  { id: 'comunidad', label: 'Comunidad' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'miembros', label: 'Miembros' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'about', label: 'About' },
];

/** Cada cuánto el alumno avisa que sigue acá (la ventana de «en línea» es de 5 minutos). */
const LATIDO_MS = 90_000;

export function Comunidad({ api, tema, inicial = null, cabecera, aviso: avisoArriba, postInicial = null }: {
  api: ApiComunidad;
  tema: Tema;
  /** Lo que ya trae el HTML (el equipo). Sin esto, se pide al montar (el alumno). */
  inicial?: { comunidad: ComunidadVista; feed: FeedVista } | null;
  /** Lo que va a la derecha de las pestañas (el selector de producto del equipo). */
  cabecera?: ReactNode;
  /** Una línea arriba de todo (la lista del onboarding de la tab del equipo). */
  aviso?: ReactNode;
  /**
   * Un post para abrir al entrar: el link de la ficha a lo que un alumno publicó o comentó desde una
   * tarea (item 17 del 08/10/2026, `?post=`). Es el mismo camino que abrirlo desde la campana.
   */
  postInicial?: number | null;
}) {
  const [datos, setDatos] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>('comunidad');
  const [perfil, setPerfil] = useState<string | null>(null);
  const [postPedido, setPostPedido] = useState<number | null>(postInicial);
  const [eventoPedido, setEventoPedido] = useState<{ id: number; ocurrencia: string | null } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [sacando, setSacando] = useState<Pick<MiembroVista, 'clave' | 'nombre'> | null>(null);
  // Sube cuando la moderación cambia quién está (o borra lo suyo): el feed y los miembros se recargan.
  const [version, setVersion] = useState(0);
  // ⚠️ EL RELOJ ARRANCA EN `null` Y SE PRENDE AL MONTAR: la tab del equipo llega dibujada desde el
  // server, y un «hace 3 min» calculado allá y otro acá (o un `toLocaleString` en la zona del server)
  // no coinciden al hidratar. Sin reloj, los «hace cuánto» no se dibujan hasta el primer efecto.
  const [ahora, setAhora] = useState<number | null>(null);
  const { toast, show, clear } = useToast();
  const { confirm, confirmNode } = useConfirm();

  // Sin lo del HTML, se pide al montar.
  useEffect(() => {
    if (inicial) return;
    let vivo = true;
    void api.inicio().then((r) => {
      if (!vivo) return;
      if (r.ok) setDatos({ comunidad: r.comunidad, feed: r.feed }); else setError(r.error);
    });
    return () => { vivo = false; };
  }, [api, inicial]);

  // El reloj de los «hace cuánto». La primera lectura va en un timeout y no suelta en el efecto: un
  // `setState` sincrónico adentro de un efecto es un render en cascada (react-hooks/set-state-in-effect).
  useEffect(() => {
    const primera = setTimeout(() => setAhora(Date.now()), 0);
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => { clearTimeout(primera); clearInterval(t); };
  }, []);

  // «En línea»: mientras la pestaña está a la vista, cada tanto se avisa que sigue acá.
  useEffect(() => {
    if (!api.latido) return;
    const latir = () => { if (document.visibilityState === 'visible') void api.latido?.(); };
    const t = setInterval(latir, LATIDO_MS);
    document.addEventListener('visibilitychange', latir);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', latir); };
  }, [api]);

  const setComunidad = useCallback((f: (c: ComunidadVista) => ComunidadVista) => {
    setDatos((d) => (d ? { ...d, comunidad: f(d.comunidad) } : d));
  }, []);

  const puedeSacar = !!datos?.comunidad.puedoModerar && !!api.sacar;
  const ctx = useMemo<CtxComunidad | null>(() => (datos ? {
    api, tema, comunidad: datos.comunidad, setComunidad, ahora,
    abrirPerfil: (clave) => setPerfil(clave),
    abrirPost: (id) => { setPestana('comunidad'); setPostPedido(id); },
    abrirEvento: (id, ocurrencia) => { setPestana('calendario'); setEventoPedido({ id, ocurrencia }); },
    sacar: puedeSacar ? (m) => setSacando({ clave: m.clave, nombre: m.nombre }) : null,
    aviso: (m) => show(m),
    confirmar: (m, o) => confirm(m, { ...o, danger: true }),
  } : null), [api, tema, datos, setComunidad, ahora, show, confirm, puedeSacar]);

  const raiz = `cmu cmu--${tema}`;
  if (!ctx || !datos) {
    return (
      <div className={raiz}>
        <style dangerouslySetInnerHTML={{ __html: CSS_COMUNIDAD }} />
        {error ? <p className="cmu-error" role="alert">{error}</p> : <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}><Spinner /></div>}
      </div>
    );
  }

  return (
    <Ctx.Provider value={ctx}>
      <div className={raiz}>
        <style dangerouslySetInnerHTML={{ __html: CSS_COMUNIDAD }} />
        {avisoArriba}
        <nav className="cmu-tabs" aria-label="Comunidad">
          {PESTANAS.map((p) => (
            <button key={p.id} type="button" className="cmu-tab" data-on={pestana === p.id} aria-current={pestana === p.id ? 'page' : undefined}
              onClick={() => setPestana(p.id)}>
              {p.label}
            </button>
          ))}
          <div className="cmu-tabs-extra">
            <button type="button" className="cmu-icono-btn" aria-label="Buscar" onClick={() => setBuscando(true)}><Ico n="lupa" size={20} /></button>
            <Campana />
            {cabecera}
          </div>
        </nav>

        {/* `display: none` y no desmontar: volver al feed no pierde lo cargado ni el filtro elegido. */}
        <div className="cmu-grid" style={{ display: pestana === 'comunidad' ? undefined : 'none' }}>
          <Feed inicial={datos.feed} postPedido={postPedido} onPostAbierto={() => setPostPedido(null)} version={version} />
          <Lateral onRanking={() => setPestana('ranking')} />
        </div>
        {pestana === 'calendario' && <Calendario pedido={eventoPedido} onPedidoAbierto={() => setEventoPedido(null)} />}
        {pestana === 'miembros' && <Miembros version={version} />}
        {pestana === 'ranking' && <Ranking />}
        {pestana === 'about' && <About />}

        {perfil && <PerfilModal key={perfil} clave={perfil} onCerrar={() => setPerfil(null)} />}
        {buscando && <Busqueda onCerrar={() => setBuscando(false)} />}
        {sacando && (
          <SacarModal miembro={sacando} onCerrar={() => setSacando(null)}
            onListo={() => { setSacando(null); setVersion((v) => v + 1); }} />
        )}
        {confirmNode}
        <Toast state={toast} onClose={clear} />
      </div>
    </Ctx.Provider>
  );
}

/** La columna lateral: la comunidad (nombre, descripción, miembros, en línea, equipo) y el top de 30 días. */
function Lateral({ onRanking }: { onRanking: () => void }) {
  const { comunidad } = useComunidad();
  const c = comunidad.conteos;
  return (
    <aside className="cmu-aside">
      <div className="cmu-card">
        <b className="cmu-card-tit">{comunidad.nombre}</b>
        {comunidad.descripcion && <p className="cmu-dim cmu-chico" style={{ margin: 0 }}>{comunidad.descripcion}</p>}
        <div className="cmu-stats">
          <span className="cmu-stat"><b>{c ? c.miembros : '—'}</b><span>Miembros</span></span>
          <span className="cmu-stat"><b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{c ? c.enLinea : '—'}{c && c.enLinea > 0 && <span className="cmu-punto" aria-hidden />}</b><span>En línea</span></span>
          <span className="cmu-stat"><b>{c ? c.equipo : '—'}</b><span>Equipo</span></span>
        </div>
      </div>
      {comunidad.top30 && <Tabla titulo="Ranking (30 días)" filas={comunidad.top30} compacta pie={
        <button type="button" className="cmu-accion" style={{ marginTop: 6 }} onClick={onRanking}>Ver ranking</button>
      } />}
    </aside>
  );
}
