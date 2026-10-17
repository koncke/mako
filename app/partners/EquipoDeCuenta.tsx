'use client';

// =============================================================================
// EquipoDeCuenta — quiénes entran a la cuenta de MaKo de un cliente de la agencia, y pedir sumar a alguien
// =============================================================================
// Vivía en la ficha de un cliente de Clientes (`EquipoDelCliente`, app/customer-success/FichaCliente.tsx) y se mudó
// acá con MaKo Partners el 17/10/2026: el equipo es de la CUENTA de MaKo, y las cuentas de agencia viven en Partners
// (docs/diseno-clients.md, D8). Las reglas son las mismas y siguen escritas al lado de cada una.
//
// ⚠️ ES UNA LISTA, NO UNA PILA DE TARJETAS (filete, no caja), y los PEDIDOS van en la MISMA lista, atenuados: la
//    pregunta es «¿quién entra a esta cuenta?» y la respuesta incluye a quien está a una firma de entrar.
// ⚠️ DOS DESTINOS, UN FORMULARIO: la agencia PIDE (`/api/agencia/altas`, queda pendiente de una firma); el super admin
//    CREA (`/api/admin/usuarios`, la persona entra y le llega el acceso en el acto).

import { useState } from 'react';
import { Marca } from '@/app/_components/Marca';
import { ROTULO_ALTA, ROTULO_ROL, ROLES_ALTA, emailUtilizable, type EstadoAlta, type RolAlta } from '@/lib/agencia-altas';
import { avisoInvitacion, type AvisoInvitacion } from '@/lib/invitacion-aviso';
import type { FilaAlta } from '@/lib/agencia';
import type { MiembroCuenta } from '@/lib/partners';
// El color de la inicial de quien no tiene foto: el MISMO de las tarjetas de la casa (una persona, un color).
import { colorDe } from '@/app/_components/TarjetaEntidad';

const ROL_EQUIPO: Record<string, string> = { admin: 'Admin', closer: 'Closer', setter: 'Setter' };

export function EquipoDeCuenta({ equipo, altas, clienteWs, puedePedir, puedeSumar, onError, onPedido }: {
  /** `null` = no se pudo leer: no es «nadie» (lib/partners.ts). */
  equipo: MiembroCuenta[] | null;
  altas: FilaAlta[];
  clienteWs: number;
  puedePedir: boolean;
  puedeSumar: boolean;
  onError: (m: string) => void;
  onPedido: () => void;
}) {
  const [pidiendo, setPidiendo] = useState(false);
  const [mandando, setMandando] = useState(false);
  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  const [rol, setRol] = useState<RolAlta>('admin');
  /** Si el mail de acceso SALIÓ, cuando suma el super admin (09/10/2026: sumar no es «le llegó»). */
  const [envio, setEnvio] = useState<AvisoInvitacion | null>(null);

  // Los rechazados también se ven (si no, se vuelve a pedir lo que ya se rechazó); los aprobados ya están arriba.
  const visibles = altas.filter((a) => a.estado !== 'aprobada');

  const pedir = async () => {
    if (!emailUtilizable(email) || mandando) return;
    setMandando(true);
    onError('');
    setEnvio(null);
    try {
      const j = await (await fetch(puedeSumar ? '/api/admin/usuarios' : '/api/agencia/altas', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(puedeSumar
          ? { action: 'crear', email: email.trim(), nombre: nom.trim(), rol: 'usuario', workspace_id: clienteWs, rol_ws: rol }
          : { clienteWs, email: email.trim(), nombre: nom.trim(), rolWs: rol }),
      })).json();
      if (!j?.ok) { onError(j?.error ?? (puedeSumar ? 'No se pudo sumar.' : 'No se pudo pedir.')); return; }
      if (puedeSumar) setEnvio(avisoInvitacion(j.invitacion, email.trim()));
      setEmail(''); setNom(''); setPidiendo(false);
      onPedido();
    } catch {
      onError('No se pudo pedir.');
    } finally { setMandando(false); }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {equipo == null ? (
        <p className="pt-eq-nada">No pude leer su equipo.</p>
      ) : equipo.length === 0 && visibles.length === 0 ? (
        // «Nadie MÁS» decía lo contrario: acá vacío es CERO personas, ni siquiera el dueño de la cuenta.
        <p className="pt-eq-nada">
          Esta cuenta todavía no tiene a nadie adentro, así que <b>no puede entrar nadie</b>
          {puedeSumar || puedePedir ? '. Suma a la persona que la va a usar.' : '.'}
        </p>
      ) : (
        <ul className="pt-eq">
          {equipo.map((u) => (
            <li key={u.id}>
              <Marca icono={null} foto={u.foto} nombre={u.nombre} tam={34} color={colorDe(u.nombre)} />
              <span className="t"><b>{u.nombre}</b><span>{u.email}</span></span>
              <span className="rol">{ROL_EQUIPO[u.rol] ?? u.rol}</span>
            </li>
          ))}
          {visibles.map((a) => (
            <li key={'alta-' + a.id} className="pend">
              <Marca icono={null} foto={null} nombre={a.nombre || a.email} tam={34} color={colorDe(a.email)} />
              <span className="t"><b>{a.nombre || a.email}</b>{a.nombre && <span>{a.email}</span>}</span>
              <span className="rol">{ROTULO_ROL[a.rol_ws as RolAlta] ?? a.rol_ws}</span>
              <span className={a.estado === 'rechazada' ? 'est mal' : 'est'}>{ROTULO_ALTA[a.estado as EstadoAlta] ?? a.estado}</span>
            </li>
          ))}
        </ul>
      )}

      {envio && <p className={envio.tono === 'warn' ? 'pt-envio mal' : 'pt-envio'}>{envio.texto}</p>}

      {(puedePedir || puedeSumar) && (pidiendo ? (
        <div className="pt-pedir">
          <input className="pt-in" type="email" value={email} placeholder="persona@empresa.com" data-autofocus
            onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void pedir(); }} />
          <input className="pt-in" value={nom} placeholder="Nombre (opcional)"
            onChange={(e) => setNom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void pedir(); }} />
          <select className="pt-in pt-sel" value={rol} onChange={(e) => setRol(e.target.value as RolAlta)} aria-label="Rol en el negocio">
            {ROLES_ALTA.map((r) => <option key={r} value={r}>{ROTULO_ROL[r]}</option>)}
          </select>
          {/* El botón dice lo que pasa: para la agencia queda esperando una firma; para el super admin entra y le
              llega el mail. */}
          <button type="button" className="pt-ok" disabled={!emailUtilizable(email) || mandando} onClick={() => void pedir()}>
            {mandando ? (puedeSumar ? 'Sumando…' : 'Pidiendo…') : (puedeSumar ? 'Sumar y mandarle el acceso' : 'Pedir')}
          </button>
          <button type="button" className="pt-no" onClick={() => setPidiendo(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className="pt-sumar" onClick={() => setPidiendo(true)}>
          {puedeSumar ? 'Sumar a alguien' : 'Pedir sumar a alguien'}
        </button>
      ))}
    </>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad.
const CSS = `
.pt-eq{ list-style:none; margin:0; padding:0; }
.pt-eq li{ display:flex; align-items:center; gap:12px; padding:12px 2px; border-bottom:1px solid var(--border); }
.pt-eq li:last-child{ border-bottom:0; }
.pt-eq .t{ display:flex; flex-direction:column; gap:1px; min-width:0; flex:1; }
.pt-eq .t b{ font-size:14px; font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-eq .t span{ font-size:12.5px; color:var(--dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-eq .rol{ flex:none; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; background:var(--surface-2); color:var(--dim); }
.pt-eq-nada{ margin:16px 2px; font-size:13.5px; color:var(--faint); }
.pt-envio{ margin:12px 2px 0; font-size:13px; color:var(--good); }
.pt-envio.mal{ color:var(--bad); }
.pt-eq li.pend{ opacity:.72; }
.pt-eq .est{ flex:none; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; background:var(--warn-bg); color:var(--warn); white-space:nowrap; }
.pt-eq .est.mal{ background:var(--bad-bg); color:var(--bad); }
.pt-sumar{ margin-top:14px; border:1px dashed var(--border-strong); background:none; border-radius:10px; padding:9px 14px;
  font:inherit; font-size:13px; font-weight:600; color:var(--dim); cursor:pointer; }
.pt-sumar:hover{ color:var(--primary); border-color:var(--primary); }
.pt-pedir{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:14px; }
.pt-in{ flex:1 1 180px; min-width:0; border:1px solid var(--border); border-radius:9px; padding:9px 11px; font:inherit;
  font-size:13.5px; background:var(--surface); color:var(--ink); }
.pt-sel{ flex:0 0 130px; }
.pt-ok, .pt-no{ flex:none; border-radius:9px; padding:9px 14px; font:inherit; font-size:13px; font-weight:600; cursor:pointer; }
.pt-ok{ border:1px solid var(--primary); background:var(--primary); color:#fff; }
.pt-ok:disabled{ opacity:.5; cursor:default; }
.pt-no{ border:1px solid var(--border); background:var(--surface); color:var(--dim); }
`;
