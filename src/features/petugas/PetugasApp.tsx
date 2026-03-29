import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
import type { AuthUser } from '../../types'
import PetugasSection from './PetugasSection'

dayjs.locale('id')

interface PetugasAppProps {
  user: AuthUser
  onLogout: () => Promise<void>
}

export default function PetugasApp({ user, onLogout }: PetugasAppProps) {
  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale="id"
      localeText={{
        cancelButtonLabel: 'Batal',
        okButtonLabel: 'Oke',
      }}
    >
      <PetugasSection user={user} onLogout={onLogout} />
    </LocalizationProvider>
  )
}
