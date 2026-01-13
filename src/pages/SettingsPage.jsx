import React, { useState, useEffect } from 'react'
import { PageHeader, Card, Button, Input, Select } from '../components/ui'
import toast from 'react-hot-toast'

function SettingsPage() {
  const [settings, setSettings] = useState({
    currency: 'CNY',
    dateFormat: 'YYYY-MM-DD',
    autoBackup: false,
    notifications: true,
    deepseekApiKey: ''
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
    // 加载 DeepSeek API Key
    const savedApiKey = localStorage.getItem('deepseek_api_key')
    if (savedApiKey) {
      setSettings(prev => ({ ...prev, deepseekApiKey: savedApiKey }))
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

  const handleApiKeyChange = (value) => {
    setSettings(prev => ({ ...prev, deepseekApiKey: value }))
  }

  const handleSaveApiKey = () => {
    const apiKey = settings.deepseekApiKey.trim()
    if (apiKey) {
      localStorage.setItem('deepseek_api_key', apiKey)
      toast.success('DeepSeek API Key 已保存')
    } else {
      localStorage.removeItem('deepseek_api_key')
      toast.success('DeepSeek API Key 已清除')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        subtitle="管理应用设置和偏好"
      />

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

      {/* AI 设置 */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">AI 智能分析设置</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              DeepSeek API Key
            </label>
            <div className="flex space-x-2 items-start">
              <div className="flex-1 max-w-md">
                <Input
                  type="password"
                  value={settings.deepseekApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="请输入您的 DeepSeek API Key"
                />
              </div>
              <Button
                onClick={handleSaveApiKey}
                variant="primary"
                className="whitespace-nowrap"
              >
                保存
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              用于 AI 智能分析功能。API Key 仅存储在本地，不会上传到服务器。
              <br />
              获取 API Key：访问{' '}
              <a
                href="https://platform.deepseek.com/api_keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                DeepSeek 平台
              </a>
            </p>
          </div>
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

