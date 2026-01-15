import React from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import OverviewPage from './pages/OverviewPage'
import StatisticsPage from './pages/StatisticsPage'
import RecordPage from './pages/RecordPage'
import OCRPage from './pages/OCRPage'
import SettingsPage from './pages/SettingsPage'
import PortfolioPage from './pages/PortfolioPage'
import CalendarPage from './pages/CalendarPage'
import TestPage from './pages/TestPage'
import './App.css'

function App() {
  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 2500,
          style: {
            background: 'white',
            color: '#1f2937',
            borderRadius: '16px',
            fontSize: '14px',
            fontWeight: '500',
            padding: '16px 20px',
            boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: 'white',
            },
            style: {
              borderLeft: '4px solid #22c55e',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: 'white',
            },
            style: {
              borderLeft: '4px solid #ef4444',
            },
          },
          loading: {
            iconTheme: {
              primary: '#3b82f6',
              secondary: 'white',
            },
            style: {
              borderLeft: '4px solid #3b82f6',
            },
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
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
          </Routes>
        </Layout>
      </Router>
    </>
  )
}

export default App
