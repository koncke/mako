'use client';

// =============================================================================
// ficha/resumen/charla — los bloques del Resumen que hablan de la CHARLA con el lead (17/10/2026)
// =============================================================================
// Estaban en las plantillas y sin componente, así que el armador los salteaba en silencio (docs/relevo/crm.md
// §0-Ω9): `charla-whatsapp`, `charla-dm`, `pase-a-humano`, `cambios-de-mako`, `mensaje-listo`,
// `automatizaciones-en-curso` (hasta el 23/10/2026: ahora en ./automatizaciones.tsx) y `lo-que-le-mandamos`. Cada uno lee lo suyo al montarse (./charla-actions.ts) y, si no
// hay nada, se calla (como `posibles-duplicados`); si no pudo leer, lo dice en una línea.
//
// ⚠️ SÓLO MUESTRAN. Lo que se hace con eso (contestar, mandar, confirmar) vive en su pantalla y el bloque lleva ahí:
//    un bloque que manda un mensaje a un cliente es una puerta nueva a un envío, y eso pide su propia revisión.
// =============================================================================

import Link from '@/app/_ui/Link';
import type { PropsBloque } from '../tipos';
import { Bloque } from './piezas';
import { useLectura } from './lectura';
import {
  cambiosDeMakoAction, charlaDmAction, charlaWhatsAppAction, loQueLeMandamosAction,
  mensajesListosAction, paseAHumanoAction, type CambioDeMako, type LoQueLeMandamos,
  type MensajeCorto, type MensajeListo, type PaseAHumano,
} from './charla-actions';


/** El link a la charla en la bandeja de WhatsApp (el de siempre: `?canal=no-oficial&chat=<jid>`). */
const aLaCharla = (jid: string | null | undefined) => (jid ? `/whatsapp?canal=no-oficial&chat=${encodeURIComponent(jid)}` : '/whatsapp');

/** «hace 3 h», «hace 2 días», o la fecha si es vieja. */
function hace(iso: string | null, ahora: number): string {
  if (!iso || !ahora) return '';
  const ms = ahora - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const min = Math.round(ms / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `hace ${d} ${d === 1 ? 'día' : 'días'}` : new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

const NoPude = ({ titulo, epico, que }: { titulo: string; epico: boolean; que: string }) => (
  <Bloque titulo={titulo} epico={epico}><span className="fr-sub">No pude leer {que}.</span></Bloque>
);

function Mensajes({ lista, ahora }: { lista: MensajeCorto[]; ahora: number }) {
  return (
    <div className="fr-props">
      {lista.map((m, i) => (
        <div key={i} className="fr-prop">
          <span className="fr-k">{m.deMi ? 'Nosotros' : 'Él/ella'}</span>
          <span className="fr-v" style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</span>
          <span className="fr-sub">{hace(m.cuando, ahora)}</span>
        </div>
      ))}
    </div>
  );
}

// ── La charla de WhatsApp ────────────────────────────────────────────────────

/** Los últimos mensajes con la línea de la empresa. Sin mensajes igual se dibuja (`sinDatos: 'raya'`): en prospección el primero lo escribe el equipo. */
export function CharlaWhatsApp({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { dato: r, ahora } = useLectura(ctx.lead.id, charlaWhatsAppAction);
  if (r === 'cargando') return <Bloque titulo={titulo} epico={epico}><span className="fr-sub">Cargando…</span></Bloque>;
  if (r === null) return <NoPude titulo={titulo} epico={epico} que="su WhatsApp" />;
  const aBandeja = <Link href={aLaCharla(r.chatJid)} className="fr-link">Abrir la charla</Link>;
  if (!r.mensajes.length) {
    return (
      <Bloque titulo={titulo} epico={epico} derecha={aBandeja}>
        <span className="fr-sub">{r.chatJid ? 'Todavía no hay mensajes.' : 'No hay una charla con este número.'}</span>
      </Bloque>
    );
  }
  const cuantos = diseno === 'hilo' ? 10 : diseno === 'tres' ? 3 : 1;
  return (
    <Bloque titulo={titulo} epico={epico} derecha={aBandeja}>
      <Mensajes lista={r.mensajes.slice(-cuantos)} ahora={ahora} />
    </Bloque>
  );
}

// ── La charla por DM ─────────────────────────────────────────────────────────

/** El usuario, si hoy se le puede escribir (la regla del canal) y los últimos mensajes. Sin charla, se calla. */
export function CharlaDm({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { dato: r, ahora } = useLectura(ctx.lead.id, charlaDmAction);
  if (r === 'cargando' || r === 'sin-charla') return null;
  if (r === null) return <NoPude titulo={titulo} epico={epico} que="sus mensajes directos" />;
  const ventana = r.puedeEscribir ? 'Se le puede escribir' : (r.motivoNoEscribir ?? 'No se le puede escribir');
  const quien = r.usuario ? `@${r.usuario}` : r.red;
  if (diseno === 'chip' && !epico) {
    return <Bloque titulo={titulo} epico={false}><span className="fr-chip" style={{ alignSelf: 'flex-start' }}>{quien} · {ventana}</span></Bloque>;
  }
  const lista = diseno === 'hilo' ? r.mensajes : r.mensajes.slice(-1);
  return (
    <Bloque titulo={titulo} epico={epico} derecha={<span className="fr-sub">{quien} · {ventana}</span>}>
      {lista.length ? <Mensajes lista={lista} ahora={ahora} /> : <span className="fr-sub">Todavía no hay mensajes.</span>}
    </Bloque>
  );
}

// ── El pase a humano ─────────────────────────────────────────────────────────

/** Cuándo y por qué MaKo le pasó la charla a una persona. Va arriba hasta que se resuelva; sin ninguno, se calla. */
export function PaseAHumanoBloque({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { dato: r, ahora } = useLectura<PaseAHumano[]>(ctx.lead.id, paseAHumanoAction);
  if (r === 'cargando' || (r !== null && !r.length)) return null;
  if (r === null) return <NoPude titulo={titulo} epico={epico} que="si MaKo lo pasó a una persona" />;
  const p = r[0];
  const abierto = !p.resuelto;
  const frase = abierto ? `MaKo te lo pasó ${hace(p.cuando, ahora)}` : `Se resolvió ${hace(p.resuelto, ahora)}`;
  return (
    <Bloque titulo={titulo} epico={epico} tono={abierto ? 'warn' : undefined}>
      {epico ? <p className="fr-frase">{frase}</p> : <span style={{ fontSize: 15, fontWeight: 650 }}>{frase}</span>}
      {(diseno === 'fila' || epico || abierto) && p.motivo && <span className="fr-sub">Por qué: {p.motivo}</span>}
      {diseno === 'fila' && p.mensaje && <span className="fr-sub">Su último mensaje: «{p.mensaje}»</span>}
    </Bloque>
  );
}

// ── Los cambios de MaKo ──────────────────────────────────────────────────────

/** Lo que MaKo quiere cambiar en este lead y espera que alguien confirme. Se confirma en «A revisar». */
export function CambiosDeMako({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { dato: r, ahora } = useLectura<CambioDeMako[]>(ctx.lead.id, cambiosDeMakoAction);
  if (r === 'cargando' || (r !== null && !r.length)) return null;
  if (r === null) return <NoPude titulo={titulo} epico={epico} que="lo que MaKo quiere cambiar" />;
  const aRevisar = <Link href="/mako/revisar" className="fr-link">Revisar</Link>;
  if (diseno === 'renglon' && !epico) {
    return <Bloque titulo={titulo} epico={false} derecha={aRevisar}><span className="fr-linea">{r.map((c) => c.titulo).join(' · ')}</span></Bloque>;
  }
  return (
    <Bloque titulo={titulo} epico={epico} derecha={aRevisar} tono="info">
      <div className="fr-props">
        {r.map((c) => (
          <div key={c.id} className="fr-prop">
            <span className="fr-k">{hace(c.cuando, ahora)}</span>
            <span className="fr-v">{c.titulo}{c.detalle ? <span className="fr-sub"> — {c.detalle}</span> : null}</span>
            <span />
          </div>
        ))}
      </div>
    </Bloque>
  );
}

// ── El mensaje listo ─────────────────────────────────────────────────────────

const ORIGEN: Record<string, string> = { nutricion: 'De una automatización', mako: 'De MaKo', manual: 'A mano', post_llamada: 'Después de la llamada' };

/** El mensaje que quedó escrito y nadie mandó. Se manda desde la bandeja de WhatsApp. */
export function MensajeListoBloque({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { dato: r, ahora } = useLectura<MensajeListo[]>(ctx.lead.id, mensajesListosAction);
  if (r === 'cargando' || (r !== null && !r.length)) return null;
  if (r === null) return <NoPude titulo={titulo} epico={epico} que="los mensajes listos" />;
  const lista = diseno === 'llamada' ? r.filter((m) => m.origen === 'post_llamada') : r;
  if (!lista.length) return null;
  const m = lista[0];
  const aMandar = <Link href={aLaCharla(m.chatJid)} className="fr-link">Revisar y mandar</Link>;
  if (diseno === 'renglon' && !epico) {
    return <Bloque titulo={titulo} epico={false} derecha={aMandar}><span className="fr-linea">{m.texto.slice(0, 140)}{m.texto.length > 140 ? '…' : ''}</span></Bloque>;
  }
  return (
    <Bloque titulo={titulo} epico={epico} derecha={aMandar}>
      <span className="fr-sub">{ORIGEN[m.origen ?? ''] ?? 'Sin mandar'} · {hace(m.cuando, ahora)}{lista.length > 1 ? ` · y ${lista.length - 1} más` : ''}</span>
      <span className="fr-linea" style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</span>
    </Bloque>
  );
}

// «Automatizaciones» (`automatizaciones-en-curso`) se mudó el 23/10/2026 a ./automatizaciones.tsx, con lo que pasa entero.

// ── Lo que le mandamos ───────────────────────────────────────────────────────

const CANAL: Record<string, string> = { whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram', sms: 'SMS' };

/** Los toques de las automatizaciones: cuántos, por canal, y cuántos abrió, clickeó o respondió. Sin ninguno, se calla. */
export function LoQueLeMandamosBloque({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { dato: r, ahora } = useLectura<LoQueLeMandamos>(ctx.lead.id, loQueLeMandamosAction);
  if (r === 'cargando' || (r !== null && !r.toques)) return null;
  if (r === null) return <NoPude titulo={titulo} epico={epico} que="lo que se le mandó" />;
  const resumen = [r.abiertos ? `${r.abiertos} abiertos` : null, r.clics ? `${r.clics} clics` : null, r.respuestas ? `${r.respuestas} respondidos` : null].filter(Boolean).join(' · ');
  if (diseno === 'canal' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        <div className="fr-chips">{Object.entries(r.porCanal).map(([c, n]) => <span key={c} className="fr-chip">{CANAL[c] ?? c}: {n}</span>)}</div>
        {resumen && <span className="fr-sub">{resumen}</span>}
      </Bloque>
    );
  }
  return (
    <Bloque titulo={titulo} epico={epico}>
      <span className={epico ? 'fr-p' : 'fr-num'}>{r.toques}</span>
      <span className="fr-sub">{r.toques === 1 ? 'toque' : 'toques'}{r.ultimo ? ` · el último ${hace(r.ultimo, ahora)}` : ''}{resumen ? ` · ${resumen}` : ''}</span>
    </Bloque>
  );
}
