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
      className="toast toast-in fixed top-5 left-1/2 z-[500] flex items-center gap-2.5 px-4 py-2.5"
      style={{ transform: 'translateX(-50%)' }} // plain transform (not a translate utility) so it matches the toast-in keyframes
    >
      <span
        className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none shrink-0 text-(--bg) ${variant === 'success' ? 'bg-(--success)' : 'bg-(--danger)'}`}
      >
        {variant === 'success' ? '✓' : '!'}
      </span>
      {message}
    </div>
  )
}
