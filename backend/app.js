const path = require("path");
const dotenv = require("dotenv");

// Load the backend .env explicitly so startup does not depend on the shell
// current working directory.
dotenv.config({ path: path.resolve(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const http = require("http");
const { createSocketServer } = require("./socket");

const sequelize =
    require("./config/database");

const User =
    require("./models/User");

const userRoutes =
    require("./routes/userRoutes");
const messageRoutes =
    require("./routes/messageRoutes");
const groupRoutes =
    require("./routes/groupRoutes");
const mediaRoutes =
    require("./routes/mediaRoutes");
const models = require("./models");
const { startArchiveScheduler } = require("./services/messageArchiver");

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

app.use(
    "/group",
    groupRoutes
);

app.use(
    "/media",
    mediaRoutes
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

        // Tables for archived private/group messages are created by Sequelize sync.
        // The scheduler runs nightly in the server's timezone (default 02:00).
        startArchiveScheduler();


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