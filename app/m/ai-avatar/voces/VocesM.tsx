'use client';

// =============================================================================
// VocesM — «Voices» de AI Avatar en el teléfono: la galería con filtros, escuchar, sumar a tu cuenta, tus voces
// =============================================================================
// Ver ./page.tsx. Una fila por voz (FilaM) con el botón de escuchar a la derecha; tocar la fila abre su hoja con
// «Agregar a mi cuenta». Un solo audio suena a la vez (useReproductorM).
// =============================================================================

import { useMemo, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useRouter } from '@/app/_ui/Link';
import { sumarVozAction, type VozCuenta } from '@/app/ai-avatar/actions';
import { VOCES_GALERIA, ACENTOS_GALERIA, type VozGaleria } from '@/lib/ai-avatar/voces-galeria';
import { ComputadoraM, ErrorM, FilaDatoM, FilaM, ListaM, PieM, SeccionM, SheetM, VacioM, useConexion, useToastM } from '@/app/m/_ui';
import { ErrorLineaM } from '../../_creacion/escritor';
import { BotonEscucharM, ChipM, ChipsM, useReproductorM } from '../piezas';

type Cuenta = { voces: VozCuenta[] } | { sinKey: boolean; error: string };

const GENEROS = ['Todas', 'Mujer', 'Hombre'] as const;

export function VocesM({ cuenta }: { cuenta: Cuenta }) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const { sonando, tocar } = useReproductorM();
  const [acento, setAcento] = useState<string>('Todos');
  const [genero, setGenero] = useState<(typeof GENEROS)[number]>('Todas');
  // La voz de la hoja queda puesta mientras la hoja se va (LEEME.md).
  const [viendo, setViendo] = useState<VozGaleria | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [sumando, setSumando] = useState(false);
  const [sumadas, setSumadas] = useState<Record<string, true>>({});
  const [error, setError] = useState('');

  const lista = useMemo(() => VOCES_GALERIA.filter((v) =>
    (acento === 'Todos' || v.acento === acento) && (genero === 'Todas' || v.genero === (genero === 'Mujer' ? 'mujer' : 'hombre'))), [acento, genero]);

  const sinKey = 'sinKey' in cuenta && cuenta.sinKey;

  const sumar = async (v: VozGaleria) => {
    if (sumando) return;
    setSumando(true); setError('');
    try {
      const r = await sumarVozAction(v.id);
      if (!r.ok) { setError(r.error); return; }
      setSumadas((s) => ({ ...s, [v.id]: true }));
      setAbierta(false);
      toast('Voz agregada');
      router.refresh();
    } catch {
      setError('No se pudo agregar la voz. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setSumando(false);
    }
  };

  return (
    <>
      <ChipsM etiqueta="Acento">
        {['Todos', ...ACENTOS_GALERIA].map((a) => <ChipM key={a} activo={acento === a} onClick={() => setAcento(a)}>{a}</ChipM>)}
      </ChipsM>
      <ChipsM etiqueta="Género">
        {GENEROS.map((g) => <ChipM key={g} activo={genero === g} onClick={() => setGenero(g)}>{g}</ChipM>)}
      </ChipsM>

      <SeccionM titulo="Galería de voces">
        {lista.length === 0 ? <VacioM frase="Ninguna voz con esos filtros." /> : (
          <ListaM>
            {lista.map((v) => (
              <FilaM
                key={v.id}
                titulo={v.nombre}
                segunda={`${v.acento} · ${v.tono}`}
                onClick={() => { setError(''); setViendo(v); setAbierta(true); }}
                control={<BotonEscucharM activo={sonando === v.id} onClick={() => tocar(v.id, v.muestra)} etiqueta={`Escuchar a ${v.nombre}`} />}
              />
            ))}
          </ListaM>
        )}
      </SeccionM>

      <SeccionM titulo="Tus voces">
        {'voces' in cuenta ? (
          cuenta.voces.length === 0
            ? <VacioM frase="Todavía no tienes voces." />
            : (
              <ListaM>
                {cuenta.voces.map((v) => (
                  <FilaM
                    key={v.id}
                    titulo={v.nombre}
                    segunda={v.categoria === 'cloned' ? 'Clonada' : v.categoria === 'premade' ? 'De ElevenLabs' : 'Agregada'}
                    control={v.muestra ? <BotonEscucharM activo={sonando === `c-${v.id}`} onClick={() => tocar(`c-${v.id}`, v.muestra!)} etiqueta={`Escuchar a ${v.nombre}`} /> : undefined}
                  />
                ))}
              </ListaM>
            )
        ) : cuenta.sinKey ? (
          <ComputadoraM que="Conectar ElevenLabs para usar tus voces" />
        ) : (
          <ErrorM frase={cuenta.error} />
        )}
      </SeccionM>

      <SheetM
        id="voz"
        abierto={abierta && viendo != null}
        onCerrar={() => setAbierta(false)}
        titulo={viendo?.nombre ?? 'Voz'}
        ocupado={sumando}
        rotuloCerrar="Cerrar la voz"
        pie={viendo ? (
          <PieM consecuencia={sinKey ? 'Para sumarla, conecta ElevenLabs en la computadora.' : undefined}>
            <Button variant="secondary" size="lg" full onClick={() => tocar(viendo.id, viendo.muestra)}>
              {sonando === viendo.id ? 'Pausar' : 'Escuchar'}
            </Button>
            {!sinKey && (
              <Button variant="primary" size="lg" full loading={sumando} disabled={!enLinea || !!sumadas[viendo.id]}
                onClick={() => void sumar(viendo)}>
                {sumadas[viendo.id] ? 'Ya está en tu cuenta' : 'Agregar a mi cuenta'}
              </Button>
            )}
          </PieM>
        ) : undefined}
      >
        {viendo && (
          <ListaM>
            <FilaDatoM k="Acento" v={viendo.acento} />
            <FilaDatoM k="Tono" v={viendo.tono} />
            <FilaDatoM k="Voz" v={`${viendo.genero === 'mujer' ? 'Mujer' : 'Hombre'} ${viendo.edad.toLowerCase()}`} />
            <FilaDatoM k="Para" v={viendo.uso} />
          </ListaM>
        )}
        {error && <ErrorLineaM>{error}</ErrorLineaM>}
      </SheetM>
    </>
  );
}
