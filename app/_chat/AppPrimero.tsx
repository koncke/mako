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
// LA DESCARGA Y LA DETECCIÓN DEL SISTEMA son de IA del cliente (app/integraciones/CuentasYDispositivos.tsx → DescargarMaKo): acá se
// montan, no se reescriben.

import { useState } from 'react';
import './chat.css';
import { DescargarElOtro, DescargarMaKo, avisoAlAbrir } from '@/app/integraciones/CuentasYDispositivos';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';

/** Lo que falta y lo que gana, en una frase: va en el lugar de la caja. */
export const FRASE_APP = 'Instala MaKo en tu computadora para escribirle: desde ahí trabaja con tu Claude.';
/** El paso siguiente, ya descargado. */
export const FRASE_INSTALAR = 'Abre lo que descargaste y sigue los pasos. Después, conecta tu computadora.';
export const FRANJA_APP = 'Descarga MaKo en tu computadora: desde ahí trabaja con tu Claude.';

/** En el lugar de la caja: la criatura de MaKo, qué falta y qué gana, y UN botón que descarga. Tocado, el paso siguiente. */
export function AppPrimero({ onConectar }: { onConectar: () => void }) {
  const [descargado, setDescargado] = useState(false);
  return (
    <div className="ch-app-cartel" role="note" data-app-primero="">
      <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={44} />
      <div className="ch-app-cartel__cuerpo">
        {!descargado ? (
          <>
            <p className="ch-app-cartel__frase">{FRASE_APP}</p>
            <DescargarMaKo className="ch-app-cartel__boton" onClick={() => setDescargado(true)} />
          </>
        ) : (
          <>
            <p className="ch-app-cartel__frase">{FRASE_INSTALAR}</p>
            <p className="ch-app-cartel__aviso">{avisoAlAbrir()}</p>
            <div className="ch-app-cartel__acciones">
              <button type="button" className="ch-app-cartel__boton" onClick={onConectar}>Ya lo instalé: conectar</button>
              <DescargarElOtro className="ch-app-cartel__otro" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** En el teléfono, arriba de la caja: la app se instala en la computadora, y acá el chat sigue. */
export function FranjaApp() {
  return <div className="ch-app-franja" role="note" data-app-franja="">{FRANJA_APP}</div>;
}
