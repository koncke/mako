'use client';

// =============================================================================
// /newsletters — la tab del Newsletter: MaKo pregunta, los suscriptos (un CRM) y las ediciones
// =============================================================================
// Aprobado por Martín el 29/10/2026 («Sí, armalo así»). El modelo, en lib/newsletter-reglas.ts.
//   · ARRANCA CON MaKo TOMANDO LA INICIATIVA (AGENTS.md, «mako-toma-la-iniciativa»): una pregunta por vez con sus
//     pastillas —cada cuánto, de qué trata—, armadas sin IA. La IA del negocio entra cuando contesta: la idea de la
//     próxima edición (lib/newsletter-ia.ts). Sin IA, sigue el camino de siempre: escribirla en el Copywriter.
//   · LOS SUSCRIPTOS son el CRM «Newsletter»: acá se ven por etapa y se abre el tablero. Entran por una landing (el
//     interruptor de cada una), por importación o trayéndolos de otro CRM (el modal del CRM, después de decir que hay
//     permiso), y la bienvenida es una automatización de la galería.
//   · LAS EDICIONES son broadcasts del CRM: se escriben en el Copywriter, se prueban, se programan (quedan en el
//     Calendario) y salen desde el dominio del negocio.
// =============================================================================

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { Banner, Button, Checkbox, Field, Modal, PageHeader, Section, Select, Status, Switch, TextField, Textarea, Toast, useToast } from '@/app/_ui';
import Link, { useRouter } from '@/app/_ui/Link';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import '@/app/admin/operaciones/centro.css';
import { HiloMako } from '@/app/_chat/HiloMako';
import { CajaChat } from '@/app/_chat/CajaChat';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import { CSS_OFFER } from '@/app/offer/estilos';
import { itemsDeOffer } from '@/app/m/mako/chat-ui';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { ImportarLeadsModal } from '@/app/crm/ImportarLeadsModal';
import { RUTA_AUTOMATIONS } from '@/lib/ruta-automations';
import { RUTA_WEB_GENERATOR } from '@/lib/ruta-web-generator';
import {
  ETAPAS_NEWSLETTER, ETAPA_BAJA, ETAPA_DORMIDO, FRECUENCIAS, mensajesDeApertura, preguntaDeApertura,
} from '@/lib/newsletter-reglas';
import type { Edicion } from '@/lib/newsletter';
import type { EstadoNewsletter } from './estado';
import {
  desprogramarAction, eliminarEdicionAction, enviarAction, escribirEnCopywriterAction, guardarEdicionAction, nuevaEdicionAction,
  landingAlNewsletterAction, permisoParaSumarAction, programarAction, proponerEdicionAction, pruebaAction, recargarAction,
  responderAperturaAction, traerDelCopywriterAction, vistaPreviaAction,
} from './actions';

const nada = () => {};
const ESCRIBIR = 'Escribirla en el Copywriter';
const OTRA = 'Otra idea';
const AHORA_NO = 'Ahora no';
const ESTADO_EDICION: Record<string, { texto: string; tono: 'neutral' | 'info' | 'good' | 'warn' | 'bad' }> = {
  borrador: { texto: 'Borrador', tono: 'neutral' },
  cancelado: { texto: 'Borrador', tono: 'neutral' },
  programado: { texto: 'Programada', tono: 'info' },
  enviando: { texto: 'Enviando', tono: 'warn' },
  enviado: { texto: 'Enviada', tono: 'good' },
};
const pct = (n: number, de: number) => (de > 0 ? `${Math.round((n / de) * 100)}%` : '—');

function fecha(iso: string | null, zona: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es', { timeZone: zona, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

/** Un instante como lo pide un `<input type="datetime-local">` (la hora de esta computadora). */
function paraInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 86400_000);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function NewslettersApp({ inicial, edicionInicial }: { inicial: EstadoNewsletter; edicionInicial: number | null }) {
  const [estado, setEstado] = useState(inicial);
  const [abierta, setAbierta] = useState<number | null>(edicionInicial && inicial.ediciones.some((e) => e.id === edicionInicial) ? edicionInicial : null);
  const [importar, setImportar] = useState<null | 'pregunta' | 'abierto'>(null);
  const { toast, show, clear } = useToast();
  const router = useRouter();

  const completa = !!estado.config.frecuencia && !!estado.config.tema && !!estado.crm;
  // La charla de apertura sigue a la vista después de la segunda respuesta: ahí entra la IA con la primera edición, y se
  // cierra cuando la persona elige qué hacer con eso. Con ediciones ya hechas, la tab abre en el tablero.
  const [enApertura, setEnApertura] = useState(!completa || !inicial.ediciones.length);
  const edicion = estado.ediciones.find((e) => e.id === abierta) ?? null;
  const conEstado = (r: { ok: true; estado: EstadoNewsletter } | { ok: false; error: string }, ok?: string): boolean => {
    if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
    setEstado(r.estado);
    if (ok) show(ok, undefined, 'good');
    return true;
  };

  return (
    <div className="nl">
      <style>{CSS}</style>
      {toast && <Toast state={toast} onClose={clear} />}
      <PageHeader titulo="Newsletter" proposito="Tu lista que no termina: los suscriptos y cada edición."
        estado={<EstadoEnvio envioReal={estado.envioReal} remitentePropio={estado.remitentePropio} />} />
      {estado.fallos.length > 0 && <Banner tono="bad" alcance="local">No pude leer {estado.fallos.join(', ')}.</Banner>}

      {!completa || enApertura ? (
        <Apertura estado={estado} onEstado={setEstado} onError={(m) => show(m, undefined, 'bad')}
          onListo={() => setEnApertura(false)}
          onEscribir={async (p) => {
            const r = await nuevaEdicionAction(p);
            if (!conEstado(r) || !r.ok) return;
            setEnApertura(false);
            // «Escribirla en el Copywriter» lleva directo al guion; si no se pudo abrir, queda la edición abierta acá.
            const c = await escribirEnCopywriterAction(r.id);
            if (c.ok) router.push(c.href);
            else { show(c.error, undefined, 'bad'); setAbierta(r.id); }
          }} />
      ) : (
        <div className="nl-grilla">
          <Suscriptos estado={estado} onImportar={() => setImportar('pregunta')}
            onLanding={async (url, on) => conEstado(await landingAlNewsletterAction(url, on), on ? 'Listo: esa landing suma suscriptos.' : 'Esa landing ya no suma suscriptos.')} />
          <Ediciones estado={estado} onAbrir={setAbierta}
            onNueva={async () => {
              const r = await nuevaEdicionAction();
              if (conEstado(r) && r.ok) setAbierta(r.id);
            }}
            onIdea={async () => {
              const p = await proponerEdicionAction();
              if (!p.ok) { show(p.error, undefined, 'bad'); return; }
              const r = await nuevaEdicionAction({ asunto: p.asunto, idea: p.idea });
              if (conEstado(r) && r.ok) setAbierta(r.id);
            }} />
        </div>
      )}

      {edicion && (
        <EditorEdicion key={edicion.id} edicion={edicion} estado={estado} onCerrar={() => setAbierta(null)}
          onEstado={(r, ok) => conEstado(r, ok)} onAviso={(m, tono) => show(m, undefined, tono)}
          onCopywriter={async () => {
            const r = await escribirEnCopywriterAction(edicion.id);
            if (!r.ok) { show(r.error, undefined, 'bad'); return; }
            router.push(r.href);
          }} />
      )}

      {importar === 'pregunta' && (
        <Permiso onCerrar={() => setImportar(null)} onSi={async () => {
          const r = await permisoParaSumarAction('importar');
          if (!r.ok) { show(r.error, undefined, 'bad'); return; }
          setImportar('abierto');
        }} />
      )}
      {importar === 'abierto' && estado.crm && (
        <ImportarLeadsModal funnelId={estado.crm.id} productos={estado.funnels} onClose={() => setImportar(null)}
          onListo={async (resumen) => {
            setImportar(null);
            show(resumen, undefined, 'good');
            const r = await recargarAction();
            if (r.ok) setEstado(r.estado);
          }} />
      )}
    </div>
  );
}

function EstadoEnvio({ envioReal, remitentePropio }: { envioReal: boolean; remitentePropio: boolean }) {
  if (!remitentePropio) return <Status tono="warn">Sin tu dominio de envío</Status>;
  return envioReal ? <Status tono="good">Envío prendido</Status> : <Status tono="neutral">Envío apagado: se prueba y se programa</Status>;
}

// ── La apertura: MaKo pregunta ───────────────────────────────────────────────
function Apertura({ estado, onEstado, onError, onEscribir, onListo }: {
  estado: EstadoNewsletter;
  onEstado: (e: EstadoNewsletter) => void;
  onError: (m: string) => void;
  onEscribir: (p: { asunto?: string; idea?: string }) => Promise<void>;
  /** «Ahora no»: al tablero, sin escribir la edición. */
  onListo: () => void;
}) {
  const [texto, setTexto] = useState('');
  // Sin la app de escritorio la caja se bloquea, como en todo chat con MaKo (tests/app-de-escritorio-todos-los-chats.test.ts);
  // las respuestas rápidas siguen andando, como en el arranque del Media Buyer.
  const appEscritorio = useAppDeEscritorio();
  const [ocupado, start] = useTransition();
  const [propuesta, setPropuesta] = useState<{ asunto: string; idea: string } | { error: string } | null>(null);
  const [ahora] = useState(() => Date.now());
  const hilo = useRef<HTMLDivElement>(null);
  const pregunta = preguntaDeApertura(estado.config);

  const cierre = useMemo(() => {
    if (pregunta) return null;
    if (!propuesta) return { texto: 'Dame un segundo: pienso la primera edición…' };
    if ('error' in propuesta) return { texto: `Escríbela en el Copywriter: ahí está la plantilla. (${propuesta.error})`, opciones: [ESCRIBIR, AHORA_NO] };
    return { texto: `Para la primera te propongo «${propuesta.asunto}». ${propuesta.idea}`, opciones: [ESCRIBIR, OTRA, AHORA_NO] };
  }, [pregunta, propuesta]);
  const mensajes = useMemo(() => mensajesDeApertura(estado.config, cierre), [estado.config, cierre]);
  const items = useMemo(() => itemsDeOffer(mensajes).filter((m) => m.k !== 'bloque'), [mensajes]);
  const ultimo = mensajes[mensajes.length - 1];
  const opciones = ultimo?.de === 'mako' ? ultimo.opciones ?? [] : [];
  // Lo último de la charla a la vista (el molde de ArranqueMediaBuyer): la propuesta y sus pastillas, no tapadas por la caja.
  useLayoutEffect(() => { const h = hilo.current; if (h) h.scrollTop = h.scrollHeight; }, [items.length, ocupado, opciones.length]);

  const proponer = () => start(async () => {
    setPropuesta(null);
    const p = await proponerEdicionAction();
    setPropuesta(p.ok ? { asunto: p.asunto, idea: p.idea } : { error: p.error });
  });

  const responder = (t: string) => {
    if (!pregunta && t === AHORA_NO) { onListo(); return; }
    if (!pregunta && t === OTRA) { proponer(); return; }
    start(async () => {
      if (pregunta) {
        const r = await responderAperturaAction(pregunta.id, t);
        if (!r.ok) { onError(r.error); return; }
        onEstado(r.estado);
        setTexto('');
        return;
      }
      // Lo que escribe con sus palabras (no una pastilla) es SU idea: la edición nace con eso de asunto.
      if (!opciones.includes(t)) await onEscribir({ asunto: t.slice(0, 200) });
      else if (propuesta && !('error' in propuesta)) await onEscribir({ asunto: propuesta.asunto, idea: propuesta.idea });
      else await onEscribir({});
    });
  };

  // Con las dos respuestas (recién dadas, o de antes y la persona volvió), la IA del negocio piensa la primera edición.
  const pedida = useRef(false);
  useEffect(() => {
    if (pregunta || pedida.current) return;
    pedida.current = true;
    proponer();
  }, [pregunta]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="nl-apertura">
      <style>{CSS_OFFER}</style>
      <PanelDeChat hilo={hilo} estado=""
        cabecera={{ clave: 'newsletter-apertura', titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo: ocupado ? 'trabajando' : 'despierto' }}
        caja={
          <div className="co-caja">
            <CajaChat texto={texto} onTexto={setTexto} placeholder={pregunta?.id === 'tema' ? 'O escríbelo con tus palabras' : 'Escríbele a MaKo'} enterManda ocupado={ocupado} bloqueo={appEscritorio.bloqueo}
              onMandar={() => { const t = texto.trim(); if (t) responder(t); }} />
          </div>
        }>
        <HiloMako items={items} quien={{ nombre: 'MaKo', aspecto: ASPECTO_MAKO }} ahora={ahora} escribiendo={ocupado ? { segs: 1 } : null}
          tarjeta={null} onTarjeta={nada} onReintentar={nada} onRecargar={nada} />
        {opciones.length > 0 && (
          <div role="group" aria-label="Respuestas rápidas" className="nl-rapidas">
            {opciones.map((t) => <button key={t} type="button" className="of-pill" disabled={ocupado} onClick={() => responder(t)}>{t}</button>)}
          </div>
        )}
      </PanelDeChat>
    </div>
  );
}

// ── Los suscriptos ───────────────────────────────────────────────────────────
function Suscriptos({ estado, onImportar, onLanding }: {
  estado: EstadoNewsletter;
  onImportar: () => void;
  onLanding: (url: string, on: boolean) => Promise<boolean>;
}) {
  const [ocupada, setOcupada] = useState<string | null>(null);
  const crm = estado.crm!;
  const total = ETAPAS_NEWSLETTER.reduce((n, e) => n + (e.key === ETAPA_BAJA ? 0 : estado.conteo[e.key] ?? 0), 0);
  return (
    <Section titulo="Suscriptos" card nota={`${total} en tu lista · CRM «${crm.nombre}»`}
      accion={<Link href={`/crm?funnel=${crm.id}`} className="nl-link">Abrir el CRM</Link>}>
      <div className="nl-etapas">
        {ETAPAS_NEWSLETTER.map((e) => (
          <div key={e.key} className="nl-etapa">
            <span className="nl-punto" style={{ background: e.dot }} aria-hidden />
            <span>{e.label}</span>
            <b>{estado.conteo[e.key] ?? 0}</b>
          </div>
        ))}
      </div>
      <p className="nl-nota">Quien no abre {estado.config.dormidoTras} ediciones seguidas pasa solo a «Dormido».</p>

      <h3 className="nl-h3">Cómo entran</h3>
      <div className="nl-acciones">
        <Button variant="secondary" size="sm" onClick={onImportar}>Importar o traer de otro CRM</Button>
        <Link href={RUTA_AUTOMATIONS} className="nl-link">La bienvenida: «Alguien Se Suscribió» en Automations</Link>
      </div>
      {estado.landings.length ? (
        <ul className="nl-landings">
          {estado.landings.map((l) => (
            <li key={l.url}>
              <Switch checked={l.enNewsletter} disabled={ocupada === l.url}
                onChange={async (v) => { setOcupada(l.url); await onLanding(l.url, v); setOcupada(null); }}
                label={l.titulo} hint={l.enNewsletter ? 'Quien deja su email aquí, entra a tu Newsletter.' : 'Prende para que sume suscriptos.'} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="nl-nota">Crea una landing con un formulario en el <Link href={RUTA_WEB_GENERATOR} className="nl-link">Web Generator</Link> y préndela aquí.</p>
      )}
    </Section>
  );
}

// ── Las ediciones ────────────────────────────────────────────────────────────
function Ediciones({ estado, onAbrir, onNueva, onIdea }: {
  estado: EstadoNewsletter;
  onAbrir: (id: number) => void;
  onNueva: () => Promise<void>;
  onIdea: () => Promise<void>;
}) {
  const [ocupado, start] = useTransition();
  const frecuencia = FRECUENCIAS.find((f) => f.id === estado.config.frecuencia)?.label.toLowerCase();
  return (
    <Section titulo="Ediciones" card
      nota={estado.proxima ? `La próxima: ${fecha(estado.proxima, estado.zona)} (${frecuencia})` : undefined}
      accion={
        <div className="nl-acciones">
          <Button variant="mako" size="sm" loading={ocupado} onClick={() => start(onIdea)}>Que MaKo proponga</Button>
          <Button variant="primary" size="sm" disabled={ocupado} onClick={() => start(onNueva)}>Nueva edición</Button>
        </div>
      }>
      {!estado.ediciones.length ? (
        <p className="nl-nota">Todavía no hay ediciones. La primera se escribe en el Copywriter.</p>
      ) : (
        <ul className="nl-lista">
          {estado.ediciones.map((e) => {
            const st = ESTADO_EDICION[e.estado] ?? { texto: e.estado, tono: 'neutral' as const };
            const m = e.metricas;
            const cuando = e.enviado_at ?? (e.estado === 'programado' ? e.programado_at : null);
            return (
              <li key={e.id}>
                <button type="button" className="nl-fila" onClick={() => onAbrir(e.id)}>
                  <span className="nl-asunto">{e.asunto || 'Sin asunto'}</span>
                  <Status tono={st.tono}>{st.texto}</Status>
                  <span className="nl-cuando">{cuando ? fecha(cuando, estado.zona) : ''}</span>
                  {e.estado === 'enviado' && (
                    <span className="nl-metricas">
                      {m.enviados ? <>Abrieron {pct(m.abiertos, m.enviados)} · Clics {pct(m.clics, m.enviados)} · Bajas {m.bajas}</> : <>Simulada: no salió ({m.simulados})</>}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ── Una edición ──────────────────────────────────────────────────────────────
function EditorEdicion({ edicion, estado, onCerrar, onEstado, onAviso, onCopywriter }: {
  edicion: Edicion;
  estado: EstadoNewsletter;
  onCerrar: () => void;
  onEstado: (r: { ok: true; estado: EstadoNewsletter } | { ok: false; error: string }, ok?: string) => boolean;
  onAviso: (m: string, tono: 'good' | 'bad') => void;
  onCopywriter: () => Promise<void>;
}) {
  const editable = ['borrador', 'programado', 'cancelado'].includes(edicion.estado);
  const [asunto, setAsunto] = useState(edicion.asunto === 'Nueva edición' ? '' : edicion.asunto);
  const [preheader, setPreheader] = useState(edicion.preheader ?? '');
  const [cuerpo, setCuerpo] = useState(edicion.cuerpo);
  const [etapa, setEtapa] = useState<string>(edicion.etapa ?? '');
  const [cuando, setCuando] = useState(paraInput(edicion.programado_at ?? estado.proxima));
  const [vista, setVista] = useState<string | null>(null);
  const [ocupado, start] = useTransition();
  const sucio = asunto !== (edicion.asunto === 'Nueva edición' ? '' : edicion.asunto) || preheader !== (edicion.preheader ?? '') || cuerpo !== edicion.cuerpo || etapa !== (edicion.etapa ?? '');
  const enCopy = !!edicion.copy_doc_id;
  const m = edicion.metricas;

  const guardar = async (): Promise<boolean> => {
    if (!sucio) return true;
    return onEstado(await guardarEdicionAction(edicion.id, { asunto, preheader, cuerpo, etapa: etapa || null }));
  };
  const opcionesEtapa = [
    { value: '', label: 'Todo el Newsletter' },
    ...ETAPAS_NEWSLETTER.filter((e) => e.key !== ETAPA_BAJA && e.key !== 'ganado').map((e) => ({ value: e.key, label: `Sólo «${e.label}» (${estado.conteo[e.key] ?? 0})` })),
  ];

  return (
    <Modal titulo={edicion.asunto || 'Edición'} onCerrar={onCerrar} ancho={720}
      pie={editable ? (
        <div className="nl-pie">
          <Button variant="secondary" size="sm" disabled={ocupado} onClick={() => start(async () => {
            if (!(await guardar())) return;
            const r = await vistaPreviaAction(edicion.id);
            if (!r.ok) { onAviso(r.error, 'bad'); return; }
            setVista(r.html);
          })}>Vista previa</Button>
          <Button variant="secondary" size="sm" disabled={ocupado || !estado.emailPrueba} onClick={() => start(async () => {
            if (!(await guardar())) return;
            const r = await pruebaAction(edicion.id);
            onAviso(r.ok ? `Te mandé la prueba a ${r.a}.` : r.error, r.ok ? 'good' : 'bad');
          })}>Mandarme una prueba</Button>
          <span className="nl-programar">
            <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} aria-label="Cuándo sale" />
            <Button variant="secondary" size="sm" disabled={ocupado || !cuando} onClick={() => start(async () => {
              if (!(await guardar())) return;
              onEstado(await programarAction(edicion.id, new Date(cuando).toISOString()),
                estado.envioReal ? 'Programada.' : 'Programada. Si para ese día el envío sigue apagado, vuelve a borrador.');
            })}>{edicion.estado === 'programado' ? 'Reprogramar' : 'Programar'}</Button>
          </span>
          <Button variant="primary" size="sm" disabled={ocupado || !estado.envioReal || edicion.estado === 'programado'}
            title={!estado.envioReal ? 'El envío de email está apagado' : edicion.estado === 'programado' ? 'Está programada: primero desprográmala' : undefined}
            onClick={() => start(async () => {
              if (!(await guardar())) return;
              const r = await enviarAction(edicion.id);
              if (onEstado(r, r.ok ? `Salió a ${r.enviados} suscriptos.` : undefined)) onCerrar();
            })}>Enviar ahora</Button>
        </div>
      ) : undefined}>
      <div className="nl-editor">
        {!editable && (
          <div className="nl-etapas">
            <div className="nl-etapa"><span>Enviados</span><b>{m.enviados}</b></div>
            <div className="nl-etapa"><span>Abrieron</span><b>{m.abiertos} · {pct(m.abiertos, m.enviados)}</b></div>
            <div className="nl-etapa"><span>Clics</span><b>{m.clics} · {pct(m.clics, m.enviados)}</b></div>
            <div className="nl-etapa"><span>Bajas</span><b>{m.bajas}</b></div>
            {m.simulados > 0 && <p className="nl-nota">{m.simulados} quedaron simulados: el envío estaba apagado.</p>}
          </div>
        )}
        {editable && !estado.envioReal && (
          <Banner tono="info" alcance="local">El envío de email de tu negocio está apagado: mándate una prueba. Lo que programes vuelve a borrador si para ese día sigue apagado.</Banner>
        )}
        {editable && !estado.remitentePropio && (
          <Banner tono="warn" alcance="local" accion={{ label: 'Conectar tu dominio', href: '/email' }}>Sale desde tu dominio: todavía no está conectado.</Banner>
        )}

        <div className="nl-copy">
          {enCopy ? (
            <>
              <span>Esta edición se escribe en el Copywriter.</span>
              <Button variant="secondary" size="sm" disabled={ocupado} onClick={() => start(onCopywriter)}>Abrir en el Copywriter</Button>
              {editable && <Button variant="tertiary" size="sm" disabled={ocupado} onClick={() => start(async () => { onEstado(await traerDelCopywriterAction(edicion.id), 'Traje lo último del Copywriter.'); })}>Traer los cambios</Button>}
            </>
          ) : editable ? (
            <>
              <span>Escríbela con la plantilla del Copywriter: MaKo te ayuda ahí.</span>
              <Button variant="mako" size="sm" disabled={ocupado} onClick={() => start(async () => { if (await guardar()) await onCopywriter(); })}>Escribir en el Copywriter</Button>
            </>
          ) : null}
        </div>

        <TextField label="Asunto" value={asunto} maxLength={200} disabled={!editable || enCopy} onChange={(e) => setAsunto(e.target.value)} />
        <TextField label="Vista previa" hint="La línea que se ve al lado del asunto." value={preheader} maxLength={200} disabled={!editable || enCopy} onChange={(e) => setPreheader(e.target.value)} />
        <Field label="Cuerpo" hint="Usa {nombre} para el nombre de cada suscripto.">
          <Textarea rows={8} value={cuerpo} disabled={!editable || enCopy} onChange={(e) => setCuerpo(e.target.value)} aria-label="Cuerpo" />
        </Field>
        <Select label="A quién" value={etapa} onChange={setEtapa} options={opcionesEtapa} disabled={!editable}
          hint={!etapa && (estado.conteo[ETAPA_DORMIDO] ?? 0) > 0 ? 'Incluye a los dormidos: escribirles a quienes no abren baja la entrega de tu dominio.' : undefined} />

        {editable && (
          <div className="nl-acciones">
            <Button variant="secondary" size="sm" disabled={ocupado || !sucio} onClick={() => start(async () => { await guardar(); })}>Guardar</Button>
            {edicion.estado === 'programado' && (
              <Button variant="tertiary" size="sm" disabled={ocupado} onClick={() => start(async () => { onEstado(await desprogramarAction(edicion.id), 'Volvió a borrador.'); })}>Desprogramar</Button>
            )}
            {edicion.estado !== 'programado' && (
              <Button variant="danger" size="sm" disabled={ocupado} onClick={() => start(async () => { if (onEstado(await eliminarEdicionAction(edicion.id), 'Edición borrada.')) onCerrar(); })}>Borrar</Button>
            )}
          </div>
        )}
      </div>
      {vista && (
        <Modal titulo="Vista previa" onCerrar={() => setVista(null)} ancho={680} anidada>
          <iframe title="Vista previa de la edición" className="nl-vista" srcDoc={vista} sandbox="" />
        </Modal>
      )}
    </Modal>
  );
}

// ── El permiso, antes de importar o traer de otro CRM ────────────────────────
function Permiso({ onCerrar, onSi }: { onCerrar: () => void; onSi: () => Promise<void> }) {
  const [si, setSi] = useState(false);
  const [ocupado, start] = useTransition();
  return (
    <Modal titulo="Antes de sumarlos" onCerrar={onCerrar} ancho={480}
      pie={<Button variant="primary" size="sm" disabled={!si || ocupado} loading={ocupado} onClick={() => start(onSi)}>Seguir</Button>}>
      <p className="nl-nota" style={estiloParrafo}>A un newsletter sólo se suma a quien aceptó recibirlo. Cada correo lleva su link de baja.</p>
      <Checkbox checked={si} onChange={setSi} label="Me dieron su permiso para escribirles" />
    </Modal>
  );
}

const estiloParrafo: CSSProperties = { margin: '0 0 12px' };

const CSS = `
.nl { display: flex; flex-direction: column; gap: 16px; }
.nl-grilla { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 16px; align-items: start; }
@media (max-width: 960px) { .nl-grilla { grid-template-columns: minmax(0, 1fr); } }
.nl-apertura { height: min(720px, calc(100dvh - 170px)); min-height: 420px; display: flex; }
.nl-apertura > * { flex: 1; min-width: 0; }
.nl-rapidas { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 0 8px 44px; }
.nl-etapas { display: flex; flex-wrap: wrap; gap: 8px; }
.nl-etapa { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--r-md, 10px); background: var(--surface); font-size: 13px; color: var(--dim); }
.nl-etapa b { color: var(--ink); font-variant-numeric: tabular-nums; }
.nl-punto { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.nl-nota { margin: 10px 0 0; font-size: 13px; color: var(--dim); line-height: 1.5; }
.nl-h3 { margin: 18px 0 8px; font-size: 13px; font-weight: 600; color: var(--ink); }
.nl-acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.nl-link { color: var(--primary); font-size: 13px; text-decoration: none; }
.nl-link:hover { text-decoration: underline; }
.nl-landings { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.nl-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.nl-fila { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; align-items: center; text-align: left;
  padding: 10px 4px; border: 0; border-bottom: 1px solid var(--border); background: none; cursor: pointer; color: var(--ink); font: inherit; }
.nl-fila:hover { background: var(--surface-2, rgba(0,0,0,.03)); }
.nl-fila > .mk-status { justify-self: end; }
.nl-asunto { font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nl-cuando, .nl-metricas { font-size: 12px; color: var(--dim); }
.nl-metricas { text-align: right; }
.nl-editor { display: flex; flex-direction: column; gap: 12px; }
.nl-copy { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; color: var(--dim); }
.nl-pie { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: flex-end; }
.nl-programar { display: inline-flex; align-items: center; gap: 6px; }
.nl-programar input { height: 32px; padding: 0 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); font: inherit; font-size: 13px; }
.nl-vista { width: 100%; height: min(70dvh, 640px); border: 0; background: #fff; border-radius: 8px; }
@media (max-width: 600px) {
  .nl-pie { justify-content: stretch; }
  .nl-pie > * { flex: 1 1 100%; }
  .nl-programar { width: 100%; }
  .nl-programar input { flex: 1; min-width: 0; }
  .nl-rapidas { padding-left: 0; }
}
`;
