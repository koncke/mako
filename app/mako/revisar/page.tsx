// =============================================================================
// /mako/revisar — la bandeja de las propuestas de acción GENÉRICAS
// =============================================================================
// Una acción `pantalla` sin pantalla propia (lib/api-mako) deja una fila en
// `propuestas` con tipo 'accion' y un link a /mako/revisar/<id>. Para WhatsApp
// y la API el link vuelve por la misma conversación; esta lista es la red para
// el link que no se abrió — la misma lección que costó ocho leads en /crm/revisar.
//
// Las otras dos bandejas (contactos, borradores de tareas) tienen la suya; acá
// se linkean para que «lo que espera tu confirmación» tenga una sola puerta.
// =============================================================================

import Link from '@/app/_ui/Link';
import { Pagina, PageHeader, Section, Mako } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { propuestasPendientes, type Propuesta } from '@/lib/propuestas';
import { PANTALLA_DE_PROPUESTA, rutaDePropuesta } from '@/lib/propuestas-tipos';
import { porId } from '@/lib/api-mako/registro';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Hace cuánto, en criollo. Una fecha ISO no dice «esto lleva dos días esperando». */
function hace(iso: string): { texto: string; viejo: boolean } {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return { texto: '', viejo: false };
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  const viejo = h >= 24;
  if (d >= 1) return { texto: `hace ${d} ${d === 1 ? 'día' : 'días'}`, viejo };
  if (h >= 1) return { texto: `hace ${h} h`, viejo };
  return { texto: min >= 1 ? `hace ${min} min` : 'recién', viejo };
}

const ORIGEN: Record<string, string> = { whatsapp: 'por WhatsApp', claude: 'por la API', app: 'desde el chat de la app' };

const OTRAS_BANDEJAS = [
  { href: PANTALLA_DE_PROPUESTA.lead.bandeja, nombre: PANTALLA_DE_PROPUESTA.lead.nombre, que: 'Leads que un canal propuso sumar al CRM.' },
  { href: '/plan', nombre: 'Borradores de tareas', que: 'Tareas que MaKo armó a partir de reuniones o de WhatsApp, esperando tus respuestas.' },
  { href: '/mako/pendientes', nombre: 'Acciones pendientes', que: 'Cambios chicos que MaKo propuso por chat y esperan un «sí».' },
];

export default async function BandejaAccionesPage() {
  await requireRolWs([], { nav: 'mako' });

  // Degrada a lista vacía en vez de romper: una bandeja caída no puede tumbar la navegación.
  const pendientes = await propuestasPendientes('accion').catch(() => [] as Propuesta[]);

  return (
    <Pagina>
      <PageHeader
        titulo="Acciones para revisar"
        proposito="Lo que MaKo propuso con datos que conviene mirar antes de ejecutar: montos, textos, creaciones con varios campos. Abre cada una, corrige lo que haga falta y confirma."
        estado={pendientes.length ? <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>{pendientes.length} esperando</span> : null}
      />

      {pendientes.length === 0 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface-2)', padding: '22px 24px' }}>
          <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)' }}>No hay propuestas para revisar</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 4, lineHeight: 1.55 }}>
            Cuando MaKo proponga una acción con formulario, aparece aquí con su link hasta que la confirmes o la descartes.
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface)', overflow: 'hidden' }}>
          {pendientes.map((p, i) => {
            const t = hace(p.createdAt);
            const opId = String(p.datos.operacion ?? '');
            const titulo = porId(opId)?.titulo ?? opId;
            const origen = p.origen ? (ORIGEN[p.origen] ?? p.origen) : '';
            return (
              <Link
                key={p.id}
                href={rutaDePropuesta(p.tipo, p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 17px', textDecoration: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.resumen || titulo}
                    </span>
                    <Mako estado="aprobacion" compacto />
                  </span>
                  <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {titulo}{origen ? ` · ${origen}` : ''}
                  </span>
                </span>
                {/* El «hace cuánto» salta a la vista cuando lleva más de un día: es la fila que
                    en una lista por fecha queda al final y no se mira. */}
                <span style={{ flex: 'none', fontSize: 'var(--fs-meta)', fontWeight: t.viejo ? 700 : 500, color: t.viejo ? 'var(--bad)' : 'var(--faint)' }}>
                  {t.texto}
                </span>
                <span aria-hidden style={{ flex: 'none', color: 'var(--primary)', fontSize: 15, fontWeight: 700 }}>→</span>
              </Link>
            );
          })}
        </div>
      )}

      <Section titulo="Otras bandejas" nota="Todo lo que espera tu confirmación, por tipo.">
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface)', overflow: 'hidden' }}>
          {OTRAS_BANDEJAS.map((b, i) => (
            <Link
              key={b.href}
              href={b.href}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 17px', textDecoration: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
            >
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)' }}>{b.nombre}</span>
                <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2 }}>{b.que}</span>
              </span>
              <span aria-hidden style={{ flex: 'none', color: 'var(--primary)', fontSize: 15, fontWeight: 700 }}>→</span>
            </Link>
          ))}
        </div>
      </Section>
    </Pagina>
  );
}
