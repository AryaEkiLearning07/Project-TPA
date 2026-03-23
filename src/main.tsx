import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
import './index.css'
import App from './App.tsx'
import AppErrorBoundary from './components/common/AppErrorBoundary'

dayjs.locale('id')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <LocalizationProvider
        dateAdapter={AdapterDayjs}
        adapterLocale="id"
        localeText={{
          cancelButtonLabel: 'Batal',
          okButtonLabel: 'Oke',
        }}
      >
        <App />
      </LocalizationProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
