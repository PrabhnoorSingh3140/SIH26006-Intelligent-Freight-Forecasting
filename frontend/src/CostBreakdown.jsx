export default function CostBreakdown({ result }) {
  if (!result) {
    return null;
  }

  const breakdown = result.cost_breakdown;

  return (
    <div className="cost-breakdown">

      <div className="cost-header">
        <div>
          <span>EXPECTED TOTAL COST</span>

          <h2>
            $
            {result.risk_adjusted_total_cost_usd.toLocaleString()}
          </h2>
        </div>

        <div>
          <span>COST / TONNE</span>

          <h3>
            $
            {result.risk_adjusted_cost_per_tonne_usd.toFixed(2)}
          </h3>
        </div>
      </div>


      <div className="cost-items">

        <div className="cost-row">
          <span>Ocean Freight</span>

          <strong>
            ${breakdown.ocean_freight_usd.toLocaleString()}
          </strong>
        </div>


        <div className="cost-row">
          <span>Fuel Cost</span>

          <strong>
            ${breakdown.fuel_cost_usd.toLocaleString()}
          </strong>
        </div>


        <div className="cost-row">
          <span>Port Cost</span>

          <strong>
            ${breakdown.port_cost_usd.toLocaleString()}
          </strong>
        </div>


        <div className="cost-row">
          <span>Lighterage</span>

          <strong>
            ${breakdown.lighterage_cost_usd.toLocaleString()}
          </strong>
        </div>


        <div className="cost-row">
          <span>Waiting / Demurrage</span>

          <strong>
            ${breakdown.waiting_cost_usd.toLocaleString()}
          </strong>
        </div>


        <div className="cost-row">
          <span>Risk Exposure</span>

          <strong>
            ${breakdown.risk_exposure_usd.toLocaleString()}
          </strong>
        </div>

      </div>

    </div>
  );
}