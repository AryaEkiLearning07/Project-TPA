import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
import type { AuthUser } from '../../types'
import AdminSection from './AdminSection'

dayjs.locale('id')

interface AdminAppProps {
  user: AuthUser
  onLogout: () => Promise<void>
}

export default function AdminApp({ user, onLogout }: AdminAppProps) {
  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale="id"
      localeText={{
        cancelButtonLabel: 'Batal',
        okButtonLabel: 'Oke',
      }}
    >
      <AdminSection user={user} onLogout={onLogout} />
    </LocalizationProvider>
  )
}
