'use client';

// =============================================================================
// Los Runners — lo que antes era «Cartero», copiado de GitHub (15/10/2026)
// =============================================================================
// Martín (15/10/2026): «No quiero que se llame más "cartero", sino un nombre más formal, tecnico...
// profesional» y «mejora el diseño de ese modal». Copiado de GitHub → Settings → Actions → Runners, mirado en
// su Chrome ese día (hola-mako/dashboard-marketing):
//   · la LISTA: una caja con un renglón por runner —su punto de estado, el nombre, sus etiquetas como chips y el
//     estado a la derecha— y arriba a la derecha el botón primario «New self-hosted runner»; sin runners, la caja
//     dice qué hacer y para qué;
//   · el ALTA («Add new self-hosted runner»): pasos con su título en negrita y un bloque de código con lo que hay
//     que pegar (Download · Configure · Using). Acá son tres: el chat, su token y el Token de este dispositivo.
// Lo de GitHub que no aplica no se copió: la imagen y la arquitectura (el Runner corre adentro de un chat).
//
// ⚠️ Cada texto dice qué hacer y para qué (Martín: «Jamás pongas mensajes no claros como "Este dispositivo todavía
// no firma."»). El Token de este dispositivo es la clave de firma (clave-dispositivo.ts); el token del Runner es
// el que lo conecta con MaKo (`crearTokenCartero`). Son dos y no se confunden: uno es TUYO y el otro es SUYO.
// ⚠️ En el código, la base y la PC el Runner sigue siendo el cartero (lib/runner.ts).

import { useState } from 'react';
import { Button } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { carteroVivo } from '@/lib/operaciones-reglas';
import { nombreCuenta } from '@/lib/centro-chats';
import { hace } from '@/lib/progreso-reglas';
import { COMANDO_TERMINAL, INSTRUCCIONES_RUNNER } from '@/lib/runner';
import type { EstadoCarteros } from '@/lib/operaciones';
import type { ClaveDispositivo } from './clave-dispositivo';
import { crearTokenCarteroAction } from './acciones';

export type VistaRunner = 'lista' | 'nuevo';

type Props = {
  estado: EstadoCarteros | null;
  clave: ClaveDispositivo | null | undefined;
  ahora: number;
  onCrearClave: () => void;
  onCopiar: (texto: string, aviso: string) => void;
};

/** El título del modal: «Runners», o la miga de GitHub en el alta («Runners / Nuevo Runner»). */
export function TituloRunner({ vista, onVista }: { vista: VistaRunner; onVista: (v: VistaRunner) => void }) {
  if (vista === 'lista') return <>Runners</>;
  return (
    <span className="co-runner__miga">
      <button type="button" onClick={() => onVista('lista')}>Runners</button>
      <span aria-hidden>/</span>
      Nuevo Runner
    </span>
  );
}

/** El Token de ESTE dispositivo: qué hacer con él, en un renglón. */
function TuToken({ clave, aceptada, onCrearClave, onCopiar }: Pick<Props, 'clave' | 'onCrearClave' | 'onCopiar'> & { aceptada: boolean }) {
  if (clave === undefined) return <div className="co-runner__fila co-runner__fila--quieta" aria-busy="true">&nbsp;</div>;
  if (clave === null) {
    return (
      <div className="co-runner__fila">
        <span className="co-punto co-punto--viejo" aria-hidden />
        <span className="co-runner__nombre">Crea tu Token para comenzar a chatear</span>
        <span className="co-runner__fin"><Button size="sm" onClick={onCrearClave}>Crear Token</Button></span>
      </div>
    );
  }
  const copiar = () => onCopiar(clave.spki, 'Copiado: pégalo en el Runner');
  return (
    <div className="co-runner__fila">
      <span className={`co-punto co-punto--${aceptada ? 'trabajando' : 'viejo'}`} aria-hidden />
      <span className="co-runner__nombre">{aceptada ? 'Tu Token' : 'Pégale tu Token al Runner para comenzar a chatear'}</span>
      {aceptada && <span className="co-runner__estado">Activo</span>}
      <span className="co-runner__fin">
        <Button size="sm" variant={aceptada ? 'tertiary' : 'secondary'} icon={<Icon name="copy" size={14} />} onClick={copiar}>Copiar Token</Button>
      </span>
    </div>
  );
}

function Lista({ estado, clave, ahora, onCrearClave, onCopiar, onNuevo }: Props & { onNuevo: () => void }) {
  const runners = estado?.carteros ?? [];
  const aceptada = !!clave && runners.some((k) => k.claves.includes(clave.id));
  const activos = runners.filter((k) => carteroVivo(k, ahora)).length;
  return (
    <div className="co-runner">
      {/* Como la cabecera de GitHub: el número a la izquierda, el botón primario a la derecha. */}
      <div className="co-runner__barra">
        {runners.length > 0 && <span className="co-runner__cuenta">{`${activos} de ${runners.length} activos`}</span>}
        <Button size="sm" onClick={onNuevo}>Nuevo Runner</Button>
      </div>
      <div className="co-runner__caja" role="list" aria-label="Runners">
        {!estado && <p className="co-runner__vacio">No pude leer los Runners: reintenta en un momento.</p>}
        {estado && !runners.length && (
          <div className="co-runner__vacio">
            <p className="co-runner__vacio-titulo">Conecta tu primer Runner</p>
            <p>Entrega lo que escribes a los chats de tu PC.</p>
          </div>
        )}
        {runners.map((k) => {
          const vivo = carteroVivo(k, ahora);
          const abiertos = k.chats.filter((c) => c.vivo).length;
          // Abierta en la TERMINAL sin un Runner en SU carpeta: el de otra carpeta no le llega (lib/runner.ts). Uno de la
          // app sin Runner se arregla abriendo el de la app, no con este comando: no se cuenta acá.
          const sinRunner = k.chats.filter((c) => c.vivo && c.runner === false && c.local.startsWith('cli_')).length;
          const comando = COMANDO_TERMINAL(k.cuenta);
          return (
            <div key={k.cuenta} className="co-runner__fila" role="listitem">
              <span className={`co-punto co-punto--${vivo ? 'trabajando' : 'viejo'}`} aria-hidden />
              <span className="co-runner__nombre">
                {nombreCuenta(k.cuenta)}
                {!vivo && <span className="co-runner__hacer">{`Escribe «${comando}» en PowerShell para conectarlo`}</span>}
                {vivo && sinRunner > 0 && (
                  <span className="co-runner__hacer">{`Escribe «${comando}» en PowerShell para llegarle a su terminal`}</span>
                )}
              </span>
              {vivo && <span className="co-runner__etiqueta">{`${abiertos} ${abiertos === 1 ? 'chat abierto' : 'chats abiertos'}`}</span>}
              <span className="co-runner__estado" title={k.vistoAt ? `Se conectó ${hace(Date.parse(k.vistoAt), ahora)}` : undefined}>
                {vivo ? 'Activo' : k.vistoAt ? `Sin conexión · ${hace(Date.parse(k.vistoAt), ahora)}` : 'Sin conexión'}
              </span>
            </div>
          );
        })}
      </div>

      <p className="co-runner__seccion">Este dispositivo</p>
      <div className="co-runner__caja">
        <TuToken clave={clave} aceptada={aceptada} onCrearClave={onCrearClave} onCopiar={onCopiar} />
      </div>
    </div>
  );
}

/** Un bloque de código como los de GitHub, con su botón de copiar. */
function Codigo({ texto, aviso, onCopiar, alto }: { texto: string; aviso: string; onCopiar: Props['onCopiar']; alto?: number }) {
  return (
    <div className="co-runner__codigo">
      <pre style={alto ? { maxHeight: alto } : undefined}>{texto}</pre>
      <button type="button" className="co-runner__copiar" onClick={() => onCopiar(texto, aviso)} aria-label="Copiar" title="Copiar">
        <Icon name="copy" size={15} />
      </button>
    </div>
  );
}

function Nuevo({ estado, clave, onCrearClave, onCopiar }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const runners = estado?.carteros ?? [];
  const aceptada = !!clave && runners.some((k) => k.claves.includes(clave.id));

  async function nuevoToken() {
    setError(null);
    setCreando(true);
    const r = await crearTokenCarteroAction();
    setCreando(false);
    if (r.ok) setToken(r.token); else setError(r.error);
  }

  return (
    <div className="co-runner">
      <section className="co-runner__paso">
        <p className="co-runner__paso-titulo"><span>1</span>Ábrelo en la terminal</p>
        <p>Abre PowerShell, escribe <code>{COMANDO_TERMINAL('claude2')}</code> (claude1 o claude3 para las otras cuentas, uno por cuenta) y pégale esto.</p>
        <Codigo texto={INSTRUCCIONES_RUNNER} aviso="Copiado: pégalo en el chat Runner" onCopiar={onCopiar} alto={150} />
      </section>

      <section className="co-runner__paso">
        <p className="co-runner__paso-titulo"><span>2</span>Conéctalo a MaKo</p>
        {token ? (
          <>
            <p>Pégale este token al Runner para conectarlo. Se ve una sola vez.</p>
            <Codigo texto={token} aviso="Copiado: pégalo en el Runner" onCopiar={onCopiar} />
          </>
        ) : estado?.tokenPista ? (
          <div className="co-runner__caja">
            <div className="co-runner__fila">
              <span className="co-punto co-punto--trabajando" aria-hidden />
              <span className="co-runner__nombre">{`Token del Runner · termina en …${estado.tokenPista}`}</span>
              <span className="co-runner__fin">
                <Button size="sm" variant="tertiary" loading={creando} onClick={nuevoToken}>Cambiar token</Button>
              </span>
            </div>
            <p className="co-runner__consecuencia">Al cambiarlo, el Runner deja de entregar hasta que le pegues el nuevo.</p>
          </div>
        ) : (
          <div className="co-runner__caja">
            <div className="co-runner__fila">
              <span className="co-punto co-punto--viejo" aria-hidden />
              <span className="co-runner__nombre">Crea el token del Runner para conectarlo</span>
              <span className="co-runner__fin"><Button size="sm" loading={creando} onClick={nuevoToken}>Crear token</Button></span>
            </div>
          </div>
        )}
        {error && <p className="co-nota co-nota--mal">{error}</p>}
      </section>

      <section className="co-runner__paso">
        <p className="co-runner__paso-titulo"><span>3</span>Chatea desde este dispositivo</p>
        <div className="co-runner__caja">
          <TuToken clave={clave} aceptada={aceptada} onCrearClave={onCrearClave} onCopiar={onCopiar} />
        </div>
      </section>
    </div>
  );
}

export function PanelRunner({ vista, onVista, ...props }: Props & { vista: VistaRunner; onVista: (v: VistaRunner) => void }) {
  return vista === 'nuevo' ? <Nuevo {...props} /> : <Lista {...props} onNuevo={() => onVista('nuevo')} />;
}
