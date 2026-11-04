'use client';

// =============================================================================
// Una pieza de Competitor Spy: la tarjeta de catálogo de la referencia
// =============================================================================
// REHECHA el 1/11/2026. La anterior era una ficha de cinco zonas apiladas —cabecera con el
// ícono del canal, fila de estado, creativo, fila de TRES contadores y pie— y esa pila es la
// que hacía que la rejilla se leyera como una tabla y no como un catálogo.
//
// Lo de ahora es la `.pcard` de fitlo (demo.codeandchill.store/fitlo/#/shop/all), medida en el
// navegador y anotada en docs/diseno/referencia-spy.md:
//
//   · La tarjeta NO tiene borde: tiene un TINTE. Acá el tinte dice de qué canal es, así que el
//     canal ya no necesita una fila con un ícono y una palabra.
//   · El creativo va a sangre arriba, en 4/5, y encima van las píldoras: el punto del canal
//     arriba a la izquierda y hasta dos píldoras abajo (los días a la vista y a dónde manda),
//     que es el `.pcard__tag + .pcard__fit` de la referencia.
//   · El pie es una sola fila: el texto a la izquierda y UN número a la derecha.
//
// LO QUE SE CONSERVÓ DE LAS REGLAS:
//  · Un contador ausente no es cero: `contadorDeTarjeta` devuelve una frase, y cuando no empieza
//    con un dígito la píldora cambia de peso en vez de dibujar un 0.
//  · Si falta un dato, la línea se omite y la tarjeta se recompone. Nunca una clave ni un `ref`.
//  · ⚠️ LA ETAPA YA NO SE DIBUJA (4/11/2026): «Probado» y «a la vista» eran criterio nuestro y Martín no los entendía. Lo
//    orgánico dice hace cuánto se publicó; un anuncio, cuántos días lleva al aire.
//  · «Analizando…» mientras la IA del negocio lee la pieza, sola y en segundo plano (`analizando`).
//
// ⚠️ LA MINIATURA SE DIBUJA DESDE LA URL VIVA Y NO SE GUARDA. La de YouTube se arma con el id.
// La de Instagram vence (es del CDN de Meta) y se reescribe en cada lectura (lib/spy.ts).

import { contadorDeTarjeta, destinoDePieza, fechaCorta, miniaturaDePieza, rotuloDeTipo, tiempoDePieza } from '@/lib/spy-vista';
import { proporcionDe } from '@/lib/spy-detalle';
import type { PiezaVista } from './actions';

/** El color del canal: el mismo en el punto, en el tinte y en el riel, para no leer leyendas. */
const PUNTO: Record<string, string> = {
  instagram: 'var(--ig)', youtube: 'var(--yt)', anuncios: 'var(--info, #23559f)', landing: 'var(--faint)',
};

export function TarjetaPieza({ p, analizando = false, onAbrir }: {
  p: PiezaVista;
  analizando?: boolean;
  /** Abre su detalle (DetallePieza.tsx, con «Copiar estructura»). Sin esto, la tarjeta lleva a la pieza en su red. */
  onAbrir?: () => void;
}) {
  const esAnuncio = p.canal === 'anuncios';
  const t = tiempoDePieza(p);
  // El texto ya se ve en el lugar del creativo cuando no hay miniatura: no se repite abajo.
  const titulo = p.analisis?.gancho || p.titulo || null;
  const destino = destinoDePieza(p);
  const miniatura = miniaturaDePieza(p);
  const vistas = contadorDeTarjeta(p.vistas, p.metricas_leidas_en);
  const megusta = contadorDeTarjeta(p.megusta, p.metricas_leidas_en);
  const hayVistas = /^\d/.test(vistas);

  // La línea de arriba del pie: sólo lo que existe, separado por puntos medios.
  const linea = [
    rotuloDeTipo(p.tipo),
    /^\d/.test(megusta) ? `${megusta} me gusta` : null,
  ].filter(Boolean).join(' · ');

  const cuerpo = (
    <>
      {/* Su proporción real (Martín, 4/11): un reel vertical, una imagen cuadrada, un video de YouTube apaisado. */}
      <div className="spy-pcard__media" style={{ aspectRatio: `${proporcionDe(p).ancho} / ${proporcionDe(p).alto}` }}>
        {/* ⚠️ EL TEXTO VA SIEMPRE Y LA FOTO ENCIMA. Antes el texto era el `else` de la foto, así que
            una foto que no cargaba dejaba una caja de color VACÍA — que es exactamente lo que vio
            Martín el 2/11: «las miniaturas de IG no se ven, sólo cajas vacías». Ahora la foto que
            falla se borra y abajo ya estaba el texto. */}
        {p.texto && <span className="spy-pcard__texto-creativo">{p.texto.slice(0, 220)}</span>}
        {miniatura && (
          /* ⚠️ `referrerPolicy="no-referrer"` NO ES DECORACIÓN: sin eso el CDN de Meta
             (scontent.cdninstagram.com) devuelve 403 a toda imagen pedida desde otro dominio, y
             ésa es la causa más probable de que no se vieran. Sin referrer, la sirve. */
          // eslint-disable-next-line @next/next/no-img-element -- la sirve el CDN del canal, y no pasa por nuestro optimizador
          <img className="spy-pcard__foto" src={miniatura} alt="" loading="lazy" referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.remove(); }} />
        )}

        <span className="spy-pcard__puntos" aria-hidden><i style={{ background: PUNTO[p.canal] ?? 'var(--faint)' }} /></span>

        {/* Un anuncio pegado no dice cuándo empezó; el que se guardó desde la Biblioteca sí. */}
        {esAnuncio && t.dias == null
          ? <span className="spy-pcard__tag">Lo viste el {fechaCorta(p.visto_primera_vez)}</span>
          : t.dias != null && (esAnuncio
            ? (
              <span className={t.sigue ? 'spy-pcard__tag spy-pcard__tag--viva' : 'spy-pcard__tag'} title={t.linea}>
                {t.sigue && <i className="spy-punto spy-punto-vivo" />}{t.dias} d al aire
              </span>
            )
            : <span className="spy-pcard__tag" title={t.linea}>{t.dias === 0 ? 'Hoy' : `Hace ${t.dias} d`}</span>)}
        {analizando && <span className="spy-pcard__tag spy-pcard__tag--analizando" aria-live="polite"><i className="spy-punto spy-punto-vivo" />Analizando…</span>}
        {destino && <span className="spy-pcard__tag" title={`Manda a ${destino}`}>{destino}</span>}
      </div>

      <div className="spy-pcard__pie">
        <div className="spy-pcard__texto">
          <small>{linea}</small>
          {titulo && <b>{titulo}</b>}
        </div>
        {/* ⚠️ EL NÚMERO LLEVA EL PESO QUE LA REFERENCIA LE DA A ESE LUGAR. En `.pcard__buy` de fitlo
            ahí va una píldora LLENA con sombra propia, y era lo único de la tarjeta que se leía de
            lejos. Lo nuestro era un chip apagado con un rótulo en versalitas: dos tamaños de letra
            para decir un número. Ahora es la píldora llena, en tinta y no en el acento, porque es
            un dato y no una acción; y el ojo dice «vistas» sin gastar un renglón. */}
        {!esAnuncio && (
          <span className={hayVistas ? 'spy-pcard__num' : 'spy-pcard__num spy-pcard__num--ausente'}
            title={hayVistas ? `${vistas} vistas` : vistas}>
            {hayVistas && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
                <circle cx="12" cy="12" r="2.8" />
              </svg>
            )}
            <b>{vistas}</b>
          </span>
        )}
      </div>
    </>
  );

  // ⚠️ CON `onAbrir` ES UN `div` CON ROL DE BOTÓN, no un `<button>`: adentro van bloques (un botón sólo admite texto en
  // línea) y cambiar la etiqueta le cambiaría la hoja por defecto (AGENTS.md, «Cambiar la ETIQUETA de un elemento…»).
  if (onAbrir) {
    return (
      <div className="spy-pcard" data-canal={p.canal} role="button" tabIndex={0} style={{ cursor: 'pointer' }}
        aria-label={`Ver ${titulo ?? rotuloDeTipo(p.tipo)}`}
        onClick={onAbrir} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}>
        {cuerpo}
      </div>
    );
  }
  return p.url
    ? <a className="spy-pcard" data-canal={p.canal} href={p.url} target="_blank" rel="noreferrer noopener">{cuerpo}</a>
    : <div className="spy-pcard" data-canal={p.canal}>{cuerpo}</div>;
}
