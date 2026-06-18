// Time-aware greeting with random rotation within each time bucket. Pure:
// inject `now` and `rng` in tests.

export function pickGreeting(
  name: string,
  now: Date = new Date(),
  rng: () => number = Math.random,
): string {
  const h = now.getHours()
  let options: string[]
  if (h >= 5 && h < 12) options = [`Morning, ${name}`, `Rise and grind, ${name}`]
  else if (h >= 12 && h < 17) options = [`Afternoon, ${name}`, `Hey, ${name}`]
  else if (h >= 17 && h < 21) options = [`Evening, ${name}`]
  else options = [`Up late, ${name}?`, `Burning the midnight oil, ${name}`]

  const i = Math.min(options.length - 1, Math.max(0, Math.floor(rng() * options.length)))
  return options[i]!
}
