// =============================================================================
// /m/crm/[id]/chat — el hilo de WhatsApp del lead, por la línea del negocio
// =============================================================================
// Los últimos 40 mensajes del espejo (wa_mensajes) para ESE chat y ESA línea, y un
// composer de texto que contesta por la misma línea. Sin audio en esta tanda. Si el
// lead nunca escribió por la línea no oficial, se ofrece wa.me como segunda opción
// —y se dice: abre el WhatsApp del TELÉFONO, no la línea del negocio, y esa charla
// no queda en MaKo—.
// =============================================================================

import '../../crm.css';
import { requireMovil } from '@/lib/movil-guard';
import { hiloWhatsApp, type HiloM } from '@/lib/crm-movil';
import { CabeceraM, VacioM } from '@/app/m/_ui';
import { ComposerChat } from './ComposerChat';

export const dynamic = 'force-dynamic';

const dia = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(/\./g, '');
const hora = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

function Mensajes({ h }: { h: HiloM }) {
  let ultimoDia = '';
  return (
    <div className="mc-hilo" aria-live="polite">
      {h.mensajes.map((m) => {
        const d = m.cuando ? dia(m.cuando, h.tz) : '';
        const corte = d && d !== ultimoDia;
        if (d) ultimoDia = d;
        return (
          <div key={m.id} style={{ display: 'contents' }}>
            {corte && <span className="mc-dia">{d}</span>}
            <div className={`mc-burbuja ${m.deMi ? 'mc-burbuja--yo' : 'mc-burbuja--ella'}${m.sinTexto ? ' mc-burbuja--sin' : ''}`}>
              {m.texto}
              {m.cuando && <span className="mc-burbuja__hora">{hora(m.cuando, h.tz)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function ChatLeadMovil({ params }: { params: Promise<{ id: string }> }) {
  await requireMovil({ navKey: 'crm' });
  const { id: crudo } = await params;
  const id = Number(crudo);
  let h: HiloM | null = null;
  let fallo = false;
  if (Number.isInteger(id) && id > 0) {
    try { h = await hiloWhatsApp(id); } catch (e) {
      fallo = true;
      console.error(`[m/crm/chat] ${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (fallo) return <VacioM frase="No pude leer el chat. Vuelve a intentar en un momento." accion={{ rotulo: 'Volver a la ficha', href: `/m/crm/${id}` }} />;
  if (!h) return <VacioM frase="Ese lead no está en esta cuenta." accion={{ rotulo: 'Volver al CRM', href: '/m/crm' }} />;

  return (
    <>
      <CabeceraM titulo={h.nombre} padre={{ href: `/m/crm/${h.leadId}`, label: 'Ficha' }} />
      {h.chat ? (
        <>
          {h.mensajes.length ? <Mensajes h={h} /> : <VacioM frase="Todavía no hay mensajes en este chat." />}
          <ComposerChat leadId={h.leadId} chatJid={h.chat.chatJid} telefono={h.chat.telefono} linea={h.chat.linea} />
        </>
      ) : (
        <VacioM
          frase={h.waMe ? 'No escribió a la línea del negocio. WhatsApp de tu teléfono no queda en MaKo.' : 'El lead no tiene un número de WhatsApp.'}
          accion={h.waMe ? { rotulo: 'Abrir WhatsApp de mi teléfono', href: h.waMe } : undefined}
        />
      )}
    </>
  );
}
