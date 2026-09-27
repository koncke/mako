'use client';

// =============================================================================
// NuevoCliente — cargar un cliente que nunca pasó por el CRM
// =============================================================================
// «Falta un botón para cargar un nuevo cliente, no siempre estarán en el CRM. En dicho
// caso, claro, al cargarse se debería cargar en el CRM también» (26/09/2026).
//
// ⚠️ NO ES UN SEGUNDO LUGAR DONDE VIVE UN CLIENTE. Lo que se crea es un LEAD del CRM
// marcado como ganado, con la misma función (`createLead`) que usa `/crm/new`. Esta
// pantalla no tiene tabla propia: si la tuviera, habría clientes que el CRM no conoce y
// el día que alguien busque a uno por teléfono no lo va a encontrar.
//
// ⚠️ Y ES UNA PREGUNTA POR PANTALLA, con `WizardShell`, que es la pieza que ya usan el
// onboarding, las secuencias y el exportador. La regla es de la casa («un paso por
// pantalla») y acá además se gana algo concreto: el segundo paso puede EXIGIR un canal
// de contacto sin que eso se lea como un formulario que te reta por cuatro campos a la
// vez.

import { useState } from 'react';
// `wizardInput` es el input de la pieza: un estilo propio acá sería el segundo lugar
// donde vive la misma decisión, y el que se queda viejo.
import { WizardShell, wizardInput } from '@/app/_components/WizardShell';
import { crearClienteAction } from './actions';

type Paso = 0 | 1 | 2;

export function NuevoCliente({ onCerrar }: { onCerrar: () => void }) {
  const [paso, setPaso] = useState<Paso>(0);
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ⚠️ UN CANAL DE CONTACTO ES OBLIGATORIO, con la misma razón que `/crm/new`: un cliente
  // sin email NI teléfono es incontactable, y el dato se consigue justo en el momento de
  // cargarlo. Más tarde ya no está a mano.
  const hayContacto = Boolean(email.trim() || telefono.trim());
  const puedeAvanzar = paso === 0 ? nombre.trim().length > 1 : paso === 1 ? hayContacto : true;

  async function confirmar() {
    setPending(true); setError(null);
    const r = await crearClienteAction({ nombre, empresa, email, telefono });
    setPending(false);
    if (!r.ok) { setError(r.error ?? 'No se pudo cargar.'); return; }
    // La página es `force-dynamic` y la action revalida: recargar es lo que hace que el
    // cliente nuevo aparezca en la grilla con sus números, sin duplicar el estado acá.
    window.location.reload();
  }

  // ⚠️ `pasos` + `pasoActual` es el modo MAPA de `ProgresoWizard`, y es un XOR con
  // `total` + `idx`: pasar los cuatro no tipa. El mapa es mejor acá porque además nombra
  // el paso en el que estás, en vez de decir «2 de 3».
  //
  // (Y el comentario va ACÁ y no entre los atributos del JSX: tsc lo acepta ahí, pero ya
  // se cometieron dos errores de comentario mal ubicado en este mismo archivo hoy, y
  // ninguno de los dos se ve en el diff. Arriba del elemento no depende de qué parser lo
  // lea.)
  const pasos = ['Quién es', 'Cómo lo ubicas', 'Confirmar'];

  return (
    <WizardShell
      titulo="Nuevo cliente"
      pasos={pasos}
      pasoActual={pasos[paso]}
      pregunta={paso === 0 ? '¿Cómo se llama?' : paso === 1 ? '¿Cómo lo ubicas?' : '¿Lo cargo así?'}
      sub={paso === 1 ? 'Con un email o un teléfono alcanza.' : undefined}
      error={error}
      puedeAvanzar={puedeAvanzar}
      enUltimo={paso === 2}
      confirmLabel="Cargar el cliente"
      pending={pending}
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (paso === 0 ? onCerrar() : setPaso((p) => (p - 1) as Paso))}
      onSiguiente={() => setPaso((p) => (p + 1) as Paso)}
      onConfirmar={() => void confirmar()}
      onClose={onCerrar}
      ancho={520}
    >
      {paso === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellido" style={wizardInput} aria-label="Nombre del cliente" />
          <input value={empresa} onChange={(e) => setEmpresa(e.target.value)}
            placeholder="Su empresa (opcional)" style={wizardInput} aria-label="Empresa" />
        </div>
      )}

      {paso === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" type="email" style={wizardInput} aria-label="Email" />
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)}
            placeholder="Teléfono" type="tel" style={wizardInput} aria-label="Teléfono" />
        </div>
      )}

      {paso === 2 && (
        // El repaso dice QUÉ se va a crear y DÓNDE, porque lo segundo no es obvio: esto
        // escribe en el CRM, y quien carga un cliente desde acá puede no saberlo.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5 }}>
          <Fila k="Nombre" v={nombre.trim()} />
          {empresa.trim() && <Fila k="Empresa" v={empresa.trim()} />}
          {email.trim() && <Fila k="Email" v={email.trim()} />}
          {telefono.trim() && <Fila k="Teléfono" v={telefono.trim()} />}
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
            Se carga también en el CRM, con la venta marcada como ganada.
          </p>
        </div>
      )}
    </WizardShell>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ width: 92, flex: 'none', color: 'var(--faint)', fontSize: 13 }}>{k}</span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  );
}
