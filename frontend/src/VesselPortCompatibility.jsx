import { useState } from "react";

export default function VesselPortCompatibility() {
  const API = (
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");

  const [vesselType, setVesselType] = useState("Capesize");
  const [destinationPort, setDestinationPort] = useState("Haldia");
  const [cargoType, setCargoType] = useState("Coal");
  const [cargoQuantity, setCargoQuantity] = useState(120000);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCheck() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const params = new URLSearchParams({
        vessel_type: vesselType,
        destination_port: destinationPort,
        cargo_type: cargoType,
        cargo_quantity: String(cargoQuantity),
      });

      const response = await fetch(
        `${API}/api/compatibility?${params.toString()}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Compatibility check failed");
      }

      const data = await response.json();

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="compatibility-container">

      <h2>Vessel-Port Compatibility</h2>

      <p>
        Check whether the selected vessel can physically operate
        at the destination port.
      </p>

      <div className="compatibility-form">

        <label>
          Vessel Type
          <select
            value={vesselType}
            onChange={(e) => setVesselType(e.target.value)}
          >
            <option>Handysize</option>
            <option>Supramax</option>
            <option>Panamax</option>
            <option>Kamsarmax</option>
            <option>Capesize</option>
          </select>
        </label>

        <label>
          Destination Port
          <select
            value={destinationPort}
            onChange={(e) => setDestinationPort(e.target.value)}
          >
            <option>Haldia</option>
            <option>Paradip</option>
            <option>Visakhapatnam</option>
          </select>
        </label>

        <label>
          Cargo Type
          <select
            value={cargoType}
            onChange={(e) => setCargoType(e.target.value)}
          >
            <option>Coal</option>
            <option>Iron Ore</option>
            <option>Grain</option>
            <option>Steel</option>
          </select>
        </label>

        <label>
          Cargo Quantity (MT)
          <input
            type="number"
            value={cargoQuantity}
            onChange={(e) =>
              setCargoQuantity(Number(e.target.value))
            }
          />
        </label>

        <button onClick={handleCheck} disabled={loading}>
          {loading ? "Checking..." : "Check Compatibility"}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {result && (
        <div className="compatibility-result">

          <div
            className={
              result.feasible
                ? "status feasible"
                : "status not-feasible"
            }
          >
            {result.feasible
              ? "✓ FEASIBLE"
              : "✕ NOT FEASIBLE"}
          </div>

          <h3>
            {result.vessel_type} → {result.destination_port}
          </h3>

          <div className="checks">

            {result.checks.map((check, index) => (
              <div key={index} className="check-row">

                <span>
                  {check.name}
                </span>

                <strong>
                  {check.passed ? "✓ Passed" : "✕ Failed"}
                </strong>

              </div>
            ))}

          </div>

          {result.reasons?.length > 0 && (
            <div className="reasons">

              <h4>Why is it not feasible?</h4>

              <ul>
                {result.reasons.map((reason, index) => (
                  <li key={index}>
                    {reason}
                  </li>
                ))}
              </ul>

            </div>
          )}

          {result.alternative_strategy && (
            <div className="alternative">

              <h4>Alternative Strategy</h4>

              <strong>
                {result.alternative_strategy}
              </strong>

              <p>
                {result.alternative_reason}
              </p>

            </div>
          )}

        </div>
      )}

    </div>
  );
}