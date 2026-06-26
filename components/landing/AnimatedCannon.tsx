import React from 'react'

interface AnimatedCannonProps {
  angleDeg: number
  recoilKey: number
  disabled?: boolean
  isFlying?: boolean
  onFire: () => void
}

/**
 * A hand-authored 2D carnival cannon for the glass landing page.
 *
 * The parent owns aim, projectile flight, and impact logic. This component keeps
 * the cannon itself purely presentational: layered CSS/SVG-like shapes, a
 * carefully timed recoil, muzzle flash, smoke, and a focus-only fire control.
 */
export default function AnimatedCannon({
  angleDeg,
  recoilKey,
  disabled,
  isFlying,
  onFire,
}: AnimatedCannonProps) {
  return (
    <>
      <div
        className={`landing-cannon-shell${isFlying ? ' is-firing' : ''}`}
        aria-hidden="true"
      >
        <div className="landing-cannon-shadow" />

        <div className="landing-cannon-back-wheel landing-cannon-wheel">
          <span />
          <span />
          <span />
        </div>
        <div className="landing-cannon-front-wheel landing-cannon-wheel">
          <span />
          <span />
          <span />
        </div>

        <div className="landing-cannon-carriage">
          <div className="landing-cannon-carriage-rail" />
          <div className="landing-cannon-carriage-rivet rivet-left" />
          <div className="landing-cannon-carriage-rivet rivet-right" />
        </div>

        <div
          key={`barrel-${recoilKey}`}
          className="landing-cannon-barrel-rig"
          style={{ transform: `translateX(-22px) rotate(${angleDeg}deg)` }}
        >
          <div className="landing-cannon-barrel-glow" />
          <div className="landing-cannon-barrel">
            <div className="landing-cannon-barrel-highlight" />
            <div className="landing-cannon-barrel-band band-one" />
            <div className="landing-cannon-barrel-band band-two" />
            <div className="landing-cannon-barrel-mouth">
              <div className="landing-cannon-bore" />
            </div>
          </div>

          <div className="landing-cannon-fuse">
            <span />
          </div>

          {isFlying && (
            <div key={`blast-${recoilKey}`} className="landing-cannon-blast">
              <div className="landing-cannon-flash flash-core" />
              <div className="landing-cannon-flash flash-ring" />
              <div className="landing-cannon-smoke smoke-one" />
              <div className="landing-cannon-smoke smoke-two" />
              <div className="landing-cannon-smoke smoke-three" />
              <div className="landing-cannon-spark spark-one" />
              <div className="landing-cannon-spark spark-two" />
              <div className="landing-cannon-spark spark-three" />
            </div>
          )}
        </div>
      </div>

      <button
        className="cannon-accessible-fire"
        data-cannon-control="true"
        type="button"
        disabled={disabled || isFlying}
        aria-label="Fire the cannon"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onFire()
        }}
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -32,
        }}
      >
        Fire cannon
      </button>

      <style>{`
        .landing-cannon-shell {
          position: absolute;
          inset: 0;
          transform-origin: 50% 74%;
          animation: landingCannonIdle 3.4s ease-in-out infinite;
          filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.42));
        }

        .landing-cannon-shell.is-firing {
          animation: landingCannonFireBody 0.42s cubic-bezier(0.2, 0.9, 0.2, 1),
            landingCannonIdle 3.4s ease-in-out 0.42s infinite;
        }

        .landing-cannon-shadow {
          position: absolute;
          left: 50%;
          bottom: 3px;
          width: 176px;
          height: 24px;
          border-radius: 999px;
          background: radial-gradient(ellipse, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0));
          transform: translateX(-50%);
          filter: blur(2px);
        }

        .landing-cannon-carriage {
          position: absolute;
          left: 50%;
          bottom: 20px;
          width: 164px;
          height: 42px;
          border: 2px solid rgba(255, 233, 154, 0.62);
          border-radius: 48% 48% 18px 18px;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.16), transparent 28%, rgba(0,0,0,0.22) 78%),
            linear-gradient(180deg, #ffd867 0%, #c85f19 38%, #742808 78%, #2a0d03 100%);
          box-shadow:
            inset 0 9px 15px rgba(255, 255, 255, 0.22),
            inset 0 -10px 16px rgba(0, 0, 0, 0.34),
            0 12px 24px rgba(0, 0, 0, 0.36),
            0 0 26px rgba(255, 126, 35, 0.18);
          transform: translateX(-50%);
        }

        .landing-cannon-carriage-rail {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 7px;
          height: 7px;
          border-radius: 999px;
          background: linear-gradient(90deg, #3b1708, #ffe08d 18%, #5f250b 72%, #180701);
          opacity: 0.88;
        }

        .landing-cannon-carriage-rivet {
          position: absolute;
          top: 13px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 28%, #fff1bd, #b84b17 55%, #2a0d03 100%);
          box-shadow: 0 0 8px rgba(255, 210, 92, 0.32);
        }

        .landing-cannon-carriage-rivet.rivet-left { left: 30px; }
        .landing-cannon-carriage-rivet.rivet-right { right: 30px; }

        .landing-cannon-wheel {
          position: absolute;
          bottom: 0;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 4px solid rgba(255, 215, 106, 0.82);
          background:
            radial-gradient(circle at center, #401405 0 18%, transparent 19%),
            conic-gradient(from 12deg, #270b02, #9d3b10, #ffd56a, #7d2c09, #220802, #9d3b10, #270b02);
          box-shadow:
            inset 0 0 0 7px rgba(57, 18, 5, 0.86),
            inset 0 0 0 10px rgba(255, 214, 100, 0.18),
            0 8px 16px rgba(0, 0, 0, 0.38);
        }

        .landing-cannon-wheel span {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 4px;
          height: 36px;
          border-radius: 999px;
          background: rgba(255, 232, 153, 0.48);
          transform-origin: 50% 50%;
        }

        .landing-cannon-wheel span:nth-child(1) { transform: translate(-50%, -50%) rotate(0deg); }
        .landing-cannon-wheel span:nth-child(2) { transform: translate(-50%, -50%) rotate(60deg); }
        .landing-cannon-wheel span:nth-child(3) { transform: translate(-50%, -50%) rotate(120deg); }

        .landing-cannon-back-wheel { left: 30px; }
        .landing-cannon-front-wheel { right: 28px; }

        .landing-cannon-barrel-rig {
          position: absolute;
          left: 50%;
          bottom: 52px;
          width: 152px;
          height: 46px;
          transform-origin: 22px 50%;
          animation: landingCannonRecoil 0.34s cubic-bezier(0.2, 0.85, 0.22, 1);
        }

        .landing-cannon-barrel-glow {
          position: absolute;
          inset: -12px -14px -12px -6px;
          border-radius: 999px;
          background: radial-gradient(ellipse at 78% 50%, rgba(255, 118, 33, 0.34), rgba(255, 216, 92, 0.12) 38%, transparent 68%);
          opacity: 0.72;
          filter: blur(8px);
          animation: landingCannonGlow 2.4s ease-in-out infinite;
        }

        .landing-cannon-barrel {
          position: absolute;
          inset: 3px 4px 3px 0;
          border: 2px solid rgba(255, 235, 159, 0.82);
          border-radius: 28px 46px 46px 28px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.34), transparent 23%, rgba(0,0,0,0.24) 78%),
            linear-gradient(90deg, #6c1d10 0%, #e74f24 22%, #ffbf4c 48%, #a93616 74%, #401005 100%);
          box-shadow:
            inset 12px 8px 18px rgba(255, 255, 255, 0.25),
            inset -14px -9px 14px rgba(0, 0, 0, 0.38),
            0 0 22px rgba(255, 96, 32, 0.33);
        }

        .landing-cannon-barrel-highlight {
          position: absolute;
          left: 18px;
          right: 38px;
          top: 7px;
          height: 7px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,255,255,0.72), rgba(255,255,255,0.04));
          opacity: 0.62;
        }

        .landing-cannon-barrel-band {
          position: absolute;
          top: -5px;
          bottom: -5px;
          width: 10px;
          border-radius: 999px;
          background: linear-gradient(180deg, #fff0a8, #9b3b14 54%, #331006);
          border: 1px solid rgba(255, 234, 160, 0.42);
          box-shadow: inset -2px -3px 4px rgba(0, 0, 0, 0.28);
        }

        .landing-cannon-barrel-band.band-one { left: 38px; }
        .landing-cannon-barrel-band.band-two { right: 32px; }

        .landing-cannon-barrel-mouth {
          position: absolute;
          right: -9px;
          top: -5px;
          width: 33px;
          height: 52px;
          border-radius: 50%;
          border: 2px solid rgba(255, 232, 153, 0.9);
          background: radial-gradient(circle at 34% 35%, #fff0a8, #cf451d 44%, #5b1708 64%, #160402 100%);
          box-shadow: 0 0 20px rgba(255, 116, 48, 0.42), inset -8px -7px 10px rgba(0,0,0,0.42);
        }

        .landing-cannon-bore {
          position: absolute;
          left: 7px;
          top: 11px;
          width: 17px;
          height: 28px;
          border-radius: 50%;
          background: radial-gradient(circle at 42% 44%, #050101, #1e0703 52%, #ffbd57 76%, #fff1b2 100%);
          box-shadow: inset 0 0 9px rgba(0,0,0,0.88);
        }

        .landing-cannon-fuse {
          position: absolute;
          left: 13px;
          top: -14px;
          width: 42px;
          height: 26px;
          border-top: 3px dashed rgba(255, 219, 119, 0.78);
          border-radius: 50% 0 0 0;
          transform: rotate(-18deg);
        }

        .landing-cannon-fuse span {
          position: absolute;
          left: -4px;
          top: -8px;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: radial-gradient(circle, #fff9d6, #ffd44a 38%, #ff5a22 66%, transparent 70%);
          box-shadow: 0 0 14px rgba(255, 187, 64, 0.9);
          animation: landingCannonFuseSpark 0.9s ease-in-out infinite;
        }

        .landing-cannon-blast {
          position: absolute;
          right: -52px;
          top: 50%;
          width: 94px;
          height: 94px;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .landing-cannon-flash,
        .landing-cannon-smoke,
        .landing-cannon-spark {
          position: absolute;
          pointer-events: none;
        }

        .landing-cannon-flash.flash-core {
          left: 0;
          top: 30px;
          width: 64px;
          height: 32px;
          clip-path: polygon(0 50%, 26% 0, 42% 33%, 100% 50%, 42% 67%, 26% 100%);
          background: linear-gradient(90deg, #fff9d5, #ffd95f 28%, #ff6c2b 62%, rgba(255, 108, 43, 0));
          filter: drop-shadow(0 0 16px rgba(255, 132, 44, 0.88));
          animation: landingCannonFlash 0.34s ease-out forwards;
        }

        .landing-cannon-flash.flash-ring {
          left: -4px;
          top: 20px;
          width: 52px;
          height: 52px;
          border: 2px solid rgba(255, 232, 142, 0.85);
          border-radius: 50%;
          animation: landingCannonRing 0.38s ease-out forwards;
        }

        .landing-cannon-smoke {
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 232, 185, 0.46), rgba(150, 83, 48, 0.18) 55%, rgba(0,0,0,0));
          filter: blur(1px);
          animation: landingCannonSmoke 0.62s ease-out forwards;
        }

        .landing-cannon-smoke.smoke-one { left: 20px; top: 9px; width: 34px; height: 34px; }
        .landing-cannon-smoke.smoke-two { left: 44px; top: 28px; width: 42px; height: 42px; animation-delay: 0.04s; }
        .landing-cannon-smoke.smoke-three { left: 16px; top: 52px; width: 29px; height: 29px; animation-delay: 0.08s; }

        .landing-cannon-spark {
          width: 4px;
          height: 18px;
          border-radius: 999px;
          background: linear-gradient(180deg, #fff8ca, #ff7b25 70%, transparent);
          transform-origin: 50% 100%;
          animation: landingCannonSpark 0.45s ease-out forwards;
        }

        .landing-cannon-spark.spark-one { left: 44px; top: 14px; transform: rotate(38deg); }
        .landing-cannon-spark.spark-two { left: 57px; top: 40px; transform: rotate(84deg); animation-delay: 0.03s; }
        .landing-cannon-spark.spark-three { left: 34px; top: 65px; transform: rotate(132deg); animation-delay: 0.05s; }

        .cannon-accessible-fire {
          width: 1px;
          height: 1px;
          padding: 0;
          border: 0;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
          transform: translateX(-50%);
        }

        .cannon-accessible-fire:focus-visible {
          width: auto;
          height: auto;
          min-width: 128px;
          padding: 8px 14px;
          border: 1px solid rgba(255, 232, 153, 0.72);
          border-radius: 999px;
          clip: auto;
          overflow: visible;
          background: rgba(5, 8, 16, 0.9);
          color: #ffe28a;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          box-shadow: 0 0 0 3px rgba(255, 216, 92, 0.24), 0 10px 24px rgba(0, 0, 0, 0.36);
        }

        @keyframes landingCannonIdle {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -3px; }
        }

        @keyframes landingCannonFireBody {
          0% { translate: 0 0; rotate: 0deg; }
          30% { translate: -3px 5px; rotate: -1deg; }
          62% { translate: 2px -2px; rotate: 0.6deg; }
          100% { translate: 0 0; rotate: 0deg; }
        }

        @keyframes landingCannonRecoil {
          0% { translate: 0 0; filter: brightness(1.55) saturate(1.15); }
          38% { translate: -18px 2px; filter: brightness(1.25) saturate(1.05); }
          72% { translate: 4px -1px; filter: brightness(1.08); }
          100% { translate: 0 0; filter: brightness(1); }
        }

        @keyframes landingCannonGlow {
          0%, 100% { opacity: 0.48; scale: 0.96; }
          50% { opacity: 0.78; scale: 1.04; }
        }

        @keyframes landingCannonFuseSpark {
          0%, 100% { opacity: 0.7; scale: 0.82; }
          50% { opacity: 1; scale: 1.22; }
        }

        @keyframes landingCannonFlash {
          0% { opacity: 0; scale: 0.3; translate: -14px 0; }
          18% { opacity: 1; scale: 1.12; translate: 0 0; }
          100% { opacity: 0; scale: 1.45; translate: 26px 0; }
        }

        @keyframes landingCannonRing {
          0% { opacity: 0.85; scale: 0.45; }
          100% { opacity: 0; scale: 1.65; }
        }

        @keyframes landingCannonSmoke {
          0% { opacity: 0; scale: 0.35; translate: 0 0; }
          26% { opacity: 0.74; }
          100% { opacity: 0; scale: 1.6; translate: 24px -9px; }
        }

        @keyframes landingCannonSpark {
          0% { opacity: 1; scale: 0.55; translate: 0 0; }
          100% { opacity: 0; scale: 1; translate: 24px -22px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-cannon-shell,
          .landing-cannon-shell.is-firing,
          .landing-cannon-barrel-rig,
          .landing-cannon-barrel-glow,
          .landing-cannon-fuse span,
          .landing-cannon-flash,
          .landing-cannon-smoke,
          .landing-cannon-spark {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </>
  )
}
