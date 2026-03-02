"""Rate limiter for Gemini API calls.

Implements a token-bucket style limiter that enforces a minimum delay between
calls and respects Gemini's RPM (requests per minute) quota.
"""

from __future__ import annotations

import asyncio
import logging
import time

logger = logging.getLogger(__name__)


class RateLimiter:
    """Async rate limiter that enforces minimum delay between calls."""

    def __init__(self, rpm_limit: int = 10, min_delay: float = 6.5):
        self._rpm_limit = rpm_limit
        self._min_delay = min_delay
        self._lock = asyncio.Lock()
        self._last_call_time: float = 0.0
        self._calls_this_minute: list[float] = []

    async def acquire(self) -> None:
        """Wait until it's safe to make the next API call."""
        async with self._lock:
            now = time.monotonic()

            # Clean calls older than 60s
            self._calls_this_minute = [
                t for t in self._calls_this_minute if now - t < 60.0
            ]

            # If we've hit the RPM limit, wait until the oldest call expires
            if len(self._calls_this_minute) >= self._rpm_limit:
                oldest = self._calls_this_minute[0]
                wait_time = 60.0 - (now - oldest) + 1.0  # +1s safety margin
                if wait_time > 0:
                    logger.info(f"RPM limit reached, waiting {wait_time:.1f}s")
                    await asyncio.sleep(wait_time)

            # Enforce minimum delay between calls
            elapsed = time.monotonic() - self._last_call_time
            if elapsed < self._min_delay:
                wait_time = self._min_delay - elapsed
                logger.debug(f"Rate limiter: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

            self._last_call_time = time.monotonic()
            self._calls_this_minute.append(self._last_call_time)
