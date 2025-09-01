import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

function Section({ id, className = "", children }) {
    return (
        <section id={id} className={`relative py-16 ${className}`}>
            <div className="container mx-auto max-w-6xl px-6">{children}</div>
        </section>
    );
}

function StatCard({ label, value, unit, status, hint }) {
    return (
        <div className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-emerald-800/80">{label}</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-900">
                {value}
                {unit ? (
                    <span className="ml-1 text-base font-normal text-emerald-700">
                        {unit}
                    </span>
                ) : null}
            </div>
            {status ? (
                <div className="mt-3 inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700 ring-1 ring-emerald-200">
                    {status}
                </div>
            ) : null}
            {hint ? (
                <div className="mt-2 text-xs text-emerald-700/80">{hint}</div>
            ) : null}
        </div>
    );
}

export default function App() {
    const headerRef = useRef(null);
    const [metrics, setMetrics] = useState(null); // { waterLevel, temperatureC, soilMoisture, lightLux }
    const [showIntegrationModal, setShowIntegrationModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [ensyncLoading, setEnsyncLoading] = useState(false);
    const [ensyncUrl, setEnsyncUrl] = useState("");
    const [sessionId, setSessionId] = useState("");
    const socketRef = useRef(null);
    // UI animation flags
    const [waterAnim, setWaterAnim] = useState(false);
    const [lightGlow, setLightGlow] = useState(false);
    const [tempPulse, setTempPulse] = useState(0); // -1 cooler, 1 warmer, 0 none

    // Simple derived growth index for a tiny simulation visual
    const growthIndex = (() => {
        const w = metrics?.waterLevel ?? 0;
        const s = metrics?.soilMoisture ?? 0;
        const t = metrics?.temperatureC ?? 0;
        const l = metrics?.lightLux ?? 0;
        const wScore = clamp01((w - 20) / 60); // best 20-80%
        const sScore = clamp01((s - 30) / 40); // best 30-70%
        const tScore = clamp01(1 - Math.abs(t - 24) / 10); // best around 24C
        const lScore = clamp01((l - 4000) / 12000); // best 4k-16k
        return Math.round(((wScore + sScore + tScore + lScore) / 4) * 100);
    })();

    // Simple status helpers
    const waterStatus = (() => {
        const w = metrics?.waterLevel ?? 0;
        if (w < 20) return "Low – water soon";
        if (w < 60) return "Optimal";
        return "High";
    })();
    const soilStatus = (() => {
        const s = metrics?.soilMoisture ?? 0;
        if (s < 25) return "Dry";
        if (s < 60) return "Good";
        return "Wet";
    })();

    useEffect(() => {
        document.body.classList.add("bg-white");
        return () => document.body.classList.remove("bg-white");
    }, []);

    // Restore session id from storage
    useEffect(() => {
        const key = "greenleafy_session_id";
        const sid = localStorage.getItem(key);
        if (sid) setSessionId(sid);
    }, []);

    // Socket.IO connection (same host/port pattern as before)
    useEffect(() => {
        const s = io("http://localhost:4000");
        socketRef.current = s;
        s.on("connect", () => {
            console.log("Connected to API:", s.id);
        });
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            socketRef.current = null;
        };
    }, []);

    // Subscribe to incoming telemetry from Socket.IO and update metrics
    useEffect(() => {
        const s = socketRef.current;
        if (!s) return;
        const update = (patch) => {
            setMetrics((prev) => ({ ...(prev || {}), ...patch }));
        };
        const onWater = ({ level }) => update({ waterLevel: level });
        const onSoil = ({ moisture }) => update({ soilMoisture: moisture });
        const onTemp = ({ celsius }) => update({ temperatureC: celsius });
        const onLight = ({ lux }) => update({ lightLux: lux });
        s.on("plant_water", onWater);
        s.on("plant_soil", onSoil);
        s.on("plant_temp", onTemp);
        s.on("plant_light", onLight);
        return () => {
            s.off("plant_water", onWater);
            s.off("plant_soil", onSoil);
            s.off("plant_temp", onTemp);
            s.off("plant_light", onLight);
        };
    }, []);

    const generateSessionId = () => {
        const rnd = Math.random().toString(36).slice(2);
        const ts = Date.now().toString(36);
        return `sess_${ts}_${rnd}`;
    };

    const regenerateSession = () => {
        const key = "greenleafy_session_id";
        const sid = generateSessionId();
        localStorage.setItem(key, sid);
        setSessionId(sid);
        setEnsyncUrl("");
    };

    return (
        <div className="min-h-full text-emerald-950">
            {/* Header */}
            <header
                ref={headerRef}
                className="sticky top-0 z-40 border-b border-emerald-200 bg-white/95 backdrop-blur"
            >
                <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
                    <a href="#home" className="text-lg font-semibold text-emerald-900">
                        GreenLeafy
                    </a>
                    <div className="hidden gap-6 sm:flex">
                        <a href="#overview" className="text-emerald-700 hover:text-emerald-900">
                            Overview
                        </a>
                        <a href="#controls" className="text-emerald-700 hover:text-emerald-900">
                            Controls
                        </a>
                        <a href="#plans" className="text-emerald-700 hover:text-emerald-900">
                            Plans
                        </a>
                    </div>
                </nav>
            </header>

            {/* Hero */}
            <Section id="home" className="pt-10 pb-4">
                <div className="mx-auto max-w-4xl text-center">
                    <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-emerald-900">
                        Monitor your plants in real time
                    </h1>
                    <p className="mt-3 text-emerald-700">
                        Track water level, temperature, soil moisture, and light with a clean
                        white/green theme.
                    </p>
                </div>
            </Section>

            {/* Overview */}
            <Section id="overview" className="pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        label="Water Level"
                        value={metrics ? metrics.waterLevel.toFixed(0) : "--"}
                        unit="%"
                        status={waterStatus}
                        hint="Reservoir status"
                    />
                    <StatCard
                        label="Temperature"
                        value={metrics ? metrics.temperatureC.toFixed(1) : "--"}
                        unit="°C"
                        status={metrics ? (metrics.temperatureC < 15 ? "Cool" : metrics.temperatureC > 30 ? "Hot" : "Comfortable") : undefined}
                        hint="Ambient"
                    />
                    <StatCard
                        label="Soil Moisture"
                        value={metrics ? metrics.soilMoisture.toFixed(0) : "--"}
                        unit="%"
                        status={soilStatus}
                        hint="Target 35–60%"
                    />
                    <StatCard
                        label="Light"
                        value={metrics ? metrics.lightLux.toFixed(0) : "--"}
                        unit="lux"
                        status={metrics ? (metrics.lightLux < 3000 ? "Low" : metrics.lightLux > 15000 ? "Strong" : "Moderate") : undefined}
                        hint="Photosynthetically useful light"
                    />
                </div>
            </Section>

            {/* Controls & Simulator */}
            <Section id="controls" className="pt-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-emerald-200 bg-white p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm text-emerald-700">Live telemetry</div>
                                <div className="text-lg font-semibold text-emerald-900">
                                    {metrics ? "Receiving" : "Waiting for data"}
                                </div>
                            </div>
                        </div>
                        <div className="mt-6">
                            <div className="text-sm font-medium text-emerald-900">Plant simulation</div>
                            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                                <div className="flex items-center gap-4">
                                    {/* Plant + soil SVG with animations */}
                                    <div className="relative h-20 w-24 shrink-0">
                                        <svg viewBox="0 0 120 100" className="h-full w-full">
                                            {/* Soil mound */}
                                            <ellipse cx="60" cy="86" rx="18" ry="6" fill="#5b3a29" stroke="#8b5e3c" strokeWidth="2" />
                                            {/* Water droplets when watering */}
                                            {waterAnim ? (
                                                <g>
                                                    <circle cx="40" cy="30" r="3" fill="#60a5fa">
                                                        <animate attributeName="cy" from="20" to="84" dur="0.8s" fill="freeze" />
                                                        <animate attributeName="opacity" from="1" to="0" dur="0.8s" fill="freeze" />
                                                    </circle>
                                                    <circle cx="60" cy="28" r="2.5" fill="#60a5fa">
                                                        <animate attributeName="cy" from="18" to="84" dur="0.8s" fill="freeze" />
                                                        <animate attributeName="opacity" from="1" to="0" dur="0.8s" fill="freeze" />
                                                    </circle>
                                                    <circle cx="80" cy="26" r="2" fill="#60a5fa">
                                                        <animate attributeName="cy" from="16" to="84" dur="0.8s" fill="freeze" />
                                                        <animate attributeName="opacity" from="1" to="0" dur="0.8s" fill="freeze" />
                                                    </circle>
                                                </g>
                                            ) : null}
                                            {/* Soil ripple on watering */}
                                            {waterAnim ? (
                                                <g>
                                                    <ellipse cx="60" cy="86" rx="6" ry="2" fill="none" stroke="#93c5fd" strokeWidth="1.5" opacity="0.8">
                                                        <animate attributeName="rx" from="6" to="32" dur="0.9s" fill="freeze" />
                                                        <animate attributeName="opacity" from="0.8" to="0" dur="0.9s" fill="freeze" />
                                                    </ellipse>
                                                </g>
                                            ) : null}
                                            {/* Plant group */}
                                            <g transform="translate(60,80)" style={{ filter: lightGlow ? "drop-shadow(0 0 6px rgba(16,185,129,0.8))" : "none" }}>
                                                {/* Stem (brown, taller, gentle S-curve) */}
                                                <path d="M0 0 C -4 -14, -4 -30, 0 -44" stroke={tempPulse === 1 ? "#ef4444" : tempPulse === -1 ? "#3b82f6" : "#8b5e3c"} strokeWidth="3" fill="none" />
                                                {/* Leaves (broader) with highlights and midribs */}
                                                <g>
                                                    {/* Left leaf */}
                                                    <path d="M0 -18 C -22 -20, -34 -6, -36 8 C -22 2, -10 -10, 0 -18 Z" fill={growthIndex > 70 ? "#059669" : growthIndex > 40 ? "#10b981" : "#34d399"} stroke="#047857" strokeWidth="1.2" />
                                                    <path d="M-2 -18 C -16 -20, -26 -9, -28 3 C -18 -2, -9 -9, -2 -18 Z" fill="#34d399" opacity="0.6" />
                                                    <path d="M-2 -18 C -12 -14, -20 -6, -26 2" stroke="#065f46" strokeWidth="1" opacity="0.5" fill="none" />
                                                    {/* Right leaf */}
                                                    <path d="M0 -26 C 22 -28, 34 -16, 36 -2 C 22 -8, 10 -16, 0 -26 Z" fill={growthIndex > 70 ? "#059669" : growthIndex > 40 ? "#10b981" : "#34d399"} stroke="#047857" strokeWidth="1.2" />
                                                    <path d="M2 -26 C 16 -28, 26 -18, 28 -6 C 18 -10, 9 -16, 2 -26 Z" fill="#34d399" opacity="0.6" />
                                                    <path d="M2 -26 C 12 -22, 20 -16, 26 -8" stroke="#065f46" strokeWidth="1" opacity="0.5" fill="none" />
                                                    {/* Top leaf */}
                                                    <path d="M0 -36 C -14 -38, -24 -30, -26 -24 C -14 -26, -6 -30, 0 -36 Z" fill={growthIndex > 70 ? "#059669" : growthIndex > 40 ? "#10b981" : "#34d399"} stroke="#047857" strokeWidth="1.2" />
                                                    <path d="M-1 -36 C -10 -38, -18 -31, -20 -26 C -11 -28, -5 -31, -1 -36 Z" fill="#34d399" opacity="0.6" />
                                                    <path d="M-1 -36 C -8 -33, -15 -28, -19 -25" stroke="#065f46" strokeWidth="1" opacity="0.5" fill="none" />
                                                </g>
                                            </g>
                                        </svg>
                                        {/* Light halo when glow enabled */}
                                        {lightGlow ? (
                                            <div className="pointer-events-none absolute inset-0 rounded-lg glow-pulse" style={{ boxShadow: "0 0 24px 6px rgba(16,185,129,0.35)" }} />
                                        ) : null}
                                    </div>
                                    <div className="grow">
                                        <div className="flex items-center justify-between text-sm text-emerald-800">
                                            <span>Growth index</span>
                                            <span className="font-semibold">{isNaN(growthIndex) ? "--" : `${growthIndex}%`}</span>
                                        </div>
                                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                                            <div
                                                className="h-full bg-emerald-500 transition-[width] duration-500"
                                                style={{ width: `${clamp01(growthIndex / 100) * 100}%` }}
                                            />
                                        </div>
                                        <div className="mt-2 text-xs text-emerald-700">
                                            Optimal conditions boost growth: balanced water, soil, temp ~24°C, 4k–16k lux.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right column intentionally left out; no local controls when streaming from server */}
                </div>
            </Section>

            {/* Plans */}
            <Section id="plans" className="pt-2">
                <div className="mx-auto max-w-5xl">
                    <h2 className="text-2xl font-bold text-emerald-900">Plans</h2>
                    <p className="mt-2 text-emerald-700">Choose a plan and integrate with your stack.</p>
                    <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {/* Basic */}
                        <div className="rounded-xl border border-emerald-200 bg-white p-6">
                            <div className="text-sm text-emerald-700">Basic</div>
                            <div className="mt-1 text-3xl font-semibold text-emerald-900">$0</div>
                            <ul className="mt-4 space-y-2 text-sm text-emerald-800">
                                <li>• Local simulator</li>
                                <li>• Core metrics dashboard</li>
                                <li>• Manual controls</li>
                            </ul>
                            <button
                                className="mt-5 w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-emerald-800 hover:bg-emerald-50"
                                onClick={() => {
                                    setSelectedPlan("Basic");
                                    setShowIntegrationModal(true);
                                }}
                            >
                                Integrate
                            </button>
                        </div>
                        {/* Pro */}
                        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 ring-1 ring-emerald-200">
                            <div className="text-sm text-emerald-800">Pro</div>
                            <div className="mt-1 text-3xl font-semibold text-emerald-900">$19<span className="text-base font-normal">/mo</span></div>
                            <ul className="mt-4 space-y-2 text-sm text-emerald-900">
                                <li>• Real sensor streaming (sockets)</li>
                                <li>• Alerts & thresholds</li>
                                <li>• Export & integrations</li>
                            </ul>
                            <button
                                className="mt-5 w-full rounded-md bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700"
                                onClick={() => {
                                    setSelectedPlan("Pro");
                                    setShowIntegrationModal(true);
                                }}
                            >
                                Integrate
                            </button>
                        </div>
                    </div>
                </div>
            </Section>

            {/* Footer */}
            <footer className="border-t border-emerald-200 py-8">
                <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-emerald-700">© {new Date().getFullYear()} GreenLeafy</div>
                    <div className="flex gap-6 text-emerald-700">
                        <a href="#overview" className="hover:text-emerald-900">Overview</a>
                        <a href="#controls" className="hover:text-emerald-900">Controls</a>
                        <a href="#plans" className="hover:text-emerald-900">Plans</a>
                    </div>
                </div>
            </footer>

            {/* Integration Modal */}
            {showIntegrationModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                    <div className="w-full max-w-md rounded-xl border border-emerald-200 bg-white p-6 shadow-xl">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-sm text-emerald-700">Integration</div>
                                <div className="text-lg font-semibold text-emerald-900">{selectedPlan} plan</div>
                            </div>
                            <button
                                className="rounded-md px-2 py-1 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => setShowIntegrationModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        {!ensyncUrl ? (
                            <div className="mt-4 space-y-4">
                                <p className="text-sm text-emerald-800">
                                    Connect EnSync to relay your plant simulation events.
                                </p>
                                <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50/40 p-4">
                                    <div>
                                        <div className="font-medium text-emerald-900">EnSync</div>
                                        <div className="text-xs text-emerald-700">Event-driven Synchronization Engine</div>
                                        <div className="mt-2 text-xs text-emerald-700">
                                            Session: <span className="font-mono text-emerald-900">{sessionId}</span>
                                        </div>
                                    </div>
                                    <button
                                        className={`rounded-md px-4 py-2 text-sm ring-1 transition-all ${
                                            ensyncLoading
                                                ? "bg-emerald-100 text-emerald-600 ring-emerald-200 cursor-not-allowed"
                                                : "bg-emerald-600 text-white ring-emerald-600 hover:bg-emerald-700"
                                        }`}
                                        disabled={ensyncLoading}
                                        onClick={async () => {
                                            try {
                                                setEnsyncLoading(true);
                                                let sid = sessionId;
                                                if (!sid) {
                                                    sid = generateSessionId();
                                                    localStorage.setItem("greenleafy_session_id", sid);
                                                    setSessionId(sid);
                                                }
                                                const plan = (selectedPlan || "basic").toLowerCase() === "pro" ? "pro" : "basic";
                                                const res = await fetch(`http://localhost:4000/api/ensync/connect/${plan}?session=${encodeURIComponent(sid)}`);
                                                const data = await res.json();
                                                setEnsyncUrl(data?.url || "");
                                            } catch (e) {
                                                console.error("Failed to fetch EnSync URL", e);
                                            } finally {
                                                setEnsyncLoading(false);
                                            }
                                        }}
                                    >
                                        {ensyncLoading ? "Connecting..." : "Connect"}
                                    </button>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        className="text-sm rounded-md border border-emerald-200 bg-white px-3 py-1 text-emerald-800 hover:bg-emerald-50"
                                        onClick={regenerateSession}
                                    >
                                        Regenerate Session
                                    </button>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-emerald-800 hover:bg-emerald-50"
                                        onClick={() => setShowIntegrationModal(false)}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4">
                                <div className="rounded-lg overflow-hidden border border-emerald-200">
                                    <iframe title="EnSync Connect" src={ensyncUrl} className="w-full" style={{ height: 520 }} />
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-emerald-800 hover:bg-emerald-50"
                                        onClick={() => setShowIntegrationModal(false)}
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}
