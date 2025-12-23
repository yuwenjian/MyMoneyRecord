import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { FiMoon, FiSun } from 'react-icons/fi'
import RecordPage from './pages/RecordPage'
import StatisticsPage from './pages/StatisticsPage'
import './App.css'

function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme')
    return savedTheme || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <>
      <div className="theme-toggle-container">
        <button 
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label="切换主题"
          title={theme === 'light' ? '切换到暗色模式' : '切换到浅色模式'}
        >
          {theme === 'light' ? <FiMoon /> : <FiSun />}
        </button>
      </div>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 2000,
          style: {
            background: theme === 'dark' ? '#1e293b' : '#333',
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
