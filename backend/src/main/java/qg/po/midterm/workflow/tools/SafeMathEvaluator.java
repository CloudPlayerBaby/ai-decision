package qg.po.midterm.workflow.tools;

/** A small arithmetic-only parser that cannot access Java types or methods. */
public final class SafeMathEvaluator {

    private static final int MAX_EXPRESSION_LENGTH = 200;

    private final String expression;
    private int position;

    private SafeMathEvaluator(String expression) {
        this.expression = expression;
    }

    public static double evaluate(String expression) {
        if (expression == null || expression.isBlank()) {
            throw new IllegalArgumentException("表达式不能为空");
        }
        if (expression.length() > MAX_EXPRESSION_LENGTH) {
            throw new IllegalArgumentException("表达式过长");
        }
        if (!expression.matches("[0-9+\\-*/%().\\s]+")) {
            throw new IllegalArgumentException("表达式包含不允许的字符");
        }
        SafeMathEvaluator parser = new SafeMathEvaluator(expression);
        double value = parser.parseExpression();
        parser.skipWhitespace();
        if (!parser.isAtEnd() || !Double.isFinite(value)) {
            throw new IllegalArgumentException("表达式格式错误");
        }
        return value;
    }

    private double parseExpression() {
        double value = parseTerm();
        while (true) {
            skipWhitespace();
            if (match('+')) {
                value += parseTerm();
            } else if (match('-')) {
                value -= parseTerm();
            } else {
                return value;
            }
        }
    }

    private double parseTerm() {
        double value = parseUnary();
        while (true) {
            skipWhitespace();
            if (match('*')) {
                value *= parseUnary();
            } else if (match('/')) {
                double divisor = parseUnary();
                requireNonZero(divisor);
                value /= divisor;
            } else if (match('%')) {
                double divisor = parseUnary();
                requireNonZero(divisor);
                value %= divisor;
            } else {
                return value;
            }
        }
    }

    private double parseUnary() {
        skipWhitespace();
        if (match('+')) return parseUnary();
        if (match('-')) return -parseUnary();
        return parsePrimary();
    }

    private double parsePrimary() {
        skipWhitespace();
        if (match('(')) {
            double value = parseExpression();
            skipWhitespace();
            if (!match(')')) throw new IllegalArgumentException("括号不匹配");
            return value;
        }
        return parseNumber();
    }

    private double parseNumber() {
        skipWhitespace();
        int start = position;
        boolean decimalPointSeen = false;
        while (!isAtEnd()) {
            char current = expression.charAt(position);
            if (Character.isDigit(current)) {
                position++;
            } else if (current == '.' && !decimalPointSeen) {
                decimalPointSeen = true;
                position++;
            } else {
                break;
            }
        }
        if (start == position || expression.substring(start, position).equals(".")) {
            throw new IllegalArgumentException("缺少数字");
        }
        try {
            return Double.parseDouble(expression.substring(start, position));
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("数字格式错误", exception);
        }
    }

    private static void requireNonZero(double divisor) {
        if (divisor == 0.0d) throw new IllegalArgumentException("除数不能为零");
    }

    private boolean match(char expected) {
        if (!isAtEnd() && expression.charAt(position) == expected) {
            position++;
            return true;
        }
        return false;
    }

    private void skipWhitespace() {
        while (!isAtEnd() && Character.isWhitespace(expression.charAt(position))) position++;
    }

    private boolean isAtEnd() {
        return position >= expression.length();
    }
}
