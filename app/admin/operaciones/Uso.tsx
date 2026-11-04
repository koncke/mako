'use client';

// =============================================================================
// El Uso de las cuatro cuentas y sus Runners, siempre a la vista (16/10/2026; 17/10 las cuatro; 23/10 el modal del cliente)
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
// ⚠️ EL ÚLTIMO NÚMERO NUNCA SE ESCONDE (22/10/2026, Martín: «Cuando no mide hace mucho tiempo no debería desaparecer los % de
//    uso que tenía la última vez... esa cuenta ya estaba al 99% semanal, y ahora ya no aparece»): una medición vieja se ve
//    en gris con su edad, y una ventana ya reiniciada dice desde cuándo no se mide. SIN el chip «Sin lugar» (22/10/2026, Martín:
//    «No pongas el chip de "Sin lugar", no necesito eso»): la semana llena se ve por su número y su barra roja.
// LA API (22/10/2026, Martín: «En USO de SuperAdmin quiero ver también el USO de la API... deberían ser 800 usd al mes»):
// debajo de las cuentas, el crédito de API de cada plan Max (UsoCredito.tsx); se pide al abrir el desplegable.
// ⚠️ Ningún texto pide pegar nada en una terminal: el Runner de una cuenta lo conecta la app sola.
// ⚠️ `ListaUso` NO TIENE HOOKS: la usa el teléfono adentro de su hoja (app/m/operaciones/RunnerMovil.tsx). El nombre
//    editable es una pieza aparte (`NombreDeCuenta`), con su estado.
// LA G (17/10/2026, Martín: «"Cuenta 1" trae su NOMBRE, editable, y debajo el email de esa cuenta», con el logo de Claude, y
// fuera «Abre su Runner…», «Sin el Runner de su terminal» y los botones «Runners» / «Nuevo Runner», que se repetían aunque
// el Runner anduviera): el nombre sale de lib/centro-titulares.ts (el que le puso Martín, o el titular de cuentas.tsv que
// sube su Runner), copiado del selector de cuentas de Google (avatar, nombre y el email debajo, en gris).
// MÁS CORTO (24/10/2026, Martín: «mucha información, mucho scroll»): el MISMO marcado, ordenado por CSS (centro.css, «El Uso en
// filas»): cada ventana en un renglón (el nombre, la barra, el %, y abajo cuándo se reinicia), «Medido hace X» arriba a la derecha,
// debajo del Runner, y las cuentas como filas de una lista agrupada. Lo de claude.ai sale de su AYUDA pública («Usage limit best
// practices», support.claude.com: una barra por ventana, con el tiempo que le queda a la sesión y cuándo se reinicia la semana),
// no de la app; el % y el renglón único no están en esa ayuda: son lo que esta pieza ya copiaba el 16/10. El orden del marcado no
// cambia: los tests leen el texto en ese orden y un lector de pantalla dice «Semana, 47% usado, se reinicia…».

import { useState, type KeyboardEvent as TeclaReact, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import { Modal } from '@/app/_ui/Modal';
import { carteroVivo } from '@/lib/operaciones-reglas';
import { nombreCuenta, type EstadoPc } from '@/lib/centro-chats';
import { hace } from '@/lib/progreso-reglas';
import {
  estadoRunnerUso, textoReinicio, textoReinicioPasado, usoDeCuenta, usoPrincipal,
  type Cuota, type EstadoRunnerUso, type UsoVentana,
} from '@/lib/centro-uso';
import { SeccionCredito, type CambiarCredito, type LeerCredito } from './UsoCredito';
import { TOPE_NOMBRE_CUENTA, nombreDeLaCuenta, type DatosDeCuenta } from '@/lib/centro-titulares';

export type CuentaUso = { cuenta: string; vistoAt: string | null; cuota: Cuota | null; titular?: DatosDeCuenta | null };
/** Guardar el nombre que Martín le pone a una cuenta: devuelve el error, o null. */
export type RenombrarCuenta = (cuenta: string, alias: string) => Promise<string | null>;

/**
 * El logo de Claude: el SVG OFICIAL de simple-icons («claude», el asterisco de Anthropic), embebido tal cual, en su terracota.
 * Martín (17/10/2026): «En "USO" el logo de claude está mal, usa el logo real». Antes eran doce rayos dibujados a mano.
 * Las cuatro cuentas son de Claude Code; GPT no está.
 */
const RUTA_LOGO_CLAUDE = 'm4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z';
export function LogoClaude({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Claude" style={{ flex: 'none' }}>
      <path fill="#D97757" d={RUTA_LOGO_CLAUDE} />
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

/**
 * Una ventana del Uso. SIEMPRE con el último número y su barra (22/10/2026, Martín: «Cuando no mide hace mucho tiempo no
 * debería desaparecer los % de uso que tenía la última vez... no puedo ver qué cuentas ya no me queda espacio»). Lo que
 * cambia con la edad es CÓMO se dice, nunca si se ve:
 *   · al día (menos de 30 min): «47% usado», y abajo cuándo se reinicia;
 *   · vieja (`edad`): «99% · medido hace 14 h», en gris, con la barra de su color pero más tenue;
 *   · pasado su reinicio: el último número en gris, la barra apagada y «Se reinició ayer a las 22:59 (sin medir desde entonces)».
 * Nunca «% usado» en una vieja: eso la leería como de ahora (lo que el 17/10 se arregló apagándola).
 */
function Barra({ titulo, v, ahora, edad }: { titulo: string; v: UsoVentana | null; ahora: number; edad: string | null }) {
  if (!v) {
    return (
      <div className="co-uso__ventana">
        <div className="co-uso__fila">
          <span className="co-uso__nombre">{titulo}</span>
          <span className="co-uso__pct co-uso__pct--sin">Sin medir</span>
        </div>
        <div className="co-uso__barra" aria-hidden><span className="co-uso__lleno co-uso__lleno--apagado" style={{ width: '0%' }} /></div>
      </div>
    );
  }
  const lleno = v.ultimo;
  const tono = v.reinicio ? 'apagado' : lleno >= 90 ? 'mal' : lleno >= 75 ? 'ojo' : 'bien';
  const vieja = v.reinicio || !!edad;
  return (
    <div className={`co-uso__ventana${v.reinicio ? ' co-uso__ventana--vencida' : edad ? ' co-uso__ventana--vieja' : ''}`}>
      <div className="co-uso__fila">
        <span className="co-uso__nombre">{titulo}</span>
        <span className="co-uso__pct">
          {vieja ? `${lleno}%` : `${lleno}% usado`}
          {edad && <span className="co-uso__edad">{` · ${edad}`}</span>}
        </span>
      </div>
      <div className="co-uso__barra" aria-hidden><span className={`co-uso__lleno co-uso__lleno--${tono}`} style={{ width: `${lleno}%` }} /></div>
      {v.reinicia != null && (
        <p className="co-uso__reinicio">
          {v.reinicio ? `Se reinició ${textoReinicioPasado(v.reinicia, ahora)} (sin medir desde entonces)` : `Se reinicia ${textoReinicio(v.reinicia, ahora)}`}
        </p>
      )}
    </div>
  );
}

/** Lo que dice el renglón del Runner de una cuenta: sin Runner declarado es «Sin Runner todavía», sin botón ni comando.
 *  «Runner activo» sólo si se midió hace poco; si no, «No se mide ahora» (30/10/2026): `visto_at` lo refresca la vuelta para todas las
 *  cuentas, y decía «activo» con punto verde al lado de «medido hace 6 días». */
function textoRunner(estado: EstadoRunnerUso, vistoAt: string | null, ahora: number, conCuota: boolean): string {
  if (estado === 'mide') return 'Runner activo';
  if (estado === 'sin_terminal') return 'No se mide ahora';
  // Sin Runner pero con un número: se midió a mano (la cuenta 1, 17/10/2026).
  return vistoAt ? `Runner sin conexión · ${hace(Date.parse(vistoAt), ahora)}` : conCuota ? 'Sin Runner · se mide a mano' : 'Sin Runner todavía';
}

/**
 * Qué dice una cuenta sin ninguna medición, según lo que de verdad pasa con ella (`estadoRunnerUso`). Martín (17/10/2026): «No me
 * pongas "Runner conectado, todavía sin medir"; si no se midió, se debe ejecutar automáticamente la medición». Eso era falso:
 * una cuenta `sin_terminal` la recorre OTRO Runner (el de la app) y nadie de esa cuenta mide — medido el 17/10: la cuenta 2 no
 * tenía ni un chat Runner, sólo una sesión suelta sin barra de estado. Lo que mide el Uso es la barra de estado de SU Runner de
 * terminal (`--settings`, cartero.mjs `uso`) o `get_usage` de la app (sólo la cuenta de la app): MaKo no puede pedírselo a un
 * Runner que no existe. Se dice eso, sin prometer una medición que nadie va a hacer.
 */
export const textoSinMedicion = (estado: EstadoRunnerUso): string =>
  estado === 'apagado' ? 'Su uso aparece cuando su Runner esté conectado' : 'Sin medir: su terminal no tiene Runner abierto';

/**
 * El estado de la PC, arriba de las cuentas (31/10/2026, Martín: «Si, ponlo pero en USO», no como cartel rojo). El hecho con su edad
 * (`estadoDeLaPc`, lib/centro-chats.ts). Con el mismo punto que el Runner de cada cuenta: se consulta, no interrumpe.
 */
function EstadoDeLaPc({ pc }: { pc: EstadoPc }) {
  return (
    <p className="co-uso__pc" role="status">
      <span className={`co-punto co-punto--${pc.tipo === 'al_dia' ? 'trabajando' : 'viejo'}`} aria-hidden />
      <span>
        {pc.texto}
        {pc.hacer && <span className="co-uso__pc-hacer">{pc.hacer}</span>}
      </span>
    </p>
  );
}

/** Cada cuenta con su plan, su Runner y sus dos ventanas (la computadora y el teléfono). */
export function ListaUso({ cuentas, ahora, pc, onRenombrar }: { cuentas: readonly CuentaUso[]; ahora: number; pc?: EstadoPc | null; onRenombrar?: RenombrarCuenta }) {
  return (
    <>
    {pc && <EstadoDeLaPc pc={pc} />}
    <div className="co-uso__lista">
      {cuentas.map((k) => {
        const estado = estadoRunnerUso(carteroVivo(k, ahora), k.cuota, ahora);
        const u = usoDeCuenta(k.cuota, ahora);
        const plan = k.cuota?.plan ?? null;
        // «Medido hace X» SIEMPRE que haya un número (17/10/2026, Martín: el Uso mostraba datos viejos como de ahora): al día,
        // en su renglón (desde el 24/10 el CSS lo pone arriba a la derecha, debajo del Runner); vieja (más de 30 min,
        // USO_VIEJO_MS), al lado de cada número, en gris («99% · medido hace 14 h»).
        // Desde el 22/10 nada se apaga por viejo: la tarjeta guarda el último número (lib/centro-uso.ts → USO_VENCIDO_MS).
        const edad = u.medido != null && u.viejo ? `medido ${hace(u.medido, ahora)}` : null;
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
                <span className={`co-punto co-punto--${estado === 'mide' ? 'trabajando' : 'viejo'}`} aria-hidden />
                {textoRunner(estado, k.vistoAt, ahora, !!k.cuota)}
              </span>
            </div>
            {u.cinco || u.semana ? (
              <>
                <Barra titulo="Sesión de 5 horas" v={u.cinco} ahora={ahora} edad={edad} />
                <Barra titulo="Semana" v={u.semana} ahora={ahora} edad={edad} />
                {u.medido != null && !edad && <p className="co-uso__reinicio co-uso__medido">{`Medido ${hace(u.medido, ahora)}`}</p>}
              </>
            ) : (
              // ⚠️ Lo que dice acá sale del MISMO estado que el renglón del Runner de arriba (`textoSinMedicion(estado)`): escrito
              // aparte, «Su uso aparece cuando su Runner esté conectado» convivía con «Runner activo» (17/10/2026).
              <p className="co-uso__reinicio">{textoSinMedicion(estado)}</p>
            )}
          </section>
        );
      })}
    </div>
    </>
  );
}

/**
 * El botón de abajo de la barra: el número siempre a la vista. Desde el 17/10/2026 no copia ningún comando (Martín: «no quiero
 * copiar en PowerShell, que se instale todo solo»).
 *
 * IGUAL QUE EL DEL CLIENTE (23/10/2026, Martín, la segunda vez: «En SuperAdmin te había pedido que "USO de IA" sea IGUAL que en
 * los clientes, sólo que SuperAdmin tiene más configuraciones... Pero aún me sigue saltando el desplegable»). Tocarlo abre el
 * MISMO modal del cliente, «Tus cuentas de IA» (`tusCuentas`: las del negocio, conectar y desconectar), y debajo lo que es sólo
 * del super admin: las cuatro cuentas de Claude Code con sus Runners y la API. Las computadoras de los CLIENTES ya no (23/10/2026, Martín:
 * «estas cruzando workspace»): van en la ficha de cada cliente (app/admin/ComputadorasDelNegocio.tsx). Ya no hay un panel que salta
 * sobre la barra (`.co-uso__panel`, absoluto encima del botón): ése era el desplegable.
 */
export function BotonUso({ cuentas, ahora, pc, onRenombrar, onLeerCredito, onCambiarCredito, tusCuentas }: {
  cuentas: readonly CuentaUso[]; ahora: number; pc?: EstadoPc | null; onRenombrar?: RenombrarCuenta;
  /** El crédito de API de los planes (UsoCredito.tsx): se pide recién al abrir. Sin esto, la sección no sale. */
  onLeerCredito?: LeerCredito;
  /** El interruptor del crédito asignado a un negocio (el ws1). Sin esto, se ve y no se toca. */
  onCambiarCredito?: CambiarCredito;
  /** Lo mismo que ve el cliente: «Tus cuentas de IA» (app/integraciones/TusCuentasIA.tsx). Llega de afuera porque trae CSS, y
   *  esta pieza la renderizan los tests en node. */
  tusCuentas?: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const principal = usoPrincipal(cuentas, ahora);
  const estados = cuentas.map((k) => estadoRunnerUso(carteroVivo(k, ahora), k.cuota, ahora));
  const activos = estados.filter((e) => e === 'mide').length;
  return (
    <div className="co-uso">
      {abierto && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => setAbierto(false)} ancho={640}>
          {tusCuentas}
          <div className="co-uso__mas">
            <p className="co-uso__cab">Cuentas de Claude Code</p>
            <ListaUso cuentas={cuentas} ahora={ahora} pc={pc} onRenombrar={onRenombrar} />
            {onLeerCredito && <SeccionCredito leer={onLeerCredito} cambiar={onCambiarCredito} cuentas={cuentas} />}
          </div>
        </Modal>
      )}
      <button type="button" className="co-acceso" aria-haspopup="dialog" aria-expanded={abierto} onClick={() => setAbierto(true)}
        title={`${activos} de ${cuentas.length} cuentas midiendo ahora${pc ? ` · ${pc.texto}` : ''}`}>
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
