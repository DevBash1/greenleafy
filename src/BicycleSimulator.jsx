import React, { useEffect, useRef, useState } from "react";

// PlantSimulator emits: { waterLevel, temperatureC, soilMoisture, lightLux, running, timestamp }
export default function PlantSimulator({
    onTick,
    tickMs = 500,
    className = "",
    registerControls,
    autoStart = true,
}) {
    const [running, setRunning] = useState(!!autoStart);
    const [waterLevel, setWaterLevel] = useState(65); // % reservoir
    const [soilMoisture, setSoilMoisture] = useState(42); // %
    const [temperatureC, setTemperatureC] = useState(22); // °C
    const [lightLux, setLightLux] = useState(7000); // lux
    const [growLightOn, setGrowLightOn] = useState(false);
    const [tempBias, setTempBias] = useState(0); // user nudge

    const onTickRef = useRef(onTick);
    useEffect(() => {
        onTickRef.current = onTick;
    }, [onTick]);

    // Expose controls to parent
    useEffect(() => {
        if (!registerControls) return;
        registerControls({
            toggleRunning: () => setRunning((r) => !r),
            waterNow: () => {
                setWaterLevel((w) => clamp(w + 15, 0, 100));
                setSoilMoisture((s) => clamp(s + 10, 0, 100));
            },
            toggleGrowLight: () => setGrowLightOn((g) => !g),
            nudgeTemp: (d) => setTempBias((b) => clamp(b + (Number(d) || 0), -5, 5)),
        });
    }, [registerControls]);

    // Emit immediately on key state changes
    useEffect(() => {
        onTickRef.current?.({
            waterLevel,
            temperatureC,
            soilMoisture,
            lightLux,
            running,
            timestamp: Date.now(),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [waterLevel, temperatureC, soilMoisture, lightLux, running]);

    // Simulation loop
    const lastTsRef = useRef(performance.now());
    useEffect(() => {
        if (!running) return;
        let cancelled = false;
        const step = () => {
            if (cancelled) return;
            const now = performance.now();
            const dt = Math.min(1.2, (now - lastTsRef.current) / 1000); // seconds
            lastTsRef.current = now;

            // Light target
            const targetLux = growLightOn ? 16000 : 5000 + 2000 * Math.sin(now / 8000);
            setLightLux((l) => l + (targetLux - l) * 0.12);

            // Temperature tends toward ambient + bias + slight day cycle
            const ambient = 22 + 2 * Math.sin(now / 15000);
            const targetTemp = ambient + (growLightOn ? 1.5 : 0) + tempBias;
            setTemperatureC((t) => t + (targetTemp - t) * (0.18 * dt));

            // Soil moisture decays; grow light accelerates evap slightly
            const evap = (growLightOn ? 0.45 : 0.35) * dt; // % per sec
            setSoilMoisture((s) => clamp(s - evap, 0, 100));

            // Reservoir slowly decreases; a bit faster when soil is dry (plant drinks more when watered too)
            const draw = (0.08 + (soilMoisture < 30 ? 0.05 : 0)) * dt; // % per sec
            setWaterLevel((w) => clamp(w - draw, 0, 100));

            // Emit
            onTickRef.current?.({
                waterLevel: (prev => prev)(waterLevel),
                temperatureC: (prev => prev)(temperatureC),
                soilMoisture: (prev => prev)(soilMoisture),
                lightLux: (prev => prev)(lightLux),
                running: true,
                timestamp: Date.now(),
            });

            setTimeout(step, tickMs);
        };
        const id = setTimeout(step, tickMs);
        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [running, tickMs, growLightOn, tempBias, waterLevel, soilMoisture, temperatureC, lightLux]);

    return (
        <div className={`rounded-xl border border-emerald-200 bg-emerald-50/30 w-full p-4 ${className}`}>
            <div className="grid grid-cols-2 gap-3 text-sm text-emerald-800">
                <div>
                    <div className="text-xs text-emerald-700/80">Water</div>
                    <div className="font-semibold text-emerald-900">{waterLevel.toFixed(0)}%</div>
                </div>
                <div>
                    <div className="text-xs text-emerald-700/80">Soil</div>
                    <div className="font-semibold text-emerald-900">{soilMoisture.toFixed(0)}%</div>
                </div>
                <div>
                    <div className="text-xs text-emerald-700/80">Temp</div>
                    <div className="font-semibold text-emerald-900">{temperatureC.toFixed(1)}°C</div>
                </div>
                <div>
                    <div className="text-xs text-emerald-700/80">Light</div>
                    <div className="font-semibold text-emerald-900">{Math.round(lightLux)} lux</div>
                </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                    className={`rounded-md px-3 py-2 text-sm ring-1 transition-all ${running ? "bg-emerald-600 text-white ring-emerald-600 hover:bg-emerald-700" : "bg-white text-emerald-700 ring-emerald-300 hover:bg-emerald-50"}`}
                    onClick={() => setRunning((r) => !r)}
                >
                    {running ? "Stop" : "Start"}
                </button>
                <button
                    className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-50"
                    onClick={() => {
                        setWaterLevel((w) => clamp(w + 15, 0, 100));
                        setSoilMoisture((s) => clamp(s + 10, 0, 100));
                    }}
                >
                    Water now
                </button>
                <button
                    className={`rounded-md px-3 py-2 text-sm ring-1 transition-all ${growLightOn ? "bg-emerald-100 text-emerald-900 ring-emerald-300" : "bg-white text-emerald-700 ring-emerald-300"}`}
                    onClick={() => setGrowLightOn((g) => !g)}
                >
                    {growLightOn ? "Grow light: On" : "Grow light: Off"}
                </button>
            </div>
        </div>
    );
}

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
