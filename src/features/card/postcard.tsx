import { Image, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { Postmark } from '../../components/postmark'
import { StampArt } from '../../components/stamp-art'
import { cardStock } from '../../theme'
import { WRITING_BOX, type CardContent } from './card'
import { stampById } from './stamps'

// Both sides of a postcard, three wide by two tall. A card is always card
// stock: it looks the same in a dark room as in a light one.

const frame = {
  aspectRatio: 3 / 2,
  backgroundColor: cardStock.face,
  borderColor: cardStock.rule,
  borderRadius: 6,
  borderWidth: 1,
  overflow: 'hidden' as const,
  width: '100%' as const,
}

export function PostcardFront({ photo }: { photo: string | null }) {
  if (photo) {
    return (
      <View style={[frame, { padding: 8 }]}>
        <Image
          accessibilityLabel="The picture side of the card"
          resizeMode="cover"
          source={{ uri: `data:image/jpeg;base64,${photo}` }}
          style={{ borderRadius: 2, flex: 1 }}
        />
      </View>
    )
  }

  // No picture: the plain printed front of an old post card.
  return (
    <View style={[frame, { alignItems: 'center', justifyContent: 'center', padding: 12 }]}>
      <View
        style={{
          alignItems: 'center',
          alignSelf: 'stretch',
          borderColor: cardStock.accent,
          borderWidth: 1.5,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: cardStock.ink, fontFamily: 'Lora_700Bold', fontSize: 26, letterSpacing: 6 }}>
          POST CARD
        </Text>
        <View style={{ backgroundColor: cardStock.accent, height: 1.5, marginVertical: 8, width: 120 }} />
        <Text style={{ color: cardStock.inkSoft, fontFamily: 'Lora_500Medium', fontSize: 12, letterSpacing: 2 }}>
          THE PICTURE GOES ON THIS SIDE
        </Text>
      </View>
    </View>
  )
}

export function PostcardBack({
  card,
  postmark,
  to,
}: {
  card: CardContent
  /** Shown once the card is in the post. */
  postmark?: { date: string; place: string }
  to: string
}) {
  const stamp = stampById(card.stampId)

  return (
    <View style={[frame, { flexDirection: 'row', padding: 12 }]}>
      {/* Message half */}
      <View style={{ flex: 11, paddingRight: 10 }}>
        {card.strokes.length > 0 ? (
          <Svg height="100%" viewBox={`0 0 ${WRITING_BOX.width} ${WRITING_BOX.height}`} width="100%">
            {card.strokes.map((stroke, index) => (
              <Path
                d={stroke}
                fill="none"
                key={index}
                stroke={cardStock.ink}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.4}
              />
            ))}
          </Svg>
        ) : (
          <Text style={{ color: cardStock.ink, fontFamily: 'Caveat_500Medium', fontSize: 20, lineHeight: 23 }}>
            {card.message}
          </Text>
        )}
        {card.fromName ? (
          <Text
            style={{
              bottom: 0,
              color: cardStock.inkSoft,
              fontFamily: 'Lora_500Medium',
              fontSize: 10,
              left: 0,
              letterSpacing: 1,
              position: 'absolute',
            }}
          >
            FROM {card.fromName.toUpperCase()}
          </Text>
        ) : null}
      </View>

      <View style={{ backgroundColor: cardStock.rule, width: 1 }} />

      {/* Address half */}
      <View style={{ flex: 9, paddingLeft: 10 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <StampArt art={stamp.art} backing={cardStock.face} label={stamp.name} size={0.72} />
        </View>
        {postmark ? (
          <View style={{ position: 'absolute', right: 40, top: 6, transform: [{ scale: 0.92 }] }}>
            <Postmark date={postmark.date} place={postmark.place} />
          </View>
        ) : null}
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Text style={{ color: cardStock.inkSoft, fontFamily: 'Lora_500Medium', fontSize: 10, letterSpacing: 1 }}>
            TO
          </Text>
          <Text
            numberOfLines={2}
            style={{ color: cardStock.ink, fontFamily: 'Caveat_500Medium', fontSize: 22, lineHeight: 25 }}
          >
            {to || ' '}
          </Text>
          <View style={{ backgroundColor: cardStock.rule, height: 1, marginTop: 2 }} />
          <View style={{ backgroundColor: cardStock.rule, height: 1, marginTop: 12 }} />
        </View>
      </View>
    </View>
  )
}
