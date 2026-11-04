'use client';

// =============================================================================
// Settings › Instalar la app › «Sin conexión»: activar MaKo sin conexión en ESTA computadora (28/10/2026)
// =============================================================================
// Martín le dijo a Teo (28/10): «si se llega a caer tenés tu aplicación de desktop, que eso funciona siempre». Esta fila lo
// prende: la persona elige la clave de esta computadora y desde ahí la app guarda una copia cifrada del CRM y del Plan cada 10
// minutos (app/_components/CopiaSinConexion.tsx). Sin conexión, o con MaKo caído, la misma dirección abre el cascarón
// (public/sin-conexion/) y la clave lo abre. El diseño: docs/diseno-mako-desktop-sin-conexion.md.
// Una fila, como las demás de la página (copiada de Linear): el detalle dice el estado y a la derecha va el botón. El formulario
// de la clave se abre debajo, en el lugar.
// =============================================================================

import { useEffect, useState } from 'react';
import { FilaAjustes } from '@/app/_ui/Ajustes';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { activarEnEstaComputadora, borrarLoGuardado, estaActivado, guardarAhora, ultimaCopia, ultimoResultado } from '@/lib/sin-conexion/en-la-app';
import { deCuando, EVENTO_ACTIVADO, MIN_CLAVE } from '@/lib/sin-conexion/reglas';

type Estado = 'cargando' | 'apagado' | 'activo';

export function SinConexion({ email, noDisponible }: {
  /** El email de la persona frente al teclado. */
  email: string;
  /** Por qué no se puede acá (mirando la cuenta de otro, el teléfono). null = se puede. */
  noDisponible: string | null;
}) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ultima, setUltima] = useState<string | null>(null);
  const [otraLlave, setOtraLlave] = useState(false);

  useEffect(() => {
    if (noDisponible || typeof indexedDB === 'undefined') { setEstado('apagado'); return; }
    void (async () => {
      const si = await estaActivado(email).catch(() => false);
      setEstado(si ? 'activo' : 'apagado');
      if (si) {
        setUltima(await ultimaCopia(email));
        setOtraLlave((await ultimoResultado(email)) === 'otra-llave');
      }
    })();
  }, [email, noDisponible]);

  const guardarClave = async () => {
    setOcupado(true);
    setError(null);
    try {
      const r = await activarEnEstaComputadora(email, clave, repetida);
      if (!r.ok) { setError(r.error); return; }
      // La primera copia, ya: sin esperar los 10 minutos.
      const g = await guardarAhora(email);
      if (g !== 'guardada') setError('La clave quedó guardada, pero la primera copia no se pudo hacer. Se reintenta sola en unos minutos.');
      setUltima(await ultimaCopia(email));
      setOtraLlave(false);
      setEstado('activo');
      setAbierto(false);
      setClave('');
      setRepetida('');
      window.dispatchEvent(new Event(EVENTO_ACTIVADO));
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async () => {
    setOcupado(true);
    try {
      await borrarLoGuardado(email);
      setEstado('apagado');
      setUltima(null);
    } finally {
      setOcupado(false);
    }
  };

  const detalle = noDisponible
    ?? (estado === 'activo' && otraLlave ? 'La copia dejó de renovarse: elige la clave de nuevo.' : null)
    ?? (estado === 'activo'
      ? `Activado en esta computadora · copia con ${ultima ? deCuando(ultima, Intl.DateTimeFormat().resolvedOptions().timeZone) : 'la próxima vuelta'}`
      : 'Ver el CRM y el Plan aunque se corte internet o MaKo no responda');

  const fin = noDisponible || estado === 'cargando' ? undefined : estado === 'activo'
    ? (
      <span style={{ display: 'flex', gap: 8 }}>
        <a className="aj-boton" data-variante="borde" href="/sin-conexion/index.html" target="_blank" rel="noopener">Probar</a>
        <button type="button" className="aj-boton" data-variante="texto" disabled={ocupado} onClick={() => { setAbierto((v) => !v); setError(null); }}>Cambiar la clave</button>
        <button type="button" className="aj-boton" data-variante="texto" style={{ color: 'var(--bad)' }} disabled={ocupado} onClick={() => void borrar()}>Borrar lo guardado</button>
      </span>
    )
    : <button type="button" className="aj-boton" data-variante="borde" disabled={ocupado} onClick={() => { setAbierto((v) => !v); setError(null); }}>Activar</button>;

  return (
    <>
      <FilaAjustes icono="computadora" titulo="Sin conexión" detalle={detalle} fin={fin} />
      {abierto && !noDisponible && (
        <form style={{ maxWidth: 400, padding: '4px 0 16px 48px' }}
          onSubmit={(ev) => { ev.preventDefault(); if (!ocupado) void guardarClave(); }}>
          {/* El correo, oculto: el gestor de contraseñas la guarda con la cuenta correcta. */}
          <input type="email" autoComplete="username" value={email} readOnly hidden />
          {error && <div className="aj-error" role="alert">{error}<ReportarASoporte /></div>}
          <label className="aj-rotulo" htmlFor="sc-clave">La clave de esta computadora</label>
          <input id="sc-clave" className="aj-campo" type="password" autoComplete="new-password" value={clave} autoFocus
            onChange={(ev) => setClave(ev.target.value)} />
          <label className="aj-rotulo" htmlFor="sc-repetida" style={{ marginTop: 12 }}>Otra vez</label>
          <input id="sc-repetida" className="aj-campo" type="password" autoComplete="new-password" value={repetida}
            onChange={(ev) => setRepetida(ev.target.value)} />
          <p style={{ fontSize: 13, color: 'var(--dim)', margin: '6px 0 0' }}>
            {MIN_CLAVE} caracteres o más. Sin conexión, MaKo te la pide para abrir lo guardado.
          </p>
          <div className="aj-acciones">
            <button type="submit" className="aj-boton" disabled={ocupado || clave.length < MIN_CLAVE || !repetida}>
              {ocupado ? 'Guardando…' : 'Guardar la clave'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
