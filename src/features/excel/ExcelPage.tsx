import { useState } from 'react'
import { PageHeader } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { ExportPanel } from '@/features/excel/ExportPanel'
import { ImportPanel } from '@/features/excel/ImportPanel'
import { useCan } from '@/features/auth/useCan'

export function ExcelPage() {
  const canImport = useCan('owner', 'manager', 'stock_clerk')
  const [tab, setTab] = useState<'importar' | 'exportar'>(canImport ? 'importar' : 'exportar')
  return (
    <>
      <PageHeader
        title="Excel"
        description="Importá y exportá productos y stock. SKU y EAN viajan como texto para conservar ceros iniciales."
      />
      <Tabs
        items={[
          ...(canImport ? [{ value: 'importar' as const, label: 'Importar' }] : []),
          { value: 'exportar' as const, label: 'Exportar' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'importar' && canImport ? <ImportPanel /> : <ExportPanel />}
    </>
  )
}
