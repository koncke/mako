// =============================================================================
// /crm/revisar — la bandeja de lo que dejó cada canal, esperando confirmación
// =============================================================================
// ⚠️ FALTABA, y su ausencia costó ocho leads reales.
//
// La regla del producto es «un canal PROPONE, una persona confirma», y estaba
// bien implementada: la propuesta se crea, la pantalla de confirmación existe.
// Lo que no existía era la LISTA. `propuestasPendientes()` vivía en
// `lib/propuestas.ts` desde el día uno con CERO call-sites, y la única forma de
// llegar a una propuesta era su link directo `/crm/revisar/<id>`.
//
// Para Claude y WhatsApp eso alcanzaba —el link vuelve por la misma
// conversación—, así que nadie notó el hueco. El formulario de una landing no
// tiene canal de vuelta: quien lo completa ve la página de gracias del cliente.
// Medido el 14/08/2026 en el workspace 11: cuatro leads REALES (Diana Vallin,
// Ibrahim Dosal, Marina Olvera, Magdiel Cortes) en `pendiente`, con nombre y
// teléfono, que nadie vio nunca.
//
// El aviso por WhatsApp que se agregó cubre lo que entra DE ACÁ EN ADELANTE.
// Esta pantalla es la que rescata lo que ya estaba, y la red para cuando un
// aviso no se manda, no llega o se lee y se olvida. Un aviso es un evento; una
// bandeja es un estado — y lo que se pierde siempre es lo que solo era un evento.
// =============================================================================

import { redirect } from 'next/navigation';
import Link from '@/app/_ui/Link';
import { Pagina } from '@/app/_ui';
import { getUsuarioActual } from '@/lib/auth';
import { propuestasPendientes, type Propuesta } from '@/lib/propuestas';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

/** Hace cuánto, en criollo. Una fecha ISO no dice «esto lleva tres días esperando». */
function hace(iso: string): { texto: string; viejo: boolean } {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return { texto: '', viejo: false };
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  // ⚠️ El umbral marca lo que se está ENFRIANDO. Un lead que dejó su teléfono
  // hace dos días y no recibió nada ya casi no se recupera, y esa es justamente
  // la fila que en una lista ordenada por fecha queda al final y no se mira.
  const viejo = h >= 24;
  if (d >= 1) return { texto: `hace ${d} ${d === 1 ? 'día' : 'días'}`, viejo };
  if (h >= 1) return { texto: `hace ${h} h`, viejo };
  return { texto: min >= 1 ? `hace ${min} min` : 'recién', viejo };
}

/** El contacto que trae la propuesta, para poder reconocerla sin abrirla. */
function contactoDe(p: Propuesta): string {
  const leads = (p.datos as { leads?: Array<Record<string, unknown>> } | null)?.leads ?? [];
  const l = leads[0] ?? {};
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return [s(l.telefono), s(l.email), s(l.empresa)].filter(Boolean).join(' · ');
}

export default async function BandejaPropuestasPage() {
  const sesion = await getUsuarioActual();
  if (!sesion) redirect(await rutaConWs('/inicio'));

  // Degrada a lista vacía en vez de romper: una bandeja caída no puede tumbar la
  // navegación del CRM. Lo que se pierde es la lista, no el acceso.
  const pendientes = await propuestasPendientes('lead').catch(() => [] as Propuesta[]);

  return (
    <Pagina>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>Contactos para revisar</h1>
      <p style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.55, maxWidth: '70ch' }}>
        Los leads de tu página ingresan solos. Aquí quedan los que <b>coinciden con un contacto que ya
        tienes</b>: unirlos no se puede deshacer y duplicarlos ensucia el CRM, así que esa decisión es tuya.
      </p>

      {pendientes.length === 0 ? (
        <div style={{ marginTop: 22, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface-2)', padding: '22px 24px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>No hay nada pendiente</div>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4, lineHeight: 1.55 }}>
            Quienes completan tu formulario ingresan directo al CRM. Aquí solo aparece un contacto si coincide con otro que ya tienes.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 20, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}>
          {pendientes.map((p, i) => {
            const t = hace(p.createdAt);
            const contacto = contactoDe(p);
            return (
              <Link
                key={p.id}
                href={`/crm/revisar/${p.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 17px', textDecoration: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 650, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.resumen || 'Contacto sin nombre'}
                  </span>
                  {contacto && (
                    <span style={{ display: 'block', fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {contacto}
                    </span>
                  )}
                </span>
                {/* El «hace cuánto» va en tinta normal y no en gris cuando ya se
                    está enfriando: el color no es el único portador, pero el que
                    lleva dos días esperando tiene que saltar a la vista. */}
                <span style={{ flex: 'none', fontSize: 12, fontWeight: t.viejo ? 700 : 500, color: t.viejo ? 'var(--bad)' : 'var(--faint)' }}>
                  {t.texto}
                </span>
                <span aria-hidden style={{ flex: 'none', color: 'var(--primary)', fontSize: 15, fontWeight: 700 }}>→</span>
              </Link>
            );
          })}
        </div>
      )}
    </Pagina>
  );
}
