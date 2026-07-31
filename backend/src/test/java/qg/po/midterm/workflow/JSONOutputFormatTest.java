package qg.po.midterm.workflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.workflow.node.FactorAnalysisNode.FactorAnalysisResult;
import qg.po.midterm.workflow.node.OptionGenerationNode.OptionGenerationResult;
import qg.po.midterm.workflow.node.RequirementAnalysisResult;
import qg.po.midterm.workflow.node.RiskAnalysisNode.RiskAnalysisResult;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.List;
import java.util.Map;

public class JSONOutputFormatTest {

    @Test
    public void testAIOutputSerializationAndParsing() throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        System.out.println("==================================================");
        System.out.println("1. 模拟 AI 吐出的 RequirementAnalysisResult (理解问题节点)");
        RequirementAnalysisResult reqResult = new RequirementAnalysisResult(
                "已识别学习路径与时间约束",
                "你只有一周时间准备 Java 后端面试，每天 2 小时，共 14 小时可用。核心矛盾在于有限时间内是追求覆盖面还是单点深度。",
                "这是一个紧急求职问题，时间极度受限。"
        );
        String reqJson = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(reqResult);
        System.out.println("【大模型返回的 JSON 数据】：\n" + reqJson);
        System.out.println("【后端解析提取给前端的结果】：\n" + parse(mapper, reqJson));
        System.out.println("==================================================\n");

        System.out.println("==================================================");
        System.out.println("2. 模拟 AI 吐出的 FactorAnalysisResult (提取关键因素节点)");
        Factor f1 = new Factor(); f1.setId("time"); f1.setName("时间成本"); f1.setWeight(0.6);
        Factor f2 = new Factor(); f2.setId("roi"); f2.setName("求职收益"); f2.setWeight(0.4);
        FactorAnalysisResult factorResult = new FactorAnalysisResult(
                "已提取 2 个核心关键因素",
                "关键因素包括：时间成本（每天仅 2 小时）、求职收益（面试高频度）。",
                List.of(f1, f2)
        );
        String factorJson = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(factorResult);
        System.out.println("【大模型返回的 JSON 数据】：\n" + factorJson);
        System.out.println("【后端解析提取给前端的结果】：\n" + parse(mapper, factorJson));
        System.out.println("==================================================\n");

        System.out.println("==================================================");
        System.out.println("3. 模拟 AI 吐出的 OptionGenerationResult (生成候选方案节点)");
        Option o1 = new Option(); o1.setId("op1"); o1.setName("刷高频算法题");
        Option o2 = new Option(); o2.setId("op2"); o2.setName("突击八股文");
        OptionGenerationResult optionResult = new OptionGenerationResult(
                "已生成 2 个备选学习方案",
                "系统为你生成了 2 个方向：要么专攻高频算法题，要么全面突击背诵八股文。",
                List.of(o1, o2)
        );
        String optionJson = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(optionResult);
        System.out.println("【大模型返回的 JSON 数据】：\n" + optionJson);
        System.out.println("【后端解析提取给前端的结果】：\n" + parse(mapper, optionJson));
        System.out.println("==================================================\n");
        
        System.out.println("==================================================");
        System.out.println("4. 模拟旧版本没有 summary 和 content 的历史残留数据");
        String oldJson = "{\n  \"understanding\": \"旧版直接放文本了\"\n}";
        System.out.println("【旧数据库里的历史 JSON】：\n" + oldJson);
        System.out.println("【后端解析兜底提取的结果】：\n" + parse(mapper, oldJson));
        System.out.println("==================================================\n");
    }

    private String parse(ObjectMapper mapper, String outputData) throws Exception {
        Map<String, Object> map = mapper.readValue(outputData, Map.class);
        String summary = map.containsKey("summary") ? String.valueOf(map.get("summary")) : "兜底: 节点执行完毕";
        String content = map.containsKey("content") ? String.valueOf(map.get("content")) : "兜底: " + outputData;
        return String.format("Summary = [%s]\nContent = [%s]", summary, content);
    }
}
