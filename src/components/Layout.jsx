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
    <div className="min-h-screen bg-gray-50">
      {/* 移动端顶部栏 */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
            <img 
              src="/assets/images/logo.png" 
              alt="财智追踪" 
              className="w-8 h-8 rounded-lg object-cover"
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
            <h1 className="text-xl font-bold text-gray-800">财智追踪</h1>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* 侧边栏 */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40
            w-64 bg-white shadow-lg lg:shadow-none
            transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            transition-transform duration-300 ease-in-out
            pt-16 lg:pt-0
          `}
        >
          <div className="h-full flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <img 
                  src="/assets/images/logo.png" 
                  alt="财智追踪" 
                  className="w-10 h-10 rounded-lg object-cover"
                  onError={(e) => {
                    // 如果图片加载失败，显示默认图标
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center hidden">
                  <span className="text-white font-bold text-xl">M</span>
                </div>
                <h1 className="text-xl font-bold text-gray-800">财智追踪</h1>
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
                      flex items-center space-x-3 px-4 py-3 rounded-lg
                      transition-colors duration-200
                      ${active
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* 遮罩层（移动端） */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 主内容区 */}
        <main className="flex-1 min-h-screen pt-16 lg:pt-0 overflow-x-hidden">
          <div className="p-4 lg:p-6 w-full max-w-full overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout

