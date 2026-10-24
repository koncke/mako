'use client';

// =============================================================================
// Las cuentas de IA y sus dispositivos — el MISMO dibujo para el cliente y para SuperAdmin (23/10/2026)
// =============================================================================
// Martín (por el Cerebro, con capturas del ws1): bloques bien separados. Cada cuenta conectada es UN bloque con título grande,
// «Cuenta 1», «Cuenta 2» (no el nombre de la computadora), con su email (la regla del enmascarado), su plan y el uso de la
// sesión de 5 horas y de la semana; abajo, dentro de esa cuenta, sus DISPOSITIVOS —cada uno con su nombre, en línea o no, dónde
// está como lo muestra Google en «Tus dispositivos» («Windows · Grandbourg, Buenos Aires, Argentina») y «Desconectar»—, y ahí
// «Nuevo dispositivo», que se distingue bien de «Nueva cuenta». Lo usan «Tus cuentas de IA» (app/integraciones/TusCuentasIA.tsx,
// en la computadora, en el teléfono del Ops Center y en /perfil/ia) y SuperAdmin › Uso → Computadoras (UsoComputadoras.tsx).
// Los datos llegan agrupados del servidor (lib/ia-pc-reglas.ts → agruparPorCuenta): acá sólo se dibuja.
// ⚠️ SIN IMPORTAR SU CSS: los tests lo dibujan en node (UsoComputadoras.tsx), que no carga un .css. Lo importa quien lo monta:
// TusCuentasIA.tsx y las páginas del super admin (app/admin/operaciones/page.tsx, app/m/operaciones/page.tsx).
// =============================================================================

import { useState, type ReactNode } from 'react';
import { ClaudeMark } from '@/app/_components/icons';
import { SvcIcon } from '@/app/_components/ServicioVisual';
import { hace } from '@/lib/progreso-reglas';
import { AVISO_GATEKEEPER, AVISO_SMARTSCREEN, dondeEsta, estadoDeLaPc, yaPaso, type CuentaIA, type CuentasIA, type DispositivoIA } from '@/lib/ia-pc-reglas';

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

/** Un dispositivo: su nombre, en línea o no, dónde está, cuándo se conectó y «Desconectar» (pide confirmar). */
export function FilaDispositivo({ d, ahora, onDesconectar, children }: { d: DispositivoIA; ahora: number; onDesconectar?: (d: DispositivoIA) => Promise<unknown> | void; children?: ReactNode }) {
  const [seguro, setSeguro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const tono = d.enLinea && d.conCuenta ? 'linea' : d.enLinea ? 'esperando' : 'apagada';
  const donde = dondeEsta(d);
  const desconectar = async () => {
    if (!onDesconectar) return;
    setOcupado(true);
    try { await onDesconectar(d); } finally { setOcupado(false); setSeguro(false); }
  };
  return (
    <li className="tci-disp" data-dispositivo={d.id}>
      <div className="tci-fila">
        <span className="tci-disp__nombre">{d.nombre}{d.de ? <span className="tci-nota"> · de {d.de}</span> : null}</span>
        <span className="tci-estado">
          <span className={`tci-punto tci-punto--${tono}`} aria-hidden />
          {estadoDeLaPc({ enLinea: d.enLinea, ultimoLatido: d.ultimoLatido, cuentas: d.conCuenta ? [d.id] : [], sinClaude: d.sinClaude }, ahora, hace)}
        </span>
      </div>
      {donde && <p className="tci-nota tci-disp__donde">{donde}</p>}
      {d.conectadaAt && <p className="tci-nota">{`Conectada el ${fechaCorta(d.conectadaAt)}`}</p>}
      {onDesconectar && (
        <div className="tci-acciones">
          {seguro
            ? <>
              <span className="tci-nota">{d.de ? `¿Desconectarla? El chat de ${d.de} deja de usarla.` : '¿Desconectarla? Tu chat deja de usarla.'}</span>
              <button type="button" className="tci-boton tci-boton--peligro" disabled={ocupado} onClick={() => void desconectar()}>{ocupado ? 'Desconectando…' : 'Desconectar'}</button>
              <button type="button" className="tci-boton tci-boton--suave" disabled={ocupado} onClick={() => setSeguro(false)}>Cancelar</button>
            </>
            : <button type="button" className="tci-boton tci-boton--suave" onClick={() => setSeguro(true)}>Desconectar</button>}
        </div>
      )}
      {children}
    </li>
  );
}

/** Una cuenta conectada: «Cuenta N» grande, su email y su plan, su uso, y abajo sus dispositivos. */
export function BloqueCuenta({ cuenta, ahora, onDesconectar, nuevoDispositivo }: {
  cuenta: CuentaIA; ahora: number; onDesconectar?: (d: DispositivoIA) => Promise<unknown> | void; nuevoDispositivo?: ReactNode;
}) {
  const titulo = `Cuenta ${cuenta.numero}`;
  return (
    <section className="tci-bloque" aria-label={titulo} data-cuenta={cuenta.numero}>
      <h3 className="tci-bloque__titulo">{titulo}</h3>
      <div className="tci-quien">
        {cuenta.proveedor === 'chatgpt' ? <SvcIcon k="openai" size={14} box={22} radius={6} /> : <ClaudeMark size={20} />}
        <span className="tci-nombres">
          <span>{cuenta.email ?? (cuenta.proveedor === 'chatgpt' ? 'Tu cuenta de ChatGPT' : 'Tu cuenta de Claude')}{cuenta.plan && <span className="tci-plan">{cuenta.plan}</span>}</span>
        </span>
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

/**
 * «Nuevo dispositivo», dentro de una cuenta: la DESCARGA a la vista —el instalador de Windows (0.4.0) o MaKo.app para la Mac
 * (0.4.2), según la computadora desde la que se mira, y el otro a un toque— y, ya instalado, conectar.
 */
export function NuevoDispositivo({ onConectar, titulo = 'Nuevo dispositivo', nota = 'Instala MaKo en otra computadora y conéctala: puede usar esta misma cuenta de Claude.' }: {
  onConectar: () => void; onPasosMac?: () => void;
  /** Lo que dice arriba: el chat, cuando todavía no hay ninguna computadora, lo dice como la primera (app/_chat/AppPrimero.tsx). */
  titulo?: string; nota?: string;
}) {
  const esMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
  const sistemas = esMac ? (['mac', 'windows'] as const) : (['windows', 'mac'] as const);
  const nombre = { windows: 'Windows', mac: 'Mac' } as const;
  return (
    <div className="tci-nuevo-disp" role="group" aria-label={titulo}>
      <h4>{titulo}</h4>
      <p className="tci-nota">{nota}</p>
      <div className="tci-nuevo-disp__acciones">
        <a className="tci-boton" href={`/api/ia-pc/descargar?os=${sistemas[0]}`}>{`Descargar MaKo para ${nombre[sistemas[0]]}`}</a>
        <button type="button" className="tci-boton tci-boton--suave" onClick={onConectar}>Ya lo instalé: conectar</button>
      </div>
      <p className="tci-nota">{sistemas[0] === 'mac' ? AVISO_GATEKEEPER : AVISO_SMARTSCREEN}</p>
      <p className="tci-nota"><a href={`/api/ia-pc/descargar?os=${sistemas[1]}`}>{`¿Es una ${sistemas[1] === 'mac' ? 'Mac' : 'computadora con Windows'}? Descárgalo para ${nombre[sistemas[1]]}`}</a></p>
    </div>
  );
}
