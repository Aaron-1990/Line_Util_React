"""
Registry for changeover calculation methods.
Implements the Strategy Pattern method selection.
"""

from typing import Dict, List, Optional, Any
from .base import ChangeoverMethod, ChangeoverInput, ChangeoverResult


class ChangeoverMethodRegistry:
    """
    Registry for changeover calculation methods.

    Allows registration, lookup, and invocation of calculation methods
    by their unique ID.
    """

    def __init__(self):
        self._methods: Dict[str, ChangeoverMethod] = {}

    def register(self, method: ChangeoverMethod) -> None:
        """
        Register a calculation method.

        Args:
            method: The method instance to register
        """
        self._methods[method.id] = method

    def get(self, method_id: str) -> Optional[ChangeoverMethod]:
        """
        Get a method by its ID.

        Args:
            method_id: The unique identifier of the method

        Returns:
            The method instance, or None if not found
        """
        return self._methods.get(method_id)

    def list_methods(self) -> List[Dict[str, Any]]:
        """
        List all registered methods with their metadata.

        Returns:
            List of method metadata dictionaries
        """
        return [
            {
                'id': m.id,
                'name': m.name,
                'description': m.description,
                'implemented': m.implemented,
                'requiresHistoricalData': m.requires_historical_data,
            }
            for m in self._methods.values()
        ]

    def list_implemented(self) -> List[str]:
        """
        List IDs of all implemented methods.

        Returns:
            List of method IDs that are implemented
        """
        return [
            m.id for m in self._methods.values()
            if m.implemented
        ]

    def calculate(
        self,
        method_id: str,
        input_data: ChangeoverInput,
        config: Optional[Dict[str, Any]] = None
    ) -> ChangeoverResult:
        """
        Calculate changeover using the specified method.

        Args:
            method_id: ID of the method to use
            input_data: Input data for calculation
            config: Optional method-specific configuration

        Returns:
            ChangeoverResult with calculated metrics

        Raises:
            ValueError: If method_id is not found or not implemented
        """
        method = self.get(method_id)

        if method is None:
            raise ValueError(f"Unknown changeover method: {method_id}")

        if not method.implemented:
            raise ValueError(f"Changeover method not implemented: {method_id}")

        return method.calculate(input_data, config)

    def calculate_with_fallback(
        self,
        preferred_method_id: str,
        input_data: ChangeoverInput,
        config: Optional[Dict[str, Any]] = None,
        fallback_method_id: str = 'simple_average'
    ) -> ChangeoverResult:
        """
        Calculate changeover, falling back to another method if preferred fails.

        Args:
            preferred_method_id: ID of the preferred method
            input_data: Input data for calculation
            config: Optional method-specific configuration
            fallback_method_id: ID of the fallback method

        Returns:
            ChangeoverResult with calculated metrics
        """
        try:
            return self.calculate(preferred_method_id, input_data, config)
        except (ValueError, Exception) as e:
            print(f"Warning: {preferred_method_id} failed ({e}), using {fallback_method_id}")
            return self.calculate(fallback_method_id, input_data, config)
