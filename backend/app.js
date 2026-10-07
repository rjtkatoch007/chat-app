require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { createSocketServer } = require("./socket");

const sequelize =
    require("./config/database");

const User =
    require("./models/User");
const ChatMessage =
    require("./models/ChatMessage");

const userRoutes =
    require("./routes/userRoutes");
const messageRoutes =
    require("./routes/messageRoutes");

const app = express();

const PORT =
    process.env.PORT || 3000;

app.use(cors());

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

// Test route
app.get("/", (req, res) => {

    res.json({

        message:
            "Chat App backend is running"

    });

});

// Routes
app.use(
    "/user",
    userRoutes
);

app.use(
    "/message",
    messageRoutes
);

// Start server
const startServer = async () => {

    try {

        await sequelize.authenticate();

        console.log(
            "MySQL database connected"
        );


        await sequelize.sync({ alter: true });

        console.log(
            "Database tables are ready"
        );


        const server = http.createServer(app);

        createSocketServer(server);

        server.listen(
            PORT,
            () => {

                console.log(
                    `Server running at http://localhost:${PORT}`
                );
                console.log(
                    `Socket.IO endpoint: http://localhost:${PORT}`
                );

            }
        );


    } catch (error) {

        console.error(
            "Unable to start server:",
            error.message
        );

    }
};

startServer();