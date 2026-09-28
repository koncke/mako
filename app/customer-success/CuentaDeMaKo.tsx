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
// afirmación sobre algo que a ese cliente no le incumbe. Ahora se dibuja sólo
// para el super admin y para una agencia habilitada, y lo decide el SERVER
// (`cuentas.visible`, app/customer-success/page.tsx).
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
  /** Quién ve este control: sólo el super admin y una agencia habilitada. */
  visible: boolean;
  /** Decide el mecanismo de entrada, no el permiso. */
  superAdmin: boolean;
  /** El plan de cada cliente con cuenta, para el chip de su tarjeta. Sólo los aprobados. */
  planPorWs?: Record<number, string>;
  /** El equipo de cada cliente con cuenta, para la tab «Equipo» de su ficha. */
  equipoPorWs?: Record<number, MiembroDeCliente[]>;
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

  if (!cuentas?.visible) return null;

  const ws = c.clienteWs ?? null;
  const estado = ws ? (cuentas.estadoPorWs[ws] as EstadoCartera | undefined) : undefined;

  const abrir = async () => {
    setOcupado(true);
    const r = await crearCuentaMakoAction(c.leadId);
    if (!r.ok) { onError(r.error); setOcupado(false); return; }
    // ⚠️ `router.refresh()` Y NO `location.reload()`. Qué cliente está abierto es
    // estado de React en ClientesApp y no viaja en la URL, así que recargar
    // CIERRA la ficha: se leía como «le di a Abrir cuenta y me sacó». Es la misma
    // trampa que FichaCliente documenta para el tablero, y por eso ahí ya se
    // refresca en vez de recargar.
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
        <button type="button" className={cls} onClick={abrir} disabled={ocupado}
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

  if (!control) return null;
  return <>{control}<style dangerouslySetInnerHTML={{ __html: CSS }} /></>;
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
`;
