require("dotenv").config();
const app = require("./app");
const { startEvidenceScanScheduler } = require("./jobs/evidenceScan.job");

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
  startEvidenceScanScheduler();
});
