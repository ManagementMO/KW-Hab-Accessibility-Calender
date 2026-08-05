const KEYWORD_ICONS: [RegExp, string][] = [
  [/\bramp\b|\bwheelchair\b|\baccessible\b/, '♿'],
  [/\bstairs?\b|\bsteps?\b/, '🪜'],
  [/\belevator\b|\blift\b/, '🛗'],
  [/\bdoor\b|\bentrance\b|\bentry\b|\bgate\b/, '🚪'],
  [/\bbench\b|\bseat\b|\bchair\b/, '🪑'],
  [/\bsign\b|\bsignage\b/, '🪧'],
  [/\bbus\b|\btransit\b|\bshuttle\b/, '🚌'],
  [/\bpark(ing)?\b/, '🅿️'],
  [/\breception\b|\bdesk\b|\bcheck-?in\b|\btable\b/, '🛎️'],
  [/\bstaff\b|\bgreet\b|\bmeet\b|\bwelcome\b|\bhello\b/, '👋'],
  [/\bquiet\b|\bcalm\b/, '🧘'],
  [/\bwashroom\b|\bbathroom\b|\brestroom\b|\btoilet\b/, '🚻'],
  [/\bwindow\b/, '🪟'],
  [/\bhallway\b|\bcorridor\b/, '🚶'],
  [/\bpath\b|\bwalk\b|\bwalkway\b/, '🚶'],
]

const DEFAULT_ICON = '📍'

export function suggestArrivalIcon(text: string): string {
  const lower = text.toLowerCase()
  for (const [pattern, icon] of KEYWORD_ICONS) {
    if (pattern.test(lower)) return icon
  }
  return DEFAULT_ICON
}
