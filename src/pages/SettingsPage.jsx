import React, { useState, useEffect } from 'react'
import { PageHeader, Card, Button, Input, Select } from '../components/ui'
import toast from 'react-hot-toast'

function SettingsPage() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme')
    return savedTheme || 'light'
  })

  const [settings, setSettings] = useState({
    currency: 'CNY',
    dateFormat: 'YYYY-MM-DD',
    autoBackup: false,
    notifications: true
  })

  useEffect(() => {
    // 加载保存的设置
    const savedSettings = localStorage.getItem('appSettings')
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch (e) {
        console.error('Failed to load settings:', e)
      }
    }
  }, [])

  useEffect(() => {
    // 应用主题
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    toast.success('主题已切换')
  }

  const handleSettingChange = (key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value }
      localStorage.setItem('appSettings', JSON.stringify(updated))
      return updated
    })
    toast.success('设置已保存')
  }

  const handleExportData = async () => {
    try {
      // 这里应该调用数据导出功能
      toast.success('数据导出功能开发中...')
    } catch (error) {
      toast.error('导出失败')
    }
  }

  const handleImportData = () => {
    // 创建文件输入
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result)
            // 这里应该处理导入的数据
            toast.success('数据导入功能开发中...')
          } catch (error) {
            toast.error('导入失败：文件格式错误')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleClearData = () => {
    if (window.confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      localStorage.clear()
      toast.success('数据已清空')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        subtitle="管理应用设置和偏好"
      />

      {/* 主题设置 */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">主题设置</h3>
        <div className="flex space-x-4">
          <button
            onClick={() => handleThemeChange('light')}
            className={`flex-1 p-4 rounded-lg border-2 transition-all ${
              theme === 'light'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">☀️</div>
              <div className="font-medium text-gray-700">浅色模式</div>
            </div>
          </button>
          <button
            onClick={() => handleThemeChange('dark')}
            className={`flex-1 p-4 rounded-lg border-2 transition-all ${
              theme === 'dark'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">🌙</div>
              <div className="font-medium text-gray-700">深色模式</div>
            </div>
          </button>
        </div>
      </Card>

      {/* 显示设置 */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">显示设置</h3>
        <div className="space-y-4">
          <Select
            label="货币单位"
            value={settings.currency}
            onChange={(e) => handleSettingChange('currency', e.target.value)}
            options={[
              { value: 'CNY', label: '人民币 (CNY)' },
              { value: 'USD', label: '美元 (USD)' },
              { value: 'EUR', label: '欧元 (EUR)' }
            ]}
          />
          <Select
            label="日期格式"
            value={settings.dateFormat}
            onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
            options={[
              { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
              { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
              { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }
            ]}
          />
        </div>
      </Card>

      {/* 功能设置 */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">功能设置</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-gray-700">自动备份</div>
              <div className="text-sm text-gray-500">定期自动备份数据</div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoBackup}
              onChange={(e) => handleSettingChange('autoBackup', e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-gray-700">通知提醒</div>
              <div className="text-sm text-gray-500">启用系统通知</div>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => handleSettingChange('notifications', e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </label>
        </div>
      </Card>

      {/* 数据管理 */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">数据管理</h3>
        <div className="space-y-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={handleExportData}
          >
            📥 导出数据
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={handleImportData}
          >
            📤 导入数据
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={handleClearData}
          >
            🗑️ 清空所有数据
          </Button>
        </div>
      </Card>

      {/* 关于 */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">关于</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>财智追踪 v1.0.0</p>
          <p>一个简单易用的投资收益记录工具</p>
          <p className="pt-4 text-xs text-gray-500">
            © 2026 财智追踪. All rights reserved.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default SettingsPage

