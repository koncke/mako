'use client';

// =============================================================================
// AprobacionesDeAgencia — lo que una agencia pidió mirar y todavía nadie firmó
// =============================================================================
// Una agencia le abre cuenta de MaKo a un cliente suyo desde su propia pantalla
// de Clientes, y esa cuenta nace `pendiente`: la agencia crea al cliente, pero
// quien autoriza que MIRE adentro es el super-admin. Son dos decisiones y por
// eso son dos personas — sin ese corte, cualquiera con un workspace se daría de
// alta clientes y se auto-aprobaría el acceso, o sea que el guard no sería un
// guard.
//
// ⚠️ NO SE DIBUJA SI NO HAY NADA QUE FIRMAR, y ésa es la decisión de diseño. Un
// bloque permanente que dice «no hay pedidos» le roba lugar fijo a la pantalla
// para contestar una pregunta que casi nunca se hace. Lo que sí tiene que pasar
// es que cuando HAYA algo, se vea sin buscarlo: por eso va arriba de todo.
//
// ⚠️ Y UN ERROR DE LECTURA NO ES «NO HAY PEDIDOS». Si el GET falla, el bloque lo
// dice en vez de desaparecer: desaparecer haría indistinguible «nadie pidió
// nada» de «no pude preguntar», y la segunda deja a una agencia esperando una
// firma que nadie sabe que tiene pendiente.
//
// ⚠️ DESDE EL 28/09/2026 FIRMA DOS COSAS, Y NO SON LA MISMA. «En super admin, me
// tienen que aparecer las notificaciones de cuando una agencia intenta agregar a
// un nuevo usuario, para poder aceptarlo o rechazarlo». Una CARTERA es dejar
// mirar; un ALTA es crear una cuenta y mandar un mail. Comparten el bloque —es la
// misma bandeja y la misma pregunta, «¿qué espera mi firma?»— y no comparten
// endpoint: mezclarlos haría que aflojar el guard de uno se lleve puesto al otro.

import { useCallback, useEffect, useState } from 'react';
import { ROTULO_ROL, type RolAlta } from '@/lib/agencia-altas';

type Pendiente = {
  agencia_ws: number; cliente_ws: number; estado: string;
  decidido_por: string | null; created_at: string;
};

type Alta = {
  id: number; agencia_ws: number; cliente_ws: number;
  email: string; nombre: string; rol_ws: string;
  pedido_por: string | null; created_at: string;
};

/** Lo que el server contesta al firmar un alta: el aviso es lo que la persona lee. */
type AvisoAlta = { tono: 'ok' | 'warn'; texto: string };

type Ws = { id: number; nombre: string };

/**
 * Lo que /admin necesita saber de las agencias, en UNA lectura: quiénes lo son y
 * qué está esperando firma. Lo comparten el bloque de aprobaciones y el menú de
 * cada workspace — dos pantallas leyendo lo mismo por separado es cómo terminan
 * diciendo cosas distintas sobre el mismo estado.
 */
export function useAgencias() {
  const [pendientes, setPendientes] = useState<Pendiente[] | null>(null);
  const [altas, setAltas] = useState<Alta[] | null>(null);
  const [agencias, setAgencias] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/admin/agencia')).json();
      if (!j?.ok) { setError(j?.error ?? 'No pude leer los pedidos de las agencias.'); return; }
      setError(null);
      setPendientes(j.pendientes as Pendiente[]);
      setAltas((j.altas ?? []) as Alta[]);
      setAgencias(((j.agencias ?? []) as { ws: number }[]).map((a) => a.ws));
    } catch {
      setError('No pude leer los pedidos de las agencias.');
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);
  return { pendientes, altas, agencias, error, setError, cargar };
}

export function AprobacionesDeAgencia({ workspaces, recargar, estado }: {
  workspaces: Ws[];
  recargar: () => Promise<void> | void;
  estado: ReturnType<typeof useAgencias>;
}) {
  const { pendientes: filas, altas, error, setError, cargar } = estado;
  const [ocupado, setOcupado] = useState<string | null>(null);
  /** El resultado de la última firma de un alta, pegado a SU renglón. Un aviso
   *  global no diría a cuál de los pedidos se le creó la cuenta. */
  const [aviso, setAviso] = useState<{ id: number; aviso: AvisoAlta } | null>(null);

  const decidirAlta = async (a: Alta, nuevo: 'aprobada' | 'rechazada') => {
    const clave = `alta-${a.id}`;
    setOcupado(clave);
    setAviso(null);
    try {
      const j = await (await fetch('/api/admin/agencia/altas', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: a.id, estado: nuevo }),
      })).json();
      if (!j?.ok) { setError(j?.error ?? 'No se pudo aplicar.'); return; }
      if (j.aviso) setAviso({ id: a.id, aviso: j.aviso as AvisoAlta });
      await cargar();
      // El alta creó un usuario: la lista de la pantalla de atrás quedó vieja.
      await recargar();
    } catch {
      setError('No se pudo aplicar.');
    } finally { setOcupado(null); }
  };

  const decidir = async (f: Pendiente, estado: 'aprobado' | 'revocado') => {
    const clave = `${f.agencia_ws}-${f.cliente_ws}`;
    setOcupado(clave);
    try {
      const j = await (await fetch('/api/admin/agencia', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agenciaWs: f.agencia_ws, clienteWs: f.cliente_ws, estado }),
      })).json();
      if (!j?.ok) { setError(j?.error ?? 'No se pudo aplicar.'); return; }
      await cargar();
      await recargar();
    } catch {
      setError('No se pudo aplicar.');
    } finally { setOcupado(null); }
  };

  // Ni pedidos, ni altas, ni error: no hay nada que decir y el bloque no ocupa lugar.
  if (!error && !filas?.length && !altas?.length) return null;

  const nombreDe = (id: number) => workspaces.find((w) => w.id === id)?.nombre ?? `Workspace ${id}`;

  return (
    <div style={{
      border: '1px solid var(--accent-soft, var(--border-strong))', borderRadius: 14,
      background: 'var(--surface)', padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>Pedidos de las agencias</div>
        {/* Una frase. Lo que hay que saber para decidir es QUIÉN mira a QUIÉN, y
            eso está en cada renglón: acá sólo va la consecuencia de firmar. */}
        <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4 }}>
          Entrar al dashboard de un cliente, o sumarle a alguien al equipo.
        </div>
      </div>

      {error && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{error}</div>}

      {(filas ?? []).map((f) => {
        const clave = `${f.agencia_ws}-${f.cliente_ws}`;
        const trabajando = ocupado === clave;
        return (
          <div key={clave} style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 11,
            background: 'var(--surface-2)',
          }}>
            <span style={{ fontSize: 14, color: 'var(--ink)', minWidth: 0 }}>
              <b>{nombreDe(f.agencia_ws)}</b> quiere entrar a <b>{nombreDe(f.cliente_ws)}</b>
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button type="button" disabled={trabajando} onClick={() => decidir(f, 'revocado')}
                style={btn('var(--border-strong)', 'var(--dim)')}>No dejar entrar</button>
              <button type="button" disabled={trabajando} onClick={() => decidir(f, 'aprobado')}
                style={btn('var(--primary)', 'var(--primary)')}>
                {trabajando ? 'Aplicando…' : 'Dejar entrar'}
              </button>
            </span>
          </div>
        );
      })}

      {(altas ?? []).map((a) => {
        const clave = `alta-${a.id}`;
        const trabajando = ocupado === clave;
        return (
          <div key={clave}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 11,
              background: 'var(--surface-2)',
            }}>
              <span style={{ fontSize: 14, color: 'var(--ink)', minWidth: 0 }}>
                <b>{nombreDe(a.agencia_ws)}</b> quiere sumar a <b>{a.email}</b> al equipo
                de <b>{nombreDe(a.cliente_ws)}</b> como {ROTULO_ROL[a.rol_ws as RolAlta] ?? a.rol_ws}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button type="button" disabled={trabajando} onClick={() => void decidirAlta(a, 'rechazada')}
                  style={btn('var(--border-strong)', 'var(--dim)')}>No sumarlo</button>
                {/* ⚠️ EL BOTÓN DICE LA CONSECUENCIA Y NO «Aprobar»: esto crea una cuenta
                    y manda un mail, y eso no se deshace. «Aceptar» no lo dice. */}
                <button type="button" disabled={trabajando} onClick={() => void decidirAlta(a, 'aprobada')}
                  style={btn('var(--primary)', 'var(--primary)')}>
                  {trabajando ? 'Creando…' : 'Crear la cuenta'}
                </button>
              </span>
            </div>
            {aviso?.id === a.id && (
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, lineHeight: 1.5, color: aviso.aviso.tono === 'ok' ? 'var(--good)' : 'var(--warn)' }}>
                {aviso.aviso.texto}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const btn = (borde: string, tinta: string) => ({
  border: `1px solid ${borde}`, background: 'var(--surface)', borderRadius: 9,
  padding: '6px 12px', font: 'inherit', fontSize: 13, fontWeight: 600,
  color: tinta, cursor: 'pointer', whiteSpace: 'nowrap' as const,
});
