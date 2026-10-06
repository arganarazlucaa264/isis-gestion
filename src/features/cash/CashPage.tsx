import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  QueryBoundary,
  Spinner,
  Stat,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DateRange } from '@/components/ui/DateRange'
import { defaultRange, type Range } from '@/components/ui/date-range'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Table, Td, Th, Thead, Tr } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/toast-context'
import {
  closeSession,
  getSession,
  listClosedTotals,
  listMethodTotals,
  listSessionMovements,
  listSessions,
  openSession,
  registerCashMovement,
  reopenSession,
} from '@/features/cash/api'
import { useOpenSession } from '@/features/cash/useOpenSession'
import { ExpenseFormModal } from '@/features/expenses/ExpenseFormModal'
import { useCan } from '@/features/auth/useCan'
import { useLookup } from '@/features/lookups/useLookup'
import { toUserMessage } from '@/lib/errors'
import { docNumber, formatDateTime, parseDecimal } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { CASH_KIND_LABELS, type CashSessionView } from '@/types/db'

function invalidateCash(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['cash'] }),
    qc.invalidateQueries({ queryKey: ['dashboard'] }),
  ])
}

function OpenSessionForm() {
  const toast = useToast()
  const qc = useQueryClient()
  const registers = useLookup('cash_registers')
  const [registerId, setRegisterId] = useState('')
  const [amount, setAmount] = useState('0')
  const [notes, setNotes] = useState('')
  const regs = registers.data?.filter((r) => r.active) ?? []
  const effective = registerId || regs[0]?.id || ''

  const open = useMutation({
    mutationFn: () => openSession(effective, parseDecimal(amount), notes.trim() || null),
    onSuccess: async () => {
      await invalidateCash(qc)
      toast.success('Caja abierta')
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })
  const amountN = parseDecimal(amount)

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader title="Abrir caja" />
      <div className="flex flex-col gap-3 p-4">
        <Select
          label="Caja"
          value={effective}
          onChange={(e) => {
            setRegisterId(e.target.value)
          }}
        >
          {regs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Input
          label="Dinero inicial en efectivo"
          value={amount}
          inputMode="decimal"
          onChange={(e) => {
            setAmount(e.target.value)
          }}
          hint="Efectivo con el que arrancás el turno"
        />
        <Textarea
          label="Notas (opcional)"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
          }}
        />
        <Button
          variant="gold"
          size="lg"
          disabled={effective === '' || Number.isNaN(amountN) || amountN < 0}
          loading={open.isPending}
          onClick={() => {
            open.mutate()
          }}
        >
          Abrir caja
        </Button>
      </div>
    </Card>
  )
}

function MovementModal({
  sessionId,
  kind,
  onClose,
}: {
  sessionId: string
  kind: 'income' | 'withdrawal'
  onClose: () => void
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const methods = useLookup('payment_methods')
  const available = methods.data?.filter((m) => m.active && (kind === 'income' || m.is_cash)) ?? []
  const [methodId, setMethodId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const effective = methodId || available[0]?.id || ''
  const amountN = parseDecimal(amount)

  const save = useMutation({
    mutationFn: () =>
      registerCashMovement({
        kind,
        paymentMethodId: effective,
        amount: amountN,
        description: description.trim(),
        sessionId,
      }),
    onSuccess: async () => {
      await invalidateCash(qc)
      toast.success(kind === 'income' ? 'Ingreso registrado' : 'Retiro registrado')
      onClose()
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  return (
    <Modal
      open
      title={kind === 'income' ? 'Registrar ingreso' : 'Registrar retiro de efectivo'}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!(amountN > 0) || description.trim() === '' || effective === ''}
            loading={save.isPending}
            onClick={() => {
              save.mutate()
            }}
          >
            Registrar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Select
          label="Medio"
          value={effective}
          onChange={(e) => {
            setMethodId(e.target.value)
          }}
        >
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Input
          label="Monto"
          value={amount}
          inputMode="decimal"
          onChange={(e) => {
            setAmount(e.target.value)
          }}
          autoFocus
        />
        <Input
          label="Descripción (obligatoria)"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
          }}
        />
        {kind === 'withdrawal' && (
          <p className="text-xs text-bronze-600">
            Los retiros son siempre de efectivo y descuentan del efectivo esperado.
          </p>
        )}
      </div>
    </Modal>
  )
}

function CloseModal({ session, onClose }: { session: CashSessionView; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const totals = useQuery({
    queryKey: ['cash', 'totals', session.id],
    queryFn: () => listMethodTotals(session.id),
  })
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [reported, setReported] = useState<Record<string, string>>({})
  const countedN = parseDecimal(counted)
  const diff = countedN - session.expected_cash_live

  const close = useMutation({
    mutationFn: () => {
      const rep: Record<string, number> = {}
      for (const [code, v] of Object.entries(reported)) {
        const n = parseDecimal(v)
        if (!Number.isNaN(n)) rep[code] = n
      }
      return closeSession({
        sessionId: session.id,
        countedCash: countedN,
        notes: notes.trim() || null,
        reported: rep,
      })
    },
    onSuccess: async () => {
      await invalidateCash(qc)
      toast.success('Caja cerrada')
      onClose()
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })

  const electronic = (totals.data ?? []).filter((t) => !t.is_cash)
  return (
    <Modal
      open
      title="Cerrar caja"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="gold"
            disabled={Number.isNaN(countedN) || countedN < 0}
            loading={close.isPending}
            onClick={() => {
              close.mutate()
            }}
          >
            Confirmar cierre
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          label="Efectivo esperado"
          value={formatMoney(session.expected_cash_live)}
          tone="dark"
          hint="Inicial + ingresos en efectivo − egresos en efectivo"
        />
        <Input
          label="Efectivo real contado"
          value={counted}
          inputMode="decimal"
          onChange={(e) => {
            setCounted(e.target.value)
          }}
          autoFocus
          hint="Contá los billetes y monedas de la caja"
        />
      </div>
      {!Number.isNaN(countedN) && counted !== '' && (
        <p
          className={`mt-3 rounded-lg p-3 text-center text-lg font-semibold ${diff === 0 ? 'bg-emerald-100 text-emerald-900' : diff < 0 ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}
        >
          {diff === 0
            ? 'La caja cierra sin diferencia'
            : diff < 0
              ? `Faltante: ${formatMoney(-diff)}`
              : `Sobrante: ${formatMoney(diff)}`}
        </p>
      )}
      {electronic.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xl font-semibold">Medios electrónicos (no son efectivo físico)</h3>
          <p className="mb-2 text-xs text-bronze-600">
            Opcional: ingresá lo que informa la terminal o el banco para conciliar.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {electronic.map((t) => (
              <Input
                key={t.code}
                label={`${t.name} · sistema ${formatMoney(t.net)}`}
                value={reported[t.code] ?? ''}
                inputMode="decimal"
                onChange={(e) => {
                  setReported({ ...reported, [t.code]: e.target.value })
                }}
              />
            ))}
          </div>
        </div>
      )}
      <Textarea
        label="Observaciones del cierre"
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value)
        }}
        wrapperClassName="mt-3"
      />
    </Modal>
  )
}

export function MovementsList({ sessionId }: { sessionId: string }) {
  const query = useQuery({
    queryKey: ['cash', 'movements', sessionId],
    queryFn: () => listSessionMovements(sessionId),
  })
  return (
    <QueryBoundary
      query={query}
      empty={{ check: (d) => d.length === 0, node: <EmptyState title="Sin movimientos" /> }}
    >
      {(rows) => (
        <Table>
          <Thead>
            <tr>
              <Th>Hora</Th>
              <Th>Tipo</Th>
              <Th>Medio</Th>
              <Th>Detalle</Th>
              <Th className="text-right">Monto</Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map((m) => (
              <Tr key={m.id}>
                <Td className="whitespace-nowrap">{formatDateTime(m.created_at)}</Td>
                <Td>{CASH_KIND_LABELS[m.kind]}</Td>
                <Td>
                  {m.payment_methods?.name}{' '}
                  {m.affects_physical_cash ? '' : <Badge>No es efectivo</Badge>}
                </Td>
                <Td className="max-w-72 truncate">{m.description}</Td>
                <Td
                  className={`text-right font-semibold tabular-nums ${m.direction === 'in' ? 'text-emerald-800' : 'text-red-800'}`}
                >
                  {m.direction === 'in' ? '+' : '−'}
                  {formatMoney(m.amount)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </QueryBoundary>
  )
}

function SessionPanel({ session }: { session: CashSessionView }) {
  const canWithdraw = useCan('owner', 'manager')
  const totals = useQuery({
    queryKey: ['cash', 'totals', session.id],
    queryFn: () => listMethodTotals(session.id),
  })
  const [modal, setModal] = useState<'income' | 'withdrawal' | 'expense' | 'close' | null>(null)
  const cash = totals.data?.find((t) => t.is_cash)
  const electronic = (totals.data ?? []).filter((t) => !t.is_cash)

  return (
    <>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Stat
          label="Efectivo esperado en caja"
          value={formatMoney(session.expected_cash_live)}
          tone="dark"
          hint={`Inicial ${formatMoney(session.opening_amount)} · ingresos ${formatMoney(cash?.total_in ?? 0)} · egresos ${formatMoney(cash?.total_out ?? 0)}`}
        />
        <Stat
          label="Medios electrónicos (no efectivo)"
          value={formatMoney(electronic.reduce((s, t) => s + t.net, 0))}
          tone="gold"
          hint="Transferencia, débito, crédito, Mercado Pago y otros"
        />
        <Stat
          label="Caja"
          value={docNumber('C', session.number)}
          hint={`Abierta ${formatDateTime(session.opened_at)}`}
        />
      </div>
      {electronic.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {electronic.map((t) => (
            <Badge key={t.code} tone="gold">
              {t.name}: {formatMoney(t.net)}
            </Badge>
          ))}
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          icon="plus"
          variant="outline"
          onClick={() => {
            setModal('income')
          }}
        >
          Ingreso
        </Button>
        <Button
          icon="receipt"
          variant="outline"
          onClick={() => {
            setModal('expense')
          }}
        >
          Gasto
        </Button>
        {canWithdraw && (
          <Button
            icon="minus"
            variant="outline"
            onClick={() => {
              setModal('withdrawal')
            }}
          >
            Retiro de efectivo
          </Button>
        )}
        <Button
          variant="gold"
          className="ml-auto"
          onClick={() => {
            setModal('close')
          }}
        >
          Cerrar caja
        </Button>
      </div>
      <Card>
        <CardHeader title="Movimientos del turno" />
        <MovementsList sessionId={session.id} />
      </Card>
      {(modal === 'income' || modal === 'withdrawal') && (
        <MovementModal
          sessionId={session.id}
          kind={modal}
          onClose={() => {
            setModal(null)
          }}
        />
      )}
      {modal === 'expense' && (
        <ExpenseFormModal
          onClose={() => {
            setModal(null)
          }}
        />
      )}
      {modal === 'close' && (
        <CloseModal
          session={session}
          onClose={() => {
            setModal(null)
          }}
        />
      )}
    </>
  )
}

function SessionDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const canReopen = useCan('owner')
  const toast = useToast()
  const qc = useQueryClient()
  const [reopening, setReopening] = useState(false)
  const session = useQuery({ queryKey: ['cash', 'session', id], queryFn: () => getSession(id) })
  const totals = useQuery({
    queryKey: ['cash', 'closed-totals', id],
    queryFn: () => listClosedTotals(id),
  })
  const reopen = useMutation({
    mutationFn: (reason: string) => reopenSession(id, reason),
    onSuccess: async () => {
      await invalidateCash(qc)
      toast.success('Caja reabierta')
      onClose()
    },
    onError: (e) => {
      toast.error(toUserMessage(e))
    },
  })
  const s = session.data
  return (
    <Modal open title={s ? `Caja ${docNumber('C', s.number)}` : 'Caja'} size="xl" onClose={onClose}>
      {session.isPending && <Spinner />}
      {session.isError && <ErrorState error={session.error} />}
      {s && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="Inicial" value={formatMoney(s.opening_amount)} />
            <Stat
              label="Efectivo esperado"
              value={formatMoney(
                s.status === 'closed' ? (s.expected_cash ?? 0) : s.expected_cash_live,
              )}
              tone="dark"
            />
            <Stat
              label="Efectivo contado"
              value={s.counted_cash === null ? '—' : formatMoney(s.counted_cash)}
            />
            <Stat
              label="Diferencia"
              value={s.cash_difference === null ? '—' : formatMoney(s.cash_difference)}
              tone={s.cash_difference !== null && s.cash_difference !== 0 ? 'danger' : 'neutral'}
            />
          </div>
          <p className="mt-2 text-sm text-bronze-600">
            Abierta {formatDateTime(s.opened_at)}
            {s.closed_at ? ` · Cerrada ${formatDateTime(s.closed_at)}` : ' · ABIERTA'}
            {s.closing_notes ? ` · ${s.closing_notes}` : ''}
          </p>
          {totals.data && totals.data.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xl font-semibold">Totales por medio de pago</h3>
              <Table>
                <Thead>
                  <tr>
                    <Th>Medio</Th>
                    <Th className="text-right">Ingresos</Th>
                    <Th className="text-right">Egresos</Th>
                    <Th className="text-right">Neto</Th>
                    <Th className="text-right">Informado</Th>
                  </tr>
                </Thead>
                <tbody>
                  {[...totals.data]
                    .sort(
                      (a, b) =>
                        (a.payment_methods?.sort_order ?? 0) - (b.payment_methods?.sort_order ?? 0),
                    )
                    .map((t) => (
                      <Tr key={t.payment_method_id}>
                        <Td>
                          {t.payment_methods?.name}{' '}
                          {!t.payment_methods?.is_cash && <Badge>No es efectivo</Badge>}
                        </Td>
                        <Td className="text-right tabular-nums">{formatMoney(t.total_in)}</Td>
                        <Td className="text-right tabular-nums">{formatMoney(t.total_out)}</Td>
                        <Td className="text-right font-semibold tabular-nums">
                          {formatMoney(t.expected)}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {t.reported === null ? '—' : formatMoney(t.reported)}
                        </Td>
                      </Tr>
                    ))}
                </tbody>
              </Table>
            </div>
          )}
          <h3 className="mt-4 text-xl font-semibold">Movimientos</h3>
          <MovementsList sessionId={id} />
          {canReopen && s.status === 'closed' && (
            <div className="mt-3 text-right">
              <Button
                variant="danger"
                onClick={() => {
                  setReopening(true)
                }}
              >
                Reabrir caja
              </Button>
            </div>
          )}
          <ReasonDialog
            open={reopening}
            title="Reabrir caja"
            description="Queda registrado en la auditoría con tu usuario y el motivo."
            confirmLabel="Reabrir"
            busy={reopen.isPending}
            onClose={() => {
              setReopening(false)
            }}
            onConfirm={(reason) => {
              reopen.mutate(reason)
            }}
          />
        </>
      )}
    </Modal>
  )
}

function History() {
  const [range, setRange] = useState<Range>(defaultRange())
  const [detail, setDetail] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['cash', 'history', range],
    queryFn: () => listSessions(range.from, range.to),
  })
  return (
    <>
      <div className="mb-3">
        <DateRange value={range} onChange={setRange} />
      </div>
      <Card>
        <QueryBoundary
          query={query}
          empty={{
            check: (d) => d.length === 0,
            node: <EmptyState title="Sin cajas en el período" />,
          }}
        >
          {(rows) => (
            <Table>
              <Thead>
                <tr>
                  <Th>Caja</Th>
                  <Th>Apertura</Th>
                  <Th>Cierre</Th>
                  <Th className="text-right">Inicial</Th>
                  <Th className="text-right">Esperado</Th>
                  <Th className="text-right">Contado</Th>
                  <Th className="text-right">Diferencia</Th>
                  <Th />
                </tr>
              </Thead>
              <tbody>
                {rows.map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-medium">{docNumber('C', s.number)}</Td>
                    <Td>{formatDateTime(s.opened_at)}</Td>
                    <Td>
                      {s.closed_at ? (
                        formatDateTime(s.closed_at)
                      ) : (
                        <Badge tone="gold">Abierta</Badge>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">{formatMoney(s.opening_amount)}</Td>
                    <Td className="text-right tabular-nums">
                      {formatMoney(
                        s.status === 'closed' ? (s.expected_cash ?? 0) : s.expected_cash_live,
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {s.counted_cash === null ? '—' : formatMoney(s.counted_cash)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {s.cash_difference === null ? (
                        '—'
                      ) : (
                        <Badge tone={s.cash_difference === 0 ? 'green' : 'red'}>
                          {formatMoney(s.cash_difference)}
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDetail(s.id)
                        }}
                      >
                        Ver
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </QueryBoundary>
      </Card>
      {detail && (
        <SessionDetailModal
          id={detail}
          onClose={() => {
            setDetail(null)
          }}
        />
      )}
    </>
  )
}

export function CashPage() {
  const canOperate = useCan('owner', 'manager', 'cashier')
  const { isPending, isError, error, session, sessions } = useOpenSession()
  const [tab, setTab] = useState<'caja' | 'historial'>(canOperate ? 'caja' : 'historial')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const current = sessions.find((s) => s.id === pickedId) ?? session

  return (
    <>
      <PageHeader
        title="Caja"
        description="Apertura, movimientos y cierre. El efectivo esperado solo cuenta efectivo físico."
      />
      <Tabs
        items={[
          ...(canOperate ? [{ value: 'caja' as const, label: 'Caja actual' }] : []),
          { value: 'historial' as const, label: 'Historial de cierres' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'historial' ? (
        <History />
      ) : isPending ? (
        <Spinner />
      ) : isError ? (
        <ErrorState error={error} />
      ) : sessions.length > 1 && !current ? (
        <Card>
          <CardHeader title="Hay varias cajas abiertas" />
          <div className="flex flex-col gap-2 p-4">
            {sessions.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                onClick={() => {
                  setPickedId(s.id)
                }}
              >
                {docNumber('C', s.number)} · abierta {formatDateTime(s.opened_at)}
              </Button>
            ))}
          </div>
        </Card>
      ) : current ? (
        <>
          {sessions.length > 1 && (
            <div className="mb-3 flex gap-2">
              {sessions.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={s.id === current.id ? 'primary' : 'outline'}
                  onClick={() => {
                    setPickedId(s.id)
                  }}
                >
                  {docNumber('C', s.number)}
                </Button>
              ))}
            </div>
          )}
          <SessionPanel session={current} />
        </>
      ) : (
        <OpenSessionForm />
      )}
    </>
  )
}
