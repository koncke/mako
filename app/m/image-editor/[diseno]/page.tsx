// =============================================================================
// /m/image-editor/<id> — el editor de UN diseño en el teléfono: el MISMO editor de escritorio, a pantalla completa
// =============================================================================
// El motor de escritorio (Doory, la copia de Canva) ya tiene su modo para pantallas chicas: por debajo de 1024 px
// el riel de herramientas se va, las herramientas pasan a una tira abajo (CompactTools) y cada una abre como hoja
// que sube (DrawerHost); la barra de un objeto va abajo, al alcance del pulgar (_doory/editor/EditorApp.tsx y
// chrome/ed.module.css). Es exactamente el editor de Canva en el teléfono. Así que el teléfono NO tiene un editor
// propio: monta el de escritorio por su ÚNICA puerta (ImageEditorCliente, 'use client' y sin SSR:
// tests/image-editor-integracion.test.ts, contrato 4), con el mismo diseño de la base, el mismo guardado
// (compare-and-set por versión). El crédito de Doory: 29/10/2026, Martín decidió sacar el crédito visible, a su riesgo. El código de _doory/ se va reemplazando de a poco; cuando no quede nada suyo, la licencia deja de aplicar.
//
// Lo único del teléfono es el marco: la capa a pantalla completa (../../_creacion/PantallaCompletaM.tsx), porque en
// Canva del teléfono el editor tapa todo y trae su propia barra («‹» vuelve al inicio, que acá es /image-editor:
// en el teléfono, ../page.tsx; `salir`). Adentro, la pantalla de Create de escritorio en su modo angosto
// (app/_crear/crear.css): arriba el interruptor «MaKo | Image» y se ve uno por vez, el chat de MaKo del editor o el editor.
// Quién: la MISMA puerta que escritorio, `requireRolWs([], { nav: 'image-editor' })`.
// =============================================================================

import { requireMovil } from '@/lib/movil-guard';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { nombreDelNegocio } from '@/lib/carruseles/marca';
import { ImageEditorCliente } from '@/app/image-editor/ImageEditorCliente';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { PantallaCompletaM } from '../../_creacion/PantallaCompletaM';

export const dynamic = 'force-dynamic';

export default async function DisenoPagina({ params }: { params: Promise<{ diseno: string }> }) {
  const ctx = await requireMovil({ navKey: 'image-editor' });
  const [{ diseno }, senales, negocio] = await Promise.all([params, senalesDelNegocio().catch(() => null), nombreDelNegocio(ctx.ws)]);
  return (
    <PantallaM>
      <CabeceraM titulo="Image Editor" trabajo />
      <PantallaCompletaM etiqueta="Image Editor">
        <ImageEditorCliente vista="editor" disenoId={diseno} ws={ctx.ws} negocio={negocio} senales={senales} salir="/image-editor?ver=crear" />
      </PantallaCompletaM>
    </PantallaM>
  );
}
