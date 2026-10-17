'use client';

// =============================================================================
// CopyMethodM — Copy Method en el teléfono: la metodología y el swipe de ejemplos
// =============================================================================
// Ver ./page.tsx. Escribe por /api/mako/copywriting, la ruta de escritorio (seed · add-ejemplo · del-ejemplo), y
// después relee la página (`router.refresh`): lo que se ve es lo que quedó guardado, no una copia armada a mano.
// Borrar un ejemplo es la hoja del ejemplo con su botón rojo (escritorio pide confirmar: la hoja ES la confirmación).
// =============================================================================

import { useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import type { EjemploSwipe } from '@/lib/copywriting-metodo';
import {
  FilaM, ListaM, PieFijoM, PieM, PildoraM, SeccionM, SheetM, VacioM, useConexion, useToastM,
} from '@/app/m/_ui';
import { CampoM, ErrorLineaM } from '../../_creacion/escritor';

type Resp = { ok: boolean; error?: string; creadas?: number };

/** El POST de escritorio, con su tope: sin `signal`, un corte de red deja el botón girando para siempre. */
async function post(body: Record<string, unknown>): Promise<Resp> {
  try {
    const r = await fetch('/api/mako/copywriting', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(125_000),
    });
    return ((await r.json().catch(() => null)) as Resp | null) ?? { ok: false, error: 'No se pudo guardar.' };
  } catch {
    return { ok: false, error: 'No se pudo guardar. Revisa tu conexión y vuelve a intentar.' };
  }
}

export function CopyMethodM({ metodo, ejemplos }: { metodo: boolean; ejemplos: EjemploSwipe[] }) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [hoja, setHoja] = useState<'nuevo' | 'ejemplo' | null>(null);
  // El ejemplo de la hoja queda puesto mientras la hoja se va (LEEME.md).
  const [viendo, setViendo] = useState<EjemploSwipe | null>(null);
  const [asunto, setAsunto] = useState('');
  const [fuente, setFuente] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState<'sembrar' | 'guardar' | 'borrar' | null>(null);
  const [error, setError] = useState('');

  const sembrar = async () => {
    if (ocupado) return;
    setOcupado('sembrar');
    const j = await post({ action: 'seed' });
    setOcupado(null);
    if (!j.ok) { toast(j.error ?? 'No se pudo cargar'); return; }
    toast(j.creadas ? 'Metodología cargada' : 'Ya estaba cargada');
    router.refresh();
  };

  const guardar = async () => {
    if (ocupado || !cuerpo.trim()) return;
    setOcupado('guardar'); setError('');
    const j = await post({ action: 'add-ejemplo', asunto: asunto.trim(), cuerpo: cuerpo.trim(), nota: nota.trim(), fuente: fuente.trim() });
    setOcupado(null);
    if (!j.ok) { setError(j.error ?? 'No se pudo guardar el ejemplo.'); return; }
    setAsunto(''); setFuente(''); setCuerpo(''); setNota('');
    setHoja(null);
    toast('Ejemplo guardado');
    router.refresh();
  };

  const borrar = async (ej: EjemploSwipe) => {
    if (ocupado) return;
    setOcupado('borrar'); setError('');
    const j = await post({ action: 'del-ejemplo', id: ej.id });
    setOcupado(null);
    if (!j.ok) { setError(j.error ?? 'No se pudo borrar.'); return; }
    setHoja(null);
    toast('Ejemplo borrado');
    router.refresh();
  };

  return (
    <>
      <SeccionM titulo="Metodología">
        <ListaM>
          <FilaM
            icono="contexto"
            titulo="Metodología de copywriting"
            segunda="Eleva toda la redacción de MaKo"
            pill={<PildoraM tono={metodo ? 'good' : 'warn'}>{metodo ? 'Cargada' : 'Sin cargar'}</PildoraM>}
            enCurso={ocupado === 'sembrar'}
            deshabilitada={!enLinea || ocupado != null}
            onClick={() => void sembrar()}
            etiqueta={metodo ? 'Volver a sembrar la metodología' : 'Cargar la metodología'}
          />
        </ListaM>
      </SeccionM>

      <SeccionM titulo="Ejemplos reales">
        {ejemplos.length === 0 ? (
          <VacioM frase="Todavía no hay ejemplos." />
        ) : (
          <ListaM>
            {ejemplos.map((ej) => (
              <FilaM
                key={ej.id}
                titulo={ej.titulo || '(sin asunto)'}
                segunda={<span className="m-admin-copywriting-cuerpo">{ej.fuente ? `${ej.fuente} · ` : ''}{ej.cuerpo}</span>}
                onClick={() => { setError(''); setViendo(ej); setHoja('ejemplo'); }}
              />
            ))}
          </ListaM>
        )}
      </SeccionM>

      <PieFijoM>
        <Button variant="primary" size="lg" full icon={<Icon name="plus" size={18} />} disabled={!enLinea}
          onClick={() => { setError(''); setHoja('nuevo'); }}>
          Guardar un ejemplo
        </Button>
      </PieFijoM>

      <SheetM
        id="nuevo-ejemplo"
        abierto={hoja === 'nuevo'}
        onCerrar={() => setHoja(null)}
        titulo="Nuevo ejemplo"
        snap="alto"
        ocupado={ocupado === 'guardar'}
        rotuloCerrar="Cerrar"
        pie={(
          <PieM>
            <Button variant="primary" size="lg" full loading={ocupado === 'guardar'} disabled={!cuerpo.trim() || !enLinea}
              onClick={() => void guardar()}>
              Guardar ejemplo
            </Button>
          </PieM>
        )}
      >
        <CampoM valor={cuerpo} onCambio={setCuerpo} etiqueta="Mensaje" placeholder="Pega aquí el email o el mensaje" filas={7} />
        <CampoM valor={asunto} onCambio={setAsunto} etiqueta="Asunto (opcional)" placeholder="Asunto (opcional)" filas={1} />
        <CampoM valor={fuente} onCambio={setFuente} etiqueta="De quién (opcional)" placeholder="De quién (opcional)" filas={1} />
        <CampoM valor={nota} onCambio={setNota} etiqueta="Por qué te gustó (opcional)" placeholder="Por qué te gustó (opcional)" filas={2} />
        {error && hoja === 'nuevo' && <ErrorLineaM>{error}</ErrorLineaM>}
      </SheetM>

      <SheetM
        id="ejemplo"
        abierto={hoja === 'ejemplo' && viendo != null}
        onCerrar={() => setHoja(null)}
        titulo={viendo?.titulo || '(sin asunto)'}
        snap="alto"
        ocupado={ocupado === 'borrar'}
        rotuloCerrar="Cerrar el ejemplo"
        pie={viendo ? (
          <PieM consecuencia="MaKo deja de usarlo como referencia.">
            <Button variant="danger" size="lg" full icon={<Icon name="trash" size={18} />} loading={ocupado === 'borrar'}
              disabled={!enLinea} onClick={() => void borrar(viendo)}>
              Borrar el ejemplo
            </Button>
          </PieM>
        ) : undefined}
      >
        {viendo && (
          <div className="m-admin-copywriting-ejemplo">
            {viendo.fuente && <p className="m-admin-copywriting-fuente">{viendo.fuente}</p>}
            <p className="m-admin-copywriting-texto">{viendo.cuerpo}</p>
          </div>
        )}
        {error && hoja === 'ejemplo' && <ErrorLineaM>{error}</ErrorLineaM>}
      </SheetM>
    </>
  );
}
