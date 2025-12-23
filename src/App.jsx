import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import RecordPage from './pages/RecordPage'
import StatisticsPage from './pages/StatisticsPage'

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
        <Routes>
          <Route path="/" element={<RecordPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
