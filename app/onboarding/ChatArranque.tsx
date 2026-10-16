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
//   · la animación del principio (./IntroMako.tsx) una sola vez, que termina con MaKo como foto del chat;
//   · el chat ES el motor de Offer (app/offer/OfferApp.tsx en modo `arranque`): la conversación de la
//     oferta va por /api/offer como en la tab; alrededor van los mensajes del arranque (quién es, el CRM, el
//     teléfono), que contesta /api/onboarding/arranque;
//   · lo que se crea (el CRM, la oferta, el plan) se ve ADENTRO del chat, en tarjetas; ir a otro lado es un
//     link que la persona elige.
// Las reglas (en qué etapa está, qué dice MaKo, qué se acepta) son puras: lib/onboarding-arranque.ts.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Button } from '@/app/_ui';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import { DIAL_DEFAULT } from '@/lib/paises';
import { tipoCrmPorId } from '@/lib/pipeline';
import { tipoRecomendado, type MensajeArranque } from '@/lib/onboarding-arranque';
import type { VistaArranque } from '@/lib/onboarding-arranque-server';
import type { ArbolOffer, OfferMensaje, OfferSesionVista } from '@/lib/offer-marco';
import { OfferApp, type ArranqueOffer } from '../offer/OfferApp';
import { IntroMako } from './IntroMako';
import { MunecoMako } from './MunecoMako';
import { SESION_VACIA, aMensajeOffer, ladoDeLaPregunta, mandaElArranque, placeholderDe, tarjetasDe, terminoElArranque } from './arranque-ui';

type Respuesta = { ok?: boolean; error?: string; vista?: VistaArranque; aviso?: string };

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
  const [intro, setIntro] = useState(!inicial.introVista && inicial.etapa === 'nombre');
  const [ocupado, setOcupado] = useState(false);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sesion, setSesion] = useState<OfferSesionVista | null>(inicial.sesion);
  const [plan, setPlan] = useState<{ url: string; n: number } | null>(null);
  const cerrando = useRef(false);
  const ligando = useRef<number | null>(null);

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

  const responder = async (cuerpo: { texto?: string; opcion?: number }, mostrar: string | null): Promise<boolean> => {
    if (ocupado) return false;
    setOcupado(true);
    setAviso(null);
    setPendiente(mostrar);
    try {
      return aplicar(await llamar({ action: 'responder', ...cuerpo }));
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
    void llamar({ action: 'sesion', sesionId: sesion.id }).then(aplicar);
  }, [sesion, vista.sesion?.id]);
  // Cada turno de la oferta puede cerrar la etapa (las piezas, el diagnóstico, la oferta armada): se relee.
  // ⚠️ Las dependencias son PRIMITIVAS: con el objeto `vista.sesion`, cada relectura trae uno nuevo y el
  // efecto se vuelve a disparar para siempre.
  const firma = sesion ? `${sesion.mensajes.length}:${sesion.puedeConcluir}:${sesion.conclusion?.version ?? 0}` : '';
  const sesionLigada = vista.sesion?.id ?? null;
  useEffect(() => { if (firma && sesionLigada != null) void releer(); }, [firma, releer, sesionLigada]);
  // Con todo contestado, se cierra el onboarding y MaKo escribe el plan de arranque (por detrás).
  useEffect(() => {
    if (vista.etapa !== 'cierre' || cerrando.current) return;
    cerrando.current = true;
    void (async () => {
      const r = await llamar({ action: 'cerrar' });
      aplicar(r);
      if (r.ok === false) { cerrando.current = false; return; }
      const p = await fetch('/api/onboarding/plan-arranque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then((x) => x.json()).catch(() => null) as { ok?: boolean; url?: string; n?: number } | null;
      if (p?.ok && p.url) setPlan({ url: p.url, n: Number(p.n ?? 0) });
    })();
  }, [vista.etapa]);

  // ── Lo que se dibuja ─────────────────────────────────────────────────────
  const lado = ladoDeLaPregunta(vista.etapa);
  // ⚠️ Memo: el hilo se vuelve a desplazar cada vez que cambia su lista de mensajes, y un arreglo nuevo en
  // cada tecla del composer lo haría con cada letra (el mismo cuidado que ChatOffer con los suyos).
  const { antes, despues } = useMemo(() => {
    const conPendiente = (lista: MensajeArranque[], aca: boolean): OfferMensaje[] => [
      ...lista.map(aMensajeOffer),
      ...(aca && pendiente ? [{ id: 'arr-pendiente', de: 'yo' as const, texto: pendiente, at: '' }] : []),
    ];
    return { antes: conPendiente(vista.antes, lado === 'antes'), despues: conPendiente(vista.despues, lado === 'despues') };
  }, [vista, pendiente, lado]);
  const tarjetas = useMemo(() => tarjetasDe([...vista.antes, ...vista.despues]), [vista]);
  const manda = mandaElArranque(vista.etapa);

  const extra = (m: OfferMensaje) => {
    const t = tarjetas.get(m.id);
    if (t === 'crm') return <TarjetaCrm vista={vista} />;
    if (t === 'telefono') return <TarjetaTelefono ocupado={ocupado} onEnviar={async (tel) => { setOcupado(true); setAviso(null); try { aplicar(await llamar({ action: 'telefono', telefono: tel })); } finally { setOcupado(false); } }} />;
    if (t === 'listo') return <TarjetaListo modo={vista.modo} plan={plan} />;
    return null;
  };

  const arranque: ArranqueOffer = {
    antes,
    despues,
    manda,
    onTexto: async (t) => {
      if (terminoElArranque(vista.etapa)) { setAviso('Tu oferta sigue en Offer.'); return false; }
      return responder({ texto: t }, t);
    },
    onOpcion: (idx) => {
      const ultimo = [...vista.antes, ...vista.despues].filter((m) => m.de === 'mako').pop();
      void responder({ opcion: idx }, ultimo?.opciones?.[idx] ?? null);
    },
    ocupado,
    extra,
    avatar: (animar) => <MunecoMako size={30} animo={animar ? 'trabajando' : 'despierto'} />,
    abrirEnFunnel: vista.modo === 'oferta' && vista.etapa !== 'nombre' && vista.etapa !== 'negocio' && vista.etapa !== 'objetivo' && !vista.sesion
      ? vista.funnelDefaultId : null,
    armar: vista.modo === 'oferta' && ['crm', 'telefono', 'codigo', 'armando'].includes(vista.etapa),
    onSesion: alCambiarSesion,
    conRiel: vista.modo === 'oferta' && !!sesion,
    placeholder: placeholderDe(vista.etapa),
    vacia: SESION_VACIA,
  };

  return (
    <div className="arr-capa">
      <style>{CSS_ARRANQUE}</style>
      <header className="arr-cabecera">
        <span data-mako-foto className="arr-foto" style={{ opacity: intro ? 0 : 1 }}>
          <MunecoMako size={36} animo={ocupado ? 'trabajando' : 'despierto'} />
        </span>
        <span className="arr-nombre">MaKo</span>
      </header>
      {aviso && (
        <div role="status" className="arr-aviso">
          <span>{aviso}</span>
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
      {intro && <IntroMako onFin={() => { setIntro(false); void llamar({ action: 'intro' }); }} />}
    </div>
  );
}

/** El CRM que propone (o eligió): su tipo y sus etapas, como lo va a ver en el tablero. */
function TarjetaCrm({ vista }: { vista: VistaArranque }) {
  const tipo = (vista.crmTipo && tipoCrmPorId(vista.crmTipo)) || tipoRecomendado(vista.canal);
  return (
    <div className="arr-tarjeta">
      <span className="arr-tarjeta__rotulo">{vista.crmTipo ? 'Tu CRM' : 'Te propongo'}</span>
      <span className="arr-tarjeta__titulo">{tipo.label}</span>
      <div className="arr-etapas">
        {tipo.pipeline.map((s, i) => (
          <span key={`${s.key}-${i}`} className="arr-etapa">{s.label}</span>
        ))}
      </div>
    </div>
  );
}

/** El teléfono de los avisos, con su lada. El código llega por WhatsApp y se escribe en el chat. */
function TarjetaTelefono({ ocupado, onEnviar }: { ocupado: boolean; onEnviar: (telefono: string) => Promise<void> }) {
  const [lada, setLada] = useState(DIAL_DEFAULT);
  const [numero, setNumero] = useState('');
  const listo = numero.replace(/\D/g, '').length >= 6;
  const enviar = () => { if (listo && !ocupado) void onEnviar(`${lada}${numero.replace(/\D/g, '')}`); };
  return (
    <div className="arr-tarjeta">
      <TelefonoConPais lada={lada} numero={numero} onLada={setLada} onNumero={setNumero} onEnter={enviar}
        placeholder="686 123 4567" inputStyle={CAMPO} />
      <Button variant="primary" size="sm" disabled={!listo || ocupado} loading={ocupado} onClick={enviar}>
        Enviarme el código
      </Button>
    </div>
  );
}

const CAMPO = {
  width: '100%', boxSizing: 'border-box' as const, padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit',
};

/** Lo que quedó armado, con links que la persona elige (el chat no se va solo a ningún lado). */
function TarjetaListo({ modo, plan }: { modo: VistaArranque['modo']; plan: { url: string; n: number } | null }) {
  return (
    <div className="arr-links">
      {modo === 'oferta' && <Link href="/crm" className="arr-link">Abrir mi CRM</Link>}
      {modo === 'oferta' && <Link href="/offer" className="arr-link">Seguir con mi oferta</Link>}
      {plan ? (
        <Link href={plan.url} className="arr-link">{plan.n > 0 ? `Mi plan de arranque · ${plan.n} tareas` : 'Mi plan de arranque'}</Link>
      ) : (
        <span className="arr-link arr-link--espera">Armando tu plan…</span>
      )}
      <Link href={modo === 'oferta' ? '/general' : '/plan'} className="arr-link arr-link--principal">Entrar a MaKo</Link>
    </div>
  );
}

const CSS_ARRANQUE = `
.arr-capa {
  position: fixed; inset: 0; z-index: 100; background: var(--bg); display: flex; flex-direction: column;
  font-family: 'Geist', sans-serif; color: var(--ink);
}
.arr-cabecera {
  flex: none; display: flex; align-items: center; gap: 10px; padding: 12px max(16px, calc((100vw - 1180px) / 2));
  border-bottom: 1px solid var(--border);
}
.arr-foto { display: inline-flex; transition: opacity .2s ease; }
.arr-nombre { font-size: 16px; font-weight: 650; letter-spacing: -0.01em; }
.arr-aviso {
  flex: none; display: flex; align-items: center; gap: 10px; justify-content: space-between;
  margin: 10px max(16px, calc((100vw - 1180px) / 2)) 0; padding: 10px 14px; border-radius: 12px;
  background: var(--warn-bg); border: 1px solid var(--warn); font-size: var(--fs-sm);
}
.arr-aviso button { border: none; background: none; color: var(--dim); cursor: pointer; font: inherit; }
.arr-cuerpo {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  padding: 16px max(16px, calc((100vw - 1180px) / 2)) 16px;
}
.arr-tarjeta {
  display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px;
  background: var(--surface-2); border: 1px solid var(--border); min-width: min(320px, 100%);
}
.arr-tarjeta__rotulo { font-size: var(--fs-meta); color: var(--faint); text-transform: uppercase; letter-spacing: .06em; }
.arr-tarjeta__titulo { font-size: 15px; font-weight: 650; color: var(--ink); }
.arr-etapas { display: flex; flex-wrap: wrap; gap: 6px; }
.arr-etapa {
  padding: 4px 10px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border);
  font-size: var(--fs-sm); color: var(--dim);
}
.arr-links { display: flex; flex-wrap: wrap; gap: 8px; }
.arr-link {
  display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--surface); color: var(--ink); font-size: var(--fs-sm); font-weight: 600; text-decoration: none;
}
.arr-link:hover { border-color: var(--border-strong); }
.arr-link--principal { background: var(--primary); border-color: var(--primary); color: #fff; }
.arr-link--espera { color: var(--faint); font-weight: 500; }
`;
