import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Splash() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      const hasOnboarded = localStorage.getItem('boutiklic_onboarding')
      if (hasOnboarded) {
        navigate('/login')
      } else {
        navigate('/onboarding')
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div
      className="h-dvh flex flex-col bg-primary relative overflow-hidden"
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,253,250,.05) 0 3px, transparent 3px 14px), repeating-linear-gradient(-45deg, rgba(255,253,250,.05) 0 3px, transparent 3px 14px)',
      }}
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-7">
        <div className="w-[104px] h-[104px] rounded-[30px] bg-papier flex items-center justify-center shadow-[0_18px_40px_rgba(0,0,0,.25)]">
          <div className="w-11 h-11 rounded-lg border-[6px] border-primary" style={{ borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-display font-extrabold text-[38px] text-papier tracking-tight">BOUTIKLIC</h1>
          <p className="text-[15px] font-semibold text-papier/70">{t('auth.tagline')}</p>
        </div>
      </div>
      <div className="flex-none px-14 pb-14 flex flex-col items-center gap-4">
        <div className="w-full h-[5px] rounded-full bg-papier/20 overflow-hidden">
          <div className="h-full rounded-full bg-warning" style={{ width: '64%' }} />
        </div>
        <p className="text-xs font-semibold text-papier/60 tracking-wide">{t('auth.loadingDataVersion')}</p>
      </div>
    </div>
  )
}
