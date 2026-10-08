'use client';

// =============================================================================
// /api-mako › Tokens — uno por integración, con nombre y alcance
// =============================================================================
// Decisión de Martín (08/10/2026): «varios, con nombre». El porqué de la forma, en
// lib/api-mako/tokens-lista.ts. Lo que la pantalla cuida:
//   · el token se muestra UNA vez, al crearlo: después sólo existe su hash;
//   · revocar pide confirmación y corta en el acto;
//   · el principal (la skill de Claude) aparece en la lista porque también es una
//     puerta abierta, pero se ACUÑA en Integraciones → Claude, donde está su trato.
//
// Sin tokens, esta vista ES el onboarding de la tab: una pantalla, lo que falta y el
// control que lo arregla ahí mismo (la regla de las tabs que son la herramienta).
// =============================================================================

import { useState } from 'react';
import { Button, ButtonLink, Banner, Section, Status, TextField, RadioGroup, useConfirm, type Tono } from '@/app/_ui';
import { TEXTO_ALCANCE } from '@/lib/api-mako/alcance';
import type { Alcance } from '@/lib/api-mako/tipos';
import type { TokensDelWorkspace } from '@/lib/api-mako/tokens';
import { crearTokenApi, revocarTokenApi, tokensApi } from './actions';
import { Codigo, Mono, fechaCorta, hace, useCopiar } from './piezas';

// Del texto de los alcances, no de una lista aparte: `ALCANCES` vive en tipos.ts,
// que un componente cliente no importa.
const ALCANCES = Object.keys(TEXTO_ALCANCE) as Alcance[];
const TONO_ALCANCE: Record<Alcance, Tono> = { lectura: 'good', proponer: 'info', ejecutar: 'warn' };

export function Tokens({ tokens, onCambio, formAbierto, setFormAbierto }: {
  tokens: TokensDelWorkspace | null;
  onCambio: (t: TokensDelWorkspace) => void;
  formAbierto: boolean;
  setFormAbierto: (v: boolean) => void;
}) {
  const [nuevo, setNuevo] = useState<{ nombre: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmNode } = useConfirm();
  const { copiar, copiado } = useCopiar();

  if (!tokens) return <Banner tono="bad">No se pudieron leer los tokens. Recarga la página.</Banner>;

  const vacio = !tokens.principal && !tokens.tokens.length;

  const revocar = async (id: string, nombre: string, principal: boolean) => {
    const ok = await confirm(
      principal
        ? 'La skill de Claude deja de funcionar hasta que generes otro en Integraciones.'
        : 'Lo que lo use deja de funcionar en el acto.',
      { title: `¿Revocar «${nombre}»?`, confirmLabel: 'Revocar' },
    );
    if (!ok) return;
    setError(null);
    const r = await revocarTokenApi(id);
    if ('error' in r) { setError(r.error); return; }
    const t = await tokensApi();
    if ('error' in t) {
      // Ya se revocó: lo que falló es releer. Se saca de la vista igual.
      onCambio(principal ? { ...tokens, principal: null } : { ...tokens, tokens: tokens.tokens.filter((x) => x.id !== id) });
      return;
    }
    onCambio(t);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
      {confirmNode}

      {nuevo && (
        <Section card titulo={`Token «${nuevo.nombre}»`} nota="Cópialo ahora: no se vuelve a mostrar.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Codigo texto={nuevo.token} clave="nuevo" copiar={copiar} copiado={copiado} />
            <div><Button variant="secondary" onClick={() => setNuevo(null)}>Listo</Button></div>
          </div>
        </Section>
      )}

      {(formAbierto || vacio) && !nuevo && (
        <Crear
          vacio={vacio}
          onCancelar={vacio ? undefined : () => setFormAbierto(false)}
          onCreado={(token, publico) => {
            setNuevo({ nombre: publico.nombre, token });
            setFormAbierto(false);
            onCambio({ ...tokens, tokens: [...tokens.tokens, publico] });
          }}
        />
      )}

      {error && <Banner tono="bad">{error}</Banner>}

      {!vacio && (
        <Section titulo="Tokens activos">
          <div className="mk-scroll-x" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--faint)', fontSize: 'var(--fs-meta)' }}>
                  <th style={th}>Nombre</th><th style={th}>Puede</th><th style={th}>Token</th><th style={th}>Creado</th><th style={th}>Último uso</th><th style={th} />
                </tr>
              </thead>
              <tbody>
                {tokens.principal && (
                  <tr style={tr}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Skill de Claude</div>
                      <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>Integraciones → Claude</div>
                    </td>
                    <td style={td}><Status tono={TONO_ALCANCE[tokens.principal.alcance]}>{TEXTO_ALCANCE[tokens.principal.alcance].titulo}</Status></td>
                    <td style={td}><Mono>{tokens.principal.pista}</Mono></td>
                    <td style={{ ...td, color: 'var(--faint)' }}>—</td>
                    {/* null acá no es «nunca»: el uso del principal se anota desde el 08/10/2026,
                        y la skill puede llevar meses hablando sin que quedara registro. */}
                    <td style={td}>{tokens.principal.ultimoUso ? hace(tokens.principal.ultimoUso) : <span style={{ color: 'var(--faint)' }}>Sin registro</span>}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <ButtonLink size="sm" variant="tertiary" href="/integraciones?abrir=agente">Administrar</ButtonLink>
                      <Button size="sm" variant="tertiary" onClick={() => void revocar('principal', 'Skill de Claude', true)}>Revocar</Button>
                    </td>
                  </tr>
                )}
                {tokens.tokens.map((t) => (
                  <tr key={t.id} style={tr}>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--ink)' }}>{t.nombre}</td>
                    <td style={td}><Status tono={TONO_ALCANCE[t.alcance]}>{TEXTO_ALCANCE[t.alcance].titulo}</Status></td>
                    <td style={td}><Mono>{t.pista}</Mono></td>
                    <td style={td}>
                      <div>{fechaCorta(t.creado)}</div>
                      {t.creadoPor && <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>{t.creadoPor}</div>}
                    </td>
                    <td style={td}>{hace(t.ultimoUso)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <Button size="sm" variant="tertiary" onClick={() => void revocar(t.id, t.nombre, false)}>Revocar</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>
            Los tokens con nombre valen para <Mono tenue>/api/v1</Mono>.
          </div>
        </Section>
      )}
    </div>
  );
}

const th = { padding: '0 12px 8px 0', fontWeight: 500 } as const;
const tr = { borderTop: '1px solid var(--border)' } as const;
const td = { padding: '10px 12px 10px 0', verticalAlign: 'middle' } as const;

function Crear({ vacio, onCancelar, onCreado }: {
  vacio: boolean;
  onCancelar?: () => void;
  onCreado: (token: string, publico: TokensDelWorkspace['tokens'][number]) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [alcance, setAlcance] = useState<Alcance>('lectura');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = async () => {
    setCreando(true); setError(null);
    try {
      const r = await crearTokenApi({ nombre, alcance });
      if ('error' in r) setError(r.error);
      else onCreado(r.token, r.publico);
    } catch { setError('No se pudo crear. Prueba de nuevo.'); }
    finally { setCreando(false); }
  };

  return (
    <Section card titulo={vacio ? 'Crea tu primer token' : 'Nuevo token'} nota={vacio ? 'Uno por integración: n8n, Zapier, tu agente…' : undefined}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
        <TextField label="Nombre" value={nombre} maxLength={40} placeholder="n8n" onChange={(e) => setNombre(e.target.value)} disabled={creando} />
        <RadioGroup label="Qué puede hacer" value={alcance} onChange={(v) => setAlcance(v as Alcance)} disabled={creando}
          options={ALCANCES.map((a) => ({ value: a, label: TEXTO_ALCANCE[a].titulo, hint: TEXTO_ALCANCE[a].que }))} />
        {error && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--bad)' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => void crear()} loading={creando} disabled={!nombre.trim()}>Crear token</Button>
          {onCancelar && <Button variant="tertiary" onClick={onCancelar} disabled={creando}>Cancelar</Button>}
        </div>
      </div>
    </Section>
  );
}
