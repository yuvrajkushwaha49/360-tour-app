import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
  glow: boolean;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  maxLife: number;
  life: number;
  width: number;
  color: string;
}

interface NebulaParticle {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
}

export default function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initElements();
    };

    window.addEventListener('resize', handleResize);

    // Star colors reflecting cosmic purple, amber, and cool white/cyan
    const starColors = [
      'rgba(255, 255, 255, ',
      'rgba(225, 215, 255, ',
      'rgba(196, 181, 253, ',
      'rgba(254, 215, 170, ',
      'rgba(186, 230, 253, ',
      'rgba(236, 72, 153, '
    ];

    let stars: Star[] = [];
    let shootingStars: ShootingStar[] = [];
    let nebulaParticles: NebulaParticle[] = [];

    const initElements = () => {
      const starCount = Math.min(Math.floor((width * height) / 3750), 400);
      stars = [];

      for (let i = 0; i < starCount; i++) {
        const depth = Math.random(); // 0 (far) to 1 (near)
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 1.8 + (depth > 0.8 ? 1.2 : 0.4),
          speedX: (Math.random() - 0.5) * 0.25 * (depth + 0.3) - 0.08,
          speedY: (Math.random() - 0.5) * 0.25 * (depth + 0.3) - 0.12,
          opacity: Math.random() * 0.7 + 0.3,
          baseOpacity: Math.random() * 0.6 + 0.3,
          twinkleSpeed: Math.random() * 0.03 + 0.008,
          twinklePhase: Math.random() * Math.PI * 2,
          color: starColors[Math.floor(Math.random() * starColors.length)],
          glow: Math.random() > 0.75
        });
      }

      // Add a few floating ambient cosmic dust specks
      nebulaParticles = [];
      const particleCount = 12;
      const dustColors = [
        'rgba(168, 85, 247, ', // purple
        'rgba(245, 158, 11, ', // amber
        'rgba(99, 102, 241, '  // indigo
      ];

      for (let i = 0; i < particleCount; i++) {
        nebulaParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 40 + 25,
          speedX: (Math.random() - 0.5) * 0.15,
          speedY: (Math.random() - 0.5) * 0.15,
          opacity: Math.random() * 0.08 + 0.03,
          color: dustColors[Math.floor(Math.random() * dustColors.length)]
        });
      }
    };

    const spawnShootingStar = () => {
      // Meteors travel downwards and to the left/right diagonally
      const startX = Math.random() * width * 1.2;
      const startY = Math.random() * (height * 0.45);
      const angle = (Math.PI / 4) + (Math.random() * 0.4 - 0.2); // ~45 deg downward streak
      const speed = Math.random() * 9 + 11;
      const length = Math.random() * 100 + 70;
      const colors = ['#ffffff', '#c4b5fd', '#fde68a', '#a5f3fc'];

      shootingStars.push({
        x: startX,
        y: startY,
        length,
        speed,
        angle,
        opacity: 1,
        maxLife: Math.random() * 45 + 35,
        life: 0,
        width: Math.random() * 1.5 + 1.2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    };

    initElements();

    let lastShootingStarTime = Date.now();
    let nextSpawnInterval = Math.random() * 2500 + 1800; // First shooting star in 1.8-4.3s

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Render soft ambient dust particles
      for (const p of nebulaParticles) {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < -p.radius) p.x = width + p.radius;
        if (p.x > width + p.radius) p.x = -p.radius;
        if (p.y < -p.radius) p.y = height + p.radius;
        if (p.y > height + p.radius) p.y = -p.radius;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, `${p.color}${p.opacity})`);
        grad.addColorStop(1, `${p.color}0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Render moving & twinkling background stars
      for (const star of stars) {
        // Move stars smoothly
        star.x += star.speedX;
        star.y += star.speedY;

        // Wrap around borders
        if (star.x < 0) star.x = width;
        if (star.x > width) star.x = 0;
        if (star.y < 0) star.y = height;
        if (star.y > height) star.y = 0;

        // Twinkle calculation
        star.twinklePhase += star.twinkleSpeed;
        const twinkleFactor = 0.35 * Math.sin(star.twinklePhase) + 0.65;
        const currentOpacity = Math.max(0.1, Math.min(1, star.baseOpacity * twinkleFactor));

        // Draw star glow if enabled
        if (star.glow && currentOpacity > 0.4) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = `${star.color}${(currentOpacity * 0.2).toFixed(3)})`;
          ctx.fill();
        }

        // Draw core star
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `${star.color}${currentOpacity.toFixed(3)})`;
        ctx.fill();
      }

      // 3. Handle Shooting stars (meteors)
      const now = Date.now();
      if (now - lastShootingStarTime > nextSpawnInterval) {
        spawnShootingStar();
        lastShootingStarTime = now;
        nextSpawnInterval = Math.random() * 3500 + 2000; // Next meteor in 2.0-5.5s
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.life++;

        // Advance position
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;

        // Fade out
        const progress = ss.life / ss.maxLife;
        const currentAlpha = Math.sin((1 - progress) * Math.PI / 2);

        if (progress >= 1 || ss.x > width + 100 || ss.y > height + 100) {
          shootingStars.splice(i, 1);
          continue;
        }

        const tailX = ss.x - Math.cos(ss.angle) * ss.length;
        const tailY = ss.y - Math.sin(ss.angle) * ss.length;

        // Draw shooting star trail
        const gradient = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.7, `${ss.color === '#ffffff' ? 'rgba(255, 255, 255, ' : 'rgba(196, 181, 253, '}${(currentAlpha * 0.5).toFixed(3)})`);
        gradient.addColorStop(1, `${ss.color === '#ffffff' ? 'rgba(255, 255, 255, ' : 'rgba(254, 215, 170, '}${currentAlpha.toFixed(3)})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = ss.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.stroke();

        // Bright head glow of meteor
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, ss.width * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha.toFixed(3)})`;
        ctx.shadowColor = ss.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="universe-starfield-canvas"
      aria-hidden="true"
    />
  );
}
