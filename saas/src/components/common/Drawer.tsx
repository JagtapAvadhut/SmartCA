import { Fragment } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { X } from 'lucide-react'
import { cn } from '@/utils'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  side?: 'left' | 'right'
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

export function Drawer({ open, onClose, title, children, side = 'right', size = 'md' }: DrawerProps) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-hidden">
          <div className={cn('absolute inset-y-0 flex max-w-full', side === 'right' ? 'right-0' : 'left-0')}>
            <TransitionChild
              as={Fragment}
              enter="transform transition ease-out duration-300"
              enterFrom={side === 'right' ? 'translate-x-full' : '-translate-x-full'}
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-200"
              leaveFrom="translate-x-0"
              leaveTo={side === 'right' ? 'translate-x-full' : '-translate-x-full'}
            >
              <DialogPanel className={cn('w-screen h-full bg-white dark:bg-gray-900 shadow-xl flex flex-col', sizes[size])}>
                {title && (
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                    <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</DialogTitle>
                    <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400" aria-label="Close drawer">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-6 text-gray-900 dark:text-gray-100">{children}</div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
