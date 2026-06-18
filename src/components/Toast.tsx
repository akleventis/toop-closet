export type ToastVariant = 'success' | 'error'

type Props = {
  message: string
  variant?: ToastVariant
}

export default function Toast({ message, variant = 'success' }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-5 left-1/2 z-[500] flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium toast-in"
      style={{
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(28,28,30,0.94)',
        color: '#fafafa',
        boxShadow: '0 10px 34px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <span
        className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none shrink-0"
        style={{ backgroundColor: variant === 'success' ? '#22c55e' : '#ef4444', color: '#fff' }}
      >
        {variant === 'success' ? '✓' : '!'}
      </span>
      {message}
    </div>
  )
}
