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
// Acá esa regla se lleva a un recorrido de seis pasos: el aside es EL OBJETO que
// el cliente vino a hacer —un anuncio vertical— y cada paso lo llena con algo
// suyo. Su cara, su acento, su voz, sus créditos.
//
// ── Y por qué acá NO va una lista de lo que MaKo sabe ──────────────────────
//
// ⚠️ La primera versión tenía cinco renglones con rótulo y valor debajo del
// cuadro, más un eyebrow. Diez elementos de texto en una columna de 336 px. El
// dueño lo rechazó sobre la captura: *«así NO se hace un onboarding épico…
// quiero que sea lo más minimalista posible, en EXTREMO. El input gigante en el
// medio, o la foto. Poco texto. En todos lados.»*
//
// Y tenía razón por una razón concreta: **la lista competía con el cuadro.** El
// hecho ya estaba adentro del cuadro —es su cara, es su frase— y repetirlo como
// renglón lo convertía en un formulario con una foto al lado. Queda UNA línea,
// la del paso en curso, y sólo cuando dice algo.
//
// La regla que sale de ahí: *un dato que ya se ve no se vuelve a escribir.*
//
// ── La regla que gobierna cada píxel ───────────────────────────────────────
//
//     «Cada píxel que se mueve transporta un hecho del negocio del cliente.
//      Si no transporta ninguno, no se mueve.»  (docs/onboarding-nuevo.md)
//
// El dorado es un verbo: acá se enciende SÓLO mientras la voz clonada habla, y
// se apaga cuando termina.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../_components/icons';

export type EstadoDelAnuncio = {
  /** La foto que se está mirando, firmada. '' = todavía no subió ninguna. */
  foto: string;
  /**
   * Una línea REAL de uno de sus guiones, la que se ve como subtítulo.
   *
   * ⚠️ Suya y no un ejemplo: un subtítulo con texto inventado convierte esto en
   * una maqueta, o sea en decoración. Vacío cuando todavía no escribió ningún
   * guion — y ahí el cuadro se queda sin subtítulo en vez de mentir.
   */
  linea: string;
  /** El id del clon en ElevenLabs. '' = todavía no clonó. */
  voiceId: string;
  /**
   * UNA línea sobre el paso en curso, o ''. Es lo único que se escribe fuera del
   * cuadro, y sólo cuando aporta algo que el cuadro no muestra.
   */
  pie: string;
};

export function AnuncioEnConstruccion({
  estado, alEscuchar,
}: {
  estado: EstadoDelAnuncio;
  /**
   * Pide que la voz clonada diga la línea. Devuelve el audio listo para sonar.
   * Lo inyecta el padre: esta pieza no importa actions.
   */
  alEscuchar?: () => Promise<{ ok: boolean; audio?: string; error?: string }>;
}) {
  const [sonando, setSonando] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [fallo, setFallo] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // El audio se para al desmontar: salir del wizard mientras la voz habla dejaría
  // el sonido corriendo sobre otra pantalla, sin dónde pararlo.
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
      await a.play().catch(() => { setSonando(false); setFallo('El navegador bloqueó el audio.'); });
    } finally {
      setPidiendo(false);
    }
  }, [alEscuchar, pidiendo, sonando]);

  const puedeEscuchar = !!estado.voiceId && !!estado.linea && !!alEscuchar;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: '28px 22px', height: '100%',
    }}>

      {/* ── EL CUADRO, Y CASI NADA MÁS. Es el objeto que vino a hacer, en el
          formato en que lo va a publicar. Empieza vacío y termina siendo él. ── */}
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: 268, aspectRatio: '9 / 16',
          flex: 'none', borderRadius: 16, overflow: 'hidden', background: '#0B0D11',
          display: 'grid', placeItems: 'center',
          // ⚠️ EL DORADO ES UN VERBO. Sólo mientras la voz habla, que es el único
          // momento en que MaKo está haciendo algo en esta pieza. Un borde dorado
          // permanente sería decoración, y eso viola la regla del producto.
          border: sonando ? '2px solid var(--mako)' : '1px solid #23262E',
          boxShadow: sonando ? '0 0 0 6px rgba(242,176,30,.12)' : 'none',
          transition: 'border-color 250ms ease, box-shadow 250ms ease',
        }}
        aria-label={estado.foto ? 'Tu anuncio, con tu foto' : 'Tu anuncio, todavía vacío'}
      >
        {estado.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={estado.foto}
            src={estado.foto}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'mkFade 250ms ease' }}
          />
        ) : (
          // Vacío, y se ve vacío. El trazo punteado dice «esto todavía no está»
          // sin escribirlo: un hueco se dibuja como un hueco.
          <div style={{
            width: 'calc(100% - 26px)', height: 'calc(100% - 26px)', borderRadius: 12,
            border: '1px dashed #2C313B', display: 'grid', placeItems: 'center', color: '#3A414D',
          }}>
            <Icon name="video" size={32} />
          </div>
        )}

        {!!estado.linea && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, padding: '30px 14px 14px',
            background: 'linear-gradient(to top, rgba(0,0,0,.88), rgba(0,0,0,0))',
            color: '#fff', fontSize: 13, lineHeight: 1.35, fontWeight: 700,
            textAlign: 'center', textWrap: 'balance',
          }}>
            {estado.linea}
          </div>
        )}

        {/* El único momento de la pieza, y sólo existe cuando hay algo real que
            oír: su clon diciendo una línea suya. Va ENCIMA del cuadro porque lo
            que suena es ese cuadro, no un control de al lado. */}
        {puedeEscuchar && (
          <button
            type="button"
            onClick={() => void escuchar()}
            disabled={pidiendo || sonando}
            aria-label="Escuchar tu voz diciendo esta línea"
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 44, height: 44, borderRadius: 999, display: 'grid', placeItems: 'center',
              cursor: sonando ? 'default' : 'pointer', padding: 0,
              border: '1px solid var(--mako)', background: 'rgba(11,13,17,.72)',
              color: 'var(--mako)', backdropFilter: 'blur(6px)',
            }}
          >
            <Icon name={sonando ? 'pausa' : 'play'} size={17} />
          </button>
        )}
      </div>

      {/* ⚠️ UNA línea, la del paso en curso, y sólo cuando dice algo que el cuadro
          no muestra. Acá había cinco renglones con rótulo y valor: un formulario
          al lado de una foto. Un dato que ya se ve no se vuelve a escribir. */}
      {(!!estado.pie || !!fallo) && (
        <div style={{
          fontSize: 12.5, lineHeight: 1.45, textAlign: 'center', maxWidth: 268,
          color: fallo ? 'var(--warn)' : 'var(--sidebar-text)',
          animation: 'mkFade 250ms ease',
        }}>
          {fallo || estado.pie}
        </div>
      )}
    </div>
  );
}
