import { useEffect, useState } from 'react'
import './PreviewShell.css'
import { NewspaperTheme } from './themes/NewspaperTheme'
import { ApothecaryTheme } from './themes/ApothecaryTheme'
import { HealthTheme } from './themes/HealthTheme'
import { SwissTheme } from './themes/SwissTheme'
import { CalendarTheme } from './themes/CalendarTheme'
import { BrutalismTheme } from './themes/BrutalismTheme'

type ThemeId =
  | 'newspaper'
  | 'apothecary'
  | 'health'
  | 'swiss'
  | 'calendar'
  | 'brutalism'

interface ThemeMeta {
  id: ThemeId
  num: string
  ja: string
  en: string
}

const THEMES: ThemeMeta[] = [
  { id: 'newspaper', num: '00', ja: '新聞・編集部', en: 'Newspaper' },
  { id: 'apothecary', num: '01', ja: '柔らかいジャーナル', en: 'Apothecary' },
  { id: 'health', num: '02', ja: '母子手帳的', en: 'Health Pastel' },
  { id: 'swiss', num: '03', ja: '情報設計', en: 'Quiet Swiss' },
  { id: 'calendar', num: '04', ja: 'タイムライン', en: 'Calendar-first' },
  { id: 'brutalism', num: '05', ja: 'ソフト・ブルータル', en: 'Soft Brutalism' },
]

function readHash(): ThemeId {
  const h = (window.location.hash || '').replace('#', '') as ThemeId
  return THEMES.some((t) => t.id === h) ? h : 'newspaper'
}

export function PreviewShell() {
  const [theme, setTheme] = useState<ThemeId>(readHash)

  useEffect(() => {
    const onHash = () => setTheme(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const select = (id: ThemeId) => {
    window.location.hash = id
    setTheme(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  return (
    <div className="preview-shell" data-theme={theme}>
      <div className="preview-bar">
        <div className="preview-bar__brand">
          <span className="preview-bar__dot" />
          design preview · maternity ledger
        </div>
        <ol className="preview-bar__list" aria-label="デザイン案">
          {THEMES.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => select(t.id)}
                className={t.id === theme ? 'is-active' : ''}
                aria-current={t.id === theme ? 'true' : undefined}
              >
                <span className="preview-bar__num">{t.num}</span>
                <span className="preview-bar__en">{t.en}</span>
                <span className="preview-bar__ja">{t.ja}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="preview-bar__caption">
          現在: <strong>{current.en}</strong> ／ {current.ja}
        </div>
      </div>

      <div className="preview-stage">
        {theme === 'newspaper' && <NewspaperTheme />}
        {theme === 'apothecary' && <ApothecaryTheme />}
        {theme === 'health' && <HealthTheme />}
        {theme === 'swiss' && <SwissTheme />}
        {theme === 'calendar' && <CalendarTheme />}
        {theme === 'brutalism' && <BrutalismTheme />}
      </div>
    </div>
  )
}
