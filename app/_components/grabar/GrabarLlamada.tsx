'use client';

// =============================================================================
// Grabar una llamada: el panel de la ficha del lead (escritorio y teléfono) y de Cold Calling (04/11/2026)
// =============================================================================
// Martín: «quiero que implementes el botón de "grabar" en el detail de un lead y en un dashboard template que sea "Call
// Calling"». Lo que graba es la grabadora del módulo (./grabadora.ts): cerrar este panel NO corta la llamada, y el indicador de
// la esquina (`GrabacionEnCurso`) la deja cortar desde cualquier pantalla.
//
// Lo que no se ve en la firma:
//   · ANTES DE GRABAR, dos líneas: «Avísale que estás grabando» (grabar a alguien pide avisarle en muchos países) y lo que en ESTE
//     aparato NO se puede grabar (lib/grabar-llamada-reglas.ts → `queSeGraba`). Nada más.
//   · AL CORTAR, «¿Cómo terminó?» con cuatro opciones: un toque, y es lo que cuenta Cold Calling. No se adivina.
//   · LO DE DESPUÉS CORRE EN EL SERVER (transcribir y analizar con la IA del negocio). La lista dice en qué va y vuelve a
//     preguntar sola mientras alguna sigue trabajando; la persona puede cerrar y seguir con otra cosa.
//   · Sin IA conectada no se rompe nada: el audio queda, la fila lo dice y ofrece conectar la IA ahí mismo (sin salir de la tab).
//   · Sin `Modal` ni piezas de escritorio adentro: el MISMO panel va en la hoja del teléfono (app/m/crm/[id]/FichaLead.tsx).
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/app/_ui/Modal';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import {
  AVISO_CONSENTIMIENTO, ROTULO_ESTADO, ROTULO_RESULTADO, SIN_CLAUDE_PARA_ANALIZAR, SIN_IA_PARA_TRANSCRIBIR, duracionTexto,
  sePuedeReintentar, sigueTrabajando, type EstadoGrabacion, type OrigenGrabacion, type ResultadoLlamada,
} from '@/lib/grabar-llamada-reglas';
import {
  cortar, decirResultado, empezar, grabaAOtro, queSeGrabaAca, reintentarSubida, soltarGrabacion, useGrabadora, type EstadoGrabadora,
} from './grabadora';
import { ComoTermino, Punto, Reloj, boton, chip } from './piezas';

const RUTA = '/api/crm/llamadas-grabadas';

type Grabacion = {
  id: string; estado: EstadoGrabacion; origen: OrigenGrabacion; autor: string | null; duracion_seg: number | null; created_at: string;
  resultado: ResultadoLlamada | null; motivo: string | null; fuente: string;
  partes: Array<{ n: number; inicio_seg: number; estado: string; texto: string | null; url: string | null }>;
};

// ── Piezas chicas ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const linea: CSSProperties = { margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--dim)' };

// ── El control: empezar, el reloj, cortar ─────────────────────────────────────────────────────────────────────────────────

function Control({ g, leadId, leadNombre, origen }: { g: EstadoGrabadora; leadId: number; leadNombre: string; origen: OrigenGrabacion }) {
  const [conPestana, setConPestana] = useState(true);
  // Lo del aparato se mide al montar (en el server no hay navegador).
  const [que, setQue] = useState<ReturnType<typeof queSeGrabaAca> | null>(null);
  useEffect(() => { setQue(queSeGrabaAca()); }, []);
  const esEste = g.leadId === leadId;

  if (grabaAOtro(g, leadId)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ ...linea, color: 'var(--ink)' }}>Ya estás grabando la llamada con {g.leadNombre}. Córtala para grabar otra.</p>
        <div><button type="button" style={boton('rojo')} onClick={() => void cortar()}>Cortar</button></div>
      </div>
    );
  }

  if (esEste && (g.fase === 'grabando' || g.fase === 'pidiendo' || g.fase === 'cerrando')) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
          <Punto />
          {g.fase === 'pidiendo' ? <span style={{ fontSize: 15 }}>Pidiendo el micrófono…</span> : g.fase === 'cerrando' ? <span style={{ fontSize: 15 }}>Guardando el audio…</span> : <Reloj desde={g.desde} />}
        </div>
        {g.aviso && <p style={linea}>{g.aviso}</p>}
        {g.fase === 'grabando' && <div><button type="button" style={boton('rojo')} onClick={() => void cortar()}>Cortar</button></div>}
      </div>
    );
  }

  if (esEste && g.fase === 'cerrada') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {g.error ? (
          <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ ...linea, color: 'var(--bad)' }}>{g.error}</p>
            {g.pendientes > 0 && <div><button type="button" style={boton('oscuro')} onClick={() => void reintentarSubida()}>Volver a subir</button></div>}
            <ReportarASoporte />
          </div>
        ) : (
          <p style={{ ...linea, color: 'var(--ink)' }}>Grabada ({duracionTexto(g.segundos)}). MaKo la transcribe y la analiza: puedes seguir con otra cosa.</p>
        )}
        <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--ink)' }}>¿Cómo terminó?</div>
        <ComoTermino valor={g.resultado} onElegir={(r) => void decirResultado(r)} />
        {!g.pendientes && <div><button type="button" style={boton('claro')} onClick={() => soltarGrabacion()}>Grabar otra</button></div>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{AVISO_CONSENTIMIENTO}</p>
      {que && <p style={linea}>{que.linea}</p>}
      {que?.ofrecePestana && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={conPestana} onChange={(e) => setConPestana(e.target.checked)} />
          Grabar también la pestaña de la llamada
        </label>
      )}
      {esEste && g.error && <div role="alert" style={{ ...linea, color: 'var(--bad)' }}>{g.error}<ReportarASoporte /></div>}
      <div>
        <button
          type="button"
          style={boton('rojo')}
          disabled={que != null && !que.puede}
          onClick={() => void empezar({ leadId, leadNombre, origen, conPestana: !!que?.ofrecePestana && conPestana })}
        >
          <IconoMenu nombre="grabar" size={18} /> Empezar a grabar
        </button>
      </div>
    </div>
  );
}

// ── Las grabaciones del lead ──────────────────────────────────────────────────────────────────────────────────────────────

/** Las partes de una grabación, una tras otra (cada una es su archivo). */
function Reproductor({ partes }: { partes: Grabacion['partes'] }) {
  const urls = partes.filter((p) => p.url).map((p) => p.url!) ;
  const [i, setI] = useState(0);
  const ref = useRef<HTMLAudioElement>(null);
  const siguiente = () => { if (i + 1 < urls.length) { setI(i + 1); setTimeout(() => ref.current?.play().catch(() => {}), 0); } };
  if (!urls.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <audio ref={ref} src={urls[i]} controls preload="none" onEnded={siguiente} style={{ width: '100%', height: 36 }} />
      {urls.length > 1 && <span style={{ fontSize: 12, color: 'var(--faint)', flex: 'none' }}>{i + 1}/{urls.length}</span>}
    </div>
  );
}

function FilaGrabacion({ x, onCambio }: { x: Grabacion; onCambio: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const texto = x.partes.filter((p) => p.texto).map((p) => `[${duracionTexto(p.inicio_seg)}] ${p.texto}`).join('\n\n');
  const fecha = new Date(x.created_at);
  const cuando = Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const reintentar = async () => {
    setTrabajando(true);
    try { await fetch(RUTA, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accion: 'reintentar', id: x.id }) }); }
    finally { setTrabajando(false); onCambio(); }
  };
  const resultado = async (r: ResultadoLlamada) => {
    await fetch(RUTA, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accion: 'resultado', id: x.id, resultado: r }) }).catch(() => {});
    onCambio();
  };
  const tono = x.estado === 'error' ? 'var(--bad)' : x.estado === 'sin_ia' ? 'var(--warn)' : x.estado === 'lista' ? 'var(--good)' : 'var(--dim)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cuando} · {duracionTexto(x.duracion_seg)}{x.resultado ? ` · ${ROTULO_RESULTADO[x.resultado]}` : ''}
          </div>
          {x.autor && <div style={{ fontSize: 12, color: 'var(--faint)' }}>{x.autor}</div>}
        </div>
        <span style={{ flex: 'none', fontSize: 12, fontWeight: 650, color: tono }}>{ROTULO_ESTADO[x.estado]}</span>
      </div>
      {x.motivo && (
        <div role={x.estado === 'error' ? 'alert' : undefined} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{x.motivo}</span>
          {/* Conectar va acá mismo, con el modal de «Tus cuentas de IA» (AGENTS.md: para conectar no se sale de la tab). */}
          {(x.motivo === SIN_IA_PARA_TRANSCRIBIR || x.motivo === SIN_CLAUDE_PARA_ANALIZAR) && (
            <button type="button" style={{ ...chip(false), minHeight: 32 }} onClick={() => setConectando(true)}>
              {x.motivo === SIN_IA_PARA_TRANSCRIBIR ? 'Conectar mi IA' : 'Conectar mi Claude'}
            </button>
          )}
          {(sePuedeReintentar(x.estado) || x.motivo === SIN_CLAUDE_PARA_ANALIZAR) && (
            <button type="button" style={{ ...chip(false), minHeight: 32 }} disabled={trabajando} onClick={() => void reintentar()}>Volver a intentar</button>
          )}
          <ReportarASoporte />
        </div>
      )}
      {!x.resultado && x.estado !== 'grabando' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>¿Cómo terminó?</span>
          <ComoTermino valor={null} onElegir={(r) => void resultado(r)} />
        </div>
      )}
      {conectando && typeof document !== 'undefined' && createPortal(
        <Modal titulo="Tus cuentas de IA" anidada onCerrar={() => setConectando(false)} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>,
        document.body,
      )}
      <Reproductor partes={x.partes} />
      {texto && (
        <div>
          <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta}
            style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--link, var(--ink))', cursor: 'pointer' }}>
            {abierta ? 'Ocultar la transcripción' : 'Ver la transcripción'}
          </button>
          {abierta && <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', font: 'inherit', fontSize: 13, lineHeight: 1.55, color: 'var(--ink)', maxHeight: 320, overflowY: 'auto' }}>{texto}</pre>}
        </div>
      )}
    </div>
  );
}

function ListaGrabaciones({ leadId, version }: { leadId: number; version: number }) {
  const [lista, setLista] = useState<Grabacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const leer = useCallback(async () => {
    try {
      const r = await fetch(`${RUTA}?leadId=${leadId}`, { signal: AbortSignal.timeout(20_000) });
      const j = (await r.json()) as { ok: boolean; grabaciones?: Grabacion[]; error?: string };
      if (!j.ok) { setError(j.error ?? 'No pude leer las grabaciones.'); return; }
      setError(null);
      setLista(j.grabaciones ?? []);
    } catch { setError('No pude leer las grabaciones.'); }
  }, [leadId]);
  useEffect(() => { void leer(); }, [leer, version, vuelta]);
  // Mientras alguna sigue trabajando (transcribir, analizar), vuelve a preguntar cada 8 s.
  useEffect(() => {
    if (!lista?.some((x) => sigueTrabajando(x.estado))) return;
    const t = setTimeout(() => setVuelta((v) => v + 1), 8000);
    return () => clearTimeout(t);
  }, [lista]);
  if (error) return <div role="alert" style={{ ...linea, color: 'var(--bad)' }}>{error}<ReportarASoporte /></div>;
  if (!lista || !lista.length) return null;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 650, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 2 }}>Grabadas</div>
      {lista.map((x) => <FilaGrabacion key={x.id} x={x} onCambio={() => setVuelta((v) => v + 1)} />)}
    </div>
  );
}

/** El panel entero: el control y las grabaciones de este lead. */
export function PanelGrabar({ leadId, leadNombre, origen = 'ficha', conLista = true }: { leadId: number; leadNombre: string; origen?: OrigenGrabacion; conLista?: boolean }) {
  const g = useGrabadora();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Control g={g} leadId={leadId} leadNombre={leadNombre} origen={origen} />
      {conLista && <ListaGrabaciones leadId={leadId} version={g.version} />}
    </div>
  );
}

// ── El botón de la cabecera de la ficha (escritorio) ──────────────────────────────────────────────────────────────────────

/**
 * «Grabar», al lado del funnel en la cabecera de la ficha (el pop-up y la ruta). Abre el panel en un Modal `anidada` portaleado al
 * <body>: la ficha del pop-up ya es un Modal, y lo de adentro de su DOM se apagaría con ella. Mientras graba a este lead, el botón
 * es el reloj.
 */
export function BotonGrabar({ leadId, leadNombre }: { leadId: number; leadNombre: string }) {
  const g = useGrabadora();
  const [abierto, setAbierto] = useState(false);
  const grabandoEste = g.leadId === leadId && (g.fase === 'grabando' || g.fase === 'pidiendo');
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={grabandoEste ? 'Grabando: abrir la grabación' : `Grabar la llamada con ${leadNombre}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 10, font: 'inherit', fontSize: 13,
          fontWeight: 650, cursor: 'pointer', border: '1px solid var(--border-strong)', background: grabandoEste ? 'var(--bad)' : 'var(--surface)',
          color: grabandoEste ? 'var(--surface)' : 'var(--ink)', whiteSpace: 'nowrap',
        }}
      >
        {grabandoEste ? <><Punto /><Reloj desde={g.desde} /></> : <><IconoMenu nombre="grabar" size={16} /> Grabar</>}
      </button>
      {abierto && typeof document !== 'undefined' && createPortal(
        <Modal titulo="Grabar llamada" anidada onCerrar={() => setAbierto(false)} ancho={520}>
          <PanelGrabar leadId={leadId} leadNombre={leadNombre} />
        </Modal>,
        document.body,
      )}
    </>
  );
}

