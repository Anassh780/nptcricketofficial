export async function optimizeUploadedImage(
  file: File,
  maxSize = 420,
  quality = 0.78,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.")
  if (file.size > 10 * 1024 * 1024) throw new Error("Image must be under 10 MB.")

  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = source
    await image.decode()
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Image processing is unavailable.")
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/webp", quality)
  } finally {
    URL.revokeObjectURL(source)
  }
}
