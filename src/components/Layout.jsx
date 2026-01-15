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
    <div className="min-h-screen bg-dark-bg relative overflow-hidden">
      {/* 背景装饰元素 - 非对称布局 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gold-base/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* 移动端顶部栏 */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-dark border-b border-dark-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl hover:bg-dark-elevated active:scale-95 transition-all duration-200 text-amber-400"
            >
              {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
            <img 
              src="/assets/images/logo.jpg" 
              alt="财智追踪" 
              className="w-9 h-9 rounded-xl object-cover shadow-glow-amber ring-2 ring-amber-500/30"
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
            <h1 className="text-xl font-display font-bold gradient-text-gold">
              财智追踪
            </h1>
          </div>
        </div>
      </div>

      <div className="flex relative z-10">
        {/* 侧边栏 - 重叠设计 */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40
            w-80 glass-dark border-r border-dark-border
            shadow-dark-xl lg:shadow-none
            transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            transition-transform duration-500 ease-out
            pt-16 lg:pt-0
          `}
        >
          <div className="h-full flex flex-col relative">
            {/* 装饰性渐变 */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-gold-base/5 pointer-events-none"></div>
            
            {/* Logo */}
            <div className="p-8 border-b border-dark-border relative z-10">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img 
                    src="/assets/images/logo.jpg" 
                    alt="财智追踪" 
                    className="w-14 h-14 rounded-2xl object-cover shadow-glow-amber ring-2 ring-amber-500/40"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-gold-base rounded-2xl flex items-center justify-center hidden shadow-glow-amber ring-2 ring-amber-500/40">
                    <span className="text-dark-bg font-display font-bold text-2xl">M</span>
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold gradient-text-gold mb-1">
                    财智追踪
                  </h1>
                  <p className="text-xs text-gray-400 font-sans">投资管理助手</p>
                </div>
              </div>
            </div>

            {/* 导航菜单 */}
            <nav className="flex-1 p-6 space-y-3 relative z-10">
              {menuItems.map((item, index) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center space-x-4 px-5 py-4 rounded-xl
                      transition-all duration-300
                      relative group
                      ${active
                        ? 'bg-gradient-to-r from-amber-500/20 to-gold-base/20 text-amber-400 border border-amber-500/30 shadow-glow-amber'
                        : 'text-gray-300 hover:bg-dark-elevated hover:text-amber-400 hover:border hover:border-amber-500/20'
                      }
                    `}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <Icon size={22} className={active ? 'text-amber-400' : 'text-gray-400 group-hover:text-amber-400 transition-colors'} />
                    <span className="font-sans font-semibold text-base">{item.label}</span>
                    {active && (
                      <div className="absolute right-4 w-1.5 h-1.5 bg-amber-400 rounded-full animate-glow-pulse"></div>
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* 遮罩层（移动端） */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 主内容区 - 非对称布局 */}
        <main className="flex-1 min-h-screen pt-16 lg:pt-0 overflow-x-hidden relative">
          <div className="p-6 lg:p-10 w-full max-w-full overflow-x-hidden">
            <div className="animate-fade-in">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout

