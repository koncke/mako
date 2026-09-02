'use client';

// =============================================================================
// AnuncioEnConstruccion — el aside del onboarding: tu anuncio, armándose
// =============================================================================
//
// ── Por qué esto y no un carrusel ──────────────────────────────────────────
//
// La regla del aside negro ya estaba escrita en `PanelMarketing`: **sin conexión
// va la promesa, con conexión van los FACTS de tu cuenta.** «La promesa se
// reemplaza por la prueba en el momento exacto en que el cliente aprieta el
// tilde. Un "ok ✓" no prueba nada.»
//
// Esta pieza es esa misma regla llevada a un recorrido de seis pasos: en vez de
// un tilde por paso, el aside es EL OBJETO que el cliente vino a hacer —un
// anuncio vertical— y cada paso lo llena con algo suyo. Su cara, su acento, sus
// muletillas, su voz, sus créditos.
//
// ── La regla que gobierna cada píxel ───────────────────────────────────────
//
// `docs/onboarding-nuevo.md` la fija para todo el producto:
//
//     «Cada píxel que se mueve transporta un hecho del negocio del cliente.
//      Si no transporta ninguno, no se mueve.»
//
// Y sus corolarios, que acá se cumplen uno por uno:
//
//  · **Un nodo que aparece = una cosa que MaKo entendió.** Nada de partículas ni
//    destellos. El espectáculo es que el dibujo es TUYO.
//  · **El dorado es un verbo.** Se enciende mientras MaKo hace algo —acá, los
//    ~2 s en que la voz clonada habla— y se apaga cuando termina.
//  · **Un solo momento por sesión.** Micro 100 ms, transición 250 ms, momento
//    600 ms. Acá el único momento es escucharse.
//  · **La celebración es un dato.** El cierre no es confeti: es cuántos anuncios
//    distintos puede filmar MaKo con lo que ya cargó.
//
// ── Y el peak-end ──────────────────────────────────────────────────────────
//
// El primer paso muestra el cuadro VACÍO y el último muestra el mismo cuadro
// lleno. Es el mismo objeto: por eso se puede volver a mostrar al final, cosa
// que un splash de marca no puede.

import { useCallback, useEffect, useRef, useState } from 'react';
import { MONO } from '@/app/_ui';
import { Icon } from '../_components/icons';

/** Un renglón de lo que MaKo ya sabe. `valor` vacío = todavía no lo sabe. */
type Dato = { k: string; valor: string; paso: string };

export type EstadoDelAnuncio = {
  /** La foto elegida, firmada. '' = todavía no subió ninguna. */
  foto: string;
  cuantasFotos: number;
  /** Cómo se llama su acento en pantalla. */
  acento: string;
  /** `false` = salió de adivinar la zona horaria, y la pantalla lo dice. */
  acentoSeguro: boolean;
  muletillas: string[];
  /** El id del clon en ElevenLabs. '' = todavía no clonó. */
  voiceId: string;
  /** Créditos de Flow de su cuenta de Google. `null` = no se sabe. */
  creditos: number | null;
  /**
   * Una línea REAL de uno de sus guiones, la que se ve como subtítulo.
   *
   * ⚠️ Es suya y no un ejemplo: el subtítulo de una maqueta con texto inventado
   * es decoración, y esta pieza no puede tener decoración. Vacío cuando todavía
   * no escribió ningún guion — y ahí el cuadro no miente: se queda sin subtítulo.
   */
  linea: string;
};

/** Los pasos, en orden. Se usa para saber qué renglón está en curso. */
const ORDEN = ['cara', 'acento', 'muletillas', 'voz', 'puente', 'ensayo'] as const;

export function AnuncioEnConstruccion({
  estado, paso, alEscuchar,
}: {
  estado: EstadoDelAnuncio;
  paso: string;
  /**
   * Pide que la voz clonada diga la línea. Devuelve el audio listo para sonar.
   *
   * Lo inyecta el padre: esta pieza no importa actions — mismo criterio que
   * `PasoTomas`, para que se pueda mirar sin levantar un server.
   */
  alEscuchar?: () => Promise<{ ok: boolean; audio?: string; error?: string }>;
}) {
  const [sonando, setSonando] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [fallo, setFallo] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ⚠️ El audio se para al desmontar. Sin esto, salir del wizard mientras la voz
  // habla deja el sonido corriendo sobre otra pantalla — y no hay dónde pararlo.
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const escuchar = useCallback(async () => {
    if (!alEscuchar || pidiendo || sonando) return;
    setPidiendo(true);
    setFallo('');
    try {
      const r = await alEscuchar();
      if (!r.ok || !r.audio) { setFallo(r.error || 'No se pudo generar el audio.'); return; }
      const a = new Audio(r.audio);
      audioRef.current = a;
      a.onended = () => setSonando(false);
      a.onerror = () => { setSonando(false); setFallo('El navegador no pudo reproducir el audio.'); };
      setSonando(true);
      await a.play().catch(() => { setSonando(false); setFallo('El navegador bloqueó el audio. Toca otra vez.'); });
    } finally {
      setPidiendo(false);
    }
  }, [alEscuchar, pidiendo, sonando]);

  const datos: Dato[] = [
    { k: 'Tu cara', paso: 'cara', valor: estado.cuantasFotos ? `${estado.cuantasFotos} ${estado.cuantasFotos === 1 ? 'foto' : 'fotos'}` : '' },
    { k: 'Cómo hablas', paso: 'acento', valor: estado.acentoSeguro ? estado.acento : '' },
    { k: 'Tus muletillas', paso: 'muletillas', valor: estado.muletillas.slice(0, 2).join(' · ') },
    { k: 'Tu voz', paso: 'voz', valor: estado.voiceId ? 'Clonada' : '' },
    {
      k: 'Tu navegador',
      paso: 'puente',
      valor: estado.creditos != null ? `${estado.creditos.toLocaleString('es-MX')} créditos` : '',
    },
  ];

  const puedeEscuchar = !!estado.voiceId && !!estado.linea && !!alEscuchar;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 20, padding: '26px 22px', height: '100%', overflowY: 'auto',
    }} className="mk-scroll-oscuro">

      {/* ── EL CUADRO. Es el objeto que vino a hacer, en el formato en que lo va
          a publicar. Empieza vacío y termina siendo él. ─────────────────── */}
      <div
        style={{
          position: 'relative', width: 196, aspectRatio: '9 / 16', flex: 'none',
          borderRadius: 14, overflow: 'hidden', background: '#0B0D11',
          display: 'grid', placeItems: 'center',
          // ⚠️ EL DORADO ES UN VERBO. Sólo mientras la voz está hablando, que es
          // el único momento en que MaKo está haciendo algo en esta pieza. Un
          // borde dorado permanente sería decoración, y eso viola la regla.
          border: sonando ? '2px solid var(--mako)' : '1px solid #23262E',
          boxShadow: sonando ? '0 0 0 6px rgba(242,176,30,.12)' : 'none',
          transition: 'border-color 250ms ease, box-shadow 250ms ease',
        }}
        aria-label={estado.foto ? 'Tu anuncio, con tu foto' : 'Tu anuncio, todavía vacío'}
      >
        {estado.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={estado.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          // Vacío, y se ve vacío: el trazo punteado dice «esto todavía no está»
          // sin escribirlo. Es la misma gramática que los nodos `pendiente` del
          // mapa: un hueco se dibuja como un hueco.
          <div style={{
            width: 'calc(100% - 24px)', height: 'calc(100% - 24px)', borderRadius: 10,
            border: '1px dashed #2C313B', display: 'grid', placeItems: 'center',
            color: '#3A414D',
          }}>
            <Icon name="video" size={30} />
          </div>
        )}

        {/* El subtítulo: una línea REAL de su guion. Aparece cuando existe, y si
            no existe el cuadro se queda sin subtítulo en vez de inventar uno. */}
        {!!estado.linea && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, padding: '26px 12px 12px',
            background: 'linear-gradient(to top, rgba(0,0,0,.86), rgba(0,0,0,0))',
            color: '#fff', fontSize: 12.5, lineHeight: 1.35, fontWeight: 700,
            textAlign: 'center', textWrap: 'balance',
          }}>
            {estado.linea}
          </div>
        )}
      </div>

      {/* ── EL MOMENTO. El único de todo el recorrido, y sólo existe cuando hay
          algo real que oír: su clon diciendo una línea suya. ─────────────── */}
      {puedeEscuchar && (
        <div style={{ display: 'grid', gap: 6, justifyItems: 'center', width: '100%' }}>
          <button
            type="button"
            onClick={() => void escuchar()}
            disabled={pidiendo || sonando}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 16px', borderRadius: 999, cursor: sonando ? 'default' : 'pointer',
              border: '1px solid var(--mako)', background: 'transparent',
              color: 'var(--mako)', font: 'inherit', fontSize: 13, fontWeight: 700,
            }}
          >
            <Icon name={sonando ? 'pausa' : 'play'} size={14} />
            {pidiendo ? 'Preparando…' : sonando ? 'Escuchando tu voz' : 'Escúchate'}
          </button>
          {!!fallo && (
            <div style={{ fontSize: 11.5, color: 'var(--warn)', textAlign: 'center', lineHeight: 1.4 }}>{fallo}</div>
          )}
        </div>
      )}

      {/* ── LO QUE MAKO YA SABE. Cada renglón es un DATO suyo, no un tilde: es
          la diferencia entre «ok ✓» y «898 créditos». ────────────────────── */}
      <div style={{ width: '100%', display: 'grid', gap: 2 }}>
        <div style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
          color: 'var(--sidebar-text)', marginBottom: 8, opacity: .75,
        }}>
          Lo que MaKo ya sabe de ti
        </div>
        {datos.map((d) => {
          const enCurso = d.paso === paso;
          const listo = !!d.valor;
          return (
            <div
              key={d.k}
              style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
                padding: '9px 10px', borderRadius: 8,
                // El paso en curso se marca con SUPERFICIE, no con dorado: el
                // dorado dice «MaKo está haciendo algo», y estar parado en un
                // renglón no es eso.
                background: enCurso ? 'rgba(255,255,255,.05)' : 'transparent',
                borderLeft: `2px solid ${enCurso ? 'var(--accent)' : 'transparent'}`,
                transition: 'background 250ms ease',
              }}
            >
              <span style={{
                fontSize: 12.5,
                color: listo ? 'var(--on-sidebar)' : 'var(--sidebar-text)',
              }}>{d.k}</span>
              <span style={{
                fontSize: 12.5, fontWeight: listo ? 700 : 400, textAlign: 'right',
                color: listo ? 'var(--on-sidebar)' : '#3A414D',
                // ⚠️ 250 ms y sólo opacidad: es la «transición» del vocabulario,
                // no el «momento». Un valor que entra con un rebote celebra, y si
                // todo celebra no celebra nada.
                animation: listo ? 'mkFade 250ms ease' : undefined,
              }}>{d.valor || '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** El paso siguiente al que se está mirando, para el aside. Sin lógica de negocio. */
export function pasoSiguiente(paso: string): string {
  const i = ORDEN.indexOf(paso as typeof ORDEN[number]);
  return i >= 0 && i < ORDEN.length - 1 ? ORDEN[i + 1] : paso;
}
