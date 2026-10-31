'use client';

// =============================================================================
// EstudioVideo — Video Generator copiado de ARCADS (27/10/2026)
// =============================================================================
// Martín, 27/10/2026: «implementar Video Generator, que nos quedó a medias... Tiene una cantidad de pestañas absurdas, el
// diseño, que se parezca a una app que tomemos de referencia». La referencia es Arcads (arcads.ai: «New Project», el guion,
// el actor de una biblioteca, «Generate»; los proyectos a la izquierda). Tres columnas, UNA ruta:
//   · IZQUIERDA, los proyectos (./BarraProyectos.tsx): «Nuevo anuncio» arriba, los anuncios en curso con en qué anda cada
//     uno, y los terminados. Abrir, crear o cambiar de proyecto NO cambia de ruta: el abierto viaja en `?plan=`
//     (`history.replaceState`, que Next sincroniza con `useSearchParams`) y se conserva el `?ws=` (./proyectos.ts).
//   · CENTRO, el proyecto: el anuncio nuevo en UNA pantalla (./Composer.tsx) o el anuncio abierto (WizardAnuncio, sin su
//     «Salir»: se cambia de proyecto en la barra).
//   · DERECHA, el chat de MaKo (./ChatVideo.tsx, el chat único de la app): todo lo que se hace con los botones se le puede
//     pedir, con las operaciones del registro (lib/api-mako/areas/video-estudio.def.ts). Cuando termina un turno, el estudio
//     relee los proyectos: lo que hizo MaKo ya está guardado.
// Los colores son los TOKENS de la casa (claro u oscuro según elija la persona): la tab dejó de forzar el oscuro.
// En una ventana angosta el chat pasa a ser un cajón («MaKo» arriba a la derecha) y, más angosta todavía, la barra también.
// =============================================================================

import './estudio.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import type { PlanGuardado, EstadoContextoVideo } from '../video-datos';
import type { GuionDisponible } from '../guiones-datos';
import type { AnuncioHecho } from '../anuncios-datos';
import type { Puente } from '@/lib/flow-cola';
import { puestaPorId } from '@/lib/puestas-data';
import { Icon } from '@/app/_components/icons';
import { AvisoPuente } from '../puente-avisos';
import { useExtensionInstalada, AvisoExtensionVieja, useExtensionVieja } from '../extension-instalada';
import { WizardAnuncio, textoCosto } from '../WizardAnuncio';
import { pedirSaldoAction, saldoAction } from '../video-action';
import { usePuenteVivo } from './usePuenteVivo';
import { planDeUrl, proyectoNuevo, tituloDeProyecto, urlConPlan } from './proyectos';
import { releerProyectosAction } from './acciones';
import { Composer } from './Composer';
import { BarraProyectos } from './BarraProyectos';
import { VerAnuncio } from './piezas';

// El chat trae el CSS de las piezas del Ops Center: va aparte, como en el Second Brain.
const ChatVideo = dynamic(() => import('./ChatVideo'), { ssr: false });

type Saldo = { creditos: number | null; at: string | null; tier: string };

export function EstudioVideo({ historialInicial, anunciosIniciales, guiones, contexto, puente: puenteInicial, saldo: saldoInicial, costoClip, franja }: {
  historialInicial: PlanGuardado[];
  anunciosIniciales: AnuncioHecho[];
  guiones: GuionDisponible[];
  contexto: EstadoContextoVideo | null;
  puente: Puente | null;
  saldo: Saldo;
  costoClip: { creditos: number; medido: boolean };
  /** Lo que usó de la prueba gratis (FranjaPrueba): arriba del centro. */
  franja?: React.ReactNode;
}) {
  const [historial, setHistorial] = useState(historialInicial);
  const [anuncios, setAnuncios] = useState(anunciosIniciales);
  const [saldo, setSaldo] = useState(saldoInicial);
  const [verAnuncio, setVerAnuncio] = useState<AnuncioHecho | null>(null);
  // En una ventana angosta: el chat y la barra son cajones. En una ancha estos dos no hacen nada (el CSS los ignora).
  const [chatAbierto, setChatAbierto] = useState(false);
  const [barraAbierta, setBarraAbierta] = useState(false);

  // ── El proyecto abierto: la URL (`?plan=`), no un estado aparte ──
  const sp = useSearchParams();
  const abiertoId = planDeUrl(`?${sp.toString()}`);
  const abierto = useMemo(() => historial.find((p) => p.id === abiertoId) ?? null, [historial, abiertoId]);
  const abrir = useCallback((id: string | null) => {
    window.history.replaceState(null, '', urlConPlan(window.location.href, id));
    setBarraAbierta(false);
  }, []);

  // ── El navegador del cliente: la extensión y el puente con Google Flow ──
  const { puente, ahora, anda } = usePuenteVivo(puenteInicial);
  const instalada = useExtensionInstalada();
  const extensionVieja = useExtensionVieja(instalada);
  const avisos = (
    <>
      <AvisoExtensionVieja instalada={instalada} />
      {!extensionVieja && !anda && <AvisoPuente puente={puente} ahora={ahora} instalada={instalada} />}
    </>
  );

  /** Lo que cuesta UNA toma, con el saldo real: la frase viaja al anuncio abierto (`textoCosto`, WizardAnuncio). */
  const costoDeUnaToma = useMemo(() => textoCosto(costoClip.creditos, { estimado: !costoClip.medido }), [costoClip]);

  /** El saldo se relee al abrir un anuncio: es el momento previo a gastar (y no en cada carga: es tráfico contra Google). */
  const refrescarSaldo = useCallback(async () => {
    const p = await pedirSaldoAction().catch(() => null);
    if (!p?.ok) return;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const s = await saldoAction(p.trabajoId).catch(() => null);
      if (s?.ok) { setSaldo(s.saldo); if (s.listo) return; }
    }
  }, []);
  useEffect(() => { if (abiertoId) void refrescarSaldo(); }, [abiertoId, refrescarSaldo]);

  /**
   * Lo que hizo MaKo por el chat ya está guardado: el estudio vuelve a leer. Si la base no contesta, se queda como estaba.
   * Si el turno creó un anuncio, se abre (`proyectoNuevo`), como el que se crea con el botón.
   */
  const historialRef = useRef(historial);
  useEffect(() => { historialRef.current = historial; }, [historial]);
  const releer = useCallback(() => {
    void releerProyectosAction().then((r) => {
      if (!r.ok) return;
      const nuevo = proyectoNuevo(historialRef.current, r.historial);
      setHistorial(r.historial);
      setAnuncios(r.anuncios);
      if (nuevo) abrir(nuevo);
    }).catch(() => {});
  }, [abrir]);

  const cambio = useCallback((it: PlanGuardado) => setHistorial((h) => h.map((e) => (e.id === it.id ? it : e))), []);

  const centro = abierto ? (
    <WizardAnuncio
      // Un anuncio nuevo es una pantalla nueva: el paso forzado del anterior no se hereda.
      key={abierto.id}
      item={abierto}
      contexto={contexto}
      puesta={puestaPorId(abierto.plan.puestaId)}
      costoTexto={costoDeUnaToma}
      saldo={saldo.creditos}
      onCambio={cambio}
      onSalir={() => abrir(null)}
      sinSalida
    />
  ) : (
    <Composer
      guiones={guiones}
      historial={historial}
      contexto={contexto}
      puenteAnda={anda}
      extensionVieja={extensionVieja}
      avisos={avisos}
      onCreado={(item, h) => { setHistorial(h); abrir(item.id); }}
      onAbrir={abrir}
    />
  );

  return (
    <div className="vgs" data-chat={chatAbierto ? 'abierto' : undefined} data-barra={barraAbierta ? 'abierta' : undefined}>
      <BarraProyectos
        historial={historial}
        anuncios={anuncios}
        abierto={abiertoId}
        onNuevo={() => abrir(null)}
        onAbrir={abrir}
        onVerAnuncio={setVerAnuncio}
      />
      {/* Un <section> y no un <main> (la página ya es el <main>, `Pagina`) ni un <aside> (`[data-barra-agencia] aside`, en
          app/globals.css, le fuerza a todo <aside> el alto de la ventana: el chat quedaba con la caja fuera de la vista). */}
      <section className="vgs-centro mk-scroll-y" aria-label={abierto ? tituloDeProyecto(abierto) : 'Nuevo anuncio'}>
        <div className="vgs-centro__barra">
          <button type="button" className="vgs-cajon-boton vgs-cajon-boton--barra" onClick={() => setBarraAbierta(true)} aria-label="Ver tus anuncios">
            <Icon name="videogen" size={16} /> Tus anuncios
          </button>
          <button type="button" className="vgs-cajon-boton vgs-cajon-boton--chat" onClick={() => setChatAbierto(true)} aria-label="Hablar con MaKo">
            <Icon name="mako" size={16} /> MaKo
          </button>
        </div>
        {franja}
        {abierto && <div className="vgs-avisos">{avisos}</div>}
        {centro}
      </section>
      <section className="vgs-chat" role="complementary" aria-label="Chat con MaKo">
        <ChatVideo
          abierto={abierto ? { id: abierto.id, titulo: tituloDeProyecto(abierto) } : null}
          onTurno={releer}
          onCerrar={() => setChatAbierto(false)}
        />
      </section>
      {(chatAbierto || barraAbierta) && (
        <button type="button" className="vgs-velo" aria-label="Cerrar" onClick={() => { setChatAbierto(false); setBarraAbierta(false); }} />
      )}
      {verAnuncio && <VerAnuncio anuncio={verAnuncio} onCerrar={() => setVerAnuncio(null)} />}
    </div>
  );
}
