'use client';

// =============================================================================
// Equipo en el teléfono: la lista, la hoja de cada persona y la de invitar (Slack y Ajustes de iOS)
// =============================================================================
// Las mismas cinco acciones que la computadora, por la misma ruta (/api/equipo): `invitar`, `rolws`, `reinvitar`,
// `estado` y `eliminar`. Lo que cada una le dice a la persona es el mismo texto (`avisoInvitacion`). Eliminar pide
// confirmación DENTRO de la hoja, como el «Eliminar» de Ajustes de iOS: un segundo toque que dice a quién.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { haptico } from '@/lib/haptico';
import { avisoInvitacion, type AvisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';
import {
  AvatarM, ErrorM, FilaDatoM, FilaM, ListaM, PieFijoM, PieM, PildoraM, SeccionM, SegmentadoM, SheetM, SkeletonFilas, VacioM,
  useToastM, type TonoPildora,
} from '@/app/m/_ui';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

type Rol = 'admin' | 'closer' | 'setter';
export type Miembro = {
  id: number; email: string; nombre: string; foto_url: string | null;
  estado: 'invitado' | 'activo' | 'suspendido'; rol_ws: Rol | null; ultimo_login: string | null;
  invitacion_enviada_at: string | null;
};
/** `pasarAPro`: el tope de usuarios del plan (lib/tope-equipo-reglas.ts). El teléfono sólo dice que llegó: no vende (T5). */
type Respuesta = { ok: boolean; error?: string; invitacion?: ResultadoInvitacion | null; pasarAPro?: string };

/** Los roles en el orden y con los rótulos de la computadora (`ROL_OPTS` de EquipoView.tsx). */
const ROLES: { id: Rol; label: string }[] = [{ id: 'setter', label: 'Setter' }, { id: 'closer', label: 'Closer' }, { id: 'admin', label: 'Admin' }];
const rotuloRol = (r: Rol | null) => ROLES.find((x) => x.id === (r ?? 'admin'))?.label ?? 'Admin';

/** El estado, con las palabras de la computadora (`ChipEstado`): «sin avisar» si nunca se le mandó el acceso. */
function estadoDe(u: Miembro): { texto: string; tono: TonoPildora } | null {
  if (u.estado === 'suspendido') return { texto: 'Suspendido', tono: 'bad' };
  if (u.estado === 'invitado') return u.invitacion_enviada_at ? { texto: 'Invitado', tono: 'warn' } : { texto: 'Sin avisar', tono: 'bad' };
  return null;
}

function ultimoIngreso(iso: string | null): string {
  if (!iso) return 'Nunca entró';
  const d = new Date(iso);
  return `Entró el ${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
}

async function post(body: Record<string, unknown>): Promise<Respuesta> {
  try {
    const r = await fetch('/api/equipo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    return (await r.json()) as Respuesta;
  } catch {
    return { ok: false, error: 'No se pudo guardar. Revisa tu conexión.' };
  }
}

export function EquipoM({ iniciales }: { iniciales: Miembro[] | null }) {
  const toast = useToastM();
  const [equipo, setEquipo] = useState<Miembro[] | null>(iniciales);
  const [errCarga, setErrCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoInvitacion | null>(null);
  const [abierto, setAbierto] = useState<Miembro | null>(null);
  const [invitando, setInvitando] = useState(false);

  const cargar = useCallback(async () => {
    setErrCarga(null);
    try {
      const j = (await (await fetch('/api/equipo', { signal: AbortSignal.timeout(30_000) })).json()) as { ok: boolean; error?: string; equipo?: Miembro[] };
      if (!j.ok) { setErrCarga(j.error ?? 'No se pudo cargar el equipo.'); return; }
      setEquipo(j.equipo ?? []);
    } catch {
      setErrCarga('No se pudo cargar el equipo. Revisa tu conexión.');
    }
  }, []);
  // ⚠️ ABRE CON LO QUE LEYÓ EL SERVER (17/10/2026, «que el teléfono ande más rápido»): sin esto pintaba un esqueleto y
  // recién después pedía la lista (otra ida y vuelta). La página la monta con `key` nuevo en cada pasada del server
  // (tirar hacia abajo trae lo nuevo); si el server no pudo leer (`null`), se pide como en la computadora.
  useEffect(() => { if (iniciales == null) void cargar(); }, [cargar, iniciales]);

  /** Una acción sobre una persona: guarda, recarga y dice lo que pasó en 3-4 palabras. */
  const accion = async (body: Record<string, unknown>, listo: string): Promise<boolean> => {
    const j = await post(body);
    if (!j.ok) { haptico('error'); toast(j.error ?? 'No se pudo guardar'); return false; }
    haptico('success');
    toast(listo);
    await cargar();
    return true;
  };

  if (errCarga) return <ErrorM frase={errCarga} onReintentar={() => { void cargar(); }} />;
  if (!equipo) return <SkeletonFilas />;

  return (
    <>
      {aviso && <p className="m-configuraciones-aviso" data-tono={aviso.tono === 'ok' ? undefined : 'warn'} role="status">{aviso.texto}</p>}
      {equipo.length === 0 ? (
        <VacioM frase="Todavía no hay nadie más. Suma a tu Closer o Setter." />
      ) : (
        <SeccionM titulo="Tu equipo">
          <ListaM>
            {equipo.map((u) => {
              const e = estadoDe(u);
              return (
                <FilaM key={u.id}
                  // eslint-disable-next-line @next/next/no-img-element
                  leading={u.foto_url ? <img className="m-configuraciones-foto" src={u.foto_url} alt="" /> : <AvatarM nombre={u.nombre || u.email} email={u.email} />}
                  titulo={u.nombre || u.email} segunda={u.nombre ? u.email : ultimoIngreso(u.ultimo_login)}
                  riel={<span className="m-configuraciones-rol">{rotuloRol(u.rol_ws)}</span>}
                  pill={e ? <PildoraM tono={e.tono}>{e.texto}</PildoraM> : undefined}
                  onClick={() => setAbierto(u)} />
              );
            })}
          </ListaM>
        </SeccionM>
      )}
      <PieFijoM>
        <Button variant="primary" size="lg" full onClick={() => setInvitando(true)}>Sumar al equipo</Button>
      </PieFijoM>
      <HojaMiembro u={abierto} onCerrar={() => setAbierto(null)} accion={accion}
        onReenviado={(a) => setAviso(a)} onCambio={(u) => setAbierto(u)} />
      <HojaInvitar abierta={invitando} onCerrar={() => setInvitando(false)}
        onInvitado={async (a) => { setAviso(a); setInvitando(false); toast(a.tono === 'ok' ? 'Acceso enviado' : 'Falta un paso'); await cargar(); }} />
    </>
  );
}

function HojaMiembro({ u, onCerrar, accion, onReenviado, onCambio }: {
  u: Miembro | null;
  onCerrar: () => void;
  accion: (body: Record<string, unknown>, listo: string) => Promise<boolean>;
  onReenviado: (a: AvisoInvitacion) => void;
  onCambio: (u: Miembro) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  // El sub-estado se resetea al ABRIR la próxima (LEEME de app/m/_ui), nunca al cerrar.
  useEffect(() => { if (u) setConfirmar(false); }, [u?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const nombre = u ? (u.nombre || u.email) : '';
  const correr = async (body: Record<string, unknown>, listo: string, cerrar = false) => {
    if (!u || ocupado) return;
    setOcupado(true);
    try {
      const ok = await accion(body, listo);
      if (ok && cerrar) onCerrar();
    } finally { setOcupado(false); }
  };
  const reenviar = async () => {
    if (!u || ocupado) return;
    setOcupado(true);
    try {
      const j = await post({ action: 'reinvitar', id: u.id });
      if (!j.ok) { haptico('error'); onReenviado({ tono: 'warn', texto: j.error ?? 'No se pudo reenviar el acceso.' }); onCerrar(); return; }
      haptico('success');
      onReenviado(avisoInvitacion(j.invitacion, u.email));
      onCerrar();
    } finally { setOcupado(false); }
  };
  return (
    <SheetM id="miembro" abierto={u != null} onCerrar={onCerrar} titulo={nombre} ocupado={ocupado}
      pie={u ? (
        <PieM consecuencia={confirmar ? 'Pierde el acceso a MaKo. No se puede deshacer.' : undefined}>
          {confirmar
            ? <Button variant="danger" size="lg" full loading={ocupado} onClick={() => { void correr({ action: 'eliminar', id: u.id }, 'Eliminado', true); }}>{`Eliminar a ${nombre}`}</Button>
            : <button type="button" className="m-configuraciones-borrar" disabled={ocupado} onClick={() => setConfirmar(true)}>Eliminar del equipo</button>}
        </PieM>
      ) : undefined}>
      {u && (
        <>
          <ListaM>
            <FilaDatoM k="Email" v={u.email} />
            <FilaDatoM k="Último ingreso" v={ultimoIngreso(u.ultimo_login)} />
          </ListaM>
          <div className="m-configuraciones-campo">
            <span>Rol en el negocio</span>
            <SegmentadoM etiqueta="Rol" valor={u.rol_ws ?? 'admin'} opciones={ROLES}
              onCambio={(r) => { if (ocupado) return; onCambio({ ...u, rol_ws: r }); void correr({ action: 'rolws', id: u.id, rol_ws: r }, `Ahora es ${rotuloRol(r)}`); }} />
          </div>
          <ListaM>
            <FilaM navegacion icono="email" titulo={u.invitacion_enviada_at ? 'Reenviar el acceso' : 'Mandarle el acceso'} chevron={false}
              deshabilitada={ocupado} onClick={() => { void reenviar(); }} />
            <FilaM navegacion icono={u.estado === 'suspendido' ? 'play' : 'pausa'} titulo={u.estado === 'suspendido' ? 'Reactivar' : 'Suspender'} chevron={false}
              deshabilitada={ocupado}
              onClick={() => { void correr({ action: 'estado', id: u.id, estado: u.estado === 'suspendido' ? 'activo' : 'suspendido' }, u.estado === 'suspendido' ? 'Reactivado' : 'Suspendido', true); }} />
          </ListaM>
        </>
      )}
    </SheetM>
  );
}

function HojaInvitar({ abierta, onCerrar, onInvitado }: { abierta: boolean; onCerrar: () => void; onInvitado: (a: AvisoInvitacion) => void }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<Rol>('setter');
  const [error, setError] = useState<string | null>(null);
  // El tope del plan no es un error para reportar: va aparte, sin «Pasar a Pro» (el teléfono no vende, T5).
  const [tope, setTope] = useState(false);
  const [mandando, setMandando] = useState(false);
  useEffect(() => { if (abierta) { setError(null); setTope(false); } }, [abierta]);
  const invitar = async () => {
    if (mandando) return;
    const destino = email.trim();
    if (!destino) { setError('Falta el email'); return; }
    setMandando(true); setError(null); setTope(false);
    try {
      const j = await post({ action: 'invitar', email: destino, nombre: nombre.trim(), rol_ws: rol });
      if (!j.ok && j.pasarAPro) { haptico('error'); setTope(true); return; }
      if (!j.ok) { haptico('error'); setError(j.error ?? 'No se pudo invitar.'); return; }
      haptico('success');
      setNombre(''); setEmail(''); setRol('setter');
      onInvitado(avisoInvitacion(j.invitacion, destino));
    } finally { setMandando(false); }
  };
  return (
    <SheetM id="invitar" abierto={abierta} onCerrar={onCerrar} titulo="Sumar al equipo" snap="alto" ocupado={mandando} rotuloCerrar="Cerrar sin invitar"
      pie={(
        <PieM consecuencia="MaKo le manda el acceso por email.">
          <Button variant="primary" size="lg" full loading={mandando} onClick={() => { void invitar(); }}>Invitar</Button>
        </PieM>
      )}>
      <label className="m-configuraciones-campo">
        <span>Nombre</span>
        <input className="m-configuraciones-entrada" value={nombre} autoComplete="name" placeholder="Nombre y apellido" onChange={(e) => setNombre(e.target.value)} />
      </label>
      <label className="m-configuraciones-campo">
        <span>Email</span>
        <input className="m-configuraciones-entrada" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email}
          placeholder="persona@email.com" onChange={(e) => { setEmail(e.target.value); setError(null); }} />
      </label>
      <div className="m-configuraciones-campo">
        <span>Rol</span>
        <SegmentadoM etiqueta="Rol" valor={rol} opciones={ROLES} onCambio={setRol} />
      </div>
      {tope && <p className="m-configuraciones-aviso" data-tono="warn" role="status">Llegaste al tope de tu plan.</p>}
      {error && <p className="m-configuraciones-aviso" data-tono="bad" role="alert">{error}<ReportarASoporte /></p>}
    </SheetM>
  );
}
