'use client';

// =============================================================================
// La ficha del lead en el teléfono: lo que se TOCA
// =============================================================================
// Las tres acciones rápidas (Llamar · WhatsApp · Agendar) y las dos de abajo (Nota ·
// Mover de etapa), cada una con su sheet. Lo que se lee (siguiente acción, llamada,
// respuestas) lo dibuja el server en page.tsx.
//
// ⚠️ AGENDAR NO PASA POR IA: las horas libres las lee /api/crm/horarios por código y
// se agenda con reagendarReunionAction (Google) o con la reserva de Calendly, que
// casi siempre devuelve un LINK de un solo uso para mandarle al lead. Cuál de los
// caminos lo decide el server (`modoAgenda`) mirando qué tiene conectado el negocio.
// La página que monta esto declara maxDuration = 60: reagendar puede tardar ~28 s.
//
// ⚠️ MOVER NUNCA MANDA calificado NI asistencia (van a Meta y no se deshacen), ni a
// Ganado, ni a una etapa que pide el wizard: eso es «en la computadora». La regla
// vive en reglas.ts y la acción la vuelve a mirar en el server.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import Link, { useRouter, useWs } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { FilaM, SheetM, useToastM, useConexion } from '@/app/m/_ui';
import { haptico } from '@/lib/haptico';
import { conWs } from '@/lib/ws-tab';
import { useDictadoVivo, unirDictado } from '@/app/plan/board/dictado-vivo';
import { duracionReunionAction, linkDeAgendaAction, reagendarReunionAction } from '@/app/crm/actions';
import { huecosR2Action, reservarR2Action } from '@/app/crm/agendar-r2-actions';
import { notaLeadAction, moverEtapaAction, deshacerMoverAction } from '../acciones';
import { chipsDeDia, rotuloAgendar, rotuloDia, type CualAgendar, type EtapaM } from '../reglas';

export type ProductoAcc = { funnelId: number; nombre: string; esCasa: boolean; etapa: string | null; etapaLabel: string | null; movibles: EtapaM[] };
export type ModoAgendaAcc = 'google' | 'calendly-r2' | 'link' | 'nada';

type Props = {
  id: number;
  nombre: string;
  email: string | null;
  tel: string | null;
  waMe: string | null;
  tieneChat: boolean;
  agenda: CualAgendar;
  modoAgenda: ModoAgendaAcc;
  hoy: string;
  productos: ProductoAcc[];
};

type Sheet = 'agendar' | 'nota' | 'mover' | null;

export function FichaAcciones(p: Props) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const { enLinea } = useConexion();
  const sinRed = !enLinea;

  return (
    <>
      <div className="mc-rapidas">
        {p.tel ? (
          <a className="mc-rapida" href={p.tel} aria-label={`Llamar a ${p.nombre}`}>
            <Icon name="closing" size={24} />Llamar
          </a>
        ) : (
          <span className="mc-rapida" aria-disabled="true" role="button" aria-label="Llamar: el lead no tiene teléfono">
            <Icon name="closing" size={24} />Llamar<span className="mc-rapida__nota">Sin teléfono</span>
          </span>
        )}
        {p.tieneChat ? (
          <Link className="mc-rapida" href={`/m/crm/${p.id}/chat`} aria-label={`Abrir el chat de WhatsApp con ${p.nombre}`}>
            <Icon name="whatsapp" size={24} />WhatsApp
          </Link>
        ) : p.waMe ? (
          <a className="mc-rapida" href={p.waMe} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp de tu teléfono con ${p.nombre}`}>
            <Icon name="whatsapp" size={24} />WhatsApp<span className="mc-rapida__nota">Desde tu teléfono</span>
          </a>
        ) : (
          <span className="mc-rapida" aria-disabled="true" role="button" aria-label="WhatsApp: el lead no tiene teléfono con código de país">
            <Icon name="whatsapp" size={24} />WhatsApp<span className="mc-rapida__nota">Sin número</span>
          </span>
        )}
        <button type="button" className="mc-rapida" onClick={() => setSheet('agendar')} aria-label={`${p.agenda.titulo} con ${p.nombre}`}>
          <Icon name="todo" size={24} />Agendar<span className="mc-rapida__nota">{p.agenda.titulo}</span>
        </button>
      </div>
      <div className="mc-secundarias">
        <Button variant="secondary" size="md" icon={<Icon name="notepencil" size={18} />} onClick={() => setSheet('nota')} disabled={sinRed}>
          Agregar nota
        </Button>
        <Button variant="secondary" size="md" icon={<Icon name="funnel" size={18} />} onClick={() => setSheet('mover')} disabled={sinRed || !p.productos.length}>
          Mover de etapa
        </Button>
      </div>

      <SheetAgendar {...p} abierto={sheet === 'agendar'} onCerrar={() => setSheet(null)} />
      <SheetNota id={p.id} abierto={sheet === 'nota'} onCerrar={() => setSheet(null)} />
      <SheetMover {...p} abierto={sheet === 'mover'} onCerrar={() => setSheet(null)} onAgendar={() => setSheet('agendar')} />
    </>
  );
}

// ── Agendar ───────────────────────────────────────────────────────────────────

type Slot = { hora: string; inicioIso: string; libre: boolean };
type Horarios = { fase: 'cargando' } | { fase: 'listo'; slots: Slot[]; verificado: boolean } | { fase: 'error'; error: string };
type Reserva = { fase: 'nada' } | { fase: 'link'; url: string } | { fase: 'guardada-sin-google' };

function SheetAgendar(p: Props & { abierto: boolean; onCerrar: () => void }) {
  const router = useRouter();
  const toast = useToastM();
  const ws = useWs();
  const { enLinea } = useConexion();
  const chips = chipsDeDia(p.hoy);
  const [fecha, setFecha] = useState(p.hoy);
  const [otroDia, setOtroDia] = useState(false);
  const [hora, setHora] = useState<string | null>(null);
  const [duracion, setDuracion] = useState<number | null>(null);
  const [horarios, setHorarios] = useState<Horarios>({ fase: 'cargando' });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reserva, setReserva] = useState<Reserva>({ fase: 'nada' });
  // Calendly R2: los huecos vienen agrupados por día desde Calendly.
  const [huecos, setHuecos] = useState<{ fase: 'cargando' } | { fase: 'listo'; dias: Array<{ dia: string; horas: Array<{ hora: string; startIso: string }> }> } | { fase: 'error'; error: string }>({ fase: 'cargando' });
  const [linkAgenda, setLinkAgenda] = useState<{ fase: 'cargando' } | { fase: 'listo'; url: string } | { fase: 'error'; error: string }>({ fase: 'cargando' });

  // Al abrir: la duración real de la reunión (Google) o los huecos (Calendly) o el link.
  useEffect(() => {
    if (!p.abierto) return;
    setError(null); setReserva({ fase: 'nada' }); setHora(null);
    if (p.modoAgenda === 'google' && duracion == null) {
      duracionReunionAction(p.id, p.agenda.cual).then(setDuracion).catch(() => setDuracion(45));
    }
    if (p.modoAgenda === 'calendly-r2') {
      setHuecos({ fase: 'cargando' });
      huecosR2Action().then((r) => setHuecos(r.ok ? { fase: 'listo', dias: r.dias } : { fase: 'error', error: 'No pude leer Calendly.' }))
        .catch(() => setHuecos({ fase: 'error', error: 'No pude leer Calendly.' }));
    }
    if (p.modoAgenda === 'link') {
      setLinkAgenda({ fase: 'cargando' });
      linkDeAgendaAction(p.agenda.cual === 'r1' ? 'agenda' : 'agendaj2')
        .then((r) => setLinkAgenda(r.url ? { fase: 'listo', url: r.url } : { fase: 'error', error: 'Sin link de agenda.' }))
        .catch(() => setLinkAgenda({ fase: 'error', error: 'Sin link de agenda.' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.abierto]);

  // Google: los horarios libres del día elegido, leídos por CÓDIGO.
  useEffect(() => {
    if (!p.abierto || p.modoAgenda !== 'google' || duracion == null) return;
    let vivo = true;
    setHorarios({ fase: 'cargando' }); setHora(null);
    fetch(`/api/crm/horarios?fecha=${fecha}&duracion=${duracion}`, { signal: AbortSignal.timeout(20_000) })
      .then((r) => r.json())
      .then((j: { ok: boolean; codigo?: string; slots?: Slot[]; error?: string }) => {
        if (!vivo) return;
        if (!j.ok) { setHorarios({ fase: 'error', error: 'No pude leer los horarios.' }); return; }
        const ahora = Date.now();
        setHorarios({ fase: 'listo', slots: (j.slots ?? []).filter((s) => Date.parse(s.inicioIso) > ahora), verificado: j.codigo === 'ok' });
      })
      .catch(() => { if (vivo) setHorarios({ fase: 'error', error: 'No pude leer los horarios.' }); });
    return () => { vivo = false; };
  }, [p.abierto, p.modoAgenda, fecha, duracion]);

  const agendarGoogle = async () => {
    if (!hora) return;
    setOcupado(true); setError(null);
    try {
      const r = await reagendarReunionAction(p.id, p.agenda.cual, fecha, hora, { duracionMin: duracion ?? undefined });
      if (r.ok) {
        haptico('success');
        toast('Agendada');
        p.onCerrar();
      } else {
        // La fecha del CRM se guardó igual; lo que no salió es la invitación de Google.
        haptico('error');
        setReserva({ fase: 'guardada-sin-google' });
      }
      router.refresh();
    } catch {
      haptico('error');
      setError('No se pudo agendar. Revisa la ficha antes de reintentar.');
      router.refresh();
    } finally {
      setOcupado(false);
    }
  };

  const reservarCalendly = async (startIso: string) => {
    setOcupado(true); setError(null);
    try {
      const r = await reservarR2Action(p.id, startIso);
      if (!r.ok) { haptico('error'); setError(r.error.slice(0, 120)); return; }
      haptico('success');
      if (r.modo === 'reserva') { toast('Agendada'); p.onCerrar(); router.refresh(); return; }
      setReserva({ fase: 'link', url: r.url });
    } catch {
      haptico('error'); setError('No se pudo reservar.');
    } finally {
      setOcupado(false);
    }
  };

  const verificado = horarios.fase === 'listo' && horarios.verificado;
  const libres = horarios.fase === 'listo' ? horarios.slots.filter((s) => !verificado || s.libre) : [];
  const diasCalendly = huecos.fase === 'listo' ? huecos.dias : [];
  const diaCalendly = diasCalendly.find((d) => d.dia === fecha) ?? diasCalendly[0] ?? null;

  let pie: React.ReactNode = null;
  if (reserva.fase === 'nada' && p.modoAgenda === 'google') {
    pie = (
      <>
        {hora && <p className="mc-consecuencia">{p.email ? `Le llega la invitación a ${p.nombre}.` : 'Sin email: no le llega invitación.'}</p>}
        {error && <p className="mc-error">{error}</p>}
        <Button variant="primary" size="lg" full loading={ocupado} disabled={!hora || !enLinea} onClick={agendarGoogle}>
          {hora ? rotuloAgendar(p.agenda, fecha, hora) : 'Elige un horario'}
        </Button>
      </>
    );
  } else if (reserva.fase === 'nada' && p.modoAgenda === 'calendly-r2' && hora && diaCalendly) {
    const h = diaCalendly.horas.find((x) => x.hora === hora);
    pie = (
      <>
        <p className="mc-consecuencia">Calendly suele dar un link para que {p.nombre} confirme.</p>
        {error && <p className="mc-error">{error}</p>}
        <Button variant="primary" size="lg" full loading={ocupado} disabled={!h || !enLinea} onClick={() => h && reservarCalendly(h.startIso)}>
          {rotuloAgendar(p.agenda, diaCalendly.dia, hora)}
        </Button>
      </>
    );
  }

  return (
    <SheetM id="agendar" abierto={p.abierto} onCerrar={p.onCerrar} titulo={p.agenda.titulo} snap="alto" ocupado={ocupado} pie={pie}>
      {reserva.fase === 'link' ? (
        <CompartirLink url={reserva.url} nombre={p.nombre} waMe={p.waMe} />
      ) : reserva.fase === 'guardada-sin-google' ? (
        <p className="mc-texto">Quedó en el CRM, pero la invitación de Google no salió. Revísala en la computadora.</p>
      ) : p.modoAgenda === 'google' ? (
        <>
          <div className="mc-chips" role="group" aria-label="Día">
            {chips.map((c) => (
              <button key={c.fecha} type="button" className="mc-chip" aria-pressed={!otroDia && fecha === c.fecha}
                onClick={() => { setOtroDia(false); setFecha(c.fecha); }}>{c.rotulo}</button>
            ))}
            {otroDia ? (
              <input type="date" className="mc-fecha" aria-label="Otro día" min={p.hoy} value={fecha}
                onChange={(e) => e.target.value && setFecha(e.target.value)} />
            ) : (
              <button type="button" className="mc-chip" aria-pressed={false} onClick={() => setOtroDia(true)}>Otro día</button>
            )}
          </div>
          {horarios.fase === 'cargando' ? (
            <div className="mc-grilla" aria-label="Cargando horarios">{Array.from({ length: 9 }, (_, i) => <span key={i} className="mc-skel-hora" />)}</div>
          ) : horarios.fase === 'error' ? (
            <p className="mc-error" style={{ marginTop: 16 }}>{horarios.error}</p>
          ) : libres.length === 0 ? (
            <p className="mc-sheet-nota">Sin horarios libres el {rotuloDia(fecha)}.</p>
          ) : (
            <>
              {!verificado && <p className="mc-sheet-nota">No pude leer tu agenda: revisa que la hora esté libre.</p>}
              <div className="mc-grilla" role="group" aria-label="Horario">
                {libres.map((s) => (
                  <button key={s.inicioIso} type="button" className="mc-hora" aria-pressed={hora === s.hora} onClick={() => setHora(s.hora)}>{s.hora}</button>
                ))}
              </div>
            </>
          )}
        </>
      ) : p.modoAgenda === 'calendly-r2' ? (
        huecos.fase === 'cargando' ? (
          <div className="mc-grilla" aria-label="Cargando horarios">{Array.from({ length: 9 }, (_, i) => <span key={i} className="mc-skel-hora" />)}</div>
        ) : huecos.fase === 'error' ? <p className="mc-error">{huecos.error}</p>
          : !diaCalendly ? <p className="mc-sheet-nota">Calendly no tiene horarios libres.</p>
          : (
            <>
              <div className="mc-chips" role="group" aria-label="Día">
                {diasCalendly.slice(0, 6).map((d) => (
                  <button key={d.dia} type="button" className="mc-chip" aria-pressed={diaCalendly.dia === d.dia}
                    onClick={() => { setFecha(d.dia); setHora(null); }}>{rotuloDia(d.dia)}</button>
                ))}
              </div>
              <div className="mc-grilla" role="group" aria-label="Horario">
                {diaCalendly.horas.map((h) => (
                  <button key={h.startIso} type="button" className="mc-hora" aria-pressed={hora === h.hora} onClick={() => setHora(h.hora)}>{h.hora}</button>
                ))}
              </div>
            </>
          )
      ) : p.modoAgenda === 'link' ? (
        linkAgenda.fase === 'cargando' ? <p className="mc-sheet-nota">Buscando el link de tu agenda…</p>
          : linkAgenda.fase === 'error' ? <p className="mc-error">{linkAgenda.error}</p>
          : (
            <>
              <p className="mc-texto">Mándale tu link de agenda y que elija el horario.</p>
              <CompartirLink url={linkAgenda.url} nombre={p.nombre} waMe={p.waMe} />
            </>
          )
      ) : (
        <>
          <p className="mc-texto">Este negocio no tiene una agenda conectada.</p>
          <div style={{ marginTop: 16 }}>
            <a className="mk-btn mk-btn--secondary mk-btn--lg mk-btn--full" href={conWs('/integraciones', ws)}>Conectar en la computadora</a>
          </div>
        </>
      )}
    </SheetM>
  );
}

function CompartirLink({ url, nombre, waMe }: { url: string; nombre: string; waMe: string | null }) {
  const toast = useToastM();
  const [puedeCompartir, setPuedeCompartir] = useState(false);
  useEffect(() => { setPuedeCompartir(typeof navigator !== 'undefined' && typeof navigator.share === 'function'); }, []);
  const texto = `Hola ${nombre.split(' ')[0]}, aquí puedes elegir el horario: ${url}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
      <div className="mc-link-largo">{url}</div>
      {puedeCompartir && (
        <Button variant="primary" size="lg" full onClick={() => { navigator.share({ text: texto }).catch(() => {}); }}>
          Compartir el link
        </Button>
      )}
      {waMe && (
        <a className="mk-btn mk-btn--secondary mk-btn--lg mk-btn--full" href={`${waMe}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">
          Mandarlo por WhatsApp
        </a>
      )}
      <Button variant="tertiary" size="lg" full onClick={() => {
        navigator.clipboard?.writeText(url).then(() => toast('Link copiado'), () => toast('No se pudo copiar'));
      }}>
        Copiar el link
      </Button>
    </div>
  );
}

// ── Nota ──────────────────────────────────────────────────────────────────────

function SheetNota({ id, abierto, onCerrar }: { id: number; abierto: boolean; onCerrar: () => void }) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = useRef('');
  const vivo = useDictadoVivo((t) => setTexto(unirDictado(base.current, t)), (m) => setError(m));

  const guardar = async () => {
    if (!texto.trim()) return;
    if (vivo.escuchando) vivo.parar();
    setOcupado(true); setError(null);
    try {
      const r = await notaLeadAction(id, texto);
      if (!r.ok) { haptico('error'); setError(r.error); return; }
      toast('Nota guardada');
      setTexto('');
      onCerrar();
    } catch {
      haptico('error'); setError('No se guardó');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <SheetM id="nota" abierto={abierto} onCerrar={() => { if (vivo.escuchando) vivo.parar(); onCerrar(); }} titulo="Nota" snap="alto" ocupado={ocupado}
      pie={(
        <>
          {error && <p className="mc-error">{error}</p>}
          <Button variant="primary" size="lg" full loading={ocupado} disabled={!texto.trim() || !enLinea} onClick={guardar}>Guardar nota</Button>
        </>
      )}>
      <textarea className="mc-area" aria-label="Texto de la nota" placeholder="Qué pasó, qué sigue…" value={texto}
        onChange={(e) => setTexto(e.target.value)} maxLength={4000} />
      {vivo.soportado && (
        <div className="mc-dictar">
          <Button variant={vivo.escuchando ? 'primary' : 'secondary'} size="md" icon={<Icon name="mic" size={18} />}
            onClick={() => {
              if (vivo.escuchando) { vivo.parar(); return; }
              base.current = texto;
              haptico('medium');
              vivo.arrancar();
            }}>
            {vivo.escuchando ? 'Parar el dictado' : 'Dictar la nota'}
          </Button>
        </div>
      )}
    </SheetM>
  );
}

// ── Mover de etapa ────────────────────────────────────────────────────────────

function SheetMover(p: Props & { abierto: boolean; onCerrar: () => void; onAgendar: () => void }) {
  const router = useRouter();
  const toast = useToastM();
  const ws = useWs();
  const { enLinea } = useConexion();
  const [fid, setFid] = useState<number | null>(p.productos[0]?.funnelId ?? null);
  const [destino, setDestino] = useState<EtapaM | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prod = p.productos.find((x) => x.funnelId === fid) ?? p.productos[0] ?? null;

  useEffect(() => { if (p.abierto) { setDestino(null); setError(null); } }, [p.abierto]);

  const mover = async () => {
    if (!prod || !destino) return;
    setOcupado(true); setError(null);
    try {
      const r = await moverEtapaAction(p.id, prod.funnelId, destino.key);
      if (!r.ok) { haptico('error'); setError(r.error); return; }
      const antes = r.antes;
      const esCasa = r.esCasa;
      const funnelId = prod.funnelId;
      p.onCerrar();
      router.refresh();
      toast(r.pendientes.length ? 'Movido · faltan datos' : 'Movido', {
        deshacer: () => {
          deshacerMoverAction(p.id, funnelId, antes, esCasa)
            .then((d) => { toast(d.ok ? 'Deshecho' : d.error); router.refresh(); })
            .catch(() => toast('No se pudo deshacer'));
        },
      });
    } catch {
      haptico('error'); setError('No se pudo mover');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <SheetM id="mover" abierto={p.abierto} onCerrar={p.onCerrar} titulo={destino ? `Mover a ${destino.label}` : 'Mover de etapa'} snap="alto" ocupado={ocupado}
      pie={destino ? (
        <>
          <p className="mc-consecuencia">Pasa de {prod?.etapaLabel ?? 'su etapa'} a {destino.label}. Queda en el historial.</p>
          {error && <p className="mc-error">{error}</p>}
          <Button variant="primary" size="lg" full loading={ocupado} disabled={!enLinea} onClick={mover}>Mover a {destino.label}</Button>
          <Button variant="tertiary" size="lg" full disabled={ocupado} onClick={() => setDestino(null)}>Elegir otra etapa</Button>
        </>
      ) : undefined}>
      {p.productos.length > 1 && !destino && (
        <div className="mc-productos" role="group" aria-label="Funnel">
          {p.productos.map((x) => (
            <button key={x.funnelId} type="button" className="mc-chip" aria-pressed={x.funnelId === prod?.funnelId} onClick={() => setFid(x.funnelId)}>
              {x.nombre}
            </button>
          ))}
        </div>
      )}
      {!destino && prod && (
        <>
          <p className="mc-meta" style={{ marginBottom: 8 }}>Ahora: {prod.etapaLabel ?? 'sin etapa'}</p>
          {prod.movibles.length ? (
            <div className="m-lista">
              {prod.movibles.map((e) => (
                <FilaM key={e.key} titulo={e.label} onClick={() => setDestino(e)} />
              ))}
            </div>
          ) : <p className="mc-sheet-nota">No hay otra etapa disponible aquí.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <Button variant="secondary" size="lg" full onClick={p.onAgendar}>Agendar una reunión</Button>
            <a className="mk-btn mk-btn--tertiary mk-btn--lg mk-btn--full" href={conWs(`/crm/${p.id}`, ws)}>Ganado y reuniones: en la computadora</a>
          </div>
        </>
      )}
    </SheetM>
  );
}
