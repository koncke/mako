'use client';

// =============================================================================
// La app de escritorio, primero: UNA pieza del chat común (23/10/2026; el cartel, 24/10/2026)
// =============================================================================
// Martín: «si detecta MaKo que no tienes instalado la app de escritorio, antes de mostrarte nada, o dejarte usar cualquier chat,
// en cualquier tab, te debe aparecer el botón para que puedas descargar la app». La monta el chat común (PiezasCliente.tsx →
// CajaDelCliente), así que vale igual en el Ops Center del cliente, la estrella de cada tab, el Second Brain y el teléfono. Qué
// hacer lo decide el servidor (lib/chat-mako-reglas.ts → appDeEscritorio, por `?suIA=1`):
//   · `bloquea` (sin computadora, aunque tenga su clave: «Bloqueá igual», Martín): el cartel EN EL LUGAR DE LA CAJA, y no se
//     puede mandar; se destraba solo cuando la computadora se conecta;
//   · `en-la-computadora` (el teléfono, que no la puede instalar): un aviso arriba de la caja, y el chat sigue.
// EL CARTEL (24/10/2026, Martín: «diseña bien ese cartel, no el botón feo que está al final del modal que no lo ve nadie»; el
// Cerebro: en el lugar donde está intentando escribir, la criatura de MaKo, una sola frase de qué le falta y qué gana, un botón que
// descarga, y nada más; un paso por pantalla). Antes iba en lugar de la conversación, con el recuadro de «Nuevo dispositivo» (dos
// botones, un aviso y un link). Ahora: la criatura, la frase y «Descargar MaKo para Windows» (o Mac); tocado, el paso siguiente —qué
// hacer con el instalador, lo que dice el sistema al abrirlo y «Ya lo instalé: conectar», que abre «Tus cuentas de IA» ahí mismo—.
// LA CAJA MISMA (24/10/2026, Martín: «Si no tengo instalada la app de desktop NO debe dejarme escribir nada, directamente en el chat
// donde está el botón de audio se debería reemplazar por "Instalar MaKo"»): ya no un cartel en lugar de la caja. La caja se ve, el
// campo apagado dice qué falta, y EN EL LUGAR DEL MICRÓFONO va «Instalar MaKo» (`useBloqueoApp` → `bloqueo` de CajaChat). Tocado,
// descarga, y el mismo lugar pasa a «Ya lo instalé: conectar» con el paso siguiente en el campo.
// LA DESCARGA Y LA DETECCIÓN DEL SISTEMA son de IA del cliente (app/integraciones/CuentasYDispositivos.tsx → DescargarMaKo): acá se
// montan, no se reescriben.

import { useState, type ReactNode } from 'react';
import './chat.css';
import { DescargarMaKo, avisoAlAbrir } from '@/app/integraciones/CuentasYDispositivos';
import { Icon } from '@/app/_components/icons';
import { FRASE_APP, FRASE_INSTALAR } from './app-de-escritorio';

// Las frases del campo apagado viven con la pregunta compartida (./app-de-escritorio.ts): las usan también las cajas con su
// propio motor (./useAppDeEscritorio.tsx).
export { FRASE_APP, FRASE_INSTALAR };
export const FRANJA_APP = 'Descarga MaKo en tu computadora: desde ahí trabaja con tu Claude.';

/**
 * El bloqueo de la caja sin la app: la frase del campo apagado y el botón que va EN EL LUGAR DEL MICRÓFONO. Antes de descargar,
 * «Instalar MaKo» (descarga el de esta computadora); después, «Ya lo instalé: conectar», que abre «Tus cuentas de IA» ahí mismo.
 */
export function useBloqueoApp(onConectar: () => void): { frase: string; boton: ReactNode } {
  const [descargado, setDescargado] = useState(false);
  return descargado ? {
    frase: FRASE_INSTALAR,
    boton: (
      <button type="button" className="co-instalar" onClick={onConectar} title={avisoAlAbrir()} data-app-primero="conectar">
        <Icon name="check" size={16} />Ya lo instalé: conectar
      </button>
    ),
  } : {
    frase: FRASE_APP,
    boton: (
      <DescargarMaKo className="co-instalar" texto="Instalar MaKo" onClick={() => setDescargado(true)}>
        <Icon name="descargar" size={16} />
      </DescargarMaKo>
    ),
  };
}

/** En el teléfono, arriba de la caja: la app se instala en la computadora, y acá el chat sigue. */
export function FranjaApp() {
  return <div className="ch-app-franja" role="note" data-app-franja="">{FRANJA_APP}</div>;
}
