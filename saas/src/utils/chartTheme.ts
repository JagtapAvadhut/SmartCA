/** Shared Recharts styling that works in light and dark themes */
export const chartTheme = {
  grid: 'var(--chart-grid, #e2e8f0)',
  tick: 'var(--chart-tick, #64748b)',
  tooltip: {
    contentStyle: {
      backgroundColor: 'var(--chart-tooltip-bg, #ffffff)',
      border: '1px solid var(--chart-tooltip-border, #e2e8f0)',
      borderRadius: 12,
      color: 'var(--chart-tooltip-fg, #0f172a)',
      fontSize: 12,
    },
  },
}
