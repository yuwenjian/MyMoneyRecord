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
            background: '#1a1625',
            color: '#f3f4f6',
            borderRadius: '16px',
            fontSize: '14px',
            fontWeight: '500',
            padding: '16px 20px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            fontFamily: 'IBM Plex Sans, sans-serif',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#1a1625',
            },
            style: {
              borderLeft: '4px solid #10b981',
              background: '#1a1625',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#1a1625',
            },
            style: {
              borderLeft: '4px solid #ef4444',
              background: '#1a1625',
            },
          },
          loading: {
            iconTheme: {
              primary: '#fbbf24',
              secondary: '#1a1625',
            },
            style: {
              borderLeft: '4px solid #fbbf24',
              background: '#1a1625',
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
