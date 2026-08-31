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
import Link, { useRouter } from '@/app/_ui/Link';
import { Button, Tag, Status, TextField, Tooltip, MONO } from '@/app/_ui';
import { Icon } from '../_components/icons';
import type { PlanGuardado, EstadoContextoVideo } from './video-datos';
import type { Puesta } from '@/lib/puestas-data';
import { causaFlow, textoFlow, type CausaFlow } from '@/lib/flow-fallo-texto';
import { useExtensionInstalada, AvisoExtensionVieja } from './extension-instalada';
import { FotoGrande, ModalFotos } from './ElegirFoto';
import {
  escribirEscenasAction, corregirEscenaAction, generarImagenAction, estadoImagenAction,
  elegirImagenAction, subirImagenEscenaAction, confirmarEscenaAction,
  generarTomaAction, estadoTomaAction, descartarTomaAction, marcarCaraVistaAction,
  elegirFotoAction, elegirUltimaFotoAction,
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

/**
 * El alto del EJEMPLO del formato. Los dos topes están DERIVADOS, ninguno elegido:
 *
 *  · 391 px = 220 × 16/9, y 220 es el ancho exacto de la tarjeta del catálogo
 *             (`Plantilla`). El ejemplo nunca crece más que el objeto que la
 *             persona apretó dos pantallas antes.
 *  ⚠️ ERA `min(391px, LIENZO * .67)`, y después `.82`. Hoy es el LIENZO entero:
 *     el dueño pidió que al correrse a la derecha «mantenga su tamaño», y eso
 *     sólo se cumple si la caja del riel mide lo mismo que la del centro — con
 *     cualquier proporción menor el viaje incluye un encogimiento.
 *
 *     La regla que las versiones anteriores protegían —una referencia no compite
 *     con lo que se está decidiendo— la resuelve ahora el CERRAR: el ejemplo
 *     grande está mientras se lo mira, y se va a una miniatura de un clic.
 *
 * ⚠️ Medirlo contra el VIEWPORT era la trampa: a 860 px de alto empataba con el
 * héroe y por debajo lo superaba. Una referencia que compite en tamaño con lo que
 * hay que decidir deja de ser referencia.
 *
 * `vh` y no `dvh`, igual que LIENZO: dos alturas que se comparan salen de la
 * misma unidad o se cruzan solas en el navegador del teléfono.
 */
const EJEMPLO = LIENZO;

/**
 * Cerrado: una miniatura, no una tira.
 *
 * El dueño: «cuando se cierra… se pone más chiquito arriba a la derecha. Pero no
 * pegado al borde, sino manteniendo una simetría con el resto». Antes plegar
 * dejaba una tira vertical de 68 px con el rótulo de canto — reconocible como
 * control, pero ya no como VIDEO, así que la persona perdía de vista qué era lo
 * que había cerrado. Una miniatura sigue siendo la cosa; una tira es un botón.
 *
 * La simetría sale sola: el riel centra su contenido dentro de `--riel-ancho`, y
 * ese ancho se deriva del alto + los mismos 48 px de margen que usa abierto.
 */
const EJEMPLO_CERRADO = 'min(190px, 24vh)';

/**
 * El ancho del riel se DERIVA del alto del ejemplo. No es un número.
 *
 * ⚠️ ERA 268 fijo, heredado de la tarjeta del catálogo (220 px). Dos problemas, y
 * el segundo aparece recién al agrandar: con 268 el video salía a 145 px de ancho
 * —se reconocía, pero no se podía LEER lo que pasa adentro, que es todo lo que
 * una referencia tiene que dejar hacer—; y subirlo a mano deja AIRE MUERTO en las
 * pantallas bajas, donde el que manda es el alto y el video no llega a ocupar el
 * ancho reservado.
 *
 * El video es 9:16 y no negocia, así que el ancho sale del alto. Un solo número
 * gobierna la pieza (`EJEMPLO`) y el riel lo sigue: no hay dos medidas que
 * mantener sincronizadas.
 */
const RIEL = `calc(${EJEMPLO} * 9 / 16 + 48px)`;
const RIEL_CERRADO = `calc(${EJEMPLO_CERRADO} * 9 / 16 + 48px)`;


// ── Dónde está el anuncio ───────────────────────────────────────────────────

type Paso =
  // ⚠️ EL PASO `ejemplo` SE FUE A SER UNA VISTA DE LA TAB.
  //
  // Estaba acá y eso lo ataba a que YA existiera un plan guardado —su acción
  // necesitaba un `item.id` que en ese momento no existe—. Y el dueño lo quería
  // ANTES de todo: «me gustaría que el primer paso de todo sea… el de "Así se
  // verá tu anuncio"». Vive en `VideoGeneratorApp`, entre el catálogo y el guion.
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
  if (!escenas.length) {
    return { id: 'guion-leer' };
  }

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
/**
 * El paso ANTERIOR, derivado del mapa. No hay historial de clicks.
 *
 * ⚠️ Se deriva igual que la posicion: el wizard no recuerda por donde se vino,
 * mira el dato y contesta. Un «Volver» que dependa del historial promete «de
 * donde viniste» cuando lo que se espera es «el paso de arriba» — y este repo ya
 * tiene escrito que el destino de Volver es una propiedad de la PANTALLA, no del
 * camino.
 */
function pasoAnterior(mapa: string[], actual: string): Paso | null {
  const i = mapa.indexOf(actual);
  if (i <= 0) return null;
  const clave = mapa[i - 1];
  if (clave === 'guion-leer') return { id: 'guion-leer' };
  if (clave === 'cara') return { id: 'cara' };
  if (clave === 'listo') return { id: 'listo' };
  const m = /^(escenario|toma)-(\d+)$/.exec(clave);
  if (m) return { id: m[1] as 'escenario' | 'toma', n: Number(m[2]) };
  return null;
}

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
function Vertical({ children, fondo, alto = LIENZO, plano = false }: {
  children: React.ReactNode;
  fondo?: string;
  /** El alto. Por defecto, el del medio que se está decidiendo. */
  alto?: string;
  /**
   * Sin sombra.
   *
   * La sombra de la casa significa «este es el medio que se está decidiendo»:
   * hace que FLOTE. El ejemplo del formato no se decide, así que va PLANO — y eso
   * es un portador de «esto no es tuyo» que no gasta ni una palabra.
   *
   * ⚠️ La sombra NO se escala. Es ELEVACIÓN, no huella: dos objetos apoyados en
   * el mismo plano proyectan el mismo blur midan lo que midan. O va la de la
   * casa, o no va ninguna.
   */
  plano?: boolean;
}) {
  return (
    <div style={{
      height: alto, aspectRatio: '9 / 16', borderRadius: 18, overflow: 'hidden',
      // `--surface-2` y no un gris más oscuro: la regla de la casa es que en
      // oscuro las superficies SUBEN de luminosidad. El negro se pasa explícito
      // donde hay un video, que es el único lugar donde el negro es el fondo
      // correcto porque es el fondo del propio medio.
      background: fondo ?? 'var(--surface-2)', position: 'relative', flex: 'none',
      display: 'grid', placeItems: 'center',
      // La sombra hace que el medio FLOTE sobre el negro en vez de estar pegado.
      boxShadow: plano ? undefined : '0 24px 70px rgba(0,0,0,.55)',
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
/**
 * ⚠️ EXPORTADO: es el lenguaje de pantalla de TODA la tab, no del wizard.
 *
 * El paso «¿Cuál de tus guiones quieres grabar?» seguía usando `WizardShell` —el
 * wizard de formulario: tarjeta de 620 px, tipografías fuera de la escala, filas
 * de 14 px— mientras el resto ya usaba esto. El dueño lo vio de una: «se quedó
 * con el formato de form viejo».
 *
 * Y el recorrido real era oscuro → CLARO → oscuro, porque `WizardShell` no monta
 * el tema. Mudarlo no es sólo estética: quita el salto y, de yapa, el riel del
 * ejemplo pasa a acompañar también ese paso — que es lo que el dueño pidió cuando
 * dijo que la previsualización tiene que estar «durante toda la creación».
 */
export function Estudio({ pregunta, titulo, paso, total, children, boton, consecuencia, cargando, onSiguiente, atras, onAtras, onSalir, error, puesta, alLado, slotRiel, plegado }: {
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
  /** El formato elegido. Si trae ejemplo, la pantalla estrena su riel derecho. */
  puesta?: Puesta;
  /**
   * Esta ES la pantalla del ejemplo, así que el riel no se dibuja.
   *
   * Sin esto los dos mostraban el mismo video, los dos en `autoPlay loop`, y la
   * pantalla reproducía el clip dos veces a la vez: enorme en el centro y chico
   * al costado. El ejemplo ocupa el asiento del medio, y recién en la pantalla
   * siguiente se corre al costado — contarlo dos veces rompe justo esa lectura.
   */
  /** Dónde aterriza el ejemplo. Lo dibuja `PreviaVolante`, no esta pantalla. */
  slotRiel?: React.RefObject<HTMLDivElement | null>;
  plegado?: boolean;
  /**
   * Una acción que pertenece a la pregunta, en su misma línea.
   *
   * Va acá y no en el cuerpo porque actúa sobre lo que la pregunta NOMBRA. Suelta
   * arriba del contenido parecía un tercer elemento sin dueño; al lado del
   * título se lee como lo que es.
   */
  alLado?: React.ReactNode;
}) {
  // Qué versión de la extensión corre en el navegador de quien está mirando. Es
  // lo único de esta pantalla que puede explicar por qué todo lo demás falla.
  const extensionInstalada = useExtensionInstalada();

  // `Estudio` se monta UNA vez y en posición estable, así que este estado
  // sobrevive a los siete pasos: el ejemplo no se cierra solo al avanzar.
  // ⚠️ El plegado ya NO es estado de esta pantalla: lo manda quien tiene el
  // volante, porque el video sobrevive a los cambios de pantalla y su estado
  // tiene que sobrevivir con él. Guardarlo acá lo reseteaba en cada paso.
  const ejemploAbierto = !plegado;
  // ⚠️ UN SOLO NÚMERO mueve el riel Y el aire del estudio. Sin esto había que
  // sumar padding que viven en otros archivos, y ese acople es lo que hacía que
  // la pieza «flotara» al cambiar cualquier cosa alrededor.
  const anchoRiel = puesta?.ejemplo
    ? ({ ['--riel-ancho' as string]: ejemploAbierto ? RIEL : RIEL_CERRADO } as React.CSSProperties)
    : undefined;

  return (
    <div className="mk-estudio" style={anchoRiel}>
      {/* ⚠️ EN LA PANTALLA DEL EJEMPLO, EL RIEL NO SE DIBUJA.
          Los dos mostraban el mismo video y los dos en `autoPlay loop`, así que
          esa pantalla reproducía DOS veces el mismo clip a la vez — uno enorme en
          el centro y otro chico al costado. Lo metí yo al agregar ese paso, y es
          la misma pieza contándose dos veces: el ejemplo ocupa el asiento del
          medio, y recién en la pantalla siguiente se corre al costado. */}
      {slotRiel && (
        <HuecoDelEjemplo puesta={puesta} abierta={!plegado} slot={slotRiel} />
      )}
      {/* ── LA BARRA DE ARRIBA ──────────────────────────────────────────────
          SALIR a la izquierda y del todo arriba, que es donde se lo busca.
          ⚠️ No pregunta nada al salir, y eso es correcto ACA: el anuncio se
          guarda entero en cada paso —el guion, los escenarios, cada imagen
          confirmada, cada toma— asi que salir no pierde nada y volver a entrar
          cae en el mismo lugar. Preguntar «¿seguro?» sobre algo que no se pierde
          es enseñar a ignorar las preguntas. */}
      {/* ⚠️ ARRIBA DE TODO Y ANTES QUE NADA, y no es ruido: cuando aparece,
          NADA de esta pantalla puede funcionar. Una extensión vieja no da un
          error que se parezca a «tu extensión es de hace tres horas» — da un
          HTTP 400 de Google, o un cronómetro que no termina, o un pedido que
          sale con un campo que ya no existe.
          El aviso ya existía, pero sólo en el panel de conectar el puente. La
          falla ocurre acá, que es donde alguien pasa una hora generando. */}
      <div style={{ width: '100%', maxWidth: 900 }}>
        <AvisoExtensionVieja instalada={extensionInstalada} compacto />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', width: '100%', maxWidth: 900, gap: 16,
      }}>
        <button type="button" onClick={onSalir} style={salida}>← Salir</button>
      </div>

      {/* ⚠️ ACÁ HABÍA UNA FILA DE DOS COLUMNAS. Se fue entera: el riel es `fixed`
          contra el borde de la PANTALLA, así que no hay segunda columna contra la
          cual flotar, ni `flexWrap` que decida solo cuándo la referencia se va
          abajo. Los hijos vuelven a ser hijos directos del estudio. */}
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

      {/* LA PREGUNTA, grande. Es lo que se lee en el primer segundo. */}
      <div style={{ textAlign: 'center', maxWidth: 820 }}>
        {/* Lo de al lado va en la MISMA fila y en `baseline`, no debajo: una
            acción sobre lo que la pregunta nombra pertenece a la pregunta. Y con
            `baseline` no se cuelga de un título de 31 px. */}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'center',
          gap: 16, flexWrap: 'wrap',
        }}>
          <h2 style={{
            margin: 0, fontSize: 'clamp(22px, 2.2vw, 31px)', fontWeight: 640,
            letterSpacing: '-.02em', lineHeight: 1.2, color: 'var(--ink)',
          }}>
            {pregunta}
          </h2>
          {alLado}
        </div>
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
/**
 * El ejemplo del formato: el BORDE DERECHO de la pantalla, no una tarjeta al lado.
 *
 * ── Por qué un riel y no una caja ──────────────────────────────────────────
 * La versión anterior era la ÚNICA tarjeta de una pantalla rehecha entera para
 * no tener ninguna. Y no alcanzaba con sacarle el fondo: en oscuro `--surface`
 * sobre `--bg` da 1,13:1, o sea que lo que dibujaba la caja era el BORDE.
 *
 * Flow separa zonas con un escalón de relleno y CERO bordes — pero a escala de
 * ZONA, no de un rectángulo de 288 px. A esa escala el relleno no se lee como
 * zona: se lee como el marco que lo rodea. La corrección no era «menos caja»:
 * era zona de verdad. Una franja anclada al borde, de alto completo, SÍ es una
 * zona, y ahí alcanza un filete de 1 px donde antes hacía falta un contorno.
 *
 * ── Por qué el nombre va ADENTRO ───────────────────────────────────────────
 * Es la regla que hace legible la pantalla entera: **el ejemplo se rotula por
 * DENTRO del recorte; lo que produce el usuario se rotula por FUERA y debajo**
 * (`Pie`). Dentro contra fuera es una diferencia estructural, no de color ni de
 * peso, así que sobrevive a cualquier tema y a cualquier tamaño.
 *
 * Y el dibujo del rótulo es el de `Plantilla`, copiado al valor: es la misma
 * tarjeta que la persona apretó treinta segundos antes. El test de un segundo lo
 * gana el reconocimiento, no la lectura.
 */
/**
 * El HUECO donde aterriza el ejemplo. No dibuja el video: reserva su lugar.
 *
 * ⚠️ EL VIDEO YA NO VIVE ACÁ. Vive en `PreviaVolante`, un solo nodo `fixed` que
 * arranca sobre la tarjeta que la persona apretó en el catálogo, vuela al centro
 * de «Así se verá tu anuncio», y de ahí se corre a este hueco — sin desmontarse
 * ni una vez en todo el recorrido.
 *
 * Y ése es el punto: la persona VE que la cosa que eligió es la misma que se
 * corrió al costado. Eso contesta «¿qué hace eso ahí?» sin gastar una palabra, y
 * es lo único que las cuatro versiones anteriores del riel no podían hacer —
 * porque un elemento que se desmonta y se vuelve a crear no se puede seguir con
 * el ojo.
 *
 * Lo único que queda acá es la medida. Si esta caja cambia de tamaño, el volante
 * la sigue: no hay dos números que mantener sincronizados.
 */
function HuecoDelEjemplo({ puesta, abierta, slot }: {
  puesta: Puesta | undefined;
  abierta: boolean;
  slot: React.RefObject<HTMLDivElement | null>;
}) {
  if (!puesta?.ejemplo) return null;
  return (
    <aside
      className={`mk-riel${abierta ? '' : ' mk-riel--plegado'}`}
      style={{ ['--mk-riel-alto' as string]: abierta ? EJEMPLO : EJEMPLO_CERRADO }}
    >
      <p className="mk-riel__para">Así se verá tu anuncio</p>
      {/* El hueco: mismo alto y misma proporción que el video, sin dibujar nada.
          El volante se posiciona sobre esta caja. */}
      <div
        ref={slot}
        style={{ height: 'var(--mk-riel-alto)', aspectRatio: '9 / 16', borderRadius: 18 }}
      />
    </aside>
  );
}

// ── El wizard ───────────────────────────────────────────────────────────────

export function WizardAnuncio({ item, contexto, puesta, costoTexto, onCambio, onSalir, slotRiel, plegado }: {
  item: PlanGuardado;
  contexto: EstadoContextoVideo | null;
  puesta: Puesta | undefined;
  /** Lo que cuesta una toma, ya redactado por quien sabe el saldo. */
  costoTexto: string;
  onCambio: (item: PlanGuardado) => void;
  onSalir: () => void;
  /** Dónde aterriza el ejemplo. El video lo dibuja `PreviaVolante`, arriba. */
  slotRiel?: React.RefObject<HTMLDivElement | null>;
  plegado?: boolean;
}) {
  const [forzado, setForzado] = useState<Paso | null>(null);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [ajuste, setAjuste] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [desde, setDesde] = useState(() => Date.now());
  const archivo = useRef<HTMLInputElement>(null);

  // ⚠️ `useRouter` de `app/_ui/Link`, NO el de next/navigation: preserva el `?ws=`
  // de la pestaña, y perderlo te deja mirando otra cuenta.
  const router = useRouter();
  const [eligiendoFoto, setEligiendoFoto] = useState(false);
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
    if (!v || v.url) return false;
    // ⚠️ UN ERROR DE PUENTE NO APAGA EL SONDEO, Y SIN ESTO LA CURA NO CORRE NUNCA.
    //
    // `estadoTomaAction` sabe borrar un error de puente sobre una toma viva
    // cuando el puente vuelve a estar sano. Pero esa función la llama SOLO este
    // sondeo, y el sondeo se apagaba justo por la condición que la cura viene a
    // sacar: `!v.error`. O sea, el arreglo vivía detrás de la puerta que él mismo
    // tenía que abrir.
    //
    // Medido: la marca de la toma 1 tenía `errorCausa: 'puente'` y su `operacion`
    // viva, el puente reportaba `listo`, y la pantalla siguió diciendo «La toma 1
    // no salió» a través de dos recargas. La cura estaba desplegada y no se
    // ejecutó una sola vez.
    if (v.error) return v.errorCausa === 'puente' && !!v.operacion;
    return true;
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
    pregunta: string; titulo?: string; cuerpo: React.ReactNode;
    boton?: string; consecuencia?: string; onSiguiente?: () => void;
    atras?: string; onAtras?: () => void; cargandoBoton?: boolean;
    /** Una acción que pertenece a la pregunta y va en su misma línea. */
    alLado?: React.ReactNode;
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
        //
        // ⚠️ Y SE LLAMA `titulo`, QUE ES EL SLOT QUE `Estudio` DIBUJA.
        //
        // Estuvo escrita como `sub` desde que se escribió, y `sub` no lo lee
        // nadie: está declarado en el tipo de `pantalla()`, asignado una sola vez
        // acá, y jamás pasado a `<Estudio>`. O sea que esta línea —puesta para
        // contestar un reclamo textual del dueño— NUNCA APARECIÓ EN LA PANTALLA,
        // y el reclamo siguió vivo sin que nada lo delatara: el campo compila, el
        // tipo lo acepta y el render simplemente no lo menciona.
        //
        // Dos campos para el mismo lugar es cómo uno se muere. Queda uno.
        titulo: `Se filma en ${item.plan.clips.length} tomas de ${seg} segundos.`,
        // ── EL BOTÓN, EN LA LÍNEA DEL TÍTULO ─────────────────────────────
        //
        // Pasaron tres versiones acá. Un botón abajo que decía «Escribirlo tal
        // cual» —incomprensible, y debajo del texto que modifica—; dos opciones a
        // la vista, que el dueño cortó porque «tal cual» no es una opción sino lo
        // que pasa si no haces nada; y uno arriba del guion, suelto, que parecía
        // un tercer elemento sin dueño.
        //
        // Actúa sobre lo que el título nombra, así que va en su misma línea.
        //
        // Y lleva el `?`: «Formatear guion» dice QUÉ pasa y no qué significa, y
        // el detalle no puede vivir en una frase al lado —ya se sacaron cuatro
        // renglones de letra chica de esta pantalla—. El tooltip cubre el botón
        // ENTERO, no sólo el ícono: quien duda pasa por encima de lo que no
        // entiende, que es la palabra, no el signo.
        alLado: (
          <Tooltip text="MaKo lo reescribe con tu forma de hablar: te pone tus muletillas y tus conectores, sin cambiar lo que dice ni el cierre.">
            {/* `secondary` y no `tertiary`: el terciario se dibuja como texto
                con un hover, y el dueño lo marcó — «haz que ese botón sea botón,
                no sólo texto». Un control que hace algo caro (rehace el guion
                entero) no puede leerse como un enlace. */}
            <Button
              variant="secondary"
              size="sm"
              loading={ocupado === 'muletillas'}
              disabled={!!ocupado}
              onClick={() => void correr('muletillas', () => cambiarMuletillasAction(item.id, true), false)}
            >
              Formatear guion
              <span style={{ display: 'inline-flex', marginLeft: 7, opacity: 0.72 }}>
                <Icon name="help" size={14} />
              </span>
            </Button>
          </Tooltip>
        ),
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

      // La foto con la que se genera: la elegida para ESTE anuncio, y si no hay,
      // la primera — que es lo que pasaba antes de poder elegir.
      const fotoElegida = (contexto?.fotos ?? []).find((f) => f.id === item.fotoId)?.url
        ?? contexto?.fotoUrl
        ?? '';

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
                {/* ⚠️ LA FOTO GRANDE ES EL CONTROL. Antes había una tira de
                    miniaturas debajo, y el dueño la cortó: ponía ocho caras del
                    mismo tamaño en una pantalla cuyo trabajo es confirmar UNA.
                    Elegir es una acción rara; tenerla siempre a la vista le cobra
                    atención a todas las veces que no se usa. */}
                <FotoGrande
                  url={fotoElegida}
                  puedeCambiar={(contexto?.fotos?.length ?? 0) > 0}
                  onAbrir={() => setEligiendoFoto(true)}
                >
                  <Vertical>
                    {fotoElegida
                      ? <img src={fotoElegida} alt="Tu foto" style={MEDIO} />
                      : <div style={{ color: 'var(--faint)' }}><Icon name="perfil" size={44} /></div>}
                  </Vertical>
                </FotoGrande>
                <Pie>Tu foto</Pie>
              </div>
              <div>
                <Vertical fondo={txt ? 'var(--surface-2)' : undefined}>{derecha}</Vertical>
                {/* ⚠️ Las dos ramas de este pie decían lo MISMO. Un condicional que
                    no condiciona nada es una decisión que alguien empezó y no
                    terminó, y se lee como si dijera algo. */}
                <Pie>Lo que salió</Pie>
              </div>
            </div>

            {eligiendoFoto && (
              <ModalFotos
                fotos={contexto?.fotos ?? []}
                elegida={item.fotoId ?? contexto?.fotos?.[0]?.id ?? ''}
                onCerrar={() => setEligiendoFoto(false)}
                onElegir={(id) => void correr('foto', () => elegirFotoAction(item.id, id), false)}
                onSubida={() => void correr('foto', async () => {
                  const el = await elegirUltimaFotoAction(item.id);
                  // La lista la arma el SERVIDOR: sin esto la foto recién subida no
                  // aparece hasta recargar, y se lee como que no se subió.
                  router.refresh();
                  setEligiendoFoto(false);
                  return el;
                }, false)}
              />
            )}

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
      // La imagen del escenario que se confirmo: es EL CUADRO del que salio este
      // clip, asi que es lo unico contra lo que tiene sentido compararlo.
      const escena1 = (item.escenas ?? []).find((e) => 1 >= e.desde && 1 <= e.hasta);
      const imagenBase = escena1 ? item.imagenes?.[String(escena1.n)]?.elegida : '';
      return {
        // ⚠️ LITERAL, y nombra lo que se esta decidiendo. Martin: «el titulo NO
        // debe ser "¿Seguimos con esta cara?" cuando estoy generando el clip...
        // justamente deberia ser "¿Apruebas este clip?"». Tiene razon: lo que se
        // mira es un VIDEO, y aprobarlo es lo que desbloquea las otras seis tomas.
        pregunta: '¿Apruebas este clip?',
        cuerpo: (
          <div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
              <div>
                {/* ⚠️ LA IMAGEN GENERADA, no la foto original.
                    Martin: «en la imagen de la izquierda se debe ver ESA imagen
                    generada a partir de la foto que le subi».
                    Y es lo correcto: el clip se anima DESDE ese cuadro, asi que
                    es lo unico contra lo que la comparacion dice algo. Contra la
                    foto de perfil comparaba dos cosas que no tienen por que
                    parecerse — una es un retrato, la otra un fotograma. */}
                <Vertical>
                  {imagenBase
                    ? <img src={imagenBase} alt="El cuadro del que sale el clip" style={MEDIO} />
                    : contexto?.fotoUrl
                      ? <img src={contexto.fotoUrl} alt="Tu foto" style={MEDIO} />
                      : <div style={{ color: 'var(--faint)' }}><Icon name="perfil" size={44} /></div>}
                </Vertical>
                <Pie>{imagenBase ? 'La imagen' : 'Tu foto'}</Pie>
              </div>
              <div>
                <Vertical fondo="#000">
                  {uno?.url ? <Revela k={uno.url}><Clip src={uno.url} /></Revela> : null}
                </Vertical>
                <Pie>El clip</Pie>
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
        // ⚠️ «Siguiente», como todos. Martin: «siempre los botones de abajo debe
        // ser siguiente, no cualquier otra cosa». Lo que el boton hace de mas —y
        // cuesta— lo dice `consecuencia`, que va pegada abajo: un rotulo que
        // cambia en cada pantalla obliga a leerlo de nuevo cada vez, y el trabajo
        // de ese boton es siempre el mismo: avanzar.
        boton: 'Siguiente',
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

      /**
       * La toma corre y no podemos leerla.
       *
       * ⚠️ Es una tercera situación y no una variante de las dos que había. Con
       * `enCurso` a secas la pantalla decía «Filmando la toma 1 · Suele tardar
       * entre 1 y 3 minutos» mientras Google venía rechazando cada consulta con
       * un HTTP 400, y el cronómetro pasó los cinco minutos sin que nada lo
       * dijera. Con `fallo` diría que la toma no salió, que es falso: salió, se
       * pagó, y lo único roto es nuestra forma de preguntar por ella.
       */
      const ciego = enCurso ? item.video?.[String(n)]?.ciego : undefined;
      const txtCiego = ciego ? textoFlow('ciego', `la toma ${n}`, ciego.desde) : null;

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
        // ⚠️ CON SALIDA. La primera version de esta pantalla dibujaba el mensaje
        // y NINGUN boton: `boton` solo se define cuando `enCurso` es falso, y a
        // ciegas sigue siendo verdadero. Martin: «ni siquiera me salta un
        // boton... se queda generando allí». Una pantalla sin salida es peor que
        // una pantalla con un error.
        //
        // Y las acciones YA ESTABAN ESCRITAS en `textoFlow('ciego')` —`accion` y
        // `secundaria`— sin que nadie las dibujara. Es el mismo defecto que el
        // campo `sub`: definir la salida no es ofrecerla.
        ...(txtCiego ? {
          boton: txtCiego.accion,
          cargandoBoton: ocupado === 'reconsultar',
          onSiguiente: () => void correr(
            'reconsultar',
            () => estadoTomaAction(item.id, n).then((r) => (r.ok ? { ok: true, item: r.item } : r)),
            false,
          ),
        } : {}),
        pregunta: enCurso
          ? (txtCiego ? txtCiego.titulo : `Filmando la toma ${n}`)
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
            {/* ⚠️ La estimación NO se muestra cuando ya sabemos que se pasó. Un
                «suele tardar entre 1 y 3 minutos» al lado de un cronómetro en 4:51
                no es un dato optimista: es la pantalla afirmando que todo va
                normal cuando el servidor ya sabe que no. */}
            {enCurso && !txtCiego && (
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                Suele tardar entre 1 y 3 minutos.
              </div>
            )}
            {txtCiego && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5 }}>
                  {txtCiego.detalle}
                </div>

                {/* ── UN SOLO PLIEGUE, Y CERRADO ──────────────────────────
                    Acá había DOS `Salidas` sueltas —una para el error crudo y
                    otra para abandonar la toma— más el párrafo largo, todo
                    apilado debajo del lienzo y por encima del botón principal.
                    Tres bloques de texto centrado del mismo peso: nada se leía
                    primero, y lo único que había que apretar quedaba al final.

                    Ahora es uno. Adentro va lo que casi nadie necesita —lo que
                    contestó Google— y lo que casi nadie debería apretar
                    —rehacer la toma, que cobra un segundo clip por uno que
                    probablemente ya existe—. Y el resumen dice las dos cosas,
                    así que se sabe qué hay adentro sin abrirlo. */}
                <div style={{ marginTop: 14 }}>
                  <Salidas resumen="Ver el detalle · o volver a filmar esta toma">
                    <div style={{ width: '100%', maxWidth: 520 }}>
                      {/* El crudo, ACOTADO. Sin tope, el JSON de Google son
                          nueve renglones de monoespaciada alineados a la
                          izquierda que se comen la pantalla — y la evidencia no
                          puede pesar más que la salida. Se conserva entero
                          (nunca se recorta el error: es la única pista para el
                          que investiga), pero scrollea adentro de su caja. */}
                      {ciego?.crudo && (
                        <pre style={{
                          margin: '0 0 14px', textAlign: 'left', whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto',
                          padding: '10px 12px', borderRadius: 'var(--r-sm)',
                          background: 'var(--surface-2)', border: '1px solid var(--border)',
                          fontSize: 'var(--fs-meta)', color: 'var(--dim)',
                          fontFamily: 'var(--mono, monospace)', lineHeight: 1.45,
                        }}>
                          {ciego.crudo}
                        </pre>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={ocupado === 'rehacer-ciega'}
                        disabled={!!ocupado}
                        onClick={() => void correr('rehacer-ciega', async () => {
                          const d = await descartarTomaAction(item.id, n);
                          if (!d.ok) return d;
                          return generarTomaAction(item.id, n);
                        }, false)}
                      >
                        {`Volver a filmar la toma ${n} · ~15 créditos`}
                      </Button>
                    </div>
                  </Salidas>
                </div>
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
        // ⚠️ LA ETIQUETA Y LA ACCIÓN SALÍAN DE DOS LUGARES DISTINTOS.
        //
        // El rótulo venía de `txt.accion` —el texto de la causa— y el `onClick`
        // llamaba SIEMPRE a `generarTomaAction`. Con la causa `puente` eso daba un
        // botón que decía «Revisar el puente» y gastaba ~15 créditos: una etiqueta
        // que promete un diagnóstico sobre un control que cobra. El dueño lo
        // reportó como «ese botón no hace nada», que es la lectura correcta desde
        // afuera — lo que hacía no se parecía en nada a lo que decía.
        //
        // Un botón se rotula por su EFECTO. Acá el efecto es uno solo: volver a
        // filmar. Y cuando filmar no es lo que conviene —sin créditos, filtro de
        // contenido— eso lo dice el detalle de arriba, que para eso está escrito
        // por causa.
        boton: enCurso ? undefined : txt ? `Volver a filmar la toma ${n}` : 'Siguiente',
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

  /**
   * El «Volver» de TODA pantalla, salvo que la pantalla diga otra cosa.
   *
   * ⚠️ Martín: «no hay botón de retroceder, no puedo volver para atrás, solo
   * salir». Cierto: sólo dos de las siete pantallas lo definían, y en las demás
   * la única salida era abandonar el anuncio. Una pantalla sin vuelta atrás
   * convierte cualquier error en «empezar de nuevo».
   *
   * Sale del MAPA y no de un historial de clicks: el wizard no recuerda por dónde
   * se vino, mira el dato y contesta. En el primer paso no se dibuja — un
   * «Volver» que no lleva a ningún lado es peor que no tenerlo.
   */
  const anterior = pasoAnterior(mapa, clave(paso));

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
      atras={p.atras ?? (anterior ? 'Volver' : undefined)}
      onAtras={p.onAtras ?? (anterior ? () => setForzado(anterior) : undefined)}
      onSalir={onSalir}
      error={error}
      puesta={puesta}
      slotRiel={slotRiel}
      plegado={plegado}
      alLado={p.alLado}
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
