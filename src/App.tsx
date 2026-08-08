import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { BookingFlow } from './components/booking/BookingFlow'
import { AdminPage } from './pages/AdminPage'
import { CancelPage } from './pages/CancelPage'
import { MedicoDashboard } from './pages/MedicoDashboard'
import { RecepcionPage } from './pages/RecepcionPage'
import { WaitingRoomScreen } from './pages/WaitingRoomScreen'
import { TotemPage } from './pages/TotemPage'
import { NuevoTenantPage } from './pages/superadmin/NuevoTenantPage'
import { PagoResultPage } from './pages/PagoResultPage'

export default function App() {
  return (
    <BrowserRouter basename="/agenda" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/"                        element={<LandingPage />} />
        <Route path="/cancelar"                element={<CancelPage />} />
        <Route path="/turno/pago-exitoso"      element={<PagoResultPage outcome="exitoso" />} />
        <Route path="/turno/pago-fallido"      element={<PagoResultPage outcome="fallido" />} />
        <Route path="/turno/pago-pendiente"    element={<PagoResultPage outcome="pendiente" />} />
        <Route path="/admin"                   element={<AdminPage />} />
        <Route path="/medico"                  element={<MedicoDashboard />} />
        <Route path="/profesional"             element={<MedicoDashboard />} />
        <Route path="/recepcion"               element={<RecepcionPage />} />
        <Route path="/pantalla/:slug"          element={<WaitingRoomScreen />} />
        <Route path="/totem/:slug"             element={<TotemPage />} />
        <Route path="/superadmin/nuevo-tenant" element={<NuevoTenantPage />} />
        <Route path="/:slug"                   element={<BookingFlow />} />
        <Route path="*"                        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
