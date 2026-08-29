'use client';

// =============================================================================
// GithubRepoPicker — elegir el repo, con el token ya pegado
// =============================================================================
// Vive APARTE de ServicioConfigForm y se carga con `next/dynamic`, y eso no es
// organización: es superficie.
//
// ⚠️ EL PORQUÉ. Esta rama estaba adentro del form genérico, y ese form se monta
// para CUALQUIER integración. Resultado: los literales `'GITHUB_TOKEN'`,
// `'GITHUB_REPO'` y `'descubrir-github'` viajaban en el bundle de todo cliente que
// abriera el modal de Calendly o de Groq — medido el 25/08/2026 sobre el build de
// producción: 4 chunks.
//
// Lo que viajaba era el NOMBRE de la env, no el valor del token (el valor vive
// cifrado en la tabla `credenciales` y solo lo lee el server). Pero el nombre de la
// credencial de la plataforma, el nombre de su action y el hecho de que exista no
// tienen por qué estar en el navegador de un cliente: **la superficie que no se
// entrega es la que no hay que defender**, y de eso se trata este archivo.
//
// GitHub es `soloPlataforma`: solo el super admin, y solo dentro del workspace de la
// plataforma, puede abrir este modal. Con `next/dynamic` el chunk se descarga
// únicamente cuando eso pasa. Para todos los demás, este código no existe.
//
// ⚠️ NO ES EL GUARD DE SEGURIDAD. El guard es `servicioDelContexto()` en
// app/api/integraciones/credencial/route.ts, que devuelve 404 a quien no le
// corresponde; eso es lo que impide leer o escribir la credencial. Esto es la capa
// de arriba: no entregar lo que no hace falta. Si alguna vez se saca el guard del
// server, esconder este chunk no protege nada.

import { useEffect, useRef, useState } from 'react';
import { Dropdown } from '@/app/components/Dropdown';

const SANS = "'Geist', sans-serif";

export type ResultadoDescubrir = {
  ok?: boolean;
  error?: string;
  servicio?: unknown;
  opciones?: Array<{ value: string; label: string }>;
  repo?: string;
  mensaje?: string;
};

export function GithubRepoPicker({
  tokenCargado,
  autoDescubrir,
  onServicio,
  onMensaje,
}: {
  /** El token ya está guardado: recién ahí tiene sentido ofrecer buscar los repos. */
  tokenCargado: boolean;
  /**
   * Se acaba de guardar el token en esta misma sesión → salir a buscar solo.
   * Es un CONTADOR, no un booleano: si fuera booleano, guardar el token dos veces
   * seguidas no volvería a disparar la búsqueda (el valor no cambia y el efecto no
   * se re-ejecuta).
   */
  autoDescubrir: number;
  /** El servicio que vuelve del server, para que el form refresque su estado. */
  onServicio: (s: unknown) => void;
  /** Mensajes a la fila del token, que la pinta el form. */
  onMensaje: (m: { ok: boolean; text: string }) => void;
}) {
  const [repos, setRepos] = useState<Array<{ value: string; label: string }>>([]);
  const [elegido, setElegido] = useState('');
  const [buscando, setBuscando] = useState(false);
  const yaCorrio = useRef(0);

  const descubrir = async () => {
    setBuscando(true);
    try {
      const j: ResultadoDescubrir = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'descubrir-github' }),
      }).then((r) => r.json());
      if (!j.ok) { onMensaje({ ok: false, text: j.error ?? 'No pude leer tus repos.' }); return; }
      if (j.servicio) onServicio(j.servicio);
      setRepos(j.opciones ?? []);
      if (j.repo) setElegido(String(j.repo));
      if (j.mensaje) onMensaje({ ok: true, text: String(j.mensaje) });
    } finally { setBuscando(false); }
  };

  const elegir = async (valor: string) => {
    setElegido(valor);
    const j: ResultadoDescubrir = await fetch('/api/integraciones/credencial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'guardar', servicio: 'github', valores: { GITHUB_REPO: valor } }),
    }).then((r) => r.json());
    if (j.ok) { setRepos([]); onMensaje({ ok: true, text: `Listo: ${valor}.` }); }
    else onMensaje({ ok: false, text: j.error ?? 'No pude guardarlo.' });
  };

  // Al guardar el token, el repo sale solo: el dueño tuvo que ADIVINAR
  // «usuario/repo» la primera vez —«sería mucho más fácil si es un desplegable»— y
  // tenía razón, porque el dato ya lo tiene GitHub: un token fine-grained se emite
  // contra repos concretos.
  useEffect(() => {
    if (autoDescubrir > yaCorrio.current) { yaCorrio.current = autoDescubrir; void descubrir(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDescubrir]);

  const caja: React.CSSProperties = {
    border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)',
    padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10,
  };

  return (
    <>
      {(buscando || repos.length > 0 || elegido) && (
        <div style={caja}>
          {buscando ? (
            <div style={{ fontFamily: SANS, fontSize: 13, color: 'var(--dim)' }}>Buscando tus repos…</div>
          ) : repos.length > 0 ? (
            <>
              <div style={{ fontFamily: SANS, fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>¿Cuál es el repo de MaKo?</div>
              <Dropdown
                value={elegido}
                onChange={(v) => void elegir(String(v))}
                options={repos.map((r) => ({ value: r.value, label: r.label }))}
                placeholder="Elige el repositorio…"
              />
            </>
          ) : elegido ? (
            <div style={{ fontFamily: SANS, fontSize: 13, color: 'var(--dim)' }}>
              Repositorio: <strong style={{ color: 'var(--ink)' }}>{elegido}</strong>
            </div>
          ) : null}
        </div>
      )}

      {/* Reintento a mano: si se cambia el token o se le suman repos, no hay que
          borrar y volver a pegar. */}
      {!buscando && tokenCargado && (
        <button type="button" onClick={() => void descubrir()}
          style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          ↻ Buscar mis repos
        </button>
      )}
    </>
  );
}
