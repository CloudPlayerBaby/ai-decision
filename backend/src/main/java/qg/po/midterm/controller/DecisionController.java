package qg.po.midterm.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import qg.po.midterm.common.result.Result;
import qg.po.midterm.dto.request.CreateDecisionRequest;
import qg.po.midterm.service.DecisionService;
import qg.po.midterm.vo.DecisionVO;

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
}
