import { useQuery } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { useRouter } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { InkButton } from '../../components/ink-button'
import { Paper } from '../../components/paper'
import { TabBar } from '../../components/tab-bar'
import { copy } from '../../copy'
import { usePalette } from '../../theme'
import { describeProblem } from '../../utils/describe-problem'
import { describeWalletError } from '../../utils/describe-wallet-error'
import { ellipsify } from '../../utils/ellipsify'
import { formatTokens, groupThousands } from '../../utils/format-tokens'
import { useNow } from '../../utils/use-now'
import { listKept } from '../kept/kept-store'
import { PriceDesk } from '../letterbox/price-desk'
import { hasFreeStamp } from '../post/chain'
import { tokenName } from '../post/token-name'
import { useMyLetterbox, usePostOffice, useSkrName, useVerifyLetterbox } from '../post/use-post'

const badge = require('../../../assets/avatar.jpg')

// Who this letterbox belongs to, what it has earned, and its few settings.
export function ProfileScreen() {
  const router = useRouter()
  const now = useNow()
  const { account, chain, disconnect } = useMobileWallet()
  const owner = account?.address
  const office = usePostOffice()
  const mine = useMyLetterbox()
  const verify = useVerifyLetterbox()
  const name = useSkrName(owner)
  const kept = useQuery({
    enabled: !!owner,
    queryKey: ['kept', owner],
    queryFn: () => (owner ? listKept(owner) : []),
  })
  const [isPricing, setIsPricing] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const token = office.data ? tokenName(office.data.postageMint) : ''
  const decimals = office.data?.decimals ?? 0
  const letterbox = mine.data?.letterbox ?? null
  const seal = mine.data?.seal ?? null
  const earned = (kept.data ?? []).reduce((total, entry) => total + BigInt(entry.paid), 0n)

  async function leave() {
    setLeaveError(null)
    try {
      await disconnect()
      router.dismissTo('/')
    } catch (error) {
      setLeaveError(describeWalletError(error))
    }
  }

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-10 pt-8">
        <View className="mb-6 flex-row items-center gap-4">
          <Image
            accessibilityElementsHidden
            importantForAccessibility="no"
            source={badge}
            style={{ borderRadius: 38, height: 76, width: 76 }}
          />
          <View className="flex-1">
            <Text className="font-display text-title text-ink" numberOfLines={1}>
              {name.data ?? copy.profile.noName}
            </Text>
            <Text className="font-caption text-caption text-ink-soft" selectable>
              {owner ? ellipsify(owner, 6) : ''}
            </Text>
          </View>
        </View>

        <View className="mb-5 flex-row gap-3">
          <Figure label={copy.profile.kept} value={String(kept.data?.length ?? 0)} />
          <Figure label={copy.profile.earned} value={`${formatTokens(earned, decimals)} ${token}`} />
        </View>

        {letterbox && office.data && isPricing ? (
          <Paper className="mb-5 px-5 py-5">
            <PriceDesk
              burnBps={office.data.burnBps}
              current={letterbox.price}
              decimals={decimals}
              floor={office.data.floorPrice}
              onDone={() => setIsPricing(false)}
              token={token}
            />
          </Paper>
        ) : null}

        <Paper>
          {letterbox ? (
            <Row
              label={copy.profile.priceRow}
              onPress={() => setIsPricing((current) => !current)}
              value={`${formatTokens(letterbox.price, decimals)} ${token}`}
            />
          ) : null}
          <Row
            label={copy.profile.seeker}
            onPress={seal || !letterbox || verify.isPending ? undefined : () => verify.mutate()}
            value={
              seal
                ? `No. ${groupThousands(seal.memberNumber)}`
                : verify.isPending
                  ? copy.question.looking
                  : letterbox
                    ? copy.question.iHaveSeeker
                    : '—'
            }
          />
          {seal ? (
            <Row
              label={copy.profile.stamp}
              value={hasFreeStamp(seal, now) ? copy.profile.stampReady : copy.profile.stampUsed}
            />
          ) : null}
          <Row label={copy.profile.bell} value={copy.profile.bellAt} />
          <Row label={copy.profile.network} value={chain.replace('solana:', '')} />
          <Row label={copy.profile.ask} onPress={() => router.push('/ask')} />
          <Row isLast label={copy.wallet.leave} onPress={() => void leave()} />
        </Paper>
        {verify.error ? (
          <Text className="mt-3 font-body text-body text-accent-ink">{describeProblem(verify.error)}</Text>
        ) : null}
        {leaveError ? <Text className="mt-3 font-body text-body text-accent-ink">{leaveError}</Text> : null}

        {!letterbox && !mine.isLoading ? (
          <View className="mt-5">
            <InkButton label={copy.letterbox.putUp} onPress={() => router.dismissTo('/')} tone="plain" />
          </View>
        ) : null}
      </ScrollView>
      <TabBar current="profile" />
    </View>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Paper className="flex-1 px-5 py-4">
      <Text className="font-caption text-caption text-ink-soft">{label}</Text>
      <Text adjustsFontSizeToFit className="mt-1 font-display text-title text-ink" numberOfLines={1}>
        {value}
      </Text>
    </Paper>
  )
}

function Row({
  isLast = false,
  label,
  onPress,
  value,
}: {
  isLast?: boolean
  label: string
  onPress?: () => void
  value?: ReactNode
}) {
  const palette = usePalette()
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      className={`min-h-[56px] flex-row items-center justify-between px-5 ${isLast ? '' : 'border-b border-rule'} ${onPress ? 'active:bg-paper-sunk' : ''}`}
      disabled={!onPress}
      onPress={onPress}
    >
      <Text className="font-caption text-[16px] text-ink">{label}</Text>
      <View className="flex-row items-center gap-2">
        {value ? <Text className="font-caption text-[15px] text-ink-soft">{value}</Text> : null}
        {onPress ? (
          <Svg height={16} viewBox="0 0 16 16" width={16}>
            <Path
              d="M6 3l5 5-5 5"
              fill="none"
              stroke={palette.inkFaint}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.6}
            />
          </Svg>
        ) : null}
      </View>
    </Pressable>
  )
}
