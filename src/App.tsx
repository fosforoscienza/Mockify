import { Outlet } from 'react-router-dom'
import Header from './components/Header'
import UpdateBanner from './components/UpdateBanner'

export default function App() {
  return (
    <div className="app">
      <Header />
      <Outlet />
      <UpdateBanner />
    </div>
  )
}
