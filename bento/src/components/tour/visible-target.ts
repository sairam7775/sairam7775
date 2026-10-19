export function firstVisibleTarget<T>(
  targets: readonly T[],
  sizeOf: (target: T) => { width: number; height: number },
): T | null {
  return targets.find((target) => {
    const { width, height } = sizeOf(target);
    return width > 0 && height > 0;
  }) ?? null;
}
