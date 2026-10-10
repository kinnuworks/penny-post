import * as Notifications from 'expo-notifications'
import { copy } from '../../copy'
import { nextDelivery } from './delivery'

// The bell that rings when the post comes, at eight each morning.
//
// Notifications are set on the phone itself, a week of mornings at a time,
// whenever the app is open. There is no push server to run or to trust. If the
// app is not opened for a week the bell goes quiet, which is the polite thing
// for it to do.

const SECONDS_PER_DAY = 86_400
const MORNINGS_AHEAD = 7
const CHANNEL = 'morning-post'

export interface Morning {
  /** Unix seconds: 08:00 on this phone's clock. */
  at: number
  /** Cards known to be arriving with this morning's post. */
  cards: number
}

/**
 * The next week of mornings, with how many known cards arrive on each.
 * `arrivals` are the delivery times of cards already in the post.
 */
export function planMornings(now: number, utcOffsetMinutes: number, arrivals: number[]): Morning[] {
  const first = nextDelivery(now, utcOffsetMinutes)
  return Array.from({ length: MORNINGS_AHEAD }, (_, day) => {
    const at = first + day * SECONDS_PER_DAY
    return { at, cards: arrivals.filter((arrival) => arrival > at - SECONDS_PER_DAY && arrival <= at).length }
  })
}

/** What the bell says: the count if there is post, a plain nudge if nothing is known. */
export function bellFor(morning: Morning): { body: string; title: string } {
  return morning.cards > 0
    ? { body: copy.notification.body(morning.cards), title: copy.notification.title }
    : { body: copy.notification.quietBody, title: copy.notification.quietTitle }
}

/** Asks, once, whether the bell may ring. Returns whether it may. */
export async function askToRing(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) {
    return true
  }
  if (!current.canAskAgain) {
    return false
  }
  return (await Notifications.requestPermissionsAsync()).granted
}

/**
 * Clears the bells already set and sets the coming week's. Does nothing if
 * the reader has not allowed notifications. Safe to call often.
 */
export async function setMorningBells(now: number, utcOffsetMinutes: number, arrivals: number[]): Promise<void> {
  if (!(await Notifications.getPermissionsAsync()).granted) {
    return
  }
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    importance: Notifications.AndroidImportance.DEFAULT,
    name: copy.notification.channel,
  })
  await Notifications.cancelAllScheduledNotificationsAsync()

  for (const morning of planMornings(now, utcOffsetMinutes, arrivals)) {
    await Notifications.scheduleNotificationAsync({
      content: bellFor(morning),
      trigger: {
        channelId: CHANNEL,
        date: new Date(morning.at * 1000),
        type: Notifications.SchedulableTriggerInputTypes.DATE,
      },
    })
  }
}
