import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Admin from './admin/Admin'
import Camps from './citizen/Camps'
import Directory from './citizen/Directory'
import Doctor from './citizen/Doctor'
import Home from './citizen/Home'
import Shell from './citizen/Shell'
import Driver from './Driver'
import Login from './account/Login'
import Profile from './account/Profile'
import Health from './account/Health'
import Track from './account/Track'
import { DoctorDesk, DoctorPatient } from './account/DoctorDesk'
import { AuthProvider } from './AuthContext'
import { LangProvider } from './i18n'
import { track } from './track'

export default function App() {
  useEffect(() => {
    track('app_open')
  }, [])

  return (
    <LangProvider>
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="map" element={<Directory />} />
            <Route path="doctor" element={<Doctor />} />
            <Route path="camps" element={<Camps />} />
            <Route path="login" element={<Login />} />
            <Route path="profile" element={<Profile />} />
            <Route path="health" element={<Health />} />
            <Route path="dr" element={<DoctorDesk />} />
            <Route path="dr/patient/:id" element={<DoctorPatient />} />
            <Route path="s/:token" element={<Track />} />
            <Route path="r/:token" element={<Track />} />
          </Route>
          <Route path="/admin" element={<Admin />} />
          <Route path="/driver" element={<Driver />} />
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </LangProvider>
  )
}
