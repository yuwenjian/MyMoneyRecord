import React from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import OverviewPage from './pages/OverviewPage'
import StatisticsPage from './pages/StatisticsPage'
import RecordPage from './pages/RecordPage'
import OCRPage from './pages/OCRPage'
import SettingsPage from './pages/SettingsPage'
import TestPage from './pages/TestPage'
import './App.css'

function App() {
  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 2000,
          style: {
            background: '#333',
            color: '#fff',
            borderRadius: '10px',
            fontSize: '14px',
          },
        }}
      />
      <Router>
        <Layout>
          <Routes>
            <Route path="/test" element={<TestPage />} />
            <Route path="/" element={<OverviewPage />} />
            <Route path="/statistics" element={<StatisticsPage />} />
            <Route path="/records" element={<RecordPage />} />
            <Route path="/ocr" element={<OCRPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </Router>
    </>
  )
}

export default App
