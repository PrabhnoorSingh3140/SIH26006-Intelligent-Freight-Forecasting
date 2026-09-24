# CargoNex — Real-Time Data Analysis + What-If Flowchart

```mermaid
flowchart TD
    A[CargoNex React Frontend] --> B{User action}

    B -->|Open Data Analysis| C[Select monitored port]
    C --> D[FastAPI /api/realtime-analysis]
    D --> E[Open-Meteo live telemetry]
    E --> F[Current conditions + 24h hourly data]
    F --> G[Risk scoring]
    G --> H[Interactive SVG graphs + data table]
    H --> I[Auto refresh every 60 seconds]
    I --> D

    B -->|Run Forecast| J[Shipment inputs]
    J --> K[FastAPI /api/predict]
    K --> L[SeaRoute + CatBoost]
    L --> M[Forecast result]

    B -->|Open What-If| N[Copy active scenario]
    N --> O[Change quantity / fuel / congestion / vessel / month]
    O --> P[FastAPI /api/what-if]
    P --> Q{Route engine available?}
    Q -->|Yes| R[SeaRoute distance + CatBoost prediction]
    Q -->|No| S[Geodesic distance fallback + CatBoost prediction]
    R --> T[Scenario result]
    S --> T
    T --> U[Baseline vs Scenario comparison]
    U --> V[Rate delta + cost delta + scenario drivers]
    V --> W[Live destination condition snapshot]
```

## Working principle

1. **Data Analysis** reads live port telemetry from Open-Meteo and converts the hourly feed into graph-ready values.
2. **Forecasting** keeps the existing shipment form and CatBoost model unchanged.
3. **What-If** starts from the active forecast inputs, changes only the selected variables, and calls the same backend prediction stack.
4. **Comparison** reports the difference from the baseline rather than replacing the original result.
5. **Resilience** prevents optional live-data or SeaRoute failures from taking down the interface.
