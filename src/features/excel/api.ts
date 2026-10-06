import { unwrap } from '@/lib/api'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { RawImportRow } from '@/lib/excel/products'
import type { Row } from '@/types/db'

export type ImportMode = 'catalog' | 'stock' | 'catalog_stock'
export type ImportBatch = Row<'import_batches'>
export type ImportRow = Row<'import_batch_rows'>

export const MODE_LABEL: Record<ImportMode, string> = {
  catalog: 'Catálogo (productos y variantes)',
  stock: 'Solo stock (variantes existentes)',
  catalog_stock: 'Catálogo y stock',
}

export const createBatch = (mode: ImportMode, fileName: string, createMissing: boolean) =>
  rpc('create_import_batch', {
    p_mode: mode,
    p_file_name: fileName,
    p_options: { create_missing: createMissing },
  })

export async function addRows(
  batchId: string,
  rows: { row_number: number; raw: RawImportRow }[],
): Promise<void> {
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    await rpc('add_import_rows', { p_batch_id: batchId, p_rows: rows.slice(i, i + CHUNK) })
  }
}

export const validateBatch = (batchId: string) =>
  rpc('validate_import_batch', { p_batch_id: batchId })
export const applyBatch = (batchId: string, onlyValid: boolean) =>
  rpc('apply_import_batch', { p_batch_id: batchId, p_only_valid: onlyValid })
export const discardBatch = (batchId: string) =>
  rpc('discard_import_batch', { p_batch_id: batchId })

export async function getBatch(id: string): Promise<ImportBatch> {
  return unwrap(await supabase.from('import_batches').select('*').eq('id', id).single())
}

export async function listBatchRows(batchId: string): Promise<ImportRow[]> {
  const out: ImportRow[] = []
  for (let a = 0; ; a += 1000) {
    const page = unwrap(
      await supabase
        .from('import_batch_rows')
        .select('*')
        .eq('batch_id', batchId)
        .order('row_number')
        .range(a, a + 999),
    )
    out.push(...page)
    if (page.length < 1000) return out
  }
}

export async function listBatches(): Promise<ImportBatch[]> {
  return unwrap(
    await supabase
      .from('import_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15),
  )
}
