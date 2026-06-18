import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchClosets } from '../api'

export default function RootRedirect() {
  const navigate = useNavigate()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetchClosets()
      .then(closets => {
        if (closets.length > 0) navigate(`/${closets[0].slug}`, { replace: true })
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
  }, [navigate])

  if (notFound) return <p style={{ padding: '2rem', color: 'var(--muted)', fontSize: '0.875rem' }}>No closets found.</p>
  return null
}
