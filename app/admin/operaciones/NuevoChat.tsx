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
//
// DESDE EL 17/10/2026 SE ABRE CON UN CLIC (docs/diseno-nuevo-chat-un-clic.md): «Abrir» firma un trabajo `nuevo` y la PC
// abre la ventana con el chat (cartero.mjs → `abrir`). El comando para pegar queda como segunda opción, más chica, para
// una cuenta cuyo Runner todavía no abre (`puedeAbrir`). El botón «Abrir» lo pone quien monta esto (el pie del modal o de
// la hoja); acá van el nombre, la cuenta, el primer mensaje y cómo va el último pedido.

import { Icon } from '@/app/_components/icons';
import { Field, Input, Textarea } from '@/app/_ui';
import { CUENTAS_TERMINAL, comandoNuevoChat } from '@/lib/runner';
import { nombreCuenta, nombreValido, primerMensajeNuevo } from '@/lib/centro-chats';
import { problemaDeNombreNuevo } from '@/lib/operaciones-reglas';
import { Muneco } from './Muneco';

/** El muñeco de un chat que todavía no existe: gris y transparente, como un lugar vacío. */
export function MunecoNuevo({ size = 38 }: { size?: number }) {
  return <span className="co-muneco-nuevo" aria-hidden><Muneco titulo="Nuevo chat" animo="dormido" size={size} /></span>;
}

/** `texto`: el primer mensaje (vacío = el de siempre, `primerMensajeNuevo`). */
export type BorradorNuevoChat = { nombre: string; cuenta: string; texto?: string };

/** ¿Este borrador se puede abrir con un clic? Nombre de la lista blanca y una cuenta cuyo Runner abre. */
export const sePuedeAbrir = (b: BorradorNuevoChat, puedeAbrir: boolean) =>
  puedeAbrir && problemaDeNombreNuevo(b.nombre.replace(/\s+/g, ' ').trim()) == null;

export function NuevoChat({ borrador, onCambio, onCopiar, puedeAbrir = false, estado = null }: {
  borrador: BorradorNuevoChat;
  onCambio: (b: BorradorNuevoChat) => void;
  /** Copiar el comando (y avisar). */
  onCopiar: (texto: string, aviso: string) => void;
  /** El Runner de esa cuenta abre chats (cartero 1.11.0): se ofrece «Abrir» y el primer mensaje. */
  puedeAbrir?: boolean;
  /** Cómo va el último que se pidió abrir (useCentro.ts → `apertura`). */
  estado?: string | null;
}) {
  const nombre = borrador.nombre.trim();
  const valido = nombreValido(nombre).ok;
  const comando = valido ? comandoNuevoChat(borrador.cuenta, nombre) : null;
  // Para abrirlo desde aquí el nombre va por una lista blanca (lib/operaciones-reglas.ts → NOMBRE_NUEVO_RE).
  const nombreParaAbrir = !nombre || problemaDeNombreNuevo(nombre.replace(/\s+/g, ' ')) == null;
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
      {puedeAbrir ? (
        <>
          <Field label="Su primer mensaje" hint="Opcional: si no escribes nada, lee AGENTS.md y espera">
            <Textarea rows={3} value={borrador.texto ?? ''} maxLength={8000} placeholder={primerMensajeNuevo(nombre || '…')}
              onChange={(e) => onCambio({ ...borrador, texto: e.target.value })} />
          </Field>
          {!nombreParaAbrir && <p className="co-nota co-nota--mal">Para abrirlo, sólo letras, números y espacios.</p>}
        </>
      ) : <p className="co-nota">Para abrirlo con un clic, falta el Runner nuevo en esa cuenta. Mientras, copia el comando.</p>}
      {estado && <p className="co-nota">{estado}</p>}
      {puedeAbrir && <p className="co-nota">O pégalo en PowerShell:</p>}
      {comando ? (
        <div className="co-runner__codigo">
          <pre>{comando}</pre>
          <button type="button" className="co-runner__copiar" onClick={() => onCopiar(comando, 'Copiado: pégalo en PowerShell')} aria-label="Copiar" title="Copiar">
            <Icon name="copy" size={15} />
          </button>
        </div>
      ) : <p className="co-nota">Escribe su nombre para armar el comando.</p>}
      {!puedeAbrir && <p className="co-nota">Pégalo en PowerShell para abrirlo: aparece aquí cuando arranca.</p>}
    </div>
  );
}
