import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'


import {
  ArrowRight,
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  CircleHelp,
  CloudSun,
  Compass,
  Fuel,
  Gauge,
  Globe2,
  Home as HomeIcon,
  Info,
  Layers,
  MapPin,
  Navigation,
  Package,
  RefreshCcw,
  Route as RouteIcon,
  Scale,
  Ship,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Warehouse,
  FlaskConical,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'

import { PORTS_BY_COUNTRY, PORT_COORDS, PORT_COUNTRY } from './portData'
import { VESSELS } from './vesselData'
import WeatherCongestion from './WeatherCongestion'

const API = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '')
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DEFAULT = {
  origin_country: 'Indonesia', origin_port: 'Balikpapan', destination_country: 'India', destination_port: 'Paradip',
  cargo_type: 'Coal', quantity_tonnes: 50000, vessel_type: 'Panamax', fuel_price_usd_tonne: 620,
  port_congestion: 0.35, month: 'March'
}
const money = n => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(n || 0))
const pct = n => `${Number(n || 0).toFixed(1)}%`

const COUNTRY_ISO = {
  India:'in', Indonesia:'id', Australia:'au', China:'cn', Vietnam:'vn',
  USA:'us', Canada:'ca', Brazil:'br', Argentina:'ar', Egypt:'eg',
  Japan:'jp', 'South Korea':'kr', Malaysia:'my', UAE:'ae', Oman:'om',
  'Saudi Arabia':'sa', Qatar:'qa', Thailand:'th', Morocco:'ma',
  Turkey:'tr', 'South Africa':'za', Bangladesh:'bd', Mexico:'mx',
  Netherlands:'nl', 'Sri Lanka':'lk', Colombia:'co'
}
const flag = country => COUNTRY_ISO[country] || ''

function portList(country) {
  const ports = Array.isArray(PORTS_BY_COUNTRY[country]) ? PORTS_BY_COUNTRY[country] : []
  return [...new Set(ports.filter(p => typeof p === 'string' && p.trim()))]
}

function vessel(name) {
  return VESSELS.find(v => v.name === name) || VESSELS[0] || {
    name:'Vessel',
    min:0,
    max:0,
    loa:0,
    beam:0,
    draft:0,
    holds:0,
    usage:'',
    description:''
  }
}

function safePoint(value) {
  return Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
    ? [Number(value[0]), Number(value[1])]
    : null
}

function safeRouteCoordinates(value) {
  if (!Array.isArray(value)) return []
  return value.map(safePoint).filter(Boolean)
}

function routeLabel(originCountry, destinationCountry) {
  const o = String(originCountry || '').trim()
  const d = String(destinationCountry || '').trim()
  if (o && d) return `${o} → ${d} · maritime network route`
  return 'Maritime network route'
}

async function fetchJSON(path, options = {}) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })

  const text = await r.text()
  let data = {}

  try {
    data = text ? JSON.parse(text) : {}
  } catch {}

  if (!r.ok) {
    throw new Error(data.detail || `Forecast service error (${r.status})`)
  }

  return data
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError:false, message:'' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError:true,
      message:error?.message || 'Unexpected interface error'
    }
  }

  componentDidCatch(error, info) {
    console.error('Freight Intelligence UI error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app" style={{minHeight:'100vh',padding:'40px'}}>
          <div className="panel" style={{maxWidth:'900px',margin:'0 auto'}}>
            <div className="eyebrow">APPLICATION RECOVERED</div>
            <h2>Something went wrong while rendering this scenario.</h2>
            <p>{this.state.message}</p>
            <button
              className="primaryBtn"
              onClick={() => window.location.reload()}
            >
              Reload application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function App() {
  const [page, setPage] = useState('home')
  const [form, setForm] = useState(DEFAULT)
  const [meta, setMeta] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(null)
  const [history, setHistory] = useState([])
  const [serviceOnline, setServiceOnline] = useState(false)
  const [routePreview, setRoutePreview] = useState(null)

  useEffect(() => {
    let isMounted = true
    const loadInitialData = async (retryCount = 0) => {
      try {
        const [m] = await Promise.all([
          fetchJSON('/api/metadata'),
          fetchJSON('/health')
        ])
        if (isMounted) {
          setMeta(m)
          setServiceOnline(true)
          setError('')
        }
      } catch (err) {
        if (!isMounted) return
        if (retryCount < 3) {
          setTimeout(() => {
            if (isMounted) loadInitialData(retryCount + 1)
          }, 800)
        } else {
          setServiceOnline(false)
          setError(
            'Forecasting service is temporarily connecting. Please refresh or try again in a moment.'
          )
        }
      }
    }

    loadInitialData()

    try {
      setHistory(
        JSON.parse(localStorage.getItem('sih26006_plans') || '[]')
      )
    } catch {}

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(
      'sih26006_plans',
      JSON.stringify(history.slice(0, 12))
    )
  }, [history])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const originPorts = portList(form.origin_country)
    const destinationPorts = portList(form.destination_country)

    const validOrigin = Boolean(
      form.origin_country &&
      form.origin_port &&
      originPorts.includes(form.origin_port)
    )

    const validDestination = Boolean(
      form.destination_country &&
      form.destination_port &&
      destinationPorts.includes(form.destination_port)
    )

    if (
      !validOrigin ||
      !validDestination ||
      form.origin_port === form.destination_port
    ) {
      setRoutePreview(null)
      return () => controller.abort()
    }

    const q = new URLSearchParams({
      origin_port: form.origin_port,
      destination_port: form.destination_port,
      origin_country: form.origin_country,
      destination_country: form.destination_country,
    })

    const timer = setTimeout(async () => {
      try {
        const data = await fetchJSON(
          `/api/route?${q.toString()}`,
          { signal: controller.signal }
        )

        if (!cancelled) {
          setRoutePreview(data)
        }
      } catch (e) {
        if (!cancelled && e.name !== 'AbortError') {
          setRoutePreview(null)
        }
      }
    }, 120)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [
    form.origin_port,
    form.destination_port,
    form.origin_country,
    form.destination_country
  ])

  useEffect(() => {
    if (!toast) return

    const t = setTimeout(() => setToast(''), 2200)

    return () => clearTimeout(t)
  }, [toast])

  const setField = (key, value) =>
    setForm(f => ({ ...f, [key]: value }))

  const setCountry = (side, country) => {
    const ports = portList(country)

    setForm(f => {
      if (side === 'origin') {
        let nextPort = ports.includes(f.origin_port)
          ? f.origin_port
          : (ports[0] || '')

        const destinationWillMatch =
          country === f.destination_country &&
          nextPort === f.destination_port

        if (destinationWillMatch) {
          nextPort =
            ports.find(p => p !== f.destination_port) || nextPort
        }

        return {
          ...f,
          origin_country: country,
          origin_port: nextPort
        }
      }

      let nextPort = ports.includes(f.destination_port)
        ? f.destination_port
        : (ports[0] || '')

      const originWillMatch =
        country === f.origin_country &&
        nextPort === f.origin_port

      if (originWillMatch) {
        nextPort =
          ports.find(p => p !== f.origin_port) || nextPort
      }

      return {
        ...f,
        destination_country: country,
        destination_port: nextPort
      }
    })

    setError('')
  }

  const reset = () => {
    setForm(DEFAULT)
    setResult(null)
    setModal(null)
    setError('')
    setPage('home')
    setToast('Scenario reset')
  }

  const predict = async () => {
    setError('')

    const availableOriginPorts = portList(form.origin_country)
    const availableDestinationPorts = portList(form.destination_country)

    const quantity = Number(form.quantity_tonnes)
    const fuelPrice = Number(form.fuel_price_usd_tonne)
    const congestion = Number(form.port_congestion)

    if (
      !form.origin_country ||
      !form.destination_country ||
      !form.origin_port ||
      !form.destination_port
    ) {
      setError(
        'Please choose both countries and valid ports before running the forecast.'
      )
      return
    }

    if (
      !availableOriginPorts.includes(form.origin_port) ||
      !availableDestinationPorts.includes(form.destination_port)
    ) {
      setError(
        'The selected port does not belong to its selected country. Please reselect the country/port.'
      )
      return
    }

    if (form.origin_port === form.destination_port) {
      setError(
        'Please choose two different ports for the shipment route.'
      )
      return
    }

    if (!Number.isFinite(quantity) || quantity < 100) {
      setError('Quantity must be at least 100 tonnes.')
      return
    }

    if (!Number.isFinite(fuelPrice) || fuelPrice <= 0) {
      setError('Fuel price must be greater than 0.')
      return
    }

    if (
      !Number.isFinite(congestion) ||
      congestion < 0 ||
      congestion > 1
    ) {
      setError('Port congestion must be between 0 and 1.')
      return
    }

    setBusy(true)

    try {
      const payload = {
        ...form,
        quantity_tonnes: quantity,
        fuel_price_usd_tonne: fuelPrice,
        port_congestion: congestion
      }

      const data = await fetchJSON(
        '/api/predict',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      )

      setResult(data)

      const record = {
        id: Date.now(),
        created_at: new Date().toISOString(),
        input: payload,
        result: data
      }

      setHistory(h => [record, ...h].slice(0, 12))
      setToast('Forecast updated and saved on this device')
    } catch (e) {
      setError(
        e.message || 'Unable to complete the forecast.'
      )
    } finally {
      setBusy(false)
    }
  }

  const exportBrief = () => {
    if (!result) {
      setToast('Run a forecast before exporting')
      return
    }

    const text = [
      'SIH26006 FREIGHT INTELLIGENCE – DECISION BRIEF',
      '',
      `Origin: ${form.origin_port}, ${form.origin_country}`,
      `Destination: ${form.destination_port}, ${form.destination_country}`,
      `Cargo: ${form.cargo_type}`,
      `Quantity: ${money(form.quantity_tonnes)} tonnes`,
      `Forecast freight: $${result.predicted_freight_rate}/tonne`,
      `Recommended vessel: ${result.best_vessel}`,
      `Best charter month: ${result.best_charter_month}`,
      `Estimated total cost: $${money(result.estimated_total_cost)}`,
      `Indicative savings: ${result.savings_percent}%`,
      '',
      `Sea route: ${
        result.route?.label ||
        `${form.origin_port} → ${form.destination_port} · ML-ranked maritime corridor`
      }`,
    ].join('\n')

    const blob = new Blob(
      [text],
      { type: 'text/plain;charset=utf-8' }
    )

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = 'SIH26006-decision-brief.txt'
    a.click()

    URL.revokeObjectURL(url)
  }

const nav = [
  ['home', 'Home', HomeIcon],

  ['forecast', 'Forecast', Gauge],

  ['routes', 'Routes', Globe2],

  ['weather', 'Weather', CloudSun],

  ['vessels', 'Vessels', Ship],

  ['insights', 'Insights', BarChart3],

  ['analysis', 'Stats', Activity],

  ['whatif', 'What-If', FlaskConical],

  ['about', 'About', Info],
]
  return (
    <div className="app">
      <header className="topbar">
        <div
          className="brand"
          onClick={() => setPage('home')}
          role="button"
          tabIndex={0}
        >
          <div className="brandMark">
            <Ship size={22}/>
          </div>

          <div>
            <strong>CargoNex</strong>
            <span>AI-Powered Maritime Decision Support</span>
          </div>
        </div>

        <nav>
          {nav.map(([key,label,Icon]) => (
            <button
              key={key}
              className={
                page === key
                  ? 'navBtn active'
                  : 'navBtn'
              }
              onClick={() => setPage(key)}
            >
              <Icon size={17}/>
              {label}
            </button>
          ))}
        </nav>

        <div className="topActions">
          <span
            className={
              serviceOnline
                ? "serviceStatus"
                : "serviceStatus offline"
            }
          >
            <i></i>
            {serviceOnline
              ? "AI model online"
              : "AI model offline"}
          </span>

          <button
            className="iconBtn"
            onClick={reset}
            title="Reset scenario"
          >
            <RefreshCcw size={16}/>
          </button>

          <button
            className="helpBtn"
            onClick={() => setModal('help')}
          >
            <CircleHelp size={15}/>
            Help
          </button>
        </div>
      </header>

      {error && (
        <div className="errorBar">
          <span>{error}</span>
          <button onClick={() => setError('')}>
            <X size={15}/>
          </button>
        </div>
      )}

      {page === 'home' && (
        <HomePage go={setPage}/>
      )}

      {page === 'forecast' && (
        <ForecastPage
          {...{
            form,
            setField,
            setCountry,
            meta,
            result,
            routePreview,
            setRoutePreview,
            predict,
            busy,
            setPage,
            setModal,
            exportBrief
          }}
        />
      )}

      {page === 'routes' && (
        <RoutesPage
          {...{
            form,
            setField,
            setCountry,
            meta,
            setPage,
            routePreview,
            setRoutePreview
          }}
        />
      )}

      {page === 'vessels' && (
        <VesselsPage
          meta={meta}
          form={form}
          setField={setField}
        />
      )}
      {page === 'weather' && (
        <WeatherPage
          destinationPort={form.destination_port}
          setDestinationPort={(port) => setField('destination_port', port)}
        />
      )}

      {page === 'insights' && (
        <InsightsPage
          result={result}
          form={form}
          history={history}
          setResult={setResult}
          setForm={setForm}
          onCompare={() => setModal('compare')}
          onOutlook={() => setModal('outlook')}
        />
      )}

      {page === 'analysis' && (
        <DataAnalysisPage
          destinationPort={form.destination_port}
          result={result}
          onSelectPort={(port) => setField('destination_port', port)}
        />
      )}

      {page === 'whatif' && (
        <WhatIfScenario baseForm={form} meta={meta} />
      )}

      {page === 'about' && (
        <AboutPage />
      )}

      {modal === 'compare' && result && (
        <CompareModal
          result={result}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'outlook' && result && (
        <OutlookModal
          result={result}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'help' && (
        <HelpModal
          onClose={() => setModal(null)}
        />
      )}

      {toast && (
        <div className="toast">
          <Check size={15}/>
          {toast}
        </div>
      )}
    </div>
  )
}

function HomePage({go}) {
  return (
    <main className="pageWrap homePage">
      <section className="homeHero">
        <div className="homeCopy">
          <div className="eyebrow">
            <Sparkles size={14}/>
            SMART MARITIME DECISIONS
          </div>

          <h1>
            Predict freight.
            <br/>
            <span>Decide smarter.</span>
          </h1>

          <p>
            Turn shipment conditions into a freight forecast,
            practical sea-route view, vessel fit, charter timing
            and cost-aware recommendation.
          </p>

          <div className="homeActions">
            <button
              className="primaryBtn"
              onClick={() => go('forecast')}
            >
              Start Forecast
              <ArrowRight size={18}/>
            </button>

            <button
              className="secondaryBtn"
              onClick={() => go('routes')}
            >
              Explore Routes
            </button>
          </div>
        </div>

        <div className="homeVisual globalShippingHome">
          <img
            src="/global-shipping-routes.png"
            alt="Global shipping routes"
            className="globalShippingImage"
          />

          <div className="homeMapChip">
            <Globe2 size={18}/>
            <div>
              <b>Global maritime coverage</b>
              <span>Global shipping route network</span>
            </div>
          </div>
        </div>
      </section>

      <section className="featureGrid">
        <Feature
          icon={TrendingDown}
          title="Freight Forecast"
          text="Estimate freight rate from route, cargo, vessel, fuel and congestion inputs."
        />

        <Feature
          icon={Ship}
          title="Vessel Fit"
          text="See capacity ranges, dimensions, cargo use and current shipment fit."
        />

        <Feature
          icon={RouteIcon}
          title="Sea-Route Planning"
          text="Visualize the voyage through offshore maritime corridors instead of land."
        />

        <Feature
          icon={CalendarDays}
          title="Charter Timing"
          text="Compare the scenario across twelve planning months."
        />

        <Feature
          icon={CloudSun}
          title="Weather & Risk"
          text="Monitor weather conditions and operational risks that may affect voyage planning and port operations."
        />

        <Feature
          icon={Activity}
          title="Real-Time Data Analysis"
          text="Track live port conditions with interactive time-series graphs for wind, precipitation and operational risk."
          onClick={() => go('analysis')}
        />
      </section>
    </main>
  )
}
const checkCompatibility = async ({
  vesselType,
  destinationPort,
  cargoType,
  cargoQuantity,
}) => {
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
    throw new Error("Unable to check vessel-port compatibility");
  }

  return response.json();
};

function Feature({icon:Icon,title,text,onClick}) {
  return (
    <div className={onClick ? 'featureCard featureCardAction' : 'featureCard'} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}>
      <div className="featureIcon">
        <Icon size={19}/>
      </div>

      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

function ForecastPage({
  form,
  setField,
  setCountry,
  meta,
  result,
  routePreview,
  setRoutePreview,
  predict,
  busy,
  setPage,
  setModal,
  exportBrief
}) {
  return (
    <main className="pageWrap">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <Sparkles size={14}/>
            INTELLIGENT CHARTERING
          </div>

          <h1>
            Plan your shipment
            <br/>
            <span>with clarity.</span>
          </h1>

          <p>
            Forecast freight, understand the sea route,
            compare vessel classes and make a cost-aware
            chartering decision.
          </p>
        </div>

        <div className="heroPills">
          <span>
            <WavesIcon/>
            Sea-lane view
          </span>

          <span>
            <Ship size={14}/>
            Vessel fit
          </span>

          <span>
            <TrendingUp size={14}/>
            Forecast
          </span>
        </div>
      </section>

      <section className="topGrid">
        <Scenario
          {...{
            form,
            setField,
            setCountry,
            meta,
            predict,
            busy
          }}
        />

        <RouteMap
          form={form}
          result={result}
          routePreview={routePreview}
          setRoutePreview={setRoutePreview}
          compact
        />
      </section>

      <VesselGallery
        selected={form.vessel_type}
        onSelect={v => setField('vessel_type',v)}
      />

      <section className="bottomGrid">
        <SelectedVessel form={form}/>

        <Results
          result={result}
          form={form}
          onCompare={() => setModal('compare')}
          onOutlook={() => setModal('outlook')}
          onDataAnalysis={() => setPage('analysis')}
          onWhatIf={() => setPage('whatif')}
          exportBrief={exportBrief}
        />
      </section>

      {result && (
        <section className="actionStrip">
          <div>
            <b>Decision tools</b>
            <span>
              Open the full route planner or vessel guide
              without losing this scenario.
            </span>
          </div>

          <div>
            <button
              className="secondaryBtn"
              onClick={() => setPage('routes')}
            >
              Open route explorer
            </button>

            <button
              className="secondaryBtn"
              onClick={() => setPage('vessels')}
            >
              Open vessel guide
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
const calculateCost = async ({
  freightRate,
  quantity,
  fuelCost = 0,
  portCost = 0,
  lighterageCost = 0,
  waitingDays = 0,
  demurragePerDay = 0,
  riskExposure = 0,
}) => {

  const params = new URLSearchParams({
    freight_rate_usd_per_tonne: String(freightRate),
    cargo_quantity_tonnes: String(quantity),
    fuel_cost_usd: String(fuelCost),
    port_cost_usd: String(portCost),
    lighterage_cost_usd: String(lighterageCost),
    waiting_days: String(waitingDays),
    daily_demurrage_usd: String(demurragePerDay),
    risk_exposure_usd: String(riskExposure),
  });

  const response = await fetch(
    `${API}/api/cost?${params.toString()}`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error("Cost calculation failed");
  }

  return response.json();
};

function WavesIcon() {
  return <span className="wavesIcon">≈</span>
}

function Scenario({
  form,
  setField,
  setCountry,
  meta,
  predict,
  busy
}) {
  const countries =
    meta?.countries ||
    Object.keys(PORTS_BY_COUNTRY).sort()

  const originPorts =
    portList(form.origin_country)

  const destinationPorts =
    portList(form.destination_country)

  const profile =
    VESSELS.find(v => v.name === form.vessel_type)

  return (
    <form
      className="panel scenario"
      onSubmit={e => {
        e.preventDefault()
        predict()
      }}
    >
      <div className="panelHeader">
        <div>
          <div className="eyebrow">
            ⚓ SHIPMENT DETAILS
          </div>

          <h2>Build your shipment</h2>

          <p>
            Port lists automatically follow the country you choose.
          </p>
        </div>

        <SlidersHorizontal size={20}/>
      </div>

      <div className="fields">
        <Field label="Origin Country">
          <div className="inputWithIcon">
            <span className="flagBadge">
              <img
                src={`https://flagcdn.com/w40/${flag(form.origin_country)}.png`}
                alt=""
                aria-hidden="true"
                onError={e => {
                  e.currentTarget.style.display = "none"
                }}
              />
            </span>

            <select
              value={form.origin_country}
              onChange={e =>
                setCountry('origin',e.target.value)
              }
            >
              {countries.map(c => (
                <option
                  key={c}
                  value={c}
                >
                  {c}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Origin Port">
          <div className="inputWithIcon">
            <MapPin size={15}/>

            <select
              value={form.origin_port}
              onChange={e =>
                setField('origin_port',e.target.value)
              }
            >
              {originPorts.map(p => (
                <option key={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Destination Country">
          <div className="inputWithIcon">
            <span className="flagBadge">
              <img
                src={`https://flagcdn.com/w40/${flag(form.destination_country)}.png`}
                alt=""
                aria-hidden="true"
                onError={e => {
                  e.currentTarget.style.display = "none"
                }}
              />
            </span>

            <select
              value={form.destination_country}
              onChange={e =>
                setCountry('destination',e.target.value)
              }
            >
              {countries.map(c => (
                <option
                  key={c}
                  value={c}
                >
                  {c}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Destination Port">
          <div className="inputWithIcon">
            <MapPin size={15}/>

            <select
              value={form.destination_port}
              onChange={e =>
                setField('destination_port',e.target.value)
              }
            >
              {destinationPorts.map(p => (
                <option key={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <div className="routeStrip">
          <MapPin size={15}/>
          <b>{form.origin_port}</b>
          <ArrowRight size={14}/>
          <b>{form.destination_port}</b>
          <span>Sea route updates automatically</span>
        </div>

        <Field label="Cargo Type">
          <div className="inputWithIcon">
            <Package size={15}/>

            <select
              value={form.cargo_type}
              onChange={e =>
                setField('cargo_type',e.target.value)
              }
            >
              {(
                meta?.cargo_types ||
                [
                  'Coal',
                  'Iron Ore',
                  'Grain',
                  'Sugar',
                  'Fertilizer',
                  'Cement'
                ]
              ).map(c => (
                <option key={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Quantity (tonnes)">
          <div className="inputWithIcon">
            <Scale size={15}/>

            <input
              type="number"
              min="100"
              value={form.quantity_tonnes}
              onChange={e =>
                setField(
                  'quantity_tonnes',
                  e.target.value
                )
              }
            />
          </div>
        </Field>

        <Field
          label="Vessel Type"
          help="See size instantly"
        >
          <div className="inputWithIcon">
            <Ship size={15}/>

            <select
              value={form.vessel_type}
              onChange={e =>
                setField(
                  'vessel_type',
                  e.target.value
                )
              }
            >
              {VESSELS.map(v => (
                <option key={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Fuel Price (USD/tonne)">
          <div className="inputWithIcon">
            <Fuel size={15}/>

            <input
              type="number"
              min="1"
              step="0.01"
              value={form.fuel_price_usd_tonne}
              onChange={e =>
                setField(
                  'fuel_price_usd_tonne',
                  e.target.value
                )
              }
            />
          </div>
        </Field>

        <Field label="Port Congestion (0–1)">
          <div className="inputWithIcon">
            <Gauge size={15}/>

            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={form.port_congestion}
              onChange={e =>
                setField(
                  'port_congestion',
                  e.target.value
                )
              }
            />
          </div>
        </Field>

        <Field label="Preferred Month">
          <div className="inputWithIcon">
            <CalendarDays size={15}/>

            <select
              value={form.month}
              onChange={e =>
                setField('month',e.target.value)
              }
            >
              {MONTHS.map(m => (
                <option key={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </Field>
      </div>

      {profile && (
        <div className="vesselPeek">
          <img
            src={profile.image}
            alt={profile.name}
          />

          <div>
            <b>{profile.name}</b>

            <strong>
              {profile.min.toLocaleString()}–
              {profile.max.toLocaleString()} DWT
            </strong>

            <span>
              {profile.description}
            </span>
          </div>

          <ChevronRightIcon/>
        </div>
      )}

      {/* Use example removed.
          Predict button now uses full available width. */}
      <div className="formActions">
        <button
          className="primaryBtn"
          disabled={busy}
        >
          <TrendingUp size={16}/>
          {busy
            ? 'Calculating…'
            : 'Predict Freight & Show Insights'}
          <ArrowRight size={17}/>
        </button>
      </div>
    </form>
  )
}

function ChevronRightIcon() {
  return <span className="peekArrow">›</span>
}

function Field({label,help,children}) {
  return (
    <label className="field">
      <span className="fieldLabel">
        {label}
        {help && <em>{help}</em>}
      </span>

      {children}
    </label>
  )
}

function RouteMap({
  form,
  result,
  routePreview,
  setRoutePreview,
  compact
}) {
  const el = useRef(null)
  const mapRef = useRef(null)

  const layers = useRef({
    sat:null,
    street:null,
    labels:null,
    route:null,
    ports:null,
    ship:null,
    origin:null,
    dest:null
  })

  const [base,setBase] =
    useState('satellite')

  const [showPorts,setShowPorts] =
    useState(true)

  const activeRoute =
    result?.route?.coordinates?.length
      ? result.route
      : routePreview

  const route =
    safeRouteCoordinates(
      activeRoute?.coordinates
    )

  const distance =
    Number(
      activeRoute?.distance_nm || 0
    )

  const travelMin =
    distance > 0
      ? Math.max(
          1,
          Math.round(distance / 320)
        )
      : 0

  const travelMax =
    distance > 0
      ? Math.max(
          travelMin + 1,
          Math.round(distance / 250)
        )
      : 0

  const vName =
    result?.best_vessel ||
    form.vessel_type

  const v = vessel(vName)

  const origin =
    safePoint(
      PORT_COORDS[form.origin_port]
    )

  const dest =
    safePoint(
      PORT_COORDS[form.destination_port]
    )

  const shipPoint =
    route.length > 1
      ? route[
          Math.min(
            route.length - 1,
            Math.max(
              1,
              Math.floor(route.length * 0.56)
            )
          )
        ]
      : null

  useEffect(() => {
    if (!el.current || mapRef.current) {
      return
    }

    const map = L.map(el.current, {
      zoomControl:false,
      attributionControl:true,
      worldCopyJump:true,
      minZoom:2
    })

    const sat =
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom:18,
          attribution:'Tiles © Esri'
        }
      )

    const street =
      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom:19,
          attribution:'© OpenStreetMap contributors'
        }
      )

    const labels =
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom:18,
          opacity:0.75,
          attribution:'Esri reference labels & boundaries'
        }
      )

    sat.addTo(map)
    labels.addTo(map)

    layers.current.sat = sat
    layers.current.street = street
    layers.current.labels = labels

    const routeLayer =
      L.polyline(
        [],
        {
          color:'#ffd21f',
          weight:5,
          dashArray:'12 10',
          lineCap:'round',
          lineJoin:'round',
          opacity:.96,
          interactive:false
        }
      ).addTo(map)

    layers.current.route =
      routeLayer

    const group =
      L.layerGroup().addTo(map)

    layers.current.ports =
      group

    Object.entries(PORT_COORDS)
      .forEach(([name, coord]) => {
        const point = safePoint(coord)

        if (!point) return

        const marker =
          L.circleMarker(
            point,
            {
              radius:4,
              weight:1,
              color:'#e7f5ff',
              fillColor:'#19aafc',
              fillOpacity:.62,
              opacity:.75
            }
          )

        marker.bindTooltip(
          `<b>${name}</b><br/><span>${PORT_COUNTRY[name] || ''}</span>`,
          {
            sticky:true,
            direction:'top'
          }
        )

        marker.addTo(group)
      })

    layers.current.origin =
      L.circleMarker(
        origin || [0,0],
        {
          radius:8,
          color:'#fff',
          weight:2,
          fillColor:'#ff5f67',
          fillOpacity:1
        }
      ).addTo(map)

    layers.current.dest =
      L.circleMarker(
        dest || [0,0],
        {
          radius:8,
          color:'#fff',
          weight:2,
          fillColor:'#25c98b',
          fillOpacity:1
        }
      ).addTo(map)

    layers.current.ship =
      L.marker(
        shipPoint ||
          origin ||
          [0,0],
        {
          icon:L.divIcon({
            className:'shipDivIcon',
            html:'🚢',
            iconSize:[30,30],
            iconAnchor:[15,15]
          })
        }
      ).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()

      mapRef.current = null

      layers.current = {
        sat:null,
        street:null,
        labels:null,
        route:null,
        ports:null,
        ship:null,
        origin:null,
        dest:null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current

    if (!map) return

    if (base === 'satellite') {
      if (!map.hasLayer(layers.current.sat)) {
        layers.current.sat.addTo(map)
      }

      if (
        map.hasLayer(
          layers.current.street
        )
      ) {
        map.removeLayer(
          layers.current.street
        )
      }
    } else {
      if (
        !map.hasLayer(
          layers.current.street
        )
      ) {
        layers.current.street.addTo(map)
      }

      if (
        map.hasLayer(
          layers.current.sat
        )
      ) {
        map.removeLayer(
          layers.current.sat
        )
      }
    }

    if (layers.current.route) {
      layers.current.route.setLatLngs(route)
    }

    if (origin) {
      layers.current.origin?.setLatLng(origin)
    }

    if (dest) {
      layers.current.dest?.setLatLng(dest)
    }

    if (shipPoint) {
      layers.current.ship?.setLatLng(shipPoint)
    }

    layers.current.origin?.setTooltipContent(
      `<b>${form.origin_port || 'Origin'}</b><br/>Origin · ${form.origin_country || ''}`
    )

    layers.current.dest?.setTooltipContent(
      `<b>${form.destination_port || 'Destination'}</b><br/>Destination · ${form.destination_country || ''}`
    )

    layers.current.ship?.setTooltipContent(
      `${vName} · selected vessel`
    )

    layers.current.ports?.eachLayer(
      m =>
        m.setStyle({
          opacity: showPorts ? .75 : 0,
          fillOpacity: showPorts ? .62 : 0
        })
    )

    if (route.length > 1) {
      map.fitBounds(
        L.latLngBounds(route),
        {
          padding:[42,42],
          animate:false,
          maxZoom:5
        }
      )
    } else if (origin && dest) {
      map.fitBounds(
        L.latLngBounds([origin,dest]),
        {
          padding:[42,42],
          animate:false,
          maxZoom:5
        }
      )
    }
  }, [
    base,
    showPorts,
    JSON.stringify(route),
    form.origin_port,
    form.destination_port,
    form.origin_country,
    form.destination_country,
    vName
  ])

  return (
    <section
      className={`panel routePanel ${
        compact ? 'compact' : ''
      }`}
    >
      <div className="routeHeader">
        <div>
          <div className="eyebrow">
            <Globe2 size={15}/>
            GLOBAL SHIPPING ROUTE
          </div>

          <h2>
            {form.origin_port}
            {' '}
            <span>→</span>
            {' '}
            {form.destination_port}
          </h2>

          <p>
            {
              activeRoute?.selection_method ||
              'Select ports to load the maritime route.'
            }
          </p>
        </div>

        <div className="legend">
          <span>
            <i className="dot red"/>
            Origin Port
          </span>

          <span>
            <i className="dot green"/>
            Destination Port
          </span>

          <span>
            <i className="dot yellow"/>
            ML Shipping Route
          </span>
        </div>
      </div>

      <div className="mapShell">
        <div
          ref={el}
          className="leafletMap"
        ></div>

        <div className="mapToolbar">
          <button
            className={
              base === 'satellite'
                ? 'mapBtn active'
                : 'mapBtn'
            }
            onClick={() => setBase('satellite')}
          >
            <Layers size={14}/>
            Satellite
          </button>

          <button
            className={
              base === 'street'
                ? 'mapBtn active'
                : 'mapBtn'
            }
            onClick={() => setBase('street')}
          >
            <Globe2 size={14}/>
            Map
          </button>

          <button
            className="mapBtn"
            onClick={() =>
              route.length > 1 &&
              mapRef.current?.fitBounds(
                L.latLngBounds(route),
                {
                  padding:[42,42],
                  animate:false
                }
              )
            }
          >
            <Target size={14}/>
            Focus Route
          </button>

          <button
            className={
              showPorts
                ? 'mapBtn'
                : 'mapBtn muted'
            }
            onClick={() =>
              setShowPorts(v => !v)
            }
          >
            <MapPin size={14}/>
            {showPorts
              ? 'Showing ports'
              : 'Show ports'}
          </button>
        </div>

        <div className="mapZoom">
          <button
            onClick={() =>
              mapRef.current?.zoomIn()
            }
          >
            <ZoomIn size={15}/>
          </button>

          <button
            onClick={() =>
              mapRef.current?.zoomOut()
            }
          >
            <ZoomOut size={15}/>
          </button>
        </div>

        <div className="mapBadge">
          {Object.keys(PORT_COORDS).length} ports mapped
        </div>

      </div>

      <div className="routeInfo">
        <div className="routeInfoTitle">
          <RouteIcon size={16}/>
          Route information
        </div>

        <div className="routeInfoGrid">
          <div>
            <span>Origin port</span>
            <b>{form.origin_port}</b>
          </div>

          <div>
            <span>Destination port</span>
            <b>{form.destination_port}</b>
          </div>

          <div>
            <span>Distance (approx.)</span>
            <b>
              {distance
                ? `${money(distance)} nm`
                : 'Waiting for route'}
            </b>
          </div>

          <div>
            <span>Estimated travel time</span>
            <b>
              {distance
                ? `${travelMin}–${travelMax} days`
                : '—'}
            </b>
          </div>

          <div className="wide">
            <span>Shipping route</span>
            <b>
              {
                activeRoute?.label ||
                routeLabel(
                  form.origin_country,
                  form.destination_country
                )
              }
            </b>
          </div>
        </div>

        <div className="routeVessel">
          <Ship size={16}/>

          <div>
            <b>{vName}</b>

            <span>
              {v.min.toLocaleString()}–
              {v.max.toLocaleString()} DWT · selected vessel
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function VesselGallery({selected,onSelect}) {
  return (
    <section className="panel vesselGallery">
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">
            <Ship size={15}/>
            VESSEL TYPES
          </div>

          <h3>
            Select a vessel type and see its specifications
          </h3>
        </div>
      </div>

      <div className="vesselRail">
        {VESSELS.map(v => (
          <button
            type="button"
            key={v.name}
            className={
              selected === v.name
                ? 'vesselCard selected'
                : 'vesselCard'
            }
            onClick={() => onSelect(v.name)}
          >
            <img
              src={v.image}
              alt={v.name}
            />

            <div>
              <b>{v.name}</b>

              <span>
                {v.min.toLocaleString()}–
                {v.max.toLocaleString()} DWT
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function SelectedVessel({form}) {
  const v = vessel(form.vessel_type)

  return (
    <section className="panel selectedVessel">
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">
            <Ship size={15}/>
            SELECTED VESSEL DETAILS
          </div>

          <h3>{v.name} Bulk Carrier</h3>
        </div>
      </div>

      <div className="selectedGrid">
        <div className="selectedIntro">
          <img
            src={v.image}
            alt={v.name}
          />

          <div>
            <h2>{v.name} Bulk Carrier</h2>

            <strong>
              {v.min.toLocaleString()}–
              {v.max.toLocaleString()} DWT
            </strong>

            <p>
              {v.description}.
              {' '}
              Current shipment:
              {' '}
              <b>
                {money(form.quantity_tonnes)} tonnes
              </b>.
            </p>
          </div>
        </div>

        <div className="specTable">
          <Spec
            icon={Scale}
            label="Typical Deadweight (DWT)"
            value={`${money(v.min)}–${money(v.max)}`}
          />

          <Spec
            icon={RulerIcon}
            label="Length Overall (LOA)"
            value={`~${v.loa} m`}
          />

          <Spec
            icon={RulerIcon}
            label="Beam"
            value={`~${v.beam} m`}
          />

          <Spec
            icon={AnchorIcon}
            label="Typical Draft"
            value={`~${v.draft} m`}
          />

          <Spec
            icon={Warehouse}
            label="Typical Cargo Holds"
            value={`${v.holds}`}
          />

          <Spec
            icon={Ship}
            label="Common Usage"
            value={v.usage}
          />
        </div>
      </div>
    </section>
  )
}

function RulerIcon({size=14}) {
  return <span className="specGlyph">↔</span>
}

function AnchorIcon({size=14}) {
  return <span className="specGlyph">⚓</span>
}

function Spec({icon:Icon,label,value}) {
  return (
    <div>
      <span>
        <Icon size={14}/>
        {label}
      </span>

      <b>{value}</b>
    </div>
  )
}

function Results({
  result,
  form,
  onCompare,
  onOutlook,
  exportBrief,
  onDataAnalysis,
  onWhatIf
}) {
  if (!result) {
    return (
      <section className="panel resultsEmpty">
        <div className="emptyResultIcon">
          <TrendingUp size={22}/>
        </div>

        <h3>Prediction results</h3>

        <p>
          Run the shipment scenario to reveal the
          freight forecast, vessel recommendation,
          charter month, cost and indicative savings.
        </p>
      </section>
    )
  }

  const userCost =
    Number(form.quantity_tonnes) * Number(form.fuel_price_usd_tonne)

  const aiCost = Number(result.estimated_total_cost)

  const savingsPercent =
    userCost > 0
      ? ((userCost - aiCost) / userCost) * 100
      : 0

  return (
    <section className="panel resultsPanel">
      <div className="resultsHeader">
        <div>
          <div className="eyebrow success">
            <TrendingUp size={15}/>
            PREDICTION RESULTS
          </div>

          <h2>Decision brief</h2>

          <p>
            {form.cargo_type}
            {' · '}
            {money(form.quantity_tonnes)}
            {' tonnes · '}
            {form.origin_port}
            {' → '}
            {form.destination_port}
          </p>
        </div>

        <div className="resultActions">
          <button
            className="secondaryBtn small"
            onClick={onCompare}
          >
            Compare Vessels
          </button>

          <button
            className="secondaryBtn small"
            onClick={onOutlook}
          >
            12-Month Outlook
          </button>

          <button
            className="secondaryBtn small"
            onClick={onDataAnalysis}
          >
            <Activity size={14}/>
            Live Analysis
          </button>

          <button
            className="secondaryBtn small"
            onClick={onWhatIf}
          >
            <FlaskConical size={14}/>
            What-If
          </button>

          <button
            className="exportBtn"
            onClick={exportBrief}
          >
            <Package size={14}/>
            Export
          </button>
        </div>
      </div>

      <div className="metricHero">
        <span>Predicted Freight Rate</span>

        <b>
          $
          {Number(
            result.predicted_freight_rate
          ).toFixed(2)}
          {' '}
          <small>/ tonne</small>
        </b>

        <em>AI forecast</em>
      </div>

      <div className="metricGrid">
        <Metric
          icon={Package}
          label="Estimated Total Cost"
          value={`$${money(result.estimated_total_cost)}`}
        />

        <Metric
          icon={TrendingDown}
          label="Estimated Savings"
          value={`${savingsPercent.toFixed(1)}%`}
        />

        <Metric
          icon={Ship}
          label="Recommended Vessel"
          value={result.best_vessel}
        />

        <Metric
          icon={CalendarDays}
          label="Best Charter Month"
          value={result.best_charter_month}
        />
      </div>

      <div className="resultNote">
        <Check size={17}/>
        Indicative decision-support estimate based on
        historical shipment patterns.
      </div>
    </section>
  )
}

function Metric({icon:Icon,label,value}) {
  return (
    <div className="metric">
      <Icon size={16}/>

      <span>{label}</span>

      <b>{value}</b>
    </div>
  )
}

function RoutesPage({
  form,
  setField,
  setCountry,
  meta,
  routePreview,
  setRoutePreview
}) {
  return (
    <main className="pageWrap">
      <section className="hero compactHero">
        <div>
          <div className="eyebrow">
            <Compass size={14}/>
            ROUTE EXPLORER
          </div>

          <h1>
            See the voyage
            <br/>
            <span>before you charter.</span>
          </h1>

          <p>
            Use satellite imagery, sea-lane corridors,
            ports and route metrics to inspect the
            planning scenario.
          </p>
        </div>
      </section>

      <RouteMap
        form={form}
        routePreview={routePreview}
        setRoutePreview={setRoutePreview}
        compact={false}
      />

      <div className="infoGrid">
        <Feature
          icon={RouteIcon}
          title="Sea-lane corridor"
          text={`${form.origin_port} → ${form.destination_port} · ML-ranked maritime corridor`}
        />

        <Feature
          icon={MapPin}
          title="Port network"
          text="Toggle mapped ports and hover for port name and country."
        />

        <Feature
          icon={Navigation}
          title="Planning estimate"
          text="Distance and sailing time are indicative planning values, not navigation-grade instructions."
        />
      </div>
    </main>
  )
}

function VesselsPage({form,setField}) {
  const [selected,setSelected] =
    useState(form.vessel_type)

  useEffect(() => {
    setSelected(form.vessel_type)
  }, [form.vessel_type])

  const v = vessel(selected)

  return (
    <main className="pageWrap">
      <section className="hero compactHero">
        <div>
          <div className="eyebrow">
            <Ship size={14}/>
            VESSEL GUIDE
          </div>

          <h1>
            Choose the right hull
            <br/>
            <span>for the cargo.</span>
          </h1>

          <p>
            Every dry-bulk class has a different
            capacity envelope, geometry and
            operating role.
          </p>
        </div>
      </section>

      <VesselGallery
        selected={selected}
        onSelect={x => {
          setSelected(x)
          setField('vessel_type',x)
        }}
      />

      <section className="panel fullVessel">
        <div className="fullVesselImage">
          <img
            src={v.image}
            alt={v.name}
          />

          <div className="imageTag">
            {v.name} · dry bulk carrier
          </div>
        </div>

        <div className="fullVesselInfo">
          <div className="eyebrow">
            SELECTED VESSEL
          </div>

          <h2>{v.name}</h2>

          <div className="range">
            {v.min.toLocaleString()}–
            {v.max.toLocaleString()} DWT
          </div>

          <p>{v.description}</p>

          <div className="vesselFacts">
            <div>
              <span>LOA</span>
              <b>{v.loa} m</b>
            </div>

            <div>
              <span>Beam</span>
              <b>{v.beam} m</b>
            </div>

            <div>
              <span>Draft</span>
              <b>{v.draft} m</b>
            </div>

            <div>
              <span>Cargo holds</span>
              <b>{v.holds}</b>
            </div>
          </div>

          <div className="usageLine">
            <b>Common usage:</b>
            {' '}
            {v.usage}
          </div>
        </div>
      </section>
    </main>
  )
}

function InsightsPage({
  result,
  form,
  history,
  setResult,
  setForm,
  onCompare,
  onOutlook
}) {
  return (
    <main className="pageWrap">
      <section className="hero compactHero">
        <div>
          <div className="eyebrow">
            <BarChart3 size={14}/>
            INSIGHTS
          </div>

          <h1>
            Decision insights
            <br/>
            <span>at a glance.</span>
          </h1>

          <p>
            Review your active recommendation and
            previously saved scenarios on this device.
          </p>
        </div>
      </section>

      {!result ? (
        <section className="panel insightsEmpty">
          <BarChart3 size={28}/>

          <h3>
            Run a forecast to unlock insights
          </h3>

          <p>
            After a successful forecast, this page shows
            the recommendation, timing and local
            scenario history.
          </p>

          {history.length > 0 && (
            <div className="historyList">
              {history
                .slice(0,5)
                .map(h => (
                  <button
                    key={h.id}
                    className="historyItem"
                    onClick={() => {
                      setForm(h.input)
                      setResult(h.result)
                    }}
                  >
                    <span>
                      {h.input.origin_port}
                      {' → '}
                      {h.input.destination_port}
                    </span>

                    <b>
                      $
                      {Number(
                        h.result.predicted_freight_rate
                      ).toFixed(2)}
                      /t
                    </b>

                    <small>
                      {new Date(
                        h.created_at
                      ).toLocaleString()}
                    </small>
                  </button>
                ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="insightGrid">
            <Feature
              icon={TrendingDown}
              title="Freight signal"
              text={`Forecast: $${Number(
                result.predicted_freight_rate
              ).toFixed(2)}/t for the current scenario.`}
            />

            <Feature
              icon={Ship}
              title="Vessel fit"
              text={`${result.best_vessel} is the leading vessel under the current cost-utilization scoring.`}
            />

            <Feature
              icon={CalendarDays}
              title="Charter timing"
              text={`${result.best_charter_month} is the lowest indicative month in this scenario.`}
            />

            <Feature
              icon={Package}
              title="Procurement"
              text={`${money(result.recommended_procurement_tonnes)} tonnes recommended for the selected plan.`}
            />
          </div>

          <section className="panel insightActions">
            <div>
              <div className="eyebrow">
                DECISION TOOLS
              </div>

              <h2>
                Inspect the recommendation
              </h2>

              <p>
                {form.origin_port}
                {' → '}
                {form.destination_port}
                {' · '}
                {form.cargo_type}
                {' · '}
                {money(form.quantity_tonnes)}
                {' tonnes'}
              </p>
            </div>

            <div>
              <button
                className="secondaryBtn"
                onClick={onCompare}
              >
                Compare vessels
                <ArrowRight size={15}/>
              </button>

              <button
                className="primaryBtn"
                onClick={onOutlook}
              >
                12-month outlook
                <CalendarDays size={15}/>
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  )
}

function AboutPage() {
  return (
    <main className="pageWrap aboutPage">
      <section className="aboutHero">
        <div className="aboutHeroContent">
          <div className="eyebrow">
            <Info size={14}/>
            ABOUT THE PLATFORM
          </div>

          <h1>
            Maritime intelligence
            <br/>
            <span>for better chartering.</span>
          </h1>

          <p>
            Freight Intelligence is a decision-support
            workspace for bulk cargo planning,
            combining historical shipment patterns
            with route, vessel and cost context.
          </p>
        </div>

        <div className="aboutHeroVisual">
          <img
            src="/global-shipping-routes1.png"
            alt="Global maritime shipping network"
          />

          <div className="aboutHeroOverlay">
            <span>
              GLOBAL MARITIME NETWORK
            </span>

            <strong>
              Connecting global trade with intelligent
              decisions
            </strong>
          </div>
        </div>
      </section>

      <div className="aboutCards">
        <Feature
          icon={Gauge}
          title="Freight forecast"
          text="A trained regression model estimates freight rate from shipment, route, vessel, fuel and congestion inputs."
        />

        <Feature
          icon={Ship}
          title="Vessel intelligence"
          text="Capacity ranges, dimensions and cargo-use guidance explain the vessel recommendation."
        />

        <Feature
          icon={Globe2}
          title="Route planning"
          text="2D satellite mapping keeps the voyage visible over practical offshore corridors."
        />

        <Feature
          icon={TrendingDown}
          title="Cost awareness"
          text="The decision brief connects freight, vessel fit, charter timing and indicative savings."
        />
      </div>

      <section className="gridwalkersSection">
        <div className="gridwalkersMain">
          <div className="eyebrow">
            <Sparkles size={14}/>
            OUR TEAM
          </div>

          <h2>
            Built by <span>Hexacoders</span> for smarter
            maritime decisions.
          </h2>

          <p className="gridwalkersIntro">
            Hexacoders developed this platform to help
            bulk cargo planners make faster and more
            informed decisions using machine learning,
            maritime route intelligence, vessel analysis
            and freight forecasting.
          </p>

          <div className="gridwalkersFeatures">
            <div className="gridwalkersCard">
              <div className="gridwalkersIcon">
                <TrendingDown size={20}/>
              </div>

              <div>
                <h3>Freight Forecasting</h3>
                <p>
                  Predict freight rates from shipment
                  and market conditions.
                </p>
              </div>
            </div>

            <div className="gridwalkersCard">
              <div className="gridwalkersIcon">
                <Ship size={20}/>
              </div>

              <div>
                <h3>Vessel Intelligence</h3>
                <p>
                  Identify suitable vessel classes for
                  the cargo requirement.
                </p>
              </div>
            </div>

            <div className="gridwalkersCard">
              <div className="gridwalkersIcon">
                <Navigation size={20}/>
              </div>

              <div>
                <h3>Route Planning</h3>
                <p>
                  Visualize practical offshore maritime
                  corridors.
                </p>
              </div>
            </div>

            <div className="gridwalkersCard">
              <div className="gridwalkersIcon">
                <Warehouse size={20}/>
              </div>

              <div>
                <h3>Cost Optimization</h3>
                <p>
                  Compare charter timing, freight cost
                  and potential savings.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="gridwalkersVisual">
          <img
            src="/global-shipping-routes2.png"
            alt="Maritime vessel and shipping network"
          />

          <div className="gridwalkersQuote">
            <span>
              “Smarter data.
              <br/>
              Safer voyages.
              <br/>
              A cleaner tomorrow.”
            </span>

            <i></i>
          </div>
        </div>

        <div className="gridwalkersFooter">
          <div className="gridwalkersBrand">
            <div className="gridwalkersSymbol">
              ≋
            </div>

            <div>
              <strong>HEXACODERS</strong>

              <span>
                Intelligent Freight Forecasting for Optimized
                Vessel Chartering and Bulk Cargo Procurement
              </span>
            </div>
          </div>

          <div className="gridwalkersValues">
            <div>
              <span>◒</span>
              <p>
                Sustainable
                <br/>
                Shipping
              </p>
            </div>

            <div>
              <span>◎</span>
              <p>
                Global
                <br/>
                Connectivity
              </p>
            </div>

            <div>
              <span>◈</span>
              <p>
                AI for a
                <br/>
                Better Tomorrow
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function CompareModal({result,onClose}) {
  return (
    <Modal
      title="Compare vessels"
      onClose={onClose}
      wide
    >
      <div className="compareGrid">
        {result.vessel_comparison.map((v,i) => (
          <div
            className={
              i === 0
                ? 'compareCard best'
                : 'compareCard'
            }
            key={v.vessel_type}
          >
            <div className="rank">
              #{i+1}
            </div>

            <h3>{v.vessel_type}</h3>

            <p>
              {money(v.capacity_tonnes)}
              {' t planning capacity'}
            </p>

            <div>
              <span>Trips</span>
              <b>{v.trips}</b>
            </div>

            <div>
              <span>Indicative rate</span>
              <b>
                ${Number(
                  v.indicative_rate
                ).toFixed(2)}/t
              </b>
            </div>

            <div>
              <span>Utilization</span>
              <b>
                {Math.round(
                  v.utilization * 100
                )}%
              </b>
            </div>

            <div>
              <span>Estimated cost</span>
              <b>
                ${money(v.estimated_cost)}
              </b>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function OutlookModal({result,onClose}) {
  const min =
    Math.min(
      ...result.monthly_outlook.map(
        x => x.rate
      )
    )

  const max =
    Math.max(
      ...result.monthly_outlook.map(
        x => x.rate
      )
    )

  return (
    <Modal
      title="12-month charter outlook"
      onClose={onClose}
    >
      <div className="outlookLead">
        <b>
          Best planning month:
          {' '}
          {result.best_charter_month}
        </b>

        <span>
          Compare indicative freight across all
          twelve months for this same scenario.
        </span>
      </div>

      <div className="outlookRows">
        {result.monthly_outlook.map(m => {
          const width =
            24 +
            (
              (m.rate - min) /
              Math.max(.01,max-min)
            ) * 72

          return (
            <div
              className={
                m.month === result.best_charter_month
                  ? 'outlookRow best'
                  : 'outlookRow'
              }
              key={m.month}
            >
              <span>
                {m.month.slice(0,3)}
              </span>

              <div>
                <i
                  style={{
                    width:`${width}%`
                  }}
                ></i>
              </div>

              <b>
                ${Number(
                  m.rate
                ).toFixed(1)}
              </b>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

function HelpModal({onClose}) {
  return (
    <Modal
      title="How to use Freight Intelligence"
      onClose={onClose}
    >
      <div className="helpContent">
        <div>
          <b>1. Choose your route</b>
          <span>
            Country selection filters ports automatically.
          </span>
        </div>

        <div>
          <b>2. Enter shipment conditions</b>
          <span>
            Cargo, quantity, vessel, fuel and congestion
            feed the forecast.
          </span>
        </div>

        <div>
          <b>3. Inspect the sea route</b>
          <span>
            Use Satellite, Map, Focus Route and Show Ports
            on the map.
          </span>
        </div>

        <div>
          <b>4. Run the forecast</b>
          <span>
            Review freight, vessel fit, charter month,
            cost and indicative savings.
          </span>
        </div>

        <div>
          <b>5. Use decision tools</b>
          <span>
            Compare vessels or open the 12-month outlook
            for the current scenario.
          </span>
        </div>
      </div>
    </Modal>
  )
}

function Modal({
  title,
  onClose,
  children,
  wide=false
}) {
  return (
    <div
      className="modalBackdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={
          wide
            ? 'modal wide'
            : 'modal'
        }
      >
        <div className="modalHead">
          <h2>{title}</h2>

          <button onClick={onClose}>
            <X size={17}/>
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}

export default function AppWithErrorBoundary() {
  return (
    <AppErrorBoundary>
      <App/>
    </AppErrorBoundary>
  )
}

function LiveLineChart({data, valueKey, label, unit, maxPoints=24}) {
  const points = (data || []).slice(0, maxPoints)
  if (!points.length) return <div className="analysisChartEmpty">Waiting for live telemetry…</div>

  const values = points.map(p => Number(p[valueKey] ?? 0))
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)
  const width = 720
  const height = 220
  const pad = 28
  const path = values.map((v, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(values.length - 1, 1)
    const y = height - pad - ((v - min) / range) * (height - pad * 2)
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')

  return (
    <div className="analysisChartBlock">
      <div className="analysisChartTitle">
        <div><b>{label}</b><span>Live 24-hour outlook</span></div>
        <strong>{values[0].toFixed(1)} {unit}</strong>
      </div>
      <svg className="analysisChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} live chart`}>
        <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} className="analysisAxis" />
        <line x1={pad} y1={pad} x2={pad} y2={height-pad} className="analysisAxis" />
        <path d={path} className="analysisLine" />
        {values.map((v,i) => {
          const x = pad + (i * (width - pad * 2)) / Math.max(values.length - 1, 1)
          const y = height - pad - ((v - min) / range) * (height - pad * 2)
          return <circle key={i} cx={x} cy={y} r="2.5" className="analysisPoint" />
        })}
        <text x={pad} y={height-8} className="analysisAxisText">Now</text>
        <text x={width-pad} y={height-8} textAnchor="end" className="analysisAxisText">+23h</text>
        <text x={pad-6} y={pad+4} textAnchor="end" className="analysisAxisText">{max.toFixed(1)}</text>
        <text x={pad-6} y={height-pad} textAnchor="end" className="analysisAxisText">{min.toFixed(1)}</text>
      </svg>
    </div>
  )
}

function DataAnalysisPage({destinationPort, result, onSelectPort}) {
  const [port, setPort] = useState(destinationPort || 'Paradip')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (destinationPort) setPort(destinationPort)
  }, [destinationPort])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const payload = await fetchJSON(`/api/realtime-analysis?port=${encodeURIComponent(port)}`)
      setData(payload)
    } catch (e) {
      setError(e.message || 'Unable to load live analysis.')
    } finally {
      setLoading(false)
    }
  }, [port])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [load])

  const hourly = data?.hourly || []
  const current = data?.current || {}
  const riskAvg = hourly.length
    ? hourly.reduce((sum, p) => sum + Number(p.risk_score || 0), 0) / hourly.length
    : 0

  return (
    <main className="pageWrap">
      <section className="hero compactHero">
        <div>
          <div className="eyebrow"><Activity size={14}/> LIVE DATA ANALYSIS</div>
          <h1>Real-time data analysis<br/><span>see the signal, not just the number.</span></h1>
          <p>Live Open-Meteo port telemetry is refreshed automatically and converted into interactive operational-risk trends.</p>
        </div>
        <div className="heroPills">
          <span><Activity size={14}/> Auto refresh · 60 sec</span>
          <span><RadioIcon/> Live API</span>
        </div>
      </section>

      <section className="panel analysisControlPanel">
        <div className="analysisControls">
          <div>
            <div className="eyebrow">MONITORED TERMINAL</div>
            <select value={port} onChange={e => { setPort(e.target.value); onSelectPort?.(e.target.value) }}>
              {['Paradip','Dhamra','Haldia','Chennai','Visakhapatnam','Kolkata','Mundra','Kandla'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <button className="secondaryBtn small" onClick={load} disabled={loading}><RefreshCcw size={14} className={loading ? 'spinningIcon' : ''}/> {loading ? 'Updating…' : 'Refresh live data'}</button>
          <div className="analysisLiveBadge"><i/> {data?.is_live ? 'LIVE FEED' : 'WAITING'}</div>
        </div>
      </section>

      {error && <div className="errorBar"><span>{error}</span></div>}

      <div className="metricGrid analysisMetrics">
        <Metric icon={CloudSun} label="Current Temperature" value={`${current.temperature_c ?? '—'} °C`} />
        <Metric icon={Navigation} label="Wind Speed" value={`${current.wind_speed_kmh ?? '—'} km/h`} />
        <Metric icon={TrendingUp} label="24h Avg Risk" value={`${riskAvg.toFixed(0)} / 100`} />
        <Metric icon={Package} label="Forecast Freight" value={result ? `$${Number(result.predicted_freight_rate).toFixed(2)}/t` : 'Run forecast'} />
      </div>

      <section className="panel analysisChartsPanel">
        <div className="sectionHeading">
          <div><div className="eyebrow">REAL-TIME GRAPHING</div><h3>{port} telemetry trend</h3></div>
          <span className="analysisTimestamp">{data?.generated_at ? `Updated ${new Date(data.generated_at).toLocaleTimeString()}` : 'Loading live feed…'}</span>
        </div>
        <div className="analysisChartsGrid">
          <LiveLineChart data={hourly} valueKey="wind_speed_kmh" label="Wind speed" unit="km/h" />
          <LiveLineChart data={hourly} valueKey="risk_score" label="Operational risk" unit="/100" />
          <LiveLineChart data={hourly} valueKey="precipitation_mm" label="Precipitation" unit="mm" />
        </div>
      </section>

      <section className="panel analysisTablePanel">
        <div className="sectionHeading"><div><div className="eyebrow">DATA SNAPSHOT</div><h3>Next 24 hours</h3></div></div>
        <div className="analysisTableWrap">
          <table className="analysisTable"><thead><tr><th>Time</th><th>Wind</th><th>Gust</th><th>Rain</th><th>Wave</th><th>Risk</th></tr></thead>
            <tbody>{hourly.slice(0,12).map((p,i) => <tr key={`${p.time}-${i}`}><td>{new Date(p.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td><td>{p.wind_speed_kmh ?? '—'} km/h</td><td>{p.wind_gust_kmh ?? '—'} km/h</td><td>{p.precipitation_mm ?? '—'} mm</td><td>{p.wave_height_m ?? '—'} m</td><td>{Number(p.risk_score || 0).toFixed(0)}/100</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function RadioIcon() { return <span style={{fontSize:12}}>◉</span> }

function WhatIfScenario({baseForm, meta}) {
  const [scenario, setScenario] = useState(baseForm)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setScenario(baseForm) }, [baseForm])

  const run = useCallback(async () => {
    if (!scenario?.origin_port || !scenario?.destination_port) return
    try {
      setLoading(true)
      setError('')
      const payload = {
        base: baseForm,
        quantity_tonnes: Number(scenario.quantity_tonnes),
        fuel_price_usd_tonne: Number(scenario.fuel_price_usd_tonne),
        port_congestion: Number(scenario.port_congestion),
        vessel_type: scenario.vessel_type,
        month: scenario.month,
      }
      const data = await fetchJSON('/api/what-if', {method:'POST', body:JSON.stringify(payload)})
      setResult(data)
    } catch (e) {
      setError(e.message || 'Unable to run what-if simulation.')
    } finally {
      setLoading(false)
    }
  }, [baseForm, scenario])

  useEffect(() => {
    const timer = setTimeout(run, 450)
    return () => clearTimeout(timer)
  }, [run])

  const set = (key, value) => setScenario(s => ({...s, [key]: value}))
  const delta = result?.delta?.freight_rate_usd_tonne || 0
  const direction = result?.direction || 'unchanged'
  const reasons = []
  if (result && Number(scenario.fuel_price_usd_tonne) !== Number(baseForm.fuel_price_usd_tonne)) reasons.push('Fuel price was changed.')
  if (result && Number(scenario.port_congestion) !== Number(baseForm.port_congestion)) reasons.push('Port congestion was changed.')
  if (result && Number(scenario.quantity_tonnes) !== Number(baseForm.quantity_tonnes)) reasons.push('Cargo quantity was changed.')
  if (result && scenario.vessel_type !== baseForm.vessel_type) reasons.push('Vessel class was changed.')
  if (result && scenario.month !== baseForm.month) reasons.push('Charter month was changed.')

  return (
    <main className="whatif-page pageWrap">
      <section className="whatif-hero">
        <div className="whatif-hero-content">
          <div className="whatif-eyebrow"><FlaskConical size={15}/> LIVE WHAT-IF ANALYSIS</div>
          <h1>Change the scenario.<br/><span>see the model react.</span></h1>
          <p>Every input change is sent to the same live forecasting service used by the main result, so the comparison stays tied to the current route and CatBoost model.</p>
        </div>
        <div className="whatif-hero-orbit"><div className="whatif-orbit-ring"/><div className="whatif-orbit-core"><SlidersHorizontal size={28}/></div></div>
      </section>

      <div className="whatif-main-grid">
        <section className="whatif-panel">
          <div className="whatif-panel-header"><div><h2>Scenario controls</h2><p>Updates automatically while you adjust the inputs.</p></div><div className="whatif-panel-icon"><SlidersHorizontal size={19}/></div></div>
          <div className="whatif-fields">
            <label className="whatif-field"><div className="whatif-field-header"><span>Cargo quantity</span><strong>{money(scenario.quantity_tonnes)} t</strong></div><input type="range" min="100" max="350000" step="100" value={scenario.quantity_tonnes} onChange={e=>set('quantity_tonnes', Number(e.target.value))}/><div className="whatif-range-labels"><span>100 t</span><span>350,000 t</span></div></label>
            <label className="whatif-field"><div className="whatif-field-header"><span>Fuel price</span><strong>${Number(scenario.fuel_price_usd_tonne).toFixed(0)}/t</strong></div><input type="range" min="200" max="1200" step="10" value={scenario.fuel_price_usd_tonne} onChange={e=>set('fuel_price_usd_tonne', Number(e.target.value))}/><div className="whatif-range-labels"><span>$200</span><span>$1,200</span></div></label>
            <label className="whatif-field"><div className="whatif-field-header"><span>Port congestion</span><strong>{(Number(scenario.port_congestion)*100).toFixed(0)}%</strong></div><input type="range" min="0" max="1" step="0.01" value={scenario.port_congestion} onChange={e=>set('port_congestion', Number(e.target.value))}/><div className="whatif-range-labels"><span>0%</span><span>100%</span></div></label>
            <label className="whatif-field"><div className="whatif-field-header"><span>Vessel type</span></div><select value={scenario.vessel_type} onChange={e=>set('vessel_type',e.target.value)}>{(meta?.vessel_types || ['Handysize','Handymax','Supramax','Ultramax','Panamax','Kamsarmax','Post-Panamax','Capesize','Newcastlemax','VLOC']).map(v=><option key={v}>{v}</option>)}</select></label>
          </div>
          <div className="whatif-select-grid">
            <label><div className="whatif-select-label">Charter month</div><select className="whatif-select-field" value={scenario.month} onChange={e=>set('month',e.target.value)}>{(meta?.months || MONTHS).map(m=><option key={m}>{m}</option>)}</select></label>
            <div><div className="whatif-select-label">Route</div><div className="whatif-select-field" style={{display:'flex',alignItems:'center'}}>{scenario.origin_port} → {scenario.destination_port}</div></div>
          </div>
          <div className="whatif-action-row"><span style={{marginRight:'auto',fontSize:9,color:'#38BDF8'}}>{loading ? 'Live simulation running…' : result ? 'Live simulation current' : 'Waiting for valid scenario'}</span><button className="whatif-run-button" onClick={run} disabled={loading}><Activity size={14}/> Recalculate now</button></div>
          {error && <div className="whatif-error">{error}</div>}
        </section>

        <section className="whatif-panel">
          <div className="whatif-result-card-header"><div><h3>Live comparison</h3><p>Baseline versus your current scenario.</p></div><div className="whatif-panel-icon"><TrendingUp size={18}/></div></div>
          {!result ? <div className="whatif-empty"><div><div className="whatif-empty-icon"><Activity size={25}/></div><h3>Waiting for model output</h3><p>Move a control or press recalculate to run the scenario through the forecasting model.</p><div className="whatif-empty-flow">INPUT → ROUTE → CATBOOST → COST → COMPARISON</div></div></div> : (
            <div className="whatif-results">
              <div className="whatif-result-card"><div className="whatif-result-header"><h2>{delta >= 0 ? '+' : ''}${delta.toFixed(2)}/t</h2><span className="whatif-risk-badge"><i className="whatif-risk-dot"/>{direction.toUpperCase()} VS BASELINE</span></div>
                <div className="whatif-metrics"><div className="whatif-metric-card"><div className="whatif-metric-icon"><TrendingUp size={15}/></div><div className="whatif-metric-content"><span>Scenario rate</span><strong>${Number(result.scenario.predicted_freight_rate).toFixed(2)}/t</strong></div></div><div className="whatif-metric-card"><div className="whatif-metric-icon"><Package size={15}/></div><div className="whatif-metric-content"><span>Total cost delta</span><strong>{result.delta.total_cost_usd >= 0 ? '+' : ''}${money(result.delta.total_cost_usd)}</strong></div></div></div>
                <div className="whatif-cost-list"><div><span>Baseline freight</span><strong>${Number(result.baseline.predicted_freight_rate).toFixed(2)}/t</strong></div><div><span>Scenario freight</span><strong>${Number(result.scenario.predicted_freight_rate).toFixed(2)}/t</strong></div><div><span>Rate change</span><strong>{result.delta.freight_rate_percent >= 0 ? '+' : ''}{Number(result.delta.freight_rate_percent).toFixed(2)}%</strong></div></div>
              </div>
              <div className="whatif-operation-grid"><div><span>Distance</span><strong>{money(result.scenario.distance_nm)} nm</strong></div><div><span>Vessel</span><strong>{result.scenario.best_vessel}</strong></div><div><span>Month</span><strong>{result.scenario.month}</strong></div></div>
              <div className="whatif-explanation"><div className="whatif-explanation-title">Scenario drivers</div>{reasons.length ? <ul className="whatif-reasons">{reasons.map(r=><li key={r}>{r}</li>)}</ul> : <div>No inputs differ from the current baseline.</div>}</div>
              {result.live_destination_conditions && <div className="whatif-footer-note">Live destination conditions: {result.live_destination_conditions.temperature_c ?? '—'}°C · wind {result.live_destination_conditions.wind_speed_kmh ?? '—'} km/h · risk {result.live_destination_conditions.severity ?? '—'}.</div>}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function WeatherPage({ destinationPort, setDestinationPort }) {
  return (
    <main className="pageWrap">

      <section className="hero compactHero">
        <div>
          <div className="eyebrow">
            <CloudSun size={14}/>
            REAL-TIME METEOROLOGY &amp; MARINE INTELLIGENCE
          </div>

          <h1>
            Weather &amp; Risk Intelligence
            <br/>
            <span>live across every global port.</span>
          </h1>

          <p>
            Real-time satellite atmospheric data, ocean wave buoy telemetry, and harbor congestion dynamics for all 50 global ports.
          </p>
        </div>
      </section>

      <WeatherCongestion
        destinationPort={destinationPort}
        onSelectDestinationPort={setDestinationPort}
      />

    </main>
  )
}