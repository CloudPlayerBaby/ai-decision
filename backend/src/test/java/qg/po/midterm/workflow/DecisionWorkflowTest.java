package qg.po.midterm.workflow;

import org.junit.jupiter.api.Test;
import qg.po.midterm.workflow.node.FactorAnalysisNode;
import qg.po.midterm.workflow.node.FactorEnrichmentNode;
import qg.po.midterm.workflow.node.OptionEnrichmentNode;
import qg.po.midterm.workflow.node.OptionGenerationNode;
import qg.po.midterm.workflow.node.OptionReevaluationNode;
import qg.po.midterm.workflow.node.RepairNode;
import qg.po.midterm.workflow.node.RequirementAnalysisNode;
import qg.po.midterm.workflow.node.RiskAnalysisNode;
import qg.po.midterm.workflow.node.ValidateNode;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DecisionWorkflowTest {

    @Test
    void routesNewOptionThroughEnrichmentThenComparison() throws Exception {
        RequirementAnalysisNode requirement = mock(RequirementAnalysisNode.class);
        FactorAnalysisNode factor = mock(FactorAnalysisNode.class);
        FactorEnrichmentNode factorEnrichment = mock(FactorEnrichmentNode.class);
        OptionGenerationNode generation = mock(OptionGenerationNode.class);
        OptionReevaluationNode reevaluation = mock(OptionReevaluationNode.class);
        OptionEnrichmentNode enrichment = mock(OptionEnrichmentNode.class);
        RiskAnalysisNode comparison = mock(RiskAnalysisNode.class);
        RepairNode repair = mock(RepairNode.class);
        ValidateNode validate = mock(ValidateNode.class);

        when(enrichment.apply(any())).thenReturn(Map.of());
        when(comparison.apply(any())).thenReturn(Map.of());
        when(validate.apply(any())).thenReturn(Map.of());

        DecisionWorkflow workflow = new DecisionWorkflow(
                requirement, factor, factorEnrichment, generation, reevaluation, enrichment, comparison, repair, validate);
        workflow.init();

        workflow.getGraph().invoke(Map.of("startNode", "ENRICH_OPTIONS"));

        verify(enrichment).apply(any());
        verify(comparison).apply(any());
        verify(validate).apply(any());
        verify(generation, never()).apply(any());
        verify(requirement, never()).apply(any());
        verify(factor, never()).apply(any());
        verify(factorEnrichment, never()).apply(any());
    }

    @Test
    void routesFactorChangesThroughReevaluationThenComparison() throws Exception {
        RequirementAnalysisNode requirement = mock(RequirementAnalysisNode.class);
        FactorAnalysisNode factor = mock(FactorAnalysisNode.class);
        FactorEnrichmentNode factorEnrichment = mock(FactorEnrichmentNode.class);
        OptionGenerationNode generation = mock(OptionGenerationNode.class);
        OptionReevaluationNode reevaluation = mock(OptionReevaluationNode.class);
        OptionEnrichmentNode enrichment = mock(OptionEnrichmentNode.class);
        RiskAnalysisNode comparison = mock(RiskAnalysisNode.class);
        RepairNode repair = mock(RepairNode.class);
        ValidateNode validate = mock(ValidateNode.class);

        when(reevaluation.apply(any())).thenReturn(Map.of());
        when(comparison.apply(any())).thenReturn(Map.of());
        when(validate.apply(any())).thenReturn(Map.of());

        DecisionWorkflow workflow = new DecisionWorkflow(
                requirement, factor, factorEnrichment, generation, reevaluation, enrichment, comparison, repair, validate);
        workflow.init();

        workflow.getGraph().invoke(Map.of("startNode", "REEVALUATE_OPTIONS"));

        verify(reevaluation).apply(any());
        verify(comparison).apply(any());
        verify(validate).apply(any());
        verify(generation, never()).apply(any());
        verify(enrichment, never()).apply(any());
        verify(factorEnrichment, never()).apply(any());
    }

    @Test
    void routesNewFactorThroughEnrichmentThenReevaluationThenComparison() throws Exception {
        RequirementAnalysisNode requirement = mock(RequirementAnalysisNode.class);
        FactorAnalysisNode factor = mock(FactorAnalysisNode.class);
        FactorEnrichmentNode factorEnrichment = mock(FactorEnrichmentNode.class);
        OptionGenerationNode generation = mock(OptionGenerationNode.class);
        OptionReevaluationNode reevaluation = mock(OptionReevaluationNode.class);
        OptionEnrichmentNode enrichment = mock(OptionEnrichmentNode.class);
        RiskAnalysisNode comparison = mock(RiskAnalysisNode.class);
        RepairNode repair = mock(RepairNode.class);
        ValidateNode validate = mock(ValidateNode.class);

        when(factorEnrichment.apply(any())).thenReturn(Map.of());
        when(reevaluation.apply(any())).thenReturn(Map.of());
        when(comparison.apply(any())).thenReturn(Map.of());
        when(validate.apply(any())).thenReturn(Map.of());

        DecisionWorkflow workflow = new DecisionWorkflow(
                requirement, factor, factorEnrichment, generation, reevaluation, enrichment, comparison, repair, validate);
        workflow.init();

        workflow.getGraph().invoke(Map.of("startNode", "ENRICH_FACTORS"));

        verify(factorEnrichment).apply(any());
        verify(reevaluation).apply(any());
        verify(comparison).apply(any());
        verify(validate).apply(any());
        verify(requirement, never()).apply(any());
        verify(factor, never()).apply(any());
        verify(generation, never()).apply(any());
        verify(enrichment, never()).apply(any());
    }
}
