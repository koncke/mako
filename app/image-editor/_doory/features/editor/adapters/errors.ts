/**
 * Thrown by `EditorAdapter.save` when the server holds a newer revision of the design.
 * The editor detects it with `error.name === 'RevisionConflictError'` and offers reload / save as copy.
 */
export class RevisionConflictError extends Error {
  readonly currentRevision: number | null

  constructor(currentRevision: number | null = null) {
    super('Este diseño cambió en otro lugar. Recárgalo para ver la última versión, o guarda tu trabajo como copia.')
    this.name = 'RevisionConflictError'
    this.currentRevision = currentRevision
  }
}

/** Thrown when saving or uploading through a view/comment share link. */
export class ReadOnlyDesignError extends Error {
  constructor() {
    super('Este diseño es de solo lectura.')
    this.name = 'ReadOnlyDesignError'
  }
}

export type MigrationPhase = 'prepare' | 'assets' | 'design' | 'finish'

/** A guest→account migration failed. Nothing was lost: the local copy is still intact. */
export class MigrationError extends Error {
  readonly phase: MigrationPhase
  readonly assetName?: string

  constructor(message: string, phase: MigrationPhase, options?: { cause?: unknown; assetName?: string }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'MigrationError'
    this.phase = phase
    this.assetName = options?.assetName
  }
}
