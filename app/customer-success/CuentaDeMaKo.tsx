'use client';

// =============================================================================
// CuentaDeMaKo — «Inspeccionar», al lado del nombre del cliente
// =============================================================================
// Un control, cuatro estados, y en cada uno UNA cosa:
//
//   · sin cuenta   → «Abrir cuenta» (sólo si esta cuenta puede tener clientes)
//   · pendiente    → «Espera aprobación», sin acción: la firma es del super admin
//   · aprobado     → 👁 «Inspeccionar»
//   · revocado     → «Revocado», sin acción
//
// ⚠️ ERA UNA CAJA Y DEJÓ DE SERLO (27/09/2026). Vivía como primer hijo del CUERPO
// del modal: borde, fondo, radio y un kicker en versalitas que decía «CUENTA DE
// MAKO», ocupando un renglón entero arriba del tablero — que es lo único que la
// ficha vino a mostrar. El pedido fue «no debería estar ese cuadro alargado…
// que esté todo a la misma altura pero alineado a la derecha, sutil». Ahora es
// el tercer hijo de `.fc-fila`, hermano del nombre, con el molde del «CRM →» de
// al lado: tinta, no píldora. Y sin kicker, que además es regla de la casa.
//
// ⚠️ Y NO LO VE CUALQUIERA. Antes dibujaba «Sin cuenta» para todo el mundo —o
// sea, para TODO workspace que no fuera agencia, que es el default— y eso es una
// afirmación sobre algo que a ese cliente no le incumbe. Lo decide el SERVER
// (`cuentas.visible`, app/customer-success/page.tsx) y desde el 05/10/2026 es UNA
// condición: que el workspace que se está mirando sea una AGENCIA. «Todo lo que tenga
// que ver con invitar a MaKo, debería solo verse si la cuenta es AGENCIA». Antes era
// «super admin o agencia», y con eso el super admin parado en un cliente común veía
// un control que ese cliente no tiene. `superAdmin` sigue existiendo, pero elige la
// PUERTA de entrada (abajo), no si el control se dibuja.
//
// ⚠️ DOS MECANISMOS, DOS ELEMENTOS, y no es un descuido:
//   · La AGENCIA entra por `POST /api/agencia/entrar`, que le acuña la cookie
//     firmada después de verificar su cartera contra la base.
//   · El SUPER ADMIN entra por un `<a href="/general?ws=N">`, igual que en
//     /admin. Ese endpoint lo RECHAZA a propósito (400): su contexto viaja por
//     pestaña y una tercera fuente para el mismo dato obliga a que
//     `getWorkspaceActual` y `estaImpersonando` coincidan en tres lugares.
//     Y el ancla, además, es lo que le deja abrir dos clientes a la vez con
//     ctrl+click — el mismo motivo por el que el de /admin es un ancla.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/app/_ui';
import { emailUtilizable } from '@/lib/agencia-altas';
import { useRouter } from '@/app/_ui/Link';
import type { ClienteCruce } from './cruce';
import { Icon } from '@/app/_components/icons';
import { ROTULO_CARTERA, type EstadoCartera } from '@/lib/agencia-cartera';
import { WS_PARAM } from '@/lib/ws-tab';
import { crearCuentaMakoAction } from './actions';

/** Una persona del equipo de un cliente. La arma el server (page.tsx). */
export type MiembroDeCliente = { id: number; nombre: string; email: string; rol: string; foto: string | null };

export type CuentasProp = {
  estadoPorWs: Record<number, string>;
  /** Puede abrirle cuenta a un cliente: agencia habilitada + admin de este workspace. */
  puedeAbrir: boolean;
  /** Si se dibuja TODO lo de cuentas y equipo (este control, la tab «Equipo», pedir y sumar
   *  gente): sólo cuando el workspace que se mira es una agencia. Es del workspace, no de
   *  quien mira — ver page.tsx. */
  visible: boolean;
  /** Decide el mecanismo de entrada, no el permiso. */
  superAdmin: boolean;
  /** El plan de cada cliente con cuenta, para el chip de su tarjeta. Sólo los aprobados. */
  planPorWs?: Record<number, string>;
  /** El equipo de cada cliente con cuenta, para la tab «Equipo» de su ficha. */
  equipoPorWs?: Record<number, MiembroDeCliente[]>;
  /** Lo que ESTA agencia ya pidió sumar, por cliente (mig 0178). */
  altasPorWs?: Record<number, AltaPedida[]>;
  /** Si se dibuja el formulario de pedir. El permiso lo vuelve a hacer el server. */
  puedePedirAltas?: boolean;
};

/** Un pedido de alta como lo dibuja la ficha. Lo arma el server (page.tsx). */
export type AltaPedida = {
  id: number; cliente_ws: number; email: string; nombre: string; rol_ws: string;
  estado: string; motivo: string | null; created_at: string;
};

export function CuentaDeMaKo({ c, cuentas, onError, variante = 'sutil' }: {
  c: ClienteCruce;
  cuentas?: CuentasProp;
  onError: (m: string) => void;
  /**
   * `sutil` es el de la FICHA: tinta al lado del nombre, sin caja. `boton` es el de la
   * TARJETA: la píldora llena, igual que la de la grilla de la plataforma — «me gustan
   * los botones de Acciones e Inspeccionar que pusiste en la preview de cada card,
   * ponlo también en la vista de agencia» (27/09/2026).
   *
   * Es una variante y no un componente aparte porque lo que cambia es la ROPA: los
   * cuatro estados, el mecanismo de entrada y el guard son los mismos, y duplicarlos
   * es cómo una de las dos copias se queda con tres estados.
   */
  variante?: 'sutil' | 'boton';
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  /**
   * ⚠️ PRIMERO EL EMAIL, Y ES OBLIGATORIO (28/09/2026). Está medido por qué: se abrió
   * una cuenta sin él, el super admin la aprobó, y el workspace quedó con CERO
   * usuarios — una cuenta a la que no puede entrar nadie, sin un solo error. El campo
   * viene prellenado con el del CRM si lo tiene, y se pregunta IGUAL: el del CRM puede
   * ser el del contacto comercial y no el de quien va a usar la app.
   *
   * ⚠️ Y LOS DOS HOOKS VAN ACÁ ARRIBA, antes del `return null` de abajo. Los tenía
   * después y el guard del pre-push lo cazó: un hook detrás de un return temprano es
   * React #300, o sea la pantalla ENTERA en blanco con un error que no dice ni el
   * archivo ni la línea.
   */
  const [pidiendoEmail, setPidiendoEmail] = useState(false);
  const [correo, setCorreo] = useState('');

  if (!cuentas?.visible) return null;

  const ws = c.clienteWs ?? null;
  const estado = ws ? (cuentas.estadoPorWs[ws] as EstadoCartera | undefined) : undefined;

  const abrir = async () => {
    setOcupado(true);
    const r = await crearCuentaMakoAction(c.leadId, correo);
    if (!r.ok) { onError(r.error); setOcupado(false); return; }
    // ⚠️ `router.refresh()` Y NO `location.reload()`. Hasta el 06/10/2026 qué cliente
    // está abierto no viajaba en la URL y recargar CERRABA la ficha: se leía como «le
    // di a Abrir cuenta y me sacó». Ahora viaja en `?cliente=` y un reload la reabre,
    // pero en Resumen y rearmada de cero; refrescar no desmonta nada. Es la misma
    // trampa que FichaCliente documenta para el tablero.
    setPidiendoEmail(false);
    router.refresh();
    setOcupado(false);
  };

  const entrar = async () => {
    if (!ws) return;
    setOcupado(true);
    try {
      const r = await fetch('/api/agencia/entrar', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ws }),
      });
      const j = await r.json();
      if (!j?.ok) { onError(j?.error ?? 'No se pudo entrar.'); setOcupado(false); return; }
      // Recarga dura y no `router.push`: el contexto lo resuelve el SERVER desde
      // la cookie que este fetch acaba de dejar, así que todo lo montado en el
      // navegador es de la cuenta anterior. Sin `?ws=` a propósito — para una
      // agencia el contexto ES la cookie, y un `?ws=` suyo no lo honra el proxy.
      window.location.href = '/general';
    } catch {
      onError('No se pudo entrar.'); setOcupado(false);
    }
  };

  const ojo = <Icon name="eye" size={13} />;
  const cls = variante === 'boton' ? 'cmk cmk-btn' : 'cmk';

  let control = null;
  if (!ws) {
    if (cuentas.puedeAbrir) {
      control = (
        <button type="button" className={cls} disabled={ocupado}
          onClick={() => { setCorreo(c.email ?? ''); setPidiendoEmail(true); }}
          title={`Abrirle una cuenta de MaKo a ${c.nombre || 'este cliente'}`}>
          {ocupado ? 'Abriendo…' : 'Abrir cuenta'}
        </button>
      );
    }
    // Sin cuenta y sin poder abrirla no hay nada que decir. El «Sin cuenta» que
    // había acá era una afirmación que no le servía a nadie.
  } else if (cuentas.superAdmin) {
    // El super admin entra a cualquier workspace: su permiso no sale de la
    // cartera. Pero el ESTADO de la cartera sí le importa —está probando a la
    // agencia—, así que va en el `title`, donde el texto no ocupa lugar.
    control = (
      <a className={`${cls} cmk-ok`} href={`/general?${WS_PARAM}=${ws}`}
        title={estado === 'aprobado'
          ? `Ver el dashboard de ${c.nombre || 'este cliente'}`
          : `Ver el dashboard de ${c.nombre || 'este cliente'}. Para la agencia: ${estado ? ROTULO_CARTERA[estado].toLowerCase() : 'sin pedido'}`}>
        {ojo}<span>Inspeccionar</span>
      </a>
    );
  } else if (estado === 'aprobado') {
    control = (
      <button type="button" className={`${cls} cmk-ok`} onClick={entrar} disabled={ocupado}
        title={`Ver el dashboard de ${c.nombre || 'este cliente'}`}>
        {ojo}<span>{ocupado ? 'Entrando…' : 'Inspeccionar'}</span>
      </button>
    );
  } else if (estado) {
    // 'pendiente' y 'revocado' son estados, no acciones: no llevan botón. Uno que
    // no hace nada se lee como que la app está rota.
    control = <span className={`${cls} cmk-est`}>{ROTULO_CARTERA[estado]}</span>;
  }
  // Y si tiene workspace pero no hay fila en la cartera de esta agencia, no se
  // dibuja nada: antes salía «Workspace 7», que es un dato técnico en la cara.

  if (!control && !pidiendoEmail) return null;
  return (
    <>
      {control}
      {/* ⚠️ POR PORTAL AL BODY, porque este control vive ADENTRO DE UNA TARJETA. `Modal`
          no se portalea: se dibuja donde lo montan, y la tarjeta (TarjetaEntidad) le da a
          cada hijo `position: relative; z-index: 1` — o sea que la fila de acciones es un
          contexto de apilamiento y el modal quedaba atrapado en el z 1 de ESA tarjeta. La
          tarjeta siguiente del kanban, más abajo en el DOM, pintaba su banda, su nombre y
          su «Inspeccionar» ENCIMA del modal (captura de Martín, 05/10/2026, sobre Código
          Inmobiliario). Es la regla del sticky de AGENTS.md con otro ancestro. Se monta
          sólo después de un click, así que `document` siempre existe acá. */}
      {pidiendoEmail && createPortal(
        <Modal
          titulo={`Abrirle una cuenta a ${c.nombre || 'este cliente'}`}
          encabezado="Cuenta de MaKo"
          ancho={440}
          /* ⚠️ `anidada`: se abre DESDE un control de la ficha y es parte de la misma
             tarea, así que la de atrás se sigue viendo. Sin esto la ficha desaparece
             y parece que el botón la cerró. */
          anidada
          onCerrar={() => setPidiendoEmail(false)}
          pie={
            <>
              <button type="button" className="cmk-no" onClick={() => setPidiendoEmail(false)}>Cancelar</button>
              {/* El botón dice LO QUE PASA. «Crear» no cuenta que se le va a escribir
                  a alguien, y lo que sigue no se deshace. */}
              <button type="button" className="cmk-si" disabled={!emailUtilizable(correo) || ocupado}
                onClick={() => void abrir()}>
                {ocupado ? 'Abriendo…' : 'Abrir la cuenta'}
              </button>
            </>
          }
        >
          <label className="cmk-lab" htmlFor="cmk-correo">Email de {c.nombre || 'el cliente'}</label>
          <input id="cmk-correo" className="cmk-in" type="email" autoFocus value={correo}
            placeholder="persona@empresa.com"
            onChange={(e) => setCorreo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && emailUtilizable(correo)) void abrir(); }} />
          {/* La consecuencia, pegada al control y ANTES del click: el acceso no sale
              ahora, sale cuando el super admin apruebe. Decirlo después sería una
              sorpresa. */}
          <p className="cmk-ayuda">
            Ahí le llega su acceso, cuando se apruebe la cuenta.
          </p>
        </Modal>,
        document.body,
      )}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la
// mitad y la ruta contesta 200 con el layout entero y sin cuerpo.
//
// El molde es `.fc-quitar`, que vivía en FichaCliente como CSS huérfano desde que
// «Quitar la foto» se fue: flex:none, sin caja, 12px, tinta apagada y pegado a la
// base con margin-bottom. `flex:none` es lo que importa — el que CEDE es `.fc-txt`,
// que ya declara flex:1.
const CSS = `
/* ⚠️ align-self CONTRA EL align-items:flex-end DE LA FILA. Sin esto el control cae
   a la BASE, o sea a la altura del renglon de la empresa, y el pedido era «a la
   misma altura» — la del nombre, que es donde ya vive el CRM. El margen de arriba
   lo centra contra esa linea de 20px/1.2.
   (Y sin backticks: adentro de esta cadena cierran el string a la mitad.) */
.cmk{ flex:none; align-self:flex-start; margin-top:4px; display:inline-flex; align-items:center; gap:5px;
  background:none; border:0; padding:0; font:inherit; font-size:12px; font-weight:600;
  color:var(--faint); text-decoration:none; cursor:pointer; white-space:nowrap; }
.cmk:hover:not(:disabled){ color:var(--primary); }
.cmk:disabled{ opacity:.6; cursor:default; }
.cmk-ok{ color:var(--primary); }
/* Un estado no es un control: ni cursor, ni hover, ni tinta de accion. */
.cmk-est{ cursor:default; font-weight:500; }
.cmk-est:hover{ color:var(--faint); }

/* La variante de TARJETA: la misma pildora que la grilla de la plataforma. Acá el
   control no compite con un nombre grande —esta solo, al pie de la tarjeta— y lo que
   hace falta es que se vea que es un boton. align-self vuelve a auto: en la tarjeta
   la fila de acciones ya lo ubica. */
.cmk-btn{ align-self:auto; margin-top:0; padding:7px 12px; font-size:12.5px; border-radius:9px;
  background:var(--surface-2); color:var(--ink); }
.cmk-btn.cmk-ok{ background:var(--primary); color:#fff; }
.cmk-btn.cmk-ok:hover:not(:disabled){ color:#fff; filter:brightness(1.06); }
.cmk-btn.cmk-est{ background:none; padding:7px 0; color:var(--faint); }

.cmk-lab{ display:block; font-size:12.5px; font-weight:600; color:var(--dim); margin-bottom:6px; }
.cmk-in{ width:100%; border:1px solid var(--border); border-radius:10px; padding:10px 12px;
  font:inherit; font-size:14px; background:var(--surface); color:var(--ink); }
.cmk-ayuda{ margin:10px 2px 0; font-size:12.5px; color:var(--faint); line-height:1.5; }
.cmk-no, .cmk-si{ border-radius:10px; padding:9px 16px; font:inherit; font-size:13.5px;
  font-weight:600; cursor:pointer; }
.cmk-no{ border:1px solid var(--border-strong); background:var(--surface); color:var(--dim); }
.cmk-si{ border:0; background:var(--primary); color:#fff; }
.cmk-si:disabled{ opacity:.5; cursor:default; }
`;
