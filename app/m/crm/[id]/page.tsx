// =============================================================================
// /m/crm/[id] — la ficha del lead en el teléfono (v2)
// =============================================================================
// Prototipo: docs/prototipos/mako-mobile-v2.html, data-ir="ficha". El encabezado es PROPIO
// (avatar grande, nombre, etapa y funnel), marcado con data-m-titulo-grande para que el nombre
// chico aparezca en la barra cuando se va al hacer scroll. Lo demás (tres botones, Datos,
// Notas, Actividad y sus sheets) va en FichaLead, que es de cliente porque las filas abren sheets.
// Pagos, cuotas, tracking, el historial completo, editar campos y el wizard de etapas viven en la
// computadora (una fila gris al final).
//
// ⚠️ maxDuration = 60: el sheet de agendar llama a reagendarReunionAction y a reservarR2Action,
// y las server actions heredan el techo de la PÁGINA que las monta. Reagendar puede tardar ~28 s
// (moverEvento en Google): sin esto la plataforma corta con la fila ya guardada y la pantalla dice
// que falló algo que se hizo.
// =============================================================================

import '../crm.css';
import { requireMovil } from '@/lib/movil-guard';
import { AvatarM, CabeceraM, PantallaM, PildoraM, VacioM } from '@/app/m/_ui';
import { fichaV2 } from '../datos';
import { FichaLead } from './FichaLead';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function FichaLeadMovil({ params }: { params: Promise<{ id: string }> }) {
  await requireMovil({ navKey: 'crm' });
  const { id: crudo } = await params;
  const id = Number(crudo);
  const d = Number.isInteger(id) && id > 0 ? await fichaV2(id) : null;
  if (!d) {
    return <VacioM frase="Ese lead no está en esta cuenta." accion={{ rotulo: 'Volver al CRM', href: '/m/crm' }} />;
  }
  const { f } = d;
  const casa = f.casa ?? f.productos[0] ?? null;
  const otros = f.productos.length - 1;

  return (
    <PantallaM refrescable>
      <CabeceraM titulo={f.nombre} grande={false} />
      <header className="m-crm-ficha" data-m-titulo-grande="">
        <AvatarM nombre={f.nombre} email={f.email} tam="xl" />
        <h1 className="m-crm-ficha__nombre">{f.nombre}</h1>
        {casa && (
          <div className="m-crm-ficha__sub">
            <PildoraM tono="info">{casa.etapaLabel ?? 'Sin etapa'}</PildoraM>
            <span>{casa.nombre}{otros > 0 ? ` +${otros}` : ''}</span>
          </div>
        )}
      </header>

      <FichaLead
        id={f.id}
        nombre={f.nombre}
        email={f.email}
        empresa={f.empresa}
        tel={f.tel}
        telefono={f.telefono ? (f.telefono.length > 10 ? `+${f.telefono}` : f.telefono) : null}
        waMe={f.waMe}
        tieneChat={!!f.chat}
        agenda={f.agenda}
        modoAgenda={f.modoAgenda}
        hoy={f.hoy}
        productos={f.productos}
        proxima={d.proxima}
        llegoPor={d.llegoPor}
        notas={d.notas}
        totalNotas={d.totalNotas}
        actividad={d.actividad}
        llamada={f.llamada ? {
          cuando: f.llamada.cuando, resultado: f.llamada.resultado, resumen: f.llamada.resumen,
          abiertas: f.llamada.abiertas, resueltas: f.llamada.resueltas, proximoPaso: f.llamada.proximoPaso,
        } : null}
        respuestas={f.respuestas}
      />
    </PantallaM>
  );
}
