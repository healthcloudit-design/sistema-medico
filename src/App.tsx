import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { BookingFlow } from './components/booking/BookingFlow'
import { AdminPage } from './pages/AdminPage'
import { CancelPage } from './pages/CancelPage'
import { MedicoDashboard } from './pages/MedicoDashboard'
import { RecepcionPage } from './pages/RecepcionPage'
import { WaitingRoomScreen } from './pages/WaitingRoomScreen'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Landing con login unificado */}
        <Route path="/" element={<LandingPage />} />
        {/* Rutas de sistema */}
        <Route path="/cancelar"  element={<CancelPage />} />
        <Route path="/admin"     element={<AdminPage />} />
        <Route path="/medico"    element={<MedicoDashboard />} />
        <Route path="/recepcion" element={<RecepcionPage />} />
        {/* Pantalla sala de espera — publica, sin login */}
        <Route path="/pantalla/:slug" element={<WaitingRoomScreen />} />
        {/* Booking publico por slug */}
        <Route path="/:slug" element={<BookingFlow />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
