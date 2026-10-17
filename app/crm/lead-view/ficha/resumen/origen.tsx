'use client';

// =============================================================================
// ficha/resumen/origen — de dónde vino: el canal y el anuncio, la página donde se registró y la publicación por la
// que entró
// =============================================================================
// Reemplaza a OrigenCard (16/10/2026). Lo que se conserva: el canal con su rótulo largo (`canalDeEntrada`, ./logica.ts,
// que es el `labelOrigen` de la tarjeta, con sus reglas: el default no afirma nada), la jerarquía real de Meta
// (Campaña › Conjunto › Anuncio, UN camino y no tres datos sueltos) y «Abrir en Ads Manager» al Ads Manager de MaKo.
// Lo nuevo: dos datos que ya se guardaban y nadie dibujaba (mig 0290): la página del opt-in (`pagina_registro`) y cómo
// entró por Instagram o Messenger (`entrada_social`: el comentario con su palabra clave, la historia, el anuncio).
//
// LA REFERENCIA: las «Original source» y «Original source drill-down» de HubSpot (el canal arriba y el detalle en dos
// niveles; documentación oficial), en una sola tarjeta. Nada de esto se edita: lo escribió la entrada.
// =============================================================================

import { Fragment } from 'react';
import Link from '@/app/_ui/Link';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { COMO_ENTRO, NOMBRE_CANAL, entradaSocialGuardada } from '@/lib/canal-social';
import type { PropsBloque } from '../tipos';
import { hrefDePagina, lineaDeOrigen, origenDelLead, paginaLegible } from './logica';
import { Bloque, BotonIco, IcoAbrir } from './piezas';

export function Origen({ ctx, titulo, diseno, epico }: PropsBloque) {
  const o = origenDelLead(ctx.lead, ctx.data);
  if (!o) return null;
  const ads = o.href ? <Link href={o.href} className="fr-link" title="Abrir este anuncio en tu Ads Manager">Abrir en Ads Manager →</Link> : null;
  const camino = [o.campana, o.conjunto, o.anuncio].filter((x): x is string => !!x);

  if (diseno === 'chip' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false} derecha={ads}>
        <div className="fr-chips">
          <span className={`fr-chip fr-tono-${o.canal.tono}`}>{o.canal.texto}</span>
          {o.fuente && <span className="fr-chip">{o.fuente}</span>}
          {o.anuncio && <span className="fr-chip" title={camino.join(' › ')}>{o.anuncio}</span>}
        </div>
      </Bloque>
    );
  }
  if (diseno === 'linea' && !epico) {
    // El canal, la fuente y el camino entero del anuncio (`lineaDeOrigen`): la campaña y el conjunto no se callan.
    return (
      <Bloque titulo={titulo} epico={false} derecha={ads}>
        <div className="fr-migas">
          <span className={`fr-fuerte fr-tono-${o.canal.tono}`}>{o.canal.texto}</span>
          {lineaDeOrigen(o).map((x, i) => <Fragment key={`${i}:${x}`}><span className="fr-sep">·</span><span>{x}</span></Fragment>)}
        </div>
      </Bloque>
    );
  }
  // «Migas» (y la épica: el canal es el protagonista).
  return (
    <Bloque titulo={titulo} epico={epico} derecha={ads}>
      {epico
        ? <span className={`fr-frase fr-tono-${o.canal.tono}`}>{o.canal.texto}</span>
        : <span className={`fr-num fr-tono-${o.canal.tono}`} style={{ fontSize: 20 }}>{o.canal.texto}</span>}
      {(o.fuente || camino.length > 0) && (
        <div className="fr-migas">
          {o.fuente && <span>{o.fuente}</span>}
          {camino.map((x, i) => (
            // Un Fragment y no un <span style="display: contents">: `.fr-migas > .fr-sep` y `> .fr-fuerte` miran los
            // hijos DIRECTOS, y con el envoltorio el separador no salía tenue ni el anuncio en negrita.
            <Fragment key={`${i}:${x}`}>
              {(i > 0 || o.fuente) && <span className="fr-sep">›</span>}
              <span className={i === camino.length - 1 ? 'fr-fuerte' : undefined}>{x}</span>
            </Fragment>
          ))}
        </div>
      )}
    </Bloque>
  );
}

/** La página donde dejó sus datos (`leads.pagina_registro`, la escribe sólo el alta) y cuándo (`created_at`). */
export function PaginaDeRegistro({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { lead } = ctx;
  const ver = paginaLegible(lead.pagina_registro);
  const href = hrefDePagina(lead.pagina_registro);
  if (!ver) return null;
  return (
    <Bloque titulo={titulo} epico={epico} derecha={href ? <BotonIco titulo="Abrir la página" href={href}><IcoAbrir /></BotonIco> : undefined}>
      <span className={epico ? 'fr-frase' : undefined} style={epico ? undefined : { fontSize: 15, fontWeight: 650, overflowWrap: 'anywhere' }}>{ver}</span>
      {(diseno === 'fila' || epico) && lead.created_at && <span className="fr-sub">El {fmtDDMMYYYY(lead.created_at.slice(0, 10))}</span>}
    </Bloque>
  );
}

/** Cómo entró por Instagram o Messenger (`leads.entrada_social`, guardado UNA vez al nacer): lo que hizo y lo que escribió. */
export function PublicacionDeEntrada({ ctx, titulo, epico }: PropsBloque) {
  const e = entradaSocialGuardada(ctx.lead.entrada_social);
  if (!e) return null;
  return (
    <Bloque titulo={titulo} epico={epico}>
      <span className={epico ? 'fr-frase' : undefined} style={epico ? undefined : { fontSize: 15, fontWeight: 650 }}>{COMO_ENTRO[e.como]}</span>
      {e.texto && <span className="fr-tarjeta" style={{ fontSize: epico ? 20 : 14.5, fontWeight: 600 }}>«{e.texto}»</span>}
      <span className="fr-sub">{NOMBRE_CANAL[e.canal]}{e.at ? ` · ${fmtDDMMYYYY(e.at.slice(0, 10))}` : ''}{e.ref ? ` · ref ${e.ref}` : ''}</span>
    </Bloque>
  );
}
