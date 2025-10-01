import { EnSyncEngine } from "ensync-client-sdk";
import dotenv from "dotenv";

dotenv.config({
    path: "../.env",
});

const workspaceName = "gms/bash";

const eventName = `${workspaceName}/1`;
console.log(process.env.ENSYNC_ENGINE_URL);
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

const pickOne = (arr) => arr[randInt(0, arr.length - 1)];

// Helper to extract payload shape (SDK shape unknown)
const extractPayload = (evt) => {
    if (evt && typeof evt === "object") {
        return evt.payload ?? evt.data ?? evt;
    }
    return evt;
};

async function watchSub() {
    const client = await ensyncClient.createClient(
        process.env.ENSYNC_CLIENT_ID
    );

    const appSecretKey = process.env.SECRET_KEY;

    const sub = await client.subscribe(eventName, {
        appSecretKey,
        autoAck: false,
    });

    sub.on(async (event) => {
        try {
            const payload = extractPayload(event);

            console.log(
                `Received ${eventName}: ${JSON.stringify(payload, null, 2)}`
            );

            // Ack this message
            try {
                const idem = event.id ?? event.idem;
                await sub.ack(idem, event.block);
            } catch (ackErr) {
                console.log("Ack error", ackErr);
            }
        } catch (e) {
            console.log("Subscriber handler exception", e);
        }
    });
}

async function publishLoop() {
    const client = await ensyncClient.createClient(
        process.env.ENSYNC_CLIENT_ID
    );

    console.log("Publisher started with receiver(s):", receiversId);

    const limit = 5000;

    for (let i = 0; i < limit; i++) {
        const now = Date.now();
        const random = i;

        try {
            if (receiversId.length > 0) {
                const data = {
                    level: Math.round(random),
                    timestamp: now,
                };
                await client.publish(eventName, receiversId, data);
                console.log(
                    `Published ${eventName}: ${JSON.stringify(data, null, 2)}`
                );
            }
        } catch (e) {
            console.error("Failed to publish to ", eventName, e);
        }

        console.log("Sent data");
    }
}

// watchSub().catch((e) => {
//     console.error("Subscriber crashed", e);
// });

publishLoop().catch((e) => {
    console.error("Publisher crashed", e);
});
