'use client';

// =============================================================================
// La API de MaKo en el teléfono: el catálogo, los tokens y el registro (Stripe «Developers» y GitHub en el celular)
// =============================================================================

import { useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useRouter } from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import { revocarTokenApi } from '@/app/api-mako/actions';
import { copiarTexto } from '@/app/m/copywriting/api';
import { ErrorM, FilaDatoM, FilaM, ListaM, PieM, PildoraM, SeccionM, SheetM, VacioM, useToastM, type TonoPildora } from '@/app/m/_ui';
import { FilaEnComputadoraM } from '@/app/m/_ui/EnComputadoraM';

export type EndpointM = { id: string; titulo: string; metodo: string; ruta: string; nivel: 'lectura' | 'escritura' };
export type AreaM = { area: string; titulo: string; recursos: { titulo: string; endpoints: EndpointM[] }[] };
export type TokenM = {
  id: string; nombre: string; descripcion: string; pista: string; creado: string; expira: string | null;
  ultimoUso: string | null; vencido: boolean; areas: number;
};
export type PrincipalM = { alcance: 'lectura' | 'proponer' | 'ejecutar'; pista: string; ultimoUso: string | null } | null;
export type LlamadaM = { cuando: string; operacion: string; status: number; ms: number };

type Props =
  | { tab: 'docs'; base: string; version: string; areas: AreaM[] }
  | { tab: 'tokens'; tokens: TokenM[] | null; principal: PrincipalM }
  | { tab: 'registro'; llamadas: LlamadaM[] | null; total: number; errores: number };

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Nunca');
const hora = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** El color de cada método, como las pastillas de la documentación (GET de lectura, el resto escribe). */
const TONO_METODO: Record<string, TonoPildora> = { GET: 'info', POST: 'good', PATCH: 'warn', PUT: 'warn', DELETE: 'bad' };
/** Los nombres del alcance del token principal, los de la computadora (Tokens.tsx). */
const ALCANCE: Record<string, string> = { lectura: 'Sólo lectura', proponer: 'Proponer', ejecutar: 'Ejecutar' };

export function ApiMakoM(p: Props) {
  if (p.tab === 'docs') return <Docs base={p.base} version={p.version} areas={p.areas} />;
  if (p.tab === 'tokens') return <Tokens tokens={p.tokens} principal={p.principal} />;
  return <Registro llamadas={p.llamadas} total={p.total} errores={p.errores} />;
}

function Docs({ base, version, areas }: { base: string; version: string; areas: AreaM[] }) {
  const toast = useToastM();
  const [abierta, setAbierta] = useState<AreaM | null>(null);
  return (
    <>
      <ListaM>
        <FilaDatoM k="Base" v={`${base}/api/v1`} azul onClick={async () => { toast((await copiarTexto(`${base}/api/v1`)) ? 'Copiado' : 'No se pudo copiar'); }} />
        <FilaDatoM k="Versión" v={version} />
      </ListaM>
      {areas.length === 0 ? <VacioM frase="Tu plan no tiene operaciones por la API." /> : (
        <SeccionM titulo="Áreas">
          <ListaM>
            {areas.map((a) => (
              <FilaM key={a.area} navegacion titulo={a.titulo} riel={<span className="m-api-mako-n">{a.recursos.reduce((n, r) => n + r.endpoints.length, 0)}</span>}
                onClick={() => setAbierta(a)} />
            ))}
          </ListaM>
        </SeccionM>
      )}
      <SheetM id="area" abierto={abierta != null} onCerrar={() => setAbierta(null)} titulo={abierta?.titulo ?? ''} snap="alto">
        {abierta?.recursos.map((r) => (
          <SeccionM key={r.titulo} titulo={r.titulo}>
            <ListaM>
              {r.endpoints.map((e) => (
                <FilaM key={e.id} titulo={e.titulo} segunda={<code className="m-api-mako-ruta">{e.ruta}</code>}
                  pill={<PildoraM tono={TONO_METODO[e.metodo] ?? 'neutro'}>{e.metodo}</PildoraM>} />
              ))}
            </ListaM>
          </SeccionM>
        ))}
      </SheetM>
    </>
  );
}

function Tokens({ tokens, principal }: { tokens: TokenM[] | null; principal: PrincipalM }) {
  const router = useRouter();
  const toast = useToastM();
  const [abierto, setAbierto] = useState<TokenM | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  if (tokens == null) return <ErrorM frase="No se pudieron leer los tokens." />;
  const eliminar = async () => {
    if (!abierto || ocupado) return;
    setOcupado(true);
    try {
      const r = await revocarTokenApi(abierto.id);
      if ('error' in r) { haptico('error'); toast(r.error); return; }
      haptico('success'); toast('Token eliminado');
      setAbierto(null);
      router.refresh();
    } finally { setOcupado(false); }
  };
  return (
    <>
      {principal && (
        <SeccionM titulo="Clásico">
          <ListaM>
            <FilaM icono="api" titulo="Token del agente de Claude" segunda={`${principal.pista} · ${ALCANCE[principal.alcance] ?? principal.alcance}`}
              riel={<span className="m-api-mako-n">{fecha(principal.ultimoUso)}</span>} />
          </ListaM>
        </SeccionM>
      )}
      <SeccionM titulo="Detallados">
        <ListaM>
          {tokens.length === 0
            ? <FilaM titulo="Todavía no hay tokens" segunda="Se crean en la computadora" />
            : tokens.map((t) => (
              <FilaM key={t.id} icono="api" titulo={t.nombre} segunda={`${t.pista} · ${t.ultimoUso ? `usado ${fecha(t.ultimoUso)}` : 'sin usar'}`}
                pill={t.vencido ? <PildoraM tono="bad">Vencido</PildoraM> : undefined} onClick={() => { setConfirmar(false); setAbierto(t); }} />
            ))}
        </ListaM>
      </SeccionM>
      <ListaM>
        <FilaEnComputadoraM icono="plus" titulo="Crear un token" href="/api-mako?tab=tokens&v=nuevo"
          motivo="El valor de un token se ve una sola vez y se copia a la integración que lo usa: se crea en la computadora." />
      </ListaM>
      <SheetM id="token" abierto={abierto != null} onCerrar={() => setAbierto(null)} titulo={abierto?.nombre ?? ''} ocupado={ocupado}
        pie={abierto ? (
          <PieM consecuencia={confirmar ? 'Lo que lo use deja de entrar a tu negocio. No se puede deshacer.' : undefined}>
            {confirmar
              ? <Button variant="danger" size="lg" full loading={ocupado} onClick={() => { void eliminar(); }}>{`Eliminar «${abierto.nombre}»`}</Button>
              : <button type="button" className="m-api-mako-borrar" onClick={() => setConfirmar(true)}>Eliminar el token</button>}
          </PieM>
        ) : undefined}>
        {abierto && (
          <ListaM>
            {abierto.descripcion && <FilaDatoM k="Para qué" v={abierto.descripcion} />}
            <FilaDatoM k="Token" v={abierto.pista} />
            <FilaDatoM k="Áreas con permiso" v={String(abierto.areas)} />
            <FilaDatoM k="Creado" v={fecha(abierto.creado)} />
            <FilaDatoM k="Vence" v={abierto.expira ? fecha(abierto.expira) : 'Sin vencimiento'} />
            <FilaDatoM k="Último uso" v={fecha(abierto.ultimoUso)} />
          </ListaM>
        )}
      </SheetM>
    </>
  );
}

function Registro({ llamadas, total, errores }: { llamadas: LlamadaM[] | null; total: number; errores: number }) {
  if (llamadas == null) return <ErrorM frase="No se pudo leer el registro de la API." />;
  return (
    <>
      <ListaM>
        <FilaDatoM k="Llamadas en 30 días" v={total.toLocaleString('es-MX')} />
        <FilaDatoM k="Con error" v={errores.toLocaleString('es-MX')} />
      </ListaM>
      {llamadas.length === 0 ? <VacioM frase="Nadie llamó a tu API en los últimos 30 días." /> : (
        <SeccionM titulo="Las últimas">
          <ListaM>
            {llamadas.map((l, i) => (
              <FilaM key={`${l.cuando}-${i}`} titulo={<code className="m-api-mako-ruta">{l.operacion}</code>} segunda={`${hora(l.cuando)} · ${l.ms} ms`}
                pill={<PildoraM tono={l.status < 300 ? 'good' : l.status < 500 ? 'warn' : 'bad'}>{String(l.status)}</PildoraM>} />
            ))}
          </ListaM>
        </SeccionM>
      )}
    </>
  );
}
