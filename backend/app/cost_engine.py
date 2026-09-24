from typing import Dict, Any


def calculate_cost(
    freight_rate_usd_per_tonne: float,
    cargo_quantity_tonnes: float,
    fuel_cost_usd: float = 0.0,
    port_cost_usd: float = 0.0,
    lighterage_cost_usd: float = 0.0,
    waiting_days: float = 0.0,
    daily_demurrage_usd: float = 0.0,
    risk_exposure_usd: float = 0.0,
) -> Dict[str, Any]:

    # --------------------------------------------------
    # 1. Ocean freight
    # --------------------------------------------------

    ocean_freight_usd = (
        freight_rate_usd_per_tonne * cargo_quantity_tonnes
    )

    # --------------------------------------------------
    # 2. Waiting cost
    # --------------------------------------------------

    waiting_cost_usd = (
        waiting_days * daily_demurrage_usd
    )

    # --------------------------------------------------
    # 3. Base expected cost
    # --------------------------------------------------

    base_cost_usd = (
        ocean_freight_usd
        + fuel_cost_usd
        + port_cost_usd
        + lighterage_cost_usd
        + waiting_cost_usd
    )

    # --------------------------------------------------
    # 4. Risk-adjusted expected cost
    # --------------------------------------------------

    risk_adjusted_cost_usd = (
        base_cost_usd + risk_exposure_usd
    )

    # --------------------------------------------------
    # 5. Cost per tonne
    # --------------------------------------------------

    cost_per_tonne_usd = (
        risk_adjusted_cost_usd / cargo_quantity_tonnes
        if cargo_quantity_tonnes > 0
        else 0
    )

    return {
        "currency": "USD",

        "cargo_quantity_tonnes": cargo_quantity_tonnes,

        "freight_rate_usd_per_tonne": (
            freight_rate_usd_per_tonne
        ),

        "cost_breakdown": {
            "ocean_freight_usd": round(
                ocean_freight_usd, 2
            ),

            "fuel_cost_usd": round(
                fuel_cost_usd, 2
            ),

            "port_cost_usd": round(
                port_cost_usd, 2
            ),

            "lighterage_cost_usd": round(
                lighterage_cost_usd, 2
            ),

            "waiting_cost_usd": round(
                waiting_cost_usd, 2
            ),

            "risk_exposure_usd": round(
                risk_exposure_usd, 2
            ),
        },

        "waiting_days": waiting_days,

        "daily_demurrage_usd": daily_demurrage_usd,

        "base_expected_cost_usd": round(
            base_cost_usd, 2
        ),

        "risk_adjusted_total_cost_usd": round(
            risk_adjusted_cost_usd, 2
        ),

        "risk_adjusted_cost_per_tonne_usd": round(
            cost_per_tonne_usd, 2
        ),
    }