package qg.po.midterm.service.impl;

import qg.po.midterm.dto.result.Canvas;

/**
 * 统一生成自动画布的初始布局（从左到右：决策 → 因素 → 方案）。
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
}
