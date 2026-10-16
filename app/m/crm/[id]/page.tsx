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
// ⚠️ DESDE EL 15/10/2026 LO DE DEBAJO DEL ENCABEZADO SIGUE A LA FICHA DEL FUNNEL DEL LEAD: qué piezas y en
// qué orden lo decide la ficha que el admin arma en «Personalizar» (en la computadora), destilada a lo que
// tiene versión de teléfono (app/m/crm/ficha-bloques.ts). Y el encabezado suma «N sin marcar», el de la
// cabecera de escritorio, con el mismo número. Las dos cosas las lee `fichaV2` (../datos.ts).
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
import { piezasQueSeDibujan } from '../ficha-bloques';
import { FichaLead } from './FichaLead';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function FichaLeadMovil({ params }: { params: Promise<{ id: string }> }) {
  await requireMovil({ navKey: 'crm' });
  const { id: crudo } = await params;
  const id = Number(crudo);
  const d = Number.isInteger(id) && id > 0 ? await fichaV2(id) : null;
  if (!d) {
    return <PantallaM><VacioM frase="Ese lead no está en esta cuenta." accion={{ rotulo: 'Volver al CRM', href: '/m/crm' }} /></PantallaM>;
  }
  const { f, sinMarcar } = d;
  const casa = f.casa ?? f.productos[0] ?? null;
  const otros = f.productos.length - 1;

  return (
    <PantallaM>
      <CabeceraM titulo={f.nombre} grande={false} />
      <header className="m-crm-ficha" data-m-titulo-grande="">
        <AvatarM nombre={f.nombre} email={f.email} tam="xl" />
        <h1 className="m-crm-ficha__nombre">{f.nombre}</h1>
        {(casa || sinMarcar) && (
          <div className="m-crm-ficha__sub">
            {casa && <PildoraM tono="info">{casa.etapaLabel ?? 'Sin etapa'}</PildoraM>}
            {casa && <span>{casa.nombre}{otros > 0 ? ` +${otros}` : ''}</span>}
            {/* «N sin marcar» de la cabecera de escritorio, con el MISMO número (lib/datos-del-lead.ts). Sólo se
                lee: completar los datos es «en la computadora», como editar los campos. */}
            {sinMarcar ? <PildoraM tono="warn">{`${sinMarcar} sin marcar`}</PildoraM> : null}
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
        saldo={d.saldo}
        piezas={piezasQueSeDibujan(d.piezas, { proxima: d.proxima, llegoPor: d.llegoPor, respuestas: f.respuestas.length, llamada: !!f.llamada, saldo: d.saldo }).map((x) => x.pieza)}
      />
    </PantallaM>
  );
}
