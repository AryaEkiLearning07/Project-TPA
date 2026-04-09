import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CardStackDemo from './components/common/CardStackDemo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CardStackDemo />
  </StrictMode>,
)
