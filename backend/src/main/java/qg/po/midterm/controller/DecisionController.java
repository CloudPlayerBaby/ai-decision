package qg.po.midterm.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.dto.request.CreateDecisionRequest;
import qg.po.midterm.service.DecisionService;
import qg.po.midterm.vo.DecisionDetailVO;
import qg.po.midterm.vo.DecisionVO;
import qg.po.midterm.vo.PageVO;

/**
 * 决策问题接口（API v2.0 第 6 节）
 */
@RestController
@RequestMapping("/api/v1/decisions")
@RequiredArgsConstructor
public class DecisionController {

    private final DecisionService decisionService;

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
}
