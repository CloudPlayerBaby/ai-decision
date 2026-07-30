package qg.po.midterm.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import qg.po.midterm.entity.AnalysisTask;

/**
 * agent_run 表的 MP Mapper。
 *
 * BaseMapper 已经提供 selectById、insert、updateById、selectCount 等方法。
 */
@Mapper
public interface AnalysisTaskMapper extends BaseMapper<AnalysisTask> {
}
