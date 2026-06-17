import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BookingFlow } from './components/booking/BookingFlow'
import { AdminPage } from './pages/AdminPage'
import { CancelPage } from './pages/CancelPage'
import { MedicoDashboard } from './pages/MedicoDashboard'
import { RecepcionPage } from './pages/RecepcionPage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Rutas de sistema - van ANTES de /:slug para que no sean interceptadas */}
        <Route path="/cancelar" element={<CancelPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/medico" element={<MedicoDashboard />} />
        <Route path="/recepcion" element={<RecepcionPage />} />
        {/* Booking multi-tenant: / carga primer org activa, /:slug carga por slug */}
        <Route path="/:slug" element={<BookingFlow />} />
        <Route path="/" element={<BookingFlow />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
