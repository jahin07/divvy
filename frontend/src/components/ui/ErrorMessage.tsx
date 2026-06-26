interface ErrorMessageProps {
  message: string | null
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null
  return (
    <div className="text-red text-sm font-medium mt-2.5 px-3 py-2 bg-red-dim rounded-input">
      {message}
    </div>
  )
}
