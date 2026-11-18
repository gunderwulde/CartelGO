import { useState } from 'react'
import { devAdvance, devFavors, devGive, devHeat, devReputation, devTutorial } from '../services/devTools'

const HOUR = 60 * 60_000

/** Panel de pruebas (?dev): dinero, favores, reputación y adelantar el reloj. */
export default function DevPanel() {
  const [open, setOpen] = useState(false)
  const btn = 'cartoon-btn px-2 py-1 text-xs'
  return (
    <div className="fixed right-3 top-[14.5rem] z-40 flex flex-col items-end gap-2">
      <button className={`${btn} bg-white!`} onClick={() => setOpen((o) => !o)}>
        DEV
      </button>
      {open && (
        <div className="cartoon-card bg-white! p-2 grid grid-cols-2 gap-2">
          <button className={btn} onClick={() => devGive(1000, 0)}>+$1000 sucio</button>
          <button className={btn} onClick={() => devGive(0, 1000)}>+$1000 limpio</button>
          <button className={btn} onClick={() => devFavors(10)}>+10 favores</button>
          <button className={btn} onClick={() => devReputation(100)}>+100 rep</button>
          <button className={btn} onClick={() => devAdvance(HOUR)}>Reloj +1 h</button>
          <button className={btn} onClick={() => devAdvance(8 * HOUR)}>Reloj +8 h</button>
          <button className={btn} onClick={devHeat}>Heat a 0</button>
          <button className={btn} onClick={() => devTutorial(true)}>Saltar tutorial</button>
          <button className={`${btn} col-span-2`} onClick={() => devTutorial(false)}>Reiniciar tutorial</button>
        </div>
      )}
    </div>
  )
}
