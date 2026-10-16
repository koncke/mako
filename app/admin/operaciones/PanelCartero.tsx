'use client';

// =============================================================================
// El cartero — lo que antes era «Cartero y trabajos», sin el formulario de mandar (16/10/2026)
// =============================================================================
// Mandar un trabajo ya vive en la caja de cada conversación (Conversacion.tsx), y los trabajos se ven adentro
// de su chat. Acá queda lo que se mira una vez: qué cartero de cada cuenta está dando vueltas, la clave de
// ESTE dispositivo (que se carga a mano en la PC) y el token de los carteros. Como los ajustes de Codex y la
// cuenta de Claude: abajo de la barra, y se abre aparte.

import { useState } from 'react';
import { Button } from '@/app/_ui';
import { carteroVivo } from '@/lib/operaciones-reglas';
import { nombreCuenta } from '@/lib/centro-chats';
import { hace } from '@/lib/progreso-reglas';
import type { EstadoCarteros } from '@/lib/operaciones';
import type { ClaveDispositivo } from './clave-dispositivo';
import { crearTokenCarteroAction } from './acciones';

export function PanelCartero({ estado, clave, ahora, onCrearClave, onCopiar }: {
  estado: EstadoCarteros | null;
  clave: ClaveDispositivo | null | undefined;
  ahora: number;
  onCrearClave: () => void;
  onCopiar: (texto: string, aviso: string) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const carteros = estado?.carteros ?? [];
  const aceptada = !!clave && carteros.some((k) => k.claves.includes(clave.id));

  async function nuevoToken() {
    setError(null);
    const r = await crearTokenCarteroAction();
    if (r.ok) setToken(r.token); else setError(r.error);
  }

  return (
    <div className="co-cartero">
      <section>
        <p className="co-cartero__titulo">Carteros</p>
        {!estado && <p className="co-nota co-nota--mal">No pude leer los carteros.</p>}
        {estado && !carteros.length && <p className="co-nota">Ningún cartero dio una vuelta todavía.</p>}
        {carteros.map((k) => {
          const vivo = carteroVivo(k, ahora);
          const abiertos = k.chats.filter((c) => c.vivo).length;
          return (
            <div key={k.cuenta} className="co-cartero__fila">
              <span className={`co-punto co-punto--${vivo ? 'trabajando' : 'viejo'}`} aria-hidden />
              <span className="co-cartero__nombre">{nombreCuenta(k.cuenta)}</span>
              <span className="co-cartero__dato">
                {k.vistoAt ? `${vivo ? 'Pasó' : 'Sin señal desde'} ${hace(Date.parse(k.vistoAt), ahora)}` : 'Nunca pasó'}
                {` · ${abiertos} ${abiertos === 1 ? 'chat abierto' : 'chats abiertos'}`}
              </span>
            </div>
          );
        })}
      </section>

      <section>
        <p className="co-cartero__titulo">Este dispositivo</p>
        <div className="co-cartero__fila">
          {clave === null && <><span>Todavía no firma.</span><span className="co-cartero__dato"><Button size="sm" variant="secondary" onClick={onCrearClave}>Crear clave</Button></span></>}
          {clave && (
            <>
              <span className={`co-punto co-punto--${aceptada ? 'trabajando' : 'viejo'}`} aria-hidden />
              <span>{aceptada ? 'La PC acepta su clave' : 'La PC todavía no acepta su clave'}</span>
              <span className="co-cartero__dato">
                <Button size="sm" variant="tertiary" onClick={() => onCopiar(clave.spki, 'Clave copiada: pégala en el chat Cartero')}>Copiar clave</Button>
              </span>
            </>
          )}
        </div>
      </section>

      <section>
        <p className="co-cartero__titulo">Token de los carteros</p>
        <div className="co-cartero__fila">
          <span>{token ? 'Token nuevo: se ve una sola vez' : estado?.tokenPista ? `Termina en …${estado.tokenPista}` : 'Sin token'}</span>
          <span className="co-cartero__dato">
            {token
              ? <Button size="sm" variant="secondary" onClick={() => onCopiar(token, 'Token copiado')}>Copiar</Button>
              : <Button size="sm" variant="tertiary" onClick={nuevoToken}>{estado?.tokenPista ? 'Cambiar token' : 'Crear token'}</Button>}
          </span>
        </div>
        {error && <p className="co-nota co-nota--mal">{error}</p>}
      </section>
    </div>
  );
}
