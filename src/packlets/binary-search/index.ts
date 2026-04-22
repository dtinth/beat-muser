/**
 * @packageDocumentation
 *
 * Generic binary search utilities for sorted arrays.
 *
 * These are small, pure functions with no dependencies. They are used by
 * multiple packlets (timing-engine, hit-testing, visible-object queries) so
 * they live in their own packlet to avoid duplication.
 */

/**
 * Returns the index of the first element in `arr` that is >= `x`.
 * Equivalent to Python's `bisect_left`.
 */
export function bisectLeft(arr: number[], x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] < x) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Returns the index of the first element in `arr` that is > `x`.
 * Equivalent to Python's `bisect_right`.
 */
export function bisectRight(arr: number[], x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] <= x) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Returns the index of the first element in `arr` whose extracted key is > `x`.
 * Uses a `getKey` function to extract the comparison key from each element.
 */
export function bisectRightBy<T>(arr: T[], x: number, getKey: (item: T) => number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (getKey(arr[mid]) <= x) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}
