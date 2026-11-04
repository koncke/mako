'use client';

// =============================================================================
// Quién está en el grupo: ver, invitar, sacar y salir (3/11/2026)
// =============================================================================
// Martín: «que le puedan, por ejemplo, invitar a otros usuarios de MaKo, en este caso a Joan y a Juanfran». Una hoja simple: en la computadora en un Modal, en el teléfono adentro de la
// hoja del grupo con su «‹» (una hoja nueva la reemplazaría y cerraría la conversación).
//
// ⚠️ INVITAR ES POR EMAIL EXACTO, NUNCA UN BUSCADOR: expondría los clientes de MaKo. La respuesta es la misma tenga o no cuenta (lib/grupo-app.ts), y la pantalla tampoco lo distingue.
// ⚠️ A UN INVITADO NO LE LLEGA NINGÚN EMAIL y no ve «Invitar» ni «Sacar»: lo corta el servidor; acá sólo no se le ofrece lo que le daría 404.

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/app/_ui/Button';
import { Input } from '@/app/_ui/Field';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { iniciales } from '@/lib/unicode-seguro';
import './grupo.css';

export type Participante = {
  nombre: string; tipo: 'admin' | 'agencia' | 'invitado'; propio: boolean; email?: string; porQue?: string; fotoUrl?: string;
};
export type DatosDeMiembros = {
  participantes: Participante[]; administra: boolean; invitado: boolean; sugeridos: Array<{ nombre: string; email: string }>; frase: string; topeInvitados: number;
};

/** Por qué está. A quien todavía sale como «Invitado» no se le repite. */
const rotuloDe = (p: Participante): string => p.porQue ?? (p.tipo === 'invitado' && p.nombre !== 'Invitado' ? 'Invitado' : '');

/** Lo que se ve, sin pedidos: es lo que depende del rol, y se dibuja en un test. */
export function VistaParticipantes({ datos, email, onEmail, onInvitar, invitando, aviso, error, onSacar, sacando, onSalir, confirmaSalir, onConfirmaSalir, saliendo }: {
  datos: DatosDeMiembros;
  email: string;
  onEmail: (v: string) => void;
  onInvitar: (email: string) => void;
  invitando: boolean;
  aviso: string | null;
  error: string | null;
  onSacar: (email: string) => void;
  sacando: string | null;
  onSalir: () => void;
  confirmaSalir: boolean;
  onConfirmaSalir: (v: boolean) => void;
  saliendo: boolean;
}) {
  const enviar = (e: FormEvent) => { e.preventDefault(); if (email.trim()) onInvitar(email.trim()); };
  return (
    <div className="gr-miembros">
      {datos.administra && (
        <form className="gr-invitar" onSubmit={enviar}>
          <label className="gr-invitar__rotulo" htmlFor="gr-invitar-email">Invitar por email</label>
          <div className="gr-invitar__fila">
            <Input id="gr-invitar-email" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" placeholder="nombre@correo.com" value={email} onChange={(e) => onEmail(e.target.value)} disabled={invitando} />
            <Button type="submit" variant="primary" size="md" loading={invitando} disabled={!email.trim()}>Invitar</Button>
          </div>
          <p className="gr-miembros__nota">{datos.frase}</p>
          {datos.sugeridos.length > 0 && (
            <div className="gr-sugeridos">
              {datos.sugeridos.map((s) => <button key={s.email} type="button" className="co-chip" disabled={invitando} onClick={() => onInvitar(s.email)} title={s.email}>{`Sumar a ${s.nombre}`}</button>)}
            </div>
          )}
        </form>
      )}
      {aviso && <p className="gr-miembros__nota gr-miembros__nota--bien" role="status">{aviso}</p>}
      {error && <p className="co-nota co-nota--mal" role="alert">{error}<ReportarASoporte /></p>}
      <ul className="gr-lista" aria-label="Participantes">
        {datos.participantes.map((p, i) => (
          <li key={p.email ?? `${p.nombre}-${i}`} className="gr-miembro">
            <span className="co-mifoto gr-miembro__foto" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element -- la foto del perfil (Supabase) */}
              {p.fotoUrl ? <img src={p.fotoUrl} alt="" /> : <span>{iniciales(p.nombre, 1, '?')}</span>}
            </span>
            <span className="gr-miembro__texto">
              <span className="gr-miembro__nombre">{p.nombre}{p.propio && <span className="gr-miembro__tu"> · Tú</span>}</span>
              {rotuloDe(p) && <span className="gr-miembro__rotulo">{rotuloDe(p)}</span>}
            </span>
            {/* Sólo se saca a quien entró invitado: quien entra por su rol no tiene fila. */}
            {datos.administra && p.tipo === 'invitado' && p.email && (
              <button type="button" className="co-chip" disabled={sacando === p.email} onClick={() => onSacar(p.email!)}>{sacando === p.email ? 'Sacando…' : 'Sacar'}</button>
            )}
          </li>
        ))}
      </ul>
      {datos.invitado && (
        <div className="gr-salir">
          {confirmaSalir ? (
            <>
              <p className="gr-miembros__nota">Para volver, te tienen que invitar otra vez.</p>
              <div className="gr-invitar__fila">
                <Button variant="danger" size="md" loading={saliendo} onClick={onSalir}>Salir del grupo</Button>
                <Button variant="tertiary" size="md" disabled={saliendo} onClick={() => onConfirmaSalir(false)}>Cancelar</Button>
              </div>
            </>
          ) : <Button variant="tertiary" size="md" onClick={() => onConfirmaSalir(true)}>Salir del grupo</Button>}
        </div>
      )}
    </div>
  );
}

async function pedir(ws: number, init?: RequestInit): Promise<{ ok: boolean; status: number; j: Record<string, unknown> | null }> {
  try {
    const r = await fetch(`/api/grupos/${ws}/miembros`, { cache: 'no-store', ...init });
    const j = await r.json().catch(() => null) as Record<string, unknown> | null;
    return { ok: r.ok && j?.ok === true, status: r.status, j };
  } catch {
    return { ok: false, status: 0, j: null };
  }
}
const conEmail = (metodo: 'POST' | 'DELETE', cuerpo: Record<string, unknown>): RequestInit => ({ method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
/** Lo que dijo el servidor si es para la persona; nunca lo que dijo la red. */
const motivo = (r: { status: number; j: Record<string, unknown> | null }, sino: string): string => (r.status >= 400 && r.status < 500 && r.status !== 404 && typeof r.j?.error === 'string' ? r.j.error : sino);

export function Participantes({ ws, onSalio, onCambio }: { ws: number; onSalio: () => void; onCambio?: () => void }) {
  const [datos, setDatos] = useState<DatosDeMiembros | null>(null);
  const [fase, setFase] = useState<'cargando' | 'listo' | 'error' | 'fuera'>('cargando');
  const [email, setEmail] = useState('');
  const [invitando, setInvitando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sacando, setSacando] = useState<string | null>(null);
  const [confirmaSalir, setConfirmaSalir] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  const leer = useCallback(async () => {
    const r = await pedir(ws);
    if (r.ok && r.j) { setDatos(r.j as unknown as DatosDeMiembros); setFase('listo'); return; }
    // Un fallo después de haberla leído mantiene lo dibujado.
    setFase((f) => (r.status === 404 ? 'fuera' : f === 'listo' ? f : 'error'));
  }, [ws]);
  useEffect(() => { void leer(); }, [leer]);

  const invitar = async (destino: string) => {
    setInvitando(true); setAviso(null); setError(null);
    const r = await pedir(ws, conEmail('POST', { email: destino }));
    setInvitando(false);
    if (!r.ok) { setError(motivo(r, 'No pude invitar. Vuelve a intentarlo.')); return; }
    setEmail('');
    // La misma frase tenga o no cuenta: decir otra cosa serviría para averiguar quién usa MaKo.
    setAviso('Listo. Si usa MaKo, lo verá en sus chats.');
    await leer();
    onCambio?.();
  };
  const sacar = async (destino: string) => {
    setSacando(destino); setAviso(null); setError(null);
    const r = await pedir(ws, conEmail('DELETE', { email: destino }));
    setSacando(null);
    if (!r.ok) { setError(motivo(r, 'No pude sacarlo. Vuelve a intentarlo.')); return; }
    await leer();
    onCambio?.();
  };
  const salir = async () => {
    setSaliendo(true); setError(null);
    const r = await pedir(ws, conEmail('DELETE', { salir: true }));
    setSaliendo(false);
    if (!r.ok) { setError(motivo(r, 'No pude sacarte. Vuelve a intentarlo.')); return; }
    onSalio();
  };

  if (fase === 'fuera') return <p className="gr-miembros__nota" role="status">Ya no estás en este grupo.</p>;
  if (!datos) {
    return fase === 'cargando'
      ? <p className="gr-miembros__nota" role="status">Cargando…</p>
      : <p className="gr-miembros__nota" role="alert">No pude leer los participantes. <button type="button" className="ch-enlace" onClick={() => void leer()}>Reintentar</button><ReportarASoporte /></p>;
  }
  return (
    <VistaParticipantes datos={datos} email={email} onEmail={(v) => { setEmail(v); setError(null); setAviso(null); }} onInvitar={(e) => void invitar(e)} invitando={invitando} aviso={aviso} error={error}
      onSacar={(e) => void sacar(e)} sacando={sacando} onSalir={() => void salir()} confirmaSalir={confirmaSalir} onConfirmaSalir={setConfirmaSalir} saliendo={saliendo} />
  );
}
