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
import { Button, Select } from '@/app/_ui';
import { Icon } from '../_components/icons';
import { ACENTOS_ES, MULETILLAS, ETIQUETA_ACENTO, ZONA_DEL_ACENTO, acentoDeZona, type AcentoId } from '@/lib/acento-workspace';
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
 * Un paso de la instalación, con su estado real al lado.
 *
 * El número y el tilde salen de lo MEDIDO —la extensión se detecta por el DOM, la
 * conexión por el latido del puente—, nunca de haber apretado el botón. Un paso
 * que se marca solo por haber hecho clic miente en cuanto la instalación falla.
 */
function PasoInstalar({ n, titulo, detalle, hecho, accion }: {
  n: number;
  titulo: string;
  detalle: string;
  hecho: boolean;
  accion?: { texto: string; onClick: () => void };
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left',
      padding: '14px 16px', borderRadius: 'var(--r-md)',
      background: hecho ? 'var(--mako-bg)' : 'var(--surface-2)',
      border: `1px solid ${hecho ? 'var(--mako-border)' : 'var(--border)'}`,
    }}>
      <span style={{
        flex: 'none', width: 26, height: 26, borderRadius: 999,
        display: 'grid', placeItems: 'center',
        background: hecho ? 'var(--mako)' : 'var(--surface)',
        border: `1px solid ${hecho ? 'var(--mako)' : 'var(--border-strong)'}`,
        color: hecho ? '#1a1a1a' : 'var(--dim)',
        fontSize: 12.5, fontWeight: 700,
      }}>
        {hecho ? <Icon name="check" size={13} /> : n}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{titulo}</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{detalle}</div>
      </div>
      {!hecho && !!accion && (
        <Button variant="secondary" onClick={accion.onClick} icon={<Icon name="descargar" size={14} />}>
          {accion.texto}
        </Button>
      )}
    </div>
  );
}

/** El ancho de la tarjeta grande, y el paso entre dos tarjetas. */
const W = 300, H = 400, SALTO = 240;

/**
 * El mazo de fotos: una grande al centro y las vecinas asomando a los costados.
 *
 * ⚠️ SIN FOTOS TAMBIÉN SE DIBUJA, con tres marcos vacíos y el gesto de subir en
 * el del medio. El dueño: «en caso de no tener fotos, tiene que aparecer el
 * placeholder y en la principal un mensaje para agregar foto». La forma de la
 * pantalla no puede depender de si ya hay datos: si el vacío es una caja distinta,
 * subir la primera foto reacomoda todo y la persona no reconoce dónde está.
 */
function Carrusel({ fotos, idx, subiendo, onIr, onAbrir, onSubir }: {
  fotos: { id: string; url: string }[];
  idx: number;
  subiendo: boolean;
  onIr: (i: number) => void;
  onAbrir: () => void;
  onSubir: (fs: FileList | null) => Promise<void>;
}) {
  const vacio = fotos.length === 0;
  // Con fotos, una tarjeta por foto. Sin fotos, tres marcos: el del medio es el
  // que sube y los de los costados dicen que van a entrar más.
  const cartas = vacio ? [-1, 0, 1] : fotos.map((_, i) => i - idx);

  return (
    <div style={{
      position: 'relative', width: '100%', height: H + 24,
      overflow: 'hidden',
    }}>
      {cartas.map((d, j) => {
        const centro = d === 0;
        const foto = vacio ? undefined : fotos[j];
        const marco: React.CSSProperties = {
          position: 'absolute', top: 12, left: '50%',
          width: W, height: H, flex: 'none', padding: 0,
          borderRadius: 18,
          // El recorrido entero vive acá: cambiar `idx` cambia `d`, y con eso
          // sólo se mueve un transform.
          transform: `translateX(calc(-50% + ${d * SALTO}px)) scale(${centro ? 1 : 0.8})`,
          opacity: Math.abs(d) >= 2 ? 0 : centro ? 1 : 0.5,
          filter: centro ? 'none' : 'brightness(.75)',
          pointerEvents: Math.abs(d) >= 2 ? 'none' : 'auto',
          zIndex: centro ? 2 : 1,
          overflow: 'hidden',
          transition: 'transform 380ms cubic-bezier(.22,.61,.36,1), opacity 380ms ease, filter 380ms ease',
        };

        // ── Sin fotos: marcos punteados, y el del medio sube ──────────────
        if (vacio) {
          const hueco = {
            ...marco,
            border: '1px dashed var(--border-strong)',
            background: 'var(--surface-2)',
          };
          if (!centro) return <div key={d} aria-hidden style={hueco} />;
          return (
            <label
              key={d}
              style={{
                ...hueco,
                display: 'grid', placeItems: 'center', gap: 10, cursor: 'pointer',
                color: 'var(--dim)', textAlign: 'center', padding: 24,
              }}
            >
              <Icon name={subiendo ? 'regenerar' : 'perfil'} size={44} />
              <span style={{ fontSize: 'var(--fs-card)', fontWeight: 600, color: 'var(--ink)' }}>
                {subiendo ? 'Subiendo…' : 'Agrega tu primera foto'}
              </span>
              <span style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.45 }}>
                Sin ella cada toma sale con una cara distinta.
              </span>
              <input type="file" accept="image/*" multiple disabled={subiendo}
                onChange={(e) => void onSubir(e.target.files)} style={{ display: 'none' }} />
            </label>
          );
        }

        // ── Con fotos ─────────────────────────────────────────────────────
        if (!foto) return null;
        return (
          <div
            key={foto.id}
            style={{
              ...marco,
              boxShadow: centro ? '0 18px 50px rgba(0,0,0,.45)' : 'none',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto.url} alt="" style={{
              width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center',
              display: 'block',
            }} />
            {/* La del centro ABRE; las de al lado se traen al centro. Un solo
                gesto por tarjeta, y el de la central lleva el velo que ya usa la
                generación para decir que se puede editar. */}
            {centro ? (
              <button
                type="button"
                className="mk-regen__zona"
                onClick={onAbrir}
                aria-label="Cambiar tus fotos"
              >
                <span className="mk-regen__velo">
                  <span className="mk-regen__texto">
                    <Icon name="pen" size={15} />
                    Cambiar tus fotos
                  </span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onIr(j)}
                aria-label={`Ver la foto ${j + 1}`}
                style={{
                  position: 'absolute', inset: 0, padding: 0, border: 'none',
                  background: 'none', cursor: 'pointer',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * El orden del desplegable: el del catálogo, que va por región.
 *
 * ⚠️ No se lista a mano. La lista escrita acá se quedó vieja el día que el
 * catálogo pasó de siete variedades a treinta y dos: una opción que existe y no
 * está en este array simplemente NO SE PUEDE ELEGIR, sin error y sin síntoma.
 */
const ORDEN = Object.keys(ACENTOS_ES) as AcentoId[];

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
  acentoOrigen, acentoZona, alSalir,
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
  /** Salir del wizard sin recargar: el guard del server devolvería lo mismo. */
  alSalir: () => void;
}) {
  // ⚠️ EL PRIMERO DE `PASOS`, NO UNO ESCRITO A MANO.
  //
  // Estaba clavado en 'cara', que era el primero cuando se escribió. Al mover el
  // puente al arranque el recorrido siguió abriendo en la segunda pantalla, con
  // un «Atrás» a un paso que nadie había visto — y nada falla: `cara` sigue
  // existiendo, así que ni el compilador ni un test dicen una palabra.
  const [paso, setPaso] = useState<Paso>(PASOS[0]);
  const [error, setError] = useState<string | null>(null);
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
  /** Lo que se está escribiendo en el campo de agregar muletillas. */
  const [nuevaMuletilla, setNuevaMuletilla] = useState('');

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
      const deOtra = (m: string) =>
        !MULETILLAS[acento].includes(m)
        && ORDEN.some((id) => id !== acento && MULETILLAS[id].includes(m));
      const validas = antes.filter((m) => !deOtra(m));
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

  useEffect(() => {
    let vivo = true;
    void fetch('/api/onboarding/voz')
      .then((r) => r.json())
      .then((j: { ok: boolean; muestras?: { id: string; nombre: string }[]; clon?: { voiceId: string; nombre: string } | null }) => {
        if (!vivo || !j.ok) return;
        setMuestras(j.muestras ?? []);
        setClon(j.clon ?? null);
      })
      .catch(() => { /* sin esto el paso arranca vacío, que es un estado válido */ });
    return () => { vivo = false; };
  }, []);

  const subirVoz = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setSubiendoVoz(true); setError(null);
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
        { ok: boolean; error?: string; muestras?: { id: string; nombre: string }[] };
      if (!j.ok) { setError(j.error || 'No se pudo guardar la grabación.'); return; }
      setMuestras(j.muestras ?? []);
    } catch { setError('No se pudo procesar la grabación. Prueba subiendo un archivo.'); }
    finally { setSubiendoVoz(false); }
  }, []);

  const clonar = useCallback(async () => {
    setClonando(true); setError(null);
    try {
      const j = (await (await fetch('/api/onboarding/voz', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'clonar', autorizo: true }),
      })).json()) as { ok: boolean; error?: string; clon?: { voiceId: string; nombre: string } | null };
      if (!j.ok) { setError(j.error || 'No se pudo clonar la voz.'); return; }
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
      ? await guardarAcentoAction(acento)
      : paso === 'muletillas'
        ? await guardarMuletillasAction(muletillas)
        : await marcarPasoVideoAction(CLAVE_DE_PASO[paso as keyof typeof CLAVE_DE_PASO]);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setPaso(PASOS[idx + 1]);
  }, [paso, idx, acento, muletillas, loQueFalta]);

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
          <Select
            ariaLabel="Cómo hablas"
            value={acento}
            onChange={(v) => setAcento(v as AcentoId)}
            options={ORDEN.map((id) => ({
              value: id,
              label: `${ETIQUETA_ACENTO[id]} · ${ZONA_DEL_ACENTO[id]}`,
            }))}
            width="100%"
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
          {muletillas.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {muletillas.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMuletillas((a) => a.filter((x) => x !== m))}
                  aria-label={`Sacar ${m}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '9px 13px 9px 16px', borderRadius: 999, cursor: 'pointer',
                    font: 'inherit', fontSize: 14.5, fontWeight: 600,
                    background: 'var(--mako-bg)', border: '1px solid var(--mako-border)',
                    color: 'var(--ink)',
                  }}
                >
                  {m}
                  <Icon name="x" size={12} />
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', textAlign: 'center' }}>
              Todavía no agregaste ninguna. Si hablas limpio, deja el paso así.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignSelf: 'center', width: '100%', maxWidth: 420 }}>
            <input
              value={nuevaMuletilla}
              onChange={(e) => setNuevaMuletilla(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarMuletilla(nuevaMuletilla); } }}
              placeholder="Escribe una tuya…"
              aria-label="Agregar una muletilla"
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--ink)', font: 'inherit', fontSize: 14.5,
              }}
            />
            <Button
              variant="secondary"
              onClick={() => agregarMuletilla(nuevaMuletilla)}
              disabled={!nuevaMuletilla.trim()}
            >
              Agregar
            </Button>
          </div>

          {/* Las de tu variedad que todavía no marcaste. Es un atajo para
              reconocerse, no un cuestionario: la gente se describe mal a sí misma
              y se reconoce al instante. */}
          {MULETILLAS[acento].some((m) => !muletillas.includes(m)) && (
            <div style={{ display: 'grid', gap: 9, justifyItems: 'center' }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>
                Típicas de {ETIQUETA_ACENTO[acento].toLowerCase()}:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
                {MULETILLAS[acento].filter((m) => !muletillas.includes(m)).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => agregarMuletilla(m)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                      font: 'inherit', fontSize: 13.5, fontWeight: 600,
                      background: 'transparent', border: '1px dashed var(--border-strong)',
                      color: 'var(--dim)',
                    }}
                  >
                    <span aria-hidden>+</span>{m}
                  </button>
                ))}
              </div>
            </div>
          )}
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
          {!clon && (
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
              <div style={{
                display: 'grid', gap: 14, textAlign: 'left', width: '100%',
                padding: '18px 20px', borderRadius: 'var(--r-md)',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)' }}>
                  Habla como si le estuvieras vendiendo a alguien
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6 }}>
                  Habla <strong>90 segundos</strong> de lo que haces y a quién ayudas, con la energía
                  con la que se lo contarías a un cliente — y termina pidiendo algo:
                  «escríbeme», «descarga esto». No leas de corrido ni charles tranquilo:
                  el clon sale como el material que le des.
                </div>
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
          <div style={{ display: "grid", gap: 10, width: "100%" }}>
            <PasoInstalar
              n={1}
              titulo="Descarga la extensión e instálala en tu navegador"
              detalle="Es la que produce los videos, con tu propia cuenta de Google Flow."
              hecho={!!instalada}
              accion={instalada ? undefined : {
                texto: "Descargar",
                onClick: () => { window.location.href = "/extension/instalar"; },
              }}
            />
            <PasoInstalar
              n={2}
              titulo="Abre Google Flow desde el ícono de MaKo"
              detalle="Arriba a la derecha del navegador. Déjala abierta mientras se filma."
              hecho={est.anda}
            />
          </div>
          {/* ⚠️ EL AVISO REAL, NO UNO PROPIO. Acá había una caja escrita a mano que
              pintaba `est.txt` y, si el puente no andaba, un link a instalar la
              extensión. Eso convirtió este paso en un callejón para el único estado
              que no se arregla instalando nada:

              · con `marcada` decía «Google pausó tu sesión de Flow» y ofrecía
                «Ver cómo instalarla», o sea mandaba a instalar una extensión que la
                persona ya tiene y que estaba latiendo;
              · y el botón que SÍ resuelve —«Ya lo hice, volver a habilitar»— vive en
                `AvisoPuente`, que esta pantalla no dibujaba.

              El popup de la extensión manda a apretar ese botón por su nombre. Un
              paso que nombra un botón que su propia pantalla no tiene es peor que no
              decir nada: la persona busca hasta que se cansa. Pasó, y así se
              reportó: «no encuentro el Ya lo hice».

              `AvisoPuente` ya tiene las cuatro ramas —navegador incompatible, falta
              la extensión, sesión marcada con su botón, y el puntero al ícono— y es
              el mismo que ve la tab. Una cosa, un lugar. */}
          {/* ⚠️ UN AVISO A LA VEZ, del más bloqueante al menos, y `AvisoPuente`
              SÓLO cuando el puente no anda — es la misma condición que ya tienen
              los otros dos consumidores (`VideoGeneratorApp` y `WizardAnuncio`).
              Sin ella, su última rama es un puntero al ícono de la extensión que
              se dibujaría también con todo funcionando, diciendo «Listo» al lado
              de la caja que ya lo dice. */}
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
              Puedes seguir mientras se instala. La vas a necesitar recién al filmar tu
              primer anuncio.
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
