import { Text, View } from 'react-native'
import { InkButton } from '../../components/ink-button'
import { Postmark } from '../../components/postmark'
import { copy } from '../../copy'
import { postmarkDate } from '../../utils/postmark-date'
import { useNow } from '../../utils/use-now'

export function WelcomeScreen({
  error,
  isBusy,
  onConnect,
}: {
  error: string | null
  isBusy: boolean
  onConnect: () => void
}) {
  const now = useNow()

  return (
    <View className="flex-1 justify-between px-6 pb-8 pt-10">
      <View>
        <View className="mb-10 flex-row items-start justify-between">
          <Text className="font-display text-display text-ink">{copy.appName}</Text>
          <Postmark place="First day" date={postmarkDate(now)} />
        </View>
        <Text className="mb-4 font-title text-title text-ink">{copy.welcome.title}</Text>
        <Text className="font-body text-body text-ink-soft">{copy.welcome.body}</Text>
      </View>

      <View>
        {error ? <Text className="mb-3 font-body text-body text-accent-ink">{error}</Text> : null}
        <InkButton
          disabled={isBusy}
          label={isBusy ? copy.welcome.connecting : copy.welcome.connect}
          onPress={onConnect}
        />
        <Text className="mt-4 text-center font-caption text-caption text-ink-faint">{copy.tagline}</Text>
      </View>
    </View>
  )
}
