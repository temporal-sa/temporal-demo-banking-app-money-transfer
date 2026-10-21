import { useEffect, useRef, useState, type ReactNode } from 'react'

const PHONE_W = 393
const PHONE_H = 852
const PADDING = 32
const MIN_SCALE = 0.4
const MAX_SCALE = 1

export function PhoneFrame({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.75)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // Fit the phone to whichever dimension of its pane is tighter, so it
    // rescales live as the pane is dragged wider or narrower.
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const s = Math.min((width - PADDING) / PHONE_W, (height - PADDING) / PHONE_H)
      setScale(Math.max(MIN_SCALE, Math.min(s, MAX_SCALE)))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden">
      <div className="relative flex-shrink-0" style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
        <div
          className="absolute top-0 left-0"
          style={{
            width: PHONE_W,
            height: PHONE_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
        <div className="relative w-full h-full">
          {/* Phone body */}
          <div className="absolute inset-0 rounded-[55px] bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1e] shadow-[0_0_0_2px_#3a3a3e,0_20px_60px_rgba(0,0,0,0.6),0_0_0_4px_#1a1a1e]">
            {/* Side buttons */}
            <div className="absolute -left-[2px] top-[140px] w-[3px] h-[30px] bg-[#3a3a3e] rounded-l-sm" />
            <div className="absolute -left-[2px] top-[200px] w-[3px] h-[50px] bg-[#3a3a3e] rounded-l-sm" />
            <div className="absolute -left-[2px] top-[260px] w-[3px] h-[50px] bg-[#3a3a3e] rounded-l-sm" />
            <div className="absolute -right-[2px] top-[210px] w-[3px] h-[70px] bg-[#3a3a3e] rounded-r-sm" />

            {/* Screen bezel */}
            <div className="absolute inset-[10px] rounded-[47px] overflow-hidden bg-black">
              {/* Dynamic Island */}
              <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[120px] h-[34px] bg-black rounded-full z-30 flex items-center justify-center">
                <div className="w-[12px] h-[12px] rounded-full bg-[#1a1a2e] border border-[#2a2a3e] ml-8">
                  <div className="w-[4px] h-[4px] rounded-full bg-[#2a2a4e] m-[3px]" />
                </div>
              </div>

              {/* Screen content */}
              <div className="w-full h-full bg-(--space-black) relative">
                {/* Status bar */}
                <div className="absolute top-0 left-0 right-0 h-[54px] z-20 flex items-end justify-between px-8 pb-1">
                  <span className="text-white text-sm font-semibold drop-shadow-sm">9:41</span>
                  <div className="flex items-center gap-1.5 text-white drop-shadow-sm">
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" className="opacity-90">
                      <rect x="0" y="9" width="3" height="3" rx="0.5"/>
                      <rect x="4.5" y="6" width="3" height="6" rx="0.5"/>
                      <rect x="9" y="3" width="3" height="9" rx="0.5"/>
                      <rect x="13.5" y="0" width="3" height="12" rx="0.5" opacity="0.3"/>
                    </svg>
                    <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor" className="opacity-90">
                      <path d="M7 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM3.05 8.46a5.5 5.5 0 017.9 0l-.7.7a4.5 4.5 0 00-6.5 0l-.7-.7zM.93 6.34a8.5 8.5 0 0112.14 0l-.7.7a7.5 7.5 0 00-10.74 0l-.7-.7z"/>
                    </svg>
                    <div className="flex items-center gap-0.5">
                      <div className="w-[22px] h-[11px] border border-white/70 rounded-[3px] p-[1px]">
                        <div className="w-[70%] h-full bg-white rounded-[1.5px]" />
                      </div>
                      <div className="w-[1.5px] h-[5px] bg-white/50 rounded-r-sm" />
                    </div>
                  </div>
                </div>

                {/* App content */}
                <div className="absolute inset-0 top-0 flex flex-col">
                  <div className="h-[54px] flex-shrink-0 bg-(--space-black)" />
                  <div className="flex-1 overflow-y-auto bg-(--space-black) text-(--off-white)">
                    {children}
                  </div>
                </div>
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[134px] h-[5px] bg-white/60 rounded-full z-30" />
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
