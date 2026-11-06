'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/DashboardOverview/MetricSelectorModal.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo:
//   · el arrastre es el de @dnd-kit/react (el que tiene MaKo, 0.5): `DragDropProvider` + `useSortable` en vez de `DndContext`
//     + `SortableContext` de @dnd-kit/core, con el mismo resultado (se reordena al soltar, el original queda a media luz y
//     una copia sigue al cursor);
//   · Polar guarda las métricas de Overview en la organización (`feature_settings.overview_metrics`) y pide el permiso
//     `organization:manage`. Admin es la plataforma y es sólo del super admin: las guarda su navegador (OverviewSection).

import { CloseOutlined, DragHandleOutlined } from '@/app/admin/_polar/orbit/icons'
import { Button, InlineModalHeader, Input } from '@/app/admin/_polar/orbit'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { ALL_METRICS, METRIC_GROUPS } from '@/app/admin/_polar/web/utils/metrics'
import type { schemas } from '@/app/admin/_polar/datos/polar-tipos'
import { LIMITE_METRICAS_OVERVIEW } from '@/app/admin/_polar/datos/resumen'
import { DragDropProvider, DragOverlay, type DragEndEvent } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { useCallback, useId, useMemo, useState } from 'react'
import { useForm, useFormState } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

interface MetricItem {
  id: string
  slug: string
  display_name: string
}

const toItem = (slug: string): MetricItem => ({
  id: slug,
  slug,
  display_name: ALL_METRICS.find((m) => m.slug === slug)?.display_name ?? slug,
})

// ─── Sortable row ─────────────────────────────────────────────────────────────

function SortableMetricRow({
  item,
  index,
  onRemove,
}: {
  item: MetricItem
  index: number
  onRemove: () => void
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: item.id,
    index,
    type: 'metrica-overview',
    accept: 'metrica-overview',
    group: 'metricas-overview',
  })

  return (
    <div
      ref={ref}
      className={twMerge(
        'dark:bg-polar-800 flex w-full items-center justify-between rounded-lg bg-gray-100 px-4 py-2',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-3">
        <button
          ref={handleRef}
          type="button"
          aria-label={`Mover ${item.display_name}`}
          className="dark:text-polar-500 dark:hover:text-polar-300 cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
        >
          <DragHandleOutlined fontSize="inherit" />
        </button>
        <span className="text-sm font-medium">{item.display_name}</span>
      </div>
      <Button
        size="icon"
        className="h-5 w-5"
        variant="ghost"
        aria-label={`Sacar ${item.display_name}`}
        onClick={onRemove}
      >
        <CloseOutlined fontSize="inherit" />
      </Button>
    </div>
  )
}

// ─── General-purpose dashboard editor ────────────────────────────────────────

export interface MetricDashboardEditorContentProps {
  title: string
  /** When provided, renders an InlineModalHeader. Omit when wrapped by Modal. */
  onClose?: () => void
  initialName?: string
  showNameField?: boolean
  activeMetrics: string[]
  /** Maximum number of selectable metrics. Omit for no limit. */
  limit?: number
  onSave: (metrics: string[], name?: string) => Promise<void>
  isPending: boolean
  saveLabel?: string
}

export const MetricDashboardEditorContent = ({
  title,
  onClose,
  initialName,
  showNameField,
  activeMetrics,
  limit,
  onSave,
  isPending,
  saveLabel = 'Guardar',
}: MetricDashboardEditorContentProps) => {
  const nameInputId = useId()
  const [selected, setSelected] = useState<MetricItem[]>(() =>
    activeMetrics.map(toItem),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { source } = event.operation
    if (event.canceled || !isSortable(source) || source.initialIndex === source.index) return
    setSelected((prev) => {
      const next = prev.slice()
      const [moved] = next.splice(source.initialIndex, 1)
      next.splice(source.index, 0, moved)
      return next
    })
  }, [])

  const handleRemove = useCallback((slug: string) => {
    setSelected((prev) => prev.filter((m) => m.slug !== slug))
  }, [])

  const handleAdd = useCallback(
    (slug: string) => {
      if (limit !== undefined && selected.length >= limit) return
      setSelected((prev) => [...prev, toItem(slug)])
    },
    [limit, selected.length],
  )

  const groupedAvailable = useMemo(() => {
    const selectedSlugs = new Set(selected.map((m) => m.slug))
    return METRIC_GROUPS.map((g) => ({
      category: g.category,
      metrics: g.metrics.filter((m) => !selectedSlugs.has(m.slug as string)),
    })).filter((g) => g.metrics.length > 0)
  }, [selected])

  const availableCount = groupedAvailable.reduce(
    (n, g) => n + g.metrics.length,
    0,
  )

  const atLimit = limit !== undefined && selected.length >= limit
  const aboveLimit = limit !== undefined && selected.length > limit

  const { control, register, handleSubmit } = useForm<{ name: string }>({
    defaultValues: { name: initialName ?? '' },
  })
  const { errors } = useFormState({ control })

  const onSubmit = useCallback(
    async (data: { name: string }) => {
      await onSave(
        selected.map((m) => m.slug),
        showNameField ? data.name : undefined,
      )
    },
    [onSave, selected, showNameField],
  )

  return (
    <div className="flex flex-col">
      {onClose && (
        <InlineModalHeader hide={onClose}>
          <span>{title}</span>
        </InlineModalHeader>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
        {showNameField && (
          <div className="flex flex-col gap-y-2 px-5 pt-6">
            <label
              htmlFor={nameInputId}
              className="text-sm font-medium text-gray-900 dark:text-white"
            >
              Nombre
            </label>
            <Input
              id={nameInputId}
              {...register('name', { required: 'Ponle un nombre' })}
              placeholder="Por ejemplo, Ingresos del mes"
            />
            {errors.name && (
              <span className="text-sm text-red-500">
                {errors.name.message}
              </span>
            )}
          </div>
        )}

        <div className="dark:divide-polar-700 grid grid-cols-1 gap-y-6 divide-gray-100 p-6 md:grid-cols-2 md:gap-y-0 md:divide-x">
          {/* Left panel — selected metrics */}
          <div className="flex flex-col gap-y-4 md:pr-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Elegidas
              </h3>
              {limit !== undefined && (
                <span
                  className={twMerge(
                    'text-sm font-medium',
                    atLimit
                      ? 'text-black dark:text-white'
                      : 'dark:text-polar-400 text-gray-500',
                  )}
                >
                  {selected.length}/{limit}
                </span>
              )}
            </div>
            <DragDropProvider onDragEnd={handleDragEnd}>
              <div className="flex max-h-64 flex-col gap-y-2 overflow-y-auto md:max-h-96">
                {selected.map((item, index) => (
                  <SortableMetricRow
                    key={item.id}
                    item={item}
                    index={index}
                    onRemove={() => handleRemove(item.slug)}
                  />
                ))}
              </div>
              <DragOverlay>
                {(source) => {
                  const dragOverlayItem = selected.find((m) => m.id === source?.id)
                  return dragOverlayItem ? (
                    <div className="dark:bg-polar-800 flex h-12 items-center gap-3 rounded-lg bg-white px-4 shadow-xl">
                      <DragHandleOutlined
                        fontSize="inherit"
                        className="text-gray-500 dark:text-gray-500"
                      />
                      <span className="text-sm font-medium">
                        {dragOverlayItem.display_name}
                      </span>
                    </div>
                  ) : null
                }}
              </DragOverlay>
            </DragDropProvider>
            {selected.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center">
                <p className="dark:text-polar-500 text-center text-sm text-gray-500">
                  Suma métricas desde la lista de la derecha
                </p>
              </div>
            )}
          </div>

          {/* Right panel — available metrics */}
          <div className="flex flex-col gap-y-4 md:pl-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Métricas
            </h3>
            <div className="flex max-h-64 flex-col gap-y-2 overflow-y-auto md:h-96 md:max-h-none">
              {groupedAvailable.map(({ category, metrics }) => (
                <details key={category} className="group">
                  <summary className="dark:bg-polar-800 flex cursor-pointer list-none items-center justify-between rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium select-none">
                    {category}
                    <svg
                      className="h-3 w-3 transition-transform group-open:rotate-180"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M2 4l4 4 4-4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>
                  <div className="flex flex-col py-2">
                    {metrics.map((metric) => (
                      <button
                        key={metric.slug as string}
                        type="button"
                        disabled={atLimit}
                        onClick={() => handleAdd(metric.slug as string)}
                        className={twMerge(
                          'dark:hover:bg-polar-800 flex cursor-pointer flex-col gap-y-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-100',
                          atLimit
                            ? 'dark:text-polar-500 cursor-not-allowed text-gray-500'
                            : null,
                        )}
                      >
                        <span className="text-sm font-medium">
                          {metric.display_name}
                        </span>
                        <span className="dark:text-polar-400 text-xs text-gray-500">
                          {metric.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
              {availableCount === 0 && (
                <p className="dark:text-polar-400 text-center text-sm text-gray-500">
                  Ya están todas elegidas
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="dark:border-polar-700 flex items-center justify-end gap-x-2 border-t border-gray-100 px-6 py-4">
          <Button
            type="submit"
            disabled={(limit !== undefined && aboveLimit) || isPending}
            loading={isPending}
          >
            {saveLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Overview wrapper (preserves existing OverviewSection API) ────────────────

interface MetricSelectorModalContentProps {
  activeMetrics: (keyof schemas['Metrics'])[]
  onSave: (slugs: (keyof schemas['Metrics'])[]) => void
}

export const MetricSelectorModalContent = ({
  activeMetrics,
  onSave,
}: MetricSelectorModalContentProps) => {
  const handleSave = async (metrics: string[]) => {
    onSave(metrics as (keyof schemas['Metrics'])[])
  }

  return (
    <MetricDashboardEditorContent
      title=""
      activeMetrics={activeMetrics as string[]}
      limit={LIMITE_METRICAS_OVERVIEW}
      isPending={false}
      onSave={handleSave}
    />
  )
}

export const useMetricSelectorModal = () => useModal()
