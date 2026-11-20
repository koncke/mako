'use client';

// =============================================================================
// ChatArranqueV2 — EL ONBOARDING V2: el de la maqueta, en la app (19/11/2026)
// =============================================================================
// La especificación es la maqueta del artefacto (C:/dev/artefactos-onboarding/cuerpo.html → `capaOnboarding`, `filaMako`, `tarjeta`,
// `recuadro`, `caja`): el chat adentro de un BLOQUE (el del Ops Center) con la estrellita, «MaKo · Tu onboarding», el sol y la luna a
// la derecha y su barra de progreso; las preguntas con opciones en el recuadro de arriba de la caja; los errores rojos arriba de la
// caja. Martín, 19/11, probándolo en producción: «no está para nada igual… primero te pide el WhatsApp en lugar de preguntarte cómo te
// llamas… la criatura… es un circulito en lugar de la estrella… está el botón de ahora no… la barra de chat abajo… está como muy alta…
// si vas a poner varios videos tutoriales, mejor que sea uno solo, el que aparece al principio de todo, y si voy scrolleando… que se
// ponga chiquitito abajo a la derecha… apenas inicias MaKo… dale clic para iniciar, ahí nuevamente debería aparecer la animación de
// tipo tutorial donde se pone opaco y MaKo con los 3 puntitos… y ahí el primer mensaje que te envía es el video».
// Así queda:
//   · la entrada de siempre (./EntradaMako.tsx, «Hola, soy MaKo»: tócame para empezar) y, al tocarla, la pantalla se OSCURECE salvo
//     MaKo escribiendo (los tres puntitos); su primer mensaje es el VIDEO de bienvenida, UNO solo (al bajar, sigue chiquito abajo a la
//     derecha: VideoDelMomento → useVideoQueFlota);
//   · las preguntas y sus textos, los de la maqueta (lib/onboarding-arranque.ts → mensajesDeArranqueV2), en su orden: el nombre, el
//     WhatsApp con su código (sin «Ahora no»), el contacto de MaKo, el negocio, cómo llegó y qué resolver primero (hasta 3);
//   · la caja de escribir es la del Ops Center (app/_chat/CajaChat.tsx): una línea, con los emojis y el micrófono.
// Las reglas viven en lib/onboarding-arranque.ts; esto sólo dibuja. Lo usa app/onboarding/page.tsx cuando `vista.v2`.
// =============================================================================

import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { InterruptorModo } from '@/app/_components/InterruptorModo';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import { CajaChat } from '@/app/_chat/CajaChat';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { VideoDelMomento } from '@/app/_ui/tutorial/VideoDelMomento';
import { useVideoTutorial } from '@/app/_ui/tutorial/useVideoTutorial';
import { CLAVE_ENTRADA_MOVIL } from '@/app/m/_ui/entrada';
import { rutaDelHilo, type EtapaArranque, type MensajeArranque } from '@/lib/onboarding-arranque';
import type { VistaArranque } from '@/lib/onboarding-arranque-server';
import { EntradaMako } from './EntradaMako';
import { CriaturaMako, type Reaccion } from './CriaturaMako';
import { SeguirEnPc } from './ChatArranque';
import { tarjetaConNumero } from './arranque-ui';
import { iniciales } from '@/lib/unicode-seguro';
import { esconderLaBarra } from '@/app/_ui/tutorial/barra-oculta';

type Respuesta = { ok?: boolean; error?: string; vista?: VistaArranque; aviso?: string; enCurso?: boolean };

async function llamar(cuerpo: Record<string, unknown>): Promise<Respuesta> {
  try {
    const r = await fetch('/api/onboarding/arranque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    return (await r.json()) as Respuesta;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude conectarme. Prueba de nuevo.' };
  }
}

/** El orden de los pasos, para la barra de progreso (la maqueta: `PASOS_ONB`). */
const PASOS: readonly EtapaArranque[] = ['nombre', 'telefono', 'codigo', 'agendado', 'negocio', 'origen', 'interes', 'cierre', 'listo'];
/** Lo que dice la caja en cada paso (la maqueta: el `ph` de cada `pedir`). */
const PH: Partial<Record<EtapaArranque, string>> = {
  nombre: 'Tu nombre', telefono: 'Tu WhatsApp, con el código de país', codigo: 'El código de 6 números', agendado: 'Sí o no',
  negocio: 'El nombre de tu negocio', origen: 'Cómo llegaste', interes: 'Elige hasta 3 o escríbelo con tus palabras', cierre: 'Un momento…',
};
/** Cuánto dura la pantalla oscura con MaKo escribiendo, antes de su primer mensaje (el video). */
const MS_ESCRIBE = 1800;
/** MaKo escribiendo antes de su primera pregunta, y cuánto se espera al video antes de soltarla sin él. */
const MS_PRIMERO = 1400;
const MS_SIN_VIDEO = 2500;
/** La clave del video de bienvenida (public/tutoriales, el chat de los videos). */
const VIDEO_BIENVENIDA = 'onboarding-bienvenida';
/** El del WhatsApp: la segunda mitad del video de bienvenida, que se cortó en dos (19/11), con su primera frase nueva
 *  («Tu WhatsApp es por donde MaKo…»; scripts/tutorial-animado/pantallas-onboarding/frase-nueva.mjs).
 *  Va como mensaje de MaKo justo antes del paso del código, donde está «Abrir WhatsApp». No es `onboarding-whatsapp` (el de la pantalla vieja). */
const VIDEO_WHATSAPP = 'onboarding-bienvenida-whatsapp';
const MENSAJE_DEL_CODIGO = 'arr-codigo';

const horaDe = (d: Date) => d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });

export function ChatArranqueV2({ inicial, seguirEnPc = false, persona }: {
  inicial: VistaArranque;
  /** En un teléfono: el primer paso acá y «Continuar el onboarding desde la PC» al final (18/11). Lo decide la página. */
  seguirEnPc?: boolean;
  persona?: { nombre: string; email: string };
}) {
  const [vista, setVista] = useState<VistaArranque>(inicial);
  // EL TELÉFONO (18/11: la PC es obligatoria para lo que sigue): lo dice la página o, si no lo supo, el ancho de la pantalla (la maqueta
  // decide por el ancho). Se mide después de montar, para no dibujar distinto que el servidor.
  const [enTelefono, setEnTelefono] = useState(seguirEnPc);
  useEffect(() => {
    if (seguirEnPc) return;
    try { if (window.matchMedia('(max-width: 640px)').matches) setEnTelefono(true); } catch { /* sin matchMedia: la PC */ }
  }, [seguirEnPc]);
  // EL VIDEO DE BIENVENIDA, sólo si existe de verdad (public/tutoriales, su manifiesto). Nunca un «no está grabado» en su lugar.
  const videoBienvenida = useVideoTutorial(VIDEO_BIENVENIDA);
  const videoWhatsapp = useVideoTutorial(VIDEO_WHATSAPP);
  // La entrada va UNA vez, al principio de todo; después, la pantalla oscura con MaKo escribiendo y su primer mensaje: el video.
  const empieza = !inicial.introVista && inicial.etapa === 'nombre';
  const [fase, setFase] = useState<'intro' | 'escribe' | 'chat'>(empieza ? 'intro' : 'chat');
  const [ocupado, setOcupado] = useState(false);
  const [texto, setTexto] = useState('');
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [gesto, setGesto] = useState<Reaccion | null>(null);
  const [enPc, setEnPc] = useState(false);
  const gestoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reaccionar = (r: Reaccion, ms: number) => {
    setGesto(r);
    if (gestoTimer.current) clearTimeout(gestoTimer.current);
    gestoTimer.current = setTimeout(() => setGesto(null), ms);
  };
  useEffect(() => () => { if (gestoTimer.current) clearTimeout(gestoTimer.current); }, []);

  const aplicar = (r: Respuesta): boolean => {
    if (r.vista) setVista(r.vista);
    if (r.ok === false) { setError(r.error ?? 'No se pudo guardar. Prueba de nuevo.'); return false; }
    setAviso(r.aviso ?? null);
    return true;
  };
  const releer = useCallback(async () => {
    try {
      const j = (await (await fetch('/api/onboarding/arranque')).json()) as Respuesta;
      if (j.vista) setVista(j.vista);
    } catch { /* la próxima respuesta la trae */ }
  }, []);

  // ── Lo que se manda ──────────────────────────────────────────────────────
  const etapa = vista.etapa;
  const mensajes = vista.antes;
  const ultimoMako = useMemo(() => [...mensajes].reverse().find((m) => m.de === 'mako') ?? null, [mensajes]);
  const pregunta = ultimoMako?.texto;

  const accion = async (cuerpo: Record<string, unknown>, mostrar: string | null = null): Promise<boolean> => {
    if (ocupado) return false;
    setOcupado(true);
    setError(null);
    setAviso(null);
    setPendiente(mostrar);
    try {
      const salio = aplicar(await llamar(cuerpo));
      reaccionar(salio ? 'contenta' : 'duda', salio ? 1200 : 1600);
      return salio;
    } finally {
      setOcupado(false);
      setPendiente(null);
    }
  };
  const responder = (cuerpo: Record<string, unknown>, mostrar: string | null) => accion({ action: 'responder', ...cuerpo, ...(pregunta ? { pregunta } : {}) }, mostrar);

  const mandarTexto = () => {
    const t = texto.trim();
    if (!t || ocupado || etapa === 'listo' || etapa === 'cierre') return;
    setTexto('');
    setPrimero('listo');
    // El teléfono y el código escritos en la caja valen igual que los de su tarjeta (la ruta los reconoce).
    void responder({ texto: t }, t).then((ok) => { if (!ok) setTexto(t); });
  };

  // ── Lo que pasa solo ─────────────────────────────────────────────────────
  // La pantalla oscura con MaKo escribiendo, y su primer mensaje: el video.
  useEffect(() => {
    if (fase !== 'escribe') return;
    const t = window.setTimeout(() => setFase('chat'), MS_ESCRIBE);
    return () => window.clearTimeout(t);
  }, [fase]);
  // EL PRIMER MENSAJE, A SU TIEMPO (Martín, 19/11: «no está bueno de que apenas se me manda el video y automáticamente se me manda el
  // mensaje de abajo… que salga cuando corresponda, con los tres puntitos»). Al empezar, el video va solo; la primera pregunta sale
  // cuando el video termina o la persona toca la caja, lo primero que pase (sin video, después de un momento), con MaKo escribiendo
  // antes. Quien vuelve a mitad del onboarding lo ve todo de una.
  const [primero, setPrimero] = useState<'espera' | 'escribe' | 'listo'>(empieza ? 'espera' : 'listo');
  const soltarPrimero = useCallback(() => { setPrimero((p) => (p === 'espera' ? 'escribe' : p)); }, []);
  useEffect(() => {
    if (primero !== 'escribe') return;
    const t = window.setTimeout(() => setPrimero('listo'), MS_PRIMERO);
    return () => window.clearTimeout(t);
  }, [primero]);
  const hayVideo = useRef(false);
  hayVideo.current = !!videoBienvenida;
  useEffect(() => {
    if (fase !== 'chat' || primero !== 'espera') return;
    const t = window.setTimeout(() => { if (!hayVideo.current) soltarPrimero(); }, MS_SIN_VIDEO);
    return () => window.clearTimeout(t);
  }, [fase, primero, soltarPrimero]);
  // Con todo contestado, se cierra el onboarding (por detrás, como siempre).
  const cerrando = useRef(false);
  useEffect(() => {
    if (etapa !== 'cierre' || cerrando.current) return;
    cerrando.current = true;
    void (async () => {
      const r = await llamar({ action: 'cerrar' });
      if (r.enCurso) { window.setTimeout(() => { cerrando.current = false; void releer(); }, 3000); return; }
      if (!aplicar(r)) { cerrando.current = false; return; }
      void fetch('/api/onboarding/plan-arranque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
    })();
  }, [etapa, releer]);

  // ENTRAR (como siempre: el chat «Onboarding» del Ops Center, o el Ops Center si no se pudo crear).
  const router = useRouter();
  const [entrando, setEntrando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const entrar = useCallback(async () => {
    if (entrando) return;
    setEntrando(true);
    const r = await fetch('/api/onboarding/arranque', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hilo' }), signal: AbortSignal.timeout(20_000),
    }).then((x) => x.json()).catch(() => null) as { ok?: boolean; chat?: number | null } | null;
    setSaliendo(true);
    // La barra lateral, escondida hasta que el recorrido la presente (Martín, 19/11: app/_ui/tutorial/barra-oculta.ts).
    esconderLaBarra();
    router.push(rutaDelHilo(r?.ok && typeof r.chat === 'number' ? r.chat : null));
  }, [entrando, router]);

  // ── El hilo ──────────────────────────────────────────────────────────────
  // La hora de cada mensaje: la de cuando apareció en esta pantalla.
  const horas = useRef(new Map<string, string>());
  const horaDel = (id: string) => {
    if (!horas.current.has(id)) horas.current.set(id, horaDe(new Date()));
    return horas.current.get(id) ?? '';
  };
  const hilo = useRef<HTMLDivElement>(null);
  const cuantos = mensajes.length + (pendiente ? 1 : 0) + (ocupado ? 1 : 0);
  useEffect(() => {
    const h = hilo.current;
    if (h) h.scrollTo({ top: h.scrollHeight, behavior: 'smooth' });
  }, [cuantos, fase]);

  // La inicial con `iniciales` (lib/unicode-seguro.ts): la primera letra suelta de «🔥 Alex» es media pieza de un emoji y tira la pantalla al hidratar.
  const letra = iniciales(persona?.nombre || vista.nombre, 1, '·');
  const estrella = (r: Reaccion = 'escucha') => <span className="arr-v2__foto" aria-hidden="true"><CriaturaMako size={26} reaccion={r} /></span>;
  const filaMako = (key: string, cuerpo: ReactNode, o: { conHora?: boolean; resaltar?: boolean } = {}) => (
    <div key={key} className={`co-el-wa co-wa${o.resaltar ? ' arr-v2__resalte' : ''}`}>
      <div className="co-el">{estrella()}<div className="co-el__cuerpo">{cuerpo}{o.conHora !== false && <p className="co-el__rotulo" suppressHydrationWarning>{horaDel(key)}</p>}</div></div>
    </div>
  );
  const filaYo = (key: string, t: string) => (
    <div key={key} className="co-yo co-wa co-wa--yo">
      <div className="ch-plegable"><p className="co-burbuja">{t}<span className="co-burbuja__pie" suppressHydrationWarning>{horaDel(key)}</span></p></div>
      <span className="co-mifoto arr-v2__mifoto" aria-hidden="true"><span>{letra}</span></span>
    </div>
  );
  const escribiendo = (key: string, resaltar = false) => filaMako(key,
    <span role="status" aria-label="MaKo está escribiendo" className="of-escribiendo"><i /><i /><i /></span>, { conHora: false, resaltar });

  const tarjeta = (m: MensajeArranque): ReactNode => {
    if (m.id !== ultimoMako?.id) return null;
    if (m.tarjeta === 'telefono') return <TarjetaTelefono inicial={vista.telefonoDelPago} ocupado={ocupado} onSeguir={(tel) => void accion({ action: 'telefono', telefono: tel }, `+${tel}`)} />;
    if (m.tarjeta === 'codigo') {
      return <TarjetaCodigo vista={vista} ocupado={ocupado}
        onConfirmar={(c) => responder({ texto: c }, null)}
        onCambiar={() => void accion({ action: 'cambiar-numero' })}
        onReenviar={() => void accion({ action: 'reenviar' })}
        onPedirOtro={() => void accion({ action: 'telefono' })} />;
    }
    if (m.tarjeta === 'listo') {
      return (
        <div className="arr-links">
          {enTelefono
            ? <button type="button" onClick={() => setEnPc(true)} className="arr-link arr-link--principal">Continuar el onboarding desde la PC</button>
            : <button type="button" onClick={() => void entrar()} disabled={entrando} className="arr-link arr-link--principal">{entrando ? 'Entrando…' : 'Entrar a MaKo'}</button>}
        </div>
      );
    }
    return null;
  };

  const progreso = Math.max(0, PASOS.indexOf(etapa)) / (PASOS.length - 1);
  const enRecuadro = fase === 'chat' && !ocupado && ultimoMako?.opciones?.length && ultimoMako.recuadro ? ultimoMako : null;
  const placeholder = etapa === 'listo' ? (enTelefono ? 'Toca «Continuar el onboarding desde la PC»' : 'Toca «Entrar a MaKo»') : PH[etapa] ?? 'Escribe a MaKo';

  return (
    <div className={`arr-capa arr-v2${saliendo ? ' arr-capa--sale' : ''}`}>
      <style>{CSS_V2}</style>
      {enPc && <SeguirEnPc nombre={persona?.nombre ?? ''} email={persona?.email ?? ''} />}
      <main className="arr-cuerpo">
        <div className="arr-v2__bloque">
          <header className="arr-v2__cab">
            <span data-mako-foto="" className="arr-foto" style={{ opacity: fase === 'intro' ? 0 : 1 }}>
              <CriaturaMako size={36} reaccion={ocupado ? 'piensa' : gesto ?? 'escucha'} />
            </span>
            <span className="arr-titulos"><span className="arr-nombre">MaKo</span><span className="arr-sub">Tu onboarding</span></span>
            <span className="arr-v2__der" style={{ visibility: fase === 'intro' ? 'hidden' : 'visible' }}><InterruptorModo variante="sitio" /></span>
          </header>
          <div className="arr-v2__prog" role="progressbar" aria-label="Cuánto falta de tu onboarding" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progreso * 100)} data-listo={progreso >= 1 ? '' : undefined}>
            <i style={{ width: `${Math.max(3, Math.round(progreso * 100))}%` }} />
          </div>
          <div className="co-hilo" ref={hilo}>
            <div className="co-hilo__col">
              <span className="co-dia">Hoy</span>
              {fase === 'escribe' && escribiendo('arr-escribe', true)}
              {fase === 'chat' && (
                <>
                  {/* UN solo video, el de la bienvenida, como primer mensaje (Martín, 19/11). Al bajar, sigue chiquito abajo a la derecha. */}
                  {videoBienvenida && filaMako('arr-video', <VideoDelMomento clave={VIDEO_BIENVENIDA} titulo="Bienvenida a MaKo" revision={false} onTermina={soltarPrimero} />)}
                  {primero === 'escribe' && escribiendo('arr-primero')}
                  {primero === 'listo' && mensajes.map((m) => {
                    if (m.de === 'yo') return filaYo(m.id, m.texto);
                    const t = tarjeta(m);
                    const fila = filaMako(m.id, <><div className="ch-md"><p>{m.texto}</p></div>{t && <div className="arr-v2__en-mensaje">{t}</div>}</>);
                    // El video del WhatsApp, su propio mensaje, antes del paso del código (Martín, 19/11: «que tenga cortes como los pasos»).
                    if (m.id === MENSAJE_DEL_CODIGO && videoWhatsapp) return [filaMako('arr-video-whatsapp', <VideoDelMomento clave={VIDEO_WHATSAPP} titulo="Tu WhatsApp con MaKo" revision={false} />), fila];
                    return fila;
                  })}
                  {pendiente && filaYo('arr-pendiente', pendiente)}
                  {(ocupado || etapa === 'cierre') && escribiendo('arr-pensando')}
                </>
              )}
            </div>
          </div>
          <div className="co-caja-wrap">
            {error && (
              <div className="arr-v2__error" role="alert">
                <span className="arr-v2__error-ico" aria-hidden="true">!</span>
                <span className="arr-v2__error-t">{error}</span>
                <button type="button" onClick={() => setError(null)} aria-label="Cerrar el aviso">✕</button>
                <ReportarASoporte />
              </div>
            )}
            {aviso && !error && <p className="arr-v2__aviso" role="status">{aviso}</p>}
            {enRecuadro && <Recuadro key={enRecuadro.id} m={enRecuadro} ocupado={ocupado}
              onUna={(i) => void responder({ opcion: i, opcionTexto: enRecuadro.opciones![i] }, enRecuadro.opciones![i])}
              onVarias={(vs) => void responder({ opciones: vs }, vs.join(' · '))}
              onOtra={(t) => void responder({ texto: t }, t)} />}
            {/* La caja del Ops Center, la de una línea (Martín, 19/11: «la barra de chat abajo… está como muy alta»). */}
            <div className={`co-caja${etapa === 'listo' && enTelefono ? ' arr-v2__caja--dos' : ''}`} onFocusCapture={soltarPrimero} onPointerDownCapture={soltarPrimero}>
              <CajaChat texto={texto} onTexto={(v) => { setError(null); setTexto(v); }} onMandar={mandarTexto} placeholder={placeholder} enterManda
                ocupado={ocupado} apagado={fase !== 'chat' || etapa === 'listo'} sinAdjuntos onErrorMic={(m) => setError(m)} />
            </div>
          </div>
        </div>
      </main>
      {/* La pantalla oscura del tutorial, salvo MaKo escribiendo (Martín, 19/11: «se pone opaco y MaKo con los 3 puntitos»). */}
      {fase === 'escribe' && <div className="arr-v2__velo" aria-hidden="true" />}
      {fase === 'intro' && <EntradaMako onFin={() => {
        setFase('escribe');
        try { sessionStorage.setItem(CLAVE_ENTRADA_MOVIL, '1'); } catch { /* sin storage */ }
        void llamar({ action: 'intro' });
      }} />}
    </div>
  );
}

/** El WhatsApp, con su lada (la maqueta: el campo de la app y «Seguir» negro, de lado a lado). */
function TarjetaTelefono({ inicial, ocupado, onSeguir }: { inicial: string; ocupado: boolean; onSeguir: (telefono: string) => void }) {
  const [lada, setLada] = useState(() => tarjetaConNumero(inicial).lada);
  const [numero, setNumero] = useState(() => tarjetaConNumero(inicial).numero);
  const listo = numero.replace(/\D/g, '').length >= 6;
  const seguir = () => { if (listo && !ocupado) onSeguir(`${lada}${numero.replace(/\D/g, '')}`.replace(/\D/g, '')); };
  return (
    <div className="arr-tarjeta">
      <TelefonoConPais lada={lada} numero={numero} onLada={setLada} onNumero={setNumero} onEnter={seguir} placeholder="9 11 5555 0101" inputStyle={CAMPO} />
      <Button variant="primary" size="sm" full disabled={!listo || ocupado} loading={ocupado} onClick={seguir}>Seguir</Button>
    </div>
  );
}

/**
 * EL CÓDIGO (la maqueta, `tarjeta('codigo')`): «Abrir WhatsApp» en el verde de WhatsApp abre su chat con MaKo con el pedido escrito;
 * MaKo le contesta con el código y lo pega acá. Debajo, cambiar el número o pedir que se lo reenvíe. Sin «Pega aquí el código» ni
 * «Pegar» (Martín, 19/11: «elimina también, pega aquí el código… elimina el botón que dice pegar»): el mensaje de arriba ya lo dice.
 */
function TarjetaCodigo({ vista, ocupado, onConfirmar, onCambiar, onReenviar, onPedirOtro }: {
  vista: VistaArranque; ocupado: boolean;
  onConfirmar: (codigo: string) => Promise<boolean>; onCambiar: () => void; onReenviar: () => void; onPedirOtro: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const confirmar = () => { if (codigo.length >= 6 && !ocupado) void onConfirmar(codigo).then((ok) => { if (ok) setCodigo(''); }); };
  const w = vista.whatsapp;
  const vencido = !w || !w.link || w.estado === 'vencido';
  return (
    <div className="arr-tarjeta arr-v2__cod">
      {vencido
        ? <><span className="arr-tarjeta__nota">{w?.estado === 'vencido' ? 'Pasó mucho tiempo: pide otro mensaje.' : 'No pude armar el mensaje.'}</span>
          <Button variant="primary" size="sm" loading={ocupado} disabled={ocupado} onClick={onPedirOtro}>Pedir otro</Button></>
        : <a className="arr-v2__wa" href={w!.link!} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={18} />Abrir WhatsApp</a>}
      <div className="arr-v2__cod-fila">
        {/* Sólo los 6 números: lo pegado con espacios o con el texto del mensaje queda en sus números. */}
        <input id="arr-v2-codigo" className="arr-v2__cod-campo" inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
          aria-label="El código de 6 números" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } }} />
        <Button variant="primary" size="sm" disabled={codigo.length < 6 || ocupado} loading={ocupado} onClick={confirmar}>Confirmar</Button>
      </div>
      <div className="arr-v2__cod-pie">
        <button type="button" className="arr-v2__link" onClick={onCambiar} disabled={ocupado}>Cambiar número</button>
        <button type="button" className="arr-v2__link" onClick={onReenviar} disabled={ocupado}>Reenviar el código</button>
      </div>
    </div>
  );
}

/**
 * EL RECUADRO DE OPCIONES de arriba de la caja: el del Ops Center (app/admin/operaciones/PreguntasDelChat.tsx, centro.css
 * .co-preg--arriba), con el tema a la izquierda, como la maqueta (`recuadro`). Varias a la vez con números en caja y «Responder»;
 * una lista larga en dos columnas, numerada de arriba hacia abajo; «Escribe otra cosa» al final.
 */
function Recuadro({ m, ocupado, onUna, onVarias, onOtra }: {
  m: MensajeArranque; ocupado: boolean; onUna: (i: number) => void; onVarias: (vs: string[]) => void; onOtra: (t: string) => void;
}) {
  const q = m.recuadro!;
  const ops = m.opciones ?? [];
  const [plegado, setPlegado] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [otra, setOtra] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const varias = q.varias ?? 0;
  if (plegado) {
    return (
      <button type="button" className="co-preg co-preg--arriba co-preg--plegada" onClick={() => setPlegado(false)} aria-expanded={false}>
        <span>{m.texto}</span><span className="co-preg__flecha" aria-hidden="true">▴</span>
      </button>
    );
  }
  const marcar = (o: string) => {
    setAviso(null);
    setMarcadas((v) => {
      if (v.includes(o)) return v.filter((x) => x !== o);
      if (v.length >= varias) { setAviso(`Puedes elegir hasta ${varias}. Saca uno para sumar otro.`); return v; }
      return [...v, o];
    });
  };
  const filas = Math.ceil(ops.length / 2);
  return (
    <div className={`co-preg co-preg--arriba arr-v2__preg${ops.length > 6 ? ' arr-v2__preg--larga' : ''}`} role="group" aria-label={`Pregunta: ${m.texto}`}>
      <div className="co-preg__cab">
        <span className="arr-v2__tema">{q.tema}</span>
        <button type="button" className="co-preg__plegar" onClick={() => setPlegado(true)} aria-expanded aria-label="Ocultar las opciones" title="Ocultar"><span aria-hidden="true">▾</span></button>
      </div>
      <p className="co-preg__texto">{m.texto}</p>
      {q.ayuda && <p className="arr-v2__ayuda">{aviso ?? q.ayuda}</p>}
      <ol className="co-preg__ops arr-v2__lista" style={{ '--filas': filas } as CSSProperties}>
        {ops.map((o, i) => {
          const elegida = marcadas.includes(o);
          return (
            <li key={o}>
              <div role="button" tabIndex={0} className="co-preg__op" aria-pressed={varias ? elegida : undefined} data-elegida={elegida ? 'true' : undefined}
                onClick={() => { if (ocupado) return; if (varias) marcar(o); else onUna(i); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (ocupado) return; if (varias) marcar(o); else onUna(i); } }}>
                <span className={`co-preg__num${varias ? ' co-preg__num--caja' : ''}`} aria-hidden="true">{i + 1}</span>
                <span className="co-preg__op-txt"><span className="co-preg__titulo">{o}</span></span>
              </div>
            </li>
          );
        })}
      </ol>
      {q.libre && (
        <ol className="co-preg__ops arr-v2__otra" start={ops.length + 1}>
          <li>
            <label className="co-preg__op co-preg__op--otra">
              <span className="co-preg__num" aria-hidden="true">{ops.length + 1}</span>
              <input className="co-preg__campo" value={otra} maxLength={1000} placeholder="Escribe otra cosa" aria-label="Escribe otra respuesta"
                onChange={(e) => setOtra(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && otra.trim() && !ocupado) { e.preventDefault(); onOtra(otra.trim()); } }} />
            </label>
          </li>
        </ol>
      )}
      {(varias > 0 || otra.trim()) && (
        <div className="co-preg__pie co-preg__pie--chat">
          <span className="co-preg__ayuda">{marcadas.length ? `${marcadas.length} elegido${marcadas.length > 1 ? 's' : ''}` : ''}</span>
          <button type="button" className="co-chip co-chip--primario" disabled={ocupado || (!otra.trim() && !marcadas.length)}
            onClick={() => { if (otra.trim()) onOtra(otra.trim()); else if (marcadas.length) onVarias(marcadas); }}>Responder</button>
        </div>
      )}
    </div>
  );
}

const CAMPO = {
  width: '100%', boxSizing: 'border-box' as const, padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit',
};

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md). Copiado de la maqueta (cuerpo.html, «EL ONBOARDING: una
// pantalla con el chat en un bloque…»), con los nombres de la app.
const CSS_V2 = `
.arr-capa { position: fixed; top: var(--barra-agencia, 0px); right: 0; bottom: 0; left: 0; z-index: 100; display: flex; flex-direction: column; font-family: 'Geist', sans-serif; color: var(--ink); }
.arr-capa--sale { opacity: 0; transition: opacity .4s ease; }
.arr-v2.arr-capa { background: var(--surface); }
/* LA LETRA (16/11, Martín: «fíjate que los mensajes de MaKo no queden tan chiquititos»): la escala grande de la app, como la maqueta. */
.arr-v2 { --fs-meta: 13px; --fs-sm: 14.5px; --fs-md: 16px; --fs-card: 16.5px; }
.arr-v2 .co-el__cuerpo .ch-md, .arr-v2 .co-burbuja { font-size: var(--fs-md); line-height: 1.5; }
.arr-v2 .arr-cuerpo { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 16px max(16px, calc((100vw - 960px) / 2)); }
.arr-v2__bloque { flex: 1; min-height: 0; display: flex; flex-direction: column; position: relative; overflow: hidden;
  background: var(--bg); border: 1px solid var(--border-strong); border-radius: 18px;
  box-shadow: 0 1px 2px rgba(18, 21, 27, .04), 0 14px 36px rgba(18, 21, 27, .08); }
[data-tema="oscuro"] .arr-v2__bloque { box-shadow: 0 14px 36px rgba(0, 0, 0, .45); }
.arr-v2__cab { flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 18px; border-bottom: 1px solid var(--border); background: var(--surface); }
.arr-v2 .arr-foto { display: inline-flex; transition: opacity .2s ease; }
.arr-v2 .arr-titulos { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.arr-v2 .arr-nombre { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; }
.arr-v2 .arr-sub { font-size: 13.5px; color: var(--ink); line-height: 1.2; }
.arr-v2__der { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; color: var(--ink); }
.arr-v2__prog { position: relative; flex: none; height: 4px; background: var(--surface-2); }
.arr-v2__prog i { display: block; height: 100%; background: var(--ink); border-radius: 0 2px 2px 0; transition: width .5s cubic-bezier(.16, .84, .34, 1); }
.arr-v2__prog[data-listo] i { background: var(--good); }
.arr-v2 .co-hilo { flex: 1; min-height: 0; overflow-y: auto; background: var(--bg); padding-inline: clamp(14px, 3vw, 28px); padding-top: 16px; }
.arr-v2 .co-caja-wrap { flex: none; background: var(--bg); padding: 0 clamp(12px, 2.5vw, 24px) 14px; }
.arr-v2__foto { flex: none; display: inline-flex; width: 26px; height: 26px; margin-top: 4px; }
.arr-v2__mifoto { width: 28px; height: 28px; }
.arr-v2 .ch-md p { margin: 0; }
.arr-v2__en-mensaje { display: flex; flex-direction: column; gap: 8px; margin: 8px 0 2px; }
.arr-v2 .arr-tarjeta { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--border); min-width: min(320px, 100%); }
.arr-v2 .arr-tarjeta__nota { font-size: 13px; color: var(--dim); line-height: 1.4; }
.arr-v2 .arr-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.arr-v2 .arr-link { display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); font-size: var(--fs-sm); font-weight: 700; text-decoration: none; font-family: inherit; cursor: pointer; }
.arr-v2 .arr-link--principal { background: var(--ink); border-color: var(--ink); color: var(--surface); }
.arr-v2 .arr-link:disabled { opacity: .6; cursor: default; }
/* En el teléfono, al final, la caja muestra entero «Toca «Continuar el onboarding desde la PC»», en dos renglones (la maqueta). */
.arr-v2__caja--dos .co-caja__campo textarea { min-height: calc(2 * var(--fs-md) * 1.5 + 18px); }
/* Los errores, ROJOS y arriba de la caja (16/11, Martín: «no en amarillo, sino que en rojo»). */
.arr-v2__error { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 10px; max-width: 760px; margin: 0 auto 10px; padding: 10px 12px; border-radius: 12px;
  background: var(--bad-bg); border: 1px solid color-mix(in srgb, var(--bad) 45%, transparent); color: var(--ink); font-size: var(--fs-sm); line-height: 1.45; }
.arr-v2__error-ico { flex: none; width: 20px; height: 20px; border-radius: 50%; background: var(--bad); color: #fff; display: grid; place-items: center; font: 800 12px/1 'Geist', system-ui, sans-serif; margin-top: 1px; }
.arr-v2__error-t { flex: 1; min-width: 0; }
.arr-v2__error > button { flex: none; border: 0; background: none; color: var(--dim); cursor: pointer; font: inherit; padding: 0 2px; }
.arr-v2__aviso { max-width: 760px; margin: 0 auto 8px; font-size: var(--fs-sm); color: var(--dim); text-align: center; }
/* La tarjeta del código. */
.arr-v2__wa { display: inline-flex; align-items: center; justify-content: center; gap: 8px; align-self: flex-start; height: 42px; padding: 0 18px; border-radius: 999px; border: 0;
  background: #25D366; color: #fff; font: 700 15px/1 'Geist', system-ui, sans-serif; text-decoration: none; cursor: pointer; box-shadow: 0 2px 8px rgba(37, 211, 102, .3); }
.arr-v2__wa:hover { background: #1EBE5A; }
.arr-v2__wa svg { flex: none; }
.arr-v2__cod-fila { display: flex; gap: 8px; align-items: stretch; }
.arr-v2__cod-campo { flex: 1; min-width: 0; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink);
  font: 600 18px/1.2 'Geist', system-ui, sans-serif; letter-spacing: .32em; text-align: center; font-variant-numeric: tabular-nums; }
.arr-v2__cod-campo:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.arr-v2__cod-campo::placeholder { color: var(--faint); letter-spacing: .32em; }
.arr-v2__cod-pie { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; }
.arr-v2__link { border: 0; background: none; padding: 2px 0; color: var(--dim); font: inherit; font-size: var(--fs-sm); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.arr-v2__link:hover { color: var(--ink); }
/* El recuadro de opciones: el del Ops Center, con el tema a la izquierda; una lista larga en dos columnas, numerada hacia abajo. */
.arr-v2__preg .co-preg__cab { justify-content: space-between; }
.arr-v2__tema { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 6px; background: var(--surface-2); color: var(--ink); font-size: var(--fs-meta); font-weight: 600; white-space: nowrap; }
.arr-v2__preg .co-preg__plegar { margin-left: auto; }
.arr-v2__preg .co-preg__op:hover { background: var(--velo-hover); }
.arr-v2__ayuda { margin: 0 4px 8px; font-size: var(--fs-sm); color: var(--dim); }
.arr-v2__preg .arr-v2__otra { margin-top: 2px; }
@media (min-width: 900px) {
  .arr-v2__preg--larga .co-preg__ops.arr-v2__lista { display: grid; grid-template-columns: 1fr 1fr; grid-auto-flow: column; grid-template-rows: repeat(var(--filas, 5), auto); column-gap: 6px; }
}
/* Los tres puntitos de MaKo escribiendo (los de Offer: app/offer/estilos.ts). */
.arr-v2 .of-escribiendo { display: inline-flex; align-items: center; gap: 4px; padding: 6px 2px; color: var(--dim); }
.arr-v2 .of-escribiendo i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: arr-v2-escribe 1.2s ease-in-out infinite; }
.arr-v2 .of-escribiendo i:nth-child(2) { animation-delay: .15s; }
.arr-v2 .of-escribiendo i:nth-child(3) { animation-delay: .3s; }
@keyframes arr-v2-escribe { 0%, 60%, 100% { opacity: .25; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
/* LA PANTALLA OSCURA DEL TUTORIAL, salvo MaKo escribiendo. */
.arr-v2__velo { position: fixed; inset: 0; z-index: 5; background: rgba(18, 21, 27, .62); animation: arr-v2-velo .45s ease both; pointer-events: none; }
@keyframes arr-v2-velo { from { opacity: 0; } to { opacity: 1; } }
.arr-v2__resalte { position: relative; z-index: 6; }
.arr-v2__resalte .co-el { padding: 6px 12px 6px 8px; border-radius: 999px; background: var(--bg); box-shadow: 0 0 0 2px var(--ink), 0 10px 30px rgba(0, 0, 0, .25); width: max-content; }
@media (prefers-reduced-motion: reduce) { .arr-v2__velo, .arr-v2 .of-escribiendo i, .arr-capa--sale { animation: none; transition: none; } }
@media (max-width: 640px) {
  .arr-v2 .arr-cuerpo { padding: 8px; }
  .arr-v2__bloque { border-radius: 16px; }
  .arr-v2__cab { padding: 8px 10px 8px 14px; }
  .arr-v2__preg .co-preg__op { padding: 6px 8px; }
  .arr-v2__preg .arr-v2__lista { max-height: min(36vh, 300px); overflow-y: auto; }
}
`;
