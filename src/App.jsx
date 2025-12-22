import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import RecordPage from './pages/RecordPage'
import StatisticsPage from './pages/StatisticsPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RecordPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
      </Routes>
    </Router>
  )
}

export default App

