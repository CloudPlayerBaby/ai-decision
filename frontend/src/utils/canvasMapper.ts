/**
 * Canvas ↔ Flow 双向转换
 *
 * Re-exports from canvasMapperImpl.ts which contains the full implementation
 * including bounded weight rebalancing (5%-80% limits).
 */

export {
  toCanvasNode,
  toCanvasEdge,
  buildCanvasData,
  toFlowNode,
  toFlowNodes,
  buildCanvasViewModel,
  rebalanceWeights,
  redistributeWeightsOnDelete,
  redistributeWeightsOnAdd,
  rebalanceWithNewFactor,
  redistributeExistingWeightsForNewFactor,
  computeMaxNewFactorWeight,
  allocateUnitsProportionally,
} from './canvasMapperImpl.ts'
