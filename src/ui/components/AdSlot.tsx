import { useEffect, useRef } from 'react'
import './AdSlot.css'

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined

let scriptInjected = false

function injectAdScript() {
  if (scriptInjected || !CLIENT) return
  scriptInjected = true
  const s = document.createElement('script')
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`
  s.async = true
  s.crossOrigin = 'anonymous'
  document.head.appendChild(s)
}

interface Props {
  slot: string
  format?: 'auto' | 'fluid' | 'rectangle'
  className?: string
}

export function AdSlot({ slot, format = 'auto', className = '' }: Props) {
  const ref = useRef<HTMLModElement>(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (!CLIENT) return
    injectAdScript()
    if (pushed.current) return
    pushed.current = true
    try {
      ;(
        (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle ??= []
      ).push({})
    } catch {
      /* ignore */
    }
  }, [])

  if (!CLIENT) return null

  return (
    <div className={`ad-slot ${className}`.trim()}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  )
}
