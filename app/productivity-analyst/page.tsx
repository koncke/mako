// =============================================================================
// /productivity-analyst — ahora es la hoja «Productividad» del Dashboard
// =============================================================================
// Pedido de Martín (11/10/2026): «Implementa como TEMPLATE... todas las tabs de la sidebar en la sección
// de "analysts"» y «elimina las tabs que ya hayas puesto como template de la sidebar». Esta tab era TODA
// análisis (no ejecutaba ni una tarea), así que vive entera en la plantilla «Productividad»
// (lib/graficos-plantillas-analysts.ts): los mismos números, calculados con la misma función
// (lib/productividad-metricas.ts). GraphicsView (app/plan/board/Graphics.tsx), la pantalla de antes,
// quedó SIN CONSUMIDOR desde este cambio: se dejó en su lugar para comparar, y borrarla es una decisión
// aparte (desde-todo.ts NO se va: lo usan TodoBoard.tsx y el lector del Dashboard).
//
// SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): la siguen links viejos y marcadores. Va con
// `rutaConWs`, o el super admin mirando a un cliente terminaría en su propio Dashboard.
//
// ⚠️ `?hoja=productividad` sólo abre la hoja si el informe tiene una con ESE id (las del informe inicial
// tienen ids fijos; una agregada desde «Nueva hoja» nace con uno nuevo). Si no la encuentra, el Dashboard
// cae a su primera hoja.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function Page() {
  redirect(await rutaConWs('/dashboard?hoja=productividad'));
}
