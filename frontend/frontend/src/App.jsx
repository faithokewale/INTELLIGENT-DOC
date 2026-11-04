import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import Documents from './pages/Documents'
import DocumentPage from './pages/DocumentPage'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center text-muted">Loading…</div>
  return user ? children : <Navigate to="/login" replace />
}
export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Documents />} />
        <Route path="/documents/:id" element={<DocumentPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
