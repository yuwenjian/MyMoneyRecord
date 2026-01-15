import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  FiHome, 
  FiBarChart2, 
  FiClock, 
  FiSettings,
  FiMenu,
  FiX
} from 'react-icons/fi'

const Layout = ({ children }) => {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const menuItems = [
    { path: '/', label: '概览', icon: FiHome },
    { path: '/statistics', label: '统计分析', icon: FiBarChart2 },
    { path: '/records', label: '创建记录', icon: FiClock },
    { path: '/settings', label: '系统设置', icon: FiSettings },
  ]

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* 移动端顶部栏 */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition-all duration-200"
            >
              {sidebarOpen ? <FiX size={24} className="text-gray-700" /> : <FiMenu size={24} className="text-gray-700" />}
            </button>
            <img 
              src="/assets/images/logo.jpg" 
              alt="财智追踪" 
              className="w-9 h-9 rounded-xl object-cover shadow-sm"
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
              财智追踪
            </h1>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* 侧边栏 */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40
            w-72 bg-white/95 backdrop-blur-md border-r border-gray-200
            shadow-xl lg:shadow-none
            transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            transition-transform duration-300 ease-in-out
            pt-16 lg:pt-0
          `}
        >
          <div className="h-full flex flex-col">
            {/* Logo */}
            <div className="p-6 lg:p-8 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <img 
                    src="/assets/images/logo.jpg" 
                    alt="财智追踪" 
                    className="w-12 h-12 rounded-2xl object-cover shadow-md ring-2 ring-primary-100"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center hidden shadow-md ring-2 ring-primary-100">
                    <span className="text-white font-bold text-xl">M</span>
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
                    财智追踪
                  </h1>
                  <p className="text-xs text-gray-500 mt-0.5">投资管理助手</p>
                </div>
              </div>
            </div>

            {/* 导航菜单 */}
            <nav className="flex-1 p-4 space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center space-x-3 px-4 py-3.5 rounded-xl
                      transition-all duration-200
                      ${active
                        ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md shadow-primary-500/30'
                        : 'text-gray-700 hover:bg-gray-100 active:scale-95'
                      }
                    `}
                  >
                    <Icon size={20} className={active ? 'text-white' : 'text-gray-600'} />
                    <span className="font-semibold">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* 遮罩层（移动端） */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 主内容区 */}
        <main className="flex-1 min-h-screen pt-16 lg:pt-0 overflow-x-hidden">
          <div className="p-5 lg:p-8 w-full max-w-full overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout

