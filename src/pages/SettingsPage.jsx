import React, { useState, useEffect } from 'react'
import { PageHeader, Card, Button, Input, Select } from '../components/ui'
import toast from 'react-hot-toast'

function SettingsPage() {
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

  const handleSettingChange = (key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value }
      localStorage.setItem('appSettings', JSON.stringify(updated))
      return updated
    })
    toast.success('设置已保存')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        subtitle="管理应用设置和偏好"
      />

      {/* 显示设置 */}
      <Card>
        <h3 className="text-sm sm:text-base lg:text-lg font-sans font-semibold text-amber-400 mb-3 sm:mb-4 flex items-center gap-2">
          <span className="w-0.5 h-4 sm:h-5 bg-amber-400 rounded-full"></span>
          显示设置
        </h3>
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
        <h3 className="text-sm sm:text-base lg:text-lg font-sans font-semibold text-amber-400 mb-3 sm:mb-4 flex items-center gap-2">
          <span className="w-0.5 h-4 sm:h-5 bg-amber-400 rounded-full"></span>
          功能设置
        </h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-gray-300">自动备份</div>
              <div className="text-sm text-gray-400">定期自动备份数据</div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoBackup}
              onChange={(e) => handleSettingChange('autoBackup', e.target.checked)}
              className="w-5 h-5 text-amber-500 border-dark-border rounded focus:ring-amber-500 bg-dark-elevated"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-gray-300">通知提醒</div>
              <div className="text-sm text-gray-400">启用系统通知</div>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => handleSettingChange('notifications', e.target.checked)}
              className="w-5 h-5 text-amber-500 border-dark-border rounded focus:ring-amber-500 bg-dark-elevated"
            />
          </label>
        </div>
      </Card>

      {/* 关于 */}
      <Card>
        <h3 className="text-sm sm:text-base lg:text-lg font-sans font-semibold text-amber-400 mb-3 sm:mb-4 flex items-center gap-2">
          <span className="w-0.5 h-4 sm:h-5 bg-amber-400 rounded-full"></span>
          关于
        </h3>
        <div className="space-y-2 text-sm text-gray-400">
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

