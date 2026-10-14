// =============================================================================
// /m/chats — la pestaña Chats (v3, 14/10/2026): todos los chats, y «Sin responder» de un toque
// =============================================================================
// Martín (14/10/2026): «una tab de Chats con TODOS los chats integrados». En el escritorio es
// /whatsapp (el proxy manda acá en el teléfono: rutaMovil). Arriba el segmentado Todos · Sin
// responder (el valor vive en la URL: la página es de server); debajo, una fila por chat con el
// avatar, el último mensaje y hace cuánto. Tocar abre el hilo del lead (/m/crm/<id>/chat), que ya
// existe y se responde ahí.
//
// Tanda 1: sólo WhatsApp (ver ./datos.ts). Las bandejas de escritorio (Míos, Sin asignar, MaKo,
// por canal) llegan con los chats unificados.
// =============================================================================

import { requireMovil } from '@/lib/movil-guard';
import { ComputadoraM, ErrorM, FilaM, ListaM, PantallaM, SegmentadoM, VacioM } from '@/app/m/_ui';
import { RUTA_CHATS } from '@/lib/movil-rutas';
import { listaChats } from './datos';
import './chats.css';

export const dynamic = 'force-dynamic';

type Vista = 'todos' | 'sin';

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  await requireMovil({ navKey: 'whatsapp' });
  const vista: Vista = (await searchParams).ver === 'sin-responder' ? 'sin' : 'todos';
  const lista = await listaChats();

  if (!lista) {
    return <PantallaM refrescable><ErrorM frase="No pude leer los chats." /></PantallaM>;
  }
  const filas = vista === 'sin' ? lista.filas.filter((f) => f.sinResponder) : lista.filas;
  return (
    <PantallaM refrescable>
      <SegmentadoM<Vista>
        etiqueta="Chats"
        valor={vista}
        opciones={[
          { id: 'todos', label: 'Todos', href: RUTA_CHATS },
          { id: 'sin', label: 'Sin responder', n: lista.sinResponder || null, href: `${RUTA_CHATS}?ver=sin-responder` },
        ]}
      />
      <div className="m-chats-lista">
        {filas.length > 0 ? (
          <ListaM>
            {filas.map((f) => (
              <FilaM
                key={f.leadId}
                avatar={f.nombre}
                titulo={f.nombre}
                segunda={f.ultimo}
                riel={f.riel}
                href={`/m/crm/${f.leadId}/chat`}
                etiqueta={`${f.nombre}${f.sinResponder ? ', sin responder' : ''}: ${f.ultimo}`}
              />
            ))}
          </ListaM>
        ) : (
          <VacioM frase={vista === 'sin' ? 'Nadie espera respuesta.' : 'Todavía no hay chats.'} />
        )}
      </div>
      {lista.sinLead > 0 && vista === 'todos' && (
        <ComputadoraM que={lista.sinLead === 1 ? 'Un chat sin lead' : `${lista.sinLead} chats sin lead`} />
      )}
    </PantallaM>
  );
}
