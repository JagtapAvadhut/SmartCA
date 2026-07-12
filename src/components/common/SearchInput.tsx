import { Search } from 'lucide-react'
import { Input } from './Input'
import { cn } from '@/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className }: SearchInputProps) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      icon={<Search className="h-4 w-4" />}
      aria-label={placeholder}
      className={cn('bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700', className)}
    />
  )
}
