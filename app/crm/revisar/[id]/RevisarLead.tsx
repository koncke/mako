'use client';

// =============================================================================
// La pantalla de confirmar un lead propuesto
// =============================================================================
// EDITABLE, y ese es el punto: el dato pasó por un modelo, así que el momento de
// mirarlo tiene que ser también el momento de corregirlo. Una pantalla que solo
// dijera «¿confirmás?» obligaría a aceptar el teléfono mal y arreglarlo después en la
// ficha — o sea, a confirmar algo que se sabe equivocado.
//
// Los botones nombran su acción y su objeto, y el par de salidas dice qué pasa con
// cada una: es la regla de la casa contra los «Aceptar / Cancelar» a secas.
// =============================================================================

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Pagina, PageHeader, Section, Button, TextField, Status } from '@/app/_ui';
import { MONO } from '@/app/_ui/tokens';
import type { Propuesta } from '@/lib/propuestas';
import { confirmarLeadAction, descartarLeadAction } from './acciones';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function RevisarLead({ prop }: { prop: Propuesta }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(str(prop.datos.nombre));
  const [email, setEmail] = useState(str(prop.datos.email));
  const [telefono, setTelefono] = useState(str(prop.datos.telefono));
  const [empresa, setEmpresa] = useState(str(prop.datos.empresa));
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');

  const yaResuelta = prop.estado !== 'pendiente';
  const origen = str(prop.datos.origen);

  const confirmar = async () => {
    setTrabajando(true); setError('');
    const r = await confirmarLeadAction(prop.id, { nombre, email, telefono, empresa });
    if (!r.ok) { setError(r.error); setTrabajando(false); return; }
    router.push(`/crm/${r.leadId}`);
  };

  const descartar = async () => {
    setTrabajando(true);
    await descartarLeadAction(prop.id);
    router.push('/crm');
  };

  if (yaResuelta) {
    const idCreado = prop.resultado?.lead_id;
    return (
      <Pagina>
        <PageHeader titulo="Esto ya se resolvió" proposito={prop.estado === 'aplicada' ? 'El lead ya está en tu CRM.' : 'Esta propuesta se descartó.'} />
        <Section titulo={prop.resumen || 'La propuesta'}>
          {typeof idCreado === 'number'
            ? <Button variant="primary" onClick={() => router.push(`/crm/${idCreado}`)}>Ver el lead en el CRM</Button>
            : <Button variant="secondary" onClick={() => router.push('/crm')}>Ir al CRM</Button>}
        </Section>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <PageHeader
        titulo="¿Sumamos este contacto a tu CRM?"
        proposito="Lo propuso Claude. Revisá los datos —podés corregirlos— y confirmá."
      />

      <Section
        titulo="El contacto"
        nota={origen ? `Llegó desde ${origen}` : undefined}
        accion={<Status tono="info">Sin confirmar</Status>}
      >
        <div style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
          <TextField label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {/* El teléfono lleva su porqué al lado: es la llave con la que el lead matchea
              su chat de WhatsApp y su Calendly, y sin código de país queda huérfano de
              eso sin que nada avise. */}
          <TextField
            label="Teléfono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            hint="Con código de país (+54 9 11…). Es lo que lo conecta con su WhatsApp."
          />
          <TextField label="Empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
        </div>

        {error && <p style={{ marginTop: 14, color: 'var(--bad)', fontSize: 'var(--fs-sm)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="primary" onClick={() => void confirmar()} disabled={trabajando}>
            {trabajando ? 'Sumando…' : 'Sumar al CRM'}
          </Button>
          <Button variant="tertiary" onClick={() => void descartar()} disabled={trabajando}>
            No sumarlo
          </Button>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
            Si lo sumás, entra a tu CRM como un lead nuevo y te lo abrimos.
          </span>
        </div>
      </Section>

      <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>
        Propuesta {prop.id}
      </p>
    </Pagina>
  );
}
