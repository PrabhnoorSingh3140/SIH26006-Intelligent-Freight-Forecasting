from datetime import datetime
import random

# ---------------------------------------------------------
# SIMULATED PORT CONGESTION DATA
# ---------------------------------------------------------
# This is DEMO/SIMULATED data for the SIH prototype.
# It is NOT live AIS data.

PORT_CONGESTION = {
    "Paradip": {
        "congestion_level": "MEDIUM",
        "vessels_waiting": 8,
        "queue_days": 1.4,
        "turnaround_days": 2.8,
        "weather_delay_factor": 1.1,
    },

    "Dhamra": {
        "congestion_level": "LOW",
        "vessels_waiting": 4,
        "queue_days": 0.7,
        "turnaround_days": 2.1,
        "weather_delay_factor": 1.0,
    },

    "Haldia": {
        "congestion_level": "HIGH",
        "vessels_waiting": 14,
        "queue_days": 2.8,
        "turnaround_days": 4.2,
        "weather_delay_factor": 1.2,
    },

    "Chennai": {
        "congestion_level": "MEDIUM",
        "vessels_waiting": 10,
        "queue_days": 1.8,
        "turnaround_days": 3.4,
        "weather_delay_factor": 1.1,
    },

    "Visakhapatnam": {
        "congestion_level": "LOW",
        "vessels_waiting": 5,
        "queue_days": 0.8,
        "turnaround_days": 2.4,
        "weather_delay_factor": 1.0,
    },

    "Kolkata": {
        "congestion_level": "HIGH",
        "vessels_waiting": 16,
        "queue_days": 3.2,
        "turnaround_days": 4.8,
        "weather_delay_factor": 1.2,
    },

    "Mundra": {
        "congestion_level": "MEDIUM",
        "vessels_waiting": 9,
        "queue_days": 1.5,
        "turnaround_days": 3.0,
        "weather_delay_factor": 1.1,
    },

    "Kandla": {
        "congestion_level": "LOW",
        "vessels_waiting": 6,
        "queue_days": 1.0,
        "turnaround_days": 2.5,
        "weather_delay_factor": 1.0,
    },
}


def get_congestion_impact(port: str):

    # -----------------------------------------------------
    # Validate port
    # -----------------------------------------------------
    if port not in PORT_CONGESTION:
        return {
            "port": port,
            "data_source": "SIMULATED DEMO DATA",
            "is_live": False,
            "congestion_level": "UNKNOWN",
            "vessels_waiting": 0,
            "queue_days": 0,
            "turnaround_days": 0,
            "expected_waiting": "Unknown",
            "weather_delay_factor": 1.0,
            "congestion_risk": "UNKNOWN",
            "operational_impact": "No simulated congestion data available.",
        }

    data = PORT_CONGESTION[port]

    # -----------------------------------------------------
    # Risk calculation
    # -----------------------------------------------------
    if data["congestion_level"] == "HIGH":
        congestion_risk = "HIGH"

    elif data["congestion_level"] == "MEDIUM":
        congestion_risk = "MEDIUM"

    else:
        congestion_risk = "LOW"

    # -----------------------------------------------------
    # Expected waiting
    # -----------------------------------------------------
    if data["queue_days"] < 1:
        expected_waiting = "0–1 days"

    elif data["queue_days"] < 2:
        expected_waiting = "1–2 days"

    elif data["queue_days"] < 3:
        expected_waiting = "2–3 days"

    else:
        expected_waiting = "3+ days"

    # -----------------------------------------------------
    # Operational impact
    # -----------------------------------------------------
    if congestion_risk == "HIGH":
        operational_impact = (
            "High berth congestion may cause significant waiting, "
            "turnaround delays and additional demurrage exposure."
        )

    elif congestion_risk == "MEDIUM":
        operational_impact = (
            "Moderate port congestion may cause additional waiting "
            "and turnaround delays."
        )

    else:
        operational_impact = (
            "Low simulated congestion with limited expected "
            "berth and turnaround delays."
        )

    return {
        "port": port,

        # Important: clearly state that this is simulated.
        "data_source": "SIMULATED DEMO DATA",
        "is_live": False,

        "congestion_level": data["congestion_level"],
        "congestion_risk": congestion_risk,

        "vessels_waiting": data["vessels_waiting"],

        "queue_days": data["queue_days"],
        "turnaround_days": data["turnaround_days"],

        "expected_waiting": expected_waiting,

        "weather_delay_factor": data["weather_delay_factor"],

        "operational_impact": operational_impact,

        "generated_at": datetime.utcnow().isoformat() + "Z",
    }