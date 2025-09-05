import { EnSyncEngine } from "ensync-client-sdk";
import dotenv from "dotenv";

dotenv.config({
    path: "../.env",
});

const workspaceName = "progo";

const plantWaterEventName = `${workspaceName}/plant/water`;
const plantSoilEventName = `${workspaceName}/plant/soil`;
const plantTempEventName = `${workspaceName}/plant/temperature`;
const plantLightEventName = `${workspaceName}/plant/light`;

const ensyncClient = new EnSyncEngine(process.env.ENSYNC_ENGINE_URL, {
    accessKey: process.env.ENSYNC_CLIENT_ID,
});

const receiversId = [process.env.RECEIVER_IDENTIFICATION_NUMBER].filter(
    Boolean
);

function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

// Keep simple drifting state to look realistic
const state = {
    waterLevel: randInt(35, 75), // %
    soilMoisture: randInt(30, 65), // %
    temperatureC: 22 + Math.random() * 6, // 22–28C
    lightLux: randInt(3500, 14000), // lux
};

async function publishLoop() {
    const client = await ensyncClient.createClient(
        process.env.ENSYNC_CLIENT_ID
    );

    console.log("Publisher started with receiver(s):", receiversId);

    while (true) {
        const now = Date.now();

        // Drift values a bit each cycle
        state.waterLevel = clamp(state.waterLevel + randInt(-2, 2), 5, 95);
        state.soilMoisture = clamp(state.soilMoisture + randInt(-2, 3), 10, 90);
        state.temperatureC = clamp(
            state.temperatureC + (Math.random() - 0.5) * 0.8,
            12,
            35
        );
        // Occasionally toggle brighter/dimmer ranges
        const lightDelta = randInt(-900, 900);
        state.lightLux = clamp(state.lightLux + lightDelta, 500, 20000);

        try {
            if (receiversId.length > 0) {
                const data = {
                    level: Math.round(state.waterLevel),
                    timestamp: now,
                };
                await client.publish(plantWaterEventName, receiversId, data);
                console.log(`Published ${plantWaterEventName}: ${data}`);
            }
        } catch (e) {
            console.error("Failed to publish water", e);
        }

        await sleep(randInt(120, 500));

        try {
            if (receiversId.length > 0) {
                const data = {
                    moisture: Math.round(state.soilMoisture),
                    timestamp: now,
                };
                await client.publish(plantSoilEventName, receiversId, data);
                console.log(
                    `Published ${plantSoilEventName}: ${JSON.stringify(
                        data,
                        null,
                        2
                    )}`
                );
            }
        } catch (e) {
            console.error("Failed to publish soil", e);
        }

        await sleep(randInt(120, 500));

        try {
            if (receiversId.length > 0) {
                const data = {
                    celsius: Number(state.temperatureC.toFixed(1)),
                    timestamp: now,
                };
                await client.publish(plantTempEventName, receiversId, data);
                console.log(
                    `Published ${plantTempEventName}: ${JSON.stringify(
                        data,
                        null,
                        2
                    )}`
                );
            }
        } catch (e) {
            console.error("Failed to publish temp", e);
        }

        await sleep(randInt(120, 500));

        try {
            if (receiversId.length > 0) {
                const data = {
                    lux: Math.round(state.lightLux),
                    timestamp: now,
                };
                await client.publish(plantLightEventName, receiversId, data);
                console.log(
                    `Published ${plantLightEventName}: ${JSON.stringify(
                        data,
                        null,
                        2
                    )}`
                );
            }
        } catch (e) {
            console.error("Failed to publish light", e);
        }

        // Random gap before next cycle
        await sleep(randInt(3500, 7500));

        console.log("Sent data");
    }
}

publishLoop().catch((e) => {
    console.error("Publisher crashed", e);
});
