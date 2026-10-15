// =============================================================================
// /m/landing — «Web Generator» (ex Landing Generator) en el teléfono: la lista de landings del negocio
// =============================================================================
// docs/diseno-mako-mobile-v2.md, «Landing Generator (reducido)», y el prototipo
// (docs/prototipos/mako-mobile-v2.html, la pantalla `landing`): una lista agrupada, cada landing
// con sus visitas y leads de 30 días y su estado (Publicada · Pausada · Borrador); tocarla abre la
// página (/m/landing/<id>). Crear, el diseño, los bloques y el dominio quedan en la computadora.
//
// Las landings son las del editor de escritorio (`landing_docs`, el copiado de Gamma que ya está en
// main): se leen con `listar` y se miden con `analitica`, las mismas funciones del Panel y de su
// diálogo de analítica (lib/editor-landing/server.ts). Los números llegan por streaming, fila por
// fila (NumerosLanding): la lista no espera a que se midan todas.
//
// Quién: la regla del Sidebar para `landing-writer` (admin del negocio + la tab en su capa), la
// misma puerta que /landing-generator y /api/landing-generator.
//
// ⚠️ maxDuration 60: cada medición pagina las visitas de 30 días de una landing publicada.
// =============================================================================

import './landing.css';
import { Suspense } from 'react';
import { requireMovil } from '@/lib/movil-guard';
import { ComputadoraM, ErrorM, FilaM, ListaM, PantallaM, PildoraM, VacioM } from '@/app/m/_ui';
import { leerLandingsM, medidorDeVisitas } from './datos';
import { MEDIDAS_A_LA_VEZ, PILDORA_LANDING, TOPE_MEDIDAS } from './modelo';
import { NumerosLanding } from './NumerosLanding';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const COMPU = 'Diseño, bloques y dominio';

export default async function LandingGeneratorMovil() {
  const ctx = await requireMovil({ navKey: 'landing-writer' });
  if (ctx.ws == null) return <PantallaM><VacioM frase="No hay un negocio abierto." /></PantallaM>;

  const r = await leerLandingsM(ctx.ws);
  if (!r.ok) {
    return (
      <PantallaM>
        <ErrorM frase="No pude leer las landings." />
        <ComputadoraM que={COMPU} />
      </PantallaM>
    );
  }
  if (!r.filas.length) {
    return (
      <PantallaM>
        <VacioM frase="Aún no hay landings." />
        <ComputadoraM que="Crear una landing" />
      </PantallaM>
    );
  }

  // Un medidor por render: corre de a pocas mediciones y sólo las primeras TOPE_MEDIDAS publicadas.
  const medir = medidorDeVisitas(MEDIDAS_A_LA_VEZ);
  let medidas = 0;

  return (
    <PantallaM>
      <ListaM>
        {r.filas.map((f) => {
          const pill = PILDORA_LANDING[f.estado];
          const medible = f.estado !== 'borrador' && medidas++ < TOPE_MEDIDAS;
          const segunda = f.estado === 'borrador'
            ? 'Sin publicar'
            : medible
              ? (
                <Suspense fallback={<span className="mk-skel m-landing-skel" aria-hidden />}>
                  <NumerosLanding medir={() => medir(f.id)} />
                </Suspense>
              )
              : undefined;
          return (
            <FilaM
              key={f.id}
              titulo={f.titulo}
              segunda={segunda}
              pill={<PildoraM tono={pill.tono}>{pill.texto}</PildoraM>}
              href={`/m/landing/${f.id}`}
            />
          );
        })}
      </ListaM>
      <ComputadoraM que={COMPU} />
    </PantallaM>
  );
}
