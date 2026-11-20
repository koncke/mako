'use client';

// La tarjeta de contacto de MaKo en el chat del onboarding V2 (20/11/2026). En su propio archivo: la importa ChatArranqueV2 y se puede
// dibujar sola (sin el resto del chat) para mirarla.
import { WHATSAPP_MAKO } from '@/app/vsl/_sitio/contacto';
import { CriaturaMako } from './CriaturaMako';

/** El vCard de MaKo, para «Guardar contacto» (lo abre la libreta del teléfono; en la computadora se descarga). */
const VCARD_MAKO = `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:MaKo\r\nN:;MaKo;;;\r\nTEL;TYPE=CELL;waid=${WHATSAPP_MAKO.numero}:+${WHATSAPP_MAKO.numero}\r\nEND:VCARD\r\n`;

/**
 * LA TARJETA DE CONTACTO DE MAKO, EN EL CHAT (20/11/2026, el Cerebro: con el WhatsApp ya confirmado, «que MaKo lo diga y siga con el
 * contacto: la tarjeta, después "Guárdame en tus contactos…"»). En el camino del código la trae el WhatsApp junto con el código; con el
 * número ya confirmado no hay mensaje, así que va aquí, como la dibuja WhatsApp en la maqueta (`vcardMaKo`).
 */
export function TarjetaContactoMako() {
  return (
    <div data-contacto-mako="" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 360, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <span aria-hidden="true" style={{ flex: 'none' }}><CriaturaMako size={36} reaccion="escucha" /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 14.5, color: 'var(--ink)' }}>MaKo</b>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{WHATSAPP_MAKO.visible}</span>
      </span>
      <a className="arr-v2__link" href={`data:text/vcard;charset=utf-8,${encodeURIComponent(VCARD_MAKO)}`} download="MaKo.vcf" style={{ flex: 'none' }}>
        Guardar contacto
      </a>
    </div>
  );
}
