/**
 * Speech-to-text interface (docs/DECISIONS.md §13). Native: Capacitor
 * @capacitor-community/speech-recognition; web: Web Speech API; demo: a canned
 * transcript. Never block a post on this — the user can type instead.
 */
export async function transcribe(_audio?: Blob): Promise<string> {
  return 'Stacked blocks for several minutes and counted to eight.';
}
