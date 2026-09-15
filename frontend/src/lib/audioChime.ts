/**
 * audioChime.ts
 * Air-gapped Web Audio API acoustic chime synthesizer.
 * Generates pure harmonic bell chimes entirely in browser memory without external audio assets or network egress.
 */

let sharedAudioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        sharedAudioContext = new AudioCtx()
      }
    }
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {})
    }
    return sharedAudioContext
  } catch (err) {
    console.warn('Web Audio API not supported or blocked:', err)
    return null
  }
}

/**
 * Plays an acoustic chime (harmonic dual-tone bell) for task/sandbox/streaming completion.
 */
export function playCompletionChime(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const primaryFreq = 587.33 // D5
    const harmonicFreq = 880.0 // A5

    // Gain node for smooth envelope
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.0001, now)
    masterGain.gain.exponentialRampToValueAtTime(0.18, now + 0.04)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65)
    masterGain.connect(ctx.destination)

    // Primary Tone
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(primaryFreq, now)
    osc1.connect(masterGain)
    osc1.start(now)
    osc1.stop(now + 0.65)

    // Harmonic Tone
    const osc2 = ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(harmonicFreq, now + 0.05)
    
    const harmGain = ctx.createGain()
    harmGain.gain.setValueAtTime(0.0001, now + 0.05)
    harmGain.gain.exponentialRampToValueAtTime(0.08, now + 0.09)
    harmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
    
    osc2.connect(harmGain)
    harmGain.connect(ctx.destination)

    osc2.start(now + 0.05)
    osc2.stop(now + 0.55)
  } catch (err) {
    console.warn('Failed to play acoustic completion chime:', err)
  }
}

/**
 * Plays a subtle low-frequency confirmation click.
 */
export function playFeedbackClick(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.08)

    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.08)
  } catch (err) {
    console.warn('Failed to play feedback click:', err)
  }
}
