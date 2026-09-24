from __future__ import annotations

from datetime import datetime, timezone
from .ports import PORT_COORDS
from .weather import get_weather_impact


def _risk_score(wind, gust, precip, visibility_km):
    score = 0.0
    score += min(float(wind or 0) / 45.0, 1.0) * 40
    score += min(float(gust or 0) / 65.0, 1.0) * 35
    score += min(float(precip or 0) / 8.0, 1.0) * 15
    if visibility_km is not None:
        score += max(0.0, 1.0 - min(float(visibility_km) / 10.0, 1.0)) * 10
    return round(min(score, 100.0), 1)


def get_realtime_analysis(port: str):
    if port not in PORT_COORDS:
        raise ValueError(f"Unknown port: {port}")

    weather = get_weather_impact(port)
    hourly = weather.get("hourly_analysis", [])

    points = []
    for item in hourly:
        risk = _risk_score(
            item.get("wind_speed_kmh"),
            item.get("wind_gust_kmh"),
            item.get("precipitation_mm"),
            item.get("visibility_km"),
        )
        points.append({**item, "risk_score": risk})

    return {
        "port": port,
        "data_source": "Open-Meteo",
        "is_live": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "current": {
            "temperature_c": weather.get("temperature_c"),
            "wind_speed_kmh": weather.get("wind_speed_kmh"),
            "wind_gust_kmh": weather.get("wind_gust_kmh"),
            "precipitation_mm": weather.get("precipitation_mm"),
            "visibility_km": weather.get("visibility_km"),
            "severity": weather.get("severity"),
        },
        "hourly": points,
    }
