export function eventImageSrc(image: string): string {
  return image.trim() ? image : '/event-placeholder.svg'
}
