/** User-facing phrase for how many prompts GPT is generating (matches env min/max). */
export function formatSessionQuestionCountRange(min: number, max: number): string {
  if (min === max) {
    return min === 1 ? "one spoken prompt" : `${min} spoken prompts`;
  }
  return `between ${min} and ${max} spoken prompts`;
}
