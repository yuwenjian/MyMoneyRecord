import React from 'react'

function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">测试页面</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-700">如果你能看到这个页面，说明基础渲染正常。</p>
          <div className="mt-4 p-4 bg-blue-100 rounded">
            <p className="text-blue-800">Tailwind CSS 样式测试</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestPage

