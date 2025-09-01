// socket.service.js
// Encapsulates Socket.IO event handlers for the Trackpadal API

const { default: axios } = require("axios");
const { EnSyncEngine } = require("ensync-client-sdk");

// Keep a module-scoped reference to io so we can broadcast from elsewhere
let ioRef = null;

// Plant events
const workspaceName = "progo";
const plantWaterEventName = `${workspaceName}/plant/water`;
const plantSoilEventName = `${workspaceName}/plant/soil`;
const plantTempEventName = `${workspaceName}/plant/temperature`;
const plantLightEventName = `${workspaceName}/plant/light`;

const receiversId = [process.env.RECEIVER_IDENTIFICATION_NUMBER];

const ensyncClient = new EnSyncEngine(process.env.ENSYNC_ENGINE_URL);

/**
 * Initialize all socket event handlers
 * @param {import('socket.io').Server} io
 */
async function initSocket(io) {
    ioRef = io;

    const client = await ensyncClient.createClient(
        process.env.ENSYNC_CLIENT_ID
    );

    console.log(process.env.ENSYNC_CLIENT_ID);

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        // Bicycle events removed

        // Event 2: Plan selection
        socket.on("plan_selected", (data) => {
            console.log("📋 Plan Selected:", {
                socketId: socket.id,
                plan: data.plan,
                price: `$${data.price}/mo`,
                timestamp: new Date(data.timestamp).toISOString(),
            });
        });

        // Event 3: Plan purchase
        socket.on("plan_purchased", (data) => {
            console.log("💳 Plan Purchased:", {
                socketId: socket.id,
                plan: data.plan,
                userId: data.userId,
                timestamp: new Date(data.timestamp).toISOString(),
            });
        });

        // Plant telemetry events
        socket.on("plant_water", async ({ level, timestamp }) => {
            console.log("🌿💧 Plant Water:", {
                socketId: socket.id,
                level,
                timestamp: new Date(timestamp).toISOString(),
            });
            try {
                if (receiversId.length > 0) {
                    await client.publish(plantWaterEventName, receiversId, {
                        level,
                        timestamp,
                    });
                }
            } catch (error) {
                console.log(plantWaterEventName);
                console.log(error);
            }
        });

        socket.on("plant_soil", async ({ moisture, timestamp }) => {
            console.log("🌿🧪 Plant Soil:", {
                socketId: socket.id,
                moisture,
                timestamp: new Date(timestamp).toISOString(),
            });
            try {
                if (receiversId.length > 0) {
                    await client.publish(plantSoilEventName, receiversId, {
                        moisture,
                        timestamp,
                    });
                }
            } catch (error) {
                console.log(plantSoilEventName);
                console.log(error);
            }
        });

        socket.on("plant_temp", async ({ celsius, timestamp }) => {
            console.log("🌿🌡️ Plant Temperature:", {
                socketId: socket.id,
                celsius,
                timestamp: new Date(timestamp).toISOString(),
            });
            try {
                if (receiversId.length > 0) {
                    await client.publish(plantTempEventName, receiversId, {
                        celsius,
                        timestamp,
                    });
                }
            } catch (error) {
                console.log(plantTempEventName);
                console.log(error);
            }
        });

        socket.on("plant_light", async ({ lux, timestamp }) => {
            console.log("🌿💡 Plant Light:", {
                socketId: socket.id,
                lux,
                timestamp: new Date(timestamp).toISOString(),
            });
            try {
                if (receiversId.length > 0) {
                    await client.publish(plantLightEventName, receiversId, {
                        lux,
                        timestamp,
                    });
                }
            } catch (error) {
                console.log(plantLightEventName);
                console.log(error);
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });
}

/**
 * Emit an event to all connected clients
 * @param {string} event
 * @param {any} payload
 */
function emitToAll(event, payload) {
    if (!ioRef) {
        console.warn("Socket.IO not initialized yet; cannot emit", { event });
        return;
    }
    ioRef.emit(event, payload);
}

module.exports = { initSocket, emitToAll };
