export function createLatestTaskGuard() {
  let version = 0;
  return {
    begin() {
      version += 1;
      return version;
    },
    isCurrent(candidate: number) {
      return candidate === version;
    },
    invalidate() {
      version += 1;
    },
  };
}
