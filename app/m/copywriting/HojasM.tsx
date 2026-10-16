'use client';

// =============================================================================
// /m/copywriting — las hojas: un anuncio con sus guiones, y el lector de un guion
// =============================================================================
// · La hoja de un ANUNCIO es la pestaña «Guiones» del modal de la matriz (MatrizView.tsx): sus
//   guiones (el gancho de cada uno, el ángulo y el estado) y «MaKo lo hace solo» para escribir otro.
//   «Elegir con MaKo» (ángulo, estructura y preguntas cerradas) queda en la computadora.
// · El LECTOR es GuionLector.tsx: un guion se lee en voz alta frente a una cámara, así que los bloques
//   van abiertos, grandes y en una columna (un teleprompter), y la acción es «Copiar el guion».
//   Editar, borrar, descargar y cambiar el estado, en la computadora.
// ⚠️ Lo de adentro de una hoja NO depende de `abierto`: la hoja sigue en pantalla los 220 ms de su
//    salida, y quien la monta le pasa la última foto aunque el guion ya no esté (app/m/_ui/LEEME.md).
// ⚠️ Para pasar de una hoja a la otra sólo se abre la nueva: SheetM cierra la anterior.
// =============================================================================

import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { ESTADO_GUION_LABEL, fechaGuion } from '@/lib/guion-estado';
import { masRecientePrimero } from '@/app/ads-writer/reglas';
import { FilaM, ListaM, PieM, PildoraM, SheetM, VacioM } from '@/app/m/_ui';
import { R, portadaDe, seccionesDe, tonoDeEstado, type CeldaM, type GuionM } from './modelo';

export function HojaAnuncioM({ abierta, celda, escribiendo, enLinea, onCerrar, onAbrirGuion, onEscribir }: {
  abierta: boolean;
  celda: CeldaM | null;
  escribiendo: string | null;
  enLinea: boolean;
  onCerrar: () => void;
  onAbrirGuion: (celdaId: string, guionId: string) => void;
  onEscribir: (celdaId: string) => void;
}) {
  const guiones = celda ? [...celda.guiones].sort(masRecientePrimero) : [];
  const escribeEsta = !!celda && escribiendo === celda.id;
  return (
    <SheetM
      id="anuncio"
      abierto={abierta}
      onCerrar={onCerrar}
      titulo={celda?.nombre ?? R.anuncios}
      pie={celda ? (
        <PieM>
          <Button variant="mako" size="lg" full icon={<Icon name="mako" size={18} />} loading={escribeEsta}
            disabled={!enLinea || escribiendo != null} onClick={() => onEscribir(celda.id)}>
            {R.makoSolo}
          </Button>
        </PieM>
      ) : undefined}
    >
      {guiones.length ? (
        <ListaM etiqueta={R.guiones}>
          {guiones.map((g) => (
            <FilaM
              key={g.id}
              titulo={portadaDe(g.texto).texto}
              segunda={g.anguloNombre || undefined}
              pill={<PildoraM tono={tonoDeEstado(g.estado)}>{ESTADO_GUION_LABEL[g.estado]}</PildoraM>}
              onClick={() => celda && onAbrirGuion(celda.id, g.id)}
            />
          ))}
        </ListaM>
      ) : (
        <VacioM frase="Todavía no hay guiones." />
      )}
    </SheetM>
  );
}

export function HojaGuionM({ abierta, x, onCerrar, onCopiar }: {
  abierta: boolean;
  x: GuionM | null;
  onCerrar: () => void;
  onCopiar: (texto: string) => void;
}) {
  const secciones = x ? seccionesDe(x.g.texto) : [];
  const meta = x ? [x.g.anguloNombre, x.g.estructuraNombre].filter((s) => s && s.trim()).join(' · ') : '';
  return (
    <SheetM
      id="guion"
      abierto={abierta}
      onCerrar={onCerrar}
      titulo={x?.celda ?? 'Guion'}
      snap="alto"
      pie={x ? (
        <PieM>
          <Button variant="primary" size="lg" full icon={<Icon name="copy" size={18} />} onClick={() => onCopiar(x.g.texto)}>
            {R.copiarGuion}
          </Button>
        </PieM>
      ) : undefined}
    >
      {x && (
        <div className="m-copywriting-lector">
          <div className="m-copywriting-lector__cab">
            <PildoraM tono={tonoDeEstado(x.g.estado)}>{ESTADO_GUION_LABEL[x.g.estado]}</PildoraM>
            {meta && <span className="m-copywriting-lector__meta">{meta}</span>}
          </div>
          {secciones.length ? secciones.map((s, i) => (
            <section key={`${s.titulo}-${i}`} className="m-copywriting-bloque">
              <h3 className="m-copywriting-bloque__t">{s.titulo}</h3>
              <p className="m-copywriting-bloque__x">{s.texto}</p>
            </section>
          )) : (
            // Un guion viejo, sin los rótulos del catálogo: no se pierde, se ve entero.
            <p className="m-copywriting-bloque__x">{x.g.texto}</p>
          )}
          <p className="m-copywriting-lector__pie">{x.avatar} · {fechaGuion(x.g.creadoEn)}</p>
        </div>
      )}
    </SheetM>
  );
}
