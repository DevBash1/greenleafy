// ensync.emit.service.js
// Subscribe to EnSync events and broadcast them to all Socket.IO clients

const { EnSyncEngine } = require("ensync-client-sdk");
const { emitToAll } = require("./socket.service");
const dotenv = require("dotenv");

dotenv.config({ path: "../.env" });

// Optional mapping from EnSync topic to Socket.IO event name (no slashes)
const workspaceName = "progo";
const socketEventMap = {
    [`${workspaceName}/plant/water`]: "plant_water",
    [`${workspaceName}/plant/soil`]: "plant_soil",
    [`${workspaceName}/plant/temperature`]: "plant_temp",
    [`${workspaceName}/plant/light`]: "plant_light",
};

async function startSubscriber() {
    const engineUrl = process.env.ENSYNC_ENGINE_URL || "https://localhost:8443";
    const clientAccessKey =
        process.env.ENSYNC_CLIENT_ID || process.env.CLIENT_ACCESS_KEY;
    const appSecretKey = process.env.SECRET_KEY;

    if (!clientAccessKey || !appSecretKey) {
        console.warn(
            "Missing ENSYNC credentials (ENSYNC_CLIENT_ID/CLIENT_ACCESS_KEY or SECRET_KEY)"
        );
        return;
    }

    // Topics to subscribe: either comma-separated ENV or all known mapped topics
    const envTopics = (process.env.EVENT_TO_PUBLISH || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const topics =
        envTopics.length > 0 ? envTopics : Object.keys(socketEventMap);

    // Enable disableTls automatically for localhost HTTPS
    const opts = {};
    if (engineUrl.startsWith("https://localhost")) {
        opts.disableTls = true;
    }
    const ensyncClient = new EnSyncEngine(engineUrl, opts);

    let client;
    try {
        client = await ensyncClient.createClient(clientAccessKey);

        // Helper to extract payload shape (SDK shape unknown)
        const extractPayload = (evt) => {
            if (evt && typeof evt === "object") {
                return evt.payload ?? evt.data ?? evt;
            }
            return evt;
        };

        // Create a subscription for each topic
        for (const topic of topics) {
            // Test emit
            setInterval(() => {
                const mapped = socketEventMap[topic];

                if (mapped) {
                    function randInt(min, max) {
                        return (
                            Math.floor(Math.random() * (max - min + 1)) + min
                        );
                    }

                    // Keep simple drifting state to look realistic
                    const state = {
                        waterLevel: randInt(35, 75), // %
                        soilMoisture: randInt(30, 65), // %
                        temperatureC: 22 + Math.random() * 6, // 22–28C
                        lightLux: randInt(3500, 14000), // lux
                    };

                    emitToAll(mapped, {
                        moisture: state.soilMoisture,
                        level: state.waterLevel,
                        celsius: state.temperatureC,
                        lux: state.lightLux,
                        timestamp: Date.now(),
                    });
                }
            }, 1000);

            try {
                const sub = await client.subscribe(topic, { appSecretKey });
                sub.on(async (event) => {
                    try {
                        const payload = extractPayload(event);

                        // Generic broadcast for debugging/observability
                        emitToAll("ensync_event", {
                            eventName: topic,
                            payload,
                            raw: event,
                        });

                        // If mapped, emit to a Socket.IO event
                        const mapped = socketEventMap[topic];
                        if (mapped) {
                            emitToAll(mapped, payload);
                        }

                        // Ack this message
                        // await sub.ack(event.idem, event.block);
                        // await subscription.unsubscribe();
                    } catch (e) {
                        console.log("Subscriber handler exception", e);
                    }
                });
                console.log("Subscribed to:", topic);
            } catch (err) {
                console.warn(
                    "Failed to subscribe to topic",
                    topic,
                    err && err.message ? err.message : err
                );
            }
        }
    } catch (e) {
        console.log(
            "Subscriber initialization failed",
            e && e.message ? e.message : e
        );
        try {
            client && client.destroy && client.destroy();
        } catch {}
        try {
            ensyncClient && ensyncClient.close && ensyncClient.close();
        } catch {}
    }
}

// Auto-start like the sample
startSubscriber();

module.exports = { startSubscriber };
