import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

interface DataPoint {
  x: number;
  y: number;
  value: number;
  delay: number;
  speed: number;
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const dataPointsRef = useRef<DataPoint[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
      initDataPoints();
    };

    const initParticles = () => {
      const particleCount = Math.floor((canvas.width * canvas.height) / 15000);
      particlesRef.current = [];

      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2 + 1,
          opacity: Math.random() * 0.5 + 0.2
        });
      }
    };

    const initDataPoints = () => {
      dataPointsRef.current = [];
      const count = 8;

      for (let i = 0; i < count; i++) {
        dataPointsRef.current.push({
          x: (canvas.width / (count + 1)) * (i + 1),
          y: canvas.height * 0.7,
          value: Math.random() * 0.6 + 0.2,
          delay: i * 0.8,
          speed: 0.01 + Math.random() * 0.01
        });
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.016;

      drawParticles(ctx, canvas);
      drawConnections(ctx, canvas);
      drawDataPoints(ctx, canvas, time);
      drawFloatingIcons(ctx, canvas, time);
      drawTrendLines(ctx, canvas, time);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const drawParticles = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    particlesRef.current.forEach(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
      if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(59, 130, 246, ${particle.opacity})`;
      ctx.fill();
    });
  };

  const drawConnections = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const maxDistance = 150;
    const particles = particlesRef.current;

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < maxDistance) {
          const opacity = (1 - distance / maxDistance) * 0.15;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  };

  const drawDataPoints = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) => {
    dataPointsRef.current.forEach((point, index) => {
      const progress = ((time + point.delay) * point.speed) % 1;
      const barHeight = canvas.height * point.value * progress;
      const x = point.x;
      const y = canvas.height - barHeight;

      const gradient = ctx.createLinearGradient(x, y, x, canvas.height);
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
      gradient.addColorStop(1, 'rgba(37, 99, 235, 0.2)');

      ctx.fillStyle = gradient;
      ctx.fillRect(x - 15, y, 30, barHeight);

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 15, y, 30, barHeight);

      if (progress > 0.5) {
        ctx.beginPath();
        ctx.arc(x, y - 10, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 197, 94, ${(progress - 0.5) * 2})`;
        ctx.fill();
      }
    });
  };

  const drawFloatingIcons = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) => {
    const icons = [
      { x: canvas.width * 0.15, baseY: canvas.height * 0.3, symbol: '$', size: 20 },
      { x: canvas.width * 0.85, baseY: canvas.height * 0.4, symbol: '↑', size: 24 },
      { x: canvas.width * 0.25, baseY: canvas.height * 0.6, symbol: '%', size: 18 },
      { x: canvas.width * 0.75, baseY: canvas.height * 0.25, symbol: '★', size: 16 }
    ];

    icons.forEach((icon, index) => {
      const offset = Math.sin(time * 2 + index) * 15;
      const y = icon.baseY + offset;
      const opacity = 0.3 + Math.sin(time * 2 + index) * 0.2;

      ctx.font = `${icon.size}px Arial`;
      ctx.fillStyle = `rgba(59, 130, 246, ${opacity})`;
      ctx.textAlign = 'center';
      ctx.fillText(icon.symbol, icon.x, y);

      ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
      ctx.shadowBlur = 10;
      ctx.fillText(icon.symbol, icon.x, y);
      ctx.shadowBlur = 0;
    });
  };

  const drawTrendLines = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) => {
    const lines = [
      { startX: canvas.width * 0.1, startY: canvas.height * 0.5, endX: canvas.width * 0.4, endY: canvas.height * 0.2 },
      { startX: canvas.width * 0.6, startY: canvas.height * 0.6, endX: canvas.width * 0.9, endY: canvas.height * 0.3 }
    ];

    lines.forEach((line, index) => {
      const progress = ((time * 0.3 + index * 2) % 4) / 4;

      ctx.beginPath();
      ctx.moveTo(line.startX, line.startY);
      ctx.lineTo(line.endX, line.endY);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const pointX = line.startX + (line.endX - line.startX) * progress;
      const pointY = line.startY + (line.endY - line.startY) * progress;

      ctx.beginPath();
      ctx.arc(pointX, pointY, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pointX, pointY, 12, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.6 * (1 - progress)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
