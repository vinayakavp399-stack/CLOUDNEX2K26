import React, { useRef, useEffect, useState } from 'react';

/**
 * CloudNex3D — Full GPU-accelerated animated 3D CloudNex centrepiece.
 *
 * Layers (back → front):
 *  0. Deep-space star-field canvas
 *  1. SVG rotating hex grid (perspective)
 *  2. Three orbital gimbal rings (3D preserve-3d, one on each axis)
 *  3. Volumetric extruded cloud body (5 stacked SVG plates)
 *  4. Floating circuit-bus traces above the cloud surface
 *  5. Hyper-luminous 3D Nexus sphere + electron orbit
 *  6. Sparkle beacons
 *  7. Mouse-parallax tilt on the whole scene
 */
export default function CloudNex3D({ size = 'hero', className = '' }) {
  const isHero = size === 'hero';
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  /* ── Star-field canvas ── */
  useEffect(() => {
    if (!isHero || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let w, h;
    const stars = [];
    const STAR_COUNT = 180;

    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        a: Math.random(),
        da: (Math.random() - 0.5) * 0.008,
        col: ['#00f5ff', '#38bdf8', '#a5b4fc', '#ffffff'][Math.floor(Math.random() * 4)]
      });
    }

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      stars.forEach(s => {
        s.a = Math.max(0.05, Math.min(1, s.a + s.da));
        if (s.a <= 0.05 || s.a >= 1) s.da *= -1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.col;
        ctx.globalAlpha = s.a * 0.75;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [isHero]);

  /* ── Mouse tilt ── */
  const onMove = (e) => {
    if (!containerRef.current || !isHero) return;
    const r = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: +(-y * 18).toFixed(2), y: +(x * 18).toFixed(2) });
  };

  const tiltStyle = isHero
    ? {
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: hovered
          ? 'transform 0.1s cubic-bezier(.16,1,.3,1)'
          : 'transform 0.9s cubic-bezier(.16,1,.3,1)',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }
    : {};

  /* sizes */
  const logoW = isHero ? 'w-52 h-52 sm:w-64 sm:h-64' : 'w-11 h-11';

  return (
    <div
      ref={containerRef}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTilt({ x: 0, y: 0 }); }}
      className={`relative select-none ${className}`}
      style={{ perspective: isHero ? '1100px' : '600px' }}
    >
      {/* ── Layer 0: Star-field ── */}
      {isHero && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none rounded-full"
          style={{ zIndex: 0 }}
        />
      )}

      {/* ── Ambient radial glow ── */}
      <div
        className={`absolute rounded-full pointer-events-none ${
          isHero
            ? 'w-96 h-96 -top-16 left-1/2 -translate-x-1/2 opacity-70 group-hover:opacity-100'
            : 'w-20 h-20 -top-2 left-1/2 -translate-x-1/2'
        }`}
        style={{
          background: isHero
            ? 'radial-gradient(circle, rgba(0,245,255,0.22) 0%, rgba(99,102,241,0.18) 50%, transparent 75%)'
            : 'radial-gradient(circle, rgba(0,245,255,0.3) 0%, transparent 70%)',
          filter: 'blur(28px)',
          zIndex: 1,
        }}
      />

      {/* ── 3D tilt stage ── */}
      <div
        className={`relative flex items-center justify-center ${logoW}`}
        style={{ ...tiltStyle, zIndex: 2 }}
      >
        {/* SVG defs shared across layers */}
        <svg className="w-0 h-0 absolute overflow-hidden" aria-hidden>
          <defs>
            <linearGradient id="cn3d-front" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="30%" stopColor="#00f5ff" />
              <stop offset="65%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="cn3d-extrude" x1="30" y1="30" x2="170" y2="170" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0369a1" />
              <stop offset="50%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
            <radialGradient id="cn3d-glass" cx="38%" cy="35%" r="62%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#082f49" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.96" />
            </radialGradient>
            <radialGradient id="cn3d-sphere" cx="30%" cy="28%" r="68%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="22%" stopColor="#a5f3fc" />
              <stop offset="52%" stopColor="#00f5ff" />
              <stop offset="82%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#082f49" />
            </radialGradient>
            <linearGradient id="cn3d-orbit" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00f5ff" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
            </linearGradient>
            <filter id="cn3d-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.5" result="b" />
              <feComposite in="SourceGraphic" in2="b" operator="over" />
            </filter>
            <filter id="cn3d-bevel">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="b" />
              <feSpecularLighting in="b" surfaceScale="4" specularConstant="1.4" specularExponent="22" lightingColor="#ffffff" result="spec">
                <fePointLight x="-60" y="-120" z="250" />
              </feSpecularLighting>
              <feComposite in="spec" in2="SourceAlpha" operator="in" result="spec2" />
              <feComposite in="SourceGraphic" in2="spec2" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
            </filter>
          </defs>
        </svg>

        {/* ── Pedestal ring (translateZ -30) ── */}
        {isHero && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ transform: 'translateZ(-30px)', transformStyle: 'preserve-3d' }}
          >
            <div
              className="w-60 h-60 rounded-full border border-dashed border-cyan-400/20"
              style={{
                animation: 'spin 36s linear infinite',
                boxShadow: '0 0 40px rgba(0,245,255,0.08) inset'
              }}
            />
          </div>
        )}

        {/* ── Gimbal ring X (translateZ 4) ── */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ transform: 'translateZ(4px)', transformStyle: 'preserve-3d' }}
        >
          <div
            className={`rounded-full border-2 border-cyan-400/55 ${isHero ? 'w-60 h-60' : 'w-14 h-14'}`}
            style={{
              animation: 'gyroX 16s linear infinite',
              boxShadow: isHero ? '0 0 18px rgba(0,245,255,0.35), 0 0 6px rgba(0,245,255,0.5) inset' : 'none',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="absolute rounded-full bg-cyan-300 shadow-[0_0_10px_#00f5ff]"
              style={{ width: 10, height: 10, top: '4%', left: '50%', transform: 'translate(-50%,-50%) translateZ(6px)' }}
            />
          </div>
        </div>

        {/* ── Gimbal ring Y (translateZ 10) ── */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ transform: 'translateZ(10px)', transformStyle: 'preserve-3d' }}
        >
          <div
            className={`rounded-full border border-indigo-400/45 ${isHero ? 'w-60 h-60' : 'w-14 h-14'}`}
            style={{ animation: 'gyroY 12s linear infinite reverse' }}
          >
            <div
              className="absolute rounded-full bg-purple-400 shadow-[0_0_10px_#a855f7]"
              style={{ width: 8, height: 8, bottom: '6%', left: '50%', transform: 'translate(-50%,50%) translateZ(10px)' }}
            />
          </div>
        </div>

        {/* ── Cloud extrusion plates ── */}
        {/* Back plate Z:0 */}
        <div
          className="absolute inset-0"
          style={{ transform: 'translateZ(0px) scale(0.97)', transformStyle: 'preserve-3d' }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full opacity-55">
            <path d={CLOUD_PATH} fill="url(#cn3d-extrude)" stroke="#0284c7" strokeWidth="4" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Mid plate Z:14 */}
        {isHero && (
          <div
            className="absolute inset-0"
            style={{ transform: 'translateZ(14px) scale(0.985)', transformStyle: 'preserve-3d' }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full opacity-80">
              <path d={CLOUD_PATH} fill="url(#cn3d-extrude)" stroke="rgba(0,245,255,0.35)" strokeWidth="3.5" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Front face plate Z:28 */}
        <div
          className="absolute inset-0"
          style={{
            transform: isHero ? 'translateZ(28px)' : 'translateZ(8px)',
            transformStyle: 'preserve-3d',
            filter: isHero ? 'drop-shadow(0 16px 32px rgba(0,0,0,0.9)) drop-shadow(0 0 22px rgba(0,245,255,0.38))' : 'none',
          }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <path d={CLOUD_PATH} fill="url(#cn3d-glass)" stroke="url(#cn3d-front)" strokeWidth={isHero ? '4' : '3'} strokeLinejoin="round" filter="url(#cn3d-bevel)" />
            {/* Specular top-left rim */}
            <path d="M40 98 C40 86 49 75 62 74 C66 74 70 75 73 77 C77 65 89 57 103 57 C120 57 134 69 137 85"
              fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
          </svg>
        </div>

        {/* Circuit traces Z:46 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ transform: isHero ? 'translateZ(46px)' : 'translateZ(14px)', transformStyle: 'preserve-3d' }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <path d="M58 116 H142 M75 96 H125 M88 78 H112" stroke="#00f5ff" strokeWidth="1.6" strokeDasharray="6 4" opacity="0.75" />
            <path d="M80 116 L92 96 L108 96 L120 116" stroke="#818cf8" strokeWidth="1.8" opacity="0.85" />
            <circle cx="75" cy="96" r="2.8" fill="#38bdf8" />
            <circle cx="125" cy="96" r="2.8" fill="#c084fc" />
            <circle cx="80" cy="116" r="2.8" fill="#00f5ff" />
            <circle cx="120" cy="116" r="2.8" fill="#6366f1" />
          </svg>
        </div>

        {/* Nexus sphere Z:65 */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: isHero ? 'translateZ(65px)' : 'translateZ(20px)',
            transformStyle: 'preserve-3d',
            marginTop: '8%',
          }}
        >
          <div className="relative flex items-center justify-center">
            {/* Sphere */}
            <div
              className={`rounded-full relative ${isHero ? 'w-11 h-11 sm:w-13 sm:h-13' : 'w-3 h-3'}`}
              style={{
                background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #38bdf8 38%, #0369a1 72%, #020617 100%)',
                boxShadow: isHero
                  ? 'inset -3px -3px 8px rgba(0,0,0,0.85), inset 2px 2px 5px rgba(255,255,255,0.9), 0 0 28px #00f5ff, 0 0 50px rgba(99,102,241,0.5)'
                  : '0 0 10px #00f5ff',
              }}
            >
              {/* Electron ring */}
              {isHero && (
                <div
                  className="absolute -inset-2 rounded-full border border-cyan-300/60 pointer-events-none"
                  style={{ animation: 'spin 3.5s linear infinite', transform: 'rotateX(58deg)' }}
                >
                  <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#fff] absolute -top-1 left-1/2 -translate-x-1/2" />
                </div>
              )}
            </div>
            {/* Corona pulse */}
            <div
              className={`absolute rounded-full bg-cyan-400/30 animate-ping pointer-events-none ${isHero ? 'w-16 h-16' : 'w-4 h-4'}`}
            />
          </div>
        </div>

        {/* Sparkle beacons Z:88 */}
        {isHero && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ transform: 'translateZ(88px)', transformStyle: 'preserve-3d' }}
          >
            <span className="absolute top-3 right-5 text-cyan-200 text-sm animate-pulse drop-shadow-[0_0_8px_#00f5ff]">✦</span>
            <span className="absolute bottom-8 left-7 text-purple-300 text-xs animate-ping drop-shadow-[0_0_8px_#a855f7]">✦</span>
            <span className="absolute top-1/2 -right-5 text-white text-base animate-pulse drop-shadow-[0_0_12px_#38bdf8]">✨</span>
          </div>
        )}
      </div>
    </div>
  );
}

const CLOUD_PATH = "M65 142 H135 C152 142 165 129 165 112 C165 97 154 85 140 83 C138 66 123 52 105 52 C91 52 79 60 74 72 C71 71 67 70 63 70 C47 70 35 83 35 99 C35 116 48 142 65 142 Z";

