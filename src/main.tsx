import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import UpdatePrompt from './components/UpdatePrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdatePrompt />
  </StrictMode>,
)

// Solo desarrollo: acceso a los stores desde la consola del navegador
if (import.meta.env.DEV) {
  void Promise.all([import('./store/playerStore'), import('./store/mapStore'), import('./store/inventoryStore')]).then(
    ([p, m, i]) => {
      Object.assign(window, { __cartel: { player: p.usePlayerStore, map: m.useMapStore, inv: i.useInventoryStore } })
    },
  )
}
