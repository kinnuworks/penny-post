import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

/** The picture side is stored at this width. A postcard is 3 wide by 2 tall. */
const PHOTO_WIDTH = 900

export type PhotoSource = 'camera' | 'library'

/**
 * Lets the writer take or choose a picture, crops it to a postcard's shape and
 * shrinks it so a card stays small. Returns base64 JPEG, or null if they
 * backed out or said no to the camera.
 */
export async function pickPhoto(source: PhotoSource): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    allowsEditing: true,
    aspect: [3, 2],
    mediaTypes: ['images'],
    quality: 0.8,
  }

  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      return null
    }
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options)

  if (result.canceled || result.assets.length === 0) {
    return null
  }

  const image = await ImageManipulator.manipulate(result.assets[0].uri).resize({ width: PHOTO_WIDTH }).renderAsync()
  const saved = await image.saveAsync({ base64: true, compress: 0.6, format: SaveFormat.JPEG })
  return saved.base64 ?? null
}
