import type { ReactNode } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export interface TableColumn<T> {
  key: string
  label: string
  sortable?: boolean
  /** Chiffres alignés à droite avec `tabular-nums` — cf. spec bureau, règle de traduction n°3. */
  numeric?: boolean
  align?: 'left' | 'right' | 'center'
  width?: string
  /** Remplace le libellé dans l'en-tête (ex. case à cocher « tout sélectionner ») ; `label` reste le nom accessible. */
  headerContent?: ReactNode
  render?: (row: T) => ReactNode
}

interface TableProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string
  emptyMessage?: string
}

/** Tableau bureau triable — remplace les cartes empilées mobile (règle de traduction n°3). Le tri
 *  reste géré par l'écran appelant (state local), cohérent avec le pattern manuel du reste du repo. */
export default function Table<T>({
  columns,
  rows,
  getRowKey,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  rowClassName,
  emptyMessage,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="bg-bg-elevated text-left">
            {columns.map((col) => {
              const align = col.align ?? (col.numeric ? 'right' : 'left')
              const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-3 sm:px-4 py-3 font-bold text-text-muted text-xs uppercase tracking-wide whitespace-nowrap ${alignClass} ${
                    col.sortable ? 'cursor-pointer select-none hover:text-text' : ''
                  }`}
                  onClick={col.sortable ? () => onSort?.(col.key) : undefined}
                >
                  <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {col.headerContent ?? col.label}
                    {col.sortable && sortKey === col.key && (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-text-dim">
                {emptyMessage ?? '—'}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className={`border-t border-border-hairline ${onRowClick ? 'cursor-pointer hover:bg-bg-elevated' : ''} ${
                rowClassName?.(row) ?? ''
              }`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => {
                const align = col.align ?? (col.numeric ? 'right' : 'left')
                const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                return (
                  <td key={col.key} className={`px-3 sm:px-4 py-3 ${col.numeric ? 'amount' : ''} ${alignClass}`}>
                    {col.render ? col.render(row) : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
