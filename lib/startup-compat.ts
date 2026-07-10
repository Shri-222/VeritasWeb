export function rowsOrEmpty<T>(
  rows: T[] | null | undefined
): T[] {
  return rows ?? [];
}

export function emptyNotificationConfiguration() {
  return {
    endpoints: [],
    settings: null,
    emailAvailable: false,
  };
}

