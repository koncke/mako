'use client';

// =============================================================================
// RevisarAccion — el formulario genérico de una propuesta de acción
// =============================================================================
// Se pinta desde los `parametros` de la operación (los mismos que validan el input
// en el server), con el input guardado como valor inicial. La persona corrige y
// confirma; lo que vuelve pasa otra vez por `validarInput` y por `preparar()`.
//
// Datos PLANOS: acá no se importa el registro ni las defs, solo el TIPO `Parametro`
// (tests/api-mako-registro.test.ts lo fija).
//
// Un campo vaciado se manda como `null` y no se omite: la acción mezcla lo editado
// sobre el payload guardado, y omitirlo haría volver el valor viejo en silencio.
// =============================================================================

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Pagina, PageHeader, Section, Button, Status, Alert } from '@/app/_ui';
import { confirmarAccionAction, descartarAccionAction } from './acciones';
// Los campos, su valor inicial y lo que se manda: los mismos del chat (1.10, ../formulario.tsx).
import { Campo, armarPayload, valorInicial, valorLegible, type OperacionPlana, type Valor } from '../formulario';

export type { OperacionPlana };

type Fase =
  | { fase: 'editando' }
  | { fase: 'confirmando' }
  | { fase: 'descartando' }
  | { fase: 'hecha'; resumen: string }
  | { fase: 'descartada'; resumen: string };

const ESTADO: Record<string, { texto: string; tono: 'good' | 'neutral' | 'bad' }> = {
  aplicada: { texto: 'Aplicada', tono: 'good' },
  descartada: { texto: 'Descartada', tono: 'neutral' },
};

export function RevisarAccion({ id, operacion, operacionId, payload, resumen, estado, resultado, origen, createdAt, puedeDecidir }: {
  id: string;
  /** null = la operación ya no existe en el registro de MaKo */
  operacion: OperacionPlana | null;
  operacionId: string;
  /** el input validado que quedó guardado al proponer */
  payload: Record<string, unknown>;
  resumen: string;
  estado: string;
  resultado: Record<string, unknown> | null;
  /** «Por WhatsApp» / «Por la API» / «Desde el chat de la app» */
  origen: string | null;
  /** ya formateada en la zona del workspace */
  createdAt: string;
  puedeDecidir: boolean;
}) {
  const router = useRouter();
  const params = operacion?.parametros ?? [];
  const [valores, setValores] = useState<Record<string, Valor>>(() =>
    Object.fromEntries(params.map((p) => [p.nombre, valorInicial(p, payload[p.nombre])])));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<Fase>({ fase: 'editando' });

  const enCurso = f.fase === 'confirmando' || f.fase === 'descartando';
  const titulo = operacion?.titulo ?? (operacionId || 'Acción de MaKo');

  const confirmar = async () => {
    if (!operacion || enCurso) return;
    setError(null);
    const armado = armarPayload(params, valores, payload);
    if ('errores' in armado) { setErrores(armado.errores); setError('Hay datos para corregir antes de confirmar.'); return; }
    setErrores({});
    setF({ fase: 'confirmando' });
    const r = await confirmarAccionAction(id, armado.payload);
    if (r.ok) { setF({ fase: 'hecha', resumen: r.resumen }); return; }
    setError(r.error);
    setF({ fase: 'editando' });
    // Si falló DESPUÉS de reclamarse, la propuesta ya no está pendiente: el refresh
    // trae el estado real en vez de invitar a un segundo intento sobre algo que pudo
    // haber escrito a medias.
    router.refresh();
  };

  const descartar = async () => {
    if (enCurso) return;
    setError(null);
    setF({ fase: 'descartando' });
    const r = await descartarAccionAction(id);
    if (r.ok) { setF({ fase: 'descartada', resumen: r.resumen }); return; }
    setError(r.error);
    setF({ fase: 'editando' });
  };

  const resuelta = estado !== 'pendiente' || f.fase === 'hecha' || f.fase === 'descartada';
  const estadoVista = f.fase === 'hecha' ? 'aplicada' : f.fase === 'descartada' ? 'descartada' : estado;
  const resultadoTexto = f.fase === 'hecha' || f.fase === 'descartada'
    ? f.resumen
    : typeof resultado?.resumen === 'string' ? resultado.resumen : null;
  const fallo = f.fase !== 'hecha' && resultado?.ok === false;
  const enCursoGuardado = resultado?.en_curso === true && resultado?.resumen == null;
  const est = ESTADO[estadoVista] ?? { texto: estadoVista, tono: 'neutral' as const };

  const caja = { border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface)', padding: 'var(--card-pad)' } as const;
  const k = { fontSize: 'var(--fs-meta)', color: 'var(--dim)', fontWeight: 600 } as const;
  const v = { fontSize: 'var(--fs-md)', color: 'var(--ink)', lineHeight: 1.5 } as const;

  return (
    <Pagina>
      <PageHeader
        titulo={resumen || titulo}
        proposito={resuelta ? undefined : 'Revisa los datos que propuso MaKo, corrige lo que haga falta y confirma. Nada se ejecuta hasta que lo confirmes.'}
        estado={resuelta ? <Status tono={fallo ? 'bad' : est.tono}>{fallo ? 'Falló' : est.texto}</Status> : <Status tono="warn">Esperando confirmación</Status>}
      />

      <Section titulo="Qué se va a hacer">
        <div style={{ ...caja, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div>
            <div style={k}>Acción</div>
            <div style={{ ...v, fontWeight: 650 }}>{titulo}</div>
            {operacion && <div style={{ ...v, color: 'var(--dim)', fontSize: 'var(--fs-sm)' }}>{operacion.escribe}</div>}
          </div>
          <div>
            <div style={k}>Se puede deshacer</div>
            <div style={v}>{operacion ? (operacion.reversible ? 'Sí, desde su tab' : 'No') : '—'}</div>
          </div>
          <div>
            <div style={k}>De dónde vino</div>
            <div style={v}>{origen ?? '—'}</div>
            <div style={{ ...v, color: 'var(--dim)', fontSize: 'var(--fs-sm)' }}>Propuesta el {createdAt}</div>
          </div>
        </div>
      </Section>

      {!operacion ? (
        <Alert tono="bad">
          La operación «{operacionId || 'sin nombre'}» ya no existe en MaKo, así que esta propuesta no se puede ejecutar.
          {!resuelta && puedeDecidir ? ' Puedes descartarla para que no quede en la bandeja.' : ''}
        </Alert>
      ) : resuelta ? (
        <Section titulo="Con estos datos">
          <dl style={{ ...caja, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {params.map((p) => (
              <div key={p.nombre}>
                <dt style={k}>{p.nombre}</dt>
                <dd style={{ ...v, margin: 0, wordBreak: 'break-word' }}>{valorLegible(f.fase === 'editando' ? payload[p.nombre] : valores[p.nombre])}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : (
        <Section titulo="Datos" nota="Los mismos que va a usar la acción. Corrige lo que no esté bien.">
          <div style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {params.length === 0 && <div style={{ ...v, color: 'var(--dim)' }}>Esta acción no lleva datos: se ejecuta tal como dice el resumen.</div>}
            {params.map((p) => (
              <Campo key={p.nombre} p={p} valor={valores[p.nombre]} error={errores[p.nombre]} disabled={enCurso || !puedeDecidir || !!p.fijoAlRevisar}
                onChange={(nv) => setValores((prev) => ({ ...prev, [p.nombre]: nv }))} />
            ))}
          </div>
        </Section>
      )}

      {resuelta && (resultadoTexto || enCursoGuardado) && (
        <Alert tono={fallo ? 'bad' : estadoVista === 'aplicada' ? 'good' : 'neutral'}>
          {resultadoTexto ?? 'Se estaba aplicando y no quedó el resultado. Revisa en su tab si se hizo antes de volver a proponerla.'}
        </Alert>
      )}

      {error && <div style={{ marginBottom: 14 }}><Alert tono="bad">{error}</Alert></div>}

      {!resuelta && !puedeDecidir && (
        <Alert tono="neutral">Solo el administrador del workspace puede confirmar o descartar esta propuesta.</Alert>
      )}

      {!resuelta && puedeDecidir && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
          <div className="mk-row mk-row--stack">
            {operacion && (
              <Button variant="primary" loading={f.fase === 'confirmando'} disabled={enCurso} onClick={() => { void confirmar(); }}>
                Confirmar acción
              </Button>
            )}
            <Button variant="tertiary" loading={f.fase === 'descartando'} disabled={enCurso} onClick={() => { void descartar(); }}>
              Descartar propuesta
            </Button>
          </div>
          {/* La consecuencia pegada al botón, en tinta normal y antes del click. */}
          {operacion && (
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.5, maxWidth: '70ch' }}>
              {operacion.reversible
                ? `Al confirmar: ${operacion.escribe}. Se puede deshacer después desde su tab.`
                : <><b>No se puede deshacer.</b> Al confirmar: {operacion.escribe}.</>}
              {' '}Descartar no ejecuta nada.
            </p>
          )}
        </div>
      )}
    </Pagina>
  );
}
