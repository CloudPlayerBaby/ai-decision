package qg.po.midterm.service.impl;

import qg.po.midterm.dto.result.Canvas;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 统一生成自动画布的布局（从左到右：决策 → 因素 → 方案）。
 *
 * <p>旧算法固定 y、横向均分，节点上下叠排且间距过小；本算法改为
 * 每一类节点占一列（固定 x），列内节点纵向均匀分布（均分 y），并拉大间距。</p>
 */
final class CanvasLayoutPlanner {

    private CanvasLayoutPlanner() {
    }

    /** 决策列 x（最左） */
    private static final double DECISION_X = 100;
    /** 因素列 x（中间） */
    private static final double FACTOR_X = 480;
    /** 方案列 x（最右） */
    private static final double OPTION_X = 860;

    /** 各列内部纵向分布的顶部 y */
    private static final double BAND_TOP = 120;
    /** 各列内部纵向分布的底部 y */
    private static final double BAND_BOTTOM = 720;
    /** 决策节点垂直居中位置 */
    private static final double CENTER_Y = (BAND_TOP + BAND_BOTTOM) / 2;

    /** 决策根节点初始位置 */
    static Canvas.Position rootPosition() {
        return new Canvas.Position(DECISION_X, CENTER_Y);
    }

    /** 某一类节点所在列的固定 x */
    static double columnX(String type) {
        return switch (type) {
            case "decision" -> DECISION_X;
            case "factor" -> FACTOR_X;
            default -> OPTION_X;
        };
    }

    /**
     * 列内第 index 个（共 count 个）节点应放置的 y。
     *
     * <p>纵向均匀分布在整个竖带上，间距随节点数量自适应拉大，避免节点挤压。</p>
     */
    static double distributeY(int index, int count) {
        if (count <= 1) {
            return CENTER_Y;
        }
        return BAND_TOP + (double) index * (BAND_BOTTOM - BAND_TOP) / (count - 1);
    }

    /**
     * 结构变更后重新布局受影响列。
     *
     * <p>当前端增删 factor / option 节点时，前端给的是临时坐标，后端若只存不改，
     * 脏坐标会一直保留到局部推演后刷新，造成布局混乱。这里检测结构变更
     * （新增/删除 factor 或 option），对受影响列整体按 LR 布局重新计算坐标，
     * 保留节点原有纵向顺序。</p>
     *
     * @param newCanvas 前端传来的新画布（会被就地修改坐标）
     * @param oldCanvas 已保存的旧画布，可为 null
     */
    static void relayoutOnStructuralChange(Canvas newCanvas, Canvas oldCanvas) {
        Set<String> oldIds = indexNodeIds(oldCanvas);
        Set<String> newIds = indexNodeIds(newCanvas);

        boolean factorChanged = false;
        boolean optionChanged = false;
        for (String id : newIds) {
            if (!oldIds.contains(id)) {
                factorChanged |= isNodeType(newCanvas, id, "factor");
                optionChanged |= isNodeType(newCanvas, id, "option");
            }
        }
        for (String id : oldIds) {
            if (!newIds.contains(id)) {
                factorChanged |= isNodeType(oldCanvas, id, "factor");
                optionChanged |= isNodeType(oldCanvas, id, "option");
            }
        }

        if (factorChanged) {
            relayoutColumn(newCanvas, "factor");
        }
        if (optionChanged) {
            relayoutColumn(newCanvas, "option");
        }
    }

    private static Set<String> indexNodeIds(Canvas canvas) {
        Set<String> ids = new LinkedHashSet<>();
        if (canvas == null || canvas.getNodes() == null) {
            return ids;
        }
        for (Canvas.CanvasNode node : canvas.getNodes()) {
            if (node != null && node.getId() != null) {
                ids.add(node.getId());
            }
        }
        return ids;
    }

    private static boolean isNodeType(Canvas canvas, String id, String type) {
        if (canvas == null || canvas.getNodes() == null) return false;
        for (Canvas.CanvasNode node : canvas.getNodes()) {
            if (node != null && id.equals(node.getId()) && type.equals(node.getType())) {
                return true;
            }
        }
        return false;
    }

    /** 把某一列的全部节点按当前 y 顺序重新铺到 LR 布局列上，固定 x、纵向均分。 */
    private static void relayoutColumn(Canvas canvas, String type) {
        if (canvas == null || canvas.getNodes() == null) return;
        List<Canvas.CanvasNode> column = canvas.getNodes().stream()
                .filter(node -> node != null && type.equals(node.getType()))
                .sorted(Comparator.comparingDouble(node ->
                        node.getPosition() == null ? 0 : node.getPosition().getY()))
                .collect(Collectors.toList());
        double x = columnX(type);
        for (int i = 0; i < column.size(); i++) {
            Canvas.CanvasNode node = column.get(i);
            node.setPosition(new Canvas.Position(x, distributeY(i, column.size())));
        }
    }
}
