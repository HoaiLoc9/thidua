const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middlewares/error");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
