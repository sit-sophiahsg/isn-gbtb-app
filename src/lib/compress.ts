import imageCompression from 'browser-image-compression'

// Phone photos are 3–8 MB; this brings them to ~300 KB, fixes EXIF rotation,
// and converts HEIC-in-JPEG-clothing quirks into a plain JPEG.
export async function compressPhoto(file: File): Promise<Blob> {
  try {
    return await imageCompression(file, {
      maxSizeMB: 0.4,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.8,
    })
  } catch {
    // Couldn't decode (rare formats). Upload the original if it's small enough.
    if (file.size < 5 * 1024 * 1024) return file
    throw new Error('This photo could not be processed. Try taking it again.')
  }
}
