import { useState, useMemo, useRef, useEffect, type ReactNode, type ChangeEvent } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Columns3,
  Check,
  X,
} from 'lucide-react'
import { Button } from './Button'
import { SearchInput } from './SearchInput'
import { exportToCSV } from '@/utils'
import { cn } from '@/utils'

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  searchPlaceholder?: string
  exportFilename?: string
  pageSize?: number
  loading?: boolean
  className?: string
  enableRowSelection?: boolean
  onSelectionChange?: (rows: T[]) => void
  bulkActions?: ReactNode
  enableColumnVisibility?: boolean
  enableImport?: boolean
  onImport?: (rows: Record<string, string>[]) => void
  /** Seed the global search box (deep links like /invoices?q=INV-001) */
  initialSearch?: string
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }

  result.push(current)
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })
    return row
  })
}

const checkboxClassName =
  'rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-800'

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Search...',
  exportFilename = 'export',
  pageSize = 10,
  loading,
  className,
  enableRowSelection,
  onSelectionChange,
  bulkActions,
  enableColumnVisibility = true,
  enableImport,
  onImport,
  initialSearch = '',
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState(initialSearch)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnsOpen, setColumnsOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const columnsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!columnsOpen) return
    const onDoc = (e: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setColumnsOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [columnsOpen])

  const tableColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!enableRowSelection) return columns

    const selectionColumn: ColumnDef<T, unknown> = {
      id: 'select',
      size: 44,
      minSize: 44,
      maxSize: 44,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      header: ({ table: tbl }) => (
        <input
          type="checkbox"
          checked={tbl.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = tbl.getIsSomePageRowsSelected() && !tbl.getIsAllPageRowsSelected()
          }}
          onChange={tbl.getToggleAllPageRowsSelectedHandler()}
          aria-label="Select all rows"
          className={checkboxClassName}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          aria-label="Select row"
          className={checkboxClassName}
        />
      ),
    }

    return [selectionColumn, ...columns]
  }, [columns, enableRowSelection])

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, globalFilter, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: !!enableRowSelection,
    columnResizeMode: 'onEnd',
    enableColumnResizing: true,
    defaultColumn: {
      minSize: 80,
      size: 150,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  const selectedRows = useMemo(
    () => table.getSelectedRowModel().rows.map((row) => row.original),
    [table, rowSelection]
  )

  useEffect(() => {
    if (!enableRowSelection || !onSelectionChange) return
    onSelectionChange(selectedRows)
  }, [selectedRows, onSelectionChange, enableRowSelection])

  const exportableData = useMemo(
    () =>
      table.getFilteredRowModel().rows.map((row) => {
        const obj: Record<string, unknown> = {}
        row.getVisibleCells().forEach((cell) => {
          const col = cell.column.columnDef
          if ('accessorKey' in col && col.accessorKey) {
            obj[String(col.accessorKey)] = cell.getValue()
          }
        })
        return obj
      }),
    [table]
  )

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !onImport) return

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      const text = loadEvent.target?.result
      if (typeof text === 'string') {
        onImport(parseCSV(text))
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const visibleColumnCount = table.getVisibleLeafColumns().length
  const selectedCount = selectedRows.length

  return (
    <div className={cn('space-y-4 w-full min-w-0', className)}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <SearchInput
          value={globalFilter}
          onChange={setGlobalFilter}
          placeholder={searchPlaceholder}
          className="w-full sm:w-72 sm:max-w-full"
        />
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {enableColumnVisibility && (
            <div ref={columnsRef} className="relative">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setColumnsOpen((open) => !open)}
                aria-expanded={columnsOpen}
                aria-haspopup="listbox"
                aria-label="Toggle Columns"
              >
                <Columns3 className="h-4 w-4" />
                Columns
              </Button>
              {columnsOpen && (
                <div
                  role="listbox"
                  className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1"
                >
                  {table
                    .getAllLeafColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                      const label =
                        typeof column.columnDef.header === 'string'
                          ? column.columnDef.header
                          : column.id

                      return (
                        <button
                          key={column.id}
                          type="button"
                          role="option"
                          aria-selected={column.getIsVisible()}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                          onClick={() => column.toggleVisibility()}
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded border',
                              column.getIsVisible()
                                ? 'border-primary-600 bg-primary-600 text-white dark:border-primary-500 dark:bg-primary-500'
                                : 'border-gray-300 dark:border-gray-600'
                            )}
                          >
                            {column.getIsVisible() && <Check className="h-3 w-3" />}
                          </span>
                          {label}
                        </button>
                      )
                    })}
                </div>
              )}
            </div>
          )}
          {enableImport && onImport && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => exportToCSV(exportableData, exportFilename)}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {enableRowSelection && selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary-100 dark:border-primary-900/50 bg-primary-50/80 dark:bg-primary-950/30 px-4 py-2.5">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {selectedCount} selected
          </span>
          {bulkActions}
          <Button variant="ghost" size="sm" onClick={() => table.resetRowSelection()}>
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="table-scroll scrollbar-thin">
          <table className="w-full min-w-[640px]">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-gray-100 dark:border-gray-800">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="relative px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : header.column.id === 'select' ? (
                        flexRender(header.column.columnDef.header, header.getContext())
                      ) : (
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
                          )}
                        </button>
                      )}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                            'bg-gray-200 dark:bg-gray-600 opacity-0 hover:opacity-100',
                            header.column.getIsResizing() && 'opacity-100 bg-primary-500 dark:bg-primary-400'
                          )}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumnCount} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnCount} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                    No results found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors',
                      row.getIsSelected() && 'bg-primary-50/40 dark:bg-primary-950/20'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className="px-3 sm:px-4 py-3.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-sm text-gray-500 order-2 sm:order-1">
            {table.getFilteredRowModel().rows.length} results · Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </p>
          <div className="flex items-center gap-2 order-1 sm:order-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
