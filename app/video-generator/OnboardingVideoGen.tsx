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
import { MONO } from '@/app/_ui';
import { Icon } from '../_components/icons';
import { ACENTOS_ES, MULETILLAS, type AcentoId } from '@/lib/acento-workspace';
import type { Puente } from '@/lib/flow-cola';
import { estadoDelPuente, AvisoPuente } from './puente-avisos';
import { useExtensionInstalada, AvisoExtensionVieja } from './extension-instalada';
import {
  marcarPasoVideoAction, guardarAcentoAction, guardarMuletillasAction,
} from './onboarding-actions';

const PASOS = ['cara', 'acento', 'muletillas', 'puente', 'ensayo'] as const;
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

const ORDEN: AcentoId[] = ['mx-norte', 'mx-neutro', 'mx-cdmx', 'co', 'latam', 'ar', 'es'];

/** Caja de contexto del paso (molde de la skill: surface-2 + eyebrow mono). */
function Contexto({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '13px 15px', textAlign: 'left',
    }}>
      <div style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
        color: 'var(--faint)', marginBottom: 7,
      }}>
        {eyebrow}
      </div>
      <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

export function OnboardingVideoGen({
  fotos, acentoInicial, acentoSeguro, muletillasIniciales, puente, ahora, alSalir,
}: {
  fotos: { id: string; url: string }[];
  /** El que el server va a usar HOY: declarado si lo hay, inferido si no. */
  acentoInicial: string;
  /** false = salió de la zona horaria. La pantalla lo dice y con eso se corrige. */
  acentoSeguro: boolean;
  muletillasIniciales: string[];
  puente: Puente | null;
  ahora: number | null;
  /** Salir del wizard sin recargar: el guard del server devolvería lo mismo. */
  alSalir: () => void;
}) {
  const [paso, setPaso] = useState<Paso>('cara');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── La cara ──
  const [misFotos, setMisFotos] = useState(fotos);
  const [subiendo, setSubiendo] = useState(false);

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

  // ── El puente ──
  // Si la extensión está y con qué versión. Lo mide el propio DOM (el content
  // script marca `data-mako-puente`), así que es un HECHO y no una inferencia.
  const instalada = useExtensionInstalada();
  // Estado VIVO, no recordado: se recalcula en cada render con el reloj del
  // server. Un puente que se cayó mientras la persona miraba tiene que dejar de
  // decir «Listo».
  const est = estadoDelPuente(puente, ahora);

  const idx = PASOS.indexOf(paso);

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
        : await marcarPasoVideoAction(paso === 'cara' ? 'vg_cara' : 'vg_puente');
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setPaso(PASOS[idx + 1]);
  }, [paso, idx, acento, muletillas]);

  const pregunta =
    paso === 'cara' ? 'Tu cara'
      : paso === 'acento' ? 'Cómo hablas'
        : paso === 'muletillas' ? 'Tus muletillas'
          : paso === 'puente' ? 'Tu navegador con Flow'
            : 'Tu primer escenario';

  return (
    <WizardShell
      titulo="Generador de video · Configuración"
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
          {misFotos.length > 0 && (
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center' }}>
              {misFotos.map((f) => (
                <img
                  key={f.id}
                  src={f.url}
                  alt=""
                  style={{
                    width: 96, aspectRatio: '3 / 4', objectFit: 'cover',
                    borderRadius: 10, border: '1px solid var(--border)',
                  }}
                />
              ))}
            </div>
          )}
          {/* ⚠️ Un `<input type="file">` no se estila, así que va escondido detrás
              de su propio label — que ES el botón. Con un `<Button>` al lado
              habría dos controles para una acción. */}
          <label
            style={{
              alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 'var(--r-md)', cursor: 'pointer',
              border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
              color: 'var(--ink)', fontSize: 14, fontWeight: 600,
            }}
          >
            <Icon name={subiendo ? 'regenerar' : 'check'} size={15} />
            {subiendo ? 'Subiendo…' : misFotos.length ? 'Agregar otra foto' : 'Subir mis fotos'}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={subiendo}
              onChange={(e) => void subir(e.target.files)}
              style={{ display: 'none' }}
            />
          </label>
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
            {acentoSeguro
              ? 'Este es el que ya elegiste. Todos tus guiones se escriben así.'
              : `Lo deduje de tu zona horaria, así que puede estar mal. Es la razón por la que te lo pregunto: hasta ahora tus guiones se escribían en ${ETIQUETA_ACENTO[acento]} sin que nadie lo hubiera confirmado.`}
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
                <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14.5 }}>Listo</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                  Tu navegador está conectado y Google Flow responde.
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
          <div style={{ display: 'grid', gap: 7, textAlign: 'left' }}>
            {[
              ['Eliges un formato', 'La cámara, el ritmo y cuántos escenarios tiene el anuncio.'],
              ['MaKo escribe el guion', `Con tu negocio, en ${ETIQUETA_ACENTO[acento]}${muletillas.length ? ` y con tus muletillas` : ''}.`],
              ['Eliges dónde se graba', 'Una oficina, tu auto, tu local. Y pides otro fondo las veces que quieras.'],
              ['Apruebas el escenario', 'Gratis: las imágenes no gastan créditos. Recién filmar cuesta.'],
            ].map(([t, d], i) => (
              <div key={t} style={{
                display: 'flex', gap: 11, alignItems: 'flex-start',
                padding: '11px 14px', borderRadius: 'var(--r-md)',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
              }}>
                <span style={{
                  fontFamily: MONO, fontSize: 11, color: 'var(--faint)', paddingTop: 2,
                }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{t}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{d}</div>
                </div>
              </div>
            ))}
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
