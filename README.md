# SIH26006 – Intelligent Freight Forecasting

## Freight Intelligence

**Team:** HexaCoders 
**SIH Problem Statement:** Development of an Intelligent Freight
Forecasting Model for Optimized Vessel Chartering and Bulk Cargo
Procurement from overseas to East Coast of India.

------------------------------------------------------------------------

## Overview

**Freight Intelligence** is an AI-powered maritime freight
decision-support system designed to help users estimate freight rates,
evaluate vessel options, and visualize practical maritime routes for
bulk cargo transportation.

The system combines:

- **CatBoost machine learning** for freight-rate forecasting
- **SeaRoute-based maritime routing** for water-route calculation
- **FastAPI** for backend API services
- **React + Vite** for the interactive frontend
- **Leaflet-based map visualization** for route presentation

The goal is to turn shipment information into an actionable
freight-planning result.

------------------------------------------------------------------------

## Key Features

### 1. Freight Rate Forecasting

The user provides shipment information such as:

- Origin country and port
- Destination country and port
- Cargo type
- Quantity in tonnes
- Vessel type
- Fuel price
- Port congestion
- Month

The backend processes these inputs through the trained **CatBoost
regression model** and returns a predicted freight rate.

### 2. Maritime Route Calculation

The system calculates a maritime route between the selected ports using
SeaRoute.

The routing system is designed to:

- Prefer navigable maritime paths
- Avoid land crossings
- Calculate route distance
- Validate route geometry
- Return route coordinates for map visualization

### 3. Vessel Intelligence

The application supports multiple bulk-carrier vessel categories,
including:

- Handysize
- Handymax
- Supramax
- Ultramax
- Panamax
- Kamsarmax
- Post-Panamax
- Capesize
- Newcastlemax
- VLOC

### 4. Decision Support

The application combines the forecasting and routing outputs to present
useful planning information such as:

- Predicted freight rate
- Estimated total cost
- Recommended vessel
- Route distance
- Route visualization
- Planning insights

### 5. Weather & Environmental Intelligence

The system provides weather conditions for selected strategic ports and
incorporates weather-related factors into operational risk assessment.

The weather intelligence includes:

- Temperature
- Humidity
- Precipitation
- Wind speed
- Wind direction
- Wind gusts
- Visibility
- Weather severity
- Estimated operational delay

The system converts weather conditions into an operational risk level:

- LOW
- MEDIUM
- HIGH

Weather data is currently provided through the Open-Meteo weather API.

### 6. Real-Time Data Analysis
The platform now includes a dedicated real-time analysis workspace. It consumes live Open-Meteo telemetry for monitored ports, refreshes automatically, and renders 24-hour interactive SVG time-series graphs for:

- Wind speed
- Operational risk score
- Precipitation
- Hourly marine conditions snapshot

The data-analysis page is available from the main navigation and from the forecast result actions. If the live provider is temporarily unreachable, the UI stays usable and reports the feed as offline instead of crashing.

### 7. What-If Scenario Analysis
What-if analysis reuses the same CatBoost forecasting pipeline as the main forecast. Users can change cargo quantity, fuel price, port congestion, vessel type, or charter month and see the scenario freight rate and total-cost delta against the active baseline.

The simulation updates automatically after input changes and also provides a manual **Recalculate now** control. The backend includes a geodesic distance fallback for what-if simulations when the optional SeaRoute package is unavailable, preventing the feature from failing solely because of route-engine availability.

### 8. Port Congestion Intelligence

The system evaluates simulated port traffic conditions to estimate the
potential operational impact of congestion.

The congestion module considers:

- Estimated vessels waiting
- Queue duration
- Expected berth waiting
- Port turnaround time
- Congestion level
- Congestion risk
- Weather-related delay factor

The system classifies port congestion as:

- LOW
- MEDIUM
- HIGH

The simulated congestion information can be used by the cost and risk
modules to estimate additional waiting and demurrage exposure.

> Note: Port congestion data is currently simulated for prototype and
> demonstration purposes. The architecture can be extended with live AIS
> or port traffic data.

------------------------------------------------------------------------

## System Architecture

``` text
                 ┌─────────────────────┐
                 │    React Frontend   │
                 │       Vercel        │
                 └──────────┬──────────┘
                            │ HTTPS / REST API
                            ▼
                 ┌─────────────────────┐
                 │      FastAPI        │
                 │      Backend        │
                 │       Render        │
                 └───────┬─────┬───────┘
                         │     │
              ┌──────────┘     └──────────┐
              ▼                           ▼
     ┌─────────────────┐         ┌─────────────────┐
     │ CatBoost Model  │         │ Maritime Route  │
     │ Freight Forecast│         │ SeaRoute Engine  │
     └─────────────────┘         └─────────────────┘
              │                           │
              └──────────┬────────────────┘
                         ▼
                 ┌─────────────────────┐
                 │ Optimized Freight   │
                 │ Decision Output     │
                 └─────────────────────┘
```

------------------------------------------------------------------------

## Real-Time Analysis & What-If Flow

```text
Live Port Data
     │
     ▼
Open-Meteo API ───────► 24h telemetry ───────► SVG trend graphs
     │
     └────────────────► current risk snapshot

Forecast Scenario ─► What-If controls ─► FastAPI /api/what-if
                                          │
                                          ▼
                                  Route distance + CatBoost
                                          │
                                          ▼
                                  Baseline vs Scenario
                                          │
                                          ▼
                              Rate / Cost / Driver deltas
```

A standalone flowchart is also included at `docs/realtime-analysis-what-if-flowchart.md`.

------------------------------------------------------------------------

## Technology Stack

| Layer               | Technology       |
|---------------------|------------------|
| Frontend            | React            |
| Build Tool          | Vite             |
| Language            | JavaScript / JSX |
| Maps                | Leaflet          |
| Backend             | Python           |
| API Framework       | FastAPI          |
| Machine Learning    | CatBoost         |
| Maritime Routing    | SeaRoute         |
| Frontend Deployment | Vercel           |
| Backend Deployment  | Render           |
| Dataset             | CSV              |
| Model Format        | CatBoost `.cbm`  |

------------------------------------------------------------------------

## Project Structure

``` text
SIH26006-Intelligent-Freight-Forecasting/
├── backend/
│   ├── app/
│   │   ├── ml/
│   │   │   ├── train_model.py
│   │   │   └── predictor.py
│   │   ├── main.py
│   │   ├── ports.py
│   │   ├── routing.py
│   │   ├── routing_grid.py
│   │   ├── routing_searoute_legacy.py
│   │   ├── schemas.py
│   │   └── db.py
│   ├── data/
│   │   ├── maritime_ai_training_1m.csv
│   │   ├── landmask.geojson
│   │   └── README.txt
│   ├── models/
│   │   ├── freight_model.cbm
│   │   └── model_meta.json
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── public/
│   │   └── vessels/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── portData.js
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
├── .gitattributes
├── .gitignore
└── README.md
```

------------------------------------------------------------------------

## Dataset

The primary training dataset is:

`backend/data/maritime_ai_training_1m.csv`

It contains approximately **1,000,000 records** and includes features
such as:

- Origin country
- Origin port
- Destination country
- Destination port
- Cargo type
- Quantity
- Vessel type
- Fuel price
- Port congestion
- Month
- Freight rate

The prediction target is:

`freight_rate_usd_tonne`

The large CSV is managed using **Git LFS**.

------------------------------------------------------------------------

## Machine Learning Pipeline

The machine-learning workflow is:

``` text
Training Dataset
      │
      ▼
train_model.py
      │
      ▼
CatBoost Regression
      │
      ├── freight_model.cbm
      └── model_meta.json
      │
      ▼
predictor.py
      │
      ▼
FastAPI /api/predict
      │
      ▼
React Frontend
```

### Model

The system uses **CatBoost Regression** because the dataset contains
categorical features such as ports, countries, cargo types, and vessel
types.

The trained model is stored as:

``` text
backend/models/freight_model.cbm
```

Model metadata is stored as:

``` text
backend/models/model_meta.json
```

------------------------------------------------------------------------

## Maritime Routing

The routing pipeline is:

``` text
Origin Port
     +
Destination Port
     │
     ▼
FastAPI
     │
     ▼
routing.py
     │
     ▼
SeaRoute
     │
     ▼
Maritime Route
     │
     ├── Distance
     └── Coordinates
     │
     ▼
Leaflet Map
```

The routing system uses maritime route calculation rather than simply
drawing a straight line between ports.

A landmask is also available at:

``` text
backend/data/landmask.geojson
```

for geographic route validation.

------------------------------------------------------------------------

## API Endpoints

### Health Check

``` text
GET /health
```

Checks backend and model availability.

### Metadata

``` text
GET /api/metadata
```

Returns application/model metadata used by the frontend.

### Freight Prediction

``` text
POST /api/predict
```

Receives shipment information and returns the freight forecasting
result.

### Maritime Route

``` text
POST /api/route
```

Calculates the maritime route between the selected ports.

------------------------------------------------------------------------

## Local Setup

### Backend

From the `backend` directory:

``` bash
python -m venv venv
```

Activate the virtual environment.

Windows:

``` bash
venv\Scripts\activate
```

Install dependencies:

``` bash
pip install -r requirements.txt
```

Start FastAPI:

``` bash
uvicorn app.main:app --reload
```

The local API will normally be available at:

``` text
http://127.0.0.1:8000
```

### Frontend

From the `frontend` directory:

``` bash
npm install
```

Start the Vite development server:

``` bash
npm run dev
```

The frontend will normally run at:

``` text
http://localhost:5173
```

------------------------------------------------------------------------

## Environment Configuration

### Frontend

The frontend can use:

``` text
VITE_API_URL
```

Example:

``` text
VITE_API_URL=https://sih26006-backend.onrender.com
```

### Backend

Backend environment variables can be configured using:

``` text
backend/.env.example
```

Do not commit private credentials or secrets to GitHub.

------------------------------------------------------------------------

## Deployment

### Frontend

The React application is deployed using **Vercel**.

Production frontend:

https://sih-26006-intelligent-freight-forecasting-4lypplwz1.vercel.app

### Backend

The FastAPI application is deployed using **Render**.

Production backend:

https://sih26006-backend.onrender.com

The frontend communicates with the backend through HTTPS REST APIs.

------------------------------------------------------------------------

## Security

The application follows basic deployment security practices:

- HTTPS communication
- CORS-based origin restriction
- Environment-based configuration for secrets
- Backend-side ML model isolation
- Trained model is not sent directly to the browser

The client interacts with API endpoints rather than directly accessing
the model internals.

------------------------------------------------------------------------

## Why FastAPI?

FastAPI provides the communication layer between the React frontend and
the Python backend.

It allows the application to expose:

- ML prediction services
- Maritime routing services
- Health checks
- Metadata services

This makes the CatBoost and SeaRoute functionality accessible to the
React application through REST APIs.

------------------------------------------------------------------------

## Why CatBoost?

CatBoost is well suited to this project because many important input
variables are categorical.

Examples include:

- Country
- Port
- Cargo type
- Vessel type

CatBoost can work effectively with categorical features while providing
a practical regression model for freight-rate prediction.

------------------------------------------------------------------------

## Why SeaRoute?

A simple geographic straight line is not sufficient for maritime
transportation.

SeaRoute is used to calculate a route that follows navigable maritime
geography, allowing the application to provide a more meaningful
shipping route and distance for the selected ports.

------------------------------------------------------------------------

## End-to-End Workflow

``` text
1. User selects origin and destination
              ↓
2. User enters cargo and shipment details
              ↓
3. React sends request to FastAPI
              ↓
4. FastAPI validates the request
              ↓
5. CatBoost predicts freight rate
              ↓
6. SeaRoute calculates maritime route
              ↓
7. Backend returns prediction + route data
              ↓
8. React displays results and map
              ↓
9. User uses the result for freight planning
```

------------------------------------------------------------------------

## Project Objective

The objective of Freight Intelligence is to support better maritime
freight decisions by combining:

**Machine Learning + Maritime Routing + Shipment Information**

into a single decision-support platform.

This helps users move from manually estimating freight requirements
toward a data-driven approach for:

- Freight forecasting
- Vessel planning
- Bulk cargo procurement
- Maritime route evaluation
- Cost-oriented decision making

------------------------------------------------------------------------

## Team

### GridWalkers

**SIH26006 – Intelligent Freight Forecasting**

Built for the Smart India Hackathon.

------------------------------------------------------------------------

## License

This repository is intended for the SIH26006 project and demonstration
purposes.

------------------------------------------------------------------------

## Running the updated project

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

Set `VITE_API_URL` when the FastAPI service is not running on the local default. The existing weather dashboard and the new real-time analysis page now use the same API environment setting.

### New API endpoints

- `GET /api/realtime-analysis?port=Paradip` — live hourly telemetry and risk series.
- `POST /api/what-if` — baseline-versus-scenario CatBoost comparison.
