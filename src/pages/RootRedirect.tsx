import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function RootRedirect() {
  const navigate = useNavigate()
  const { backTo, closetsLoaded } = useAuth()

  // Logged-in user → their active workspace's first closet; anonymous → the public flagship.
  useEffect(() => {
    if (backTo !== '/') navigate(backTo, { replace: true })
  }, [backTo, navigate])

  if (closetsLoaded && backTo === '/') {
    return <p className="text-(--muted) text-sm text-center mt-16">No closets found.</p>
  }
  return null
}
