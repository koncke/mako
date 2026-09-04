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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { Button, Tag, Status, Textarea, Tooltip, Alert, MONO } from '@/app/_ui';
import { Icon } from '../_components/icons';
import type { PlanGuardado, EstadoContextoVideo } from './video-datos';
import type { Puesta } from '@/lib/puestas-data';
import { causaFlow, textoFlow, accionFiltroDeCara, type CausaFlow } from '@/lib/flow-fallo-texto';
import { creditosDeClip, notaSaldo } from '@/lib/costo-clip';
// ⚠️ Lo que se MUESTRA tiene que ser lo que se MANDA: si la pantalla arma el
// prompt sin el acento del plan y el server lo arma con él, la persona edita
// un texto que no es el que sale.
import { promptDeClip, acentoDelPlan } from '@/lib/prompts-video';
import { imagenEnCurso } from './variantes-imagen';
import { nombreDeClip } from './video-pedido';
import { escenariosYaGeneradosAction, reusarEscenariosAction, elegirEscenarioAction, otroFondoAction } from './video-action';
import { escenariosParaCamara, escenarioPorId, CATALOGO_ESCENARIOS } from '@/lib/escenarios-data';
import { enCuantasQueda } from './plan-clips';
import { PasoTomas } from './PasoTomas';
import { creditosDeClip as creditosDeClipFlow } from '@/lib/costo-clip';
import { promptFinal, urlDeFlowVencida } from '@/lib/flow-imagen';
import { useExtensionInstalada, AvisoExtensionVieja } from './extension-instalada';
import { AvisoPuente, estadoDelPuente } from './puente-avisos';
import type { Puente } from '@/lib/flow-cola';
import { Foto, FotoGrande, ModalFotos } from './ElegirFoto';
import { avisarPuente } from './avisar-puente';
import { PasoMontaje } from './PasoMontaje';
import {
  escribirEscenasAction, generarImagenAction, estadoImagenAction,
  elegirImagenAction, subirImagenEscenaAction, confirmarEscenaAction,
  generarTomaAction, estadoTomaAction, descartarTomaAction, restaurarTomaAction, guardarPromptTomaAction, guardarPromptEscenaAction, marcarCaraVistaAction,
  editarClipsAction, escribirVozTomaAction,
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
/**
 * LA CALLE. Un solo número gobierna las tres distancias del borde derecho.
 *
 * El dueño lo especificó exacto: «la misma distancia de la línea divisoria que
 * separa el video debería separar la sección». O sea que el filete es el EJE, no
 * un borde: `CALLE` de aire hasta el texto de un lado, `CALLE` hasta el video del
 * otro, y `CALLE` más entre el video y donde termina el grupo.
 *
 * ⚠️ Antes la calle se contaba DOS VECES: 24 adentro del riel más 48 de
 * separación del grupo, y encima el filete quedaba pegado al texto — o sea 1 px
 * de un lado y 68 del otro. Un divisor descentrado se lee como que algo falta de
 * un lado, que es literalmente el diagnóstico que ya está escrito abajo para el
 * eje vertical de este mismo filete.
 */
const CALLE = 16;

/**
 * QUÉ CUESTA APRETAR, siempre con el número. También cuando es cero.
 *
 * Martín: «prefiero que diga en lugar de "No gasta créditos" siempre la cantidad…
 * algo como "Costo: 0". Y así también en los otros que sí cuestan».
 *
 * Y tiene razón por una razón que no es de gusto: «no gasta» y «gasta ~15» son
 * dos frases con dos formas distintas, así que la persona tiene que LEERLAS para
 * compararlas. Con el mismo molde en los dos casos, el número se compara solo —
 * y el cero deja de ser una promesa vaga para pasar a ser un dato de la misma
 * clase que los demás.
 *
 * ⚠️ UNA función y no tres literales: el costo aparece en tres pantallas y una
 * frase copiada tres veces es la que se queda vieja cuando cambia el precio.
 */
export function textoCosto(creditos: number, opts: {
  /**
   * El costo NO está en la tabla y es una estimación.
   *
   * ⚠️ Es la excepción, no el caso normal. Antes TODA toma se anunciaba como
   * «~15 (estimado) créditos» viniera de un clip de 4 segundos o de uno de 10 —
   * un «~» sobre un dato que sí conocemos le pide a la persona que desconfíe, y
   * encima cobra de más en los cortos: 15 sobre uno de 4 s es más del doble.
   */
  estimado?: boolean;
  /** Una aclaración que cuelga del costo. */
  nota?: string;
} = {}): string {
  // ⚠️ ACÁ IBA « · te quedan N», Y SE FUE POR PEDIDO DEL DUEÑO: «elimina " · te
  // quedan 996"… eso es innecesario». Tiene razón — el saldo no es la
  // consecuencia de apretar ESTE botón, y mezclarlo con el precio hace que la
  // línea que tiene que contestar «¿cuánto me cuesta esto?» conteste dos cosas.
  const cuanto = creditos === 0
    ? '0 créditos'
    : `${opts.estimado ? '~' : ''}${creditos} créditos${opts.estimado ? ' (estimado)' : ''}`;
  return `Costo: ${cuanto}.${opts.nota ? ` ${opts.nota}` : ''}`;
}

/**
 * El ancho de CADA caja del paso del escenario. Son dos, lado a lado.
 *
 * Fijo y no derivado del alto: con dos cajas 9:16 sacadas de un alto en `vh`, el
 * ancho de la fila cambia con el alto de la ventana, y con él cambia dónde
 * arranca el ejemplo del costado. Un número acá deja la fila en 620 px siempre.
 */
const CAJA = 300;

/**
 * La caja de la toma. Una sola, así que puede ser más grande — pero no tanto.
 *
 * ⚠️ 320 y no 360, y el número sale de una CUENTA, no del gusto: la caja es 9:16,
 * así que 360 de ancho son 640 de alto, y con la cabecera (≈230) más los botones
 * (≈100) eso da 970 — justo el alto de una pantalla de portátil. El paso quedaba
 * con el botón cortado abajo. Con 320 son 569, y el total entra en 899.
 *
 * Y es un número FIJO en píxeles, no derivado de `vh`: el ancho de la caja es lo
 * que decide dónde arranca el ejemplo del costado, y un ancho que cambia con el
 * alto de la ventana deja al riel adivinando. Esa dependencia cruzada ya rompió
 * el centrado dos veces en este archivo.
 */
const CAJA_TOMA = 320;

/**
 * El ancho del riel. Cambia al cerrar, y eso es a propósito.
 *
 * ⚠️ Lo había dejado FIJO para que la columna de texto no se moviera al abrir y
 * cerrar. El dueño lo corrigió: «como todo tiene que quedar CENTRADO siempre,
 * cuando el video se abre, la otra sección debe desplazarse hacia la izquierda,
 * para centrarse todo».
 *
 * Y tiene razón sobre lo que manda: lo que está centrado no es la columna, es el
 * GRUPO —columna + calle + ejemplo—. Con el riel fijo, cerrar dejaba el grupo
 * descentrado con un hueco a la derecha; con el riel variable, el conjunto
 * respira hacia el centro. El costo —que el texto se mueva— es el precio de que
 * la pantalla nunca quede coja.
 */
const RIEL = `calc(${EJEMPLO} * 9 / 16 + ${2 * CALLE}px)`;


// ── Dónde está el anuncio ───────────────────────────────────────────────────

type Paso =
  // ⚠️ EL PASO `ejemplo` SE FUE A SER UNA VISTA DE LA TAB.
  //
  // Estaba acá y eso lo ataba a que YA existiera un plan guardado —su acción
  // necesitaba un `item.id` que en ese momento no existe—. Y el dueño lo quería
  // ANTES de todo: «me gustaría que el primer paso de todo sea… el de "Así se
  // verá tu anuncio"». Vive en `VideoGeneratorApp`, entre el catálogo y el guion.
  | { id: 'guion-leer' }
  /**
   * DÓNDE se graba. Una pantalla, una decisión.
   *
   * ⚠️ NO SE DERIVA DEL DATO, y es la excepción que el resto de este archivo
   * evita. `pasoDe` no lo devuelve nunca: se entra desde el guion y se sale
   * eligiendo. Si se derivara de «no tiene `escenarioId`», todo anuncio
   * empezado antes de que el catálogo existiera volvería acá de golpe — y los
   * que ya tienen imágenes aprobadas las perderían por una pregunta que nadie
   * les hizo cuando las aprobaron.
   *
   * Lo que sí se deriva es que se pueda VOLVER: está en `mapaDe`, así que el
   * indicador lo cuenta y el «Atrás» del escenario aterriza acá.
   */
  | { id: 'lugar' }
  | { id: 'escenario'; n: number }
  | { id: 'cara' }
  /**
   * TODAS las tomas, en una sola pantalla.
   *
   * ⚠️ Reemplaza a `toma-N` y a `cara`, que eran ocho pasos para una decisión
   * repetida. El dueño: «que esos no representen muchos pasos del form, que
   * representen 1 solo paso». `toma` sobrevive sólo como destino de los `Volver`
   * viejos; `pasoDe` ya no lo devuelve nunca.
   */
  | { id: 'tomas' }
  | { id: 'toma'; n: number }
  /**
   * Ver y cambiar el prompt de una toma.
   *
   * ⚠️ NO SE DERIVA DEL DATO como los demás: `pasoDe` no lo devuelve nunca. Es un
   * desvío al que se entra a mano desde el clip y del que se sale volviendo. Por
   * eso `clave()` lo hace contar como su toma — el indicador de arriba tiene que
   * seguir marcando dónde está el anuncio, no inventar un paso más.
   */
  | { id: 'prompt'; n: number; de: 'toma' | 'escena' }
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

  // ⚠️ UN SOLO PASO PARA LAS N TOMAS, y con él se fue el paso `cara`.
  //
  // No se fue el GATE que ese paso protegía —que nadie gaste ~105 créditos con
  // una cara que no miró—: se mudó al botón. Mientras no haya una toma aprobada,
  // lo único que la pantalla ofrece es filmar la primera. La protección deja de
  // ser una pared y pasa a ser el camino por defecto, que es más barato de
  // obedecer que de esquivar.
  const falta = item.plan.clips.some((c) => !item.video?.[String(c.n)]?.url);
  if (falta) return { id: 'tomas' };
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
  // Sin esto el 'Atras' del primer escenario devolvia null y desaparecia: la
  // clave estaba en el mapa y aca no, asi que el paso existia para el indicador
  // de arriba y no para volver.
  if (clave === 'lugar') return { id: 'lugar' };
  if (clave === 'cara') return { id: 'cara' };
  if (clave === 'listo') return { id: 'listo' };
  const m = /^(escenario|toma)-(\d+)$/.exec(clave);
  if (m) return { id: m[1] as 'escenario' | 'toma', n: Number(m[2]) };
  return null;
}

function mapaDe(item: PlanGuardado): string[] {
  const escenas = item.escenas ?? [];
  // Una sola marca para todas las tomas: el indicador de arriba mide el
  // RECORRIDO, y filmar dejó de ser N pasos para ser uno.
  return [
    'guion-leer',
    'lugar',
    ...(escenas.length ? escenas.map((e) => `escenario-${e.n}`) : ['escenario-1']),
    'tomas',
    'listo',
  ];
}

function clave(p: Paso): string {
  // El desvío del prompt cuenta como el paso del que salió: es una decisión
  // SOBRE esa toma o ese escenario, no un paso más del anuncio. Y tiene que
  // mirar `de`: con `toma-` fijo, editar el prompt de una IMAGEN movía el
  // indicador de arriba a otra parte del recorrido.
  if (p.id === 'prompt') return p.de === 'escena' ? `escenario-${p.n}` : 'tomas';
  // Los `toma-N` viejos —a los que todavía apunta algún «Volver»— cuentan como el
  // paso único, que es donde de verdad aterrizan.
  if (p.id === 'toma') return 'tomas';
  return p.id === 'escenario' ? `escenario-${p.n}` : p.id;
}

// ── Piezas ──────────────────────────────────────────────────────────────────

/**
 * Un 9:16 a tamaño de decisión. Es lo enorme de casi todas las pantallas.
 *
 * Sobre negro y SIN BORDE: un borde le pone marco a lo que tiene que no tenerlo.
 * Lo que separa el medio del fondo es su propio contenido, no una línea.
 */
function Vertical({ children, fondo, alto = LIENZO, ancho, plano = false, clase }: {
  children: React.ReactNode;
  /**
   * Una clase para colgarle reglas al CONTENEDOR.
   *
   * La usa el clip: el hover de «Regenerar» tiene que dispararse pasando el
   * cursor por CUALQUIER parte del video, no sólo por la franja donde se
   * clickea. Sin eso el control existe y no lo descubre nadie.
   */
  clase?: string;
  fondo?: string;
  /** El alto. Por defecto, el del medio que se está decidiendo. */
  alto?: string;
  /**
   * El ancho, cuando el que manda es el ancho y no el alto.
   *
   * ⚠️ Por defecto la caja sale del ALTO (`vh`) y el ancho lo deriva el
   * `aspect-ratio`. Eso está bien con UNA caja, y se rompe con dos al lado: el
   * ancho de la fila pasa a depender del alto de la ventana, así que nadie —ni
   * el riel, ni el centrado— puede saber cuánto va a medir. Donde hay dos, manda
   * el ancho y el alto se deriva.
   */
  ancho?: string;
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
    <div className={clase} style={{
      ...(ancho ? { width: ancho } : { height: alto }),
      aspectRatio: '9 / 16', borderRadius: 18, overflow: 'hidden',
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
function Clip({ src, controlPropio = false }: { src: string; controlPropio?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [andando, setAndando] = useState(false);
  useEffect(() => {
    // ⚠️ El autoplay se RECHAZA cuando se entra por `?plan=` sin ningún gesto
    // previo, que es el caso normal al volver a un anuncio. Sin este fallback, un
    // clip que el navegador no deja arrancar se ve igual que uno que salió mudo.
    ref.current?.play().then(() => setAndando(true)).catch(() => setAndando(false));
  }, [src]);

  // ⚠️ SIN LA BARRA NATIVA cuando el clip es un CONTROL además de un video.
  //
  // El dueño: «ten en cuenta que en este caso el vídeo tiene un interfaz abajo.
  // No sé si se le puede quitar y que solo quede con el botón de PLAY en el
  // medio». Se puede, y además hay que hacerlo: la franja de abajo es justo donde
  // vive «Regenerar» —el mismo lugar que en la foto y en la imagen—, así que la
  // barra de Chrome le comía el control y dejaba dos interfaces peleando por el
  // mismo píxel.
  //
  // Lo que se pierde es el scrub y el volumen. Vale la pena: son 8 segundos en
  // loop, y lo que se decide mirándolo es «¿me sirve?», no «¿qué pasa en el
  // segundo 5?».
  return (
    <>
      <video
        ref={ref}
        key={src}
        src={src}
        controls={!controlPropio}
        loop
        playsInline
        style={MEDIO}
        onPlay={() => setAndando(true)}
        onPause={() => setAndando(false)}
      />
      {controlPropio && (
        <button
          type="button"
          className={`mk-clip__play${andando ? ' mk-clip__play--corriendo' : ''}`}
          onClick={() => {
            const v = ref.current;
            if (!v) return;
            if (v.paused) void v.play(); else v.pause();
          }}
          aria-label={andando ? 'Pausar' : 'Reproducir'}
        >
          <Icon name={andando ? 'pausa' : 'play'} size={56} />
        </button>
      )}
    </>
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
export function Estudio({ pregunta, titulo, paso, total, children, boton, consecuencia, cargando, onSiguiente, atras, onAtras, onSalir, sinSalida, error, puesta, puente, ahora, alLado, slotRiel, plegado, ancho = 900 }: {
  pregunta: string;
  /**
   * El estado del navegador del cliente. ⚠️ ENTRA ACÁ PORQUE EL AVISO NO LLEGABA
   * A NINGUNA DE LAS TRES PANTALLAS DEL ESTUDIO.
   *
   * `AvisoPuente` vivía sólo en el catálogo, y con él su único botón para levantar
   * una sesión que Google marcó. Pero el bloqueo ocurre FILMANDO, que es cuando se
   * le habla a Google — así que la persona veía el error en rojo, con un texto que
   * le decía «en el catálogo, dentro de "Tu navegador", está el botón», y el botón
   * estaba en otra pantalla. Un problema que se muestra en un lugar y se cura en
   * otro es, para el que lo mira, un problema sin cura. Es la segunda vez que pasa
   * en esta tab: la primera fue con «sumar tomas».
   *
   * Va en `Estudio` y no en el paso, para que lo tengan las tres vistas de una y
   * la cuarta que alguien agregue nazca con él.
   */
  puente?: Puente | null;
  /** El reloj del navegador, para medir la frescura del latido. `null` = primer render. */
  ahora?: number | null;
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
  /**
   * Esconde el «Salir». OPCIONAL: sin él, la pantalla se comporta como hasta hoy.
   *
   * ⚠️ Lo pide el ONBOARDING de la tab, y va contra lo que dice la skill
   * `tab-onboarding` —que el recorrido de una tab no bloquea como el global, y
   * que trabar a alguien en un paso opcional es perderlo—. Es una decisión de
   * producto del dueño, textual: «elimina el botón de salir, no se debe poder
   * salir sin completar el onboarding». Queda escrito para que no se «arregle»
   * de vuelta leyendo la skill.
   */
  sinSalida?: boolean;
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
   * El ancho de la columna de este paso. Lo dice el PASO, no se mide.
   *
   * Es lo que decide dónde arranca el ejemplo del costado: el grupo que se centra
   * es «columna + calle + ejemplo». Un paso que dibuja algo angosto y no lo
   * declara deja al ejemplo lejos, con un pozo de aire muerto en el medio.
   */
  ancho?: number;
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
  // ⚠️ UN SOLO NÚMERO mueve el riel Y el aire del estudio. Sin esto había que
  // sumar padding que viven en otros archivos, y ese acople es lo que hacía que
  // la pieza «flotara» al cambiar cualquier cosa alrededor.
  // ⚠️ EL ANCHO DE LA COLUMNA SE MIDE, NO SE ASUME.
  //
  // Estaba escrito como `900px` en el CSS, y ese número era falso en la pantalla
  // que el dueño estaba mirando: el contenido del paso del guion no tiene ancho
  // propio —se encoge a sus tarjetas, 482 px— y se centraba adentro de una caja
  // de 900. Resultado: 194 px de aire muerto entre el texto y el filete contra 16
  // del otro lado, o sea lo contrario de lo que se pidió.
  //
  // Y no hay constante que sirva: cada paso trae un contenido de ancho distinto
  // —la lista de guiones mide 482, la de tomas 900—. Lo único que lo contesta es
  // medirlo.
  //
  // Converge en una pasada: al fijar la caja al ancho del contenido, el contenido
  // sigue entrando igual y no cambia de tamaño. El `clamp` y el umbral de 8 px
  // son la red por si algún día entra algo que sí reaccione al ancho.
  // ⚠️ EL ANCHO SE DECLARA. Lo estuve MIDIENDO y era un bucle: la caja se
  // angostaba, el texto se reacomodaba, medía menos, y se angostaba otra vez —
  // hasta dejar los clips del guion apretados en una columna de 290 px. El
  // `clamp` no lo evitaba, sólo le ponía piso.
  //
  // El error de fondo fue querer que el ancho saliera del contenido cuando el
  // contenido es shrink-to-fit: eso es una definición circular, y ninguna red la
  // arregla. Lo dice cada paso, que es el único que sabe qué va a dibujar.
  const lienzo = useRef<HTMLDivElement>(null);

  // El alto SÍ se mide, y ahí no hay circularidad: el riel es `fixed`, así que
  // moverlo no mueve el contenido. Converge en una pasada.
  const [arriba, setArriba] = useState(116);
  const botones = useRef<HTMLDivElement>(null);
  // ⚠️ EL TOPE. El dueño: «jamás el preview de ejemplo tiene que sobrepasar al
  // botón de siguiente». El alto del ejemplo sale de `62vh`, o sea de la VENTANA:
  // no sabe nada de dónde termina esta pantalla, así que en cuanto la cabecera
  // crece un renglón el ejemplo se cuelga por debajo de los botones y queda
  // flotando sobre nada. `0` = todavía no se midió, y ahí no se topea.
  const [tope, setTope] = useState(0);
  /**
   * El ancho de la ventana sin la barra de scroll.
   *
   * ⚠️ Se MIDE en vez de usar `100vw`, que la incluye. Arranca en 0 y el CSS cae
   * a `100vw` hasta el primer layout: un valor de más por un frame es preferible
   * a adivinar el ancho de una barra que en Windows mide 15 y en Mac 0.
   */
  const [vw, setVw] = useState(0);
  useEffect(() => {
    const medir = () => setVw(document.documentElement.clientWidth);
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);
  useLayoutEffect(() => {
    const el = lienzo.current;
    const hijo = el?.firstElementChild as HTMLElement | null;
    const hueco = slotRiel?.current;
    if (!hijo || !hueco) return;
    const medir = () => {
      const arribaHueco = hueco.getBoundingClientRect().top;
      const d = Math.round(hijo.getBoundingClientRect().top - arribaHueco);
      if (Math.abs(d) > 2) setArriba((prev) => Math.min(320, Math.max(0, prev + d)));

      // Desde donde arranca el ejemplo hasta donde arrancan los botones, menos
      // el aire. Se mide contra la fila de botones y no contra el borde de la
      // ventana: lo que no puede taparse es el camino de salida, no el pie.
      const b = botones.current?.getBoundingClientRect().top;
      if (b == null) return;
      const cabe = Math.round(b - arribaHueco - 20);
      if (cabe > 80) setTope((prev) => (Math.abs(prev - cabe) > 4 ? cabe : prev));
    };
    medir();
    // ⚠️ UNA MEDICIÓN NO ALCANZA AL CAMBIAR DE PASO, y es la cuarta vez que este
    // repo tropieza con lo mismo: **`ResizeObserver` observa TAMAÑO, no
    // POSICIÓN**. Si la cabecera de arriba pasa de una línea a tres, el lienzo no
    // cambia de tamaño —sólo baja—, así que el observador no dispara y el riel se
    // queda a la altura del paso anterior. El dueño lo vio exacto: «mira cómo se
    // quedó el título de Así se verá tu anuncio (que al cerrarlo y volverlo a
    // abrir se pone en su lugar)» — cerrar y abrir es lo único que cambiaba un
    // TAMAÑO y despertaba al observador.
    //
    // La cura es perseguir unos frames después del cambio de paso: el texto ya
    // está, las fuentes ya cargaron, y `medir` converge en una pasada.
    let vivo = true;
    let f = 0;
    const perseguir = () => {
      if (!vivo || f++ > 8) return;
      medir();
      requestAnimationFrame(perseguir);
    };
    requestAnimationFrame(perseguir);

    const obs = new ResizeObserver(medir);
    obs.observe(hijo);
    if (botones.current) obs.observe(botones.current);
    return () => { vivo = false; obs.disconnect(); };
  }, [paso, children, slotRiel]);

  const anchoRiel = puesta?.ejemplo
    ? ({
      // ⚠️ EL RIEL CONSERVA SU ANCHO AL CERRAR, y lo que se achica es sólo el
      // video adentro. Es la única forma de cumplir las dos cosas que se pidieron
      // y que se contradicen si el riel se angosta: que la miniatura «no cuente
      // para el centrado» —o sea que el texto no se mueva— y que no termine «en
      // el lugar equivocado». Angostando el riel, el grupo se re-centra y la
      // pantalla entera salta; con el ancho quieto, sólo se mueve lo que se
      // apretó, y la miniatura queda arriba a la izquierda de su propio carril.
      ['--riel-ancho' as string]: RIEL,
      ['--riel-calle' as string]: `${CALLE}px`,
      // El ancho de la ventana SIN la barra de scroll. El porqué está en ui.css,
      // donde se consume: `100vw` la INCLUYE y el `right:` de un `fixed` no, así
      // que el riel y el contenido venían midiendo dos ventanas distintas.
      ...(vw > 0 ? { ['--riel-vw' as string]: `${vw}px` } : {}),
      ['--riel-contenido' as string]: `${ancho}px`,
      ['--riel-arriba' as string]: `${arriba}px`,
      ...(tope > 0 ? { ['--riel-tope' as string]: `${tope}px` } : {}),
      // ⚠️ 1 DESPLEGADO, 0 CERRADO — y esta variable ya entró y salió dos veces
      // hoy, así que conviene decir para qué sirve y para qué NO.
      //
      // SÍ: decide si el ejemplo cuenta para centrar el CONTENIDO. Abierto son
      // dos columnas y el conjunto se centra —el texto se corre a la izquierda—;
      // cerrado es un control al costado y el texto vuelve al medio. Pedido del
      // dueño, dos veces: «cuando se cierra la preview tiene que volver a
      // centrarse todo».
      //
      // NO: los botones. Se probó correrlos con esto y lo cortó al verlo — el par
      // «Continuar / Volver» es lo único que no se mueve en la pantalla, y un
      // ancla que se mueve deja de ser un ancla.
      //
      // Y la primera vez falló por otra cosa: la miniatura se iba al borde
      // mientras el texto se quedaba quieto, o sea medio movimiento. Van las dos
      // cosas juntas o ninguna.
      ['--riel-cuenta' as string]: plegado ? '0' : '1',
    } as React.CSSProperties)
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
      {/* ⚠️ EL ENVOLTORIO SE DIBUJA SÓLO SI HAY AVISO. `AvisoExtensionVieja`
          devuelve `null` cuando la extensión está al día —o sea casi siempre— y
          un hijo vacío de un contenedor `flex` con `gap` NO mide 0: mide 0 y
          ADEMÁS se cobra el gap. Eran 22 px que empujaban toda la pantalla hacia
          abajo sin que nada se viera. Un `display: contents` no alcanza: el hueco
          lo crea el gap, no la caja. */}
      {/* ⚠️ SIN ENVOLTORIO. `AvisoExtensionVieja` devuelve `null` cuando la
          extensión está al día —o sea casi siempre— y un hijo vacío de un
          contenedor `flex` con `gap` no mide 0: mide 0 y ADEMÁS se cobra el gap.
          Eran 22 px que empujaban toda la pantalla hacia abajo sin que se viera
          nada. El ancho se lo pone el propio aviso, que es el único que sabe si
          va a existir — poner la condición acá afuera la tendría en dos lugares. */}
      <AvisoExtensionVieja instalada={extensionInstalada} compacto />
      {/* ⚠️ Y EL DEL PUENTE, que es el que trae la salida cuando Google frena la
          sesión. Va DEBAJO del de la versión y no arriba: una extensión vieja
          explica casi siempre al puente caído, así que reconectar sobre una
          versión vieja es arreglar el síntoma de abajo. Uno a la vez. */}
      {/* `puente === undefined` es «esta pantalla no lo pasa», y eso NO es lo
          mismo que `null` («no hay puente»): con `undefined` no se afirma nada.
          Sin esta distinción, cualquier uso de `Estudio` que olvide el prop
          pintaría «tu navegador no está conectado» sobre un navegador sano. */}
      {puente !== undefined && !estadoDelPuente(puente, ahora ?? null).anda && (
        <AvisoPuente puente={puente} ahora={ahora ?? null} instalada={extensionInstalada} compacto />
      )}

      <div style={{
        display: 'flex', alignItems: 'center', width: '100%', maxWidth: ancho, gap: 16,
      }}>
        {/* El onboarding de la tab lo esconde: ahí no se puede salir sin terminar. */}
        {!sinSalida && (
          <button type="button" onClick={onSalir} style={salida}>← Salir</button>
        )}
      </div>

      {/* ⚠️ ACÁ HABÍA UNA FILA DE DOS COLUMNAS. Se fue entera: el riel es `fixed`
          contra el borde de la PANTALLA, así que no hay segunda columna contra la
          cual flotar, ni `flexWrap` que decida solo cuándo la referencia se va
          abajo. Los hijos vuelven a ser hijos directos del estudio. */}
      {/* La barra de posición: segmentos finos, no dots de formulario. Dice
          dónde estás sin pedir nada y sin ocupar una fila entera. */}
      <div style={{
        display: 'flex', gap: 4, width: '100%', maxWidth: Math.min(520, ancho), alignItems: 'center',
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
      <div style={{ textAlign: 'center', maxWidth: Math.min(820, ancho) }}>
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

      <div ref={lienzo} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{children}</div>

      {error && (
        <div style={{
          fontSize: 'var(--fs-sm)', color: 'var(--bad)', textAlign: 'center', maxWidth: 560,
        }}>
          {error}
        </div>
      )}

      {/* ⚠️ SE DIBUJA CON `boton` O CON `onAtras`, y antes sólo con `boton`.
          Con el gate atado al principal, TODA pantalla sin botón que avanza
          perdía también su «Volver» — y el paso final del anuncio es
          exactamente eso: declara `atras` y `onAtras` y no declara `boton`, así
          que su vuelta atrás existía, compilaba y no la dibujaba nadie.
          Con las siete tomas filmadas eso dejaba el anuncio en una PUERTA DE UN
          SOLO SENTIDO: ningún camino a una pantalla de toma, o sea ningún camino
          a rehacer una ni a recuperar un clip descartado. La única salida era
          abandonar el anuncio.
          Es «escribir la salida no es ofrecerla» servido por un gate: el destino
          estaba bien elegido y bien escrito, y el render lo tapaba. */}
      {(boton || onAtras) && (
        // ⚠️ LOS BOTONES SE CENTRAN CONTRA LA COLUMNA, y ahí se quedan.
        //
        // Lo probé corriéndolos al eje del grupo cuando el ejemplo está
        // desplegado —el dueño lo pidió y el argumento era bueno: desplegado se
        // ve una pantalla de dos columnas—. Lo cortó al verlo: «hazlo como estaba
        // antes, porque se rompen muchas cosas».
        //
        // Y se entiende por qué: el par de botones es lo único que NO se mueve en
        // toda la pantalla, así que engancharlo al ejemplo lo convierte en una
        // pieza más que baila. Un ancla que se mueve deja de ser un ancla.
        <div ref={botones} style={{ textAlign: 'center' }}>
          {/* «Volver» AL LADO del principal y en peso bajo. Antes vivía al pie de
              la pantalla, lejos de lo que sigue: el par de salidas de un paso se
              lee junto o no se lee. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            {onAtras && (
              // ⚠️ SE APAGA MIENTRAS TRABAJA. El principal ya se apagaba solo con
              // `loading`, y «Volver» quedaba vivo: apretarlo con una generación
              // en vuelo cambia de paso debajo de una acción que va a contestar
              // sobre otra pantalla. El dueño: «el usuario puede seguir apretando
              // botones, no queremos bugs del estilo».
              <Button variant="tertiary" disabled={cargando} onClick={onAtras}>{atras ?? 'Volver'}</Button>
            )}
            {/* ⚠️ EL QUE AVANZA TIENE QUE PESAR MÁS QUE TODO LO DEMÁS.
                Con `size="xl"` a secas quedaba del mismo porte que el «Volver»
                de al lado, y en una pantalla cuyo trabajo entero es «mirá esto y
                seguí» eso deja las dos salidas empatadas. Se le da ancho mínimo y
                aire propio: el peso de un botón es lo que dice, en un segundo,
                cuál es el camino. */}
            {/* ⚠️ LA CONSECUENCIA VA ADENTRO DE ESTA COLUMNA, no debajo de la
                fila. Centrada en la fila quedaba corrida a la izquierda —la fila
                incluye el «Volver»— y una línea que dice lo que cuesta apretar
                tiene que estar debajo del botón que cobra, no debajo del par. */}
            {/* ⚠️ `position: relative` y la consecuencia ABSOLUTA. El dueño: «el
                botón de Volver SIEMPRE debe estar centrado a la letra del botón
                de CONTINUAR». Con la consecuencia en el flujo, esta columna mide
                botón + línea, y «Volver» —que se centra contra la columna— queda
                más arriba que el rótulo al que acompaña. Sacándola del flujo, la
                columna vuelve a medir lo que mide el botón. */}
            {/* ⚠️ Y EL PRINCIPAL SIGUE ATADO A `boton`. Al abrir la fila para que
                «Volver» exista sin él, esta caja quedaba dibujando un botón
                VACÍO en la pantalla final — un rectángulo apretable sin rótulo,
                que es peor que no tener botón. Abrir un gate obliga a mirar qué
                más vivía adentro. */}
            {boton && (
            <div style={{ minWidth: 220, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
              {consecuencia && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 10,
                  fontSize: 'var(--fs-sm)', color: 'var(--dim)', textAlign: 'center',
                }}>
                  {consecuencia}
                </div>
              )}
            </div>
            )}
          </div>

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
      // `min()` con el tope medido: gana el más chico de los dos. Sin el tope
      // —el primer cuadro, antes de medir— vale sólo `EJEMPLO`, que es lo que
      // valía antes.
      style={{
        ['--mk-riel-alto' as string]: abierta
          ? `min(${EJEMPLO}, var(--riel-tope, 100vh))`
          : EJEMPLO_CERRADO,
      }}
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

export function WizardAnuncio({ item, contexto, puesta, costoTexto, saldo, onCambio, onSalir, slotRiel, plegado }: {
  item: PlanGuardado;
  contexto: EstadoContextoVideo | null;
  puesta: Puesta | undefined;
  /** Lo que cuesta una toma, ya redactado por quien sabe el saldo. */
  costoTexto: string;
  /**
   * Créditos que quedan en la cuenta de Flow. `null` = nunca se leyó.
   *
   * ⚠️ ENTRA COMO PROP PORQUE LA ADVERTENCIA NO EXISTÍA. El dueño lo pidió en una
   * frase que está citada, textual, en la cabecera de `saldo-datos.ts`: «si
   * tenemos el saldo, y un usuario quiere generar un video, y ya de antemano
   * sabemos por la cantidad de tokens que consume cada clip y la cantidad de
   * clips que hay, si le alcanzará o no».
   *
   * Se escribió entero —`alcanzaParaAnuncio()` en saldo-datos.ts, `alcanzaTodo`
   * en VideoGeneratorApp— y **ninguno de los dos tenía un solo lector**. O sea
   * que «Filmar las 6 que faltan» cobraba ~72 créditos sin mirar si había 72.
   * Es la regla de la casa: escribir la salida no es ofrecerla.
   */
  saldo: number | null;
  onCambio: (item: PlanGuardado) => void;
  onSalir: () => void;
  /** Dónde aterriza el ejemplo. El video lo dibuja `PreviaVolante`, arriba. */
  slotRiel?: React.RefObject<HTMLDivElement | null>;
  plegado?: boolean;
}) {
  const [forzado, setForzado] = useState<Paso | null>(null);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  /** El panel de regenerar, encima de la imagen. Dos salidas y nada más. */
  const [rehacer, setRehacer] = useState(false);
  const [desde, setDesde] = useState(() => Date.now());
  const archivo = useRef<HTMLInputElement>(null);

  // ⚠️ `useRouter` de `app/_ui/Link`, NO el de next/navigation: preserva el `?ws=`
  // de la pestaña, y perderlo te deja mirando otra cuenta.
  const router = useRouter();
  const [eligiendoFoto, setEligiendoFoto] = useState(false);
  /**
   * Cuántos escenarios de este anuncio ya están generados en uno anterior.
   *
   * ⚠️ SE PREGUNTA UNA VEZ POR ANUNCIO, no en cada render del paso. La respuesta
   * no cambia mientras la persona mira: sólo cambia cuando ELLA reusa, y ahí se
   * pone en cero desde acá. Preguntarlo por escenario serían cuatro viajes para
   * la misma respuesta.
   */
  /**
   * ⚠️ LA RESPUESTA LLEVA DE QUÉ ANUNCIO ES, y antes se limpiaba con un
   * `setYaGenerados(null)` al principio del efecto. Dos cosas mejoran:
   *
   * · El número viejo no se puede pintar NUNCA sobre el anuncio nuevo. Con el
   *   reset había una ventana —entre que el efecto corre y que el server
   *   contesta— en la que la oferta decía «ya generaste 3 de 4» sobre un
   *   anuncio que no tiene ninguno. Un atajo que ofrece algo que no existe
   *   manda a la persona a un botón que después falla.
   *
   * · Y deja de ser un `setState` síncrono adentro de un efecto, que es lo que
   *   marca `react-hooks/set-state-in-effect`: React puede tener que renderizar
   *   dos veces por cada cambio de anuncio para llegar al mismo estado.
   */
  const [yaGenerados, setYaGenerados] = useState<{ de: string; cuantos: number; total: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    void escenariosYaGeneradosAction(item.id).then((r) => {
      if (vivo && r.ok) setYaGenerados({ de: item.id, cuantos: r.cuantos, total: r.total });
    }).catch(() => { /* la oferta es un atajo: si no se puede saber, no se ofrece */ });
    return () => { vivo = false; };
  }, [item.id]);
  /** La oferta, sólo si es de ESTE anuncio. Ver el porqué arriba. */
  const reusables = yaGenerados?.de === item.id ? yaGenerados : null;
  /** El panel de salidas encima del CLIP (el gemelo de `rehacer`, que es el de la imagen). */
  const [rehacerClip, setRehacerClip] = useState(false);
  /** Qué toma se está mirando en el paso único. */
  const [tomaSel, setTomaSel] = useState(1);
  /** El texto del prompt mientras se edita, en el paso `prompt`. */
  const [promptTexto, setPromptTexto] = useState('');
  /**
   * Llegó al escenario preguntándose si la IA lo copió bien.
   *
   * Es un estado de PANTALLA y no del plan: explica de dónde viene, y no tiene
   * que sobrevivir a una recarga. Guardarlo sería prometer que la app recuerda
   * una duda.
   */
  const [explicandoParecido, setExplicandoParecido] = useState(false);
  const paso = pasoDe(item, forzado);
  const mapa = useMemo(() => mapaDe(item), [item]);
  const total = item.plan.clips.length;

  /**
   * Lo que cuesta filmar la toma `n`, con su número EXACTO.
   *
   * Sale de la duración de ese clip (`lib/costo-clip.ts`), que es de lo que
   * depende el precio de verdad. Se cae al texto general —el que trae el costo
   * medido del workspace— sólo cuando la duración no está en la tabla, y ahí sí
   * se anuncia como estimación.
   */
  const costoDeToma = useCallback((n: number): string => {
    const c = item.plan.clips.find((x) => x.n === n);
    const creditos = c ? creditosDeClip(c.segundos) : null;
    return creditos == null ? costoTexto : textoCosto(creditos);
  }, [item.plan.clips, costoTexto]);

  /**
   * El costo SUELTO, para meterlo adentro de otra frase.
   *
   * ⚠️ Va aparte de `costoDeToma` y no es duplicación: uno arma la línea entera
   * que cuelga del botón («Costo: 15 créditos.») y el otro entra en el resumen de
   * un pliegue («Rehacer la toma 2 · 12 créditos»). Meter la frase completa
   * adentro de la otra da «Rehacer la toma 2 · Costo: 12 créditos.», que es la
   * misma palabra dos veces y un punto en el medio de un rótulo.
   */
  const creditosDeToma = useCallback((n: number): string => {
    const c = item.plan.clips.find((x) => x.n === n);
    const creditos = c ? creditosDeClip(c.segundos) : null;
    return creditos == null ? '~15 créditos (estimado)' : `${creditos} créditos`;
  }, [item.plan.clips]);

  /**
   * El único camino de la pantalla a una action.
   *
   * ⚠️ DEVUELVE SI SALIÓ BIEN, y antes no devolvía nada. Un `.then()` encadenado
   * corría IGUAL después de un fallo, así que «elige el lugar y avanza» avanzaba
   * también cuando el lugar no se había podido guardar — y la pantalla siguiente
   * escribía los escenarios sin él, silenciando la elección en vez del error.
   */
  const correr = useCallback(async (
    etiqueta: string,
    fn: () => Promise<{ ok: boolean; item?: PlanGuardado; error?: string }>,
    avanzar = true,
  ): Promise<boolean> => {
    setOcupado(etiqueta);
    setError('');
    setDesde(Date.now());
    // ⚠️ ESTE `catch` ES EL CAMINO SIN RESPUESTA, no «algo falló».
    //
    // Sólo se llega acá cuando la action ni siquiera contestó: la red se cortó,
    // la pestaña perdió conexión, el deploy se reinició en el medio. Todo error
    // que el server SÍ pudo clasificar viene en `r.error` y llega con su causa y
    // su link. Un «No se pudo» a secas los hacía ver iguales.
    //
    // Y lo que importa decir acá es lo que la persona no puede saber: que no se
    // perdió nada y que no se cobró nada, porque el pedido no llegó a salir.
    const r = await fn().catch(() => ({
      ok: false as const,
      item: undefined,
      error: 'No llegó respuesta. No se perdió nada de lo que hiciste: vuelve a intentarlo.',
    }));
    // Lo que esta action haya encolado ya está en la cola: se le avisa al puente
    // en vez de dejarlo dormir hasta su próxima alarma. Va acá y no en cada
    // botón porque `correr` es el único camino de la pantalla a una action.
    avisarPuente();
    // ⚠️ EL `item` SE APLICA VENGA COMO VENGA EL `ok`, Y ANTES SE TIRABA.
    //
    // Una action puede FALLAR y haber escrito igual — la salida temprana de
    // «todavía estoy subiendo tu foto» borra el fallo del intento anterior antes
    // de rendirse. Con la condición atada a `r.ok`, ese trabajo se descartaba y
    // la pantalla seguía pintando un estado que el server ya no tenía: el error
    // viejo arriba y el nuevo abajo, contradiciéndose.
    if (r.item) onCambio(r.item);
    if (r.ok) {
      // Al avanzar se suelta el paso forzado: la posición vuelve a salir del dato.
      // Y con él la explicación del parecido, que es un estado de PANTALLA: dejarla
      // prendida haría que el escenario siguiera preguntando «¿se parece a tu
      // foto?» en visitas que no vienen de ahí.
      if (avanzar) { setForzado(null); setExplicandoParecido(false); }
    } else {
      setError(r.error || 'No se pudo.');
    }
    setOcupado('');
    return r.ok;
  }, [onCambio]);

  // ── El sondeo, uno solo y para las dos esperas ──────────────────────────
  // La imagen del escenario y el clip de la toma esperan igual y se apagan igual.
  // ⚠️ LA MISMA REGLA QUE EL RENDER, importada. Tenerla escrita dos veces fue
  // exactamente el bug: se actualizó una y la otra quedó vieja.
  const escenaEnCurso = (item.escenas ?? []).find((e) => imagenEnCurso(item.imagenes?.[String(e.n)]));
  // ⚠️ TODAS LAS QUE ESTÉN EN VUELO, no la primera.
  //
  // Era `.find`, o sea que el sondeo seguía UNA sola toma. Con «filmar todas»
  // —siete tomas lanzadas juntas— las otras seis no se preguntaban hasta que la
  // primera terminaba: se resolvían EN SERIE aunque Google las estuviera
  // haciendo en paralelo. El formato admite hasta doce.
  //
  // Y no es sólo que se vean tarde: `estadoTomaAction` es quien ENCOLA la
  // consulta siguiente de cada toma, así que una toma que nadie sondea no
  // avanza. La cadena de una toma la mueve la pantalla, no la cola.
  const tomasEnCurso = item.plan.clips.filter((c) => {
    const v = item.video?.[String(c.n)];
    if (!v || v.url) return false;
    // Una marca que sólo guarda clips descartados no tiene nada en vuelo: sin
    // esto el sondeo preguntaría cada pocos segundos por un trabajo inexistente.
    if (!v.trabajoId && !v.operacion) return false;
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

  // Las tomas en vuelo, como una clave estable: sin esto el efecto se re-arma en
  // cada render —`filter` devuelve un array nuevo siempre— y el sondeo no llega
  // a completar una sola vuelta.
  const enVuelo = tomasEnCurso.map((c) => c.n).join(',');

  useEffect(() => {
    if (!escenaEnCurso && !enVuelo) return;
    let vivo = true;

    const vuelta = async () => {
      if (escenaEnCurso) {
        const r = await estadoImagenAction(item.id, escenaEnCurso.n).catch(() => null);
        avisarPuente();
        if (vivo && r?.ok) onCambio(r.item);
        return;
      }
      // ⚠️ EN SERIE, y no con `Promise.all`. Cada `estadoTomaAction` LEE el
      // historial y lo ESCRIBE: en paralelo, las siete leerían la misma versión
      // y la última en volver pisaría lo que escribieron las otras seis. Lo que
      // se perdería es justo lo bueno —la url de un clip que sí llegó— y se
      // vería como un clip que se generó y desapareció.
      //
      // En serie no cuesta lo que parece: cada vuelta son ~7 viajes de ~300 ms
      // contra un intervalo de 6 s, y las consultas a Google siguen su ritmo
      // aparte, en la cola.
      for (const n of enVuelo.split(',')) {
        if (!vivo) return;
        const r = await estadoTomaAction(item.id, Number(n)).catch(() => null);
        // ⚠️ ACÁ ES DONDE MÁS PESA, y por volumen: preguntar cómo va un clip son
        // 234 de los 348 trabajos medidos en producción, y su espera en la cola
        // llegaba a un p90 de 357 s. Cada vuelta de este sondeo encola una
        // consulta; sin el aviso, esa consulta duerme hasta la próxima alarma
        // del navegador y recién ahí sale.
        avisarPuente();
        if (vivo && r?.ok) onCambio(r.item);
      }
    };

    // ⚠️ SE PREGUNTA AL ARMARSE, no un período después. El intervalo dispara
    // recién a los 6 s, así que la primera consulta de cada espera nacía tarde
    // — y como es la que encola la primera pregunta a Google, ese retraso lo
    // pagaba entero el cliente mirando el loader.
    void vuelta();
    const t = setInterval(() => { void vuelta(); }, escenaEnCurso ? 4000 : 6000);
    return () => { vivo = false; clearInterval(t); };
  }, [escenaEnCurso, enVuelo, item.id, onCambio]);

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
  /**
   * Cuántas veces se intentó escribir los escenarios solo.
   *
   * ⚠️ EL TOPE ES EL ARREGLO. Sin él, un fallo dejaba el efecto reintentando cada
   * vez que cambiaba cualquiera de sus dependencias —o sea cada pocos segundos—
   * contra un modelo que cobra, sin que nada lo contara ni lo dijera. Y la
   * pantalla no ofrecía ningún botón, así que ni siquiera se veía como un error:
   * se veía como una pantalla que no terminaba de cargar.
   *
   * Dos automáticos y para. De ahí en adelante reintenta la PERSONA, con el botón
   * que ahora sí existe — que además es información: si hay que apretarlo, algo
   * está fallando de verdad.
   */
  const intentosEscenas = useRef(0);
  useEffect(() => {
    if (paso.id !== 'escenario') return;
    if ((item.escenas?.length ?? 0) > 0 || escribiendo.current || ocupado) return;
    if (intentosEscenas.current >= 2) return;
    intentosEscenas.current += 1;
    escribiendo.current = true;
    void (async () => {
      const r = await escribirEscenasAction(item.id).catch(() => null);
      if (r?.ok) { intentosEscenas.current = 0; onCambio(r.item); }
      else setError(r?.error || 'MaKo no pudo escribir los escenarios. Prueba otra vez.');
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
    /** El ancho de la columna de ESTE paso. Ver el prop `ancho` de `Estudio`. */
    ancho?: number;
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
        // La lista de tomas mide 760 (`maxWidth` de su contenedor). Sin declararlo
        // la columna valía 900 y el ejemplo del costado quedaba 70 px más lejos
        // que del otro lado del filete: «no hay el mismo espacio, hay mucho más».
        ancho: 760,
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
          // ⚠️ ANCHO FIJO, no `100%`. La caja de contenido del estudio mide
          // `declarado - 56`, así que un `100%` dibujaba 704 sobre un `ancho`
          // declarado de 760 — y el ejemplo del costado, que se ubica con el
          // DECLARADO, quedaba a 44px del filete en vez de a 16. Lo que se dibuja
          // tiene que medir lo que se declara.
          <div style={{ width: 760, margin: '0 auto' }}>
            {/* ⚠️ EL AVISO DEL PERFIL, que se calculaba y no lo dibujaba nadie.
                `video-datos.ts` dice textual que lee el perfil «para poder
                avisarlo ANTES, en la pantalla, en vez de dejar que el usuario
                escriba un tema y recién ahí falle» — y `faltanDelPerfil` no tenía
                un solo lector. Dos consultas por carga cuyo resultado se
                descartaba, y el aviso que las justificaba sin existir. */}
            {contexto && !contexto.perfilListo && contexto.faltanDelPerfil.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <Alert tono="warn">
                  <strong>Tu perfil está incompleto.</strong> Falta {contexto.faltanDelPerfil.join(', ')}.
                  MaKo escribe el anuncio con eso, así que sin ello sale genérico.{' '}
                  <Link href="/onboarding">Completarlo</Link>
                </Alert>
              </div>
            )}
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
                  {/* ⚠️ EL AVISO NO PUEDE SER SOLO UN AVISO.
                      Acá decía «No entra en 8 segundos» y no ofrecía nada. El
                      arreglo existía —sumar una toma, darle más segundos— pero
                      vivía en la pantalla SIGUIENTE, plegado detrás de un renglón
                      gris que dice «Cambiar el guion». El dueño lo reportó como
                      que no existía: «tampoco veo que se puedan agregar tomas,
                      editar los segundos de alguna».
                      Tenía razón. Un problema que se muestra en una pantalla y se
                      cura en otra es, para el que lo mira, un problema sin cura.
                      Las dos salidas van ACÁ, al lado del aviso que las pide. */}
                  {(c.palabras ?? 0) > (c.tope ?? 0) && (
                    <div style={{ marginTop: 7, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Status tono="warn">
                        No entra en {c.segundos} segundos: sobran {(c.palabras ?? 0) - (c.tope ?? 0)} palabras
                      </Status>
                      {/* Alargar la toma es lo más barato: no agrega un clip, así
                          que no agrega un crédito. Por eso va primero. */}
                      {c.segundos < 10 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!!ocupado}
                          loading={ocupado === `dur-${c.n}`}
                          onClick={() => void correr(`dur-${c.n}`, () => editarClipsAction(item.id, {
                            que: 'duracion', n: c.n, segundos: c.segundos === 4 ? 6 : c.segundos === 6 ? 8 : 10,
                          }), false)}
                        >
                          Darle {c.segundos === 4 ? 6 : c.segundos === 6 ? 8 : 10} segundos
                        </Button>
                      )}
                      {/* ⚠️ EL NÚMERO SALE DE LA CUENTA, NO ES «dos» FIJO.
                          Decía «Partirla en dos tomas» siempre. Una toma de 70
                          palabras sobre un tope de 24 necesita TRES: partida en
                          dos quedaban 35 y 35, seguía sin entrar, y la persona
                          tenía que descubrir apretando que el botón no alcanzaba.
                          Medido en producción: dos planes así, de 70 y 63
                          palabras. */}
                      {(() => {
                        // El número sale de SIMULAR el corte sobre este plan, no
                        // de una división: es el mismo cálculo que va a correr el
                        // server, así que el botón no puede prometer un número y
                        // el resultado ser otro.
                        const enCuantas = enCuantasQueda(item, c.n);
                        return (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!!ocupado}
                            loading={ocupado === `add-${c.n}`}
                            onClick={() => void correr(`add-${c.n}`, () => editarClipsAction(item.id, {
                              que: 'partir', n: c.n,
                            }), false)}
                          >
                            Partirla en {enCuantas} tomas
                          </Button>
                        );
                      })()}
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
        onSiguiente: () => setForzado({ id: 'lugar' }),
      };
    }

    // ── 2. Dónde se graba ─────────────────────────────────────────────────
    //
    // ⚠️ EL LUGAR NO ES EL FORMATO, y hasta hoy eran la misma pregunta. El
    // formato dice CÓMO se filma —la cámara, el ritmo, cuántos escenarios—; el
    // lugar dice DÓNDE pasa, y lo decidía MaKo leyendo el guion sin preguntar.
    // Martín: «si quiero grabar en la oficina y quiero hacer variaciones del
    // fondo».
    if (paso.id === 'lugar') {
      // Sólo los que funcionan con la cámara de este formato. Ofrecer una
      // oficina para «Car Talks» —que ES un selfie adentro de un auto— no es dar
      // una opción más: es ofrecer romper el formato y descubrirlo después.
      // Sin formato resuelto no se puede filtrar, y ahi se ofrecen todos: una
      // grilla vacia no protege de nada, deja sin salida.
      const lugares = puesta ? escenariosParaCamara(puesta.camara) : CATALOGO_ESCENARIOS;
      const elegido = item.escenarioId;
      return {
        pregunta: '¿Dónde se graba?',
        cuerpo: (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 10, width: '100%',
          }}>
            {lugares.map((l) => {
              const esEste = elegido === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={!!ocupado}
                  onClick={() => void correr(`lugar-${l.id}`, () => elegirEscenarioAction(item.id, l.id), false)
                    .then((ok) => { if (ok) setForzado({ id: 'escenario', n: 1 }); })}
                  style={{
                    display: 'grid', gap: 5, textAlign: 'left', cursor: ocupado ? 'default' : 'pointer',
                    padding: '15px 16px', borderRadius: 'var(--r-md)',
                    background: esEste ? 'var(--mako-bg)' : 'var(--surface-2)',
                    border: `1px solid ${esEste ? 'var(--mako-border)' : 'var(--border)'}`,
                    opacity: ocupado && ocupado !== `lugar-${l.id}` ? 0.5 : 1,
                    font: 'inherit', color: 'inherit',
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    fontSize: 'var(--fs-card)', fontWeight: 600, color: 'var(--ink)',
                  }}>
                    {l.nombre}
                    {ocupado === `lugar-${l.id}` && <Icon name="regenerar" size={14} />}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5 }}>
                    {l.descripcion}
                  </div>
                  {/* Cuándo conviene, que es lo que ayuda a elegir. La descripción
                      dice qué ES el lugar; sin esto hay que deducir para qué sirve. */}
                  <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', lineHeight: 1.5 }}>
                    {l.cuando}
                  </div>
                </button>
              );
            })}
          </div>
        ),
        // ⚠️ LA SALIDA ES «QUE LO ELIJA MAKO», y tiene que existir: así funcionó
        // esta tab desde siempre y sigue siendo una respuesta correcta. Un
        // catálogo cerrado SIN escape convierte una ayuda en un peaje.
        //
        // Va como botón secundario y no como una tarjeta más de la grilla:
        // mezclada entre los lugares se leería como un lugar, que es justo lo
        // que no es.
        boton: 'Que lo elija MaKo leyendo mi guion',
        consecuencia: 'No gasta créditos.',
        onSiguiente: () => setForzado({ id: 'escenario', n: 1 }),
        atras: 'Volver al guion',
        onAtras: () => setForzado({ id: 'guion-leer' }),
      };
    }

    // ── 3. El lugar ───────────────────────────────────────────────────────
    if (paso.id === 'escenario') {
      const escena = (item.escenas ?? []).find((e) => e.n === paso.n);
      // Todavía no llegaron los escenarios: MaKo los está escribiendo (el efecto
      // de arriba). La pantalla lo dice con la misma niebla que todo lo demás.
      const sinEscenas = !escena;
      const marca = item.imagenes?.[String(paso.n)];
      const opciones = marca?.opciones ?? [];
      // Dónde eligió grabar la persona. `null` en todo anuncio anterior al
      // catálogo, y ahí este paso funciona exactamente como funcionaba.
      const lugarElegido = escenarioPorId(item.escenarioId);
      // La MISMA función que usa el sondeo: una regla, un lugar.
      const generando = imagenEnCurso(marca);
      const causa: CausaFlow | undefined = marca?.error
        ? ((marca.errorCausa as CausaFlow) ?? causaFlow(marca.errorCrudo ?? marca.error))
        : undefined;
      // ⚠️ CON LA FRASE DEL SERVER, que se calculaba y se pisaba con la genérica.
      //
      // Es el MISMO defecto que ya se había arreglado en el paso de filmar y que
      // seguía vivo en su hermano. Costó caro hoy, en vivo: a una clienta cuyo
      // puente estaba PERFECTO —`listo`, visto hace un segundo— la pantalla le
      // decía «el puente con Google Flow no responde… está cerrada, o la sesión
      // de Google no está abierta», o sea a arreglar algo que no estaba roto.
      // Lo que el server había escrito era «Todavía no vi a Google Flow generar
      // una imagen. Abre Flow con esta pestaña abierta y genera una imagen a
      // mano» — la instrucción exacta que la destrababa, guardada en la base y
      // nunca dibujada.
      const txt = causa
        // ⚠️ `errorDetalle`, QUE ES EL CAMPO QUE FALTABA. Acá decía `errorCrudo`
        // con este razonamiento: `error` guarda el TÍTULO, así que devolvérselo a
        // `textoFlow` lo imprimía dos veces, y «la frase que sirve vive en
        // `errorCrudo`». La primera mitad era cierta; la segunda, sólo a veces.
        //
        // `errorCrudo` significaba DOS cosas según quién lo escribiera: una
        // instrucción cuando venía de `falloGuardable`, y el JSON crudo de Google
        // cuando venía del sondeo. Medido el 02/09/2026 en el mismo historial de
        // una clienta, con los dos casos a la vez — y al segundo le pintamos el
        // payload centrado en el recuadro del video.
        //
        // Ahora la frase tiene su propio campo y el crudo vuelve a ser sólo
        // evidencia. Las marcas viejas no lo tienen y caen a la constante, que es
        // genérica y verdadera.
        ? textoFlow(causa, `la imagen del escenario ${paso.n}`, marca?.errorAt, undefined, marca?.errorDetalle)
        : null;

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
        // ⚠️ CON LOADER, no pintándose de arriba hacia abajo. El dueño ya lo
        // había pedido para las fotos y esta imagen se había quedado afuera:
        // «no se puso el loader en la foto que yo subí y eso hizo que se cargara
        // como ya te mencioné que no quiero que se cargue».
        // Una imagen que aparece por franjas se lee como una conexión rota; y
        // acá encima es la que se está juzgando.
        <Revela k={marca.elegida}><Foto src={marca.elegida} alt={escena?.lugar ?? ''} /></Revela>
      ) : (
        // ⚠️ ERA UN ÍCONO SUELTO EN EL MEDIO DE UNA CAJA GRIS, y el dueño lo leyó
        // como lo que parecía: «para que no quede como una imagen rota». Un ícono
        // de imagen sin nada más ES el dibujo universal de un archivo que no
        // cargó — o sea que la pantalla anunciaba una falla donde no había
        // ninguna, en el paso más caro del recorrido.
        //
        // Lo que va acá no es un adorno: es la única instrucción de la pantalla.
        // La flecha apunta a la izquierda porque ahí está la foto que hay que
        // elegir, y sin ella «selecciona tu foto» obliga a buscar dónde.
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          gap: 10, padding: '24px 22px', textAlign: 'left', color: 'var(--dim)',
        }}>
          {/* ⚠️ EL ATAJO VA ARRIBA DE LA INSTRUCCIÓN, no debajo. Martín: «si ya
              hice 1 generación, evitamos pasar por tantos pasos». Un atajo que
              aparece después del camino largo llega tarde: para cuando se lee, la
              persona ya empezó a hacer lo otro.

              Y sólo se ofrece con el NÚMERO: «tienes 3 de 4» es una decisión,
              «puedes reusar escenarios» es una casilla que nadie sabe si le
              conviene. El número sale del server, que es el que sabe qué lugares
              coinciden — no del formato, porque un escenario es del LUGAR. */}
          {!!reusables?.cuantos && (
            <div style={{
              width: '100%', display: 'grid', gap: 9, marginBottom: 4,
              padding: '13px 15px', borderRadius: 'var(--r-md)',
              background: 'var(--mako-bg)', border: '1px solid var(--mako-border)',
            }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.5 }}>
                Ya generaste{' '}
                <strong>
                  {reusables.cuantos === 1
                    ? 'el escenario de este lugar'
                    : `${reusables.cuantos} de tus ${reusables.total} escenarios`}
                </strong>{' '}
                en otro anuncio. Puedes usarlos y saltarte este paso.
              </div>
              <Button
                size="sm"
                variant="mako"
                disabled={!!ocupado}
                loading={ocupado === 'reusar'}
                icon={<Icon name="regenerar" size={14} />}
                onClick={() => void correr('reusar', () => reusarEscenariosAction(item.id), false)
                  .then((ok) => { if (ok) setYaGenerados(null); })}
              >
                Usar los que ya tengo
              </Button>
              {/* La salida del atajo, dicha: el que quiere uno nuevo no tiene que
                  deducir que puede seguir de largo. */}
              <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>
                O sigue abajo para generar uno nuevo.
              </div>
            </div>
          )}
          {/* ⚠️ MINIMALISTA, tercera versión. La curva no se leía como flecha; la
              maciza se leía, pero pesaba más que el texto al que acompaña — y
              esto es un rótulo, no un cartel. Una punta abierta de dos trazos
              sobre una línea fina dice lo mismo con la mitad de tinta.
              Se queda RECTA: señala UN lugar, no un camino. */}
          <svg
            className="mk-flecha-señala"
            width="72"
            height="14"
            viewBox="0 0 72 14"
            fill="none"
            aria-hidden="true"
            style={{ opacity: .55 }}
          >
            <path
              d="M70 7H4M4 7L11 1M4 7L11 13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>
            Elige tu foto
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
            Con esa cara se filma el escenario.
          </div>
        </div>
      );

      return {
        // 620 = las dos cajas (300 cada una) más los 20 de aire del medio.
        ancho: CAJA * 2 + 20,
        // ⚠️ LLEGÓ PREGUNTÁNDOSE SI LA IA LO COPIÓ BIEN, y la pantalla tiene
        // que contestar ESO y no volver a pedir una aprobación genérica. Es la
        // misma pantalla, con la pregunta cambiada por la que trajo.
        pregunta: explicandoParecido
          ? '¿Se parece a tu foto?'
          : sinEscenas
          ? 'Buscando dónde se filma'
          // ⚠️ «¿Apruebas tu avatar?» y no «¿Dónde se filma?». El lugar ya está
          // escrito abajo, en el subtítulo; lo que la pantalla PIDE es aprobar la
          // cara con la que se va a filmar. El título nombra la decisión, no el
          // dato — un título que describe el contenido deja la pregunta muda.
          // ⚠️ EL MISMO CON IMAGEN Y SIN ELLA. Estaba puesto sólo en una de las
          // dos ramas, así que apenas salía la imagen el título cambiaba a
          // «¿Sirve esta imagen?» — y el dueño ya lo había pedido una vez. La
          // pregunta de esta pantalla es la misma antes y después de generar.
          : '¿Apruebas tu avatar?',
        titulo: explicandoParecido
          // El texto que pidió el dueño: cómo se generan, que la IA sigue SUS
          // fotos, y qué mirar. Va acá —debajo del título y encima de las dos
          // cajas— porque lo que tiene que hacer es dirigir la mirada a la
          // comparación que ya está abajo, no ocupar su lugar.
          ? 'MaKo generó la imagen de la derecha a partir de tu foto de la izquierda. Míralas juntas: si la cara no es la tuya, el video tampoco lo va a ser. Regenera la imagen, o prueba con otra foto tuya.'
          : escena?.lugar,
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
                  // ⚠️ SIEMPRE ABIERTA. Esto era `fotos.length > 0`, o sea que la
                  // única puerta al modal se CERRABA con cero fotos — justo el
                  // estado en el que hay que subir una. `FotoGrande` con
                  // `puedeCambiar` en false devuelve los hijos pelados: sin hover,
                  // sin ícono y sin click. La pantalla quedaba en un ícono gris de
                  // perfil sin nada que tocar.
                  //
                  // Y el modal ya sabe subir —tiene su propio input y la baldosa de
                  // subir va primera—, así que abrirlo sin fotos no muestra una
                  // lista vacía: muestra la forma de empezar.
                  puedeCambiar
                  onAbrir={() => setEligiendoFoto(true)}
                >
                  <Vertical ancho={`${CAJA}px`}>
                    {fotoElegida
                      ? <Foto src={fotoElegida} alt="Tu foto" />
                      : (
                        // Sin foto, el hueco DICE qué hacer. Un ícono de perfil gris
                        // y nada más se lee como «acá va tu foto» pero no como «tocá
                        // acá»; el hover que lo revelaría no existe en pantallas
                        // táctiles, que es donde más pasa.
                        <div style={{ display: 'grid', gap: 8, placeItems: 'center', color: 'var(--faint)' }}>
                          <Icon name="perfil" size={44} />
                          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>Toca para subir tu foto</span>
                        </div>
                      )}
                  </Vertical>
                </FotoGrande>

              </div>
              <div>
                <Vertical ancho={`${CAJA}px`}>
                  {derecha}
                  {/* La imagen ES el control, igual que la foto de al lado: hover
                      para descubrirlo, un ícono siempre visible para que exista
                      también sin hover, y al tocarla las dos únicas salidas. */}
                  {opciones.length > 0 && !generando && (
                    <>
                      <button
                        type="button"
                        className="mk-regen__zona"
                        onClick={() => setRehacer(true)}
                        aria-label="Regenerar esta imagen"
                      >
                        <span className="mk-regen__velo">
                          <span className="mk-regen__texto">
                            <Icon name="regenerar" size={15} />
                            Regenerar
                          </span>
                        </span>
                      </button>
                    </>
                  )}

                  {rehacer && (
                    <div className="mk-regen__panel" role="dialog" aria-label="Regenerar la imagen">
                      <button
                        type="button"
                        className="mk-regen__cerrar"
                        onClick={() => setRehacer(false)}
                        aria-label="Cerrar"
                      >
                        <Icon name="x" size={15} />
                      </button>
                      {/* ⚠️ ACÁ HABÍA UNA SEGUNDA RAMA —un campo «Qué cambiarle» que le
                          pedía a MaKo reescribir la escena— y quedó INALCANZABLE al
                          mudar «Decir qué cambiar» al paso del prompt: nada volvía a
                          poner `pidiendo` en true. Se borra en vez de dejarla: una
                          rama muerta se lee como una función que existe.
                          `corregirEscenaAction` queda sin llamadores; se conserva
                          porque «que lo arregle MaKo» sigue siendo una opción
                          razonable, pero hoy no la ofrece nadie. */}
                          {/* Las variantes que ya se generaron, para volver a
                              cualquiera con un click. Van ARRIBA de los botones:
                              «ya tengo una que me servía» es más barato que
                              generar otra, así que se ofrece primero. */}
                          {opciones.length > 1 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
                              {opciones.map((u) => (
                                <button
                                  key={u}
                                  type="button"
                                  disabled={!!ocupado}
                                  onClick={() => {
                                    setRehacer(false);
                                    void correr('elegir', () => elegirImagenAction(item.id, paso.n, u), false);
                                  }}
                                  title="Usar esta"
                                  style={{
                                    width: 44, aspectRatio: '9 / 16', borderRadius: 7, overflow: 'hidden',
                                    padding: 0, cursor: 'pointer', lineHeight: 0,
                                    border: u === marca?.elegida ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,.35)',
                                  }}
                                >
                                  {/* ⚠️ Una variante vieja puede tener la
                                      dirección vencida (~6 h). Se dibuja su
                                      número en vez de una imagen rota: lo
                                      segundo se lee como que la app perdió el
                                      archivo, y no lo perdió — el `mediaId` no
                                      vence y filmar sigue funcionando. */}
                                  {urlDeFlowVencida(u) ? (
                                    <span style={{
                                      display: 'grid', placeItems: 'center', width: '100%',
                                      height: '100%', fontSize: 11, color: 'var(--faint)',
                                    }}>{opciones.indexOf(u) + 1}</span>
                                  ) : (
                                    <img src={u} alt="" style={MEDIO} />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* ⚠️ «OTRO FONDO» NO ES «REGENERAR», y ésa es toda la
                              diferencia que faltaba. Regenerar vuelve a tirar el
                              MISMO prompt: el modelo devuelve una variación de lo
                              mismo —el mismo rincón con otra luz— así que quien no
                              quiere ESE fondo puede apretarlo diez veces y seguir
                              en el mismo lugar. Martín lo pidió por su nombre:
                              «quiero hacer variaciones del fondo».

                              Acá el fondo cambia de verdad porque sale del
                              catálogo del lugar, no del azar; y va ARRIBA porque
                              es lo que la persona quiere el 90% de las veces que
                              abre este panel.

                              Sólo existe con un lugar elegido: sin catálogo no hay
                              lista de rincones de dónde sacar el siguiente, y un
                              botón que a veces contesta «primero elige el lugar» es
                              peor que no estar. */}
                          {!!lugarElegido?.fondos.length && (
                            <Button
                              variant="primary"
                              size="lg"
                              icon={<Icon name="regenerar" size={15} />}
                              onClick={() => {
                                setRehacer(false);
                                void correr('fondo', () => otroFondoAction(item.id, paso.n), false);
                              }}
                            >
                              Otro fondo
                            </Button>
                          )}
                          {/* El mismo par que abajo: uno pesa y el otro no. Y
                              «Decir qué cambiar» va DEBAJO, que es lo que dice
                              cuál de los dos es el camino. */}
                          <Button
                            // Con un lugar elegido, éste deja de ser el camino
                            // principal: es «el mismo rincón, otra toma». El que
                            // manda pasa a ser «Otro fondo», y dos botones
                            // primarios uno encima del otro no dicen cuál es cuál.
                            variant={lugarElegido?.fondos.length ? 'secondary' : 'primary'}
                            size="lg"
                            icon={<Icon name="regenerar" size={15} />}
                            onClick={() => {
                              // ⚠️ SE CIERRA ANTES DE ARRANCAR. Dejar el panel
                              // abierto sobre una imagen que ya se está rehaciendo
                              // deja dos botones apretables encima de algo que no
                              // se puede cancelar — y esconde la niebla, que es la
                              // única señal de que empezó.
                              setRehacer(false);
                              void correr('imagen', () => generarImagenAction(item.id, paso.n), false);
                            }}
                          >
                            Regenerar
                          </Button>
                          {/* ⚠️ LLEVA AL PROMPT, como en el video. Antes abría un
                              campo para DESCRIBIR el cambio y se lo mandaba a
                              MaKo para que reescribiera la escena. El dueño lo
                              igualó al del clip: «si le doy al botón de Decir
                              qué cambiar me debe mostrar el prompt, como en el
                              video».
                              Y es lo correcto por lo mismo que allá: lo que
                              gobierna esta imagen es UNA instrucción, y la
                              persona puede leerla y corregirla sin
                              intermediario — con un modelo en el medio, lo que
                              escribe se convierte en otra cosa. */}
                          <Button
                            variant="tertiary"
                            onClick={() => {
                              const e = (item.escenas ?? []).find((x) => x.n === paso.n);
                              setPromptTexto(promptFinal(e?.prompt ?? '', {
                                conCara: !!item.fotoId,
                                puestaId: item.plan.puestaId,
                                propio: item.promptsImagenPropios?.[String(paso.n)],
                              }));
                              setRehacer(false);
                              setForzado({ id: 'prompt', n: paso.n, de: 'escena' });
                            }}
                          >
                            Decir qué cambiar
                          </Button>
                          {/* ⚠️ ESTA SALIDA YA ESTABA ESCRITA Y NO LA OFRECÍA NADIE.
                              El `<input type="file">` de más abajo existe, su `subir()`
                              existe y `subirImagenEscenaAction` existe entera del lado
                              del server — pero NADA llamaba a `archivo.current.click()`,
                              así que la capacidad estaba completa y era inalcanzable.
                              Es «escribir la salida no es ofrecerla», la lección que
                              este archivo ya tiene escrita tres veces.

                              Va acá adentro y no como una cuarta salida suelta: subir la
                              propia es otra forma de ARREGLAR la imagen, igual que
                              «Otro fondo» y «Regenerar», y lo que el dueño prohibió fue
                              un botón de abandonar, no una forma más de acertar.

                              Última porque es la más rara: quien puede, prefiere que la
                              genere MaKo. */}
                          <Button
                            variant="tertiary"
                            onClick={() => { setRehacer(false); archivo.current?.click(); }}
                          >
                            Subir la mía
                          </Button>
                    </div>
                  )}
                </Vertical>

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

            {/* ⚠️ LAS VARIANTES SE MUDARON ADENTRO DEL PANEL DE «Regenerar».
                Estaban acá abajo, sueltas bajo la imagen, y el dueño las mandó
                al panel: «me gusta que se vean las variaciones… pero dentro del
                apartado de Regenerar deberían salir. No abajo».
                Y tiene la misma razón de fondo que todo lo demás de esta
                pantalla: elegir otra variante ES una forma de rehacer, así que
                vive donde viven las formas de rehacer. Sueltas abajo eran una
                cuarta salida con otro aspecto. */}

            {/* ⚠️ ACÁ HABÍA UN DESPLEGABLE «No sirve» CON CUATRO SALIDAS. Se fue
                entero, y el dueño fue explícito: «NO debe existir un botón de "No
                continuar"». Tenía razón de fondo — un par «Continuar / No sirve»
                convierte una pantalla de aprobación en una encuesta, y las cuatro
                opciones de adentro no eran salidas: eran cuatro formas distintas
                de pedir otra imagen.
                Ahora la imagen ES el control: se toca, y adentro hay DOS. */}
            <input
              ref={archivo}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => { subir(paso.n, e.target.files?.[0] ?? null); e.target.value = ''; }}
            />
          </div>
        ),
        // ⚠️ SIEMPRE «Continuar». El dueño, por segunda vez: «TODOS los botones
        // deben estar en CONTINUAR». Lo que el botón hace de más lo dice la línea
        // de abajo, no su rótulo — y un rótulo distinto por paso obliga a leerlo
        // cada vez para saber si es el mismo botón.
        // ⚠️ EL RÓTULO SALE DEL EFECTO, no de `txt.accion`. Es el mismo defecto
        // que ya se arregló en el paso de filmar —«un botón que decía "Revisar el
        // puente" y gastaba 15 créditos»— y seguía vivo en su hermano: el rótulo
        // venía del texto de la causa y el onClick hacía otra cosa. Acá el efecto
        // es uno solo y no cuesta nada: generar la imagen.
        //
        // Y con las escenas sin escribir el botón REINTENTA en vez de no existir:
        // una pantalla sin ningún botón deja como única salida abandonar el
        // anuncio, y el efecto de arriba reintentaba solo, sin tope y sin que
        // nada lo contara.
        boton: sinEscenas
          ? 'Volver a intentar'
          : txt ? 'Volver a generar la imagen' : 'Continuar',
        // Y sin «Filmar sí gasta»: es texto que nadie pidió, en una pantalla que
        // no filma. La consecuencia dice lo que cuesta APRETAR ESTE botón.
        consecuencia: textoCosto(0),
        cargandoBoton: !!ocupado || generando,
        onSiguiente: sinEscenas
          ? () => { intentosEscenas.current = 0; void correr('escenas', () => escribirEscenasAction(item.id), false); }
          : opciones.length
            ? () => void correr('confirmar', () => confirmarEscenaAction(item.id, paso.n))
            : () => void correr('imagen', () => generarImagenAction(item.id, paso.n), false),
        atras: 'Volver',
        onAtras: () => { setExplicandoParecido(false); setForzado({ id: 'guion-leer' }); },
      };
    }

    // ── 3. La cara ────────────────────────────────────────────────────────
    if (paso.id === 'cara') {
      const uno = item.video?.['1'];
      // La imagen del escenario que se confirmo: es EL CUADRO del que salio este
      // clip, asi que es lo unico contra lo que tiene sentido compararlo.
      const escena1 = (item.escenas ?? []).find((e) => 1 >= e.desde && 1 <= e.hasta);
      /** Se apretó rehacer y todavía no volvió: la pantalla ya lo muestra. */
      const filmando = ocupado === 'rehacer' || (!!uno && !uno.url && !uno.error);
      const imagenBase = escena1 ? item.imagenes?.[String(escena1.n)]?.elegida : '';
      return {
        // Misma fila de dos cajas que el escenario.
        ancho: CAJA * 2 + 20,
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
                {/* ⚠️ CON `ancho`, Y ES LO QUE FALTABA ACÁ.
                    Sin él la caja sale del ALTO en `vh` y el ancho lo deriva el
                    aspect-ratio, así que la fila mide distinto en cada ventana:
                    este paso DECLARABA 620 y dibujaba ~655, y con eso el ejemplo
                    del costado —que se ubica con el ancho declarado— terminaba
                    encima de la caja del clip. El dueño lo reportó como «te
                    volvió a pasar lo mismo con el preview».
                    La regla estaba escrita en el docstring de `Vertical` —«donde
                    hay dos, manda el ancho»— y el paso del escenario ya la
                    aplicaba. Éste, que también tiene dos cajas, se había quedado
                    afuera. */}
                <Vertical ancho={`${CAJA}px`}>
                  {imagenBase
                    ? <Foto src={imagenBase} alt="El cuadro del que sale el clip" />
                    : contexto?.fotoUrl
                      ? <Foto src={contexto.fotoUrl} alt="Tu foto" />
                      : <div style={{ color: 'var(--faint)' }}><Icon name="perfil" size={44} /></div>}
                </Vertical>
              </div>
              <div>
                <Vertical fondo="#000" ancho={`${CAJA}px`} clase="mk-clip">
                  {uno?.url && !filmando ? <Revela k={uno.url}><Clip src={uno.url} controlPropio /></Revela> : null}
                  {/* ⚠️ EL LOADER ARRANCA CON EL CLICK, no cuando contesta el
                      server. Entre apretar «Regenerar» y que la marca vuelva sin
                      `url` pasan segundos en los que la pantalla seguía mostrando
                      el clip viejo, entera y apretable. El dueño: «no carga
                      INMEDIATAMENTE el loader… en esos momentos el usuario puede
                      seguir apretando botones, no queremos bugs del estilo».
                      El estado lo tenemos desde el instante del click (`ocupado`);
                      lo que faltaba era dibujarlo. */}
                  {filmando && <Niebla etiqueta={`Filmando la toma 1`} desde={desde} />}

                  {/* ⚠️ LA ZONA ES SOLO LA FRANJA DE ABAJO, no la caja entera.
                      Sobre una imagen el control puede ocupar todo; sobre un
                      video el centro es del play. Con `inset: 0` —lo que usa la
                      imagen— tocar para reproducir abriría el panel de rehacer. */}
                  {uno?.url && !rehacerClip && (
                    <button
                      type="button"
                      className="mk-regen__zona mk-regen__zona--abajo"
                      onClick={() => setRehacerClip(true)}
                      aria-label="Rehacer este clip"
                    >
                      <span className="mk-regen__velo">
                        <span className="mk-regen__texto">
                          <Icon name="regenerar" size={15} />
                          Regenerar
                        </span>
                      </span>
                    </button>
                  )}

                  {rehacerClip && (
                    <div className="mk-regen__panel" role="dialog" aria-label="Rehacer el clip">
                      <button
                        type="button"
                        className="mk-regen__cerrar"
                        onClick={() => setRehacerClip(false)}
                        aria-label="Cerrar"
                      >
                        <Icon name="x" size={15} />
                      </button>

                      {/* Tres salidas, y son tres porque un clip puede fallar de
                          tres maneras distintas: salió mal y con otra semilla
                          sale bien, le pedimos lo que no era, o la cara no es la
                          suya. Cada una se arregla en un lugar diferente, y
                          ofrecer una sola manda a la gente a pagar clips hasta
                          acertar. */}
                      <Button
                        variant="primary"
                        size="lg"
                        icon={<Icon name="regenerar" size={15} />}
                        onClick={() => {
                          // Se cierra ANTES de arrancar: dejar el panel abierto
                          // sobre algo que ya se está rehaciendo deja botones
                          // apretables encima de lo que no se puede cancelar.
                          setRehacerClip(false);
                          // ⚠️ SE CLAVA LA PANTALLA. Descartar deja la toma 1 sin
                          // `url`, y con eso `pasoDe` deja de devolver `cara` y
                          // salta al paso de filmar — que dibuja UNA sola caja.
                          // O sea que apretar «Regenerar» hacía desaparecer la
                          // imagen de al lado, que es justamente contra lo que se
                          // está comparando. El dueño: «sacó la imagen que estaba
                          // al lado, eso no debería pasar».
                          setForzado({ id: 'cara' });
                          void correr('rehacer', async () => {
                            const d = await descartarTomaAction(item.id, 1);
                            if (!d.ok) return d;
                            return generarTomaAction(item.id, 1);
                          }, false);
                        }}
                      >
                        Regenerar
                      </Button>

                      <Button
                        variant="tertiary"
                        onClick={() => {
                          const c = item.plan.clips.find((x) => x.n === 1);
                          setPromptTexto(
                            c ? promptDeClip(item.plan.puestaId, c, item.promptsPropios?.['1'], undefined, acentoDelPlan(item.plan.clips)) : '',
                          );
                          setRehacerClip(false);
                          setForzado({ id: 'prompt', n: 1, de: 'toma' });
                        }}
                      >
                        Decir qué cambiar
                      </Button>

                      <Button
                        variant="tertiary"
                        onClick={() => {
                          setRehacerClip(false);
                          setExplicandoParecido(true);
                          setForzado({ id: 'escenario', n: escena1?.n ?? 1 });
                        }}
                      >
                        No se parece a mí
                      </Button>
                    </div>
                  )}
                </Vertical>
              </div>
            </div>
            {/* ⚠️ ACÁ HABÍA UN PLIEGUE «No se parece» con las mismas salidas.
                Se fue: desde que el clip es el control, rehacer y «no se parece»
                viven ENCIMA del video, que es donde se está mirando. Dejar las
                dos versiones da cuatro botones para tres decisiones, y el de
                abajo se lee como si hiciera otra cosa. */}
          </div>
        ),
        // ⚠️ «Siguiente», como todos. Martin: «siempre los botones de abajo debe
        // ser siguiente, no cualquier otra cosa». Lo que el boton hace de mas —y
        // cuesta— lo dice `consecuencia`, que va pegada abajo: un rotulo que
        // cambia en cada pantalla obliga a leerlo de nuevo cada vez, y el trabajo
        // de ese boton es siempre el mismo: avanzar.
        boton: 'Siguiente',
        // El botón filma la toma 2, así que el costo es el DE ELLA. Antes decía
        // el número general, que en un clip corto cobraba de más en el cartel.
        consecuencia: costoDeToma(2),
        // Cualquier trabajo en curso apaga la fila, no sólo el de este botón:
        // rehacer el clip corre desde el panel de arriba y también tiene que
        // dejar la pantalla quieta.
        cargandoBoton: !!ocupado,
        // ⚠️ AVANZA PRIMERO Y ESCRIBE DESPUÉS. El dueño: «cuando le doy a
        // Siguiente el botón se pone un pequeño scroll, que no entiendo por qué
        // es, si ya está generado incluso la próxima toma… si no ejecuta nada
        // ese botón, debería pasar inmediatamente».
        //
        // Tiene razón: las dos escrituras son de trámite —anotar que la cara ya
        // se miró, y encolar la toma 2, que si ya existe devuelve lo que hay— y
        // ninguna cambia lo que la persona va a ver a continuación. Bloquear la
        // pantalla en un ida y vuelta para eso es cobrarle la latencia a algo que
        // no la necesita.
        //
        // No es un éxito optimista: si alguna falla, el error aparece igual —
        // `correr` lo pinta— y no se perdió nada, porque la pantalla siguiente
        // sale del dato y el dato se vuelve a leer.
        onSiguiente: () => {
          setForzado({ id: 'toma', n: 2 });
          void correr('cara', async () => {
            const m = await marcarCaraVistaAction(item.id);
            if (!m.ok) return m;
            return generarTomaAction(item.id, 2);
          }, false);
        },
      };
    }

    // ── 3b. Qué le pedimos al video ───────────────────────────────────────
    //
    // Un desvío, no un paso del anuncio: se entra desde el clip y se sale
    // volviendo. Existe porque «Decir qué cambiar» sobre un video no puede ser lo
    // mismo que sobre una imagen — en la imagen MaKo reescribe la escena y vuelve
    // a generar; acá lo que gobierna el clip es UNA instrucción, y la persona
    // puede leerla y corregirla sin intermediario.
    if (paso.id === 'prompt') {
      const n = paso.n;
      const esImagen = paso.de === 'escena';
      // El original: lo que el sistema mandaría si nadie lo hubiera tocado. Sale
      // de la MISMA función que arma el pedido, así que «volver al texto de
      // MaKo» devuelve exactamente lo que se va a mandar y no una copia parecida.
      const clipDelPaso = item.plan.clips.find((c) => c.n === n);
      const escenaDelPaso = (item.escenas ?? []).find((e) => e.n === n);
      const original = esImagen
        ? promptFinal(escenaDelPaso?.prompt ?? '', {
          conCara: !!item.fotoId,
          puestaId: item.plan.puestaId,
        })
        : clipDelPaso
          ? promptDeClip(item.plan.puestaId, clipDelPaso, undefined, undefined, acentoDelPlan(item.plan.clips))
          : '';
      const cambiado = promptTexto.trim() !== original.trim();
      return {
        ancho: 620,
        pregunta: esImagen ? `¿Qué le pides al escenario ${n}?` : `¿Qué le pides a la toma ${n}?`,
        titulo: 'Esto es lo que le llega al modelo, palabra por palabra.',
        cuerpo: (
          // ⚠️ ANCHO FIJO Y NO `100%`, y el número no es de gusto: el paso declara
          // 620 y la caja de contenido del estudio mide `declarado - 60`, así que
          // un `100%` dibujaría 560 y el ejemplo del costado —que se ubica con el
          // ancho DECLARADO— quedaría a 44px en vez de a 16. Es la misma trampa
          // que hoy tiene `guion-leer`. Lo que se dibuja tiene que medir lo que
          // se declara.
          <div className="mk-prompt" style={{ width: 620, display: 'grid', gap: 12 }}>
            <Textarea
              className="mk-scroll-oscuro"
              value={promptTexto}
              onChange={(e) => setPromptTexto(e.target.value)}
              rows={13}
              aria-label={`El prompt de la toma ${n}`}
            />
            {/* Deshacer tiene que existir, o la única salida de un texto mal
                escrito es escribir otro texto encima. Aparece sólo cuando hay
                algo que deshacer. */}
            {cambiado && (
              <button
                type="button"
                onClick={() => setPromptTexto(original)}
                style={{
                  justifySelf: 'center', border: 'none', background: 'none',
                  color: 'var(--dim)', fontSize: 'var(--fs-sm)', cursor: 'pointer',
                  textDecoration: 'underline', padding: 4,
                }}
              >
                Volver al texto de MaKo
              </button>
            )}
          </div>
        ),
        // El dueño lo pidió así, y además es lo correcto: se llegó acá desde
        // «Regenerar», y el botón que cierra ese camino tiene que nombrarlo.
        boton: esImagen ? `Regenerar: Escenario ${n}` : `Regenerar: Toma ${n}`,
        // La imagen no cuesta; el clip sí. Es la única diferencia que la persona
        // tiene que ver entre los dos caminos.
        consecuencia: esImagen ? textoCosto(0) : costoDeToma(n),
        cargandoBoton: !!ocupado,
        onSiguiente: () => void correr('prompt', async () => {
          // Guardar y generar son dos escrituras y van EN ESTE ORDEN: si se
          // generara primero, saldría con el prompt viejo y el texto nuevo
          // quedaría guardado al lado, describiendo algo que no se pidió.
          if (esImagen) {
            const g = await guardarPromptEscenaAction(item.id, n, cambiado ? promptTexto : '');
            if (!g.ok) return g;
            return generarImagenAction(item.id, n);
          }
          const g = await guardarPromptTomaAction(item.id, n, cambiado ? promptTexto : '');
          if (!g.ok) return g;
          const d = await descartarTomaAction(item.id, n);
          if (!d.ok) return d;
          return generarTomaAction(item.id, n);
        }),
        atras: 'Volver',
        // Sale al paso que diga el DATO, como todo el resto: el wizard no
        // recuerda por dónde se vino.
        onAtras: () => setForzado(null),
      };
    }

    // ── 4. TODAS LAS TOMAS, EN UNA PANTALLA ───────────────────────────────
    if (paso.id === 'tomas') {
      const total = item.plan.clips.length;
      const filmadas = item.plan.clips.filter((c) => item.video?.[String(c.n)]?.url).length;
      const faltan = item.plan.clips.filter((c) => !item.video?.[String(c.n)]?.url);
      const creditos = faltan.reduce((t, c) => t + (creditosDeClip(c.segundos) ?? 15), 0);
      // ⚠️ EL GATE DE LA CARA, convertido en botón. Mientras no haya una toma
      // aprobada lo único que se ofrece es filmar la primera: nadie gasta ~90
      // créditos con una cara que todavía no miró. Aprobar y lanzar el resto es
      // la MISMA pulsación, así que la protección no cuesta un paso.
      const aprobada = !!item.caraVista && filmadas > 0;
      const primeraSinFilmar = faltan[0]?.n ?? 1;

      return {
        ancho: 480,
        pregunta: aprobada
          ? `Tus tomas (${filmadas} de ${total})`
          : filmadas > 0 ? '¿Apruebas este clip?' : 'Filmemos la primera',
        titulo: aprobada || filmadas === 0
          ? undefined
          : 'Si la cara es la tuya, con una pulsación se filman todas las demás.',
        cuerpo: (
          <PasoTomas
            item={item}
            sel={Math.min(tomaSel, total)}
            onSel={setTomaSel}
            ocupado={ocupado}
            correr={(e, fn, av) => void correr(e, fn, av)}
            onEditarPrompt={(n) => {
              const c = item.plan.clips.find((x) => x.n === n);
              setPromptTexto(c ? promptDeClip(item.plan.puestaId, c, item.promptsPropios?.[String(n)], undefined, acentoDelPlan(item.plan.clips)) : '');
              setForzado({ id: 'prompt', n, de: 'toma' });
            }}
            onNoSeParece={(n) => {
              const e = (item.escenas ?? []).find((x) => n >= x.desde && n <= x.hasta);
              setExplicandoParecido(true);
              setForzado({ id: 'escenario', n: e?.n ?? 1 });
            }}
            /**
             * ⚠️ CADA CAUSA YA DECLARABA SU ACCIÓN, Y NADIE LA CABLEABA.
             *
             * `textoFlow` devuelve `accion` para las nueve causas desde que existe, y
             * la pantalla de la toma dibujaba el título y el detalle y ningún botón.
             * Martín, viendo el rechazo del filtro de caras: «si sale esto, ofrece ahí
             * mismo solucionarlo, cambiando la imagen».
             *
             * El mapa es explícito y no un `default`: una causa sin arreglo devuelve
             * `null` y no se dibuja nada, que es lo correcto cuando lo que arregla vive
             * en otra pieza (el puente tiene su propio aviso, con su propio botón).
             */
            arreglo={(causa, n) => {
              // El escenario que cubre ESTA toma. Es el mismo cálculo que
              // `onNoSeParece`, y el que `olvidarTomasFallidas` usa del otro lado para
              // que el rechazo no sobreviva a su propia cura.
              const escenaDe = () => (item.escenas ?? []).find((x) => n >= x.desde && n <= x.hasta)?.n ?? 1;

              // ⚠️ EL FILTRO DE CARAS NO SE ARREGLA REFILMANDO. El clip se anima desde
              // la IMAGEN del escenario —no desde la foto—, así que volver a filmar le
              // manda a Google exactamente la misma cara que ya rechazó y cobra otro
              // clip por el mismo resultado. Lo que cambia lo que Google mira es una
              // imagen nueva, y esa es GRATIS.
              if (causa === 'persona_publica') {
                // ⚠️ SI LA MISMA IMAGEN YA FILMÓ, NO SE MANDA A REHACERLA.
                //
                // Medido el 02/09/2026: 11 tomas, UNA imagen de escenario, las 1 a 9
                // filmadas y las 10 y 11 rechazadas 17 veces. Esa imagen está probada
                // nueve veces; mandarla a rehacerla es mandarla a arreglar lo único
                // que ya funciona. Lo que cambia entre una toma que pasa y una que no
                // es lo que DICE.
                const probada = item.video?.[String(n)]?.imagenProbada ?? 0;
                if (probada >= 1) {
                  return {
                    gratis: true,
                    etiqueta: accionFiltroDeCara(probada),
                    hacer: () => {
                      const c = item.plan.clips.find((x) => x.n === n);
                      setPromptTexto(c ? promptDeClip(item.plan.puestaId, c, item.promptsPropios?.[String(n)], undefined, acentoDelPlan(item.plan.clips)) : '');
                      setForzado({ id: 'prompt', n, de: 'toma' });
                    },
                  };
                }
                return {
                  gratis: true,
                  etiqueta: accionFiltroDeCara(0),
                  hacer: () => {
                    const e = escenaDe();
                    // Se navega ANTES de esperar: la generación tarda, y el resultado
                    // aparece en la pantalla del escenario —con su niebla, sus
                    // variantes y el botón de otro fondo—. Quedarse acá mirando un
                    // botón quieto se lee como colgado.
                    setForzado({ id: 'escenario', n: e });
                    void correr('imagen', () => generarImagenAction(item.id, e), false);
                  },
                };
              }

              // El filtro de CONTENIDO sí es el texto: lo que destraba es leer el
              // prompt y corregirlo, que es adonde lleva este botón.
              if (causa === 'contenido') {
                return {
                  gratis: true,
                  hacer: () => {
                    const c = item.plan.clips.find((x) => x.n === n);
                    setPromptTexto(c ? promptDeClip(item.plan.puestaId, c, item.promptsPropios?.[String(n)], undefined, acentoDelPlan(item.plan.clips)) : '');
                    setForzado({ id: 'prompt', n, de: 'toma' });
                  },
                };
              }

              // Sin créditos: no hay nada que apretar acá, se recarga en Google. El
              // texto ya lleva su link, así que un botón sería una segunda puerta al
              // mismo lugar.
              if (causa === 'sin_creditos' || causa === 'puente') return null;

              // Lo que queda —un bache nuestro, la sesión, el ritmo, lo desconocido—
              // se arregla volviendo a filmar. Y eso CUESTA, así que el botón lo dice
              // con el número antes del click.
              return { gratis: false, hacer: () => void correr(`toma-${n}`, () => generarTomaAction(item.id, n), false) };
            }}
            acciones={{
              generar: (n) => generarTomaAction(item.id, n),
              descartar: (n) => descartarTomaAction(item.id, n),
              recuperar: (n) => restaurarTomaAction(item.id, n),
              editar: (orden) => editarClipsAction(item.id, orden),
              escribirVoz: (n, voz) => escribirVozTomaAction(item.id, n, voz),
            }}
          />
        ),
        boton: filmadas === 0
          ? `Filmar la toma ${primeraSinFilmar}`
          : !aprobada
            ? `Sí, filmar las ${faltan.length} que faltan`
            : faltan.length
              ? `Filmar las ${faltan.length} que faltan`
              : 'Ver el anuncio entero',
        // ⚠️ Y SI NO ALCANZA, SE DICE ACÁ — pegado al botón y antes del clic, que
        // es donde la regla de la casa manda poner la consecuencia de lo
        // irreversible. Un anuncio que se corta en la toma cinco por falta de
        // créditos no dejó cinco quintos de anuncio: dejó cinco clips PAGADOS y
        // nada que publicar.
        //
        // `null` no es «no alcanza»: es «no se sabe», y ahí no se dice nada.
        // Inventarle una advertencia a alguien que sí tiene saldo es el error con
        // el signo cambiado, y se paga peor.
        consecuencia: filmadas === 0
          ? textoCosto(creditosDeClip(item.plan.clips[0]?.segundos ?? 8) ?? 15, { nota: notaSaldo(saldo, creditosDeClip(item.plan.clips[0]?.segundos ?? 8) ?? 15) })
          : faltan.length ? textoCosto(creditos, { nota: notaSaldo(saldo, creditos) }) : textoCosto(0),
        cargandoBoton: !!ocupado,
        onSiguiente: () => {
          if (!faltan.length) { setForzado({ id: 'listo' }); return; }
          if (filmadas === 0) {
            void correr(`filmar-${primeraSinFilmar}`, () => generarTomaAction(item.id, primeraSinFilmar), false);
            return;
          }
          // Aprobar y lanzar TODO lo que falta. Se encolan de a una y en orden:
          // la cola del puente toma de a cinco, así que mandar siete de golpe no
          // las acelera y sí complica saber cuál falló.
          void correr('todas', async () => {
            if (!item.caraVista) {
              const m = await marcarCaraVistaAction(item.id);
              if (!m.ok) return m;
            }
            let ultimo: { ok: boolean; item?: PlanGuardado; error?: string } = { ok: true, item };
            for (const c of faltan) {
              ultimo = await generarTomaAction(item.id, c.n);
              if (!ultimo.ok) return ultimo;
            }
            return ultimo;
          }, false);
        },
        atras: 'Volver',
        onAtras: () => setForzado({ id: 'escenario', n: (item.escenas ?? []).slice(-1)[0]?.n ?? 1 }),
      };
    }

    // ── 4b. Filmar UNA toma (legado) ──────────────────────────────────────
    // ⚠️ `pasoDe` ya no devuelve `toma`: quedó sólo como destino de los «Volver»
    // que apuntan ahí. Se conserva en vez de borrarse porque `clave()` lo mapea a
    // `tomas` y el wizard nunca lo pinta — borrarlo ahora sería tocar 400 líneas
    // en el mismo commit que estrena la pantalla nueva.

    if (paso.id === 'toma') {
      const n = paso.n;
      const anterior = item.plan.clips.slice(0, n - 1).reverse().find((c) => item.video?.[String(c.n)]?.url);
      const vAnterior = anterior ? item.video?.[String(anterior.n)] : undefined;
      // ⚠️ «EN CURSO» ES QUE HAYA UN TRABAJO, NO QUE EXISTA LA MARCA.
      //
      // Con «existe la marca y no tiene url ni error», una marca que sólo guarda
      // clips descartados —lo que deja `descartarTomaAction` desde que archiva en
      // vez de borrar— se leería como «Filmando la toma N», con su cronómetro,
      // para siempre. Y el sondeo saldría a preguntar por un clip que nadie está
      // esperando.
      const marcaToma = item.video?.[String(n)];
      const enCurso = !!marcaToma
        && !!(marcaToma.trabajoId || marcaToma.operacion)
        && !marcaToma.url && !marcaToma.error;
      /** Clips de esta toma que se descartaron para rehacerla. Nunca se pierden. */
      const descartadas = marcaToma?.descartadas ?? [];
      const fallo = item.video?.[String(n)]?.error;
      const escena = (item.escenas ?? []).find((e) => n >= e.desde && n <= e.hasta);
      const imagen = escena ? item.imagenes?.[String(escena.n)]?.elegida : '';

      const causa: CausaFlow | undefined = fallo
        ? ((item.video?.[String(n)]?.errorCausa as CausaFlow) ?? causaFlow(fallo))
        : undefined;
      // Con la frase del server, igual que las otras dos pantallas: es la que dice
      // CUAL de los dos filtros de cara contesto, y sin ella sale la generica.
      const txt = causa
        ? textoFlow(causa, `la toma ${n}`, item.video?.[String(n)]?.errorAt, undefined, item.video?.[String(n)]?.errorDetalle)
        : null;
      /** Google rechazó la CARA: refilmar con la misma foto da lo mismo. */
      const caraRechazada = causa === 'persona_publica';

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
      // ⚠️ EL TEXTO DEL SERVER, QUE SE CALCULABA Y SE PISABA CON EL GENÉRICO.
      //
      // `ciego.error` lo escribió quien vio el error CRUDO de Google, así que
      // nombra la causa real —la sesión venció, el puente está dormido, Google
      // limita el ritmo— y dice qué apretar. La pantalla lo tenía guardado en la
      // base y dibujaba en su lugar «no pude leer el estado», que no lleva a
      // ningún lado.
      //
      // El parámetro ya existía y su doc dice, textual, que GANA sobre la
      // constante. Simplemente no se lo pasaba nadie.
      const txtCiego = ciego ? textoFlow('ciego', `la toma ${n}`, ciego.desde, undefined, ciego.error) : null;

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
        ancho: CAJA_TOMA,
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
        // ⚠️ MIENTRAS EL LOADER CORRE, LA PANTALLA DICE QUE ESTÁ FILMANDO Y
        // NADA MÁS. El dueño: «el mensaje ese que aparece debajo NO debería
        // aparecer si sigue en loader… el usuario entiende que se está
        // generando. Mensajes solo cuando es error y no se pudo generar».
        //
        // Y es más verdadero así: `ciego` NO es un fallo — es «Google lo aceptó
        // y no podemos leer cómo va». Un rechazo escribe `error`, que sí cambia
        // el título. Anunciar «MaKo no puede leer cómo va» sobre un clip que
        // probablemente esté llegando bien asusta por algo nuestro.
        //
        // La salida no se pierde: el detalle y «volver a filmar» siguen en el
        // pliegue de abajo, que es un pliegue y no un mensaje.
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
              <Vertical fondo="#000" ancho={`${CAJA_TOMA}px`}>{dentro}</Vertical>
            </div>
            {/* ⚠️ La estimación NO se muestra cuando ya sabemos que se pasó. Un
                «suele tardar entre 1 y 3 minutos» al lado de un cronómetro en 4:51
                no es un dato optimista: es la pantalla afirmando que todo va
                normal cuando el servidor ya sabe que no. */}
            {enCurso && (
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                Suele tardar entre 1 y 3 minutos.
              </div>
            )}

            {/* ⚠️ EL PORQUÉ. NO SE DIBUJABA, Y ES TODO LO QUE ESTA PANTALLA
                TENÍA PARA DECIR.
                `txt` sale de `textoFlow(causa, …)` con su título, su detalle y su
                acción; de los tres, la pantalla usaba SÓLO el título —en
                `pregunta`— y tiraba el resto. O sea que el paso más caro del
                recorrido mostraba «La toma 1 no salió» y NADA más: ni qué pasó,
                ni de quién fue la culpa, ni qué hacer al respecto.
                El dueño lo reportó dos veces, y las dos con la misma frase: «no
                hace nada, ni un mensaje de error». Era literal — el mensaje
                existía, estaba clasificado y guardado en la base, y no llegaba al
                DOM. Es «escribir la salida no es ofrecerla», en el mismo archivo
                donde ya está escrita esa lección dos veces. */}
            {txt && !enCurso && (
              <div style={{
                textAlign: 'center', marginTop: 14,
                fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5,
              }}>
                {txt.detalle}
              </div>
            )}
            {txtCiego && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                {/* ⚠️ ACÁ IBA EL PÁRRAFO DE `ciego`, Y SE FUE. El dueño: «el
                    mensaje ese que aparece debajo NO debería aparecer si sigue en
                    loader… mensajes solo cuando es error y no se pudo generar».
                    Lo que queda es el pliegue, que es un pliegue y no un mensaje:
                    quien quiera saber por qué lo abre, y el que sólo está
                    esperando ve un loader y un «suele tardar 1 a 3 minutos». */}

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
                        <pre className="mk-scroll-y" style={{
                          margin: '0 0 14px', textAlign: 'left', whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto',
                          padding: '10px 12px', borderRadius: 'var(--r-sm)',
                          background: 'var(--surface-2)', border: '1px solid var(--border)',
                          fontSize: 'var(--fs-meta)', color: 'var(--dim)',
                          fontFamily: "'Geist Mono', monospace", lineHeight: 1.45,
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
                        {`Volver a filmar la toma ${n} · ${creditosDeToma(n)}`}
                      </Button>
                    </div>
                  </Salidas>
                </div>
              </div>
            )}

            {/* ⚠️ LA VUELTA AL CLIP DESCARTADO. Sin esto, archivarlo sería la
                misma pérdida con un rastro en la base: «escribir la salida no es
                ofrecerla», que este módulo ya pagó tres veces.
                Va plegado porque es la excepción —quien descarta casi siempre
                quiere el nuevo—, y el resumen dice qué hay adentro sin abrirlo. */}
            {!enCurso && !txt && !marcaToma?.url && descartadas.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <Salidas resumen={`Volver al clip que descartaste · Costo: 0 créditos`}>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={ocupado === 'restaurar'}
                    disabled={!!ocupado}
                    onClick={() => void correr('restaurar', () => restaurarTomaAction(item.id, n), false)}
                  >
                    {`Recuperar la toma ${n}`}
                  </Button>
                </Salidas>
              </div>
            )}

            {/* El pliegue DESAPARECE mientras se filma: ofrecer rehacer la
                anterior con la siguiente ya pagada encima deja el anuncio
                incoherente, y cuenta dos cosas a la vez. */}
            {!enCurso && anterior && !txt && (
              <Salidas resumen={`Rehacer la toma ${anterior.n} · ${creditosDeToma(anterior.n)}`}>
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
        // ⚠️ Y CUANDO REFILMAR NO PUEDE FUNCIONAR, EL BOTÓN LLEVA A LO QUE SÍ.
        //
        // El filtro de personas públicas de Google no rechaza el prompt: rechaza
        // LA CARA. Medido dos veces seguidas sobre la misma toma —dos
        // operaciones distintas, el mismo `PROMINENT_PERSON`— así que ofrecer
        // «Volver a filmar» ahí es ofrecer un botón que ya sabemos que falla, y
        // encima anunciando que cuesta 15 créditos.
        //
        // Es la misma regla que ya rige los mensajes de error de esta app: si hay
        // algo que hacer, el botón tiene que ser ESO. Acá lo único que puede
        // cambiar el resultado es la foto, y la foto se elige dos pasos atrás.
        //
        // ⚠️ Y DECÍA «ELEGIR OTRA FOTO», QUE ERA LA MITAD EQUIVOCADA DE LA CURA.
        //
        // El clip se anima desde la IMAGEN DEL ESCENARIO, no desde la foto del
        // perfil (`elegidaId`, en `generarTomaAction`). Cambiar la foto y volver
        // a filmar le manda a Google la misma cara que ya rechazó. Lo que cambia
        // lo que Google mira es una imagen de escenario nueva — y no cuesta
        // créditos.
        //
        // Además el botón NAVEGABA y nada más: dejaba a la persona en el paso del
        // escenario, donde apretar Continuar la traía de vuelta a este mismo
        // error. Dos pantallas correctas por separado y un bucle entre las dos.
        // Ahora el botón hace lo que promete: manda a generar la imagen y lleva
        // ahí a mirarla.
        boton: enCurso
          ? undefined
          : caraRechazada
            ? 'Volver a generar el escenario'
            : txt ? `Volver a filmar la toma ${n}` : 'Siguiente',
        // El costo SIEMPRE con su número, cero incluido. Generar el escenario no
        // gasta; decir «~15 créditos» sobre un botón que no cobra es mentir al
        // revés, y no decir nada obliga a adivinar.
        consecuencia: enCurso ? undefined : caraRechazada ? textoCosto(0) : costoDeToma(n),
        cargandoBoton: !!ocupado,
        onSiguiente: enCurso
          ? undefined
          : caraRechazada
            ? () => {
                // La escena de ESTA toma, no `escenas[0]`: con siete tomas en
                // tres escenas, la primera es la de otro lugar.
                const e = escena ?? (item.escenas ?? [])[0];
                if (!e) return;
                setForzado({ id: 'escenario', n: e.n });
                void correr('rehacer-escena', () => generarImagenAction(item.id, e.n), false);
              }
            : () => void correr('filmar', () => generarTomaAction(item.id, n), false),
        atras: 'Atrás',
        // ⚠️ AL ESCENARIO DE ESTA TOMA, no al ÚLTIMO de la lista. Con siete
        // tomas repartidas en tres escenarios, «Atrás» desde la toma 2 llevaba
        // al escenario 3 —un lugar que esa toma no usa—, y si ahí se tocaba una
        // variante, `elegirImagenAction` dejaba `confirmada: false` en una
        // escena que nadie quería tocar, reabriendo un paso ya cerrado.
        onAtras: () => setForzado({ id: 'escenario', n: (escena ?? (item.escenas ?? [])[0])?.n ?? 1 }),
      };
    }

    // ── 5. Listo ──────────────────────────────────────────────────────────
    const clips = item.plan.clips.map((c) => item.video?.[String(c.n)]?.url).filter(Boolean) as string[];
    return {
      pregunta: 'Tu anuncio, entero',
      cuerpo: (
        <div style={{ display: 'grid', gap: 26, justifyItems: 'center', width: '100%' }}>
          {/* ⚠️ EL MONTAJE VA ARRIBA, y las tomas sueltas abajo.
              El entregable es el anuncio montado: lo de arriba es lo que la
              persona vino a buscar y lo de abajo es material. Al reves, lo
              primero que se ve son siete clips con aire muerto, que es
              exactamente el «video con cara de IA» que el montaje viene a
              evitar. */}
          <PasoMontaje
            planId={item.id}
            titulo={item.plan.titulo}
            clips={clips}
            segundosPorToma={item.plan.clips.map((c) => c.segundos)}
          />
          <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <div style={{
              textAlign: 'center', marginBottom: 12,
              fontSize: 'var(--fs-sm)', color: 'var(--faint)',
            }}>
              Las tomas por separado
            </div>
            <Encadenado clips={clips} titulo={item.plan.titulo} />
          </div>
        </div>
      ),
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
      ancho={p.ancho}
    >
      {p.cuerpo}
    </Estudio>
  );
}

/** El anuncio de corrido: las tomas encadenadas, sin tocar nada. */
/**
 * Baja un archivo con el NOMBRE que le queremos poner.
 *
 * ⚠️ Hace falta el `fetch` + blob: el atributo `download` de un `<a>` se IGNORA
 * cuando el archivo es de otro origen, y los clips viven en el storage de
 * Supabase. Sin esto el navegador guarda `toma-1-<uuid>.mp4` —el nombre de la
 * ruta— y el atributo no da error: simplemente no hace nada.
 *
 * Comprobado antes de escribirlo: el bucket contesta
 * `access-control-allow-origin: *`, así que el fetch desde la página funciona.
 * Un blob es del propio origen, y ahí el nombre sí manda.
 */
async function bajarComo(url: string, nombre: string): Promise<void> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`no se pudo bajar (${r.status})`);
  const blob = await r.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // ⚠️ Se revoca TARDE, no en la línea siguiente: revocar el blob antes de que el
  // navegador termine de escribirlo cancela la descarga, y el síntoma es un
  // archivo de 0 bytes o directamente ninguno.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

function Encadenado({ clips, titulo }: { clips: string[]; titulo: string }) {
  const [i, setI] = useState(0);
  const [bajando, setBajando] = useState('');
  const [falla, setFalla] = useState('');
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { ref.current?.play().catch(() => {}); }, [i]);
  if (!clips.length) return null;

  const ir = (k: number) => setI(Math.min(clips.length - 1, Math.max(0, k)));

  const bajarUna = async (k: number) => {
    setFalla('');
    setBajando(`una-${k}`);
    try {
      await bajarComo(clips[k], nombreDeClip(titulo, k + 1, clips.length));
    } catch (e) {
      setFalla(e instanceof Error ? e.message : 'No se pudo bajar esa toma.');
    } finally {
      setBajando('');
    }
  };

  const bajarTodas = async () => {
    setFalla('');
    setBajando('todas');
    try {
      // De a una y en orden. No en paralelo: siete descargas simultáneas contra
      // el mismo host es la forma de que alguna vuelva cortada, y además el
      // navegador las numera en el orden en que llegan.
      for (let k = 0; k < clips.length; k++) {
        await bajarComo(clips[k], nombreDeClip(titulo, k + 1, clips.length));
      }
    } catch (e) {
      setFalla(e instanceof Error ? e.message : 'No se pudieron bajar todas.');
    } finally {
      setBajando('');
    }
  };

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

      {/* ⚠️ LA CINTA AHORA SE PUEDE TOCAR, y antes decía en un comentario que no
          —«3 px no es un target y elegir entre siete sería una segunda decisión
          en una pantalla que tiene una»—. Era cierto mientras esta pantalla solo
          servía para MIRAR el anuncio de corrido. Dejó de serlo: el dueño baja
          los clips uno por uno, así que llegar a una toma concreta pasó a ser la
          tarea principal. Y por eso además crece a 8 px: un target que hay que
          acertar no puede medir 3.
          Cuando cambia lo que la pantalla sirve, la regla de la pantalla cambia
          con ella — el comentario viejo describía bien OTRA pantalla. */}
      <div style={{ display: 'flex', gap: 4, marginTop: 12, width: '70%' }}>
        {clips.map((u, k) => (
          <button
            key={u}
            type="button"
            onClick={() => ir(k)}
            aria-label={`Ver la toma ${k + 1}`}
            aria-current={k === i}
            style={{
              flex: 1, height: 8, borderRadius: 4, border: 'none', padding: 0,
              cursor: 'pointer',
              background: k === i ? 'var(--primary)' : 'var(--border-strong)',
            }}
          />
        ))}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 12, marginTop: 12,
      }}>
        <Button size="sm" variant="tertiary" disabled={i === 0} onClick={() => ir(i - 1)}>
          Anterior
        </Button>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', minWidth: 108, textAlign: 'center' }}>
          Toma {i + 1} de {clips.length}
        </span>
        <Button size="sm" variant="tertiary" disabled={i === clips.length - 1} onClick={() => ir(i + 1)}>
          Siguiente
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button
          size="sm"
          variant="secondary"
          loading={bajando === `una-${i}`}
          disabled={!!bajando}
          icon={<Icon name="descargar" size={15} />}
          onClick={() => void bajarUna(i)}
        >
          {`Descargar la toma ${i + 1}`}
        </Button>
        <Button
          size="sm"
          variant="mako"
          loading={bajando === 'todas'}
          disabled={!!bajando}
          icon={<Icon name="descargar" size={15} />}
          onClick={() => void bajarTodas()}
        >
          {`Descargar las ${clips.length}`}
        </Button>
      </div>

      {/* Se avisa UNA vez y antes de que pase: Chrome pregunta si permite bajar
          varios archivos, y una descarga que se frena sin explicación se lee como
          que el botón no anda. */}
      <div style={{ marginTop: 8, fontSize: 'var(--fs-meta)', color: 'var(--faint)', textAlign: 'center' }}>
        Al bajar todas, el navegador te va a pedir permiso una vez.
      </div>

      {falla && (
        <div style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--bad)' }}>{falla}</div>
      )}
    </div>
  );
}
