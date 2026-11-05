export function linearFit(points: readonly { x: number; y: number }[], minimumPoints = 5) {
  if (!Number.isInteger(minimumPoints) || minimumPoints < 2 || points.length < minimumPoints || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y)) || new Set(points.map(point => point.x)).size < minimumPoints) return null;
  const n = points.length, xMean = points.reduce((sum, point) => sum + point.x / n, 0), yMean = points.reduce((sum, point) => sum + point.y / n, 0);
  const xx = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0), xy = points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0);
  if (!(xx > 0) || !Number.isFinite(xx) || !Number.isFinite(xy)) return null;
  const slope = xy / xx, intercept = yMean - slope * xMean;
  const residual = points.reduce((sum, point) => sum + (point.y - slope * point.x - intercept) ** 2, 0), total = points.reduce((sum, point) => sum + (point.y - yMean) ** 2, 0);
  const rSquared = total > 0 ? 1 - residual / total : residual === 0 ? 1 : 0;
  return [slope, intercept, rSquared].every(Number.isFinite) ? { slope, intercept, rSquared, count: n, distinct: new Set(points.map(point => point.x)).size } : null;
}
