/**
 * 算法单元测试（独立 Node 脚本）。
 * 项目未集成 vitest/jest，使用纯 node 直接运行验证核心算法正确性。
 *
 * 运行方式：
 *   cd frontend && node tests/redistributeWeights.test.mjs
 */

const WEIGHT_UNIT = 0.05
const TOTAL_UNITS = 20
const MIN_UNITS = 1
const MAX_UNITS = 16

function allocateUnitsProportionally(existingWeights, budget, minU = MIN_UNITS, maxU = MAX_UNITS) {
  const n = existingWeights.length
  if (n === 0) return budget === 0 ? [] : null
  if (!Number.isFinite(budget) || budget < n * minU || budget > n * maxU) return null

  const existingTotal = existingWeights.reduce((s, w) => s + (Number.isFinite(w) ? w : 0), 0)

  let allocations
  if (existingTotal > 0) {
    allocations = existingWeights.map((w) => (budget * w) / existingTotal)
  } else {
    allocations = new Array(n).fill(budget / n)
  }

  const pinned = new Array(n).fill(false)
  for (let iter = 0; iter < n + 5; iter++) {
    let clipped = false
    for (let i = 0; i < n; i++) {
      if (pinned[i]) continue
      if (allocations[i] < minU) {
        allocations[i] = minU
        pinned[i] = true
        clipped = true
      } else if (allocations[i] > maxU) {
        allocations[i] = maxU
        pinned[i] = true
        clipped = true
      }
    }
    if (!clipped) break

    let pinnedSum = 0
    let freeSum = 0
    for (let i = 0; i < n; i++) {
      if (pinned[i]) pinnedSum += allocations[i]
      else freeSum += allocations[i]
    }
    const free = allocations.map((_, i) => i).filter((i) => !pinned[i])
    if (free.length === 0) {
      return pinnedSum === budget ? allocations.slice() : null
    }
    const freeBudget = budget - pinnedSum
    if (freeBudget < 0) return null
    if (freeSum > 0) {
      const scale = freeBudget / freeSum
      for (const i of free) {
        allocations[i] *= scale
      }
    } else if (freeBudget === 0) {
      return null
    }
  }

  const floorAlloc = allocations.map((a) => Math.floor(a))
  const fractions = allocations.map((a, i) => a - floorAlloc[i])
  let remainder = budget - floorAlloc.reduce((s, a) => s + a, 0)

  const order = fractions
    .map((f, i) => ({ f, i }))
    .sort((a, b) => b.f - a.f || a.i - b.i)
    .map((x) => x.i)

  for (const i of order) {
    if (remainder <= 0) break
    if (floorAlloc[i] + 1 <= maxU) {
      floorAlloc[i] += 1
      remainder -= 1
    }
  }

  if (remainder > 0) {
    for (const i of order) {
      if (remainder <= 0) break
      if (floorAlloc[i] < maxU) {
        floorAlloc[i] += 1
        remainder -= 1
      }
    }
  }

  const intAlloc = floorAlloc
  if (remainder !== 0) return null
  if (intAlloc.some((a) => a < minU || a > maxU)) return null

  return intAlloc
}

function computeMaxNewFactorWeight(existingFactorCount) {
  if (existingFactorCount <= 0) return 0.8
  return Math.min(0.8, 1 - existingFactorCount * 0.05)
}

function redistributeExistingWeightsForNewFactor(existingWeights, newFactorWeight) {
  if (!Number.isFinite(newFactorWeight)) return null
  const newUnits = Math.max(MIN_UNITS, Math.min(MAX_UNITS, Math.round(newFactorWeight / WEIGHT_UNIT)))
  const newFactorWeightSnapped = Math.round(newUnits * WEIGHT_UNIT * 1000) / 1000
  const budget = TOTAL_UNITS - newUnits
  if (budget < 0) return null

  if (existingWeights.length === 0) {
    return { existing: [], newFactorWeight: newFactorWeightSnapped }
  }

  const allocations = allocateUnitsProportionally(existingWeights, budget)
  if (!allocations) return null

  return {
    existing: allocations.map((u) => Math.round(u * WEIGHT_UNIT * 1000) / 1000),
    newFactorWeight: newFactorWeightSnapped,
  }
}

// ── 校验工具 ──────────────────────────────────────────────────
let passed = 0
let failed = 0

function assertEq(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    passed++
  } else {
    failed++
    console.error(`  ❌ ${msg}`)
    console.error(`     expected: ${JSON.stringify(expected)}`)
    console.error(`     actual:   ${JSON.stringify(actual)}`)
  }
}

function assertTrue(cond, msg) {
  if (cond) passed++
  else {
    failed++
    console.error(`  ❌ ${msg}`)
  }
}

function describe(name, fn) {
  console.log(`\n● ${name}`)
  fn()
}

// ── 测试用例 ──────────────────────────────────────────────────

describe('computeMaxNewFactorWeight', () => {
  assertEq(computeMaxNewFactorWeight(0), 0.80, '0 个已有因素：上限 80%')
  assertEq(computeMaxNewFactorWeight(2), 0.80, '2 个已有因素：上限 80%')
  assertEq(computeMaxNewFactorWeight(3), 0.80, '3 个已有因素：上限 80%')
  assertEq(computeMaxNewFactorWeight(4), 0.80, '4 个已有因素：上限 80%')
  assertEq(computeMaxNewFactorWeight(5), 0.75, '5 个已有因素：上限 75%')
})

describe('用例 1：旧 [40%, 35%, 25%]，新增 30%', () => {
  const r = redistributeExistingWeightsForNewFactor([0.40, 0.35, 0.25], 0.30)
  assertEq(r.newFactorWeight, 0.30, '新因素权重严格为 30%')
  assertEq(r.existing, [0.30, 0.25, 0.15], '旧因素按 5% 步长 [30%, 25%, 15%]')
  const sum = r.existing.reduce((s, w) => s + w, 0) + r.newFactorWeight
  assertTrue(Math.abs(sum - 1) < 1e-9, `总和严格为 100%（实际 ${(sum * 100).toFixed(2)}%）`)
  assertTrue(r.existing.every((w) => w >= 0.05 && w <= 0.80), '每项在 5%~80%')
})

describe('用例 2：旧 [50%, 30%, 20%]，新增 20%', () => {
  const r = redistributeExistingWeightsForNewFactor([0.50, 0.30, 0.20], 0.20)
  assertEq(r.newFactorWeight, 0.20, '新因素权重严格为 20%')
  const sum = r.existing.reduce((s, w) => s + w, 0)
  assertTrue(Math.abs(sum - 0.80) < 1e-9, `旧因素总和严格为 80%（实际 ${(sum * 100).toFixed(2)}%）`)
  assertTrue(r.existing.every((w) => w >= 0.05 && w <= 0.80), '每项在 5%~80%')
  assertTrue(r.existing.every((w) => w * 100 % 5 === 0), '全部为 5% 整数倍')
})

describe('用例 3：已有 4 个因素，新增最大 80%', () => {
  const max = computeMaxNewFactorWeight(4)
  assertEq(max, 0.80, '动态最大权重 = 80%')
  const r = redistributeExistingWeightsForNewFactor([0.25, 0.25, 0.25, 0.25], max)
  assertTrue(r !== null, '可成功分配')
  assertEq(r.newFactorWeight, 0.80, '新因素权重 = 80%')
  assertEq(r.existing, [0.05, 0.05, 0.05, 0.05], '旧因素各保留 5%')
  const sum = r.existing.reduce((s, w) => s + w, 0) + r.newFactorWeight
  assertTrue(Math.abs(sum - 1) < 1e-9, `总和严格为 100%（实际 ${(sum * 100).toFixed(2)}%）`)
})

describe('用例 4：已有 5 个因素，新增 80% 超过上限', () => {
  const max = computeMaxNewFactorWeight(5)
  assertEq(max, 0.75, '动态最大权重 = 75%')
  // 输入 0.80 超上限，应在调用方校验拒绝；本函数 snap 后为 0.75 但预算不足以分配，
  // 所以正确返回 null（用户应当限制输入 ≤ 0.75 才能新增）
  const r80 = redistributeExistingWeightsForNewFactor([0.20, 0.20, 0.20, 0.20, 0.20], 0.80)
  assertEq(r80, null, '0.80 超出 5 个旧因素的可分配上限，返回 null')

  // 输入 0.75 应可成功分配
  const r75 = redistributeExistingWeightsForNewFactor([0.20, 0.20, 0.20, 0.20, 0.20], 0.75)
  assertTrue(r75 !== null, '0.75 在限制内，可成功分配')
  assertEq(r75.newFactorWeight, 0.75, 'snap 后为 75%')
  const sum = r75.existing.reduce((s, w) => s + w, 0)
  assertTrue(Math.abs(sum - 0.25) < 1e-9, `旧因素总和 = 25%（实际 ${(sum * 100).toFixed(2)}%）`)
})

describe('边界：单个已有因素', () => {
  const r = redistributeExistingWeightsForNewFactor([0.50], 0.30)
  assertEq(r.newFactorWeight, 0.30, '新因素权重 = 30%')
  assertEq(r.existing, [0.70], '唯一旧因素占 70%')
})

describe('边界：5 个旧因素各 5%，新增 75%', () => {
  const r = redistributeExistingWeightsForNewFactor([0.05, 0.05, 0.05, 0.05, 0.05], 0.75)
  assertEq(r.newFactorWeight, 0.75, '新因素权重 = 75%')
  assertEq(r.existing, [0.05, 0.05, 0.05, 0.05, 0.05], '每个旧因素保持 5%')
})

describe('边界：极端比例 5%/80%/5%/5%/5%，新增 5%', () => {
  const r = redistributeExistingWeightsForNewFactor([0.05, 0.80, 0.05, 0.05, 0.05], 0.05)
  assertEq(r.newFactorWeight, 0.05, '新因素 = 5%')
  const sum = r.existing.reduce((s, w) => s + w, 0)
  assertTrue(Math.abs(sum - 0.95) < 1e-9, `旧因素总和 = 95%`)
  assertTrue(r.existing.every((w) => w >= 0.05 && w <= 0.80), '每项在 5%~80%')
})

describe('极端：4 个旧因素 [16, 1, 1, 1] 单位，新增 1 单位', () => {
  const r = redistributeExistingWeightsForNewFactor([0.80, 0.05, 0.05, 0.05], 0.05)
  assertEq(r.newFactorWeight, 0.05, '新因素 = 5%')
  const sum = r.existing.reduce((s, w) => s + w, 0)
  assertTrue(Math.abs(sum - 0.95) < 1e-9, `旧因素总和 = 95%`)
  assertTrue(r.existing.every((w) => w >= 0.05 && w <= 0.80), '每项在 5%~80%')
})

describe('比例保持验证：旧 [40%, 35%, 25%]，新增 30%，比例接近原 8:7:5', () => {
  const r = redistributeExistingWeightsForNewFactor([0.40, 0.35, 0.25], 0.30)
  // 期望 old/new 比例接近原 8:7:5 (即新 : 旧 = 6 : 14 = 3:7)
  // 实际 old = 30:25:15 = 6:5:3，原 = 8:7:5
  // 检查最大相对偏差
  const ratios = r.existing.map((w, i) => w / [0.40, 0.35, 0.25][i])
  const minRatio = Math.min(...ratios)
  const maxRatio = Math.max(...ratios)
  assertTrue(maxRatio - minRatio < 0.5, `比例偏差 < 0.5（min=${minRatio.toFixed(3)}, max=${maxRatio.toFixed(3)}）`)
})

describe('总和不漂移：100 次随机分配检查总和恒为 100%', () => {
  let allValid = true
  for (let trial = 0; trial < 100; trial++) {
    const n = 2 + Math.floor(Math.random() * 4) // 2-5
    const old = []
    let s = 0
    for (let i = 0; i < n - 1; i++) {
      const u = 1 + Math.floor(Math.random() * 16)
      old.push(u * WEIGHT_UNIT)
      s += u
    }
    // 最后一个补齐使总和 ≈ 20
    const last = 20 - s
    if (last < 1 || last > 16) continue
    old.push(last * WEIGHT_UNIT)
    const newW = 1 + Math.floor(Math.random() * 16)
    const r = redistributeExistingWeightsForNewFactor(old, newW * WEIGHT_UNIT)
    if (!r) continue
    const sum = r.existing.reduce((acc, w) => acc + w, 0) + r.newFactorWeight
    if (Math.abs(sum - 1) >= 1e-9) {
      allValid = false
      console.error(`  失败 trial=${trial}: sum=${sum}`)
      break
    }
  }
  assertTrue(allValid, '100 次随机分配均满足总和 = 100%')
})

console.log(`\n========== 测试结果 ==========`)
console.log(`通过 ${passed} / 失败 ${failed}`)
process.exit(failed > 0 ? 1 : 0)