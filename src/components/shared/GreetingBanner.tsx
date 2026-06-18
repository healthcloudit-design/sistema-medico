import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours()
  if (h < 13) return { text: 'Buen día',      emoji: '☀️' }
  if (h < 20) return { text: 'Buenas tardes', emoji: '🌤️' }
  return             { text: 'Buenas noches', emoji: '🌙' }
}

interface GreetingBannerProps {
  userName?: string | null
  subtitle?: string
}

export function GreetingBanner({ userName, subtitle }: GreetingBannerProps) {
  const { text, emoji } = getGreeting()
  const today = format(new Date(), "EEEE d 'de' MMMM", { locale: es })

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-purple-200">
      {/* Decorative circles */}
      <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full pointer-events-none" />
      <div className="absolute -bottom-8 right-10 w-40 h-40 bg-white/5 rounded-full pointer-events-none" />
      <div className="absolute top-2 right-20 w-10 h-10 bg-white/5 rounded-full pointer-events-none" />

      <div className="relative z-10">
        <p className="text-purple-200 text-sm font-medium">{emoji}&nbsp;{text}</p>
        <h2 className="text-2xl font-bold mt-1 leading-tight">{userName || '—'}</h2>
        <p className="text-purple-200/70 text-xs mt-1.5 capitalize">{subtitle ?? today}</p>
      </div>
    </div>
  )
}
