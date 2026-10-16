'use client';

// =============================================================================
// El Uso de las tres cuentas y sus Runners, en UN desplegable siempre a la vista (16/10/2026)
// =============================================================================
// Martín: «El "Uso" debe ser visible siempre, me imagino como un desplegable donde hoy está "Cartero". Y que "Cartero"
// (que ya no debería llamarse así), sea también el mismo desplegable... Que ahí se vean ambas cosas». Y en producción:
// «Falta el poder visualizar el USO».
//
// El botón de abajo de la barra muestra SIEMPRE el número que importa: la semana más usada (es la que se termina
// primero, lib/centro-uso.ts → usoPrincipal). Abierto, cada cuenta con su Runner y sus dos ventanas, copiado de
// claude.ai → Configuración → Uso: el nombre de la ventana, cuándo se reinicia, la barra y el «% usado» a la derecha.
// Abajo, la puerta a los Runners de siempre (la lista y el alta, PanelRunner.tsx).
//
// ⚠️ `ListaUso` NO TIENE HOOKS: la usa el teléfono adentro de su hoja (app/m/operaciones/RunnerMovil.tsx).

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/app/_components/icons';
import { carteroVivo } from '@/lib/operaciones-reglas';
import { nombreCuenta } from '@/lib/centro-chats';
import { hace } from '@/lib/progreso-reglas';
import { COMANDO_TERMINAL } from '@/lib/runner';
import { estadoRunnerUso, textoReinicio, usoDeCuenta, usoPrincipal, type Cuota, type UsoVentana } from '@/lib/centro-uso';

export type CuentaUso = { cuenta: string; vistoAt: string | null; cuota: Cuota | null };

function Barra({ titulo, v, ahora }: { titulo: string; v: UsoVentana | null; ahora: number }) {
  if (!v) return null;
  const lleno = v.pct ?? 0;
  const tono = lleno >= 90 ? 'mal' : lleno >= 75 ? 'ojo' : 'bien';
  return (
    <div className="co-uso__ventana">
      <div className="co-uso__fila">
        <span className="co-uso__nombre">{titulo}</span>
        <span className="co-uso__pct">{v.pct == null ? 'Se reinició' : `${v.pct}% usado`}</span>
      </div>
      <div className="co-uso__barra" aria-hidden><span className={`co-uso__lleno co-uso__lleno--${tono}`} style={{ width: `${lleno}%` }} /></div>
      {v.reinicia != null && !v.reinicio && <p className="co-uso__reinicio">{`Se reinicia ${textoReinicio(v.reinicia, ahora)}`}</p>}
    </div>
  );
}

/** Cada cuenta con su Runner y sus dos ventanas (la computadora y el teléfono). */
export function ListaUso({ cuentas, ahora, onCopiar }: {
  cuentas: readonly CuentaUso[]; ahora: number;
  /** Copiar el comando que abre el Runner de una cuenta (lib/runner.ts → COMANDO_TERMINAL). */
  onCopiar?: (texto: string, aviso: string) => void;
}) {
  return (
    <div className="co-uso__lista">
      {cuentas.map((k) => {
        const estado = estadoRunnerUso(carteroVivo(k, ahora), k.cuota, ahora);
        const vivo = estado === 'mide';
        const u = usoDeCuenta(k.cuota, ahora);
        return (
          <section key={k.cuenta} className="co-uso__cuenta" aria-label={nombreCuenta(k.cuenta) ?? k.cuenta}>
            <div className="co-uso__fila">
              <span className="co-uso__titulo">{nombreCuenta(k.cuenta)}</span>
              <span className="co-uso__runner">
                <span className={`co-punto co-punto--${vivo ? 'trabajando' : 'viejo'}`} aria-hidden />
                {vivo ? 'Runner activo' : estado === 'sin_terminal' ? 'Sin el Runner de su terminal' : k.vistoAt ? `Runner sin conexión · ${hace(Date.parse(k.vistoAt), ahora)}` : 'Sin Runner'}
              </span>
            </div>
            {!vivo && (
              <div className="co-uso__fila">
                <p className="co-uso__hacer">{onCopiar ? 'Pega su comando en PowerShell para conectarlo' : 'Abre su Runner en la PC para conectarlo'}</p>
                {onCopiar && <button type="button" className="co-chip" onClick={() => onCopiar(COMANDO_TERMINAL(k.cuenta), 'Copiado: pégalo en PowerShell')}><Icon name="copy" size={14} />Copiar</button>}
              </div>
            )}
            {u.cinco || u.semana ? (
              <>
                <Barra titulo="Sesión de 5 horas" v={u.cinco} ahora={ahora} />
                <Barra titulo="Semana" v={u.semana} ahora={ahora} />
                {u.viejo && u.medido != null && <p className="co-uso__reinicio">{`Medido ${hace(u.medido, ahora)}`}</p>}
              </>
            ) : (
              <p className="co-uso__reinicio">Se mide cuando su Runner está abierto con su comando</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** El botón de abajo de la barra: el número siempre a la vista, y el desplegable al tocarlo. */
export function BotonUso({ cuentas, ahora, onRunners, onNuevo, onCopiar }: {
  cuentas: readonly CuentaUso[]; ahora: number; onRunners: () => void; onNuevo: () => void; onCopiar: (texto: string, aviso: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);
  const principal = usoPrincipal(cuentas, ahora);
  const estados = cuentas.map((k) => estadoRunnerUso(carteroVivo(k, ahora), k.cuota, ahora));
  const activos = estados.filter((e) => e === 'mide').length;
  return (
    <div className="co-uso" ref={caja}>
      {abierto && (
        <div className="co-uso__panel" role="dialog" aria-label="Uso y Runners">
          <p className="co-uso__cab">Uso</p>
          <ListaUso cuentas={cuentas} ahora={ahora} onCopiar={onCopiar} />
          <div className="co-uso__pie">
            <button type="button" className="co-chip" onClick={() => { setAbierto(false); onRunners(); }}>Runners</button>
            <button type="button" className="co-chip" onClick={() => { setAbierto(false); onNuevo(); }}>Nuevo Runner</button>
          </div>
        </div>
      )}
      <button type="button" className="co-acceso" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}
        title={`${activos} de ${cuentas.length} Runners activos`}>
        <Icon name="config" size={17} />Uso
        <span className={`co-uso__principal${principal?.viejo ? ' co-uso__principal--viejo' : ''}`}>{principal ? `${principal.pct}%` : '—'}</span>
        {principal && <span className="co-uso__de">{principal.viejo && principal.medido != null ? `${nombreCuenta(principal.cuenta)} · ${hace(principal.medido, ahora)}` : nombreCuenta(principal.cuenta)}</span>}
        <span className="co-carteros" aria-hidden>
          {cuentas.map((k, i) => <span key={k.cuenta} className={`co-punto co-punto--${estados[i] === 'mide' ? 'trabajando' : 'viejo'}`} />)}
        </span>
      </button>
    </div>
  );
}
