'use client';

// =============================================================================
// El Uso de las cuatro cuentas y sus Runners, en UN desplegable siempre a la vista (16/10/2026; 17/10 las cuatro)
// =============================================================================
// Martín: «El "Uso" debe ser visible siempre, me imagino como un desplegable donde hoy está "Cartero". Y que "Cartero"
// (que ya no debería llamarse así), sea también el mismo desplegable... Que ahí se vean ambas cosas». Y en producción:
// «Falta el poder visualizar el USO». El 17/10: «Tampoco sale el uso de las otras 2 cuentas, y no sale qué plan tiene,
// o el uso de 5 horas» y «no quiero copiar en PowerShell, que se instale todo solo».
//
// El botón de abajo de la barra muestra SIEMPRE el número que importa: la semana más usada (es la que se termina
// primero, lib/centro-uso.ts → usoPrincipal). Abierto, cada cuenta con su plan, su Runner y sus dos ventanas, copiado de
// claude.ai → Configuración → Uso: el nombre de la ventana, cuándo se reinicia, la barra y el «% usado» a la derecha.
// Abajo, la puerta a los Runners de siempre (la lista y el alta, PanelRunner.tsx).
//
// ⚠️ Las CUATRO cuentas salen siempre (lib/centro-uso.ts → cuentasDeUso arma la lista; esta pieza dibuja lo que le dan).
// ⚠️ Las DOS ventanas salen siempre que la cuenta tenga algún dato: la que no se midió dice «Sin medir», no se esconde
//    (antes `Barra` devolvía null y la de 5 horas desaparecía: la cuenta de la app sólo trae la semanal).
// ⚠️ Ningún texto pide pegar nada en una terminal: el Runner de una cuenta lo conecta la app sola.
// ⚠️ `ListaUso` NO TIENE HOOKS: la usa el teléfono adentro de su hoja (app/m/operaciones/RunnerMovil.tsx).

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/app/_components/icons';
import { carteroVivo } from '@/lib/operaciones-reglas';
import { nombreCuenta } from '@/lib/centro-chats';
import { hace } from '@/lib/progreso-reglas';
import { tieneTerminal } from '@/lib/runner';
import { estadoRunnerUso, textoReinicio, usoDeCuenta, usoPrincipal, type Cuota, type EstadoRunnerUso, type UsoVentana } from '@/lib/centro-uso';

export type CuentaUso = { cuenta: string; vistoAt: string | null; cuota: Cuota | null };

function Barra({ titulo, v, ahora }: { titulo: string; v: UsoVentana | null; ahora: number }) {
  const lleno = v?.pct ?? 0;
  const tono = lleno >= 90 ? 'mal' : lleno >= 75 ? 'ojo' : 'bien';
  return (
    <div className="co-uso__ventana">
      <div className="co-uso__fila">
        <span className="co-uso__nombre">{titulo}</span>
        <span className={`co-uso__pct${v ? '' : ' co-uso__pct--sin'}`}>{!v ? 'Sin medir' : v.pct == null ? 'Se reinició' : `${v.pct}% usado`}</span>
      </div>
      <div className="co-uso__barra" aria-hidden><span className={`co-uso__lleno co-uso__lleno--${tono}`} style={{ width: `${lleno}%` }} /></div>
      {v && v.reinicia != null && !v.reinicio && <p className="co-uso__reinicio">{`Se reinicia ${textoReinicio(v.reinicia, ahora)}`}</p>}
    </div>
  );
}

/** Lo que dice el renglón del Runner de una cuenta: sin Runner declarado es «Sin Runner todavía», sin botón ni comando. */
function textoRunner(estado: EstadoRunnerUso, vistoAt: string | null, ahora: number): string {
  if (estado === 'mide') return 'Runner activo';
  if (estado === 'sin_terminal') return 'Sin el Runner de su terminal';
  return vistoAt ? `Runner sin conexión · ${hace(Date.parse(vistoAt), ahora)}` : 'Sin Runner todavía';
}

/** Cada cuenta con su plan, su Runner y sus dos ventanas (la computadora y el teléfono). */
export function ListaUso({ cuentas, ahora }: { cuentas: readonly CuentaUso[]; ahora: number }) {
  return (
    <div className="co-uso__lista">
      {cuentas.map((k) => {
        const estado = estadoRunnerUso(carteroVivo(k, ahora), k.cuota, ahora);
        const vivo = estado === 'mide';
        const u = usoDeCuenta(k.cuota, ahora);
        const plan = k.cuota?.plan ?? null;
        // «Medido hace X» en toda cuenta que no está midiendo en vivo (también con su Runner apagado) y en toda medición vieja.
        const medido = u.medido != null && (u.viejo || !vivo);
        return (
          <section key={k.cuenta} className="co-uso__cuenta" aria-label={nombreCuenta(k.cuenta) ?? k.cuenta}>
            <div className="co-uso__fila">
              <span className="co-uso__quien">
                <span className="co-uso__titulo">{nombreCuenta(k.cuenta)}</span>
                {plan && <span className="co-uso__plan">{plan}</span>}
              </span>
              <span className="co-uso__runner">
                <span className={`co-punto co-punto--${vivo ? 'trabajando' : 'viejo'}`} aria-hidden />
                {textoRunner(estado, k.vistoAt, ahora)}
              </span>
            </div>
            {/* Con un Runner declarado que no está al día se dice dónde abrirlo; sin Runner no hay nada que hacer acá. */}
            {!vivo && k.vistoAt && <p className="co-uso__hacer">{tieneTerminal(k.cuenta) ? 'Abre su Runner en la PC para conectarlo' : 'Abre su Runner en la app de Claude para conectarlo'}</p>}
            {u.cinco || u.semana ? (
              <>
                <Barra titulo="Sesión de 5 horas" v={u.cinco} ahora={ahora} />
                <Barra titulo="Semana" v={u.semana} ahora={ahora} />
                {medido && <p className="co-uso__reinicio">{`Medido ${hace(u.medido, ahora)}`}</p>}
              </>
            ) : (
              <p className="co-uso__reinicio">Su uso aparece cuando su Runner esté conectado</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** El botón de abajo de la barra: el número siempre a la vista, y el desplegable al tocarlo. Desde el 17/10/2026 no copia
 *  ningún comando (Martín: «no quiero copiar en PowerShell, que se instale todo solo»). */
export function BotonUso({ cuentas, ahora, onRunners, onNuevo }: {
  cuentas: readonly CuentaUso[]; ahora: number; onRunners: () => void; onNuevo: () => void;
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
          <ListaUso cuentas={cuentas} ahora={ahora} />
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
