'use client';

// =============================================================================
// La app de escritorio, primero: UNA pieza del chat común (23/10/2026)
// =============================================================================
// Martín: «si detecta MaKo que no tienes instalado la app de escritorio, antes de mostrarte nada, o dejarte usar cualquier chat,
// en cualquier tab, te debe aparecer el botón para que puedas descargar la app». La monta el chat común (PiezasCliente.tsx →
// HiloDelCliente y CajaDelCliente), así que vale igual en el Ops Center del cliente, la estrella de cada tab, el Second Brain y
// el teléfono. Qué hacer lo decide el servidor (lib/chat-mako-reglas.ts → appDeEscritorio, por `?suIA=1`):
//   · `bloquea` (sin computadora, aunque tenga su clave: «Bloqueá igual», Martín): la descarga en lugar de la conversación, y la
//     caja quieta; se destraba sola cuando la computadora se conecta;
//   · `en-la-computadora` (el teléfono, que no la puede instalar): un aviso arriba de la caja, y el chat sigue.
// LA DESCARGA Y LA DETECCIÓN DEL SISTEMA son de IA del cliente (app/integraciones/CuentasYDispositivos.tsx → NuevoDispositivo:
// Windows 0.4.0 o MaKo.app para la Mac 0.4.2, según la computadora): acá se monta, no se reescribe. «Ya lo instalé: conectar»
// abre «Tus cuentas de IA» (`setConectando`), donde se conecta.

import '@/app/integraciones/tus-cuentas-ia.css';
import './chat.css';
import { NuevoDispositivo } from '@/app/integraciones/CuentasYDispositivos';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';

export const TITULO_APP = 'Instala MaKo en tu computadora';
export const NOTA_APP = 'MaKo trabaja con tu Claude desde tu computadora. Descárgalo, instálalo y conéctalo: es un minuto.';
export const FRANJA_APP = 'Descarga MaKo en tu computadora: desde ahí trabaja con tu Claude.';

/** En lugar de la conversación: la criatura de MaKo y la descarga. */
export function AppPrimero({ onConectar }: { onConectar: () => void }) {
  return (
    <div className="co-portada ch-app-primero" data-app-primero="">
      <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={64} />
      <div className="ch-app-primero__caja">
        <NuevoDispositivo titulo={TITULO_APP} nota={NOTA_APP} onConectar={onConectar} />
      </div>
    </div>
  );
}

/** En el teléfono, arriba de la caja: la app se instala en la computadora, y acá el chat sigue. */
export function FranjaApp() {
  return <div className="ch-app-franja" role="note" data-app-franja="">{FRANJA_APP}</div>;
}
