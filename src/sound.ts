import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAudioPlayer, type AudioPlayer } from 'expo-audio'

// The handful of sounds a post office makes: an envelope landing, paper
// sliding, a stamp coming down, and a small bell when money arrives. Each is a
// fraction of a second, they follow the phone's media volume, and they can be
// turned off from the profile.

const sources = {
  chime: require('../assets/sounds/chime.wav'),
  drop: require('../assets/sounds/drop.wav'),
  paper: require('../assets/sounds/paper.wav'),
  thump: require('../assets/sounds/thump.wav'),
  tick: require('../assets/sounds/tick.wav'),
} as const

export type SoundName = keyof typeof sources

const SETTING_KEY = 'penny-post/sounds/v1'
const players: Partial<Record<SoundName, AudioPlayer>> = {}
let isOn = true

void AsyncStorage.getItem(SETTING_KEY)
  .then((stored) => {
    isOn = stored !== 'off'
  })
  .catch(() => undefined)

export function soundsAreOn(): boolean {
  return isOn
}

export function setSounds(on: boolean): void {
  isOn = on
  void AsyncStorage.setItem(SETTING_KEY, on ? 'on' : 'off').catch(() => undefined)
}

/** Plays one sound from the start. A sound that cannot play is never a reason to interrupt anything. */
export function play(name: SoundName, delayMs = 0): void {
  if (!isOn) {
    return
  }
  const start = () => {
    try {
      const player = (players[name] ??= createAudioPlayer(sources[name]))
      void player.seekTo(0)
      player.play()
    } catch {
      // No sound this time.
    }
  }
  if (delayMs > 0) {
    setTimeout(start, delayMs)
  } else {
    start()
  }
}
