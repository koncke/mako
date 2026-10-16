'use client';

// =============================================================================
// /m/copywriting — la pantalla: las tres vistas de escritorio y «Escribir el próximo guion»
// =============================================================================
// Anuncios · Guiones · Analizar guion, como app/ads-writer/AdsWriterApp.tsx, con la vista en `?tab=`
// (la misma clave: un link de la computadora abre la misma vista). Abajo, fija, la acción primaria de
// escritorio: «Escribir el próximo guion» a la MISMA celda (`proximaCeldaDe`, app/ads-writer/reglas.ts),
// y al terminar se MUESTRA lo que escribió (escritorio abre la celda: «30-60 segundos de espera y
// ninguna señal de dónde quedó el guion» era el bug de antes). En Analizar guion no va: ahí la
// primaria es «Valorar guion», y dos primarias no son una.
//
// ⚠️ LA VISTA SE LEE DE LA URL (`useSearchParams`), nunca de un estado copiado de la prop (a
//    escritorio le pasó el 11/10: el «atrás» pintaba otra). Anuncios y Guiones ya bajaron con la
//    página: cambiar entre ellas es un `replaceState`. Analizar guion trae su historial del server, así
//    que ir ahí sin él es un `router.replace` en una transición, con esqueleto (molde: /m/experimentos).
// ⚠️ La matriz se ADOPTA cuando el server manda otra (tirar para refrescar), salvo con una escritura
//    en vuelo: su respuesta trae el estado entero y más nuevo (AGENTS.md, «refrescar anima y no trae
//    nada» si se copia la prop a un useState y no se resiembra). Si esa escritura FALLA, la copia que
//    llegó en el medio se adopta (`matrizSiFalla`, modelo.ts): si no, el próximo toque volvía a pagar IA
//    en una celda que el server ya había escrito.
// ⚠️ MaKo escribe UNO por vez (como la tarjeta de escritorio, que marca una sola celda): lo que llega
//    mientras tanto lo dice el toast, no se encola.
// =============================================================================

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { haptico } from '@/lib/haptico';
import { hrefDeVista, tabDeUrl, VISTA_POR_DEFECTO, type VistaAdsWriter } from '@/app/ads-writer/tabs';
import { proximaCeldaDe } from '@/app/ads-writer/reglas';
import {
  ComputadoraM, ErrorM, PieFijoM, SegmentadoM, SkeletonFilas, VacioM, useConexion, useToastM,
} from '@/app/m/_ui';
import { copiarTexto, escribirGuion } from './api';
import { AnalizarM } from './AnalizarM';
import { HojaAnuncioM, HojaGuionM } from './HojasM';
import { AnunciosM, GaleriaM } from './VistasM';
import {
  R, VISTAS, gruposDeAnuncios, guionDe, guionesRecientes, matrizSiFalla,
  type AvatarLite, type CeldaM, type DatosAnalizarM, type GuionM,
} from './modelo';

type Matriz = { celdas: CeldaM[]; avatares: AvatarLite[] };

export function CopywritingM({ celdas, avatares, pendiente, errorMatriz, analizar }: {
  celdas: CeldaM[];
  avatares: AvatarLite[];
  /** El onboarding de la tab no está hecho: escritorio abre su asistente (en la computadora). */
  pendiente: boolean;
  /** No se pudo leer la matriz (la base): no es «no hay anuncios». */
  errorMatriz: boolean;
  /** «Analizar guion» leído en el server. null = esta request no lo pidió. */
  analizar: DatosAnalizarM | null;
}) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const sp = useSearchParams();
  const vistaUrl = tabDeUrl(sp.get('tab') ?? undefined);

  // Analizar guion sin su historial: la vista se muestra YA y los datos llegan con la transición.
  const [pedida, setPedida] = useState<VistaAdsWriter | null>(null);
  const [trayendo, empezar] = useTransition();
  useEffect(() => { if (!trayendo) setPedida(null); }, [trayendo]);
  const vista = pedida ?? vistaUrl;

  const elegir = (v: VistaAdsWriter) => {
    if (v === vista) return;
    let destino = v === VISTA_POR_DEFECTO ? '/ads-writer' : `/ads-writer?tab=${v}`;
    try { destino = hrefDeVista(window.location.href, v); } catch { /* sin URL: el destino mínimo */ }
    if (v === 'analizar' && analizar == null) {
      setPedida(v);
      empezar(() => router.replace(destino, { scroll: false }));
      return;
    }
    setPedida(null);
    window.history.replaceState(null, '', destino);
  };

  // ── La matriz: la del server, y la que devuelve cada escritura ──
  const [matriz, setMatriz] = useState<Matriz>({ celdas, avatares });
  const [delServer, setDelServer] = useState<Matriz>({ celdas, avatares });
  // La última copia del server, para leerla DESPUÉS del await de una escritura (el render de antes no la ve).
  const delServerRef = useRef<Matriz>(delServer);
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const escribiendoRef = useRef<string | null>(null);
  if (delServer.celdas !== celdas || delServer.avatares !== avatares) {
    const llegada = { celdas, avatares };
    setDelServer(llegada);
    delServerRef.current = llegada;
    if (escribiendo == null) setMatriz(llegada);
  }

  const grupos = useMemo(() => gruposDeAnuncios(matriz.celdas, matriz.avatares), [matriz]);
  const guiones = useMemo(() => guionesRecientes(matriz.celdas, matriz.avatares), [matriz]);
  const proxima = useMemo(() => proximaCeldaDe(matriz.celdas, matriz.avatares), [matriz]);

  // ── Las hojas: el anuncio y el lector. Cada una guarda su FOTO para la salida (220 ms). ──
  const [hojaAnuncio, setHojaAnuncio] = useState<{ abierta: boolean; id: string | null; foto: CeldaM | null }>({ abierta: false, id: null, foto: null });
  const [hojaGuion, setHojaGuion] = useState<{ abierta: boolean; celdaId: string | null; guionId: string | null; foto: GuionM | null }>({ abierta: false, celdaId: null, guionId: null, foto: null });
  // Lo que se lee DESPUÉS de una escritura de 60 s: si la hoja del anuncio sigue abierta (un ref, no el render viejo).
  const anuncioAbierto = useRef<string | null>(null);
  useEffect(() => { anuncioAbierto.current = hojaAnuncio.abierta ? hojaAnuncio.id : null; }, [hojaAnuncio]);

  const celdaAbierta = matriz.celdas.find((c) => c.id === hojaAnuncio.id) ?? hojaAnuncio.foto;
  const guionAbierto = guionDe(matriz.celdas, matriz.avatares, hojaGuion.celdaId, hojaGuion.guionId) ?? hojaGuion.foto;

  const abrirAnuncio = (id: string) => {
    setHojaAnuncio({ abierta: true, id, foto: matriz.celdas.find((c) => c.id === id) ?? null });
  };
  const abrirGuion = (x: GuionM) => {
    setHojaGuion({ abierta: true, celdaId: x.celdaId, guionId: x.g.id, foto: x });
  };

  const copiar = async (texto: string) => {
    const ok = await copiarTexto(texto);
    if (ok) haptico('light');
    toast(ok ? 'Guion copiado' : 'No se pudo copiar');
  };

  /**
   * Que MaKo escriba el guion de esta celda (`guion-auto`, la misma acción que escritorio).
   * `mostrar` decide al TERMINAR si se abre lo escrito (la acción primaria, o la hoja del anuncio si
   * sigue abierta) o alcanza con el toast (la fila sin guion, como la tarjeta punteada de escritorio).
   */
  const escribir = async (celdaId: string, mostrar: () => boolean) => {
    if (escribiendoRef.current) { toast('Ya está escribiendo uno'); return; }
    if (!enLinea) { toast('Sin conexión'); return; }
    escribiendoRef.current = celdaId;
    setEscribiendo(celdaId);
    haptico('light');
    const alEmpezar = delServerRef.current;
    const r = await escribirGuion(celdaId);
    escribiendoRef.current = null;
    setEscribiendo(null);
    if (!r.ok) {
      // Lo que el server mandó mientras escribía no se pierde (modelo.ts → matrizSiFalla).
      const ahora = delServerRef.current;
      setMatriz((m) => matrizSiFalla({ enPantalla: m, delServerAlEmpezar: alEmpezar, delServerAhora: ahora }));
      haptico('error'); toast('No se pudo escribir'); return;
    }
    setMatriz({ celdas: r.celdas, avatares: r.avatares });
    const nuevo = r.guionNuevo ? guionDe(r.celdas, r.avatares, celdaId, r.guionNuevo.id) : null;
    if (nuevo && mostrar()) { haptico('success'); abrirGuion(nuevo); return; }
    toast('Guion escrito');
  };

  const [borrador, setBorrador] = useState('');

  const conMatriz = !errorMatriz && !pendiente && matriz.celdas.length > 0;
  let cuerpo: ReactNode;
  if (vista === 'analizar') {
    cuerpo = analizar && !trayendo
      ? <AnalizarM datos={analizar} guion={borrador} onGuion={setBorrador} />
      : <SkeletonFilas filas={5} />;
  } else if (errorMatriz) {
    cuerpo = <ErrorM frase="No pude leer los anuncios. No es nada tuyo." />;
  } else if (pendiente) {
    cuerpo = (
      <>
        <VacioM frase="Falta configurar Ads Writer." />
        <ComputadoraM que="Configurar Ads Writer" />
      </>
    );
  } else if (!matriz.celdas.length) {
    cuerpo = (
      <>
        <VacioM frase="Todavía no hay anuncios." />
        <ComputadoraM que="Armar la matriz" />
      </>
    );
  } else if (vista === 'anuncios') {
    cuerpo = (
      <AnunciosM grupos={grupos} escribiendo={escribiendo}
        onEscribir={(id) => { void escribir(id, () => false); }} onAbrir={abrirAnuncio} />
    );
  } else {
    cuerpo = <GaleriaM guiones={guiones} onAbrir={abrirGuion} onCopiar={(t) => { void copiar(t); }} />;
  }

  return (
    <div className="m-copywriting">
      <div className="m-copywriting-vistas">
        <SegmentadoM<VistaAdsWriter> etiqueta="Vista" valor={vista} onCambio={elegir}
          opciones={VISTAS.map((v) => ({ id: v.id, label: v.label }))} />
      </div>

      {cuerpo}

      {conMatriz && vista !== 'analizar' && (
        <PieFijoM>
          <Button variant="mako" size="lg" full icon={<Icon name="mako" size={18} />} loading={escribiendo != null}
            disabled={!proxima || !enLinea} onClick={() => { if (proxima) void escribir(proxima.id, () => true); }}>
            {escribiendo != null ? R.makoEscribiendo : proxima ? R.escribirProximo : R.todosConGuion}
          </Button>
        </PieFijoM>
      )}

      {conMatriz && (
        <>
          <HojaAnuncioM abierta={hojaAnuncio.abierta} celda={celdaAbierta} escribiendo={escribiendo} enLinea={enLinea}
            onCerrar={() => setHojaAnuncio((h) => ({ ...h, abierta: false }))}
            onAbrirGuion={(celdaId, guionId) => {
              const x = guionDe(matriz.celdas, matriz.avatares, celdaId, guionId);
              if (x) abrirGuion(x);
            }}
            onEscribir={(id) => { void escribir(id, () => anuncioAbierto.current === id); }} />
          <HojaGuionM abierta={hojaGuion.abierta} x={guionAbierto}
            onCerrar={() => setHojaGuion((h) => ({ ...h, abierta: false }))}
            onCopiar={(t) => { void copiar(t); }} />
        </>
      )}
    </div>
  );
}
