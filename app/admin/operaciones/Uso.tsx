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
// ⚠️ `ListaUso` NO TIENE HOOKS: la usa el teléfono adentro de su hoja (app/m/operaciones/RunnerMovil.tsx). El nombre
//    editable es una pieza aparte (`NombreDeCuenta`), con su estado.
// LA G (17/10/2026, Martín: «"Cuenta 1" trae su NOMBRE, editable, y debajo el email de esa cuenta», con el logo de Claude, y
// fuera «Abre su Runner…», «Sin el Runner de su terminal» y los botones «Runners» / «Nuevo Runner», que se repetían aunque
// el Runner anduviera): el nombre sale de lib/centro-titulares.ts (el que le puso Martín, o el titular de cuentas.tsv que
// sube su Runner), copiado del selector de cuentas de Google (avatar, nombre y el email debajo, en gris).

import { useEffect, useRef, useState, type KeyboardEvent as TeclaReact } from 'react';
import { Icon } from '@/app/_components/icons';
import { carteroVivo } from '@/lib/operaciones-reglas';
import { nombreCuenta } from '@/lib/centro-chats';
import { hace } from '@/lib/progreso-reglas';
import { estadoRunnerUso, textoReinicio, usoDeCuenta, usoPrincipal, type Cuota, type EstadoRunnerUso, type UsoVentana } from '@/lib/centro-uso';
import { TOPE_NOMBRE_CUENTA, nombreDeLaCuenta, type DatosDeCuenta } from '@/lib/centro-titulares';

export type CuentaUso = { cuenta: string; vistoAt: string | null; cuota: Cuota | null; titular?: DatosDeCuenta | null };
/** Guardar el nombre que Martín le pone a una cuenta: devuelve el error, o null. */
export type RenombrarCuenta = (cuenta: string, alias: string) => Promise<string | null>;

/** El logo de Claude (las cuatro cuentas son de Claude Code; GPT no está): la chispa de rayos, en su terracota. */
export function LogoClaude({ size = 18 }: { size?: number }) {
  const rayos = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Claude" style={{ flex: 'none' }}>
      <g stroke="#D97757" strokeWidth={2.4} strokeLinecap="round">
        {rayos.map((a, i) => {
          const r = i % 2 ? 7.5 : 10;
          const x = 12 + r * Math.cos((a * Math.PI) / 180);
          const y = 12 + r * Math.sin((a * Math.PI) / 180);
          return <line key={a} x1="12" y1="12" x2={x.toFixed(2)} y2={y.toFixed(2)} />;
        })}
      </g>
    </svg>
  );
}

/** El nombre de una cuenta, editable: se toca el lápiz, se escribe y Enter lo guarda (Escape lo deja como estaba). */
function NombreDeCuenta({ cuenta, datos, onRenombrar }: { cuenta: string; datos: DatosDeCuenta | null | undefined; onRenombrar?: RenombrarCuenta }) {
  const nombre = nombreDeLaCuenta(cuenta, datos);
  const [editando, setEditando] = useState<{ texto: string; error: string | null; guardando: boolean } | null>(null);
  const guardar = async () => {
    if (!editando || !onRenombrar) return;
    setEditando({ ...editando, guardando: true, error: null });
    const error = await onRenombrar(cuenta, editando.texto);
    if (error) setEditando({ ...editando, guardando: false, error }); else setEditando(null);
  };
  const tecla = (e: TeclaReact<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void guardar(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditando(null); }
  };
  if (editando) {
    return (
      <span className="co-uso__editar">
        <input className="co-uso__input" value={editando.texto} maxLength={TOPE_NOMBRE_CUENTA} autoFocus disabled={editando.guardando}
          aria-label={`Nombre de ${nombreCuenta(cuenta)}`} placeholder={datos?.nombre ?? nombreCuenta(cuenta) ?? cuenta}
          onChange={(e) => setEditando({ ...editando, texto: e.target.value, error: null })} onKeyDown={tecla} onBlur={() => { if (!editando.guardando) void guardar(); }} />
        {editando.error && <span className="co-uso__error">{editando.error}</span>}
      </span>
    );
  }
  return (
    <span className="co-uso__titulo">
      {nombre}
      {onRenombrar && (
        <button type="button" className="co-uso__lapiz" aria-label={`Renombrar ${nombre}`} title="Renombrar"
          onClick={() => setEditando({ texto: datos?.alias ?? nombre, error: null, guardando: false })}>
          <Icon name="pen" size={12} />
        </button>
      )}
    </span>
  );
}

function Barra({ titulo, v, ahora, vencida }: { titulo: string; v: UsoVentana | null; ahora: number; vencida?: string | null }) {
  // Vencida (medida hace más de 6 horas, lib/centro-uso.ts → USO_VENCIDO_MS): la barra se apaga y dice desde cuándo no se
  // mide, nunca el porcentaje como si fuera de ahora.
  const lleno = v?.pct ?? 0;
  const tono = vencida ? 'apagado' : lleno >= 90 ? 'mal' : lleno >= 75 ? 'ojo' : 'bien';
  return (
    <div className={`co-uso__ventana${vencida ? ' co-uso__ventana--vencida' : ''}`}>
      <div className="co-uso__fila">
        <span className="co-uso__nombre">{titulo}</span>
        <span className={`co-uso__pct${v && !vencida ? '' : ' co-uso__pct--sin'}`}>{vencida ?? (!v ? 'Sin medir' : v.pct == null ? 'Se reinició' : `${v.pct}% usado`)}</span>
      </div>
      <div className="co-uso__barra" aria-hidden><span className={`co-uso__lleno co-uso__lleno--${tono}`} style={{ width: `${vencida ? 0 : lleno}%` }} /></div>
      {v && !vencida && v.reinicia != null && !v.reinicio && <p className="co-uso__reinicio">{`Se reinicia ${textoReinicio(v.reinicia, ahora)}`}</p>}
    </div>
  );
}

/** Lo que dice el renglón del Runner de una cuenta: sin Runner declarado es «Sin Runner todavía», sin botón ni comando.
 *  Una cuenta que da vueltas es «Runner activo» la recorra su terminal o el Runner de la app (17/10/2026: «Sin el Runner de
 *  su terminal» se repetía aunque el Runner anduviera, y lo que importa —si se midió la de 5 horas— ya lo dice su barra). */
function textoRunner(estado: EstadoRunnerUso, vistoAt: string | null, ahora: number, conCuota: boolean): string {
  if (estado !== 'apagado') return 'Runner activo';
  // Sin Runner pero con un número: se midió a mano (la cuenta 1, 17/10/2026).
  return vistoAt ? `Runner sin conexión · ${hace(Date.parse(vistoAt), ahora)}` : conCuota ? 'Sin Runner · se mide a mano' : 'Sin Runner todavía';
}

/** Cada cuenta con su plan, su Runner y sus dos ventanas (la computadora y el teléfono). */
export function ListaUso({ cuentas, ahora, onRenombrar }: { cuentas: readonly CuentaUso[]; ahora: number; onRenombrar?: RenombrarCuenta }) {
  return (
    <div className="co-uso__lista">
      {cuentas.map((k) => {
        const estado = estadoRunnerUso(carteroVivo(k, ahora), k.cuota, ahora);
        const vivo = estado !== 'apagado';
        const u = usoDeCuenta(k.cuota, ahora);
        const plan = k.cuota?.plan ?? null;
        // «Medido hace X» SIEMPRE que haya un número (17/10/2026, Martín: el Uso mostraba datos viejos como de ahora), y
        // pasadas las 6 horas las barras se apagan con «Sin medir hace X» (lib/centro-uso.ts → USO_VENCIDO_MS).
        const vencida = u.medido != null && u.vencido ? `Sin medir ${hace(u.medido, ahora)}` : null;
        return (
          <section key={k.cuenta} className="co-uso__cuenta" aria-label={nombreCuenta(k.cuenta) ?? k.cuenta}>
            <div className="co-uso__fila">
              <span className="co-uso__quien">
                <LogoClaude />
                <span className="co-uso__nombres">
                  <span className="co-uso__linea">
                    <NombreDeCuenta cuenta={k.cuenta} datos={k.titular} onRenombrar={onRenombrar} />
                    {plan && <span className="co-uso__plan">{plan}</span>}
                  </span>
                  {k.titular?.email && <span className="co-uso__email">{k.titular.email}</span>}
                </span>
              </span>
              <span className="co-uso__runner">
                <span className={`co-punto co-punto--${vivo ? 'trabajando' : 'viejo'}`} aria-hidden />
                {textoRunner(estado, k.vistoAt, ahora, !!k.cuota)}
              </span>
            </div>
            {u.cinco || u.semana ? (
              <>
                <Barra titulo="Sesión de 5 horas" v={u.cinco} ahora={ahora} vencida={vencida} />
                <Barra titulo="Semana" v={u.semana} ahora={ahora} vencida={vencida} />
                {u.medido != null && !vencida && <p className="co-uso__reinicio co-uso__medido">{`Medido ${hace(u.medido, ahora)}`}</p>}
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
export function BotonUso({ cuentas, ahora, onRenombrar }: {
  cuentas: readonly CuentaUso[]; ahora: number; onRenombrar?: RenombrarCuenta;
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
  const activos = estados.filter((e) => e !== 'apagado').length;
  return (
    <div className="co-uso" ref={caja}>
      {abierto && (
        <div className="co-uso__panel" role="dialog" aria-label="Uso y Runners">
          <p className="co-uso__cab">Uso</p>
          <ListaUso cuentas={cuentas} ahora={ahora} onRenombrar={onRenombrar} />
        </div>
      )}
      <button type="button" className="co-acceso" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}
        title={`${activos} de ${cuentas.length} Runners activos`}>
        <Icon name="config" size={17} />Uso
        <span className={`co-uso__principal${principal?.viejo ? ' co-uso__principal--viejo' : ''}`}>{principal ? `${principal.pct}%` : '—'}</span>
        {principal && <span className="co-uso__de">{principal.viejo && principal.medido != null ? `${nombreCuenta(principal.cuenta)} · ${hace(principal.medido, ahora)}` : nombreCuenta(principal.cuenta)}</span>}
        <span className="co-carteros" aria-hidden>
          {cuentas.map((k, i) => <span key={k.cuenta} className={`co-punto co-punto--${estados[i] !== 'apagado' ? 'trabajando' : 'viejo'}`} />)}
        </span>
      </button>
    </div>
  );
}
