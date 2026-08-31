'use client';

// =============================================================================
// WizardAnuncio — un paso por pantalla, y en cada uno UNA sola cosa
// =============================================================================
// Martín, con la pantalla anterior delante: «El problema no es únicamente que la
// tab esté mal diseñada, está mal PLANTEADA DESDE EL ORIGEN. Es contraintuitiva,
// no se deduce qué hay que hacer en menos de 1 segundo. Tiene MUCHOS textos. Ya
// muchas veces hablamos de hacer todo modular, que sea 1 SOLO PASO A LA VEZ.
// Hacer cosas GRANDES, ENORMES, en lugar de muchas cosas juntas, con mucho
// texto, chiquito.»
//
// ⚠️ Y el error que hubo que deshacer para llegar acá: la versión anterior
// COMPACTÓ la pantalla —dos listas en una, la mitad de alto, menos avisos— y
// siguió estando mal. Compactar una pantalla sobrecargada la deja sobrecargada y
// más chica. Lo que se pide es SACAR pasos de la pantalla, no acomodarlos mejor.
//
// ── Las cuatro reglas, y ninguna es negociable ─────────────────────────────
//   1. UNA decisión por pantalla. Tres decisiones son tres pantallas.
//   2. El objeto de la decisión ocupa el alto útil (`--wz-lienzo`).
//   3. Tope de 25 palabras de chrome —pregunta, botón, consecuencia, atrás—.
//      El guion y lo que escribió MaKo son CONTENIDO y no cuentan.
//   4. Un solo botón que avanza. Lo demás es «atrás» o se pliega.
//
// El test es literal: alguien mira la pantalla UN SEGUNDO y tiene que saber qué
// hacer. Un segundo no alcanza para leer un párrafo, así que la respuesta vive en
// el TAMAÑO y en que haya una sola cosa.
//
// ── La posición sale del DATO ──────────────────────────────────────────────
// No hay índice de paso ni memoria de clicks: `pasoDe()` mira el plan y contesta
// dónde está. Es el mismo patrón que ya usaba `escenaAbierta()`, extendido al
// flujo entero. Con eso, recargar cae en el mismo lugar y no existe el estado
// «la pantalla cree que voy en la 4 y el dato dice otra cosa».

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Button, Tag, Status, TextField, MONO } from '@/app/_ui';
import { Icon } from '../_components/icons';
import type { PlanGuardado, EstadoContextoVideo } from './video-datos';
import type { Puesta } from '@/lib/puestas-data';
import { causaFlow, textoFlow, type CausaFlow } from '@/lib/flow-fallo-texto';
import {
  escribirEscenasAction, corregirEscenaAction, generarImagenAction, estadoImagenAction,
  elegirImagenAction, subirImagenEscenaAction, confirmarEscenaAction,
  generarTomaAction, estadoTomaAction, descartarTomaAction, marcarCaraVistaAction,
  cambiarMuletillasAction,
} from './video-action';
import { editarLineaPlanAction, reescribirTomaAction } from './actions';
import { EditarTexto } from '../components/SeccionCard';

/**
 * El alto de lo enorme.
 *
 * Contra el VIEWPORT y no contra el padre: en un `<main>` con `flex: 1` el alto
 * del padre es indefinido para el motor, y un porcentaje contra un alto
 * indefinido no resuelve — Chrome lo aguanta y Safari devuelve CERO, que es una
 * pantalla en blanco. Ya pasó en este repo y se reportó tres veces como «el plan
 * está vacío» desde una Mac.
 */
const LIENZO = 'min(62vh, 720px)';
const ANCHO_CUERPO = 880;

// ── Dónde está el anuncio ───────────────────────────────────────────────────

type Paso =
  | { id: 'guion-leer' }
  | { id: 'escenario'; n: number }
  | { id: 'cara' }
  | { id: 'toma'; n: number }
  | { id: 'listo' };

/**
 * El paso en el que está el anuncio, DERIVADO del plan.
 *
 * El orden de las preguntas es el orden de la producción: se lee el guion, se
 * fija cada lugar, se mira la cara una vez, se filma toma por toma.
 */
export function pasoDe(item: PlanGuardado, forzado: Paso | null): Paso {
  if (forzado) return forzado;
  const escenas = item.escenas ?? [];
  if (!escenas.length) return { id: 'guion-leer' };

  const sinConfirmar = escenas.find((e) => !item.imagenes?.[String(e.n)]?.confirmada);
  if (sinConfirmar) return { id: 'escenario', n: sinConfirmar.n };

  const tomas = item.plan.clips;
  const uno = item.video?.['1'];
  // La cara se mira UNA vez, y justo cuando existe la evidencia para mirarla: con
  // la toma 1 lista y ninguna otra. Antes no hay qué comparar; después ya se
  // heredó en seis clips pagados.
  if (uno?.url && !item.caraVista) return { id: 'cara' };

  const falta = tomas.find((c) => !item.video?.[String(c.n)]?.url);
  if (falta) return { id: 'toma', n: falta.n };
  return { id: 'listo' };
}

/** El mapa que ve el indicador de progreso. Sale del dato, como la posición. */
function mapaDe(item: PlanGuardado): string[] {
  const escenas = item.escenas ?? [];
  return [
    'guion-leer',
    ...(escenas.length ? escenas.map((e) => `escenario-${e.n}`) : ['escenario-1']),
    'toma-1', 'cara',
    ...item.plan.clips.slice(1).map((c) => `toma-${c.n}`),
    'listo',
  ];
}

function clave(p: Paso): string {
  return p.id === 'escenario' || p.id === 'toma' ? `${p.id}-${p.n}` : p.id;
}

// ── Piezas ──────────────────────────────────────────────────────────────────

/**
 * Un 9:16 a tamaño de decisión. Es lo enorme de casi todas las pantallas.
 *
 * Sobre negro y SIN BORDE: un borde le pone marco a lo que tiene que no tenerlo.
 * Lo que separa el medio del fondo es su propio contenido, no una línea.
 */
function Vertical({ children, fondo }: { children: React.ReactNode; fondo?: string }) {
  return (
    <div style={{
      height: LIENZO, aspectRatio: '9 / 16', borderRadius: 18, overflow: 'hidden',
      // `--surface-2` y no un gris más oscuro: la regla de la casa es que en
      // oscuro las superficies SUBEN de luminosidad. El negro se pasa explícito
      // donde hay un video, que es el único lugar donde el negro es el fondo
      // correcto porque es el fondo del propio medio.
      background: fondo ?? 'var(--surface-2)', position: 'relative', flex: 'none',
      display: 'grid', placeItems: 'center',
      // La sombra hace que el medio FLOTE sobre el negro en vez de estar pegado.
      boxShadow: '0 24px 70px rgba(0,0,0,.55)',
    }}>
      {children}
    </div>
  );
}

const MEDIO: React.CSSProperties = {
  display: 'block', width: '100%', height: '100%', objectFit: 'cover',
};

/**
 * Lo que acaba de llegar aparece DESDE la niebla, no la reemplaza de golpe.
 *
 * Es el momento que el dueño pidió hacer épico, y no es un adorno: describe lo
 * que de verdad pasó — una imagen que se terminó de resolver. El desenfoque que
 * se va es el mismo gesto que la niebla que estaba abajo. Un corte seco, en
 * cambio, hace que noventa segundos de espera terminen sin que pase nada.
 */
function Revela({ children, k }: { children: React.ReactNode; k: string }) {
  return <div key={k} className="mk-revelar" style={{ width: '100%', height: '100%' }}>{children}</div>;
}

/** La niebla de Flow, a tamaño real. Con el reloj, que es lo único cierto. */
function Niebla({ etiqueta, desde }: { etiqueta: string; desde: number }) {
  const [ahora, setAhora] = useState(desde);
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seg = Math.max(0, Math.round((ahora - desde) / 1000));
  return (
    <div
      className="mk-lienzo mk-lienzo--estudio"
      style={{ width: '100%', height: '100%', borderRadius: 0 }}
      role="status"
      aria-label={etiqueta}
    >
      {/* Como en Flow: el ícono arriba a la izquierda y el contador a la derecha.
          Lo de Flow es un PORCENTAJE porque su servidor se lo dice; el nuestro no
          lo sabe, así que va el tiempo, que es cierto. Un número inventado que
          avanza solo es la clase de mentira que después nadie perdona. */}
      <div style={{
        position: 'absolute', inset: '16px 18px auto 18px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Blanco a mano, y acá SÍ corresponde: van sobre la niebla, que es un
            gris fijo medido contra Flow y no cambia con el tema. */}
        <span style={{ color: 'rgba(255,255,255,.75)', lineHeight: 0 }}>
          <Icon name="tvad" size={19} />
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 14, color: 'rgba(255,255,255,.75)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {`${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`}
        </span>
      </div>
    </div>
  );
}

/** Un video que se reproduce solo, y un play si el navegador no deja. */
function Clip({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [trabado, setTrabado] = useState(false);
  useEffect(() => {
    // ⚠️ El autoplay se RECHAZA cuando se entra por `?plan=` sin ningún gesto
    // previo, que es el caso normal al volver a un anuncio. Sin este fallback, un
    // clip que el navegador no deja arrancar se ve igual que uno que salió mudo.
    ref.current?.play().catch(() => setTrabado(true));
  }, [src]);
  return (
    <>
      <video ref={ref} key={src} src={src} controls loop playsInline style={MEDIO} />
      {trabado && (
        <button
          type="button"
          onClick={() => { void ref.current?.play(); setTrabado(false); }}
          aria-label="Reproducir"
          style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            background: 'rgba(0,0,0,.25)', border: 'none', cursor: 'pointer', color: '#fff',
          }}
        >
          <Icon name="play" size={64} />
        </button>
      )}
    </>
  );
}

/** El rótulo de un panel de comparación. Dos palabras, abajo, sin adornos. */
function Pie({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      textAlign: 'center', marginTop: 12, fontSize: 'var(--fs-sm)',
      color: 'var(--dim)', fontWeight: 600,
    }}>
      {children}
    </div>
  );
}

/** Las salidas del «no». Plegadas: en un segundo no se ve lo que hay adentro. */
function Salidas({ resumen, children }: { resumen: string; children: React.ReactNode }) {
  return (
    <details style={{ marginTop: 4 }}>
      <summary style={{
        cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--dim)',
        textAlign: 'center', listStyle: 'none',
      }}>
        {resumen}
      </summary>
      <div style={{
        display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12,
      }}>
        {children}
      </div>
    </details>
  );
}

/**
 * EL ESTUDIO: la pantalla donde se produce, sin caja de formulario.
 *
 * Martín: *«elimina el contenedor tipo form que ya tenemos. La generación de
 * video e imágenes tiene que ser mucho más épica.»*
 *
 * `WizardShell` es el chrome correcto para una PREGUNTA con un input debajo —una
 * tarjeta con header, dots y footer— y es exactamente el marco equivocado para
 * mirar un video vertical de 720 px: le pone borde a lo que tiene que no tener
 * borde, y convierte «mirá esto» en «completá esto».
 *
 * El fondo NEGRO está medido sobre cuadros reales de Flow, no elegido: su lienzo
 * de generación vive sobre negro puro. Un gris oscuro se lee como una caja más
 * oscura; el negro desaparece y deja sólo el medio.
 *
 * Lo que sobrevive del wizard es lo único que hacía falta: la posición, un solo
 * botón que avanza, y una salida. Todo flota sobre el negro, sin encerrar nada.
 */
function Estudio({ pregunta, titulo, paso, total, children, boton, consecuencia, cargando, onSiguiente, atras, onAtras, onSalir, error, vistaPrevia }: {
  pregunta: string;
  titulo?: string;
  paso: number;
  total: number;
  children: React.ReactNode;
  boton?: string;
  consecuencia?: string;
  cargando?: boolean;
  onSiguiente?: () => void;
  atras?: string;
  onAtras?: () => void;
  onSalir: () => void;
  error?: string;
  /** La tira de previsualización del formato. Va arriba a la derecha. */
  vistaPrevia?: React.ReactNode;
}) {
  return (
    <div className="mk-estudio">
      {/* ── LA BARRA DE ARRIBA ──────────────────────────────────────────────
          SALIR a la izquierda y del todo arriba, que es donde se lo busca.
          ⚠️ No pregunta nada al salir, y eso es correcto ACA: el anuncio se
          guarda entero en cada paso —el guion, los escenarios, cada imagen
          confirmada, cada toma— asi que salir no pierde nada y volver a entrar
          cae en el mismo lugar. Preguntar «¿seguro?» sobre algo que no se pierde
          es enseñar a ignorar las preguntas. */}
      <div style={{
        display: 'flex', alignItems: 'center', width: '100%', maxWidth: 900, gap: 16,
      }}>
        <button type="button" onClick={onSalir} style={salida}>← Salir</button>
        <div style={{ flex: 1 }} />
        {vistaPrevia}
      </div>

      {/* La barra de posición: segmentos finos, no dots de formulario. Dice
          dónde estás sin pedir nada y sin ocupar una fila entera. */}
      <div style={{
        display: 'flex', gap: 4, width: '100%', maxWidth: 520, alignItems: 'center',
      }}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i < paso ? 'var(--ink)' : 'var(--border-strong)',
              transition: 'background .35s ease',
            }}
          />
        ))}
      </div>

      {/* LA PREGUNTA, grande y sola. Es lo que se lee en el primer segundo. */}
      <div style={{ textAlign: 'center', maxWidth: 720 }}>
        <h2 style={{
          margin: 0, fontSize: 'clamp(22px, 2.2vw, 31px)', fontWeight: 640,
          letterSpacing: '-.02em', lineHeight: 1.2, color: 'var(--ink)',
        }}>
          {pregunta}
        </h2>
        {titulo && (
          <p style={{
            margin: '9px 0 0', fontSize: 'var(--fs-md)', lineHeight: 1.45,
            color: 'var(--dim)',
          }}>
            {titulo}
          </p>
        )}
      </div>

      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{children}</div>

      {error && (
        <div style={{
          fontSize: 'var(--fs-sm)', color: 'var(--bad)', textAlign: 'center', maxWidth: 560,
        }}>
          {error}
        </div>
      )}

      {boton && (
        <div style={{ textAlign: 'center' }}>
          {/* «Volver» AL LADO del principal y en peso bajo. Antes vivía al pie de
              la pantalla, lejos de lo que sigue: el par de salidas de un paso se
              lee junto o no se lee. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            {onAtras && (
              <Button variant="tertiary" onClick={onAtras}>{atras ?? 'Volver'}</Button>
            )}
            {/* ⚠️ EL QUE AVANZA TIENE QUE PESAR MÁS QUE TODO LO DEMÁS.
                Con `size="xl"` a secas quedaba del mismo porte que el «Volver»
                de al lado, y en una pantalla cuyo trabajo entero es «mirá esto y
                seguí» eso deja las dos salidas empatadas. Se le da ancho mínimo y
                aire propio: el peso de un botón es lo que dice, en un segundo,
                cuál es el camino. */}
            <div style={{ minWidth: 220 }}>
              <Button
                variant="primary"
                size="xl"
                full
                loading={cargando}
                disabled={!onSiguiente}
                onClick={onSiguiente}
              >
                {boton}
              </Button>
            </div>
          </div>
          {/* La consecuencia PEGADA al botón y antes del click. En blanco al 70%:
              se lee, y no compite con el botón. */}
          {consecuencia && (
            <div style={{
              marginTop: 10, fontSize: 'var(--fs-sm)', color: 'var(--dim)',
            }}>
              {consecuencia}
            </div>
          )}
        </div>
      )}

      {/* ⚠️ ACÁ HABÍA UN SEGUNDO PAR DE SALIDAS, al pie de todo. «Volver» subió
          al lado del botón que avanza y «Salir» subió a la barra de arriba: el
          mismo botón dibujado en dos lugares es el que nadie encuentra en
          ninguno. */}
    </div>
  );
}

const salida: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 'var(--fs-sm)', color: 'var(--faint)', padding: 4,
};

/**
 * El formato elegido, mirable en cualquier momento y ocultable.
 *
 * Martín: *«cuando estoy creando, sería bueno siempre poder previsualizar el
 * template que elegí, y que se pueda ocultar cuando quiera»*.
 *
 * Es una pregunta que aparece en cualquier paso —«¿esto era Car Talks?»— y hasta
 * ahora había que salir al catálogo para contestarla, o sea perder el lugar. El
 * ejemplo es un video de diez segundos, mudo y en loop: contesta mirándolo, que
 * es más rápido que cualquier texto que se pudiera escribir al lado.
 *
 * ⚠️ ARRANCA ABIERTA, y lo pidió el dueño: *«la preview por defecto tiene que
 * estar abierta»*. Yo la había dejado cerrada por miedo a que el video en
 * movimiento compitiera con lo que hay que mirar — pero vive en la esquina
 * superior derecha, fuera de la columna central, y la referencia sirve mientras
 * se lee el guion, no después. Cerrada, la respuesta está a un click de
 * distancia de una pregunta que aparece sola.
 */
function VistaPrevia({ puesta }: { puesta: Puesta | undefined }) {
  const [abierta, setAbierta] = useState(true);
  if (!puesta?.ejemplo) return null;
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        style={{ ...salida, display: 'flex', alignItems: 'center', gap: 7 }}
      >
        <Icon name={abierta ? 'x' : 'play'} size={13} />
        {/* El NOMBRE va siempre, abierta o cerrada: es el único lugar donde se
            lee cómo se llama el formato con el que se está trabajando, y con la
            vista abierta era justo cuando desaparecía. */}
        {abierta ? `Ocultar · ${puesta.nombre}` : `Ver el formato · ${puesta.nombre}`}
      </button>
      {abierta && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 40,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 10, boxShadow: '0 18px 50px rgba(0,0,0,.45)',
        }}>
          <video
            src={puesta.ejemplo.video}
            poster={puesta.ejemplo.poster}
            autoPlay
            loop
            muted
            playsInline
            style={{
              display: 'block', width: 150, aspectRatio: '9 / 16',
              objectFit: 'cover', borderRadius: 10, background: '#000',
            }}
          />
          {/* ⚠️ ACÁ DECÍA `puesta.tecnico` —«Selfie en movimiento»— y el dueño lo
              marcó: no es como se llama el formato. El nombre es «Car Talks»; lo
              otro es la técnica con la que está hecho, que es un dato del
              catálogo y no su nombre. Y como el botón que la abre YA dice el
              nombre, acá no va ninguno: repetirlo abajo era la tercera línea de
              texto de una esquina que no tiene que tener ninguna. */}
        </div>
      )}
    </div>
  );
}

// ── El wizard ───────────────────────────────────────────────────────────────

export function WizardAnuncio({ item, contexto, puesta, costoTexto, onCambio, onSalir }: {
  item: PlanGuardado;
  contexto: EstadoContextoVideo | null;
  puesta: Puesta | undefined;
  /** Lo que cuesta una toma, ya redactado por quien sabe el saldo. */
  costoTexto: string;
  onCambio: (item: PlanGuardado) => void;
  onSalir: () => void;
}) {
  const [forzado, setForzado] = useState<Paso | null>(null);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [ajuste, setAjuste] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [desde, setDesde] = useState(() => Date.now());
  const archivo = useRef<HTMLInputElement>(null);

  const paso = pasoDe(item, forzado);
  const mapa = useMemo(() => mapaDe(item), [item]);
  const total = item.plan.clips.length;

  const correr = useCallback(async (
    etiqueta: string,
    fn: () => Promise<{ ok: boolean; item?: PlanGuardado; error?: string }>,
    avanzar = true,
  ) => {
    setOcupado(etiqueta);
    setError('');
    setDesde(Date.now());
    const r = await fn().catch(() => ({ ok: false as const, error: 'No se pudo. Vuelve a intentarlo.' }));
    if (r.ok && r.item) {
      onCambio(r.item);
      // Al avanzar se suelta el paso forzado: la posición vuelve a salir del dato.
      if (avanzar) setForzado(null);
    } else {
      setError(r.error || 'No se pudo.');
    }
    setOcupado('');
  }, [onCambio]);

  // ── El sondeo, uno solo y para las dos esperas ──────────────────────────
  // La imagen del escenario y el clip de la toma esperan igual y se apagan igual.
  const escenaEnCurso = (item.escenas ?? []).find((e) => {
    const m = item.imagenes?.[String(e.n)];
    return !!m?.trabajoId && !m?.opciones?.length && !m?.error;
  });
  const tomaEnCurso = item.plan.clips.find((c) => {
    const v = item.video?.[String(c.n)];
    return !!v && !v.url && !v.error;
  });

  useEffect(() => {
    if (!escenaEnCurso && !tomaEnCurso) return;
    let vivo = true;
    const t = setInterval(async () => {
      const r = escenaEnCurso
        ? await estadoImagenAction(item.id, escenaEnCurso.n).catch(() => null)
        : await estadoTomaAction(item.id, tomaEnCurso!.n).catch(() => null);
      if (vivo && r?.ok) onCambio(r.item);
    }, escenaEnCurso ? 4000 : 6000);
    return () => { vivo = false; clearInterval(t); };
  }, [escenaEnCurso, tomaEnCurso, item.id, onCambio]);

  /**
   * Al llegar al paso del lugar SIN escenarios, MaKo los escribe solo.
   *
   * ⚠️ Esto es la otra mitad de que «Siguiente» no espere. Antes ese botón se
   * quedaba quieto quince segundos llamando al modelo, y un botón que dice
   * «Siguiente» y no pasa nada se lee como colgado. Ahora avanza al instante y la
   * espera ocurre ACÁ, donde aparece el resultado y donde ya hay una niebla que
   * la cuenta.
   *
   * `escribiendo` es un ref y no un estado: alcanza con que no se dispare dos
   * veces, y un estado extra volvería a renderizar sin que nada cambie en
   * pantalla.
   */
  const escribiendo = useRef(false);
  useEffect(() => {
    if (paso.id !== 'escenario') return;
    if ((item.escenas?.length ?? 0) > 0 || escribiendo.current || ocupado) return;
    escribiendo.current = true;
    void (async () => {
      const r = await escribirEscenasAction(item.id).catch(() => null);
      if (r?.ok) onCambio(r.item);
      else setError(r?.error || 'MaKo no pudo escribir los escenarios.');
      escribiendo.current = false;
    })();
  }, [paso, item.id, item.escenas, ocupado, onCambio]);

  const subir = useCallback((n: number, f: File | null) => {
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      void correr('subir', () => subirImagenEscenaAction(item.id, n, String(lector.result || '')), false);
    };
    lector.readAsDataURL(f);
  }, [correr, item.id]);

  // ── Las siete pantallas ────────────────────────────────────────────────
  const p = pantalla();

  function pantalla(): {
    pregunta: string; titulo?: string; sub?: string; cuerpo: React.ReactNode;
    boton?: string; consecuencia?: string; onSiguiente?: () => void;
    atras?: string; onAtras?: () => void; cargandoBoton?: boolean;
  } {
    // ── 1. El guion ───────────────────────────────────────────────────────
    if (paso.id === 'guion-leer') {
      const seg = item.plan.clips[0]?.segundos ?? 8;
      // Del DATO, no de un estado que haya que recordar: un plan sin adaptar
      // marca TODAS sus tomas como literales.
      const conMuletillas = item.plan.clips.some((c) => !c.literal);
      return {
        // ⚠️ LITERAL, no ingeniosa. Martín: «los títulos que les pones no me
        // gustan, tienen que ser más literales». «¿Dice lo que quieres decir?»
        // suena bien y no nombra la cosa: lo que se está haciendo es APROBAR EL
        // GUION, y eso es lo que tiene que decir.
        pregunta: '¿Apruebas el guion?',
        // ⚠️ ESTA LÍNEA CONTESTA LA PREGUNTA QUE NADIE HACÍA EN VOZ ALTA.
        //
        // Martín: «no se entiende por qué se divide en 7 clips. Nosotros lo
        // entendemos, pero un usuario nuevo no entiende». La pantalla mostraba
        // siete bloques numerados y en ningún lado decía por qué son siete.
        //
        // Son siete porque un clip de Flow dura como máximo esos segundos, y el
        // guion se reparte para que entre. Dicho así son siete palabras y no
        // hace falta ninguna explicación más — y el `8s` de cada renglón lo
        // vuelve a decir sin decirlo.
        sub: `Se filma en ${item.plan.clips.length} tomas de ${seg} segundos.`,
        cuerpo: (
          <div style={{ width: '100%', maxWidth: 760, margin: '0 auto' }}>
            {item.plan.clips.map((c) => (
              <div
                key={c.n}
                style={{
                  display: 'flex', gap: 18, padding: '18px 0', alignItems: 'flex-start',
                  borderTop: c.n === 1 ? 'none' : '1px solid var(--border)',
                }}
              >
                {/* El número manda sobre los segundos —es como se nombra una
                    toma, «cambiá la 3»— y los segundos van abajo, chicos: se
                    consultan, no se buscan. Y son los que explican el corte. */}
                <div style={{ flex: 'none', width: 34, textAlign: 'right', paddingTop: 4 }}>
                  <div style={{ fontFamily: MONO, fontSize: 15, color: 'var(--dim)', lineHeight: 1.1 }}>
                    {c.n}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>
                    {c.segundos}s
                  </div>
                </div>
                {/* ⚠️ `minWidth: 0` y `overflowWrap`: sin los dos, un hijo de un
                    flex no puede achicarse por debajo del ancho de su contenido y
                    empuja la fila. Es la mitad del scroll horizontal que había. */}
                <div style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                  <EditarTexto
                    valor={c.voz}
                    multiline
                    enfasis
                    className="mk-edit--visible"
                    disabled={ocupado === 'linea'}
                    onSave={(v) => void correr('linea', () => editarLineaPlanAction(item.id, c.n, v), false)}
                    style={{
                      fontSize: 'clamp(17px, 1.35vw, 21px)', lineHeight: 1.5,
                      color: c.habla ? 'var(--ink)' : 'var(--dim)',
                      fontStyle: c.habla ? 'normal' : 'italic',
                    }}
                  />
                  {(c.palabras ?? 0) > (c.tope ?? 0) && (
                    <div style={{ marginTop: 7 }}>
                      <Status tono="warn">No entra en {c.segundos} segundos</Status>
                    </div>
                  )}
                </div>
              </div>
            ))}

          </div>
        ),
        // ⚠️ «Siguiente», y NO «Escribir dónde se filma».
        //
        // Dos razones, y las dos son de Martín. La primera: el nombre no era
        // descriptivo — nombraba lo que pasa POR DENTRO, no lo que la persona
        // está haciendo, que es avanzar. La segunda es más fuerte: ese botón
        // TARDABA, porque esperaba a que MaKo escribiera los escenarios antes de
        // cambiar de pantalla. Un botón que dice «Siguiente» y se queda quieto
        // quince segundos se lee como colgado.
        //
        // Ahora avanza SIEMPRE y al instante; la espera ocurre en la pantalla
        // siguiente, que es donde aparece el resultado y donde ya hay una niebla
        // que la cuenta.
        boton: 'Siguiente',
        // ⚠️ SIN consecuencia y SIN «Volver», y las dos por el mismo motivo: no
        // aportan nada y ocupan un renglón cada una.
        //
        // «No gasta créditos» contesta un miedo que en este paso nadie tiene —
        // leer un guion no sugiere que se esté por gastar algo—; la línea sirve
        // pegada al botón que SÍ gasta, y ahí sigue. Y «Volver al catálogo» es
        // exactamente lo que hace el «Salir» de arriba: el mismo botón dibujado
        // dos veces es el que no se encuentra en ninguno.
        onSiguiente: () => setForzado({ id: 'escenario', n: 1 }),
      };
    }

    // ── 2. El lugar ───────────────────────────────────────────────────────
    if (paso.id === 'escenario') {
      const escena = (item.escenas ?? []).find((e) => e.n === paso.n);
      // Todavía no llegaron los escenarios: MaKo los está escribiendo (el efecto
      // de arriba). La pantalla lo dice con la misma niebla que todo lo demás.
      const sinEscenas = !escena;
      const marca = item.imagenes?.[String(paso.n)];
      const opciones = marca?.opciones ?? [];
      const generando = !!marca?.trabajoId && !opciones.length && !marca?.error;
      const causa: CausaFlow | undefined = marca?.error
        ? ((marca.errorCausa as CausaFlow) ?? causaFlow(marca.errorCrudo ?? marca.error))
        : undefined;
      const txt = causa ? textoFlow(causa, `la imagen del escenario ${paso.n}`, marca?.errorAt) : null;

      const derecha = sinEscenas ? (
        <Niebla etiqueta="MaKo está escribiendo dónde se filma" desde={desde} />
      ) : txt ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>{txt.titulo}</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 9, lineHeight: 1.5 }}>
            {txt.detalle}
          </div>
        </div>
      ) : generando ? (
        <Niebla etiqueta={`Generando la imagen del escenario ${paso.n}`} desde={desde} />
      ) : marca?.elegida ? (
        <Revela k={marca.elegida}><img src={marca.elegida} alt={escena?.lugar ?? ''} style={MEDIO} /></Revela>
      ) : (
        <div style={{ color: 'var(--faint)' }}><Icon name="imagegen" size={44} /></div>
      );

      return {
        pregunta: sinEscenas
          ? 'Buscando dónde se filma'
          : opciones.length ? '¿Sirve esta imagen?' : '¿Dónde se filma?',
        titulo: escena?.lugar,
        cuerpo: (
          <div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
              <div>
                <Vertical>
                  {contexto?.fotoUrl
                    ? <img src={contexto.fotoUrl} alt="Tu foto" style={MEDIO} />
                    : <div style={{ color: 'var(--faint)' }}><Icon name="perfil" size={44} /></div>}
                </Vertical>
                <Pie>Tu foto</Pie>
              </div>
              <div>
                <Vertical fondo={txt ? 'var(--surface-2)' : undefined}>{derecha}</Vertical>
                <Pie>{opciones.length > 1 ? 'Lo que salió' : 'Lo que salió'}</Pie>
              </div>
            </div>

            {/* Las variantes: cambian lo que muestra el panel, no son otra
                decisión ni otra pantalla. */}
            {opciones.length > 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                {opciones.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => void correr('elegir', () => elegirImagenAction(item.id, paso.n, u), false)}
                    title="Usar esta"
                    style={{
                      width: 40, aspectRatio: '9 / 16', borderRadius: 7, overflow: 'hidden',
                      padding: 0, cursor: 'pointer', lineHeight: 0,
                      border: u === marca?.elegida ? '2px solid var(--primary)' : '1px solid var(--border)',
                    }}
                  >
                    <img src={u} alt="" style={MEDIO} />
                  </button>
                ))}
              </div>
            )}

            {opciones.length > 0 && (
              <Salidas resumen="No sirve">
                <Button
                  size="sm"
                  variant="mako"
                  loading={ocupado === 'imagen'}
                  onClick={() => void correr('imagen', () => generarImagenAction(item.id, paso.n), false)}
                >
                  Generar la imagen otra vez
                </Button>
                <Button size="sm" variant="tertiary" onClick={() => setPidiendo((v) => !v)}>
                  Decir qué cambiar
                </Button>
                <Button size="sm" variant="tertiary" onClick={() => archivo.current?.click()}>
                  Subir mi foto del lugar
                </Button>
                {/* Nueva: hoy el link a cambiar la foto propia desaparece justo
                    cuando ya cargaste una, que es cuando hace falta. */}
                <Link href="/onboarding" style={{ fontSize: 'var(--fs-sm)', alignSelf: 'center' }}>
                  Cambiar mi foto de entrada
                </Link>
              </Salidas>
            )}

            {pidiendo && (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end', marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <TextField label="Qué cambiarle" value={ajuste} onChange={(e) => setAjuste(e.target.value)} />
                </div>
                <Button
                  variant="mako"
                  loading={ocupado === 'corregir'}
                  disabled={!ajuste.trim()}
                  onClick={async () => {
                    await correr('corregir', () => corregirEscenaAction(item.id, paso.n, ajuste), false);
                    setAjuste('');
                    setPidiendo(false);
                  }}
                >
                  Pedirle el cambio a MaKo
                </Button>
              </div>
            )}

            <input
              ref={archivo}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => { subir(paso.n, e.target.files?.[0] ?? null); e.target.value = ''; }}
            />
          </div>
        ),
        boton: sinEscenas
          ? undefined
          : txt
            ? txt.accion
            : opciones.length
              ? 'Sí, es este lugar'
              : 'Generar la imagen',
        consecuencia: opciones.length ? 'No gasta créditos. Filmar sí gasta.' : 'No gasta créditos.',
        cargandoBoton: ocupado === 'imagen' || ocupado === 'confirmar' || generando,
        onSiguiente: opciones.length
          ? () => void correr('confirmar', () => confirmarEscenaAction(item.id, paso.n))
          : () => void correr('imagen', () => generarImagenAction(item.id, paso.n), false),
        atras: 'Volver',
        onAtras: () => setForzado({ id: 'guion-leer' }),
      };
    }

    // ── 3. La cara ────────────────────────────────────────────────────────
    if (paso.id === 'cara') {
      const uno = item.video?.['1'];
      return {
        pregunta: '¿Seguimos con esta cara?',
        cuerpo: (
          <div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
              <div>
                <Vertical>
                  {contexto?.fotoUrl
                    ? <img src={contexto.fotoUrl} alt="Tu foto" style={MEDIO} />
                    : <div style={{ color: 'var(--faint)' }}><Icon name="perfil" size={44} /></div>}
                </Vertical>
                <Pie>Tu foto</Pie>
              </div>
              <div>
                <Vertical fondo="#000">
                  {uno?.url ? <Revela k={uno.url}><Clip src={uno.url} /></Revela> : null}
                </Vertical>
                <Pie>La toma 1</Pie>
              </div>
            </div>
            <Salidas resumen={`No se parece · ~15 créditos`}>
              <Button
                size="sm"
                variant="mako"
                loading={ocupado === 'rehacer'}
                onClick={() => void correr('rehacer', async () => {
                  const d = await descartarTomaAction(item.id, 1);
                  if (!d.ok) return d;
                  return generarTomaAction(item.id, 1);
                }, false)}
              >
                Rehacer la toma 1
              </Button>
              <Link href="/onboarding" style={{ fontSize: 'var(--fs-sm)', alignSelf: 'center' }}>
                Cambiar mi foto en Onboarding
              </Link>
            </Salidas>
          </div>
        ),
        boton: `Seguir y filmar la toma 2`,
        consecuencia: costoTexto,
        cargandoBoton: ocupado === 'cara',
        onSiguiente: () => void correr('cara', async () => {
          const m = await marcarCaraVistaAction(item.id);
          if (!m.ok) return m;
          return generarTomaAction(item.id, 2);
        }),
      };
    }

    // ── 4. Filmar ─────────────────────────────────────────────────────────
    if (paso.id === 'toma') {
      const n = paso.n;
      const anterior = item.plan.clips.slice(0, n - 1).reverse().find((c) => item.video?.[String(c.n)]?.url);
      const vAnterior = anterior ? item.video?.[String(anterior.n)] : undefined;
      const enCurso = item.video?.[String(n)] && !item.video[String(n)]?.url && !item.video[String(n)]?.error;
      const fallo = item.video?.[String(n)]?.error;
      const escena = (item.escenas ?? []).find((e) => n >= e.desde && n <= e.hasta);
      const imagen = escena ? item.imagenes?.[String(escena.n)]?.elegida : '';

      const causa: CausaFlow | undefined = fallo
        ? ((item.video?.[String(n)]?.errorCausa as CausaFlow) ?? causaFlow(fallo))
        : undefined;
      const txt = causa ? textoFlow(causa, `la toma ${n}`, item.video?.[String(n)]?.errorAt) : null;

      // Lo enorme NUNCA está vacío: si no hay clip que mirar, se muestra la
      // imagen confirmada del escenario, que es literalmente el primer cuadro
      // que se va a animar.
      const dentro = enCurso
        ? <Niebla etiqueta={`Filmando la toma ${n}`} desde={desde} />
        : vAnterior?.url
          ? <Revela k={vAnterior.url}><Clip src={vAnterior.url} /></Revela>
          : imagen
            ? <img src={imagen} alt={`El escenario de la toma ${n}`} style={MEDIO} />
            : null;

      return {
        pregunta: enCurso
          ? `Filmando la toma ${n}`
          : txt
            ? `La toma ${n} no salió`
            : anterior
              ? `Así salió la toma ${anterior.n}`
              : 'Todo listo para filmar',
        cuerpo: (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Vertical fondo="#000">{dentro}</Vertical>
            </div>
            {enCurso && (
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                Suele tardar entre 1 y 3 minutos.
              </div>
            )}
            {txt && (
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                {txt.detalle}
              </div>
            )}
            {/* El pliegue DESAPARECE mientras se filma: ofrecer rehacer la
                anterior con la siguiente ya pagada encima deja el anuncio
                incoherente, y cuenta dos cosas a la vez. */}
            {!enCurso && anterior && !txt && (
              <Salidas resumen={`Rehacer la toma ${anterior.n} · ~15 créditos`}>
                <Button
                  size="sm"
                  variant="mako"
                  loading={ocupado === 'rehacer'}
                  onClick={() => void correr('rehacer', async () => {
                    const d = await descartarTomaAction(item.id, anterior.n);
                    if (!d.ok) return d;
                    return generarTomaAction(item.id, anterior.n);
                  }, false)}
                >
                  Rehacer la toma {anterior.n}
                </Button>
              </Salidas>
            )}
          </div>
        ),
        boton: enCurso ? undefined : txt ? txt.accion : `Filmar la toma ${n}`,
        consecuencia: enCurso ? undefined : costoTexto,
        cargandoBoton: ocupado === 'filmar',
        onSiguiente: enCurso ? undefined : () => void correr('filmar', () => generarTomaAction(item.id, n), false),
        atras: 'Atrás',
        onAtras: () => setForzado({ id: 'escenario', n: (item.escenas ?? []).slice(-1)[0]?.n ?? 1 }),
      };
    }

    // ── 5. Listo ──────────────────────────────────────────────────────────
    const clips = item.plan.clips.map((c) => item.video?.[String(c.n)]?.url).filter(Boolean) as string[];
    return {
      pregunta: 'Tu anuncio, entero',
      cuerpo: <Encadenado clips={clips} />,
      atras: 'Atrás',
      onAtras: () => setForzado({ id: 'toma', n: total }),
    };
  }

  const posicion = Math.max(1, mapa.indexOf(clave(paso)) + 1);

  return (
    <Estudio
      pregunta={p.pregunta}
      titulo={p.titulo}
      paso={posicion}
      total={mapa.length}
      boton={p.boton}
      consecuencia={p.consecuencia}
      cargando={!!p.cargandoBoton}
      onSiguiente={p.onSiguiente}
      atras={p.atras}
      onAtras={p.onAtras}
      onSalir={onSalir}
      error={error}
      vistaPrevia={<VistaPrevia puesta={puesta} />}
    >
      {p.cuerpo}
    </Estudio>
  );
}

/** El anuncio de corrido: las tomas encadenadas, sin tocar nada. */
function Encadenado({ clips }: { clips: string[] }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { ref.current?.play().catch(() => {}); }, [i]);
  if (!clips.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Vertical fondo="#000">
        <video
          ref={ref}
          key={clips[i]}
          src={clips[i]}
          controls
          playsInline
          onEnded={() => setI((k) => (k + 1 < clips.length ? k + 1 : k))}
          style={MEDIO}
        />
      </Vertical>
      {/* La cinta: cuesta cero palabras y sin ella nadie sabe qué toma suena.
          No es clicable — 3 px no es un target y elegir entre siete sería una
          segunda decisión en una pantalla que tiene una. */}
      <div style={{ display: 'flex', gap: 3, marginTop: 10, width: '60%' }}>
        {clips.map((u, k) => (
          <div
            key={u}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              background: k === i ? 'var(--primary)' : 'var(--border-strong)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
