import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './lib/app'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Journey from './pages/Journey'
import People from './pages/People'
import News from './pages/News'
import Events from './pages/Events'
import Surveys from './pages/Surveys'
import Recognition from './pages/Recognition'
import Wellbeing from './pages/Wellbeing'
import Culture from './pages/Culture'
import Growth from './pages/Growth'
import Voice from './pages/Voice'
import Cases from './pages/Cases'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

function Shell() {
  const app = useApp()
  if (app.session === undefined) return <Loading />
  if (!app.session) return <Login />
  if (app.loading) return <Loading />
  if (app.error) return <div className="content"><div className="card card-pad">เกิดข้อผิดพลาด: {app.error}</div></div>
  if (!app.me) return <Login notLinked />
  const hr = (el) => (app.isHR ? el : <Navigate to="/" replace />)
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/journey" element={<Journey />} />
        <Route path="/people" element={<People />} />
        <Route path="/news" element={<News />} />
        <Route path="/events" element={<Events />} />
        <Route path="/surveys" element={<Surveys />} />
        <Route path="/recognition" element={<Recognition />} />
        <Route path="/wellbeing" element={<Wellbeing />} />
        <Route path="/culture" element={<Culture />} />
        <Route path="/growth" element={<Growth />} />
        <Route path="/voice" element={<Voice />} />
        <Route path="/cases" element={hr(<Cases />)} />
        <Route path="/analytics" element={hr(<Analytics />)} />
        <Route path="/settings" element={hr(<Settings />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppProvider>
  )
}
