// =============================================================================
// /m/crm — el CRM en el teléfono: el «Hoy» del CRM + el buscador
// =============================================================================
// Reuniones de hoy y mañana CON HORA, los leads que esperan una decisión y los que
// se quedaron quietos en su etapa. Arriba, el buscador (en el server, ~20 filas).
// Closer y setter ven el CRM entero del workspace: no hay scoping por persona en el
// producto (los leads.closer/setter son nombres en texto libre) y aquí no se inventa.
// El kanban, la tabla, los filtros y las acciones en lote quedan en la computadora.
// =============================================================================

import './crm.css';
import { requireMovil } from '@/lib/movil-guard';
import { hoyDelCrm, type HoyCrm } from '@/lib/crm-movil';
import { PantallaM, SeccionM, FilaM, VacioM } from '@/app/m/_ui';
import { BuscadorCrm } from './BuscadorCrm';

export const dynamic = 'force-dynamic';

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** La frase de arriba: el número ADENTRO de la frase (nunca número gigante + label). */
function frase(h: HoyCrm): string {
  const hoy = (h.reuniones ?? []).filter((r) => r.dia === 'hoy').length;
  const esperan = (h.esperan ?? []).length;
  if (h.reuniones == null && h.esperan == null) return 'Tu CRM de hoy';
  if (!hoy && !esperan) return 'Hoy no tienes reuniones';
  const partes = [hoy ? plural(hoy, 'reunión', 'reuniones') : null, esperan ? plural(esperan, 'decisión', 'decisiones') : null].filter(Boolean);
  return `Hoy tienes ${partes.join(' y ')}`;
}

export default async function CrmMovil() {
  await requireMovil({ navKey: 'crm' });
  const h = await hoyDelCrm();

  return (
    <PantallaM titulo={frase(h)} actualizado={h.leidoEn} refrescable>
      <BuscadorCrm>
        <SeccionM titulo="Reuniones">
          {h.reuniones == null ? <VacioM frase="No pude leer las reuniones. Tira hacia abajo para reintentar." />
            : h.reuniones.length === 0 ? <VacioM frase="Sin reuniones hoy ni mañana." />
            : (
              <div className="m-lista">
                {h.reuniones.map((r) => (
                  <FilaM
                    key={`${r.leadId}-${r.cual}`}
                    titulo={r.nombre}
                    segunda={`${r.cual} · ${r.dia}`}
                    riel={r.hora ?? 'Sin hora'}
                    href={`/m/crm/${r.leadId}`}
                  />
                ))}
              </div>
            )}
        </SeccionM>

        <SeccionM titulo="Esperan decisión">
          {h.esperan == null ? <VacioM frase="No pude leer lo pendiente." />
            : h.esperan.length === 0 ? <VacioM frase="Nada pendiente de decidir." />
            : (
              <div className="m-lista">
                {h.esperan.map((e) => (
                  <FilaM key={e.leadId} titulo={e.nombre} segunda={e.frase} href={`/m/crm/${e.leadId}`} />
                ))}
              </div>
            )}
        </SeccionM>

        {/* Quietos sólo aparece si hay algo, o si no se pudo leer: un negocio sin plazos no tiene esta sección. */}
        {h.quietos == null ? (
          <SeccionM titulo="Quietos"><VacioM frase="No pude leer los leads quietos." /></SeccionM>
        ) : h.quietos.length > 0 && (
          <SeccionM titulo="Quietos">
            <div className="m-lista">
              {h.quietos.map((q) => (
                <FilaM
                  key={`${q.leadId}-${q.etapa}`}
                  titulo={q.nombre}
                  segunda={`Más de ${plural(q.plazo, 'día', 'días')} en ${q.etapa}`}
                  href={`/m/crm/${q.leadId}`}
                />
              ))}
            </div>
          </SeccionM>
        )}
      </BuscadorCrm>
    </PantallaM>
  );
}
