import { useEffect, useRef } from 'react'

interface Props {
  color: string
  onComplete: () => void
}

export default function DiveCanvas({ color, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    let radius = 0
    const maxRadius = Math.sqrt(cx * cx + cy * cy) * 1.5
    let animId: number

    // Bolhinhas
    const bubbles = Array.from({ length: 18 }, () => ({
      x: cx + (Math.random() - 0.5) * 80,
      y: cy + (Math.random() - 0.5) * 80,
      r: Math.random() * 18 + 4,
      speed: Math.random() * 2 + 1,
      opacity: Math.random() * 0.4 + 0.15,
      dx: (Math.random() - 0.5) * 1.5,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Onda principal — blob irregular
      ctx.beginPath()
      const points = 12
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const wobble = radius * (0.85 + Math.sin(Date.now() * 0.003 + i * 1.2) * 0.15)
        const x = cx + Math.cos(angle) * wobble
        const y = cy + Math.sin(angle) * wobble
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()

      // Bolhinhas
      bubbles.forEach((b) => {
        if (radius < maxRadius * 0.3) return
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${b.opacity})`
        ctx.fill()
        b.y -= b.speed
        b.x += b.dx
        b.r *= 0.995
        if (b.r < 1) {
          b.r = Math.random() * 18 + 4
          b.x = cx + (Math.random() - 0.5) * radius * 0.8
          b.y = cy + (Math.random() - 0.5) * radius * 0.8
        }
      })

      radius += maxRadius / 55

      if (radius < maxRadius) {
        animId = requestAnimationFrame(draw)
      } else {
        ctx.fillStyle = color
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        onComplete()
      }
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [color, onComplete])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    />
  )
}