
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CloudSun,
  Wind,
  Eye,
  Waves,
  Ship,
  Clock3,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Anchor,
  Navigation,
  ArrowUpRight,
  Gauge,
  RefreshCw,
  Search,
  Thermometer,
  Droplets,
  Radio,
  Filter,
  Globe,
  Sun,
  CloudRain,
  CloudLightning,
  Compass
} from 'lucide-react'
import { PORT_COORDS, PORT_COUNTRY } from './portData'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

const WEATHER_PORTS = [
  'Paradip',
  'Dhamra',
  'Haldia',
  'Chennai',
  'Visakhapatnam',
  'Kolkata',
  'Mundra',
  'Kandla'
]

const QUICK_PORTS = WEATHER_PORTS

function getWeatherIcon(condition = '', size = 56) {
  const c = condition.toLowerCase()
  if (c.includes('thunder') || c.includes('storm') || c.includes('squall')) {
    return <CloudLightning size={size} strokeWidth={1.3} className="text-amber-400" />
  }
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) {
    return <CloudRain size={size} strokeWidth={1.3} className="text-blue-400" />
  }
  if (c.includes('clear') || c.includes('sun')) {
    return <Sun size={size} strokeWidth={1.3} className="text-amber-300" />
  }
  if (c.includes('wind') || c.includes('gale')) {
    return <Wind size={size} strokeWidth={1.3} className="text-cyan-400" />
  }
  return <CloudSun size={size} strokeWidth={1.3} className="text-sky-300" />
}

export default function WeatherCongestion({ destinationPort, onSelectDestinationPort }) {
  const [selectedPort, setSelectedPort] = useState(destinationPort || 'Paradip')
  const [activeTab, setActiveTab] = useState('detail') // 'detail' | 'global'
  const [weather, setWeather] = useState(null)
  const [congestion, setCongestion] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Global All Ports state
  const [allPortsData, setAllPortsData] = useState([])
  const [allPortsLoading, setAllPortsLoading] = useState(false)
  const [radarFilter, setRadarFilter] = useState('ALL') // 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'
  const [radarSearch, setRadarSearch] = useState('')

  // Sync when prop changes
  useEffect(() => {
    if (destinationPort && destinationPort !== selectedPort) {
      setSelectedPort(destinationPort)
    }
  }, [destinationPort])

  // Fetch real-time data for the selected port
  const loadPortConditions = useCallback(async (portToLoad, force = false) => {
    const target = portToLoad || selectedPort || 'Paradip'
    try {
      setLoading(true)
      setError(null)

      const refreshParam = force ? '&refresh=true' : ''
      const [weatherRes, congestionRes] = await Promise.all([
        fetch(`${API}/api/weather?port=${encodeURIComponent(target)}${refreshParam}`),
        fetch(`${API}/api/congestion?port=${encodeURIComponent(target)}`)
      ])

      if (!weatherRes.ok || !congestionRes.ok) {
        throw new Error('Unable to retrieve real-time weather and harbor congestion telemetry.')
      }

      const weatherData = await weatherRes.json()
      const congestionData = await congestionRes.json()

      setWeather(weatherData.weather || weatherData)
      setCongestion(congestionData.congestion || congestionData)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error loading live port telemetry.')
    } finally {
      setLoading(false)
    }
  }, [selectedPort])

  // Fetch all ports data for the global matrix


  // Initial load and on port change
  useEffect(() => {
    loadPortConditions(selectedPort)
  }, [selectedPort, loadPortConditions])
const loadAllPortsRadar = useCallback(async (force = false) => {
  try {
    setAllPortsLoading(true)

    const refreshParam = force ? '&refresh=true' : ''

    const results = await Promise.all(
      WEATHER_PORTS.map(async (port) => {
        try {
          const res = await fetch(
            `${API}/api/weather?port=${encodeURIComponent(port)}${refreshParam}`
          )

          if (!res.ok) {
            throw new Error(`Weather request failed for ${port}`)
          }

          const data = await res.json()

          return {
            ...data,
            port,
            country: PORT_COUNTRY[port] || 'India'
          }
        } catch (error) {
          console.error(`Failed to load weather for ${port}:`, error)
          return null
        }
      })
    )

    setAllPortsData(results.filter(Boolean))
  } catch (err) {
    console.error('Failed to load selected ports radar:', err)
  } finally {
    setAllPortsLoading(false)
  }
}, [])
  // Load global radar on mount or when switching to global tab
  useEffect(() => {
    if (activeTab === 'global' && allPortsData.length === 0) {
      loadAllPortsRadar()
    }
  }, [activeTab, allPortsData.length, loadAllPortsRadar])

  const handlePortChange = (e) => {
    const nextPort = e.target.value
    setSelectedPort(nextPort)
  }

  const handleQuickPortClick = (p) => {
    setSelectedPort(p)
    if (activeTab === 'global') {
      setActiveTab('detail')
    }
  }

  const handleRefresh = () => {
    loadPortConditions(selectedPort, true)
    if (allPortsData.length > 0) {
      loadAllPortsRadar(true)
    }
  }

  const weatherRisk = String(weather?.severity || 'LOW').toUpperCase()
  const congestionRisk = String(congestion?.congestion_level || 'LOW').toUpperCase()

  const overallRisk =
    weatherRisk === 'HIGH' || congestionRisk === 'HIGH'
      ? 'HIGH'
      : weatherRisk === 'MEDIUM' || congestionRisk === 'MEDIUM'
      ? 'MEDIUM'
      : 'LOW'

  // Summary counts for radar
  const radarStats = useMemo(() => {
    if (!allPortsData.length) {
      return { total: Object.keys(PORT_COORDS).length, high: 0, medium: 0, low: 0 }
    }
    const high = allPortsData.filter(p => p.severity === 'HIGH').length
    const medium = allPortsData.filter(p => p.severity === 'MEDIUM').length
    const low = allPortsData.filter(p => p.severity === 'LOW').length
    return { total: allPortsData.length, high, medium, low }
  }, [allPortsData])

  // Filtered radar ports
  const filteredRadarPorts = useMemo(() => {
    return allPortsData.filter((p) => {
      const matchSearch =
        p.port.toLowerCase().includes(radarSearch.toLowerCase()) ||
        (p.country && p.country.toLowerCase().includes(radarSearch.toLowerCase()))
      const matchRisk = radarFilter === 'ALL' || p.severity === radarFilter
      return matchSearch && matchRisk
    })
  }, [allPortsData, radarSearch, radarFilter])

  return (
    <section className="weatherDashboard">
      {/* =====================================================
          TOP CONTROLS: TABS & LIVE BEACON
          ===================================================== */}
      <div className="weatherControlPanel">
        <div className="weatherTabsContainer">
          <div className="weatherNavTabs">
            <button
              className={`weatherTabBtn ${activeTab === 'detail' ? 'active' : ''}`}
              onClick={() => setActiveTab('detail')}
            >
              <Anchor size={15} />
              Port Telemetry &amp; Risk
            </button>
            <button
              className={`weatherTabBtn ${activeTab === 'global' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('global')
                if (allPortsData.length === 0) loadAllPortsRadar()
              }}
            >
              <Globe size={15} />
              Selected Ports Weather Radar ({WEATHER_PORTS.length})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="liveFeedBadge">
              <span className="livePulseDot" />
              LIVE REAL-TIME FEED
            </div>

            <button
              className="refreshTelemetryBtn"
              onClick={handleRefresh}
              disabled={loading || allPortsLoading}
              title="Refresh live data from satellite and marine buoy network"
            >
              <RefreshCw size={14} className={loading || allPortsLoading ? 'spinningIcon' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* =====================================================
            INTERACTIVE PORT SELECTOR BAR
            ===================================================== */}
        <div className="portSelectorBar">
          <div className="portSelectWrapper">
            <Anchor size={17} style={{ color: '#38bdf8', flexShrink: 0 }} />
            <select
              id="realtime-port-select"
              className="portSelectInput"
              value={selectedPort}
              onChange={handlePortChange}
            >
              {WEATHER_PORTS.map((port) => (
  <option key={port} value={port}>
    {port} ({PORT_COUNTRY[port] || 'India'})
  </option>
))}
            </select>
          </div>

          {onSelectDestinationPort && selectedPort !== destinationPort && (
            <button
              className="quickPortChip active"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() => onSelectDestinationPort(selectedPort)}
              title="Set selected port as voyage destination in voyage planner"
            >
              <Ship size={12} />
              Set as Voyage Destination
            </button>
          )}

          {lastUpdated && (
            <span style={{ fontSize: '11px', color: '#799bb8', marginLeft: 'auto' }}>
              Telemetry: {lastUpdated}
            </span>
          )}

          {/* Quick Select Hubs */}
          <div className="quickPortRow">
            <span className="quickPortLabel">Major Trade Hubs:</span>
            {QUICK_PORTS.map((qp) => (
              <button
                key={qp}
                className={`quickPortChip ${selectedPort === qp ? 'active' : ''}`}
                onClick={() => handleQuickPortClick(qp)}
              >
                {qp}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================
          TAB 1: PORT TELEMETRY & VOYAGE RISK
          ===================================================== */}
      {activeTab === 'detail' && (
        <>
          {/* DESTINATION HERO VISUAL */}
          <div className="weatherDestinationCard">
            <div className="destinationInfo">
              <div className="destinationIcon">
                <Anchor size={25} />
              </div>

              <div>
                <div className="cardEyebrow">
                  {selectedPort === destinationPort ? 'VOYAGE DESTINATION PORT' : 'INSPECTED MARITIME TERMINAL'}
                </div>

                <h2>{selectedPort}</h2>

                <p>
                  {PORT_COUNTRY[selectedPort] || 'International'} • Coordinates:{' '}
                  {PORT_COORDS[selectedPort]
                    ? `${PORT_COORDS[selectedPort][0].toFixed(2)}°, ${PORT_COORDS[selectedPort][1].toFixed(2)}°`
                    : '--'}
                </p>
              </div>
            </div>

            <div className="marineVisual">
              <div className="marineCircle circleOne" />
              <div className="marineCircle circleTwo" />
              <Navigation className="marineShip" size={30} />
              <div className="marineRouteLine" />
              <span className="marinePoint pointOne" />
              <span className="marinePoint pointTwo" />
            </div>

            <div className={`riskBadge ${overallRisk.toLowerCase()}`}>
              {overallRisk === 'LOW' ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
              {overallRisk} COMPOSITE RISK
            </div>
          </div>

          {/* ERROR DISPLAY */}
          {error && (
            <div className="weatherError" style={{ marginBottom: '20px' }}>
              <AlertTriangle size={20} />
              <div>
                <strong>Telemetry Connection Issue</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* TELEMETRY INTELLIGENCE GRID */}
          {weather && congestion && (
            <>
              <div className="weatherSectionHeading">
                <div>
                  <div className="cardEyebrow">REAL-TIME OPERATIONAL INTELLIGENCE</div>
                  <h3>Live Conditions for {selectedPort}</h3>
                </div>

                <div className="overallRiskLabel">
                  <span>Overall Port Risk:</span>
                  <strong className={overallRisk.toLowerCase()}>{overallRisk}</strong>
                </div>
              </div>

              <div className="weatherGrid">
                {/* WEATHER CARD */}
                <div className="intelligenceCard">
                  <div className="cardHeader">
                    <div className="cardTitleGroup">
                      <div className="cardIcon weatherIcon">
                        <CloudSun size={22} />
                      </div>
                      <div>
                        <div className="cardEyebrow">LIVE WEATHER API</div>
                        <h3>Atmospheric &amp; Sea State</h3>
                      </div>
                    </div>

                    <span className={`statusPill ${weatherRisk.toLowerCase()}`}>
                      {weatherRisk} RISK
                    </span>
                  </div>

                  <div className="conditionHero">
                    <div>
                      <div className="conditionLabel">CURRENT CONDITION</div>
                      <div className="conditionValue">{weather.condition || 'Clear Sky'}</div>
                      <div style={{ fontSize: '13px', color: '#93b5d3', marginTop: '4px' }}>
                        {weather.temperature_c != null ? `${weather.temperature_c}°C` : '--'}
                        {weather.apparent_temperature_c != null && (
                          <span style={{ marginLeft: '8px', color: '#7295b3', fontSize: '11px' }}>
                            (Feels {weather.apparent_temperature_c}°C)
                          </span>
                        )}
                      </div>
                    </div>

                    {getWeatherIcon(weather.condition, 54)}
                  </div>

                  <div className="metricGrid">
                    <Metric
                      icon={<Wind size={18} />}
                      label="Wind Speed"
                      value={`${weather.wind_speed_kmh ?? '--'} km/h`}
                    />
                    <Metric
                      icon={<Compass size={18} />}
                      label="Wind Direction"
                      value={weather.wind_direction != null ? `${weather.wind_direction}°` : '--'}
                    />
                    <Metric
                      icon={<Wind size={18} />}
                      label="Wind Gusts"
                      value={`${weather.wind_gust_kmh ?? '--'} km/h`}
                    />
                    <Metric
                      icon={<Eye size={18} />}
                      label="Visibility"
                      value={`${weather.visibility_km ?? '--'} km`}
                    />
                    <Metric
                      icon={<Waves size={18} />}
                      label="Wave Height"
                      value={weather.wave_height_m != null ? `${weather.wave_height_m} m` : '--'}
                    />
                    <Metric
                      icon={<Waves size={18} />}
                      label="Sea Swell"
                      value={weather.swell_wave_height_m != null ? `${weather.swell_wave_height_m} m` : '--'}
                    />
                    <Metric
                      icon={<Clock3 size={18} />}
                      label="Wave Period"
                      value={weather.wave_period_s != null ? `${weather.wave_period_s} s` : '--'}
                    />
                    <Metric
                      icon={<AlertTriangle size={18} />}
                      label="Storm Warning"
                      value={weather.storm_alert ? 'Active Warning' : 'Clear'}
                    />
                  </div>

                  <div className="impactBox">
                    <div className="impactTitle">
                      <Activity size={16} />
                      Operational Weather Impact
                    </div>
                    <p>{weather.operational_impact || 'Favorable conditions supporting standard navigation.'}</p>
                  </div>
                </div>

                {/* CONGESTION CARD */}
                <div className="intelligenceCard">
                  <div className="cardHeader">
                    <div className="cardTitleGroup">
                      <div className="cardIcon congestionIcon">
                        <Ship size={22} />
                      </div>
                      <div>
                        <div className="cardEyebrow">HARBOR FLOW &amp; QUEUEING</div>
                        <h3>Port Congestion</h3>
                      </div>
                    </div>

                    <span className={`statusPill ${congestionRisk.toLowerCase()}`}>
                      {congestionRisk} TRAFFIC
                    </span>
                  </div>

                  <div className="conditionHero">
                    <div>
                      <div className="conditionLabel">CONGESTION LEVEL</div>
                      <div className="conditionValue">{congestion.congestion_level || 'LOW'}</div>
                      <div style={{ fontSize: '13px', color: '#93b5d3', marginTop: '4px' }}>
                        Estimated Berth Delay: {congestion.expected_waiting ?? '--'} days
                      </div>
                    </div>

                    <Ship size={54} strokeWidth={1.3} className="text-blue-400" />
                  </div>

                  <div className="metricGrid">
                    <Metric
                      icon={<Ship size={18} />}
                      label="Vessels Waiting"
                      value={congestion.vessels_waiting ?? '--'}
                    />
                    <Metric
                      icon={<Clock3 size={18} />}
                      label="Queue Duration"
                      value={`${congestion.queue_days ?? congestion.expected_waiting ?? '--'} days`}
                    />
                    <Metric
                      icon={<Gauge size={18} />}
                      label="Turnaround Time"
                      value={`${congestion.turnaround_days ?? '--'} days`}
                    />
                    <Metric
                      icon={<Activity size={18} />}
                      label="Weather Delay Factor"
                      value={
                        congestion.weather_delay_factor
                          ? `+${congestion.weather_delay_factor} days`
                          : 'Normal Berth Cycle'
                      }
                    />
                  </div>

                  <div className="impactBox">
                    <div className="impactTitle">
                      <Activity size={16} />
                      Berth Flow &amp; Demurrage Assessment
                    </div>
                    <p>{congestion.operational_impact || 'Prompt turnaround with standard berth operations.'}</p>
                  </div>
                </div>
              </div>

              {/* DECISION ENGINE */}
              <div className="decisionImpact">
                <div className="decisionImpactHeader">
                  <div className="decisionIcon">
                    <ShieldCheck size={21} />
                  </div>
                  <div>
                    <div className="cardEyebrow">INTELLIGENT DECISION ENGINE</div>
                    <h3>Strategic Operational Assessment</h3>
                  </div>
                </div>

                <div className="decisionImpactGrid">
                  <DecisionMetric label="Weather Risk" value={weatherRisk} type={weatherRisk} />
                  <DecisionMetric label="Port Congestion" value={congestionRisk} type={congestionRisk} />
                  <DecisionMetric label="Composite Risk" value={overallRisk} type={overallRisk} />
                  <DecisionMetric
                    label="Chartering Recommendation"
                    value={
                      overallRisk === 'HIGH'
                        ? 'Review Alternatives'
                        : overallRisk === 'MEDIUM'
                        ? 'Monitor Closely'
                        : 'Proceed Normal'
                    }
                  />
                </div>

                <div className="decisionMessage">
                  <ShieldCheck size={18} style={{ flexShrink: 0 }} />
                  <span>
                    {overallRisk === 'LOW'
                      ? `Real-time satellite and oceanographic observations confirm calm seas and standard harbor queues at ${selectedPort}. Normal chartering terms and turnaround schedules are appropriate.`
                      : overallRisk === 'MEDIUM'
                      ? `Elevated operational risk identified at ${selectedPort}. Moderate sea state (${weather.wave_height_m}m wave / ${weather.wind_kmh} km/h wind) and queueing may add 1-2 days waiting time. Factor demurrage exposure into voyage calculations.`
                      : `High operational risk at ${selectedPort} due to severe sea/wind telemetry and heavy port queues. Vessel charterers should evaluate alternative discharge ports or build weather buffer days into agreements.`}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* DATA SOURCE BADGE */}
          <div className="dataSource">
            <div className="sourceStatus">
              <span className="sourceDot" />
              <strong>OPEN-METEO LIVE WEATHER API</strong>
            </div>
            <span>
              Live weather forecast and atmospheric conditions for {selectedPort} from Open-Meteo. Port congestion is provided separately by the port traffic module.
            </span>
          </div>
        </>
      )}

      {/* =====================================================
          TAB 2: GLOBAL PORTS REAL-TIME RADAR MATRIX
          ===================================================== */}
      {activeTab === 'global' && (
        <div className="globalRadarContainer">
          {/* TOP KPI CARDS */}
          <div className="weatherKpiGrid">
            <div className="weatherKpiCard">
              <div className="kpiCardIcon blue">
                <Globe size={20} />
              </div>
              <div>
                <div className="kpiNumber">{radarStats.total}</div>
                <div className="kpiLabel">Selected Ports Monitored</div>
              </div>
            </div>

            <div className="weatherKpiCard">
              <div className="kpiCardIcon red">
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="kpiNumber">{radarStats.high}</div>
                <div className="kpiLabel">High Risk Terminals</div>
              </div>
            </div>

            <div className="weatherKpiCard">
              <div className="kpiCardIcon amber">
                <Activity size={20} />
              </div>
              <div>
                <div className="kpiNumber">{radarStats.medium}</div>
                <div className="kpiLabel">Moderate Risk Ports</div>
              </div>
            </div>

            <div className="weatherKpiCard">
              <div className="kpiCardIcon green">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="kpiNumber">{radarStats.low}</div>
                <div className="kpiLabel">Favorable / Low Risk</div>
              </div>
            </div>
          </div>

          {/* TOOLBAR */}
          <div className="radarToolbar">
            <div className="radarSearchWrap">
              <Search size={15} style={{ color: '#688cae' }} />
              <input
                type="text"
                placeholder="Search by port or country..."
                className="radarSearchInput"
                value={radarSearch}
                onChange={(e) => setRadarSearch(e.target.value)}
              />
            </div>

            <div className="radarFilters">
              <span style={{ fontSize: '11px', color: '#799bb8', alignSelf: 'center', marginRight: '4px' }}>
                Filter Risk:
              </span>
              <button
                className={`radarFilterBtn ${radarFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setRadarFilter('ALL')}
              >
                All ({allPortsData.length})
              </button>
              <button
                className={`radarFilterBtn ${radarFilter === 'HIGH' ? 'active' : ''}`}
                onClick={() => setRadarFilter('HIGH')}
              >
                High Risk ({radarStats.high})
              </button>
              <button
                className={`radarFilterBtn ${radarFilter === 'MEDIUM' ? 'active' : ''}`}
                onClick={() => setRadarFilter('MEDIUM')}
              >
                Moderate ({radarStats.medium})
              </button>
              <button
                className={`radarFilterBtn ${radarFilter === 'LOW' ? 'active' : ''}`}
                onClick={() => setRadarFilter('LOW')}
              >
                Low Risk ({radarStats.low})
              </button>
            </div>
          </div>

          {/* TABLE */}
          {allPortsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#88a6c4' }}>
              <Activity size={28} className="spinningIcon" style={{ margin: '0 auto 12px', color: '#38bdf8' }} />
              <p>Fetching live weather conditions for 8 selected strategic ports...</p>
            </div>
          ) : (
            <div className="radarTableWrap">
              <table className="radarTable">
                <thead>
                  <tr>
                    <th>Port Name</th>
                    <th>Country</th>
                    <th>Live Condition</th>
                    <th>Temp (°C)</th>
                    <th>Wind (km/h)</th>
                    <th>Waves (m)</th>
                    <th>Delay Est.</th>
                    <th>Live Risk</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRadarPorts.map((p) => (
                    <tr key={p.port}>
                      <td>
                        <strong style={{ color: '#e5f1fb' }}>{p.port}</strong>
                        {p.port === destinationPort && (
                          <span
                            style={{
                              marginLeft: '6px',
                              fontSize: '9px',
                              padding: '2px 5px',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.2)',
                              color: '#38bdf8'
                            }}
                          >
                            DESTINATION
                          </span>
                        )}
                      </td>
                      <td style={{ color: '#8faac2' }}>{p.country}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {getWeatherIcon(p.condition, 14)}
                          {p.condition}
                        </span>
                      </td>
                      <td>{p.temperature_c ?? '--'}°C</td>
                      <td>
                        {p.wind_kmh ?? '--'}
                        {p.wind_gusts_kmh && (
                          <span style={{ fontSize: '10px', color: '#7797b5', marginLeft: '4px' }}>
                            (G {p.wind_gusts_kmh})
                          </span>
                        )}
                      </td>
                      <td>{p.wave_height_m != null ? `${p.wave_height_m} m` : '--'}</td>
                      <td>
                        {p.delay_range_days
                          ? `${p.delay_range_days.min}-${p.delay_range_days.max} days`
                          : '--'}
                      </td>
                      <td>
                        <span className={`statusPill ${String(p.severity).toLowerCase()}`}>
                          {p.severity}
                        </span>
                      </td>
                      <td>
                        <button
                          className="radarInspectBtn"
                          onClick={() => {
                            setSelectedPort(p.port)
                            setActiveTab('detail')
                          }}
                        >
                          Inspect Port
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredRadarPorts.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#799bb8' }}>
                        No ports match the selected filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Metric({ icon, label, value }) {
  return (
    <div className="metricItem">
      <div className="metricIcon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function DecisionMetric({ label, value, type }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={type ? String(type).toLowerCase() : ''}>{value}</strong>
    </div>
  )
}
