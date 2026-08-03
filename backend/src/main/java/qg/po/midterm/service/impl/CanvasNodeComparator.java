package qg.po.midterm.service.impl;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import qg.po.midterm.dto.result.Canvas;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/** 只比较画布节点中允许用户编辑的业务字段。 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
final class CanvasNodeComparator {

    private static final List<String> SCORE_KEYS =
            List.of("cost", "time", "benefit", "risk", "feasibility");

    static boolean businessEquals(Canvas.CanvasNode first, Canvas.CanvasNode second) {
        if (first == second) return true;
        if (first == null || second == null) return false;
        if (!Objects.equals(first.getType(), second.getType())
                || !Objects.equals(first.getLabel(), second.getLabel())) {
            return false;
        }

        if ("factor".equalsIgnoreCase(first.getType())) {
            return numberEquals(dataValue(first, "weight"), dataValue(second, "weight"));
        }
        if ("option".equalsIgnoreCase(first.getType())) {
            return scoresEqual(dataValue(first, "scores"), dataValue(second, "scores"));
        }
        return true;
    }

    private static Object dataValue(Canvas.CanvasNode node, String key) {
        Map<String, Object> data = node.getData();
        return data == null ? null : data.get(key);
    }

    private static boolean scoresEqual(Object first, Object second) {
        if (!(first instanceof Map<?, ?> firstScores)
                || !(second instanceof Map<?, ?> secondScores)) {
            return Objects.equals(first, second);
        }
        for (String key : SCORE_KEYS) {
            if (!numberEquals(firstScores.get(key), secondScores.get(key))) {
                return false;
            }
        }
        return true;
    }

    private static boolean numberEquals(Object first, Object second) {
        if (first instanceof Number firstNumber && second instanceof Number secondNumber) {
            return Double.compare(firstNumber.doubleValue(), secondNumber.doubleValue()) == 0;
        }
        return Objects.equals(first, second);
    }
}
