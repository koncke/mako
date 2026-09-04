'use client';

// =============================================================================
// OnboardingVideoGen — las 3 etapas de la tab (Contexto → Conectar → Ensayo)
// =============================================================================
// Molde: `OnboardingCarousels`. `WizardShell` embebido, estado en `app_settings`
// vía lib/tab-onboarding-state.ts con keys `vg_*`.
//
// ── El orden, y por qué no es el de la etiqueta ─────────────────────────────
//
// La regla de la skill dice: lo aburrido AL FINAL, excepto lo que bloquea. Acá
// lo aburrido es el navegador con Flow —instalar una extensión y emparejarla— y
// bloquea de verdad: sin puente no se genera NADA, ni siquiera las imágenes, que
// son gratis.
//
// Pero bloquea SÓLO al último paso. Así que va anteúltimo: los tres primeros
// —la cara, el acento, las muletillas— se hacen sin él y son los que deciden si
// el anuncio se parece a la persona. Alguien que abandona después del tercero se
// va con la tab configurada en lo que importa; alguien a quien le pedimos la
// extensión primero se va antes de ver para qué servía.
//
// ── Ningún paso pide REDACTAR ──────────────────────────────────────────────
//
// La cara se sube, el acento se elige de siete y las muletillas se marcan de una
// lista. Es el principio de baja fricción de la skill, y acá tiene un motivo
// medido encima: el repo ya se equivocó pidiendo una lista de muletillas y
// repartiéndolas por densidad, y el cliente lo marcó al instante.

import { useCallback, useEffect, useRef, useState } from 'react';
// ⚠️ `Estudio` y no `WizardShell`: es el lenguaje de pantalla de toda la tab,
// exportado a propósito para esto. El wizard de formulario encerraba el
// contenido en una tarjeta y le ponía un kicker arriba.
import { Estudio } from './WizardAnuncio';
import { ModalFotos } from './ElegirFoto';
import { textoEleven, type FalloEleven } from '@/lib/elevenlabs-fallo';
import ServicioConfigForm from '@/app/integraciones/ServicioConfigForm';
import { Button, Select } from '@/app/_ui';
import { Icon } from '../_components/icons';
import { ACENTOS_ES, MULETILLAS, ETIQUETA_ACENTO, ZONA_DEL_ACENTO, REGIONES, acentoDeZona, muletillasQueSobreviven, type AcentoId } from '@/lib/acento-workspace';
import type { Puente } from '@/lib/flow-cola';
import { estadoDelPuente, AvisoPuente } from './puente-avisos';
import { estadoPuenteAction } from './puente-actions';
import { useExtensionInstalada, AvisoExtensionVieja } from './extension-instalada';
import { useVoiceRecorder, VoiceRecorderBar } from '@/app/whatsapp/_shared/VoiceRecorder';
import {
  marcarPasoVideoAction, guardarAcentoAction, guardarMuletillasAction,
  escucharMiVozAction, type PasoVideoGen,
} from './onboarding-actions';

/**
 * ⚠️ LA EXTENSIÓN VA PRIMERO, y eso contradice a la skill `tab-onboarding`.
 *
 * Esa skill dice, en mayúsculas, que «conectar APIs, escanear QR y pegar tokens
 * va AL FINAL» porque es lo que más gente pierde. Y trae su propia excepción:
 * «lo que BLOQUEA de verdad al resto del recorrido va antes».
 *
 * Acá el puente es exactamente eso. Sin él no se filma NADA —ni siquiera las
 * imágenes, que son gratis— así que el último paso del recorrido, el ensayo, no
 * puede ni empezar; y la extensión hay que bajarla, instalarla y conectarla, o
 * sea que es lo único que tiene un tiempo de espera propio. Pedirla primero deja
 * que se instale mientras la persona contesta lo demás.
 *
 * Lo decidió el dueño, textual: «el primer paso del onboarding debe ser instalar
 * la extensión». Queda escrito para que nadie lo «arregle» leyendo la skill.
 */
const PASOS = ['puente', 'cara', 'acento', 'muletillas', 'voz', 'ensayo'] as const;
type Paso = (typeof PASOS)[number];

// ⚠️ ACÁ HABÍA DOS MAPAS COPIADOS A MANO —el rótulo y la zona de cada acento—
// «para no importar del server». No hacía falta: `lib/acento-workspace.ts` no
// tiene `server-only` a propósito, justamente para que la pantalla lo use. Las
// copias ya se habían quedado viejas: decían siete variedades cuando el catálogo
// pasó a treinta y dos, y un `Record` incompleto es lo único que hizo ruido.
// Es «una cosa, un lugar»: si hay que copiar la misma tabla en dos archivos, el
// segundo se queda viejo.
/**
 * Grabar la voz acá mismo.
 *
 * Envuelve el grabador del inbox de WhatsApp —`useVoiceRecorder` + la barra con
 * waveform— sin copiarle nada: es el mismo gesto y tiene que verse igual. Lo
 * único propio es el estado de reposo, que acá es un botón grande y allá es un
 * ícono en la barra de escribir.
 */
function GrabadorVoz({ onListo, ocupado }: {
  onListo: (blob: Blob, secs: number) => Promise<void>;
  ocupado: boolean;
}) {
  const [fallo, setFallo] = useState('');
  const rec = useVoiceRecorder(onListo, setFallo);

  if (rec.recording) {
    return (
      <div style={{ alignSelf: 'center' }}>
        <VoiceRecorderBar
          paused={rec.paused}
          secs={rec.secs}
          sending={ocupado}
          onCancel={() => rec.stop(true)}
          onTogglePause={() => (rec.paused ? rec.resume() : rec.pause())}
          onSend={() => rec.stop(false)}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 9, justifyItems: 'center' }}>
      <Button
        variant="mako"
        size="lg"
        loading={ocupado}
        disabled={ocupado}
        icon={<Icon name="mic" size={16} />}
        onClick={() => { setFallo(''); void rec.start(); }}
      >
        {ocupado ? 'Guardando…' : 'Grabar mi voz'}
      </Button>
      {/* El fallo del micrófono se dice ACÁ, pegado al botón que lo pidió: es
          del navegador de la persona y no de MaKo, así que mandarlo al aviso
          general de la pantalla lo haría parecer nuestro. */}
      {!!fallo && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--bad)', textAlign: 'center' }}>{fallo}</div>
      )}
    </div>
  );
}

/**
 * Las regiones del catálogo, repartidas en tres columnas para el desplegable.
 *
 * El reparto busca que ninguna columna sea mucho más larga que las otras: si una
 * mide el doble, el menú vuelve a tener el alto de una lista.
 */
const COLUMNAS_ACENTO = [
  ['México', 'Sin marca de país'],
  ['Centroamérica y el Caribe', 'España'],
  ['Sudamérica'],
].map((titulos) => titulos.map((t) => {
  const r = REGIONES.find((x) => x.titulo === t);
  return {
    title: t,
    options: (r?.acentos ?? []).map((id) => ({
      value: id,
      label: ETIQUETA_ACENTO[id],
      sub: ZONA_DEL_ACENTO[id],
    })),
  };
}));

/** El ancho de la tarjeta grande, y el paso entre dos tarjetas. */
const W = 300, H = 400, SALTO = 240;

/**
 * Una tarjeta del mazo, con su propio estado de carga.
 *
 * ⚠️ EL HUECO SE DIBUJA ANTES QUE LA FOTO. Las fotos vienen de URLs firmadas de
 * Supabase y tardan; sin un fondo propio, la tarjeta que todavía no cargó se veía
 * como una BANDA FINA cortada al costado de la grande — que no se lee como «está
 * cargando», se lee como un bug de layout. El dueño lo reportó así: «si no carga,
 * con el loader, no que aparezca así, como si fuera cortada».
 *
 * El marco tiene su tamaño desde el primer frame y la foto entra encima cuando
 * está lista.
 */
function CartaFoto({ url, alt }: { url: string; alt: string }) {
  const [lista, setLista] = useState(false);
  return (
    <span style={{ position: 'absolute', inset: 0, background: 'var(--surface-2)', display: 'block' }}>
      {!lista && (
        <span aria-hidden style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          color: 'var(--faint)',
        }}>
          {/* ⚠️ GIRA. Un ícono de recargar QUIETO no se lee como «cargando»: se lee
              como un error o como un hueco roto. El keyframe `spin` ya existe en
              globals.css y es el mismo que usa el botón en estado loading. */}
          <span style={{ display: 'grid', animation: 'spin .7s linear infinite' }}>
            <Icon name="regenerar" size={22} />
          </span>
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        onLoad={() => setLista(true)}
        // Una foto que no carga NO puede dejar el loader girando para siempre:
        // se muestra el marco vacío, que al menos no miente sobre el progreso.
        onError={() => setLista(true)}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center',
          display: 'block', opacity: lista ? 1 : 0, transition: 'opacity 240ms ease',
        }}
      />
    </span>
  );
}

/**
 * El mazo de fotos: una grande al centro y las vecinas asomando a los costados.
 *
 * ⚠️ ES UN BUCLE: SIEMPRE hay foto a los dos lados, en la primera y en la última.
 *
 * La versión anterior no daba la vuelta, con un argumento que sonaba bien —«que no
 * haya tarjeta a la izquierda dice que estás en la primera»—. El dueño lo rechazó:
 * «SIEMPRE debe tener una foto a ambos costados, no importa si es la primera o la
 * última. Es un bucle». Y tiene razón sobre lo que se ve: un hueco a un costado se
 * lee como que la pieza está rota, no como una posición.
 *
 * Cómo se hace sin perder el desplazamiento: la distancia al centro se calcula en
 * módulo N y se pliega al rango (-N/2, N/2], así que la vecina de la última es la
 * primera con distancia +1 y el movimiento sigue siendo un `transform` de un paso.
 * Las que dan la vuelta por el otro lado SALTAN de posición, pero pasa con
 * `opacity: 0`, o sea fuera de la vista.
 *
 * ⚠️ Y CON POCAS FOTOS SE REPITE LA LISTA. Con dos, el módulo deja un solo vecino
 * y vuelve el hueco. Se repite hasta llegar a cinco tarjetas —las que la ventana
 * puede mostrar— para que los dos costados estén siempre ocupados.
 *
 * ⚠️ SIN FOTOS TAMBIÉN SE DIBUJA, con tres marcos vacíos y el gesto de subir en el
 * del medio: si el vacío es una caja distinta, subir la primera foto reacomoda todo
 * y la persona no reconoce dónde está.
 */
function Carrusel({ fotos, idx, subiendo, onIr, onAbrir, onSubir }: {
  fotos: { id: string; url: string }[];
  idx: number;
  subiendo: boolean;
  onIr: (i: number) => void;
  onAbrir: () => void;
  onSubir: (fs: FileList | null) => Promise<void>;
}) {
  const n = fotos.length;
  const vacio = n === 0;

  /**
   * El mazo se pasa SOLO.
   *
   * Un carrusel que sólo se mueve al tocarlo no le dice a nadie que hay más fotos:
   * la única pista son unos puntos de 7 px. Moviéndose, la pieza se explica en el
   * primer segundo. El dueño: «el carrusel no se desplaza automáticamente».
   *
   * ⚠️ SE PARA CUANDO LA PERSONA ESTÁ MIRANDO. Con el mouse encima o con el foco
   * adentro no avanza: pasar de foto justo cuando alguien va a hacer clic es
   * peor que no moverse. Y `prefers-reduced-motion` lo apaga del todo — es
   * movimiento automático, exactamente lo que esa preferencia pide que no pase.
   */
  const [quieto, setQuieto] = useState(false);
  useEffect(() => {
    if (n < 2 || quieto) return;
    let reducido = false;
    try { reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* sin matchMedia, se mueve */ }
    if (reducido) return;
    const t = setInterval(() => onIr((idx + 1) % n), 3800);
    return () => clearInterval(t);
    // `idx` entra a propósito: cada paso reinicia el reloj, así que tocar una
    // foto no deja el siguiente salto a medio camino.
  }, [n, quieto, idx, onIr]);

  // La lista repetida hasta que la ventana de cinco tenga con qué llenarse.
  const anillo: { foto: { id: string; url: string }; real: number; clave: string }[] = [];
  if (n > 0) {
    const copias = Math.max(1, Math.ceil(5 / n));
    for (let c = 0; c < copias; c++) {
      for (let j = 0; j < n; j++) anillo.push({ foto: fotos[j], real: j, clave: `${fotos[j].id}#${c}` });
    }
  }
  const N = anillo.length;

  /** La distancia al centro, plegada para que el anillo cierre por los dos lados. */
  const distancia = (i: number) => {
    const bruta = ((i - idx) % N + N) % N;
    return bruta > N / 2 ? bruta - N : bruta;
  };

  // Sin fotos: tres marcos, y el del medio sube.
  const huecos = [-1, 0, 1];

  return (
    <div
      onMouseEnter={() => setQuieto(true)}
      onMouseLeave={() => setQuieto(false)}
      onFocusCapture={() => setQuieto(true)}
      onBlurCapture={() => setQuieto(false)}
      style={{ position: 'relative', width: '100%', height: H + 24, overflow: 'hidden' }}
    >
      {vacio
        ? huecos.map((d) => {
            const centro = d === 0;
            const marco: React.CSSProperties = {
              position: 'absolute', top: 12, left: '50%',
              width: W, height: H, flex: 'none', padding: 0, borderRadius: 18,
              transform: `translateX(calc(-50% + ${d * SALTO}px)) scale(${centro ? 1 : 0.8})`,
              opacity: centro ? 1 : 0.5,
              border: '1px dashed var(--border-strong)',
              background: 'var(--surface-2)',
              zIndex: centro ? 2 : 1,
            };
            if (!centro) return <div key={d} aria-hidden style={marco} />;
            return (
              <label
                key={d}
                style={{
                  ...marco,
                  display: 'grid', placeItems: 'center', gap: 10, cursor: 'pointer',
                  color: 'var(--dim)', textAlign: 'center', padding: 24,
                }}
              >
                <Icon name={subiendo ? 'regenerar' : 'perfil'} size={44} />
                <span style={{ fontSize: 'var(--fs-card)', fontWeight: 600, color: 'var(--ink)' }}>
                  {subiendo ? 'Subiendo…' : 'Agrega tu primera foto'}
                </span>
                <input type="file" accept="image/*" multiple disabled={subiendo}
                  onChange={(e) => void onSubir(e.target.files)} style={{ display: 'none' }} />
              </label>
            );
          })
        : anillo.map((c, i) => {
            const d = distancia(i);
            const centro = d === 0;
            const lejos = Math.abs(d) >= 2;
            const marco: React.CSSProperties = {
              position: 'absolute', top: 12, left: '50%', right: 'auto', bottom: 'auto',
              width: W, height: H, flex: 'none', padding: 0, borderRadius: 18,
              border: 'none', overflow: 'hidden',
              transform: `translateX(calc(-50% + ${d * SALTO}px)) scale(${centro ? 1 : 0.8})`,
              opacity: lejos ? 0 : centro ? 1 : 0.5,
              filter: centro ? 'none' : 'brightness(.75)',
              pointerEvents: lejos ? 'none' : 'auto',
              zIndex: centro ? 2 : 1,
              background: 'transparent',
              boxShadow: centro ? '0 18px 50px rgba(0,0,0,.45)' : 'none',
              cursor: 'pointer',
              transition: 'transform 380ms cubic-bezier(.22,.61,.36,1), opacity 380ms ease, filter 380ms ease',
            };
            return (
              <button
                key={c.clave}
                type="button"
                // ⚠️ LA CLASE ES LO QUE DISPARA EL VELO. La regla vive en ui.css como
                // `.mk-regen__zona:hover .mk-regen__velo`; al reescribir la tarjeta se
                // perdió la clase y el velo quedó en el DOM sin nadie que lo
                // encendiera — o sea el gesto que el dueño pidió, mudo. No lo dijo el
                // compilador: lo dijo la captura con el mouse encima.
                className={centro ? 'mk-regen__zona' : undefined}
                style={marco}
                aria-label={centro ? 'Cambiar tus fotos' : `Ver la foto ${c.real + 1}`}
                onClick={() => (centro ? onAbrir() : onIr(c.real))}
              >
                <CartaFoto url={c.foto.url} alt="" />
                {/* El velo de «se puede editar» sólo en la del centro, con las
                    mismas clases que ya usa la generación. */}
                {centro && (
                  <span className="mk-regen__velo">
                    <span className="mk-regen__texto">
                      <Icon name="pen" size={15} />
                      Cambiar tus fotos
                    </span>
                  </span>
                )}
              </button>
            );
          })}
    </div>
  );
}


/**
 * Qué paso del catálogo cierra cada pantalla.
 *
 * ⚠️ ES UN MAPA COMPLETO Y NO UN TERNARIO, y la diferencia es un bug que el
 * compilador ahora sí ve. Acá decía:
 *
 *     marcarPasoVideoAction(paso === 'cara' ? 'vg_cara' : 'vg_puente')
 *
 * o sea que CUALQUIER pantalla nueva que no fuera «cara» marcaba el puente como
 * hecho. No falla, no tipa mal —`vg_puente` es un valor válido— y el efecto es
 * que alguien salta el paso del navegador sin haberlo conectado nunca. Justo lo
 * que ese paso existe para impedir.
 *
 * Con el `Record` completo, agregar un paso sin decidir qué cierra no compila.
 * `ensayo` no está: lo marca aprobar el primer escenario, no este wizard.
 */
/**
 * Qué fila del catálogo cierra CADA paso. Completo, y por eso sirve para retomar.
 *
 * ⚠️ NO ES LO MISMO QUE `CLAVE_DE_PASO`, y confundirlos ya costó un bug. Aquel es
 * el subconjunto que ESTE wizard marca con `marcarPasoVideoAction`; tres pasos los
 * cierran otras actions (el acento y las muletillas los marcan sus propias
 * `guardarXAction`, y el ensayo lo cierra aprobar el primer escenario).
 *
 * Para saber DÓNDE RETOMAR hacen falta los seis: con el subconjunto, un paso sin
 * clave nunca se cuenta como pendiente, así que a alguien que dejó el acento sin
 * contestar el wizard lo mandaba más adelante — saltándole justo lo que faltaba.
 */
const FILA_DE_PASO: Record<Paso, string> = {
  puente: 'vg_puente',
  cara: 'vg_cara',
  acento: 'vg_acento',
  muletillas: 'vg_muletillas',
  voz: 'vg_voz',
  ensayo: 'vg_ensayo',
};

const CLAVE_DE_PASO: Record<Exclude<Paso, 'acento' | 'muletillas' | 'ensayo'>, PasoVideoGen> = {
  cara: 'vg_cara',
  voz: 'vg_voz',
  puente: 'vg_puente',
};

/**
 * El contexto del paso, PLEGADO.
 *
 * ⚠️ ESTABA ABIERTO Y ERA LA MITAD DE CADA PANTALLA. La skill pide que el
 * contexto vaya al final y explique sin interrumpir; una caja gris de ocho
 * renglones abierta debajo de la acción interrumpe igual, sólo que abajo.
 *
 * El dueño lo rechazó sobre la captura: «quiero que sea lo más minimalista
 * posible, en EXTREMO… poco texto, en todos lados». Plegado quedan dos cosas
 * que antes se peleaban: una línea para el que sólo quiere avanzar, y el texto
 * entero para el que se pregunta por qué.
 *
 * El resumen es el eyebrow, que ya estaba escrito como pregunta.
 */
function Contexto({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <details style={{ width: '100%', textAlign: 'left' }}>
      <summary style={{
        cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center',
        gap: 7, justifyContent: 'center',
        fontSize: 'var(--fs-sm)', color: 'var(--faint)',
      }}>
        <Icon name="help" size={13} />
        {eyebrow}
      </summary>
      <div style={{
        marginTop: 12, padding: '13px 15px', borderRadius: 12,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        fontSize: 13, color: 'var(--dim)', lineHeight: 1.6,
      }}>
        {children}
      </div>
    </details>
  );
}
export function OnboardingVideoGen({
  fotos, acentoInicial, muletillasIniciales, puente: puenteInicial, linea, creditos, anunciosPosibles,
  acentoOrigen, acentoZona, hechos, alSalir,
}: {
  fotos: { id: string; url: string }[];
  /** El que el server va a usar HOY: declarado si lo hay, inferido si no. */
  acentoInicial: string;
  // ⚠️ `acentoSeguro` se fue: lo reemplaza `acentoOrigen`, que dice MÁS. Un
  // booleano colapsaba «lo deduje de tu zona horaria» con «no lo sé y elegí el
  // más común», que mandan a leer cosas distintas.
  muletillasIniciales: string[];
  puente: Puente | null;
  /** Una línea real de su guion, para el subtítulo del anuncio del aside. */
  linea: string;
  /** Créditos de Flow de su cuenta. `null` = todavía no se midieron. */
  creditos: number | null;
  /** Guiones × formatos: cuántos anuncios distintos salen de lo que ya cargó. */
  anunciosPosibles: number;
  // ⚠️ `descripcionPersona` se fue de esta pantalla. La escribe MaKo mirando las
  // fotos y estuvo un rato acá, pero el dueño la sacó: «elimina el texto
  // innecesario». La cara ya se ve — describirla al lado es contarle a alguien
  // lo que está mirando. Sigue viva en el onboarding del negocio.
  /** De dónde salió el acento. Ver el porqué en `EstadoContextoVideo`. */
  acentoOrigen: 'declarado' | 'zona-horaria' | 'default';
  acentoZona: string;
  /** Las claves de los pasos ya cerrados. Se usa para retomar, no para saltear. */
  hechos: string[];
  /** Salir del wizard sin recargar: el guard del server devolvería lo mismo. */
  alSalir: () => void;
}) {
  /**
   * Se abre donde la persona QUEDÓ, no en el primero.
   *
   * ⚠️ Estuvo clavado en el primer paso y el dueño lo reportó tres veces en una
   * sola sesión acompañando a un cliente: «otra vez te hace repetir todo el
   * onboarding cuando ya lo dejaste listo. Eso funciona muy mal».
   *
   * Y la parte que engaña: el progreso SÍ se guardaba —cada paso escribe su fila al
   * avanzar— pero nadie lo leía al abrir. Desde afuera «no se guardó» y «no se leyó»
   * se ven exactamente igual: la persona vuelve a ver la pregunta que ya contestó.
   * Por eso el reporte fue «no se guarda el borrador», que manda a mirar el lugar
   * equivocado.
   *
   * ⚠️ Es el PRIMERO PENDIENTE y no el último hecho + 1: si alguien completó el 1 y
   * el 3 y se fue, hay que devolverlo al 2 — que es lo que falta— y no al 4.
   *
   * Los opcionales cuentan como hechos para esto: `vg_voz` se puede saltar, y
   * frenar ahí a alguien que decidió no clonar su voz lo trae de vuelta al mismo
   * paso cada vez que abre la tab.
   */
  const [paso, setPaso] = useState<Paso>(() => {
    const cerrado = new Set(hechos);
    const pendiente = PASOS.find((p) => !cerrado.has(FILA_DE_PASO[p]));
    return pendiente ?? PASOS[0];
  });  const [error, setError] = useState<string | null>(null);
  /**
   * Qué ofrecer para arreglar el último error. Ver `contarFalloEleven`.
   */
  const [errorAccion, setErrorAccion] = useState<{ texto: string; onClick: () => void } | null>(null);
  const [busy, setBusy] = useState(false);

  // ── La cara ──
  const [misFotos, setMisFotos] = useState(fotos);
  const [subiendo, setSubiendo] = useState(false);
  /**
   * Cuál de sus fotos se está mirando.
   *
   * ⚠️ ANTES ERAN LAS OCHO A LA VEZ, en una grilla de miniaturas. El dueño lo
   * rechazó sobre la captura: «el input gigante en el medio, o la foto». Y ocho
   * miniaturas no son una foto: son un formulario de selección múltiple donde
   * ninguna se ve, en la pantalla cuyo trabajo es MIRAR una cara.
   */
  const [fotoIdx, setFotoIdx] = useState(0);
  /** El pop-up de configurar las fotos: elegir, agregar y sacar. */
  const [eligiendoFoto, setEligiendoFoto] = useState(false);

  // ── La voz ──
  const [acento, setAcento] = useState<AcentoId>(
    (acentoInicial in ACENTOS_ES ? acentoInicial : 'latam') as AcentoId,
  );

  /** La zona horaria del APARATO, cuando sirvió para elegir el acento. */
  const [zonaDetectada, setZonaDetectada] = useState('');
  /**
   * Si la persona TOCÓ el desplegable del acento.
   *
   * ⚠️ Es lo único que separa un dato del cliente de una medición de MI máquina. El
   * paso abre con el acento que deduce la zona horaria del navegador, así que un
   * «Siguiente» sin tocar nada guardaba la deducción como si la hubiera elegido
   * alguien. Viaja al server y se guarda con el valor; ver `acentoOrigen` en
   * `VozCliente`.
   *
   * Arranca en `true` cuando el acento ya venía DECLARADO: en ese caso no hay
   * ninguna deducción encima, y lo que se reguarda es lo que ya era del cliente.
   */
  const [acentoTocado, setAcentoTocado] = useState(acentoOrigen === 'declarado');
  /** Lo que se está escribiendo en el campo de agregar muletillas. */
  const [nuevaMuletilla, setNuevaMuletilla] = useState('');
  /** ¿El cliente tiene cargada su key de ElevenLabs? `null` = todavía no se sabe. */
  const [hayKeyEleven, setHayKeyEleven] = useState<boolean | null>(null);
  /** El formulario de la key, abierto ahí mismo en vez de mandar a otra pantalla. */
  const [conectandoEleven, setConectandoEleven] = useState(false);

  /**
   * Detectar el acento por la ubicación de la persona.
   *
   * ⚠️ POR LA ZONA HORARIA DEL NAVEGADOR, NO POR LA API DE GEOLOCALIZACIÓN.
   * Ésa abre un permiso del navegador, y pedirle a alguien que acepte rastreo
   * para adivinarle el acento cuesta muchísimo más de lo que resuelve. La zona
   * del aparato no pide nada, la contesta todo navegador, y es más fiel que la
   * del workspace: `mako.timezone` sale del calendario conectado, que puede ser
   * el de otra persona o no estar puesto.
   *
   * ⚠️ Y NO PISA UNA DECISIÓN. Si el acento ya está declarado, esto no corre:
   * una detección que reemplaza lo que alguien eligió a mano no es una ayuda,
   * es un control que no obedece. Es la regla del repo sobre `localStorage`
   * —restaurar una PREFERENCIA, nunca pisar una DECISIÓN— con otra fuente.
   */
  useEffect(() => {
    if (acentoOrigen === 'declarado') return;
    let zona = "";
    try { zona = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return; }
    const sug = acentoDeZona(zona);
    if (!sug) return;
    setAcento(sug);
    // Se muestra la ciudad, no el identificador: «America/Mexico_City» no es
    // algo que alguien reconozca como su propia ubicación.
    setZonaDetectada(zona.split('/').pop()?.replace(/_/g, ' ') ?? zona);
    // Sólo al abrir: después manda lo que la persona elija.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Sumar una muletilla, venga del campo o de las sugeridas.
   *
   * Se normaliza a minúsculas y sin espacios de sobra porque esto viaja al
   * prompt: «Pues» y «pues » serían dos entradas distintas de la misma palabra.
   */
  const agregarMuletilla = useCallback((cruda: string) => {
    const m = cruda.trim().toLocaleLowerCase('es').replace(/\s+/g, ' ');
    if (!m) return;
    setMuletillas((a) => (a.includes(m) ? a : [...a, m]));
    setNuevaMuletilla('');
  }, []);  const [muletillas, setMuletillas] = useState<string[]>(muletillasIniciales);

  /**
   * ⚠️ CAMBIAR DE ACENTO LIMPIA LAS MULETILLAS QUE YA NO EXISTEN.
   *
   * El server las filtra igual —así que nada malo llega al modelo—, pero sin
   * esto la pantalla siguiente muestra marcadas unas que no están en la lista, y
   * la persona no tiene forma de saber cuáles quedaron. Es el mismo criterio que
   * `setAcentoCliente` aplica del lado del dato: lo guardado tiene que poder
   * leerse solo.
   */
  useEffect(() => {
    setMuletillas((antes) => {
      // ⚠️ SE TIRAN LAS DE OTRA VARIEDAD, NO LAS PROPIAS.
      //
      // El filtro era `MULETILLAS[acento].includes(m)`, que era correcto mientras
      // las únicas posibles fueran las ocho sugeridas. Ahora se pueden escribir,
      // y con ese filtro cambiar de acento le borraba a la persona justo las que
      // se tomó el trabajo de tipear — en silencio, y sin forma de recuperarlas.
      //
      // Lo que hay que sacar es una sugerencia de OTRO país que quedó marcada
      // («cachai» en un guion mexicano suena a que el avatar cambió de
      // nacionalidad a mitad del anuncio). Una palabra que no es sugerencia de
      // nadie es de la persona, y se queda.
      // ⚠️ LA MISMA FUNCIÓN QUE EL SERVER, no una copia. Acá vivía la regla
      // correcta escrita a mano mientras el server tenía la equivocada — o sea
      // que la pantalla conservaba lo tipeado y el server lo tiraba al guardar,
      // que es la peor combinación posible: se ve bien y no se guarda.
      const validas = muletillasQueSobreviven(acento, antes);
      return validas.length === antes.length ? antes : validas;
    });
  }, [acento]);

  // ── La voz ──
  const [muestras, setMuestras] = useState<{ id: string; nombre: string }[]>([]);
  const [clon, setClon] = useState<{ voiceId: string; nombre: string } | null>(null);
  const [autorizo, setAutorizo] = useState(false);
  // ⚠️ Estado de progreso PROPIO, no el `busy` del pie. Con uno compartido,
  // apretar «Siguiente» pone «Clonando…» en el otro botón.
  const [subiendoVoz, setSubiendoVoz] = useState(false);
  const [clonando, setClonando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // El audio se para al desmontar: salir del wizard mientras la voz habla dejaria
  // el sonido corriendo sobre otra pantalla, sin donde pararlo.
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const escucharse = useCallback(async () => {
    if (escuchando || !linea) return;
    setEscuchando(true);
    setError(null);
    try {
      const r = await escucharMiVozAction(linea);
      if (!r.ok) { setError(r.error); return; }
      const a = new Audio(r.audio);
      audioRef.current = a;
      a.onended = () => setEscuchando(false);
      a.onerror = () => { setEscuchando(false); setError('El navegador no pudo reproducir el audio.'); };
      await a.play().catch(() => { setEscuchando(false); setError('El navegador bloqueo el audio. Toca otra vez.'); });
      return;
    } catch {
      setError('No llego respuesta al generar el audio.');
    }
    setEscuchando(false);
  }, [escuchando, linea]);

  /**
   * Volver a leer el estado de la voz.
   *
   * ⚠️ ERA UN EFECTO DE UNA SOLA VEZ, y por eso «conecté ElevenLabs y me aparece
   * todavía que lo tengo que conectar» (textual del dueño acompañando a un
   * cliente). El wizard leía `hayKey` al montarse y nada lo volvía a leer nunca:
   * la persona iba a cargar su key, volvía, y la pantalla seguía en el estado de
   * antes hasta un F5.
   *
   * Es la misma regla que el puente ya cumplía a dos pantallas de acá: el estado
   * se lee VIVO, no se recuerda.
   */
  const leerVoz = useCallback(async () => {
    try {
      const j = (await (await fetch('/api/onboarding/voz')).json()) as
        { ok: boolean; muestras?: { id: string; nombre: string }[]; clon?: { voiceId: string; nombre: string } | null; hayKey?: boolean };
      if (!j.ok) return;
      setMuestras(j.muestras ?? []);
      setClon(j.clon ?? null);
      // ⚠️ `?? null` y no `?? false`: «todavía no contestó» y «no tiene key» son
      // cosas distintas, y pintarlas igual muestra «conectá ElevenLabs» por un
      // parpadeo a alguien que sí la tiene.
      setHayKeyEleven(j.hayKey ?? null);
    } catch { /* el estado de antes sigue siendo lo mejor que se sabe */ }
  }, []);

  useEffect(() => {
    void leerVoz();
    // Al volver de otra pestaña: si fue a sacar su key a elevenlabs.io, la
    // pantalla se entera sola en vez de esperar un F5.
    const alVolver = () => { if (document.visibilityState === 'visible') void leerVoz(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [leerVoz]);

  const subirVoz = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setSubiendoVoz(true); setError(null); setErrorAccion(null);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append('file', f);
    try {
      const j = (await (await fetch('/api/onboarding/voz', { method: 'POST', body: fd })).json()) as
        { ok: boolean; error?: string; muestras?: { id: string; nombre: string }[] };
      if (!j.ok) { setError(j.error || 'No se pudieron subir los audios.'); return; }
      setMuestras(j.muestras ?? []);
    } catch { setError('No llegó respuesta al subir los audios. Vuelve a intentarlo.'); }
    finally { setSubiendoVoz(false); }
  }, []);

  /**
   * Lo que se acaba de grabar, a la biblioteca de muestras.
   *
   * ⚠️ SE CONVIERTE A MP3, Y NO ES UN LUJO. `MediaRecorder` entrega webm/opus, y
   * el server decide qué es un archivo por su EXTENSIÓN antes que por su mime
   * (`familiaDeArchivo`): `.webm` está en la familia VIDEO, así que una grabación
   * subida en crudo se rechaza con «no es un audio» — un error que culpa al
   * archivo de la persona por una decisión nuestra. Y de paso entra en el tope:
   * 90 s de opus rondan los 900 kB, los mismos en mp3 ~1,1 MB, y el POST corta en
   * 4 MB.
   *
   * El conversor es el MISMO que usa el inbox de WhatsApp. Se importa en el
   * momento porque arrastra el encoder de mp3, que no tiene por qué viajar en el
   * bundle de quien nunca va a grabar nada.
   */
  const subirGrabacion = useCallback(async (blob: Blob, secs: number) => {
    // ⚠️ El piso está medido en el propio repo: un clon hecho con poco material
    // sale plano. Se avisa ANTES de gastar la subida, no después.
    if (secs < 20) {
      setError('La grabación quedó muy corta. Necesitamos al menos 20 segundos, y con 90 sale bastante mejor.');
      return;
    }
    setSubiendoVoz(true); setError(null);
    try {
      const { blobToMp3 } = await import('@/app/whatsapp/audio');
      const mp3 = await blobToMp3(blob);
      const fd = new FormData();
      fd.append('file', new File([mp3], `grabacion-${Date.now()}.mp3`, { type: 'audio/mpeg' }));
      const j = (await (await fetch('/api/onboarding/voz', { method: 'POST', body: fd })).json()) as
        { ok: boolean; error?: string; motivo?: string; muestras?: { id: string; nombre: string }[] };
      if (!j.ok) { contarFalloEleven(j, 'No se pudo guardar la grabación.'); return; }
      setMuestras(j.muestras ?? []);
    } catch { setError('No se pudo procesar la grabación. Prueba subiendo un archivo.'); }
    finally { setSubiendoVoz(false); }
  }, []);

  /**
   * Traduce lo que contestó ElevenLabs a lo que la persona tiene que leer.
   *
   * ⚠️ `textoEleven` ESTABA ESCRITO ENTERO Y NO LO LLAMABA NADIE. Siete motivos,
   * cada uno con su título, su detalle, de quién es la culpa y si lleva link —
   * y las dos pantallas que pueden fallar hacían `setError(j.error)`, o sea que
   * pintaban la frase técnica y tiraban el `motivo` que venía al lado.
   *
   * La diferencia no es de estilo. «Unauthorized» y «tu suscripción tiene un pago
   * pendiente» son el MISMO 401 de ElevenLabs, y el catálogo existe justamente
   * porque los dos se ven iguales desde afuera. Sin él, a alguien con la factura
   * impaga se le decía que su key estaba mal.
   *
   * Es «escribir la salida no es ofrecerla», que este repo ya tiene escrita cuatro
   * veces — y la cuarta era, textual, una cura que vivía detrás de la puerta que
   * ella misma tenía que abrir.
   */
  const contarFalloEleven = useCallback((j: { error?: string; motivo?: string }, sino: string) => {
    const m = j.motivo as FalloEleven | undefined;
    if (!m) { setError(j.error || sino); setErrorAccion(null); return; }
    const t = textoEleven(m);
    setError(`${t.titulo}. ${t.detalle}`);
    // ⚠️ La acción NO usa `t.arreglaEn`: ese link lleva a /integraciones, y el
    // formulario de la key ya vive ADENTRO de este paso. Mandar a otra pantalla
    // por algo que está acá abajo es el viaje que se acaba de sacar — y encima
    // re-monta el wizard y le hace perder el paso.
    setErrorAccion(t.arreglaEn
      ? { texto: t.accion ?? 'Revisar mi cuenta de ElevenLabs', onClick: () => { setConectandoEleven(true); setError(null); setErrorAccion(null); } }
      : null);
  }, []);

  const clonar = useCallback(async () => {
    setClonando(true); setError(null); setErrorAccion(null);
    try {
      const j = (await (await fetch('/api/onboarding/voz', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'clonar', autorizo: true }),
      })).json()) as { ok: boolean; error?: string; motivo?: string; clon?: { voiceId: string; nombre: string } | null };
      if (!j.ok) { contarFalloEleven(j, 'No se pudo clonar la voz.'); return; }
      setClon(j.clon ?? null);
    } catch { setError('No llegó respuesta al clonar. Vuelve a intentarlo.'); }
    finally { setClonando(false); }
  }, []);

  // ── El puente ──
  // Si la extensión está y con qué versión. Lo mide el propio DOM (el content
  // script marca `data-mako-puente`), así que es un HECHO y no una inferencia.
  const instalada = useExtensionInstalada();

  /**
   * ⚠️ EL PUENTE ES ESTADO Y EL RELOJ ES DEL NAVEGADOR, y las dos cosas por lo
   * mismo: este paso es EXACTAMENTE donde la persona se va a otra pestaña a
   * instalar la extensión y a conectarla.
   *
   * Con el snapshot del server congelado en un prop, volver acá mostraba el
   * estado de antes de haber conectado y el paso no dejaba avanzar — sobre un
   * puente que ya estaba andando. Es la regla de la casa: el estado se lee vivo,
   * no se recuerda.
   *
   * Y el reloj arranca en `null` a propósito, igual que en `VideoGeneratorApp`:
   * decidir una rama con dos relojes distintos —el del server y el del
   * navegador— durante la hidratación es cómo se pinta «no conectado» sobre uno
   * sano por un segundo.
   */
  const [puente, setPuente] = useState(puenteInicial);
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    const mirar = () => {
      if (document.visibilityState !== 'visible') return;
      setAhora(Date.now());
      void estadoPuenteAction()
        .then((p) => { if (vivo && p) setPuente(p); })
        .catch(() => { /* el estado de antes sigue siendo lo mejor que se sabe */ });
    };
    mirar();
    // El mismo pulso que usa la tab y que late la extensión. Sólo con la
    // pestaña visible: un poll de fondo sobre una pestaña que nadie mira es
    // tráfico contra la base por una respuesta que nadie va a leer.
    const t = window.setInterval(mirar, 15000);
    document.addEventListener('visibilitychange', mirar);
    return () => {
      vivo = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', mirar);
    };
  }, []);

  const est = estadoDelPuente(puente, ahora);

  /**
   * El puente que ve el aviso de arriba, o `null`.
   *
   * El aviso sirve en los pasos que NO son del puente: ahí es la única pista de
   * que algo va a fallar al filmar. En el paso del puente es una tercera copia de
   * lo que la pantalla ya está diciendo entera — medido: «Falta la extensión de
   * MaKo · Descargar» aparecía tres veces en la misma vista.
   * ⚠️ `undefined`, NO `null`. `Estudio` lo tiene escrito al lado de su propio
   * render: `undefined` es «esta pantalla no lo pasa» y `null` es «no hay puente»,
   * que sigue siendo un dato y sigue dibujando el aviso. Con `null` el «Falta la
   * extensión · Descargar» seguía saliendo arriba, o sea que el arreglo no hacía
   * nada — y la captura fue lo único que lo dijo.
   */
  const puenteDelAviso = paso === 'puente' ? undefined : puente;

  const idx = PASOS.indexOf(paso);



  /** Sube fotos por el route handler multipart. Una server action topea en 1 MB. */
  const subir = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setSubiendo(true);
    setError(null);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append('file', f);
    try {
      const r = await fetch('/api/onboarding/persona', { method: 'POST', body: fd });
      const j = (await r.json()) as {
        ok: boolean; error?: string; fotos?: { id: string; url: string | null }[];
      };
      if (!j.ok) { setError(j.error || 'No se pudieron subir las fotos.'); return; }
      setMisFotos((j.fotos ?? []).filter((f) => !!f.url).map((f) => ({ id: f.id, url: f.url as string })));
    } catch {
      setError('No llegó respuesta al subir las fotos. Vuelve a intentarlo.');
    } finally {
      setSubiendo(false);
    }
  }, []);

  /** Vuelve a leer las fotos del server. La lista la arma ÉL, no el navegador. */
  const refrescarFotos = useCallback(async () => {
    try {
      const j = (await (await fetch('/api/onboarding/persona')).json()) as
        { ok: boolean; fotos?: { id: string; url: string | null }[] };
      if (j.ok) setMisFotos((j.fotos ?? []).filter((f) => !!f.url).map((f) => ({ id: f.id, url: f.url as string })));
    } catch { /* la lista de antes sigue siendo lo mejor que se sabe */ }
  }, []);

  const borrarFoto = useCallback(async (id: string) => {
    setError(null);
    try {
      const j = (await (await fetch(`/api/onboarding/persona?id=${encodeURIComponent(id)}`, { method: 'DELETE' })).json()) as
        { ok: boolean; error?: string; fotos?: { id: string; url: string | null }[] };
      if (!j.ok) { setError(j.error || 'No se pudo sacar la foto.'); return; }
      const quedan = (j.fotos ?? []).filter((f) => !!f.url).map((f) => ({ id: f.id, url: f.url as string }));
      setMisFotos(quedan);
      // ⚠️ El índice se acota DESPUÉS de borrar. Sin esto, sacar la última foto
      // deja el mazo apuntando a una posición que ya no existe y la pantalla se
      // queda en blanco sin decir por qué.
      setFotoIdx((i) => (quedan.length ? Math.min(i, quedan.length - 1) : 0));
    } catch {
      setError('No llegó respuesta al sacar la foto. Vuelve a intentarlo.');
    }
  }, []);

  /**
   * Lo que falta para poder avanzar, o ''.
   *
   * ⚠️ ESTO ERA UN BOTÓN DESHABILITADO Y CASI SE PIERDE EN LA MUDANZA.
   * `WizardShell` tenía `puedeAvanzar`; `Estudio` no, así que al cambiar de
   * chrome el gate se quedó sin quién lo leyera — el compilador no dice nada
   * porque una constante sin usar es legal.
   *
   * Y de paso mejora: un botón apagado no explica qué falta. Ahora el botón
   * siempre se puede tocar y, si falta algo, lo dice.
   */
  const loQueFalta =
    paso === 'cara' && misFotos.length === 0
      ? 'Sube al menos una foto tuya: sin ella cada toma sale con una cara distinta.'
      : '';
  const avanzar = useCallback(async () => {
    if (loQueFalta) { setError(loQueFalta); return; }
    setError(null);
    setBusy(true);
    const r = paso === 'acento'
      ? await guardarAcentoAction(acento, acentoTocado, zonaDetectada)
      : paso === 'muletillas'
        ? await guardarMuletillasAction(muletillas)
        : await marcarPasoVideoAction(CLAVE_DE_PASO[paso as keyof typeof CLAVE_DE_PASO]);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setPaso(PASOS[idx + 1]);
  }, [paso, idx, acento, acentoTocado, zonaDetectada, muletillas, loQueFalta]);

  const pregunta =
    paso === 'cara' ? 'Tus fotos'
      : paso === 'acento' ? 'Cómo hablas'
        : paso === 'muletillas' ? 'Tus muletillas'
        : paso === 'voz' ? 'Tu voz'
          // ⚠️ EL PASO SE LLAMA POR LA ACCIÓN, no por el concepto. «Tu navegador
          // con Flow» describe un estado del sistema y no le dice a nadie qué
          // tiene que hacer; el dueño lo leyó y preguntó si era instalar la
          // extensión. Si el título hay que adivinarlo, el título está mal.
          : paso === 'puente' ? 'Instala la extensión de MaKo'
            : 'Tu primer escenario';

  return (
    <>
      {/* ⚠️ EL MISMO LENGUAJE DE PANTALLA QUE LA GENERACIÓN, Y NO UN FORMULARIO.

          Esto usaba `WizardShell`: una tarjeta de 980 px con aside negro, kicker
          en monospace y el contenido encerrado. El dueño lo rechazó sobre la
          captura: «saca el contenedor… el diseño del form tiene que ser similar
          al de la generación, los pasos de arriba son más minimalistas».

          Y `Estudio` está EXPORTADO exactamente por esto — su propio comentario
          lo dice: «es el lenguaje de pantalla de TODA la tab, no del wizard». Ya
          hubo un paso que se quedó con el formato viejo y se migró con la misma
          frase del dueño: «se quedó con el formato de form viejo». Este era el
          último que faltaba.

          De yapa, `Estudio` trae el aviso del puente en las seis pantallas: el
          bloqueo ocurre filmando, y un problema que se muestra en un lugar y se
          cura en otro es, para el que lo mira, un problema sin cura. */}
      <Estudio
        pregunta={pregunta}
        paso={idx + 1}
        total={PASOS.length}
        boton={paso === 'ensayo' ? 'Empezar mi primer anuncio' : 'Siguiente'}
        onSiguiente={paso === 'ensayo' ? alSalir : () => void avanzar()}
        cargando={busy}
        atras={idx === 0 ? undefined : 'Atrás'}
        onAtras={idx === 0 ? undefined : () => setPaso(PASOS[idx - 1])}
        onSalir={alSalir}
        // El dueño: «no se debe poder salir sin completar el onboarding». Ver el
        // porqué —y la tensión con la skill— en el prop de `Estudio`.
        sinSalida
        error={error ?? undefined}
        errorAccion={errorAccion ?? undefined}
        puente={puenteDelAviso}
        ahora={puenteDelAviso === undefined ? undefined : ahora}
        consecuencia={paso === 'ensayo'
          ? 'Esta configuración la cierra aprobar tu primer escenario, no este botón.'
          : undefined}
        ancho={520}
      >
        {/* ⚠️ UNA SOLA COLUMNA, Y ES OBLIGATORIA.

            `Estudio` mete a sus hijos en un `display: flex` SIN dirección, o sea
            en FILA. La generación le pasa un único hijo, así que eso nunca se vio;
            acá cada paso pasa varios y los fragmentos de React no crean DOM, así
            que se aplanan y quedan de lado a lado. Medido en pantalla: la foto a la
            izquierda y el «¿Por qué la foto decide todo?» flotando a su derecha, a
            la altura del hombro.

            Se envuelve acá y no se le cambia la dirección a `Estudio`: eso le
            cambiaría el layout a las cinco pantallas de la generación para arreglar
            una que es de este archivo. */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
          // ⚠️ 28 y no 20. El dueño, mirando las cuatro pantallas: «todos esos
          // campos están muy pegados, muy agrupado todo… es feo así». Con este
          // ancho de columna, 20 px deja los bloques leyéndose como un solo
          // párrafo de controles.
          gap: 28, width: '100%',
        }}>
      {paso === 'cara' && (
        <>
          {/* ⚠️ LAS OTRAS FOTOS SE VEN A LOS COSTADOS, no apiladas detrás.

              Cuarta forma de esta pantalla. El mazo con las de atrás asomando por
              arriba no se leía: quedaba una foto sola con un borde raro. El dueño
              mandó la referencia — un rectángulo central y dos parciales a los
              lados — y es la forma correcta: se ve QUE hay más y para dónde.

              Y el hover sobre la central dice que se puede editar, con las mismas
              clases que ya usa la generación (`mk-regen__zona` / `__velo` /
              `__texto`): un velo que aparece en 160 ms con el texto abajo. No se
              estrena un gesto nuevo para lo mismo. */}
          {/* ⚠️ SE DESPLAZA. No es un cambio de src: las tarjetas se MUEVEN.

              La versión anterior reemplazaba la imagen del centro y dibujaba dos
              vecinas nuevas, así que al pasar de foto no se veía ningún recorrido —
              parpadeaba y ya. El dueño: «el carrusel tiene que funcionar, se tiene
              que ir desplazando las fotos».

              Están TODAS montadas y cada una se posiciona por su distancia al
              centro, así que animar es animar un `transform`: el navegador lo hace
              en el compositor y el recorrido se ve entero. Dibujar sólo tres
              impediría esto — la que entra no tendría de dónde venir.

              Y NO da la vuelta. Con vuelta, pasar de la última a la primera
              rebobina las ocho de un saque, que se lee como un salto y no como un
              paso. Sin vuelta, que no haya tarjeta a la izquierda dice «estás en la
              primera» sin una palabra. */}
          <Carrusel
            fotos={misFotos}
            idx={fotoIdx}
            subiendo={subiendo}
            // `setFotoIdx` es estable entre renders, así que el efecto del
            // auto-avance no se reinicia por su culpa. Una función nueva en cada
            // render dejaría el `setInterval` cancelándose antes de disparar.
            onIr={setFotoIdx}
            onAbrir={() => setEligiendoFoto(true)}
            onSubir={subir}
          />

          {/* Dónde estás parado en el mazo. Van los puntos y no un «3 de 8»: el
              número es un dato que nadie necesita, la posición sí. */}
          {misFotos.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 7 }}>
              {misFotos.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFotoIdx(i)}
                  aria-label={`Ver la foto ${i + 1}`}
                  aria-current={i === fotoIdx}
                  style={{
                    width: 7, height: 7, padding: 0, borderRadius: '50%', border: 'none',
                    cursor: 'pointer',
                    background: i === fotoIdx ? 'var(--ink)' : 'var(--border-strong)',
                    transition: 'background 160ms ease',
                  }}
                />
              ))}
            </div>
          )}

          <Contexto eyebrow="¿Por qué la foto decide todo?">
            El video se genera a partir de una imagen tuya: si no hay foto, no hay identidad y
            el avatar sale siendo otra persona. Con dos o tres alcanza — de frente, con buena
            luz y sin lentes de sol.
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              Estas mismas fotos son las del onboarding del negocio: si ya cargaste alguna ahí,
              aparece aquí y no hay nada que volver a subir.
            </div>
          </Contexto>
        </>
      )}

      {paso === 'acento' && (
        <>
          {/* ⚠️ UN DESPLEGABLE, NO UNA GRILLA DE BOTONES.

              Con siete variedades la grilla entraba. Con treinta y dos son treinta
              y dos cajas del mismo tamaño, o sea la pantalla más cargada de todo el
              recorrido justo donde la regla de la casa pide una sola cosa. El dueño:
              «esto está horrible, tiene que ser un desplegable».

              `Select` abre su propia caja de búsqueda pasadas las 8 opciones, así
              que escribir «chile» llega antes que cualquier scroll. */}
          {/* ⚠️ EN COLUMNAS Y CON `sub`, NO UNA LISTA CON SCROLL.

              Con `options` planas, 32 variedades abren un menú de scroll infinito
              y cada renglón mete dos datos en una línea («Mexicano del norte ·
              Baja California, Sonora, Sinaloa, Monterrey»). El dueño lo reportó
              sobre la captura: «una barra desplegable súper larga, todo amontonado
              en el centro».

              `Select` ya tiene las dos salidas y estaban sin usar: `columns` —que
              existe textual «para listas largas con grupos (evita el scroll
              infinito)»— y `sub`, que baja la zona a su propio renglón. Se agrupa
              por región para que buscar sea mirar el continente, no leer 32
              nombres. */}
          <Select
            ariaLabel="Cómo hablas"
            value={acento}
            // ⚠️ Tocarlo es lo que convierte la deducción de la zona horaria en un
            // dato del cliente. Ver `acentoTocado`.
            onChange={(v) => { setAcento(v as AcentoId); setAcentoTocado(true); }}
            columns={COLUMNAS_ACENTO}
            // ⚠️ Un ancho, no `100%`. El contenido de esta tab llega a ~1000 px, y
            // un control con una etiqueta de cuatro palabras estirado a todo eso es
            // una barra. Se acota y queda centrado por el `alignItems` de la
            // columna del paso.
            width={460}
            style={{ alignSelf: 'center' }}
          />

          {/* ⚠️ DE DÓNDE SALIÓ, SIEMPRE. Un acento elegido por el sistema y
              presentado sin decirlo es el que nadie corrige — y equivocarlo no se
              nota leyendo, se nota cuando alguien lo dice en voz alta con el video
              ya pagado. */}
          {!!zonaDetectada && acentoOrigen !== "declarado" && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 9, textAlign: 'left',
              fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5,
            }}>
              <Icon name="check" size={15} />
              <span>
                Lo detectamos por tu ubicación (<strong>{zonaDetectada}</strong>).
                {' '}Cámbialo si no hablas así.
              </span>
            </div>
          )}
          <Contexto eyebrow="¿Por qué te lo preguntamos?">
            {/* ⚠️ SE DICE QUE ESTABA ADIVINADO, y es lo que hace que alguien lo
                corrija. Hasta hoy el acento salía de la zona horaria y se usaba
                en silencio: quien no sabía que existía no podía arreglarlo. */}
            {/* ⚠️ ANTES ESTO AFIRMABA UNA DEDUCCIÓN QUE A VECES NO OCURRIÓ.

                Decía «lo deduje de tu zona horaria» para TODO acento no
                declarado — y `default` no es eso: es que la zona horaria no está
                en la tabla y se cayó al neutro. Medido: el ws13 tiene
                `America/Buenos_Aires`, que no figura en `POR_ZONA` (ahí está
                `America/Argentina/Buenos_Aires`), así que le contábamos una
                deducción inventada sobre su propia forma de hablar.

                Ahora el origen viaja desde el server y cada caso dice lo suyo. */}
            {acentoOrigen === 'declarado'
              ? 'Este es el que ya elegiste. Todos tus guiones se escriben así.'
              : acentoOrigen === 'zona-horaria'
                ? `Lo deduje de tu zona horaria (${acentoZona}), así que puede estar mal. Hasta ahora tus guiones se escribían en ${ETIQUETA_ACENTO[acento]} sin que nadie lo hubiera confirmado.`
                : `Todavía no lo sé: elegí ${ETIQUETA_ACENTO[acento]} porque es el más común, y tus guiones se venían escribiendo así sin que nadie lo confirmara.`}
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              Equivocarlo no se nota leyendo: el texto sale en un español correcto igual. Se nota
              cuando alguien lo dice en voz alta, con el video ya generado y pagado.
            </div>
          </Contexto>
        </>
      )}

      {paso === 'muletillas' && (
        <>
          {/* ⚠️ ES UNA LISTA QUE SE ARMA, NO OCHO BOTONES SUELTOS.

              La versión anterior mostraba las ocho sugeridas y nada más: no se podía
              agregar una propia, y una muletilla es lo más personal que hay — la que
              de verdad se te escapa casi nunca está en una lista genérica. El dueño:
              «un lugar para ir agregando… y obvio la opción de agregar nuevas que no
              estén allí».

              Arriba lo que YA es tuyo (se saca con un toque), abajo el campo para
              sumar, y al final las sugeridas de tu variedad como atajo. El orden
              importa: primero lo que hay, después cómo se agrega. */}
          {/* ⚠️ LOS CHIPS PRIMERO Y GRANDES: reconocerse es el gesto, escribir es
              la excepción. Acá había cuatro grupos y dos líneas de texto sueltas
              —«Todavía no agregaste ninguna…» y «Típicas de…»— que decían lo mismo
              que el plegable de abajo. Un rótulo sobre ocho palabras sueltas no
              agrega nada: se entienden solas. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center' }}>
            {[...muletillas, ...MULETILLAS[acento].filter((m) => !muletillas.includes(m))].map((m) => {
              const mia = muletillas.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => (mia
                    ? setMuletillas((a) => a.filter((x) => x !== m))
                    : agregarMuletilla(m))}
                  aria-pressed={mia}
                  style={{
                    padding: '12px 20px', borderRadius: 999, cursor: 'pointer',
                    font: 'inherit', fontSize: 16, fontWeight: 600,
                    background: mia ? 'var(--mako-bg)' : 'transparent',
                    border: `1px ${mia ? 'solid var(--mako-border)' : 'dashed var(--border-strong)'}`,
                    color: mia ? 'var(--ink)' : 'var(--dim)',
                    transition: 'background 160ms ease, border-color 160ms ease',
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {/* Escribir la propia es la salida para la que no está en la lista, y por
              eso va discreta: si pesa lo mismo que los chips, compite con ellos. */}
          <div style={{ display: 'flex', gap: 8, alignSelf: 'center', width: '100%', maxWidth: 380 }}>
            <input
              value={nuevaMuletilla}
              onChange={(e) => setNuevaMuletilla(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarMuletilla(nuevaMuletilla); } }}
              placeholder="¿Dices otra?"
              aria-label="Agregar una muletilla"
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--ink)', font: 'inherit', fontSize: 14,
              }}
            />
            <Button
              variant="tertiary"
              onClick={() => agregarMuletilla(nuevaMuletilla)}
              disabled={!nuevaMuletilla.trim()}
            >
              Agregar
            </Button>
          </div>
          <Contexto eyebrow="No marques ninguna si hablas limpio">
            {/* ⚠️ EL PERMISO DE NO MARCAR NADA VA PRIMERO, en el eyebrow. Sin él,
                una grilla de ocho opciones se lee como que hay que elegir — y una
                muletilla que la persona no dice es peor que ninguna. */}
            Son las palabras que se te escapan al hablar. MaKo las mete donde caen naturales, no
            en cada frase: repartirlas por cantidad es lo que hace que un guion suene falso, y ya
            nos pasó.
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              Marca solo las que de verdad dices. Si no estás seguro, deja el paso vacío y
              corrígelo cuando escuches tu primer anuncio.
            </div>
          </Contexto>
        </>
      )}

      {paso === 'voz' && (
        <>
          {/* Lo primero que se puede tocar. La explicación va abajo: nadie lee un
              párrafo antes de poder hacer algo. */}
          {/* ⚠️ ESCUCHARSE VIVÍA EN EL ASIDE, Y EL ASIDE SE FUE. Va acá, que es
              donde estaba su dueño: es la prueba de vida de ESTE paso. */}
          {clon && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 12,
              background: 'var(--surface)',
            }}>
              <Icon name="check" size={18} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14.5 }}>Tu voz está clonada</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                  Tus anuncios van a salir con tu voz, no con la de Google.
                </div>
              </div>
            </div>
          )}
          {clon && !!linea && (
            // ⚠️ LA PRUEBA DE VIDA DE ESTE PASO. Sin esto se cerraba con un tilde,
            // y un clon malo se oye en dos segundos pero no se ve en ninguna
            // pantalla: el repo tiene medido que uno hecho con material
            // conversacional sale ~30 Hz por debajo del tono real.
            <Button
              variant="mako"
              size="lg"
              loading={escuchando}
              disabled={escuchando}
              icon={<Icon name="play" size={15} />}
              onClick={() => void escucharse()}
              style={{ alignSelf: 'center' }}
            >
              Escúchate diciendo tu guion
            </Button>
          )}
          {/* ⚠️ SIN KEY NO SE PIDE UNA GRABACIÓN, SE PIDE LA KEY.

              Desde que la voz es BYOK un cliente puede no tener cuenta de
              ElevenLabs, y la pantalla le pedía NOVENTA SEGUNDOS de grabación para
              contestarle recién al subirlos que falta la key. Le hacía gastar el
              trabajo entero para darle una noticia que se sabía antes de empezar.

              El estado viene del GET, así que esto no cuesta una llamada a
              ElevenLabs: es la presencia de la fila. Y con `null` —todavía no
              contestó— no se pinta nada, porque mostrar «conectá ElevenLabs» por
              un parpadeo a alguien que sí la tiene es peor que esperar. */}
          {/* ⚠️ LA KEY SE CARGA ACÁ, SIN SALIR DE LA TAB.

              Esto era un `window.location.href` a /integraciones. El dueño, en el
              momento: «ahora tenés que volver a la app. Lo que voy a hacer es que
              no te saque de la app, que te redirija automáticamente».

              Y sacarlo de la tab no era sólo un viaje de ida y vuelta: el wizard se
              re-monta al volver, así que además perdía el paso en el que estaba.
              Dos fallas del mismo click.

              `ServicioConfigForm` ya se monta fuera de /integraciones en tres
              pantallas (ConectarIA, PanelActivacion y el onboarding global), así
              que no hay nada que inventar: es el MISMO formulario, con el mismo
              tutorial y el mismo ping. */}
          {hayKeyEleven === false && (
            <div style={{ display: 'grid', gap: 16, justifyItems: 'center', width: '100%' }}>
              {!conectandoEleven ? (
                <>
                  <div style={{
                    fontSize: 'var(--fs-card)', color: 'var(--dim)', lineHeight: 1.55,
                    textAlign: 'center', maxWidth: 460,
                  }}>
                    La voz clonada se cobra por minuto, así que corre con <strong>tu propia
                    cuenta de ElevenLabs</strong>. Se crea en dos minutos.
                  </div>
                  <Button
                    variant="mako"
                    size="lg"
                    icon={<Icon name="plug" size={16} />}
                    onClick={() => setConectandoEleven(true)}
                  >
                    Conectar ElevenLabs
                  </Button>
                </>
              ) : (
                <div style={{ width: '100%', textAlign: 'left' }}>
                  <ServicioConfigForm
                    servicioKey="elevenlabs"
                    onGuardado={() => { void leerVoz(); }}
                  />
                </div>
              )}
              {/* Que se pueda seguir sin esto es la mitad del diseño: el paso es
                  opcional y sin clon el anuncio se monta igual, con la voz que
                  genera Flow. Lo que se pierde es que suene a la persona. */}
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', textAlign: 'center', maxWidth: 420 }}>
                Puedes saltar este paso: sin clonar, tus anuncios salen con la voz que
                genera Google. Lo que se pierde es que suene a ti.
              </div>
            </div>
          )}
          {hayKeyEleven !== false && !clon && (
            <>
              {muestras.length > 0 && (
                <div style={{ display: 'grid', gap: 6, width: '100%' }}>
                  {muestras.map((m) => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left',
                      padding: '10px 13px', borderRadius: 'var(--r-md)',
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      fontSize: 13.5, color: 'var(--ink)',
                    }}>
                      <Icon name="check" size={14} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nombre}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* ⚠️ GRABAR ES LA OPCIÓN PRINCIPAL, y subir un archivo la de al lado.

                  Antes lo único que había era «Subir mi audio», sin una sola línea
                  diciendo un audio DE QUÉ: la explicación vivía plegada abajo, así
                  que la pantalla pedía un archivo que nadie sabía cómo hacer. El
                  dueño: «me pide subir un audio de qué? Si no da explicaciones… y la
                  opción PRINCIPAL debería ser grabarlo allí mismo».

                  El grabador es el MISMO del inbox de WhatsApp —hook + barra con
                  waveform, pausa y descarte—, no uno nuevo. */}
              {/* ⚠️ UNA LÍNEA, NO UNA CAJA. Acá había una tarjeta gris con título y
                  un párrafo de tres renglones: eso es exactamente lo que el plegable
                  de abajo ya dice, y puesto arriba obliga a leerlo para llegar al
                  botón. Lo que hace falta a la vista es QUÉ decir, en un renglón; el
                  porqué —que el clon sale como el material— sigue plegado. */}
              <div style={{
                fontSize: 'var(--fs-card)', color: 'var(--dim)', lineHeight: 1.5,
                textAlign: 'center',
              }}>
                90 segundos contando lo que haces, con la energía de un anuncio.
              </div>
              <GrabadorVoz onListo={subirGrabacion} ocupado={subiendoVoz} />

              {/* Subir un archivo sigue estando, y en segundo plano: el que ya tiene
                  una grabación buena no tiene por qué rehacerla.
                  ⚠️ El `accept` NO ofrece wav a propósito: 90 s a 48 kHz son ~8,6 MB
                  y Vercel corta los POST en ~4,5 MB con un 413 que ni llega al
                  handler. En mp3 los mismos 90 s pesan ~1,1 MB. */}
              <label style={{
                alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 7,
                cursor: 'pointer', color: 'var(--dim)', fontSize: 'var(--fs-sm)',
                textDecoration: 'underline', textUnderlineOffset: 3,
              }}>
                {subiendoVoz ? 'Subiendo…' : 'o sube un audio que ya tengas'}
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp4,audio/m4a,.mp3,.m4a"
                  multiple
                  disabled={subiendoVoz}
                  onChange={(e) => void subirVoz(e.target.files)}
                  style={{ display: 'none' }}
                />
              </label>
              {muestras.length > 0 && (
                <>
                  {/* ⚠️ LA AUTORIZACIÓN ES UN PASO APARTE Y BLOQUEA. Se está creando
                      una copia de la voz de una persona en la cuenta de un tercero:
                      eso no se deduce de que haya subido un archivo. El server la
                      exige otra vez —falla cerrado— porque una casilla del navegador
                      no es un permiso. */}
                  <label style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left',
                    padding: '12px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    fontSize: 13, color: 'var(--dim)', lineHeight: 1.55,
                  }}>
                    <input
                      type="checkbox"
                      checked={autorizo}
                      onChange={(e) => setAutorizo(e.target.checked)}
                      style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
                    />
                    <span>
                      Autorizo a MaKo a crear una copia de mi voz con estos audios, y confirmo
                      que la voz de las grabaciones es la mía.
                    </span>
                  </label>
                  <Button
                    variant="mako"
                    size="lg"
                    disabled={!autorizo || clonando}
                    loading={clonando}
                    icon={<Icon name="regenerar" size={15} />}
                    onClick={() => void clonar()}
                    style={{ alignSelf: 'center' }}
                  >
                    Clonar mi voz
                  </Button>
                </>
              )}
            </>
          )}

          <Contexto eyebrow="Qué grabar, y por qué no da igual">
            {/* ⚠️ ESTE COPY ES EL PARÁMETRO QUE MÁS PESA, y está medido: un clon hecho
                con material CONVERSACIONAL sale ~30 Hz por debajo del tono real y
                suena a lectura. El que gana es el de la persona en registro de
                anuncio. Pedir «un audio tuyo» produce lo primero. */}
            Grábate <strong>90 segundos hablando como en un anuncio</strong>: con energía, como
            si le estuvieras vendiendo a alguien, y termina pidiendo algo («descarga esto»,
            «escríbeme»). No leas un texto de corrido ni grabes una charla tranquila.
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              De qué depende que suene a ti: <strong>del material, no de los ajustes</strong>. Con
              una charla relajada el clon sale más grave y plano que tú, y eso ya no se
              arregla después. Con el celular en una habitación en silencio alcanza — no
              hace falta micrófono.
            </div>
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              En mp3 o m4a, hasta 4 MB por archivo. Puedes saltarte este paso: sin clonar,
              tus anuncios salen con la voz que genera Google, que funciona igual — lo que
              se pierde es que suene a ti.
            </div>
          </Contexto>
        </>
      )}

      {paso === 'puente' && (
        <>
          {/* ⚠️ ESTE PASO NO TENÍA NADA ADENTRO, y no era un olvido: delegaba todo
              en `AvisoPuente`, cuya última rama es un puntero FIJO a la esquina del
              navegador. O sea que en el estado más común —extensión instalada, Flow
              sin abrir— la pantalla quedaba con el título, un plegable y el botón, y
              el único contenido flotando fuera del flujo, arriba a la derecha. El
              dueño lo reportó así: «primero que no tiene nada dentro».

              Ahora los dos pasos reales están escritos y cada uno dice si ya está.
              El aviso sigue —es el que trae el botón de rehabilitar y las cuatro
              ramas—, pero ya no es lo único. */}
          {/* ⚠️ UN ESTADO A LA VEZ, NO UNA LISTA DE TAREAS.

              Acá había dos renglones numerados, cada uno con título, subtítulo y
              botón: ocho elementos en la pantalla que abre el recorrido. Los dos
              pasos estaban a la vez aunque el segundo no se puede hacer sin el
              primero, y los subtítulos explicaban — que es lo que va plegado.

              La pantalla tiene tres estados y cada uno es UNA cosa: el botón de
              descargar, el aviso de abrir Flow, o los créditos de tu cuenta. */}
          {!instalada && (
            <Button
              variant="mako"
              size="lg"
              icon={<Icon name="descargar" size={17} />}
              onClick={() => { window.location.href = '/extension/instalar'; }}
              style={{ alignSelf: 'center' }}
            >
              Descargar la extensión
            </Button>
          )}
          {/* ⚠️ ESTE PASO NO TRABA, Y ES EL MOTIVO POR EL QUE ESTÁ PRIMERO.

              Había una guarda que no dejaba avanzar hasta que el puente respondiera.
              Era correcta cuando este paso era el ÚLTIMO; al mudarlo al arranque
              convirtió el recorrido entero en una pantalla sola —medido: los seis
              pasos capturados dieron el mismo título seis veces— y, sin botón de
              salir, en una tab sin salida.

              El sentido de pedir la extensión primero es que se instale MIENTRAS la
              persona contesta lo demás. Una guarda acá anula justo eso. Lo que falta
              se dice, y el que decide es el ensayo, que es donde se filma. */}
          {!est.anda && (
            <div style={{
              fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, textAlign: 'center',
            }}>
              Puedes seguir mientras se instala.
            </div>
          )}

          <AvisoExtensionVieja instalada={instalada} />
          {/* ⚠️ SÓLO SI LA EXTENSIÓN YA ESTÁ. Medido en pantalla: sin esta
              condición, «Falta la extensión de MaKo · Descargar» se dibujaba TRES
              veces en la misma vista —el aviso de arriba, el paso 1 y este— porque
              los tres describen el mismo hecho. Con la extensión puesta el aviso ya
              no dice eso: dice `marcada`, y ahí trae el «Ya lo hice» que no vive en
              ninguna otra parte. Se queda por ESO, no por costumbre. */}
          {!!instalada && !est.anda && (
            <AvisoPuente puente={puente} ahora={ahora} instalada={instalada} />
          )}
          {est.anda && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 12,
              background: 'var(--surface)',
            }}>
              <Icon name="check" size={18} />
              <div style={{ textAlign: 'left' }}>
                {/* ⚠️ UN NÚMERO REAL LE GANA A UN TILDE. «Listo» no prueba nada;
                    los créditos de SU cuenta de Google sí — y ya estaban
                    cargados en la página y descartados para esta pantalla. Es la
                    misma regla del aside negro: la promesa se reemplaza por la
                    prueba en el momento en que se conecta. */}
                <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--fs-card)' }}>
                  {creditos != null ? `${creditos.toLocaleString('es-MX')} créditos` : 'Listo'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                  {creditos != null
                    ? 'Tu navegador está conectado y Google Flow responde con tu saldo.'
                    : 'Tu navegador está conectado y Google Flow responde.'}
                </div>
              </div>
            </div>
          )}
          <Contexto eyebrow="¿Por qué hace falta un navegador?">
            {/* ⚠️ ESTE PASO NO SE CIERRA CON UNA CREDENCIAL GUARDADA: se cierra
                con el puente CONTESTANDO. Es la prueba de vida que pide la
                skill, y acá no es formalidad — un puente instalado pero sin
                emparejar se ve igual de instalado y no genera nada. */}
            Los videos los genera Google Flow con tu propia cuenta, así que MaKo no puede
            pedírselos por su cuenta: necesita una extensión en tu navegador que haga el pedido
            por ti. Es lo único aburrido de toda la configuración, y es lo último.
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              {puente?.estado === 'marcada'
                ? 'Google pausó tu sesión: eso no se arregla desde aquí, así que este paso te deja seguir. Cuando hayas hecho los pasos del aviso rojo, toca su botón y vuelve.'
                : 'Este paso no avanza hasta que el navegador conteste de verdad. Guardar la extensión y que no esté conectada se ve igual desde aquí, y esa diferencia recién aparecería con el primer video sin generar.'}
            </div>
          </Contexto>
        </>
      )}

      {paso === 'ensayo' && (
        <>
          {/* ⚠️ UNA SOLA COSA, Y ES EL ÚNICO MOMENTO DEL RECORRIDO.

              Acá había cinco renglones con rótulo y valor entrando escalonados y
              después el número: once elementos de texto. La regla del producto es
              que la celebración es un DATO, y un dato es UNO — «el premio por
              terminar son tres tareas y un número, no fuegos artificiales».

              El número entra a los 450 ms y cierra a los 600 (`.mk-momento`), que
              es el único momento de los seis pasos. Y es un CONTEO, no una
              proyección: sus guiones por los formatos que existen. Cada par
              (guion × formato) es un anuncio distinto de verdad, y el copy dice
              «filmar», jamás «ganadores». */}
          <div className="mk-momento" style={{ display: 'grid', justifyItems: 'center', width: '100%' }}>
            {anunciosPosibles > 0 ? (
              <div style={{ display: 'grid', gap: 6, justifyItems: 'center', textAlign: 'center' }}>
                <div style={{
                  fontSize: 'clamp(72px, 15vw, 116px)', fontWeight: 800, lineHeight: 1,
                  letterSpacing: '-.045em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums',
                }}>{anunciosPosibles}</div>
                <div style={{ fontSize: 'var(--fs-card)', color: 'var(--dim)', lineHeight: 1.4, maxWidth: 320 }}>
                  anuncios que MaKo puede filmar con lo que ya tienes.
                </div>
              </div>
            ) : (
              // Con cero guiones el número sería 0 y la promesa se desinflaría. Lo
              // que falta ahí no es entusiasmo: es un guion, y se dice dónde se
              // escribe.
              <div style={{ display: 'grid', gap: 10, justifyItems: 'center', textAlign: 'center' }}>
                <Icon name="script" size={40} />
                <div style={{ fontSize: 'var(--fs-card)', color: 'var(--dim)', lineHeight: 1.4, maxWidth: 320 }}>
                  Te falta un guion. MaKo los escribe en Ads Writer.
                </div>
              </div>
            )}
          </div>
          <Contexto eyebrow="Qué falta para terminar">
            {/* ⚠️ EL PASO NO LO CIERRA ESTE BOTÓN: lo cierra aprobar un escenario
                de verdad. Un «listo» acá diría que la tab quedó configurada sin
                que nada lo haya probado, que es justo lo que el ensayo evita. */}
            Esta configuración queda cerrada cuando apruebes el primer escenario de tu primer
            anuncio — no con este botón. Hasta entonces la tab funciona igual y esta pantalla te
            espera con lo que ya cargaste.
          </Contexto>
        </>
      )}
        </div>
      </Estudio>

      {/* El pop-up de configurar las fotos: elegir, agregar y sacar. Es el
          mismo `ModalFotos` que ya usa la generación — con `onBorrar`, que
          allá no va. */}
      {eligiendoFoto && (
        <ModalFotos
          fotos={misFotos}
          elegida={misFotos[fotoIdx % Math.max(1, misFotos.length)]?.id ?? ''}
          onElegir={(id) => setFotoIdx(Math.max(0, misFotos.findIndex((f) => f.id === id)))}
          onSubida={() => void refrescarFotos()}
          onBorrar={(id) => void borrarFoto(id)}
          onCerrar={() => setEligiendoFoto(false)}
        />
      )}
    </>
  );
}
