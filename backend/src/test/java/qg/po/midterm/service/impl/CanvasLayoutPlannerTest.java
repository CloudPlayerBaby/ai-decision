package qg.po.midterm.service.impl;

import org.junit.jupiter.api.Test;
import qg.po.midterm.dto.result.Canvas;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CanvasLayoutPlannerTest {

    @Test
    void addedFactorRelayoutsOnlyFactorColumn() {
        Canvas oldCanvas = canvas(
                node("root", "decision", 100, 420),
                node("f1", "factor", 480, 120),
                node("f2", "factor", 480, 720),
                node("o1", "option", 860, 120),
                node("o2", "option", 860, 720)
        );
        Canvas newCanvas = canvas(
                node("root", "decision", 100, 420),
                node("f1", "factor", 480, 120),
                node("f2", "factor", 480, 720),
                node("f3", "factor", 999, 999),   // 前端给的临时坐标
                node("o1", "option", 860, 120),
                node("o2", "option", 860, 720)
        );

        CanvasLayoutPlanner.relayoutOnStructuralChange(newCanvas, oldCanvas);

        // 因素列整体重新布局：x 统一为 480，y 按 3 个节点均分
        Map<String, Canvas.CanvasNode> factors = indexByType(newCanvas, "factor");
        assertEquals(3, factors.size());
        for (Canvas.CanvasNode factor : factors.values()) {
            assertEquals(480, factor.getPosition().getX(), 0.001);
        }
        List<Double> factorYs = factors.values().stream()
                .map(n -> n.getPosition().getY()).sorted().toList();
        assertEquals(List.of(120.0, 420.0, 720.0), factorYs);

        // 方案列不受影响
        Map<String, Canvas.CanvasNode> options = indexByType(newCanvas, "option");
        assertEquals(860, options.get("o1").getPosition().getX(), 0.001);
        assertEquals(120, options.get("o1").getPosition().getY(), 0.001);
        assertEquals(720, options.get("o2").getPosition().getY(), 0.001);
    }

    @Test
    void deletedOptionRelayoutsOnlyOptionColumn() {
        Canvas oldCanvas = canvas(
                node("root", "decision", 100, 420),
                node("f1", "factor", 480, 120),
                node("o1", "option", 860, 120),
                node("o2", "option", 860, 420),
                node("o3", "option", 860, 720)
        );
        Canvas newCanvas = canvas(
                node("root", "decision", 100, 420),
                node("f1", "factor", 480, 120),
                node("o1", "option", 860, 120),
                node("o3", "option", 860, 720)   // 删掉了 o2，应弥合缺口
        );

        CanvasLayoutPlanner.relayoutOnStructuralChange(newCanvas, oldCanvas);

        Map<String, Canvas.CanvasNode> options = indexByType(newCanvas, "option");
        assertEquals(2, options.size());
        List<Double> optionYs = options.values().stream()
                .map(n -> n.getPosition().getY()).sorted().toList();
        assertEquals(List.of(120.0, 720.0), optionYs);
        assertEquals(860, options.get("o1").getPosition().getX(), 0.001);

        // 因素列不受影响
        assertEquals(120, indexByType(newCanvas, "factor").get("f1").getPosition().getY(), 0.001);
    }

    @Test
    void noStructuralChangeKeepsPositions() {
        Canvas oldCanvas = canvas(
                node("root", "decision", 100, 420),
                node("f1", "factor", 300, 150),   // 用户拖过的自定义位置
                node("o1", "option", 600, 200)
        );
        Canvas newCanvas = canvas(
                node("root", "decision", 100, 420),
                node("f1", "factor", 300, 150),
                node("o1", "option", 600, 200)
        );

        CanvasLayoutPlanner.relayoutOnStructuralChange(newCanvas, oldCanvas);

        Canvas.CanvasNode factor = indexByType(newCanvas, "factor").get("f1");
        assertEquals(300, factor.getPosition().getX(), 0.001);
        assertEquals(150, factor.getPosition().getY(), 0.001);
        Canvas.CanvasNode option = indexByType(newCanvas, "option").get("o1");
        assertEquals(200, option.getPosition().getY(), 0.001);
    }

    @Test
    void nullOldCanvasTreatsAllAsNew() {
        Canvas newCanvas = canvas(
                node("root", "decision", 100, 420),
                node("f1", "factor", 999, 888),
                node("o1", "option", 777, 666)
        );

        CanvasLayoutPlanner.relayoutOnStructuralChange(newCanvas, null);

        assertEquals(480, indexByType(newCanvas, "factor").get("f1").getPosition().getX(), 0.001);
        assertEquals(860, indexByType(newCanvas, "option").get("o1").getPosition().getX(), 0.001);
        assertEquals(420, indexByType(newCanvas, "factor").get("f1").getPosition().getY(), 0.001);
        assertEquals(420, indexByType(newCanvas, "option").get("o1").getPosition().getY(), 0.001);
    }

    private Canvas canvas(Canvas.CanvasNode... nodes) {
        return new Canvas(List.of(nodes), List.of());
    }

    private Canvas.CanvasNode node(String id, String type, double x, double y) {
        Canvas.CanvasNode node = new Canvas.CanvasNode();
        node.setId(id);
        node.setType(type);
        node.setLabel(type);
        node.setPosition(new Canvas.Position(x, y));
        node.setData(Map.of());
        return node;
    }

    private Map<String, Canvas.CanvasNode> indexByType(Canvas canvas, String type) {
        Map<String, Canvas.CanvasNode> map = new LinkedHashMap<>();
        for (Canvas.CanvasNode node : canvas.getNodes()) {
            if (type.equals(node.getType())) {
                map.put(node.getId(), node);
            }
        }
        return map;
    }
}
