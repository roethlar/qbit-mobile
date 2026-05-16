import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface LayoutProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Layout({ children, className, padding = true }: LayoutProps) {
  return (
    <div className={clsx(
      // h-dvh anchors the layout to the actual viewport height so child
      // flex-1 + overflow-auto containers (the virtualized torrent list,
      // the Settings scroll area) get a real clipping height to scroll within.
      'h-dvh bg-gray-50 dark:bg-gray-950',
      'pt-safe-top pb-safe',
      'flex flex-col overflow-hidden',
      padding && 'px-4',
      className
    )}>
      {children}
    </div>
  );
}

interface HeaderProps {
  title: string;
  leftButton?: ReactNode;
  rightButton?: ReactNode;
  className?: string;
}

export function Header({ title, leftButton, rightButton, className }: HeaderProps) {
  return (
    <header className={clsx(
      'sticky top-safe-top z-10',
      'bg-white/80 dark:bg-gray-900/80 backdrop-blur-md',
      'border-b border-gray-100 dark:border-gray-700',
      'px-2 py-0.5',
      'flex items-center justify-between',
      className
    )}>
      <div className="flex items-center min-w-0 flex-1">
        {leftButton && (
          <div className="mr-3">
            {leftButton}
          </div>
        )}
        <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {title}
        </h1>
      </div>
      {rightButton && (
        <div className="ml-3 flex-shrink-0">
          {rightButton}
        </div>
      )}
    </header>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, padding = true, onClick }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-850 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700',
        padding && 'p-4',
        onClick && 'cursor-pointer active:bg-gray-50 dark:active:bg-gray-700 transition-colors',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Sheet'}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full bg-white dark:bg-gray-850 rounded-t-3xl shadow-xl max-h-[90vh] overflow-hidden">
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 -mr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}

interface FloatingActionButtonProps {
  onClick: () => void;
  icon: ReactNode;
  ariaLabel: string;
  className?: string;
}

export function FloatingActionButton({ onClick, icon, ariaLabel, className }: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={clsx(
        'fixed bottom-6 right-6',
        'w-14 h-14 bg-primary-600 text-white',
        'rounded-full shadow-lg',
        'flex items-center justify-center',
        'active:bg-primary-700 transition-colors',
        'z-40',
        className
      )}
      style={{ bottom: `calc(1.5rem + env(safe-area-inset-bottom))` }}
    >
      {icon}
    </button>
  );
}