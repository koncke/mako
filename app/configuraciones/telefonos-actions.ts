'use server';

// =============================================================================
// Teléfonos del workspace — CRUD de los números desde los que se contacta leads
// =============================================================================
// Cada número tiene su etiqueta, su fuente (Chatwoot / API WhatsApp / personal)
// y los setters asignados. MaKo sugiere la fuente: si hay Chatwoot conectado,
// el número por defecto se marca "Chatwoot"; si no, "Número personal".

import { revalidatePath } from 'next/cache';
import { getTenantDb } from '@/lib/workspace';
import { normalizarTelefono } from '@/lib/leads';
import { chatwootConfigurado } from '@/lib/chatwoot';
import { getEquipoAction, type MiembroEquipo } from '../crm/actions';

export type FuenteTelefono = 'chatwoot' | 'whatsapp_api' | 'personal';

export type WsTelefono = {
  id: number;
  numero: string;
  etiqueta: string | null;
  fuente: FuenteTelefono;
  setters: string[];         // emails
  created_at: string;
};

export type TelefonosData = {
  telefonos: WsTelefono[];
  chatwootConectado: boolean;
  equipo: MiembroEquipo[];   // para asignar setters
};

export async function getTelefonosAction(): Promise<TelefonosData> {
  const [db, chatwootConectado, equipo] = await Promise.all([
    getTenantDb(),
    chatwootConfigurado(),
    getEquipoAction().catch(() => [] as MiembroEquipo[]),
  ]);
  const { data, error } = await db
    .from('workspace_telefonos')
    .select('id, numero, etiqueta, fuente, setters, created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Error listando teléfonos: ${error.message}`);
  const telefonos = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    numero: String(r.numero ?? ''),
    etiqueta: (r.etiqueta as string | null) ?? null,
    fuente: ((r.fuente as FuenteTelefono) ?? 'personal'),
    setters: Array.isArray(r.setters) ? (r.setters as string[]) : [],
    created_at: String(r.created_at ?? ''),
  }));
  return { telefonos, chatwootConectado, equipo };
}

export type TelefonoInput = {
  id?: number | null;
  numero: string;
  etiqueta?: string | null;
  fuente: FuenteTelefono;
  setters: string[];
};

export async function saveTelefonoAction(input: TelefonoInput): Promise<void> {
  const numero = input.numero?.trim();
  if (!numero) throw new Error('El número es obligatorio.');
  const db = await getTenantDb();
  const row = {
    numero,
    numero_norm: normalizarTelefono(numero),
    etiqueta: input.etiqueta?.trim() || null,
    fuente: input.fuente,
    setters: input.setters ?? [],
  };
  if (input.id) {
    const { error } = await db.from('workspace_telefonos').update(row).eq('id', input.id);
    if (error) throw new Error(`Error actualizando el teléfono: ${error.message}`);
  } else {
    const { error } = await db.from('workspace_telefonos').insert([row]);
    if (error) throw new Error(`Error creando el teléfono: ${error.message}`);
  }
  revalidatePath('/configuraciones');
}

export async function deleteTelefonoAction(id: number): Promise<void> {
  const { error } = await (await getTenantDb()).from('workspace_telefonos').delete().eq('id', id);
  if (error) throw new Error(`Error borrando el teléfono: ${error.message}`);
  revalidatePath('/configuraciones');
}
