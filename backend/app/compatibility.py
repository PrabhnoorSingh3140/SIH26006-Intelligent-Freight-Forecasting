from typing import Dict, Any


# ---------------------------------------------------------
# Vessel specifications
# ---------------------------------------------------------

VESSEL_SPECS = {
    "Handysize": {
        "dwt": 40000,
        "draft": 10.0,
        "loa": 180,
        "beam": 30,
        "cargo_types": ["Coal", "Iron Ore", "Grain", "Steel"],
    },
    "Supramax": {
        "dwt": 60000,
        "draft": 12.0,
        "loa": 200,
        "beam": 32,
        "cargo_types": ["Coal", "Iron Ore", "Grain", "Steel"],
    },
    "Panamax": {
        "dwt": 80000,
        "draft": 14.0,
        "loa": 225,
        "beam": 32,
        "cargo_types": ["Coal", "Iron Ore", "Grain", "Steel"],
    },
    "Kamsarmax": {
        "dwt": 82000,
        "draft": 14.5,
        "loa": 229,
        "beam": 32,
        "cargo_types": ["Coal", "Iron Ore", "Grain", "Steel"],
    },
    "Capesize": {
        "dwt": 180000,
        "draft": 17.0,
        "loa": 290,
        "beam": 45,
        "cargo_types": ["Coal", "Iron Ore"],
    },
}


# ---------------------------------------------------------
# Port constraints
# ---------------------------------------------------------

PORT_CONSTRAINTS = {
    "Haldia": {
        "max_draft": 8.5,
        "max_loa": 250,
        "max_beam": 40,
        "lighterage_available": True,
    },
    "Paradip": {
        "max_draft": 18.0,
        "max_loa": 320,
        "max_beam": 50,
        "lighterage_available": True,
    },
    "Visakhapatnam": {
        "max_draft": 17.0,
        "max_loa": 320,
        "max_beam": 50,
        "lighterage_available": False,
    },
}


def check_vessel_port_compatibility(
    vessel_type: str,
    destination_port: str,
    cargo_type: str,
    cargo_quantity: float,
) -> Dict[str, Any]:

    # -----------------------------------------------------
    # Validate vessel
    # -----------------------------------------------------

    if vessel_type not in VESSEL_SPECS:
        return {
            "feasible": False,
            "status": "NOT_FEASIBLE",
            "reason": f"Unknown vessel type: {vessel_type}",
            "checks": [],
        }

    # -----------------------------------------------------
    # Validate port
    # -----------------------------------------------------

    if destination_port not in PORT_CONSTRAINTS:
        return {
            "feasible": False,
            "status": "UNKNOWN_PORT",
            "reason": f"No constraint data available for {destination_port}",
            "checks": [],
        }

    vessel = VESSEL_SPECS[vessel_type]
    port = PORT_CONSTRAINTS[destination_port]

    checks = []
    failures = []

    # -----------------------------------------------------
    # Capacity check
    # -----------------------------------------------------

    capacity_ok = vessel["dwt"] >= cargo_quantity

    checks.append({
        "name": "Cargo Capacity",
        "vessel_value": vessel["dwt"],
        "required_value": cargo_quantity,
        "unit": "MT",
        "passed": capacity_ok,
    })

    if not capacity_ok:
        failures.append(
            f"Vessel capacity ({vessel['dwt']:,} MT) "
            f"is lower than cargo quantity ({cargo_quantity:,.0f} MT)."
        )

    # -----------------------------------------------------
    # Draft check
    # -----------------------------------------------------

    draft_ok = vessel["draft"] <= port["max_draft"]

    checks.append({
        "name": "Draft",
        "vessel_value": vessel["draft"],
        "port_limit": port["max_draft"],
        "unit": "m",
        "passed": draft_ok,
    })

    if not draft_ok:
        failures.append(
            f"Vessel draft ({vessel['draft']} m) exceeds "
            f"{destination_port} maximum draft ({port['max_draft']} m)."
        )

    # -----------------------------------------------------
    # LOA check
    # -----------------------------------------------------

    loa_ok = vessel["loa"] <= port["max_loa"]

    checks.append({
        "name": "LOA",
        "vessel_value": vessel["loa"],
        "port_limit": port["max_loa"],
        "unit": "m",
        "passed": loa_ok,
    })

    if not loa_ok:
        failures.append(
            f"Vessel LOA ({vessel['loa']} m) exceeds "
            f"port limit ({port['max_loa']} m)."
        )

    # -----------------------------------------------------
    # Beam check
    # -----------------------------------------------------

    beam_ok = vessel["beam"] <= port["max_beam"]

    checks.append({
        "name": "Beam",
        "vessel_value": vessel["beam"],
        "port_limit": port["max_beam"],
        "unit": "m",
        "passed": beam_ok,
    })

    if not beam_ok:
        failures.append(
            f"Vessel beam ({vessel['beam']} m) exceeds "
            f"port limit ({port['max_beam']} m)."
        )

    # -----------------------------------------------------
    # Cargo capability check
    # -----------------------------------------------------

    cargo_ok = cargo_type in vessel["cargo_types"]

    checks.append({
        "name": "Cargo Compatibility",
        "cargo_type": cargo_type,
        "supported": vessel["cargo_types"],
        "passed": cargo_ok,
    })

    if not cargo_ok:
        failures.append(
            f"{vessel_type} is not configured for {cargo_type}."
        )

    # -----------------------------------------------------
    # Final decision
    # -----------------------------------------------------

    feasible = len(failures) == 0

    result = {
        "vessel_type": vessel_type,
        "destination_port": destination_port,
        "cargo_type": cargo_type,
        "cargo_quantity": cargo_quantity,
        "feasible": feasible,
        "status": "FEASIBLE" if feasible else "NOT_FEASIBLE",
        "checks": checks,
        "reasons": failures,
        "lighterage_available": port["lighterage_available"],
    }

    # -----------------------------------------------------
    # Lighterage recommendation
    # -----------------------------------------------------

    if not feasible and port["lighterage_available"]:

        draft_failure = not draft_ok

        if draft_failure:
            result["alternative_strategy"] = (
                f"{vessel_type} + lighterage"
            )

            result["alternative_reason"] = (
                f"{vessel_type} may not be suitable for direct entry "
                f"at {destination_port}, but lighterage can be evaluated "
                f"as an alternative strategy."
            )

    return result