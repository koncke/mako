'use client';

// =============================================================================
// ConfigClarity — paso 1 (opcional) de la instalación del Pixel
// =============================================================================
// ⚠️ NO TIENE FORMULARIO PROPIO. Las credenciales las dibuja `ServicioConfigForm`,
// la misma pieza que usan Meta, Chatwoot y el resto: trae el semáforo por campo,
// el «?» con los pasos, el ojo, el probar, el editar y el basura — y guarda con
// el tilde, probando antes. Mi primera versión reimplementó todo eso con dos
// `<Input>` y un botón «Guardar»: se veía parecido y no tenía ninguno de esos
// estados. Una barra de credencial que no se parece al resto no es un detalle
// estético; es una pantalla donde el usuario no sabe si lo que pegó quedó bien.
//
// Lo único propio de acá es el ENCABEZADO: qué se lleva y por qué conviene, con
// el detalle escondido hasta que aprieta. El texto largo antes de decidir es
// texto que nadie lee.
//
// Va PRIMERO porque el bloque de Clarity se arma cuando se genera el snippet:
// conectarlo después deja al cliente con un código que no lo trae.

import { useState } from 'react';
import { Button } from '@/app/_ui';
import ServicioConfigForm from './ServicioConfigForm';

export function ConfigClarity({ conectado, onListo }: { conectado: boolean; onListo: () => void }) {
  const [abierto, setAbierto] = useState(conectado);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 650, color: 'var(--ink)' }}>Mapas de Calor y Grabaciones</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 9px' }}>
          opcional
        </span>
      </div>

      {/* Corto y en términos de lo que se LLEVA. El detalle —qué es Clarity, que
          es gratis, dónde están las claves— vive detrás del botón y del «?». */}
      <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 5, lineHeight: 1.55, maxWidth: '62ch' }}>
        Mirá el video de lo que hizo cada lead en tu página, y dónde hacen clic todos los demás.
      </p>

      {!abierto ? (
        <div style={{ marginTop: 12 }}>
          <Button variant="primary" onClick={() => setAbierto(true)} style={{ width: '100%' }}>
            Activar mapas de calor y grabaciones
          </Button>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {/* El texto largo, recién ahora: ya decidió que le interesa. */}
          {!conectado && (
            <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6, marginBottom: 12, maxWidth: '68ch' }}>
              Usamos <b>Microsoft Clarity</b>, que es gratis y sin límite de visitas. Creá tu cuenta en{' '}
              <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>clarity.microsoft.com</a>,
              creá un proyecto con la dirección de tu página, y pegá acá abajo las dos claves. Se suman
              solas al código que copiás más abajo.
            </p>
          )}
          {/* La MISMA pieza que el resto de las integraciones. Guarda con el tilde
              —que prueba antes de guardar— y desde ahí aparecen ver, probar y
              quitar. Al guardar, `onGuardado` refresca la pantalla para que el
              código de abajo ya traiga el bloque de Clarity. */}
          <ServicioConfigForm servicioKey="clarity" onEstado={onListo} onGuardado={onListo} />
        </div>
      )}
    </div>
  );
}
