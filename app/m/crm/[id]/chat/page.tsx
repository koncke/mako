// =============================================================================
// /m/crm/[id]/chat — el WhatsApp del lead, por la línea del negocio (v2)
// =============================================================================
// Pantalla de TRABAJO (sin título grande, el nombre en la barra y sin la barra de abajo): se
// llega desde «WhatsApp» en la ficha. Los últimos 40 mensajes del espejo (wa_mensajes) para
// ESE chat y ESA línea, en burbujas claras como el prototipo (las suyas en --surface, las
// propias en --primary-bg), y un composer de texto que contesta por la misma línea. Sin audio
// en esta tanda. Si el lead nunca escribió por la línea no oficial, se ofrece wa.me —y se
// dice: abre el WhatsApp del TELÉFONO, no la línea del negocio, y esa charla no queda en MaKo—.
// =============================================================================

import '../../crm.css';
import { requireMovil } from '@/lib/movil-guard';
import { hiloWhatsApp, type HiloM } from '@/lib/crm-movil';
import { CabeceraM, PantallaM, VacioM } from '@/app/m/_ui';
import { ComposerChat } from './ComposerChat';

export const dynamic = 'force-dynamic';

const dia = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(/\./g, '');
const hora = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

function Mensajes({ h }: { h: HiloM }) {
  let ultimoDia = '';
  return (
    <div className="m-crm-hilo" aria-live="polite">
      {h.mensajes.map((m) => {
        const d = m.cuando ? dia(m.cuando, h.tz) : '';
        const corte = d && d !== ultimoDia;
        if (d) ultimoDia = d;
        return (
          <div key={m.id} style={{ display: 'contents' }}>
            {corte && <span className="m-crm-hilo__dia">{d}</span>}
            <div className={`m-crm-burbuja ${m.deMi ? 'm-crm-burbuja--mia' : 'm-crm-burbuja--suya'}${m.sinTexto ? ' m-crm-burbuja--sin' : ''}`}>
              {m.texto}
              {m.cuando && <span className="m-crm-burbuja__hora">{hora(m.cuando, h.tz)}</span>}
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
  if (fallo) return <PantallaM><VacioM frase="No pude leer el chat. Vuelve a intentar en un momento." accion={{ rotulo: 'Volver a la ficha', href: `/m/crm/${id}` }} /></PantallaM>;
  if (!h) return <PantallaM><VacioM frase="Ese lead no está en esta cuenta." accion={{ rotulo: 'Volver al CRM', href: '/m/crm' }} /></PantallaM>;

  return (
    <PantallaM>
      <CabeceraM titulo={h.nombre} trabajo padre={{ href: `/m/crm/${h.leadId}`, label: 'Ficha' }} />
      {h.chat ? (
        <>
          {h.mensajes.length ? <Mensajes h={h} /> : <VacioM frase="Todavía no hay mensajes en este chat." />}
          <ComposerChat leadId={h.leadId} chatJid={h.chat.chatJid} telefono={h.chat.telefono} linea={h.chat.linea} />
        </>
      ) : (
        <VacioM
          frase={h.waMe ? 'No escribió a la línea del negocio. El WhatsApp de tu teléfono no queda en MaKo.' : 'El lead no tiene un número de WhatsApp.'}
          accion={h.waMe ? { rotulo: 'Abrir WhatsApp de mi teléfono', href: h.waMe } : undefined}
        />
      )}
    </PantallaM>
  );
}
