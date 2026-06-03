import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BookingFlow } from './components/booking/BookingFlow'
import { AdminPage } from './pages/AdminPage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Reserva pública */}
        <Route path="/" element={<BookingFlow />} />

        {/* Panel de administración */}
        <Route path="/admin" element={<AdminPage />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
