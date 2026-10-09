require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const sequelize = require("../config/database");
const { archiveOldMessages } = require("../services/messageArchiver");

(async () => {
  try {
    await sequelize.authenticate();
    const result = await archiveOldMessages();
    console.log("Manual archive run result:", result);
  } catch (error) {
    console.error("Manual archive run failed:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
