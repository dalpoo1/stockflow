import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { queryKeys } from '../api/queryKeys'
import type { Product } from '../api/types'
import { errorMessage } from '../utils/errorMessage'
import { formatTimeAgo } from '../utils/format'
import EmptyState from './EmptyState'
import ErrorState from './ErrorState'
import Modal from './Modal'
import Spinner from './Spinner'

export default function MovementHistoryModal({
  product,
  onClose,
}: {
  product: Product
  onClose: () => void
}) {
  const movementsQuery = useQuery({
    queryKey: queryKeys.products.movements(product.id),
    queryFn: () => api.listMovements(product.id),
  })

  const movements = movementsQuery.data?.data ?? []

  return (
    <Modal title={`Movement history — ${product.sku}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
          <span className="font-medium text-gray-900">{product.name}</span>
          <span className="text-gray-600">
            Current stock: <span className="font-semibold text-gray-900">{product.stock}</span>
          </span>
        </div>

        {movementsQuery.isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
            <Spinner /> Loading movement history…
          </div>
        )}

        {movementsQuery.isError && (
          <ErrorState
            message={errorMessage(movementsQuery.error)}
            onRetry={() => movementsQuery.refetch()}
          />
        )}

        {movementsQuery.isSuccess && movements.length === 0 && (
          <EmptyState message="No stock movements recorded yet." />
        )}

        {movementsQuery.isSuccess && movements.length > 0 && (
          <div className="max-h-80 overflow-y-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2 text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.type === 'in'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {m.type === 'in' ? 'In' : 'Out'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-gray-900">
                      {m.type === 'in' ? `+${m.qty}` : `−${m.qty}`}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{m.note || '—'}</td>
                    <td
                      className="px-3 py-2 text-right text-xs text-gray-500"
                      title={new Date(m.created_at).toLocaleString('id-ID')}
                    >
                      {formatTimeAgo(m.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
