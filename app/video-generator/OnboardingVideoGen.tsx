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

import { useCallback, useEffect, useState } from 'react';
import { WizardShell } from '../_components/WizardShell';
import { Button, MONO } from '@/app/_ui';
import { Icon } from '../_components/icons';
import { ACENTOS_ES, MULETILLAS, type AcentoId } from '@/lib/acento-workspace';
import type { Puente } from '@/lib/flow-cola';
import { estadoDelPuente, AvisoPuente } from './puente-avisos';
import { AnuncioEnConstruccion } from './AnuncioEnConstruccion';
import { estadoPuenteAction } from './puente-actions';
import { useExtensionInstalada, AvisoExtensionVieja } from './extension-instalada';
import {
  marcarPasoVideoAction, guardarAcentoAction, guardarMuletillasAction,
  escucharMiVozAction, type PasoVideoGen,
} from './onboarding-actions';

const PASOS = ['cara', 'acento', 'muletillas', 'voz', 'puente', 'ensayo'] as const;
type Paso = (typeof PASOS)[number];

/** Cómo se lo nombra en pantalla. Copiado del server para no importar de ahí. */
const ETIQUETA_ACENTO: Record<AcentoId, string> = {
  'mx-norte': 'Mexicano del norte',
  'mx-neutro': 'Mexicano neutro',
  'mx-cdmx': 'Mexicano de CDMX',
  co: 'Colombiano',
  ar: 'Argentino (rioplatense)',
  es: 'Español de España',
  latam: 'Latino neutro',
};

/** Un ejemplo de dónde se habla así, que es lo que ayuda a reconocerse. */
const DONDE: Record<AcentoId, string> = {
  'mx-norte': 'Baja California, Sonora, Sinaloa, Monterrey',
  'mx-neutro': 'México, sin marca regional',
  'mx-cdmx': 'Ciudad de México',
  co: 'Colombia',
  ar: 'Argentina y Uruguay',
  es: 'España',
  latam: 'Latinoamérica, sin marca de país',
};

/**
 * La primera línea con contenido de la descripción que escribió MaKo.
 *
 * El texto viene en secciones rotuladas (IDENTIDAD, ROSTRO, …) y la primera es
 * la que se lee de un vistazo. Se saltean los rótulos: son de la ficha completa,
 * que vive en el onboarding del negocio, no de esta pantalla.
 */
function primeraLinea(txt: string): string {
  for (const l of (txt || '').split(/\r?\n/)) {
    const t = l.trim();
    // Un rótulo es una línea corta EN MAYÚSCULAS. Sin este corte, la pantalla
    // grande diría «IDENTIDAD».
    if (!t || (t === t.toUpperCase() && t.length < 24)) continue;
    return t.length > 160 ? `${t.slice(0, 157)}…` : t;
  }
  return '';
}

/** La flecha de pasar fotos. Redonda, discreta: la protagonista es la foto. */
const FLECHA: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 999, flex: 'none', padding: 0,
  display: 'grid', placeItems: 'center', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)',
};

const ORDEN: AcentoId[] = ['mx-norte', 'mx-neutro', 'mx-cdmx', 'co', 'latam', 'ar', 'es'];

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
  fotos, acentoInicial, acentoSeguro, muletillasIniciales, puente: puenteInicial, linea, creditos, anunciosPosibles,
  descripcionPersona, acentoOrigen, acentoZona, alSalir,
}: {
  fotos: { id: string; url: string }[];
  /** El que el server va a usar HOY: declarado si lo hay, inferido si no. */
  acentoInicial: string;
  /** false = salió de la zona horaria. La pantalla lo dice y con eso se corrige. */
  acentoSeguro: boolean;
  muletillasIniciales: string[];
  puente: Puente | null;
  /** Una línea real de su guion, para el subtítulo del anuncio del aside. */
  linea: string;
  /** Créditos de Flow de su cuenta. `null` = todavía no se midieron. */
  creditos: number | null;
  /** Guiones × formatos: cuántos anuncios distintos salen de lo que ya cargó. */
  anunciosPosibles: number;
  /** Lo que MaKo escribió mirando sus fotos. '' = todavía no hay. */
  descripcionPersona: string;
  /** De dónde salió el acento. Ver el porqué en `EstadoContextoVideo`. */
  acentoOrigen: 'declarado' | 'zona-horaria' | 'default';
  acentoZona: string;
  /** Salir del wizard sin recargar: el guard del server devolvería lo mismo. */
  alSalir: () => void;
}) {
  const [paso, setPaso] = useState<Paso>('cara');
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

  // ── La voz ──
  const [acento, setAcento] = useState<AcentoId>(
    (acentoInicial in ACENTOS_ES ? acentoInicial : 'latam') as AcentoId,
  );
  const [muletillas, setMuletillas] = useState<string[]>(muletillasIniciales);

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
      const validas = antes.filter((m) => MULETILLAS[acento].includes(m));
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

  const idx = PASOS.indexOf(paso);

  /**
   * La ÚNICA línea de texto del aside, y sólo cuando dice algo que el cuadro no
   * muestra.
   *
   * ⚠️ Acá había cinco renglones con rótulo y valor. Un dato que ya se ve no se
   * vuelve a escribir: su cara está en el cuadro, su frase está en el cuadro. Lo
   * que queda es lo que el cuadro NO puede mostrar — que MaKo escribió esa
   * descripción mirando sus fotos, de dónde salió el acento, cuántos créditos
   * tiene.
   */
  const pieDelAside =
    paso === 'cara'
      // El dato más fuerte del recorrido, y estaba en la base sin mostrarse: la
      // descripción física que MaKo escribió mirando sus fotos. Va acá, al lado
      // de la cara que describe, y no como un párrafo gigante en el medio.
      ? (descripcionPersona ? primeraLinea(descripcionPersona) : '')
      : paso === 'acento'
        ? (acentoOrigen === 'declarado'
          ? 'Lo elegiste tú.'
          : acentoOrigen === 'zona-horaria'
            ? `Lo deduje de tu zona horaria: ${acentoZona}.`
            : 'Todavía no lo sé: este es el más común.')
        : paso === 'muletillas'
          ? (muletillas.length ? `${muletillas.length} marcadas.` : '')
          : paso === 'voz'
            ? (clon ? 'Toca el play: así vas a sonar.' : '')
            : paso === 'puente'
              ? (creditos != null ? `${creditos.toLocaleString('es-MX')} créditos en tu cuenta de Google.` : '')
              : '';

  /**
   * ⚠️ UNA GUARDA BLOQUEA SÓLO LO QUE SE ARREGLA HACIENDO LO QUE ELLA PIDE.
   *
   * Este paso pide conectar el navegador, y `estado: 'marcada'` NO se arregla
   * conectando: es Google el que pausó la sesión de Flow, y la salida es esperar,
   * limpiar cookies y volver a entrar — nada de eso pasa acá adentro.
   *
   * Medido el 02/09/2026 sobre una clienta: puente `marcada` con la extensión al
   * día y latiendo hace 4 segundos, los tres pasos anteriores cerrados, y este
   * trabado sin ninguna forma de pasar. El popup de la extensión le decía «toca
   * Ya lo hice, volver a habilitar en el aviso rojo» y ese botón vive en un
   * componente que esta pantalla no dibujaba. Escribió: «no encuentro el Ya lo
   * hice».
   *
   * Así que la marca deja pasar. Lo que sigue bloqueando es el único estado que
   * SÍ se arregla acá: no haber conectado nunca.
   */
  const puedeAvanzar =
    paso === 'cara' ? misFotos.length > 0
      : paso === 'puente' ? (est.anda || puente?.estado === 'marcada')
        : true;

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

  const avanzar = useCallback(async () => {
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
  }, [paso, idx, acento, muletillas]);

  const pregunta =
    paso === 'cara' ? 'Tu cara'
      : paso === 'acento' ? 'Cómo hablas'
        : paso === 'muletillas' ? 'Tus muletillas'
        : paso === 'voz' ? 'Tu voz'
          : paso === 'puente' ? 'Tu navegador con Flow'
            : 'Tu primer escenario';

  return (
    <WizardShell
      /**
       * ⚠️ VACÍO A PROPÓSITO: ESE RENGLÓN ES UN KICKER Y ESTÁ PROHIBIDO.
       *
       * `WizardShell` lo pinta en monospace, gris, arriba del título
       * (`WizardShell.tsx:249`), que es exactamente la forma que
       * `docs/hallazgos-ui.md` prohíbe con cita: «esto es una prohibición, no un
       * default». Decía «Generador de video · Configuración» sobre una pantalla
       * que ya se sabe de dónde se abrió.
       *
       * No se saca del shell porque lo comparten otras 25 pantallas: sacarlo de
       * ahí es una decisión de todo el producto, no de este onboarding.
       */
      titulo=""
      pasos={PASOS}
      pasoActual={paso}
      pregunta={pregunta}
      // ⚠️ Subtítulo SÓLO donde el título no se explica solo. La skill lo pide
      // así, y con razón: un subtítulo de relleno debajo de «Tu cara» es un
      // renglón que se lee cuatro veces y no dice nada las cuatro.
      sub={paso === 'ensayo'
        ? 'Se configura usándola: el primer escenario que apruebes cierra esta configuración.'
        : undefined}
      error={error}
      puedeAvanzar={puedeAvanzar}
      enUltimo={paso === 'ensayo'}
      confirmLabel="Empezar mi primer anuncio"
      pending={busy}
      atrasLabel={idx === 0 ? 'Salir' : 'Atrás'}
      onAtras={() => (idx === 0 ? alSalir() : setPaso(PASOS[idx - 1]))}
      onSiguiente={() => void avanzar()}
      onConfirmar={alSalir}
      onClose={alSalir}
      /**
       * ⚠️ EL ASIDE ES EL ANUNCIO, y hasta acá este wizard no tenía ninguno.
       *
       * Sin `escenario`, `WizardShell` pinta UNA columna de 620 px — o sea que
       * este onboarding no se parecía a ninguna otra pantalla de conexión del
       * producto. Con él son 980 px partidos por la misma grilla
       * (`.mk-svc-modal`) que el modal de /integraciones, el onboarding global y
       * el panel de activación de cada tab: el cliente reconoce la MISMA pieza
       * en los cuatro lugares.
       *
       * Y lo que va adentro no es un carrusel: es el objeto que vino a hacer,
       * llenándose con lo suyo. La regla del aside negro ya decía que la promesa
       * se reemplaza por la prueba; acá pasa seis veces.
       */
      escenario={(
        <AnuncioEnConstruccion
          estado={{
            foto: misFotos[Math.min(fotoIdx, Math.max(0, misFotos.length - 1))]?.url ?? '',
            linea,
            voiceId: clon?.voiceId ?? '',
            pie: pieDelAside,
          }}
          alEscuchar={linea ? () => escucharMiVozAction(linea) : undefined}
        />
      )}
      fullscreen
      embebido
      extraFooter={
        <button
          onClick={alSalir}
          style={{
            border: 'none', background: 'transparent', color: 'var(--faint)',
            fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
          }}
        >
          Lo configuro después
        </button>
      }
    >
      {paso === 'cara' && (
        <>
          {/* ⚠️ UNA FOTO, GIGANTE. Acá había una grilla de ocho miniaturas de
              96 px más un párrafo de tres renglones a 34 px. El dueño lo rechazó
              sobre la captura: «el input gigante en el medio, o la foto. Poco
              texto. En todos lados.»

              Y ocho miniaturas no son «la foto»: son un selector múltiple donde
              ninguna se ve, justo en la pantalla cuyo trabajo es MIRAR una cara.
              Con flechas se ve una sola y se pasa de largo — y lo que MaKo
              escribió sobre ella vive en el aside, al lado del anuncio. */}
          {misFotos.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, alignSelf: 'center' }}>
              {misFotos.length > 1 && (
                <button
                  type="button"
                  aria-label="Foto anterior"
                  onClick={() => setFotoIdx((i) => (i - 1 + misFotos.length) % misFotos.length)}
                  style={FLECHA}
                ><Icon name="chevron" size={18} /></button>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={misFotos[fotoIdx % misFotos.length]?.id}
                src={misFotos[fotoIdx % misFotos.length]?.url}
                alt=""
                style={{
                  width: 268, aspectRatio: '3 / 4', objectFit: 'cover',
                  borderRadius: 16, border: '1px solid var(--border)',
                  animation: 'mkFade 250ms ease',
                }}
              />
              {misFotos.length > 1 && (
                <button
                  type="button"
                  aria-label="Foto siguiente"
                  onClick={() => setFotoIdx((i) => (i + 1) % misFotos.length)}
                  style={{ ...FLECHA, transform: 'rotate(180deg)' }}
                ><Icon name="chevron" size={18} /></button>
              )}
            </div>
          ) : (
            // Sin fotos, la pantalla es UN gesto: el área de subir, grande. No hay
            // nada que elegir todavía, así que no hay nada más que dibujar.
            <label style={{
              alignSelf: 'center', width: 268, aspectRatio: '3 / 4', borderRadius: 16,
              border: '1px dashed var(--border-strong)', background: 'var(--surface-2)',
              display: 'grid', placeItems: 'center', gap: 10, cursor: 'pointer',
              color: 'var(--dim)', textAlign: 'center', padding: 20,
            }}>
              <Icon name={subiendo ? 'regenerar' : 'perfil'} size={40} />
              <span style={{ fontSize: 'var(--fs-card)', fontWeight: 600, color: 'var(--ink)' }}>
                {subiendo ? 'Subiendo…' : 'Sube tus fotos'}
              </span>
              <input
                type="file" accept="image/*" multiple disabled={subiendo}
                onChange={(e) => void subir(e.target.files)} style={{ display: 'none' }}
              />
            </label>
          )}

          {misFotos.length > 0 && (
            <label style={{
              alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 7,
              cursor: 'pointer', color: 'var(--dim)', fontSize: 'var(--fs-sm)',
            }}>
              <Icon name={subiendo ? 'regenerar' : 'descargar'} size={14} />
              {subiendo ? 'Subiendo…' : `Agregar otra · ${misFotos.length} ${misFotos.length === 1 ? 'foto' : 'fotos'}`}
              <input
                type="file" accept="image/*" multiple disabled={subiendo}
                onChange={(e) => void subir(e.target.files)} style={{ display: 'none' }}
              />
            </label>
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
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 9,
          }}>
            {ORDEN.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setAcento(id)}
                style={{
                  display: 'grid', gap: 3, textAlign: 'left', cursor: 'pointer',
                  padding: '13px 15px', borderRadius: 'var(--r-md)', font: 'inherit',
                  background: acento === id ? 'var(--mako-bg)' : 'var(--surface-2)',
                  border: `1px solid ${acento === id ? 'var(--mako-border)' : 'var(--border)'}`,
                  color: 'inherit',
                }}
              >
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>
                  {ETIQUETA_ACENTO[id]}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{DONDE[id]}</div>
              </button>
            ))}
          </div>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {MULETILLAS[acento].map((m) => {
              const puesta = muletillas.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMuletillas((a) => (puesta ? a.filter((x) => x !== m) : [...a, m]))}
                  style={{
                    padding: '9px 16px', borderRadius: 999, cursor: 'pointer', font: 'inherit',
                    fontSize: 14.5, fontWeight: 600,
                    background: puesta ? 'var(--mako-bg)' : 'var(--surface-2)',
                    border: `1px solid ${puesta ? 'var(--mako-border)' : 'var(--border)'}`,
                    color: puesta ? 'var(--ink)' : 'var(--dim)',
                  }}
                >
                  {m}
                </button>
              );
            })}
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
          {clon ? (
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
          ) : (
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
              {/* El mismo patrón que la foto: el `<input type="file">` no se estila,
                  así que el label ES el botón.
                  ⚠️ El `accept` NO ofrece wav a propósito: 90 s a 48 kHz son ~8,6 MB
                  y Vercel corta los POST en ~4,5 MB con un 413 que ni llega al
                  handler. En mp3 los mismos 90 s pesan ~1,1 MB. */}
              <label style={{
                alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
                color: 'var(--ink)', fontSize: 14, fontWeight: 600,
              }}>
                <Icon name={subiendoVoz ? 'regenerar' : 'check'} size={15} />
                {subiendoVoz ? 'Subiendo…' : muestras.length ? 'Agregar otro audio' : 'Subir mi audio'}
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
          <AvisoExtensionVieja instalada={instalada} />
          {!est.anda && (
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
    </WizardShell>
  );
}
