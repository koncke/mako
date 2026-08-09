'use client';

// =============================================================================
// BotonClaude — «Conectar a Claude» desde el segundo cerebro
// =============================================================================
// El tutorial NO se copia: se importa el mismo componente que usa /integraciones. Son
// cuatro pasos encadenados —acuñar el token, instalar la skill, activar el hook,
// pedírselo al agente— y el paso 1 tiene adentro la pantalla del consentimiento, que es
// un texto legal versionado. Una segunda copia se queda vieja el día que uno de los
// cuatro cambie, y nadie se entera hasta que un cliente sigue instrucciones viejas.
//
// Por qué el botón vive ACÁ y no solo en /integraciones: el segundo cerebro es
// literalmente lo que la skill le lleva a Claude Code. El lugar donde alguien entiende
// para qué sirve conectar su agente es mirando el mapa de lo que MaKo sabe de él.
// =============================================================================

import { useState } from 'react';
import { Button } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { TutorialAgente } from '@/app/_components/TutorialAgente';
import { WizardShell } from '@/app/_components/WizardShell';

export function BotonClaude({ tokenInicial, appUrl }: { tokenInicial: string | null; appUrl: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        icon={<Icon name="mako" size={16} />}
        title="Llevarte tu segundo cerebro a Claude Code"
        onClick={() => setAbierto(true)}
      >
        Conectar a Claude
      </Button>
      {abierto && (
        <WizardShell
          titulo="Conectar a Claude Code"
          pasos={['Conectar']}
          pasoActual="Conectar"
          pregunta="¿Programas con Claude Code?"
          ancho={860}
          puedeAvanzar={false}
          enUltimo
          confirmLabel="Listo"
          atrasLabel="Cerrar"
          onAtras={() => setAbierto(false)}
          onSiguiente={() => {}}
          onConfirmar={() => setAbierto(false)}
          onClose={() => setAbierto(false)}
        >
          <TutorialAgente tokenInicial={tokenInicial} appUrl={appUrl} />
        </WizardShell>
      )}
    </>
  );
}
