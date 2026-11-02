import { Image } from 'react-native';
import { Asset } from 'expo-asset';
import { startupImages } from './image-assets';
import { createImageCache } from './image-cache';

const cacheImages = createImageCache((uri) => Image.prefetch(uri));

export async function preloadImages() {
  const uris = startupImages.map((source) => typeof Image.resolveAssetSource === 'function'
    ? Image.resolveAssetSource(source)?.uri : Asset.fromModule(source).uri).filter((uri): uri is string => !!uri);
  await cacheImages(uris);
}
