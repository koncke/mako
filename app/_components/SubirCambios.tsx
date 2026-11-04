'use client';

// =============================================================================
// <SubirCambios> — «Tienes 3 cambios hechos sin conexión»: revisarlos y subirlos con el OK de la persona (T2, 28/10/2026)
// =============================================================================
// Lo monta <CopiaSinConexion> en un navegador donde la persona activó MaKo sin conexión. Si la cola tiene algo (lo escrito
// en el cascarón, lib/sin-conexion/cola.ts), aparece una tarjeta chica abajo a la izquierda; el panel se abre con el clic
// (nunca solo) y NADA se sube hasta que la persona aprieta «Subir». La regla del Cerebro: lo que tiene consecuencias nunca
// sale solo al volver.
//
//   · Cada cambio en una línea (`describir`), en el orden en que se escribió.
//   · Lo que tiene consecuencias (mover a una etapa que arranca una automatización que le escribe al lead) viene SIN
//     marcar, con la consecuencia dicha: «Espera tu OK». Sin marcar, no se manda.
//   · Se suben de a uno, en orden (`subirCambioAction`). Lo hecho sale de la cola; un conflicto ofrece «Aplicar el mío» o
//     «Dejar»; un rechazo, «Reintentar», «Copiar» y «Descartar». Si se corta la red a mitad, lo que falta queda para
//     después: cada cambio lleva su id y el servidor no aplica dos veces el mismo.
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { cuantosSinSubir, guardarAhora, leerColaParaSubir, sacarDeLaCola } from '@/lib/sin-conexion/en-la-app';
import { describir, sale, type Operacion, type Resultado } from '@/lib/sin-conexion/cola';
import { revisarCambiosAction, subirCambioAction } from '@/app/_sin-conexion/acciones';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

type Item = { op: Operacion; texto: string; consecuencia: string | null; deOtroNegocio: boolean; aprobado: boolean; resultado: Resultado | null; ocupado: boolean };

const tarjeta: CSSProperties = {
  position: 'fixed', left: 16, bottom: 16, zIndex: 60, display: 'flex', alignItems: 'center', gap: 12,
  background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-strong)', borderRadius: 12,
  padding: '10px 14px', boxShadow: '0 6px 20px rgba(0,0,0,.12)', fontSize: 14, maxWidth: 'calc(100vw - 32px)',
};
const panel: CSSProperties = {
  position: 'fixed', left: 16, bottom: 16, zIndex: 61, width: 'min(560px, calc(100vw - 32px))', maxHeight: 'min(70vh, 640px)', overflow: 'auto',
  background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 18,
  boxShadow: '0 12px 36px rgba(0,0,0,.18)', fontSize: 14,
};
const boton: CSSProperties = { background: 'var(--primary)', color: '#fff', border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 600, cursor: 'pointer' };
const textoBoton: CSSProperties = { background: 'none', border: 0, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: '4px 6px' };
const gris: CSSProperties = { color: 'var(--dim)', fontSize: 12.5 };

const ROTULO: Partial<Record<Resultado['estado'], string>> = {
  aplicada: 'Subido', 'ya-estaba': 'Ya estaba así', borrador: 'Quedó como borrador para confirmar',
  rechazada: 'No se pudo subir', conflicto: 'Lo cambió otra persona', 'espera-ok': 'Espera tu OK', incierta: 'No se sabe si quedó', reintentar: 'Queda para después',
};

/** Avisa a la tarjeta que la cola cambió (lo escribe el cascarón en otra pestaña o el mismo panel al subir). */
export const EVENTO_COLA = 'mako-sin-conexion-cola';

export function SubirCambios({ email }: { email: string }) {
  const [cuantos, setCuantos] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const contar = useCallback(() => { void cuantosSinSubir(email).then(setCuantos, () => setCuantos(0)); }, [email]);
  useEffect(() => {
    contar();
    const alVolver = () => { if (document.visibilityState === 'visible') contar(); };
    window.addEventListener('online', contar);
    window.addEventListener(EVENTO_COLA, contar);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.removeEventListener('online', contar);
      window.removeEventListener(EVENTO_COLA, contar);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [contar]);

  /** Abrir el panel: lee la cola (con la llave del servidor) y pregunta qué tiene consecuencias. No sube nada. */
  const revisar = async () => {
    setAbierto(true);
    setAviso(null);
    setItems(null);
    const r = await leerColaParaSubir(email).catch(() => null);
    if (!r || !r.ok) {
      setAviso(r?.ok === false && r.motivo === 'otra-llave'
        ? 'Estos cambios quedaron cifrados con una llave anterior. Ábrelos con tu clave en Settings › Instalar la app › Sin conexión › Probar.'
        : 'No pude leer los cambios guardados. Intenta de nuevo en un momento.');
      setItems([]);
      return;
    }
    const rev = await revisarCambiosAction(r.cola).catch(() => null);
    if (!rev || !rev.ok) { setAviso(rev && !rev.ok ? rev.error : 'No pude revisar los cambios. Intenta de nuevo en un momento.'); setItems([]); return; }
    const porId = new Map(rev.cambios.map((c) => [c.id, c]));
    const copia = (ws: number) => r.copias.find((c) => c.negocio.id === ws) ?? null;
    setItems(r.cola.map((op) => {
      const c = porId.get(op.id);
      const consecuencia = c?.consecuencia ?? null;
      return { op, texto: describir(op, copia(op.ws)), consecuencia, deOtroNegocio: c?.deOtroNegocio ?? false, aprobado: !consecuencia, resultado: null, ocupado: false };
    }));
  };

  const cambiar = (id: string, f: (x: Item) => Item) => setItems((xs) => (xs ? xs.map((x) => (x.op.id === id ? f(x) : x)) : xs));

  /** UN cambio, con lo que eligió la persona. Lo que sale de la cola, sale. */
  const mandar = async (it: Item, o: { forzar?: boolean } = {}): Promise<boolean> => {
    cambiar(it.op.id, (x) => ({ ...x, ocupado: true }));
    let r: Resultado;
    try {
      r = await subirCambioAction(it.op, { forzar: o.forzar === true, ok: it.aprobado && !!it.consecuencia });
    } catch {
      cambiar(it.op.id, (x) => ({ ...x, ocupado: false }));
      setAviso('Se cortó la conexión. Lo que falta queda guardado para después.');
      return false;
    }
    if (sale(r.estado)) await sacarDeLaCola(email, it.op.id);
    cambiar(it.op.id, (x) => ({ ...x, ocupado: false, resultado: r }));
    return true;
  };

  /** «Subir»: en orden, de a uno. Lo de otro negocio y lo que espera el OK no se mandan. */
  const subir = async () => {
    if (!items) return;
    setSubiendo(true);
    setAviso(null);
    for (const it of items) {
      if (it.deOtroNegocio || (it.resultado && sale(it.resultado.estado))) continue;
      if (it.consecuencia && !it.aprobado) { cambiar(it.op.id, (x) => ({ ...x, resultado: { estado: 'espera-ok', motivo: it.consecuencia ?? undefined } })); continue; }
      if (!(await mandar(it))) break;
    }
    setSubiendo(false);
    window.dispatchEvent(new Event(EVENTO_COLA));
    // Con todo arriba, la copia se renueva ya: lo de esta computadora vuelve a ser lo del servidor.
    if ((await cuantosSinSubir(email)) === 0) void guardarAhora(email);
  };

  const descartar = async (it: Item) => {
    await sacarDeLaCola(email, it.op.id);
    setItems((xs) => (xs ? xs.filter((x) => x.op.id !== it.op.id) : xs));
    window.dispatchEvent(new Event(EVENTO_COLA));
  };

  if (!cuantos && !abierto) return null;

  if (!abierto) {
    return (
      <div style={tarjeta} role="status">
        <span>{cuantos === 1 ? 'Tienes 1 cambio hecho sin conexión.' : `Tienes ${cuantos} cambios hechos sin conexión.`}</span>
        <button type="button" style={boton} onClick={() => void revisar()}>Revisar y subir</button>
      </div>
    );
  }

  const pendientes = (items ?? []).filter((x) => !(x.resultado && sale(x.resultado.estado)));
  return (
    <section style={panel} aria-label="Cambios hechos sin conexión">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Cambios hechos sin conexión</h2>
        <button type="button" style={textoBoton} onClick={() => { setAbierto(false); contar(); }}>Cerrar</button>
      </div>
      <p style={{ ...gris, margin: '6px 0 12px' }}>Se suben en orden cuando aprietes «Subir». Lo que tiene consecuencias espera tu OK.</p>
      {aviso && <div className="aj-error" role="alert" style={{ margin: '0 0 12px' }}>{aviso}<ReportarASoporte /></div>}
      {items === null && <p style={gris}>Revisando…</p>}
      {items?.length === 0 && !aviso && <p style={gris}>No queda nada por subir.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {(items ?? []).map((it) => {
          const e = it.resultado?.estado;
          return (
            <li key={it.op.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', opacity: e && sale(e) ? 0.6 : 1 }}>
              <div>{it.texto}</div>
              {it.deOtroNegocio && <div style={gris}>Es de otro negocio: entra a ese negocio para subirlo.</div>}
              {it.consecuencia && !(e && sale(e)) && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 6, color: 'var(--warn)' }}>
                  <input type="checkbox" checked={it.aprobado} disabled={subiendo}
                    onChange={(ev) => cambiar(it.op.id, (x) => ({ ...x, aprobado: ev.target.checked }))} />
                  <span>Espera tu OK: {it.consecuencia}</span>
                </label>
              )}
              {e && <div style={{ ...gris, marginTop: 4, color: sale(e) ? 'var(--good)' : 'var(--warn)' }}>
                {ROTULO[e]}{it.resultado?.motivo && e !== 'espera-ok' ? `: ${it.resultado.motivo}` : ''}
                {e === 'borrador' && it.resultado?.link ? <> · <a href={it.resultado.link}>Confirmarlo</a></> : null}
              </div>}
              {(e === 'conflicto' || e === 'incierta') && (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button type="button" style={textoBoton} disabled={it.ocupado} onClick={() => void mandar(it, { forzar: true })}>
                    {e === 'conflicto' ? 'Aplicar el mío' : 'Subirlo igual'}
                  </button>
                  {/* Nada se pierde: lo suyo se puede copiar antes de dejarlo (el diseño decía guardarlo como nota; una
                      escritura que la persona no eligió no sale de acá, 28/10/2026). */}
                  <button type="button" style={textoBoton} onClick={() => void navigator.clipboard?.writeText(it.texto)}>Copiar</button>
                  <button type="button" style={textoBoton} disabled={it.ocupado} onClick={() => void descartar(it)}>
                    {e === 'conflicto' ? 'Dejar' : 'Ya quedó: sacarlo'}
                  </button>
                </div>
              )}
              {(e === 'rechazada' || e === 'reintentar') && (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button type="button" style={textoBoton} disabled={it.ocupado} onClick={() => void mandar(it)}>Reintentar</button>
                  <button type="button" style={textoBoton} onClick={() => void navigator.clipboard?.writeText(it.texto)}>Copiar</button>
                  <button type="button" style={textoBoton} disabled={it.ocupado} onClick={() => void descartar(it)}>Descartar</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {pendientes.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
          <button type="button" style={boton} disabled={subiendo || items === null} onClick={() => void subir()}>
            {subiendo ? 'Subiendo…' : `Subir ${pendientes.length === 1 ? 'el cambio' : `los ${pendientes.length} cambios`}`}
          </button>
          <button type="button" style={textoBoton} disabled={subiendo} onClick={() => setAbierto(false)}>Ahora no</button>
        </div>
      )}
    </section>
  );
}
