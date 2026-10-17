'use client';

// =============================================================================
// «Nuevo chat» (16/10/2026): el renglón de arriba de los chats, y lo que hace falta para abrir uno
// =============================================================================
// Martín: «Falta la opción de "Nuevo chat" tipo placeholder arriba de todos los chats, con la figura de un muñeco
// también tipo placeholder, más opaco». Copiado del «New chat» de arriba de la barra de ChatGPT y de Claude (el primer
// renglón, con su ícono, antes de la lista), con el muñeco del Centro en gris y transparente.
//
// ⚠️ UN CHAT DE CLAUDE CODE LO ABRE UNA PERSONA EN SU PC (medido el 16/10/2026): una página web no abre una terminal, y
// start_session no está habilitada en esas sesiones. La pestaña de terminal de la app sí carga el perfil de PowerShell
// (`Get-Command claude2` da la función), pero la abre sólo una sesión de la app y Martín aprueba cada comando. Así que el
// Centro arma el COMANDO EXACTO —la función del perfil de esa cuenta, con el nombre puesto (lib/runner.ts →
// `comandoNuevoChat`)— y Martín lo pega en PowerShell. El chat aparece en la lista en la próxima vuelta del Runner, con
// su nombre, y adentro de su jefe si se llama «Jefe › Sub».
// ⚠️ La pieza de ADENTRO (sin modal ni hoja, sin hooks de más): la usan la computadora y el teléfono.

import { Icon } from '@/app/_components/icons';
import { Field, Input } from '@/app/_ui';
import { CUENTAS_TERMINAL, comandoNuevoChat } from '@/lib/runner';
import { nombreCuenta, nombreValido } from '@/lib/centro-chats';
import { Muneco } from './Muneco';

/** El muñeco de un chat que todavía no existe: gris y transparente, como un lugar vacío. */
export function MunecoNuevo({ size = 38 }: { size?: number }) {
  return <span className="co-muneco-nuevo" aria-hidden><Muneco titulo="Nuevo chat" animo="dormido" size={size} /></span>;
}

export type BorradorNuevoChat = { nombre: string; cuenta: string };

export function NuevoChat({ borrador, onCambio, onCopiar }: {
  borrador: BorradorNuevoChat;
  onCambio: (b: BorradorNuevoChat) => void;
  /** Copiar el comando (y avisar). */
  onCopiar: (texto: string, aviso: string) => void;
}) {
  const nombre = borrador.nombre.trim();
  const valido = nombreValido(nombre).ok;
  const comando = valido ? comandoNuevoChat(borrador.cuenta, nombre) : null;
  return (
    <div className="co-nuevo">
      <Field label="Nombre" hint="El de la tab, como «CRM», o un sub-chat de su jefe: «CRM › Funnels»">
        <Input data-autofocus value={borrador.nombre} maxLength={80} onChange={(e) => onCambio({ ...borrador, nombre: e.target.value })} />
      </Field>
      <div className="co-nuevo__cuentas" role="radiogroup" aria-label="Cuenta">
        {CUENTAS_TERMINAL.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={borrador.cuenta === c} className="co-chip" onClick={() => onCambio({ ...borrador, cuenta: c })}>
            {nombreCuenta(c)}
          </button>
        ))}
      </div>
      {comando ? (
        <div className="co-runner__codigo">
          <pre>{comando}</pre>
          <button type="button" className="co-runner__copiar" onClick={() => onCopiar(comando, 'Copiado: pégalo en PowerShell')} aria-label="Copiar" title="Copiar">
            <Icon name="copy" size={15} />
          </button>
        </div>
      ) : <p className="co-nota">Escribe su nombre para armar el comando.</p>}
      <p className="co-nota">Pégalo en PowerShell para abrirlo: aparece aquí cuando arranca.</p>
    </div>
  );
}
