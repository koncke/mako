'use client';

// =============================================================================
// Las cuentas de IA y sus dispositivos — el MISMO dibujo para el cliente y para SuperAdmin (23/10/2026)
// =============================================================================
// Martín (por el Cerebro, con capturas del ws1): bloques bien separados. Cada cuenta conectada es UN bloque con título grande,
// «Cuenta 1», «Cuenta 2» (no el nombre de la computadora), con su email (la regla del enmascarado), su plan y el uso de la
// sesión de 5 horas y de la semana; abajo, dentro de esa cuenta, sus DISPOSITIVOS —cada uno con su nombre, en línea o no, dónde
// está como lo muestra Google en «Tus dispositivos» («Windows · Grandbourg, Buenos Aires, Argentina») y «Desconectar»—, y ahí
// «Nuevo dispositivo», que se distingue bien de «Nueva cuenta». Lo usan «Tus cuentas de IA» (app/integraciones/TusCuentasIA.tsx,
// en la computadora, en el teléfono del Ops Center y en /perfil/ia) y la ficha de un cliente en Clientes (las computadoras
// de SU negocio: app/admin/ComputadorasDelNegocio.tsx; desde el 23/10/2026 ya no las de todos en el Uso del super admin).
// Los datos llegan agrupados del servidor (lib/ia-pc-reglas.ts → agruparPorCuenta): acá sólo se dibuja.
// MÁS CORTO (24/10/2026, Martín: «esta bastante feo, mucha información, mucho scroll»; el Cerebro: no diseñarlo de cero, copiar
// la ESTRUCTURA de una app de referencia). De la AYUDA PÚBLICA de cada una, no de las apps (no había sesión para abrirlas):
//   · cada ventana de uso, un renglón: de «Usage limit best practices» (support.claude.com) sale una barra por ventana, con el
//     tiempo que le queda a la sesión y cuándo se reinicia la semana; el % y el renglón único no están en esa ayuda: son lo que
//     el Uso del super admin ya copiaba de claude.ai el 16/10 (app/admin/operaciones/Uso.tsx);
//   · cada dispositivo, una fila: de «Ver dispositivos con acceso a la cuenta» (support.google.com/accounts/answer/3067630) sale
//     nombre, lugar y estado, y que tocarlo lleva a «Salir». Google abre otra página; acá se abre en el lugar (eso es nuestro).
// ⚠️ SIN IMPORTAR SU CSS: los tests lo dibujan en node (ComputadorasDelNegocio.tsx), que no carga un .css. Lo importa quien lo
// monta: TusCuentasIA.tsx y las páginas (app/admin/operaciones/page.tsx, app/m/operaciones/page.tsx, app/customer-success/pantalla.tsx).
// =============================================================================

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ClaudeMark } from '@/app/_components/icons';
import { SvcIcon } from '@/app/_components/ServicioVisual';
import { hace } from '@/lib/progreso-reglas';
import { AVISO_CHROME, AVISO_GATEKEEPER, AVISO_SMARTSCREEN, dondeQuedaMaKo, dondeEsta, estadoDeLaPc, yaPaso, type CuentaIA, type CuentasIA, type DispositivoIA } from '@/lib/ia-pc-reglas';

/** «22/10»: cuándo se conectó un dispositivo (en la zona de quien mira). */
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' });

/** «a las 15:30» o «mañana a las 09:00», en la hora del navegador de quien mira (es de cualquier negocio, no de Martín). */
function cuandoSeReinicia(t: number, ahora: number): string {
  const hora = new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const dia = (x: number) => { const d = new Date(x); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dias = Math.round((dia(t) - dia(ahora)) / 86_400_000);
  return dias <= 0 ? `a las ${hora}` : dias === 1 ? `mañana a las ${hora}` : `el ${new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' })} a las ${hora}`;
}

export function Barra({ titulo, pct, repone, ahora }: { titulo: string; pct?: number; repone?: string; ahora: number }) {
  const tono = pct == null ? 'apagado' : pct >= 90 ? 'mal' : pct >= 75 ? 'ojo' : 'bien';
  return (
    <div className="tci-ventana">
      <div className="tci-fila">
        <span className="tci-nombre">{titulo}</span>
        <span className={`tci-pct${pct == null ? ' tci-pct--sin' : ''}`}>{pct == null ? 'Sin medir' : `${pct}% usado`}</span>
      </div>
      <div className="tci-barra" aria-hidden><span className={`tci-lleno tci-lleno--${tono}`} style={{ width: `${pct ?? 0}%` }} /></div>
      {repone && pct != null && !yaPaso(repone, ahora) && <p className="tci-nota">{`Se reinicia ${cuandoSeReinicia(Date.parse(repone), ahora)}`}</p>}
    </div>
  );
}

/**
 * Un dispositivo, como una fila de Google › «Tus dispositivos» (24/10/2026; de su ayuda pública, «Ver dispositivos con acceso a
 * la cuenta», no de la app): a la vista su nombre, en línea o no y dónde está; tocar la fila abre el detalle —cuándo se conectó y
 * «Desconectar», que pide confirmar—, así la acción que borra no queda suelta en la lista. `children` (el «Iniciar sesión en
 * Claude» de una sin cuenta) queda a la vista, fuera del pliegue: es lo que la hace contestar.
 */
export function FilaDispositivo({ d, ahora, onDesconectar, children }: { d: DispositivoIA; ahora: number; onDesconectar?: (d: DispositivoIA) => Promise<unknown> | void; children?: ReactNode }) {
  const [seguro, setSeguro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const tono = d.enLinea && d.conCuenta ? 'linea' : d.enLinea ? 'esperando' : 'apagada';
  const donde = dondeEsta(d);
  // EL FOCO NO SE PIERDE (revisión del 24/10/2026): la pregunta reemplaza al botón, y con el botón se iba el foco al <body>. Al
  // preguntar va a «Cancelar» (lo que no borra nada); al cancelar, o si desconectar falla, vuelve a «Desconectar».
  const cancelar = useRef<HTMLButtonElement>(null);
  const pedir = useRef<HTMLButtonElement>(null);
  const volverAlBoton = useRef(false);
  useEffect(() => {
    if (seguro) cancelar.current?.focus();
    else if (volverAlBoton.current) { volverAlBoton.current = false; pedir.current?.focus(); }
  }, [seguro]);
  const noPreguntar = () => { volverAlBoton.current = true; setSeguro(false); };
  const desconectar = async () => {
    if (!onDesconectar) return;
    setOcupado(true);
    try { await onDesconectar(d); } finally { setOcupado(false); noPreguntar(); }
  };
  // Adentro de <summary> sólo va texto en línea (nada de <p> ni <div>): por eso los <span>. Y la grilla va en un <span> de adentro,
  // no en el <summary>: Safari 16 y anteriores no lo dejan ser grilla (WebKit 167111) y la flecha salía como una raya suelta.
  const fila = (
    <>
      <span className="tci-fila">
        <span className="tci-disp__nombre">{d.nombre}{d.de ? <span className="tci-nota"> · de {d.de}</span> : null}</span>
        <span className="tci-estado">
          <span className={`tci-punto tci-punto--${tono}`} aria-hidden />
          {estadoDeLaPc({ enLinea: d.enLinea, ultimoLatido: d.ultimoLatido, cuentas: d.conCuenta ? [d.id] : [], sinClaude: d.sinClaude }, ahora, hace)}
        </span>
      </span>
      {donde && <span className="tci-nota tci-disp__donde">{donde}</span>}
    </>
  );
  return (
    <li className="tci-disp" data-dispositivo={d.id}>
      {d.conectadaAt || onDesconectar ? (
        <details className="tci-disp__pliegue" onToggle={(e) => { if (!e.currentTarget.open) setSeguro(false); }}>
          <summary className="tci-disp__resumen"><span className="tci-disp__caja">{fila}<span className="tci-flecha" aria-hidden /></span></summary>
          <div className="tci-disp__detalle">
            {d.conectadaAt && <p className="tci-nota">{`Conectada el ${fechaCorta(d.conectadaAt)}`}</p>}
            {onDesconectar && (
              <div className="tci-acciones">
                {seguro
                  ? <>
                    <span className="tci-nota">{d.de ? `¿Desconectarla? El chat de ${d.de} deja de usarla.` : '¿Desconectarla? Tu chat deja de usarla.'}</span>
                    <button type="button" className="tci-boton tci-boton--peligro" disabled={ocupado} onClick={() => void desconectar()}>{ocupado ? 'Desconectando…' : 'Desconectar'}</button>
                    <button ref={cancelar} type="button" className="tci-boton tci-boton--suave" disabled={ocupado} onClick={noPreguntar}>Cancelar</button>
                  </>
                  : <button ref={pedir} type="button" className="tci-boton tci-boton--suave" onClick={() => setSeguro(true)}>Desconectar</button>}
              </div>
            )}
          </div>
        </details>
      ) : <div className="tci-disp__resumen"><span className="tci-disp__caja">{fila}</span></div>}
      {children}
    </li>
  );
}

/**
 * Una cuenta conectada: arriba, como el selector de cuentas de Google, el logo, «Cuenta N» y debajo su email y su plan; su uso
 * en dos filas (la ventana y cuándo se reinicia, la barra, el %: la fila de claude.ai › Configuración › Uso, ver tus-cuentas-ia.css);
 * y abajo sus dispositivos, una fila cada uno.
 */
export function BloqueCuenta({ cuenta, ahora, onDesconectar, nuevoDispositivo }: {
  cuenta: CuentaIA; ahora: number; onDesconectar?: (d: DispositivoIA) => Promise<unknown> | void; nuevoDispositivo?: ReactNode;
}) {
  const titulo = `Cuenta ${cuenta.numero}`;
  return (
    <section className="tci-bloque" aria-label={titulo} data-cuenta={cuenta.numero}>
      <div className="tci-quien">
        {cuenta.proveedor === 'chatgpt' ? <SvcIcon k="openai" size={14} box={22} radius={6} /> : <ClaudeMark size={20} />}
        <div className="tci-nombres">
          <h3 className="tci-bloque__titulo">{titulo}</h3>
          <span className="tci-email">{cuenta.email ?? (cuenta.proveedor === 'chatgpt' ? 'Tu cuenta de ChatGPT' : 'Tu cuenta de Claude')}{cuenta.plan && <span className="tci-plan">{cuenta.plan}</span>}</span>
        </div>
      </div>
      <Barra titulo="Sesión de 5 horas" pct={cuenta.usado5h} repone={cuenta.repone} ahora={ahora} />
      <Barra titulo="Semana" pct={cuenta.usadoSemana} repone={cuenta.reponeSemana} ahora={ahora} />
      <h4 className="tci-bloque__sub">Dispositivos</h4>
      <ul className="tci-disps">
        {cuenta.dispositivos.map((d) => <FilaDispositivo key={d.id} d={d} ahora={ahora} onDesconectar={onDesconectar} />)}
      </ul>
      {nuevoDispositivo}
    </section>
  );
}

/** Las computadoras conectadas sin ninguna cuenta todavía (sin Claude Code, o sin la sesión iniciada). */
export function BloqueSinCuenta({ dispositivos, ahora, onDesconectar, extra }: {
  dispositivos: DispositivoIA[]; ahora: number; onDesconectar?: (d: DispositivoIA) => Promise<unknown> | void; extra?: (d: DispositivoIA) => ReactNode;
}) {
  if (!dispositivos.length) return null;
  return (
    <section className="tci-bloque" aria-label="Sin cuenta todavía">
      <h3 className="tci-bloque__titulo">Sin cuenta todavía</h3>
      <p className="tci-nota">Están conectadas, pero su Claude todavía no tiene la sesión iniciada: no contestan.</p>
      <ul className="tci-disps">
        {dispositivos.map((d) => <FilaDispositivo key={d.id} d={d} ahora={ahora} onDesconectar={onDesconectar}>{extra?.(d)}</FilaDispositivo>)}
      </ul>
    </section>
  );
}

/** Las cuentas (cada una con sus dispositivos) y, al final, lo que está conectado sin cuenta. */
export function CuentasYDispositivos({ grupos, ahora, onDesconectar, nuevoDispositivo, extraSinCuenta }: {
  grupos: CuentasIA; ahora: number; onDesconectar?: (d: DispositivoIA) => Promise<unknown> | void;
  nuevoDispositivo?: (c: CuentaIA) => ReactNode; extraSinCuenta?: (d: DispositivoIA) => ReactNode;
}) {
  return (
    <>
      {grupos.cuentas.map((c) => (
        <BloqueCuenta key={`${c.proveedor}-${c.numero}`} cuenta={c} ahora={ahora} onDesconectar={onDesconectar} nuevoDispositivo={nuevoDispositivo?.(c)} />
      ))}
      <BloqueSinCuenta dispositivos={grupos.sinCuenta} ahora={ahora} onDesconectar={onDesconectar} extra={extraSinCuenta} />
    </>
  );
}

/** Los dos sistemas, primero el de la computadora desde la que se mira (sin navegador no se sabe: Windows). */
export function sistemasDeEstaPc() {
  const esMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
  return esMac ? (['mac', 'windows'] as const) : (['windows', 'mac'] as const);
}
const NOMBRE_SISTEMA = { windows: 'Windows', mac: 'Mac' } as const;

/**
 * LA DESCARGA DE MaKo: el instalador de Windows (0.4.0) o MaKo.app para la Mac (0.4.2), según la computadora desde la que se mira.
 * Es de IA del cliente y no se copia: la usa el cartel del chat sin la app (app/_chat/AppPrimero.tsx); el tutorial de «Tus cuentas
 * de IA» tiene la suya por sistema elegido (TusCuentasIA.tsx, paso 2).
 */
export function DescargarMaKo({ className, onClick, texto, children }: { className?: string; onClick?: () => void; texto?: string; children?: ReactNode }) {
  const sistemas = sistemasDeEstaPc();
  // `texto`: lo que dice el botón donde el lugar es chico (la caja del chat: «Instalar MaKo»); `children`, un ícono adelante.
  return (
    <a className={className} href={`/api/ia-pc/descargar?os=${sistemas[0]}`} onClick={onClick} title={`Descargar MaKo para ${NOMBRE_SISTEMA[sistemas[0]]}`}>
      {children}{texto ?? `Descargar MaKo para ${NOMBRE_SISTEMA[sistemas[0]]}`}
    </a>
  );
}

/** Lo que dice Chrome al bajar el instalador sin firma y lo que dice el sistema al abrirlo, y cómo seguir (el de la computadora desde
 *  la que se mira). Chrome primero: pasa antes (27/10/2026). */
export function avisoAlAbrir(): string {
  const sistemas = sistemasDeEstaPc();
  return `${AVISO_CHROME} ${sistemas[0] === 'mac' ? AVISO_GATEKEEPER : AVISO_SMARTSCREEN}`;
}

/** Dónde queda MaKo después de instalarlo, y cómo saber si quedó (27/10/2026, Leila: «no lo encuentro en mi compu»). */
export function dondeQueda(): string {
  return dondeQuedaMaKo(sistemasDeEstaPc()[0]);
}

/** «¿Es una Mac? Descárgalo para Mac» (o Windows): el instalador del OTRO sistema, a un toque. */
export function DescargarElOtro({ className }: { className?: string }) {
  const sistemas = sistemasDeEstaPc();
  return <a className={className} href={`/api/ia-pc/descargar?os=${sistemas[1]}`}>{`¿Es una ${sistemas[1] === 'mac' ? 'Mac' : 'computadora con Windows'}? Descárgalo para ${NOMBRE_SISTEMA[sistemas[1]]}`}</a>;
}

/**
 * «Nuevo dispositivo», dentro de una cuenta: UNA fila discreta que abre el tutorial en la descarga (24/10/2026). Martín, por el
 * Cerebro: «diseña bien ese cartel, no el botón feo que está al final del modal que no lo ve nadie»; el Cerebro: «el botón del final
 * del modal se va». Eso REEMPLAZA el «"Nuevo dispositivo" con la descarga a la vista» del 23/10: la descarga para quien todavía no
 * tiene la app vive donde hace falta, en el lugar de la caja del chat (app/_chat/AppPrimero.tsx), y acá queda el camino para sumar
 * otra computadora, sin un recuadro con dos botones, un aviso y un link al final de cada cuenta.
 */
export function NuevoDispositivo({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button type="button" className="tci-nuevo-fila" onClick={onAbrir}>
      <span className="tci-nuevo-fila__mas" aria-hidden>+</span>
      <span className="tci-nuevo-fila__titulo">Nuevo dispositivo</span>
      <span className="tci-nota">Otra computadora con esta misma cuenta</span>
    </button>
  );
}
