import { Fragment } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { X } from 'lucide-react'
import { cn } from '@/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
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

        <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:scale-95"
          >
            <DialogPanel
              className={cn(
                'w-full bg-white dark:bg-gray-900 shadow-xl',
                'rounded-t-2xl sm:rounded-2xl',
                'max-h-[92svh] sm:max-h-[90vh] flex flex-col',
                'border border-gray-100 dark:border-gray-800',
                sizes[size]
              )}
            >
              {title && (
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                  <DialogTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 pr-2">
                    {title}
                  </DialogTitle>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
              <div className="p-4 sm:p-6 overflow-y-auto scrollbar-thin safe-bottom">{children}</div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
