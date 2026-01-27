"""
Base classes for changeover time calculation.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class ModelInfo:
    """Information about a model assigned to a line"""
    model_id: str
    model_name: str
    family: str
    allocated_units_daily: float
    demand_units_daily: float


@dataclass
class TransitionAnalysis:
    """Analysis of a single transition for SMED prioritization"""
    from_model_id: str
    from_model_name: str
    to_model_id: str
    to_model_name: str
    changeover_minutes: float
    probability: float  # P[from] * P[to]
    weighted_contribution: float  # probability * changeover_minutes
    percent_of_total: float  # contribution / sum of all contributions


@dataclass
class ChangeoverInput:
    """
    Input data for changeover calculation.

    Attributes:
        line_id: The production line ID
        line_name: The production line name
        area: The manufacturing area
        models: List of models assigned to this line (with allocated units)
        changeover_matrix: Dict mapping (from_model_id, to_model_id) -> minutes
        num_changeovers_per_day: Estimated number of changeovers per day
        time_available_daily: Available production time in seconds
    """
    line_id: str
    line_name: str
    area: str
    models: List[ModelInfo]
    changeover_matrix: Dict[tuple, float]  # {(from_id, to_id): minutes}
    num_changeovers_per_day: int
    time_available_daily: float  # seconds


@dataclass
class ChangeoverResult:
    """
    Result of changeover time calculation.

    Attributes:
        line_id: The production line ID
        line_name: The production line name
        area: The manufacturing area
        method_used: ID of the calculation method used

        time_used_production: Seconds used for actual production
        time_used_changeover: Seconds used for changeovers
        total_time_used: Production + Changeover
        time_available: Total available time

        utilization_production_only: % without changeover
        utilization_with_changeover: % including changeover
        changeover_impact_percent: Percentage points lost to changeover

        estimated_changeover_count: Number of changeovers per day
        expected_changeover_time: Expected time per changeover (method-dependent)
        worst_case_changeover_time: Maximum changeover in matrix

        top_costly_transitions: Top transitions by weighted contribution
        hhi: Herfindahl-Hirschman Index (concentration)
        warnings: Any warnings generated during calculation
    """
    line_id: str
    line_name: str
    area: str
    method_used: str

    # Time breakdown
    time_used_production: float
    time_used_changeover: float
    total_time_used: float
    time_available: float

    # Utilization metrics
    utilization_production_only: float
    utilization_with_changeover: float
    changeover_impact_percent: float

    # Changeover details
    estimated_changeover_count: int
    expected_changeover_time: float  # seconds
    worst_case_changeover_time: float  # seconds

    # SMED Analysis
    top_costly_transitions: List[TransitionAnalysis] = field(default_factory=list)
    hhi: float = 0.0

    # Warnings
    warnings: List[str] = field(default_factory=list)


class ChangeoverMethod(ABC):
    """
    Abstract base class for changeover calculation methods.

    Implements the Strategy Pattern - each method is a separate implementation
    that can be swapped without changing the calling code.
    """

    @property
    @abstractmethod
    def id(self) -> str:
        """Unique identifier for this method"""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Description of how this method works"""
        pass

    @property
    def implemented(self) -> bool:
        """Whether this method is implemented"""
        return True

    @property
    def requires_historical_data(self) -> bool:
        """Whether this method requires historical production data"""
        return False

    @abstractmethod
    def calculate(
        self,
        input_data: ChangeoverInput,
        config: Optional[Dict[str, Any]] = None
    ) -> ChangeoverResult:
        """
        Calculate changeover time loss for a production line.

        Args:
            input_data: Input data with models, matrix, and configuration
            config: Optional method-specific configuration

        Returns:
            ChangeoverResult with all calculated metrics
        """
        pass

    def _calculate_hhi(self, models: List[ModelInfo]) -> float:
        """
        Calculate Herfindahl-Hirschman Index (concentration).

        HHI = Σ P[i]² where P[i] is the proportion of demand for model i.

        - HHI close to 0 = many models with similar demand (diverse mix)
        - HHI close to 1 = dominated by one model (concentrated)
        """
        total_demand = sum(m.allocated_units_daily for m in models)
        if total_demand <= 0:
            return 0.0

        hhi = 0.0
        for model in models:
            proportion = model.allocated_units_daily / total_demand
            hhi += proportion ** 2

        return hhi

    def _get_worst_case_changeover(
        self,
        models: List[ModelInfo],
        changeover_matrix: Dict[tuple, float]
    ) -> float:
        """Get the maximum changeover time from the matrix"""
        max_changeover = 0.0
        for from_model in models:
            for to_model in models:
                if from_model.model_id != to_model.model_id:
                    key = (from_model.model_id, to_model.model_id)
                    changeover = changeover_matrix.get(key, 0)
                    max_changeover = max(max_changeover, changeover)
        return max_changeover

    def _build_result(
        self,
        input_data: ChangeoverInput,
        time_used_changeover: float,
        expected_changeover_time: float,
        transitions: List[TransitionAnalysis],
        warnings: List[str]
    ) -> ChangeoverResult:
        """
        Build a standardized ChangeoverResult.

        This helper method ensures consistent result formatting across methods.
        """
        # Calculate production time (assume this is passed separately or calculated)
        # For now, we'll use a simple estimate based on time available
        time_used_production = input_data.time_available_daily - time_used_changeover
        if time_used_production < 0:
            time_used_production = 0
            warnings.append("Changeover time exceeds available time")

        total_time_used = time_used_production + time_used_changeover

        # Calculate utilization percentages
        util_production = (time_used_production / input_data.time_available_daily * 100) \
            if input_data.time_available_daily > 0 else 0

        util_with_changeover = (total_time_used / input_data.time_available_daily * 100) \
            if input_data.time_available_daily > 0 else 0

        impact_percent = util_production - util_with_changeover if util_with_changeover < util_production else 0

        # Calculate HHI
        hhi = self._calculate_hhi(input_data.models)

        # Get worst case
        worst_case = self._get_worst_case_changeover(
            input_data.models,
            input_data.changeover_matrix
        )

        return ChangeoverResult(
            line_id=input_data.line_id,
            line_name=input_data.line_name,
            area=input_data.area,
            method_used=self.id,

            time_used_production=round(time_used_production, 2),
            time_used_changeover=round(time_used_changeover, 2),
            total_time_used=round(total_time_used, 2),
            time_available=input_data.time_available_daily,

            utilization_production_only=round(util_production, 2),
            utilization_with_changeover=round(util_with_changeover, 2),
            changeover_impact_percent=round(impact_percent, 2),

            estimated_changeover_count=input_data.num_changeovers_per_day,
            expected_changeover_time=round(expected_changeover_time, 2),
            worst_case_changeover_time=round(worst_case * 60, 2),  # Convert to seconds

            top_costly_transitions=transitions[:10],  # Top 10
            hhi=round(hhi, 4),
            warnings=warnings
        )
