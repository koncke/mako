'use client';

// =============================================================================
// MaKo Messages en el teléfono: la lista por categoría con su interruptor, y la hoja de cada mensaje
// =============================================================================
// El interruptor guarda solo, como en Ajustes de iOS: `enabled` por /api/admin/plantillas, la misma acción del detalle
// de escritorio (TemplateDetalleModal.tsx → `toggle`). Responde al toque y vuelve atrás si no se guardó (dejarlo puesto
// afirmaría un guardado que no pasó). La hoja muestra el ejemplo como burbuja de WhatsApp («se ve como llega»).
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useWs } from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import type { PlantillaVista } from '@/lib/plantillas';
import { ORDEN_CATEGORIA, ROTULO_CATEGORIA } from '@/app/agencia/categoria-icono';
import { ErrorM, FilaDatoM, FilaM, InterruptorM, ListaM, PieM, SeccionM, SheetM, SkeletonFilas, VacioM, useToastM } from '@/app/m/_ui';
import { abrirEnComputadora } from '@/app/m/_ui/EnComputadoraM';

const RUTA = '/api/admin/plantillas';

export function MensajesM({ leido }: { leido: number }) {
  const toast = useToastM();
  const ws = useWs();
  const [lista, setLista] = useState<PlantillaVista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<PlantillaVista | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const j = (await (await fetch(RUTA, { signal: AbortSignal.timeout(30_000) })).json()) as { ok: boolean; error?: string; plantillas?: PlantillaVista[] };
      if (!j.ok) { setError(j.error ?? 'No se pudieron leer los mensajes.'); return; }
      setLista(j.plantillas ?? []);
    } catch {
      setError('No se pudieron leer los mensajes. Revisa tu conexión.');
    }
  }, []);
  // `leido` cambia con cada pasada del server (tirar hacia abajo): se vuelve a pedir.
  useEffect(() => { void cargar(); }, [cargar, leido]);

  const prender = async (p: PlantillaVista, enabled: boolean) => {
    if (guardando) return;
    setGuardando(p.id);
    setLista((xs) => xs?.map((x) => (x.id === p.id ? { ...x, enabled } : x)) ?? xs); // optimista
    try {
      const j = (await (await fetch(RUTA, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'enabled', id: p.id, enabled }),
        signal: AbortSignal.timeout(30_000),
      })).json()) as { ok: boolean };
      if (!j.ok) throw new Error('no');
      haptico('success'); toast(enabled ? 'Activada' : 'Desactivada');
    } catch {
      setLista((xs) => xs?.map((x) => (x.id === p.id ? { ...x, enabled: !enabled } : x)) ?? xs);
      haptico('error'); toast('No se pudo guardar');
    } finally { setGuardando(null); }
  };

  if (error) return <ErrorM frase={error} onReintentar={() => { void cargar(); }} />;
  if (!lista) return <SkeletonFilas />;
  if (!lista.length) return <VacioM frase="No hay mensajes de MaKo para mostrar." />;

  const vivo = abierta ? lista.find((x) => x.id === abierta.id) ?? abierta : null;
  return (
    <>
      {ORDEN_CATEGORIA.map((c) => {
        const xs = lista.filter((p) => p.categoria === c);
        if (!xs.length) return null;
        return (
          <SeccionM key={c} titulo={ROTULO_CATEGORIA[c]}>
            <ListaM>
              {xs.map((p) => (
                <FilaM key={p.id} titulo={p.titulo} segunda={p.disparador} onClick={() => setAbierta(p)}
                  control={<InterruptorM etiqueta={p.enabled ? `Desactivar ${p.titulo}` : `Activar ${p.titulo}`} activo={p.enabled}
                    deshabilitado={guardando === p.id} onCambio={(v) => { void prender(p, v); }} />} />
              ))}
            </ListaM>
          </SeccionM>
        );
      })}
      <SheetM id="mensaje" abierto={vivo != null} onCerrar={() => setAbierta(null)} titulo={vivo?.titulo ?? ''} snap="alto"
        pie={vivo ? (
          <PieM>
            <Button variant="secondary" size="lg" full onClick={() => abrirEnComputadora('/mensajes', ws)}>Editar en la computadora</Button>
          </PieM>
        ) : undefined}>
        {vivo && (
          <>
            <p className="m-mensajes-cuando">Así llega por WhatsApp</p>
            <div className="m-mensajes-burbuja">{vivo.ejemplo}</div>
            <ListaM>
              <FilaDatoM k="Categoría" v={ROTULO_CATEGORIA[vivo.categoria]} />
              <FilaDatoM k="Cuándo sale" v={vivo.disparador} />
              <FilaDatoM k="Espera respuesta" v={vivo.requiereRespuesta ? 'Sí' : 'No'} />
              <FilaM titulo="Activa" control={<InterruptorM etiqueta="Activa" activo={vivo.enabled} deshabilitado={guardando === vivo.id}
                onCambio={(v) => { void prender(vivo, v); }} />} />
            </ListaM>
          </>
        )}
      </SheetM>
    </>
  );
}
