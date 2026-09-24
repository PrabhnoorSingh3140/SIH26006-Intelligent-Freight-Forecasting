import requests

from .ports import PORT_COORDS

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def get_weather_impact(port: str):
    if port not in PORT_COORDS:
        raise ValueError(f"Unknown port: {port}")

    latitude, longitude = PORT_COORDS[port]
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "temperature_2m,relative_humidity_2m,precipitation,weather_code,"
            "wind_speed_10m,wind_direction_10m,wind_gusts_10m"
        ),
        "hourly": (
            "visibility,wave_height,wind_speed_10m,wind_gusts_10m,precipitation"
        ),
        "forecast_days": 1,
        "wind_speed_unit": "kmh",
        "timezone": "auto",
        "cell_selection": "sea",
    }

    response = requests.get(OPEN_METEO_URL, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()

    current = data.get("current", {})
    hourly = data.get("hourly", {})

    wind_speed = current.get("wind_speed_10m", 0) or 0
    wind_gust = current.get("wind_gusts_10m", 0) or 0

    if wind_gust >= 50 or wind_speed >= 40:
        severity = "HIGH"
        weather_risk = "HIGH"
        operational_impact = "Strong winds may cause vessel handling delays."
        estimated_delay = "6–12 hours"
    elif wind_gust >= 30 or wind_speed >= 25:
        severity = "MEDIUM"
        weather_risk = "MEDIUM"
        operational_impact = "Moderate wind conditions may affect operations."
        estimated_delay = "2–6 hours"
    else:
        severity = "LOW"
        weather_risk = "LOW"
        operational_impact = "Low expected weather disruption."
        estimated_delay = "0–2 hours"

    visibility = None
    visibility_values = [v for v in hourly.get("visibility", []) if v is not None]
    if visibility_values:
        visibility = round(visibility_values[0] / 1000, 1)

    times = hourly.get("time", [])
    hourly_analysis = []
    length = min(len(times), 24)
    for i in range(length):
        vis = hourly.get("visibility", [None] * length)[i]
        hourly_analysis.append({
            "time": times[i],
            "wind_speed_kmh": hourly.get("wind_speed_10m", [None] * length)[i],
            "wind_gust_kmh": hourly.get("wind_gusts_10m", [None] * length)[i],
            "precipitation_mm": hourly.get("precipitation", [None] * length)[i],
            "wave_height_m": hourly.get("wave_height", [None] * length)[i],
            "visibility_km": round(vis / 1000, 1) if vis is not None else None,
        })

    return {
        "port": port,
        "data_source": "Open-Meteo",
        "is_live": True,
        "latitude": latitude,
        "longitude": longitude,
        "temperature_c": current.get("temperature_2m"),
        "apparent_temperature_c": current.get("apparent_temperature"),
        "humidity_percent": current.get("relative_humidity_2m"),
        "precipitation_mm": current.get("precipitation"),
        "weather_code": current.get("weather_code"),
        "wind_speed_kmh": wind_speed,
        "wind_direction": current.get("wind_direction_10m"),
        "wind_gust_kmh": wind_gust,
        "visibility_km": visibility,
        "severity": severity,
        "weather_risk": weather_risk,
        "operational_impact": operational_impact,
        "estimated_delay": estimated_delay,
        "hourly_analysis": hourly_analysis,
    }
