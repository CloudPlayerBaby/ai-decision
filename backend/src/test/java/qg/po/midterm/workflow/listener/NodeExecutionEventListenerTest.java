package qg.po.midterm.workflow.listener;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import qg.po.midterm.entity.AnalysisStep;
import qg.po.midterm.entity.AnalysisTask;
import qg.po.midterm.mapper.AnalysisStepMapper;
import qg.po.midterm.mapper.AnalysisTaskMapper;
import qg.po.midterm.service.AnalysisEventService;
import qg.po.midterm.workflow.event.NodeExecutionEvent;

import java.util.Collections;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NodeExecutionEventListenerTest {

    @Mock
    private AnalysisTaskMapper taskMapper;

    @Mock
    private AnalysisStepMapper stepMapper;

    @Mock
    private AnalysisEventService eventService;

    @InjectMocks
    private NodeExecutionEventListener listener;

    @Captor
    private ArgumentCaptor<AnalysisStep> stepCaptor;

    @Captor
    private ArgumentCaptor<Map<String, Object>> mapCaptor;

    private AnalysisTask mockTask;
    private AnalysisStep mockStep;

    @BeforeEach
    void setUp() {
        mockTask = new AnalysisTask();
        mockTask.setId(12345L);
        mockTask.setTotalSteps(5);
        mockTask.setStatus("WAITING");

        mockStep = new AnalysisStep();
        mockStep.setId(999L);
        mockStep.setRunId(12345L);
        mockStep.setStepName("GENERATE_OPTIONS");
        mockStep.setStatus("WAITING");
    }

    @Test
    void testHandle_RunningEvent_ShouldUpdateDbAndSendSse() {
        // Arrange
        when(taskMapper.selectById(12345L)).thenReturn(mockTask);
        // Mock stepMapper query for the specific step
        when(stepMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(mockStep);
        when(stepMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.singletonList(mockStep));

        NodeExecutionEvent event = new NodeExecutionEvent(
                this,
                "OptionGeneration",
                "d_111",
                "t_12345",
                "RUNNING"
        );

        // Act
        listener.handle(event);

        // Assert: Verify step is updated to RUNNING in DB
        verify(stepMapper).updateById(stepCaptor.capture());
        assertEquals("RUNNING", stepCaptor.getValue().getStatus());
        assertNotNull(stepCaptor.getValue().getStartedAt());

        // Assert: Verify task is updated to RUNNING in DB
        verify(taskMapper).updateById(any(AnalysisTask.class));
        assertEquals("RUNNING", mockTask.getStatus());

        // Assert: Verify SSE event is sent
        verify(eventService).sendStepUpdate(eq("t_12345"), mapCaptor.capture());
        Map<String, Object> sseData = mapCaptor.getValue();
        assertEquals("RUNNING", sseData.get("status"));
        assertEquals("s_999", sseData.get("stepId"));
    }

    @Test
    void testHandle_SucceededEventWithOutputData_ShouldSaveDataAndSendSse() {
        // Arrange
        when(taskMapper.selectById(12345L)).thenReturn(mockTask);
        when(stepMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(mockStep);
        when(stepMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.singletonList(mockStep));

        String jsonPayload = "{\"options\":[{\"name\":\"方案A\"}]}";
        NodeExecutionEvent event = new NodeExecutionEvent(
                this,
                "OptionGeneration",
                "d_111",
                "t_12345",
                "SUCCEEDED",
                null,
                jsonPayload
        );

        // Act
        listener.handle(event);

        // Assert: Verify DB update contains outputData
        verify(stepMapper).updateById(stepCaptor.capture());
        AnalysisStep updatedStep = stepCaptor.getValue();
        assertEquals("SUCCEEDED", updatedStep.getStatus());
        assertEquals(jsonPayload, updatedStep.getOutputData(), "数据库必须成功落入 outputData 载荷");

        // Assert: Verify SSE event payload contains the AI output
        verify(eventService).sendStepUpdate(eq("t_12345"), mapCaptor.capture());
        Map<String, Object> sseData = mapCaptor.getValue();
        assertEquals("SUCCEEDED", sseData.get("status"));
        assertEquals(jsonPayload, sseData.get("content"), "SSE 数据中必须包含 content 字段传给前端");
    }

    @Test
    void testHandle_FailedEvent_ShouldTriggerTaskFailedSse() {
        // Arrange
        when(taskMapper.selectById(12345L)).thenReturn(mockTask);
        when(stepMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(mockStep);

        NodeExecutionEvent event = new NodeExecutionEvent(
                this,
                "OptionGeneration",
                "d_111",
                "t_12345",
                "FAILED",
                "大模型生成超时",
                null
        );

        // Act
        listener.handle(event);

        // Assert DB Updates
        verify(stepMapper).updateById(stepCaptor.capture());
        assertEquals("FAILED", stepCaptor.getValue().getStatus());
        assertEquals("大模型生成超时", stepCaptor.getValue().getErrorMessage());

        // Assert Event Sent
        verify(eventService).sendTaskFailed(eq("t_12345"), mapCaptor.capture());
        Map<String, Object> sseData = mapCaptor.getValue();
        assertEquals("大模型生成超时", sseData.get("message"));
    }
}
