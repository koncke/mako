'use client';

// =============================================================================
// ChatArranque — el onboarding de MaKo: una conversación con MaKo, en el mismo chat de Offer
// =============================================================================
// Pedido de Martín (16/10/2026): «Quiero que elimines todo lo que hay hoy en onboarding tal como está y
// que lo reemplaces por el chat de "Offer", el onboarding será ese chat de offer… NO quiero que sea un
// onboarding eterno, es más, mientras más ágil y rápido mejor.» Y lo de la llamada con Leila (12/10):
// «yo de hecho quisiera que jamás se salga el recuadro del chat».
//
// Qué hace esta pantalla, y nada más:
//   · la entrada de MaKo (./EntradaMako.tsx) una sola vez: aparece, saluda y espera que la toquen; recién ahí
//     vuela a su lugar de foto y empieza el chat (17/10/2026: sin el grafo y sin avanzar sola);
//   · en el tema de la app (claro) y SIN RECUADRO: los mensajes sueltos sobre el fondo, como la referencia que mandó
//     Martín el 17/10. La cara de MaKo reacciona a lo que contesta la persona (./CriaturaMako.tsx);
//   · el chat ES el motor de Offer (app/offer/OfferApp.tsx en modo `arranque`): la conversación de lo que
//     vende va por /api/offer como en la tab, en su versión del onboarding (sólo lo que vende, sin «Armar mi
//     oferta»: el análisis es de la tab Offer, 17/10/2026); alrededor van los mensajes del arranque (quién es,
//     el PDF con lo que vende, la fase, el CRM, el teléfono), que contesta /api/onboarding/arranque;
//   · lo que se crea (el CRM, la oferta, el plan) se ve ADENTRO del chat, en tarjetas; ir a otro lado es un
//     link que la persona elige.
// Las reglas (en qué etapa está, qué dice MaKo, qué se acepta) son puras: lib/onboarding-arranque.ts.
// =============================================================================

import { TarjetaAvisos } from './TarjetaAvisos';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useWs } from '@/app/_ui/Link';
import { CLAVE_ENTRADA_MOVIL } from '@/app/m/_ui/entrada';
import { conWs } from '@/lib/ws-tab';
import { VistaPdf } from '../offer/VistaPdf';
import { Button } from '@/app/_ui';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import { tipoCrmPorId } from '@/lib/pipeline';
import { etapasConNombres } from '@/lib/onboarding-crm';
import { RUTA_AL_TERMINAR, rutaDelHilo, tipoRecomendado, type MensajeArranque } from '@/lib/onboarding-arranque';
import { MENSAJE_BLOQUEADO } from '@/lib/onboarding-guardia';
import type { VistaArranque } from '@/lib/onboarding-arranque-server';
import type { VistaEntrante } from '@/lib/verificacion-entrante';
import type { ArbolOffer, OfferMensaje, OfferSesionVista } from '@/lib/offer-marco';
import { OfferApp, type ArranqueOffer } from '../offer/OfferApp';
import { EntradaMako } from './EntradaMako';
import { CriaturaMako, type Reaccion } from './CriaturaMako';
import { SESION_VACIA, aMensajeOffer, ladoDeLaPregunta, linkPdfLoQueVende, mandaElArranque, placeholderDe, preguntaQueContesta, tarjetaConNumero, tarjetasDe, terminoElArranque } from './arranque-ui';

type Respuesta = { ok?: boolean; error?: string; vista?: VistaArranque; aviso?: string; enCurso?: boolean; whatsapp?: VistaEntrante | null };
/** Un aviso arriba del chat; con `accion`, lo que lo destraba sin recargar (un fallo pasajero se reintenta). */
type Aviso = { texto: string; accion?: { label: string; onClick: () => void } };
/** El plan de arranque: escribiéndose, listo con su link, o sin plan (no salió o la capa no lo arma). */
type EstadoPlan = 'armando' | 'sin' | { url: string; n: number };
/** Cuánto se ve el «¡Listo!» antes de entrar solo al Ops Center (18/10/2026). */
const MS_PARA_ENTRAR = 1500;

async function llamar(cuerpo: Record<string, unknown>): Promise<Respuesta> {
  try {
    const r = await fetch('/api/onboarding/arranque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    return (await r.json()) as Respuesta;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude conectarme. Prueba de nuevo.' };
  }
}

export function ChatArranque({ inicial, arbolVacio, opcionArmar }: { inicial: VistaArranque; arbolVacio: ArbolOffer; opcionArmar: string }) {
  const [vista, setVista] = useState<VistaArranque>(inicial);
  // La animación va UNA vez, y sólo al principio de todo (con algo contestado, se entra directo al chat).
  const [intro, setIntro] = useState(!inicial.introVista && (inicial.etapa === 'telefono' || inicial.etapa === 'nombre'));
  const [ocupado, setOcupado] = useState(false);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [aviso, setAvisoRaw] = useState<Aviso | null>(null);
  const setAviso = (texto: string | null, accion?: Aviso['accion']) => setAvisoRaw(texto ? { texto, ...(accion ? { accion } : {}) } : null);
  const [sesion, setSesion] = useState<OfferSesionVista | null>(inicial.sesion);
  const [plan, setPlan] = useState<EstadoPlan>('armando');
  /** Sube con «Reintentar» del cierre: el efecto del cierre vuelve a correr. */
  const [intentoCierre, setIntentoCierre] = useState(0);
  const [esperandoCierre, setEsperandoCierre] = useState(false);
  const cerrando = useRef(false);
  const ligando = useRef<number | null>(null);
  const preparando = useRef(false);
  // La cara de MaKo REACCIONA a lo que contesta la persona (17/10/2026, Martín: «debe parpadear y reaccionar con las
  // respuestas»): piensa mientras guarda, se alegra cuando entró, duda cuando no la entendió. El gesto dura un momento.
  const [gesto, setGesto] = useState<Reaccion | null>(null);
  const gestoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reaccionar = (r: Reaccion, ms: number) => {
    setGesto(r);
    if (gestoTimer.current) clearTimeout(gestoTimer.current);
    gestoTimer.current = setTimeout(() => setGesto(null), ms);
  };
  useEffect(() => () => { if (gestoTimer.current) clearTimeout(gestoTimer.current); }, []);

  const aplicar = (r: Respuesta): boolean => {
    if (r.vista) setVista(r.vista);
    if (r.aviso) setAviso(r.aviso);
    if (r.ok === false) { setAviso(r.error ?? 'No se pudo guardar. Prueba de nuevo.'); return false; }
    return true;
  };

  const releer = useCallback(async () => {
    try {
      const j = (await (await fetch('/api/onboarding/arranque')).json()) as Respuesta;
      if (j.vista) setVista(j.vista);
    } catch { /* la próxima respuesta la trae */ }
  }, []);

  const responder = async (cuerpo: { texto?: string; opcion?: number; opcionTexto?: string; pregunta?: string }, mostrar: string | null): Promise<boolean> => {
    if (ocupado) return false;
    setOcupado(true);
    setAviso(null);
    setPendiente(mostrar);
    try {
      const salio = aplicar(await llamar({ action: 'responder', ...cuerpo }));
      reaccionar(salio ? 'contenta' : 'duda', salio ? 1200 : 1600);
      return salio;
    } finally {
      setOcupado(false);
      setPendiente(null);
    }
  };

  // ── Lo que pasa solo ─────────────────────────────────────────────────────
  // La conversación de la oferta que abrió el motor queda anotada como la del arranque.
  const alCambiarSesion = useCallback((s: OfferSesionVista) => {
    setSesion(s);
  }, []);
  useEffect(() => {
    if (!sesion || sesion.id === vista.sesion?.id || ligando.current === sesion.id) return;
    ligando.current = sesion.id;
    // Si no se pudo anotar, se suelta el candado: el próximo cambio de la conversación lo reintenta (si no,
    // la etapa quedaba congelada en la oferta aunque el dueño la terminara).
    void llamar({ action: 'sesion', sesionId: sesion.id }).then((r) => { if (!aplicar(r)) ligando.current = null; });
  }, [sesion, vista.sesion?.id]);
  // La conversación anotada no se pudo leer: se avisa y se relee. NUNCA se abre otra (rehacer la oferta).
  useEffect(() => {
    if (vista.sesionCaida) setAviso('No pude cargar tu conversación.', { label: 'Reintentar', onClick: () => { setAviso(null); void releer(); } });
  }, [vista.sesionCaida, releer]);
  // Sin funnel principal no nace la conversación de la oferta: se prepara (una vez por vez que falte).
  useEffect(() => {
    if (vista.etapa !== 'oferta' || vista.modo !== 'oferta' || vista.tieneSesion || vista.funnelDefaultId != null || preparando.current) return;
    preparando.current = true;
    void llamar({ action: 'preparar' }).then((r) => {
      preparando.current = false;
      if (!aplicar(r)) setAviso('No pude preparar tu CRM.', { label: 'Reintentar', onClick: () => { setAviso(null); void releer(); } });
    });
  }, [vista.etapa, vista.modo, vista.tieneSesion, vista.funnelDefaultId, releer]);
  // Cada turno de la conversación puede cerrar la etapa (ya sabe lo que vende): se relee.
  // ⚠️ Las dependencias son PRIMITIVAS: con el objeto `vista.sesion`, cada relectura trae uno nuevo y el
  // efecto se vuelve a disparar para siempre.
  const firma = sesion ? `${sesion.mensajes.length}:${Object.keys(sesion.piezas).length}` : '';
  const sesionLigada = vista.sesion?.id ?? null;
  useEffect(() => { if (firma && sesionLigada != null) void releer(); }, [firma, releer, sesionLigada]);
  // Con todo contestado, se cierra el onboarding y MaKo escribe el plan de arranque (por detrás).
  useEffect(() => {
    if (vista.etapa !== 'cierre' || cerrando.current) return;
    cerrando.current = true;
    void (async () => {
      const r = await llamar({ action: 'cerrar' });
      aplicar(r);
      // Lo está cerrando el otro dispositivo (el teléfono que activó los avisos): acá sólo se espera a verlo terminado. El plan lo arma el que cerró.
      if (r.enCurso) { setPlan('sin'); setEsperandoCierre(true); return; }
      if (r.ok === false) {
        // Un fallo pasajero se reintenta acá mismo, sin recargar.
        cerrando.current = false;
        setAviso(r.error ?? 'No pude terminar.', { label: 'Reintentar', onClick: () => { setAviso(null); setIntentoCierre((n) => n + 1); } });
        return;
      }
      const p = await fetch('/api/onboarding/plan-arranque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then((x) => x.json()).catch(() => null) as { ok?: boolean; url?: string; n?: number } | null;
      // Sin link (no salió, o la capa no arma un plan: `skip`), la tarjeta no queda «armando» para siempre.
      setPlan(p?.ok && p.url ? { url: p.url, n: Number(p.n ?? 0) } : 'sin');
    })();
  }, [vista.etapa, intentoCierre]);

  // ¿YA LLEGÓ SU MENSAJE? (4/11/2026): la persona le escribe a MaKo desde su WhatsApp y el webhook lo confirma. Mientras
  // tanto se pregunta cada 4 s (sólo con la pestaña a la vista), y cuando llegó la conversación sigue sola.
  const esperandoWhatsapp = vista.etapa === 'codigo' && (vista.whatsapp?.estado === 'esperando' || vista.whatsapp?.estado === 'otro-numero');
  useEffect(() => {
    if (!esperandoWhatsapp) return;
    let vivo = true;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      void llamar({ action: 'whatsapp' }).then((r) => {
        if (!vivo) return;
        if (r.vista) setVista(r.vista);
        else if (r.whatsapp) setVista((v) => ({ ...v, whatsapp: r.whatsapp ?? null }));
      });
    }, 4000);
    return () => { vivo = false; window.clearInterval(t); };
  }, [esperandoWhatsapp]);

  // Relee mientras el otro dispositivo cierra. Si no termina (se murió), vuelve a intentarlo: el reclamo del server ya venció.
  useEffect(() => {
    if (!esperandoCierre || vista.etapa !== 'cierre') return;
    const t = window.setInterval(() => { void releer(); }, 3000);
    const fin = window.setTimeout(() => { cerrando.current = false; setEsperandoCierre(false); setIntentoCierre((n) => n + 1); }, 200_000);
    return () => { window.clearInterval(t); window.clearTimeout(fin); };
  }, [esperandoCierre, vista.etapa, releer]);

  // ENTRA SOLO (18/10/2026, Martín: «cuando dice "¡Listo…! Tu MaKo ya está armado." automáticamente debería ingresar a
  // MaKo, no preguntarme, y la primera tab es el center»). A los 1,5 s del «¡Listo!» la pantalla se funde y entra al Ops
  // Center con el router de la casa (lleva el `?ws=`). Es navegación INTERNA a propósito: el plan que se sigue armando
  // (`/api/onboarding/plan-arranque`) es un fetch en vuelo, y una recarga dura lo cortaría; ésta no.
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const [entrandoYa, setEntrandoYa] = useState(false);
  // ENTRAR ES UNO SOLO, con el temporizador o con el botón (20/10/2026, revisión del Cerebro: «Entrar a MaKo» o un F5 corrían
  // a la vez que el POST que arma el chat «Onboarding»). Al chat con la conversación y el tutorial (`rutaDelHilo`); si no se
  // pudo crear, al Ops Center igual: nunca se traba el final. El POST lleva plazo. Mientras corre, el botón dice
  // «Entrando…» y la pantalla queda; se funde recién al navegar (revisión de la noche: fundida antes del POST, la capa
  // invisible se comía los clics y el «Entrando…» no se veía nunca).
  const entrando = useRef(false);
  const entrar = useCallback(async () => {
    if (entrando.current) return;
    entrando.current = true;
    setEntrandoYa(true);
    let destino = vista.modo === 'oferta' ? RUTA_AL_TERMINAR : '/plan';
    if (vista.modo === 'oferta') {
      const r = await fetch('/api/onboarding/arranque', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hilo' }), signal: AbortSignal.timeout(20_000),
      }).then((x) => x.json()).catch(() => null) as { ok?: boolean; chat?: number | null } | null;
      destino = rutaDelHilo(r?.ok && typeof r.chat === 'number' ? r.chat : null);
    }
    setSaliendo(true);
    router.push(destino);
  }, [vista.modo, router]);
  useEffect(() => {
    if (vista.etapa !== 'listo') return;
    const t = window.setTimeout(() => { void entrar(); }, MS_PARA_ENTRAR);
    return () => window.clearTimeout(t);
  }, [vista.etapa, entrar]);

  // ── Lo que se dibuja ─────────────────────────────────────────────────────
  const lado = ladoDeLaPregunta(vista.etapa, vista.modo);
  // ⚠️ Memo: el hilo se vuelve a desplazar cada vez que cambia su lista de mensajes, y un arreglo nuevo en
  // cada tecla del composer lo haría con cada letra (el mismo cuidado que ChatOffer con los suyos).
  const { antes, despues } = useMemo(() => {
    const conPendiente = (lista: MensajeArranque[], conPend: boolean): OfferMensaje[] => [
      ...lista.map(aMensajeOffer),
      ...(conPend && pendiente ? [{ id: 'arr-pendiente', de: 'yo' as const, texto: pendiente, at: '' }] : []),
    ];
    return { antes: conPendiente(vista.antes, lado === 'antes'), despues: conPendiente(vista.despues, lado === 'despues') };
  }, [vista, pendiente, lado]);
  const tarjetas = useMemo(() => tarjetasDe([...vista.antes, ...vista.despues]), [vista]);
  const manda = mandaElArranque(vista.etapa);

  const extra = (m: OfferMensaje) => {
    const t = tarjetas.get(m.id);
    if (t === 'crm') return <TarjetaCrm vista={vista} />;
    if (t === 'pdf') return vista.sesion ? <TarjetaPdf sesionId={vista.sesion.id} /> : null;
    if (t === 'telefono') return <TarjetaTelefono inicial={vista.telefonoDelPago} ocupado={ocupado} onEnviar={async (tel) => { setOcupado(true); setAviso(null); try { aplicar(await llamar({ action: 'telefono', telefono: tel })); } finally { setOcupado(false); } }} />;
    if (t === 'whatsapp') return <TarjetaWhatsapp v={vista.whatsapp} ocupado={ocupado} onOtro={async () => { setOcupado(true); setAviso(null); try { aplicar(await llamar({ action: 'telefono', telefono: vista.telefonoNumero.replace(/\D/g, '') })); } finally { setOcupado(false); } }} />;
    if (t === 'avisos') return <TarjetaAvisos qr={vista.avisosQr} onRevisar={releer} onSinSoporte={() => void llamar({ action: 'avisos', sinSoporte: true }).then(aplicar)} />;
    if (t === 'listo') return <TarjetaListo onEntrar={() => void entrar()} entrando={entrandoYa} />;
    return null;
  };

  const arranque: ArranqueOffer = {
    antes,
    despues,
    manda,
    onTexto: async (t) => {
      if (terminoElArranque(vista.etapa)) { setAviso('Tu oferta sigue en Offer.'); return false; }
      return responder({ texto: t, ...preguntaQueContesta(vista) }, t);
    },
    onOpcion: (idx) => {
      // Viaja con su TEXTO y con la PREGUNTA que contesta: el server los compara contra su pregunta actual y, si cambió
      // (una pestaña vieja), no anota nada y devuelve la conversación de hoy. La pregunta, porque todas las confirmaciones
      // tienen el mismo botón («Sí, es eso»): cuarta revisión, 21/10.
      const ultimo = [...vista.antes, ...vista.despues].filter((m) => m.de === 'mako').pop();
      const texto = ultimo?.opciones?.[idx];
      void responder({ opcion: idx, ...(texto !== undefined ? { opcionTexto: texto } : {}), ...preguntaQueContesta(vista) }, texto ?? null);
    },
    ocupado,
    extra,
    // Sólo si NUNCA hubo una conversación anotada: con una anotada que no se pudo leer, abrir otra hacía
    // rehacer la oferta y dejaba la vieja huérfana (revisión del 16/10).
    abrirEnFunnel: vista.modo === 'oferta' && vista.etapa === 'oferta' && !vista.tieneSesion && !vista.sesionCaida
      ? vista.funnelDefaultId : null,
    onSesion: alCambiarSesion,
    // La guardia lo bloqueó a mitad de la conversación de lo que vende: se relee y se muestra el aviso.
    onBloqueado: () => { void releer(); },
    // Sin el riel: sus piezas y su «Armar mi oferta» son del análisis, que se hace en la tab Offer.
    conRiel: false,
    placeholder: placeholderDe(vista.etapa),
    vacia: SESION_VACIA,
    // NUNCA «Conectar mi propia IA» en el onboarding (18/10/2026, Martín): el onboarding usa el crédito de la plataforma
    // (ia-del-cliente-suscripcion), y el botón aparecía en la barra de «Entré a tu página pero casi no encontré texto…».
    // Sin `errorExtra`, el error queda con su «Reintentar». tests/onboarding-arranque.test.ts.
  };

  // ⛔ BLOQUEADO POR LA GUARDIA (lib/onboarding-guardia.ts, 17/10/2026): sin chat. El cliente lee que quedó en revisión;
  // el equipo de MaKo, mirándolo, ve el motivo, lo que escribió y «Desbloquear». Va DESPUÉS de todos los hooks.
  if (vista.bloqueo) {
    const desbloquear = async () => { if (ocupado) return; setOcupado(true); try { aplicar(await llamar({ action: 'desbloquear' })); } finally { setOcupado(false); } };
    return (
      <div className="arr-capa">
        <style>{CSS_ARRANQUE}</style>
        <main className="arr-bloqueo" role="status">
          <CriaturaMako size={64} reaccion="duda" />
          <p className="arr-bloqueo__titulo">{MENSAJE_BLOQUEADO}</p>
          {vista.equipo && (
            <div className="arr-tarjeta arr-bloqueo__equipo">
              <span className="arr-tarjeta__rotulo">Para el equipo · {vista.bloqueo.motivo}</span>
              {vista.equipo.ultimasFaltas.map((f, i) => <span key={i} className="arr-bloqueo__falta">{f}</span>)}
              <Button variant="primary" size="sm" loading={ocupado} onClick={() => void desbloquear()}>Desbloquear</Button>
            </div>
          )}
          {aviso && <span className="arr-bloqueo__falta">{aviso.texto}</span>}
        </main>
      </div>
    );
  }

  return (
    <div className={`arr-capa${saliendo ? ' arr-capa--sale' : ''}`}>
      <style>{CSS_ARRANQUE}</style>
      {/* La cabecera de la referencia que mandó Martín (17/10): la foto de MaKo, su nombre y «Tu onboarding», y una
          línea. Los mensajes van sueltos sobre el fondo, sin recuadro (CSS de abajo). */}
      <header className="arr-cabecera">
        <span data-mako-foto className="arr-foto" style={{ opacity: intro ? 0 : 1 }}>
          <CriaturaMako size={40} reaccion={ocupado ? 'piensa' : gesto ?? 'escucha'} />
        </span>
        <span className="arr-titulos">
          <span className="arr-nombre">MaKo</span>
          <span className="arr-sub">Tu onboarding</span>
        </span>
      </header>
      {aviso && (
        <div role="status" className="arr-aviso">
          <span style={{ flex: 1 }}>{aviso.texto}</span>
          {aviso.accion && <Button variant="secondary" size="sm" onClick={aviso.accion.onClick}>{aviso.accion.label}</Button>}
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar el aviso">✕</button>
        </div>
      )}
      <main className="arr-cuerpo">
        <OfferApp
          arranque={arranque}
          arbolInicial={arbolVacio}
          sesionInicial={vista.sesion}
          arbolFallo={false}
          opcionArmar={opcionArmar}
        />
      </main>
      {/* En el teléfono, la entrada de MaKo YA SE VIO acá: la de abrir la app (ShellM) no se repite en esta apertura. Se marca
          cuando se vio de verdad, no al terminar (cuarta revisión, 21/10: quien retomaba el onboarding en otra apertura no
          veía ninguna). */}
      {intro && <EntradaMako onFin={() => {
        setIntro(false);
        try { sessionStorage.setItem(CLAVE_ENTRADA_MOVIL, '1'); } catch { /* sin storage */ }
        void llamar({ action: 'intro' });
      }} />}
    </div>
  );
}

/** El CRM que propone (o eligió): su tipo y sus etapas, como lo va a ver en el tablero. */
function TarjetaCrm({ vista }: { vista: VistaArranque }) {
  const p = vista.crmPropuesta;
  const tipo = (vista.crmTipo && tipoCrmPorId(vista.crmTipo)) || (p && tipoCrmPorId(p.tipo)) || tipoRecomendado(vista.canal);
  // Con los nombres de SU negocio si MaKo los armó para este tipo (20/10/2026, el CRM a medida: lib/onboarding-crm.ts).
  const etapas = etapasConNombres(tipo.pipeline, p?.tipo === tipo.id ? p.etapas : null);
  return (
    <div className="arr-tarjeta">
      <span className="arr-tarjeta__rotulo">{vista.crmTipo ? 'Tu CRM' : 'Te propongo'}</span>
      <span className="arr-tarjeta__titulo">{tipo.label}</span>
      {/* Las etapas, numeradas y en orden, para que se lea el recorrido de un cliente (18/10/2026, punto 10). */}
      <ol className="arr-etapas">
        {etapas.map((s, i) => (
          <li key={`${s.key}-${i}`} className="arr-etapa"><span className="arr-etapa__n">{i + 1}</span>{s.label}</li>
        ))}
      </ol>
    </div>
  );
}

/** El teléfono de los avisos, con su lada. Después la persona le escribe a MaKo desde ese número (`TarjetaWhatsapp`). */
function TarjetaTelefono({ inicial, ocupado, onEnviar }: { inicial: string; ocupado: boolean; onEnviar: (telefono: string) => Promise<void> }) {
  const [lada, setLada] = useState(() => tarjetaConNumero(inicial).lada);
  const [numero, setNumero] = useState(() => tarjetaConNumero(inicial).numero);
  const listo = numero.replace(/\D/g, '').length >= 6;
  const enviar = () => { if (listo && !ocupado) void onEnviar(`${lada}${numero.replace(/\D/g, '')}`); };
  return (
    <div className="arr-tarjeta">
      <TelefonoConPais lada={lada} numero={numero} onLada={setLada} onNumero={setNumero} onEnter={enviar}
        placeholder="686 123 4567" inputStyle={CAMPO} />
      <Button variant="primary" size="sm" disabled={!listo || ocupado} loading={ocupado} onClick={enviar}>
        Seguir
      </Button>
    </div>
  );
}

/**
 * EL MENSAJE QUE LA PERSONA LE MANDA A MaKo (4/11/2026): MaKo no le escribe primero a nadie. El link abre su WhatsApp con el
 * texto escrito; cuando llega, la conversación sigue sola (el efecto de arriba lo pregunta).
 */
function TarjetaWhatsapp({ v, ocupado, onOtro }: { v: VistaEntrante | null; ocupado: boolean; onOtro: () => Promise<void> }) {
  if (!v || !v.link || v.estado === 'vencido') {
    return (
      <div className="arr-tarjeta">
        <span className="arr-tarjeta__nota">{v?.estado === 'vencido' ? 'Pasó mucho tiempo.' : 'No pude armar el mensaje.'}</span>
        <Button variant="primary" size="sm" loading={ocupado} disabled={ocupado} onClick={() => void onOtro()}>Pedir otro</Button>
      </div>
    );
  }
  return (
    <div className="arr-tarjeta">
      {v.estado === 'otro-numero' && v.otroNumero && (
        <span className="arr-tarjeta__nota">Me escribiste desde el +{v.otroNumero}. Mándalo desde el {v.telefono ? `+${v.telefono}` : 'número que diste'}, o cambia el número.</span>
      )}
      <div className="arr-links">
        <a className="arr-link arr-link--principal" href={v.link} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
      </div>
      <span className="arr-tarjeta__nota">Cuando llegue, sigo solo.</span>
    </div>
  );
}

const CAMPO = {
  width: '100%', boxSizing: 'border-box' as const, padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit',
};

/** El PDF con lo que vende: lo arma la ruta con las piezas de la conversación, cada vez (nunca queda viejo). */
/**
 * «Lo que vendes» se mira EN el chat (18/10/2026, Martín: «ni siquiera debería sacarme de la tab»). Antes era un link a
 * otra pestaña, y sin el `?ws=` el super admin que mira a un cliente caía en otro workspace: «No encontré esa oferta».
 * Las páginas llegan por `fetch` (WsFetch le pega el `?ws=`), y la descarga lleva el `?ws=` a mano (`conWs`).
 */
function TarjetaPdf({ sesionId }: { sesionId: number }) {
  const ws = useWs();
  const [viendo, setViendo] = useState(false);
  return (
    <div className="arr-links">
      <button type="button" className="arr-link" onClick={() => setViendo(true)}>Ver lo que vendes (PDF)</button>
      {viendo && <VisorPdf sesionId={sesionId} url={conWs(linkPdfLoQueVende(sesionId), ws)} onCerrar={() => setViendo(false)} />}
    </div>
  );
}

/**
 * El visor de «Lo que vendes», ENCIMA de todo el onboarding (18/10/2026, Martín, punto 6: «mira cómo se bugea la preview del
 * PDF»). El Modal de la casa quedaba dentro de la capa del chat: lo tapaban las respuestas rápidas y la caja de escribir, y
 * no ocupaba la pantalla. Éste va por portal a <body>, por encima de la capa (z 100) y debajo de la barra de inspección
 * (z 300), con su fondo, su cierre (✕, Escape o tocar afuera) y la descarga. tests/onboarding-pdf-en-el-chat.test.ts.
 */
function VisorPdf({ sesionId, url, onCerrar }: { sesionId: number; url: string; onCerrar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="arr-visor" role="dialog" aria-modal="true" aria-label="Lo que vendes" onClick={onCerrar}>
      <div className="arr-visor__caja" onClick={(e) => e.stopPropagation()}>
        <header className="arr-visor__cab">
          <b>Lo que vendes</b>
          <button type="button" className="arr-visor__x" aria-label="Cerrar" onClick={onCerrar}>×</button>
        </header>
        <div className="arr-visor__cuerpo"><VistaPdf sesionId={sesionId} tipo="lo-que-vendes" /></div>
        <footer className="arr-visor__pie"><a href={url} download className="arr-link arr-link--principal">Descargar PDF</a></footer>
      </div>
    </div>,
    document.body,
  );
}

/** «Entrar a MaKo»: el mismo `entrar` que el temporizador, así no corre dos veces ni en paralelo con el chat que se arma. */
function TarjetaListo({ onEntrar, entrando }: { onEntrar: () => void; entrando: boolean }) {
  return (
    <div className="arr-links">
      {/* Sin caminos para elegir (18/10/2026): entra solo a los 1,5 s (`MS_PARA_ENTRAR`). El botón queda por si la
          navegación no sale. */}
      <button type="button" onClick={onEntrar} disabled={entrando} className="arr-link arr-link--principal">
        {entrando ? 'Entrando…' : 'Entrar a MaKo'}
      </button>
    </div>
  );
}

const CSS_ARRANQUE = `
.arr-capa--sale { opacity: 0; transition: opacity .4s ease; }
@media (prefers-reduced-motion: reduce) { .arr-capa--sale { transition: none; } }
.arr-capa {
  position: fixed; top: var(--barra-agencia, 0px); right: 0; bottom: 0; left: 0; z-index: 100; background: var(--bg); display: flex; flex-direction: column;
  font-family: 'Geist', sans-serif; color: var(--ink);
}
.arr-cabecera {
  flex: none; display: flex; align-items: center; gap: 14px; padding: 18px max(16px, calc((100vw - 960px) / 2)) 16px;
  border-bottom: 1px solid var(--border);
}
.arr-foto { display: inline-flex; transition: opacity .2s ease; }
.arr-titulos { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.arr-nombre { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; }
.arr-sub { font-size: 13.5px; color: var(--primary); line-height: 1.2; }
.arr-aviso {
  flex: none; display: flex; align-items: center; gap: 10px; justify-content: space-between;
  margin: 10px max(16px, calc((100vw - 960px) / 2)) 0; padding: 10px 14px; border-radius: 12px;
  background: var(--warn-bg); border: 1px solid var(--warn); font-size: var(--fs-sm);
}
.arr-aviso button { border: none; background: none; color: var(--dim); cursor: pointer; font: inherit; }
.arr-cuerpo {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  padding: 8px max(16px, calc((100vw - 960px) / 2)) 16px;
}
/* SIN RECUADRO (17/10/2026, Martín: «Me gusta que el onboarding sea como la imagen que adjunto, sin recuadro de chat,
   sin el bloque»): la tarjeta del chat de Offer y el fondo de su hilo se vuelven transparentes, y los mensajes quedan
   sueltos sobre el fondo. Sólo acá: la tab Offer sigue con su tarjeta. Los estilos de la tarjeta van en línea, por eso el
   !important. Desde el 22/10/2026 el hilo y la caja son los del Ops Center (.co-hilo, .co-caja-wrap: OF4). */
.arr-capa .of-hilo { background: transparent !important; border: 0 !important; border-radius: 0 !important; }
.arr-capa .of-hilo .co-hilo { background: transparent; padding-inline: 0; }
.arr-capa .of-hilo .co-caja-wrap { padding-inline: 0; }
@media (max-width: 640px) {
  .arr-cabecera { padding: 12px 16px; gap: 12px; }
  .arr-nombre { font-size: 16px; }
  .arr-sub { font-size: 12.5px; }
  .arr-cuerpo { padding: 4px 12px 10px; }
  .arr-tarjeta { min-width: 0; }
}
.arr-tarjeta {
  display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px;
  background: var(--surface-2); border: 1px solid var(--border); min-width: min(320px, 100%);
}
.arr-tarjeta__rotulo { font-size: var(--fs-meta); color: var(--faint); text-transform: uppercase; letter-spacing: .06em; }
.arr-tarjeta__titulo { font-size: 15px; font-weight: 650; color: var(--ink); }
.arr-tarjeta__nota { font-size: 13px; color: var(--dim); line-height: 1.4; }
.arr-visor { position: fixed; top: var(--barra-agencia, 0px); right: 0; bottom: 0; left: 0; z-index: 250; display: grid; place-items: center; padding: 24px 16px; background: rgba(18,21,27,.55); }
.arr-visor__caja { width: min(760px, 100%); max-height: 100%; display: flex; flex-direction: column; background: var(--surface); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.25); overflow: hidden; }
.arr-visor__cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border); font-size: 17px; color: var(--ink); }
.arr-visor__x { border: 0; background: transparent; font-size: 26px; line-height: 1; cursor: pointer; color: var(--dim); padding: 0 4px; }
.arr-visor__cuerpo { flex: 1; min-height: 0; overflow-y: auto; }
.arr-visor__pie { display: flex; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid var(--border); }
.arr-etapas { display: flex; flex-direction: column; gap: 6px; margin: 4px 0 0; padding: 0; list-style: none; }
.arr-etapa {
  display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-radius: 10px; background: var(--surface);
  border: 1px solid var(--border); font-size: var(--fs-sm); color: var(--ink);
}
.arr-etapa__n {
  flex: none; display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%;
  background: var(--primary-bg); color: var(--primary); font-size: 12px; font-weight: 700;
}
.arr-links { display: flex; flex-wrap: wrap; gap: 8px; }
.arr-link {
  display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--surface); color: var(--ink); font-size: var(--fs-sm); font-weight: 600; text-decoration: none; font-family: inherit; cursor: pointer;
}
.arr-link:hover { border-color: var(--border-strong); }
.arr-link--principal { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.arr-link--espera { color: var(--faint); font-weight: 500; }
.arr-bloqueo {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
  padding: 24px 16px; text-align: center;
}
.arr-bloqueo__titulo { margin: 0; max-width: 420px; font-size: 17px; font-weight: 600; line-height: 1.45; color: var(--ink); }
.arr-bloqueo__equipo { max-width: 520px; width: 100%; text-align: left; }
.arr-bloqueo__falta { font-size: var(--fs-sm); color: var(--dim); overflow-wrap: anywhere; }
`;
