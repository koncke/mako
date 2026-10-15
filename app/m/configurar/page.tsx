// =============================================================================
// /m/configurar — el onboarding sin terminar, en el teléfono
// =============================================================================
// La regla de la casa (lib/onboarding-state.ts): sin `done` no se entra a los
// datos, bajo ningún motivo. Todo /m rebota acá mientras falte (lo hace
// `requireMovil`), y esta pantalla dice UNA cosa y ofrece la salida.
//
// ⚠️ NO SE REARMA EL WIZARD EN /m: el de escritorio (/onboarding) pide subir
// documentos, la key de Gemini y conectar Meta, y nunca se verificó a 390 px.
// «Abrir la configuración» lleva a ése (con el `?ws=` de la pestaña).
//
// ⚠️ Y LA SALIDA DEPENDE DE QUIÉN MIRA. El super admin o la agencia que entra a
// un cliente sin configurar también cae acá (el onboarding es del CLIENTE), y para
// él «Cerrar sesión» es la salida equivocada: lo que necesita es salir de la vista.
// Sin esto quedaba encerrado — todo /m rebota acá, Perfil incluido.
// =============================================================================

import { redirect } from 'next/navigation';
import { ButtonLink } from '@/app/_ui/Button';
import { PantallaM } from '@/app/m/_ui';
import { requireMovil, salidaDeVista } from '@/lib/movil-guard';
import { onboardingPendiente } from '@/lib/onboarding-state';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { SalirDeLaVista } from '../_ui/SalirDeLaVista';
import { CerrarSesion } from '../_ui/CerrarSesion';

export const dynamic = 'force-dynamic';

export default async function Configurar() {
  const ctx = await requireMovil({ onboarding: false });
  // Si ya está configurada, acá no hay nada que hacer.
  if (!(await onboardingPendiente())) redirect(await rutaConWs(HOME_MOVIL));
  const salida = await salidaDeVista();
  const frase = ctx.impersonando && ctx.clienteNombre
    ? `Falta configurar la cuenta de ${ctx.clienteNombre}.`
    : 'Termina de configurar tu cuenta para empezar.';

  // Refrescar acá sirve: si ya la configuró en la computadora, la página lo ve y lleva al inicio.
  return (
    <PantallaM>
      <div className="m-configurar">
        <p className="m-configurar__frase">{frase}</p>
        <div className="m-configurar__acciones">
          <ButtonLink href="/onboarding" variant="primary" size="lg" full>Abrir la configuración</ButtonLink>
          {salida
            ? <SalirDeLaVista salida={salida.salida} modoAgencia={salida.modoAgencia} variante="tertiary" />
            : <CerrarSesion />}
        </div>
      </div>
    </PantallaM>
  );
}
