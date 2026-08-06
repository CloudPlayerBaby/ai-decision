/**
 * 算法单元测试（独立 Node 脚本）。
 * 项目未集成 vitest/jest，使用纯 node 直接运行验证核心算法正确性。
 *
 * 运行方式：
 *   cd frontend && node tests/redistributeWeights.test.mjs
 */

const WEIGHT_UNIT = 0.01
const TOTAL_UNITS = 100
const MIN_UNITS = 5
const MAX_UNITS = 80

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

/**
 * 编辑已有因素：被编辑因素权重被强制保留，其余因素按编辑前的相对比例重新分配。
 * 遵循 5%-80% 边界限制。
 */
function rebalanceEditedFactor(factorNodes, editedId, newWeight, otherSnapshotWeights) {
  if (!Number.isFinite(newWeight)) return null
  if (factorNodes.length === 0) return null
  const editedNode = factorNodes.find((n) => n.id === editedId)
  if (!editedNode) return null
  if (factorNodes.length === 1) {
    return {
      factorNodes: factorNodes.map((n) => ({ ...n, data: { ...n.data, weight: 1 } })),
      editedWeight: 1,
    }
  }
  const otherCount = factorNodes.length - 1
  const min = Math.max(0.05, 1 - otherCount * 0.80)
  const max = Math.min(0.80, 1 - otherCount * 0.05)
  const rawUnits = Math.round(newWeight / WEIGHT_UNIT)
  const minUnits = Math.round(min / WEIGHT_UNIT)
  const maxUnits = Math.round(max / WEIGHT_UNIT)
  const clampedUnits = Math.max(minUnits, Math.min(maxUnits, rawUnits))
  const editedWeightSnapped = Math.round(clampedUnits * WEIGHT_UNIT * 1000) / 1000
  const editedUnits = clampedUnits
  const budget = TOTAL_UNITS - editedUnits
  if (budget < 0) return null
  const otherNodes = factorNodes.filter((n) => n.id !== editedId)
  const otherBaseline =
    otherSnapshotWeights && otherSnapshotWeights.length === otherNodes.length
      ? Array.from(otherSnapshotWeights)
      : otherNodes.map((n) => (n.data && n.data.weight != null ? n.data.weight : 0))
  const allocations = allocateUnitsProportionally(otherBaseline, budget)
  if (!allocations) return null
  const updatedOthers = otherNodes.map((n, i) => ({
    ...n,
    data: { ...n.data, weight: allocations[i] * WEIGHT_UNIT },
  }))
  const idToUpdated = new Map()
  idToUpdated.set(editedId, { ...editedNode, data: { ...editedNode.data, weight: editedWeightSnapped } })
  for (const n of updatedOthers) idToUpdated.set(n.id, n)
  return {
    factorNodes: factorNodes.map((n) => idToUpdated.get(n.id) ?? n),
    editedWeight: editedWeightSnapped,
  }
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

function approxEq(a, b, tol = 1e-9) {
  return Math.abs(a - b) < tol
}

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
  assertEq(r.existing, [0.28, 0.25, 0.17], '旧因素按 1% 步长 [28%, 25%, 17%]')
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
  assertTrue(r.existing.every((w) => Math.abs((w * 100) % 1) < 1e-9), '全部为 1% 整数倍')
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
      const u = 5 + Math.floor(Math.random() * 76)
      old.push(u * WEIGHT_UNIT)
      s += u
    }
    // 最后一个补齐使总和 ≈ 100
    const last = TOTAL_UNITS - s
    if (last < MIN_UNITS || last > MAX_UNITS) continue
    old.push(last * WEIGHT_UNIT)
    const newW = MIN_UNITS + Math.floor(Math.random() * (MAX_UNITS - MIN_UNITS + 1))
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

// ── 编辑因素测试用例 ─────────────────────────────────────────────

function makeFactor(id, weight) {
  return { id, type: 'factor', data: { nodeType: 'factor', weight } }
}

describe('编辑用例 1：[40%, 35%, 25%]，将中间因素改为 50%', () => {
  const factors = [
    makeFactor('f1', 0.40),
    makeFactor('f2', 0.35),
    makeFactor('f3', 0.25),
  ]
  const r = rebalanceEditedFactor(factors, 'f2', 0.50)
  assertTrue(r !== null, '应能成功配平')
  assertTrue(approxEq(r.editedWeight, 0.50), '被编辑因素 f2 严格 = 50%')
  const out = new Map(r.factorNodes.map((n) => [n.id, n.data.weight]))
  // 剩余 50 单位分配给 baseline (40, 25)，比例 50*40/65=30.77, 50*25/65=19.23
  // 取整 + 最大余数：(31, 19)
  assertTrue(approxEq(out.get('f1'), 0.31), 'f1 ≈ 31%')
  assertTrue(approxEq(out.get('f2'), 0.50), 'f2 ≈ 50%')
  assertTrue(approxEq(out.get('f3'), 0.19), 'f3 ≈ 19%')
  const sum = out.get('f1') + out.get('f2') + out.get('f3')
  assertTrue(Math.abs(sum - 1) < 1e-9, `总和 = 100%（实际 ${(sum * 100).toFixed(2)}%）`)
  assertTrue(r.factorNodes.every((n) => n.data.weight >= 0.05 && n.data.weight <= 0.80), '每项在 5%~80%')
  // 验证所有权重都是 1% 整数倍（容忍 1e-9 浮点误差）
  assertTrue(
    r.factorNodes.every((n) => Math.abs((n.data.weight * 100) % 1) < 1e-9),
    '全部为 1% 整数倍',
  )
})

describe('编辑用例 2：[40%, 35%, 25%]，将第一个因素改为 20%', () => {
  const factors = [
    makeFactor('f1', 0.40),
    makeFactor('f2', 0.35),
    makeFactor('f3', 0.25),
  ]
  const r = rebalanceEditedFactor(factors, 'f1', 0.20)
  assertTrue(r !== null, '应能成功配平')
  assertTrue(approxEq(r.editedWeight, 0.20), 'f1 严格 = 20%')
  const out = new Map(r.factorNodes.map((n) => [n.id, n.data.weight]))
  assertTrue(approxEq(out.get('f1'), 0.20), 'f1 ≈ 20%')
  const f2Weight = out.get('f2')
  const f3Weight = out.get('f3')
  const sum = out.get('f1') + f2Weight + f3Weight
  assertTrue(Math.abs(sum - 1) < 1e-9, `总和 = 100%（实际 ${(sum * 100).toFixed(2)}%）`)
  assertTrue(f2Weight >= 0.05 && f2Weight <= 0.80, 'f2 在 5%~80%')
  assertTrue(f3Weight >= 0.05 && f3Weight <= 0.80, 'f3 在 5%~80%')
  // f1 = 20 单位，f2 + f3 = 80 单位，
  // f2 baseline 35, f3 baseline 25，比例 80*35/60=46.67, 80*25/60=33.33
  // 取整 + 最大余数：(47, 33)
  assertTrue(Math.abs(f2Weight - 0.47) < 0.015, `f2 ≈ 47%（实际 ${(f2Weight * 100).toFixed(2)}%）`)
  assertTrue(Math.abs(f3Weight - 0.33) < 0.015, `f3 ≈ 33%（实际 ${(f3Weight * 100).toFixed(2)}%）`)
  assertTrue(
    Math.abs((f2Weight * 100) % 1) < 1e-9,
    'f2 为 1% 整数倍',
  )
  assertTrue(
    Math.abs((f3Weight * 100) % 1) < 1e-9,
    'f3 为 1% 整数倍',
  )
})

describe('编辑用例 3：4 因素 [25%, 25%, 25%, 25%]，将其中一个改为 80%', () => {
  const factors = [
    makeFactor('f1', 0.25),
    makeFactor('f2', 0.25),
    makeFactor('f3', 0.25),
    makeFactor('f4', 0.25),
  ]
  const r = rebalanceEditedFactor(factors, 'f2', 0.80)
  assertTrue(r !== null, '应能成功配平')
  assertTrue(approxEq(r.editedWeight, 0.80), 'f2 严格 = 80%')
  const out = new Map(r.factorNodes.map((n) => [n.id, n.data.weight]))
  const others = [out.get('f1'), out.get('f3'), out.get('f4')]
  assertTrue(others.every((w) => w >= 0.05), '其余 3 个因素均 ≥ 5%')
  const sum = out.get('f1') + out.get('f2') + out.get('f3') + out.get('f4')
  assertTrue(Math.abs(sum - 1) < 1e-9, `总和 = 100%（实际 ${(sum * 100).toFixed(2)}%）`)
  // 剩余 20 单位分配给 3 个 baseline 各 25 单位的因素，
  // 比例 1:1:1，理论各 6.67 单位 → 取整 + 最大余数 (7, 7, 6) = (7%, 7%, 6%)
  const sortedOthers = others.slice().sort((a, b) => b - a)
  assertTrue(Math.abs(sortedOthers[0] - 0.07) < 0.015, `最大的 others ≈ 7%（实际 ${(sortedOthers[0] * 100).toFixed(2)}%）`)
  assertTrue(
    Math.abs(sortedOthers[1] - 0.07) < 0.015 && Math.abs(sortedOthers[2] - 0.06) < 0.015,
    `另外两个 others ≈ 7%/6%（实际 ${(sortedOthers[1] * 100).toFixed(2)}% / ${(sortedOthers[2] * 100).toFixed(2)}%）`,
  )
})

describe('编辑用例 4：连续编辑同一因素不会导致其他因素比例漂移', () => {
  const initial = [
    makeFactor('f1', 0.40),
    makeFactor('f2', 0.35),
    makeFactor('f3', 0.25),
  ]
  // 编辑前快照：f1=40%, f3=25%
  const snapshot = [0.40, 0.25]

  // 第一帧：把 f2 改为 30%（期望 f1=43%, f2=30%, f3=27% — 比例从 baseline (40,25) 推导）
  const r1 = rebalanceEditedFactor(initial, 'f2', 0.30, snapshot)
  assertTrue(r1 !== null, '第一帧配平成功')
  const out1 = new Map(r1.factorNodes.map((n) => [n.id, n.data.weight]))
  assertTrue(approxEq(out1.get('f2'), 0.30), '第一帧 f2 严格 = 30%')
  const f1First = out1.get('f1')
  const f3First = out1.get('f3')

  // 第二帧：在初始快照基础上把 f2 改为 40%
  const r2 = rebalanceEditedFactor(initial, 'f2', 0.40, snapshot)
  assertTrue(r2 !== null, '第二帧配平成功')
  const out2 = new Map(r2.factorNodes.map((n) => [n.id, n.data.weight]))
  assertTrue(approxEq(out2.get('f2'), 0.40), '第二帧 f2 严格 = 40%')
  // 关键：两帧 f1/f3 都从 40/25 的快照按比例分剩余，不应被上一帧的取整结果污染
  // 第一帧：剩余 70 单位，baseline (40, 25)，理论 70*40/65=43.08, 70*25/65=26.92
  // 取整 + 最大余数：(43, 27) = (43%, 27%)
  assertTrue(approxEq(f1First, 0.43), `第一帧 f1 ≈ 43%（实际 ${(f1First * 100).toFixed(2)}%）`)
  assertTrue(approxEq(f3First, 0.27), `第一帧 f3 ≈ 27%（实际 ${(f3First * 100).toFixed(2)}%）`)
  // 第二帧：剩余 60 单位，baseline (40, 25)，理论 60*40/65=36.92, 60*25/65=23.08
  // 取整 + 最大余数：(37, 23) = (37%, 23%)
  assertTrue(Math.abs(out2.get('f1') - 0.37) < 0.015, `第二帧 f1 ≈ 37%（与第一帧不同，说明比例从快照恢复而非被上一帧污染，实际 ${(out2.get('f1') * 100).toFixed(2)}%）`)
  assertTrue(approxEq(out2.get('f3'), 0.23), `第二帧 f3 ≈ 23%`)
})

describe('编辑用例 5：通用不变量（任一编辑结果）', () => {
  // 100 次随机用例验证：
  // 1) 被编辑因素权重严格等于 snapped 输入（在 [min, max] 内）；
  // 2) 其余因素权重之和 = 1 - 编辑因素权重；
  // 3) 每项在 [5%, 80%]；
  // 4) 总和严格 = 100%；
  // 5) 所有权重都是 1% 整数倍。
  let allValid = true
  let failureDetail = ''
  for (let trial = 0; trial < 100; trial++) {
    const n = 2 + Math.floor(Math.random() * 4) // 2-5
    const factors = []
    let s = 0
    for (let i = 0; i < n - 1; i++) {
      const u = 5 + Math.floor(Math.random() * 76)
      factors.push(makeFactor(`f${i}`, u * WEIGHT_UNIT))
      s += u
    }
    const lastU = TOTAL_UNITS - s
    if (lastU < MIN_UNITS || lastU > MAX_UNITS) continue
    factors.push(makeFactor(`f${n - 1}`, lastU * WEIGHT_UNIT))
    const editedIdx = Math.floor(Math.random() * n)
    const editedId = `f${editedIdx}`
    // 在动态 [min, max] 内随机选一个新权重，避免被 clamp 后断言失败
    const otherCount = n - 1
    const minPct = Math.max(0.05, 1 - otherCount * 0.80)
    const maxPct = Math.min(0.80, 1 - otherCount * 0.05)
    const minUnits = Math.ceil(minPct / WEIGHT_UNIT)
    const maxUnits = Math.floor(maxPct / WEIGHT_UNIT)
    if (maxUnits < minUnits) continue
    const newUnits = minUnits + Math.floor(Math.random() * (maxUnits - minUnits + 1))
    const newW = newUnits * WEIGHT_UNIT
    const snapshot = factors.filter((f) => f.id !== editedId).map((f) => f.data.weight)
    const r = rebalanceEditedFactor(factors, editedId, newW, snapshot)
    if (!r) {
      allValid = false
      failureDetail = `trial=${trial} rebalance returned null`
      break
    }
    const editedNode = r.factorNodes.find((f) => f.id === editedId)
    if (Math.abs(editedNode.data.weight - r.editedWeight) > 1e-9) {
      allValid = false
      failureDetail = `trial=${trial} edited weight mismatch`
      break
    }
    if (Math.abs(editedNode.data.weight - newW) > 1e-9) {
      allValid = false
      failureDetail = `trial=${trial} edited weight != input (input=${newW}, got=${editedNode.data.weight})`
      break
    }
    const sum = r.factorNodes.reduce((acc, f) => acc + f.data.weight, 0)
    if (Math.abs(sum - 1) >= 1e-9) {
      allValid = false
      failureDetail = `trial=${trial} sum=${sum}`
      break
    }
    for (const f of r.factorNodes) {
      if (f.data.weight < 0.05 - 1e-9 || f.data.weight > 0.80 + 1e-9) {
        allValid = false
        failureDetail = `trial=${trial} out-of-range: ${f.id}=${f.data.weight}`
        break
      }
      const wPct = f.data.weight * 100
      const rounded = Math.round(wPct)
      if (Math.abs(wPct - rounded) > 1e-6) {
        allValid = false
        failureDetail = `trial=${trial} not 1%-multiple: ${f.id}=${f.data.weight}`
        break
      }
    }
    if (!allValid) break
  }
  assertTrue(allValid, `100 次随机编辑均满足不变量（${failureDetail}）`)
})

console.log(`\n========== 测试结果 ==========`)
console.log(`通过 ${passed} / 失败 ${failed}`)
process.exit(failed > 0 ? 1 : 0)