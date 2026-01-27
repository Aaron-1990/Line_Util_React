"""
Changeover calculation method implementations.
"""

from typing import Dict, List, Optional, Any
from .base import (
    ChangeoverMethod,
    ChangeoverInput,
    ChangeoverResult,
    ModelInfo,
    TransitionAnalysis,
)


class ProbabilityWeightedMethod(ChangeoverMethod):
    """
    Probability-weighted changeover calculation.

    Uses the demand mix to weight changeover times by the probability
    of each transition occurring. This is the recommended default method.

    Formula:
        Expected_per_changeover = Σ P[i] × P[j] × Time[i,j] / (1 - HHI)

    Where:
        P[i] = proportion of demand for model i
        HHI = Herfindahl-Hirschman Index (Σ P[i]²)
        Time[i,j] = changeover time from model i to model j

    The (1 - HHI) normalization accounts for:
        - Same-model transitions (no changeover)
        - High concentration (fewer different-model transitions)
    """

    @property
    def id(self) -> str:
        return 'probability_weighted'

    @property
    def name(self) -> str:
        return 'Probability-Weighted Heuristic'

    @property
    def description(self) -> str:
        return (
            'Weights changeover times by the probability of each transition, '
            'based on demand proportions. Accounts for model mix concentration.'
        )

    def calculate(
        self,
        input_data: ChangeoverInput,
        config: Optional[Dict[str, Any]] = None
    ) -> ChangeoverResult:
        """
        Calculate probability-weighted expected changeover time.
        """
        config = config or {}
        min_models_for_probability = config.get('minModelsForProbability', 2)

        warnings: List[str] = []
        models = input_data.models
        changeover_matrix = input_data.changeover_matrix
        num_changeovers = input_data.num_changeovers_per_day

        # Edge case: no models or single model
        if len(models) < min_models_for_probability:
            warnings.append(f"Less than {min_models_for_probability} models - no changeover needed")
            return self._build_result(
                input_data=input_data,
                time_used_changeover=0,
                expected_changeover_time=0,
                transitions=[],
                warnings=warnings
            )

        # Calculate demand proportions
        total_demand = sum(m.allocated_units_daily for m in models)
        if total_demand <= 0:
            warnings.append("No allocated demand - cannot calculate proportions")
            return self._build_result(
                input_data=input_data,
                time_used_changeover=0,
                expected_changeover_time=0,
                transitions=[],
                warnings=warnings
            )

        proportions: Dict[str, float] = {}
        for model in models:
            proportions[model.model_id] = model.allocated_units_daily / total_demand

        # Calculate HHI
        hhi = sum(p ** 2 for p in proportions.values())

        # Calculate weighted sum of transition probabilities × changeover times
        weighted_sum = 0.0
        transitions: List[TransitionAnalysis] = []

        for from_model in models:
            for to_model in models:
                if from_model.model_id == to_model.model_id:
                    continue  # Skip same-model (no changeover)

                key = (from_model.model_id, to_model.model_id)
                changeover_minutes = changeover_matrix.get(key, 0)

                p_from = proportions[from_model.model_id]
                p_to = proportions[to_model.model_id]
                probability = p_from * p_to
                contribution = probability * changeover_minutes

                weighted_sum += contribution

                transitions.append(TransitionAnalysis(
                    from_model_id=from_model.model_id,
                    from_model_name=from_model.model_name,
                    to_model_id=to_model.model_id,
                    to_model_name=to_model.model_name,
                    changeover_minutes=changeover_minutes,
                    probability=round(probability, 6),
                    weighted_contribution=round(contribution, 4),
                    percent_of_total=0  # Calculated below
                ))

        # Normalize by (1 - HHI) to account for same-model transitions
        normalization = 1 - hhi
        if normalization <= 0.01:
            # Nearly all demand is one model - minimal changeover
            expected_per_changeover_minutes = 0
            warnings.append("HHI >= 0.99: production dominated by single model")
        else:
            expected_per_changeover_minutes = weighted_sum / normalization

        # Calculate percent of total for each transition
        total_contribution = sum(t.weighted_contribution for t in transitions)
        if total_contribution > 0:
            for t in transitions:
                t.percent_of_total = round((t.weighted_contribution / total_contribution) * 100, 2)

        # Sort transitions by weighted contribution (descending)
        transitions.sort(key=lambda t: -t.weighted_contribution)

        # Convert to seconds and calculate total changeover time
        expected_per_changeover_seconds = expected_per_changeover_minutes * 60
        total_changeover_seconds = expected_per_changeover_seconds * num_changeovers

        return self._build_result(
            input_data=input_data,
            time_used_changeover=total_changeover_seconds,
            expected_changeover_time=expected_per_changeover_seconds,
            transitions=transitions,
            warnings=warnings
        )


class SimpleAverageMethod(ChangeoverMethod):
    """
    Simple average changeover calculation.

    Uses the arithmetic mean of all changeover times in the matrix.
    This is a fallback method when probability data is unavailable.

    Formula:
        Average = Σ Time[i,j] / N

    Where N is the number of non-diagonal cells in the matrix.
    """

    @property
    def id(self) -> str:
        return 'simple_average'

    @property
    def name(self) -> str:
        return 'Simple Average'

    @property
    def description(self) -> str:
        return (
            'Uses the arithmetic mean of all changeover times. '
            'Simpler but does not account for demand mix.'
        )

    def calculate(
        self,
        input_data: ChangeoverInput,
        config: Optional[Dict[str, Any]] = None
    ) -> ChangeoverResult:
        """
        Calculate simple average changeover time.
        """
        warnings: List[str] = []
        models = input_data.models
        changeover_matrix = input_data.changeover_matrix
        num_changeovers = input_data.num_changeovers_per_day

        # Edge case: no models or single model
        if len(models) < 2:
            warnings.append("Less than 2 models - no changeover needed")
            return self._build_result(
                input_data=input_data,
                time_used_changeover=0,
                expected_changeover_time=0,
                transitions=[],
                warnings=warnings
            )

        # Calculate average of all non-diagonal changeover times
        total_time = 0.0
        count = 0
        transitions: List[TransitionAnalysis] = []

        for from_model in models:
            for to_model in models:
                if from_model.model_id == to_model.model_id:
                    continue

                key = (from_model.model_id, to_model.model_id)
                changeover_minutes = changeover_matrix.get(key, 0)

                total_time += changeover_minutes
                count += 1

                # For simple average, probability is uniform
                n_models = len(models)
                uniform_prob = 1 / (n_models * (n_models - 1)) if n_models > 1 else 0

                transitions.append(TransitionAnalysis(
                    from_model_id=from_model.model_id,
                    from_model_name=from_model.model_name,
                    to_model_id=to_model.model_id,
                    to_model_name=to_model.model_name,
                    changeover_minutes=changeover_minutes,
                    probability=round(uniform_prob, 6),
                    weighted_contribution=round(changeover_minutes * uniform_prob, 4),
                    percent_of_total=0
                ))

        average_minutes = total_time / count if count > 0 else 0

        # Calculate percent of total
        total_contribution = sum(t.changeover_minutes for t in transitions)
        if total_contribution > 0:
            for t in transitions:
                t.percent_of_total = round((t.changeover_minutes / total_contribution) * 100, 2)

        # Sort by changeover time (descending)
        transitions.sort(key=lambda t: -t.changeover_minutes)

        # Convert to seconds
        average_seconds = average_minutes * 60
        total_changeover_seconds = average_seconds * num_changeovers

        return self._build_result(
            input_data=input_data,
            time_used_changeover=total_changeover_seconds,
            expected_changeover_time=average_seconds,
            transitions=transitions,
            warnings=warnings
        )


class WorstCaseMethod(ChangeoverMethod):
    """
    Worst-case (conservative) changeover calculation.

    Uses the maximum changeover time from the matrix for all transitions.
    This is useful for risk analysis and capacity planning buffers.

    Formula:
        Worst_case = max(Time[i,j]) for all i,j where i != j
    """

    @property
    def id(self) -> str:
        return 'worst_case'

    @property
    def name(self) -> str:
        return 'Worst Case (Conservative)'

    @property
    def description(self) -> str:
        return (
            'Uses the maximum changeover time for all transitions. '
            'Conservative estimate for risk analysis.'
        )

    def calculate(
        self,
        input_data: ChangeoverInput,
        config: Optional[Dict[str, Any]] = None
    ) -> ChangeoverResult:
        """
        Calculate worst-case changeover time.
        """
        warnings: List[str] = []
        models = input_data.models
        changeover_matrix = input_data.changeover_matrix
        num_changeovers = input_data.num_changeovers_per_day

        # Edge case: no models or single model
        if len(models) < 2:
            warnings.append("Less than 2 models - no changeover needed")
            return self._build_result(
                input_data=input_data,
                time_used_changeover=0,
                expected_changeover_time=0,
                transitions=[],
                warnings=warnings
            )

        # Find maximum changeover time
        max_changeover_minutes = 0.0
        max_transition = None
        transitions: List[TransitionAnalysis] = []

        for from_model in models:
            for to_model in models:
                if from_model.model_id == to_model.model_id:
                    continue

                key = (from_model.model_id, to_model.model_id)
                changeover_minutes = changeover_matrix.get(key, 0)

                if changeover_minutes > max_changeover_minutes:
                    max_changeover_minutes = changeover_minutes
                    max_transition = (from_model, to_model)

                transitions.append(TransitionAnalysis(
                    from_model_id=from_model.model_id,
                    from_model_name=from_model.model_name,
                    to_model_id=to_model.model_id,
                    to_model_name=to_model.model_name,
                    changeover_minutes=changeover_minutes,
                    probability=1.0 if changeover_minutes == max_changeover_minutes else 0.0,
                    weighted_contribution=changeover_minutes,
                    percent_of_total=0
                ))

        # Calculate percent of total (relative to max)
        if max_changeover_minutes > 0:
            for t in transitions:
                t.percent_of_total = round((t.changeover_minutes / max_changeover_minutes) * 100, 2)

        # Sort by changeover time (descending)
        transitions.sort(key=lambda t: -t.changeover_minutes)

        warnings.append(
            f"Using worst-case: {max_changeover_minutes:.1f} min "
            f"({max_transition[0].model_name} -> {max_transition[1].model_name})"
            if max_transition else "No transitions found"
        )

        # Convert to seconds
        max_seconds = max_changeover_minutes * 60
        total_changeover_seconds = max_seconds * num_changeovers

        return self._build_result(
            input_data=input_data,
            time_used_changeover=total_changeover_seconds,
            expected_changeover_time=max_seconds,
            transitions=transitions,
            warnings=warnings
        )


class TSPOptimalMethod(ChangeoverMethod):
    """
    TSP-based optimal sequence calculation.

    Uses Traveling Salesman Problem algorithms to find the optimal
    production sequence that minimizes total changeover time.

    NOTE: This method is NOT YET IMPLEMENTED.
    """

    @property
    def id(self) -> str:
        return 'tsp_optimal'

    @property
    def name(self) -> str:
        return 'TSP Optimal Sequence'

    @property
    def description(self) -> str:
        return (
            'Finds the optimal production sequence using TSP algorithms. '
            'Minimizes total changeover by optimizing model order.'
        )

    @property
    def implemented(self) -> bool:
        return False  # Not yet implemented

    def calculate(
        self,
        input_data: ChangeoverInput,
        config: Optional[Dict[str, Any]] = None
    ) -> ChangeoverResult:
        """
        Calculate TSP-optimal changeover time.

        NOT YET IMPLEMENTED - raises NotImplementedError
        """
        raise NotImplementedError(
            "TSP Optimal method is planned for a future release. "
            "Use 'probability_weighted' or 'simple_average' instead."
        )
