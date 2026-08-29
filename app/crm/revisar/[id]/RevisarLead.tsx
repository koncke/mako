'use client';

// =============================================================================
// Confirmar los contactos que propuso un canal
// =============================================================================
// La tabla es `TablaRevisionLeads`, LA MISMA que la del importador del CRM. El pedido
// del dueño fue textual: «SIEMPRE la preview de confirmación tiene que ser EXACTAMENTE
// igual a la preview cuando intento IMPORTAR un lead del CRM, que aparece como una
// tabla. Así sea 1 lead o los que sean».
//
// Y una sola fila sigue siendo una tabla, a propósito: el encabezado con los nombres de
// columna es lo que hace evidente qué valor cayó en qué campo, que es justo lo que hay
// que revisar cuando el dato lo transcribió un modelo.
// =============================================================================

import { useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { WizardShell } from '@/app/_components/WizardShell';
import { TablaRevisionLeads } from '@/app/crm/TablaRevisionLeads';
import { contar, recalcular, type FilaImport } from '@/app/crm/leads-importar';
import type { Propuesta } from '@/lib/propuestas';
import { confirmarLeadsAction, descartarLeadsAction } from './acciones';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Los leads propuestos, con la forma que espera la tabla del importador.
 *  Acepta el LOTE (`datos.leads`) y también la forma vieja de un lead suelto en la
 *  raíz: una propuesta ya guardada no se migra sola, y romperle el link a alguien que
 *  lo tiene abierto sería peor que estas tres líneas. */
function aFilas(datos: Record<string, unknown>): FilaImport[] {
  const crudos = Array.isArray(datos.leads) ? (datos.leads as Record<string, unknown>[]) : [datos];
  return recalcular(crudos.map((c, i) => ({
    id: `p${i}`,
    nombre: str(c.nombre),
    email: str(c.email),
    telefono: str(c.telefono),
    empresa: str(c.empresa),
    incluir: true,
    yaExiste: false,
  })));
}

export function RevisarLead({ prop }: { prop: Propuesta }) {
  const router = useRouter();
  // `recalcular` ya corrió en el inicializador: los descartes por «sin nombre» o
  // «repetido» tienen que estar marcados en el primer pintado, no después de tocar algo.
  const [filas, setFilas] = useState<FilaImport[]>(() => aFilas(prop.datos));
  const [trabajando, setTrabajando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Cada edición vuelve a pasar por `recalcular`: corregir un nombre vacío tiene que
  // sacarle la atenuación a esa fila en el acto, no al confirmar.
  const editar = (v: FilaImport[] | ((prev: FilaImport[]) => FilaImport[])) =>
    setFilas((prev) => recalcular(typeof v === 'function' ? v(prev) : v));

  const c = useMemo(() => contar(filas), [filas]);
  const origen = str(prop.datos.origen);
  const yaResuelta = prop.estado !== 'pendiente';

  const confirmar = async () => {
    setTrabajando(true); setErr(null);
    const r = await confirmarLeadsAction(prop.id, filas);
    if (!r.ok) { setErr(r.error); setTrabajando(false); return; }
    router.push('/crm');
  };

  const descartar = async () => {
    setTrabajando(true);
    await descartarLeadsAction(prop.id);
    router.push('/crm');
  };

  if (yaResuelta) {
    return (
      <WizardShell
        ancho={640}
        titulo="Esto ya se resolvió"
        pasos={['Revisar']} pasoActual="Revisar"
        pregunta={prop.estado === 'aplicada' ? 'Los contactos ya están en tu CRM' : 'Esta propuesta se descartó'}
        puedeAvanzar
        enUltimo
        confirmLabel="Ir al CRM"
        atrasLabel="Cerrar"
        onAtras={() => router.push('/crm')}
        onSiguiente={() => {}}
        onConfirmar={() => router.push('/crm')}
        onClose={() => router.push('/crm')}
      >
        <p style={{ margin: 0, textAlign: 'left', color: 'var(--dim)', lineHeight: 1.6 }}>{prop.resumen}</p>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      ancho={940}
      titulo={`Contactos propuestos · ${filas.length} fila${filas.length === 1 ? '' : 's'}`}
      pasos={['Revisar']} pasoActual="Revisar"
      pregunta="¿Está bien lo que va a entrar?"
      sub={`Lo propuso Claude${origen ? ` desde ${origen}` : ''}. Corregí lo que haga falta y tildá qué se crea.`}
      error={err}
      pending={trabajando}
      puedeAvanzar={c.tildadas > 0}
      enUltimo
      confirmLabel={c.tildadas > 0 ? `Crear ${c.tildadas} lead${c.tildadas === 1 ? '' : 's'} →` : 'No hay nada tildado'}
      atrasLabel="No sumarlos"
      onAtras={() => { void descartar(); }}
      onSiguiente={() => {}}
      onConfirmar={() => { if (c.tildadas > 0 && !trabajando) void confirmar(); }}
      onClose={() => router.push('/crm')}
    >
      <TablaRevisionLeads
        filas={filas}
        onFilas={editar}
        viaIA
        nota="Nada se creó todavía. Puedes corregir cualquier celda aquí mismo; las filas atenuadas no entran hasta que se resuelva su motivo."
      />
    </WizardShell>
  );
}
