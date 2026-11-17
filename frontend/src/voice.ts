import type { Lang } from './i18n'
import { track } from './track'

let current: HTMLAudioElement | null = null

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
  current?.pause()
  current = null
}

/**
 * Read text aloud. If `clip` is given and a recorded file exists at /audio/<lang>/<clip>.mp3 it is played
 * (reliable Kannada on any phone); otherwise the browser's speech synthesis is used.
 */
export async function speak(text: string, lang: Lang, clip?: string): Promise<void> {
  track('voice_played', { detail: clip || text.slice(0, 30), language: lang })
  stopSpeaking()
  if (clip) {
    try {
      const url = `/audio/${lang}/${clip}.mp3`
      const res = await fetch(url, { method: 'HEAD' }).catch(() => null)
      if (res && res.ok) {
        const ct = res.headers.get('content-type') || ''
        // Avoid SPA 200 text/html fallback
        if (ct.includes('audio') || ct.includes('mpeg') || ct.includes('octet-stream')) {
          const a = new Audio(url)
          current = a
          await a.play()
          return
        }
      }
    } catch {
      /* no recorded clip -> fall through to TTS */
    }
  }
  const synth = window.speechSynthesis
  if (!synth) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang === 'kn' ? 'kn-IN' : 'en-IN'
  const v = synth.getVoices().find((x) => x.lang.toLowerCase().startsWith(lang))
  if (v) u.voice = v
  u.rate = 0.9
  synth.speak(u)
}
