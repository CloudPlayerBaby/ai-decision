package qg.po.midterm.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.dto.request.ConfirmDecisionRequest;
import qg.po.midterm.dto.request.CreateDecisionRequest;
import qg.po.midterm.dto.request.PartialAnalysisRequest;
import qg.po.midterm.dto.request.PreferredOptionRequest;
import qg.po.midterm.dto.request.SaveCanvasRequest;
import qg.po.midterm.dto.result.Canvas;
import qg.po.midterm.service.DecisionService;
import qg.po.midterm.vo.*;

/**
 * 决策问题接口（API v2.0 第 6、9、10 节）
 */
@RestController
@RequestMapping("/api/v1/decisions")
@RequiredArgsConstructor
public class DecisionController {

    private final DecisionService decisionService;

    // ==================== 第 6 节：决策问题 CRUD ====================

    /** 6.1 创建决策问题，成功返回 HTTP 201 */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Result<DecisionVO> create(@RequestBody CreateDecisionRequest request) {
        DecisionVO vo = decisionService.create(request);
        return Result.success(vo);
    }

    /** 6.2 分页列表，支持按状态和关键词筛选 */
    @GetMapping
    public Result<PageVO<DecisionVO>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        PageVO<DecisionVO> pageVO = decisionService.list(page, pageSize, status, keyword);
        return Result.success(pageVO);
    }

    /** 6.3 决策问题详情 */
    @GetMapping("/{decisionId}")
    public Result<DecisionDetailVO> getDetail(@PathVariable String decisionId) {
        DecisionDetailVO detail = decisionService.getDetail(decisionId);
        return Result.success(detail);
    }

    /** 6.4 删除决策问题 */
    @DeleteMapping("/{decisionId}")
    public Result<Void> delete(@PathVariable String decisionId) {
        decisionService.delete(decisionId);
        return Result.success();
    }

    // ==================== 第 9 节：结果、方案与确认 ====================

    /** 9.1 获取待确认分析结果 */
    @GetMapping("/{decisionId}/analysis-result")
    public Result<AnalysisResultVO> getAnalysisResult(
            @PathVariable String decisionId,
            @RequestParam(required = false) String resultId) {
        AnalysisResultVO vo = decisionService.getAnalysisResult(decisionId, resultId);
        return Result.success(vo);
    }

    /** 9.2 选择倾向方案（不生成报告） */
    @PutMapping("/{decisionId}/preferred-option")
    public Result<Void> setPreferredOption(
            @PathVariable String decisionId,
            @RequestBody PreferredOptionRequest request) {
        decisionService.setPreferredOption(decisionId, request);
        return Result.success();
    }

    /** 9.3 确认分析并生成报告 */
    @PostMapping("/{decisionId}/confirm")
    public Result<ConfirmResultVO> confirm(
            @PathVariable String decisionId,
            @RequestBody ConfirmDecisionRequest request) {
        ConfirmResultVO vo = decisionService.confirm(decisionId, request);
        return Result.success(vo);
    }

    // ==================== 第 10 节：画布与局部重推 ====================

    /** 10.1 获取决策画布 */
    @GetMapping("/{decisionId}/canvas")
    public Result<Canvas> getCanvas(@PathVariable String decisionId) {
        Canvas canvas = decisionService.getCanvas(decisionId);
        return Result.success(canvas);
    }

    /** 10.2 保存画布编辑，返回变更节点ID */
    @PutMapping("/{decisionId}/canvas")
    public Result<SaveCanvasVO> saveCanvas(
            @PathVariable String decisionId,
            @RequestBody SaveCanvasRequest request) {
        SaveCanvasVO vo = decisionService.saveCanvas(decisionId, request);
        return Result.success(vo);
    }

//    /** 10.3 发起局部重推 */
//    @PostMapping("/{decisionId}/partial-analysis")
//    public Result<PartialAnalysisVO> startPartialAnalysis(
//            @PathVariable String decisionId,
//            @RequestBody PartialAnalysisRequest request) {
//        PartialAnalysisVO vo = decisionService.startPartialAnalysis(decisionId, request);
//        return Result.success(vo);
//    }
}
