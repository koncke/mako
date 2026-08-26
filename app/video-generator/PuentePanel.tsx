'use client';

// =============================================================================
// PuentePanel — conectar el navegador y comprobar que el circuito existe
// =============================================================================
// Es el paso «Conectar» del onboarding de esta tab: sin un navegador emparejado,
// MaKo puede escribir el guion pero no puede generar un solo segundo de video.
//
// La prueba encola un `creditos`, que no gasta nada y recorre igual todo el
// camino: MaKo → cola → extensión → Google → vuelta. Si eso devuelve un número,
// el puente entero funciona. Y de paso contesta cuántos créditos hay y en qué
// tier está la cuenta, que es lo único que decide si el pipeline es viable.
//
// El copy dice explícitamente que se automatiza SU cuenta de Google. No es letra
// chica: si a alguien le suspenden Flow, fue MaKo quien lo puso ahí.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Section, Button, Alert, Status, MONO } from '@/app/_ui';
import { Icon } from '../_components/icons';
import {
  conectarPuenteAction, probarPuenteAction, estadoPruebaAction,
  type EstadoPruebaOut,
} from './puente-actions';

const ROTULO: Record<string, string> = {
  sin_conectar: 'Sin conectar',
  listo: 'Conectado',
  sin_sesion: 'Falta abrir Flow',
  marcada: 'Sesión marcada por Google',
};

export function PuentePanel({ inicial }: { inicial: EstadoPruebaOut['puente'] }) {
  const [puente, setPuente] = useState(inicial);
  const [token, setToken] = useState<string | null>(null);
  const [trabajoId, setTrabajoId] = useState<number | null>(null);
  const [prueba, setPrueba] = useState<EstadoPruebaOut['prueba']>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const conectar = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const out = await conectarPuenteAction('Mi navegador');
      if (!out.ok) { setError(out.error); return; }
      setToken(out.token);
      setPuente((p) => ({ ...p, emparejado: true }));
    } finally { setBusy(false); }
  }, []);

  const probar = useCallback(async () => {
    setBusy(true); setError(null); setPrueba(null);
    try {
      const out = await probarPuenteAction();
      if (!out.ok) { setError(out.error); return; }
      setTrabajoId(out.trabajoId);
    } finally { setBusy(false); }
  }, []);

  // Mientras hay una prueba en vuelo se pregunta cada 3 s. Se corta sola al
  // terminar: un poll que sigue después de la respuesta es una pestaña
  // consumiendo para siempre.
  useEffect(() => {
    if (trabajoId == null) return;
    let vivo = true;
    const tick = async () => {
      const out = await estadoPruebaAction(trabajoId);
      if (!vivo) return;
      setPuente(out.puente);
      setPrueba(out.prueba);
      if (out.prueba && (out.prueba.estado === 'listo' || out.prueba.estado === 'fallido')) return;
      timer.current = window.setTimeout(tick, 3000);
    };
    void tick();
    return () => {
      vivo = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [trabajoId]);

  const tono = puente.estado === 'listo' ? 'good' : puente.estado === 'marcada' ? 'bad' : 'warn';

  return (
    <Section titulo="Tu navegador">
      {error && <Alert tono="bad">{error}</Alert>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <Status tono={tono}>{ROTULO[puente.estado] ?? puente.estado}</Status>
        {puente.ultimoVisto && (
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>
            visto {new Date(puente.ultimoVisto).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {puente.estado === 'marcada' && (
        <Alert tono="bad">
          Google marcó esta sesión como automatizada y dejó de aceptar generaciones. Hay que
          parar un rato, borrar las cookies de google.com y labs.google, y volver a entrar a
          Flow. Reintentar sin hacer eso solo empeora la marca.
        </Alert>
      )}

      <div style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)', lineHeight: 1.65 }}>
        Los videos se generan en <strong>tu</strong> navegador, con <strong>tu</strong> cuenta
        de Google Flow y tus créditos. MaKo escribe el guion y arma cada toma; tu computadora
        la produce. Eso significa que estás automatizando tu propia cuenta de Google: tiene
        que estar abierta la sesión de Flow mientras se generan los videos.
      </div>

      {token && (
        <div style={{ marginTop: 14 }}>
          <Alert tono="info">
            <strong>Copia este código en la extensión.</strong> Se muestra una sola vez.
            <div style={{
              fontFamily: MONO, fontSize: 'var(--fs-sm)', marginTop: 8, padding: 10,
              background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', wordBreak: 'break-all',
            }}>{token}</div>
          </Alert>
        </div>
      )}

      {prueba && (
        <div style={{ marginTop: 14 }}>
          {prueba.estado === 'listo' ? (
            <Alert tono="good">
              <strong>El circuito funciona.</strong> Tu navegador tomó el pedido, le preguntó a
              Google y devolvió esto:
              <div style={{
                fontFamily: MONO, fontSize: 'var(--fs-xs)', marginTop: 8, padding: 10,
                background: 'var(--surface-2)', borderRadius: 'var(--r-sm)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>{JSON.stringify(prueba.resultado, null, 2)}</div>
            </Alert>
          ) : prueba.estado === 'fallido' ? (
            <Alert tono="bad">
              <strong>Falló.</strong> {prueba.error || 'sin detalle'}
              {prueba.motivo && <div style={{ marginTop: 4 }}>Motivo: {prueba.motivo}</div>}
            </Alert>
          ) : (
            <Alert tono="info">
              Esperando a que tu navegador lo tome. Si tarda más de un minuto, revisa que la
              extensión esté instalada, que tenga el código, y que tengas abierta una pestaña
              en labs.google/fx/tools/flow.
            </Alert>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <Button variant="secondary" onClick={() => void conectar()} loading={busy}>
          {puente.emparejado ? 'Generar código nuevo' : 'Conectar mi navegador'}
        </Button>
        <Button
          variant="mako"
          onClick={() => void probar()}
          loading={busy}
          disabled={!puente.emparejado}
          icon={<Icon name="check" size={14} />}
        >
          Probar la conexión
        </Button>
      </div>
    </Section>
  );
}
