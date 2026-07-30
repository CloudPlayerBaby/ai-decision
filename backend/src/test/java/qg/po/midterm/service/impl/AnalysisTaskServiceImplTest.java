package qg.po.midterm.service.impl;

import tools.jackson.databind.ObjectMapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import qg.po.midterm.dto.request.PartialAnalysisRequest;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.entity.AnalysisResult;
import qg.po.midterm.entity.AnalysisStep;
import qg.po.midterm.entity.AnalysisTask;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.entity.DecisionCanvas;
import qg.po.midterm.mapper.AnalysisResultMapper;
import qg.po.midterm.mapper.AnalysisStepMapper;
import qg.po.midterm.mapper.AnalysisTaskMapper;
import qg.po.midterm.mapper.DecisionCanvasMapper;
import qg.po.midterm.mapper.DecisionMapper;
import qg.po.midterm.repository.TaskRuntimeRepository;
import qg.po.midterm.vo.CreateTaskVO;
import qg.po.midterm.vo.PartialTaskVO;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

@ExtendWith(MockitoExtension.class)
class AnalysisTaskServiceImplTest {

    @Mock
    private DecisionMapper decisionMapper;
    @Mock
    private AnalysisTaskMapper taskMapper;
    @Mock
    private AnalysisStepMapper stepMapper;
    @Mock
    private AnalysisResultMapper resultMapper;
    @Mock
    private DecisionCanvasMapper canvasMapper;
    @Mock
    private AnalysisWorkflowDispatcher workflowDispatcher;
    @Mock
    private TaskRuntimeRepository runtimeRepository;
    @Spy
    private final ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private AnalysisTaskServiceImpl service;

    @BeforeAll
    static void initMyBatisMetadata() {
        MybatisConfiguration configuration = new MybatisConfiguration();
        MapperBuilderAssistant assistant =
                new MapperBuilderAssistant(configuration, "test");
        TableInfoHelper.initTableInfo(assistant, Decision.class);
        TableInfoHelper.initTableInfo(assistant, AnalysisTask.class);
        TableInfoHelper.initTableInfo(assistant, AnalysisStep.class);
        TableInfoHelper.initTableInfo(assistant, AnalysisResult.class);
        TableInfoHelper.initTableInfo(assistant, DecisionCanvas.class);
    }

    @BeforeEach
    void setUpSecurity() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        100L,
                        null,
                        List.of()
                )
        );
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void startFullAnalysisShouldUseDatabaseTaskId() {
        Decision decision = decision("PENDING");
        when(decisionMapper.selectOne(any())).thenReturn(decision);
        when(taskMapper.selectCount(any())).thenReturn(0L);
        prepareGeneratedIds();

        CreateTaskVO result = service.startFullAnalysis("d_20001");

        assertEquals("t_30001", result.getTaskId());
        assertEquals("FULL_ANALYSIS", result.getTaskType());
        assertEquals("ANALYZING", decision.getStatus());
        verify(workflowDispatcher).startFullAnalysis(
                eq("t_30001"),
                eq("d_20001"),
                eq(decision)
        );
    }

    @Test
    void partialAnalysisShouldPassOldResultToWorkflow() throws Exception {
        Decision decision = decision("COMPLETED");
        when(decisionMapper.selectOne(any())).thenReturn(decision);
        when(taskMapper.selectCount(any())).thenReturn(0L);
        prepareGeneratedIds();

        AnalysisResultDto oldResult = new AnalysisResultDto();
        oldResult.setId("ar_40001");
        oldResult.setStatus("CONFIRMED");
        oldResult.setUnderstanding("已有问题理解");
        oldResult.setFactors(List.of(
                new Factor("f_time", "时间", "时间因素", 0.5)
        ));
        oldResult.setOptions(List.of(
                new Option(
                        "opt_redis",
                        "Redis",
                        "学习 Redis",
                        List.of(),
                        List.of(),
                        List.of(),
                        Map.of("benefit", 5)
                )
        ));
        oldResult.setRecommendation(
                new AnalysisResultDto.Recommendation(
                        "opt_redis",
                        "收益较高"
                )
        );
        oldResult.setNextActions(List.of("开始学习"));

        AnalysisResult entity = new AnalysisResult();
        entity.setId(40001L);
        entity.setDecisionId(20001L);
        entity.setStatus("CONFIRMED");
        entity.setResultData(objectMapper.writeValueAsString(oldResult));
        when(resultMapper.selectOne(any())).thenReturn(entity);

        DecisionCanvas canvas = new DecisionCanvas();
        canvas.setDecisionId(20001L);
        canvas.setCanvasData("""
                {
                  "nodes": [
                    {
                      "id": "f_time",
                      "type": "factor",
                      "label": "时间",
                      "position": {"x": 0, "y": 0},
                      "data": {"weight": 0.8}
                    },
                    {
                      "id": "opt_redis",
                      "type": "option",
                      "label": "Redis",
                      "position": {"x": 0, "y": 0},
                      "data": {"scores": {"benefit": 5}}
                    }
                  ],
                  "edges": []
                }
                """);
        when(canvasMapper.selectOne(any())).thenReturn(canvas);

        PartialAnalysisRequest request = new PartialAnalysisRequest();
        request.setChangedNodeIds(List.of("f_time"));

        PartialTaskVO result = service.startPartialAnalysis(
                "d_20001",
                request
        );

        assertEquals("t_30001", result.getTaskId());
        assertTrue(result.getAffectedNodeIds().contains("f_time"));
        assertEquals("PARTIAL_ANALYZING", decision.getStatus());
        ArgumentCaptor<DecisionState> stateCaptor =
                ArgumentCaptor.forClass(DecisionState.class);
        verify(workflowDispatcher).startPartialAnalysis(
                eq("t_30001"),
                eq("d_20001"),
                eq(List.of("f_time")),
                stateCaptor.capture()
        );

        // Workflow 收到的是画布中修改后的权重，不是旧结果中的 0.5
        assertEquals(0.8, stateCaptor.getValue().getFactors().get(0).getWeight());
    }

    private Decision decision(String status) {
        Decision decision = new Decision();
        decision.setId(20001L);
        decision.setUserId(100L);
        decision.setStatus(status);
        decision.setBackground("背景");
        decision.setGoal("目标");
        decision.setConstraints("约束");
        return decision;
    }

    private void prepareGeneratedIds() {
        doAnswer(invocation -> {
            AnalysisTask task = invocation.getArgument(0);
            task.setId(30001L);
            return 1;
        }).when(taskMapper).insert(any(AnalysisTask.class));

        AtomicLong stepId = new AtomicLong(1L);
        doAnswer(invocation -> {
            AnalysisStep step = invocation.getArgument(0);
            step.setId(stepId.getAndIncrement());
            return 1;
        }).when(stepMapper).insert(any(AnalysisStep.class));
    }
}
