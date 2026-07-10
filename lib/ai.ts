export function isAiSummaryConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL);
}

export function getAiSummaryStatus() {
  return isAiSummaryConfigured()
    ? { enabled: true, label: 'AI-generated summary - not evidence.' }
    : { enabled: false, label: 'AI change summaries are not configured.' };
}

