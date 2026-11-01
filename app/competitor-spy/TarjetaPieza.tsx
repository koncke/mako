'use client';

// =============================================================================
// Una tarjeta de Competitor Spy: una por pieza, todas iguales, venga del canal que venga
// =============================================================================
// Copiada de lo medido el 31/10/2026 (docs/hallazgos-competitors-spy.md): las zonas y sus alturas son
// las de Atria (cabecera 48 · estado 36 · creativo a sangre · pie), la fila de tres contadores es la
// de TikTok Creative Center (tres celdas iguales, valor 18/700 sobre etiqueta gris), y la píldora de
// días es la de Minea («● 44d Active» + el rango que termina en «hoy»).
//
// Lo que NO se copió, a propósito:
//  · El avatar y el nombre de la cabecera de Atria: acá toda la rejilla es de UN competidor, y lo que
//    cambia de tarjeta a tarjeta es el canal y el formato. Eso va en su lugar.
//  · Los contadores en un anuncio: de un anuncio comercial en México no existen impresiones ni gasto
//    en ningún producto de Meta. Reservarles una celda es volver a la caja que anuncia su ausencia.
//
// ⚠️ SI FALTA UN DATO, LA LÍNEA SE OMITE Y LA TARJETA SE RECOMPONE. TikTok imprime en producción
// «label_14109000000» porque su tarjeta no tiene plan B: nunca una clave, un `ref` ni «Sin datos».
//
// ⚠️ LA MINIATURA SE DIBUJA DESDE LA URL VIVA Y NO SE GUARDA. La de YouTube se arma con el id. La de
// Instagram vence (es del CDN de Meta), y por eso 0359 no tiene columna para ella: ahí va el texto.

import { Icon } from '../_components/icons';
import { NOMBRE_ETAPA } from '@/lib/spy-reglas';
import { contadorDeTarjeta, destinoDePieza, fechaCorta, miniaturaDePieza, rotuloDeTipo, tiempoDePieza } from '@/lib/spy-vista';
import type { PiezaVista } from './actions';

const ICONO = { instagram: 'instagram', youtube: 'youtube', anuncios: 'meta', landing: 'web' } as const;

function Contador({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  // Lo que no es un número va más chico y apagado, y la celda conserva su lugar: se lee como ausente
  // sin romper la fila y sin parecerse a un cero.
  const esNumero = /^\d/.test(valor);
  return (
    <div className="spy-contador">
      <div className={esNumero ? 'spy-contador-valor' : 'spy-contador-ausente'}>{valor}</div>
      <div className="spy-contador-etiqueta">{etiqueta}</div>
    </div>
  );
}

export function TarjetaPieza({ p }: { p: PiezaVista }) {
  const esAnuncio = p.canal === 'anuncios';
  const t = tiempoDePieza(p);
  // El texto ya se ve en el lugar del creativo cuando no hay miniatura: no se repite abajo.
  const titulo = p.analisis?.gancho || p.titulo || null;
  const destino = destinoDePieza(p);
  const miniatura = miniaturaDePieza(p);

  const cuerpo = (
    <>
      <div className="spy-tarjeta-cabecera">
        <Icon name={ICONO[p.canal]} size={15} />
        <span>{rotuloDeTipo(p.tipo)}</span>
      </div>

      <div className="spy-tarjeta-estado">
        {esAnuncio
          ? <span className="spy-rango">Lo viste el {fechaCorta(p.visto_primera_vez)}</span>
          : (
            <>
              {t.dias != null && (
                <span className="spy-pildora">
                  <i className={t.sigue ? 'spy-punto spy-punto-vivo' : 'spy-punto'} />
                  {t.dias} d
                </span>
              )}
              <span className="spy-rango">{t.linea}</span>
            </>
          )}
      </div>

      {miniatura
        // eslint-disable-next-line @next/next/no-img-element -- la miniatura la sirve YouTube, y no pasa por nuestro optimizador
        ? <img className="spy-creativo" src={miniatura} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        : p.texto && <div className="spy-creativo-texto">{p.texto.slice(0, 220)}</div>}

      {!esAnuncio && (
        <div className="spy-contadores">
          <Contador valor={contadorDeTarjeta(p.vistas, p.metricas_leidas_en)} etiqueta="Vistas" />
          <Contador valor={contadorDeTarjeta(p.megusta, p.metricas_leidas_en)} etiqueta="Me gusta" />
          <Contador valor={contadorDeTarjeta(p.comentarios, p.metricas_leidas_en)} etiqueta="Comentarios" />
        </div>
      )}

      {(destino || titulo || p.etapa) && (
        <div className="spy-tarjeta-pie">
          {destino && <div className="spy-destino">{destino}</div>}
          {titulo && <div className="spy-titulo-pieza">{titulo}</div>}
          {p.etapa && <div className="spy-etapa" title={NOMBRE_ETAPA[p.etapa].porque}>{NOMBRE_ETAPA[p.etapa].rotulo}</div>}
        </div>
      )}
    </>
  );

  return p.url
    ? <a className="spy-tarjeta" href={p.url} target="_blank" rel="noreferrer noopener">{cuerpo}</a>
    : <div className="spy-tarjeta">{cuerpo}</div>;
}
