import React, { useEffect, useState } from 'react'
import '../styles/Fireworks.css'

/**
 * 烟花动画组件
 * @param {boolean} show - 是否显示烟花
 * @param {Function} onComplete - 动画完成回调
 */
export function Fireworks({ show, onComplete }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!show) {
      setParticles([])
      return
    }

    // 创建烟花粒子
    const newParticles = []
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8']
    
    // 创建多个烟花爆炸点
    for (let i = 0; i < 3; i++) {
      const centerX = 20 + Math.random() * 60 // 20% - 80% 的位置
      const centerY = 20 + Math.random() * 60
      
      // 每个爆炸点创建 30 个粒子
      for (let j = 0; j < 30; j++) {
        const angle = (Math.PI * 2 * j) / 30
        const velocity = 2 + Math.random() * 3
        const color = colors[Math.floor(Math.random() * colors.length)]
        
        newParticles.push({
          id: `${i}-${j}`,
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          color,
          size: 3 + Math.random() * 3,
          life: 1.0,
          decay: 0.02 + Math.random() * 0.02
        })
      }
    }
    
    setParticles(newParticles)

    // 动画循环
    const interval = setInterval(() => {
      setParticles(prev => {
        const updated = prev.map(particle => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vy: particle.vy + 0.1, // 重力
          life: particle.life - particle.decay,
          size: particle.size * 0.98
        })).filter(p => p.life > 0 && p.size > 0.5)
        
        if (updated.length === 0) {
          clearInterval(interval)
          setTimeout(() => {
            if (onComplete) onComplete()
          }, 500)
        }
        
        return updated
      })
    }, 16) // 约 60fps

    return () => clearInterval(interval)
  }, [show, onComplete])

  if (!show) return null

  return (
    <div className="fireworks-overlay">
      <div className="fireworks-container">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="firework-particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              backgroundColor: particle.color,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.life,
              transform: `translate(-50%, -50%) scale(${particle.life})`
            }}
          />
        ))}
        <div className="fireworks-message">
          <div className="celebration-text">🎉 目标达成！🎉</div>
        </div>
      </div>
    </div>
  )
}

