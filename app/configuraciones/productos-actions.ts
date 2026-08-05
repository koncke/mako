'use server';

// Acciones del catálogo de productos (Configuraciones › Productos). El listado
// siembra el primer producto desde la 'oferta' del onboarding si está vacío.

import { revalidatePath } from 'next/cache';
import {
  listProductos,
  upsertProducto,
  deleteProducto,
  seedProductosDesdeOferta,
  type Producto,
  type ProductoInput,
} from '@/lib/productos';

// getTenantDb (dentro de lib/productos) ya scopea por workspace y falla cerrado.

export async function listProductosAction(): Promise<Producto[]> {
  await seedProductosDesdeOferta().catch(() => {});
  return listProductos();
}

export async function saveProductoAction(input: ProductoInput, id?: number): Promise<number> {
  if (!input.nombre?.trim()) throw new Error('El producto necesita un nombre.');
  const res = await upsertProducto(input, id);
  revalidatePath('/configuraciones');
  revalidatePath('/crm');
  return res;
}

export async function deleteProductoAction(id: number): Promise<void> {
  await deleteProducto(id);
  revalidatePath('/configuraciones');
}
