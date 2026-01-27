"""
Changeover Time Calculation Module
Phase 5: Model Changeover Matrix

This module provides a Strategy Pattern implementation for calculating
changeover time loss based on model mix and changeover times.
"""

from .base import ChangeoverMethod, ChangeoverInput, ChangeoverResult, ModelInfo, TransitionAnalysis
from .registry import ChangeoverMethodRegistry
from .methods import (
    ProbabilityWeightedMethod,
    SimpleAverageMethod,
    WorstCaseMethod,
)

# Default registry with all implemented methods
registry = ChangeoverMethodRegistry()
registry.register(ProbabilityWeightedMethod())
registry.register(SimpleAverageMethod())
registry.register(WorstCaseMethod())

__all__ = [
    'ChangeoverMethod',
    'ChangeoverInput',
    'ChangeoverResult',
    'ModelInfo',
    'TransitionAnalysis',
    'ChangeoverMethodRegistry',
    'ProbabilityWeightedMethod',
    'SimpleAverageMethod',
    'WorstCaseMethod',
    'registry',
]
