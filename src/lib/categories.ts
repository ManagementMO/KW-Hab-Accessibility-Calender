export type CategoryOption = { emoji: string; name: string; filterLabel?: string }

export const CATEGORIES: CategoryOption[] = [
  { emoji: '🎨', name: 'Art' },
  { emoji: '🌳', name: 'Outdoors' },
  { emoji: '🎵', name: 'Music' },
  { emoji: '🍳', name: 'Cooking' },
  { emoji: '🏀', name: 'Sports' },
  { emoji: '🎉', name: 'Social' },
  { emoji: '🧘', name: 'Quiet', filterLabel: 'Quiet activities' },
  { emoji: '🚌', name: 'Trips' },
]
