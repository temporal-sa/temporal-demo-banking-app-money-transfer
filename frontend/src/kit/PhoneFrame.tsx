// PhoneFrame.tsx — a simulated phone, for a demo whose story starts in a hand.
// The tacos and banking demos each carried their own copy of this; it is the same
// frame in both, differing only in the app's accent colour.
//
// The frame is laid out at a real phone's pixel size and scaled to fit its container,
// so the app inside can use ordinary mobile CSS without thinking about the scale.
// Styling comes from the .phone classes in css/temporal-components.css, so this and
// the plain-CSS version stay one implementation.
//
// It fills its container and grows with it, in both directions, until it meets the
// tighter of the two, always keeping MARGIN clear of every edge. In a resizable pane
// that means widening the pane enlarges the phone until it runs out of height. The
// container needs a definite size; a container sized by its content would chase it.
//
// A device frame costs a lot of screen width. Use it when the device is part of the
// story, not as decoration (guide 11, Product experience with a backstage view).
//
//   <PhoneFrame chrome="var(--grad-uv)">
//     <OrderScreen />
//   </PhoneFrame>

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const PHONE_W = 393;  // iPhone 15 logical pixels
const PHONE_H = 852;
const MARGIN = 16;    // kept clear between the phone and each edge of its container

export interface PhoneFrameProps {
  children: ReactNode;
  /** The app's own header colour or gradient, shown as a bar under the status bar. */
  chrome?: string;
  /** The app's background behind the content. */
  background?: string;
  /** The app's text colour. The home indicator is drawn in it too. */
  foreground?: string;
  /** Clock shown in the status bar. */
  time?: string;
}

export function PhoneFrame({
  children,
  chrome = "var(--grad-uv)",
  background = "#f8fafc",
  foreground = "#141414",
  time = "9:41",
}: PhoneFrameProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  // Measured before paint, so the phone never shows at the wrong size first.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const fit = (width: number, height: number) => {
      const s = Math.min((width - MARGIN * 2) / PHONE_W, (height - MARGIN * 2) / PHONE_H);
      setScale(Math.max(0, s));
    };

    fit(stage.clientWidth, stage.clientHeight);
    const observer = new ResizeObserver(([entry]) => fit(entry.contentRect.width, entry.contentRect.height));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // A transform doesn't affect layout, so the wrapper reserves the scaled footprint.
  const fitStyle: CSSProperties = {
    width: PHONE_W * scale,
    height: PHONE_H * scale,
  };

  return (
    <div ref={stageRef} className="phone-stage">
      <div className="phone-fit" style={fitStyle}>
        <div
          className="phone"
          style={{
            "--phone-scale": scale,
            "--phone-chrome": chrome,
            "--phone-bg": background,
            "--phone-fg": foreground,
          } as CSSProperties}
        >
          <div className="phone-screen">
            {/* Decorative: the real state is in the app content below. */}
            <div className="phone-statusbar" aria-hidden="true">
              <span>{time}</span>
              <span className="phone-indicators">
                <SignalIcon />
                <WifiIcon />
                <BatteryIcon />
              </span>
            </div>
            <header className="phone-chrome" aria-hidden="true" />
            <div className="phone-content">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" opacity=".9">
      <rect x="0" y="9" width="3" height="3" rx=".5" />
      <rect x="4.5" y="6" width="3" height="6" rx=".5" />
      <rect x="9" y="3" width="3" height="9" rx=".5" />
      <rect x="13.5" y="0" width="3" height="12" rx=".5" opacity=".3" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor" opacity=".9">
      <path d="M7 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM3.05 8.46a5.5 5.5 0 017.9 0l-.7.7a4.5 4.5 0 00-6.5 0l-.7-.7zM.93 6.34a8.5 8.5 0 0112.14 0l-.7.7a7.5 7.5 0 00-10.74 0l-.7-.7z" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
      <rect x=".5" y=".5" width="22" height="11" rx="3" stroke="currentColor" opacity=".7" />
      <rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor" />
      <rect x="24" y="4" width="1.5" height="5" rx=".75" fill="currentColor" opacity=".5" />
    </svg>
  );
}
