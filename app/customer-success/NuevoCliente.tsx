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
import { Checkbox } from '@/app/_ui';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import { DIAL_DEFAULT, unirTelefono } from '@/lib/paises';
import { crearClienteAction } from './actions';

type Paso = 0 | 1 | 2;

export function NuevoCliente({ onCerrar, onCreado }: {
  onCerrar: () => void;
  /**
   * Quién nació, para que quien lo abrió pueda hacer algo con él.
   *
   * Lo usa el kanban de la entrega: el alta vive en CADA columna, así que el cliente
   * tiene que quedar en la etapa donde se apretó — un botón por columna que crea
   * siempre en la primera es un control que promete algo que no hace.
   *
   * ⚠️ SI SE PASA, EL MODAL NO RECARGA: quien lo recibe decide qué hacer y cuándo
   * refrescar. Recargar acá mataria la llamada que mueve al cliente a su etapa antes
   * de que salga, y el cliente aparecería en la primera columna sin que nada lo diga.
   */
  onCreado?: (leadId: number) => void;
}) {
  const [paso, setPaso] = useState<Paso>(0);
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [email, setEmail] = useState('');
  // ⚠️ EL TELÉFONO CON EL PAÍS PRIMERO (punto 5 del 12/10/2026: «en todos lados que pida telefono,
  // primero tiene que ir la numeración que ya tenemos con las banderas»). Va al server como los
  // dígitos con su código de país (`unirTelefono`), igual que el alta de un lead del CRM: este alta
  // también crea un lead, y sin lada su WhatsApp no matcheaba con nada.
  const [telLada, setTelLada] = useState(DIAL_DEFAULT);
  const [telNumero, setTelNumero] = useState('');
  const telefono = telNumero.replace(/\D/g, '') ? unirTelefono(telLada, telNumero) : '';
  // Un becado o bonificado (#747). Va en el paso de confirmar y no en uno propio: la
  // mayoría paga, y una pantalla más para todos sería fricción para el caso raro.
  const [sinCobro, setSinCobro] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ⚠️ UN CANAL DE CONTACTO ES OBLIGATORIO, con la misma razón que `/crm/new`: un cliente
  // sin email NI teléfono es incontactable, y el dato se consigue justo en el momento de
  // cargarlo. Más tarde ya no está a mano.
  const hayContacto = Boolean(email.trim() || telefono.trim());
  const puedeAvanzar = paso === 0 ? nombre.trim().length > 1 : paso === 1 ? hayContacto : true;

  async function confirmar() {
    setPending(true); setError(null);
    const r = await crearClienteAction({ nombre, empresa, email, telefono, sinCobro });
    setPending(false);
    if (!r.ok) { setError(r.error ?? 'No se pudo cargar.'); return; }
    if (onCreado && r.leadId) { onCreado(r.leadId); onCerrar(); return; }
    // Sin `onCreado`: la página es `force-dynamic` y la action revalida, así que recargar
    // es lo que hace que el cliente nuevo aparezca con sus números sin duplicar el estado.
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
          <TelefonoConPais lada={telLada} numero={telNumero} onLada={setTelLada} onNumero={setTelNumero}
            inputStyle={wizardInput} placeholder="Teléfono" anchoLada={112} />
        </div>
      )}

      {paso === 2 && (
        // El repaso dice QUÉ se va a crear y DÓNDE, porque lo segundo no es obvio: esto
        // escribe en el CRM, y quien carga un cliente desde acá puede no saberlo.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5 }}>
          <Fila k="Nombre" v={nombre.trim()} />
          {empresa.trim() && <Fila k="Empresa" v={empresa.trim()} />}
          {email.trim() && <Fila k="Email" v={email.trim()} />}
          {telefono && <Fila k="Teléfono" v={`${telLada} ${telNumero.trim()}`} />}
          <Checkbox checked={sinCobro} onChange={setSinCobro} label="Sin cobro" hint="Becado o bonificado." />
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
            Se carga también en el CRM, con la venta marcada como ganada{sinCobro ? ', sin cobro' : ''}.
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
